# Complete Installation & Supabase Setup Guide

This guide details how to install, configure, and launch all components of the **MediReport AI** project with complete Supabase integration.

---

## 🚀 1. Supabase Console Configuration

Follow these steps manually in the [Supabase Console](https://supabase.com/dashboard/):

### Step A: Create a Supabase Project
1. Log in to your Supabase account and click **New Project**.
2. Select your Organization, name the project `MediReport AI` (or similar), set a secure Database Password, choose your region, and click **Create new project**.

### Step B: Create Database Tables (SQL Editor)
1. Once your project is active, navigate to the **SQL Editor** in the left sidebar.
2. Click **New Query** (blank query).
3. Paste the following SQL script to create your PostgreSQL tables:

```sql
-- 1. Create Reports Table
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    report_type TEXT,
    overall_risk TEXT,
    report_data JSONB NOT NULL,
    file_url TEXT
);

-- 2. Create Observations Table
CREATE TABLE IF NOT EXISTS observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    test_name TEXT NOT NULL,
    value NUMERIC,
    unit TEXT,
    range_low NUMERIC,
    range_high NUMERIC,
    status TEXT,
    possible_indication TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Corrections Table
CREATE TABLE IF NOT EXISTS corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    report_id TEXT,
    correction_type TEXT NOT NULL,
    original_data JSONB,
    corrected_data JSONB,
    approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create Feedback Table
CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    rating INTEGER,
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
```
4. Click **Run** at the bottom right. You should see a green `Success` notice confirming tables were successfully created.

### Step C: Create Storage Bucket
1. Navigate to **Storage** in the left sidebar.
2. Click **New Bucket**.
3. Name the bucket precisely **`scans`**.
4. Toggle the **Public** option to **ON** (allows generating instant public image URLs for scans).
5. Click **Create bucket**.

### Step D: Copy Project API Credentials
1. Click the **Gear Icon (Project Settings)** in the bottom left sidebar, then click **API**.
2. Copy the following credentials:
   - **Project URL:** under `Project URL`
   - **Anon Public API Key:** under `Project API keys` (labeled as `anon` `public`)

---

## 💻 2. Monorepo Environmental Settings

Configure the environment settings for each component layer:

### A. Python Backend (`backend/`)
Create a file named `backend/.env` (using `backend/.env.example` as a template) and add the following keys:
```ini
# Supabase Project Connection Credentials
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_KEY=your-anon-or-service-role-key
```

### B. Mobile App (`mobile-app/`)
Create a file named `mobile-app/.env` (using `mobile-app/.env.example` as a template) and fill in the public credentials copied during Step D:
```ini
# Local Backend API server base endpoint
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8000

# Supabase Client Credentials
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### C. Admin Panel (`admin-panel/`)
Create a file named `admin-panel/.env` (using `admin-panel/.env.example` as a template) and duplicate the client configuration:
```ini
# Local Backend API server base endpoint
VITE_API_BASE_URL=http://127.0.0.1:8000

# Supabase Client Credentials
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## 🏃‍♂️ 3. Launching All Services

Open separate terminals for each component layer and run these commands to start the monorepo:

### Terminal 1: FastAPI Python Backend
```bash
cd backend
python -m venv .venv
# On Windows powershell: .venv\Scripts\activate
# On Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
py -m uvicorn main:app --reload --port 8000
```
- Open: `http://127.0.0.1:8000/docs` to inspect active Swagger APIs.

### Terminal 2: React Native Expo Mobile App
```bash
cd mobile-app
npm install
npx expo start
```
- Scan the QR code using Expo Go on your physical iOS/Android phone or press `w` to launch on Expo Web simulator.

### Terminal 3: React Admin Dashboard
```bash
cd admin-panel
npm install
npm run dev
```
- Open: `http://localhost:5173` to inspect accuracy targets, Supabase scans, and user reviews.
