// =============================================================================
// cfdWorker.ts — Web Worker for particle simulation in reFlow
// Runs physics computations off the main thread using transferable buffers
// =============================================================================

import {
  worldToLocal,
  localToWorldVec,
  checkCollisionLocal,
  projectCollisionLocal,
  getNormalLocal,
  getVelocityAtPoint,
  getFlowColor,
  type PhysicsParams,
  type VoxelGrid,
} from './physics';

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

interface UpdateMessage {
  type: 'update';
  positions: Float32Array;
  velocities: Float32Array;
  bases: Float32Array;
  colors: Float32Array;
  params: PhysicsParams;
  objPos: { x: number; y: number; z: number };
  time: number;
  dt: number;
  particleCount: number;
  smokeMode: string;
  is2D: boolean;
  probePoint: { x: number; y: number; active: boolean } | null;
  tunnelLength: number;
  tunnelWidth: number;
  tunnelHeight: number;
  flowSpeed: number;
  particleColorTheme: string;
  voxelGrid?: VoxelGrid;
}

interface RespawnMessage {
  type: 'respawn';
  particleCount: number;
  smokeMode: string;
  is2D: boolean;
  tunnelWidth: number;
  tunnelHeight: number;
  tunnelLength: number;
  flowSpeed: number;
  probePoint: { x: number; y: number; active: boolean } | null;
  isReset: boolean;
}

// ---------------------------------------------------------------------------
// Spawn logic (mirrors the main thread spawnParticle)
// ---------------------------------------------------------------------------

function spawnParticle(
  i: number,
  positions: Float32Array,
  bases: Float32Array,
  velocities: Float32Array,
  smokeMode: string,
  is2D: boolean,
  tunnelWidth: number,
  tunnelHeight: number,
  tunnelLength: number,
  flowSpeed: number,
  probePoint: { x: number; y: number; active: boolean } | null,
  particleCount: number,
  isReset: boolean
): void {
  const idx = i * 3;
  const isProbeActive = probePoint && probePoint.active;
  const isProbeParticle = isProbeActive && i >= (particleCount - 1200);

  if (isProbeParticle && probePoint) {
    positions[idx] = probePoint.x + (Math.random() - 0.5) * 0.25;
    positions[idx + 1] = probePoint.y + (Math.random() - 0.5) * 0.25;
  } else if (smokeMode === 'streamers') {
    if (is2D) {
      const streamCountY = 15;
      const sy = Math.floor(Math.random() * streamCountY);
      positions[idx] = (Math.random() - 0.5) * 0.1;
      positions[idx + 1] = -7.5 + (sy / (streamCountY - 1)) * 15.0 + (Math.random() - 0.5) * 0.2;
    } else {
      const streamCountX = 11;
      const streamCountY = 7;
      const sx = Math.floor(Math.random() * streamCountX);
      const sy = Math.floor(Math.random() * streamCountY);
      positions[idx] = -15 + (sx / (streamCountX - 1)) * 30 + (Math.random() - 0.5) * 0.25;
      positions[idx + 1] = -7 + (sy / (streamCountY - 1)) * 14 + (Math.random() - 0.5) * 0.25;
    }
  } else {
    // Uniform
    if (is2D) {
      positions[idx] = (Math.random() - 0.5) * 0.1;
    } else {
      positions[idx] = (Math.random() - 0.5) * tunnelWidth;
    }
    positions[idx + 1] = (Math.random() - 0.5) * tunnelHeight;
  }

  // Z position
  positions[idx + 2] = isReset
    ? (Math.random() - 0.5) * tunnelLength
    : (tunnelLength / 2) + Math.random() * 8.0;

  bases[idx] = positions[idx];
  bases[idx + 1] = positions[idx + 1];
  bases[idx + 2] = positions[idx + 2];

  velocities[idx] = 0;
  velocities[idx + 1] = 0;
  velocities[idx + 2] = -flowSpeed;
}

// ---------------------------------------------------------------------------
// Worker message handler
// ---------------------------------------------------------------------------

