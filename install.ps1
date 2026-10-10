param(
    [Parameter(Mandatory = $true)]
    [string]$SillyTavernRoot
)

$root = (Resolve-Path -LiteralPath $SillyTavernRoot).Path
$pluginSource = Join-Path $PSScriptRoot 'server-plugin\sillytavern-novelai'
$extensionSource = Join-Path $PSScriptRoot 'public\scripts\extensions\novelai'
$pluginTarget = Join-Path $root 'plugins\sillytavern-novelai'
$extensionTarget = Join-Path $root 'public\scripts\extensions\novelai'

if (-not (Test-Path -LiteralPath (Join-Path $root 'server.js'))) {
    throw "目标目录不是 SillyTavern 根目录：$root"
}
New-Item -ItemType Directory -Force -Path $pluginTarget, $extensionTarget | Out-Null
Copy-Item -Path (Join-Path $pluginSource '*') -Destination $pluginTarget -Recurse -Force
Copy-Item -Path (Join-Path $extensionSource '*') -Destination $extensionTarget -Recurse -Force
Write-Host "NovelAI plugin installed to $pluginTarget"
Write-Host "NovelAI extension installed to $extensionTarget"
Write-Host '请在 config.yaml 开启 enableServerPlugins: true，然后重启 SillyTavern。'

