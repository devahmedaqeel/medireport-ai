import os
import json
import sys
import re
from pathlib import Path
import pandas as pd
from sklearn.metrics import accuracy_score

# Add backend to path
sys.path.append(str(Path(__file__).resolve().parent.parent.parent / "backend"))

from services.hybrid_ml_parser_service import parse_report_hybrid
from services.ml_report_classifier_service import predict_report_type_ml
from services.parser_service import build_alias_lookup
from services.ml_entity_extraction_service import get_model

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
TEST_DIR = BASE_DIR / "dataset" / "ml_training" / "report_classifier" / "test"
REPORT_PATH = BASE_DIR / "docs" / "ML_Model_Evaluation_Report.md"

# Normalization map for high-level classification
LAB_REPORT_MAP = {
    "fbs": "sugar", "rbs": "sugar", "hba1c": "sugar", "fasting blood sugar": "sugar",
    "random blood sugar": "sugar", "blood sugar": "sugar", "kidney function test": "kft",
    "renal function test": "kft", "renal profile": "kft", "liver function test": "lft",
    "lft report": "lft", "lipid profile": "lipid", "thyroid profile": "thyroid",
    "urine report": "urine", "urine examination": "urine", "cbc": "cbc",
    "complete blood count": "cbc", "cardiac markers": "cardiac"
}

def normalize_label(label):
    if not label: return "unknown"
    label = str(label).lower().strip()
    label = re.sub(r'[^a-z0-9\s]', '', label)
    return LAB_REPORT_MAP.get(label, label)

def normalize_test_row(row):
    """
    Standardizes a test row dictionary to canonical snake_case keys.
    Handles both camelCase and snake_case variants.
    """
    if not isinstance(row, dict): return {}
    
    # 1. Test Name
    name = row.get("test_name") or row.get("testName") or row.get("name") or row.get("test", "Unknown")
    
    # 2. Value
    value = row.get("value")
    if value is None:
        value = row.get("result") or row.get("resultValue") or row.get("result_value")
    
    # 3. Unit
    unit = row.get("unit") or row.get("units", "")
    
    # 4. Range Low/High
    r_low = row.get("range_low")
    if r_low is None:
        r_low = row.get("rangeLow") or row.get("low")
        
    r_high = row.get("range_high")
    if r_high is None:
        r_high = row.get("rangeHigh") or row.get("high")
        
    # 5. Range Text
    r_text = row.get("range_text")
    if r_text is None:
        r_text = row.get("referenceRange") or row.get("reference_range") or row.get("range") or row.get("rangeText") or row.get("refRange") or row.get("normalRange", "")

    # 6. Status
    status = row.get("status") or row.get("interpretation") or row.get("flag", "Unknown")

    return {
        "test_name": str(name),
        "value": value,
        "unit": str(unit),
        "range_low": r_low,
        "range_high": r_high,
        "range_text": str(r_text),
        "status": str(status)
    }

def get_alias_map():
    # Load standard medical aliases from rules
    aliases = build_alias_lookup()
    return {k.lower(): v.lower() for k, v in aliases.items()}

def is_close(a, b, tol=0.015):
    if a is None or b is None: return a == b
    try:
        fa = float(a); fb = float(b)
        if fa > 1000 or fb > 1000: return abs(fa - fb) <= 1.1
        return abs(fa - fb) < tol
    except: return False

