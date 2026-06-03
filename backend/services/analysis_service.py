"""
analysis_service.py
Senior Healthcare Software Engineering Layer

Orchestrates:
1. Rule-based parsing (parser_service)
2. ML entity extraction (ml_entity_extraction_service)
3. Gemini AI fallback (gemini_analysis_service)
4. MedlinePlus Connect + LOINC integration
5. Prescription detection via RxNorm
6. FHIR DiagnosticReport / Observation structure
7. Safe health scoring (no hardcoded defaults)
8. Structured explanation (explanation_service)
"""

from services.rule_loader import load_json_rule
from services.parser_service import parse_report_text, LOINC_MAP
from services.ml_entity_extraction_service import extract_entities_ml
from services.gemini_analysis_service import extract_markers_with_gemini
import re
import time
import os
import uuid
import datetime


# ---------------------------------------------------------------------------
# Helper: Fallback reference range lookup (only used when NOTHING is detected)
# ---------------------------------------------------------------------------
def fallback_range(test_name: str):
    ranges = load_json_rule("reference_ranges.json")
    info = ranges.get(test_name, {})
    return info.get("low"), info.get("high"), info.get("unit", "")


# ---------------------------------------------------------------------------
# Helper: Critical value check
# ---------------------------------------------------------------------------
def _is_critical(test_name: str, value, status: str, critical_rules: dict) -> bool:
    """Returns True if the value crosses a known critical boundary."""
    if value is None:
        return False
    rule = critical_rules.get(test_name, {})
    if status == "low":
        c_low = rule.get("CriticalLow")
        if c_low is not None and value <= c_low:
            return True
        low = rule.get("low")
        if low is not None and value < low * 0.70:
            return True
    elif status == "high":
        c_high = rule.get("CriticalHigh")
        if c_high is not None and value >= c_high:
            return True
        high = rule.get("high")
        if high is not None and value > high * 1.40:
            return True
    return False


# ---------------------------------------------------------------------------
# Health Metrics Calculation  (safe, no hardcoded fallback)
# ---------------------------------------------------------------------------
def calculate_health_metrics(tests: list) -> tuple:
    """
    Returns (health_score, risk_level, needs_review).

    Rules:
    - Score starts at 100.
    - Deduct 10 per mild abnormality (low / high).
    - Deduct 25 per critical abnormality.
    - Never drop below 10.
    - 'needs_review' tests do NOT cause deductions or Critical Risk.
    - Critical Risk requires at least one HIGH-confidence critical value.
    """
    critical_rules = load_json_rule("critical_values.json")

    safely_interpreted = []
    needs_review_count = 0

    for t in tests:
        status = (t.get("status") or "").lower().strip()
        if status == "needs_review":
            needs_review_count += 1
            continue
        val = t.get("value")
        low = t.get("min_range") if t.get("min_range") is not None else t.get("range_low")
        high = t.get("max_range") if t.get("max_range") is not None else t.get("range_high")
        if val is not None or (low is not None or high is not None):
            safely_interpreted.append(t)

    if not safely_interpreted:
        return None, "Needs Review", True

    score = 100
    abnormal_count = 0
    critical_count = 0
    high_conf_criticals = 0

    for t in safely_interpreted:
        test_name = t.get("test_name") or t.get("testName") or ""
        val = t.get("value")
        status = (t.get("status") or "").lower().strip()
        conf = (t.get("confidence") or "").lower().strip()
        low = t.get("min_range") if t.get("min_range") is not None else t.get("range_low")
        high = t.get("max_range") if t.get("max_range") is not None else t.get("range_high")

        if status in ("low", "high"):
            abnormal_count += 1
            is_crit = _is_critical(test_name, val, status, critical_rules)
            if is_crit:
                critical_count += 1
                score -= 25
                if conf == "high":
                    high_conf_criticals += 1
            else:
                score -= 10

    health_score = max(10, score)

    # Risk level determination
    if high_conf_criticals >= 1:
        risk_level = "Critical Risk"
    elif critical_count >= 1 or abnormal_count >= 4:
        risk_level = "High Risk"
    elif abnormal_count >= 2:
        risk_level = "Moderate Risk"
    elif abnormal_count >= 1:
        risk_level = "Low Risk"
    else:
        risk_level = "Low Risk"

    needs_review = needs_review_count > 0

    print(f"[DEBUG] health_score={health_score}, risk_level={risk_level}, "
          f"abnormal={abnormal_count}, critical={critical_count}, "
          f"high_conf_criticals={high_conf_criticals}")

    return health_score, risk_level, needs_review


