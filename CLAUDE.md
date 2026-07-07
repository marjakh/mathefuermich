# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A math practice app (in German) for a first-grader: pick an exercise mode
from the menu, solve a round of 10 tasks with an on-screen numpad, collect
stars. Numbers stay within 0–20 and results are never negative.

Static page, no build step, no dependencies, no tests: open `index.html`
in a browser. `index.html` holds the three screens (menu / quiz / done),
`style.css` the styling, `app.js` all logic. `TODO.md` lists planned
exercise categories.

For end-to-end verification there is no Node on this machine — see
`.claude/skills/verify/SKILL.md` for the headless-Chrome recipe.

## How app.js is structured

Round state lives in module-level globals (`mode`, `questionIndex`,
`results`, `stars`, …). One round = `ROUND_LENGTH` tasks of the mode
picked in the menu; `startRound(mode)` → `nextQuestion()` →
`makeUniqueTask()` (retries generation, JSON signature de-dups within
the round) → `renderTask()`.

**Task model** — the key abstraction; new exercise types should build on
it. A *token* is either static text (`string`) or a blank
(`{ value: number }`) the student must fill. A task is one of two shapes:

- `{ lines: [[token, …], …] }` — rendered as centered text lines
  (plain plus/minus, and the multi-step "Zerlegen" split tasks).
- `{ grid: [[token, …], …], freeOrder: true }` — rendered as a table
  (the "Rechentafeln"): sign at `[0][0]`, headers in the first row and
  column, each inner cell = column ∘ row. Generation (`makeTableTask`)
  guarantees the blanks are completable by deduction and prefers tables
  needing chained deductions (`chainDepth ≥ 2`) so fill order matters.

**Blank flow**: `renderTask` collects blanks into the `blanks` array;
digits typed on the numpad go into the active blank and auto-check once
the entry reaches the answer's digit count. Blanks are worked through in
order; a `freeOrder` task additionally makes blanks clickable
(`selectBlank`). After a correct entry the next *open* blank is selected
with wrap-around, which covers both modes. Any wrong entry marks the
whole task wrong (`results`), but the student retries until the task is
solved. A star is earned only if the first try was clean.

**Adding an exercise mode** touches three places: a `make…Task()`
generator returning the task model, a case in `makeTask()`, and a menu
button in `index.html` (plus its `.menu-btn.…` color in `style.css`).
