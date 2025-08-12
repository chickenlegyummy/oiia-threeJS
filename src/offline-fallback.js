import * as THREE from 'three';

// Offline Fallback System for the cat FPS game
// This system activates when multiplayer connection fails or is unavailable
export class OfflineFallbackSystem {
    constructor(scene, targetManager, weapon) {
        this.scene = scene;
        this.targetManager = targetManager;
        this.weapon = weapon;
        
        // Offline gameplay configuration - MATCHING ORIGINAL GAME PROPERTIES
        this.isOfflineMode = false;
        this.targetCount = 0;
        this.maxTargets = 8; // Match original spawnInitialTargets (8 targets)
        this.spawnInterval = 2000; // 2 seconds between spawns
        this.offlineScore = 0;
        this.targetsHit = 0;
        
        // Original target positions from spawnInitialTargets
        this.originalSpawnPositions = [
            { x: 0, y: 2, z: -15 },
            { x: -8, y: 1.5, z: -20 },
            { x: 8, y: 2.5, z: -18 },
            { x: -5, y: 1, z: -25 },
            { x: 5, y: 3, z: -22 },
            { x: 0, y: 1.5, z: -30 },
            { x: -12, y: 2, z: -35 },
            { x: 12, y: 1.8, z: -32 }
        ];
        
        // Additional spawn areas for variety (matching original spawnRandomTarget ranges)
        this.randomSpawnZones = {
            xRange: { min: -20, max: 20 }, // (Math.random() - 0.5) * 40
            yRange: { min: 1, max: 5 },    // 1 + Math.random() * 4
            zRange: { min: -40, max: -15 } // -15 - Math.random() * 25
        };
        
        // Track spawned targets for cleanup
        this.offlineTargets = new Set();
        
        console.log('🔄 Offline fallback system initialized with original game properties');
    }
    
    // Activate offline mode
    activate() {
        if (this.isOfflineMode) {
            console.log('⚠️ Offline mode already active');
            return;
        }
        
        console.log('🔄 Activating offline fallback mode...');
        this.isOfflineMode = true;
        
        // Hide loading screen and unblock input if it's still visible
        if (window.gameLoadingScreen) {
            window.gameLoadingScreen.hide();
        }
        
        // Set player movement flag to allow F key to work
        window.playerCanMove = true;
        window.networkSynced = true;
        
        // Clear any existing network targets
        this.clearNetworkTargets();
        
        // Set up offline target spawning
        this.startOfflineTargetSpawning();
        
        // Set up offline hit detection
        this.setupOfflineHitDetection();
        
        // Update UI to show offline mode
        this.updateOfflineUI();
        
        // Spawn initial targets
        this.spawnInitialOfflineTargets();
        
        console.log('✅ Offline mode activated - single player gameplay ready');
    }
    
    // Deactivate offline mode (when reconnecting)
    deactivate() {
        if (!this.isOfflineMode) {
            return;
        }
        
        console.log('🌐 Deactivating offline mode - switching to multiplayer');
        this.isOfflineMode = false;
        
        // Stop spawning offline targets
        if (this.spawnTimer) {
            clearInterval(this.spawnTimer);
            this.spawnTimer = null;
        }
        
        // Clear all offline targets
        this.clearOfflineTargets();
        
        // Reset offline stats
        this.resetOfflineStats();
        
        console.log('✅ Offline mode deactivated');
    }
    
    // Clear any existing network targets
    clearNetworkTargets() {
        if (!this.targetManager) return;
        
        console.log('🧹 Clearing network targets for offline mode');
        const targetsToRemove = [];
        
        this.targetManager.targets.forEach(target => {
            if (target.userData.networkTarget) {
                targetsToRemove.push(target);
            }
        });
        
        targetsToRemove.forEach(target => {
            this.targetManager.removeTarget(target);
        });
        
        console.log(`🧹 Cleared ${targetsToRemove.length} network targets`);
    }
    
    // Start spawning targets for offline play
    startOfflineTargetSpawning() {
        // Clear any existing timer
        if (this.spawnTimer) {
            clearInterval(this.spawnTimer);
        }
        
        // Start regular spawning
        this.spawnTimer = setInterval(() => {
            if (this.targetCount < this.maxTargets) {
                this.spawnOfflineTarget();
            }
        }, this.spawnInterval);
        
        console.log('🎯 Offline target spawning started');
    }
    
    // Spawn initial targets for immediate gameplay (using original positions)
    spawnInitialOfflineTargets() {
        console.log('🎯 Spawning initial offline targets using original positions');
        
        // Use the exact same positions as the original spawnInitialTargets
        this.originalSpawnPositions.forEach((pos, index) => {
            setTimeout(() => {
                this.spawnOfflineTargetAtPosition(pos, index);
            }, index * 500); // Same 500ms stagger as original
        });
    }
    
