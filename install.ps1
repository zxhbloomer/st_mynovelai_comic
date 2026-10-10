param(
    [Parameter(Mandatory = $true)]
    [string]$SillyTavernRoot
)

$root = (Resolve-Path -LiteralPath $SillyTavernRoot).Path
$pluginSource = Join-Path $PSScriptRoot 'server-plugin\sillytavern-novelai'
$extensionTarget = Join-Path $root 'public\scripts\extensions\third-party\st_mynovelai_comic'
$pluginTarget = Join-Path $root 'plugins\sillytavern-novelai'
if (-not (Test-Path -LiteralPath (Join-Path $root 'server.js'))) { throw "目标目录不是 SillyTavern 根目录：$root" }
New-Item -ItemType Directory -Force -Path $pluginTarget, $extensionTarget | Out-Null
Copy-Item -Path (Join-Path $pluginSource '*') -Destination $pluginTarget -Recurse -Force
Get-ChildItem -LiteralPath $PSScriptRoot -Force | Where-Object { $_.Name -notin @('.git','docs','server-plugin','tests','scripts','node_modules') } | Copy-Item -Destination $extensionTarget -Recurse -Force
Write-Host "花漫画服务端插件已安装到 $pluginTarget"
Write-Host "花漫画浏览器扩展已安装到 $extensionTarget"
Write-Host '请在 config.yaml 开启 enableServerPlugins: true，然后重启 SillyTavern。'
