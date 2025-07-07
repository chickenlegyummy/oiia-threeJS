import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class Weapon {
    constructor(camera, scene, audioListener, playerBody = null, player = null) {
        this.camera = camera;
        this.scene = scene;
        this.audioListener = audioListener;
        this.playerBody = playerBody; // Player body to attach weapon to
        this.player = player; // Reference to player for accessing euler rotation
        
        // Weapon properties
        this.model = null;
        this.animations = {};
        this.mixer = null;
        this.stateMachine = null;
        
        // Camera rotation tracking for weapon orientation
        this.lastCameraRotation = new THREE.Euler();
        this.weaponRotationOffset = new THREE.Euler(); // Base rotation offset
        
        // Bullet effects
        this.activeBullets = [];
        this.bulletSpeed = 100;
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
            await this.loadAmmoModel();
            this.setupMuzzleFlash();
            this.setupAudio();
            this.setupAnimations();
            this.attachWeapon();
            this.setupInput();
            this.isLoaded = true;
            
            console.log('Weapon loaded successfully, model:', this.model);
            console.log('Ammo model loaded:', this.ammoModel);
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
                    // Create fallback ammo model if loading fails
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
        // Create muzzle flash effect - enhanced version
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
            // Position weapon relative to player body (right hand position)
            this.model.position.set(0.4, 0.2, -1.3); // Right side, chest/arm level, slightly forward
            
            // Store the base rotation offset for CS2-style weapon movement
            this.weaponRotationOffset.set(
                THREE.MathUtils.degToRad(-10), // Slight downward angle
                THREE.MathUtils.degToRad(90),  // Angled outward
                THREE.MathUtils.degToRad(5)    // Slight roll
            );
            this.model.setRotationFromEuler(this.weaponRotationOffset);
            
            this.playerBody.add(this.model);
            console.log('Weapon attached to player body');
        } else {
            // Fallback to camera attachment
            this.model.position.set(1, 0, 10);
            this.weaponRotationOffset.set(
                THREE.MathUtils.degToRad(5), 
                THREE.MathUtils.degToRad(185), 
                0
            );
            this.model.setRotationFromEuler(this.weaponRotationOffset);
            this.camera.add(this.model);
            console.log('Weapon attached to camera (fallback)');
        }
        
        // Ensure model is visible
        this.model.visible = true;
        
        console.log('Weapon attached at position:', this.model.position);
        console.log('Weapon scale:', this.model.scale);
        console.log('Weapon base rotation:', this.weaponRotationOffset);
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
        
        // Create bullet trail visual effect
        const muzzlePos = this.getGunMuzzlePosition();
        const shootDirection = new THREE.Vector3();
        this.camera.getWorldDirection(shootDirection);
        
        // Add slight random spread for realism
        const spread = 0.02;
        shootDirection.x += (Math.random() - 0.5) * spread;
        shootDirection.y += (Math.random() - 0.5) * spread;
        shootDirection.z += (Math.random() - 0.5) * spread;
        shootDirection.normalize();
        
        this.createBulletTrail(muzzlePos, shootDirection);
        
        // Create shell casing ejection
        this.createShellCasing();
        
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
        
        // Create shell casing ejection effect
        this.createShellCasing();
        
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
            bullet.scale.set(0.3, 0.3, 0.3);
            
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
        
        // Orient bullet in direction of travel
        if (this.ammoModel) {
            // For 3D models, we might need different orientation logic
            const euler = new THREE.Euler();
            euler.setFromQuaternion(this.camera.quaternion);
            bullet.rotation.copy(euler);
        } else {
            // For simple cylinder, orient along direction
            const axis = new THREE.Vector3(0, 1, 0);
            bullet.quaternion.setFromUnitVectors(axis, direction);
        }
        
        // Add to scene
        this.scene.add(bullet);
        
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
            
            // Update position
            bullet.mesh.position.add(bullet.velocity.clone().multiplyScalar(deltaTime));
            
            // Add bullet rotation for visual effect
            if (this.ammoModel) {
                bullet.mesh.rotation.z += deltaTime * 10; // Spinning bullet
            } else {
                bullet.mesh.rotation.y += deltaTime * 10;
            }
            
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
                this.scene.remove(bullet.mesh);
                this.activeBullets.splice(i, 1);
            }
        }
    }
    
    getGunMuzzlePosition() {
        if (!this.model) return new THREE.Vector3();
        
        // Calculate muzzle position based on weapon attachment
        const muzzleOffset = new THREE.Vector3(0, 0, 1.5); // Forward from weapon
        
        if (this.playerBody) {
            // If attached to player body, calculate world position
            const worldPos = new THREE.Vector3();
            const worldQuaternion = new THREE.Quaternion();
            
            // Get weapon's world position and rotation
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
            
            const muzzlePos = this.camera.position.clone();
            muzzlePos.add(cameraDirection.multiplyScalar(1.5));
            muzzlePos.add(new THREE.Vector3(0.2, -0.1, 0)); // Slight offset for realism
            
            return muzzlePos;
        }
    }

    update(deltaTime) {
        if (!this.isLoaded) return;
        
        // Update weapon rotation to follow camera (CS2-style)
        this.updateWeaponRotation();
        
        // Update animations
        if (this.mixer) {
            this.mixer.update(deltaTime);
        }
        
        // Update bullet trails
        this.updateBullets(deltaTime);
        
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
            
            // Update muzzle particles opacity
            if (this.muzzleParticles) {
                this.muzzleParticles.material.opacity = alpha * 0.8;
            }
            
            if (this.flashTimer <= 0) {
                this.muzzleFlash.visible = false;
                if (this.muzzleParticles) {
                    this.muzzleParticles.visible = false;
                }
            }
        }
        
        // Update bullet trails
        this.updateBullets(deltaTime);
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

    updateWeaponRotation() {
        if (!this.model || !this.player) return;
        
        // Get player's euler rotation for accurate camera tracking
        const cameraEuler = this.player.euler;
        
        if (!cameraEuler) return;
        
        // Calculate weapon rotation based on camera rotation
        // In CS2/modern FPS style, the weapon should:
        // 1. Follow camera pitch (up/down look) with some dampening
        // 2. Follow camera yaw (left/right turn) slightly for natural sway
        // 3. Add subtle roll based on movement for realism
        // 4. Respond to player movement state (running, crouching)
        // 5. Maintain base rotation offset
        
        let pitchInfluence = 0.4; // How much camera pitch affects weapon (0-1)
        let yawInfluence = 0.2;   // How much camera yaw affects weapon beyond body rotation (0-1)
        let rollInfluence = 0.1;  // Subtle roll effect based on yaw movement
        
        // Adjust influences based on player state
        if (this.player.isRunning) {
            pitchInfluence *= 1.2; // More weapon movement when running
            yawInfluence *= 1.3;
            rollInfluence *= 1.5;
        } else if (this.player.isCrouching) {
            pitchInfluence *= 0.7; // More stable when crouching
            yawInfluence *= 0.6;
            rollInfluence *= 0.5;
        }
        
        // Calculate yaw movement speed for dynamic roll effect
        const yawDelta = cameraEuler.y - this.lastCameraRotation.y;
        const rollFromYaw = yawDelta * rollInfluence * 50; // Scale for visible effect
        
        // Store current rotation for next frame
        this.lastCameraRotation.copy(cameraEuler);
        
        // Calculate the weapon's target rotation
        const targetRotation = new THREE.Euler(
            this.weaponRotationOffset.x + (cameraEuler.x * pitchInfluence), // Pitch follows camera
            this.weaponRotationOffset.y + (cameraEuler.y * yawInfluence),   // Slight yaw sway
            this.weaponRotationOffset.z + rollFromYaw, // Dynamic roll from movement
            'YXZ'
        );
        
        // Apply smooth interpolation for natural movement
        let lerpFactor = 0.12; // Base smoothing factor (0-1, higher = faster response)
        
        // Adjust lerp factor based on player state
        if (this.player.isRunning) {
            lerpFactor *= 1.4; // Faster response when running
        } else if (this.player.isCrouching) {
            lerpFactor *= 0.7; // Slower, more stable when crouching
        }
        
        this.model.rotation.x = THREE.MathUtils.lerp(this.model.rotation.x, targetRotation.x, lerpFactor);
        this.model.rotation.y = THREE.MathUtils.lerp(this.model.rotation.y, targetRotation.y, lerpFactor);
        this.model.rotation.z = THREE.MathUtils.lerp(this.model.rotation.z, targetRotation.z, lerpFactor * 0.5); // Slower roll interpolation
    }
}
