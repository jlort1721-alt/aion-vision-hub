import { useState, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Search,
  BookOpen,
  LayoutDashboard,
  Video,
  DoorOpen,
  Cpu,
  AlertTriangle,
  ClipboardList,
  BarChart3,
  Bot,
  Phone,
  Settings,
  HelpCircle,
  Rocket,
  Grid3X3,
  RotateCcw,
  UserPlus,
  Car,
  ScrollText,
  ToggleRight,
  Siren,
  Wifi,
  WifiOff,
  PlusCircle,
  BellRing,
  MessageSquare,
  Database,
  PhoneCall,
  PhoneIncoming,
  Zap,
  Users,
  FileText,
  Shield,
  Menu,
  ChevronRight,
  Lightbulb,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ──────────────────────────────────────────────
   Types
   ────────────────────────────────────────────── */
interface ManualSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  badge?: string;
  content: React.ReactNode;
}

/* ──────────────────────────────────────────────
   Reusable small components
   ────────────────────────────────────────────── */
function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 items-start mb-3">
      <span className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold">
        {n}
      </span>
      <span className="text-sm leading-relaxed pt-0.5">{children}</span>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 items-start rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40 p-3 my-3">
      <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
      <span className="text-sm text-blue-800 dark:text-blue-200">{children}</span>
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 items-start rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 p-3 my-3">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
      <span className="text-sm text-amber-800 dark:text-amber-200">{children}</span>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/* ──────────────────────────────────────────────
   Section content
   ────────────────────────────────────────────── */

function InicioRapidoContent() {
  return (
    <div className="space-y-4">
      <SectionCard title="Iniciar sesión">
        <Step n={1}>Abra el navegador y vaya a la dirección del sistema AION.</Step>
        <Step n={2}>Escriba su <strong>correo electrónico</strong> y <strong>contraseña</strong>.</Step>
        <Step n={3}>Haga clic en <Badge variant="secondary">Iniciar sesión</Badge>.</Step>
        <Step n={4}>Si es su primer ingreso, el sistema le pedirá cambiar la contraseña.</Step>
        <Tip>Si olvidó su contraseña, use el enlace "¿Olvidó su contraseña?" en la pantalla de inicio.</Tip>
      </SectionCard>

      <SectionCard title="Dashboard principal">
        <p className="text-sm text-muted-foreground mb-3">
          Al ingresar verá el panel principal con información resumida del sistema:
        </p>
        <ul className="list-disc list-inside text-sm space-y-1.5 text-muted-foreground">
          <li><strong>Dispositivos activos</strong> — cantidad de cámaras y sensores en línea.</li>
          <li><strong>Eventos recientes</strong> — últimas alertas y novedades.</li>
          <li><strong>Estado de sedes</strong> — resumen por cada sede operativa.</li>
          <li><strong>Gráficas</strong> — tendencia de eventos por hora y tipo.</li>
        </ul>
      </SectionCard>

      <SectionCard title="Navegación del menú lateral">
        <p className="text-sm text-muted-foreground mb-3">
          El menú lateral izquierdo le permite acceder a todos los módulos. Cada icono representa una función:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2"><Video className="h-4 w-4 text-muted-foreground" /> Video en Vivo</div>
          <div className="flex items-center gap-2"><DoorOpen className="h-4 w-4 text-muted-foreground" /> Control de Acceso</div>
          <div className="flex items-center gap-2"><Cpu className="h-4 w-4 text-muted-foreground" /> Dispositivos IoT</div>
          <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-muted-foreground" /> Eventos</div>
          <div className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-muted-foreground" /> Operaciones</div>
          <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-muted-foreground" /> Reportes</div>
          <div className="flex items-center gap-2"><Bot className="h-4 w-4 text-muted-foreground" /> Agente IA</div>
          <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> Panel Telefónico</div>
        </div>
        <Tip>En pantallas pequeñas, el menú se oculta. Toque el icono <Menu className="inline h-4 w-4" /> para abrirlo.</Tip>
      </SectionCard>

      <SectionCard title="Asistente IA (botón flotante)">
        <p className="text-sm text-muted-foreground mb-3">
          En la esquina inferior derecha de la pantalla hay un botón flotante con el icono del asistente.
        </p>
        <Step n={1}>Haga clic en el botón flotante <Bot className="inline h-4 w-4" />.</Step>
        <Step n={2}>Escriba su pregunta en lenguaje natural.</Step>
        <Step n={3}>El asistente consultará la base de datos y le dará una respuesta.</Step>
        <Tip>Puede preguntar cosas como: "¿Cuántas cámaras están offline?" o "¿Cuál es el protocolo de emergencia?".</Tip>
      </SectionCard>
    </div>
  );
}