    // Spawn a target at a specific position (matching original createTarget options)
    spawnOfflineTargetAtPosition(position, index = 0) {
        if (!this.targetManager || !this.targetManager.isModelLoaded) {
            console.log('⚠️ Target manager not ready for offline spawning');
            return;
        }
        
        const pos = new THREE.Vector3(position.x, position.y, position.z);
        
        // Use original target options from spawnInitialTargets
        const options = {
            scale: 5 + Math.random() * 0.5,        // Same as original: 5 + Math.random() * 0.5
            health: 75 + Math.random() * 50,       // Same as original: 75 + Math.random() * 50
            points: 10 + Math.floor(Math.random() * 20) // Same as original: 10 + Math.floor(Math.random() * 20)
        };
        
        // Create offline target using original target manager
        const target = this.targetManager.createTarget(pos, options);
        
        if (target) {
            // Mark as offline target
            target.userData.offlineTarget = true;
            target.userData.spawnTime = Date.now();
            target.userData.originalPosition = position; // Store original position for respawning
            
            // Add to tracking
            this.offlineTargets.add(target);
            this.targetCount++;
            
            console.log(`🎯 Offline target spawned at original position (${position.x}, ${position.y}, ${position.z}) with health: ${options.health}, points: ${options.points}`);
        }
    }
    
    // Spawn a single offline target at random location (matching spawnRandomTarget)
    spawnOfflineTarget() {
        if (!this.targetManager || !this.targetManager.isModelLoaded) {
            console.log('⚠️ Target manager not ready for offline spawning');
            return;
        }
        
        // Use exact same random generation as original spawnRandomTarget
        const x = (Math.random() - 0.5) * 40;  // Same formula
        const y = 1 + Math.random() * 4;       // Same formula
        const z = -15 - Math.random() * 25;    // Same formula
        
        const position = new THREE.Vector3(x, y, z);
        
        // Use original target options from spawnRandomTarget
        const options = {
            scale: 5 + Math.random() * 0.6,        // Same as spawnRandomTarget: 5 + Math.random() * 0.6
            health: 50 + Math.random() * 100,      // Same as spawnRandomTarget: 50 + Math.random() * 100
            points: 5 + Math.floor(Math.random() * 25) // Same as spawnRandomTarget: 5 + Math.floor(Math.random() * 25)
        };
        
        // Create offline target
        const target = this.targetManager.createTarget(position, options);
        
        if (target) {
            // Mark as offline target
            target.userData.offlineTarget = true;
            target.userData.spawnTime = Date.now();
            
            // Add to tracking
            this.offlineTargets.add(target);
            this.targetCount++;
            
            console.log(`🎯 Random offline target spawned at (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}) with health: ${options.health}, points: ${options.points}`);
        }
    }
    
    // Handle offline target destruction (when health reaches 0)
    handleOfflineTargetDestroyed(target) {
        if (!target.userData.offlineTarget || target.userData.alreadyProcessed) {
            return;
        }
        
        // Mark as processed to prevent double processing
        target.userData.alreadyProcessed = true;
        
        console.log('🎯 Offline target destroyed!');
        
        // Update offline score using original target points
        const points = target.userData.points || 10;
        this.offlineScore += points;
        this.targetsHit++;
        
        // Remove from tracking
        this.offlineTargets.delete(target);
        this.targetCount--;
        
        // Update HUD
        this.updateOfflineScore();
        
        console.log(`🎯 Target destroyed for ${points} points. Score: ${this.offlineScore}, Targets remaining: ${this.targetCount}`);
        
        // Spawn replacement target after delay to maintain target count
        setTimeout(() => {
            if (this.isOfflineMode && this.targetCount < this.maxTargets) {
                // If this was an original position target, respawn at same location
                if (target.userData.originalPosition) {
                    console.log('🔄 Respawning target at original position');
                    this.spawnOfflineTargetAtPosition(target.userData.originalPosition);
                } else {
                    // Otherwise spawn at random location
                    console.log('🔄 Spawning replacement random target');
                    this.spawnOfflineTarget();
                }
            }
        }, 1000);
    }
    
    // Despawn offline target (cleanup)
    despawnOfflineTarget(target) {
        if (!target || !this.offlineTargets.has(target)) {
            return;
        }
        
        // Remove from tracking
        this.offlineTargets.delete(target);
        this.targetCount--;
        
        // Remove from scene via target manager (this will handle proper cleanup)
        if (this.targetManager) {
            this.targetManager.removeTarget(target);
        }
        
        console.log(`🎯 Offline target despawned. Remaining: ${this.targetCount}`);
    }
    
    // Clear all offline targets
    clearOfflineTargets() {
        console.log('🧹 Clearing all offline targets');
        
        const targetsToRemove = Array.from(this.offlineTargets);
        targetsToRemove.forEach(target => {
            this.despawnOfflineTarget(target);
        });
        
        this.offlineTargets.clear();
        this.targetCount = 0;
        
        console.log('🧹 All offline targets cleared');
    }
    
