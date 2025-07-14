import * as THREE from 'three';
import { Player } from './player.js';
import { Weapon } from './weapon.js';
import { TargetManager } from './targets.js';
import { NetworkManager, RemotePlayer } from './network.js';

// Initialize loading system first
let gameIsReady = false;
let gameStartRequested = false;
let networkSynced = false;
let playerCanMove = false;

// Create loading manager if not already created
if (!window.gameLoadingManager) {
    console.log('⚠️ Loading manager not found, loading system may not be fully initialized');
}

// Create scene
const scene = new THREE.Scene();

// Register systems with loading manager
if (window.gameLoadingManager) {
    console.log('🔄 Registering game systems with loading manager...');
    
    // Register all systems that need to be loaded
    window.gameLoadingManager.registerSystem('skybox', 'Skybox textures');
    window.gameLoadingManager.registerSystem('player', 'Player system');
    window.gameLoadingManager.registerSystem('weapon', 'Weapon system');
    window.gameLoadingManager.registerSystem('targets', 'Target system');
    window.gameLoadingManager.registerSystem('network', 'Multiplayer network');
    window.gameLoadingManager.registerSystem('audio', 'Audio system');
    window.gameLoadingManager.registerSystem('models', '3D models');
    
    console.log('✅ Game systems registered with loading manager');
}

// Create skybox using cube texture
const loader = new THREE.CubeTextureLoader();
const skyboxTexture = loader.load([
    'skymap/px.png', // positive x
    'skymap/nx.png', // negative x
    'skymap/py.png', // positive y
    'skymap/ny.png', // negative y
    'skymap/pz.png', // positive z
    'skymap/nz.png'  // negative z
], 
// onLoad
() => {
    console.log('Skybox cube texture loaded successfully');
    if (window.gameLoadingManager) {
        window.gameLoadingManager.markSystemLoaded('skybox');
    }
},
// onProgress
(progress) => {
    console.log('Skybox loading progress:', progress);
    if (window.gameLoadingManager && progress.loaded && progress.total) {
        const percent = (progress.loaded / progress.total) * 100;
        window.gameLoadingManager.updateSystemProgress('skybox', percent, 'Loading textures...');
    }
},
// onError
(error) => {
    console.error('Error loading skybox cube texture:', error);
    // Fallback to solid color background
    scene.background = new THREE.Color(0x87CEEB);
    if (window.gameLoadingManager) {
        window.gameLoadingManager.markSystemError('skybox', error);
    }
});

// Set the skybox as scene background
scene.background = skyboxTexture;

// Optional: Add subtle atmospheric fog for depth
scene.fog = new THREE.Fog(0xffffff, 100, 300);

// Remove fog temporarily while we load the skybox
// scene.fog = new THREE.Fog(0x87CEEB, 50, 200);

// Create camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 5); // Eye level height

// Add audio listener to camera
const audioListener = new THREE.AudioListener();
camera.add(audioListener);

// Mark audio system as loaded
if (window.gameLoadingManager) {
    window.gameLoadingManager.markSystemLoaded('audio');
}

// Create renderer with enhanced settings
const renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    powerPreference: 'high-performance'
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

// Enhanced lighting setup - bright ambient for sunny sky
const ambientLight = new THREE.AmbientLight(0xB8D4F0, 1);
scene.add(ambientLight);

// Key directional light (sun)
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
directionalLight.position.set(20, 30, 10);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 100;
directionalLight.shadow.camera.left = -50;
directionalLight.shadow.camera.right = 50;
directionalLight.shadow.camera.top = 50;
directionalLight.shadow.camera.bottom = -50;
directionalLight.shadow.bias = -0.0001;
scene.add(directionalLight);

// Fill light
const fillLight = new THREE.DirectionalLight(0x87CEEB, 0.3);
fillLight.position.set(-10, 10, -10);
scene.add(fillLight);

// Additional sunlight from specified position
const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
sunLight.position.set(-30, 30, 20);
sunLight.target.position.set(0, 0, 0);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 100;
sunLight.shadow.camera.left = -50;
sunLight.shadow.camera.right = 50;
sunLight.shadow.camera.top = 50;
sunLight.shadow.camera.bottom = -50;
sunLight.shadow.bias = -0.0001;
scene.add(sunLight);
scene.add(sunLight.target);

// Create enhanced floor with texture
const floorGeometry = new THREE.PlaneGeometry(200, 200, 32, 32);
const floorMaterial = new THREE.MeshLambertMaterial({ 
    color: 0x556B2F,
    transparent: true,
    opacity: 0.9
});

// Add some subtle vertex displacement for terrain variation
const floorVertices = floorGeometry.attributes.position.array;
for (let i = 0; i < floorVertices.length; i += 3) {
    floorVertices[i + 2] = Math.random() * 0.5; // Small random height variations
}
floorGeometry.attributes.position.needsUpdate = true;
floorGeometry.computeVertexNormals();

const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);









// Initialize player
const player = new Player(camera, scene);

// Mark player system as loaded
if (window.gameLoadingManager) {
    window.gameLoadingManager.markSystemLoaded('player');
}

// Expose player globally for debug functions
window.gamePlayer = player;

// Initialize multiplayer
const networkManager = new NetworkManager();
const remotePlayers = new Map();
const processedPlayerIds = new Set(); // Track players we've already processed to prevent duplicates

// Mark network system as loaded
if (window.gameLoadingManager) {
    window.gameLoadingManager.markSystemLoaded('network');
}

// Expose for debugging
window.networkManager = networkManager;
window.remotePlayers = remotePlayers;
window.processedPlayerIds = processedPlayerIds;
window.gameScene = scene;
window.RemotePlayer = RemotePlayer;

// Set up networking callbacks
networkManager.onPlayerJoined = (playerData) => {
    console.log('🎮 Creating remote player from playerJoined event:', playerData.id);
    console.log('🎮 Current remote players before adding:', Array.from(remotePlayers.keys()));
    
    // Check if player already exists to prevent duplicates
    if (remotePlayers.has(playerData.id) || processedPlayerIds.has(playerData.id)) {
        console.warn('⚠️ Player already exists or processed, skipping creation:', playerData.id);
        return;
    }
    
    // Enhanced reconnection detection: Clean up any stale players first
    const stalePlayersToRemove = [];
    const newPlayerPosition = new THREE.Vector3(
        playerData.position.x,
        playerData.position.y,
        playerData.position.z
    );
    
    remotePlayers.forEach((remotePlayer, playerId) => {
        // Check if player is stale or could be a reconnection duplicate
        if (remotePlayer.isPlayerStale() || 
            remotePlayer.isPotentialReconnectionDuplicate(playerData.position, 8)) { // Increased threshold to 8 units
            
            console.log(`🔄 Removing stale/duplicate player ${playerId} for new player ${playerData.id}`);
            remotePlayer.markForCleanup('reconnection or stale detection');
            stalePlayersToRemove.push(playerId);
        }
    });
    
    // Remove stale players immediately
    stalePlayersToRemove.forEach(playerId => {
        const remotePlayer = remotePlayers.get(playerId);
        if (remotePlayer) {
            remotePlayer.destroy();
            remotePlayers.delete(playerId);
            processedPlayerIds.delete(playerId);
        }
    });
    
    // Additional cleanup: Force remove any players that haven't been updated in 3+ seconds
    const now = Date.now();
    const additionalCleanup = [];
    remotePlayers.forEach((remotePlayer, playerId) => {
        const timeSinceUpdate = now - remotePlayer.lastUpdateTime;
        if (timeSinceUpdate > 3000) {
            console.log(`🧹 Force removing inactive player ${playerId} (${timeSinceUpdate}ms since update)`);
            additionalCleanup.push(playerId);
        }
    });
    
    additionalCleanup.forEach(playerId => {
        const remotePlayer = remotePlayers.get(playerId);
        if (remotePlayer) {
            remotePlayer.destroy();
            remotePlayers.delete(playerId);
            processedPlayerIds.delete(playerId);
        }
    });
    
    try {
        const remotePlayer = new RemotePlayer(scene, playerData, networkManager);
        remotePlayers.set(playerData.id, remotePlayer);
        processedPlayerIds.add(playerData.id); // Mark as processed
        updatePlayerCount();
        console.log('👥 Total remote players after adding:', remotePlayers.size);
        console.log('👥 Remote player IDs:', Array.from(remotePlayers.keys()));
    } catch (error) {
        console.error('❌ Error creating remote player:', error);
    }
};

