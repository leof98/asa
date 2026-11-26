# Monta o pacote de uma versão para o GitHub (Releases): Asa-<versão>.zip com o exe, as DLLs do WebView2 e a pasta app.
# Uso: clique com o botão direito > Executar com o PowerShell, ou: powershell -File Empacotar.ps1
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$versao = (Get-Content -Raw -LiteralPath 'versao.json' | ConvertFrom-Json).versao
$saida = Join-Path $PSScriptRoot ("Asa-" + $versao + ".zip")
$itens = @('Asa.exe', 'asa.ico', 'versao.json', 'Microsoft.Web.WebView2.Core.dll', 'Microsoft.Web.WebView2.WinForms.dll', 'WebView2Loader.dll', 'app')
if (Test-Path -LiteralPath $saida) { Remove-Item -LiteralPath $saida }
Compress-Archive -Path $itens -DestinationPath $saida
Write-Host "Pacote pronto: $saida"
Write-Host "No GitHub: Releases > Draft a new release > tag v$versao > anexe o .zip > Publish."
