// engine.js — standard chess rules. No DOM, no variant logic. Pure and testable.
//
// Board: 8x8 array `board[r][c]`, r=0 is the top (Black's back rank), r=7 the
// bottom (White's back rank). A piece is { type, color } or null.
//   type: 'p' | 'n' | 'b' | 'r' | 'q' | 'k'
//   color: 'w' | 'b'
// White moves up the board (decreasing r); Black moves down (increasing r).

export const WHITE = 'w';
export const BLACK = 'b';

export const other = (color) => (color === WHITE ? BLACK : WHITE);
export const inBounds = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
export const key = (r, c) => `${r},${c}`;

const BACK_RANK = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];

// Stable identity for pieces so the view can animate a piece across squares
// instead of rebuilding the DOM. Preserved through cloneState (spread copy),
// moves (same object slides), promotion and spy reveal (id reused on purpose).
let _pieceId = 0;
export const newId = () => `p${++_pieceId}`;

/** Fresh standard starting position. */
export function initialState() {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let c = 0; c < 8; c++) {
    board[0][c] = { type: BACK_RANK[c], color: BLACK, id: newId() };
    board[1][c] = { type: 'p', color: BLACK, id: newId() };
    board[6][c] = { type: 'p', color: WHITE, id: newId() };
    board[7][c] = { type: BACK_RANK[c], color: WHITE, id: newId() };
  }
  return {
    board,
    turn: WHITE,
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    ep: null, // en passant target square {r,c} the capturing pawn lands on
    halfmove: 0, // for the 50-move rule
    fullmove: 1,
  };
}

export function cloneState(s) {
  return {
    board: s.board.map((row) => row.map((p) => (p ? { ...p } : null))),
    turn: s.turn,
    castling: { ...s.castling },
    ep: s.ep ? { ...s.ep } : null,
    halfmove: s.halfmove,
    fullmove: s.fullmove,
  };
}

const forward = (color) => (color === WHITE ? -1 : 1); // row delta toward the enemy
const startRow = (color) => (color === WHITE ? 6 : 1);
const promoRow = (color) => (color === WHITE ? 0 : 7);

const SLIDES = {
  b: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
  r: [[-1, 0], [1, 0], [0, -1], [0, 1]],
  q: [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]],
};
const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

/** Is square (r,c) attacked by `color`? Ignores king-safety recursion. */
export function isAttacked(board, r, c, color) {
  // Pawns: a pawn of `color` attacks the square diagonally "forward".
  const pr = r - forward(color); // rows the attacking pawn would sit on
  for (const dc of [-1, 1]) {
    const p = inBounds(pr, c + dc) ? board[pr][c + dc] : null;
    if (p && p.color === color && p.type === 'p') return true;
  }
  for (const [dr, dc] of KNIGHT) {
    const p = inBounds(r + dr, c + dc) ? board[r + dr][c + dc] : null;
    if (p && p.color === color && p.type === 'n') return true;
  }
  for (const [dr, dc] of KING) {
    const p = inBounds(r + dr, c + dc) ? board[r + dr][c + dc] : null;
    if (p && p.color === color && p.type === 'k') return true;
  }
  for (const [type, dirs] of [['b', SLIDES.b], ['r', SLIDES.r]]) {
    for (const [dr, dc] of dirs) {
      let nr = r + dr, nc = c + dc;
      while (inBounds(nr, nc)) {
        const p = board[nr][nc];
        if (p) {
          if (p.color === color && (p.type === type || p.type === 'q')) return true;
          break;
        }
        nr += dr; nc += dc;
      }
    }
  }
  return false;
}

export function findKing(board, color) {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.type === 'k' && p.color === color) return { r, c };
    }
  return null;
}

export function inCheck(state, color) {
  const k = findKing(state.board, color);
  return k ? isAttacked(state.board, k.r, k.c, other(color)) : false;
}

/**
 * Pseudo-legal moves for the piece at (r,c) — does NOT filter king safety.
 * A move is { from:{r,c}, to:{r,c}, piece, capture?, ep?, castle?, promotion? }.
 */
function pseudoMoves(state, r, c) {
  const { board } = state;
  const p = board[r][c];
  if (!p) return [];
  const moves = [];
  const push = (to, extra = {}) => moves.push({ from: { r, c }, to, piece: p.type, ...extra });

  if (p.type === 'p') {
    const dir = forward(p.color);
    const one = r + dir;
    // forward one
    if (inBounds(one, c) && !board[one][c]) {
      addPawnAdvance(push, p, one, c);
      // forward two from start
      const two = r + 2 * dir;
      if (r === startRow(p.color) && !board[two][c]) push({ r: two, c }, { double: true });
    }
    // captures
    for (const dc of [-1, 1]) {
      const nc = c + dc;
      if (!inBounds(one, nc)) continue;
      const target = board[one][nc];
      if (target && target.color !== p.color) addPawnAdvance(push, p, one, nc, { capture: true });
      // en passant
      else if (state.ep && state.ep.r === one && state.ep.c === nc) push({ r: one, c: nc }, { capture: true, ep: true });
    }
    return moves;
  }

  if (p.type === 'n') {
    for (const [dr, dc] of KNIGHT) {
      const nr = r + dr, nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      const t = board[nr][nc];
      if (!t) push({ r: nr, c: nc });
      else if (t.color !== p.color) push({ r: nr, c: nc }, { capture: true });
    }
    return moves;
  }

  if (p.type === 'k') {
    for (const [dr, dc] of KING) {
      const nr = r + dr, nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      const t = board[nr][nc];
      if (!t) push({ r: nr, c: nc });
      else if (t.color !== p.color) push({ r: nr, c: nc }, { capture: true });
    }
    addCastles(state, r, c, p, push);
    return moves;
  }

  // sliders: b, r, q
  for (const [dr, dc] of SLIDES[p.type]) {
    let nr = r + dr, nc = c + dc;
    while (inBounds(nr, nc)) {
      const t = board[nr][nc];
      if (!t) push({ r: nr, c: nc });
      else {
        if (t.color !== p.color) push({ r: nr, c: nc }, { capture: true });
        break;
      }
      nr += dr; nc += dc;
    }
  }
  return moves;
}

