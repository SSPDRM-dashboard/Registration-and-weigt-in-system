import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  where,
  onSnapshot,
  getDoc,
  setLogLevel,
  deleteField
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { Competition, Player, Coach, Organizer, Referee } from './types';
import { 
  BASELINE_GLOBAL_CLUBS, 
  BASELINE_COMPETITIONS, 
  BASELINE_TERESA_PLAYERS, 
  BASELINE_COACHES, 
  BASELINE_ORGANIZERS, 
  BASELINE_REFEREE_ACCOUNTS 
} from './baselineData';

// Suppress non-critical connection retry warnings in dev/sandboxed environments
try {
  setLogLevel('silent');
} catch {
  // ignore
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId || "ai-studio-remixdojangreg-319c83eb-bdb0-4d44-85fd-888ad8af99fe");
const auth = getAuth(app);

export { db, auth };

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const errCode = (error as { code?: string })?.code;
  const isOffline = errMsg.includes('client is offline') || 
                    errMsg.includes('Could not reach Cloud Firestore backend') ||
                    errMsg.includes('unavailable') ||
                    errCode === 'unavailable';
  
  if (isOffline) {
    console.warn(`[Firestore Offline/Unavailable] Operation ${operationType} on ${path} will rely on local fallback.`);
    return;
  }

  // Suppress quota errors
  if (errMsg.includes('Quota limit exceeded') || errMsg.includes('resource-exhausted') || errCode === 'resource-exhausted') {
    console.warn(`[Firestore Quota Exceeded] Operation ${operationType} on ${path} will rely on local fallback.`);
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

// --- FIRESTORE HELPERS ---

export const KNOWN_DELETED_COMP_IDS: string[] = ['15thrtschampionshdry'];

export function isCompetitionDeleted(compId: string): boolean {
  if (!compId) return false;
  const cleanId = compId.trim().toLowerCase();
  if (KNOWN_DELETED_COMP_IDS.some(id => id.toLowerCase() === cleanId)) return true;
  try {
    const stored = localStorage.getItem('app:deletedComps');
    if (stored) {
      const list = JSON.parse(stored);
      if (Array.isArray(list) && list.some((id: string) => id.toLowerCase() === cleanId)) return true;
    }
  } catch {}
  return false;
}

export async function fetchCompetitions(): Promise<Competition[]> {
  try {
    const colRef = collection(db, 'competitions');
    const snap = await getDocs(colRef);
    const list: Competition[] = [];
    snap.forEach((doc) => {
      const data = doc.data() as Competition;
      if (data && data.id && !isCompetitionDeleted(data.id)) {
        list.push(data);
      }
    });
    if (list.length > 0) {
      try { localStorage.setItem('app:competitions', JSON.stringify(list)); } catch (e) {}
      return list;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'competitions');
  }
  try {
    const cached = localStorage.getItem('app:competitions');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const filtered = parsed.filter((c: Competition) => c && c.id && !isCompetitionDeleted(c.id));
        if (filtered.length > 0) {
          try { localStorage.setItem('app:competitions', JSON.stringify(filtered)); } catch (e) {}
          return filtered;
        }
      }
    }
  } catch (e) {}
  return BASELINE_COMPETITIONS.filter(c => !isCompetitionDeleted(c.id));
}

export async function saveCompetition(comp: Competition): Promise<void> {
  try {
    const docRef = doc(db, 'competitions', comp.id);
    await setDoc(docRef, comp);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `competitions/${comp.id}`);
  }
}

export async function deleteCompetition(compId: string): Promise<void> {
  try {
    if (!KNOWN_DELETED_COMP_IDS.includes(compId)) {
      KNOWN_DELETED_COMP_IDS.push(compId);
    }
    try {
      const stored = localStorage.getItem('app:deletedComps');
      const list: string[] = stored ? JSON.parse(stored) : [];
      if (!list.includes(compId)) {
        list.push(compId);
        localStorage.setItem('app:deletedComps', JSON.stringify(list));
      }
      // Also scrub from cached app:competitions immediately
      const cached = localStorage.getItem('app:competitions');
      if (cached) {
        const comps: Competition[] = JSON.parse(cached);
        const filtered = comps.filter(c => c && c.id !== compId);
        localStorage.setItem('app:competitions', JSON.stringify(filtered));
      }
    } catch (e) {}

    const docRef = doc(db, 'competitions', compId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `competitions/${compId}`);
  }
}

