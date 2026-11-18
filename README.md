# SOLMAR BAY — Vice & Sunshine

[![make.fun](https://make.fun/badge/competition/gta6-01.svg)](https://make.fun/c/gta6-01)
[![make.fun](https://make.fun/badge/entry/gta6-01.svg)](https://make.fun/c/gta6-01)
[![make.fun](https://make.fun/badge/owner/arif-pratama.svg)](https://make.fun/@arif-pratama)

An open-world crime game in the spirit of GTA 6, built for the
[make.fun "Make GTA 6" bounty](https://make.fun/c/gta6-01) — a sun-soaked
coastal city you explore on foot and by car, with traffic, pedestrians, a
wanted system and police chases, a six-job story, combat, a HUD with a
minimap, saves, and fully synthesized sound. Everything is original: the
city, the characters, the vehicles, the story, the art and the music.

## Play it

```sh
node serve.mjs        # serves game/ at http://localhost:8080
```

Open `http://localhost:8080` in desktop Chrome. No build step, no network
requests — every file the game loads lives under `game/`, including the
vendored three.js build.

## The game

You are **Lucia Vega**, new in Solmar Bay with $250, a borrowed pistol and a
debt to the wrong people. Her old friend **Rico Marín** has work at the pier
— six jobs stand between her and freedom.

- **The city** — a 9×9 grid of towers, plazas, a park, the Solmar National
  Bank, the Sunset Motel, a beach, a pier and a marina yacht, all procedural
  and lit by a low golden sun.
- **On foot and by car** — sprint, jump and punch on the street; steal any
  car (press E) and drive it with arcade physics, handbrake slides included.
- **Traffic and pedestrians** — cars cruise the road grid and slow for each
  other; pedestrians stroll the sidewalks and flee gunfire.
- **Wanted system** — crimes raise 1–5 stars; SPPD cruisers chase and ram,
  officers on foot run you down to bust you. Lay low and the heat cools.
- **Missions and story** — six jobs with gold beacons, hold-to-complete
  objectives, shootouts with bank guards and a final yacht heist.
- **Combat** — pistol with tracers and muzzle flash, guards who shoot back,
  health and armor pickups, cash drops.
- **HUD and minimap** — cash, stars, health, speed, mission objective, a
  live circular minimap with the mission marker, police blips and traffic.
- **Save** — progress (cash, health, mission, position) is stored locally;
  CONTINUE picks up where you left off.
- **Sound** — engine hum, sirens, gunshots, pickups and a coastal bassline,
  all synthesized live with WebAudio. No audio files.

## Controls

| Key | Action |
| --- | ------ |
| W A S D | Move / drive |
| Mouse drag | Look around |
| Shift | Sprint / handbrake |
| Space | Jump / brake |
| E | Enter / exit car (steal it) |
| Click | Shoot pistol |
| F | Punch |
| Esc | Pause · M mute |

## Files

- `game/index.html` — the page, HUD and menus
- `game/src/main.js` — game loop, state machine, interactions
- `game/src/city.js` — the procedural city, beach, pier and landmarks
- `game/src/config.js` — world constants, vehicle roster, mission chain
- `game/src/player.js` — Lucia on foot and the third-person camera
- `game/src/vehicles.js` — car physics and traffic AI
- `game/src/people.js` — pedestrians and SPPD officers
- `game/src/police.js` — wanted stars and police chases
- `game/src/combat.js` — shooting, guards, pickups
- `game/src/missions.js` — the six-job story
- `game/src/hud.js` — HUD and minimap
- `game/src/audio.js` — synthesized WebAudio sound
- `game/src/save.js` — localStorage saves
- `game/src/shots.js` — screenshot scene staging (`?shot=1..4`)
- `game/src/util.js` — seeded random, maths, canvas textures
- `game/vendor/three.module.min.js` — three.js 0.160.0 (vendored)
- `main.ts` — the make.fun entry program (writes `/output` + dossier.json)

## License

MIT — see [LICENSE](LICENSE).
