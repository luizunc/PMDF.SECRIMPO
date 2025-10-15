@echo off
echo ========================================
echo   BUILD COMPLETO - PAINEL PMDF
echo ========================================
echo.

REM Verificar se Python esta instalado
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Python nao encontrado!
    echo Instale Python em: https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Verificar se Node.js esta instalado
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Node.js nao encontrado!
    echo Instale Node.js em: https://nodejs.org/
    pause
    exit /b 1
)

echo [1/5] Instalando dependencias Node.js...
call npm install
if errorlevel 1 (
    echo [ERRO] Falha ao instalar dependencias Node.js
    pause
    exit /b 1
)

echo.
echo [2/5] Instalando dependencias Python...
pip install -r auth/requirements.txt
if errorlevel 1 (
    echo [ERRO] Falha ao instalar dependencias Python
    pause
    exit /b 1
)

echo.
echo [3/5] Instalando PyInstaller...
pip install pyinstaller
if errorlevel 1 (
    echo [ERRO] Falha ao instalar PyInstaller
    pause
    exit /b 1
)

echo.
echo [4/5] Compilando autenticacao Python para EXE...
cd auth
pyinstaller --onefile --noconsole --name auth_pmdf --distpath bin --workpath ../build --specpath ../build --add-data "keyauth.py;." --add-data "../.env;." --hidden-import=keyauth auth_wrapper.py
cd ..
if errorlevel 1 (
    echo [ERRO] Falha ao compilar autenticacao
    pause
    exit /b 1
)

echo.
echo [5/5] Compilando aplicacao Electron para EXE...
call npm run build:win
if errorlevel 1 (
    echo [ERRO] Falha ao compilar aplicacao Electron
    pause
    exit /b 1
)

echo.
echo ========================================
echo   BUILD CONCLUIDO COM SUCESSO!
echo ========================================
echo.
echo Instalador criado em: dist\Painel PMDF Setup.exe
echo.
echo Voce pode distribuir este arquivo para os usuarios.
echo Eles NAO precisam ter Python ou Node.js instalados!
echo.
pause
