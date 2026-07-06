import { initializeApp } from 'firebase/app';
import { 
  initializeFirestore, 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  where 
} from 'firebase/firestore';
import { Competition, Player, Coach, Organizer } from './types';

const firebaseConfig = {
  projectId: "gen-lang-client-0374681556",
  appId: "1:247430035144:web:d081293ed62d823fb117fd",
  apiKey: "AIzaSyBtkqRFNgiVISK266nmPF7uWhxIkJhkJZc",
  authDomain: "gen-lang-client-0374681556.firebaseapp.com",
  storageBucket: "gen-lang-client-0374681556.firebasestorage.app",
  messagingSenderId: "247430035144"
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {}, "ai-studio-remixdojangreg-319c83eb-bdb0-4d44-85fd-888ad8af99fe");

export { db };

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
    console.error('Error fetching competitions from Firestore:', error);
    return [];
  }
}

export async function saveCompetition(comp: Competition): Promise<void> {
  try {
    const docRef = doc(db, 'competitions', comp.id);
    await setDoc(docRef, comp);
  } catch (error) {
    console.error('Error saving competition to Firestore:', error);
  }
}

export async function deleteCompetition(compId: string): Promise<void> {
  try {
    const docRef = doc(db, 'competitions', compId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting competition from Firestore:', error);
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
    console.error('Error fetching coaches from Firestore:', error);
    return {};
  }
}

export async function saveCoach(coach: Coach): Promise<void> {
  try {
    if (!coach.username) return;
    const docRef = doc(db, 'coaches', coach.username);
    await setDoc(docRef, coach);
  } catch (error) {
    console.error('Error saving coach to Firestore:', error);
  }
}

export async function deleteCoach(username: string): Promise<void> {
  try {
    const docRef = doc(db, 'coaches', username);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting coach from Firestore:', error);
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
    console.error('Error fetching organizers from Firestore:', error);
    return {};
  }
}

export async function saveOrganizer(organizer: Organizer): Promise<void> {
  try {
    if (!organizer.username) return;
    const docRef = doc(db, 'organizers', organizer.username);
    await setDoc(docRef, organizer);
  } catch (error) {
    console.error('Error saving organizer to Firestore:', error);
  }
}

export async function deleteOrganizer(username: string): Promise<void> {
  try {
    const docRef = doc(db, 'organizers', username);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting organizer from Firestore:', error);
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
    console.error('Error fetching masterAthletes from Firestore:', error);
    return {};
  }
}

export async function saveMasterAthlete(athlete: Partial<Player>): Promise<void> {
  try {
    if (!athlete.id) return;
    const docRef = doc(db, 'masterAthletes', athlete.id);
    await setDoc(docRef, athlete);
  } catch (error) {
    console.error('Error saving master athlete to Firestore:', error);
  }
}

export async function deleteMasterAthlete(id: string): Promise<void> {
  try {
    const docRef = doc(db, 'masterAthletes', id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting master athlete from Firestore:', error);
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
    console.error(`Error fetching players for comp ${compId} from Firestore:`, error);
    return [];
  }
}

export async function savePlayerToFirestore(player: Player): Promise<void> {
  try {
    const docRef = doc(db, 'players', player.id);
    await setDoc(docRef, player);
  } catch (error) {
    console.error('Error saving player to Firestore:', error);
  }
}

export async function deletePlayerFromFirestore(playerId: string): Promise<void> {
  try {
    const docRef = doc(db, 'players', playerId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting player from Firestore:', error);
  }
}
