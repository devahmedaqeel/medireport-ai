# Hybrid ML Parser Guide

The MediReport AI hybrid parser combines traditional rule-based logic with modern NLP models to achieve maximum reliability.

## Parsing Layers

1.  **Rule-based Layer**: Uses optimized regex patterns for highly structured data.
2.  **ML Classification Layer**: A TF-IDF based model that predicts the overall report type with high confidence.
3.  **Medical NER Layer**: A spaCy model that identifies specific medical entities (Test Names, Values, Units).
4.  **Ensemble Layer**: A voting mechanism that reconciles results and flags disagreements for manual review.

## Safety Principles

-   **Fallback First**: If ML models are missing or uncertain, the system silently falls back to the clinical rule parser.
-   **No Diagnosis**: Models are trained to extract data, never to provide definitive medical conclusions.
-   **Sanitization**: All output passes through a hallucination guard to ensure safe medical wording.
