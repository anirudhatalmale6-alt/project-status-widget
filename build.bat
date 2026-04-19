@echo off
echo ============================================
echo   Building Project Status Widget
echo ============================================

echo.
echo Installing dependencies...
pip install -r app\requirements.txt

echo.
echo Building executable...
pyinstaller --onefile --windowed ^
    --name "ProjectStatusWidget" ^
    --add-data "app\templates;templates" ^
    --add-data "app\static;static" ^
    --add-data "app\data;data" ^
    --add-data "sample;sample" ^
    --icon "app\static\images\icon.ico" ^
    app\desktop.py

echo.
echo ============================================
echo   Build complete! Check dist\ folder
echo ============================================
pause
