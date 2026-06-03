import re
from services.value_extraction_service import extract_numeric_value, clean_numeric_text
from services.unit_extraction_service import extract_unit_from_text, normalize_unit
from services.range_extraction_service import extract_range_details

def parse_line_as_test_row(line: str, aliases: dict) -> dict:
    """
    High-precision line-based parser using a deterministic "detect and mask" strategy.
    Order: 1. Name, 2. Range (End of line or after keyword), 3. Unit, 4. Value (Remainder)
    """
    if not line or len(line) < 4: return None
    
    # 0. Preliminary character fixes
    line = clean_numeric_text(line)
    
    # 1. Clean line basics (preserving colons for name splitting)
    clean_line = " ".join(line.replace("|", " ").replace("[", " ").replace("]", " ").split())
    lower_line = clean_line.lower()
    
    # 2. Detect Test Name from Alias Dictionary
    sorted_aliases = sorted(aliases.keys(), key=len, reverse=True)
    test_name = None
    detected_alias = None
    
    for alias in sorted_aliases:
        pattern = rf"\b{re.escape(alias.lower())}\b"
        if re.search(pattern, lower_line):
            alias_value = aliases.get(alias)
            if isinstance(alias_value, dict):
                test_name = alias_value.get("standard_name") or alias_value.get("name") or alias
            else:
                test_name = alias_value or alias
            detected_alias = alias
            break
            
    if not test_name:
        # Fallback to simple containment for noisy text (only for aliases with length >= 4 to avoid false positives)
        for alias in sorted_aliases:
            if len(alias) >= 4 and alias.lower() in lower_line:
                alias_value = aliases.get(alias)
                if isinstance(alias_value, dict):
                    test_name = alias_value.get("standard_name") or alias_value.get("name") or alias
                else:
                    test_name = alias_value or alias
                detected_alias = alias
                break

    if not test_name: return None

    # 3. Focus on what comes AFTER the test name
    # We split by detected alias
    alias_start = lower_line.find(detected_alias.lower())
    after_name = clean_line[alias_start + len(detected_alias):].strip()
    
    # Handle colon format
    after_name = re.sub(r'^[:|\|\-\s]+', '', after_name)
    
    if not after_name and not any(q in lower_line for q in ["negative", "positive", "nil", "trace"]):
        return None

    # 4. Detect Range at END of line first
    range_info = extract_range_details(after_name)
    
    # 5. Mask Range to avoid picking range bounds as result values
    val_search_area = after_name
    if range_info["range_text"]:
        # Case-insensitive masking
        pattern = re.compile(re.escape(range_info["range_text"]), re.IGNORECASE)
        val_search_area = pattern.sub(" ", val_search_area)
    
    # Also mask range keywords specifically
    range_keywords = [
        "Reference Range", "Normal Range", "Biological Ref Interval",
        "Ref Range", "Normal", "Ref", "Range"
    ]
    for kw in range_keywords:
        pattern = re.compile(rf"\b{re.escape(kw)}\b", re.IGNORECASE)
        val_search_area = pattern.sub(" ", val_search_area)

    # 6. Extract Unit
    unit = extract_unit_from_text(val_search_area)
    normalized_unit = normalize_unit(unit)
    
    # Mask Unit
    if unit:
        pattern = re.compile(re.escape(unit), re.IGNORECASE)
        val_search_area = pattern.sub(" ", val_search_area)

    # 7. Extract Result Value from remaining line
    value = extract_numeric_value(val_search_area)

    if value is None and range_info["range_type"] != "qualitative":
        return None

    # 8. Consistent Keys (Canonical snake_case + Alias camelCase)
    return {
        "test_name": test_name,
        "testName": test_name,
        "value": value,
        "unit": normalized_unit or unit,
        "range_low": range_info["range_low"],
        "rangeLow": range_info["range_low"],
        "range_high": range_info["range_high"],
        "rangeHigh": range_info["range_high"],
        "range_text": range_info["range_text"] or "Not detected",
        "rangeText": range_info["range_text"] or "Not detected",
        "referenceRange": range_info["range_text"] or "Not detected",
        "range_type": range_info["range_type"],
        "status": "Unknown",
        "confidence": round(0.85 + (0.1 if range_info["range_text"] else 0), 2),
        "method": "line_table_parser",
        "raw_line": line
    }
