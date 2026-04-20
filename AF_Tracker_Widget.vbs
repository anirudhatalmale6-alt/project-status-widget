Set WshShell = CreateObject("WScript.Shell")

' Get screen width to position widget on the right side
Set objWMI = GetObject("winmgmts:\\.\root\cimv2")
Set colItems = objWMI.ExecQuery("Select * From Win32_DesktopMonitor")
screenW = 1920
For Each objItem in colItems
    If objItem.ScreenWidth > 0 Then screenW = objItem.ScreenWidth
Next

posX = screenW - 380
posY = 80

' Try common Chrome paths
chromePath = ""
If CreateObject("Scripting.FileSystemObject").FileExists("C:\Program Files\Google\Chrome\Application\chrome.exe") Then
    chromePath = """C:\Program Files\Google\Chrome\Application\chrome.exe"""
ElseIf CreateObject("Scripting.FileSystemObject").FileExists("C:\Program Files (x86)\Google\Chrome\Application\chrome.exe") Then
    chromePath = """C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"""
Else
    chromePath = "chrome"
End If

url = "https://always-signatures-existence-root.trycloudflare.com/mini"
WshShell.Run chromePath & " --app=""" & url & """ --window-size=350,520 --window-position=" & posX & "," & posY, 1, False
