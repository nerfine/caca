const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Rate limiting tracking (simple in-memory)
const requestCounts = new Map();
const RATE_LIMIT = 100; // requests per minute
const RATE_WINDOW = 60000; // 1 minute

function checkRateLimit(ip) {
    const now = Date.now();
    const userRequests = requestCounts.get(ip) || [];
    
    // Remove old requests outside the window
    const recentRequests = userRequests.filter(time => now - time < RATE_WINDOW);
    
    if (recentRequests.length >= RATE_LIMIT) {
        return false;
    }
    
    recentRequests.push(now);
    requestCounts.set(ip, recentRequests);
    return true;
}

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        message: 'Roblox Gamepass Proxy API',
        endpoints: {
            gamepassDetails: '/api/gamepasses/:id/details',
            userInventory: '/api/users/:userId/inventory/gamepasses',
            creatorGamepasses: '/api/users/:userId/gamepasses'
        }
    });
});

// Gamepass details endpoint (uses official Roblox API)
app.get('/api/gamepasses/:id/details', async (req, res) => {
    const ip = req.ip;
    
    if (!checkRateLimit(ip)) {
        return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    
    const gamepassId = req.params.id;
    
    try {
        const response = await axios.get(
            `https://apis.roblox.com/game-passes/v1/game-passes/${gamepassId}/details`,
            {
                headers: {
                    'User-Agent': 'RobloxGamepassProxy/1.0'
                }
            }
        );
        
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching gamepass details:', error.message);
        res.status(error.response?.status || 500).json({
            error: 'Failed to fetch gamepass details',
            message: error.message
        });
    }
});

// User inventory endpoint (gamepasses only)
app.get('/api/users/:userId/inventory/gamepasses', async (req, res) => {
    const ip = req.ip;
    
    if (!checkRateLimit(ip)) {
        return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    
    const userId = req.params.userId;
    const page = req.query.page || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    
    try {
        const response = await axios.get(
            `https://inventory.roblox.com/v1/users/${userId}/assets/collectibles`,
            {
                params: {
                    assetType: 'GamePass',
                    limit: limit,
                    cursor: req.query.cursor || ''
                },
                headers: {
                    'User-Agent': 'RobloxGamepassProxy/1.0'
                }
            }
        );
        
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching user inventory:', error.message);
        res.status(error.response?.status || 500).json({
            error: 'Failed to fetch user inventory',
            message: error.message
        });
    }
});

// Get gamepasses created by a user
app.get('/api/users/:userId/gamepasses', async (req, res) => {
    const ip = req.ip;
    
    if (!checkRateLimit(ip)) {
        return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    
    const userId = req.params.userId;
    const cursor = req.query.cursor || '';
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    
    try {
        const response = await axios.get(
            `https://apis.roblox.com/toolbox-service/v1/creations/get-user-creations`,
            {
                params: {
                    userId: userId,
                    assetType: 34, // GamePass
                    limit: limit,
                    cursor: cursor,
                    isArchived: false
                },
                headers: {
                    'User-Agent': 'RobloxGamepassProxy/1.0'
                }
            }
        );
        
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching creator gamepasses:', error.message);
        res.status(error.response?.status || 500).json({
            error: 'Failed to fetch creator gamepasses',
            message: error.message
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Internal server error',
        message: err.message
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Roblox Gamepass Proxy running on port ${PORT}`);
});