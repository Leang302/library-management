# End-to-end test: drives headless Chrome over the DevTools protocol, runs tests/e2e.js
# against index.html and prints assertions + any console errors.  Usage: .\tests\run-e2e.ps1
param(
  [string]$Url = "file:///C:/project/library%20management/index.html",
  [string]$ScriptFile = (Join-Path $PSScriptRoot "e2e.js"),
  [string]$Shot = "",
  [int]$Width = 1280, [int]$Height = 900,
  [string]$Before = ""
)
$ErrorActionPreference = 'Stop'
$scratch = Split-Path -Parent $MyInvocation.MyCommand.Path
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$port = 9333
$prof = Join-Path $env:TEMP "lms-e2e-chrome-prof"
Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $chrome -and $_.CommandLine -like "*$prof*" } | Stop-Process -Force -ErrorAction SilentlyContinue
$proc = Start-Process $chrome -ArgumentList "--headless=new", "--remote-debugging-port=$port", "--user-data-dir=`"$prof`"", "--window-size=$Width,$Height", "--no-first-run", "--disable-gpu", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "about:blank" -PassThru
$page = $null
for ($i = 0; $i -lt 40 -and -not $page; $i++) {
  Start-Sleep -Milliseconds 250
  try { $page = (Invoke-RestMethod "http://127.0.0.1:$port/json") | Where-Object { $_.type -eq 'page' } | Select-Object -First 1 } catch {}
}
$ws = New-Object System.Net.WebSockets.ClientWebSocket
$ws.ConnectAsync([Uri]$page.webSocketDebuggerUrl, [Threading.CancellationToken]::None).Wait()
$script:id = 0
$script:events = New-Object System.Collections.ArrayList

function Receive-Msg {
  $buf = New-Object byte[] 1048576
  $ms = New-Object System.IO.MemoryStream
  do {
    $seg = New-Object System.ArraySegment[byte] -ArgumentList (, $buf)
    $r = $ws.ReceiveAsync($seg, [Threading.CancellationToken]::None).Result
    $ms.Write($buf, 0, $r.Count)
  } while (-not $r.EndOfMessage)
  return [Text.Encoding]::UTF8.GetString($ms.ToArray()) | ConvertFrom-Json
}
function Send-Cdp($method, $params = @{}) {
  $script:id++
  $myId = $script:id
  $json = @{ id = $myId; method = $method; params = $params } | ConvertTo-Json -Depth 10 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $ws.SendAsync((New-Object System.ArraySegment[byte] -ArgumentList (, $bytes)), 'Text', $true, [Threading.CancellationToken]::None).Wait()
  while ($true) {
    $m = Receive-Msg
    if ($m.id -eq $myId) { return $m }
    [void]$script:events.Add($m)
  }
}

Send-Cdp 'Runtime.enable' | Out-Null
Send-Cdp 'Log.enable' | Out-Null
Send-Cdp 'Page.enable' | Out-Null
Send-Cdp 'Emulation.setDeviceMetricsOverride' @{ width = $Width; height = $Height; deviceScaleFactor = 1; mobile = $false } | Out-Null
Send-Cdp 'Page.navigate' @{ url = $Url } | Out-Null
Start-Sleep -Seconds 5

if ($Before) { Send-Cdp 'Runtime.evaluate' @{ expression = $Before; awaitPromise = $true; returnByValue = $true } | Out-Null; Start-Sleep -Milliseconds 1500 }

if ($ScriptFile) {
  $code = Get-Content $ScriptFile -Raw
  $res = Send-Cdp 'Runtime.evaluate' @{ expression = "window.__result=null; window.__log=[]; ($code).then(r=>window.__result=r)"; returnByValue = $true }
  if ($res.result.exceptionDetails) { "EXCEPTION: " + ($res.result.exceptionDetails | ConvertTo-Json -Depth 6) }
  $val = $null
  for ($k = 0; $k -lt 75 -and -not $val; $k++) {
    Start-Sleep -Seconds 2
    $val = (Send-Cdp 'Runtime.evaluate' @{ expression = 'window.__result'; returnByValue = $true }).result.result.value
  }
  if ($val) { $val } else { "TIMEOUT. progress: " + (Send-Cdp 'Runtime.evaluate' @{ expression = 'JSON.stringify(window.__log.slice(-5)) + " screen=" + (Router.current()&&Router.current().name)'; returnByValue = $true }).result.result.value }
}
if ($Shot) {
  Start-Sleep -Milliseconds 800
  $s = Send-Cdp 'Page.captureScreenshot' @{ format = 'png' }
  [IO.File]::WriteAllBytes($Shot, [Convert]::FromBase64String($s.result.data))
  "screenshot: $Shot"
}
# drain pending events briefly
"---- console / exceptions ----"
foreach ($e in $script:events) {
  if ($e.method -eq 'Runtime.exceptionThrown') { "EXC: " + $e.params.exceptionDetails.exception.description + " " + $e.params.exceptionDetails.text }
  elseif ($e.method -eq 'Runtime.consoleAPICalled' -and ($e.params.type -in 'error', 'warning')) { "CONSOLE " + $e.params.type + ": " + (($e.params.args | ForEach-Object { if ($_.value) { $_.value } else { $_.description } }) -join ' ') }
  elseif ($e.method -eq 'Log.entryAdded' -and $e.params.entry.level -in 'error', 'warning') { "LOG " + $e.params.entry.level + ": " + $e.params.entry.text + " " + $e.params.entry.url }
}
$ws.Dispose()
Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*$prof*" } | Stop-Process -Force -ErrorAction SilentlyContinue
