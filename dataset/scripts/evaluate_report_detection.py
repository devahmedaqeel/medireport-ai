import os
import json
import sys
from pathlib import Path

# Add backend to path
sys.path.append(str(Path(__file__).resolve().parent.parent.parent / "backend"))

from services.parser_service import detect_report_type

def main():
    base_dir = Path(__file__).resolve().parent.parent
    synthetic_dir = base_dir / "synthetic_reports"
    gt_dir = base_dir / "training_json"
    
    files = list(synthetic_dir.glob("*.txt"))
    correct = 0
    total = len(files)
    
    print(f"Evaluating report detection on {total} samples...")
    for f in files:
        with open(f, "r") as tf: text = f.read()
        with open(gt_dir / f"{f.stem}.json", "r") as gtf: gt = json.load(gtf)
        
        pred = detect_report_type(text)["report_type"]
        if pred == gt["report_type"] or (gt["report_type"] in pred):
            correct += 1
            
    acc = (correct / total) * 100 if total > 0 else 0
    print(f"Report Type Detection Accuracy: {acc:.2f}%")

if __name__ == "__main__":
    main()
