# Next-Level Accuracy: Hybrid OCR & Safe Memory System

This update introduces a multi-stage clinical extraction pipeline designed for high accuracy while maintaining strict medical safety.

## 🚀 Accuracy Enhancements

### 1. Multi-Pass OCR Pipeline
Instead of a single scan, the system now:
- Generates 5 preprocessed versions of every image (Grayscale, Thresholded, Sharpened, Deskewed, and Original).
- Runs **Tesseract** on all versions.
- If available, runs **EasyOCR** as a comparison candidate.
- Selects the best text based on **Medical Keyword Coverage**.

### 2. Hybrid Layout-Aware Parser
The parser now uses two parallel methods:
- **Rule Parser**: Legacy line-by-line regex extraction.
- **Layout Table Parser**: Detects multi-column tabular structures common in Pakistani lab reports.
- **Confidence Voting**: An ensemble system that increases confidence when both parsers agree on a value.

### 3. Medical Sanity Checks
Automatic detection of common OCR typos in numeric values:
- `102` -> `10.2` (Decimal correction for Hemoglobin)
- `14OOO` -> `14000` (Alpha-to-numeric correction)
- `250` -> `250,000` (Unit normalization for Platelets)

## 🧠 Optional Memory Layer
A new "Memory" system allows the app to improve over time without breaking core logic.

- **Alias Memory**: Remembers new test names found in reports.
- **OCR Correction Memory**: Remembers persistent scan mistakes.
- **Fail-Safe**: If memory files are missing or corrupt, the system falls back to clinical defaults automatically.

## 🧪 Running Evaluation
To verify the accuracy of the new system:
```powershell
py dataset/scripts/run_memory_safe_evaluation.py
```

## 🛡️ Safety Limitations
- **No Diagnosis**: Memory is only used for extraction accuracy, NOT for medical diagnosis.
- **Wording**: All explanations pass through a guardrail service to ensure "possible indication" wording is used.
- **Manual Review**: Any extraction with <75% confidence is flagged for human verification.
