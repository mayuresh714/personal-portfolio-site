// pieces.js — self-contained SVG chess pieces. Modern flat silhouettes in a
// shared 45x45 space so all six sit on a common baseline. Two-tone: `fill` is
// the body, `line` the outline + engraved detail, so pieces read on any square
// and in either theme.

const SHAPES = {
  // pawn: rounded body + collar + head
  p: `
    <ellipse cx="22.5" cy="38.5" rx="10.5" ry="3.2"/>
    <path d="M14.5 38.5 C14.5 33 17.5 31.5 18.2 28.5 L26.8 28.5 C27.5 31.5 30.5 33 30.5 38.5 Z"/>
    <path d="M17.5 29 L27.5 29 L26.3 25.5 L18.7 25.5 Z"/>
    <circle cx="22.5" cy="18.5" r="6.2"/>`,

  // rook: crenellated top + waisted body + base
  r: `
    <ellipse cx="22.5" cy="38.8" rx="11" ry="3.2"/>
    <path d="M13 39 L13 36 L15 33 L30 33 L32 36 L32 39 Z"/>
    <path d="M16 33 L15 20 L30 20 L29 33 Z"/>
    <path d="M13 20 L13 12 L17 12 L17 15 L21 15 L21 12 L24 12 L24 15 L28 15 L28 12 L32 12 L32 20 Z"/>`,

  // knight: stylised horse head
  n: `
    <ellipse cx="22.5" cy="38.8" rx="11" ry="3.2"/>
    <path d="M13 39 L13.5 35 C13.5 35 12.5 30 16 26 C18 23.7 18.5 22 18 20
             C15.5 22 13.5 22.5 12.5 20.5 C11.8 19 13.5 16.5 16 14.5
             C19.5 11.7 24 9.5 27.5 12 C31.5 14.8 33 20 33 27 C33 33 32.5 36 32.5 39 Z"/>
    <circle cx="16.5" cy="17.3" r="1.15" class="pc-eye"/>`,

  // bishop: mitre with slit + collar + base
  b: `
    <ellipse cx="22.5" cy="38.8" rx="11" ry="3.2"/>
    <path d="M14 39 L14 36 L16 34 L29 34 L31 36 L31 39 Z"/>
    <path d="M16.5 34 C15 30 17 26 22.5 20 C28 26 30 30 28.5 34 Z"/>
    <path d="M22.5 12.5 C25 15 25 17.5 22.5 19 C20 17.5 20 15 22.5 12.5 Z"/>
    <circle cx="22.5" cy="10.5" r="1.9"/>
    <line class="pc-slit" x1="22.5" y1="23" x2="22.5" y2="30"/>`,

  // queen: five-point crown + body + base
  q: `
    <ellipse cx="22.5" cy="38.8" rx="12" ry="3.2"/>
    <path d="M12 39 L12 36 L14 34 L31 34 L33 36 L33 39 Z"/>
    <path d="M13.5 34 L11 18 L16 24 L22.5 15 L29 24 L34 18 L31.5 34 Z"/>
    <circle cx="11" cy="16" r="2.1"/><circle cx="22.5" cy="13" r="2.3"/>
    <circle cx="34" cy="16" r="2.1"/><circle cx="16" cy="21.5" r="1.8"/>
    <circle cx="29" cy="21.5" r="1.8"/>`,

  // king: crown + cross + body + base
  k: `
    <ellipse cx="22.5" cy="38.8" rx="12" ry="3.2"/>
    <path d="M12 39 L12 36 L14 34 L31 34 L33 36 L33 39 Z"/>
    <path d="M13.5 34 L12 20 L18 24 L22.5 18 L27 24 L33 20 L31.5 34 Z"/>
    <path d="M20 12 L25 12 L25 9.5 L27 9.5 L27 7 L25 7 L25 4.5 L20 4.5 L20 7 L18 7 L18 9.5 L20 9.5 Z"
          class="pc-cross"/>`,
};

/**
 * Build an <svg> string for a piece. `color` is 'w' | 'b'.
 * We colour via CSS custom props set on the wrapper so the same markup adapts
 * to theme; inline fallbacks keep it correct if CSS is stripped.
 */
export function pieceSVG(type, color) {
  const cls = color === 'w' ? 'pc-white' : 'pc-black';
  return `<svg class="piece-svg ${cls}" viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <g class="pc-body">${SHAPES[type]}</g>
  </svg>`;
}

export const PIECE_NAME = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' };
