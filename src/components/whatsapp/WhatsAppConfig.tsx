import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import {
  Save, Loader2, CheckCircle, XCircle, Wifi, Phone,
  Shield, Clock, Bot, RefreshCw,
} from 'lucide-react';

export default function WhatsAppConfig() {
  const queryClient = useQueryClient();

  const { data: configData, isLoading } = useQuery({
    queryKey: ['whatsapp-config'],
    queryFn: () => apiClient.edgeFunction<any>('whatsapp-api', { action: 'config' }, { method: 'GET' }),
  });

  const config = configData?.data;

  const [form, setForm] = useState({
    phoneNumberId: '',
    accessToken: '',
    businessAccountId: '',
    verifyToken: '',
    apiVersion: 'v21.0',
    aiAgentEnabled: true,
    aiSystemPrompt: '',
    autoReplyOutsideHours: '',
    businessHoursStart: '09:00',
    businessHoursEnd: '18:00',
    businessTimezone: 'UTC',
    maxRetries: 3,
  });

  useEffect(() => {
    if (config && config.configured !== false) {
      setForm((prev) => ({
        ...prev,
        phoneNumberId: config.phoneNumberId || '',
        accessToken: '', // Never pre-fill token
        businessAccountId: config.businessAccountId || '',
        verifyToken: config.verifyToken || '',
        apiVersion: config.apiVersion || 'v21.0',
        aiAgentEnabled: config.aiAgentEnabled ?? true,
        aiSystemPrompt: config.aiSystemPrompt || '',
        autoReplyOutsideHours: config.autoReplyOutsideHours || '',
        businessHoursStart: config.businessHoursStart || '09:00',
        businessHoursEnd: config.businessHoursEnd || '18:00',
        businessTimezone: config.businessTimezone || 'UTC',
        maxRetries: config.maxRetries ?? 3,
      }));
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: (data: typeof form) => apiClient.edgeFunction<any>('whatsapp-api', { action: 'config' }, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      toast.success('WhatsApp configuration saved');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-config'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-health'] });
    },
    onError: (err: Error) => toast.error(`Failed to save: ${err.message}`),
  });

  const healthQuery = useQuery({
    queryKey: ['whatsapp-health'],
    queryFn: () => apiClient.edgeFunction<any>('whatsapp-api', { action: 'health' }, { method: 'GET' }),
    enabled: !!config && config.configured !== false,
    refetchInterval: 60_000,
  });

  const testMutation = useMutation({
    mutationFn: (to: string) => apiClient.edgeFunction<any>('whatsapp-api', { action: 'test' }, { method: 'POST', body: JSON.stringify({ to }) }),
    onSuccess: (res) => {
      if (res?.data?.success) {
        toast.success('Test message sent successfully!');
      } else {
        toast.error(`Test failed: ${res?.data?.error || 'Unknown error'}`);
      }
    },
    onError: (err: Error) => toast.error(`Test failed: ${err.message}`),
  });

  const [testPhone, setTestPhone] = useState('');

  const handleSave = () => {
    if (!form.phoneNumberId || !form.accessToken || !form.businessAccountId || !form.verifyToken) {
      toast.error('All credential fields are required');
      return;
    }
    saveMutation.mutate(form);
  };

  const health = healthQuery.data?.data;
  const isConnected = health?.status === 'healthy';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Wifi className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">Connection Status</CardTitle>
                <CardDescription>WhatsApp Business API health</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {health ? (
                <Badge variant={isConnected ? 'default' : 'destructive'} className="gap-1">
                  {isConnected ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  {isConnected ? 'Connected' : health.status || 'Disconnected'}
                </Badge>
              ) : (
                <Badge variant="secondary">Not configured</Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => healthQuery.refetch()}
                disabled={healthQuery.isFetching}
              >
                <RefreshCw className={`h-4 w-4 ${healthQuery.isFetching ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        {health?.phoneInfo && (
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Business Name</span>
                <p className="font-medium">{health.phoneInfo.verifiedName || '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Phone Number</span>
                <p className="font-medium">{health.phoneInfo.phoneNumber || '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Quality</span>
                <p className="font-medium">{health.phoneInfo.qualityRating || '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Latency</span>
                <p className="font-medium">{health.latencyMs ? `${health.latencyMs}ms` : '—'}</p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Credentials */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">API Credentials</CardTitle>
              <CardDescription>Meta Cloud API credentials from Business Manager</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phoneNumberId">Phone Number ID</Label>
              <Input
                id="phoneNumberId"
                value={form.phoneNumberId}
                onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })}
                placeholder="e.g. 123456789012345"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessAccountId">Business Account ID (WABA)</Label>
              <Input
                id="businessAccountId"
                value={form.businessAccountId}
                onChange={(e) => setForm({ ...form, businessAccountId: e.target.value })}
                placeholder="e.g. 987654321098765"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="accessToken">Permanent Access Token</Label>
            <Input
              id="accessToken"
              type="password"
              value={form.accessToken}
              onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
              placeholder={config?.accessToken ? 'Token saved (enter new to replace)' : 'Paste your System User token'}
            />
            <p className="text-xs text-muted-foreground">
              Generate a System User token in Meta Business Manager with whatsapp_business_messaging permission.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="verifyToken">Webhook Verify Token</Label>
              <Input
                id="verifyToken"
                value={form.verifyToken}
                onChange={(e) => setForm({ ...form, verifyToken: e.target.value })}
                placeholder="A random secret string (min 8 chars)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiVersion">API Version</Label>
              <Input
                id="apiVersion"
                value={form.apiVersion}
                onChange={(e) => setForm({ ...form, apiVersion: e.target.value })}
                placeholder="v21.0"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Agent Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Bot className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">AI Agent</CardTitle>
              <CardDescription>Automatic AI responses for incoming WhatsApp messages</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable AI Agent</Label>
              <p className="text-xs text-muted-foreground">Automatically respond to incoming messages with AI</p>
            </div>
            <Switch
              checked={form.aiAgentEnabled}
              onCheckedChange={(v) => setForm({ ...form, aiAgentEnabled: v })}
            />
          </div>
          {form.aiAgentEnabled && (
            <div className="space-y-2">
              <Label htmlFor="aiSystemPrompt">Custom System Prompt (optional)</Label>
              <Textarea
                id="aiSystemPrompt"
                value={form.aiSystemPrompt}
                onChange={(e) => setForm({ ...form, aiSystemPrompt: e.target.value })}
                placeholder="Override the default AI behavior. Leave empty for default AION assistant prompt."
                rows={4}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Business Hours */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Business Hours</CardTitle>
              <CardDescription>Auto-reply outside business hours</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="businessHoursStart">Start</Label>
              <Input
                id="businessHoursStart"
                type="time"
                value={form.businessHoursStart}
                onChange={(e) => setForm({ ...form, businessHoursStart: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessHoursEnd">End</Label>
              <Input
                id="businessHoursEnd"
                type="time"
                value={form.businessHoursEnd}
                onChange={(e) => setForm({ ...form, businessHoursEnd: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessTimezone">Timezone</Label>
              <Input
                id="businessTimezone"
                value={form.businessTimezone}
                onChange={(e) => setForm({ ...form, businessTimezone: e.target.value })}
                placeholder="UTC"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="autoReplyOutsideHours">Auto-Reply Message (outside hours)</Label>
            <Textarea
              id="autoReplyOutsideHours"
              value={form.autoReplyOutsideHours}
              onChange={(e) => setForm({ ...form, autoReplyOutsideHours: e.target.value })}
              placeholder="Leave empty to disable. e.g. 'Thanks for contacting us. Our team is available Mon-Fri 9am-6pm.'"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxRetries">Max Send Retries</Label>
            <Input
              id="maxRetries"
              type="number"
              min={0}
              max={5}
              value={form.maxRetries}
              onChange={(e) => setForm({ ...form, maxRetries: Number(e.target.value) })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Test Connection */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Phone className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Test Connection</CardTitle>
              <CardDescription>Send a test message to verify the integration</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="+1234567890"
              className="max-w-xs"
            />
            <Button
              onClick={() => testMutation.mutate(testPhone)}
              disabled={!testPhone || testMutation.isPending}
              variant="outline"
            >
              {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Send Test
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saveMutation.isPending} size="lg">
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save Configuration
        </Button>
      </div>
    </div>
  );
}
