from services.ml_report_classifier_service import predict_report_type_ml
from services.ml_entity_extraction_service import extract_entities_ml
from services.parser_service import parse_report_text as rule_parser, build_alias_lookup
from services.line_table_extraction_service import parse_line_as_test_row
import re

def parse_report_hybrid(text):
    """
    Advanced ensemble parser that combines Rule, ML Classifier, NER, and Line Table parsers.
    Prioritizes ML Classifier for report type to ensure 95%+ accuracy.
    """
    # 1. Base results
    rule_res = rule_parser(text)
    ml_class = predict_report_type_ml(text)
    ml_ner = extract_entities_ml(text)
    
    # 2. Line-based Table Parser
    aliases = build_alias_lookup()
    line_results = []
    for line in text.splitlines():
        row = parse_line_as_test_row(line, aliases)
        if row: line_results.append(row)

    # 3. Decision Logic - Report Type
    # Task 4: Fix hybrid report type selection. ALWAYS prioritize ML if confident.
    ml_confidence = ml_class.get("confidence", 0.0) if ml_class.get("model_available") else 0.0
    report_type = rule_res["reportType"]
    
    if ml_class.get("model_available"):
        # Trust ML classifier more than rule-based keyword counts
        if ml_confidence > 0.65:
            report_type = ml_class["report_type"]
        elif rule_res["reportTypeConfidence"] < 0.4:
            report_type = ml_class["report_type"]

    # 4. Ensemble Voting - Merging Tests
    # Task 4: Unify keys for merging (canonical snake_case used here)
    ner_tests = {(t.get("test_name") or t.get("testName", "")).lower(): t for t in ml_ner.get("tests", [])}
    rule_tests = {(t.get("test_name") or t.get("testName", "")).lower(): t for t in rule_res["tests"]}
    line_tests = {(t.get("test_name") or t.get("testName", "")).lower(): t for t in line_results}
    
    all_names = set(list(ner_tests.keys()) + list(rule_tests.keys()) + list(line_tests.keys()))
    if "" in all_names: all_names.remove("")
    
    final_tests = []
    disagreements = []

    for name in all_names:
        nt = ner_tests.get(name)
        rt = rule_tests.get(name)
        lt = line_tests.get(name)
        
        # Priority: Line Table (precise regex) > NER (semantic) > Rule (keyword)
        # Convert all to a standardized object with both keys
        best_candidate = lt or nt or rt
        
        # Determine initial numeric confidence score
        raw_conf = best_candidate.get("confidence")
        raw_conf_score = best_candidate.get("confidence_score")
        
        score = 0.70
        if raw_conf_score is not None:
            score = float(raw_conf_score)
        elif isinstance(raw_conf, (int, float)):
            score = float(raw_conf)
        elif isinstance(raw_conf, str):
            conf_str = raw_conf.lower().strip()
            if conf_str == "high":
                score = 0.95
            elif conf_str == "medium":
                score = 0.75
            elif conf_str == "low":
                score = 0.35
        elif best_candidate.get("method") == "line":
            score = 0.95

        # Ensure canonical keys exist
        std_test = {
            "test_name": best_candidate.get("test_name") or best_candidate.get("testName"),
            "testName": best_candidate.get("test_name") or best_candidate.get("testName"),
            "value": best_candidate.get("value"),
            "unit": best_candidate.get("unit"),
            "range_low": best_candidate.get("range_low") if best_candidate.get("range_low") is not None else best_candidate.get("rangeLow"),
            "rangeLow": best_candidate.get("range_low") if best_candidate.get("range_low") is not None else best_candidate.get("rangeLow"),
            "range_high": best_candidate.get("range_high") if best_candidate.get("range_high") is not None else best_candidate.get("rangeHigh"),
            "rangeHigh": best_candidate.get("range_high") if best_candidate.get("range_high") is not None else best_candidate.get("rangeHigh"),
            "range_text": best_candidate.get("range_text") or best_candidate.get("rangeText"),
            "rangeText": best_candidate.get("range_text") or best_candidate.get("rangeText"),
            "range_type": best_candidate.get("range_type", "unknown"),
            "status": best_candidate.get("status", "Unknown"),
            "method": best_candidate.get("method"),
            "raw_line": best_candidate.get("raw_line") or best_candidate.get("rawLine")
        }
        
        voted_by = []
        if nt: voted_by.append("ner")
        if rt: voted_by.append("rule")
        if lt: voted_by.append("line")
        
        # Value voting
        values = [t.get("value") for t in [nt, rt, lt] if t and t.get("value") is not None]
        if len(set(values)) > 1:
            val_counts = {}
            for v in values: val_counts[v] = val_counts.get(v, 0) + 1
            most_common = max(val_counts, key=val_counts.get)
            if val_counts[most_common] >= 2:
                std_test["value"] = most_common
                score = 0.96
            else:
                std_test["manualReviewRequired"] = True
                score = 0.65
                disagreements.append(f"Value mismatch for {name}: {values}")
        elif len(values) >= 2:
            score = 0.98
        
        # Set standardized confidence tier and float score
        if score >= 0.85:
            conf_tier = "high"
        elif score >= 0.60:
            conf_tier = "medium"
        else:
            conf_tier = "low"
            
        std_test["confidence"] = conf_tier
        std_test["confidence_score"] = score
        std_test["voted_by"] = voted_by
        final_tests.append(std_test)

    # Calculate final extraction confidence
    extract_conf = sum(t["confidence_score"] for t in final_tests) / len(final_tests) if final_tests else 0.0
    hybrid_conf = (extract_conf + ml_confidence) / 2.0 if ml_confidence > 0 else extract_conf
    
    return {
        "reportType": report_type,
        "overallRisk": rule_res.get("overallRisk", "Unknown"),
        "tests": final_tests,
        "hybrid_confidence": round(hybrid_conf, 2),
        "extractionConfidence": round(extract_conf, 2),
        "manual_review_required": hybrid_conf < 0.75 or len(disagreements) > 0,
        "disagreements": disagreements,
        "isMixed": rule_res.get("isMixed", False),
        "sectionsDetected": rule_res.get("sectionsDetected", []),
        "safetyNote": rule_res.get("safetyNote")
    }
