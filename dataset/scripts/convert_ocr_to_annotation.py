import os
import json
from pathlib import Path

def main():
    base_dir = Path(__file__).resolve().parent.parent
    ocr_dir = base_dir / "ocr_outputs"
    anno_dir = base_dir / "annotations"
    anno_dir.mkdir(exist_ok=True)
    
    for ocr_file in ocr_dir.glob("*.json"):
        with open(ocr_file, "r") as f: data = json.load(f)
        
        annotation = {
            "report_id": ocr_file.stem,
            "report_type": data["reportType"],
            "source": "ocr_extraction",
            "tests": []
        }
        
        for t in data["tests"]:
            annotation["tests"].append({
                "test_name": t["testName"],
                "value": t["value"],
                "unit": t["unit"],
                "confidence": t["confidence"]
            })
            
        with open(anno_dir / f"{ocr_file.name}", "w") as out:
            json.dump(annotation, out, indent=2)
            
    print(f"Converted {len(list(ocr_dir.glob('*.json')))} OCR outputs to annotations.")

if __name__ == "__main__":
    main()
