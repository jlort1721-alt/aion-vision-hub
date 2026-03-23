import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import {
  Phone, PhoneCall, PhoneOff, Search, User, Shield, Clock, Star, Hash,
} from 'lucide-react';

// ── Contact categories ─────────────────────────────
const CONTACT_CATEGORIES = [
  { value: 'emergencia', label: 'Emergencia', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  { value: 'administracion', label: 'Administracion', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { value: 'propietarios', label: 'Propietarios', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  { value: 'proveedores', label: 'Proveedores', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
];

// ── Emergency speed dial ─────────────────────────────
const EMERGENCY_CONTACTS = [
  { name: 'Policia', number: '123', icon: Shield, color: 'bg-blue-600 hover:bg-blue-700 text-white' },
  { name: 'Bomberos', number: '119', icon: PhoneCall, color: 'bg-red-600 hover:bg-red-700 text-white' },
  { name: 'Ambulancia', number: '125', icon: PhoneCall, color: 'bg-green-600 hover:bg-green-700 text-white' },
  { name: 'Supervisor', number: '', icon: Star, color: 'bg-purple-600 hover:bg-purple-700 text-white' },
];

const KEYPAD = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

interface ContactPerson {
  id: string;
  full_name: string;
  phone: string;
  role: string;
  section_id?: string;
}

interface RecentCall {
  number: string;
  contactName: string;
  time: string;
  status: 'completada' | 'perdida' | 'cancelada';
}

function formatPhoneDisplay(num: string) {
  const digits = num.replace(/\D/g, '');
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  if (digits.length <= 10) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  return `+${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'Ahora';
  if (diff < 60) return `Hace ${diff}m`;
  const hrs = Math.floor(diff / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  return `Hace ${Math.floor(hrs / 24)}d`;
}

export default function PhonePanelPage() {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const [calling, setCalling] = useState(false);

  // ── Load contacts from access_people ─────────────────────────────
  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['phone_contacts', profile?.tenant_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('access_people')
        .select('*')
        .eq('tenant_id', profile!.tenant_id)
        .not('phone', 'is', null)
        .order('full_name', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ContactPerson[];
    },
    enabled: !!profile?.tenant_id,
  });

  // ── Load recent intercom calls ─────────────────────────────
  const { data: intercomCalls = [] } = useQuery({
    queryKey: ['intercom_recent_calls', profile?.tenant_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('intercom_calls')
        .select('*')
        .eq('tenant_id', profile!.tenant_id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []).map((c: any) => ({
        number: c.caller_id || c.sip_uri || 'Desconocido',
        contactName: c.caller_name || '',
        time: c.created_at,
        status: c.status === 'answered' ? 'completada' as const : 'perdida' as const,
      }));
    },
    enabled: !!profile?.tenant_id,
  });

  const allRecentCalls = useMemo(() => {
    return [...recentCalls, ...intercomCalls].slice(0, 20);
  }, [recentCalls, intercomCalls]);

  // ── Filtered contacts ─────────────────────────────
  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      if (categoryFilter !== 'all' && c.role !== categoryFilter) return false;
      if (contactSearch) {
        const q = contactSearch.toLowerCase();
        return c.full_name.toLowerCase().includes(q) || (c.phone || '').includes(q);
      }
      return true;
    });
  }, [contacts, categoryFilter, contactSearch]);

  // ── Dial functions ─────────────────────────────
  function handleKeyPress(key: string) {
    setPhoneNumber((prev) => prev + key);
  }

  function handleBackspace() {
    setPhoneNumber((prev) => prev.slice(0, -1));
  }

  function handleDial(number: string) {
    if (!number.trim()) {
      toast({ title: 'Ingrese un numero', variant: 'destructive' });
      return;
    }
    setCalling(true);

    // Log the call locally
    const matchedContact = contacts.find((c) => c.phone === number);
    setRecentCalls((prev) => [{
      number,
      contactName: matchedContact?.full_name || '',
      time: new Date().toISOString(),
      status: 'completada' as const,
    }, ...prev].slice(0, 20));

    // Attempt tel: for mobile, sip: as fallback
    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    const uri = isMobile ? `tel:${number}` : `sip:${number}`;
    window.open(uri, '_blank');

    toast({ title: 'Llamando...', description: `Marcando ${formatPhoneDisplay(number)}` });
    setTimeout(() => setCalling(false), 2000);
  }

  function handleHangup() {
    setCalling(false);
    setPhoneNumber('');
    toast({ title: 'Llamada finalizada' });
  }

  function categoryColor(role: string) {
    return CONTACT_CATEGORIES.find((c) => c.value === role)?.color || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }

  function categoryLabel(role: string) {
    return CONTACT_CATEGORIES.find((c) => c.value === role)?.label || role;
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* ── Header ────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Phone className="h-6 w-6 text-primary" />
          Panel Telefonico
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Marcador rapido, contactos y registro de llamadas
        </p>
      </div>

      {/* ── Emergency Speed Dial ────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {EMERGENCY_CONTACTS.map((ec) => (
          <Button
            key={ec.name}
            className={`h-16 text-base font-semibold gap-2 ${ec.color}`}
            onClick={() => ec.number && handleDial(ec.number)}
            disabled={!ec.number}
          >
            <ec.icon className="h-5 w-5" />
            {ec.name}
            {ec.number && <span className="text-xs opacity-80">({ec.number})</span>}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Dialer ────────────────────── */}
        <div className="space-y-4">
          <Card className="border-border/50 bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Hash className="h-4 w-4 text-primary" />
                Marcador
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Phone number display */}
              <div className="relative">
                <Input
                  value={formatPhoneDisplay(phoneNumber)}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="Ingrese numero..."
                  className="text-center text-2xl font-mono h-14 tracking-wider"
                />
                {phoneNumber && (
                  <button
                    onClick={handleBackspace}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <PhoneOff className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-2">
                {KEYPAD.flat().map((key) => (
                  <Button
                    key={key}
                    variant="outline"
                    className="h-14 text-xl font-mono hover:bg-muted/50"
                    onClick={() => handleKeyPress(key)}
                  >
                    {key}
                  </Button>
                ))}
              </div>

              {/* Call / Hangup buttons */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  className="h-14 bg-green-600 hover:bg-green-700 text-white text-lg gap-2"
                  onClick={() => handleDial(phoneNumber)}
                  disabled={calling || !phoneNumber.trim()}
                >
                  <PhoneCall className="h-5 w-5" />
                  Llamar
                </Button>
                <Button
                  variant="destructive"
                  className="h-14 text-lg gap-2"
                  onClick={handleHangup}
                  disabled={!calling && !phoneNumber}
                >
                  <PhoneOff className="h-5 w-5" />
                  Colgar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ── Recent Calls ────────────────────── */}
          <Card className="border-border/50 bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Llamadas Recientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {allRecentCalls.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sin llamadas recientes</p>
              ) : (
                <div className="space-y-1 max-h-[300px] overflow-y-auto">
                  {allRecentCalls.map((call, i) => (
                    <div
                      key={`${call.number}-${i}`}
                      className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-muted/30 cursor-pointer"
                      onClick={() => {
                        setPhoneNumber(call.number.replace(/\D/g, ''));
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <PhoneCall className={`h-3.5 w-3.5 shrink-0 ${
                          call.status === 'completada' ? 'text-green-400' :
                          call.status === 'perdida' ? 'text-red-400' : 'text-amber-400'
                        }`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {call.contactName || formatPhoneDisplay(call.number)}
                          </p>
                          {call.contactName && (
                            <p className="text-xs text-muted-foreground font-mono">{call.number}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{timeAgo(call.time)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Quick Contacts (sidebar) ────────────────────── */}
        <div className="lg:col-span-2">
          <Card className="border-border/50 bg-card/80 h-full">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  Contactos Rapidos
                </CardTitle>
                <div className="flex gap-2">
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[160px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {CONTACT_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="relative mt-2">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar contactos..."
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <User className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>No se encontraron contactos</p>
                  <p className="text-xs mt-1">Los contactos con telefono registrado apareceran aqui</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[600px] overflow-y-auto">
                  {filteredContacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{contact.full_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-mono text-muted-foreground">{contact.phone}</span>
                          <Badge variant="outline" className={`${categoryColor(contact.role)} text-[10px] px-1.5`}>
                            {categoryLabel(contact.role)}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        className="h-9 w-9 bg-green-600 hover:bg-green-700 text-white shrink-0 ml-2"
                        onClick={() => handleDial(contact.phone)}
                      >
                        <PhoneCall className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
