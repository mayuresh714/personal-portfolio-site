// ui.js — the board view. Pure presentation: it draws the 8x8 grid + pieces and
// reports clicks back through a callback. It knows nothing about rules.

import { pieceSVG } from './pieces.js';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

export class BoardView {
  constructor(el, { onSquareClick }) {
    this.el = el;
    this.onSquareClick = onSquareClick;
    this.squares = new Map(); // "r,c" -> square element
    this._build();
  }

  _build() {
    this.el.classList.add('board');
    this.el.innerHTML = '';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = document.createElement('div');
        sq.className = `sq ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
        sq.dataset.r = r;
        sq.dataset.c = c;
        sq.addEventListener('click', () => this.onSquareClick(r, c));
        this.squares.set(`${r},${c}`, sq);
        this.el.appendChild(sq);
      }
    }
  }

  /**
   * Redraw everything from a view-model.
   * vm = { board, selected, targets:[{r,c,capture}], lastMove, checkSquare,
   *        flip, spyBadge:{r,c}|null, interrogate:bool, interrogable:[{r,c}] }
   */
  render(vm) {
    const { board } = vm;
    // orientation: place squares via CSS order so White (or Black if flip) is at bottom
    this.el.classList.toggle('flip', !!vm.flip);

    const targetSet = new Set((vm.targets || []).map((t) => `${t.r},${t.c}`));
    const captureSet = new Set((vm.targets || []).filter((t) => t.capture).map((t) => `${t.r},${t.c}`));
    const interSet = new Set((vm.interrogable || []).map((t) => `${t.r},${t.c}`));
    const pickSet = new Set((vm.pickable || []).map((t) => `${t.r},${t.c}`));

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = this.squares.get(`${r},${c}`);
        const p = board[r][c];
        const k = `${r},${c}`;
        sq.className = `sq ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
        if (vm.selected && vm.selected.r === r && vm.selected.c === c) sq.classList.add('selected');
        if (vm.lastMove && ((vm.lastMove.from.r === r && vm.lastMove.from.c === c) || (vm.lastMove.to.r === r && vm.lastMove.to.c === c))) sq.classList.add('last');
        if (vm.checkSquare && vm.checkSquare.r === r && vm.checkSquare.c === c) sq.classList.add('check');
        if (vm.interrogate && interSet.has(k)) sq.classList.add('interrogable');
        if (pickSet.has(k)) sq.classList.add('pickable');

        // piece
        sq.innerHTML = '';
        if (p) {
          const holder = document.createElement('div');
          holder.className = 'piece';
          holder.innerHTML = pieceSVG(p.type, p.color);
          if (vm.spyBadge && vm.spyBadge.r === r && vm.spyBadge.c === c) {
            const badge = document.createElement('span');
            badge.className = 'spy-badge';
            badge.textContent = '🕵️';
            badge.title = 'Your sleeper agent';
            holder.appendChild(badge);
          }
          sq.appendChild(holder);
        }

        // move hints on top
        if (targetSet.has(k)) {
          const hint = document.createElement('span');
          hint.className = captureSet.has(k) ? 'hint capture' : 'hint';
          sq.appendChild(hint);
        }

        // coordinate labels on edge squares
        if (c === 0) addLabel(sq, 8 - r, 'rank');
        if (r === 7) addLabel(sq, FILES[c], 'file');
      }
    }
  }
}

function addLabel(sq, text, cls) {
  const l = document.createElement('span');
  l.className = `coord ${cls}`;
  l.textContent = text;
  sq.appendChild(l);
}

export function squareName(r, c) {
  return `${FILES[c]}${8 - r}`;
}
