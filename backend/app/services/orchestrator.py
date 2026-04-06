import asyncio
import json
import re
from typing import AsyncGenerator
from app.services.llm_clients import call_gemini, call_perplexity, call_openai, call_anthropic, call_tavily
from app.models.models import ScanTask, ScanEntity, AiResponse
from app.core.db import AsyncSessionLocal
from sqlalchemy.ext.asyncio import AsyncSession


async def generate_hypotheses(text: str) -> list[dict]:
    prompt = (
        f"You are an OSINT Intelligence expert. Analyze these targets: {text}.\n"
        "1. Identify all entities (People, Companies, etc.).\n"
        "2. For each entity, provide the original name and its main international/transliterated variant (e.g., if input is Cyrillic, provide Latin).\n"
        "3. For BOTH the original name and the variant, generate exactly 2 research questions (hypotheses) in the language of that specific name.\n"
        "   - Question 1: 'Who is/What is {name}?'\n"
        "   - Question 2: A highly specific, non-generic intelligence question based on their likely field (investments, politics, tech, etc.).\n"
        "Return a JSON array of objects. Format:\n"
        "[{\"name\": \"...\", \"hypotheses\": [\"...\", \"...\"], \"lang\": \"ru/en/...\"}]"
    )
    
    response = await call_gemini(prompt, json_mode=True)
    try:
        data = json.loads(response)
        return data if isinstance(data, list) else []
    except Exception:
        return []

async def run_osint_analysis(query_text: str) -> AsyncGenerator[str, None]:
    async with AsyncSessionLocal() as db:
        # Create Main Task
        task = ScanTask(query_text=query_text)
        db.add(task)
        await db.commit()
        await db.refresh(task)

        targets = await generate_hypotheses(query_text)
        
        yield f"data: {json.dumps({'type': 'status', 'message': f'Found {len(targets)} search targets'})}\n\n"
        
        for target in targets:
            entity_name = target["name"]
            hypotheses = target.get("hypotheses", [f"Who is {entity_name}?"])
            
            # Save Entity
            db_entity = ScanEntity(
                task_id=task.id,
                name=entity_name,
                hypotheses=hypotheses
            )
            db.add(db_entity)
            await db.commit()
            await db.refresh(db_entity)
            
            yield f"data: {json.dumps({'type': 'entity_start', 'entity': entity_name})}\n\n"
            yield f"data: {json.dumps({'type': 'hypothesis_generated', 'entity': entity_name, 'hypotheses': hypotheses})}\n\n"
            
            platforms = ["Gemini", "Perplexity", "Anthropic", "OpenAI", "Tavily"]
            for p in platforms:
                yield f"data: {json.dumps({'type': 'platform_start', 'entity': entity_name, 'platform': p})}\n\n"
                
                if p == "Gemini":
                    osint_prompt = (
                        f"Context entity: {entity_name}\n"
                        f"Questions to answer: {', '.join(hypotheses)}\n"
                        f"Rules:\n"
                        f"1. You MUST answer in the EXACT SAME LANGUAGE as the Questions and the Context entity above. Do not translate to Russian if the questions are in another language.\n"
                        f"2. Base your answer strictly on facts from your search. Do not hallucinate.\n"
                        f"3. If there is no reliable information on the internet about this entity, say 'No reliable information found' in the requested language.\n"
                        f"4. Keep it concise, 3-4 sentences maximum."
                    )
                    resp = await call_gemini(osint_prompt, use_search=True)
                elif p == "Perplexity":
                    osint_prompt = (
                        f"Entity: {entity_name}\n"
                        f"Questions: {', '.join(hypotheses)}\n"
                        f"Please provide a factual OSINT summary in the same language as the questions."
                    )
                    resp = await call_perplexity(osint_prompt)
                elif p == "OpenAI":
                    osint_prompt = (
                        f"Analyze this entity: {entity_name}\n"
                        f"Questions: {', '.join(hypotheses)}\n"
                        f"Provide a factual summary. Address the questions. "
                        f"Respond in the same language as the questions."
                    )
                    resp = await call_openai(osint_prompt)
                elif p == "Anthropic":
                    osint_prompt = (
                        f"Investigation Subject: {entity_name}\n"
                        f"Focus Questions: {', '.join(hypotheses)}\n"
                        f"Provide a concise factual report. "
                        f"Answer in the same language as the questions."
                    )
                    resp = await call_anthropic(osint_prompt)
                elif p == "Tavily":
                    search_query = f"{entity_name} {' '.join(hypotheses)}"
                    resp = await call_tavily(search_query)
                else:
                    await asyncio.sleep(1.0)
                    resp = f"[{p}_API_KEY is missing]. Please add to .env file to enable this AI investigator."
                
                # Save Response to DB
                db_resp = AiResponse(
                    entity_id=db_entity.id,
                    platform=p,
                    content=resp
                )
                db.add(db_resp)
                await db.commit()
                
                yield f"data: {json.dumps({'type': 'platform_result', 'entity': entity_name, 'platform': p, 'result': resp})}\n\n"
             
    yield f"data: {json.dumps({'type': 'complete'})}\n\n"
