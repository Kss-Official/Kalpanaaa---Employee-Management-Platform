import { ComponentType, lazy, LazyExoticComponent } from 'react';

/**
 * Production-Safe Dynamic Import with Chunk Load Failure Recovery.
 * Automatically handles:
 * 1. Stale hashed chunks after new production deployments.
 * 2. Transient network errors with retry.
 * 3. Controlled single-reload cache-busting recovery with sessionStorage guard (prevents reload storms).
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>,
  chunkName?: string
): LazyExoticComponent<T> {
  return lazy(async () => {
    const storageKey = `kss_chunk_retry_${chunkName || 'default'}`;
    const hasForceRefreshed = window.sessionStorage.getItem(storageKey) === 'true';

    try {
      const module = await componentImport();
      // On successful import, clear any recovery flag
      if (hasForceRefreshed) {
        window.sessionStorage.removeItem(storageKey);
      }
      return module;
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      const isChunkError =
        errorMsg.includes('Failed to fetch dynamically imported module') ||
        errorMsg.includes('Importing a module script failed') ||
        errorMsg.includes('Loading chunk') ||
        errorMsg.includes('error loading dynamically imported module') ||
        error?.name === 'ChunkLoadError';

      console.warn(`[ChunkRecovery] Error loading chunk "${chunkName || 'unknown'}":`, errorMsg);

      if (isChunkError && !hasForceRefreshed) {
        // Set guard flag in sessionStorage so we only reload once per chunk
        window.sessionStorage.setItem(storageKey, 'true');
        console.info(`[ChunkRecovery] Stale chunk detected after deployment. Performing controlled reload to update app shell.`);
        
        // Short timeout to ensure storage is committed before reload
        setTimeout(() => {
          window.location.reload();
        }, 100);

        // Return a never-resolving promise to hold Suspense until reload executes
        return new Promise<{ default: T }>(() => {});
      }

      // If we already refreshed or this is an unrelated error, clear storage guard and throw
      window.sessionStorage.removeItem(storageKey);
      throw error;
    }
  });
}
