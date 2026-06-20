import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
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
} from '../physics';
import { voxelizeMesh } from '../voxelizer';

// ---------------------------------------------------------------------------
// Props Interface — MUST match App.tsx exactly
// ---------------------------------------------------------------------------

interface WindTunnelProps {
  viscosity: number;
  flowSpeed: number;
  activeObject: string; // 'Wing'|'Car'|'Sphere'|'Cube'|'FlatPlate'|'Custom'|'GLBModel'
  angleofAttack: number;
  visualMode: 'particles' | 'streamlines' | 'vectors' | 'pressure';
  particleCount: number;
  particleSize: number;
  particleColorTheme: 'cyan' | 'fire' | 'emerald' | 'plasma';
  smokeMode: 'streamers' | 'uniform';
  objectPosition: { x: number; y: number; z: number };
  onStatsUpdate: (stats: any) => void;
  resetTrigger: number;
  is2D: boolean;
  isPaused: boolean;
  probePoint: { x: number; y: number; active: boolean } | null;
  cameraPreset: string | null;
  cameraPresetTrigger: number;
  optimizeRender: boolean;
  onProbePlaced?: (x: number, y: number) => void;
  torusMajorRadius: number;
  torusMinorRadius: number;
  loadedModelBuffer: ArrayBuffer | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TUNNEL_WIDTH = 40;
const TUNNEL_HEIGHT = 20;
const TUNNEL_LENGTH = 60;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WindTunnel({
  viscosity,
  flowSpeed,
  activeObject,
  angleofAttack,
  visualMode,
  particleCount,
  particleSize,
  particleColorTheme,
  smokeMode,
  objectPosition,
  onStatsUpdate,
  resetTrigger,
  is2D,
  isPaused,
  probePoint,
  cameraPreset,
  cameraPresetTrigger,
  optimizeRender,
  onProbePlaced,
  torusMajorRadius,
  torusMinorRadius,
  loadedModelBuffer,
}: WindTunnelProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  // --- Refs for parameters updated in the render loop ---
  const viscosityRef = useRef(viscosity);
  const flowSpeedRef = useRef(flowSpeed);
  const activeObjectRef = useRef(activeObject);
  const angleofAttackRef = useRef(angleofAttack);
  const visualModeRef = useRef(visualMode);
  const particleCountRef = useRef(particleCount);
  const particleSizeRef = useRef(particleSize);
  const particleColorThemeRef = useRef(particleColorTheme);
  const smokeModeRef = useRef(smokeMode);
  const objectPositionRef = useRef(objectPosition);
  const is2DRef = useRef(is2D);
  const isPausedRef = useRef(isPaused);
  const optimizeRenderRef = useRef(optimizeRender);
  const probePointRef = useRef(probePoint);
  const torusMajorRadiusRef = useRef(torusMajorRadius);
  const torusMinorRadiusRef = useRef(torusMinorRadius);

  // Sync props to refs
  useEffect(() => {
    viscosityRef.current = viscosity;
    flowSpeedRef.current = flowSpeed;
    angleofAttackRef.current = angleofAttack;
    visualModeRef.current = visualMode;
    particleSizeRef.current = particleSize;
    particleColorThemeRef.current = particleColorTheme;
    smokeModeRef.current = smokeMode;
    objectPositionRef.current = objectPosition;
    is2DRef.current = is2D;
    isPausedRef.current = isPaused;
    optimizeRenderRef.current = optimizeRender;
    probePointRef.current = probePoint;
    torusMajorRadiusRef.current = torusMajorRadius;
    torusMinorRadiusRef.current = torusMinorRadius;
  }, [viscosity, flowSpeed, angleofAttack, visualMode, particleSize, particleColorTheme, smokeMode, objectPosition, is2D, isPaused, optimizeRender, probePoint, torusMajorRadius, torusMinorRadius]);

  // Dynamic update refs
  const updateObjectGeometryRef = useRef<(type: string) => void>(() => {});
  const recreateParticlesRef = useRef<() => void>(() => {});
  const resetSimulationRef = useRef<() => void>(() => {});
  const updateVectorGridPositionsRef = useRef<(is2DMode: boolean) => void>(() => {});

  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  // GLB model refs
  const voxelGridRef = useRef<VoxelGrid | null>(null);
  const glbMeshRef = useRef<THREE.Mesh | null>(null);

  useEffect(() => {
    activeObjectRef.current = activeObject;
    updateObjectGeometryRef.current(activeObject);
  }, [activeObject]);

  useEffect(() => {
    particleCountRef.current = particleCount;
    recreateParticlesRef.current();
  }, [particleCount]);

  useEffect(() => {
    resetSimulationRef.current();
  }, [resetTrigger]);

  useEffect(() => {
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    if (controls && camera) {
      if (is2D) {
        camera.position.set(38, 0, 0);
        controls.target.set(0, 0, 0);
        controls.enableRotate = false;
        camera.up.set(0, 1, 0);
      } else {
        camera.position.set(22, 12, 28);
        controls.target.set(0, 0, 0);
        controls.enableRotate = true;
      }
      controls.update();
    }
    updateVectorGridPositionsRef.current(is2D);
    recreateParticlesRef.current();
  }, [is2D]);

  const onProbePlacedRef = useRef(onProbePlaced);
  useEffect(() => {
    onProbePlacedRef.current = onProbePlaced;
  }, [onProbePlaced]);

  useEffect(() => {
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    if (controls && camera && cameraPreset) {
      if (cameraPreset === 'iso') {
        camera.position.set(22, 12, 28);
        controls.target.set(0, 0, 0);
        camera.up.set(0, 1, 0);
        controls.enableRotate = !is2D;
      } else if (cameraPreset === 'side') {
        camera.position.set(38, 0, 0);
        controls.target.set(0, 0, 0);
        camera.up.set(0, 1, 0);
        controls.enableRotate = false;
      } else if (cameraPreset === 'top') {
        camera.position.set(0, 38, 0);
        controls.target.set(0, 0, 0);
        camera.up.set(0, 0, -1);
        controls.enableRotate = !is2D;
      } else if (cameraPreset === 'front') {
        camera.position.set(0, 0, 42);
        controls.target.set(0, 0, 0);
        camera.up.set(0, 1, 0);
        controls.enableRotate = !is2D;
      }
      controls.update();
    }
  }, [cameraPreset, cameraPresetTrigger, is2D]);

  // --- Torus geometry rebuild when radii change ---
  useEffect(() => {
    if (activeObjectRef.current === 'Custom') {
      updateObjectGeometryRef.current('Custom');
    }
  }, [torusMajorRadius, torusMinorRadius]);

  // --- GLB/GLTF Model Loading ---
  useEffect(() => {
    if (!loadedModelBuffer) return;
    const loader = new GLTFLoader();
    const bufferCopy = loadedModelBuffer.slice(0); // copy so we don't lose ownership

    loader.parse(bufferCopy, '', (gltf) => {
      let meshGeometry: THREE.BufferGeometry | null = null;

      // Find the first mesh in the loaded scene
      gltf.scene.traverse((child) => {
        if (!meshGeometry && (child as THREE.Mesh).isMesh) {
          meshGeometry = ((child as THREE.Mesh).geometry as THREE.BufferGeometry).clone();
        }
      });

      if (!meshGeometry) {
        console.warn('[reFlow] GLB model contains no mesh geometry');
        return;
      }

      // Auto-scale to fit within a 7-unit bounding sphere
      meshGeometry.computeBoundingBox();
      const bb = meshGeometry.boundingBox!;
      const size = new THREE.Vector3();
      bb.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 7.0 / maxDim;
      meshGeometry.scale(scale, scale, scale);

      // Center at origin
      meshGeometry.computeBoundingBox();
      const center = new THREE.Vector3();
      meshGeometry.boundingBox!.getCenter(center);
      meshGeometry.translate(-center.x, -center.y, -center.z);

      // Store geometry for rendering
      const mat = new THREE.MeshStandardMaterial({
        color: '#e0e0e0',
        roughness: 0.3,
        metalness: 0.7,
      });
      if (glbMeshRef.current) {
        glbMeshRef.current.geometry.dispose();
        (glbMeshRef.current.material as THREE.Material).dispose();
      }
      glbMeshRef.current = new THREE.Mesh(meshGeometry, mat);

      // Voxelize for physics
      voxelGridRef.current = voxelizeMesh(meshGeometry, 48);

      // If currently showing GLBModel, switch to it
      if (activeObjectRef.current === 'GLBModel') {
        updateObjectGeometryRef.current('GLBModel');
      }
    }, (error) => {
      console.error('[reFlow] Failed to parse GLB model:', error);
    });
  }, [loadedModelBuffer]);

  // =========================================================================
  // Main Three.js setup — runs once on mount
  // =========================================================================
  useEffect(() => {
    if (!mountRef.current) return;

    // --- Scene Setup ---
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0b0b0f');
    scene.fog = new THREE.FogExp2('#0b0b0f', 0.012);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    cameraRef.current = camera;
    if (is2DRef.current) {
      camera.position.set(38, 0, 0);
    } else {
      camera.position.set(22, 12, 28);
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.1;
    if (is2DRef.current) {
      controls.enableRotate = false;
      camera.up.set(0, 1, 0);
    }
    controls.update();

    // --- Glowing Probe Marker ---
    const probeMarkerGeo = new THREE.SphereGeometry(0.3, 16, 16);
    const probeMarkerMat = new THREE.MeshBasicMaterial({ color: '#ff00ff', transparent: true, opacity: 0.8 });
    const probeMarker = new THREE.Mesh(probeMarkerGeo, probeMarkerMat);
    probeMarker.visible = false;
    scene.add(probeMarker);

    // --- Inlet Grid (Screen) ---
    const screenGeo = new THREE.PlaneGeometry(38, 18, 10, 6);
    const screenMat = new THREE.MeshBasicMaterial({
      color: '#1b1b2a',
      wireframe: true,
      transparent: true,
      opacity: 0.25,
    });
    const screenMesh = new THREE.Mesh(screenGeo, screenMat);
    screenMesh.position.set(0, 0, 30);
    scene.add(screenMesh);

    // --- Ambient Dust System ---
    const dustCount = 250;
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      const idx = i * 3;
      dustPos[idx] = (Math.random() - 0.5) * TUNNEL_WIDTH;
      dustPos[idx + 1] = (Math.random() - 0.5) * TUNNEL_HEIGHT;
      dustPos[idx + 2] = (Math.random() - 0.5) * TUNNEL_LENGTH;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      size: 0.12,
      color: '#7DF9FF',
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    });
    const dustCloud = new THREE.Points(dustGeo, dustMat);
    scene.add(dustCloud);

    // --- Grid and Environment ---
    const gridHelper = new THREE.GridHelper(70, 70, '#1f1f2e', '#13131a');
    gridHelper.position.y = -10;
    scene.add(gridHelper);

    // Bounding Box of Wind Tunnel
    const tunnelGeo = new THREE.BoxHelper(new THREE.Mesh(new THREE.BoxGeometry(40, 20, 60)), '#2a2a3a');
    tunnelGeo.position.set(0, 0, 0);
    scene.add(tunnelGeo);

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight1.position.set(20, 30, 15);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 1024;
    dirLight1.shadow.mapSize.height = 1024;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight('#7DF9FF', 0.4);
    dirLight2.position.set(-20, -10, -15);
    scene.add(dirLight2);

    // =====================================================================
    // Obstacle Setup
    // =====================================================================

    const obstaclePivot = new THREE.Group();
    scene.add(obstaclePivot);

    const material = new THREE.MeshStandardMaterial({
      color: '#2b363c',
      roughness: 0.25,
      metalness: 0.85,
      wireframe: false,
    });

    // --- Airfoil (Wing) Geometry ---
    const createAirfoilGeometry = () => {
      const shape = new THREE.Shape();
      const steps = 40;
      const chord = 8;
      const thickness = 0.12;

      const upperPoints: THREE.Vector2[] = [];
      const lowerPoints: THREE.Vector2[] = [];

      for (let i = 0; i <= steps; i++) {
        const s = i / steps;
        const yt = 5 * thickness * (
          0.2969 * Math.sqrt(s) -
          0.1260 * s -
          0.3516 * s * s +
          0.2843 * Math.pow(s, 3) -
          0.1015 * Math.pow(s, 4)
        ) * chord;

        const x_chord = 4 - s * chord;
        upperPoints.push(new THREE.Vector2(x_chord, yt));
        if (i > 0 && i < steps) {
          lowerPoints.push(new THREE.Vector2(x_chord, -yt));
        }
      }

      shape.moveTo(upperPoints[0].x, upperPoints[0].y);
      for (let i = 1; i < upperPoints.length; i++) {
        shape.lineTo(upperPoints[i].x, upperPoints[i].y);
      }
      for (let i = lowerPoints.length - 1; i >= 0; i--) {
        shape.lineTo(lowerPoints[i].x, lowerPoints[i].y);
      }
      shape.closePath();

      const extrudeSettings = {
        depth: 12,
        bevelEnabled: true,
        bevelSegments: 3,
        steps: 1,
        bevelSize: 0.1,
        bevelThickness: 0.1,
      };
      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      geometry.center();
      return geometry;
    };

    // --- Improved Car Geometry ---
    const createCarGeometry = () => {
      const shape = new THREE.Shape();

      // Start at bottom-left (rear underbody)
      shape.moveTo(-5.2, -1.2);

      // Flat underbody
      shape.lineTo(5.2, -1.2);

      // Front bumper — smooth curve rising from underbody
      shape.quadraticCurveTo(5.4, -0.4, 5.1, 0.0);
      shape.quadraticCurveTo(4.8, 0.5, 4.3, 0.55);

      // Front wheel arch (subtle bump)
      shape.quadraticCurveTo(4.0, 0.65, 3.7, 0.5);

      // Hood / bonnet line rising to windshield
      shape.quadraticCurveTo(3.0, 0.45, 2.2, 0.55);

      // Windshield — smooth steep angle
      shape.bezierCurveTo(1.8, 0.7, 1.4, 1.2, 1.0, 1.45);

      // Roof — gentle curve
      shape.bezierCurveTo(0.4, 1.55, -0.6, 1.55, -1.2, 1.45);

      // Rear window slope
      shape.bezierCurveTo(-1.8, 1.3, -2.2, 1.0, -2.6, 0.6);

      // Trunk/boot with subtle spoiler lip
      shape.quadraticCurveTo(-3.0, 0.45, -3.4, 0.35);
      shape.lineTo(-3.6, 0.42); // spoiler lip
      shape.quadraticCurveTo(-3.8, 0.38, -4.0, 0.2);

      // Rear wheel arch
      shape.quadraticCurveTo(-4.3, 0.1, -4.5, -0.2);
      shape.quadraticCurveTo(-4.7, -0.5, -4.9, -0.7);

      // Rear bumper
      shape.quadraticCurveTo(-5.1, -0.9, -5.2, -1.2);

      shape.closePath();

      // Wheel arch cutout 1 (front) — subtract from shape via hole
      const frontWheelHole = new THREE.Path();
      frontWheelHole.absarc(3.8, -1.2, 0.55, 0, Math.PI, false);
      shape.holes.push(frontWheelHole);

      // Wheel arch cutout 2 (rear)
      const rearWheelHole = new THREE.Path();
      rearWheelHole.absarc(-4.2, -1.2, 0.55, 0, Math.PI, false);
      shape.holes.push(rearWheelHole);

      const extrudeSettings = {
        depth: 4.8,
        bevelEnabled: true,
        bevelSegments: 5,
        steps: 1,
        bevelSize: 0.12,
        bevelThickness: 0.12,
      };
      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      geometry.center();
      return geometry;
    };

    let currentObject: THREE.Mesh | null = null;

    const updateObjectGeometry = (type: string) => {
      if (currentObject) {
        obstaclePivot.remove(currentObject);
        currentObject.geometry.dispose();
        if (currentObject.material !== material) {
          (currentObject.material as THREE.Material).dispose();
        }
      }

      let geometry: THREE.BufferGeometry;
      const objMaterial = material.clone();

      switch (type) {
        case 'Sphere':
          geometry = new THREE.SphereGeometry(3.5, 48, 48);
          objMaterial.color.set('#00d2ff');
          objMaterial.roughness = 0.15;
          objMaterial.metalness = 0.9;
          break;
        case 'Cube':
          geometry = new THREE.BoxGeometry(5.2, 5.2, 5.2);
          objMaterial.color.set('#ffd700');
          objMaterial.roughness = 0.3;
          objMaterial.metalness = 0.85;
          break;
        case 'Wing':
          geometry = createAirfoilGeometry();
          objMaterial.color.set('#1a1a24');
          objMaterial.roughness = 0.45;
          objMaterial.metalness = 0.95;
          break;
        case 'Car':
          geometry = createCarGeometry();
          objMaterial.color.set('#ff2e93');
          objMaterial.roughness = 0.12;
          objMaterial.metalness = 0.9;
          break;
        case 'FlatPlate':
          // MUCH thinner plate (0.08 total thickness)
          geometry = new THREE.BoxGeometry(0.08, 5.8, 5.8, 1, 1, 1);
          // Add beveling via EdgesGeometry alternative — use bevel settings
          {
            const plateShape = new THREE.Shape();
            plateShape.moveTo(-2.9, -0.04);
            plateShape.lineTo(2.9, -0.04);
            plateShape.lineTo(2.9, 0.04);
            plateShape.lineTo(-2.9, 0.04);
            plateShape.closePath();

            const plateExtrude = {
              depth: 5.8,
              bevelEnabled: true,
              bevelSegments: 3,
              steps: 1,
              bevelSize: 0.02,
              bevelThickness: 0.02,
            };
            geometry = new THREE.ExtrudeGeometry(plateShape, plateExtrude);
            geometry.center();
            // Rotate so the thin axis is X (flow direction)
            geometry.rotateZ(Math.PI / 2);
          }
          objMaterial.color.set('#8b5cf6');
          objMaterial.roughness = 0.25;
          objMaterial.metalness = 0.8;
          break;
        case 'Custom':
          geometry = new THREE.TorusGeometry(
            torusMajorRadiusRef.current,
            torusMinorRadiusRef.current,
            24, 80
          );
          objMaterial.color.set('#00ffcc');
          objMaterial.roughness = 0.1;
          objMaterial.metalness = 0.95;
          break;
        case 'GLBModel': {
          if (glbMeshRef.current) {
            currentObject = glbMeshRef.current.clone();
            currentObject.castShadow = true;
            currentObject.receiveShadow = true;
            obstaclePivot.add(currentObject);
            return;
          }
          // Fallback: sphere
          geometry = new THREE.SphereGeometry(3.5, 48, 48);
          objMaterial.color.set('#e0e0e0');
          break;
        }
        default:
          geometry = new THREE.SphereGeometry(3.5, 48, 48);
      }

      currentObject = new THREE.Mesh(geometry, objMaterial);
      currentObject.castShadow = true;
      currentObject.receiveShadow = true;

      // Align objects
      currentObject.rotation.set(0, 0, 0);
      if (type === 'Wing') {
        currentObject.rotation.y = Math.PI / 2; // spanwise along X
      } else if (type === 'Custom') {
        currentObject.rotation.x = Math.PI / 2; // face flow
      }

      obstaclePivot.add(currentObject);
    };

    updateObjectGeometryRef.current = updateObjectGeometry;
    updateObjectGeometry(activeObjectRef.current);

    // =====================================================================
    // Web Worker Setup (Particle Mode)
    // =====================================================================

    let worker: Worker | null = null;
    let workerBusy = false;
    let workerReady = false;

    // Double-buffer: buffer A and buffer B
    let bufferA = {
      positions: new Float32Array(0),
      velocities: new Float32Array(0),
      bases: new Float32Array(0),
      colors: new Float32Array(0),
    };
    let bufferB = {
      positions: new Float32Array(0),
      velocities: new Float32Array(0),
      bases: new Float32Array(0),
      colors: new Float32Array(0),
    };
    let useBufferA = true; // which buffer holds GPU-ready data
    let pendingWorkerResult = false;

    try {
      worker = new Worker(new URL('../cfdWorker.ts', import.meta.url), { type: 'module' });
      workerReady = true;

      worker.onmessage = (e) => {
        const msg = e.data;
        if (msg.type === 'result') {
          // Worker returned updated particle data
          if (useBufferA) {
            bufferB.positions = msg.positions;
            bufferB.velocities = msg.velocities;
            bufferB.bases = msg.bases;
            bufferB.colors = msg.colors;
          } else {
            bufferA.positions = msg.positions;
            bufferA.velocities = msg.velocities;
            bufferA.bases = msg.bases;
            bufferA.colors = msg.colors;
          }
          pendingWorkerResult = true;
          workerBusy = false;
        } else if (msg.type === 'respawn_result') {
          // Worker returned respawned particles
          bufferA.positions = msg.positions;
          bufferA.velocities = msg.velocities;
          bufferA.bases = msg.bases;
          bufferA.colors = msg.colors;
          // Clone for buffer B
          bufferB.positions = new Float32Array(msg.positions.length);
          bufferB.velocities = new Float32Array(msg.velocities.length);
          bufferB.bases = new Float32Array(msg.bases.length);
          bufferB.colors = new Float32Array(msg.colors.length);
          bufferB.positions.set(bufferA.positions);
          bufferB.velocities.set(bufferA.velocities);
          bufferB.bases.set(bufferA.bases);
          bufferB.colors.set(bufferA.colors);
          useBufferA = true;
          pendingWorkerResult = true;
          workerBusy = false;
        }
      };

      worker.onerror = (err) => {
        console.warn('[reFlow] Worker error, falling back to main thread:', err);
        workerReady = false;
        workerBusy = false;
      };
    } catch {
      console.warn('[reFlow] Worker creation failed, using main-thread fallback');
      workerReady = false;
    }

    // =====================================================================
    // Particles System Setup
    // =====================================================================

    let particlesGeo = new THREE.BufferGeometry();
    let positions = new Float32Array(0);
    let colors = new Float32Array(0);
    let bases = new Float32Array(0);
    let velocities = new Float32Array(0);
    let pointCloud: THREE.Points | null = null;

    const createCircleTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 16;
      canvas.height = 16;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.3, 'rgba(255,255,255,0.7)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 16, 16);
      }
      return new THREE.CanvasTexture(canvas);
    };

