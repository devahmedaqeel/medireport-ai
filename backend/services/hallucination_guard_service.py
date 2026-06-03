import re

UNSAFE_PATTERNS = {
    r"\byou\s+have\b": "results may indicate",
    r"\bconfirmed\b": "suggested",
    r"\btake\s+medicine\b": "consult a doctor for guidance",
    r"\bdose\b": "clinical plan",
    r"\btreatment\s+is\b": "management may involve",
    r"\bcancer\s+confirmed\b": "malignancy risk detected",
    r"\bheart\s+attack\s+confirmed\b": "cardiac injury marker elevated",
    r"\bkidney\s+failure\s+confirmed\b": "renal function concern detected",
    r"\bstroke\s+confirmed\b": "urgent brain findings detected",
    r"\bbrain\s+tumor\s+confirmed\b": "intracranial lesion detected",
    r"\bno\s+need\s+to\s+see\s+doctor\b": "always consult a doctor"
}

def sanitize_medical_text(text: str) -> str:
    """Replaces unsafe definitive medical statements with safe educational ones."""
    safe_text = text
    for pattern, replacement in UNSAFE_PATTERNS.items():
        safe_text = re.sub(pattern, replacement, safe_text, flags=re.IGNORECASE)
    
    disclaimer = "This is an educational interpretation, not a clinical diagnosis. Always consult a qualified doctor for confirmation."
    if "doctor" not in safe_text.lower():
        safe_text += f" {disclaimer}"
        
    return safe_text

def validate_extraction_consistency(regex_val, ml_val):
    """Checks if regex and ML agree on numeric values."""
    if regex_val is None or ml_val is None:
        return True
    try:
        return abs(float(regex_val) - float(ml_val)) < 0.01
    except:
        return False
