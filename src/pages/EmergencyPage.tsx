import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { emergencyProtocolsApi, emergencyContactsApi, emergencyActivationsApi } from "@/services/emergency-api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { AlertOctagon, Phone, ShieldAlert, Users, Plus } from "lucide-react";

const protocolTypeColors: Record<string, string> = {
  fire: "bg-red-500",
  medical: "bg-green-500",
  security: "bg-blue-500",
  natural_disaster: "bg-orange-500",
  evacuation: "bg-yellow-500",
  lockdown: "bg-purple-500",
  bomb_threat: "bg-red-700",
  active_shooter: "bg-red-900",
  hazmat: "bg-amber-600",
};

const activationStatusColors: Record<string, string> = {
  active: "bg-red-500",
  resolved: "bg-green-500",
  cancelled: "bg-gray-500",
};

export default function EmergencyPage() {
  const [activeTab, setActiveTab] = useState("protocols");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ── Protocols ───────────────────────────────────────────
  const { data: protocolsData, isLoading: loadingProtocols } = useQuery({
    queryKey: ["emergency", "protocols"],
    queryFn: () => emergencyProtocolsApi.list(),
  });

  // ── Contacts ────────────────────────────────────────────
  const { data: contactsData, isLoading: loadingContacts } = useQuery({
    queryKey: ["emergency", "contacts"],
    queryFn: () => emergencyContactsApi.list(),
  });

  // ── Activations ─────────────────────────────────────────
  const { data: activationsData, isLoading: loadingActivations } = useQuery({
    queryKey: ["emergency", "activations"],
    queryFn: () => emergencyActivationsApi.list(),
    refetchInterval: 10000,
  });

  const { data: statsData } = useQuery({
    queryKey: ["emergency", "stats"],
    queryFn: () => emergencyActivationsApi.stats(),
    refetchInterval: 15000,
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => emergencyActivationsApi.resolve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emergency"] });
      toast({ title: "Emergency resolved" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => emergencyActivationsApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emergency"] });
      toast({ title: "Emergency cancelled" });
    },
  });

  const protocols = protocolsData?.data ?? [];
  const contacts = contactsData?.data ?? [];
  const activations = activationsData?.data ?? [];
  const stats = statsData?.data;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldAlert className="h-6 w-6" />
            Emergency Management
          </h1>
          <p className="text-muted-foreground">
            Manage emergency protocols, contacts, and active emergencies
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Emergencies</p>
                <p className="text-3xl font-bold text-red-500">{stats?.activeEmergencies ?? 0}</p>
              </div>
              <AlertOctagon className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Protocols</p>
                <p className="text-3xl font-bold">{stats?.totalProtocols ?? 0}</p>
              </div>
              <ShieldAlert className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Emergency Contacts</p>
                <p className="text-3xl font-bold">{stats?.emergencyContacts ?? 0}</p>
              </div>
              <Phone className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Resolved Today</p>
                <p className="text-3xl font-bold text-green-500">{stats?.resolvedToday ?? 0}</p>
              </div>
              <Users className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="protocols" className="gap-1">
            <ShieldAlert className="h-4 w-4" /> Protocols
          </TabsTrigger>
          <TabsTrigger value="contacts" className="gap-1">
            <Phone className="h-4 w-4" /> Contacts
          </TabsTrigger>
          <TabsTrigger value="activations" className="gap-1">
            <AlertOctagon className="h-4 w-4" /> Activations
          </TabsTrigger>
        </TabsList>

        {/* ── Protocols Tab ───────────────────────────────── */}
        <TabsContent value="protocols" className="space-y-4">
          <div className="flex justify-end">
            <Button className="gap-1">
              <Plus className="h-4 w-4" /> New Protocol
            </Button>
          </div>
          {loadingProtocols ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : protocols.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ShieldAlert className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium">No emergency protocols</p>
                <p className="text-sm text-muted-foreground mt-1">Create protocols to define emergency response procedures</p>
              </CardContent>
            </Card>
          ) : (
            protocols.map((protocol: any) => (
              <Card key={protocol.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ShieldAlert className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{protocol.name}</h3>
                          <Badge className={protocolTypeColors[protocol.type] || 'bg-gray-500'}>
                            {protocol.type?.replace('_', ' ')}
                          </Badge>
                          {protocol.priority && (
                            <Badge variant="outline">Priority: {protocol.priority}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Steps: {protocol.steps?.length ?? 0}
                          {protocol.description && ` | ${protocol.description}`}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ── Contacts Tab ────────────────────────────────── */}
        <TabsContent value="contacts" className="space-y-4">
          <div className="flex justify-end">
            <Button className="gap-1">
              <Plus className="h-4 w-4" /> New Contact
            </Button>
          </div>
          {loadingContacts ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : contacts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Phone className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium">No emergency contacts</p>
                <p className="text-sm text-muted-foreground mt-1">Add contacts who should be notified during emergencies</p>
              </CardContent>
            </Card>
          ) : (
            contacts.map((contact: any) => (
              <Card key={contact.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Phone className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{contact.name}</h3>
                          {contact.role && <Badge variant="outline">{contact.role}</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {contact.phone && `Phone: ${contact.phone}`}
                          {contact.phone && contact.email && ' | '}
                          {contact.email && `Email: ${contact.email}`}
                        </p>
                        {contact.availability && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Availability: {contact.availability}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ── Activations Tab ─────────────────────────────── */}
        <TabsContent value="activations" className="space-y-4">
          <div className="flex justify-end">
            <Button className="gap-1" variant="destructive">
              <AlertOctagon className="h-4 w-4" /> Activate Emergency
            </Button>
          </div>
          {loadingActivations ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : activations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertOctagon className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p className="text-lg font-medium">No active emergencies</p>
                <p className="text-sm text-muted-foreground mt-1">All clear — no emergencies currently active</p>
              </CardContent>
            </Card>
          ) : (
            activations.map((activation: any) => (
              <Card key={activation.id} className={activation.status === 'active' ? 'border-red-500/50' : ''}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <AlertOctagon className={`h-5 w-5 mt-0.5 ${activation.status === 'active' ? 'text-red-500 animate-pulse' : 'text-muted-foreground'}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{activation.title || activation.protocolName || 'Emergency'}</h3>
                          <Badge className={activationStatusColors[activation.status] || 'bg-gray-500'}>
                            {activation.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {activation.description || 'No description'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Activated: {activation.createdAt ? new Date(activation.createdAt).toLocaleString() : 'N/A'}
                          {activation.resolvedAt && ` | Resolved: ${new Date(activation.resolvedAt).toLocaleString()}`}
                          {activation.cancelledAt && ` | Cancelled: ${new Date(activation.cancelledAt).toLocaleString()}`}
                        </p>
                      </div>
                    </div>
                    {activation.status === 'active' && (
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="default" onClick={() => resolveMutation.mutate(activation.id)}>
                          Resolve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => cancelMutation.mutate(activation.id)}>
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
