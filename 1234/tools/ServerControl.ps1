[CmdletBinding()]
param(
    [ValidateSet('start','stop','restart','status')]
    [string]$Command,

    [switch]$NoGui,

    [int]$Port = 5173
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:ProjectRoot = Split-Path -Parent $PSScriptRoot
$script:ServerEntry = Join-Path $script:ProjectRoot 'server.js'
$script:StateFile = Join-Path $PSScriptRoot 'server-state.json'
$script:LogFile = Join-Path $PSScriptRoot 'server-control.log'
$script:ServerProcess = $null
$script:LogHandler = $null

function Write-Log {
    param(
        [string]$Message,
        [ValidateSet('INFO','WARN','ERROR')]
        [string]$Level = 'INFO'
    )

    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $line = "[{0}] [{1}] {2}" -f $timestamp, $Level, $Message
    if (-not (Test-Path (Split-Path $script:LogFile -Parent))) {
        New-Item -ItemType Directory -Path (Split-Path $script:LogFile -Parent) -Force | Out-Null
    }
    # Force UTF-8 so multibyte log entries render correctly in the GUI textbox.
    Add-Content -Path $script:LogFile -Value $line -Encoding UTF8
    if ($script:LogHandler) {
        & $script:LogHandler $line
    } else {
        Write-Host $line
    }
}

function Register-LogHandler {
    param([scriptblock]$Handler)
    $script:LogHandler = $Handler
}

function Confirm-ServerEntry {
    if (-not (Test-Path $script:ServerEntry)) {
        throw "server.js 파일을 찾을 수 없습니다. ($($script:ServerEntry))"
    }
}

function Get-NodePath {
    try {
        $node = Get-Command node -ErrorAction Stop
        return $node.Source
    } catch {
        $probableLocations = @()
        if ($env:ProgramFiles) {
            $probableLocations += (Join-Path $env:ProgramFiles 'nodejs\node.exe')
        }
        if (${env:ProgramFiles(x86)}) {
            $probableLocations += (Join-Path ${env:ProgramFiles(x86)} 'nodejs\node.exe')
        }
        if ($env:LOCALAPPDATA) {
            $probableLocations += (Join-Path $env:LOCALAPPDATA 'Programs\nodejs\node.exe')
        }

        foreach ($path in $probableLocations) {
            if ($path -and (Test-Path $path)) {
                return $path
            }
        }

        throw "Node.js를 찾을 수 없습니다. https://nodejs.org 에서 설치했는지 확인하세요."
    }
}

function Write-State {
    param(
        [int]$ProcessId,
        [int]$Port
    )

    $state = [ordered]@{
        pid = $ProcessId
        port = $Port
        startedAt = (Get-Date).ToString('o')
    }
    $json = $state | ConvertTo-Json -Depth 4
    Set-Content -Path $script:StateFile -Value $json -Encoding UTF8
}

function Clear-State {
    if (Test-Path $script:StateFile) {
        Remove-Item $script:StateFile -Force
    }
}

function Read-State {
    if (-not (Test-Path $script:StateFile)) {
        return $null
    }
    try {
        return Get-Content -Path $script:StateFile -Raw | ConvertFrom-Json
    } catch {
        return $null
    }
}

function Get-RunningProcess {
    if ($script:ServerProcess -and -not $script:ServerProcess.HasExited) {
        return $script:ServerProcess
    }

    $state = Read-State
    if (-not $state -or -not $state.pid) {
        return $null
    }

    try {
        $proc = Get-Process -Id $state.pid -ErrorAction Stop
        if ($proc.HasExited) {
            Clear-State
            return $null
        }
        return $proc
    } catch {
        Clear-State
        return $null
    }
}

function Start-InfraManualServer {
    param([int]$DesiredPort)

    Confirm-ServerEntry
    $existing = Get-RunningProcess
    if ($existing) {
        throw "이미 서버가 실행 중입니다. (PID $($existing.Id))"
    }

    $nodePath = Get-NodePath
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $nodePath
    $psi.Arguments = "`"$($script:ServerEntry)`""
    $psi.WorkingDirectory = $script:ProjectRoot
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.EnvironmentVariables["PORT"] = $DesiredPort.ToString()

    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $psi
    $proc.EnableRaisingEvents = $true

    $null = $proc.Start()
    $script:ServerProcess = $proc
    Write-State -ProcessId $proc.Id -Port $DesiredPort
    Write-Log "서버를 시작했습니다. PID=$($proc.Id), PORT=$DesiredPort"

    Register-ObjectEvent -InputObject $proc -EventName Exited -Action {
        Clear-State
        Write-Log "서버 프로세스가 종료되었습니다. 코드=$($Event.Sender.ExitCode)" 'WARN'
    } | Out-Null

    return Get-ServerStatus
}

function Stop-InfraManualServer {
    $proc = Get-RunningProcess
    if (-not $proc) {
        Clear-State
        Write-Log '중지할 서버 프로세스가 없습니다.' 'WARN'
        return Get-ServerStatus
    }

    Write-Log "서버를 중지합니다. PID=$($proc.Id)"
    try {
        if (-not $proc.HasExited) {
            $proc.Kill()
            $proc.WaitForExit(5000) | Out-Null
        }
    } catch {
        throw "서버 중지 실패: $($_.Exception.Message)"
    }

    Clear-State
    $script:ServerProcess = $null
    return Get-ServerStatus
}

function Restart-InfraManualServer {
    param([int]$DesiredPort)
    Stop-InfraManualServer | Out-Null
    Start-InfraManualServer -DesiredPort $DesiredPort
}

function Get-ServerStatus {
    $proc = Get-RunningProcess
    $state = Read-State
    if ($proc) {
        return [pscustomobject]@{
            IsRunning = $true
            Pid = $proc.Id
            Port = if ($state.port) { [int]$state.port } else { $Port }
            StartedAt = if ($state.startedAt) { [datetime]$state.startedAt } else { $proc.StartTime }
        }
    }
    return [pscustomobject]@{
        IsRunning = $false
        Pid = $null
        Port = $null
        StartedAt = $null
    }
}

function Write-ConsoleStatus {
    param($status)

    if ($status.IsRunning) {
        Write-Host "서버 실행 중: PID=$($status.Pid), PORT=$($status.Port), 시작시각=$($status.StartedAt)"
    } else {
        Write-Host '서버가 실행 중이지 않습니다.'
    }
}

if ($PSBoundParameters.ContainsKey('Command')) {
    switch ($Command) {
        'start' {
            $status = Start-InfraManualServer -DesiredPort $Port
            Write-ConsoleStatus $status
        }
        'stop' {
            $status = Stop-InfraManualServer
            Write-ConsoleStatus $status
        }
        'restart' {
            $status = Restart-InfraManualServer -DesiredPort $Port
            Write-ConsoleStatus $status
        }
        'status' {
            $status = Get-ServerStatus
            Write-ConsoleStatus $status
        }
    }
    return
}

if ($NoGui) {
    Write-ConsoleStatus (Get-ServerStatus)
    return
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$form = New-Object System.Windows.Forms.Form
$form.Text = 'Infra Manual Server Control'
$form.Size = New-Object System.Drawing.Size(520, 420)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.MinimizeBox = $true

$headerLabel = New-Object System.Windows.Forms.Label
$headerLabel.Text = 'Infra Manual 서버 제어'
$headerLabel.AutoSize = $true
$headerLabel.Font = New-Object System.Drawing.Font('Segoe UI', 12, [System.Drawing.FontStyle]::Bold)
$headerLabel.Location = New-Object System.Drawing.Point(20, 20)

$statusLabel = New-Object System.Windows.Forms.Label
$statusLabel.Text = '상태:'
$statusLabel.AutoSize = $true
$statusLabel.Location = New-Object System.Drawing.Point(20, 70)
$statusLabel.Font = New-Object System.Drawing.Font('Segoe UI', 10)

$statusValue = New-Object System.Windows.Forms.Label
$statusValue.Text = '확인 중...'
$statusValue.AutoSize = $true
$statusValue.Location = New-Object System.Drawing.Point(80, 70)
$statusValue.Font = New-Object System.Drawing.Font('Segoe UI', 10, [System.Drawing.FontStyle]::Bold)
$statusValue.ForeColor = [System.Drawing.Color]::DarkGoldenrod

$portLabel = New-Object System.Windows.Forms.Label
$portLabel.Text = '포트'
$portLabel.AutoSize = $true
$portLabel.Location = New-Object System.Drawing.Point(20, 110)

$portInput = New-Object System.Windows.Forms.NumericUpDown
$portInput.Minimum = 1024
$portInput.Maximum = 65535
$portInput.Value = $Port
$portInput.Location = New-Object System.Drawing.Point(70, 108)
$portInput.Width = 80

$startButton = New-Object System.Windows.Forms.Button
$startButton.Text = '서버 켜기'
$startButton.Location = New-Object System.Drawing.Point(180, 100)
$startButton.Size = New-Object System.Drawing.Size(100, 32)

$stopButton = New-Object System.Windows.Forms.Button
$stopButton.Text = '서버 끄기'
$stopButton.Location = New-Object System.Drawing.Point(290, 100)
$stopButton.Size = New-Object System.Drawing.Size(100, 32)

$openButton = New-Object System.Windows.Forms.Button
$openButton.Text = '브라우저 열기'
$openButton.Location = New-Object System.Drawing.Point(400, 100)
$openButton.Size = New-Object System.Drawing.Size(100, 32)
$openButton.Enabled = $false

$logLabel = New-Object System.Windows.Forms.Label
$logLabel.Text = '이벤트 로그'
$logLabel.AutoSize = $true
$logLabel.Location = New-Object System.Drawing.Point(20, 150)

$logBox = New-Object System.Windows.Forms.TextBox
$logBox.Location = New-Object System.Drawing.Point(20, 175)
$logBox.Size = New-Object System.Drawing.Size(460, 180)
$logBox.Multiline = $true
$logBox.ScrollBars = 'Vertical'
$logBox.ReadOnly = $true
$logBox.Font = New-Object System.Drawing.Font('Consolas', 9)

if (Test-Path $script:LogFile) {
    $existingLines = Get-Content -Path $script:LogFile -Tail 200
    if ($existingLines) {
        $logBox.Lines = $existingLines
        $logBox.SelectionStart = $logBox.Text.Length
        $logBox.ScrollToCaret()
    }
}

$appendAction = [System.Action[string]] {
    param($text)
    $logBox.AppendText($text + [Environment]::NewLine)
    $logBox.SelectionStart = $logBox.Text.Length
    $logBox.ScrollToCaret()
}

Register-LogHandler {
    param($line)
    if ($logBox.InvokeRequired) {
        $null = $logBox.BeginInvoke($appendAction, $line)
    } else {
        $appendAction.Invoke($line)
    }
}

$updateUi = {
    $status = Get-ServerStatus
    if ($status.IsRunning) {
        $statusValue.Text = "실행 중 (PID $($status.Pid))"
        $statusValue.ForeColor = [System.Drawing.Color]::ForestGreen
        $startButton.Enabled = $false
        $stopButton.Enabled = $true
        $openButton.Enabled = $true
        if ($status.Port -and [decimal]$status.Port -ne $portInput.Value) {
            $portInput.Value = [decimal]$status.Port
        }
    } else {
        $statusValue.Text = '중지됨'
        $statusValue.ForeColor = [System.Drawing.Color]::Firebrick
        $startButton.Enabled = $true
        $stopButton.Enabled = $false
        $openButton.Enabled = $false
    }
}

$startButton.Add_Click({
    try {
        $desiredPort = [int]$portInput.Value
        Start-InfraManualServer -DesiredPort $desiredPort | Out-Null
    } catch {
        [System.Windows.Forms.MessageBox]::Show(
            "서버 시작 실패: $($_.Exception.Message)",
            '오류',
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        ) | Out-Null
    }
    & $updateUi
})

$stopButton.Add_Click({
    try {
        Stop-InfraManualServer | Out-Null
    } catch {
        [System.Windows.Forms.MessageBox]::Show(
            "서버 중지 실패: $($_.Exception.Message)",
            '오류',
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        ) | Out-Null
    }
    & $updateUi
})

$openButton.Add_Click({
    $status = Get-ServerStatus
    $openPort = if ($status.IsRunning -and $status.Port) { $status.Port } else { [int]$portInput.Value }
    Start-Process "http://localhost:$openPort" | Out-Null
})

$form.Add_FormClosing({
    param($formSender, $formClosingArgs)
    $running = Get-RunningProcess
    if ($running -and -not $running.HasExited) {
        $result = [System.Windows.Forms.MessageBox]::Show('서버가 실행 중입니다. 종료하면서 서버도 중지할까요?', '종료 확인', [System.Windows.Forms.MessageBoxButtons]::YesNoCancel, [System.Windows.Forms.MessageBoxIcon]::Question)
        if ($result -eq [System.Windows.Forms.DialogResult]::Cancel) {
            $formClosingArgs.Cancel = $true
            return
        }
        if ($result -eq [System.Windows.Forms.DialogResult]::Yes) {
            Stop-InfraManualServer | Out-Null
        }
    }
})

$form.Controls.AddRange(@($headerLabel, $statusLabel, $statusValue, $portLabel, $portInput, $startButton, $stopButton, $openButton, $logLabel, $logBox))

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 1500
$timer.Add_Tick({ & $updateUi })
$timer.Start()

& $updateUi
[System.Windows.Forms.Application]::Run($form)