# ---------------------------------------------------------------------------
# Analyze Structured Report
# ---------------------------------------------------------------------------
def analyze_structured_report(report: dict) -> dict:
    """Apply rule-based comparator and health metric calculation."""
    tests = report.get("tests", [])

    for t in tests:
        name = t.get("test_name") or t.get("testName") or ""
        t["test_name"] = name
        t["testName"] = name

        low = t.get("min_range") if t.get("min_range") is not None else t.get("range_low")
        high = t.get("max_range") if t.get("max_range") is not None else t.get("range_high")
        value = t.get("value")

        if low is None and high is None:
            t["status"] = "needs_review"
            t["reference_range"] = "Not detected"
            t["referenceRange"] = "Not detected"
            t["source"] = "none"
            t["source_priority"] = "none"
        else:
            if value is not None:
                if low is not None and high is not None:
                    status = "low" if value < low else ("high" if value > high else "normal")
                elif low is not None:
                    status = "low" if value < low else "normal"
                else:
                    status = "high" if value > high else "normal"
            else:
                status = "needs_review"

            t["status"] = status
            t["min_range"] = low
            t["minRange"] = low
            t["range_low"] = low
            t["rangeLow"] = low
            t["max_range"] = high
            t["maxRange"] = high
            t["range_high"] = high
            t["rangeHigh"] = high
            t["source"] = "lab_report_reference_range"
            t["source_priority"] = "lab_report_reference_range"

            # Populate reference_range and referenceRange strings
            ref_str = t.get("range_text") or t.get("rangeText") or t.get("referenceRange") or t.get("reference_range")
            if not ref_str or ref_str == "Not detected":
                if low is not None and high is not None:
                    ref_str = f"{low}-{high}"
                elif low is not None:
                    ref_str = f">{low}"
                elif high is not None:
                    ref_str = f"<{high}"
                else:
                    ref_str = "Not detected"
            t["reference_range"] = ref_str
            t["referenceRange"] = ref_str

    health_score, risk_level, needs_review = calculate_health_metrics(tests)
    report["tests"] = tests
    report["health_score"] = health_score
    report["healthScore"] = health_score
    report["overallRisk"] = risk_level
    report["risk_level"] = risk_level
    report["needs_review"] = needs_review
    report["doctorAdvice"] = "Consult a qualified doctor for confirmation."
    return report


# ---------------------------------------------------------------------------
# MedlinePlus Population  (async, parallel)
# ---------------------------------------------------------------------------
async def populate_medlineplus_data(tests: list):
    """Attach MedlinePlus URLs and summaries to each test in parallel."""
    import asyncio
    from services.knowledge_retrieval_service import get_medlineplus_info

    async def populate_one(t):
        test_name = t.get("testName") or t.get("test_name") or "Unknown"
        t["testName"] = test_name
        t["test_name"] = test_name

        loinc = t.get("loinc_code") or t.get("loincCode") or LOINC_MAP.get(test_name)
        if loinc:
            t["loinc_code"] = loinc
            t["loincCode"] = loinc

        info = await get_medlineplus_info(test_name, loinc)
        link = info.get("link", "https://medlineplus.gov/lab-tests/")
        summary = info.get("summary", "")
        source = info.get("source", "medlineplus_default")

        t["medlineplus_url"] = link
        t["medline_url"] = link
        t["learn_more_url"] = link
        t["medlineplus_summary"] = summary
        t["medline_summary"] = summary
        t["trusted_info_source"] = "MedlinePlus" if "medlineplus" in source else "Lab Report"

        # Build standard_name from LOINC map or aliases
        t["standard_name"] = test_name

    if tests:
        await asyncio.gather(*(populate_one(t) for t in tests))


