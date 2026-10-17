Option Explicit

Dim WshShell, fso, oHttp, isRunning
Dim ScriptDir, ProjectRoot, ServerScript, WebIndex, EdgePath, NodeExe

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

ScriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
ProjectRoot = fso.GetParentFolderName(ScriptDir)
ServerScript = ProjectRoot & "\src\server\config-manager-server.mjs"
WebIndex = ProjectRoot & "\src\web\index.html"

' Detect Node executable
NodeExe = "node.exe"
If fso.FileExists("C:\Program Files\nodejs\node.exe") Then
    NodeExe = "C:\Program Files\nodejs\node.exe"
End If

' Detect Microsoft Edge executable
EdgePath = WshShell.ExpandEnvironmentStrings("%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe")
If Not fso.FileExists(EdgePath) Then
    EdgePath = WshShell.ExpandEnvironmentStrings("%ProgramFiles%\Microsoft\Edge\Application\msedge.exe")
End If

' 1. Check if server on :20129 is running
isRunning = False
On Error Resume Next
Set oHttp = CreateObject("MSXML2.ServerXMLHTTP.6.0")
oHttp.open "GET", "http://127.0.0.1:20129/health", False
oHttp.setTimeouts 400, 400, 400, 400
oHttp.send
If Err.Number = 0 Then
    If oHttp.status = 200 Then
        isRunning = True
    End If
End If
On Error GoTo 0

' 2. If not running, start hidden in background
If Not isRunning Then
    WshShell.Run """" & NodeExe & """ """ & ServerScript & """", 0, False
    WScript.Sleep 700
End If

' 3. Open Web UI in Edge App Mode or default browser
If fso.FileExists(EdgePath) Then
    WshShell.Run """" & EdgePath & """ --app=""http://127.0.0.1:20129/""", 1, False
Else
    WshShell.Run "http://127.0.0.1:20129/", 1, False
End If
