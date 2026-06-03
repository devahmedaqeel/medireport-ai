# 🐍 MediReport AI Backend API

FastAPI Python server driving the OCR extraction pipeline, rule-based clinical parser, NLM MedlinePlus knowledge connectors, and FHIR collection exporter.

## 📁 Directory Layout

```text
backend/
├── routes/             # API Endpoints (reports, analysis, feedback, memory, and admin)
├── services/           # Business logic layer
│   ├── ocr_service.py              # Multi-pass OCR cluster orchestration
│   ├── parser_service.py           # Classifier & biomarker extractor
│   ├── analysis_service.py         # Clinical ranges matching & health scoring
│   ├── knowledge_retrieval_service.py # MedlinePlus Connect & NLM XML APIs
│   ├── safety_guardrail_service.py # Definitive medical warning filters
│   └── database_service.py         # local JSON database fallback
├── rules/              # Curated JSON reference range schemas
├── local_db/           # Local file storage for guest mode fallbacks
├── tests/              # Unit & integration pytest suite
├── .env                # Secret environment variables (ignored in git)
└── requirements.txt    # Python dependencies
```

## ⚙️ Core Modules & Pipelines

1. **Multi-Pass OCR**: Receives file uploads, coordinates local/cloud engines, horizontal layout clusters, and runs string normalization checks.
2. **Clinical Rules Engine**: Evaluates extracted value quantities against the lab report's printed bounds. Assigns low/normal/high/needs_review statuses.
3. **Medical Safety Filters**: Scans generated outputs with strict regex word match boundaries to strip out definitive diagnoses or prescriptions.
4. **Knowledge retrieval**: Connects biomarkers via LOINC mappings to fetch NLM XML articles and MedlinePlus Connect portals.
5. **Guest Mode Decoupled Bypasses**: Automatically redirects storage actions for user `"guest"` to write directly to `local_db/reports.json`, eliminating Supabase network overhead.

## 🚀 Server Run Command

Set up your virtual environment, install requirements, configure `.env` variables, and start the development server:

```bash
python -m venv .venv
source .venv/bin/activate  # Or .venv\Scripts\activate on Windows
pip install -r requirements.txt

py -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## 🧪 Testing

We run our tests using `pytest`:

```bash
# Run complete test suite
pytest

# Run specific test file
pytest tests/test_numeric_extraction.py
```

### Live Supabase QA Test Suite
Verify credentials, cascade deletes, trigger setups, and RLS bypasses by executing:
```bash
py test_supabase_live.py
```
