import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
SUMMARY_PATH = BASE_DIR / "dataset" / "evaluation_reports" / "ml_evaluation_summary.json"

def get_safe_accuracy_claim():
    if not SUMMARY_PATH.exists():
        return "The system is currently in its initial clinical baseline stage. Accuracy metrics will be available after the first model evaluation."

    try:
        with open(SUMMARY_PATH, "r") as f:
            metrics = json.load(f)
            
        hybrid_acc = metrics.get("hybrid_acc", 0) * 100
        samples = metrics.get("test_samples", 0)
        
        return f"Based on the latest evaluation of {samples} synthetic and verified reports, the system achieved a hybrid accuracy of {hybrid_acc:.1f}% for report classification and marker extraction."
    except Exception as e:
        return "System accuracy is currently being evaluated."

def validate_accuracy_statement(statement: str) -> bool:
    """Blocks overclaims and guarantees."""
    unsafe_terms = ["100%", "guaranteed", "perfect", "absolute", "diagnostic accuracy"]
    lower = statement.lower()
    for term in unsafe_terms:
        if term in lower:
            return False
    return True
