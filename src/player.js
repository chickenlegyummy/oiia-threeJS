import * as THREE from 'three';
import { FirstPersonControls } from 'three/addons/controls/FirstPersonControls.js';

export class Player {
    constructor(camera, scene) {
        this.camera = camera;
        this.scene = scene;
        
        // Movement state
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.canJump = false;
        this.isWalking = false;
        this.isCrouching = false;
        this.isRunning = false;
        this.inputBlocked = false; // Input blocking flag
        
        // Player body
        this.body = null;
        
        // Movement settings
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.speed = 12.0;
        this.walkSpeed = 6.0;
        this.runSpeed = 20.0;
        this.jumpVelocity = 15.0;
        this.damping = 8.0;
        this.gravity = 30.0;
        this.mass = 100.0;
        
        // Player dimensions
        this.height = 1.6;
        this.crouchHeight = 0.8;
        this.radius = 0.3;
        
        // Mouse look - improved rotation handling
        this.isLocked = false;
        this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
        this.PI_2 = Math.PI / 2;
        this.mouseSensitivity = 0.002;
        
        // Enhanced rotation tracking to prevent accumulation errors
        this.rotationX = 0;
        this.rotationY = 0;
        this.maxPitch = Math.PI / 2 - 0.01; // Slightly less than 90 degrees to prevent gimbal lock
        
        // Collision detection
        this.raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 2);
        this.collisionObjects = [];
        
        // Camera shake and vibration effects
        this.walkBobTime = 0;
        this.walkBobIntensity = 0.02;
        this.walkBobSpeed = 10;
        this.runBobIntensity = 0.035;
        this.runBobSpeed = 15;
        this.crouchBobIntensity = 0.01;
        this.crouchBobSpeed = 6;
        this.jumpShakeIntensity = 0.1;
        this.jumpShakeDuration = 0.2;
        this.landShakeIntensity = 0.15;
        this.landShakeDuration = 0.3;
        this.currentShake = { intensity: 0, duration: 0, time: 0 };
        this.basePosition = new THREE.Vector3();
        this.isLanding = false;
        this.wasInAir = false;
        
        // Performance tracking
        this.prevTime = performance.now();
        
