import type { Ausgabenkategorien } from '@/types/app';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { IconPencil } from '@tabler/icons-react';

interface AusgabenkategorienViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Ausgabenkategorien | null;
  onEdit: (record: Ausgabenkategorien) => void;
}

export function AusgabenkategorienViewDialog({ open, onClose, record, onEdit }: AusgabenkategorienViewDialogProps) {
  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ausgabenkategorien anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Geplanter Budgetanteil (%)</Label>
            <p className="text-sm">{record.fields.budgetanteil ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Kategoriename</Label>
            <p className="text-sm">{record.fields.kategoriename ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Kategorie-Typ</Label>
            <Badge variant="secondary">{record.fields.kategorie_icon?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Beschreibung</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.kategorie_beschreibung ?? '—'}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}