# 🩺 MediReport AI — Clinical Lab Report Analyzer

MediReport AI is a clinical-grade prototype and educational monorepo consisting of a React Native mobile client, a Python FastAPI backend, and a React admin dashboard. The platform orchestrates multi-pass OCR extractions, clinical reference comparisons, NLM MedlinePlus database lookups, and secure cloud sync with local offline-first fallback storage.

> ⚠️ **MEDICAL DISCLAIMER & SAFETY GUARDRAIL**: This platform does **not** provide clinical diagnosis, prescriptions, treatment advice, or dosage. It is designed to identify abnormal values from lab report prints, translate them to patient-friendly explanations (in English and Roman Urdu), and link directly to official National Library of Medicine (NLM) documentation. 

---

## 📂 Project Architecture

```text
medireport-ai/
├── backend/            # FastAPI Python server (OCR, NLP parser, and Clinical comparator)
├── mobile-app/         # React Native Expo client (OCR scanning, Trends, and Health Tips)
├── admin-panel/        # React + Vite dashboard (Feedback approvals and database inspection)
├── dataset/            # Machine learning synthetic training pipelines & accuracy evaluation
└── docs/               # System documentation, EAS guidelines, and Privacy policies
```

---

## ✨ Key Capabilities

1. **Robust Multi-Pass OCR Pipeline**:
   * Runs local **PaddleOCR** as primary engine (free and self-hosted).
   * Automatically falls back to **Eden AI**, **OCR.space**, **Gemini 2.5 Vision**, and **Tesseract** in sequence to guarantee extraction.
   * Cleans Y-coordinate column mixing and corrects typical OCR typos (`O` $\rightarrow$ `0`, `mg/di` $\rightarrow$ `mg/dL`).
2. **Clinical Reference Ground Truth**:
   * Never invents reference ranges. Always uses the lab report's printed bounds.
   * If a reference range is missing, flags status as `needs_review` to prevent false critical alarms.
3. **NLM MedlinePlus LOINC Connectors**:
   * Uses LOINC code maps to query **MedlinePlus Connect Infobutton REST APIs** and **Official XML Search Services**.
   * Prioritizes official NLM documentation inside the in-app Medical Wiki.
4. **Supabase Integration & RLS**:
   * Implements strict Row Level Security (RLS) policies enforcing `auth.uid()::text = user_id`.
   * Automatically creates user profiles via database triggers on authentication signups.
5. **Guest Mode Offline-First Decoupling**:
   * Guest users completely bypass database connection constraints.
   * Saves and parses data instantly in local cache files (`local_db/reports.json` on backend, `AsyncStorage` on client).

---

## 🛠️ Monorepo Quick Start

### 1. Backend Server Setup
Navigate to the `backend` directory, set up your python virtual environment, and install dependencies:
```bash
cd backend
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On Unix:
source .venv/bin/activate

pip install -r requirements.txt
```

Create a `backend/.env` file in the folder:
```env
TESSERACT_PATH=C:\Program Files\Tesseract-OCR\tesseract.exe
GEMINI_API_KEY=your_gemini_api_key
OCR_SPACE_API_KEY=your_ocr_space_api_key
EDENAI_API_KEY=your_eden_ai_api_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_your_secret_role_key
```

Start the reload server:
```bash
py -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
API docs are available at `http://127.0.0.1:8000/docs`.

### 2. Mobile App Setup (React Native Expo)
Navigate to the `mobile-app` directory and install JavaScript packages:
```bash
cd mobile-app
npm install
```

Create a `mobile-app/.env` file:
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_your_anon_key
EXPO_PUBLIC_API_BASE_URL=http://your-computer-ip-address:8000
```

Start the Metro bundler:
```bash
npx expo start --clear
```

### 3. Admin Panel Setup (React + Vite)
Navigate to `admin-panel` and install packages:
```bash
cd admin-panel
npm install
```

Create `admin-panel/.env`:
```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_your_anon_key
```

Launch the developer server:
```bash
npm run dev
```

---

## 🧪 Running QA Audits & Test Suites

We enforce high clinical accuracy and database security with automated test runners.

### Run Automated Unit/Integration Pytest Suite
From the `backend` folder, run:
```bash
pytest
```
This tests abnormality rules, parser alignment algorithms, OCR typo corrections, and clinical safety regex filters.

### Run Live Supabase Integration Suite
Execute the live database connection and security tester:
```bash
py backend/test_supabase_live.py
```
This validates profiles trigger syncs, table constraints, cascade deletions, guest modes, and verifies that RLS correctly blocks anonymous reads.

---

## 📦 Expo Application Builds (EAS)

Deploy previews and releases using Expo Application Services (EAS):

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Login to Expo
eas login

# Build stand-alone testing APK (Preview)
eas build -p android --profile preview

# Compile Google Play Store App Bundle (AAB)
eas build -p android --profile production
```

---

## 🏥 Clinical Safety Rules & Guardrails
* **No Prescriptions/Treatments**: If the parser encounters words indicating action (`take medicine`, `cure`, `suffer`), the safety filter overrides the interpretation and flags the report for manual doctor review.
* **Score Limits**: Health scores drop dynamically based on severity but never below a minimum score of `10/100` to prevent unnecessary panic.
* **Disclaimer Exposure**: Mandatory disclaimers remain visible across all screens, onboarding pathways, and PDF downloads.
