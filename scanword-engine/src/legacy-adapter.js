const DIRECTION_INDEX = Object.freeze({ right: 0, down: 1, left: 2, up: 3 });

function compactClue(value) {
  const text = String(value ?? '').trim().replace(/\s+/gu, ' ');
  if (text.length <= 34) return text;
  const words = text.split(' ');
  let result = '';
  for (const word of words) {
    const next = result ? result + ' ' + word : word;
    if (next.length > 31) break;
    result = next;
  }
  return (result || text.slice(0, 30)).replace(/[.,;:!?]+$/u, '') + '…';
}

function hasEmoji(value) {
  return /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(String(value ?? ''));
}

/** Pass through the canonical 8-column × 12-row grid without rotation. */
export function toLegacyPuzzle(scanword, options = {}) {
  if (!scanword || scanword.width !== 8 || scanword.height !== 12) {
    throw new Error('Адаптер QQCross принимает только проверенную сетку 8×12.');
  }
  if (!Array.isArray(scanword.grid) || scanword.grid.length !== 12
    || scanword.grid.some(row => !Array.isArray(row) || row.length !== 8)) {
    throw new Error('В новом сканворде повреждена структура 8×12.');
  }
  if (!Array.isArray(scanword.words) || !scanword.words.length) {
    throw new Error('В новом сканворде нет ответов.');
  }

  const reservedKeys = new Set(['0,0']);
  const clueKeys = new Set();
  const used = new Set();
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 8; col++) {
      const cell = scanword.grid[row][col];
      const key = row + ',' + col;
      if (row === 0 && col === 0) {
        if (cell.type !== 'corner') throw new Error('Клетка (0,0) должна оставаться пустым углом.');
      } else if (cell.type === 'question') clueKeys.add(key);
      else if (cell.type === 'letter') used.add(key);
      else throw new Error('Клетка ' + key + ' не имеет роли.');
    }
  }

  const words = scanword.words.map(word => {
    if (!Object.prototype.hasOwnProperty.call(DIRECTION_INDEX, word.direction)) {
      throw new Error('У ответа ' + word.id + ' неизвестное направление.');
    }
    if (!Array.isArray(word.coordinates) || word.coordinates.length !== word.answer.length) {
      throw new Error('Координаты ответа ' + word.id + ' не совпадают с его длиной.');
    }
    const clue = String(word.question ?? '').trim();
    if (!clue) throw new Error('У ответа ' + word.id + ' отсутствует вопрос.');
    const clueRow = Number(word.clue?.row), clueCol = Number(word.clue?.col);
    if (!Number.isInteger(clueRow) || !Number.isInteger(clueCol)
      || clueRow < 0 || clueRow >= 12 || clueCol < 0 || clueCol >= 8) {
      throw new Error('Вопрос ответа ' + word.id + ' расположен вне сетки 8×12.');
    }
    if (clueRow === 11 || clueCol === 7) {
      throw new Error('Вопрос ответа ' + word.id + ' расположен на нижнем или правом краю сетки.');
    }
    if (scanword.grid[clueRow][clueCol]?.type !== 'question') {
      throw new Error('Вопрос ответа ' + word.id + ' не находится в клетке-вопросе.');
    }
    const delta = word.direction === 'right' ? [0, 1] : [1, 0];
    word.coordinates.forEach((point, index) => {
      const row = clueRow + delta[0] * (index + 1);
      const col = clueCol + delta[1] * (index + 1);
      if (point.row !== row || point.col !== col || row < 0 || row >= 12 || col < 0 || col >= 8) {
        throw new Error('Ответ ' + word.id + ' выходит за границы или неверно направлен от клетки-вопроса.');
      }
      if (scanword.grid[row][col]?.type !== 'letter') {
        throw new Error('Ответ ' + word.id + ' пересекает клетку, которая не является буквой.');
      }
    });
    return {
      id: String(word.id), answer: String(word.answer), sourceAnswer: String(word.answer),
      clue, clueShort: String(word.clueShort || compactClue(clue)), isEmoji: hasEmoji(clue),
      logic: word.logic === true, imageKey: word.imageKey ?? null,
      dir: word.direction, dirIndex: DIRECTION_INDEX[word.direction],
      cells: word.coordinates.map(point => [point.row, point.col]),
      clueCell: [word.clue.row, word.clue.col], special: word.special ?? null
    };
  });

  const id = 'scanword-' + String(scanword.metadata?.seed ?? Date.now())
    + '-' + String(options.sequence ?? Math.floor(Math.random() * 1e6));
  return { id, title: 'Сканворд', w: 8, h: 12, words, used, clueKeys, reservedKeys, coverage: 1 };
}
