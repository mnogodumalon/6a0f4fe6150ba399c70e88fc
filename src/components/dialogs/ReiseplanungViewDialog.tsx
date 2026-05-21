import type { Reiseplanung } from '@/types/app';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { IconPencil } from '@tabler/icons-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

function formatDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd.MM.yyyy', { locale: de }); } catch { return d; }
}

interface ReiseplanungViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Reiseplanung | null;
  onEdit: (record: Reiseplanung) => void;
}

export function ReiseplanungViewDialog({ open, onClose, record, onEdit }: ReiseplanungViewDialogProps) {
  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reiseplanung anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Reiseziel</Label>
            <p className="text-sm">{record.fields.reiseziel ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Reisebeschreibung</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.reisebeschreibung ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Abreisedatum</Label>
            <p className="text-sm">{formatDate(record.fields.startdatum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Rückreisedatum</Label>
            <p className="text-sm">{formatDate(record.fields.enddatum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Anzahl der Reisenden</Label>
            <p className="text-sm">{record.fields.anzahl_reisende ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Gesamtbudget (€)</Label>
            <p className="text-sm">{record.fields.gesamtbudget ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Währung</Label>
            <Badge variant="secondary">{record.fields.waehrung?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Notizen zur Reise</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.notizen ?? '—'}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}