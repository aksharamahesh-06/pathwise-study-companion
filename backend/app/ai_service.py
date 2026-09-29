import json
import os
import re

from groq import Groq


MODEL_NAME = "openai/gpt-oss-20b"
MAX_INPUT_CHARS = 7000


def _prepare_material(text):
    # PDF extraction can contain HTML breaks and Markdown table borders. Clean
    # those before sending the text to the model to avoid wasting token quota.
    text = re.sub(r"<\s*br\s*/?\s*>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<\s*/?\s*p\s*>", "\n", text, flags=re.IGNORECASE)
    cleaned_lines = []
    for line in text.splitlines():
        line = line.strip()
        if not line or re.fullmatch(r"\|?\s*:?-{3,}(?:\s*\|\s*:?-{3,})+\s*\|?", line):
            continue
        if line.count("|") >= 2:
            cells = [cell.strip() for cell in line.strip("|").split("|") if cell.strip()]
            line = ". ".join(cells)
        cleaned_lines.append(line)
    return "\n".join(cleaned_lines)[:MAX_INPUT_CHARS]


def _generate_content(prompt, max_completion_tokens=4500):
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GROQ_API_KEY is not set. Add it to backend/.env and restart the backend."
        )

    with Groq(api_key=api_key) as client:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_completion_tokens=max_completion_tokens,
            reasoning_effort="low",
            response_format={"type": "json_object"},
        )
    return (response.choices[0].message.content or "").strip()


def generate_analysis(text):
    material = _prepare_material(text)
    raw = _generate_content(
        "Analyze this study material once. Return one JSON object with exactly these keys: "
        '"summary" (a concise, clear study summary using Markdown headings and bullets, '
        'under 250 words), "flashcards" (an array of 5 objects with "front" and "back"), '
        'and "mcqs" (an array of 20 objects with "question", "topic", "options" '
        'containing 4 strings, and "answer" exactly matching one option), plus '
        '"long_answer_questions" (an array of 5 objects with "question" and a concise '
        '"answer_guide" containing the key points a good answer should cover). '
        "Use only information in the material. Return valid JSON only; escape newlines "
        "inside JSON strings.\n\n"
        f"MATERIAL:\n{material}"
    )
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.IGNORECASE)
    object_start, object_end = raw.find("{"), raw.rfind("}")
    if object_start >= 0 and object_end > object_start:
        raw = raw[object_start : object_end + 1]
    try:
        result = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError("The AI returned invalid analysis data.") from exc

    if not isinstance(result, dict) or not isinstance(result.get("summary"), str):
        raise RuntimeError("The AI returned analysis data in an unexpected format.")
    flashcards = result.get("flashcards")
    if not isinstance(flashcards, list):
        flashcards = []
    valid_flashcards = [
        item for item in flashcards
        if isinstance(item, dict)
        and isinstance(item.get("front"), str)
        and isinstance(item.get("back"), str)
        and item["front"].strip()
        and item["back"].strip()
    ][:5]
    long_answer_questions = result.get("long_answer_questions")
    if not isinstance(long_answer_questions, list):
        long_answer_questions = []
    valid_long_answers = [
        item for item in long_answer_questions
        if isinstance(item, dict)
        and isinstance(item.get("question"), str)
        and isinstance(item.get("answer_guide"), str)
        and item["question"].strip()
        and item["answer_guide"].strip()
    ][:5]
    mcqs = result.get("mcqs")
    if not isinstance(mcqs, list):
        raise RuntimeError("The AI returned question data in an unexpected format.")
    valid_mcqs = [
        item
        for item in mcqs
        if isinstance(item, dict)
        and isinstance(item.get("question"), str)
        and isinstance(item.get("options"), list)
        and isinstance(item.get("answer"), str)
        and all(isinstance(option, str) for option in item.get("options", []))
    ]
    if not result["summary"].strip() or not valid_mcqs:
        raise RuntimeError("The AI returned incomplete analysis data.")
    return result["summary"].strip(), valid_flashcards, valid_mcqs, valid_long_answers
