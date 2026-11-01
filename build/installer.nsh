; Installing over an existing copy updates it in place. If opentab is open
; (or hiding in the tray), close it quietly instead of asking the user to.
!macro customCheckAppRunning
  nsExec::Exec 'taskkill /IM "${APP_EXECUTABLE_FILENAME}" /T'
  Sleep 1200
  nsExec::Exec 'taskkill /IM "${APP_EXECUTABLE_FILENAME}" /T /F'
  Sleep 500
!macroend
