import sys
from pathlib import Path

# Add backend to path so we can import services
sys.path.append(str(Path(__file__).resolve().parent.parent))

from services.parser_service import detect_report_type

def test_report_detection():
    test_cases = [
        {
            "name": "FBS Report",
            "text": "Laboratory Report\nGlucose Fasting: 110 mg/dL\nFasting Blood Sugar\nRef Range: 70-100",
            "expected": "Fasting Blood Sugar"
        },
        {
            "name": "CBC Report",
            "text": "Complete Blood Count\nHemoglobin: 14.2 g/dL\nWBC: 7500 /cmm\nPlatelets: 250,000",
            "expected": "CBC"
        },
        {
            "name": "Lipid Profile",
            "text": "Lipid Profile\nCholesterol Total: 190\nLDL: 110\nHDL: 45\nTriglycerides: 140",
            "expected": "Lipid Profile"
        },
        {
            "name": "HbA1c Report",
            "text": "Glycated Hemoglobin\nHbA1c: 6.2%\nAverage Blood Glucose: 120",
            "expected": "HbA1c"
        },
        {
            "name": "Kidney Function Test",
            "text": "Renal Profile\nCreatinine: 0.9 mg/dL\nUrea: 30\nUric Acid: 5.5",
            "expected": "Kidney Function Test"
        },
        {
            "name": "Liver Function Test",
            "text": "LFT Report\nALT (SGPT): 35 U/L\nAST (SGOT): 30\nBilirubin Total: 0.8",
            "expected": "Liver Function Test"
        },
        {
            "name": "Thyroid Profile",
            "text": "Thyroid Stimulating Hormone (TSH): 2.5 mIU/L\nT3: 120\nT4: 8.5",
            "expected": "Thyroid Profile"
        },
        {
            "name": "Urine Report",
            "text": "Urine Examination\nProtein: Negative\nGlucose: Nil\nPus Cells: 1-2 /HPF",
            "expected": "Urine Report"
        }
    ]

    print("\n--- Running Report Type Detection Tests ---")
    passed = 0
    for case in test_cases:
        result_dict = detect_report_type(case["text"])
        result_type = result_dict.get("report_type", "")
        
        is_match = False
        if case["expected"] == "Fasting Blood Sugar" and result_type == "Diabetes/Blood Sugar":
            is_match = True
        elif case["expected"] == "HbA1c" and result_type == "Diabetes/Blood Sugar":
            is_match = True
        elif case["expected"] == "Kidney Function Test" and result_type == "KFT":
            is_match = True
        elif case["expected"] == "Liver Function Test" and result_type == "LFT":
            is_match = True
        elif case["expected"] == "Urine Report" and result_type == "Urine Test":
            is_match = True
        elif case["expected"].lower() in result_type.lower() or result_type.lower() in case["expected"].lower():
            is_match = True
            
        if is_match:
            print(f"✅ {case['name']}: Detected as {result_type}")
            passed += 1
        else:
            print(f"❌ {case['name']}: FAILED! Expected {case['expected']}, got {result_type} (Dict: {result_dict})")

    print(f"\nSummary: {passed}/{len(test_cases)} tests passed.")
    assert passed == len(test_cases)

if __name__ == "__main__":
    test_report_detection()
