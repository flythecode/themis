from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import ContextTypes
import os

WEBAPP_URL = os.environ.get("WEBAPP_URL", "https://YOUR_USERNAME.github.io/themis/")


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = InlineKeyboardMarkup([[
        InlineKeyboardButton(
            text="⚖️ Открыть Themis",
            web_app=WebAppInfo(url=WEBAPP_URL)
        )
    ]])

    await update.message.reply_text(
        "Привет! Я Themis — ваш AI-юрист.\n\n"
        "Анализирую документы, составляю претензии и\n"
        "объясняю ваши права на понятном языке.",
        reply_markup=keyboard
    )
