import os
import sys
import json
from pathlib import Path

# Add backend to path
sys.path.append(str(Path(__file__).resolve().parent.parent.parent / "backend"))

from services.parser_service import parse_report_text

def main():
    base_dir = Path(__file__).resolve().parent.parent
    anon_dir = base_dir / "anonymized_reports"
    output_dir = base_dir / "ocr_outputs"
    output_dir.mkdir(exist_ok=True)
    
    files = list(anon_dir.glob("*.txt"))
    print(f"Batch processing {len(files)} reports...")
    
    for f in files:
        with open(f, "r") as tf: text = f.read()
        parsed = parse_report_text(text)
        
        with open(output_dir / f"{f.stem}.json", "w") as out:
            json.dump(parsed, out, indent=2)
            
    print(f"Batch OCR processing complete. Results in {output_dir}")

if __name__ == "__main__":
    main()