networkManager.onPlayerLeft = (playerId) => {
    console.log('🚪 Player left event received for player:', playerId);
    console.log('🚪 Current remote players before removal:', Array.from(remotePlayers.keys()));
    console.log('🚪 Player exists in map:', remotePlayers.has(playerId));
    
    const remotePlayer = remotePlayers.get(playerId);
    if (remotePlayer) {
        console.log('🚪 Destroying remote player:', playerId);
        remotePlayer.destroy();
        remotePlayers.delete(playerId);
        processedPlayerIds.delete(playerId); // Remove from processed set
        console.log('🚪 Remote player destroyed and removed from map');
    } else {
        console.warn('🚪 Player not found in remote players map:', playerId);
        // Also remove from processed set in case it's stuck there
        processedPlayerIds.delete(playerId);
    }
    
    updatePlayerCount();
    console.log('🚪 Remaining remote players after removal:', Array.from(remotePlayers.keys()));
    console.log('👥 Total remote players:', remotePlayers.size);
};

networkManager.onPlayerUpdate = (playerUpdates) => {
    if (playerUpdates.size > 0) {
        console.log('🔄 Updating', playerUpdates.size, 'remote players');
        playerUpdates.forEach((playerData, playerId) => {
            console.log(`🔄 Update data for ${playerId}:`, {
                position: playerData.position,
                isMoving: playerData.isMoving,
                hasRemotePlayer: remotePlayers.has(playerId)
            });
        });
    }
    
    playerUpdates.forEach((playerData, playerId) => {
        const remotePlayer = remotePlayers.get(playerId);
        if (remotePlayer) {
            remotePlayer.updateFromNetwork(playerData);
        } else {
            // Only create new remote player from update if we haven't processed initial game state yet
            // This prevents duplicate players when processing gameUpdate events after initial connection
            console.warn('⚠️ Received update for unknown player:', playerId, '- this should only happen during initial connection');
            // Don't create players here - they should be created via onPlayerJoined or initial gameState
        }
    });
};

networkManager.onPlayerShot = (shotData) => {
    console.log('🔫 Player shot event received:', shotData);
    console.log('📍 Shot position:', shotData.position);
    console.log('🎯 Shot direction:', shotData.direction);
    console.log('👥 Current remote players:', remotePlayers.size);
    console.log('🔍 Available player IDs:', Array.from(remotePlayers.keys()));
    
    // Find the remote player who shot
    const remotePlayer = remotePlayers.get(shotData.playerId);
    if (remotePlayer) {
        console.log('✅ Found remote player for shot, calling onShoot');
        
        // Verify the remote player has networkManager
        if (remotePlayer.networkManager) {
            console.log('✅ Remote player has networkManager reference');
        } else {
            console.error('❌ Remote player missing networkManager reference!');
        }
        
        remotePlayer.onShoot(shotData);
    } else {
        // If remote player not found, just create a basic effect
        console.warn('⚠️ Shot from unknown player:', shotData.playerId);
        console.log('🔍 Available player IDs:', Array.from(remotePlayers.keys()));
        createGenericShotEffect(shotData);
    }
};

// Create a generic shot effect if we don't have the remote player
function createGenericShotEffect(shotData) {
    console.log('🎨 Creating generic shot effect');
    
    const startPos = new THREE.Vector3(
        shotData.position.x,
        shotData.position.y,
        shotData.position.z
    );
    const direction = new THREE.Vector3(
        shotData.direction.x,
        shotData.direction.y,
        shotData.direction.z
    ).normalize();
    
    console.log('📍 Generic bullet start pos:', startPos);
    console.log('🎯 Generic bullet direction:', direction);
    
    // Create a more visible bullet trail
    const bulletGeometry = new THREE.SphereGeometry(0.05, 6, 6); // Bigger bullet
    const bulletMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xff0000, // Red color to make it stand out
        transparent: true,
        opacity: 1.0
    });
    
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
    bullet.position.copy(startPos);
    
    // Add a bright trail
    const trailGeometry = new THREE.CylinderGeometry(0.01, 0.03, 1.0, 6);
    const trailMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00, // Yellow trail
        transparent: true,
        opacity: 0.8
    });
    const trail = new THREE.Mesh(trailGeometry, trailMaterial);
    trail.position.set(0, -0.5, 0);
    bullet.add(trail);
    
    scene.add(bullet);
    console.log('✅ Generic bullet added to scene');
    
    // Animate bullet
    const speed = 30; // Slower for visibility
    const velocity = direction.clone().multiplyScalar(speed);
    let time = 0;
    const maxTime = 3; // Longer lifetime
    
    const animateBullet = () => {
        time += 0.016;
        
        if (time > maxTime) {
            scene.remove(bullet);
            bullet.geometry.dispose();
            bullet.material.dispose();
            trail.geometry.dispose();
            trail.material.dispose();
            console.log('🗑️ Generic bullet cleaned up');
            return;
        }
        
        bullet.position.add(velocity.clone().multiplyScalar(0.016));
        bullet.lookAt(bullet.position.clone().add(velocity));
        
        // Fade out over time
        const fadeProgress = time / maxTime;
        bullet.material.opacity = Math.max(0, 1.0 * (1 - fadeProgress));
        trail.material.opacity = Math.max(0, 0.8 * (1 - fadeProgress));
        
        requestAnimationFrame(animateBullet);
    };
    
    animateBullet();
}

networkManager.onTargetHit = (hitData) => {
    // Handle target hits from server (applies to all players including the shooter)
    if (targetManager) {
        console.log(`Server confirmed target ${hitData.targetId} hit by player ${hitData.playerId} for ${hitData.damage} damage`);
        
        // Find the target and apply hit effect
        const target = targetManager.targets.find(t => t.userData.targetId === hitData.targetId);
        if (target) {
            // Update local target health to match server
            target.userData.health = hitData.health;
            
            // Clear any local destruction marking
            target.userData.locallyDestroyed = false;
            
            // Restore opacity if target is still alive
            if (hitData.health > 0) {
                target.traverse((child) => {
                    if (child.isMesh && child.material && child.userData.originalOpacity) {
                        child.material.opacity = child.userData.originalOpacity;
                        if (child.userData.originalOpacity >= 1.0) {
                            child.material.transparent = false;
                        }
                    }
                });
            }
            
            // Show visual hit effect using the target manager method
            targetManager.showHitEffect(target);
            
            console.log(`Updated target ${hitData.targetId} health to ${hitData.health}/${hitData.maxHealth}`);
        } else {
            console.warn(`Target ${hitData.targetId} not found for hit event`);
        }
    }
};

networkManager.onTargetDestroyed = (destroyData) => {
    // Handle target destruction from server (applies to all players)
    if (targetManager) {
        console.log(`Server confirmed target ${destroyData.targetId} destroyed by player ${destroyData.playerId} for ${destroyData.points} points`);
        
        const wasDestroyed = targetManager.destroyTargetById(destroyData.targetId, false); // false = don't send network event
        
        if (wasDestroyed) {
            if (destroyData.playerId === networkManager.playerId) {
                console.log(`You destroyed target ${destroyData.targetId} for ${destroyData.points} points!`);
                // Update local score
                score += destroyData.points;
                updateScoreDisplay();
            } else {
                console.log(`Player ${destroyData.playerId} destroyed target ${destroyData.targetId} for ${destroyData.points} points`);
            }
        } else {
            console.warn(`Target ${destroyData.targetId} not found for destruction event`);
        }
    }
};

