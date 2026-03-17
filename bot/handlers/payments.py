from telegram import Update, LabeledPrice
from telegram.ext import ContextTypes
import httpx
import os

BACKEND_URL = os.environ.get("BACKEND_URL", "")
STARS_PRICE = 690  # ~9EUR по курсу Stars


async def send_invoice(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Выставить счёт на Pro подписку через Telegram Stars."""
    await context.bot.send_invoice(
        chat_id=update.effective_chat.id,
        title="Themis Pro — 30 дней",
        description="Безлимитные запросы, PDF анализ, все юрисдикции",
        payload="pro_30days",
        currency="XTR",  # Telegram Stars
        prices=[LabeledPrice("Themis Pro", STARS_PRICE)],
    )


async def pre_checkout(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.pre_checkout_query.answer(ok=True)


async def successful_payment(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id

    # Записываем Pro в backend
    async with httpx.AsyncClient() as client:
        await client.post(
            f"{BACKEND_URL}/users/{user_id}/activate-pro",
            headers={"X-Internal-Token": os.environ.get("INTERNAL_TOKEN", "")},
            json={"days": 30, "source": "telegram_stars"},
        )

    await update.message.reply_text(
        "Themis Pro активирован на 30 дней!\n"
        "Перезапустите приложение чтобы увидеть изменения."
    )
