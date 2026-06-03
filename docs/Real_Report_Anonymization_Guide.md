# Real Report Anonymization Guide

Medical privacy is our absolute priority. This guide details the mandatory anonymization steps for real reports.

## 1. Automatic Masking
The `anonymize_real_reports.py` script automatically removes:
-   Full Patient Names
-   Phone Numbers
-   CNIC / ID Numbers
-   Email Addresses
-   Specific Home Addresses

## 2. Mandatory Verification
Before any real report data is used for training:
-   An admin must review the text to ensure no PII was missed.
-   The report must be moved to the `verified/` folder only after this audit.
-   Do not use reports with visible patient photographs.

## 3. Data Retention
Raw reports containing PII should be deleted immediately after a successful anonymization run.
