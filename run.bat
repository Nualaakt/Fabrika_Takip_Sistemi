@echo off
chcp 65001 >nul
title CPS Uretim Sistemi

cd /d "%~dp0"

echo.
echo =====================================
echo   CPS WhatsApp Uretim Takip Sistemi
echo =====================================
echo.

:BASLA
echo [%date% %time%] Onceki oturum temizleniyor...

:: Onceki node.js process'lerini sonlandir
taskkill /F /IM node.exe >nul 2>&1

:: Chrome lock dosyasini sil (oturum kilidini ac)
if exist ".wwebjs_auth\session\SingletonLock" (
    del /F /Q ".wwebjs_auth\session\SingletonLock" >nul 2>&1
)
if exist ".wwebjs_auth\session\SingletonCookie" (
    del /F /Q ".wwebjs_auth\session\SingletonCookie" >nul 2>&1
)
if exist ".wwebjs_auth\session\SingletonSocket" (
    del /F /Q ".wwebjs_auth\session\SingletonSocket" >nul 2>&1
)

:: Kisa bekleme (process'lerin tamamen kapanmasi icin)
timeout /t 2 /nobreak >nul

echo [%date% %time%] Sistem baslatiliyor...
node index.js

if %errorlevel% neq 0 (
    echo.
    echo [%date% %time%] HATA: Program beklenmedik sekilde kapandi. 5 saniye sonra yeniden baslatiliyor...
    timeout /t 5 /nobreak >nul
    goto BASLA
)

echo.
echo [%date% %time%] Program normal sekilde kapandi.
pause
