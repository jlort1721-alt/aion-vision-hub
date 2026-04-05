import React, { useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, FileText, CheckCircle2, AlertCircle, XCircle, Download, Loader2, FileUp } from 'lucide-react';
import { toast } from 'sonner';
import {
  dataImportApi,
  parseCSVToRecords,
  EXPECTED_COLUMNS,
} from '@/services/data-import-api';
import type { ImportEntityType, ImportResult, ImportError } from '@/services/data-import-api';

// ── Props ────────────────────────────────────────────────────

interface DataImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: ImportEntityType;
  /** Called after a successful import so the parent can refetch data */
  onImportComplete?: (result: ImportResult) => void;
}

// ── Stages ───────────────────────────────────────────────────

type Stage = 'upload' | 'preview' | 'importing' | 'results';

// ── Component ────────────────────────────────────────────────

export default function DataImportDialog({
  open,
  onOpenChange,
  entityType,
  onImportComplete,
}: DataImportDialogProps) {
  const [stage, setStage] = useState<Stage>('upload');
  const [inputMode, setInputMode] = useState<'csv' | 'json'>('csv');
  const [rawText, setRawText] = useState('');
  const [records, setRecords] = useState<Record<string, string>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const expectedCols = EXPECTED_COLUMNS[entityType];
  const entityLabel = entityType.charAt(0).toUpperCase() + entityType.slice(1);

  // ── Reset ─────────────────────────────────────────────────

  const reset = useCallback(() => {
    setStage('upload');
    setRawText('');
    setRecords([]);
    setColumns([]);
    setProgress(0);
    setImportResult(null);
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) reset();
      onOpenChange(nextOpen);
    },
    [onOpenChange, reset],
  );

  // ── File Upload ───────────────────────────────────────────

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (!text) return;

        if (file.name.endsWith('.json')) {
          setInputMode('json');
          setRawText(text);
          try {
            const parsed = JSON.parse(text);
            const arr = Array.isArray(parsed) ? parsed : parsed.records || [];
            setRecords(arr);
            setColumns(arr.length > 0 ? Object.keys(arr[0]) : []);
            setStage('preview');
          } catch {
            toast.error('Invalid JSON file');
          }
        } else {
          setInputMode('csv');
          setRawText(text);
          const { records: parsed, columns: cols } = parseCSVToRecords(text);
          if (parsed.length === 0) {
            toast.error('CSV file is empty or has no data rows');
            return;
          }
          setRecords(parsed);
          setColumns(cols);
          setStage('preview');
        }
      };
      reader.readAsText(file);
      // Reset so the same file can be re-selected
      event.target.value = '';
    },
    [],
  );

  // ── Paste Parse ───────────────────────────────────────────

  const handleParse = useCallback(() => {
    if (!rawText.trim()) {
      toast.error('Please paste data first');
      return;
    }

    if (inputMode === 'json') {
      try {
        const parsed = JSON.parse(rawText);
        const arr = Array.isArray(parsed) ? parsed : parsed.records || [];
        if (arr.length === 0) {
          toast.error('No records found in JSON');
          return;
        }
        setRecords(arr);
        setColumns(Object.keys(arr[0]));
        setStage('preview');
      } catch {
        toast.error('Invalid JSON format');
      }
    } else {
      const { records: parsed, columns: cols } = parseCSVToRecords(rawText);
      if (parsed.length === 0) {
        toast.error('No data rows found in CSV');
        return;
      }
      setRecords(parsed);
      setColumns(cols);
      setStage('preview');
    }
  }, [rawText, inputMode]);

  // ── Import ────────────────────────────────────────────────

  const handleImport = useCallback(async () => {
    setStage('importing');
    setProgress(10);

    try {
      setProgress(30);
      const response = await dataImportApi.import(entityType, records);
      setProgress(90);

      const result = response.data;
      setImportResult(result);
      setProgress(100);
      setStage('results');

      if (result.imported > 0) {
        toast.success(`Imported ${result.imported} ${entityType} successfully`);
        onImportComplete?.(result);
      } else if (result.skipped === result.total) {
        toast.info(`All ${result.total} records already exist (skipped)`);
      } else {
        toast.warning(`Import completed with ${result.errors.length} errors`);
      }
    } catch (err) {
      setStage('preview');
      toast.error(err instanceof Error ? err.message : 'Import failed');
    }
  }, [entityType, records, onImportComplete]);

  // ── Error Report Download ─────────────────────────────────

  const downloadErrorReport = useCallback(() => {
    if (!importResult?.errors.length) return;

    const lines = ['row,reason'];
    for (const err of importResult.errors) {
      lines.push(`${err.row},"${err.reason.replace(/"/g, '""')}"`);
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-errors-${entityType}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [importResult, entityType]);

  // ── Template Download ─────────────────────────────────────

  const downloadTemplate = useCallback(() => {
    const allCols = [...expectedCols.required, ...expectedCols.optional];
    const blob = new Blob([allCols.join(',') + '\n'], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entityType}-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [entityType, expectedCols]);

  // ── Column Status ─────────────────────────────────────────

  const getColumnStatus = (col: string): 'required' | 'optional' | 'unknown' => {
    if (expectedCols.required.includes(col)) return 'required';
    if (expectedCols.optional.includes(col)) return 'optional';
    return 'unknown';
  };

  // ── Render ────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-primary" />
            Import {entityLabel}
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file or paste JSON data to import {entityType} in bulk.
          </DialogDescription>
        </DialogHeader>

        {/* ── Upload Stage ────────────────────────────────── */}
        {stage === 'upload' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as 'csv' | 'json')}>
                <TabsList className="h-8">
                  <TabsTrigger value="csv" className="text-xs">CSV</TabsTrigger>
                  <TabsTrigger value="json" className="text-xs">JSON</TabsTrigger>
                </TabsList>
              </Tabs>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="mr-1 h-3 w-3" /> Download Template
              </Button>
            </div>

            {/* File upload area */}
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium">Click to select a file or drag and drop</p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports .csv and .json files (max 5,000 records)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or paste data</span>
              </div>
            </div>

            <Textarea
              placeholder={
                inputMode === 'csv'
                  ? `fullName,unit,phone,documentId\nJohn Doe,Apt 101,+1234567890,DNI12345\nJane Smith,Apt 202,+0987654321,DNI67890`
                  : `[\n  { "fullName": "John Doe", "unit": "Apt 101", "phone": "+1234567890" },\n  { "fullName": "Jane Smith", "unit": "Apt 202" }\n]`
              }
              className="min-h-[120px] font-mono text-xs"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
            />

            <div className="flex justify-between items-center">
              <div className="text-xs text-muted-foreground">
                Required: {(expectedCols.required || []).map((c) => (
                  <Badge key={c} variant="default" className="mr-1 text-[10px]">{c}</Badge>
                ))}
              </div>
              <Button onClick={handleParse} disabled={!rawText.trim()}>
                <FileText className="mr-1 h-4 w-4" /> Parse & Preview
              </Button>
            </div>
          </div>
        )}

        {/* ── Preview Stage ───────────────────────────────── */}
        {stage === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm">
                <span className="font-medium">{records.length}</span> records parsed with{' '}
                <span className="font-medium">{columns.length}</span> columns
              </p>
              <Button variant="ghost" size="sm" onClick={reset}>
                Back
              </Button>
            </div>

            {/* Column mapping display */}
            <Card>
              <CardContent className="p-3">
                <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
                  Column Mapping
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {columns.map((col) => {
                    const status = getColumnStatus(col);
                    return (
                      <Badge
                        key={col}
                        variant={status === 'required' ? 'default' : status === 'optional' ? 'secondary' : 'outline'}
                        className="text-[10px]"
                      >
                        {col}
                        {status === 'required' && ' *'}
                        {status === 'unknown' && ' ?'}
                      </Badge>
                    );
                  })}
                </div>
                {columns.some((c) => getColumnStatus(c) === 'unknown') && (
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Columns marked with ? are not recognized and will be ignored.
                  </p>
                )}
                {(expectedCols.required || []).some((r) => !columns.includes(r)) && (
                  <p className="text-[10px] text-destructive mt-2">
                    Missing required columns:{' '}
                    {(expectedCols.required || []).filter((r) => !columns.includes(r)).join(', ')}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Data preview table (first 5 rows) */}
            <div className="border rounded-md overflow-auto max-h-[200px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 text-xs">#</TableHead>
                    {columns.slice(0, 8).map((col) => (
                      <TableHead key={col} className="text-xs whitespace-nowrap">
                        {col}
                      </TableHead>
                    ))}
                    {columns.length > 8 && (
                      <TableHead className="text-xs">+{columns.length - 8} more</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.slice(0, 5).map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                      {columns.slice(0, 8).map((col) => (
                        <TableCell key={col} className="text-xs truncate max-w-[120px]">
                          {String(row[col] ?? '')}
                        </TableCell>
                      ))}
                      {columns.length > 8 && <TableCell className="text-xs">...</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {records.length > 5 && (
              <p className="text-xs text-muted-foreground text-center">
                Showing 5 of {records.length} records
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset}>
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={(expectedCols.required || []).some((r) => !columns.includes(r))}
              >
                <Upload className="mr-1 h-4 w-4" /> Import {records.length} Records
              </Button>
            </div>
          </div>
        )}

        {/* ── Importing Stage ─────────────────────────────── */}
        {stage === 'importing' && (
          <div className="space-y-4 py-8">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Importing {entityType}...</p>
              <p className="text-xs text-muted-foreground">
                Processing {records.length} records. This may take a moment.
              </p>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* ── Results Stage ───────────────────────────────── */}
        {stage === 'results' && importResult && (
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <div>
                    <p className="text-lg font-bold text-success">{importResult.imported}</p>
                    <p className="text-[10px] text-muted-foreground">Imported</p>
                  </div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-warning" />
                  <div>
                    <p className="text-lg font-bold text-warning">{importResult.skipped}</p>
                    <p className="text-[10px] text-muted-foreground">Skipped (duplicates)</p>
                  </div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="text-lg font-bold text-destructive">{importResult.errors.length}</p>
                    <p className="text-[10px] text-muted-foreground">Errors</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Errors table */}
            {importResult.errors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-destructive">
                    Errors ({importResult.errors.length})
                  </p>
                  <Button variant="outline" size="sm" onClick={downloadErrorReport}>
                    <Download className="mr-1 h-3 w-3" /> Download Error Report
                  </Button>
                </div>
                <div className="border rounded-md overflow-auto max-h-[200px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14 text-xs">Row</TableHead>
                        <TableHead className="text-xs">Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(importResult.errors || []).slice(0, 20).map((err, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-xs font-mono">{err.row}</TableCell>
                          <TableCell className="text-xs text-destructive">{err.reason}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {(importResult.errors || []).length > 20 && (
                  <p className="text-xs text-muted-foreground text-center">
                    Showing 20 of {(importResult.errors || []).length} errors. Download the full report.
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { reset(); handleOpenChange(false); }}>
                Close
              </Button>
              <Button variant="outline" onClick={reset}>
                Import More
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
