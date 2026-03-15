import React, { useState } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  device: { id: string; name: string } | null;
  onDeleted?: () => void;
}

export default function DeleteDeviceDialog({ open, onOpenChange, device, onDeleted }: Props) {
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleDelete = async () => {
    if (!device) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('devices').delete().eq('id', device.id);
      if (error) throw error;
      toast({ title: 'Device deleted', description: `${device.name} has been removed.` });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      onOpenChange(false);
      onDeleted?.();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Device</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{device?.name}</strong>? This action cannot be undone. All associated events will retain their references but the device record will be permanently removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {deleting ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
