# MediReport AI: ML Training Guide

This guide explains how to run the full ML/NLP training pipeline.

## 1. Prerequisites
Ensure you have the required dependencies installed:
```powershell
cd backend
py -m pip install -r requirements.txt
```

## 2. Generate Synthetic Data
Generates 3000 labeled reports for training.
```powershell
py dataset/scripts/generate_synthetic_reports.py
```

## 3. Prepare Real Reports (Optional)
If you have real anonymized reports:
```powershell
py dataset/scripts/anonymize_real_reports.py
py dataset/scripts/process_real_reports_ocr.py
py dataset/scripts/create_real_annotation_template.py
# (After manual verification in verified/ folder)
py dataset/scripts/prepare_real_reports_for_training.py
```

## 4. Train Report Classifier
Trains a TF-IDF model for report type detection.
```powershell
py dataset/scripts/train_report_classifier.py
```

## 5. Train Medical NER
Trains a spaCy NER model for entity extraction.
```powershell
py dataset/scripts/convert_annotations_to_spacy_ner.py
py dataset/scripts/train_medical_ner.py
```

## 6. Evaluate All Models
Compares Rule vs ML vs Hybrid accuracy.
```powershell
py dataset/scripts/evaluate_ml_models.py
```
Check the results in `docs/ML_Model_Evaluation_Report.md`.
