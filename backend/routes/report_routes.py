from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel
from services.ocr_service import extract_text_from_upload
from services.analysis_service import process_full_report # Import new orchestration function
from services.parser_service import parse_report_text
from services.hybrid_ml_parser_service import parse_report_hybrid
from services.database_service import save_report, get_reports_for_user, get_trends_for_user, clear_reports_for_user
from services.pdf_service import generate_pdf_summary
from services.search_service import search_web

router = APIRouter()

class OCRTextPayload(BaseModel):
    ocr_text: str

class SaveReportPayload(BaseModel):
    userId: str = "guest"
    report: dict

import time

@router.post("/scan")
async def scan_report(file: UploadFile = File(...), userId: str = Form("guest")):
    t_start = time.time()
    print(f"[TIMING] /scan received at {time.strftime('%H:%M:%S')}")
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")
    
    # Log received file details
    print(f"[DEBUG-BACKEND] Received file: {file.filename}, Content-Type: {file.content_type}")
    
    # Fast check for empty file content if file.size is available (though file.file.read() will confirm)
    # Note: file.size might not be populated until file.read() is called, depending on FastAPI version/upload method.
    # We will let ocr_service.py handle the file content read and actual empty check.
    
    # Step 1: Perform OCR and get basic text extraction results
    ocr_result = await extract_text_from_upload(file, userId)
    
    # Step 2: Orchestrate full analysis using the OCR results
    final_analysis_result = await process_full_report(ocr_result)
    
    print(f"[TIMING] /scan finished in {time.time() - t_start:.2f}s")
    return final_analysis_result # Return the comprehensive analysis result

@router.post("/parse")
def parse_report(payload: OCRTextPayload):
    return parse_report_text(payload.ocr_text)

@router.post("/parse-hybrid")
def parse_report_hybrid_route(payload: OCRTextPayload):
    return parse_report_hybrid(payload.ocr_text)

@router.post("/save")
def save_report_route(payload: SaveReportPayload):
    return save_report(payload.userId, payload.report)

@router.get("/history/{user_id}")
def history(user_id: str):
    return get_reports_for_user(user_id)

@router.get("/trends/{user_id}")
def trends(user_id: str):
    return get_trends_for_user(user_id)

@router.post("/generate-pdf")
def generate_pdf(payload: SaveReportPayload):
    path = generate_pdf_summary(payload.userId, payload.report)
    return {"pdf_path": path, "message": "PDF summary generated"}

@router.get("/pdf/{user_id}")
def download_pdf(user_id: str):
    reports = get_reports_for_user(user_id)
    if not reports:
        raise HTTPException(status_code=404, detail="No reports found for this user")
    
    # Sort by createdAt descending to get the latest
    sorted_reports = sorted(reports, key=lambda r: r.get("createdAt", ""), reverse=True)
    latest = sorted_reports[0].get("report", {})
    
    # If the report is nested inside another report key, extract it
    if "report" in latest:
        latest = latest["report"]
        
    path = generate_pdf_summary(user_id, latest)
    
    import os
    if not os.path.exists(path):
        raise HTTPException(status_code=500, detail="Failed to generate PDF summary")
        
    return FileResponse(path, media_type="application/pdf", filename="medical_summary.pdf")

@router.delete("/clear/{user_id}")
def clear_history(user_id: str):
    return clear_reports_for_user(user_id)

