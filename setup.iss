; Inno Setup Script for Project Status Widget
[Setup]
AppName=Project Status Widget
AppVersion=1.0
DefaultDirName={autopf}\ProjectStatusWidget
DefaultGroupName=Project Status Widget
OutputBaseFilename=ProjectStatusWidget_Setup
Compression=lzma
SolidCompression=yes
WizardStyle=modern

[Files]
Source: "dist\ProjectStatusWidget.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "sample\projects_data.xlsx"; DestDir: "{app}\sample"; Flags: ignoreversion

[Icons]
Name: "{group}\Project Status Widget"; Filename: "{app}\ProjectStatusWidget.exe"
Name: "{autodesktop}\Project Status Widget"; Filename: "{app}\ProjectStatusWidget.exe"
Name: "{group}\Uninstall"; Filename: "{uninstallexe}"

[Run]
Filename: "{app}\ProjectStatusWidget.exe"; Description: "Launch Project Status Widget"; Flags: nowait postinstall skipifsilent
