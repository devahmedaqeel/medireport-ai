from pathlib import Path
from datetime import datetime
import json
import uuid
from services.supabase_service import supabase, supabase_active

DB = Path(__file__).resolve().parent.parent / "local_db"
DB.mkdir(exist_ok=True)
REPORTS_FILE = DB / "reports.json"
FEEDBACK_FILE = DB / "feedback.json"


def _read(path):
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def _write(path, data):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def save_report(user_id: str, report: dict):
    report_id = uuid.uuid4().hex
    created_at = datetime.utcnow().isoformat()

    item = {
        "reportId": report_id,
        "userId": user_id,
        "createdAt": created_at,
        "report": report,
    }

    if supabase_active and supabase is not None and user_id != "guest":
        try:
            # 1. Insert into reports table
            supabase.table("reports").insert({
                "id": report_id,
                "user_id": user_id,
                "created_at": created_at,
                "report_type": report.get("reportType", "Unknown"),
                "overall_risk": report.get("overallRisk", "Green"),
                "report_data": report,
                "file_url": report.get("imageUrl", "")
            }).execute()

            # 2. Insert nested observations
            tests = report.get("tests", [])
            for t in tests:
                def safe_num(v):
                    if v is None:
                        return None
                    try:
                        return float(str(v).strip().replace("<", "").replace(">", "").replace("=", ""))
                    except ValueError:
                        return None

                observation = {
                    "report_id": report_id,
                    "user_id": user_id,
                    "test_name": t.get("testName", "Unknown"),
                    "value": safe_num(t.get("value")),
                    "unit": t.get("unit"),
                    "range_low": safe_num(t.get("rangeLow")),
                    "range_high": safe_num(t.get("rangeHigh")),
                    "status": t.get("status"),
                    "possible_indication": t.get("possibleIndication"),
                    "created_at": created_at
                }
                supabase.table("observations").insert(observation).execute()

            print(f"[OK] [Supabase] Successfully saved report {report_id} and observations!")
            return {"message": "Report saved in Supabase", "reportId": report_id}
        except Exception as e:
            print(f"[ERROR] [Supabase] Failed to save report: {e}. Falling back to local db...")

    # Fallback Local JSON DB
    data = _read(REPORTS_FILE)
    data.append(item)
    _write(REPORTS_FILE, data)
    return {"message": "Report saved", "reportId": report_id}


def get_reports_for_user(user_id: str):
    if supabase_active and supabase is not None and user_id != "guest":
        try:
            res = supabase.table("reports").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
            reports = []
            for r in res.data:
                reports.append({
                    "reportId": r["id"],
                    "userId": r["user_id"],
                    "createdAt": r["created_at"],
                    "report": r["report_data"]
                })
            return reports
        except Exception as e:
            print(f"[ERROR] [Supabase] Failed to fetch reports: {e}. Falling back to local db...")

    # Fallback Local JSON DB
    return [r for r in _read(REPORTS_FILE) if r.get("userId") == user_id]

def get_trends_for_user(user_id: str):
    """
    Returns historical trends for a user by grouping observations across reports.
    """
    if supabase_active and supabase is not None and user_id != "guest":
        try:
            # Query observations table directly for cleaner trend data
            res = supabase.table("observations").select("*").eq("user_id", user_id).order("created_at", desc=False).execute()
            
            trends = {}
            for obs in res.data:
                name = obs["test_name"]
                if name not in trends:
                    trends[name] = []
                trends[name].append({
                    "value": obs["value"],
                    "unit": obs["unit"],
                    "date": obs["created_at"],
                    "status": obs["status"]
                })
            return trends
        except Exception as e:
            print(f"[ERROR] [Supabase] Failed to fetch trends: {e}. Falling back to local...")

    # Fallback: Extract from local reports
    reports = [r for r in _read(REPORTS_FILE) if r.get("userId") == user_id]
    trends = {}
    for r in sorted(reports, key=lambda x: x["createdAt"]):
        tests = r.get("report", {}).get("tests", [])
        for t in tests:
            name = t.get("testName") or t.get("test_name")
            if not name: continue
            if name not in trends:
                trends[name] = []
            trends[name].append({
                "value": t.get("value"),
                "unit": t.get("unit"),
                "date": r["createdAt"],
                "status": t.get("status")
            })
    return trends


