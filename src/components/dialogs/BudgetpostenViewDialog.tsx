import type { Budgetposten, Reiseplanung, Ausgabenkategorien } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { IconPencil, IconFileText } from '@tabler/icons-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

function formatDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd.MM.yyyy', { locale: de }); } catch { return d; }
}

interface BudgetpostenViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Budgetposten | null;
  onEdit: (record: Budgetposten) => void;
  reiseplanungList: Reiseplanung[];
  ausgabenkategorienList: Ausgabenkategorien[];
}

export function BudgetpostenViewDialog({ open, onClose, record, onEdit, reiseplanungList, ausgabenkategorienList }: BudgetpostenViewDialogProps) {
  function getReiseplanungDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return reiseplanungList.find(r => r.record_id === id)?.fields.reiseziel ?? '—';
  }

  function getAusgabenkategorienDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return ausgabenkategorienList.find(r => r.record_id === id)?.fields.kategoriename ?? '—';
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Budgetposten anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Reise</Label>
            <p className="text-sm">{getReiseplanungDisplayName(record.fields.reise)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Ausgabenkategorie</Label>
            <p className="text-sm">{getAusgabenkategorienDisplayName(record.fields.kategorie)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Bezeichnung</Label>
            <p className="text-sm">{record.fields.bezeichnung ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Geplanter Betrag (€)</Label>
            <p className="text-sm">{record.fields.geplanter_betrag ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tatsächlicher Betrag (€)</Label>
            <p className="text-sm">{record.fields.tatsaechlicher_betrag ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Datum der Ausgabe</Label>
            <p className="text-sm">{formatDate(record.fields.ausgabendatum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Zahlungsart</Label>
            <Badge variant="secondary">{record.fields.zahlungsart?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Bereits bezahlt</Label>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              record.fields.bereits_bezahlt ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              {record.fields.bereits_bezahlt ? 'Ja' : 'Nein'}
            </span>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Beleg vorhanden</Label>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              record.fields.beleg_vorhanden ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              {record.fields.beleg_vorhanden ? 'Ja' : 'Nein'}
            </span>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Beleg hochladen</Label>
            {record.fields.beleg_datei ? (
              <div className="relative w-full rounded-lg bg-muted overflow-hidden border">
                <img src={record.fields.beleg_datei} alt="" className="w-full h-auto object-contain" />
              </div>
            ) : <p className="text-sm text-muted-foreground">—</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Anmerkungen</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.anmerkungen ?? '—'}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}