# ---------------------------------------------------------------------------
# FHIR Bundle Generation
# ---------------------------------------------------------------------------
def generate_fhir_bundle(report_type: str, tests: list, patient_id: str = "unknown") -> dict:
    """
    Generates a minimal FHIR R4 Bundle containing a DiagnosticReport
    and individual Observation resources for each test.
    This is used internally for structured data storage — not for clinical use.
    """
    bundle_id = str(uuid.uuid4())
    report_id = f"dr-{uuid.uuid4().hex[:8]}"
    issued = datetime.datetime.utcnow().isoformat() + "Z"

    observations = []
    observation_refs = []

    for t in tests:
        obs_id = f"obs-{uuid.uuid4().hex[:8]}"
        test_name = t.get("test_name") or t.get("testName") or "Unknown"
        value = t.get("value")
        unit = t.get("unit", "")
        status = t.get("status", "needs_review")
        loinc = t.get("loinc_code") or t.get("loincCode")
        ref_range = t.get("reference_range", "Not detected")
        low = t.get("min_range")
        high = t.get("max_range")

        interpretation_code = {
            "normal": "N",
            "low": "L",
            "high": "H",
            "needs_review": "IND",
        }.get(status, "IND")
        interpretation_display = {
            "normal": "Normal",
            "low": "Low",
            "high": "High",
            "needs_review": "Indeterminate",
        }.get(status, "Indeterminate")

        obs = {
            "resourceType": "Observation",
            "id": obs_id,
            "status": "final",
            "code": {
                "coding": [
                    {
                        "system": "http://loinc.org",
                        "code": loinc or "unknown",
                        "display": test_name,
                    }
                ],
                "text": test_name,
            },
            "subject": {"reference": f"Patient/{patient_id}"},
            "effectiveDateTime": issued,
            "issued": issued,
            "interpretation": [
                {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
                            "code": interpretation_code,
                            "display": interpretation_display,
                        }
                    ]
                }
            ],
        }

        if value is not None:
            obs["valueQuantity"] = {
                "value": value,
                "unit": unit,
                "system": "http://unitsofmeasure.org",
                "code": unit,
            }

        if ref_range != "Not detected" and (low is not None or high is not None):
            ref_obj = {}
            if low is not None:
                ref_obj["low"] = {"value": low, "unit": unit}
            if high is not None:
                ref_obj["high"] = {"value": high, "unit": unit}
            obs["referenceRange"] = [ref_obj]

        observations.append(obs)
        observation_refs.append({"reference": f"Observation/{obs_id}"})

    diagnostic_report = {
        "resourceType": "DiagnosticReport",
        "id": report_id,
        "status": "final",
        "category": [
            {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/v2-0074",
                        "code": "LAB",
                        "display": "Laboratory",
                    }
                ]
            }
        ],
        "code": {
            "coding": [
                {
                    "system": "http://loinc.org",
                    "code": "11502-2",
                    "display": "Laboratory report",
                }
            ],
            "text": report_type,
        },
        "subject": {"reference": f"Patient/{patient_id}"},
        "issued": issued,
        "result": observation_refs,
        "conclusion": "This report was processed by MediReport AI. Please consult a qualified doctor for clinical interpretation.",
    }

    bundle = {
        "resourceType": "Bundle",
        "id": bundle_id,
        "type": "collection",
        "timestamp": issued,
        "entry": [{"resource": diagnostic_report}] + [{"resource": obs} for obs in observations],
    }

    return bundle


