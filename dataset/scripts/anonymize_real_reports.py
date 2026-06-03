import re
import os
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
RAW_DIR = BASE_DIR / "dataset" / "real_reports_raw"
ANON_DIR = BASE_DIR / "dataset" / "real_reports_anonymized"

ANON_DIR.mkdir(parents=True, exist_ok=True)

def anonymize_text(text):
    # Mask Names
    text = re.sub(r'(?i)Patient\s*Name:\s*.*?\n', 'Patient Name: [REDACTED]\n', text)
    text = re.sub(r'(?i)Name:\s*.*?\n', 'Name: [REDACTED]\n', text)
    
    # Mask Phones
    text = re.sub(r'(\+92|0|92)[-\s]?\d{3}[-\s]?\d{7}', '[PHONE_REDACTED]', text)
    
    # Mask CNIC (Pakistan)
    text = re.sub(r'\d{5}-\d{7}-\d{1}', '[CNIC_REDACTED]', text)
    
    # Mask Emails
    text = re.sub(r'[\w\.-]+@[\w\.-]+\.\w+', '[EMAIL_REDACTED]', text)
    
    return text

def process():
    files = list(RAW_DIR.glob("*.txt"))
    if not files:
        print("No real reports found in real_reports_raw/. Skipping anonymization.")
        return
        
    print(f"Anonymizing {len(files)} real reports...")
    for f in files:
        with open(f, "r") as tf:
            content = tf.read()
        
        anon_content = anonymize_text(content)
        
        with open(ANON_DIR / f.name, "w") as out:
            out.write(anon_content)
            
    print(f"Anonymization complete. Check {ANON_DIR}")

if __name__ == "__main__":
    process()
