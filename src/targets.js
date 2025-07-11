import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class TargetManager {
    constructor(scene, networkManager = null) {
        this.scene = scene;
        this.networkManager = networkManager;
        this.targets = [];
        this.loader = new GLTFLoader();
        this.targetModel = null;
        this.onTargetDestroyed = null; // Callback for score updates
        this.isModelLoaded = false; // Track if the target model is ready
        
        this.init();
    }
    
    async init() {
        try {
            await this.loadTargetModel();
            
            // Don't spawn initial targets automatically in multiplayer - they come from server
            // But spawn a few test targets if we're in development mode or server targets fail to load
            if (!this.networkManager) {
                // Singleplayer mode - spawn targets immediately
                console.log('🎯 Singleplayer mode - spawning initial targets');
                this.spawnInitialTargets();
            } else {
                // Multiplayer mode - DO NOT create fallback targets automatically
                // The server will send targets via gameState and targetSpawned events
                console.log('🎯 Multiplayer mode - waiting for server targets (NO fallback targets)');
                console.log('🎯 Targets will be created when server sends gameState or targetSpawned events');
            }
            
            console.log('Target system initialized');
        } catch (error) {
            console.error('Error initializing target system:', error);
        }
    }
    
    async loadTargetModel() {
        return new Promise((resolve, reject) => {
            this.loader.load(
                'models/oiia_cat.glb',
                (gltf) => {
                    this.targetModel = gltf.scene;
                    this.isModelLoaded = true;
                    console.log('✅ Cat model loaded successfully - target creation now possible');
                    resolve();
                },
                (progress) => {
                    console.log('Loading cat model:', (progress.loaded / progress.total * 100) + '%');
                },
                (error) => {
                    console.warn('Could not load cat model, using fallback:', error);
                    this.createFallbackModel();
                    this.isModelLoaded = true;
                    console.log('✅ Fallback model created - target creation now possible');
                    resolve();
                }
            );
        });
    }
    
    createFallbackModel() {
        // Create a simple cat-like shape as fallback
        const group = new THREE.Group();
        
        // Body
        const bodyGeometry = new THREE.BoxGeometry(0.6, 0.3, 0.8);
        const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xff6b6b });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.15;
        group.add(body);
        
        // Head
        const headGeometry = new THREE.SphereGeometry(0.2, 12, 8);
        const headMaterial = new THREE.MeshStandardMaterial({ color: 0xff8888 });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.set(0, 0.4, 0.3);
        group.add(head);
        
        // Ears
        const earGeometry = new THREE.ConeGeometry(0.08, 0.15, 6);
        const earMaterial = new THREE.MeshStandardMaterial({ color: 0xff4444 });
        
        const leftEar = new THREE.Mesh(earGeometry, earMaterial);
        leftEar.position.set(-0.1, 0.55, 0.25);
        group.add(leftEar);
        
        const rightEar = new THREE.Mesh(earGeometry, earMaterial);
        rightEar.position.set(0.1, 0.55, 0.25);
        group.add(rightEar);
        
        // Tail
        const tailGeometry = new THREE.CylinderGeometry(0.03, 0.06, 0.5, 8);
        const tailMaterial = new THREE.MeshStandardMaterial({ color: 0xff5555 });
        const tail = new THREE.Mesh(tailGeometry, tailMaterial);
        tail.position.set(0, 0.3, -0.4);
        tail.rotation.x = Math.PI / 6;
        group.add(tail);
        
        this.targetModel = group;
        console.log('Created fallback cat model');
    }
    
    createTarget(position = new THREE.Vector3(), options = {}) {
        if (!this.targetModel) {
            console.error('❌ CRITICAL: Target model not loaded yet - this is why targets are not being created!');
            console.error('❌ targetModel is:', this.targetModel);
            console.error('❌ This means the target model is still loading when createTarget is called');
            return null;
        }
        
        console.log('✅ Target model is loaded, proceeding with target creation');
        
        // Clone the model
        const target = this.targetModel.clone();
        
        // Set position
        target.position.copy(position);
        
        // Set scale
        const scale = options.scale || 1.0;
        target.scale.setScalar(scale);
        
        // Set rotation
        if (options.rotation) {
            target.rotation.copy(options.rotation);
        } else {
            target.rotation.y = Math.random() * Math.PI * 2;
        }
        
        // Configure target properties
        target.userData.isTarget = true;
        target.userData.health = options.health || 100;
        target.userData.maxHealth = target.userData.health;
        target.userData.points = options.points || 10;
        
        // Use provided target ID or generate one for singleplayer
        if (options.targetId) {
            target.userData.targetId = options.targetId.toString();
            console.log(`🎯 Target created with server ID: ${options.targetId}`);
        } else {
            // If no server ID is provided, this means we're in fallback mode
            // Use numeric IDs that match server format to prevent conflicts
            const fallbackId = Date.now().toString() + Math.floor(Math.random() * 1000);
            target.userData.targetId = fallbackId;
            console.log(`🎯 Target created with fallback numeric ID: ${target.userData.targetId}`);
            console.warn(`⚠️ Creating target without server ID - this may cause sync issues`);
        }
        
        // Animation properties
        target.userData.bobSpeed = 0.5 + Math.random() * 1.0;
        target.userData.bobHeight = 0.1 + Math.random() * 0.2;
        target.userData.rotationSpeed = (Math.random() - 0.5) * 0.5;
        target.userData.initialY = position.y;
        
        // Set up materials and shadows
        target.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                
                // Clone material to ensure each target has its own material instance
                if (child.material) {
                    child.material = child.material.clone();
                    child.userData.originalColor = child.material.color.clone();
                    child.userData.originalEmissive = child.material.emissive ? child.material.emissive.clone() : new THREE.Color(0x000000);
                    child.userData.originalOpacity = child.material.opacity || 1.0; // Store original opacity
                }
            }
        });
        
        // Set up hit behavior with network awareness
        target.userData.onHit = (hitInfo, sendToNetwork = true) => {
            this.onTargetHit(target, hitInfo, sendToNetwork);
        };
        
        // Add to scene and track
        this.scene.add(target);
        this.targets.push(target);
        
        console.log(`🎯 Target added to scene and tracked. Total targets: ${this.targets.length}`);
        console.log(`🎯 Target position:`, target.position);
        console.log(`🎯 Target userData:`, target.userData);
        console.log(`🎯 Target added to scene children count:`, this.scene.children.length);
        
        // Wait a frame to ensure target is fully added to scene, then notify weapon system
        setTimeout(() => {
            if (window.weapon && window.weapon.scanForNewTargets) {
                console.log('🎯 Target fully added - triggering weapon scan...');
                window.weapon.scanForNewTargets();
                console.log('🎯 Weapon scan triggered after target addition');
            } else {
                console.log('🎯 Weapon system not available yet for target registration');
            }
        }, 50); // Reduced delay but still ensure target is fully processed
        
        return target;
    }
    
    onTargetHit(target, hitInfo, sendToNetwork = true) {
        const damage = hitInfo.damage || 25;
        
        console.log(`🎯 Target hit! SendToNetwork: ${sendToNetwork}, Damage: ${damage}`);
        console.log(`🎯 Target ID: ${target.userData.targetId}, Health: ${target.userData.health}/${target.userData.maxHealth}`);
        
        // Always show visual feedback immediately for responsive gameplay
        this.showHitEffect(target);
        
        // Apply damage locally for responsive gameplay
        const oldHealth = target.userData.health;
        target.userData.health = Math.max(0, target.userData.health - damage);
        console.log(`🎯 Damage applied! Health changed from ${oldHealth} to ${target.userData.health}/${target.userData.maxHealth}`);
        
        // Check for local destruction (but server will confirm)
        if (target.userData.health <= 0) {
            console.log(`🎯 Target destroyed! Health: ${target.userData.health}/${target.userData.maxHealth}`);
            
            // Actually destroy the target instead of just fading it
            this.destroyTarget(target, sendToNetwork);
            
            // Don't apply fade effect since we're destroying the target
            return;
        }
    }
    
    showHitEffect(target) {
        // Flash red
        target.traverse((child) => {
            if (child.isMesh && child.material) {
                const originalColor = child.userData.originalColor;
                child.material.color.setHex(0xff0000);
                child.material.emissive.setHex(0x440000);
                
                setTimeout(() => {
                    child.material.color.copy(originalColor);
                    child.material.emissive.copy(child.userData.originalEmissive);
                }, 150);
            }
        });
        
        // Create hit particle effect
        this.createHitParticles(target.position.clone().add(new THREE.Vector3(0, 0.5, 0)));
    }
    
    createHitParticles(position) {
        const particleCount = 10;
        const particles = [];
        
        for (let i = 0; i < particleCount; i++) {
            const particle = new THREE.Mesh(
                new THREE.SphereGeometry(0.02, 4, 4),
                new THREE.MeshBasicMaterial({
                    color: Math.random() > 0.5 ? 0xff4444 : 0xffaa00,
                    transparent: true,
                    opacity: 0.8
                })
            );
            
            particle.position.copy(position);
            particle.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                Math.random() * 2,
                (Math.random() - 0.5) * 2
            );
            
            this.scene.add(particle);
            particles.push(particle);
        }
        
        // Animate particles
        const startTime = Date.now();
        const animateParticles = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / 1000; // 1 second duration
            
            if (progress >= 1) {
                particles.forEach(particle => this.scene.remove(particle));
                return;
            }
            
            particles.forEach(particle => {
                particle.position.add(particle.velocity.clone().multiplyScalar(0.016));
                particle.velocity.y -= 0.1; // Gravity
                particle.material.opacity = 0.8 * (1 - progress);
            });
            
            requestAnimationFrame(animateParticles);
        };
        animateParticles();
    }
    
    destroyTarget(target, sendNetwork = true) {
        console.log(`🎯 Destroying target! Points: ${target.userData.points}, Send to network: ${sendNetwork}`);
        console.log(`🎯 Target ID: ${target.userData.targetId}`);
        console.log(`🎯 Network manager available: ${!!this.networkManager}`);
        
        // Create destruction effect
        this.createDestructionEffect(target.position);
        
        // Remove from weapon system's collision tracking
        if (window.weapon && window.weapon.removeTargetCollider) {
            window.weapon.removeTargetCollider(target);
            console.log(`🎯 Removed target from weapon collision system`);
        }
        
        // Remove from tracking and scene
        const index = this.targets.indexOf(target);
        if (index > -1) {
            this.targets.splice(index, 1);
            console.log(`🎯 Removed target from tracking. Remaining targets: ${this.targets.length}`);
        }
        
        this.scene.remove(target);
        console.log(`🎯 Removed target from scene`);
        
        // Notify score system
        if (this.onTargetDestroyed) {
            this.onTargetDestroyed(target.userData.points);
        }
        
        // Don't respawn targets automatically - server handles spawning new targets
        if (!this.networkManager) {
            // Only respawn in singleplayer mode
            console.log(`🎯 Singleplayer mode - scheduling target respawn`);
            setTimeout(() => {
                this.spawnRandomTarget();
            }, 2000 + Math.random() * 3000);
        } else {
            console.log(`🎯 Multiplayer mode - server will handle target respawning`);
        }
    }
    
    // Find and destroy target by ID (for multiplayer events)
    destroyTargetById(targetId, sendNetwork = true) {
        console.log(`🎯 Attempting to destroy target by ID: ${targetId}`);
        console.log(`🎯 Available targets:`, this.targets.map(t => ({ id: t.userData.targetId, pos: t.position })));
        
        const target = this.targets.find(t => t.userData.targetId === targetId.toString());
        if (target) {
            console.log(`🎯 Found target ${targetId}, destroying...`);
            this.destroyTarget(target, sendNetwork);
            return true;
        } else {
            console.warn(`🎯 Target ${targetId} not found for destruction!`);
            console.log(`🎯 Available target IDs:`, this.targets.map(t => t.userData.targetId));
            return false;
        }
    }
    
    createDestructionEffect(position) {
        const particleCount = 20;
        const particles = [];
        
        for (let i = 0; i < particleCount; i++) {
            const particle = new THREE.Mesh(
                new THREE.BoxGeometry(0.05, 0.05, 0.05),
                new THREE.MeshBasicMaterial({
                    color: new THREE.Color().setHSL(Math.random(), 0.7, 0.6),
                    transparent: true,
                    opacity: 1.0
                })
            );
            
            particle.position.copy(position);
            particle.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 4,
                Math.random() * 3 + 1,
                (Math.random() - 0.5) * 4
            );
            particle.angularVelocity = new THREE.Vector3(
                Math.random() * 0.2,
                Math.random() * 0.2,
                Math.random() * 0.2
            );
            
            this.scene.add(particle);
            particles.push(particle);
        }
        
        // Animate destruction particles
        const startTime = Date.now();
        const animateDestruction = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / 2000; // 2 second duration
            
            if (progress >= 1) {
                particles.forEach(particle => this.scene.remove(particle));
                return;
            }
            
            particles.forEach(particle => {
                particle.position.add(particle.velocity.clone().multiplyScalar(0.016));
                particle.velocity.y -= 0.15; // Gravity
                particle.velocity.multiplyScalar(0.98); // Air resistance
                
                particle.rotation.x += particle.angularVelocity.x;
                particle.rotation.y += particle.angularVelocity.y;
                particle.rotation.z += particle.angularVelocity.z;
                
                particle.material.opacity = 1.0 * (1 - progress);
            });
            
            requestAnimationFrame(animateDestruction);
        };
        animateDestruction();
    }
    
    // Check if target manager is ready to create targets
    isReady() {
        return this.isModelLoaded && this.targetModel !== null;
    }
    
    spawnInitialTargets() {
        const positions = [
            new THREE.Vector3(0, 2, -15),
            new THREE.Vector3(-8, 1.5, -20),
            new THREE.Vector3(8, 2.5, -18),
            new THREE.Vector3(-5, 1, -25),
            new THREE.Vector3(5, 3, -22),
            new THREE.Vector3(0, 1.5, -30),
            new THREE.Vector3(-12, 2, -35),
            new THREE.Vector3(12, 1.8, -32)
        ];
        
        positions.forEach((pos, index) => {
            setTimeout(() => {
                this.createTarget(pos, {
                    scale: 5 + Math.random() * 0.5,
                    health: 75 + Math.random() * 50,
                    points: 10 + Math.floor(Math.random() * 20)
                });
            }, index * 500); // Stagger spawning
        });
    }
    
    spawnRandomTarget() {
        const x = (Math.random() - 0.5) * 40;
        const y = 1 + Math.random() * 4;
        const z = -15 - Math.random() * 25;
        
        this.createTarget(new THREE.Vector3(x, y, z), {
            scale: 5 + Math.random() * 0.6,
            health: 50 + Math.random() * 100,
            points: 5 + Math.floor(Math.random() * 25)
        });
    }
    
    update(time) {
        // Animate targets
        this.targets.forEach(target => {
            if (!target.userData) return;
            
            // Bobbing animation
            const bobOffset = Math.sin(time * target.userData.bobSpeed) * target.userData.bobHeight;
            target.position.y = target.userData.initialY + bobOffset;
            
            // Rotation animation
            target.rotation.y += target.userData.rotationSpeed * 0.016;
        });
    }
    
    getTargetCount() {
        return this.targets.length;
    }
    
    clearAllTargets() {
        this.targets.forEach(target => {
            this.scene.remove(target);
        });
        this.targets = [];
        
        // Notify weapon system to clear its colliders
        if (window.weapon && window.weapon.clearAllTargetColliders) {
            window.weapon.clearAllTargetColliders();
            console.log('🎯 Notified weapon system to clear target colliders');
        }
    }
}
