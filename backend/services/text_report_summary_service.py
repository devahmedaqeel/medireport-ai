import re
from services.safety_guardrail_service import validate_medical_response

def summarize_text_report(text: str, category: str) -> dict:
    """
    Summarizes findings and impressions from radiology, pathology, or cardiac text reports.
    """
    urgent_keywords = ["mass", "lesion", "bleeding", "hemorrhage", "fracture", "infarct", "severe", "urgent", "malignancy"]
    found_urgent = [k for k in urgent_keywords if k in text.lower()]
    
    # Simple extraction logic (can be improved with LLM/Transformers)
    findings = ""
    if "findings" in text.lower():
        findings = text.lower().split("findings")[-1].split("impression")[0].strip()
        
    impression = ""
    if "impression" in text.lower():
        impression = text.lower().split("impression")[-1].strip()

    english = f"Summary: {category} report text analyzed. "
    if found_urgent:
        english += f"Urgent findings detected: {', '.join(found_urgent)}. "
        
    roman_urdu = f"{category} ki report text ka jaiza lia gaya hai. "
    if found_urgent:
        roman_urdu += "Report mein kuch ahem (urgent) findings hain jo doctor ko dikhana zaroori hain."

    return {
        "summary_en": validate_medical_response(english),
        "summary_ur": roman_urdu,
        "urgent_keywords": found_urgent,
        "manual_review_required": len(found_urgent) > 0,
        "doctor_advice": "Please consult a specialist for a detailed review of this clinical report."
    }