function DashboardContent() {
  return (
    <div className="space-y-4">
      <SectionCard title="Vista general del Dashboard">
        <p className="text-sm text-muted-foreground mb-3">
          El panel principal muestra información en tiempo real de toda la operación de seguridad.
        </p>
        <ul className="list-disc list-inside text-sm space-y-1.5 text-muted-foreground">
          <li><strong>Tarjetas de resumen</strong> — dispositivos, eventos, alertas activas.</li>
          <li><strong>Gráficas de actividad</strong> — eventos por hora, distribución por tipo.</li>
          <li><strong>Estado de sedes</strong> — cada sede con indicador de color (verde = normal, rojo = alerta).</li>
          <li><strong>Eventos recientes</strong> — lista de los últimos eventos registrados.</li>
        </ul>
      </SectionCard>

      <SectionCard title="Controles rápidos">
        <p className="text-sm text-muted-foreground mb-3">
          Desde el dashboard puede realizar acciones rápidas:
        </p>
        <ul className="list-disc list-inside text-sm space-y-1.5 text-muted-foreground">
          <li><strong>Apertura rápida de puerta</strong> — botón directo para abrir puertas principales.</li>
          <li><strong>Ver cámaras</strong> — enlace rápido a la vista de video en vivo.</li>
          <li><strong>Crear incidente</strong> — botón para registrar una novedad inmediata.</li>
        </ul>
      </SectionCard>

      <SectionCard title="Panel multi-sede">
        <p className="text-sm text-muted-foreground mb-3">
          Si opera varias sedes, el dashboard muestra un resumen consolidado. Haga clic en cualquier sede para ver su detalle.
        </p>
      </SectionCard>
    </div>
  );
}

function VideoEnVivoContent() {
  return (
    <div className="space-y-4">
      <SectionCard title="Ver cámaras por sede">
        <Step n={1}>Vaya a <Badge variant="secondary">Video en Vivo</Badge> en el menú lateral.</Step>
        <Step n={2}>Seleccione la <strong>sede</strong> en el selector superior.</Step>
        <Step n={3}>Las cámaras de esa sede se mostrarán en una cuadrícula.</Step>
      </SectionCard>

      <SectionCard title="Cambiar la cuadrícula (Grid)">
        <p className="text-sm text-muted-foreground mb-3">
          Puede elegir cuántas cámaras ver al mismo tiempo:
        </p>
        <div className="flex gap-3 mb-3">
          <Badge variant="outline"><Grid3X3 className="inline h-3 w-3 mr-1" />2x2</Badge>
          <Badge variant="outline"><Grid3X3 className="inline h-3 w-3 mr-1" />3x3</Badge>
          <Badge variant="outline"><Grid3X3 className="inline h-3 w-3 mr-1" />4x4</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Use los botones de cuadrícula en la barra superior de la vista de video.
        </p>
      </SectionCard>

      <SectionCard title="Pantalla completa">
        <p className="text-sm text-muted-foreground mb-3">
          Para ampliar una cámara a pantalla completa:
        </p>
        <Step n={1}>Haga <strong>doble clic</strong> sobre la cámara que desea ampliar.</Step>
        <Step n={2}>La cámara se mostrará en pantalla completa.</Step>
        <Step n={3}>Haga <strong>doble clic</strong> nuevamente o presione <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Esc</kbd> para volver a la cuadrícula.</Step>
      </SectionCard>

      <SectionCard title="Auto-rotación de cámaras">
        <p className="text-sm text-muted-foreground mb-3">
          La función de auto-rotación cambia automáticamente el grupo de cámaras visible cada cierto tiempo.
        </p>
        <Step n={1}>Active el switch de <Badge variant="secondary"><RotateCcw className="inline h-3 w-3 mr-1" />Auto-rotación</Badge>.</Step>
        <Step n={2}>Las cámaras rotarán automáticamente cada 30 segundos (configurable).</Step>
        <Tip>Útil para vigilancia nocturna cuando hay muchas cámaras y un solo monitor.</Tip>
      </SectionCard>
    </div>
  );
}

