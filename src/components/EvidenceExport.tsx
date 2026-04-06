import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

interface EvidenceExportProps {
  incidents: Array<{
    id: string;
    title: string;
    description?: string;
    status: string;
    priority: string;
    created_at: string;
    ai_summary?: string;
    comments?: Array<{ content: string; user_name?: string; created_at: string }>;
  }>;
}

export default function EvidenceExport({ incidents }: EvidenceExportProps) {
  const handleExport = () => {
    if (!incidents.length) {
      toast.error('No hay incidentes para exportar');
      return;
    }

    const now = new Date();
    const lines: string[] = [
      '═══════════════════════════════════════════════════════',
      '  REPORTE DE EVIDENCIA — CLAVE SEGURIDAD CTA',
      '  AION Platform',
      `  Generado: ${now.toLocaleString('es-CO')}`,
      '═══════════════════════════════════════════════════════',
      '',
    ];

    incidents.forEach((inc, idx) => {
      lines.push(`── Incidente #${idx + 1} ──────────────────────────────`);
      lines.push(`ID:          ${inc.id}`);
      lines.push(`Titulo:      ${inc.title}`);
      lines.push(`Estado:      ${inc.status}`);
      lines.push(`Prioridad:   ${inc.priority}`);
      lines.push(`Creado:      ${new Date(inc.created_at).toLocaleString('es-CO')}`);
      if (inc.description) {
        lines.push(`Descripcion: ${inc.description}`);
      }
      if (inc.ai_summary) {
        lines.push(`Resumen IA:  ${inc.ai_summary}`);
      }
      if (inc.comments && inc.comments.length > 0) {
        lines.push('');
        lines.push('  Comentarios:');
        inc.comments.forEach(c => {
          lines.push(`    [${new Date(c.created_at).toLocaleString('es-CO')}] ${c.user_name || 'Usuario'}: ${c.content}`);
        });
      }
      lines.push('');
    });

    lines.push('═══════════════════════════════════════════════════════');
    lines.push(`Total incidentes: ${incidents.length}`);
    lines.push('Fin del reporte');
    lines.push('═══════════════════════════════════════════════════════');

    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evidencia-${now.toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Reporte de evidencia descargado');
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
      <Download className="h-4 w-4" />
      Exportar Evidencia
    </Button>
  );
}
