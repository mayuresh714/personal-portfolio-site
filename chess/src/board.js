// board.js — flicker-free, animated board view (chess.com feel).
//
// Two persistent layers that never get torn down between moves:
//   .squares  fixed 8x8 grid — highlights/hints/coords toggle via classes
//   .pieces   overlay of piece nodes positioned by CSS transform, keyed by
//             piece id, reconciled each render so a moved piece SLIDES.
// Supports drag-and-drop and click-to-move. Knows no rules — it reports
// intent through callbacks and lets the app decide legality.

import { pieceSVG } from './pieces.js';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

export class Board {
  constructor(el, { onSquareTap, onDragMove }) {
    this.el = el;
    this.onSquareTap = onSquareTap || (() => {});
    this.onDragMove = onDragMove || (() => {});
    this.flip = false;
    this.cellByRC = new Map(); // "r,c" -> square element
    this.nodes = new Map(); // piece id -> DOM node
    this.lastBoard = null;
    this.markers = {}; // last vm marker sets, so we can repaint highlights cheaply
    this._build();
  }

  _build() {
    this.el.classList.add('board');
    this.el.innerHTML = '';
    this.squaresEl = div('squares');
    this.piecesEl = div('pieces');
    this.el.append(this.squaresEl, this.piecesEl);
    this.cells = [];
    for (let i = 0; i < 64; i++) {
      const sq = div('sq');
      sq.appendChild(div('hint'));
      this.squaresEl.appendChild(sq);
      this.cells.push(sq);
    }
    this._layout();
    this._wirePointer();
  }

