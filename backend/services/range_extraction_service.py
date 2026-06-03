import re

NUMBER = r"[-+]?\d+(?:\.\d+)?"

RANGE_PATTERNS = {
    "between": re.compile(rf"(?P<low>{NUMBER})\s*(?:-|–|to)\s*(?P<high>{NUMBER})", re.I),
    "less_than": re.compile(rf"(?:less\s+than|<)\s*(?P<high>{NUMBER})", re.I),
    "greater_than": re.compile(rf"(?:greater\s+than|>)\s*(?P<low>{NUMBER})", re.I),
    "upto": re.compile(rf"(?:up\s+to)\s*(?P<high>{NUMBER})", re.I),
    "male_female": re.compile(rf"(?:M|Male):\s*(?P<m_low>{NUMBER})-(?P<m_high>{NUMBER}).*?(?:F|Female):\s*(?P<f_low>{NUMBER})-(?P<f_high>{NUMBER})", re.I),
    "adult": re.compile(rf"(?:Adult|Age):\s*(?P<low>{NUMBER})\s*-\s*(?P<high>{NUMBER})", re.I)
}

QUALITATIVE_VALUES = ["negative", "positive", "nil", "trace", "normal", "absent", "present"]

def extract_range_details(text: str) -> dict:
    """
    Parses complex reference range strings from OCR text.
    Handles noisy spaces, common OCR numeric errors, and qualitative values.
    """
    res = {
        "range_low": None,
        "range_high": None,
        "range_type": "unknown",
        "range_text": "",
        "range_confidence": 0.0
    }
    
    if not text: return res
    
    # Remove leading keywords to simplify matching
    clean_text = re.sub(r'^(?:Ref|Reference|Normal|Biological|Interval|Range)[:\s]+', '', text, flags=re.I)
    
    # 1. Qualitative check (prior to replacing 'l' with '1' to avoid breaking words like 'nil')
    lower_text = clean_text.lower()
    for q in QUALITATIVE_VALUES:
        if q in lower_text:
            res["range_type"] = "qualitative"
            res["range_text"] = q.capitalize()
            res["range_confidence"] = 0.95
            return res

    # Task 3: Normalize OCR characters inside numeric context
    # Clean OCR numeric noise (O -> 0, etc.)
    clean_text = clean_text.replace("O", "0").replace("I", "1").replace("l", "1")

    # Clean numeric spacing inside range bounds (e.g. "12 0" -> "12.0")
    clean_text = re.sub(r'(?<!\.)\b(\d{1,2}) (\d)\b', r'\1.\2', clean_text)

    # 2. Male/Female specific
    m = RANGE_PATTERNS["male_female"].search(clean_text)
    if m:
        res["range_low"] = float(m.group("m_low"))
        res["range_high"] = float(m.group("m_high"))
        res["range_type"] = "between"
        res["range_text"] = f"M:{m.group('m_low')}-{m.group('m_high')} F:{m.group('f_low')}-{m.group('f_high')}"
        res["range_confidence"] = 0.95
        return res

    # 3. Adult specific
    m = RANGE_PATTERNS["adult"].search(clean_text)
    if m:
        res["range_low"] = float(m.group("low"))
        res["range_high"] = float(m.group("high"))
        res["range_type"] = "between"
        res["range_text"] = f"Adult:{m.group('low')}-{m.group('high')}"
        res["range_confidence"] = 0.95
        return res

    # 4. Standard Between Range (e.g. 70-100, 0.7-1.3)
    m = RANGE_PATTERNS["between"].search(clean_text)
    if m:
        try:
            res["range_low"] = float(m.group("low"))
            res["range_high"] = float(m.group("high"))
            res["range_type"] = "between"
            res["range_text"] = f"{m.group('low')}-{m.group('high')}"
            res["range_confidence"] = 0.90
            return res
        except: pass
        
    # 5. Less Than
    m = RANGE_PATTERNS["less_than"].search(clean_text)
    if m:
        try:
            res["range_high"] = float(m.group("high"))
            res["range_type"] = "less_than"
            res["range_text"] = f"<{m.group('high')}"
            res["range_confidence"] = 0.90
            return res
        except: pass

    # 6. Greater Than
    m = RANGE_PATTERNS["greater_than"].search(clean_text)
    if m:
        try:
            res["range_low"] = float(m.group("low"))
            res["range_high"] = 999999.0
            res["range_type"] = "greater_than"
            res["range_text"] = f">{m.group('low')}"
            res["range_confidence"] = 0.90
            return res
        except: pass
        
    return res
