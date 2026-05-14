Option Explicit

Const ForReading = 1
Const TristateTrue = -1

Dim fso, shell, scriptPath, logPath, command, exitCode
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("Wscript.Shell")

scriptPath = "C:\qq\1234\tools\ServerControl.ps1"
logPath = "C:\qq\1234\tools\gui-launch.log"

If Not fso.FileExists(scriptPath) Then
    MsgBox "ServerControl.ps1 ?????? a?? ?? ???????:" & vbCrLf & scriptPath, 16, "Infra Manual"
    WScript.Quit 1
End If

If fso.FileExists(logPath) Then
    On Error Resume Next
    fso.DeleteFile logPath, True
    On Error GoTo 0
End If

command = "cmd.exe /c powershell.exe -NoLogo -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -STA -File """ _
          & scriptPath & """ > """ & logPath & """ 2>&1"
exitCode = shell.Run(command, 1, True)

If exitCode <> 0 Then
    Dim message, logText
    message = "PowerShell ???? ?? ?????? ?????????. (??? " & exitCode & ")"
    If fso.FileExists(logPath) Then
        Dim logFile
        Set logFile = fso.OpenTextFile(logPath, ForReading, False, TristateTrue)
        logText = logFile.ReadAll
        logFile.Close
        message = message & vbCrLf & vbCrLf & logText
    End If
    MsgBox message, 16, "Infra Manual"
Else
    MsgBox "???? ???? a?? ??????????. ??? ???????? PowerShell a?? ????????.", _
           64, "Infra Manual"
End If






