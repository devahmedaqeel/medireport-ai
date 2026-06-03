# Semi-automatic annotation helper.
# Usage: put OCR .txt files in dataset/ocr_outputs, then run this script to create starter JSON.
from pathlib import Path
import json, sys
sys.path.append(str(Path(__file__).resolve().parents[2] / "backend"))
from services.parser_service import parse_report_text

ROOT = Path(__file__).resolve().parents[1]
OCR = ROOT / "ocr_outputs"
OUT = ROOT / "annotations"
OUT.mkdir(parents=True, exist_ok=True)
for p in OCR.glob("*.txt"):
    parsed = parse_report_text(p.read_text(encoding="utf-8"))
    (OUT / f"{p.stem}.json").write_text(json.dumps(parsed, indent=2), encoding="utf-8")
print("Starter annotations created. Manually verify before training/testing.")