        this.init();
        this.createPlayerBody();
    }
    
    createPlayerBody() {
        // Create capsule geometry for the player body
        const bodyGroup = new THREE.Group();
        
        // Create capsule using cylinder + two spheres
        const cylinderHeight = this.height - (this.radius * 2);
        const cylinderGeometry = new THREE.CylinderGeometry(this.radius, this.radius, cylinderHeight);
        const sphereGeometry = new THREE.SphereGeometry(this.radius);
        
        // Create a subtle material for the body (slightly visible for testing)
        const bodyMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x00ff00, 
            transparent: true, 
            opacity: 0.1,  // Slightly visible for testing
            wireframe: false
        });
        
        // Create cylinder (main body)
        const cylinder = new THREE.Mesh(cylinderGeometry, bodyMaterial);
        cylinder.position.y = 0;
        cylinder.userData.isPlayerBody = true;
        bodyGroup.add(cylinder);
        
        // Create top sphere (head area)
        const topSphere = new THREE.Mesh(sphereGeometry, bodyMaterial);
        topSphere.position.y = cylinderHeight / 2 + this.radius;
        topSphere.userData.isPlayerBody = true;
        bodyGroup.add(topSphere);
        
        // Create bottom sphere (feet area)  
        const bottomSphere = new THREE.Mesh(sphereGeometry, bodyMaterial);
        bottomSphere.position.y = -(cylinderHeight / 2 + this.radius);
        bottomSphere.userData.isPlayerBody = true;
        bodyGroup.add(bottomSphere);
        
        // Add arms for better visualization
        const armGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.6);
        const armMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x0000ff, 
            transparent: true, 
            opacity: 0.2
        });
        
        // Right arm
        const rightArm = new THREE.Mesh(armGeometry, armMaterial);
        rightArm.position.set(0.3, cylinderHeight / 4, 0);
        rightArm.rotation.z = Math.PI / 4;
        rightArm.userData.isPlayerBody = true;
        bodyGroup.add(rightArm);
        
        // Left arm
        const leftArm = new THREE.Mesh(armGeometry, armMaterial);
        leftArm.position.set(-0.3, cylinderHeight / 4, 0);
        leftArm.rotation.z = -Math.PI / 4;
        leftArm.userData.isPlayerBody = true;
        bodyGroup.add(leftArm);
        
        // Position the body group
        this.body = bodyGroup;
        this.body.position.copy(this.camera.position);
        this.body.position.y -= this.height / 2; // Adjust so camera is at head level
        
        // Add body to scene
        this.scene.add(this.body);
        
        // Update collision objects to exclude the newly created body
        this.updateCollisionObjects();
        
        console.log('Player capsule body created and added to scene');
        console.log('Body position:', this.body.position);
        console.log('Body children count:', this.body.children.length);
    }
    
    init() {
        // Set up pointer lock with enhanced cross-browser support
        const lockEvents = ['click', 'keydown'];
        lockEvents.forEach(event => {
            document.addEventListener(event, (e) => {
                if (!this.isLocked && (event === 'click' || e.code === 'KeyF')) {
                    // Check if input is blocked by overlays
                    if (window.inputBlocker && window.inputBlocker.isInputBlocked()) {
                        console.log('🚫 Input blocked by overlay - cannot start game');
                        return;
                    }
                    
                    // Check if game is ready before allowing pointer lock
                    if (window.gameLoadingManager && !window.gameLoadingManager.isComplete) {
                        console.log('🚫 Game not ready yet - please wait for loading to complete');
                        return;
                    }
                    
                    // Check if loading screen is still visible
                    if (window.gameLoadingScreen && window.gameLoadingScreen.isVisible) {
                        console.log('🚫 Loading screen still visible - please wait');
                        return;
                    }
                    
                    // Check if network is synced OR we're in offline mode
                    if (typeof window.playerCanMove !== 'undefined' && !window.playerCanMove && 
                        (!window.offlineFallback || !window.offlineFallback.isOfflineMode)) {
                        console.log('🚫 Still syncing with server - please wait');
                        return;
                    }
                    
                    this.requestPointerLock();
                }
            });
        });
        
        const lockChangeEvents = [
            'pointerlockchange',
            'mozpointerlockchange', 
            'webkitpointerlockchange'
        ];
        
        lockChangeEvents.forEach(event => {
            document.addEventListener(event, () => {
                this.isLocked = !!(
                    document.pointerLockElement === document.body ||
                    document.mozPointerLockElement === document.body ||
                    document.webkitPointerLockElement === document.body
                );
                
                const instructions = document.getElementById('instructions');
                const debugPanel = document.getElementById('debugPanel');
                const isDebugPanelVisible = debugPanel && debugPanel.classList.contains('active');
                
                if (this.isLocked) {
                    instructions.style.display = 'none';
                } else if (!isDebugPanelVisible) {
                    // Only show instructions if debug panel is not open
                    instructions.style.display = 'block';
                }
            });
        });
        
        // Enhanced mouse movement with smoothing and proper bounds checking
        document.addEventListener('mousemove', (event) => {
            if (this.isLocked) {
                // Get movement values with cross-browser compatibility
                const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
                const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
                
                // Clamp movement values to prevent large jumps (fixes browser/hardware inconsistencies)
                const clampedMovementX = Math.max(-50, Math.min(50, movementX));
                const clampedMovementY = Math.max(-50, Math.min(50, movementY));
                
                // Update rotation values directly to avoid Euler accumulation issues
                this.rotationY -= clampedMovementX * this.mouseSensitivity;
                this.rotationX -= clampedMovementY * this.mouseSensitivity;
                
                // Clamp pitch to prevent gimbal lock and over-rotation
                this.rotationX = Math.max(-this.maxPitch, Math.min(this.maxPitch, this.rotationX));
                
                // Normalize yaw to prevent accumulation (keep between -PI and PI)
                while (this.rotationY > Math.PI) this.rotationY -= 2 * Math.PI;
                while (this.rotationY < -Math.PI) this.rotationY += 2 * Math.PI;
                
                // Apply rotation to camera using clean Euler values
                this.euler.set(this.rotationX, this.rotationY, 0, 'YXZ');
                this.camera.quaternion.setFromEuler(this.euler);

                FirstPersonControls(this.camera, domElement);
            }
        });
        
        // Enhanced keyboard controls with more keys
        document.addEventListener('keydown', (event) => {
            this.handleKeyDown(event);
        });
        
        document.addEventListener('keyup', (event) => {
            this.handleKeyUp(event);
        });
        
        // Add collision objects (you can add more objects here)
        this.scene.traverse((child) => {
            if (child.isMesh && child !== this.camera && child.parent !== this.body) {
                this.collisionObjects.push(child);
            }
        });
        
        // Update collision objects when body is created (exclude body parts)
        this.updateCollisionObjects();
    }
    
    updateCollisionObjects() {
        // Clear existing collision objects
        this.collisionObjects = [];
        
        // Add all mesh objects except camera and player body parts
        this.scene.traverse((child) => {
            if (child.isMesh && 
                child !== this.camera && 
                child.parent !== this.body && 
                child !== this.body &&
                !this.isPlayerBodyPart(child)) {
                this.collisionObjects.push(child);
            }
        });
    }
    
    isPlayerBodyPart(object) {
        if (!object) return false;
        
        // Check userData flags
        if (object.userData && (object.userData.isPlayerBody || object.userData.isWeapon || object.userData.isBullet)) {
            return true;
        }
        
        // Check if object is part of the body hierarchy
        if (!this.body) return false;
        
        // Check if object is a direct child of the body
        if (object.parent === this.body) return true;
        
        // Check if object is part of any attachment to the body
        let parent = object.parent;
        while (parent) {
            if (parent === this.body) return true;
            parent = parent.parent;
        }
        
        return false;
    }
    
    requestPointerLock() {
        const element = document.body;
        if (element.requestPointerLock) {
            element.requestPointerLock();
        } else if (element.mozRequestPointerLock) {
            element.mozRequestPointerLock();
        } else if (element.webkitRequestPointerLock) {
            element.webkitRequestPointerLock();
        }
    }

    exitPointerLock() {
        if (document.exitPointerLock) {
            document.exitPointerLock();
        } else if (document.mozExitPointerLock) {
            document.mozExitPointerLock();
        } else if (document.webkitExitPointerLock) {
            document.webkitExitPointerLock();
        }
    }
    
    handleKeyDown(event) {
        // Normal mode controls
        switch (event.code) {
            case 'KeyW':
            case 'ArrowUp':
                this.moveForward = true;
                break;
            case 'KeyS':
            case 'ArrowDown':
                this.moveBackward = true;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                this.moveLeft = true;
                break;
            case 'KeyD':
            case 'ArrowRight':
                this.moveRight = true;
                break;
            case 'Space':
                event.preventDefault();
                if (this.canJump) {
                    this.jump();
                }
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                this.isRunning = true;
                break;
            case 'ControlLeft':
            case 'ControlRight':
            case 'KeyC':
                if (!this.isCrouching) {
                    this.isCrouching = true;
                    // Add slight shake when starting to crouch
                    this.addCameraShake(0.05, 0.15);
                }
                break;
            case 'KeyF':
                event.preventDefault();
                if (!this.isLocked) {
                    this.requestPointerLock();
                }
                break;
            case 'KeyV':
                // Toggle body visibility for debugging
                this.toggleBodyVisibility();
                break;
        }
    }
    
    handleKeyUp(event) {
        // Normal mode controls
        switch (event.code) {
            case 'KeyW':
            case 'ArrowUp':
                this.moveForward = false;
                break;
            case 'KeyS':
            case 'ArrowDown':
                this.moveBackward = false;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                this.moveLeft = false;
                break;
            case 'KeyD':
            case 'ArrowRight':
                this.moveRight = false;
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                this.isRunning = false;
                break;
            case 'ControlLeft':
            case 'ControlRight':
            case 'KeyC':
                if (this.isCrouching) {
                    this.isCrouching = false;
                    // Add slight shake when stopping crouch
                    this.addCameraShake(0.05, 0.15);
                }
                break;
        }
    }
    
    jump() {
        if (this.canJump) {
            this.velocity.y += this.jumpVelocity;
            this.canJump = false;
            this.wasInAir = true;
            
            // Add jump shake effect
            this.addCameraShake(this.jumpShakeIntensity, this.jumpShakeDuration);
        }
    }
    
    checkCollisions() {
        // Ground collision detection
        this.raycaster.ray.origin.copy(this.camera.position);
        this.raycaster.ray.direction.set(0, -1, 0);
        
        // Filter out player body parts from collision detection
        const validCollisionObjects = this.collisionObjects.filter(obj => !this.isPlayerBodyPart(obj));
        const intersections = this.raycaster.intersectObjects(validCollisionObjects);
        
        const targetHeight = this.isCrouching ? this.crouchHeight : this.height;
        
        if (intersections.length > 0) {
            const distance = intersections[0].distance;
            if (distance < targetHeight) {
                this.camera.position.y = intersections[0].point.y + targetHeight;
                this.velocity.y = Math.max(0, this.velocity.y);
                
                // Landing effect
                if (!this.canJump && this.wasInAir) {
                    this.addCameraShake(this.landShakeIntensity, this.landShakeDuration);
                    this.wasInAir = false;
                }
                
                this.canJump = true;
            }
        }
    }
    
    addCameraShake(intensity, duration) {
        this.currentShake = {
            intensity: intensity,
            duration: duration,
            time: 0
        };
    }
    
    applyCameraEffects(delta) {
        // Store the base position
        this.basePosition.copy(this.camera.position);
        
        // Apply walking bob effect
        this.applyWalkingBob(delta);
        
        // Apply camera shake effects
        this.applyCameraShake(delta);
    }
    
    applyWalkingBob(delta) {
        const isMoving = this.moveForward || this.moveBackward || this.moveLeft || this.moveRight;
        
        if (isMoving && this.canJump) {
            // Update walk bob time
            let bobSpeed = this.walkBobSpeed;
            let bobIntensity = this.walkBobIntensity;
            
            if (this.isCrouching) {
                bobSpeed = this.crouchBobSpeed;
                bobIntensity = this.crouchBobIntensity;
            } else if (this.isRunning) {
                bobSpeed = this.runBobSpeed;
                bobIntensity = this.runBobIntensity;
            }
            
            this.walkBobTime += delta * bobSpeed;
            
            // Apply vertical bob (Y-axis)
            const verticalBob = Math.sin(this.walkBobTime * 2) * bobIntensity;
            this.camera.position.y += verticalBob;
            
            // Apply horizontal sway (X and Z-axis) for more realistic movement
            const horizontalBob = Math.sin(this.walkBobTime) * bobIntensity * 0.3;
            const forwardBob = Math.cos(this.walkBobTime * 0.5) * bobIntensity * 0.2;
            
            // Apply sway relative to camera direction
            const sideways = new THREE.Vector3();
            sideways.crossVectors(this.camera.getWorldDirection(new THREE.Vector3()), new THREE.Vector3(0, 1, 0));
            sideways.normalize();
            
            this.camera.position.add(sideways.multiplyScalar(horizontalBob));
            
            // Slight forward/backward bob
            const forward = this.camera.getWorldDirection(new THREE.Vector3());
            this.camera.position.add(forward.multiplyScalar(forwardBob));
            
        } else {
            // Gradually reduce bob time when not moving
            this.walkBobTime *= 0.95;
        }
    }
    
    applyCameraShake(delta) {
        if (this.currentShake.intensity > 0) {
            this.currentShake.time += delta;
            
            // Calculate shake intensity with falloff
            const progress = this.currentShake.time / this.currentShake.duration;
            const intensity = this.currentShake.intensity * (1 - progress);
            
            if (progress < 1) {
                // Apply random shake
                const shakeX = (Math.random() - 0.5) * intensity;
                const shakeY = (Math.random() - 0.5) * intensity;
                const shakeZ = (Math.random() - 0.5) * intensity;
                
                this.camera.position.x += shakeX;
                this.camera.position.y += shakeY;
                this.camera.position.z += shakeZ;
            } else {
                // Reset shake
                this.currentShake = { intensity: 0, duration: 0, time: 0 };
            }
        }
    }

    update() {
        if (!this.isLocked) return;
        
        // Only block if input is explicitly blocked for overlays (not for network sync)
        if (window.inputBlocker && window.inputBlocker.isInputBlocked() && 
            window.inputBlocker.getBlockReasons().includes('loading') || 
            window.inputBlocker.getBlockReasons().includes('debug')) {
            return; // Only block for loading/debug overlays, not network sync
        }
        
        const time = performance.now();
        const delta = (time - this.prevTime) / 1000;
        this.prevTime = time;
        
        // Clamp delta to prevent large jumps
        const clampedDelta = Math.min(delta, 0.1);
        
        // Apply gravity
        this.velocity.y -= this.gravity * clampedDelta;
        
        // Apply damping to horizontal movement
        this.velocity.x -= this.velocity.x * this.damping * clampedDelta;
        this.velocity.z -= this.velocity.z * this.damping * clampedDelta;
        
        // Determine current speed based on state
        let currentSpeed = this.speed;
        if (this.isRunning && !this.isCrouching) {
            currentSpeed = this.runSpeed;
        } else if (this.isCrouching) {
            currentSpeed = this.walkSpeed * 0.5;
        }
        
        // Update direction based on movement keys
        this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
        this.direction.x = Number(this.moveLeft) - Number(this.moveRight); // Fixed: swapped left and right
        this.direction.normalize();
        
        // Apply movement forces
        if (this.moveForward || this.moveBackward) {
            this.velocity.z -= this.direction.z * currentSpeed * clampedDelta;
        }
        if (this.moveLeft || this.moveRight) {
            this.velocity.x -= this.direction.x * currentSpeed * clampedDelta;
        }
        
        // Apply movement with collision detection
        const oldPosition = this.camera.position.clone();
        
        // Move horizontally
        this.camera.translateX(this.velocity.x * clampedDelta);
        this.camera.translateZ(this.velocity.z * clampedDelta);
        
        // Move vertically
        this.camera.position.y += this.velocity.y * clampedDelta;
        
        // Check collisions and adjust position
        this.checkCollisions();
        
        // Update body position after collision checks to prevent conflicts
        if (this.body) {
            const targetPosition = this.camera.position.clone();
            targetPosition.y -= this.height / 2; // Keep body centered below camera
            
            // Smooth position update to prevent jittering
            this.body.position.lerp(targetPosition, 0.6);
            
            // Update body rotation to match camera's Y rotation only (not pitch)
            this.body.rotation.y = this.rotationY; // Use direct rotation value instead of euler.y
        }
        
        // Prevent falling through the world
        const minHeight = this.isCrouching ? this.crouchHeight : this.height;
        if (this.camera.position.y < minHeight) {
            // Landing effect when hitting the floor
            if (!this.canJump && this.wasInAir) {
                this.addCameraShake(this.landShakeIntensity, this.landShakeDuration);
                this.wasInAir = false;
            }
            
            this.camera.position.y = minHeight;
            this.velocity.y = 0;
            this.canJump = true;
        }
        
        // Apply camera effects (walking bob and shake)
        this.applyCameraEffects(clampedDelta);
    }
    
    toggleBodyVisibility() {
        if (this.body) {
            this.body.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material.opacity = child.material.opacity > 0 ? 0.0 : 0.3;
                }
            });
        }
    }
    
    setBodyVisibility(visible) {
        if (this.body) {
            this.body.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material.opacity = visible ? 0.3 : 0.0;
                }
            });
        }
    }

    getPlayerBody() {
        return this.body;
    }
}
