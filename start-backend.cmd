
@echo off
cd /d "%~dp0backend"
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8002
) else (
    python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8002
)
