import os
import json
import joblib
import pandas as pd
from pathlib import Path
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, accuracy_score

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
PARTITION_DIR = BASE_DIR / "dataset" / "ml_training" / "report_classifier"
MODEL_DIR = BASE_DIR / "backend" / "models" / "report_classifier"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

def load_data(subset):
    path = PARTITION_DIR / subset
    data = []
    for f in path.glob("*.json"):
        with open(f, "r") as jf:
            item = json.load(jf)
            data.append({
                "text": item.get("text_noisy", item.get("text_clean")),
                "label": item["report_type"]
            })
    return pd.DataFrame(data)

def train():
    print("Loading partitioned data for classifier...")
    train_df = load_data("train")
    val_df = load_data("validation")
    test_df = load_data("test")
    
    if train_df.empty:
        print("Error: No training data found. Run partition_data() first.")
        return

    print(f"Training on {len(train_df)} samples...")
    
    # Vectorizer
    vectorizer = TfidfVectorizer(ngram_range=(1, 2), max_features=5000)
    X_train = vectorizer.fit_transform(train_df["text"])
    X_val = vectorizer.transform(val_df["text"])
    X_test = vectorizer.transform(test_df["text"])
    
    # Labels
    y_train = train_df["label"]
    y_val = val_df["label"]
    y_test = test_df["label"]
    
    # Model
    model = LogisticRegression(max_iter=1000, multi_class='multinomial')
    model.fit(X_train, y_train)
    
    # Evaluate
    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    report = classification_report(y_test, y_pred)
    
    print(f"Test Accuracy: {acc:.4f}")
    print("\nClassification Report:\n", report)
    
    # Save
    joblib.dump(model, MODEL_DIR / "report_classifier.pkl")
    joblib.dump(vectorizer, MODEL_DIR / "report_vectorizer.pkl")
    
    label_map = {str(i): label for i, label in enumerate(model.classes_)}
    with open(MODEL_DIR / "label_map.json", "w") as f:
        json.dump(label_map, f, indent=2)
        
    print("Model saved to backend/models/report_classifier/")
    
    # Update global version
    from services.ml_model_registry_service import update_model_metrics
    update_model_metrics({
        "report_classifier_accuracy": round(acc, 2),
        "trained_on_synthetic_reports": len(train_df) + len(val_df) + len(test_df)
    })

if __name__ == "__main__":
    # Partition first
    from services.training_data_service import partition_data
    partition_data()
    train()
