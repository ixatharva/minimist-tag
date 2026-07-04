// server/server.js
const { WebSocketServer, WebSocket } = require('ws');
const { updatePlayerPosition, checkCollision } = require('../physics.js');

const PORT = process.env.PORT || 3000;
const wss = new WebSocketServer({ port: PORT });

let players = {};
let bossId = null;
let clientIdCounter = 0;

console.log(`Native WebSocket Server running on port ${PORT}`);

// Helper function to broadcast data to all connected players
function broadcast(data) {
    const message = JSON.stringify(data);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

wss.on('connection', (ws) => {
    // Generate a unique sequential ID for the client
    clientIdCounter++;
    const myId = `player_${clientIdCounter}`;
    ws.id = myId;

    console.log(`Player connected: ${myId}`);

    // If this is the first player to join, make them the Boss!
    if (Object.keys(players).length === 0) {
        bossId = myId;
    }

    // Initialize player state matching client architecture expectations
    players[myId] = {
        x: Math.random() * 700 + 50,
        y: Math.random() * 500 + 50,
        isBoss: (myId === bossId),
        lastProcessedInput: 0
    };

    // Send initialization data back to the connected client
    ws.send(JSON.stringify({
        type: 'init',
        id: myId
    }));

    // Broadcast the updated state to everyone
    broadcast({
        type: 'state',
        players: players
    });

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'input') {
                if (!players[myId]) return;

                const input = data.input;
                const sequenceNumber = data.sequenceNumber;

                // Move player using fixed client reconciliation physics step (1/30s)
                updatePlayerPosition(players[myId], input, 1 / 30);
                players[myId].lastProcessedInput = sequenceNumber;

                // 👑 COLLISION & BOSS MECHANIC CHECK
                if (myId === bossId) {
                    for (let otherId in players) {
                        if (otherId !== bossId) {
                            if (checkCollision(players[bossId], players[otherId])) {
                                // Tag successful! Swap roles
                                bossId = otherId;

                                // Update flags across all instances
                                for (let id in players) {
                                    players[id].isBoss = (id === bossId);
                                }
                                break;
                            }
                        }
                    }
                }

                // Broadcast updated position data frame back out to everyone
                broadcast({
                    type: 'state',
                    players: players
                });
            }
        } catch (err) {
            console.error("Error processing packet:", err);
        }
    });

    ws.on('close', () => {
        console.log(`Player disconnected: ${myId}`);
        delete players[myId];

        // If the Boss leaves, assign a new Boss randomly to remaining players
        if (bossId === myId) {
            const remainingIds = Object.keys(players);
            bossId = remainingIds.length > 0 ? remainingIds[0] : null;
            if (bossId) players[bossId].isBoss = true;
        }

        broadcast({
            type: 'state',
            players: players
        });
    });
});