export async function fetchCoaches(): Promise<Record<string, Coach>> {
  try {
    const colRef = collection(db, 'coaches');
    const snap = await getDocs(colRef);
    const coaches: Record<string, Coach> = {};
    snap.forEach((doc) => {
      const data = doc.data() as Coach;
      if (data.username) {
        coaches[data.username] = data;
      }
    });
    if (Object.keys(coaches).length > 0) {
      try { localStorage.setItem('app:coaches', JSON.stringify(coaches)); } catch (e) {}
      return coaches;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'coaches');
  }
  try {
    const cached = localStorage.getItem('app:coaches');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && Object.keys(parsed).length > 0) return parsed;
    }
  } catch (e) {}
  return BASELINE_COACHES;
}

export async function saveCoach(coach: Coach): Promise<void> {
  try {
    if (!coach.username) return;
    const docRef = doc(db, 'coaches', coach.username);
    await setDoc(docRef, coach);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `coaches/${coach.username}`);
  }
}

export async function deleteCoach(username: string): Promise<void> {
  try {
    const docRef = doc(db, 'coaches', username);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `coaches/${username}`);
  }
}

export async function fetchOrganizers(): Promise<Record<string, Organizer>> {
  try {
    const colRef = collection(db, 'organizers');
    const snap = await getDocs(colRef);
    const organizers: Record<string, Organizer> = {};
    snap.forEach((doc) => {
      const data = doc.data() as Organizer;
      if (data.username) {
        organizers[data.username] = data;
      }
    });
    if (Object.keys(organizers).length > 0) {
      try { localStorage.setItem('app:organizers', JSON.stringify(organizers)); } catch (e) {}
      return organizers;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'organizers');
  }
  try {
    const cached = localStorage.getItem('app:organizers');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && Object.keys(parsed).length > 0) return parsed;
    }
  } catch (e) {}
  return BASELINE_ORGANIZERS;
}

export async function saveOrganizer(organizer: Organizer): Promise<void> {
  try {
    if (!organizer.username) return;
    const docRef = doc(db, 'organizers', organizer.username);
    await setDoc(docRef, organizer);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `organizers/${organizer.username}`);
  }
}

export async function deleteOrganizer(username: string): Promise<void> {
  try {
    const docRef = doc(db, 'organizers', username);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `organizers/${username}`);
  }
}

export async function fetchMasterAthletes(): Promise<Record<string, Partial<Player>>> {
  try {
    const colRef = collection(db, 'masterAthletes');
    const snap = await getDocs(colRef);
    const master: Record<string, Partial<Player>> = {};
    snap.forEach((doc) => {
      const data = doc.data() as Partial<Player>;
      if (data.id) {
        master[data.id] = data;
      }
    });
    return master;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'masterAthletes');
    return {};
  }
}

export async function saveMasterAthlete(athlete: Partial<Player>): Promise<void> {
  try {
    if (!athlete.id) return;
    const docRef = doc(db, 'masterAthletes', athlete.id);
    await setDoc(docRef, athlete);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `masterAthletes/${athlete.id}`);
  }
}

export async function deleteMasterAthlete(id: string): Promise<void> {
  try {
    const docRef = doc(db, 'masterAthletes', id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `masterAthletes/${id}`);
  }
}

