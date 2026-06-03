from fastapi import APIRouter
from pydantic import BaseModel
from services.analysis_service import analyze_structured_report
from services.indication_service import add_indications
from services.explanation_service import build_explanation

router = APIRouter()

class StructuredReportPayload(BaseModel):
    report: dict

@router.post("/analyze")
def analyze(payload: StructuredReportPayload):
    return analyze_structured_report(payload.report)

@router.post("/indications")
def indications(payload: StructuredReportPayload):
    return add_indications(payload.report)

@router.post("/explain")
async def explain(payload: StructuredReportPayload):
    report = analyze_structured_report(payload.report)
    tests = report.get("tests", [])
    from services.analysis_service import populate_medlineplus_data
    await populate_medlineplus_data(tests)
    report = add_indications(report)
    return build_explanation(report)
