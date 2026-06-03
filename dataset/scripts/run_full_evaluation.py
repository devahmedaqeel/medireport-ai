import os
import json
import sys
from pathlib import Path

# Add backend to path
sys.path.append(str(Path(__file__).resolve().parent.parent.parent / "backend"))

from services.parser_service import parse_report_text
from services.analysis_service import analyze_structured_report

def run_evaluation():
    base_dir = Path(__file__).resolve().parent.parent
    synthetic_dir = base_dir / "synthetic_reports"
    gt_dir = base_dir / "training_json"
    
    if not synthetic_dir.exists() or not gt_dir.exists():
        print("Error: Dataset not generated.")
        return

    metrics = {
        "report_type_acc": 0,
        "extraction_acc": 0,
        "value_acc": 0,
        "status_acc": 0,
        "manual_review_rate": 0,
        "total_files": 0
    }

    failed_cases = []
    files = list(synthetic_dir.glob("*.txt"))
    metrics["total_files"] = len(files)
    
    print(f"Evaluating {len(files)} reports...")

    for txt_file in files:
        file_id = txt_file.stem
        gt_file = gt_dir / f"{file_id}.json"
        if not gt_file.exists(): continue
        
        with open(txt_file, "r") as f: text = f.read()
        with open(gt_file, "r") as f: gt = json.load(f)
        
        pred = analyze_structured_report(parse_report_text(text))
        
        # 1. Report Type
        type_match = pred["reportType"] == gt["report_type"]
        if type_match: metrics["report_type_acc"] += 1
            
        # 2. Extractions
        pred_tests = {t["testName"]: t for t in pred["tests"]}
        gt_tests = {t["test_name"]: t for t in gt["tests"]}
        
        matches = 0; val_matches = 0; status_matches = 0
        manual_review_needed = any(t.get("manualReviewRequired") for t in pred["tests"])
        if manual_review_needed: metrics["manual_review_rate"] += 1

        for name, gt_t in gt_tests.items():
            if name in pred_tests:
                matches += 1
                if abs(pred_tests[name]["value"] - gt_t["value"]) < 0.01: val_matches += 1
                # status check (simulated)
                status_matches += 1
        
        extraction_score = (matches / len(gt_tests)) if gt_tests else 0
        metrics["extraction_acc"] += extraction_score
        metrics["value_acc"] += (val_matches / len(gt_tests)) if gt_tests else 0
        metrics["status_acc"] += (status_matches / len(gt_tests)) if gt_tests else 0

        # Track failure
        if extraction_score < 0.8 or not type_match:
            failed_cases.append({
                "report_id": file_id,
                "report_type_expected": gt["report_type"],
                "report_type_predicted": pred["reportType"],
                "extraction_score": extraction_score,
                "missing_markers": [n for n in gt_tests if n not in pred_tests]
            })

    # Final Summary
    total = metrics["total_files"]
    print("\n" + "="*30)
    print("NEXT-LEVEL EVALUATION")
    print("="*30)
    print(f"Report Type Accuracy: {metrics['report_type_acc']/total*100:.1f}%")
    print(f"Extraction Accuracy:  {metrics['extraction_acc']/total*100:.1f}%")
    print(f"Value Accuracy:       {metrics['value_acc']/total*100:.1f}%")
    print(f"Manual Review Rate:   {metrics['manual_review_rate']/total*100:.1f}%")
    print("="*30)
    
    # Save Failed Cases
    with open(base_dir / "evaluation_reports" / "failed_cases.json", "w") as f:
        json.dump(failed_cases, f, indent=2)

if __name__ == "__main__":
    run_evaluation()
