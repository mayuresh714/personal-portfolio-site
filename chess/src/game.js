// game.js — the Spy Chess model. Two modes over the same core:
//   'classic'    one pawn sleeper each, 2 interrogations, maturity-scaled reveal
//   'espionage'  a budget of sleepers on any piece, an intel economy, scans,
//                double agents, and reveal abilities (freeze + bonus tempo)
//
// A sleeper is tagged on the piece as `spyOwner` (the color that secretly owns
// this enemy piece). Tags ride through moves via cloneState and die with the
// piece (capture / promotion), which is the "asset burned" rule.

import {
  initialState, cloneState, applyMove, legalMovesFrom, legalMoves,
  gameStatus, inCheck, other, WHITE, BLACK, inBounds,
} from './engine.js';

export const PIECE_COST = { p: 1, n: 2, b: 2, r: 3, q: 4 }; // king can't be a sleeper
export const CONFIG = {
  classic: { unlock: 8, tokens: 2, startIntel: 0, budget: 1 },
  espionage: { unlock: 6, tokens: 0, startIntel: 2, budget: 4, intelCap: 8, scanCost: 3, doubleCost: 3 },
};
const startRow = (color) => (color === WHITE ? 6 : 1);
const promoRow = (color) => (color === WHITE ? 0 : 7);
const nameOf = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' };
const side = (c) => (c === WHITE ? 'White' : 'Black');

/**
 * assignments:
 *   classic   → { w:{r,c}, b:{r,c} }         (one enemy pawn each)
 *   espionage → { w:[{r,c}...], b:[{r,c}...] } (enemy pieces within budget)
 */
export function createGame(mode, assignments) {
  const cfg = CONFIG[mode];
  const state = initialState();
  plant(state.board, assignments.w, WHITE, mode);
  plant(state.board, assignments.b, BLACK, mode);
  return {
    mode,
    state,
    intel: { w: cfg.startIntel, b: cfg.startIntel },
    tokens: { w: cfg.tokens, b: cfg.tokens },
    revealedCount: { w: 0, b: 0 },
    frozen: null, // { id, color } — that color may not move this piece this turn
    bonusPending: false, // a reveal granted an extra tempo to the side to move
    scannedThisTurn: false,
    log: [],
  };
}

function plant(board, at, owner, mode) {
  const list = mode === 'classic' ? [at] : at;
  let spent = 0;
  for (const sq of list) {
    const p = board[sq.r][sq.c];
    if (!p) throw new Error('spy target empty');
    if (p.color === owner) throw new Error('a spy must be an OPPONENT piece');
    if (p.type === 'k') throw new Error('cannot recruit the king');
    if (mode === 'classic' && p.type !== 'p') throw new Error('classic spies are pawns');
    spent += PIECE_COST[p.type];
    p.spyOwner = owner;
  }
  if (spent > CONFIG[mode].budget) throw new Error('over spy budget');
}

// ── sleepers & maturity ─────────────────────────────────────────────────────
export function sleepersOf(board, owner) {
  const out = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.spyOwner === owner) out.push({ r, c, piece: p });
    }
  return out;
}

function advancement(piece, r) {
  return piece.color === WHITE ? startRow(WHITE) - r : r - startRow(BLACK);
}
function survival(game) {
  return Math.max(0, Math.min(game.state.fullmove - CONFIG[game.mode].unlock, 8));
}

/** Maturity + what a specific sleeper defects into, plus its reveal ability. */
export function maturityOf(game, owner, id) {
  const s = sleepersOf(game.state.board, owner).find((x) => x.piece.id === id) || sleepersOf(game.state.board, owner)[0];
  if (!s) return null;
  const A = advancement(s.piece, s.r);
  const S = survival(game);
  const M = A + Math.floor(S / 2);
  let tier, choices = null;
  if (s.piece.type === 'p') {
    if (M <= 1) tier = 'p';
    else if (M <= 3) { tier = 'n'; choices = ['n', 'b']; }
    else if (M <= 5) tier = 'r';
    else tier = 'q';
  } else {
    tier = s.piece.type; // non-pawn sleeper defects as itself, now yours
  }
  const ability = game.mode === 'espionage'
    ? { freeze: M >= 3, bonus: M >= 5 }
    : { freeze: false, bonus: false };
  return { A, S, M, tier, choices, ability, at: { r: s.r, c: s.c }, id: s.piece.id };
}

