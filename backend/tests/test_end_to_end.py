import pytest
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

from services.parser_service import parse_report_text
from services.analysis_service import analyze_structured_report
from services.explanation_service import build_explanation

def test_end_to_end_logic():
    ocr_text = """
    Complete Blood Count
    Hemoglobin 10.2 g/dL (13.0 - 17.0)
    White Blood Cells 15000 /cmm (4000 - 11000)
    Platelets 250000 /cmm (150000 - 450000)
    """
    
    # 1. Parse
    parsed = parse_report_text(ocr_text)
    assert parsed["reportType"] == "CBC"
    
    # 2. Analyze
    analyzed = analyze_structured_report(parsed)
    hb = next(t for t in analyzed["tests"] if t["testName"] == "Hemoglobin")
    assert hb["status"] == "low"
    
    # 3. Explain
    explained = build_explanation(analyzed)
    assert "englishExplanation" in explained
    assert "romanUrduExplanation" in explained
    assert "disclaimer" in explained["safetyDisclaimer"].lower() or "diagnosis" in explained["safetyDisclaimer"].lower()