networkManager.onTargetSpawned = (targetData) => {
    console.log('🎯 TARGET SPAWN EVENT RECEIVED:', targetData);
    
    // Comprehensive debugging of the spawn event
    console.log('🎯 Target data details:', {
        id: targetData.id,
        position: targetData.position,
        scale: targetData.scale,
        health: targetData.health,
        maxHealth: targetData.maxHealth,
        points: targetData.points,
        rotation: targetData.rotation,
        isAlive: targetData.isAlive
    });
    
    // Check system readiness
    console.log('🎯 System status check:');
    console.log('  - targetManager exists:', !!targetManager);
    console.log('  - targetManager.isModelLoaded:', targetManager?.isModelLoaded);
    console.log('  - targetManager.targets.length before:', targetManager?.targets?.length || 'N/A');
    console.log('  - scene exists:', !!scene);
    console.log('  - scene.children.length:', scene?.children?.length || 'N/A');
    
    if (!targetManager) {
        console.error('❌ Target manager not available for new target spawn');
        return;
    }
    
    if (!targetManager.isModelLoaded) {
        console.error('❌ Target model not loaded yet - cannot create new target');
        console.log('❌ TargetManager model loaded state:', targetManager.isModelLoaded);
        console.log('❌ TargetModel exists:', !!targetManager.targetModel);
        
        // Retry after model loads
        const retrySpawn = () => {
            if (targetManager.isModelLoaded) {
                console.log('🎯 Model loaded! Retrying target spawn...');
                networkManager.onTargetSpawned(targetData);
            } else {
                console.log('🎯 Model still not loaded, retrying in 500ms...');
                setTimeout(retrySpawn, 500);
            }
        };
        setTimeout(retrySpawn, 200);
        return;
    }
    
    try {
        console.log(`🎯 Creating new target ${targetData.id} at position (${targetData.position.x}, ${targetData.position.y}, ${targetData.position.z})`);
        
        // Create target from server data
        const position = new THREE.Vector3(targetData.position.x, targetData.position.y, targetData.position.z);
        
        // Prepare rotation if provided
        let rotation = undefined;
        if (targetData.rotation) {
            rotation = new THREE.Euler(targetData.rotation.x || 0, targetData.rotation.y || 0, targetData.rotation.z || 0, 'XYZ');
        }
        
        console.log('🎯 Calling targetManager.createTarget with:', {
            position: position,
            options: {
                scale: targetData.scale || 5,
                health: targetData.health,
                points: targetData.points,
                rotation: rotation,
                targetId: targetData.id
            }
        });
        
        const target = targetManager.createTarget(position, {
            scale: targetData.scale || 5,
            health: targetData.health,
            points: targetData.points,
            rotation: rotation,
            targetId: targetData.id // Pass the server ID
        });
        
        console.log('🎯 createTarget returned:', target);
        console.log('🎯 targetManager.targets.length after:', targetManager.targets.length);
        
        if (target) {
            // Ensure target ID is set correctly
            target.userData.targetId = targetData.id.toString();
            target.userData.health = targetData.health;
            target.userData.maxHealth = targetData.maxHealth || targetData.health;
            target.userData.points = targetData.points;
            
            console.log('✅ New target created successfully:', {
                targetId: target.userData.targetId,
                position: target.position,
                visible: target.visible,
                inScene: !!target.parent,
                sceneChildren: scene.children.length
            });
            
            // Force add to scene if not already there
            if (!target.parent) {
                console.log('🔧 Target not in scene, force adding...');
                scene.add(target);
                console.log('🔧 Target force-added to scene');
            }
            
            // Ensure weapon system scans for the new target
            setTimeout(() => {
                if (window.weapon && window.weapon.scanForNewTargets) {
                    console.log('🎯 Rescanning targets after new target spawn...');
                    const scanResult = window.weapon.scanForNewTargets();
                    console.log('🎯 Rescan result:', scanResult);
                    console.log('🎯 Weapon colliders after scan:', window.weapon.targetColliders.size);
                } else {
                    console.warn('⚠️ Weapon system not available for scanning');
                }
            }, 100);
            
            // Additional verification after a delay
            setTimeout(() => {
                console.log('🔍 Post-spawn verification for target', targetData.id);
                console.log('  - Target still in targetManager:', targetManager.targets.includes(target));
                console.log('  - Target still in scene:', !!target.parent);
                console.log('  - Target visible:', target.visible);
                console.log('  - Target position:', target.position);
                console.log('  - Total targets in manager:', targetManager.targets.length);
                console.log('  - Scene children count:', scene.children.length);
            }, 1000);
            
        } else {
            console.error('❌ Failed to create target from spawn data:', targetData);
            console.error('❌ targetManager.createTarget returned null/undefined');
            
            // Additional debugging
            console.log('🔍 Debugging createTarget failure:');
            console.log('  - targetManager exists:', !!targetManager);
            console.log('  - position valid:', position && position.isVector3);
            console.log('  - targetManager.model exists:', !!targetManager.model);
            console.log('  - targetManager.scene exists:', !!targetManager.scene);
            console.log('  - targetManager.targetModel exists:', !!targetManager.targetModel);
        }
        
    } catch (error) {
        console.error('❌ Exception during target spawn:', error);
        console.error('❌ Error stack:', error.stack);
        console.error('❌ Failed to create target from data:', targetData);
    }
};

// Store received gameState for delayed processing if systems aren't ready
let pendingGameState = null;

networkManager.onGameStateReceived = (gameState) => {
    console.log('🎮 Initial game state received, players:', gameState.players.length, 'targets:', gameState.targets.length);
    console.log('🎮 Full game state object:', gameState);
    
    // Store the gameState for processing
    pendingGameState = gameState;
    
    // Process immediately if systems are ready, otherwise wait
    processGameState();
};

