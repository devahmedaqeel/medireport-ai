# Limitations and Medical Safety Guidelines — MediReport AI

This document establishes the official medical safety guidelines, compliance statements, and remaining technical limitations of the **MediReport AI** application.

---

## ⚠️ Medical Safety Disclaimer

> [!IMPORTANT]
> **This app does not provide final diagnosis. It provides AI-assisted report interpretation and should be verified by a qualified doctor.**
>
> MediReport AI is an educational tool designed to help patients understand their lab report parameters. It is **NOT** a medical diagnostic device, clinical decision support system, or treatment planner. All decisions regarding medical treatments, diagnoses, or clinical evaluations must be made in consultation with a qualified medical professional.

---

## 🛠️ Remaining System Limitations

While the parser achieves high accuracy across standard templates, users should be aware of the following edge-case limitations:

### 1. Mixed Qualitative Indicators
For certain urinalysis or pathology parameters (e.g. Epithelial Cells, Pus Cells, Urine RBC) containing non-numeric symbols or mixed qualitative boundaries, the parser may occasionally require manual oversight.

### 2. High-Noise OCR Inputs
If a scanned image or document is heavily blurred, suffers from low contrast, or contains physical obstructions (e.g. folds, hand-written scribbles overlapping text), name mapping and character extraction may fail to detect standard patterns.

### 3. Non-Standard Layouts
Reports featuring complex multi-column grids or unstructured paragraphs may cause the line table parser to skip lines, causing the ensemble parser to fall back on ML NER.
