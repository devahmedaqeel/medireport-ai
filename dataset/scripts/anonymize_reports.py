import re
import json
import os
from pathlib import Path

def anonymize_text(text: str) -> str:
    """
    Removes PII (Names, Phone Numbers, Email) from medical reports.
    """
    # 1. Phone Numbers
    text = re.sub(r'(\+92|0|92)[-\s]?\d{3}[-\s]?\d{7}', '[PHONE_REDACTED]', text)
    
    # 2. Emails
    text = re.sub(r'[\w\.-]+@[\w\.-]+\.\w+', '[EMAIL_REDACTED]', text)
    
    # 3. Patient Name patterns
    text = re.sub(r'(?i)Patient\s*Name:\s*.*?\n', 'Patient Name: [REDACTED]\n', text)
    text = re.sub(r'(?i)Name:\s*.*?\n', 'Name: [REDACTED]\n', text)
    
    return text

def main():
    base_dir = Path(__file__).resolve().parent.parent
    raw_dir = base_dir / "raw_reports"
    anon_dir = base_dir / "anonymized_reports"
    
    anon_dir.mkdir(exist_ok=True)
    
    for f_path in raw_dir.glob("*.txt"):
        with open(f_path, "r") as f:
            content = f.read()
        
        anon_content = anonymize_text(content)
        
        with open(anon_dir / f_path.name, "w") as f:
            f.write(anon_content)
            
    print(f"Anonymization complete. Check {anon_dir}")

if __name__ == "__main__":
    main()
