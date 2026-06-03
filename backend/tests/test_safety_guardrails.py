import pytest
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

from services.safety_guardrail_service import validate_medical_response

def test_safety_guardrails():
    unsafe_text = "You have diabetes. Take this medicine."
    safe_text = validate_medical_response(unsafe_text)
    
    assert "you have" not in safe_text.lower()
    assert "take this medicine" not in safe_text.lower()
    assert "may indicate" in safe_text.lower() or "results may indicate" in safe_text.lower()
    assert "doctor" in safe_text.lower()
