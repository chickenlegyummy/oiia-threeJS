import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Client-side networking for multiplayer
export class NetworkManager {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.playerId = null;
        this.otherPlayers = new Map();
        this.lastSentUpdate = 0;
        this.updateRate = 1000 / 20; // Send updates 20 times per second
        
        // Callbacks
        this.onPlayerJoined = null;
        this.onPlayerLeft = null;
        this.onPlayerUpdate = null;
        this.onPlayerShot = null;
        this.onTargetDestroyed = null;
        this.onGameStateReceived = null;
        this.onConnectionChange = null;
    }

    connect() {
        // Connect to server (adapt to current location)
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host || 'localhost:3000';
        
        console.log('Connecting to server at:', window.location.origin);
        this.socket = io(); // Connect to same origin

        this.socket.on('connect', () => {
            console.log('🟢 Connected to server');
            this.isConnected = true;
            if (this.onConnectionChange) {
                this.onConnectionChange(true);
            }
        });

        this.socket.on('disconnect', (reason) => {
            console.log('🔴 Disconnected from server:', reason);
            this.isConnected = false;
            if (this.onConnectionChange) {
                this.onConnectionChange(false);
            }
        });

        this.socket.on('connect_error', (error) => {
            console.error('❌ Connection error:', error);
        });

        // Handle initial game state
        this.socket.on('gameState', (gameState) => {
            console.log('📦 Received initial game state:', gameState);
            this.playerId = gameState.yourId;
            
            // Set up other players
            gameState.players.forEach(playerData => {
                if (playerData.id !== this.playerId) {
                    console.log('👤 Adding existing player:', playerData.id);
                    this.otherPlayers.set(playerData.id, playerData);
                }
            });

            if (this.onGameStateReceived) {
                this.onGameStateReceived(gameState);
            }
        });

        // Handle game updates
        this.socket.on('gameUpdate', (gameData) => {
            // console.log('🔄 Game update received, players:', gameData.players.length);
            gameData.players.forEach(playerData => {
                if (playerData.id !== this.playerId) {
                    this.otherPlayers.set(playerData.id, playerData);
                }
            });

            if (this.onPlayerUpdate) {
                this.onPlayerUpdate(this.otherPlayers);
            }
        });

        // Handle new player joining
        this.socket.on('playerJoined', (playerData) => {
            console.log('🎉 Player joined:', playerData.id);
            this.otherPlayers.set(playerData.id, playerData);
            
            if (this.onPlayerJoined) {
                this.onPlayerJoined(playerData);
            }
        });

        // Handle player leaving
        this.socket.on('playerLeft', (playerId) => {
            console.log('👋 Player left:', playerId);
            this.otherPlayers.delete(playerId);
            
            if (this.onPlayerLeft) {
                this.onPlayerLeft(playerId);
            }
        });

        // Handle player shooting
        this.socket.on('playerShot', (shotData) => {
            if (this.onPlayerShot) {
                this.onPlayerShot(shotData);
            }
        });

        // Handle target destruction
        this.socket.on('targetDestroyed', (destroyData) => {
            if (this.onTargetDestroyed) {
                this.onTargetDestroyed(destroyData);
            }
        });
    }

    sendPlayerInput(inputData) {
        if (!this.isConnected || !this.socket) return;

        const now = Date.now();
        if (now - this.lastSentUpdate >= this.updateRate) {
            this.socket.emit('playerInput', inputData);
            this.lastSentUpdate = now;
            // Uncomment for debugging: console.log('📤 Sent player input');
        }
    }

    sendPlayerShoot(shootData) {
        if (!this.isConnected || !this.socket) return;
        
        this.socket.emit('playerShoot', shootData);
    }

    sendTargetHit(hitData) {
        if (!this.isConnected || !this.socket) return;
        
        this.socket.emit('targetHit', hitData);
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

// Other player representation in the game world
export class RemotePlayer {
    constructor(scene, playerData) {
        this.id = playerData.id;
        this.scene = scene;
        this.loader = new GLTFLoader();
        this.weapon = null;
        this.activeBullets = [];
        
        console.log('🔧 Creating RemotePlayer with data:', playerData);
        
        // Create visual representation
        try {
            this.createPlayerMesh();
            this.loadWeaponModel();
            console.log('✅ RemotePlayer mesh created successfully for:', this.id);
        } catch (error) {
            console.error('❌ Error creating RemotePlayer mesh:', error);
            return;
        }
        
        // Network state
        this.networkPosition = new THREE.Vector3(
            playerData.position.x,
            playerData.position.y,
            playerData.position.z
        );
        this.networkRotation = new THREE.Euler(
            playerData.rotation.x,
            playerData.rotation.y,
            0
        );
        
        // Interpolation for smooth movement
        this.targetPosition = this.networkPosition.clone();
        this.targetRotation = this.networkRotation.clone();
        
        // Visual state
        this.isMoving = playerData.isMoving || false;
        this.isCrouching = playerData.isCrouching || false;
        this.isRunning = playerData.isRunning || false;
    }

    createPlayerMesh() {
        // Create a simple player representation using basic geometries
        // CapsuleGeometry was added in later versions, so we'll use a combination of cylinder + spheres
        
        // Generate a random color for this player
        const colors = [0x4ecdc4, 0xff6b6b, 0xf9ca24, 0x6c5ce7, 0xa29bfe, 0xfd79a8, 0x00b894, 0xe84393];
        const playerColor = colors[Math.floor(Math.random() * colors.length)];
        
        // Main body (cylinder)
        const bodyGeometry = new THREE.CylinderGeometry(0.3, 0.3, 1.4, 8);
        const bodyMaterial = new THREE.MeshLambertMaterial({ 
            color: playerColor,
            transparent: true,
            opacity: 0.9
        });
        this.mesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        
        // Head (sphere)
        const headGeometry = new THREE.SphereGeometry(0.25, 8, 8);
        const headMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xffffff,
            transparent: true,
            opacity: 0.9
        });
        this.head = new THREE.Mesh(headGeometry, headMaterial);
        this.head.position.set(0, 0.95, 0);
        this.mesh.add(this.head);
        
        // Add a glowing outline effect
        const outlineGeometry = new THREE.CylinderGeometry(0.35, 0.35, 1.5, 8);
        const outlineMaterial = new THREE.MeshBasicMaterial({
            color: playerColor,
            transparent: true,
            opacity: 0.3,
            side: THREE.BackSide
        });
        this.outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
        this.mesh.add(this.outline);
        
        // Add name tag (optional)
        this.createNameTag();
        
        console.log('🎨 Remote player mesh created with color:', playerColor.toString(16));
        this.scene.add(this.mesh);
    }

    createNameTag() {
        // Simple name tag - you can enhance this with actual text rendering
        const nameGeometry = new THREE.PlaneGeometry(1, 0.2);
        const nameMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffffff, 
            transparent: true, 
            opacity: 0.8 
        });
        this.nameTag = new THREE.Mesh(nameGeometry, nameMaterial);
        this.nameTag.position.set(0, 2.2, 0);
        this.mesh.add(this.nameTag);
    }

    // Load weapon model for remote player
    async loadWeaponModel() {
        try {
            const gltf = await this.loader.loadAsync('models/ak47.glb');
            this.weapon = gltf.scene;
            
            // Scale and position the weapon
            this.weapon.scale.set(0.8, 0.8, 0.8);
            this.weapon.position.set(0.3, 0.2, 0.4);
            this.weapon.rotation.set(0, Math.PI / 2, 0);
            
            // Attach weapon to player
            if (this.mesh) {
                this.mesh.add(this.weapon);
                console.log('🔫 Weapon loaded for remote player:', this.id);
            }
        } catch (error) {
            console.warn('⚠️ Could not load weapon for remote player:', error);
            // Create a simple weapon placeholder
            this.createSimpleWeapon();
        }
    }

    createSimpleWeapon() {
        // Create a simple weapon representation if model fails to load
        const weaponGroup = new THREE.Group();
        
        // Main body
        const bodyGeometry = new THREE.BoxGeometry(0.8, 0.1, 0.1);
        const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        weaponGroup.add(body);
        
        // Barrel
        const barrelGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8);
        const barrelMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 });
        const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
        barrel.rotation.z = Math.PI / 2;
        barrel.position.set(0.4, 0, 0);
        weaponGroup.add(barrel);
        
        // Position the weapon
        weaponGroup.position.set(0.3, 0.2, 0.4);
        weaponGroup.rotation.set(0, Math.PI / 2, 0);
        
        this.weapon = weaponGroup;
        if (this.mesh) {
            this.mesh.add(this.weapon);
        }
    }

    // Create bullet trail for remote player
    createBulletTrail(startPos, direction) {
        const bulletGeometry = new THREE.SphereGeometry(0.02, 4, 4);
        const bulletMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffff00,
            transparent: true,
            opacity: 0.8
        });
        
        const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
        bullet.position.copy(startPos);
        
        // Add trail effect
        const trailGeometry = new THREE.CylinderGeometry(0.005, 0.02, 0.5, 4);
        const trailMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.6
        });
        const trail = new THREE.Mesh(trailGeometry, trailMaterial);
        trail.position.set(0, -0.25, 0);
        bullet.add(trail);
        
        this.scene.add(bullet);
        
        // Animate bullet
        const speed = 50;
        const velocity = direction.clone().multiplyScalar(speed);
        let time = 0;
        const maxTime = 2; // 2 seconds max
        
        const animateBullet = () => {
            time += 0.016;
            
            if (time > maxTime) {
                this.scene.remove(bullet);
                bullet.geometry.dispose();
                bullet.material.dispose();
                trail.geometry.dispose();
                trail.material.dispose();
                return;
            }
            
            bullet.position.add(velocity.clone().multiplyScalar(0.016));
            bullet.lookAt(bullet.position.clone().add(velocity));
            
            // Fade out over time
            const fadeProgress = time / maxTime;
            bullet.material.opacity = Math.max(0, 0.8 * (1 - fadeProgress));
            trail.material.opacity = Math.max(0, 0.6 * (1 - fadeProgress));
            
            requestAnimationFrame(animateBullet);
        };
        
        animateBullet();
    }

    // Handle shooting event from this remote player
    onShoot(shootData) {
        console.log('💥 Remote player', this.id, 'shot!');
        
        // Create muzzle flash effect
        if (this.weapon) {
            this.createMuzzleFlash();
        }
        
        // Create bullet trail
        const startPos = new THREE.Vector3(
            shootData.position.x,
            shootData.position.y,
            shootData.position.z
        );
        const direction = new THREE.Vector3(
            shootData.direction.x,
            shootData.direction.y,
            shootData.direction.z
        ).normalize();
        
        this.createBulletTrail(startPos, direction);
    }

    createMuzzleFlash() {
        if (!this.weapon) return;
        
        // Create muzzle flash effect
        const flashGeometry = new THREE.PlaneGeometry(0.3, 0.3);
        const flashMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        
        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        flash.position.set(0.5, 0, 0); // Position at weapon muzzle
        
        this.weapon.add(flash);
        
        // Animate flash
        let flashTime = 0;
        const flashDuration = 0.1;
        
        const animateFlash = () => {
            flashTime += 0.016;
            
            if (flashTime > flashDuration) {
                this.weapon.remove(flash);
                flash.geometry.dispose();
                flash.material.dispose();
                return;
            }
            
            flash.material.opacity = Math.max(0, 0.8 * (1 - flashTime / flashDuration));
            flash.rotation.z = Math.random() * Math.PI * 2;
            
            requestAnimationFrame(animateFlash);
        };
        
        animateFlash();
    }

    updateFromNetwork(playerData) {
        // Update target position and rotation for interpolation
        this.targetPosition.set(
            playerData.position.x,
            playerData.position.y,
            playerData.position.z
        );
        
        this.targetRotation.set(
            playerData.rotation.x,
            playerData.rotation.y,
            0
        );
        
        // Update state flags
        this.isMoving = playerData.isMoving || false;
        this.isCrouching = playerData.isCrouching || false;
        this.isRunning = playerData.isRunning || false;
        
        // Adjust height based on crouching
        const targetHeight = this.isCrouching ? 0.8 : 1.6;
        if (this.mesh) {
            this.mesh.scale.y = targetHeight / 1.6;
        }
        
        // Debug: log position occasionally
        if (Math.random() < 0.01) { // 1% chance to log
            console.log(`🎯 Remote player ${this.id} at:`, this.targetPosition);
        }
    }

    update(deltaTime) {
        if (!this.mesh) return;
        
        // Interpolate position
        this.mesh.position.lerp(this.targetPosition, deltaTime * 10);
        
        // Interpolate rotation (only Y axis for looking around)
        this.mesh.rotation.y = THREE.MathUtils.lerp(
            this.mesh.rotation.y,
            this.targetRotation.y,
            deltaTime * 10
        );
        
        // Update weapon rotation to match player looking direction
        if (this.weapon) {
            // Make weapon follow player's pitch (up/down look)
            this.weapon.rotation.x = THREE.MathUtils.lerp(
                this.weapon.rotation.x,
                this.targetRotation.x * 0.5, // Dampen the pitch movement
                deltaTime * 8
            );
        }
        
        // Make name tag always face the camera
        if (this.nameTag && window.gamePlayer && window.gamePlayer.camera) {
            this.nameTag.lookAt(window.gamePlayer.camera.position);
        }
    }

    destroy() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            
            // Clean up weapon
            if (this.weapon) {
                this.weapon.traverse((child) => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(material => material.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                });
            }
            
            this.mesh = null;
        }
    }
}
