import re
from collections import Counter

from app.summarizer import STOP_WORDS, _tokens


def generate_mcqs(text):
    sentences = [
        sentence.strip()
        for sentence in re.split(r"(?<=[.!?])\s+", text)
        if len(_tokens(sentence)) >= 7
    ]
    terms = [word for word in _tokens(text) if word not in STOP_WORDS]
    frequencies = Counter(terms)
    all_terms = sorted(frequencies, key=lambda word: (-frequencies[word], -len(word), word))

    mcqs = []
    used_answers = set()
    for sentence in sentences:
        sentence_terms = set(_tokens(sentence)) - STOP_WORDS
        candidates = sorted(
            (word for word in sentence_terms if word not in used_answers),
            key=lambda word: (-frequencies[word], -len(word), word),
        )
        if not candidates:
            continue

        answer = candidates[0]
        distractors = [
            word for word in all_terms
            if word != answer and word not in sentence_terms
        ]
        if len(distractors) < 3:
            distractors.extend(
                word for word in all_terms
                if word != answer and word not in distractors
            )
        options = [answer, *distractors[:3]]
        if len(options) < 4:
            continue

        blanked_sentence = re.sub(
            rf"\b{re.escape(answer)}\b", "_____", sentence, count=1, flags=re.IGNORECASE
        )
        correct_position = len(mcqs) % 4
        options[0], options[correct_position] = options[correct_position], options[0]
        mcqs.append({
            "question": f"Complete the sentence from the material: {blanked_sentence}",
            "topic": answer.title(),
            "options": options,
            "answer": answer,
        })
        used_answers.add(answer)
        if len(mcqs) >= 20:
            break

    return mcqs
