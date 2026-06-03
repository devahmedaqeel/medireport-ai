import os
import json
import random
from pathlib import Path
from sklearn.model_selection import train_test_split

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "dataset" / "ml_training" / "exported"
PARTITION_DIR = Path(__file__).resolve().parent.parent.parent / "dataset" / "ml_training" / "report_classifier"

def partition_data():
    files = list(DATA_DIR.glob("*.json"))
    data = []
    
    for f in files:
        with open(f, "r") as jf:
            data.append(json.load(jf))
            
    # Partition for classifier
    train, temp = train_test_split(data, test_size=0.3, random_state=42)
    val, test = train_test_split(temp, test_size=0.5, random_state=42)
    
    for name, subset in [("train", train), ("validation", val), ("test", test)]:
        subset_dir = PARTITION_DIR / name
        subset_dir.mkdir(parents=True, exist_ok=True)
        for item in subset:
            with open(subset_dir / f"{item['report_id']}.json", "w") as out:
                json.dump(item, out, indent=2)
                
    return len(train), len(val), len(test)
