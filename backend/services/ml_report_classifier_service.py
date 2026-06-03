import os
import json
import joblib
from pathlib import Path

MODEL_DIR = Path(__file__).resolve().parent.parent / "models" / "report_classifier"
MODEL_PATH = MODEL_DIR / "report_classifier.pkl"
VECTORIZER_PATH = MODEL_DIR / "report_vectorizer.pkl"
LABEL_MAP_PATH = MODEL_DIR / "label_map.json"

def predict_report_type_ml(text):
    if not MODEL_PATH.exists() or not VECTORIZER_PATH.exists():
        return {"model_available": False, "fallback_required": True}
    
    try:
        model = joblib.load(MODEL_PATH)
        vectorizer = joblib.load(VECTORIZER_PATH)
            
        # Transform text
        features = vectorizer.transform([text.lower()])
        prediction = model.predict(features)[0]
        probabilities = model.predict_proba(features)[0]
        
        # Prediction is already a string label because model was trained on strings
        report_type = str(prediction)
        confidence = float(max(probabilities))
        
        return {
            "model_available": True,
            "report_type": report_type,
            "confidence": round(confidence, 2),
            "model_used": "tfidf_logistic_regression",
            "manual_review_required": confidence < 0.75
        }
    except Exception as e:
        print(f"[ERROR] ML Classifier failed: {e}")
        return {"model_available": False, "fallback_required": True}
