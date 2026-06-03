def vote_on_results(rule_results: list, layout_results: list) -> list:
    """
    Merges and votes on results from different parsing methods.
    """
    final_tests = []
    
    # Create a map for easy comparison
    rule_map = {t["testName"]: t for t in rule_results}
    layout_map = {t["testName"]: t for t in layout_results}
    
    all_test_names = set(list(rule_map.keys()) + list(layout_map.keys()))
    
    for name in all_test_names:
        r_t = rule_map.get(name)
        l_t = layout_map.get(name)
        
        if r_t and l_t:
            # Agreement check
            r_val = r_t.get("value")
            l_val = l_t.get("value")
            
            is_match = False
            if r_val == l_val:
                is_match = True
            elif r_val is not None and l_val is not None:
                try:
                    if abs(float(r_val) - float(l_val)) < 0.01:
                        is_match = True
                except (ValueError, TypeError):
                    pass
            
            if is_match:
                t = r_t.copy()
                t["confidence"] = min(0.99, r_t["confidence"] + 0.1)
                t["voted_by"] = ["rule", "layout"]
                final_tests.append(t)
            else:
                # Disagreement on value, prefer layout if high confidence
                if l_t["confidence"] > r_t["confidence"]:
                    l_t["manualReviewRequired"] = True
                    l_t["voted_by"] = ["layout_winner"]
                    final_tests.append(l_t)
                else:
                    r_t["manualReviewRequired"] = True
                    r_t["voted_by"] = ["rule_winner"]
                    final_tests.append(r_t)
        elif r_t:
            final_tests.append(r_t)
        elif l_t:
            final_tests.append(l_t)
            
    return final_tests
