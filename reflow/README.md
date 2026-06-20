<div align="center">

# 🌀 reFlow

**A real-time 3D aerodynamics wind tunnel that runs entirely in your browser — no install, no GPU farm, just a wing and some math.**

[![License](https://img.shields.io/github/license/extension1/reflow?style=flat-square)](LICENSE)
[![Last Commit](https://img.shields.io/github/last-commit/extension1/reflow?style=flat-square)](https://github.com/extension1/reflow/commits/main)
[![Stars](https://img.shields.io/github/stars/extension1/reflow?style=flat-square)](https://github.com/extension1/reflow/stargazers)
[![Stardance](https://img.shields.io/badge/built%20for-Stardance%202026-fa1e4e?style=flat-square)](https://stardance.hackclub.com)

<img width="1360" height="607" alt="image" src="https://github.com/user-attachments/assets/5b911c89-8ae9-49ad-8072-e718d416151c" />

</div>

---

## What is this?

reFlow is a particle-based aerodynamics simulator built with React, Three.js, and Tailwind. Drop a shape into the tunnel — or upload your own 3D model — tune wind speed, viscosity, and angle of attack, and watch up to 40,000 particles flow, deflect, and stall around it in real time. It's not real Navier-Stokes — your laptop would catch fire — but the flow visualization, pressure heatmaps, and stall physics are close enough to feel legit.

The simulation physics run on a dedicated Web Worker thread, so your UI stays smooth even at maximum particle counts. No freezing, no stuttering, just fluid dynamics.

Built for the Stardance Hackathon, because boring black-and-white telemetry charts don't spark joy.

## ✨ Features

**🌀 3D Particle Swarm Physics**
- Up to 40,000 particles flowing through the tunnel in real time
- Real collision deflection — particles physically bounce and slide off spheres, airfoils, cars, cubes, and toruses instead of clipping through
- Live-adjustable flow speed, viscosity, and angle of attack — lower viscosity means a higher Reynolds number, which means chaotic turbulent eddies in the wake
- Hash-based pseudo-random turbulence with von Kármán vortex shedding for bluff bodies
- No-slip boundary layer simulation near surfaces

**⚡ Off-Thread Physics Engine**
- Simulation math runs on a dedicated Web Worker — UI never freezes, even at 40k particles
- Zero-copy data transfer using Transferable ArrayBuffers between threads
- Standalone pure-math physics module with no Three.js dependency
- Graceful main-thread fallback if workers aren't supported

**📦 Custom 3D Model Loader**
- Upload any `.glb` or `.gltf` file and simulate airflow around it
- Models are auto-scaled and centered in the tunnel
- Mesh is voxelized into a 3D occupancy grid for real-time collision detection
- Ray-parity method: casts rays through a 48³ grid to determine inside/outside

**💻 Real Hardware Telemetry**
- Detects your actual GPU model via WebGL debug renderer info
- Reads logical core count, live JS heap usage, and battery/charging state
- Measures per-frame physics computation time to estimate CPU burden
- Tracks network latency

**🛑 Safety Guard & Auto-Optimizer**
- Flags specific bottlenecks — low core count, low battery, integrated GPU, frame jitter — instead of a generic "it's lagging" warning
- One-click **Auto-Optimize** button drops particle count, switches to 2D slice mode, and retunes the solver to hold a steady 60 FPS

**🎯 Interactive Flow Probes**
- Double-click anywhere in the tunnel to drop a glowing probe that traces a dedicated stream of particles through that exact point — perfect for tracking specific wake lines

**🎛️ Customizable Torus**
- Adjustable major radius (R) and minor radius (r) with live sliders
- Changes rebuild the geometry AND update the physics math in real time
- R/r ratio readout for flow separation analysis

**🎨 Cyberpunk Telemetry Deck**
- Glowing oscilloscope-style lift/drag graph
- Toggleable CRT scanline filter
- Camera presets: isometric, 2D side profile, top-down, front stagnation
- Wireframe flow-straightener at the inlet, plus ambient dust particles for scale
- Collapsible left sidebar and bottom panel — maximize the 3D view when you need it

**🤖 Gemini CFD Co-Pilot**
- Add your own Gemini API key to get a live, technical aerodynamic report on the current simulation state
- No key? No problem — falls back to a rule-based local expert system that still generates a full report offline

## 🕹️ Presets

| Preset | What it shows |
|---|---|
| Laminar Airfoil Study | Clean attached streamlines around a 2D wing profile |
| Critical Wing Stall | Tilt past 15° and watch the boundary layer detach into a high-drag wake, complete with a flashing stall warning |
| Sports Car Downforce | Airflow over and under a car chassis generating ground-suction downforce |
| Bluff Body Wake (Cube) | High-Reynolds flow slamming into a flat face, producing heavy turbulence |
| Torus Plasma Matrix | Flow shearing through a hollow toroidal ring |
| Torus Thin Ring | High R/r ratio ring for dramatic vortex shedding patterns |
| Eco / Low-Spec Mode | Streamlines on a 2D slice, tuned for integrated GPUs and battery power |

## 🚀 Running It

```bash
git clone https://github.com/extension1/reflow.git
cd reflow
npm install
npm run dev
```

Then open `http://localhost:3000` (or whatever port Vite prints in the terminal).

> Heads up: the old single-file `node bundle.cjs` way is currently broken — the Web Worker setup doesn't play nice with the inliner script. Running it through the Vite dev server is the reliable way to go for now. I'll fix it laterrrr

## 🏗️ Architecture

```
src/
├── App.tsx              # UI layer — controls, panels, telemetry
├── physics.ts           # Pure-math physics engine (no Three.js)
├── cfdWorker.ts         # Web Worker — runs particle sim off-thread
├── voxelizer.ts         # Mesh → voxel grid converter for GLB models
├── components/
│   └── WindTunnel.tsx   # Three.js scene, rendering, worker integration
├── index.css            # Tailwind + CRT overlay styles
└── main.tsx             # React entry point
```

The physics module (`physics.ts`) contains zero Three.js imports — it's pure math that runs identically in both the main thread and the Web Worker. This lets us offload the expensive per-particle simulation loop without duplicating rendering code.

## 🛠️ Tech Stack

| Layer | Tech |
|---|---|
| Framework | React 19 |
| 3D Engine | Three.js (OrbitControls, GLTFLoader) |
| Styling | Tailwind CSS v4 |
| Physics | Custom potential-flow solver + hash-noise turbulence + voxel collision |
| Threading | Web Workers via Vite's native worker support |
| Build | Vite |
| Icons | Lucide React |
| AI | Google Gen AI SDK (`gemini-2.5-flash`) for live aero reports, with a local rule-based fallback |

## 🚀 Built For

[Stardance](https://stardance.hackclub.com) — Hack Club × NASA × AMD's summer program for teen builders.

---

<div align="center">
<sub>made with the blood, sweat, and tears of a 14y/o science nerd ✨</sub>
</div>
