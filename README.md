# SOLMAR BAY — Vice Coast Stories

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Arifpratama19/gta6/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Arifpratama19/gta6/reward.svg)](https://make.fun/c/gta6-01)

An original open-world crime game for the make.fun **gta6-01** bounty ("Make GTA 6").
Play it in a desktop browser — no install, no network, everything vendored locally.

## The game

**SOLMAR BAY** is a sun-soaked coastal city on the fictional Vice Coast. You are
**Rico Vega**, a getaway driver back home with a problem: his brother owes the
**Coral Kings** crew $50,000, and fixer **Mara Solis** has five jobs that pay it off —
if Rico survives them.

- **Explore on foot and by car** — a procedural city with downtown towers, neon
  streets, a marina, a pier with a ferris wheel, beach and ocean.
- **Steal and drive cars** — walk up to any traffic car, press E, and take it.
  Arcade handling with chase camera, handbrake and traffic to dodge.
- **Traffic and pedestrians** — cars cruise the road grid and turn at
  intersections; walkers stroll the sidewalks and flee from gunfire.
- **Wanted system and police** — crime raises your star level; Solmar Bay PD
  cars chase and ram you, foot cops run you down, and getting caught means BUSTED.
  Lay low and the heat cools off.
- **Missions and story** — five jobs with markers, a beacon, objectives and
  payouts, from a first car theft to a pier shootout and a final getaway run.
- **Combat** — a pistol with tracers, muzzle flash and rival shooters who
  strafe and fire back.
- **HUD and minimap** — cash, health, armor, wanted stars, mission objective,
  district and clock, speed, and a live minimap with mission, cop and enemy blips.
- **Start, pause and game-over screens, plus saves** — progress (cash and jobs)
  is stored in localStorage and a Continue button picks it up.
- **Synthesized sound** — engine hum, sirens, gunshots and a Vice Coast FM
  bass loop, all generated live with WebAudio. No audio files.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move / drive |
| Mouse | Look around (click to lock the pointer) |
| Shift | Sprint |
| E | Enter / exit car |
| Left click | Shoot |
| Space | Handbrake / jump |
| R | Toggle radio |
| M | Mute |
| Esc / P | Pause |

## Play it

```sh
node serve.mjs
# open http://localhost:8080/
```

Or serve `game/` with any static file server and open `game/index.html`.

## How it is built

- `game/index.html` — the shell, HUD and menus.
- `game/src/` — the game's own source, one file per system: `config.js`
  (tuning and story), `city.js` (procedural city), `vehicles.js` (cars and
  traffic), `people.js` (pedestrians), `player.js` (on-foot controls and
  camera), `combat.js` (shooting and rivals), `police.js` (wanted system),
  `missions.js` (the five jobs), `hud.js` (HUD and minimap), `audio.js`
  (synthesized WebAudio), `input.js`, `save.js`, `shots.js` (dossier poses)
  and `main.js` (bootstrap and game loop).
- `game/vendor/three.module.min.js` — vendored three.js (MIT).
- `main.ts` — the make.fun entrypoint: copies `game/` and `screenshots/` to
  the output directory and writes `dossier.json` with the kit's `buildDossier`.

## License

MIT — see [LICENSE](LICENSE). All city, character, vehicle, story, art and
sound work in this game is original; nothing is taken from any commercial game.
