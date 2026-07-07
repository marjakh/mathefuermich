---
name: verify
description: How to run and drive this app for verification — headless Chrome via CDP, no server or build step needed.
---

# Verifying mathefuermich

Static page, no build: open `file:///home/marja/code/mathefuermich/index.html`.

## Environment gotchas

- No `node`/`npm`/Playwright on this machine. `gjs` exists for quick JS
  logic checks (eval `app.js` with a stubbed `document`; function
  declarations leak out of direct eval and are callable afterwards).
- Drive the UI with headless Chrome + CDP from Python:
  `python3 -m venv … && pip install websocket-client`, then launch
  `google-chrome --headless=new --remote-debugging-port=<port>
  --remote-allow-origins=* --user-data-dir=$(mktemp -d) --window-size=520,900`
  (`--remote-allow-origins` is required or the websocket handshake 403s).
  Get the page websocket from `http://127.0.0.1:<port>/json/list`, then use
  `Runtime.evaluate` to click real buttons and `Page.captureScreenshot`.
- A working driver script exists as a template from a past session; if gone,
  the recipe above rebuilds it in ~50 lines.

## Flows worth driving

- Menu → each mode button starts a round of 10 tasks.
- App state is global in `app.js`: `blanks` (array of
  `{el, value, len, done}`), `blankIndex`, `results`. Read answers from
  `blanks[i].value` to solve tasks; type via the `#numpad` buttons
  (auto-checks when the entry reaches the blank's digit count).
- Wrong entry: 400 ms locked shake, progress dot turns ✗ for the task.
- Correct task: "🎉 Richtig!", next task after 900 ms.
- Table modes (`plusTable`/`minusTable`) render a `.grid`; blanks are
  clickable (free order). Ordered modes must ignore clicks on blanks.
- Full round ends on `#screen-done` with "Du hast N von 10 Sternen".