function processGameState() {
    if (!pendingGameState) {
        console.log('🎮 No pending game state to process');
        return;
    }
    
    const gameState = pendingGameState;
    
    // Check if all required systems are initialized
    if (!targetManager) {
        console.log('🎯 Target manager not ready, retrying in 100ms...');
        setTimeout(processGameState, 100);
        return;
    }
    
    // CRITICAL: Check if target model is loaded before trying to create targets
    if (!targetManager.isModelLoaded) {
        console.log('� Target model not loaded yet, retrying in 200ms...');
        setTimeout(processGameState, 200);
        return;
    }
    
    console.log('�🎮 Processing game state with all systems ready');
    console.log('✅ Target manager ready AND target model loaded');
    updatePlayerCount();
    updateConnectionStatus(true);
    
    // Create remote players from initial state
    console.log('🧑‍🤝‍🧑 Processing initial game state players...');
    console.log('🧑‍🤝‍🧑 Players in game state:', gameState.players.length);
    console.log('🧑‍🤝‍🧑 My player ID:', networkManager.playerId);
    console.log('🧑‍🤝‍🧑 Current remote players before processing:', Array.from(remotePlayers.keys()));
    
    gameState.players.forEach(playerData => {
        if (playerData.id !== networkManager.playerId) {
            console.log('🧑‍🤝‍🧑 Processing initial remote player:', playerData.id);
            
            // Check if player already exists to prevent duplicates
            if (remotePlayers.has(playerData.id) || processedPlayerIds.has(playerData.id)) {
                console.warn('⚠️ Player already exists during initial processing, skipping:', playerData.id);
                return;
            }
            
            try {
                const remotePlayer = new RemotePlayer(scene, playerData, networkManager);
                remotePlayers.set(playerData.id, remotePlayer);
                processedPlayerIds.add(playerData.id); // Mark as processed
                console.log('✅ Created initial remote player:', playerData.id);
            } catch (error) {
                console.error('❌ Error creating initial remote player:', error);
            }
        } else {
            console.log('🧑‍🤝‍🧑 Skipping own player data:', playerData.id);
        }
    });
    
    console.log('🧑‍🤝‍🧑 Remote players after initial processing:', Array.from(remotePlayers.keys()));
    updatePlayerCount();
    
    // ALWAYS process targets from server state, regardless of client state
    console.log('🎯 Processing targets from server state...');
    console.log('🎯 targetManager available:', !!targetManager);
    console.log('🎯 gameState.targets exists:', !!gameState.targets);
    console.log('🎯 gameState.targets length:', gameState.targets ? gameState.targets.length : 'N/A');
    
    if (targetManager) {
        // Always clear existing targets to ensure clean state
        console.log('🎯 Clearing existing targets to ensure clean state');
        targetManager.clearAllTargets();
        
        if (gameState.targets && gameState.targets.length > 0) {
            console.log('🎯 Creating targets from server state:', gameState.targets.length);
            console.log('🎯 Server targets data:', gameState.targets);
            
            // Create targets from server data
            let createdCount = 0;
            gameState.targets.forEach((targetData, index) => {
                console.log(`🎯 Processing target ${index + 1}:`, targetData);
                console.log(`🎯 Target ${targetData.id} isAlive:`, targetData.isAlive);
                
                if (targetData.isAlive) {
                    const position = new THREE.Vector3(targetData.position.x, targetData.position.y, targetData.position.z);
                    
                    // Prepare rotation if provided
                    let rotation = undefined;
                    if (targetData.rotation) {
                        rotation = new THREE.Euler(targetData.rotation.x || 0, targetData.rotation.y || 0, targetData.rotation.z || 0);
                    }
                    
                    console.log(`🎯 Creating target ${targetData.id} at position:`, position);
                    
                    const target = targetManager.createTarget(position, {
                        scale: targetData.scale || 5,
                        health: targetData.health,
                        points: targetData.points,
                        rotation: rotation,
                        targetId: targetData.id // Pass the server ID
                    });
                    
                    if (target) {
                        // CRITICAL: Ensure target ID is properly set and matches server
                        target.userData.targetId = targetData.id.toString();
                        target.userData.health = targetData.health;
                        target.userData.maxHealth = targetData.maxHealth || targetData.health;
                        target.userData.points = targetData.points;
                        
                        createdCount++;
                        console.log(`✅ Created target ${targetData.id} from server data at position`, position);
                        console.log(`✅ Target userData.targetId set to: "${target.userData.targetId}" (type: ${typeof target.userData.targetId})`);
                    } else {
                        console.error(`❌ Failed to create target ${targetData.id}`);
                    }
                } else {
                    console.log(`⚰️ Skipping dead target ${targetData.id}`);
                }
            });
            
            console.log(`✅ Total targets created: ${createdCount}/${gameState.targets.length}`);
            console.log(`✅ Target manager target count: ${targetManager.targets.length}`);
            
            // CRITICAL: Ensure weapon system scans for the new targets immediately
            if (window.weapon && window.weapon.scanForNewTargets) {
                console.log('🎯 Immediately scanning for targets after creation...');
                window.weapon.scanForNewTargets();
                console.log('🎯 Initial scan completed');
            } else {
                console.log('❌ Weapon system not available for initial scanning');
            }
            
            // Additional scans with delays to handle any timing issues
            setTimeout(() => {
                console.log('🎯 Secondary weapon system scan (500ms delay)...');
                if (window.weapon && window.weapon.scanForNewTargets) {
                    window.weapon.scanForNewTargets();
                    console.log('🎯 Secondary scan completed');
                    
                    // Debug info after scan
                    setTimeout(() => {
                        console.log('🔍 Post-scan debugging:');
                        console.log('🔍 Target colliders in weapon system:', window.weapon.targetColliders?.size || 0);
                        if (window.weapon.targetColliders) {
                            console.log('🔍 All target collider IDs:', Array.from(window.weapon.targetColliders.keys()));
                        }
                    }, 500);
                }
            }, 500);
            
            // Third scan after longer delay
            setTimeout(() => {
                console.log('🎯 Tertiary weapon system scan (2s delay)...');
                if (window.weapon && window.weapon.scanForNewTargets) {
                    window.weapon.scanForNewTargets();
                    console.log('🎯 Tertiary scan completed');
                }
            }, 2000);
            
            // Debug mode available but not auto-activated
            // Use weaponDebug() in console to toggle debug visualization if needed
            console.log('🔧 Debug functions available: debugTargets(), forceTargetScan(), weaponDebug()');
            console.log('🔧 Use weaponDebug() in console to toggle debug visualization');
            
        } else {
            console.log('🎯 No targets received from server - this should only happen in empty server scenarios');
        }
    } else {
        console.error('❌ Target manager still not available after waiting - this is a critical error');
    }
    
    updatePlayerCount();
    
    // Clear the pending state
    pendingGameState = null;
    console.log('✅ Game state processing completed');
}

networkManager.onConnectionChange = (connected) => {
    updateConnectionStatus(connected);
    if (!connected) {
        console.log('🔌 Connection lost - clearing all remote players');
        // Clear remote players when disconnected
        remotePlayers.forEach((remotePlayer, playerId) => {
            console.log('🧹 Cleaning up remote player on disconnect:', playerId);
            remotePlayer.destroy();
        });
        remotePlayers.clear();
        processedPlayerIds.clear(); // Clear processed players tracking
        updatePlayerCount();
        console.log('🧹 All remote players cleared due to disconnection');
    }
};

// Initialize weapon system first, then connect to multiplayer
let weapon = null;
let targetManager = null;

// Initialize systems asynchronously
async function initializeSystems() {
    try {
        console.log('Starting initialization of FPS systems...');
        
        // Initialize weapon system with player body
        weapon = new Weapon(camera, scene, audioListener, player.getPlayerBody(), player, networkManager);
        
        // Expose weapon globally for target system integration
        window.weapon = weapon;
        
        // Mark weapon system as loaded
        if (window.gameLoadingManager) {
            window.gameLoadingManager.markSystemLoaded('weapon');
        }
        
        // Add debug function to manually scan targets
        window.scanTargets = () => {
            if (window.weapon && window.weapon.scanForNewTargets) {
                window.weapon.scanForNewTargets();
                console.log('🎯 Manual target scan triggered');
            } else {
                console.log('❌ Weapon system not available for scanning');
            }
        };
        
        // Wait a bit for weapon to load, then check
        setTimeout(() => {
            console.log('Weapon system check:');
            console.log('- Weapon object:', weapon);
            console.log('- Weapon loaded:', weapon?.isLoaded);
            console.log('- Weapon model:', weapon?.model);
            console.log('- Player body children:', player.getPlayerBody()?.children.length);
            console.log('- Camera children:', camera.children.length);
            
            // Force fallback if no weapon visible
            if (!weapon?.model) {
                console.log('Forcing weapon fallback model...');
                weapon?.createFallbackModel();
                weapon?.attachWeapon();
            }
        }, 2000);
        
        // Initialize target system
        targetManager = new TargetManager(scene, networkManager);
        
        // Mark target system as loaded when ready
        if (window.gameLoadingManager) {
            // Check if target manager is fully loaded
            const checkTargetManagerReady = () => {
                if (targetManager && targetManager.isModelLoaded) {
                    window.gameLoadingManager.markSystemLoaded('targets');
                    console.log('✅ Target system fully loaded');
                } else {
                    setTimeout(checkTargetManagerReady, 100);
                }
            };
            checkTargetManagerReady();
        }
        
        // Set up callbacks after initialization
        if (targetManager) {
            targetManager.onTargetDestroyed = (points) => {
                score += points;
                updateScoreDisplay();
            };
        }
        
        console.log('🎯 Target system initialized, current target count:', targetManager.getTargetCount());
        
        // Process any pending game state now that target manager is ready
        if (pendingGameState) {
            console.log('🎯 Target manager ready, processing pending game state...');
            setTimeout(processGameState, 100); // Small delay to ensure everything is fully initialized
        }
        
        // Set up periodic target scanning to ensure weapon system detects all targets
        setInterval(() => {
            if (window.weapon && window.weapon.scanForNewTargets && targetManager.getTargetCount() > 0) {
                window.weapon.scanForNewTargets();
            }
        }, 5000); // Scan every 5 seconds
        
        if (weapon) {
            weapon.onAmmoChange = (mag, total) => {
                updateAmmoDisplay(mag, total);
            };
            
            // Initialize HUD with starting ammo after a delay
            setTimeout(() => {
                if (weapon) {
                    const ammo = weapon.getAmmoCount();
                    updateAmmoDisplay(ammo.mag, ammo.total);
                }
            }, 1000);
        }
        
        console.log('FPS systems initialization completed');
        
        // Mark models system as loaded (will be updated as individual models load)
        if (window.gameLoadingManager) {
            window.gameLoadingManager.markSystemLoaded('models');
        }
        
    } catch (error) {
        console.error('Error initializing systems:', error);
        if (window.gameLoadingManager) {
            window.gameLoadingManager.markSystemError('initialization', error);
        }
    }
}

