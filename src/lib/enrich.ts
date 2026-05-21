import type { EnrichedBudgetposten } from '@/types/enriched';
import type { Ausgabenkategorien, Budgetposten, Reiseplanung } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface BudgetpostenMaps {
  reiseplanungMap: Map<string, Reiseplanung>;
  ausgabenkategorienMap: Map<string, Ausgabenkategorien>;
}

export function enrichBudgetposten(
  budgetposten: Budgetposten[],
  maps: BudgetpostenMaps
): EnrichedBudgetposten[] {
  return budgetposten.map(r => ({
    ...r,
    reiseName: resolveDisplay(r.fields.reise, maps.reiseplanungMap, 'reiseziel'),
    kategorieName: resolveDisplay(r.fields.kategorie, maps.ausgabenkategorienMap, 'kategoriename'),
  }));
}
