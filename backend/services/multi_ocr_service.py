import pytesseract
from PIL import Image
import os
import re

try:
    import easyocr
    EASYOCR_AVAILABLE = True
    reader = easyocr.Reader(['en'])
except ImportError:
    EASYOCR_AVAILABLE = False

# Expanded keywords list for medical reports
MEDICAL_KEYWORDS = [
    "cbc", "complete blood count", "hemoglobin", "haemoglobin", "hb", "wbc", "tlc", "rbc", "platelets", "plt", "hct", "mcv", "mch", "mchc", "esr",
    "blood sugar", "fasting blood sugar", "fbs", "rbs", "glucose", "hba1c",
    "cholesterol", "hdl", "ldl", "triglycerides",
    "creatinine", "urea", "bilirubin", "alt", "ast", "sgpt", "sgot",
    "tsh", "t3", "t4",
    "result", "unit", "reference range", "normal range", "range", "test", "investigation", "hematology", "biochemistry", "pathology",
    "vitamin d", "vitamin b12", "electrolytes", "crp", "dengue", "malaria", "typhoid", "urine"
]

def get_medical_keyword_count(text: str) -> int:
    """Counts common medical keywords to judge OCR quality."""
    count = 0
    lower = text.lower()
    for k in MEDICAL_KEYWORDS:
        # Use regex to find whole words to avoid partial matches
        if re.search(r'\b' + re.escape(k) + r'\b', lower):
            count += 1
    return count

def run_multi_ocr(image_paths: dict) -> dict:
    """
    Runs OCR on multiple preprocessed versions and returns the best candidate.
    The selection is based on the quantity of medical keywords and overall text length.
    Prioritizes Tesseract with different PSM modes on various image variants, then EasyOCR.
    image_paths: dict from preprocess_image_advanced, mapping variant name to path
    """
    ocr_results = []

    # Helper to clean text and calculate basic metrics
    def get_text_metrics(text):
        # Even more robust cleaning: remove common OCR artifacts, excessive newlines, etc.
        # Keep alphanumeric, whitespace, and common medical report punctuation.
        cleaned_text = re.sub(r'[^\w\s\-\.\,\/\%\:\<\>\(\)\[\]]+', '', text, flags=re.UNICODE) 
        cleaned_text = re.sub(r'\s+', ' ', cleaned_text).strip() # Normalize whitespace
        
        word_count = len(cleaned_text.split())
        char_count = len(cleaned_text)
        keyword_count = get_medical_keyword_count(text) # Use original text for keyword search
        return cleaned_text, word_count, char_count, keyword_count

    # Tesseract PSM modes to try, ordered by common effectiveness for documents/reports
    # 6: Assume a single uniform block of text.
    # 4: Assume a single column of text of variable sizes.
    # 11:  Sparse text. Find as much text as possible in no particular order.
    tesseract_psm_modes = ['6', '4', '11']
    
    # --- Pass 1: Tesseract OCR on all variants with different PSM modes ---
    for name, path in image_paths.items():
        try:
            with Image.open(path) as img:
                for psm in tesseract_psm_modes:
                    config = f'--psm {psm}'
                    try:
                        text = pytesseract.image_to_string(img, config=config)
                        cleaned_text, word_count, char_count, keyword_count = get_text_metrics(text)
                        
                        if char_count > 0:
                            ocr_results.append({
                                "engine": "tesseract",
                                "variant": name,
                                "psm": psm,
                                "text": cleaned_text,
                                "word_count": word_count,
                                "char_count": char_count,
                                "keyword_count": keyword_count,
                                "confidence_score": (char_count + keyword_count * 15 + (100 if name == "original" else 0)) # Boost keywords and original
                            })
                            print(f"[DEBUG] Tesseract ({name}, PSM {psm}): Chars={char_count}, Keywords={keyword_count}, Score={ocr_results[-1]['confidence_score']:.2f}")
                    except Exception as e:
                        print(f"[WARN] Tesseract OCR failed for {name} (PSM {psm}): {e}")
                        pass
        except Exception as e:
            print(f"[ERROR] Failed to open image {path} for Tesseract: {e}")

    # --- Pass 2: EasyOCR on all variants (if available) ---
    if EASYOCR_AVAILABLE:
        for name, path in image_paths.items():
            try:
                # EasyOCR returns a list of results, we join them
                results = reader.readtext(path, detail=0)
                text = "\n".join(results)
                cleaned_text, word_count, char_count, keyword_count = get_text_metrics(text)

                if char_count > 0:
                    ocr_results.append({
                        "engine": "easyocr",
                        "variant": name,
                        "psm": "N/A", # EasyOCR doesn't use PSM
                        "text": cleaned_text,
                        "word_count": word_count,
                        "char_count": char_count,
                        "keyword_count": keyword_count,
                        "confidence_score": (char_count + keyword_count * 15 + 200) # Give EasyOCR a slight boost over Tesseract
                    })
                    print(f"[DEBUG] EasyOCR ({name}): Chars={char_count}, Keywords={keyword_count}, Score={ocr_results[-1]['confidence_score']:.2f}")
            except Exception as e:
                print(f"[WARN] EasyOCR failed for {name}: {e}")
                pass

    # --- Select the best candidate ---
    if not ocr_results:
        print("[INFO] No text extracted by any OCR engine/variant/PSM mode.")
        return {
            "selected_ocr": "none",
            "ocr_confidence": 0.0, # Numeric confidence
            "text": "",
            "all_candidates": []
        }

    # Sort candidates by confidence_score (descending)
    ocr_results.sort(key=lambda x: x["confidence_score"], reverse=True)
    best_candidate = ocr_results[0]
    
    # Calculate overall confidence based on best candidate's metrics
    overall_confidence = 0.0
    if best_candidate["char_count"] > 0:
        # A more refined heuristic: penalize very short texts unless keyword density is high
        length_factor = min(1.0, best_candidate["char_count"] / 500.0) # Scale up to 500 chars
        # Ensure MEDICAL_KEYWORDS is accessible or passed if needed
        total_keywords_possible = len(MEDICAL_KEYWORDS) # Use the module-level MEDICAL_KEYWORDS
        keyword_factor = min(1.0, best_candidate["keyword_count"] / float(total_keywords_possible)) 
        
        # Combine factors, giving weight to keyword presence and text length
        # Add a small boost for higher character count or keyword match
        overall_confidence = max(0.1, min(0.99, (length_factor * 0.4) + (keyword_factor * 0.6)))
        # Further refine based on the raw confidence score for more granularity
        overall_confidence = (overall_confidence + min(1.0, best_candidate["confidence_score"] / 2000.0)) / 2
        # Cap confidence at 0.99 as it's a heuristic

    print(f"[INFO] Best OCR candidate: {best_candidate['engine']} on {best_candidate['variant']} (PSM {best_candidate.get('psm', 'N/A')}, Keywords: {best_candidate['keyword_count']}, Chars: {best_candidate['char_count']}, Score: {best_candidate['confidence_score']:.2f})")

    return {
        "selected_ocr": f"{best_candidate['engine']}_{best_candidate['variant']}_{best_candidate.get('psm', '')}".strip('_'),
        "ocr_confidence": overall_confidence,
        "text": best_candidate["text"],
        "all_candidates": ocr_results # Include all for debug/analysis if needed
    }
