# OIIAIIOIIIAI - 3D FPS Game

[English](#english) | [繁體中文](#traditional-chinese)

---

## English

### 🎮 Game Overview

OIIAIIOIIIAI is a web-based 3D first-person shooter (FPS) game built with **THREE.js**. The game features both **single-player** and **multiplayer** modes, offering an immersive shooting experience with cat-themed targets in a beautiful skybox environment.

### ✨ Features

#### Core Gameplay
- 🎯 **Target Shooting**: Shoot at animated cat targets with realistic physics
- 🔫 **Weapon System**: AK-47 rifle with authentic shooting mechanics
- 💥 **Visual Effects**: Muzzle flash, bullet trails, and hit effects
- 🎵 **Audio**: Immersive shooting sounds and ambient audio
- 🌅 **Environment**: Beautiful skybox with dynamic lighting

#### Game Modes
- 🎮 **Single Player Mode**: Local gameplay with AI-controlled target spawning
- 👥 **Multiplayer Mode**: Real-time multiplayer with server synchronization
- 🔄 **Automatic Target Respawning**: Continuous gameplay experience

#### Technical Features
- 📱 **Responsive Design**: Works on desktop and mobile browsers
- 🎨 **Modern Graphics**: Enhanced lighting, shadows, and materials
- 🐛 **Debug Tools**: Built-in debugging and visualization tools
- 📊 **Performance Optimized**: Efficient collision detection and rendering

### 🚀 Quick Start

#### Single Player Mode
1. Open `singleplayer.html` in your web browser
2. Wait for the game to load (should complete quickly)
3. Click "Click to Start" when loading is complete
4. Use WASD to move, mouse to look around, left click to shoot

#### Multiplayer Mode
1. Start the server: `node server.js`
2. Open `index.html` in your web browser
3. Multiple players can join by visiting the same URL
4. Real-time synchronized gameplay with other players

### 🎮 Controls

| Key/Action | Function |
|------------|----------|
| **WASD** | Move (W=Forward, S=Backward, A=Left, D=Right) |
| **Mouse** | Look around / Aim |
| **Left Click** | Shoot |
| **Shift** | Run |
| **Ctrl** | Crouch |
| **R** | Reload weapon |
| **F** | Toggle instructions |
| **G** | Toggle debug panel |
| **T** | Test shot (debug) |

### 🛠️ Technical Architecture

#### Frontend Technologies
- **THREE.js**: 3D graphics rendering engine
- **WebGL**: Hardware-accelerated graphics
- **ES6 Modules**: Modern JavaScript module system
- **HTML5 Canvas**: Rendering surface
- **Web Audio API**: 3D positional audio

#### Backend Technologies (Multiplayer)
- **Node.js**: Server runtime
- **Socket.io**: Real-time bidirectional communication
- **Express.js**: Web server framework

#### Game Systems
- **Player System**: Movement, rotation, and state management
- **Weapon System**: Shooting mechanics, collision detection, ammo management
- **Target System**: Spawning, animation, destruction, and respawning
- **Network System**: Multiplayer synchronization and state management
- **Loading System**: Asset management and progress tracking

### 📁 Project Structure

```
oeeaeoeeeae-cat-FPS-game/
├── index.html              # Multiplayer game entry point
├── singleplayer.html       # Single player game entry point
├── server.js               # Multiplayer server
├── package.json            # Node.js dependencies
├── models/                 # 3D models
│   ├── ak47.glb           # Weapon model
│   ├── ammo.glb           # Ammunition model
│   └── oiia_cat.glb       # Target model
├── skymap/                 # Skybox textures
├── sounds/                 # Audio files
├── src/                    # Multiplayer source code
│   ├── scene.js           # Main game scene
│   ├── player.js          # Player mechanics
│   ├── weapon.js          # Weapon system
│   ├── targets.js         # Target management
│   └── network.js         # Network communication
└── src_singlePlayer/       # Single player source code
    ├── scene.js           # Single player scene
    ├── player.js          # Player mechanics
    ├── weapon.js          # Weapon system (no network)
    ├── targets.js         # Local target management
    └── network.js         # Network stubs
```

### 🔧 Development Setup

#### Prerequisites
- Modern web browser with WebGL support
- Node.js (for multiplayer server)

#### Installation
```bash
# Clone the repository
git clone https://github.com/chickenlegyummy/oiia-threeJS.git
cd oiia-threeJS

# Install dependencies (for multiplayer)
npm install

# Start multiplayer server
npm start
# or
node server.js

# For single player, simply open singleplayer.html in browser
```

### 🎯 Game Mechanics

#### Single Player Mode
- **Local Target Spawning**: 3-5 targets spawn automatically
- **Automatic Respawning**: New targets appear after destruction
- **Score Tracking**: Points awarded for successful hits
- **Health System**: Player health display
- **Immediate Loading**: Fast startup with fallback models

#### Multiplayer Mode
- **Server-Client Architecture**: Authoritative server model
- **Real-time Synchronization**: Player positions and actions
- **Shared Target System**: All players see the same targets
- **Network Optimized**: Efficient data transmission
- **Anti-cheat Protection**: Server-side validation

### 🐛 Debug Features

#### Debug Panel (Press G)
- **Performance Metrics**: FPS, triangle count
- **Player Information**: Position, rotation
- **Target Statistics**: Active targets, destroyed count
- **Weapon Status**: Ammo count, collision data

#### Debug Commands
- `weaponDebug()`: Toggle weapon debug visualization
- `scanTargets()`: Manually scan for targets
- `registerTarget(target, size)`: Register custom targets

### 🎨 Visual Features

#### Enhanced Graphics
- **PBR Materials**: Physically-based rendering
- **Dynamic Shadows**: Real-time shadow mapping
- **Post-processing**: Tone mapping and color correction
- **Particle Effects**: Muzzle flash and impact particles

#### Environment
- **Skybox**: 360-degree environment mapping
- **Atmospheric Fog**: Depth perception enhancement
- **Terrain Variation**: Procedural floor displacement
- **Multiple Light Sources**: Sun, ambient, and fill lighting

### 🔊 Audio System

- **3D Positional Audio**: Spatial sound effects
- **Weapon Sounds**: Realistic firing audio
- **Ambient Audio**: Environmental soundscape
- **Volume Control**: Adjustable audio levels

### 📈 Performance Optimizations

- **Efficient Collision Detection**: Distance-based hit detection
- **Object Pooling**: Reuse of bullet and effect objects
- **LOD System**: Level-of-detail for distant objects
- **Frustum Culling**: Only render visible objects
- **Texture Optimization**: Compressed texture formats

---

## Traditional Chinese

### 🎮 遊戲概述

OIIAIIOIIIAI 是一款基於網頁的 3D 第一人稱射擊遊戲（FPS），使用 **THREE.js** 構建。遊戲提供**單人模式**和**多人模式**，在美麗的天空盒環境中提供以貓咪為主題的目標射擊體驗。

### ✨ 功能特色

#### 核心遊戲玩法
- 🎯 **目標射擊**：射擊帶有真實物理效果的動畫貓咪目標
- 🔫 **武器系統**：AK-47 步槍，具有真實的射擊機制
- 💥 **視覺效果**：槍口閃光、子彈軌跡和擊中效果
- 🎵 **音頻**：沉浸式射擊聲音和環境音頻
- 🌅 **環境**：美麗的天空盒與動態光照

#### 遊戲模式
- 🎮 **單人模式**：本地遊戲，AI 控制目標生成
- 👥 **多人模式**：即時多人遊戲，伺服器同步
- 🔄 **自動目標重生**：持續的遊戲體驗

#### 技術特色
- 📱 **響應式設計**：支援桌面和行動瀏覽器
- 🎨 **現代圖形**：增強的光照、陰影和材質
- 🐛 **除錯工具**：內建除錯和視覺化工具
- 📊 **效能優化**：高效的碰撞檢測和渲染

### 🚀 快速開始

#### 單人模式
1. 在網頁瀏覽器中開啟 `singleplayer.html`
2. 等待遊戲載入（應該會快速完成）
3. 載入完成後點擊「Click to Start」
4. 使用 WASD 移動，滑鼠環顧四周，左鍵射擊

#### 多人模式
1. 啟動伺服器：`node server.js`
2. 在網頁瀏覽器中開啟 `index.html`
3. 多個玩家可以透過訪問相同的 URL 加入
4. 與其他玩家進行即時同步遊戲

### 🎮 操作控制

| 按鍵/動作 | 功能 |
|-----------|------|
| **WASD** | 移動（W=前進，S=後退，A=左移，D=右移）|
| **滑鼠** | 環顧四周 / 瞄準 |
| **左鍵** | 射擊 |
| **Shift** | 跑步 |
| **Ctrl** | 蹲下 |
| **R** | 重新裝彈 |
| **F** | 切換操作說明 |
| **G** | 切換除錯面板 |
| **T** | 測試射擊（除錯用）|

### 🛠️ 技術架構

#### 前端技術
- **THREE.js**：3D 圖形渲染引擎
- **WebGL**：硬體加速圖形
- **ES6 模組**：現代 JavaScript 模組系統
- **HTML5 Canvas**：渲染表面
- **Web Audio API**：3D 位置音頻

#### 後端技術（多人模式）
- **Node.js**：伺服器執行環境
- **Socket.io**：即時雙向通訊
- **Express.js**：網頁伺服器框架

#### 遊戲系統
- **玩家系統**：移動、旋轉和狀態管理
- **武器系統**：射擊機制、碰撞檢測、彈藥管理
- **目標系統**：生成、動畫、銷毀和重生
- **網路系統**：多人同步和狀態管理
- **載入系統**：資源管理和進度追蹤

### 🎯 遊戲機制

#### 單人模式
- **本地目標生成**：自動生成 3-5 個目標
- **自動重生**：銷毀後出現新目標
- **分數追蹤**：成功擊中獲得分數
- **生命系統**：玩家生命值顯示
- **即時載入**：使用備用模型快速啟動

#### 多人模式
- **伺服器-客戶端架構**：權威伺服器模型
- **即時同步**：玩家位置和動作
- **共享目標系統**：所有玩家看到相同目標
- **網路優化**：高效數據傳輸
- **反作弊保護**：伺服器端驗證

### 🐛 除錯功能

#### 除錯面板（按 G）
- **效能指標**：FPS、三角形數量
- **玩家資訊**：位置、旋轉
- **目標統計**：活躍目標、銷毀數量
- **武器狀態**：彈藥數量、碰撞數據

#### 除錯指令
- `weaponDebug()`：切換武器除錯視覺化
- `scanTargets()`：手動掃描目標
- `registerTarget(target, size)`：註冊自訂目標

### 🎨 視覺特色

#### 增強圖形
- **PBR 材質**：基於物理的渲染
- **動態陰影**：即時陰影映射
- **後處理**：色調映射和色彩校正
- **粒子效果**：槍口閃光和撞擊粒子

#### 環境
- **天空盒**：360 度環境映射
- **大氣霧**：深度感知增強
- **地形變化**：程序化地板置換
- **多光源**：太陽光、環境光和補光

### 🔊 音頻系統

- **3D 位置音頻**：空間音效
- **武器聲音**：真實的射擊音頻
- **環境音頻**：環境音景
- **音量控制**：可調整音頻級別

### 📈 效能優化

- **高效碰撞檢測**：基於距離的命中檢測
- **物件池**：重複使用子彈和效果物件
- **LOD 系統**：遠距離物件的細節層級
- **視錐剔除**：僅渲染可見物件
- **紋理優化**：壓縮紋理格式

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

歡迎貢獻！請隨時提交 Pull Request。

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

此專案為開源專案，採用 [MIT 許可證](LICENSE)。

## 🎮 Play Now!

- **Single Player**: Open `singleplayer.html` / 開啟 `singleplayer.html`
- **Multiplayer**: Start server with `node server.js` then open `index.html` / 使用 `node server.js` 啟動伺服器後開啟 `index.html`

---

*Built with ❤️ using THREE.js*