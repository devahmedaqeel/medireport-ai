import os
import json
import random
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
SYNTHETIC_DIR = BASE_DIR / "dataset" / "synthetic_reports"
EXPORTED_JSON_DIR = BASE_DIR / "dataset" / "ml_training" / "exported"

# Ensure directories exist
SYNTHETIC_DIR.mkdir(parents=True, exist_ok=True)
EXPORTED_JSON_DIR.mkdir(parents=True, exist_ok=True)

# Load configuration data
with open(BASE_DIR / "backend/rules/test_aliases.json") as f:
    ALIASES = json.load(f)
with open(BASE_DIR / "backend/rules/reference_ranges.json") as f:
    RANGES = json.load(f)

REPORT_CATEGORIES = {
    "Hematology": ["CBC"],
    "Diabetes": ["Fasting Blood Sugar", "Random Blood Sugar", "HbA1c"],
    "Cardiovascular": ["Lipid Profile", "Cardiac Markers"],
    "Renal": ["Kidney Function Test"],
    "Liver": ["Liver Function Test"],
    "Endocrine": ["Thyroid Profile"],
    "Urine": ["Urine Report"],
    "Radiology": ["RadiologyText"],
    "Pathology": ["PathologyText"],
    "Neurology": ["BrainNeurologyText"],
    "Mixed": ["Mixed Report"]
}

# Detailed marker groups for each type
MARKER_GROUPS = {
    "CBC": ["Hemoglobin", "White Blood Cells", "Red Blood Cells", "Platelets", "Hematocrit", "MCV", "MCH", "MCHC", "RDW", "Neutrophils", "Lymphocytes"],
    "Fasting Blood Sugar": ["Fasting Blood Sugar"],
    "Random Blood Sugar": ["Random Blood Sugar"],
    "HbA1c": ["HbA1c"],
    "Lipid Profile": ["Total Cholesterol", "LDL", "HDL", "VLDL", "Triglycerides", "Cholesterol/HDL Ratio"],
    "Kidney Function Test": ["Creatinine", "Urea", "BUN", "Uric Acid", "eGFR", "Sodium", "Potassium", "Chloride"],
    "Liver Function Test": ["ALT", "AST", "ALP", "Bilirubin Total", "Bilirubin Direct", "Bilirubin Indirect", "Albumin", "Total Protein", "GGT"],
    "Thyroid Profile": ["TSH", "T3", "T4", "Free T3", "Free T4"],
    "Urine Report": ["Urine Protein", "Urine Glucose", "Urine Ketones", "Pus Cells", "Urine RBC", "Epithelial Cells", "Nitrite", "Leukocyte Esterase", "Specific Gravity", "pH"],
    "Cardiac Markers": ["Troponin I", "CK-MB", "BNP", "LDH"],
    "RadiologyText": [], # Special handling
    "PathologyText": [], # Special handling
    "BrainNeurologyText": [] # Special handling
}

LABS = ["Prime Diagnostics", "City Clinical Laboratory", "Global MedLabs", "Metro Healthcare", "LifeScan Center"]
NOISE_MAP = {"0": "O", "1": "I", "l": "I", "dL": "di", "mg": "mq", ".": " ", "o": "0"}

def get_noisy_text(text):
    if random.random() > 0.4: return text # 40% noise chance
    chars = list(text)
    for i in range(len(chars)):
        if chars[i] in NOISE_MAP and random.random() > 0.6:
            chars[i] = NOISE_MAP[chars[i]]
    return "".join(chars)

def generate_val(test_name):
    rng = RANGES.get(test_name, {"general": {"low": 10, "high": 50}})
    low = rng.get("general", {}).get("low", 10)
    high = rng.get("general", {}).get("high", 100)
    
    choice = random.random()
    if choice < 0.5: # Normal
        return round(random.uniform(low, high), 2)
    elif choice < 0.7: # Low
        return round(random.uniform(low * 0.3, low * 0.95), 2)
    elif choice < 0.9: # High
        return round(random.uniform(high * 1.05, high * 2.5), 2)
    else: # Critical
        if random.random() > 0.5: return round(random.uniform(high * 3, high * 10), 2)
        else: return round(random.uniform(low * 0.05, low * 0.2), 2)

