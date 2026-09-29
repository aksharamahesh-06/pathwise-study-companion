import math
import re
from collections import Counter


STOP_WORDS = {
    "about", "after", "again", "also", "among", "because", "been", "before",
    "being", "between", "could", "does", "during", "each", "from", "have",
    "into", "more", "most", "other", "over", "same", "some", "such", "than",
    "that", "their", "them", "then", "there", "these", "they", "this", "those",
    "through", "under", "very", "what", "when", "where", "which", "while", "with",
    "would", "your", "and", "are", "for", "has", "her", "his", "its", "not", "the",
    "was", "were", "will", "you", "but", "can", "who", "all", "any", "one", "out",
}


def _tokens(text):
    return [word.lower() for word in re.findall(r"\b[a-zA-Z][a-zA-Z'-]{2,}\b", text)]


def _clean_study_text(text):
    # Program-heavy PDFs often put code and its complexity notes on one line.
    # Keep the explanatory complexity notes and omit the source listing.
    text = re.sub(
        r"(?is)\bJava\s+Program\b.*?(?=\bComplexity\s+Analysis\b|$)",
        " ",
        text,
    )
    text = re.sub(
        r"(?is)\bimport\s+java\.[\w.]+\s*;.*?(?=\bComplexity\s+Analysis\b|$)",
        " ",
        text,
    )
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
    return "\n".join(cleaned_lines)


def generate_summary(text):
    text = _clean_study_text(text)

    sentences = [
        sentence.strip()
        for sentence in re.split(r"(?<=[.!?])\s+", text)
        if len(sentence.split()) >= 5
    ]
    if not sentences:
        return (
            "## Study Summary\n\n"
            "This PDF appears to contain mostly source code, with too little "
            "explanatory text for a useful summary."
        )

    words = [word for word in _tokens(text) if word not in STOP_WORDS]
    frequencies = Counter(words)

    def score(sentence):
        keywords = set(_tokens(sentence)) - STOP_WORDS
        if not keywords:
            return 0
        return sum(frequencies[word] for word in keywords) / math.sqrt(len(keywords))

    selected = sorted(
        sorted(range(len(sentences)), key=lambda index: score(sentences[index]), reverse=True)[:6]
    )
    return "## Study Summary\n\n" + "\n\n".join(
        f"- {sentences[index]}" for index in selected
    )


def generate_flashcards(text, limit=5):
    text = _clean_study_text(text)
    sentences = [
        sentence.strip()
        for sentence in re.split(r"(?<=[.!?])\s+|\n+", text)
        if len(_tokens(sentence)) >= 7
    ]
    frequencies = Counter(word for word in _tokens(text) if word not in STOP_WORDS)
    cards = []
    used_fronts = set()
    for sentence in sentences:
        keywords = [
            word for word in _tokens(sentence)
            if word not in STOP_WORDS and word not in used_fronts
        ]
        if not keywords:
            continue
        topic = max(keywords, key=lambda word: frequencies[word])
        cards.append({
            "front": f"What is an important point about {topic}?",
            "back": sentence,
        })
        used_fronts.add(topic)
        if len(cards) >= limit:
            break
    return cards


def generate_long_answer_questions(text, limit=5):
    text = _clean_study_text(text)
    sentences = [
        sentence.strip()
        for sentence in re.split(r"(?<=[.!?])\s+|\n+", text)
        if len(_tokens(sentence)) >= 8
    ]
    frequencies = Counter(word for word in _tokens(text) if word not in STOP_WORDS)
    questions = []
    used_topics = set()
    for sentence in sentences:
        candidates = [
            word for word in _tokens(sentence)
            if word not in STOP_WORDS and word not in used_topics
        ]
        if not candidates:
            continue
        topic = max(candidates, key=lambda word: frequencies[word])
        questions.append({
            "question": (
                f"Explain {topic} and describe its role or importance based on the material."
            ),
            "answer_guide": sentence,
        })
        used_topics.add(topic)
        if len(questions) >= limit:
            break
    return questions
