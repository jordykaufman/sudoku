# Writing a technique

Each technique is an object in one of the files in `src/engine/techniques/`. Each
file's default export is an array of these objects. `order.js` sets the order the
solver tries techniques in, and `src/engine/levels.js` sets each technique's level.
`singles.js` is the reference implementation: copy its shape.

## Technique object

    {
      id: 'x-wing',             // must match the id in order.js and levels.js
      name: 'X-Wing',           // shown in hints; use the name from the Enjoy Sudoku manual
      lesson: ['...', '...'],   // paragraphs for the Learn screen
      find(board) { ... },      // returns a Step or null, and must not change the board
    }

## Board

`src/engine/board.js`. Fields:

- `values`: `Uint8Array(81)`, the placed digit of each cell, 0 when empty.
- `cands`: `Uint16Array(81)`, the candidate mask of each empty cell, 0 for filled cells.
- `givens`: `Uint8Array(81)`, 1 for the puzzle's original clues. Solved cells that were not clues have 0.

Methods: `has(cell, digit)`, `count(cell)`, `candidates(cell)`, `where(house, digit)`,
`placed(house, digit)`, `clone()`.

Geometry and masks are in `src/engine/grid.js`: cells 0-80 row by row, houses 0-8 rows,
9-17 columns, 18-26 blocks, `HOUSES`, `CELL_HOUSES`, `PEERS`, `sees`, `commonPeers`,
`sharedHouses`, `bit`, `POPCOUNT`, `DIGITS`, `maskOf`. Text helpers are in
`src/engine/text.js`, including `removalText`, which writes the "Remove 5 from R1C2."
sentences. `src/engine/techniques/common.js` has `combinations`, `sortEliminations`,
`targetsFor` and the highlight helpers `keyMarks`, `elimMarks` and `resultCells`.

## Step

    {
      technique: 'unique-rectangle',
      variant: 'type 2',                  // optional, shown after the name
      placements: [[cell, digit], ...],
      eliminations: [[cell, digit], ...],
      stages: [{ text, ...highlights }, ...],
    }

Rules:

- At least one placement or elimination.
- Every placement and every elimination must be a current candidate (`board.has`).
- No duplicate eliminations.
- `find` is deterministic and returns the first pattern it finds.
- Keep `find` fast: a few milliseconds on a typical board.

## Hint stages

Stages go from least to most revealing. The player presses More to see the next one.
The UI shows the technique name from the second stage on.

1. A nudge that doesn't name the technique: the digit ("Consider the digit 5.") or the
   area ("Look at row 3.").
2. The pattern, with highlights: which cells or candidates to look at and why they matter.
3. The result: exactly what to place or remove, naming every cell.

Techniques with long patterns, such as chains and coloring, can use more stages, for
example one that shows the chain before the stage that gives the result.

Wording:

- Cells: `R1C2` (`cellName`). Houses: `row 1`, `column 1`, `block 1` (`houseName`).
- Lists: `R1C2, R1C5 and R3C4` (`cellList`, `joinList`).
- Articles: `a 5`, `an 8` (`aDigit`).
- Plain sentences that say what is true and why. No metaphors.

## Highlights

Every field is optional.

- `digit`: highlight every placed copy of this digit and every candidate for it. Each
  cell that holds the digit, or a pencil mark for it, is shaded as a whole.
- `houses`: house indices to shade. Inside a shaded house the digit colours win, so the
  cells where the digit can go still stand out.
- `cells`: `[cell, role]` pairs. Roles: `key` (cells in the pattern), `target` (cells
  that change), `fin`, and `a` and `b` (the two colors in coloring and chains).
- `marks`: `[cell, digit, role]` for single candidates. Roles: `key`, `elim` (being
  removed), `place` (being placed), `fin`, `a`, `b`.
- `links`: `[cellA, digitA, cellB, digitB, strong]`, drawn as lines between candidates.
  `strong` is true for a strong link.

For chains, mark the chain's candidates with role `key` and draw each link. In a chain of
cells with two candidates (Remote Pair, XY-Chain), draw the link between two neighboring
cells on the digit they share. For coloring, mark the two colors with roles `a` and `b`.

## Tests

- `test/<file>.test.js`: for each technique, at least one board where `find` returns
  exactly the expected placements and eliminations, and one board where it returns null.
  Build boards with `Board.fromCandidateGrid(text)`; a pencil-mark grid copied from
  HoDoKu or SudokuWiki works. Run one file with `node --test test/<file>.test.js`.
- `node scripts/fuzz.js --groups <file> --count 300` runs every technique at every
  position of random puzzles. It checks each step against the solution and checks that
  find() left the board unchanged. Add `--text 1` to also check the hint conventions
  (`checkHintText` in `src/engine/validate.js`). It must report 0 failures.
