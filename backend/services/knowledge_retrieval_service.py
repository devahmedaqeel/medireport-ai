import json
from pathlib import Path
from services.rule_loader import load_json_rule

def retrieve_medical_context(test_name, status, report_type=None):
    """
    RAG-style retrieval of verified knowledge for a specific test result.
    """
    meanings = load_json_rule("lab_test_meanings.json")
    risks = load_json_rule("disease_risk_explanations.json")
    rules = load_json_rule("abnormal_rules.json")
    
    # 1. Get Test Purpose
    test_info = meanings.get(test_name, {})
    
    # 2. Get Status-Specific Rule
    rule = rules.get(test_name, {}).get(status, {})
    
    if not rule and status != "Normal":
        return {
            "status": "unsupported",
            "message": f"Verified knowledge for {test_name} ({status}) is not yet in our memory system."
        }
        
    return {
        "test_name": test_name,
        "status": status,
        "purpose": test_info.get("purpose", "Medical investigation"),
        "possible_indication": rule.get("possibleIndication", "Varies by clinical context"),
        "english_explanation": rule.get("safeExplanation", ""),
        "roman_urdu_explanation": rule.get("romanUrduExplanation", ""),
        "doctor_advice": rule.get("doctorAdvice", "Consult a qualified doctor."),
        "severity": rule.get("severity", "unknown"),
        "source": "verified_knowledge_base"
    }


async def query_medlineplus(loinc_code: str) -> dict:
    """
    Queries the MedlinePlus Connect Web Service API for trusted lab test details using a LOINC code.
    """
    if not loinc_code:
        return {"success": False, "results": []}
    try:
        import httpx
        url = "https://connect.medlineplus.gov/service"
        params = {
            "mainSearchCriteria.v.cs": "2.16.840.1.113883.6.1",
            "mainSearchCriteria.v.c": loinc_code,
            "knowledgeResponseType": "application/json"
        }
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(url, params=params)
            if response.status_code == 200:
                data = response.json()
                feed = data.get("feed", {})
                entries = feed.get("entry", [])
                if not isinstance(entries, list):
                    entries = [entries] if entries else []
                
                results = []
                for entry in entries:
                    title = entry.get("title", {}).get("_value", "")
                    summary = entry.get("summary", {}).get("_value", "")
                    links = entry.get("link", [])
                    if not isinstance(links, list):
                        links = [links]
                    
                    href = ""
                    for link in links:
                        if link.get("rel") == "alternate":
                            href = link.get("href", "")
                            break
                    if not href and links:
                        href = links[0].get("href", "")
                    
                    results.append({
                        "title": title,
                        "summary": summary,
                        "link": href
                    })
                return {"success": True, "results": results}
            else:
                print(f"[WARN] MedlinePlus Connect responded with status: {response.status_code}")
    except Exception as e:
        print(f"[WARN] MedlinePlus Connect query failed: {e}")
    return {"success": False, "results": []}


async def query_medlineplus_xml_api(term: str) -> list:
    """
    Queries the official MedlinePlus Web Service XML API and parses search results.
    """
    if not term:
        return []
    try:
        import httpx
        import xml.etree.ElementTree as ET
        import re
        
        url = "https://wsearch.nlm.nih.gov/ws/query"
        params = {
            "db": "healthTopics",
            "term": term,
            "retmax": 5
        }
        
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(url, params=params)
            if response.status_code == 200:
                root = ET.fromstring(response.text)
                results = []
                
                # Find all <document> elements
                for doc in root.findall(".//document"):
                    url_attr = doc.get("url", "")
                    
                    title = ""
                    summary = ""
                    snippet = ""
                    
                    # Read <content> elements
                    for content in doc.findall("content"):
                        name = content.get("name")
                        text = content.text or ""
                        
                        text_clean = re.sub(r"<[^>]+>", "", text).strip()
                        
                        if name == "title":
                            title = text_clean
                        elif name == "FullSummary" or name == "full-summary":
                            summary = text_clean
                        elif name == "snippet":
                            snippet = text_clean
                            
                    snippet_to_use = snippet or summary or "Medical information from MedlinePlus."
                    if len(snippet_to_use) > 300:
                        snippet_to_use = snippet_to_use[:297] + "..."
                        
                    results.append({
                        "title": title or term,
                        "snippet": snippet_to_use,
                        "link": url_attr
                    })
                return results
    except Exception as e:
        print(f"[WARN] MedlinePlus XML API query failed for '{term}': {e}")
    return []


