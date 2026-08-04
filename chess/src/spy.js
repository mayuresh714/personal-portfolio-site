// spy.js — Classic Spy Chess rules layered on the pure engine.
// See CONSTITUTION.md; every rule here traces to a section there.
//
// A sleeper is tagged on the pawn object itself as `spyOwner`: the color that
// SECRETLY owns this enemy pawn. e.g. a black pawn with spyOwner:'w' is White's
// sleeper. The tag rides along through moves automatically (cloneState copies
// piece fields) and is destroyed exactly when the pawn is — capture, en passant,
// or promotion — which is precisely the "asset burned" rule (§3.4).

import {
  initialState, cloneState, applyMove, legalMovesFrom, legalMoves,
  gameStatus, inCheck, other, WHITE, BLACK,
} from './engine.js';

export const REVEAL_UNLOCK_FULLMOVE = 8; // §3.1
export const INTERROGATION_TOKENS = 2; // §4

/** startRow / promo direction helpers for a pawn of `color`. */
const startRow = (color) => (color === WHITE ? 6 : 1);
const promoRow = (color) => (color === WHITE ? 0 : 7);

/**
 * Create a new Spy Chess game.
 * assignments = { w: {r,c}, b: {r,c} } — coords of the ENEMY pawn each side
 * plants as its sleeper. `w` points at a black pawn; `b` at a white pawn.
 */
export function createGame(assignments) {
  const state = initialState();
  tagSpy(state.board, assignments.w, WHITE);
  tagSpy(state.board, assignments.b, BLACK);
  return {
    state,
    tokens: { w: INTERROGATION_TOKENS, b: INTERROGATION_TOKENS },
    revealed: { w: false, b: false }, // has this side already defected its spy?
    lost: { w: false, b: false }, // has this side's spy been burned?
    log: [], // human-readable event log
  };
}

function tagSpy(board, at, owner) {
  const p = board[at.r][at.c];
  if (!p || p.type !== 'p') throw new Error(`spy target at ${at.r},${at.c} is not a pawn`);
  if (p.color === owner) throw new Error('a spy must be one of the OPPONENT pawns');
  p.spyOwner = owner;
}

/** Locate a side's sleeper on the board, or null if it is gone. */
export function findSpy(board, owner) {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.spyOwner === owner) return { r, c, piece: p };
    }
  return null;
}

/** Refresh lost-flags: a spy is "lost" once it can no longer be found (§3.4). */
function syncLost(game) {
  for (const owner of [WHITE, BLACK]) {
    if (!game.revealed[owner] && !findSpy(game.state.board, owner)) game.lost[owner] = true;
  }
}

// ── normal moves ──────────────────────────────────────────────────────────

export function legalFrom(game, r, c) {
  return legalMovesFrom(game.state, r, c);
}

export function makeMove(game, move) {
  game.state = applyMove(game.state, move);
  syncLost(game);
  return game;
}

// ── reveal / defection (§3) ─────────────────────────────────────────────────

/** Advancement A: ranks the sleeper pawn has pushed toward ITS controller's edge. */
function advancement(piece, r) {
  return piece.color === WHITE ? startRow(WHITE) - r : r - startRow(BLACK);
}

/** Survival S: full moves elapsed past the unlock, capped at 8. */
function survival(game) {
  return Math.max(0, Math.min(game.state.fullmove - REVEAL_UNLOCK_FULLMOVE, 8));
}

/** Maturity score M and the piece tier it defects into (§3.3). */
export function maturity(game, owner) {
  const spy = findSpy(game.state.board, owner);
  if (!spy) return null;
  const A = advancement(spy.piece, spy.r);
  const S = survival(game);
  const M = A + Math.floor(S / 2);
  let tier, choices = null;
  if (M <= 1) tier = 'p';
  else if (M <= 3) { tier = 'n'; choices = ['n', 'b']; } // player picks
  else if (M <= 5) tier = 'r';
  else tier = 'q';
  return { A, S, M, tier, choices, at: { r: spy.r, c: spy.c } };
}

