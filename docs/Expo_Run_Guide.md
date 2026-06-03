# Expo Mobile Run Guide

This guide ensures the MediReport AI mobile app connects successfully to your local backend.

## 🚀 Step 1: Start the Backend
Open a terminal in the project root and run:

```powershell
cd backend
$env:PYTHONPATH = "$PWD\..;$PWD"
py -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
*Wait until you see: `Uvicorn running on http://0.0.0.0:8000`*

## 📱 Step 2: Start the Mobile App
Open a **NEW** terminal and run:

```powershell
cd mobile-app
npx expo start --clear
```

## 📋 Step 3: Connect Physical Device
1. Ensure your phone and laptop are on the **Same Wi-Fi network**.
2. Open the **Expo Go** app on your phone.
3. Scan the **QR Code** displayed in your laptop terminal.
4. Verify the IP in the console: `MediReport API_BASE: http://192.168.100.14:8000`.

## 🛠️ Troubleshooting
- **Scan Failed / Connection Error**: 
  - Double check your computer's IP address. 
  - If it is NOT `192.168.100.14`, update `mobile-app/services/api.js` and `mobile-app/.env`.
  - Check your Windows Firewall and allow Python to accept incoming connections on port 8000.
- **Login Issues**: Use "Continue as Guest" if you haven't created a Supabase account yet.
- **Blurry Images**: Use the "Manual Entry" button if the OCR cannot read the text.

---
**Verified for MediReport AI Beta v1.2**
