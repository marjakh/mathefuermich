const ROUND_LENGTH = 10;

let mode = null;
let questionIndex = 0;
let stars = 0;           // tasks solved correctly on the first try
let firstTry = true;     // no wrong entry yet in the current task
let results = [];        // per task: 'correct' | 'wrong' | null
let blanks = [];         // blanks of the current task, in fill order
let blankIndex = 0;      // which blank is active
let entry = '';          // digits typed into the active blank
let locked = false;      // input ignored while transitioning to the next task
let usedTasks = new Set(); // signatures of tasks already shown this round

const $ = id => document.getElementById(id);

function showScreen(name) {
  for (const s of ['menu', 'quiz', 'done']) {
    $('screen-' + s).classList.toggle('hidden', s !== name);
  }
}

function showMenu() {
  showScreen('menu');
}

function startRound(m) {
  mode = m;
  questionIndex = 0;
  stars = 0;
  results = new Array(ROUND_LENGTH).fill(null);
  usedTasks = new Set();
  showScreen('quiz');
  nextQuestion();
}

function renderProgress() {
  const el = $('progress');
  el.innerHTML = '';
  for (let i = 0; i < ROUND_LENGTH; i++) {
    const dot = document.createElement('div');
    dot.className = 'dot';
    if (results[i] === 'correct') {
      dot.classList.add('correct');
      dot.textContent = '✓';
    } else if (results[i] === 'wrong') {
      dot.classList.add('wrong');
      dot.textContent = '✗';
    } else if (i === questionIndex - 1) {
      dot.classList.add('current');
    }
    el.appendChild(dot);
  }
}

function randInt(max) {
  return Math.floor(Math.random() * (max + 1));
}

// A task is a list of lines; each line is a list of tokens. A token is
// either static text or a blank ({ value }) the student must fill in.
// All numbers stay within 0–20 and results are never negative.

function makePlainTask(op) {
  let a, b;
  if (op === 'plus') {
    a = randInt(20);
    b = randInt(20 - a);
    return { lines: [[`${a} + ${b} =`, { value: a + b }]] };
  }
  a = randInt(20);
  b = randInt(a);
  return { lines: [[`${a} − ${b} =`, { value: a - b }]] };
}

// Splitting tasks always cross the ten: the second number is split so
// that the first step lands exactly on 10.
function makePlusSplitTask() {
  const a = 2 + randInt(7);              // 2..9
  const c1 = 10 - a;                     // fills a up to 10
  const b = c1 + 1 + randInt(8 - c1);    // c1+1..9, so the rest is >= 1
  const c2 = b - c1;
  return { lines: [
    [`${a} + ${b} = ?`],
    [`${a} +`, { value: c1 }, '+', { value: c2 }],
    ['=', { value: a + b }],
  ] };
}

function makeMinusSplitTask() {
  const a = 11 + randInt(7);             // 11..18
  const c1 = a - 10;                     // brings a down to 10
  const b = c1 + 1 + randInt(8 - c1);    // c1+1..9, so the rest is >= 1
  const c2 = b - c1;
  return { lines: [
    [`${a} − ${b} = ?`],
    [`${a} −`, { value: c1 }, '−', { value: c2 }],
    ['=', { value: a - b }],
  ] };
}

// A table task is a grid: the top-left corner holds the sign, the rest
// of the first row and first column hold numbers, and each inner cell
// combines its column and row header (col + row or col − row). Some of
// the numbers are blanks, and the student fills them in any order —
// some blanks only become solvable once others are filled.

function pickDistinct(n, min, max) {
  const vals = new Set();
  while (vals.size < n) vals.add(min + randInt(max - min));
  return [...vals];
}

