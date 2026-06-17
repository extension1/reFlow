import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

interface WindTunnelProps {
  viscosity: number;
  flowSpeed: number;
  activeObject: string;
  angleofAttack: number; // in degrees (-45 to 45)
  visualMode: 'particles' | 'streamlines' | 'vectors' | 'pressure';
  particleCount: number;
  particleSize: number;
  particleColorTheme: 'cyan' | 'fire' | 'emerald' | 'plasma';
  smokeMode: 'streamers' | 'uniform';
  objectPosition: { x: number; y: number; z: number };
  onStatsUpdate: (stats: any) => void;
  resetTrigger: number;
}

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
}: WindTunnelProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  // Use refs for parameters updated in the render loop to prevent re-creating the WebGL context
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
  }, [viscosity, flowSpeed, angleofAttack, visualMode, particleSize, particleColorTheme, smokeMode, objectPosition]);

  // Keep functions to rebuild components dynamically without restarting the whole engine
  const updateObjectGeometryRef = useRef<(type: string) => void>(() => {});
  const recreateParticlesRef = useRef<() => void>(() => {});
  const resetSimulationRef = useRef<() => void>(() => {});

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
    if (!mountRef.current) return;

    // --- Scene Setup ---
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0b0b0f');
    scene.fog = new THREE.FogExp2('#0b0b0f', 0.012);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(22, 12, 28);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.1; // Limit panning under floor

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

    // --- Obstacle Setup ---
    const obstaclePivot = new THREE.Group();
    scene.add(obstaclePivot);

    const material = new THREE.MeshStandardMaterial({
      color: '#2b363c',
      roughness: 0.25,
      metalness: 0.85,
      wireframe: false,
    });

    const createAirfoilGeometry = () => {
      const shape = new THREE.Shape();
      const steps = 40;
      const chord = 8;
      const thickness = 0.12;

      const upperPoints: THREE.Vector2[] = [];
      const lowerPoints: THREE.Vector2[] = [];

      for (let i = 0; i <= steps; i++) {
        const s = i / steps; // 0 = leading edge, 1 = trailing edge
        const yt = 5 * thickness * (
          0.2969 * Math.sqrt(s) -
          0.1260 * s -
          0.3516 * s * s +
          0.2843 * Math.pow(s, 3) -
          0.1015 * Math.pow(s, 4)
        ) * chord;

        const x_chord = 4 - s * chord; // +4 to -4
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
        bevelThickness: 0.1
      };
      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      geometry.center();
      return geometry;
    };

    const createCarGeometry = () => {
      const shape = new THREE.Shape();
      shape.moveTo(-5.2, -1.2);
      shape.lineTo(5.2, -1.2);
      shape.lineTo(5.2, -0.6);
      shape.lineTo(5.0, 0.4);
      shape.lineTo(4.2, 0.5);
      shape.lineTo(4.3, 0.9);
      shape.lineTo(3.9, 0.9);
      shape.lineTo(3.2, 0.4);
      shape.lineTo(1.8, 1.4);
      shape.lineTo(-0.8, 1.4);
      shape.lineTo(-2.2, 0.2);
      shape.lineTo(-4.5, -0.2);
      shape.lineTo(-5.2, -0.8);
      shape.closePath();

      const extrudeSettings = {
        depth: 4.8,
        bevelEnabled: true,
        bevelSegments: 4,
        steps: 1,
        bevelSize: 0.15,
        bevelThickness: 0.15
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
      }

      let geometry: THREE.BufferGeometry;
      switch (type) {
        case 'Sphere':
          geometry = new THREE.SphereGeometry(3.5, 48, 48);
          break;
        case 'Cube':
          geometry = new THREE.BoxGeometry(5.2, 5.2, 5.2);
          break;
        case 'Wing':
          geometry = createAirfoilGeometry();
          break;
        case 'Car':
          geometry = createCarGeometry();
          break;
        case 'FlatPlate':
          geometry = new THREE.BoxGeometry(0.3, 5.8, 5.8);
          break;
        case 'Custom':
          geometry = new THREE.TorusGeometry(3.2, 1.0, 24, 80);
          break;
        default:
          geometry = new THREE.SphereGeometry(3.5, 48, 48);
      }

      currentObject = new THREE.Mesh(geometry, material);
      currentObject.castShadow = true;
      currentObject.receiveShadow = true;

      // Align objects:
      currentObject.rotation.set(0, 0, 0);
      if (type === 'Wing') {
        currentObject.rotation.y = Math.PI / 2; // spanwise along X
      } else if (type === 'Custom') {
        currentObject.rotation.x = Math.PI / 2; // Lie flat or face flow
      }

      obstaclePivot.add(currentObject);
    };

    updateObjectGeometryRef.current = updateObjectGeometry;
    updateObjectGeometry(activeObjectRef.current);

    // --- Particles System Setup ---
    let particlesGeo = new THREE.BufferGeometry();
    let positions = new Float32Array(0);
    let colors = new Float32Array(0);
    let bases = new Float32Array(0);
    let velocities = new Float32Array(0);
    let pointCloud: THREE.Points | null = null;

    const TUNNEL_WIDTH = 40;
    const TUNNEL_HEIGHT = 20;
    const TUNNEL_LENGTH = 60;

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

      if (sm === 'streamers') {
        // Streamer smoke tubes
        const streamCountX = 11;
        const streamCountY = 7;
        const sx = Math.floor(Math.random() * streamCountX);
        const sy = Math.floor(Math.random() * streamCountY);
        // Map to coordinates with small random perturbation
        positions[idx] = -15 + (sx / (streamCountX - 1)) * 30 + (Math.random() - 0.5) * 0.25;
        positions[idx + 1] = -7 + (sy / (streamCountY - 1)) * 14 + (Math.random() - 0.5) * 0.25;
      } else {
        // Uniform flow
        positions[idx] = (Math.random() - 0.5) * TUNNEL_WIDTH;
        positions[idx + 1] = (Math.random() - 0.5) * TUNNEL_HEIGHT;
      }

      positions[idx + 2] = isReset ? (Math.random() - 0.5) * TUNNEL_LENGTH : TUNNEL_LENGTH / 2;

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
    };

    recreateParticlesRef.current = recreateParticles;
    recreateParticles();

    // --- Streamlines Setup ---
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

    // --- Vector Field Setup ---
    // Create an InstancedMesh of arrows.
    // Base geometry: A simple cylinder for shaft and cone for pointer.
    const shaftGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 5);
    shaftGeo.translate(0, 0.3, 0); // shift pivot to base
    shaftGeo.rotateX(Math.PI / 2); // align with Z-axis
    
    const vectorFieldGridX = 12;
    const vectorFieldGridY = 6;
    const vectorFieldGridZ = 16;
    const totalVectors = vectorFieldGridX * vectorFieldGridY * vectorFieldGridZ;
    const arrowMat = new THREE.MeshBasicMaterial({ color: '#7DF9FF', transparent: true, opacity: 0.4 });
    const vectorFieldMesh = new THREE.InstancedMesh(shaftGeo, arrowMat, totalVectors);
    scene.add(vectorFieldMesh);

    // Pre-calculate vector field positions
    const vectorGridPositions: THREE.Vector3[] = [];
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

    // --- Pressure Slice Heatmap Setup ---
    const sliceWidth = 58;
    const sliceHeight = 18;
    const sliceSegmentsW = 50;
    const sliceSegmentsH = 20;
    const sliceGeo = new THREE.PlaneGeometry(sliceWidth, sliceHeight, sliceSegmentsW, sliceSegmentsH);
    // Rotate to lie vertically in Y-Z plane
    sliceGeo.rotateY(Math.PI / 2);
    
    // Create vertex colors array
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

    // --- Physics Model Analytical Functions ---

    // Collision Check: Checks if local coordinate is inside shape
    const checkCollisionLocal = (type: string, x: number, y: number, z: number) => {
      switch (type) {
        case 'Sphere': {
          return (x * x + y * y + z * z) < 12.25; // radius = 3.5
        }
        case 'Cube': {
          return Math.abs(x) < 2.6 && Math.abs(y) < 2.6 && Math.abs(z) < 2.6;
        }
        case 'Wing': {
          if (Math.abs(z) > 6) return false;
          if (x < -4 || x > 4) return false;
          const s = (4 - x) / 8; // normalized chord
          const yt = 5 * 0.12 * (
            0.2969 * Math.sqrt(s) -
            0.1260 * s -
            0.3516 * s * s +
            0.2843 * Math.pow(s, 3) -
            0.1015 * Math.pow(s, 4)
          ) * 8;
          return Math.abs(y) < yt;
        }
        case 'Custom': { // Torus in local X-Y plane
          const R = 3.2, r = 1.0;
          const dXY = Math.sqrt(x * x + y * y);
          const distSq = (dXY - R) * (dXY - R) + z * z;
          return distSq < r * r;
        }
        case 'Car': {
          if (Math.abs(z) > 2.4) return false;
          if (x < -5.2 || x > 5.2) return false;
          if (y < -1.2 || y > 1.4) return false;
          // Profile check
          if (y < -1.2) return false;
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
        case 'FlatPlate': {
          return Math.abs(x) < 0.15 && Math.abs(y) < 2.9 && Math.abs(z) < 2.9;
        }
        default:
          return false;
      }
    };

    // Project particle out of obstacle in local coordinates
    const projectCollisionLocal = (type: string, x: number, y: number, z: number, outPos: THREE.Vector3) => {
      outPos.set(x, y, z);
      switch (type) {
        case 'Sphere': {
          const dist = Math.sqrt(x * x + y * y + z * z);
          if (dist < 3.5) {
            const factor = 3.51 / (dist + 0.001);
            outPos.set(x * factor, y * factor, z * factor);
          }
          break;
        }
        case 'Cube': {
          const dx = 2.6 - Math.abs(x);
          const dy = 2.6 - Math.abs(y);
          const dz = 2.6 - Math.abs(z);
          const min = Math.min(dx, dy, dz);
          if (min === dx) outPos.x = Math.sign(x) * 2.62;
          else if (min === dy) outPos.y = Math.sign(y) * 2.62;
          else outPos.z = Math.sign(z) * 2.62;
          break;
        }
        case 'Wing': {
          if (Math.abs(z) > 6) return;
          if (x < -4 || x > 4) return;
          const s = (4 - x) / 8;
          const yt = 5 * 0.12 * (
            0.2969 * Math.sqrt(s) -
            0.1260 * s -
            0.3516 * s * s +
            0.2843 * Math.pow(s, 3) -
            0.1015 * Math.pow(s, 4)
          ) * 8;
          if (Math.abs(y) < yt) {
            outPos.y = Math.sign(y) * (yt + 0.02);
          }
          break;
        }
        case 'Custom': {
          const R = 3.2, r = 1.0;
          const dXY = Math.sqrt(x * x + y * y);
          const angle = Math.atan2(y, x);
          const tubeX = Math.cos(angle) * R;
          const tubeY = Math.sin(angle) * R;
          const dist = Math.sqrt((x - tubeX) * (x - tubeX) + (y - tubeY) * (y - tubeY) + z * z);
          if (dist < r) {
            const factor = 1.02 / (dist + 0.001);
            outPos.x = tubeX + (x - tubeX) * factor;
            outPos.y = tubeY + (y - tubeY) * factor;
            outPos.z = z * factor;
          }
          break;
        }
        case 'Car': {
          if (Math.abs(z) > 2.4) return;
          // Push vertically upwards out of the profile
          if (x >= -5.2 && x <= 5.2 && y >= -1.2 && y <= 1.4) {
            let yBound = -1.2;
            if (x < 0) {
              if (x < -4.5) {
                const t = (x - (-5.2)) / 0.7;
                yBound = -0.8 + t * 0.6;
              } else if (x < -2.2) {
                const t = (x - (-4.5)) / 2.3;
                yBound = -0.2 + t * 0.4;
              } else {
                const t = (x - (-2.2)) / 1.4;
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
              outPos.y = yBound + 0.03;
            }
          }
          break;
        }
        case 'FlatPlate': {
          outPos.x = Math.sign(x) * 0.17;
          break;
        }
      }
    };

    // Calculate potential flow + turbulence in local coordinate system
    const localVelTemp = new THREE.Vector3();
    const getVelocityAtPoint = (pos: THREE.Vector3, time: number) => {
      const x = pos.x;
      const y = pos.y;
      const z = pos.z;

      const activeType = activeObjectRef.current;
      const alphaDeg = angleofAttackRef.current;
      const alpha = (alphaDeg * Math.PI) / 180;
      const U = flowSpeedRef.current;
      const visc = viscosityRef.current;

      // Local uniform flow velocity (rotated)
      // Since world wind is from +Z (Z=30) to -Z (Z=-30), world speed vector is (0, 0, -U).
      // When local system is rotated by +alpha around X axis:
      // U_local = (0, U * sin(alpha), -U * cos(alpha))
      const U_x = 0;
      const U_y = U * Math.sin(alpha);
      const U_z = -U * Math.cos(alpha);

      localVelTemp.set(U_x, U_y, U_z);

      // Deflection based on object potential flow models
      if (activeType === 'Sphere' || activeType === 'Cube' || activeType === 'Car') {
        // Model with 3D sphere flow
        const R = activeType === 'Sphere' ? 3.5 : activeType === 'Cube' ? 3.2 : 3.8;
        const rSq = x * x + y * y + z * z;
        const r = Math.sqrt(rSq);
        if (r > R) {
          const dot = (U_x * x + U_y * y + U_z * z) / r;
          const factor = (R * R * R) / (2 * r * r * r);
          localVelTemp.x -= factor * (U_x - 3 * dot * x / r);
          localVelTemp.y -= factor * (U_y - 3 * dot * y / r);
          localVelTemp.z -= factor * (U_z - 3 * dot * z / r);
        } else {
          localVelTemp.set(0, 0, 0);
        }
      } else if (activeType === 'Wing' || activeType === 'FlatPlate' || activeType === 'Custom') {
        // Model with 2D cylinder flow in the Y-Z plane + Circulation (lift)
        const R = activeType === 'Wing' ? 2.2 : activeType === 'FlatPlate' ? 2.5 : 2.0;
        const r2dSq = y * y + z * z;
        const r2d = Math.sqrt(r2dSq);

        if (r2d > R) {
          // Doublet (symmetric deflection)
          const dot = (U_y * y + U_z * z) / r2d;
          const factor = (R * R) / r2dSq;
          const vy_doublet = -factor * (U_y - 2 * dot * y / r2d);
          const vz_doublet = -factor * (U_z - 2 * dot * z / r2d);

          // Circulation (lift)
          // Kutta circulation: Gamma = 4 * pi * U * R * sin(alpha)
          let stallFactor = 1.0;
          const absAlpha = Math.abs(alpha);
          const stallAngle = (15 * Math.PI) / 180;
          if (absAlpha > stallAngle) {
            // Drop lift past stall angle
            stallFactor = Math.max(0.2, 1.0 - 0.7 * ((absAlpha - stallAngle) / stallAngle));
          }

          const Gamma = 4.0 * Math.PI * U * R * Math.sin(alpha) * stallFactor;
          const circFactor = Gamma / (2 * Math.PI * r2d);
          // Clockwise rotation
          const vy_circ = circFactor * (z / r2d);
          const vz_circ = circFactor * (-y / r2d);

          localVelTemp.y += vy_doublet + vy_circ;
          localVelTemp.z += vz_doublet + vz_circ;
        } else {
          localVelTemp.set(0, 0, 0);
        }
      }

      // --- Turbulent Wake Model ---
      // Realized downstream of obstacle (z < 0)
      if (z < 0) {
        let wakeRadius = 4.2 + 0.15 * (-z);
        if (activeType === 'Wing') wakeRadius = 1.8 + 0.22 * (-z);
        else if (activeType === 'FlatPlate') wakeRadius = 3.5 + 0.3 * (-z);
        else if (activeType === 'Car') wakeRadius = 2.4 + 0.1 * (-z);

        const latDist = activeType === 'Sphere' || activeType === 'Cube'
          ? Math.sqrt(x * x + y * y)
          : Math.abs(y);

        if (latDist < wakeRadius) {
          const inWakeFactor = 1.0 - latDist / wakeRadius; // 1 at center, 0 at edge
          
          // Speed deficit (drag shadow)
          localVelTemp.z *= (1.0 - 0.65 * inWakeFactor);

          // Viscosity dictates turbulence level (Low viscosity = High Reynolds = Highly turbulent)
          // Scale from 0 (very viscous, laminar) to 1 (fluid, turbulent)
          const turbulenceIntensity = Math.max(0, 1.0 - visc / 10.0);
          
          if (turbulenceIntensity > 0) {
            // Expand wake size under stall conditions
            const isStalled = activeType === 'Wing' && Math.abs(alphaDeg) > 15;
            const stallMult = isStalled ? 2.0 : 1.0;

            const speedScale = localVelTemp.length();
            const noiseAmp = speedScale * 0.7 * inWakeFactor * turbulenceIntensity * stallMult;

            // Fast procedural sine waves for advecting eddy simulation
            const advectZ = z + time * U * 8.0;
            const turbX = Math.sin(x * 1.5) * Math.cos(y * 1.2 + advectZ * 0.5) * noiseAmp * 0.5;
            const turbY = Math.sin(y * 1.5 + advectZ * 0.4) * Math.cos(x * 1.1) * noiseAmp;
            const turbZ = Math.cos(x * 0.9 - advectZ * 0.3) * Math.sin(y * 1.1) * noiseAmp * 0.3;

            localVelTemp.x += turbX;
            localVelTemp.y += turbY;
            localVelTemp.z += turbZ;
          }
        }
      }

      return localVelTemp;
    };

    // --- Reset Action ---
    const resetSimulation = () => {
      const count = particleCountRef.current;
      for (let i = 0; i < count; i++) {
        spawnParticle(i, true);
      }
      if (pointCloud) {
        pointCloud.geometry.attributes.position.needsUpdate = true;
      }
    };
    resetSimulationRef.current = resetSimulation;

    // --- Animation Simulation Loop ---
    let animationFrameId: number;
    let frames = 0;
    let lastTime = performance.now();
    
    // Theme color palettes
    const getFlowColor = (ratio: number, theme: string) => {
      const color = new THREE.Color();
      if (theme === 'fire') {
        // Yellow -> Orange -> Deep Red
        if (ratio < 0.4) {
          color.lerpColors(new THREE.Color('#ff003c'), new THREE.Color('#ff5e00'), ratio / 0.4);
        } else {
          color.lerpColors(new THREE.Color('#ff5e00'), new THREE.Color('#ffd600'), (ratio - 0.4) / 0.6);
        }
      } else if (theme === 'emerald') {
        // Dark Forest Green -> Mint -> Bright Cyan
        if (ratio < 0.5) {
          color.lerpColors(new THREE.Color('#004b23'), new THREE.Color('#38b000'), ratio / 0.5);
        } else {
          color.lerpColors(new THREE.Color('#38b000'), new THREE.Color('#ccff33'), (ratio - 0.5) / 0.5);
        }
      } else if (theme === 'plasma') {
        // Deep Indigo -> Fuchsia -> Glowing White
        if (ratio < 0.5) {
          color.lerpColors(new THREE.Color('#3c096c'), new THREE.Color('#ff00a0'), ratio / 0.5);
        } else {
          color.lerpColors(new THREE.Color('#ff00a0'), new THREE.Color('#ffb3c1'), (ratio - 0.5) / 0.5);
        }
      } else {
        // Standard neon cyan theme
        // Dark Blue -> Bright Blue -> Vibrant Cyan
        if (ratio < 0.5) {
          color.lerpColors(new THREE.Color('#002244'), new THREE.Color('#0066cc'), ratio / 0.5);
        } else {
          color.lerpColors(new THREE.Color('#0066cc'), new THREE.Color('#7df9ff'), (ratio - 0.5) / 0.5);
        }
      }
      return color;
    };

    const localPos = new THREE.Vector3();
    const outPos = new THREE.Vector3();
    const flowVelocity = new THREE.Vector3();

    const animate = () => {
      const now = performance.now();
      const timeSec = now * 0.001;
      frames++;

      // Stats and Physics output telemetry
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

        // Compute lift and drag forces based on shapes
        let Cd = 0.5;
        let Cl = 0.0;
        let isStalled = false;

        if (activeType === 'Sphere') {
          Cd = 0.47;
        } else if (activeType === 'Cube') {
          Cd = 1.05;
        } else if (activeType === 'Car') {
          Cd = 0.28;
          Cl = -0.15 * speed; // Negative lift (downforce)
        } else if (activeType === 'Custom') {
          Cd = 1.15;
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
        });

        frames = 0;
        lastTime = now;
      }

      // Sync obstacle pivot position & rotation in real-time
      obstaclePivot.position.set(objectPositionRef.current.x, objectPositionRef.current.y, objectPositionRef.current.z);
      
      // Auto-rotation trigger for Custom (Torus) or general slight animation
      if (activeObjectRef.current === 'Cube') {
        currentObject!.rotation.x = timeSec * 0.1;
        currentObject!.rotation.y = timeSec * 0.15;
      } else if (activeObjectRef.current === 'Custom') {
        currentObject!.rotation.z = timeSec * 0.25;
      }

      const activeType = activeObjectRef.current;
      const alphaDeg = angleofAttackRef.current;
      const theme = particleColorThemeRef.current;
      const visMode = visualModeRef.current;

      // Make pivot reflect the manual angle of attack (rotation about global X axis)
      obstaclePivot.rotation.x = (alphaDeg * Math.PI) / 180;

      // Dynamic WebGL element visibility based on selected visual mode
      if (pointCloud) pointCloud.visible = visMode === 'particles';
      streamlinesMesh.visible = visMode === 'streamlines';
      vectorFieldMesh.visible = visMode === 'vectors';
      sliceMesh.visible = visMode === 'pressure';

      // --- Render Mode: PARTICLES ---
      if (visMode === 'particles' && pointCloud) {
        // Adjust particle point sizes in real-time
        particleMaterial.size = particleSizeRef.current;
        
        const pArr = particlesGeo.attributes.position.array as Float32Array;
        const cArr = particlesGeo.attributes.color.array as Float32Array;
        const count = particleCountRef.current;

        for (let i = 0; i < count; i++) {
          const idx = i * 3;

          // Convert particle position into local coordinate frame
          localPos.set(pArr[idx], pArr[idx + 1], pArr[idx + 2]);
          obstaclePivot.worldToLocal(localPos);

          // Check for collision and project out if inside
          const isInside = checkCollisionLocal(activeType, localPos.x, localPos.y, localPos.z);
          if (isInside) {
            projectCollisionLocal(activeType, localPos.x, localPos.y, localPos.z, outPos);
            localPos.copy(outPos);
            obstaclePivot.localToWorld(localPos);
            pArr[idx] = localPos.x;
            pArr[idx + 1] = localPos.y;
            pArr[idx + 2] = localPos.z;

            // Reset particle velocities upon boundary friction
            velocities[idx] *= 0.1;
            velocities[idx + 1] *= 0.1;
            velocities[idx + 2] *= 0.1;
          }

          // Evaluate fluid vector field velocity at local particle position
          const localVel = getVelocityAtPoint(localPos, timeSec);

          // Convert local velocity back to world space
          flowVelocity.copy(localVel).applyQuaternion(obstaclePivot.quaternion);

          // Update actual particle velocity
          velocities[idx] += (flowVelocity.x - velocities[idx]) * 0.15;
          velocities[idx + 1] += (flowVelocity.y - velocities[idx + 1]) * 0.15;
          velocities[idx + 2] += (flowVelocity.z - velocities[idx + 2]) * 0.15;

          // Apply velocity
          pArr[idx] += velocities[idx];
          pArr[idx + 1] += velocities[idx + 1];
          pArr[idx + 2] += velocities[idx + 2];

          // Re-spawn if exited boundary
          if (pArr[idx + 2] < -TUNNEL_LENGTH / 2) {
            spawnParticle(i, false);
          }

          // Assign color based on velocity magnitude
          const velLength = Math.sqrt(
            velocities[idx] * velocities[idx] +
            velocities[idx + 1] * velocities[idx + 1] +
            velocities[idx + 2] * velocities[idx + 2]
          );
          const ratio = Math.min(1.0, velLength / (flowSpeedRef.current * 1.4));
          const col = getFlowColor(ratio, theme);

          cArr[idx] = col.r;
          cArr[idx + 1] = col.g;
          cArr[idx + 2] = col.b;
        }

        particlesGeo.attributes.position.needsUpdate = true;
        particlesGeo.attributes.color.needsUpdate = true;
      }

      // --- Render Mode: STREAMLINES ---
      else if (visMode === 'streamlines') {
        const streamCountX = 10;
        const streamCountY = 6;
        const totalStreams = streamCountX * streamCountY;

        let index = 0;
        const pArray = streamlineGeo.attributes.position.array as Float32Array;
        const cArray = streamlineGeo.attributes.color.array as Float32Array;

        const tracePos = new THREE.Vector3();
        const traceLocalPos = new THREE.Vector3();
        const nextTracePos = new THREE.Vector3();

        const dt = 0.55;

        for (let sx = 0; sx < streamCountX; sx++) {
          for (let sy = 0; sy < streamCountY; sy++) {
            // Seed coordinate at inlet plane (Z = 28)
            const seedX = -16 + (sx / (streamCountX - 1)) * 32;
            const seedY = -7 + (sy / (streamCountY - 1)) * 14;

            tracePos.set(seedX, seedY, 28);

            for (let step = 0; step < MAX_LINE_STEPS; step++) {
              // Get local position
              traceLocalPos.copy(tracePos);
              obstaclePivot.worldToLocal(traceLocalPos);

              // Check collision inside streamline
              const inside = checkCollisionLocal(activeType, traceLocalPos.x, traceLocalPos.y, traceLocalPos.z);
              if (inside) {
                // Terminate streamline if hits object center or draw stops
                break;
              }

              // Sample local fluid field
              const localVel = getVelocityAtPoint(traceLocalPos, timeSec);
              flowVelocity.copy(localVel).applyQuaternion(obstaclePivot.quaternion);

              // Step forward
              nextTracePos.copy(tracePos).addScaledVector(flowVelocity, dt);

              // Save line segment endpoints in vertex arrays
              const pIdx = index * 6;
              pArray[pIdx] = tracePos.x;
              pArray[pIdx + 1] = tracePos.y;
              pArray[pIdx + 2] = tracePos.z;

              pArray[pIdx + 3] = nextTracePos.x;
              pArray[pIdx + 4] = nextTracePos.y;
              pArray[pIdx + 5] = nextTracePos.z;

              // Color based on velocity speed
              const speed = flowVelocity.length();
              const ratio = Math.min(1.0, speed / (flowSpeedRef.current * 1.5));
              const col = getFlowColor(ratio, theme);

              const cIdx = index * 6;
              cArray[cIdx] = col.r;
              cArray[cIdx + 1] = col.g;
              cArray[cIdx + 2] = col.b;
              cArray[cIdx + 3] = col.r;
              cArray[cIdx + 4] = col.g;
              cArray[cIdx + 5] = col.b;

              index++;
              tracePos.copy(nextTracePos);

              // Bounds exit condition
              if (tracePos.z < -28 || Math.abs(tracePos.x) > 20 || Math.abs(tracePos.y) > 10) {
                break;
              }
            }
          }
        }

        streamlineGeo.setDrawRange(0, index * 2);
        streamlineGeo.attributes.position.needsUpdate = true;
        streamlineGeo.attributes.color.needsUpdate = true;
      }

      // --- Render Mode: VECTOR FIELD ---
      else if (visMode === 'vectors') {
        const dummy = new THREE.Object3D();
        const baseColor = new THREE.Color('#38b000');
        const fastColor = new THREE.Color('#7df9ff');
        const calcPos = new THREE.Vector3();

        for (let i = 0; i < totalVectors; i++) {
          const gridPos = vectorGridPositions[i];
          calcPos.copy(gridPos);
          
          // Convert to object local space
          obstaclePivot.worldToLocal(calcPos);

          const localVel = getVelocityAtPoint(calcPos, timeSec);
          flowVelocity.copy(localVel).applyQuaternion(obstaclePivot.quaternion);

          const speed = flowVelocity.length();
          const speedRatio = Math.min(1.0, speed / (flowSpeedRef.current * 1.5));

          dummy.position.copy(gridPos);
          
          // Align instance mesh rotation with vector direction
          if (speed > 0.05) {
            // Find rotation quaternion to align (0,0,1) with velocity direction
            const direction = flowVelocity.clone().normalize();
            const alignQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
            dummy.quaternion.copy(alignQuaternion);
            // Scale length of arrow based on speed
            dummy.scale.set(1, 1, 0.4 + speedRatio * 1.6);
          } else {
            dummy.scale.set(0.001, 0.001, 0.001); // Hide inside object
          }

          dummy.updateMatrix();
          vectorFieldMesh.setMatrixAt(i, dummy.matrix);

          // Color grid arrow
          const col = new THREE.Color();
          col.lerpColors(baseColor, fastColor, speedRatio);
          vectorFieldMesh.setColorAt(i, col);
        }

        vectorFieldMesh.instanceMatrix.needsUpdate = true;
        if (vectorFieldMesh.instanceColor) {
          vectorFieldMesh.instanceColor.needsUpdate = true;
        }
      }

      // --- Render Mode: PRESSURE Contours slice ---
      else if (visMode === 'pressure') {
        const posAttr = sliceGeo.attributes.position;
        const colorAttr = sliceGeo.attributes.color;
        const count = posAttr.count;

        const sliceWorldPos = new THREE.Vector3();
        const sliceLocalPos = new THREE.Vector3();

        const pressureColorHigh = new THREE.Color('#ff003c'); // Red = High Pressure (Stagnation)
        const pressureColorMid = new THREE.Color('#3a86c8');  // Blue = Normal
        const pressureColorLow = new THREE.Color('#ccff33');  // Neon Green = Low Pressure (Suction / Lift)

        for (let i = 0; i < count; i++) {
          // Geometry position is relative
          sliceWorldPos.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
          
          // Map to local coords to sample vector field
          sliceLocalPos.copy(sliceWorldPos);
          obstaclePivot.worldToLocal(sliceLocalPos);

          const inside = checkCollisionLocal(activeType, sliceLocalPos.x, sliceLocalPos.y, sliceLocalPos.z);
          if (inside) {
            // Inside obstacle = Neutral pressure color
            colorAttr.setXYZ(i, 0.08, 0.08, 0.12);
            continue;
          }

          const localVel = getVelocityAtPoint(sliceLocalPos, timeSec);
          const speed = localVel.length();
          const nominalSpeed = flowSpeedRef.current;

          // Bernoulli: P = P_inlet - 0.5 * density * (V^2 - V_inlet^2)
          // Scale relative speed squared:
          const ratio = (speed * speed) / (nominalSpeed * nominalSpeed + 0.1);
          
          // Map to color gradient:
          // ratio < 1 (speed slowed down -> high pressure) -> blending towards Red
          // ratio > 1 (speed accelerated -> low pressure) -> blending towards Green
          const col = new THREE.Color();
          if (ratio < 0.8) {
            const factor = Math.max(0, ratio / 0.8);
            col.lerpColors(pressureColorHigh, pressureColorMid, 1.0 - factor);
          } else {
            const factor = Math.min(1.0, (ratio - 0.8) / 1.5);
            col.lerpColors(pressureColorMid, pressureColorLow, factor);
          }

          colorAttr.setXYZ(i, col.r, col.g, col.b);
        }
        colorAttr.needsUpdate = true;
      }

      controls.update();
      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    // --- Cleanup & Resize Events ---
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
      cancelAnimationFrame(animationFrameId);
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
    };
    // Run once on mount! All dynamically changing elements are controlled via react refs or child useEffects
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mountRef} className="w-full h-full relative" />;
}
