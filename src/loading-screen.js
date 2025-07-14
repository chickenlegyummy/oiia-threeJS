// Loading screen UI component
class LoadingScreen {
    constructor() {
        this.element = null;
        this.progressBar = null;
        this.progressText = null;
        this.systemsList = null;
        this.startButton = null;
        this.isVisible = false;
        
        this.createLoadingScreen();
        this.setupEventListeners();
        
        console.log('🎨 Loading screen initialized');
    }

    createLoadingScreen() {
        // Create main loading screen container
        this.element = document.createElement('div');
        this.element.id = 'loading-screen';
        this.element.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            color: white;
            font-family: 'Arial', sans-serif;
            transition: opacity 0.5s ease-in-out;
        `;

        // Game title
        const title = document.createElement('h1');
        title.textContent = 'Cat FPS Game';
        title.style.cssText = `
            font-size: 3em;
            margin: 0 0 2rem 0;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
            background: linear-gradient(45deg, #fff, #87CEEB);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        `;

        // Loading container
        const loadingContainer = document.createElement('div');
        loadingContainer.style.cssText = `
            background: rgba(255,255,255,0.1);
            border-radius: 15px;
            padding: 2rem;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
            min-width: 400px;
            text-align: center;
        `;

        // Progress text
        this.progressText = document.createElement('div');
        this.progressText.textContent = 'Initializing game systems...';
        this.progressText.style.cssText = `
            font-size: 1.2em;
            margin-bottom: 1rem;
            color: #ffffff;
        `;

        // Progress bar container
        const progressContainer = document.createElement('div');
        progressContainer.style.cssText = `
            width: 100%;
            height: 20px;
            background: rgba(0,0,0,0.3);
            border-radius: 10px;
            overflow: hidden;
            margin-bottom: 1rem;
            border: 1px solid rgba(255,255,255,0.3);
        `;

        // Progress bar
        this.progressBar = document.createElement('div');
        this.progressBar.style.cssText = `
            width: 0%;
            height: 100%;
            background: linear-gradient(90deg, #4ecdc4, #44a08d);
            border-radius: 10px;
            transition: width 0.3s ease;
            box-shadow: 0 0 10px rgba(78, 205, 196, 0.5);
        `;

        // Percentage text
        this.percentageText = document.createElement('div');
        this.percentageText.textContent = '0%';
        this.percentageText.style.cssText = `
            font-size: 1.1em;
            margin-top: 0.5rem;
            font-weight: bold;
        `;

        // Player name input (shown when loading is complete)
        this.nameContainer = document.createElement('div');
        this.nameContainer.style.cssText = `
            margin-top: 1.5rem;
            display: none;
        `;

        const nameLabel = document.createElement('label');
        nameLabel.textContent = 'Player Name (optional):';
        nameLabel.style.cssText = `
            display: block;
            margin-bottom: 0.5rem;
            font-size: 1em;
            color: #ffffff;
        `;

        this.nameInput = document.createElement('input');
        this.nameInput.type = 'text';
        this.nameInput.placeholder = 'Enter your name or leave blank for Guest';
        this.nameInput.maxLength = 20;
        this.nameInput.style.cssText = `
            width: 100%;
            padding: 0.8rem;
            border: 2px solid rgba(255,255,255,0.3);
            border-radius: 8px;
            background: rgba(255,255,255,0.1);
            color: white;
            font-size: 1em;
            outline: none;
            transition: border-color 0.3s ease;
        `;

        this.nameInput.addEventListener('focus', () => {
            this.nameInput.style.borderColor = '#4ecdc4';
        });

        this.nameInput.addEventListener('blur', () => {
            this.nameInput.style.borderColor = 'rgba(255,255,255,0.3)';
        });

        this.nameContainer.appendChild(nameLabel);
        this.nameContainer.appendChild(this.nameInput);

        // Systems list
        this.systemsList = document.createElement('div');
        this.systemsList.style.cssText = `
            margin-top: 1.5rem;
            text-align: left;
            max-height: 200px;
            overflow-y: auto;
            background: rgba(0,0,0,0.2);
            border-radius: 8px;
            padding: 1rem;
        `;

        // Start button (initially hidden)
        this.startButton = document.createElement('button');
        this.startButton.textContent = 'START GAME';
        this.startButton.style.cssText = `
            background: linear-gradient(45deg, #4ecdc4, #44a08d);
            border: none;
            color: white;
            padding: 1rem 2rem;
            font-size: 1.2em;
            font-weight: bold;
            border-radius: 8px;
            cursor: pointer;
            margin-top: 1.5rem;
            display: none;
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 1px;
        `;

        this.startButton.addEventListener('mouseenter', () => {
            this.startButton.style.background = 'linear-gradient(45deg, #44a08d, #4ecdc4)';
            this.startButton.style.transform = 'translateY(-2px)';
            this.startButton.style.boxShadow = '0 5px 15px rgba(78, 205, 196, 0.4)';
        });

        this.startButton.addEventListener('mouseleave', () => {
            this.startButton.style.background = 'linear-gradient(45deg, #4ecdc4, #44a08d)';
            this.startButton.style.transform = 'translateY(0)';
            this.startButton.style.boxShadow = 'none';
        });

        // Assembly
        progressContainer.appendChild(this.progressBar);
        loadingContainer.appendChild(this.progressText);
        loadingContainer.appendChild(progressContainer);
        loadingContainer.appendChild(this.percentageText);
        loadingContainer.appendChild(this.systemsList);
        loadingContainer.appendChild(this.nameContainer);
        loadingContainer.appendChild(this.startButton);
        
        this.element.appendChild(title);
        this.element.appendChild(loadingContainer);

        // Add to document
        document.body.appendChild(this.element);
    }

    setupEventListeners() {
        // Connect to loading manager
        if (window.gameLoadingManager) {
            window.gameLoadingManager.onProgress((status) => {
                this.updateProgress(status);
            });

            window.gameLoadingManager.onComplete(() => {
                this.onLoadingComplete();
            });
        }

        // Start button click
        this.startButton.addEventListener('click', () => {
            // Get player name or generate guest name
            const playerName = this.getPlayerName();
            console.log('🎮 Starting game with player name:', playerName);
            
            // Store player name globally
            window.gamePlayerName = playerName;
            
            this.hide();
            // Allow the game to start
            if (window.gameLoadingComplete) {
                window.gameLoadingComplete();
            }
        });
    }

    show() {
        this.element.style.display = 'flex';
        this.element.style.opacity = '1';
        this.isVisible = true;
        console.log('🎨 Loading screen shown');
    }

    hide() {
        this.element.style.opacity = '0';
        setTimeout(() => {
            this.element.style.display = 'none';
            this.isVisible = false;
            console.log('🎨 Loading screen hidden');
        }, 500);
    }

    updateProgress(status) {
        // Update progress bar
        this.progressBar.style.width = `${status.progress}%`;
        this.percentageText.textContent = `${status.progress}%`;

        // Update progress text
        if (status.progress < 100) {
            this.progressText.textContent = `Loading game systems... (${status.loadedSystems}/${status.totalSystems})`;
        } else {
            this.progressText.textContent = 'All systems loaded!';
        }

        // Update systems list
        this.updateSystemsList(status.systems);
    }

    updateSystemsList(systems) {
        this.systemsList.innerHTML = '';
        
        systems.forEach(system => {
            const systemItem = document.createElement('div');
            systemItem.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0.3rem 0;
                border-bottom: 1px solid rgba(255,255,255,0.1);
                font-size: 0.9em;
            `;

            const nameSpan = document.createElement('span');
            nameSpan.textContent = system.description || system.name;
            nameSpan.style.cssText = `
                flex: 1;
                text-align: left;
            `;

            const statusSpan = document.createElement('span');
            if (system.error) {
                statusSpan.textContent = '❌ Error';
                statusSpan.style.color = '#ff6b6b';
            } else if (system.loaded) {
                statusSpan.textContent = '✅ Ready';
                statusSpan.style.color = '#4ecdc4';
            } else {
                statusSpan.textContent = `${system.progress}%`;
                statusSpan.style.color = '#f9ca24';
            }

            systemItem.appendChild(nameSpan);
            systemItem.appendChild(statusSpan);
            this.systemsList.appendChild(systemItem);
        });
    }

    onLoadingComplete() {
        // Show name input and start button
        this.nameContainer.style.display = 'block';
        this.startButton.style.display = 'block';
        
        // Focus on name input
        setTimeout(() => {
            this.nameInput.focus();
        }, 100);
        
        // Add pulsing effect to start button
        this.startButton.style.animation = 'pulse 2s infinite';
        
        // Add pulse animation if not already present
        if (!document.getElementById('pulse-animation')) {
            const style = document.createElement('style');
            style.id = 'pulse-animation';
            style.textContent = `
                @keyframes pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                    100% { transform: scale(1); }
                }
            `;
            document.head.appendChild(style);
        }

        this.progressText.textContent = 'Ready to start!';
        console.log('🎉 Loading complete - name input and start button shown');
    }

    // Generate or get player name
    getPlayerName() {
        const inputName = this.nameInput.value.trim();
        
        if (inputName && inputName.length > 0) {
            // Use player's input name (sanitized)
            return inputName.substring(0, 20).replace(/[<>]/g, ''); // Remove potential HTML
        } else {
            // Generate guest name with random number
            const guestNumber = Math.floor(Math.random() * 9999) + 1;
            return `Guest ${guestNumber}`;
        }
    }

    // Manual control methods
    setProgress(progress) {
        this.progressBar.style.width = `${progress}%`;
        this.percentageText.textContent = `${progress}%`;
    }

    setText(text) {
        this.progressText.textContent = text;
    }
}

// Global loading screen instance
window.gameLoadingScreen = new LoadingScreen();

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LoadingScreen };
}
