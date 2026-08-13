// main.js — app orchestrator for Spy Chess (Classic + Full Espionage).

import {
  createGame, makeMove, legalFrom, canReveal, reveal, maturityOf, sleepersOf,
  canInterrogate, interrogate, canScan, scan, status, CONFIG, PIECE_COST,
  WHITE, BLACK, other, nameOf,
} from './game.js';
import { initialState, inCheck } from './engine.js';
import { aiTurn } from './ai.js';
import { Board, squareName } from './board.js';
import { pieceSVG } from './pieces.js';
import { Sound } from './audio.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const sideName = (c) => (c === WHITE ? 'White' : 'Black');
const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const FULL_SET = { p: 8, n: 2, b: 2, r: 2, q: 1 };

const App = {
  variant: 'classic',
  opponent: 'pvp',
  humanColor: WHITE,
  game: null,
  selected: null,
  targets: [],
  lastMove: null,
  actionMode: null, // null | 'interrogate' | 'reveal'
  suspects: [],
  busy: false,
  flip: false,
  inSetup: false,
  setup: null,
  sans: [],

  init() {
    this.board = new Board($('#board'), {
      onSquareTap: (r, c) => this.onTap(r, c),
      onDragMove: (from, to) => this.onDrag(from, to),
    });
    this.setupBoard = new Board($('#setup-board-slot'), {
      onSquareTap: (r, c) => this.onSetupPick(r, c),
      onDragMove: () => {},
    });

    $$('#variant-row .pick-card').forEach((b) => b.addEventListener('click', () => this.pick('variant', b)));
    $$('#opp-row .pick-card').forEach((b) => b.addEventListener('click', () => this.pick('opponent', b)));
    $('#btn-start').addEventListener('click', () => this.startSetup());
    $('#setup-confirm').addEventListener('click', () => this.finishEspionageSetup());
    $('#btn-reveal').addEventListener('click', () => this.onRevealClick());
    $('#btn-interrogate').addEventListener('click', () => this.toggleInterrogate());
    $('#btn-scan').addEventListener('click', () => this.onScan());
    $('#btn-flip').addEventListener('click', () => { this.flip = !this.flip; this.board.setFlip(this.flip); });
    $('#btn-sound').addEventListener('click', () => { const on = !Sound.isEnabled(); Sound.setEnabled(on); $('#btn-sound').textContent = on ? '🔊' : '🔇'; });
    $$('[data-new-game]').forEach((b) => b.addEventListener('click', () => this.toMenu()));
    this.show('menu');
  },

  pick(kind, btn) {
    const row = kind === 'variant' ? '#variant-row' : '#opp-row';
    $$(`${row} .pick-card`).forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');
    this[kind] = kind === 'variant' ? btn.dataset.variant : btn.dataset.opp;
  },

  show(name) { for (const s of ['menu', 'setup', 'game']) $(`#screen-${s}`).hidden = s !== name; },
  toMenu() { $('#dialog-over').open && $('#dialog-over').close(); this.game = null; this.actionMode = null; this.show('menu'); },

  // ── setup ──────────────────────────────────────────────────────────────
  startSetup() {
    this.inSetup = true;
    this.setup = { step: 0, state: initialState(), assign: { w: [], b: [] } };
    if (this.opponent === 'ai') this.setup.assign.b = aiPlant(this.setup.state.board, BLACK, this.variant);
    this.show('setup');
    $('#btn-scan').hidden = this.variant !== 'espionage';
    this.paintSetup();
  },

  paintSetup() {
    const picker = this.opponent === 'ai' ? WHITE : (this.setup.step === 0 ? WHITE : BLACK);
    this._picker = picker;
    const enemy = other(picker);
    const esp = this.variant === 'espionage';
    const budget = CONFIG[this.variant].budget;
    const chosen = this.setup.assign[picker === WHITE ? 'w' : 'b'];
    const spent = chosen.reduce((s, x) => s + PIECE_COST[this.setup.state.board[x.r][x.c].type], 0);

    $('#setup-title').textContent = `${sideName(picker)}, recruit your ${esp ? 'agents' : 'sleeper'}`;
    $('#setup-sub').textContent = esp
      ? `Click ${sideName(enemy)}'s pieces to plant sleepers. Costs: pawn 1, minor 2, rook 3, queen 4. Spend up to ${budget}.`
      : `Secretly click one of ${sideName(enemy)}'s pawns. It becomes your agent, hidden until you defect it.`;
    const bud = $('#setup-budget');
    bud.hidden = !esp;
    if (esp) bud.innerHTML = `Budget <b>${budget - spent}</b>/${budget} · ${chosen.length} agent${chosen.length === 1 ? '' : 's'} planted`;
    $('#setup-confirm').hidden = !esp || chosen.length === 0;

    const pick = chosen.map((x) => ({ r: x.r, c: x.c }));
    this.setupBoard.setFlip(picker === BLACK);
    this.setupBoard.render({ board: this.setup.state.board, pick, flip: picker === BLACK });
  },

  onSetupPick(r, c) {
    if (!this.inSetup) return;
    const picker = this._picker;
    const enemy = other(picker);
    const p = this.setup.state.board[r][c];
    if (!p || p.color !== enemy || p.type === 'k') return;
    const key = picker === WHITE ? 'w' : 'b';
    const list = this.setup.assign[key];

    if (this.variant === 'classic') {
      if (p.type !== 'p') return this.toast('Classic sleepers must be pawns');
      this.setup.assign[key] = [{ r, c }];
      Sound.select();
      return this.advanceSetup();
    }
    // espionage: toggle within budget
    const idx = list.findIndex((x) => x.r === r && x.c === c);
    if (idx >= 0) { list.splice(idx, 1); Sound.select(); return this.paintSetup(); }
    const budget = CONFIG.espionage.budget;
    const spent = list.reduce((s, x) => s + PIECE_COST[this.setup.state.board[x.r][x.c].type], 0);
    if (spent + PIECE_COST[p.type] > budget) return this.toast('Not enough budget for that piece');
    list.push({ r, c });
    Sound.select();
    this.paintSetup();
  },

  finishEspionageSetup() { this.advanceSetup(); },

  advanceSetup() {
    // classic auto-advances after one pick; espionage advances on Confirm
    if (this.opponent === 'ai') return this.beginGame();
    if (this.setup.step === 0) { this.setup.step = 1; this.handoff('Black', () => this.paintSetup()); }
    else this.beginGame();
  },

  beginGame() {
    this.inSetup = false;
    const assign = this.variant === 'classic'
      ? { w: this.setup.assign.w[0], b: this.setup.assign.b[0] }
      : this.setup.assign;
    this.game = createGame(this.variant, assign);
    this.selected = null; this.targets = []; this.lastMove = null;
    this.actionMode = null; this.suspects = []; this.sans = []; this.flip = false;
    $('#opponent-label').textContent = `${this.variant === 'espionage' ? 'Full Espionage' : 'Classic'} · ${this.opponent === 'ai' ? 'vs Computer' : 'Pass & Play'}`;
    $('#move-list').innerHTML = '';
    this.board.setFlip(false);
    this.show('game');
    this.paint();
  },

  // ── input ──────────────────────────────────────────────────────────────
  actor() { return this.opponent === 'ai' ? this.humanColor : this.game.state.turn; },
  myTurn() { return this.game && this.game.state.turn === this.actor(); },

  onTap(r, c) {
    if (this.inSetup || !this.game || this.busy || this.isOver()) return;
    if (this.opponent === 'ai' && this.game.state.turn !== this.humanColor) return;

    if (this.actionMode === 'interrogate') return this.doInterrogate(r, c);
    if (this.actionMode === 'reveal') return this.pickRevealSleeper(r, c);

    const turn = this.game.state.turn;
    const p = this.game.state.board[r][c];
    const target = this.targets.find((t) => t.r === r && t.c === c);
    if (this.selected && target) return this.commit(this.selected, { r, c });
    if (p && p.color === turn) {
      this.selected = { r, c };
      this.targets = uniqTargets(legalFrom(this.game, r, c));
      Sound.select();
      this.paint();
    } else { this.selected = null; this.targets = []; this.paint(); }
  },

  onDrag(from, to) {
    if (this.inSetup || !this.game || this.busy || this.isOver()) return;
    if (this.actionMode) return; // action modes use taps
    if (this.opponent === 'ai' && this.game.state.turn !== this.humanColor) return;
    const p = this.game.state.board[from.r][from.c];
    if (!p || p.color !== this.game.state.turn) return;
    const legal = legalFrom(this.game, from.r, from.c).filter((m) => m.to.r === to.r && m.to.c === to.c);
    if (!legal.length) { this.selected = null; this.targets = []; return this.paint(); }
    this.commit(from, to);
  },

  commit(from, to) {
    const moves = legalFrom(this.game, from.r, from.c).filter((m) => m.to.r === to.r && m.to.c === to.c);
    if (!moves.length) return;
    const promo = moves.filter((m) => m.promotion);
    if (promo.length) return this.askPromotion(from, promo);
    this.applyMove(moves[0]);
  },

  applyMove(move) {
    const pre = this.game.state.board;
    const captured = !!move.capture;
    makeMove(this.game, move);
    this.recordSan(pre, move, this.game.state.turn);
    this.lastMove = move;
    this.selected = null; this.targets = []; this.suspects = [];
    captured ? Sound.capture() : Sound.move();
    this.afterAction();
  },

  // ── reveal ──────────────────────────────────────────────────────────────
  onRevealClick() {
    if (this.busy || this.isOver()) return;
    const me = this.actor();
    const gate = canReveal(this.game, me);
    if (!gate.ok) return this.toast(gate.reason);
    const spies = sleepersOf(this.game.state.board, me);
    if (spies.length === 1) return this.beginReveal(spies[0].piece.id);
    this.actionMode = 'reveal';
    this.toast('Pick which agent to defect');
    this.paint();
  },
  pickRevealSleeper(r, c) {
    const me = this.actor();
    const s = sleepersOf(this.game.state.board, me).find((x) => x.r === r && x.c === c);
    this.actionMode = null;
    if (!s) { this.paint(); return; }
    this.beginReveal(s.piece.id);
  },
  beginReveal(id) {
    const me = this.actor();
    const mat = maturityOf(this.game, me, id);
    if (mat.choices) this.askReveal(id, mat);
    else this.doReveal(id, mat.tier);
  },
  doReveal(id, type) {
    const me = this.actor();
    const res = reveal(this.game, me, id, { pieceChoice: type });
    if (!res.ok) return this.toast(res.reason);
    this.selected = null; this.targets = []; this.actionMode = null;
    this.lastMove = { from: res.at, to: res.at };
    this.sans.push({ color: me, text: '🕶️' });
    Sound.reveal();
    this.toast(`Defected → ${nameOf[res.type]}${res.froze ? ` · froze ${res.froze}` : ''}${res.bonus ? ' · bonus move!' : ''}`, 'good');
    if (res.bonus) setTimeout(() => this.toast('Bonus tempo — move again!', 'good'), 900);
    this.afterAction();
  },

  // ── interrogate ──────────────────────────────────────────────────────────
  toggleInterrogate() {
    if (this.busy || this.isOver()) return;
    const gate = canInterrogate(this.game, this.actor());
    if (!gate.ok) return this.toast(gate.reason);
    this.actionMode = this.actionMode === 'interrogate' ? null : 'interrogate';
    this.selected = null; this.targets = [];
    this.paint();
  },
  doInterrogate(r, c) {
    const me = this.actor();
    const p = this.game.state.board[r][c];
    if (!p || p.color !== me || p.type === 'k') return this.toast('Pick your own (non-king) piece');
    const isSpy = p.spyOwner === other(me);
    const canDouble = this.game.mode === 'espionage' && isSpy && this.game.intel[me] >= 1 + CONFIG.espionage.doubleCost;
    if (canDouble) {
      $('#double-info').textContent = `${squareName(r, c)} is a hidden enemy agent. Turn it into YOUR double agent for ${CONFIG.espionage.doubleCost} intel, or just neutralize it?`;
      const dlg = $('#dialog-double');
      const yes = () => { cleanup(); this.commitInterrogate(r, c, true); };
      const no = () => { cleanup(); this.commitInterrogate(r, c, false); };
      const cleanup = () => { dlg.close(); $('#double-yes').removeEventListener('click', yes); $('#double-no').removeEventListener('click', no); };
      $('#double-yes').addEventListener('click', yes); $('#double-no').addEventListener('click', no);
      dlg.showModal();
      return;
    }
    this.commitInterrogate(r, c, false);
  },
  commitInterrogate(r, c, double) {
    const me = this.actor();
    const res = interrogate(this.game, me, r, c, { double });
    this.actionMode = null;
    if (!res.ok) return this.toast(res.reason);
    this.lastMove = { from: { r, c }, to: { r, c } };
    this.sans.push({ color: me, text: '🔦' });
    if (res.hit) Sound.hit(); else Sound.move();
    this.toast(res.hit ? (res.turned ? `🎯 Turned to a double agent at ${squareName(r, c)}!` : `🎯 Spy neutralized at ${squareName(r, c)}!`) : `${squareName(r, c)} is clean.`, res.hit ? 'good' : 'bad');
    this.afterAction();
  },

  // ── scan (free intel action) ───────────────────────────────────────────
  onScan() {
    if (this.busy || this.isOver()) return;
    const me = this.actor();
    const gate = canScan(this.game, me);
    if (!gate.ok) return this.toast(gate.reason);
    const res = scan(this.game, me);
    if (!res.ok) return this.toast(res.reason);
    this.suspects = res.suspects || [];
    Sound.intel();
    this.toast(this.suspects.length ? `Intel: a sleeper hides among ${this.suspects.length} suspects` : 'Intel: no active sleepers', this.suspects.length ? '' : 'good');
    this.paint();
    clearTimeout(this._scanT);
    this._scanT = setTimeout(() => { this.suspects = []; this.paint(); }, 5000);
  },

  // ── turn flow / AI ───────────────────────────────────────────────────────
  afterAction() {
    this.paint();
    if (this.isOver()) return this.gameOver();
    if (this.opponent === 'ai' && this.game.state.turn === other(this.humanColor)) {
      this.busy = true; this.paint();
      setTimeout(() => this.runAI(), 430);
    } else if (this.opponent === 'pvp') {
      this.flip = this.game.state.turn === BLACK;
      this.board.setFlip(this.flip);
      this.paint();
    }
  },
  runAI() {
    const ai = other(this.humanColor);
    const preBoard = this.game.state.board;
    const act = aiTurn(this.game, ai, 3);
    if (act === 'ai-reveal') { Sound.reveal(); this.toast('Computer defected a sleeper!', 'bad'); this.sans.push({ color: ai, text: '🕶️' }); }
    else if (act === 'ai-interrogate') { Sound.hit(); this.toast('Computer interrogated a piece.', 'bad'); this.sans.push({ color: ai, text: '🔦' }); }
    else { const mv = lastMoveGuess(preBoard, this.game.state.board); if (mv) { this.lastMove = mv.move; this.recordSan(preBoard, mv.move, this.game.state.turn); mv.capture ? Sound.capture() : Sound.move(); } }
    if (act === 'ai-reveal' || act === 'ai-interrogate') this.lastMove = this.lastMove; // reveal/interrogate lastMove set inside model via log; keep board fresh
    this.busy = false;
    this.paint();
    if (this.isOver()) return this.gameOver();
    // bonus-tempo chain: if it's still the AI's turn, go again
    if (this.game.state.turn === ai) { this.busy = true; this.paint(); setTimeout(() => this.runAI(), 430); }
  },

  isOver() { const s = status(this.game); return s === 'checkmate' || s === 'stalemate' || s === 'draw-50'; },
  gameOver() {
    const s = status(this.game);
    const loser = this.game.state.turn;
    let msg;
    if (s === 'checkmate') { msg = `Checkmate — ${sideName(other(loser))} wins!`; (this.opponent === 'ai' && other(loser) === this.humanColor) ? Sound.win() : Sound.win(); }
    else if (s === 'stalemate') { msg = 'Stalemate — draw.'; Sound.lose(); }
    else { msg = 'Draw (50-move rule).'; Sound.lose(); }
    $('#over-title').textContent = msg;
    $('#dialog-over').showModal();
  },

  // ── rendering ─────────────────────────────────────────────────────────────
  paint() {
    if (!this.game) return;
    const g = this.game, st = g.state, turn = st.turn;
    const me = this.actor();
    const myBadges = sleepersOf(st.board, me).map((s) => s.piece.id);
    const checkSq = (status(g) === 'check' || status(g) === 'checkmate') ? kingSq(st.board, turn) : null;
    const revealPick = this.actionMode === 'reveal' ? sleepersOf(st.board, me).map((s) => ({ r: s.r, c: s.c })) : [];
    const interPick = this.actionMode === 'interrogate' ? myPieces(st.board, me) : [];

    this.board.render({
      board: st.board,
      selected: this.selected,
      targets: this.targets,
      lastMove: this.lastMove,
      checkSquare: checkSq,
      badgeIds: myBadges,
      frozenId: g.frozen ? g.frozen.id : null,
      pick: revealPick,
      pickInterrogate: interPick,
      suspect: this.suspects,
      flip: this.flip,
    });

    // status line
    const who = this.opponent === 'ai'
      ? (turn === this.humanColor ? 'Your move' : (this.busy ? 'Computer thinking…' : "Computer's move"))
      : `${sideName(turn)} to move`;
    const stx = status(g);
    $('#turn-indicator').innerHTML = `<span class="dot ${turn}"></span>${who}${stx === 'check' ? ' · <b class="warn">Check</b>' : ''}`;
    $('#movecount').textContent = `Move ${st.fullmove}`;

    this.renderIntelHud(me);
    this.renderActions(me);
    this.renderMaterial();
    this.renderCaptured();
    this.renderMoveList();
    this.renderLog();
    this.renderFreeze();
  },

  renderIntelHud(me) {
    const hud = $('#intel-hud');
    if (this.game.mode === 'espionage') {
      const dots = '●'.repeat(this.game.intel[me]) + '○'.repeat(Math.max(0, CONFIG.espionage.intelCap - this.game.intel[me]));
      hud.innerHTML = `<span class="hud-label">Intel</span><span class="intel-dots">${dots}</span><b>${this.game.intel[me]}</b>`;
      hud.hidden = false;
    } else hud.hidden = true;
  },

  renderActions(me) {
    const g = this.game;
    // reveal
    const rB = $('#btn-reveal'), rSub = rB.querySelector('.sub');
    const rv = canReveal(g, me);
    const spies = sleepersOf(g.state.board, me);
    if (!spies.length) { rB.disabled = true; rSub.textContent = 'no sleepers'; }
    else if (!rv.ok) { rB.disabled = true; rSub.textContent = rv.reason; }
    else {
      rB.disabled = false;
      const mat = maturityOf(g, me, spies[0].piece.id);
      rSub.textContent = spies.length > 1 ? `${spies.length} agents · choose one` : `→ ${nameOf[mat.tier]}${mat.ability && mat.ability.freeze ? ' +freeze' : ''} (M=${mat.M})`;
    }
    rB.classList.toggle('armed', this.actionMode === 'reveal');
    // interrogate
    const iB = $('#btn-interrogate'), iSub = iB.querySelector('.sub');
    const iq = canInterrogate(g, me);
    iSub.textContent = g.mode === 'classic' ? `${g.tokens[me]} token${g.tokens[me] === 1 ? '' : 's'}` : `costs 1 intel`;
    iB.disabled = !iq.ok && this.actionMode !== 'interrogate';
    iB.classList.toggle('armed', this.actionMode === 'interrogate');
    // scan
    const sB = $('#btn-scan');
    sB.hidden = g.mode !== 'espionage';
    if (g.mode === 'espionage') {
      const sc = canScan(g, me);
      sB.disabled = !sc.ok;
      sB.querySelector('.sub').textContent = sc.ok ? `costs ${CONFIG.espionage.scanCost} intel` : sc.reason;
    }
  },

  renderMaterial() {
    let w = 0, b = 0;
    for (const row of this.game.state.board) for (const p of row) if (p) (p.color === WHITE ? (w += VAL[p.type]) : (b += VAL[p.type]));
    const diff = w - b;
    $('#material').textContent = diff === 0 ? 'Material even' : (diff > 0 ? `White +${diff}` : `Black +${-diff}`);
  },

  renderCaptured() {
    const counts = { w: {}, b: {} };
    for (const row of this.game.state.board) for (const p of row) if (p && p.type !== 'k') counts[p.color][p.type] = (counts[p.color][p.type] || 0) + 1;
    const missing = (col) => { const o = []; for (const [t, n] of Object.entries(FULL_SET)) for (let i = 0; i < n - (counts[col][t] || 0); i++) o.push(t); return o; };
    $('#captured-white').innerHTML = missing('w').map((t) => pieceSVG(t, 'w')).join('');
    $('#captured-black').innerHTML = missing('b').map((t) => pieceSVG(t, 'b')).join('');
  },

  renderMoveList() {
    const rows = [];
    for (let i = 0; i < this.sans.length; i += 2) {
      const n = i / 2 + 1;
      const wm = this.sans[i] ? this.sans[i].text : '';
      const bm = this.sans[i + 1] ? this.sans[i + 1].text : '';
      rows.push(`<li><span class="mn">${n}.</span><span class="mv">${wm}</span><span class="mv">${bm}</span></li>`);
    }
    const ol = $('#move-list');
    ol.innerHTML = rows.join('');
    ol.scrollTop = ol.scrollHeight;
  },

  renderLog() { $('#event-log').innerHTML = this.game.log.slice(-5).reverse().map((l) => `<li>${l}</li>`).join(''); },
  renderFreeze() {
    const el = $('#freeze-indicator');
    if (this.game.frozen) { el.hidden = false; el.textContent = `❄️ A ${sideName(this.game.frozen.color)} piece is frozen this turn`; }
    else el.hidden = true;
  },

  recordSan(preBoard, move, turnAfter) {
    const isCheck = status(this.game);
    const suffix = isCheck === 'checkmate' ? '#' : (isCheck === 'check' ? '+' : '');
    this.sans.push({ color: preBoard[move.from.r][move.from.c].color, text: notate(preBoard, move) + suffix });
  },

  // ── dialogs ────────────────────────────────────────────────────────────────
  askPromotion(from, promoMoves) {
    const dlg = $('#dialog-promo'), wrap = $('#promo-choices'), color = this.game.state.turn;
    wrap.innerHTML = '';
    for (const t of ['q', 'r', 'b', 'n']) {
      const b = document.createElement('button');
      b.innerHTML = pieceSVG(t, color);
      b.addEventListener('click', () => { dlg.close(); this.applyMove(promoMoves.find((m) => m.promotion === t)); });
      wrap.appendChild(b);
    }
    dlg.showModal();
  },
  askReveal(id, mat) {
    const dlg = $('#dialog-reveal'), wrap = $('#reveal-choices'), me = this.actor();
    $('#reveal-info').textContent = `Maturity M=${mat.M}. Choose your sleeper's true identity:`;
    wrap.innerHTML = '';
    for (const t of mat.choices) {
      const b = document.createElement('button');
      b.innerHTML = pieceSVG(t, me) + `<span>${nameOf[t]}</span>`;
      b.addEventListener('click', () => { dlg.close(); this.doReveal(id, t); });
      wrap.appendChild(b);
    }
    dlg.showModal();
  },
  handoff(name, then) {
    const dlg = $('#dialog-handoff');
    $('#handoff-name').textContent = name;
    const ok = $('#handoff-ok');
    const h = () => { dlg.close(); ok.removeEventListener('click', h); then(); };
    ok.addEventListener('click', h);
    dlg.showModal();
  },
  toast(msg, kind = '') { const t = $('#toast'); t.textContent = msg; t.className = `toast show ${kind}`; clearTimeout(this._t); this._t = setTimeout(() => (t.className = 'toast'), 2400); },
};

