import pytest
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

from services.analysis_service import analyze_structured_report, calculate_health_metrics

def test_status_logic():
    # Test normal
    report = {
        "tests": [
            {"test_name": "Hemoglobin", "value": 14.5, "min_range": 13.0, "max_range": 17.0}
        ]
    }
    res = analyze_structured_report(report)
    assert res["tests"][0]["status"] == "normal"
    
    # Test low
    report = {
        "tests": [
            {"test_name": "Hemoglobin", "value": 10.2, "min_range": 13.0, "max_range": 17.0}
        ]
    }
    res = analyze_structured_report(report)
    assert res["tests"][0]["status"] == "low"
    
    # Test high
    report = {
        "tests": [
            {"test_name": "White Blood Cells", "value": 15000.0, "min_range": 4000.0, "max_range": 11000.0}
        ]
    }
    res = analyze_structured_report(report)
    assert res["tests"][0]["status"] == "high"

def test_risk_calculation():
    # Test Low Risk
    tests = [
        {"test_name": "Hemoglobin", "value": 14.5, "min_range": 13.0, "max_range": 17.0, "confidence": "high"}
    ]
    score, risk, needs_review = calculate_health_metrics(tests)
    assert risk == "Low Risk"
    assert score == 100
    
    # Test Moderate Risk
    tests = [
        {"test_name": "Hemoglobin", "value": 10.2, "min_range": 13.0, "max_range": 17.0, "confidence": "high", "status": "low"},
        {"test_name": "White Blood Cells", "value": 15000.0, "min_range": 4000.0, "max_range": 11000.0, "confidence": "high", "status": "high"}
    ]
    score, risk, needs_review = calculate_health_metrics(tests)
    assert risk == "Moderate Risk"
    assert score == 80
    
    # Test Critical Risk (if high confidence critical is present)
    tests = [
        {"test_name": "Hemoglobin", "value": 6.5, "min_range": 13.0, "max_range": 17.0, "confidence": "high", "status": "low"}
    ]
    score, risk, needs_review = calculate_health_metrics(tests)
    assert risk == "Critical Risk"
    assert score == 75
