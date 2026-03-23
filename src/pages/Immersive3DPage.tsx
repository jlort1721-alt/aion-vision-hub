import React, { useRef, useEffect, useState, Suspense, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Environment, Html, ContactShadows, Text } from '@react-three/drei';
import * as THREE from 'three';
import { GestureRecognizer, FilesetResolver } from '@mediapipe/tasks-vision';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDevices, useSites } from '@/hooks/use-supabase-data';
import { useDigitalTwinMQTT } from '@/hooks/use-digital-twin';
import { Hand, Eye, Loader2, ArrowLeft, RefreshCw, Crosshair, AlertTriangle, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

// ─── 3D Node Component (Camera / Post) ──────────────────────────────────────
function HolographicNode({ position, data, onClick, isHovered }: any) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const isAlarm = data.twinState === 'alarm';
  const isWarning = data.twinState === 'warning';
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += isAlarm ? 0.05 : 0.01;
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * (isAlarm ? 8 : 2) + position[0]) * (isAlarm ? 0.5 : 0.2);
    }
  });

  const nodeColor = isAlarm ? '#ff0000' : isWarning ? '#ffcc00' : (data.status === 'online' ? '#00ff88' : '#ff3366');

  return (
    <group position={position}>
      <mesh ref={meshRef} onClick={onClick}>
        <octahedronGeometry args={[isAlarm ? 0.7 : 0.5, 0]} />
        <meshStandardMaterial 
          color={nodeColor} 
          wireframe={!isHovered} 
          emissive={nodeColor} 
          emissiveIntensity={isHovered || isAlarm ? 2 : 0.5} 
          transparent
          opacity={isAlarm ? 1 : 0.8}
        />
      </mesh>
      
      {/* Floating Hologram Label */}
      <Html position={[0, 1.2, 0]} center zIndexRange={[100, 0]}>
        <div className={`transition-all duration-300 ${isHovered ? 'scale-110 opacity-100' : 'scale-90 opacity-60'}`}>
          <div className="bg-black/80 backdrop-blur-md border border-primary/50 text-white p-2 rounded-lg min-w-[140px] pointer-events-none shadow-[0_0_15px_rgba(0,255,136,0.3)]">
            <div className={`flex justify-between items-center mb-1 border-b pb-1 ${isAlarm ? 'border-red-500/50' : 'border-white/10'}`}>
              <span className={`text-[10px] uppercase font-bold tracking-widest ${isAlarm ? 'text-red-500' : isWarning ? 'text-yellow-400' : 'text-primary'}`}>{data.twinState ? `TWIN: ${data.twinState}` : data.type}</span>
              <div className={`w-2 h-2 rounded-full ${isAlarm ? 'bg-red-500 shadow-[0_0_8px_#ff0000] animate-ping' : (data.status === 'online' ? 'bg-emerald-400 shadow-[0_0_5px_#34d399]' : 'bg-red-500 shadow-[0_0_5px_#ef4444]')}`} />
            </div>
            <p className="font-mono text-xs truncate max-w-[120px]">{data.name}</p>
            <p className="text-[9px] text-muted-foreground">{data.ip_address || data.brand}</p>
          </div>
        </div>
      </Html>
    </group>
  );
}

// ─── Procedural Corporate Architecture ────────────────────────────────────────
function CorporateHQ({ hasAlarms }: { hasAlarms: boolean }) {
  const buildingRef = useRef<THREE.Group>(null);
  const domeRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (domeRef.current) {
      // Gentle pulsing effect for the energy dome, aggressive if alarms active
      domeRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * (hasAlarms ? 5 : 0.5)) * (hasAlarms ? 0.05 : 0.02));
      domeRef.current.rotation.y = state.clock.elapsedTime * (hasAlarms ? 0.3 : 0.1);
    }
  });

  return (
    <group position={[0, -2, 0]}>
      {/* Energy Dome / Shield */}
      <mesh ref={domeRef} position={[0, 0, 0]}>
        <sphereGeometry args={[15, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={hasAlarms ? "#ff0000" : "#00ffff"} wireframe transparent opacity={hasAlarms ? 0.15 : 0.05} />
      </mesh>

      {/* Main Core Building */}
      <mesh position={[0, 4, 0]}>
        <cylinderGeometry args={[2, 3, 12, 8]} />
        <meshStandardMaterial color="#112233" transparent opacity={0.8} />
        <lineSegments>
          <edgesGeometry attach="geometry" args={[new THREE.CylinderGeometry(2, 3, 12, 8)]} />
          <lineBasicMaterial attach="material" color="#00ffcc" transparent opacity={0.4} />
        </lineSegments>
      </mesh>

      {/* Auxiliary Servers / Wings */}
      {[...Array(6)].map((_, i) => (
        <mesh key={`wing-${i}`} position={[Math.cos(i * Math.PI / 3) * 6, 2, Math.sin(i * Math.PI / 3) * 6]}>
          <boxGeometry args={[1.5, 8, 1.5]} />
          <meshStandardMaterial color="#001122" transparent opacity={0.9} />
          <lineSegments>
            <edgesGeometry attach="geometry" args={[new THREE.BoxGeometry(1.5, 8, 1.5)]} />
            <lineBasicMaterial attach="material" color="#0088ff" transparent opacity={0.3} />
          </lineSegments>
        </mesh>
      ))}

      {/* Holographic Base Ring */}
      <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[10, 10.5, 64]} />
        <meshBasicMaterial color="#00ff88" side={THREE.DoubleSide} transparent opacity={0.4} />
      </mesh>
    </group>
  );
}

