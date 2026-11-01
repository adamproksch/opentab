# Media helper: reads what's playing from Windows media controls (Spotify first,
# then whatever else is playing) and prints it as JSON lines: title, artist,
# position and length. (Album art is looked up by main.js — PowerShell can't read the thumbnail stream.) Reads commands from stdin: toggle, next, prev, seek <ms>.
# Started by main.js when the music player is on.
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, $type) { $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); $t.Wait(-1) | Out-Null; $t.Result }
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])

# [Console]::In.ReadLineAsync() blocks in Windows PowerShell until a line arrives, which froze
# the loop before anything was reported. A StreamReader over raw stdin reads truly in the background.
$in = New-Object System.IO.StreamReader([Console]::OpenStandardInput())
$read = $in.ReadLineAsync()
$last = ''
$lastPos = 0; $lastAt = 0; $lastPlaying = $false
while ($true) {
  $s = @($mgr.GetSessions()) | Where-Object { $_.SourceAppUserModelId -match 'Spotify' } | Select-Object -First 1
  if (-not $s) { $s = $mgr.GetCurrentSession() }
  if ($read.IsCompleted) {
    $c = $read.Result
    if ($null -eq $c) { exit }
    if ($s) {
      if ($c -eq 'toggle') { $null = Await ($s.TryTogglePlayPauseAsync()) ([bool]) }
      elseif ($c -eq 'next') { $null = Await ($s.TrySkipNextAsync()) ([bool]) }
      elseif ($c -eq 'prev') { $null = Await ($s.TrySkipPreviousAsync()) ([bool]) }
      elseif ($c -match '^seek (\d+)$') { $null = Await ($s.TryChangePlaybackPositionAsync([long]$Matches[1] * 10000)) ([bool]) }
    }
    $read = $in.ReadLineAsync()
  }
  $o = @{ ok = $false }
  if ($s) {
    $p = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
    $info = $s.GetPlaybackInfo()
    $tl = $s.GetTimelineProperties()
    $o = @{
      ok = $true; app = $s.SourceAppUserModelId; title = $p.Title; artist = $p.Artist
      playing = ($info.PlaybackStatus.ToString() -eq 'Playing')
      position = [long]($tl.Position.TotalMilliseconds + $(if ($info.PlaybackStatus.ToString() -eq 'Playing') { ([DateTimeOffset]::Now - $tl.LastUpdatedTime).TotalMilliseconds } else { 0 })); duration = [long]($tl.EndTime - $tl.StartTime).TotalMilliseconds
      canSeek = [bool]$info.Controls.IsPlaybackPositionEnabled
    }
  }
  # the UI advances the position itself while playing, so only report when something else
  # changed or the real position jumped away from where it should be (seek, buffering)
  $now = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
  $cmp = $o.Clone(); $cmp.Remove('position')
  $j = $cmp | ConvertTo-Json -Compress
  $expected = $lastPos + $(if ($lastPlaying) { $now - $lastAt } else { 0 })
  $jumped = $o.ok -and [math]::Abs($o.position - $expected) -gt 2000
  if ($j -ne $last -or $jumped) {
    $o.at = $now
    [Console]::Out.WriteLine(($o | ConvertTo-Json -Compress)); [Console]::Out.Flush()
    $last = $j; $lastPos = [long]$o.position; $lastAt = $now; $lastPlaying = [bool]$o.playing
  }
  Start-Sleep -Milliseconds 400
}
