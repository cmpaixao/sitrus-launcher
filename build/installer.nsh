!macro customInstall
  !insertmacro MarkShortcutRunAsAdmin "$newDesktopLink"
  !insertmacro MarkShortcutRunAsAdmin "$newStartMenuLink"
!macroend

; Sets the "Run as administrator" flag on a .lnk (LinkFlags bit SLDF_RUNAS_USER).
!macro MarkShortcutRunAsAdmin link
  ${If} ${FileExists} "${link}"
    FileOpen $R8 "${link}" a
    FileSeek $R8 21 SET
    FileReadByte $R8 $R9
    IntOp $R9 $R9 | 32
    FileSeek $R8 21 SET
    FileWriteByte $R8 $R9
    FileClose $R8
  ${EndIf}
!macroend
