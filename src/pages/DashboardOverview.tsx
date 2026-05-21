import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichBudgetposten } from '@/lib/enrich';
import type { EnrichedBudgetposten } from '@/types/enriched';
import type { Reiseplanung, Ausgabenkategorien } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  IconAlertCircle, IconTool, IconRefresh, IconCheck,
  IconPlus, IconPencil, IconTrash, IconMapPin, IconCalendar,
  IconUsers, IconWallet, IconChevronRight, IconReceipt,
  IconCash, IconChartBar, IconPlane,
} from '@tabler/icons-react';
import { ReiseplanungDialog } from '@/components/dialogs/ReiseplanungDialog';
import { BudgetpostenDialog } from '@/components/dialogs/BudgetpostenDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';

const APPGROUP_ID = '6a0f4fe6150ba399c70e88fc';
const REPAIR_ENDPOINT = '/claude/build/repair';

// Category icon mapping
function getCategoryIcon(key: string | undefined) {
  switch (key) {
    case 'transport': return '✈️';
    case 'verpflegung': return '🍽️';
    case 'aktivitaeten': return '🎭';
    case 'einkaufe': return '🛍️';
    case 'versicherung': return '🛡️';
    case 'kommunikation': return '📱';
    case 'gesundheit': return '💊';
    case 'unterkunft': return '🏨';
    default: return '📌';
  }
}

