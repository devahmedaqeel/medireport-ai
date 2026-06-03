from fastapi import APIRouter, Body
from services.memory_service import get_memory_status, add_pending_correction

router = APIRouter()

@router.get("/status")
def memory_status():
    return get_memory_status()

@router.post("/feedback")
def submit_feedback(payload: dict = Body(...)):
    """
    Submits user correction to memory layer.
    """
    try:
        add_pending_correction(
            payload.get("userId", "guest"),
            payload.get("reportId"),
            payload.get("original"),
            payload.get("corrected"),
            payload.get("type", "general")
        )
        return {"status": "success", "message": "Feedback saved for review."}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.get("/accuracy-history")
def accuracy_history():
    from services.memory_service import _load
    return _load("accuracy")
