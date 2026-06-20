// =============================================================================
// physics.ts — Pure-math physics engine for reFlow wind tunnel simulator
// NO Three.js imports — works in both main thread and Web Worker
// =============================================================================

export interface PhysicsParams {
  flowSpeed: number;
  viscosity: number;
  angleOfAttackDeg: number;
  activeObject: string;
  is2D: boolean;
  torusMajorR: number;
  torusMinorR: number;
}

export interface VoxelGrid {
  data: Uint8Array;
  resolution: number;
  minX: number; minY: number; minZ: number;
  maxX: number; maxY: number; maxZ: number;
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(a: number, b: number, t: number): number {
  const x = clamp((t - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
}

/** GPU-style hash noise — returns value in [0,1) */
function hash(x: number, y: number, z: number): number {
  let n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Hash noise returning [-1, 1] */
function snoise(x: number, y: number, z: number): number {
  return hash(x, y, z) * 2 - 1;
}

function lerpVal(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) / 255, ((v >> 8) & 0xff) / 255, (v & 0xff) / 255];
}

// Pre-computed theme colours to avoid re-parsing hex every frame
const THEME_COLORS = {
  cyan: {
    a: hexToRgb('#002244'),
    b: hexToRgb('#0066cc'),
    c: hexToRgb('#7df9ff'),
    mid: 0.5,
  },
  fire: {
    a: hexToRgb('#ff003c'),
    b: hexToRgb('#ff5e00'),
    c: hexToRgb('#ffd600'),
    mid: 0.4,
  },
  emerald: {
    a: hexToRgb('#004b23'),
    b: hexToRgb('#38b000'),
    c: hexToRgb('#ccff33'),
    mid: 0.5,
  },
  plasma: {
    a: hexToRgb('#3c096c'),
    b: hexToRgb('#ff00a0'),
    c: hexToRgb('#ffb3c1'),
    mid: 0.5,
  },
};

// ---------------------------------------------------------------------------
// Coordinate transforms
// ---------------------------------------------------------------------------

/**
 * Transform a world-space point to obstacle-local space.
 * Obstacle transform: translate(objPos) then rotateX(angleRad).
 * So worldToLocal = rotateX(-angleRad) * (point - objPos).
 */
export function worldToLocal(
  px: number, py: number, pz: number,
  objX: number, objY: number, objZ: number,
  angleRad: number
): [number, number, number] {
  // Translate
  const dx = px - objX;
  const dy = py - objY;
  const dz = pz - objZ;
  // RotateX by -angleRad
  const cosA = Math.cos(-angleRad);
  const sinA = Math.sin(-angleRad);
  return [
    dx,
    dy * cosA - dz * sinA,
    dy * sinA + dz * cosA,
  ];
}

/**
 * Transform a local-space vector to world-space (rotation only, no translation).
 * Applies rotateX(+angleRad).
 */
export function localToWorldVec(
  vx: number, vy: number, vz: number,
  angleRad: number
): [number, number, number] {
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);
  return [
    vx,
    vy * cosA - vz * sinA,
    vy * sinA + vz * cosA,
  ];
}

// ---------------------------------------------------------------------------
// VoxelGrid helpers
// ---------------------------------------------------------------------------

function voxelIndex(
  x: number, y: number, z: number,
  grid: VoxelGrid
): number {
  const res = grid.resolution;
  const ix = clamp(Math.floor((x - grid.minX) / (grid.maxX - grid.minX) * res), 0, res - 1);
  const iy = clamp(Math.floor((y - grid.minY) / (grid.maxY - grid.minY) * res), 0, res - 1);
  const iz = clamp(Math.floor((z - grid.minZ) / (grid.maxZ - grid.minZ) * res), 0, res - 1);
  return ix + iy * res + iz * res * res;
}

function voxelIsInside(x: number, y: number, z: number, grid: VoxelGrid): boolean {
  // Outside bounding box → not inside
  if (x < grid.minX || x > grid.maxX ||
      y < grid.minY || y > grid.maxY ||
      z < grid.minZ || z > grid.maxZ) return false;
  return grid.data[voxelIndex(x, y, z, grid)] > 0;
}

// ---------------------------------------------------------------------------
// Collision detection (local coords)
// ---------------------------------------------------------------------------

export function checkCollisionLocal(
  type: string, x: number, y: number, z: number,
  params: PhysicsParams, voxelGrid?: VoxelGrid
): boolean {
  switch (type) {
    case 'Sphere':
      return (x * x + y * y + z * z) < 12.25; // radius 3.5

    case 'Cube':
      return Math.abs(x) < 2.6 && Math.abs(y) < 2.6 && Math.abs(z) < 2.6;

    case 'Wing': {
      if (Math.abs(z) > 6) return false;
      if (x < -4 || x > 4) return false;
      const s = (4 - x) / 8; // normalised chord 0..1
      const yt = 5 * 0.12 * (
        0.2969 * Math.sqrt(Math.max(0, s)) -
        0.1260 * s -
        0.3516 * s * s +
        0.2843 * s * s * s -
        0.1015 * s * s * s * s
      ) * 8;
      return Math.abs(y) < yt;
    }

    case 'Custom': { // Torus in local X-Y plane
      const R = params.torusMajorR;
      const r = params.torusMinorR;
      const dXY = Math.sqrt(x * x + y * y);
      const distSq = (dXY - R) * (dXY - R) + z * z;
      return distSq < r * r;
    }

    case 'Car': {
      if (Math.abs(z) > 2.4) return false;
      if (x < -5.2 || x > 5.2) return false;
      if (y < -1.2 || y > 1.4) return false;
      // Profile bound
      if (x < 0) {
        if (x < -4.5) {
          const t = (x - (-5.2)) / 0.7;
          return y < (-0.8 + t * 0.6);
        } else if (x < -2.2) {
          const t = (x - (-4.5)) / 2.3;
          return y < (-0.2 + t * 0.4);
        } else {
          const t = (x - (-2.2)) / 1.4;
          return y < (0.2 + t * 1.2);
        }
      } else {
        if (x < 1.8) return y < 1.4;
        else if (x < 3.2) {
          const t = (x - 1.8) / 1.4;
          return y < (1.4 - t * 1.0);
        } else if (x < 4.2) return y < 0.5;
        else if (x < 4.4) return y < 0.9;
        else {
          const t = (x - 4.4) / 0.8;
          return y < (0.9 - t * 2.1);
        }
      }
    }

    case 'FlatPlate':
      return Math.abs(x) < 0.04 && Math.abs(y) < 2.9 && Math.abs(z) < 2.9;

    case 'GLBModel':
      if (voxelGrid) return voxelIsInside(x, y, z, voxelGrid);
      return false;

    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Collision projection (local coords)
// ---------------------------------------------------------------------------

export function projectCollisionLocal(
  type: string, x: number, y: number, z: number,
  params: PhysicsParams, voxelGrid?: VoxelGrid
): [number, number, number] {
  switch (type) {
    case 'Sphere': {
      const dist = Math.sqrt(x * x + y * y + z * z);
      if (dist < 3.5) {
        const f = 3.52 / (dist + 0.001);
        return [x * f, y * f, z * f];
      }
      return [x, y, z];
    }

    case 'Cube': {
      const dx = 2.6 - Math.abs(x);
      const dy = 2.6 - Math.abs(y);
      const dz = 2.6 - Math.abs(z);
      const m = Math.min(dx, dy, dz);
      if (m === dx) return [Math.sign(x) * 2.62, y, z];
      if (m === dy) return [x, Math.sign(y) * 2.62, z];
      return [x, y, Math.sign(z) * 2.62];
    }

    case 'Wing': {
      if (Math.abs(z) > 6 || x < -4 || x > 4) return [x, y, z];
      const s = (4 - x) / 8;
      const yt = 5 * 0.12 * (
        0.2969 * Math.sqrt(Math.max(0, s)) -
        0.1260 * s -
        0.3516 * s * s +
        0.2843 * s * s * s -
        0.1015 * s * s * s * s
      ) * 8;
      if (Math.abs(y) < yt) {
        return [x, (Math.sign(y) || 1) * (yt + 0.02), z];
      }
      return [x, y, z];
    }

    case 'Custom': {
      const R = params.torusMajorR;
      const r = params.torusMinorR;
      const dXY = Math.sqrt(x * x + y * y);
      const angle = Math.atan2(y, x);
      const tubeX = Math.cos(angle) * R;
      const tubeY = Math.sin(angle) * R;
      const dist = Math.sqrt(
        (x - tubeX) * (x - tubeX) +
        (y - tubeY) * (y - tubeY) +
        z * z
      );
      if (dist < r) {
        const f = (r * 1.02) / (dist + 0.001);
        return [
          tubeX + (x - tubeX) * f,
          tubeY + (y - tubeY) * f,
          z * f,
        ];
      }
      return [x, y, z];
    }

    case 'Car': {
      if (Math.abs(z) > 2.4) return [x, y, z];
      if (x >= -5.2 && x <= 5.2 && y >= -1.2 && y <= 1.4) {
        let yBound = -1.2;
        if (x < 0) {
          if (x < -4.5) {
            const t = (x + 5.2) / 0.7;
            yBound = -0.8 + t * 0.6;
          } else if (x < -2.2) {
            const t = (x + 4.5) / 2.3;
            yBound = -0.2 + t * 0.4;
          } else {
            const t = (x + 2.2) / 1.4;
            yBound = 0.2 + t * 1.2;
          }
        } else {
          if (x < 1.8) yBound = 1.4;
          else if (x < 3.2) {
            const t = (x - 1.8) / 1.4;
            yBound = 1.4 - t * 1.0;
          } else if (x < 4.2) yBound = 0.5;
          else if (x < 4.4) yBound = 0.9;
          else {
            const t = (x - 4.4) / 0.8;
            yBound = 0.9 - t * 2.1;
          }
        }
        if (y < yBound) {
          return [x, yBound + 0.03, z];
        }
      }
      return [x, y, z];
    }

    case 'FlatPlate':
      return [Math.sign(x) * 0.06, y, z];

    case 'GLBModel': {
      if (!voxelGrid) return [x, y, z];
      const res = voxelGrid.resolution;
      const sx = (voxelGrid.maxX - voxelGrid.minX) / res;
      const sy = (voxelGrid.maxY - voxelGrid.minY) / res;
      const sz = (voxelGrid.maxZ - voxelGrid.minZ) / res;
      // Search outward in 6 directions for nearest empty voxel
      for (let d = 1; d <= 5; d++) {
        const offsets: [number, number, number][] = [
          [d * sx, 0, 0], [-d * sx, 0, 0],
          [0, d * sy, 0], [0, -d * sy, 0],
          [0, 0, d * sz], [0, 0, -d * sz],
        ];
        for (const [ox, oy, oz] of offsets) {
          if (!voxelIsInside(x + ox, y + oy, z + oz, voxelGrid)) {
            return [x + ox, y + oy, z + oz];
          }
        }
      }
      // Fallback: push along +Y
      return [x, y + 1.0, z];
    }

    default:
      return [x, y, z];
  }
}

// ---------------------------------------------------------------------------
// Surface normal (local coords)
// ---------------------------------------------------------------------------

export function getNormalLocal(
  type: string, x: number, y: number, z: number,
  params: PhysicsParams, voxelGrid?: VoxelGrid
): [number, number, number] {
  switch (type) {
    case 'Sphere': {
      const r = Math.sqrt(x * x + y * y + z * z);
      if (r > 0) return [x / r, y / r, z / r];
      return [0, 1, 0];
    }

    case 'Cube': {
      const dx = 2.6 - Math.abs(x);
      const dy = 2.6 - Math.abs(y);
      const dz = 2.6 - Math.abs(z);
      const m = Math.min(dx, dy, dz);
      if (m === dx) return [Math.sign(x), 0, 0];
      if (m === dy) return [0, Math.sign(y), 0];
      return [0, 0, Math.sign(z)];
    }

    case 'Wing': {
      if (Math.abs(z) > 6) return [0, 0, Math.sign(z)];
      if (x < -4 || x > 4) return [Math.sign(x), 0, 0];
      const s = (4 - x) / 8;
      const ds = Math.max(0.0001, s);
      const dyt_ds = 4.8 * (
        0.14845 / Math.sqrt(ds) - 0.1260 -
        0.7032 * s + 0.8529 * s * s - 0.4060 * s * s * s
      );
      const dyt_dx = -0.125 * dyt_ds;
      const ny = (Math.sign(y) || 1);
      const len = Math.sqrt(dyt_dx * dyt_dx + 1);
      return [-dyt_dx / len, ny / len, 0];
    }

    case 'Custom': {
      const R = params.torusMajorR;
      const dXY = Math.sqrt(x * x + y * y);
      if (dXY > 0) {
        const angle = Math.atan2(y, x);
        const tubeX = Math.cos(angle) * R;
        const tubeY = Math.sin(angle) * R;
        const nx = x - tubeX;
        const ny = y - tubeY;
        const nz = z;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        return [nx / len, ny / len, nz / len];
      }
      return [0, 1, 0];
    }

    case 'Car': {
      if (Math.abs(z) > 2.4) return [0, 0, Math.sign(z)];
      let dy_dx = 0;
      if (x < 0) {
        if (x < -4.5) dy_dx = 0.6 / 0.7;
        else if (x < -2.2) dy_dx = 0.4 / 2.3;
        else dy_dx = 1.2 / 1.4;
      } else {
        if (x < 1.8) dy_dx = 0;
        else if (x < 3.2) dy_dx = -1.0 / 1.4;
        else if (x < 4.2) dy_dx = 0;
        else if (x < 4.4) dy_dx = 0;
        else dy_dx = -2.1 / 0.8;
      }
      const len = Math.sqrt(dy_dx * dy_dx + 1);
      return [-dy_dx / len, 1 / len, 0];
    }

    case 'FlatPlate': {
      const dx = 0.04 - Math.abs(x);
      const dy = 2.9 - Math.abs(y);
      const dz = 2.9 - Math.abs(z);
      const m = Math.min(dx, dy, dz);
      if (m === dx) return [Math.sign(x) || 1, 0, 0];
      if (m === dy) return [0, Math.sign(y), 0];
      return [0, 0, Math.sign(z)];
    }

    case 'GLBModel': {
      if (!voxelGrid) return [0, 1, 0];
      const res = voxelGrid.resolution;
      const sx = (voxelGrid.maxX - voxelGrid.minX) / res;
      const sy = (voxelGrid.maxY - voxelGrid.minY) / res;
      const sz = (voxelGrid.maxZ - voxelGrid.minZ) / res;
      // Gradient of occupancy field
      const gx = (voxelIsInside(x + sx, y, z, voxelGrid) ? 1 : 0) -
                 (voxelIsInside(x - sx, y, z, voxelGrid) ? 1 : 0);
      const gy = (voxelIsInside(x, y + sy, z, voxelGrid) ? 1 : 0) -
                 (voxelIsInside(x, y - sy, z, voxelGrid) ? 1 : 0);
      const gz = (voxelIsInside(x, y, z + sz, voxelGrid) ? 1 : 0) -
                 (voxelIsInside(x, y, z - sz, voxelGrid) ? 1 : 0);
      const len = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
      // Normal points away from solid (opposite gradient direction)
      return [-gx / len, -gy / len, -gz / len];
    }

    default:
      return [0, 1, 0];
  }
}

// ---------------------------------------------------------------------------
// Velocity field (local coords)
// ---------------------------------------------------------------------------

/**
 * Compute distance to the nearest surface point of the obstacle.
 * Used for boundary layer (no-slip) smoothstep.
 */
function distToSurface(
  type: string, x: number, y: number, z: number,
  params: PhysicsParams, voxelGrid?: VoxelGrid
): number {
  switch (type) {
    case 'Sphere': {
      const r = Math.sqrt(x * x + y * y + z * z);
      return Math.abs(r - 3.5);
    }
    case 'Cube': {
      const dx = Math.abs(x) - 2.6;
      const dy = Math.abs(y) - 2.6;
      const dz = Math.abs(z) - 2.6;
      // If outside, distance to nearest face
      if (dx > 0 || dy > 0 || dz > 0) {
        return Math.sqrt(
          Math.max(0, dx) ** 2 +
          Math.max(0, dy) ** 2 +
          Math.max(0, dz) ** 2
        );
      }
      // Inside: distance to nearest face
      return Math.min(-dx, -dy, -dz);
    }
    case 'Custom': {
      const R = params.torusMajorR;
      const r = params.torusMinorR;
      const dXY = Math.sqrt(x * x + y * y);
      const tubeAngle = Math.atan2(y, x);
      const tubeX = Math.cos(tubeAngle) * R;
      const tubeY = Math.sin(tubeAngle) * R;
      const dist = Math.sqrt((x - tubeX) ** 2 + (y - tubeY) ** 2 + z * z);
      return Math.abs(dist - r);
    }
    case 'GLBModel': {
      if (!voxelGrid) return 10;
      // Approximate: check if inside and search for border
      const isIn = voxelIsInside(x, y, z, voxelGrid);
      if (!isIn) {
        // rough distance = distance to bounding box center scaled
        const cx = (voxelGrid.maxX + voxelGrid.minX) * 0.5;
        const cy = (voxelGrid.maxY + voxelGrid.minY) * 0.5;
        const cz = (voxelGrid.maxZ + voxelGrid.minZ) * 0.5;
        const halfDiag = Math.sqrt(
          (voxelGrid.maxX - voxelGrid.minX) ** 2 +
          (voxelGrid.maxY - voxelGrid.minY) ** 2 +
          (voxelGrid.maxZ - voxelGrid.minZ) ** 2
        ) * 0.5;
        const distCenter = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2);
        return Math.max(0, distCenter - halfDiag * 0.8);
      }
      return 0.1; // inside → near surface
    }
    default:
      return 10; // far from surface → no boundary effect
  }
}

export function getVelocityAtPoint(
  x: number, y: number, z: number,
  time: number,
  params: PhysicsParams,
  voxelGrid?: VoxelGrid
): [number, number, number] {
  const { flowSpeed: U, viscosity: visc, angleOfAttackDeg: alphaDeg, activeObject: activeType, is2D } = params;
  const alpha = (alphaDeg * Math.PI) / 180;

  // Local uniform flow velocity (world wind (0,0,-U) rotated by -alpha into local frame)
  const Ux = 0;
  const Uy = -U * Math.sin(alpha);
  const Uz = -U * Math.cos(alpha);

  let vx = Ux;
  let vy = Uy;
  let vz = Uz;

  // --- Potential flow deflection ---
  if (activeType === 'Sphere' || activeType === 'Cube' || activeType === 'Car' || activeType === 'GLBModel') {
    let R: number;
    if (activeType === 'Sphere') R = 3.5;
    else if (activeType === 'Cube') R = 3.2;
    else if (activeType === 'Car') R = 3.8;
    else {
      // GLBModel: use half diagonal of bounding box
      if (voxelGrid) {
        R = Math.sqrt(
          (voxelGrid.maxX - voxelGrid.minX) ** 2 +
          (voxelGrid.maxY - voxelGrid.minY) ** 2 +
          (voxelGrid.maxZ - voxelGrid.minZ) ** 2
        ) * 0.5;
      } else {
        R = 3.5;
      }
    }

    const rSq = x * x + y * y + z * z;
    const r = Math.sqrt(rSq);
    if (r > R) {
      const dot = (Ux * x + Uy * y + Uz * z) / r;
      const factor = (R * R * R) / (2 * r * r * r);
      vx -= factor * (Ux - 3 * dot * x / r);
      vy -= factor * (Uy - 3 * dot * y / r);
      vz -= factor * (Uz - 3 * dot * z / r);
    } else {
      vx = 0; vy = 0; vz = 0;
    }
  } else if (activeType === 'Wing' || activeType === 'FlatPlate' || activeType === 'Custom') {
    const R = activeType === 'Wing' ? 2.2 : activeType === 'FlatPlate' ? 2.5 : 2.0;
    const r2dSq = y * y + z * z;
    const r2d = Math.sqrt(r2dSq);

    if (r2d > R) {
      // Doublet
      const dot = (Uy * y + Uz * z) / r2d;
      const factor = (R * R) / r2dSq;
      const vy_d = -factor * (Uy - 2 * dot * y / r2d);
      const vz_d = -factor * (Uz - 2 * dot * z / r2d);

      // Circulation (Kutta condition)
      let stallFactor = 1.0;
      const absAlpha = Math.abs(alpha);
      const stallAngle = (15 * Math.PI) / 180;
      if (absAlpha > stallAngle) {
        stallFactor = Math.max(0.2, 1.0 - 0.7 * ((absAlpha - stallAngle) / stallAngle));
      }
      const Gamma = 4.0 * Math.PI * U * R * Math.sin(alpha) * stallFactor;
      const circFactor = Gamma / (2 * Math.PI * r2d);
      const vy_c = circFactor * (z / r2d);
      const vz_c = circFactor * (-y / r2d);

      vy += vy_d + vy_c;
      vz += vz_d + vz_c;
    } else {
      vx = 0; vy = 0; vz = 0;
    }
  }

  // --- Boundary layer (no-slip condition) ---
  const dSurf = distToSurface(activeType, x, y, z, params, voxelGrid);
  if (dSurf < 0.5) {
    const blendFactor = smoothstep(0, 0.5, dSurf);
    vx *= blendFactor;
    vy *= blendFactor;
    vz *= blendFactor;
  }

  // --- Turbulent wake model (downstream: z < 0) ---
  if (z < 0) {
    let wakeRadius: number;
    switch (activeType) {
      case 'Wing': wakeRadius = 1.8 + 0.22 * (-z); break;
      case 'FlatPlate': wakeRadius = 3.5 + 0.3 * (-z); break;
      case 'Car': wakeRadius = 2.4 + 0.1 * (-z); break;
      default: wakeRadius = 4.2 + 0.15 * (-z); break;
    }

    const latDist = (activeType === 'Sphere' || activeType === 'Cube' || activeType === 'GLBModel')
      ? Math.sqrt(x * x + y * y)
      : Math.abs(y);

    if (latDist < wakeRadius) {
      const inWakeFactor = 1.0 - latDist / wakeRadius;

      // Speed deficit (drag shadow)
      vz *= (1.0 - 0.65 * inWakeFactor);

      // Turbulence intensity from viscosity
      const turbulenceIntensity = Math.max(0, 1.0 - visc / 10.0);

      if (turbulenceIntensity > 0) {
        const isStalled = activeType === 'Wing' && Math.abs(alphaDeg) > 15;
        const stallMult = isStalled ? 2.0 : 1.0;

        const speedScale = Math.sqrt(vx * vx + vy * vy + vz * vz);
        const noiseAmp = speedScale * 0.7 * inWakeFactor * turbulenceIntensity * stallMult;

        // Hash-based pseudo-random turbulence (organic, not periodic)
        const advectZ = z + time * U * 8.0;
        const scale1 = 0.8;
        const scale2 = 1.6;

        // Multi-octave hash noise for organic feel
        const h1x = snoise(x * scale1, y * scale1, advectZ * 0.3);
        const h1y = snoise(x * scale1 + 17.3, y * scale1 + 31.7, advectZ * 0.25);
        const h1z = snoise(x * scale1 + 53.1, y * scale1 + 71.9, advectZ * 0.2);
        const h2x = snoise(x * scale2, y * scale2 + 13.1, advectZ * 0.5) * 0.5;
        const h2y = snoise(x * scale2 + 23.7, y * scale2, advectZ * 0.4) * 0.5;
        const h2z = snoise(x * scale2 + 41.3, y * scale2 + 61.7, advectZ * 0.35) * 0.5;

        const turbX = is2D ? 0 : (h1x + h2x) * noiseAmp * 0.5;
        const turbY = (h1y + h2y) * noiseAmp;
        const turbZ = (h1z + h2z) * noiseAmp * 0.3;

        vx += turbX;
        vy += turbY;
        vz += turbZ;

        // --- Von Kármán vortex shedding (bluff bodies only) ---
        if (activeType === 'Cube' || activeType === 'Sphere' || activeType === 'GLBModel') {
          // Strouhal number ≈ 0.2 for bluff bodies, St = f*D/U
          const D = activeType === 'Cube' ? 5.2 : 7.0;
          const sheddingFreq = 0.2 * U / D;
          const sheddingPhase = Math.sin(time * sheddingFreq * 2 * Math.PI);

          // Lateral vortex impulse — alternates sides
          const vortexStrength = noiseAmp * 1.2 * inWakeFactor;
          const decayFactor = Math.exp(0.05 * z); // decay downstream (z < 0 → positive exponent < 1)

          if (is2D) {
            vy += sheddingPhase * vortexStrength * decayFactor;
          } else {
            // Alternate between Y and X shedding
            const secondaryPhase = Math.cos(time * sheddingFreq * 2 * Math.PI);
            vy += sheddingPhase * vortexStrength * decayFactor;
            vx += secondaryPhase * vortexStrength * decayFactor * 0.6;
          }
        }
      }
    }
  }

  // 2D mode: zero out x component
  if (is2D) {
    vx = 0;
  }

  return [vx, vy, vz];
}

// ---------------------------------------------------------------------------
// Flow colour mapping
// ---------------------------------------------------------------------------

export function getFlowColor(ratio: number, theme: string): [number, number, number] {
  const t = (THEME_COLORS as any)[theme] || THEME_COLORS.cyan;
  const clamped = clamp(ratio, 0, 1);

  if (clamped < t.mid) {
    const f = clamped / t.mid;
    return [
      lerpVal(t.a[0], t.b[0], f),
      lerpVal(t.a[1], t.b[1], f),
      lerpVal(t.a[2], t.b[2], f),
    ];
  } else {
    const f = (clamped - t.mid) / (1 - t.mid);
    return [
      lerpVal(t.b[0], t.c[0], f),
      lerpVal(t.b[1], t.c[1], f),
      lerpVal(t.b[2], t.c[2], f),
    ];
  }
}
