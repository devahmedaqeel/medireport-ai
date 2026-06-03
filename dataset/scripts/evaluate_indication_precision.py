import os
import json
import sys
from pathlib import Path

# Add backend to path
sys.path.append(str(Path(__file__).resolve().parent.parent.parent / "backend"))

from services.parser_service import parse_report_text
from services.analysis_service import analyze_structured_report
from services.indication_service import add_indications

def main():
    base_dir = Path(__file__).resolve().parent.parent
    synthetic_dir = base_dir / "synthetic_reports"
    gt_dir = base_dir / "training_json"
    
    files = list(synthetic_dir.glob("*.txt"))
    total_samples = 0
    correct_indications = 0
    
    print(f"Evaluating indication precision on {len(files)} samples...")
    for f in files:
        with open(f, "r") as tf: text = f.read()
        # ground truth from generation doesn't have full indication text, 
        # so we evaluate if indications are generated when abnormal markers exist.
        
        pred = add_indications(analyze_structured_report(parse_report_text(text)))
        tests = pred.get("tests", [])
        abnormal = [t for t in tests if t.get("status") not in ["Normal", "Unknown"]]
        
        if not abnormal: continue
        
        total_samples += 1
        has_indications = all(t.get("possibleIndication") and t.get("possibleIndication") != "Consult doctor" for t in abnormal)
        if has_indications:
            correct_indications += 1
                
    precision = (correct_indications / total_samples) * 100 if total_samples > 0 else 0
    print(f"Indication Retrieval Precision: {precision:.2f}%")

if __name__ == "__main__":
    main()
