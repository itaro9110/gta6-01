# SOLMARA — An Open-World Crime Story

A complete open-world crime game for make.fun's **gta6-01** ("Make GTA 6"),
built from static files and played in desktop Chrome with keyboard and mouse.

Leo Marin is back in Solmara, a sun-soaked fictional coastal city — broke,
wanted, and one job away from freedom. Mara Voss has four story missions
for him, from stealing a car to the $1,500 Meridian Vault job.

## Play

```sh
node serve.ts
# open http://localhost:8080 in desktop Chrome
```

**Controls:** WASD walk/drive · mouse aim · Click/Space shoot · E steal car
(E again to get out) · Shift run · P pause · M mute.

## The game

- **Open city** (3600×2600): road grid, live traffic, pedestrians, parks,
  Sun Plaza, marina docks, beach + animated sea.
- **On foot and by car:** walk, run, steal any car, drive with
  accel/brake/steering physics.
- **Wanted 0–5 stars:** police cruisers chase and ram; foot cops chase,
  shoot and bust (lose 15% cash). Lay low and the heat cools off.
- **4 story missions** with briefings, gold beacons and minimap blips:
  WHEELS UP ($200), THE PICKUP ($350), HARBOR HEAT ($500),
  THE BIG SCORE ($1,500) — then a victory screen and free roam.
- **Combat:** mouse-aim pistol, tracers, enemy HP bars, kill payouts.
- **HUD + live minimap**, off-screen target arrow, event log, banners.
- **Save:** autosave after every mission + pause-menu save; CONTINUE
  on the title screen.
- **Side content:** 8 hidden $75 stashes.
- **Sound:** fully synthesized WebAudio music + SFX, no audio files.

## Structure

One job per file, all under `game/src/`:

| File | Job |
|---|---|
| `config.js` | every number, place, mission and colour |
| `random.js` | seeded RNG (mulberry32) |
| `city.js` | city generation + collision |
| `input.js` | keyboard and mouse |
| `audio.js` | synthesized music + SFX |
| `world.js` | simulation: driving, police, combat, missions, save |
| `render.js` | canvas drawing: city, HUD, minimap, menus |
| `shots.js` | the four staged screenshot scenes |
| `main.js` | frame loop + screen state machine |

`main.ts` (Node 22, stdlib only) copies `game/` + `screenshots/` to
`/output` and writes `/output/dossier.json` via `vendor/makefun-game.ts`.

## Screenshots

Four real renders in `screenshots/`, staged with `?shot=N&seed=1`:
title over a busy intersection, the beach road on foot, a 3-star chase,
and the mid-fight warehouse mission.

## License

MIT — see `LICENSE`. All city, characters, story, art, sound and music
are original; nothing from Rockstar Games or any other commercial game.
