import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useDevices } from '@/hooks/use-api-data';
import { evidenceApi, type EvidenceRecord } from '@/services/evidence-api';
import { toast } from 'sonner';
import {
  Camera,
  FileUp,
  StickyNote,
  Trash2,
  Image as ImageIcon,
  Video,
  FileText,
  Loader2,
  X,
  Clock,
  Monitor,
  Download,
  Eye,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────

interface EvidencePanelProps {
  incidentId: string;
  incidentStatus?: string;
}

const typeIcons: Record<string, React.ElementType> = {
  snapshot: ImageIcon,
  clip: Video,
  document: FileText,
  note: StickyNote,
};

const typeColors: Record<string, string> = {
  snapshot: 'bg-primary/10 text-primary border-primary/20',
  clip: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  document: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  note: 'bg-success/10 text-success border-success/20',
};

// ── Component ────────────────────────────────────────────────

export default function EvidencePanel({ incidentId, incidentStatus }: EvidencePanelProps) {
  const queryClient = useQueryClient();
  const { data: devices = [] } = useDevices();

  const [captureOpen, setCaptureOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceRecord | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Capture snapshot form state
  const [captureDeviceId, setCaptureDeviceId] = useState('');
  const [captureDescription, setCaptureDescription] = useState('');

  // Note form state
  const [noteContent, setNoteContent] = useState('');

  const isClosed = incidentStatus === 'closed' || incidentStatus === 'resolved';

  // ── Data Fetching ──────────────────────────────────────────

  const {
    data: evidenceList = [],
    isLoading,
  } = useQuery({
    queryKey: ['evidence', incidentId],
    queryFn: async () => {
      const response = await evidenceApi.list(incidentId);
      return response.data ?? [];
    },
    enabled: !!incidentId,
  });

  // ── Handlers ───────────────────────────────────────────────

  const handleCaptureSnapshot = async () => {
    if (!captureDeviceId) {
      toast.error('Please select a device');
      return;
    }
    setActionLoading('capture');
    try {
      await evidenceApi.captureSnapshot(incidentId, captureDeviceId, captureDescription || undefined);
      toast.success('Snapshot captured successfully');
      setCaptureOpen(false);
      setCaptureDeviceId('');
      setCaptureDescription('');
      queryClient.invalidateQueries({ queryKey: ['evidence', incidentId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to capture snapshot');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddNote = async () => {
    if (!noteContent.trim()) {
      toast.error('Note content is required');
      return;
    }
    setActionLoading('note');
    try {
      await evidenceApi.create({
        incident_id: incidentId,
        type: 'note',
        description: noteContent,
      });
      toast.success('Note added to evidence');
      setNoteOpen(false);
      setNoteContent('');
      queryClient.invalidateQueries({ queryKey: ['evidence', incidentId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add note');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (evidenceId: string) => {
    setActionLoading(`delete-${evidenceId}`);
    try {
      await evidenceApi.delete(evidenceId);
      toast.success('Evidence deleted');
      if (selectedEvidence?.id === evidenceId) {
        setDetailOpen(false);
        setSelectedEvidence(null);
      }
      queryClient.invalidateQueries({ queryKey: ['evidence', incidentId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete evidence');
    } finally {
      setActionLoading(null);
    }
  };

  const openDetail = (item: EvidenceRecord) => {
    setSelectedEvidence(item);
    setDetailOpen(true);
  };

  const getDeviceName = (deviceId: string | null) => {
    if (!deviceId) return null;
    const device = devices.find((d: any) => d.id === deviceId);
    return device?.name ?? 'Unknown Device';
  };

  // Only camera-type devices can capture snapshots
  const cameraDevices = devices.filter((d: any) => d.type === 'camera' || d.type === 'nvr');

  // ── Render ─────────────────────────────────────────────────

  return (
    <Card>
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="text-sm font-semibold">Evidence ({evidenceList.length})</h3>
        {!isClosed && (
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" onClick={() => setCaptureOpen(true)}>
              <Camera className="mr-1 h-3 w-3" /> Snapshot
            </Button>
            <Button variant="outline" size="sm" onClick={() => setNoteOpen(true)}>
              <StickyNote className="mr-1 h-3 w-3" /> Note
            </Button>
          </div>
        )}
      </div>

      <CardContent className="p-4">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-video rounded-md" />
            ))}
          </div>
        ) : evidenceList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <FileText className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">No evidence attached</p>
            <p className="text-xs mt-1">Capture snapshots or add notes to build the evidence chain</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {evidenceList.map((item) => {
              const TypeIcon = typeIcons[item.type] || FileText;
              return (
                <button
                  key={item.id}
                  onClick={() => openDetail(item)}
                  className="group relative aspect-video rounded-md border bg-muted/30 hover:bg-muted/50 transition-colors overflow-hidden text-left"
                >
                  {/* Thumbnail or type icon */}
                  {item.thumbnail_url && item.type !== 'note' ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
                      <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <TypeIcon className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                  )}

                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>

                  {/* Badge */}
                  <div className="absolute top-1.5 left-1.5">
                    <Badge
                      variant="outline"
                      className={cn('text-[9px] capitalize', typeColors[item.type])}
                    >
                      {item.type}
                    </Badge>
                  </div>

                  {/* Bottom info */}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                    <p className="text-[10px] text-white truncate">
                      {item.description || item.file_name || item.type}
                    </p>
                    <p className="text-[9px] text-white/70">
                      {new Date(item.created_at).toLocaleString()}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* ── Capture Snapshot Dialog ───────────────────────────── */}
      <Dialog open={captureOpen} onOpenChange={setCaptureOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-4 w-4" /> Capture Snapshot
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Device</Label>
              <Select value={captureDeviceId} onValueChange={setCaptureDeviceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a camera..." />
                </SelectTrigger>
                <SelectContent>
                  {cameraDevices.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>
                      <span className="flex items-center gap-2">
                        <Monitor className="h-3 w-3" /> {d.name}
                        {d.site_name && (
                          <span className="text-muted-foreground text-xs">({d.site_name})</span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                value={captureDescription}
                onChange={(e) => setCaptureDescription(e.target.value)}
                placeholder="What does this snapshot capture?"
                className="min-h-[60px]"
              />
            </div>
            <Button
              className="w-full"
              onClick={handleCaptureSnapshot}
              disabled={actionLoading === 'capture' || !captureDeviceId}
            >
              {actionLoading === 'capture' ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Camera className="mr-1 h-4 w-4" />
              )}
              Capture Snapshot
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add Note Dialog ───────────────────────────────────── */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="h-4 w-4" /> Add Evidence Note
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Note Content</Label>
              <Textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Describe the observation, findings, or relevant details..."
                className="min-h-[100px]"
              />
            </div>
            <Button
              className="w-full"
              onClick={handleAddNote}
              disabled={actionLoading === 'note' || !noteContent.trim()}
            >
              {actionLoading === 'note' ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-1 h-4 w-4" />
              )}
              Add Note
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Evidence Detail Dialog ────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          {selectedEvidence && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {React.createElement(typeIcons[selectedEvidence.type] || FileText, { className: 'h-4 w-4' })}
                  Evidence Detail
                  <Badge
                    variant="outline"
                    className={cn('ml-2 capitalize text-xs', typeColors[selectedEvidence.type])}
                  >
                    {selectedEvidence.type}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Preview area */}
                {selectedEvidence.type === 'snapshot' && selectedEvidence.file_url && (
                  <div className="aspect-video bg-muted rounded-md flex items-center justify-center border">
                    <div className="text-center text-muted-foreground">
                      <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-40" />
                      <p className="text-xs">Snapshot preview</p>
                      <p className="text-[10px] mt-1 font-mono">{selectedEvidence.file_url}</p>
                    </div>
                  </div>
                )}

                {selectedEvidence.type === 'clip' && selectedEvidence.file_url && (
                  <div className="aspect-video bg-muted rounded-md flex items-center justify-center border">
                    <div className="text-center text-muted-foreground">
                      <Video className="h-12 w-12 mx-auto mb-2 opacity-40" />
                      <p className="text-xs">Video clip</p>
                      <p className="text-[10px] mt-1 font-mono">{selectedEvidence.file_url}</p>
                    </div>
                  </div>
                )}

                {selectedEvidence.type === 'note' && (
                  <div className="bg-muted/30 rounded-md p-4 border">
                    <p className="text-sm whitespace-pre-wrap">{selectedEvidence.description}</p>
                  </div>
                )}

                {selectedEvidence.type === 'document' && (
                  <div className="bg-muted/30 rounded-md p-4 border flex items-center gap-3">
                    <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {selectedEvidence.file_name || 'Document'}
                      </p>
                      {selectedEvidence.mime_type && (
                        <p className="text-xs text-muted-foreground">{selectedEvidence.mime_type}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Metadata grid */}
                <div className="grid grid-cols-2 gap-3">
                  {selectedEvidence.description && selectedEvidence.type !== 'note' && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground mb-0.5">Description</p>
                      <p className="text-sm">{selectedEvidence.description}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Created</p>
                    <p className="text-sm flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(selectedEvidence.created_at).toLocaleString()}
                    </p>
                  </div>
                  {selectedEvidence.captured_at && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Captured</p>
                      <p className="text-sm flex items-center gap-1">
                        <Camera className="h-3 w-3" />
                        {new Date(selectedEvidence.captured_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                  {selectedEvidence.device_id && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Device</p>
                      <p className="text-sm flex items-center gap-1">
                        <Monitor className="h-3 w-3" />
                        {getDeviceName(selectedEvidence.device_id)}
                      </p>
                    </div>
                  )}
                  {selectedEvidence.file_name && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">File</p>
                      <p className="text-sm truncate">{selectedEvidence.file_name}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t">
                  {selectedEvidence.file_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={selectedEvidence.file_url} target="_blank" rel="noopener noreferrer">
                        <Download className="mr-1 h-3 w-3" /> Download
                      </a>
                    </Button>
                  )}
                  {!selectedEvidence.file_url && <div />}

                  {!isClosed && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={actionLoading === `delete-${selectedEvidence.id}`}
                        >
                          {actionLoading === `delete-${selectedEvidence.id}` ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="mr-1 h-3 w-3" />
                          )}
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Evidence</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this evidence record
                            {selectedEvidence.file_url ? ' and its associated file' : ''}.
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(selectedEvidence.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