# ---------------------------------------------------------------------------
# Prescription Parsing via RxNorm
# ---------------------------------------------------------------------------
async def parse_prescription_text(ocr_text: str) -> list:
    """
    Attempts to identify drug names from OCR text using RxNorm API.
    Returns a list of medication test-compatible objects.
    """
    from services.knowledge_retrieval_service import verify_medicine_rxnorm

    lines = ocr_text.splitlines()
    medications = []
    seen = set()

    rx_indicators = [
        "tab", "cap", "syp", "inj", "tablet", "tablets", "capsule",
        "mg", "ml", "dose", "twice", "daily", "once", "bd", "tds", "qid",
    ]

    for line in lines:
        stripped = line.strip()
        if not stripped or len(stripped) < 3:
            continue
        lower = stripped.lower()
        if not any(ind in lower for ind in rx_indicators):
            continue

        # Extract potential drug name: first meaningful word(s) before numeric dose
        parts = re.split(r'\s+', stripped)
        drug_candidate = None
        for i, part in enumerate(parts):
            if re.match(r'^\d', part):
                break
            if len(part) >= 3 and part.lower() not in rx_indicators:
                drug_candidate = " ".join(parts[:i + 1]) if i > 0 else part
                break

        if not drug_candidate or drug_candidate.lower() in seen:
            continue
        seen.add(drug_candidate.lower())

        result = await verify_medicine_rxnorm(drug_candidate)
        if result.get("is_drug"):
            std_name = result.get("standard_name") or drug_candidate
            medications.append({
                "test_name": std_name,
                "testName": std_name,
                "standard_name": std_name,
                "value": None,
                "unit": "",
                "reference_range": stripped,  # Store original line as dosage instruction
                "referenceRange": stripped,
                "status": "normal",
                "confidence": "high",
                "confidence_score": 0.90,
                "source": "prescription_rxnorm",
                "source_priority": "prescription_rxnorm",
                "interpretation_source": "rxnorm",
                "trusted_info_source": "RxNorm/NLM",
                "rxcui": result.get("rxcui"),
                "explanation": f"{std_name} is a verified medication (RxNorm). Refer to your doctor for dosage guidance.",
                "learn_more_url": f"https://rxnav.nlm.nih.gov/REST/rxcui/{result.get('rxcui')}/allinfo.json" if result.get("rxcui") else "",
                "needsManualReview": False,
                "method": "rxnorm_prescription",
            })

    return medications