function ControlAccesoContent() {
  return (
    <div className="space-y-4">
      <SectionCard title="Registrar residente">
        <Step n={1}>Vaya a <Badge variant="secondary">Control de Acceso</Badge> en el menú.</Step>
        <Step n={2}>Haga clic en <Badge variant="secondary"><UserPlus className="inline h-3 w-3 mr-1" />Nuevo Residente</Badge>.</Step>
        <Step n={3}>Complete los datos: nombre, documento, torre/apartamento, teléfono.</Step>
        <Step n={4}>Haga clic en <Badge variant="secondary">Guardar</Badge>.</Step>
        <Tip>El residente quedará disponible para búsquedas y autorizaciones de acceso.</Tip>
      </SectionCard>

      <SectionCard title="Registrar vehículo">
        <Step n={1}>En el perfil del residente, busque la sección <strong>Vehículos</strong>.</Step>
        <Step n={2}>Haga clic en <Badge variant="secondary"><Car className="inline h-3 w-3 mr-1" />Agregar Vehículo</Badge>.</Step>
        <Step n={3}>Ingrese la <strong>placa</strong>, marca, color y tipo de vehículo.</Step>
        <Step n={4}>Guarde los cambios.</Step>
      </SectionCard>

      <SectionCard title="Buscar por placa">
        <Step n={1}>En la sección de Control de Acceso, use el campo de búsqueda.</Step>
        <Step n={2}>Escriba la <strong>placa del vehículo</strong> (ej: ABC123).</Step>
        <Step n={3}>El sistema mostrará el residente asociado y sus datos.</Step>
        <Tip>La búsqueda funciona también con placas parciales. Escriba al menos 3 caracteres.</Tip>
      </SectionCard>

      <SectionCard title="Logs de acceso">
        <p className="text-sm text-muted-foreground mb-3">
          Cada ingreso y salida queda registrado automáticamente. Para ver el historial:
        </p>
        <Step n={1}>Vaya a la pestaña <Badge variant="secondary"><ScrollText className="inline h-3 w-3 mr-1" />Historial</Badge>.</Step>
        <Step n={2}>Filtre por fecha, residente o tipo de acceso.</Step>
        <Step n={3}>Puede exportar los datos a Excel si lo necesita.</Step>
      </SectionCard>
    </div>
  );
}

function DispositivosIoTContent() {
  return (
    <div className="space-y-4">
      <SectionCard title="Lista de dispositivos eWeLink">
        <p className="text-sm text-muted-foreground mb-3">
          La sección de Domóticos muestra todos los dispositivos inteligentes conectados mediante eWeLink:
          puertas, sirenas, luces y otros actuadores.
        </p>
        <ul className="list-disc list-inside text-sm space-y-1.5 text-muted-foreground">
          <li><Wifi className="inline h-3 w-3 text-green-500" /> <strong>Online</strong> — el dispositivo está conectado y responde.</li>
          <li><WifiOff className="inline h-3 w-3 text-red-500" /> <strong>Offline</strong> — el dispositivo no responde. Verifique la conexión.</li>
        </ul>
      </SectionCard>

      <SectionCard title="Abrir puerta (toggle/pulse)">
        <Step n={1}>Busque el dispositivo de la puerta en la lista.</Step>
        <Step n={2}>Haga clic en el botón <Badge variant="secondary"><ToggleRight className="inline h-3 w-3 mr-1" />Abrir</Badge>.</Step>
        <Step n={3}>La puerta se abrirá por el tiempo configurado (modo pulse) o quedará abierta hasta que la cierre manualmente (modo toggle).</Step>
        <Tip>La mayoría de puertas están configuradas en modo <strong>pulse</strong> (se abren y cierran automáticamente después de unos segundos).</Tip>
      </SectionCard>

      <SectionCard title="Activar sirena">
        <Step n={1}>Busque la sirena en la lista de dispositivos.</Step>
        <Step n={2}>Haga clic en <Badge variant="secondary"><Siren className="inline h-3 w-3 mr-1" />Activar</Badge>.</Step>
        <Step n={3}>El sistema le pedirá <strong>confirmación</strong> antes de activar la sirena.</Step>
        <Step n={4}>Confirme para activar. La sirena sonará.</Step>
        <Warning>
          La activación de sirena genera una alerta audible para todos los residentes.
          Solo active la sirena en caso de emergencia real o prueba programada.
        </Warning>
      </SectionCard>

      <SectionCard title="Estado online/offline">
        <p className="text-sm text-muted-foreground mb-3">
          El sistema verifica el estado de cada dispositivo periódicamente. Si un dispositivo aparece como offline:
        </p>
        <ul className="list-disc list-inside text-sm space-y-1.5 text-muted-foreground">
          <li>Verifique que el dispositivo tenga energía eléctrica.</li>
          <li>Revise la conexión WiFi del dispositivo.</li>
          <li>Si persiste, reporte al supervisor de turno.</li>
        </ul>
      </SectionCard>
    </div>
  );
}

