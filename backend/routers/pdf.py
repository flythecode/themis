from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import pdfplumber
import anthropic
import os
import base64
import io

router = APIRouter()

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))


class PDFRequest(BaseModel):
    pdf_base64: str
    country: str = "Черногория"
    language: str = "ru"
    userId: str


@router.post("/analyze")
async def analyze_pdf(req: PDFRequest):
    try:
        pdf_bytes = base64.b64decode(req.pdf_base64)
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            text = "\n".join(p.extract_text() or "" for p in pdf.pages)
            page_count = len(pdf.pages)
    except Exception as e:
        raise HTTPException(400, f"PDF parse error: {e}")

    if len(text.strip()) < 50:
        raise HTTPException(400, "PDF не содержит читаемого текста")

    system = (
        f"Ты Themis — юридический помощник по праву {req.country}. "
        "Проанализируй документ: риски [ВЫСОКИЙ][СРЕДНИЙ][ОК], "
        "рекомендации, нужен ли адвокат."
    )

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1500,
        system=system,
        messages=[{"role": "user", "content": f"Документ:\n\n{text[:8000]}"}],
    )

    return {"analysis": response.content[0].text, "pages": page_count}


@router.post("/generate-docx")
async def generate_docx(req: dict):
    """Генерация .docx претензии через python-docx."""
    from docx import Document as DocxDoc

    doc = DocxDoc()
    doc.add_heading("Претензия", 0)
    doc.add_paragraph(req.get("content", ""))

    buf = io.BytesIO()
    doc.save(buf)
    return {"docx_base64": base64.b64encode(buf.getvalue()).decode()}
