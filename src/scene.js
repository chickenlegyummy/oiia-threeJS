import * as THREE from 'three';
import { Player } from './player.js';
import { Weapon } from './weapon.js';
import { TargetManager } from './targets.js';
import { MultiplayerManager } from './multiplayer-client.js';

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

// Create camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
// Camera position will be managed by Player class

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

// Initialize player (must be done before weapon system)
const player = new Player(camera, scene);

// Initialize weapon system
let weapon = null;
let targetManager = null;
let multiplayerManager = null;

// Initialize systems asynchronously
async function initializeSystems() {
    try {
        console.log('Starting initialization of FPS systems...');
        
        // Wait a frame to ensure player body is created
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        // Initialize weapon system with player body
        weapon = new Weapon(camera, scene, audioListener, player.getPlayerBody(), player);
        
        // Initialize target system
        targetManager = new TargetManager(scene);
        
        // Initialize multiplayer AFTER other systems are ready
        multiplayerManager = new MultiplayerManager(scene, camera, player, weapon, targetManager);
        window.multiplayerManager = multiplayerManager;
        
        // Modify target manager to NOT spawn initial targets (server will provide them)
        targetManager.spawnInitialTargets = () => {}; // Override to prevent client-side spawning
        
        // Set up callbacks after initialization
        if (targetManager) {
            targetManager.onTargetDestroyed = (points) => {
                // Score is now handled by server
            };
        }
        
        if (weapon) {
            weapon.onAmmoChange = (mag, total) => {
                updateAmmoDisplay(mag, total);
            };
            
            // Modify weapon collision detection to include players
            const originalCheckCollision = weapon.checkBulletColliderCollision.bind(weapon);
            weapon.checkBulletColliderCollision = function(bullet, prevPosition) {
                // First check player collisions
                if (multiplayerManager && multiplayerManager.checkPlayerCollisions(bullet)) {
                    return true;
                }
                // Then check regular collisions
                return originalCheckCollision(bullet, prevPosition);
            };
        }
        
        console.log('FPS systems initialization completed');
    } catch (error) {
        console.error('Error initializing FPS systems:', error);
    }
}

// Initialize systems
initializeSystems();

// Score system (now handled by multiplayer)
let score = 0;

// HUD update functions
function updateAmmoDisplay(mag, total) {
    const ammoElement = document.getElementById('ammo');
    if (ammoElement) {
        ammoElement.innerHTML = `Ammo: ${mag}/${total}`;
    }
}

function updateHealthDisplay(health) {
    const healthElement = document.getElementById('health');
    if (!healthElement) {
        // Create health display if it doesn't exist
        const hud = document.getElementById('hud');
        const healthDiv = document.createElement('div');
        healthDiv.id = 'health';
        healthDiv.innerHTML = `Health: ${health}`;
        hud.insertBefore(healthDiv, hud.firstChild);
    } else {
        healthElement.innerHTML = `Health: ${health}`;
    }
}

// Initialize health display
updateHealthDisplay(100);

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

function animate() {
    requestAnimationFrame(animate);
    
    time += 0.016;
    frameCount++;
    
    // Update FPS counter every second
    const currentTime = performance.now();
    if (currentTime - lastFpsTime >= 1000) {
        const fps = Math.round((frameCount * 1000) / (currentTime - lastFpsTime));
        document.getElementById('fps').textContent = `FPS: ${fps}`;
        frameCount = 0;
        lastFpsTime = currentTime;
    }
    
    // Update player
    player.update();
    
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
        const pos = player.getCameraWorldPosition();
        document.getElementById('position').textContent = `Position: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`;
        document.getElementById('hud').classList.add('active');
    } else {
        document.getElementById('hud').classList.remove('active');
    }
    
    // Dynamic lighting
    directionalLight.intensity = 0.8 + Math.sin(time * 0.5) * 0.2;
    
    renderer.render(scene, camera);
}

animate();