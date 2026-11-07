#!/usr/bin/env python3
"""Build QQCross's Russian Wordle dictionary from permissively licensed sources."""
from __future__ import annotations
import argparse
import csv
import io
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "wordle-words.json"
CACHE = ROOT / ".cache" / "wordle"
WORDLIST_URL = "https://raw.githubusercontent.com/danakt/russian-words/master/russian.txt"
FREQUENCY_URL = (
    "https://raw.githubusercontent.com/Digital-Pushkin-Lab/"
    "Russian-Word-Frequency-Lists-for-Children/main/wordlist_detcorpus_50000.csv"
)
WORD_RE = re.compile(r"^[а-яё]{5}$")
MIN_VALID_WORDS = 7500
MAX_FREQUENCY_ANSWERS = 700
MIN_ANSWER_IPM = 0.5
EXTRA_GUESSES = {"ТУНЕЦ", "КРЕСТ", "КОВШИ", "КЛЕЩИ", "СУШКА", "СЛИВА"}


def normalize_word(value: str) -> str | None:
    word = str(value or "").strip()
    if not word or word != word.lower() or not WORD_RE.fullmatch(word):
        return None
    return word.upper().replace("Ё", "Е")


def read_or_download(path: Path | None, url: str, encoding: str, cache_name: str) -> str:
    if path:
        return path.read_bytes().decode(encoding)
    cache_path = CACHE / cache_name
    if cache_path.exists():
        return cache_path.read_bytes().decode(encoding)
    CACHE.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "QQCross-Wordle-Dictionary/1.0"},
    )
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                content = response.read()
            cache_path.write_bytes(content)
            return content.decode(encoding)
        except Exception as error:
            last_error = error
            if attempt < 2:
                time.sleep(2 ** attempt)
    raise RuntimeError(f"Не удалось загрузить словарь {url}: {last_error}")


def build(source_text: str, frequency_text: str, existing: dict, min_valid: int) -> dict:
    base_valid = {
        normalize_word(word.lower())
        for word in (existing.get("valid") or []) + (existing.get("answers") or [])
        if isinstance(word, str)
    }
    base_valid.discard(None)

    source_words = set()
    for raw in source_text.splitlines():
        word = normalize_word(raw)
        if word:
            source_words.add(word)

    frequency_candidates: list[tuple[float, str]] = []
    for row in csv.DictReader(io.StringIO(frequency_text)):
        word = normalize_word(row.get("lemma", ""))
        if not word:
            continue
        try:
            ipm = float(row.get("ipm") or 0)
        except ValueError:
            continue
        if ipm >= MIN_ANSWER_IPM:
            frequency_candidates.append((ipm, word))
    frequency_candidates.sort(key=lambda item: (-item[0], item[1]))

    valid = set(base_valid) | source_words | {word for _, word in frequency_candidates} | EXTRA_GUESSES
    valid.add("ТУНЕЦ")

    answers: list[str] = []
    for word in existing.get("answers") or []:
        normalized = normalize_word(word.lower()) if isinstance(word, str) else None
        if normalized and normalized in valid and normalized != "ТУНЕЦ" and normalized not in answers:
            answers.append(normalized)

    target_count = len(existing.get("answers") or []) + MAX_FREQUENCY_ANSWERS
    for _, word in frequency_candidates:
        if word != "ТУНЕЦ" and word not in answers:
            answers.append(word)
        if len(answers) >= target_count:
            break

    threshold = min_valid  # Keep the initial 20x expansion target stable on future rebuilds.
    if len(valid) < threshold:
        raise RuntimeError(
            f"Словарь получился слишком маленьким: {len(valid)} слов; нужно минимум {threshold}. "
            f"Источник содержит {len(source_words)} уникальных пятибуквенных слов."
        )
    return {"answers": answers, "valid": sorted(valid)}


def self_test() -> None:
    assert normalize_word("тунец") == "ТУНЕЦ"
    assert normalize_word("берёза") is None
    assert normalize_word("Иван") is None
    sample = build(
        "тунец\nбанан\nслово\nИван\nдлинное",
        "lemma,abs_frequency,ipm\nсосна,100,10\nбанан,90,9\n",
        {"answers": [], "valid": []},
        1,
    )
    assert "ТУНЕЦ" in sample["valid"]
    assert "СОСНА" in sample["answers"]
    assert "БАНАН" in sample["answers"]
    assert "ТУНЕЦ" not in sample["answers"]
    print("Wordle dictionary builder self-test: OK")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-file", type=Path)
    parser.add_argument("--frequency-file", type=Path)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--min-valid", type=int, default=MIN_VALID_WORDS)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    if args.self_test:
        self_test()
        return 0

    existing = json.loads(args.output.read_text(encoding="utf-8"))
    source_text = read_or_download(args.source_file, WORDLIST_URL, "cp1251", "russian.txt")
    frequency_text = read_or_download(args.frequency_file, FREQUENCY_URL, "utf-8-sig", "frequency.csv")
    result = build(source_text, frequency_text, existing, args.min_valid)
    args.output.write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"Wordle dictionary built: {len(result['valid']):,} accepted guesses, "
        f"{len(result['answers']):,} answer words; ТУНЕЦ is accepted."
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"Wordle dictionary build failed: {error}", file=sys.stderr)
        raise SystemExit(1)
