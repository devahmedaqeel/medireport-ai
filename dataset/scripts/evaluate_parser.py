from pathlib import Path
import json, sys
sys.path.append(str(Path(__file__).resolve().parents[2] / "backend"))
from services.parser_service import parse_report_text
from services.analysis_service import analyze_structured_report

ROOT = Path(__file__).resolve().parents[1]
TXT = ROOT / "synthetic_reports"
ANN = ROOT / "annotations"

def main():
    total = 0; correct_name = 0; correct_status = 0
    for txt_file in TXT.glob("*.txt"):
        ann_file = ANN / (txt_file.stem + ".json")
        if not ann_file.exists(): continue
        expected = json.loads(ann_file.read_text(encoding="utf-8"))
        parsed = analyze_structured_report(parse_report_text(txt_file.read_text(encoding="utf-8")))
        expected_names = {t["testName"].lower(): t for t in expected["tests"]}
        for t in parsed["tests"]:
            total += 1
            if t["testName"].lower() in expected_names:
                correct_name += 1
                if t["status"] == expected_names[t["testName"].lower()]["status"]:
                    correct_status += 1
    print({
        "total_extracted": total,
        "test_name_accuracy": round(correct_name / total, 3) if total else 0,
        "status_accuracy": round(correct_status / total, 3) if total else 0,
    })

if __name__ == "__main__":
    main()
