# Oiia Uwu - Multiplayer FPS Game

A fun multiplayer first-person shooter game featuring cats with UwU-47 weapons! Hunt the oIiA cats with your friends in this Three.js-powered browser game.

## Features

- **Real-time Multiplayer**: Play with friends using Socket.IO
- **FPS Gameplay**: Classic first-person shooter mechanics
- **Cat Targets**: Hunt the adorable oIiA cats for points
- **3D Graphics**: Built with Three.js for smooth 3D rendering
- **Cross-platform**: Runs in any modern web browser

## Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm (comes with Node.js)

### Installation

1. **Clone the repository** (or download the files)
   ```bash
   git clone <your-repo-url>
   cd oeeaeoeeeae-cat-FPS-game
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```

4. **Open your browser** and go to:
   ```
   http://localhost:3000
   ```

5. **Share with friends**: Send them the same URL to play together!

### Development Mode

For development with auto-restart on file changes:
```bash
npm run dev
```

## How to Play

### Controls
- **W A S D** - Move around
- **Mouse** - Look around
- **Space** - Jump
- **Shift** - Run
- **Left Click** - Shoot
- **R** - Reload
- **Ctrl/C** - Crouch
- **Tab** - Debug panel (adjust settings)

### Gameplay
- Hunt the moving cat targets for points
- Each target destroyed gives you score points
- Targets respawn automatically after being destroyed
- See other players in real-time as colored capsules
- Your shots and movements are synchronized with other players

### Multiplayer Features
- Real-time player synchronization
- Shared target system (when someone destroys a target, everyone sees it)
- Visual effects for other players' shots
- Player count display in HUD
- Connection status indicator

## Technical Details

### Architecture
This game follows a **client-server architecture** as described in Gabriel Gambetta's articles on fast-paced multiplayer games:

- **Authoritative Server**: The server manages game state and validates actions
- **Client-Side Prediction**: Smooth movement despite network latency
- **State Synchronization**: Players and targets are synchronized across all clients
- **Event Broadcasting**: Shooting and target destruction events are shared

### Network Protocol
- Uses WebSocket communication via Socket.IO
- Player positions sent 20 times per second
- Shooting events sent immediately
- Server runs at 60 FPS for smooth gameplay

### Anti-Cheat Note
As mentioned in the requirements, this implementation doesn't focus on preventing cheating - sometimes being able to cheat is fun! The server does basic validation but doesn't implement strict anti-cheat measures.

## File Structure

```
├── server.js              # Main server file
├── package.json           # Node.js dependencies
├── index.html             # Main game page
├── src/
│   ├── scene.js           # Main game scene and loop
│   ├── player.js          # Player movement and controls
│   ├── weapon.js          # Weapon system and shooting
│   ├── targets.js         # Target spawning and management
│   └── network.js         # Multiplayer networking
├── models/                # 3D models
├── skymap/               # Skybox textures
└── sounds/               # Game audio files
```

## Troubleshooting

### Can't connect to server
- Make sure the server is running (`npm start`)
- Check if port 3000 is available
- Try restarting the server

### Performance issues
- Close unnecessary browser tabs
- Try lowering graphics quality in debug panel (Tab key)
- Ensure stable internet connection

### Audio not working
- Make sure your browser allows audio
- Click on the game area to enable audio context
- Check your browser's audio settings

## Customization

### Game Settings
Press **Tab** in-game to open the debug panel where you can adjust:
- Movement speed
- Jump height
- Mouse sensitivity
- Camera shake effects
- And more!

### Server Configuration
Edit `server.js` to change:
- Server port (default: 3000)
- Tick rate (default: 60 FPS)
- Player validation settings

## Contributing

Feel free to fork and modify this game! Some ideas for improvements:
- Add player names and chat
- Implement different weapon types
- Add game modes (team vs team, capture the flag, etc.)
- Improve graphics and animations
- Add sound effects for multiplayer events

## License

MIT License - feel free to use this code for your own projects!

---

Have fun hunting cats with your friends! 🐱🔫
