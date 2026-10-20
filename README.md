# Penguin Skating

English | [简体中文](./README.zh-CN.md)

A WeChat mini-game where you guide a penguin to push stones onto target areas by sliding on ice.

## Features

### Core Gameplay
- Ice physics simulation with realistic sliding and friction
- Touch-based controls: swipe to choose direction, release to slide
- Sokoban-style puzzle: push stones onto target areas
- Multiple levels with increasing difficulty (7 built-in levels + procedural generation)
- Collision detection between penguin, stones, and boundaries

### Obstacle System
- Ice walls: block movement and cause bouncing
- Ice holes: instant failure when penguin falls in
- Snow piles: slow down movement
- Dynamic obstacle placement per level

### UI System
- Main menu with animated penguin
- Level selection with star ratings
- Pause/resume functionality
- Level completion screen with rewards
- Game over screen with revival options
- In-game HUD (steps, time, level info)

### Progression Systems
- Food/stamina system (fish 🐟, shrimp 🦐, squid 🦑, goldfish 🐠)
- Achievement system (20+ achievements to unlock)
- Revival mechanism (share to friends/groups, watch ads, consume food)
- Star rating system (1-3 stars per level)
- Local save system for progress

### Social Features
- WeChat login integration
- Leaderboard (open data domain)
- Share to friends and groups
- Share for rewards

### Audio System
- Background music (placeholder)
- Sound effects for push, collision, slide, win, fail
- Audio manager with volume control

### Game Statistics
- Settlement manager tracking all game data
- Best times and moves per level
- Total games, wins, streaks
- Perfect game tracking

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
├── game.js                      # Game entry point
├── game.json                    # Mini game configuration
├── project.config.json          # Project configuration
├── js/
│   ├── base/                    # Base classes
│   │   ├── sprite.js           # Sprite base class
│   │   └── pool.js             # Object pool
│   ├── runtime/                 # Game objects
│   │   ├── penguin.js          # Penguin (player character)
│   │   ├── stone.js            # Pushable stones
│   │   ├── target.js           # Target area
│   │   ├── background.js       # Ice background
│   │   └── obstacle.js         # Obstacles (ice walls, holes, snow piles)
│   ├── physics/                 # Physics system
│   │   ├── physics.js          # Physics engine
│   │   └── collision.js        # Collision detection
│   ├── levels/                  # Level management
│   │   └── level-manager.js    # Level loader and manager
│   ├── ui/                      # UI components
│   │   ├── scene-manager.js    # Scene management
│   │   ├── menu-scene.js       # Main menu
│   │   ├── level-select-scene.js # Level selection
│   │   ├── pause-scene.js      # Pause screen
│   │   ├── result-scene.js     # Level completion
│   │   ├── gameover-scene.js   # Game over screen
│   │   ├── login-scene.js      # Login screen
│   │   ├── rank-scene.js       # Leaderboard
│   │   ├── achievement-scene.js # Achievement display
│   │   ├── achievement-notification.js # Achievement popups
│   │   ├── revive-scene.js     # Revival options
│   │   ├── game-hud.js         # In-game HUD
│   │   ├── food-display.js     # Food counter
│   │   └── button.js           # Reusable button component
│   └── utils/                   # Utility managers
│       ├── audio-manager.js    # Sound effects and music
│       ├── wechat-service.js   # WeChat API integration
│       ├── food-manager.js     # Food/stamina system
│       ├── achievement-manager.js # Achievement tracking
│       ├── revive-manager.js   # Revival system
│       ├── settlement-manager.js # Game statistics
│       └── ad-manager.js       # Ad management
├── levels/                      # Level data (JSON)
│   ├── level1.json ~ level7.json
├── audio/                       # Sound effects (placeholder)
└── docs/                        # Phase documentation
    ├── phase1-core-prototype.md
    ├── phase2-ui-system.md
    ├── phase3-obstacle-system.md
    ├── phase4-audio-system.md
    ├── phase5-wechat-integration.md
    ├── phase6-login-rank.md
    ├── phase7-food-system.md
    ├── phase8-achievement-share.md
    ├── phase9-revive-system.md
    └── phase10-gameover-settlement.md
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

### Phase Documentation
- [Phase 1: Core Prototype](./docs/phase1-core-prototype.md) - Basic gameplay and physics
- [Phase 2: UI System](./docs/phase2-ui-system.md) - Menu, level select, pause, result screens
- [Phase 3: Obstacle System](./docs/phase3-obstacle-system.md) - Ice walls, holes, snow piles
- [Phase 4: Audio System](./docs/phase4-audio-system.md) - Sound effects and music
- [Phase 5: WeChat Integration](./docs/phase5-wechat-integration.md) - WeChat API setup
- [Phase 6: Login & Rank](./docs/phase6-login-rank.md) - User login and leaderboard
- [Phase 7: Food System](./docs/phase7-food-system.md) - Stamina and rewards
- [Phase 8: Achievement & Share](./docs/phase8-achievement-share.md) - Achievements and sharing
- [Phase 9: Revive System](./docs/phase9-revive-system.md) - Revival mechanisms
- [Phase 10: Game Over & Settlement](./docs/phase10-gameover-settlement.md) - Statistics and game over

## Current Status

✅ **All 10 phases completed!** The game is feature-complete with:
- Core gameplay mechanics
- Full UI system
- Obstacle system
- Audio system
- WeChat integration
- Login and leaderboard
- Food/stamina system
- Achievement system
- Revival mechanism
- Game statistics tracking

## Roadmap

### Completed
- [x] UI system (main menu, level select, pause screen)
- [x] Obstacle system (ice walls, holes, snow piles)
- [x] Sound effects and music (placeholder audio files)
- [x] Local storage (level progress)
- [x] WeChat login and leaderboard
- [x] Food/stamina system
- [x] Achievement system
- [x] Revival mechanism
- [x] Game statistics

### Future Enhancements
- [ ] Replace placeholder audio with real sound files
- [ ] Add more levels (currently 7 + procedural generation)
- [ ] Implement real ad integration (currently placeholder)
- [ ] Add daily challenges
- [ ] Implement道具 shop (power-ups)
- [ ] Add more achievements
- [ ] Social features enhancement (friend challenges)
- [ ] Performance optimization for large levels

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