// ─── The Main 3D Space ──────────────────────────────────────────────────────
function CyberspaceEnvironment({ devices, handCoords, telemetryState, hasAlarms }: { devices: any[], handCoords: {x: number, y: number} | null, telemetryState: any, hasAlarms: boolean }) {
  const controlsRef = useRef<any>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Scatter devices conceptually across a circle map, attaching Twin State
  const nodes = useMemo(() => {
    // Array of mock telemetries to map linearly to random devices for the demo 
    const twinKeys = Object.keys(telemetryState);

    return devices.slice(0, 30).map((d, i, arr) => {
      const angle = (i / arr.length) * Math.PI * 2;
      const radius = 5 + Math.random() * 5;
      const tKey = twinKeys[i % twinKeys.length]; 

      return {
        ...d,
        twinState: telemetryState[tKey]?.state || 'online',
        position: [Math.cos(angle) * Math.sin(radius) * 10, Math.random() * 2, Math.sin(angle) * Math.cos(radius) * 10]
      };
    });
  }, [devices, telemetryState]);

  // Hand gesture mapping to camera
  useFrame(() => {
    if (controlsRef.current && handCoords) {
      // Map hand X/Y coordinates ([0,1]) to rotation angles.
      // E.g. placing hand at left rotates left, etc.
      const targetAzimuthAngle = (0.5 - handCoords.x) * Math.PI * 1.5;
      const targetPolarAngle = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, handCoords.y * Math.PI));
      
      controlsRef.current.setAzimuthalAngle(THREE.MathUtils.lerp(controlsRef.current.getAzimuthalAngle(), targetAzimuthAngle, 0.05));
      controlsRef.current.setPolarAngle(THREE.MathUtils.lerp(controlsRef.current.getPolarAngle(), targetPolarAngle, 0.05));
      controlsRef.current.update();
    }
  });

  return (
    <>
      <ambientLight intensity={0.1} />
      <directionalLight position={[10, 20, 10]} intensity={1.5} color="#00ffcc" />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#ff0066" />
      
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={1} fade speed={1} />
      
      {/* Grid Floor Array */}
      <gridHelper args={[50, 50, '#00ff88', '#113322']} position={[0, -2, 0]} />
      
      {/* Structural Volumetrics */}
      <CorporateHQ hasAlarms={hasAlarms} />
      
      <group>
        {nodes.map((node: any) => (
          <HolographicNode 
            key={node.id} 
            position={node.position} 
            data={node}
            isHovered={hoveredId === node.id}
            onClick={() => setHoveredId(node.id)}
          />
        ))}
      </group>

      <OrbitControls 
        ref={controlsRef} 
        makeDefault 
        minPolarAngle={0} 
        maxPolarAngle={Math.PI / 2 + 0.1} 
        enablePan={false}
        enableZoom={true}
        autoRotate={!handCoords}
        autoRotateSpeed={0.5}
      />
      <ContactShadows resolution={1024} scale={50} blur={2} opacity={0.5} far={10} color="#00ff88" />
    </>
  );
}

