QQCross Wordle integration
===========================

The Wordle gameplay logic and visual interaction patterns in wordle.js and the
associated Wordle CSS are adapted from Ely242/Wordle:
https://github.com/Ely242/Wordle

Copyright (c) 2025 Ely
Used under the MIT License. The complete license text is preserved in
THIRD_PARTY_NOTICES.md.

The Russian word lists in data/wordle-words.json are derived from the
QQCross scanword dictionary and curated for five-letter Russian gameplay.

MIT License

Copyright (c) 2025 Ely

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Russian Wordle dictionary sources
=================================

The expanded valid-guess list is built from:
- danakt/russian-words, russian.txt (1,531,464 Russian word forms), used under MIT:
  https://github.com/danakt/russian-words
- Digital-Pushkin-Lab/Russian-Word-Frequency-Lists-for-Children, DetCorpus 50,000
  lemma frequency list, dedicated to the public domain under CC0 1.0:
  https://github.com/Digital-Pushkin-Lab/Russian-Word-Frequency-Lists-for-Children

MIT License

Copyright (c) 2020 Danakt Frost

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Additional five-letter Wordle candidates are sourced from:
- hingston/russian, 50,000-word frequency list based on the University of Leeds Corpus,
  corpus cleanup by hingston, distributed under CC BY 2.5:
  https://github.com/hingston/russian
The list is filtered to five-letter Cyrillic words and combined with QQCross's
existing dictionary. Attribution: University of Leeds Corpus; cleanup by hingston.


### Russian 50,000-word lexicon

- Source: https://github.com/Digital-Pushkin-Lab/Russian-Word-Frequency-Lists-for-Children
- File: `wordlist_detcorpus_50000.csv`
- License: CC0 1.0 Universal
- Build script: `scripts/build_russian_lexicon.py`
- The generated QQCross lexicon contains 50,000 unique Cyrillic Russian lemmas; `ё` is normalized to `е`.
