import re
from rapidfuzz import process, fuzz
from services.rule_loader import load_json_rule
from services.ocr_correction_service import correct_ocr_text
from services.memory_service import get_verified_aliases, get_ocr_corrections
from services.layout_table_parser_service import parse_layout_aware
from services.confidence_voting_service import vote_on_results
from services.medical_sanity_check_service import sanity_check_value, fix_numeric_ocr_typos
from typing import Optional

NUMBER = r"[-+]?\d+(?:\.\d+)?"
RANGE_PATTERNS = [
    re.compile(rf"(?P<low>{NUMBER})\s*(?:-|–|to)\s*(?P<high>{NUMBER})", re.I),
    re.compile(rf"(?:up\s+to|less\s+than|<)\s*(?P<high>{NUMBER})", re.I),
    re.compile(rf"(?:greater\s+than|>)\s*(?P<low>{NUMBER})", re.I),
]

# Comprehensive LOINC mapping for common lab tests
LOINC_MAP = {
    "Hemoglobin": "718-7",
    "White Blood Cells": "6690-2",
    "WBC": "6690-2",
    "Red Blood Cells": "789-8",
    "RBC": "789-8",
    "Platelets": "777-3",
    "Hematocrit": "4544-3",
    "MCV": "787-2",
    "MCH": "785-6",
    "MCHC": "786-4",
    "RDW-CV": "28886-0",
    "RDW-SD": "788-0",
    "ESR": "30341-2",
    "Fasting Blood Sugar": "1558-6",
    "Random Blood Sugar": "2345-7",
    "Glucose": "2345-7",
    "HbA1c": "4548-4",
    "Cholesterol": "2093-3",
    "Triglycerides": "2571-8",
    "HDL": "2085-9",
    "LDL": "18262-6",
    "VLDL": "13457-7",
    "Creatinine": "2160-0",
    "Urea": "11065-0",
    "Uric Acid": "3084-0",
    "BUN": "3094-0",
    "eGFR": "33914-3",
    "ALT": "1920-8",
    "AST": "1924-0",
    "ALP": "6768-6",
    "Bilirubin Total": "1975-2",
    "Albumin": "1751-7",
    "Total Protein": "2885-2",
    "GGT": "2324-2",
    "TSH": "11579-0",
    "T3": "3050-2",
    "T4": "3026-2",
    "Free T3": "3051-0",
    "Free T4": "3054-4",
    "Vitamin D": "62292-8",
    "Vitamin B12": "2132-9",
    "CRP": "1988-5",
    "Sodium": "2951-2",
    "Potassium": "2823-3",
    "Chloride": "2075-0",
    "Specific Gravity": "5811-5",
    "Pus Cells": "5798-4",
    "pH": "5803-2",
}

# Section heading keywords for section detection
SECTION_KEYWORDS = {
    "Hematology": ["hematology", "blood count", "complete blood"],
    "Biochemistry": ["biochemistry", "clinical chemistry"],
    "Lipid Profile": ["lipid profile", "cholesterol", "serum lipid"],
    "Renal Function": ["renal function", "kidney function", "kft", "rft"],
    "Liver Function": ["liver function", "lft", "hepatic profile"],
    "Thyroid Function": ["thyroid profile", "thyroid function"],
    "Urine Examination": ["urine examination", "urinalysis", "clinical pathology"],
    "Diabetes": ["diabetes", "blood sugar", "glycated"],
}


def normalize_line(line: str) -> str:
    """Clean OCR delimiters and normalize whitespace."""
    line = line.replace("|", " ").replace(":", " ").replace(";", " ").replace("=", " ")
    line = re.sub(r'\s+', ' ', line).strip()
    return line


def detect_sections(text: str) -> list:
    lines = text.splitlines()
    detected = []
    for i, line in enumerate(lines):
        lower = line.lower()
        for section, keywords in SECTION_KEYWORDS.items():
            if any(k in lower for k in keywords):
                detected.append({"name": section, "line_index": i})
    return detected


