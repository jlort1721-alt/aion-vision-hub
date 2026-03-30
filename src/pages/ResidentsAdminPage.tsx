// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Administracion de Residentes
// Tabla de datos con busqueda, filtro por sede y paginacion
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { PageShell } from '@/components/shared/PageShell';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Users,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Phone,
  Mail,
  Car,
  MapPin,
  User,
  Home,
  Building2,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────

interface Resident {
  id: string;
  unit: string;
  name: string;
  contact: string;
  email?: string;
  phone?: string;
  plates: string[];
  site: string;
  siteId: string;
  status: 'active' | 'inactive';
  moveInDate?: string;
  notes?: string;
}

interface ResidentsResponse {
  residents: Resident[];
  total: number;
  page: number;
  pageSize: number;
}

interface SiteOption {
  id: string;
  name: string;
}

// ── Debounce Hook ──────────────────────────────────────────

function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

// ── Expanded Row Component ─────────────────────────────────

function ResidentDetails({ resident }: { resident: Resident }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
      {/* Contact info */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
          <User className="h-3.5 w-3.5" />
          Contacto
        </h4>
        {resident.phone && (
          <p className="text-sm flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
            {resident.phone}
          </p>
        )}
        {resident.email && (
          <p className="text-sm flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            {resident.email}
          </p>
        )}
        {!resident.phone && !resident.email && (
          <p className="text-sm text-muted-foreground">Sin datos de contacto adicionales</p>
        )}
      </div>

      {/* Plates */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
          <Car className="h-3.5 w-3.5" />
          Vehiculos
        </h4>
        {resident.plates.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {resident.plates.map((plate) => (
              <Badge key={plate} variant="outline" className="font-mono text-xs">
                {plate}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sin vehiculos registrados</p>
        )}
      </div>

      {/* Additional info */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5" />
          Informacion
        </h4>
        <p className="text-sm">
          <span className="text-muted-foreground">Sede:</span> {resident.site}
        </p>
        <p className="text-sm">
          <span className="text-muted-foreground">Estado:</span>{' '}
          <Badge variant={resident.status === 'active' ? 'default' : 'secondary'} className="text-xs">
            {resident.status === 'active' ? 'Activo' : 'Inactivo'}
          </Badge>
        </p>
        {resident.moveInDate && (
          <p className="text-sm">
            <span className="text-muted-foreground">Ingreso:</span>{' '}
            {new Date(resident.moveInDate).toLocaleDateString('es-CO', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </p>
        )}
        {resident.notes && (
          <p className="text-sm mt-2 text-muted-foreground italic">{resident.notes}</p>
        )}
      </div>
    </div>
  );
}

// ── Table Skeleton ─────────────────────────────────────────

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
          <TableCell><Skeleton className="h-4 w-28" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

// ── Main Page Component ────────────────────────────────────

const PAGE_SIZE = 50;

export default function ResidentsAdminPage() {
  const [search, setSearch] = useState('');
  const [siteFilter, setSiteFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, siteFilter]);

  // ── Fetch Sites for Filter ─────────────────────────────

  const { data: sites } = useQuery<SiteOption[]>({
    queryKey: ['operational-sites'],
    queryFn: () => apiClient.get<SiteOption[]>('/operational-data/sites'),
    staleTime: 300_000,
  });

  // ── Fetch Residents ────────────────────────────────────

  const {
    data: residentsData,
    isLoading,
    isError,
    error,
  } = useQuery<ResidentsResponse>({
    queryKey: ['residents-admin', debouncedSearch, siteFilter, page],
    queryFn: () =>
      apiClient.get<ResidentsResponse>('/operational-data/residents', {
        search: debouncedSearch || undefined,
        site: siteFilter !== 'all' ? siteFilter : undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    staleTime: 30_000,
  });

  // ── Pagination ─────────────────────────────────────────

  const totalPages = useMemo(() => {
    if (!residentsData) return 1;
    return Math.max(1, Math.ceil(residentsData.total / PAGE_SIZE));
  }, [residentsData]);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  // ── Render ─────────────────────────────────────────────

  return (
    <PageShell
      title="Residentes"
      description="Gestion y consulta de residentes de todas las sedes"
      icon={<Users className="h-5 w-5" />}
      badge={
        residentsData ? (
          <Badge variant="secondary">{residentsData.total.toLocaleString('es-CO')}</Badge>
        ) : undefined
      }
    >
      <div className="p-6 space-y-4">
        {/* ── Filters Bar ──────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, unidad o placa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={siteFilter} onValueChange={setSiteFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Todas las sedes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las sedes</SelectItem>
              {sites?.map((site) => (
                <SelectItem key={site.id} value={site.id}>
                  {site.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ── Error State ──────────────────────────────── */}
        {isError && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">
                Error al cargar residentes:{' '}
                {error instanceof Error ? error.message : 'Error desconocido'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* ── Data Table ───────────────────────────────── */}
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Unidad</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Placas</TableHead>
                  <TableHead>Sede</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableSkeleton />
                ) : residentsData && residentsData.residents.length > 0 ? (
                  residentsData.residents.map((resident) => {
                    const isExpanded = expandedId === resident.id;
                    return (
                      <Collapsible
                        key={resident.id}
                        open={isExpanded}
                        onOpenChange={() => handleToggleExpand(resident.id)}
                        asChild
                      >
                        <>
                          <CollapsibleTrigger asChild>
                            <TableRow className="cursor-pointer">
                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  <Home className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="font-medium">{resident.unit}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span>{resident.name}</span>
                                  {resident.status === 'inactive' && (
                                    <Badge variant="secondary" className="text-xs">
                                      Inactivo
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {resident.contact}
                              </TableCell>
                              <TableCell>
                                {resident.plates.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {resident.plates.slice(0, 2).map((plate) => (
                                      <Badge
                                        key={plate}
                                        variant="outline"
                                        className="font-mono text-xs"
                                      >
                                        {plate}
                                      </Badge>
                                    ))}
                                    {resident.plates.length > 2 && (
                                      <Badge variant="secondary" className="text-xs">
                                        +{resident.plates.length - 2}
                                      </Badge>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">--</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {resident.site}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          </CollapsibleTrigger>
                          <CollapsibleContent asChild>
                            <tr>
                              <td colSpan={5} className="p-0">
                                <ResidentDetails resident={resident} />
                              </td>
                            </tr>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Users className="h-8 w-8 opacity-50" />
                        <p className="text-sm">
                          {debouncedSearch || siteFilter !== 'all'
                            ? 'No se encontraron residentes con los filtros aplicados'
                            : 'No hay residentes registrados'}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* ── Pagination ───────────────────────────────── */}
        {residentsData && residentsData.total > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-muted-foreground">
              Mostrando {((page - 1) * PAGE_SIZE) + 1}
              {' - '}
              {Math.min(page * PAGE_SIZE, residentsData.total)} de{' '}
              {residentsData.total.toLocaleString('es-CO')} residentes
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground px-2">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Siguiente
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
