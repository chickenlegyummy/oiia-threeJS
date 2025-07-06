import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class Weapon {
    constructor(camera, scene, audioListener) {
        this.camera = camera;
        this.scene = scene;
        this.audioListener = audioListener;
        
        // Weapon properties
        this.model = null;
        this.animations = {};
        this.mixer = null;
        this.stateMachine = null;
        
        // Shooting properties
        this.isLoaded = false;
        this.isShooting = false;
        this.fireRate = 0.1; // Time between shots in seconds
        this.shootTimer = 0.0;
        this.magAmmo = 30;
        this.maxAmmo = 30;
        this.totalAmmo = 120;
        this.damage = 10;
        this.range = 100;
        
        // Visual effects
        this.muzzleFlash = null;
        this.flashDuration = 0.05;
        this.flashTimer = 0;
        
        // Audio
        this.shootSound = null;
        this.reloadSound = null;
        
        // Raycasting
        this.raycaster = new THREE.Raycaster();
        
        // HUD elements
        this.onAmmoChange = null; // Callback for ammo updates
        
        this.init();
    }
    
    async init() {
        try {
            console.log('Initializing weapon system...');
            await this.loadModel();
            this.setupMuzzleFlash();
            this.setupAudio();
            this.setupAnimations();
            this.attachToCamera();
            this.setupInput();
            this.isLoaded = true;
            
            console.log('Weapon loaded successfully, model:', this.model);
            console.log('Weapon in camera children:', this.camera.children.includes(this.model));
        } catch (error) {
            console.error('Error loading weapon:', error);
        }
    }
    
    async loadModel() {
        const loader = new GLTFLoader();
        
        return new Promise((resolve, reject) => {
            // First try the exact filename that exists
            loader.load(
                'models/ak47.glb',
                (gltf) => {
                    this.model = gltf.scene;
                    this.model.animations = gltf.animations;
                    console.log('AK-47 GLB model loaded successfully');
                    resolve();
                },
                (progress) => {
                    console.log('Loading AK-47:', Math.round(progress.loaded / progress.total * 100) + '%');
                },
                (error) => {
                    console.warn('Could not load AK-47 GLB model, trying fallback:', error);
                    // Create a simple fallback weapon model
                    this.createFallbackModel();
                    resolve();
                }
            );
        });
    }
    
    createFallbackModel() {
        // Create a simple gun-like shape as fallback
        const group = new THREE.Group();
        
        // Barrel
        const barrelGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.6, 8);
        const barrelMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
        barrel.rotation.z = Math.PI / 2;
        barrel.position.set(0.3, 0, 0);
        group.add(barrel);
        
        // Stock
        const stockGeometry = new THREE.BoxGeometry(0.3, 0.1, 0.05);
        const stockMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const stock = new THREE.Mesh(stockGeometry, stockMaterial);
        stock.position.set(-0.1, 0, 0);
        group.add(stock);
        
        // Trigger guard
        const triggerGeometry = new THREE.BoxGeometry(0.08, 0.06, 0.02);
        const triggerMaterial = new THREE.MeshStandardMaterial({ color: 0x666666 });
        const trigger = new THREE.Mesh(triggerGeometry, triggerMaterial);
        trigger.position.set(0, -0.05, 0);
        group.add(trigger);
        
        // Receiver (main body)
        const receiverGeometry = new THREE.BoxGeometry(0.4, 0.08, 0.04);
        const receiverMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
        const receiver = new THREE.Mesh(receiverGeometry, receiverMaterial);
        receiver.position.set(0.1, 0.02, 0);
        group.add(receiver);
        
        // Magazine
        const magGeometry = new THREE.BoxGeometry(0.08, 0.2, 0.03);
        const magMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });
        const magazine = new THREE.Mesh(magGeometry, magMaterial);
        magazine.position.set(0.05, -0.12, 0);
        group.add(magazine);
        
        this.model = group;
        console.log('Created fallback weapon model');
    }
    
    setupAnimations() {
        if (!this.model || !this.model.animations) return;
        
        this.mixer = new THREE.AnimationMixer(this.model);
        
        // Set up animations if they exist
        this.model.animations.forEach((clip, index) => {
            const action = this.mixer.clipAction(clip);
            
            // Map animations based on typical naming or index
            if (clip.name.toLowerCase().includes('idle') || index === 1) {
                this.animations.idle = { clip, action };
            } else if (clip.name.toLowerCase().includes('shoot') || clip.name.toLowerCase().includes('fire') || index === 0) {
                this.animations.shoot = { clip, action };
            } else if (clip.name.toLowerCase().includes('reload') || index === 2) {
                this.animations.reload = { clip, action };
            }
        });
        
        // Start with idle animation if available
        if (this.animations.idle) {
            this.animations.idle.action.play();
        }
    }
    
    setupMuzzleFlash() {
        // Create muzzle flash effect
        const flashGeometry = new THREE.PlaneGeometry(0.5, 0.5);
        const flashMaterial = new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        this.muzzleFlash = new THREE.Mesh(flashGeometry, flashMaterial);
        this.muzzleFlash.visible = false;
    }
    
    setupAudio() {
        if (!this.audioListener) return;
        
        // Create shoot sound
        this.shootSound = new THREE.Audio(this.audioListener);
        
        // Load shooting sound
        const audioLoader = new THREE.AudioLoader();
        audioLoader.load(
            'sounds/oiia-oiia-short.mp3',
            (buffer) => {
                this.shootSound.setBuffer(buffer);
                this.shootSound.setLoop(false);
                this.shootSound.setVolume(0.5);
            },
            undefined,
            (error) => {
                console.warn('Could not load shoot sound:', error);
            }
        );
    }
    
    attachToCamera() {
        if (!this.model) return;
        
        // Ensure all materials are visible
        this.model.traverse((child) => {
            if (child.isMesh) {
                if (child.material) {
                    child.material.side = THREE.DoubleSide;
                    child.visible = true;
                }
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        // Position and scale the weapon based on the reference project
        // Reference uses: scale(0.05, 0.05, 0.05), position(0.04, -0.02, 0.0), rotation(5deg, 185deg, 0deg)
        this.model.scale.set(0.05, 0.05, 0.05);
        this.model.position.set(0.04, -0.02, 0.0);
        this.model.setRotationFromEuler(new THREE.Euler(
            THREE.MathUtils.degToRad(5), 
            THREE.MathUtils.degToRad(185), 
            0
        ));
        
        // Ensure model is visible
        this.model.visible = true;
        
        // Add muzzle flash to weapon
        if (this.muzzleFlash) {
            this.muzzleFlash.position.set(-0.3, -0.5, 8.3);
            this.muzzleFlash.rotateY(Math.PI);
            this.model.add(this.muzzleFlash);
        }
        
        // Attach weapon to camera
        this.camera.add(this.model);
        
        console.log('Weapon attached to camera at position:', this.model.position);
        console.log('Weapon scale:', this.model.scale);
        console.log('Weapon rotation:', this.model.rotation);
        console.log('Weapon visible:', this.model.visible);
        console.log('Camera children count:', this.camera.children.length);
    }
    
    setupInput() {
        // Mouse shooting
        document.addEventListener('mousedown', (event) => {
            if (event.button === 0) { // Left mouse button
                this.startShooting();
            }
        });
        
        document.addEventListener('mouseup', (event) => {
            if (event.button === 0) {
                this.stopShooting();
            }
        });
        
        // Reload key (R)
        document.addEventListener('keydown', (event) => {
            if (event.code === 'KeyR') {
                this.reload();
            }
        });
    }
    
    startShooting() {
        if (!this.isLoaded) return;
        this.isShooting = true;
        this.shootTimer = 0; // Allow immediate first shot
    }
    
    stopShooting() {
        this.isShooting = false;
    }
    
    shoot() {
        if (this.magAmmo <= 0) {
            this.reload();
            return false;
        }
        
        // Consume ammo
        this.magAmmo--;
        
        // Play shoot animation
        if (this.animations.shoot) {
            this.animations.shoot.action.stop();
            this.animations.shoot.action.play();
        }
        
        // Show muzzle flash
        this.showMuzzleFlash();
        
        // Play sound
        if (this.shootSound && this.shootSound.buffer) {
            if (this.shootSound.isPlaying) {
                this.shootSound.stop();
            }
            this.shootSound.play();
        }
        
        // Perform raycast
        this.performRaycast();
        
        // Update HUD
        if (this.onAmmoChange) {
            this.onAmmoChange(this.magAmmo, this.totalAmmo);
        }
        
        return true;
    }
    
    performRaycast() {
        // Set ray from camera center
        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        
        // Get all objects in scene (excluding weapon)
        const targets = [];
        this.scene.traverse((child) => {
            if (child.isMesh && !this.isWeaponMesh(child)) {
                targets.push(child);
            }
        });
        
        const intersects = this.raycaster.intersectObjects(targets, true);
        
        if (intersects.length > 0) {
            const hit = intersects[0];
            
            // Create hit effect
            this.createHitEffect(hit.point, hit.face.normal);
            
            // Check if we hit a target (cat)
            let targetMesh = hit.object;
            while (targetMesh.parent && !targetMesh.userData.isTarget) {
                targetMesh = targetMesh.parent;
            }
            
            if (targetMesh.userData.isTarget) {
                this.onTargetHit(targetMesh, hit);
            }
            
            return hit;
        }
        
        return null;
    }
    
    isWeaponMesh(mesh) {
        // Check if mesh is part of the weapon
        let parent = mesh;
        while (parent) {
            if (parent === this.model) return true;
            parent = parent.parent;
        }
        return false;
    }
    
    createHitEffect(position, normal) {
        // Create bullet impact effect
        const impactGeometry = new THREE.SphereGeometry(0.02, 8, 8);
        const impactMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.8
        });
        
        const impact = new THREE.Mesh(impactGeometry, impactMaterial);
        impact.position.copy(position);
        this.scene.add(impact);
        
        // Animate and remove impact
        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / 500; // 500ms duration
            
            if (progress >= 1) {
                this.scene.remove(impact);
                return;
            }
            
            impact.material.opacity = 0.8 * (1 - progress);
            impact.scale.setScalar(1 + progress * 2);
            
            requestAnimationFrame(animate);
        };
        animate();
    }
    
    onTargetHit(target, hitInfo) {
        console.log('Target hit!', target);
        
        // Add hit effect to target
        if (target.material) {
            const originalColor = target.material.color.clone();
            target.material.color.setHex(0xff0000);
            
            setTimeout(() => {
                target.material.color.copy(originalColor);
            }, 100);
        }
        
        // Trigger target behavior
        if (target.userData.onHit) {
            target.userData.onHit(hitInfo);
        }
    }
    
    showMuzzleFlash() {
        if (!this.muzzleFlash) return;
        
        this.muzzleFlash.visible = true;
        this.muzzleFlash.material.opacity = 1.0;
        this.muzzleFlash.rotation.z = Math.random() * Math.PI * 2;
        
        this.flashTimer = this.flashDuration;
    }
    
    reload() {
        if (this.magAmmo >= this.maxAmmo || this.totalAmmo <= 0) return;
        
        const bulletsNeeded = this.maxAmmo - this.magAmmo;
        const bulletsToReload = Math.min(bulletsNeeded, this.totalAmmo);
        
        this.magAmmo += bulletsToReload;
        this.totalAmmo -= bulletsToReload;
        
        // Play reload animation
        if (this.animations.reload) {
            this.animations.reload.action.stop();
            this.animations.reload.action.play();
        }
        
        // Update HUD
        if (this.onAmmoChange) {
            this.onAmmoChange(this.magAmmo, this.totalAmmo);
        }
        
        console.log(`Reloaded! Mag: ${this.magAmmo}, Total: ${this.totalAmmo}`);
    }
    
    update(deltaTime) {
        if (!this.isLoaded) return;
        
        // Update animations
        if (this.mixer) {
            this.mixer.update(deltaTime);
        }
        
        // Handle shooting
        if (this.isShooting && this.shootTimer <= 0) {
            if (this.shoot()) {
                this.shootTimer = this.fireRate;
            }
        }
        
        if (this.shootTimer > 0) {
            this.shootTimer -= deltaTime;
        }
        
        // Update muzzle flash
        if (this.flashTimer > 0) {
            this.flashTimer -= deltaTime;
            const alpha = this.flashTimer / this.flashDuration;
            this.muzzleFlash.material.opacity = alpha;
            
            if (this.flashTimer <= 0) {
                this.muzzleFlash.visible = false;
            }
        }
    }
    
    // Getters for HUD
    getAmmoCount() {
        return {
            mag: this.magAmmo,
            total: this.totalAmmo
        };
    }
    
    addAmmo(amount) {
        this.totalAmmo = Math.min(this.totalAmmo + amount, 300); // Max 300 total ammo
        if (this.onAmmoChange) {
            this.onAmmoChange(this.magAmmo, this.totalAmmo);
        }
    }
}
