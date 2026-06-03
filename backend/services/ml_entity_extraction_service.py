import os
import spacy
from pathlib import Path
from services.value_extraction_service import extract_numeric_value
from services.unit_extraction_service import normalize_unit, extract_unit_from_text
from services.range_extraction_service import extract_range_details

# Load model-best if exists
BASE_MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "medical_ner"
MODEL_BEST_PATH = BASE_MODEL_PATH / "model-best"

_nlp_model = None
_load_failed = False

def get_model():
    global _nlp_model, _load_failed
    if _nlp_model is not None:
        return _nlp_model
    if _load_failed:
        return None
    
    load_path = MODEL_BEST_PATH if MODEL_BEST_PATH.exists() else BASE_MODEL_PATH
    if not load_path.exists() or not os.listdir(load_path):
        _load_failed = True
        return None
    
    try:
        # Check for meta.json or config.cfg
        if not (load_path / "meta.json").exists() and not (load_path / "config.cfg").exists():
            _load_failed = True
            return None
        _nlp_model = spacy.load(load_path)
        return _nlp_model
    except:
        _load_failed = True
        return None

def extract_entities_ml(text):
    nlp = get_model()
    if nlp is None:
        return {"model_available": False, "fallback_required": True, "entities": [], "tests": []}
    
    try:
        doc = nlp(text)
        entities = []
        for ent in doc.ents:
            entities.append({
                "label": ent.label_,
                "text": ent.text,
                "start": ent.start_char,
                "end": ent.end_char,
                "confidence": 0.85
            })
            
        structured_tests = []
        
        # Line-based grouping
        lines = text.splitlines()
        char_idx = 0
        for line in lines:
            line_len = len(line)
            line_start = char_idx
            line_end = char_idx + line_len
            
            # Entities on this line
            line_ents = [e for e in entities if e["start"] >= line_start and e["end"] <= line_end]
            
            test_name_ent = next((e for e in line_ents if e["label"] == "TEST_NAME"), None)
            value_ent = next((e for e in line_ents if e["label"] == "VALUE"), None)
            unit_ent = next((e for e in line_ents if e["label"] == "UNIT"), None)
            range_ent = next((e for e in line_ents if e["label"] == "RANGE"), None)
            
            if test_name_ent and value_ent:
                val = extract_numeric_value(value_ent["text"])
                unit = unit_ent["text"] if unit_ent else extract_unit_from_text(line)
                range_text = range_ent["text"] if range_ent else ""
                range_info = extract_range_details(range_text) if range_text else {"range_low": None, "range_high": None}
                
                # Task 4: Consistent Keys (Canonical snake_case + Alias camelCase)
                structured_tests.append({
                    "test_name": test_name_ent["text"],
                    "testName": test_name_ent["text"],
                    "value": val,
                    "unit": normalize_unit(unit) or unit,
                    "range_low": range_info.get("range_low"),
                    "rangeLow": range_info.get("range_low"),
                    "range_high": range_info.get("range_high"),
                    "rangeHigh": range_info.get("range_high"),
                    "range_text": range_info.get("range_text") or "Not detected",
                    "rangeText": range_info.get("range_text") or "Not detected",
                    "range_type": range_info.get("range_type", "unknown"),
                    "status": "Unknown",
                    "confidence": 0.88,
                    "method": "ml_ner",
                    "raw_line": line,
                    "rawLine": line
                })
            
            char_idx += line_len + 1

        return {
            "model_available": True,
            "entities": entities,
            "tests": structured_tests
        }
    except Exception as e:
        print(f"[ERROR] ML NER extraction failed: {e}")
        return {"model_available": False, "fallback_required": True, "entities": [], "tests": []}
