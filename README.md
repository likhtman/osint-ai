# AI OSINT Explorer

Автоматизированный инструмент для проведения конкурентной/информационной разведки (OSINT) с использованием ИИ от Google Deepmind.

## Архитектура
* **Backend:** Python + FastAPI. Использует SSE (Server-Sent Events) для стриминга ответов в реальном времени. В планах интеграция: Gemini, OpenAI, Perplexity, Anthropic и Tavily.
* **Frontend:** React + Vite. Премиальный дизайн с использованием чистого CSS (Vanilla CSS), эффектами glassmorphism и микро-анимациями Framer Motion. 

## Быстрый старт

### Backend
1. Перейдите в папку бэкенда: `cd backend`
2. Создайте виртуальное окружение: `python3 -m venv venv` 
3. Активируйте: `source venv/bin/activate`
4. Установите зависимости: `pip install -r requirements.txt`
5. Запустите сервер: `uvicorn app.main:app --reload` (Доступен на порту 8000)

### Frontend
1. Перейдите в папку фронтенда: `cd frontend`
2. Установите пакеты: `npm install`
3. Запустите: `npm run dev` (Откроется на порту 5173)
