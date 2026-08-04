// main.js — app orchestrator. Wires the three screens (menu → setup → game),
// owns the game object, and translates clicks into Spy-Chess actions.

import {
  createGame, makeMove, legalFrom, canReveal, reveal, maturity,
  canInterrogate, interrogate, findSpy, status, WHITE, BLACK, other,
} from './spy.js';
import { initialState } from './engine.js';
import { aiTurn } from './ai.js';
import { BoardView, squareName } from './ui.js';
import { PIECE_NAME, pieceSVG } from './pieces.js';

const $ = (sel) => document.querySelector(sel);
const colorName = (c) => (c === WHITE ? 'White' : 'Black');
const FULL_SET = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };

const App = {
  mode: null, // 'local' | 'ai'
  humanColor: WHITE, // in ai mode
  game: null,
  board: null,
  selected: null,
  targets: [],
  lastMove: null,
  interrogateMode: false,
  flip: false,
  setup: null, // { step, assignments }
  busy: false, // AI thinking / animating — block input

  init() {
    this.board = new BoardView($('#board'), { onSquareClick: (r, c) => this.onSquare(r, c) });
    this.setupBoard = new BoardView($('#setup-board-slot'), { onSquareClick: (r, c) => this.onSetupPick(r, c) });
    $('#mode-local').addEventListener('click', () => this.startSetup('local'));
    $('#mode-ai').addEventListener('click', () => this.startSetup('ai'));
    $('#btn-reveal').addEventListener('click', () => this.onReveal());
    $('#btn-interrogate').addEventListener('click', () => this.toggleInterrogate());
    $('#btn-flip').addEventListener('click', () => { this.flip = !this.flip; this.paint(); });
    $$all('[data-new-game]').forEach((b) => b.addEventListener('click', () => this.toMenu()));
    this.showScreen('menu');
  },

  showScreen(name) {
    for (const s of ['menu', 'setup', 'game']) $(`#screen-${s}`).hidden = s !== name;
  },
  toMenu() {
    this.game = null; this.selected = null; this.interrogateMode = false;
    $('#dialog-over').close?.();
    this.showScreen('menu');
  },

  // ── setup ────────────────────────────────────────────────────────────────
  startSetup(mode) {
    this.mode = mode;
    this.setup = { step: 0, assignments: {}, state: initialState() };
    this.showScreen('setup');
    if (mode === 'ai') {
      // AI (Black) secretly plants on a random White pawn
      this.setup.assignments.b = randomPawn(this.setup.state.board, WHITE);
      this.setup.prompt = 0; // human = White picks among Black pawns
    }
    this.paintSetup();
  },

  paintSetup() {
    const picker = this.mode === 'ai' ? WHITE : (this.setup.step === 0 ? WHITE : BLACK);
    const enemy = other(picker);
    const pickable = allPawns(this.setup.state.board, enemy);
    $('#setup-title').textContent = `${colorName(picker)}, recruit your sleeper`;
    $('#setup-sub').textContent = `Secretly click one of ${colorName(enemy)}'s pawns. It becomes your agent — hidden inside their army until you defect it.`;
    this.setupBoard.render({ board: this.setup.state.board, pickable, flip: picker === BLACK });
    this._setupPicker = picker;
  },

  onSetupPick(r, c) {
    const picker = this._setupPicker;
    const enemy = other(picker);
    const p = this.setup.state.board[r][c];
    if (!p || p.type !== 'p' || p.color !== enemy) return;
    this.setup.assignments[picker === WHITE ? 'w' : 'b'] = { r, c };

    if (this.mode === 'ai') return this.beginGame();
    if (this.setup.step === 0) {
      // hand device to Black
      this.setup.step = 1;
      this.handoff('Black', () => this.paintSetup());
    } else {
      this.beginGame();
    }
  },

  beginGame() {
    this.game = createGame(this.setup.assignments);
    this.selected = null; this.targets = []; this.lastMove = null;
    this.interrogateMode = false; this.flip = false;
    this.showScreen('game');
    if (this.mode === 'ai') {
      $('#opponent-label').textContent = 'You vs Computer';
    } else {
      $('#opponent-label').textContent = 'Pass & Play';
    }
    this.paint();
  },

  // ── click routing ──────────────────────────────────────────────────────────
  onSquare(r, c) {
    if (this.busy || !this.game) return;
    if (this.gameOver()) return;
    const turn = this.game.state.turn;
    if (this.mode === 'ai' && turn !== this.humanColor) return;

    if (this.interrogateMode) return this.doInterrogate(r, c);

    const p = this.game.state.board[r][c];
    // clicking a legal target of the current selection → move
    const target = this.targets.find((t) => t.r === r && t.c === c);
    if (this.selected && target) return this.commitMove(this.selected, target);

    // otherwise (re)select own piece
    if (p && p.color === turn) {
      this.selected = { r, c };
      this.targets = dedupeTargets(legalFrom(this.game, r, c));
      this.paint();
    } else {
      this.selected = null; this.targets = [];
      this.paint();
    }
  },

  commitMove(from, to) {
    const moves = legalFrom(this.game, from.r, from.c).filter((m) => m.to.r === to.r && m.to.c === to.c);
    if (moves.length === 0) return;
    const promo = moves.filter((m) => m.promotion);
    if (promo.length) return this.askPromotion(promo);
    this.applyAndAdvance(moves[0]);
  },

  applyAndAdvance(move) {
    makeMove(this.game, move);
    this.lastMove = move;
    this.selected = null; this.targets = [];
    this.afterAction();
  },

  // ── reveal ──────────────────────────────────────────────────────────────
  onReveal() {
    if (this.busy || this.gameOver()) return;
    const me = this.actingColor();
    const gate = canReveal(this.game, me);
    if (!gate.ok) return this.toast(gate.reason);
    const mat = maturity(this.game, me);
    if (mat.choices) {
      this.askRevealChoice(me, mat);
    } else {
      this.doReveal(me, mat.tier);
    }
  },
  doReveal(me, type) {
    const res = reveal(this.game, me, type);
    if (!res.ok) return this.toast(res.reason);
    this.selected = null; this.targets = [];
    this.lastMove = { from: res.at, to: res.at };
    this.toast(`Sleeper defected as ${PIECE_NAME[res.type]}!`, 'good');
    this.afterAction();
  },

  // ── interrogation ─────────────────────────────────────────────────────────
  toggleInterrogate() {
    if (this.busy || this.gameOver()) return;
    const me = this.actingColor();
    const gate = canInterrogate(this.game, me);
    if (!gate.ok) return this.toast(gate.reason);
    this.interrogateMode = !this.interrogateMode;
    this.selected = null; this.targets = [];
    this.paint();
  },
  doInterrogate(r, c) {
    const me = this.actingColor();
    const p = this.game.state.board[r][c];
    if (!p || p.color !== me || p.type !== 'p') return this.toast('Pick one of your own pawns');
    const res = interrogate(this.game, me, r, c);
    this.interrogateMode = false;
    if (!res.ok) return this.toast(res.reason);
    this.toast(res.hit ? `🎯 Spy found at ${squareName(r, c)} — neutralized!` : `${squareName(r, c)} is clean. Token wasted.`, res.hit ? 'good' : 'bad');
    this.lastMove = { from: { r, c }, to: { r, c } };
    this.afterAction();
  },

  actingColor() {
    return this.mode === 'ai' ? this.humanColor : this.game.state.turn;
  },

  // ── turn advance / AI ──────────────────────────────────────────────────────
  afterAction() {
    this.paint();
    if (this.gameOver()) return this.showGameOver();
    if (this.mode === 'ai' && this.game.state.turn !== this.humanColor) {
      this.busy = true;
      this.paint();
      setTimeout(() => {
        const act = aiTurn(this.game, this.game.state.turn, 3);
        if (act === 'ai-reveal') this.toast('Computer defected a sleeper!', 'bad');
        if (act === 'ai-interrogate') this.toast('Computer interrogated a pawn.', 'bad');
        this.busy = false;
        this.paint();
        if (this.gameOver()) this.showGameOver();
      }, 420);
    } else if (this.mode === 'local') {
      // optional auto-flip to the player to move
      this.flip = this.game.state.turn === BLACK;
      this.paint();
    }
  },

  gameOver() {
    const st = status(this.game);
    return st === 'checkmate' || st === 'stalemate' || st === 'draw-50';
  },

  showGameOver() {
    const st = status(this.game);
    const loser = this.game.state.turn;
    let msg;
    if (st === 'checkmate') msg = `Checkmate — ${colorName(other(loser))} wins!`;
    else if (st === 'stalemate') msg = 'Stalemate — draw.';
    else msg = 'Draw (50-move rule).';
    $('#over-title').textContent = msg;
    $('#dialog-over').showModal();
  },

  // ── rendering ────────────────────────────────────────────────────────────
  paint() {
    if (!this.game) return;
    const st = this.game.state;
    const turn = st.turn;
    const badgeOwner = this.mode === 'ai' ? this.humanColor : turn;
    const spy = (!this.game.revealed[badgeOwner] && !this.game.lost[badgeOwner]) ? findSpy(st.board, badgeOwner) : null;
    const checkSq = statusIsCheck(this.game) ? findKingSquare(st.board, turn) : null;

    this.board.render({
      board: st.board,
      selected: this.selected,
      targets: this.targets,
      lastMove: this.lastMove,
      checkSquare: checkSq,
      flip: this.flip,
      spyBadge: spy ? { r: spy.r, c: spy.c } : null,
      interrogate: this.interrogateMode,
      interrogable: this.interrogateMode ? allPawns(st.board, this.actingColor()) : [],
    });

    // status line
    const who = this.mode === 'ai'
      ? (turn === this.humanColor ? 'Your move' : (this.busy ? 'Computer is thinking…' : "Computer's move"))
      : `${colorName(turn)} to move`;
    const stx = status(this.game);
    $('#turn-indicator').innerHTML = `<span class="dot ${turn}"></span>${who}${stx === 'check' ? ' — <b class="warn">Check!</b>' : ''}`;
    $('#movecount').textContent = `Move ${st.fullmove}`;

    // reveal button state
    const me = this.actingColor();
    const rv = canReveal(this.game, me);
    const btnR = $('#btn-reveal');
    if (this.game.revealed[me]) { btnR.disabled = true; btnR.querySelector('.sub').textContent = 'already defected'; }
    else if (this.game.lost[me]) { btnR.disabled = true; btnR.querySelector('.sub').textContent = 'agent lost'; }
    else if (!rv.ok) { btnR.disabled = true; btnR.querySelector('.sub').textContent = rv.reason; }
    else {
      const mat = maturity(this.game, me);
      btnR.disabled = false;
      btnR.querySelector('.sub').textContent = `defects as ${PIECE_NAME[mat.tier]}${mat.choices ? '/±' : ''} (M=${mat.M})`;
    }

    // interrogate button
    const btnI = $('#btn-interrogate');
    btnI.querySelector('.sub').textContent = `${this.game.tokens[me]} token${this.game.tokens[me] === 1 ? '' : 's'} left`;
    btnI.disabled = this.game.tokens[me] <= 0;
    btnI.classList.toggle('armed', this.interrogateMode);

    this.renderCaptured();
    this.renderLog();
  },

  renderCaptured() {
    const counts = { w: {}, b: {} };
    for (const row of this.game.state.board)
      for (const p of row) if (p) counts[p.color][p.type] = (counts[p.color][p.type] || 0) + 1;
    const missing = (color) => {
      const out = [];
      for (const [t, n] of Object.entries(FULL_SET))
        for (let i = 0; i < n - (counts[color][t] || 0); i++) out.push(t);
      return out;
    };
    $('#captured-white').innerHTML = missing('w').map((t) => pieceSVG(t, 'w')).join('');
    $('#captured-black').innerHTML = missing('b').map((t) => pieceSVG(t, 'b')).join('');
  },

  renderLog() {
    $('#event-log').innerHTML = this.game.log.slice(-6).reverse().map((l) => `<li>${l}</li>`).join('');
  },

  // ── dialogs ────────────────────────────────────────────────────────────────
  askPromotion(promoMoves) {
    const dlg = $('#dialog-promo');
    const wrap = $('#promo-choices');
    const color = this.game.state.turn;
    wrap.innerHTML = '';
    for (const t of ['q', 'r', 'b', 'n']) {
      const b = document.createElement('button');
      b.innerHTML = pieceSVG(t, color);
      b.title = PIECE_NAME[t];
      b.addEventListener('click', () => { dlg.close(); this.applyAndAdvance(promoMoves.find((m) => m.promotion === t)); });
      wrap.appendChild(b);
    }
    dlg.showModal();
  },

  askRevealChoice(me, mat) {
    const dlg = $('#dialog-reveal');
    const wrap = $('#reveal-choices');
    $('#reveal-info').textContent = `Maturity M=${mat.M}. Choose your sleeper's true identity:`;
    wrap.innerHTML = '';
    for (const t of mat.choices) {
      const b = document.createElement('button');
      b.innerHTML = pieceSVG(t, me) + `<span>${PIECE_NAME[t]}</span>`;
      b.addEventListener('click', () => { dlg.close(); this.doReveal(me, t); });
      wrap.appendChild(b);
    }
    dlg.showModal();
  },

  handoff(toName, then) {
    const dlg = $('#dialog-handoff');
    $('#handoff-name').textContent = toName;
    const btn = $('#handoff-ok');
    const h = () => { dlg.close(); btn.removeEventListener('click', h); then(); };
    btn.addEventListener('click', h);
    dlg.showModal();
  },

  toast(msg, kind = '') {
    const t = $('#toast');
    t.textContent = msg;
    t.className = `toast show ${kind}`;
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => (t.className = 'toast'), 2200);
  },
};

// helpers ---------------------------------------------------------------------
function $$all(sel) { return Array.from(document.querySelectorAll(sel)); }
function allPawns(board, color) {
  const out = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = board[r][c]; if (p && p.type === 'p' && p.color === color) out.push({ r, c }); }
  return out;
}
function randomPawn(board, color) { const ps = allPawns(board, color); return ps[Math.floor(Math.random() * ps.length)]; }
function dedupeTargets(moves) {
  const seen = new Set(); const out = [];
  for (const m of moves) { const k = `${m.to.r},${m.to.c}`; if (seen.has(k)) continue; seen.add(k); out.push({ r: m.to.r, c: m.to.c, capture: !!m.capture }); }
  return out;
}
function statusIsCheck(game) { return status(game) === 'check' || status(game) === 'checkmate'; }
function findKingSquare(board, color) {
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = board[r][c]; if (p && p.type === 'k' && p.color === color) return { r, c }; }
  return null;
}

document.addEventListener('DOMContentLoaded', () => App.init());
