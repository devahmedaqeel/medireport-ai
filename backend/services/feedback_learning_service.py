import json
from pathlib import Path
from services.memory_service import add_pending_correction, approve_correction

def submit_correction(user_id, report_id, original_data, corrected_data, category):
    """
    Submits a correction from the mobile app for admin review.
    category can be: 'ocr', 'test_name', 'value', 'range', 'unit'
    """
    # 1. Map category to memory types
    m_type = "ocr" if category == "ocr" else "alias"
    
    # 2. Save to pending memory
    add_pending_correction(user_id, report_id, original_data, corrected_data, m_type)
    
    return {"status": "success", "message": "Correction submitted for clinical review."}

def get_all_pending_feedback():
    memory_path = Path(__file__).resolve().parent.parent / "memory" / "pending_feedback_memory.json"
    if not memory_path.exists(): return []
    return json.loads(memory_path.read_text(encoding="utf-8"))

def process_feedback(feedback_id, action):
    """
    action: 'approve' or 'reject'
    """
    if action == "approve":
        return approve_correction(feedback_id)
    else:
        # Move to rejected memory (simple version)
        return True # For now just return True
