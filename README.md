# SOLMAR BAY — Sunset Run

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/Arifpratama19/gta6/rank.svg)](https://make.fun/c/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/Arifpratama19/gta6/reward.svg)](https://make.fun/c/gta6-01)

An original open-world crime game in the spirit of GTA 6, built for the
[make.fun "Make GTA 6" bounty](https://make.fun/c/gta6-01). Everything in it —
the city, the characters, the story, the art and the music — is original.

## The game

Sun-soaked **Solmar Bay**: palms, neon, and one last score. You are **Dana Reyes**,
the best wheelwoman on the coast. Your fixer **Vic Marlowe** has five jobs for
you, from a midnight courier run to the heist of the decade at the Palmera Casino.

- **A city on foot and by car** — a 9×9-block coastal city with traffic, pedestrians,
  a beach and the sea, explored on foot or behind the wheel of any car you steal.
- **Steal and drive** — walk up to any car, press E, and go. Arcade driving with
  handbrake drifts.
- **Wanted system and police** — crimes raise your stars; Solmar PD cruisers chase,
  ram and try to arrest you. Lay low and the heat cools off.
- **Missions and a story** — five jobs with objectives, timers, beacons and payouts,
  from the first stolen car to the Big Score.
- **Combat** — a pistol with tracers and muzzle flash; pedestrians panic, rivals fight back.
- **HUD with minimap** — wanted stars, cash, health, speed, a live clock, district names,
  and a round minimap with traffic, police and objective markers.
- **Save** — progress autosaves and can be continued from the title screen.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move / drive |
| Mouse | Look / aim (click the game to lock the mouse; arrow keys work too) |
| Click | Shoot pistol |
| E | Enter / exit car |
| Space | Handbrake |
| Shift | Sprint |
| M | Mission list |
| P / Esc | Pause |

## Run it

```sh
node serve.mjs
# open http://localhost:8080
```

No build step, no network requests: `game/index.html` plus its files under `game/`
(three.js is vendored at `game/vendor/three.module.min.js`). Open it from any
static server in desktop Chrome.

## Entry

`main.ts` (Node 22) copies `game/` and `screenshots/` to the output directory
and writes `dossier.json` with `buildDossier` from `vendor/makefun-game.ts`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```
