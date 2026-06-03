# Safe Memory System Architecture

MediReport AI uses a safe, tiered memory system to improve over time without compromising medical integrity.

## Memory Types

1.  **Test Alias Memory**: Stores mappings of non-standard OCR text (e.g., "Haemo Globin") to standard medical markers ("Hemoglobin").
2.  **OCR Correction Memory**: Remembers persistent scan mistakes (e.g., "mg/di" -> "mg/dL").
3.  **Layout Memory**: Stores regex patterns for new lab report formats.
4.  **Verified Rule Memory**: Stores clinical patterns approved by medical experts.

## Verification Workflow

- **Tier 1: Static Rules**: Base JSON rules in `backend/rules/` are immutable and clinical-grade.
- **Tier 2: Verified Memory**: Data in `backend/memory/` that has been explicitly approved by an admin or doctor.
- **Tier 3: Pending Feedback**: Raw user corrections awaiting review.

**CRITICAL SAFETY**: No unverified user feedback (Tier 3) is ever used in the active parser. It must be moved to Tier 2 by a human clinical reviewer first.

## Self-Retraining
The system periodically aggregates verified memory to refine its heuristic weights. This process is triggered manually via the Admin Dashboard's "Trigger Full Pipeline" button.
