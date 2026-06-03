import re

UNIT_MAP = {
    "mg/dl": "mg/dL",
    "mg/di": "mg/dL",
    "g/dl": "g/dL",
    "g/di": "g/dL",
    "u/l": "U/L",
    "iu/l": "IU/L",
    "mmol/l": "mmol/L",
    "uiu/ml": "uIU/mL",
    "ng/ml": "ng/mL",
    "ng/l": "ng/L",
    "/cumm": "/cmm",
    "/cmm": "/cmm",
    "cells/cumm": "/cmm",
    "cells/cmm": "/cmm",
    "/cubic mm": "/cmm",
    "10^3/ul": "x10^3/uL",
    "fL": "fL",
    "pg": "pg",
    "ratio": "ratio",
    "%": "%"
}

def normalize_unit(unit_text: str) -> str:
    """
    Normalizes unit strings to clinical standards.
    """
    if not unit_text: return ""
    
    clean = unit_text.lower().strip().replace(" ", "")
    if clean in UNIT_MAP:
        return UNIT_MAP[clean]
    
    for key, val in UNIT_MAP.items():
        if key in clean:
            return val
            
    return unit_text.strip()

def extract_unit_from_text(text: str) -> str:
    """Finds and normalizes unit from raw text line."""
    # Task 1: Use UNIT_MAP keys (raw variants) to find unit in text
    # Sort keys by length descending to match longest first
    sorted_variants = sorted(UNIT_MAP.keys(), key=len, reverse=True)
    
    lower_text = text.lower()
    for variant in sorted_variants:
        # Match variant with some boundary or spacing
        if variant in lower_text:
            return variant
            
    return ""