# ---------------------------------------------------------------------------
# Main Orchestration
# ---------------------------------------------------------------------------
async def process_full_report(ocr_output: dict) -> dict:
    t_start = time.time()
    print("[TIMING] Starting analysis_service.process_full_report")

    ocr_text = ocr_output.get("ocr_text", "")
    ocr_confidence = ocr_output.get("confidence", "unknown")
    ocr_engine = ocr_output.get("ocrEngine", "unknown")
    filename = ocr_output.get("filename", "unknown")
    image_url = ocr_output.get("imageUrl", "")

    # Early exit if no OCR text
    if not ocr_text.strip():
        print("[INFO] No OCR text extracted. Rejecting report.")
        return {
            "success": False,
            "ocr_text": "",
            "markers_detected": [],
            "confidence": "none",
            "ocrEngine": ocr_engine,
            "filename": filename,
            "imageUrl": image_url,
            "needs_review": True,
            "error": "No readable text extracted from image after all OCR attempts.",
            "message": "Could not extract readable text. Try a clearer image or use manual entry.",
        }

    # --- Step 1: Detect if prescription ---
    lower_text = ocr_text.lower()
    is_prescription = any(
        kw in lower_text
        for kw in [
            "tab.", "cap.", "tablet", "tablets", "capsule",
            "mg daily", "once daily", "twice daily", "prescribed by",
        ]
    ) and not any(
        lab_kw in lower_text
        for lab_kw in ["hemoglobin", "wbc", "rbc", "creatinine", "alt", "ast", "tsh", "glucose", "cholesterol"]
    )

    final_tests = []
    parsing_method = "rule_based"

    if is_prescription:
        print("[INFO] Prescription detected in OCR text. Running prescription parser.")
        final_tests = await parse_prescription_text(ocr_text)
        parsing_method = "prescription_rxnorm"
        print(f"[INFO] Prescription parser found {len(final_tests)} medications.")

    # --- Step 2: Rule-based parsing ---
    t_parse_rule = time.time()
    parsed_report_rule_based = parse_report_text(ocr_text)
    rule_based_tests = parsed_report_rule_based.get("tests", [])
    print(f"[TIMING] Rule-based parsing: {time.time() - t_parse_rule:.4f}s | {len(rule_based_tests)} markers")

    # --- Step 3: ML entity extraction ---
    t_parse_ml = time.time()
    ml_extraction_results = extract_entities_ml(ocr_text)
    ml_based_tests = ml_extraction_results.get("tests", [])
    print(f"[TIMING] ML entity extraction: {time.time() - t_parse_ml:.4f}s | {len(ml_based_tests)} markers")

    # --- Step 4: Combine best results ---
    if not is_prescription:
        if len(rule_based_tests) > 0:
            final_tests = rule_based_tests
            print("[INFO] Using rule-based parsing results.")
        elif len(ml_based_tests) > 0:
            final_tests = ml_based_tests
            parsing_method = "ml_entity_extraction"
            print("[INFO] Falling back to ML entity extraction results.")
        else:
            print("[INFO] Neither rule-based nor ML parsing found markers.")

    # --- Step 5: Gemini AI Fallback (only if < 2 markers detected) ---
    gemini_fallback_used = False
    if len(final_tests) < 2 and not is_prescription and os.getenv("GEMINI_API_KEY"):
        print("[INFO] Few markers detected. Attempting Gemini AI fallback...")
        gemini_tests = await extract_markers_with_gemini(ocr_text)
        if len(gemini_tests) > len(final_tests):
            # Apply safety pass to Gemini results — re-run comparator
            for g in gemini_tests:
                g_name = g.get("test_name") or g.get("testName") or ""
                g_val = g.get("value")
                g_low = g.get("range_low")
                g_high = g.get("range_high")
                if g_low is None and g_high is None:
                    g["status"] = "needs_review"
                    g["source"] = "none"
                else:
                    if g_val is not None:
                        if g_low is not None and g_high is not None:
                            g["status"] = "low" if g_val < g_low else ("high" if g_val > g_high else "normal")
                        elif g_low is not None:
                            g["status"] = "low" if g_val < g_low else "normal"
                        else:
                            g["status"] = "high" if g_val > g_high else "normal"
                    else:
                        g["status"] = "needs_review"
                    g["source"] = "lab_report_reference_range"

            final_tests = gemini_tests
            parsing_method = "gemini_fallback"
            gemini_fallback_used = True
            print(f"[INFO] Gemini AI fallback used. Found {len(gemini_tests)} markers.")
    elif not os.getenv("GEMINI_API_KEY"):
        print("[WARN] GEMINI_API_KEY not configured. Gemini AI fallback not available.")

    # --- Step 6: Populate MedlinePlus data for all tests ---
    if final_tests:
        await populate_medlineplus_data(final_tests)

    # --- Step 7: Determine final report type ---
    if is_prescription:
        final_report_type = "Prescription"
        report_type_confidence = 0.95
    else:
        final_report_type = parsed_report_rule_based.get("reportType", "General Lab Report")
        report_type_confidence = parsed_report_rule_based.get("reportTypeConfidence", 0.55)

    # --- Step 8: Build structured report and calculate health metrics ---
    structured_report = {
        "reportType": final_report_type,
        "reportTypeConfidence": report_type_confidence,
        "isMixed": parsed_report_rule_based.get("isMixed", False),
        "ocrConfidence": ocr_output.get("ocrConfidence", 0.80),
        "extractionConfidence": parsed_report_rule_based.get("extractionConfidence", 0.0),
        "tests": final_tests,
        "sectionsDetected": parsed_report_rule_based.get("sectionsDetected", []),
    }

    analyzed_report = analyze_structured_report(structured_report)

    # --- Step 9: FHIR Bundle ---
    try:
        fhir_bundle = generate_fhir_bundle(
            report_type=final_report_type,
            tests=analyzed_report.get("tests", []),
        )
    except Exception as e:
        print(f"[WARN] FHIR bundle generation failed: {e}")
        fhir_bundle = None

    # --- Step 10: Build explanation ---
    from services.explanation_service import build_explanation
    explained_report = build_explanation(analyzed_report)

    # --- Step 11: Compute confidence percent ---
    markers_detected = analyzed_report.get("tests", [])
    num_markers = len(markers_detected)

    raw_extraction_conf = analyzed_report.get("extractionConfidence", 0.0) or 0.0
    confidence_percent = int(raw_extraction_conf * 100)

    if confidence_percent == 0 and num_markers > 0:
        # Calculate from individual test scores
        scored = [t.get("confidence_score", 0.0) for t in markers_detected if t.get("confidence_score")]
        if scored:
            confidence_percent = int((sum(scored) / len(scored)) * 100)
        else:
            confidence_percent = 75  # reasonable safe default

    health_score = analyzed_report.get("health_score")
    risk_level = analyzed_report.get("overallRisk", "Needs Review")
    english_explanation = explained_report.get("englishExplanation", "")
    roman_urdu_explanation = explained_report.get("romanUrduExplanation", "")
    patterns = explained_report.get("detectedPatterns", [])

    # --- Step 12: Determine needs_review & rejection_reason ---
    needs_review = False
    rejection_reason = None

    if num_markers == 0:
        needs_review = True
        rejection_reason = (
            "No medical markers were identified. "
            "The report might be unclear, unsupported, or a non-lab document."
        )
    elif num_markers < 3 and ocr_confidence == "low":
        needs_review = True
        rejection_reason = "Few markers detected with low OCR quality. Manual review recommended."
    elif gemini_fallback_used and num_markers > 0:
        needs_review = True
        rejection_reason = (
            "Gemini AI was used for marker extraction. "
            "Manual verification of results is highly recommended."
        )
    elif is_prescription:
        needs_review = True
        rejection_reason = "Prescription report detected. Please verify medications with your doctor."

    print(f"[DEBUG] Detected Markers ({num_markers}): {[t.get('testName') for t in markers_detected]}")
    if rejection_reason:
        print(f"[DEBUG] Final Rejection Reason: {rejection_reason}")

    # --- Step 13: Build final response ---
    final_response = {
        "success": True,

        # Primary structured fields
        "report_type": final_report_type,
        "confidence_percent": confidence_percent,
        "health_score": health_score,
        "risk_level": risk_level,
        "needs_review": needs_review,
        "summary": english_explanation,
        "tests": markers_detected,
        "disclaimer": "This is not a diagnosis. Please consult a qualified doctor.",
        "fhir_report": fhir_bundle,
        "fhirReport": fhir_bundle,

        # Backward-compatible fields for React Native UI
        "reportType": final_report_type,
        "reportTypeConfidence": report_type_confidence,
        "extractionConfidence": confidence_percent / 100.0,
        "overallRisk": risk_level,
        "detectedPatterns": patterns,
        "report": analyzed_report,
        "englishExplanation": english_explanation,
        "romanUrduExplanation": roman_urdu_explanation,
        "safetyDisclaimer": "This is not a diagnosis. Please consult a qualified doctor.",
        "ocr_text": ocr_text,
        "engine_used": ocr_engine,
        "ocrEngine": ocr_engine,
        "markers_detected": [t.get("test_name") for t in markers_detected if t.get("test_name")],
        "confidence": ocr_confidence,
        "filename": filename,
        "imageUrl": image_url,
        "rejection_reason": rejection_reason,
        "message": (
            "OCR and analysis completed successfully."
            if not needs_review
            else (rejection_reason or "Analysis completed with recommendations for review.")
        ),
    }

    if num_markers == 0 and rejection_reason:
        final_response["success"] = False
        final_response["message"] = rejection_reason
        final_response["error"] = rejection_reason

    print(f"[TIMING] Total analysis_service.process_full_report: {time.time() - t_start:.4f}s "
          f"(method={parsing_method})")
    return final_response
