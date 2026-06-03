import os
import shutil
import subprocess
import sys
import json
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
NER_DATA_DIR = BASE_DIR / "dataset" / "ml_training" / "entity_extraction"
MODEL_DIR = BASE_DIR / "backend" / "models" / "medical_ner"
CONFIG_PATH = NER_DATA_DIR / "config.cfg"

def run_command(command):
    print(f"Executing: {command}")
    # Using shell=True which uses the default shell (cmd.exe or powershell)
    process = subprocess.Popen(command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    for line in process.stdout:
        print(line, end="")
    process.wait()
    if process.returncode != 0:
        print(f"Error executing command: {command}")
        return False
    return True

def train():
    print("Starting actual spaCy NER training pipeline...")
    
    train_path = NER_DATA_DIR / "train.spacy"
    dev_path = NER_DATA_DIR / "dev.spacy"
    
    if not train_path.exists() or not dev_path.exists():
        print(f"Error: .spacy files missing in {NER_DATA_DIR}. Run convert_annotations_to_spacy_ner.py first.")
        return

    # Clean existing model directory
    if MODEL_DIR.exists():
        print(f"Cleaning existing model directory: {MODEL_DIR}")
        shutil.rmtree(MODEL_DIR)
    
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    NER_DATA_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Init spaCy config
    print("\n--- Phase 1: Initializing spaCy Config ---")
    init_config_cmd = f"py -m spacy init config \"{CONFIG_PATH}\" --lang en --pipeline ner --optimize efficiency --force"
    if not run_command(init_config_cmd):
        init_config_cmd = f"python -m spacy init config \"{CONFIG_PATH}\" --lang en --pipeline ner --optimize efficiency --force"
        if not run_command(init_config_cmd):
            return

    # 2. Run actual training
    print("\n--- Phase 2: Training spaCy NER Model ---")
    train_cmd = f"py -m spacy train \"{CONFIG_PATH}\" --output \"{MODEL_DIR}\" --paths.train \"{train_path}\" --paths.dev \"{dev_path}\""
    if not run_command(train_cmd):
        train_cmd = f"python -m spacy train \"{CONFIG_PATH}\" --output \"{MODEL_DIR}\" --paths.train \"{train_path}\" --paths.dev \"{dev_path}\""
        if not run_command(train_cmd):
            return

    if (MODEL_DIR / "model-best").exists():
        print(f"\n✅ Actual NER model saved to {MODEL_DIR}/model-best")
    else:
        print(f"\n⚠️ Warning: model-best not found in {MODEL_DIR}")

    print("Training Complete.")

if __name__ == "__main__":
    train()
