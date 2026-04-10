import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useIntegrations, useMcpConnectors } from '@/hooks/use-api-data';
import { apiClient } from '@/lib/api-client';
import { MCP_CONNECTOR_CATALOG } from '@/services/mcp-registry';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQueryClient } from '@tanstack/react-query';
import ErrorState from '@/components/ui/ErrorState';
import { useI18n } from '@/contexts/I18nContext';
import { toast } from 'sonner';
import {
  Puzzle, Bot, Webhook, Mail, Cloud, Shield, DoorOpen, MessageCircle,
  Ticket, Video, Plus, RefreshCw, Loader2, Power, Zap,
} from 'lucide-react';

const iconMap: Record<string, any> = {
  Video: <Video className="h-5 w-5" />, Mail: <Mail className="h-5 w-5" />,
  Webhook: <Webhook className="h-5 w-5" />, Ticket: <Ticket className="h-5 w-5" />,
  Cloud: <Cloud className="h-5 w-5" />, DoorOpen: <DoorOpen className="h-5 w-5" />,
  Shield: <Shield className="h-5 w-5" />, MessageCircle: <MessageCircle className="h-5 w-5" />,
};

const statusLabels: Record<string, string> = {
  active: 'Activo', connected: 'Conectado', inactive: 'Inactivo',
  disconnected: 'Desconectado', error: 'Error', pending: 'Pendiente',
};
const statusBadge = (status: string) => {
  const label = statusLabels[status] || status;
  switch (status) {
    case 'active': case 'connected': return <Badge className="bg-success text-success-foreground text-[10px]">{label}</Badge>;
    case 'inactive': case 'disconnected': return <Badge variant="secondary" className="text-[10px]">{label}</Badge>;
    case 'error': return <Badge variant="destructive" className="text-[10px]">{label}</Badge>;
    default: return <Badge variant="outline" className="text-[10px]">{label}</Badge>;
  }
};

