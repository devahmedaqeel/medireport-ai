import re

def fallback_extract(text: str) -> dict:
    """
    Extremely simple, deterministic extractor for backup when normal parsing is low confidence.
    """
    report_type = "Unsupported"
    if "cbc" in text.lower(): report_type = "CBC"
    elif "sugar" in text.lower() or "fbs" in text.lower(): report_type = "Blood Sugar"
    
    tests = []
    # Very crude key-value search
    lines = text.splitlines()
    for line in lines:
        if ":" in line:
            parts = line.split(":")
            name = parts[0].strip()
            # find first number
            nums = re.findall(r"[-+]?\d+(?:\.\d+)?", parts[1])
            if nums:
                tests.append({
                    "testName": name,
                    "value": float(nums[0]),
                    "confidence": 0.50,
                    "method": "fallback_extractor"
                })
                
    return {
        "reportType": report_type,
        "tests": tests,
        "overall_confidence": 0.40
    }
