# Themis — Legal AI (Telegram Mini App)

## Что это
AI-юрист в Telegram Mini App. Анализирует документы, составляет претензии, даёт юридические советы. Работает на Claude Sonnet 4 (Anthropic API). Поддерживает RU/EN, любую юрисдикцию.

## Архитектура

```
Telegram Client
  ↓ (Mini App)
GitHub Pages [frontend/ — Vanilla JS modules]
  ↓ POST
Cloudflare Worker [worker/ — edge proxy, rate limit, CORS]
  ↓ чат: напрямую в Anthropic API
  ↓ PDF/users/chats: проксирует в FastAPI
FastAPI Backend [backend/ — Railway]
  ↓
PostgreSQL [Railway — users, chats]
  ↓
Telegram Bot [встроен в backend/main.py — polling]
```

## Продакшн URLs
- **Frontend:** https://flythecode.github.io/themis/
- **Worker:** https://themis-proxy.flythecode.workers.dev
- **Backend:** https://themis-production-6f7d.up.railway.app
- **GitHub:** https://github.com/flythecode/themis
- **Bot username:** найти в BotFather (токен ниже)

## Ключи и секреты
Все секреты хранятся ТОЛЬКО в сервисах, НЕ в коде:
- **Anthropic API Key:** Cloudflare Worker Secrets + Railway Variables
- **Telegram Bot Token:** Railway Variables (BOT_TOKEN)
- **Internal Token:** Cloudflare Worker Secrets + Railway Variables
- **GitHub Token:** локально (scope: repo + workflow)
- **Cloudflare:** залогинен через `wrangler login` (email: flythecode@gmail.com)
- **Cloudflare KV ID:** `6dbbdf82a7b943e8b81add5b3cf58049`
- **DATABASE_URL:** Railway Variables (автоматически от PostgreSQL сервиса)

## Структура проекта (монорепо)

```
themis/
├── frontend/                # Vanilla JS Mini App → GitHub Pages
│   ├── index.html           # Точка входа
│   ├── css/main.css         # Стили (из прототипа themis-v3.html)
│   └── js/
│       ├── app.js           # Главный модуль, инициализация, Telegram, табы
│       ├── api.js           # Запросы к Worker proxy (callClaude, syncUser, chats API)
│       ├── storage.js       # Гибридное хранение: localStorage + серверная синхронизация
│       ├── i18n.js          # Переводы RU/EN + системные промпты для AI
│       ├── ui.js            # DOM helpers, форматирование, toast
│       ├── chat.js          # Логика чата, режимы, голос, отправка сообщений
│       └── paywall.js       # Free/Pro логика
│
├── worker/                  # Cloudflare Worker — edge proxy
│   ├── src/index.js         # Rate limiting (KV), CORS, роутинг запросов
│   └── wrangler.toml        # Конфиг (KV ID, ALLOWED_ORIGIN, BACKEND_URL)
│
├── backend/                 # Python FastAPI → Railway
│   ├── main.py              # FastAPI app + встроенный Telegram Bot (polling)
│   ├── database.py          # SQLAlchemy async engine, session, Base
│   ├── Dockerfile           # python:3.12-slim, копирует из backend/
│   ├── requirements.txt     # Все зависимости (fastapi, anthropic, telegram, etc.)
│   ├── routers/
│   │   ├── pdf.py           # POST /pdf/analyze (pdfplumber → Claude), /pdf/generate-docx
│   │   ├── users.py         # GET /users/{tg_id}/status, POST /users/sync, /activate-pro
│   │   ├── chats.py         # GET /chats/{tg_id}, POST /chats/save, DELETE, star
│   │   └── payments.py      # Stripe webhook (заглушка)
│   ├── models/
│   │   ├── user.py          # User: tg_id, is_pro, pro_until, country, lang
│   │   └── chat.py          # Chat: id, user_tg_id, mode, conv (JSON), starred
│   └── services/
│       ├── anthropic.py     # Anthropic SDK обёртка
│       ├── pdf_parser.py    # pdfplumber extract
│       └── storage.py       # DB абстракция (заглушки Phase 2)
│
├── bot/                     # Telegram Bot (standalone — НЕ используется в проде)
│   ├── main.py              # Bot entry point (для локальной разработки)
│   ├── handlers/            # start.py, payments.py
│   ├── requirements.txt
│   └── Dockerfile
│
├── .github/workflows/
│   ├── deploy-frontend.yml  # Push frontend/** → GitHub Pages
│   └── deploy-worker.yml    # Push worker/** → Cloudflare (нужен CLOUDFLARE_API_TOKEN secret)
│
├── railway.json             # Railway конфиг: dockerfilePath = backend/Dockerfile
├── themis-v3.html           # Исходный визуальный прототип (не менять!)
└── Themis_TZ_v2.docx        # Полное ТЗ v2.0
```