async def get_medlineplus_info(test_name: str, loinc_code: str = None) -> dict:
    """
    Retrieves trusted information from MedlinePlus Connect (via LOINC) or
    falls back to searching the MedlinePlus Web Service XML API, then general search.
    """
    # 1. Try LOINC query via MedlinePlus Connect first
    if loinc_code:
        res = await query_medlineplus(loinc_code)
        if res.get("success") and res.get("results"):
            best = res["results"][0]
            return {
                "title": best["title"],
                "summary": best["summary"],
                "link": best["link"],
                "source": "medlineplus_connect_loinc"
            }
            
    # 2. Try official MedlinePlus Web Service XML API next
    try:
        xml_results = await query_medlineplus_xml_api(test_name)
        if xml_results:
            best = xml_results[0]
            return {
                "title": best["title"],
                "summary": best["snippet"],
                "link": best["link"],
                "source": "medlineplus_xml_api"
            }
    except Exception as e:
        print(f"[WARN] MedlinePlus XML API fallback failed: {e}")

    # 3. Fallback: Search MedlinePlus using our web search service
    try:
        from services.search_service import search_web
        import asyncio
        query = f"site:medlineplus.gov/lab-tests/ {test_name}"
        loop = asyncio.get_event_loop()
        search_results = await loop.run_in_executor(None, lambda: search_web(query))
        
        if search_results:
            # Look for the first result that points to medlineplus.gov/lab-tests
            for r in search_results:
                if "medlineplus.gov/lab-tests" in r["link"] or "medlineplus.gov" in r["link"]:
                    return {
                        "title": r["title"],
                        "summary": r["snippet"],
                        "link": r["link"],
                        "source": "medlineplus_search"
                    }
    except Exception as e:
        print(f"[WARN] MedlinePlus fallback search failed: {e}")
        
    # 4. Default fallback if no match found
    return {
        "title": test_name,
        "summary": "No verified MedlinePlus context found.",
        "link": "https://medlineplus.gov/lab-tests/",
        "source": "medlineplus_default"
    }


async def query_loinc_api(test_name: str) -> dict:
    """
    Queries NLM ClinicalTables LOINC API for standardization and LOINC code mapping.
    Endpoint: https://clinicaltables.nlm.nih.gov/api/loinc_items/v3/search?terms={test_name}
    """
    if not test_name:
        return {"loinc_code": None, "standard_name": None}
    try:
        import httpx
        url = "https://clinicaltables.nlm.nih.gov/api/loinc_items/v3/search"
        params = {"terms": test_name, "maxList": 1}
        async with httpx.AsyncClient(timeout=4.0) as client:
            response = await client.get(url, params=params)
            if response.status_code == 200:
                data = response.json()
                if len(data) >= 4 and data[0] > 0:
                    code = data[1][0]
                    standard_name = data[3][0][0] if isinstance(data[3][0], list) else data[3][0]
                    return {"loinc_code": code, "standard_name": standard_name}
    except Exception as e:
        print(f"[WARN] LOINC API query failed for '{test_name}': {e}")
    return {"loinc_code": None, "standard_name": None}


async def verify_medicine_rxnorm(name: str) -> dict:
    """
    Queries NLM RxNorm REST API to verify if a name is a registered drug/medicine.
    Endpoint: https://rxnav.nlm.nih.gov/REST/drugs.json?name={name}
    """
    if not name:
        return {"is_drug": False, "rxcui": None, "standard_name": None}
    try:
        import httpx
        url = f"https://rxnav.nlm.nih.gov/REST/drugs.json"
        params = {"name": name}
        async with httpx.AsyncClient(timeout=4.0) as client:
            response = await client.get(url, params=params)
            if response.status_code == 200:
                data = response.json()
                drug_group = data.get("drugGroup", {})
                concept_properties = drug_group.get("conceptGroup", [])
                
                if concept_properties:
                    for group in concept_properties:
                        props = group.get("conceptProperties", [])
                        if props:
                            best_match = props[0]
                            return {
                                "is_drug": True,
                                "rxcui": best_match.get("rxcui"),
                                "standard_name": best_match.get("name")
                            }
    except Exception as e:
        print(f"[WARN] RxNorm API query failed for '{name}': {e}")
    return {"is_drug": False, "rxcui": None, "standard_name": None}