def evaluate():
    files = list(TEST_DIR.glob("*.json"))
    if not files:
        print("Error: No test data found.")
        return

    print(f"Evaluating models on {len(files)} test samples...")
    alias_map = get_alias_map()
    
    metrics = {
        "total": 0,
        "type_correct": 0,
        "lab_total": 0,
        "lab_name_acc": 0,
        "lab_value_acc": 0,
        "lab_unit_acc": 0,
        "lab_range_acc": 0,
        "text_total": 0,
        "text_correct": 0,
        "failures": 0
    }

    failed_extractions = []
    
    for f in files:
        try:
            with open(f, "r") as jf:
                gt_data = json.load(jf)
                text = gt_data.get("text_noisy", gt_data.get("text_clean"))
                
                # Run Hybrid Parser
                res = parse_report_hybrid(text)
                
                # 1. Report Type Evaluation
                gt_type = gt_data["report_type"]
                pred_type = res["reportType"]
                is_text_report = "text" in gt_type.lower()
                
                gt_normalized = normalize_label(gt_type)
                pred_normalized = normalize_label(pred_type)
                
                metrics["total"] += 1
                if gt_normalized == pred_normalized:
                    metrics["type_correct"] += 1
                    if is_text_report:
                        metrics["text_correct"] += 1

                if is_text_report:
                    metrics["text_total"] += 1
                    continue

                # 2. Numeric Lab Metrics
                metrics["lab_total"] += 1
                
                gt_tests = [normalize_test_row(t) for t in gt_data.get("tests", [])]
                pred_tests = [normalize_test_row(t) for t in res.get("tests", [])]
                
                pred_map = {}
                for t in pred_tests:
                    std_name = alias_map.get(t["test_name"].lower(), t["test_name"].lower())
                    pred_map[std_name] = t
                
                n_gt = len(gt_tests) if gt_tests else 1
                matches = {"name": 0, "val": 0, "unit": 0, "range": 0}
                
                for gt_t in gt_tests:
                    gt_std_name = alias_map.get(gt_t["test_name"].lower(), gt_t["test_name"].lower())
                    
                    if gt_std_name in pred_map:
                        matches["name"] += 1
                        pt = pred_map[gt_std_name]
                        if is_close(gt_t["value"], pt["value"]): matches["val"] += 1
                        if gt_t["unit"].lower().strip() == pt["unit"].lower().strip(): matches["unit"] += 1
                        if is_close(gt_t["range_low"], pt["range_low"]) and \
                           is_close(gt_t["range_high"], pt["range_high"]): matches["range"] += 1

                metrics["lab_name_acc"] += (matches["name"] / n_gt)
                metrics["lab_value_acc"] += (matches["val"] / n_gt)
                metrics["lab_unit_acc"] += (matches["unit"] / n_gt)
                metrics["lab_range_acc"] += (matches["range"] / n_gt)

                if (matches["range"] / n_gt) < 0.7 or gt_normalized != pred_normalized:
                    failed_extractions.append({
                        "id": gt_data["report_id"],
                        "expected_type": gt_type,
                        "pred_type": pred_type,
                        "name_acc": round(matches["name"] / n_gt, 2),
                        "val_acc": round(matches["val"] / n_gt, 2),
                        "range_acc": round(matches["range"] / n_gt, 2),
                        "missing_tests": [t["test_name"] for t in gt_tests if alias_map.get(t["test_name"].lower(), t["test_name"]).lower() not in pred_map]
                    })

        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"Error evaluating {f.name}: {e}")
            metrics["failures"] += 1

    # Aggregates
    lab_n = max(metrics.get("lab_total", 0), 1)
    text_n = max(metrics.get("text_total", 0), 1)
    total_n = max(metrics.get("total", 0), 1)

    type_acc = metrics["type_correct"] / total_n
    name_acc = metrics.get("lab_name_acc", 0) / lab_n
    val_acc = metrics.get("lab_value_acc", 0) / lab_n
    unit_acc = metrics.get("lab_unit_acc", 0) / lab_n
    range_acc = metrics.get("lab_range_acc", 0) / lab_n
    text_acc = metrics.get("text_correct", 0) / text_n

    print(f"\n--- HIGH-PRECISION EXTRACTION EVALUATION ---")
    print(f"Hybrid Type Accuracy:    {type_acc:.2%}")
    print(f"Numeric Name Extraction: {name_acc:.2%}")
    print(f"Numeric Value Precision: {val_acc:.2%}")
    print(f"Unit Normalization:      {unit_acc:.2%}")
    print(f"Reference Range Accuracy:{range_acc:.2%}")
    print(f"Text Report Accuracy:    {text_acc:.2%}")
    print(f"Failures Logged:         {len(failed_extractions)}")

    # Update Evaluation Report
    with open(REPORT_PATH, "w", encoding="utf-8") as mdf:
        mdf.write("# High-Precision Extraction Evaluation\n\n")
        mdf.write(f"| Metric | Score |\n| :--- | :--- |\n")
        mdf.write(f"| **Hybrid Type Accuracy** | **{type_acc:.2%}** |\n")
        mdf.write(f"| Numeric Name Match | {name_acc:.2%} |\n")
        mdf.write(f"| Numeric Value Precision | {val_acc:.2%} |\n")
        mdf.write(f"| Unit Normalization | {unit_acc:.2%} |\n")
        mdf.write(f"| **Reference Range Accuracy** | **{range_acc:.2%}** |\n")
        mdf.write(f"| Text Report Classification | {text_acc:.2%} |\n\n")
        mdf.write(f"## Metadata\n")
        mdf.write(f"- Test Samples: {len(files)}\n")
        mdf.write(f"- Failures tracked: {len(failed_extractions)}\n")

    summary_path = BASE_DIR / "dataset" / "evaluation_reports" / "ml_evaluation_summary.json"
    with open(summary_path, "w") as sf:
        json.dump({
            "hybrid_type_acc": round(type_acc, 4),
            "extraction_acc": round(name_acc, 4),
            "value_acc": round(val_acc, 4),
            "range_acc": round(range_acc, 4)
        }, sf, indent=2)

    failed_path = BASE_DIR / "dataset" / "evaluation_reports" / "extraction_failed_cases.json"
    with open(failed_path, "w") as ff:
        json.dump(failed_extractions[:100], ff, indent=2)

if __name__ == "__main__":
    evaluate()
