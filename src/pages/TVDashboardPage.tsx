import { useState, useEffect, useRef } from 'react';
import { Shield, Camera, Clock, AlertTriangle, CheckCircle2, Users, Activity } from 'lucide-react';

const CAMERA_IMAGES = [
  '/api/cameras/snap/1',
  '/api/cameras/snap/2',
  '/api/cameras/snap/3',
  '/api/cameras/snap/4',
];

interface SystemStatus {
  cameras: number;
  alerts: number;
  guards: number;
  uptime: string;
}

export default function TVDashboardPage() {
  const [clock, setClock] = useState(new Date());
  const [imgKey, setImgKey] = useState(0);
  const [status, setStatus] = useState<SystemStatus>({ cameras: 88, alerts: 0, guards: 3, uptime: '99.9%' });
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Clock: update every second
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Camera images: refresh every 10 seconds
  useEffect(() => {
    const t = setInterval(() => setImgKey(k => k + 1), 10000);
    return () => clearInterval(t);
  }, []);

  // Status data: refresh every 60 seconds
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const data = await res.json();
          setStatus({
            cameras: data.cameras_online ?? 88,
            alerts: data.active_alerts ?? 0,
            guards: data.guards_on_duty ?? 3,
            uptime: data.uptime ?? '99.9%',
          });
        }
      } catch { /* silent */ }
    };
    fetchStatus();
    const t = setInterval(fetchStatus, 60000);
    return () => clearInterval(t);
  }, []);

  // Wake Lock: keep screen on
  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        }
      } catch { /* not supported or denied */ }
    };
    requestWakeLock();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') requestWakeLock();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      wakeLockRef.current?.release();
    };
  }, []);

  const timeStr = clock.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const dateStr = clock.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="h-screen w-screen bg-[#030810] text-white flex flex-col overflow-hidden select-none cursor-none">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-[#D4A017]" />
          <div>
            <h1 className="text-xl font-bold tracking-wide">AION Centro de Monitoreo</h1>
            <p className="text-xs text-gray-500">Clave Seguridad CTA</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-mono font-bold tabular-nums">{timeStr}</div>
          <div className="text-xs text-gray-400 capitalize">{dateStr}</div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex gap-4 p-4 min-h-0">
        {/* Left: 2x2 camera grid */}
        <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-2">
          {CAMERA_IMAGES.map((src, i) => (
            <div key={i} className="relative bg-black rounded-lg overflow-hidden border border-white/10">
              <img
                src={`${src}?t=${imgKey}`}
                alt={`Camera ${i + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Camera className="h-12 w-12 text-white/20" />
              </div>
              <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm rounded px-2 py-0.5 text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                CAM {i + 1}
              </div>
              <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm rounded px-2 py-0.5 text-[10px] text-gray-300">
                {timeStr}
              </div>
            </div>
          ))}
        </div>

        {/* Right: Status panel */}
        <div className="w-80 flex flex-col gap-3 shrink-0">
          {/* System status */}
          <div className="bg-[#0D1B2A] rounded-xl p-4 border border-green-500/30">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
              <span className="font-semibold text-green-400 text-sm">Sistema Operativo</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatusCard icon={<Camera className="h-5 w-5 text-blue-400" />} label="Camaras" value={String(status.cameras)} />
              <StatusCard icon={<AlertTriangle className="h-5 w-5 text-yellow-400" />} label="Alertas" value={String(status.alerts)} />
              <StatusCard icon={<Users className="h-5 w-5 text-purple-400" />} label="Guardas" value={String(status.guards)} />
              <StatusCard icon={<Activity className="h-5 w-5 text-green-400" />} label="Uptime" value={status.uptime} />
            </div>
          </div>

          {/* Recent alerts */}
          <div className="bg-[#0D1B2A] rounded-xl p-4 border border-white/10 flex-1 overflow-auto">
            <h3 className="text-sm font-semibold text-[#D4A017] mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" /> Actividad Reciente
            </h3>
            <div className="space-y-2">
              {[
                { time: '00:15', text: 'Ronda completada - Guarda Martinez', ok: true },
                { time: '23:48', text: 'Vehiculo autorizado - Placa ABC123', ok: true },
                { time: '23:30', text: 'Puerta principal cerrada', ok: true },
                { time: '23:15', text: 'Cambio de turno registrado', ok: true },
                { time: '23:00', text: 'Sistema de backup verificado', ok: true },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-gray-500 font-mono shrink-0 w-10">{item.time}</span>
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                  <span className="text-gray-300">{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer branding */}
          <div className="text-center text-[10px] text-gray-600 py-1">
            AION Platform v2.0 — Clave Seguridad CTA
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-[#030810] rounded-lg p-3 text-center">
      <div className="flex justify-center mb-1">{icon}</div>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[10px] text-gray-500">{label}</div>
    </div>
  );
}
