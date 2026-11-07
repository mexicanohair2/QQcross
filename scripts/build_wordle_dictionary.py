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
LEEDS_WORDLIST_URL = (
    "https://raw.githubusercontent.com/hingston/russian/master/"
    "50000-russian-words-cyrillic-only.txt"
)
WORD_RE = re.compile(r"^[а-яё]{5}$")
MIN_VALID_WORDS = 20000
MAX_FREQUENCY_ANSWERS = 5000
MIN_ANSWER_IPM = 0.05
LEEDS_ANSWER_LIMIT = 50000
EXCLUDED_WORDS = {
    "БЛЯДЬ", "БЛЯТЬ", "ПИПЕЦ", "ЕБАТЬ", "ЕБАЛО", "ХУЙНЯ",
    "ПИЗДА", "ГОВНО", "МУДАК", "ДЕРЬМО", "ХЕРНЯ", "ПИЗДЕЦ",
}
EXTRA_GUESSES = {"ТУНЕЦ", "КРЕСТ", "КОВШИ", "КЛЕЩИ", "СУШКА", "СЛИВА"}
EXTRA_ANSWERS = {"ТУНЕЦ"}


def normalize_word(value: str) -> str | None:
    word = str(value or "").strip()
    if not word or word != word.lower() or not WORD_RE.fullmatch(word):
        return None
    normalized = word.upper().replace("Ё", "Е")
    return None if normalized in EXCLUDED_WORDS else normalized


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


def build(
    source_text: str,
    frequency_text: str,
    leeds_text: str,
    existing: dict,
    min_valid: int,
) -> dict:
    base_valid = {
        normalize_word(word.lower())
        for word in (existing.get("valid") or []) + (existing.get("answers") or [])
        if isinstance(word, str)
    }
    base_valid.discard(None)

    source_words = {
        word
        for raw in source_text.splitlines()
        if (word := normalize_word(raw)) is not None
    }

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

    leeds_words: list[str] = []
    leeds_seen: set[str] = set()
    for raw in leeds_text.splitlines():
        word = normalize_word(raw)
        if word and word not in leeds_seen:
            leeds_seen.add(word)
            leeds_words.append(word)

    valid = (
        base_valid
        | source_words
        | {word for _, word in frequency_candidates}
        | leeds_seen
        | EXTRA_GUESSES
        | EXTRA_ANSWERS
    )

    answers: list[str] = []
    for raw in existing.get("answers") or []:
        word = normalize_word(raw.lower()) if isinstance(raw, str) else None
        if word and word in valid and word not in answers:
            answers.append(word)

    frequency_added = 0
    for _, word in frequency_candidates:
        if word not in answers:
            answers.append(word)
            frequency_added += 1
        if frequency_added >= MAX_FREQUENCY_ANSWERS:
            break

    for word in leeds_words[:LEEDS_ANSWER_LIMIT]:
        if word not in answers:
            answers.append(word)

    for word in sorted(EXTRA_ANSWERS):
        if word not in answers:
            answers.append(word)

    if len(valid) < min_valid:
        raise RuntimeError(
            f"Словарь получился слишком маленьким: {len(valid)} слов; нужно минимум {min_valid}. "
            f"Источник содержит {len(source_words)} словоформ и {len(leeds_seen)} частотных слов."
        )
    return {"answers": answers, "valid": sorted(valid)}


def self_test() -> None:
    assert normalize_word("тунец") == "ТУНЕЦ"
    assert normalize_word("берёза") is None
    assert normalize_word("Иван") is None
    assert normalize_word("блядь") is None
    sample = build(
        "тунец\nбанан\nслово\nИван\nдлинное",
        "lemma,abs_frequency,ipm\nсосна,100,10\nбанан,90,9\n",
        "банан\nсосна\nтунец\nдлинное",
        {"answers": [], "valid": []},
        1,
    )
    assert "ТУНЕЦ" in sample["valid"]
    assert "ТУНЕЦ" in sample["answers"]
    assert "СОСНА" in sample["answers"]
    assert "БАНАН" in sample["answers"]
    assert "БЛЯДЬ" not in sample["valid"]
    print("Wordle dictionary builder self-test: OK")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-file", type=Path)
    parser.add_argument("--frequency-file", type=Path)
    parser.add_argument("--leeds-file", type=Path)
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
    leeds_text = read_or_download(args.leeds_file, LEEDS_WORDLIST_URL, "utf-8", "leeds-50k.txt")
    result = build(source_text, frequency_text, leeds_text, existing, args.min_valid)
    args.output.write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"Wordle dictionary built: {len(result['valid']):,} accepted guesses, "
        f"{len(result['answers']):,} answer words; ТУНЕЦ is both accepted and playable."
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"Wordle dictionary build failed: {error}", file=sys.stderr)
        raise SystemExit(1)
