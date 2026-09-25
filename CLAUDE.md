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
- Two optional highlights for the selected digit (settings Show singles and Show fish, `src/app/highlights.js`): a stronger colour on a cell that is the only place left for it in a row, column or block, or whose only pencil mark it is (holding that cell places the digit, `holdDigit` in `src/app/play.js` and `onPress` in `src/app/dom.js`; a cell with one pencil mark left is filled by a hold even with nothing highlighted), and an outline on the cells of a basic X-Wing, Swordfish or Jellyfish for it, smallest first, with every base line holding at least two candidates.
- A key on either pad turns green once all nine of its digit are placed.
- The last stage of a hint has an Apply button that makes the move (`applyHint` in `src/app/game.js`). The hint has already been paid for, so no time is added.
- Practice, from the home menu or a lesson (`src/app/practice.js`): position after position where one technique applies, to find and play. Pattern marks the pattern for practising the move alone, Answer shows the last hint stage, Reset restores the position. A move that is not part of the technique is shown in red and named. Positions come from `data/examples.json` in a different order each time, and each one is renamed and rearranged when it is dealt (`rearrange` in `src/engine/transform.js`), so the same position never looks the same twice.
- Check the board, on the hint menu (`checkWork` in `src/engine/hint.js`): names the cells holding a wrong digit, the cells whose pencil marks leave out their answer, and the pencil marks for digits already placed in the same row, column or block. A cell without pencil marks claims nothing, so it is never a mistake, and a mark problem that a wrong digit explains is left out, so the check names causes rather than consequences. Time is added once per position, and only when something is wrong.
- A hidden shortcut for Jordy: four quick taps on the level name at the top of the game screen make every move that the techniques up to Intricate allow, as one change that Undo takes back, and leave the candidates as pencil marks (`autoSolve` in `src/app/game.js`, `solveUpTo` in `src/engine/hint.js`). It does nothing while the board has a mistake, and a game solved this way is left out of the times in Statistics.

## Rules

- Write our own code, text and graphics. Don't copy code, images or wording from Enjoy Sudoku.
- Hint and lesson text: plain sentences, no metaphors (Jordy's writing rules).

## Layout

- `src/engine/`: puzzle logic with no DOM. `grid.js` geometry, `text.js` names and sentences used in hints, `board.js` board state, `solver.js` backtracking solver, `generator.js` carving puzzles, `logic.js` logical solving, `levels.js` levels, `rating.js` level rules, `hint.js` hints for a player's position, `validate.js` step checks.
- `src/engine/techniques/`: one file per group of techniques, `common.js` shared helpers, `order.js` the order the solver tries techniques in.
- `src/app/`: the web app. `main.js` screens and navigation, `play.js` the game screen, `practice.js` the practice screen, `board-view.js` the board, `pads.js` the two keypads, `game.js` game state, `learn.js` lessons, `examples.js` the example positions both screens use, `highlights.js` the singles and fish highlights, `puzzles.js` puzzle supply, `settings.js`, `stats.js`, `storage.js`.
- `data/puzzles.json` (puzzles per level) is built by `node scripts/bank.js`. `data/examples.json` (the positions Learn and Practice use, 30 per technique) is rebuilt on its own by `node scripts/examples.js --workers 4 --minutes 50`, which generates boards only to mine them and then throws them away, so the bank has nothing to do with it. The rules a position must pass are in `scripts/exercise-rules.js`, shared with the tests, and a position that fails them is left out rather than used to fill a technique up. A position counts when the technique applies there, whether or not an easier move applies too: Practice names the technique you are looking for, and insisting that nothing easier applied made the rarer techniques almost impossible to find (16,000 generated boards gave no Hidden Quad and no Sashimi Jellyfish, while the same boards hold thousands of positions where one applies). Two kinds of position are set aside and used only to fill a technique that would otherwise fall short: one with a Full House, a Naked Single or a Hidden Single going begging, which distracts from looking for something harder, and one where a technique earlier in the solving order makes one of the same changes, which would have the player work out the hard way what a simpler move does. That check goes through every pattern the simpler technique has: `find()` returns only the first, and which comes first depends on how the digits are named and the rows ordered, so checking the first alone let 386 flawed positions through.
- `docs/techniques.md`: the Step format and hint conventions every technique follows.

## Commands

- `npm test` runs the tests in `test/`.
- `node scripts/fuzz.js --text 1` solves random puzzles and checks every step against the solution, that techniques don't change the board, and the hint conventions.
- `node scripts/survey.js` reports how often each level and technique comes up in generated puzzles.
- Before publishing: run `node scripts/version.js` so installed copies download the new files. `sw.js` lists every file the app needs; `test/sw.test.js` checks the list. An installed copy looks for a new version whenever it comes to the foreground and reloads itself once the new files are cached (`keepUpdated` in `src/app/main.js`).
- Local preview: `python3 -m http.server 8123` in this folder (`.claude/launch.json`).
