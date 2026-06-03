from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import time
from routes.report_routes import router as report_router
from routes.analysis_routes import router as analysis_router
from routes.feedback_routes import router as feedback_router
from routes.admin_routes import router as admin_router
from routes.memory_routes import router as memory_router
from services.parser_service import parse_report_text
from services.analysis_service import analyze_structured_report
from services.indication_service import add_indications
from services.explanation_service import build_explanation

class AnalyzeTextPayload(BaseModel):
    text: str

app = FastAPI(
    title="MediReport AI API",
    description="OCR, parser, abnormality detection, and safe disease-risk indication API.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(report_router, prefix="/api/reports", tags=["Reports"])
app.include_router(analysis_router, prefix="/api/reports", tags=["Analysis"])
app.include_router(feedback_router, prefix="/api/feedback", tags=["Feedback"])
app.include_router(admin_router, prefix="/api/admin", tags=["Admin"])
app.include_router(memory_router, prefix="/api/memory", tags=["Memory"])

@app.get("/")
def root():
    return {
        "name": "MediReport AI",
        "status": "running",
        "safety": "This API provides abnormal value detection and risk indication, not final diagnosis.",
    }

@app.get("/api/health")
@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "backend": "running",
        "message": "MediReport AI backend is healthy"
    }

@app.get("/api/medical-search")
def medical_search_alias(q: str):
    from routes.report_routes import wiki_search_route
    return wiki_search_route(q)

@app.post("/api/analyze-text")
async def analyze_text(payload: AnalyzeTextPayload):
    t_start = time.time()
    print(f"[TIMING] Manual text analysis started")
    
    # 1. Parse text
    t1 = time.time()
    parsed = parse_report_text(payload.text)
    print(f"[TIMING] Parser took {time.time() - t1:.4f}s")
    
    # 2. Abnormality/Structured analysis
    t2 = time.time()
    analyzed = analyze_structured_report(parsed)
    print(f"[TIMING] Abnormality analysis took {time.time() - t2:.4f}s")
    
    # Fetch MedlinePlus Connect / Search
    tests = analyzed.get("tests", [])
    if tests:
        from services.analysis_service import populate_medlineplus_data
        await populate_medlineplus_data(tests)
        
    # 3. Add indications
    t3 = time.time()
    indicated = add_indications(analyzed)
    print(f"[TIMING] Indications took {time.time() - t3:.4f}s")
    
    # 4. Build explanations
    t4 = time.time()
    explained = build_explanation(indicated)
    print(f"[TIMING] Explanation took {time.time() - t4:.4f}s")
    
    print(f"[TIMING] Total manual text analysis took {time.time() - t_start:.4f}s")
    return explained
