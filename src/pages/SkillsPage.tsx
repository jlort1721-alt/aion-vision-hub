import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, Play, FileText, Clock, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import DOMPurify from 'dompurify';
// Simple markdown-to-HTML for rendering skill output
function SimpleMarkdown({ children }: { children: string }) {
  const raw = children
    .replace(/^### (.*$)/gm, '<h3 class="text-lg font-bold mt-4 mb-2">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold mt-5 mb-2">$1</h2>')
    .replace(/^\*\*(.*?)\*\*/gm, '<strong>$1</strong>')
    .replace(/^- \[ \] (.*$)/gm, '<div class="flex gap-2 ml-4"><input type="checkbox" disabled/><span>$1</span></div>')
    .replace(/^- \[x\] (.*$)/gm, '<div class="flex gap-2 ml-4"><input type="checkbox" checked disabled/><span>$1</span></div>')
    .replace(/^- (.*$)/gm, '<li class="ml-4">$1</li>')
    .replace(/^\d+\. (.*$)/gm, '<li class="ml-4 list-decimal">$1</li>')
    .replace(/^---$/gm, '<hr class="my-4 border-border"/>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
  const html = DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: ['h2', 'h3', 'strong', 'em', 'b', 'i', 'div', 'span', 'input', 'li', 'ul', 'ol', 'hr', 'br', 'p', 'a', 'code', 'pre'],
    ALLOWED_ATTR: ['class', 'type', 'checked', 'disabled', 'href', 'target', 'rel'],
  });
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

interface Skill {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  priority: string;
  applicable_to: string[];
  input_fields: InputField[];
  usage_count: number;
}

interface InputField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select';
  required: boolean;
  placeholder?: string;
  options?: string[];
}

interface SkillExecution {
  content: string;
  skill: string;
  category: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  operaciones: 'Operaciones',
  legal: 'Legal & Cumplimiento',
  rrhh: 'RRHH & Equipo',
  analytics: 'Analíticas',
  ia: 'IA & Tecnología',
  comunicacion: 'Comunicación',
  reportes: 'Reportes',
  cliente: 'Cliente',
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-400 border-red-500/20',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  medium: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  low: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

export default function SkillsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [result, setResult] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: skills = [], isLoading } = useQuery<Skill[]>({
    queryKey: ['skills', selectedCategory],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (selectedCategory) params.category = selectedCategory;
      return apiClient.get<Skill[]>('/skills', params);
    },
  });

  const { data: categories = [] } = useQuery<{ category: string; count: number }[]>({
    queryKey: ['skills-categories'],
    queryFn: () => apiClient.get('/skills/meta/categories'),
  });

  const executeMutation = useMutation({
    mutationFn: async ({ slug, data }: { slug: string; data: Record<string, string> }) => {
      return apiClient.post<SkillExecution>(`/skills/${slug}/execute`, data);
    },
    onSuccess: (data) => {
      setResult(data.content);
      qc.invalidateQueries({ queryKey: ['skills'] });
      toast.success('Documento generado exitosamente');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleExecute = () => {
    if (!selectedSkill) return;
    const missing = selectedSkill.input_fields
      .filter((f) => f.required && !formData[f.name])
      .map((f) => f.label);
    if (missing.length > 0) {
      toast.error(`Campos requeridos: ${missing.join(', ')}`);
      return;
    }
    executeMutation.mutate({ slug: selectedSkill.slug, data: formData });
  };

  // ── Result view ──
  if (result && selectedSkill) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { setResult(null); setSelectedSkill(null); setFormData({}); }}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Volver
          </Button>
          <h1 className="text-xl font-bold">{selectedSkill.icon} {selectedSkill.name} — Resultado</h1>
        </div>
        <Card>
          <CardContent className="p-6 prose prose-invert max-w-none">
            <SimpleMarkdown>{result}</SimpleMarkdown>
          </CardContent>
        </Card>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigator.clipboard.writeText(result).then(() => toast.success('Copiado'))}>
            Copiar al portapapeles
          </Button>
          <Button variant="outline" onClick={() => { setResult(null); }}>
            Generar otro
          </Button>
        </div>
      </div>
    );
  }

  // ── Skill form view ──
  if (selectedSkill) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedSkill(null); setFormData({}); }}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Volver
          </Button>
          <h1 className="text-xl font-bold">{selectedSkill.icon} {selectedSkill.name}</h1>
          <Badge className={PRIORITY_COLORS[selectedSkill.priority]}>{selectedSkill.priority}</Badge>
        </div>
        <p className="text-muted-foreground">{selectedSkill.description}</p>

        <Card>
          <CardContent className="p-6 space-y-4">
            {(selectedSkill.input_fields || []).map((field) => (
              <div key={field.name} className="space-y-1.5">
                <label className="text-sm font-medium">
                  {field.label} {field.required && <span className="text-red-400">*</span>}
                </label>
                {field.type === 'select' ? (
                  <select
                    className="w-full bg-background border rounded-md px-3 py-2 text-sm"
                    value={formData[field.name] || ''}
                    onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                  >
                    <option value="">Seleccionar...</option>
                    {field.options?.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : field.type === 'textarea' ? (
                  <Textarea
                    placeholder={field.placeholder}
                    value={formData[field.name] || ''}
                    onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                    rows={3}
                  />
                ) : (
                  <Input
                    type={field.type === 'number' ? 'number' : 'text'}
                    placeholder={field.placeholder}
                    value={formData[field.name] || ''}
                    onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                  />
                )}
              </div>
            ))}

            <Button
              className="w-full mt-4"
              onClick={handleExecute}
              disabled={executeMutation.isPending}
            >
              {executeMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generando con IA...</>
              ) : (
                <><Play className="h-4 w-4 mr-2" /> Generar documento</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Skills catalog view ──
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Herramientas Operativas</h1>
        <p className="text-muted-foreground">26 plantillas profesionales con generación IA para la operación de seguridad</p>
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedCategory === null ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedCategory(null)}
        >
          Todos ({skills.length})
        </Button>
        {categories.map((cat) => (
          <Button
            key={cat.category}
            variant={selectedCategory === cat.category ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(cat.category)}
          >
            {CATEGORY_LABELS[cat.category] || cat.category} ({cat.count})
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(Array.isArray(skills) ? skills : []).map((skill) => (
            <Card
              key={skill.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setSelectedSkill(skill)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <span className="text-2xl">{skill.icon}</span>
                  <Badge variant="outline" className={PRIORITY_COLORS[skill.priority]}>
                    {skill.priority}
                  </Badge>
                </div>
                <CardTitle className="text-base">{skill.name}</CardTitle>
                <CardDescription className="text-xs line-clamp-2">{skill.description}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {skill.input_fields.length} campos
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {skill.usage_count} usos
                  </div>
                  <ChevronRight className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
