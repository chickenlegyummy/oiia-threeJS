const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files
app.use(express.static(path.join(__dirname)));

// Game state
const gameState = {
    players: {},
    targets: new Map(), // Use Map for faster target lookups by ID
    gameTime: 0,
    nextTargetId: 1
};

// Target management
class ServerTarget {
    constructor(id, position, options = {}) {
        this.id = id;
        this.position = position;
        this.rotation = options.rotation || { x: 0, y: Math.random() * Math.PI * 2, z: 0 };
        this.scale = options.scale || 5;
        this.health = options.health || 100;
        this.maxHealth = this.health;
        this.points = options.points || 10;
        this.createdAt = Date.now();
        this.isAlive = true;
    }

    takeDamage(damage) {
        this.health = Math.max(0, this.health - damage);
        if (this.health <= 0) {
            this.isAlive = false;
        }
        return this.health <= 0; // Returns true if target is destroyed
    }

    toNetworkData() {
        return {
            id: this.id,
            position: this.position,
            rotation: this.rotation,
            scale: this.scale,
            health: this.health,
            maxHealth: this.maxHealth,
            points: this.points,
            isAlive: this.isAlive
        };
    }
}

// Initialize some targets
function spawnInitialTargets() {
    console.log('🎯 Spawning initial targets on server...');
    
    const positions = [
        { x: 0, y: 2, z: -15 },
        { x: -8, y: 1.5, z: -20 },
        { x: 8, y: 2.5, z: -18 },
        { x: -5, y: 1, z: -25 },
        { x: 5, y: 3, z: -22 },
        { x: 0, y: 1.5, z: -30 },
        { x: -12, y: 2, z: -35 },
        { x: 12, y: 1.8, z: -32 }
    ];

    positions.forEach((pos, index) => {
        const target = new ServerTarget(gameState.nextTargetId++, pos, {
            health: 75 + Math.random() * 50,
            points: 10 + Math.floor(Math.random() * 20)
        });
        gameState.targets.set(target.id.toString(), target);
        console.log(`🎯 Created target ${target.id} at position (${pos.x}, ${pos.y}, ${pos.z}) with ${target.health} health`);
    });
    
    console.log(`🎯 Total targets created: ${gameState.targets.size}`);
}

function spawnNewTarget() {
    const x = (Math.random() - 0.5) * 40;
    const y = 1 + Math.random() * 4;
    const z = -15 - Math.random() * 25;

    const target = new ServerTarget(gameState.nextTargetId++, { x, y, z }, {
        health: 50 + Math.random() * 100,
        points: 5 + Math.floor(Math.random() * 25)
    });

    gameState.targets.set(target.id.toString(), target);
    
    console.log(`🎯 SERVER: Spawning new target ${target.id} at position (${x}, ${y}, ${z})`);
    console.log(`🎯 SERVER: Target data to send:`, target.toNetworkData());
    console.log(`🎯 SERVER: Total connected clients:`, io.engine.clientsCount);
    console.log(`🎯 SERVER: Total targets after spawn:`, gameState.targets.size);
    
    // Broadcast new target to all clients
    io.emit('targetSpawned', target.toNetworkData());
    
    console.log(`🎯 SERVER: targetSpawned event emitted to all clients`);
}

// Game constants
const TICK_RATE = 60; // Server updates per second
const TICK_INTERVAL = 1000 / TICK_RATE;

// Player management
class ServerPlayer {
    constructor(id) {
        this.id = id;
        this.position = { x: 0, y: 1.6, z: 0 };
        this.rotation = { x: 0, y: 0 };
        this.velocity = { x: 0, y: 0, z: 0 };
        this.health = 100;
        this.isMoving = false;
        this.isCrouching = false;
        this.isRunning = false;
        this.lastUpdate = Date.now();
    }

    update(inputData) {
        if (inputData.position) {
            // Simple position validation - ensure player isn't moving too fast
            const maxSpeed = inputData.isRunning ? 20 : 12;
            const deltaTime = (Date.now() - this.lastUpdate) / 1000;
            this.lastUpdate = Date.now();

            if (deltaTime > 0) {
                const deltaX = inputData.position.x - this.position.x;
                const deltaZ = inputData.position.z - this.position.z;
                const distance = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);
                const speed = distance / deltaTime;

                // Allow the movement if it's reasonable
                if (speed <= maxSpeed * 1.5) { // Allow some tolerance
                    this.position = inputData.position;
                    this.velocity = inputData.velocity || this.velocity;
                }
            }
        }

        if (inputData.rotation) {
            this.rotation = inputData.rotation;
        }

        this.isMoving = inputData.isMoving || false;
        this.isCrouching = inputData.isCrouching || false;
        this.isRunning = inputData.isRunning || false;
    }

    toNetworkData() {
        return {
            id: this.id,
            position: this.position,
            rotation: this.rotation,
            velocity: this.velocity,
            health: this.health,
            isMoving: this.isMoving,
            isCrouching: this.isCrouching,
            isRunning: this.isRunning
        };
    }
}

