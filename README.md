# SOLMAR BAY — Vice Coast Stories

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Arifpratama19/gta6/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Arifpratama19/gta6/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game in the spirit of GTA 6, built for
[make.fun's **gta6-01** bounty](https://make.fun/bounty/gta6-01) — "Make GTA 6".
Playable offline in a desktop browser from static files. No libraries, no build
step, no network requests. Everything — city, characters, vehicles, story, art,
sound and music — is original.

## The game

Rico Vega is back in Solmar Bay, a sun-soaked coastal city. Steal cars, dodge
the law, run five missions and take the town — on foot and behind the wheel.

- **A procedural coastal city** — road grid, buildings, beach and ocean, all
  generated fresh and drawn in warm Vice Coast colours.
- **On foot and by car** — walk, run, steal any parked or traffic car, drive
  with arcade physics and a handbrake.
- **Traffic and pedestrians** — cars cruise the roads, pedestrians stroll the
  sidewalks and flee from gunfire and crashes.
- **A 5-star wanted system** — crimes raise the heat; police cars chase and ram
  you, and getting busted costs you. Break line of sight and stay clean to cool off.
- **Missions and a story** — five missions for Rico Vega: a meet at the marina,
  a car theft, a beach shootout, a hot pursuit, and the big bank score.
- **Combat** — mouse-aimed pistol, rival gang gunmen, health and damage.
- **HUD with a minimap** — health, money, wanted stars, objective and a live
  minimap showing the city, the cops and your target.
- **Start and save** — start screen, pause menu, and localStorage saves that
  remember your money and mission progress.
- **Sound** — fully synthesized WebAudio: engine hum, sirens, gunshots, jingles.
  No audio files. Press M to mute.

## How to play

| Key | Action |
| --- | ------ |
| W A S D / Arrows | Move on foot · drive when in a car |
| Mouse | Aim the pistol |
| Click | Shoot |
| E | Steal / enter a car · exit a car |
| Shift | Run |
| Space | Handbrake |
| P / Esc | Pause |
| M | Mute |

Follow the ◆ yellow marker. Crimes raise your wanted stars — break line of
sight and stay clean to cool off. Getting busted or wasted costs $200.

## Run it

```sh
node serve.mjs
# open http://localhost:8080
```

Or open `game/index.html` directly from the files — the game runs from static
files with no build step.

## Layout

```
game/            the playable game (static files)
  index.html     entry point
  src/           the game's source, one job per file
    config.js    world constants, palette, tuning
    util.js      math + seeded RNG helpers
    audio.js     synthesized WebAudio sound
    input.js     keyboard + mouse state
    city.js      procedural city, collision, road graph
    player.js    Rico Vega on foot and behind the wheel
    vehicles.js  car physics, traffic AI, theft, damage
    people.js    pedestrians
    police.js    wanted system and police pursuit
    combat.js    pistol fire, bullets, enemy gunmen
    missions.js  the 5-mission story chain
    hud.js       HUD, minimap, menus
    save.js      localStorage save / load
    main.js      game loop, state, rendering, camera
main.ts          entry program: hands game/ + screenshots/ in, writes dossier.json
serve.mjs        static file server for local play
screenshots/     4 screenshots of the game, taken by its maker
```

## License

MIT — see [LICENSE](LICENSE).
