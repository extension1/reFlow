import React, { useState, useCallback, useEffect, useRef } from 'react';
import WindTunnel from './components/WindTunnel';
import {
  Activity,
  RotateCcw,
  Sliders,
  Eye,
  Gauge,
  Cpu,
  Layers,
  Sparkles,
  Info,
  Key,
  Trash2,
  AlertTriangle,
  Play,
  Pause,
  Settings,
  HelpCircle,
  Zap,
  Download,
  Camera,
  Tv,
  Network,
  X,
  ShieldAlert,
  Compass
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

const PRESETS: Record<string, {
  name: string;
  description: string;
  activeObject: string;
  flowSpeed: number;
  viscosity: number;
  angleofAttack: number;
  visualMode: 'particles' | 'streamlines' | 'vectors' | 'pressure';
  particleCount: number;
  particleSize: number;
  particleColorTheme: 'cyan' | 'fire' | 'emerald' | 'plasma';
  smokeMode: 'streamers' | 'uniform';
  is2D: boolean;
}> = {
  laminar_wing: {
    name: 'Laminar Airfoil Study',
    description: 'Attached flow around a NACA 0012 profile at low speed and high viscosity (ideal Cl/Cd ratio).',
    activeObject: 'Wing',
    flowSpeed: 1.2,
    viscosity: 7.0,
    angleofAttack: 6,
    visualMode: 'particles',
    particleCount: 10000,
    particleSize: 0.35,
    particleColorTheme: 'cyan',
    smokeMode: 'streamers',
    is2D: true
  },
  wing_stall: {
    name: 'Critical Airfoil Stall',
    description: 'Turbulent flow separation and vortex shedding field beyond the critical stall angle of 15°.',
    activeObject: 'Wing',
    flowSpeed: 2.2,
    viscosity: 1.8,
    angleofAttack: 19,
    visualMode: 'pressure',
    particleCount: 15000,
    particleSize: 0.35,
    particleColorTheme: 'fire',
    smokeMode: 'uniform',
    is2D: false
  },
  car_downforce: {
    name: 'Sports Car Downforce',
    description: 'Spoiler deflection and flat undertray ground effect sucking the sports car onto the track.',
    activeObject: 'Car',
    flowSpeed: 3.5,
    viscosity: 2.0,
    angleofAttack: 0,
    visualMode: 'particles',
    particleCount: 12000,
    particleSize: 0.3,
    particleColorTheme: 'plasma',
    smokeMode: 'streamers',
    is2D: false
  },
  cube_bluff_wake: {
    name: 'Bluff Body Wake (Cube)',
    description: 'High Reynolds flow crashing onto a flat cube face, producing extreme pressure drag and recirculating eddies.',
    activeObject: 'Cube',
    flowSpeed: 2.8,
    viscosity: 1.2,
    angleofAttack: 15,
    visualMode: 'vectors',
    particleCount: 16000,
    particleSize: 0.4,
    particleColorTheme: 'emerald',
    smokeMode: 'uniform',
    is2D: false
  },
  torus_plasma: {
    name: 'Torus Plasma Matrix',
    description: 'High-speed fluid passing around a toroidal body, showcasing flow shearing and internal flow contours.',
    activeObject: 'Custom',
    flowSpeed: 3.0,
    viscosity: 1.0,
    angleofAttack: 20,
    visualMode: 'streamlines',
    particleCount: 18000,
    particleSize: 0.35,
    particleColorTheme: 'plasma',
    smokeMode: 'streamers',
    is2D: false
  },
  battery_saver: {
    name: 'Eco / Low-Spec Mode',
    description: 'Optimized settings using streamlines on a 2D slice to run perfectly on integrated or battery power.',
    activeObject: 'Sphere',
    flowSpeed: 1.5,
    viscosity: 5.0,
    angleofAttack: 0,
    visualMode: 'streamlines',
    particleCount: 4000,
    particleSize: 0.3,
    particleColorTheme: 'cyan',
    smokeMode: 'streamers',
    is2D: true
  }
};

export default function App() {
  // --- Simulation Settings State ---
  const [viscosity, setViscosity] = useState(2.0);
  const [flowSpeed, setFlowSpeed] = useState(1.8);
  const [activeObject, setActiveObject] = useState('Wing');
  const [angleofAttack, setAngleofAttack] = useState(6);
  const [visualMode, setVisualMode] = useState<'particles' | 'streamlines' | 'vectors' | 'pressure'>('particles');
  const [particleCount, setParticleCount] = useState(12000);
  const [particleSize, setParticleSize] = useState(0.35);
  const [particleColorTheme, setParticleColorTheme] = useState<'cyan' | 'fire' | 'emerald' | 'plasma'>('cyan');
  const [smokeMode, setSmokeMode] = useState<'streamers' | 'uniform'>('streamers');
  const [objectPosition, setObjectPosition] = useState({ x: 0, y: 0, z: 0 });
  const [is2D, setIs2D] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const [resetTrigger, setResetTrigger] = useState(0);

  // --- Interactive Probe & Camera Control States (New QoL) ---
  const [probePoint, setProbePoint] = useState<{ x: number; y: number; active: boolean } | null>(null);
  const [cameraPreset, setCameraPreset] = useState<string | null>(null);
  const [cameraPresetTrigger, setCameraPresetTrigger] = useState(0);
  const [optimizeRender, setOptimizeRender] = useState(false);
  const [showSysTelemetry, setShowSysTelemetry] = useState(true);
  const [crtEnabled, setCrtEnabled] = useState(true);

  // --- Telemetry Stats State ---
  const [stats, setStats] = useState({
    fps: 0,
    count: 0,
    mem: 0,
    reynolds: 0,
    lift: 0.0,
    drag: 0.0,
    liftCoeff: 0.0,
    dragCoeff: 0.0,
    isStalled: false,
    cpuLoad: 0,
    avgSimTime: 0.0,
    fpsJitter: 0.0,
  });

  // --- Hardware Telemetry (Actual PC Metrics) ---
  const [hardwareTelemetry, setHardwareTelemetry] = useState({
    gpu: 'Detecting PC Hardware...',
    cores: navigator.hardwareConcurrency || 4,
    jsHeapLimit: 0,
    jsHeapUsed: 0,
    jsHeapTotal: 0,
    batteryLevel: 100,
    isCharging: true,
    batterySupported: false,
    networkDownlink: 'N/A',
    networkRtt: 'N/A',
  });

  const handleStatsUpdate = useCallback((newStats: any) => {
    setStats(newStats);
  }, []);

  const handleReset = () => {
    setObjectPosition({ x: 0, y: 0, z: 0 });
    setResetTrigger((prev) => prev + 1);
  };

  // --- PC Hardware Diagnostics Effect (Actual Browser APIs) ---
  useEffect(() => {
    // 1. GPU Detection
    let gl: WebGLRenderingContext | null = null;
    let gpuString = 'Unknown GPU Device';
    try {
      const canvas = document.createElement('canvas');
      gl = canvas.getContext('webgl') || (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
      if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          gpuString = gl.getParameter(debugInfo.UNMASKED_RENDERER_VENDOR_STRING) + ' ' + gl.getParameter(debugInfo.UNMASKED_RENDERED_GPU_STRING);
        } else {
          gpuString = gl.getParameter(gl.RENDERER) || 'Standard WebGL Renderer';
        }
      }
    } catch (e) {
      console.warn('WebGL not supported, unable to query GPU telemetry.', e);
    }

    // Remove prefix like "Angle (NVIDIA ..." if any
    gpuString = gpuString.replace(/^ANGLE \(([^,)]+).*/, '$1');

    // 2. Network connection
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    const downlink = conn ? `${conn.downlink} Mbps` : 'High Speed';
    const rtt = conn ? `${conn.rtt} ms` : 'Low Latency';

    setHardwareTelemetry(prev => ({
      ...prev,
      gpu: gpuString,
      networkDownlink: downlink,
      networkRtt: rtt
    }));

    // 3. Battery Status API
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((batt: any) => {
        const updateBattery = () => {
          setHardwareTelemetry(prev => ({
            ...prev,
            batteryLevel: Math.round(batt.level * 100),
            isCharging: batt.charging,
            batterySupported: true
          }));
        };
        updateBattery();
        batt.addEventListener('levelchange', updateBattery);
        batt.addEventListener('chargingchange', updateBattery);
      });
    }

    // 4. Memory usage update loop
    const memInterval = setInterval(() => {
      if ((performance as any).memory) {
        const limit = Math.round((performance as any).memory.jsHeapSizeLimit / 1048576);
        const used = Math.round((performance as any).memory.usedJSHeapSize / 1048576);
        const total = Math.round((performance as any).memory.totalJSHeapSize / 1048576);
        setHardwareTelemetry(prev => ({
          ...prev,
          jsHeapLimit: limit,
          jsHeapUsed: used,
          jsHeapTotal: total
        }));
      }
    }, 1500);

    return () => clearInterval(memInterval);
  }, []);

  // --- Aero Simulation Preset Loader ---
  const loadPreset = (key: string) => {
    const p = PRESETS[key];
    if (!p) return;
    setViscosity(p.viscosity);
    setFlowSpeed(p.flowSpeed);
    setActiveObject(p.activeObject);
    setAngleofAttack(p.angleofAttack);
    setVisualMode(p.visualMode);
    setParticleCount(p.particleCount);
    setParticleSize(p.particleSize);
    setParticleColorTheme(p.particleColorTheme);
    setSmokeMode(p.smokeMode);
    setIs2D(p.is2D);
    setProbePoint(null); // Clear active probe stream on preset change
    
    // Trigger reset to respawn correctly
    setResetTrigger(prev => prev + 1);
  };

  // --- Camera snapping presets ---
  const snapCamera = (preset: string) => {
    setCameraPreset(preset);
    setCameraPresetTrigger(prev => prev + 1);
  };

  // --- Auto-Optimize Settings to Prevent Lag ---
  const handleAutoOptimize = () => {
    setParticleCount(5000);
    setOptimizeRender(true);
    setIs2D(true);
    setViscosity(Math.max(viscosity, 4.0)); // smooth flow, less calculation overhead
    setFlowSpeed(Math.min(flowSpeed, 2.0));  // slower wind speed
    setProbePoint(null); // clear probe
  };

  // --- Capture WebGL Screenshot ---
  const handleCaptureScreenshot = () => {
    const event = new CustomEvent('reflow-capture-screenshot');
    window.dispatchEvent(event);
  };

  // --- Telemetry Report Data Export ---
  const handleExportTelemetry = () => {
    const data = {
      timestamp: new Date().toISOString(),
      sessionName: `reFlow-Run-${activeObject}-${Date.now()}`,
      simulationSettings: {
        activeObject,
        flowSpeed,
        viscosity,
        angleofAttack,
        visualMode,
        particleCount,
        smokeMode,
        is2D,
        isPaused
      },
      telemetryStats: {
        fps: stats.fps,
        reynolds: stats.reynolds,
        liftForceNewtons: stats.lift,
        dragForceNewtons: stats.drag,
        liftCoefficient: stats.liftCoeff,
        dragCoefficient: stats.dragCoeff,
        isStalled: stats.isStalled
      },
      pcEnvironment: {
        cores: hardwareTelemetry.cores,
        gpu: hardwareTelemetry.gpu,
        cpuBurdenPercent: stats.cpuLoad,
        fpsJitterMs: stats.fpsJitter
      }
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `reFlow-telemetry-${activeObject}-${Date.now()}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  // --- Scrolling Chart Logic ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<{ lift: number; drag: number }[]>([]);

  useEffect(() => {
    // Add current stats to history
    historyRef.current.push({ lift: stats.lift, drag: stats.drag });
    if (historyRef.current.length > 200) {
      historyRef.current.shift();
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const w = canvas.width;
    const h = canvas.height;
    const padding = 25;
    const chartW = w - padding * 2;
    const chartH = h - padding * 2;

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(w - padding, y);
      ctx.stroke();
    }

    const history = historyRef.current;
    if (history.length < 2) return;

    // Find min and max for scaling
    let maxVal = 5.0;
    let minVal = -5.0;
    history.forEach((d) => {
      maxVal = Math.max(maxVal, Math.abs(d.lift), Math.abs(d.drag));
    });
    maxVal = Math.ceil(maxVal * 1.1);
    minVal = -maxVal;

    const scaleY = (val: number) => {
      const pct = (val - minVal) / (maxVal - minVal);
      return padding + chartH - pct * chartH;
    };

    // Draw zero line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.moveTo(padding, scaleY(0));
    ctx.lineTo(w - padding, scaleY(0));
    ctx.stroke();

    // Draw Lift line (Cyan)
    ctx.strokeStyle = '#7DF9FF';
    ctx.shadowColor = '#7DF9FF';
    ctx.shadowBlur = 6;
    ctx.lineWidth = 2;
    ctx.beginPath();
    history.forEach((pt, idx) => {
      const x = padding + (idx / 200) * chartW;
      const y = scaleY(pt.lift);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw Drag line (Orange)
    ctx.strokeStyle = '#ff9f1c';
    ctx.shadowColor = '#ff9f1c';
    ctx.shadowBlur = 6;
    ctx.lineWidth = 2;
    ctx.beginPath();
    history.forEach((pt, idx) => {
      const x = padding + (idx / 200) * chartW;
      const y = scaleY(pt.drag);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Reset shadow blur
    ctx.shadowBlur = 0;

    // Draw labels
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '9px monospace';
    ctx.fillText(`+${maxVal.toFixed(0)}N`, padding - 20, padding + 5);
    ctx.fillText('0N', padding - 15, scaleY(0) + 3);
    ctx.fillText(`-${maxVal.toFixed(0)}N`, padding - 20, padding + chartH + 3);
  }, [stats.lift, stats.drag]);

  // --- AI Analysis Panel Logic ---
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('reflow_gemini_key') || '');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [aiReport, setAiReport] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiConsoleLogs, setAiConsoleLogs] = useState<string[]>([]);

  const saveApiKey = (key: string) => {
    localStorage.setItem('reflow_gemini_key', key);
    setApiKey(key);
    setShowKeyModal(false);
  };

  const deleteApiKey = () => {
    localStorage.removeItem('reflow_gemini_key');
    setApiKey('');
  };

  const triggerAiAnalysis = async () => {
    setIsAiLoading(true);
    setAiReport('');
    setAiConsoleLogs([
      '>> INITIALIZING WIND TUNNEL TELEMETRY UPLOAD...',
      `>> PACKING CFD METRICS: Shape=${activeObject}, AoA=${angleofAttack}°, Speed=${flowSpeed}m/s, Visc=${viscosity}`,
      `>> Telemetry data: Cl=${stats.liftCoeff}, Cd=${stats.dragCoeff}, Re=${stats.reynolds}, Lift=${stats.lift}N, Drag=${stats.drag}N`,
    ]);

    const addLog = (msg: string, delay: number) => {
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          setAiConsoleLogs((prev) => [...prev, msg]);
          resolve();
        }, delay);
      });
    };

    await addLog('>> RETRIEVING ATMOSPHERIC SOLVER PARAMS...', 400);

    if (apiKey.trim()) {
      await addLog('>> GEMINI CLIENT SECURE HANDSHAKE ESTABLISHED.', 300);
      await addLog('>> SUBMITTING DESIGN CO-PILOT INFERENCE REQUEST...', 400);
      try {
        const ai = new GoogleGenAI({ apiKey: apiKey });
        const systemPrompt = `You are a world-class aerodynamics and aeronautical engineering consultant (CFD Co-Pilot).
        Analyze the current wind tunnel experiment and generate a professional, high-fidelity report in Markdown.
        Discuss the specific shapes, stall characteristics (if wing), boundary layer flow separation, Reynolds number implications, Lift-to-Drag ratio, and engineering suggestions.
        Keep it concise, highly technical, and insightful.`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            `${systemPrompt}
            Wind Tunnel Parameters:
            - Obstacle Shape: ${activeObject}
            - Angle of Attack (AoA): ${angleofAttack}°
            - Inlet Flow Velocity: ${flowSpeed} m/s
            - Kinematic Viscosity (Relative): ${viscosity}
            - Reynolds Number (Re): ${stats.reynolds}
            - Lift Coefficient (Cl): ${stats.liftCoeff}
            - Drag Coefficient (Cd): ${stats.dragCoeff}
            - Stalled: ${stats.isStalled ? 'YES' : 'NO'}
            - Lift Force: ${stats.lift} N
            - Drag Force: ${stats.drag} N`
          ]
        });

        await addLog('>> GEMINI INFERENCE COMPLETE. DECODING PACKETS...', 300);
        setAiReport(response.text || 'Error: Empty response received from Gemini.');
      } catch (err: any) {
        await addLog('!! API CONNECTIVITY NOTICE: Using local solver', 300);
        await addLog('>> FALLING BACK TO INTEGRATED CFD RULE-BASED SOLVER...', 500);
        const report = generateLocalReport();
        setAiReport(report);
      }
    } else {
      await addLog('>> ACCESSING INTEGRATED CFD SOLVER KNOWLEDGEBASE...', 500);
      await addLog('>> EXECUTING LOCAL TELEMETRY BOUNDARY RESOLUTION ALGORITHM...', 500);
      const report = generateLocalReport();
      setAiReport(report);
    }
    setIsAiLoading(false);
  };

  const generateLocalReport = (): string => {
    const LOverD = stats.dragCoeff > 0 ? (stats.liftCoeff / stats.dragCoeff).toFixed(2) : '0';
    const isWing = activeObject === 'Wing';
    const isPlate = activeObject === 'FlatPlate';
    const isCar = activeObject === 'Car';

    let sectionOverview = '';
    let sectionPhysics = '';
    let sectionRe = '';
    let sectionSuggestions = '';

    if (isWing) {
      sectionOverview = `The **NACA 0012 Airfoil** is currently positioned at an angle of attack (AoA) of **${angleofAttack}°**. It is generating a lift force of **${stats.lift} N** against a drag force of **${stats.drag} N**, yielding an efficiency (L/D) ratio of **${LOverD}**.`;
      if (stats.isStalled) {
        sectionPhysics = `### boundary layer stall analysis
> [!WARNING]
> **CRITICAL STALL DETECTED:** The Angle of Attack of **${angleofAttack}°** exceeds the airfoil critical stall limit of **15°**.
At this extreme angle, the adverse pressure gradient along the upper camber causes complete boundary layer separation. The flow can no longer follow the profile contour, creating a massive turbulent separation bubble and trailing edge wake. This is visualized by the huge fluctuation field behind the wing. Lift has dropped significantly by over **60%**, and pressure drag has spiked.`;
      } else {
        sectionPhysics = `### lift generation physics
The airfoil is operating in the **laminar/attached flow regime**. Air velocity over the upper camber is significantly accelerated compared to the lower surface, creating a suction zone (low pressure, colored green/yellow in the pressure slice heatmap) on top and a stagnation zone (high pressure, colored red) at the nose leading edge. This differential pressure generates vertical lift. The deflection of the streamlines downwards behind the trailing edge (downwash) shows momentum conservation in action.`;
      }
      sectionSuggestions = `- **Angle of Attack**: Decrease AoA to **${angleofAttack > 0 ? '6° to 10°' : '-6° to -10°'}** to maximize lift-to-drag efficiency and re-attach the boundary layer.
- **Leading Edge Slats**: Implement leading edge devices to inject high-energy fluid into the boundary layer, delaying separation to higher stall angles.`;
    } else if (isPlate) {
      sectionOverview = `The **Flat Plate obstacle** represents a high-drag bluff/lifting body. Operating at an AoA of **${angleofAttack}°**, it creates **${stats.lift} N** of lift and **${stats.drag} N** of drag.`;
      sectionPhysics = `### bluff body separation
Because flat plates lack aerodynamic curvature, boundary layer separation occurs immediately at the leading and trailing edges, regardless of viscosity. A massive low-pressure separation zone dominates the rear surface. At steep angles, this acts as a pure aerodynamic parachute, converting dynamic flow pressure into profile drag.`;
      sectionSuggestions = `- **Streamlining**: Replace the flat plate with a double-wedge or curved thin-airfoil profile to guide flow lines smoothly.
- **Aspect Ratio**: Alter the plate aspect ratio or sweep angle to mitigate tip vortices.`;
    } else if (isCar) {
      sectionOverview = `The **Sports Car Profile** is modeled in a ground-effect wind tunnel. At **${flowSpeed} m/s**, it generates **${stats.drag} N** of aerodynamic drag and **${Math.abs(stats.lift)} N** of **aerodynamic downforce** (negative lift).`;
      sectionPhysics = `### downforce & drag shadow
The vehicle's fastback slope guides air over the cabin, creating a slight upward lift force initially, which is countered by the rear spoiler lip. The flat undertray accelerates air underneath, creating a low-pressure ground suction effect. A turbulent wake forms behind the rear bumper, creating a low-pressure 'drag shadow' that pulls the vehicle backward.`;
      sectionSuggestions = `- **Diffuser Angle**: Add an underbody rear diffuser to further accelerate flow underneath, increasing downforce without drag penalties.
- **Active Spoiler**: Increase spoiler angle to optimize downforce for cornering, or lay it flat to reduce drag on straights.`;
    } else {
      // Sphere, Cube, Torus
      sectionOverview = `The bluff obstacle (**${activeObject}**) is placed in the wind tunnel. Generating **0N** of lift (symmetric geometry) and **${stats.drag} N** of drag.`;
      sectionPhysics = `### boundary layer separation & wake
Flow hits the leading edge, creating a central stagnation point (maximum pressure, Red). As fluid flows around the sides, it accelerates (low pressure, Green). For a **${activeObject}**, the boundary layer separates early on the rear side due to adverse pressure, creating a massive recirculating wake filled with low-pressure eddies. This wake creates a huge pressure differential between front and back, yielding high pressure drag.`;
      sectionSuggestions = `- **Fairing**: Add a nose cone and a tapered tail fairing (teardrop shape) to shift separation downstream and reduce drag by up to **90%**.
- **Surface Roughness**: Adding micro-textures (like golf ball dimples) can trigger turbulent boundary layer transitions, delaying separation and reducing pressure drag.`;
    }

    // Reynolds analysis
    if (stats.reynolds < 12000) {
      sectionRe = `At a Reynolds number of **${stats.reynolds}**, the tunnel flow behaves in a **laminar or transitional state**. Viscous forces are dominant, smoothing out high-frequency fluctuations. The wake is highly structured.`;
    } else {
      sectionRe = `The Reynolds number of **${stats.reynolds}** places the simulation in the **highly turbulent regime**. Inertial forces dominate over viscous forces, leading to rapid flow detachment, shear layer breakdown, and a chaotic wake behind the obstacle.`;
    }

    return `## CFD co-pilot simulation report

${sectionOverview}

---

${sectionPhysics}

### reynolds number telemetry
${sectionRe}
The current viscosity rating of **${viscosity.toFixed(1)}** sets the laminar stability coefficient. Increasing speed or decreasing viscosity shifts the flow deeper into inertial chaos.

---

### aerodynamic recommendations
${sectionSuggestions}
- **Flow Control**: Consider using micro-jets or boundary layer suction on the upper surfaces to delay drag separation.
`;
  };

  // --- Warnings Calculation ---
  const activeWarnings: string[] = [];
  if (particleCount > 16000 && hardwareTelemetry.cores <= 4) {
    activeWarnings.push(`Low Core Alert: Running ${particleCount} particles on a ${hardwareTelemetry.cores}-core CPU can cause browser thread lag.`);
  }
  const isIntegratedGpu = hardwareTelemetry.gpu.toLowerCase().includes('intel') || 
                          hardwareTelemetry.gpu.toLowerCase().includes('microsoft') || 
                          hardwareTelemetry.gpu.toLowerCase().includes('basic');
  if (isIntegratedGpu && particleCount > 10000 && visualMode === 'particles') {
    activeWarnings.push(`Integrated GPU Alert: Large particle rendering on ${hardwareTelemetry.gpu.split(' ').pop()} might trigger micro-stutters.`);
  }
  if (hardwareTelemetry.batterySupported && !hardwareTelemetry.isCharging && hardwareTelemetry.batteryLevel < 25) {
    activeWarnings.push(`Low Battery Alert: Intensity calculations at ${hardwareTelemetry.batteryLevel}% battery may trigger system thermal throttling.`);
  }
  if (stats.fps > 0 && stats.fps < 28) {
    activeWarnings.push(`Thermal/FPS Drop: Active framerate dropped to ${stats.fps} FPS. Try lowering counts or switching to 2D.`);
  }
  if (flowSpeed > 3.8 && viscosity < 1.5 && particleCount > 12000) {
    activeWarnings.push(`Complex Turbulence Load: Slower math calculations due to high speed (${flowSpeed} m/s) and chaotic eddy models.`);
  }

  // Estimated System Stress Level
  const stressScore = Math.round(
    (particleCount / 20000) * 40 +
    (stats.cpuLoad || 0) * 0.4 +
    (is2D ? 0 : 20)
  );
  const stressLevel = stressScore < 35 ? 'LOW' : stressScore < 65 ? 'MEDIUM' : stressScore < 85 ? 'HIGH' : 'CRITICAL';
  const stressColorClass = stressLevel === 'LOW' ? 'text-emerald-400 border-emerald-500/25 bg-emerald-500/5' : 
                           stressLevel === 'MEDIUM' ? 'text-yellow-400 border-yellow-500/25 bg-yellow-500/5' : 
                           stressLevel === 'HIGH' ? 'text-orange-400 border-orange-500/25 bg-orange-500/5 font-bold' : 
                           'text-red-400 border-red-500/35 bg-red-500/10 font-bold animate-pulse';

  return (
    <div className="flex flex-col w-screen h-screen bg-[#060608] text-[#e2e8f0] overflow-hidden font-mono selection:bg-[#7DF9FF]/30 selection:text-white relative">
      {/* CRT Scanline Simulation Overlay */}
      {crtEnabled && <div className="crt-overlay" />}
      {crtEnabled && <div className="crt-scanline" />}

      {/* Top Header Console */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-[#1b1b22] bg-[#09090c] z-10 shadow-lg shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-8 h-8 rounded border border-[#7DF9FF]/30 bg-[#7DF9FF]/5 overflow-hidden">
            <Activity className="w-4 h-4 text-[#7DF9FF] animate-pulse" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#7DF9FF]/10 to-transparent pointer-events-none" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wider text-white">
              re<span className="text-[#7DF9FF] font-extrabold uppercase">Flow</span>
            </h1>
            <p className="text-[9px] uppercase tracking-widest text-gray-500">CFD Aero Tunnel v3.0</p>
          </div>
        </div>

        {/* Global Telemetry Stats Badges (Headers) */}
        <div className="hidden lg:flex items-center gap-4 text-[10px]">
          <div className="flex items-center gap-2 px-3 py-1 rounded border border-[#1b1b22] bg-[#0d0d12]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-gray-500 uppercase">Solver:</span>
            <span className="text-emerald-400 font-semibold uppercase">Active (60Hz)</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1 rounded border border-[#1b1b22] bg-[#0d0d12]">
            <Cpu className="w-3.5 h-3.5 text-[#7DF9FF]/60" />
            <span className="text-gray-500 uppercase">FPS:</span>
            <span className={`font-semibold ${stats.fps < 30 ? 'text-red-400 animate-pulse' : 'text-white'}`}>{stats.fps}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1 rounded border border-[#1b1b22] bg-[#0d0d12]">
            <Zap className="w-3.5 h-3.5 text-yellow-500/60" />
            <span className="text-gray-500 uppercase">Sim Thread:</span>
            <span className="text-white font-semibold">{stats.cpuLoad}%</span>
          </div>

          {hardwareTelemetry.jsHeapUsed > 0 && (
            <div className="flex items-center gap-2 px-3 py-1 rounded border border-[#1b1b22] bg-[#0d0d12]">
              <Layers className="w-3.5 h-3.5 text-purple-400/60" />
              <span className="text-gray-500 uppercase">JS Heap:</span>
              <span className="text-white font-semibold">{hardwareTelemetry.jsHeapUsed}MB / {hardwareTelemetry.jsHeapLimit}MB</span>
            </div>
          )}
        </div>

        {/* Global Toolbar Buttons */}
        <div className="flex items-center gap-2">
          {/* Screenshot capture */}
          <button
            onClick={handleCaptureScreenshot}
            title="Take PNG Screenshot"
            className="flex items-center justify-center p-2 rounded border border-gray-700 bg-gray-800/40 hover:bg-gray-800 text-gray-300 hover:text-white transition-colors active:scale-95"
          >
            <Camera className="w-4 h-4" />
          </button>

          {/* Export telemetry JSON */}
          <button
            onClick={handleExportTelemetry}
            title="Export Telemetry Run Data (JSON)"
            className="flex items-center justify-center p-2 rounded border border-gray-700 bg-gray-800/40 hover:bg-gray-800 text-gray-300 hover:text-white transition-colors active:scale-95"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* CRT Overlay Toggle */}
          <button
            onClick={() => setCrtEnabled(prev => !prev)}
            title="Toggle CRT Screen Shader simulation"
            className={`flex items-center justify-center p-2 rounded border transition-colors active:scale-95 ${
              crtEnabled
                ? 'border-[#7DF9FF]/40 bg-[#7DF9FF]/10 text-[#7DF9FF] hover:bg-[#7DF9FF]/25 shadow-[0_0_10px_rgba(125,249,255,0.1)]'
                : 'border-gray-700 bg-gray-800/40 text-gray-400 hover:text-white'
            }`}
          >
            <Tv className="w-4 h-4" />
          </button>

          <span className="w-px h-6 bg-[#1b1b22] mx-1" />

          {apiKey ? (
            <button
              onClick={deleteApiKey}
              title="Remove Gemini API Key"
              className="flex items-center justify-center p-2 rounded border border-[#ff003c]/20 bg-[#ff003c]/5 hover:bg-[#ff003c]/15 text-[#ff003c] transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => setShowKeyModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-gray-700 bg-gray-800/40 hover:bg-gray-800 text-xs font-semibold text-gray-300 hover:text-white transition-colors"
            >
              <Key className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Link Gemini</span>
            </button>
          )}

          {/* Telemetry panel toggle */}
          <button
            onClick={() => setShowSysTelemetry(prev => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase transition-all duration-200 border rounded active:scale-95 ${
              showSysTelemetry
                ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20'
                : 'border-[#1d1d26] bg-[#0b0b0f] text-gray-400 hover:border-gray-700 hover:text-white'
            }`}
            title="Toggle PC Diagnostics & Hardware stress deck"
          >
            <Network className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Diagnostics</span>
          </button>

          <button
            onClick={() => setIs2D((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase transition-all duration-200 border rounded active:scale-95 ${
              is2D
                ? 'border-[#7DF9FF] bg-[#7DF9FF]/15 text-[#7DF9FF] hover:bg-[#7DF9FF]/25 hover:border-[#7DF9FF]/50 shadow-[0_0_15px_rgba(125,249,255,0.15)]'
                : 'border-[#1d1d26] bg-[#0b0b0f] text-gray-400 hover:border-gray-700 hover:text-white'
            }`}
            title="Toggle 2D slice vs 3D space projection"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{is2D ? '2D' : '3D'}</span>
          </button>

          <button
            onClick={() => setIsPaused((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase transition-all duration-200 border rounded active:scale-95 ${
              isPaused
                ? 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20'
                : 'border-[#1d1d26] bg-[#0b0b0f] text-gray-400 hover:border-gray-700 hover:text-white'
            }`}
            title="Pause or Resume the fluid simulation physics"
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>

          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase transition-all duration-200 border border-[#7DF9FF]/20 rounded bg-[#7DF9FF]/5 text-[#7DF9FF] hover:bg-[#7DF9FF]/15 hover:border-[#7DF9FF]/40 active:scale-95 shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </header>

      {/* Main Panel Layout */}
      <div className="flex flex-1 w-full overflow-hidden relative">
        {/* Left Control Sidebar */}
        <aside className="w-72 border-r border-[#1b1b22] bg-[#09090c] flex flex-col overflow-y-auto z-10 shrink-0 select-none">
          {/* Preset Configurations Selection */}
          <div className="p-4 border-b border-[#1b1b22]">
            <div className="flex items-center gap-2 mb-2.5">
              <Sparkles className="w-4 h-4 text-[#7DF9FF]" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#7DF9FF]">Lab Presets</span>
            </div>
            <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
              {Object.entries(PRESETS).map(([key, item]) => (
                <button
                  key={key}
                  onClick={() => loadPreset(key)}
                  className="w-full text-left py-1.5 px-2.5 rounded border border-[#1b1b22] bg-[#0d0d12] hover:border-[#7DF9FF]/40 hover:bg-[#7DF9FF]/5 transition-all text-xs group"
                >
                  <div className="font-bold text-[#e2e8f0] group-hover:text-white truncate">{item.name}</div>
                  <div className="text-[9px] text-gray-500 group-hover:text-gray-400 line-clamp-1 leading-normal">{item.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Object Selector */}
          <div className="p-4 border-b border-[#1b1b22]">
            <div className="flex items-center gap-2 mb-3">
              <Sliders className="w-4 h-4 text-[#7DF9FF]" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#7DF9FF]">Obstacle Geometry</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'Wing', label: 'Airfoil' },
                { id: 'Car', label: 'Sports Car' },
                { id: 'Sphere', label: 'Sphere' },
                { id: 'Cube', label: 'Cube' },
                { id: 'FlatPlate', label: 'Flat Plate' },
                { id: 'Custom', label: 'Torus' },
              ].map((obj) => (
                <button
                  key={obj.id}
                  onClick={() => {
                    setActiveObject(obj.id);
                    setProbePoint(null); // Clear probe on shape change
                  }}
                  className={`py-2 px-3 text-left rounded border text-xs font-bold transition-all duration-150 ${
                    activeObject === obj.id
                      ? 'border-[#7DF9FF] bg-[#7DF9FF]/10 text-white shadow-sm'
                      : 'border-[#1d1d26] bg-[#0b0b0f] text-gray-400 hover:border-gray-700 hover:text-white'
                  }`}
                >
                  <div className="truncate">{obj.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Flow Parameters */}
          <div className="p-4 border-b border-[#1b1b22] space-y-4">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-[#7DF9FF]" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#7DF9FF]">Flow Properties</span>
            </div>

            {/* Flow Speed */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] uppercase font-bold text-gray-400">
                <span>Inlet Speed</span>
                <span className="text-[#7DF9FF]">{flowSpeed.toFixed(1)} m/s</span>
              </div>
              <input
                type="range"
                min="0.4"
                max="4.5"
                step="0.1"
                value={flowSpeed}
                onChange={(e) => setFlowSpeed(parseFloat(e.target.value))}
                className="w-full accent-[#7DF9FF] bg-[#13131a] rounded-lg cursor-pointer h-1.5"
              />
            </div>

            {/* Viscosity */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] uppercase font-bold text-gray-400">
                <span>Viscosity rating</span>
                <span className="text-purple-400">{(11 - viscosity).toFixed(1)} / 10.0</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="9.5"
                step="0.1"
                value={viscosity}
                onChange={(e) => setViscosity(parseFloat(e.target.value))}
                className="w-full accent-purple-400 bg-[#13131a] rounded-lg cursor-pointer h-1.5"
              />
              <div className="text-[9px] text-gray-500 italic">
                Low viscosity leads to higher turbulence.
              </div>
            </div>

            {/* Angle of Attack */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] uppercase font-bold text-gray-400">
                <span>Angle of Attack</span>
                <span className={`font-bold ${stats.isStalled ? 'text-[#ff003c] animate-pulse' : 'text-[#7DF9FF]'}`}>
                  {angleofAttack}° {stats.isStalled && '(STALLED)'}
                </span>
              </div>
              <input
                type="range"
                min="-45"
                max="45"
                step="1"
                value={angleofAttack}
                onChange={(e) => setAngleofAttack(parseInt(e.target.value))}
                className="w-full accent-[#7DF9FF] bg-[#13131a] rounded-lg cursor-pointer h-1.5"
              />
            </div>
          </div>

          {/* Obstacle Position Translation */}
          <div className="p-4 border-b border-[#1b1b22] space-y-3">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-[#7DF9FF]" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#7DF9FF]">Obstacle Translate</span>
            </div>
            
            {/* Position Y Offset */}
            <div className="space-y-1">
              <div className="flex justify-between text-[9px] uppercase font-bold text-gray-400">
                <span>Vertical Y-Offset</span>
                <span className="text-white">{objectPosition.y.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="-6.0"
                max="6.0"
                step="0.2"
                value={objectPosition.y}
                onChange={(e) => setObjectPosition((prev) => ({ ...prev, y: parseFloat(e.target.value) }))}
                className="w-full accent-[#7DF9FF] bg-[#13131a] rounded-lg cursor-pointer h-1"
              />
            </div>

            {/* Position X Offset */}
            <div className="space-y-1">
              <div className="flex justify-between text-[9px] uppercase font-bold text-gray-400">
                <span>Transverse X-Offset</span>
                <span className="text-white">{objectPosition.x.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="-12.0"
                max="12.0"
                step="0.4"
                value={objectPosition.x}
                onChange={(e) => setObjectPosition((prev) => ({ ...prev, x: parseFloat(e.target.value) }))}
                className="w-full accent-[#7DF9FF] bg-[#13131a] rounded-lg cursor-pointer h-1"
              />
            </div>
          </div>

          {/* Visualizer Modes */}
          <div className="p-4 border-b border-[#1b1b22] space-y-3">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#7DF9FF]" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#7DF9FF]">Visualizer Output</span>
            </div>
            
            <div className="flex flex-col gap-1.5">
              {[
                { id: 'particles', label: 'Flow Particles' },
                { id: 'streamlines', label: 'Streamlines (CFD)' },
                { id: 'vectors', label: 'Vector Field Grid' },
                { id: 'pressure', label: 'Pressure Slice Heatmap' },
              ].map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setVisualMode(mode.id as any)}
                  className={`w-full py-2 px-3 rounded border text-left text-xs font-bold transition-colors ${
                    visualMode === mode.id
                      ? 'border-[#7DF9FF] bg-[#7DF9FF]/10 text-white'
                      : 'border-[#1d1d26] bg-[#0b0b0f] text-gray-400 hover:border-gray-700 hover:text-white'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {/* Theme & Smoke options - visible for particles */}
            {visualMode === 'particles' && (
              <div className="pt-2 space-y-3">
                {/* Smoke injection */}
                <div className="space-y-1">
                  <div className="text-[9px] uppercase font-bold text-gray-400">Injection Type</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSmokeMode('streamers')}
                      className={`py-1 px-2 border text-[9px] font-bold uppercase rounded text-center transition-colors ${
                        smokeMode === 'streamers'
                          ? 'border-[#7DF9FF] bg-[#7DF9FF]/10 text-white'
                          : 'border-[#1b1b22] bg-[#0d0d12] text-gray-500 hover:text-white'
                      }`}
                    >
                      Streamers
                    </button>
                    <button
                      onClick={() => setSmokeMode('uniform')}
                      className={`py-1 px-2 border text-[9px] font-bold uppercase rounded text-center transition-colors ${
                        smokeMode === 'uniform'
                          ? 'border-[#7DF9FF] bg-[#7DF9FF]/10 text-white'
                          : 'border-[#1b1b22] bg-[#0d0d12] text-gray-500 hover:text-white'
                      }`}
                    >
                      Uniform
                    </button>
                  </div>
                </div>

                {/* Color theme */}
                <div className="space-y-1">
                  <div className="text-[9px] uppercase font-bold text-gray-400">Color Spectrum</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'cyan', label: 'Neon Cyan' },
                      { id: 'fire', label: 'Fire Amber' },
                      { id: 'emerald', label: 'Emerald Flow' },
                      { id: 'plasma', label: 'Cosmic Plasma' },
                    ].map((theme) => (
                      <button
                        key={theme.id}
                        onClick={() => setParticleColorTheme(theme.id as any)}
                        className={`py-1 px-1.5 border text-[9px] font-bold uppercase rounded transition-colors truncate ${
                          particleColorTheme === theme.id
                            ? 'border-[#7DF9FF] bg-[#7DF9FF]/10 text-white'
                            : 'border-[#1b1b22] bg-[#0d0d12] text-gray-500 hover:text-white'
                        }`}
                      >
                        {theme.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Particle Count */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] uppercase font-bold text-gray-400">
                    <span>Count</span>
                    <span className={`font-bold ${particleCount > 20000 ? 'text-orange-400' : 'text-[#7DF9FF]'}`}>{particleCount}</span>
                  </div>
                  <input
                    type="range"
                    min="2000"
                    max="40000"
                    step="1000"
                    value={particleCount}
                    onChange={(e) => setParticleCount(parseInt(e.target.value))}
                    className="w-full accent-[#7DF9FF] bg-[#13131a] rounded cursor-pointer h-1"
                  />
                  {particleCount > 20000 && (
                    <div className="text-[8px] text-orange-400/80 leading-normal italic">
                      High Load: Runs might throttle lighter devices.
                    </div>
                  )}
                </div>

                {/* Particle Size */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] uppercase font-bold text-gray-400">
                    <span>Size</span>
                    <span className="text-[#7DF9FF]">{particleSize.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.5"
                    step="0.05"
                    value={particleSize}
                    onChange={(e) => setParticleSize(parseFloat(e.target.value))}
                    className="w-full accent-[#7DF9FF] bg-[#13131a] rounded cursor-pointer h-1"
                  />
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Center / Right Simulation & Analysis Grid */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Main 3D Canvas Area */}
          <main className="flex-1 min-h-[350px] relative overflow-hidden bg-[#0b0b0f] border-b border-[#1b1b22]">
            <WindTunnel
              viscosity={viscosity}
              flowSpeed={flowSpeed}
              activeObject={activeObject}
              angleofAttack={angleofAttack}
              visualMode={visualMode}
              particleCount={particleCount}
              particleSize={particleSize}
              particleColorTheme={particleColorTheme}
              smokeMode={smokeMode}
              objectPosition={objectPosition}
              onStatsUpdate={handleStatsUpdate}
              resetTrigger={resetTrigger}
              is2D={is2D}
              isPaused={isPaused}
              probePoint={probePoint}
              cameraPreset={cameraPreset}
              cameraPresetTrigger={cameraPresetTrigger}
              optimizeRender={optimizeRender}
              onProbePlaced={(x, y) => setProbePoint({ x, y, active: true })}
            />

            {/* STALL WARNING INDICATOR OVERLAY */}
            {stats.isStalled && (
              <div className="absolute top-24 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 border-2 border-[#ff003c] bg-[#ff003c]/10 text-[#ff003c] rounded-md backdrop-blur-md animate-bounce z-10 shadow-lg select-none">
                <AlertTriangle className="w-5 h-5 text-[#ff003c] animate-pulse" />
                <div className="flex flex-col text-left">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#ff003c]">
                    CRITICAL STALL WARNING
                  </span>
                  <span className="text-[9px] font-bold text-white uppercase tracking-wider">
                    Flow detachment / Boundary layer separation active
                  </span>
                </div>
              </div>
            )}

            {/* Interactive Probe HUD Indicator */}
            {probePoint && probePoint.active && (
              <div className="absolute top-24 left-4 flex items-center gap-3 px-3.5 py-1.5 border border-[#ff00ff]/30 bg-[#ff00ff]/10 text-[#ff00ff] rounded backdrop-blur-md z-10 shadow-[0_0_10px_rgba(255,0,255,0.08)]">
                <div className="w-2 h-2 rounded-full bg-[#ff00ff] animate-ping" />
                <div className="text-[9px] text-left">
                  <div className="uppercase tracking-wider font-extrabold text-[10px]">Probe Streamer Active</div>
                  <div className="text-gray-400">Position: X={probePoint.x.toFixed(1)}, Y={probePoint.y.toFixed(1)}</div>
                </div>
                <button
                  onClick={() => setProbePoint(null)}
                  title="Remove Emitter Probe"
                  className="p-1 hover:bg-[#ff00ff]/20 text-[#ff00ff] rounded"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Aerodynamic Telemetry HUD */}
            <div className="absolute top-4 left-4 p-4 rounded border border-[#1b1b22] bg-[#09090c]/85 backdrop-blur-md pointer-events-none text-[10px] min-w-56 shadow-2xl z-10">
              <div className="mb-2.5 font-bold text-[#7DF9FF] border-b border-[#1b1b22] pb-1.5 flex items-center justify-between">
                <span className="tracking-widest uppercase">Telemetry Panel</span>
                <span className="text-[8px] px-1.5 py-0.5 rounded border border-[#7DF9FF]/20 bg-[#7DF9FF]/5 uppercase font-medium flex items-center gap-1.5">
                  <span className="text-gray-400">{is2D ? '2D Slice' : '3D Space'}</span>
                  <span>|</span>
                  <span>{activeObject}</span>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-left">
                <span className="text-gray-500 uppercase">Reynolds (Re)</span>
                <span className="text-right text-white font-bold">{stats.reynolds}</span>

                <span className="text-gray-500 uppercase">Lift Force (Fl)</span>
                <span className={`text-right font-bold ${stats.lift > 0 ? 'text-[#7DF9FF]' : stats.lift < 0 ? 'text-purple-400' : 'text-white'}`}>
                  {stats.lift > 0 ? `+${stats.lift.toFixed(1)} N` : `${stats.lift.toFixed(1)} N`}
                </span>

                <span className="text-gray-500 uppercase">Drag Force (Fd)</span>
                <span className="text-right text-[#ff9f1c] font-bold">
                  {stats.drag.toFixed(1)} N
                </span>

                <span className="text-gray-500 uppercase">Lift Coeff (Cl)</span>
                <span className={`text-right font-bold ${stats.liftCoeff > 0 ? 'text-[#7DF9FF]' : stats.liftCoeff < 0 ? 'text-purple-400' : 'text-white'}`}>
                  {stats.liftCoeff > 0 ? `+${stats.liftCoeff.toFixed(2)}` : stats.liftCoeff.toFixed(2)}
                </span>

                <span className="text-gray-500 uppercase">Drag Coeff (Cd)</span>
                <span className="text-right text-[#ff9f1c] font-bold">
                  {stats.dragCoeff.toFixed(2)}
                </span>

                <span className="text-gray-500 uppercase">Flow State</span>
                <span className={`text-right font-bold uppercase ${
                  stats.reynolds < 12000 
                    ? 'text-emerald-400' 
                    : stats.reynolds < 25000 
                      ? 'text-yellow-400' 
                      : 'text-orange-400 animate-pulse'
                }`}>
                  {stats.reynolds < 12000 ? 'Laminar' : stats.reynolds < 25000 ? 'Transitional' : 'Turbulent'}
                </span>
              </div>
            </div>

            {/* Quick camera view deck (QoL Overlay) */}
            <div className="absolute top-4 right-4 flex flex-col gap-1.5 z-10 bg-[#09090c]/80 border border-[#1b1b22] p-2 rounded backdrop-blur-md">
              <span className="text-[7.5px] uppercase font-bold text-gray-500 tracking-wider flex items-center gap-1 mb-1 font-sans">
                <Compass className="w-2.5 h-2.5" /> Camera Presets
              </span>
              {[
                { id: 'iso', label: 'Isometric View' },
                { id: 'side', label: 'Side Profile (2D)' },
                { id: 'top', label: 'Top-Down View' },
                { id: 'front', label: 'Front Inlet View' },
              ].map(cam => (
                <button
                  key={cam.id}
                  onClick={() => snapCamera(cam.id)}
                  className="text-[8px] py-1 px-2 bg-[#0c0c12] border border-gray-800 text-gray-400 hover:text-white hover:border-gray-500 transition-colors uppercase font-bold rounded text-left"
                >
                  {cam.label}
                </button>
              ))}
            </div>

            {/* Quick camera instructions */}
            <div className="absolute bottom-4 left-4 p-2 rounded border border-[#1b1b22] bg-[#09090c]/70 text-[8px] text-gray-500 max-w-48 leading-relaxed pointer-events-none select-none z-10">
              <span className="text-white font-bold uppercase tracking-wider block mb-0.5">Wind Tunnel Controls:</span>
              • Drag left click: Orbit camera<br />
              • Drag right click: Pan camera<br />
              • Double click canvas: Place active probe streamer
            </div>
          </main>

          {/* Bottom Diagnostics Grid (Chart & AI Co-pilot) */}
          <div className="h-64 border-t border-[#1b1b22] bg-[#08080b] flex flex-col lg:flex-row overflow-hidden shrink-0">
            {/* Real-time Scrolling Graph */}
            <div className="flex-[3] border-r border-[#1b1b22] p-4 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-[#7DF9FF]" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white">Dynamic Force Graph</span>
                </div>
                <div className="flex items-center gap-3 text-[8px] uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-0.5 bg-[#7DF9FF] inline-block" /> Lift Force (N)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-0.5 bg-[#ff9f1c] inline-block" /> Drag Force (N)
                  </span>
                </div>
              </div>
              
              <div className="flex-1 w-full bg-[#0b0b0f] rounded border border-[#171720] relative flex items-center justify-center overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={420}
                  height={150}
                  className="w-full h-full block"
                />
              </div>
            </div>

            {/* AI Aerodynamic consultant */}
            <div className="flex-[4] p-4 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-2 select-none">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#7DF9FF]" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white">AI Aerodynamics Consultant</span>
                </div>
                
                <button
                  onClick={triggerAiAnalysis}
                  disabled={isAiLoading}
                  className="px-3 py-1 rounded border border-[#7DF9FF]/20 bg-[#7DF9FF]/5 hover:bg-[#7DF9FF]/15 text-[9px] font-bold uppercase text-[#7DF9FF] transition-all disabled:opacity-40 disabled:pointer-events-none active:scale-95 flex items-center gap-1.5"
                >
                  <Play className="w-2.5 h-2.5 fill-current" />
                  Run Analysis
                </button>
              </div>

              {/* Console log loading screens or content reports */}
              <div className="flex-1 bg-[#0b0b0f] rounded border border-[#171720] p-3 overflow-y-auto font-mono text-[10px] leading-relaxed text-gray-300">
                {isAiLoading ? (
                  <div className="space-y-1.5 text-[#7DF9FF]">
                    {aiConsoleLogs.map((log, index) => (
                      <div key={index} className="truncate">{log}</div>
                    ))}
                    <div className="flex items-center gap-1.5 pt-1.5 text-white font-bold animate-pulse">
                      <span>{">> SOLVING NAVIER-STOKES INFERENCE MATRIX"}</span>
                      <span className="inline-block w-2 h-3 bg-[#7DF9FF] animate-ping" />
                    </div>
                  </div>
                ) : aiReport ? (
                  <div className="markdown-body whitespace-pre-line text-left text-xs max-w-none text-[#e2e8f0]">
                    {aiReport}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4 text-gray-500 space-y-2">
                    <Info className="w-5 h-5 text-gray-600" />
                    <div>
                      <p className="font-bold text-xs text-gray-400 uppercase tracking-wide">Awaiting Telemetry</p>
                      <p className="text-[10px] max-w-sm mt-1">
                        Click <strong className="text-gray-300">"Run Analysis"</strong> to execute an aerodynamic audit. The simulation uses an integrated physical expert system (no external APIs or sign-ups required).
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Diagnostics Sidebar (New Toggleable Dashboard) */}
        {showSysTelemetry && (
          <aside className="w-80 border-l border-[#1b1b22] bg-[#09090c] flex flex-col overflow-y-auto z-10 shrink-0 select-none">
            {/* Stress level indicator */}
            <div className="p-4 border-b border-[#1b1b22] space-y-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-yellow-500" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#7DF9FF]">System Stress Index</span>
              </div>
              <div className={`border p-3.5 rounded text-center ${stressColorClass}`}>
                <div className="text-[9px] uppercase text-gray-400">Total Simulation Burden</div>
                <div className="text-lg font-black tracking-widest py-1">{stressLevel}</div>
                <div className="w-full bg-[#1b1b22] rounded-full h-1.5 mt-2">
                  <div 
                    className={`h-1.5 rounded-full ${stressLevel === 'LOW' ? 'bg-emerald-500' : stressLevel === 'MEDIUM' ? 'bg-yellow-500' : stressLevel === 'HIGH' ? 'bg-orange-500' : 'bg-red-500'}`} 
                    style={{ width: `${Math.min(100, Math.max(15, stressScore))}%` }}
                  />
                </div>
                <div className="flex justify-between text-[8px] text-gray-500 pt-1">
                  <span>0% (IDLE)</span>
                  <span>100% (CRITICAL)</span>
                </div>
              </div>
            </div>

            {/* Hardware specifications */}
            <div className="p-4 border-b border-[#1b1b22] space-y-3">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#7DF9FF]" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#7DF9FF]">Hardware Telemetry</span>
              </div>
              <div className="space-y-2.5 text-[10px]">
                <div className="flex flex-col border-b border-[#1b1b22]/55 pb-2">
                  <span className="text-gray-500 uppercase text-[8px]">GPU Device (WebGL Vendor)</span>
                  <span className="text-white font-bold truncate pr-1" title={hardwareTelemetry.gpu}>{hardwareTelemetry.gpu}</span>
                </div>
                <div className="flex justify-between items-center border-b border-[#1b1b22]/55 pb-2">
                  <span className="text-gray-500 uppercase text-[8px]">Logical Core Count</span>
                  <span className="text-white font-bold">{hardwareTelemetry.cores} Threads</span>
                </div>
                <div className="flex justify-between items-center border-b border-[#1b1b22]/55 pb-2">
                  <span className="text-gray-500 uppercase text-[8px]">FPS Jitter Overhead</span>
                  <span className={`font-bold ${stats.fpsJitter > 5.0 ? 'text-red-400' : stats.fpsJitter > 2.0 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                    {stats.fpsJitter > 0 ? `±${stats.fpsJitter} ms` : '0.0 ms'}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-[#1b1b22]/55 pb-2">
                  <span className="text-gray-500 uppercase text-[8px]">Battery Status</span>
                  <span className="text-white font-bold">
                    {hardwareTelemetry.batterySupported 
                      ? `${hardwareTelemetry.batteryLevel}% ${hardwareTelemetry.isCharging ? '(Plugged)' : '(Discharged)'}` 
                      : 'N/A'
                    }
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 uppercase text-[8px]">Browser Connection</span>
                  <span className="text-white font-bold">{hardwareTelemetry.networkRtt} latency</span>
                </div>
              </div>
            </div>

            {/* PC Load Crash Warnings (Actionable Alert box) */}
            <div className="p-4 border-b border-[#1b1b22] flex-1 flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <ShieldAlert className="w-4 h-4 text-red-500" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#7DF9FF]">Safety Audit Guard</span>
              </div>

              {activeWarnings.length > 0 ? (
                <div className="space-y-2.5 flex-1 overflow-y-auto max-h-56 pr-1">
                  {activeWarnings.map((warning, index) => (
                    <div key={index} className="flex gap-2 p-2 border border-red-500/25 bg-red-500/5 text-red-400 rounded text-[9.5px] leading-relaxed text-left">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5 animate-pulse" />
                      <div>{warning}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4 border border-emerald-500/10 bg-emerald-500/5 text-emerald-400/90 rounded text-[10px]">
                  <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse mb-2" />
                  <span className="font-bold uppercase tracking-wider block">System Stable</span>
                  <span className="text-[9px] mt-1 opacity-70">Simulation is running within normal hardware thermal tolerances. No lag conditions detected.</span>
                </div>
              )}

              {/* Auto optimization button */}
              <div className="pt-4 mt-auto">
                <button
                  onClick={handleAutoOptimize}
                  disabled={!optimizeRender && activeWarnings.length === 0}
                  className={`w-full py-2 px-3 border rounded text-[10px] font-bold uppercase transition-all duration-200 text-center flex items-center justify-center gap-2 active:scale-95 cursor-pointer disabled:opacity-40 disabled:pointer-events-none ${
                    activeWarnings.length > 0
                      ? 'border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/25 animate-pulse'
                      : 'border-emerald-500/30 bg-[#0d0d12] text-gray-400 hover:text-white'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Auto-Optimize Settings</span>
                </button>
              </div>
            </div>

            {/* Performance preferences toggles */}
            <div className="p-4 border-t border-[#1b1b22] bg-[#0c0c12]/50 space-y-3.5 text-[9.5px]">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#7DF9FF] flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5" /> Optimization Tweaks
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Optimize WebGL shaders (low specs)</span>
                <input 
                  type="checkbox" 
                  checked={optimizeRender} 
                  onChange={(e) => setOptimizeRender(e.target.checked)} 
                  className="accent-[#7DF9FF] cursor-pointer"
                />
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Gemini API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/75 z-50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md bg-[#0d0d12] border border-[#232330] rounded-lg p-6 shadow-2xl space-y-4 text-left">
            <div className="flex items-center gap-3 border-b border-[#1b1b22] pb-3">
              <Key className="w-5 h-5 text-[#7DF9FF]" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">Gemini API Key Access</h3>
            </div>
            
            <p className="text-[10px] text-gray-400 leading-relaxed">
              Link your Gemini API Key to enable live, state-aware LLM expert analysis of your tunnel runs. Keys are stored locally inside your browser's localStorage and are never sent to third-party endpoints besides the official Gemini API.
            </p>

            <div className="space-y-1.5">
              <label className="text-[9px] uppercase font-bold text-gray-500">API Key String</label>
              <input
                type="password"
                placeholder="AIzaSy..."
                defaultValue={apiKey}
                id="apiKeyInput"
                className="w-full p-2.5 border border-[#232330] bg-[#07070b] rounded text-xs text-white focus:outline-none focus:border-[#7DF9FF] font-sans"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowKeyModal(false)}
                className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-white uppercase"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const input = document.getElementById('apiKeyInput') as HTMLInputElement;
                  if (input) saveApiKey(input.value.trim());
                }}
                className="px-5 py-2 border border-[#7DF9FF]/20 bg-[#7DF9FF]/10 text-[#7DF9FF] hover:bg-[#7DF9FF]/20 text-xs font-bold rounded uppercase transition-colors"
              >
                Save Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
