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
FREQUENCY_URL = "https://raw.githubusercontent.com/Digital-Pushkin-Lab/Russian-Word-Frequency-Lists-for-Children/main/wordlist_detcorpus_50000.csv"
MORPHOLOGY_URL = "https://raw.githubusercontent.com/danakt/russian-words/master/russian.txt"
WORD_RE = re.compile(r"^[а-яё]{3,18}$", re.IGNORECASE)
BAD = {"блядь","блять","ебать","ебало","хуйня","пизда","говно","мудак","дерьмо","пиздец","нахуй","сука","мразь"}
STOPWORDS = {"что","быть","она","оно","они","как","это","этот","эта","эти","весь","все","всё","свой","своя","свои","сам","сама","сами","себя","кто","где","куда","когда","почему","зачем","так","там","тут","здесь","вот","уже","еще","ещё","только","тоже","также","один","одна","одно","одни","такой","такая","такие","мочь","может","очень","много","мало","больше","меньше","мой","моя","мое","мои","твой","твоя","ваш","ваша","наш","наша","его","ее","её","их","мне","тебе","ему","ей","нам","вам","меня","тебя","него","нее","них","который","которая","которые","чтобы","будто","словно","ли","же","бы","не","ни","да","нет","и","или","а","но","о","об","во","в","на","с","со","к","ко","от","до","за","по","из","у","под","над","при","про","без","для","через","между"}
TARGET = 50_000

def download(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "QQCross-Russian-Lexicon/1.0"})
    with urllib.request.urlopen(request, timeout=120) as response:
        return response.read()

def clean(raw: str) -> str | None:
    word = str(raw or "").strip().lower().replace("ё", "е")
    if not WORD_RE.fullmatch(word) or word in BAD or word in STOPWORDS:
        return None
    return word.upper()

def build(frequency_text: str, morphology_bytes: bytes) -> list[str]:
    ranked: list[tuple[float, str]] = []
    seen: set[str] = set()
    for row in csv.DictReader(io.StringIO(frequency_text)):
        word = clean(row.get("lemma"))
        if not word or word in seen:
            continue
        seen.add(word)
        try:
            ipm = float(row.get("ipm") or 0)
        except (TypeError, ValueError):
            ipm = 0.0
        ranked.append((ipm, word))
    ranked.sort(key=lambda item: (-item[0], item[1]))
    words = [word for _, word in ranked[:TARGET]]
    if len(words) < TARGET:
        morphology = morphology_bytes.decode("cp1251", errors="ignore").splitlines()
        for raw in morphology:
            word = clean(raw)
            if word and word not in seen:
                seen.add(word)
                words.append(word)
                if len(words) == TARGET:
                    break
    if len(words) != TARGET:
        raise RuntimeError(f"Получено {len(words)} уникальных русских слов; требуется ровно {TARGET}.")
    if len(set(words)) != TARGET or any(not re.fullmatch(r"[А-Я]{3,18}", w) for w in words):
        raise RuntimeError("Проверка словаря не пройдена: дубликаты или некириллические записи.")
    return words

def main() -> None:
    frequency = download(FREQUENCY_URL).decode("utf-8-sig")
    morphology = download(MORPHOLOGY_URL)
    words = build(frequency, morphology)
    payload = {
        "version": 1, "language": "ru", "count": len(words),
        "normalization": "Ё приведена к Е; только кириллические русские слова длиной 3–18 букв",
        "sources": [
            {"name": "Russian Word Frequency Lists for Children", "url": FREQUENCY_URL, "license": "CC0-1.0"},
            {"name": "danakt/russian-words", "url": MORPHOLOGY_URL, "license": "MIT"}
        ],
        "words": words
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"QQCross: {len(words)} уникальных русских слов")
    print(f"Слов из пяти букв: {sum(len(w) == 5 for w in words)}")

if __name__ == "__main__":
    main()
