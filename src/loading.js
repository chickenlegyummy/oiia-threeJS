// Loading manager for game initialization
class GameLoadingManager {
    constructor() {
        this.totalSystems = 0;
        this.loadedSystems = 0;
        this.systems = new Map();
        this.loadingCallbacks = [];
        this.completeCallbacks = [];
        this.isComplete = false;
        
        console.log('🔄 GameLoadingManager initialized');
    }

    // Register a system that needs to be loaded
    registerSystem(name, description = '') {
        this.systems.set(name, {
            name,
            description,
            loaded: false,
            progress: 0,
            error: null
        });
        this.totalSystems++;
        console.log(`📋 Registered system: ${name} - ${description}`);
        this.updateProgress();
        return this.systems.get(name);
    }

    // Mark a system as loaded
    markSystemLoaded(name, progress = 100) {
        const system = this.systems.get(name);
        if (system && !system.loaded) {
            system.loaded = true;
            system.progress = progress;
            this.loadedSystems++;
            console.log(`✅ System loaded: ${name} (${this.loadedSystems}/${this.totalSystems})`);
            this.updateProgress();
            this.checkComplete();
        }
    }

    // Update system progress
    updateSystemProgress(name, progress, status = '') {
        const system = this.systems.get(name);
        if (system) {
            system.progress = progress;
            if (status) system.status = status;
            this.updateProgress();
        }
    }

    // Mark a system as failed
    markSystemError(name, error) {
        const system = this.systems.get(name);
        if (system) {
            system.error = error;
            system.progress = 0;
            console.error(`❌ System failed to load: ${name}`, error);
            this.updateProgress();
        }
    }

    // Get overall loading progress (0-100)
    getProgress() {
        if (this.totalSystems === 0) return 100;
        
        let totalProgress = 0;
        this.systems.forEach(system => {
            totalProgress += system.progress;
        });
        
        return Math.floor(totalProgress / this.totalSystems);
    }

    // Get detailed loading status
    getStatus() {
        const systems = Array.from(this.systems.values());
        return {
            totalSystems: this.totalSystems,
            loadedSystems: this.loadedSystems,
            progress: this.getProgress(),
            isComplete: this.isComplete,
            systems: systems
        };
    }

    // Check if all systems are loaded
    checkComplete() {
        if (this.loadedSystems >= this.totalSystems && !this.isComplete) {
            this.isComplete = true;
            console.log('🎉 All systems loaded! Game ready to start.');
            this.completeCallbacks.forEach(callback => {
                try {
                    callback();
                } catch (error) {
                    console.error('❌ Error in loading complete callback:', error);
                }
            });
        }
    }

    // Add callback for progress updates
    onProgress(callback) {
        this.loadingCallbacks.push(callback);
    }

    // Add callback for completion
    onComplete(callback) {
        if (this.isComplete) {
            callback();
        } else {
            this.completeCallbacks.push(callback);
        }
    }

    // Update progress and notify callbacks
    updateProgress() {
        const status = this.getStatus();
        this.loadingCallbacks.forEach(callback => {
            try {
                callback(status);
            } catch (error) {
                console.error('❌ Error in loading progress callback:', error);
            }
        });
    }

    // Reset loading manager
    reset() {
        this.systems.clear();
        this.totalSystems = 0;
        this.loadedSystems = 0;
        this.isComplete = false;
        this.loadingCallbacks = [];
        this.completeCallbacks = [];
    }
}

// Global loading manager instance
window.gameLoadingManager = new GameLoadingManager();

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameLoadingManager };
}