// Socket connection handling
io.on('connection', (socket) => {
    console.log(`Player ${socket.id} connected`);

    // Create new player
    const player = new ServerPlayer(socket.id);
    gameState.players[socket.id] = player;

    // Send initial game state to new player
    const targetsArray = Array.from(gameState.targets.values()).map(t => t.toNetworkData());
    console.log(`Sending initial game state to player ${socket.id}:`);
    console.log(`- Players: ${Object.keys(gameState.players).length}`);
    console.log(`- Targets: ${targetsArray.length}`);
    
    // CRITICAL: Ensure we always have targets when client connects
    if (targetsArray.length === 0) {
        console.log('⚠️ WARNING: No targets to send to client! This should not happen.');
        console.log('⚠️ Server gameState.targets.size:', gameState.targets.size);
        console.log('⚠️ Attempting to respawn initial targets...');
        spawnInitialTargets();
        // Recreate the targets array after spawning
        const newTargetsArray = Array.from(gameState.targets.values()).map(t => t.toNetworkData());
        console.log('⚠️ After respawn, targets count:', newTargetsArray.length);
    }
    
    // Use the most up-to-date targets array
    const finalTargetsArray = Array.from(gameState.targets.values()).map(t => t.toNetworkData());
    
    // Debug: Log each target being sent
    console.log(`🎯 DETAILED TARGET DATA for new player ${socket.id}:`);
    finalTargetsArray.forEach((target, index) => {
        console.log(`  Target ${target.id}: pos(${target.position.x.toFixed(1)}, ${target.position.y.toFixed(1)}, ${target.position.z.toFixed(1)}), health: ${target.health.toFixed(1)}/${target.maxHealth.toFixed(1)}, alive: ${target.isAlive}`);
    });
    console.log(`🎯 Server gameState.targets.size: ${gameState.targets.size}`);
    console.log(`🎯 Server target IDs:`, Array.from(gameState.targets.keys()));
    
    socket.emit('gameState', {
        players: Object.values(gameState.players).map(p => p.toNetworkData()),
        targets: finalTargetsArray,
        gameTime: gameState.gameTime,
        yourId: socket.id
    });

    // Notify other players about new player
    socket.broadcast.emit('playerJoined', player.toNetworkData());

    // Handle player input
    socket.on('playerInput', (inputData) => {
        const player = gameState.players[socket.id];
        if (player) {
            player.update(inputData);
        }
    });

    // Handle shooting
    socket.on('playerShoot', (shootData) => {
        console.log(`Player ${socket.id} shot at:`, shootData.position);
        
        // Broadcast shooting event to all other players
        socket.broadcast.emit('playerShot', {
            playerId: socket.id,
            position: shootData.position,
            direction: shootData.direction,
            timestamp: Date.now()
        });
    });

    // Handle target hit
    socket.on('targetHit', (hitData) => {
        // Convert targetId to string for consistent lookup
        const targetId = hitData.targetId.toString();
        const target = gameState.targets.get(targetId);
        
        if (!target || !target.isAlive) {
            console.log(`Target ${targetId} not found or already dead. Available targets:`, Array.from(gameState.targets.keys()));
            return;
        }

        const damage = hitData.damage || 25;
        const wasDestroyed = target.takeDamage(damage);

        console.log(`Player ${socket.id} hit target ${targetId} for ${damage} damage. Health: ${target.health}/${target.maxHealth}`);

        if (wasDestroyed) {
            // Target destroyed
            console.log(`Target ${targetId} destroyed by player ${socket.id}`);
            
            // Broadcast target destruction to all clients
            io.emit('targetDestroyed', {
                targetId: targetId, // Already a string
                playerId: socket.id,
                points: target.points,
                timestamp: Date.now()
            });

            // Remove target from server state
            gameState.targets.delete(targetId);

            // Spawn a new target after a delay
            setTimeout(() => {
                spawnNewTarget();
            }, 2000 + Math.random() * 3000);

        } else {
            // Target hit but not destroyed
            // Broadcast hit event to all clients for visual feedback
            io.emit('targetHit', {
                targetId: targetId, // Already a string
                playerId: socket.id,
                damage: damage,
                health: target.health,
                maxHealth: target.maxHealth,
                hitPoint: hitData.hitPoint,
                timestamp: Date.now()
            });
        }
    });

    // Handle player disconnect
    socket.on('disconnect', () => {
        console.log(`Player ${socket.id} disconnected`);
        delete gameState.players[socket.id];
        
        // Notify other players
        socket.broadcast.emit('playerLeft', socket.id);
    });

    // Handle debug info from clients
    socket.on('debugInfo', (debugData) => {
        console.log(`🔧 DEBUG from player ${socket.id}: ${debugData.message}`);
    });
    
    // Handle manual target spawn requests for debugging
    socket.on('debugSpawnTarget', (data) => {
        console.log(`🔧 DEBUG: Manual target spawn requested by player ${socket.id}`);
        spawnNewTarget();
        console.log(`🔧 DEBUG: Manual target spawned. Total targets: ${gameState.targets.size}`);
    });
});

// Periodic check to ensure targets always exist
setInterval(() => {
    if (gameState.targets.size === 0) {
        console.log('⚠️ Server has no targets! Respawning initial targets...');
        spawnInitialTargets();
    }
}, 30000); // Check every 30 seconds

// Game loop - send updates to all clients
setInterval(() => {
    gameState.gameTime += TICK_INTERVAL;
    
    // Send game state to all connected clients
    const networkData = {
        players: Object.values(gameState.players).map(p => p.toNetworkData()),
        gameTime: gameState.gameTime
    };
    
    io.emit('gameUpdate', networkData);
}, TICK_INTERVAL);

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Game server started - visit http://localhost:${PORT} to play`);
    
    // Initialize targets after server starts
    spawnInitialTargets();
    console.log(`Spawned ${gameState.targets.size} initial targets`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
