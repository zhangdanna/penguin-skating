# Penguin Skating

English | [简体中文](./README.zh-CN.md)

A WeChat mini-game where you guide a penguin to push stones onto target areas by sliding on ice.

## Features

- Ice physics simulation with realistic sliding and friction
- Touch-based controls: swipe to choose direction, release to slide
- Multiple levels with increasing difficulty
- Collision detection between penguin, stones, and boundaries
- Beautiful ice-themed graphics with animated effects

## Tech Stack

- **Platform**: WeChat Mini Game
- **Rendering**: Canvas 2D
- **Physics**: Custom ice physics engine
- **Language**: JavaScript (ES6+)
- **Framework**: WeChat Mini Game API

## Quick Start

### Prerequisites

- [WeChat Developer Tools](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html) installed

### Run Locally

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd penguin-skating-game
   ```

2. Open WeChat Developer Tools

3. Import the project:
   - Click "Import Project"
   - Select the `penguin-skating-game` directory
   - Enter your AppID (or use "Test AppID" for testing)

4. Click "Compile" to run the game

## Project Structure

```
penguin-skating-game/
├── game.js                 # Game entry point
├── game.json               # Mini game configuration
├── project.config.json     # Project configuration
├── js/
│   ├── base/               # Base classes
│   │   ├── sprite.js       # Sprite base class
│   │   └── pool.js         # Object pool
│   ├── runtime/            # Game objects
│   │   ├── penguin.js      # Penguin (player character)
│   │   ├── stone.js        # Pushable stones
│   │   ├── target.js       # Target area
│   │   └── background.js   # Ice background
│   ├── physics/            # Physics system
│   │   ├── physics.js      # Physics engine
│   │   └── collision.js    # Collision detection
│   └── levels/             # Level management
│       └── level-manager.js
└── levels/                 # Level data (JSON)
    ├── level1.json
    ├── level2.json
    └── level3.json
```

## How to Play

1. **Swipe** on the screen to choose the sliding direction
2. **Release** to make the penguin slide in that direction
3. **Push stones** by sliding into them
4. **Win** by getting all stones onto the green target area

## Physics Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| Ice friction | 0.98 | Penguin sliding friction |
| Stone friction | 0.92 | Stone sliding friction |
| Max speed | 8 | Maximum sliding speed |
| Push force | 5 | Force applied to stones |
| Force transfer | 50% | Force transferred to stones |

## Configuration

### game.json

```json
{
  "deviceOrientation": "portrait",
  "showStatusBar": false
}
```

### project.config.json

Update the `appid` field with your WeChat Mini Game AppID:

```json
{
  "appid": "your-appid-here"
}
```

## Development

### Adding New Levels

Create a new JSON file in `levels/` directory:

```json
{
  "id": 4,
  "name": "Level Name",
  "penguin": { "x": 50, "y": 50 },
  "stones": [
    { "x": 200, "y": 150, "size": 40 }
  ],
  "target": { "x": 300, "y": 400, "width": 50, "height": 50 },
  "par": 5
}
```

### Code Structure

- **Base classes** (`js/base/`): Reusable base classes for game objects
- **Runtime objects** (`js/runtime/`): Game entities (penguin, stones, etc.)
- **Physics** (`js/physics/`): Physics simulation and collision detection
- **Levels** (`js/levels/`): Level loading and management

## Documentation

- [Phase 1: Core Prototype](./docs/phase1-core-prototype.md) - Detailed module documentation

## Roadmap

- [ ] UI system (main menu, level select, pause screen)
- [ ] Obstacle system (ice walls, holes, snow piles)
- [ ] Sound effects and music
- [ ] Local storage (level progress)
- [ ] WeChat login and leaderboard
- [ ] Ad integration
- [ ] Food/stamina system

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