@router.get("/daily-tips")
def get_daily_tips():
    import random
    import time
    import os
    
    # CURATED MEDICAL KNOWLEDGE BASE
    curated_tips = [
        {"title": "Hydration & Kidney Health", "text": "Drinking 8-10 glasses of water daily helps kidneys flush out metabolic toxins and prevents kidney stones."},
        {"title": "Limit Refined Sugar", "text": "Swap processed sweets for whole fruits. Fiber in fruits slows down sugar absorption, preventing glucose spikes."},
        {"title": "Cardio Exercise", "text": "Engaging in 30 minutes of brisk walking increases HDL ('good') cholesterol and decreases cardiovascular risk."},
        {"title": "Watch the Sodium", "text": "Excess salt intake raises blood pressure and strains kidneys. Keep sodium below 2,300 mg per day."},
        {"title": "Quality Sleep Matters", "text": "7-8 hours of sound sleep optimizes insulin sensitivity and regulates cortisol (stress hormone) levels."},
        {"title": "Potassium-Rich Foods", "text": "Bananas, spinach, and avocados are high in potassium, which helps balance sodium and lower blood pressure."},
        {"title": "Healthy Cooking Fats", "text": "Substitute saturated fats (butter, ghee) with monounsaturated oils like olive oil to lower LDL cholesterol."},
        {"title": "Avoid Self-Medicating", "text": "Overusing over-the-counter painkillers (like Ibuprofen) can cause acute kidney stress. Always consult a doctor."},
        {"title": "Mindfulness & Stress", "text": "Chronic stress increases blood sugar and heart rate. Practicing deep breathing for 5 minutes daily can help."},
        {"title": "Check Vitamin D", "text": "Getting 15 minutes of early morning sunlight supports bone density, immunity, and calcium absorption."},
        {"title": "Whole Grains Over White", "text": "Choose brown rice and oats. They are rich in magnesium, which improves insulin efficiency."},
        {"title": "Incorporate Omega-3", "text": "Walnuts, chia seeds, and fatty fish lower triglycerides and support arterial health."},
    ]
    
    # Rotates randomly seeded by current day of year for automated daily updates
    day_of_year = time.localtime().tm_yday
    state = random.getstate()
    random.seed(day_of_year)
    selected = random.sample(curated_tips, min(len(curated_tips), 3))
    random.setstate(state)
    
    # Try generating fresh daily AI tip if Gemini is configured
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if gemini_api_key:
        try:
            import google.generativeai as genai
            import json
            genai.configure(api_key=gemini_api_key)
            model = genai.GenerativeModel('gemini-2.5-flash')
            prompt = "Generate one short, premium, unique daily health tip or wellness advice. Output ONLY a raw JSON object (no markdown, no quotes around outer braces) with keys 'title' and 'text'."
            response = model.generate_content(prompt)
            if response and response.text:
                json_str = response.text.strip()
                if json_str.startswith("```json") and json_str.endswith("```"):
                    json_str = json_str[7:-3].strip()
                elif json_str.startswith("```") and json_str.endswith("```"):
                    json_str = json_str[3:-3].strip()
                data = json.loads(json_str)
                if data.get("title") and data.get("text"):
                    selected.insert(0, {
                        "title": f"✨ Daily AI Tip: {data['title']}",
                        "text": data['text']
                    })
                    selected = selected[:3]
        except Exception as e:
            print(f"[Daily Tips] Gemini tip generator failed: {e}")
            
    return selected