    const particleMaterial = new THREE.PointsMaterial({
      size: particleSizeRef.current,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      map: createCircleTexture(),
    });

    const spawnParticle = (i: number, isReset: boolean) => {
      const idx = i * 3;
      const sm = smokeModeRef.current;
      const is2DMode = is2DRef.current;

      const probe = probePointRef.current;
      const isProbeActive = probe && probe.active;
      const isProbeParticle = isProbeActive && i >= (particleCountRef.current - 1200);

      if (isProbeParticle && probe) {
        positions[idx] = probe.x + (Math.random() - 0.5) * 0.25;
        positions[idx + 1] = probe.y + (Math.random() - 0.5) * 0.25;
      } else if (sm === 'streamers') {
        if (is2DMode) {
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
        if (is2DMode) {
          positions[idx] = (Math.random() - 0.5) * 0.1;
        } else {
          positions[idx] = (Math.random() - 0.5) * TUNNEL_WIDTH;
        }
        positions[idx + 1] = (Math.random() - 0.5) * TUNNEL_HEIGHT;
      }

      positions[idx + 2] = isReset
        ? (Math.random() - 0.5) * TUNNEL_LENGTH
        : (TUNNEL_LENGTH / 2) + Math.random() * 8.0;

      bases[idx] = positions[idx];
      bases[idx + 1] = positions[idx + 1];
      bases[idx + 2] = positions[idx + 2];

      velocities[idx] = 0;
      velocities[idx + 1] = 0;
      velocities[idx + 2] = -flowSpeedRef.current;
    };

    const recreateParticles = () => {
      if (pointCloud) {
        scene.remove(pointCloud);
      }
      particlesGeo.dispose();

      const count = particleCountRef.current;
      particlesGeo = new THREE.BufferGeometry();
      positions = new Float32Array(count * 3);
      colors = new Float32Array(count * 3);
      bases = new Float32Array(count * 3);
      velocities = new Float32Array(count * 3);

      for (let i = 0; i < count; i++) {
        spawnParticle(i, true);
      }

      particlesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      particlesGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      pointCloud = new THREE.Points(particlesGeo, particleMaterial);
      scene.add(pointCloud);

      // Initialize worker double-buffers
      if (workerReady) {
        bufferA = {
          positions: new Float32Array(positions),
          velocities: new Float32Array(velocities),
          bases: new Float32Array(bases),
          colors: new Float32Array(colors),
        };
        bufferB = {
          positions: new Float32Array(count * 3),
          velocities: new Float32Array(count * 3),
          bases: new Float32Array(count * 3),
          colors: new Float32Array(count * 3),
        };
        bufferB.positions.set(positions);
        bufferB.velocities.set(velocities);
        bufferB.bases.set(bases);
        bufferB.colors.set(colors);
        useBufferA = true;
        workerBusy = false;
        pendingWorkerResult = false;
      }
    };

    recreateParticlesRef.current = recreateParticles;
    recreateParticles();

    // =====================================================================
    // Streamlines Setup
    // =====================================================================

    const MAX_STREAMLINES = 80;
    const MAX_LINE_STEPS = 140;
    const streamlinePoints = new Float32Array(MAX_STREAMLINES * MAX_LINE_STEPS * 2 * 3);
    const streamlineColors = new Float32Array(MAX_STREAMLINES * MAX_LINE_STEPS * 2 * 3);

    const streamlineGeo = new THREE.BufferGeometry();
    streamlineGeo.setAttribute('position', new THREE.BufferAttribute(streamlinePoints, 3));
    streamlineGeo.setAttribute('color', new THREE.BufferAttribute(streamlineColors, 3));

    const streamlineMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
    });
    const streamlinesMesh = new THREE.LineSegments(streamlineGeo, streamlineMat);
    scene.add(streamlinesMesh);

    // =====================================================================
    // Vector Field Setup
    // =====================================================================

    const shaftGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 5);
    shaftGeo.translate(0, 0.3, 0);
    shaftGeo.rotateX(Math.PI / 2);

    const vectorFieldGridX = 12;
    const vectorFieldGridY = 6;
    const vectorFieldGridZ = 16;
    const totalVectors = vectorFieldGridX * vectorFieldGridY * vectorFieldGridZ;
    const arrowMat = new THREE.MeshBasicMaterial({ color: '#7DF9FF', transparent: true, opacity: 0.4 });
    const vectorFieldMesh = new THREE.InstancedMesh(shaftGeo, arrowMat, totalVectors);
    scene.add(vectorFieldMesh);

    // Pre-allocate reusable objects for vector field rendering
    const vectorDummy = new THREE.Object3D();
    const vectorBaseColor = new THREE.Color('#38b000');
    const vectorFastColor = new THREE.Color('#7df9ff');
    const vectorCalcPos = new THREE.Vector3();
    const vectorCol = new THREE.Color();
    const vectorFlowVel = new THREE.Vector3();
    const vectorDirection = new THREE.Vector3();
    const vectorAlignQuat = new THREE.Quaternion();
    const vectorUpAxis = new THREE.Vector3(0, 0, 1);

    const vectorGridPositions: THREE.Vector3[] = [];
    const updateVectorGridPositions = (is2DMode: boolean) => {
      vectorGridPositions.length = 0;
      if (is2DMode) {
        const gridY = 24;
        const gridZ = 48;
        for (let y = 0; y < gridY; y++) {
          for (let z = 0; z < gridZ; z++) {
            const py = -9 + (y / (gridY - 1)) * 18;
            const pz = -28 + (z / (gridZ - 1)) * 56;
            vectorGridPositions.push(new THREE.Vector3(0, py, pz));
          }
        }
      } else {
        for (let x = 0; x < vectorFieldGridX; x++) {
          for (let y = 0; y < vectorFieldGridY; y++) {
            for (let z = 0; z < vectorFieldGridZ; z++) {
              const px = -18 + (x / (vectorFieldGridX - 1)) * 36;
              const py = -8 + (y / (vectorFieldGridY - 1)) * 16;
              const pz = -26 + (z / (vectorFieldGridZ - 1)) * 52;
              vectorGridPositions.push(new THREE.Vector3(px, py, pz));
            }
          }
        }
      }
    };
    updateVectorGridPositionsRef.current = updateVectorGridPositions;
    updateVectorGridPositions(is2DRef.current);

    // =====================================================================
    // Pressure Slice Heatmap Setup
    // =====================================================================

    const sliceWidth = 58;
    const sliceHeight = 18;
    const sliceSegmentsW = 50;
    const sliceSegmentsH = 20;
    const sliceGeo = new THREE.PlaneGeometry(sliceWidth, sliceHeight, sliceSegmentsW, sliceSegmentsH);
    sliceGeo.rotateY(Math.PI / 2);

    const sliceColorArray = new Float32Array(sliceGeo.attributes.position.count * 3);
    sliceGeo.setAttribute('color', new THREE.BufferAttribute(sliceColorArray, 3));

    const sliceMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.3,
      wireframe: false,
    });
    const sliceMesh = new THREE.Mesh(sliceGeo, sliceMat);
    scene.add(sliceMesh);

    // =====================================================================
    // Physics helper — builds PhysicsParams from refs
    // =====================================================================

    const buildPhysicsParams = (): PhysicsParams => ({
      flowSpeed: flowSpeedRef.current,
      viscosity: viscosityRef.current,
      angleOfAttackDeg: angleofAttackRef.current,
      activeObject: activeObjectRef.current,
      is2D: is2DRef.current,
      torusMajorR: torusMajorRadiusRef.current,
      torusMinorR: torusMinorRadiusRef.current,
    });

    // =====================================================================
    // Reset Action
    // =====================================================================

    const resetSimulation = () => {
      const count = particleCountRef.current;
      for (let i = 0; i < count; i++) {
        spawnParticle(i, true);
      }
      if (pointCloud) {
        pointCloud.geometry.attributes.position.needsUpdate = true;
      }
      // Re-init worker buffers
      if (workerReady) {
        bufferA.positions = new Float32Array(positions);
        bufferA.velocities = new Float32Array(velocities);
        bufferA.bases = new Float32Array(bases);
        bufferA.colors = new Float32Array(colors);
        bufferB.positions = new Float32Array(positions);
        bufferB.velocities = new Float32Array(velocities);
        bufferB.bases = new Float32Array(bases);
        bufferB.colors = new Float32Array(colors);
        workerBusy = false;
        pendingWorkerResult = false;
      }
    };
    resetSimulationRef.current = resetSimulation;

    // =====================================================================
    // Animation Simulation Loop
    // =====================================================================

    let animationFrameId: number;
    let frames = 0;
    let lastTime = performance.now();
    let lastFrameTime = performance.now();
    let accumulatedSimTime = 0;
    let maxFrameDuration = 0;

    // Pre-allocated temporaries for physics (main-thread fallback)
    const localPos: [number, number, number] = [0, 0, 0];
    const flowVelocity = new THREE.Vector3();
    const tempColor = new THREE.Color();
    const colorA = new THREE.Color();
    const colorB = new THREE.Color();
    const pressureColorHigh = new THREE.Color('#ff003c');
    const pressureColorMid = new THREE.Color('#3a86c8');
    const pressureColorLow = new THREE.Color('#ccff33');

    // Streamline temp vectors (allocated once)
    const tracePos = new THREE.Vector3();
    const traceLocalPos: [number, number, number] = [0, 0, 0];
    const nextTracePos = new THREE.Vector3();

    // Pressure temp vectors
    const sliceWorldPos = new THREE.Vector3();
    const sliceCol = new THREE.Color();

    /** Main-thread getFlowColor using THREE.Color */
    const getFlowColorThree = (ratio: number, theme: string, targetColor: THREE.Color) => {
      if (theme === 'fire') {
        if (ratio < 0.4) {
          colorA.set('#ff003c');
          colorB.set('#ff5e00');
          targetColor.lerpColors(colorA, colorB, ratio / 0.4);
        } else {
          colorA.set('#ff5e00');
          colorB.set('#ffd600');
          targetColor.lerpColors(colorA, colorB, (ratio - 0.4) / 0.6);
        }
      } else if (theme === 'emerald') {
        if (ratio < 0.5) {
          colorA.set('#004b23');
          colorB.set('#38b000');
          targetColor.lerpColors(colorA, colorB, ratio / 0.5);
        } else {
          colorA.set('#38b000');
          colorB.set('#ccff33');
          targetColor.lerpColors(colorA, colorB, (ratio - 0.5) / 0.5);
        }
      } else if (theme === 'plasma') {
        if (ratio < 0.5) {
          colorA.set('#3c096c');
          colorB.set('#ff00a0');
          targetColor.lerpColors(colorA, colorB, ratio / 0.5);
        } else {
          colorA.set('#ff00a0');
          colorB.set('#ffb3c1');
          targetColor.lerpColors(colorA, colorB, (ratio - 0.5) / 0.5);
        }
      } else {
        if (ratio < 0.5) {
          colorA.set('#002244');
          colorB.set('#0066cc');
          targetColor.lerpColors(colorA, colorB, ratio / 0.5);
        } else {
          colorA.set('#0066cc');
          colorB.set('#7df9ff');
          targetColor.lerpColors(colorA, colorB, (ratio - 0.5) / 0.5);
        }
      }
    };

    const animate = () => {
      const now = performance.now();
      const timeSec = now * 0.001;
      const frameDuration = now - lastFrameTime;
      const dt = Math.min(0.03, frameDuration * 0.001);
      lastFrameTime = now;
      frames++;

      if (frameDuration > maxFrameDuration) {
        maxFrameDuration = frameDuration;
      }

      const currentIsPaused = isPausedRef.current;

      // --- Stats Reporting ---
      if (now - lastTime >= 1000) {
        const fps = Math.round((frames * 1000) / (now - lastTime));
        const mem = (performance as any).memory
          ? Math.round((performance as any).memory.usedJSHeapSize / 1048576)
          : 0;

        const activeType = activeObjectRef.current;
        const alpha = angleofAttackRef.current;
        const speed = flowSpeedRef.current;
        const visc = viscosityRef.current;

        const reynolds = Math.round((speed * 8 * 1000) / Math.max(0.15, visc));

        let Cd = 0.5;
        let Cl = 0.0;
        let isStalled = false;

        if (activeType === 'Sphere') {
          Cd = 0.47;
        } else if (activeType === 'Cube') {
          Cd = 1.05;
        } else if (activeType === 'Car') {
          Cd = 0.28;
          Cl = -0.15 * speed;
        } else if (activeType === 'Custom') {
          Cd = 1.15;
        } else if (activeType === 'GLBModel') {
          Cd = 0.8; // Approximate for arbitrary model
        } else if (activeType === 'FlatPlate') {
          const rAlpha = (alpha * Math.PI) / 180;
          Cd = 0.08 + 1.95 * Math.sin(rAlpha) * Math.sin(rAlpha);
          Cl = 2.0 * Math.PI * Math.sin(rAlpha) * Math.cos(rAlpha);
        } else if (activeType === 'Wing') {
          const rAlpha = (alpha * Math.PI) / 180;
          const absAlpha = Math.abs(alpha);
          if (absAlpha > 15) {
            isStalled = true;
            const stallFactor = Math.max(0.2, 1.0 - 0.7 * ((absAlpha - 15) / 15));
            Cl = 2.0 * Math.PI * Math.sin((15 * Math.PI) / 180 * Math.sign(alpha)) * stallFactor;
            Cd = 0.012 + 0.08 * Math.pow(rAlpha, 2) + 0.22 * (absAlpha - 15) / 15;
          } else {
            Cl = 2.0 * Math.PI * rAlpha;
            Cd = 0.012 + 0.08 * Math.pow(rAlpha, 2);
          }
        }

        const area = 0.4;
        const airDensity = 1.225;
        const simulatedLift = Math.round(0.5 * airDensity * speed * speed * Cl * area * 100) / 10;
        const simulatedDrag = Math.round(0.5 * airDensity * speed * speed * Cd * area * 100) / 10;

        const avgSimTime = accumulatedSimTime / (frames || 1);
        const cpuLoad = Math.min(100, Math.round((avgSimTime / 16.67) * 100));

        const idealFrame = 1000 / (fps || 60);
        const fpsJitter = Math.max(0, maxFrameDuration - idealFrame);

        onStatsUpdate({
          fps,
          count: visualModeRef.current === 'particles' ? particleCountRef.current : 0,
          mem,
          reynolds,
          lift: simulatedLift,
          drag: simulatedDrag,
          liftCoeff: Math.round(Cl * 100) / 100,
          dragCoeff: Math.round(Cd * 100) / 100,
          isStalled,
          cpuLoad,
          avgSimTime: Math.round(avgSimTime * 100) / 100,
          fpsJitter: Math.round(fpsJitter * 100) / 100,
        });

        frames = 0;
        lastTime = now;
        accumulatedSimTime = 0;
        maxFrameDuration = 0;
      }

      // --- Sync obstacle pivot ---
      obstaclePivot.position.set(
        objectPositionRef.current.x,
        objectPositionRef.current.y,
        objectPositionRef.current.z
      );

      // Auto-rotation for some objects
      if (!currentIsPaused) {
        if (activeObjectRef.current === 'Cube') {
          currentObject!.rotation.x = timeSec * 0.1;
          currentObject!.rotation.y = timeSec * 0.15;
        } else if (activeObjectRef.current === 'Custom') {
          currentObject!.rotation.z = timeSec * 0.25;
        }
      }

      const activeType = activeObjectRef.current;
      const alphaDeg = angleofAttackRef.current;
      const theme = particleColorThemeRef.current;
      const visMode = visualModeRef.current;
      const angleRad = (alphaDeg * Math.PI) / 180;

      // Set obstacle angle of attack
      obstaclePivot.rotation.x = angleRad;

      // Visibility
      if (pointCloud) pointCloud.visible = visMode === 'particles';
      streamlinesMesh.visible = visMode === 'streamlines';
      vectorFieldMesh.visible = visMode === 'vectors';
      sliceMesh.visible = visMode === 'pressure';

      const simStart = performance.now();
      const params = buildPhysicsParams();
      const currentVoxelGrid = voxelGridRef.current || undefined;

      if (!currentIsPaused) {
        // =================================================================
        // PARTICLES MODE
        // =================================================================
        if (visMode === 'particles' && pointCloud) {
          particleMaterial.size = particleSizeRef.current;

          const pArr = particlesGeo.attributes.position.array as Float32Array;
          const cArr = particlesGeo.attributes.color.array as Float32Array;
          const count = particleCountRef.current;

          // --- Worker path ---
          if (workerReady && worker) {
            // If worker finished, upload results to GPU
            if (pendingWorkerResult) {
              const readBuf = useBufferA ? bufferA : bufferB;
              pArr.set(readBuf.positions);
              cArr.set(readBuf.colors);
              // Also sync velocities/bases for main-thread state
              velocities = readBuf.velocities;
              bases = readBuf.bases;
              // Flip buffer
              useBufferA = !useBufferA;
              pendingWorkerResult = false;

              particlesGeo.attributes.position.needsUpdate = true;
              particlesGeo.attributes.color.needsUpdate = true;
            }

            // Send next frame to worker if not busy
            if (!workerBusy) {
              const sendBuf = useBufferA ? bufferA : bufferB;
              // Copy current state to send buffer
              const sendPos = new Float32Array(sendBuf.positions.length);
              const sendVel = new Float32Array(sendBuf.velocities.length);
              const sendBas = new Float32Array(sendBuf.bases.length);
              const sendCol = new Float32Array(sendBuf.colors.length);
              sendPos.set(pArr);
              sendVel.set(velocities);
              sendBas.set(bases);
              sendCol.set(cArr);

              workerBusy = true;
              worker.postMessage({
                type: 'update',
                positions: sendPos,
                velocities: sendVel,
                bases: sendBas,
                colors: sendCol,
                params,
                objPos: objectPositionRef.current,
                time: timeSec,
                dt,
                particleCount: count,
                smokeMode: smokeModeRef.current,
                is2D: is2DRef.current,
                probePoint: probePointRef.current,
                tunnelLength: TUNNEL_LENGTH,
                tunnelWidth: TUNNEL_WIDTH,
                tunnelHeight: TUNNEL_HEIGHT,
                flowSpeed: flowSpeedRef.current,
                particleColorTheme: theme,
                voxelGrid: currentVoxelGrid,
              }, [sendPos.buffer, sendVel.buffer, sendBas.buffer, sendCol.buffer]);
            }
          }
          // --- Main-thread fallback ---
          else {
            const objPos = objectPositionRef.current;
            const FADE_ZONE = 8.0;

            for (let i = 0; i < count; i++) {
              const idx = i * 3;

              // Convert to local coords
              const [lx, ly, lz] = worldToLocal(
                pArr[idx], pArr[idx + 1], pArr[idx + 2],
                objPos.x, objPos.y, objPos.z, angleRad
              );

              let localX = lx, localY = ly, localZ = lz;

              // Collision
              const isInside = checkCollisionLocal(activeType, localX, localY, localZ, params, currentVoxelGrid);
              if (isInside) {
                const [px, py, pz] = projectCollisionLocal(activeType, localX, localY, localZ, params, currentVoxelGrid);
                localX = px; localY = py; localZ = pz;

                // Back to world
                const [wx, wy, wz] = localToWorldVec(localX, localY, localZ, angleRad);
                pArr[idx] = wx + objPos.x;
                pArr[idx + 1] = wy + objPos.y;
                pArr[idx + 2] = wz + objPos.z;

                // Bounce
                const [nx, ny, nz] = getNormalLocal(activeType, localX, localY, localZ, params, currentVoxelGrid);
                const [wnx, wny, wnz] = localToWorldVec(nx, ny, nz, angleRad);
                const nLen = Math.sqrt(wnx * wnx + wny * wny + wnz * wnz) || 1;
                const normX = wnx / nLen, normY = wny / nLen, normZ = wnz / nLen;

                const dotProd = velocities[idx] * normX + velocities[idx + 1] * normY + velocities[idx + 2] * normZ;
                if (dotProd < 0) {
                  velocities[idx] -= 1.35 * dotProd * normX;
                  velocities[idx + 1] -= 1.35 * dotProd * normY;
                  velocities[idx + 2] -= 1.35 * dotProd * normZ;
                  velocities[idx] += (Math.random() - 0.5) * 0.05 * flowSpeedRef.current;
                  velocities[idx + 1] += (Math.random() - 0.5) * 0.05 * flowSpeedRef.current;
                  velocities[idx + 2] += (Math.random() - 0.5) * 0.05 * flowSpeedRef.current;
                }
              }

              // Flow velocity
              const [flx, fly, flz] = getVelocityAtPoint(localX, localY, localZ, timeSec, params, currentVoxelGrid);
              const [fwx, fwy, fwz] = localToWorldVec(flx, fly, flz, angleRad);

              // Lerp
              const lerpFactor = 1.0 - Math.exp(-10.0 * dt);
              velocities[idx] += (fwx - velocities[idx]) * lerpFactor;
              velocities[idx + 1] += (fwy - velocities[idx + 1]) * lerpFactor;
              velocities[idx + 2] += (fwz - velocities[idx + 2]) * lerpFactor;

              // Apply
              const speedMultiplier = 12.0;
              pArr[idx] += velocities[idx] * speedMultiplier * dt;
              pArr[idx + 1] += velocities[idx + 1] * speedMultiplier * dt;
              pArr[idx + 2] += velocities[idx + 2] * speedMultiplier * dt;

              if (is2DRef.current) {
                pArr[idx] = 0;
                velocities[idx] = 0;
              }

              // Respawn
              if (pArr[idx + 2] < -TUNNEL_LENGTH / 2) {
                spawnParticle(i, false);
                pArr[idx] = positions[idx];
                pArr[idx + 1] = positions[idx + 1];
                pArr[idx + 2] = positions[idx + 2];
              }

              // Color
              const probe = probePointRef.current;
              const isProbeActive = probe && probe.active;
              const isProbeParticle = isProbeActive && i >= (count - 1200);

              if (isProbeParticle) {
                tempColor.set('#ff00ff');
              } else {
                const velLength = Math.sqrt(
                  velocities[idx] * velocities[idx] +
                  velocities[idx + 1] * velocities[idx + 1] +
                  velocities[idx + 2] * velocities[idx + 2]
                );
                const ratio = Math.min(1.0, velLength / (flowSpeedRef.current * 1.4));
                getFlowColorThree(ratio, theme, tempColor);
              }

              // Fade near inlet/outlet
              const pZ = pArr[idx + 2];
              let fade = 1.0;
              if (pZ > 30.0) {
                fade = 0.0;
              } else if (pZ > 30.0 - FADE_ZONE) {
                fade = (30.0 - pZ) / FADE_ZONE;
              } else if (pZ < -30.0) {
                fade = 0.0;
              } else if (pZ < -30.0 + FADE_ZONE) {
                fade = (pZ + 30.0) / FADE_ZONE;
              }

              cArr[idx] = tempColor.r * fade;
              cArr[idx + 1] = tempColor.g * fade;
              cArr[idx + 2] = tempColor.b * fade;
            }

            particlesGeo.attributes.position.needsUpdate = true;
            particlesGeo.attributes.color.needsUpdate = true;
          }
        }

        // =================================================================
        // STREAMLINES MODE
        // =================================================================
        else if (visMode === 'streamlines') {
          const is2DMode = is2DRef.current;
          const streamCountX = is2DMode ? 1 : 10;
          const streamCountY = is2DMode ? 18 : 6;

          let index = 0;
          const pArray = streamlineGeo.attributes.position.array as Float32Array;
          const cArray = streamlineGeo.attributes.color.array as Float32Array;

          const stepDt = 0.55;
          const objPos = objectPositionRef.current;

          for (let sx = 0; sx < streamCountX; sx++) {
            for (let sy = 0; sy < streamCountY; sy++) {
              const seedX = is2DMode ? 0 : (streamCountX > 1 ? -16 + (sx / (streamCountX - 1)) * 32 : 0);
              const seedY = streamCountY > 1 ? -7.5 + (sy / (streamCountY - 1)) * 15.0 : 0;

              tracePos.set(seedX, seedY, 28);

              for (let step = 0; step < MAX_LINE_STEPS; step++) {
                // Convert to local
                const [tlx, tly, tlz] = worldToLocal(
                  tracePos.x, tracePos.y, tracePos.z,
                  objPos.x, objPos.y, objPos.z, angleRad
                );

                const inside = checkCollisionLocal(activeType, tlx, tly, tlz, params, currentVoxelGrid);
                if (inside) break;

                // Sample velocity
                const [vlx, vly, vlz] = getVelocityAtPoint(tlx, tly, tlz, timeSec, params, currentVoxelGrid);
                const [wvx, wvy, wvz] = localToWorldVec(vlx, vly, vlz, angleRad);

                flowVelocity.set(wvx, wvy, wvz);

                nextTracePos.copy(tracePos).addScaledVector(flowVelocity, stepDt);

                const pIdx = index * 6;
                pArray[pIdx] = tracePos.x;
                pArray[pIdx + 1] = tracePos.y;
                pArray[pIdx + 2] = tracePos.z;
                pArray[pIdx + 3] = nextTracePos.x;
                pArray[pIdx + 4] = nextTracePos.y;
                pArray[pIdx + 5] = nextTracePos.z;

                const speed = flowVelocity.length();
                const ratio = Math.min(1.0, speed / (flowSpeedRef.current * 1.5));
                getFlowColorThree(ratio, theme, tempColor);

                const cIdx = index * 6;
                cArray[cIdx] = tempColor.r;
                cArray[cIdx + 1] = tempColor.g;
                cArray[cIdx + 2] = tempColor.b;
                cArray[cIdx + 3] = tempColor.r;
                cArray[cIdx + 4] = tempColor.g;
                cArray[cIdx + 5] = tempColor.b;

                index++;
                tracePos.copy(nextTracePos);

                if (tracePos.z < -28 || Math.abs(tracePos.x) > 20 || Math.abs(tracePos.y) > 10) break;
              }
            }
          }

          streamlineGeo.setDrawRange(0, index * 2);
          streamlineGeo.attributes.position.needsUpdate = true;
          streamlineGeo.attributes.color.needsUpdate = true;
        }

        // =================================================================
        // VECTOR FIELD MODE
        // =================================================================
        else if (visMode === 'vectors') {
          const objPos = objectPositionRef.current;

          for (let i = 0; i < totalVectors; i++) {
            const gridPos = vectorGridPositions[i];
            if (!gridPos) continue;

            // Convert to local
            const [vlx, vly, vlz] = worldToLocal(
              gridPos.x, gridPos.y, gridPos.z,
              objPos.x, objPos.y, objPos.z, angleRad
            );

            const [fvx, fvy, fvz] = getVelocityAtPoint(vlx, vly, vlz, timeSec, params, currentVoxelGrid);
            const [wvx, wvy, wvz] = localToWorldVec(fvx, fvy, fvz, angleRad);
            vectorFlowVel.set(wvx, wvy, wvz);

            const speed = vectorFlowVel.length();
            const speedRatio = Math.min(1.0, speed / (flowSpeedRef.current * 1.5));

            vectorDummy.position.copy(gridPos);

            if (speed > 0.05) {
              vectorDirection.copy(vectorFlowVel).normalize();
              vectorAlignQuat.setFromUnitVectors(vectorUpAxis, vectorDirection);
              vectorDummy.quaternion.copy(vectorAlignQuat);
              vectorDummy.scale.set(1, 1, 0.4 + speedRatio * 1.6);
            } else {
              vectorDummy.scale.set(0.001, 0.001, 0.001);
            }

            vectorDummy.updateMatrix();
            vectorFieldMesh.setMatrixAt(i, vectorDummy.matrix);

            vectorCol.lerpColors(vectorBaseColor, vectorFastColor, speedRatio);
            vectorFieldMesh.setColorAt(i, vectorCol);
          }

          vectorFieldMesh.instanceMatrix.needsUpdate = true;
          if (vectorFieldMesh.instanceColor) {
            vectorFieldMesh.instanceColor.needsUpdate = true;
          }
        }

        // =================================================================
        // PRESSURE CONTOURS MODE
        // =================================================================
        else if (visMode === 'pressure') {
          if (!optimizeRenderRef.current || frames % 2 === 0) {
            const posAttr = sliceGeo.attributes.position;
            const colorAttr = sliceGeo.attributes.color;
            const vCount = posAttr.count;
            const objPos = objectPositionRef.current;

            for (let i = 0; i < vCount; i++) {
              sliceWorldPos.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));

              const [slx, sly, slz] = worldToLocal(
                sliceWorldPos.x, sliceWorldPos.y, sliceWorldPos.z,
                objPos.x, objPos.y, objPos.z, angleRad
              );

              const inside = checkCollisionLocal(activeType, slx, sly, slz, params, currentVoxelGrid);
              if (inside) {
                colorAttr.setXYZ(i, 0.08, 0.08, 0.12);
                continue;
              }

              const [pvx, pvy, pvz] = getVelocityAtPoint(slx, sly, slz, timeSec, params, currentVoxelGrid);
              const speed = Math.sqrt(pvx * pvx + pvy * pvy + pvz * pvz);
              const nominalSpeed = flowSpeedRef.current;

              const ratio = (speed * speed) / (nominalSpeed * nominalSpeed + 0.1);

              if (ratio < 0.8) {
                const factor = Math.max(0, ratio / 0.8);
                sliceCol.lerpColors(pressureColorHigh, pressureColorMid, 1.0 - factor);
              } else {
                const factor = Math.min(1.0, (ratio - 0.8) / 1.5);
                sliceCol.lerpColors(pressureColorMid, pressureColorLow, factor);
              }

              colorAttr.setXYZ(i, sliceCol.r, sliceCol.g, sliceCol.b);
            }
            colorAttr.needsUpdate = true;
          }
        }
      }

      const simEnd = performance.now();
      accumulatedSimTime += (simEnd - simStart);

      // --- Probe marker ---
      const probe = probePointRef.current;
      if (probe && probe.active) {
        probeMarker.position.set(probe.x, probe.y, 0);
        probeMarker.visible = true;
        const pulse = 1.0 + 0.15 * Math.sin(timeSec * 8);
        probeMarker.scale.set(pulse, pulse, pulse);
      } else {
        probeMarker.visible = false;
      }

      // --- Ambient dust drift ---
      if (!currentIsPaused) {
        const dustArr = dustGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < dustCount; i++) {
          const idx = i * 3;
          dustArr[idx + 2] -= flowSpeedRef.current * 0.18;
          if (dustArr[idx + 2] < -TUNNEL_LENGTH / 2) {
            dustArr[idx + 2] = TUNNEL_LENGTH / 2;
            dustArr[idx] = (Math.random() - 0.5) * TUNNEL_WIDTH;
            dustArr[idx + 1] = (Math.random() - 0.5) * TUNNEL_HEIGHT;
          }
        }
        dustGeo.attributes.position.needsUpdate = true;
      }

      controls.update();
      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    // =====================================================================
    // Interactive Mouse Probe Trigger
    // =====================================================================

    const handleDoubleClick = (event: MouseEvent) => {
      if (!renderer || !camera) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

      const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      const intersectionPoint = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(planeZ, intersectionPoint)) {
        if (Math.abs(intersectionPoint.x) < 20 && Math.abs(intersectionPoint.y) < 10) {
          if (onProbePlacedRef.current) {
            onProbePlacedRef.current(intersectionPoint.x, intersectionPoint.y);
          }
        }
      }
    };
    renderer.domElement.addEventListener('dblclick', handleDoubleClick);

    // =====================================================================
    // Screenshot Capture Service
    // =====================================================================

    const handleCapture = () => {
      if (!renderer) return;
      renderer.render(scene, camera);
      const dataUrl = renderer.domElement.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `reFlow-capture-${activeObjectRef.current}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    };
    window.addEventListener('reflow-capture-screenshot', handleCapture);

    // =====================================================================
    // Cleanup & Resize Events
    // =====================================================================

    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('dblclick', handleDoubleClick);
      window.removeEventListener('reflow-capture-screenshot', handleCapture);
      cancelAnimationFrame(animationFrameId);

      // Terminate worker
      if (worker) {
        worker.terminate();
        worker = null;
      }

      if (mountRef.current) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      particlesGeo.dispose();
      particleMaterial.dispose();
      streamlineGeo.dispose();
      streamlineMat.dispose();
      shaftGeo.dispose();
      arrowMat.dispose();
      vectorFieldMesh.dispose();
      sliceGeo.dispose();
      sliceMat.dispose();
      probeMarkerGeo.dispose();
      probeMarkerMat.dispose();
      screenGeo.dispose();
      screenMat.dispose();
      dustGeo.dispose();
      dustMat.dispose();
    };
    // Run once on mount! All dynamically changing elements are controlled via react refs or child useEffects
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mountRef} className="w-full h-full relative" />;
}
