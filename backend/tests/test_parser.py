import pytest
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

from services.parser_service import detect_report_type, parse_report_text

def test_report_type_detection():
    cbc_text = "Complete Blood Count Hemoglobin 14.2 WBC 7000 Platelets 200000"
    sugar_text = "Fasting Blood Sugar Glucose 110 mg/dL"
    
    cbc_res = detect_report_type(cbc_text)
    sugar_res = detect_report_type(sugar_text)
    
    assert "CBC" in cbc_res["report_type"]
    assert "Sugar" in sugar_res["report_type"]
    assert cbc_res["confidence"] > 0.5
    assert sugar_res["confidence"] > 0.5

def test_extraction_logic():
    text = "Hemoglobin 12.5 g/dL (13.0 - 17.0)"
    parsed = parse_report_text(text)
    
    found_hb = False
    for t in parsed["tests"]:
        if t["testName"] == "Hemoglobin":
            found_hb = True
            assert t["value"] == 12.5
            assert t["unit"] == "g/dL"
            assert t["rangeLow"] == 13.0
            assert t["rangeHigh"] == 17.0
    
    assert found_hb
