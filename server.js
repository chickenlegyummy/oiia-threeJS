const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/models', express.static(path.join(__dirname, 'public/models')));
app.use('/sounds', express.static(path.join(__dirname, 'public/sounds')));
app.use('/skymap', express.static(path.join(__dirname, 'public/skymap')));

// Game state
const gameState = {
    players: new Map(),
    targets: new Map(),
    bullets: new Map(),
    scores: new Map(),
};

// Target spawn positions
const targetSpawnPositions = [
    { x: 0, y: 2, z: -15 },
    { x: -8, y: 1.5, z: -20 },
    { x: 8, y: 2.5, z: -18 },
    { x: -5, y: 1, z: -25 },
    { x: 5, y: 3, z: -22 },
    { x: 0, y: 1.5, z: -30 },
    { x: -12, y: 2, z: -35 },
    { x: 12, y: 1.8, z: -32 }
];

// Initialize targets
function initializeTargets() {
    targetSpawnPositions.forEach((pos, index) => {
        const targetId = `target_${index}`;
        gameState.targets.set(targetId, {
            id: targetId,
            position: pos,
            rotation: { x: 0, y: Math.random() * Math.PI * 2, z: 0 },
            health: 75 + Math.random() * 50,
            maxHealth: 100,
            scale: 5 + Math.random() * 0.5,
            points: 10 + Math.floor(Math.random() * 20),
            isAlive: true,
            bobSpeed: 0.5 + Math.random() * 1.0,
            bobHeight: 0.1 + Math.random() * 0.2,
            rotationSpeed: (Math.random() - 0.5) * 0.5,
            initialY: pos.y
        });
    });
}

// Initialize game
initializeTargets();

// Player class
class Player {
    constructor(id, socketId) {
        this.id = id;
        this.socketId = socketId;
        this.username = `Player_${id.substring(0, 6)}`;
        this.position = { x: 0, y: 1.6, z: 5 };
        this.rotation = { x: 0, y: 0, z: 0 };
        this.velocity = { x: 0, y: 0, z: 0 };
        this.health = 100;
        this.maxHealth = 100;
        this.ammo = 30;
        this.totalAmmo = 1200;
        this.score = 0;
        this.isRunning = false;
        this.isCrouching = false;
        this.isJumping = false;
        this.isDead = false;
        this.color = this.generateRandomColor();
    }

    generateRandomColor() {
        const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
        return colors[Math.floor(Math.random() * colors.length)];
    }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('New player connected:', socket.id);

    // Create new player
    const playerId = uuidv4();
    const player = new Player(playerId, socket.id);
    gameState.players.set(socket.id, player);
    gameState.scores.set(playerId, 0);

    // Send initial data to the new player
    socket.emit('init', {
        playerId: playerId,
        player: player,
        players: Array.from(gameState.players.values()).filter(p => p.socketId !== socket.id),
        targets: Array.from(gameState.targets.values()),
        scores: Object.fromEntries(gameState.scores)
    });

    // Notify other players about the new player
    socket.broadcast.emit('playerJoined', player);

    // Handle player movement
    socket.on('playerMove', (data) => {
        const player = gameState.players.get(socket.id);
        if (player && !player.isDead) {
            player.position = data.position;
            player.rotation = data.rotation;
            player.velocity = data.velocity;
            player.isRunning = data.isRunning;
            player.isCrouching = data.isCrouching;
            player.isJumping = data.isJumping;

            // Broadcast to other players
            socket.broadcast.emit('playerMoved', {
                playerId: player.id,
                position: player.position,
                rotation: player.rotation,
                velocity: player.velocity,
                isRunning: player.isRunning,
                isCrouching: player.isCrouching,
                isJumping: player.isJumping
            });
        }
    });

    // Handle shooting
    socket.on('shoot', (data) => {
        const player = gameState.players.get(socket.id);
        if (player && !player.isDead && player.ammo > 0) {
            player.ammo--;
            const bulletId = uuidv4();
            
            const bullet = {
                id: bulletId,
                playerId: player.id,
                position: data.position,
                direction: data.direction,
                speed: 100,
                damage: 25,
                timestamp: Date.now()
            };

            gameState.bullets.set(bulletId, bullet);

            // Broadcast to all players including sender
            io.emit('bulletFired', {
                bullet: bullet,
                playerId: player.id,
                ammo: player.ammo,
                totalAmmo: player.totalAmmo
            });

            // Remove bullet after 3 seconds
            setTimeout(() => {
                gameState.bullets.delete(bulletId);
            }, 3000);
        }
    });

