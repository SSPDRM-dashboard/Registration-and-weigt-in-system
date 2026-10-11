import { Competition, Player, Referee } from '../types';

/**
 * Safely strips heavy base64 assets (photos, signatures, IC copies) from player data
 * so that offline caching fits comfortably within browser's ~5MB localStorage quota.
 */
export function preparePlayersForCache(players: Player[]): Player[] {
  if (!Array.isArray(players)) return [];
  return players.map((p) => {
    let modified = false;
    let photo = p.photo;
    let icCopy = p.icCopy;
    let indemnitySignature = p.indemnitySignature;

    if (photo && photo.length > 300) {
      photo = '';
      modified = true;
    }
    if (icCopy && icCopy.length > 300) {
      icCopy = '';
      modified = true;
    }
    if (indemnitySignature && indemnitySignature.length > 300) {
      indemnitySignature = '';
      modified = true;
    }

    if (modified) {
      return {
        ...p,
        photo,
        icCopy,
        indemnitySignature,
      };
    }
    return p;
  });
}

/**
 * Safely strips heavy base64 assets from referee data for local caching.
 */
export function prepareRefereesForCache(referees: Referee[]): Referee[] {
  if (!Array.isArray(referees)) return [];
  return referees.map((r) => {
    if (r.photo && r.photo.length > 300) {
      return { ...r, photo: '' };
    }
    return r;
  });
}

/**
 * Safely strips heavy base64 assets (receipts, charts, QR codes) from competition data
 * so that storing the tournament list in localStorage never triggers QuotaExceededError.
 */
export function prepareCompetitionsForCache(competitions: Competition[]): Competition[] {
  if (!Array.isArray(competitions)) return [];
  return competitions.map((c) => {
    if (!c || typeof c !== 'object') return c;
    // Exclude receipts (stored in their own subcollections or per-competition cache)
    const { receipts, ...rest } = c;
    const stripped: Record<string, unknown> = { ...rest };

    if (typeof stripped.bankQrCode === 'string' && stripped.bankQrCode.length > 300) {
      stripped.bankQrCode = '';
    }
    if (typeof stripped.idCardBgUrl === 'string' && stripped.idCardBgUrl.length > 300) {
      stripped.idCardBgUrl = '';
    }
    if (typeof stripped.ageGroupDetailsPhotoUrl === 'string' && stripped.ageGroupDetailsPhotoUrl.length > 300) {
      stripped.ageGroupDetailsPhotoUrl = '';
    }
    if (typeof stripped.virtualChartPhotoUrl === 'string' && stripped.virtualChartPhotoUrl.length > 300) {
      stripped.virtualChartPhotoUrl = '';
    }
    if (typeof stripped.poomsaeChartPhotoUrl === 'string' && stripped.poomsaeChartPhotoUrl.length > 300) {
      stripped.poomsaeChartPhotoUrl = '';
    }

    return stripped as unknown as Competition;
  });
}

/**
 * Safe wrapper around localStorage.setItem that intercepts QuotaExceededError,
 * cleans up obsolete tournament caches, and ensures the application never crashes.
 */
export function safeSetLocalStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err: unknown) {
    const errMsg = String(err);
    const isQuotaError =
      (err as { name?: string })?.name === 'QuotaExceededError' ||
      (err as { code?: number })?.code === 22 ||
      errMsg.includes('QuotaExceededError') ||
      errMsg.includes('exceeded the quota');

    if (isQuotaError) {
      console.warn(`[Storage Quota Warning] Browser storage quota exceeded while saving "${key}". Evicting older caches...`);

      // 1. Evict heavy receipts, match assignments, and other tournament caches
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (
            k &&
            k !== key &&
            (k.startsWith('app:receipts_') ||
              k.startsWith('app:matchAssignments:') ||
              k.startsWith('app:refereeFees:') ||
              k.startsWith('app:staffPasses:') ||
              k.startsWith('app:myReferees:') ||
              k.startsWith('app:referees:') ||
              k.startsWith('app:players:'))
          ) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => {
          try {
            localStorage.removeItem(k);
          } catch {}
        });

        // Retry saving after eviction
        localStorage.setItem(key, value);
        return true;
      } catch (retryErr) {
        // 2. If it's still failing and the value is a JSON array or object, strip heavy fields and retry
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            const stripped = parsed.map((item) => {
              if (item && typeof item === 'object') {
                const copy = { ...item };
                if (typeof copy.photo === 'string' && copy.photo.length > 100) copy.photo = '';
                if (typeof copy.icCopy === 'string' && copy.icCopy.length > 100) copy.icCopy = '';
                if (typeof copy.indemnitySignature === 'string' && copy.indemnitySignature.length > 100) copy.indemnitySignature = '';
                if (typeof copy.receipts !== 'undefined') delete copy.receipts;
                if (typeof copy.bankQrCode === 'string' && copy.bankQrCode.length > 100) copy.bankQrCode = '';
                if (typeof copy.ageGroupDetailsPhotoUrl === 'string' && copy.ageGroupDetailsPhotoUrl.length > 100) copy.ageGroupDetailsPhotoUrl = '';
                if (typeof copy.virtualChartPhotoUrl === 'string' && copy.virtualChartPhotoUrl.length > 100) copy.virtualChartPhotoUrl = '';
                if (typeof copy.poomsaeChartPhotoUrl === 'string' && copy.poomsaeChartPhotoUrl.length > 100) copy.poomsaeChartPhotoUrl = '';
                return copy;
              }
              return item;
            });
            localStorage.setItem(key, JSON.stringify(stripped));
            return true;
          }
        } catch {}

        console.warn(`[Storage Quota] Cache for "${key}" bypassed; data will remain intact in memory & cloud.`);
        return false;
      }
    } else {
      console.error(`[Storage Error] Failed to set localStorage key "${key}":`, err);
      return false;
    }
  }
}

/**
 * Dedicated helper to cache competition players safely into localStorage without overflowing quota.
 */
export function cachePlayersLocally(compId: string, players: Player[]): void {
  if (!compId) return;
  const lightweight = preparePlayersForCache(players);
  safeSetLocalStorage(`app:players:${compId}`, JSON.stringify(lightweight));
}

/**
 * Dedicated helper to cache competition referees safely into localStorage.
 */
export function cacheRefereesLocally(compId: string, referees: Referee[]): void {
  if (!compId) return;
  const lightweight = prepareRefereesForCache(referees);
  safeSetLocalStorage(`app:referees:${compId}`, JSON.stringify(lightweight));
}

/**
 * Dedicated helper to cache competitions list safely into localStorage without overflowing quota.
 */
export function cacheCompetitionsLocally(competitions: Competition[]): void {
  if (!Array.isArray(competitions)) return;
  const lightweight = prepareCompetitionsForCache(competitions);
  safeSetLocalStorage('app:competitions', JSON.stringify(lightweight));
}