## Как деплоить

### Frontend (автоматически)
Push в `frontend/` → GitHub Actions → GitHub Pages

### Worker (вручную)
```bash
cd worker && wrangler deploy
```

### Backend + Bot (автоматически)
Push в `backend/` → Railway автодеплой из GitHub

## Railway Variables (backend сервис)
- `ANTHROPIC_API_KEY`
- `INTERNAL_TOKEN`
- `BOT_TOKEN`
- `WEBAPP_URL` = `https://flythecode.github.io/themis/`
- `DATABASE_URL` (от PostgreSQL сервиса)

## AI модель
`claude-sonnet-4-20250514` — используется в Worker (чат) и Backend (PDF анализ).

## 3 режима чата
1. **analyze** — анализ документов, риски [ВЫСОКИЙ/СРЕДНИЙ/ОК]
2. **generate** — составление претензий, жалоб (есть кнопка скачивания .txt)
3. **advise** — юридический совет, план действий

## Экраны Mini App
1. Onboarding (выбор языка, страны) — показывается один раз
2. Home — выбор режима + недавние чаты
3. Chat — диалог с AI
4. History — все чаты с поиском и фильтрами
5. Profile — статистика, Pro баннер, настройки

## Текущий статус (Phase 2 завершён)
- ✅ Frontend на GitHub Pages
- ✅ Cloudflare Worker (rate limiting, CORS, proxy)
- ✅ FastAPI Backend на Railway
- ✅ PostgreSQL на Railway
- ✅ Telegram Bot 24/7 (встроен в backend)
- ✅ Серверная синхронизация чатов и профиля
- ✅ Pro-статус из БД
- ✅ PDF анализ эндпоинт
- ✅ DOCX генерация эндпоинт
- ✅ Скачивание документов (.txt)
- ✅ i18n RU/EN
- ✅ Голосовой ввод
- ✅ Фото документов

## Что НЕ сделано / TODO
- [ ] Stripe платежи (webhook в payments.py — заглушка)
- [ ] Лендинг (landing.html)
- [ ] Alembic миграции (таблицы создаются через create_all)
- [ ] Redis кэш для rate limiting на сервере
- [ ] DOCX скачивание из UI (сейчас только .txt)
- [ ] Тестирование полного flow синхронизации

## Важные заметки
- **Прототип themis-v3.html — не менять!** Это визуальный эталон.
- Бот встроен в backend/main.py (не в отдельном сервисе) — запускается через asyncio при старте FastAPI
- Worker деплоится отдельно через `wrangler deploy`, НЕ через GitHub Actions (нет CLOUDFLARE_API_TOKEN в secrets)
- Dockerfile в backend/ копирует файлы с путём `COPY backend/ .` (контекст сборки — корень репо)
- railway.json указывает `dockerfilePath: backend/Dockerfile`
- Владелец: GitHub/Cloudflare — flythecode (flythecode@gmail.com)
