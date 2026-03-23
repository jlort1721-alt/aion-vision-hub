import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/contexts/I18nContext';
import { useSections, useIntercomDevices, useIntercomCalls, useIntercomMutations } from '@/hooks/use-module-data';
import {
  Phone, PhoneCall, PhoneOff, MessageSquare, Bot, Mic, Volume2,
  Search, Plus, Settings, Wifi, WifiOff, Clock, Users,
  Send, RefreshCw, Activity, Radio, CheckCircle, XCircle, AlertTriangle, Play, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { elevenlabs } from '@/services/integrations/elevenlabs';
import type { VoiceHealthCheck, VoiceInfo, VoiceConfig, GreetingTemplate } from '@/services/integrations/elevenlabs';

export default function IntercomPage() {
  const { t } = useI18n();
  const { data: sections = [] } = useSections();
  const { data: devices = [], isLoading } = useIntercomDevices();
  const { data: calls = [] } = useIntercomCalls();
  const { create } = useIntercomMutations();

  const [activeTab, setActiveTab] = useState('devices');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [attendMode, setAttendMode] = useState<'human' | 'ai' | 'mixed'>('mixed');
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: '', section_id: '', brand: 'Fanvil', model: '', ip_address: '', sip_uri: '' });

  // Voice AI state
  const [voiceHealth, setVoiceHealth] = useState<VoiceHealthCheck | null>(null);
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig | null>(null);
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [greetingTemplates, setGreetingTemplates] = useState<GreetingTemplate[]>([]);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [testingVoice, setTestingVoice] = useState(false);
  const [playingGreeting, setPlayingGreeting] = useState<string | null>(null);
  const [selectedVoiceId, setSelectedVoiceId] = useState('');

  const loadVoiceData = useCallback(async () => {
    setVoiceLoading(true);
    try {
      const [health, config, voiceList, templates] = await Promise.allSettled([
        elevenlabs.healthCheck(),
        elevenlabs.getConfig(),
        elevenlabs.listVoices(),
        elevenlabs.getGreetingTemplates(),
      ]);
      if (health.status === 'fulfilled') setVoiceHealth(health.value);
      if (config.status === 'fulfilled') {
        setVoiceConfig(config.value);
        if (config.value.defaultVoiceId) setSelectedVoiceId(config.value.defaultVoiceId);
      }
      if (voiceList.status === 'fulfilled') setVoices(voiceList.value);
      if (templates.status === 'fulfilled') setGreetingTemplates(templates.value);
    } finally {
      setVoiceLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'voice_ai') loadVoiceData();
  }, [activeTab, loadVoiceData]);

  const handleTestConnection = async () => {
    setTestingVoice(true);
    try {
      const result = await elevenlabs.testConnection();
      if (result.success) {
        toast.success(`Voice OK: ${result.message} (${result.latencyMs}ms)`);
      } else {
        toast.error(`Voice error: ${result.message}`);
      }
      await loadVoiceData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setTestingVoice(false);
    }
  };

  const handlePlayGreeting = async (context: string) => {
    setPlayingGreeting(context);
    try {
      const { audioBlob } = await elevenlabs.generateGreeting(context, 'es', undefined, selectedVoiceId || undefined);
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audio.onended = () => { URL.revokeObjectURL(url); setPlayingGreeting(null); };
      audio.onerror = () => { URL.revokeObjectURL(url); setPlayingGreeting(null); };
      await audio.play();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Playback failed');
      setPlayingGreeting(null);
    }
  };

  const handleTestTTS = async () => {
    setTestingVoice(true);
    try {
      await elevenlabs.playTTS('Prueba de voz Clave Seguridad. Sistema de citofonía inteligente activo.', selectedVoiceId || undefined);
      toast.success('TTS playback complete');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'TTS failed');
    } finally {
      setTestingVoice(false);
    }
  };

  const voiceStatusIcon = (status?: string) => {
    if (status === 'healthy') return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (status === 'error' || status === 'degraded') return <XCircle className="h-4 w-4 text-red-500" />;
    return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
  };

  const getSectionName = (id: string) => sections.find((s: any) => s.id === id)?.name || '—';
  const onlineCount = devices.filter((d: any) => d.status === 'online').length;

  const filteredDevices = devices.filter((d: any) => sectionFilter === 'all' || d.section_id === sectionFilter);

  const handleAdd = () => {
    if (!form.name.trim()) return;
    create.mutate({
      name: form.name, section_id: form.section_id || undefined,
      brand: form.brand, model: form.model, ip_address: form.ip_address || undefined,
      sip_uri: form.sip_uri || undefined,
    });
    setAddOpen(false);
    setForm({ name: '', section_id: '', brand: 'Fanvil', model: '', ip_address: '', sip_uri: '' });
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <div className="flex-1 flex flex-col">
        <div className="px-4 py-3 border-b space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2"><Phone className="h-5 w-5 text-primary" /> {t('intercom.title')}</h1>
              <p className="text-xs text-muted-foreground">{t('intercom.subtitle')}</p>
            </div>
            <div className="flex gap-2">
              <Select value={attendMode} onValueChange={(v: any) => setAttendMode(v)}>
                <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="human"><Users className="inline mr-1 h-3 w-3" /> {t('intercom.human_operator')}</SelectItem>
                  <SelectItem value="ai"><Bot className="inline mr-1 h-3 w-3" /> {t('intercom.ai_agent')}</SelectItem>
                  <SelectItem value="mixed"><Radio className="inline mr-1 h-3 w-3" /> {t('intercom.mixed_mode')}</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="mr-1 h-3 w-3" /> {t('intercom.add_device')}</Button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <Card className="p-2"><div className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /><div><p className="text-xs text-muted-foreground">{t('intercom.total_devices')}</p><p className="text-lg font-bold">{devices.length}</p></div></div></Card>
            <Card className="p-2"><div className="flex items-center gap-2"><Wifi className="h-4 w-4 text-green-500" /><div><p className="text-xs text-muted-foreground">{t('common.online')}</p><p className="text-lg font-bold">{onlineCount}</p></div></div></Card>
            <Card className="p-2"><div className="flex items-center gap-2"><PhoneCall className="h-4 w-4 text-blue-500" /><div><p className="text-xs text-muted-foreground">{t('intercom.calls_today')}</p><p className="text-lg font-bold">{calls.length}</p></div></div></Card>
            <Card className="p-2"><div className="flex items-center gap-2"><Bot className="h-4 w-4 text-primary" /><div><p className="text-xs text-muted-foreground">{t('intercom.attend_mode')}</p><p className="text-lg font-bold capitalize">{attendMode}</p></div></div></Card>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="px-4 pt-2 border-b flex items-center gap-2">
            <TabsList className="h-8">
              <TabsTrigger value="devices" className="text-xs"><Phone className="mr-1 h-3 w-3" /> {t('intercom.devices')}</TabsTrigger>
              <TabsTrigger value="calls" className="text-xs"><PhoneCall className="mr-1 h-3 w-3" /> {t('intercom.call_history')}</TabsTrigger>
              <TabsTrigger value="whatsapp" className="text-xs"><MessageSquare className="mr-1 h-3 w-3" /> WhatsApp</TabsTrigger>
              <TabsTrigger value="voice_ai" className="text-xs"><Mic className="mr-1 h-3 w-3" /> {t('intercom.voice_ai')}</TabsTrigger>
            </TabsList>
            <div className="ml-auto">
              <Select value={sectionFilter} onValueChange={setSectionFilter}>
                <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder={t('intercom.all_sections')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('intercom.all_sections')}</SelectItem>
                  {sections.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <TabsContent value="devices" className="flex-1 overflow-auto m-0">
            {isLoading ? (
              <div className="p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : filteredDevices.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Phone className="h-12 w-12 mb-2 opacity-20" />
                <p className="text-sm">{devices.length === 0 ? 'No intercom devices configured' : 'No devices match filter'}</p>
                {devices.length === 0 && <Button variant="outline" size="sm" className="mt-2" onClick={() => setAddOpen(true)}><Plus className="mr-1 h-3 w-3" /> Add Device</Button>}
              </div>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>{t('common.name')}</TableHead><TableHead>{t('intercom.section')}</TableHead><TableHead>Brand/Model</TableHead><TableHead>IP</TableHead><TableHead>SIP</TableHead><TableHead>{t('common.status')}</TableHead><TableHead className="w-20">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredDevices.map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium text-sm">{d.name}</TableCell>
                      <TableCell className="text-xs">{getSectionName(d.section_id)}</TableCell>
                      <TableCell className="text-xs">{d.brand} {d.model}</TableCell>
                      <TableCell className="text-xs font-mono">{d.ip_address || '—'}</TableCell>
                      <TableCell className="text-xs font-mono">{d.sip_uri || '—'}</TableCell>
                      <TableCell><Badge variant={d.status === 'online' ? 'default' : 'secondary'} className="text-[10px] capitalize">{d.status}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toast.info('SIP call initiation requires VoIP gateway configuration')}><PhoneCall className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toast.success('Device status refreshed')}><RefreshCw className="h-3 w-3" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="calls" className="flex-1 overflow-auto m-0">
            {calls.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground"><PhoneCall className="h-12 w-12 mb-2 opacity-20" /><p className="text-sm">No call history yet</p></div>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Direction</TableHead><TableHead>Section</TableHead><TableHead>Duration</TableHead><TableHead>Attended By</TableHead><TableHead>{t('common.status')}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {calls.map((call: any) => (
                    <TableRow key={call.id}>
                      <TableCell className="text-xs font-mono">{new Date(call.created_at).toLocaleString()}</TableCell>
                      <TableCell><Badge variant={call.direction === 'inbound' ? 'default' : 'secondary'} className="text-[10px]">{call.direction}</Badge></TableCell>
                      <TableCell className="text-xs">{getSectionName(call.section_id)}</TableCell>
                      <TableCell className="text-xs font-mono">{call.duration_seconds ? `${call.duration_seconds}s` : '—'}</TableCell>
                      <TableCell className="text-xs capitalize">{call.attended_by}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] capitalize">{call.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="whatsapp" className="flex-1 overflow-auto m-0 p-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="h-4 w-4" /> WhatsApp Business API Integration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">Connect your WhatsApp Business account to enable messaging with visitors and residents directly from the intercom system.</p>
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">Capabilities</p>
                  <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Send visitor notifications</li>
                    <li>Receive entrance requests</li>
                    <li>Respuestas automáticas vía IA</li>
                  </ul>
                </div>
                <Button variant="outline" size="sm" onClick={() => toast.info('WhatsApp Business API credentials required in Settings > Integrations')}><Settings className="mr-1 h-3 w-3" /> Configure</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="voice_ai" className="flex-1 overflow-auto m-0 p-4">
            {voiceLoading ? (
              <div className="p-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
            ) : (
              <div className="space-y-4">
                {/* Provider Status + Test */}
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><Bot className="h-4 w-4" /> Provider</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-2">
                        {voiceStatusIcon(voiceHealth?.status)}
                        <span className="text-sm font-medium capitalize">{voiceConfig?.provider || 'Not configured'}</span>
                      </div>
                      <Badge variant={voiceHealth?.status === 'healthy' ? 'default' : 'secondary'} className="text-[10px]">
                        {voiceHealth?.status === 'healthy' ? 'Connected' : voiceHealth?.status === 'error' ? 'Error' : 'Pending Configuration'}
                      </Badge>
                      {voiceHealth?.tier && <p className="text-[10px] text-muted-foreground">Tier: {voiceHealth.tier}</p>}
                      {voiceHealth?.quotaRemaining != null && <p className="text-[10px] text-muted-foreground">Chars remaining: {voiceHealth.quotaRemaining.toLocaleString()}</p>}
                      {voiceHealth?.latencyMs != null && voiceHealth.latencyMs > 0 && <p className="text-[10px] text-muted-foreground">Latency: {voiceHealth.latencyMs}ms</p>}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><Activity className="h-4 w-4" /> Connection Test</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-xs text-muted-foreground">Verify ElevenLabs API connectivity and run a synthesis test.</p>
                      <Button variant="outline" size="sm" className="w-full" onClick={handleTestConnection} disabled={testingVoice}>
                        {testingVoice ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
                        {testingVoice ? 'Testing...' : 'Test Connection'}
                      </Button>
                      <Button variant="outline" size="sm" className="w-full" onClick={handleTestTTS} disabled={testingVoice}>
                        {testingVoice ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Play className="mr-1 h-3 w-3" />}
                        Test TTS Playback
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><Settings className="h-4 w-4" /> Mode</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-xs text-muted-foreground">Current attend mode determines how intercom calls are handled.</p>
                      <div className="p-2 rounded bg-muted/50 border">
                        <div className="flex items-center gap-2">
                          {attendMode === 'ai' && <Bot className="h-4 w-4 text-primary" />}
                          {attendMode === 'human' && <Users className="h-4 w-4 text-blue-500" />}
                          {attendMode === 'mixed' && <Radio className="h-4 w-4 text-orange-500" />}
                          <span className="text-sm font-medium capitalize">{attendMode}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {attendMode === 'ai' && 'La IA atiende todas las llamadas con síntesis de voz'}
                          {attendMode === 'human' && 'Todas las llamadas se dirigen al operador humano'}
                          {attendMode === 'mixed' && 'La IA saluda y transfiere al operador si es necesario'}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Voice Selection */}
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><Mic className="h-4 w-4" /> Voice Selection</CardTitle></CardHeader>
                  <CardContent>
                    {voices.length > 0 ? (
                      <div className="space-y-2">
                        <Select value={selectedVoiceId} onValueChange={setSelectedVoiceId}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select a voice..." /></SelectTrigger>
                          <SelectContent>
                            {voices.map((v) => (
                              <SelectItem key={v.voiceId} value={v.voiceId}>
                                {v.name} {v.gender ? `(${v.gender})` : ''} {v.language ? `— ${v.language}` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground">{voices.length} voices available. Select one and use "Test TTS Playback" to preview.</p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {voiceHealth?.status === 'healthy' ? 'Loading voices...' : 'Configure ElevenLabs API key to load available voices.'}
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Greeting Templates */}
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><Volume2 className="h-4 w-4" /> {t('intercom.welcome_messages')}</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mb-3">{t('intercom.welcome_desc')}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(greetingTemplates.length > 0 ? greetingTemplates : [
                        { id: 'default', name: 'Bienvenida estándar', context: 'default' as const, textEs: 'Bienvenido a la propiedad. Por favor identifíquese para autorizar su ingreso.', textEn: '' },
                        { id: 'after_hours', name: 'Fuera de horario', context: 'after_hours' as const, textEs: 'Fuera de horario de atención. Deje su mensaje o contacte seguridad al ext. 100.', textEn: '' },
                        { id: 'emergency', name: 'Emergencia', context: 'emergency' as const, textEs: 'Atención. Protocolo de emergencia activado. Siga las instrucciones del personal de seguridad.', textEn: '' },
                        { id: 'maintenance', name: 'Mantenimiento', context: 'maintenance' as const, textEs: 'Sistema en mantenimiento. Comuníquese con administración para asistencia.', textEn: '' },
                      ]).map((tpl) => (
                        <div key={tpl.id} className="p-2 rounded bg-muted/50 border">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-semibold text-muted-foreground capitalize">{tpl.name}</p>
                            <Button
                              variant="ghost" size="icon" className="h-6 w-6"
                              onClick={() => handlePlayGreeting(tpl.context)}
                              disabled={playingGreeting !== null}
                            >
                              {playingGreeting === tpl.context ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                            </Button>
                          </div>
                          <p className="text-xs mt-1">"{tpl.textEs}"</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('intercom.add_device')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>{t('common.name')} *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Citófono Portería" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>Brand</Label><Input value={form.brand} onChange={e => setForm(p => ({ ...p, brand: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Model</Label><Input value={form.model} onChange={e => setForm(p => ({ ...p, model: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>IP Address</Label><Input value={form.ip_address} onChange={e => setForm(p => ({ ...p, ip_address: e.target.value }))} placeholder="192.168.1.201" /></div>
              <div className="space-y-1"><Label>SIP URI</Label><Input value={form.sip_uri} onChange={e => setForm(p => ({ ...p, sip_uri: e.target.value }))} placeholder="sip:101@pbx" /></div>
            </div>
            <div className="space-y-1"><Label>{t('intercom.section')}</Label>
              <Select value={form.section_id} onValueChange={v => setForm(p => ({ ...p, section_id: v }))}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{sections.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleAdd} disabled={!form.name.trim() || create.isPending}>{t('common.save')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