export async function fetchPlayersForComp(compId: string): Promise<Player[]> {
  try {
    const colRef = collection(db, 'players');
    const q = query(colRef, where('compId', '==', compId));
    const snap = await getDocs(q);
    const players: Player[] = [];
    snap.forEach((doc) => {
      players.push(doc.data() as Player);
    });
    if (players.length > 0) {
      try { localStorage.setItem(`app:players:${compId}`, JSON.stringify(players)); } catch (e) {}
      return players;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `players?compId=${compId}`);
  }
  try {
    const cached = localStorage.getItem(`app:players:${compId}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  if (compId === 'stteresacup2026udkr' || (compId && compId.toLowerCase().includes('teresa'))) {
    return BASELINE_TERESA_PLAYERS;
  }
  return [];
}

export async function savePlayerToFirestore(player: Player): Promise<void> {
  // Sync to local storage fallback
  try {
    if (player.compId) {
      const key = `app:players:${player.compId}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        const list: Player[] = JSON.parse(stored);
        const idx = list.findIndex(p => p.id === player.id);
        if (idx >= 0) {
          list[idx] = player;
        } else {
          list.push(player);
        }
        localStorage.setItem(key, JSON.stringify(list));
      }
    }
  } catch {}

  try {
    const docRef = doc(db, 'players', player.id);
    await setDoc(docRef, player);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `players/${player.id}`);
  }
}

export async function deletePlayerFromFirestore(playerId: string): Promise<void> {
  try {
    const docRef = doc(db, 'players', playerId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `players/${playerId}`);
  }
}

export async function fetchPlayerById(playerId: string): Promise<Player | null> {
  try {
    const cleanId = (playerId || '').trim();
    if (!cleanId) return null;

    // 1. Direct doc lookup
    try {
      const docRef = doc(db, 'players', cleanId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return snap.data() as Player;
      }
    } catch {}
    
    // 2. Query by 'id' field if doc key differed
    try {
      const q1 = query(collection(db, 'players'), where('id', '==', cleanId));
      const snap1 = await getDocs(q1);
      if (!snap1.empty) {
        return snap1.docs[0].data() as Player;
      }
    } catch {}

    // 3. Query by 'ic' field
    try {
      const q2 = query(collection(db, 'players'), where('ic', '==', cleanId));
      const snap2 = await getDocs(q2);
      if (!snap2.empty) {
        return snap2.docs[0].data() as Player;
      }
    } catch {}

    // 4. Try masterAthletes doc
    try {
      const masterDoc = await getDoc(doc(db, 'masterAthletes', cleanId));
      if (masterDoc.exists()) {
        return masterDoc.data() as Player;
      }
    } catch {}

    // 5. Local storage fallback (case-insensitive and normalized)
    try {
      const normalizedTarget = cleanId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('app:players:')) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const list: Player[] = JSON.parse(raw);
            const found = list.find(p => {
              if (!p) return false;
              if (p.id && p.id.toLowerCase() === cleanId.toLowerCase()) return true;
              if (p.ic) {
                const normIc = p.ic.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                if (normIc === normalizedTarget) return true;
              }
              return false;
            });
            if (found) return found;
          }
        }
      }
    } catch {}

    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `players/${playerId}`);
    return null;
  }
}