export default function IntegrationsPage() {
  const { t } = useI18n();
  const { data: rawIntegrations = [], isLoading: li, isError: integrationsError, error: intError, refetch: refetchInt } = useIntegrations();
  const { data: rawConnectors = [], isLoading: lc, isError: connectorsError, error: connError, refetch: refetchConn } = useMcpConnectors();
  const integrations = rawIntegrations as Record<string, unknown>[];
  const connectors = rawConnectors as Record<string, unknown>[];
  const queryClient = useQueryClient();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleIntegrationTest = async (id: string) => {
    setActionLoading(`test-${id}`);
    try {
      const result: any = await apiClient.post(`/integrations/${id}/test`);
      toast.success(`Prueba: ${result?.message || 'OK'} (${result?.latency_ms || '?'}ms)`);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error en prueba'); }
    finally { setActionLoading(null); }
  };

  const handleIntegrationToggle = async (id: string) => {
    setActionLoading(`toggle-${id}`);
    try {
      const updated: any = await apiClient.patch(`/integrations/${id}`, { action: 'toggle' });
      toast.success(`Integración ${updated?.status === 'active' ? 'activada' : 'desactivada'}`);
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error'); }
    finally { setActionLoading(null); }
  };

  const handleMcpHealthCheck = async (id: string) => {
    setActionLoading(`mcp-health-${id}`);
    try {
      const result: any = await apiClient.get(`/mcp/connectors/${id}/status`);
      toast.success(`Salud: ${result?.health || 'OK'} (${result?.check_latency_ms || '?'}ms)`);
      queryClient.invalidateQueries({ queryKey: ['mcp_connectors'] });
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error'); }
    finally { setActionLoading(null); }
  };

  const handleMcpToggle = async (id: string) => {
    setActionLoading(`mcp-toggle-${id}`);
    try {
      const updated: any = await apiClient.patch(`/mcp/connectors/${id}`, { action: 'toggle' });
      toast.success(`Conector ${updated?.status === 'connected' ? 'conectado' : 'desconectado'}`);
      queryClient.invalidateQueries({ queryKey: ['mcp_connectors'] });
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error'); }
    finally { setActionLoading(null); }
  };

  const hasError = integrationsError || connectorsError;
  if (hasError) return <ErrorState error={(intError || connError) as Error} onRetry={() => { refetchInt(); refetchConn(); }} />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('integrations.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('integrations.subtitle')}</p>
        </div>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">{t('integrations.active')} ({integrations.length})</TabsTrigger>
          <TabsTrigger value="mcp">{t('integrations.mcp_connectors')} ({connectors.length})</TabsTrigger>
          <TabsTrigger value="catalog">{t('integrations.catalog')} ({MCP_CONNECTOR_CATALOG.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {li ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
            </div>
          ) : integrations.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <Puzzle className="h-8 w-8 mx-auto mb-2 opacity-30" />
              {t('integrations.no_integrations')}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {integrations.map(integration => (
                <Card key={integration.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                          {integration.type === 'ai_provider' ? <Bot className="h-5 w-5" /> : integration.type === 'webhook' ? <Webhook className="h-5 w-5" /> : <Puzzle className="h-5 w-5" />}
                        </div>
                        <div>
                          <CardTitle className="text-sm">{integration.name}</CardTitle>
                          <CardDescription className="text-xs capitalize">{(integration.type || '').replace(/_/g, ' ')}</CardDescription>
                        </div>
                      </div>
                      {statusBadge(integration.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-xs text-muted-foreground">
                      {t('integrations.last_sync')}: {integration.last_sync ? new Date(integration.last_sync).toLocaleString('es-CO') : t('integrations.never')}
                    </div>
                    {integration.error_message && <p className="text-xs text-destructive">{integration.error_message}</p>}
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={() => handleIntegrationTest(integration.id)} disabled={actionLoading === `test-${integration.id}`}>
                        {actionLoading === `test-${integration.id}` ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Zap className="mr-1 h-3 w-3" />} {t('common.test')}
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={() => handleIntegrationToggle(integration.id)} disabled={actionLoading === `toggle-${integration.id}`}>
                        {actionLoading === `toggle-${integration.id}` ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Power className="mr-1 h-3 w-3" />}
                        {integration.status === 'active' ? t('common.disable') : t('common.enable')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="mcp" className="mt-4">
          {lc ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
            </div>
          ) : connectors.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">{t('integrations.no_connectors')}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {connectors.map(connector => (
                <Card key={connector.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div><CardTitle className="text-sm">{connector.name}</CardTitle><CardDescription className="text-xs">{connector.type}</CardDescription></div>
                      {statusBadge(connector.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {(connector.scopes as string[] || []).map((s: string) => <Badge key={s} variant="outline" className="text-[9px]">{s}</Badge>)}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{t('integrations.errors')}: {connector.error_count} • {t('integrations.health')}: {connector.health}</span>
                      {connector.last_check && <span>{new Date(connector.last_check).toLocaleTimeString('es-CO')}</span>}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={() => handleMcpHealthCheck(connector.id)} disabled={actionLoading === `mcp-health-${connector.id}`}>
                        {actionLoading === `mcp-health-${connector.id}` ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />} {t('integrations.health_check')}
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={() => handleMcpToggle(connector.id)} disabled={actionLoading === `mcp-toggle-${connector.id}`}>
                        {actionLoading === `mcp-toggle-${connector.id}` ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Power className="mr-1 h-3 w-3" />}
                        {connector.status === 'connected' ? t('common.disconnect') : t('common.connect')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="catalog" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {MCP_CONNECTOR_CATALOG.map(def => (
              <Card key={def.type} className="hover:border-primary/50 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                        {iconMap[def.icon] || <Puzzle className="h-5 w-5" />}
                      </div>
                      <div><CardTitle className="text-sm">{def.name}</CardTitle><CardDescription className="text-xs">{def.description}</CardDescription></div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px] capitalize">{def.category}</Badge>
                    <Button size="sm" className="h-7 text-xs"><Plus className="mr-1 h-3 w-3" /> {t('common.connect')}</Button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(def.availableTools || []).map(tool => <Badge key={tool.name} variant="secondary" className="text-[8px]">{tool.name}</Badge>)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
