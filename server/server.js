// server/server.js

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*" }
});

// 1. PLACE THE NEW IMPORT HERE (Replaces your old physics import)
const { updatePlayerPosition, checkCollision } = require('../physics.js');

// 2. PLACE THE STATE VARIABLES HERE (Replaces your old let players = {})
let players = {};
let bossId = null;

// Serve static files from the root directory
app.use(express.static(__dirname + '/../'));

// 3. PLACE THE ENTIRE CONNECTION BLOCK HERE (Replaces your old connection block completely)
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // If this is the first player to join, make them the Boss!
    if (Object.keys(players).length === 0) {
        bossId = socket.id;
    }

    // Initialize player state
    players[socket.id] = {
        x: Math.random() * 700 + 50,
        y: Math.random() * 500 + 50,
        isBoss: (socket.id === bossId)
    };

    // Broadcast updated state to everyone
    io.emit('stateUpdate', { players, bossId });

    socket.on('move', (movementData) => {
        if (!players[socket.id]) return;

        // Update position variables using our physics file
        players[socket.id].vx = movementData.vx;
        players[socket.id].vy = movementData.vy;
        updatePlayerPosition(players[socket.id]);

        // 👑 COLLISION & BOSS MECHANIC CHECK
        if (socket.id === bossId) {
            for (let otherId in players) {
                if (otherId !== bossId) {
                    if (checkCollision(players[bossId], players[otherId])) {
                        // Tag successful! Swap roles
                        bossId = otherId;

                        // Update flags
                        for (let id in players) {
                            players[id].isBoss = (id === bossId);
                        }

                        // Broadcast the new Boss notification instantly
                        io.emit('bossTagged', { newBossId: bossId });
                        break;
                    }
                }
            }
        }

        // Send current positions out to all clients
        io.emit('stateUpdate', { players, bossId });
    });

    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        delete players[socket.id];

        // If the Boss leaves, assign a new Boss randomly
        if (bossId === socket.id) {
            const remainingIds = Object.keys(players);
            bossId = remainingIds.length > 0 ? remainingIds[0] : null;
            if (bossId) players[bossId].isBoss = true;
        }

        io.emit('stateUpdate', { players, bossId });
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});