// Set up game loading completion handler
if (window.gameLoadingManager) {
    window.gameLoadingManager.onComplete(() => {
        console.log('🎉 All game systems loaded - game ready to start!');
        gameIsReady = true;
        
        // Show instructions when game is ready
        const instructions = document.getElementById('instructions');
        if (instructions) {
            instructions.innerHTML = `
                <h2>Cat FPS Game</h2>
                <p>Click or press <strong>F</strong> to start playing</p>
                <p>Use <strong>WASD</strong> to move, <strong>Space</strong> to jump</p>
                <p>Left click to shoot, <strong>R</strong> to reload</p>
                <p>Press <strong>Tab</strong> for debug panel</p>
                <p>Press <strong>Escape</strong> to exit</p>
            `;
        }
        
        // If player already requested to start, start now
        if (gameStartRequested) {
            startGame();
        }
    });
}

// Global function called when loading screen start button is clicked
window.gameLoadingComplete = () => {
    console.log('🎮 Loading screen start button clicked');
    gameStartRequested = true;
    
    if (gameIsReady) {
        startGame();
    } else {
        console.log('🎮 Game start requested but systems not ready yet');
    }
};

// Function to actually start the game
function startGame() {
    console.log('🚀 Starting game...');
    gameIsReady = true;
    gameStartRequested = true;
    
    // Connect to multiplayer
    if (networkManager && !networkManager.isConnected) {
        console.log('🌐 Connecting to multiplayer server...');
        
        // Set up network event handlers
        const originalOnConnectionChange = networkManager.onConnectionChange;
        networkManager.onConnectionChange = (connected) => {
            if (connected) {
                console.log('🌐 Connected to server, waiting for sync...');
            } else {
                console.log('🌐 Disconnected from server');
                networkSynced = false;
                playerCanMove = false;
            }
            
            if (originalOnConnectionChange) {
                originalOnConnectionChange(connected);
            }
        };
        
        // Set up game state received handler for sync completion
        const originalOnGameStateReceived = networkManager.onGameStateReceived;
        networkManager.onGameStateReceived = (gameState) => {
            console.log('🌐 Game state received - network sync complete!');
            networkSynced = true;
            playerCanMove = true;
            
            // Show instructions when ready
            showGameInstructions();
            
            if (originalOnGameStateReceived) {
                originalOnGameStateReceived(gameState);
            }
        };
        
        networkManager.connect();
    } else {
        // Already connected or no network manager
        networkSynced = true;
        playerCanMove = true;
        showGameInstructions();
    }
}

// Function to show game instructions
function showGameInstructions() {
    const instructions = document.getElementById('instructions');
    if (instructions) {
        instructions.innerHTML = `
            <h2>Cat FPS Game</h2>
            <p><strong>Player:</strong> ${window.gamePlayerName || 'Guest'}</p>
            <p>Click or press <strong>F</strong> to start playing</p>
            <p>Use <strong>WASD</strong> to move, <strong>Space</strong> to jump</p>
            <p>Left click to shoot, <strong>R</strong> to reload</p>
            <p>Press <strong>Tab</strong> for debug panel</p>
            <p>Press <strong>Escape</strong> to exit</p>
        `;
        instructions.style.display = 'block';
    }
}

// Initialize systems first, but don't connect to network yet
initializeSystems();

// Score system
let score = 0;

// HUD update functions
function updateAmmoDisplay(mag, total) {
    const ammoElement = document.getElementById('ammo');
    if (!ammoElement) {
        // Create ammo display if it doesn't exist
        const hud = document.getElementById('hud');
        const ammoDiv = document.createElement('div');
        ammoDiv.id = 'ammo';
        ammoDiv.innerHTML = `Ammo: ${mag}/${total}`;
        hud.appendChild(ammoDiv);
    } else {
        ammoElement.innerHTML = `Ammo: ${mag}/${total}`;
    }
}

function updateScoreDisplay() {
    const scoreElement = document.getElementById('score');
    if (!scoreElement) {
        // Create score display if it doesn't exist
        const hud = document.getElementById('hud');
        const scoreDiv = document.createElement('div');
        scoreDiv.id = 'score';
        scoreDiv.innerHTML = `Score: ${score}`;
        hud.appendChild(scoreDiv);
    } else {
        scoreElement.innerHTML = `Score: ${score}`;
    }
}

function updateTargetsDisplay() {
    const targetsElement = document.getElementById('targets');
    const targetCount = targetManager.getTargetCount();
    if (!targetsElement) {
        // Create targets display if it doesn't exist
        const hud = document.getElementById('hud');
        const targetsDiv = document.createElement('div');
        targetsDiv.id = 'targets';
        targetsDiv.innerHTML = `Targets: ${targetCount}`;
        hud.appendChild(targetsDiv);
    } else {
        targetsElement.innerHTML = `Targets: ${targetCount}`;
    }
}

// Update connection status and player count
function updateConnectionStatus(connected) {
    const connectionElement = document.getElementById('connection');
    if (connectionElement) {
        if (connected) {
            connectionElement.textContent = '🟢 Online';
            connectionElement.classList.add('connected');
        } else {
            connectionElement.textContent = '🔴 Offline';
            connectionElement.classList.remove('connected');
        }
    }
}

function updatePlayerCount() {
    const playersElement = document.getElementById('players');
    if (playersElement) {
        const playerCount = remotePlayers.size + 1; // +1 for local player
        playersElement.textContent = `Players: ${playerCount}`;
        
        // Change color based on player count to make it more obvious
        if (playerCount > 1) {
            playersElement.style.color = '#f9ca24'; // Yellow when multiplayer
            playersElement.style.fontWeight = 'bold';
        } else {
            playersElement.style.color = '#4ecdc4'; // Default color
            playersElement.style.fontWeight = 'normal';
        }
    }
}

// Debug Panel functionality
let debugPanelVisible = false;

