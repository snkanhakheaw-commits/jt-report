@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   อัปเดตเว็บงานรถทอย (jt-report)
echo ============================================
echo.
python "C:\Users\ASUS\OneDrive\Desktop\noName\JT\_build\publish_jt.py"
if errorlevel 1 goto fail
echo.
git add -A
git diff --cached --quiet && (echo ไม่มีอะไรเปลี่ยน ไม่ต้องอัปเดต & goto done)
git commit -m "อัปเดตงานรถทอย"
if errorlevel 1 goto fail
git push
if errorlevel 1 goto fail
echo.
echo เรียบร้อย! รอสักครู่ (ประมาณ 1 นาที) แล้วรีเฟรชหน้าเว็บ
echo https://snkanhakheaw-commits.github.io/jt-report/
goto done
:fail
echo.
echo *** มีข้อผิดพลาด อ่านข้อความด้านบน ***
:done
echo.
pause
