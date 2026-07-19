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
  getDocFromServer
} from 'firebase/firestore';
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

const firebaseConfig = {
  projectId: "gen-lang-client-0374681556",
  appId: "1:247430035144:web:d081293ed62d823fb117fd",
  apiKey: "AIzaSyBtkqRFNgiVISK266nmPF7uWhxIkJhkJZc",
  authDomain: "gen-lang-client-0374681556.firebaseapp.com",
  storageBucket: "gen-lang-client-0374681556.firebasestorage.app",
  messagingSenderId: "247430035144"
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, { ignoreUndefinedProperties: true, experimentalForceLongPolling: true }, "ai-studio-remixdojangreg-319c83eb-bdb0-4d44-85fd-888ad8af99fe");
const auth = getAuth(app);

export { db, auth };

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
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
  throw new Error(JSON.stringify(errInfo));
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
    const docRef = doc(db, 'players', playerId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as Player;
    }
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

export async function fetchRefereesForComp(compId: string): Promise<Referee[]> {
  try {
    const colRef = collection(db, 'referees');
    const q = query(colRef, where('compId', '==', compId));
    const snap = await getDocs(q);
    const referees: Referee[] = [];
    snap.forEach((doc) => {
      referees.push(doc.data() as Referee);
    });
    return referees;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `referees?compId=${compId}`);
    return [];
  }
}

export async function saveRefereeToFirestore(referee: Referee): Promise<void> {
  try {
    const docRef = doc(db, 'referees', referee.id);
    await setDoc(docRef, referee);
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
    const referees: Referee[] = [];
    snap.forEach((doc) => {
      referees.push(doc.data() as Referee);
    });
    callback(referees);
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
    const accounts: Referee[] = [];
    snap.forEach((doc) => {
      accounts.push(doc.data() as Referee);
    });
    return accounts;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'refereeAccounts');
    return [];
  }
}

export async function saveRefereeAccount(ref: Referee): Promise<void> {
  try {
    const docId = ref.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const docRef = doc(db, 'refereeAccounts', docId);
    await setDoc(docRef, ref);
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
    const accounts: Referee[] = [];
    snap.forEach((doc) => {
      accounts.push(doc.data() as Referee);
    });
    callback(accounts);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'refereeAccounts');
    onError(error as Error);
  });
  return unsubscribe;
}



export function subscribeToMyReferees(nricCleaned: string, callback: (referees: Referee[]) => void, onError: (error: Error) => void): () => void {
  const colRef = collection(db, 'referees');
  
  const unsubscribe = onSnapshot(colRef, (snap) => {
    const referees: Referee[] = [];
    snap.forEach((doc) => {
      const data = doc.data() as Referee;
      if (data.nric && data.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === nricCleaned) {
        referees.push(data);
      }
    });
    callback(referees);
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
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