export async function fetchCompetitionById(compId: string): Promise<Competition | null> {
  const cleanId = (compId || '').trim();
  if (!cleanId || isCompetitionDeleted(cleanId)) return null;

  try {
    const docRef = doc(db, 'competitions', cleanId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as Competition;
      if (data && !isCompetitionDeleted(data.id)) {
        return data;
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `competitions/${cleanId}`);
  }

  // Local storage fallback
  try {
    const stored = localStorage.getItem('app:competitions');
    if (stored) {
      const list: Competition[] = JSON.parse(stored);
      const found = list.find(c => (c.id === cleanId || (c.id && c.id.toLowerCase() === cleanId.toLowerCase())) && !isCompetitionDeleted(c.id));
      if (found) return found;
    }
  } catch {}

  return null;
}

export function subscribeToPlayersForComp(compId: string, callback: (players: Player[]) => void, onError: (error: Error) => void): () => void {
  const colRef = collection(db, 'players');
  const q = query(colRef, where('compId', '==', compId));
  
  const unsubscribe = onSnapshot(q, (snap) => {
    const players: Player[] = [];
    snap.forEach((doc) => {
      players.push(doc.data() as Player);
    });
    if (players.length > 0) {
      try { localStorage.setItem(`app:players:${compId}`, JSON.stringify(players)); } catch (e) {}
      callback(players);
    } else {
      const cached = localStorage.getItem(`app:players:${compId}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            callback(parsed);
            return;
          }
        } catch(e) {}
      }
      if (compId === 'stteresacup2026udkr' || (compId && compId.toLowerCase().includes('teresa'))) {
        callback(BASELINE_TERESA_PLAYERS);
      } else {
        callback([]);
      }
    }
  }, (error) => {
    const isQuota = String(error).includes('Quota limit exceeded');
    console.warn('[Firestore Quota Exceeded/Sync Error for Players]', isQuota ? 'Quota limit exceeded' : error);
    const cached = localStorage.getItem(`app:players:${compId}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          callback(parsed);
          return;
        }
      } catch(e) {}
    }
    if (compId === 'stteresacup2026udkr' || (compId && compId.toLowerCase().includes('teresa'))) {
      callback(BASELINE_TERESA_PLAYERS);
      return;
    }
    if (!isQuota) {
      handleFirestoreError(error, OperationType.GET, `players?compId=${compId}`);
      onError(error as Error);
    }
  });
  
  return unsubscribe;
}

// --- REFEREE DEDUPLICATION & NORMALIZATION HELPER ---

export function deduplicateReferees(list: Referee[]): Referee[] {
  if (!list || !Array.isArray(list)) return [];
  const map = new Map<string, Referee>();

  for (const ref of list) {
    if (!ref) continue;
    const cleanIc = (ref.nric || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const key = cleanIc || (ref.id ? ref.id.toLowerCase() : '');
    if (!key) continue;

    if (!map.has(key)) {
      map.set(key, ref);
    } else {
      const existing = map.get(key)!;
      // Score both records to retain active assignments and richer data
      const existingHasCourt = existing.courtAssignment && existing.courtAssignment !== 'Unassigned';
      const refHasCourt = ref.courtAssignment && ref.courtAssignment !== 'Unassigned';
      const existingIsRic = existing.specialRole === 'RIC' || (existing.specialRole && existing.specialRole !== 'None');
      const refIsRic = ref.specialRole === 'RIC' || (ref.specialRole && ref.specialRole !== 'None');

      let scoreExisting = 0;
      let scoreRef = 0;

      if (existingHasCourt) scoreExisting += 10;
      if (refHasCourt) scoreRef += 10;
      if (existing.dutyRole && existing.dutyRole !== 'Unassigned') scoreExisting += 5;
      if (ref.dutyRole && ref.dutyRole !== 'Unassigned') scoreRef += 5;
      if (existingIsRic) scoreExisting += 5;
      if (refIsRic) scoreRef += 5;
      if (existing.matchNo) scoreExisting += 2;
      if (ref.matchNo) scoreRef += 2;

      const preferred = scoreRef > scoreExisting ? ref : existing;
      const secondary = scoreRef > scoreExisting ? existing : ref;

      const merged: Referee = {
        ...secondary,
        ...preferred,
        photo: preferred.photo || secondary.photo,
        phone: preferred.phone || secondary.phone,
        bankName: preferred.bankName || secondary.bankName,
        bankAccount: preferred.bankAccount || secondary.bankAccount,
        clubName: preferred.clubName || secondary.clubName,
        residentialLocation: preferred.residentialLocation || secondary.residentialLocation,
        courtAssignment: (preferred.courtAssignment && preferred.courtAssignment !== 'Unassigned') ? preferred.courtAssignment : (secondary.courtAssignment || 'Unassigned'),
        dutyRole: (preferred.dutyRole && preferred.dutyRole !== 'Unassigned') ? preferred.dutyRole : (secondary.dutyRole || 'Unassigned'),
        matchNo: preferred.matchNo || secondary.matchNo || '',
        specialRole: (preferred.specialRole && preferred.specialRole !== 'None') ? preferred.specialRole : (secondary.specialRole || 'None'),
      };

      if (merged.compId && merged.compId !== 'GLOBAL') {
        merged.id = `${merged.compId}_${cleanIc}`;
      } else {
        merged.id = `ACC_${cleanIc}`;
      }

      map.set(key, merged);
    }
  }

  return Array.from(map.values());
}

export async function fetchRefereesForComp(compId: string): Promise<Referee[]> {
  try {
    const colRef = collection(db, 'referees');
    const q = query(colRef, where('compId', '==', compId));
    const snap = await getDocs(q);
    const rawList: { docId: string; data: Referee }[] = [];
    snap.forEach((doc) => {
      const data = doc.data() as Referee;
      data.id = doc.id;
      rawList.push({ docId: doc.id, data });
    });
    
    const uniqueRefs = deduplicateReferees(rawList.map(r => r.data));
    return uniqueRefs;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `referees?compId=${compId}`);
    return [];
  }
}

