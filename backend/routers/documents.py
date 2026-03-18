from fastapi import APIRouter
from pydantic import BaseModel
from io import BytesIO
import os
import httpx

router = APIRouter()


class SendDocRequest(BaseModel):
    tg_id: str
    text: str
    title: str = "Документ Themis"
    mode: str = "generate"


def generate_pdf(title: str, text: str) -> bytes:
    """Генерация PDF с поддержкой кириллицы через fpdf2."""
    from fpdf import FPDF

    pdf = FPDF()
    pdf.add_page()

    # Встроенный DejaVu из fpdf2 — поддерживает кириллицу
    font_dir = os.path.join(os.path.dirname(__file__), "..", "fonts")
    os.makedirs(font_dir, exist_ok=True)

    dejavu_path = os.path.join(font_dir, "DejaVuSans.ttf")
    dejavu_bold_path = os.path.join(font_dir, "DejaVuSans-Bold.ttf")

    if os.path.exists(dejavu_path):
        pdf.add_font("DejaVu", "", dejavu_path)
        pdf.add_font("DejaVu", "B", dejavu_bold_path)
        font_name = "DejaVu"
    else:
        # Fallback: helvetica (без кириллицы, но не упадёт)
        font_name = "Helvetica"

    # Заголовок
    pdf.set_font(font_name, "B", 18)
    pdf.set_text_color(201, 168, 76)
    pdf.cell(0, 12, "THEMIS", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font(font_name, "", 9)
    pdf.set_text_color(120, 114, 106)
    pdf.cell(0, 6, "Legal AI", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)
    pdf.set_draw_color(201, 168, 76)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(8)

    # Название документа
    pdf.set_font(font_name, "B", 14)
    pdf.set_text_color(40, 40, 40)
    pdf.multi_cell(0, 8, title)
    pdf.ln(4)

    # Текст
    pdf.set_font(font_name, "", 11)
    pdf.set_text_color(60, 60, 60)

    clean_text = text.replace("**", "")
    clean_text = clean_text.replace("[ВЫСОКИЙ]", "[!] ВЫСОКИЙ РИСК")
    clean_text = clean_text.replace("[СРЕДНИЙ]", "[~] СРЕДНИЙ РИСК")
    clean_text = clean_text.replace("[ОК]", "[OK]")
    clean_text = clean_text.replace("[HIGH]", "[!] HIGH RISK")
    clean_text = clean_text.replace("[MEDIUM]", "[~] MEDIUM RISK")

    pdf.multi_cell(0, 6, clean_text)

    buf = BytesIO()
    pdf.output(buf)
    return buf.getvalue()


@router.post("/send-pdf")
async def send_pdf(req: SendDocRequest):
    BOT_TOKEN = os.environ.get("BOT_TOKEN", "")
    if not BOT_TOKEN:
        return {"error": "Bot not configured"}

    try:
        pdf_bytes = generate_pdf(req.title, req.text)
    except Exception as e:
        return {"error": f"PDF generation failed: {str(e)}"}

    filename = f"themis_{req.mode}.pdf"
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://api.telegram.org/bot{BOT_TOKEN}/sendDocument",
                data={
                    "chat_id": req.tg_id,
                    "caption": f"📄 {req.title}\n\nСгенерировано Themis Legal AI",
                },
                files={"document": (filename, pdf_bytes, "application/pdf")},
                timeout=30,
            )

        if resp.status_code == 200:
            return {"status": "ok"}
        else:
            return {"error": f"Telegram API error: {resp.text}"}
    except Exception as e:
        return {"error": f"Send failed: {str(e)}"}