// How many waves of deductions it takes to complete the table, or
// Infinity if it cannot be completed. A blank is deducible once the
// other two numbers of its cell = col ∘ row equation are known.
function chainDepth(colBlank, rowBlank, cellBlank) {
  const colKnown = colBlank.map(b => !b);
  const rowKnown = rowBlank.map(b => !b);
  const cellKnown = cellBlank.map(row => row.map(b => !b));
  for (let depth = 0; ; depth++) {
    if (colKnown.every(Boolean) && rowKnown.every(Boolean) &&
        cellKnown.every(row => row.every(Boolean))) {
      return depth;
    }
    const wave = [];
    for (let r = 0; r < rowKnown.length; r++) {
      for (let c = 0; c < colKnown.length; c++) {
        const known = [colKnown[c], rowKnown[r], cellKnown[r][c]];
        if (known.filter(Boolean).length === 2) {
          if (!colKnown[c])      wave.push(() => colKnown[c] = true);
          else if (!rowKnown[r]) wave.push(() => rowKnown[r] = true);
          else                   wave.push(() => cellKnown[r][c] = true);
        }
      }
    }
    if (wave.length === 0) return Infinity;
    wave.forEach(fill => fill());
  }
}

function tryTableTask(sign) {
  const nCols = 2 + randInt(1);
  const nRows = 2 + randInt(1);
  const rowVals = pickDistinct(nRows, 0, 10);
  const maxRow = Math.max(...rowVals);
  const colVals = sign === '+'
    ? pickDistinct(nCols, 0, 20 - maxRow)  // keep every sum within 20
    : pickDistinct(nCols, maxRow, 20);     // keep every difference >= 0
  const colBlank = colVals.map(() => Math.random() < 0.4);
  const rowBlank = rowVals.map(() => Math.random() < 0.4);
  const cellBlank = rowVals.map(() => colVals.map(() => Math.random() < 0.5));
  const nBlanks =
    [...colBlank, ...rowBlank, ...cellBlank.flat()].filter(Boolean).length;
  if (nBlanks < 3 || nBlanks > 6) return null;
  const depth = chainDepth(colBlank, rowBlank, cellBlank);
  if (depth === Infinity) return null;
  const tok = (value, blank) => (blank ? { value } : String(value));
  const grid = [
    [sign, ...colVals.map((v, c) => tok(v, colBlank[c]))],
    ...rowVals.map((rv, r) => [
      tok(rv, rowBlank[r]),
      ...colVals.map((cv, c) =>
        tok(sign === '+' ? cv + rv : cv - rv, cellBlank[r][c])),
    ]),
  ];
  return { task: { grid, freeOrder: true }, depth };
}

function makeTableTask(sign) {
  // Prefer tables that need chained deductions (depth >= 2) so that the
  // order of filling matters; settle for any completable table if the
  // random search is unlucky.
  let fallback = null;
  for (let i = 0; !fallback || i < 300; i++) {
    const t = tryTableTask(sign);
    if (!t) continue;
    if (t.depth >= 2) return t.task;
    fallback = fallback || t.task;
  }
  return fallback;
}

function makeTask() {
  switch (mode) {
    case 'plus':       return makePlainTask('plus');
    case 'minus':      return makePlainTask('minus');
    case 'plusSplit':  return makePlusSplitTask();
    case 'minusSplit': return makeMinusSplitTask();
    case 'plusTable':  return makeTableTask('+');
    case 'minusTable': return makeTableTask('−');
  }
}

// Every exercise mode has far more than ROUND_LENGTH possible tasks, so a
// few retries always find an unseen one; the cap only guards against an
// endless loop if that ever stops being true.
function makeUniqueTask() {
  for (let i = 0; i < 100; i++) {
    const task = makeTask();
    const key = JSON.stringify(task);
    if (!usedTasks.has(key)) {
      usedTasks.add(key);
      return task;
    }
  }
  return makeTask();
}

function renderToken(token) {
  const span = document.createElement('span');
  if (typeof token === 'string') {
    span.textContent = token;
  } else {
    const len = String(token.value).length;
    span.className = 'blank digits-' + len;
    blanks.push({ el: span, value: token.value, len, done: false });
  }
  return span;
}

function renderGrid(grid) {
  const el = document.createElement('div');
  el.className = 'grid';
  el.style.gridTemplateColumns = `repeat(${grid[0].length}, auto)`;
  grid.forEach((row, r) => row.forEach((token, c) => {
    const cell = renderToken(token);
    cell.classList.add('cell');
    if (typeof token === 'string') {
      if (r === 0 && c === 0)      cell.classList.add('sign');
      else if (r === 0 || c === 0) cell.classList.add('head');
    }
    el.appendChild(cell);
  }));
  return el;
}