def detect_report_type(text: str) -> dict:
    """
    Detects the report type from raw OCR text using keyword scoring.
    Supports: CBC, LFT, KFT, Lipid Profile, Thyroid Profile,
              Diabetes/Blood Sugar, Urine Test, Prescription, General Lab Report.
    """
    lower = text.lower()

    # Prescription indicators
    rx_keywords = [
        "tab.", "cap.", "syp.", "inj.", "tablet", "tablets",
        "capsule", "capsules", "mg daily", "once daily", "twice daily",
        "prescription", "take daily", "prescribed"
    ]
    rx_cnt = 0
    for kw in rx_keywords:
        if kw.endswith("."):
            if kw in lower:
                rx_cnt += 1
        else:
            if re.search(rf"\b{re.escape(kw)}\b", lower):
                rx_cnt += 1

    # Lab biomarker keyword lists
    cbc_keywords = [
        "hemoglobin", "hgb", "wbc", "rbc", "platelet", "platelets",
        "plt", "mcv", "mch", "mchc", "hematocrit", "pcv", "rdw", "tlc",
        "complete blood count", "full blood count"
    ]
    lft_keywords = [
        "alt", "ast", "sgpt", "sgot", "bilirubin", "alp", "albumin",
        "ggt", "total protein", "lft", "liver function"
    ]
    kft_keywords = [
        "urea", "creatinine", "egfr", "bun", "uric acid", "kft",
        "renal function", "kidney function", "rft"
    ]
    lipid_keywords = [
        "cholesterol", "hdl", "ldl", "triglycerides", "triglyceride",
        "vldl", "lipid profile", "lipoprotein"
    ]
    thyroid_keywords = [
        "tsh", "t3", "t4", "free t3", "free t4", "thyroid profile",
        "thyroid function", "thyroid stimulating"
    ]
    diabetes_keywords = [
        "glucose fasting", "glucose random", "fbs", "rbs", "hba1c",
        "glycated hemoglobin", "fasting blood sugar", "random blood sugar",
        "diabetes", "blood sugar", "a1c"
    ]
    urine_keywords = [
        "pus cells", "specific gravity", "ketones", "urine test",
        "urinalysis", "urine examination", "protein in urine",
        "sugar in urine", "urine protein", "urine glucose", "nitrite",
        "leukocyte esterase", "epithelial cells"
    ]

    def count_matches(keywords, t_lower):
        cnt = 0
        for kw in keywords:
            if kw.endswith("."):
                if kw in t_lower:
                    cnt += 1
            elif re.search(rf"\b{re.escape(kw)}\b", t_lower):
                cnt += 1
        return cnt

    scores = {
        "CBC": count_matches(cbc_keywords, lower) * 5,
        "LFT": count_matches(lft_keywords, lower) * 5,
        "KFT": count_matches(kft_keywords, lower) * 5,
        "Lipid Profile": count_matches(lipid_keywords, lower) * 5,
        "Thyroid Profile": count_matches(thyroid_keywords, lower) * 5,
        "Diabetes/Blood Sugar": count_matches(diabetes_keywords, lower) * 5,
        "Urine Test": count_matches(urine_keywords, lower) * 5,
        "Prescription": rx_cnt * 5,
    }

    detected = max(scores, key=scores.get)
    max_score = scores[detected]

    if max_score < 5:
        return {
            "report_type": "General Lab Report",
            "confidence": 0.3,
            "scores": scores,
            "is_mixed": False,
        }

    # Check if mixed (two categories close in score)
    sorted_scores = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    top_cat, top_val = sorted_scores[0]
    _, next_val = sorted_scores[1]
    is_mixed = (
        top_val > 0
        and next_val >= 10
        and (top_val - next_val) < 10
        and top_cat != "Prescription"
    )

    final_type = "General Lab Report" if is_mixed else detected
    confidence = round(min(0.99, max_score / 18.0), 2)

    return {
        "report_type": final_type,
        "confidence": confidence,
        "scores": scores,
        "is_mixed": is_mixed,
    }


