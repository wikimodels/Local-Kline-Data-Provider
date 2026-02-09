Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
' Run deno task start silently (0 = hide window, False = don't wait for completion)
WshShell.Run "deno task start", 0, False
Set WshShell = Nothing