// ── normal moves (with freeze) ──────────────────────────────────────────────
export function legalFrom(game, r, c) {
  const p = game.state.board[r][c];
  let moves = legalMovesFrom(game.state, r, c);
  if (p && game.frozen && game.frozen.id === p.id && game.frozen.color === game.state.turn) moves = [];
  return moves;
}
export function allLegal(game) {
  const moves = legalMoves(game.state, game.state.turn);
  if (game.frozen && game.frozen.color === game.state.turn)
    return moves.filter((m) => game.state.board[m.from.r][m.from.c].id !== game.frozen.id);
  return moves;
}

function awardIntel(game, mover) {
  if (game.mode !== 'espionage') return;
  const cap = CONFIG.espionage.intelCap;
  game.intel[mover] = Math.min(cap, game.intel[mover] + 1);
}

function endTurn(game, mover, nextState) {
  // clear a freeze once the frozen side has taken its turn
  if (game.frozen && game.frozen.color === mover) game.frozen = null;
  awardIntel(game, mover);
  game.state = nextState;
  game.scannedThisTurn = false;
  game.bonusPending = false;
  syncLost(game);
}

function syncLost(game) {
  // (no persistent lost flags needed; sleepersOf reflects the truth live)
}

export function makeMove(game, move) {
  const mover = game.state.turn;
  endTurn(game, mover, applyMove(game.state, move));
  return game;
}

// ── reveal / defection + abilities ──────────────────────────────────────────
export function canReveal(game, owner, id) {
  if (game.state.turn !== owner) return { ok: false, reason: 'not your turn' };
  const list = sleepersOf(game.state.board, owner);
  if (!list.length) return { ok: false, reason: 'no sleepers left' };
  if (game.state.fullmove < CONFIG[game.mode].unlock)
    return { ok: false, reason: `locked until move ${CONFIG[game.mode].unlock}` };
  if (id && !list.find((x) => x.piece.id === id)) return { ok: false, reason: 'sleeper gone' };
  return { ok: true };
}

export function reveal(game, owner, id, opts = {}) {
  const gate = canReveal(game, owner, id);
  if (!gate.ok) return gate;
  const mat = maturityOf(game, owner, id);
  let type = mat.tier;
  if (mat.choices) type = mat.choices.includes(opts.pieceChoice) ? opts.pieceChoice : mat.choices[0];

  const next = cloneState(game.state);
  const { r, c } = mat.at;
  if (type === 'p' && r === promoRow(owner)) type = 'q';
  const node = next.board[r][c];
  node.type = type; node.color = owner; delete node.spyOwner; // keep id → animated flip
  if (inCheck({ ...next, turn: owner }, owner))
    return { ok: false, reason: 'reveal would leave your king in check' };

  // ability: freeze an adjacent enemy piece
  let frozeName = null;
  if (mat.ability.freeze) {
    const target = pickFreezeTarget(next.board, r, c, other(owner), opts.freezeTarget);
    if (target) { game.frozen = { id: target.piece.id, color: other(owner) }; frozeName = `${nameOf[target.piece.type]} ${sqName(target.r, target.c)}`; }
  }
  const bonus = mat.ability.bonus;
  next.turn = bonus ? owner : other(owner); // bonus tempo → keep the move
  if (!bonus && owner === BLACK) next.fullmove += 1;
  next.ep = null; next.halfmove = 0;

  game.revealedCount[owner] += 1;
  awardIntel(game, owner);
  if (!bonus && game.frozen && game.frozen.color === owner) game.frozen = null;
  game.state = next;
  game.bonusPending = bonus;
  game.scannedThisTurn = false;
  game.log.push(`${side(owner)} defected a sleeper → ${nameOf[type]}` +
    (frozeName ? `, froze ${frozeName}` : '') + (bonus ? ', +1 tempo!' : '') + ` (M=${mat.M})`);
  return { ok: true, type, at: mat.at, froze: frozeName, bonus };
}

function pickFreezeTarget(board, r, c, enemy, prefer) {
  const around = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nr = r + dr, nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      const p = board[nr][nc];
      if (p && p.color === enemy && p.type !== 'k') around.push({ r: nr, c: nc, piece: p });
    }
  if (prefer) { const m = around.find((a) => a.r === prefer.r && a.c === prefer.c); if (m) return m; }
  // default: freeze the most valuable adjacent enemy piece
  around.sort((a, b) => (PIECE_COST[b.piece.type] || 0) - (PIECE_COST[a.piece.type] || 0));
  return around[0] || null;
}

