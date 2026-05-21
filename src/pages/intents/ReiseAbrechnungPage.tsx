import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { BudgetTracker } from '@/components/BudgetTracker';
import { BudgetpostenDialog } from '@/components/dialogs/BudgetpostenDialog';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS } from '@/types/app';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import type { Reiseplanung, Ausgabenkategorien, Budgetposten } from '@/types/app';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  IconPlane,
  IconPlus,
  IconDeviceFloppy,
  IconReceipt,
  IconChartBar,
  IconCircleCheck,
  IconAlertTriangle,
  IconPencil,
  IconArrowRight,
  IconHome,
} from '@tabler/icons-react';

const WIZARD_STEPS = [
  { label: 'Reise auswählen' },
  { label: 'Ausgaben erfassen' },
  { label: 'Belegkontrolle' },
  { label: 'Abschlussübersicht' },
];

interface PostenEdit {
  tatsaechlicher_betrag: number | undefined;
  bereits_bezahlt: boolean;
  beleg_vorhanden: boolean;
  dirty: boolean;
}

export default function ReiseAbrechnungPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const { reiseplanung, ausgabenkategorien, budgetposten, loading, error, fetchAll } = useDashboardData();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [selectedReiseId, setSelectedReiseId] = useState<string | null>(null);

  // Dialog state
  const [newPostenDialogOpen, setNewPostenDialogOpen] = useState(false);
  const [editPosten, setEditPosten] = useState<Budgetposten | null>(null);

  // Inline edits for Step 2
  const [postenEdits, setPostenEdits] = useState<Record<string, PostenEdit>>({});

  // Saving state
  const [saving, setSaving] = useState(false);

  // Step 3: track inline beleg changes being saved
  const [savingBelegId, setSavingBelegId] = useState<string | null>(null);

  // Deep-link: read ?reiseId= and ?step= on mount
  useEffect(() => {
    const reiseIdParam = searchParams.get('reiseId');
    const stepParam = parseInt(searchParams.get('step') ?? '', 10);

    if (reiseIdParam) {
      setSelectedReiseId(reiseIdParam);
      if (stepParam >= 2 && stepParam <= 4) {
        setCurrentStep(stepParam);
      } else {
        setCurrentStep(2);
      }
    } else if (stepParam >= 1 && stepParam <= 4) {
      setCurrentStep(stepParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync step + reiseId to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (currentStep > 1) {
      params.set('step', String(currentStep));
    } else {
      params.delete('step');
    }
    if (selectedReiseId) {
      params.set('reiseId', selectedReiseId);
    } else {
      params.delete('reiseId');
    }
    // Only update if params actually changed
    const current = searchParams.toString();
    const next = params.toString();
    if (current !== next) {
      navigate({ search: params.toString() }, { replace: true });
    }
  }, [currentStep, selectedReiseId, searchParams, navigate]);

  // Selected trip record
  const selectedReise: Reiseplanung | undefined = useMemo(
    () => reiseplanung.find(r => r.record_id === selectedReiseId),
    [reiseplanung, selectedReiseId]
  );

  // Budgetposten for selected trip
  const tripPosten: Budgetposten[] = useMemo(() => {
    if (!selectedReiseId) return [];
    return budgetposten.filter(p => extractRecordId(p.fields.reise) === selectedReiseId);
  }, [budgetposten, selectedReiseId]);

  // Kategorie map by record_id
  const kategorieMap = useMemo(() => {
    const m = new Map<string, Ausgabenkategorien>();
    ausgabenkategorien.forEach(k => m.set(k.record_id, k));
    return m;
  }, [ausgabenkategorien]);

  // Group posten by kategorie
  const groupedPosten = useMemo(() => {
    const groups = new Map<string, { kategorie: Ausgabenkategorien | null; posten: Budgetposten[] }>();
    const noKategorie: Budgetposten[] = [];

    tripPosten.forEach(p => {
      const katId = extractRecordId(p.fields.kategorie);
      if (katId) {
        if (!groups.has(katId)) {
          groups.set(katId, { kategorie: kategorieMap.get(katId) ?? null, posten: [] });
        }
        groups.get(katId)!.posten.push(p);
      } else {
        noKategorie.push(p);
      }
    });

    const result: { katId: string; kategorie: Ausgabenkategorien | null; posten: Budgetposten[] }[] = [];
    groups.forEach((val, katId) => result.push({ katId, ...val }));
    if (noKategorie.length > 0) {
      result.push({ katId: '__none__', kategorie: null, posten: noKategorie });
    }
    return result;
  }, [tripPosten, kategorieMap]);

  // Initialize postenEdits when tripPosten changes (only for new posten)
  useEffect(() => {
    setPostenEdits(prev => {
      const next: Record<string, PostenEdit> = { ...prev };
      tripPosten.forEach(p => {
        if (!next[p.record_id]) {
          next[p.record_id] = {
            tatsaechlicher_betrag: p.fields.tatsaechlicher_betrag,
            bereits_bezahlt: p.fields.bereits_bezahlt ?? false,
            beleg_vorhanden: p.fields.beleg_vorhanden ?? false,
            dirty: false,
          };
        }
      });
      // Remove edits for posten no longer in trip
      const ids = new Set(tripPosten.map(p => p.record_id));
      Object.keys(next).forEach(id => { if (!ids.has(id)) delete next[id]; });
      return next;
    });
  }, [tripPosten]);

  // Running total from edits
  const totalActual = useMemo(() => {
    return tripPosten.reduce((sum, p) => {
      const edit = postenEdits[p.record_id];
      const val = edit ? (edit.tatsaechlicher_betrag ?? 0) : (p.fields.tatsaechlicher_betrag ?? 0);
      return sum + val;
    }, 0);
  }, [tripPosten, postenEdits]);

  const totalPlanned = useMemo(() => {
    return tripPosten.reduce((sum, p) => sum + (p.fields.geplanter_betrag ?? 0), 0);
  }, [tripPosten]);

  // Step 3: missing belege
  const missingBelege = useMemo(() => {
    return tripPosten.filter(p => {
      const edit = postenEdits[p.record_id];
      return edit ? !edit.beleg_vorhanden : !p.fields.beleg_vorhanden;
    });
  }, [tripPosten, postenEdits]);

  const totalBelege = tripPosten.length;
  const vorhanden = totalBelege - missingBelege.length;

  // Handle trip selection
  function handleSelectReise(id: string) {
    setSelectedReiseId(id);
    setPostenEdits({});
    setCurrentStep(2);
  }

  // Handle inline edit changes
  function handleEditChange(postenId: string, field: keyof PostenEdit, value: number | boolean | undefined) {
    setPostenEdits(prev => ({
      ...prev,
      [postenId]: {
        ...prev[postenId],
        [field]: value,
        dirty: true,
      },
    }));
  }

  // Save all dirty posten
  const handleSaveAll = useCallback(async () => {
    setSaving(true);
    try {
      const dirty = tripPosten.filter(p => postenEdits[p.record_id]?.dirty);
      await Promise.all(dirty.map(p => {
        const edit = postenEdits[p.record_id];
        return LivingAppsService.updateBudgetpostenEntry(p.record_id, {
          tatsaechlicher_betrag: edit.tatsaechlicher_betrag,
          bereits_bezahlt: edit.bereits_bezahlt,
          beleg_vorhanden: edit.beleg_vorhanden,
        });
      }));
      await fetchAll();
      // Mark all as clean
      setPostenEdits(prev => {
        const next: Record<string, PostenEdit> = {};
        Object.entries(prev).forEach(([id, e]) => { next[id] = { ...e, dirty: false }; });
        return next;
      });
      setCurrentStep(3);
    } finally {
      setSaving(false);
    }
  }, [tripPosten, postenEdits, fetchAll]);

  // Save beleg_vorhanden inline in Step 3
  async function handleBelegToggle(postenId: string, checked: boolean) {
    setSavingBelegId(postenId);
    try {
      await LivingAppsService.updateBudgetpostenEntry(postenId, { beleg_vorhanden: checked });
      setPostenEdits(prev => ({
        ...prev,
        [postenId]: { ...prev[postenId], beleg_vorhanden: checked, dirty: false },
      }));
      await fetchAll();
    } finally {
      setSavingBelegId(null);
    }
  }

  // Per-category summary for Step 4
  const categorySummary = useMemo(() => {
    return groupedPosten.map(group => {
      const geplant = group.posten.reduce((s, p) => s + (p.fields.geplanter_betrag ?? 0), 0);
      const tatsaechlich = group.posten.reduce((s, p) => {
        const edit = postenEdits[p.record_id];
        return s + (edit ? (edit.tatsaechlicher_betrag ?? 0) : (p.fields.tatsaechlicher_betrag ?? 0));
      }, 0);
      const bezahltCount = group.posten.filter(p => {
        const edit = postenEdits[p.record_id];
        return edit ? edit.bereits_bezahlt : p.fields.bereits_bezahlt;
      }).length;
      return {
        katId: group.katId,
        name: group.kategorie?.fields.kategoriename ?? 'Ohne Kategorie',
        geplant,
        tatsaechlich,
        differenz: tatsaechlich - geplant,
        bezahltCount,
        total: group.posten.length,
      };
    });
  }, [groupedPosten, postenEdits]);

  // Trip header component (used in steps 2, 3, 4)
  function TripHeader() {
    if (!selectedReise) return null;
    const f = selectedReise.fields;
    const waehrung = typeof f.waehrung === 'object' && f.waehrung ? f.waehrung.label : (f.waehrung ?? '');
    return (
      <div className="rounded-xl border bg-card p-4 flex flex-wrap gap-3 items-start overflow-hidden">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <IconPlane size={20} className="text-primary" stroke={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-base truncate">{f.reiseziel ?? '—'}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatDate(f.startdatum)} – {formatDate(f.enddatum)}
            {f.anzahl_reisende ? ` · ${f.anzahl_reisende} Reisende` : ''}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold">{f.gesamtbudget != null ? `${formatCurrency(f.gesamtbudget)}` : '—'}</p>
          {waehrung && <p className="text-xs text-muted-foreground">{waehrung}</p>}
        </div>
      </div>
    );
  }

  // Step 2 content
  function Step2Content() {
    return (
      <div className="space-y-5">
        <TripHeader />

        {/* Running total */}
        <BudgetTracker
          budget={selectedReise?.fields.gesamtbudget ?? 0}
          booked={totalActual}
          label="Gesamtausgaben (tatsächlich)"
        />

        {/* Posten grouped by kategorie */}
        <div className="space-y-4">
          {groupedPosten.length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-sm">
              Noch keine Budgetposten vorhanden. Erstelle deinen ersten Posten.
            </div>
          )}
          {groupedPosten.map(group => (
            <div key={group.katId} className="rounded-xl border overflow-hidden">
              <div className="px-4 py-2.5 bg-muted/50 border-b">
                <span className="text-sm font-semibold">
                  {group.kategorie?.fields.kategoriename ?? 'Ohne Kategorie'}
                </span>
              </div>
              <div className="divide-y">
                {group.posten.map(p => {
                  const edit = postenEdits[p.record_id] ?? {
                    tatsaechlicher_betrag: p.fields.tatsaechlicher_betrag,
                    bereits_bezahlt: p.fields.bereits_bezahlt ?? false,
                    beleg_vorhanden: p.fields.beleg_vorhanden ?? false,
                    dirty: false,
                  };
                  return (
                    <div key={p.record_id} className="px-4 py-3 flex flex-wrap gap-3 items-center min-w-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.fields.bezeichnung ?? '—'}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Geplant: {formatCurrency(p.fields.geplanter_betrag)}
                        </p>
                      </div>
                      {/* Tatsächlicher Betrag inline input */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <label className="text-xs text-muted-foreground whitespace-nowrap">Tatsächlich:</label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          className="w-24 rounded-md border border-input bg-background px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/30"
                          value={edit.tatsaechlicher_betrag ?? ''}
                          onChange={e => handleEditChange(
                            p.record_id,
                            'tatsaechlicher_betrag',
                            e.target.value !== '' ? Number(e.target.value) : undefined
                          )}
                        />
                      </div>
                      {/* Bezahlt checkbox */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Checkbox
                          id={`bezahlt-${p.record_id}`}
                          checked={edit.bereits_bezahlt}
                          onCheckedChange={v => handleEditChange(p.record_id, 'bereits_bezahlt', !!v)}
                        />
                        <label htmlFor={`bezahlt-${p.record_id}`} className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                          Bezahlt
                        </label>
                      </div>
                      {/* Beleg checkbox */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Checkbox
                          id={`beleg-${p.record_id}`}
                          checked={edit.beleg_vorhanden}
                          onCheckedChange={v => handleEditChange(p.record_id, 'beleg_vorhanden', !!v)}
                        />
                        <label htmlFor={`beleg-${p.record_id}`} className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                          Beleg
                        </label>
                      </div>
                      {/* Edit button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 h-8 w-8 p-0"
                        onClick={() => setEditPosten(p)}
                        title="Posten bearbeiten"
                      >
                        <IconPencil size={14} stroke={1.5} />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 pt-2">
          <Button
            variant="outline"
            onClick={() => setNewPostenDialogOpen(true)}
            className="gap-1.5"
          >
            <IconPlus size={15} stroke={1.5} />
            Neuer Posten
          </Button>
          <Button
            onClick={handleSaveAll}
            disabled={saving}
            className="gap-1.5 ml-auto"
          >
            <IconDeviceFloppy size={15} stroke={1.5} />
            {saving ? 'Speichern...' : 'Alle speichern & weiter'}
            {!saving && <IconArrowRight size={15} stroke={1.5} />}
          </Button>
        </div>
      </div>
    );
  }

  // Step 3 content
  function Step3Content() {
    const allComplete = missingBelege.length === 0;
    return (
      <div className="space-y-5">
        <TripHeader />

        {/* Counter */}
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${allComplete ? 'bg-green-100' : 'bg-amber-100'}`}>
              <IconReceipt size={20} stroke={1.5} className={allComplete ? 'text-green-600' : 'text-amber-600'} />
            </div>
            <div>
              <p className="text-sm font-semibold">
                {vorhanden} von {totalBelege} Belegen vorhanden
              </p>
              <p className="text-xs text-muted-foreground">
                {allComplete ? 'Alle Belege vollständig!' : `${missingBelege.length} fehlende Belege`}
              </p>
            </div>
          </div>
        </div>

        {allComplete ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center space-y-2">
            <IconCircleCheck size={36} className="text-green-500 mx-auto" stroke={1.5} />
            <p className="font-semibold text-green-800">Alle Belege vollständig!</p>
            <p className="text-sm text-green-700">Du hast alle Belege erfasst. Super!</p>
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/50 border-b">
              <span className="text-sm font-semibold">Fehlende Belege</span>
            </div>
            <div className="divide-y">
              {missingBelege.map(p => {
                const katId = extractRecordId(p.fields.kategorie);
                const kat = katId ? kategorieMap.get(katId) : null;
                const edit = postenEdits[p.record_id];
                const currentBeleg = edit ? edit.beleg_vorhanden : (p.fields.beleg_vorhanden ?? false);
                const isSaving = savingBelegId === p.record_id;
                return (
                  <div key={p.record_id} className="px-4 py-3 flex flex-wrap gap-3 items-center min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                      <IconAlertTriangle size={14} stroke={1.5} className="text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.fields.bezeichnung ?? '—'}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {kat?.fields.kategoriename ?? 'Ohne Kategorie'} · {formatCurrency(
                          edit?.tatsaechlicher_betrag ?? p.fields.tatsaechlicher_betrag
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Checkbox
                        id={`beleg3-${p.record_id}`}
                        checked={currentBeleg}
                        disabled={isSaving}
                        onCheckedChange={v => handleBelegToggle(p.record_id, !!v)}
                      />
                      <label htmlFor={`beleg3-${p.record_id}`} className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                        {isSaving ? 'Speichert...' : 'Beleg vorhanden'}
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between flex-wrap gap-3 pt-2">
          <Button variant="outline" onClick={() => setCurrentStep(2)}>
            Zurück
          </Button>
          <Button onClick={() => setCurrentStep(4)} className="gap-1.5">
            Weiter zur Abschlussübersicht
            <IconArrowRight size={15} stroke={1.5} />
          </Button>
        </div>
      </div>
    );
  }

  // Step 4 content
  function Step4Content() {
    const totalDiff = totalActual - totalPlanned;
    return (
      <div className="space-y-5">
        <TripHeader />

        {/* Budget Tracker */}
        <BudgetTracker
          budget={selectedReise?.fields.gesamtbudget ?? 0}
          booked={totalActual}
          label="Gesamtbudget"
        />

        {/* Per-category table */}
        <div className="rounded-xl border overflow-hidden">
          <div className="px-4 py-2.5 bg-muted/50 border-b">
            <span className="text-sm font-semibold flex items-center gap-2">
              <IconChartBar size={15} stroke={1.5} />
              Kategorienübersicht
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Kategorie</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Geplant</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Tatsächlich</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Differenz</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Bezahlt</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {categorySummary.map(cat => (
                  <tr key={cat.katId} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium truncate max-w-[140px]">{cat.name}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap">
                      {formatCurrency(cat.geplant)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap font-medium">
                      {formatCurrency(cat.tatsaechlich)}
                    </td>
                    <td className={`px-4 py-3 text-right whitespace-nowrap font-semibold ${
                      cat.differenz > 0 ? 'text-red-600' : cat.differenz < 0 ? 'text-green-600' : 'text-muted-foreground'
                    }`}>
                      {cat.differenz > 0 ? '+' : ''}{formatCurrency(cat.differenz)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-muted-foreground">
                      {cat.bezahltCount}/{cat.total}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/30 font-semibold">
                  <td className="px-4 py-3">Gesamt</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{formatCurrency(totalPlanned)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{formatCurrency(totalActual)}</td>
                  <td className={`px-4 py-3 text-right whitespace-nowrap ${
                    totalDiff > 0 ? 'text-red-600' : totalDiff < 0 ? 'text-green-600' : 'text-muted-foreground'
                  }`}>
                    {totalDiff > 0 ? '+' : ''}{formatCurrency(totalDiff)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap text-muted-foreground">
                    {tripPosten.filter(p => postenEdits[p.record_id]?.bereits_bezahlt ?? p.fields.bereits_bezahlt).length}/{tripPosten.length}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Total summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Geplant gesamt</p>
            <p className="text-lg font-bold">{formatCurrency(totalPlanned)}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Tatsächlich gesamt</p>
            <p className="text-lg font-bold">{formatCurrency(totalActual)}</p>
          </div>
          <div className={`rounded-xl border p-4 ${totalDiff > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            <p className={`text-xs mb-1 ${totalDiff > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {totalDiff > 0 ? 'Überbudget' : 'Einsparung'}
            </p>
            <p className={`text-lg font-bold ${totalDiff > 0 ? 'text-red-700' : 'text-green-700'}`}>
              {totalDiff > 0 ? '+' : ''}{formatCurrency(Math.abs(totalDiff))}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between flex-wrap gap-3 pt-2">
          <Button variant="outline" onClick={() => setCurrentStep(3)}>
            Zurück
          </Button>
          <Button
            onClick={() => navigate('/')}
            className="gap-1.5"
          >
            <IconHome size={15} stroke={1.5} />
            Abrechnung abschließen
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <IntentWizardShell
        title="Reise abrechnen"
        subtitle="Erfasse Ausgaben, prüfe Belege und schließe deine Reise ab."
        steps={WIZARD_STEPS}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        loading={loading}
        error={error}
        onRetry={fetchAll}
      >
        {/* Step 1: Reise auswählen */}
        {currentStep === 1 && (
          <EntitySelectStep
            items={reiseplanung.map(r => ({
              id: r.record_id,
              title: r.fields.reiseziel ?? 'Unbenannte Reise',
              subtitle: `${formatDate(r.fields.startdatum)} – ${formatDate(r.fields.enddatum)}`,
              icon: <IconPlane size={18} stroke={1.5} className="text-primary" />,
              stats: [
                {
                  label: 'Budget',
                  value: r.fields.gesamtbudget != null
                    ? `${formatCurrency(r.fields.gesamtbudget)}${r.fields.waehrung && typeof r.fields.waehrung === 'object' ? ' ' + r.fields.waehrung.label : ''}`
                    : '—',
                },
                {
                  label: 'Reisende',
                  value: r.fields.anzahl_reisende ?? '—',
                },
              ],
            }))}
            onSelect={handleSelectReise}
            searchPlaceholder="Reise suchen..."
            emptyIcon={<IconPlane size={32} stroke={1.5} />}
            emptyText="Keine Reisen gefunden."
          />
        )}

        {/* Step 2: Ausgaben erfassen */}
        {currentStep === 2 && <Step2Content />}

        {/* Step 3: Belegkontrolle */}
        {currentStep === 3 && <Step3Content />}

        {/* Step 4: Abschlussübersicht */}
        {currentStep === 4 && <Step4Content />}
      </IntentWizardShell>

      {/* New Posten Dialog */}
      <BudgetpostenDialog
        open={newPostenDialogOpen}
        onClose={() => setNewPostenDialogOpen(false)}
        onSubmit={async fields => {
          await LivingAppsService.createBudgetpostenEntry(fields);
          await fetchAll();
        }}
        defaultValues={selectedReiseId ? {
          reise: createRecordUrl(APP_IDS.REISEPLANUNG, selectedReiseId),
        } : undefined}
        reiseplanungList={reiseplanung}
        ausgabenkategorienList={ausgabenkategorien}
        enablePhotoScan={AI_PHOTO_SCAN['Budgetposten']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Budgetposten']}
      />

      {/* Edit Posten Dialog */}
      <BudgetpostenDialog
        open={!!editPosten}
        onClose={() => setEditPosten(null)}
        onSubmit={async fields => {
          if (!editPosten) return;
          await LivingAppsService.updateBudgetpostenEntry(editPosten.record_id, fields);
          await fetchAll();
          // Reset edit state for this posten so it reloads fresh
          setPostenEdits(prev => {
            const next = { ...prev };
            delete next[editPosten.record_id];
            return next;
          });
        }}
        defaultValues={editPosten?.fields}
        reiseplanungList={reiseplanung}
        ausgabenkategorienList={ausgabenkategorien}
        enablePhotoScan={AI_PHOTO_SCAN['Budgetposten']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Budgetposten']}
      />
    </>
  );
}
