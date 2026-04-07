import asyncio
import json
from typing import AsyncGenerator
from app.services.llm_clients import call_gemini, call_perplexity, call_openai, call_openai_search, call_anthropic
from app.models.models import ScanTask, ScanEntity, AiResponse
from app.core.db import AsyncSessionLocal


PLATFORM_CONFIGS = {
    "Gemini": {
        "prompt": "Context entity: {entity}\nQuestions to answer: {questions}\nRules:\n1. You MUST answer in the EXACT SAME LANGUAGE as the Questions and the Context entity above.\n2. Base your answer strictly on facts from your search. Do not hallucinate.\n3. If there is no reliable information on the internet about this entity, say 'No reliable information found' in the requested language.\n4. Keep it concise, 3-4 sentences maximum.",
        "call": lambda prompt: call_gemini(prompt, use_search=True),
    },
    "Perplexity": {
        "prompt": "Entity: {entity}\nQuestions: {questions}\nPlease provide a factual OSINT summary in the same language as the questions.",
        "call": call_perplexity,
    },
    "ChatGPT (Search)": {
        "prompt": "Conduct a web research for: {entity}\nSpecific questions: {questions}\nProvide a summary with any found links or facts. Same language as questions.",
        "call": call_openai_search,
    },
    "OpenAI": {
        "prompt": "Factual analysis of entity: {entity}\nContext: {questions}\nProvide a summary based only on your model knowledge. Same language as questions.",
        "call": call_openai,
    },
    "Anthropic": {
        "prompt": "Investigation Subject: {entity}\nFocus Questions: {questions}\nProvide a concise factual report. Answer in the same language as the questions.",
        "call": call_anthropic,
    },
}


async def generate_hypotheses(text: str) -> list[dict]:
    prompt = (
        f"You are an OSINT Intelligence expert. Analyze these targets: {text}.\n"
        "1. Identify all entities (People, Companies, etc.).\n"
        "2. For each entity, provide the original name and its main international/transliterated variant (e.g., if input is Cyrillic, provide Latin).\n"
        "3. For BOTH the original name and the variant, generate exactly 2 research questions (hypotheses) in the language of that specific name.\n"
        "   - Question 1: 'Who is/What is {name}?'\n"
        "   - Question 2: A highly specific, non-generic intelligence question based on their likely field (investments, politics, tech, etc.).\n"
        "Return a JSON array of objects. Format:\n"
        '[{"name": "...", "hypotheses": ["...", "..."], "lang": "ru/en/..."}]'
    )

    response = await call_gemini(prompt, json_mode=True)
    try:
        data = json.loads(response)
        return data if isinstance(data, list) else []
    except Exception:
        return []


async def _query_platform(platform_name: str, entity_name: str, hypotheses: list[str]) -> str:
    """Query a single AI platform and return its response."""
    config = PLATFORM_CONFIGS[platform_name]
    prompt = config["prompt"].format(
        entity=entity_name,
        questions=", ".join(hypotheses),
    )
    return await config["call"](prompt)


async def run_osint_analysis(query_text: str) -> AsyncGenerator[str, None]:
    async with AsyncSessionLocal() as db:
        try:
            task = ScanTask(query_text=query_text)
            db.add(task)
            await db.commit()
            await db.refresh(task)

            targets = await generate_hypotheses(query_text)

            yield f"data: {json.dumps({'type': 'status', 'message': f'Found {len(targets)} search targets'})}\n\n"

            for target in targets:
                entity_name = target["name"]
                hypotheses = target.get("hypotheses", [f"Who is {entity_name}?"])

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

                # Query all platforms in parallel
                platform_names = list(PLATFORM_CONFIGS.keys())
                tasks = [
                    _query_platform(p, entity_name, hypotheses)
                    for p in platform_names
                ]

                # Send platform_start events for all platforms
                for p in platform_names:
                    yield f"data: {json.dumps({'type': 'platform_start', 'entity': entity_name, 'platform': p})}\n\n"

                results = await asyncio.gather(*tasks, return_exceptions=True)

                # Save all responses and emit results
                for p, result in zip(platform_names, results):
                    resp_text = str(result) if isinstance(result, Exception) else result

                    db_resp = AiResponse(
                        entity_id=db_entity.id,
                        platform=p,
                        content=resp_text,
                        status="error" if isinstance(result, Exception) else "completed"
                    )
                    db.add(db_resp)

                    yield f"data: {json.dumps({'type': 'platform_result', 'entity': entity_name, 'platform': p, 'result': resp_text})}\n\n"

                # Batch commit all responses per entity
                await db.commit()

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    yield f"data: {json.dumps({'type': 'complete'})}\n\n"
