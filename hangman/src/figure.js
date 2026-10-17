// The figure: which body parts it has for each setting, and the SVG that draws it.

// Every body part, in the order they are drawn: the body first, then hands and feet, then the face.
export const PARTS = [
  'head', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg',
  'leftHand', 'rightHand', 'leftFoot', 'rightFoot', 'leftEar', 'rightEar', 'nose', 'leftEye', 'rightEye', 'mouth',
];

// Parts added to the first six, in the order they are chosen. A pair is added whole, so the
// figure stays symmetrical. A group is passed over when taking it would leave a number of parts
// that the groups after it can't make up exactly.
const EXTRAS = [['leftEye', 'rightEye'], ['mouth'], ['leftHand', 'rightHand'], ['leftFoot', 'rightFoot'], ['nose'], ['leftEar', 'rightEar']];

const canMake = (groups, n) => n === 0 || groups.some((group, i) => group.length <= n && canMake(groups.slice(i + 1), n - group.length));

// The steps of a figure with `count` body parts (4 to 16). Each wrong guess draws the next
// step. A step is one part, except that with 4 or 5 the two arms are one step, and with 4 the
// two legs are too, so the figure is still head, body, arms and legs.
export function stepsFor(count) {
  if (count === 4) return [['head'], ['torso'], ['leftArm', 'rightArm'], ['leftLeg', 'rightLeg']];
  if (count === 5) return [['head'], ['torso'], ['leftArm', 'rightArm'], ['leftLeg'], ['rightLeg']];
  const chosen = new Set(PARTS.slice(0, 6));
  let left = count - chosen.size;
  for (const [i, group] of EXTRAS.entries()) {
    if (group.length > left || !canMake(EXTRAS.slice(i + 1), left - group.length)) continue;
    for (const part of group) chosen.add(part);
    left -= group.length;
  }
  return PARTS.filter((part) => chosen.has(part)).map((part) => [part]);
}

// Strokes have pathLength="1" so a part can be drawn in with a dash animation (styles.css).
// The head and hands are paths rather than circles because Safari ignores pathLength on circles.
const line = (d) => `<path pathLength="1" d="${d}"/>`;
const ring = (x, y, r) => line(`M${x} ${y - r} a${r} ${r} 0 1 1 0 ${2 * r} a${r} ${r} 0 1 1 0 ${-2 * r}`);
const dot = (x, y) => `<circle class="dot" cx="${x}" cy="${y}" r="2.6"/>`;
const cross = (x, y) => line(`M${x - 3} ${y - 3} l6 6 m0 -6 l-6 6`);

const SHAPES = {
  head: ring(140, 68, 20),
  torso: line('M140 88 V150'),
  leftArm: line('M140 104 L114 130'),
  rightArm: line('M140 104 L166 130'),
  leftLeg: line('M140 150 L118 192'),
  rightLeg: line('M140 150 L162 192'),
  leftHand: ring(110.8, 133.2, 4.5),
  rightHand: ring(169.2, 133.2, 4.5),
  leftFoot: line('M118 192 H105'),
  rightFoot: line('M162 192 H175'),
  leftEar: line('M121.3 61 C114 61 114 75 121.3 75'),
  rightEar: line('M158.7 61 C166 61 166 75 158.7 75'),
  nose: line('M140 66 L137 73 H141'),
  leftEye: dot(133, 63),
  rightEye: dot(147, 63),
  mouth: line('M132 81 Q140 75 148 81'),
};

// Once the round is lost the eyes are crosses.
const LOST = { leftEye: cross(133, 63), rightEye: cross(147, 63) };

// The gallows and the first `drawn` steps. `fresh` animates the last step drawn; `lost` makes
// the figure sway.
export function figureSvg(steps, drawn, { lost = false, fresh = false } = {}) {
  const body = steps
    .slice(0, drawn)
    .map((step, i) => {
      const shapes = step.map((part) => (lost && LOST[part]) || SHAPES[part]).join('');
      return `<g${fresh && i === drawn - 1 ? ' class="fresh"' : ''}>${shapes}</g>`;
    })
    .join('');
  const label = `${drawn} of ${steps.length} body parts drawn`;
  return (
    `<svg class="figure${lost ? ' lost' : ''}" viewBox="0 0 200 240" role="img" aria-label="${label}">` +
    '<path class="gallows" d="M18 228 H122 M50 228 V20 H140 M50 54 L84 20"/>' +
    `<g class="body"><path class="rope" d="M140 20 V48"/>${body}</g></svg>`
  );
}
