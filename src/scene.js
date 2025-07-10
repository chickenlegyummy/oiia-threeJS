import * as THREE from 'three';
import { Player } from './player.js';
import { Weapon } from './weapon.js';
import { TargetManager } from './targets.js';
import { NetworkManager, RemotePlayer } from './network.js';

// Create scene
const scene = new THREE.Scene();

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
},
// onProgress
(progress) => {
    console.log('Skybox loading progress');
},
// onError
(error) => {
    console.error('Error loading skybox cube texture:', error);
    // Fallback to solid color background
    scene.background = new THREE.Color(0x87CEEB);
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

// Expose player globally for debug functions
window.gamePlayer = player;

// Initialize multiplayer
const networkManager = new NetworkManager();
const remotePlayers = new Map();

// Expose for debugging
window.networkManager = networkManager;
window.remotePlayers = remotePlayers;

// Set up networking callbacks
networkManager.onPlayerJoined = (playerData) => {
    console.log('🎮 Creating remote player:', playerData.id);
    try {
        const remotePlayer = new RemotePlayer(scene, playerData);
        remotePlayers.set(playerData.id, remotePlayer);
        updatePlayerCount();
        console.log('👥 Total remote players:', remotePlayers.size);
    } catch (error) {
        console.error('❌ Error creating remote player:', error);
    }
};

networkManager.onPlayerLeft = (playerId) => {
    console.log('🚪 Removing remote player:', playerId);
    const remotePlayer = remotePlayers.get(playerId);
    if (remotePlayer) {
        remotePlayer.destroy();
        remotePlayers.delete(playerId);
    }
    updatePlayerCount();
    console.log('👥 Total remote players:', remotePlayers.size);
};

networkManager.onPlayerUpdate = (playerUpdates) => {
    // console.log('🔄 Updating', playerUpdates.size, 'remote players');
    playerUpdates.forEach((playerData, playerId) => {
        const remotePlayer = remotePlayers.get(playerId);
        if (remotePlayer) {
            remotePlayer.updateFromNetwork(playerData);
        } else {
            // Create new remote player if not exists
            console.log('🆕 Creating new remote player from update:', playerId);
            try {
                const newRemotePlayer = new RemotePlayer(scene, playerData);
                remotePlayers.set(playerId, newRemotePlayer);
                updatePlayerCount();
            } catch (error) {
                console.error('❌ Error creating remote player from update:', error);
            }
        }
    });
};

networkManager.onPlayerShot = (shotData) => {
    console.log('🔫 Player shot event received:', shotData);
    
    // Find the remote player who shot
    const remotePlayer = remotePlayers.get(shotData.playerId);
    if (remotePlayer) {
        remotePlayer.onShoot(shotData);
    } else {
        // If remote player not found, just create a basic effect
        console.warn('⚠️ Shot from unknown player:', shotData.playerId);
        createGenericShotEffect(shotData);
    }
};

// Create a generic shot effect if we don't have the remote player
function createGenericShotEffect(shotData) {
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
    
    // Create a simple bullet trail
    const bulletGeometry = new THREE.SphereGeometry(0.02, 4, 4);
    const bulletMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xff6b6b,
        transparent: true,
        opacity: 0.8
    });
    
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
    bullet.position.copy(startPos);
    scene.add(bullet);
    
    // Animate bullet
    const speed = 50;
    const velocity = direction.clone().multiplyScalar(speed);
    let time = 0;
    const maxTime = 2;
    
    const animateBullet = () => {
        time += 0.016;
        
        if (time > maxTime) {
            scene.remove(bullet);
            bullet.geometry.dispose();
            bullet.material.dispose();
            return;
        }
        
        bullet.position.add(velocity.clone().multiplyScalar(0.016));
        bullet.material.opacity = Math.max(0, 0.8 * (1 - time / maxTime));
        
        requestAnimationFrame(animateBullet);
    };
    
    animateBullet();
}

networkManager.onTargetDestroyed = (destroyData) => {
    // Handle target destruction from other players
    if (targetManager) {
        targetManager.destroyTargetById(destroyData.targetId, false); // false = don't send network event
        if (destroyData.playerId !== networkManager.playerId) {
            console.log(`Player ${destroyData.playerId} destroyed a target`);
        }
    }
};

networkManager.onGameStateReceived = (gameState) => {
    console.log('🎮 Initial game state received, players:', gameState.players.length);
    updatePlayerCount();
    updateConnectionStatus(true);
    
    // Create remote players from initial state
    gameState.players.forEach(playerData => {
        if (playerData.id !== networkManager.playerId) {
            console.log('🧑‍🤝‍🧑 Creating initial remote player:', playerData.id);
            try {
                const remotePlayer = new RemotePlayer(scene, playerData);
                remotePlayers.set(playerData.id, remotePlayer);
            } catch (error) {
                console.error('❌ Error creating initial remote player:', error);
            }
        }
    });
    updatePlayerCount();
};

networkManager.onConnectionChange = (connected) => {
    updateConnectionStatus(connected);
    if (!connected) {
        // Clear remote players when disconnected
        remotePlayers.forEach(remotePlayer => {
            remotePlayer.destroy();
        });
        remotePlayers.clear();
        updatePlayerCount();
    }
};

// Connect to multiplayer server immediately
console.log('🚀 Initializing multiplayer connection...');
networkManager.connect();

// Initialize weapon system
let weapon = null;
let targetManager = null;

// Initialize systems asynchronously
async function initializeSystems() {
    try {
        console.log('Starting initialization of FPS systems...');
        
        // Initialize weapon system with player body
        weapon = new Weapon(camera, scene, audioListener, player.getPlayerBody(), player, networkManager);
        
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
        
        // Set up callbacks after initialization
        if (targetManager) {
            targetManager.onTargetDestroyed = (points) => {
                score += points;
                updateScoreDisplay();
            };
        }
        
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
    } catch (error) {
        console.error('Error initializing FPS systems:', error);
    }
}

// Initialize systems
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
            // Opening debug panel - release pointer lock
            if (player.isLocked) {
                player.exitPointerLock();
            }
        } else {
            // Closing debug panel - hide instructions and enable clicking to re-enter game
            instructions.style.display = 'none';
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
    
    // Update weapon system (if loaded)
    if (weapon) {
        weapon.update(0.016); // Assuming ~60fps
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