; opentab-Installer.exe: a small installer that never goes stale. Every run
; downloads the newest opentab-Setup.exe from GitHub releases and runs it, so
; re-running a saved copy installs or updates to the latest version.
Unicode true
!include "MUI2.nsh"

!define URL "https://github.com/adamproksch/opentab-releases/releases/latest/download/opentab-Setup.exe"

Name "opentab"
Caption "opentab Setup"
OutFile "..\dist\opentab-Installer.exe"
Icon "icon.ico"
RequestExecutionLevel user
SilentInstall normal
AutoCloseWindow true
ShowInstDetails nevershow
BrandingText "Adam Proksch Creative"
VIProductVersion "1.0.0.0"
VIAddVersionKey "ProductName" "opentab"
VIAddVersionKey "CompanyName" "Adam Proksch Creative"
VIAddVersionKey "FileDescription" "opentab Setup"
VIAddVersionKey "FileVersion" "1.0.0"
VIAddVersionKey "LegalCopyright" "Copyright 2026 Adam Proksch Creative"

!define MUI_ICON "icon.ico"
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Section
  DetailPrint "Downloading the latest opentab..."
  StrCpy $0 "$TEMP\opentab-Setup-latest.exe"
  Delete $0
  inetc::get /CAPTION "opentab Setup" /BANNER "Downloading the latest opentab..." "${URL}" $0 /END
  Pop $1
  StrCmp $1 "OK" run
  MessageBox MB_ICONEXCLAMATION|MB_RETRYCANCEL "Couldn't download opentab ($1). Check your internet connection and try again." IDRETRY retry
  Abort
  retry:
    inetc::get /CAPTION "opentab Setup" /BANNER "Downloading the latest opentab..." "${URL}" $0 /END
    Pop $1
    StrCmp $1 "OK" run
    MessageBox MB_ICONEXCLAMATION "Couldn't download opentab ($1)."
    Abort
  run:
    DetailPrint "Installing..."
    ; the full installer closes a running opentab, updates in place and launches it
    ExecWait '"$0"'
    Delete $0
SectionEnd