function addPawnAdvance(push, p, r, c, extra = {}) {
  if (r === promoRow(p.color)) {
    for (const promo of ['q', 'r', 'b', 'n']) push({ r, c }, { ...extra, promotion: promo });
  } else {
    push({ r, c }, extra);
  }
}

function addCastles(state, r, c, p, push) {
  const { board, castling } = state;
  const homeRow = p.color === WHITE ? 7 : 0;
  if (r !== homeRow || c !== 4) return;
  if (inCheckStatic(board, p.color)) return; // cannot castle out of check
  const enemy = other(p.color);
  const canK = p.color === WHITE ? castling.wK : castling.bK;
  const canQ = p.color === WHITE ? castling.wQ : castling.bQ;
  // king-side: squares f,g empty and not attacked; rook on h
  if (canK && !board[homeRow][5] && !board[homeRow][6] &&
      board[homeRow][7] && board[homeRow][7].type === 'r' && board[homeRow][7].color === p.color &&
      !isAttacked(board, homeRow, 5, enemy) && !isAttacked(board, homeRow, 6, enemy)) {
    push({ r: homeRow, c: 6 }, { castle: 'K' });
  }
  // queen-side: b,c,d empty; c,d not attacked; rook on a
  if (canQ && !board[homeRow][1] && !board[homeRow][2] && !board[homeRow][3] &&
      board[homeRow][0] && board[homeRow][0].type === 'r' && board[homeRow][0].color === p.color &&
      !isAttacked(board, homeRow, 3, enemy) && !isAttacked(board, homeRow, 2, enemy)) {
    push({ r: homeRow, c: 2 }, { castle: 'Q' });
  }
}

function inCheckStatic(board, color) {
  const k = findKing(board, color);
  return k ? isAttacked(board, k.r, k.c, other(color)) : false;
}

/** Apply a move, returning a new state. Assumes the move is legal-shaped. */
export function applyMove(state, move) {
  const s = cloneState(state);
  const { board } = s;
  const p = board[move.from.r][move.from.c];
  const mover = p.color;

  const isPawn = p.type === 'p';
  const isCapture = !!move.capture;
  s.halfmove = isPawn || isCapture ? 0 : s.halfmove + 1;

  // move the piece
  board[move.to.r][move.to.c] = p;
  board[move.from.r][move.from.c] = null;

  // en passant capture removes the pawn behind the target square
  if (move.ep) board[move.from.r][move.to.c] = null;

  // promotion — reuse the pawn's id so the view slides then swaps the glyph
  if (move.promotion) board[move.to.r][move.to.c] = { type: move.promotion, color: mover, id: p.id };

  // castling: move the rook too
  if (move.castle) {
    const homeRow = move.from.r;
    if (move.castle === 'K') {
      board[homeRow][5] = board[homeRow][7];
      board[homeRow][7] = null;
    } else {
      board[homeRow][3] = board[homeRow][0];
      board[homeRow][0] = null;
    }
  }

  // update castling rights
  if (p.type === 'k') {
    if (mover === WHITE) { s.castling.wK = s.castling.wQ = false; }
    else { s.castling.bK = s.castling.bQ = false; }
  }
  const touchRook = (r, c) => {
    if (r === 7 && c === 0) s.castling.wQ = false;
    if (r === 7 && c === 7) s.castling.wK = false;
    if (r === 0 && c === 0) s.castling.bQ = false;
    if (r === 0 && c === 7) s.castling.bK = false;
  };
  touchRook(move.from.r, move.from.c); // rook moved
  touchRook(move.to.r, move.to.c); // rook captured

  // set en passant target
  s.ep = move.double ? { r: (move.from.r + move.to.r) / 2, c: move.from.c } : null;

  s.turn = other(mover);
  if (mover === BLACK) s.fullmove += 1;
  return s;
}

/** All fully legal moves for a color (king-safety filtered). */
export function legalMoves(state, color = state.turn) {
  const out = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.color !== color) continue;
      for (const m of pseudoMoves(state, r, c)) {
        const after = applyMove(state, m);
        if (!inCheckStatic(after.board, color)) out.push(m);
      }
    }
  return out;
}

export function legalMovesFrom(state, r, c) {
  const p = state.board[r][c];
  if (!p || p.color !== state.turn) return [];
  return pseudoMoves(state, r, c).filter((m) => !inCheckStatic(applyMove(state, m).board, p.color));
}

/** 'checkmate' | 'stalemate' | 'check' | 'ongoing' | 'draw-50' */
export function gameStatus(state) {
  const noMoves = legalMoves(state, state.turn).length === 0;
  const checked = inCheck(state, state.turn);
  if (noMoves) return checked ? 'checkmate' : 'stalemate';
  if (state.halfmove >= 100) return 'draw-50';
  return checked ? 'check' : 'ongoing';
}
