<div align="center">

# 🌀 reFlow

**A real-time 3D aerodynamics wind tunnel that runs entirely in your browser — no install, no GPU farm, just a wing and some math.**

[![License](https://img.shields.io/github/license/extension1/reflow?style=flat-square)](LICENSE)
[![Last Commit](https://img.shields.io/github/last-commit/extension1/reflow?style=flat-square)](https://github.com/YOUR_USERNAME/reflow/commits/main)
[![Stars](https://img.shields.io/github/stars/extension1/reflow?style=flat-square)](https://github.com/YOUR_USERNAME/reflow/stargazers)
[![Stardance](https://img.shields.io/badge/built%20for-Stardance%202026-fa1e4e?style=flat-square)](https://stardance.hackclub.com)

<!-- 📸 drop a demo GIF/screenshot here — this single change does more for the README than anything else -->
<!-- ![reFlow demo](docs/demo.gif) -->

</div>

---

## What is this?

reFlow is a particle-based aerodynamics simulator built with React, Three.js, and Tailwind. Drop a shape into the tunnel, tune wind speed, viscosity, and angle of attack, and watch up to 40,000 particles flow, deflect, and stall around it in real time. It's not real Navier-Stokes — your laptop would catch fire — but the flow visualization, pressure heatmaps, and stall physics are close enough to feel legit.

Built for the Stardance Hackathon, because boring black-and-white telemetry charts don't spark joy.

## ✨ Features

**🌀 3D Particle Swarm Physics**
- Up to 40,000 particles flowing through the tunnel in real time
- Real collision deflection — particles physically bounce and slide off spheres, airfoils, cars, cubes, and toruses instead of clipping through
- Live-adjustable flow speed, viscosity, and angle of attack — lower viscosity means a higher Reynolds number, which means chaotic turbulent eddies in the wake

**💻 Real Hardware Telemetry**
- Detects your actual GPU model via WebGL debug renderer info
- Reads logical core count, live JS heap usage, and battery/charging state
- Tracks network latency

**🛑 Safety Guard & Auto-Optimizer**
- Flags specific bottlenecks — low core count, low battery, integrated GPU, frame jitter — instead of a generic "it's lagging" warning
- One-click **Auto-Optimize** button drops particle count, switches to 2D slice mode, and retunes the solver to hold a steady 60 FPS

**🎯 Interactive Flow Probes**
- Double-click anywhere in the tunnel to drop a glowing probe that traces a dedicated stream of particles through that exact point — perfect for tracking specific wake lines

**🎨 Cyberpunk Telemetry Deck**
- Glowing oscilloscope-style lift/drag graph
- Toggleable CRT scanline filter
- Camera presets: isometric, 2D side profile, top-down, front stagnation
- Wireframe flow-straightener at the inlet, plus ambient dust particles for scale

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

## 🚀 Running It

**Easiest way:** run `node bundle.cjs` after making sure you're in the root folder where you saved everything. It'll save to a single file (reFlow.html) that you can run.

**To develop locally:**
```bash
cd "file_location"
npm install
npm run dev
```

**To rebuild the single-file version after making changes:**
```bash
npm run build:single
```

## 🛠️ Tech Stack

| Layer | Tech |
|---|---|
| Framework | React 19 |
| 3D Engine | Three.js |
| Styling | Tailwind CSS v4 |
| Build | Vite + a custom bundler script that inlines everything into `reFlow.html` |
| Icons | Lucide React |
| AI | Google Gen AI SDK (`gemini-2.5-flash`) for live aero reports, with a local rule-based fallback |

## 🚀 Built For

[Stardance](https://stardance.hackclub.com) — Hack Club × NASA × AMD's summer program for teen builders.

---

<div align="center">
<sub>made with blood, sweat, and the tears of a 15y/o science nerd ✨</sub>
</div>