// Toggle debug panel with Tab key
document.addEventListener('keydown', (event) => {
    if (event.code === 'Tab') {
        event.preventDefault();
        debugPanelVisible = !debugPanelVisible;
        const debugPanel = document.getElementById('debugPanel');
        const instructions = document.getElementById('instructions');
        
        debugPanel.classList.toggle('active', debugPanelVisible);
        
        if (debugPanelVisible) {
            // Opening debug panel - release pointer lock and block input
            if (player.isLocked) {
                player.exitPointerLock();
            }
            if (window.inputBlocker) {
                window.inputBlocker.fullBlock('debug');
            }
        } else {
            // Closing debug panel - hide instructions and unblock input
            instructions.style.display = 'none';
            if (window.inputBlocker) {
                window.inputBlocker.fullUnblock('debug');
            }
        }
    }
});

// Debug panel controls
function setupDebugControls() {
    const controls = {
        speed: { slider: 'speedSlider', value: 'speedValue', property: 'speed' },
        runSpeed: { slider: 'runSpeedSlider', value: 'runSpeedValue', property: 'runSpeed' },
        jump: { slider: 'jumpSlider', value: 'jumpValue', property: 'jumpVelocity' },
        gravity: { slider: 'gravitySlider', value: 'gravityValue', property: 'gravity' },
        sensitivity: { slider: 'sensitivitySlider', value: 'sensitivityValue', property: 'mouseSensitivity' },
        damping: { slider: 'dampingSlider', value: 'dampingValue', property: 'damping' },
        walkBob: { slider: 'walkBobSlider', value: 'walkBobValue', property: 'walkBobIntensity' },
        runBob: { slider: 'runBobSlider', value: 'runBobValue', property: 'runBobIntensity' }
    };
    
    Object.entries(controls).forEach(([key, control]) => {
        const slider = document.getElementById(control.slider);
        const valueDisplay = document.getElementById(control.value);
        
        slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            player[control.property] = value;
            valueDisplay.textContent = value.toFixed(3);
        });
    });
}

// Reset to default values
window.resetToDefaults = function() {
    const defaults = {
        speedSlider: 12,
        runSpeedSlider: 20,
        jumpSlider: 15,
        gravitySlider: 30,
        sensitivitySlider: 0.002,
        dampingSlider: 8,
        walkBobSlider: 0.02,
        runBobSlider: 0.035
    };
    
    Object.entries(defaults).forEach(([sliderId, value]) => {
        const slider = document.getElementById(sliderId);
        slider.value = value;
        slider.dispatchEvent(new Event('input'));
    });
};

// Initialize debug controls
setupDebugControls();

// Handle window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

window.addEventListener('resize', onWindowResize);

// Animation loop with enhanced effects
let time = 0;
let frameCount = 0;
let lastFpsTime = performance.now();
let lastTime = performance.now();

function animate() {
    requestAnimationFrame(animate);
    
    const currentTime = performance.now();
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    
    time += 0.016;
    frameCount++;
    
    // Update FPS counter every second
    if (currentTime - lastFpsTime >= 1000) {
        const fps = Math.round((frameCount * 1000) / (currentTime - lastFpsTime));
        document.getElementById('fps').textContent = `FPS: ${fps}`;
        frameCount = 0;
        lastFpsTime = currentTime;
    }
    
    // Update player
    player.update();
    
    // Send player state to server
    if (networkManager.isConnected && player.isLocked) {
        const playerInput = {
            name: window.gamePlayerName || 'Guest',
            position: {
                x: player.camera.position.x,
                y: player.camera.position.y,
                z: player.camera.position.z
            },
            rotation: {
                x: player.rotationX,
                y: player.rotationY
            },
            velocity: {
                x: player.velocity.x,
                y: player.velocity.y,
                z: player.velocity.z
            },
            isMoving: player.isWalking,
            isCrouching: player.isCrouching,
            isRunning: player.isRunning
        };
        networkManager.sendPlayerInput(playerInput);
    } else if (networkManager.isConnected && !player.isLocked) {
        // Send basic position even when not locked, in case player is in menu
        const basicInput = {
            name: window.gamePlayerName || 'Guest',
            position: {
                x: player.camera.position.x,
                y: player.camera.position.y,
                z: player.camera.position.z
            },
            rotation: {
                x: player.rotationX || 0,
                y: player.rotationY || 0
            },
            velocity: { x: 0, y: 0, z: 0 },
            isMoving: false,
            isCrouching: false,
            isRunning: false
        };
        networkManager.sendPlayerInput(basicInput);
    }
    
    // Update remote players
    remotePlayers.forEach(remotePlayer => {
        remotePlayer.update(deltaTime);
    });
    
    // Check for and clean up stale remote players (every 2 seconds instead of 5)
    if (Math.floor(Date.now() / 2000) % 1 === 0 && Math.random() < 0.02) { // Roughly every 2 seconds, increased probability
        const stalePlayerIds = [];
        const now = Date.now();
        
        remotePlayers.forEach((remotePlayer, playerId) => {
            // Check both the formal stale detection and a simple time-based check
            const timeSinceUpdate = now - remotePlayer.lastUpdateTime;
            const isTimedOut = timeSinceUpdate > 4000; // 4 seconds timeout (reduced from implied longer timeout)
            
            if (remotePlayer.isPlayerStale() || isTimedOut) {
                console.log(`🧹 Player ${playerId} is stale (${timeSinceUpdate}ms since update)`);
                stalePlayerIds.push(playerId);
            }
        });
        
        if (stalePlayerIds.length > 0) {
            console.log('🧹 Cleaning up stale remote players:', stalePlayerIds);
            stalePlayerIds.forEach(playerId => {
                const remotePlayer = remotePlayers.get(playerId);
                if (remotePlayer) {
                    remotePlayer.destroy();
                    remotePlayers.delete(playerId);
                    processedPlayerIds.delete(playerId);
                }
            });
            updatePlayerCount();
        }
    }
    
    // Update weapon system (if loaded)
    if (weapon) {
        weapon.update(0.016); // Assuming ~60fps
        
        // Debug weapon state occasionally
        if (frameCount % 300 === 0) { // Every 5 seconds at 60fps
            console.log('🔫 Weapon debug:', {
                activeBullets: weapon.activeBullets?.length || 0,
                targetColliders: weapon.targetColliders?.size || 0,
                magAmmo: weapon.magAmmo,
                isShooting: weapon.isShooting
            });
        }
    }
    
    // Update targets (if loaded)
    if (targetManager) {
        targetManager.update(time);
    }
    
    // Update HUD with player info
    if (player.isLocked) {
        const speed = Math.sqrt(player.velocity.x * player.velocity.x + player.velocity.z * player.velocity.z);
        const pos = player.camera.position;
        document.getElementById('speed').textContent = `Speed: ${speed.toFixed(1)}`;
        document.getElementById('position').textContent = `Position: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`;
        document.getElementById('hud').classList.add('active');
        
        // Update additional HUD elements (if systems loaded)
        if (targetManager) {
            updateTargetsDisplay();
        }
    } else {
        document.getElementById('hud').classList.remove('active');
    }
    
    // ...existing animation code...
    
    // Dynamic lighting
    directionalLight.intensity = 0.8 + Math.sin(time * 0.5) * 0.2;
    
    renderer.render(scene, camera);
}

animate();

