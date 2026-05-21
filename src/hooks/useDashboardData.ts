import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Reiseplanung, Ausgabenkategorien, Budgetposten } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';

export function useDashboardData() {
  const [reiseplanung, setReiseplanung] = useState<Reiseplanung[]>([]);
  const [ausgabenkategorien, setAusgabenkategorien] = useState<Ausgabenkategorien[]>([]);
  const [budgetposten, setBudgetposten] = useState<Budgetposten[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [reiseplanungData, ausgabenkategorienData, budgetpostenData] = await Promise.all([
        LivingAppsService.getReiseplanung(),
        LivingAppsService.getAusgabenkategorien(),
        LivingAppsService.getBudgetposten(),
      ]);
      setReiseplanung(reiseplanungData);
      setAusgabenkategorien(ausgabenkategorienData);
      setBudgetposten(budgetpostenData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Silent background refresh (no loading state change → no flicker)
  useEffect(() => {
    async function silentRefresh() {
      try {
        const [reiseplanungData, ausgabenkategorienData, budgetpostenData] = await Promise.all([
          LivingAppsService.getReiseplanung(),
          LivingAppsService.getAusgabenkategorien(),
          LivingAppsService.getBudgetposten(),
        ]);
        setReiseplanung(reiseplanungData);
        setAusgabenkategorien(ausgabenkategorienData);
        setBudgetposten(budgetpostenData);
      } catch {
        // silently ignore — stale data is better than no data
      }
    }
    function handleRefresh() { void silentRefresh(); }
    window.addEventListener('dashboard-refresh', handleRefresh);
    return () => window.removeEventListener('dashboard-refresh', handleRefresh);
  }, []);

  const reiseplanungMap = useMemo(() => {
    const m = new Map<string, Reiseplanung>();
    reiseplanung.forEach(r => m.set(r.record_id, r));
    return m;
  }, [reiseplanung]);

  const ausgabenkategorienMap = useMemo(() => {
    const m = new Map<string, Ausgabenkategorien>();
    ausgabenkategorien.forEach(r => m.set(r.record_id, r));
    return m;
  }, [ausgabenkategorien]);

  return { reiseplanung, setReiseplanung, ausgabenkategorien, setAusgabenkategorien, budgetposten, setBudgetposten, loading, error, fetchAll, reiseplanungMap, ausgabenkategorienMap };
}