    // Set up hit detection for offline mode
    setupOfflineHitDetection() {
        if (!this.weapon) {
            console.log('⚠️ Weapon not available for offline hit detection setup');
            return;
        }
        
        // Store original hit handler
        const originalOnTargetHit = this.weapon.onTargetHit;
        
        // Override weapon's target hit handler for offline mode
        this.weapon.onTargetHit = (target, hitInfo) => {
            if (this.isOfflineMode && target.userData.offlineTarget) {
                console.log('🎯 Offline mode target hit detected via weapon system');
                
                // Don't send to network, but process the hit locally using original target system
                if (target.userData.onHit) {
                    const hitInfoWithDamage = { ...hitInfo, damage: this.weapon.damage || 25 };
                    target.userData.onHit(hitInfoWithDamage, false); // false = don't send to network
                }
                
                // Check if target was destroyed and handle offline logic
                setTimeout(() => {
                    if (target.userData.health <= 0 && !target.userData.alreadyProcessed) {
                        this.handleOfflineTargetDestroyed(target);
                    }
                }, 100); // Small delay to let original target destruction logic complete
                
            } else if (originalOnTargetHit) {
                // Normal multiplayer hit processing
                return originalOnTargetHit.call(this.weapon, target, hitInfo);
            }
        };
        
        console.log('🔫 Offline hit detection configured - weapon will handle offline target hits');
    }
    
    // Update UI for offline mode
    updateOfflineUI() {
        // Update connection status
        const connectionElement = document.getElementById('connection');
        if (connectionElement) {
            connectionElement.innerHTML = '🔴 Offline Mode';
            connectionElement.className = 'offline';
        }
        
        // Add offline mode indicator to HUD
        const hud = document.getElementById('hud');
        if (hud) {
            let offlineModeDiv = document.getElementById('offline-mode');
            if (!offlineModeDiv) {
                offlineModeDiv = document.createElement('div');
                offlineModeDiv.id = 'offline-mode';
                offlineModeDiv.style.color = '#ff6b6b';
                offlineModeDiv.style.fontWeight = 'bold';
                hud.appendChild(offlineModeDiv);
            }
            offlineModeDiv.innerHTML = 'Single Player Mode';
        }
        
        // Update score display
        this.updateOfflineScore();
    }
    
    // Update offline score display
    updateOfflineScore() {
        const scoreElement = document.getElementById('score');
        if (scoreElement) {
            scoreElement.innerHTML = `Score: ${this.offlineScore}`;
            scoreElement.style.color = '#f9ca24';
        }
        
        // Update targets count
        const targetsElement = document.getElementById('targets');
        if (targetsElement) {
            targetsElement.innerHTML = `Targets: ${this.targetCount}/${this.maxTargets}`;
            targetsElement.style.color = '#ff6b6b';
        } else {
            // Create targets display if it doesn't exist
            const hud = document.getElementById('hud');
            if (hud) {
                const targetsDiv = document.createElement('div');
                targetsDiv.id = 'targets';
                targetsDiv.innerHTML = `Targets: ${this.targetCount}/${this.maxTargets}`;
                targetsDiv.style.color = '#ff6b6b';
                targetsDiv.style.fontWeight = 'bold';
                hud.appendChild(targetsDiv);
            }
        }
    }
    
    // Reset offline stats
    resetOfflineStats() {
        this.offlineScore = 0;
        this.targetsHit = 0;
        this.targetCount = 0;
        
        // Remove offline mode indicator
        const offlineModeDiv = document.getElementById('offline-mode');
        if (offlineModeDiv) {
            offlineModeDiv.remove();
        }
    }
    
    // Check if should activate offline mode (called when connection fails)
    checkAndActivateOfflineMode(connectionFailed = false) {
        if (connectionFailed || !window.networkManager?.isConnected) {
            console.log('🔄 Connection failed or unavailable - activating offline mode');
            this.activate();
            return true;
        }
        return false;
    }
    
    // Update method to be called in game loop
    update(deltaTime) {
        if (!this.isOfflineMode) {
            return;
        }
        
        // Update any time-based offline logic here
        // For now, spawning is handled by intervals
    }
    
    // Get current offline stats
    getStats() {
        return {
            score: this.offlineScore,
            targetsHit: this.targetsHit,
            activeTargets: this.targetCount,
            isActive: this.isOfflineMode
        };
    }
    
    // Manual target spawn (for testing)
    spawnTargetNow() {
        if (this.isOfflineMode) {
            this.spawnOfflineTarget();
        }
    }
    
    // Adjust difficulty (matching original game balance)
    setDifficulty(level) {
        switch(level) {
            case 'easy':
                this.maxTargets = 6;
                this.spawnInterval = 3000; // 3 seconds
                break;
            case 'normal':
                this.maxTargets = 8; // Original game default
                this.spawnInterval = 2000; // 2 seconds
                break;
            case 'hard':
                this.maxTargets = 10;
                this.spawnInterval = 1500; // 1.5 seconds
                break;
        }
        
        console.log(`🎯 Offline difficulty set to ${level}: ${this.maxTargets} max targets, ${this.spawnInterval}ms spawn interval`);
        console.log('🎯 Targets use original health values (75-125 or 50-150) and damage system (25 damage per hit)');
    }
}

// Export for use in other modules
export default OfflineFallbackSystem;
