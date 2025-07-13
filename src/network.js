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
        
        // Shared ammo model for all remote players
        this.ammoModel = null;
        this.ammoModelLoaded = false;
        this.ammoModelPromise = null;
        
        // Initialize ammo model loading
        this.initializeAmmoModel();
        
        // Callbacks
        this.onPlayerJoined = null;
        this.onPlayerLeft = null;
        this.onPlayerUpdate = null;
        this.onPlayerShot = null;
        this.onTargetHit = null;
        this.onTargetDestroyed = null;
        this.onTargetSpawned = null;
        this.onGameStateReceived = null;
        this.onConnectionChange = null;
    }

    async initializeAmmoModel() {
        console.log('🔫 Starting ammo model initialization...');
        this.ammoModelPromise = this.loadAmmoModel();
        await this.ammoModelPromise;
        console.log('🔫 Ammo model initialization complete');
    }

    async getAmmoModel() {
        // Wait for ammo model to be loaded if it's not ready yet
        if (!this.ammoModelLoaded && this.ammoModelPromise) {
            await this.ammoModelPromise;
        }
        return this.ammoModel;
    }

    async loadAmmoModel() {
        const loader = new GLTFLoader();
        
        try {
            const gltf = await new Promise((resolve, reject) => {
                loader.load(
                    'models/ammo.glb',
                    resolve,
                    undefined,
                    reject
                );
            });
            
            this.ammoModel = gltf.scene.clone();
            this.ammoModelLoaded = true;
            console.log('🔫 Ammo model loaded successfully for remote players');
        } catch (error) {
            console.warn('⚠️ Could not load ammo GLB model for remote players, using fallback:', error);
            this.createFallbackAmmoModel();
            this.ammoModelLoaded = true;
        }
    }

    createFallbackAmmoModel() {
        // Create simple bullet shape as fallback
        const bulletGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.2);
        const bulletMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffff00,
            transparent: true,
            opacity: 0.8
        });
        
        this.ammoModel = new THREE.Mesh(bulletGeometry, bulletMaterial);
        this.ammoModelLoaded = true;
        console.log('🔫 Created fallback ammo model for remote players');
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
            if (gameData.players.length > 1) { // Only log when there are multiple players
                console.log('🔄 Game update received, players:', gameData.players.length);
                gameData.players.forEach(playerData => {
                    if (playerData.id !== this.playerId) {
                        console.log(`🔄 Update for player ${playerData.id}:`, {
                            position: playerData.position,
                            isMoving: playerData.isMoving
                        });
                    }
                });
            }
            
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
            console.log('🎉 Player joined event received:', playerData.id);
            console.log('🎉 Player data:', playerData);
            this.otherPlayers.set(playerData.id, playerData);
            
            if (this.onPlayerJoined) {
                console.log('🎉 Calling onPlayerJoined handler...');
                this.onPlayerJoined(playerData);
                console.log('🎉 onPlayerJoined handler completed');
            } else {
                console.error('❌ No onPlayerJoined handler registered!');
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

        // Handle target hits
        this.socket.on('targetHit', (hitData) => {
            if (this.onTargetHit) {
                this.onTargetHit(hitData);
            }
        });

        // Handle target destruction
        this.socket.on('targetDestroyed', (destroyData) => {
            if (this.onTargetDestroyed) {
                this.onTargetDestroyed(destroyData);
            }
        });

        // Handle new target spawning
        this.socket.on('targetSpawned', (targetData) => {
            console.log('🌐 NETWORK: Received targetSpawned event:', targetData);
            console.log('🌐 NETWORK: onTargetSpawned handler exists:', !!this.onTargetSpawned);
            
            if (this.onTargetSpawned) {
                console.log('🌐 NETWORK: Calling onTargetSpawned handler...');
                this.onTargetSpawned(targetData);
                console.log('🌐 NETWORK: onTargetSpawned handler called');
            } else {
                console.error('❌ NETWORK: No onTargetSpawned handler registered!');
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
    constructor(scene, playerData, networkManager = null) {
        this.id = playerData.id;
        this.scene = scene;
        this.loader = new GLTFLoader();
        this.weapon = null;
        this.activeBullets = [];
        this.networkManager = networkManager; // Store reference to NetworkManager
        this.ammoModel = null; // Will be set when available
        this.lastUpdateTime = Date.now(); // Track when we last received an update
        this.updateCount = 0; // Track total updates received
        this.createdTime = Date.now(); // Track when this remote player was created
        this.isStale = false; // Flag to mark if this player should be considered stale
        
        console.log('🔧 Creating RemotePlayer with data:', playerData);
        
        // Add warning if networkManager is not provided
        if (!networkManager) {
            console.warn('⚠️ RemotePlayer created without networkManager - bullet trails will not work for player:', this.id);
        } else {
            console.log('✅ RemotePlayer created with networkManager for player:', this.id);
        }
        
        // Initialize ammo model asynchronously
        this.initializeAmmoModel();
        
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
        
        // Set initial mesh position to match network position immediately to prevent slow interpolation from origin
        if (this.mesh) {
            this.mesh.position.copy(this.networkPosition);
            this.mesh.rotation.y = this.networkRotation.y;
            console.log('🎯 Set initial mesh position for remote player', this.id, 'to:', this.networkPosition);
        }
        
        // Visual state
        this.isMoving = playerData.isMoving || false;
        this.isCrouching = playerData.isCrouching || false;
        this.isRunning = playerData.isRunning || false;
    }

    async initializeAmmoModel() {
        if (this.networkManager) {
            console.log('🔫 Waiting for ammo model for remote player:', this.id);
            this.ammoModel = await this.networkManager.getAmmoModel();
            console.log('🔫 Ammo model ready for remote player:', this.id, this.ammoModel ? 'loaded' : 'fallback');
        } else {
            console.warn('⚠️ No NetworkManager reference, cannot get ammo model for:', this.id);
        }
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
        
        // Mark for debugging
        this.mesh.userData.isRemotePlayer = true;
        this.mesh.userData.playerId = this.id;
        this.mesh.name = `RemotePlayer_${this.id}`;
        
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
    async createBulletTrail(startPos, direction) {
        console.log('🎨 Creating bullet trail for remote player:', this.id);
        
        // Ensure ammo model is available
        if (!this.ammoModel && this.networkManager) {
            console.log('🔫 Waiting for ammo model to be ready for bullet trail...');
            this.ammoModel = await this.networkManager.getAmmoModel();
        }
        
        let bullet;
        
        if (this.ammoModel) {
            // Use the shared ammo.glb model (same as local player)
            bullet = this.ammoModel.clone();
            
            // Scale the ammo model appropriately for bullet size
            bullet.scale.set(5, 5, 5);
            
            // Ensure materials are visible and mark as bullet
            bullet.traverse((child) => {
                if (child.isMesh) {
                    if (child.material) {
                        child.material = child.material.clone(); // Clone material to avoid affecting original
                        child.material.transparent = true;
                        child.material.opacity = 0.9;
                    }
                    child.userData.isBullet = true;
                }
            });
            
            console.log('✅ Using ammo.glb model for remote player bullet');
        } else {
            // Fallback to simple geometry if ammo model is not available
            const bulletGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.2);
            const bulletMaterial = new THREE.MeshBasicMaterial({ 
                color: 0xffff00,
                transparent: true,
                opacity: 0.8
            });
            
            bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
            bullet.userData.isBullet = true;
            console.log('⚠️ Using fallback geometry for remote player bullet');
        }
        
        // Position bullet at start position
        bullet.position.copy(startPos);
        
        // Orient bullet in direction of travel
        if (this.ammoModel) {
            // For 3D models, use the same orientation logic as local player
            const axis = new THREE.Vector3(0, 1, 0);
            bullet.quaternion.setFromUnitVectors(axis, direction);
        } else {
            // For simple cylinder, orient along direction
            const axis = new THREE.Vector3(0, 1, 0);
            bullet.quaternion.setFromUnitVectors(axis, direction);
        }
        
        this.scene.add(bullet);
        console.log('✅ Remote player bullet added to scene at:', bullet.position);
        
        // Create bullet object with properties (same as local player)
        const bulletObj = {
            mesh: bullet,
            velocity: direction.clone().multiplyScalar(40), // Bullet speed
            life: 3.0, // Bullet lifetime
            startTime: performance.now()
        };
        
        this.activeBullets.push(bulletObj);
        
        // Animate bullet with physics-based movement
        this.animateBullet(bulletObj);
        
        return bulletObj;
    }
    
    // Animate bullet with same logic as local player
    animateBullet(bulletObj) {
        const animate = () => {
            const deltaTime = 0.016; // Approximate 60 FPS
            
            // Update position
            bulletObj.mesh.position.add(bulletObj.velocity.clone().multiplyScalar(deltaTime));
            
            // Add bullet rotation for visual effect (same as local player)
            bulletObj.mesh.rotation.y += deltaTime * 15; // Y-axis spinning
            
            // Update lifetime
            bulletObj.life -= deltaTime;
            
            // Fade out bullet over time
            const lifeFactor = bulletObj.life / 3.0;
            
            // Handle material opacity for both simple mesh and complex models
            if (this.ammoModel) {
                bulletObj.mesh.traverse((child) => {
                    if (child.isMesh && child.material) {
                        child.material.opacity = lifeFactor * 0.9;
                    }
                });
            } else {
                bulletObj.mesh.material.opacity = lifeFactor * 0.8;
            }
            
            // Remove expired bullets
            if (bulletObj.life <= 0) {
                this.scene.remove(bulletObj.mesh);
                
                // Clean up geometry and materials
                if (bulletObj.mesh.geometry) {
                    bulletObj.mesh.geometry.dispose();
                }
                if (bulletObj.mesh.material) {
                    if (Array.isArray(bulletObj.mesh.material)) {
                        bulletObj.mesh.material.forEach(mat => mat.dispose());
                    } else {
                        bulletObj.mesh.material.dispose();
                    }
                }
                
                // Remove from active bullets array
                const index = this.activeBullets.indexOf(bulletObj);
                if (index > -1) {
                    this.activeBullets.splice(index, 1);
                }
                
                console.log('🗑️ Remote player bullet cleaned up');
                return;
            }
            
            requestAnimationFrame(animate);
        };
        
        animate();
    }

    // Handle shooting event from this remote player
    async onShoot(shootData) {
        console.log('💥 Remote player', this.id, 'shot!');
        console.log('🎯 Shoot data:', shootData);
        
        // Check if we have the network manager for bullet trails
        if (!this.networkManager) {
            console.error('❌ Cannot create bullet trail - no networkManager reference for player:', this.id);
            return;
        }
        
        // Create muzzle flash effect
        if (this.weapon) {
            console.log('✨ Creating muzzle flash for remote player');
            this.createMuzzleFlash();
        } else {
            console.warn('⚠️ No weapon found for muzzle flash');
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
        
        console.log('🚀 Creating bullet trail from:', startPos, 'direction:', direction);
        
        try {
            await this.createBulletTrail(startPos, direction);
            console.log('✅ Bullet trail created successfully for remote player:', this.id);
        } catch (error) {
            console.error('❌ Error creating bullet trail for remote player:', this.id, error);
        }
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

    // Check if this remote player should be considered stale (no updates for too long)
    isPlayerStale() {
        const now = Date.now();
        const timeSinceLastUpdate = now - this.lastUpdateTime;
        const timeSinceCreated = now - this.createdTime;
        
        // Consider player stale if:
        // 1. No updates for more than 5 seconds AND player has been around for more than 3 seconds (faster cleanup)
        // 2. OR no updates for more than 15 seconds regardless of creation time (reduced from 30s)
        const isStaleFromInactivity = (timeSinceLastUpdate > 5000 && timeSinceCreated > 3000) || timeSinceLastUpdate > 15000;
        
        if (isStaleFromInactivity && !this.isStale) {
            console.warn(`⚠️ Remote player ${this.id} marked as stale (no updates for ${timeSinceLastUpdate}ms)`);
            this.isStale = true;
        }
        
        return this.isStale;
    }

    // Enhanced method to detect if this player might be a reconnection duplicate
    isPotentialReconnectionDuplicate(newPlayerPosition, threshold = 3) {
        if (!this.mesh || !newPlayerPosition) return false;
        
        const distance = this.mesh.position.distanceTo(new THREE.Vector3(
            newPlayerPosition.x,
            newPlayerPosition.y,
            newPlayerPosition.z
        ));
        
        const timeSinceUpdate = Date.now() - this.lastUpdateTime;
        const isStale = timeSinceUpdate > 3000; // 3 seconds without updates
        
        return distance < threshold && isStale;
    }

    // Mark this player for immediate cleanup (used when detecting reconnection)
    markForCleanup(reason = 'unknown') {
        console.log(`🗑️ Marking remote player ${this.id} for cleanup: ${reason}`);
        this.isStale = true;
        
        // Fade out the player to indicate it's being removed
        if (this.mesh) {
            this.mesh.traverse((child) => {
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => {
                            if (mat.transparent !== undefined) {
                                mat.opacity = 0.3;
                            }
                        });
                    } else if (child.material.transparent !== undefined) {
                        child.material.opacity = 0.3;
                    }
                }
            });
        }
    }

    updateFromNetwork(playerData) {
        // Track update frequency for debugging
        this.updateCount++;
        const now = Date.now();
        const timeSinceLastUpdate = now - this.lastUpdateTime;
        this.lastUpdateTime = now;
        
        // Reset stale flag when we receive an update
        this.isStale = false;
        
        // Log first few updates and any gaps for new players
        if (this.updateCount <= 3 || timeSinceLastUpdate > 1000) {
            console.log(`📡 Remote player ${this.id} update #${this.updateCount}, gap: ${timeSinceLastUpdate}ms, position:`, playerData.position);
        }
        
        // Store previous position for distance calculation
        const previousTarget = this.targetPosition.clone();
        
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
        
        // If this is a big position change (player just joined or teleported), snap immediately
        if (this.mesh && previousTarget.distanceTo(this.targetPosition) > 10) {
            console.log('📍 Large position change detected for remote player', this.id, '- snapping to new position');
            this.mesh.position.copy(this.targetPosition);
            this.mesh.rotation.y = this.targetRotation.y;
        }
        
        // Update state flags
        this.isMoving = playerData.isMoving || false;
        this.isCrouching = playerData.isCrouching || false;
        this.isRunning = playerData.isRunning || false;
        
        // Adjust height based on crouching
        const targetHeight = this.isCrouching ? 0.8 : 1.6;
        if (this.mesh) {
            this.mesh.scale.y = targetHeight / 1.6;
        }
        
        // Debug: log position occasionally (reduced frequency)
        if (this.updateCount > 10 && Math.random() < 0.005) { // 0.5% chance to log after initial updates
            console.log(`🎯 Remote player ${this.id} at:`, this.targetPosition);
        }
    }

    update(deltaTime) {
        if (!this.mesh) return;
        
        // Calculate distance to target for adaptive interpolation
        const distanceToTarget = this.mesh.position.distanceTo(this.targetPosition);
        
        // Use faster interpolation for large distances (e.g., when player just joined or teleported)
        let interpolationSpeed = deltaTime * 10; // Default speed
        if (distanceToTarget > 5) {
            // If player is very far from target, use much faster interpolation or snap immediately
            interpolationSpeed = deltaTime * 50; // 5x faster
            console.log('🏃 Fast interpolation for remote player', this.id, 'distance:', distanceToTarget.toFixed(2));
        } else if (distanceToTarget > 1) {
            // Medium distance, use faster interpolation
            interpolationSpeed = deltaTime * 20; // 2x faster
        }
        
        // Interpolate position
        this.mesh.position.lerp(this.targetPosition, Math.min(interpolationSpeed, 1.0));
        
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
        console.log('🧹 Destroying remote player:', this.playerId);
        
        if (this.mesh) {
            console.log('🧹 Removing player mesh from scene');
            this.scene.remove(this.mesh);
            
            // Clean up weapon
            if (this.weapon) {
                console.log('🧹 Cleaning up player weapon');
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
                this.scene.remove(this.weapon);
            }
            
            // Clean up the main mesh geometry and materials
            this.mesh.traverse((child) => {
                if (child.geometry) {
                    child.geometry.dispose();
                }
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(material => material.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
            
            this.mesh = null;
            console.log('🧹 Remote player cleanup complete');
        } else {
            console.log('🧹 No mesh to clean up for remote player');
        }
    }
}
