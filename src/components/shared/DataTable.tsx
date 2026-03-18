// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Reusable DataTable Component
// Generic table with sort, filter, pagination, selection
// ═══════════════════════════════════════════════════════════

import React, { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ChevronUp, ChevronDown, ChevronsUpDown, Search,
  ChevronLeft, ChevronRight, Loader2, Inbox,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────

export interface ColumnDef<T> {
  /** Unique key for the column */
  key: string;
  /** Display header text */
  header: string;
  /** Cell render function */
  cell: (row: T) => React.ReactNode;
  /** Sortable. If a string, used as the sort key. If true, uses `key`. */
  sortable?: boolean | string;
  /** Width class (tailwind) */
  width?: string;
  /** Custom header render */
  headerRender?: () => React.ReactNode;
  /** Whether this column is hidden by default */
  hidden?: boolean;
}

type SortDirection = 'asc' | 'desc' | null;

interface SortState {
  key: string;
  direction: SortDirection;
}

export interface DataTableProps<T> {
  /** Column definitions */
  columns: ColumnDef<T>[];
  /** Data rows */
  data: T[];
  /** Unique key extractor */
  getRowId: (row: T) => string;
  /** Loading state */
  isLoading?: boolean;
  /** Search placeholder */
  searchPlaceholder?: string;
  /** Client-side search filter function */
  searchFilter?: (row: T, query: string) => boolean;
  /** Show selection checkboxes */
  selectable?: boolean;
  /** Callback when selection changes */
  onSelectionChange?: (selectedIds: string[]) => void;
  /** Actions for selected rows */
  bulkActions?: React.ReactNode;
  /** Row click handler */
  onRowClick?: (row: T) => void;
  /** Custom empty state */
  emptyMessage?: string;
  /** Custom empty icon */
  emptyIcon?: React.ReactNode;
  /** Page size (default 25) */
  pageSize?: number;
  /** Custom class for the table wrapper */
  className?: string;
  /** Server-side pagination controls */
  totalCount?: number;
  /** Current page for server-side pagination */
  page?: number;
  /** Page change handler for server-side pagination */
  onPageChange?: (page: number) => void;
}

// ── Component ──────────────────────────────────────────────

export function DataTable<T>({
  columns,
  data,
  getRowId,
  isLoading = false,
  searchPlaceholder = 'Search...',
  searchFilter,
  selectable = false,
  onSelectionChange,
  bulkActions,
  onRowClick,
  emptyMessage = 'No data found',
  emptyIcon,
  pageSize = 25,
  className,
  totalCount,
  page: controlledPage,
  onPageChange,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState>({ key: '', direction: null });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [internalPage, setInternalPage] = useState(1);

  const isServerPaginated = totalCount !== undefined && onPageChange !== undefined;
  const currentPage = isServerPaginated ? (controlledPage ?? 1) : internalPage;

  const visibleColumns = useMemo(
    () => columns.filter((col) => !col.hidden),
    [columns]
  );

  // ── Filtering ──────────────────────────────────────────

  const filteredData = useMemo(() => {
    if (!search || !searchFilter) return data;
    const q = search.toLowerCase().trim();
    return data.filter((row) => searchFilter(row, q));
  }, [data, search, searchFilter]);

  // ── Sorting ────────────────────────────────────────────

  const sortedData = useMemo(() => {
    if (!sort.key || !sort.direction) return filteredData;

    const col = columns.find((c) => c.key === sort.key);
    if (!col || !col.sortable) return filteredData;

    return [...filteredData].sort((a, b) => {
      const sortKey = typeof col.sortable === 'string' ? col.sortable : col.key;
      const aVal = (a as Record<string, unknown>)[sortKey];
      const bVal = (b as Record<string, unknown>)[sortKey];

      if (aVal === bVal) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      const comparison = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sort.direction === 'desc' ? -comparison : comparison;
    });
  }, [filteredData, sort, columns]);

  // ── Pagination ─────────────────────────────────────────

  const total = isServerPaginated ? totalCount : sortedData.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const paginatedData = isServerPaginated
    ? sortedData
    : sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const goToPage = useCallback(
    (p: number) => {
      const clamped = Math.max(1, Math.min(p, totalPages));
      if (isServerPaginated) {
        onPageChange?.(clamped);
      } else {
        setInternalPage(clamped);
      }
    },
    [totalPages, isServerPaginated, onPageChange]
  );

  // ── Sorting Toggle ─────────────────────────────────────

  const toggleSort = useCallback((key: string) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return { key: '', direction: null };
    });
  }, []);

  // ── Selection ──────────────────────────────────────────

  const toggleSelect = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        onSelectionChange?.(Array.from(next));
        return next;
      });
    },
    [onSelectionChange]
  );

  const toggleSelectAll = useCallback(() => {
    const allIds = paginatedData.map(getRowId);
    const allSelected = allIds.every((id) => selectedIds.has(id));

    if (allSelected) {
      setSelectedIds(new Set());
      onSelectionChange?.([]);
    } else {
      const next = new Set(allIds);
      setSelectedIds(next);
      onSelectionChange?.(allIds);
    }
  }, [paginatedData, getRowId, selectedIds, onSelectionChange]);

  const allSelected = paginatedData.length > 0 && paginatedData.every((row) => selectedIds.has(getRowId(row)));
  const someSelected = selectedIds.size > 0;

  // ── Render ─────────────────────────────────────────────

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {searchFilter && (
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (!isServerPaginated) setInternalPage(1);
                }}
                className="pl-9 h-9"
              />
            </div>
          )}
          {someSelected && bulkActions && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">{selectedIds.size} selected</Badge>
              {bulkActions}
            </div>
          )}
        </div>
        <div className="text-xs text-muted-foreground shrink-0">
          {total} {total === 1 ? 'item' : 'items'}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {selectable && (
                  <th className="w-10 px-3 py-2.5">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </th>
                )}
                {visibleColumns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      'px-3 py-2.5 text-left font-medium text-muted-foreground',
                      col.sortable && 'cursor-pointer select-none hover:text-foreground transition-colors',
                      col.width
                    )}
                    onClick={() => col.sortable && toggleSort(col.key)}
                  >
                    <div className="flex items-center gap-1">
                      {col.headerRender ? col.headerRender() : col.header}
                      {col.sortable && (
                        <span className="ml-auto">
                          {sort.key === col.key && sort.direction === 'asc' ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : sort.key === col.key && sort.direction === 'desc' ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={visibleColumns.length + (selectable ? 1 : 0)} className="h-48">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span className="text-xs">Loading...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + (selectable ? 1 : 0)} className="h-48">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      {emptyIcon || <Inbox className="h-8 w-8 opacity-50" />}
                      <span className="text-sm">{emptyMessage}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((row) => {
                  const rowId = getRowId(row);
                  return (
                    <tr
                      key={rowId}
                      className={cn(
                        'border-b last:border-0 transition-colors',
                        onRowClick && 'cursor-pointer hover:bg-muted/50',
                        selectedIds.has(rowId) && 'bg-primary/5'
                      )}
                      onClick={() => onRowClick?.(row)}
                    >
                      {selectable && (
                        <td className="w-10 px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(rowId)}
                            onCheckedChange={() => toggleSelect(rowId)}
                            aria-label={`Select row ${rowId}`}
                          />
                        </td>
                      )}
                      {visibleColumns.map((col) => (
                        <td key={col.key} className={cn('px-3 py-2.5', col.width)}>
                          {col.cell(row)}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-muted-foreground">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage <= 1}
              onClick={() => goToPage(currentPage - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage >= totalPages}
              onClick={() => goToPage(currentPage + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
