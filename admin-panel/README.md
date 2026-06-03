# 💻 MediReport AI Admin Panel

A React + Vite web dashboard designed for medical administrators to audit user corrections, review general feedback, inspect parsed biomarker rules, and execute model training pipelines.

## 📁 Directory Layout

```text
admin-panel/
├── src/
│   ├── components/     # UI layouts
│   ├── src/App.jsx     # Main panel container, routing, and table renderer
│   ├── src/style.css   # Styling (Dark mode support)
│   └── src/supabase.js # Client connector (bypasses to FastAPI admin routes if URL unset)
├── index.html          # Web page frame
├── package.json        # Frontend packages
└── .env                # Port configuration details
```

## ⚙️ Core Capabilities

1. **User Corrections Audit**: Reviews changes made by users to OCR values. Administrators can approve or reject corrections to refine parser heuristics.
2. **General Feedback View**: Aggregates general user comments and rating scores.
3. **Training Pipeline Trigger**: Triggers the machine learning model training pipeline directly from the UI, executing `run_full_training_pipeline.py` in the background.
4. **FastAPI Fallback Mode**: If Supabase credentials are not supplied, the panel operates in local mode, fetching feedback data directly from FastAPI administrative endpoints.

## 🚀 Running the Panel Locally

```bash
# Install node modules
npm install

# Create environment configuration
cp .env.example .env

# Run Vite dev server
npm run dev
```

Open `http://localhost:5173` in your default browser.
