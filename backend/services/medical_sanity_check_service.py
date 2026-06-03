import re

def sanity_check_value(test_name: str, value: float) -> tuple:
    """
    Checks if a value is medically plausible and attempts corrections.
    Returns (corrected_value, is_suspicious, message)
    """
    name = test_name.lower()
    
    # 1. Hemoglobin: 102 -> 10.2
    if "hemoglobin" in name or "hb" == name:
        if value > 50 and value < 250:
            return value / 10.0, True, "Auto-corrected decimal: 102 -> 10.2"
        if value > 25:
            return value, True, "Extremely high hemoglobin detected."

    # 2. Platelets: 250 -> 250,000 (often reported in 10^3)
    if "platelet" in name:
        if value < 1000:
            return value * 1000, False, "Normalized units (10^3 -> absolute)"
            
    # 3. WBC: 14 -> 14,000
    if "wbc" in name or "tlc" in name:
        if value < 50:
            return value * 1000, False, "Normalized units (10^3 -> absolute)"

    return value, False, ""


def fix_numeric_ocr_typos(text: str) -> str:
    """Fixes common character swaps in numbers like O -> 0 without adding extra spaces."""
    # O to 0
    text = re.sub(r'(\d)O', r'\g<1>0', text)
    text = re.sub(r'O(\d)', r'0\g<1>', text)
    
    # I/l to 1
    text = re.sub(r'(\d)[Il]', r'\g<1>1', text)
    text = re.sub(r'[Il](\d)', r'1\g<1>', text)
    
    return text
