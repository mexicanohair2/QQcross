#!/usr/bin/env python3
"""Strict validation for the published QQCross 100k Russian lexicon."""
from __future__ import annotations
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BAD = {"БЛЯДЬ","БЛЯТЬ","ЕБАТЬ","ЕБАЛО","ХУЙНЯ","ПИЗДА","ГОВНО","МУДАК","ДЕРЬМО","ПИЗДЕЦ","НАХУЙ","СУКА","МРАЗЬ"}
WORD = re.compile(r"^[А-Я]{2,18}$")
TRIPLE = re.compile(r"(.)\1\1")

def norm(value: object) -> str:
    return re.sub(r"[^А-Я]", "", str(value or "").upper().replace("Ё", "Е"))

def main() -> None:
    data = json.loads((ROOT / "data/russian-words-100000.json").read_text(encoding="utf-8"))
    words = data.get("words")
    if data.get("language") != "ru" or data.get("count") != 100_000:
        raise SystemExit("Неверные метаданные словаря: ожидалось ровно 100 000 русских записей.")
    if not isinstance(words, list) or len(words) != 100_000 or len(set(words)) != 100_000:
        raise SystemExit("Словарь должен содержать ровно 100 000 уникальных слов.")
    invalid = [w for w in words if not isinstance(w, str) or not WORD.fullmatch(w)]
    if invalid:
        raise SystemExit(f"Некорректные записи: {invalid[:10]}")
    bad = sorted(set(words) & BAD)
    if bad:
        raise SystemExit(f"В словаре остались запрещённые оскорбления: {bad}")
    malformed = [w for w in words if TRIPLE.search(w)]
    if malformed:
        raise SystemExit(f"В словаре остались записи с тремя одинаковыми буквами подряд: {malformed[:10]}")
    lexicon = set(words)
    wordle = json.loads((ROOT / "data/wordle-words.json").read_text(encoding="utf-8"))
    scanword = json.loads((ROOT / "data/scanword-dictionary.json").read_text(encoding="utf-8"))
    required_wordle = {norm(w) for w in wordle.get("valid", []) if norm(w) and norm(w) not in BAD and not TRIPLE.search(norm(w))}
    required_scanword = {norm(x.get("answer")) for x in scanword if isinstance(x, dict) and WORD.fullmatch(norm(x.get("answer"))) and norm(x.get("answer")) not in BAD and not TRIPLE.search(norm(x.get("answer")))}
    missing = (required_wordle | required_scanword) - lexicon
    if missing:
        raise SystemExit(f"Потеряны слова из игровых словарей: {sorted(missing)[:20]}")
    print(f"OK: {len(words):,} уникальных русских записей; {len(required_wordle):,} слов Wordle и {len(required_scanword):,} ответов сканворда сохранены.".replace(",", " "))
if __name__ == "__main__":
    main()
