from fastapi import APIRouter
from pydantic import BaseModel
from fpdf import FPDF
from io import BytesIO
import os
import httpx

router = APIRouter()


class SendDocRequest(BaseModel):
    tg_id: str
    text: str
    title: str = "Документ Themis"
    mode: str = "generate"


class ThemisPDF(FPDF):
    def header(self):
        self.set_font("DejaVu", "B", 16)
        self.set_text_color(201, 168, 76)  # gold
        self.cell(0, 10, "THEMIS", align="C", new_x="LMARGIN", new_y="NEXT")
        self.set_font("DejaVu", "", 8)
        self.set_text_color(120, 114, 106)
        self.cell(0, 5, "Legal AI", align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(5)
        self.set_draw_color(201, 168, 76)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font("DejaVu", "", 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f"Themis Legal AI  |  Страница {self.page_no()}/{{nb}}", align="C")


@router.post("/send-pdf")
async def send_pdf(req: SendDocRequest):
    BOT_TOKEN = os.environ.get("BOT_TOKEN", "")
    if not BOT_TOKEN:
        return {"error": "Bot not configured"}

    # Генерируем PDF
    pdf = ThemisPDF()
    pdf.alias_nb_pages()

    # Добавляем поддержку Unicode (кириллица)
    font_path = os.path.join(os.path.dirname(__file__), "..", "fonts")
    if os.path.exists(os.path.join(font_path, "DejaVuSans.ttf")):
        pdf.add_font("DejaVu", "", os.path.join(font_path, "DejaVuSans.ttf"))
        pdf.add_font("DejaVu", "B", os.path.join(font_path, "DejaVuSans-Bold.ttf"))
    else:
        # Скачаем шрифт при первом запуске
        await _ensure_fonts(font_path)
        pdf.add_font("DejaVu", "", os.path.join(font_path, "DejaVuSans.ttf"))
        pdf.add_font("DejaVu", "B", os.path.join(font_path, "DejaVuSans-Bold.ttf"))

    pdf.add_page()
    pdf.set_font("DejaVu", "B", 14)
    pdf.set_text_color(240, 235, 213)  # ivory
    pdf.multi_cell(0, 8, req.title)
    pdf.ln(3)

    pdf.set_font("DejaVu", "", 11)
    pdf.set_text_color(60, 60, 60)

    # Обработка текста: убираем markdown-форматирование
    text = req.text
    text = text.replace("**", "")
    text = text.replace("[ВЫСОКИЙ]", "[!] ВЫСОКИЙ РИСК")
    text = text.replace("[СРЕДНИЙ]", "[~] СРЕДНИЙ РИСК")
    text = text.replace("[ОК]", "[✓] ОК")
    text = text.replace("[HIGH]", "[!] HIGH RISK")
    text = text.replace("[MEDIUM]", "[~] MEDIUM RISK")
    text = text.replace("[OK]", "[✓] OK")

    pdf.multi_cell(0, 6, text)

    # Сохраняем в буфер
    buf = BytesIO()
    pdf.output(buf)
    buf.seek(0)

    # Отправляем через Telegram Bot API
    filename = f"themis_{req.mode}.pdf"
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://api.telegram.org/bot{BOT_TOKEN}/sendDocument",
            data={
                "chat_id": req.tg_id,
                "caption": f"📄 {req.title}\n\nСгенерировано Themis Legal AI",
            },
            files={"document": (filename, buf.getvalue(), "application/pdf")},
            timeout=30,
        )

    if resp.status_code == 200:
        return {"status": "ok", "message": "PDF sent"}
    else:
        return {"status": "error", "detail": resp.text}


async def _ensure_fonts(font_path: str):
    """Скачать DejaVu Sans если нет."""
    os.makedirs(font_path, exist_ok=True)
    base_url = "https://github.com/dejavu-fonts/dejavu-fonts/raw/master/ttf"
    async with httpx.AsyncClient(follow_redirects=True) as client:
        for name in ["DejaVuSans.ttf", "DejaVuSans-Bold.ttf"]:
            path = os.path.join(font_path, name)
            if not os.path.exists(path):
                resp = await client.get(f"{base_url}/{name}")
                with open(path, "wb") as f:
                    f.write(resp.content)