/** Can `owner` reveal right now? Returns {ok} or {ok:false, reason}. */
export function canReveal(game, owner) {
  if (game.state.turn !== owner) return { ok: false, reason: 'not your turn' };
  if (game.revealed[owner]) return { ok: false, reason: 'already revealed' };
  const spy = findSpy(game.state.board, owner);
  if (!spy) return { ok: false, reason: 'your sleeper is gone' };
  if (game.state.fullmove < REVEAL_UNLOCK_FULLMOVE)
    return { ok: false, reason: `locked until move ${REVEAL_UNLOCK_FULLMOVE}` };
  return { ok: true };
}

/**
 * Reveal (defect) the sleeper. `pieceChoice` only used when maturity offers a
 * choice ('n' or 'b'). Consumes the turn. Rejected if it leaves own king in
 * check (§3.2). Returns { ok } or { ok:false, reason }.
 */
export function reveal(game, owner, pieceChoice) {
  const gate = canReveal(game, owner);
  if (!gate.ok) return gate;
  const mat = maturity(game, owner);
  let type = mat.tier;
  if (mat.choices) type = mat.choices.includes(pieceChoice) ? pieceChoice : mat.choices[0];

  // build the post-reveal position on a clone, then verify king safety
  const next = cloneState(game.state);
  const { r, c } = mat.at;
  // a pawn that would materialise on the promotion rank becomes a queen instead
  if (type === 'p' && r === promoRow(owner)) type = 'q';
  next.board[r][c] = { type, color: owner };
  if (inCheck({ ...next, turn: owner }, owner))
    return { ok: false, reason: 'reveal would leave your king in check' };

  next.turn = other(owner);
  if (owner === BLACK) next.fullmove += 1;
  next.ep = null;
  next.halfmove = 0;
  game.state = next;
  game.revealed[owner] = true;
  const name = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen' }[type];
  game.log.push(`${owner === WHITE ? 'White' : 'Black'} revealed a sleeper — it defects as a ${name}! (M=${mat.M})`);
  return { ok: true, type, at: mat.at };
}

// ── interrogation / counter-intelligence (§4) ────────────────────────────────

/** Squares the current player may interrogate: their own pawns. */
export function interrogable(game, owner) {
  const out = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = game.state.board[r][c];
      if (p && p.color === owner && p.type === 'p') out.push({ r, c });
    }
  return out;
}

export function canInterrogate(game, owner) {
  if (game.state.turn !== owner) return { ok: false, reason: 'not your turn' };
  if (game.tokens[owner] <= 0) return { ok: false, reason: 'no interrogation tokens left' };
  if (inCheck(game.state, owner)) return { ok: false, reason: 'you are in check — you must respond' };
  return { ok: true };
}

/**
 * Interrogate one of your own pawns at (r,c). Correct hit neutralizes the enemy
 * sleeper; a miss just burns a token and the turn. Consumes the turn either way.
 */
export function interrogate(game, owner, r, c) {
  const gate = canInterrogate(game, owner);
  if (!gate.ok) return gate;
  const p = game.state.board[r][c];
  if (!p || p.color !== owner || p.type !== 'p')
    return { ok: false, reason: 'you can only interrogate your own pawns' };

  game.tokens[owner] -= 1;
  const enemy = other(owner);
  let hit = false;
  if (p.spyOwner === enemy) {
    delete p.spyOwner; // unmasked → loyal pawn again; enemy asset burned (§4)
    game.lost[enemy] = true;
    hit = true;
  }
  // consume the turn
  const next = cloneState(game.state);
  next.turn = enemy;
  if (owner === BLACK) next.fullmove += 1;
  next.ep = null;
  game.state = next;
  game.log.push(
    hit
      ? `${owner === WHITE ? 'White' : 'Black'} interrogated a pawn — SPY FOUND and neutralized!`
      : `${owner === WHITE ? 'White' : 'Black'} interrogated a pawn — clean. Token wasted.`,
  );
  return { ok: true, hit };
}

// ── status ───────────────────────────────────────────────────────────────

export function status(game) {
  return gameStatus(game.state);
}

export { legalMoves, WHITE, BLACK, other };