// ── helpers ───────────────────────────────────────────────────────────────
function uniqTargets(moves) { const seen = new Set(), out = []; for (const m of moves) { const k = `${m.to.r},${m.to.c}`; if (seen.has(k)) continue; seen.add(k); out.push({ r: m.to.r, c: m.to.c, capture: !!m.capture }); } return out; }
function kingSq(board, color) { for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = board[r][c]; if (p && p.type === 'k' && p.color === color) return { r, c }; } return null; }
function myPieces(board, color) { const o = []; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = board[r][c]; if (p && p.color === color && p.type !== 'k') o.push({ r, c }); } return o; }
function aiPlant(board, aiColor, mode) {
  const enemy = other(aiColor);
  const cands = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = board[r][c]; if (p && p.color === enemy && p.type !== 'k' && (mode === 'espionage' || p.type === 'p')) cands.push({ r, c }); }
  shuffle(cands);
  if (mode === 'classic') { const pawn = cands.find((x) => board[x.r][x.c].type === 'p'); return pawn ? [pawn] : []; }
  const out = []; let spent = 0; const budget = CONFIG.espionage.budget;
  for (const x of cands) { const cost = PIECE_COST[board[x.r][x.c].type]; if (spent + cost <= budget) { out.push(x); spent += cost; } if (spent >= budget) break; }
  return out.length ? out : [cands[0]];
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// minimal SAN-ish notation for the move list
function notate(board, m) {
  if (m.castle === 'K') return 'O-O';
  if (m.castle === 'Q') return 'O-O-O';
  const p = board[m.from.r][m.from.c];
  const dest = squareName(m.to.r, m.to.c);
  if (p.type === 'p') {
    const cap = m.capture ? `${'abcdefgh'[m.from.c]}x` : '';
    return `${cap}${dest}${m.promotion ? '=' + m.promotion.toUpperCase() : ''}`;
  }
  return `${p.type.toUpperCase()}${m.capture ? 'x' : ''}${dest}`;
}
// infer AI's normal move by diffing boards (for sound + notation)
function lastMoveGuess(pre, post) {
  let from = null, to = null, capture = false;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const a = pre[r][c], b = post[r][c];
    const ai = a ? a.id : null, bi = b ? b.id : null;
    if (ai && !bi && !post_hasId(post, ai)) { /* piece left and vanished (captured elsewhere) */ }
    if (ai && ai !== bi && !b) from = { r, c };
    if (bi && bi !== ai) { to = { r, c }; if (a) capture = true; }
  }
  if (from && to) return { move: { from, to, capture, piece: (pre[from.r][from.c] || {}).type }, capture };
  return null;
}
function post_hasId(post, id) { for (const row of post) for (const p of row) if (p && p.id === id) return true; return false; }

document.addEventListener('DOMContentLoaded', () => App.init());
