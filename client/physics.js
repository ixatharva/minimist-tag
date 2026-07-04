// shared/physics.js

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PLAYER_SIZE = 30;
const MOVE_SPEED = 300; // Pixels per second

function updatePlayerPosition(player, input, deltaTime) {
    let moveX = 0;
    let moveY = 0;

    if (input.up) moveY -= 1;
    if (input.down) moveY += 1;
    if (input.left) moveX -= 1;
    if (input.right) moveX += 1;

    // Normalize diagonal movement vector so diagonals aren't faster
    if (moveX !== 0 && moveY !== 0) {
        moveX *= 0.7071;
        moveY *= 0.7071;
    }

    // Apply movement
    player.x += moveX * MOVE_SPEED * deltaTime;
    player.y += moveY * MOVE_SPEED * deltaTime;

    // Boundary Collisions (Keep players inside the canvas)
    if (player.x < 0) player.x = 0;
    if (player.x > CANVAS_WIDTH - PLAYER_SIZE) player.x = CANVAS_WIDTH - PLAYER_SIZE;
    if (player.y < 0) player.y = 0;
    if (player.y > CANVAS_HEIGHT - PLAYER_SIZE) player.y = CANVAS_HEIGHT - PLAYER_SIZE;
}

// Check if two players are overlapping (for Tag logic)
function checkCollision(p1, p2) {
    return (
        p1.x < p2.x + PLAYER_SIZE &&
        p1.x + PLAYER_SIZE > p2.x &&
        p1.y < p2.y + PLAYER_SIZE &&
        p1.y + PLAYER_SIZE > p2.y
    );
}

// Export for Node.js if running in backend, otherwise expose globally to the browser
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    // If running in Node.js (Server)
    module.exports = { updatePlayerPosition, checkCollision };
} else {
    // If running in the Browser (Client)
    window.updatePlayerPosition = updatePlayerPosition;
    window.checkCollision = checkCollision;
}
