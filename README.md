# SOLMAR BAY — Vice Coast Stories

[![make.fun](https://make.fun/api/badges/gta6-01.svg)](https://make.fun/competitions/gta6-01)
[![make.fun](https://make.fun/api/badges/gta6-01/entries.svg)](https://make.fun/competitions/gta6-01)
[![make.fun](https://make.fun/api/badges/gta6-01/prize.svg)](https://make.fun/competitions/gta6-01)

An open-world crime game in the spirit of GTA 6, built for the
[make.fun gta6-01 bounty](https://make.fun/competitions/gta6-01) ($1,666 escrowed).
Playable offline in a desktop browser from static files — no build step, no
network requests, no dependencies.

## The game

Rico Vega is back on the coast. **SOLMAR BAY — Vice Coast Stories** is a
sun-soaked procedural city (2400×1800) with a road grid, beach, ocean, marina
and pier, explored on foot and by car:

- **Drive & steal** — 19 traffic cars, enter/exit with E, steal any car (the
  cops notice) and drive with WASD.
- **5-star wanted system** — police Interceptors spawn, chase and ram you;
  get busted on foot and you wake up at the hospital $100 lighter.
- **5-mission story** — First Wheels ($200), The Comet GT ($350), Pier
  Shootout ($500), Hot Pursuit ($700), The Vault ($1,000). $3,250 in all.
- **Combat** — pistol with mouse aim, segment-based bullet hit tests, four
  gunmen holding the pier.
- **HUD + minimap** — money, health, wanted stars, mission objective, live
  minimap with the mission marker, cops and gunmen.
- **Save** — P saves to localStorage, C continues; a finished story loads
  straight into free roam.
- **Sound** — fully synthesized WebAudio: engine hum, sirens, gunshots,
  mission jingles. No audio files.

## Play

```sh
node serve.mjs
# open http://localhost:8080
```

Controls: **WASD** move / drive · **E** enter & exit cars · **Mouse** aim,
**Click** shoot · **P** save · **Esc** pause · **R** restart.

## Structure

- `game/index.html` — canvas + module loader
- `game/src/main.js` — game loop, rendering, menus
- `game/src/config.js` — tuning + mission data
- `game/src/city.js` — procedural city, road sampling
- `game/src/state.js` — game state
- `game/src/vehicles.js` — cars, driving, theft
- `game/src/player.js` — on-foot movement + pistol
- `game/src/people.js` — pedestrians
- `game/src/police.js` — wanted system + pursuit
- `game/src/combat.js` — bullets, gunmen
- `game/src/missions.js` — 5-mission chain
- `game/src/hud.js` — HUD + minimap
- `game/src/save.js` — localStorage saves
- `game/src/audio.js` — synthesized WebAudio
- `game/src/input.js` — keyboard + mouse, queued actions
- `game/src/util.js` — seeded RNG + math
- `main.ts` — the make.fun entry program (Node 22, copies game/ +
  screenshots/ to /output and writes dossier.json)

## License

MIT — see [LICENSE](LICENSE). Original work: its city, characters, vehicles,
names, story, art and sound are all its own.
