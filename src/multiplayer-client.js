import * as THREE from 'three';

// Global multiplayer manager
window.multiplayerManager = null;

export class MultiplayerManager {
    constructor(scene, camera, player, weapon, targetManager) {
        this.scene = scene;
        this.camera = camera;
        this.player = player;
        this.weapon = weapon;
        this.targetManager = targetManager;
        
        // Socket.IO connection
        this.socket = null;
        this.connected = false;
        
        // Game state
        this.playerId = null;
        this.players = new Map();
        this.playerMeshes = new Map();
        this.remoteTargets = new Map();
        this.scores = new Map();
        
        // Network update rate
        this.updateRate = 50; // ms
        this.lastUpdate = 0;
        
        // Chat
        this.chatOpen = false;
        this.chatMessages = [];
        
        // Death/respawn
        this.isDead = false;
        this.respawnTimer = 0;
        
        this.init();
    }
    
    init() {
        // Connect to server
        this.socket = io(window.location.origin);
        
        // Connection status
        this.socket.on('connect', () => {
            this.connected = true;
            this.updateConnectionStatus('Connected', true);
            console.log('Connected to server');
        });
        
        this.socket.on('disconnect', () => {
            this.connected = false;
            this.updateConnectionStatus('Disconnected', false);
            console.log('Disconnected from server');
        });
        
        // Initialize game
        this.socket.on('init', (data) => {
            this.playerId = data.playerId;
            console.log('Initialized with player ID:', this.playerId);
            
            // Set initial player data
            if (data.player) {
                this.player.yawObject.position.copy(data.player.position);
            }
            
            // Add existing players
            data.players.forEach(playerData => {
                this.addPlayer(playerData);
            });
            
            // Sync targets
            data.targets.forEach(targetData => {
                this.syncTarget(targetData);
            });
            
            // Update scores
            this.scores = new Map(Object.entries(data.scores));
            this.updateScoreboard();
        });
        
        // Player events
        this.socket.on('playerJoined', (playerData) => {
            this.addPlayer(playerData);
            this.showNotification(`${playerData.username} joined the game`);
        });
        
        this.socket.on('playerLeft', (playerId) => {
            this.removePlayer(playerId);
            this.showNotification(`Player left the game`);
        });
        
        this.socket.on('playerMoved', (data) => {
            this.updatePlayer(data);
        });
        
        // Combat events
        this.socket.on('bulletFired', (data) => {
            if (data.playerId !== this.playerId) {
                this.createRemoteBullet(data.bullet);
            }
            
            // Update ammo display if it's our bullet
            if (data.playerId === this.playerId && this.weapon) {
                this.weapon.magAmmo = data.ammo;
                this.weapon.totalAmmo = data.totalAmmo;
                if (this.weapon.onAmmoChange) {
                    this.weapon.onAmmoChange(data.ammo, data.totalAmmo);
                }
            }
        });
        
        this.socket.on('reloaded', (data) => {
            if (this.weapon) {
                this.weapon.magAmmo = data.ammo;
                this.weapon.totalAmmo = data.totalAmmo;
                if (this.weapon.onAmmoChange) {
                    this.weapon.onAmmoChange(data.ammo, data.totalAmmo);
                }
            }
        });
        
        this.socket.on('targetDamaged', (data) => {
            const target = this.targetManager.targets.find(t => t.userData.id === data.targetId);
            if (target) {
                target.userData.health = data.health;
                this.targetManager.showHitEffect(target);
            }
        });
        
        this.socket.on('targetDestroyed', (data) => {
            const target = this.targetManager.targets.find(t => t.userData.id === data.targetId);
            if (target) {
                this.targetManager.destroyTarget(target);
            }
            this.scores = new Map(Object.entries(data.scores));
            this.updateScoreboard();
        });
        
        this.socket.on('targetRespawned', (data) => {
            this.syncTarget(data.target);
        });
        
        this.socket.on('targetsUpdate', (targets) => {
            // Update target positions/rotations
            targets.forEach(targetData => {
                const target = this.targetManager.targets.find(t => t.userData.id === targetData.id);
                if (target && targetData.isAlive) {
                    target.position.copy(targetData.position);
                    target.rotation.y = targetData.rotation.y;
                }
            });
        });
        
        // Player combat
        this.socket.on('playerDamaged', (data) => {
            if (data.playerId === this.playerId) {
                // Update our health
                const healthElement = document.getElementById('health');
                healthElement.textContent = `Health: ${data.health}`;
                
                // Flash screen red
                this.flashScreen('#ff0000', 0.3);
            } else {
                // Update other player's health bar
                const playerData = this.players.get(data.playerId);
                if (playerData) {
                    playerData.health = data.health;
                }
            }
        });
        
        this.socket.on('playerKilled', (data) => {
            if (data.killedPlayerId === this.playerId) {
                this.onDeath(data.killerPlayerId);
            }
            this.scores = new Map(Object.entries(data.scores));
            this.updateScoreboard();
        });
        
        this.socket.on('respawn', (data) => {
            this.player.yawObject.position.copy(data.position);
            this.isDead = false;
            const healthElement = document.getElementById('health');
            healthElement.textContent = `Health: ${data.health}`;
            document.getElementById('deathScreen').classList.remove('active');
        });
        
        this.socket.on('playerRespawned', (data) => {
            const playerMesh = this.playerMeshes.get(data.playerId);
            if (playerMesh) {
                playerMesh.position.copy(data.position);
            }
        });
        
        // Chat
        this.socket.on('chatMessage', (data) => {
            this.addChatMessage(data.username, data.message);
        });
        
        // Set up input handlers
        this.setupInputHandlers();
        
        // Start update loop
        this.startUpdateLoop();
    }
    
