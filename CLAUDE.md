# Sudoku

A personal remake of the iPhone game Enjoy Sudoku.

## Decisions (from Jordy, 14 Sep 2026)

- For Jordy's own iPhone, not for release in the App Store.
- Runs as a Home Screen web app (HTML and JavaScript, with a service worker for offline play), not a native app.
- Hosted on GitHub Pages under the jordykaufman account. GitHub says Pages sites are public, and on a free plan the repo must be public too (https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site). Ask Jordy before creating the repo or pushing to it.
- First version: the core game plus Statistics, and Skins and fonts. Not included: scanning puzzles with the camera, typing in a puzzle.

## How the original worked (sources)

- Enjoy Sudoku was made by Jason Linhart. The iPhone versions were ":) Sudoku +", ":) Sudoku" and "Sudoku Joy" (http://www.enjoysudoku.com/).
- App Store description of :) Sudoku + 5.3.1, with its feature list (Wayback capture, 27 Jan 2023): http://web.archive.org/web/20230127100052/https://apps.apple.com/us/app/enjoy-sudoku/id285994151
- iPhone manual, from an older version with 7 levels: http://www.enjoysudoku.com/iphone/manual.html
- Android manual, with 16 levels and the techniques each one needs. This app's levels come from it: http://www.enjoysudoku.com/android/manual.html
- Web version, still playable: http://www.enjoysudoku.com/webplay/. Its hints come in stages: first a digit, then the technique name with the house highlighted, then the cell.
- Two keypads below the board: large digits to place a digit, small digits for pencil marks (Jordy's memory of the iPhone app, and how a reviewer describes it). This app does the same, so nothing else decides whether a tap places or marks.
- Technique definitions: Sudopedia mirror (http://sudopedia.enjoysudoku.com/), HoDoKu (https://hodoku.sourceforge.net/en/techniques.php), SudokuWiki (https://www.sudokuwiki.org/Strategy_Families).

## Our own choices (not from the original)

- Locked Candidate (direct pointing) is read as a pointing move that leads straight to a placement. The Sudopedia mirror has no page for it.
- Levels the manual lists without a new technique (`src/engine/rating.js`): Never Played to Super Simple need only Full House and are split by the number of empty cells; Diabolical is a puzzle whose hardest technique is Fiendish and that uses Fiendish techniques in 2 or more steps.
- Time added for hints and other help: `HINT_PENALTY_SECONDS` in `src/engine/hint.js` and `PENALTY` in `src/app/game.js`.
- Skin names, digit styles and the app icon.
- Two optional highlights for the selected digit (settings Show singles and Show fish, `src/app/highlights.js`): a stronger colour on a cell that is the only place left for it in a row, column or block (holding that cell places the digit, `onPress` in `src/app/dom.js`), and an outline on the cells of a basic X-Wing, Swordfish or Jellyfish for it, smallest first, with every base line holding at least two candidates.
- A key on either pad turns green once all nine of its digit are placed.

## Rules

- Write our own code, text and graphics. Don't copy code, images or wording from Enjoy Sudoku.
- Hint and lesson text: plain sentences, no metaphors (Jordy's writing rules).

## Layout

- `src/engine/`: puzzle logic with no DOM. `grid.js` geometry, `text.js` names and sentences used in hints, `board.js` board state, `solver.js` backtracking solver, `generator.js` carving puzzles, `logic.js` logical solving, `levels.js` levels, `rating.js` level rules, `hint.js` hints for a player's position, `validate.js` step checks.
- `src/engine/techniques/`: one file per group of techniques, `common.js` shared helpers, `order.js` the order the solver tries techniques in.
- `src/app/`: the web app. `main.js` screens and navigation, `play.js` the game screen, `board-view.js` the board, `game.js` game state, `learn.js` lessons, `puzzles.js` puzzle supply, `settings.js`, `stats.js`, `storage.js`.
- `data/puzzles.json` (puzzles per level) and `data/examples.json` (Learn examples) are built by `node scripts/bank.js`.
- `docs/techniques.md`: the Step format and hint conventions every technique follows.

## Commands

- `npm test` runs the tests in `test/`.
- `node scripts/fuzz.js --text 1` solves random puzzles and checks every step against the solution, that techniques don't change the board, and the hint conventions.
- `node scripts/survey.js` reports how often each level and technique comes up in generated puzzles.
- Before publishing: run `node scripts/version.js` so installed copies download the new files. `sw.js` lists every file the app needs; `test/sw.test.js` checks the list.
- Local preview: `python3 -m http.server 8123` in this folder (`.claude/launch.json`).
