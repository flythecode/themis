FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

RUN mkdir -p /app/fonts && \
    cp /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf /app/fonts/ && \
    cp /usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf /app/fonts/

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