    setupInputHandlers() {
        // Override weapon shoot to notify server
        if (this.weapon) {
            const originalShoot = this.weapon.shoot.bind(this.weapon);
            this.weapon.shoot = () => {
                const result = originalShoot();
                if (result) {
                    this.socket.emit('shoot', {
                        position: this.weapon.getGunMuzzlePosition(),
                        direction: (() => {
                            const dir = new THREE.Vector3();
                            this.camera.getWorldDirection(dir);
                            return dir;
                        })()
                    });
                }
                return result;
            };
            
            // Override reload
            const originalReload = this.weapon.reload.bind(this.weapon);
            this.weapon.reload = () => {
                this.socket.emit('reload');
                // Don't apply locally, wait for server response
            };
        }
        
        // Override target hit detection
        if (this.targetManager) {
            const originalOnHit = this.targetManager.onTargetHit.bind(this.targetManager);
            this.targetManager.onTargetHit = (target, hitInfo) => {
                this.socket.emit('targetHit', {
                    targetId: target.userData.id,
                    damage: 25
                });
                // Don't apply damage locally, wait for server
            };
        }
        
        // Chat input
        document.addEventListener('keydown', (e) => {
            if (e.code === 'KeyT' && !this.chatOpen && this.player.isLocked) {
                e.preventDefault();
                this.openChat();
            } else if (e.code === 'Tab') {
                e.preventDefault();
                this.toggleScoreboard(true);
            } else if (e.code === 'Escape' && this.chatOpen) {
                this.closeChat();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            if (e.code === 'Tab') {
                e.preventDefault();
                this.toggleScoreboard(false);
            }
        });
        
        const chatInput = document.getElementById('chatInput');
        chatInput.addEventListener('keydown', (e) => {
            if (e.code === 'Enter') {
                const message = chatInput.value.trim();
                if (message) {
                    this.socket.emit('chatMessage', message);
                    chatInput.value = '';
                }
                this.closeChat();
            }
        });
    }
    
    startUpdateLoop() {
        setInterval(() => {
            if (this.connected && this.player.isLocked && !this.isDead) {
                const now = Date.now();
                if (now - this.lastUpdate > this.updateRate) {
                    this.sendPlayerUpdate();
                    this.lastUpdate = now;
                }
            }
        }, 16); // 60fps check
    }
    
    sendPlayerUpdate() {
        const position = this.player.yawObject.position;
        const rotation = {
            x: this.player.pitch,
            y: this.player.yaw,
            z: 0
        };
        
        this.socket.emit('playerMove', {
            position: { x: position.x, y: position.y, z: position.z },
            rotation: rotation,
            velocity: { 
                x: this.player.velocity.x, 
                y: this.player.velocity.y, 
                z: this.player.velocity.z 
            },
            isRunning: this.player.isRunning,
            isCrouching: this.player.isCrouching,
            isJumping: !this.player.canJump
        });
    }
    
    addPlayer(playerData) {
        if (playerData.id === this.playerId) return;
        
        this.players.set(playerData.id, playerData);
        
        // Create player mesh
        const playerGroup = new THREE.Group();
        
        // Body
        const bodyGeometry = new THREE.CapsuleGeometry(0.3, 1.2, 4, 8);
        const bodyMaterial = new THREE.MeshLambertMaterial({ 
            color: playerData.color || 0x00ff00 
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.9;
        body.castShadow = true;
        body.receiveShadow = true;
        playerGroup.add(body);
        
        // Head
        const headGeometry = new THREE.SphereGeometry(0.2, 12, 8);
        const headMaterial = new THREE.MeshLambertMaterial({ 
            color: playerData.color || 0x00ff00 
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 1.8;
        head.castShadow = true;
        head.receiveShadow = true;
        playerGroup.add(head);
        
        // Weapon placeholder
        const weaponGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.8);
        const weaponMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
        const weapon = new THREE.Mesh(weaponGeometry, weaponMaterial);
        weapon.position.set(0.3, 1.2, -0.4);
        playerGroup.add(weapon);
        
        playerGroup.position.copy(playerData.position);
        
        // Store for collision detection
        playerGroup.userData.isPlayer = true;
        playerGroup.userData.playerId = playerData.id;
        
        this.scene.add(playerGroup);
        this.playerMeshes.set(playerData.id, playerGroup);
        
        // Update player count
        this.updatePlayerCount();
    }
    
    removePlayer(playerId) {
        this.players.delete(playerId);
        
        const playerMesh = this.playerMeshes.get(playerId);
        if (playerMesh) {
            this.scene.remove(playerMesh);
            this.playerMeshes.delete(playerId);
        }
        
        this.updatePlayerCount();
    }
    
    updatePlayer(data) {
        const playerData = this.players.get(data.playerId);
        const playerMesh = this.playerMeshes.get(data.playerId);
        
        if (playerData && playerMesh) {
            // Update data
            Object.assign(playerData, data);
            
            // Smooth position interpolation
            playerMesh.position.lerp(data.position, 0.3);
            
            // Update rotation
            playerMesh.rotation.y = data.rotation.y;
            
            // Crouch animation
            const body = playerMesh.children[0];
            if (body) {
                const targetScale = data.isCrouching ? 0.6 : 1.0;
                body.scale.y = THREE.MathUtils.lerp(body.scale.y, targetScale, 0.2);
            }
            
            // Jumping animation
            if (data.isJumping) {
                // Could add jump effects here
            }
        }
    }
    
    createRemoteBullet(bulletData) {
        // Create visual bullet for other players' shots
        const bullet = new THREE.Mesh(
            new THREE.SphereGeometry(0.05),
            new THREE.MeshBasicMaterial({ 
                color: 0xffff00,
                emissive: 0xffff00,
                emissiveIntensity: 0.5
            })
        );
        
        bullet.position.copy(bulletData.position);
        this.scene.add(bullet);
        
        // Animate bullet
        const velocity = new THREE.Vector3(
            bulletData.direction.x * bulletData.speed,
            bulletData.direction.y * bulletData.speed,
            bulletData.direction.z * bulletData.speed
        );
        
        const animateBullet = () => {
            bullet.position.add(velocity.clone().multiplyScalar(0.016));
            
            // Remove after 3 seconds
            if (Date.now() - bulletData.timestamp > 3000) {
                this.scene.remove(bullet);
                return;
            }
            
            requestAnimationFrame(animateBullet);
        };
        
        animateBullet();
    }
    
    syncTarget(targetData) {
        // Find existing target or create new one
        let target = this.targetManager.targets.find(t => t.userData.id === targetData.id);
        
        if (!target && targetData.isAlive) {
            // Create new target
            target = this.targetManager.createTarget(
                new THREE.Vector3(targetData.position.x, targetData.position.y, targetData.position.z),
                {
                    scale: targetData.scale,
                    health: targetData.health,
                    points: targetData.points
                }
            );
            if (target) {
                target.userData.id = targetData.id;
            }
        } else if (target) {
            // Update existing target
            target.position.copy(targetData.position);
            target.rotation.y = targetData.rotation.y;
            target.userData.health = targetData.health;
            target.userData.isAlive = targetData.isAlive;
            
            if (!targetData.isAlive) {
                // Remove dead target
                const index = this.targetManager.targets.indexOf(target);
                if (index > -1) {
                    this.targetManager.targets.splice(index, 1);
                }
                this.scene.remove(target);
            }
        }
    }
    
    onDeath(killerPlayerId) {
        this.isDead = true;
        
        // Show death screen
        const deathScreen = document.getElementById('deathScreen');
        const killedBy = document.getElementById('killedBy');
        const killer = this.players.get(killerPlayerId);
        
        killedBy.textContent = killer ? `Killed by ${killer.username}` : 'Killed';
        deathScreen.classList.add('active');
        
        // Respawn countdown
        let countdown = 5;
        const respawnTimer = document.getElementById('respawnTimer');
        
        const countdownInterval = setInterval(() => {
            countdown--;
            respawnTimer.textContent = `Respawning in ${countdown}`;
            
            if (countdown <= 0) {
                clearInterval(countdownInterval);
            }
        }, 1000);
    }
    
    flashScreen(color, duration) {
        const flash = document.createElement('div');
        flash.style.position = 'fixed';
        flash.style.top = '0';
        flash.style.left = '0';
        flash.style.width = '100vw';
        flash.style.height = '100vh';
        flash.style.backgroundColor = color;
        flash.style.opacity = '0.3';
        flash.style.pointerEvents = 'none';
        flash.style.zIndex = '900';
        document.body.appendChild(flash);
        
        setTimeout(() => {
            flash.remove();
        }, duration * 1000);
    }
    
    openChat() {
        this.chatOpen = true;
        const chat = document.getElementById('chat');
        const chatInput = document.getElementById('chatInput');
        
        chat.classList.add('active');
        this.player.exitPointerLock();
        
        setTimeout(() => {
            chatInput.focus();
        }, 100);
    }
    
    closeChat() {
        this.chatOpen = false;
        const chat = document.getElementById('chat');
        const chatInput = document.getElementById('chatInput');
        
        chat.classList.remove('active');
        chatInput.blur();
        
        // Re-enable pointer lock after a delay
        setTimeout(() => {
            if (!this.isDead) {
                this.player.requestPointerLock();
            }
        }, 100);
    }
    
    addChatMessage(username, message) {
        const chatMessages = document.getElementById('chatMessages');
        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message';
        messageElement.innerHTML = `<span class="chat-username">${username}:</span> ${message}`;
        
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Remove old messages
        while (chatMessages.children.length > 50) {
            chatMessages.removeChild(chatMessages.firstChild);
        }
    }
    
    toggleScoreboard(show) {
        const scoreboard = document.getElementById('scoreboard');
        if (show) {
            scoreboard.classList.add('active');
        } else {
            scoreboard.classList.remove('active');
        }
    }
    
    updateScoreboard() {
        const scoreList = document.getElementById('scoreList');
        scoreList.innerHTML = '';
        
        // Sort players by score
        const sortedScores = Array.from(this.scores.entries())
            .sort((a, b) => b[1] - a[1]);
        
        sortedScores.forEach(([playerId, score]) => {
            const scoreElement = document.createElement('div');
            scoreElement.className = 'player-score';
            
            if (playerId === this.playerId) {
                scoreElement.classList.add('current-player');
            }
            
            let playerName = 'Unknown';
            if (playerId === this.playerId) {
                playerName = 'You';
            } else {
                const player = this.players.get(playerId);
                if (player) {
                    playerName = player.username;
                }
            }
            
            scoreElement.innerHTML = `
                <span>${playerName}</span>
                <span>${score}</span>
            `;
            
            scoreList.appendChild(scoreElement);
        });
        
        // Update score in HUD
        const myScore = this.scores.get(this.playerId) || 0;
        const scoreElement = document.getElementById('score');
        if (scoreElement) {
            scoreElement.textContent = `Score: ${myScore}`;
        }
    }
    
    updatePlayerCount() {
        const playerCount = this.players.size + 1; // +1 for self
        const playersElement = document.getElementById('players');
        if (playersElement) {
            playersElement.textContent = `Players: ${playerCount}`;
        }
    }
    
    updateConnectionStatus(status, connected) {
        const statusElement = document.getElementById('connectionStatus');
        statusElement.textContent = status;
        statusElement.className = connected ? 'connected' : 'disconnected';
    }
    
    showNotification(message) {
        // Could implement a notification system
        console.log('Notification:', message);
    }
    
    checkPlayerCollisions(bulletObj) {
        // Check if bullet hits any player
        this.playerMeshes.forEach((playerMesh, playerId) => {
            const distance = bulletObj.mesh.position.distanceTo(playerMesh.position);
            if (distance < 1.0) { // Hit radius
                this.socket.emit('playerHit', {
                    targetPlayerId: playerId,
                    damage: 25
                });
                
                // Remove bullet
                return true;
            }
        });
        return false;
    }
}

// Export for use in scene.js
window.MultiplayerManager = MultiplayerManager;