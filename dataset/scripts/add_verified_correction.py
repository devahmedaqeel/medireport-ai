import json
import os
from pathlib import Path

def add_verified_sample(report_id, text, corrected_json):
    """
    Saves a human-verified correction to the training dataset.
    """
    base_dir = Path(__file__).resolve().parent.parent
    
    # 1. Save Text
    with open(base_dir / "anonymized_reports" / f"{report_id}.txt", "w") as f:
        f.write(text)
        
    # 2. Save JSON
    with open(base_dir / "training_json" / f"{report_id}.json", "w") as f:
        json.dump(corrected_json, f, indent=2)
        
    print(f"Sample {report_id} added to training dataset.")

if __name__ == "__main__":
    # Example usage for manual ingestion
    sample_id = "real_cbc_001"
    sample_text = "CBC Report\nHb: 10.5\nWBC: 12000"
    sample_gt = {
        "report_id": sample_id,
        "report_type": "CBC",
        "tests": [
            {"test_name": "Hemoglobin", "value": 10.5},
            {"test_name": "White Blood Cells", "value": 12000}
        ]
    }
    # add_verified_sample(sample_id, sample_text, sample_gt)
