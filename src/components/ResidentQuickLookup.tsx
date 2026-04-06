// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Resident Quick Lookup
// Compact search component for resident lookup
// Used in command palette and dashboard
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, User, Home, Phone, MapPin } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────

interface ResidentResult {
  id: string;
  name: string;
  unit: string;
  phone?: string;
  contact?: string;
  site: string;
}

interface ResidentsResponse {
  residents?: ResidentResult[];
  data?: ResidentResult[];
}

// ── Debounce Hook ─────────────────────────────────────────

function useDebounce(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

// ── Component ─────────────────────────────────────────────

export default function ResidentQuickLookup({
  onSelect,
}: {
  onSelect?: (resident: ResidentResult) => void;
}) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useQuery<ResidentResult[]>({
    queryKey: ['resident-quick-lookup', debouncedSearch],
    queryFn: async () => {
      const resp = await apiClient.get<ResidentsResponse>(
        '/operational-data/residents',
        { search: debouncedSearch, limit: '5' }
      );
      return resp?.residents ?? resp?.data ?? (Array.isArray(resp) ? resp : []);
    },
    enabled: debouncedSearch.length >= 2,
    staleTime: 15_000,
  });

  const results = data ?? [];

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar residente por nombre o unidad"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading && debouncedSearch.length >= 2 && (
        <div className="flex justify-center py-4">
          <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      )}

      {!isLoading && debouncedSearch.length >= 2 && results.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No se encontraron residentes
        </p>
      )}

      {results.length > 0 && (
        <div className="rounded-md border divide-y overflow-hidden">
          {results.map((resident) => (
            <button
              key={resident.id}
              className="flex items-start gap-3 w-full px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
              onClick={() => onSelect?.(resident)}
            >
              <div className="mt-0.5 shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-sm font-medium truncate">{resident.name}</p>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Home className="h-3 w-3" />
                    {resident.unit}
                  </span>
                  {(resident.phone || resident.contact) && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {resident.phone || resident.contact}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                      {resident.site}
                    </Badge>
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
