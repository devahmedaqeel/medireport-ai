from fastapi import APIRouter, Body
from services.database_service import get_feedback, get_accuracy_snapshot
from services.rule_loader import load_json_rule
from services.feedback_learning_service import get_all_pending_feedback, process_feedback
import subprocess
import sys
from pathlib import Path

router = APIRouter()

@router.get("/rules/{rule_name}")
def get_rule(rule_name: str):
    return load_json_rule(rule_name)

@router.get("/feedback")
def feedback():
    return get_feedback()

@router.get("/accuracy")
def accuracy():
    return get_accuracy_snapshot()

@router.get("/pending-corrections")
def pending_corrections():
    return get_all_pending_feedback()

@router.post("/process-correction/{feedback_id}")
def handle_correction(feedback_id: str, action: str = Body(..., embed=True)):
    success = process_feedback(feedback_id, action)
    return {"status": "success" if success else "error"}

@router.post("/run-training")
def run_training():
    script_path = Path(__file__).resolve().parent.parent.parent / "dataset" / "scripts" / "run_full_training_pipeline.py"
    try:
        subprocess.Popen([sys.executable, str(script_path)])
        return {"status": "success", "message": "Training pipeline started in background."}
    except Exception as e:
        return {"status": "error", "message": str(e)}
