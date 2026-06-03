import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client
from datetime import datetime

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key) if url and key else None
active = supabase is not None
supabase_active = active

def save_report_to_db(user_id, meta, report_data):
    if not active: return None
    res = supabase.table("reports").insert({
        "user_id": user_id,
        "report_type": meta.get("report_type"),
        "category": meta.get("category"),
        "overall_risk": report_data.get("overallRisk"),
        "ocr_text": report_data.get("ocr_text"),
        "english_explanation": report_data.get("englishExplanation"),
        "roman_urdu_explanation": report_data.get("romanUrduExplanation"),
        "confidence": meta.get("confidence"),
        "image_url": report_data.get("imageUrl"),
        "manual_review_required": meta.get("manual_review_required", False)
    }).execute()
    return res.data[0]["id"] if res.data else None

def save_observations(report_id, tests):
    if not active: return
    for t in tests:
        supabase.table("observations").insert({
            "report_id": report_id,
            "test_name": t.get("testName"),
            "value": t.get("value"),
            "unit": t.get("unit"),
            "range_low": t.get("rangeLow"),
            "range_high": t.get("rangeHigh"),
            "status": t.get("status"),
            "overall_confidence": t.get("confidence"),
            "manual_review_required": t.get("needsManualReview", False)
        }).execute()

def log_learning_activity(user_id, report_id, meta, text, pred_json):
    if not active: return
    supabase.table("scan_learning_logs").insert({
        "user_id": user_id,
        "report_id": report_id,
        "report_type": meta.get("report_type"),
        "category": meta.get("category"),
        "raw_ocr_text": text,
        "extracted_json": pred_json,
        "confidence": meta.get("confidence")
    }).execute()

def get_verified_memory(m_type):
    if not active: return {}
    res = supabase.table("verified_learning_memory").select("*").eq("memory_type", m_type).execute()
    return {row["key"]: row["value"] for row in res.data}
