from fastapi import APIRouter, Request, HTTPException
import os

router = APIRouter()


@router.post("/stripe-webhook")
async def stripe_webhook(request: Request):
    """Phase 2: обработка Stripe webhook для Pro подписки."""
    # TODO: реализовать при подключении Stripe
    return {"status": "ok"}
