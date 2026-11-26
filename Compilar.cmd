@echo off
rem Gera o Asa.exe a partir de src\Asa.cs com o compilador C# que já vem no Windows (.NET Framework 4).
rem As DLLs do WebView2 ficam nesta mesma pasta.
setlocal
cd /d "%~dp0"
set "CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%CSC%" (echo Nao achei o compilador: %CSC% & exit /b 1)
"%CSC%" /nologo /target:winexe /platform:x64 /optimize+ /win32icon:asa.ico /out:Asa.exe ^
  /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Web.Extensions.dll /r:System.Security.dll ^
  /r:System.Net.Http.dll /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll /r:Microsoft.VisualBasic.dll ^
  /r:Microsoft.Web.WebView2.Core.dll /r:Microsoft.Web.WebView2.WinForms.dll src\Asa.cs
if errorlevel 1 (echo Falhou. & exit /b 1)
echo Asa.exe gerado.