function EventosContent() {
  return (
    <div className="space-y-4">
      <SectionCard title="Crear un incidente">
        <Step n={1}>Vaya a <Badge variant="secondary">Eventos</Badge> o <Badge variant="secondary">Incidentes</Badge> en el menú.</Step>
        <Step n={2}>Haga clic en <Badge variant="secondary"><PlusCircle className="inline h-3 w-3 mr-1" />Nuevo Incidente</Badge>.</Step>
        <Step n={3}>Seleccione el <strong>tipo de incidente</strong> (intrusión, emergencia médica, falla técnica, etc.).</Step>
        <Step n={4}>Escriba una <strong>descripción</strong> clara de lo ocurrido.</Step>
        <Step n={5}>Seleccione la <strong>prioridad</strong> y la <strong>sede</strong>.</Step>
        <Step n={6}>Haga clic en <Badge variant="secondary">Crear</Badge>.</Step>
        <Tip>Sea lo más detallado posible en la descripción. Incluya hora, lugar exacto y personas involucradas.</Tip>
      </SectionCard>

      <SectionCard title="Atender una alerta">
        <Step n={1}>Cuando aparezca una alerta, haga clic en la notificación o vaya a <Badge variant="secondary"><BellRing className="inline h-3 w-3 mr-1" />Alertas</Badge>.</Step>
        <Step n={2}>Revise los detalles de la alerta.</Step>
        <Step n={3}>Haga clic en <Badge variant="secondary">Atender</Badge> para indicar que está gestionándola.</Step>
        <Step n={4}>Registre las acciones tomadas.</Step>
        <Step n={5}>Marque la alerta como <Badge variant="secondary">Resuelta</Badge> cuando termine.</Step>
      </SectionCard>

      <SectionCard title="Prioridades y severidades">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge className="bg-red-600 text-white">Crítica</Badge>
            <span className="text-sm text-muted-foreground">Emergencia inmediata. Requiere acción en menos de 5 minutos.</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-orange-500 text-white">Alta</Badge>
            <span className="text-sm text-muted-foreground">Situación urgente. Atender en menos de 15 minutos.</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-yellow-500 text-black">Media</Badge>
            <span className="text-sm text-muted-foreground">Requiere atención durante el turno actual.</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-blue-500 text-white">Baja</Badge>
            <span className="text-sm text-muted-foreground">Informativa. Puede atenderse en las próximas 24 horas.</span>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function OperacionesContent() {
  return (
    <div className="space-y-4">
      <SectionCard title="Gestión de turnos">
        <p className="text-sm text-muted-foreground mb-3">
          El módulo de operaciones permite registrar y gestionar los turnos de los guardas de seguridad.
        </p>
        <Step n={1}>Vaya a <Badge variant="secondary">Operaciones</Badge> en el menú.</Step>
        <Step n={2}>Seleccione <Badge variant="secondary">Turnos</Badge>.</Step>
        <Step n={3}>Registre el inicio de turno con la información del guarda entrante.</Step>
        <Step n={4}>Al finalizar, registre el cierre de turno con las novedades.</Step>
        <Tip>Registre todas las novedades del turno. Esta información queda en la minuta digital.</Tip>
      </SectionCard>

      <SectionCard title="Patrullas y rondas">
        <Step n={1}>En Operaciones, seleccione <Badge variant="secondary">Patrullas</Badge>.</Step>
        <Step n={2}>Inicie una nueva ronda indicando la ruta asignada.</Step>
        <Step n={3}>Registre cada punto de control al pasar por él.</Step>
        <Step n={4}>Al finalizar la ronda, marque como completada.</Step>
        <p className="text-sm text-muted-foreground mt-2">
          El sistema registra la hora de cada punto de control para verificar que la ronda se completó correctamente.
        </p>
      </SectionCard>

      <SectionCard title="Minuta digital">
        <p className="text-sm text-muted-foreground">
          La minuta recoge todas las novedades de cada turno. Incluye incidentes, accesos,
          rondas realizadas y observaciones del guarda. Se genera automáticamente y puede consultarse
          en <Badge variant="secondary">Reportes</Badge>.
        </p>
      </SectionCard>
    </div>
  );
}

function ReportesContent() {
  return (
    <div className="space-y-4">
      <SectionCard title="Generar reportes">
        <Step n={1}>Vaya a <Badge variant="secondary"><BarChart3 className="inline h-3 w-3 mr-1" />Reportes</Badge> en el menú.</Step>
        <Step n={2}>Seleccione el <strong>tipo de reporte</strong>: eventos, accesos, dispositivos, operaciones.</Step>
        <Step n={3}>Filtre por <strong>fecha</strong>, <strong>sede</strong> y otros criterios.</Step>
        <Step n={4}>Haga clic en <Badge variant="secondary">Generar</Badge>.</Step>
        <Step n={5}>Puede <strong>descargar</strong> el reporte en Excel o PDF.</Step>
      </SectionCard>

      <SectionCard title="Tipos de reportes disponibles">
        <ul className="list-disc list-inside text-sm space-y-1.5 text-muted-foreground">
          <li><strong>Reporte de eventos</strong> — todos los incidentes y alertas del período.</li>
          <li><strong>Reporte de acceso</strong> — ingresos y salidas de residentes y visitantes.</li>
          <li><strong>Reporte de dispositivos</strong> — estado, tiempo en línea y fallas.</li>
          <li><strong>Reporte de rondas</strong> — cumplimiento de patrullas y puntos de control.</li>
          <li><strong>Minuta de turno</strong> — resumen completo de novedades por turno.</li>
        </ul>
      </SectionCard>

      <SectionCard title="Reportes programados">
        <p className="text-sm text-muted-foreground">
          Puede programar reportes para que se generen automáticamente y se envíen por correo.
          Configure la frecuencia (diario, semanal, mensual) y los destinatarios en la sección de reportes programados.
        </p>
      </SectionCard>
    </div>
  );
}

function AgenteIAContent() {
  return (
    <div className="space-y-4">
      <SectionCard title="Cómo usar el agente IA">
        <p className="text-sm text-muted-foreground mb-3">
          AION incluye un asistente de inteligencia artificial que puede responder preguntas sobre el estado
          del sistema, los protocolos de seguridad y los datos operativos.
        </p>
        <Step n={1}>Haga clic en el botón flotante <Bot className="inline h-4 w-4" /> en la esquina inferior derecha, o vaya a <Badge variant="secondary">Agente IA</Badge> en el menú.</Step>
        <Step n={2}>Escriba su pregunta en español, con lenguaje natural.</Step>
        <Step n={3}>Espere la respuesta. El agente consultará la base de datos en tiempo real.</Step>
      </SectionCard>

      <SectionCard title="Ejemplos de preguntas útiles">
        <div className="space-y-2">
          {[
            '¿Cuántos dispositivos hay online?',
            'Dame un resumen del sistema',
            '¿Cuál es el protocolo de apertura de puerta?',
            '¿Cuántos eventos hubo hoy?',
            '¿Qué cámaras están offline?',
            '¿Cuántos residentes hay registrados?',
            '¿Cuál es el procedimiento para una emergencia médica?',
            '¿Quién está de turno ahora?',
          ].map((q) => (
            <div key={q} className="flex items-start gap-2 rounded-md border bg-muted/50 p-2.5">
              <MessageSquare className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <span className="text-sm italic">"{q}"</span>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Capacidades del agente">
        <ul className="list-disc list-inside text-sm space-y-1.5 text-muted-foreground">
          <li><Database className="inline h-3 w-3" /> Consulta la base de datos real del sistema.</li>
          <li><Shield className="inline h-3 w-3" /> Conoce los protocolos de seguridad configurados.</li>
          <li><BarChart3 className="inline h-3 w-3" /> Puede generar resúmenes y estadísticas.</li>
          <li><HelpCircle className="inline h-3 w-3" /> Responde preguntas sobre cómo usar el sistema.</li>
        </ul>
        <Warning>
          El agente es una herramienta de apoyo. En situaciones de emergencia real, siga siempre
          los protocolos establecidos y contacte a su supervisor.
        </Warning>
      </SectionCard>
    </div>
  );
}

function PanelTelefonicoContent() {
  return (
    <div className="space-y-4">
      <SectionCard title="Hacer una llamada">
        <Step n={1}>Vaya a <Badge variant="secondary"><Phone className="inline h-3 w-3 mr-1" />Panel Telefónico</Badge> en el menú.</Step>
        <Step n={2}>Escriba el número o seleccione un contacto de la agenda.</Step>
        <Step n={3}>Haga clic en <Badge variant="secondary"><PhoneCall className="inline h-3 w-3 mr-1" />Llamar</Badge>.</Step>
        <Step n={4}>Use los controles en pantalla para silenciar, poner en espera o colgar.</Step>
      </SectionCard>

      <SectionCard title="Recibir llamadas">
        <p className="text-sm text-muted-foreground mb-3">
          Cuando reciba una llamada, aparecerá una notificación en pantalla:
        </p>
        <Step n={1}>Verá el número o nombre del contacto que llama.</Step>
        <Step n={2}>Haga clic en <Badge className="bg-green-600 text-white"><PhoneIncoming className="inline h-3 w-3 mr-1" />Contestar</Badge> para atender.</Step>
        <Step n={3}>Si no puede atender, haga clic en <Badge variant="destructive">Rechazar</Badge>.</Step>
      </SectionCard>

      <SectionCard title="Extensiones importantes">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 font-medium">Extensión</th>
                <th className="text-left py-2 font-medium">Descripción</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b"><td className="py-2 pr-4 font-mono">100</td><td className="py-2">Portería principal</td></tr>
              <tr className="border-b"><td className="py-2 pr-4 font-mono">101</td><td className="py-2">Central de monitoreo</td></tr>
              <tr className="border-b"><td className="py-2 pr-4 font-mono">102</td><td className="py-2">Supervisor de turno</td></tr>
              <tr className="border-b"><td className="py-2 pr-4 font-mono">103</td><td className="py-2">Administración</td></tr>
              <tr><td className="py-2 pr-4 font-mono">911</td><td className="py-2">Emergencias (línea directa)</td></tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Marcación rápida de emergencia">
        <p className="text-sm text-muted-foreground mb-3">
          El panel incluye botones de marcación rápida para emergencias:
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-red-600 text-white"><Zap className="inline h-3 w-3 mr-1" />123 — Emergencias</Badge>
          <Badge className="bg-blue-600 text-white">112 — Policía Nacional</Badge>
          <Badge className="bg-orange-500 text-white">119 — Bomberos</Badge>
          <Badge className="bg-green-600 text-white">125 — Cruz Roja</Badge>
          <Badge className="bg-purple-600 text-white">144 — Defensa Civil</Badge>
        </div>
        <Warning>
          Solo utilice las líneas de emergencia para situaciones reales. El uso indebido puede generar sanciones.
        </Warning>
      </SectionCard>
    </div>
  );
}

function AdministracionContent() {
  return (
    <div className="space-y-4">
      <SectionCard title="Panel operativo">
        <p className="text-sm text-muted-foreground mb-3">
          El panel operativo muestra indicadores clave para supervisores:
        </p>
        <ul className="list-disc list-inside text-sm space-y-1.5 text-muted-foreground">
          <li>Estado de todos los guardas en servicio.</li>
          <li>Cumplimiento de rondas del turno actual.</li>
          <li>Alertas pendientes sin atender.</li>
          <li>Resumen de consignas activas.</li>
        </ul>
      </SectionCard>

      <SectionCard title="Gestión de residentes">
        <p className="text-sm text-muted-foreground mb-3">
          En <Badge variant="secondary"><Users className="inline h-3 w-3 mr-1" />Administración &gt; Residentes</Badge> puede:
        </p>
        <ul className="list-disc list-inside text-sm space-y-1.5 text-muted-foreground">
          <li>Ver la lista completa de residentes registrados.</li>
          <li>Editar datos de contacto, torre, apartamento.</li>
          <li>Activar o desactivar residentes.</li>
          <li>Asociar vehículos y mascotas.</li>
          <li>Ver el historial de accesos de cada residente.</li>
        </ul>
      </SectionCard>

      <SectionCard title="Consignas">
        <p className="text-sm text-muted-foreground mb-3">
          Las consignas son instrucciones especiales que deben seguir los operadores:
        </p>
        <Step n={1}>Vaya a <Badge variant="secondary"><FileText className="inline h-3 w-3 mr-1" />Consignas</Badge>.</Step>
        <Step n={2}>Revise las consignas activas para el turno actual.</Step>
        <Step n={3}>Las consignas vencidas se archivan automáticamente.</Step>
        <Tip>Lea siempre las consignas al inicio de cada turno. Pueden contener instrucciones nuevas de la administración.</Tip>
      </SectionCard>

      <SectionCard title="Pruebas de sirenas">
        <p className="text-sm text-muted-foreground mb-3">
          Las pruebas periódicas de sirenas aseguran que funcionen correctamente:
        </p>
        <Step n={1}>Vaya a <Badge variant="secondary">Administración &gt; Pruebas de Sirenas</Badge>.</Step>
        <Step n={2}>Seleccione la sirena a probar.</Step>
        <Step n={3}>Haga clic en <Badge variant="secondary">Iniciar Prueba</Badge>.</Step>
        <Step n={4}>Verifique que la sirena suene correctamente y registre el resultado.</Step>
        <Warning>
          Notifique a los residentes antes de realizar pruebas de sirena para evitar alarma innecesaria.
        </Warning>
      </SectionCard>
    </div>
  );
}

function PreguntasFrecuentesContent() {
  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="faq-1">
        <AccordionTrigger>¿Qué hago si una cámara aparece sin imagen?</AccordionTrigger>
        <AccordionContent>
          <ol className="list-decimal list-inside text-sm space-y-1 text-muted-foreground">
            <li>Verifique si el indicador de la cámara está en rojo (offline).</li>
            <li>Revise si el problema es solo con esa cámara o con todas las de la sede.</li>
            <li>Si es solo una cámara, puede ser un problema de red o de la cámara misma. Reporte al supervisor.</li>
            <li>Si son varias cámaras, puede ser un problema del grabador (NVR). Escale a soporte técnico.</li>
          </ol>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="faq-2">
        <AccordionTrigger>¿Cómo cambio mi contraseña?</AccordionTrigger>
        <AccordionContent>
          <p className="text-sm text-muted-foreground">
            Vaya a <strong>Configuración</strong> (icono de engranaje) &gt; <strong>Mi Perfil</strong> &gt; <strong>Cambiar Contraseña</strong>.
            Ingrese su contraseña actual y la nueva contraseña dos veces. La contraseña debe tener al menos 8 caracteres.
          </p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="faq-3">
        <AccordionTrigger>¿Qué hago si un dispositivo aparece offline?</AccordionTrigger>
        <AccordionContent>
          <ol className="list-decimal list-inside text-sm space-y-1 text-muted-foreground">
            <li>Verifique que el dispositivo tenga alimentación eléctrica.</li>
            <li>Revise la conexión WiFi o de red en el área del dispositivo.</li>
            <li>Intente reiniciar el dispositivo (si tiene acceso físico).</li>
            <li>Si el problema persiste después de 5 minutos, reporte al supervisor de turno.</li>
          </ol>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="faq-4">
        <AccordionTrigger>¿Cómo registro la visita de un proveedor o contratista?</AccordionTrigger>
        <AccordionContent>
          <p className="text-sm text-muted-foreground">
            En <strong>Control de Acceso</strong>, use la opción <strong>Registrar Visitante</strong>.
            Ingrese el nombre, documento, empresa, motivo de visita y el residente o área que autoriza el ingreso.
            El sistema genera un registro con hora de entrada. Al salir, registre la hora de salida.
          </p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="faq-5">
        <AccordionTrigger>¿Puedo ver las grabaciones de días anteriores?</AccordionTrigger>
        <AccordionContent>
          <p className="text-sm text-muted-foreground">
            Sí. Vaya a <strong>Reproducción</strong> (Playback) en el menú. Seleccione la cámara, la fecha
            y el rango de horas que desea revisar. Puede descargar clips si tiene los permisos necesarios.
            Las grabaciones se conservan según la política de retención configurada (generalmente 30 días).
          </p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="faq-6">
        <AccordionTrigger>¿Qué hago en caso de emergencia real (incendio, intrusión, emergencia médica)?</AccordionTrigger>
        <AccordionContent>
          <ol className="list-decimal list-inside text-sm space-y-1 text-muted-foreground">
            <li><strong>Mantenga la calma.</strong></li>
            <li>Active la alarma / sirena si corresponde al protocolo.</li>
            <li>Llame a la línea de emergencia (123 o la que aplique).</li>
            <li>Notifique a su supervisor de turno inmediatamente.</li>
            <li>Registre el incidente en el sistema con todos los detalles.</li>
            <li>Siga las consignas y protocolos establecidos para el tipo de emergencia.</li>
          </ol>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="faq-7">
        <AccordionTrigger>¿El sistema guarda un registro de todo lo que hago?</AccordionTrigger>
        <AccordionContent>
          <p className="text-sm text-muted-foreground">
            Sí. AION registra todas las acciones en un <strong>log de auditoría</strong>: aperturas de puerta,
            cambios en registros, creación de incidentes y accesos al sistema. Esto es para seguridad
            y trazabilidad. Los supervisores y administradores pueden consultar este historial.
          </p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="faq-8">
        <AccordionTrigger>¿Cómo contacto al soporte técnico?</AccordionTrigger>
        <AccordionContent>
          <p className="text-sm text-muted-foreground">
            Para problemas técnicos que no pueda resolver:
          </p>
          <ol className="list-decimal list-inside text-sm space-y-1 text-muted-foreground mt-2">
            <li>Primero reporte al supervisor de turno.</li>
            <li>Si el supervisor lo autoriza, contacte al soporte técnico por los canales establecidos.</li>
            <li>Describa el problema con detalle: qué pasó, cuándo y qué intentó hacer para solucionarlo.</li>
          </ol>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

/* ──────────────────────────────────────────────
   Main component
   ────────────────────────────────────────────── */
export default function UserManualPage() {
  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState('inicio-rapido');
  const contentRef = useRef<HTMLDivElement>(null);

  /* Section definitions */
  const sections: ManualSection[] = useMemo(
    () => [
      {
        id: 'inicio-rapido',
        title: 'Inicio Rápido',
        icon: <Rocket className="h-4 w-4" />,
        badge: 'Nuevo',
        content: <InicioRapidoContent />,
      },
      {
        id: 'dashboard',
        title: 'Panel Principal (Dashboard)',
        icon: <LayoutDashboard className="h-4 w-4" />,
        content: <DashboardContent />,
      },
      {
        id: 'video-en-vivo',
        title: 'Video en Vivo (LiveView)',
        icon: <Video className="h-4 w-4" />,
        content: <VideoEnVivoContent />,
      },
      {
        id: 'control-acceso',
        title: 'Control de Acceso',
        icon: <DoorOpen className="h-4 w-4" />,
        content: <ControlAccesoContent />,
      },
      {
        id: 'dispositivos-iot',
        title: 'Dispositivos IoT (Domóticos)',
        icon: <Cpu className="h-4 w-4" />,
        content: <DispositivosIoTContent />,
      },
      {
        id: 'eventos',
        title: 'Eventos e Incidentes',
        icon: <AlertTriangle className="h-4 w-4" />,
        content: <EventosContent />,
      },
      {
        id: 'operaciones',
        title: 'Operaciones (Turnos, Patrullas)',
        icon: <ClipboardList className="h-4 w-4" />,
        content: <OperacionesContent />,
      },
      {
        id: 'reportes',
        title: 'Reportes',
        icon: <BarChart3 className="h-4 w-4" />,
        content: <ReportesContent />,
      },
      {
        id: 'agente-ia',
        title: 'Agente IA',
        icon: <Bot className="h-4 w-4" />,
        content: <AgenteIAContent />,
      },
      {
        id: 'panel-telefonico',
        title: 'Panel Telefónico',
        icon: <Phone className="h-4 w-4" />,
        content: <PanelTelefonicoContent />,
      },
      {
        id: 'administracion',
        title: 'Administración',
        icon: <Settings className="h-4 w-4" />,
        content: <AdministracionContent />,
      },
      {
        id: 'faq',
        title: 'Preguntas Frecuentes',
        icon: <HelpCircle className="h-4 w-4" />,
        content: <PreguntasFrecuentesContent />,
      },
    ],
    [],
  );

  /* Filter sections by search */
  const filteredSections = useMemo(() => {
    if (!search.trim()) return sections;
    const q = search.toLowerCase().trim();
    return sections.filter((s) => s.title.toLowerCase().includes(q));
  }, [search, sections]);

  /* Keep activeSection valid when filtering */
  useEffect(() => {
    if (filteredSections.length > 0 && !filteredSections.find((s) => s.id === activeSection)) {
      setActiveSection(filteredSections[0].id);
    }
  }, [filteredSections, activeSection]);

  const currentSection = sections.find((s) => s.id === activeSection);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Header ── */}
      <header className="flex-shrink-0 border-b bg-background px-6 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">Manual de Operación — AION</h1>
              <p className="text-sm text-muted-foreground">Clave Seguridad CTA · Medellín, Colombia</p>
            </div>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar en el manual..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </header>

      {/* ── Body: sidebar + content ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col w-72 border-r bg-muted/30 flex-shrink-0">
          <ScrollArea className="flex-1">
            <nav className="p-3 space-y-1">
              {filteredSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors text-left',
                    activeSection === section.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {section.icon}
                  <span className="truncate flex-1">{section.title}</span>
                  {section.badge && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {section.badge}
                    </Badge>
                  )}
                </button>
              ))}
              {filteredSections.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No se encontraron secciones para "{search}".
                </p>
              )}
            </nav>
          </ScrollArea>
        </aside>

        {/* Mobile section selector */}
        <div className="md:hidden flex-shrink-0 border-b px-4 py-2 bg-muted/30 overflow-x-auto">
          <div className="flex gap-1.5">
            {filteredSections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  'flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  activeSection === section.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground',
                )}
              >
                {section.icon}
                {section.title}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div ref={contentRef} className="p-6 max-w-3xl">
              {currentSection ? (
                <>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
                      {currentSection.icon}
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">{currentSection.title}</h2>
                      <p className="text-sm text-muted-foreground">
                        Sección {sections.findIndex((s) => s.id === currentSection.id) + 1} de {sections.length}
                      </p>
                    </div>
                  </div>
                  <Separator className="mb-6" />
                  {currentSection.content}

                  {/* Navigation footer */}
                  <Separator className="my-8" />
                  <div className="flex justify-between items-center pb-8">
                    {(() => {
                      const idx = sections.findIndex((s) => s.id === activeSection);
                      const prev = idx > 0 ? sections[idx - 1] : null;
                      const next = idx < sections.length - 1 ? sections[idx + 1] : null;
                      return (
                        <>
                          {prev ? (
                            <button
                              onClick={() => setActiveSection(prev.id)}
                              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <ChevronRight className="h-4 w-4 rotate-180" />
                              {prev.title}
                            </button>
                          ) : (
                            <div />
                          )}
                          {next ? (
                            <button
                              onClick={() => setActiveSection(next.id)}
                              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {next.title}
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          ) : (
                            <div />
                          )}
                        </>
                      );
                    })()}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Search className="h-10 w-10 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No se encontró la sección buscada.</p>
                  <p className="text-sm text-muted-foreground mt-1">Intente con otro término de búsqueda.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </main>
      </div>
    </div>
  );
}
