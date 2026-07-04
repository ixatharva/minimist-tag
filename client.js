const IS_PRODUCTION = window.location.hostname !== "localhost";
const SERVER_URL = IS_PRODUCTION
    ? "wss://linoleum-overbook-backtrack.ngrok-free.dev"
    : "ws://localhost:3000";

const socket = new WebSocket(SERVER_URL);

// client/client.js
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let myId = null;
let serverPlayersState = {};
let localPlayer = { x: 0, y: 0 }; // Predicted state copy

let inputSequenceNumber = 0;
let pendingInputs = []; // Cache buffer for client-side reconciliation

const keys = { up: false, down: false, left: false, right: false };

// Input Capture
window.addEventListener('keydown', (e) => handleKey(e, true));
window.addEventListener('keyup', (e) => handleKey(e, false));

function handleKey(e, isDown) {
    if (['w', 'arrowup'].includes(e.key.toLowerCase())) keys.up = isDown;
    if (['s', 'arrowdown'].includes(e.key.toLowerCase())) keys.down = isDown;
    if (['a', 'arrowleft'].includes(e.key.toLowerCase())) keys.left = isDown;
    if (['d', 'arrowright'].includes(e.key.toLowerCase())) keys.right = isDown;
}

socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'init') {
        myId = data.id;
    }

    if (data.type === 'state') {
        serverPlayersState = data.players;
        if (!myId || !serverPlayersState[myId]) return;

        // --- SERVER RECONCILIATION ENGINE ---
        const serverState = serverPlayersState[myId];
        localPlayer.x = serverState.x;
        localPlayer.y = serverState.y;

        // Clear historical inputs that the server already ran
        pendingInputs = pendingInputs.filter(input => input.sequenceNumber > serverState.lastProcessedInput);

        // Replay all unacknowledged updates back on top of server state to stay smoothly in sync
        pendingInputs.forEach(item => {
            updatePlayerPosition(localPlayer, item.input, 1 / 30); // Using fixed physics step
        });
    }
};

// Client Game Ticking Engine (~60fps)
let lastTime = performance.now();
function gameLoop(currentTime) {
    requestAnimationFrame(gameLoop);

    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    if (!myId || !serverPlayersState[myId]) return;

    // 1. Client-Side Prediction: instantly update position locally based on inputs
    const currentInput = { ...keys };
    updatePlayerPosition(localPlayer, currentInput, deltaTime);

    // 2. Buffer & Send input to the server
    inputSequenceNumber++;
    pendingInputs.push({ sequenceNumber: inputSequenceNumber, input: currentInput });

    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'input',
            sequenceNumber: inputSequenceNumber,
            input: currentInput
        }));
    }

    // 3. Render Canvas frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Get the current boss ID if any player is designated as the boss
    const currentBossId = Object.keys(serverPlayersState).find(id => serverPlayersState[id].isBoss);

    // Draw players using the Boss tagging logic
    Object.keys(serverPlayersState).forEach(id => {
        let x, y;

        if (id === myId) {
            // Your local block stays crisp and instant using local prediction
            x = localPlayer.x;
            y = localPlayer.y;
        } else {
            // 🌟 SMOOTH MOVEMENT (LERP) FOR ENEMY PLAYERS
            // If we don't have a record of their position yet, initialize it
            if (!serverPlayersState[id].currentVisualX) {
                serverPlayersState[id].currentVisualX = serverPlayersState[id].x;
                serverPlayersState[id].currentVisualY = serverPlayersState[id].y;
            }

            // Linearly interpolate 15% of the distance toward the true server position every frame
            const lerpFactor = 0.15;
            serverPlayersState[id].currentVisualX += (serverPlayersState[id].x - serverPlayersState[id].currentVisualX) * lerpFactor;
            serverPlayersState[id].currentVisualY += (serverPlayersState[id].y - serverPlayersState[id].currentVisualY) * lerpFactor;

            x = serverPlayersState[id].currentVisualX;
            y = serverPlayersState[id].currentVisualY;
        }

        // 🔴 The Boss gets an aggressive Red crimson block style, others stay Blue
        if (id === currentBossId) {
            ctx.fillStyle = '#ff2a2a';
        } else {
            ctx.fillStyle = '#3a86ff';
        }
        ctx.fillRect(x, y, 30, 30);

        // Keep your green selection border around your local controlled square
        if (id === myId) {
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 3;
            ctx.strokeRect(x - 2, y - 2, 34, 34);

            // Add a text indicator above your own head
            ctx.fillStyle = '#ffffff';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(id === currentBossId ? "YOU ARE BOSS!" : "RUN!", x + 15, y - 10);
        }
    });
}
requestAnimationFrame(gameLoop);

// --- MOBILE TOUCH CONTROLS ---
const touchButtons = [
    { id: 'btnUp', key: 'up' },
    { id: 'btnDown', key: 'down' },
    { id: 'btnLeft', key: 'left' },
    { id: 'btnRight', key: 'right' }
];

touchButtons.forEach(button => {
    const el = document.getElementById(button.id);
    if (!el) return;

    // When finger presses down
    el.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Prevents simulated mouse clicks and zoom
        keys[button.key] = true;
    }, { passive: false });

    // When finger leaves the button
    el.addEventListener('touchend', (e) => {
        e.preventDefault();
        keys[button.key] = false;
    }, { passive: false });

    // In case finger slips outside button boundary while holding
    el.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        keys[button.key] = false;
    }, { passive: false });
});
