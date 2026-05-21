import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDashboardData } from '@/hooks/useDashboardData';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { BudgetTracker } from '@/components/BudgetTracker';
import { ReiseplanungDialog } from '@/components/dialogs/ReiseplanungDialog';
import { AusgabenkategorienDialog } from '@/components/dialogs/AusgabenkategorienDialog';
import { BudgetpostenDialog } from '@/components/dialogs/BudgetpostenDialog';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS } from '@/types/app';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import type { Reiseplanung, Ausgabenkategorien, Budgetposten } from '@/types/app';
import { Button } from '@/components/ui/button';
import {
  IconPlus,
  IconMapPin,
  IconCalendar,
  IconUsers,
  IconWallet,
  IconTag,
  IconChevronRight,
  IconArrowRight,
  IconCheck,
  IconAlertTriangle,
} from '@tabler/icons-react';

const WIZARD_STEPS = [
  { label: 'Reise wählen' },
  { label: 'Kategorien' },
  { label: 'Posten planen' },
  { label: 'Zusammenfassung' },
];

const ICON_MAP: Record<string, string> = {
  transport: '✈️',
  verpflegung: '🍽️',
  aktivitaeten: '🎭',
  einkaufe: '🛍️',
  versicherung: '🛡️',
  kommunikation: '📱',
  gesundheit: '💊',
  unterkunft: '🏨',
  sonstiges: '📦',
};

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatAmount(amount: number, currency?: string): string {
  const sym = currency ?? '';
  return `${amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${sym}`.trim();
}

