# Siroclimb

Front of the Siroclimb game: pick a market, go long or short, the coin rolls up and down a staircase that follows the price, leverage climbs from 1x to 4x every 6 seconds, and you decide when to cash out.

Front only. The back end (prices, runs, rounds, payouts) is owned by Eden and plugs in through `js/api.js`.

## Run

```sh
npm run dev          # http://127.0.0.1:8765  (ES modules need a server)
```

`#play` opens the lobby directly, `?classic` switches back to the first game version (auto climbing box and ladder), `?demo=wild` triples the demo volatility.

## Layout

| Path | What |
| --- | --- |
| `index.html` | Whole app on one page: intro, lobby, game HUD, result, sheets |
| `play.css` | App styles (Sirocco terracotta art direction) |
| `js/game.js` | Screens, HUD, leverage gauge, sound, scene driving |
| `js/api.js` | Back end contract (documented at the top) and in browser mock |
| `js/sirocco-escalator-scene.js` | Three.js scene: escalator hero, launch, stairs track physics |
| `assets/` | Hero films (webm and mp4), poster, brand SVGs |
| `3d/` | 3D sources: every scene version, render and capture scripts, encoded renders |
| `tests/` | Puppeteer end to end flows (solo, rounds, intro, endings) |

## Plugging the back end

Replace the mock half of `js/api.js` while keeping the exported functions and event shapes: `init`, `connect`, `listAssets`, `subscribePrice`, `startRun`, `onRun`, `cashOut`, `currentRound`, `onRound`, `joinRound`, `roundStandings`, `leaderboard`, `balance`, `faucet`, `openPack`.

## 3D

`3d/sirocco-escalator-scene.js` is the source of truth for the scene and is copied to `js/` for the site. Render harnesses (`3d/_track.mjs`, `3d/_game.mjs`, `3d/render.mjs`) drive headless Chrome; PNG frame sequences are not versioned.

## Tests

```sh
npm i
npm run test:solo    # screenshots land in out/
```