export async function saveRefereeToFirestore(referee: Referee): Promise<void> {
  try {
    const cleanIc = (referee.nric || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const canonicalId = (referee.compId && referee.compId !== 'GLOBAL' && cleanIc) 
      ? `${referee.compId}_${cleanIc}` 
      : (referee.id || (cleanIc ? `ACC_${cleanIc}` : `REF_${Date.now()}`));

    const normalizedReferee: any = {
      ...referee,
      id: canonicalId,
    };
    
    // Explicitly delete undefined fields from Firestore using deleteField()
    if (normalizedReferee.kyorugiDays === undefined) normalizedReferee.kyorugiDays = deleteField();
    if (normalizedReferee.poomsaeDays === undefined) normalizedReferee.poomsaeDays = deleteField();
    if (normalizedReferee.virtualDays === undefined) normalizedReferee.virtualDays = deleteField();

    const docRef = doc(db, 'referees', canonicalId);
    await setDoc(docRef, normalizedReferee, { merge: true });

    // If there was an old prefix (e.g. RIC_... or REF_...), clean it up
    if (referee.id && referee.id !== canonicalId) {
      deleteDoc(doc(db, 'referees', referee.id)).catch(() => {});
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `referees/${referee.id}`);
  }
}

export async function deleteRefereeFromFirestore(refereeId: string): Promise<void> {
  try {
    if (!refereeId) throw new Error("Missing referee ID");
    const docRef = doc(db, 'referees', refereeId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `referees/${refereeId}`);
    throw error;
  }
}

export function subscribeToRefereesForComp(compId: string, callback: (referees: Referee[]) => void, onError: (error: Error) => void): () => void {
  const colRef = collection(db, 'referees');
  const q = query(colRef, where('compId', '==', compId));
  
  const unsubscribe = onSnapshot(q, (snap) => {
    const rawList: { docId: string; data: Referee }[] = [];
    snap.forEach((doc) => {
      const data = doc.data() as Referee;
      data.id = doc.id;
      rawList.push({ docId: doc.id, data });
    });
    
    const uniqueRefs = deduplicateReferees(rawList.map(r => r.data));
    if (uniqueRefs.length > 0) {
      try { localStorage.setItem(`app:referees:${compId}`, JSON.stringify(uniqueRefs)); } catch (e) {}
    }
    callback(uniqueRefs);
  }, (error) => {
    const errMsg = (error as Error)?.message || String(error);
    const errCode = (error as { code?: string })?.code;
    const isQuota = errMsg.includes('Quota limit exceeded') || errMsg.includes('resource-exhausted') || errCode === 'resource-exhausted';
    console.warn('[Firestore Referees Sync Error]', isQuota ? 'Quota limit exceeded' : error);

    const cached = localStorage.getItem(`app:referees:${compId}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          callback(parsed);
          return;
        }
      } catch (e) {}
    }

    const cachedAccounts = localStorage.getItem('app:refereeAccounts');
    if (cachedAccounts) {
      try {
        const parsedAccounts = JSON.parse(cachedAccounts);
        if (Array.isArray(parsedAccounts)) {
          const compRefs = parsedAccounts.filter((r: Referee) => r.compId === compId);
          if (compRefs.length > 0) {
            callback(compRefs);
            return;
          }
        }
      } catch (e) {}
    }

    const baselineForComp = BASELINE_REFEREE_ACCOUNTS.filter(r => r.compId === compId);
    callback(baselineForComp);

    if (!isQuota) {
      handleFirestoreError(error, OperationType.GET, `referees?compId=${compId}`);
      onError(error as Error);
    }
  });
  
  return unsubscribe;
}

// --- REFEREE ACCOUNTS HELPERS ---

export async function fetchRefereeAccounts(): Promise<Referee[]> {
  try {
    const colRef = collection(db, 'refereeAccounts');
    const snap = await getDocs(colRef);
    const raw: Referee[] = [];
    snap.forEach((doc) => {
      raw.push(doc.data() as Referee);
    });
    const list = deduplicateReferees(raw);
    if (list.length > 0) {
      try { localStorage.setItem('app:refereeAccounts', JSON.stringify(list)); } catch (e) {}
      return list;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'refereeAccounts');
  }
  try {
    const cached = localStorage.getItem('app:refereeAccounts');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return BASELINE_REFEREE_ACCOUNTS;
}

export async function saveRefereeAccount(ref: Referee): Promise<void> {
  try {
    const cleanIc = ref.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const docId = cleanIc;
    const docRef = doc(db, 'refereeAccounts', docId);
    await setDoc(docRef, {
      ...ref,
      id: `ACC_${cleanIc}`
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `refereeAccounts/${ref.nric}`);
  }
}

export async function deleteRefereeAccount(nric: string): Promise<void> {
  try {
    const docId = nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const docRef = doc(db, 'refereeAccounts', docId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `refereeAccounts/${nric}`);
  }
}

export function subscribeToRefereeAccounts(callback: (accounts: Referee[]) => void, onError: (error: Error) => void): () => void {
  const colRef = collection(db, 'refereeAccounts');
  const unsubscribe = onSnapshot(colRef, (snap) => {
    const raw: Referee[] = [];
    snap.forEach((doc) => {
      raw.push(doc.data() as Referee);
    });
    const deduped = deduplicateReferees(raw);
    if (deduped.length > 0) {
      try {
        localStorage.setItem('app:refereeAccounts', JSON.stringify(deduped));
      } catch (e) {}
      callback(deduped);
    } else {
      const cached = localStorage.getItem('app:refereeAccounts');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            callback(parsed);
            return;
          }
        } catch (e) {}
      }
      callback(BASELINE_REFEREE_ACCOUNTS);
    }
  }, (error) => {
    const errMsg = (error as Error)?.message || String(error);
    const errCode = (error as { code?: string })?.code;
    const isQuota = errMsg.includes('Quota limit exceeded') || errMsg.includes('resource-exhausted') || errCode === 'resource-exhausted';
    console.warn('[Firestore Referee Accounts Sync Error]', isQuota ? 'Quota limit exceeded' : error);
    const cached = localStorage.getItem('app:refereeAccounts');
    if (cached) {
      try {
        callback(JSON.parse(cached));
        return;
      } catch (e) {}
    }
    callback(BASELINE_REFEREE_ACCOUNTS);
    if (!isQuota) {
      handleFirestoreError(error, OperationType.GET, 'refereeAccounts');
      onError(error as Error);
    }
  });
  return unsubscribe;
}

export function subscribeToMyReferees(nricCleaned: string, callback: (referees: Referee[]) => void, onError: (error: Error) => void): () => void {
  const colRef = collection(db, 'referees');
  
  const unsubscribe = onSnapshot(colRef, (snap) => {
    const raw: Referee[] = [];
    snap.forEach((doc) => {
      const data = doc.data() as Referee;
      data.id = doc.id;
      if (data.nric && data.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === nricCleaned) {
        raw.push(data);
      }
    });
    const deduped = deduplicateReferees(raw);
    if (deduped.length > 0) {
      try { localStorage.setItem(`app:myReferees:${nricCleaned}`, JSON.stringify(deduped)); } catch (e) {}
    }
    callback(deduped);
  }, (error) => {
    const errMsg = (error as Error)?.message || String(error);
    const errCode = (error as { code?: string })?.code;
    const isQuota = errMsg.includes('Quota limit exceeded') || errMsg.includes('resource-exhausted') || errCode === 'resource-exhausted';
    console.warn('[Firestore My Referees Sync Error]', isQuota ? 'Quota limit exceeded' : error);

    const cached = localStorage.getItem(`app:myReferees:${nricCleaned}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          callback(parsed);
          return;
        }
      } catch (e) {}
    }
    const baseline = BASELINE_REFEREE_ACCOUNTS.filter(r => r.nric && r.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === nricCleaned);
    callback(baseline);

    if (!isQuota) {
      handleFirestoreError(error, OperationType.GET, `referees`);
      onError(error as Error);
    }
  });
  return unsubscribe;
}

