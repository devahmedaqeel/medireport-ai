import json
import shutil
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
VERIFIED_DIR = BASE_DIR / "dataset" / "real_reports_verified"
EXPORTED_DIR = BASE_DIR / "dataset" / "ml_training" / "exported"

def merge():
    files = list(VERIFIED_DIR.glob("*.json"))
    if not files:
        print("No verified real reports found. Skipping merge.")
        return
        
    print(f"Merging {len(files)} verified real reports into training set...")
    for f in files:
        shutil.copy(f, EXPORTED_DIR / f.name)
        
    # Update version registry
    from services.ml_model_registry_service import update_model_metrics
    update_model_metrics({
        "trained_on_real_verified_reports": len(files)
    })
    
    print("Merge complete.")

if __name__ == "__main__":
    merge()
