from pathlib import Path
from fastapi import UploadFile
from PIL import Image
import pytesseract
import shutil
import uuid
import os
import tempfile # New import for temporary files
from pdf2image import convert_from_bytes # New import for PDF processing
from services.preprocessing_service import preprocess_image, preprocess_image_advanced
from services.multi_ocr_service import run_multi_ocr
import google.generativeai as genai

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Lazy initialization of PaddleOCR to speed up server boot and ensure stability
_paddle_ocr_client = None

def get_paddle_ocr_client():
    global _paddle_ocr_client
    if _paddle_ocr_client is None:
        try:
            print("[INFO] [OCR Pipeline] Initializing PaddleOCR...")
            from paddleocr import PaddleOCR
            # use_angle_cls=True auto-detects and corrects orientation/skew
            _paddle_ocr_client = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
            print("[INFO] [OCR Pipeline] PaddleOCR initialized successfully.")
        except Exception as e:
            print(f"[ERROR] [OCR Pipeline] Failed to initialize PaddleOCR: {e}")
            raise e
    return _paddle_ocr_client


def preprocess_for_paddle(image_path: Path) -> Path:
    """
    Applies image preprocessing tailored for PaddleOCR:
    - Grayscale conversion
    - CLAHE (contrast enhancement for lighting/shadow adjustment)
    - Bilateral filter (denoising while preserving character edges)
    - Custom sharpening kernel (sharpening text outlines)
    - Scaling up by 2x if the image dimensions are small
    """
    try:
        import cv2
        import numpy as np
        img = cv2.imread(str(image_path))
        if img is None:
            return image_path
        
        # 1. Grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # 2. Contrast Enhancement (CLAHE)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        contrast = clahe.apply(gray)
        
        # 3. Denoising (Bilateral Filter preserves edges better than Gaussian)
        denoised = cv2.bilateralFilter(contrast, 9, 75, 75)
        
        # 4. Sharpening (enhancing text character boundaries)
        kernel = np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]])
        sharpened = cv2.filter2D(denoised, -1, kernel)
        
        # 5. Resize / Upscale (if image is small, double the size)
        h, w = sharpened.shape[:2]
        if h < 1000 or w < 1000:
            sharpened = cv2.resize(sharpened, (w * 2, h * 2), interpolation=cv2.INTER_LANCZOS4)
            
        # Save preprocessed image to a temp file
        preprocessed_path = image_path.parent / f"prep_{image_path.name}"
        cv2.imwrite(str(preprocessed_path), sharpened)
        return preprocessed_path
    except Exception as e:
        print(f"[WARN] [OCR Preprocessing] Preprocessing for PaddleOCR failed: {e}. Using original image.")
        return image_path


def run_paddle_ocr(image_path: Path) -> str:
    """
    Runs PaddleOCR on the specified image and reconstructs extracted text
    line-by-line using horizontal Y-coordinate grouping to preserve reading layout.
    """
    try:
        ocr_client = get_paddle_ocr_client()
        result = ocr_client.ocr(str(image_path), cls=True)
        if not result or not result[0]:
            print("[WARN] [OCR Pipeline] PaddleOCR returned empty result.")
            return ""
        
        # Reconstruct lines based on Y-coordinate clustering to preserve horizontal order
        lines_dict = {}
        for line in result[0]:
            box = line[0]
            text, conf = line[1]
            
            # Use average Y-coordinate of the box to group into lines
            y_coords = [p[1] for p in box]
            avg_y = sum(y_coords) / len(y_coords)
            
            placed = False
            for line_y in lines_dict.keys():
                if abs(line_y - avg_y) < 15: # 15px threshold for same-line text elements
                    lines_dict[line_y].append((box[0][0], text)) # store (x_coordinate, text)
                    placed = True
                    break
            
            if not placed:
                lines_dict[avg_y] = [(box[0][0], text)]
        
        # Sort lines by Y-coordinate
        sorted_y = sorted(lines_dict.keys())
        reconstructed_lines = []
        for y in sorted_y:
            # Sort words inside this line by X-coordinate
            sorted_line = sorted(lines_dict[y], key=lambda item: item[0])
            line_text = " ".join([item[1] for item in sorted_line])
            reconstructed_lines.append(line_text)
            
        full_text = "\n".join(reconstructed_lines)
        return full_text
    except Exception as e:
        print(f"[ERROR] [OCR Pipeline] PaddleOCR run failed: {e}")
        return ""