@router.get("/wiki-search")
async def wiki_search_route(q: str):
    import json
    import os
    if not q or not q.strip():
        return {"success": False, "error": "Query string 'q' cannot be empty", "results": []}
    
    query_str = q.strip()
    results = []
    
    # 1. Try to query MedlinePlus for specific test details
    try:
        from services.parser_service import LOINC_MAP
        from services.knowledge_retrieval_service import get_medlineplus_info
        
        # Check if the query matches a standard test name or alias in LOINC_MAP
        matched_loinc = None
        for std_name, loinc in LOINC_MAP.items():
            if query_str.lower() in std_name.lower() or std_name.lower() in query_str.lower():
                matched_loinc = loinc
                break
                
        medline_info = await get_medlineplus_info(query_str, matched_loinc)
        if medline_info and medline_info.get("source") != "medlineplus_default":
            results.append({
                "title": f"📚 MedlinePlus Connect: {medline_info['title']}",
                "snippet": medline_info['summary'],
                "link": medline_info['link']
            })
    except Exception as e:
        print(f"[Wiki Search ERROR] MedlinePlus Connect query failed: {e}")
        
    # 1.2. Query MedlinePlus XML API specifically
    try:
        from services.knowledge_retrieval_service import query_medlineplus_xml_api
        xml_results = await query_medlineplus_xml_api(query_str)
        for r in xml_results:
            results.append({
                "title": f"📚 MedlinePlus (Official): {r['title']}",
                "snippet": r['snippet'],
                "link": r['link']
            })
    except Exception as e:
        print(f"[Wiki Search ERROR] MedlinePlus XML API query failed: {e}")

    # 1.3. Query MedlinePlus site search specifically
    try:
        from services.search_service import search_web
        medline_search_results = search_web(f"site:medlineplus.gov/lab-tests/ {query_str}")
        for r in medline_search_results:
            if "medlineplus.gov" in r["link"]:
                results.append({
                    "title": f"📚 MedlinePlus Web: {r['title']}",
                    "snippet": r['snippet'],
                    "link": r['link']
                })
    except Exception as e:
        print(f"[Wiki Search ERROR] MedlinePlus site search failed: {e}")

    # 2. Try to get AI definition using Gemini if key is present
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if gemini_api_key:
        try:
            print(f"[Wiki Search] Running Gemini AI definition for: '{query_str}'")
            import google.generativeai as genai
            genai.configure(api_key=gemini_api_key)
            model = genai.GenerativeModel('gemini-2.5-flash')
            
            prompt = f"""
            You are an expert medical lab encyclopedia. Explain the medical test or biomarker: "{query_str}".
            Provide a clear definition and clinical meaning in English and Roman Urdu (Urdu written in English/Latin letters).
            Include typical normal reference ranges (with standard units) and indications of what high or low levels could mean.

            Format your response strictly as a JSON object (no markdown code blocks, no other text) with these exact keys:
            "title": "Standard Test Name (e.g., Glucose Fasting / Fasting Blood Sugar)",
            "explanation": "English: [Your English definition and explanation, including normal reference ranges].\\n\\nRoman Urdu: [Aasan Roman Urdu mein wazahat, normal reference ranges ke sath]."
            """
            
            response = model.generate_content(prompt)
            if response and response.text:
                json_str = response.text.strip()
                if json_str.startswith("```json") and json_str.endswith("```"):
                    json_str = json_str[7:-3].strip()
                elif json_str.startswith("```") and json_str.endswith("```"):
                    json_str = json_str[3:-3].strip()
                    
                data = json.loads(json_str)
                title = data.get("title") or f"{query_str.title()} (AI Definition)"
                explanation = data.get("explanation") or "No definition available."
                
                results.append({
                    "title": f"✨ Gemini AI: {title}",
                    "snippet": explanation,
                    "link": ""
                })
                print("[Wiki Search] Gemini AI definition succeeded.")
        except Exception as e:
            print(f"[Wiki Search ERROR] Gemini failed to define '{query_str}': {e}")
            
    # 3. Get general web search results
    try:
        from services.search_service import search_web
        web_results = search_web(query_str)
        if web_results:
            results.extend(web_results)
    except Exception as e:
        print(f"[Wiki Search ERROR] Web search failed: {e}")
        
    # Deduplicate results by link if link is present, or by title
    seen_links = set()
    seen_titles = set()
    deduped_results = []
    for r in results:
        link = r.get("link", "")
        title = r.get("title", "").lower().strip()
        if link:
            if link not in seen_links:
                seen_links.add(link)
                deduped_results.append(r)
        else:
            if title not in seen_titles:
                seen_titles.add(title)
                deduped_results.append(r)
                
    if not deduped_results:
        return {
            "success": False,
            "query": query_str,
            "results": [],
            "error": "No definitions or search results found for this query."
        }
        
    return {
        "success": True,
        "query": query_str,
        "results": deduped_results
    }
