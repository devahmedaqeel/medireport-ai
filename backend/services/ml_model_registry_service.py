import json
from pathlib import Path
from datetime import datetime

VERSION_FILE = Path(__file__).resolve().parent.parent / "models" / "version.json"

def get_model_version():
    if not VERSION_FILE.exists():
        return {
            "report_classifier_version": "1.0.0",
            "medical_ner_version": "1.0.0",
            "trained_on_synthetic_reports": 0,
            "trained_on_real_verified_reports": 0,
            "last_training_date": None,
            "status": "initial"
        }
    with open(VERSION_FILE, "r") as f:
        return json.load(f)

def update_model_metrics(metrics: dict):
    current = get_model_version()
    current.update(metrics)
    current["last_training_date"] = datetime.now().strftime("%Y-%m-%d")
    current["status"] = "active"
    
    with open(VERSION_FILE, "w") as f:
        json.dump(current, f, indent=2)
    return current
