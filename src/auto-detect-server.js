// auto-detect-server.js
// Add this script to your index.html BEFORE server-config.js
// It automatically detects server URL from query parameters

(function() {
    // Check URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const serverParam = urlParams.get('server');
    
    // Check if we have a server parameter
    if (serverParam) {
        console.log('Server URL detected from URL parameter:', serverParam);
        
        // Determine if it's ngrok
        const isNgrok = serverParam.includes('ngrok');
        
        // Set the configuration
        window.MULTIPLAYER_CONFIG = {
            SERVER_URL: serverParam,
            USE_NGROK: isNgrok,
            ROOM_PASSWORD: '',
            DEBUG: true
        };
        
        // Save to localStorage for persistence
        localStorage.setItem('oiia_server_config', JSON.stringify({
            SERVER_URL: serverParam,
            USE_NGROK: isNgrok
        }));
        
        // Remove the parameter from URL to clean it up
        const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        
        console.log('Configuration applied:', window.MULTIPLAYER_CONFIG);
    } else {
        // Try to load from localStorage
        const savedConfig = localStorage.getItem('oiia_server_config');
        if (savedConfig) {
            try {
                const config = JSON.parse(savedConfig);
                window.MULTIPLAYER_CONFIG = {
                    SERVER_URL: config.SERVER_URL || 'http://localhost:3000',
                    USE_NGROK: config.USE_NGROK || false,
                    ROOM_PASSWORD: '',
                    DEBUG: true
                };
                console.log('Configuration loaded from localStorage:', window.MULTIPLAYER_CONFIG);
            } catch (e) {
                console.error('Failed to parse saved config:', e);
                // Fall back to default
                window.MULTIPLAYER_CONFIG = {
                    SERVER_URL: 'http://localhost:3000',
                    USE_NGROK: false,
                    ROOM_PASSWORD: '',
                    DEBUG: true
                };
            }
        } else {
            // Use default configuration
            window.MULTIPLAYER_CONFIG = {
                SERVER_URL: 'http://localhost:3000',
                USE_NGROK: false,
                ROOM_PASSWORD: '',
                DEBUG: true
            };
        }
    }
})();