export async function fetchGlobalClubs(): Promise<string[] | null> {
  try {
    const docRef = doc(db, 'globalSettings', 'clubs');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.clubs && Array.isArray(data.clubs) && data.clubs.length > 0) {
        try { localStorage.setItem('app:globalClubs', JSON.stringify(data.clubs)); } catch(e) {}
        return data.clubs;
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'globalSettings/clubs');
  }
  try {
    const cached = localStorage.getItem('app:globalClubs');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return BASELINE_GLOBAL_CLUBS;
}

export async function saveGlobalClubs(clubs: string[]): Promise<void> {
  try {
    const docRef = doc(db, 'globalSettings', 'clubs');
    await setDoc(docRef, { clubs });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'globalSettings/clubs');
  }
}

export async function fetchAdminPassword(): Promise<string | null> {
  try {
    const docRef = doc(db, 'globalSettings', 'admin');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data().password || null;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'globalSettings/admin');
    return null;
  }
}

export async function saveAdminPasswordToFirestore(password: string): Promise<void> {
  try {
    const docRef = doc(db, 'globalSettings', 'admin');
    await setDoc(docRef, { password }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'globalSettings/admin');
  }
}


export async function fetchCoachByUsername(username: string): Promise<Coach | null> {
  try {
    const docRef = doc(db, 'coaches', username);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as Coach;
    }
    const q = query(collection(db, 'coaches'), where('username', '==', username));
    const querySnap = await getDocs(q);
    if (!querySnap.empty) {
      return querySnap.docs[0].data() as Coach;
    }
  } catch (error) {
    console.error(error);
  }
  return null;
}

export async function fetchOrganizerByUsername(username: string): Promise<Organizer | null> {
  try {
    const docRef = doc(db, 'organizers', username);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as Organizer;
    }
    const q = query(collection(db, 'organizers'), where('username', '==', username));
    const querySnap = await getDocs(q);
    if (!querySnap.empty) {
      return querySnap.docs[0].data() as Organizer;
    }
  } catch (error) {
    console.error(error);
  }
  return null;
}

export async function fetchRefereeAccountByNric(nric: string): Promise<Referee | null> {
  try {
    const cleanIc = nric.replace(/[^a-zA-Z0-9]/g, '');
    const docRef = doc(db, 'refereeAccounts', cleanIc);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as Referee;
    }
    // Also try querying if document ID isn't exactly cleanIc
    const q = query(collection(db, 'refereeAccounts'), where('nric', '==', nric));
    const querySnap = await getDocs(q);
    if (!querySnap.empty) {
      return querySnap.docs[0].data() as Referee;
    }
  } catch (error) {
    console.error(error);
  }
  return null;
}
