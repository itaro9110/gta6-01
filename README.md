[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/itaro9110/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/itaro9110/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

# SOLMARA — An Open-World Crime Story

Leo Marin comes home to Solmara, a fictional sun-soaked coastal city, broke and
wanted — one job away from freedom. Mara Voss has four jobs for him, and the
last one is the $1,500 Meridian Vault.

## Play it

Open `game/index.html` in desktop Chrome, or run the local server:

```sh
npx tsx serve.ts
```

No install, no network, no libraries. Everything runs from the files in
`game/`.

## The story

1. **Hot Wheels** — steal any car, deliver it to Mara's Bar, the Rusty Anchor. $150.
2. **Courier Run** — three drops across the city: Old Market, the Palms Hotel,
   Harbor Works. $300.
3. **The Comet GT** — lift the gold Comet GT from the marina and get it to
   Rico's Chop Shop. $450.
4. **Meridian Vault** — hold E to crack the vault while the whole Solmara PD
   closes in, then escape to Mara's Bar. $1,500.

Finish all four and the story is done — but the city stays open.

## The city

A 3600×2600 grid of avenues and streets with five districts: Old Town,
Marina Bay, Downtown, Solmara Beach and Harbor Works. Liberty Plaza with its
fountain, the marina, the beach, the vault, the chop shop, Police HQ — all of
it is on the minimap. Traffic drives the roads, pedestrians walk the
sidewalks, and every car on the street can be stolen.

## How it plays

- **WASD** — walk / drive. **E** — steal a car, or hold it to crack the vault.
- **F** — punch. **Click** — shoot (watch the ammo). **P** — pause.
  **M** — mute. **C** — continue a saved game.
- The wanted system runs 0–5 stars. Police cars chase, ram and try to arrest
  you; the hotter you are, the more of them come. Lay low and the heat decays.
- Health, cash and ammo pickups are scattered around the city. Your progress
  saves in the browser and continues where you left off.

## Look and sound

Flat 2D top-down art: bright solid colors, thick outlines, no assets. All
sound is synthesized in the browser — engine hum, sirens, gunshots and a
simple music loop. No audio files.

## Files

| File | Job |
| --- | --- |
| `game/src/config.js` | Every number in one place |
| `game/src/random.js` | Seeded RNG |
| `game/src/city.js` | The map: roads, districts, places, buildings |
| `game/src/world.js` | The simulation: player, cars, traffic, peds, police, wanted, combat, missions, pickups, save/load |
| `game/src/render.js` | All drawing: city, cars, characters, HUD, minimap |
| `game/src/input.js` | Keyboard and mouse |
| `game/src/audio.js` | Synthesized sound and music |
| `game/src/shots.js` | The four screenshot scenes |
| `game/src/main.js` | Game loop and screens |
| `game/index.html` | Page and canvas |
| `serve.ts` | Static server for local play |
| `shots.json` | Screenshot list |
| `main.ts` | Build entrypoint: copies the game and screenshots into the output and writes the dossier |

[Bounty: make.fun — Make GTA 6 (gta6-01)](https://make.fun/bounty/gta6-01)
