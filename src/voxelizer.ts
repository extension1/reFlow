// =============================================================================
// voxelizer.ts — Mesh-to-voxel-grid utility for reFlow
// Uses Three.js raycasting to convert arbitrary geometry into a VoxelGrid
// =============================================================================

import * as THREE from 'three';
import type { VoxelGrid } from './physics';

/**
 * Voxelize a mesh geometry into a 3D occupancy grid.
 * Uses the ray-parity method: for each (y,z) row, cast a ray in +X direction,
 * count intersections to determine inside/outside.
 *
 * @param geometry - The BufferGeometry to voxelize
 * @param resolution - Grid resolution along each axis (default 48)
 * @returns VoxelGrid with occupancy data
 */
export function voxelizeMesh(
  geometry: THREE.BufferGeometry,
  resolution: number = 48
): VoxelGrid {
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox!;

  // Add padding so rays don't miss edges
  const size = new THREE.Vector3();
  bb.getSize(size);
  const pad = Math.max(size.x, size.y, size.z) * 0.05;

  const minX = bb.min.x - pad;
  const minY = bb.min.y - pad;
  const minZ = bb.min.z - pad;
  const maxX = bb.max.x + pad;
  const maxY = bb.max.y + pad;
  const maxZ = bb.max.z + pad;

  const data = new Uint8Array(resolution * resolution * resolution);

  // Create temp mesh for raycasting
  const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, mat);
  const raycaster = new THREE.Raycaster();

  const origin = new THREE.Vector3();
  const direction = new THREE.Vector3(1, 0, 0);

  const stepY = (maxY - minY) / resolution;
  const stepZ = (maxZ - minZ) / resolution;
  const stepX = (maxX - minX) / resolution;

  for (let iz = 0; iz < resolution; iz++) {
    const zCenter = minZ + (iz + 0.5) * stepZ;
    for (let iy = 0; iy < resolution; iy++) {
      const yCenter = minY + (iy + 0.5) * stepY;

      // Cast ray from far left in +X direction
      origin.set(minX - 1, yCenter, zCenter);
      raycaster.set(origin, direction);

      const intersections = raycaster.intersectObject(mesh);
      if (intersections.length === 0) continue;

      // Sort by distance (usually already sorted, but ensure correctness)
      intersections.sort((a, b) => a.distance - b.distance);

      // For each voxel in this row, determine inside/outside by counting
      // how many intersection surfaces are before the voxel centre
      for (let ix = 0; ix < resolution; ix++) {
        const xCenter = minX + (ix + 0.5) * stepX;
        const distFromOrigin = xCenter - (minX - 1);

        // Count intersections before this x position
        let crossings = 0;
        for (let k = 0; k < intersections.length; k++) {
          if (intersections[k].distance < distFromOrigin) {
            crossings++;
          } else {
            break;
          }
        }

        // Odd crossings = inside
        if (crossings % 2 === 1) {
          data[ix + iy * resolution + iz * resolution * resolution] = 1;
        }
      }
    }
  }

  mat.dispose();

  return {
    data,
    resolution,
    minX, minY, minZ,
    maxX, maxY, maxZ,
  };
}
