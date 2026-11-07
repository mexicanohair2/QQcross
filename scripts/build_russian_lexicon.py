#!/usr/bin/env python3
"""Build a deterministic 50,000-entry Russian-only QQCross lexicon."""
from __future__ import annotations
import csv
import io
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "russian-words-50000.json"
SOURCE = "https://raw.githubusercontent.com/Digital-Pushkin-Lab/Russian-Word-Frequency-Lists-for-Children/main/wordlist_detcorpus_50000.csv"
WORD_RE = re.compile(r"^[а-яё]{3,18}$", re.IGNORECASE)
BAD = {
    "блядь", "блять", "ебать", "ебало", "хуйня", "пизда", "говно",
    "мудак", "дерьмо", "пиздец", "нахуй", "сука", "мразь"
}
TARGET = 50_000

def download() -> str:
    request = urllib.request.Request(SOURCE, headers={"User-Agent": "QQCross-Russian-Lexicon/1.0"})
    with urllib.request.urlopen(request, timeout=90) as response:
        return response.read().decode("utf-8-sig")

def build(text: str) -> list[str]:
    rows = csv.DictReader(io.StringIO(text))
    ranked: list[tuple[float, str]] = []
    seen: set[str] = set()
    for row in rows:
        raw = str(row.get("lemma") or "").strip().lower().replace("ё", "е")
        if not WORD_RE.fullmatch(raw) or raw in BAD or raw in seen:
            continue
        # Corpus lemmas are preferred; reject tokens containing Latin or punctuation.
        seen.add(raw)
        try:
            frequency = float(row.get("ipm") or 0)
        except (TypeError, ValueError):
            frequency = 0.0
        ranked.append((frequency, raw.upper()))
    ranked.sort(key=lambda item: (-item[0], item[1]))
    words = [word for _, word in ranked[:TARGET]]
    if len(words) != TARGET:
        raise RuntimeError(f"Источник дал только {len(words)} уникальных русских слов; нужно ровно {TARGET}.")
    if len(set(words)) != TARGET or any(not re.fullmatch(r"[А-Я]{3,18}", w) for w in words):
        raise RuntimeError("Проверка словаря не пройдена: найдены дубликаты или некириллические слова.")
    return words

def main() -> None:
    words = build(download())
    payload = {
        "version": 1,
        "language": "ru",
        "count": len(words),
        "normalization": "Ё приведена к Е; только кириллические леммы длиной 3–18 букв",
        "sources": [{"name": "Russian Word Frequency Lists for Children", "url": SOURCE, "license": "CC0-1.0"}],
        "words": words,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"QQCross Russian lexicon: {len(words)} unique words")
    print(f"5-letter subset: {sum(len(w) == 5 for w in words)}")

if __name__ == "__main__":
    main()
