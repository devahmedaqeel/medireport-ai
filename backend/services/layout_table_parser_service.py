import re

# Common table headers for medical reports
TABLE_HEADERS = [
    r"(?P<test>Test|Investigation|Parameter)\s+(?P<result>Result|Observed Value|Value)\s+(?P<unit>Unit)\s+(?P<range>Reference Range|Biological Ref. Interval|Normal Range)",
    r"(?P<test>Test|Investigation)\s+(?P<result>Result)\s+(?P<range>Reference Range|Interval)",
]

NUMBER = r"[-+]?\d+(?:\.\d+)?"

def parse_layout_aware(text: str) -> list:
    """
    Attempts to parse text by identifying table-like rows.
    """
    lines = text.splitlines()
    extracted_tests = []
    
    # 1. Detect if a table header exists to confirm layout
    header_found = False
    for line in lines:
        for pattern in TABLE_HEADERS:
            if re.search(pattern, line, re.I):
                header_found = True
                break
        if header_found: break

    # 2. Extract rows using multi-column regex
    # Pattern: [Test Name] [Value] [Unit] [Range]
    # We use high-spacing or vertical bars as hints
    row_pattern = re.compile(rf"^(?P<name>[\w\s\.\(\)\-\/]+?)\s+(?P<value>{NUMBER})\s*(?P<unit>[\w\/\%]*)\s+(?P<low>{NUMBER})\s*(?:-|–|to)\s*(?P<high>{NUMBER})", re.I)
    
    for line in lines:
        line = line.strip()
        if not line or len(line) < 10: continue
        
        # Try direct row match
        match = row_pattern.search(line)
        if match:
            extracted_tests.append({
                "testName": match.group("name").strip(),
                "value": float(match.group("value")),
                "unit": match.group("unit").strip(),
                "rangeLow": float(match.group("low")),
                "rangeHigh": float(match.group("high")),
                "confidence": 0.85 if header_found else 0.70,
                "method": "layout_table_parser"
            })
            
    return extracted_tests
