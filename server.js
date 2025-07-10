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
    targets: [],
    gameTime: 0
};

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
    socket.emit('gameState', {
        players: Object.values(gameState.players).map(p => p.toNetworkData()),
        targets: gameState.targets,
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
        // Broadcast target hit to all players for score sync
        io.emit('targetDestroyed', {
            targetId: hitData.targetId,
            playerId: socket.id,
            timestamp: Date.now()
        });
    });

    // Handle player disconnect
    socket.on('disconnect', () => {
        console.log(`Player ${socket.id} disconnected`);
        delete gameState.players[socket.id];
        
        // Notify other players
        socket.broadcast.emit('playerLeft', socket.id);
    });
});

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
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
