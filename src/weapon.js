import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class Weapon {
    constructor(camera, scene, audioListener, playerBody = null, player = null) {
        this.camera = camera;
        this.scene = scene;
        this.audioListener = audioListener;
        this.playerBody = playerBody; // Player body to attach weapon to
        this.player = player; // Reference to player for accessing rotation
        
        // Weapon properties
        this.model = null;
        this.animations = {};
        this.mixer = null;
        this.stateMachine = null;
        
        // Quaternion-based rotation tracking
        this.weaponQuaternion = new THREE.Quaternion();
        this.targetQuaternion = new THREE.Quaternion();
        this.lastCameraQuaternion = new THREE.Quaternion();
        
        // Base weapon offsets
        this.weaponPositionOffset = new THREE.Vector3(0.4, 0.2, -1.3);
        this.weaponRotationOffset = new THREE.Euler(
            THREE.MathUtils.degToRad(-10), 
            THREE.MathUtils.degToRad(90), 
            THREE.MathUtils.degToRad(5)
        );
        this.weaponBaseQuaternion = new THREE.Quaternion();
        this.weaponBaseQuaternion.setFromEuler(this.weaponRotationOffset);
        
        // Bullet effects
        this.activeBullets = [];
        this.bulletSpeed = 100; // Increased speed for precise hitbox collision
        this.bulletLifetime = 3.0; // seconds
        this.maxBulletTrails = 50;
        this.ammoModel = null; // Loaded ammo.glb model
        
        // Shooting properties
        this.isLoaded = false;
        this.isShooting = false;
        this.fireRate = 0.1; // Time between shots in seconds
        this.shootTimer = 0.0;
        this.magAmmo = 30;
        this.maxAmmo = 30;
        this.totalAmmo = 1200;
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
        
        // Debug mode
        this.debugMode = false;
        this.debugHelpers = new Map(); // Store debug wireframes
        this.bulletColliders = new Map(); // Store bullet colliders
        this.targetColliders = new Map(); // Store target colliders
        
        this.init();
    }
    
    async init() {
        try {
            console.log('Initializing weapon system...');
            await this.loadModel();
            await this.loadAmmoModel();
            this.setupMuzzleFlash();
            this.setupAudio();
            this.setupAnimations();
            this.attachWeapon();
            this.setupInput();
            this.isLoaded = true;
            
            // Scan for existing targets on initialization
            this.scanForNewTargets();
            
            // Expose debug command to global console
            window.weaponDebug = () => this.toggleDebugMode();
            window.registerTarget = (target, size) => this.registerTarget(target, size);
            window.scanTargets = () => this.scanForNewTargets();
            window.weaponSystem = this;
            
            console.log('Weapon loaded successfully, model:', this.model);
            console.log('Ammo model loaded:', this.ammoModel);
            console.log('Weapon attached to:', this.model.parent);
            console.log('Debug command available: weaponDebug()');
            console.log('Target registration: registerTarget(mesh, {width, height, depth})');
            console.log('Manual target scan: scanTargets()');
        } catch (error) {
            console.error('Error loading weapon:', error);
        }
    }
    
    async loadModel() {
        const loader = new GLTFLoader();
        
        return new Promise((resolve, reject) => {
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
    
    async loadAmmoModel() {
        const loader = new GLTFLoader();
        
        return new Promise((resolve, reject) => {
            loader.load(
                'models/ammo.glb',
                (gltf) => {
                    this.ammoModel = gltf.scene.clone();
                    console.log('Ammo GLB model loaded successfully');
                    resolve();
                },
                (progress) => {
                    console.log('Loading ammo:', Math.round(progress.loaded / progress.total * 100) + '%');
                },
                (error) => {
                    console.warn('Could not load ammo GLB model, using fallback:', error);
                    this.createFallbackAmmoModel();
                    resolve();
                }
            );
        });
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
        console.log('Created fallback ammo model');
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
        const flashGeometry = new THREE.PlaneGeometry(0.3, 0.3);
        const flashMaterial = new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        
        this.muzzleFlash = new THREE.Mesh(flashGeometry, flashMaterial);
        this.muzzleFlash.visible = false;
        
        // Create additional particle effects for more realistic muzzle flash
        this.createMuzzleParticles();
    }
    
    createMuzzleParticles() {
        // Create small particles for enhanced muzzle flash effect
        const particleCount = 20;
        const particleGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            // Random positions around muzzle
            positions[i3] = (Math.random() - 0.5) * 0.1;
            positions[i3 + 1] = (Math.random() - 0.5) * 0.1;
            positions[i3 + 2] = Math.random() * 0.2;
            
            // Orange/yellow colors
            colors[i3] = 1.0;     // red
            colors[i3 + 1] = 0.6 + Math.random() * 0.4; // green
            colors[i3 + 2] = 0.0; // blue
        }
        
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        const particleMaterial = new THREE.PointsMaterial({
            size: 0.02,
            transparent: true,
            opacity: 0,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        this.muzzleParticles = new THREE.Points(particleGeometry, particleMaterial);
        this.muzzleParticles.visible = false;
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
    
    attachWeapon() {
        if (!this.model) return;
        
        // Ensure all materials are visible and mark as weapon
        this.model.traverse((child) => {
            if (child.isMesh) {
                if (child.material) {
                    child.material.side = THREE.DoubleSide;
                    child.visible = true;
                }
                child.castShadow = true;
                child.receiveShadow = true;
                
                // Mark as weapon part to exclude from collisions
                child.userData.isWeapon = true;
            }
        });
        
        // Position and scale the weapon
        this.model.scale.set(0.3, 0.3, 0.3);
        
        // Add muzzle flash to weapon
        if (this.muzzleFlash) {
            this.muzzleFlash.position.set(0.4, 0.2, -1.3);
            this.muzzleFlash.rotateY(Math.PI);
            this.model.add(this.muzzleFlash);
        }
        
        // Add muzzle particles
        if (this.muzzleParticles) {
            this.muzzleParticles.position.set(0.4, 0.2, -1.3);
            this.model.add(this.muzzleParticles);
        }
        
        // Attach weapon to player body if available, otherwise to camera
        if (this.playerBody) {
            // Set weapon position
            this.model.position.copy(this.weaponPositionOffset);
            
            // Set initial rotation from base quaternion
            this.model.quaternion.copy(this.weaponBaseQuaternion);
            
            this.playerBody.add(this.model);
            console.log('Weapon attached to player body');
        } else {
            // Fallback to camera attachment
            this.model.position.set(1, 0, 10);
            this.model.quaternion.copy(this.weaponBaseQuaternion);
            this.camera.add(this.model);
            console.log('Weapon attached to camera (fallback)');
        }
        
        // Ensure model is visible
        this.model.visible = true;
        
        console.log('Weapon attached at position:', this.model.position);
        console.log('Weapon scale:', this.model.scale);
        console.log('Weapon visible:', this.model.visible);
    }
    
    setPlayerBody(playerBody, player = null) {
        this.playerBody = playerBody;
        this.player = player;
        
        // Re-attach weapon if model is already loaded
        if (this.model && playerBody) {
            // Remove from current parent
            if (this.model.parent) {
                this.model.parent.remove(this.model);
            }
            // Re-attach to new parent
            this.attachWeapon();
        }
    }
    
    setupInput() {
        // Mouse shooting
        document.addEventListener('mousedown', (event) => {
            if (event.button === 0 && this.player && this.player.isLocked) { // Left mouse button
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
            if (event.code === 'KeyR' && this.player && this.player.isLocked) {
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
        
        // Create bullet that follows crosshair exactly
        const muzzlePos = this.getGunMuzzlePosition();
        const shootDirection = new THREE.Vector3();
        this.camera.getWorldDirection(shootDirection);
        
        // No spread - bullets must follow crosshair exactly for precise hitbox collision
        shootDirection.normalize();
        
        this.createBulletTrail(muzzlePos, shootDirection);
        
        // Play sound
        if (this.shootSound && this.shootSound.buffer) {
            if (this.shootSound.isPlaying) {
                this.shootSound.stop();
            }
            this.shootSound.play();
        }
        
        // Show muzzle flash
        this.showMuzzleFlash();
        
        // Create shell casing
        this.createShellCasing();
        
        // Update HUD
        if (this.onAmmoChange) {
            this.onAmmoChange(this.magAmmo, this.totalAmmo);
        }
        
        return true;
    }
    
    showMuzzleFlash() {
        if (!this.muzzleFlash) return;
        
        // Show main muzzle flash
        this.muzzleFlash.visible = true;
        this.muzzleFlash.material.opacity = 1.0;
        this.muzzleFlash.rotation.z = Math.random() * Math.PI * 2;
        
        // Show muzzle particles
        if (this.muzzleParticles) {
            this.muzzleParticles.visible = true;
            this.muzzleParticles.material.opacity = 0.8;
            
            // Randomize particle positions slightly
            const positions = this.muzzleParticles.geometry.attributes.position.array;
            for (let i = 0; i < positions.length; i += 3) {
                positions[i] += (Math.random() - 0.5) * 0.02;
                positions[i + 1] += (Math.random() - 0.5) * 0.02;
                positions[i + 2] += Math.random() * 0.05;
            }
            this.muzzleParticles.geometry.attributes.position.needsUpdate = true;
        }
        
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
    
    createBulletTrail(startPos, direction) {
        let bullet;
        
        if (this.ammoModel) {
            // Use the loaded ammo.glb model
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
        } else {
            // Fallback to simple geometry if ammo model failed to load
            const bulletGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.2);
            const bulletMaterial = new THREE.MeshBasicMaterial({ 
                color: 0xffff00,
                transparent: true,
                opacity: 0.8
            });
            
            bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
            bullet.userData.isBullet = true;
        }
        
        // Position bullet at gun muzzle
        bullet.position.copy(startPos);
        
        // Orient bullet in direction of travel using quaternion
        if (this.ammoModel) {
            // For 3D models, align with camera rotation
            const cameraQuaternion = new THREE.Quaternion();
            this.camera.getWorldQuaternion(cameraQuaternion);
            bullet.quaternion.copy(cameraQuaternion);
        } else {
            // For simple cylinder, orient along direction
            const axis = new THREE.Vector3(0, 1, 0);
            bullet.quaternion.setFromUnitVectors(axis, direction);
        }
        
        // Add to scene
        this.scene.add(bullet);
        
        // Create rectangular collider for this bullet
        this.createBulletCollider(bullet);
        
        // Add debug helper if debug mode is on
        if (this.debugMode) {
            this.addDebugHelper(bullet);
        }
        
        // Create bullet object with properties
        const bulletObj = {
            mesh: bullet,
            velocity: direction.clone().multiplyScalar(this.bulletSpeed),
            life: this.bulletLifetime,
            startTime: performance.now()
        };
        
        this.activeBullets.push(bulletObj);
        
        // Remove old bullets if too many
        if (this.activeBullets.length > this.maxBulletTrails) {
            const oldBullet = this.activeBullets.shift();
            this.scene.remove(oldBullet.mesh);
        }
        
        return bulletObj;
    }
    
    createShellCasing() {
        // Create small shell casing that ejects from the gun
        const casingGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.06);
        const casingMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xdaa520,
            transparent: true,
            opacity: 0.9
        });
        
        const casing = new THREE.Mesh(casingGeometry, casingMaterial);
        
        // Position casing at gun ejection port (side of weapon)
        const ejectionPos = this.getGunMuzzlePosition();
        ejectionPos.add(new THREE.Vector3(-0.2, -0.1, -0.3)); // Offset to side/back
        casing.position.copy(ejectionPos);
        
        // Add random ejection velocity
        const ejectionVelocity = new THREE.Vector3(
            -2 - Math.random() * 2, // Eject to the side
            1 + Math.random() * 2,  // Upward
            -1 - Math.random()      // Slightly backward
        );
        
        this.scene.add(casing);
        
        // Animate shell casing
        const startTime = performance.now();
        const animateShell = () => {
            const elapsed = (performance.now() - startTime) / 1000;
            const gravity = -9.8;
            
            if (elapsed > 3) { // Remove after 3 seconds
                this.scene.remove(casing);
                return;
            }
            
            // Update position with physics
            casing.position.x += ejectionVelocity.x * 0.016;
            casing.position.y += (ejectionVelocity.y + gravity * elapsed) * 0.016;
            casing.position.z += ejectionVelocity.z * 0.016;
            
            // Add rotation
            casing.rotation.x += 0.1;
            casing.rotation.y += 0.05;
            
            // Fade out
            casing.material.opacity = Math.max(0, 0.9 - elapsed / 3);
            
            requestAnimationFrame(animateShell);
        };
        
        animateShell();
    }

    updateBullets(deltaTime) {
        for (let i = this.activeBullets.length - 1; i >= 0; i--) {
            const bullet = this.activeBullets[i];
            
            // Store previous position for collision detection
            const prevPosition = bullet.mesh.position.clone();
            
            // Update position
            bullet.mesh.position.add(bullet.velocity.clone().multiplyScalar(deltaTime));
            
            // Update bullet collider position
            const collider = this.bulletColliders.get(bullet.mesh);
            if (collider) {
                collider.position.copy(bullet.mesh.position);
                collider.rotation.copy(bullet.mesh.rotation);
            }
            
            // Perform collision detection for this bullet
            this.checkBulletColliderCollision(bullet, prevPosition);
            
            // Add bullet rotation for visual effect
            bullet.mesh.rotation.y += deltaTime * 15;
            
            // Update lifetime
            bullet.life -= deltaTime;
            
            // Fade out bullet over time
            const lifeFactor = bullet.life / this.bulletLifetime;
            
            // Handle material opacity for both simple mesh and complex models
            if (this.ammoModel) {
                bullet.mesh.traverse((child) => {
                    if (child.isMesh && child.material) {
                        child.material.opacity = lifeFactor * 0.9;
                    }
                });
            } else {
                bullet.mesh.material.opacity = lifeFactor * 0.8;
            }
            
            // Remove expired bullets
            if (bullet.life <= 0) {
                this.removeDebugHelper(bullet.mesh);
                this.removeBulletCollider(bullet.mesh);
                this.scene.remove(bullet.mesh);
                this.activeBullets.splice(i, 1);
            }
        }
    }
    
    checkBulletColliderCollision(bullet, prevPosition) {
        const bulletCollider = this.bulletColliders.get(bullet.mesh);
        if (!bulletCollider) return false;
        
        // Create raycaster from previous position to current position
        const direction = new THREE.Vector3().subVectors(bullet.mesh.position, prevPosition);
        const distance = direction.length();
        
        if (distance === 0) return false;
        
        direction.normalize();
        const raycaster = new THREE.Raycaster(prevPosition, direction, 0, distance);
        
        // PRIORITY 1: Check collisions with target colliders ONLY
        const targetColliders = [];
        this.targetColliders.forEach((collider, target) => {
            if (collider.visible !== false) {
                targetColliders.push(collider);
            }
        });
        
        const targetIntersects = raycaster.intersectObjects(targetColliders, false);
        if (targetIntersects.length > 0) {
            const hit = targetIntersects[0];
            const hitCollider = hit.object;
            const parentTarget = hitCollider.userData.parentTarget;
            
            console.log('🎯 HIT TARGET COLLIDER!', {
                collider: hitCollider,
                target: parentTarget,
                hitPoint: hit.point
            });
            
            // Move bullet to hit position
            bullet.mesh.position.copy(hit.point);
            bulletCollider.position.copy(hit.point);
            
            // Create hit effect at collision point
            this.createHitEffect(hit.point, hit.face.normal);
            
            // Trigger target hit
            if (parentTarget && parentTarget.userData.isTarget) {
                this.onTargetHit(parentTarget, hit);
            }
            
            // Remove bullet after hit
            this.removeDebugHelper(bullet.mesh);
            this.removeBulletCollider(bullet.mesh);
            this.scene.remove(bullet.mesh);
            const bulletIndex = this.activeBullets.indexOf(bullet);
            if (bulletIndex > -1) {
                this.activeBullets.splice(bulletIndex, 1);
            }
            
            return true;
        }
        
        // PRIORITY 2: Check environment
        const environmentTargets = [];
        this.scene.traverse((child) => {
            if (child.isMesh && 
                !this.isWeaponMesh(child) && 
                !child.userData.isBullet && 
                !child.userData.isBulletCollider &&
                !child.userData.isTargetCollider &&
                !child.userData.isTarget) {
                environmentTargets.push(child);
            }
        });
        
        const environmentIntersects = raycaster.intersectObjects(environmentTargets, true);
        if (environmentIntersects.length > 0) {
            const hit = environmentIntersects[0];
            
            console.log('🏗️ HIT ENVIRONMENT:', hit.object);
            
            // Move bullet to hit position
            bullet.mesh.position.copy(hit.point);
            bulletCollider.position.copy(hit.point);
            
            // Create hit effect
            this.createHitEffect(hit.point, hit.face.normal);
            
            // Remove bullet after hit
            this.removeDebugHelper(bullet.mesh);
            this.removeBulletCollider(bullet.mesh);
            this.scene.remove(bullet.mesh);
            const bulletIndex = this.activeBullets.indexOf(bullet);
            if (bulletIndex > -1) {
                this.activeBullets.splice(bulletIndex, 1);
            }
            
            return true;
        }
        
        return false;
    }
    
    isWeaponMesh(mesh) {
        // Check if mesh is part of the weapon or a bullet
        if (mesh.userData && (mesh.userData.isWeapon || mesh.userData.isBullet)) {
            return true;
        }
        
        let parent = mesh;
        while (parent) {
            if (parent === this.model) return true;
            parent = parent.parent;
        }
        return false;
    }
    
    createHitEffect(position, normal) {
        // Create bullet impact effect
        console.log('💥 Impact effect at:', position);
        
        // Create impact particles
        const particleCount = 15;
        const particles = [];
        
        for (let i = 0; i < particleCount; i++) {
            const particle = new THREE.Mesh(
                new THREE.SphereGeometry(0.01, 4, 4),
                new THREE.MeshBasicMaterial({
                    color: i < 5 ? 0xffaa00 : 0x666666, // Mix of sparks and debris
                    transparent: true,
                    opacity: 0.8
                })
            );
            
            particle.position.copy(position);
            
            // Add some offset based on normal
            const offset = normal.clone().multiplyScalar(0.05);
            particle.position.add(offset);
            
            // Random velocity influenced by normal
            particle.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 2 + normal.x * 2,
                Math.random() * 2 + normal.y * 2,
                (Math.random() - 0.5) * 2 + normal.z * 2
            );
            
            this.scene.add(particle);
            particles.push(particle);
        }
        
        // Animate particles
        const startTime = Date.now();
        const animateParticles = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / 500; // 0.5 second duration
            
            if (progress >= 1) {
                particles.forEach(particle => this.scene.remove(particle));
                return;
            }
            
            particles.forEach(particle => {
                particle.position.add(particle.velocity.clone().multiplyScalar(0.016));
                particle.velocity.y -= 0.2; // Gravity
                particle.material.opacity = 0.8 * (1 - progress);
                particle.scale.setScalar(1 - progress * 0.5);
            });
            
            requestAnimationFrame(animateParticles);
        };
        animateParticles();
    }
    
    onTargetHit(target, hitInfo) {
        console.log('🎯 Target hit via collider!', target);
        
        // Trigger target behavior
        if (target.userData.onHit) {
            target.userData.onHit(hitInfo);
        }
    }
    
    createBulletCollider(bullet) {
        // Create a rectangular collider for the bullet
        const colliderGeometry = new THREE.BoxGeometry(5, 5, 5);
        const colliderMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.3,
            visible: this.debugMode
        });
        
        const collider = new THREE.Mesh(colliderGeometry, colliderMaterial);
        collider.userData.isBulletCollider = true;
        collider.userData.parentBullet = bullet;
        
        // Position collider to match bullet
        collider.position.copy(bullet.position);
        collider.rotation.copy(bullet.rotation);
        
        // Add collider to scene and track it
        this.scene.add(collider);
        this.bulletColliders.set(bullet, collider);
        
        return collider;
    }
    
    removeBulletCollider(bullet) {
        const collider = this.bulletColliders.get(bullet);
        if (collider) {
            this.scene.remove(collider);
            this.bulletColliders.delete(bullet);
        }
    }
    
    createTargetCollider(target, size = { width: 1, height: 1, depth: 1 }) {
        // Create a rectangular collider for the target
        const colliderGeometry = new THREE.BoxGeometry(size.width, size.height, size.depth);
        const colliderMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.3,
            visible: this.debugMode,
            wireframe: this.debugMode
        });
        
        const collider = new THREE.Mesh(colliderGeometry, colliderMaterial);
        collider.userData.isTargetCollider = true;
        collider.userData.parentTarget = target;
        
        // Position collider at target's position
        collider.position.copy(target.position);
        collider.position.y += 1.0; // Offset for cat body
        collider.rotation.copy(target.rotation);
        
        // Add collider to scene and track it
        this.scene.add(collider);
        this.targetColliders.set(target, collider);
        
        console.log('✅ Created target collider:', {
            target: target.type || 'Unknown',
            targetName: target.name || 'unnamed',
            size: size,
            position: collider.position
        });
        
        return collider;
    }
    
    removeTargetCollider(target) {
        const collider = this.targetColliders.get(target);
        if (collider) {
            this.scene.remove(collider);
            this.targetColliders.delete(target);
        }
    }

    registerTarget(target, colliderSize = { width: 1, height: 1, depth: 1 }) {
        // Mark the target
        target.userData.isTarget = true;
        
        // Create collider for the target
        this.createTargetCollider(target, colliderSize);
        
        // Add debug helper if debug mode is active
        if (this.debugMode) {
            this.addDebugHelper(target);
        }
        
        console.log('Target registered with collider:', target);
    }
    
    unregisterTarget(target) {
        this.removeTargetCollider(target);
        this.removeDebugHelper(target);
        target.userData.isTarget = false;
    }

    scanForNewTargets() {
        let foundTargets = 0;
        let totalTargetsInScene = 0;
        let alreadyRegistered = 0;
        
        console.log('Scanning for targets in scene...');
        
        this.scene.traverse((child) => {
            if (child.userData && child.userData.isTarget) {
                totalTargetsInScene++;
                console.log(`Found target in scene: ${child.type}`, child.name || 'unnamed', 'Position:', child.position);
                
                if (this.targetColliders.has(child)) {
                    alreadyRegistered++;
                    console.log('  - Already has collider');
                } else {
                    // Auto-register with appropriate collider size
                    const colliderSize = {
                        width: 2,
                        height: 2,
                        depth: 4
                    };
                    
                    this.createTargetCollider(child, colliderSize);
                    foundTargets++;
                    console.log('  - Auto-detected and registered new target:', child.type, 'Size:', colliderSize);
                }
            }
        });
        
        console.log(`Scan complete: Found ${totalTargetsInScene} targets in scene, ${alreadyRegistered} already registered, ${foundTargets} newly registered`);
        console.log(`Total target colliders: ${this.targetColliders.size}`);
        
        if (this.debugMode && foundTargets > 0) {
            console.log('Debug mode is active - new target colliders should be visible as red wireframes');
        }
    }

    getGunMuzzlePosition() {
        if (!this.model) return new THREE.Vector3();
        
        const muzzleOffset = new THREE.Vector3(1, -0.3, 0.8);
        
        if (this.playerBody) {
            // Get weapon's world position and rotation
            const worldPos = new THREE.Vector3();
            const worldQuaternion = new THREE.Quaternion();
            
            this.model.getWorldPosition(worldPos);
            this.model.getWorldQuaternion(worldQuaternion);
            
            // Apply muzzle offset in weapon's local space
            muzzleOffset.applyQuaternion(worldQuaternion);
            worldPos.add(muzzleOffset);
            
            return worldPos;
        } else {
            // If attached to camera, use camera-relative position
            const cameraDirection = new THREE.Vector3();
            this.camera.getWorldDirection(cameraDirection);
            
            const muzzlePos = new THREE.Vector3();
            this.camera.getWorldPosition(muzzlePos);
            muzzlePos.add(cameraDirection.multiplyScalar(1.5));
            muzzlePos.add(new THREE.Vector3(0.2, -0.1, 0));
            
            return muzzlePos;
        }
    }

    update(deltaTime) {
        if (!this.isLoaded) return;
        
        // Scan for new targets periodically
        if (!this.scanCounter) this.scanCounter = 0;
        this.scanCounter++;
        if (this.scanCounter % 60 === 0) {
            this.scanForNewTargets();
        }
        
        // Update weapon rotation to follow camera
        this.updateWeaponRotation();
        
        // Update animations
        if (this.mixer) {
            this.mixer.update(deltaTime);
        }
        
        // Update bullet trails
        this.updateBullets(deltaTime);
        
        // Update target colliders
        this.updateTargetColliders();
        
        // Update muzzle flash
        if (this.flashTimer > 0) {
            this.flashTimer -= deltaTime;
            const flashProgress = this.flashTimer / this.flashDuration;
            
            if (this.muzzleFlash) {
                this.muzzleFlash.material.opacity = flashProgress;
                this.muzzleFlash.visible = flashProgress > 0;
            }
            
            if (this.muzzleParticles) {
                this.muzzleParticles.material.opacity = flashProgress * 0.8;
                this.muzzleParticles.visible = flashProgress > 0;
            }
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
    }
    
    updateWeaponRotation() {
        if (!this.model || !this.player) return;
        
        // Get camera's world quaternion
        const cameraWorldQuaternion = new THREE.Quaternion();
        this.camera.getWorldQuaternion(cameraWorldQuaternion);
        
        // Calculate quaternion difference for smooth interpolation
        const quaternionDelta = new THREE.Quaternion();
        quaternionDelta.copy(this.lastCameraQuaternion).invert();
        quaternionDelta.multiply(cameraWorldQuaternion);
        
        // Store current camera quaternion for next frame
        this.lastCameraQuaternion.copy(cameraWorldQuaternion);
        
        // Get player state for influence adjustments
        let pitchInfluence = 0.4;
        let yawInfluence = 0.2;
        let sway = 0.1;
        
        if (this.player.isRunning) {
            pitchInfluence *= 1.2;
            yawInfluence *= 1.3;
            sway *= 1.5;
        } else if (this.player.isCrouching) {
            pitchInfluence *= 0.7;
            yawInfluence *= 0.6;
            sway *= 0.5;
        }
        
        // Create target quaternion that combines base offset with camera influence
        const targetQuaternion = new THREE.Quaternion();
        
        // Start with base weapon quaternion
        targetQuaternion.copy(this.weaponBaseQuaternion);
        
        // Apply camera influence
        const cameraInfluence = new THREE.Quaternion();
        cameraInfluence.slerp(cameraWorldQuaternion, pitchInfluence);
        
        // Combine base and camera influence
        targetQuaternion.multiply(cameraInfluence);
        
        // Apply smooth interpolation
        let lerpFactor = 0.12;
        if (this.player.isRunning) {
            lerpFactor *= 1.4;
        } else if (this.player.isCrouching) {
            lerpFactor *= 0.7;
        }
        
        // Smoothly interpolate weapon rotation
        this.model.quaternion.slerp(targetQuaternion, lerpFactor);
    }

    getAmmoCount() {
        return {
            mag: this.magAmmo,
            total: this.totalAmmo
        };
    }
    
    addAmmo(amount) {
        this.totalAmmo = Math.min(this.totalAmmo + amount, 300);
        if (this.onAmmoChange) {
            this.onAmmoChange(this.magAmmo, this.totalAmmo);
        }
    }

    toggleDebugMode() {
        this.debugMode = !this.debugMode;
        console.log('🐛 Weapon Debug Mode:', this.debugMode ? 'ON' : 'OFF');
        
        if (this.debugMode) {
            console.log('🟢 Green wireframes = Bullets');
            console.log('🔴 Red wireframes = Targets');
            console.log('📦 Rectangular colliders = Hitboxes');
        }
        
        // Update collider visibility
        this.bulletColliders.forEach((collider) => {
            collider.material.visible = this.debugMode;
        });
        
        this.targetColliders.forEach((collider) => {
            collider.material.visible = this.debugMode;
        });
        
        if (!this.debugMode) {
            // Remove all debug helpers when turning off debug mode
            this.debugHelpers.forEach((helper, mesh) => {
                this.scene.remove(helper);
            });
            this.debugHelpers.clear();
        } else {
            // Add debug helpers for existing objects
            this.addDebugHelpersToScene();
        }
    }
    
    addDebugHelpersToScene() {
        // Add debug helpers for all targets in the scene
        this.scene.traverse((child) => {
            if (child.userData && child.userData.isTarget) {
                this.addDebugHelper(child);
                // Auto-register targets with colliders if not already registered
                if (!this.targetColliders.has(child)) {
                    const colliderSize = {
                        width: 3,
                        height: 2,
                        depth: 4
                    };
                    
                    this.createTargetCollider(child, colliderSize);
                    console.log('Auto-registered target with collider:', child);
                }
            }
        });
        
        // Add debug helpers for all active bullets
        this.activeBullets.forEach(bullet => {
            this.addDebugHelper(bullet.mesh);
        });
    }
    
    addDebugHelper(mesh) {
        if (!this.debugMode || this.debugHelpers.has(mesh)) return;
        
        // Create wireframe helper
        const wireframeGeometry = mesh.geometry ? mesh.geometry : new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: mesh.userData.isTarget ? 0xff0000 : 0x00ff00,
            wireframe: true,
            opacity: 0.7,
            transparent: true
        });
        
        const wireframe = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
        
        // Position wireframe to match the mesh
        wireframe.position.copy(mesh.position);
        wireframe.rotation.copy(mesh.rotation);
        wireframe.scale.copy(mesh.scale);
        
        // Make wireframe follow the original mesh
        mesh.add(wireframe);
        
        this.debugHelpers.set(mesh, wireframe);
    }
    
    removeDebugHelper(mesh) {
        const helper = this.debugHelpers.get(mesh);
        if (helper) {
            if (helper.parent) {
                helper.parent.remove(helper);
            }
            this.debugHelpers.delete(mesh);
        }
    }

    updateTargetColliders() {
        // Update target collider positions to match their parent targets
        this.targetColliders.forEach((collider, target) => {
            if (target.parent) {
                // Target still exists in scene
                collider.position.copy(target.position);
                collider.position.y += 1.0;
                collider.rotation.copy(target.rotation);
            } else {
                // Target was removed from scene, clean up its collider
                this.removeTargetCollider(target);
            }
        });
    }
}