import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import {
  RefreshCw, Loader2, FileText, CheckCircle, Clock, XCircle,
  Eye, Search, Globe, Copy,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────

interface TemplateComponent {
  type: string;
  text?: string;
  format?: string;
  buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string }>;
  example?: { body_text?: string[][]; header_text?: string[] };
}

interface Template {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  components: TemplateComponent[];
  is_active: boolean;
  last_synced_at: string | null;
  updated_at: string;
}

// ── Constants ────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { variant: 'default' | 'secondary' | 'destructive'; icon: React.ReactNode }> = {
  APPROVED: { variant: 'default', icon: <CheckCircle className="h-3 w-3" /> },
  PENDING: { variant: 'secondary', icon: <Clock className="h-3 w-3" /> },
  REJECTED: { variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
};

const CATEGORY_COLORS: Record<string, string> = {
  MARKETING: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  UTILITY: 'bg-primary/15 text-primary border-primary/30',
  AUTHENTICATION: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
};

// ── Component ────────────────────────────────────────────────

export default function WhatsAppTemplates() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

  // ── Query ──────────────────────────────────────────────

  const { data: templatesData, isLoading } = useQuery({
    queryKey: ['whatsapp-templates'],
    queryFn: () => apiClient.edgeFunction<any>('whatsapp-api', { action: 'templates' }, { method: 'GET' }),
  });

  const allTemplates: Template[] = templatesData?.data || [];

  const templates = allTemplates.filter((tpl) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      tpl.name.toLowerCase().includes(q) ||
      tpl.category.toLowerCase().includes(q) ||
      tpl.language.toLowerCase().includes(q)
    );
  });

  // ── Sync Mutation ──────────────────────────────────────

  const syncMutation = useMutation({
    mutationFn: () => apiClient.edgeFunction<any>('whatsapp-api', { action: 'sync-templates' }, { method: 'POST' }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
      const data = res?.data;
      toast.success(
        `Synced ${data?.synced || 0} templates${data?.errors?.length ? ` (${data.errors.length} errors)` : ''}`,
      );
    },
    onError: (err: Error) => toast.error(`Sync failed: ${err.message}`),
  });

  // ── Helpers ────────────────────────────────────────────

  function getComponentText(tpl: Template, type: string): string | null {
    const comp = tpl.components?.find((c) => c.type === type);
    return comp?.text || null;
  }

  function getBodyText(tpl: Template): string {
    return getComponentText(tpl, 'BODY') || '(no body)';
  }

  function openPreview(tpl: Template) {
    setPreviewTemplate(tpl);
    setPreviewOpen(true);
  }

  function copyTemplateName(name: string) {
    navigator.clipboard.writeText(name);
    toast.success('Template name copied');
  }

  // ── Render ─────────────────────────────────────────────

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Message Templates</h3>
            <p className="text-sm text-muted-foreground">
              Templates synced from Meta Business Manager. Required for initiating conversations outside 24h window.
            </p>
          </div>
          <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
            {syncMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sync from Meta
          </Button>
        </div>

        {/* Search */}
        {allTemplates.length > 0 && (
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">
                {allTemplates.length === 0
                  ? 'No templates synced yet. Click "Sync from Meta" to import your approved templates.'
                  : 'No templates match your search.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {templates.length} Template{templates.length !== 1 ? 's' : ''}
              </CardTitle>
              <CardDescription>
                {allTemplates.filter((t) => t.status === 'APPROVED').length} approved,{' '}
                {allTemplates.filter((t) => t.status === 'PENDING').length} pending,{' '}
                {allTemplates.filter((t) => t.status === 'REJECTED').length} rejected
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Language</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Body Preview</TableHead>
                      <TableHead>Last Synced</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((tpl) => {
                      const badge = STATUS_BADGE[tpl.status] || STATUS_BADGE.PENDING;
                      const bodyText = getBodyText(tpl);
                      const catColor = CATEGORY_COLORS[tpl.category] || '';

                      return (
                        <TableRow key={tpl.id}>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-sm font-mono">{tpl.name}</span>
                              <button
                                onClick={() => copyTemplateName(tpl.name)}
                                className="opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
                                title="Copy template name"
                              >
                                <Copy className="h-3 w-3 text-muted-foreground" />
                              </button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] ${catColor}`}>
                              {tpl.category}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Globe className="h-3 w-3" />
                              {tpl.language}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={badge.variant} className="gap-1 text-[10px]">
                              {badge.icon}
                              {tpl.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {bodyText}
                            </p>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {tpl.last_synced_at
                                ? new Date(tpl.last_synced_at).toLocaleDateString()
                                : '--'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openPreview(tpl)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Preview Dialog ──────────────────────────────────── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Template Preview
            </DialogTitle>
            <DialogDescription>
              {previewTemplate?.name} ({previewTemplate?.language})
            </DialogDescription>
          </DialogHeader>

          {previewTemplate && (
            <div className="space-y-4">
              {/* Meta info */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={CATEGORY_COLORS[previewTemplate.category] || ''}>
                  {previewTemplate.category}
                </Badge>
                <Badge
                  variant={
                    (STATUS_BADGE[previewTemplate.status] || STATUS_BADGE.PENDING).variant
                  }
                  className="gap-1"
                >
                  {(STATUS_BADGE[previewTemplate.status] || STATUS_BADGE.PENDING).icon}
                  {previewTemplate.status}
                </Badge>
                <span className="text-xs text-muted-foreground ml-auto">
                  {previewTemplate.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Simulated WhatsApp message bubble */}
              <div className="bg-muted/30 rounded-xl p-4 space-y-2">
                {/* HEADER component */}
                {getComponentText(previewTemplate, 'HEADER') && (
                  <div className="font-semibold text-sm">
                    {getComponentText(previewTemplate, 'HEADER')}
                  </div>
                )}

                {/* BODY component */}
                <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
                  {getBodyText(previewTemplate)}
                </pre>

                {/* FOOTER component */}
                {getComponentText(previewTemplate, 'FOOTER') && (
                  <p className="text-xs text-muted-foreground italic">
                    {getComponentText(previewTemplate, 'FOOTER')}
                  </p>
                )}

                {/* BUTTONS component */}
                {previewTemplate.components
                  ?.filter((c) => c.type === 'BUTTONS')
                  .flatMap((c) => c.buttons || [])
                  .length > 0 && (
                  <div className="pt-2 border-t border-border/30 space-y-1">
                    {previewTemplate.components
                      .filter((c) => c.type === 'BUTTONS')
                      .flatMap((c) => c.buttons || [])
                      .map((btn, i) => (
                        <div
                          key={i}
                          className="text-center text-sm text-primary py-1.5 rounded-md bg-background/50"
                        >
                          {btn.text}
                          {btn.type === 'URL' && (
                            <span className="text-[10px] text-muted-foreground ml-1">(link)</span>
                          )}
                          {btn.type === 'PHONE_NUMBER' && (
                            <span className="text-[10px] text-muted-foreground ml-1">(call)</span>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Raw components debug */}
              <details className="text-xs">
                <summary className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                  Raw components ({previewTemplate.components?.length || 0})
                </summary>
                <pre className="mt-2 p-3 bg-muted rounded-md overflow-x-auto text-[11px] font-mono max-h-[200px]">
                  {JSON.stringify(previewTemplate.components, null, 2)}
                </pre>
              </details>

              {/* Sync info */}
              {previewTemplate.last_synced_at && (
                <p className="text-[10px] text-muted-foreground">
                  Last synced: {new Date(previewTemplate.last_synced_at).toLocaleString()}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