// ── interrogation + double agent ────────────────────────────────────────────
export function canInterrogate(game, owner) {
  if (game.state.turn !== owner) return { ok: false, reason: 'not your turn' };
  if (inCheck(game.state, owner)) return { ok: false, reason: 'you are in check' };
  if (game.mode === 'classic' && game.tokens[owner] <= 0) return { ok: false, reason: 'no tokens left' };
  if (game.mode === 'espionage' && game.intel[owner] < 1) return { ok: false, reason: 'need 1 intel' };
  return { ok: true };
}

export function interrogate(game, owner, r, c, opts = {}) {
  const gate = canInterrogate(game, owner);
  if (!gate.ok) return gate;
  const p = game.state.board[r][c];
  if (!p || p.color !== owner) return { ok: false, reason: 'interrogate your own piece' };

  if (game.mode === 'classic') game.tokens[owner] -= 1;
  else game.intel[owner] -= 1;

  const enemy = other(owner);
  let hit = false, turned = false;
  const next = cloneState(game.state);
  const np = next.board[r][c];
  if (np.spyOwner === enemy) {
    hit = true;
    if (opts.double && game.mode === 'espionage' && game.intel[owner] >= CONFIG.espionage.doubleCost) {
      game.intel[owner] -= CONFIG.espionage.doubleCost;
      np.spyOwner = owner; turned = true; // double agent — now it's yours
    } else {
      delete np.spyOwner; // neutralized → loyal
    }
  }
  next.turn = enemy;
  if (owner === BLACK) next.fullmove += 1;
  next.ep = null;
  endTurn(game, owner, next);
  game.log.push(hit
    ? `${side(owner)} interrogated ${sqName(r, c)} — SPY FOUND` + (turned ? ', turned to a DOUBLE AGENT!' : ', neutralized!')
    : `${side(owner)} interrogated ${sqName(r, c)} — clean.`);
  return { ok: true, hit, turned };
}

// ── scan (per-turn intel action, does not cost the turn) ─────────────────────
export function canScan(game, owner) {
  if (game.mode !== 'espionage') return { ok: false, reason: 'espionage only' };
  if (game.state.turn !== owner) return { ok: false, reason: 'not your turn' };
  if (game.scannedThisTurn) return { ok: false, reason: 'already scanned this turn' };
  if (game.intel[owner] < CONFIG.espionage.scanCost) return { ok: false, reason: `need ${CONFIG.espionage.scanCost} intel` };
  return { ok: true };
}

/**
 * Scan narrows suspicion: returns a set of the owner's own pieces guaranteed to
 * contain an enemy sleeper (if any remain). It mixes the real sleeper(s) with
 * a few decoys so it points a finger without naming it outright.
 */
export function scan(game, owner) {
  const gate = canScan(game, owner);
  if (!gate.ok) return gate;
  game.intel[owner] -= CONFIG.espionage.scanCost;
  game.scannedThisTurn = true;
  const enemy = other(owner);
  const spies = sleepersOf(game.state.board, enemy).map((s) => ({ r: s.r, c: s.c })); // enemy's sleepers sit on OWNER's pieces
  if (!spies.length) { game.log.push(`${side(owner)} scanned — no active sleepers detected.`); return { ok: true, suspects: [] }; }
  // decoys: a couple of the owner's other pieces
  const mine = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = game.state.board[r][c]; if (p && p.color === owner && p.type !== 'k' && !spies.find((s) => s.r === r && s.c === c)) mine.push({ r, c }); }
  shuffle(mine);
  const suspects = [...spies, ...mine.slice(0, Math.min(3, mine.length))];
  shuffle(suspects);
  game.log.push(`${side(owner)} scanned — a sleeper hides among ${suspects.length} suspects.`);
  return { ok: true, suspects };
}

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; }

// ── status ──────────────────────────────────────────────────────────────────
export function status(game) {
  // freeze never causes a false checkmate: judge status on the full move set
  return gameStatus(game.state);
}

export function sqName(r, c) { return `${'abcdefgh'[c]}${8 - r}`; }
export { WHITE, BLACK, other, nameOf };
