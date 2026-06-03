import os
import json
import sys
from pathlib import Path

# Add backend to path
sys.path.append(str(Path(__file__).resolve().parent.parent.parent / "backend"))

from services.parser_service import parse_report_text

def main():
    base_dir = Path(__file__).resolve().parent.parent
    synthetic_dir = base_dir / "synthetic_reports"
    gt_dir = base_dir / "training_json"
    
    files = list(synthetic_dir.glob("*.txt"))
    total_tests = 0
    matched_tests = 0
    
    print(f"Evaluating parser extraction on {len(files)} samples...")
    for f in files:
        with open(f, "r") as tf: text = f.read()
        with open(gt_dir / f"{f.stem}.json", "r") as gtf: gt = json.load(gtf)
        
        pred = parse_report_text(text)
        pred_names = [t["testName"] for t in pred["tests"]]
        gt_names = [t["test_name"] for t in gt["tests"]]
        
        total_tests += len(gt_names)
        for name in gt_names:
            if name in pred_names:
                matched_tests += 1
                
    acc = (matched_tests / total_tests) * 100 if total_tests > 0 else 0
    print(f"Test Name Extraction Accuracy: {acc:.2f}%")

if __name__ == "__main__":
    main()
