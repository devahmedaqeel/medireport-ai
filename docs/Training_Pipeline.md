# MediReport AI Training Pipeline

This document explains how the self-learning and training system works.

## Pipeline Overview

1.  **Synthetic Data Generation**: `generate_synthetic_reports.py` creates thousands of realistic lab reports with intentional OCR noise and varying formats.
2.  **User Corrections**: When a user fixes an OCR value in the mobile app, it is sent to the "Pending Clinical Review" queue.
3.  **Clinical Verification**: Administrators/Doctors review pending corrections in the Admin Dashboard.
4.  **Verified Memory Update**: Approved corrections update `alias_memory.json` and `ocr_correction_memory.json`.
5.  **Heuristic Training**: `train_parser_model.py` updates the parser's logic based on verified memory.
6.  **Full Evaluation**: The system runs automated tests across 4 metrics to verify accuracy.

## How to run the pipeline

To run the complete automated pipeline (data generation + training + evaluation), use:

```powershell
# From the project root
py dataset/scripts/run_full_training_pipeline.py
```

## Metrics Tracked

- **Report Detection Accuracy**: How well the system identifies the type (CBC, FBS, etc.). Target: >95%.
- **Test Extraction Precision**: Correctly matching OCR text to standard medical markers. Target: >90%.
- **Value Extraction Accuracy**: Precise reading of numeric results. Target: >90%.
- **Indication Recall**: Providing relevant clinical explanations for abnormal values. Target: >85%.

## Versioning
Every pipeline run updates `backend/models/version.json` with the latest accuracy stats and training sample counts.
