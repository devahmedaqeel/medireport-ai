from pathlib import Path
import cv2
import numpy as np
import os # New import
import tempfile # New import


def deskew(image):
    """Corrects image rotation/skew."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.bitwise_not(gray)
    coords = np.column_stack(np.where(gray > 0))
    angle = cv2.minAreaRect(coords)[-1]
    if angle < -45:
        angle = -(90 + angle)
    else:
        angle = -angle
    (h, w) = image.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(image, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    return rotated

def find_document_contour_and_crop(image):
    """
    Attempts to find the main document contour and crop the image to it.
    Returns the cropped image or the original if no clear contour is found.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edged = cv2.Canny(blurred, 75, 200)

    # Find contours
    contours, _ = cv2.findContours(edged.copy(), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    
    # Sort the contours by their area in descending order and grab the largest ones
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:5]

    screenCnt = None
    for c in contours:
        # Approximate the contour
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)

        # If our approximated contour has four points, then we can assume we have found our screen
        if len(approx) == 4:
            screenCnt = approx
            break

    if screenCnt is not None:
        # Get the bounding rectangle for the contour
        x, y, w, h = cv2.boundingRect(screenCnt)
        cropped_image = image[y:y+h, x:x+w]
        print(f"[DEBUG] Cropped image to document contour: x={x}, y={y}, w={w}, h={h}")
        return cropped_image
    
    print("[DEBUG] No clear document contour found, returning original image.")
    return image

def adjust_for_lighting(image):
    """
    Applies adaptive histogram equalization (CLAHE) to improve contrast,
    especially useful for low-light or shadowed images.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    enhanced_gray = clahe.apply(gray)
    
    # Convert back to BGR if the rest of the pipeline expects it, or keep grayscale
    # For OCR, often grayscale is sufficient, but for consistent output, let's make it 3-channel
    enhanced_bgr = cv2.cvtColor(enhanced_gray, cv2.COLOR_GRAY2BGR)
    print("[DEBUG] Applied adaptive lighting adjustment.")
    return enhanced_bgr


def preprocess_image_advanced(input_path: str, output_prefix: str) -> dict:
    """
    Generates multiple preprocessed versions of an image for multi-pass OCR.
    Includes document cropping, adaptive lighting, and other enhancements.
    Returns a dict mapping version names to their output paths.
    """
    image = cv2.imread(input_path)
    if image is None:
        print(f"[ERROR] Could not read image from {input_path}")
        return {"original": input_path}

    results = {"original": input_path}
    base_path = Path(output_prefix)
    base_path.parent.mkdir(parents=True, exist_ok=True)

    processed_image = image.copy()

    # 0. Auto-detect and crop document area first
    processed_image = find_document_contour_and_crop(processed_image)
    
    # Convert to grayscale immediately for most operations
    gray = cv2.cvtColor(processed_image, cv2.COLOR_BGR2GRAY)
    
    # 1. Grayscale (saved for direct OCR if needed)
    gray_path = str(base_path.with_name(base_path.stem + "_gray.png"))
    cv2.imwrite(gray_path, gray)
    results["grayscale"] = gray_path

    # 2. Denoised (apply on grayscale)
    denoised = cv2.fastNlMeansDenoising(gray, None, h=30, templateWindowSize=7, searchWindowSize=21)
    denoised_path = str(base_path.with_name(base_path.stem + "_denoised.png"))
    cv2.imwrite(denoised_path, denoised)
    results["denoised"] = denoised_path

    # 3. Adaptive Thresholding (applied on denoised)
    thresh = cv2.adaptiveThreshold(denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)
    thresh_path = str(base_path.with_name(base_path.stem + "_thresh.png"))
    cv2.imwrite(thresh_path, thresh)
    results["thresholded"] = thresh_path

    # 4. Contrast Enhancement (applied on grayscale)
    contrast_enhanced = cv2.convertScaleAbs(gray, alpha=1.5, beta=0) 
    contrast_path = str(base_path.with_name(base_path.stem + "_contrast.png"))
    cv2.imwrite(contrast_path, contrast_enhanced)
    results["contrast_enhanced"] = contrast_path

    # 5. Sharpened (applied on grayscale)
    kernel = np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]])
    sharpened = cv2.filter2D(gray, -1, kernel)
    sharp_path = str(base_path.with_name(base_path.stem + "_sharp.png"))
    cv2.imwrite(sharp_path, sharpened)
    results["sharpened"] = sharp_path

    # 6. Low-light/Shadow adjusted (applied on original processed_image, then converted to gray)
    lighting_adjusted_bgr = adjust_for_lighting(processed_image)
    lighting_adjusted_gray = cv2.cvtColor(lighting_adjusted_bgr, cv2.COLOR_BGR2GRAY)
    lighting_path = str(base_path.with_name(base_path.stem + "_light_adj.png"))
    cv2.imwrite(lighting_path, lighting_adjusted_gray)
    results["lighting_adjusted"] = lighting_path
    
    # 7. Resized 2x (applied on grayscale for higher resolution OCR)
    h, w = gray.shape
    resized_2x = cv2.resize(gray, (w * 2, h * 2), interpolation=cv2.INTER_LANCZOS4)
    resized_path = str(base_path.with_name(base_path.stem + "_resized2x.png"))
    cv2.imwrite(resized_path, resized_2x)
    results["resized2x"] = resized_path

    # 8. Deskewed (applied on original processed_image, then converted to gray)
    try:
        rotated_bgr = deskew(processed_image)
        rotated_gray = cv2.cvtColor(rotated_bgr, cv2.COLOR_BGR2GRAY)
        rotated_path = str(base_path.with_name(base_path.stem + "_rotated.png"))
        cv2.imwrite(rotated_path, rotated_gray)
        results["deskewed"] = rotated_path
    except Exception as e:
        print(f"[WARN] Deskewing failed for {input_path}: {e}")
        pass

    return results


def preprocess_image(input_path: str, output_path: str) -> str:
    """Legacy wrapper for backward compatibility."""
    image = cv2.imread(input_path)
    if image is None: return input_path
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.fastNlMeansDenoising(gray, None, 30, 7, 21)
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    cv2.imwrite(output_path, thresh)
    return output_path
