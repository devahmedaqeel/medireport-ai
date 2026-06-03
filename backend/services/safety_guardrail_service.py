import re

UNSAFE_PHRASES = {
    r"\byou\s+have\b": "results may indicate",
    r"\bconfirmed\b": "suggested",
    r"\btake\s+(?:\w+\s+){0,3}medicine\b": "consult a doctor for treatment",
    r"\bdose\b": "clinical plan",
    r"\btreatment\s+is\b": "management may involve",
    r"\bno\s+need\s+to\s+see\s+doctor\b": "always consult a doctor",
    r"\byou\s+are\s+suffering\s+from\b": "markers may be associated with",
    r"\bdiagnosis\b": "educational interpretation"
}

def validate_medical_response(text: str) -> str:
    """
    Sanitizes responses to ensure they follow medical safety rules.
    Blocks diagnoses, prescriptions, and definitive statements.
    """
    safe_text = text
    
    # 1. Replace specific unsafe phrases
    for pattern, replacement in UNSAFE_PHRASES.items():
        safe_text = re.sub(pattern, replacement, safe_text, flags=re.IGNORECASE)
        
    # 2. Force mandatory safety disclaimer if missing
    disclaimer = "This app does NOT provide a final medical diagnosis. Always consult a qualified doctor."
    if "doctor" not in safe_text.lower():
        safe_text += f" {disclaimer}"
        
    return safe_text

def apply_guardrails_to_report(report: dict) -> dict:
    """
    Applies guardrails to all textual fields in the report explanation.
    """
    if "englishExplanation" in report:
        report["englishExplanation"] = validate_medical_response(report["englishExplanation"])
        
    if "romanUrduExplanation" in report:
        # Simple Urdu sanitization (checking for common definitive words)
        report["romanUrduExplanation"] = report["romanUrduExplanation"].replace("aap ko", "mumkina taur par")
        if "doctor" not in report["romanUrduExplanation"].lower():
            report["romanUrduExplanation"] += " Baraye meharbani doctor se ruju karein."
            
    return report
