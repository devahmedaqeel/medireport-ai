# Self-Learning & Clinical Safety Guardrails

This document outlines the safety mechanisms that prevent the self-learning system from making dangerous medical errors.

## 1. Safety Guardrail Service
All medical interpretations pass through `backend/services/safety_guardrail_service.py` before being sent to the user.
- **Phrase Sanitization**: definitive words like "you have" are replaced with "possible indication".
- **Disclaimer Injection**: Every response is checked for a mandatory doctor consultation warning.
- **Drug Blocking**: Any mention of specific medicines or dosages is automatically flagged and blocked.

## 2. The Verification Wall
The app never "learns" directly from user feedback. All user corrections enter a **Pending Queue**.
- Only a human clinical administrator can move a correction into the **Verified Memory**.
- This prevents "malicious learning" or incorrect user assumptions from polluting the system.

## 3. Low Confidence Handling
If a scan's extraction confidence is below **75%**, the app:
- Displays a visual warning: "Needs Manual Review".
- Advises the user to verify each numeric value against their original printed report.

## 4. Known Report Limitation
The system only provides detailed analysis for the **10 supported report types**. For unknown report types, it only shows raw extracted markers without providing any clinical trend analysis or risk assessment.
