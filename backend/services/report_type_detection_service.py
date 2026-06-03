import re

CATEGORIES = {
    "Hematology": ["hemoglobin", "wbc", "rbc", "platelet", "esr", "blood group"],
    "Cardiac": ["troponin", "ck-mb", "bnp", "ecg", "echo"],
    "Renal": ["creatinine", "urea", "bun", "uric acid", "egfr"],
    "Diabetes": ["glucose", "fbs", "rbs", "hba1c"],
    "Liver": ["alt", "ast", "sgpt", "sgot", "bilirubin"],
    "Thyroid": ["tsh", "t3", "t4"],
    "Urine": ["urine routine", "pus cells", "specific gravity"],
    "Radiology": ["x-ray", "ultrasound", "ct scan", "mri", "impression", "findings"],
    "Pathology": ["histopathology", "biopsy", "cytology"]
}

def detect_report_metadata(text: str) -> dict:
    lower = text.lower()
    scores = {cat: 0 for cat in CATEGORIES}
    
    # Weighted scoring
    for cat, keywords in CATEGORIES.items():
        for k in keywords:
            if k in lower:
                scores[cat] += 10
    
    # Mixed report detection
    active_cats = [cat for cat, score in scores.items() if score >= 10]
    category = active_cats[0] if active_cats else "Unknown"
    is_mixed = len(active_cats) > 1
    
    # Confidence calculation
    max_score = max(scores.values()) if scores else 0
    confidence = min(0.99, max_score / 20.0)
    
    return {
        "category": "Mixed" if is_mixed else category,
        "report_type": category,
        "sections": active_cats,
        "confidence": round(confidence, 2),
        "is_supported": category != "Unknown",
        "manual_review_required": confidence < 0.70
    }
