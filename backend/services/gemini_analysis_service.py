import os
import json
import re
import google.generativeai as genai
import time

# Configure Gemini API key
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    print("[INFO] Gemini API configured.")
else:
    print("[WARN] GEMINI_API_KEY not found in environment variables. Gemini AI fallback will not be available.")

# Initialize Gemini model
_gemini_model = None
if GEMINI_API_KEY:
    try:
        # Update to gemini-2.5-flash which is stable, multimodal, and fast
        _gemini_model = genai.GenerativeModel('gemini-2.5-flash')
        print("[INFO] Gemini-2.5-Flash model initialized.")
    except Exception as e:
        print(f"[ERROR] Failed to initialize Gemini model: {e}")
        _gemini_model = None


def standardize_test_item(item: dict) -> dict:
    """
    Standardizes a test item to ensure consistent snake_case and camelCase keys
    for compatibility across backend services and mobile app frontend.
    """
    test_name = item.get("testName") or item.get("test_name") or "Unknown Test"
    
    # Process numeric value
    val_raw = item.get("value")
    value = None
    if val_raw is not None:
        try:
            if isinstance(val_raw, str):
                # Clean up any non-numeric characters except decimal point
                cleaned_val = re.sub(r'[^\d\.]', '', val_raw)
                if cleaned_val:
                    value = float(cleaned_val) if '.' in cleaned_val else int(cleaned_val)
                else:
                    value = val_raw
            else:
                value = val_raw
        except:
            value = val_raw
            
    unit = item.get("unit") or ""
    ref_range = item.get("referenceRange") or item.get("reference_range") or "Not detected"
    
    low = item.get("rangeLow") or item.get("range_low")
    high = item.get("rangeHigh") or item.get("range_high")
    
    # If range bounds are not present, try parsing from reference range string
    if (low is None or high is None) and ref_range and ref_range != "Not detected":
        try:
            nums = [float(x) for x in re.findall(r"[-+]?\d+(?:\.\d+)?", ref_range)]
            if len(nums) == 2:
                low, high = nums[0], nums[1]
            elif len(nums) == 1:
                if "<" in ref_range:
                    high = nums[0]
                elif ">" in ref_range:
                    low = nums[0]
        except:
            pass
            
    status_raw = (item.get("status") or "Unknown").strip().lower()
    # Normalize AI status to our system's safe values
    status_map = {
        "normal": "normal",
        "high": "high",
        "low": "low",
        "needs_review": "needs_review",
        "unknown": "needs_review",
        "critical": "high",   # Will be properly re-evaluated in analysis_service safety pass
    }
    status = status_map.get(status_raw, "needs_review")
    
    # If no reference range found, force needs_review regardless of Gemini status
    if ref_range in ("Not Detected", "Not detected", "", None) or ref_range == "Not Detected":
        status = "needs_review"
    
    confidence = item.get("confidence") or 0.70
    try:
        confidence = float(confidence)
        confidence = max(0.0, min(1.0, confidence))
    except Exception:
        confidence = 0.70
        
    return {
        "test_name": test_name,
        "testName": test_name,
        "value": value,
        "unit": unit,
        "reference_range": ref_range,
        "referenceRange": ref_range,
        "range_low": low,
        "rangeLow": low,
        "range_high": high,
        "rangeHigh": high,
        "status": status,
        "confidence": confidence,
        "confidence_score": confidence,
        "needsManualReview": confidence < 0.75 or status == "needs_review",
        "method": "gemini_fallback",
    }


async def extract_markers_with_gemini(ocr_text: str) -> list:
    """
    Sends OCR text to Gemini AI to extract structured medical markers in JSON format.
    Returns a list of standardized dictionaries representing structured medical markers.
    """
    if not _gemini_model:
        print("[ERROR] Gemini model not available. Skipping AI fallback.")
        return []

    if not ocr_text or len(ocr_text) < 50: # Minimum text length for meaningful AI analysis
        print("[WARN] OCR text too short for Gemini analysis. Skipping AI fallback.")
        return []

    prompt = f"""
You are a medical lab report OCR extraction assistant. Your ONLY job is to extract test results 
that are EXPLICITLY printed on this lab report. 

CRITICAL SAFETY RULES (YOU MUST FOLLOW):
1. ONLY extract the 'reference_range' if it is EXPLICITLY printed on the report. 
   If it is NOT printed, set reference_range to "Not Detected".
2. NEVER invent, guess, or use training data to fill in reference ranges.
3. Determine 'status' ONLY by comparing value to the PRINTED reference range.
   If reference_range is "Not Detected", set status to "needs_review".
4. NEVER set status to "Critical" based on AI guessing. Only set it if value clearly violates a printed range.
5. confidence: how certain you are this value was clearly readable on the report (0.0-1.0).

Output as a JSON array with keys:
- "test_name": string (standard name, e.g. "Hemoglobin", "ALT")
- "value": number or string if non-numeric (null if not found)
- "unit": string (only if printed, else "")
- "reference_range": string (ONLY if printed on report, else "Not Detected")
- "range_low": number or null (parse from reference_range if it has a lower bound)
- "range_high": number or null (parse from reference_range if it has an upper bound)
- "status": "normal" | "high" | "low" | "needs_review" (rule-based from printed range ONLY)
- "confidence": float 0.0-1.0

OCR text from lab report:
---
{ocr_text}
---

Reply with ONLY the JSON array. No markdown, no explanation.
"""
    
    t_gemini_start = time.time()
    try:
        # Run synchronous generate_content call in executor thread to keep event loop non-blocking
        import asyncio
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(None, lambda: _gemini_model.generate_content(prompt))
        
        json_str = response.text.strip()
        
        # Gemini might wrap JSON in markdown code block
        if json_str.startswith("```json") and json_str.endswith("```"):
            json_str = json_str[7:-3].strip()
        elif json_str.startswith("```") and json_str.endswith("```"):
            json_str = json_str[3:-3].strip()

        gemini_results = json.loads(json_str)
        print(f"[INFO] Gemini AI extracted {len(gemini_results)} markers (took {time.time() - t_gemini_start:.2f}s)")
        
        validated_results = []
        for item in gemini_results:
            # We want to be lenient about incoming keys but strict about standardization
            has_name = "test_name" in item or "testName" in item
            has_val = "value" in item
            if has_name and has_val:
                standardized = standardize_test_item(item)
                validated_results.append(standardized)
            else:
                print(f"[WARN] Gemini returned malformed item: {item}. Skipping.")
        
        return validated_results
    except Exception as e:
        print(f"[ERROR] Gemini AI call failed: {e}")
        return []