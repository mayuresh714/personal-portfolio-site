# Classic Spy Chess — Constitution v1

> The foundational ruleset. Everything the software does must obey this document.
> If code and constitution disagree, the constitution is right and the code is a bug.

Classic Spy Chess is standard chess plus **one hidden allegiance**: before the
game starts, each player secretly turns one of the opponent's pawns into a
**sleeper agent** — a piece that looks and moves like an enemy pawn but secretly
belongs to you. Kept alive and matured, the sleeper can **defect** and change the
balance of the game. The opponent, meanwhile, can **interrogate** their own ranks
to burn your asset before it strikes.

The whole design serves one goal: **make chess reward reading, nerve, and
risk over memorized opening theory** — so a player who has never studied a line
can compete with one who has.

---

## 0. Design questions — answered

These are the forks we debated, now decided. They are binding.

**Q1 — How is the hidden information hidden?**
Canonically **online, server-adjudicated**: two players join through a shared
room link, the server holds each player's secret pick, and neither client is
ever told the opponent's spy. This is the mode built for virality.
Two convenience modes ship alongside it:
- **Pass-and-play** (one device): a "look away" handoff screen conceals each
  player's secret pick. Honor system — for casual local play.
- **vs Computer**: the AI plants a spy; its identity is hidden from the human.

**Q2 — On reveal, does the spy convert or just get neutralized?**
It **converts** to your color — but its strength is **maturity-scaled** (§3), so an
early reveal is only a pawn and a big payoff must be *earned* by keeping the
sleeper alive and letting it get deep. This kills the "instant Queen blowout"
while keeping the drama.

**Q3 — Is there counter-intelligence (detect/interrogate) in v1?**
**Yes.** Interrogation (§4) is not optional flavour — it is what turns hidden
information from luck into skill, and gives the attacker a reason to bluff.

---

## 1. Standard chess is the substrate

Everything in standard chess applies unchanged unless a rule below overrides it:
the 8×8 board, the starting position, how each piece moves, captures, **castling,
en passant, and promotion**, check, checkmate, stalemate, and draws.

A game of Classic Spy Chess that never uses a spy ability is a legal, ordinary
game of chess.

---

## 2. The sleeper agent (setup)

1. Before White's first move, **each player secretly designates exactly one of the
   opponent's eight pawns** as their sleeper agent.
   - White chooses one of Black's pawns; Black chooses one of White's pawns.
   - Both picks are committed **simultaneously and secretly**. Neither player
     learns which of *their own* pawns has been compromised.
2. A sleeper is an ordinary enemy pawn in every visible respect. It stays under
   the **enemy's control** and moves as a normal pawn. Its owner cannot move it or
   see it highlighted — until it defects.
3. There is **one spy per side** in Classic mode. If it is lost, it is gone; there
   is no re-planting.

**Symmetry, by design:** both sides plant at the same moment under the same rules,
so there is no first-mover information advantage.

---

## 3. Maturation & defection (the reveal)

The sleeper is dormant early and dangerous late. This is the self-balancing core.

### 3.1 When you may reveal
Revealing is legal only from **full move 8 onward** (both players have completed at
least 8 moves). Before that the sleeper is asleep.

### 3.2 How to reveal
On your turn, **instead of making a normal move**, you may reveal your sleeper if it
is still on the board. It flips to **your color, in place**. Revealing consumes your
whole turn. You may not reveal if doing so leaves **your own king in check** (a reveal
is a move and obeys the check rule like any other).

### 3.3 What it becomes — maturity
The sleeper's defected identity is set by a **maturity score `M`**:

```
M = A + floor(S / 2)

  A = ranks the pawn has advanced toward the enemy's promotion edge
      (0 at its start, driven mostly by the ENEMY pushing "their" pawn)
  S = full moves the sleeper has survived on board past move 8 (capped at 8)
```

| Maturity `M` | Defects as        |
|:------------:|-------------------|
| 0 – 1        | Pawn              |
| 2 – 3        | Knight **or** Bishop (you choose) |
| 4 – 5        | Rook              |
| 6 +          | Queen             |

The delicious irony: **the enemy matures your agent by developing normally.** Every
time they advance "their" pawn, they arm your sleeper. A deep, patient agent is a
Queen; a panicked early reveal is just a pawn.

### 3.4 Losing the sleeper
The sleeper is a normal enemy pawn to its controller, so it can be lost the way any
pawn is, **before you ever reveal it**:
- It is **captured** (including en passant) → asset burned, no defection.
- The enemy **promotes it** (it reaches their back rank under their control) → it
  becomes *their* promoted piece and the spy is lost. Reveal before they push it home.
- It is **interrogated and unmasked** (§4).

---

## 4. Counter-intelligence (interrogation)

The defense against a sleeper is suspicion, and suspicion must cost something —
otherwise it is free and there is no bluff. Each player gets **2 interrogation
tokens** for the game.

- On your turn, **instead of moving**, you may spend a token to interrogate **one of
  your own pawns** you suspect is the enemy's sleeper.
- **Correct** (it is the enemy's sleeper): the agent is unmasked. The pawn is cleared
  of its allegiance and becomes an ordinary loyal pawn of yours; the enemy's sleeper
  is **permanently neutralized**. No material changes hands — you simply keep your own
  pawn and the enemy loses the asset.
- **Wrong** (that pawn was clean): you have **wasted your turn and burned a token**, and
  the opponent is told an interrogation missed (they learn you are hunting). Paranoia
  has a price.

Interrogation consumes your whole turn and obeys the check rule (you may not
interrogate if it would leave your king in check — though interrogation never moves a
piece, so in practice this only matters if you are already in check and must respond).

---

## 5. Winning, losing, drawing

Standard, plus the spy layer folds in naturally:
- **Checkmate** (including a mate delivered by a defecting agent), **resignation**, or
  **timeout** wins.
- **Stalemate**, insufficient material, threefold repetition, and the 50-move rule draw.
- A spy ability is never *required*; a player may ignore theirs entirely.

---

## 6. Edge cases (binding)

- Only **one** sleeper per side, ever, in Classic mode.
- A reveal or an interrogation **counts as that player's turn**; you cannot also move.
- Reveal is unavailable if the sleeper has been captured, promoted by the enemy, or
  already unmasked.
- `A` (advancement) is measured from the pawn's own starting rank toward the edge it
  promotes on **for its current controller**, and is frozen at the moment of reveal.
- If a reveal or interrogation would leave the acting player in check, it is illegal.
- Reveal that produces an immediate checkmate ends the game — that is the intended
  payoff, not a bug.

---

## 7. Why this is fair (and viral)

- **Anti-memorization:** hidden allegiance makes the opening tree too uncertain to
  prep. You must reason at the board, not recite.
- **Engine-resistant:** an engine cannot evaluate information it does not have, so the
  hidden state blunts computer-perfect play.
- **Skill, not luck:** interrogation + bluffing turn the hidden card into a read, the
  way betting turns hidden cards into poker. Variance widens enough for upsets, without
  handing the game to a coin flip.
- **One-sentence pitch:** *"Chess, but one of your pawns is a traitor — and so is one
  of theirs."* That is shareable.

---

## 8. Roadmap beyond Classic (not in v1)

**Full Espionage** — a spy *budget* to plant multiple sleepers across multiple piece
types (a rook can be a sleeper, at higher cost/risk), with a richer detection meta.
Classic Spy Chess must prove fun first; Full Espionage builds on this same core.
