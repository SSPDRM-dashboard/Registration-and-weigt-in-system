import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot, 
  getDoc, 
  getDocFromServer 
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { Competition, Player, Coach, Organizer, Referee } from './types';

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
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "ai-studio-remixdojangreg-319c83eb-bdb0-4d44-85fd-888ad8af99fe");
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

export async function fetchCompetitions(): Promise<Competition[]> {
  try {
    const colRef = collection(db, 'competitions');
    const snap = await getDocs(colRef);
    const list: Competition[] = [];
    snap.forEach((doc) => {
      list.push(doc.data() as Competition);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'competitions');
    return [];
  }
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
    return coaches;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'coaches');
    return {};
  }
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
    return organizers;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'organizers');
    return {};
  }
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
    return players;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `players?compId=${compId}`);
    return [];
  }
}

export async function savePlayerToFirestore(player: Player): Promise<void> {
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
    const docRef = doc(db, 'players', cleanId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as Player;
    }
    
    // 2. Query by 'id' field if doc key differed
    const q1 = query(collection(db, 'players'), where('id', '==', cleanId));
    const snap1 = await getDocs(q1);
    if (!snap1.empty) {
      return snap1.docs[0].data() as Player;
    }

    // 3. Query by 'ic' field
    const q2 = query(collection(db, 'players'), where('ic', '==', cleanId));
    const snap2 = await getDocs(q2);
    if (!snap2.empty) {
      return snap2.docs[0].data() as Player;
    }

    // 4. Try masterAthletes doc
    try {
      const masterDoc = await getDoc(doc(db, 'masterAthletes', cleanId));
      if (masterDoc.exists()) {
        return masterDoc.data() as Player;
      }
    } catch {}

    // 5. Local storage fallback
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('app:players:')) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const list: Player[] = JSON.parse(raw);
            const found = list.find(p => p.id === cleanId || p.ic === cleanId);
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
  try {
    const docRef = doc(db, 'competitions', compId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as Competition;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `competitions/${compId}`);
    return null;
  }
}

export function subscribeToPlayersForComp(compId: string, callback: (players: Player[]) => void, onError: (error: Error) => void): () => void {
  const colRef = collection(db, 'players');
  const q = query(colRef, where('compId', '==', compId));
  
  const unsubscribe = onSnapshot(q, (snap) => {
    const players: Player[] = [];
    snap.forEach((doc) => {
      players.push(doc.data() as Player);
    });
    callback(players);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, `players?compId=${compId}`);
    onError(error as Error);
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
      rawList.push({ docId: doc.id, data: doc.data() as Referee });
    });
    
    const uniqueRefs = deduplicateReferees(rawList.map(r => r.data));

    // Clean up stale duplicate document keys in background
    const docsToDelete: string[] = [];
    for (const item of rawList) {
      const cleanIc = (item.data.nric || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (!cleanIc) continue;
      const canonicalId = `${compId}_${cleanIc}`;
      if (item.docId !== canonicalId) {
        docsToDelete.push(item.docId);
      }
    }
    if (docsToDelete.length > 0) {
      Promise.all(docsToDelete.map(id => deleteDoc(doc(db, 'referees', id)).catch(() => {}))).catch(() => {});
      uniqueRefs.forEach(r => saveRefereeToFirestore(r).catch(() => {}));
    }

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

    const normalizedReferee: Referee = {
      ...referee,
      id: canonicalId,
    };

    const docRef = doc(db, 'referees', canonicalId);
    await setDoc(docRef, normalizedReferee);

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
    const docRef = doc(db, 'referees', refereeId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `referees/${refereeId}`);
  }
}

export function subscribeToRefereesForComp(compId: string, callback: (referees: Referee[]) => void, onError: (error: Error) => void): () => void {
  const colRef = collection(db, 'referees');
  const q = query(colRef, where('compId', '==', compId));
  
  const unsubscribe = onSnapshot(q, (snap) => {
    const rawList: { docId: string; data: Referee }[] = [];
    snap.forEach((doc) => {
      rawList.push({ docId: doc.id, data: doc.data() as Referee });
    });
    
    const uniqueRefs = deduplicateReferees(rawList.map(r => r.data));

    // Asynchronous cleanup of duplicate documents if detected
    const docsToDelete: string[] = [];
    for (const item of rawList) {
      const cleanIc = (item.data.nric || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (!cleanIc) continue;
      const canonicalId = `${compId}_${cleanIc}`;
      if (item.docId !== canonicalId) {
        docsToDelete.push(item.docId);
      }
    }
    if (docsToDelete.length > 0) {
      Promise.all(docsToDelete.map(id => deleteDoc(doc(db, 'referees', id)).catch(() => {}))).catch(() => {});
      uniqueRefs.forEach(r => saveRefereeToFirestore(r).catch(() => {}));
    }

    callback(uniqueRefs);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, `referees?compId=${compId}`);
    onError(error as Error);
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
    return deduplicateReferees(raw);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'refereeAccounts');
    return [];
  }
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
    callback(deduplicateReferees(raw));
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'refereeAccounts');
    onError(error as Error);
  });
  return unsubscribe;
}

export function subscribeToMyReferees(nricCleaned: string, callback: (referees: Referee[]) => void, onError: (error: Error) => void): () => void {
  const colRef = collection(db, 'referees');
  
  const unsubscribe = onSnapshot(colRef, (snap) => {
    const raw: Referee[] = [];
    snap.forEach((doc) => {
      const data = doc.data() as Referee;
      if (data.nric && data.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === nricCleaned) {
        raw.push(data);
      }
    });
    callback(deduplicateReferees(raw));
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, `referees`);
    onError(error as Error);
  });
  return unsubscribe;
}

export async function fetchGlobalClubs(): Promise<string[] | null> {
  try {
    const docRef = doc(db, 'globalSettings', 'clubs');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      return data.clubs || null;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'globalSettings/clubs');
    return null;
  }
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

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && (error.message.includes('the client is offline') || error.message.includes('Could not reach Cloud Firestore') || (error as { code?: string })?.code === 'unavailable')) {
      // Offline or network unavailable mode - gracefully continue with local state
    }
  }
}
testConnection();

