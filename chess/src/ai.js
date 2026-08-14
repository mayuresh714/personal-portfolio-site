// ai.js — a modest but non-silly computer opponent. Alpha-beta negamax over
// material + a light piece-square bias, plus Spy-Chess awareness (it will defect
// a matured sleeper and occasionally interrogate on a hunch).

import { legalMoves, applyMove, inCheck } from './engine.js';
import { canReveal, reveal, maturityOf, canInterrogate, interrogate, makeMove, sleepersOf, allLegal } from './game.js';

const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

// small center-preference table applied to all pieces (mirrored per side)
const CENTER = [
  [0, 1, 2, 3, 3, 2, 1, 0], [1, 2, 3, 4, 4, 3, 2, 1], [2, 3, 5, 6, 6, 5, 3, 2],
  [3, 4, 6, 8, 8, 6, 4, 3], [3, 4, 6, 8, 8, 6, 4, 3], [2, 3, 5, 6, 6, 5, 3, 2],
  [1, 2, 3, 4, 4, 3, 2, 1], [0, 1, 2, 3, 3, 2, 1, 0],
];

function evaluate(state, forColor) {
  let score = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p) continue;
      let v = VAL[p.type] + CENTER[r][c];
      score += p.color === forColor ? v : -v;
    }
  return score;
}

function orderMoves(moves) {
  // captures and promotions first — cheap but effective move ordering
  return moves.sort((a, b) => (b.capture ? 1 : 0) + (b.promotion ? 1 : 0) - ((a.capture ? 1 : 0) + (a.promotion ? 1 : 0)));
}

// negamax with a single fixed evaluation perspective (rootColor)
function negamaxSigned(state, depth, alpha, beta, rootColor) {
  const moves = legalMoves(state, state.turn);
  if (moves.length === 0) {
    if (inCheck(state, state.turn)) return -99999 + (5 - depth); // prefer faster mates
    return 0;
  }
  if (depth === 0) {
    const e = evaluate(state, rootColor);
    return state.turn === rootColor ? e : -e;
  }
  let best = -Infinity;
  for (const m of orderMoves(moves)) {
    const v = -negamaxSigned(applyMove(state, m), depth - 1, -beta, -alpha, rootColor);
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/** Choose the best normal move for the side to move. */
export function bestMove(state, depth = 3) {
  const me = state.turn;
  let best = null, bestScore = -Infinity;
  for (const m of orderMoves(legalMoves(state, me))) {
    const score = -negamaxSigned(applyMove(state, m), depth - 1, -Infinity, Infinity, me);
    if (score > bestScore) { bestScore = score; best = m; }
  }
  return best;
}

/**
 * Full AI turn for Spy Chess. Mutates `game` and returns a short description of
 * what it did, so the UI can narrate.
 */
export function aiTurn(game, me, depth = 3) {
  // 1) defect a matured sleeper when it is worth it (rook+ or an ability)
  if (canReveal(game, me).ok) {
    const spies = sleepersOf(game.state.board, me);
    let best = null;
    for (const s of spies) {
      const mat = maturityOf(game, me, s.piece.id);
      if (mat && (mat.M >= 4 || mat.ability.freeze)) { if (!best || mat.M > best.M) best = mat; }
    }
    if (best) {
      const res = reveal(game, me, best.id, { pieceChoice: 'n' });
      if (res.ok) return 'ai-reveal';
    }
  }
  // 2) occasional interrogation hunch on one of the AI's own non-king pieces
  const iq = canInterrogate(game, me);
  if (iq.ok && Math.random() < 0.12) {
    const mine = ownPieces(game.state.board, me);
    if (mine.length) {
      const g = mine[Math.floor(Math.random() * mine.length)];
      interrogate(game, me, g.r, g.c);
      return 'ai-interrogate';
    }
  }
  // 3) otherwise, best normal move — but never a frozen piece
  let mv = bestMove(game.state, depth);
  if (game.frozen && game.frozen.color === me && mv && game.state.board[mv.from.r][mv.from.c].id === game.frozen.id) {
    const legal = allLegal(game);
    mv = legal.sort((a, b) => (b.capture ? 1 : 0) - (a.capture ? 1 : 0))[0] || null;
  }
  if (mv) { makeMove(game, mv); return 'ai-move'; }
  return 'ai-none';
}

function ownPieces(board, color) {
  const out = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = board[r][c]; if (p && p.color === color && p.type !== 'k') out.push({ r, c }); }
  return out;
}
