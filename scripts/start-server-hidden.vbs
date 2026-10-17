Option Explicit

Dim WshShell, fso, oHttp, isRunning
Dim ScriptDir, ProjectRoot, ServerScript, NodeExe

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

ScriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
ProjectRoot = fso.GetParentFolderName(ScriptDir)
ServerScript = ProjectRoot & "\src\server\config-manager-server.mjs"

NodeExe = "node.exe"
If fso.FileExists("C:\Program Files\nodejs\node.exe") Then
    NodeExe = "C:\Program Files\nodejs\node.exe"
End If

isRunning = False
On Error Resume Next
Set oHttp = CreateObject("MSXML2.ServerXMLHTTP.6.0")
oHttp.open "GET", "http://127.0.0.1:20129/health", False
oHttp.setTimeouts 400, 400, 400, 400
oHttp.send
If Err.Number = 0 And oHttp.status = 200 Then
    isRunning = True
End If
On Error GoTo 0

If Not isRunning Then
    WshShell.Run """" & NodeExe & """ """ & ServerScript & """", 0, False
End If