  // assign board coordinates to the 64 fixed display cells for the current flip
  _layout() {
    this.cellByRC.clear();
    for (let dr = 0; dr < 8; dr++) {
      for (let dc = 0; dc < 8; dc++) {
        const r = this.flip ? 7 - dr : dr;
        const c = this.flip ? 7 - dc : dc;
        const sq = this.cells[dr * 8 + dc];
        sq.dataset.r = r; sq.dataset.c = c;
        sq.className = `sq ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
        // coordinate labels along the visible edges
        sq.querySelectorAll('.coord').forEach((n) => n.remove());
        if (dc === 0) sq.appendChild(coord(8 - r, 'rank'));
        if (dr === 7) sq.appendChild(coord(FILES[c], 'file'));
        this.cellByRC.set(`${r},${c}`, sq);
      }
    }
  }

  setFlip(flip) {
    if (flip === this.flip) return;
    this.flip = flip;
    this._layout();
    if (this.lastBoard) this.render({ board: this.lastBoard, ...this.markers });
  }

  // display position (0..7) for a board coord under the current flip
  _disp(r, c) { return { dr: this.flip ? 7 - r : r, dc: this.flip ? 7 - c : c }; }
  _xy(r, c) { const { dr, dc } = this._disp(r, c); return { x: dc * 100, y: dr * 100 }; }

  /**
   * vm = { board, selected, targets:[{r,c,capture}], lastMove:{from,to},
   *        checkSquare, spy:[{r,c}], suspect:[{r,c}], pick:[{r,c}],
   *        pickInterrogate:[{r,c}] }
   */
  render(vm) {
    this.lastBoard = vm.board;
    this.markers = vm;
    this.badgeIds = new Set(vm.badgeIds || []);
    this._paintSquares(vm);
    this._reconcilePieces(vm.board);
  }

  _paintSquares(vm) {
    const sel = key(vm.selected);
    const last = vm.lastMove ? new Set([key(vm.lastMove.from), key(vm.lastMove.to)]) : new Set();
    const check = key(vm.checkSquare);
    const targets = new Map((vm.targets || []).map((t) => [`${t.r},${t.c}`, t]));
    const spy = new Set((vm.spy || []).map(key));
    const suspect = new Set((vm.suspect || []).map(key));
    const pick = new Set((vm.pick || []).map(key));
    const pickI = new Set((vm.pickInterrogate || []).map(key));

    for (const [k, sq] of this.cellByRC) {
      sq.classList.toggle('selected', k === sel);
      sq.classList.toggle('last', last.has(k));
      sq.classList.toggle('check', k === check);
      sq.classList.toggle('pickable', pick.has(k));
      sq.classList.toggle('interrogable', pickI.has(k));
      sq.classList.toggle('spy-here', spy.has(k));
      sq.classList.toggle('suspect', suspect.has(k));
      const t = targets.get(k);
      const hint = sq.firstChild;
      hint.className = t ? (t.capture ? 'hint capture' : 'hint move') : 'hint';
    }
  }

  _reconcilePieces(board) {
    const present = new Set();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p) continue;
        present.add(p.id);
        let node = this.nodes.get(p.id);
        const glyph = `${p.type}${p.color}`;
        if (!node) {
          node = div('pc enter');
          node.dataset.id = p.id;
          node.innerHTML = pieceSVG(p.type, p.color);
          node.dataset.glyph = glyph;
          this.piecesEl.appendChild(node);
          this.nodes.set(p.id, node);
          requestAnimationFrame(() => node.classList.remove('enter'));
        } else if (node.dataset.glyph !== glyph) {
          // type/color changed in place (promotion, spy defection) — flip swap
          node.dataset.glyph = glyph;
          node.classList.add('flip');
          node.innerHTML = pieceSVG(p.type, p.color);
          setTimeout(() => node.classList.remove('flip'), 320);
        }
        node.dataset.r = r; node.dataset.c = c;
        if (!node.classList.contains('dragging')) {
          const { x, y } = this._xy(r, c);
          node.style.transform = `translate(${x}%, ${y}%)`;
        }
        // sleeper badge — shown only for the current actor's own agents
        node.classList.toggle('has-badge', this.badgeIds.has(p.id));
        node.classList.toggle('frozen', !!(this.markers.frozenId && this.markers.frozenId === p.id));
      }
    }
    // remove captured pieces with a fade
    for (const [id, node] of this.nodes) {
      if (!present.has(id)) {
        node.classList.add('captured');
        const n = node;
        setTimeout(() => n.remove(), 260);
        this.nodes.delete(id);
      }
    }
  }

  // ── pointer / drag ────────────────────────────────────────────────────────
  _wirePointer() {
    let drag = null; // { node, id, fromR, fromC, startX, startY, moved }
    const rectSize = () => { const r = this.el.getBoundingClientRect(); return { r, s: r.width / 8 }; };
    const squareAt = (clientX, clientY) => {
      const { r, s } = rectSize();
      let dc = Math.floor((clientX - r.left) / s);
      let dr = Math.floor((clientY - r.top) / s);
      dc = Math.max(0, Math.min(7, dc)); dr = Math.max(0, Math.min(7, dr));
      return { r: this.flip ? 7 - dr : dr, c: this.flip ? 7 - dc : dc };
    };

    this.el.addEventListener('pointerdown', (e) => {
      const pcEl = e.target.closest('.pc');
      const sqEl = e.target.closest('.sq');
      const at = pcEl ? { r: +pcEl.dataset.r, c: +pcEl.dataset.c } : (sqEl ? { r: +sqEl.dataset.r, c: +sqEl.dataset.c } : null);
      if (!at) return;
      if (pcEl) {
        drag = { node: pcEl, fromR: at.r, fromC: at.c, startX: e.clientX, startY: e.clientY, moved: false };
        this.el.setPointerCapture?.(e.pointerId);
      }
      this._downAt = at;
    });

    this.el.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < 6) return;
      drag.moved = true;
      drag.node.classList.add('dragging');
      const { r, s } = rectSize();
      const x = e.clientX - r.left - s / 2, y = e.clientY - r.top - s / 2;
      drag.node.style.transform = `translate(${(x / r.width) * 800}%, ${(y / r.height) * 800}%)`;
    });

    const endDrag = (e) => {
      if (!drag) return;
      const d = drag; drag = null;
      d.node.classList.remove('dragging');
      if (d.moved) {
        this._suppressClick = true; // the browser fires a click after pointerup
        const to = squareAt(e.clientX, e.clientY);
        if (to.r !== d.fromR || to.c !== d.fromC) this.onDragMove({ r: d.fromR, c: d.fromC }, to);
        // snap back to truth regardless (app re-renders if the move was legal)
        const { x, y } = this._xy(d.fromR, d.fromC);
        d.node.style.transform = `translate(${x}%, ${y}%)`;
        if (this.lastBoard) this._reconcilePieces(this.lastBoard);
      } else {
        this.onSquareTap(d.fromR, d.fromC); // treated as a tap-select
      }
      this._downAt = null;
    };
    this.el.addEventListener('pointerup', endDrag);
    this.el.addEventListener('pointercancel', () => { if (drag) { drag.node.classList.remove('dragging'); drag = null; } });

    // plain taps on empty squares (no piece grabbed)
    this.el.addEventListener('click', (e) => {
      if (this._suppressClick) { this._suppressClick = false; return; }
      const sqEl = e.target.closest('.sq');
      const pcEl = e.target.closest('.pc');
      if (pcEl) return; // handled by pointerup tap
      if (sqEl) this.onSquareTap(+sqEl.dataset.r, +sqEl.dataset.c);
    });
  }
}

// helpers
function div(cls) { const d = document.createElement('div'); d.className = cls; return d; }
function coord(text, cls) { const s = document.createElement('span'); s.className = `coord ${cls}`; s.textContent = text; return s; }
function key(rc) { return rc ? `${rc.r},${rc.c}` : ''; }

export function squareName(r, c) { return `${FILES[c]}${8 - r}`; }
