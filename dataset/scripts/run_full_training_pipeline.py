import os
import sys
import subprocess
from pathlib import Path
from datetime import datetime
import json

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
SCRIPTS_DIR = BASE_DIR / "dataset" / "scripts"
VERSION_FILE = BASE_DIR / "backend" / "models" / "version.json"

def run_script(script_name):
    print(f"\n>>> Running {script_name}...")
    path = SCRIPTS_DIR / script_name
    res = subprocess.run([sys.executable, str(path)], capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Error in {script_name}: {res.stderr}")
        return False
    print(res.stdout)
    return True

def main():
    print("==========================================")
    print("MEDIREPORT AI: FULL TRAINING PIPELINE")
    print("==========================================")
    
    # 1. Generate Data
    if not run_script("generate_synthetic_reports.py"): return

    # 2. Batch Process
    if not run_script("ocr_batch_processor.py"): return

    # 3. Convert to Annotations
    if not run_script("convert_ocr_to_annotation.py"): return

    # 4. Train Heuristics
    if not run_script("train_parser_model.py"): return

    # 5. Run Evaluations
    run_script("evaluate_report_detection.py")
    run_script("evaluate_parser_accuracy.py")
    run_script("evaluate_status_accuracy.py")
    run_script("evaluate_indication_precision.py")
    
    # 6. Full Evaluation & Report
    if not run_script("run_full_evaluation.py"): return

    print("\n==========================================")
    print("PIPELINE COMPLETE. System Accuracy Updated.")
    print("==========================================")

if __name__ == "__main__":
    main()
