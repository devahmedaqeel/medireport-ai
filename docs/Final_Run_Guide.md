# Final Run Guide — MediReport AI

This guide contains the exact PowerShell commands to run and verify all components of the **MediReport AI** application.

---

## 🚀 Service Start Commands

### 1. Backend Server (FastAPI)
Run the following commands in PowerShell to start the backend uvicorn server:
```powershell
cd "c:\Users\user\Downloads\medireport-ai-complete-starter\medireport-ai\backend"
py -m uvicorn main:app --reload --port 8000
```
*Note: The server will be accessible at http://127.0.0.1:8000. You can query the health endpoint at http://127.0.0.1:8000/api/health.*

### 2. Admin Panel (Vite React)
Run the following commands in PowerShell to launch the admin dashboard:
```powershell
cd "c:\Users\user\Downloads\medireport-ai-complete-starter\medireport-ai\admin-panel"
npm run dev
```
*Note: The dashboard will be accessible at http://localhost:5173/.*

### 3. Mobile Client Application (Expo React Native)
Run the following commands in PowerShell to start the Expo dev server for the mobile app:
```powershell
cd "c:\Users\user\Downloads\medireport-ai-complete-starter\medireport-ai\mobile-app"
npx expo start
```

---

## 🧪 Verification & Testing Commands

### 1. Run Unit Tests (Pytest)
Run the unit test suite containing 31 test cases:
```powershell
$env:PYTHONPATH='c:\Users\user\Downloads\medireport-ai-complete-starter\medireport-ai\backend;c:\Users\user\Downloads\medireport-ai-complete-starter\medireport-ai'
py -m pytest "c:\Users\user\Downloads\medireport-ai-complete-starter\medireport-ai\backend\tests\test_numeric_extraction.py" -v
```

### 2. Run Accuracy Evaluation
Run the test set extractor metrics pipeline (450 test samples):
```powershell
$env:PYTHONPATH='c:\Users\user\Downloads\medireport-ai-complete-starter\medireport-ai\backend;c:\Users\user\Downloads\medireport-ai-complete-starter\medireport-ai'
py "c:\Users\user\Downloads\medireport-ai-complete-starter\medireport-ai\dataset\scripts\evaluate_ml_models.py"
```
