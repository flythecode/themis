from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from routers import pdf, payments, users, chats, documents
import os
import asyncio
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def start_bot():
    """Запуск Telegram бота в фоне."""
    bot_token = os.environ.get("BOT_TOKEN")
    if not bot_token:
        logger.info("BOT_TOKEN not set, skipping bot startup")
        return

    from telegram.ext import ApplicationBuilder, CommandHandler, PreCheckoutQueryHandler, MessageHandler, filters
    from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo, LabeledPrice
    from telegram.ext import ContextTypes
    import httpx

    webapp_url = os.environ.get("WEBAPP_URL", "https://flythecode.github.io/themis/")
    backend_url = os.environ.get("BACKEND_URL", "")
    internal_token = os.environ.get("INTERNAL_TOKEN", "")

    async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
        keyboard = InlineKeyboardMarkup([[
            InlineKeyboardButton(
                text="⚖️ Открыть Themis",
                web_app=WebAppInfo(url=webapp_url)
            )
        ]])
        await update.message.reply_text(
            "Привет! Я Themis — ваш AI-юрист.\n\n"
            "Анализирую документы, составляю претензии и\n"
            "объясняю ваши права на понятном языке.",
            reply_markup=keyboard
        )

    async def cmd_pro(update: Update, context: ContextTypes.DEFAULT_TYPE):
        await context.bot.send_invoice(
            chat_id=update.effective_chat.id,
            title="Themis Pro — 30 дней",
            description="Безлимитные запросы, PDF анализ, все юрисдикции",
            payload="pro_30days",
            currency="XTR",
            prices=[LabeledPrice("Themis Pro", 690)],
        )

    async def pre_checkout(update: Update, context: ContextTypes.DEFAULT_TYPE):
        await update.pre_checkout_query.answer(ok=True)

    async def successful_payment(update: Update, context: ContextTypes.DEFAULT_TYPE):
        user_id = update.effective_user.id
        if backend_url:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{backend_url}/users/{user_id}/activate-pro",
                    headers={"X-Internal-Token": internal_token},
                    json={"days": 30, "source": "telegram_stars"},
                )
        await update.message.reply_text(
            "Themis Pro активирован на 30 дней!\n"
            "Перезапустите приложение чтобы увидеть изменения."
        )

    # /app — быстро открыть Mini App
    async def cmd_app(update: Update, context: ContextTypes.DEFAULT_TYPE):
        keyboard = InlineKeyboardMarkup([[
            InlineKeyboardButton(
                text="⚖️ Открыть Themis",
                web_app=WebAppInfo(url=webapp_url)
            )
        ]])
        await update.message.reply_text("Открываю Themis:", reply_markup=keyboard)

    app_bot = ApplicationBuilder().token(bot_token).build()
    app_bot.add_handler(CommandHandler("start", cmd_start))
    app_bot.add_handler(CommandHandler("app", cmd_app))
    app_bot.add_handler(CommandHandler("pro", cmd_pro))
    app_bot.add_handler(PreCheckoutQueryHandler(pre_checkout))
    app_bot.add_handler(MessageHandler(filters.SUCCESSFUL_PAYMENT, successful_payment))

    # Устанавливаем кнопку Menu
    from telegram import BotCommand, MenuButtonWebApp
    logger.info("Themis Bot starting...")
    await app_bot.initialize()

    await app_bot.bot.set_my_commands([
        BotCommand("start", "Начать"),
        BotCommand("app", "Открыть Themis"),
        BotCommand("pro", "Подписка Pro"),
    ])
    await app_bot.bot.set_chat_menu_button(
        menu_button=MenuButtonWebApp(text="⚖️ Themis", web_app=WebAppInfo(url=webapp_url))
    )

    await app_bot.start()
    await app_bot.updater.start_polling()
    logger.info("Themis Bot started successfully")


@asynccontextmanager
async def lifespan(app):
    # Создаём таблицы в БД
    from database import engine, Base
    from models import User, Chat
    if engine:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created")
    # Запускаем бота
    asyncio.create_task(start_bot())
    yield


app = FastAPI(title="Themis Backend", version="1.0.0", lifespan=lifespan)

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
app.include_router(chats.router, prefix="/chats")
app.include_router(documents.router, prefix="/documents")


@app.get("/health")
async def health():
    return {"status": "ok"}


