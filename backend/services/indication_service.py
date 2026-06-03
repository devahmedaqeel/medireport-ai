from services.rule_loader import load_json_rule


def add_indications(report: dict):
    rules = load_json_rule("abnormal_rules.json")
    patterns = load_json_rule("pattern_rules.json")
    
    tests = report.get("tests", [])
    # Case-insensitive mapping for robust lookup
    test_map = {}
    for t in tests:
        name = t.get("testName") or t.get("test_name") or ""
        if name:
            test_map[name.lower().strip()] = t
    
    # 1. Single Marker Interpretation
    for test in tests:
        name = test.get("testName") or test.get("test_name") or "Unknown"
        status_raw = test.get("status") or "Unknown"
        status = status_raw.lower().strip()
        
        # Look up in rules using Title Case (e.g. "Low", "High")
        rule = rules.get(name, {}).get(status_raw.title())
        if not rule:
            # Fallback check standard test name variants
            for rule_name, rule_data in rules.items():
                if name.lower().strip() == rule_name.lower().strip():
                    rule = rule_data.get(status_raw.title())
                    break
        
        if rule:
            test["possibleIndication"] = rule.get("possible_indication") or rule.get("possibleIndication") or "Consult doctor"
            test["safeExplanation"] = rule.get("english_explanation") or rule.get("safeExplanation") or f"{name} is abnormal."
            test["romanUrduExplanation"] = rule.get("roman_urdu_explanation") or rule.get("romanUrduExplanation") or ""
            test["severity"] = rule.get("urgency") or rule.get("severity") or "medium"
        elif status == "normal":
            test["possibleIndication"] = "No abnormal indication"
            test["safeExplanation"] = f"{name} is within the normal reference range."
            test["romanUrduExplanation"] = f"{name} normal range mein hai."
            test["severity"] = "low"
        elif status == "needs_review":
            test["possibleIndication"] = "Reference range not detected"
            test["safeExplanation"] = "Reference range not detected. Please verify with original report."
            test["romanUrduExplanation"] = "Reference range nahi mila. Bara-e-meharbani check karein."
            test["severity"] = "unknown"
        else:
            test["possibleIndication"] = "Consult doctor"
            test["safeExplanation"] = "The app could not safely interpret this specific value."
            test["severity"] = "unknown"

    # 2. Pattern-based Interpretation
    detected_patterns = []
    for p in patterns:
        match = True
        for cond in p["conditions"]:
            cond_test_name = cond["testName"].lower().strip()
            test = test_map.get(cond_test_name)
            if not test or (test.get("status") or "").lower().strip() != cond["status"].lower().strip():
                match = False
                break
        
        if match:
            detected_patterns.append({
                "name": p["name"],
                "english": p["english"],
                "romanUrdu": p["romanUrdu"],
                "severity": p["severity"]
            })
            
    report["patterns"] = detected_patterns
    return report