def build_alias_lookup():
    data = load_json_rule("test_aliases.json")
    memory_aliases = get_verified_aliases()
    aliases = {}
    for standard, info in data.items():
        aliases[standard.lower()] = standard
        for alias in info.get("aliases", []):
            aliases[alias.lower()] = standard
        for ocr_var in info.get("ocr_variants", []):
            aliases[ocr_var.lower()] = standard
    for alias, standard in memory_aliases.items():
        aliases[alias.lower()] = standard
    return aliases


def find_test_name(line: str, aliases: dict):
    lower = line.lower()
    matches = [
        (alias, standard)
        for alias, standard in aliases.items()
        if re.search(rf"\b{re.escape(alias)}\b", lower)
    ]
    if matches:
        matches.sort(key=lambda x: len(x[0]), reverse=True)
        return matches[0][1], matches[0][0], 0.98
    keys = list(aliases.keys())
    match = process.extractOne(lower, keys, scorer=fuzz.partial_ratio)
    if match and match[1] >= 85:
        return aliases[match[0]], match[0], match[1] / 100
    return None, None, 0.0


def extract_numbers(line: str):
    return [float(x) for x in re.findall(NUMBER, line)]


def extract_range(line: str):
    for pat in RANGE_PATTERNS:
        m = pat.search(line)
        if m:
            try:
                low = float(m.group("low")) if "low" in m.groupdict() and m.group("low") else None
                high = float(m.group("high")) if "high" in m.groupdict() and m.group("high") else None
                return low, high
            except Exception:
                continue
    return None, None


def extract_unit(line: str, test_name: Optional[str] = None):
    """Extract medical unit from a line, with fallback to test_name common units."""
    units = [
        "mg/dL", "g/dL", "mmol/L", "umol/L", "mIU/L", "uIU/mL", "ng/mL",
        "pg/mL", "pmol/L", "IU/L", "U/L", "mm/hr", "mL/min/1.73m2",
        "uL", "/cmm", "%", "fL", "pg", "nmol/L", "ratio", "/HPF",
        "g/L", "x10^9/L", "x10^12/L", "mg/L", "mEq/L", "ng/dL",
        "ug/dL", "mmol/mol",
    ]
    units.sort(key=len, reverse=True)

    lower = line.lower()
    for unit in units:
        if re.search(r'\b' + re.escape(unit.lower()) + r'\b', lower):
            return unit

    # Fallback: infer from test aliases
    if test_name:
        aliases_data = load_json_rule("test_aliases.json")
        for std_name, details in aliases_data.items():
            if std_name.lower() == test_name.lower() or test_name.lower() in [
                a.lower() for a in details.get("aliases", [])
            ]:
                common_units = details.get("common_units", [])
                if common_units:
                    return common_units[0]
                break

    return ""


def calculate_test_confidence(test_conf, val_found, range_found, unit_found):
    score = test_conf * 0.4
    if val_found:
        score += 0.3
    if range_found:
        score += 0.2
    if unit_found:
        score += 0.1
    return round(score, 2)


