# Penguin Skating

English | [简体中文](./README.zh-CN.md)

A WeChat mini-game: guide a penguin across an ice rink, one cell per swipe, and push ice blocks onto the target area.

The board is 7 columns × 9 rows. **Each swipe moves exactly one cell.** Blocks that hit an obstacle can't be pushed. If a block is pushed into a hole, or the penguin steps into one, the level fails. Get every block onto the target to win.

---

## How to Play

1. Swipe in a direction → the penguin moves **one cell**
2. Swiping into a block pushes it one cell too (if it can't move, you only get a bump sound and no move is counted)
3. Push every block onto the target area to clear the level
4. Stars: moves ≤ par → ★★★; ≤ par × 1.5 → ★★☆; otherwise ★☆☆

### Obstacles

| Type | Effect |
|---|---|
| Ice wall `wall` | Blocks both penguin and ice blocks |
| Hole `hole` | Penguin falls in → instant fail; a block falls in → level becomes unsolvable, also a fail |
| Snow `snow` | Slower movement (tween 120ms → 220ms); blocks can't be pushed onto snow |

---

## Features

**Gameplay & Content**
- 60-level campaign: 7 hand-crafted levels + 53 procedurally generated ones, all verified solvable with a BFS solver
- Difficulty rises monotonically with optimal move count: level 1 = 13 moves, level 60 = 39 moves
- `par = ceil(optimal × 1.2)`, so three stars no longer require a flawless run
- Levels 61+ cycle through the 60, mirrored horizontally on odd rounds

**Progression**
- Food (stamina): fish 🐟 / shrimp 🦐 / squid 🦑 / goldfish 🐠, costing 0–5 per level by difficulty
- Natural recovery: +1 every 5 minutes, capped at 30, computed from real elapsed time with the remainder preserved
- 19 achievements covering wins, stars, streaks, revives and food collection
- Revive: watch a rewarded video (5/day) or spend food

**Social & Platform**
- Friend leaderboard via the open data context (`open-data/`); the main context only renders it
- Report policy is monotonic: highest level + total stars + best moves for that level
- Sharing is pure distribution — **no rewards attached** (compliance requirement)
- Privacy authorization via `wx.onNeedPrivacyAuthorization` with a custom dialog, triggered on demand

**Experience & Engineering**
- Design-canvas coordinate system (375×667) with uniform scaling, covering every screen from 320 to 768 wide
- App lifecycle: auto-pause on background, BGM stops, timer does not jump when returning
- Window resize recomputes the board and every UI button position
- Offscreen caching for static layers (ocean backdrop, board tiles, glass panel shadows); no `shadowBlur` anywhere
- 171 offline regression assertions covering layout, timing, economy, levels, leaderboard and rendering

---

## Quick Start

### Option 1: WeChat DevTools (simulator / real device)

1. Install [WeChat DevTools](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. "Import Project" → select this directory
3. Enter your own mini-game AppID (or use a test account)
4. Click "Compile"

> `project.config.json` uses `compileType: "game"` and `libVersion: "3.17.4"`.
> The privacy authorization API requires base library **≥ 2.32.3**.

### Option 2: Browser preview

```bash
node local-preview/server.js
# open http://localhost:8080/local-preview/index.html
```

`local-preview/wechat-adapter.js` maps `wx.*` onto browser APIs: the canvas is fixed at 375×667,
touch is mapped to mouse events, `visibilitychange` simulates background/foreground switching,
and ads plus privacy authorization are stubbed.

---

## Project Structure

```
penguin-skating-game/
├── game.js                       # Entry: main loop, state machine, level loading, lifecycle
├── game.json                     # Mini-game config (portrait, open data context)
├── project.config.json           # DevTools config (incl. package exclusions)
├── js/
│   ├── config.js                 # Ad units, version, other configurable values
│   ├── base/
│   │   └── sprite.js             # Sprite base class (position/size/tween)
│   ├── runtime/                  # Entities on the board
│   │   ├── penguin.js            # Penguin (swipe detection + rendering)
│   │   ├── stone.js              # Pushable ice blocks
│   │   ├── target.js             # Target area
│   │   ├── obstacle.js           # Obstacle factory (wall/hole/snow)
│   │   └── background.js         # Aquarium backdrop + ice board (cached static layers)
│   ├── levels/
│   │   ├── level-manager.js      # Campaign assembly (hand-crafted + generated, single source)
│   │   └── generated-levels.js   # Levels 8–60, produced by tools/gen-levels.mjs
│   ├── ui/
│   │   ├── layout.js             # Design-canvas coordinate system + uniform scaling
│   │   ├── theme.js              # Palette, fonts, panel/button/backdrop primitives
│   │   ├── scene-manager.js      # Scene stack
│   │   ├── game-scene.js         # Gameplay scene (thin shell; logic lives in game.js)
│   │   ├── menu-scene.js         # Main menu
│   │   ├── pause-scene.js        # Pause
│   │   ├── result-scene.js       # Level clear
│   │   ├── gameover-scene.js     # Game over
│   │   ├── revive-scene.js       # Revive options
│   │   ├── rank-scene.js         # Leaderboard (composites the open data canvas)
│   │   ├── achievement-scene.js  # Achievement list
│   │   ├── achievement-notification.js  # Achievement unlock toast
│   │   ├── privacy-scene.js      # Privacy authorization dialog
│   │   ├── game-hud.js           # In-game HUD (level/moves/timer/action bar)
│   │   ├── food-display.js       # Food counters and reward animation
│   │   └── button.js             # Button component
│   └── utils/
│       ├── audio-manager.js      # BGM + SFX, sound toggle persisted
│       ├── ad-manager.js         # Rewarded video (whole chain off when unconfigured)
│       ├── wechat-service.js     # Share / cloud storage / leaderboard reporting
│       ├── food-manager.js       # Food economy and natural recovery
│       ├── achievement-manager.js# Achievement rules and stats
│       ├── revive-manager.js     # Revive counts and daily limits
│       ├── settlement-manager.js # Per-run settlement and cumulative stats
│       ├── score.js              # Star rules (single implementation)
│       └── layer-cache.js        # Offscreen static-layer cache
├── open-data/
│   └── index.js                  # Open data context: friend leaderboard rendering
├── audio/                        # bgm.wav + 6 sound effects
├── images/
│   └── share-image.png           # Share card, 500×400
├── tools/
│   ├── gen-levels.mjs            # Level generator (reverse construction + BFS solve)
│   ├── gen-share-image.py        # Share image generator
│   ├── gen-bgm.py                # BGM generator
│   └── regression/run.mjs        # Offline regression suite
├── local-preview/                # Browser preview (not packaged)
└── docs/                         # Design and review docs (not packaged)
```

---

## Levels and Numbers

### Level data

Levels are no longer read from `levels/*.json` — everything lives in `js/levels/level-manager.js`:

- `HANDCRAFTED_LEVELS`: 7 hand-designed levels with `originalId` and a measured `optimal`
- `GENERATED_LEVELS`: 53 generated levels (`js/levels/generated-levels.js`)
- Both are merged, **sorted by `optimal` ascending**, then renumbered 1..60

### Generation algorithm

`tools/gen-levels.mjs` uses **reverse construction** instead of random placement (with 3 blocks, random boards are solvable only ~0.2% of the time — about 700 attempts per hit in practice):

1. Start from the solved state (all blocks already on the target) — guaranteed solvable
2. Randomly walk backwards (penguin retreats, dragging a block); Sokoban moves are reversible, so any board reached this way is solvable
3. Score each candidate direction: +3 when the block's Manhattan distance to the target grows, −1 when it shrinks, then sample by weight — without this, blocks end up right next to the target and difficulty collapses
4. Run BFS for the true optimal move count (integer state encoding `p | s0<<6 | s1<<12 | s2<<18`)
5. Build a pool of 96 boards with `optimal ≥ 18`, sort by `optimal`, and take 53 at even intervals

Regenerate after tweaking difficulty:

```bash
node tools/gen-levels.mjs
```

### Stars

Defined once in `js/utils/score.js` (`calcStars(moves, par)`):

| Stars | Condition |
|---|---|
| ★★★ | moves ≤ par |
| ★★☆ | moves ≤ par × 1.5 |
| ★☆☆ | otherwise |

### Food

| Food | Value | Source |
|---|---|---|
| 🐟 Fish | 1 | Level clear reward, natural recovery, ads |
| 🦐 Shrimp | 3 | Time bonus |
| 🦑 Squid | 10 | Time bonus, win streak |
| 🐠 Goldfish | 50 | Speed clear, 10-win streak |

Level cost: tutorial 0 / easy 1 / medium 2 / hard 3 / expert 5. Natural recovery: +1 per 5 minutes, cap 30.

---

## Configuration

### Ad units (`js/config.js`)

```js
export const AD_UNITS = {
  rewardedVideo: ''   // empty = whole ad chain disabled, all ad entries hidden
}
```

Fill in a real unit (an `adunit-` ID) to enable the "watch video" entries on the revive screen and in the out-of-food dialog. Leaving it empty doesn't affect gameplay or review.

### AppID (`project.config.json`)

```json
{ "appid": "your-appid-here" }
```

`project.private.config.json` holds local DevTools settings and is excluded via `.gitignore`.

### Package exclusions

`packOptions.ignore` in `project.config.json` excludes `docs/`, `local-preview/`, `tools/`, `.workbuddy-ai/`, the READMEs and the design mockup. These belong in the repo but not in the upload package.

---

## Development

### Run the regression suite

```bash
node --experimental-vm-modules tools/regression/run.mjs .
```

Runs the real modules offline (`vm.SourceTextModule`) with a controllable clock and simulated touch chain. 171 assertions covering layout adaptation, level coordinate mapping, pause/back state resets, settlement idempotency, achievement rewards, compliance items, ad stubs, privacy authorization, package exclusions, the design-canvas system, background timing, food economy, level uniqueness and leaderboard policy.

### Working with UI coordinates

All overlay scenes are authored in **375×667 design coordinates**:

```js
import { CENTER_X, stage } from './layout'

render(ctx) {
  drawOverlay(ctx, 0.6)        // overlay covers real pixels
  const s = stage()
  ctx.save()
  s.apply(ctx)                 // everything below uses design coordinates
  // ...
  ctx.restore()
}

onTouchStart(touch) {
  const t = stage().unproject(touch)   // screen → design coordinates
}
```

**Never write `canvas.width / 2` inside a scene** — the regression suite asserts that button coordinates are independent of canvas size and will fail.

### Adding a UI scene

Implement `render / update / onTouchStart / onTouchMove / onTouchEnd`, register it with `sceneManager`, and expose `relayout()` for window-size changes. Note that `relayout()` rebuilds button objects, so callbacks must live on the constructor or be saved and restored around it.

---

## Known Limitations

- **No backend**: without `code2session` there is no account system. The leaderboard relies on the openid binding built into `wx.setUserCloudStorage`, so only friends' scores are visible.
- **Generated level quality**: BFS guarantees solvability and the minimum move count, not that the solution is visually obvious. Hand-crafted levels read better.
- **Ads unconfigured**: all ad entries stay hidden, and running out of food means waiting for natural recovery.
- **Browser preview is locked to 375×667**: resizing the window only tests CSS scaling, not the 320-logical-pixel layout (that part is covered by the offline regression suite).

---

## Documentation

| Document | Contents |
|---|---|
| [Pre-release review](./docs/phase11-pre-release-review.md) | Technical and functional review (P0/P1/P2 with a fix list) |
| [Publishing guide](./docs/phase12-publish-guide.md) | WeChat mini-game and H5 publishing steps |
| [Batch A: Stability](./docs/review/batch-a-stability.md) | Crashes, deadlocks, state resets |
| [Batch B: Compliance](./docs/review/batch-b-compliance.md) | Induced sharing, fake ads, privacy, package size |
| [Batch C: Experience](./docs/review/batch-c-experience.md) | Screen adaptation, lifecycle, food economy, levels |
| [Batch D: Engineering](./docs/review/batch-d-engineering.md) | Dead code, duplication, error handling, performance |

`docs/phase1` through `phase10` are per-phase development logs describing the implementation at the time. Some of it (physics engine, level select screen, login) has since been removed.

---

## License

MIT
