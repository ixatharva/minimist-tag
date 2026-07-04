// server/server.js
const { WebSocketServer } = require('ws');
const { updatePlayerPosition, checkCollision } = require('../physics.js');

const wss = new WebSocketServer({ port: 3000 });

let players = {}; // Stores { id: { x, y, isIt, lastProcessedInput } }
let inputQueues = {}; // Stores incoming inputs un-processed per player: { id: [] }
let playerIds = [];

const TICK_RATE = 30;
const TICK_TIME = 1000 / TICK_RATE; // ~33.33ms

console.log(`Server running on ws://localhost:3000 at ${TICK_RATE}Hz`);

wss.on('connection', (ws) => {
    const id = Math.random().toString(36).substring(2, 9);
    playerIds.push(id);

    // Default spawning configurations
    players[id] = {
        x: Math.random() * 700,
        y: Math.random() * 500,
        isIt: playerIds.length === 1, // First player to join is automatically "It"
        lastProcessedInput: 0
    };
    inputQueues[id] = [];

    // Send the joining player their assigned ID
    ws.send(JSON.stringify({ type: 'init', id: id }));

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        if (data.type === 'input') {
            inputQueues[id].push(data);
        }
    });

    ws.on('close', () => {
        const wasIt = players[id]?.isIt;
        delete players[id];
        delete inputQueues[id];
        playerIds = playerIds.filter(pId => pId !== id);

        // Pass the "It" torch to someone else if the tagged player rage quits
        if (wasIt && playerIds.length > 0) {
            players[playerIds[0]].isIt = true;
        }
    });
});

// Authoritative Fixed-Timestep Physics Loop
let lastTime = Date.now();
setInterval(() => {
    const now = Date.now();
    const deltaTime = (now - lastTime) / 1000;
    lastTime = now;

    // 1. Process all inputs sequentially
    playerIds.forEach(id => {
        const queue = inputQueues[id];
        const player = players[id];

        while (queue.length > 0) {
            const inputData = queue.shift();
            // Process move based on fixed time slice
            updatePlayerPosition(player, inputData.input, 1 / TICK_RATE);
            player.lastProcessedInput = inputData.sequenceNumber;
        }
    });

    // 2. Evaluate Tag Rules
    if (playerIds.length >= 2) {
        let p1 = players[playerIds[0]];
        let p2 = players[playerIds[1]];

        if (checkCollision(p1, p2)) {
            // Swap roles on collision
            if (p1.isIt && !p2.wasJustTagged) {
                p1.isIt = false; p2.isIt = true;
                p2.wasJustTagged = true; // Prevents instant back-tagging frame locking
            } else if (p2.isIt && !p1.wasJustTagged) {
                p2.isIt = false; p1.isIt = true;
                p1.wasJustTagged = true;
            }
        } else {
            if (p1) p1.wasJustTagged = false;
            if (p2) p2.wasJustTagged = false;
        }
    }

    // 3. Broadcast clean snapshots out to everyone
    const statePayload = JSON.stringify({
        type: 'state',
        players: players
    });

    wss.clients.forEach(client => {
        if (client.readyState === 1) client.send(statePayload);
    });
}, TICK_TIME);