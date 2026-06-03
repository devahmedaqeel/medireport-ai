from services.indication_service import add_indications
from services.knowledge_retrieval_service import retrieve_medical_context
from services.safety_guardrail_service import apply_guardrails_to_report

DISCLAIMER = "This is not a diagnosis. Please consult a qualified doctor."

def build_explanation(report: dict):
    report = add_indications(report)
    tests = report.get("tests", [])
    patterns = report.get("patterns", [])
    
    parts_en = []
    parts_ur = []

    # 1. Patterns
    if patterns:
        for p in patterns:
            parts_en.append(f"🔍 Trend: {p.get('english', '')}")
            parts_ur.append(f"🔍 Rujhan: {p.get('romanUrdu', '')}")

    high_tests = []
    low_tests = []
    review_tests = []
    normal_tests = []
    
    for t in tests:
        status = t.get("status", "").lower().strip()
        
        # Check status
        if status == "high":
            high_tests.append(t)
        elif status == "low":
            low_tests.append(t)
        elif status == "needs_review":
            review_tests.append(t)
        elif status == "normal":
            normal_tests.append(t)
            
    # 2. High Values
    if high_tests:
        count = len(high_tests)
        suffix = "is" if count == 1 else "are"
        parts_en.append(f"📈 {count} {'value' if count == 1 else 'values'} {suffix} above the provided reference range:")
        parts_ur.append(f"📈 {count} {'value' if count == 1 else 'values'} normal range se zyada {suffix.replace('is', 'hai').replace('are', 'hain')}:")
        for t in high_tests:
            name = t.get("testName") or t.get("test_name") or "Unknown"
            val = t.get("value")
            unit = t.get("unit", "")
            ref = t.get("reference_range") or t.get("referenceRange") or "Not detected"
            url = t.get("medlineplus_url") or t.get("medline_url")
            link_str = f" (Source: {url})" if url else ""
            parts_en.append(f"  • {name}: {val} {unit} (Range: {ref}){link_str}")
            parts_ur.append(f"  • {name}: {val} {unit} (Normal: {ref})")
            
    # 3. Low Values
    if low_tests:
        count = len(low_tests)
        suffix = "is" if count == 1 else "are"
        parts_en.append(f"📉 {count} {'value' if count == 1 else 'values'} {suffix} below the provided reference range:")
        parts_ur.append(f"📉 {count} {'value' if count == 1 else 'values'} normal range se kam {suffix.replace('is', 'hai').replace('are', 'hain')}:")
        for t in low_tests:
            name = t.get("testName") or t.get("test_name") or "Unknown"
            val = t.get("value")
            unit = t.get("unit", "")
            ref = t.get("reference_range") or t.get("referenceRange") or "Not detected"
            url = t.get("medlineplus_url") or t.get("medline_url")
            link_str = f" (Source: {url})" if url else ""
            parts_en.append(f"  • {name}: {val} {unit} (Range: {ref}){link_str}")
            parts_ur.append(f"  • {name}: {val} {unit} (Normal: {ref})")
            
    # 4. Needs Review
    if review_tests:
        count = len(review_tests)
        suffix = "needs" if count == 1 else "need"
        parts_en.append(f"⚠️ {count} {'value' if count == 1 else 'values'} {suffix} manual review because reference ranges were not detected:")
        parts_ur.append(f"⚠️ {count} {'value' if count == 1 else 'values'} ka manual review zaroori hai kyunke normal range nahi mili:")
        for t in review_tests:
            name = t.get("testName") or t.get("test_name") or "Unknown"
            val = t.get("value")
            unit = t.get("unit", "")
            parts_en.append(f"  • {name}: {val} {unit}")
            parts_ur.append(f"  • {name}: {val} {unit}")

    # Aggregation
    if not parts_en:
        english = "• All analyzed markers are within normal reference ranges.\n\n" + DISCLAIMER
        roman = "• Tamam markers normal range mein hain.\n\nBaraye meharbani doctor se ruju karein."
    else:
        english = "\n\n".join(parts_en) + "\n\n" + DISCLAIMER
        roman = "\n\n".join(parts_ur) + "\n\nFinal diagnosis ke liye doctor se consult karein."

    res = {
        "reportType": report.get("reportType"),
        "reportTypeConfidence": report.get("reportTypeConfidence"),
        "extractionConfidence": report.get("extractionConfidence"),
        "overallRisk": report.get("overallRisk"),
        "englishExplanation": english,
        "romanUrduExplanation": roman,
        "safetyDisclaimer": DISCLAIMER,
        "detectedPatterns": patterns,
        "report": report,
    }
    
    # Final Safety Check
    return apply_guardrails_to_report(res)
