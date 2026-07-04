# minimist-tag
# Minimalist Network Tag Sandbox

A real-time, synchronized multiplayer tag game built from scratch using pure native WebSockets. This sandbox demonstrates advanced network programming concepts including **Client-Side Prediction**, **Server Reconciliation**, and **Linear Interpolation (Lerp)** to achieve smooth, lag-compensated gameplay across remote networks.

---

## 🎮 Game Features

- **The "Boss" Tag Mechanic:** One player is dynamically crowned the **Boss** (rendered in aggressive crimson red). The Boss must hunt down other players (rendered in blue) to pass off the title upon collision.
- **Lag Compensation Engine:** Includes client-side prediction so your local movements feel instant, alongside server reconciliation to correct positional discrepancies.
- **Smooth Interpolation:** Utilizes linear interpolation (Lerp) to smoothly glide opponent players across the screen, completely eliminating network jitter and micro-stuttering.
- **Responsive Canvas Design:** Built inside an HTML5 Canvas that scales dynamically across desktop resolutions and mobile viewports.
- **Cross-Platform Controls:** Full support for desktop keyboard layout (WASD/Arrows) and an on-screen touch D-Pad for mobile devices.

---

## 🛠️ Tech Stack & Architecture

- **Frontend:** HTML5 Canvas, Vanilla JavaScript (ES6+), CSS3
- **Backend:** Node.js (Runtime)
- **Networking Library:** Native `ws` (WebSockets) for ultra-low latency, full-duplex communication
- **Physics Engine:** Custom AABB (Axis-Aligned Bounding Box) collision framework shared between client and server

### Project Structure
```text
├── client.js       # Client engine (Game loop, prediction, lerp, and rendering)
├── index.html      # Game UI, canvas wrapper, and virtual mobile D-Pad layout
├── package.json    # Project dependencies and startup script configurations
├── physics.js      # Shared deterministic physics loop (movement and bounds check)
└── server/
    └── server.js   # Native WebSocket state server (handles ticks and tag logic)