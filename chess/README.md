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

Two modes: **Classic** (one pawn sleeper each) and **Full Espionage** (a budget of
sleepers on any piece, an intel economy, scans, double agents, and reveal
abilities — freeze + bonus tempo). Vanilla ES modules, no framework:

| File | Role |
|------|------|
| `src/engine.js` | Pure standard-chess rules (perft-verified through depth 4). No DOM. |
| `src/game.js` | The Spy Chess model — recruit, mature, reveal, interrogate, scan, double agents, freeze. Both modes. |
| `src/ai.js` | Alpha-beta computer opponent, spy-aware. |
| `src/board.js` | Flicker-free animated board view (persistent nodes, transform sliding, drag + click). |
| `src/pieces.js` | Self-contained SVG piece set. |
| `src/audio.js` | Synthesized WebAudio sound cues (no asset files). |
| `src/main.js` | App orchestrator: menu → setup → game. |

## Roadmap

- **Online play** via a shareable room link (server-adjudicated hidden info) — the
  mode built for going viral. Needs a host that runs a server (GitHub Pages is
  static); the code + deploy steps ship as a separate package.
