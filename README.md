# AI OSINT Explorer

Инновационный инструмент для автоматизированной информационной разведки (OSINT) с использованием нескольких ИИ-движков.

## Ключевые возможности
* **Мульти-агентный поиск**: Одновременный опрос Gemini (с Google Search Grounding), Perplexity, Anthropic (Claude), OpenAI (GPT-4o) и Tavily.
* **Интеллектуальный генератор гипотез**: Автоматическое расширение сущностей (транслитерация, варианты имен) и формулирование специфических разведывательных вопросов на языке цели.
* **Database Persistence**: Все результаты сканирования сохраняются в SQLite. Доступна история последних 20 поисков.
* **Real-time Streaming**: Использование SSE для отображения процесса поиска и ответов ИИ по мере их поступления.
* **Premium UX/UI**: Современный дизайн в стиле glassmorphism с использованием Vanilla CSS, Framer Motion и Lucide Icons.

## Архитектура
* **Backend:** FastAPI (Python) + SQLAlchemy (Async SQLite).
* **Frontend:** React + Vite.

## Быстрый старт

### Backend
1. Перейдите в папку бэкенда: `cd backend`
2. Настройте `.env` (добавьте API ключи для Gemini, Perplexity, Anthropic и т.д.)
3. Установите зависимости: `pip install -r requirements.txt`
4. Запустите: `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`

### Frontend
1. Перейдите в папку фронтенда: `cd frontend`
2. Установите пакеты: `npm install`
3. Запустите: `npm run dev`