def save_feedback(payload: dict):
    feedback_id = uuid.uuid4().hex
    payload["feedbackId"] = feedback_id
    payload["createdAt"] = datetime.utcnow().isoformat()

    if supabase_active and supabase is not None:
        try:
            correction_type = payload.get("correctionType", "ocr_or_parser")
            if correction_type == "general_feedback":
                supabase.table("feedback").insert({
                    "id": feedback_id,
                    "user_id": payload.get("userId", "guest"),
                    "rating": payload.get("rating"),
                    "comment": payload.get("original") or payload.get("corrected") or "",
                    "created_at": payload["createdAt"]
                }).execute()
                print(f"[OK] [Supabase] Successfully saved general feedback {feedback_id}!")
            else:
                supabase.table("corrections").insert({
                    "id": feedback_id,
                    "user_id": payload.get("userId", "guest"),
                    "report_id": payload.get("reportId"),
                    "correction_type": correction_type,
                    "original_data": payload.get("original"),
                    "corrected_data": payload.get("corrected"),
                    "approved": payload.get("approved", False),
                    "created_at": payload["createdAt"]
                }).execute()
                print(f"[OK] [Supabase] Successfully saved correction {feedback_id}!")
            return {"message": "Feedback saved for review in Supabase", "feedbackId": feedback_id}
        except Exception as e:
            print(f"[ERROR] [Supabase] Failed to save feedback: {e}. Falling back to local db...")

    # Fallback Local JSON DB
    data = _read(FEEDBACK_FILE)
    data.append(payload)
    _write(FEEDBACK_FILE, data)
    return {"message": "Feedback saved for review", "feedbackId": feedback_id}


def get_feedback():
    if supabase_active and supabase is not None:
        try:
            corrections_res = supabase.table("corrections").select("*").execute()
            feedback_res = supabase.table("feedback").select("*").execute()
            
            data = []
            for c in corrections_res.data:
                data.append({
                    "feedbackId": c["id"],
                    "userId": c["user_id"],
                    "reportId": c["report_id"],
                    "correctionType": c["correction_type"],
                    "original": c["original_data"],
                    "corrected": c["corrected_data"],
                    "approved": c["approved"],
                    "createdAt": c["created_at"]
                })
            for f in feedback_res.data:
                data.append({
                    "feedbackId": f["id"],
                    "userId": f["user_id"],
                    "correctionType": "general_feedback",
                    "original": f["comment"],
                    "createdAt": f["created_at"]
                })
            return data
        except Exception as e:
            print(f"[ERROR] [Supabase] Failed to get feedback: {e}. Falling back to local db...")

    return _read(FEEDBACK_FILE)


def get_accuracy_snapshot():
    acc_report = Path(__file__).resolve().parent.parent.parent / "docs" / "Accuracy_Report.md"
    if acc_report.exists():
        try:
            content = acc_report.read_text(encoding="utf-8")
            return {
                "localMetrics": content,
                "note": "Metrics based on latest evaluation script run."
            }
        except: pass

    return {
        "ocrCharacterAccuracyTarget": "90-95% on clear images",
        "testExtractionTarget": "90%+ on supported reports",
        "abnormalityDetectionTarget": "95%+ when values and ranges are correctly extracted",
        "finalDiagnosis": "Not provided",
        "note": "Run dataset/scripts/run_full_evaluation.py for actual local metrics."
    }


def clear_reports_for_user(user_id: str):
    if supabase_active and supabase is not None and user_id != "guest":
        try:
            supabase.table("observations").delete().eq("user_id", user_id).execute()
            supabase.table("reports").delete().eq("user_id", user_id).execute()
            print(f"[OK] [Supabase] Cleared history for user {user_id}")
        except Exception as e:
            print(f"[ERROR] [Supabase] Failed to clear history: {e}")

    # Clear local DB reports
    try:
        data = _read(REPORTS_FILE)
        filtered = [r for r in data if r.get("userId") != user_id]
        _write(REPORTS_FILE, filtered)
        print(f"[OK] [Local DB] Cleared history for user {user_id}")
    except Exception as e:
        print(f"[ERROR] [Local DB] Failed to clear history: {e}")
        
    return {"status": "success", "message": "History cleared successfully"}
