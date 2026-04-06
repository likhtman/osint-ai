import asyncio
import json
import re
from typing import AsyncGenerator

async def parse_entities(text: str) -> list[str]:
    parts = re.split(r'[,\n]+', text)
    return [p.strip() for p in parts if p.strip()]

async def run_osint_analysis(query_text: str) -> AsyncGenerator[str, None]:
    entities = await parse_entities(query_text)
    
    yield f"data: {json.dumps({'type': 'status', 'message': f'Найдено объектов: {len(entities)}'})}\n\n"
    
    for entity in entities:
        yield f"data: {json.dumps({'type': 'entity_start', 'entity': entity})}\n\n"
        
        # Шаг 1: Генерация гипотез
        yield f"data: {json.dumps({'type': 'hypothesis_start', 'entity': entity})}\n\n"
        await asyncio.sleep(1.0) # Заглушка вместо реального вызова Gemini
        hypotheses = [f"Какая биография у {entity}?", f"Последние новости про {entity}"]
        yield f"data: {json.dumps({'type': 'hypothesis_generated', 'entity': entity, 'hypotheses': hypotheses})}\n\n"
        
        # Шаг 2: Вызов различных моделей
        platforms = ["Gemini", "Perplexity", "Anthropic", "OpenAI", "Tavily"]
        for p in platforms:
             yield f"data: {json.dumps({'type': 'platform_start', 'entity': entity, 'platform': p})}\n\n"
             await asyncio.sleep(1.0) # Имитация времени ответа от API
             response = f"**Имитация ответа от {p} для объекта {entity}.**\nЗдесь будет реальный ответ от ИИ."
             yield f"data: {json.dumps({'type': 'platform_result', 'entity': entity, 'platform': p, 'result': response})}\n\n"
             
    yield f"data: {json.dumps({'type': 'complete'})}\n\n"