export default function DashboardOverview() {
  const {
    reiseplanung, ausgabenkategorien, budgetposten,
    reiseplanungMap, ausgabenkategorienMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const enrichedBudgetposten = enrichBudgetposten(budgetposten, { reiseplanungMap, ausgabenkategorienMap });

  // UI State — ALL hooks before early returns
  const [selectedReiseId, setSelectedReiseId] = useState<string | null>(null);
  const [reiseDialogOpen, setReiseDialogOpen] = useState(false);
  const [editReise, setEditReise] = useState<Reiseplanung | null>(null);
  const [deleteReise, setDeleteReise] = useState<Reiseplanung | null>(null);
  const [postenDialogOpen, setPostenDialogOpen] = useState(false);
  const [editPosten, setEditPosten] = useState<EnrichedBudgetposten | null>(null);
  const [deletePosten, setDeletePosten] = useState<EnrichedBudgetposten | null>(null);

  // Derived data
  const selectedReise = useMemo(
    () => reiseplanung.find(r => r.record_id === selectedReiseId) ?? (reiseplanung[0] ?? null),
    [reiseplanung, selectedReiseId]
  );

  const activeReiseId = selectedReise?.record_id ?? null;

  const postenForReise = useMemo(
    () => enrichedBudgetposten.filter(p => {
      const id = extractRecordId(p.fields.reise);
      return id === activeReiseId;
    }),
    [enrichedBudgetposten, activeReiseId]
  );

  // Budget calculations
  const gesamtBudget = selectedReise?.fields.gesamtbudget ?? 0;
  const gesamtGeplant = useMemo(() => postenForReise.reduce((s, p) => s + (p.fields.geplanter_betrag ?? 0), 0), [postenForReise]);
  const gesamtIst = useMemo(() => postenForReise.reduce((s, p) => s + (p.fields.tatsaechlicher_betrag ?? 0), 0), [postenForReise]);
  const restBudget = gesamtBudget - gesamtIst;
  const budgetPercent = gesamtBudget > 0 ? Math.min((gesamtIst / gesamtBudget) * 100, 100) : 0;

  // Category breakdown
  const kategorienBreakdown = useMemo(() => {
    if (!activeReiseId) return [];
    const map = new Map<string, { kat: Ausgabenkategorien; geplant: number; ist: number; count: number }>();
    for (const p of postenForReise) {
      const katId = extractRecordId(p.fields.kategorie);
      if (!katId) continue;
      const kat = ausgabenkategorienMap.get(katId);
      if (!kat) continue;
      const existing = map.get(katId);
      if (existing) {
        existing.geplant += p.fields.geplanter_betrag ?? 0;
        existing.ist += p.fields.tatsaechlicher_betrag ?? 0;
        existing.count += 1;
      } else {
        map.set(katId, {
          kat,
          geplant: p.fields.geplanter_betrag ?? 0,
          ist: p.fields.tatsaechlicher_betrag ?? 0,
          count: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.ist - a.ist);
  }, [postenForReise, ausgabenkategorienMap, activeReiseId]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // Handlers
  const handleCreateReise = async (fields: Reiseplanung['fields']) => {
    await LivingAppsService.createReiseplanungEntry(fields);
    fetchAll();
  };

  const handleUpdateReise = async (fields: Reiseplanung['fields']) => {
    if (!editReise) return;
    await LivingAppsService.updateReiseplanungEntry(editReise.record_id, fields);
    fetchAll();
  };

  const handleDeleteReise = async () => {
    if (!deleteReise) return;
    await LivingAppsService.deleteReiseplanungEntry(deleteReise.record_id);
    if (selectedReiseId === deleteReise.record_id) setSelectedReiseId(null);
    setDeleteReise(null);
    fetchAll();
  };

  const handleCreatePosten = async (fields: EnrichedBudgetposten['fields']) => {
    await LivingAppsService.createBudgetpostenEntry(fields);
    fetchAll();
  };

  const handleUpdatePosten = async (fields: EnrichedBudgetposten['fields']) => {
    if (!editPosten) return;
    await LivingAppsService.updateBudgetpostenEntry(editPosten.record_id, fields);
    fetchAll();
  };

  const handleDeletePosten = async () => {
    if (!deletePosten) return;
    await LivingAppsService.deleteBudgetpostenEntry(deletePosten.record_id);
    setDeletePosten(null);
    fetchAll();
  };

  return (
    <div className="space-y-6">
      {/* Intent Workflows */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <a href="#/intents/reise-planen" className="flex items-center gap-4 bg-card border border-border border-l-4 border-l-primary rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow no-underline">
          <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <IconPlane size={20} className="text-primary" stroke={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">Reise planen</p>
            <p className="text-xs text-muted-foreground truncate">Budgetposten nach Kategorien erfassen</p>
          </div>
          <IconChevronRight size={16} className="shrink-0 text-muted-foreground" />
        </a>
        <a href="#/intents/reise-abrechnung" className="flex items-center gap-4 bg-card border border-border border-l-4 border-l-primary rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow no-underline">
          <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <IconReceipt size={20} className="text-primary" stroke={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">Reise abrechnen</p>
            <p className="text-xs text-muted-foreground truncate">Tatsächliche Ausgaben erfassen & Belege prüfen</p>
          </div>
          <IconChevronRight size={16} className="shrink-0 text-muted-foreground" />
        </a>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Urlaubs Budget Planer</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{reiseplanung.length} Reise{reiseplanung.length !== 1 ? 'n' : ''} geplant</p>
        </div>
        <Button onClick={() => { setEditReise(null); setReiseDialogOpen(true); }} className="shrink-0">
          <IconPlus size={16} className="mr-1.5 shrink-0" />Neue Reise
        </Button>
      </div>

      {reiseplanung.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 rounded-2xl border border-dashed border-border">
          <IconPlane size={48} className="text-muted-foreground" stroke={1.5} />
          <div className="text-center">
            <h3 className="font-semibold text-foreground mb-1">Noch keine Reisen geplant</h3>
            <p className="text-sm text-muted-foreground max-w-xs">Erstelle deine erste Reise und behalte das Budget immer im Blick.</p>
          </div>
          <Button onClick={() => { setEditReise(null); setReiseDialogOpen(true); }}>
            <IconPlus size={16} className="mr-1.5" />Reise erstellen
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Reise list */}
          <div className="lg:col-span-1 space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-3">Meine Reisen</h2>
            {reiseplanung.map(reise => {
              const reisePosten = enrichedBudgetposten.filter(p => extractRecordId(p.fields.reise) === reise.record_id);
              const reiseIst = reisePosten.reduce((s, p) => s + (p.fields.tatsaechlicher_betrag ?? 0), 0);
              const budget = reise.fields.gesamtbudget ?? 0;
              const pct = budget > 0 ? Math.min((reiseIst / budget) * 100, 100) : 0;
              const isActive = (selectedReiseId === reise.record_id) || (!selectedReiseId && reise === reiseplanung[0]);
              const isOver = budget > 0 && reiseIst > budget;

              return (
                <button
                  key={reise.record_id}
                  onClick={() => setSelectedReiseId(reise.record_id)}
                  className={`w-full text-left rounded-xl border p-4 transition-all ${isActive ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card hover:border-primary/40 hover:bg-muted/30'}`}
                >
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <IconMapPin size={13} className="shrink-0 text-primary" />
                        <span className="font-semibold text-sm truncate">{reise.fields.reiseziel ?? 'Unbekanntes Ziel'}</span>
                      </div>
                      {(reise.fields.startdatum || reise.fields.enddatum) && (
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <IconCalendar size={11} className="shrink-0" />
                          {formatDate(reise.fields.startdatum)} – {formatDate(reise.fields.enddatum)}
                        </p>
                      )}
                      {budget > 0 && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className={isOver ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                              {formatCurrency(reiseIst)}
                            </span>
                            <span className="text-muted-foreground">{formatCurrency(budget)}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${isOver ? 'bg-destructive' : pct > 80 ? 'bg-amber-500' : 'bg-primary'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <IconChevronRight size={14} className={`shrink-0 mt-0.5 transition-opacity ${isActive ? 'opacity-100 text-primary' : 'opacity-40'}`} />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right: Budget detail */}
          <div className="lg:col-span-2 space-y-5">
            {selectedReise ? (
              <>
                {/* Reise header card */}
                <div className="rounded-2xl border border-border bg-card p-5 overflow-hidden">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl font-bold text-foreground truncate">{selectedReise.fields.reiseziel ?? 'Reise'}</h2>
                        {selectedReise.fields.waehrung && (
                          <Badge variant="secondary" className="text-xs shrink-0">{selectedReise.fields.waehrung.label}</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                        {(selectedReise.fields.startdatum || selectedReise.fields.enddatum) && (
                          <span className="flex items-center gap-1">
                            <IconCalendar size={13} className="shrink-0" />
                            {formatDate(selectedReise.fields.startdatum)} – {formatDate(selectedReise.fields.enddatum)}
                          </span>
                        )}
                        {selectedReise.fields.anzahl_reisende && (
                          <span className="flex items-center gap-1">
                            <IconUsers size={13} className="shrink-0" />
                            {selectedReise.fields.anzahl_reisende} Reisende
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => { setEditReise(selectedReise); setReiseDialogOpen(true); }}>
                        <IconPencil size={14} className="shrink-0" />
                        <span className="hidden sm:inline ml-1.5">Bearbeiten</span>
                      </Button>
                      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteReise(selectedReise)}>
                        <IconTrash size={14} className="shrink-0" />
                        <span className="hidden sm:inline ml-1.5">Löschen</span>
                      </Button>
                    </div>
                  </div>

                  {/* Budget overview */}
                  {gesamtBudget > 0 && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground mb-0.5 flex items-center justify-center gap-1"><IconWallet size={12} />Gesamt</p>
                          <p className="font-bold text-base truncate">{formatCurrency(gesamtBudget)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground mb-0.5 flex items-center justify-center gap-1"><IconChartBar size={12} />Geplant</p>
                          <p className="font-bold text-base truncate">{formatCurrency(gesamtGeplant)}</p>
                        </div>
                        <div className="text-center">
                          <p className={`text-xs mb-0.5 flex items-center justify-center gap-1 ${restBudget < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                            <IconCash size={12} />Rest
                          </p>
                          <p className={`font-bold text-base truncate ${restBudget < 0 ? 'text-destructive' : 'text-green-600'}`}>
                            {formatCurrency(restBudget)}
                          </p>
                        </div>
                      </div>
                      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${budgetPercent >= 100 ? 'bg-destructive' : budgetPercent > 80 ? 'bg-amber-500' : 'bg-primary'}`}
                          style={{ width: `${budgetPercent}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>{formatCurrency(gesamtIst)} ausgegeben</span>
                        <span>{Math.round(budgetPercent)}%</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Category breakdown */}
                {kategorienBreakdown.length > 0 && (
                  <div className="rounded-2xl border border-border bg-card p-5 overflow-hidden">
                    <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                      <IconChartBar size={16} className="shrink-0 text-primary" />
                      Nach Kategorie
                    </h3>
                    <div className="space-y-3">
                      {kategorienBreakdown.map(({ kat, geplant, ist, count }) => {
                        const maxVal = Math.max(gesamtGeplant, gesamtIst, 1);
                        const istPct = (ist / maxVal) * 100;
                        const geplantPct = (geplant / maxVal) * 100;
                        const isOver = geplant > 0 && ist > geplant;
                        return (
                          <div key={kat.record_id} className="space-y-1">
                            <div className="flex items-center justify-between min-w-0 gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-base shrink-0">{getCategoryIcon(kat.fields.kategorie_icon?.key)}</span>
                                <span className="text-sm font-medium truncate">{kat.fields.kategoriename ?? 'Kategorie'}</span>
                                <span className="text-xs text-muted-foreground shrink-0">({count})</span>
                              </div>
                              <div className="text-right shrink-0">
                                <span className={`text-sm font-semibold ${isOver ? 'text-destructive' : ''}`}>{formatCurrency(ist)}</span>
                                {geplant > 0 && <span className="text-xs text-muted-foreground ml-1">/ {formatCurrency(geplant)}</span>}
                              </div>
                            </div>
                            <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                              <div className="absolute inset-y-0 left-0 rounded-full bg-muted-foreground/20" style={{ width: `${geplantPct}%` }} />
                              <div
                                className={`absolute inset-y-0 left-0 rounded-full transition-all ${isOver ? 'bg-destructive' : 'bg-primary'}`}
                                style={{ width: `${istPct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Budgetposten list */}
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="flex items-center justify-between gap-3 p-4 border-b border-border">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <IconReceipt size={16} className="shrink-0 text-primary" />
                      Ausgaben ({postenForReise.length})
                    </h3>
                    <Button
                      size="sm"
                      onClick={() => {
                        setEditPosten(null);
                        setPostenDialogOpen(true);
                      }}
                    >
                      <IconPlus size={14} className="mr-1 shrink-0" />Ausgabe
                    </Button>
                  </div>

                  {postenForReise.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4">
                      <IconReceipt size={36} className="text-muted-foreground" stroke={1.5} />
                      <div>
                        <p className="text-sm font-medium text-foreground">Noch keine Ausgaben</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Erfasse deine erste Ausgabe für diese Reise.</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => { setEditPosten(null); setPostenDialogOpen(true); }}>
                        <IconPlus size={14} className="mr-1" />Ausgabe hinzufügen
                      </Button>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {postenForReise.map(posten => {
                        const katId = extractRecordId(posten.fields.kategorie);
                        const kat = katId ? ausgabenkategorienMap.get(katId) : undefined;
                        return (
                          <div key={posten.record_id} className="flex items-center gap-3 px-4 py-3">
                            <span className="text-xl shrink-0">{getCategoryIcon(kat?.fields.kategorie_icon?.key)}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium truncate">{posten.fields.bezeichnung ?? 'Ausgabe'}</span>
                                {posten.fields.bereits_bezahlt && (
                                  <Badge variant="secondary" className="text-xs text-green-700 bg-green-100 border-0 shrink-0">Bezahlt</Badge>
                                )}
                                {posten.fields.beleg_vorhanden && (
                                  <Badge variant="secondary" className="text-xs shrink-0">Beleg</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground mt-0.5">
                                {posten.kategorieName && <span className="truncate">{posten.kategorieName}</span>}
                                {posten.fields.ausgabendatum && <span className="shrink-0">{formatDate(posten.fields.ausgabendatum)}</span>}
                                {posten.fields.zahlungsart && <span className="shrink-0">{posten.fields.zahlungsart.label}</span>}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              {posten.fields.tatsaechlicher_betrag != null && (
                                <p className="text-sm font-semibold">{formatCurrency(posten.fields.tatsaechlicher_betrag)}</p>
                              )}
                              {posten.fields.geplanter_betrag != null && posten.fields.tatsaechlicher_betrag == null && (
                                <p className="text-sm text-muted-foreground">{formatCurrency(posten.fields.geplanter_betrag)} <span className="text-xs">(geplant)</span></p>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => { setEditPosten(posten); setPostenDialogOpen(true); }}
                              >
                                <IconPencil size={13} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => setDeletePosten(posten)}
                              >
                                <IconTrash size={13} />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Reiseplanung Dialog */}
      <ReiseplanungDialog
        open={reiseDialogOpen}
        onClose={() => { setReiseDialogOpen(false); setEditReise(null); }}
        onSubmit={editReise ? handleUpdateReise : handleCreateReise}
        defaultValues={editReise?.fields}
        enablePhotoScan={AI_PHOTO_SCAN['Reiseplanung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Reiseplanung']}
      />

      {/* Budgetposten Dialog */}
      <BudgetpostenDialog
        open={postenDialogOpen}
        onClose={() => { setPostenDialogOpen(false); setEditPosten(null); }}
        onSubmit={editPosten ? handleUpdatePosten : handleCreatePosten}
        defaultValues={editPosten
          ? editPosten.fields
          : activeReiseId
            ? { reise: createRecordUrl(APP_IDS.REISEPLANUNG, activeReiseId) }
            : undefined
        }
        reiseplanungList={reiseplanung}
        ausgabenkategorienList={ausgabenkategorien}
        enablePhotoScan={AI_PHOTO_SCAN['Budgetposten']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Budgetposten']}
      />

      {/* Confirm: Delete Reise */}
      <ConfirmDialog
        open={!!deleteReise}
        title="Reise löschen"
        description={`Soll die Reise "${deleteReise?.fields.reiseziel ?? ''}" wirklich gelöscht werden?`}
        onConfirm={handleDeleteReise}
        onClose={() => setDeleteReise(null)}
      />

      {/* Confirm: Delete Posten */}
      <ConfirmDialog
        open={!!deletePosten}
        title="Ausgabe löschen"
        description={`Soll die Ausgabe "${deletePosten?.fields.bezeichnung ?? ''}" wirklich gelöscht werden?`}
        onConfirm={handleDeletePosten}
        onClose={() => setDeletePosten(null)}
      />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [repairing, setRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairDone, setRepairDone] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairStatus('Reparatur wird gestartet...');
    setRepairFailed(false);

    const errorContext = JSON.stringify({
      type: 'data_loading',
      message: error.message,
      stack: (error.stack ?? '').split('\n').slice(0, 10).join('\n'),
      url: window.location.href,
    });

    try {
      const resp = await fetch(REPAIR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appgroup_id: APPGROUP_ID, error_context: errorContext }),
      });

      if (!resp.ok || !resp.body) {
        setRepairing(false);
        setRepairFailed(true);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data: ')) continue;
          const content = line.slice(6);
          if (content.startsWith('[STATUS]')) setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          if (content.startsWith('[DONE]')) { setRepairDone(true); setRepairing(false); }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) setRepairFailed(true);
        }
      }
    } catch {
      setRepairing(false);
      setRepairFailed(true);
    }
  };

  if (repairDone) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <IconCheck size={22} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Dashboard repariert</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte lade die Seite neu.</p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>
          <IconRefresh size={14} className="mr-1" />Neu laden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {repairing ? repairStatus : error.message}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} disabled={repairing}>Erneut versuchen</Button>
        <Button size="sm" onClick={handleRepair} disabled={repairing}>
          {repairing
            ? <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1" />
            : <IconTool size={14} className="mr-1" />}
          {repairing ? 'Reparatur läuft...' : 'Dashboard reparieren'}
        </Button>
      </div>
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen. Bitte kontaktiere den Support.</p>}
    </div>
  );
}
