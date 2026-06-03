# Dataset Guide

## Folders
- raw_reports: original reports, never commit private data
- anonymized_reports: reports with personal data removed
- synthetic_reports: generated fake reports
- annotations: verified JSON labels
- ocr_outputs: OCR text results
- corrected_outputs: corrected OCR/parser outputs
- training_json: final training data
- test_set: holdout test data

## Privacy
Remove names, phone numbers, CNIC, address, lab ID, QR codes and doctor names before using real reports.

## Generate Synthetic Data
```bash
cd dataset/scripts
python generate_synthetic_reports.py
```