    // Handle reloading
    socket.on('reload', () => {
        const player = gameState.players.get(socket.id);
        if (player && !player.isDead && player.totalAmmo > 0) {
            const bulletsNeeded = 30 - player.ammo;
            const bulletsToReload = Math.min(bulletsNeeded, player.totalAmmo);
            
            player.ammo += bulletsToReload;
            player.totalAmmo -= bulletsToReload;

            socket.emit('reloaded', {
                ammo: player.ammo,
                totalAmmo: player.totalAmmo
            });
        }
    });

    // Handle target hit
    socket.on('targetHit', (data) => {
        const target = gameState.targets.get(data.targetId);
        const player = gameState.players.get(socket.id);
        
        if (target && player && target.isAlive) {
            target.health -= data.damage;
            
            io.emit('targetDamaged', {
                targetId: data.targetId,
                health: target.health,
                hitBy: player.id
            });

            if (target.health <= 0) {
                target.isAlive = false;
                player.score += target.points;
                gameState.scores.set(player.id, player.score);

                io.emit('targetDestroyed', {
                    targetId: data.targetId,
                    destroyedBy: player.id,
                    points: target.points,
                    scores: Object.fromEntries(gameState.scores)
                });

                // Respawn target after 3-6 seconds
                setTimeout(() => {
                    respawnTarget(data.targetId);
                }, 3000 + Math.random() * 3000);
            }
        }
    });

    // Handle player hit (PvP)
    socket.on('playerHit', (data) => {
        const targetPlayer = Array.from(gameState.players.values()).find(p => p.id === data.targetPlayerId);
        const shooterPlayer = gameState.players.get(socket.id);
        
        if (targetPlayer && shooterPlayer && !targetPlayer.isDead) {
            targetPlayer.health -= data.damage;
            
            io.emit('playerDamaged', {
                playerId: targetPlayer.id,
                health: targetPlayer.health,
                hitBy: shooterPlayer.id
            });

            if (targetPlayer.health <= 0) {
                targetPlayer.isDead = true;
                shooterPlayer.score += 50; // Points for player kill
                gameState.scores.set(shooterPlayer.id, shooterPlayer.score);

                io.emit('playerKilled', {
                    killedPlayerId: targetPlayer.id,
                    killerPlayerId: shooterPlayer.id,
                    scores: Object.fromEntries(gameState.scores)
                });

                // Respawn player after 5 seconds
                setTimeout(() => {
                    respawnPlayer(targetPlayer);
                }, 5000);
            }
        }
    });

    // Handle chat messages
    socket.on('chatMessage', (message) => {
        const player = gameState.players.get(socket.id);
        if (player) {
            io.emit('chatMessage', {
                playerId: player.id,
                username: player.username,
                message: message,
                timestamp: Date.now()
            });
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        const player = gameState.players.get(socket.id);
        if (player) {
            gameState.players.delete(socket.id);
            gameState.scores.delete(player.id);
            io.emit('playerLeft', player.id);
            console.log('Player disconnected:', player.id);
        }
    });
});

// Helper functions
function respawnTarget(targetId) {
    const target = gameState.targets.get(targetId);
    if (target) {
        const randomPos = targetSpawnPositions[Math.floor(Math.random() * targetSpawnPositions.length)];
        target.position = { ...randomPos };
        target.position.x += (Math.random() - 0.5) * 10;
        target.position.z += (Math.random() - 0.5) * 10;
        target.health = 75 + Math.random() * 50;
        target.isAlive = true;
        target.rotation.y = Math.random() * Math.PI * 2;

        io.emit('targetRespawned', {
            targetId: targetId,
            target: target
        });
    }
}

function respawnPlayer(player) {
    player.position = { x: Math.random() * 20 - 10, y: 1.6, z: Math.random() * 10 };
    player.health = player.maxHealth;
    player.ammo = 30;
    player.isDead = false;

    const socketId = Array.from(gameState.players.entries())
        .find(([_, p]) => p.id === player.id)?.[0];

    if (socketId) {
        io.to(socketId).emit('respawn', {
            position: player.position,
            health: player.health,
            ammo: player.ammo
        });

        io.emit('playerRespawned', {
            playerId: player.id,
            position: player.position
        });
    }
}

// Game loop for server-side updates (targets animation, etc.)
setInterval(() => {
    const time = Date.now() / 1000;
    
    // Update target animations
    gameState.targets.forEach((target) => {
        if (target.isAlive) {
            // Update rotation
            target.rotation.y += target.rotationSpeed * 0.016;
            
            // Update bobbing
            const bobOffset = Math.sin(time * target.bobSpeed) * target.bobHeight;
            target.position.y = target.initialY + bobOffset;
        }
    });

    // Broadcast target updates periodically
    io.emit('targetsUpdate', Array.from(gameState.targets.values()));
}, 100); // 10 updates per second

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});