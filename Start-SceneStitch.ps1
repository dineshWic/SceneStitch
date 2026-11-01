param([switch]$Build)
$ErrorActionPreference = 'Stop'
$taskTools = Join-Path (Split-Path $PSScriptRoot -Parent) '.tools'
if (Test-Path (Join-Path $taskTools 'node.exe')) { $env:PATH = "$taskTools;$env:PATH" }
$taskFfmpeg = Get-ChildItem (Join-Path $taskTools 'ffmpeg') -Filter ffmpeg.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if ($taskFfmpeg) { $env:PATH = "$($taskFfmpeg.DirectoryName);$env:PATH" }
if (!$env:SCENESTITCH_BROWSER_EXECUTABLE -and (Test-Path 'C:\Program Files\Google\Chrome\Application\chrome.exe')) { $env:SCENESTITCH_BROWSER_EXECUTABLE = 'C:\Program Files\Google\Chrome\Application\chrome.exe' }
Push-Location $PSScriptRoot
try {
  if ($Build) {
    $taskPnpm = Join-Path $taskTools 'package\bin\pnpm.cjs'
    if (Test-Path $taskPnpm) { & node $taskPnpm build } else { & pnpm build }
    if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
  }
  Write-Host 'Open http://127.0.0.1:4000 in your browser. Press Ctrl+C to stop.'
  & node scripts/start.mjs
} finally { Pop-Location }
