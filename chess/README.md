# Spy Chess 🕵️

**Chess, but one of your pawns is a traitor — and so is one of theirs.**

Classic Spy Chess is standard chess plus **one hidden allegiance**. Before the
game, each player secretly turns one of the opponent's pawns into a **sleeper
agent**. Keep it alive and let it mature, and it can **defect** into a Knight,
Rook, or even a Queen. Suspect a traitor in your own ranks? **Interrogate** —
but a wrong guess costs you a turn.

The design goal: reward reading, nerve, and risk over memorized opening theory,
so a player who has never studied a line can compete with one who has.

👉 The full ruleset lives in [`CONSTITUTION.md`](./CONSTITUTION.md).

## Play

It's a self-contained static web app — no build step, no dependencies at runtime.

```bash
# from this folder
python3 -m http.server 8000
# then open http://localhost:8000
```

Modes: **Pass & Play** (two players, one device) and **vs Computer**.

## How it's built

Vanilla ES modules, no framework:

| File | Role |
|------|------|
| `src/engine.js` | Pure standard-chess rules (perft-verified through depth 4). No DOM. |
| `src/spy.js` | Classic Spy Chess layered on the engine — recruit, mature, reveal, interrogate. |
| `src/ai.js` | Alpha-beta computer opponent, spy-aware. |
| `src/pieces.js` | Self-contained SVG piece set. |
| `src/ui.js` | The board view (rendering + clicks). Knows no rules. |
| `src/main.js` | App orchestrator: menu → setup → game. |

## Roadmap

- **Online play** via a shareable room link (server-adjudicated hidden info) — the
  mode built for going viral.
- **Full Espionage** — a spy *budget* to plant multiple sleepers across multiple
  piece types, with a richer detection meta. See `CONSTITUTION.md` §8.
