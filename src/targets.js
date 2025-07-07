import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class TargetManager {
    constructor(scene) {
        this.scene = scene;
        this.targets = [];
        this.loader = new GLTFLoader();
        this.targetModel = null;
        this.onTargetDestroyed = null; // Callback for score updates
        
        this.init();
    }
    
    async init() {
        try {
            await this.loadTargetModel();
            this.spawnInitialTargets();
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
                    console.log('Cat model loaded successfully');
                    resolve();
                },
                (progress) => {
                    console.log('Loading cat model:', (progress.loaded / progress.total * 100) + '%');
                },
                (error) => {
                    console.warn('Could not load cat model, using fallback:', error);
                    this.createFallbackModel();
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
            console.warn('Target model not loaded yet');
            return null;
        }
        
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
        target.userData.id = Math.random().toString(36).substr(2, 9);
        
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
                
                // Store original material properties
                if (child.material) {
                    child.userData.originalColor = child.material.color.clone();
                    child.userData.originalEmissive = child.material.emissive ? child.material.emissive.clone() : new THREE.Color(0x000000);
                }
            }
        });
        
        // Set up hit behavior
        target.userData.onHit = (hitInfo) => {
            this.onTargetHit(target, hitInfo);
        };
        
        // Add to scene and track
        this.scene.add(target);
        this.targets.push(target);
        
        // Notify weapon system about new target (if available)
        if (window.weaponSystem && window.weaponSystem.scanForNewTargets) {
            setTimeout(() => {
                window.weaponSystem.scanForNewTargets();
                console.log('Target created - notifying weapon system to scan');
            }, 100); // Small delay to ensure target is fully added to scene
        }
        
        return target;
    }
    
    onTargetHit(target, hitInfo) {
        const damage = 25; // Damage per hit
        target.userData.health -= damage;
        
        console.log(`Target hit! Health: ${target.userData.health}/${target.userData.maxHealth}`);
        
        // Visual feedback
        this.showHitEffect(target);
        
        if (target.userData.health <= 0) {
            this.destroyTarget(target);
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
    
    destroyTarget(target) {
        console.log(`Target destroyed! Points: ${target.userData.points}`);
        
        // Create destruction effect
        this.createDestructionEffect(target.position);
        
        // Remove from tracking and scene
        const index = this.targets.indexOf(target);
        if (index > -1) {
            this.targets.splice(index, 1);
        }
        
        this.scene.remove(target);
        
        // Notify score system
        if (this.onTargetDestroyed) {
            this.onTargetDestroyed(target.userData.points);
        }
        
        // Respawn after delay
        setTimeout(() => {
            this.spawnRandomTarget();
        }, 2000 + Math.random() * 3000);
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
    }
}