def cleanup_ocr_text(text: str) -> str:
    replacements = {
        "mg/di": "mg/dL",
        "mg/dl": "mg/dL",
        "g/di": "g/dL",
        "g/dl": "g/dL",
        "pg/di": "pg/mL",
        "pg/dl": "pg/mL",
        "pg/ml": "pg/mL",
        "ng/di": "ng/mL",
        "ng/dl": "ng/mL",
        "ng/ml": "ng/mL",
        "µl": "uL",
        "μl": "uL",
        "u/l": "U/L",
        "mmol/l": "mmol/L",
        "mmoi/l": "mmol/L",
        "umol/l": "umol/L",
        "umoi/l": "umol/L",
        "miu/l": "mIU/L",
        "mlu/l": "mIU/L",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    lines = [" ".join(line.split()) for line in text.splitlines() if line.strip()]
    return "\n".join(lines)


# Configure Tesseract path if provided in .env
tesseract_path = os.getenv("TESSERACT_PATH")
tesseract_installed = False

if not tesseract_path and os.name == 'nt': # If on Windows and path not set in .env
    # Try common Tesseract installation paths on Windows
    default_windows_paths = [
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"
    ]
    for path in default_windows_paths:
        if os.path.exists(path):
            tesseract_path = path
            print(f"[INFO] Auto-detected Tesseract-OCR at: {tesseract_path}")
            break

if tesseract_path:
    pytesseract.pytesseract.tesseract_cmd = tesseract_path
    try:
        tesseract_version = pytesseract.get_tesseract_version()
        print(f"[INFO] Tesseract-OCR version detected: {tesseract_version}")
        tesseract_installed = True
    except pytesseract.TesseractNotFoundError:
        print("[ERROR] Tesseract-OCR command not found. Ensure it's installed and in PATH, or TESSERACT_PATH is set in .env.")
        tesseract_installed = False
    except Exception as e:
        print(f"[ERROR] Error checking Tesseract version: {e}")
        tesseract_installed = False
else:
    print("[ERROR] TESSERACT_PATH is not set in .env and auto-detection failed. Tesseract-OCR may not be available.")
    if os.name == 'nt':
        print("     For Windows, you can install Tesseract-OCR via winget: 'winget install UB-Mannheim.TesseractOCR'")
        print("     Or download from: https://tesseract-ocr.github.io/tessdoc/Downloads.html")
        print("     Then set TESSERACT_PATH in your .env file to the path of tesseract.exe (e.g., TESSERACT_PATH=C:\\Program Files\\Tesseract-OCR\\tesseract.exe)")
    tesseract_installed = False


# Configure Gemini API for Multimodal OCR
gemini_api_key = os.getenv("GEMINI_API_KEY")
gemini_client = None

if gemini_api_key:
    try:
        genai.configure(api_key=gemini_api_key)
        gemini_client = genai.GenerativeModel('gemini-2.5-flash')
        print("[INFO] Gemini OCR model (gemini-2.5-flash) initialized successfully.")
    except Exception as e:
        print(f"[ERROR] Failed to initialize Gemini OCR model: {e}")
        gemini_client = None

# Configure OCR.space API
ocr_space_api_key = os.getenv("OCR_SPACE_API_KEY")
if ocr_space_api_key:
    print("[INFO] OCR.space API key configured.")
else:
    print("[WARN] OCR_SPACE_API_KEY not found in environment variables. OCR.space fallback will not be available.")


# Configure Eden AI API
edenai_api_key = os.getenv("EDENAI_API_KEY")
if edenai_api_key:
    print("[INFO] Eden AI API key configured.")
else:
    print("[WARN] EDENAI_API_KEY not found in environment variables. Eden AI fallback will not be available.")


async def run_eden_ai_ocr(image_path: Path) -> str:
    if not edenai_api_key:
        return ""
    try:
        import httpx
        print(f"[INFO] Attempting Eden AI OCR API for image: {image_path}")
        headers = {
            "Authorization": f"Bearer {edenai_api_key}"
        }
        payload = {
            "providers": "google,microsoft",
            "language": "en"
        }
        with open(image_path, "rb") as f:
            files = {
                "file": (image_path.name, f, "image/png")
            }
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "https://api.edenai.run/v2/ocr/ocr",
                    data=payload,
                    files=files,
                    headers=headers
                )
        if response.status_code == 200:
            result = response.json()
            results_dict = result.get("results", result)
            
            # Check providers in order of preference
            for provider in ["google", "microsoft"]:
                prov_res = results_dict.get(provider, {})
                if prov_res.get("status") == "success":
                    boxes = prov_res.get("bounding_boxes", [])
                    if boxes:
                        # Reconstruct text using bounding boxes to preserve layout!
                        lines_dict = {}
                        for box in boxes:
                            text_val = box.get("text", "").strip()
                            if not text_val:
                                continue
                            
                            # Coordinates: left, top, width, height (normalized 0 to 1)
                            top = box.get("top", 0.0)
                            left = box.get("left", 0.0)
                            
                            # Group by top coordinate (using a tolerance of 0.015 or 1.5% of page height)
                            placed = False
                            for line_top in lines_dict.keys():
                                if abs(line_top - top) < 0.015:
                                    lines_dict[line_top].append((left, text_val))
                                    placed = True
                                    break
                            if not placed:
                                lines_dict[top] = [(left, text_val)]
                                
                        # Sort lines by top coordinate
                        sorted_tops = sorted(lines_dict.keys())
                        reconstructed_lines = []
                        for t_coord in sorted_tops:
                            # Sort words inside this line by left coordinate
                            sorted_line = sorted(lines_dict[t_coord], key=lambda item: item[0])
                            line_text = " ".join([item[1] for item in sorted_line])
                            reconstructed_lines.append(line_text)
                            
                        full_text = "\n".join(reconstructed_lines)
                        if full_text.strip():
                            print(f"[INFO] Eden AI OCR success via provider: {provider} (Layout Reconstructed)")
                            return full_text
                            
                    # Fallback to raw extracted_text if bounding_boxes not present or empty
                    text = prov_res.get("extracted_text", "").strip()
                    if text:
                        print(f"[INFO] Eden AI OCR success via provider: {provider} (Raw Text)")
                        return text
                        
            # Fallback to any success provider
            for key, val in results_dict.items():
                if isinstance(val, dict) and val.get("status") == "success":
                    boxes = val.get("bounding_boxes", [])
                    if boxes:
                        lines_dict = {}
                        for box in boxes:
                            text_val = box.get("text", "").strip()
                            if not text_val: continue
                            top = box.get("top", 0.0)
                            left = box.get("left", 0.0)
                            placed = False
                            for line_top in lines_dict.keys():
                                if abs(line_top - top) < 0.015:
                                    lines_dict[line_top].append((left, text_val))
                                    placed = True
                                    break
                            if not placed:
                                lines_dict[top] = [(left, text_val)]
                        sorted_tops = sorted(lines_dict.keys())
                        reconstructed_lines = []
                        for t_coord in sorted_tops:
                            sorted_line = sorted(lines_dict[t_coord], key=lambda item: item[0])
                            line_text = " ".join([item[1] for item in sorted_line])
                            reconstructed_lines.append(line_text)
                        full_text = "\n".join(reconstructed_lines)
                        if full_text.strip():
                            print(f"[INFO] Eden AI OCR success via provider: {key} (Layout Reconstructed)")
                            return full_text

                    text = val.get("extracted_text", "").strip()
                    if text:
                        print(f"[INFO] Eden AI OCR success via provider: {key} (Raw Text)")
                        return text
            print("[WARN] Eden AI API returned no successful provider text.")
        else:
            print(f"[ERROR] Eden AI API request failed with status: {response.status_code} | {response.text}")
    except Exception as e:
        print(f"[WARN] Eden AI API call failed: {e}")
    return ""