// ─── Main Page Assembler ────────────────────────────────────────────────────
export default function Immersive3DPage() {
  const navigate = useNavigate();
  const { data: devices = [] } = useDevices();
  const { telemetryState, activeAlarms, twinSyncStatus } = useDigitalTwinMQTT();
  const [gestureStatus, setGestureStatus] = useState<'loading' | 'active' | 'error' | 'idle'>('loading');
  const [handCoords, setHandCoords] = useState<{x: number, y: number} | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const recognizerRef = useRef<GestureRecognizer | null>(null);

  useEffect(() => {
    let unmounted = false;
    let animFrame: number;

    const initializeMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        const recognizer = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO"
        });
        
        if (unmounted) return;
        recognizerRef.current = recognizer;
        
        // Start camera
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 320, height: 240 } });
        if (videoRef.current && !unmounted) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setGestureStatus('active');
          toast.success('Holo-Gestures Online', { description: 'Raise your hand to the camera to rotate the 3D grid.' });
          
          const predictWebcam = () => {
            if (videoRef.current && recognizerRef.current && videoRef.current.videoWidth > 0) {
              const nowInMs = Date.now();
              const results = recognizerRef.current.recognizeForVideo(videoRef.current, nowInMs);
              
              if (results.landmarks && results.landmarks.length > 0) {
                // Get the center roughly based on wrist and index finger
                const wrist = results.landmarks[0][0]; // 0 is wrist
                setHandCoords({ x: wrist.x, y: wrist.y });
              } else {
                setHandCoords(null);
              }
            }
            if (!unmounted) {
              animFrame = requestAnimationFrame(predictWebcam);
            }
          };
          animFrame = requestAnimationFrame(predictWebcam);
        }
      } catch (err: any) {
        console.error('MediaPipe Error:', err);
        setGestureStatus('error');
        toast.error('Gesture Control Failed', { description: err.message });
      }
    };

    initializeMediaPipe();

    return () => {
      unmounted = true;
      cancelAnimationFrame(animFrame);
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(t => t.stop());
      }
      if (recognizerRef.current) {
        recognizerRef.current.close();
      }
    };
  }, []);

  return (
    <div className="relative w-full h-[calc(100vh-3.5rem)] bg-zinc-950 overflow-hidden font-sans">
      
      {/* HUD Overlay: Title & Breadcrumbs */}
      <div className="absolute top-0 left-0 right-0 p-6 z-10 pointer-events-none flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-cyan-400 tracking-tighter drop-shadow-sm">
            HOLO-DECK <span className="text-white">COMMAND</span>
          </h1>
          <p className="text-primary/70 font-mono text-sm tracking-widest uppercase mt-1">Spatial Operative Monitoring Center</p>
        </div>
        
        <div className="pointer-events-auto flex items-center gap-3">
          <Badge variant="outline" className={`px-3 py-1 bg-black/50 backdrop-blur-md border-white/20 font-mono flex items-center gap-2 shadow-2xl ${handCoords ? 'border-primary text-primary' : ''}`}>
             <Hand className={`h-4 w-4 ${handCoords ? 'animate-pulse' : 'opacity-40'}`} />
             {gestureStatus === 'loading' && <Loader2 className="h-3 w-3 animate-spin"/>}
             {gestureStatus === 'active' && (handCoords ? 'TRACKING LOCK' : 'WAITING FOR HAND')}
             {gestureStatus === 'error' && <AlertTriangle className="h-3 w-3 text-red-500" />}
          </Badge>
          <Button variant="secondary" size="icon" onClick={() => navigate('/live')} className="pointer-events-auto bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border-white/10 border">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 3D Canvas Context */}
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 5, 20], fov: 45 }}>
          <Suspense fallback={null}>
            <CyberspaceEnvironment devices={devices} handCoords={handCoords} telemetryState={telemetryState} hasAlarms={activeAlarms.length > 0} />
          </Suspense>
        </Canvas>
      </div>

      {/* Hidden Webcam for Task Vision Engine */}
      <video ref={videoRef} className="absolute bottom-4 right-4 h-32 w-48 object-cover rounded-xl border border-white/20 z-10 shadow-2xl opacity-50 hover:opacity-100 transition-opacity bg-black" playsInline muted />
      
      {/* Sci-if Decorative Overlays */}
      <div className="absolute bottom-8 left-8 z-10 pointer-events-none opacity-40 mix-blend-screen">
        <Crosshair className="h-16 w-16 text-primary animate-[spin_10s_linear_infinite]" />
      </div>

      {/* System Metrics Panel */}
      <div className="absolute bottom-8 left-32 z-10 p-4 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl w-64 shadow-2xl pointer-events-none flex flex-col gap-2">
        <div className="flex justify-between items-center w-full">
          <span className="text-[10px] text-white/50 uppercase font-mono tracking-wider">Active Nodes</span>
          <span className="text-xl font-bold text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">{devices.length}</span>
        </div>
        <div className="flex justify-between items-center w-full">
          <span className="text-[10px] text-white/50 uppercase font-mono tracking-wider">Twin Telemetry</span>
          <span className={`text-xs font-bold ${twinSyncStatus === 'SYNCING' ? 'text-primary animate-pulse' : 'text-primary/50'}`}>
            {twinSyncStatus} <Activity className="inline w-3 h-3 ml-1" />
          </span>
        </div>
        <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden my-1">
          <div className="bg-primary h-full w-[85%] shadow-[0_0_10px_#00ff88]" />
        </div>
        
        {activeAlarms.length > 0 && (
           <div className="flex justify-between items-center w-full bg-red-500/20 border border-red-500/50 p-2 rounded animate-pulse mt-1">
             <span className="text-[10px] text-red-100 uppercase font-mono font-bold tracking-wider flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> CRITICAL EVENTS</span>
             <span className="text-sm font-bold text-red-400 drop-shadow-[0_0_8px_rgba(255,0,0,0.8)]">{activeAlarms.length}</span>
           </div>
        )}
      </div>

    </div>
  );
}
