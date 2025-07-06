import { Player } from './player.js';

// Create scene
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x87CEEB, 50, 200); // Add atmospheric fog

// Create camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 5); // Eye level height

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

// Enhanced lighting setup
const ambientLight = new THREE.AmbientLight(0x87CEEB, 0.2);
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

// Create more interesting objects with varied materials
const materials = [
    new THREE.MeshStandardMaterial({ color: 0xff6b6b, roughness: 0.3, metalness: 0.1 }),
    new THREE.MeshStandardMaterial({ color: 0x4ecdc4, roughness: 0.5, metalness: 0.2 }),
    new THREE.MeshStandardMaterial({ color: 0x45b7d1, roughness: 0.4, metalness: 0.3 }),
    new THREE.MeshStandardMaterial({ color: 0xf9ca24, roughness: 0.6, metalness: 0.1 }),
    new THREE.MeshStandardMaterial({ color: 0x6c5ce7, roughness: 0.3, metalness: 0.4 })
];

// Main target cube
const cubeGeometry = new THREE.BoxGeometry(2, 2, 2);
const cube = new THREE.Mesh(cubeGeometry, materials[0]);
cube.position.set(0, 1, -10);
cube.castShadow = true;
cube.receiveShadow = true;
scene.add(cube);

// Create varied geometry objects
const geometries = [
    new THREE.BoxGeometry(1.5, 1.5, 1.5),
    new THREE.SphereGeometry(1, 16, 16),
    new THREE.ConeGeometry(1, 2, 8),
    new THREE.CylinderGeometry(0.8, 0.8, 2, 12),
    new THREE.OctahedronGeometry(1.2)
];

// Scatter objects around the scene
const objects = [];
for (let i = 0; i < 15; i++) {
    const geometry = geometries[Math.floor(Math.random() * geometries.length)];
    const material = materials[Math.floor(Math.random() * materials.length)];
    const mesh = new THREE.Mesh(geometry, material);
    
    mesh.position.set(
        (Math.random() - 0.5) * 50,
        Math.random() * 3 + 0.5,
        -5 - Math.random() * 30
    );
    
    mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
    );
    
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    objects.push(mesh);
    scene.add(mesh);
}

// Add some atmospheric particles
const particleCount = 100;
const particleGeometry = new THREE.BufferGeometry();
const particlePositions = new Float32Array(particleCount * 3);

for (let i = 0; i < particleCount * 3; i += 3) {
    particlePositions[i] = (Math.random() - 0.5) * 100;     // x
    particlePositions[i + 1] = Math.random() * 20;          // y
    particlePositions[i + 2] = (Math.random() - 0.5) * 100; // z
}

particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
const particleMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.1,
    transparent: true,
    opacity: 0.6
});

const particles = new THREE.Points(particleGeometry, particleMaterial);
scene.add(particles);

// Initialize player
const player = new Player(camera, scene);

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
function animate() {
    requestAnimationFrame(animate);
    
    time += 0.016;
    
    // Update player
    player.update();
    
    // Animate main cube
    cube.rotation.x += 0.008;
    cube.rotation.y += 0.012;
    cube.position.y = 1 + Math.sin(time * 2) * 0.2;
    
    // Animate scattered objects
    objects.forEach((obj, index) => {
        obj.rotation.x += 0.005 * (index % 3 + 1);
        obj.rotation.y += 0.008 * (index % 2 + 1);
        obj.position.y += Math.sin(time * 3 + index) * 0.002;
    });
    
    // Animate particles
    const positions = particles.geometry.attributes.position.array;
    for (let i = 1; i < positions.length; i += 3) {
        positions[i] += Math.sin(time + i) * 0.001;
    }
    particles.geometry.attributes.position.needsUpdate = true;
    particles.rotation.y += 0.001;
    
    // Dynamic lighting
    directionalLight.intensity = 0.8 + Math.sin(time * 0.5) * 0.2;
    
    renderer.render(scene, camera);
}

animate();