async def run_ocr_space(image_path: Path) -> str:
    if not ocr_space_api_key:
        return ""
    try:
        import httpx
        print(f"[INFO] Attempting OCR.space API for image: {image_path}")
        payload = {
            "apikey": ocr_space_api_key,
            "language": "eng",
            "isTable": "true",
            "scale": "true"
        }
        with open(image_path, "rb") as f:
            files = {
                "file": (image_path.name, f, "image/png")
            }
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "https://api.ocr.space/parse/image",
                    data=payload,
                    files=files
                )
        if response.status_code == 200:
            result = response.json()
            if result.get("IsErroredOnProcessing"):
                print(f"[ERROR] OCR.space API error: {result.get('ErrorMessage')}")
                return ""
            parsed_results = result.get("ParsedResults", [])
            if parsed_results:
                text = parsed_results[0].get("ParsedText", "").strip()
                return text
            else:
                print("[WARN] OCR.space API returned no parsed results.")
        else:
            print(f"[ERROR] OCR.space API request failed with status: {response.status_code}")
    except Exception as e:
        print(f"[WARN] OCR.space API call failed: {e}")
    return ""


async def extract_text_from_upload(file: UploadFile, userId: str = "guest"):
    import time
    t_start = time.time()
    print(f"[TIMING] Start processing upload. Filename: {file.filename}")

    suffix = Path(file.filename).suffix.lower() or ".png"
    raw_path = UPLOAD_DIR / f"{uuid.uuid4().hex}{suffix}"
    
    t_save = time.time()
    with raw_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    print(f"[TIMING] File saved to disk in {time.time() - t_save:.4f}s")

    # File size check (max 10MB)
    file_size = raw_path.stat().st_size
    print(f"[INFO] [OCR Pipeline] Uploaded File: '{file.filename}' | Type: '{file.content_type}' | Size: {file_size} bytes")
    if file_size > 10 * 1024 * 1024:
        raw_path.unlink(missing_ok=True)
        print(f"[ERROR] Uploaded image is too large ({file_size} bytes)")
        return {
            "success": False,
            "error": "Image file is too large (max 10MB). Please compress the image or use manual entry."
        }

    ocr_start = time.time()
    all_temp_image_paths_to_clean = []

    # Handle PDF files
    if file.content_type == "application/pdf":
        try:
            pdf_bytes = raw_path.read_bytes()
            with tempfile.TemporaryDirectory(dir=UPLOAD_DIR) as temp_pdf_img_dir:
                print(f"[DEBUG] Processing PDF file: {file.filename}. Images will be saved to temp dir: {temp_pdf_img_dir}")
                images = convert_from_bytes(pdf_bytes, fmt='png')
                for i, pil_image in enumerate(images):
                    temp_image_path = Path(temp_pdf_img_dir) / f"{uuid.uuid4().hex}_page_{i}.png"
                    pil_image.save(temp_image_path)
                    all_temp_image_paths_to_clean.append(temp_image_path)
        except Exception as e:
            print(f"[ERROR] Failed to convert PDF to images: {e}")
            raw_path.unlink(missing_ok=True)
            return {
                "success": False,
                "ocr_text": "",
                "markers_detected": [],
                "tests": [],
                "confidence": "low",
                "ocrEngine": "failed",
                "engine_used": "failed",
                "filename": file.filename,
                "imageUrl": "",
                "needs_review": True,
                "rejection_reason": f"PDF conversion failed: {e}"
            }
    else:
        all_temp_image_paths_to_clean.append(raw_path)
        print(f"[DEBUG] Processing image file: {file.filename}")

    # Process each image / page
    final_text_parts = []
    final_confidences = []
    final_engines = []

    for img_path in all_temp_image_paths_to_clean:
        text_extracted = False
        extracted_text = ""
        
        # 1. Try PaddleOCR first
        try:
            print(f"[INFO] [OCR Engine] Attempting PaddleOCR (Primary) for: {img_path.name}")
            prep_path = preprocess_for_paddle(img_path)
            
            extracted_text = run_paddle_ocr(prep_path)
            
            # Clean up the preprocessed temp file
            if prep_path != img_path:
                prep_path.unlink(missing_ok=True)
                
            if extracted_text and len(extracted_text.strip()) > 0:
                final_text_parts.append(cleanup_ocr_text(extracted_text))
                final_confidences.append(0.95) # High confidence rating for PaddleOCR
                final_engines.append("paddleocr")
                text_extracted = True
                print(f"[INFO] [OCR Success] PaddleOCR successfully extracted {len(extracted_text)} characters.")
            else:
                print("[WARN] [OCR Fallback] PaddleOCR returned empty text.")
        except Exception as e:
            print(f"[WARN] [OCR Fallback] PaddleOCR failed or not installed: {e}")
            
        # 2. Fallback 1: OCR.space API
        if not text_extracted and ocr_space_api_key:
            try:
                print(f"[INFO] [OCR Engine] Falling back to OCR.space API (Fallback 1) for: {img_path.name}")
                extracted_text = await run_ocr_space(img_path)
                if extracted_text and len(extracted_text.strip()) > 0:
                    final_text_parts.append(cleanup_ocr_text(extracted_text))
                    final_confidences.append(0.92)
                    final_engines.append("ocr_space")
                    text_extracted = True
                    print(f"[INFO] [OCR Success] OCR.space successfully extracted {len(extracted_text)} characters.")
                else:
                    print("[WARN] [OCR Fallback] OCR.space returned empty text.")
            except Exception as e:
                print(f"[WARN] [OCR Fallback] OCR.space API failed: {e}")
                
        # 3. Fallback 2: Gemini 2.5 Flash
        if not text_extracted and gemini_client:
            try:
                print(f"[INFO] [OCR Engine] Falling back to Gemini 2.5 Flash (Fallback 2) for: {img_path.name}")
                pil_img = Image.open(img_path)
                prompt = (
                    "Extract all medical test results, values, units, and reference ranges from this lab report image. "
                    "Return ONLY the plain text content of the report. Keep the formatting clean and preserve "
                    "the association between test names, values, units, and ranges on each line. Do not add markdown or explanation."
                )
                import asyncio
                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(None, lambda: gemini_client.generate_content([pil_img, prompt]))
                pil_img.close()
                
                if response and response.text:
                    extracted_text = response.text.strip()
                    if extracted_text and len(extracted_text.strip()) > 0:
                        final_text_parts.append(cleanup_ocr_text(extracted_text))
                        final_confidences.append(0.98)
                        final_engines.append("gemini_2.5_flash")
                        text_extracted = True
                        print(f"[INFO] [OCR Success] Gemini 2.5 Flash successfully extracted {len(extracted_text)} characters.")
                    else:
                        print("[WARN] [OCR Fallback] Gemini returned empty text.")
            except Exception as e:
                print(f"[WARN] [OCR Fallback] Gemini AI failed: {e}")
                
        # 4. Fallback 3: Tesseract local
        if not text_extracted:
            if tesseract_installed:
                try:
                    print(f"[INFO] [OCR Engine] Falling back to Tesseract OCR (Fallback 3) for: {img_path.name}")
                    image_variants = preprocess_image_advanced(str(img_path), str(img_path.with_name(img_path.stem + "_v")))
                    multi_res = run_multi_ocr(image_variants)
                    
                    # Clean up variants
                    for _, v_path in image_variants.items():
                        if Path(v_path).exists() and Path(v_path) != img_path and Path(v_path) != raw_path:
                            Path(v_path).unlink(missing_ok=True)
                            
                    extracted_text = multi_res["text"]
                    if extracted_text and len(extracted_text.strip()) > 0:
                        final_text_parts.append(cleanup_ocr_text(extracted_text))
                        final_confidences.append(multi_res["ocr_confidence"])
                        final_engines.append(multi_res["selected_ocr"])
                        text_extracted = True
                        print(f"[INFO] [OCR Success] Tesseract successfully extracted {len(extracted_text)} characters.")
                except Exception as e:
                    print(f"[WARN] [OCR Fallback] Tesseract failed: {e}")
            else:
                print("[WARN] [OCR Engine] Tesseract is not installed/configured.")

        # 5. Fallback 4: Eden AI API
        if not text_extracted and edenai_api_key:
            try:
                print(f"[INFO] [OCR Engine] Falling back to Eden AI API (Fallback 4) for: {img_path.name}")
                extracted_text = await run_eden_ai_ocr(img_path)
                if extracted_text and len(extracted_text.strip()) > 0:
                    final_text_parts.append(cleanup_ocr_text(extracted_text))
                    final_confidences.append(0.96) # High confidence rating for Eden AI
                    final_engines.append("edenai")
                    text_extracted = True
                    print(f"[INFO] [OCR Success] Eden AI successfully extracted {len(extracted_text)} characters.")
                else:
                    print("[WARN] [OCR Fallback] Eden AI returned empty text.")
            except Exception as e:
                print(f"[WARN] [OCR Fallback] Eden AI API failed: {e}")
                
        # Handle complete failure
        if not text_extracted:
            print(f"[ERROR] [OCR Pipeline] All OCR engines failed for: {img_path.name}")
            final_text_parts.append("")
            final_confidences.append(0.0)
            final_engines.append("failed")
            
        if img_path != raw_path:
            img_path.unlink(missing_ok=True)
            
    text = "\n\n".join(final_text_parts).strip()
    confidence = sum(final_confidences) / len(final_confidences) if final_confidences else 0.0
    
    selected_engine = "mixed"
    if len(set(final_engines)) == 1 and final_engines:
        selected_engine = final_engines[0]
    elif not final_engines:
        selected_engine = "none"
        
    ocr_end = time.time()
    print(f"[TIMING] OCR processing completed in {ocr_end - ocr_start:.2f} seconds")

    # If Supabase Storage is active, upload the raw file to Supabase Storage before we delete it
    image_url = ""
    from services.supabase_service import supabase_active
    from services.supabase_service import supabase
    if supabase_active and raw_path.exists():
        t_storage = time.time()
        import datetime
        timestamp = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        unique_id = uuid.uuid4().hex[:8]
        destination = f"{userId}/{timestamp}_{unique_id}{suffix}"
        
        try:
            with open(raw_path, 'rb') as f:
                supabase.storage.from_("reports").upload(destination, f)
                image_url = supabase.storage.from_("reports").get_public_url(destination)
            print(f"[OK] [Storage] Successfully uploaded scan to reports/{destination} -> {image_url} (took {time.time() - t_storage:.2f}s)")
        except Exception as e:
            print(f"[ERROR] [Storage] Upload failed: {e}")

    # Now safely cleanup the initially saved raw file
    raw_path.unlink(missing_ok=True)
    
    print(f"[INFO] [OCR Summary] Active Engine: {selected_engine} | Chars Extracted: {len(text)}")
    print(f"[INFO] [OCR Output (First 500 chars)]: \n{text[:500]}{'...' if len(text) > 500 else ''}")
    
    # Map numeric confidence to descriptive strings
    confidence_str = "high"
    if confidence is None:
        confidence_str = "unknown"
    elif confidence < 0.6:
        confidence_str = "low"
    elif confidence < 0.8:
        confidence_str = "medium"

    has_text = len(text) > 0

    return {
        "success": has_text,
        "ocr_text": text,
        "engine_used": selected_engine,
        "ocrEngine": selected_engine,
        "markers_detected": [],
        "tests": [],
        "confidence": confidence_str,
        "filename": file.filename,
        "imageUrl": image_url,
        "needs_review": True if confidence_str == "low" or not has_text else False,
        "rejection_reason": None if has_text else "No readable text extracted from image after all OCR attempts.",
        "message": "OCR completed successfully" if has_text else "No readable text extracted from image after all OCR attempts."
    }