// Debug function to test bullet trails
window.testBulletTrail = function() {
    console.log('🧪 Testing bullet trail...');
    
    // Create a test bullet from camera position
    const startPos = window.gamePlayer.camera.position.clone();
    startPos.y += 0.2; // Slightly above camera
    
    const direction = new THREE.Vector3();
    window.gamePlayer.camera.getWorldDirection(direction);
    
    console.log('Test bullet from:', startPos, 'direction:', direction);
    
    // Create test bullet
    const bulletGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const bulletMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xff00ff, // Magenta test bullet
        transparent: true,
        opacity: 1.0
    });
    
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
    bullet.position.copy(startPos);
    scene.add(bullet);
    
    // Animate test bullet
    const speed = 20;
    const velocity = direction.clone().multiplyScalar(speed);
    let time = 0;
    const maxTime = 5;
    
    const animateTestBullet = () => {
        time += 0.016;
        
        if (time > maxTime) {
            scene.remove(bullet);
            bullet.geometry.dispose();
            bullet.material.dispose();
            console.log('🗑️ Test bullet cleaned up');
            return;
        }
        
        bullet.position.add(velocity.clone().multiplyScalar(0.016));
        console.log('Test bullet position:', bullet.position);
        
        requestAnimationFrame(animateTestBullet);
    };
    
    animateTestBullet();
}

// Debug function to check target and collider state
window.debugTargets = function() {
    console.log('=== TARGET DEBUG ===');
    
    if (window.targetManager) {
        console.log('Target manager exists:', window.targetManager);
        console.log('Total targets:', window.targetManager.targets.length);
        
        window.targetManager.targets.forEach((target, index) => {
            console.log(`Target ${index + 1}:`, {
                id: target.userData.targetId,
                position: target.position,
                health: target.userData.health,
                isTarget: target.userData.isTarget,
                locallyDestroyed: target.userData.locallyDestroyed,
                visible: target.visible,
                inScene: !!target.parent
            });
        });
    } else {
        console.log('No target manager found');
    }
    
    if (window.weapon) {
        console.log('Weapon exists:', window.weapon);
        console.log('Target colliders:', window.weapon.targetColliders.size);
        console.log('Weapon loaded:', window.weapon.isLoaded);
        console.log('Mag ammo:', window.weapon.magAmmo);
        
        window.weapon.targetColliders.forEach((collider, target) => {
            console.log('Collider for target:', {
                targetId: target.userData.targetId,
                colliderPos: collider.position,
                targetPos: target.position,
                colliderVisible: collider.visible,
                parentTarget: collider.userData.parentTarget === target,
                inScene: !!collider.parent
            });
        });
    } else {
        console.log('No weapon found');
    }
    
    console.log('=== END TARGET DEBUG ===');
};

// Debug function to test basic shooting mechanics
window.testShoot = function() {
    console.log('=== MANUAL SHOOT TEST ===');
    
    if (window.weapon && window.weapon.shoot) {
        console.log('Forcing a shot...');
        const result = window.weapon.shoot();
        console.log('Shot result:', result);
        console.log('Active bullets after shot:', window.weapon.activeBullets.length);
        
        // Check if bullets are moving
        setTimeout(() => {
            console.log('Bullets after 1 second:', window.weapon.activeBullets.length);
            if (window.weapon.activeBullets.length > 0) {
                console.log('First bullet position:', window.weapon.activeBullets[0].mesh.position);
            }
        }, 1000);
    } else {
        console.log('No weapon available for test');
    }
    
    console.log('=== END SHOOT TEST ===');
};

// Debug function to check mouse input
window.testInput = function() {
    console.log('=== INPUT TEST ===');
    console.log('Pointer lock element:', document.pointerLockElement);
    console.log('Weapon loaded:', window.weapon?.isLoaded);
    console.log('Is shooting:', window.weapon?.isShooting);
    
    // Test manual shooting trigger
    if (window.weapon) {
        console.log('Testing manual shooting...');
        window.weapon.startShooting();
        setTimeout(() => {
            window.weapon.stopShooting();
            console.log('Manual shooting test complete');
        }, 200);
    }
    
    console.log('=== END INPUT TEST ===');
};

// Debug function to enable weapon collider visualization
window.weaponDebug = function() {
    if (window.weapon) {
        console.log('🔧 Enabling weapon debug mode...');
        window.weapon.debugMode = true;
        
        // Make all target colliders visible
        window.weapon.targetColliders.forEach((collider, target) => {
            collider.material.visible = true;
            collider.material.wireframe = true;
            collider.material.opacity = 0.5;
            console.log('🔧 Made collider visible for target:', target.userData.targetId);
        });
        
        console.log('🔧 Debug mode enabled. Target colliders should now be visible as red wireframes.');
    } else {
        console.log('❌ No weapon found for debug mode');
    }
};

// Debug function to make all target colliders visible
window.showColliders = () => {
    if (window.weapon && window.weapon.targetColliders) {
        let count = 0;
        window.weapon.targetColliders.forEach((collider, target) => {
            collider.material.visible = true;
            collider.material.wireframe = true;
            collider.material.opacity = 0.5;
            collider.material.color.setHex(0xff0000);
            count++;
        });
        console.log(`Made ${count} target colliders visible`);
    } else {
        console.log('No weapon system or target colliders found');
    }
};

// Debug function to hide all target colliders
window.hideColliders = () => {
    if (window.weapon && window.weapon.targetColliders) {
        let count = 0;
        window.weapon.targetColliders.forEach((collider, target) => {
            collider.material.visible = false;
            count++;
        });
        console.log(`Hid ${count} target colliders`);
    } else {
        console.log('No weapon system or target colliders found');
    }
};

// Debug function to test collision detection
window.testCollision = () => {
    if (window.weapon && window.weapon.targetColliders) {
        console.log('🧪 Testing collision detection...');
        
        // Get first target
        const firstTarget = Array.from(window.weapon.targetColliders.keys())[0];
        if (!firstTarget) {
            console.log('❌ No targets found');
            return;
        }
        
        console.log('🎯 Testing with target:', firstTarget.userData.targetId);
        
        // Create a fake bullet at the target position
        const fakeBullet = {
            mesh: {
                position: firstTarget.position.clone()
            }
        };
        
        // Test collision
        const hit = window.weapon.checkBulletColliderCollision(fakeBullet, firstTarget.position.clone());
        console.log('🧪 Collision test result:', hit);
        
        return hit;
    } else {
        console.log('❌ No weapon system found');
    }
};

// Add global debug functions for easier testing
window.debugTargets = () => {
    console.log('🔍 CURRENT TARGET DEBUG INFO:');
    console.log('🔍 targetManager exists:', !!targetManager);
    console.log('🔍 targetManager.targets.length:', targetManager?.targets?.length || 'N/A');
    console.log('🔍 weapon exists:', !!window.weapon);
    console.log('🔍 weapon.targetColliders.size:', window.weapon?.targetColliders?.size || 'N/A');
    console.log('🔍 Scene children with target in name:', scene.children.filter(child => child.name && child.name.toLowerCase().includes('target')).length);
    console.log('🔍 Scene children with isTarget userData:', scene.children.filter(child => child.userData && child.userData.isTarget).length);
    
    if (targetManager && targetManager.targets) {
        console.log('🔍 Target details:');
        targetManager.targets.forEach((target, index) => {
            console.log(`  Target ${index}: ID=${target.userData.targetId}, pos=${target.position.x.toFixed(1)},${target.position.y.toFixed(1)},${target.position.z.toFixed(1)}`);
        });
    }
    
    if (window.weapon && window.weapon.targetColliders) {
        console.log('🔍 Weapon collider details:');
        Array.from(window.weapon.targetColliders.entries()).forEach(([target, collider]) => {
            console.log(`  Collider for target ${target.userData.targetId}: exists=${!!collider}`);
        });
    }
};

window.forceTargetScan = () => {
    console.log('🔍 FORCING TARGET SCAN...');
    if (window.weapon && window.weapon.scanForNewTargets) {
        const result = window.weapon.scanForNewTargets();
        console.log('🔍 Scan completed with result:', result);
        setTimeout(() => {
            window.debugTargets();
        }, 1000);
    } else {
        console.log('❌ Weapon system not available');
    }
};

