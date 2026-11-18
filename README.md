# SOLMAR BAY — Vice Coast Stories

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Arifpratama19/gta6/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Arifpratama19/gta6/reward.svg)](https://make.fun/c/gta6-01)

An open-world crime game in the spirit of GTA 6, built for the
[make.fun gta6-01 bounty](https://make.fun/c/gta6-01) — a complete,
original, playable browser game with no build step and no network requests.

## The game

Rico Vega is back in Solmar Bay — a sun-soaked coastal city of procedural
streets, traffic, beaches and a marina. Five jobs stand between him and the
biggest score of his life:

1. **Welcome to Solmar** — meet Dex at the Marina, deliver the package to the Motel Coral.
2. **Grand Theft Comet** — steal a gold Comet GT and bring it to the Chop Shop.
3. **Pier Pressure** — clear four gunmen off the Pier, pistol in hand.
4. **Getaway Driver** — burn through three checkpoints with the whole force after you.
5. **The Vault** — hit the Casino Aurora vault and escape to the speedboat.

Plus the open city itself: steal any car and drive it, a five-star wanted
system with police interceptors that chase and ram, pedestrians, traffic,
pistol combat, a HUD with a live minimap, synthesized WebAudio (engine hum,
sirens, gunshots — no audio files), and localStorage saves.

## Play

```sh
node serve.mjs
# open http://localhost:8080/game/
```

| Key | Action |
| --- | --- |
| WASD / arrows | Walk / drive |
| E | Enter a car, steal it, grab the vault |
| Click / F | Shoot the pistol |
| Shift | Sprint on foot |
| Esc | Pause |
| M | Mute |

## Layout

```
game/
  index.html        entry point, HUD and menus
  src/
    config.js       every tunable number
    util.js         math helpers, segment-circle hit tests
    audio.js        synthesized WebAudio sounds
    input.js        keyboard and mouse state
    city.js         procedural city, roads, beach, landmarks
    player.js       Rico on foot, entering and leaving cars
    vehicles.js     car physics, traffic AI, theft
    people.js       pedestrians and gunmen
    police.js       wanted stars, pursuit, busts
    combat.js       pistol bullets and hit detection
    missions.js     the five-mission story chain
    hud.js          HUD, minimap, toasts, screens
    save.js         localStorage saves
    main.js         game loop, camera, rendering
main.ts             hands the game in as a make.fun dossier
screenshots/        four real renders of the game
```

## License

MIT — see [LICENSE](LICENSE).