def determine_report_type(tests: list) -> str:
    """
    Determine final report type from extracted test names.
    Supports: CBC, LFT, KFT, Lipid Profile, Thyroid Profile,
              Diabetes/Blood Sugar, Urine Test, Prescription, General Lab Report.
    """
    if not tests:
        return "General Lab Report"

    # If any test has prescription source, it's a prescription
    has_rx = any(t.get("source") == "prescription_rxnorm" for t in tests)
    if has_rx:
        return "Prescription"

    test_names = {
        (t.get("test_name") or t.get("testName") or "").lower().strip()
        for t in tests
    }
    test_names.discard("")

    cbc_markers = {
        "hemoglobin", "hgb", "wbc", "white blood cells", "rbc", "red blood cells",
        "platelets", "plt", "mcv", "mch", "mchc", "hematocrit", "pcv",
        "rdw", "rdw-cv", "rdw-sd", "tlc", "esr"
    }
    lft_markers = {
        "alt", "ast", "sgpt", "sgot", "bilirubin total", "bilirubin",
        "alp", "albumin", "ggt", "total protein"
    }
    kft_markers = {"urea", "creatinine", "egfr", "bun", "uric acid"}
    lipid_markers = {"cholesterol", "hdl", "ldl", "triglycerides", "vldl"}
    thyroid_markers = {"tsh", "t3", "t4", "free t3", "free t4"}
    diabetes_markers = {
        "fasting blood sugar", "random blood sugar", "hba1c",
        "glucose", "fbs", "rbs"
    }
    urine_markers = {
        "urine protein", "urine glucose", "urine ketones", "pus cells",
        "urine rbc", "epithelial cells", "nitrite", "leukocyte esterase",
        "specific gravity", "ph"
    }

    categories = {
        "CBC": test_names.intersection(cbc_markers),
        "LFT": test_names.intersection(lft_markers),
        "KFT": test_names.intersection(kft_markers),
        "Lipid Profile": test_names.intersection(lipid_markers),
        "Thyroid Profile": test_names.intersection(thyroid_markers),
        "Diabetes/Blood Sugar": test_names.intersection(diabetes_markers),
        "Urine Test": test_names.intersection(urine_markers),
    }

    matched_categories = {
        cat: len(matches)
        for cat, matches in categories.items()
        if len(matches) > 0
    }

    if not matched_categories:
        return "General Lab Report"

    if len(matched_categories) == 1:
        return list(matched_categories.keys())[0]

    # Multiple categories matched
    sorted_cats = sorted(matched_categories.items(), key=lambda x: x[1], reverse=True)
    top_cat, top_count = sorted_cats[0]
    _, second_count = sorted_cats[1]

    # Dominant category rule: top has at least 2× the second
    if top_count >= 2 * second_count:
        return top_cat

    return "General Lab Report"


