import * as THREE from 'three';

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
        
        // Mouse look
        this.isLocked = false;
        this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
        this.PI_2 = Math.PI / 2;
        this.mouseSensitivity = 0.002;
        
        // Collision detection
        this.raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 2);
        this.collisionObjects = [];
        
        // Performance tracking
        this.prevTime = performance.now();
        
        this.init();
    }
    
    init() {
        // Set up pointer lock with enhanced cross-browser support
        const lockEvents = ['click', 'keydown'];
        lockEvents.forEach(event => {
            document.addEventListener(event, (e) => {
                if (!this.isLocked && (event === 'click' || e.code === 'KeyF')) {
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
        
        // Enhanced mouse movement with smoothing
        let mouseX = 0, mouseY = 0;
        document.addEventListener('mousemove', (event) => {
            if (!this.isLocked) return;
            
            mouseX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
            mouseY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
            
            this.euler.setFromQuaternion(this.camera.quaternion);
            this.euler.y -= mouseX * this.mouseSensitivity;
            this.euler.x -= mouseY * this.mouseSensitivity;
            this.euler.x = Math.max(-this.PI_2, Math.min(this.PI_2, this.euler.x));
            
            this.camera.quaternion.setFromEuler(this.euler);
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
            if (child.isMesh && child !== this.camera) {
                this.collisionObjects.push(child);
            }
        });
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
                this.isCrouching = true;
                break;
            case 'KeyF':
                event.preventDefault();
                if (!this.isLocked) {
                    this.requestPointerLock();
                }
                break;
        }
    }
    
    handleKeyUp(event) {
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
                this.isCrouching = false;
                break;
        }
    }
    
    jump() {
        if (this.canJump) {
            this.velocity.y += this.jumpVelocity;
            this.canJump = false;
        }
    }
    
    checkCollisions() {
        // Ground collision detection
        this.raycaster.ray.origin.copy(this.camera.position);
        this.raycaster.ray.direction.set(0, -1, 0);
        
        const intersections = this.raycaster.intersectObjects(this.collisionObjects);
        
        const targetHeight = this.isCrouching ? this.crouchHeight : this.height;
        
        if (intersections.length > 0) {
            const distance = intersections[0].distance;
            if (distance < targetHeight) {
                this.camera.position.y = intersections[0].point.y + targetHeight;
                this.velocity.y = Math.max(0, this.velocity.y);
                this.canJump = true;
            }
        }
    }
    
    update() {
        if (!this.isLocked) return;
        
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
        
        // Prevent falling through the world
        const minHeight = this.isCrouching ? this.crouchHeight : this.height;
        if (this.camera.position.y < minHeight) {
            this.camera.position.y = minHeight;
            this.velocity.y = 0;
            this.canJump = true;
        }
        
        // Add subtle camera bob when moving
        if ((this.moveForward || this.moveBackward || this.moveLeft || this.moveRight) && this.canJump) {
            const bobIntensity = this.isRunning ? 0.008 : 0.004;
            const bobSpeed = this.isRunning ? 12 : 8;
            this.camera.position.y += Math.sin(time * bobSpeed * 0.001) * bobIntensity;
        }
    }
}
