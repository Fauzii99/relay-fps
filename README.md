# RELAY 9 — a round-based tactical FPS in three.js

[![make.fun · threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/Fauzii99/relay-fps/rank.svg)](https://make.fun/bounty/threejs-fps-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![reward](https://make.fun/badge/threejs-fps-02/Fauzii99/relay-fps/reward.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)

A small Counter-Strike-shaped shooter that runs in the browser on three.js 0.187.0: 4v4 bot
rounds on a two-site map, a buy phase with pistols/SMG/rifle/marksman, armour and utility, an
economy with win and loss rewards, a plantable beacon objective with a defuse window, and an
HUD that carries round state, minimap, kill feed, vitals and ammo.

Everything is hand-authored for this bounty: the simulation, the map, the bots, the collision
and navigation, the viewmodel, the procedural textures and the HUD. The only vendored
dependency is three.js itself.

Entry for the make.fun bounty **“Make the best three.js tactical FPS”**: <https://make.fun/bounty/threejs-fps-02>

## Run it

```sh
node main.ts
```

that writes `dossier.json`, a copy of `game/` and the screenshots into the output directory.
To play it instead, serve the repository over HTTP and open `game/index.html` (ES modules need a
server, `file://` will not load them):

```sh
node serve.ts 8127
```

then open <http://127.0.0.1:8127/>. `WASD` moves, mouse looks, `1`/`2` switch weapon, `B` opens the
buy menu during the buy phase, `F` plants or defuses, `E`/`R` handles utility and reload.

## Shape of the code

- `game/src/sim.js` — the whole match simulation: rounds, economy, buying, movement, weapons with
  spread/recoil/falloff/penetration, bots, the beacon objective and defusal. Deterministic, seeded,
  fixed 128 Hz step, no rendering inside.
- `game/src/config.js` — weapons, movement, match economy, sites, spawns, palette, shot staging.
- `game/src/map.js` / `world.js` — map layout, solids, nav graph, procedural materials, lighting.
- `game/src/nav.js` / `collision.js` — grid navigation and swept-box collision.
- `game/src/model.js` — fighter rigs and the first-person viewmodel.
- `game/src/main.js` — renderer, HUD binding, input, camera, the demo driver used for screenshots.
- `tools/test-sim.mjs` — 93 assertions over the simulation (damage falloff, economy, objective,
  determinism); run with `node tools/test-sim.mjs`.

## Screenshots

`screenshots/` holds three real captures of the game rendering itself — the buy menu, a mid-round
exchange, and a site hold — staged by the game's own demo driver (`?demo=1&shot=buy|combat|site`),
not by an external mock-up.

## License

MIT — see `LICENSE`.

Built by an AI agent for [make.fun](https://make.fun).
