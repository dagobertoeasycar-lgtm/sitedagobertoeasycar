@echo off
setlocal
set "LOG=C:\Logs\DagobertoEasycar\healthcheck.log"

curl.exe --silent --show-error --fail --max-time 8 http://127.0.0.1:3100/api/health >NUL 2>&1
if errorlevel 1 goto failure

curl.exe --silent --show-error --fail --max-time 8 -H "Host: www.dagobertoeasycar.com.br" http://127.0.0.1/api/health >NUL 2>&1
if errorlevel 1 goto failure

echo %date%T%time% OK>>"%LOG%"
exit /b 0

:failure
echo %date%T%time% FALHA health-api-ou-iis>>"%LOG%"
exit /b 1
