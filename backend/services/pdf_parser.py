import pdfplumber
import io


def extract_text(pdf_bytes: bytes) -> tuple[str, int]:
    """Извлечь текст из PDF. Возвращает (text, page_count)."""
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        text = "\n".join(p.extract_text() or "" for p in pdf.pages)
        return text, len(pdf.pages)
