import json
import os
from pathlib import Path

def analyze_failures():
    base_dir = Path(__file__).resolve().parent.parent
    failed_path = base_dir / "evaluation_reports" / "failed_cases.json"
    
    if not failed_path.exists():
        print("No failed cases to analyze.")
        return

    with open(failed_path, "r") as f:
        failures = json.load(f)

    suggestions = []
    print(f"Analyzing {len(failures)} failures...")

    for case in failures:
        # Example analysis logic
        fix = {
            "report_id": case.get("report_id"),
            "category": "Extraction",
            "suggestion": "Check if alias is missing in test_aliases.json or if regex is too weak."
        }
        
        if case.get("report_type_expected") != case.get("report_type_predicted"):
            fix["category"] = "Classification"
            fix["suggestion"] = "Increase weighted score for keywords in report_type_detection_service.py"
            
        suggestions.append(fix)

    # Save suggestions
    with open(base_dir / "evaluation_reports" / "fix_suggestions.json", "w") as f:
        json.dump(suggestions, f, indent=2)
        
    print(f"Analysis complete. Fix suggestions saved to evaluation_reports/fix_suggestions.json")

if __name__ == "__main__":
    analyze_failures()