export default function ReisePlanenPage() {
  const [searchParams] = useSearchParams();
  const { reiseplanung, ausgabenkategorien, budgetposten, loading, error, fetchAll } = useDashboardData();

  // Deep-link: read initial step and reiseId from URL
  const initialReiseId = searchParams.get('reiseId') ?? null;
  const initialStep = (() => {
    const s = parseInt(searchParams.get('step') ?? '', 10);
    if (s >= 1 && s <= 4) return s;
    return initialReiseId ? 2 : 1;
  })();

  const [currentStep, setCurrentStep] = useState(initialStep);
  const [selectedReiseId, setSelectedReiseId] = useState<string | null>(initialReiseId);
  const [selectedKategorieId, setSelectedKategorieId] = useState<string | null>(null);

  // Dialog states
  const [reiseDialogOpen, setReiseDialogOpen] = useState(false);
  const [kategorieDialogOpen, setKategorieDialogOpen] = useState(false);
  const [postenDialogOpen, setPostenDialogOpen] = useState(false);

  // Auto-select newly created reise after dialog closes
  const [pendingSelectReise, setPendingSelectReise] = useState(false);

  useEffect(() => {
    if (pendingSelectReise && !reiseDialogOpen && reiseplanung.length > 0) {
      // Find the most recently created entry
      const sorted = [...reiseplanung].sort((a, b) =>
        new Date(b.createdat).getTime() - new Date(a.createdat).getTime()
      );
      if (sorted[0]) {
        setSelectedReiseId(sorted[0].record_id);
        setCurrentStep(2);
      }
      setPendingSelectReise(false);
    }
  }, [pendingSelectReise, reiseDialogOpen, reiseplanung]);

  const selectedReise: Reiseplanung | undefined = useMemo(
    () => reiseplanung.find(r => r.record_id === selectedReiseId),
    [reiseplanung, selectedReiseId]
  );

  // Budgetposten für die ausgewählte Reise
  const reisePosten: Budgetposten[] = useMemo(() => {
    if (!selectedReiseId) return [];
    return budgetposten.filter(p => {
      const id = extractRecordId(p.fields.reise);
      return id === selectedReiseId;
    });
  }, [budgetposten, selectedReiseId]);

  const totalGeplant: number = useMemo(
    () => reisePosten.reduce((sum, p) => sum + (p.fields.geplanter_betrag ?? 0), 0),
    [reisePosten]
  );

  // Posten für ausgewählte Kategorie in dieser Reise
  const kategoriePosten: Budgetposten[] = useMemo(() => {
    if (!selectedKategorieId || !selectedReiseId) return [];
    return reisePosten.filter(p => {
      const id = extractRecordId(p.fields.kategorie);
      return id === selectedKategorieId;
    });
  }, [reisePosten, selectedReiseId, selectedKategorieId]);

  const selectedKategorie: Ausgabenkategorien | undefined = useMemo(
    () => ausgabenkategorien.find(k => k.record_id === selectedKategorieId),
    [ausgabenkategorien, selectedKategorieId]
  );

  // Per-category planned amounts for selected trip
  const kategorieAmounts = useMemo(() => {
    const m = new Map<string, number>();
    reisePosten.forEach(p => {
      const id = extractRecordId(p.fields.kategorie);
      if (id) {
        m.set(id, (m.get(id) ?? 0) + (p.fields.geplanter_betrag ?? 0));
      }
    });
    return m;
  }, [reisePosten]);

  const currencyLabel = selectedReise?.fields.waehrung?.label ?? '';
  const gesamtbudget = selectedReise?.fields.gesamtbudget ?? 0;

  return (
    <IntentWizardShell
      title="Reise planen"
      subtitle="Plane deine Reise Schritt für Schritt — von der Auswahl bis zur Budgetübersicht."
      steps={WIZARD_STEPS}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── Step 1: Reise auswählen ─────────────────────────────────────── */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Welche Reise möchtest du planen?</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Wähle eine bestehende Reise aus oder erstelle eine neue.
            </p>
          </div>

          <EntitySelectStep
            items={reiseplanung.map(r => ({
              id: r.record_id,
              title: r.fields.reiseziel ?? '(Kein Reiseziel)',
              subtitle: r.fields.startdatum && r.fields.enddatum
                ? `${formatDate(r.fields.startdatum)} – ${formatDate(r.fields.enddatum)}`
                : r.fields.startdatum
                ? `Ab ${formatDate(r.fields.startdatum)}`
                : undefined,
              stats: [
                {
                  label: 'Budget',
                  value: r.fields.gesamtbudget != null
                    ? formatAmount(r.fields.gesamtbudget, r.fields.waehrung?.label)
                    : '—',
                },
                {
                  label: 'Reisende',
                  value: r.fields.anzahl_reisende ?? '—',
                },
              ],
              icon: <IconMapPin size={18} className="text-primary" stroke={1.8} />,
            }))}
            onSelect={(id) => {
              setSelectedReiseId(id);
              setCurrentStep(2);
            }}
            searchPlaceholder="Reiseziel suchen..."
            emptyIcon={<IconMapPin size={32} stroke={1.5} />}
            emptyText="Noch keine Reisen vorhanden. Erstelle deine erste Reise!"
            createLabel="Neue Reise erstellen"
            onCreateNew={() => setReiseDialogOpen(true)}
            createDialog={
              <ReiseplanungDialog
                open={reiseDialogOpen}
                onClose={() => setReiseDialogOpen(false)}
                onSubmit={async (fields) => {
                  await LivingAppsService.createReiseplanungEntry(fields);
                  setPendingSelectReise(true);
                  await fetchAll();
                  setReiseDialogOpen(false);
                }}
                enablePhotoScan={AI_PHOTO_SCAN['Reiseplanung']}
                enablePhotoLocation={AI_PHOTO_LOCATION['Reiseplanung']}
              />
            }
          />
        </div>
      )}

      {/* ── Step 2: Kategorien-Überblick ────────────────────────────────── */}
      {currentStep === 2 && selectedReise && (
        <div className="space-y-5">
          {/* Reise-Details */}
          <div className="rounded-xl border bg-card p-4 space-y-3 overflow-hidden">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <IconMapPin size={18} className="text-primary" stroke={1.8} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-base truncate">
                  {selectedReise.fields.reiseziel ?? '(Kein Reiseziel)'}
                </h3>
                {selectedReise.fields.reisebeschreibung && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                    {selectedReise.fields.reisebeschreibung}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              {selectedReise.fields.startdatum && (
                <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                  <IconCalendar size={14} stroke={1.8} className="shrink-0" />
                  <span className="truncate">{formatDate(selectedReise.fields.startdatum)}</span>
                  {selectedReise.fields.enddatum && (
                    <span className="truncate">– {formatDate(selectedReise.fields.enddatum)}</span>
                  )}
                </div>
              )}
              {selectedReise.fields.anzahl_reisende != null && (
                <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                  <IconUsers size={14} stroke={1.8} className="shrink-0" />
                  <span className="truncate">{selectedReise.fields.anzahl_reisende} Reisende</span>
                </div>
              )}
              {selectedReise.fields.gesamtbudget != null && (
                <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                  <IconWallet size={14} stroke={1.8} className="shrink-0" />
                  <span className="truncate font-medium text-foreground">
                    {formatAmount(selectedReise.fields.gesamtbudget, currencyLabel)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Budget-Tracker */}
          <BudgetTracker
            budget={gesamtbudget}
            booked={totalGeplant}
            label="Geplantes Budget"
          />

          {/* Kategorien-Karten */}
          <div>
            <div className="flex items-center justify-between mb-3 gap-2">
              <h2 className="text-base font-semibold">Ausgabenkategorien</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setKategorieDialogOpen(true)}
                className="shrink-0 gap-1.5"
              >
                <IconPlus size={14} stroke={2} />
                Neu
              </Button>
            </div>

            {ausgabenkategorien.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <IconTag size={32} stroke={1.5} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">Noch keine Kategorien vorhanden.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setKategorieDialogOpen(true)}
                  className="mt-3 gap-1.5"
                >
                  <IconPlus size={14} />
                  Kategorie erstellen
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {ausgabenkategorien.map(kat => {
                  const geplant = kategorieAmounts.get(kat.record_id) ?? 0;
                  const anteil = kat.fields.budgetanteil ?? 0;
                  const zugewiesen = gesamtbudget > 0 ? (anteil / 100) * gesamtbudget : 0;
                  const iconKey = kat.fields.kategorie_icon?.key ?? 'sonstiges';
                  const emoji = ICON_MAP[iconKey] ?? '📦';

                  return (
                    <div
                      key={kat.record_id}
                      className="rounded-xl border bg-card p-4 overflow-hidden space-y-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xl shrink-0">{emoji}</span>
                        <span className="font-medium text-sm truncate min-w-0">
                          {kat.fields.kategoriename ?? '(Ohne Name)'}
                        </span>
                      </div>
                      {anteil > 0 && (
                        <p className="text-xs text-muted-foreground">{anteil}% des Budgets</p>
                      )}
                      <div className="flex items-center justify-between text-xs gap-2">
                        <span className="text-muted-foreground">Geplant:</span>
                        <span className="font-semibold text-foreground truncate">
                          {formatAmount(geplant, currencyLabel)}
                        </span>
                      </div>
                      {zugewiesen > 0 && (
                        <div className="flex items-center justify-between text-xs gap-2">
                          <span className="text-muted-foreground">Zuteilung:</span>
                          <span className="text-muted-foreground truncate">
                            {formatAmount(zugewiesen, currencyLabel)}
                          </span>
                        </div>
                      )}
                      {zugewiesen > 0 && (
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              geplant > zugewiesen ? 'bg-red-500' : 'bg-primary'
                            }`}
                            style={{ width: `${Math.min((geplant / zugewiesen) * 100, 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <AusgabenkategorienDialog
            open={kategorieDialogOpen}
            onClose={() => setKategorieDialogOpen(false)}
            onSubmit={async (fields) => {
              await LivingAppsService.createAusgabenkategorienEntry(fields);
              await fetchAll();
              setKategorieDialogOpen(false);
            }}
            enablePhotoScan={AI_PHOTO_SCAN['Ausgabenkategorien']}
            enablePhotoLocation={AI_PHOTO_LOCATION['Ausgabenkategorien']}
          />

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              onClick={() => { setSelectedReiseId(null); setCurrentStep(1); }}
            >
              Reise wechseln
            </Button>
            <Button
              onClick={() => setCurrentStep(3)}
              className="gap-2"
              disabled={ausgabenkategorien.length === 0}
            >
              Weiter zum Planen
              <IconArrowRight size={16} stroke={2} />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Budgetposten hinzufügen ─────────────────────────────── */}
      {currentStep === 3 && selectedReise && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold">Budgetposten planen</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Wähle eine Kategorie und füge Posten hinzu.
            </p>
          </div>

          {/* Budget-Überblick */}
          <BudgetTracker
            budget={gesamtbudget}
            booked={totalGeplant}
            label="Gesamtbudget"
          />

          {/* Kategorie auswählen */}
          <div>
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
              Kategorie wählen
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {ausgabenkategorien.map(kat => {
                const isSelected = kat.record_id === selectedKategorieId;
                const iconKey = kat.fields.kategorie_icon?.key ?? 'sonstiges';
                const emoji = ICON_MAP[iconKey] ?? '📦';
                const geplant = kategorieAmounts.get(kat.record_id) ?? 0;

                return (
                  <button
                    key={kat.record_id}
                    onClick={() => setSelectedKategorieId(kat.record_id)}
                    className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-colors overflow-hidden ${
                      isSelected
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'bg-card hover:bg-accent hover:border-primary/30'
                    }`}
                  >
                    <span className="text-lg shrink-0">{emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {kat.fields.kategoriename ?? '(Ohne Name)'}
                      </p>
                      {geplant > 0 && (
                        <p className="text-xs text-muted-foreground truncate">
                          {formatAmount(geplant, currencyLabel)} geplant
                        </p>
                      )}
                    </div>
                    {isSelected && (
                      <IconCheck size={16} className="text-primary shrink-0" stroke={2.5} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Posten für gewählte Kategorie */}
          {selectedKategorieId && selectedKategorie && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm truncate">
                    {selectedKategorie.fields.kategoriename ?? 'Kategorie'}
                  </h3>
                  {selectedKategorie.fields.budgetanteil != null && gesamtbudget > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Zuteilung: {formatAmount(
                        (selectedKategorie.fields.budgetanteil / 100) * gesamtbudget,
                        currencyLabel
                      )} ({selectedKategorie.fields.budgetanteil}%)
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={() => setPostenDialogOpen(true)}
                  className="shrink-0 gap-1.5"
                >
                  <IconPlus size={14} stroke={2} />
                  Neuer Posten
                </Button>
              </div>

              {/* Kategorie-Budget-Mini-Tracker */}
              {selectedKategorie.fields.budgetanteil != null && gesamtbudget > 0 && (
                <BudgetTracker
                  budget={(selectedKategorie.fields.budgetanteil / 100) * gesamtbudget}
                  booked={kategoriePosten.reduce((s, p) => s + (p.fields.geplanter_betrag ?? 0), 0)}
                  label={`Budget ${selectedKategorie.fields.kategoriename ?? ''}`}
                />
              )}

              {/* Posten-Liste */}
              {kategoriePosten.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground rounded-xl border bg-muted/30">
                  <IconWallet size={28} stroke={1.5} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Noch keine Posten in dieser Kategorie.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPostenDialogOpen(true)}
                    className="mt-3 gap-1.5"
                  >
                    <IconPlus size={14} />
                    Ersten Posten hinzufügen
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 overflow-x-auto">
                  <div className="space-y-2 min-w-0">
                    {kategoriePosten.map(p => (
                      <div
                        key={p.record_id}
                        className="flex items-center gap-3 p-3 rounded-xl border bg-card overflow-hidden"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {p.fields.bezeichnung ?? '(Ohne Bezeichnung)'}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {p.fields.zahlungsart?.label && (
                              <span className="text-xs text-muted-foreground">
                                {p.fields.zahlungsart.label}
                              </span>
                            )}
                            {p.fields.ausgabendatum && (
                              <span className="text-xs text-muted-foreground">
                                {formatDate(p.fields.ausgabendatum)}
                              </span>
                            )}
                            {p.fields.bereits_bezahlt && (
                              <span className="text-xs text-green-600 font-medium">Bezahlt</span>
                            )}
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-foreground shrink-0">
                          {formatAmount(p.fields.geplanter_betrag ?? 0, currencyLabel)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-end pt-1 text-sm font-semibold gap-2 text-muted-foreground">
                    <span>Gesamt:</span>
                    <span className="text-foreground">
                      {formatAmount(
                        kategoriePosten.reduce((s, p) => s + (p.fields.geplanter_betrag ?? 0), 0),
                        currencyLabel
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {!selectedKategorieId && (
            <div className="text-center py-6 text-muted-foreground">
              <IconChevronRight size={24} stroke={1.5} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">Wähle oben eine Kategorie, um Posten hinzuzufügen.</p>
            </div>
          )}

          <BudgetpostenDialog
            open={postenDialogOpen}
            onClose={() => setPostenDialogOpen(false)}
            onSubmit={async (fields) => {
              await LivingAppsService.createBudgetpostenEntry(fields);
              await fetchAll();
              setPostenDialogOpen(false);
            }}
            defaultValues={
              selectedReiseId && selectedKategorieId
                ? {
                    reise: createRecordUrl(APP_IDS.REISEPLANUNG, selectedReiseId),
                    kategorie: createRecordUrl(APP_IDS.AUSGABENKATEGORIEN, selectedKategorieId),
                  }
                : undefined
            }
            reiseplanungList={reiseplanung}
            ausgabenkategorienList={ausgabenkategorien}
            enablePhotoScan={AI_PHOTO_SCAN['Budgetposten']}
            enablePhotoLocation={AI_PHOTO_LOCATION['Budgetposten']}
          />

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" onClick={() => setCurrentStep(2)}>
              Zurück
            </Button>
            <Button onClick={() => setCurrentStep(4)} className="gap-2">
              Weiter zur Zusammenfassung
              <IconArrowRight size={16} stroke={2} />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 4: Zusammenfassung ──────────────────────────────────────── */}
      {currentStep === 4 && selectedReise && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold">Zusammenfassung</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Deine Reiseplanung auf einen Blick.
            </p>
          </div>

          {/* Reise-Details-Karte */}
          <div className="rounded-xl border bg-card p-4 overflow-hidden space-y-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <IconMapPin size={18} className="text-primary" stroke={1.8} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold truncate">
                  {selectedReise.fields.reiseziel ?? '(Kein Reiseziel)'}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDate(selectedReise.fields.startdatum)} – {formatDate(selectedReise.fields.enddatum)}
                  {selectedReise.fields.anzahl_reisende != null && (
                    <> &middot; {selectedReise.fields.anzahl_reisende} Reisende</>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Gesamt-BudgetTracker */}
          <BudgetTracker
            budget={gesamtbudget}
            booked={totalGeplant}
            label="Gesamtbudget"
          />

          {/* Kategorie-Breakdown */}
          <div>
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
              Aufschlüsselung nach Kategorie
            </h3>
            {ausgabenkategorien.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Kategorien vorhanden.</p>
            ) : (
              <div className="space-y-2">
                {ausgabenkategorien.map(kat => {
                  const geplant = kategorieAmounts.get(kat.record_id) ?? 0;
                  const anteil = kat.fields.budgetanteil ?? 0;
                  const zugewiesen = gesamtbudget > 0 ? (anteil / 100) * gesamtbudget : 0;
                  const ueberBudget = zugewiesen > 0 && geplant > zugewiesen;
                  const unterBudget = zugewiesen > 0 && geplant <= zugewiesen;
                  const iconKey = kat.fields.kategorie_icon?.key ?? 'sonstiges';
                  const emoji = ICON_MAP[iconKey] ?? '📦';

                  return (
                    <div
                      key={kat.record_id}
                      className="flex items-center gap-3 p-3 rounded-xl border bg-card overflow-hidden"
                    >
                      <span className="text-lg shrink-0">{emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {kat.fields.kategoriename ?? '(Ohne Name)'}
                        </p>
                        {zugewiesen > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Zuteilung: {formatAmount(zugewiesen, currencyLabel)} ({anteil}%)
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold">
                          {formatAmount(geplant, currencyLabel)}
                        </p>
                        {ueberBudget && (
                          <div className="flex items-center gap-1 justify-end mt-0.5">
                            <IconAlertTriangle size={12} className="text-red-500" stroke={2} />
                            <span className="text-xs text-red-500 font-medium">Über Budget</span>
                          </div>
                        )}
                        {unterBudget && geplant > 0 && (
                          <div className="flex items-center gap-1 justify-end mt-0.5">
                            <IconCheck size={12} className="text-green-600" stroke={2.5} />
                            <span className="text-xs text-green-600 font-medium">Im Budget</span>
                          </div>
                        )}
                        {geplant === 0 && (
                          <span className="text-xs text-muted-foreground">Keine Posten</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Gesamtsumme */}
          <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 flex items-center justify-between overflow-hidden">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Gesamt geplant</p>
              {gesamtbudget > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  von {formatAmount(gesamtbudget, currencyLabel)}
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className={`text-xl font-bold ${totalGeplant > gesamtbudget && gesamtbudget > 0 ? 'text-red-600' : 'text-foreground'}`}>
                {formatAmount(totalGeplant, currencyLabel)}
              </p>
              {gesamtbudget > 0 && (
                <p className={`text-xs font-medium mt-0.5 ${totalGeplant > gesamtbudget ? 'text-red-500' : 'text-green-600'}`}>
                  {totalGeplant > gesamtbudget
                    ? `${formatAmount(totalGeplant - gesamtbudget, currencyLabel)} über Budget`
                    : `${formatAmount(gesamtbudget - totalGeplant, currencyLabel)} verbleibend`}
                </p>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" onClick={() => setCurrentStep(3)}>
              Zurück
            </Button>
            <Button
              onClick={() => { window.location.hash = '/'; }}
              className="gap-2"
            >
              Planung abschließen
              <IconCheck size={16} stroke={2.5} />
            </Button>
          </div>
        </div>
      )}

      {/* Fallback: Wenn Reise-Daten fehlen aber wir nicht auf Step 1 sind */}
      {currentStep > 1 && !selectedReise && !loading && (
        <div className="text-center py-12 space-y-3">
          <p className="text-muted-foreground text-sm">Keine Reise ausgewählt.</p>
          <Button variant="outline" onClick={() => setCurrentStep(1)}>
            Zur Reise-Auswahl
          </Button>
        </div>
      )}
    </IntentWizardShell>
  );
}
