// client/client.js
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const socket = new WebSocket('ws://localhost:3000');

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

    // Draw players
    Object.keys(serverPlayersState).forEach(id => {
        let x, y, isIt;

        if (id === myId) {
            // Render our predicted/reconciled smooth location
            x = localPlayer.x;
            y = localPlayer.y;
            isIt = serverPlayersState[id].isIt;

            // Draw a subtle helper indicator around you
            ctx.strokeStyle = '#00ff00';
            ctx.strokeRect(x - 4, y - 4, 38, 38);
        } else {
            // Render enemy players directly using latest server update
            x = serverPlayersState[id].x;
            y = serverPlayersState[id].y;
            isIt = serverPlayersState[id].isIt;
        }

        // Color coding rule for roles
        ctx.fillStyle = isIt ? '#ff4444' : '#4488ff';
        ctx.fillRect(x, y, 30, 30);
    });
}
requestAnimationFrame(gameLoop);
// ... Existing keyboard code ...
window.addEventListener('keydown', (e) => handleKey(e, true));
window.addEventListener('keyup', (e) => handleKey(e, false));

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
// ... Rest of your existing client loop and WebSocket code ...