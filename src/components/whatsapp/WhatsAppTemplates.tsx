import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { whatsappApi } from '@/services/api';
import { RefreshCw, Loader2, FileText, CheckCircle, Clock, XCircle } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  components: unknown[];
  is_active: boolean;
  last_synced_at: string | null;
  updated_at: string;
}

const STATUS_BADGE: Record<string, { variant: 'default' | 'secondary' | 'destructive'; icon: React.ReactNode }> = {
  APPROVED: { variant: 'default', icon: <CheckCircle className="h-3 w-3" /> },
  PENDING: { variant: 'secondary', icon: <Clock className="h-3 w-3" /> },
  REJECTED: { variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
};

export default function WhatsAppTemplates() {
  const queryClient = useQueryClient();

  const { data: templatesData, isLoading } = useQuery({
    queryKey: ['whatsapp-templates'],
    queryFn: () => whatsappApi.listTemplates(),
  });

  const templates: Template[] = templatesData?.data || [];

  const syncMutation = useMutation({
    mutationFn: () => whatsappApi.syncTemplates(),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
      const data = res?.data;
      toast.success(`Synced ${data?.synced || 0} templates${data?.errors?.length ? ` (${data.errors.length} errors)` : ''}`);
    },
    onError: (err: Error) => toast.error(`Sync failed: ${err.message}`),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
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

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-30" />
            <p className="text-sm text-muted-foreground">
              No templates synced yet. Click "Sync from Meta" to import your approved templates.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl) => {
            const badge = STATUS_BADGE[tpl.status] || STATUS_BADGE.PENDING;
            return (
              <Card key={tpl.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">{tpl.name}</CardTitle>
                    <Badge variant={badge.variant} className="gap-1 text-[10px]">
                      {badge.icon}
                      {tpl.status}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    {tpl.category} &middot; {tpl.language}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {Array.isArray(tpl.components) && tpl.components.length > 0 && (
                    <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2 mt-1">
                      {(tpl.components as Array<{ type: string; text?: string }>)
                        .filter((c) => c.type === 'BODY')
                        .map((c, i) => (
                          <p key={i}>{c.text || '—'}</p>
                        ))}
                    </div>
                  )}
                  {tpl.last_synced_at && (
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Last synced: {new Date(tpl.last_synced_at).toLocaleString()}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
