import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

const REMINDERS = [
  { minutes: 30, message: 'Recordatorio: Realizar ronda de verificacion' },
  { minutes: 60, message: 'Recordatorio: Registrar novedad en la minuta' },
  { minutes: 120, message: 'Recordatorio: Verificar estado de camaras' },
  { minutes: 180, message: 'Recordatorio: Revision de accesos y puertas' },
];

export default function AutoReminders() {
  const startRef = useRef(Date.now());

  useEffect(() => {
    const timers = REMINDERS.map(r =>
      setTimeout(() => {
        toast.info(r.message, { duration: 10000 });
      }, r.minutes * 60 * 1000)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return null;
}
