import pytest
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

from services.ocr_correction_service import correct_ocr_text

def test_ocr_corrections():
    cases = [
        ("Hemoglobin 1O.2", "Hemoglobin 10.2"),
        ("W8C 14OOO", "WBC 14000"),
        ("mg/di", "mg/dL"),
        ("H6 12.5", "Hb 12.5"),
    ]
    
    for input_text, expected in cases:
        res = correct_ocr_text(input_text)
        assert expected in res["corrected_text"]
