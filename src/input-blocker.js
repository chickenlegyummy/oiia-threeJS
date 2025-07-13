// Input blocker to prevent game actions during overlays
class InputBlocker {
    constructor() {
        this.isBlocked = false;
        this.blockReasons = new Set();
        this.originalCursor = null;
        
        console.log('🚫 Input blocker initialized');
    }

    // Block input with a reason
    block(reason = 'overlay') {
        this.blockReasons.add(reason);
        
        if (!this.isBlocked) {
            this.isBlocked = true;
            this.enableCursor();
            console.log('🚫 Input blocked:', reason);
        }
    }

    // Unblock input for a specific reason
    unblock(reason = 'overlay') {
        this.blockReasons.delete(reason);
        
        if (this.blockReasons.size === 0 && this.isBlocked) {
            this.isBlocked = false;
            this.disableCursor();
            console.log('✅ Input unblocked:', reason);
        }
    }

    // Check if input is currently blocked
    isInputBlocked() {
        return this.isBlocked;
    }

    // Get current block reasons
    getBlockReasons() {
        return Array.from(this.blockReasons);
    }

    // Enable cursor for overlays
    enableCursor() {
        document.body.classList.add('overlay-active');
        console.log('👆 Cursor enabled for overlay');
    }

    // Disable cursor for game
    disableCursor() {
        document.body.classList.remove('overlay-active');
        console.log('🎮 Cursor disabled for game');
    }

    // Block specific input types
    blockMouseEvents() {
        if (this.isBlocked) {
            // Prevent all mouse events on canvas and game elements
            const canvas = document.querySelector('canvas');
            if (canvas) {
                canvas.style.pointerEvents = 'none';
            }
        }
    }

    unblockMouseEvents() {
        if (!this.isBlocked) {
            const canvas = document.querySelector('canvas');
            if (canvas) {
                canvas.style.pointerEvents = 'auto';
            }
        }
    }

    // Intercept and block game input events
    interceptInput() {
        // Block shooting and game actions
        const originalAddEventListener = EventTarget.prototype.addEventListener;
        const blocker = this;
        
        EventTarget.prototype.addEventListener = function(type, listener, options) {
            if (blocker.shouldBlockEvent(type, this)) {
                // Wrap listener to check if input is blocked
                const wrappedListener = function(event) {
                    if (blocker.isInputBlocked()) {
                        console.log('🚫 Blocked event:', type);
                        event.preventDefault();
                        event.stopPropagation();
                        return false;
                    }
                    return listener.call(this, event);
                };
                
                return originalAddEventListener.call(this, type, wrappedListener, options);
            } else {
                return originalAddEventListener.call(this, type, listener, options);
            }
        };
    }

    shouldBlockEvent(eventType, target) {
        const gameInputEvents = [
            'click', 'mousedown', 'mouseup', 'mousemove',
            'keydown', 'keyup', 'keypress',
            'contextmenu'
        ];
        
        // Only block if it's a game input event and not on overlay elements
        return gameInputEvents.includes(eventType) && 
               !this.isOverlayElement(target);
    }

    isOverlayElement(element) {
        const overlaySelectors = [
            '#loading-screen',
            '#debugPanel',
            '#instructions',
            '.overlay'
        ];
        
        if (!element || !element.closest) return false;
        
        return overlaySelectors.some(selector => {
            try {
                return element.closest(selector);
            } catch (e) {
                return false;
            }
        });
    }

    // Manual input blocking for weapon/shooting
    blockShooting() {
        if (window.weapon) {
            window.weapon.blocked = true;
        }
        
        // Block player input as well
        if (window.gamePlayer) {
            window.gamePlayer.inputBlocked = true;
        }
    }

    unblockShooting() {
        if (window.weapon) {
            window.weapon.blocked = false;
        }
        
        if (window.gamePlayer) {
            window.gamePlayer.inputBlocked = false;
        }
    }

    // Full block (input + shooting)
    fullBlock(reason) {
        this.block(reason);
        this.blockShooting();
        this.blockMouseEvents();
    }

    // Full unblock
    fullUnblock(reason) {
        this.unblock(reason);
        this.unblockShooting();
        this.unblockMouseEvents();
    }
}

// Global input blocker instance
window.inputBlocker = new InputBlocker();

// Auto-block when loading screen is visible
if (window.gameLoadingScreen) {
    const originalShow = window.gameLoadingScreen.show;
    const originalHide = window.gameLoadingScreen.hide;
    
    window.gameLoadingScreen.show = function() {
        window.inputBlocker.fullBlock('loading');
        return originalShow.call(this);
    };
    
    window.gameLoadingScreen.hide = function() {
        window.inputBlocker.fullUnblock('loading');
        return originalHide.call(this);
    };
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { InputBlocker };
}
