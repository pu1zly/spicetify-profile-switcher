Set WshShell = CreateObject("WScript.Shell")
userProfile = WshShell.ExpandEnvironmentStrings("%USERPROFILE%")
serverPath = userProfile & "\.spotify-profiles\server.js"
WshShell.Run "node.exe """ & serverPath & """", 0, False
