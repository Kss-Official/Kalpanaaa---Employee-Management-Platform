import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  initPresence,
  updateLiveWorkStatus,
  subscribeToPresenceDirectory
} from '../lib/presenceEngine';

export interface EmployeeLiveStatus {
  isOnline: boolean;
  workState: string;
  lastSeen: number;
}

export const usePresence = () => {
  const { activeEmployee, role, isAuthenticated } = useAuth();
  const [presenceMap, setPresenceMap] = useState<Record<string, EmployeeLiveStatus>>({});

  const empId = activeEmployee?.id || activeEmployee?.employeeId || '';

  // 1. Initialize self presence when logged in
  useEffect(() => {
    if (!isAuthenticated || !empId) return;

    // P1 FIX: the previous implementation did
    //     let cleanup = () => {};
    //     initPresence(...).then(unsub => { cleanup = unsub; });
    //     return () => cleanup();
    // initPresence is async, so on a fast unmount — which React StrictMode
    // guarantees in development, and which any quick route change causes in
    // production — the effect tore down while `cleanup` was still the no-op stub.
    // The resolved unsubscribe was then dropped on the floor, leaving an orphaned
    // "online" presence node and a live .info/connected listener per mount.
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    initPresence(empId, role || 'EMPLOYEE', 'Working')
      .then((unsub) => {
        if (cancelled) {
          // Teardown already happened — release immediately.
          unsub();
          return;
        }
        unsubscribe = unsub;
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [isAuthenticated, empId, role]);

  // 2. Subscribe to directory presence for live dashboards
  useEffect(() => {
    if (!isAuthenticated) {
      setPresenceMap({});
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    subscribeToPresenceDirectory((map) => {
      if (!cancelled) setPresenceMap(map);
    })
      .then((unsub) => {
        if (cancelled) {
          unsub();
          return;
        }
        unsubscribe = unsub;
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [isAuthenticated]);

  // P1 FIX: `Object.values(presenceMap)` was inferred as unknown[] under this
  // tsconfig, producing 5 hard TypeScript errors ("Property 'isOnline' does not
  // exist on type 'unknown'") that left `npm run lint` red. Annotating the
  // accumulator restores type information, and memoising avoids three full passes
  // over the directory on every render of every consuming dashboard.
  const counts = useMemo(() => {
    const rows: EmployeeLiveStatus[] = Object.keys(presenceMap).map((k) => presenceMap[k]);
    let onlineEmployeeCount = 0;
    let activeWorkingCount = 0;
    let onBreakCount = 0;
    rows.forEach((p) => {
      if (!p || !p.isOnline) return;
      onlineEmployeeCount += 1;
      if (p.workState === 'Working') activeWorkingCount += 1;
      else if (p.workState === 'On Break') onBreakCount += 1;
    });
    return { onlineEmployeeCount, activeWorkingCount, onBreakCount };
  }, [presenceMap]);

  return {
    presenceMap,
    onlineEmployeeCount: counts.onlineEmployeeCount,
    activeWorkingCount: counts.activeWorkingCount,
    onBreakCount: counts.onBreakCount,
    setWorkState: updateLiveWorkStatus
  };
};