self.onmessage = (e: MessageEvent) => {
  const msg = e.data;

  if (msg.type === 'update') {
    const {
      positions, velocities, bases, colors,
      params, objPos, time, dt, particleCount,
      smokeMode, is2D, probePoint,
      tunnelLength, tunnelWidth, tunnelHeight,
      flowSpeed, particleColorTheme, voxelGrid,
    } = msg as UpdateMessage;

    const angleRad = (params.angleOfAttackDeg * Math.PI) / 180;
    const activeType = params.activeObject;
    const FADE_ZONE = 8.0;
    const halfTunnel = tunnelLength / 2;

    for (let i = 0; i < particleCount; i++) {
      const idx = i * 3;

      // 1. Convert particle to local coords
      const [lx, ly, lz] = worldToLocal(
        positions[idx], positions[idx + 1], positions[idx + 2],
        objPos.x, objPos.y, objPos.z,
        angleRad
      );

      let localX = lx, localY = ly, localZ = lz;

      // 2. Collision detection & projection
      const isInside = checkCollisionLocal(activeType, localX, localY, localZ, params, voxelGrid);
      if (isInside) {
        const [px, py, pz] = projectCollisionLocal(activeType, localX, localY, localZ, params, voxelGrid);
        localX = px; localY = py; localZ = pz;

        // Convert projected position back to world
        const [wx, wy, wz] = localToWorldVec(localX, localY, localZ, angleRad);
        positions[idx] = wx + objPos.x;
        positions[idx + 1] = wy + objPos.y;
        positions[idx + 2] = wz + objPos.z;

        // Bounce velocity off surface normal
        const [nx, ny, nz] = getNormalLocal(activeType, localX, localY, localZ, params, voxelGrid);
        const [wnx, wny, wnz] = localToWorldVec(nx, ny, nz, angleRad);
        const nLen = Math.sqrt(wnx * wnx + wny * wny + wnz * wnz) || 1;
        const normX = wnx / nLen, normY = wny / nLen, normZ = wnz / nLen;

        const dotProd = velocities[idx] * normX + velocities[idx + 1] * normY + velocities[idx + 2] * normZ;
        if (dotProd < 0) {
          velocities[idx] -= 1.35 * dotProd * normX;
          velocities[idx + 1] -= 1.35 * dotProd * normY;
          velocities[idx + 2] -= 1.35 * dotProd * normZ;
          velocities[idx] += (Math.random() - 0.5) * 0.05 * flowSpeed;
          velocities[idx + 1] += (Math.random() - 0.5) * 0.05 * flowSpeed;
          velocities[idx + 2] += (Math.random() - 0.5) * 0.05 * flowSpeed;
        }
      }

      // 3. Get flow velocity at local position
      const [flx, fly, flz] = getVelocityAtPoint(localX, localY, localZ, time, params, voxelGrid);

      // 4. Convert flow velocity to world space
      const [fwx, fwy, fwz] = localToWorldVec(flx, fly, flz, angleRad);

      // 5. Lerp particle velocity toward flow velocity
      const lerpFactor = 1.0 - Math.exp(-10.0 * dt);
      velocities[idx] += (fwx - velocities[idx]) * lerpFactor;
      velocities[idx + 1] += (fwy - velocities[idx + 1]) * lerpFactor;
      velocities[idx + 2] += (fwz - velocities[idx + 2]) * lerpFactor;

      // 6. Apply velocity
      const speedMultiplier = 12.0;
      positions[idx] += velocities[idx] * speedMultiplier * dt;
      positions[idx + 1] += velocities[idx + 1] * speedMultiplier * dt;
      positions[idx + 2] += velocities[idx + 2] * speedMultiplier * dt;

      // 7. 2D mode: zero x
      if (is2D) {
        positions[idx] = 0;
        velocities[idx] = 0;
      }

      // 8. Respawn if exited downstream boundary
      if (positions[idx + 2] < -halfTunnel) {
        spawnParticle(
          i, positions, bases, velocities,
          smokeMode, is2D,
          tunnelWidth, tunnelHeight, tunnelLength,
          flowSpeed, probePoint, particleCount, false
        );
      }

      // 9. Color computation
      const isProbeActive = probePoint && probePoint.active;
      const isProbeParticle = isProbeActive && i >= (particleCount - 1200);

      if (isProbeParticle) {
        colors[idx] = 1.0;
        colors[idx + 1] = 0.0;
        colors[idx + 2] = 1.0;
      } else {
        const velLen = Math.sqrt(
          velocities[idx] * velocities[idx] +
          velocities[idx + 1] * velocities[idx + 1] +
          velocities[idx + 2] * velocities[idx + 2]
        );
        const ratio = Math.min(1.0, velLen / (flowSpeed * 1.4));
        const [cr, cg, cb] = getFlowColor(ratio, particleColorTheme);

        // Fade near inlet/outlet
        const pZ = positions[idx + 2];
        let fade = 1.0;
        if (pZ > halfTunnel) {
          fade = 0.0;
        } else if (pZ > halfTunnel - FADE_ZONE) {
          fade = (halfTunnel - pZ) / FADE_ZONE;
        } else if (pZ < -halfTunnel) {
          fade = 0.0;
        } else if (pZ < -halfTunnel + FADE_ZONE) {
          fade = (pZ + halfTunnel) / FADE_ZONE;
        }

        colors[idx] = cr * fade;
        colors[idx + 1] = cg * fade;
        colors[idx + 2] = cb * fade;
      }
    }

    // Send back with transfer
    (self as any).postMessage(
      { type: 'result', positions, velocities, bases, colors },
      [positions.buffer, velocities.buffer, bases.buffer, colors.buffer]
    );
  }

  else if (msg.type === 'respawn') {
    const {
      particleCount, smokeMode, is2D,
      tunnelWidth, tunnelHeight, tunnelLength,
      flowSpeed, probePoint, isReset,
    } = msg as RespawnMessage;

    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    const bases = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      spawnParticle(
        i, positions, bases, velocities,
        smokeMode, is2D,
        tunnelWidth, tunnelHeight, tunnelLength,
        flowSpeed, probePoint, particleCount, isReset
      );
    }

    (self as any).postMessage(
      { type: 'respawn_result', positions, velocities, bases, colors },
      [positions.buffer, velocities.buffer, bases.buffer, colors.buffer]
    );
  }
};
