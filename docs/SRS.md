# Software Requirements Specification — MediReport AI

## 1. Introduction
MediReport AI is a mobile-based medical lab report scanner that extracts lab values using OCR, detects abnormal results, and provides safe disease-risk indications.

## 2. Problem Statement
Patients often cannot understand medical lab reports. This system helps them identify abnormal values and know when to consult a doctor.

## 3. Scope
The system supports common lab reports such as CBC, Sugar, HbA1c, Lipid, KFT, LFT, Thyroid and Urine reports.

## 4. Functional Requirements
- Scan/upload report image
- Extract OCR text
- Preview and edit OCR text
- Parse tests/values/units/ranges
- Detect normal/abnormal values
- Provide possible risk indications
- Generate English/Roman Urdu explanation
- Save history
- Generate PDF summary
- Admin manages rules and feedback

## 5. Non-Functional Requirements
- 90%+ extraction target on supported reports
- 95%+ abnormality detection target when extraction is correct
- Safe medical wording
- Secure report handling

## 6. Safety Requirement
The system must not provide final diagnosis, medicine, dosage, or treatment.
