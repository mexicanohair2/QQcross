#!/usr/bin/env python3
"""Audit scanword clues for accidental ambiguity and letter-hint overuse."""
from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "scanword-dictionary.json"
STOP = {
    "и", "в", "во", "на", "для", "из", "к", "с", "со", "по", "от", "до",
    "что", "это", "как", "или", "а", "но", "же", "его", "ее", "их", "при",
    "который", "которая", "которое", "которые", "такой", "такая", "такое",
    "быть", "есть", "может", "можно", "обычно", "например", "слово",
}
LETTER_HINT = re.compile(
    r"(?:первая|последняя|начальная|конечная)\s+букв|"
    r"букв\s+(?:в\s+начале|в\s+конце)",
    re.IGNORECASE,
)


def normalize_answer(value: object) -> str:
    return re.sub(r"[^А-ЯA-Z]", "", str(value or "").upper().replace("Ё", "Е"))


def normalize_clue(value: object) -> str:
    value = str(value or "").lower().replace("ё", "е")
    value = re.sub(r"[^а-яa-z0-9 ]", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def tokens(value: str) -> set[str]:
    return {word for word in normalize_clue(value).split()
            if len(word) > 2 and word not in STOP}


def main() -> int:
    try:
        data = json.loads(DATA.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"ERROR: cannot read dictionary: {exc}", file=sys.stderr)
        return 1

    errors: list[str] = []
    clues: dict[str, str] = {}
    seen_pairs: set[tuple[str, str]] = set()
    by_answer: dict[str, list[str]] = defaultdict(list)
    one_letter = 0
    for index, item in enumerate(data, 1):
        answer = normalize_answer(item.get("answer") or item.get("word"))
        clue = str(item.get("emoji") or item.get("flag") or item.get("clue")
                   or item.get("question") or item.get("clueShort") or "").strip()
        key = normalize_clue(clue)
        if not answer or len(answer) > 12 or not clue:
            errors.append(f"entry {index}: empty clue/answer or answer outside 1..12")
            continue
        if len(answer) == 1:
            one_letter += 1
        elif LETTER_HINT.search(clue):
            errors.append(
                f"entry {index}: letter-hint clue is attached to multi-letter answer {answer}: {clue}"
            )
        pair = (answer, key)
        if pair in seen_pairs:
            errors.append(f"entry {index}: duplicate answer/clue pair {answer}: {clue}")
        seen_pairs.add(pair)
        if key and key != "что изображено на картинке":
            previous = clues.get(key)
            if previous and previous != answer:
                errors.append(f"same clue used for {previous} and {answer}: {clue}")
            clues[key] = answer
        by_answer[answer].append(clue)

    if one_letter > 33:
        errors.append(f"too many one-letter answers: {one_letter} (maximum 33)")

    # Similarity is a review list, not an automatic rejection: antonyms and
    # related scientific terms can legitimately share vocabulary.
    entries = []
    for answer, variants in by_answer.items():
        if len(answer) > 1:
            entries.append((answer, max(variants, key=len)))
    candidates = []
    for i, (a_answer, a_clue) in enumerate(entries):
        a_tokens = tokens(a_clue)
        if len(a_tokens) < 2:
            continue
        for b_answer, b_clue in entries[i + 1:]:
            b_tokens = tokens(b_clue)
            common = a_tokens & b_tokens
            union = a_tokens | b_tokens
            similarity = len(common) / len(union) if union else 0
            if len(common) >= 2 and similarity >= 0.6:
                candidates.append((similarity, a_answer, b_answer, a_clue, b_clue))

    print(f"Dictionary entries: {len(data)}")
    print(f"Unique answers: {len(by_answer)}")
    print(f"One-letter answers (fallback-only in runtime): {one_letter}")
    print(f"Potentially similar clue pairs for human review: {len(candidates)}")
    for score, a, b, ca, cb in sorted(candidates, reverse=True)[:40]:
        print(f"  [{score:.2f}] {a}: {ca}  <>  {b}: {cb}")
    if errors:
        print(f"\nFAILED: {len(errors)} dictionary errors")
        for error in errors[:100]:
            print(" - " + error)
        return 1
    print("PASS: no duplicate exact clues across different answers and no multi-letter letter-hints.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
