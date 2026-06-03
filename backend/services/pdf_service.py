from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from datetime import datetime
import uuid

OUT = Path(__file__).resolve().parent.parent / "reports"
OUT.mkdir(exist_ok=True)


def generate_pdf_summary(user_id: str, report: dict) -> str:
    path = OUT / f"report_summary_{uuid.uuid4().hex}.pdf"
    c = canvas.Canvas(str(path), pagesize=A4)
    width, height = A4
    y = height - 50
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, y, "MediReport AI - Doctor Share Summary")
    y -= 25
    c.setFont("Helvetica", 10)
    c.drawString(50, y, f"User: {user_id} | Generated: {datetime.utcnow().isoformat()} UTC")
    y -= 30
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, y, f"Report Type: {report.get('reportType', 'Unknown')} | Risk: {report.get('overallRisk', 'Unknown')}")
    y -= 25
    c.setFont("Helvetica", 9)
    c.drawString(50, y, "Disclaimer: This summary is not a final diagnosis. Consult a qualified doctor.")
    y -= 25
    c.setFont("Helvetica-Bold", 11)
    c.drawString(50, y, "Extracted Tests")
    y -= 18
    c.setFont("Helvetica", 9)
    for t in report.get("tests", []):
        line = f"{t.get('testName')} | {t.get('value')} {t.get('unit','')} | Range {t.get('rangeLow')}-{t.get('rangeHigh')} | {t.get('status')} | {t.get('possibleIndication','')}"
        c.drawString(50, y, line[:120])
        y -= 15
        if y < 60:
            c.showPage(); y = height - 50; c.setFont("Helvetica", 9)
    c.save()
    return str(path)