window.testTargetCreation = () => {
    console.log('🧪 Testing target creation...');
    if (targetManager) {
        const testPosition = new THREE.Vector3(0, 2, -10);
        const testTarget = targetManager.createTarget(testPosition, {
            health: 100,
            points: 50,
            targetId: 'test-' + Date.now()
        });
        console.log('🧪 Test target created:', testTarget);
        setTimeout(() => {
            window.forceTargetScan();
        }, 500);
    } else {
        console.log('❌ Target manager not available');
    }
};

window.debugSpawnTarget = () => {
    console.log('🔧 Requesting manual target spawn from server...');
    if (networkManager && networkManager.socket) {
        networkManager.socket.emit('debugSpawnTarget', {});
        console.log('🔧 Target spawn request sent to server');
    } else {
        console.log('❌ Network manager not available');
    }
};

// Enhanced multiplayer debug functions
window.debugMultiplayer = () => {
    console.log('=== MULTIPLAYER DEBUG ===');
    console.log('🌐 Network connection:', networkManager?.isConnected || false);
    console.log('🆔 Local player ID:', networkManager?.playerId || 'N/A');
    console.log('👥 Remote players:', remotePlayers.size);
    console.log('📝 Processed player IDs:', processedPlayerIds.size);
    
    if (remotePlayers.size > 0) {
        console.log('👤 Remote player details:');
        remotePlayers.forEach((remotePlayer, playerId) => {
            const now = Date.now();
            const timeSinceUpdate = now - remotePlayer.lastUpdateTime;
            const timeSinceCreation = now - remotePlayer.createdTime;
            
            console.log(`  Player ${playerId}:`);
            console.log(`    - Updates received: ${remotePlayer.updateCount}`);
            console.log(`    - Last update: ${timeSinceUpdate}ms ago`);
            console.log(`    - Created: ${timeSinceCreation}ms ago`);
            console.log(`    - Position: ${remotePlayer.mesh?.position.x.toFixed(2)}, ${remotePlayer.mesh?.position.y.toFixed(2)}, ${remotePlayer.mesh?.position.z.toFixed(2)}`);
            console.log(`    - Is stale: ${remotePlayer.isPlayerStale()}`);
            console.log(`    - Mesh in scene: ${!!remotePlayer.mesh?.parent}`);
        });
    }
    
    console.log('=== END MULTIPLAYER DEBUG ===');
};

window.cleanupStalePlayers = () => {
    console.log('🧹 Manual stale player cleanup...');
    const stalePlayerIds = [];
    const now = Date.now();
    
    remotePlayers.forEach((remotePlayer, playerId) => {
        const timeSinceUpdate = now - remotePlayer.lastUpdateTime;
        const isStale = remotePlayer.isPlayerStale() || timeSinceUpdate > 3000; // 3 second threshold
        
        if (isStale) {
            console.log(`🧹 Found stale player ${playerId} (${timeSinceUpdate}ms since update)`);
            stalePlayerIds.push(playerId);
        }
    });
    
    if (stalePlayerIds.length > 0) {
        console.log('🧹 Removing stale players:', stalePlayerIds);
        stalePlayerIds.forEach(playerId => {
            const remotePlayer = remotePlayers.get(playerId);
            if (remotePlayer) {
                remotePlayer.destroy();
                remotePlayers.delete(playerId);
                processedPlayerIds.delete(playerId);
            }
        });
        updatePlayerCount();
        console.log('✅ Cleanup complete');
    } else {
        console.log('✅ No stale players found');
    }
};

window.forceCleanAllPlayers = () => {
    console.log('🚨 FORCE CLEANING ALL REMOTE PLAYERS...');
    remotePlayers.forEach((remotePlayer, playerId) => {
        console.log(`🧹 Force removing player: ${playerId}`);
        remotePlayer.destroy();
    });
    remotePlayers.clear();
    processedPlayerIds.clear();
    updatePlayerCount();
    console.log('🚨 All remote players forcibly removed');
};

window.testMultiplayerFix = () => {
    console.log('🧪 Testing multiplayer fix...');
    window.debugMultiplayer();
    
    // Test stale detection
    console.log('🧪 Testing stale player detection...');
    remotePlayers.forEach((remotePlayer, playerId) => {
        console.log(`Player ${playerId} is stale: ${remotePlayer.isPlayerStale()}`);
    });
    
    // Test cleanup
    console.log('🧪 Running cleanup...');
    window.cleanupStalePlayers();
    
    // Final state
    setTimeout(() => {
        console.log('🧪 Final state after test:');
        window.debugMultiplayer();
    }, 1000);
};

// Debug function to check current target status
window.debugTargetStatus = () => {
    console.log('=== COMPLETE TARGET STATUS ===');
    console.log('🎯 Client-side targets:');
    
    if (targetManager && targetManager.targets) {
        console.log(`  - Target manager targets: ${targetManager.targets.length}`);
        targetManager.targets.forEach((target, index) => {
            console.log(`    Target ${index}: ID=${target.userData.targetId}, pos=${target.position.x.toFixed(1)},${target.position.y.toFixed(1)},${target.position.z.toFixed(1)}, health=${target.userData.health}`);
        });
    } else {
        console.log('  - No target manager or targets');
    }
    
    console.log('🔫 Weapon system:');
    if (window.weapon) {
        console.log(`  - Target colliders: ${window.weapon.targetColliders?.size || 0}`);
        if (window.weapon.targetColliders) {
            window.weapon.targetColliders.forEach((collider, target) => {
                console.log(`    Collider for: ${target.userData.targetId}`);
            });
        }
    } else {
        console.log('  - No weapon system');
    }
    
    console.log('🌐 Network:');
    console.log(`  - Connected: ${networkManager?.isConnected || false}`);
    console.log(`  - Player ID: ${networkManager?.playerId || 'N/A'}`);
    
    console.log('=== END TARGET STATUS ===');
};

window.testReconnectionScenario = () => {
    console.log('🧪 Testing reconnection scenario...');
    
    // First, show current state
    console.log('🧪 Initial state:');
    window.debugMultiplayer();
    
    // Simulate a stale player by manually setting its lastUpdateTime to old value
    if (remotePlayers.size > 0) {
        const firstPlayer = remotePlayers.values().next().value;
        const oldTime = firstPlayer.lastUpdateTime;
        firstPlayer.lastUpdateTime = Date.now() - 6000; // 6 seconds ago
        
        console.log('🧪 Artificially made a player stale (6s old update)');
        console.log('🧪 Player is now stale:', firstPlayer.isPlayerStale());
        
        // Test cleanup
        setTimeout(() => {
            console.log('🧪 Running cleanup after making player stale...');
            window.cleanupStalePlayers();
            
            // Show final state
            setTimeout(() => {
                console.log('🧪 Final state after cleanup:');
                window.debugMultiplayer();
            }, 500);
        }, 1000);
    } else {
        console.log('🧪 No remote players to test with');
    }
};

window.testMovementDelay = () => {
    console.log('🧪 Testing movement delay fix...');
    
    if (remotePlayers.size > 0) {
        remotePlayers.forEach((remotePlayer, playerId) => {
            console.log(`🧪 Player ${playerId}:`);
            console.log(`  - Current position: ${remotePlayer.mesh?.position.x.toFixed(2)}, ${remotePlayer.mesh?.position.y.toFixed(2)}, ${remotePlayer.mesh?.position.z.toFixed(2)}`);
            console.log(`  - Target position: ${remotePlayer.targetPosition.x.toFixed(2)}, ${remotePlayer.targetPosition.y.toFixed(2)}, ${remotePlayer.targetPosition.z.toFixed(2)}`);
            console.log(`  - Distance to target: ${remotePlayer.mesh?.position.distanceTo(remotePlayer.targetPosition).toFixed(2)}`);
            console.log(`  - Updates received: ${remotePlayer.updateCount}`);
        });
    } else {
        console.log('🧪 No remote players to test with');
    }
};