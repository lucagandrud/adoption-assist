"""Generate the synthetic documents used in the judge-facing verification demo."""

from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "demo" / "documents"
OUTPUT.mkdir(parents=True, exist_ok=True)

NAVY = colors.HexColor("#142441")
GOLD = colors.HexColor("#B68A2A")
INK = colors.HexColor("#24324A")
MUTED = colors.HexColor("#687487")
PAPER = colors.HexColor("#FBF8F0")
LINE = colors.HexColor("#D9D4C8")

styles = getSampleStyleSheet()
TITLE = ParagraphStyle(
    "Title",
    parent=styles["Title"],
    fontName="Helvetica-Bold",
    fontSize=17,
    leading=21,
    textColor=NAVY,
    spaceAfter=5,
)
SUBTITLE = ParagraphStyle(
    "Subtitle",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=8.5,
    leading=11,
    textColor=MUTED,
    spaceAfter=13,
)
SECTION = ParagraphStyle(
    "Section",
    parent=styles["Heading2"],
    fontName="Helvetica-Bold",
    fontSize=9,
    leading=11,
    textColor=NAVY,
    spaceBefore=10,
    spaceAfter=5,
)
BODY = ParagraphStyle(
    "Body",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=9,
    leading=12,
    textColor=INK,
)
NOTICE = ParagraphStyle(
    "Notice",
    parent=BODY,
    alignment=TA_CENTER,
    fontName="Helvetica-Bold",
    fontSize=8,
    leading=10,
    textColor=colors.HexColor("#8A2C22"),
)


def page(canvas, doc):
    canvas.saveState()
    width, height = letter
    canvas.setFillColor(PAPER)
    canvas.rect(0, 0, width, height, fill=1, stroke=0)
    canvas.setFillColor(NAVY)
    canvas.rect(0, height - 0.42 * inch, width, 0.42 * inch, fill=1, stroke=0)
    canvas.setFillColor(GOLD)
    canvas.rect(0, height - 0.46 * inch, width, 0.04 * inch, fill=1, stroke=0)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(0.62 * inch, 0.42 * inch, "ICPC Preflight - synthetic demonstration record")
    canvas.drawRightString(width - 0.62 * inch, 0.42 * inch, f"Page {doc.page}")
    canvas.setFillColor(colors.HexColor("#E8DFCA"))
    canvas.setFont("Helvetica-Bold", 34)
    canvas.saveState()
    canvas.translate(width / 2, height / 2)
    canvas.rotate(32)
    canvas.drawCentredString(0, 0, "SYNTHETIC DEMO - NOT A REAL CASE RECORD")
    canvas.restoreState()
    canvas.restoreState()


def field_table(rows):
    data = [[Paragraph(f"<b>{label}</b>", BODY), Paragraph(str(value), BODY)] for label, value in rows]
    table = Table(data, colWidths=[2.25 * inch, 4.25 * inch], hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F0EBDD")),
                ("BOX", (0, 0), (-1, -1), 0.65, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    return table


def build(filename, title, subtitle, sections):
    path = OUTPUT / filename
    doc = BaseDocTemplate(
        str(path),
        pagesize=letter,
        leftMargin=0.62 * inch,
        rightMargin=0.62 * inch,
        topMargin=0.72 * inch,
        bottomMargin=0.68 * inch,
        title=title,
        author="DNHacks synthetic demo",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="body")
    doc.addPageTemplates(PageTemplate(id="main", frames=[frame], onPage=page))
    story = [Paragraph(title, TITLE), Paragraph(subtitle, SUBTITLE)]
    for heading, rows in sections:
        story.extend([Paragraph(heading.upper(), SECTION), field_table(rows), Spacer(1, 7)])
    story.extend(
        [
            Spacer(1, 8),
            Paragraph(
                "Synthetic demonstration only. All people, identifiers, addresses, and circumstances are fictional.",
                NOTICE,
            ),
        ]
    )
    doc.build(story)
    return path


generated = [
    build(
        "rfa-application-rivera.pdf",
        "Resource Family Approval Application",
        "Synthetic RFA-01A-style demonstration document - application received 2026-09-05",
        [
            ("Applicant", [("Legal name", "Maria Elena Rivera"), ("Date of birth", "1988-04-12"), ("Relationship to child", "Maternal aunt")]),
            ("Residence", [("Residence address", "1442 Oak Street, Sacramento, CA 95814"), ("Household size", "4"), ("Primary phone", "(916) 555-0142")]),
            ("Attestation", [("Applicant signature", "Maria Elena Rivera"), ("Signature date", "2026-09-05"), ("Application identifier", "SYN-RFA-2026-014")]),
        ],
    ),
    build(
        "home-safety-assessment-conflict.pdf",
        "Home Health and Safety Assessment",
        "Synthetic demonstration document - intentionally contains an address discrepancy",
        [
            ("Assessment", [("Applicant", "Maria Elena Rivera"), ("Residence address", "88 Cedar Avenue, Sacramento, CA 95818"), ("Visit date", "2026-09-14")]),
            ("Home overview", [("Bedrooms", "2"), ("Children planned for placement", "2"), ("Pool present", "No"), ("Smoke and CO detectors", "Observed and operational")]),
            ("Reviewer", [("Assessor", "Jordan Lee, Demo Specialist"), ("Assessment identifier", "SYN-HSA-2026-031"), ("Status", "Administrative review pending")]),
        ],
    ),
    build(
        "home-safety-assessment-corrected.pdf",
        "Corrected Home Health and Safety Assessment",
        "Synthetic demonstration document - corrected after caseworker review",
        [
            ("Assessment", [("Applicant", "Maria Elena Rivera"), ("Residence address", "1442 Oak Street, Sacramento, CA 95814"), ("Visit date", "2026-09-14")]),
            ("Home overview", [("Bedrooms", "2"), ("Children planned for placement", "2"), ("Pool present", "No"), ("Smoke and CO detectors", "Observed and operational")]),
            ("Correction record", [("Assessor", "Jordan Lee, Demo Specialist"), ("Assessment identifier", "SYN-HSA-2026-031-R1"), ("Correction", "Residence address confirmed against application")]),
        ],
    ),
    build(
        "health-screening-rivera.pdf",
        "Applicant Health Screening",
        "Synthetic demonstration document - created to demonstrate expiration risk",
        [
            ("Applicant", [("Legal name", "Maria Elena Rivera"), ("Date of birth", "1988-04-12"), ("Screening date", "2025-11-10")]),
            ("Provider", [("Provider", "Taylor Morgan, MD"), ("Clinic", "Capitol Family Health - Demo Clinic"), ("Record identifier", "SYN-HLT-2025-118")]),
            ("Administrative status", [("Form complete", "Yes"), ("Applicant signature present", "Yes"), ("Provider signature present", "Yes")]),
        ],
    ),
]

for item in generated:
    print(item.relative_to(ROOT))
