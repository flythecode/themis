from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from routers import pdf, payments, users
import os

app = FastAPI(title="Themis Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://themis-proxy.*.workers.dev"],
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type", "X-Internal-Token"],
)


@app.middleware("http")
async def verify_internal_token(request, call_next):
    """Только Worker может обращаться к internal эндпоинтам."""
    if request.url.path.startswith("/internal/"):
        token = request.headers.get("X-Internal-Token")
        if token != os.environ.get("INTERNAL_TOKEN"):
            raise HTTPException(status_code=403)
    return await call_next(request)


app.include_router(pdf.router, prefix="/pdf")
app.include_router(payments.router, prefix="/payments")
app.include_router(users.router, prefix="/users")


@app.get("/health")
async def health():
    return {"status": "ok"}