def parse_report_text(text: str):
    import time
    t_start = time.time()
    print(f"[TIMING] Starting parser_service.parse_report_text")

    # Step 1: OCR corrections
    text = fix_numeric_ocr_typos(text)
    corrections = get_ocr_corrections()
    for wrong, right in corrections.items():
        text = text.replace(wrong, right)

    t_corr = time.time()
    correction_res = correct_ocr_text(text)
    text = correction_res.get("corrected_text", text)
    print(f"[TIMING] OCR correction took {time.time() - t_corr:.4f}s")

    # Step 2: Detect report type from raw text
    t_det = time.time()
    detection = detect_report_type(text)
    sections = detect_sections(text)
    print(f"[TIMING] Report detection from text took {time.time() - t_det:.4f}s | Type: {detection['report_type']}")

    # Step 3: Build alias lookup and extract test rows
    aliases = build_alias_lookup()
    rule_results = []

    t_rows = time.time()
    for raw in text.splitlines():
        line = normalize_line(raw)
        if not line or len(line) < 3:
            continue

        test_name, detected_alias, name_conf = find_test_name(line, aliases)
        if not test_name:
            continue

        nums = extract_numbers(line)
        low, high = extract_range(line)
        unit = extract_unit(line, test_name)

        # Smart value extraction: exclude range boundary numbers
        value = None
        if nums:
            if low is not None or high is not None:
                range_vals = set()
                if low is not None:
                    range_vals.add(low)
                if high is not None:
                    range_vals.add(high)
                candidates = [n for n in nums if n not in range_vals]
                value = candidates[0] if candidates else None
            else:
                value = nums[0]

        overall_conf = calculate_test_confidence(
            name_conf,
            value is not None,
            low is not None or high is not None,
            unit != "",
        )

        # Build reference range string
        ref_range_str = "Not detected"
        if low is not None and high is not None:
            ref_range_str = f"{low}-{high}"
        elif low is not None:
            ref_range_str = f">{low}"
        elif high is not None:
            ref_range_str = f"<{high}"

        # Rule-based status (preliminary, overridden in safety pass below)
        status = "needs_review"
        if value is not None and low is not None and high is not None:
            if value < low:
                status = "low"
            elif value > high:
                status = "high"
            else:
                status = "normal"
        elif value is not None and low is not None and high is None:
            status = "low" if value < low else "normal"
        elif value is not None and high is not None and low is None:
            status = "high" if value > high else "normal"

        rule_results.append({
            "test_name": test_name,
            "testName": test_name,
            "value": value,
            "unit": unit,
            "reference_range": ref_range_str,
            "referenceRange": ref_range_str,
            "range_low": low,
            "rangeLow": low,
            "range_high": high,
            "rangeHigh": high,
            "status": status,
            "confidence": overall_conf,
            "needsManualReview": overall_conf < 0.75,
            "method": "rule_parser",
        })

    print(f"[TIMING] Rule-based row extraction took {time.time() - t_rows:.4f}s | Found {len(rule_results)} rows")

    # Step 4: Layout-aware parsing
    t_layout = time.time()
    layout_results = parse_layout_aware(text)
    print(f"[TIMING] Layout-aware parsing took {time.time() - t_layout:.4f}s | Found {len(layout_results)} rows")

    # Step 5: Confidence voting to merge rule + layout results
    t_vote = time.time()
    tests = vote_on_results(rule_results, layout_results)
    print(f"[TIMING] Confidence voting took {time.time() - t_vote:.4f}s | Merged to {len(tests)} tests")

    # Step 6: Safety control pass — apply strict rule-based comparator
    t_sanity = time.time()
    for t in tests:
        test_name = t.get("testName") or t.get("test_name") or "Unknown"
        t["testName"] = test_name
        t["test_name"] = test_name

        low = t.get("rangeLow") if t.get("rangeLow") is not None else t.get("range_low")
        high = t.get("rangeHigh") if t.get("rangeHigh") is not None else t.get("range_high")
        t["rangeLow"] = low
        t["range_low"] = low
        t["rangeHigh"] = high
        t["range_high"] = high

        value = t.get("value")
        unit = t.get("unit", "")

        # Apply medical sanity check
        if value is not None:
            val, suspicious, msg = sanity_check_value(test_name, value)
            value = val
            t["value"] = val
            if suspicious:
                t["manualReviewRequired"] = True
                t["sanityNote"] = msg

        # Map LOINC code
        loinc_code = LOINC_MAP.get(test_name)
        if loinc_code:
            t["loinc_code"] = loinc_code
            t["loincCode"] = loinc_code

        # --- Strict safety comparator ---
        if low is not None or high is not None:
            # Reference range found in report → use it as ground truth
            source_priority = "lab_report_reference_range"

            if low is not None and high is not None:
                ref_range_str = f"{low}-{high}"
                if value is not None:
                    if value < low:
                        status = "low"
                        explanation = f"{test_name} is below the reference range printed on your report ({ref_range_str})."
                    elif value > high:
                        status = "high"
                        explanation = f"{test_name} is above the reference range printed on your report ({ref_range_str})."
                    else:
                        status = "normal"
                        explanation = f"{test_name} is within the normal reference range ({ref_range_str})."
                else:
                    status = "needs_review"
                    explanation = f"Value for {test_name} could not be clearly detected."
            elif low is not None:
                ref_range_str = f">{low}"
                if value is not None:
                    if value < low:
                        status = "low"
                        explanation = f"{test_name} is below the minimum reference ({ref_range_str})."
                    else:
                        status = "normal"
                        explanation = f"{test_name} is above the minimum reference ({ref_range_str})."
                else:
                    status = "needs_review"
                    explanation = f"Value for {test_name} could not be clearly detected."
            else:  # only high bound
                ref_range_str = f"<{high}"
                if value is not None:
                    if value > high:
                        status = "high"
                        explanation = f"{test_name} exceeds the upper limit ({ref_range_str})."
                    else:
                        status = "normal"
                        explanation = f"{test_name} is within the upper limit ({ref_range_str})."
                else:
                    status = "needs_review"
                    explanation = f"Value for {test_name} could not be clearly detected."

            # Confidence tier
            if value is not None and unit and (low is not None or high is not None):
                confidence = "high"
                conf_score = 0.95
            elif value is not None and unit:
                confidence = "medium"
                conf_score = 0.75
            elif value is not None:
                confidence = "medium"
                conf_score = 0.65
            else:
                confidence = "low"
                conf_score = 0.40

        else:
            # No reference range found
            status = "needs_review"
            ref_range_str = "Not detected"
            source_priority = "none"
            explanation = "Reference range not found in report. Please verify with your lab or doctor."

            if value is not None and unit:
                confidence = "medium"
                conf_score = 0.65
            elif value is not None:
                confidence = "medium"
                conf_score = 0.55
            else:
                confidence = "low"
                conf_score = 0.35

        t["status"] = status
        t["reference_range"] = ref_range_str
        t["referenceRange"] = ref_range_str
        t["confidence"] = confidence
        t["confidence_score"] = conf_score
        t["min_range"] = low
        t["minRange"] = low
        t["max_range"] = high
        t["maxRange"] = high
        t["source"] = source_priority
        t["source_priority"] = source_priority
        t["interpretation_source"] = source_priority
        t["explanation"] = explanation
        t["trusted_info_source"] = "MedlinePlus" if loinc_code else "Lab Report"

    print(f"[TIMING] Safety check & clinical controls took {time.time() - t_sanity:.4f}s")

    # Step 7: Determine final report type from extracted test names (overrides text-based)
    final_report_type = determine_report_type(tests)
    # Fall back to text-based detection if test-name detection returns General Lab Report
    if final_report_type == "General Lab Report" and detection["report_type"] not in ("General Lab Report",):
        final_report_type = detection["report_type"]

    if final_report_type in ("Needs Review", "Unknown"):
        report_type_confidence = 0.30
    elif final_report_type == "General Lab Report":
        report_type_confidence = 0.55
    else:
        report_type_confidence = max(0.80, detection.get("confidence", 0.80))

    # Calculate extraction confidence from test scores
    extraction_conf = (
        round(sum(t.get("confidence_score", 0.0) for t in tests) / len(tests), 2)
        if tests else 0.0
    )

    # Debug logs
    print(f"[DEBUG LOG] OCR text length: {len(text)}")
    print(f"[DEBUG LOG] Detected tests count: {len(tests)}")
    print(f"[DEBUG LOG] Final report type: {final_report_type} (confidence: {report_type_confidence * 100:.0f}%)")
    print(f"[DEBUG LOG] Extraction confidence: {extraction_conf * 100:.0f}%")
    for t in tests:
        print(
            f"[DEBUG LOG] Test: {t.get('test_name')}, "
            f"Value: {t.get('value')}, Unit: {t.get('unit')}, "
            f"Range: {t.get('reference_range')}, "
            f"Status: {t.get('status')}, Confidence: {t.get('confidence')}"
        )

    ocr_conf = correction_res.get("correction_confidence", 0.80)
    print(f"[TIMING] Total parser_service took {time.time() - t_start:.4f}s")

    return {
        "reportType": final_report_type,
        "reportTypeConfidence": report_type_confidence,
        "isMixed": detection.get("is_mixed", False),
        "ocrConfidence": ocr_conf,
        "extractionConfidence": extraction_conf,
        "tests": tests,
        "sectionsDetected": [s["name"] for s in sections],
        "overallRisk": "Unknown",
        "doctorAdvice": "Consult a qualified doctor for confirmation.",
        "safetyNote": "This app provides educational analysis, not clinical diagnosis.",
    }
