import { useState, useEffect } from 'react';
import { Clock, User, Activity, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

function getShiftName(hour: number): string {
  if (hour >= 6 && hour < 14) return 'Mañana (06:00-14:00)';
  if (hour >= 14 && hour < 22) return 'Tarde (14:00-22:00)';
  return 'Noche (22:00-06:00)';
}

export function OperatorStatusBar() {
  const { user, profile } = useAuth();
  const [now, setNow] = useState(new Date());
  const [sessionStart] = useState(new Date());
  const [lastActivity, setLastActivity] = useState(new Date());
  const [isActive, setIsActive] = useState(true);

  // Clock tick every second
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Activity tracking
  useEffect(() => {
    const handleActivity = () => {
      setLastActivity(new Date());
      setIsActive(true);
    };
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);

    const idleCheck = setInterval(() => {
      const idle = (Date.now() - lastActivity.getTime()) / 1000;
      setIsActive(idle < 300); // 5 min idle threshold
    }, 30000);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      clearInterval(idleCheck);
    };
  }, [lastActivity]);

  const sessionMinutes = Math.floor((now.getTime() - sessionStart.getTime()) / 60000);
  const hours = Math.floor(sessionMinutes / 60);
  const mins = sessionMinutes % 60;
  const shift = getShiftName(now.getHours());

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t border-border px-4 py-1.5 flex items-center justify-between text-xs text-muted-foreground">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
          <User className="h-3 w-3" />
          <span className="font-medium text-foreground">{profile?.full_name || user?.email || 'Operador'}</span>
        </div>
        <div className="flex items-center gap-1">
          <Activity className="h-3 w-3" />
          <span>{isActive ? 'Activo' : 'Inactivo'}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          <span>Turno: {shift}</span>
        </div>
        <div className="flex items-center gap-1">
          <span>Sesión: {hours}h {mins}m</span>
        </div>
        <div className="flex items-center gap-1 font-mono text-foreground">
          <Clock className="h-3 w-3" />
          <span>{now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>
      </div>
    </div>
  );
}