def generate_report(report_type, report_id, category):
    lab = random.choice(LABS)
    markers = MARKER_GROUPS.get(report_type, [])
    
    # Handle text reports
    if "Text" in report_type:
        findings = f"Patient presents with non-specific symptoms. {report_type} reveals some abnormalities in {category.lower()} structures."
        impression = f"Findings may indicate potential {category.lower()} concern. Recommend specialist review."
        txt = f"{lab}\n\nREPORT: {report_type}\nCATEGORY: {category}\n\nFINDINGS:\n{findings}\n\nIMPRESSION:\n{impression}\n"
        
        json_data = {
            "report_id": report_id, "source": "synthetic", "report_type": report_type, "category": category,
            "text_clean": txt, "text_noisy": get_noisy_text(txt),
            "findings": findings, "impression": impression, "urgent_keywords": ["abnormalities"], "manual_review_required": True
        }
    else:
        # Lab report
        layout = random.choice(["table", "colon", "space"])
        txt = f"{lab}\n\nREPORT: {report_type}\n"
        if layout == "table": txt += "INVESTIGATION          RESULT      UNIT      REFERENCE\n"
        
        json_data = {
            "report_id": report_id, "source": "synthetic", "report_type": report_type, "category": category,
            "text_clean": "", "text_noisy": "", "tests": []
        }
        
        body_lines = []
        for marker in markers:
            val = generate_val(marker)
            alias_info = ALIASES.get(marker, {"aliases": [], "common_units": [""]})
            alias = random.choice([marker] + alias_info["aliases"])
            unit = alias_info["common_units"][0]
            rng = RANGES.get(marker, {"general": {"low": 0, "high": 0}})
            r_low = rng.get("general", {}).get("low", 0)
            r_high = rng.get("general", {}).get("high", 0)
            
            status = "Normal"
            if val < r_low: status = "Low"
            elif val > r_high: status = "High"
            
            if layout == "table":
                line = f"{alias:<22} {val:<10} {unit:<10} {r_low}-{r_high}"
            elif layout == "colon":
                line = f"{alias}: {val} {unit} [Ref: {r_low}-{r_high}]"
            else:
                line = f"{alias} {val} {unit} {r_low} - {r_high}"
            
            body_lines.append(line)
            json_data["tests"].append({
                "test_name": marker, "value": val, "unit": unit,
                "range_low": r_low, "range_high": r_high, "status": status,
                "span_text": line
            })
            
        txt_body = "\n".join(body_lines)
        full_txt = txt + txt_body
        json_data["text_clean"] = full_txt
        json_data["text_noisy"] = get_noisy_text(full_txt)
        
    # Save files
    with open(SYNTHETIC_DIR / f"{report_id}.txt", "w") as f: f.write(json_data["text_clean"])
    with open(EXPORTED_JSON_DIR / f"{report_id}.json", "w") as f: json.dump(json_data, f, indent=2)

def main():
    distribution = {
        "CBC": 350, "Fasting Blood Sugar": 150, "Random Blood Sugar": 150, "HbA1c": 50,
        "Lipid Profile": 300, "Kidney Function Test": 300, "Liver Function Test": 300,
        "Thyroid Profile": 300, "Urine Report": 250, "Cardiac Markers": 200,
        "RadiologyText": 200, "PathologyText": 200, "BrainNeurologyText": 150, "Mixed Report": 100
    }
    
    total = 0
    print("Generating 3000+ synthetic medical reports...")
    for r_type, count in distribution.items():
        category = "General"
        for cat, types in REPORT_CATEGORIES.items():
            if r_type in types: category = cat; break
        
        print(f"  -> {r_type} ({count})")
        for i in range(count):
            report_id = f"{r_type.lower().replace(' ', '_')}_{i:04d}"
            generate_report(r_type, report_id, category)
            total += 1
    print(f"Successfully generated {total} synthetic reports and annotations.")

if __name__ == "__main__":
    main()
