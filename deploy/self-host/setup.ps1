param(
    [string]$SiteName = "InfrastructureManual",
    [int]$Port = 8080,
    [string]$PhysicalPath = "C:\inetpub\infrastructure-manual",
    [string]$SourcePath = (Resolve-Path (Join-Path $PSScriptRoot "..\.."))
)

function Require-Admin {
    if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)) {
        Write-Error "이 스크립트는 관리자 권한 PowerShell에서 실행해야 합니다." -ErrorAction Stop
    }
}

function Install-IISIfNeeded {
    $feature = Get-WindowsFeature -Name Web-Server
    if ($feature.Installed -eq $false) {
        Write-Host "IIS(Web-Server) 기능을 설치합니다..." -ForegroundColor Cyan
        Install-WindowsFeature -Name Web-Server -IncludeManagementTools | Out-Null
    }
}

function Sync-Files {
    param (
        [string]$Source,
        [string]$Destination
    )

    if (-not (Test-Path $Destination)) {
        New-Item -Path $Destination -ItemType Directory | Out-Null
    }

    $excludeDirs = @(".git", "deploy", ".vscode")
    $excludeFiles = @("*.ps1", "setup.ps1")

    $excludeDirParams = $excludeDirs | ForEach-Object { "/XD", (Join-Path $Source $_) }
    $excludeFileParams = $excludeFiles | ForEach-Object { "/XF", $_ }

    $robocopyArgs = @($Source, $Destination, "/MIR", "/R:2", "/W:2") + $excludeDirParams + $excludeFileParams

    Write-Host "파일을 동기화합니다..." -ForegroundColor Cyan
    $robocopyResult = Start-Process -FilePath robocopy.exe -ArgumentList $robocopyArgs -NoNewWindow -PassThru -Wait

    if ($robocopyResult.ExitCode -gt 3) {
        throw "robocopy가 오류 코드 $($robocopyResult.ExitCode)로 종료되었습니다."
    }
}

function Configure-IISSite {
    param (
        [string]$Name,
        [int]$BindingPort,
        [string]$Path
    )

    Import-Module WebAdministration

    if (Test-Path "IIS:\Sites\$Name") {
        Write-Host "기존 사이트 $Name 을(를) 제거합니다." -ForegroundColor Yellow
        Remove-Website -Name $Name
    }

    New-Website -Name $Name -Port $BindingPort -PhysicalPath $Path -Force | Out-Null

    # 기본 문서 우선순위
    $defaultDocs = @("index.html", "index.htm")
    foreach ($doc in $defaultDocs) {
        if (-not (Get-WebConfigurationProperty -pspath "MACHINE/WEBROOT/APPHOST" -filter "system.webServer/defaultDocument/files/add[@value='$doc']" -name value -ErrorAction SilentlyContinue)) {
            Add-WebConfigurationProperty -pspath "MACHINE/WEBROOT/APPHOST" -filter "system.webServer/defaultDocument/files" -name "." -value @{value=$doc}
        }
    }

    # MIME 타입 보장 (js/css)
    $mimeSettings = @(
        @{ fileExtension = ".js"; mimeType = "application/javascript" },
        @{ fileExtension = ".css"; mimeType = "text/css" },
        @{ fileExtension = ".json"; mimeType = "application/json" }
    )

    foreach ($mime in $mimeSettings) {
        if (-not (Get-WebConfigurationProperty -pspath "MACHINE/WEBROOT/APPHOST" -filter "system.webServer/staticContent/mimeMap[@fileExtension='${($mime.fileExtension)}']" -name fileExtension -ErrorAction SilentlyContinue)) {
            Add-WebConfigurationProperty -pspath "MACHINE/WEBROOT/APPHOST" -filter "system.webServer/staticContent" -name "." -value $mime
        }
    }
}

function Ensure-FirewallRule {
    param (
        [int]$Port
    )

    $ruleName = "InfrastructureManual-$Port"
    if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port | Out-Null
    }
}

Require-Admin
Install-IISIfNeeded
Sync-Files -Source $SourcePath -Destination $PhysicalPath
Configure-IISSite -Name $SiteName -BindingPort $Port -Path $PhysicalPath
Ensure-FirewallRule -Port $Port

Write-Host "배포가 완료되었습니다. 브라우저에서 http://<서버IP>:$Port 로 접속하세요." -ForegroundColor Green
