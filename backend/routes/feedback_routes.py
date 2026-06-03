from fastapi import APIRouter
from pydantic import BaseModel
from services.database_service import save_feedback

router = APIRouter()

class CorrectionPayload(BaseModel):
    userId: str = "guest"
    original: dict | str
    corrected: dict | str
    correctionType: str = "ocr_or_parser"
    approved: bool = False

@router.post("/correction")
def correction(payload: CorrectionPayload):
    return save_feedback(payload.model_dump())