function renderTask(task) {
  const el = $('task');
  el.innerHTML = '';
  blanks = [];
  if (task.grid) {
    el.appendChild(renderGrid(task.grid));
  } else {
    for (const line of task.lines) {
      const lineEl = document.createElement('div');
      lineEl.className = 'task-line';
      for (const token of line) lineEl.appendChild(renderToken(token));
      el.appendChild(lineEl);
    }
  }
  if (task.freeOrder) {
    blanks.forEach((b, i) => {
      b.el.classList.add('clickable');
      b.el.onclick = () => selectBlank(i);
    });
  }
  blankIndex = 0;
  entry = '';
  blanks[0].el.classList.add('active');
}

function activeBlank() {
  return blanks[blankIndex];
}

function selectBlank(i) {
  if (locked || i === blankIndex || blanks[i].done) return;
  const cur = activeBlank();
  cur.el.classList.remove('active');
  cur.el.textContent = '';
  blankIndex = i;
  entry = '';
  blanks[i].el.classList.add('active');
}

function onDigit(digit) {
  if (locked) return;
  const blank = activeBlank();
  entry += digit;
  blank.el.textContent = entry;
  // Check automatically once the box is full.
  if (entry.length >= blank.len) checkEntry();
}

function onBackspace() {
  if (locked) return;
  entry = entry.slice(0, -1);
  activeBlank().el.textContent = entry;
}

function checkEntry() {
  const blank = activeBlank();
  if (parseInt(entry, 10) === blank.value) {
    blank.done = true;
    blank.el.classList.remove('active', 'clickable');
    blank.el.classList.add('done');
    entry = '';
    // Move on to the next open blank, wrapping around in tasks where
    // the student fills the blanks in their own order.
    const open = blanks.map((b, i) => i).filter(i => !blanks[i].done);
    if (open.length === 0) {
      finishTask();
    } else {
      blankIndex = open.find(i => i > blankIndex) ?? open[0];
      blanks[blankIndex].el.classList.add('active');
      $('feedback').textContent = '';
    }
  } else {
    firstTry = false;
    results[questionIndex - 1] = 'wrong';
    renderProgress();
    $('feedback').textContent = '🤔 Versuch es nochmal!';
    entry = '';
    blank.el.classList.remove('active');
    blank.el.classList.add('error');
    locked = true;
    setTimeout(() => {
      blank.el.textContent = '';
      blank.el.classList.remove('error');
      blank.el.classList.add('active');
      locked = false;
    }, 400);
  }
}

function finishTask() {
  if (firstTry) {
    stars++;
    results[questionIndex - 1] = 'correct';
  }
  renderProgress();
  $('feedback').textContent = '🎉 Richtig!';
  locked = true;
  setTimeout(nextQuestion, 900);
}

function nextQuestion() {
  locked = false;
  if (questionIndex >= ROUND_LENGTH) {
    finishRound();
    return;
  }
  questionIndex++;
  firstTry = true;
  renderProgress();
  renderTask(makeUniqueTask());
  $('feedback').textContent = '';
}

function finishRound() {
  showScreen('done');
  $('done-emoji').textContent = stars >= 9 ? '🏆' : stars >= 6 ? '🌟' : '💪';
  $('done-text').textContent =
    `Du hast ${stars} von ${ROUND_LENGTH} Sternen gesammelt!`;
}

function buildNumpad() {
  const el = $('numpad');
  for (const key of ['1','2','3','4','5','6','7','8','9','','0','⌫']) {
    const btn = document.createElement('button');
    btn.textContent = key;
    if (key === '') {
      btn.style.visibility = 'hidden'; // spacer to keep the grid aligned
    } else if (key === '⌫') {
      btn.className = 'key-back';
      btn.onclick = onBackspace;
    } else {
      btn.onclick = () => onDigit(key);
    }
    el.appendChild(btn);
  }
}

buildNumpad();
