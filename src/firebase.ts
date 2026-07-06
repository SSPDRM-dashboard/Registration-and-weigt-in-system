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
  onSnapshot
} from 'firebase/firestore';
import { Competition, Player, Coach, Organizer } from './types';

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
const db = initializeFirestore(app, { ignoreUndefinedProperties: true }, "ai-studio-remixdojangreg-319c83eb-bdb0-4d44-85fd-888ad8af99fe");
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
