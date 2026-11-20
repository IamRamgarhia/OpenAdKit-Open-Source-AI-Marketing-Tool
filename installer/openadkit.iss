; OpenAdKit Windows installer (Inno Setup 6).
;
; Built by scripts/build-windows-installer.cjs (locally, or in
; .github/workflows/release.yml), which passes:
;   /DAppVersion=1.2.0  /DAppDir=<dist\win\OpenAdKit>  /DOutputDir=<dist>
;
; WHAT GOES IN ({app} = %LOCALAPPDATA%\Programs\OpenAdKit):
;   OpenAdKit.exe + WebView2 DLLs   the native window (installer/host)
;   node\node.exe                   portable Node LTS, SHA-256 checked at build
;   app\                            the prebuilt web app + sync sidecar
;
; WHAT DOES NOT:
;   - user data. Clients, history and settings live in the WebView2 profile
;     (%LOCALAPPDATA%\OpenAdKit\webview) and the sync snapshot
;     (%APPDATA%\OpenAdKit). Uninstall leaves both alone.
;   - .NET or the WebView2 runtime. The host uses the .NET Framework that
;     ships with Windows 10/11 and the WebView2 runtime that ships with
;     Windows 11 (and Edge on Windows 10); without WebView2 it opens the
;     default browser instead.

#define AppName "OpenAdKit"
#define AppPublisher "DiceCodes"
#define AppUrl "https://github.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool"
#define AppExe "OpenAdKit.exe"
#ifndef AppVersion
  #define AppVersion "0.0.0-dev"
#endif
#ifndef AppDir
  #define AppDir "..\dist\win\OpenAdKit"
#endif
#ifndef OutputDir
  #define OutputDir "..\dist"
#endif

[Setup]
AppId=OpenAdKit
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL=https://dicecodes.com
AppCopyright=© {#AppPublisher} — MIT licensed, free to use and modify
AppSupportURL={#AppUrl}/issues
AppUpdatesURL={#AppUrl}/releases
VersionInfoVersion={#AppVersion}
VersionInfoCompany={#AppPublisher}
VersionInfoDescription={#AppName} — open source AI marketing tool

; Per-user install, no admin prompt: nothing here needs Program Files.
PrivilegesRequired=lowest
DefaultDirName={localappdata}\Programs\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
DisableDirPage=auto
DisableReadyPage=yes
SetupMutex=OpenAdKitSetup_7F3A
; Our app is a window plus windowless node.exe children, which Inno's
; CloseApplications cannot close; [Code] stops it with taskkill /T instead.
CloseApplications=no
RestartApplications=no
MinVersion=10.0

OutputDir={#OutputDir}
; Fixed name so README links to releases/latest/download/... always work.
OutputBaseFilename=OpenAdKit-Windows-Setup
SetupIconFile=art\icon.ico
UninstallDisplayIcon={app}\{#AppExe}
UninstallDisplayName={#AppName}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
LicenseFile=..\LICENSE

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Shortcuts:"

[InstallDelete]
; Replace the app payload wholesale on update so files removed upstream
; don't linger next to the new build.
Type: filesandordirs; Name: "{app}\app"

[Files]
Source: "{#AppDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExe}"
Name: "{group}\Uninstall {#AppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExe}"; Description: "Open {#AppName}"; Flags: nowait postinstall skipifsilent

[Code]
function InstalledVersion(): String;
var
  Key: String;
begin
  Key := 'Software\Microsoft\Windows\CurrentVersion\Uninstall\OpenAdKit_is1';
  Result := '';
  if not RegQueryStringValue(HKCU, Key, 'DisplayVersion', Result) then
    if not RegQueryStringValue(HKLM, Key, 'DisplayVersion', Result) then
      Result := '';
end;

procedure InitializeWizard;
var
  Previous: String;
begin
  Previous := InstalledVersion();
  if Previous = '' then exit;
  WizardForm.WelcomeLabel1.Caption := 'Update {#AppName}';
  if Previous = '{#AppVersion}' then
    WizardForm.WelcomeLabel2.Caption :=
      'Version {#AppVersion} is already installed. This will reinstall it.' + #13#10#13#10 +
      'Your clients, history, API keys and settings are not touched.'
  else
    WizardForm.WelcomeLabel2.Caption :=
      'This will update {#AppName} from version ' + Previous + ' to {#AppVersion}.' + #13#10#13#10 +
      'Your clients, history, API keys and settings are kept. Only the program is replaced.';
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if InstalledVersion() = '' then exit;
  if WizardForm.NextButton.Caption = SetupMessage(msgButtonInstall) then
    WizardForm.NextButton.Caption := '&Update';
  if CurPageID = wpFinished then
  begin
    WizardForm.FinishedHeadingLabel.Caption := '{#AppName} has been updated';
    WizardForm.FinishedLabel.Caption := '{#AppName} is now at version {#AppVersion}. Your data was left exactly as it was.';
  end;
end;

// Close a running copy (window + its node children) before replacing files.
// taskkill exits 128 when nothing matched, which is the normal case.
function StopRunningApp(): Boolean;
var
  Code: Integer;
begin
  Result := True;
  if not Exec(ExpandConstant('{sys}\taskkill.exe'), '/IM "{#AppExe}" /T /F', '', SW_HIDE, ewWaitUntilTerminated, Code) then
  begin
    Result := False;
    exit;
  end;
  if (Code <> 0) and (Code <> 128) then Result := False;
  if Code = 0 then Sleep(1500);
end;

function InitializeSetup(): Boolean;
begin
  Result := True;
  if not StopRunningApp() then
    if MsgBox('OpenAdKit could not be closed automatically.' + #13#10#13#10 +
              'Close it, then continue. Continuing while it runs may leave the install half-updated.' + #13#10#13#10 +
              'Continue anyway?', mbConfirmation, MB_YESNO) = IDNO then
      Result := False;
end;

function InitializeUninstall(): Boolean;
begin
  StopRunningApp();
  Result := True;
end;
