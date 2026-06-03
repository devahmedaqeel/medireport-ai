import re

def correct_ocr_text(text: str) -> dict:
    original = text
    
    # Common OCR name swaps
    text = re.sub(r'\bW8C\b', 'WBC', text, flags=re.IGNORECASE)
    text = re.sub(r'\bH6\b', 'Hb', text, flags=re.IGNORECASE)
    
    # numeric context corrections (loop to handle consecutive characters like OOO or lll)
    old_text = ""
    while old_text != text:
        old_text = text
        text = re.sub(r'(\d)O', r'\g<1>0', text)
        text = re.sub(r'O(\d)', r'0\g<1>', text)
        text = re.sub(r'(\d)[Il]', r'\g<1>1', text)
        text = re.sub(r'[Il](\d)', r'1\g<1>', text)
    
    # Decimal numbers: e.g. 1O.2 -> 10.2
    text = re.sub(r'(\d)O\.', r'\g<1>0.', text)
    text = re.sub(r'\.O(\d)', r'.0\g<1>', text)
    
    # Unit normalization
    replacements = {
        r'\bmg/di\b': 'mg/dL',
        r'\bg/di\b': 'g/dL',
        r'\bmmoI/L\b': 'mmol/L',
    }
    for p, r in replacements.items():
        text = re.sub(p, r, text, flags=re.IGNORECASE)
        
    # Extra spaces and broken decimals
    text = re.sub(r'(\d{1,3})\s+(\d)\b', r'\1.\2', text) # 10 2 -> 10.2
    
    return {
        "corrected_text": text,
        "correction_confidence": 0.95 if original == text else 0.85,
        "applied": original != text
    }
