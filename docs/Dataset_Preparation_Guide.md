# Dataset Preparation Guide

This guide details how to manage and prepare data for MediReport AI training cycles.

## 1. Synthetic Data
Synthetic reports are the primary training source. They are generated using:
```powershell
py dataset/scripts/generate_synthetic_reports.py
```
This script creates a balanced distribution of 3000+ reports across all supported categories.

## 2. Real World Data Pipeline
To use real reports for training:
1.  Place raw files in `dataset/real_reports_raw/`.
2.  Run `py dataset/scripts/anonymize_real_reports.py` to strip PII.
3.  Manually verify the generated JSON in `dataset/real_reports_verified/`.
4.  Run `py dataset/scripts/prepare_real_reports_for_training.py` to ingest.

## 3. Data Partitions
The system automatically splits data into 70% Train, 15% Validation, and 15% Test during the training initiation.
