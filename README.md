<div align="center">

# reFlow

**OpenFOAM? Nah. SimScale? Also nah. A in-browser working cfd resolver? Heck yeah.**

[![License](https://img.shields.io/github/license/extension1/reflow?style=flat-square)](LICENSE)
[![Last Commit](https://img.shields.io/github/last-commit/extension1/reflow?style=flat-square)](https://github.com/extension1/reflow/commits/main)
[![Stars](https://img.shields.io/github/stars/extension1/reflow?style=flat-square)](https://github.com/extension1/reflow/stargazers)
[![Stardance](https://img.shields.io/badge/built%20for-Stardance%202026-fa1e4e?style=flat-square)](https://stardance.hackclub.com)

<img width="1360" height="607" alt="image" src="https://github.com/user-attachments/assets/5b911c89-8ae9-49ad-8072-e718d416151c" />

</div>

---

## P.S: `reflow 2.5.5` is an older version. If you want only the new one, you can safely ignore that folder.


## What is this?

reFlow is a particle-based aerodynamics simulator built with React, Three.js, and Tailwind. Throw some random shape (be it 2d or 3d, we don't discriminate) into the UI and watch some cool stuff happen in real time. Preferably without your device exploding, so if your device is bad, ***DO NOT*** increase the particle counts too much.

Also hooray Web Workers cuz that basically saved this html from blowing up in size. Most of the actual physics runs there, so check it out if you're curious.

## ✨ Features

# Particle Swarm Physics
- Upto *40,000* particles in the tunnel flowing in real time
- Collision actually works! Physics might not be as accurate as real simulators (this is a html bruh) but collision is collision.
- You can adjust flow speed, viscosity, and AoA (angle of attack) while it's doing it's thing (though it might stutter a little)

# Off-Thread Physics Engine
- Math runs completely seperately in a dedicated Web Worker so your PC doesn't freaking explode (There is a fallback if the WebWorkers don't work for some reason)
- Data transfer using Transferable ArrayBuffers between threads
- Also a standalone physics-only model with NO THREE.JS dependencies!

# 3D MODELS!!!
- Upload any `.glb` or `.gltf` file and simulate airflow around it (no, like actual 3d models. Yes i'm not joking.)
- Said models are voxelized and then areas are determined whether they're inside or outside through a fancy method called Ray-parity that casts a 48³ grid to find out that.

# PC Interrogation
- Finds your actual GPU model via WebGL debug renderer info (i'm pretty sure this will work for most (if not all) standard GPUs tho older ones or non-standard ones won't be detected. A RTX 1080 detects just fine, as does a 5090 and everything in between.)
- Reads core count, charging state, and estimates CPU load using some fancy rendering buffer math

# Bad PC? We gotchu fam.
- Finds (and flags) specific bottlenecks — low core count, low battery, integrated GPU, all those things.
- Also exists: an **Auto-Optimize** button that dramatically reduces particle count, switches to 2D mode, and retunes the solver to hold a steady 60 FPS (I did 60 fps on a Core 2 Duo. If you somehow have something worse I honestly can't help)

# They see me flowing
- Double click somewhere in the tunnel to watch particles that pass through it be highlighted. (No guarantees this works 100% of the time, though that will be fixed in later versions.)

# Custom shapes!! (Torus only for now)
- Changeable major (R) and minor (r) radiuses
- They actually update in real time + they can be done live
- R/r ratio readout for flow separation analysis

# J.A.R.V.I.S? (Close enough.)
- Neon glowing graph!!! (this cool as heck ngl)
- CRT scanline filter that's also toggleable
- Buncha camera presets like isometric, 2D side profile, top-down, front stagnation, etc. (Front 3d might not work right now)
- Wireframe flow-straightener at the inlet, plus ambient dust particles for scale
- Basically everything's also collapsible, so fullscreen is also doable (there's also a dedicated fullscreen button.)

# Don't understand stuff? Well here's Gemini.
- Add your own Gemini API key to get a live, technical aerodynamic report on the current simulation state
- No key? No problem — falls back to a rule-based local expert system that still generates a full report offline (though it might not be fully accurate.)

**Disclaimer: Imma be real here, I DID NOT CODE THE GEMINI COPILOT. It did it on it's own when I told Google AI Studio to just not change anything when i gave it the code (For free domain ;-;) so i will not be taking credit for this. It's still cool though so I decided to keep it.**

## 🕹️ Presets

| Preset | What it shows |
|---|---|
| Laminar Airfoil Study | Clean attached streamlines around a 2D wing profile |
| Critical Wing Stall | Tilt past 15° and watch the boundary layer detach into a high-drag wake, complete with a flashing stall warning |
| Sports Car Downforce | Airflow over and under a car chassis generating ground-suction downforce |
| Bluff Body Wake (Cube) | High-Reynolds flow slamming into a flat face, producing heavy turbulence |
| Torus Matrix | Flow shearing through a hollow toroidal ring |
| Torus Thin Ring | High R/r ratio ring for dramatic vortex shedding patterns |
| Eco / Low-Spec Mode | Streamlines on a 2D slice, tuned for integrated GPUs and battery power |

## Building the actual file

Requirements: YOU NEED NODE! 

Downloads:
Just most recent version: `sudo apt install -y nodejs npm`
Recommended (Node Version Manager):
`curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.6/install.sh | bash`
`source ~/.bashrc`
`nvm install --lts`

It's just run `node bundle.cjs` after building — it produces a single `reFlow.html` file you can open directly in any browser.

**To develop locally:**
```bash
cd reflow
npm install
npm run dev
```
Opens at `http://localhost:3000`.

**To rebuild the single-file version after making changes:**
```bash
npm run build:single
```

## Build:

```
src/
├── App.tsx              # Everything UI
├── physics.ts           # Three.js-less physics engine
├── cfdWorker.ts         # off thread WebWorker
├── voxelizer.ts         # Mesh → voxel grid converter for GLB models
├── components/
│   └── WindTunnel.tsx   # Three.js scene, rendering, worker integration - the actual wind tunnel
├── index.css            # Tailwind + CRT overlay
└── main.tsx             # React entry point
```
Most of the math exists in the `physics.ts` file, so check that out if you wanna.

# Tech Stack

| Layer | Tech |
|---|---|
| Framework | React 19 |
| 3D Engine | Three.js (OrbitControls, GLTFLoader) |
| Styling | Tailwind CSS v4 |
| Physics | Custom potential-flow solver + hash-noise turbulence + voxel collision |
| Threading | Web Workers via Vite's native worker support |
| Build | Vite + custom bundler script that inlines everything into `reFlow.html` |
| Icons | Lucide React |
| AI | Google Gen AI SDK (`gemini-2.5-flash`) for live aero reports, with a local rule-based fallback |

## 🚀 Built For

[Stardance](https://stardance.hackclub.com) — Hack Club × NASA × AMD's summer program for teen builders.

---

<div align="center">
<sub>made with the blood, sweat, and tears of a 14y/o science nerd ✨</sub>
</div>
