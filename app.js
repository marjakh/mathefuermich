const ROUND_LENGTH = 10;

let mode = 'mixed';
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

function makeTask() {
  switch (mode) {
    case 'plus':       return makePlainTask('plus');
    case 'minus':      return makePlainTask('minus');
    case 'plusSplit':  return makePlusSplitTask();
    case 'minusSplit': return makeMinusSplitTask();
    default:           return makePlainTask(Math.random() < 0.5 ? 'plus' : 'minus');
  }
}

// Every exercise mode has far more than ROUND_LENGTH possible tasks, so a
// few retries always find an unseen one; the cap only guards against an
// endless loop if that ever stops being true.
function makeUniqueTask() {
  for (let i = 0; i < 100; i++) {
    const task = makeTask();
    const key = JSON.stringify(task.lines);
    if (!usedTasks.has(key)) {
      usedTasks.add(key);
      return task;
    }
  }
  return makeTask();
}

function renderTask(task) {
  const el = $('task');
  el.innerHTML = '';
  blanks = [];
  for (const line of task.lines) {
    const lineEl = document.createElement('div');
    lineEl.className = 'task-line';
    for (const token of line) {
      if (typeof token === 'string') {
        const span = document.createElement('span');
        span.textContent = token;
        lineEl.appendChild(span);
      } else {
        const blank = document.createElement('span');
        const len = String(token.value).length;
        blank.className = 'blank digits-' + len;
        blanks.push({ el: blank, value: token.value, len });
        lineEl.appendChild(blank);
      }
    }
    el.appendChild(lineEl);
  }
  blankIndex = 0;
  entry = '';
  blanks[0].el.classList.add('active');
}

function activeBlank() {
  return blanks[blankIndex];
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
    blank.el.classList.remove('active');
    blank.el.classList.add('done');
    entry = '';
    blankIndex++;
    if (blankIndex >= blanks.length) {
      finishTask();
    } else {
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
