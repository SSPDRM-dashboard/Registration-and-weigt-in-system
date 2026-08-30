import React, { useState, useEffect, useRef } from 'react';
import { 
  Trophy, Users, CheckCircle, ShieldCheck, Scale, QrCode, Camera, 
  UserPlus, Download, LogOut, Settings, Plus, Trash2, Edit, Search, 
  AlertCircle, Calendar, MapPin, User, Lock, Upload, Activity, FileText, Clock,
  ChevronRight, RefreshCw, Eye, Palette, Sliders, Layout, Sun, GripVertical,
  Printer, Database, X, Coins, PenTool, Home, Shield, Save, Check, Copy, ExternalLink, Share2,
  Hash, Cpu, Video, Maximize2, Minimize2, Grid, LayoutGrid
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import * as htmlToImage from 'html-to-image';
import jsQR from 'jsqr';
import ExcelJS from 'exceljs';
import { Competition, Player, Coach, WeighIn, Organizer, Referee, MatchAssignment } from './types';
import { DEMO_IMPORT, beltColorFor } from './demoData';
import ParentIndemnityForm from './components/ParentIndemnityForm';
import { 
  fetchCompetitions, 
  saveCompetition, 
  deleteCompetition, 
  fetchCoaches, 
  saveCoach, 
  deleteCoach, 
  fetchOrganizers, 
  saveOrganizer, 
  deleteOrganizer, 
  fetchMasterAthletes, 
  saveMasterAthlete, 
  deleteMasterAthlete, 
  fetchPlayersForComp, 
  subscribeToPlayersForComp,
  savePlayerToFirestore, 
  deletePlayerFromFirestore,
  fetchPlayerById,
  fetchCompetitionById,
  fetchRefereesForComp,
  saveRefereeToFirestore,
  deleteRefereeFromFirestore,
  subscribeToRefereesForComp,
  fetchRefereeAccounts,
  saveRefereeAccount,
  deleteRefereeAccount,
  subscribeToRefereeAccounts,
  subscribeToMyReferees,
  deduplicateReferees,
  fetchGlobalClubs,
  saveGlobalClubs,
  fetchAdminPassword,
  saveAdminPasswordToFirestore
} from './firebase';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import SignatureCanvas from 'react-signature-canvas';

export function parseBirthInfo(dob?: string, ic?: string): { birthYear: number | null; dob: string } {
  let cleanDob = dob ? dob.trim() : '';
  let cleanIc = ic ? ic.replace(/[^0-9]/g, '') : '';

  // 1. Check DOB formatted YYYY-MM-DD
  if (cleanDob && /^\d{4}-\d{2}-\d{2}$/.test(cleanDob)) {
    const y = parseInt(cleanDob.split('-')[0], 10);
    if (!isNaN(y) && y > 1900 && y < 2100) {
      return { birthYear: y, dob: cleanDob };
    }
  }

  // 2. Check DOB formatted DD/MM/YYYY or DD-MM-YYYY
  if (cleanDob && /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(cleanDob)) {
    const parts = cleanDob.split(/[\/\-]/);
    const y = parseInt(parts[2], 10);
    const m = String(parseInt(parts[1], 10)).padStart(2, '0');
    const d = String(parseInt(parts[0], 10)).padStart(2, '0');
    if (!isNaN(y) && y > 1900 && y < 2100) {
      return { birthYear: y, dob: `${y}-${m}-${d}` };
    }
  }

  // 3. Check Malaysian IC (e.g. YYMMDD-PB-### or 12 digits YYMMDDxxxxxx)
  if (cleanIc.length >= 6) {
    const yyStr = cleanIc.substring(0, 2);
    const mmStr = cleanIc.substring(2, 4);
    const ddStr = cleanIc.substring(4, 6);

    const yy = parseInt(yyStr, 10);
    const mm = parseInt(mmStr, 10);
    const dd = parseInt(ddStr, 10);

    if (!isNaN(yy) && !isNaN(mm) && !isNaN(dd) && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      const currentYY = new Date().getFullYear() % 100;
      const century = yy <= (currentYY + 5) ? 2000 : 1900;
      const fullYear = century + yy;
      const formattedDob = `${fullYear}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
      return {
        birthYear: fullYear,
        dob: cleanDob || formattedDob
      };
    }
  }

  // Fallback 4-digit year in DOB
  if (cleanDob) {
    const match = cleanDob.match(/\b(19\d\d|20\d\d)\b/);
    if (match) {
      return { birthYear: parseInt(match[1], 10), dob: cleanDob };
    }
  }

  return { birthYear: null, dob: cleanDob };
}

export function getMatchingAgeGroup(
  dob?: string,
  ic?: string,
  ageGroups: string[] = [],
  compDate?: string
): string | null {
  if (!ageGroups || ageGroups.length === 0) return null;

  const { birthYear } = parseBirthInfo(dob, ic);
  if (!birthYear) return null;

  let compYear = new Date().getFullYear();
  if (compDate) {
    const parsedYear = new Date(compDate).getFullYear();
    if (!isNaN(parsedYear) && parsedYear > 1900) {
      compYear = parsedYear;
    }
  }

  const age = compYear - birthYear;

  // 1. Explicit Year ranges in bracket e.g. "2015-2017" or "(Born 2012-2014)"
  for (const ag of ageGroups) {
    const yearMatches = ag.match(/\b(19\d\d|20\d\d)\b/g);
    if (yearMatches) {
      const years = yearMatches.map(y => parseInt(y, 10));
      if (years.length >= 2) {
        const minY = Math.min(...years);
        const maxY = Math.max(...years);
        if (birthYear >= minY && birthYear <= maxY) return ag;
      } else if (years.length === 1 && birthYear === years[0]) {
        return ag;
      }
    }
  }

  // 2. Age Range in string e.g. "9 to 11", "9 To 10", "12-14", "9-11"
  for (const ag of ageGroups) {
    const rangeMatch = ag.match(/(\d{1,2})\s*(?:to|-|until|â€“)\s*(\d{1,2})/i);
    if (rangeMatch) {
      const minA = parseInt(rangeMatch[1], 10);
      const maxA = parseInt(rangeMatch[2], 10);
      if (age >= minA && age <= maxA) return ag;
    }
  }

  // 3. "Under X" or "X & Below"
  for (const ag of ageGroups) {
    const underMatch = ag.match(/(?:under|below|sub|\& below|and below|and younger)\s*(\d{1,2})/i) ||
                       ag.match(/(\d{1,2})\s*(?:\& below|and below|years \& younger|and younger)/i);
    if (underMatch) {
      const limitA = parseInt(underMatch[1], 10);
      if (age <= limitA) return ag;
    }
  }

  // 4. "X & Above" or "X+" or "X & Older" or "Over X"
  for (const ag of ageGroups) {
    const aboveMatch = ag.match(/(?:above|older|over|senior|\& above|and above|\+)\s*(\d{1,2})/i) ||
                       ag.match(/(\d{1,2})\s*(?:\+|years \& older|and older|\& older|\& above|and above)/i);
    if (aboveMatch) {
      const minA = parseInt(aboveMatch[1], 10);
      if (age >= minA) return ag;
    }
  }

  // 5. Single age match e.g. "12"
  for (const ag of ageGroups) {
    const singleMatch = ag.match(/\b(\d{1,2})\b/);
    if (singleMatch) {
      const targetA = parseInt(singleMatch[1], 10);
      if (age === targetA) return ag;
    }
  }

  return null;
}

const parseFeeToNumber = (feeStr: string | undefined | null): number => {
  if (!feeStr) return 0;
  const match = feeStr.replace(/,/g, '').match(/\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : 0;
};

const formatCurrency = (amount: number, feeSample: string | undefined | null) => {
  if (!feeSample) return `${amount}`;
  const prefixMatch = feeSample.match(/^[^\d]+/);
  const prefix = prefixMatch ? prefixMatch[0].trim() + ' ' : '';
  const suffixMatch = feeSample.match(/[^\d\s\.]+$/);
  const suffix = suffixMatch ? ' ' + suffixMatch[0].trim() : '';
  return `${prefix}${amount.toLocaleString()}${suffix}`;
};

export const formatSpecialRole = (role: string | undefined): string => {
  if (!role || role === 'None') return '';
  if (role === 'TD') return 'Technical Delegate (TD)';
  if (role === 'CSB') return 'Supervisory Board (CSB)';
  if (role === 'RIC') return 'Referee In-Charge (RIC)';
  if (role === 'GAME_MASTER') return 'Game Master (GM)';
  if (role === 'TECHNICAL_OPERATOR') return 'Technical Operator (TO)';
  if (role === 'VIRTUAL_REFEREE') return 'Virtual Referee (VR)';
  return role;
};

export const getRefereeAllowance = (r: Referee, fees: {
  km_0_50: number;
  km_50_100: number;
  km_100_150: number;
  km_150_200: number;
  km_200_250: number;
  km_250_300: number;
  km_300_350: number;
  km_350_above: number;
  km_rate_special?: number;
  overtime: number;
  others: number;
  rate_ir: number;
  rate_nr: number;
  rate_sr: number;
  rate_tr: number;
  rate_td: number;
  rate_csb: number;
  rate_ric: number;
  rate_game_master?: number;
  rate_technical_operator?: number;
  rate_virtual_referee?: number;
}) => {
  const tiers = { 'IR': 4, 'NR': 3, 'SR': 2, 'TR': 1 };
  const baseDailyRates = { 
    'IR': fees.rate_ir, 
    'NR': fees.rate_nr, 
    'SR': fees.rate_sr, 
    'TR': fees.rate_tr 
  };
  
  const hasSplitDays = (r.kyorugiDays !== undefined && r.kyorugiDays > 0) || 
                       (r.poomsaeDays !== undefined && r.poomsaeDays > 0) ||
                       (r.virtualDays !== undefined && r.virtualDays > 0);
  
  let totalDays = r.officiatingDays || 1;
  if (hasSplitDays) {
    const kDays = r.kyorugiDays || 0;
    const pDays = r.poomsaeDays || 0;
    const vDays = r.virtualDays || 0;
    totalDays = kDays + pDays + vDays;
  }

  const calculateTravelPay = (distance: number) => {
    if (r.accommodation === 'No') {
      // If the referee chooses not to stay in lodging, they receive the minimum km rate daily, ignoring the KM they fill
      return fees.km_0_50 * totalDays;
    }
    if (distance <= 0) return 0;
    if (r.specialRole === 'TD' || r.specialRole === 'CSB') {
      const specialRate = fees.km_rate_special !== undefined ? fees.km_rate_special : 0.85;
      return distance * specialRate;
    }
    if (distance <= 50) return fees.km_0_50;
    if (distance <= 100) return fees.km_50_100;
    if (distance <= 150) return fees.km_100_150;
    if (distance <= 200) return fees.km_150_200;
    if (distance <= 250) return fees.km_200_250;
    if (distance <= 300) return fees.km_250_300;
    if (distance <= 350) return fees.km_300_350;
    return fees.km_350_above;
  };

  const travelPay = calculateTravelPay(r.distance);
  const otPay = r.includeOvertime ? fees.overtime : 0;
  const othersPay = r.includeOthers ? fees.others : 0;
  
  const kRank = tiers[r.kyorugiStatus] || 1;
  const pRank = tiers[r.poomsaeStatus] || 1;
  const higherStatus = kRank >= pRank ? r.kyorugiStatus : r.poomsaeStatus;
  
  const stdDailyRate = r.specialRole === 'TD' 
    ? fees.rate_td 
    : r.specialRole === 'CSB' 
    ? fees.rate_csb 
    : r.specialRole === 'RIC' 
    ? fees.rate_ric 
    : r.specialRole === 'GAME_MASTER'
    ? (fees.rate_game_master ?? 220)
    : r.specialRole === 'TECHNICAL_OPERATOR'
    ? (fees.rate_technical_operator ?? 180)
    : r.specialRole === 'VIRTUAL_REFEREE'
    ? (fees.rate_virtual_referee ?? 150)
    : (baseDailyRates[higherStatus] || 80);
  
  let baseDutyPay = 0;
  let splitExplanation = "";
  let kyorugiPay = 0;
  let poomsaePay = 0;
  let virtualPay = 0;

  if (hasSplitDays) {
    const kDays = r.kyorugiDays || 0;
    const pDays = r.poomsaeDays || 0;
    const vDays = r.virtualDays || 0;
    totalDays = kDays + pDays + vDays;
    
    let kRate = baseDailyRates[r.kyorugiStatus] || 80;
    let pRate = baseDailyRates[r.poomsaeStatus] || 80;
    let vRate = fees.rate_virtual_referee ?? 150;
    
    if (r.specialRole === 'GAME_MASTER') {
      vRate = fees.rate_game_master ?? 220;
    } else if (r.specialRole === 'TECHNICAL_OPERATOR') {
      vRate = fees.rate_technical_operator ?? 180;
    } else if (r.specialRole === 'VIRTUAL_REFEREE') {
      vRate = fees.rate_virtual_referee ?? 150;
    }
    
    if (r.specialRole && !['None', 'GAME_MASTER', 'TECHNICAL_OPERATOR', 'VIRTUAL_REFEREE'].includes(r.specialRole)) {
      kRate = stdDailyRate;
      pRate = stdDailyRate;
      vRate = stdDailyRate;
    }
    
    kyorugiPay = kDays * kRate;
    poomsaePay = pDays * pRate;
    virtualPay = vDays * vRate;
    baseDutyPay = kyorugiPay + poomsaePay + virtualPay;
    
    const explanations: string[] = [];
    if (kDays > 0) {
      const roleLabel = (r.specialRole && !['GAME_MASTER', 'TECHNICAL_OPERATOR', 'VIRTUAL_REFEREE', 'None'].includes(r.specialRole)) 
        ? formatSpecialRole(r.specialRole) 
        : r.kyorugiStatus;
      explanations.push(`${kDays}d Kyorugi (${roleLabel}) @ RM ${kRate}`);
    }
    if (pDays > 0) {
      const roleLabel = (r.specialRole && !['GAME_MASTER', 'TECHNICAL_OPERATOR', 'VIRTUAL_REFEREE', 'None'].includes(r.specialRole)) 
        ? formatSpecialRole(r.specialRole) 
        : r.poomsaeStatus;
      explanations.push(`${pDays}d Poomsae (${roleLabel}) @ RM ${pRate}`);
    }
    if (vDays > 0) {
      const roleLabel = r.specialRole === 'GAME_MASTER' 
        ? 'Game Master' 
        : r.specialRole === 'TECHNICAL_OPERATOR' 
        ? 'Tech Operator' 
        : r.specialRole === 'VIRTUAL_REFEREE' 
        ? 'Virtual Ref' 
        : 'Virtual';
      explanations.push(`${vDays}d ${roleLabel} @ RM ${vRate}`);
    }
    splitExplanation = explanations.join(" + ");
  } else if (r.specialRole && r.specialRole !== 'None') {
    baseDutyPay = stdDailyRate * totalDays;
    splitExplanation = `${totalDays} days as ${formatSpecialRole(r.specialRole)} @ RM ${stdDailyRate}/day`;
  } else {
    baseDutyPay = stdDailyRate * totalDays;
    splitExplanation = `${totalDays} days (${higherStatus}) @ RM ${stdDailyRate}/day`;
  }
  
  const totalPay = baseDutyPay + travelPay + otPay + othersPay;
  
  return {
    baseDutyPay,
    travelPay,
    otPay,
    othersPay,
    totalPay,
    dailyRate: stdDailyRate,
    days: totalDays,
    isSplit: hasSplitDays,
    splitExplanation,
    kyorugiDays: r.kyorugiDays || 0,
    poomsaeDays: r.poomsaeDays || 0,
    virtualDays: r.virtualDays || 0,
    kyorugiPay,
    poomsaePay,
    virtualPay,
    higherStatus
  };
};

export function formatDateRange(start: string, end?: string): string {
  if (!end) return start;
  return `${start} to ${end}`;
}

export function isRegistrationClosed(comp: Competition | undefined): boolean {
  if (!comp || !comp.registrationCloseDate) return false;
  const closeDate = new Date(comp.registrationCloseDate);
  closeDate.setHours(23, 59, 59, 999);
  return new Date() > closeDate;
}

export default function App() {
  // --- STATE ---
  const [screen, setScreen] = useState<string>('login'); // login, coachHome, coachRoster, coachPlayerForm, idCard, adminHome, adminCompDetail, adminCompForm, officialScan, officialLog, organizerDashboard, publicView
  const [loginTab, setLoginTab] = useState<'coach' | 'organizer' | 'official' | 'referee' | 'ric' | 'admin' | 'public'>('coach');
  const [organizerTab, setOrganizerTab] = useState<'dashboard' | 'idCard' | 'staffPasses' | 'referees'>('dashboard');
  const [role, setRole] = useState<'coach' | 'official' | 'admin' | 'organizer' | 'public' | 'referee' | null>(null);
  const [user, setUser] = useState<string | null>(null); // username
  const [compId, setCompId] = useState<string | null>(null);
  
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [coaches, setCoaches] = useState<Record<string, Coach>>({});
  const [organizers, setOrganizers] = useState<Record<string, Organizer>>({});
  const [players, setPlayers] = useState<Player[]>([]);
  const [referees, setReferees] = useState<Referee[]>([]);
  const [refereeAccounts, setRefereeAccounts] = useState<Referee[]>([]);
  const [staffPasses, setStaffPasses] = useState<Player[]>([]);
  const [staffPassName, setStaffPassName] = useState('');
  const [staffPassRole, setStaffPassRole] = useState('Coach');
  const [staffPassClub, setStaffPassClub] = useState('');
  const [masterAthletes, setMasterAthletes] = useState<Record<string, Partial<Player>>>( {});

  // Referee login / registration state
  const [refereeLoginNric, setRefereeLoginNric] = useState('');
  const [refereeLoginPassword, setRefereeLoginPassword] = useState('');
  const [refereeLoginComp, setRefereeLoginComp] = useState('');
  const [activeReferee, setActiveReferee] = useState<Referee | null>(null);

  // RIC Terminal Login state
  const [ricLoginNric, setRicLoginNric] = useState('');
  const [ricLoginPassword, setRicLoginPassword] = useState('');
  const [ricLoginComp, setRicLoginComp] = useState('');

  // Referee Registration fields
  const [refereeFullName, setRefereeFullName] = useState('');
  const [refereeNric, setRefereeNric] = useState('');
  const [refereePassword, setRefereePassword] = useState('');
  const [refereePhone, setRefereePhone] = useState('');
  const [refereeClubName, setRefereeClubName] = useState('');
  const [refereeResidential, setRefereeResidential] = useState('');
  const [refereeDistance, setRefereeDistance] = useState('');
  const [refereeBankName, setRefereeBankName] = useState('');
  const [refereeBankAccount, setRefereeBankAccount] = useState('');
  const [refereeAccommodation, setRefereeAccommodation] = useState<'Yes' | 'No'>('No');
  const [refereeKyorugiStatus, setRefereeKyorugiStatus] = useState<'IR' | 'NR' | 'SR' | 'TR'>('TR');
  const [refereePoomsaeStatus, setRefereePoomsaeStatus] = useState<'IR' | 'NR' | 'SR' | 'TR'>('TR');
  const [refereeCarPlate, setRefereeCarPlate] = useState('');
  const [refereeSpecialRole, setRefereeSpecialRole] = useState<'None' | 'TD' | 'CSB' | 'RIC' | 'GAME_MASTER' | 'TECHNICAL_OPERATOR' | 'VIRTUAL_REFEREE'>('None');
  const [refereeConsent, setRefereeConsent] = useState(false);

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [fpUsername, setFpUsername] = useState('');
  const [fpNric, setFpNric] = useState('');
  const [fpName, setFpName] = useState('');
  const [fpPhone, setFpPhone] = useState('');
  const [recoveredPassword, setRecoveredPassword] = useState<string | null>(null);

  // RIC Dashboard state
  const [ricTab, setRicTab] = useState<'courtAssignments' | 'refereeList' | 'matchScheduler' | 'export'>('courtAssignments');
  const [ricSearchQuery, setRicSearchQuery] = useState('');
  const [ricFilterQual, setRicFilterQual] = useState('all');
  const [ricFilterRing, setRicFilterRing] = useState('all');
  const [matchAssignments, setMatchAssignments] = useState<MatchAssignment[]>([]);
  const [editingRefereeCourt, setEditingRefereeCourt] = useState<{ id: string; court: string; dutyRole: string } | null>(null);
  const [isAddingRing, setIsAddingRing] = useState<boolean>(false);
  const [customRingInput, setCustomRingInput] = useState<string>('');

  // Referee Portal & Court Roster Display state
  const [refereeTab, setRefereeTab] = useState<'pass' | 'courtRoster'>('pass');
  const [rosterSearchQuery, setRosterSearchQuery] = useState('');
  const [rosterSelectedRing, setRosterSelectedRing] = useState('all');
  const [fitToWindow, setFitToWindow] = useState<boolean>(true);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);


  
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: 'error' | 'ok' } | null>(null);
  const [scanning, setScanning] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [showSignatures, setShowSignatures] = useState<boolean>(false);
  
  // Modals & confirmation
  const [confirmImport, setConfirmImport] = useState<boolean>(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteCompId, setConfirmDeleteCompId] = useState<string | null>(null);
  const [confirmDeleteCoachUsername, setConfirmDeleteCoachUsername] = useState<string | null>(null);
  const [confirmDeleteOrganizerUsername, setConfirmDeleteOrganizerUsername] = useState<string | null>(null);
  const [confirmDeleteAthleteId, setConfirmDeleteAthleteId] = useState<string | null>(null);
  const [confirmDeleteRefereeId, setConfirmDeleteRefereeId] = useState<string | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [enlargedPhotoUrl, setEnlargedPhotoUrl] = useState<string | null>(null);
  const [enlargedPhotoName, setEnlargedPhotoName] = useState<string | null>(null);

  // Admin Coach Management state
  const [adminCoachSearch, setAdminCoachSearch] = useState<string>('');
  const [showAdminAddCoach, setShowAdminAddCoach] = useState<boolean>(false);
  const [newCoachUsername, setNewCoachUsername] = useState<string>('');
  const [newCoachPass, setNewCoachPass] = useState<string>('');
  const [newCoachName, setNewCoachName] = useState<string>('');
  const [newCoachClub, setNewCoachClub] = useState<string>('');
  const [newCoachPhone, setNewCoachPhone] = useState<string>('');
  const [newCoachEmail, setNewCoachEmail] = useState<string>('');

  // Coach Excel Upload states
  const [showCoachExcelModal, setShowCoachExcelModal] = useState<boolean>(false);
  const [excelParsedPlayers, setExcelParsedPlayers] = useState<Partial<Player>[]>([]);
  const [excelValidationErrors, setExcelValidationErrors] = useState<{ rowNum: number; name: string; error: string }[]>([]);
  const [excelImporting, setExcelImporting] = useState<boolean>(false);

  // Referee Fees Setup states (loaded from localStorage or initialized with defaults)
  const [refereeFees, setRefereeFees] = useState<{
    km_0_50: number;
    km_50_100: number;
    km_100_150: number;
    km_150_200: number;
    km_200_250: number;
    km_250_300: number;
    km_300_350: number;
    km_350_above: number;
    km_rate_special: number;
    overtime: number;
    others: number;
    rate_ir: number;
    rate_nr: number;
    rate_sr: number;
    rate_tr: number;
    rate_td: number;
    rate_csb: number;
    rate_ric: number;
    rate_game_master: number;
    rate_technical_operator: number;
    rate_virtual_referee: number;
    default_accommodation_details: string;
    default_accommodation_maps_link: string;
    default_hotel_days_provided?: number;
    default_hotel_checkout_date?: string;
  }>(() => {
    return {
      km_0_50: 45,
      km_50_100: 75,
      km_100_150: 105,
      km_150_200: 135,
      km_200_250: 165,
      km_250_300: 195,
      km_300_350: 225,
      km_350_above: 280,
      km_rate_special: 1.00,
      overtime: 20,
      others: 0,
      rate_ir: 150,
      rate_nr: 125,
      rate_sr: 100,
      rate_tr: 75,
      rate_td: 250,
      rate_csb: 200,
      rate_ric: 175,
      rate_game_master: 220,
      rate_technical_operator: 180,
      rate_virtual_referee: 150,
      default_accommodation_details: "",
      default_accommodation_maps_link: "",
      default_hotel_days_provided: undefined,
      default_hotel_checkout_date: "",
    };
  });

  // Sync / Load referee fees on compId change
  useEffect(() => {
    if (compId) {
      const stored = localStorage.getItem(`app:refereeFees:${compId}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.km_200_300 !== undefined && parsed.km_200_250 === undefined) {
            parsed.km_200_250 = parsed.km_200_300 - 30; // 150 default
            parsed.km_250_300 = parsed.km_200_300; // 180 default
            delete parsed.km_200_300;
          }
          setRefereeFees({
            km_0_50: parsed.km_0_50 ?? 45,
            km_50_100: parsed.km_50_100 ?? 75,
            km_100_150: parsed.km_100_150 ?? 105,
            km_150_200: parsed.km_150_200 ?? 135,
            km_200_250: parsed.km_200_250 ?? 165,
            km_250_300: parsed.km_250_300 ?? 195,
            km_300_350: parsed.km_300_350 ?? 225,
            km_350_above: parsed.km_350_above ?? 280,
            km_rate_special: parsed.km_rate_special ?? 1.00,
            overtime: parsed.overtime ?? 20,
            others: parsed.others ?? 0,
            rate_ir: parsed.rate_ir ?? 150,
            rate_nr: parsed.rate_nr ?? 125,
            rate_sr: parsed.rate_sr ?? 100,
            rate_tr: parsed.rate_tr ?? 75,
            rate_td: parsed.rate_td ?? 250,
            rate_csb: parsed.rate_csb ?? 200,
            rate_ric: parsed.rate_ric ?? 175,
            rate_game_master: parsed.rate_game_master ?? 220,
            rate_technical_operator: parsed.rate_technical_operator ?? 180,
            rate_virtual_referee: parsed.rate_virtual_referee ?? 150,
            default_accommodation_details: parsed.default_accommodation_details ?? "",
            default_accommodation_maps_link: parsed.default_accommodation_maps_link ?? "",
            default_hotel_days_provided: parsed.default_hotel_days_provided ?? undefined,
            default_hotel_checkout_date: parsed.default_hotel_checkout_date ?? "",
          });
        } catch (e) {
          console.error("Failed to parse stored referee fees", e);
        }
      } else {
        setRefereeFees({
          km_0_50: 45,
          km_50_100: 75,
          km_100_150: 105,
          km_150_200: 135,
          km_200_250: 165,
          km_250_300: 195,
          km_300_350: 225,
          km_350_above: 280,
          km_rate_special: 1.00,
          overtime: 20,
          others: 0,
          rate_ir: 150,
          rate_nr: 125,
          rate_sr: 100,
          rate_tr: 75,
          rate_td: 250,
          rate_csb: 200,
          rate_ric: 175,
          rate_game_master: 220,
          rate_technical_operator: 180,
          rate_virtual_referee: 150,
          default_accommodation_details: "",
          default_accommodation_maps_link: "",
          default_hotel_days_provided: undefined,
          default_hotel_checkout_date: "",
        });
      }
    }

    if (compId) {
      const storedMatches = localStorage.getItem(`app:matchAssignments:${compId}`);
      if (storedMatches) {
        try {
          setMatchAssignments(JSON.parse(storedMatches));
        } catch (e) {
          console.error("Failed to parse stored match assignments", e);
        }
      } else {
        setMatchAssignments([]);
      }
    }
  }, [compId]);

  const saveMatchAssignments = (assignments: MatchAssignment[]) => {
    setMatchAssignments(assignments);
    if (compId) {
      localStorage.setItem(`app:matchAssignments:${compId}`, JSON.stringify(assignments));
    }
  };

  const updateRefereeFees = (newFees: typeof refereeFees) => {
    setRefereeFees(newFees);
    if (compId) {
      localStorage.setItem(`app:refereeFees:${compId}`, JSON.stringify(newFees));
    }
  };
  
  // Theme state
  const [theme, setTheme] = useState<'emerald' | 'midnight' | 'crimson' | 'zen'>(() => {
    const saved = localStorage.getItem('app:theme');
    if (saved && ['emerald', 'midnight', 'crimson', 'zen'].includes(saved)) {
      return saved as any;
    }
    return 'emerald';
  });
  const [showThemeModal, setShowThemeModal] = useState<boolean>(false);
  const [showRefereeEditProfile, setShowRefereeEditProfile] = useState<boolean>(false);
  
  // Coach Edit Profile State
  const [showCoachEditProfile, setShowCoachEditProfile] = useState<boolean>(false);
  const [coachEditName, setCoachEditName] = useState<string>('');
  const [coachEditClub, setCoachEditClub] = useState<string>('');
  const [coachEditPhone, setCoachEditPhone] = useState<string>('');
  const [coachEditEmail, setCoachEditEmail] = useState<string>('');
  const [coachEditPassword, setCoachEditPassword] = useState<string>('');

  const [showOrganizerAddReferee, setShowOrganizerAddReferee] = useState<boolean>(false);
  
  // Edit Competition State
  const [showEditCompModal, setShowEditCompModal] = useState<boolean>(false);
  const [ringToDelete, setRingToDelete] = useState<string | null>(null);
  const [editCompName, setEditCompName] = useState<string>('');
  const [editCompVenue, setEditCompVenue] = useState<string>('');
  const [editCompDate, setEditCompDate] = useState<string>('');
  const [editCompEndDate, setEditCompEndDate] = useState<string>('');
  const [editCompRegistrationCloseDate, setEditCompRegistrationCloseDate] = useState<string>('');
  const [editCompPasscode, setEditCompPasscode] = useState<string>('');

  const [editingAccReferee, setEditingAccReferee] = useState<Referee | null>(null);
  const [editingDistanceRefereeId, setEditingDistanceRefereeId] = useState<string | null>(null);
  const [editingDistanceValue, setEditingDistanceValue] = useState<string>('');
  const [joiningComp, setJoiningComp] = useState<Competition | null>(null);
  const [joiningDistance, setJoiningDistance] = useState<string>('');
  const [joiningAccommodation, setJoiningAccommodation] = useState<'Yes' | 'No'>('No');
  const [joiningKyorugiDays, setJoiningKyorugiDays] = useState<string>('0');
  const [joiningPoomsaeDays, setJoiningPoomsaeDays] = useState<string>('0');
  const [joiningVirtualDays, setJoiningVirtualDays] = useState<string>('0');
  const [editAccStatus, setEditAccStatus] = useState<'Yes' | 'No'>('Yes');
  const [editAccDetails, setEditAccDetails] = useState<string>('');
  const [editAccMapsLink, setEditAccMapsLink] = useState<string>('');
  const [editAccHotelDays, setEditAccHotelDays] = useState<string>('');
  const [editAccCheckoutDate, setEditAccCheckoutDate] = useState<string>('');
  const [addRefereeModalTab, setAddRefereeModalTab] = useState<'existing' | 'new'>('existing');
  const [selectedExistingRefereeNrics, setSelectedExistingRefereeNrics] = useState<string[]>([]);
  const [searchRegisteredQuery, setSearchRegisteredQuery] = useState('');

  // Ring Match Numbers entered by RIC
  const [ringMatchNumbers, setRingMatchNumbers] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('app:ringMatchNumbers');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    if (compId) {
      const saved = localStorage.getItem(`app:ringMatchNumbers:${compId}`);
      if (saved) {
        try {
          setRingMatchNumbers(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to parse stored ring match numbers", e);
        }
      } else {
        setRingMatchNumbers({});
      }
    }
  }, [compId]);

  // Custom layout & background color states
  const [layoutDensity, setLayoutDensity] = useState<'bento' | 'compact'>(() => {
    return (localStorage.getItem('app:layoutDensity') as any) || 'bento';
  });
  const [layoutWidth, setLayoutWidth] = useState<'standard' | 'widescreen' | 'fluid'>(() => {
    return (localStorage.getItem('app:layoutWidth') as any) || 'standard';
  });
  const [customBgColor, setCustomBgColor] = useState<string>(() => {
    return localStorage.getItem('app:customBgColor') || '#1E222B'; // Default is Carbon Black
  });

  const getLayoutWidthClass = () => {
    if (layoutWidth === 'widescreen') return 'max-w-[1500px]';
    if (layoutWidth === 'fluid') return 'max-w-full px-4 sm:px-8';
    return 'max-w-7xl'; // standard
  };
  
  // Manual text entry
  const [manualCode, setManualCode] = useState<string>('');
  const [actualWeightInput, setActualWeightInput] = useState<string>('');

  // Physical / Handheld scanner settings
  const [scannerMode, setScannerMode] = useState<'camera' | 'hardware'>('camera');
  const [autoFocusScanner, setAutoFocusScanner] = useState<boolean>(true);
  const [isScannerFocused, setIsScannerFocused] = useState<boolean>(false);
  const hardwareInputRef = useRef<HTMLInputElement>(null);
  const sigCanvas = useRef<SignatureCanvas>(null);

  useEffect(() => {
    if (screen === 'officialScan' && scannerMode === 'hardware' && autoFocusScanner && !scanResult) {
      const interval = setInterval(() => {
        if (hardwareInputRef.current && document.activeElement !== hardwareInputRef.current) {
          // Do not steal focus if the user is already interacting with another text input or textarea
          if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
             return;
          }
          hardwareInputRef.current.focus();
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [screen, scannerMode, autoFocusScanner, scanResult]);

  // Banking and receipts states
  const [bankNameInput, setBankNameInput] = useState('');
  const [bankAccountInput, setBankAccountInput] = useState('');
  const [kyorugiFeeInput, setKyorugiFeeInput] = useState('');
  const [poomsaeFeeInput, setPoomsaeFeeInput] = useState('');
  const [paraFeeInput, setParaFeeInput] = useState('');
  const [virtualFeeInput, setVirtualFeeInput] = useState('');
  const [feeUpdateSuccess, setFeeUpdateSuccess] = useState(false);
  const [selectedClubReceipt, setSelectedClubReceipt] = useState<{ clubName: string; receiptUrl: string; uploadedAt: string } | null>(null);

  useEffect(() => {
    const active = competitions.find(c => c.id === compId);
    if (active) {
      setBankNameInput(active.bankName || '');
      setBankAccountInput(active.bankAccount || '');
      setKyorugiFeeInput(active.kyorugiFee || '');
      setPoomsaeFeeInput(active.poomsaeFee || '');
      setParaFeeInput(active.paraFee || '');
      setVirtualFeeInput(active.virtualFee || '');
    } else {
      setBankNameInput('');
      setBankAccountInput('');
      setKyorugiFeeInput('');
      setPoomsaeFeeInput('');
      setParaFeeInput('');
      setVirtualFeeInput('');
    }
  }, [compId, competitions]);
  
  // Admin form inputs
  const [ncName, setNcName] = useState('');
  const [ncVenue, setNcVenue] = useState('');
  const [ncDate, setNcDate] = useState('');
  const [ncEndDate, setNcEndDate] = useState('');
  const [ncRegistrationCloseDate, setNcRegistrationCloseDate] = useState('');
  const [ncCode, setNcCode] = useState('weighin123');
  
  // Category additions
  const [newAgeGroup, setNewAgeGroup] = useState('');
  const [newWc, setNewWc] = useState('');
  const [newClubOption, setNewClubOption] = useState('');

  // Player Form inputs
  const [pName, setPName] = useState('');
  const [pIc, setPIc] = useState('');
  const [pDob, setPDob] = useState('');
  const [pGender, setPGender] = useState('');
  const [pClub, setPClub] = useState('');
  const [pEvent, setPEvent] = useState('');
  const [pAgeGroup, setPAgeGroup] = useState('');
  const [pWeightClass, setPWeightClass] = useState('');
  const [pSchoolName, setPSchoolName] = useState('');
  const [pSchoolCode, setPSchoolCode] = useState('');
  const [pRace, setPRace] = useState('Malay');
  const [selectedMasterId, setSelectedMasterId] = useState<string | null>(null);

  // Login inputs
  const [cUser, setCUser] = useState('');
  const [cPass, setCPass] = useState('');
  const [sUser, setSUser] = useState('');
  const [sPass, setSPass] = useState('');
  const [sName, setSName] = useState('');
  const [sClub, setSClub] = useState('');
  const [sPhone, setSPhone] = useState('');
  const [sEmail, setSEmail] = useState('');
  const [cComp, setCComp] = useState('');
  const [oComp, setOComp] = useState('');
  const [oCode, setOCode] = useState('');
  const [oStation, setOStation] = useState('Station 1');
  const [aUser, setAUser] = useState('admin');
  const [aPass, setAPass] = useState('');
  const [publicPassInput, setPublicPassInput] = useState('');
  
  // Parent Indemnity Form States
  const [indemnityPlayer, setIndemnityPlayer] = useState<Player | null>(null);
  const [indemnityComp, setIndemnityComp] = useState<Competition | null>(null);
  const [indemnityLoading, setIndemnityLoading] = useState<boolean>(false);
  const [indemnityCoach, setIndemnityCoach] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const athleteId = params.get('indemnity');
    const compIdParam = params.get('indemnityComp');
    const coachParam = params.get('coach');
    
    if (coachParam) {
      setIndemnityCoach(coachParam);
    }

    if (athleteId) {
      setIndemnityLoading(true);
      setScreen('parentIndemnity');
      fetchPlayerById(athleteId).then(async (player) => {
        if (player) {
          setIndemnityPlayer(player);
          const comp = await fetchCompetitionById(player.compId);
          if (comp) {
            setIndemnityComp(comp);
          }
        } else {
          triggerMsg('Athlete record not found for indemnity form.', 'error');
        }
        setIndemnityLoading(false);
      }).catch(err => {
        console.error(err);
        setIndemnityLoading(false);
        triggerMsg('Error loading athlete record.', 'error');
      });
    } else if (compIdParam) {
      setIndemnityLoading(true);
      setScreen('parentIndemnity');
      fetchCompetitionById(compIdParam).then((comp) => {
        if (comp) {
          setIndemnityComp(comp);
          setIndemnityPlayer(null);
        } else {
          triggerMsg('Tournament record not found for indemnity form.', 'error');
        }
        setIndemnityLoading(false);
      }).catch(err => {
        console.error(err);
        setIndemnityLoading(false);
        triggerMsg('Error loading tournament record.', 'error');
      });
    }
  }, []);

  // Synchronize cComp, oComp, refereeLoginComp, and ricLoginComp with the list of active competitions
  useEffect(() => {
    const activeComps = competitions.filter(c => c.isActive !== false);
    if (activeComps.length > 0) {
      const isValidActiveC = activeComps.some(c => c.id === cComp);
      if (!isValidActiveC) {
        setCComp(activeComps[0].id);
      }
      const isValidActiveO = activeComps.some(c => c.id === oComp);
      if (!isValidActiveO) {
        setOComp(activeComps[0].id);
      }
      const isValidActiveR = activeComps.some(c => c.id === refereeLoginComp);
      if (!isValidActiveR) {
        setRefereeLoginComp(activeComps[0].id);
      }
      const isValidActiveRIC = activeComps.some(c => c.id === ricLoginComp);
      if (!isValidActiveRIC) {
        setRicLoginComp(activeComps[0].id);
      }
    } else {
      setCComp('');
      setOComp('');
      setRefereeLoginComp('');
      setRicLoginComp('');
    }
  }, [competitions, cComp, oComp, refereeLoginComp, ricLoginComp]);

  // If the active tournament is set to inactive, prevent coach, official, and public access, redirecting them.
  useEffect(() => {
    if (compId) {
      const currentComp = competitions.find(c => c.id === compId);
      if (currentComp && currentComp.isActive === false) {
        if (role === 'coach') {
          setCompId(null);
          if (screen === 'coachRoster' || screen === 'coachPlayerForm') {
            setScreen('coachHome');
          }
          triggerMsg('This tournament is inactive. Access is disabled.', 'error');
        } else if (role === 'official' || role === 'public' || role === 'referee') {
          setCompId(null);
          setRole(null);
          setUser(null);
          setScreen('login');
          setActiveReferee(null);
          triggerMsg('This tournament is inactive. Session expired.', 'error');
        }
      }
    }
  }, [role, compId, competitions, screen]);

  // Admin coach edit
  const [editingCoachUsername, setEditingCoachUsername] = useState<string | null>(null);
  const [editCoachName, setEditCoachName] = useState('');
  const [editCoachClub, setEditCoachClub] = useState('');
  const [editCoachPass, setEditCoachPass] = useState('');
  const [editCoachPhone, setEditCoachPhone] = useState('');
  const [editCoachEmail, setEditCoachEmail] = useState('');
  
  // Admin Navigation
  const [adminTab, setAdminTab] = useState<'tournaments' | 'coaches' | 'organizers' | 'security' | 'referees' | 'clubs' | 'ric'>('tournaments');
  const [globalClubs, setGlobalClubs] = useState<string[]>([]);
  const [newGlobalClubOption, setNewGlobalClubOption] = useState('');

  const [adminPassword, setAdminPassword] = useState<string>(() => {
    return localStorage.getItem('app:adminPassword') || 'admin123';
  });
  const [newAdminPass, setNewAdminPass] = useState('');
  const [confirmAdminPass, setConfirmAdminPass] = useState('');

  // Admin RIC Accounts & Settings state
  const [adminRicName, setAdminRicName] = useState('');
  const [adminRicNric, setAdminRicNric] = useState('');
  const [adminRicPassword, setAdminRicPassword] = useState('');
  const [adminRicPhone, setAdminRicPhone] = useState('');
  const [adminRicCompId, setAdminRicCompId] = useState('');
  const [editingRicNric, setEditingRicNric] = useState<string | null>(null);

  // Admin organizer edit
  const [orgUsername, setOrgUsername] = useState('');
  const [orgPass, setOrgPass] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgCompId, setOrgCompId] = useState('');

  // Admin Referee Accounts states
  const [editingRefereeNric, setEditingRefereeNric] = useState<string | null>(null);
  const [confirmDeleteRefereeAccountNric, setConfirmDeleteRefereeAccountNric] = useState<string | null>(null);
  const [adminRefName, setAdminRefName] = useState('');
  const [adminRefNric, setAdminRefNric] = useState('');
  const [adminRefPassword, setAdminRefPassword] = useState('');
  const [adminRefPhone, setAdminRefPhone] = useState('');
  const [adminRefClub, setAdminRefClub] = useState('');
  const [adminRefResidential, setAdminRefResidential] = useState('');
  const [adminRefDistance, setAdminRefDistance] = useState('');
  const [adminRefBankName, setAdminRefBankName] = useState('');
  const [adminRefBankAccount, setAdminRefBankAccount] = useState('');
  const [adminRefAccommodation, setAdminRefAccommodation] = useState<'Yes' | 'No'>('No');
  const [adminRefKyorugi, setAdminRefKyorugi] = useState<'IR' | 'NR' | 'SR' | 'TR'>('TR');
  const [adminRefPoomsae, setAdminRefPoomsae] = useState<'IR' | 'NR' | 'SR' | 'TR'>('TR');
  const [adminRefCarPlate, setAdminRefCarPlate] = useState('');
  const [adminRefSpecialRole, setAdminRefSpecialRole] = useState<'None' | 'TD' | 'CSB' | 'RIC' | 'GAME_MASTER' | 'TECHNICAL_OPERATOR' | 'VIRTUAL_REFEREE'>('None');

  // Organizer Referee Accounts and Registration states
  const [orgEditingRefereeNric, setOrgEditingRefereeNric] = useState<string | null>(null);
  const [orgRefName, setOrgRefName] = useState('');
  const [orgRefNric, setOrgRefNric] = useState('');
  const [orgRefPassword, setOrgRefPassword] = useState('');
  const [orgRefPhone, setOrgRefPhone] = useState('');
  const [orgRefClub, setOrgRefClub] = useState('');
  const [orgRefResidential, setOrgRefResidential] = useState('');
  const [orgRefDistance, setOrgRefDistance] = useState('');
  const [orgRefBankName, setOrgRefBankName] = useState('');
  const [orgRefBankAccount, setOrgRefBankAccount] = useState('');
  const [orgRefAccommodation, setOrgRefAccommodation] = useState<'Yes' | 'No'>('No');
  const [orgRefKyorugi, setOrgRefKyorugi] = useState<'IR' | 'NR' | 'SR' | 'TR'>('TR');
  const [orgRefPoomsae, setOrgRefPoomsae] = useState<'IR' | 'NR' | 'SR' | 'TR'>('TR');
  const [orgRefCarPlate, setOrgRefCarPlate] = useState('');
  const [orgRefSpecialRole, setOrgRefSpecialRole] = useState<'None' | 'TD' | 'CSB' | 'RIC' | 'GAME_MASTER' | 'TECHNICAL_OPERATOR' | 'VIRTUAL_REFEREE'>('None');
  const [orgAssignSearch, setOrgAssignSearch] = useState('');

  // Coach Indemnity Dashboard States
  const [showIndemnityDashboardModal, setShowIndemnityDashboardModal] = useState(false);
  const [selectedIndemnityPlayer, setSelectedIndemnityPlayer] = useState<Player | null>(null);
  const [showViewIndemnityModal, setShowViewIndemnityModal] = useState(false);
  const [indemnityFilterStatus, setIndemnityFilterStatus] = useState<'All' | 'Completed' | 'Pending'>('All');
  const [indemnitySearchQuery, setIndemnitySearchQuery] = useState('');

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');
  const [publicSearchQuery, setPublicSearchQuery] = useState('');

  // Master Athlete Search Engine states
  const [masterSearchQuery, setMasterSearchQuery] = useState<string>('');
  const [showMasterDropdown, setShowMasterDropdown] = useState<boolean>(false);
  const [showAthleteDbModal, setShowAthleteDbModal] = useState<boolean>(false);
  const [dbSearchQuery, setDbSearchQuery] = useState<string>('');

  // Print All Cards states
  const [showPrintAllCardsModal, setShowPrintAllCardsModal] = useState<boolean>(false);
  const [printFilterClub, setPrintFilterClub] = useState<string>('all');
  const [printFilterBracket, setPrintFilterBracket] = useState<string>('all');
  const [printSearch, setPrintSearch] = useState<string>('');
  const [isDownloadingAll, setIsDownloadingAll] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadTotal, setDownloadTotal] = useState<number>(0);
  const [excludedPlayerIds, setExcludedPlayerIds] = useState<Set<string>>(new Set());

  // Camera references
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanRequestRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // --- INITIALIZATION ---
  useEffect(() => {
    const initData = async () => {
      // 1. Fetch competitions
      let loadedComps: Competition[] = [];
      try {
        const cloudComps = await fetchCompetitions();
        if (cloudComps && cloudComps.length > 0) {
          loadedComps = cloudComps;
        }
      } catch (e) {
        console.warn("Failed to fetch competitions from cloud, using local fallback:", e);
      }

      if (loadedComps.length === 0) {
        const storedComps = localStorage.getItem('app:competitions');
        if (storedComps) {
          try {
            loadedComps = JSON.parse(storedComps);
            // Sync to cloud asynchronously
            for (const c of loadedComps) {
              saveCompetition(c).catch(err => console.warn("Failed to sync competition to cloud on boot:", err));
            }
          } catch (e) {
            console.error("Failed to parse competitions", e);
          }
        }
      }

      if (loadedComps.length === 0) {
        const defaultComps: Competition[] = [{
          id: 'tmremaja2026',
          name: 'TM National Remaja 2026',
          venue: 'National Taekwondo Arena',
          date: '2026-09-12',
          staffCode: 'weighin123',
          events: ['Kyorugi', 'Para Kyorugi', 'Recognize Poomsae', 'Free Style Poomsae', 'Para Poomsae', 'Virtual Taekwondo'],
          genders: ['Male', 'Female', 'Mix'],
          ageGroups: [
            'Super Cadet (9 To 10 Years Old)', 'Super Cadet (9 to 11 Years Old)', 'Cadet (11 to 12 Years Old)',
            'Cadet (12 to 14 Years Old)', 'Junior (13 to 14 Years Old)', 'Junior (15 to 17 Years Old)',
            '12 to 14 Years Old', '15 to 17 Years Old', '16 years & Older'
          ],
          weightClasses: [
            'All Colour Belt', 'BANTAM 21.01KG-24KG', 'BANTAM 23.01KG-26KG', 'BANTAM 33.01KG-37KG', 'BANTAM 37.01KG-41KG',
            'BANTAM 44.01KG-46KG', 'BANTAM 48.01KG-51KG', 'FEATHER 24.01KG-27KG', 'FEATHER 26.01KG-29KG', 'FEATHER 37.01KG-41KG',
            'FEATHER 41.01KG-45KG', 'FEATHER 46.01KG-49KG', 'FEATHER 51.01KG-55KG', 'FIN BELOW 18KG', 'FIN BELOW 20KG',
            'FIN BELOW 29KG', 'FIN BELOW 33KG', 'FIN BELOW 42KG', 'FIN BELOW 45KG', 'FLY 18.01KG-21KG', 'FLY 20.01KG-23KG',
            'FLY 29.01KG-33KG', 'FLY 33.01KG-37KG', 'FLY 42.01KG-44KG', 'FLY 45.01KG-48KG', 'HEAVY 38KG & ABOVE',
            'HEAVY 40KG & ABOVE', 'HEAVY 59KG & ABOVE', 'HEAVY 65KG & ABOVE', 'HEAVY 68KG & ABOVE', 'HEAVY 78KG & ABOVE',
            'LIGHT 27.01KG-30KG', 'LIGHT 29.01KG-32KG', 'LIGHT 41.01KG-44KG', 'LIGHT 45.01KG-49KG', 'LIGHT 49.01KG-52KG',
            'LIGHT 55.01KG-59KG', 'LIGHT HEAVY 55.01KG-59KG', 'LIGHT HEAVY 61.01KG-65KG', 'LIGHT HEAVY 63.01KG-68KG',
            'LIGHT HEAVY 73.01KG-78KG', 'LIGHT MIDDLE 47.01KG-51KG', 'LIGHT MIDDLE 53.01KG-57KG', 'LIGHT MIDDLE 55.01KG-59KG',
            'LIGHT MIDDLE 63.01KG-68KG', 'MIDDLE 34.01KG-38KG', 'MIDDLE 36.01KG-40KG', 'MIDDLE 51.01KG-55KG',
            'MIDDLE 57.01KG-61KG', 'MIDDLE 59.01KG-63KG', 'MIDDLE 68.01KG-73KG', 'Not Exceeding 58KG', 'Open Weight',
            'Over 65KG', 'P21', 'P22', 'P23', 'Taegeuk 4 to Koryo', 'Taegeuk 4 to Taebaek', 'Taegeuk 5 to Pyongwon',
            'WELTER 30.01KG-34KG', 'WELTER 32.01KG-36KG', 'WELTER 44.01KG-47KG', 'WELTER 49.01KG-53KG',
            'WELTER 52.01KG-55KG', 'WELTER 59.01KG-63KG'
          ],
          affiliatedClubs: [
            'SMART MA TAEKWONDO CLUB',
            'SAUJANA TKD CLUB',
            'TYC TAEKWONDO CLUB',
            'MATSA TAEKWONDO CLUB',
            'PUSAT SENI MEMPERTAHANKAN DIRI TAEKWONDO ACTION WTF',
            'KORYO TAEKWONDO CLUB'
          ],
          isActive: true
        }];
        loadedComps = defaultComps;
        for (const c of defaultComps) {
          saveCompetition(c).catch(err => console.warn("Failed to seed default competition to cloud:", err));
        }
        localStorage.setItem('app:competitions', JSON.stringify(defaultComps));
      }
      setCompetitions(loadedComps);

      if (loadedComps.length > 0) {
        const activeComps = loadedComps.filter(c => c.isActive !== false);
        setCComp(activeComps[0]?.id || '');
        setOComp(activeComps[0]?.id || loadedComps[0]?.id || '');
      }

      // 2. Fetch coaches
      let loadedCoaches: Record<string, Coach> = {};
      try {
        const cloudCoaches = await fetchCoaches();
        if (cloudCoaches) {
          loadedCoaches = cloudCoaches;
        }
      } catch (e) {
        console.warn("Failed to fetch coaches from cloud, using local fallback:", e);
      }

      if (Object.keys(loadedCoaches).length === 0) {
        const storedCoaches = localStorage.getItem('app:coaches');
        if (storedCoaches) {
          try {
            loadedCoaches = JSON.parse(storedCoaches);
            for (const username of Object.keys(loadedCoaches)) {
              saveCoach({ ...loadedCoaches[username], username }).catch(err => console.warn("Failed to sync coach to cloud on boot:", err));
            }
          } catch (e) {
            console.error("Failed to parse coaches", e);
          }
        }
      }

      if (Object.keys(loadedCoaches).length === 0) {
        const defaultCoaches = { 
          demo: { password: 'demo123', name: 'Coach Demo', club: 'SMART MA TAEKWONDO CLUB', username: 'demo' } 
        };
        loadedCoaches = defaultCoaches;
        saveCoach(defaultCoaches.demo).catch(err => console.warn("Failed to seed default coach to cloud:", err));
        localStorage.setItem('app:coaches', JSON.stringify(defaultCoaches));
      }
      setCoaches(loadedCoaches);

      // 3. Fetch organizers
      let loadedOrganizers: Record<string, Organizer> = {};
      try {
        const cloudOrganizers = await fetchOrganizers();
        if (cloudOrganizers) {
          loadedOrganizers = cloudOrganizers;
        }
      } catch (e) {
        console.warn("Failed to fetch organizers from cloud, using local fallback:", e);
      }

      if (Object.keys(loadedOrganizers).length === 0) {
        const storedOrganizers = localStorage.getItem('app:organizers');
        if (storedOrganizers) {
          try {
            loadedOrganizers = JSON.parse(storedOrganizers);
            for (const username of Object.keys(loadedOrganizers)) {
              saveOrganizer({ ...loadedOrganizers[username], username }).catch(err => console.warn("Failed to sync organizer to cloud on boot:", err));
            }
          } catch (e) {
            console.error("Failed to parse organizers", e);
          }
        }
      }
      setOrganizers(loadedOrganizers);

      // 4. Fetch masterAthletes
      let loadedMaster: Record<string, Partial<Player>> = {};
      try {
        const cloudMaster = await fetchMasterAthletes();
        if (cloudMaster) {
          loadedMaster = cloudMaster;
        }
      } catch (e) {
        console.warn("Failed to fetch masterAthletes from cloud, using local fallback:", e);
      }

      if (Object.keys(loadedMaster).length === 0) {
        const storedMaster = localStorage.getItem('app:masterAthletes');
        if (storedMaster) {
          try {
            loadedMaster = JSON.parse(storedMaster);
            for (const id of Object.keys(loadedMaster)) {
              saveMasterAthlete({ ...loadedMaster[id], id }).catch(err => console.warn("Failed to sync master athlete to cloud on boot:", err));
            }
          } catch (e) {
            console.error("Failed to parse masterAthletes", e);
          }
        }
      }
      setMasterAthletes(loadedMaster);

      // 5. Fetch globalClubs
      let loadedGlobalClubs: string[] | null = null;
      try {
        loadedGlobalClubs = await fetchGlobalClubs();
      } catch (e) {
        console.warn("Failed to fetch global clubs from cloud, using local fallback:", e);
      }

      if (!loadedGlobalClubs) {
        const defaultClubs = [
          'SMART MA TAEKWONDO CLUB',
          'SAUJANA TKD CLUB',
          'TYC TAEKWONDO CLUB',
          'MATSA TAEKWONDO CLUB',
          'PUSAT SENI MEMPERTAHANKAN DIRI TAEKWONDO ACTION WTF',
          'KORYO TAEKWONDO CLUB'
        ];
        loadedGlobalClubs = defaultClubs;
        saveGlobalClubs(defaultClubs).catch(err => console.warn("Failed to seed default global clubs to cloud:", err));
      }
      setGlobalClubs(loadedGlobalClubs);

      // 6. Fetch Admin Password
      try {
        const cloudAdminPass = await fetchAdminPassword();
        if (cloudAdminPass) {
          setAdminPassword(cloudAdminPass);
          localStorage.setItem('app:adminPassword', cloudAdminPass);
        } else {
          // If not in cloud but exists locally, sync it up
          const localAdminPass = localStorage.getItem('app:adminPassword') || 'admin123';
          setAdminPassword(localAdminPass);
          saveAdminPasswordToFirestore(localAdminPass).catch(err => console.warn("Failed to sync admin password to cloud:", err));
        }
      } catch (e) {
        console.warn("Failed to fetch admin password from cloud:", e);
      }
    };

    initData();
  }, []);

  // Subscribe to referee accounts in real-time
  useEffect(() => {
    const unsubscribe = subscribeToRefereeAccounts(
      (accounts) => {
        setRefereeAccounts(accounts);
      },
      (err) => {
        console.error("Failed to sync referee accounts", err);
      }
    );
    return () => {
      unsubscribe();
    };
  }, []);

  // Sync theme, density, and colors
  useEffect(() => {
    // 1. Sync Theme Class
    const themes = ['theme-emerald', 'theme-midnight', 'theme-crimson', 'theme-zen'];
    themes.forEach(t => document.body.classList.remove(t));
    document.body.classList.add(`theme-${theme}`);
    localStorage.setItem('app:theme', theme);

    // 2. Sync Layout Density Class
    if (layoutDensity === 'compact') {
      document.body.classList.add('layout-compact');
    } else {
      document.body.classList.remove('layout-compact');
    }
    localStorage.setItem('app:layoutDensity', layoutDensity);
  }, [theme, layoutDensity]);

  // Sync custom background color properties
  useEffect(() => {
    const applyCustomThemeAndColors = (bgHex: string) => {
      const root = document.documentElement;
      
      const cleanHex = bgHex.replace('#', '');
      const r = parseInt(cleanHex.substring(0, 2), 16) || 255;
      const g = parseInt(cleanHex.substring(2, 4), 16) || 255;
      const b = parseInt(cleanHex.substring(4, 6), 16) || 255;
      
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const isLight = luminance > 0.5;
      
      root.style.setProperty('--theme-ink', bgHex);
      
      if (isLight) {
        root.style.setProperty('--theme-text', '#14221C');
        root.style.setProperty('--theme-text-dim', '#5B6E63');
        root.style.setProperty('--theme-surface', '#FFFFFF');
        root.style.setProperty('--theme-surface-2', '#F0F4F2');
        root.style.setProperty('--theme-line', '#D1E2D9');
        root.style.setProperty('--theme-mat', '#F5F7F6');
      } else {
        root.style.setProperty('--theme-text', '#F7FAFC');
        root.style.setProperty('--theme-text-dim', '#A0AEC0');
        
        // Compute solid lighter dark surfaces
        const lighten = (c: number) => Math.min(255, Math.floor(c + (255 - c) * 0.08));
        const cardHex = `#${lighten(r).toString(16).padStart(2, '0')}${lighten(g).toString(16).padStart(2, '0')}${lighten(b).toString(16).padStart(2, '0')}`;
        root.style.setProperty('--theme-surface', cardHex);
        
        const lightenMore = (c: number) => Math.min(255, Math.floor(c + (255 - c) * 0.15));
        const card2Hex = `#${lightenMore(r).toString(16).padStart(2, '0')}${lightenMore(g).toString(16).padStart(2, '0')}${lightenMore(b).toString(16).padStart(2, '0')}`;
        root.style.setProperty('--theme-surface-2', card2Hex);
        
        root.style.setProperty('--theme-line', 'rgba(255, 255, 255, 0.12)');
        root.style.setProperty('--theme-mat', 'rgba(255, 255, 255, 0.05)');
      }
    };

    applyCustomThemeAndColors(customBgColor);
    localStorage.setItem('app:customBgColor', customBgColor);
  }, [customBgColor]);

  // Sync layout width preferences
  useEffect(() => {
    localStorage.setItem('app:layoutWidth', layoutWidth);
  }, [layoutWidth]);

  // Fetch players when a competition is selected
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    
    if (compId) {
      unsubscribe = subscribeToPlayersForComp(compId, (cloudPlayers) => {
        let loadedPlayers = cloudPlayers;
        if (loadedPlayers.length === 0) {
          const storedPlayers = localStorage.getItem(`app:players:${compId}`);
          if (storedPlayers) {
            try {
              loadedPlayers = JSON.parse(storedPlayers);
              // Sync to cloud
              for (const p of loadedPlayers) {
                savePlayerToFirestore(p).catch(err => console.warn("Failed to sync player to cloud:", err));
              }
            } catch (e) {
              console.error("Failed to parse players for comp", compId, e);
            }
          }
        }
        setPlayers(loadedPlayers);
        localStorage.setItem(`app:players:${compId}`, JSON.stringify(loadedPlayers));
        
        const storedStaff = localStorage.getItem(`app:staffPasses:${compId}`);
        if (storedStaff) {
          try {
            setStaffPasses(JSON.parse(storedStaff));
          } catch (e) {}
        } else {
          setStaffPasses([]);
        }
      }, (err) => {
        console.error("Failed to sync players", err);
      });
    } else {
      setPlayers([]);
    }
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [compId]);

  // Fetch referees dynamically based on role and compId
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    if (compId) {
      // Real-time synchronization of all tournament referees for RIC, Organizers, and Court Panels
      unsubscribe = subscribeToRefereesForComp(compId, (cloudReferees) => {
        setReferees(cloudReferees);
        if (role === 'referee' && user) {
          const cleanUser = user.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          const matched = cloudReferees.find(r => r.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanUser);
          if (matched) setActiveReferee(matched);
        }
      }, (err) => console.error("Failed to sync referees", err));
    } else if (role === 'referee' && user) {
      const cleanUser = user.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      unsubscribe = subscribeToMyReferees(cleanUser, (myReferees) => {
        setReferees(myReferees);
        const matched = myReferees[0];
        if (matched) setActiveReferee(matched);
      }, (err) => console.error("Failed to sync my referees", err));
    } else {
      setReferees([]);
    }
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [compId, role, user]);

  // --- NOTIFICATION HELPER ---
  const triggerMsg = (text: string, type: 'error' | 'ok') => {
    setMsg({ text, type });
    setTimeout(() => {
      setMsg(prev => prev?.text === text ? null : prev);
    }, 3500);
  };

  // --- SAVE HELPERS ---
  const saveCompsToStorage = async (list: Competition[]) => {
    const prevComps = [...competitions];
    setCompetitions(list);
    localStorage.setItem('app:competitions', JSON.stringify(list));
    
    // Cloud sync
    try {
      if (prevComps.length === 0) {
        // Initial sync of all competitions
        for (const c of list) {
          await saveCompetition(c);
        }
      } else {
        // Find if any competition was deleted
        const deletedComp = prevComps.find(c => !list.some(l => l.id === c.id));
        if (deletedComp) {
          await deleteCompetition(deletedComp.id);
        } else {
          // Find any added or changed competitions
          const changedComps = list.filter(c => {
            const prev = prevComps.find(pc => pc.id === c.id);
            return !prev || JSON.stringify(prev) !== JSON.stringify(c);
          });
          
          for (const c of changedComps) {
            await saveCompetition(c);
          }
        }
      }
    } catch (error) {
      console.error("Cloud sync failed:", error);
      let errMsg = '';
      if (error instanceof Error) {
        try {
          const parsed = JSON.parse(error.message);
          errMsg = parsed.error || error.message;
        } catch {
          errMsg = error.message;
        }
      } else {
        errMsg = String(error);
      }
      triggerMsg('Cloud save failed: ' + errMsg, 'error');
      throw error;
    }
  };

  const handleUpdateBankDetails = async (bankName: string, bankAccount: string, qrCodeBase64?: string) => {
    if (!compId) return;
    const updatedComps = competitions.map(c => {
      if (c.id === compId) {
        return {
          ...c,
          bankName: String(bankName || '').trim(),
          bankAccount: String(bankAccount || '').trim(),
          bankQrCode: qrCodeBase64 !== undefined ? qrCodeBase64 : c.bankQrCode
        };
      }
      return c;
    });
    try {
      await saveCompsToStorage(updatedComps);
      triggerMsg('Bank and QR details updated successfully.', 'ok');
    } catch (e) {
      // Error is handled/displayed in saveCompsToStorage
    }
  };

  const handleUpdateEventFees = async (kyorugi: string, poomsae: string, para: string, virtual: string) => {
    if (!compId) return;
    const updatedComps = competitions.map(c => {
      if (c.id === compId) {
        return {
          ...c,
          kyorugiFee: String(kyorugi || '').trim(),
          poomsaeFee: String(poomsae || '').trim(),
          paraFee: String(para || '').trim(),
          virtualFee: String(virtual || '').trim()
        };
      }
      return c;
    });
    try {
      await saveCompsToStorage(updatedComps);
      setFeeUpdateSuccess(true);
      setTimeout(() => setFeeUpdateSuccess(false), 3000);
    } catch (e) {
      // Error is handled/displayed in saveCompsToStorage
    }
  };

  const handleUploadReceipt = async (clubName: string, receiptBase64: string) => {
    if (!compId) return;
    const clubKey = clubName.toUpperCase();
    const updatedComps = competitions.map(c => {
      if (c.id === compId) {
        const existingReceipts = c.receipts || {};
        return {
          ...c,
          receipts: {
            ...existingReceipts,
            [clubKey]: {
              receiptUrl: receiptBase64,
              uploadedAt: new Date().toLocaleDateString('en-MY', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })
            }
          }
        };
      }
      return c;
    });
    await saveCompsToStorage(updatedComps);
    triggerMsg('Payment receipt uploaded successfully!', 'ok');
  };

  const saveCoachesToStorage = async (obj: Record<string, Coach>) => {
    const prevCoaches = { ...coaches };
    setCoaches(obj);
    localStorage.setItem('app:coaches', JSON.stringify(obj));
    
    // Cloud sync
    try {
      if (Object.keys(prevCoaches).length === 0) {
        const savePromises = Object.keys(obj).map((username) =>
          saveCoach({ ...obj[username], username })
        );
        await Promise.all(savePromises);
      } else {
        // Find deleted
        const deletedUsernames = Object.keys(prevCoaches).filter(u => !(u in obj));
        for (const username of deletedUsernames) {
          await deleteCoach(username);
        }
        
        // Find changed/added
        const changedUsernames = Object.keys(obj).filter(u => {
          const prev = prevCoaches[u];
          return !prev || JSON.stringify(prev) !== JSON.stringify(obj[u]);
        });
        
        const savePromises = changedUsernames.map(username => 
          saveCoach({ ...obj[username], username })
        );
        await Promise.all(savePromises);
      }
    } catch (error) {
      console.error("Cloud sync for coaches failed:", error);
    }
  };

  const saveOrganizersToStorage = async (obj: Record<string, Organizer>) => {
    const prevOrganizers = { ...organizers };
    setOrganizers(obj);
    localStorage.setItem('app:organizers', JSON.stringify(obj));
    
    // Cloud sync
    try {
      if (Object.keys(prevOrganizers).length === 0) {
        const savePromises = Object.keys(obj).map((username) =>
          saveOrganizer({ ...obj[username], username })
        );
        await Promise.all(savePromises);
      } else {
        // Find deleted
        const deletedUsernames = Object.keys(prevOrganizers).filter(u => !(u in obj));
        for (const username of deletedUsernames) {
          await deleteOrganizer(username);
        }
        
        // Find changed/added
        const changedUsernames = Object.keys(obj).filter(u => {
          const prev = prevOrganizers[u];
          return !prev || JSON.stringify(prev) !== JSON.stringify(obj[u]);
        });
        
        const savePromises = changedUsernames.map(username => 
          saveOrganizer({ ...obj[username], username })
        );
        await Promise.all(savePromises);
      }
    } catch (error) {
      console.error("Cloud sync for organizers failed:", error);
    }
  };

  const saveStaffPassesToStorage = (id: string, list: Player[]) => {
    setStaffPasses(list);
    localStorage.setItem(`app:staffPasses:${id}`, JSON.stringify(list));
  };

  const savePlayersToStorage = async (id: string, list: Player[]) => {
    const prevPlayers = [...players];
    setPlayers(list);
    localStorage.setItem(`app:players:${id}`, JSON.stringify(list));
    
    // Cloud sync
    try {
      const prevCompPlayers = prevPlayers.filter(p => p.compId === id);
      
      if (prevCompPlayers.length === 0 && list.length > 5) {
        // Initial bulk save or bulk import
        const savePromises = list.map((p) => savePlayerToFirestore(p));
        await Promise.all(savePromises);
      } else {
        // Find deleted
        const deletedPlayer = prevCompPlayers.find(p => !list.some(l => l.id === p.id));
        if (deletedPlayer) {
          await deletePlayerFromFirestore(deletedPlayer.id);
        } else {
          // Find changed or added
          const changedPlayers = list.filter(p => {
            const prev = prevCompPlayers.find(pl => pl.id === p.id);
            return !prev || JSON.stringify(prev) !== JSON.stringify(p);
          });
          
          if (changedPlayers.length > 0) {
            const savePromises = changedPlayers.map(p => savePlayerToFirestore(p));
            await Promise.all(savePromises);
          }
        }
      }
    } catch (error) {
      console.error("Cloud sync for players failed:", error);
    }
  };

  const saveMasterAthletesToStorage = async (obj: Record<string, Partial<Player>>) => {
    const prevMaster = { ...masterAthletes };
    setMasterAthletes(obj);
    localStorage.setItem('app:masterAthletes', JSON.stringify(obj));
    
    // Cloud sync
    try {
      if (Object.keys(prevMaster).length === 0) {
        const savePromises = Object.keys(obj).map((id) =>
          saveMasterAthlete({ ...obj[id], id })
        );
        await Promise.all(savePromises);
      } else {
        // Find deleted
        const deletedIds = Object.keys(prevMaster).filter(id => !(id in obj));
        for (const id of deletedIds) {
          await deleteMasterAthlete(id);
        }
        
        // Find changed/added
        const changedIds = Object.keys(obj).filter(id => {
          const prev = prevMaster[id];
          return !prev || JSON.stringify(prev) !== JSON.stringify(obj[id]);
        });
        
        const savePromises = changedIds.map(id => 
          saveMasterAthlete({ ...obj[id], id })
        );
        await Promise.all(savePromises);
      }
    } catch (error) {
      console.error("Cloud sync for master athletes failed:", error);
    }
  };


  // --- QR SCANNER EFFECT ---
  useEffect(() => {
    if (scanning) {
      let active = true;
      const startCamera = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
          });
          if (!active) {
            stream.getTracks().forEach(t => t.stop());
            return;
          }
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.setAttribute('playsinline', 'true');
            videoRef.current.play().then(() => {
              const tick = () => {
                if (!active || !scanning) return;
                const video = videoRef.current;
                if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
                  const canvas = document.createElement('canvas');
                  canvas.width = video.videoWidth;
                  canvas.height = video.videoHeight;
                  const ctx = canvas.getContext('2d');
                  if (ctx) {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const code = jsQR(imgData.data, imgData.width, imgData.height);
                    if (code && code.data) {
                      handleQRScanned(code.data);
                      return;
                    }
                  }
                }
                scanRequestRef.current = requestAnimationFrame(tick);
              };
              scanRequestRef.current = requestAnimationFrame(tick);
            }).catch(e => console.error("Video play failed", e));
          }
        } catch (err: any) {
          triggerMsg(`Camera access failed: ${err.message || err}`, 'error');
          setScanning(false);
        }
      };
      startCamera();

      return () => {
        active = false;
        if (scanRequestRef.current) {
          cancelAnimationFrame(scanRequestRef.current);
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }
      };
    }
  }, [scanning]);

  const handleQRScanned = (data: string) => {
    setScanning(false);
    const parts = data.split('::');
    const scannedId = parts.length === 2 ? parts[1] : data;
    lookupPlayer(scannedId);
  };

  const lookupPlayer = (playerIdOrQR: string) => {
    const cleaned = playerIdOrQR.trim();
    const parts = cleaned.split('::');
    const targetId = parts.length === 2 ? parts[1].trim() : cleaned;

    const p = players.find(pl => pl.id.toUpperCase() === targetId.toUpperCase());
    if (!p) {
      triggerMsg(`Player/QR code "${targetId}" not registered for this competition.`, 'error');
      return;
    }
    setScanResult(p.id);
    setActualWeightInput(p.weighIn ? p.weighIn.weight.toString() : '');
    triggerMsg(`Profile unlocked: ${p.name}`, 'ok');
  };

  // --- AUTHENTICATION ACTIONS ---
  const handleOrganizerLogin = () => {
    const u = cUser.trim();
    const p = cPass;
    const acc = organizers[u];
    if (!acc || acc.password !== p) {
      triggerMsg('Invalid username or password.', 'error');
      return;
    }
    if (!acc.compId) {
      triggerMsg('No tournament assigned to this organizer account.', 'error');
      return;
    }
    setRole('organizer');
    setUser(u);
    setCompId(acc.compId);
    setScreen('organizerDashboard');
    triggerMsg(`Welcome, Organizer ${acc.name}!`, 'ok');
  };

  const handleRecoverPassword = () => {
    setRecoveredPassword(null);
    const cname = fpName.trim().toLowerCase();
    const cphone = fpPhone.trim().replace(/[^0-9]/g, '');

    if (!fpName.trim() || !fpPhone.trim()) {
      triggerMsg('Registered Name and Phone Number are required.', 'error');
      return;
    }

    let foundPass = null;

    // Check coaches
    if (fpUsername.trim()) {
      const uname = fpUsername.trim().toLowerCase();
      const matchedCoach = Object.values(coaches).find(c => 
        c.username?.toLowerCase() === uname &&
        c.name.toLowerCase() === cname &&
        (c.phone || '').replace(/[^0-9]/g, '') === cphone
      );
      if (matchedCoach) {
        foundPass = matchedCoach.password;
      }
    }

    // Check referees
    if (!foundPass && fpNric.trim()) {
      const cnric = fpNric.trim().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const matchedRef = refereeAccounts.find(r =>
        r.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cnric &&
        r.fullName.toLowerCase() === cname &&
        r.phone.replace(/[^0-9]/g, '') === cphone
      );
      if (matchedRef) {
        foundPass = matchedRef.password;
      }
    }

    if (foundPass) {
      setRecoveredPassword(foundPass);
      triggerMsg('Account verified. Password recovered.', 'ok');
    } else {
      triggerMsg('No matching account found with these details.', 'error');
    }
  };

  const handleCoachLogin = () => {
    const u = cUser.trim();
    const p = cPass;
    const acc = coaches[u];
    if (!acc || acc.password !== p) {
      triggerMsg('Invalid username or password.', 'error');
      return;
    }
    if (!cComp) {
      triggerMsg('No active tournament selected.', 'error');
      return;
    }
    const targetComp = competitions.find(c => c.id === cComp);
    if (!targetComp || targetComp.isActive === false) {
      triggerMsg('The selected tournament is not active.', 'error');
      return;
    }
    setRole('coach');
    setUser(u);
    setScreen('coachRoster');
    setCompId(cComp);
    triggerMsg(`Welcome back, Coach ${acc.name}!`, 'ok');
  };

  const handlePublicLogin = () => {
    if (!cComp) {
      triggerMsg('No active tournament selected.', 'error');
      return;
    }
    const targetComp = competitions.find(c => c.id === cComp);
    if (!targetComp || targetComp.isActive === false) {
      triggerMsg('The selected tournament is not active.', 'error');
      return;
    }
    if (targetComp && targetComp.publicViewPassword) {
      if (publicPassInput !== targetComp.publicViewPassword) {
        triggerMsg('Invalid public access password.', 'error');
        return;
      }
    }
    setRole('public');
    setUser('Guest');
    setCompId(cComp);
    setScreen('publicView');
    triggerMsg('Viewing tournament public directory.', 'ok');
  };

  const handleUpdatePublicViewPassword = (password: string) => {
    if (!compId) return;
    const updated = competitions.map(c => c.id === compId ? { ...c, publicViewPassword: password } : c);
    saveCompsToStorage(updated);
    triggerMsg('Public View access password updated.', 'ok');
  };

  const handleRefereeLogin = () => {
    const ic = refereeLoginNric.trim();
    if (!ic) {
      triggerMsg('Please enter your NRIC Number.', 'error');
      return;
    }
    const cleanIc = ic.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    // Check global referee accounts first
    const account = refereeAccounts.find(a => a.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanIc);
    if (account) {
      if (account.password && account.password !== refereeLoginPassword) {
        triggerMsg('Invalid NRIC or Password.', 'error');
        return;
      }
      
      setRole('referee');
      setUser(account.nric);
      
      const userRefs = referees.filter(r => r.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanIc);
      const lastCompId = localStorage.getItem(`lastCompId_${cleanIc}`);
      const lastRef = lastCompId ? userRefs.find(r => r.compId === lastCompId) : null;

      if (lastRef) {
        setCompId(lastRef.compId);
        setActiveReferee(lastRef);
      } else if (userRefs.length === 1) {
        setCompId(userRefs[0].compId);
        setActiveReferee(userRefs[0]);
      } else {
        setCompId(null);
        setActiveReferee({
          ...account,
          id: `TEMP_GLOBAL_${cleanIc}`,
          compId: 'GLOBAL',
        });
      }
      setScreen('refereeDashboard');
      triggerMsg(`Welcome, Referee ${account.fullName}!`, 'ok');
      return;
    }

    // Fallback/Legacy lookup
    const legacyMatched = referees.find(r => r.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanIc);
    if (!legacyMatched) {
      triggerMsg('No referee account found with this NRIC. Please register first.', 'error');
      return;
    }

    // Create a referee account on the fly for them from their legacy tournament registration!
    saveRefereeAccount(legacyMatched);
    setRole('referee');
    setUser(legacyMatched.nric);
    
    const userRefsLegacy = referees.filter(r => r.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanIc);
    const lastCompIdLegacy = localStorage.getItem(`lastCompId_${cleanIc}`);
    const lastRefLegacy = lastCompIdLegacy ? userRefsLegacy.find(r => r.compId === lastCompIdLegacy) : null;

    if (lastRefLegacy) {
      setCompId(lastRefLegacy.compId);
      setActiveReferee(lastRefLegacy);
    } else if (userRefsLegacy.length === 1) {
      setCompId(userRefsLegacy[0].compId);
      setActiveReferee(userRefsLegacy[0]);
    } else {
      setCompId(null);
      setActiveReferee({
        ...legacyMatched,
        id: `TEMP_GLOBAL_${cleanIc}`,
        compId: 'GLOBAL',
      });
    }
    setScreen('refereeDashboard');
    triggerMsg(`Welcome, Referee ${legacyMatched.fullName}!`, 'ok');
  };

  const handleRicLogin = () => {
    const ic = ricLoginNric.trim();
    if (!ic) {
      triggerMsg('Please enter your registered NRIC Number.', 'error');
      return;
    }
    const cleanIc = ic.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    // Look up global referee accounts first, then fallback to registered referees
    let account = refereeAccounts.find(a => a.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanIc);
    if (!account) {
      account = referees.find(r => r.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanIc);
    }

    if (!account) {
      triggerMsg('No referee account found with this NRIC.', 'error');
      return;
    }

    if (account.password && account.password !== ricLoginPassword) {
      triggerMsg('Invalid NRIC or Password.', 'error');
      return;
    }

    // Verify special role set by admin/organizer
    if (account.specialRole !== 'RIC') {
      triggerMsg('Access Denied: Your account is not designated as Referee-in-Charge (RIC) by the administrator.', 'error');
      return;
    }

    // Strict Enforcement of Assigned Tournament Event set by Admin
    const assignedCompId = account.compId;
    if (assignedCompId && assignedCompId !== 'GLOBAL') {
      const assignedComp = competitions.find(c => c.id === assignedCompId);
      if (!assignedComp || assignedComp.isActive === false) {
        triggerMsg(`Access Denied: Your assigned tournament event (${assignedComp?.name || assignedCompId}) is currently inactive or not available.`, 'error');
        return;
      }

      // If user selected a different tournament in the login dropdown, enforce restriction
      if (ricLoginComp && ricLoginComp !== assignedCompId) {
        triggerMsg(`Access Denied: As RIC, you are only authorized to enter your Assigned Tournament Event (${assignedComp.name}) set by Admin.`, 'error');
        return;
      }

      setCompId(assignedCompId);
      const userRef = referees.find(r => r.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanIc && r.compId === assignedCompId);
      setActiveReferee(userRef || {
        ...account,
        id: `${assignedCompId}_${cleanIc}`,
        compId: assignedCompId,
      });
    } else {
      // Global RIC access or unassigned
      const targetCompId = ricLoginComp || (competitions.filter(c => c.isActive !== false)[0]?.id) || null;
      setCompId(targetCompId);
      const userRef = referees.find(r => r.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanIc && r.compId === targetCompId);
      setActiveReferee(userRef || {
        ...account,
        id: targetCompId ? `${targetCompId}_${cleanIc}` : `ACC_${cleanIc}`,
        compId: targetCompId || 'GLOBAL',
      });
    }

    setRole('referee');
    setUser(account.nric);
    setScreen('ricDashboard');

    const activeCompName = competitions.find(c => c.id === (assignedCompId && assignedCompId !== 'GLOBAL' ? assignedCompId : ricLoginComp))?.name;
    triggerMsg(`Welcome, Referee-in-Charge ${account.fullName}! ${activeCompName ? `Unlocked: ${activeCompName}` : ''}`, 'ok');
  };

  const handleAdminSaveRicAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminRicName.trim() || !adminRicNric.trim()) {
      triggerMsg('Full Name and NRIC/Username are required.', 'error');
      return;
    }
    const cleanNric = adminRicNric.trim();
    const cleanIc = cleanNric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const existingIndex = refereeAccounts.findIndex(r => r.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanIc);

    let updatedAccount: Referee;
    if (existingIndex >= 0) {
      const old = refereeAccounts[existingIndex];
      updatedAccount = {
        ...old,
        fullName: adminRicName.trim(),
        nric: cleanNric,
        password: adminRicPassword.trim() || old.password,
        phone: adminRicPhone.trim() || old.phone,
        specialRole: 'RIC',
        compId: adminRicCompId || old.compId || 'GLOBAL',
      };
    } else {
      if (!adminRicPassword.trim()) {
        triggerMsg('Password is required for new RIC accounts.', 'error');
        return;
      }
      updatedAccount = {
        id: `REF_ACC_${Date.now()}`,
        fullName: adminRicName.trim(),
        nric: cleanNric,
        password: adminRicPassword.trim(),
        phone: adminRicPhone.trim() || '+60123456789',
        clubName: 'REFEREE-IN-CHARGE',
        residentialLocation: 'HQ',
        distance: 0,
        bankName: 'N/A',
        bankAccount: 'N/A',
        accommodation: 'No',
        carPlate: 'N/A',
        kyorugiStatus: 'IR',
        poomsaeStatus: 'IR',
        specialRole: 'RIC',
        compId: adminRicCompId || 'GLOBAL',
        createdAt: new Date().toISOString()
      };
    }

    try {
      await saveRefereeAccount(updatedAccount);
      const newAccounts = existingIndex >= 0
        ? refereeAccounts.map((a, idx) => idx === existingIndex ? updatedAccount : a)
        : [...refereeAccounts, updatedAccount];

      setRefereeAccounts(newAccounts);

      // Also update active registered referees if exists
      const updatedRefs = referees.map(r => {
        if (r.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanIc) {
          return {
            ...r,
            fullName: updatedAccount.fullName,
            password: updatedAccount.password,
            specialRole: 'RIC' as const,
          };
        }
        return r;
      });
      setReferees(deduplicateReferees(updatedRefs));

      setAdminRicName('');
      setAdminRicNric('');
      setAdminRicPassword('');
      setAdminRicPhone('');
      setAdminRicCompId('');
      setEditingRicNric(null);

      triggerMsg(`RIC account credentials for ${updatedAccount.fullName} saved successfully.`, 'ok');
    } catch (err: any) {
      console.error(err);
      triggerMsg(`Failed to save RIC account: ${err.message || err}`, 'error');
    }
  };

  const handleRefereeRegister = async () => {
    const name = refereeFullName.trim();
    const ic = refereeNric.trim();
    const password = refereePassword.trim();
    const phone = refereePhone.trim();
    const club = refereeClubName.trim();
    const resLocation = refereeResidential.trim();
    
    // Parse distance as compulsory
    const distVal = parseFloat(refereeDistance);
    const bank = refereeBankName.trim();
    const account = refereeBankAccount.trim();
    const plate = refereeCarPlate.trim();

    if (!name || !ic || !password || !phone || !club || !resLocation || refereeDistance.trim() === '' || !bank || !account || !refereeKyorugiStatus || !refereePoomsaeStatus) {
      triggerMsg('Please fill in all required (*) fields including your password.', 'error');
      return;
    }
    if (password.length < 6) {
      triggerMsg('Password must be at least 6 characters long.', 'error');
      return;
    }
    if (!pendingPhoto) {
      triggerMsg('Please upload your Portrait Photograph. It is compulsory.', 'error');
      return;
    }
    if (isNaN(distVal) || distVal < 0) {
      triggerMsg('Please enter a valid number for Distance to Venue.', 'error');
      return;
    }
    if (!refereeConsent) {
      triggerMsg('You must agree to the PDPA consent statement to register.', 'error');
      return;
    }

    const cleanIc = ic.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const accounts = await fetchRefereeAccounts();
    const alreadyExists = accounts.some(a => a.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanIc);
    if (alreadyExists) {
      triggerMsg('A referee account with this NRIC is already registered.', 'error');
      return;
    }

    const newRef: Referee = {
      id: `GLOBAL_${ic.replace(/[^a-zA-Z0-9]/g, '')}`,
      compId: 'GLOBAL',
      fullName: name,
      nric: ic,
      password: password,
      phone: phone,
      clubName: club,
      residentialLocation: resLocation,
      distance: distVal,
      bankName: bank,
      bankAccount: account,
      accommodation: refereeAccommodation,
      kyorugiStatus: refereeKyorugiStatus,
      poomsaeStatus: refereePoomsaeStatus,
      carPlate: plate,
      photo: pendingPhoto,
      specialRole: refereeSpecialRole,
      createdAt: new Date().toISOString()
    };

    try {
      await saveRefereeAccount(newRef);
      setRole('referee');
      setUser(newRef.nric);
      setCompId(null);
      setActiveReferee({
        ...newRef,
        id: `TEMP_GLOBAL_${cleanIc}`,
        compId: 'GLOBAL',
      });
      setScreen('refereeDashboard');
      triggerMsg(`Registration successful! Welcome, Referee ${name}!`, 'ok');

      setRefereeFullName('');
      setRefereeNric('');
      setRefereePhone('');
      setRefereeClubName('');
      setRefereeResidential('');
      setRefereeDistance('');
      setRefereeBankName('');
      setRefereeBankAccount('');
      setRefereeAccommodation('No');
      setRefereeKyorugiStatus('TR');
      setRefereePoomsaeStatus('TR');
      setRefereeCarPlate('');
      setRefereeSpecialRole('None');
      setRefereeConsent(false);
      setPendingPhoto(null);
    } catch (e: any) {
      console.error(e);
      const errMsg = e instanceof Error ? e.message : String(e);
      triggerMsg(`Failed to complete registration: ${errMsg}`, 'error');
    }
  };

  const handleOpenOrganizerAddReferee = () => {
    setAddRefereeModalTab('existing');
    setSelectedExistingRefereeNrics([]);
    setSearchRegisteredQuery('');
    setRefereeFullName('');
    setRefereeNric('');
    setRefereePhone('');
    setRefereeClubName('');
    setRefereeResidential('');
    setRefereeDistance('');
    setRefereeBankName('');
    setRefereeBankAccount('');
    setRefereeAccommodation('No');
    setRefereeKyorugiStatus('TR');
    setRefereePoomsaeStatus('TR');
    setRefereeCarPlate('');
    setRefereeSpecialRole('None');
    setRefereeConsent(false);
    setShowOrganizerAddReferee(true);
  };
  
  const handleOrganizerAddExistingReferee = async () => {
    if (!compId) {
      triggerMsg('No active tournament selected.', 'error');
      return;
    }
    if (selectedExistingRefereeNrics.length === 0) {
      triggerMsg('Please select at least one referee from the list.', 'error');
      return;
    }

    const selectedAccs = refereeAccounts.filter(a =>
      selectedExistingRefereeNrics.some(nric => 
        a.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
      )
    );

    if (selectedAccs.length === 0) {
      triggerMsg('Selected referee account(s) not found.', 'error');
      return;
    }

    let addedCount = 0;
    const errors: string[] = [];

    for (const selectedAcc of selectedAccs) {
      const cleanIc = selectedAcc.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const alreadyExists = referees.some(r => r.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanIc && r.compId === compId);
      if (alreadyExists) {
        errors.push(`${selectedAcc.fullName} is already registered`);
        continue;
      }

      const tournamentRef: Referee = {
        ...selectedAcc,
        id: `${compId}_${cleanIc}`,
        compId: compId,
        specialRole: refereeSpecialRole,
        createdAt: new Date().toISOString()
      };

      // Remove old tournament-specific fields if any existed in the profile
      delete tournamentRef.officiatingDays;
      delete tournamentRef.kyorugiDays;
      delete tournamentRef.poomsaeDays;
      delete tournamentRef.virtualDays;

      try {
        await saveRefereeToFirestore(tournamentRef);
        addedCount++;
      } catch (e: any) {
        console.error(e);
        errors.push(`Failed to add ${selectedAcc.fullName}`);
      }
    }

    if (addedCount > 0) {
      setShowOrganizerAddReferee(false);
      triggerMsg(`Successfully added ${addedCount} referee(s) to tournament`, 'ok');
    } else if (errors.length > 0) {
      triggerMsg(errors.join(', '), 'error');
    }
  };

  const handleOrganizerSaveNewReferee = async () => {
    if (!compId) return;
    const name = refereeFullName.trim();
    const ic = refereeNric.trim();
    const phone = refereePhone.trim();
    const club = refereeClubName.trim();
    const resLocation = refereeResidential.trim();
    
    const distVal = parseFloat(refereeDistance as string);
    const bank = refereeBankName.trim();
    const account = refereeBankAccount.trim();
    const plate = refereeCarPlate.trim();

    if (!name || !ic || !phone || !club || !resLocation || refereeDistance.toString().trim() === '' || !bank || !account || !refereeKyorugiStatus || !refereePoomsaeStatus) {
      triggerMsg('Please fill in all required (*) fields with valid values.', 'error');
      return;
    }
    if (isNaN(distVal) || distVal < 0) {
      triggerMsg('Please enter a valid number for Distance to Venue.', 'error');
      return;
    }

    const cleanIc = ic.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const alreadyExists = referees.some(r => r.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanIc && r.compId === compId);
    if (alreadyExists) {
      triggerMsg('A referee with this NRIC is already registered for this tournament.', 'error');
      return;
    }

    const newRef: Referee = {
      id: `${compId}_${ic.replace(/[^a-zA-Z0-9]/g, '')}`,
      compId: compId,
      fullName: name,
      nric: ic,
      phone: phone,
      clubName: club,
      residentialLocation: resLocation,
      distance: distVal,
      bankName: bank,
      bankAccount: account,
      accommodation: refereeAccommodation,
      kyorugiStatus: refereeKyorugiStatus,
      poomsaeStatus: refereePoomsaeStatus,
      carPlate: plate,
      specialRole: refereeSpecialRole,
      createdAt: new Date().toISOString()
    };

    try {
      await saveRefereeToFirestore(newRef);
      await saveRefereeAccount(newRef);
      setShowOrganizerAddReferee(false);
      triggerMsg(`Added new referee ${name}`, 'ok');
    } catch (e: any) {
      console.error(e);
      triggerMsg(`Failed to add referee: ${e.message || String(e)}`, 'error');
    }
  };

  const handleCoachSignup = () => {
    const u = sUser.trim();
    const p = sPass;
    const name = sName.trim();
    const club = sClub.trim();
    const phone = sPhone.trim();
    const email = sEmail.trim();
    if (!u || !p || !name || !club || !phone || !email) {
      triggerMsg('Please fill in every registration field.', 'error');
      return;
    }
    if (coaches[u]) {
      triggerMsg('Username already taken.', 'error');
      return;
    }
    const updated = { ...coaches, [u]: { password: p, name, club, phone, email } };
    saveCoachesToStorage(updated);
    setRole('coach');
    setUser(u);
    setScreen('coachHome'); // Maybe they can still go to coachHome or they should select there. Oh wait, if they sign up, they don't have a dropdown on signup screen, so they can go to coachHome or we can add a dropdown there too. Let's send them to coachHome and let them pick there? Or wait, let's keep it coachHome. The user asked "coach roster need to choose the active tournament before enter the roster dashboard" - actually this might just apply to the login screen.
    // wait, what if we keep coachHome? Yes, they can click "Back to tournaments" to go to coachHome.
    setCompId(null);
    triggerMsg('Account successfully created!', 'ok');
  };

  const handleOfficialLogin = () => {
    if (!oComp) {
      triggerMsg('No active competition selected.', 'error');
      return;
    }
    const targetComp = competitions.find(c => c.id === oComp);
    if (!targetComp || targetComp.isActive === false) {
      triggerMsg('The selected tournament is not active.', 'error');
      return;
    }
    if (targetComp.staffCode !== oCode) {
      triggerMsg('Incorrect staff passcode.', 'error');
      return;
    }
    setRole('official');
    setUser('official');
    setCompId(oComp);
    setScreen('officialScan');
    triggerMsg('Weigh-in Station terminal unlocked.', 'ok');
  };

  const handleAdminLogin = () => {
    if (aUser.trim() !== 'admin' || aPass !== adminPassword) {
      triggerMsg('Invalid administrative credentials.', 'error');
      return;
    }
    setRole('admin');
    setUser('admin');
    setScreen('adminHome');
    setCompId(null);
    triggerMsg('Admin terminal session authorized.', 'ok');
  };

  const handleAdminEditCoach = (username: string, coach: Coach) => {
    setEditingCoachUsername(username);
    setEditCoachName(coach.name);
    setEditCoachClub(coach.club);
    setEditCoachPass(coach.password || '');
    setEditCoachPhone(coach.phone || '');
    setEditCoachEmail(coach.email || '');
  };

  const handleAdminSaveCoach = () => {
    if (!editingCoachUsername) return;
    if (!editCoachName.trim() || !editCoachClub.trim() || !editCoachPass) {
      triggerMsg('Please fill in Name, Club, and Password.', 'error');
      return;
    }
    const updated = {
      ...coaches,
      [editingCoachUsername]: {
        password: editCoachPass,
        name: editCoachName.trim(),
        club: editCoachClub.trim(),
        phone: editCoachPhone.trim() || undefined,
        email: editCoachEmail.trim() || undefined
      }
    };
    saveCoachesToStorage(updated);
    setEditingCoachUsername(null);
    triggerMsg('Coach account updated successfully.', 'ok');
  };

  const handleAdminCreateCoach = async () => {
    const u = newCoachUsername.trim();
    const p = newCoachPass.trim();
    const name = newCoachName.trim();
    const club = newCoachClub.trim();
    const phone = newCoachPhone.trim();
    const email = newCoachEmail.trim();

    if (!u || !p || !name || !club) {
      triggerMsg('Username, Password, Full Name, and Club are required.', 'error');
      return;
    }
    if (coaches[u]) {
      triggerMsg(`Coach username "${u}" already exists.`, 'error');
      return;
    }

    const newCoachObj: Coach = {
      username: u,
      password: p,
      name,
      club,
      phone: phone || undefined,
      email: email || undefined
    };

    const updated = { ...coaches, [u]: newCoachObj };
    try {
      await saveCoach(newCoachObj);
      await saveCoachesToStorage(updated);
      setNewCoachUsername('');
      setNewCoachPass('');
      setNewCoachName('');
      setNewCoachClub('');
      setNewCoachPhone('');
      setNewCoachEmail('');
      setShowAdminAddCoach(false);
      triggerMsg(`Coach account "${u}" created successfully!`, 'ok');
    } catch (err) {
      console.error(err);
      triggerMsg('Failed to create coach account.', 'error');
    }
  };

  const handleAdminDeleteCoach = async (username: string) => {
    try {
      const updated = { ...coaches };
      delete updated[username];
      await deleteCoach(username);
      await saveCoachesToStorage(updated);
      setConfirmDeleteCoachUsername(null);
      triggerMsg(`Coach account "${username}" has been permanently deleted.`, 'ok');
    } catch (err) {
      console.error(err);
      triggerMsg('Failed to delete coach account. Please try again.', 'error');
    }
  };

  const handleAdminCreateOrganizer = () => {
    const u = orgUsername.trim();
    if (!u || !orgPass || !orgName.trim() || !orgCompId) {
      triggerMsg('Please fill in all organizer fields.', 'error');
      return;
    }
    if (organizers[u]) {
      triggerMsg('Organizer username already exists.', 'error');
      return;
    }
    const updated = {
      ...organizers,
      [u]: {
        id: u,
        username: u,
        password: orgPass,
        name: orgName,
        compId: orgCompId
      }
    };
    saveOrganizersToStorage(updated);
    setOrgUsername('');
    setOrgPass('');
    setOrgName('');
    setOrgCompId('');
    triggerMsg('Organizer account created.', 'ok');
  };

  const handleAdminDeleteOrganizer = (username: string) => {
    const updated = { ...organizers };
    delete updated[username];
    saveOrganizersToStorage(updated);
    setConfirmDeleteOrganizerUsername(null);
    triggerMsg('Organizer account deleted.', 'ok');
  };

  const handleAdminSaveRefereeAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminRefName.trim() || !adminRefNric.trim() || !adminRefPhone.trim()) {
      triggerMsg('Name, NRIC, and Phone are required.', 'error');
      return;
    }
    if (!editingRefereeNric && !adminRefPassword.trim()) {
      triggerMsg('Password is required for new accounts.', 'error');
      return;
    }
    
    const distVal = parseFloat(adminRefDistance) || 0;
    
    const refAcc: Referee = {
      id: `ACC_${adminRefNric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`,
      compId: 'GLOBAL',
      fullName: adminRefName.trim(),
      nric: adminRefNric.trim(),
      password: adminRefPassword || undefined,
      phone: adminRefPhone.trim(),
      clubName: adminRefClub.trim(),
      residentialLocation: adminRefResidential.trim(),
      distance: distVal,
      bankName: adminRefBankName.trim(),
      bankAccount: adminRefBankAccount.trim(),
      accommodation: adminRefAccommodation,
      kyorugiStatus: adminRefKyorugi,
      poomsaeStatus: adminRefPoomsae,
      carPlate: adminRefCarPlate.trim(),
      specialRole: adminRefSpecialRole,
      createdAt: new Date().toISOString()
    };

    try {
      await saveRefereeAccount(refAcc);
      
      // Update any active tournament registrations for this referee
      const matchingTournaments = referees.filter(r => r.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === refAcc.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase());
      for (const tRef of matchingTournaments) {
        await saveRefereeToFirestore({
          ...tRef,
          fullName: refAcc.fullName,
          password: refAcc.password || tRef.password,
          phone: refAcc.phone,
          clubName: refAcc.clubName,
          residentialLocation: refAcc.residentialLocation,
          distance: refAcc.distance,
          bankName: refAcc.bankName,
          bankAccount: refAcc.bankAccount,
          accommodation: refAcc.accommodation,
          kyorugiStatus: refAcc.kyorugiStatus,
          poomsaeStatus: refAcc.poomsaeStatus,
          carPlate: refAcc.carPlate,
          specialRole: refAcc.specialRole
        });
      }
      triggerMsg(editingRefereeNric ? 'Referee account updated!' : 'Referee account created!', 'ok');
      
      setEditingRefereeNric(null);
      setAdminRefName('');
      setAdminRefNric('');
      setAdminRefPassword('');
      setAdminRefPhone('');
      setAdminRefClub('');
      setAdminRefResidential('');
      setAdminRefDistance('');
      setAdminRefBankName('');
      setAdminRefBankAccount('');
      setAdminRefAccommodation('No');
      setAdminRefKyorugi('TR');
      setAdminRefPoomsae('TR');
      setAdminRefCarPlate('');
      setAdminRefSpecialRole('None');
    } catch (err) {
      console.error(err);
      triggerMsg('Failed to save referee account.', 'error');
    }
  };

  const handleAdminDeleteRefereeAccount = async (nric: string) => {
    try {
      await deleteRefereeAccount(nric);
      setConfirmDeleteRefereeAccountNric(null);
      triggerMsg('Referee account deleted.', 'ok');
    } catch (err) {
      console.error(err);
      triggerMsg('Failed to delete referee account.', 'error');
    }
  };

  const handleOrgSaveRefereeAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgRefName.trim() || !orgRefNric.trim() || !orgRefPhone.trim()) {
      triggerMsg('Name, NRIC, and Phone are required.', 'error');
      return;
    }
    if (!orgEditingRefereeNric && !orgRefPassword.trim()) {
      triggerMsg('Password is required for new accounts.', 'error');
      return;
    }
    
    const distVal = parseFloat(orgRefDistance) || 0;
    const cleanIc = orgRefNric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    
    const refAcc: Referee = {
      id: `ACC_${cleanIc}`,
      compId: 'GLOBAL',
      fullName: orgRefName.trim(),
      nric: orgRefNric.trim(),
      password: orgRefPassword || undefined,
      phone: orgRefPhone.trim(),
      clubName: orgRefClub.trim(),
      residentialLocation: orgRefResidential.trim(),
      distance: distVal,
      bankName: orgRefBankName.trim(),
      bankAccount: orgRefBankAccount.trim(),
      accommodation: orgRefAccommodation,
      kyorugiStatus: orgRefKyorugi,
      poomsaeStatus: orgRefPoomsae,
      carPlate: orgRefCarPlate.trim(),
      specialRole: orgRefSpecialRole,
      createdAt: new Date().toISOString()
    };

    try {
      // 1. Save global account
      await saveRefereeAccount(refAcc);
      
      // 2. If organizer is inside an active tournament, also save to this tournament's ledger!
      if (compId) {
        // Find existing registration or create new
        const existingReg = referees.find(r => r.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanIc);
        const tournamentRef: Referee = {
          id: `${compId}_${cleanIc}`,
          compId: compId,
          fullName: orgRefName.trim(),
          nric: orgRefNric.trim(),
          password: refAcc.password || existingReg?.password,
          phone: orgRefPhone.trim(),
          clubName: orgRefClub.trim(),
          residentialLocation: orgRefResidential.trim(),
          distance: distVal,
          bankName: orgRefBankName.trim(),
          bankAccount: orgRefBankAccount.trim(),
          accommodation: orgRefAccommodation,
          kyorugiStatus: orgRefKyorugi,
          poomsaeStatus: orgRefPoomsae,
          carPlate: orgRefCarPlate.trim(),
          specialRole: orgRefSpecialRole,
          officiatingDays: existingReg?.officiatingDays || 1,
          includeOvertime: existingReg?.includeOvertime || false,
          includeOthers: existingReg?.includeOthers || false,
          createdAt: existingReg?.createdAt || new Date().toISOString()
        };
        await saveRefereeToFirestore(tournamentRef);
      }

      triggerMsg(orgEditingRefereeNric ? 'Referee account & tournament entry updated!' : 'Referee account created & assigned to tournament!', 'ok');
      
      // Reset form
      setOrgEditingRefereeNric(null);
      setOrgRefName('');
      setOrgRefNric('');
      setOrgRefPhone('');
      setOrgRefClub('');
      setOrgRefResidential('');
      setOrgRefDistance('');
      setOrgRefBankName('');
      setOrgRefBankAccount('');
      setOrgRefAccommodation('No');
      setOrgRefKyorugi('TR');
      setOrgRefPoomsae('TR');
      setOrgRefCarPlate('');
      setOrgRefSpecialRole('None');
    } catch (err) {
      console.error(err);
      triggerMsg('Failed to save referee account.', 'error');
    }
  };

  const handleOrgEditRefereeAccount = (refAcc: Referee) => {
    setOrgEditingRefereeNric(refAcc.nric);
    setOrgRefName(refAcc.fullName);
    setOrgRefNric(refAcc.nric);
    setOrgRefPassword(refAcc.password || '');
    setOrgRefPhone(refAcc.phone);
    setOrgRefClub(refAcc.clubName || '');
    setOrgRefResidential(refAcc.residentialLocation || '');
    setOrgRefDistance(refAcc.distance ? String(refAcc.distance) : '');
    setOrgRefBankName(refAcc.bankName || '');
    setOrgRefBankAccount(refAcc.bankAccount || '');
    setOrgRefAccommodation(refAcc.accommodation || 'No');
    setOrgRefKyorugi(refAcc.kyorugiStatus || 'TR');
    setOrgRefPoomsae(refAcc.poomsaeStatus || 'TR');
    setOrgRefCarPlate(refAcc.carPlate || '');
    setOrgRefSpecialRole(refAcc.specialRole || 'None');
  };

  const handleAdminChangePassword = () => {
    if (!newAdminPass) {
      triggerMsg('New password cannot be empty.', 'error');
      return;
    }
    if (newAdminPass !== confirmAdminPass) {
      triggerMsg('Passwords do not match.', 'error');
      return;
    }
    setAdminPassword(newAdminPass);
    localStorage.setItem('app:adminPassword', newAdminPass);
    saveAdminPasswordToFirestore(newAdminPass).catch(err => console.warn("Failed to sync new admin password:", err));
    setNewAdminPass('');
    setConfirmAdminPass('');
    triggerMsg('Administrative password updated successfully.', 'ok');
  };

  const logout = () => {
    setScanning(false);
    setRole(null);
    setUser(null);
    setCompId(null);
    setScreen('login');
    setSelectedPlayerId(null);
    setScanResult(null);
    setActiveReferee(null);
    setRefereeLoginNric('');
    // Reset forms
    setCUser(''); setCPass(''); setSUser(''); setSPass(''); setSName(''); setSClub(''); setOCode(''); setAPass('');
  };

  // --- ADMIN ACTIONS ---
  const handleCreateComp = () => {
    const name = ncName.trim();
    if (!name) {
      triggerMsg('Competition name is required.', 'error');
      return;
    }
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 16) + Date.now().toString(36).slice(-4);
    const newComp: Competition = {
      id,
      name,
      venue: ncVenue.trim() || 'TBD Venue',
      date: ncDate || new Date().toISOString().split('T')[0],
      endDate: ncEndDate || '',
      registrationCloseDate: ncRegistrationCloseDate || '',
      staffCode: ncCode || 'weighin123',
      events: ['Kyorugi', 'Para Kyorugi', 'Recognize Poomsae', 'Free Style Poomsae', 'Para Poomsae', 'Virtual Taekwondo'],
      genders: ['Male', 'Female', 'Mix'],
      ageGroups: [],
      weightClasses: [],
      isActive: false
    };
    const updated = [...competitions, newComp];
    saveCompsToStorage(updated);
    setCompId(id);
    setScreen('adminCompDetail');
    triggerMsg('Tournament configured successfully.', 'ok');
    // Clear form
    setNcName(''); setNcVenue(''); setNcDate(''); setNcEndDate(''); setNcRegistrationCloseDate(''); setNcCode('weighin123');
  };

  const handleToggleCompActive = (id: string) => {
    const updated = competitions.map(c => c.id === id ? { ...c, isActive: c.isActive === false ? true : false } : c);
    saveCompsToStorage(updated);
    triggerMsg('Tournament active status updated.', 'ok');
  };

  const handleAdminDeleteComp = async (id: string) => {
    const updated = competitions.filter(c => c.id !== id);
    await saveCompsToStorage(updated);
    if (compId === id) {
      setCompId(updated[0]?.id || null);
    }
    setConfirmDeleteCompId(null);
    triggerMsg('Competition event deleted successfully.', 'ok');
  };

  const handleUpdateStaffCode = (code: string) => {
    if (!compId) return;
    const updated = competitions.map(c => c.id === compId ? { ...c, staffCode: code } : c);
    saveCompsToStorage(updated);
    triggerMsg('Staff terminal access passcode updated.', 'ok');
  };

  const handleImportDemoRoster = () => {
    if (!compId) return;
    setConfirmImport(false);
    
    // Create necessary coach accounts
    const currentCoaches = { ...coaches };
    Object.entries(DEMO_IMPORT.clubs).forEach(([clubName, slug]) => {
      const username = `club_${slug}`;
      if (!currentCoaches[username]) {
        currentCoaches[username] = {
          password: 'changeme123',
          name: 'Coach ' + clubName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '),
          club: clubName
        };
      }
    });
    saveCoachesToStorage(currentCoaches);

    // Prepare players
    const currentPlayers = players.filter(p => p.importSource !== 'tmremaja2026-demo');
    const now = new Date().toISOString();
    
    DEMO_IMPORT.players.forEach((dp, i) => {
      const slug = DEMO_IMPORT.clubs[dp.club!];
      const coachUsername = `club_${slug}`;
      
      // Pad indices
      const codeStr = String(i + 1).padStart(3, '0');
      const customId = `TMR-${slug.slice(0, 3).toUpperCase()}-${codeStr}`;

      currentPlayers.push({
        id: customId,
        compId: compId,
        name: dp.name!,
        ic: '',
        dob: '',
        gender: dp.gender!,
        club: dp.club!,
        coachUsername,
        event: dp.event!,
        ageGroup: dp.ageGroup!,
        weightClass: dp.weightClass!,
        createdAt: now,
        weighIn: null,
        importSource: 'tmremaja2026-demo'
      });
    });

    savePlayersToStorage(compId, currentPlayers);
    triggerMsg(`Successfully imported ${DEMO_IMPORT.players.length} registered entries.`, 'ok');
  };

  const handleUpdateIdCardBgUrl = (url: string | null) => {
    if (!compId) return;
    const updated = competitions.map(c => c.id === compId ? { ...c, idCardBgUrl: url || undefined } : c);
    saveCompsToStorage(updated);
    if (!url) triggerMsg('ID card background removed.', 'ok');
  };

  const handleUploadIdCardBg = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !compId) return;
    if (file.size > 2 * 1024 * 1024) {
      triggerMsg('Image must be less than 2MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      handleUpdateIdCardBgUrl(dataUrl);
      triggerMsg('ID card background updated.', 'ok');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const getIdCardFields = (comp: Competition): import('./types').IdCardField[] => {
    const DEFAULT_FIELDS: import('./types').IdCardField[] = [
      { id: 'header', name: 'Header Banner', visible: true, order: 0, fontSize: 'sm', color: '#ffffff', align: 'center' },
      { id: 'photo', name: 'Athlete Portrait', visible: true, order: 1, fontSize: 'sm', align: 'center' },
      { id: 'name', name: 'Athlete Name', visible: true, order: 2, fontSize: 'lg', color: '#ffffff', align: 'center' },
      { id: 'club', name: 'Club / Team', visible: true, order: 3, fontSize: 'xs', color: '#a0aec0', align: 'center' },
      { id: 'athleteId', name: 'Athlete ID Badge', visible: true, order: 4, fontSize: 'xs', color: '#D4AF37', align: 'center' },
      { id: 'metadata', name: 'Metadata Grid', visible: true, order: 5, fontSize: 'sm', color: '#ffffff', align: 'center' },
      { id: 'qrcode', name: 'QR Code & Scan Info', visible: true, order: 6, fontSize: 'sm', color: '#D4AF37', align: 'left' },
      { id: 'belt', name: 'Belt Accent Strip', visible: true, order: 7, fontSize: 'sm', align: 'center' },
    ];
    if (!comp.idCardFields || comp.idCardFields.length === 0) {
      return DEFAULT_FIELDS;
    }
    const currentFields = [...comp.idCardFields];
    DEFAULT_FIELDS.forEach(df => {
      if (!currentFields.some(f => f.id === df.id)) {
        currentFields.push(df);
      }
    });
    return currentFields.map(f => ({
      ...f,
      align: f.align || (f.id === 'qrcode' ? 'left' : 'center')
    })).sort((a, b) => a.order - b.order);
  };

  const handleUpdateIdCardFields = (fields: import('./types').IdCardField[]) => {
    if (!compId) return;
    const updated = competitions.map(c => c.id === compId ? { ...c, idCardFields: fields } : c);
    saveCompsToStorage(updated);
  };

  const handleSwapFields = (draggedId: string, targetId: string) => {
    if (!compId || draggedId === targetId) return;
    const activeComp = competitions.find(c => c.id === compId);
    if (!activeComp) return;
    const fieldsList = getIdCardFields(activeComp);
    const draggedIdx = fieldsList.findIndex(f => f.id === draggedId);
    const targetIdx = fieldsList.findIndex(f => f.id === targetId);
    if (draggedIdx === -1 || targetIdx === -1) return;

    const newFields = [...fieldsList];
    // Swap order values
    const temp = newFields[draggedIdx].order;
    newFields[draggedIdx].order = newFields[targetIdx].order;
    newFields[targetIdx].order = temp;

    handleUpdateIdCardFields(newFields);
    triggerMsg('Badge field layout rearranged.', 'ok');
  };

  const handleUploadCategories = (e: React.ChangeEvent<HTMLInputElement>, field: 'ageGroups' | 'weightClasses' | 'affiliatedClubs') => {
    const file = e.target.files?.[0];
    if (!file || !compId) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Convert to JSON, array of arrays
        const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
        
        // Extract the first column items, filter out empty, flatten
        const newItems: string[] = [];
        data.forEach(row => {
          if (row && row.length > 0 && row[0]) {
            const val = String(row[0]).trim();
            if (val) {
              newItems.push(val);
            }
          }
        });

        if (newItems.length > 0) {
          const updated = competitions.map(c => {
            if (c.id === compId) {
              // combine and unique
              const existingList = c[field] || [];
              const combined = Array.from(new Set([...existingList, ...newItems]));
              return { ...c, [field]: combined };
            }
            return c;
          });
          saveCompsToStorage(updated);
          triggerMsg(`Successfully imported ${newItems.length} items.`, 'ok');
        } else {
          triggerMsg('No valid items found in the first column.', 'error');
        }
      } catch (err) {
        console.error(err);
        triggerMsg('Error parsing the file.', 'error');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // reset input
  };

  const handleAddCat = (field: 'ageGroups' | 'weightClasses' | 'affiliatedClubs', val: string, setVal: React.Dispatch<React.SetStateAction<string>>) => {
    if (!compId || !val.trim()) return;
    const updated = competitions.map(c => {
      if (c.id === compId) {
        const existingList = c[field] || [];
        return { ...c, [field]: [...existingList, val.trim()] };
      }
      return c;
    });
    saveCompsToStorage(updated);
    setVal('');
  };

  const handleRemoveCat = (field: 'ageGroups' | 'weightClasses' | 'affiliatedClubs', index: number) => {
    if (!compId) return;
    const updated = competitions.map(c => {
      if (c.id === compId) {
        const arr = [...(c[field] || [])];
        arr.splice(index, 1);
        return { ...c, [field]: arr };
      }
      return c;
    });
    saveCompsToStorage(updated);
  };

  const handleUploadGlobalClubs = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Convert to JSON, array of arrays
        const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
        
        // Extract the first column items, filter out empty, flatten
        const newItems: string[] = [];
        data.forEach(row => {
          if (row && row.length > 0 && row[0]) {
            const val = String(row[0]).trim();
            if (val) {
              newItems.push(val);
            }
          }
        });

        if (newItems.length > 0) {
          const combined = Array.from(new Set([...globalClubs, ...newItems]));
          setGlobalClubs(combined);
          await saveGlobalClubs(combined);
          triggerMsg(`Successfully imported ${newItems.length} global clubs/states.`, 'ok');
        } else {
          triggerMsg('No valid items found in the first column.', 'error');
        }
      } catch (err) {
        console.error(err);
        triggerMsg('Error parsing the file.', 'error');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // reset input
  };

  const handleAddGlobalClub = async (val: string, setVal: React.Dispatch<React.SetStateAction<string>>) => {
    if (!val.trim()) return;
    const trimmed = val.trim();
    if (globalClubs.includes(trimmed)) {
      triggerMsg('Club/State already exists.', 'error');
      return;
    }
    const updated = [...globalClubs, trimmed];
    setGlobalClubs(updated);
    await saveGlobalClubs(updated);
    setVal('');
    triggerMsg(`Added "${trimmed}" to global list.`, 'ok');
  };

  const handleRemoveGlobalClub = async (index: number) => {
    const item = globalClubs[index];
    const updated = [...globalClubs];
    updated.splice(index, 1);
    setGlobalClubs(updated);
    await saveGlobalClubs(updated);
    triggerMsg(`Removed "${item}" from global list.`, 'ok');
  };

  // --- COACH ACTIONS ---
  const handleOpenCoachPlayerForm = (playerId?: string) => {
    const comp = competitions.find(c => c.id === compId);
    if (!comp) return;

    if (role === 'coach' && isRegistrationClosed(comp)) {
      triggerMsg('Registration is closed for this tournament.', 'error');
      return;
    }

    if (playerId) {
      const p = players.find(pl => pl.id === playerId);
      if (p) {
        if (p.weighIn) {
          triggerMsg('This athlete has already completed their weigh-in and cannot be edited.', 'error');
          return;
        }
        setSelectedPlayerId(playerId);
        setPName(p.name);
        setPIc(p.ic);
        setPDob(p.dob);
        setPGender(p.gender);
        setPClub(p.club);
        setPEvent(p.event);
        setPAgeGroup(p.ageGroup);
        setPWeightClass(p.weightClass);
        setPendingPhoto(p.photo || null);
        setPSchoolName(p.schoolName || '');
        setPSchoolCode(p.schoolCode || '');
        setPRace(p.race || 'Malay');
      }
    } else {
      setSelectedPlayerId(null);
      setSelectedMasterId(null);
      setPName('');
      setPIc('');
      setPDob('');
      setPGender(comp.genders[0] || 'Male');
      
      const compClubs = globalClubs.length > 0
        ? globalClubs
        : Object.keys(DEMO_IMPORT.clubs);
      const coachClubProfile = coaches[user || '']?.club || '';
      const initialClub = compClubs.includes(coachClubProfile) ? coachClubProfile : (compClubs[0] || '');
      setPClub(initialClub);

      setPEvent(comp.events[0] || 'Kyorugi');
      setPAgeGroup(comp.ageGroups[0] || '');
      setPWeightClass(comp.weightClasses[0] || '');
      setPendingPhoto(null);
      setPSchoolName('');
      setPSchoolCode('');
      setPRace('Malay');
    }
    setScreen('coachPlayerForm');
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 240;
        const scale = Math.max(size / img.width, size / img.height);
        canvas.width = 192; // 4:5 portrait ratio
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = img.width * scale;
          const h = img.height * scale;
          ctx.drawImage(img, (192 - w) / 2, (240 - h) / 2, w, h);
          setPendingPhoto(canvas.toDataURL('image/jpeg', 0.8));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSavePlayer = () => {
    if (!pName.trim()) {
      triggerMsg('Athlete full name is required.', 'error');
      return;
    }
    if (!pIc.trim()) {
      triggerMsg('Athlete IC number/passport is required.', 'error');
      return;
    }
    if (!pDob) {
      triggerMsg('Athlete date of birth is required.', 'error');
      return;
    }
    if (!pGender) {
      triggerMsg('Athlete gender division is required.', 'error');
      return;
    }
    if (!pClub.trim()) {
      triggerMsg('Affiliated Club / State is required.', 'error');
      return;
    }
    if (!pSchoolName.trim()) {
      triggerMsg('School name is required.', 'error');
      return;
    }
    if (!pSchoolCode.trim()) {
      triggerMsg('School code is required.', 'error');
      return;
    }
    if (!pRace) {
      triggerMsg('Athlete race is required.', 'error');
      return;
    }
    if (!pEvent) {
      triggerMsg('Athlete event is required.', 'error');
      return;
    }
    if (!pAgeGroup) {
      triggerMsg('Athlete age group division is required.', 'error');
      return;
    }
    if (!pWeightClass) {
      triggerMsg('Athlete weight class division is required.', 'error');
      return;
    }
    if (!compId) return;

    if (selectedPlayerId) {
      const existingP = players.find(p => p.id === selectedPlayerId);
      if (existingP?.weighIn) {
        triggerMsg('This athlete has already completed their weigh-in and cannot be edited.', 'error');
        return;
      }
    }

    // Check for duplicate player, category, and event
    const isDuplicate = players.some(p => {
      if (selectedPlayerId && p.id === selectedPlayerId) {
        return false;
      }
      const sameIdentity = 
        (p.ic && pIc.trim() && p.ic.trim().toLowerCase() === pIc.trim().toLowerCase()) ||
        (p.name.trim().toLowerCase() === pName.trim().toLowerCase() && p.dob === pDob);
      
      const sameCategory = p.ageGroup === pAgeGroup && p.weightClass === pWeightClass;
      const sameEvent = p.event === pEvent;
      
      return sameIdentity && sameCategory && sameEvent;
    });

    if (isDuplicate) {
      triggerMsg(`This athlete (${pName.trim()}) is already registered for the ${pEvent} event in the ${pAgeGroup} / ${pWeightClass} category. Duplicate registrations are not allowed.`, 'error');
      return;
    }

    const data: Partial<Player> = {
      name: pName.trim(),
      ic: pIc.trim(),
      dob: pDob,
      gender: pGender,
      club: pClub.trim(),
      event: pEvent,
      ageGroup: pAgeGroup,
      weightClass: pWeightClass,
      photo: pendingPhoto || undefined,
      schoolName: pSchoolName.trim(),
      schoolCode: pSchoolCode.trim(),
      race: pRace,
    };

    let updatedList = [...players];
    let finalId = selectedPlayerId;
    if (selectedPlayerId) {
      updatedList = players.map(p => p.id === selectedPlayerId ? { ...p, ...data } as Player : p);
    } else {
      if (selectedMasterId) {
        finalId = selectedMasterId;
        if (players.some(p => p.id === finalId)) {
          triggerMsg('This athlete is already registered in this tournament. Please edit their existing entry.', 'error');
          return;
        }
      } else {
        const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();
        finalId = `PLY-${randomPart}`;
      }
      const newPlayer: Player = {
        id: finalId,
        compId,
        name: pName.trim(),
        ic: pIc.trim(),
        dob: pDob,
        gender: pGender,
        club: pClub.trim(),
        coachUsername: user || 'demo',
        event: pEvent,
        ageGroup: pAgeGroup,
        weightClass: pWeightClass,
        photo: pendingPhoto || undefined,
        createdAt: new Date().toISOString(),
        weighIn: null,
        schoolName: pSchoolName.trim(),
        schoolCode: pSchoolCode.trim(),
        race: pRace,
      };
      updatedList.push(newPlayer);
      setSelectedPlayerId(finalId);
    }

    savePlayersToStorage(compId, updatedList);
    
    // Save to master roster
    if (finalId) {
      saveMasterAthletesToStorage({
        ...masterAthletes,
        [finalId]: {
          id: finalId,
          name: pName.trim(),
          ic: pIc.trim(),
          dob: pDob,
          gender: pGender,
          club: pClub.trim(),
          photo: pendingPhoto || undefined,
          coachUsername: user || undefined,
          schoolName: pSchoolName.trim(),
          schoolCode: pSchoolCode.trim(),
          race: pRace,
        }
      });
    }

    triggerMsg(selectedPlayerId ? 'Athlete record updated.' : 'Athlete registered successfully.', 'ok');
    setScreen(role === 'admin' ? 'adminCompDetail' : role === 'organizer' ? 'organizerDashboard' : 'coachRoster');
  };

  const handleDeletePlayer = (playerId: string) => {
    if (!compId) return;
    if (role === 'coach') {
      triggerMsg('Coaches are not permitted to delete athlete records.', 'error');
      return;
    }
    const updated = players.filter(p => p.id !== playerId);
    savePlayersToStorage(compId, updated);
    setConfirmDeleteId(null);
    triggerMsg('Athlete registration retracted.', 'ok');
  };

  // --- COACH EXCEL UPLOAD AND TEMPLATE ACTIONS ---
  const handleDownloadExcelTemplate = async () => {
    const activeComp = competitions.find(c => c.id === compId);
    if (!activeComp) {
      triggerMsg('No active tournament selected to generate a template.', 'error');
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      
      // Main template sheet
      const ws = workbook.addWorksheet('Competitor Template');
      
      // Data sheet for dropdown validations
      const listWs = workbook.addWorksheet('Dropdown_Data');
      listWs.state = 'hidden';

      // 1. Populate validation source lists in the hidden sheet
      listWs.getCell('A1').value = 'Events';
      listWs.getCell('B1').value = 'Age Groups';
      listWs.getCell('C1').value = 'Weight Classes';
      listWs.getCell('D1').value = 'Genders';
      listWs.getCell('E1').value = 'Races';
      listWs.getCell('F1').value = 'Affiliated Clubs / States';

      const events = activeComp.events && activeComp.events.length > 0 ? activeComp.events : ['Kyorugi', 'Poomsae'];
      const ageGroups = activeComp.ageGroups && activeComp.ageGroups.length > 0 ? activeComp.ageGroups : ['Junior (15 to 17 Years Old)'];
      const weightClasses = activeComp.weightClasses && activeComp.weightClasses.length > 0 ? activeComp.weightClasses : ['FIN BELOW 45KG'];
      const genders = ['Male', 'Female'];
      const races = ['Malay', 'Chinese', 'Indian', 'Lain-lain'];
      const clubsList = globalClubs.length > 0
        ? globalClubs
        : Object.keys(DEMO_IMPORT.clubs);

      events.forEach((val, idx) => { listWs.getCell(`A${idx + 2}`).value = val; });
      ageGroups.forEach((val, idx) => { listWs.getCell(`B${idx + 2}`).value = val; });
      weightClasses.forEach((val, idx) => { listWs.getCell(`C${idx + 2}`).value = val; });
      genders.forEach((val, idx) => { listWs.getCell(`D${idx + 2}`).value = val; });
      races.forEach((val, idx) => { listWs.getCell(`E${idx + 2}`).value = val; });
      clubsList.forEach((val, idx) => { listWs.getCell(`F${idx + 2}`).value = val; });

      // 2. Setup Columns and Headers on the main template
      ws.columns = [
        { header: 'Full Name *', key: 'name', width: 26 },
        { header: 'Gender *', key: 'gender', width: 14 },
        { header: 'NRIC or Passport *', key: 'ic', width: 20 },
        { header: 'Date of Birth *', key: 'dob', width: 16 },
        { header: 'Event *', key: 'event', width: 16 },
        { header: 'Age Group *', key: 'ageGroup', width: 34 },
        { header: 'Weight Class *', key: 'weightClass', width: 26 },
        { header: 'School Name *', key: 'schoolName', width: 26 },
        { header: 'School Code *', key: 'schoolCode', width: 16 },
        { header: 'Affiliated Club / State', key: 'club', width: 26 },
        { header: 'Race *', key: 'race', width: 14 }
      ];

      // Style Header Row
      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 10 };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '1E293B' } // Slate color to match the application's aesthetic
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      headerRow.height = 28;

      // Add 2 realistic sample rows for coaches' reference
      const sampleRows = [
        [
          "Muhammad Ali",
          "Male",
          "090512145555",
          "2009-05-12",
          events[0],
          ageGroups[0],
          weightClasses[0],
          "SMK Saujana",
          "BBA0012",
          "Saujana Martial Arts",
          "Malay"
        ],
        [
          "Siti Aminah",
          "Female",
          "110423106666",
          "2011-04-23",
          events[0],
          ageGroups[0],
          weightClasses[1] || weightClasses[0],
          "SK Saujana Utama",
          "BBA0013",
          "Saujana Martial Arts",
          "Malay"
        ]
      ];
      sampleRows.forEach(row => ws.addRow(row));

      // Style the sample rows
      for (let r = 2; r <= 3; r++) {
        const row = ws.getRow(r);
        row.font = { size: 10, italic: true, color: { argb: '475569' } };
        row.alignment = { vertical: 'middle', horizontal: 'left' };
      }

      // 3. Apply cell validation dropdown limits on rows 2 to 200
      const eventsLen = events.length;
      const ageGroupsLen = ageGroups.length;
      const weightClassesLen = weightClasses.length;

      for (let r = 2; r <= 200; r++) {
        const row = ws.getRow(r);
        row.alignment = { vertical: 'middle' };

        // Full Name (Column A) - Text Length validation to make it strictly required
        ws.getCell(r, 1).dataValidation = {
          type: 'textLength',
          operator: 'greaterThanOrEqual',
          allowBlank: false,
          formulae: [1],
          showErrorMessage: true,
          errorTitle: 'Required Field',
          error: 'Full Name is strictly required and cannot be left blank.'
        };

        // Gender (Column B)
        ws.getCell(r, 2).dataValidation = {
          type: 'list',
          allowBlank: false,
          formulae: ['Dropdown_Data!$D$2:$D$3'],
          showErrorMessage: true,
          errorTitle: 'Required Field',
          error: 'Please select a Gender option from the dropdown (required).'
        };

        // NRIC or Passport (Column C) - Text Length validation to make it strictly required
        ws.getCell(r, 3).dataValidation = {
          type: 'textLength',
          operator: 'greaterThanOrEqual',
          allowBlank: false,
          formulae: [1],
          showErrorMessage: true,
          errorTitle: 'Required Field',
          error: 'NRIC or Passport number is strictly required and cannot be left blank.'
        };

        // Date of Birth (Column D) - Text Length validation to make it strictly required
        ws.getCell(r, 4).dataValidation = {
          type: 'textLength',
          operator: 'greaterThanOrEqual',
          allowBlank: false,
          formulae: [1],
          showErrorMessage: true,
          errorTitle: 'Required Field',
          error: 'Date of Birth is strictly required (Format: YYYY-MM-DD).'
        };

        // Event (Column E)
        ws.getCell(r, 5).dataValidation = {
          type: 'list',
          allowBlank: false,
          formulae: [`Dropdown_Data!$A$2:$A$${eventsLen + 1}`],
          showErrorMessage: true,
          errorTitle: 'Required Field',
          error: 'Please select an Event option from the dropdown (required).'
        };

        // Age Group (Column F)
        ws.getCell(r, 6).dataValidation = {
          type: 'list',
          allowBlank: false,
          formulae: [`Dropdown_Data!$B$2:$B$${ageGroupsLen + 1}`],
          showErrorMessage: true,
          errorTitle: 'Required Field',
          error: 'Please select an Age Group division from the dropdown (required).'
        };

        // Weight Class (Column G)
        ws.getCell(r, 7).dataValidation = {
          type: 'list',
          allowBlank: false,
          formulae: [`Dropdown_Data!$C$2:$C$${weightClassesLen + 1}`],
          showErrorMessage: true,
          errorTitle: 'Required Field',
          error: 'Please select a Weight Class category from the dropdown (required).'
        };

        // School Name (Column H) - Text Length validation to make it strictly required
        ws.getCell(r, 8).dataValidation = {
          type: 'textLength',
          operator: 'greaterThanOrEqual',
          allowBlank: false,
          formulae: [1],
          showErrorMessage: true,
          errorTitle: 'Required Field',
          error: 'School / Club Name is strictly required and cannot be left blank.'
        };

        // School Code (Column I) - Text Length validation to make it strictly required
        ws.getCell(r, 9).dataValidation = {
          type: 'textLength',
          operator: 'greaterThanOrEqual',
          allowBlank: false,
          formulae: [1],
          showErrorMessage: true,
          errorTitle: 'Required Field',
          error: 'School / Club Code is strictly required and cannot be left blank.'
        };

        // Affiliated Club / State (Column J) - Optional
        ws.getCell(r, 10).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`Dropdown_Data!$F$2:$F$${clubsList.length + 1}`],
          showErrorMessage: false
        };

        // Race (Column K)
        ws.getCell(r, 11).dataValidation = {
          type: 'list',
          allowBlank: false,
          formulae: ['Dropdown_Data!$E$2:$E$5'],
          showErrorMessage: true,
          errorTitle: 'Required Field',
          error: 'Please select a Race option from the dropdown (required).'
        };
      }

      // Make gridlines visible explicitly
      ws.views = [{ showGridLines: true }];

      // Write to Buffer and trigger file download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = activeComp.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `${safeName}_Coach_Roster_Template.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      triggerMsg('Excel template with dropdowns downloaded successfully!', 'ok');
    } catch (err) {
      console.error('Failed to generate Excel template:', err);
      triggerMsg('Could not download template.', 'error');
    }
  };

  const handleCoachExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const activeComp = competitions.find(c => c.id === compId);
    if (!activeComp) {
      triggerMsg('No active competition selected.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const wsName = workbook.SheetNames[0];
        const ws = workbook.Sheets[wsName];
        const rawRows = XLSX.utils.sheet_to_json<any>(ws);

        if (rawRows.length === 0) {
          triggerMsg('Excel file appears to be empty.', 'error');
          return;
        }

        const parsed: Partial<Player>[] = [];
        const errors: { rowNum: number; name: string; error: string }[] = [];

        rawRows.forEach((row, index) => {
          const rowNum = index + 2; // Excel visual row number
          
          // Normalize keys
          const normalizedRow: any = {};
          Object.entries(row).forEach(([k, v]) => {
            const normKey = String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
            normalizedRow[normKey] = v;
          });

          // Extract fields
          const rawName = String(normalizedRow['fullname'] || normalizedRow['name'] || normalizedRow['athlete'] || normalizedRow['competitor'] || '').trim();
          if (!rawName) {
            errors.push({ rowNum, name: 'Row ' + rowNum, error: 'Missing Athlete Name. This is a required field.' });
            return;
          }

          let rowHasError = false;

          const rawGender = String(normalizedRow['gender'] || normalizedRow['sex'] || '').trim();
          let gender = '';
          if (!rawGender) {
            errors.push({ rowNum, name: rawName, error: 'Missing Gender (Required).' });
            rowHasError = true;
          } else {
            const firstChar = rawGender.toLowerCase().charAt(0);
            if (firstChar === 'f' || firstChar === 'p' || firstChar === 'w') {
              gender = 'Female';
            } else if (firstChar === 'm' || firstChar === 'l') {
              gender = 'Male';
            } else {
              errors.push({ rowNum, name: rawName, error: `Invalid Gender "${rawGender}". Must be Male or Female.` });
              rowHasError = true;
            }
          }

          const ic = String(normalizedRow['nricorpassport'] || normalizedRow['ic'] || normalizedRow['passport'] || normalizedRow['nric'] || normalizedRow['id'] || '').trim();
          if (!ic) {
            errors.push({ rowNum, name: rawName, error: 'Missing NRIC or Passport number (Required).' });
            rowHasError = true;
          }

          const dobVal = normalizedRow['dateofbirth'] || normalizedRow['dob'] || normalizedRow['birthdate'] || '';
          let dob = '';
          if (!dobVal) {
            errors.push({ rowNum, name: rawName, error: 'Missing Date of Birth (Required).' });
            rowHasError = true;
          } else {
            if (typeof dobVal === 'number') {
              // Handle Excel serial date
              const excelEpoch = new Date(Date.UTC(1899, 11, 30));
              const tempDate = new Date(excelEpoch.getTime() + dobVal * 24 * 60 * 60 * 1000);
              dob = tempDate.toISOString().split('T')[0];
            } else {
              dob = String(dobVal).trim();
            }
          }

          const rawEvent = String(normalizedRow['event'] || normalizedRow['division'] || normalizedRow['type'] || '').trim();
          let matchedEvent = '';
          if (!rawEvent) {
            errors.push({ rowNum, name: rawName, error: 'Missing Event (Required).' });
            rowHasError = true;
          } else {
            const found = activeComp.events.find(ev => ev.toLowerCase() === rawEvent.toLowerCase());
            if (found) {
              matchedEvent = found;
            } else {
              errors.push({ rowNum, name: rawName, error: `Event "${rawEvent}" not found in tournament events list.` });
              rowHasError = true;
            }
          }

          const rawAgeGroup = String(normalizedRow['agegroup'] || normalizedRow['agecategory'] || normalizedRow['category'] || '').trim();
          let matchedAgeGroup = '';
          if (rawAgeGroup) {
            const found = activeComp.ageGroups.find(ag => ag.toLowerCase() === rawAgeGroup.toLowerCase());
            if (found) {
              matchedAgeGroup = found;
            } else {
              const partialFound = activeComp.ageGroups.find(ag => ag.toLowerCase().includes(rawAgeGroup.toLowerCase()));
              if (partialFound) {
                matchedAgeGroup = partialFound;
              }
            }
          }
          if (!matchedAgeGroup) {
            const derivedByYear = getMatchingAgeGroup(dob, ic, activeComp.ageGroups, activeComp.date);
            if (derivedByYear) {
              matchedAgeGroup = derivedByYear;
            } else {
              errors.push({ rowNum, name: rawName, error: `Age Group "${rawAgeGroup || 'unspecified'}" doesn't match competition divisions or birth year.` });
              rowHasError = true;
            }
          }

          const rawWeightClass = String(normalizedRow['weightclass'] || normalizedRow['weightcategory'] || normalizedRow['weight'] || '').trim();
          let matchedWeightClass = '';
          if (!rawWeightClass) {
            errors.push({ rowNum, name: rawName, error: 'Missing Weight Class (Required).' });
            rowHasError = true;
          } else {
            const found = activeComp.weightClasses.find(wc => wc.toLowerCase() === rawWeightClass.toLowerCase());
            if (found) {
              matchedWeightClass = found;
            } else {
              const partialFound = activeComp.weightClasses.find(wc => wc.toLowerCase().includes(rawWeightClass.toLowerCase()));
              if (partialFound) {
                matchedWeightClass = partialFound;
              } else {
                errors.push({ rowNum, name: rawName, error: `Weight Class "${rawWeightClass}" doesn't match competition weight categories.` });
                rowHasError = true;
              }
            }
          }

          const schoolName = String(normalizedRow['schoolname'] || normalizedRow['school'] || '').trim();
          if (!schoolName) {
            errors.push({ rowNum, name: rawName, error: 'Missing School Name (Required).' });
            rowHasError = true;
          }

          const schoolCode = String(normalizedRow['schoolcode'] || normalizedRow['code'] || '').trim();
          if (!schoolCode) {
            errors.push({ rowNum, name: rawName, error: 'Missing School Code (Required).' });
            rowHasError = true;
          }

          const clubRaw = String(normalizedRow['affiliatedclubstate'] || normalizedRow['clubstate'] || normalizedRow['affiliatedclubteam'] || normalizedRow['affiliatedclub'] || normalizedRow['clubteam'] || normalizedRow['club'] || '').trim();
          let club = '';
          if (!clubRaw) {
            // Optional field: default to coach's registered club or active competition options if blank
            const coachClubProfile = coaches[user || '']?.club || '';
            const compClubs = globalClubs.length > 0
              ? globalClubs
              : Object.keys(DEMO_IMPORT.clubs);
            club = coachClubProfile || compClubs[0] || '';
          } else {
            const compClubs = globalClubs.length > 0
              ? globalClubs
              : Object.keys(DEMO_IMPORT.clubs);
            const found = compClubs.find(c => c.toLowerCase() === clubRaw.toLowerCase());
            if (found) {
              club = found;
            } else {
              club = clubRaw;
            }
          }

          const rawRace = String(normalizedRow['race'] || '').trim();
          let race = '';
          if (!rawRace) {
            errors.push({ rowNum, name: rawName, error: 'Missing Race (Required).' });
            rowHasError = true;
          } else {
            const formatted = rawRace.charAt(0).toUpperCase() + rawRace.slice(1).toLowerCase();
            if (['Malay', 'Chinese', 'Indian', 'Lain-lain'].includes(formatted)) {
              race = formatted;
            } else {
              errors.push({ rowNum, name: rawName, error: `Invalid Race "${rawRace}". Must be Malay, Chinese, Indian, or Lain-lain.` });
              rowHasError = true;
            }
          }

          if (!rowHasError) {
            parsed.push({
              name: rawName,
              gender,
              ic,
              dob,
              event: matchedEvent,
              ageGroup: matchedAgeGroup,
              weightClass: matchedWeightClass,
              schoolName,
              schoolCode,
              club,
              race
            });
          }
        });

        setExcelParsedPlayers(parsed);
        setExcelValidationErrors(errors);
        if (parsed.length > 0) {
          triggerMsg(`Parsed ${parsed.length} valid competitor records. Please review and confirm below.`, 'ok');
        } else {
          triggerMsg('No valid rows could be parsed. Please check the error list.', 'error');
        }
      } catch (err) {
        console.error(err);
        triggerMsg('Failed to parse Excel file. Please ensure it is a valid Excel format.', 'error');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // reset input
  };

  const handleConfirmCoachExcelImport = async () => {
    if (!compId || excelParsedPlayers.length === 0) return;

    try {
      setExcelImporting(true);
      const activeComp = competitions.find(c => c.id === compId);
      if (!activeComp) return;

      const coachClub = coaches[user || '']?.club || '';
      const coachUsername = user || 'demo';
      
      const newPlayersList = [...players];
      const masterUpdates = { ...masterAthletes };
      const now = new Date().toISOString();

      let addedCount = 0;
      let duplicateCount = 0;

      excelParsedPlayers.forEach((parsedP) => {
        // Check duplicate
        const isDuplicate = newPlayersList.some(p => {
          const sameIdentity = 
            (p.ic && parsedP.ic && p.ic.trim().toLowerCase() === parsedP.ic.trim().toLowerCase()) ||
            (p.name.trim().toLowerCase() === parsedP.name!.trim().toLowerCase() && p.dob === parsedP.dob);
          
          const sameCategory = p.ageGroup === parsedP.ageGroup && p.weightClass === parsedP.weightClass;
          const sameEvent = p.event === parsedP.event;
          
          return sameIdentity && sameCategory && sameEvent;
        });

        if (isDuplicate) {
          duplicateCount++;
          return;
        }

        const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();
        const customId = `PLY-${randomPart}`;

        const newPlayer: Player = {
          id: customId,
          compId,
          name: parsedP.name!.trim(),
          ic: parsedP.ic || '',
          dob: parsedP.dob || '',
          gender: parsedP.gender || 'Male',
          club: parsedP.club || coachClub,
          coachUsername,
          event: parsedP.event || 'Kyorugi',
          ageGroup: parsedP.ageGroup || '',
          weightClass: parsedP.weightClass || '',
          createdAt: now,
          weighIn: null,
          schoolName: parsedP.schoolName || '',
          schoolCode: parsedP.schoolCode || '',
          race: parsedP.race || 'Malay'
        };

        newPlayersList.push(newPlayer);
        
        masterUpdates[customId] = {
          id: customId,
          name: newPlayer.name,
          ic: newPlayer.ic,
          dob: newPlayer.dob,
          gender: newPlayer.gender,
          club: newPlayer.club,
          coachUsername: user || undefined,
          schoolName: newPlayer.schoolName,
          schoolCode: newPlayer.schoolCode,
          race: newPlayer.race
        };

        addedCount++;
      });

      if (addedCount > 0) {
        await savePlayersToStorage(compId, newPlayersList);
        await saveMasterAthletesToStorage(masterUpdates);
      }

      if (duplicateCount > 0) {
        triggerMsg(`Import complete: ${addedCount} athlete(s) imported. ${duplicateCount} duplicate(s) skipped.`, 'ok');
      } else {
        triggerMsg(`Import complete: ${addedCount} athlete(s) successfully registered!`, 'ok');
      }

      setShowCoachExcelModal(false);
      setExcelParsedPlayers([]);
      setExcelValidationErrors([]);
    } catch (err) {
      console.error(err);
      triggerMsg('An error occurred during import. Please try again.', 'error');
    } finally {
      setExcelImporting(false);
    }
  };

  // --- WEIGH IN ACTIONS ---
  const handleRecordWeighIn = () => {
    if (!compId || !scanResult) return;
    const val = parseFloat(actualWeightInput);
    if (isNaN(val) || val <= 0) {
      triggerMsg('Please specify a positive numeric weight measurement.', 'error');
      return;
    }
    
    let signatureData = undefined;
    if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
      signatureData = sigCanvas.current.toDataURL();
    }

    const currentComp = competitions.find(c => c.id === compId);
    if (!currentComp) return;

    const updated = players.map(p => {
      if (p.id === scanResult) {
        const autoResult = evalWeight(p.weightClass, val);
        return {
          ...p,
          weighIn: {
            weight: val,
            time: new Date().toISOString(),
            result: autoResult as any,
            signature: signatureData,
            stationId: oStation
          }
        };
      }
      return p;
    });

    savePlayersToStorage(compId, updated);
    const updatedPlayer = updated.find(p => p.id === scanResult);
    if (updatedPlayer?.weighIn) {
      triggerMsg(`Weigh-in recorded: ${val}kg. Outcome: ${updatedPlayer.weighIn.result}`, updatedPlayer.weighIn.result.includes('PASS') ? 'ok' : 'error');
    }
    if (sigCanvas.current) {
      sigCanvas.current.clear();
    }
    setScanResult(null);
    setActualWeightInput('');
  };

  const handleOverrideWeighIn = (playerId: string, result: 'OVERRIDE PASS' | 'OVERRIDE FAIL') => {
    if (!compId) return;
    const updated = players.map(p => {
      if (p.id === playerId && p.weighIn) {
        return {
          ...p,
          weighIn: {
            ...p.weighIn,
            result
          }
        };
      }
      return p;
    });
    savePlayersToStorage(compId, updated);
    triggerMsg(`Weigh-in decision manually overridden to: ${result}.`, 'ok');
  };

  const parseWeightRange = (wc: string) => {
    if (!wc) return null;
    const s = wc.toUpperCase();
    let m;
    if (m = s.match(/BELOW\s*([\d.]+)\s*KG/)) return { min: 0, max: parseFloat(m[1]) };
    if (m = s.match(/([\d.]+)\s*KG\s*&?\s*ABOVE/)) return { min: parseFloat(m[1]), max: Infinity };
    if (m = s.match(/([\d.]+)\s*KG\s*-\s*([\d.]+)\s*KG/)) return { min: parseFloat(m[1]), max: parseFloat(m[2]) };
    return null;
  };

  const evalWeight = (wc: string, actual: number) => {
    const r = parseWeightRange(wc);
    if (!r) return 'MANUAL';
    return (actual >= r.min && actual <= r.max) ? 'PASS' : 'FAIL';
  };

  const downloadCardPNG = () => {
    if (!cardRef.current) return;
    const p = players.find(pl => pl.id === selectedPlayerId);
    if (!p) return;
    
    htmlToImage.toPng(cardRef.current, { backgroundColor: '#12211C', pixelRatio: 3.125 }).then(dataUrl => {
      const link = document.createElement('a');
      link.download = `DOJANG_REG_${p.id}_${p.name.replace(/\s+/g, '_')}.png`;
      link.href = dataUrl;
      link.click();
    }).catch(err => {
      console.error('oops, something went wrong!', err);
    });
  };

  const downloadAllSelectedCards = async (selectedPlayers: Player[]) => {
    if (selectedPlayers.length === 0) {
      triggerMsg('No ID cards selected for download.', 'error');
      return;
    }
    setIsDownloadingAll(true);
    setDownloadProgress(0);
    setDownloadTotal(selectedPlayers.length);
    
    const zip = new JSZip();
    const folderName = activeComp 
      ? `${activeComp.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_ID_Cards` 
      : 'ID_Cards';
    const imgFolder = zip.folder(folderName);

    for (let i = 0; i < selectedPlayers.length; i++) {
      const p = selectedPlayers[i];
      setDownloadProgress(i + 1);
      
      const el = document.getElementById(`batch-card-${p.id}`);
      if (el) {
        try {
          await new Promise(resolve => setTimeout(resolve, 150));
          const dataUrl = await htmlToImage.toPng(el, { backgroundColor: '#12211C', pixelRatio: 3.125 });
          const base64Data = dataUrl.split(',')[1];
          const fileName = `DOJANG_ID_${p.id}_${p.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
          if (imgFolder) {
            imgFolder.file(fileName, base64Data, { base64: true });
          }
        } catch (err) {
          console.error(`Failed to generate ID card for ${p.name}:`, err);
        }
      }
    }
    
    try {
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.download = `${folderName}.zip`;
      link.href = URL.createObjectURL(content);
      link.click();
      triggerMsg(`Successfully exported ${selectedPlayers.length} ID cards inside the "${folderName}" folder!`, 'ok');
    } catch (err) {
      console.error('Failed to create ZIP package:', err);
      triggerMsg('Failed to package ID cards into a ZIP file.', 'error');
    } finally {
      setIsDownloadingAll(false);
    }
  };

  const downloadWeighInExcel = () => {
    if (!activeComp) {
      triggerMsg('No active competition selected.', 'error');
      return;
    }

    try {
      const wb = XLSX.utils.book_new();

      const mapPlayerToRow = (p: Player) => {
        return {
          'Competitor ID': p.id,
          'Full Name': p.name,
          'Identity Card': p.ic,
          'DOB': p.dob,
          'Gender': p.gender,
          'Club Represented': p.club,
          'School Name': p.schoolName || 'â€”',
          'School Code': p.schoolCode || 'â€”',
          'Race': p.race || 'â€”',
          'Event': p.event,
          'Division Bracket': p.ageGroup,
          'Target Weight Class': p.weightClass,
          'Scale Weight (kg)': p.weighIn ? p.weighIn.weight : 'â€”',
          'Weigh-In Decision': p.weighIn ? p.weighIn.result : 'NOT WEIGHED',
          'Timestamp': p.weighIn ? new Date(p.weighIn.time).toLocaleString() : 'â€”',
          'Station ID': p.weighIn?.stationId || 'â€”'
        };
      };

      const setColWidths = (ws: XLSX.WorkSheet, rows: any[]) => {
        if (!rows || rows.length === 0) return;
        const keys = Object.keys(rows[0]);
        ws['!cols'] = keys.map(key => {
          const maxLen = Math.max(
            key.length,
            ...rows.map(row => {
              const val = row[key];
              return val ? String(val).length : 0;
            })
          );
          return { wch: Math.min(Math.max(maxLen + 3, 10), 45) };
        });
      };

      // 1. All Registered Competitors (Every entrant in the competition)
      const allPlayerRows = players.map(mapPlayerToRow);
      if (allPlayerRows.length === 0) {
        allPlayerRows.push({
          'Competitor ID': 'No registered competitors found',
          'Full Name': '',
          'Identity Card': '',
          'DOB': '',
          'Gender': '',
          'Club Represented': '',
          'School Name': '',
          'School Code': '',
          'Race': '',
          'Event': '',
          'Division Bracket': '',
          'Target Weight Class': '',
          'Scale Weight (kg)': '',
          'Weigh-In Decision': '',
          'Timestamp': ''
        } as any);
      }
      const wsAll = XLSX.utils.json_to_sheet(allPlayerRows);
      setColWidths(wsAll, allPlayerRows);
      XLSX.utils.book_append_sheet(wb, wsAll, "All Registered Players");

      // 2. Pass and Fail Result (Anyone who has undergone weigh-in)
      const passAndFailPlayers = players.filter(p => p.weighIn !== null);
      const passAndFailRows = passAndFailPlayers.map(mapPlayerToRow);
      if (passAndFailRows.length === 0) {
        passAndFailRows.push({
          'Competitor ID': 'No weigh-in records registered yet',
          'Full Name': '',
          'Identity Card': '',
          'DOB': '',
          'Gender': '',
          'Club Represented': '',
          'School Name': '',
          'School Code': '',
          'Race': '',
          'Event': '',
          'Division Bracket': '',
          'Target Weight Class': '',
          'Scale Weight (kg)': '',
          'Weigh-In Decision': '',
          'Timestamp': ''
        } as any);
      }
      const wsPassAndFail = XLSX.utils.json_to_sheet(passAndFailRows);
      setColWidths(wsPassAndFail, passAndFailRows);
      XLSX.utils.book_append_sheet(wb, wsPassAndFail, "Pass & Fail Results");

      // 2. Pass Result (Anyone who has passed)
      const passPlayers = players.filter(p => p.weighIn !== null && p.weighIn.result.includes('PASS'));
      const passRows = passPlayers.map(mapPlayerToRow);
      if (passRows.length === 0) {
        passRows.push({
          'Competitor ID': 'No passed records found',
          'Full Name': '',
          'Identity Card': '',
          'DOB': '',
          'Gender': '',
          'Club Represented': '',
          'School Name': '',
          'School Code': '',
          'Race': '',
          'Event': '',
          'Division Bracket': '',
          'Target Weight Class': '',
          'Scale Weight (kg)': '',
          'Weigh-In Decision': '',
          'Timestamp': ''
        } as any);
      }
      const wsPass = XLSX.utils.json_to_sheet(passRows);
      setColWidths(wsPass, passRows);
      XLSX.utils.book_append_sheet(wb, wsPass, "Pass Results");

      // 3. Fail Result (Anyone who has failed)
      const failPlayers = players.filter(p => p.weighIn !== null && !p.weighIn.result.includes('PASS'));
      const failRows = failPlayers.map(mapPlayerToRow);
      if (failRows.length === 0) {
        failRows.push({
          'Competitor ID': 'No failed records found',
          'Full Name': '',
          'Identity Card': '',
          'DOB': '',
          'Gender': '',
          'Club Represented': '',
          'School Name': '',
          'School Code': '',
          'Race': '',
          'Event': '',
          'Division Bracket': '',
          'Target Weight Class': '',
          'Scale Weight (kg)': '',
          'Weigh-In Decision': '',
          'Timestamp': ''
        } as any);
      }
      const wsFail = XLSX.utils.json_to_sheet(failRows);
      setColWidths(wsFail, failRows);
      XLSX.utils.book_append_sheet(wb, wsFail, "Fail Results");

      const cleanCompName = activeComp.name.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${cleanCompName}_WeighIn_Summary.xlsx`;
      XLSX.writeFile(wb, filename);
      triggerMsg('Weigh-In Total Summary Excel downloaded.', 'ok');
    } catch (err) {
      console.error('Failed to generate Excel sheet', err);
      triggerMsg('Failed to export Excel report.', 'error');
    }
  };

  // --- SUB COMPONENTS & BLOCKS ---

  const renderBadge = (res?: 'PASS' | 'FAIL' | 'OVERRIDE PASS' | 'OVERRIDE FAIL' | 'MANUAL') => {
    if (!res) return <span className="px-2 py-1 text-xs font-bold rounded-full bg-surface-2 text-text-dim border border-line">NOT WEIGHED</span>;
    if (res === 'PASS' || res === 'OVERRIDE PASS') {
      return <span className="px-2 py-1 text-xs font-bold rounded-full bg-good/10 text-good border border-good/30">PASS</span>;
    }
    if (res === 'FAIL' || res === 'OVERRIDE FAIL') {
      return <span className="px-2 py-1 text-xs font-bold rounded-full bg-bad/10 text-bad border border-bad/30">FAIL</span>;
    }
    return <span className="px-2 py-1 text-xs font-bold rounded-full bg-surface-2 text-gold border border-gold/30">MANUAL</span>;
  };

  // Filter players for coach dashboard (only showing their own players) or admin
  const coachFilteredPlayers = players.filter(p => {
    const matchesUser = role === 'coach' ? p.coachUsername === user : true;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.club.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (p.schoolName && p.schoolName.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (p.schoolCode && p.schoolCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (p.race && p.race.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesUser && matchesSearch;
  });

  const publicFilteredPlayers = players.filter(p => {
    return p.name.toLowerCase().includes(publicSearchQuery.toLowerCase()) || 
           p.id.toLowerCase().includes(publicSearchQuery.toLowerCase()) ||
           p.club.toLowerCase().includes(publicSearchQuery.toLowerCase()) ||
           (p.schoolName && p.schoolName.toLowerCase().includes(publicSearchQuery.toLowerCase())) ||
           (p.schoolCode && p.schoolCode.toLowerCase().includes(publicSearchQuery.toLowerCase())) ||
           (p.race && p.race.toLowerCase().includes(publicSearchQuery.toLowerCase()));
  });

  const activeComp = competitions.find(c => c.id === compId) || competitions.find(c => c.isActive !== false) || (competitions.length > 0 ? competitions[0] : undefined);
  const defaultRings = ['Ring 1', 'Ring 2', 'Ring 3', 'Ring 4'];
  const currentRings = (activeComp?.rings && activeComp.rings.length > 0) ? activeComp.rings : defaultRings;

  const handleAddRing = async (customName?: string) => {
    const targetComp = activeComp || (competitions.length > 0 ? competitions[0] : undefined);
    if (!targetComp) {
      triggerMsg('Please create or select a tournament first.', 'error');
      return;
    }
    let newRingName = customName?.trim();
    if (!newRingName) {
      let nextNum = currentRings.length + 1;
      while (currentRings.includes(`Ring ${nextNum}`)) {
        nextNum++;
      }
      newRingName = `Ring ${nextNum}`;
    }
    
    if (currentRings.includes(newRingName)) {
      triggerMsg(`"${newRingName}" already exists in this tournament!`, 'error');
      return;
    }
    
    const updatedRings = [...currentRings, newRingName];
    const updatedComp: Competition = {
      ...targetComp,
      rings: updatedRings,
    };
    const updatedComps = competitions.map(c => c.id === targetComp.id ? updatedComp : c);
    await saveCompsToStorage(updatedComps);
    triggerMsg(`Added ${newRingName} successfully!`, 'ok');
  };

  const handleRemoveRing = (ringNameToRemove: string) => {
    setRingToDelete(ringNameToRemove);
  };

  const executeRemoveRing = async (ringNameToRemove: string) => {
    const targetComp = activeComp || (competitions.length > 0 ? competitions[0] : undefined);
    if (!targetComp) {
      triggerMsg('No tournament found.', 'error');
      setRingToDelete(null);
      return;
    }
    if (currentRings.length <= 1) {
      triggerMsg('You must keep at least one ring.', 'error');
      setRingToDelete(null);
      return;
    }
    
    const assignedToRing = referees.filter(r => r.courtAssignment === ringNameToRemove && r.courtAssignment !== 'Unassigned');
    if (assignedToRing.length > 0) {
      for (const ref of assignedToRing) {
        await saveRefereeToFirestore({ ...ref, courtAssignment: 'Unassigned', dutyRole: 'Unassigned', matchNo: '' });
      }
      setReferees(prev => prev.map(r => r.courtAssignment === ringNameToRemove ? { ...r, courtAssignment: 'Unassigned', dutyRole: 'Unassigned', matchNo: '' } : r));
    }

    const updatedRings = currentRings.filter(r => r !== ringNameToRemove);
    const updatedComp: Competition = {
      ...targetComp,
      rings: updatedRings,
    };
    const updatedComps = competitions.map(c => c.id === targetComp.id ? updatedComp : c);
    await saveCompsToStorage(updatedComps);
    if (rosterSelectedRing === ringNameToRemove) {
      setRosterSelectedRing('all');
    }
    setRingToDelete(null);
    triggerMsg(`Removed ${ringNameToRemove} successfully.`, 'ok');
  };

  const getRingGridCols = (count: number, fit: boolean = true) => {
    if (fit) {
      if (count <= 1) return 'grid-cols-1 max-w-2xl mx-auto';
      if (count === 2) return 'grid-cols-1 md:grid-cols-2';
      if (count === 3) return 'grid-cols-1 md:grid-cols-3';
      if (count === 4) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
      if (count === 5) return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5';
      if (count === 6) return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6';
      if (count === 7) return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7';
      if (count === 8) return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8';
      return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6';
    }
    if (count <= 1) return 'grid-cols-1 max-w-2xl mx-auto';
    if (count === 2) return 'grid-cols-1 md:grid-cols-2';
    if (count === 3) return 'grid-cols-1 md:grid-cols-3';
    if (count === 4) return 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4';
    if (count === 5) return 'grid-cols-1 md:grid-cols-3 xl:grid-cols-5';
    if (count === 6) return 'grid-cols-1 md:grid-cols-3 xl:grid-cols-6';
    return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullScreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullScreen(false)).catch(() => {});
    }
  };

  return (
    <div className={`theme-${theme} bg-ink text-text min-h-screen flex flex-col antialiased selection:bg-gold selection:text-slate-950 transition-colors duration-300`}>
      
      {/* HEADER BANNER */}
      <header className="bg-surface/90 backdrop-blur-md border-b border-line shadow-lg sticky top-0 z-50 transition-all duration-300 print:hidden">
        <div className={`${getLayoutWidthClass()} mx-auto px-4 py-3 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4`}>
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => role ? setScreen(role === 'admin' ? 'adminHome' : role === 'organizer' ? 'organizerDashboard' : role === 'official' ? 'officialScan' : role === 'public' ? 'publicView' : 'coachHome') : setScreen('login')}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-hong to-chong p-0.5 shadow-md flex items-center justify-center">
              <div className="w-full h-full rounded-full bg-ink flex items-center justify-center">
                <Trophy className="w-5 h-5 text-gold" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold uppercase tracking-wider font-sans text-text">MY-TKD REGS</h1>
                {role === 'admin' && (
                  <>
                    <span className="text-[10px] uppercase font-bold tracking-widest bg-gold/10 text-gold px-2 py-0.5 rounded border border-gold/20">Skill Matrix</span>
                    <span className="text-[10px] uppercase font-bold tracking-widest bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1"><Database className="w-3 h-3" /><span>Cloud Synced</span></span>
                  </>
                )}
              </div>
              <p className="text-[10px] text-text-dim">Taekwondo Championship Registration & Weigh-In Core</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
            {/* THEME STATION BUTTON */}
            <button 
              onClick={() => setShowThemeModal(true)}
              className="flex items-center space-x-1.5 text-xs bg-surface-2 hover:bg-line border border-line text-gold px-3.5 py-1.5 rounded-xl transition duration-200 shadow-sm"
              id="theme-station-btn"
            >
              <Palette className="w-4 h-4 text-gold" />
              <span className="font-bold tracking-wide uppercase">Theme Station</span>
            </button>

            {/* RIC DASHBOARD BUTTON */}
            {(activeReferee?.specialRole === 'RIC' || role === 'admin' || role === 'organizer') && (
              <button 
                onClick={() => setScreen('ricDashboard')}
                className="flex items-center space-x-1.5 text-xs bg-amber-500/10 hover:bg-gold/20 border border-gold/40 text-gold px-3.5 py-1.5 rounded-xl transition duration-200 shadow-sm cursor-pointer"
                id="ric-dashboard-nav-btn"
                title="Referee-In-Charge Dashboard"
              >
                <Sliders className="w-4 h-4 text-gold" />
                <span className="font-bold tracking-wide uppercase">RIC Terminal</span>
              </button>
            )}

            {/* ATHLETE DATABASE BUTTON */}
            {role === 'admin' && (
              <button 
                onClick={() => setShowAthleteDbModal(true)}
                className="flex items-center space-x-1.5 text-xs bg-surface-2 hover:bg-line border border-line text-gold px-3.5 py-1.5 rounded-xl transition duration-200 shadow-sm cursor-pointer"
                id="athlete-database-btn"
              >
                <Database className="w-4 h-4 text-gold" />
                <span className="font-bold tracking-wide uppercase">Athlete Database</span>
              </button>
            )}

            {role && (
              <div className="flex items-center space-x-3 text-xs bg-surface-2 px-3 py-1.5 rounded-xl border border-line shadow-sm">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-text-dim">Terminal:</span>
                <span className="font-bold text-gold uppercase">{role}</span>
                {user && <span className="text-text-dim opacity-75">({user})</span>}
                <button 
                  onClick={logout}
                  className="ml-2 pl-2 border-l border-line text-hong hover:text-opacity-80 transition flex items-center gap-1 font-semibold"
                  id="header-logout-btn"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Exit</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* CORE ALERTS */}
      {msg && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] px-4 w-full max-w-md animate-fade-in">
          <div className={`flex items-start space-x-3 p-4 rounded-xl border text-sm shadow-2xl backdrop-blur-md ${
            msg.type === 'error' 
              ? 'bg-red-950/95 border-red-500/55 text-red-200' 
              : 'bg-emerald-950/95 border-emerald-500/55 text-emerald-200'
          }`}>
            <AlertCircle className={`w-5 h-5 shrink-0 ${msg.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`} />
            <div className="flex-grow">
              <p className="font-bold uppercase tracking-wider text-[10px] opacity-70 mb-0.5">
                {msg.type === 'error' ? 'System Warning' : 'Success Notification'}
              </p>
              <span className="font-medium text-xs leading-relaxed">{msg.text}</span>
            </div>
          </div>
        </div>
      )}

      {/* VIEW ENGINE CONTAINER */}
      <main className={`flex-grow ${getLayoutWidthClass()} w-full mx-auto px-4 py-6 sm:px-6 lg:px-8 print:hidden`}>
        
        {/* LOGIN SCREEN */}
        {screen === 'login' && (
          <div className="max-w-[520px] mx-auto my-12 bg-surface rounded-2xl shadow-xl border border-line overflow-hidden transition-all duration-300">
            <div className="p-6 sm:p-8 bg-gradient-to-b from-surface-2/50 to-transparent border-b border-line text-center">
              <Trophy className="w-10 h-10 text-gold mx-auto mb-2 animate-bounce" />
              <h2 className="text-xl sm:text-2xl font-bold uppercase tracking-wider text-text">Championship Portal</h2>
              <p className="text-xs sm:text-sm text-text-dim mt-1">Unlock your certified team access terminal</p>
            </div>

            {/* TAB SELECTOR */}
            <div className="flex border-b border-line overflow-x-auto scrollbar-none px-2 sm:px-4 bg-ink/20">
              <button 
                onClick={() => setLoginTab('coach')}
                className={`flex-1 min-w-[75px] py-3 text-[11px] font-bold uppercase tracking-wider transition shrink-0 ${
                  loginTab === 'coach' ? 'border-b-2 border-gold text-gold bg-surface-2/20' : 'text-text-dim hover:text-text'
                }`}
              >
                Coach
              </button>
              <button 
                onClick={() => setLoginTab('organizer')}
                className={`flex-1 min-w-[85px] py-3 text-[11px] font-bold uppercase tracking-wider transition shrink-0 ${
                  loginTab === 'organizer' ? 'border-b-2 border-gold text-gold bg-surface-2/20' : 'text-text-dim hover:text-text'
                }`}
              >
                Organizer
              </button>
              <button 
                onClick={() => setLoginTab('official')}
                className={`flex-1 min-w-[75px] py-3 text-[11px] font-bold uppercase tracking-wider transition shrink-0 ${
                  loginTab === 'official' ? 'border-b-2 border-gold text-gold bg-surface-2/20' : 'text-text-dim hover:text-text'
                }`}
              >
                Official
              </button>
              <button 
                onClick={() => setLoginTab('referee')}
                className={`flex-1 min-w-[75px] py-3 text-[11px] font-bold uppercase tracking-wider transition shrink-0 ${
                  loginTab === 'referee' ? 'border-b-2 border-gold text-gold bg-surface-2/20' : 'text-text-dim hover:text-text'
                }`}
              >
                Referee
              </button>
              <button 
                onClick={() => setLoginTab('ric')}
                className={`flex-1 min-w-[65px] py-3 text-[11px] font-bold uppercase tracking-wider transition shrink-0 ${
                  loginTab === 'ric' ? 'border-b-2 border-gold text-gold bg-surface-2/20' : 'text-text-dim hover:text-text'
                }`}
                id="login-tab-ric"
              >
                RIC
              </button>
              <button 
                onClick={() => setLoginTab('admin')}
                className={`flex-1 min-w-[65px] py-3 text-[11px] font-bold uppercase tracking-wider transition shrink-0 ${
                  loginTab === 'admin' ? 'border-b-2 border-gold text-gold bg-surface-2/20' : 'text-text-dim hover:text-text'
                }`}
              >
                Admin
              </button>
              <button 
                onClick={() => setLoginTab('public')}
                className={`flex-1 min-w-[100px] py-3 text-[11px] font-bold uppercase tracking-wider transition shrink-0 ${
                  loginTab === 'public' ? 'border-b-2 border-gold text-gold bg-surface-2/20' : 'text-text-dim hover:text-text'
                }`}
              >
                Public View
              </button>
            </div>

            <div className="p-6 sm:p-8 space-y-4">
              {loginTab === 'coach' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Select active tournament</label>
                    <select 
                      value={cComp}
                      onChange={(e) => setCComp(e.target.value)}
                      className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
                    >
                      {competitions.filter(c => c.isActive !== false).length === 0 ? (
                        <option value="">No active tournaments available...</option>
                      ) : (
                        competitions.filter(c => c.isActive !== false).map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Coach Account Identifier</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={cUser} 
                        onChange={(e) => setCUser(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCoachLogin(); }}
                        className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text pl-10 focus:outline-none focus:border-gold transition"
                      />
                      <User className="w-4 h-4 text-text-dim/60 absolute left-3.5 top-3" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Access Password</label>
                    <div className="relative">
                      <input 
                        type="password" 
                        value={cPass} 
                        onChange={(e) => setCPass(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCoachLogin(); }}
                        className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text pl-10 focus:outline-none focus:border-gold transition"
                      />
                      <Lock className="w-4 h-4 text-text-dim/60 absolute left-3.5 top-3" />
                    </div>
                  </div>
                  <button 
                    onClick={handleCoachLogin}
                    className="w-full bg-gold hover:opacity-90 text-ink font-bold py-2.5 rounded-xl text-sm transition mt-2 cursor-pointer shadow-md hover:shadow"
                    id="coach-login-btn"
                  >
                    Enter Roster Dashboard
                  </button>
                  <p className="text-center text-xs text-text-dim pt-2">
                    Don't have a coach credentials token? {' '}
                    <button 
                      onClick={() => setScreen('coachSignup')}
                      className="text-gold underline font-semibold hover:text-opacity-80"
                    >
                      Register New Coach Token
                    </button>
                    <br />
                    <button 
                      onClick={() => setShowForgotPassword(true)}
                      className="text-text-dim underline mt-2 hover:text-text transition"
                    >
                      Forgot Password?
                    </button>
                  </p>
                </div>
              )}

              {loginTab === 'referee' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">NRIC Number (e.g. 850101-14-5555)</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        placeholder="Enter registered NRIC"
                        value={refereeLoginNric} 
                        onChange={(e) => setRefereeLoginNric(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRefereeLogin(); }}
                        className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text pl-10 focus:outline-none focus:border-gold transition"
                      />
                      <User className="w-4 h-4 text-text-dim/60 absolute left-3.5 top-3" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Password</label>
                    <div className="relative">
                      <input 
                        type="password" 
                        placeholder="Enter password"
                        value={refereeLoginPassword} 
                        onChange={(e) => setRefereeLoginPassword(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRefereeLogin(); }}
                        className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text pl-10 focus:outline-none focus:border-gold transition"
                      />
                      <Lock className="w-4 h-4 text-text-dim/60 absolute left-3.5 top-3" />
                    </div>
                  </div>
                  <button 
                    onClick={handleRefereeLogin}
                    className="w-full bg-gold hover:opacity-90 text-ink font-bold py-2.5 rounded-xl text-sm transition mt-2 cursor-pointer shadow-md hover:shadow"
                  >
                    Enter Referee Dashboard
                  </button>
                  <p className="text-center text-xs text-text-dim pt-2">
                    Not registered as a referee yet? {' '}
                    <button 
                      onClick={() => { setPendingPhoto(null); setScreen('refereeSignup'); }}
                      className="text-gold underline font-semibold hover:text-opacity-80"
                    >
                      Register New Referee
                    </button>
                    <br />
                    <button 
                      onClick={() => setShowForgotPassword(true)}
                      className="text-text-dim underline mt-2 hover:text-text transition"
                    >
                      Forgot Password?
                    </button>
                  </p>
                </div>
              )}

              {loginTab === 'ric' && (
                <div className="space-y-3">
                  <div className="p-3 bg-amber-500/10 border border-gold/30 rounded-xl text-xs text-gold flex items-center gap-2 mb-2">
                    <Sliders className="w-4 h-4 shrink-0 text-gold" />
                    <span>Authorized access for designated <strong>Referee-in-Charge (RIC)</strong> personnel assigned by Administrator.</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Select Tournament Event</label>
                    <select 
                      value={ricLoginComp}
                      onChange={(e) => setRicLoginComp(e.target.value)}
                      className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
                    >
                      {competitions.filter(c => c.isActive !== false).length === 0 ? (
                        <option value="">No active tournaments available...</option>
                      ) : (
                        competitions.filter(c => c.isActive !== false).map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">RIC NRIC Number (e.g. 850101-14-5555)</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        placeholder="Enter registered NRIC"
                        value={ricLoginNric} 
                        onChange={(e) => setRicLoginNric(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRicLogin(); }}
                        className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text pl-10 focus:outline-none focus:border-gold transition"
                      />
                      <User className="w-4 h-4 text-text-dim/60 absolute left-3.5 top-3" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Password</label>
                    <div className="relative">
                      <input 
                        type="password" 
                        placeholder="Enter password"
                        value={ricLoginPassword} 
                        onChange={(e) => setRicLoginPassword(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRicLogin(); }}
                        className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text pl-10 focus:outline-none focus:border-gold transition"
                      />
                      <Lock className="w-4 h-4 text-text-dim/60 absolute left-3.5 top-3" />
                    </div>
                  </div>

                  <button 
                    onClick={handleRicLogin}
                    className="w-full bg-gold hover:opacity-90 text-ink font-bold py-2.5 rounded-xl text-sm transition mt-2 cursor-pointer shadow-md hover:shadow flex items-center justify-center gap-2"
                    id="ric-login-btn"
                  >
                    <Sliders className="w-4 h-4" />
                    <span>Enter RIC Terminal</span>
                  </button>

                  <p className="text-center text-xs text-text-dim pt-2">
                    Not assigned as RIC? Contact the Tournament Administrator or Organizer to set your special role to RIC.
                    <br />
                    <button 
                      onClick={() => setShowForgotPassword(true)}
                      className="text-text-dim underline mt-2 hover:text-text transition"
                    >
                      Forgot Password?
                    </button>
                  </p>
                </div>
              )}

              {loginTab === 'organizer' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Organizer Username</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={cUser} 
                        onChange={(e) => setCUser(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleOrganizerLogin(); }}
                        className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text pl-10 focus:outline-none focus:border-gold transition"
                      />
                      <User className="w-4 h-4 text-text-dim/60 absolute left-3.5 top-3" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Access Password</label>
                    <div className="relative">
                      <input 
                        type="password" 
                        value={cPass} 
                        onChange={(e) => setCPass(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleOrganizerLogin(); }}
                        className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text pl-10 focus:outline-none focus:border-gold transition"
                      />
                      <Lock className="w-4 h-4 text-text-dim/60 absolute left-3.5 top-3" />
                    </div>
                  </div>
                  <button 
                    onClick={handleOrganizerLogin}
                    className="w-full bg-gold hover:opacity-90 text-ink font-bold py-2.5 rounded-xl text-sm transition mt-2 cursor-pointer shadow-md hover:shadow"
                  >
                    Access Organizer Panel
                  </button>
                </div>
              )}

              {loginTab === 'official' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Select active tournament</label>
                    <select 
                      value={oComp}
                      onChange={(e) => setOComp(e.target.value)}
                      className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
                    >
                      {competitions.filter(c => c.isActive !== false).length === 0 ? (
                        <option value="">No active tournaments available...</option>
                      ) : (
                        competitions.filter(c => c.isActive !== false).map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Staff Security Passcode</label>
                    <div className="relative">
                      <input 
                        type="password" 
                        value={oCode} 
                        onChange={(e) => setOCode(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleOfficialLogin(); }}
                        className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text pl-10 focus:outline-none focus:border-gold transition"
                      />
                      <Lock className="w-4 h-4 text-text-dim/60 absolute left-3.5 top-3" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Station ID (e.g., Station 1)</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={oStation} 
                        onChange={(e) => setOStation(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleOfficialLogin(); }}
                        className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text pl-10 focus:outline-none focus:border-gold transition"
                      />
                      <MapPin className="w-4 h-4 text-text-dim/60 absolute left-3.5 top-3" />
                    </div>
                  </div>
                  <button 
                    onClick={handleOfficialLogin}
                    className="w-full bg-gold hover:opacity-90 text-ink font-bold py-2.5 rounded-xl text-sm transition mt-2 cursor-pointer shadow-md hover:shadow"
                    id="official-login-btn"
                  >
                    Unlock Official Terminal
                  </button>
                </div>
              )}

              {loginTab === 'admin' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Admin Username</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={aUser} 
                        onChange={(e) => setAUser(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAdminLogin(); }}
                        className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text pl-10 focus:outline-none focus:border-gold transition"
                      />
                      <User className="w-4 h-4 text-text-dim/60 absolute left-3.5 top-3" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Root Passcode</label>
                    <div className="relative">
                      <input 
                        type="password" 
                        value={aPass} 
                        onChange={(e) => setAPass(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAdminLogin(); }}
                        className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text pl-10 focus:outline-none focus:border-gold transition"
                      />
                      <Lock className="w-4 h-4 text-text-dim/60 absolute left-3.5 top-3" />
                    </div>
                  </div>
                  <button 
                    onClick={handleAdminLogin}
                    className="w-full bg-gold hover:opacity-90 text-ink font-bold py-2.5 rounded-xl text-sm transition mt-2 cursor-pointer shadow-md"
                    id="admin-login-btn"
                  >
                    Access System Root
                  </button>
                </div>
              )}

              {loginTab === 'public' && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Select Tournament to Query</label>
                    <select 
                      value={cComp}
                      onChange={(e) => { setCComp(e.target.value); setPublicPassInput(''); }}
                      className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
                    >
                      {competitions.filter(c => c.isActive !== false).length === 0 ? (
                        <option value="">No active tournaments available...</option>
                      ) : (
                        competitions.filter(c => c.isActive !== false).map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))
                      )}
                    </select>
                  </div>

                  {(() => {
                    const sel = competitions.find(c => c.id === cComp);
                    if (sel && sel.publicViewPassword) {
                      return (
                        <div className="animate-fade-in space-y-1.5">
                          <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest flex items-center gap-1">
                            <Lock className="w-3.5 h-3.5 text-gold" />
                            Public Access Password
                          </label>
                          <div className="relative">
                            <input 
                              type="password" 
                              placeholder="Enter public view password"
                              value={publicPassInput} 
                              onChange={(e) => setPublicPassInput(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handlePublicLogin(); }}
                              className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text pl-10 focus:outline-none focus:border-gold transition"
                            />
                            <Lock className="w-4 h-4 text-text-dim/60 absolute left-3.5 top-3" />
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  
                  <button 
                    onClick={handlePublicLogin}
                    className="w-full bg-gold hover:opacity-90 text-ink font-bold py-2.5 rounded-xl text-sm transition mt-2 cursor-pointer shadow-md hover:shadow flex items-center justify-center gap-2"
                  >
                    <Users className="w-4 h-4" />
                    Enter Public View
                  </button>
                  
                  <p className="text-center text-[10px] text-text-dim leading-normal pt-2">
                    Access to registered competitor profiles, team classifications, and weigh-in results. Actions are read-only.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* FORGOT PASSWORD MODAL */}
        {showForgotPassword && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-surface border border-line rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
              <div className="p-5 border-b border-line flex justify-between items-center bg-surface-2/30">
                <h2 className="font-bold text-text uppercase tracking-widest text-sm flex items-center gap-2">
                  <Lock className="w-4 h-4 text-gold" />
                  Recover Password
                </h2>
                <button 
                  onClick={() => {
                    setShowForgotPassword(false);
                    setRecoveredPassword(null);
                    setFpUsername('');
                    setFpNric('');
                    setFpName('');
                    setFpPhone('');
                  }}
                  className="text-text-dim hover:text-text transition p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                {recoveredPassword ? (
                  <div className="text-center py-6 space-y-4">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gold/10 mb-2">
                      <Lock className="w-6 h-6 text-gold" />
                    </div>
                    <p className="text-sm text-text-dim">Your recovered password is:</p>
                    <div className="bg-ink border border-line rounded-xl py-3 px-4 text-center">
                      <span className="font-mono font-bold text-lg text-text select-all">{recoveredPassword}</span>
                    </div>
                    <button 
                      onClick={() => {
                        setShowForgotPassword(false);
                        setRecoveredPassword(null);
                      }}
                      className="w-full bg-surface-2 hover:bg-surface border border-line text-text text-xs font-bold py-2.5 rounded-xl transition"
                    >
                      Close & Return to Login
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-[11px] text-text-dim leading-relaxed mb-4">
                      To recover your password, please provide your registration details. Enter your Username if you are a Coach, or NRIC if you are a Referee.
                    </p>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-text-dim uppercase tracking-wider mb-1.5">1. Username (For Coaches Only)</label>
                        <input 
                          type="text" 
                          value={fpUsername} 
                          onChange={(e) => setFpUsername(e.target.value)}
                          placeholder="e.g. jdoe_coach"
                          className="w-full bg-ink border border-line focus:border-gold rounded-xl px-3 py-2 text-sm text-text outline-none transition"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-[10px] font-bold text-text-dim uppercase tracking-wider mb-1.5">2. NRIC Number (For Referees Only)</label>
                        <input 
                          type="text" 
                          value={fpNric} 
                          onChange={(e) => setFpNric(e.target.value)}
                          placeholder="e.g. 850101145555"
                          className="w-full bg-ink border border-line focus:border-gold rounded-xl px-3 py-2 text-sm text-text outline-none transition"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-[10px] font-bold text-text-dim uppercase tracking-wider mb-1.5">3. Registered Name (Required)</label>
                        <input 
                          type="text" 
                          value={fpName} 
                          onChange={(e) => setFpName(e.target.value)}
                          placeholder="Your full registered name"
                          className="w-full bg-ink border border-line focus:border-gold rounded-xl px-3 py-2 text-sm text-text outline-none transition"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-[10px] font-bold text-text-dim uppercase tracking-wider mb-1.5">4. Registered Phone Number (Required)</label>
                        <input 
                          type="tel" 
                          value={fpPhone} 
                          onChange={(e) => setFpPhone(e.target.value)}
                          placeholder="e.g. 0123456789"
                          className="w-full bg-ink border border-line focus:border-gold rounded-xl px-3 py-2 text-sm text-text outline-none transition"
                        />
                      </div>
                    </div>
                    
                    <div className="pt-2">
                      <button 
                        onClick={handleRecoverPassword}
                        className="w-full bg-gold hover:bg-gold/90 text-ink text-sm font-bold py-2.5 rounded-xl transition shadow-md"
                      >
                        Recover Password
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* COACH SIGNUP */}
        {screen === 'coachSignup' && (
          <div className="max-w-md mx-auto my-12 bg-surface rounded-2xl shadow-xl border border-line overflow-hidden transition-all duration-300">
            <div className="p-6 bg-gradient-to-b from-surface-2/50 to-transparent border-b border-line text-center">
              <UserPlus className="w-10 h-10 text-gold mx-auto mb-2" />
              <h2 className="text-xl font-bold uppercase tracking-wider text-text font-sans">New Coach Token</h2>
              <p className="text-xs text-text-dim mt-1">Acquire an authorization credentials block</p>
            </div>

            <div className="p-6 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Coach Username</label>
                  <input 
                  type="text" 
                  value={sUser} 
                  onChange={(e) => setSUser(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCoachSignup(); }}
                  className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Password</label>
                  <input 
                  type="password" 
                  value={sPass} 
                  onChange={(e) => setSPass(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCoachSignup(); }}
                  className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Full Coach Name</label>
                <input 
                  type="text" 
                  value={sName} 
                  onChange={(e) => setSName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCoachSignup(); }}
                  placeholder="Ali Bin Ahmad" 
                  className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Representing Club/State</label>
                <input 
                  type="text" 
                  value={sClub} 
                  onChange={(e) => setSClub(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCoachSignup(); }}
                  placeholder="PERSATUAN TAEKWONDO NEGERI PERAK" 
                  className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Phone Number</label>
                <input 
                  type="tel" 
                  value={sPhone} 
                  onChange={(e) => setSPhone(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCoachSignup(); }}
                  placeholder="+6012-3456789" 
                  className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Email Address</label>
                <input 
                  type="email" 
                  value={sEmail} 
                  onChange={(e) => setSEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCoachSignup(); }}
                  placeholder="coach@example.com" 
                  className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
                />
              </div>

              <button 
                onClick={handleCoachSignup}
                className="w-full bg-gold hover:opacity-90 text-ink font-bold py-2.5 rounded-xl text-sm transition mt-4 cursor-pointer shadow-md"
              >
                Activate Coach Credentials
              </button>

              <p className="text-center text-xs text-text-dim pt-2">
                Already authorized? {' '}
                <button 
                  onClick={() => setScreen('login')}
                  className="text-gold underline font-semibold hover:text-opacity-80"
                >
                  Return to portal login
                </button>
              </p>
            </div>
          </div>
        )}

        {/* REFEREE SIGNUP */}
        {screen === 'refereeSignup' && (
          <div className="max-w-3xl mx-auto my-8 bg-surface rounded-2xl shadow-xl border border-line overflow-hidden transition-all duration-300">
            <div className="p-6 bg-gradient-to-b from-surface-2/50 to-transparent border-b border-line text-center">
              <Scale className="w-10 h-10 text-gold mx-auto mb-2 animate-pulse" />
              <h2 className="text-xl font-bold uppercase tracking-wider text-text font-sans">Referee Registration</h2>
              <p className="text-xs text-text-dim mt-1">Register your global referee officiating profile</p>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Referee Photograph */}
                <div className="md:col-span-2 bg-ink/30 p-4 rounded-xl border border-line">
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Referee Portrait Photograph (4:5 ratio) *</label>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="w-full text-xs text-text-dim bg-ink border border-line file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-surface-2 file:text-gold hover:file:opacity-90 transition cursor-pointer"
                  />
                  {pendingPhoto && (
                    <div className="mt-4 flex items-center space-x-3">
                      <img 
                        src={pendingPhoto} 
                        alt="Crop preview" 
                        className="w-20 h-24 object-cover rounded-lg border border-line" 
                      />
                      <span className="text-xs text-text-dim">Portrait automatically optimized and cropped (192 x 240 pixels) for your referee pass.</span>
                    </div>
                  )}
                </div>

                {/* Personal Information */}
                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Full Name (as per NRIC) *</label>
                  <input 
                    type="text" 
                    value={refereeFullName} 
                    onChange={(e) => setRefereeFullName(e.target.value)}
                    placeholder="e.g. TAN KIAN MENG"
                    className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">NRIC Number *</label>
                  <input 
                    type="text" 
                    value={refereeNric} 
                    onChange={(e) => setRefereeNric(e.target.value)}
                    placeholder="e.g. 850101-14-5555"
                    className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Password *</label>
                  <input 
                    type="password" 
                    value={refereePassword} 
                    onChange={(e) => setRefereePassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Phone Number *</label>
                  <input 
                    type="tel" 
                    value={refereePhone} 
                    onChange={(e) => setRefereePhone(e.target.value)}
                    placeholder="e.g. 012-3456789"
                    className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">State / Club Name *</label>
                  <input 
                    type="text" 
                    value={refereeClubName} 
                    onChange={(e) => setRefereeClubName(e.target.value)}
                    placeholder="e.g. PERAK TKD CLUB"
                    className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
                  />
                </div>

                {/* Logistics */}
                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Residential Location *</label>
                  <input 
                    type="text" 
                    value={refereeResidential} 
                    onChange={(e) => setRefereeResidential(e.target.value)}
                    placeholder="e.g. Ipoh, Perak"
                    className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Distance to Venue (Go & Return in KM) *</label>
                  <input 
                    type="number" 
                    value={refereeDistance} 
                    onChange={(e) => setRefereeDistance(e.target.value)}
                    placeholder="e.g. 120"
                    className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
                  />
                  <p className="text-[10px] text-text-dim/80 mt-1">Total combined distance (return trip) base on Google Maps/Waze.</p>
                </div>

                {/* Bank details */}
                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Bank Name *</label>
                  <input 
                    type="text" 
                    value={refereeBankName} 
                    onChange={(e) => setRefereeBankName(e.target.value)}
                    placeholder="e.g. Maybank"
                    className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Bank Account Number *</label>
                  <input 
                    type="text" 
                    value={refereeBankAccount} 
                    onChange={(e) => setRefereeBankAccount(e.target.value)}
                    placeholder="e.g. 164012345678"
                    className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
                  />
                </div>

                {/* Statuses */}
                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Kyorugi Referee Status *</label>
                  <select 
                    value={refereeKyorugiStatus} 
                    onChange={(e) => setRefereeKyorugiStatus(e.target.value as any)}
                    className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
                  >
                    <option value="TR">Trainee Referee (TR)</option>
                    <option value="SR">State Referee (SR)</option>
                    <option value="NR">National Referee (NR)</option>
                    <option value="IR">International Referee (IR)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Poomsae Referee Status *</label>
                  <select 
                    value={refereePoomsaeStatus} 
                    onChange={(e) => setRefereePoomsaeStatus(e.target.value as any)}
                    className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
                  >
                    <option value="TR">Trainee Referee (TR)</option>
                    <option value="SR">State Referee (SR)</option>
                    <option value="NR">National Referee (NR)</option>
                    <option value="IR">International Referee (IR)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Accommodation Required? *</label>
                  <select 
                    value={refereeAccommodation} 
                    onChange={(e) => setRefereeAccommodation(e.target.value as any)}
                    className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
                  >
                    <option value="No">No - I will arrange my own</option>
                    <option value="Yes">Yes - Organizer to arrange</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Car Plate Number</label>
                  <input 
                    type="text" 
                    value={refereeCarPlate} 
                    onChange={(e) => setRefereeCarPlate(e.target.value)}
                    placeholder="e.g. WQY 1234"
                    className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold uppercase"
                  />
                  <p className="text-[10px] text-text-dim/80 mt-1">Required to reserve car park space for referees.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Special Appointed Role</label>
                  <select 
                    value={refereeSpecialRole} 
                    onChange={(e) => setRefereeSpecialRole(e.target.value as any)}
                    className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
                  >
                    <option value="None">None (Standard Referee)</option>
                    <option value="TD">Technical Delegate (TD)</option>
                    <option value="CSB">Supervisory Board (CSB)</option>
                    <option value="RIC">Referee In-Charge (RIC)</option>
                    <option value="GAME_MASTER">Game Master (GM) - Virtual Taekwondo</option>
                    <option value="TECHNICAL_OPERATOR">Technical Operator (TO) - Virtual Taekwondo</option>
                    <option value="VIRTUAL_REFEREE">Virtual Referee (VR) - Virtual Taekwondo</option>
                  </select>
                </div>
              </div>

              {/* PDPA Consent Statement */}
              <div className="bg-surface-2 p-4 rounded-xl border border-line text-xs text-text-dim space-y-3">
                <p className="font-semibold text-gold uppercase tracking-wider text-[10px]">PDPA Personal Data Consent Statement</p>
                <p className="leading-relaxed text-[11px]">
                  I agree to the collection, processing and use of my personal data for the purpose of tournament registration, scheduling, officiating roles coordination, bank-in transactions, and accommodation/logistic arrangements, in accordance with the Personal Data Protection Act (PDPA).
                </p>
                <label className="flex items-start space-x-3 text-text cursor-pointer pt-1">
                  <input 
                    type="checkbox" 
                    checked={refereeConsent} 
                    onChange={(e) => setRefereeConsent(e.target.checked)}
                    className="mt-0.5 rounded border-line text-gold focus:ring-gold bg-ink w-4 h-4 cursor-pointer"
                  />
                  <span className="font-semibold text-xs select-none">I agree to the collection, processing and use of my personal data *</span>
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setScreen('login')}
                  className="flex-1 border border-line text-text font-bold py-2.5 rounded-xl text-sm transition hover:bg-surface-2 cursor-pointer text-center animate-none"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleRefereeRegister}
                  className="flex-1 bg-gold hover:opacity-90 text-ink font-bold py-2.5 rounded-xl text-sm transition cursor-pointer shadow-md"
                >
                  Submit Registration
                </button>
              </div>
            </div>
          </div>
        )}

        {/* COACH HOME - TOURNAMENT SELECTOR */}
        {screen === 'coachHome' && (
          <div className="space-y-6">
            <div className="bg-surface p-6 rounded-2xl border border-line shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-xl font-bold uppercase tracking-wider text-text flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-gold" />
                  <span>Welcome back, Coach {coaches[user || '']?.name}</span>
                </h2>
                <p className="text-xs text-text-dim mt-1">Representing: <strong className="text-text">{coaches[user || '']?.club}</strong></p>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
                  Verified Club Registrar Account
                </div>
                <button 
                  onClick={() => {
                    const c = coaches[user || ''];
                    if (c) {
                      setCoachEditName(c.name || '');
                      setCoachEditClub(c.club || '');
                      setCoachEditPhone(c.phone || '');
                      setCoachEditEmail(c.email || '');
                      setCoachEditPassword(c.password || '');
                      setShowCoachEditProfile(true);
                    }
                  }}
                  className="text-xs border border-line hover:border-gold text-text-dim hover:text-gold px-3 py-1.5 rounded-lg transition font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm"
                >
                  <Edit className="w-3 h-3" />
                  Edit Profile
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-text-dim uppercase tracking-wider">Select active championship tournament</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {competitions.filter(c => c.isActive !== false).length === 0 ? (
                  <div className="col-span-full bg-surface p-8 rounded-2xl border border-line text-center">
                    <Trophy className="w-8 h-8 text-text-dim/50 mx-auto mb-2" />
                    <p className="text-sm text-text-dim uppercase tracking-wider">No active tournaments available</p>
                  </div>
                ) : (
                  competitions.filter(c => c.isActive !== false).map(c => {
                    return (
                      <div 
                        key={c.id}
                        onClick={() => { setCompId(c.id); setScreen('coachRoster'); }}
                        className="bg-surface border border-line hover:border-gold/50 rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-1 shadow-sm hover:shadow group"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="bg-emerald-950 text-gold p-2.5 rounded-xl border border-emerald-900/50">
                            <Trophy className="w-5 h-5" />
                          </div>
                          <ChevronRight className="w-5 h-5 text-text-dim/70 group-hover:text-gold transition-colors" />
                        </div>
                        <h4 className="text-base font-bold text-text font-sans uppercase leading-tight group-hover:text-gold transition-colors">{c.name}</h4>
                        <p className="text-xs text-text-dim mt-2 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {c.venue}</p>
                        <p className="text-xs text-text-dim mt-1 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {formatDateRange(c.date, c.endDate)}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* COACH ROSTER DASHBOARD */}
        {screen === 'coachRoster' && activeComp && (
          <div className="space-y-6">
            
            {/* Top Back / Action bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface p-4 rounded-2xl border border-line">
              <div className="flex items-center space-x-3">
                <button 
                  onClick={() => setScreen('coachHome')}
                  className="text-xs text-gold border border-gold/30 px-3 py-1.5 rounded-lg hover:bg-gold/10 transition font-semibold"
                >
                  â† Back to tournaments
                </button>
                <div>
                  <h2 className="text-lg font-bold uppercase tracking-wider text-text font-sans">{activeComp.name}</h2>
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-text-dim">Club: <strong className="text-text">{coaches[user || '']?.club}</strong></p>
                    <button 
                      onClick={() => {
                        const c = coaches[user || ''];
                        if (c) {
                          setCoachEditName(c.name || '');
                          setCoachEditClub(c.club || '');
                          setCoachEditPhone(c.phone || '');
                          setCoachEditEmail(c.email || '');
                          setCoachEditPassword(c.password || '');
                          setShowCoachEditProfile(true);
                        }
                      }}
                      className="text-[10px] border border-line hover:border-gold text-text-dim hover:text-gold px-2 py-0.5 rounded transition font-bold uppercase tracking-wider flex items-center gap-1 shadow-sm"
                    >
                      <Edit className="w-3 h-3" />
                      Edit Profile
                    </button>
                  </div>
                </div>
              </div>
              {isRegistrationClosed(activeComp) ? (
                <div className="w-full sm:w-auto bg-surface-2 border border-line text-text-dim font-bold text-xs px-4 py-2 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed">
                  <Lock className="w-4 h-4" />
                  <span>Registration Closed</span>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      setExcelParsedPlayers([]);
                      setExcelValidationErrors([]);
                      setShowCoachExcelModal(true);
                    }}
                    className="w-full sm:w-auto bg-surface border border-gold/40 hover:bg-gold/10 text-gold font-bold text-xs px-4 py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Import via Excel</span>
                  </button>
                  <button
                    onClick={() => handleOpenCoachPlayerForm()}
                    className="w-full sm:w-auto bg-gold hover:opacity-90 text-ink font-bold text-xs px-4 py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Register New Athlete</span>
                  </button>
                </div>
              )}
            </div>

            {/* PAYMENT & BANKING SECTION FOR COACH */}
            {(() => {
              const coachClub = coaches[user || '']?.club || 'My Club';
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-surface p-6 rounded-2xl border border-line shadow-sm">
                  {/* Box 1: Bank Details provided by Organizer */}
                  <div className="space-y-4 flex flex-col justify-between">
                    <div>
                      <h3 className="text-[15px] font-bold text-gold uppercase tracking-wider flex items-center gap-2 mb-2">
                        <Lock className="w-4 h-4 text-gold" />
                        1. Bank details provided by organizer
                      </h3>
                      <p className="text-[13px] text-text-dim uppercase tracking-wider mb-3">Please use these credentials to pay registration fees</p>
                    </div>

                    <div className="bg-ink/30 p-4 rounded-xl border border-line/50 space-y-3">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center py-1.5 border-b border-line/30">
                          <span className="text-[13px] font-semibold text-text-dim uppercase">Bank Name</span>
                          <span className="text-[15px] font-bold text-text">{activeComp.bankName || <em className="text-text-dim">Not provided yet</em>}</span>
                        </div>
                        <div className="flex justify-between items-center py-1.5 border-b border-line/30">
                          <span className="text-[13px] font-semibold text-text-dim uppercase">Bank Account</span>
                          <span className="text-[15px] font-mono font-bold text-gold flex items-center gap-1.5">
                            {activeComp.bankAccount ? (
                              <>
                                {activeComp.bankAccount}
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(activeComp.bankAccount || '');
                                    triggerMsg('Bank account copied to clipboard!', 'ok');
                                  }}
                                  className="text-[12px] text-gold/80 hover:text-gold uppercase tracking-widest border border-gold/30 px-1.5 py-0.5 rounded hover:bg-gold/10 transition cursor-pointer"
                                >
                                  Copy
                                </button>
                              </>
                            ) : (
                              <em className="text-text-dim">Not provided yet</em>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Event Fees block */}
                      {(activeComp.kyorugiFee || activeComp.poomsaeFee || activeComp.paraFee || activeComp.virtualFee) && (
                        <div className="mt-2 p-2.5 bg-ink/20 rounded-xl border border-line/20 space-y-1.5">
                          <span className="block text-[11px] font-bold text-gold uppercase tracking-wider">Participant Event Fees:</span>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
                            {activeComp.kyorugiFee && (
                              <div className="flex justify-between items-center py-0.5 border-b border-line/10">
                                <span className="text-text-dim">Kyorugi:</span>
                                <span className="font-bold text-text font-mono">{activeComp.kyorugiFee}</span>
                              </div>
                            )}
                            {activeComp.poomsaeFee && (
                              <div className="flex justify-between items-center py-0.5 border-b border-line/10">
                                <span className="text-text-dim">Poomsae:</span>
                                <span className="font-bold text-text font-mono">{activeComp.poomsaeFee}</span>
                              </div>
                            )}
                            {activeComp.paraFee && (
                              <div className="flex justify-between items-center py-0.5 border-b border-line/10">
                                <span className="text-text-dim">Para:</span>
                                <span className="font-bold text-text font-mono">{activeComp.paraFee}</span>
                              </div>
                            )}
                            {activeComp.virtualFee && (
                              <div className="flex justify-between items-center py-0.5 border-b border-line/10">
                                <span className="text-text-dim">Virtual:</span>
                                <span className="font-bold text-text font-mono">{activeComp.virtualFee}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {activeComp.bankQrCode && (
                      <div className="flex items-center gap-3 bg-gold/5 p-2 rounded-lg border border-gold/20 mt-1">
                        <img 
                          src={activeComp.bankQrCode} 
                          alt="Scan QR to Pay" 
                          className="w-14 h-14 object-contain rounded bg-white p-0.5"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <p className="text-[13px] font-bold text-text uppercase tracking-wider">Scan to Pay QR</p>
                          <p className="text-[11px] text-text-dim">Scan with your banking app to transfer fees</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Box 2: Coach Receipt Upload */}
                  <div className="flex flex-col justify-between">
                    <div>
                      <h3 className="text-[15px] font-bold text-gold uppercase tracking-wider flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-gold" />
                        2. Coach to upload the payment receipt
                      </h3>
                      <p className="text-[13px] text-text-dim uppercase tracking-wider mb-3">Upload bank transaction receipt for your club registration ({coachClub})</p>
                    </div>

                    {(() => {
                      const clubKey = coachClub.toUpperCase();
                      const receipt = activeComp.receipts?.[clubKey];
                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center bg-ink/25 p-4 rounded-xl border border-line/50">
                          {/* Receipt Status and Thumbnail */}
                          <div className="flex flex-col items-center justify-center border border-dashed border-line/40 rounded-lg p-2 bg-ink/10 h-32">
                            {receipt ? (
                              <div className="relative group w-24 h-24 flex flex-col justify-center items-center">
                                <img 
                                  src={receipt.receiptUrl} 
                                  alt="Receipt preview" 
                                  className="w-full h-16 object-cover rounded cursor-pointer border border-line"
                                  onClick={() => setSelectedClubReceipt({ clubName: coachClub, receiptUrl: receipt.receiptUrl, uploadedAt: receipt.uploadedAt })}
                                  referrerPolicy="no-referrer"
                                />
                                <div className="text-[11px] text-green-400 font-bold mt-1 text-center truncate w-full flex items-center justify-center gap-0.5">
                                  <CheckCircle className="w-2.5 h-2.5 text-green-400" />
                                  <span>Submitted</span>
                                </div>
                                <div className="text-[10px] text-text-dim text-center truncate w-full">
                                  {receipt.uploadedAt}
                                </div>
                                <button
                                  onClick={() => {
                                    const updated = competitions.map(c => {
                                      if (c.id === compId) {
                                        const nextRecs = { ...(c.receipts || {}) };
                                        delete nextRecs[clubKey];
                                        return { ...c, receipts: nextRecs };
                                      }
                                      return c;
                                    });
                                    saveCompsToStorage(updated);
                                    triggerMsg('Receipt deleted.', 'ok');
                                  }}
                                  className="absolute -top-1.5 -right-1.5 bg-red-500/90 text-white p-1 rounded-full hover:bg-red-600 transition"
                                  title="Delete Receipt"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="text-center p-2">
                                <FileText className="w-8 h-8 text-text-dim/50 mx-auto mb-1" />
                                <span className="text-[13px] text-text-dim font-medium uppercase tracking-wider block">Pending</span>
                              </div>
                            )}
                          </div>

                          {/* Upload action */}
                          <div className="space-y-2">
                            <label className="flex flex-col items-center justify-center border border-dashed border-line/40 hover:border-gold/50 rounded-lg p-3 cursor-pointer bg-ink/20 hover:bg-ink/30 transition text-center h-24">
                              <Upload className="w-5 h-5 text-gold mb-1" />
                              <span className="text-[13px] font-bold text-text-dim uppercase">Upload Receipt</span>
                              <span className="text-[11px] text-text-dim">PNG/JPG up to 3MB</span>
                              <input 
                                type="file" 
                                accept="image/*" 
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  if (file.size > 3 * 1024 * 1024) {
                                    triggerMsg('Receipt file must be less than 3MB', 'error');
                                    return;
                                  }
                                  const reader = new FileReader();
                                  reader.onload = (evt) => {
                                    const base64 = evt.target?.result as string;
                                    handleUploadReceipt(coachClub, base64);
                                  };
                                  reader.readAsDataURL(file);
                                }}
                                className="hidden" 
                              />
                            </label>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })()}

            {/* Quick KPI stats for this tournament */}
            {(() => {
              const coachAthletes = players.filter(p => p.coachUsername === user);
              let coachKyorugiCount = 0;
              let coachPoomsaeCount = 0;
              let coachParaCount = 0;
              let coachVirtualCount = 0;

              coachAthletes.forEach(p => {
                const ev = (p.event || '').toLowerCase();
                if (ev.includes('kyorugi')) coachKyorugiCount++;
                else if (ev.includes('poomsae')) coachPoomsaeCount++;
                else if (ev.includes('para')) coachParaCount++;
                else if (ev.includes('virtual')) coachVirtualCount++;
              });

              const kyorugiPrice = parseFeeToNumber(activeComp.kyorugiFee);
              const poomsaePrice = parseFeeToNumber(activeComp.poomsaeFee);
              const paraPrice = parseFeeToNumber(activeComp.paraFee);
              const virtualPrice = parseFeeToNumber(activeComp.virtualFee);

              const kyorugiTotal = coachKyorugiCount * kyorugiPrice;
              const poomsaeTotal = coachPoomsaeCount * poomsaePrice;
              const paraTotal = coachParaCount * paraPrice;
              const virtualTotal = coachVirtualCount * virtualPrice;

              const grandTotal = kyorugiTotal + poomsaeTotal + paraTotal + virtualTotal;
              const sampleFee = activeComp.kyorugiFee || activeComp.poomsaeFee || activeComp.paraFee || activeComp.virtualFee;

              return (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {/* Card 1: Kyorugi */}
                  <div className="bg-surface p-4 rounded-xl border border-line flex flex-col justify-between">
                    <div>
                      <span className="block text-[10px] text-text-dim font-semibold uppercase tracking-wider">1. Kyorugi</span>
                      <span className="text-2xl font-black text-text mt-1 block">{coachKyorugiCount}</span>
                    </div>
                    {activeComp.kyorugiFee ? (
                      <div className="text-[10px] text-gold font-mono mt-2 pt-1.5 border-t border-line/20">
                        {coachKyorugiCount} Ã— {activeComp.kyorugiFee} = {formatCurrency(kyorugiTotal, sampleFee)}
                      </div>
                    ) : (
                      <div className="text-[10px] text-text-dim font-mono mt-2 pt-1.5 border-t border-line/20">
                        Fee not set
                      </div>
                    )}
                  </div>

                  {/* Card 2: Poomsae */}
                  <div className="bg-surface p-4 rounded-xl border border-line flex flex-col justify-between">
                    <div>
                      <span className="block text-[10px] text-text-dim font-semibold uppercase tracking-wider">2. Poomsae</span>
                      <span className="text-2xl font-black text-text mt-1 block">{coachPoomsaeCount}</span>
                    </div>
                    {activeComp.poomsaeFee ? (
                      <div className="text-[10px] text-gold font-mono mt-2 pt-1.5 border-t border-line/20">
                        {coachPoomsaeCount} Ã— {activeComp.poomsaeFee} = {formatCurrency(poomsaeTotal, sampleFee)}
                      </div>
                    ) : (
                      <div className="text-[10px] text-text-dim font-mono mt-2 pt-1.5 border-t border-line/20">
                        Fee not set
                      </div>
                    )}
                  </div>

                  {/* Card 3: Para */}
                  <div className="bg-surface p-4 rounded-xl border border-line flex flex-col justify-between">
                    <div>
                      <span className="block text-[10px] text-text-dim font-semibold uppercase tracking-wider">3. Para</span>
                      <span className="text-2xl font-black text-text mt-1 block">{coachParaCount}</span>
                    </div>
                    {activeComp.paraFee ? (
                      <div className="text-[10px] text-gold font-mono mt-2 pt-1.5 border-t border-line/20">
                        {coachParaCount} Ã— {activeComp.paraFee} = {formatCurrency(paraTotal, sampleFee)}
                      </div>
                    ) : (
                      <div className="text-[10px] text-text-dim font-mono mt-2 pt-1.5 border-t border-line/20">
                        Fee not set
                      </div>
                    )}
                  </div>

                  {/* Card 4: Virtual */}
                  <div className="bg-surface p-4 rounded-xl border border-line flex flex-col justify-between">
                    <div>
                      <span className="block text-[10px] text-text-dim font-semibold uppercase tracking-wider">4. Virtual</span>
                      <span className="text-2xl font-black text-text mt-1 block">{coachVirtualCount}</span>
                    </div>
                    {activeComp.virtualFee ? (
                      <div className="text-[10px] text-gold font-mono mt-2 pt-1.5 border-t border-line/20">
                        {coachVirtualCount} Ã— {activeComp.virtualFee} = {formatCurrency(virtualTotal, sampleFee)}
                      </div>
                    ) : (
                      <div className="text-[10px] text-text-dim font-mono mt-2 pt-1.5 border-t border-line/20">
                        Fee not set
                      </div>
                    )}
                  </div>

                  {/* Card 5: Total Amount */}
                  <div className="bg-gold/5 p-4 rounded-xl border border-gold/30 flex flex-col justify-between col-span-2 sm:col-span-1">
                    <div>
                      <span className="block text-[10px] text-gold font-bold uppercase tracking-wider">5. Total Amount</span>
                      <span className="text-2xl font-black text-gold mt-1 block font-mono">{formatCurrency(grandTotal, sampleFee)}</span>
                    </div>
                    <div className="text-[10px] text-text-dim mt-2 pt-1.5 border-t border-gold/20">
                      Total ({coachAthletes.length} registered)
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Table or Card list */}
            <div className="bg-surface rounded-2xl border border-line shadow-sm overflow-hidden">
              <div className="p-5 border-b border-line flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                  <h3 className="text-base font-bold text-text uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-5 h-5 text-gold" />
                    <span>Athlete Roster list</span>
                  </h3>
                  <p className="text-xs text-text-dim">Verify skill matrices, print QR ID cards, and monitor live weigh-in feedback.</p>
                </div>
                
                {/* Search Bar & Indemnity Forms */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                  <div className="relative w-full md:w-64">
                    <input 
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by name or code..."
                      className="w-full bg-ink border border-line text-xs rounded-xl py-2 pl-8 pr-4 text-text focus:outline-none focus:border-gold"
                    />
                    <Search className="w-3.5 h-3.5 text-text-dim/60 absolute left-2.5 top-2.5" />
                  </div>
                  <button
                    onClick={() => { setShowIndemnityDashboardModal(true); }}
                    className="bg-gold text-ink font-bold hover:bg-gold/95 px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition whitespace-nowrap shadow-md cursor-pointer"
                    title="Manage Athlete Indemnity Forms"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Indemnity Forms</span>
                  </button>
                </div>
              </div>

              {coachFilteredPlayers.length === 0 ? (
                <div className="p-12 text-center text-text-dim space-y-3">
                  <Users className="w-12 h-12 text-text-dim/50 mx-auto" />
                  <p className="text-sm font-semibold">No athletes registered in this division roster.</p>
                  <p className="text-xs">Click "Register New Athlete" to add your competitors manually.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-line bg-ink/40 text-text-dim font-semibold">
                        <th className="p-4">Competitor Code</th>
                        <th className="p-4">Name / Identity</th>
                        <th className="p-4">Division Event</th>
                        <th className="p-4">Age Group</th>
                        <th className="p-4">Weight Class</th>
                        <th className="p-4">Weigh-in Feedback</th>
                        <th className="p-4">Indemnity Form</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/40">
                      {coachFilteredPlayers.map(p => {
                        return (
                          <tr key={p.id} className="hover:bg-surface-2/30 transition">
                            <td className="p-4 font-mono text-gold font-bold">{p.id}</td>
                            <td className="p-4">
                              <div className="flex items-center space-x-3">
                                <div className="w-9 h-11 bg-ink rounded border border-line overflow-hidden flex items-center justify-center shrink-0">
                                  {p.photo ? (
                                    <img src={p.photo} alt={p.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <User className="w-4 h-4 text-text-dim/50" />
                                  )}
                                </div>
                                <div>
                                  <div className="font-bold text-text text-sm">{p.name}</div>
                                  <div className="text-[10px] text-text-dim">Club: {p.club}</div>
                                  {(p.schoolName || p.race) && (
                                    <div className="text-[10px] text-gold/80 font-mono mt-0.5">
                                      {p.schoolName && `School: ${p.schoolName} ${p.schoolCode ? `(${p.schoolCode})` : ''}`}
                                      {p.schoolName && p.race && ' Â· '}
                                      {p.race && `Race: ${p.race}`}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-4 font-semibold text-text">{p.event}</td>
                            <td className="p-4 text-text-dim">{p.ageGroup}</td>
                            <td className="p-4 text-text-dim">
                              <span className="font-medium">{p.weightClass}</span>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col gap-1 items-start">
                                {renderBadge(p.weighIn?.result)}
                                {p.weighIn && !activeComp?.hideScaleReadout && (
                                  <span className="text-[10px] text-text-dim">
                                    Observed: <strong>{p.weighIn.weight}kg</strong>
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono ${
                                  p.indemnityStatus === 'Completed'
                                    ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-amber-950/50 text-amber-400 border border-amber-500/20'
                                }`}>
                                  {p.indemnityStatus === 'Completed' ? 'Completed' : 'Pending'}
                                </span>
                                {p.indemnityStatus === 'Completed' ? (
                                  <button
                                    onClick={() => { setSelectedIndemnityPlayer(p); setShowViewIndemnityModal(true); }}
                                    className="text-gold hover:underline text-[10px] font-semibold flex items-center gap-0.5 shrink-0 cursor-pointer"
                                    title="View completed parental indemnity form"
                                  >
                                    <Eye className="w-3 h-3 text-gold" />
                                    <span>View</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      const url = window.location.origin + window.location.pathname + '?indemnity=' + p.id;
                                      navigator.clipboard.writeText(url);
                                      triggerMsg(`Indemnity form link copied for ${p.name}!`, 'ok');
                                    }}
                                    className="text-text-dim hover:text-gold text-[10px] font-semibold flex items-center gap-0.5 shrink-0 cursor-pointer"
                                    title="Copy parental indemnity form link"
                                  >
                                    <Copy className="w-3 h-3 text-text-dim" />
                                    <span>Copy Link</span>
                                  </button>
                                )}
                              </div>
                            </td>
                             <td className="p-4 text-right">
                               <div className="flex items-center justify-end space-x-2">
                                 <button 
                                   onClick={() => { setSelectedPlayerId(p.id); setScreen('idCard'); }}
                                   className="bg-emerald-950/40 text-gold hover:bg-emerald-900/50 p-1.5 rounded border border-emerald-900/50 transition"
                                   title="View QR ID Card"
                                 >
                                   <Eye className="w-4 h-4" />
                                 </button>
                                 {p.weighIn ? (
                                   <div 
                                     className="bg-ink/40 text-text-dim/40 p-1.5 rounded border border-line/30 cursor-not-allowed"
                                     title="Editing locked (Weigh-in complete)"
                                   >
                                     <Lock className="w-4 h-4" />
                                   </div>
                                 ) : (
                                   <button 
                                     onClick={() => handleOpenCoachPlayerForm(p.id)}
                                     className="bg-ink text-text-dim hover:text-text p-1.5 rounded border border-line transition"
                                     title="Edit Competitor Info"
                                   >
                                     <Edit className="w-4 h-4" />
                                   </button>
                                 )}
                               </div>
                             </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* REGISTER & EDIT ATHLETE FORM */}
        {screen === 'coachPlayerForm' && activeComp && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => setScreen(role === 'admin' ? 'adminCompDetail' : role === 'organizer' ? 'organizerDashboard' : 'coachRoster')}
                className="text-xs text-gold border border-gold/30 px-3 py-1.5 rounded-lg hover:bg-gold/10 transition"
              >
                â† Back
              </button>
              <h2 className="text-xl font-bold uppercase tracking-wider text-text">
                {selectedPlayerId ? 'Edit Athlete Record' : 'Register New Competitor'}
              </h2>
            </div>

            <div className="bg-surface rounded-2xl border border-line p-6 space-y-4">
              
              {!selectedPlayerId && (
                <div className="bg-surface-2 p-4 rounded-xl border border-line mb-4 relative">
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest">Search Saved Athlete Database</label>
                    {selectedMasterId && (
                      <span className="text-[10px] uppercase font-bold tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
                        Connected to DB
                      </span>
                    )}
                  </div>

                  {selectedMasterId && masterAthletes[selectedMasterId] ? (
                    <div className="bg-ink/50 border border-emerald-500/20 rounded-xl p-3 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-10 rounded bg-ink overflow-hidden flex items-center justify-center border border-line shrink-0">
                          {masterAthletes[selectedMasterId].photo ? (
                            <img src={masterAthletes[selectedMasterId].photo} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-4 h-4 text-text-dim/60" />
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-text">{masterAthletes[selectedMasterId].name}</div>
                          <div className="text-xs text-text-dim">IC: {masterAthletes[selectedMasterId].ic} Â· {masterAthletes[selectedMasterId].club}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedMasterId(null);
                          setPName('');
                          setPIc('');
                          setPDob('');
                          setPGender('');
                          setPClub('');
                          setPSchoolName('');
                          setPSchoolCode('');
                          setPRace('Malay');
                          setPendingPhoto(null);
                          setMasterSearchQuery('');
                        }}
                        className="text-xs text-hong hover:bg-hong/10 border border-hong/20 px-2.5 py-1.5 rounded-lg transition"
                      >
                        Disconnect Profile
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <input 
                          type="text" 
                          placeholder="Type to search saved athletes by Name, IC, or Club..." 
                          value={masterSearchQuery}
                          onChange={(e) => {
                            setMasterSearchQuery(e.target.value);
                            setShowMasterDropdown(true);
                          }}
                          onFocus={() => setShowMasterDropdown(true)}
                          className="w-full bg-ink border border-line text-sm rounded-xl py-2.5 pl-10 pr-10 text-text focus:outline-none focus:border-gold transition shadow-inner"
                        />
                        <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-text-dim" />
                        {masterSearchQuery && (
                          <button 
                            onClick={() => {
                              setMasterSearchQuery('');
                            }}
                            className="absolute right-3.5 top-2.5 text-text-dim hover:text-text font-bold text-base px-1"
                          >
                            Ã—
                          </button>
                        )}
                      </div>

                      {showMasterDropdown && (
                        <div className="absolute left-0 right-0 top-full mt-2 bg-surface border border-line rounded-xl shadow-2xl z-50 overflow-hidden max-h-60 flex flex-col">
                          <div className="p-2 bg-ink/30 border-b border-line flex justify-between items-center text-[10px] font-bold text-text-dim uppercase tracking-wider">
                            <span>
                              {masterSearchQuery 
                                ? `Search Results (${Object.values(masterAthletes).filter((ma: any) => {
                                    if (role === 'coach' && user) {
                                      const belongs = ma.coachUsername === user || (ma.club && coaches[user]?.club && ma.club === coaches[user].club);
                                      if (!belongs) return false;
                                    }
                                    const q = masterSearchQuery.toLowerCase();
                                    return ma.name?.toLowerCase().includes(q) || ma.ic?.toLowerCase().includes(q) || ma.club?.toLowerCase().includes(q);
                                  }).length})`
                                : `Recent Saved Profiles (Up to 5)`
                              }
                            </span>
                            <button 
                              onClick={() => setShowMasterDropdown(false)}
                              className="text-gold hover:underline font-bold"
                            >
                              Hide
                            </button>
                          </div>
                          
                          <div className="overflow-y-auto divide-y divide-line/40 flex-1">
                            {(() => {
                              const coachOwned = Object.values(masterAthletes).filter((ma: any) => {
                                if (role !== 'coach') return true;
                                if (!user) return false;
                                return ma.coachUsername === user || (ma.club && coaches[user]?.club && ma.club === coaches[user].club);
                              });
                              const list = coachOwned.filter((ma: any) => {
                                if (!masterSearchQuery) return true;
                                const q = masterSearchQuery.toLowerCase();
                                return (
                                  ma.name?.toLowerCase().includes(q) ||
                                  ma.ic?.toLowerCase().includes(q) ||
                                  ma.club?.toLowerCase().includes(q)
                                );
                              });

                              const displayList = masterSearchQuery ? list : list.slice(0, 5);

                              if (displayList.length === 0) {
                                return (
                                  <div className="p-4 text-center text-xs text-text-dim">
                                    No matching saved profiles found.
                                  </div>
                                );
                              }

                              return displayList.map((ma: any) => (
                                <div 
                                  key={ma.id}
                                  onClick={() => {
                                    setSelectedMasterId(ma.id);
                                    setPName(ma.name || '');
                                    setPIc(ma.ic || '');
                                    setPDob(ma.dob || '');
                                    setPGender(ma.gender || '');
                                    setPClub(ma.club || '');
                                    setPSchoolName(ma.schoolName || '');
                                    setPSchoolCode(ma.schoolCode || '');
                                    setPRace(ma.race || 'Malay');
                                    setPendingPhoto(ma.photo || null);
                                    setShowMasterDropdown(false);
                                    setMasterSearchQuery('');
                                  }}
                                  className="p-3 hover:bg-surface-2/60 cursor-pointer transition flex items-center justify-between"
                                >
                                  <div className="flex items-center space-x-3">
                                    <div className="w-8 h-10 rounded bg-ink overflow-hidden flex items-center justify-center border border-line shrink-0">
                                      {ma.photo ? (
                                        <img src={ma.photo} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                        <User className="w-4 h-4 text-text-dim/60" />
                                      )}
                                    </div>
                                    <div className="text-left">
                                      <div className="text-sm font-bold text-text">{ma.name}</div>
                                      <div className="text-xs text-text-dim">IC: {ma.ic} Â· {ma.club}</div>
                                    </div>
                                  </div>
                                  <span className="text-[10px] text-gold font-bold uppercase tracking-widest border border-gold/20 bg-gold/5 px-2 py-1 rounded-lg">
                                    Load Profile
                                  </span>
                                </div>
                              ));
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Full Legal Name *</label>
                <input 
                  type="text" 
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSavePlayer(); }}
                  placeholder="e.g. Athlete Ahmad" 
                  className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
                />
              </div>

              {(() => {
                const birthInfo = parseBirthInfo(pDob, pIc);
                const compYr = activeComp?.date ? new Date(activeComp.date).getFullYear() : new Date().getFullYear();
                const calcAge = birthInfo.birthYear ? (compYr - birthInfo.birthYear) : null;
                const autoMatchedGroup = getMatchingAgeGroup(pDob, pIc, activeComp.ageGroups, activeComp.date);

                return (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">IC Number *</label>
                        <input 
                          type="text" 
                          value={pIc}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPIc(val);
                            const info = parseBirthInfo(pDob, val);
                            if (info.dob && info.dob !== pDob) {
                              setPDob(info.dob);
                            }
                            if (activeComp?.ageGroups && activeComp.ageGroups.length > 0) {
                              const matched = getMatchingAgeGroup(pDob || info.dob, val, activeComp.ageGroups, activeComp.date);
                              if (matched) setPAgeGroup(matched);
                            }
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSavePlayer(); }}
                          placeholder="e.g. 050412-10-1234" 
                          className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Date of Birth *</label>
                        <input 
                          type="date" 
                          value={pDob}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPDob(val);
                            if (activeComp?.ageGroups && activeComp.ageGroups.length > 0) {
                              const matched = getMatchingAgeGroup(val, pIc, activeComp.ageGroups, activeComp.date);
                              if (matched) setPAgeGroup(matched);
                            }
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSavePlayer(); }}
                          className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
                        />
                        {birthInfo.birthYear && (
                          <p className="text-[11px] text-gold font-medium mt-1.5 flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5 text-gold shrink-0" />
                            <span>Born <strong>{birthInfo.birthYear}</strong> Â· Calculated Competition Age: <strong>{calcAge} Yrs Old</strong> ({compYr})</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Gender Division *</label>
                        <select 
                          value={pGender}
                          onChange={(e) => setPGender(e.target.value)}
                          className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
                        >
                          {activeComp.genders.map(g => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Affiliated Club / State *</label>
                        <select 
                          value={pClub}
                          onChange={(e) => setPClub(e.target.value)}
                          className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
                        >
                          {(globalClubs.length > 0
                            ? globalClubs
                            : Object.keys(DEMO_IMPORT.clubs)
                          ).map(club => (
                            <option key={club} value={club}>{club}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">School Name *</label>
                        <input 
                          type="text" 
                          value={pSchoolName}
                          onChange={(e) => setPSchoolName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSavePlayer(); }}
                          placeholder="e.g. SMK Saujana Utama" 
                          className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">School Code *</label>
                        <input 
                          type="text" 
                          value={pSchoolCode}
                          onChange={(e) => setPSchoolCode(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSavePlayer(); }}
                          placeholder="e.g. BEA1234" 
                          className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition uppercase"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Race *</label>
                        <select 
                          value={pRace}
                          onChange={(e) => setPRace(e.target.value)}
                          className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
                        >
                          <option value="Malay">Malay</option>
                          <option value="Chinese">Chinese</option>
                          <option value="Indian">Indian</option>
                          <option value="Bumiputera Sabah">Bumiputera Sabah</option>
                          <option value="Bumiputera Sarawak">Bumiputera Sarawak</option>
                          <option value="Others">Others</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Tournament Event *</label>
                        <select 
                          value={pEvent}
                          onChange={(e) => setPEvent(e.target.value)}
                          className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
                        >
                          {activeComp.events.map(ev => (
                            <option key={ev} value={ev}>{ev}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest">
                            Age Group Category *
                          </label>
                          {birthInfo.birthYear && (
                            <span className="text-[10px] text-gold font-bold bg-gold/10 border border-gold/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle className="w-2.5 h-2.5 text-gold shrink-0" />
                              <span>Auto-Matched (Born {birthInfo.birthYear})</span>
                            </span>
                          )}
                        </div>
                        <select 
                          value={pAgeGroup}
                          onChange={(e) => setPAgeGroup(e.target.value)}
                          className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition font-medium"
                        >
                          {activeComp.ageGroups.length === 0 ? (
                            <option value="">No age groups defined by admin</option>
                          ) : (
                            activeComp.ageGroups.map(ag => {
                              const isMatch = birthInfo.birthYear && ag === autoMatchedGroup;
                              return (
                                <option key={ag} value={ag}>
                                  {ag}{isMatch ? ` âœ“ (Matches Birth Year ${birthInfo.birthYear})` : ''}
                                </option>
                              );
                            })
                          )}
                        </select>
                        {birthInfo.birthYear && (
                          <p className="text-[10px] text-text-dim/80 mt-1 italic">
                            Category selected according to birth year <strong className="text-gold">{birthInfo.birthYear}</strong> (Age {calcAge} in {compYr}).
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}

              <div>
                <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Target Weight Class *</label>
                <select 
                  value={pWeightClass}
                  onChange={(e) => setPWeightClass(e.target.value)}
                  className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
                >
                  {activeComp.weightClasses.length === 0 ? (
                    <option value="">No weight classes defined by admin</option>
                  ) : (
                    activeComp.weightClasses.map(wc => (
                      <option key={wc} value={wc}>{wc}</option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Athlete Portrait Photograph</label>
                {pendingPhoto ? (
                  <div className="flex items-center space-x-4 bg-ink/30 p-3.5 rounded-xl border border-line">
                    <img 
                      src={pendingPhoto} 
                      alt="Athlete portrait" 
                      className="w-16 h-20 object-cover rounded-lg border border-line shrink-0" 
                    />
                    <div>
                      <span className="text-xs font-bold text-text block">Portrait Photo Loaded</span>
                      <span className="text-[11px] text-text-dim block mt-0.5">
                        This photograph will be printed on the ID Card / Badge.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-ink/30 border border-dashed border-line p-4 rounded-xl text-center space-y-1">
                    <User className="w-5 h-5 text-gold/60 mx-auto" />
                    <span className="text-xs font-bold text-text block">No Photograph Uploaded Yet</span>
                    <span className="text-[11px] text-text-dim block max-w-sm mx-auto">
                      Coaches no longer upload photos. The athlete's parent or guardian will upload the portrait photograph directly when submitting the Parental Indemnity Form.
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-4 flex items-center space-x-3 border-t border-line/40">
                <button 
                  onClick={handleSavePlayer}
                  className="bg-gold hover:opacity-90 text-ink font-bold px-5 py-2.5 rounded-xl text-xs transition"
                >
                  {selectedPlayerId ? 'Save Record Changes' : 'Confirm Registration'}
                </button>
                <button 
                  onClick={() => setScreen('coachRoster')}
                  className="bg-ink text-text-dim border border-line hover:text-text px-5 py-2.5 rounded-xl text-xs transition"
                >
                  Cancel
                </button>
              </div>

            </div>
          </div>
        )}

        {/* PLAYER ID CARD PRESENTATION */}
        {screen === 'idCard' && activeComp && (
          <div className="max-w-md mx-auto space-y-6">
            <button 
              onClick={() => setScreen(role === 'admin' ? 'adminCompDetail' : role === 'organizer' ? 'organizerDashboard' : 'coachRoster')}
              className="text-xs text-gold border border-gold/30 px-3 py-1.5 rounded-lg hover:bg-gold/10 transition"
            >
              â† Back
            </button>

            {(() => {
              const p = players.find(pl => pl.id === selectedPlayerId);
              if (!p) return <div className="text-center text-slate-400 py-12">Athlete profile not found.</div>;
              const belt = beltColorFor(p.ageGroup);
              const fields = getIdCardFields(activeComp);

              const getFontSizePx = (size: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl', defaultVal: string): string => {
                const map: Record<string, string> = {
                  'xs': '9px',
                  'sm': '11px',
                  'base': '13px',
                  'lg': '16px',
                  'xl': '20px',
                  '2xl': '24px',
                  '3xl': '28px'
                };
                return map[size] || defaultVal;
              };

              return (
                <div className="space-y-6">
                  
                  {/* DESIGN STAGE COMPONENT */}
                  <div className="p-4 bg-ink border border-line rounded-2xl flex justify-center">
                    <div 
                      ref={cardRef}
                      className="w-[336px] h-[480px] bg-gradient-to-br from-[#12211C] to-[#0A1310] border border-slate-700/60 rounded-3xl overflow-hidden shadow-2xl relative flex flex-col justify-between shrink-0"
                      id="designed-id-card"
                    >
                      {activeComp.idCardBgUrl && (
                        <>
                          <div className="absolute inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: `url(${activeComp.idCardBgUrl})` }} />
                          <div className="absolute inset-0 z-0 bg-black/40 mix-blend-multiply" />
                        </>
                      )}
                      
                      <div className="relative z-10 h-full flex-1 flex flex-col justify-between py-2">
                        {fields.filter(f => f.visible).map(field => {
                          if (field.id === 'header') {
                            return (
                              <div 
                                key="header" 
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('text/plain', 'header');
                                  e.dataTransfer.effectAllowed = 'move';
                                  e.currentTarget.classList.add('opacity-40');
                                }}
                                onDragEnd={(e) => {
                                  e.currentTarget.classList.remove('opacity-40');
                                }}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  e.currentTarget.classList.add('ring-2', 'ring-dashed', 'ring-gold', 'bg-gold/10');
                                }}
                                onDragLeave={(e) => {
                                  e.currentTarget.classList.remove('ring-2', 'ring-dashed', 'ring-gold', 'bg-gold/10');
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  e.currentTarget.classList.remove('ring-2', 'ring-dashed', 'ring-gold', 'bg-gold/10');
                                  const draggedId = e.dataTransfer.getData('text/plain');
                                  if (draggedId && draggedId !== 'header') {
                                    handleSwapFields(draggedId, 'header');
                                  }
                                }}
                                className={`relative group border border-transparent hover:border-dashed hover:border-gold/40 cursor-grab active:cursor-grabbing transition-all duration-150 h-10 bg-gradient-to-r from-hong via-hong to-chong flex ${
                                  field.align === 'left' ? 'justify-start gap-3' :
                                  field.align === 'right' ? 'justify-end gap-3' :
                                  field.align === 'center' ? 'justify-center gap-3' :
                                  'justify-between'
                                } items-center px-4 shrink-0 shadow-sm w-full`}
                              >
                                <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-ink/85 border border-line rounded p-0.5 text-gold z-20 pointer-events-none">
                                  <GripVertical className="w-3.5 h-3.5" />
                                </div>
                                <span className="font-display font-bold tracking-wider uppercase drop-shadow-sm truncate" style={{ fontSize: (p.id.startsWith('STAFF-') || p.ageGroup === 'STAFF') ? `${parseInt(getFontSizePx(field.fontSize, '10px'), 10) + 3}px` : getFontSizePx(field.fontSize, '10px'), color: field.color || '#ffffff' }}>{activeComp.name}</span>
                                
                              </div>
                            );
                          }
                          if (field.id === 'belt') {
                            return (
                              <div 
                                key="belt" 
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('text/plain', 'belt');
                                  e.dataTransfer.effectAllowed = 'move';
                                  e.currentTarget.classList.add('opacity-40');
                                }}
                                onDragEnd={(e) => {
                                  e.currentTarget.classList.remove('opacity-40');
                                }}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  e.currentTarget.classList.add('ring-2', 'ring-dashed', 'ring-gold', 'bg-gold/10');
                                }}
                                onDragLeave={(e) => {
                                  e.currentTarget.classList.remove('ring-2', 'ring-dashed', 'ring-gold', 'bg-gold/10');
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  e.currentTarget.classList.remove('ring-2', 'ring-dashed', 'ring-gold', 'bg-gold/10');
                                  const draggedId = e.dataTransfer.getData('text/plain');
                                  if (draggedId && draggedId !== 'belt') {
                                    handleSwapFields(draggedId, 'belt');
                                  }
                                }}
                                className="relative group border border-transparent hover:border-dashed hover:border-gold/40 cursor-grab active:cursor-grabbing transition-all duration-150 h-2 w-full shrink-0"
                                style={{ backgroundColor: belt }}
                              >
                                <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-ink/85 border border-line rounded p-0.5 text-gold z-20 pointer-events-none">
                                  <GripVertical className="w-3 h-3" />
                                </div>
                              </div>
                            );
                          }

                          // Render central card elements with consistent horizontal padding and flex layout
                          return (
                            <div 
                              key={field.id} 
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', field.id);
                                e.dataTransfer.effectAllowed = 'move';
                                e.currentTarget.classList.add('opacity-40');
                              }}
                              onDragEnd={(e) => {
                                e.currentTarget.classList.remove('opacity-40');
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.currentTarget.classList.add('ring-2', 'ring-dashed', 'ring-gold', 'bg-gold/10');
                              }}
                              onDragLeave={(e) => {
                                e.currentTarget.classList.remove('ring-2', 'ring-dashed', 'ring-gold', 'bg-gold/10');
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                e.currentTarget.classList.remove('ring-2', 'ring-dashed', 'ring-gold', 'bg-gold/10');
                                const draggedId = e.dataTransfer.getData('text/plain');
                                if (draggedId && draggedId !== field.id) {
                                  handleSwapFields(draggedId, field.id);
                                }
                              }}
                              className="relative group border border-transparent hover:border-dashed hover:border-gold/40 hover:bg-white/5 rounded-lg cursor-grab active:cursor-grabbing transition-all duration-150 px-5 py-1.5 shrink-0"
                              title="Drag to rearrange"
                            >
                              <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-ink/85 border border-line rounded p-0.5 text-gold z-20 pointer-events-none">
                                <GripVertical className="w-3.5 h-3.5" />
                              </div>
                              {(() => {
                                if (field.id === 'photo') {
                                  return (
                                    <div className={`flex ${
                                      field.align === 'left' ? 'justify-start' :
                                      field.align === 'right' ? 'justify-end' :
                                      'justify-center'
                                    }`}>
                                      <div className="w-20 h-24 bg-ink rounded-xl border border-line flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                                        {p.photo ? (
                                          <img 
                                            src={p.photo} 
                                            alt={p.name} 
                                            className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition" 
                                            onClick={(e) => { e.stopPropagation(); setEnlargedPhotoUrl(p.photo); setEnlargedPhotoName(p.name); }}
                                          />
                                        ) : (
                                          <div className="text-center">
                                            <User className="w-6 h-6 text-text-dim/40 mx-auto" />
                                            <span className="text-[9px] text-text-dim/40 font-bold block mt-1 uppercase">No Photo</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                }
                                if (field.id === 'name') {
                                  return (
                                    <div className={
                                      field.align === 'left' ? 'text-left' :
                                      field.align === 'right' ? 'text-right' :
                                      'text-center'
                                    }>
                                      <h3 className="font-display font-bold leading-tight tracking-wide uppercase line-clamp-2" style={{ fontSize: getFontSizePx(field.fontSize, '18px'), color: field.color || '#ffffff' }}>{p.name}</h3>
                                    </div>
                                  );
                                }
                                if (field.id === 'club') {
                                  return (
                                    <div className={
                                      field.align === 'left' ? 'text-left' :
                                      field.align === 'right' ? 'text-right' :
                                      'text-center'
                                    }>
                                      <p className="uppercase tracking-widest" style={{ fontSize: getFontSizePx(field.fontSize, '10px'), color: field.color || '#a0aec0' }}>{p.club}</p>
                                    </div>
                                  );
                                }
                                if (field.id === 'athleteId') {
                                  if (p.id.startsWith('STAFF-') || p.ageGroup === 'STAFF') return null;
                                  return (
                                    <div className={
                                      field.align === 'left' ? 'text-left' :
                                      field.align === 'right' ? 'text-right' :
                                      'text-center'
                                    }>
                                      <span className="inline-block bg-surface border border-line font-mono px-2 py-0.5 rounded font-bold" style={{ fontSize: getFontSizePx(field.fontSize, '10px'), color: field.color || '#D4AF37' }}>{p.id}</span>
                                    </div>
                                  );
                                }
                                if (field.id === 'metadata') {
                                  if (p.id.startsWith('STAFF-') || p.ageGroup === 'STAFF') {
                                    return (
                                      <div key="metadata" className="px-4 py-1 shrink-0 flex items-center justify-center border-t border-line/30 pt-4 pb-2">
                                        <span 
                                          className="font-display font-bold tracking-widest uppercase text-white" 
                                          style={{ 
                                            fontSize: `${parseInt(getFontSizePx(field.fontSize, '20px'), 10) + 10}px`, 
                                            color: field.color || '#ffffff' 
                                          }}
                                        >
                                          {p.event}
                                        </span>
                                      </div>
                                    );
                                  }
    return (
                                    <div className={`grid grid-cols-2 gap-3 text-xs border-t border-line/30 pt-3 ${
                                      field.align === 'left' ? 'text-left' :
                                      field.align === 'right' ? 'text-right' :
                                      'text-center'
                                    }`}>
                                      <div>
                                        <span className="block text-[8px] text-text-dim/60 uppercase tracking-widest font-bold">Category</span>
                                        <span className="font-medium line-clamp-1" style={{ fontSize: getFontSizePx(field.fontSize, '12px'), color: field.color || '#ffffff' }}>{p.ageGroup || 'â€”'}</span>
                                      </div>
                                      <div>
                                        <span className="block text-[8px] text-text-dim/60 uppercase tracking-widest font-bold">Gender</span>
                                        <span className="font-medium" style={{ fontSize: getFontSizePx(field.fontSize, '12px'), color: field.color || '#ffffff' }}>{p.gender || 'â€”'}</span>
                                      </div>
                                      <div>
                                        <span className="block text-[8px] text-text-dim/60 uppercase tracking-widest font-bold font-sans">Weight Class</span>
                                        <span className="font-medium line-clamp-1" style={{ fontSize: getFontSizePx(field.fontSize, '12px'), color: field.color || '#ffffff' }}>{p.weightClass || 'â€”'}</span>
                                      </div>
                                      <div>
                                        <span className="block text-[8px] text-text-dim/60 uppercase tracking-widest font-bold">DOB</span>
                                        <span className="font-medium" style={{ fontSize: getFontSizePx(field.fontSize, '12px'), color: field.color || '#ffffff' }}>{p.dob || 'â€”'}</span>
                                      </div>
                                    </div>
                                  );
                                }
                                if (field.id === 'qrcode') {
                                  const containerClass = 
                                    field.align === 'right' ? 'flex flex-row-reverse items-center justify-between' :
                                    field.align === 'center' ? 'flex flex-col items-center justify-center gap-2 text-center' :
                                    'flex items-center justify-between';
                                  
                                  const textAlignmentClass = 
                                    field.align === 'right' ? 'text-left min-w-0' :
                                    field.align === 'center' ? 'text-center min-w-0' :
                                    'text-right min-w-0';

                                  return (
                                    <div className={`${containerClass} border-t border-dashed border-line/30 pt-3`}>
                                      <div className="bg-white p-1.5 rounded-xl inline-block shadow-md shrink-0">
                                        <QRCodeSVG 
                                          value={`${activeComp.id}::${p.id}`} 
                                          size={70} 
                                          level="M" 
                                          includeMargin={false}
                                        />
                                      </div>
                                      <div className={textAlignmentClass}>
                                        {!(p.id.startsWith('STAFF-') || p.ageGroup === 'STAFF') && <p className="font-display font-bold uppercase tracking-wider bg-slate-950/30 px-1.5 py-0.5 rounded border border-white/10 text-white inline-block mb-1" style={{ fontSize: getFontSizePx(field.fontSize, '8px') }}>{p.event}</p>}
                                        <p className="font-display font-bold uppercase tracking-wider" style={{ fontSize: getFontSizePx(field.fontSize, '10px'), color: field.color || '#D4AF37' }}>Tournament Entry Pass</p>
                                        <p className="mt-0.5 leading-normal" style={{ fontSize: getFontSizePx(field.fontSize, '8px'), color: field.color || '#a0aec0', opacity: 0.85 }}>Scan at weigh-in station<br />to digitally verify athlete weight.</p>
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* ACTION CONTROLS */}
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button 
                      onClick={downloadCardPNG}
                      className="w-full sm:w-auto bg-gold hover:opacity-90 text-ink font-bold px-5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download ID Card (PNG)</span>
                    </button>
                    {p.weighIn ? (
                      <div 
                        className="w-full sm:w-auto bg-surface/40 border border-line/30 text-text-dim/40 px-5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-not-allowed"
                        title="Editing locked (Weigh-in complete)"
                      >
                        <Lock className="w-4 h-4 text-text-dim/40" />
                        <span>Modify Athlete (Locked)</span>
                      </div>
                    ) : (
                      <button 
                        onClick={() => handleOpenCoachPlayerForm(p.id)}
                        className="w-full sm:w-auto bg-surface border border-line text-text-dim hover:text-text px-5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                      >
                        <Edit className="w-4 h-4" />
                        <span>Modify Athlete</span>
                      </button>
                    )}
                  </div>

                </div>
              );
            })()}

          </div>
        )}

        {/* OFFICIAL TERMINAL SCANNER */}
        {screen === 'officialScan' && activeComp && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface p-4 rounded-2xl border border-line shadow-sm">
              <div>
                <h2 className="text-lg font-bold uppercase tracking-wider text-text flex items-center gap-2 font-display">
                  <Scale className="w-5 h-5 text-gold animate-pulse" />
                  <span>Official Weigh-In Station terminal</span>
                </h2>
                <p className="text-xs text-text-dim">Tournament Active: <strong className="text-text">{activeComp.name}</strong> â€¢ Station: <strong className="text-text">{oStation}</strong></p>
              </div>
              <button 
                onClick={() => setScreen('officialLog')}
                className="w-full md:w-auto bg-ink text-text-dim hover:text-text border border-line text-xs px-4 py-2 rounded-xl transition flex items-center justify-center gap-1.5 font-semibold"
              >
                <FileText className="w-4 h-4 text-gold" />
                <span>Open Weigh-In Ledger</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* WEIGH-IN INPUT METHOD SELECTOR CARD */}
              <div className="bg-surface rounded-2xl border border-line p-5 space-y-4">
                <div className="flex border-b border-line pb-2 mb-2 gap-2">
                  <button 
                    onClick={() => { setScannerMode('camera'); setScanning(false); }}
                    className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition rounded-xl flex items-center justify-center gap-2 ${
                      scannerMode === 'camera' ? 'bg-gold/15 text-gold border border-gold/30 font-bold' : 'text-text-dim hover:text-text bg-ink/20'
                    }`}
                  >
                    <Camera className="w-4 h-4" />
                    <span>Live Camera</span>
                  </button>
                  <button 
                    onClick={() => { setScannerMode('hardware'); setScanning(false); }}
                    className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition rounded-xl flex items-center justify-center gap-2 ${
                      scannerMode === 'hardware' ? 'bg-gold/15 text-gold border border-gold/30 font-bold' : 'text-text-dim hover:text-text bg-ink/20'
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Handheld Gun Scanner</span>
                  </button>
                </div>

                {scannerMode === 'camera' ? (
                  <div className="space-y-4 animate-fade-in">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-text">Live Camera ID Scanner</h3>
                    <p className="text-xs text-text-dim">Hold the athlete's ID card QR code in front of the camera frame below to parse instantly.</p>
                    
                    <div className="relative w-full aspect-square max-w-sm mx-auto bg-ink rounded-2xl overflow-hidden border border-line flex items-center justify-center shadow-inner">
                      {scanning ? (
                        <video 
                          ref={videoRef} 
                          className="w-full h-full object-cover"
                          playsInline
                          muted
                          autoPlay
                        />
                      ) : (
                        <div className="text-center p-6 space-y-3">
                          <Camera className="w-12 h-12 text-text-dim/40 mx-auto" />
                          <p className="text-xs text-text-dim/60">Camera scanning feed is currently inactive.</p>
                        </div>
                      )}

                      {/* Target scanner bounding box */}
                      {scanning && (
                        <div className="absolute inset-16 border-2 border-dashed border-gold rounded-2xl pointer-events-none flex items-center justify-center">
                          <span className="text-[10px] text-gold uppercase tracking-wider font-bold bg-ink/85 px-2 py-0.5 rounded shadow">Position QR code</span>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-center">
                      <button 
                        onClick={() => setScanning(!scanning)}
                        className={`px-5 py-2.5 rounded-lg font-semibold text-sm cursor-pointer shadow-md ${scanning ? 'bg-bad text-white' : 'bg-gold text-ink'}`}
                      >
                        {scanning ? 'Stop Camera Scanning' : 'Start Camera Scan'}
                      </button>
                    </div>
                    <div id="scanErr" className="text-center text-xs"></div>
                  </div>
                ) : (
                  <div className="space-y-4 animate-fade-in">
                    <div className="bg-ink/50 border border-line/60 rounded-xl p-4 text-center space-y-3">
                      <div className="inline-flex p-3 rounded-full bg-gold/10 text-gold animate-pulse">
                        <QrCode className="w-8 h-8" />
                      </div>
                      <h4 className="text-xs font-bold text-text uppercase tracking-wider">Handheld Barcode / QR Scanner Mode</h4>
                      <p className="text-[11px] text-text-dim max-w-sm mx-auto leading-normal">
                        Connect any standard handheld USB or Bluetooth scanner gun. The scanner gun acts as a keyboard emulatorâ€”just point and scan any ID card.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest">
                          Scan Receiver Input
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input 
                            type="checkbox" 
                            id="auto-focus-cb"
                            checked={autoFocusScanner}
                            onChange={(e) => setAutoFocusScanner(e.target.checked)}
                            className="w-3.5 h-3.5 text-gold bg-ink border-line rounded focus:ring-gold focus:ring-offset-ink accent-gold"
                          />
                          <label htmlFor="auto-focus-cb" className="text-[10px] text-text-dim cursor-pointer font-medium">
                            Auto-focus receiver field
                          </label>
                        </div>
                      </div>

                      {/* Focus Status / Scanner Connectivity Indicator */}
                      <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all duration-300 ${
                        isScannerFocused 
                          ? 'bg-emerald/10 border-emerald/30 text-emerald' 
                          : 'bg-amber/10 border-amber/30 text-amber'
                      }`}>
                        <div className="flex items-start gap-2.5">
                          <span className="relative flex h-2.5 w-2.5 mt-1 sm:mt-0.5">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                              isScannerFocused ? 'bg-emerald' : 'bg-amber'
                            }`}></span>
                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                              isScannerFocused ? 'bg-emerald' : 'bg-amber'
                            }`}></span>
                          </span>
                          <div className="text-left space-y-0.5">
                            <p className="text-xs font-bold uppercase tracking-wide">
                              {isScannerFocused ? 'Scanner Connection Active' : 'Scanner Connection Idle'}
                            </p>
                            <p className="text-[10px] text-text-dim leading-relaxed max-w-sm">
                              {isScannerFocused 
                                ? 'Your hardware scanner is ready to transmit! Scan any athlete ID card now.' 
                                : 'Please click inside the dashed input field below or click "Focus Field" to wake up and routes keystrokes.'
                              }
                            </p>
                          </div>
                        </div>
                        {isScannerFocused ? (
                          <span className="text-[10px] font-bold uppercase bg-emerald/20 px-2 py-0.5 rounded border border-emerald/20 whitespace-nowrap self-stretch sm:self-auto text-center">Ready</span>
                        ) : (
                          <button 
                            type="button"
                            onClick={() => hardwareInputRef.current?.focus()}
                            className="text-[10px] font-bold uppercase bg-amber text-ink px-2.5 py-1 rounded-lg hover:opacity-95 transition whitespace-nowrap self-stretch sm:self-auto text-center"
                          >
                            Focus Field
                          </button>
                        )}
                      </div>

                      <div className="relative">
                        <input 
                          type="text" 
                          ref={hardwareInputRef}
                          value={manualCode}
                          onChange={(e) => setManualCode(e.target.value)}
                          onFocus={() => setIsScannerFocused(true)}
                          onBlur={() => setIsScannerFocused(false)}
                          onKeyDown={(e) => { 
                            if (e.key === 'Enter') { 
                              lookupPlayer(manualCode.trim()); 
                              setManualCode(''); 
                            } 
                          }}
                          placeholder={autoFocusScanner ? "READY TO SCAN (Auto-Focused)..." : "Click here, then scan QR code..."}
                          className="w-full bg-ink border-2 border-dashed border-line text-xs rounded-xl py-3 px-3 text-text text-center focus:outline-none focus:border-gold transition font-mono tracking-wider font-bold placeholder:text-text-dim/40"
                        />
                        {autoFocusScanner && (
                          <span className="absolute right-3.5 top-3.5 flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald"></span>
                          </span>
                        )}
                      </div>

                      <p className="text-[10px] text-text-dim text-center leading-normal">
                        The receiver automatically parses the tournament credentials and matches the competitor's profile instantly.
                      </p>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: '20px' }} className="pt-4 border-t border-line">
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Or manually query competitor code</label>
                  <div className="flex space-x-2">
                    <input 
                      type="text" 
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { lookupPlayer(manualCode.trim()); setManualCode(''); } }}
                      placeholder="e.g. TMR-SMA-001" 
                      className="flex-1 bg-ink border border-line text-xs rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
                    />
                    <button 
                      onClick={() => { lookupPlayer(manualCode.trim()); setManualCode(''); }}
                      className="bg-surface-2 text-text border border-line hover:bg-surface-2/80 px-4 py-2 rounded-xl text-xs transition"
                    >
                      Look Up Profile
                    </button>
                  </div>
                </div>

              </div>

              {/* OUTCOME / WEIGHT ENTRY PANEL */}
              <div className="space-y-6">
                {scanResult ? (
                  (() => {
                    const p = players.find(pl => pl.id === scanResult);
                    if (!p) return null;
                    const range = parseWeightRange(p.weightClass);

                    return (
                      <div className="bg-surface rounded-2xl border border-line p-5 space-y-4 shadow-sm animate-fade-in">
                        <div className="flex items-start justify-between border-b border-line/40 pb-4">
                          <div>
                            <span className="text-[10px] uppercase font-bold tracking-widest text-gold bg-ink px-2 py-0.5 rounded border border-line">Athlete Unlocked</span>
                            <h3 className="text-lg font-bold text-text uppercase tracking-wider font-display mt-2 leading-tight">{p.name}</h3>
                            <p className="text-xs text-text-dim font-mono mt-0.5">{p.id} Â· {p.club}</p>
                          </div>
                          
                          <div className="w-12 h-15 bg-ink border border-line rounded overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                            {p.photo ? (
                              <img src={p.photo} alt={p.name} className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-4 h-4 text-text-dim/40" />
                            )}
                          </div>
                        </div>

                        <div className="bg-ink/50 border border-line rounded-xl p-3 text-xs space-y-2">
                          <div className="flex justify-between"><span className="text-text-dim/60">Tournament Event</span><strong className="text-text font-semibold">{p.event}</strong></div>
                          <div className="flex justify-between"><span className="text-text-dim/60">Division category</span><strong className="text-text font-semibold">{p.ageGroup} Â· {p.gender}</strong></div>
                          <div className="flex justify-between"><span className="text-text-dim/60">Target Division weight</span><strong className="text-gold font-bold">{p.weightClass}</strong></div>
                          {range && (
                            <div className="flex justify-between border-t border-line/40 pt-2 text-[11px]"><span className="text-text-dim/60">Division Limit</span><strong className="text-text font-mono">{range.min === 0 ? 'â‰¤ ' : `${range.min}kg - `}{range.max}kg</strong></div>
                          )}
                        </div>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Official Actual weight measurement (kg)</label>
                            <input 
                               type="number" 
                               step="0.01"
                               value={actualWeightInput}
                               onChange={(e) => setActualWeightInput(e.target.value)}
                               onKeyDown={(e) => { if (e.key === 'Enter') handleRecordWeighIn(); }}
                               placeholder="e.g. 54.8" 
                               className="w-full bg-ink border border-line text-sm font-mono rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5 flex justify-between items-center">
                              Player Signature
                              <button 
                                onClick={() => sigCanvas.current?.clear()}
                                className="text-[10px] text-text-dim hover:text-text border border-line rounded px-1.5 py-0.5 bg-ink"
                              >
                                clear
                              </button>
                            </label>
                            <div className="border border-line rounded-xl bg-white overflow-hidden h-32 relative">
                              <SignatureCanvas 
                                ref={sigCanvas} 
                                penColor="black"
                                canvasProps={{ className: 'w-full h-full' }} 
                              />
                            </div>
                          </div>

                          <button 
                            onClick={handleRecordWeighIn}
                            className="w-full bg-gold hover:opacity-90 text-ink font-bold px-5 py-3 rounded-xl text-sm shadow-md"
                          >
                            Record Entry & Signature
                          </button>
                        </div>

                        {p.weighIn && (
                          <div className="bg-ink p-3 rounded-lg border border-line flex justify-between items-center text-xs">
                            <div className="space-y-0.5">
                              <span className="block text-[9px] text-text-dim/60 uppercase tracking-widest">Existing weigh-in</span>
                              <strong className="text-text font-mono text-sm">{p.weighIn.weight} kg</strong>
                              <span className="block text-[9px] text-text-dim">{new Date(p.weighIn.time).toLocaleTimeString()}</span>
                            </div>
                            {renderBadge(p.weighIn.result)}
                          </div>
                        )}

                        <div className="flex justify-start">
                          <button 
                            onClick={() => { setScanResult(null); setActualWeightInput(''); }}
                            className="text-xs text-text-dim/70 hover:text-text underline"
                          >
                            Clear and scan next
                          </button>
                        </div>

                      </div>
                    );
                  })()
                ) : (
                  <div className="bg-surface/50 rounded-2xl border border-line p-8 text-center text-text-dim space-y-3">
                    <Scale className="w-12 h-12 text-text-dim/40 mx-auto" />
                    <p className="text-sm font-semibold">Terminal Standing By</p>
                    <p className="text-xs max-w-xs mx-auto">Please scan a printed competitor pass QR code or input the competitor ID to proceed with recording digital weigh-ins.</p>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* OFFICIAL LIVE WEIGH-IN LEDGER / LOG */}
        {screen === 'officialLog' && activeComp && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface p-4 rounded-2xl border border-line shadow-sm">
              <div className="flex items-center space-x-3">
                <button 
                  onClick={() => setScreen('officialScan')}
                  className="text-xs text-gold border border-gold/30 px-3 py-1.5 rounded-lg hover:bg-gold/10 transition"
                >
                  â† Back to live scanner
                </button>
                <div>
                  <h2 className="text-lg font-bold uppercase tracking-wider text-text font-display">Live Weigh-In Ledger</h2>
                  <p className="text-xs text-text-dim">{activeComp.name} Â· Official records history</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <button 
                  onClick={downloadWeighInExcel}
                  className="bg-gold hover:opacity-90 text-ink font-bold px-3.5 py-1.5 rounded-lg text-xs flex items-center justify-center gap-1.5 shadow transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Total Summary</span>
                </button>
                <button 
                  onClick={() => {
                    const stored = localStorage.getItem(`app:players:${compId}`);
                    if (stored) setPlayers(JSON.parse(stored));
                    triggerMsg('Audit log synchronized.', 'ok');
                  }}
                  className="text-xs text-text-dim border border-line hover:text-text px-3.5 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3 text-gold" />
                  <span>Refresh Logs</span>
                </button>
              </div>
            </div>

            <div className="bg-surface rounded-2xl border border-line shadow-sm overflow-hidden">
              <div className="p-4 border-b border-line flex justify-between items-center bg-ink/10">
                <span className="text-xs font-bold text-text-dim uppercase tracking-widest">Digital Weight Log Sheet</span>
                <span className="text-xs text-text-dim font-medium">Logged: {players.filter(p => p.weighIn !== null).length} / {players.length} entrants</span>
              </div>

              {players.filter(p => p.weighIn !== null).length === 0 ? (
                <div className="p-12 text-center text-text-dim space-y-2">
                  <Activity className="w-10 h-10 text-text-dim/30 mx-auto" />
                  <p className="text-sm font-semibold">No weigh-ins have been recorded today.</p>
                  <p className="text-xs">Once athletes pass or fail the scale check, their official records will update here in real-time.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-line bg-ink/50 text-text-dim font-semibold">
                        <th className="p-4">Code</th>
                        <th className="p-4">Competitor Name</th>
                        <th className="p-4">Division Club</th>
                        <th className="p-4">Division Weight Limit</th>
                        <th className="p-4">Scale Readout (kg)</th>
                        <th className="p-4">Result status</th>
                        <th className="p-4">Measurement Time</th>
                        <th className="p-4">Station</th>
                        <th className="p-4 text-right">Official Decisions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/30">
                      {players.filter(p => p.weighIn !== null).sort((a,b) => {
                        const tA = a.weighIn ? new Date(a.weighIn.time).getTime() : 0;
                        const tB = b.weighIn ? new Date(b.weighIn.time).getTime() : 0;
                        return tB - tA;
                      }).map(p => {
                        if (!p.weighIn) return null;
                        const range = parseWeightRange(p.weightClass);
                        const isPass = p.weighIn.result.includes('PASS');

                        return (
                          <tr key={p.id} className="hover:bg-surface-2/30 transition">
                            <td className="p-4 font-mono text-gold font-bold">{p.id}</td>
                            <td className="p-4 font-bold text-text">
                              <div>{p.name}</div>
                              {(p.schoolName || p.race) && (
                                <div className="text-[10px] text-gold/80 font-mono mt-0.5 font-normal">
                                  {p.schoolName && `School: ${p.schoolName} ${p.schoolCode ? `(${p.schoolCode})` : ''}`}
                                  {p.schoolName && p.race && ' Â· '}
                                  {p.race && `Race: ${p.race}`}
                                </div>
                              )}
                            </td>
                            <td className="p-4 text-text">{p.club}</td>
                            <td className="p-4 text-text-dim">
                              <div className="font-semibold text-text">{p.weightClass}</div>
                              {range && <span className="text-[10px] font-mono">{range.min === 0 ? 'â‰¤ ' : `${range.min}kg - `}{range.max}kg</span>}
                            </td>
                            <td className="p-4 font-mono font-bold text-sm text-text">{p.weighIn.weight} kg</td>
                            <td className="p-4">{renderBadge(p.weighIn.result)}</td>
                            <td className="p-4 text-text-dim">{new Date(p.weighIn.time).toLocaleTimeString()}</td>
                            <td className="p-4 text-text-dim/80 text-sm">{p.weighIn.stationId || 'â€”'}</td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end space-x-1">
                                {isPass ? (
                                  <button 
                                    onClick={() => handleOverrideWeighIn(p.id, 'OVERRIDE FAIL')}
                                    className="bg-red-950 text-red-400 hover:bg-red-900 border border-red-900/30 px-2 py-1 rounded text-[10px] font-bold"
                                  >
                                    Force Fail
                                  </button>
                                ) : (
                                  <button 
                                    onClick={() => handleOverrideWeighIn(p.id, 'OVERRIDE PASS')}
                                    className="bg-green-950 text-green-400 hover:bg-green-900 border border-green-900/30 px-2 py-1 rounded text-[10px] font-bold"
                                  >
                                    Force Pass
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          </div>
        )}

        {/* ADMIN HOME */}
        {screen === 'adminHome' && (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Sidebar Navigation */}
            <div className="lg:w-64 shrink-0 bg-surface border border-line rounded-2xl p-4 shadow-sm space-y-2 h-fit">
              <button
                onClick={() => setAdminTab('tournaments')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  adminTab === 'tournaments' 
                    ? 'bg-gold text-ink shadow-sm' 
                    : 'text-text-dim hover:bg-surface-2 hover:text-text'
                }`}
              >
                <Calendar className="w-5 h-5" />
                Registered Tournaments
              </button>
              <button
                onClick={() => setAdminTab('coaches')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  adminTab === 'coaches' 
                    ? 'bg-gold text-ink shadow-sm' 
                    : 'text-text-dim hover:bg-surface-2 hover:text-text'
                }`}
              >
                <Users className="w-5 h-5" />
                Coach Accounts
              </button>
              <button
                onClick={() => setAdminTab('organizers')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  adminTab === 'organizers' 
                    ? 'bg-gold text-ink shadow-sm' 
                    : 'text-text-dim hover:bg-surface-2 hover:text-text'
                }`}
              >
                <UserPlus className="w-5 h-5" />
                Organizer Accounts
              </button>
              <button
                onClick={() => setAdminTab('referees')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  adminTab === 'referees' 
                    ? 'bg-gold text-ink shadow-sm' 
                    : 'text-text-dim hover:bg-surface-2 hover:text-text'
                }`}
              >
                <Scale className="w-5 h-5" />
                Referee Accounts
              </button>
              <button
                onClick={() => setAdminTab('ric')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  adminTab === 'ric' 
                    ? 'bg-gold text-ink shadow-sm' 
                    : 'text-text-dim hover:bg-surface-2 hover:text-text'
                }`}
                id="admin-tab-ric"
              >
                <Sliders className="w-5 h-5" />
                RIC Accounts & Settings
              </button>
              <button
                onClick={() => setAdminTab('clubs')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  adminTab === 'clubs' 
                    ? 'bg-gold text-ink shadow-sm' 
                    : 'text-text-dim hover:bg-surface-2 hover:text-text'
                }`}
              >
                <Shield className="w-5 h-5" />
                Affiliated Clubs / States
              </button>
              <button
                onClick={() => setAdminTab('security')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  adminTab === 'security' 
                    ? 'bg-gold text-ink shadow-sm' 
                    : 'text-text-dim hover:bg-surface-2 hover:text-text'
                }`}
              >
                <Lock className="w-5 h-5" />
                Security Credentials
              </button>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 space-y-6 min-w-0">
              <div className="bg-surface p-6 rounded-2xl border border-line shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-xl font-bold uppercase tracking-wider text-text flex items-center gap-2 font-display">
                    <Settings className="w-5 h-5 text-gold" />
                    <span>Administrative Control Hub</span>
                  </h2>
                  <p className="text-xs text-text-dim mt-1">Configure championship events, set security passcodes, and monitor weigh-in operations.</p>
                </div>
                {adminTab === 'tournaments' && (
                  <button 
                    onClick={() => setScreen('adminCompForm')}
                    className="w-full md:w-auto bg-gold hover:opacity-90 text-ink font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center justify-center gap-1 shadow"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Competition Event</span>
                  </button>
                )}
              </div>

              {adminTab === 'tournaments' && (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-text-dim uppercase tracking-widest">Registered Tournaments ({competitions.length})</h3>
                  
                  {competitions.length === 0 ? (
                    <div className="bg-surface p-12 text-center text-text-dim rounded-2xl border border-line">
                      <Calendar className="w-12 h-12 text-text-dim/30 mx-auto mb-3" />
                      <p className="text-sm font-semibold">No tournaments currently configured.</p>
                      <p className="text-xs">Configure your first Taekwondo championship by clicking the "New Competition Event" button above.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {competitions.map(c => {
                        return (
                          <div 
                            key={c.id}
                            className="bg-surface border border-line rounded-2xl p-5 shadow-sm hover:border-gold/30 transition flex flex-col justify-between"
                          >
                            <div className="space-y-2">
                              <div className="flex justify-between items-start">
                                <span className="text-[10px] font-mono text-gold font-bold bg-ink px-2.5 py-0.5 rounded border border-line">ID: {c.id}</span>
                                <span className="text-[10px] font-mono text-text-dim/60">Code: {c.staffCode}</span>
                              </div>
                              <h4 className="text-base font-bold text-text uppercase tracking-wide font-display pt-2 line-clamp-1">{c.name}</h4>
                              <p className="text-xs text-text-dim flex items-center gap-1"><MapPin className="w-3.5 h-3.5 shrink-0" /> {c.venue}</p>
                              <p className="text-xs text-text-dim flex items-center gap-1"><Calendar className="w-3.5 h-3.5 shrink-0" /> {formatDateRange(c.date, c.endDate)}</p>
                            </div>

                            <div className="border-t border-line/40 pt-4 mt-4 flex items-center justify-between gap-2">
                              <button 
                                onClick={() => { setCompId(c.id); setScreen('adminCompDetail'); }}
                                className="bg-ink text-gold hover:bg-surface-2 border border-line px-3 py-2 rounded-xl text-xs font-bold transition flex-1 text-center cursor-pointer"
                              >
                                Configure
                              </button>
                              <button
                                onClick={() => handleToggleCompActive(c.id)}
                                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex-1 text-center border cursor-pointer ${
                                  c.isActive !== false
                                    ? 'bg-good/10 text-good border-good/30 hover:bg-good/20'
                                    : 'bg-surface-2 text-text-dim border-line hover:text-text'
                                }`}
                              >
                                {c.isActive !== false ? 'Active' : 'Inactive'}
                              </button>

                              {confirmDeleteCompId === c.id ? (
                                <div className="flex items-center gap-1 shrink-0 animate-fade-in">
                                  <button
                                    onClick={() => handleAdminDeleteComp(c.id)}
                                    className="bg-red-600 hover:bg-red-700 text-white px-2.5 py-2 rounded-xl text-[10px] font-bold transition cursor-pointer"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteCompId(null)}
                                    className="bg-ink hover:bg-surface-2 border border-line text-text-dim px-2 py-2 rounded-xl text-[10px] font-bold transition cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmDeleteCompId(c.id)}
                                  className="bg-hong/10 hover:bg-hong/25 text-hong border border-hong/30 p-2 rounded-xl transition shrink-0 cursor-pointer"
                                  title="Delete Event"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* REGISTERED COACHES */}
              {adminTab === 'coaches' && (() => {
                const allCoachesList = Object.entries(coaches);
                const query = adminCoachSearch.trim().toLowerCase();
                const filteredCoaches = allCoachesList.filter(([username, coach]: [string, any]) => {
                  if (!query) return true;
                  const uMatch = username.toLowerCase().includes(query);
                  const nMatch = (coach?.name || '').toLowerCase().includes(query);
                  const cMatch = (coach?.club || '').toLowerCase().includes(query);
                  const pMatch = (coach?.phone || '').toLowerCase().includes(query);
                  const eMatch = (coach?.email || '').toLowerCase().includes(query);
                  return uMatch || nMatch || cMatch || pMatch || eMatch;
                });

                return (
                  <div className="space-y-4">
                    {/* Header Controls */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div>
                        <h3 className="text-xs font-bold text-text-dim uppercase tracking-widest flex items-center gap-2">
                          <Users className="w-4 h-4 text-gold" />
                          <span>Registered Coach Accounts ({allCoachesList.length})</span>
                        </h3>
                        <p className="text-[11px] text-text-dim mt-0.5">Manage credentials, clubs, contact information, and delete coach accounts.</p>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="relative flex-1 sm:w-64">
                          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
                          <input 
                            type="text" 
                            value={adminCoachSearch}
                            onChange={(e) => setAdminCoachSearch(e.target.value)}
                            placeholder="Search coach, club, phone..."
                            className="w-full bg-ink border border-line rounded-xl pl-8 pr-8 py-2 text-xs text-text placeholder:text-text-dim/60 focus:border-gold outline-none"
                          />
                          {adminCoachSearch && (
                            <button
                              onClick={() => setAdminCoachSearch('')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-dim hover:text-text p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <button
                          onClick={() => setShowAdminAddCoach(prev => !prev)}
                          className="bg-gold hover:opacity-90 text-ink font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shrink-0 shadow-sm"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{showAdminAddCoach ? 'Close Form' : 'Add Coach'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Admin Add Coach Form */}
                    {showAdminAddCoach && (
                      <div className="bg-surface rounded-2xl border border-line shadow-sm p-4 space-y-4 animate-fade-in">
                        <div className="flex items-center justify-between border-b border-line pb-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-text flex items-center gap-1.5">
                            <UserPlus className="w-4 h-4 text-gold" />
                            <span>Create New Coach Account</span>
                          </h4>
                          <button 
                            onClick={() => setShowAdminAddCoach(false)}
                            className="text-text-dim hover:text-text p-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-1">Username *</label>
                            <input 
                              type="text" 
                              value={newCoachUsername} 
                              onChange={e => setNewCoachUsername(e.target.value)} 
                              placeholder="e.g. coach_john"
                              className="w-full bg-ink border border-line rounded-lg px-3 py-2 text-xs text-text focus:border-gold outline-none font-mono" 
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-1">Password *</label>
                            <input 
                              type="text" 
                              value={newCoachPass} 
                              onChange={e => setNewCoachPass(e.target.value)} 
                              placeholder="Access password"
                              className="w-full bg-ink border border-line rounded-lg px-3 py-2 text-xs text-text focus:border-gold outline-none font-mono" 
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-1">Full Name *</label>
                            <input 
                              type="text" 
                              value={newCoachName} 
                              onChange={e => setNewCoachName(e.target.value)} 
                              placeholder="e.g. Master John Doe"
                              className="w-full bg-ink border border-line rounded-lg px-3 py-2 text-xs text-text focus:border-gold outline-none" 
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-1">Club / Team Name *</label>
                            <input 
                              type="text" 
                              value={newCoachClub} 
                              onChange={e => setNewCoachClub(e.target.value)} 
                              placeholder="e.g. Eagle Taekwondo Academy"
                              className="w-full bg-ink border border-line rounded-lg px-3 py-2 text-xs text-text focus:border-gold outline-none" 
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-1">Phone Number</label>
                            <input 
                              type="text" 
                              value={newCoachPhone} 
                              onChange={e => setNewCoachPhone(e.target.value)} 
                              placeholder="e.g. 012-3456789"
                              className="w-full bg-ink border border-line rounded-lg px-3 py-2 text-xs text-text focus:border-gold outline-none font-mono" 
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-1">Email Address</label>
                            <input 
                              type="email" 
                              value={newCoachEmail} 
                              onChange={e => setNewCoachEmail(e.target.value)} 
                              placeholder="e.g. coach@academy.com"
                              className="w-full bg-ink border border-line rounded-lg px-3 py-2 text-xs text-text focus:border-gold outline-none" 
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-1 border-t border-line/40">
                          <button 
                            onClick={() => setShowAdminAddCoach(false)} 
                            className="bg-surface-2 hover:bg-line border border-line text-text-dim hover:text-text px-3.5 py-1.5 rounded-xl text-xs transition"
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={handleAdminCreateCoach} 
                            className="bg-gold text-ink font-bold px-4 py-1.5 rounded-xl text-xs hover:opacity-90 transition shadow-sm"
                          >
                            Create Coach Account
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {allCoachesList.length === 0 ? (
                      <div className="bg-surface p-12 text-center text-text-dim rounded-2xl border border-line">
                        <Users className="w-12 h-12 text-text-dim/30 mx-auto mb-3" />
                        <p className="text-sm font-semibold">No coaches registered yet.</p>
                        <p className="text-xs text-text-dim mt-1">Coaches can register via Coach Sign-Up or you can add them manually above.</p>
                      </div>
                    ) : filteredCoaches.length === 0 ? (
                      <div className="bg-surface p-8 text-center text-text-dim rounded-2xl border border-line">
                        <Search className="w-8 h-8 text-text-dim/30 mx-auto mb-2" />
                        <p className="text-xs font-semibold">No coaches match "{adminCoachSearch}"</p>
                        <button
                          onClick={() => setAdminCoachSearch('')}
                          className="mt-2 text-gold text-xs underline hover:opacity-80"
                        >
                          Clear search filter
                        </button>
                      </div>
                    ) : (
                      <div className="overflow-x-auto bg-surface rounded-2xl border border-line shadow-sm">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-line bg-ink/50 text-text-dim font-semibold">
                              <th className="p-4">Username</th>
                              <th className="p-4">Password</th>
                              <th className="p-4">Full Name</th>
                              <th className="p-4">Club/Team</th>
                              <th className="p-4">Phone</th>
                              <th className="p-4">Email</th>
                              <th className="p-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line/30">
                            {filteredCoaches.map(([username, coach]: [string, any]) => (
                              <React.Fragment key={username}>
                                {editingCoachUsername === username ? (
                                  <tr className="bg-surface-2/30">
                                    <td className="p-4 font-mono font-bold text-gold">{username}</td>
                                    <td className="p-4">
                                      <input
                                        type="text"
                                        value={editCoachPass}
                                        onChange={(e) => setEditCoachPass(e.target.value)}
                                        className="w-full bg-ink border border-line rounded px-2 py-1 text-text focus:border-gold outline-none"
                                      />
                                    </td>
                                    <td className="p-4">
                                      <input
                                        type="text"
                                        value={editCoachName}
                                        onChange={(e) => setEditCoachName(e.target.value)}
                                        className="w-full bg-ink border border-line rounded px-2 py-1 text-text focus:border-gold outline-none"
                                      />
                                    </td>
                                    <td className="p-4">
                                      <input
                                        type="text"
                                        value={editCoachClub}
                                        onChange={(e) => setEditCoachClub(e.target.value)}
                                        className="w-full bg-ink border border-line rounded px-2 py-1 text-text focus:border-gold outline-none"
                                      />
                                    </td>
                                    <td className="p-4">
                                      <input
                                        type="text"
                                        value={editCoachPhone}
                                        onChange={(e) => setEditCoachPhone(e.target.value)}
                                        className="w-full bg-ink border border-line rounded px-2 py-1 text-text focus:border-gold outline-none"
                                      />
                                    </td>
                                    <td className="p-4">
                                      <input
                                        type="email"
                                        value={editCoachEmail}
                                        onChange={(e) => setEditCoachEmail(e.target.value)}
                                        className="w-full bg-ink border border-line rounded px-2 py-1 text-text focus:border-gold outline-none"
                                      />
                                    </td>
                                    <td className="p-4 text-right whitespace-nowrap">
                                      <button
                                        onClick={handleAdminSaveCoach}
                                        className="text-good hover:bg-good/10 px-2.5 py-1 rounded transition mr-2 font-semibold"
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick={() => setEditingCoachUsername(null)}
                                        className="text-text-dim hover:bg-line/50 px-2 py-1 rounded transition"
                                      >
                                        Cancel
                                      </button>
                                    </td>
                                  </tr>
                                ) : (
                                  <tr className="hover:bg-surface-2/30 transition">
                                    <td className="p-4 font-mono font-bold text-gold">{username}</td>
                                    <td className="p-4 font-mono text-text-dim">{coach.password}</td>
                                    <td className="p-4 text-text font-bold uppercase">{coach.name}</td>
                                    <td className="p-4 text-text">{coach.club}</td>
                                    <td className="p-4 text-text font-mono">{coach.phone || '-'}</td>
                                    <td className="p-4 text-text">{coach.email || '-'}</td>
                                    <td className="p-4 text-right whitespace-nowrap">
                                      {confirmDeleteCoachUsername === username ? (
                                        <div className="flex items-center justify-end space-x-1.5 animate-fade-in">
                                          <span className="text-[10px] text-hong font-semibold mr-1">Delete?</span>
                                          <button 
                                            onClick={() => handleAdminDeleteCoach(username)}
                                            className="bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-sm transition"
                                          >
                                            Confirm
                                          </button>
                                          <button 
                                            onClick={() => setConfirmDeleteCoachUsername(null)}
                                            className="bg-surface border border-line text-text hover:bg-line px-2.5 py-1 rounded-lg text-[10px] transition"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center justify-end space-x-1">
                                          <button
                                            onClick={() => handleAdminEditCoach(username, coach)}
                                            className="text-chong hover:bg-chong/10 p-1.5 rounded transition"
                                            title="Edit Coach Details"
                                          >
                                            <Edit className="w-4 h-4" />
                                          </button>
                                          <button
                                            onClick={() => setConfirmDeleteCoachUsername(username)}
                                            className="text-hong hover:bg-hong/10 p-1.5 rounded transition"
                                            title="Delete Coach Account"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* REGISTERED ORGANIZERS */}
              {adminTab === 'organizers' && (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-text-dim uppercase tracking-widest">Create Organizer</h3>
                  <div className="bg-surface rounded-2xl border border-line shadow-sm p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Username</label>
                        <input type="text" value={orgUsername} onChange={e => setOrgUsername(e.target.value)} className="w-full bg-ink border border-line rounded px-3 py-2 text-sm text-text focus:border-gold outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Password</label>
                        <input type="text" value={orgPass} onChange={e => setOrgPass(e.target.value)} className="w-full bg-ink border border-line rounded px-3 py-2 text-sm text-text focus:border-gold outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Full Name</label>
                        <input type="text" value={orgName} onChange={e => setOrgName(e.target.value)} className="w-full bg-ink border border-line rounded px-3 py-2 text-sm text-text focus:border-gold outline-none" placeholder="John Doe" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Assigned Tournament</label>
                        <select value={orgCompId} onChange={e => setOrgCompId(e.target.value)} className="w-full bg-ink border border-line rounded px-3 py-2 text-sm text-text focus:border-gold outline-none">
                          <option value="">-- Select Tournament --</option>
                          {competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button onClick={handleAdminCreateOrganizer} className="bg-gold text-ink font-bold px-4 py-2 rounded-xl text-sm hover:opacity-90 transition">
                        Create Organizer
                      </button>
                    </div>
                  </div>

                  <h3 className="text-xs font-bold text-text-dim uppercase tracking-widest mt-6">Registered Organizers ({Object.keys(organizers).length})</h3>
                  {Object.keys(organizers).length === 0 ? (
                    <div className="bg-surface p-12 text-center text-text-dim rounded-2xl border border-line">
                      <UserPlus className="w-12 h-12 text-text-dim/30 mx-auto mb-3" />
                      <p className="text-sm font-semibold">No organizers registered yet.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto bg-surface rounded-2xl border border-line shadow-sm">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-line bg-ink/50 text-text-dim font-semibold">
                            <th className="p-4">Username</th>
                            <th className="p-4">Password</th>
                            <th className="p-4">Full Name</th>
                            <th className="p-4">Tournament</th>
                            <th className="p-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line/30">
                          {Object.entries(organizers).map(([username, org]: [string, any]) => (
                            <tr key={username} className="hover:bg-surface-2/30 transition">
                              <td className="p-4 font-mono font-bold text-gold">{username}</td>
                              <td className="p-4 font-mono text-text-dim">{org.password}</td>
                              <td className="p-4 text-text font-bold uppercase">{org.name}</td>
                              <td className="p-4 text-text">{competitions.find(c => c.id === org.compId)?.name || 'Unknown'}</td>
                              <td className="p-4 text-right whitespace-nowrap">
                                {confirmDeleteOrganizerUsername === username ? (
                                  <div className="flex items-center justify-end space-x-1">
                                    <button 
                                      onClick={() => handleAdminDeleteOrganizer(username)}
                                      className="bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-sm"
                                    >
                                      Confirm
                                    </button>
                                    <button 
                                      onClick={() => setConfirmDeleteOrganizerUsername(null)}
                                      className="bg-surface border border-line text-text hover:bg-line px-2.5 py-1 rounded-lg text-[10px]"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setConfirmDeleteOrganizerUsername(username)}
                                    className="text-hong hover:bg-hong/10 p-1.5 rounded transition"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* REFEREE ACCOUNTS MANAGEMENT */}
              {adminTab === 'referees' && (
                <div className="space-y-6 animate-fade-in">
                  
                  {/* Stats Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-surface p-5 rounded-2xl border border-line shadow-sm flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-text-dim uppercase tracking-wider">Total Referee Accounts</span>
                        <h4 className="text-2xl font-black text-gold mt-1">{refereeAccounts.length}</h4>
                      </div>
                      <div className="bg-gold/10 p-2.5 rounded-xl">
                        <Scale className="w-5 h-5 text-gold" />
                      </div>
                    </div>

                    <div className="bg-surface p-5 rounded-2xl border border-line shadow-sm flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-text-dim uppercase tracking-wider">International (IR)</span>
                        <h4 className="text-2xl font-black text-emerald-400 mt-1">
                          {refereeAccounts.filter(r => r.kyorugiStatus === 'IR' || r.poomsaeStatus === 'IR').length}
                        </h4>
                      </div>
                      <div className="bg-emerald-500/10 p-2.5 rounded-xl">
                        <Trophy className="w-5 h-5 text-emerald-400" />
                      </div>
                    </div>

                    <div className="bg-surface p-5 rounded-2xl border border-line shadow-sm flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-text-dim uppercase tracking-wider">National (NR)</span>
                        <h4 className="text-2xl font-black text-blue-400 mt-1">
                          {refereeAccounts.filter(r => r.kyorugiStatus === 'NR' || r.poomsaeStatus === 'NR').length}
                        </h4>
                      </div>
                      <div className="bg-blue-500/10 p-2.5 rounded-xl">
                        <Shield className="w-5 h-5 text-blue-400" />
                      </div>
                    </div>
                  </div>

                  {/* Create / Edit Form */}
                  <div className="bg-surface rounded-2xl border border-line shadow-sm p-6 space-y-4">
                    <div className="flex justify-between items-center border-b border-line pb-3">
                      <h3 className="text-xs font-bold text-text-dim uppercase tracking-widest flex items-center gap-2">
                        <UserPlus className="w-4 h-4 text-gold" />
                        {editingRefereeNric ? 'Edit Referee Account' : 'Create New Referee Account'}
                      </h3>
                      {editingRefereeNric && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRefereeNric(null);
                            setAdminRefName('');
                            setAdminRefNric('');
                            setAdminRefPassword('');
                            setAdminRefPhone('');
                            setAdminRefClub('');
                            setAdminRefResidential('');
                            setAdminRefDistance('');
                            setAdminRefBankName('');
                            setAdminRefBankAccount('');
                            setAdminRefAccommodation('No');
                            setAdminRefKyorugi('TR');
                            setAdminRefPoomsae('TR');
                            setAdminRefCarPlate('');
                            setAdminRefSpecialRole('None');
                          }}
                          className="text-xs text-text-dim hover:text-text underline"
                        >
                          Cancel Edit
                        </button>
                      )}
                    </div>

                    <form onSubmit={handleAdminSaveRefereeAccount} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div>
                        <label className="block text-[10px] font-bold text-text-dim uppercase tracking-wider mb-1">Full Name</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. John Doe"
                          value={adminRefName}
                          onChange={(e) => setAdminRefName(e.target.value)}
                          className="w-full bg-ink/30 border border-line/80 focus:border-gold rounded-xl px-3.5 py-2.5 text-text outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-text-dim uppercase tracking-wider mb-1">NRIC Number</label>
                        <input
                          type="text"
                          required
                          disabled={!!editingRefereeNric}
                          placeholder="e.g. 900101-14-1234"
                          value={adminRefNric}
                          onChange={(e) => setAdminRefNric(e.target.value)}
                          className="w-full bg-ink/30 border border-line/80 focus:border-gold rounded-xl px-3.5 py-2.5 text-text outline-none disabled:opacity-55"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-text-dim uppercase tracking-wider mb-1">Password</label>
                        <input
                          type="password"
                          required={!editingRefereeNric}
                          placeholder={editingRefereeNric ? "(Leave blank to keep current)" : "Enter password"}
                          value={adminRefPassword}
                          onChange={(e) => setAdminRefPassword(e.target.value)}
                          className="w-full bg-ink/30 border border-line/80 focus:border-gold rounded-xl px-3.5 py-2.5 text-text outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-text-dim uppercase tracking-wider mb-1">Contact Phone</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. +60123456789"
                          value={adminRefPhone}
                          onChange={(e) => setAdminRefPhone(e.target.value)}
                          className="w-full bg-ink/30 border border-line/80 focus:border-gold rounded-xl px-3.5 py-2.5 text-text outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-text-dim uppercase tracking-wider mb-1">State / Club Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Selangor Taekwondo"
                          value={adminRefClub}
                          onChange={(e) => setAdminRefClub(e.target.value)}
                          className="w-full bg-ink/30 border border-line/80 focus:border-gold rounded-xl px-3.5 py-2.5 text-text outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-text-dim uppercase tracking-wider mb-1">Residential Town/City</label>
                        <input
                          type="text"
                          placeholder="e.g. Kajang, Selangor"
                          value={adminRefResidential}
                          onChange={(e) => setAdminRefResidential(e.target.value)}
                          className="w-full bg-ink/30 border border-line/80 focus:border-gold rounded-xl px-3.5 py-2.5 text-text outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-text-dim uppercase tracking-wider mb-1">Go-Return Travel Distance (KM)</label>
                        <input
                          type="number"
                          placeholder="e.g. 150"
                          value={adminRefDistance}
                          onChange={(e) => setAdminRefDistance(e.target.value)}
                          className="w-full bg-ink/30 border border-line/80 focus:border-gold rounded-xl px-3.5 py-2.5 text-text outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-text-dim uppercase tracking-wider mb-1">Bank Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Maybank"
                          value={adminRefBankName}
                          onChange={(e) => setAdminRefBankName(e.target.value)}
                          className="w-full bg-ink/30 border border-line/80 focus:border-gold rounded-xl px-3.5 py-2.5 text-text outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-text-dim uppercase tracking-wider mb-1">Bank Account No.</label>
                        <input
                          type="text"
                          placeholder="e.g. 164012345678"
                          value={adminRefBankAccount}
                          onChange={(e) => setAdminRefBankAccount(e.target.value)}
                          className="w-full bg-ink/30 border border-line/80 focus:border-gold rounded-xl px-3.5 py-2.5 text-text outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-text-dim uppercase tracking-wider mb-1">Car Plate Number</label>
                        <input
                          type="text"
                          placeholder="e.g. ABC 1234"
                          value={adminRefCarPlate}
                          onChange={(e) => setAdminRefCarPlate(e.target.value)}
                          className="w-full bg-ink/30 border border-line/80 focus:border-gold rounded-xl px-3.5 py-2.5 text-text outline-none uppercase"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-text-dim uppercase tracking-wider mb-1">Kyorugi Status</label>
                        <select
                          value={adminRefKyorugi}
                          onChange={(e) => setAdminRefKyorugi(e.target.value as any)}
                          className="w-full bg-ink border border-line/80 focus:border-gold rounded-xl px-3.5 py-2.5 text-text outline-none"
                        >
                          <option value="IR">International Referee (IR)</option>
                          <option value="NR">National Referee (NR)</option>
                          <option value="SR">State Referee (SR)</option>
                          <option value="TR">Trainee Referee (TR)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-text-dim uppercase tracking-wider mb-1">Poomsae Status</label>
                        <select
                          value={adminRefPoomsae}
                          onChange={(e) => setAdminRefPoomsae(e.target.value as any)}
                          className="w-full bg-ink border border-line/80 focus:border-gold rounded-xl px-3.5 py-2.5 text-text outline-none"
                        >
                          <option value="IR">International Referee (IR)</option>
                          <option value="NR">National Referee (NR)</option>
                          <option value="SR">State Referee (SR)</option>
                          <option value="TR">Trainee Referee (TR)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-text-dim uppercase tracking-wider mb-1">Accommodation Option</label>
                        <select
                          value={adminRefAccommodation}
                          onChange={(e) => setAdminRefAccommodation(e.target.value as any)}
                          className="w-full bg-ink border border-line/80 focus:border-gold rounded-xl px-3.5 py-2.5 text-text outline-none"
                        >
                          <option value="No">Self-Arranged</option>
                          <option value="Yes">Requested (Arranged by Organizer)</option>
                        </select>
                      </div>

                       <div>
                        <label className="block text-[10px] font-bold text-text-dim uppercase tracking-wider mb-1">Special Appointed Role</label>
                        <select
                          value={adminRefSpecialRole}
                          onChange={(e) => setAdminRefSpecialRole(e.target.value as any)}
                          className="w-full bg-ink border border-line/80 focus:border-gold rounded-xl px-3.5 py-2.5 text-text outline-none"
                        >
                          <option value="None">None (Standard Referee)</option>
                          <option value="TD">Technical Delegate (TD)</option>
                          <option value="CSB">Supervisory Board (CSB)</option>
                          <option value="RIC">Referee In-Charge (RIC)</option>
                          <option value="GAME_MASTER">Game Master (GM) - Virtual Taekwondo</option>
                          <option value="TECHNICAL_OPERATOR">Technical Operator (TO) - Virtual Taekwondo</option>
                          <option value="VIRTUAL_REFEREE">Virtual Referee (VR) - Virtual Taekwondo</option>
                        </select>
                      </div>

                      <div className="md:col-span-3 flex justify-end pt-2">
                        <button
                          type="submit"
                          className="bg-gold hover:opacity-95 text-ink font-bold px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-sm transition cursor-pointer"
                        >
                          <Save className="w-4 h-4" />
                          {editingRefereeNric ? 'Save Changes' : 'Register Referee Account'}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Referee Accounts List */}
                  <div className="bg-surface rounded-2xl border border-line shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-line flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <h3 className="text-xs font-bold text-text uppercase tracking-widest flex items-center gap-2">
                        <Scale className="w-4 h-4 text-gold" />
                        Referee Accounts Database
                      </h3>
                      
                      <div className="w-full sm:w-72">
                        <div className="relative">
                          <Search className="w-4 h-4 text-text-dim absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Search referee by name, NRIC..."
                            value={dbSearchQuery}
                            onChange={(e) => setDbSearchQuery(e.target.value)}
                            className="w-full bg-ink/30 border border-line/60 rounded-xl pl-9.5 pr-4 py-2 text-xs text-text outline-none focus:border-gold"
                          />
                        </div>
                      </div>
                    </div>

                    {refereeAccounts.length === 0 ? (
                      <div className="text-center p-8 text-text-dim text-xs">
                        No referee accounts registered in the global system yet.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-ink/40 text-text-dim border-b border-line font-bold uppercase tracking-wider text-[10px]">
                              <th className="p-4">Full Name</th>
                              <th className="p-4">NRIC / Pass / Phone</th>
                              <th className="p-4">State / Club</th>
                              <th className="p-4">Travel / Distance</th>
                              <th className="p-4">Qualifications</th>
                              <th className="p-4">Bank Account</th>
                              <th className="p-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line/30">
                            {refereeAccounts
                              .filter(r => {
                                const q = dbSearchQuery.toLowerCase().trim();
                                if (!q) return true;
                                return (
                                  r.fullName.toLowerCase().includes(q) ||
                                  r.nric.toLowerCase().includes(q) ||
                                  (r.clubName && r.clubName.toLowerCase().includes(q)) ||
                                  r.phone.includes(q)
                                );
                              })
                              .sort((a, b) => a.fullName.localeCompare(b.fullName))
                              .map((ref) => (
                                <tr key={ref.nric} className="hover:bg-surface-2/30 transition">
                                  <td className="p-4 font-bold text-text uppercase">{ref.fullName}</td>
                                  <td className="p-4">
                                    <div className="font-mono text-gold font-bold">{ref.nric}</div>
                                    <div className="font-mono text-text-dim text-[11px] font-bold">PW: {ref.password || 'N/A'}</div>
                                    <div className="text-text-dim text-[11px]">{ref.phone}</div>
                                  </td>
                                  <td className="p-4 uppercase text-text font-semibold">{ref.clubName || 'N/A'}</td>
                                  <td className="p-4">
                                    <div className="font-medium text-text">{ref.residentialLocation || 'N/A'}</div>
                                    <div className="text-text-dim text-[11px] font-mono">{ref.distance} KM (Go/Return)</div>
                                  </td>
                                  <td className="p-4">
                                    <div className="flex gap-1">
                                      <span className="bg-gold/10 text-gold px-1.5 py-0.5 rounded text-[10px] font-bold">K: {ref.kyorugiStatus}</span>
                                      <span className="bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded text-[10px] font-bold">P: {ref.poomsaeStatus}</span>
                                    </div>
                                  </td>
                                  <td className="p-4">
                                    <div className="text-text font-medium">{ref.bankName || 'N/A'}</div>
                                    <div className="text-text-dim text-[11px] font-mono">{ref.bankAccount || 'N/A'}</div>
                                  </td>
                                  <td className="p-4 text-right whitespace-nowrap">
                                    {confirmDeleteRefereeAccountNric === ref.nric ? (
                                      <div className="flex items-center justify-end space-x-1">
                                        <button 
                                          onClick={() => handleAdminDeleteRefereeAccount(ref.nric)}
                                          className="bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-sm cursor-pointer"
                                        >
                                          Confirm
                                        </button>
                                        <button 
                                          onClick={() => setConfirmDeleteRefereeAccountNric(null)}
                                          className="bg-surface border border-line text-text hover:bg-line px-2.5 py-1 rounded-lg text-[10px] cursor-pointer"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-end gap-1.5">
                                        <button
                                          onClick={() => {
                                            setEditingRefereeNric(ref.nric);
                                            setAdminRefName(ref.fullName);
                                            setAdminRefNric(ref.nric);
                                            setAdminRefPassword(ref.password || '');
                                            setAdminRefPhone(ref.phone);
                                            setAdminRefClub(ref.clubName || '');
                                            setAdminRefResidential(ref.residentialLocation || '');
                                            setAdminRefDistance(String(ref.distance));
                                            setAdminRefBankName(ref.bankName || '');
                                            setAdminRefBankAccount(ref.bankAccount || '');
                                            setAdminRefAccommodation(ref.accommodation || 'No');
                                            setAdminRefKyorugi(ref.kyorugiStatus || 'TR');
                                            setAdminRefPoomsae(ref.poomsaeStatus || 'TR');
                                            setAdminRefCarPlate(ref.carPlate || '');
                                            setAdminRefSpecialRole(ref.specialRole || 'None');
                                          }}
                                          className="text-gold hover:bg-gold/10 p-1.5 rounded transition"
                                          title="Edit Account"
                                        >
                                          <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() => setConfirmDeleteRefereeAccountNric(ref.nric)}
                                          className="text-hong hover:bg-hong/10 p-1.5 rounded transition"
                                          title="Delete Account"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* SECURITY SETTINGS */}
              {adminTab === 'security' && (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-text-dim uppercase tracking-widest">Change Administrative Password</h3>
                  <div className="bg-surface rounded-2xl border border-line shadow-sm p-6 space-y-4 max-w-xl">
                    <p className="text-xs text-text-dim leading-relaxed">
                      Update the security password used to access the Administrative Control Hub. Note that the username is always <code className="bg-ink px-1.5 py-0.5 rounded font-mono text-gold text-[11px] font-bold">admin</code>.
                    </p>
                    
                    <div className="space-y-4 pt-2">
                      <div>
                        <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Current Password</label>
                        <div className="bg-ink/50 border border-line/50 rounded-xl px-3 py-2 text-sm text-text-dim/80 font-mono select-none">
                          â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢ (Stored securely in local storage)
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">New Administrative Password</label>
                        <input 
                          type="password" 
                          value={newAdminPass} 
                          onChange={e => setNewAdminPass(e.target.value)} 
                          className="w-full bg-ink border border-line rounded-xl px-3 py-2 text-sm text-text focus:border-gold outline-none" 
                          placeholder="Enter new admin password"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Confirm New Password</label>
                        <input 
                          type="password" 
                          value={confirmAdminPass} 
                          onChange={e => setConfirmAdminPass(e.target.value)} 
                          className="w-full bg-ink border border-line rounded-xl px-3 py-2 text-sm text-text focus:border-gold outline-none" 
                          placeholder="Re-type new admin password"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button 
                        onClick={handleAdminChangePassword} 
                        className="bg-gold text-ink font-bold px-4 py-2.5 rounded-xl text-xs hover:opacity-90 transition flex items-center gap-1.5"
                      >
                        <Lock className="w-4 h-4" />
                        <span>Update Admin Password</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {adminTab === 'clubs' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-start flex-col sm:flex-row gap-3">
                    <div>
                      <h3 className="text-xs font-bold text-text-dim uppercase tracking-widest">Global Affiliated Clubs / States</h3>
                      <p className="text-xs text-text-dim mt-1">Configure dojangs, clubs, or state teams that coaches can select across all tournament events.</p>
                    </div>
                    <label className="cursor-pointer text-xs bg-ink border border-line hover:border-gold text-gold px-4 py-2 rounded-xl transition flex items-center gap-1.5 font-bold shadow-sm self-stretch sm:self-auto justify-center">
                      <Upload className="w-4 h-4" />
                      <span>Upload CSV/Excel List</span>
                      <input 
                        type="file" 
                        accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                        className="hidden"
                        onChange={handleUploadGlobalClubs}
                      />
                    </label>
                  </div>

                  <div className="bg-surface rounded-2xl border border-line shadow-sm p-6 space-y-4">
                    <div className="flex space-x-2">
                      <input 
                        type="text" 
                        value={newGlobalClubOption}
                        onChange={(e) => setNewGlobalClubOption(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddGlobalClub(newGlobalClubOption, setNewGlobalClubOption); }}
                        placeholder="e.g. SMART MA TAEKWONDO CLUB" 
                        className="flex-1 bg-ink border border-line text-xs rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
                      />
                      <button 
                        onClick={() => handleAddGlobalClub(newGlobalClubOption, setNewGlobalClubOption)}
                        className="bg-gold hover:opacity-90 text-ink px-4 py-2 rounded-xl text-xs font-bold shadow transition-all duration-200"
                      >
                        Add Club Option
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2 p-4 bg-ink rounded-xl border border-line">
                      {globalClubs.length === 0 ? (
                        <div className="text-xs text-text-dim italic p-2">No custom options defined. Default fallback list is currently in use.</div>
                      ) : (
                        globalClubs.map((club, i) => (
                          <span key={i} className="inline-flex items-center text-xs bg-surface border border-line px-3 py-1.5 rounded-xl text-text font-medium shadow-sm">
                            <span>{club}</span>
                            <button 
                              onClick={() => handleRemoveGlobalClub(i)}
                              className="ml-2 text-red-500 hover:text-red-400 text-sm font-bold leading-none cursor-pointer"
                              title="Delete club"
                            >
                              Ã—
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {adminTab === 'ric' && (
                <div className="space-y-6">
                  <div className="bg-surface p-5 rounded-2xl border border-line shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h3 className="text-base font-bold text-text uppercase tracking-wider flex items-center gap-2 font-display">
                        <Sliders className="w-5 h-5 text-gold" />
                        <span>Referee-In-Charge (RIC) Credentials & Event Settings</span>
                      </h3>
                      <p className="text-xs text-text-dim mt-1">Configure login credentials (NRIC/Username and Password) for RIC personnel and manage tournament event settings.</p>
                    </div>
                    <button 
                      onClick={() => setScreen('ricDashboard')}
                      className="bg-gold hover:opacity-90 text-ink font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow cursor-pointer shrink-0"
                      id="ric-launch-terminal-btn"
                    >
                      <Sliders className="w-4 h-4" />
                      <span>Enter RIC Terminal</span>
                    </button>
                  </div>

                  {/* CREATE / EDIT RIC USER CREDENTIALS CARD */}
                  <div className="bg-surface rounded-2xl border border-line shadow-sm p-6 space-y-4">
                    <div className="flex justify-between items-center border-b border-line pb-3">
                      <h4 className="text-xs font-bold text-text uppercase tracking-widest flex items-center gap-2">
                        <UserPlus className="w-4 h-4 text-gold" />
                        {editingRicNric ? 'Edit RIC Account Credentials' : 'Create / Set RIC User Credentials'}
                      </h4>
                      {editingRicNric && (
                        <button 
                          onClick={() => {
                            setEditingRicNric(null);
                            setAdminRicName('');
                            setAdminRicNric('');
                            setAdminRicPassword('');
                            setAdminRicPhone('');
                            setAdminRicCompId('');
                          }}
                          className="text-xs text-gold underline hover:text-text cursor-pointer"
                        >
                          Cancel Edit
                        </button>
                      )}
                    </div>

                    <form onSubmit={handleAdminSaveRicAccount} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                      <div className="col-span-1 md:col-span-2 lg:col-span-3 bg-surface-2/40 p-3.5 rounded-xl border border-line/70 flex flex-col sm:flex-row items-center gap-3">
                        <label className="text-[10px] font-bold text-gold uppercase tracking-wider shrink-0 flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-gold" />
                          <span>Select Referee to Autofill:</span>
                        </label>
                        <select
                          onChange={(e) => {
                            const val = e.target.value;
                            if (!val) return;
                            const ref = [...refereeAccounts, ...referees].find(r => r.nric === val || r.fullName === val);
                            if (ref) {
                              setAdminRicName(ref.fullName);
                              setAdminRicNric(ref.nric);
                              setAdminRicPhone(ref.phone || '');
                              if (ref.password) setAdminRicPassword(ref.password);
                              if (ref.compId) setAdminRicCompId(ref.compId);
                            }
                          }}
                          className="w-full bg-ink/40 border border-gold/40 focus:border-gold rounded-lg px-3 py-2 text-text text-xs outline-none cursor-pointer font-medium"
                          defaultValue=""
                        >
                          <option value="">-- Choose from Registered Referee List (Autofills NRIC & Phone) --</option>
                          {Array.from(new Map([...refereeAccounts, ...referees].filter(r => r.fullName && r.nric).map(r => [r.nric, r])).values())
                            .sort((a, b) => a.fullName.localeCompare(b.fullName))
                            .map((r) => (
                            <option key={r.nric} value={r.nric}>
                              {r.fullName} â€” NRIC/Username: {r.nric} {r.phone ? `(${r.phone})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-text-dim uppercase tracking-wider mb-1">Full Name *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Master Tan (RIC Lead)"
                          value={adminRicName}
                          onChange={(e) => setAdminRicName(e.target.value)}
                          className="w-full bg-ink/30 border border-line/80 focus:border-gold rounded-xl px-3.5 py-2.5 text-text outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-text-dim uppercase tracking-wider mb-1">NRIC / Username *</label>
                        <input
                          type="text"
                          required
                          disabled={!!editingRicNric}
                          placeholder="e.g. RIC-001 or 850101-14-5555"
                          value={adminRicNric}
                          onChange={(e) => setAdminRicNric(e.target.value)}
                          className="w-full bg-ink/30 border border-line/80 focus:border-gold rounded-xl px-3.5 py-2.5 text-text outline-none disabled:opacity-55"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-text-dim uppercase tracking-wider mb-1">Password *</label>
                        <input
                          type="password"
                          required={!editingRicNric}
                          placeholder={editingRicNric ? "(Leave blank to keep current)" : "Enter password"}
                          value={adminRicPassword}
                          onChange={(e) => setAdminRicPassword(e.target.value)}
                          className="w-full bg-ink/30 border border-line/80 focus:border-gold rounded-xl px-3.5 py-2.5 text-text outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-text-dim uppercase tracking-wider mb-1">Contact Phone</label>
                        <input
                          type="text"
                          placeholder="e.g. +60123456789"
                          value={adminRicPhone}
                          onChange={(e) => setAdminRicPhone(e.target.value)}
                          className="w-full bg-ink/30 border border-line/80 focus:border-gold rounded-xl px-3.5 py-2.5 text-text outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-text-dim uppercase tracking-wider mb-1">Assigned Tournament Event</label>
                        <select
                          value={adminRicCompId}
                          onChange={(e) => setAdminRicCompId(e.target.value)}
                          className="w-full bg-ink/30 border border-line/80 focus:border-gold rounded-xl px-3.5 py-2.5 text-text outline-none"
                        >
                          <option value="">-- All / Global Event Access --</option>
                          {competitions.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-end">
                        <button
                          type="submit"
                          className="w-full bg-gold hover:opacity-90 text-ink font-bold py-2.5 rounded-xl text-xs transition cursor-pointer shadow flex items-center justify-center gap-2"
                        >
                          <Lock className="w-4 h-4" />
                          <span>{editingRicNric ? 'Update RIC Credentials' : 'Save & Assign RIC Role'}</span>
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* DESIGNATED RIC ACCOUNTS LIST */}
                  <div className="bg-surface rounded-2xl border border-line shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-line">
                      <h4 className="text-xs font-bold text-text uppercase tracking-widest flex items-center gap-2">
                        <Shield className="w-4 h-4 text-gold" />
                        Active Designated RIC Accounts ({refereeAccounts.filter(r => r.specialRole === 'RIC').length})
                      </h4>
                    </div>

                    {refereeAccounts.filter(r => r.specialRole === 'RIC').length === 0 ? (
                      <div className="text-center p-8 text-text-dim text-xs">
                        No referee accounts are currently designated as RIC. Use the form above to create or set credentials for an RIC account.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-ink/40 text-text-dim border-b border-line font-bold uppercase tracking-wider text-[10px]">
                              <th className="p-4">Full Name</th>
                              <th className="p-4">NRIC / Username</th>
                              <th className="p-4">Password</th>
                              <th className="p-4">Phone</th>
                              <th className="p-4">Assigned Tournament</th>
                              <th className="p-4">Role Status</th>
                              <th className="p-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line/30">
                            {refereeAccounts.filter(r => r.specialRole === 'RIC').sort((a, b) => a.fullName.localeCompare(b.fullName)).map((ref) => (
                              <tr key={ref.nric} className="hover:bg-surface-2/30 transition">
                                <td className="p-4 font-bold text-text uppercase">{ref.fullName}</td>
                                <td className="p-4 font-mono text-gold font-bold">{ref.nric}</td>
                                <td className="p-4 font-mono text-text-dim font-bold">{ref.password || 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢'}</td>
                                <td className="p-4 text-text-dim">{ref.phone || 'N/A'}</td>
                                <td className="p-4 text-text font-medium">{competitions.find(c => c.id === ref.compId)?.name || 'Global Access'}</td>
                                <td className="p-4">
                                  <span className="bg-amber-500/10 border border-gold/40 text-gold px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                    RIC ACTIVE
                                  </span>
                                </td>
                                <td className="p-4 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => {
                                        setEditingRicNric(ref.nric);
                                        setAdminRicName(ref.fullName);
                                        setAdminRicNric(ref.nric);
                                        setAdminRicPassword(ref.password || '');
                                        setAdminRicPhone(ref.phone || '');
                                        setAdminRicCompId(ref.compId || '');
                                      }}
                                      className="text-gold hover:bg-gold/10 p-1.5 rounded transition cursor-pointer"
                                      title="Edit Credentials"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={async () => {
                                        const updated = refereeAccounts.map(a => a.nric === ref.nric ? { ...a, specialRole: 'None' as const } : a);
                                        setRefereeAccounts(updated);
                                        await saveRefereeAccount({ ...ref, specialRole: 'None' });
                                        triggerMsg(`Revoked RIC role for ${ref.fullName}.`, 'ok');
                                      }}
                                      className="text-text-dim hover:text-red-400 hover:bg-red-500/10 px-2.5 py-1 rounded-lg text-[10px] font-bold border border-line transition cursor-pointer"
                                      title="Revoke RIC Role"
                                    >
                                      Revoke RIC Role
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* RIC EVENT SETTINGS CARD */}
                  <div className="bg-surface rounded-2xl border border-line shadow-sm p-6 space-y-4">
                    <h4 className="text-xs font-bold text-text uppercase tracking-widest flex items-center gap-2 border-b border-line pb-3">
                      <Settings className="w-4 h-4 text-gold" />
                      RIC Operational Event Defaults
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div>
                        <label className="block text-[10px] font-bold text-text-dim uppercase tracking-wider mb-1">RIC Honorarium / Daily Allowance (RM)</label>
                        <input
                          type="number"
                          value={refereeFees.rate_ric}
                          onChange={(e) => updateRefereeFees({ ...refereeFees, rate_ric: Number(e.target.value) || 0 })}
                          className="w-full bg-ink/30 border border-line/80 focus:border-gold rounded-xl px-3.5 py-2.5 text-text outline-none font-mono"
                          placeholder="175"
                        />
                        <p className="text-[10px] text-text-dim mt-1">Default daily allowance rate for Referee-In-Charge.</p>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-text-dim uppercase tracking-wider mb-1">Default Ring/Court Count Preset ({currentRings.length} Active)</label>
                        <select
                          value={currentRings.length.toString()}
                          onChange={async (e) => {
                            const count = parseInt(e.target.value, 10);
                            if (!activeComp || isNaN(count)) return;
                            const newRings = Array.from({ length: count }, (_, i) => `Ring ${i + 1}`);
                            const updatedComp: Competition = { ...activeComp, rings: newRings };
                            const updatedComps = competitions.map(c => c.id === activeComp.id ? updatedComp : c);
                            await saveCompsToStorage(updatedComps);
                            triggerMsg(`Updated tournament court setup to ${count} rings!`, 'ok');
                          }}
                          className="w-full bg-ink/30 border border-line/80 focus:border-gold rounded-xl px-3.5 py-2.5 text-text outline-none cursor-pointer"
                        >
                          <option value="2">2 Rings (Ring 1 - 2)</option>
                          <option value="3">3 Rings (Ring 1 - 3)</option>
                          <option value="4">4 Rings (Ring 1 - 4)</option>
                          <option value="5">5 Rings (Ring 1 - 5)</option>
                          <option value="6">6 Rings (Ring 1 - 6)</option>
                          <option value="8">8 Rings (Ring 1 - 8)</option>
                          <option value="10">10 Rings (Ring 1 - 10)</option>
                          <option value="12">12 Rings (Ring 1 - 12)</option>
                        </select>
                        <p className="text-[10px] text-text-dim mt-1">Court assignment rings in RIC Terminal and live displays.</p>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-text-dim uppercase tracking-wider mb-1">RIC Control System Status</label>
                        <div className="bg-ink/30 border border-line/80 rounded-xl px-3.5 py-2.5 text-gold font-bold flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-good animate-pulse"></span>
                          <span>Real-Time Terminal Active</span>
                        </div>
                        <p className="text-[10px] text-text-dim mt-1">Live referee roster and match scheduler synced.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ADMIN FORM - CREATE COMPETITION */}
        {screen === 'adminCompForm' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => setScreen('adminHome')}
                className="text-xs text-gold border border-gold/30 px-3 py-1.5 rounded-lg hover:bg-gold/10 transition"
              >
                â† Back to admin panel
              </button>
              <h2 className="text-xl font-bold uppercase tracking-wider text-text">Create Championship Event</h2>
            </div>

            <div className="bg-surface rounded-2xl border border-line p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Official Tournament Title</label>
                <input 
                  type="text" 
                  value={ncName}
                  onChange={(e) => setNcName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateComp(); }}
                  placeholder="e.g. State Championship 2026" 
                  className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Venue Location</label>
                  <input 
                    type="text" 
                    value={ncVenue}
                    onChange={(e) => setNcVenue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateComp(); }}
                    placeholder="e.g. National Arena" 
                    className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Tournament Start Date</label>
                  <input 
                    type="date" 
                    value={ncDate}
                    onChange={(e) => setNcDate(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateComp(); }}
                    className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Tournament End Date</label>
                  <input 
                    type="date" 
                    value={ncEndDate}
                    onChange={(e) => setNcEndDate(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateComp(); }}
                    className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Registration Close Date</label>
                  <input 
                    type="date" 
                    value={ncRegistrationCloseDate}
                    onChange={(e) => setNcRegistrationCloseDate(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateComp(); }}
                    className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Weigh-in Staff Security Passcode</label>
                <input 
                  type="text" 
                  value={ncCode}
                  onChange={(e) => setNcCode(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateComp(); }}
                  className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
                />
                <p className="text-[10px] text-text-dim/60 mt-1">This passcode acts as physical scale access verification for tournament marshals during weigh-in sessions.</p>
              </div>

              <div className="pt-4 flex items-center space-x-3 border-t border-line/40">
                <button 
                  onClick={handleCreateComp}
                  className="bg-gold hover:opacity-90 text-ink font-bold px-5 py-2.5 rounded-xl text-xs shadow-md"
                >
                  Create tournament event
                </button>
                <button 
                  onClick={() => setScreen('adminHome')}
                  className="bg-ink text-text-dim border border-line hover:text-text px-5 py-2.5 rounded-xl text-xs transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ADMIN CONFIGURATION - COMPETITION DETAIL */}
        {screen === 'adminCompDetail' && activeComp && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface p-4 rounded-2xl border border-line shadow-sm">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold uppercase tracking-wider text-text font-display">{activeComp.name}</h2>
                  <button
                    onClick={() => {
                      setEditCompName(activeComp.name || '');
                      setEditCompVenue(activeComp.venue || '');
                      setEditCompDate(activeComp.date || '');
                      setEditCompEndDate(activeComp.endDate || activeComp.date || '');
                      setEditCompRegistrationCloseDate(activeComp.registrationCloseDate || activeComp.date || '');
                      setEditCompPasscode(activeComp.staffCode || '');
                      setShowEditCompModal(true);
                    }}
                    className="text-text-dim hover:text-gold transition p-1 hover:bg-gold/10 rounded-lg"
                    title="Edit Tournament Details"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-text-dim">Venue: {activeComp.venue} Â· Date: {formatDateRange(activeComp.date, activeComp.endDate)}</p>
                {activeComp.registrationCloseDate && (
                  <p className="text-xs text-text-dim mt-0.5">Registration Closes: {activeComp.registrationCloseDate}</p>
                )}
              </div>
              <button 
                onClick={() => setScreen('adminHome')}
                className="text-xs text-gold border border-gold/30 px-3 py-1.5 rounded-lg hover:bg-gold/10 transition shrink-0"
              >
                â† All Tournaments
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* STAFF CODE MANAGEMENT */}
              <div className="bg-surface rounded-2xl border border-line p-5 space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-text">Staff Weigh-in Authentication passcode</h3>
                <p className="text-xs text-text-dim">Officials and tournament scale marshals use this passcode to unlock the camera-scanning station terminal for weigh-in monitoring.</p>
                <div className="flex space-x-2">
                  <input 
                    type="text" 
                    defaultValue={activeComp.staffCode}
                    onBlur={(e) => handleUpdateStaffCode(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { handleUpdateStaffCode(e.currentTarget.value); e.currentTarget.blur(); } }}
                    className="flex-1 bg-ink border border-line text-xs rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
                  />
                  <button 
                    onClick={() => handleUpdateStaffCode(activeComp.staffCode)}
                    className="bg-gold hover:opacity-90 text-ink font-bold px-4 py-2 rounded-xl text-xs"
                  >
                    Set Code
                  </button>
                </div>
              </div>

              {/* PUBLIC VIEW PASSWORD MANAGEMENT */}
              <div className="bg-surface rounded-2xl border border-line p-5 space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-text flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-gold" />
                  Public View Access Password
                </h3>
                <p className="text-xs text-text-dim">Restrict guest access to registered competitor lists, weigh-in results, and division classifications. Leave blank for unrestricted public access.</p>
                <div className="flex space-x-2">
                  <input 
                    type="text" 
                    id="public-view-password-input"
                    placeholder="Unrestricted (No Password)"
                    defaultValue={activeComp.publicViewPassword || ''}
                    key={`public-pwd-${activeComp.id}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleUpdatePublicViewPassword(e.currentTarget.value);
                        e.currentTarget.blur();
                      }
                    }}
                    className="flex-1 bg-ink border border-line text-xs rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
                  />
                  <button 
                    onClick={() => {
                      const input = document.getElementById('public-view-password-input') as HTMLInputElement;
                      if (input) {
                        handleUpdatePublicViewPassword(input.value);
                      }
                    }}
                    className="bg-gold hover:opacity-90 text-ink font-bold px-4 py-2 rounded-xl text-xs whitespace-nowrap"
                  >
                    Set Password
                  </button>
                </div>
              </div>

              {/* COACH SCALE READOUT TOGGLE */}
              <div className="bg-surface rounded-2xl border border-line p-5 space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-text flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-gold" />
                  Coach View Scale Readout
                </h3>
                <p className="text-xs text-text-dim">Toggle whether coaches can see the exact weight values recorded by officials during weigh-in, or just the pass/fail result.</p>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => {
                      if (!compId) return;
                      const updated = competitions.map(c => 
                        c.id === compId ? { ...c, hideScaleReadout: !c.hideScaleReadout } : c
                      );
                      saveCompsToStorage(updated);
                      triggerMsg(`Scale readout is now ${!activeComp.hideScaleReadout ? 'hidden' : 'visible'} for coaches.`, 'ok');
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${!activeComp.hideScaleReadout ? 'bg-gold' : 'bg-line'}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        !activeComp.hideScaleReadout ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className="text-sm font-semibold text-text">
                    {!activeComp.hideScaleReadout ? 'Visible to Coaches' : 'Hidden from Coaches'}
                  </span>
                </div>
              </div>

              {/* DEMO DATA LOADER */}
              {activeComp.id === 'tmremaja25' || activeComp.id === 'tmremaja2026' ? (
                <div className="bg-surface rounded-2xl border border-line p-5 space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-text">Seed Official Demo Roster</h3>
                  <p className="text-xs text-text-dim">The uploaded participant sheets contain structured aggregate records representing verified competitor clubs in TM National Remaja 2026.</p>
                  
                  {confirmImport ? (
                    <div className="p-3 bg-red-950/20 border border-red-500/30 rounded-xl space-y-3">
                      <p className="text-xs text-red-200">Are you sure? Importing this demo roster will append placeholder competitors across multiple dynamically configured clubs. Perfect for scaling scale test simulation.</p>
                      <div className="flex space-x-2">
                        <button 
                          onClick={handleImportDemoRoster}
                          className="bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs"
                        >
                          Confirm Demo Import
                        </button>
                        <button 
                          onClick={() => setConfirmImport(false)}
                          className="bg-ink text-text-dim border border-line px-3 py-1.5 rounded-lg text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setConfirmImport(true)}
                      className="bg-emerald-950 text-gold border border-emerald-900/40 hover:bg-emerald-900/30 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Seed Tournament Demo Roster</span>
                    </button>
                  )}
                </div>
              ) : null}

              {/* ID CARD DESIGN MANAGEMENT */}
              <div className="col-span-1 lg:col-span-2 bg-surface rounded-2xl border border-line p-6 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-line/50">
                  <div>
                    <h3 className="text-base font-bold uppercase tracking-wider text-text flex items-center gap-2 font-display">
                      <Palette className="w-5 h-5 text-gold" />
                      ID Card Layout & Element Studio
                    </h3>
                    <p className="text-xs text-text-dim mt-1">Design the layout, re-arrange positions, adjust font sizes, and add/delete fields for all competitor badges.</p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer bg-gold/10 text-gold hover:bg-gold/15 border border-gold/30 rounded-xl px-4 py-2 text-center transition flex items-center justify-center gap-2 font-bold shadow text-xs">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{activeComp.idCardBgUrl ? 'Replace Custom BG' : 'Upload Custom BG'}</span>
                      <input 
                        type="file" 
                        accept="image/png, image/jpeg"
                        className="hidden"
                        onChange={handleUploadIdCardBg}
                      />
                    </label>
                    {activeComp.idCardBgUrl && (
                      <button
                        onClick={() => handleUpdateIdCardBgUrl(null)}
                        className="bg-red-600/10 text-red-400 hover:bg-red-600/20 border border-red-500/30 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                        title="Remove Custom Background"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Reset BG</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                  
                  {/* LEFT: LIVE PREVIEW CARD */}
                  <div className="md:col-span-5 flex flex-col items-center justify-center space-y-4 bg-ink/30 p-4 rounded-2xl border border-line/50">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gold flex items-center gap-1.5 bg-gold/5 px-2.5 py-1 rounded-full border border-gold/20">
                      <Eye className="w-3.5 h-3.5 animate-pulse" />
                      Live Layout Preview
                    </span>
                    
                    {(() => {
                      const demoMockupPlayer = {
                        id: 'ATH-8899',
                        name: 'MUHAMMAD AMIRUL',
                        club: 'KUALA LUMPUR DRAGONS',
                        event: 'Kyorugi (Sparring)',
                        ageGroup: 'Junior (15-17)',
                        gender: 'MALE',
                        weightClass: 'Under 55kg',
                        dob: '2010-04-12',
                        photo: ''
                      };
                      const p = demoMockupPlayer;
                      const belt = '#000000'; // Black belt default mockup
                      const fieldsList = getIdCardFields(activeComp);
                      
                      const getFontSizePx = (size: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl', defaultVal: string): string => {
                        const map: Record<string, string> = {
                          'xs': '9px',
                          'sm': '11px',
                          'base': '13px',
                          'lg': '14px',
                          'xl': '17px',
                          '2xl': '21px',
                          '3xl': '25px'
                        };
                        return map[size] || defaultVal;
                      };

                      return (
                        <div className="w-[280px] aspect-[1/1.4] bg-gradient-to-br from-[#12211C] to-[#0A1310] border border-slate-700/60 rounded-3xl overflow-hidden shadow-2xl relative flex flex-col justify-between">
                          {activeComp.idCardBgUrl && (
                            <>
                              <div className="absolute inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: `url(${activeComp.idCardBgUrl})` }} />
                              <div className="absolute inset-0 z-0 bg-black/40 mix-blend-multiply" />
                            </>
                          )}
                          
                          <div className="relative z-10 h-full flex-1 flex flex-col justify-between py-2.5">
                            {fieldsList.filter(f => f.visible).map(field => {
                              if (field.id === 'header') {
                                return (
                                  <div 
                                    key="header" 
                                    draggable
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData('text/plain', 'header');
                                      e.dataTransfer.effectAllowed = 'move';
                                      e.currentTarget.classList.add('opacity-40');
                                    }}
                                    onDragEnd={(e) => {
                                      e.currentTarget.classList.remove('opacity-40');
                                    }}
                                    onDragOver={(e) => {
                                      e.preventDefault();
                                      e.currentTarget.classList.add('ring-2', 'ring-dashed', 'ring-gold', 'bg-gold/10');
                                    }}
                                    onDragLeave={(e) => {
                                      e.currentTarget.classList.remove('ring-2', 'ring-dashed', 'ring-gold', 'bg-gold/10');
                                    }}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      e.currentTarget.classList.remove('ring-2', 'ring-dashed', 'ring-gold', 'bg-gold/10');
                                      const draggedId = e.dataTransfer.getData('text/plain');
                                      if (draggedId && draggedId !== 'header') {
                                        handleSwapFields(draggedId, 'header');
                                      }
                                    }}
                                    className={`relative group border border-transparent hover:border-dashed hover:border-gold/40 cursor-grab active:cursor-grabbing transition-all duration-150 h-8 bg-gradient-to-r from-hong via-hong to-chong flex ${
                                      field.align === 'left' ? 'justify-start gap-2' :
                                      field.align === 'right' ? 'justify-end gap-2' :
                                      field.align === 'center' ? 'justify-center gap-2' :
                                      'justify-between'
                                    } items-center px-3 shrink-0 shadow-sm w-full`}
                                  >
                                    <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-ink/85 border border-line rounded p-0.5 text-gold z-20 pointer-events-none">
                                      <GripVertical className="w-3 h-3" />
                                    </div>
                                    <span className="font-display font-bold tracking-wider uppercase drop-shadow-sm truncate" style={{ fontSize: (p.id.startsWith('STAFF-') || p.ageGroup === 'STAFF') ? `${parseInt(getFontSizePx(field.fontSize, '8px'), 10) + 3}px` : getFontSizePx(field.fontSize, '8px'), color: field.color || '#ffffff' }}>{activeComp.name}</span>
                                    
                                  </div>
                                );
                              }
                              if (field.id === 'belt') {
                                return (
                                  <div 
                                    key="belt" 
                                    draggable
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData('text/plain', 'belt');
                                      e.dataTransfer.effectAllowed = 'move';
                                      e.currentTarget.classList.add('opacity-40');
                                    }}
                                    onDragEnd={(e) => {
                                      e.currentTarget.classList.remove('opacity-40');
                                    }}
                                    onDragOver={(e) => {
                                      e.preventDefault();
                                      e.currentTarget.classList.add('ring-2', 'ring-dashed', 'ring-gold', 'bg-gold/10');
                                    }}
                                    onDragLeave={(e) => {
                                      e.currentTarget.classList.remove('ring-2', 'ring-dashed', 'ring-gold', 'bg-gold/10');
                                    }}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      e.currentTarget.classList.remove('ring-2', 'ring-dashed', 'ring-gold', 'bg-gold/10');
                                      const draggedId = e.dataTransfer.getData('text/plain');
                                      if (draggedId && draggedId !== 'belt') {
                                        handleSwapFields(draggedId, 'belt');
                                      }
                                    }}
                                    className="relative group border border-transparent hover:border-dashed hover:border-gold/40 cursor-grab active:cursor-grabbing transition-all duration-150 h-1.5 w-full shrink-0"
                                    style={{ backgroundColor: belt }}
                                  >
                                    <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-ink/85 border border-line rounded p-0.5 text-gold z-20 pointer-events-none">
                                      <GripVertical className="w-2.5 h-2.5" />
                                    </div>
                                  </div>
                                );
                              }

                              // Render dynamic content fields
                              return (
                                <div 
                                  key={field.id} 
                                  draggable
                                  onDragStart={(e) => {
                                    e.dataTransfer.setData('text/plain', field.id);
                                    e.dataTransfer.effectAllowed = 'move';
                                    e.currentTarget.classList.add('opacity-40');
                                  }}
                                  onDragEnd={(e) => {
                                    e.currentTarget.classList.remove('opacity-40');
                                  }}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    e.currentTarget.classList.add('ring-2', 'ring-dashed', 'ring-gold', 'bg-gold/10');
                                  }}
                                  onDragLeave={(e) => {
                                    e.currentTarget.classList.remove('ring-2', 'ring-dashed', 'ring-gold', 'bg-gold/10');
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    e.currentTarget.classList.remove('ring-2', 'ring-dashed', 'ring-gold', 'bg-gold/10');
                                    const draggedId = e.dataTransfer.getData('text/plain');
                                    if (draggedId && draggedId !== field.id) {
                                      handleSwapFields(draggedId, field.id);
                                    }
                                  }}
                                  className="relative group border border-transparent hover:border-dashed hover:border-gold/40 hover:bg-white/5 rounded-lg cursor-grab active:cursor-grabbing transition-all duration-150 px-4 py-1 shrink-0"
                                  title="Drag to rearrange"
                                >
                                  <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-ink/85 border border-line rounded p-0.5 text-gold z-20 pointer-events-none">
                                    <GripVertical className="w-3 h-3" />
                                  </div>
                                  {(() => {
                                    if (field.id === 'photo') {
                                      return (
                                        <div className={`flex ${
                                          field.align === 'left' ? 'justify-start' :
                                          field.align === 'right' ? 'justify-end' :
                                          'justify-center'
                                        }`}>
                                          <div className="w-16 h-20 bg-ink rounded-lg border border-line flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                                            <User className="w-5 h-5 text-text-dim/40 mx-auto" />
                                          </div>
                                        </div>
                                      );
                                    }
                                    if (field.id === 'name') {
                                      return (
                                        <div className={
                                          field.align === 'left' ? 'text-left' :
                                          field.align === 'right' ? 'text-right' :
                                          'text-center'
                                        }>
                                          <h3 className="font-display font-bold leading-tight tracking-wide uppercase line-clamp-2" style={{ fontSize: getFontSizePx(field.fontSize, '14px'), color: field.color || '#ffffff' }}>{p.name}</h3>
                                        </div>
                                      );
                                    }
                                    if (field.id === 'club') {
                                      return (
                                        <div className={
                                          field.align === 'left' ? 'text-left' :
                                          field.align === 'right' ? 'text-right' :
                                          'text-center'
                                        }>
                                          <p className="uppercase tracking-widest" style={{ fontSize: getFontSizePx(field.fontSize, '8px'), color: field.color || '#a0aec0' }}>{p.club}</p>
                                        </div>
                                      );
                                    }
                                    if (field.id === 'athleteId') {
                                      if (p.id.startsWith('STAFF-') || p.ageGroup === 'STAFF') return null;
                                      return (
                                        <div className={
                                          field.align === 'left' ? 'text-left' :
                                          field.align === 'right' ? 'text-right' :
                                          'text-center'
                                        }>
                                          <span className="inline-block bg-surface border border-line font-mono px-1.5 py-0.5 rounded font-bold" style={{ fontSize: getFontSizePx(field.fontSize, '8px'), color: field.color || '#D4AF37' }}>{p.id}</span>
                                        </div>
                                      );
                                    }
                                    if (field.id === 'metadata') {
                                      if (p.id.startsWith('STAFF-') || p.ageGroup === 'STAFF') {
                                        return (
                                          <div key="metadata" className="px-4 py-1 shrink-0 flex items-center justify-center border-t border-line/30 pt-4 pb-2">
                                            <span 
                                              className="font-display font-bold tracking-widest uppercase text-white" 
                                              style={{ 
                                                fontSize: `${parseInt(getFontSizePx(field.fontSize, '20px'), 10) + 10}px`, 
                                                color: field.color || '#ffffff' 
                                              }}
                                            >
                                              {p.event}
                                            </span>
                                          </div>
                                        );
                                      }
    return (
                                        <div className={`grid grid-cols-2 gap-2 text-[10px] border-t border-line/30 pt-2.5 ${
                                          field.align === 'left' ? 'text-left' :
                                          field.align === 'right' ? 'text-right' :
                                          'text-center'
                                        }`}>
                                          <div>
                                            <span className="block text-[7px] text-text-dim/60 uppercase tracking-widest font-bold">Category</span>
                                            <span className="font-medium line-clamp-1" style={{ fontSize: getFontSizePx(field.fontSize, '9px'), color: field.color || '#ffffff' }}>{p.ageGroup}</span>
                                          </div>
                                          <div>
                                            <span className="block text-[7px] text-text-dim/60 uppercase tracking-widest font-bold">Gender</span>
                                            <span className="font-medium" style={{ fontSize: getFontSizePx(field.fontSize, '9px'), color: field.color || '#ffffff' }}>{p.gender}</span>
                                          </div>
                                          <div>
                                            <span className="block text-[7px] text-text-dim/60 uppercase tracking-widest font-bold font-sans">Weight</span>
                                            <span className="font-medium line-clamp-1" style={{ fontSize: getFontSizePx(field.fontSize, '9px'), color: field.color || '#ffffff' }}>{p.weightClass}</span>
                                          </div>
                                          <div>
                                            <span className="block text-[7px] text-text-dim/60 uppercase tracking-widest font-bold">DOB</span>
                                            <span className="font-medium" style={{ fontSize: getFontSizePx(field.fontSize, '9px'), color: field.color || '#ffffff' }}>{p.dob}</span>
                                          </div>
                                        </div>
                                      );
                                    }
                                    if (field.id === 'qrcode') {
                                      const containerClass = 
                                        field.align === 'right' ? 'flex flex-row-reverse items-center justify-between' :
                                        field.align === 'center' ? 'flex flex-col items-center justify-center gap-1 text-center' :
                                        'flex items-center justify-between';
                                      
                                      const textAlignmentClass = 
                                        field.align === 'right' ? 'text-left min-w-0' :
                                        field.align === 'center' ? 'text-center min-w-0' :
                                        'text-right min-w-0';

                                      return (
                                        <div className={`${containerClass} border-t border-dashed border-line/30 pt-2`}>
                                          <div className="bg-white p-1 rounded-lg inline-block shadow-md shrink-0">
                                            <QRCodeSVG 
                                              value={`${activeComp.id}::${p.id}`} 
                                              size={44} 
                                              level="M" 
                                              includeMargin={false}
                                            />
                                          </div>
                                          <div className={textAlignmentClass}>
                                            {!(p.id.startsWith('STAFF-') || p.ageGroup === 'STAFF') && <p className="font-display font-bold uppercase tracking-wider bg-slate-950/30 px-1.5 py-0.5 rounded border border-white/10 text-white inline-block mb-1" style={{ fontSize: getFontSizePx(field.fontSize, '8px') }}>{p.event}</p>}
                                        <p className="font-display font-bold uppercase tracking-wider" style={{ fontSize: getFontSizePx(field.fontSize, '7px'), color: field.color || '#D4AF37' }}>Tournament Entry Pass</p>
                                            <p className="mt-0.5 leading-normal" style={{ fontSize: getFontSizePx(field.fontSize, '6px'), color: field.color || '#a0aec0', opacity: 0.85 }}>Scan to digitally verify {p.id.startsWith('STAFF-') || p.ageGroup === 'STAFF' ? 'personnel.' : 'athlete.'}</p>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* RIGHT: LIST OF FIELDS WITH RE-ARRANGE, FONT SIZE, TOGGLE (ADD/DELETE) CONTROLS */}
                  <div className="md:col-span-7 space-y-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-text-dim block">Configure Badge Fields & Elements</span>
                    
                    <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 divide-y divide-line/30">
                      {getIdCardFields(activeComp).map((field, idx, arr) => {
                        const handleMoveField = (index: number, direction: 'up' | 'down') => {
                          const fieldsList = getIdCardFields(activeComp);
                          const newFields = [...fieldsList];
                          const targetIndex = direction === 'up' ? index - 1 : index + 1;
                          if (targetIndex < 0 || targetIndex >= newFields.length) return;
                          
                          // Swap order values
                          const tempOrder = newFields[index].order;
                          newFields[index].order = newFields[targetIndex].order;
                          newFields[targetIndex].order = tempOrder;
                          
                          // Resort and save
                          newFields.sort((a, b) => a.order - b.order);
                          newFields.forEach((f, i) => { f.order = i; });
                          
                          handleUpdateIdCardFields(newFields);
                          triggerMsg('Field layout order re-arranged.', 'ok');
                        };

                        const handleToggleFieldVisibility = (fieldId: string) => {
                          const fieldsList = getIdCardFields(activeComp);
                          const newFields = fieldsList.map(f => f.id === fieldId ? { ...f, visible: !f.visible } : f);
                          handleUpdateIdCardFields(newFields);
                          const targetField = fieldsList.find(f => f.id === fieldId);
                          if (targetField) {
                            triggerMsg(targetField.visible ? `Removed "${targetField.name}" from ID card.` : `Added "${targetField.name}" to ID card.`, 'ok');
                          }
                        };

                        const handleChangeFieldFontSize = (fieldId: string, size: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl') => {
                          const fieldsList = getIdCardFields(activeComp);
                          const newFields = fieldsList.map(f => f.id === fieldId ? { ...f, fontSize: size } : f);
                          handleUpdateIdCardFields(newFields);
                          triggerMsg('Font size updated.', 'ok');
                        };

                        const handleChangeFieldAlign = (fieldId: string, align: 'left' | 'center' | 'right') => {
                          const fieldsList = getIdCardFields(activeComp);
                          const newFields = fieldsList.map(f => f.id === fieldId ? { ...f, align } : f);
                          handleUpdateIdCardFields(newFields);
                          triggerMsg('Field alignment updated.', 'ok');
                        };

                        const handleChangeFieldColor = (fieldId: string, colorHex: string) => {
                          const fieldsList = getIdCardFields(activeComp);
                          const newFields = fieldsList.map(f => f.id === fieldId ? { ...f, color: colorHex } : f);
                          handleUpdateIdCardFields(newFields);
                          triggerMsg('Font color updated.', 'ok');
                        };

                        return (
                          <div 
                            key={field.id} 
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', field.id);
                              e.dataTransfer.effectAllowed = 'move';
                              e.currentTarget.classList.add('opacity-40');
                            }}
                            onDragEnd={(e) => {
                              e.currentTarget.classList.remove('opacity-40');
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.currentTarget.classList.add('ring-2', 'ring-dashed', 'ring-gold/40', 'bg-gold/5', 'rounded-xl', 'p-2');
                            }}
                            onDragLeave={(e) => {
                              e.currentTarget.classList.remove('ring-2', 'ring-dashed', 'ring-gold/40', 'bg-gold/5', 'rounded-xl', 'p-2');
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.currentTarget.classList.remove('ring-2', 'ring-dashed', 'ring-gold/40', 'bg-gold/5', 'rounded-xl', 'p-2');
                              const draggedId = e.dataTransfer.getData('text/plain');
                              if (draggedId && draggedId !== field.id) {
                                handleSwapFields(draggedId, field.id);
                              }
                            }}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 first:pt-0 border border-transparent p-1 hover:bg-white/5 rounded-xl cursor-grab active:cursor-grabbing transition-all duration-150"
                          >
                            <div className="flex items-center space-x-3">
                              <GripVertical className="w-3.5 h-3.5 text-text-dim/40 cursor-grab shrink-0" />
                              <span className="text-xs font-mono font-bold text-gold/60">#{idx + 1}</span>
                              <div>
                                <span className="text-xs font-bold text-text uppercase tracking-wide block">{field.name}</span>
                                <span className={`text-[10px] uppercase font-bold tracking-widest ${field.visible ? 'text-good' : 'text-bad'}`}>
                                  {field.visible ? 'â— Active / Visible' : 'â—‹ Deleted / Hidden'}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-auto">
                              {/* Reorder Up/Down */}
                              <div className="flex items-center border border-line rounded-lg overflow-hidden bg-ink">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => handleMoveField(idx, 'up')}
                                  className="p-1.5 hover:bg-surface-2 transition text-gold disabled:opacity-30 disabled:pointer-events-none text-xs"
                                  title="Move Up"
                                >
                                  â–²
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === arr.length - 1}
                                  onClick={() => handleMoveField(idx, 'down')}
                                  className="p-1.5 hover:bg-surface-2 transition text-gold disabled:opacity-30 disabled:pointer-events-none text-xs"
                                  title="Move Down"
                                >
                                  â–¼
                                </button>
                              </div>

                              {/* Alignment Selector */}
                              {['header', 'photo', 'name', 'club', 'athleteId', 'metadata', 'qrcode'].includes(field.id) && (
                                <select
                                  value={field.align || (field.id === 'qrcode' ? 'left' : 'center')}
                                  onChange={(e) => handleChangeFieldAlign(field.id, e.target.value as any)}
                                  className="bg-ink border border-line rounded-lg text-[10px] py-1 px-1.5 text-text focus:outline-none focus:border-gold"
                                  title="Align Element"
                                >
                                  <option value="left">Left Align</option>
                                  <option value="center">Center Align</option>
                                  <option value="right">Right Align</option>
                                </select>
                              )}

                              {/* Font Size & Color Selectors (for text elements) */}
                              {['header', 'name', 'club', 'athleteId', 'metadata', 'qrcode'].includes(field.id) && (
                                <div className="flex items-center gap-2">
                                  <select
                                    value={field.fontSize}
                                    onChange={(e) => handleChangeFieldFontSize(field.id, e.target.value as any)}
                                    className="bg-ink border border-line rounded-lg text-[10px] py-1 px-1.5 text-text focus:outline-none focus:border-gold"
                                    title="Change Font Size"
                                  >
                                    <option value="xs">Size: XS</option>
                                    <option value="sm">Size: SM</option>
                                    <option value="base">Size: MD</option>
                                    <option value="lg">Size: LG</option>
                                    <option value="xl">Size: XL</option>
                                    <option value="2xl">Size: 2X</option>
                                    <option value="3xl">Size: 3X</option>
                                  </select>

                                  <div className="relative flex items-center bg-ink border border-line rounded-lg px-2 py-1 gap-1.5" title="Font Color">
                                    <input
                                      type="color"
                                      value={field.color || (field.id === 'header' || field.id === 'name' || field.id === 'metadata' ? '#ffffff' : field.id === 'club' ? '#a0aec0' : '#D4AF37')}
                                      onChange={(e) => handleChangeFieldColor(field.id, e.target.value)}
                                      className="w-4 h-4 rounded-full border border-line/40 cursor-pointer overflow-hidden p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none shrink-0"
                                    />
                                    <span className="text-[9px] font-mono text-text-dim uppercase leading-none">{field.color || (field.id === 'header' || field.id === 'name' || field.id === 'metadata' ? '#ffffff' : field.id === 'club' ? '#a0aec0' : '#D4AF37')}</span>
                                  </div>
                                </div>
                              )}

                              {/* Toggle visibility / add-delete button */}
                              <button
                                type="button"
                                onClick={() => handleToggleFieldVisibility(field.id)}
                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase transition border ${
                                  field.visible 
                                    ? 'text-bad bg-bad/10 border-bad/30 hover:bg-bad/20' 
                                    : 'text-good bg-good/10 border-good/30 hover:bg-good/20'
                                  }`}
                              >
                                {field.visible ? 'Delete' : 'Add'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              </div>

            </div>

            {/* CATEGORIES MANAGEMENT STAGE */}
            <div className="bg-surface rounded-2xl border border-line p-5 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-text">Division category definitions</h3>
              <p className="text-xs text-text-dim">Configure age brackets and official weight division limits. Registered coaches will select from these custom dropdown variables.</p>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                
                {/* AGE GROUPS */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest">Age brackets</label>
                    <label className="cursor-pointer text-[10px] bg-ink border border-line hover:border-gold text-gold px-2 py-1 rounded transition flex items-center gap-1">
                      <Upload className="w-3 h-3" />
                      <span>Upload CSV/Excel</span>
                      <input 
                        type="file" 
                        accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                        className="hidden"
                        onChange={(e) => handleUploadCategories(e, 'ageGroups')}
                      />
                    </label>
                  </div>
                  <div className="flex space-x-2">
                    <input 
                      type="text" 
                      value={newAgeGroup}
                      onChange={(e) => setNewAgeGroup(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddCat('ageGroups', newAgeGroup, setNewAgeGroup); }}
                      placeholder="e.g. Cadet (12 to 14 Years Old)" 
                      className="flex-1 bg-ink border border-line text-xs rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
                    />
                    <button 
                      onClick={() => handleAddCat('ageGroups', newAgeGroup, setNewAgeGroup)}
                      className="bg-surface-2 hover:bg-line text-text border border-line px-3 py-2 rounded-xl text-xs font-bold"
                    >
                      Add Bracket
                    </button>
                  </div>
                  
                  <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-2 bg-ink rounded-xl border border-line">
                    {activeComp.ageGroups.length === 0 ? (
                      <span className="text-[10px] text-text-dim/60 italic p-1">No custom brackets defined.</span>
                    ) : (
                      activeComp.ageGroups.map((ag, i) => (
                        <span key={i} className="inline-flex items-center text-[10px] bg-surface border border-line px-2 py-1 rounded text-text font-medium">
                          <span>{ag}</span>
                          <button 
                            onClick={() => handleRemoveCat('ageGroups', i)}
                            className="ml-1.5 text-red-500 hover:text-red-400 text-xs font-bold"
                          >
                            Ã—
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* WEIGHT CLASSES */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest">Weight Class Divisions</label>
                    <label className="cursor-pointer text-[10px] bg-ink border border-line hover:border-gold text-gold px-2 py-1 rounded transition flex items-center gap-1">
                      <Upload className="w-3 h-3" />
                      <span>Upload CSV/Excel</span>
                      <input 
                        type="file" 
                        accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                        className="hidden"
                        onChange={(e) => handleUploadCategories(e, 'weightClasses')}
                      />
                    </label>
                  </div>
                  <div className="flex space-x-2">
                    <input 
                      type="text" 
                      value={newWc}
                      onChange={(e) => setNewWc(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddCat('weightClasses', newWc, setNewWc); }}
                      placeholder="e.g. FEATHER 41.01KG-45KG" 
                      className="flex-1 bg-ink border border-line text-xs rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold"
                    />
                    <button 
                      onClick={() => handleAddCat('weightClasses', newWc, setNewWc)}
                      className="bg-surface-2 hover:bg-line text-text border border-line px-3 py-2 rounded-xl text-xs font-bold"
                    >
                      Add Division
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-2 bg-ink rounded-xl border border-line">
                    {activeComp.weightClasses.length === 0 ? (
                      <span className="text-[10px] text-text-dim/60 italic p-1">No custom weight divisions defined.</span>
                    ) : (
                      activeComp.weightClasses.map((wc, i) => (
                        <span key={i} className="inline-flex items-center text-[10px] bg-surface border border-line px-2 py-1 rounded text-text font-medium">
                          <span>{wc}</span>
                          <button 
                            onClick={() => handleRemoveCat('weightClasses', i)}
                            className="ml-1.5 text-red-500 hover:text-red-400 text-xs font-bold"
                          >
                            Ã—
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>



              </div>
            </div>

            {/* DYNAMIC REGISTERED ATHLETES */}
            <div className="bg-surface rounded-2xl border border-line shadow-sm overflow-hidden">
              <div className="p-4 border-b border-line bg-ink/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-text">All registered entrants ({players.length})</h3>
                {players.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                    <button 
                      onClick={downloadWeighInExcel}
                      className="bg-surface-2 border border-line hover:bg-line text-text font-bold px-3.5 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Total Summary (Excel)</span>
                    </button>
                    <button 
                      onClick={() => setShowPrintAllCardsModal(true)}
                      className="bg-gold hover:opacity-90 text-ink font-bold px-3.5 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Print & Download ID Cards</span>
                    </button>
                  </div>
                )}
              </div>

              {players.length === 0 ? (
                <div className="p-12 text-center text-text-dim space-y-2">
                  <Users className="w-10 h-10 text-text-dim/30 mx-auto" />
                  <p className="text-sm font-semibold">No entrants registered in this tournament.</p>
                  <p className="text-xs text-text-dim">Once coaches register entrants or demo lists are seeded, details will load in this table.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-line bg-ink/50 text-text-dim font-semibold">
                        <th className="p-4">ID Code</th>
                        <th className="p-4">Name</th>
                        <th className="p-4">Club Represented</th>
                        <th className="p-4">Division Category</th>
                        <th className="p-4">Weight Division</th>
                        <th className="p-4">Weigh-In Scale status</th>
                        <th className="p-4">Indemnity</th>
                        {showSignatures && <th className="p-4 text-center">Signature</th>}
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/30">
                      {players.map(p => (
                        <tr key={p.id} className="hover:bg-surface-2/30 transition">
                          <td className="p-4">
                            <button
                              onClick={() => { setSelectedPlayerId(p.id); setScreen('idCard'); }}
                              className="font-mono text-gold font-bold hover:underline"
                            >
                              {p.id}
                            </button>
                          </td>
                          <td className="p-4 font-bold text-text">
                            <div>{p.name}</div>
                            {(p.schoolName || p.race) && (
                              <div className="text-[10px] text-gold/80 font-mono mt-0.5 font-normal">
                                {p.schoolName && `School: ${p.schoolName} ${p.schoolCode ? `(${p.schoolCode})` : ''}`}
                                {p.schoolName && p.race && ' Â· '}
                                {p.race && `Race: ${p.race}`}
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-text">{p.club}</td>
                          <td className="p-4 text-text-dim">{p.ageGroup} Â· {p.gender}</td>
                          <td className="p-4 text-text-dim">{p.weightClass}</td>
                          <td className="p-4">
                            <div className="flex flex-col gap-1 items-start">
                              {renderBadge(p.weighIn?.result)}
                              {p.weighIn && <span className="text-[10px] text-text-dim">Scale Readout: {p.weighIn.weight}kg</span>}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono ${
                                p.indemnityStatus === 'Completed'
                                  ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-amber-950/50 text-amber-400 border border-amber-500/20'
                              }`}>
                                {p.indemnityStatus === 'Completed' ? 'Completed' : 'Pending'}
                              </span>
                              {p.indemnityStatus === 'Completed' && (
                                <button
                                  onClick={() => { setSelectedIndemnityPlayer(p); setShowViewIndemnityModal(true); }}
                                  className="text-gold hover:underline text-[10px] font-semibold flex items-center gap-0.5 shrink-0 cursor-pointer"
                                  title="View completed parental indemnity form"
                                >
                                  <Eye className="w-3.5 h-3.5 text-gold" />
                                </button>
                              )}
                            </div>
                          </td>
                          {showSignatures && (
                          <td className="p-4 text-center">
                            {p.weighIn?.signature ? (
                              <img src={p.weighIn.signature} alt="Signature" className="h-8 inline-block bg-white rounded px-1 object-contain border border-line" />
                            ) : (
                              <span className="text-[10px] text-text-dim/50 italic">No signature</span>
                            )}
                          </td>
                        )}
                          <td className="p-4 text-right whitespace-nowrap">
                            {confirmDeleteId === p.id ? (
                              <div className="flex items-center justify-end gap-1">
                                <button 
                                  onClick={() => handleDeletePlayer(p.id)}
                                  className="bg-red-600 hover:bg-red-700 text-white font-bold px-2 py-1 rounded text-[10px]"
                                >
                                  Confirm
                                </button>
                                <button 
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="bg-surface-2 hover:bg-line text-text px-2 py-1 rounded text-[10px]"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => { setSelectedPlayerId(p.id); setScreen('idCard'); }}
                                  className="text-gold hover:bg-gold/10 p-1.5 rounded transition mr-2"
                                  title="View ID Card"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleOpenCoachPlayerForm(p.id)}
                                  className="text-chong hover:bg-chong/10 p-1.5 rounded transition mr-2"
                                  title="Edit Athlete"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(p.id)}
                                  className="text-hong hover:bg-hong/10 p-1.5 rounded transition"
                                  title="Delete Athlete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}
        {/* ORGANIZER DASHBOARD */}
        {screen === 'organizerDashboard' && activeComp && (
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center bg-surface p-4 rounded-2xl border border-line shadow-sm">
              <div>
                <h2 className="text-xl font-bold uppercase tracking-wider text-text flex items-center gap-2">
                  <User className="w-5 h-5 text-gold" />
                  Organizer Panel
                </h2>
                <p className="text-sm font-semibold text-gold mt-1">{activeComp.name}</p>
              </div>
              <button
                onClick={() => handleOpenCoachPlayerForm()}
                className="bg-gold text-ink px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:opacity-90 transition"
              >
                <Plus className="w-4 h-4" />
                Register Competitor
              </button>
            </div>

            {/* SUB NAV FOR ORGANIZER */}
            <div className="flex border-b border-line gap-2 pb-px">
              <button
                onClick={() => setOrganizerTab('dashboard')}
                className={`px-5 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 -mb-px flex items-center gap-2 ${
                  organizerTab === 'dashboard'
                    ? 'border-gold text-gold bg-gold/5 font-bold'
                    : 'border-transparent text-text-dim hover:text-text'
                }`}
              >
                <Sliders className="w-4 h-4" />
                Tournament Setup & Competitors
              </button>
              <button
                onClick={() => setOrganizerTab('idCard')}
                className={`px-5 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 -mb-px flex items-center gap-2 ${
                  organizerTab === 'idCard'
                    ? 'border-gold text-gold bg-gold/5 font-bold'
                    : 'border-transparent text-text-dim hover:text-text'
                }`}
              >
                <Palette className="w-4 h-4" />
                ID Card Design Studio
              </button>
              <button
                onClick={() => setOrganizerTab('staffPasses')}
                className={`px-5 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 -mb-px flex items-center gap-2 ${
                  organizerTab === 'staffPasses'
                    ? 'border-gold text-gold bg-gold/5 font-bold'
                    : 'border-transparent text-text-dim hover:text-text'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                Staff Passes
              </button>
              <button
                onClick={() => setOrganizerTab('referees')}
                className={`px-5 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 -mb-px flex items-center gap-2 ${
                  organizerTab === 'referees'
                    ? 'border-gold text-gold bg-gold/5 font-bold'
                    : 'border-transparent text-text-dim hover:text-text'
                }`}
              >
                <Scale className="w-4 h-4" />
                Referees & Allowance
              </button>
            </div>

            {organizerTab === 'dashboard' && (
              <div className="flex flex-col lg:flex-row gap-6 items-start">
                <div className="flex-1 space-y-6 w-full">

                {/* BANKING & PAYMENT SETUP */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-surface p-6 rounded-2xl border border-line shadow-sm">
                  {/* Box 1: Bank Details */}
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xs font-bold text-gold uppercase tracking-wider flex items-center gap-2 mb-2">
                        <Lock className="w-4 h-4 text-gold" />
                        1. Bank Details Setup
                      </h3>
                      <p className="text-[10px] text-text-dim uppercase tracking-wider mb-3">Provide bank credentials for coach registrations</p>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-1">Row 1: Bank Name</label>
                        <input 
                          type="text"
                          value={bankNameInput}
                          onChange={(e) => setBankNameInput(e.target.value)}
                          placeholder="e.g. Maybank, CIMB, Bank Islam"
                          className="w-full bg-ink/50 border border-line rounded-xl px-3 py-2 text-xs text-text placeholder-text-dim focus:outline-none focus:border-gold font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-1">Row 2: Bank Account Number</label>
                        <input 
                          type="text"
                          value={bankAccountInput}
                          onChange={(e) => setBankAccountInput(e.target.value)}
                          placeholder="e.g. 1234567890"
                          className="w-full bg-ink/50 border border-line rounded-xl px-3 py-2 text-xs text-text placeholder-text-dim focus:outline-none focus:border-gold font-medium"
                        />
                      </div>
                      <button
                        onClick={() => handleUpdateBankDetails(bankNameInput, bankAccountInput)}
                        className="w-full bg-gold/10 hover:bg-gold text-gold hover:text-ink border border-gold/30 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Save Bank Details
                      </button>
                    </div>
                  </div>

                  {/* Box 2: QR Code Upload */}
                  <div className="flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-gold uppercase tracking-wider flex items-center gap-2 mb-2">
                        <QrCode className="w-4 h-4 text-gold" />
                        2. Payment QR Code
                      </h3>
                      <p className="text-[10px] text-text-dim uppercase tracking-wider mb-3">Upload tournament payment QR (DuitNow, etc.)</p>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center bg-ink/25 p-4 rounded-xl border border-line/50">
                      {/* Thumbnail / QR preview */}
                      <div className="flex flex-col items-center justify-center border border-dashed border-line/40 rounded-lg p-2 bg-ink/10 h-32">
                        {activeComp.bankQrCode ? (
                          <div className="relative group w-24 h-24">
                            <img 
                              src={activeComp.bankQrCode} 
                              alt="Bank QR" 
                              className="w-full h-full object-contain rounded"
                              referrerPolicy="no-referrer"
                            />
                            <button
                              onClick={() => {
                                const updated = competitions.map(c => {
                                  if (c.id === compId) {
                                    return { ...c, bankQrCode: '' };
                                  }
                                  return c;
                                });
                                saveCompsToStorage(updated);
                                triggerMsg('QR code deleted.', 'ok');
                              }}
                              className="absolute -top-1.5 -right-1.5 bg-red-500/90 text-white p-1 rounded-full hover:bg-red-600 transition"
                              title="Remove QR"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="text-center p-2">
                            <QrCode className="w-8 h-8 text-text-dim/50 mx-auto mb-1" />
                            <span className="text-[10px] text-text-dim">No QR Uploaded</span>
                          </div>
                        )}
                      </div>

                      {/* Upload action */}
                      <div className="space-y-2">
                        <label className="flex flex-col items-center justify-center border border-dashed border-line/40 hover:border-gold/50 rounded-lg p-3 cursor-pointer bg-ink/20 hover:bg-ink/30 transition text-center h-24">
                          <Upload className="w-5 h-5 text-gold mb-1" />
                          <span className="text-[10px] font-bold text-text-dim uppercase">Upload QR</span>
                          <span className="text-[8px] text-text-dim">PNG/JPG up to 2MB</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (file.size > 2 * 1024 * 1024) {
                                triggerMsg('Image must be less than 2MB', 'error');
                                return;
                              }
                              const reader = new FileReader();
                              reader.onload = (evt) => {
                                const base64 = evt.target?.result as string;
                                handleUpdateBankDetails(bankNameInput, bankAccountInput, base64);
                              };
                              reader.readAsDataURL(file);
                            }}
                            className="hidden" 
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* PARTICIPANT FEES SETUP */}
                <div className="bg-surface p-6 rounded-2xl border border-line shadow-sm space-y-4">
                  <div>
                    <h3 className="text-xs font-bold text-gold uppercase tracking-wider flex items-center gap-2 mb-2">
                      <Coins className="w-4 h-4 text-gold" />
                      Participant Event Fees Setup
                    </h3>
                    <p className="text-[10px] text-text-dim uppercase tracking-wider">Configure registration fees for each event type (visible to coaches)</p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-1">Kyorugi Fee</label>
                      <input 
                        type="text"
                        value={kyorugiFeeInput}
                        onChange={(e) => setKyorugiFeeInput(e.target.value)}
                        placeholder="e.g. RM 120"
                        className="w-full bg-ink/50 border border-line rounded-xl px-3 py-2 text-xs text-text placeholder-text-dim focus:outline-none focus:border-gold font-medium font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-1">Poomsae Fee</label>
                      <input 
                        type="text"
                        value={poomsaeFeeInput}
                        onChange={(e) => setPoomsaeFeeInput(e.target.value)}
                        placeholder="e.g. RM 100"
                        className="w-full bg-ink/50 border border-line rounded-xl px-3 py-2 text-xs text-text placeholder-text-dim focus:outline-none focus:border-gold font-medium font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-1">Para Fee</label>
                      <input 
                        type="text"
                        value={paraFeeInput}
                        onChange={(e) => setParaFeeInput(e.target.value)}
                        placeholder="e.g. RM 80"
                        className="w-full bg-ink/50 border border-line rounded-xl px-3 py-2 text-xs text-text placeholder-text-dim focus:outline-none focus:border-gold font-medium font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-1">Virtual Fee</label>
                      <input 
                        type="text"
                        value={virtualFeeInput}
                        onChange={(e) => setVirtualFeeInput(e.target.value)}
                        placeholder="e.g. RM 50"
                        className="w-full bg-ink/50 border border-line rounded-xl px-3 py-2 text-xs text-text placeholder-text-dim focus:outline-none focus:border-gold font-medium font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end items-center gap-3 pt-2">
                    {feeUpdateSuccess && (
                      <span className="text-emerald-500 text-xs font-bold animate-fade-in flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Setup Successful
                      </span>
                    )}
                    <button
                      onClick={() => handleUpdateEventFees(kyorugiFeeInput, poomsaeFeeInput, paraFeeInput, virtualFeeInput)}
                      className="bg-gold hover:opacity-90 text-ink px-5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer animate-fade-in"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Save Participant Fees
                    </button>
                  </div>
                </div>

                {/* Summary Box */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-surface p-4 rounded-2xl border border-line shadow-sm flex flex-col justify-between">
                <p className="text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Total Athletes</p>
                <p className="text-3xl font-bold text-text font-mono">{players.length}</p>
              </div>
              <div className="bg-surface p-4 rounded-2xl border border-line shadow-sm flex flex-col justify-between">
                <p className="text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Total Clubs</p>
                <p className="text-3xl font-bold text-text font-mono">{new Set(players.map(p => p.club.toUpperCase())).size}</p>
              </div>
              <div className="bg-surface p-4 rounded-2xl border border-line shadow-sm flex flex-col justify-between">
                <p className="text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Weighed In</p>
                <p className="text-3xl font-bold text-chong font-mono">{players.filter(p => p.weighIn).length}</p>
              </div>
              <div className="bg-surface p-4 rounded-2xl border border-line shadow-sm flex flex-col justify-between">
                <p className="text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Pending Weigh-in</p>
                <p className="text-3xl font-bold text-gold font-mono">{players.filter(p => !p.weighIn).length}</p>
              </div>
            </div>

            <div className="bg-surface p-0 rounded-2xl border border-line shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-surface-2 border-b border-line">
                      <th className="p-4 py-3">
                        <span className="bg-gold text-ink px-2 py-1 font-bold uppercase tracking-wider text-xs">
                          Athletes by Club
                        </span>
                      </th>
                      <th className="p-4 py-3 font-semibold text-text text-center w-24">Kyorugi</th>
                      <th className="p-4 py-3 font-semibold text-text text-center w-24">Poomsae</th>
                      <th className="p-4 py-3 font-semibold text-text text-center w-24">Para</th>
                      <th className="p-4 py-3 font-semibold text-text text-center w-24">Virtual</th>
                      <th className="p-4 py-3 font-semibold text-text text-center w-24">Total</th>
                      <th className="p-4 py-3 font-semibold text-text text-center w-32">Total Amount</th>
                      <th className="p-4 py-3 font-semibold text-text text-center w-36">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/50">
                    {(() => {
                      const stats = players.reduce((acc, p) => {
                        const c = p.club.toUpperCase();
                        if (!acc[c]) {
                          acc[c] = { kyorugi: 0, poomsae: 0, para: 0, virtual: 0, total: 0 };
                        }
                        acc[c].total += 1;
                        const ev = (p.event || '').toLowerCase();
                        if (ev.includes('kyorugi')) acc[c].kyorugi += 1;
                        else if (ev.includes('poomsae')) acc[c].poomsae += 1;
                        else if (ev.includes('para')) acc[c].para += 1;
                        else if (ev.includes('virtual')) acc[c].virtual += 1;
                        return acc;
                      }, {} as Record<string, { kyorugi: number; poomsae: number; para: number; virtual: number; total: number }>);
                      
                      const entries = (Object.entries(stats) as [string, any][]).sort((a, b) => b[1].total - a[1].total);
                      
                      if (entries.length === 0) {
                        return (
                          <tr>
                            <td colSpan={8} className="p-4 text-center text-text-dim text-xs">No athletes yet.</td>
                          </tr>
                        );
                      }
                      
                      return entries.map(([club, counts]: [string, any]) => {
                        const receipt = activeComp?.receipts?.[club];
                        
                        const kPrice = parseFeeToNumber(activeComp?.kyorugiFee);
                        const pPrice = parseFeeToNumber(activeComp?.poomsaeFee);
                        const paPrice = parseFeeToNumber(activeComp?.paraFee);
                        const vPrice = parseFeeToNumber(activeComp?.virtualFee);

                        const clubKTotal = counts.kyorugi * kPrice;
                        const clubPTotal = counts.poomsae * pPrice;
                        const clubPaTotal = counts.para * paPrice;
                        const clubVTotal = counts.virtual * vPrice;

                        const clubTotalAmount = clubKTotal + clubPTotal + clubPaTotal + clubVTotal;
                        const sampleFee = activeComp?.kyorugiFee || activeComp?.poomsaeFee || activeComp?.paraFee || activeComp?.virtualFee;
                        const totalAmountFormatted = formatCurrency(clubTotalAmount, sampleFee);

                        return (
                          <tr key={club} className="hover:bg-surface-2/50 transition">
                            <td className="p-4 text-text-dim font-medium">{club}</td>
                            <td className="p-4 text-center font-mono text-text">{counts.kyorugi > 0 ? counts.kyorugi : '-'}</td>
                            <td className="p-4 text-center font-mono text-text">{counts.poomsae > 0 ? counts.poomsae : '-'}</td>
                            <td className="p-4 text-center font-mono text-text">{counts.para > 0 ? counts.para : '-'}</td>
                            <td className="p-4 text-center font-mono text-text">{counts.virtual > 0 ? counts.virtual : '-'}</td>
                            <td className="p-4 text-center font-mono font-bold text-text">{counts.total}</td>
                            <td className="p-4 text-center font-mono font-bold text-gold">{totalAmountFormatted}</td>
                            <td className="p-4 text-center">
                              {receipt ? (
                                <button
                                  onClick={() => setSelectedClubReceipt({ clubName: club, receiptUrl: receipt.receiptUrl, uploadedAt: receipt.uploadedAt })}
                                  className="bg-emerald-950 text-emerald-300 hover:bg-emerald-900 border border-emerald-800/60 px-2.5 py-1 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 mx-auto cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>View Receipt</span>
                                </button>
                              ) : (
                                <span className="bg-red-950 text-red-400 border border-red-900/40 px-2.5 py-1 rounded-lg text-[10px] font-medium inline-block select-none">
                                  Pending Receipt
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-surface rounded-2xl border border-line p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-line/50">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-text">All Registered Entrants ({players.length})</h3>
                  <p className="text-[10px] text-text-dim">Search, edit, or manage weigh-ins for all registered athletes.</p>
                </div>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                  {/* Search Bar */}
                  <div className="relative w-full sm:w-64">
                    <input 
                      type="text" 
                      placeholder="Search name, ID, or club..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-ink border border-line text-xs rounded-xl py-2 px-3 text-text pl-9 focus:outline-none focus:border-gold transition"
                    />
                    <Search className="w-3.5 h-3.5 text-text-dim/60 absolute left-3 top-2.5" />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery('')}
                        className="text-text-dim hover:text-text absolute right-3 top-2 text-xs font-bold"
                      >
                        Ã—
                      </button>
                    )}
                  </div>
                  
                  {players.length > 0 && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowSignatures(!showSignatures)}
                        className={`border font-bold px-3 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition cursor-pointer ${showSignatures ? 'bg-gold text-ink border-gold' : 'bg-surface-2 text-text border-line hover:bg-line'}`}
                        title="Toggle Player Signatures"
                      >
                        <PenTool className="w-4 h-4" />
                        <span className="hidden sm:inline">{showSignatures ? 'Hide Signatures' : 'Show Signatures'}</span>
                      </button>
                      <button 
                        onClick={downloadWeighInExcel}
                        className="bg-surface-2 border border-line hover:bg-line text-text font-bold px-3 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition cursor-pointer"
                        title="Download Total Summary (Excel)"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setShowPrintAllCardsModal(true)}
                        className="bg-gold hover:opacity-90 text-ink font-bold px-3 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition cursor-pointer whitespace-nowrap"
                      >
                        <Printer className="w-4 h-4" />
                        <span>Print All</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {coachFilteredPlayers.length === 0 ? (
                <div className="text-center py-12 text-text-dim border border-line border-dashed rounded-xl">
                  {players.length === 0 ? "No competitors registered for this tournament yet." : "No competitors matched your search query."}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-line">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-line bg-surface-2">
                        <th className="p-4">ID</th>
                        <th className="p-4">Athlete Name</th>
                        <th className="p-4">Club/Team</th>
                        <th className="p-4">Division Category</th>
                        <th className="p-4">Weight Division</th>
                        <th className="p-4">Weigh-In Scale status</th>
                        <th className="p-4">Indemnity</th>
                        {showSignatures && <th className="p-4 text-center">Signature</th>}
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/30">
                      {coachFilteredPlayers.map(p => (
                        <tr key={p.id} className="hover:bg-surface-2/30 transition">
                          <td className="p-4">
                            <button
                              onClick={() => { setSelectedPlayerId(p.id); setScreen('idCard'); }}
                              className="font-mono text-gold font-bold hover:underline"
                            >
                              {p.id}
                            </button>
                          </td>
                          <td className="p-4 font-bold text-text">
                            <div>{p.name}</div>
                            {(p.schoolName || p.race) && (
                              <div className="text-[10px] text-gold/80 font-mono mt-0.5 font-normal">
                                {p.schoolName && `School: ${p.schoolName} ${p.schoolCode ? `(${p.schoolCode})` : ''}`}
                                {p.schoolName && p.race && ' Â· '}
                                {p.race && `Race: ${p.race}`}
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-text">{p.club}</td>
                          <td className="p-4 text-text-dim">{p.ageGroup} Â· {p.gender}</td>
                          <td className="p-4 text-text-dim">{p.weightClass}</td>
                          <td className="p-4">
                            <div className="flex flex-col gap-1 items-start">
                              {renderBadge(p.weighIn?.result)}
                              {p.weighIn && <span className="text-[10px] text-text-dim">Scale Readout: {p.weighIn.weight}kg</span>}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono ${
                                p.indemnityStatus === 'Completed'
                                  ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-amber-950/50 text-amber-400 border border-amber-500/20'
                              }`}>
                                {p.indemnityStatus === 'Completed' ? 'Completed' : 'Pending'}
                              </span>
                              {p.indemnityStatus === 'Completed' && (
                                <button
                                  onClick={() => { setSelectedIndemnityPlayer(p); setShowViewIndemnityModal(true); }}
                                  className="text-gold hover:underline text-[10px] font-semibold flex items-center gap-0.5 shrink-0 cursor-pointer"
                                  title="View completed parental indemnity form"
                                >
                                  <Eye className="w-3.5 h-3.5 text-gold" />
                                </button>
                              )}
                            </div>
                          </td>
                          {showSignatures && (
                          <td className="p-4 text-center">
                            {p.weighIn?.signature ? (
                              <img src={p.weighIn.signature} alt="Signature" className="h-8 inline-block bg-white rounded px-1 object-contain border border-line" />
                            ) : (
                              <span className="text-[10px] text-text-dim/50 italic">No signature</span>
                            )}
                          </td>
                        )}
                          <td className="p-4 text-right whitespace-nowrap">
                            {confirmDeleteId === p.id ? (
                              <div className="flex items-center justify-end gap-1">
                                <button 
                                  onClick={() => handleDeletePlayer(p.id)}
                                  className="bg-red-600 hover:bg-red-700 text-white font-bold px-2 py-1 rounded text-[10px]"
                                >
                                  Confirm
                                </button>
                                <button 
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="bg-surface-2 hover:bg-line text-text px-2 py-1 rounded text-[10px]"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => { setSelectedPlayerId(p.id); setScreen('idCard'); }}
                                  className="text-gold hover:bg-gold/10 p-1.5 rounded transition mr-2"
                                  title="View ID Card"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleOpenCoachPlayerForm(p.id)}
                                  className="text-chong hover:bg-chong/10 p-1.5 rounded transition mr-2"
                                  title="Edit Athlete"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(p.id)}
                                  className="text-hong hover:bg-hong/10 p-1.5 rounded transition"
                                  title="Delete Athlete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
        )}
        
        {organizerTab === 'idCard' && (
          /* ID CARD DESIGN STUDIO - DEDICATED PAGE */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start w-full animate-fade-in">
            {/* Left Column: Configs & Upload */}
            <div className="lg:col-span-5 bg-surface rounded-2xl border border-line p-6 space-y-6 shadow-sm">
              <div className="border-b border-line/50 pb-3 flex justify-between items-center">
                <h3 className="text-sm font-bold uppercase tracking-wider text-text flex items-center gap-2">
                  <Palette className="w-4 h-4 text-gold" />
                  ID Card Design & Layout
                </h3>
                {activeComp.idCardBgUrl && (
                  <button
                    onClick={() => handleUpdateIdCardBgUrl(null)}
                    className="text-[10px] font-bold text-red-400 hover:underline animate-fade-in"
                  >
                    Reset BG
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {/* Upload BG Control */}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-dim block mb-2">Badge Background Image</span>
                  <label className="cursor-pointer bg-gold/10 text-gold border border-gold/30 hover:bg-gold/15 rounded-xl p-3 text-center transition flex items-center justify-center gap-2 w-full font-bold shadow text-xs">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{activeComp.idCardBgUrl ? 'Replace Background' : 'Upload Background'}</span>
                    <input 
                      type="file" 
                      accept="image/png, image/jpeg"
                      className="hidden"
                      onChange={handleUploadIdCardBg}
                    />
                  </label>
                  <p className="text-[9px] text-text-dim mt-1.5 text-center leading-normal">
                    Recommended: high-quality vertical image (aspect ratio ~1:1.4)
                  </p>
                </div>

                {/* FIELD DESIGNER STACKED LIST */}
                <div className="border-t border-line/50 pt-5 space-y-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-dim block">Badge Field Configurations</span>
                  
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 divide-y divide-line/20">
                    {getIdCardFields(activeComp).map((field, idx, arr) => {
                      const handleMoveField = (index: number, direction: 'up' | 'down') => {
                        const fieldsList = getIdCardFields(activeComp);
                        const newFields = [...fieldsList];
                        const targetIndex = direction === 'up' ? index - 1 : index + 1;
                        if (targetIndex < 0 || targetIndex >= newFields.length) return;
                        
                        // Swap order values
                        const tempOrder = newFields[index].order;
                        newFields[index].order = newFields[targetIndex].order;
                        newFields[targetIndex].order = tempOrder;
                        
                        // Resort and save
                        newFields.sort((a, b) => a.order - b.order);
                        newFields.forEach((f, i) => { f.order = i; });
                        
                        handleUpdateIdCardFields(newFields);
                        triggerMsg('Field layout order re-arranged.', 'ok');
                      };

                      const handleToggleFieldVisibility = (fieldId: string) => {
                        const fieldsList = getIdCardFields(activeComp);
                        const newFields = fieldsList.map(f => f.id === fieldId ? { ...f, visible: !f.visible } : f);
                        handleUpdateIdCardFields(newFields);
                        const targetField = fieldsList.find(f => f.id === fieldId);
                        if (targetField) {
                          triggerMsg(targetField.visible ? `Removed "${targetField.name}" from ID card.` : `Added "${targetField.name}" to ID card.`, 'ok');
                        }
                      };

                      const handleChangeFieldFontSize = (fieldId: string, size: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl') => {
                        const fieldsList = getIdCardFields(activeComp);
                        const newFields = fieldsList.map(f => f.id === fieldId ? { ...f, fontSize: size } : f);
                        handleUpdateIdCardFields(newFields);
                        triggerMsg('Font size updated.', 'ok');
                      };

                      const handleChangeFieldAlign = (fieldId: string, align: 'left' | 'center' | 'right') => {
                        const fieldsList = getIdCardFields(activeComp);
                        const newFields = fieldsList.map(f => f.id === fieldId ? { ...f, align } : f);
                        handleUpdateIdCardFields(newFields);
                        triggerMsg('Field alignment updated.', 'ok');
                      };

                      const handleChangeFieldColor = (fieldIdxœì}ÛRãÈ¶àû|E6»¦0ÝØØª«8PÕœæ¶êÞ{*z@¶„­]²ä#É€›Í'Lœ˜˜‰y=óxžçy¾f¾à|Â¬•™’RRf*eL]z£ˆîÂv*•Ê\÷ë‰âÐõË¤xAø“s»Á¿Y"›[äî?ÅÕü(&W®ãÙÑn’ïÛ;Vh¿£ß6¬~ì^;;Áh¼ôOóøÎ»	¦Éæl¬qã
×qÕrm²¹ÉÜ·ÉrGZ­Ö_÷Fº|rO6È•æCË·=çÃØ¶b'·Ütš›ag'<ŒÅw³Ç’	Ín-.“ÅàÓ¢r‚ûúOŠ_B'ž„>i(ŸüÚv¯‰òWB>9ÓÍ;º;°U÷º‘vhVÏs4cFÅVoÞ5œ
XÀËiÁXç¡åGWNØŠœx>7cç6^{–ëÃæ$ëÓì°d.çêÊéÇÛžÜ8 dq\;‹USô'aèøñ¹\¶úž1˜²l»±Œ­¾O›kmõaáu_¹I{¾m¼Eª5…¾Ò\—u|í„Æë‡Î5¬k×¹²&^Ü¨<íÞ"ñhvè_¶;ý8<{Þ>÷ø§uúc0ñmÇnzü4†	ºŽuíÌíh¾Ž·
ÆŸýL?ë$ü€Ò(	ýf‘$”¥bN÷Š4²Ÿ?¦ÿ.á)H•*ö4ág7Ö˜óŒt"cÚ¦;aíñÓ9²FÎæÂ8n®ÂóÂ(Þ€?Û$²á4§ÍNkô‚ÐvBþO3Æ][x°6Ÿá(Ã8¡›¡;+ë$; asZ=ÂX÷†ðUN™ÐéÜØü¦åyÄž„ýÐYo/(—¾¥y)ÊÕ„7»ò€ƒÿmÅîÕ´ÙsâÇñ	¬t5ûðN¸ ›M1Ÿx?ß«[ºW#×oÞ4ÛsÂ¬ïCwü‹ÆnßòÄéoà†ð‚b“þÏvG€¹½Œ†€!Ÿà1d¥òA°:_| óc§3¾ý\¼ÑìfeÁcì„}+rðhúŸo\?Mü>ˆ$ddÝÂ+~„‚)¶¸„àÃä÷¯Wðiû¹Z1¤°æ»K¶è—¸æl}ÂêÅ•®?ã‹ºv#¤í(j	ìEæØ§že/Þ_ÞWí`y®_ØŸt¦]Çs@N[Ôá¾tÕÆðm©Ø9@,BùÀ}0xÓY ´ñ—æMh«»rÎ<Iñ\ßIÈArrrYsèÚ6¼P€õÊgÂS{“8üÊq rOÇ°*6\Md²Ëv#nA(sí[ª3´õÇÍ®ÀßñÜþ'`¯”»2JïG)}æþ5/.™L&Òj 5„Ã3 ²ºDÔ[mgß7¼IwÔôØi†L¯{+\½í„ü¿ÿõªg…m÷×uŒV¶<ÇÄCÒ$¹©Üø€Sý¿s;Õjâ†×ÝÊ÷dÛsþe‹3 ¬ý4áïWªvòîãâÐ±€’PpÄþ	ÿí{“þkÅC$ÕûTÂ9±…2 þý/a?°ÅßZ®c42ñ$;µ¾^D×j°©×–7q¥ÚÂw%ÿ;IŸG2YrÏ¹Š)›atÓ¨ F.™¢Â ”}Iá”îrúÔe‡c&£Óõ+"–?­ÀŒPëH{¢d<m¶§d@Oe« ?‰6‚IŒ·1°f_ñÙ3L0=vcVD_“ìyÔ|°âu0Fñ”äžÏÂÖÛ×+ìÇæI$ÑÏºƒ!,é´îD ¡P ®	PQ?#š
2¢D”. 5
¥gîïŽ	ò˜ ê;>ß\°õkÅ×c©_×ä.“s,áÇm´°õ—³:Vš"-l>hŠè/[‡»šÄ éyÿ )n=ØƒMÑÅ9ºyÐ«8Çj­92ze2¸@BÇ³ÐA$šI%VŒ™¦Ï1"!*9ÞA¾µ¹þxbFh‘—zÌðª@˜o¡,rp‚¿ä ô»üuJ¹QHùÓ½PNÉ¢DŸŽ°Ú–ÓoSIæO»kÛïV4eðª¦‘t»•ÒøAy+œíþ?±g]M<O‚m†‹å%vÜl“Ï76š7Nï“7é)4£+î©F=vÂß6t£~K(*¥±©ùÇèÅ*MDìRŠ^¦v¢Qày³”`‹ñ €Ð ƒëKmB_´™Ø¦øNT[¨Œ‡U Ÿ‰bd¦×Q†¥Jìy0xŸ¨}Ëõ@ëÌ„°*$­u@!»	}”È™Ý.gkäfàÅžUYÎ	ÉæNöMfùCBÿ¬$æmú¡ÛÎÌÙø¹@d0í†`^$ÔWÓOâÌô˜ºbæûKýž×·[î:EŠm»Ú^Y­ØWÀ¿ög…Gã^
fŠ™ä¸#,ˆ¶†ST•WOFþ9	‘;‘ŸàÛæ;×vþÉ2r€²¸v›’=¢(\xƒ |M¤6Í¢IxeõS¢	“L¾7_2y„Za
¹q7çt˜6_ 7°là5ÑˆÀ€þ§)‰ƒqóEIú(.óFdhÍ^Ž¥­·É¸‡¡|'r>r©Ð>3Ü‡yîÂ-nû®¡Ÿì~ãÌœ·™"IÞZöÀYRwS{%q~P«[âhìPU§ËÄ¼ŽN ÃWÛ[è&Ï	:TÉžOítòUÉár—ìlŸî’÷§Û'?íï“Ó½_ö÷~%;ÇGçÛûG{§[˜R´åçË½5«kè­]q2sócg¥ÓZû­"W^¶K¢6¼!«¸s!È  Í8höBr£æÇ?uºÝNgç7€JøÐÞî¬vÚ°ßY±Ó¼A äm	Ýe¡>À~0¦æíàCè©l¯å”¦¸;V/t°qýÈA?çïð,½ïIÿ``¨4iþîŽô @tŸöGÖÀÙ —“Ðk<S,ï~é’Üß«D.ÓÕô<x(Ê•#÷>8¾ÝM¼Ø{S…Çïµä[	--ïr£¡ôüs·¹3
ƒþ§ÉøÄ³¦°I›
—¶k#g9ÿ©ùòå«W‹ËÒ1(ßÁ¨Ã?mnï’íÃýÓŠÁ(ÏÁàŸ?ll“ƒ‡'NÉîéöûã£3ÅÔŽ·Lƒp2pVŒ­ž)n€}g;†{þyâ» ¬6:ëÍÎªñ8
àáðÛ{Š17²•<eøo ëëŸŠáv€/ÙmwÚÍöZ³ÓU£Vm(îeÌ”ÞŽ«x‚êÑ=ÇÃ »Å?µéµøOde…¼E`d?Ù,ðƒŒèlÊiÁ§œæILa'·0o#‚¿`Cn#PÈb4¢ÿ ]…þáè?·ý§Ëÿ]…—“×øÅòÒÀÄäu[ÅÈX9uú@$_'QŽìß-%bºHX*¨RŠÓ%ô`H§­CßGuu£àÕqÌšnìŽùQ7¦Ëu;ºA«|Ð:’‹trI'Â~~Äƒü•¾ì\d÷ÈµAŽJÞø{³ò8c”ƒu
Ü¬(óˆA ¬*m;wB¨é•ë/I¢M¹¾Ä"Pq”>ä
#Œ¤j³>¦¨2ê3Ýï\`s.äÔ·aó%Fýä:ççÃ äÚµØð}ŸþAw¯RcÝ^ô˜{4“d¿#Mlj «Ôz?r3Å~À|Üí&N˜w&TÏ¹X€%½ÚwŸúAETbðd}&ÞUG¯”$`*öÚn4f 
¡	Ý¶™=7	D¤Äå±A(µè!F¿ºñ°±xv¾ýî]`ð{ÜJø-Û\úüô†\>»N9û~ÜÈúFÞ©²ÌˆèÒ2é´—Èdõ~|{	­Ù=<¬»`›ÊJ÷÷[¢XgÑ$åZÂ	TÙ‰4á}j-½LEÏ—8àŒ"iXRË7×,² 4‰°¼ÃöšŠ°¯ÛåO žœR‘ŒPÃ+;<Òiƒ¡|M†@àÌ™>¯œÉ`gÒ}bâóñk‰¾˜nptÒ·x•Ïš9TG—¹ð‚"#0£êì2¤íÕôR1”²›ÎV ÞU–7¼ÙU¶«tÖ@¶è¼H\IB<¬Äê£ŽâK=	íW¨â®ïWÆ°
«ýÁœ¹å¢Ÿc½o:ºmZ“801å3›YÍV=ëÃžñ*cu/<2Ò<Yè	ð¨Ÿ‡"
‹4ÄzK$1áª’¸bj–ÍŽ&Œ4€ÉFãfW*ƒTÈTw2R`¸úu6u}=¶úz,À‹p­0k£E<rF.ú,P[!Á&O´ ´ã¯f³H0ÀÅûgR.8Äû ±V½ÃzÌ=Šº§ëSòÝó4)fž1™\”†äãmrÊ7xÌ G'óç;ðø”I<*:™Ày,µÍäŠZU^§ª–˜“Dµœ/kµMÆ1ÎÕ¹ÁXZ¦ l8˜Ôµ²D¹d+Ä@šB·`þÀòï ’Ô°ºtÛ¢Ù¥ÓF»Ër§V‰[ÆSiÅËôŒA·¨çÈtfsjPC+ª¤	MxˆB?ZàÿÐÈ5»ÔŠÙcs4¸Ó}¸)àãruL õHŠ†M™!;‚xyMüE[.‘È•”	níX±3ÂiàTY‡GŽ‘0‚ªÕ™…Ë¾ª£i%ì¦¯­]_Ç½§¶ÊùÐ£
ówÿq„+f–-lýJýöß*úQÜãZØÚ=~û¡ôç0¾œ–ÁÓ´L1ÿ-À„Â&Ù4‘ô4\?sÓ‡ÁMë‘€ «Í‚7“tž_ó Ì$U^4Œ¿X™Ì_Qœ/ÃÁÅ¥i¶ó9•T®Kê_<|Ó…-¬7© ¦7*kde×CÄêgwy(¿/‰Ñ¬´L¨žÕÍ”\ÁäÁ,’³°0‘©7RxÖŸOw ËÏ~yo®—ñ4£ËBdäýÆÆ3fC¹ÔVË_´y·Ú­q‹¤ÀÛ\8¬¡=óLÓC+¸þæÝ•åE†i›æI5õØ«Ue45„Ph¿›Í¸óüyÁ¢­°b(ã·Ñ¤ça\ï«õ6p©é.oíceƒ:mÁ’‡âQo6ù‰ù8'fú=ÚÄM¸hÜ¯¹³,øGc«äy ´Ê¢eöü8œ’X§¡Å¿üj£˜O–ÂŽ,OÕfy—F‹eÂ«[lvëå:¾ÚYäµ8 ¶;pcËó¦X<ðAr7H##ó‰ßw¼Í}án‡Ö¢©‡ä+ËŒ}÷KmâVÅ‚ÕE'³*ç“Ì$[›"¥§Àúr¢MoÙ<Øó¬Ô©»Í[Ø¥,xSU%«­JQ“ÀŒfmýâFÀ$žÁò~Bƒ|'Rf«ŒUKÈ§]&˜Šñ¬·Ž-åë4/&"7®çŒãhF}Ës³ …|C¤ÆÃiDËíœ¾lSž‘ÆjkõÇõrKº­Nw}a	Þ4ðÉÉî;ÀåÑØõhu63&¦’1È1,¦E>àfÑCíðqbõ‚kúÐ1OßòÙ§å8Ès”4˜ÄðS0Bœ6j•·¤Œ¤ê/åbÑŠ» X>¼lxnõ±€¹ºBêD‹Å“"ðL¨â6„Ì¤ú’‹ò,œ•ÇËés^0ÿç %è$íáZ¹fkµrÍ^È2È*“ÆtÙb2´Ê~P ŽFµ2Á$îj´–=n:ñ&Q>Â	ã±Ö2äU„4mÛ6Ù¥+‘3ÊT% Y‘’½âÖ%Û½&Û'ÅXUµ’×žÕs¼jzešh÷á'z½Bg–>S]§€åãtòÌc®¤h†O’3R®äÄgâm£Ü~Je†°N¸¹à´€8$MÞº>ÙîMäk”dFVU‚ ìä¶¹Šòm7Ñúo#vëWF‘@¦*ýõÃÌi ìd…œcÙØh
éá§œ.ð63¸øJY‘˜¯‰²XýáÂýG_¥pã¹cÈ¡åƒ@.l‰ŸjMsê\9¡ãÀA³?jÝüËþ	ˆ?û'µn¢º°Eÿ©uã¡c£³°Åÿ¨}³Ånµt7ªd}¥zÌä&°­oÒû<äŸ4ãm³’÷sËùtøv  be'ú5€T^Yü£PÄC‘”{Eßåø®Úr/6"8 ŒÉ[ÍÛ¥œ0Buml¦˜*j;¨ˆšÅ¾½¤½=mê@áeƒTd#³|äKf"xv·‚wËnK­88£	›ðgè4š/–î/U	Žliª_Y>snaþˆ ;°%å´4·9‡1f7º}LVýÊ’‰V¶•#ÒfÝ >ò¥y¾¶r O¸Î1p³÷2¯™©F50ŸN­]uè`ÇŒmX€	Á#§Ç½vœœ¸ö!û t¡IE½r¨Œ¬kç,ÓÏ¶‚Þ­Áá†|lµZ‚z¹œBðo
$*	¼‹*t+ÑNåH³™j3F¯À‚V6‘\Ié(5Œ°*7IÑÚWÜ¬‹$6ã`˜A+’W¡øOZÿ½Û.•ÕJ(¯ÒæZZ¨ŒÑ½ço­Rïä…of.+óíuÔø—uÕø45½]ÃæÇµ6+Ìþ UíW/f«þò%4þ™ÔýlÂPsvM¿ðñNÀ÷¤º4­NÞHÜ‹Ò²¥FÎf”GÚË`"c®&öÐÕ¢=´ì‰¬ŽUå%lóËRÞ˜ª@IÙ´)‚ÅÂÖQ èN/cºsuRØé%3bmÏÄ
y…æ3 (Ô"‰vµ8 –m3^ÅŸÑ’N-=ã%²apx%ãàÈÞÃ-s¶ÂU
ÖåBM%Â‚lÙ çi*ÐÜT:°˜›ZÈDTR“µŠ2­IK)`º¯º#@Uí:#!–]Æ’"»*9³¸Ã¼RCDUŒuÁ.ÉN.ér“ÕÞYŸ&–æê À¹°:
™ëóïþË•œªyOøm›G3Ï…;ÀKËÃØêhv:En«ª!¨)øvméJš™hrH«
ÍéƒÎ¤ž¡Y¼6Ì_Ã‘'që=\3‰÷O™ZÖ>…º³YµXþ@še¸%~ Þ³VóµE•”ò‚¬RCîa4;lKø@=²ÍEýë,¬gD-ðÒpòõv^´ •DšR]þ²¡%œx¤HÎ(¨‹\Á^!rX´ê0tx¬˜@KSSž¹>Hk7h`þbL†@|@mfS4i=ÎÎ`â©/ãPtt#Grc0„²ÖL–5ð‚žåq'›s‹2¶,znUë9€8cœ;r±^>q‹681~‰5Ã	³g9	ODŸ^0*o‘Q`[Þrº,ìgá]ªí†p“7Ez/¤ÆóŒô4
ªr}û¸º0ê,Ï½k"`å:÷
Í{ððžã7ú§0ƒãa¬ ?Áç`£/Þàítßn\ÒÐói>Ë8ç¥Aï/Ç«Õ..mb‰©“£÷ VõuL®a<òÎZ{tÙÐb8I©E^i&»·ŽwŠzÔYE7.¹ExèøÌ¯Â*zE'’ôPrö©Ù|‹Võ+:G+…¢Mr¹{üÏÛGï/¨êñ,GwÓÔè:ÔØ×Xùø_­æïÛÍÿÒn¾ºhþ¶2€í»X\ºoýÁ¥á†¡s…oÂöÀð¦>’–ªVwÍÐê#ª6œ04ß]4—P“ZcñåzX&7H_üáLa˜ÁFçš‰–gÐ3°âeïôø}ç2]Ä¡´B.G%ªÀN¥œ>±ÓvZ¹6têžV‚Td&þTôžÛM`\^K¼¢˜Fz7œ“šVILjN­Ï‘ÚåjPÁŽñ°¸‹y–ªƒ.²P…ê 
î®"{HMÈ;˜žœ¶0®4Âèó‘ÇÍõœþ$TÝå‹+{uêwl“e”ÁÆ	¦“ õ‚N/Ô‚Ñ˜NÔBùÌ?©ÃQ<Áç„öêµ@ÊâÇ©.Ê!¢ê”£¨XØ#zXý+w0	A4‚	|–Xé³–[¸ oØ
Å¯QXŠàeA-¸ÙÄe~lMUFm)ëÒ×º¨´´Tq[¬_\®MÜm¥ŒKô4Ã^0ÃHÖ|zHVÈ;P÷	ˆåÏÚ"Çù/%è!³ ®ÍK¥¸ï´¨¥× òÃ}‹Ã@
Î J®lUØvº$	Æœµ¼©ç%å0ò2‘ì)y€Å´)a’R"ÊvRõ¶Mšt¯O#¸üÞ‰¥Gmã)Bijî@»¦BVŒ˜ò%âf
€ÿ‡ú¤)æªVëdÌ_íOF=ç^kÎƒÊ´>.ÚëšÞŽ%ÿ5ëÒ~šÍÑ =ä…I—	ŸuƒÐdûwÀàã¢›Uð¶2ª¯Y× ùÐÊ	c¯ù#¨¹Ù$ÅØóÈ?§¾NªÚ×*ÙCýÃ—Â“uD´™=a
½ä˜²Þ¾€=š?®°yŸ°å[ÁD@—'Æ’\rtmºè<oá?!Ì7ƒ0”¿tŸøKr)A÷1Ÿø	a¾„éRÓ}â0É%GØ¦‹îcp>ñÂ|3C9Ìê‡I.Â #X}Ã'~B˜oaV)‡Y}â0É%GØ¦‹ÕÇà0|â'„ùf†¢
yÎ¼ŸP†(QXÝ£G@šdê'´ùÒhc\x¾‹Ixgo©4Nà‡Ÿ—žP‡`cg¼¹Ðnµ×ë¢Fµ\ÐÈ0Ë›?†‰³$£[ ­<“WE0ªð"]ã¼«‚ìÑóª*² ]þ\ÎÝÙ¥!»2:™)Ö+<ÍêxÙkè^E6{ŸWåøå‹do”C$Î’’1Ih|O"|¡+©ò Ó,Ertõ{ÓßWêÙ?%}Œ¬ñ-+¬'ßò]¨$âü¶
RŽ” H‹w—H¹H ªÉ8d1g—Ig—„hSšê†U%®f"Ù|î‡‘jv=@*ÂH¯ùéu÷3Pkviã
«R*~þ²HwHwô„oÂ7ÿñÍÂ·âõMãÛà²wgåÌÁ–èO8§«Â¹èq.zÂ¹âõMãÜ9àÜyˆ‰OÎºéÇªÐ-~Dt‹ŸÐ­x=Ýª3TŒ¬aR#A—	ä×²Iæ¢3Ù³ä!›³d ïAúñê×¯Ÿ;ý¡OKÈî:ž3 \y¢^ÚKI½ìG¤^öõ*\ß´°p6Ÿ¯Ý(§äm`…öÎi/Îõ#E•Âìšé`ò'¬+\ß4Ö%–ï}¿	0Gù„uÚK…u¡Û<¬±<âÖå®'I=“ÔqÃ;2dåbÿQ$õ÷0%9´¢«@?.Í¥"\x£‹ÝÁÇ#`ÂCžYáú¦Å‡LS>³:POh¨½”šr²‘ßÈGÔœKÏzBÊÂõM#e"¤ž0Rs©0òšíâÿáñÐ±ð '\,\+éÿ Ò>OüÝj‹œ‰uyŽ…º<'Ö+	ÑBÆ±xRY_¥¶hó—˜_;aì‚”ÿ®’’Í@Å>3«¦^¦”KBµ¾S:â0•J&~(eú–¨’¦²o}Šòe(b)ù'ô/úÐ}š?òÐiŸP‡<uõ u–çX¢]rÌZi&­Œµ¶®êÌ’LÊýX=4­ˆÒiNªAtV«§™ðƒ“,àÎ«êÁid·k08Ëüê¾lWÏ§±tZíŠ[26Ö­Éq¶bX—›m0#J;UÛÆÁuª^'á©Ô[Þ5Z&uñužNý£çç,€fû%3S˜í_I£ªÜLÛ¹²&^|aõûÁË„£,}a;±åz ³Ü>²ÆÑV[®š@_‘8Wü«†F´îkè`Ñs±ñqÒ#Î|eQu]n³žyîóðÊÆS`JÃR.f÷óþ<Š…ª‡SºW»|/”ìIWx^ê"Öò=s¨®FÖ6’5ö&@N©¦/°F2™¼@ç\ÒµVºö÷¬¦ÿA`P}ž¥BjØ|DËŸ!¬žòbÇ£åjß648d# 7Óg¶ÈùÐˆ
³ƒ=r h“ºÌðÇ¿LœˆêÎ9Œ]&ßs¢ˆ²Š•îg½vÜ0-Ô½¯\Ï‘wÙ©T´óú’¹¾ÚÈ]F	«4œÜ
K‰ˆ¹[KziÅ9§ÀVû¼x®ÌË;¢pù>DÈÄ¥õÏÂer#²Öî¶à[§ÿ	¨'BV§Éq?&]rrØR‹Ô³‹ÿ]V<>‘ûëÉøÈcÜßù¯Ãf·=¯ÔZuj¨¼¦wr‡F5|d?³@d`ã+mêš¾³ìbšê$ôjª©¢FÂÌe§ÒÐfÇãhce'kÅn‚ 5ðV`	º­y F<;RÌWñ5H'Vw	Ì&ø‚Þ&FñNÂàÚÅòë]A²=ª0¤Žgäú›JòÄ.2QiâÂ†•_Œ“Á^i6W 
6yCLïÛ¨À¿b ä‘%ìÃ¥/.ÂšèÖ•NÂ‹U9“Ê,®«ßæ¯1µ¦¯Û—Ë¤…ãILÿ’øg:OäÂu<mú¸D8šâjþ3øÏ=³&÷‘ÁtgŠa
bKÿ@ þèÒ:†y,2ªŸB¼ÕCÌxNÎƒIˆ³àÛí(r>ýó©õMá~yGÛ¯ªûöRHÒœ&±Ì©çƒÂÂpºÓþSÍ?Z¼áßÊþb´Ä)tÍ§¿ìyãbìD-¶«AÊP†Ml8,]‡Æ©Áè9 §†.È‰ÃÁží¢„ÛQèöØE^i@dwÁp|guÏvq Îi2ðdäÐh¤¾_¼0ð[Î Ähü®‹VÖ¾Ù*ÞZþ'ã]ÀÁœàÏÙe‹GÁ=?Oƒp2p‹ç§&Û£ÈrGïX@q€	-ž§”"À¥ûŽê…1:Cª»K…AYÒ*odkìÊÏThð] Cªy‹*Fƒ ©QæÏ$fO¿[”¿ä¥ì-å”S¶$'—RQ)¡RÛ°ïä/TèQ'Ì¥kÓU¹ãÅMªhq—]|‰©Ð¯û~I!´¨BL{ÊÅj¶Ÿôš0¹ãE}¥Ù7×$½ÓUvIÇ'àSHgƒœ9VØ¢IÿÞ­‰»#[Iy-ðhxjw´
[Âqò¬gµ¡m\/ü+ïã®²ÞuTvl‰ë!‰B0 ¨Ô"4´Ëaº§´¡‡t—31 ÐŽÛOÌ<T¬PšÿuÕ9k„×¼æ‹ÊIriÇM’´Yea6’
˜ÊÖœúXšjå0§Cñµò]#½)Á}ÄFËG§û;KW.Ã€³‰TÚ[IqdŒE¼µhëPM¥RâÐƒ¦Ñã@MÈbj^!¢ÌW™“KæÊœ4‰Âƒï°ZùÍ.Y·MÐºÔÙuåæ3mZô''È¬Lüºkè%HÖaù_&N8Ýñ`"›¤pÂ­88nœpP¾±ÔŠCw¤nFÌ¦»r=à×öYN°³Å¾kXúv?Bä!m;¾I¬9îYa!®ß÷&¶5²Åk\æ|bàFÙÄøIÚÞ™5w^\ª~¢övÍrB'&¼èßÿž-NuÆ(~Â†àÉ®·<ÇÄCÚà¶­ëÎ!Os”én‚cqkmaë( à„%#ŸK	ñBo‹¡‚ò]ToÂ•¾ÌÈW¿E.±‹¾£ÖTôÉ™nÞ1˜¸×¬eSçƒ&23ª—Rm2‰Ôêñ‘¤bNÄt&¦ŠÄ…H€ºîÈõ›7M*Wèò‰”]®+g’ˆ°²hÇ8œø}L¶î2ºpo’Œ"}ƒô—è w¾òRG“(!ÅÂ’>1íÕ¦5\W…Q[¾ÓÊTdùtÅušíÓV‚¦»ã£LgD]%ÿõtPER­ÇHÖ¡8/iïazˆÉ9erª¾¹°äM®‚¨š¨ç^¥2§‡.ÞpÛ*'3€“!F¨Ú%Ñ0hÊmZ¹	+‚v“«ÚÖ%^»ˆ¶çp×(ŒepU:…¨üKºWS¼ÏÎÑ¨­[Õ˜
 –‘ªb$\Jµ«^½Pp¨U	/ºØ¸lT•³L?@)Û¨$ï—Ò›!&©ÜÝ™¥¥¶’ýc¦déÏ•,_VGŸ“&®<@…‰é¹ä»Š»¹Ažá8n*¾¿Dë™dÓ•NDµÂ_Cå¯û
 ~CÏÏéÇÄJ=VZ3°½!ó4pq¶µ¨›pC˜0Q©¯Â`D =7¢Q¿Û1+çìhi6Mj­Ð¢d]ƒa5ý6£Û5R3fóUdwø+òƒ+|¹Á•~‹Üè*ßEn°¡ÿ"w‰#wƒ‰£tƒ/#wOFî>#ŸFî#¿FîßFîcÿ^f÷%@5àò

!•'TÂBýPù³ª¤":1@ÇŠÍýoTî 6œMz#7Þ¼KÅ¸3ëÚÉ‹q÷ZC<MtN­væ&3UöÜBSkFue%ZôªƒS#Ê^4ÙeóP]+°TŠ…PMìÓ¹å>JB˜…#äžªœœäÌ´fØ£—¬_cjRa{¸€d mZ0{£Øpféõ
\c¾ó]YZÒ8ße¶³·’Ò›¤ßÏ2ÝéþŽ¤¦ iÀ÷³L÷~ûpïâpûì|ï4Wë‹4Þ.‘&)>›e?÷v~:ÚßÙ>¸8>Ù;Ý>?>••5‚ý=ž×Ù?=ÿ Ï;Ý{·wº·W*ØB¿œÎø¬×+µ+Â½4tLD·q¬<®ÔÖ™¼QŠ];˜›¢oª(SÃÌ«væO.«.µŒWºýgÃì4N1§¥hNB¯1kïÕI}Ø (¸£L£Äÿ!×“«–™Í½C³DÖ^ØU‘ùGÛŠ†NŽ²ŠÉy5T3Ñi&>ÛŒ¨ê¦ù±ÛF©Bª+jÉ8a©Y˜[cù\GÂ¥rÄ½©èÌÍ©OsSžjH¾Ê}G£b+2¸)Y#Tî8æ‡ÆÀx¹e‡Tþ3æÔ)Š¨é}i›·í¿³­+Êñ;ªá…™#/÷¬þ°Ê>æh³Ò®s›$ˆDæK¾m„Ëb¾Dò–¾Ô›ÙÄ-:âÄš–ïEgXØÊå¿PgØâ_hQîSìË?”g/‚KÙàUÚ9…{ª^úáª&ýpNÑ´†¦«YM`*‹~£Vf:Ç6<p#ækN0§¢](ÆÝÎt«ç’¸[ÜZ¡ l,ÖVYØº+£û}ÍèZYnŒÅ?ƒ(â^¹°)AR\ 0Ý©ÔÄeLûq"ÄñÈ÷”Â½Ø@â*Àî$Tç‹‚³Ÿ’;mrúÎ½uìFwin`x¢ApEh^€=‰1½ûî¢8€Àû-P7z¸åÀ˜~Hk~ÀŸ0MhEO0Y“9–‘#Ç×© ÅŸ‚Ñ—…D‘ –yîÜÀ/¡­b X¾û;À@šè±ZsH'(ÌãU-×'46õI1ò„˜4DlH‹"T¦Å H_²‡7»¨QäÕ”h´AÿF!·óÂ"Š­0Æq%/s½ÖÈNhQÅD(£9Ë¤zdÍ Aæ –||.°ŠXE(39Ì›hbIFÍŽåõ'h'®»éÚh°±ôØš“8ZÎ—Ð ²4+Â?ù6Pj7î¿
¤ø À†JÉVmÀ- $74 ±v&<^`ìøÇ	¢oÛ6?¹ÿ™.W+'E !ÈDÒ/}µ²_ËËI´n¤ðŠP'=DŽw¸JDˆE?ÓàÏ¼q@f&Q x9íŒÂ·ªaÈ–‚®ÚzRãèT®CªÌå•àªÈF±
ÓQšQÿöáÌˆum¹žÕó¨‰Á¹aŒ—œ0Bµˆ)qŠÐé·++dï¶T~àøËž#“ÑëÖ‹nåHuç¡cÙ¨£l’ŠÅ,à¹-,Ã¿hÄ…©ûÿ@Ï$þ{ÀÿN‰?.ÁgÕœÜKG§cî7üS4 áç¿Æ/Ð‘H’õÐÜ³£yÔŽê­£Ë³¦þËŸO’Ï|égÚÍ~ïvìY¾ðp ûô‡kÚ8¥ï·pZ×Xæ û&-L+~ÇjmŠ÷Qù>³Qœª²‹“ƒ;=`ˆ‘h·ÁøU…©D¼íÁvi¡W	O0 ¦T?i< î÷1‚¡n@À³ê!aæ/O X7ÜæÐ­“ËÔ¾ ƒ¹êb`#¦ÑS²î†|ñ*ÍÀ÷ä³iW¶µ³ö2/¾Ñø>÷’ÎmXÀÂdßå]Ãá|¯M‡GcÏô7¹5O¤€ä&ÃcJ8±ñ@$4¦KàFMÅPåQÅÜiÈ%R98ûKs/jYuÑÐqâÆGÎ‚–ii h¿)ÀçêåçêÁ§ß¹Q¥‰‡Z Âû6öMoä8‘¥™Ì¼ ›ë&‘êë9ôîKî¬»Ø>88þuûhgïâ`o÷ýÞéÅ³;«y\;ÁhÜBÃ—4}ã¢É8.—î[È«/ël¯(|d‚¿G_‚‹Dpá šôûN!õ~§«ü(AÉ‹®‚.[}7ž6E/ÜW(¢JeÆÝàÆ÷Ë6Q÷è¶rHI÷V¢½¨$Õ:Ù¥RaT
SVµ;Ý\\ŸÓ×W“©§0í0;ÑHF·L¥R$ªåKEÕšß“šQ2[»ÊV’›“9Gvº­#¡º-ì ·I“©·Èžì-DSafËÆÌ7Œ¨œŒá áÁÆ[&Áò–1§Ñ²±n„ƒ.JÔaoÊEpÎ€Ð2ÆòQ¹•GêØ-žuj†¹Õ(¶1UCÊuz ˜-šh™ýÀó¬qä¤¹?
Í.FÂ­4üÅ¡Ü¸È-µ =$êI‹çRe­RŠ”E£¬Ôc^¯ÄÃYfA¥¦8ßð”Ig›*ï+gB!iüŒ“.ÍcÆBíÕÙ'–3dM=Òx¬œ:ñ\)š²PV›õT¨jøœ¤ªßÞ÷„šµÕÛæs¼-‹z*ø-TÙÆ5È÷:îöT\5Ð•'ü])¼îÌÊ9«”ÉtwD§I&,&
“LÐ%‰»LlËõ¦§pÞø'HúÄÎP’_&%žˆ
Õ2„wBŽ÷DP¯Z­¤‹©¤	¡aËµs!ªeÓ`>;Iuª´ð ['úûLL«iá)£¼ËÒ„7Í—(M´Óì&|YÄØæ«õvÑ½ ‘1KÇ…qŽ½î¨]X¾*Ú¸üFîhPÕv,½¢°¿™<¢"ñW¸,/Æ»ÒTãËÌ~Èþ	zsú@‹pƒ‹v^¦Ù®‘W–^™¹Õ©LÕ(\ |ÇÁø$„Xì¿6Ä¾pEN¼ç{[jŸà&½ßï‡LC³²0ŸJËŸ»´ÎÒKæWºhè‰Ò¯dR¤ølƒ71Ê.&Uqñ…UiÚÉ§—ˆZÆw²Ãf³·-ºêKµ’„LlL?Ær#Ó\Õ¸‘˜ZðQ¦Ò³éÆÐW-§'‡µÓ“ÙÛæ(ÓËlZSxS¥´ËÜù.n?õsÞevä{cð6g2
ä<¥†•Q0w¡•“²Æ†QÍÜž›?Cí ¶‚GSÈ?ùuƒ2\|ƒÎ²ÄNüð'ñ î$0™¯z§•mäœNRDq×§I&,óGUg [@s‘Ô©7ðóÆ]Á?qOþNNðÛœ3¢ºJ€ACÖÏ´¡æñíuÊƒTåA%WR¹ Ì¼4åŽÙ•eGYÑÔï“Z/4äÜ€vŠJ9‡ŠF!¶3¡…MÉ*/c0ÃFjéÚ$¬úr!²c#yþ½Ù¬ËI”%çïÜÐ©/tÙse¬ïÔÇJû¸OaÝjLu¶Îá¥øØ‘„¹D¬LåÛ¬ÄPí’PÔøË_ÂpEÏ ¬GWŸ)•)Iß5—äT„Gëûdå-.Ã»õ³„qF£ïÊ%KñIø°¹šÐ’ü,§›îøì.ÁÈ$ kï¾ß?zON÷þüaÿto—V=
h{$gñþ²²—°|“õ‹5QKUDhO-©Å•«ÐjŒ¤ˆ²VjþR¦I˜*´¬Æjh[s½ÝNÙ$ýb­æ!¥VÛYtUúe·mü¼ú¼TYJž—ÊŠbÔºð¬ôŽnÛ¬âkþ’×Í_&Ro!½vzAð™ßFA¤øû×'äšd5*hŸžÏõJŸþ¿I‚"æ®JvÌ®Ê%ÎžÁ¬i]©zJ*ÂJêm™V”vC@sæ‰¼m	(3õ;Yª£ÐÊôÙB#ÕàEU¶›¯s”µ¢eÙ5TW
ºw²­xcÜ´å½h‰µï2}íŠ®¡úœéïo±Ëãj»o<ìØŠð˜¤ÜÎz.ÿó¿“ãI¼‘ÎŒ/ejy˜ûyÚŠñø²ë®QLÜÍÜwÃ[b&(eâÃJàÉ¬$’„ÜN—ãU	UiHìÆ^YCšå-ïÍŽð?þíü·ÝžéyF 0§Â{&¼¨+Øvî€7w«Ñn^àb™ÉQCXZ	 f\º¡ïƒ©Á›=ÏòÍÄSÇÛ\ðƒ`Œ!ÔÄè²B'4¼½‚`–KóHíÖÈÿs2&>3Äx{~âúy§@—VGï¡€üâ:7ØðÐ;¬Ïƒ¦õ!ëVˆ¬Us,»Ð}Ä
˜$„„†º)¿îdÆ¸Rv9—(¢ÖAÇ©¨g%›4AdmšaÚŸ©Í@˜}CÎ@U÷²¡Ôe6kk¿dZ³Û—h‹?]!nù«ŠâÏå¼›]Ó† £iôóÚÞäõGYúRWVsËSsÛ÷z¡´K§-wué,r`5ºiµ´ Èƒh(+yœ¶N6¬'mTiÕH8}¨ižFDýKÌåR±¸;‡‘Å$xŒÓÆ}›Šÿbxa¢S;¾ÍŽÝ¸ÁLådÞ„4žg¨ô`Ì.óV§Ù…1 ïÐJg8ž;1
gó~kªcÉj¼íIæ3mÃQžÿggŠ±Ú3¹Ið¢¦ðÖ'gÊ$Ý=<DE}ÕÅìûc+Œh·	úÇ;/°â†lëêÄ›ÐÕ¹ kG6ýRrþ¤×úÆ
²KÌ8ñŒ˜ePkáa–%‰LÉˆòK—¢(¿ŒH…(ñB%ï°‘l”©õŸ]eM©Qu•Øâ%nxËY¹´]Ö…üº'ŽçW„ß¨oš <ÇW6=MÓ ¨BŽÁ!°ÝÙŽ$ÄOŒoH¤ƒ¼Ì D™´·Ï˜¬“ÑkªPæ†–…­ŸÍíWÆñ0RöVÕO<7±Â…W]¥¯‚âU	º3À™,ŠBSK×´R x™šEµÕuó—© ÈG¾ƒâŒ¹&_~4¦:W–úØµ.;5g¦ÏJçÈUÎÂ†ÔäAjÏ{Lò€¥¬çN¹…Ñ0³ÈärÂ`2&õS¨SRÐ”¥){BÑHÂEîIŽü8¥9YÓ!.êâ¢LÝËöíM+¸=RâÅögÀÞÔ_Ul½“¤7´	…Áf>é¡CXTP¾ònø×¼ewÁü”ˆ åìÓe>3Vº6ÙÏù‰k;ˆ{ÐÔ‰Ò¦¸échºgˆÞ´a’F& 4sÀKÝeGA­ #Ç:ó›|@[]Lm#¼Ú¾‹hþ4ºh_¬·ï—¾”«ÛŒGèø™†ïxNàL†F¡jêö^[ÇóãyçÚ¶XØ.×9Â4I¥v5HnùðçAL°œ¬ÏuSJ¾Q‹šYVkæí‘”Ñ'ÇÍÄk¬î$
Ï'tR¾#¤¡ÖÑØ$×|’°uÍZÐÏÀ\Kõµu—‘† ¬sƒZñ°ðßh/ói’ÎÒrR4Ššä1á>±÷¨£sKÃËS÷	ÉE¹N|YPZUjAS ÄÝ¸Ìc¨š¦8QËV “wm|™mTŽÈÜ	pr_Q¶ôð'þ\ü‰#^G‚³éoOh*¿ÌÑô‡GASsqÚtà7,‚ðÂO"ÈŽLN|$ÿª)˜°Î¼d1Ö‰ Ý&¿í‰¶%×Aàä-‚|Ó<Ö‰ 9œÉšÒë[A¾aƒ7Û{0êÓ§ÏHZ„äeƒksÙ ¯ìÈ'y"=	¡lAáK!âµ9—ã?¡Û7Æél	5\âõñæA8SãÆ‡ÁÁxxÎ8×®qcN¤®scOÛæÕ9Ô&þÎ²§eâ³´dº^ãºf$@QY,”-xe¥Á€cVÌàqfxvè`?ì¤¸¾™¢ñ#ð¤þÐ9»1sR2w´¾j~Özaª¦`öÂ1J³ÈÈëM/ëÆñäÎÚ\œ­Á^g‹ãf½þ>k½æ&c&ÂÖä¨†âk·(¾b%ö;<ºûâÏ¾bx ×ÿ1aØL.|”x®?²,XOœMÔ7C*^yYð‹KVfEr¦7ú–„RÍ[Äba_¸=_@¼ªÚ¾ŠŸë—¹¤-pMj]zVÏñÌr]Ë­x°Š8&Q™É4ñÕ°‚ÅušÜÞnÍ°ŽvìÍ»ï¾[®ß÷&¶“tã3ßã4äd……mdU;ùú'­>ž(CÅ\-Yäm…ÓM"‚žažõn˜ô–lŽyr<…â'h§]1¾>X§Ëz‚t¤Ó­™3œ?jˆêk¡¯ä,AÖùH!¹×í½{Ô¬3Ñ¨6’Åór·Õ`7OãŠl¨õ‰¥Ïy1ŽÚB›ØuêˆTÊ!•)…i^u]è-@.Ñ,5 ý…Ø‹ÅId©{ô¯¨ºh!ÍáÝ…j¤ŒÈ÷°\ÏSÌb!žcÙØ«³ánbÅ{OU‚N­¤YaN*x³u¾T¬3²|4@;)#L›—°ê8¸õi;§{ò=a–c7Av‹v$§•´„0x‡ÔéF¼—•&£è¹lÀíÏ¤)>¬ÇÕÒ%­5eBžÌ¶ë®$0cb“!œHëþPÊR
QœŸóuU¿À]A¶y„e1™‰ä8qu„¯¥£Ä]?ð¯Üp´âi<×‚J•–y û3ÕVªaò™ƒÇ7æ]Œ21µV’käÄ;Ò­®—ä.¦¸'XkÒÑ¶^»^†{}¹‡¬Æn¾huËñ‹“r+7C  Rª¯(_?ûÝÌhóWg¾ÖšÁ/-B¢YÎ ©®5,ëá±¶þ(øjÝÆGh|€”ÌRQðh“?N#>°/^ÑÊ†]V¥¨#«k8T39íSg”˜0=í¦úªŸÒÉU$ñ^ñX˜;¢Êf„Ÿ°-rù'y7æüü¥1…/òÀ5?Þ­|Oxy²»}öÓÛãíÓ]òýJö¸»¨bÌ+¹ô²kEÃ^`…6MBgÍæŽRÈJ/õÊ¢.õµ[/5¶'žü,—ú¨* ÜâúdÉÛ¨£Ñý;nJ‘¼LÒˆb+Œq\NðhäV—äOwaíÒnŸ–Ü€nG%”²­BÞyPÕx¯Üˆ«€¬ê6*µZUó¶Ç^ÚjéÜ	G®oÉºÊËåù×Ãn‰2ÁU¯Gà2 ß H'7ˆš÷‡gþÒtÛ%~u<P~œe|å¹ËA¯¦ãë•aWòöãÒËG#"1ü2“¨²ì¡;Áhü¦…]à©â<k	ÿÓ¤‡&‹R¯v)m¨URMÍÀŒŠ¹Diƒåw|§òÔÖÎf9
Ý~aìMex÷	ïßW˜!×ÖÏ`ìÔWœ¿3¼‡wi,L‘4o4œåÔ‰ +ü±0Q˜ýrô³JÜÕs&\
*ãTÏø–›-3¦VWóY’¶^å‰ø/†såºËfË›9
Mé’Vy•OøYl[XxB®¥!>Áò§™O Oì|X@ñ·ºïpóg"E«hõ,bçÕüDbÇYai´ï¬zÚ³apÃgÀ@'apåÂÔq¨(®'Õ,å:L¹àQ¥Z³†ì´+VEá10bN9CR /‹ÄRÞ¥è¬`X´`ß-	[RÉÅ”ÞÁDêjÈoóO™¦‘”¥zUÔÕ¿ä~ƒãIl¾£ô½u²Ž|S%ìW–f†’ªÀÌÏ¨û6Ésäë•ÂkNì\7;9Z.zÎ_<Æ£[•I
eûõpU)+™
Šu$DxâˆˆÕ¬ìF®	ÉËcRn¸*}Ó²Ph 7é3à ‰³§Rt­N¦ðí‹3ÿh™ ý0ƒ«\€ÈNDnÜx÷G°_T Ì&üÄî·873’8í¾“H—*ùRöeˆB×&ø?±C©íìcW	<wÀ°ÇNLi¶,õàŒ}”Gû-7Úf¯Í2®`?œ¥ÖÈ7xRfeyHnôÏm­‘öEZhï«Ý••jÃ âoêÜD{áb¹‘ÿTÙ“e3ø çÃÓ[÷mÙ’¯Xh·ÂºEONaÖøäL7ïøc•ýrÝ>›«BKøŒb	-Ïch,§5­5}=…=ÑrXÃNÞ×C¬°Lm/NÖë©­·sô6×A$Áæ•µ¶ª»¦ª£¦ÊÈT²—¸~ó¦ÙôÕÆÔ½®ÉhNÁÍ"º“6i‚çœ²Ïâ†kšçåw©F¯uÉw—‚÷SÞvEÆ)*ú¿¦h_a5dÐâŒœÐòì\‡×ä»¬ÉkâhƒÎ®¢,ì¦‘{ û¦<}6²«.¼ Àô6Ñ»tà-Ù_´ðö5ð4Aj¹ÕnÜ½ûÐ€»ÂØÚdèCÁ(oaµåeFç€oãKØ&žAçµãOœJŸ¿ÖÖ¯ýÑ!“ÌybT¹^Ü|wÁ¯*¼œfÞ‰ÚU{/‚ãêó”¶ÿZ9hþÂl'þfõ×©ÃÔ0½k[T•ÓgšÜŒkÄ-1-ï}Ë;ÍÂ€NîÄû /K "¾ò‹gw8]Æ^àu^×Äm%ö2?a•íUž1QÊ5oG^õôJ×t¡Qù*µ°Lfcïèa¢þjÐÜL€I®LI£Hºˆ3~cää-[Oªz…Wõ	7)…›ì¼`ò7åKìCE„‘™;°&=¬éñIãpjHœ*C`øsÍaDBÂº–x°ñ¹*rtÅœ–àÅúv$ÀhÞ¦#c5âqLH'ÐEÜ$ÒpBc¦€`xN‹¶¡7ÖÞÝÅw 2"Ý§ûœÛäš}FªßsŽd|!WyÏâ+$„Sfw¦avUH/¯Ï — d¨¿£ŠŽ4ï1¡”2U¡1&d¶¦ÐÉˆkb»J‰+wqkáLÖg¡±• Ž´ã;¾^TÐma'˜ 4úALðµ˜ÙŽ¿pÑ|×ZX&û°Ï,§¿
½€¼!¤ºþ ©³¶UÍ™Ý#ø é›Ô÷>Êf-zýØÔånÅjÿ^vå«*'s‰ELêå#&³ˆ•HÌg¹.ÌR·v›…æ`èB5Ãk“rÙVÿœmDƒM¹EÚ µÑiÅ3Ù­SçO²½ÉM<–LlÐ²%›ø—l»r_Ï2q÷)‡î(e˜ý5'c†.Ãr2:$O¼ITèËB»¯tÆ×ò—*¤ÛÓ°&åO’•èÕõ5xŽ?ˆ‡”}´UÍWL\?ýÀk¢+©³ÁÏpL]wGAâÜÉBÂBxSb%V»–ÔSzMS—eÞÁïÚ-êô‹~uãacñ|ïðäbqIbÃÒ:/_š;/Å`!‚’Á5ƒ Y\X§`ÜéŠX|æd¾¬³ïHÁ\æ¶ì¡é¹ŽãraKp&gEÈNf÷{M ªÀ%5
!gJSäë­¿b…ñNl”'`âHÈ°e¿ÐÑ(¹0ÆPµ!©™âPì5¨ ‹ao‰¯ÿB¦NÜ"TB$=Çnp’dJXJý‚_ómÑn”ˆHß½–+µkþÚ-"s×^ZKâ!h“±zÅ]¹ ÎÊ$ÞØ–bÍ²0D™Û¶€…cU
”í£ôâ|MkÉ7$È›‹ð,¼W‰íj‰„í¶ï`œÕF
½›Ú—iµZ|º‚/®½A.Ÿ‰ìÚ÷øÃŒÊ³»¿ÔMÏ¬W$7¿ö†ÐÁÖœÛñ¾.A_Qzÿì8ïÔû§ÞZmm¶¯š£+Yÿ+ïÈÇ….£"=eF­"íüî€)ø¤†$¥àZWd¥ŽØnÞ¯_v0s^>J&cŸE±ÕõiçkÓ²rqVéÚ“‹°º(0¼Pp%¥½%GÁBäT²RbmNƒ¼é;-ƒþ6å,lF—”M|DÙ*eÊ™õ¸ÂïÃ=’0`ÂôPT7i²,öjå{rd]»f>9›ôšçV/*,Êæ­RL®?”½ãj,„™"À§Ð-O1ŒXA¢u’g3A†~x^Ï
uuwE¥40a*V¯±ˆY
‹J½·àš4‰®U£J•é [46h¼˜aú
,%Œ¾††QKü—üÄtwå¼—bAÊbOÝrùÃ¹EbÕ‹Ò¦·ÐØ”Ã)ÁÄòœl{ PhëÔE­d<eî ¢YŸ(Gü M|›?$ÀXÓ N;½‰ÖnM*ï£É=tnàôñR³Ýáí(r>efÅäÎÒ ´Ž-~ð-úcWô$–%;âéÊã¤1€ÝB +˜-T òšTTO¼H_Mÿ²j¥J¿…ÊÌ_µ¤¨nM£Cö2ªŸÑÌÜšÃÑƒ
6Ua»<Ñ4…fúEWÌ<Í³ßD¦+S9áÐQEYbé»,½!éX#y1aÝ›:u‰¡Òñ„”4Àò½$o1ÓYšÅ9ßIy¨Â,BÙ¡JÊ{Œ¨ÿ~Å@ÂÑÇÞ¯Ò­.Ë…(Š†JÊÑvo2ò%¡JÌ”•l“	ý&Ü%Š‹ìþŠuq‘rÉ_*ì¦ÉÏ;pÀ„S_¥´+Ùy×žÉ³‰‡Ø|V2¤Ë¹@CÐ9°h`4{!Õ!€0Úî h¾Zoƒö`5#LÜÍ/HKƒ†Ó|·\ÙA*cÇ¢ÄÕ”TÎÉìE9}Øü¸ÆŒ£&ÄÒMyèÚ Ä˜%gáFƒ*ÓÔ“~²©@sbžÙv—á	Ô ½u©q³Mhq2ø÷¦¹Š*'ü/‹õÏñŠž7	q¶”Î"å£ ­GM MÏ¹ŠñÜar‡hËª}¦b›(*Jd‹U/™š£IçRrÊ×ça0Nó„ó¼ôƒ”)e4ø«¼oS¬W’±9³‘j¡ lW:u"ºzßË&…]úžbZPVÁP#Fóúî£S¥$Î‰'@'\ÐZ\D<	Bx&æ•PvÍ°0S‰‰z³Uêqa‚›&–¢iviQ{NÑ€¾•ó…
 P)=¤Aù•P>×÷0%dJ ¹+€½Ñî¿vG]0nö7e“*“©ð²¼¸xSZ–Bw_¹·Ìýôþ†õƒû¸9º(+ð$ Isº¹àÍä+up’èÃÆ¤¥*WxE¦ƒD5	/ûR +U¦Ga29ÅÊªù±ù rÕ‚	¦;±òÔƒO‘êA™*J­BÅÅŒ°~ß¿2Åu=^WÛm
¯$st´Í¥ìÍKÉ]	˜x']¾é¯@8P\àEHÏ²Žâ¥%¯KÓRù`)¤¤9ÌžÕuYAÁR2¶¥š>ÜIÂëJ&ûõ±Ýê:£ßÄ”=%\ñ7Ÿ'›ÓC×ŸOÉ
y±Vl1N?Q:›qòC@ØÇqLc’`g©j9¶0(Æ÷ÐƒA9.éêôcû?«ë:ËéiÂšHØ/Ê$¥l7—³œ7á‹4óMŸÊ&[`9ã³ŒižðÈ$µ®~¨•Ô3ÅkBä»²ãìë?Ÿî¶söË{rmhªå©ZE"÷wµ¶v²Öµãm.ªuû
ÐV|]þþaå“˜ÞÁ¨L;èOPjœxiCo§ûv£ZŸTx|1|ÁñÔb€ÿ{ä!¦3§!*ø'Gï[­VUÐa<òÎƒý¦ÅÁ‰?€ç.“;2voï½Gd•Ü/µâ¡ã7 À­¡g&â¡5PØæäç»ÓX´t±šxod=ß,LÇI€çâdûìì¢¸	?‘†,\4YÐÂÅâÒ}kì.+ž:„#Ãe³­L444•[4ç37ª·,Kôr6ìpñH]<&8Q}&ˆ<ûÃ¹ƒžÀ¦hä}¨š*ÈxBUu.Â> È`DÃ$5QÊÜ&¦É‡×¨ÙM@s†Z$é½'é‰J(–¶fÄ¼—Ô–Ž›:ªÈ.óAØøFö†Éªs,Kog ’Àfnäx»“xª–R5A@PÁ´•rèSæ`Ÿ¬[¨Fáj4°¸ˆ»wÊ²´Ø¢ÀáJ9•ªlÍ,¦åhT*ë²–õT
õ$ìÔÇ»tõxéœ‰Ü
Áú{‡ë5.ÓöY†¢ÃˆôÓÖ ¨”æòâG§û;äh‚"ù•1ªï‹¿î,–EhÆG~aZ÷ñ‹¿±P’$%ùÅ%E&¿ø6¼Ès j´xQ’FöÈÛ$§Ý“Ÿðú9_ØHä“EÝYÚ–PµÕWÍ1¹*U5íªR"º¬yˆ/Èeì‘ãq5L›hÆ:…Ó–´A¡BßÅí0DMÝ&½)9–ºf˜Ô'¸"ÉÏªS‘vk¸XmÈ…<è"õ\%EˆèåDé¸®X0¾‘!uñ(­~ì_VR~2è«}p¼û~ÿè=9Ýûó‡ýÓ½Ýlû,¹fÊò@ó8$‰\‹•ÇV‹ÇAiEÞ_Â
®aÃMø'‘kÕLºb¾v¦ä§ v<8¡j»“0	û,!USù’MÃ.3Ý¥ÚÛÊé¢e4nîªÊÍ¥x’Š®õ¨¹õ?þí_ÿÝ¬¥QõÔ=‹WÍ’•´r8Å]É‘N#¬{?w­RÓtI—èêé Ì
5ƒ‡¸6\Z²2<†'|ÅëcUßH"ió$¸Ïšxñw-º.Æ|äR~jƒÅbÔàeÑFT^Á›7¦K¸ÇShDK ž¡ÿþ¼4ZÇ†ŠõHîþÿ   ÿÿì}[s9–æûþ
Xã-‘Ý"%Q¶Û¥±åÐÍ¶ºtkŠvm…ÇQJ‘i‰S“IYÖpÑ/»¯;û¶1?­Áþ„Å9@"$nIRrÙ­Œî²HfHà çþýšWQ® Sþ[îeWþûÿüÝïÊm(9Ú €â¦°RÒ˜m[jq•¶¥Æq€Éú' _ÀNã]~ç¯=Q\1¡làÀ?õ=Ò¡{£@»Ó*¿ô#JaÞ¹!Ì2Ê½¿òÌºO£Ã; BÇ©j±Éu©VÙ;Gƒ[•ž†X—‚A°2wÂªª•DŸPFiÜ¸N£QIùšyþm11Ò+ø¨ÆY?hZZ:ˆFÙ>ø6‚^æ’Þý+ø
æEN‘/\zÐÉ<^Á°Â.V˜ùåÂ¯gƒhø›3>…])¸ú†I2?&"DÅÿ¨D¾ÞlD57’~º‰ÁJŽj’H,P" ­ØdV¸xf¤éŒº¿çø]§ãþPµ%‡ãx`xðD°‚OÉ›$lq `Æµû…¾Õ0 Ñ¨ÃÁ’×þ¡¼XŽîn3Ï5úfŽ6/("ÛïïØÞ¥nÁBÉ¤¡ËzM^Où+…£”°b&Ëä8Jß‘“Q2žï|)ÙŽb*ÓOIÅøÅs¶›1÷Eößm¥qô¸ÁÿÁ<h†täi\h†‰œÍƒ6©ùãA"ÑéKr^6Ê¿U%‹%™ýZüí¬Ù	%	\ªÇÑÍ5¡—H2æÿ@Ýaö#¯5¾DDékøó&["¼À÷Ñëo/	#m‰HPgKDB,·aóü.ü›ß„_P-9N¹Kú°Ïò×7¿¢ñKg¡{–ŠË^V!t“iNî£³ÂÜ¦X¸žÙƒ ò.=Œ/ð[ØxÓšaj ùkª¦…¸“x7†Øv¬ûÂ‡ˆ[×9‡RÜ9ä[éF¥Ú•OŠ÷k~NOIgÈPÓ*Nu•âÄ£ÜC&ðÛêk¡M˜\«”¥)ÿøˆÕvÆ^Gëm<R6F%û€•bsÄ„â¥&•"óÑ™gg#Êóü|ÆäçR+È²3á´·ÜºÅÍ ¾*“[“0ðÈz²"xþjîÕ’•ÉÜ.ìÝxf™ÌFc‡lÅ`¯»ÓÏºý
*ÀfÖÃ4“‰Œë¹aòsO‰„U Ç1òóR‘<jòÈnÕq‚i¼’ôú á[*ªG™ûÄ­‡jk~ûÎ\6Úbp”s7ÇÉëþ—¸WkÕ½µ9D_Aõ¸}»y"c«~­•äM[Iid·ê8ÃWRe‰w¶’…<öWRÆ·ýZ+ÉAcµ•”Fv«ŽÓµ’Až;ÏF·ñ›ÍƒÝ_6O:»mHxZúA„èd}=tv·ßîmoîÿzt¼ÛÞì±Ž:q÷‚ „8™WWï÷Úw´#“ýäNÂùãŸƒ]w¶
•äëmsî‰$x£DÖ§
[¿qC”#NtÝÌ<8Zî{ v¤)!rÂÆð|Œ.4òÚ¤Ç¶aÏ±ÿ)£UHztU²˜Íá0J{Ø¹xgëá%}Ìa²µ_‘Ó°@¾¹¼ü+§+ä§‚¹_ÈcN5zèqzè1zq»¯“SÞÝAGç±Ü­ ‡’-Ðmâq@/óPNªÒ­ ž{¦Z´/}eŠ=ú§ã>å™'T‰`D”Ù‡ºÞ«M4¾ð½O2·Þ}í‰†qÜÓ,ó7¾ß™žûÌ±ySb™œô2Ásíú2 kyœSÏÏCÌÿŠ‡”×Ž®‡u·ƒ#h¢çe ña1œÚk­GMxB†ñ7vWá—9f˜B°®O[I3OU;/Žun¬¯²¦žú0p)Þƒ‹§J¶žlfK+]Ú€Ëóë0Çë¤sÑÏÈ™ðtõ!‰Ä|ÖÑëÑ#àh§|º˜:>«Œ·
‚DÖ$¯¡<±¥:‹ÀÜ3rIÖÏÛÿ¤‚´‚°`ñW£®ñÙâ½Ê}äA{e$×b9¬&nÇJÝ=·õšzø?¿èÎ&ûL‘l¼œÛ 2‘/€58>ééŸÀZI„Ûà'º3ì¤@”¨SýÔ„™¬•©¶bSÎ5ÑJ%ÊRBãà`¹ÁÔ’Â‰:Áa±V
0{w¦’‘„KGåá¹ãJ:AxœîžËž‹rè}%o³Ù½mëWÈ¿V¸zÉYƒ¼Ž~H£‚áñÓÛ‘Î1ƒçæ—£wm²ó®óÙ<9Ù{sx°{Ø!£Í_îXû)<y Áe2LdœwìXjñ0Y'¨€Y’eöÁI­!D½k[R
bCx!¡“˜>½!²s‘g-1ƒRŠ–÷Î™P•üýoÿî Ê¹wWã4Â¬m')D÷ýùªw‡Hžö é?ü»÷U¸Éa<X'yõ˜ü´°Vò&ìy-ÊG-ë3,ž±lfBüé.]˜/¼,l*ô‡ý)…¸ÓÑ˜ú£û!Å*vöeÐ=­'p†UõÜ›í¨kÌ÷håx²q¾ß¿UØìæ…™g9ÂœaGÅÅ"…à¼£CËÔ*ÆX×1Ö4hÎWò–ëóÄêH¯kc³JÝ¼‘+uV™™üeé!=b¯çƒÇoñÍËI
0<Š<éWHãS†yëclM+ÊD%\9œWi´H#´SÃ‘³xè,WS¶RÖÆ±´V×Ø†¤ýP…î7®Ñc“ÂŽw1–\u¯£%Ôaã)iÔ¿‚ûp"W‚Pœ£àŠ»¢X¨§uñfkÊ¸:•Df³èë&y±²¡–Âô,¨
ï=Jª˜“ïáS’¼&¯ˆ;kž“ÎæáÎÖ/ðoçÝIÀ
t^<±#'ª±×RÌõ	XpÎnHHÞÒ›0B7#R+tÃ:•ûžÌ!Ÿ,H<t#4W.u;ss}¬1¯Ò#ƒ(ÄGºªíÈ‰!µöÞv½™WJãKÀ§ÿƒ»ós|Z"˜–$%˜¡‡w”1ìÝR¢WNÏ¹sÜP½TøT…òË¸ÙÒ¬y
<™OÁcùWUƒüò¬IÅ*â9õ_3J¡ûjùjˆ‡½}gÈ¯±ÚÿNâ(¥*: –µæ_£ˆJ (MŒ˜e¼Ý`ä§V›ê‰lXsûöŽêºñ''HŸ[Êƒ8² =‚Ø¯!„~Ë“ö¢?]0¾ñ3ÒE¹­'Tœ¾\xå1óc,åK¬àÐ\5›MWS4ÅÍÏ^ý/WqzãÚþô ¹€Lzz’Ä¢<’Þ@-n²Ä&vá<OŒð„À…É3;3hüHF)ËA½
Ra÷*[—+8$WcLOÄÚcÖÙQø*}˜ìq¾zQ4™:Ã«¤Á5ù°H¹Ýâ”å\öpöÕ°(euŸ.Â<˜‚F[sóCÝ,NPÒ/îÁØØ BùÏ*e€úËg™A%å|éaÙÒ®JYìJKo€Ê¼…W`1ÍòGëT«™UÞ#îlå³Øå1¤ùÛ#ÕATÑ&¥[¤8ˆè‘)×u¿­ŸÂˆ‡r*ÙÏPÊÞÊùp1O/ÆðJè<ƒó:	¸“@ž-ë{ƒ½3JÁnd¦H¶&Hn§XhÂ^Á—Ùn¤ž\{c—ŠËÀ:@›?Â{öœâAÈúøÏ.Cëò29a`]F—!õÊì6ËÕæo%ì?8óÛì|çº[ë-¤¶Ý®»0—Å Ð¬´>
fùÎ]È«æqHæqzKð0ZÓ£åF+dã¸{AÉ(xp=ìw¹_KÝGb¸Ô:›A+”ÆP‚6xHm¼]Ø£ÃyßïÅ	<Ô/Ãï\&zãuß–`f)lÞ´ß~Fp¯Ò?#ºï°¾`ÇHâ/ šBïÙØÃüxþ-7%Àˆ÷zpB@Iñ“x\û ¶×+¨G.ºü¹%>KÏ>‹i‡óóf+¡ECW-ú|hò–[ÅºÇÖ#mðÍ‹(«áµîžVÖüÜxÐÐö?¸Y*DgàîÒÎvH,á„ÿßÀïíELR^/'˜©A’æms}Œ\_$·®ÊïÊPÔ3BÅŸWÅ0Äªiã(`ULDþpú1µ´1µÔ1µîiLÖ£C]g3\AÆÚàâË8½||ùGuˆò·•Fé9'ä±¾4&¶˜6ÔÑU:ˆ™äŸÔJ_zÇéæÛAÎ,ÉÄ…[Í>U‹á²'Um·ê›Ý˜­FLÎPð„®…›½µ>¯¡¾ÞüGÎDõÕÐñ‚÷Kó9Uùë&ªF,¢Ì
•Ú>K$¾s˜ïÊUMU«Ä”Ònž VN)àí´ˆSì6y28Š iŸLI^Ê÷Ã1Z|%«ÂW¢†ýÃ^þqÅCM-c©AØaJM¦Ë1 	tJQEÅû)_6Ø+:GÒ3‡ cª4}ŸGv<]) °´º˜åS­úöCˆkì$‡³›“—ÊƒÃ+Ç>m° TÀ±Oy«' ;š)áŸ£Ý˜	óQÁ%‘?r¦Hnƒ¢Aàb‚a?Ã’¨+—Â5áú½Í»ï‹ü{ÁíÁ-Ù/IÉºÛ¤üeá¹..ò~Ã¤¨ô3Nö“ë8Ý¦çU­Þì»ƒ«^LeårŸòuªÐ÷•Wˆ¸¾ 4Ã´ý„)Ny§H`\@õ§&JIHÎaG¥fˆ5ÂYhÁÝ3ÂçûÍ±ÅÅ6Sðí²5VÓŽ$±Cð>Â?ÜM’_™_ëêæ«<8¯èÏF¶Êþ‘¾¯6HJé•‡\èÉŠ¦÷Tø|yJgZ•'M1xë½¬7æ¶mWp€VX4
@ÅceÃåmk"Áä´ Rˆ‰UÂQŠð¾COYUˆrƒkÂù]èIQE°â÷Fœ‰û½‘§Bhò–(Òü8¬:v˜Ê2}Ø@¦W (.³s”aúVêÆD]¥=J\y%ÙÔðÈ*¡‘Å5‘„púá#¯¼ø”?ÚKÕ[ž+zÝ_«yÚ†=©<éüÍU° {yý|%ƒE8¥KóÜ!ð˜9÷…)þÆIs€PªÑ‚Õ'ó`ª¿ÝT ú©T<Ëü ¥.Â’tX‚èÂFÉW}*¼|¥SókRI'ÁöMžý•4bÑ^8ÃaFÉrÃÿT}ò«›
xÖ=R‚”d‚õFµppI•µ¤™ð0s¿º{KûôëóË » GåŽ•¬H('²×Ëo_ÈÑ!$cI8®V™<Gc[á²µâ¬˜®µ[÷$$[]ƒÖÂÆf¯‡š]4àÙÉ G‘¤ãJySÕ4
Þ§ÒŠTL<c3&ŸHÕ¢FR4ª1¿^XÌC lg;¬ÀÚEr9W¤F?M]h„#ãÎ§…R~'›»>‚æ}Þ :Ð0ûyx;mÜ/OIX&ïY^ñîáPr'äíÑþT†;>:Ú·ž¾|8f¼²ˆ+RèQ9TƒLñCJ;½ë‘Jpz¤„t·uÙPÙ€â^ž!ñR¼2b»©
ŠÆ?²™]ë¹}nZw1 ¿ší·²ÝÑÞï'õZkÿZçsí±´æ÷¹¬¤uÖ1·üäµxÎb8¬=8ÏÔeÕøvQŒQaÆ|×§+á^Þù${™<Å?’úÕO,e«=ue«zŒ×Ùd!>mÐm³i²1BS”Âœx~O.ãÅ±VäB±¦OjËóKòãIÈ´y×q’ ")Ù8»²ø­=	ÐEBS1y~ÑiYA®‰vWåç¨?ˆÎq;…qµœV(þ#ËhLgCÉ#¯£‚zóÛ^Ó“–6Á% Acº¹j¬{¥2üúè&OXÕ
G¨úO¤ÅÁÚÝ@íkþsÊL¢ì-¼‹¥‘é¶Hãó~†s!d$-á±—G«3,.æ$fÔ2=ÌšAY‡‰ 6ÑšhÛ7”êHÆ<Èl}šŒ•;À½õ©Š—=éãš~ÿ$–¨%Î:ös‡û6åÇHà²WzŸ~Wp°#¸PxƒnŸÎ<O_¯<¿Áº#óZ²í¥ïž­(_™‹…;0×CÝ£Õ›shNg‡©ê²No›É	Z*¿*Lè¯’öYîµ"Él®+Ùnrg.Oõ*zk,ÒÚóP@ƒÕ²¦¢¦šÿ¥êä»ª9‚³2¹ÓÕjäŸ®Mõ…ÑL¦•rZ2Ô«6U4™áíÿÛLõ 	š[*Ž§ÂRU¹Õá±,]{T`ZOá"ªb&¸¸ 8)Áº\ ±Ò'rØ¬‰ÁýL]Ô<2`U¿×pŸrö»ìSÂQfmì6¶ßn¶ßì2õŠìlž¼Ý:Úlï(¶ÑI†Ìê˜ö»;QvqØ¥2a%nŒˆO¢2Õ%O
…r…Q¾# å­h92ºµÖ`;3€Ÿææ4 ?•’“;ÛÚÙžåv¶/ƒð¤	}pW @<;¿ ç2¹n<‡<)lC³(œ®R6–êÝˆ?Ó÷Ëx½‘Z<#Qí}T¹²÷ÑûJÜåY1ÿÖX5‰\a\ÊR´œòÖ±U2c9âä«Üb«P8ô9¬Ÿ·p¨½¤«=Í;0ªÊNõâ¢e‡÷t‚êhñT!ZØ°Øfˆ8^,_´¬c	sëK	Î‚ D¢atŽElC²jñ¬ÈPÌ+T/è©‰Ö²lÔ¹l‰\âÈ qf YÂs)‹cžÝÚ»÷cú-€àÐ(ÕƒjÿiÐï¶9Á%ÎÆf«šÅ’6EâNvÎÒ÷“”ü@uH³JÈ1« úÃ—@Ž3B(Ž3"v„ØëñÐl’Ýc…&<RAœF5kÁÖ4]Ü8ë!=6'À‹§ÐB;ù¦›\Žözè¥¶Ú·J€7v»³ãkÚæK¢bàø\}¹õp›I³½j²¡Ú[§£Ö¤˜¨ß`ÊÇ›ý£­Í}”IØPá[õÆz öƒü.Œ/£ˆ'Áwa²ºÂø¥vàDÇ”íŸÇéAv^;ÝìvcJ÷;ñ°¥Ks8ØŽTÂ³84WæyKò6Ú) «I½¿jÂ¯ˆ/­Œé¶Þ<]"‹qš&©;ýŸ™å>yë/Y<fÕØÔÓAé¦´;MmM©šàF˜Ð8:&’Œƒ¤CäŒÒFËŒdG2QW=äùÚg¨HìS4ÈXZâ##m—¿ù÷/eª¥7uÍUvw½Ž6Ü®;èE2BÄ4†v1ú'?¡@¹,&’*Å]¤"ª³–¬z5<ƒOÖaúÅÖ$Ð—¢ìfØ%îÐQàæ!gAwÜà@çùCˆ!g¾¯“èºÖuïnèV´ä:d2Q±=“°ï8ùÈ8¡¯‘&P,¤GOÄãÂm($t£uÉUô¢qù·àH~³ïórZö©JFZz L”¿Ï]­
(€Â<U$ 3Šâ«á(‚¬„¤È#'ÌGÝôújí84°,Ø ö:’ÛšM‚4	g4Æ®¢Á M°"F`:+o³G¶¯U™ ÞòþëÐ_bPd—‡åUvùµ ¦šv/Î€¶i.®¢l¶<(›6ú˜e³*uX¤"°&[@ÄÒäèÓt.Ù¤ä›3s7&ž}q9iv«5ÌÈ_èŠˆåE‹Áæ¢š|……µK©ãÛ!;l¥DTê;nÕÒŽg¯ÝdüRûV×ÅxM†­¨l\4…R°‘ J¶¾qã ë?1G?]!šã»¥:¾Ÿp0qWD±¥@ÄZHUzk°ƒ'……ŽËf
ÞÂVq£k."r¶ï\zãHÎ´žÌ±ÉÚéï:I¦¨ocr÷`7³ÚÅt’—Éaþgm¯½|ØvFƒ‡Ï±,ªHSmSŒá¿÷ |hñ°½øQJ¹W=d~j»Sñ›Q%€¯¯Møþ~f ¦‹ÝI#ÚyLj'íåÎ¼ÖZ iM»ÐWš¥Ö[–š/µ0y(Õçtt¾Òi×º½ÑP¾ºtbAÑ!®×óYdã×šÐ`’P2ØÜ"'»û»Û£¶×Ù†"—×KGVAŸ-1Á6ÁÔ€¼Üïv¢3®o“™DRoUÇ5Ä²âþ(dÌü]¹ÃÅd$.£0kâ§12,Åb¶ ÒK©BÀ$”2Hbá?¹‘uÑHÉÆfe.7Tä2ä>«•¨1q‘Ò–óí
’y/XÕ¢êÅw$ 2}Ä$¿Ï÷@G•Ò%8‰²³)znÈ)9Ü\2GCŸÜ	Ä!_âô» 1í•¾2CÃ~lrÓ9(%Æï@¬º˜Jd8?Ò~ÄÁÜÔïÈø«|Äuœ²w®D[ø=¹vq”¢¢a¬QýÖ.ý­®“6$ÇRÆ{ô®Ý!í£“ÎnYœ8E4™4ËËäm<	%<ý‚Dyª“ä½H GœHýÉ3§Íy<)R¯“ôdŒÉKRËè¿ôÈßë½ZçhÞ_QžAjîMÔîÑ¸’ú ¾õ¦¿æ9B·y9­Áî¹Àê'ýfÓPøHƒ)ßu[rÝ–Ò\õ<h*®A&óWM„æ'¬>xÝµïè}¬J1LmœÖÄ
¨/Ž’]°Ã7AÛŠÑ°Ûb*Í}ùªX=UBòŠ¬d{j±+•Ø”Uc«­îJq5%¶ÚŠãÞò7¨”Óúâd -˜Õ wA~è+–+×tq‡P»’=ãÓ·˜‡¢© þÙQ‹að3TÚx}µL¥·8‚ªcE ¦a[Óš¨é
­›[Hä„ž}=È-ÆA»²1Ã3-¸=íOÆPT[•¬lî$}_IµÐ¢jjYµÉiÜ<o²…2Ö5"$«¾ì¬<ž„nÓäÞƒ±z+h•Š«m«T)­þßì$×Ã€è5v›¿Å7ŒgìÂÒ-ºãÁØEÞÄ”Z°Ì—öÚ€N†W]t‡a‰çö$"­a˜‘?ÑÄ¤¿mÖFqÐëN×í´¯é^ek”»ÁL–81G°ÿà\Š1^5E”•ï]7ÖžÉl]9EéžwoM°¾†Fw9¡ ¦(ê#€Ù¨}:"˜†ä*‘†Jn0/ÑÓù*iõÇ7Wìø¦¯ÈJ_ÛµÀÞ
rwBÓÓ,~ø2:Õq±¦zçêÜ–èïÿçÏ´Dó.Ú^9;y

QÊu“[Ç¹û¦ŽëcÊF…¥Îƒû&§ôåf’„<"Çƒ«©À}˜ø/W›œz€~wG‰~P€ñ£±Ø"Ä¬»ÝX<`9Ô+’ÕÔ´ ë…p%×}º,ŒmbÝâYju÷úšÛÌ*fJ$Žã>*tÛtMIUŠí†äZÍsÃ°h|¢­H1&HšO@$h}DüÔ±ˆ”k.†¥Oø(Üo^˜r½ óDÚðEóÂ|zÙÎ%C	ÍòwPkÎX\r©\àñ£k4.Yv™œ€;Ÿñu‚áZäS?Í\Ê.{Aº%ÇkñC³ÙÌ›ùØ„Ÿjµh‰œˆ7ÜØŽ(3zi	»Š‚´"-j‡¼"-ÊÒWÝtÂÆpæÃYðÎ¦75²A4Ø„8)7¤FäÕ¨±U¿ózN^>Âk:éö]mIŸÞºòÏôŸÒ’çöRÒÿã}[]ÚF¬â/ßRúä?ó?ysÎÉ‹·ƒ{ìÃA4¾h~$IZë“eµÅ:íïªÒŸ4ÚO0§T_ÌÉ‡þGw±DB4£õz1+¾'sÓõºx·ï~O–Y“E"F½“¼îC®[’Æ5þúž£U¥¬æè*»zÒuàÊÙ8£4þ‡ü[€.k½bþßþ{€°|*z%Ü%Z•LžK0|s[|L ¹pC¢nšdÐ)sõq52oJS½ª(‡Ë\÷#Ê;$KRMu<8L¹Ã¤f^üä‘¿ÝÒ•=\Óš-‡Þá7pLO,?6gŽþ|¢[«y³¼|:?_Žˆ5pøt@#BpÂÜ.oŽ-è¨!î§'3jaC[ÒZá/¬{¡éK=Ìš~çÀ[°–lðÀÀO4Oñ­8øj‡{c¹ÜîÀd†Û‚‹;üàRs §“‹~Lgk¶ƒÉKH;*š&D%ME@¡©xwA+÷F).$×9B°{Cªcù+ÛV¨±€Ñ¶™…Ãùõ1”œÀâ©X¯àøDñë`{/½k3ë(bŽ)Á ë<8wù“f0îàœ²×AC3Zÿ6ÈjÚbˆ].£	¸_R{PåG3±Ù§1cA#†M8[…]¹1w'¦ª#€iâŒzñEýˆrn£?\!&Uü£oåíµ?ÜøÓó;·ô“8¤2P%;r¨á.w¸¦*XrÝ£~zY[|Ýö³ªÊÑa‚~‘¤dsŸiH–ÂíQJ€2^(Ë|µX÷aFä—Næªÿ1m®oh.á
Àr’Çâæwjä04¤Keó<Ä%ÉF ~Ïëu­Cær¡~ùöª_IŸïxÝj<\²-™‘´¾€ñqJÌ‘M™äa1\•îÐ¼ìÖãqžªøUî’£$eˆîÛœ:?Ÿƒ_MÏW·/âîoÛý´«ãôUõðsÖð*~b*9ÍÃ“âõœe÷Ûëþ¸“üŒgbíÑ§âƒ“ïÈ) 9ØùÝ¯mêH—^Â³‹Ê×…{YRM|`äZf#F…fs5é–:¸Ÿ.WqRt£´—
_B2ú™R,cnvòw’K´{ SQ>—I¥ù‡¦#^§r&ûÁÈáèù7^ñÕ·%üº™õ‹mŒé3Û8»8A±É)Ã§@ãÒãÉyŒÂ6<¿²šA _"Ê†³!³—$¥¡Ó€2cpk5­Ò¼ƒ¥îJÁÍª@äÃa¦p>5_ó?úG?äj`Óº#Ó”ÀoúóUïn	ê¿5Uÿ-ÿ-_ÿã˜eˆ¡·5l&7­i M_ç)zv>®¬î6uú¾ß‹:C UáÎe¢7>kY5a?`E#çZeMµ†kVnoù5øaRÞœ58yøPy­rµ´ékx•LR”ï ×Ñà¬Ïy]ßàªUþ$ŽèÁná*è ¤Vpuµy©Š½Ó$ÛZ1býûá.äk"ÎáëòÙ`‹ù[\½‹Je‡ZpMelÈ/“Ñá”+eY6=<.(íêËó˜³ÝœŸ×¨Â~Ý‡ÝI¨hÐeåèÈª™^Ag$¢ÃRÒ¬I»Doƒ}ƒkžÛ4òKäÈªDqÈ—l¢ ²CòI°˜…q8"AXèÏ|´ýÐw™Kƒ|IóË _¡eeüæ“Êkõc¥á£¼ '4ÿ*¡áSÂÙúÊ
ÁÓà7×ä—!Ì6Ò†Í7rÉp£mIÕzƒd.o¸ cŽ~ÕbeÇ®Ñ¸³VÉ¸óDwVJ€V)/¢r­x±´RÜªÏYÃqË.®L±Tåæ<KŽùmLÕÂ”Æ%ãS•29!¾¸8³øšp0Ó°f‡Ï	åÊûd¤­r?žË%ö|¡ÔÖˆ–<„R/bmÊ¡â2:´ôçIÁ4ÊÔ¢ U¤¼‘ùÑ\xEV·“”Û~È~ü9†Ér˜Xë¼‹¶ËH¦ky6ï3c|Ôs->Êb¬é×ÈÂTBþ·æ°‹Â6–3:D/yKÉÄA%bŠ×½r’d=Ãšù—œý¼€ÉÏ«+«„²ìÕ§þ§yª3lA|ÓÃ+ÀÌ>ä{ò£»ÂFqU¨µQ\LÚ¢c¨Ps£¸2f¿”Ç-ä¿0‰/¯úñeœ‹Ýðü)^G(Dƒ"Õ¨Â!_ƒ¤N¨ˆÇMH6¢T\;F£u}MÖó¢'·T ûóÉÑa“!ÀÐXƒWÃøU¡áfýNÐ IpùÎ€Ã¬¥<WJxn=Ÿ!áÙ“ÎvÊÛPÖ µÂR\À$ŽÎ¡W×5lRÛn×½Ã‘ÒhYbjŸê<bžùØÍDU-ƒA†žTR¦ÜÒËrÜ`)zjNƒ1EG¢y¾P«„.Uœ‚/dó*<ÁUl]U;1”EŠ²Ñ8'—RÍá™Â 99°¤¦»Î”|å€ ùÜ½ý?1Ê¬‘[çÂdáÅøT©0•|!W’W]|€· GYÊà½BY–?°FôpO6ì
cl<¿²Ês7Î<÷~ÊÂ“”Û„°ñP“G´<³ÕP´d˜ø\¦Q&]ód~Es¡ßŠ'f˜7_‰X×¨\Ü­û+2ÏH*ÚiMU\J}´ÜHþx"–­(eN¢Lçšõ½š.t{Hè:bâÂÉ²Â"Þù²Lc4-Ú,M>œšzöCæ>ÈPªH¹Ã±ˆ
²'¯eñe…Y4F6]ÈÒeiX–ýÊd,ÆË·1–º°°Ñhäå@‹'†¯:›|Mh™5…Y×¥PÊ0™G®2—ÊUæðC˜¸þ?iG×Juã—KUãë¤Aäªíaƒ­0Wö€k¹={…;õ>¿.£©#­u¢¯<h"Õ5aâQ)}bJ½¦™(k6o•„ÇGÍK!Á‘Ëá¿¢ôÉw«˜°üöÔ’båùŸw§’°ö’á|M…¤ÿøm«$…’oAêß–:¢2î{WGØ´Ý2r·K2«*¢Müƒ*rçªˆ:ãóPG
ý;UF¾wÕcMS=ZªÇ7§z´îDõh=¨ÅûM¥z´¾QÕ£U¨­;V=ZªGÈp~?ªGë»P=ZÕ£õm«­¯¤z´îPõ¸³%™§êÑzP=îYõhÍOõh=¨¾öîLõx²N­úGuýC©X?›
²=º²b™«ÖÙœw,–š=/Ä€ò½j"Êl~súH‰”/îL7QzyÐPB†ó5#,Â7­¤”È^<Q¢ÿoJa1qûÖZ”¼Ýå^ÖhFÆ¸jÌ]«1¦iŸƒ.Sbò«½;Óhž®7¸ÍƒrS]¹]¥£A<Ý†­E»q/Üœuœi^úŸ%Y½‘&î{ÕnÄ<~sšBâÃi4¢‡m&d8_Q›)a­}ÓšŒJæÅ‚HôþMi0:?¿oíEÌÜh.w¾.3j-¥ÙÐXîZcÑ§|ÚŠÂ´4W{•4•™nñk;eå/WÑ ?¾!{ÃUe)oñh5ºr1B˜Ž¬£(2•!¶j„!,áà?Á¸ˆú_¼uNÄ³@JnéS%¤ÕÇ×\ÚQ£Çz] žÄÃ>òeks'Ø\'´9ú…»Ä_ø¹“¸Ü5dÍgõ­q{XZ2~­5|[¯éåj ;›[}ÕÞ}½ÛÞÝ%;{íÝíÎQû—IÓÙîv¢3†`Ë…M(¸hÒàlPÏH4ìS¶7>E½˜²ÍÀ¨Nâ(í^Èk\Yku7»­ÀXç¦ñD¹- n}EÞÈFfà}`i< îsL8¤]\7þdCEzÁßßV.K	ÑY–®Æ1ÄŸàP'#¦Í››uÁùÁ…H!>BN7Gå$Ê-– cè°½·ME'[K^¨ËšùËUœÞØNÐ„üÈOÖTÔÊXæ'¦€•	J=Ž©,™G¨JòŠOÆ<1Æe³ó¥0 Þ5…ä¢«±×m{(–ŒmI`#W¬xpŠ\)ó*}©¼@AvV`UšŒƒ…@ÖTXoæ–´VöÚ{m*•íÁ€†ØF4¨ØÈ!mä9œîùúü	<\³âÃúpî¤yÏã…ì7jm;ª©9©±ÿ1©•“X&ÛXæÙ·ÖÓÃS5X"xîVT‰s÷ì¨¦¾Y¡G/lH:õÑppJŠ¦ß\™Q¸Uwú)m5IoH1[g—pÌÒ v~Ð¿YíÏ E<óÅÉ3Æ8ð2cEú¡Ä[ôòÅø"ŽzV‡Ï³•ÀjŽŠâd*à*+9NâýXÅ°oá/ÈÃYÕ}^,/¦oÏVØxTšš­%áÌÒ–0ÂŸ­)¨ËJÀ`6[39çŒ³=ŠÑ®3ëxý¥ýó¨hÜ˜qú«•ìàIº-ì›æ,éÝÈc¡Û—î‚ÆáäææâŠ{ý«KW­ÃÜ{àxyEËvÛ^™# ÍŸ\O LôÜÜÔ'ûÉuœnÓM\«K:º"Ô«wA¡ù`‹6»Òæ¶xoå–²©:tÛk¥é„%k$iš©ä”oób3Š¥ƒE’oÇ›|™òMÁBƒ˜ô0û,È3“5Ã£’¼"µGåBNø¦úOJu'°¹[ªDI}zfŸCžÊÔüÃÒjä )WK·®8á&ßÆµZ´DÎPŠÝ‚P°ñvr	øÛµ3ñCÝÙ«¶U÷›•)ï“MÉÒ‘"`Áº%|ûÁœÇ=í œ6CÑg™éK@}S{×çä‚þ_/Ìc‘ÔíÀÖùhÎô¶PvÐÓE2N€ÊOœýËsßž*®,í¾Ì;¹,Œ_*‚ppI¼`ÿ$gÿJ…ÝFˆJ]­d#»„.u|Óx®Ð]ø8¡¥qzœúÝ›—Ã¤‘†GWÒÏã#HÜÌÆÉè8¥Ã;G©ªVÿgPw‡P{Ç0ÑïÒAÏ¹áW˜œZ1·ôŽÀZ^áü‚s/”œ$¶Ü½ˆÒÍqm%$Ÿ!(è%8ì…Twz<Ei,ªùœÑÃó7¨‚UrxX“^sÎ5¦&Lò¸%ÿÛð>¬Òoh¬PP±®åqÏÂW>­5³gQ÷}Cö	NÙø\XAx1Ã2ÎXOÌÄxâÿt“¬“’·5ˆ*‚éÇðº`UG P_[F*˜÷«'ìÕUhÃ9¾ú]îˆ bvUƒ÷Lb­,ÀÞS(Ÿ^cÌð¢š@CC²æŽåâ¸àùr.%‹þ}£ÄÞðpBò`§‚™T‰·©I3¹røLåR=SDÓ˜í®•¢h¦0.›4›¡Y¾æ½ò;:‘D¥ÚßËQT×ý£ŸA0t§â‡sè+CZƒ*øÂ†úy–†5´KÚ´öÍüo•oÍÐ¸!¿kaÃðå]h™à€Q¾˜¥ià*{Ãl„n9Ú²ò9¼áßÁÉVQ¬ZM1sU±Æª·ø\‚Ãð¨è{MV)³›ýÃUîÿàgµ‘Üÿu£õÄO?^Ë×ïJˆÊ˜OQÈQ‡ôE¿©K£)‘{”‘hxó=S½Y–âsòMŠS!»êÄ) ê…ø/©PžÞ‹Ò^}æ»·M9îÞ6©å‚ÈÞ°A·¥ÖYšíìPd‡Ô
!*ÌžS*˜¥Õí“-*7lÑW¿Åéç~a<[ÉŒsðfó`÷×ƒÍ“În{aã”D]ÀYÞwûíáÞöæþ¯GÇ»íÍÎQ[ÈŽèà£J²M©ƒ÷{íÎ;Ú<!_ØxßOÇà­,ß±Ø¤Dhû¡¶4ŠÓS°ß£ò?=TöpÃÒjz(ðvã[òÓA=°,¾ŸçgÄ’#&nCGlnÏU=ÎÍû¥-õ`mlv¶ß’w_ÈÉöÛÝwû»mwösÅw/âÞÕ Nçž€P5©àé”I”.Ò1|?CŽe/Ö|2w]fCr¶×q~1OŸ!-Ê–µ€~q»$ÇÒ“XP×åÆ GÃx@Är»¶Ð‹å‹5Ë/£ÒV¦œVuá]ŽÁÕ‘Gº‰Ô†ôOïM˜Ð@Æ”2dx)EõÈç8¥‹"Ø§A¿;n$ŸÈy©lDèÈ»¿eÍË£ŠñýŽròZùx›€˜W2¾Æi]ge«åX‡hÙï­“SÜœ¿>žìÐ-Ó&×µ:Ž¬°BÄëü_}ßìmmî/ÚŸŠØéÁãÉ¥:¾Œgi‘?’Õ•UwÏW)äå¢Æ¾êèÂã2z8Ó{b.8:)TäYe¯ûÃë8„£	ð‘¢›8j¢múd«?$›—QÏó uÒG€ÿD:?í8nOãžÒÍöEB_îç¸ï~†÷p²»¿yøæ¨íé$C/ÜÏ7XoÑr¯UGÐõŽTíÐrIáG[3 Vhô™y•
I¶_Üì‡’öÃ÷g6H˜Ë&ßÉ‘h¸¹è”ð-2}Ùƒ¬«üÈ« à—¥ùÑzbˆ¿ò_·ØÀ] ËyJ€Po9üŽW™áX¶'Šá»ÆˆÌNdH\¶½/–ÙYU-žµ¼MeæŒ@*aP |ÎÉÍ<Ñz‚€à°b³r°ü‘1üÝ¦¸)!j7Ž5£\]¡K"$,¯­K}ïàšeÆ–]K¢ŽJ[¾ª|Óg„-vü-ŒÊÒ›ÎF©Zœ‰,”ÈgDgt» '=‹Ïéy™±ÞáÈf;Ve¹6ŽépôÛ#ŸJt’øm -JÈºV°½¢Î1Üç ^ám³0Á‹Û+´ÞªÖz+´uŽ»Úú8×;…ÀÛÃJí@ + ' ·´¾‰MLX#Û  ­³ d,b"=(§É³x@B¥ÞñEL¹ÕeŒù®`BÛSZ”˜È)Ë~ä|©¼q‘	D™¦R;_â%iý–¤Ù^*æåc—¿•$ƒ8ÖJ6üÁÊlsâ`3 ÐÇ¤„û[Å¶ƒš¹dÃ@n|¡ðê3Z(¼3ø¾–/s¯joü½3KOvºáÑàŽ¤6`%hÀ:Ö‚ªÃó·@±,”I7ÛS:×ãæŒ*¨GÂ¬’¢âgÌ©‚“Ñ™7;0SÙVnŒýTÜxxj¶El_ð‡é•T
[•­«ÆØ¿ #_c®Ãx‘Ã¬?HqÂ`%ÖÏGœ«AÁa©™B‰±#V°°ajRIÞv¨ÓF¸mr^Ts•CŽ>¬|De–k—aáÚ¥¼âjØn…>e].¡ÅK•û˜U—K¹F¬»7©€tŒB5•J¦_²ûå€Ê=.ì=Ö6pÖÇu¼U­ÂV&È#eU®8Yä Ù9$i«W`I9:.<4NŽ+"ã ,®RL\XT\¸™?8 7üé^xÔDU¹ê¹áP<•¸ÎÃ‚ö(ÉRaF	æ†ÏåXîü®5ÊÍàOWÕÜ›Y e_lât¼ÝO»z
¸ •åBÿ9J‡”Ž×åy’îIw‹¬™æ¿ÒmT3N=œ‡Ý–=¾XráUCáuÑä»ïláPÓ™ÓÂÎÁmôµÃD(U®®àE¹õúûÖrù
´œË——!sU©àÉ$žÄ»fæ´2—÷ØÊgÃYj ;Õ7 š¨™QT9™@4¬ÊÿÆýñ€¶ËÞ†Ù‘|['²‹Vk¨ô°ÕÌ©Þ5¨AnM.G1‰$Í*¢ž§”á? ûetþ©ZW|l1Ç"ÏÅ£†î~É0m€Y_[ñ¢y˜‡RÕ—(ÚÑÙ¼¬žÂ›§-‰œÜ…@eË£F‰š³[ûïv3oàQÐR^ÐÆTR ?³÷¢'$Ö&ªÅå6èp‘«î{¹H3÷eæÇÔÂF{wç®YqçÝÙs;×œ–8•›H¹§…ûùŸW—=éãœKŸr¨»ðãÉ;ó¥
MÐQIÈäò,H:+rHm»íKÅ,¹jQ-!ª#4^{*³ÇœLêˆg0~Ì(ŽUœ¼X”jmb9hª…„Š­2»DeÀÎ–¨¸
^¶€!ªfÅð!b— ®E{…XM¿m#Ì®j‹˜ëåGO«vHÉÅhW¿æ¥9C¿…CJòÃ)õõN)FÆ«gTé®ïìŒj}õ3ªõíQ­‡3êwsFU«øþpFñ{æ}FÉvûùSŠS­œø]žU¦ ­oà¼2ûáÌújg–FÓ'—~×W8¹¤Z˜ó9¸ŒåB¿âÑ¥‡~~Ç–>ä‡#ë«Y³Tyû:³¦¾aºX†¯ï3kê“urÜÞ;ìÈî9>jwÜÙ§ñ—Q’Î¿ìÕCÖéTY§Ç);fJ:Û<sw/SÀòïï:ét©ŠŒàu°¦F"¥ÀòD†T1N®R(·E%«3z>ÄôJQÚ£ô{–&QÎïxŠlÓ™|¹îè›à˜›ëþ’qg¡få[Vne)"B’9î[W2=§´=‰=Z±>Ï\H	¢æ<Äå.×™ÉO0õ˜ûâà+§ÿïÿþÿNþðxAÖÂà¿jù£|×ÙÜýéç£Ã#²ývóàxïèðäíÞñâ-iX }p$cOÿë¿Ht^'jw Eqq’üWò>^•nù_ò{Ü½4/g+T~´Bb†”æÈ+gªIUE¾­j‚·XojÂ@©ô¥Ê€/>R	ø”|Àïãl—/.ßvûñ”@éä ê§ÿ2ük¨9NÞ—a>·ð-Œ†ŠP‹‚¡yñÏ<Ù©¾þ/ÃSòG¨TÓž‡È^¯öJLv!ž2øcm“™úo×U0"¸^÷±¤VL'ù'éû|þ`3<–ÅÇÓ<xö_†‹~¬wÚŒq~ŠÊSº°æ£2Œ>÷ÏŠ†´?B†Ö¼Né¹Ú¡g\
iØŽÈ)áÛÉ¨O´Ÿ/¢q¶9‘­œ?ò“r¶óî¹“ÂƒùÎ=&†9LEöBçÈ„Ùáå(øœafa½Â8Œé·ÊÕÔŽ…Ä„òÚ]TRQ¾œ‰÷,¨ŽšœnÊ ƒô9[Nß5N•Î@"·8-iÜ””¬"t5Îj[•E`cæy¨34ƒ”YF—8T.ÛØrÆË#1r(0£QŠÙJg7yotûr@2Rkïm×g–±K!oJŒÑ5“™Úõ§³OÏþYÅKãrcó¶ÔÜX%éI®@DY¢êù°®ê®,W_kÍ6 Žº1mSLXXà¨Y¦‚>š-íÌ’}¾BL9¸¼îJ^¡oÝ5žÀ7ò²B¢•§¬æ¢›9:°.¼ëŽÙhæée4ÙÛýX~¹â¤•ÌDö)ÐžÊ™bl
ßœç!õsyw†äº³4›áñ"Ÿø°ñøJFæc*°òú¾ð ì¨ƒ Â“Á	Ýd/'Ooµ¹kûö•…®þ8ô»ˆy“óºÜãÐn|`‹8ïô‡&–µÁ gR¥/,WGÀ¼A•ÁÊpØL"˜¥Q-›(OÇÈ'ŒËå„4”ðÆœ:·Ô³’JƒÍÖ‰¥IU5ø»íK+ÑÐI }ƒ7iV&í ·Ø Hó¦ñ$™Æ5;¤©õwÙÕJêIgópgsÿèp—l½kw
ëäÞI§½·õ®C,²u´ÙÞ!µý½÷»¤óœêÅ]Çû›¿Ô½v’uS_Ñ)…ò:Ó€vúøäK*MžœrIã2úÒ¸âYù|ý1G#'ŸúãNò3äé©¾XˆÞy]®³Å"‰òfž­àn.\_#~wãÉâ­î;ÕŽ2tÉ%#È"§É€lEiI—/½Gå’èô¯4D õêµÑ5÷ÕÇ‚sè}%ûÌ“òBŠŸ
˜2ªÜ-ÞêSê‰1!”¦¦4‚g®Ð¬p,ô0ûÐÿHFLBÎ1€ä@éà2©|öûCÊNÊoã?R·¾7xJÇù”+ºÒa
–rzk²[Ù¶ºå(	ô…1:¹N£‘Í€ã	DÝß4”€ÂTh¨ÀÇö¬ÝX’o°ÑÕ ³—¼Ç#†Ÿ*ìØ±Øuf¼0 #“’ÖŒõo›Z_Pä…·ŸÓþÙXR+¾¤•Õ¼¸Xu)ÓÞÎa³s«Ò+þÍö•´úU¬xÜ<eÞ>s°å½X¾X5¾±Éz¶jPœ-;…;lÃlpÛºp '`J¥RŽÙývo#YÎ$aÖåßÿöþ›:É¸€µÏì<çBlnZã†ƒy'·CØ"…+Ëãq›ú¨žöå#½´ú½®*yý3¬˜@Ãd´ÛºÄ>í[R`œ	Ý?Cæ¸GMÙíP™“î{$—Ðzë×¶<l”.YUz“°dƒ}xóôºn<yÎºyjqkð>Ôý&°âµ’6eÉàj°_AVv2‹GÉQªÊWœJ)GÅGÈ©¼ÙlšŸÉcìPVfÏüå*NoÌšK):êÖèÖÔ°M‹4m å€
9£”ƒæs-Çyâ(MÓ`\ˆòœØMÅ<Dø0ÎÎâb]1ÞòÀR`ÈI”(Q¤!	CFŽË±‚ýmÚA®~H{”¡q¾î	gþäüœŠ°[lzŒÛÑBSžÌ×…XQ{$ÉFSt"FSF_³ ¤yÅ3QEÇ8ÃÒ€-«FE¥Üa.„^‰ŽmPôëø˜;¾Kì25Eu/Ã·vH“èN®û`p†*¼Ö¹ÀBt4@ ÝÑ`ÜËzý“‹h[(wd<
÷£ºuß€[°53Þ©K¡tTëd•S&
 0N:6þÕóâCr§‡7>ÌFçcÜ,ÐÜ	6ç¦êùÆôÍi˜NW\Å‚b¶Ê÷á~VÌ]Æ}ªÓõÿ-n9¹oH—ùÅAô¥ÂF=@×î¸yâ†‡0½TúÒÆ¹¸û…R|ÅHM¼öTt|Jª!£÷IAs‰Ù	£‰Yb@åøO,Pv—«afýO¤VÃR{QF@ž×™Ý2íwAo»ÊâôUiÙÏýñEm‘êð¿.ÖëÖHÊéÕ ‘(»À .kI¨†#Á°Þ™¬ˆ#`ê$WîÂºe÷†vÐâ 9ï­Í˜8˜ŸÞ§‰F{:ÏxçË^ ï'çGWãðP4FØxêÒµþ}Iã3	yˆp1G¯Qm±IÔ<S‚F±8“<k¬Ãz2}ð¾ÙŒW;v¦o,lp§×ÛÍ+aÖ°ÃpÅ]9·Ôse.É`p¥LË1¨Æ©L¶¸¤GKdµ?ø)dö¿ºâÜE “Ue´¨Df÷`¬sŸž899…Ã¿j’Ji•”µÉ÷ª¶#¯/èÌ2ÏÌ0AkƒEr'$-YÄ€Y]s&i^6Y¾,Í»Áò>1·lî-fÓ4?¤ˆ¨>¹ 2ôæ€…fƒm26Õ!ÄÚF
v³œ•Wõ,’­Ú¼‚j^g9Œ¸'*÷SÇø^ÐÄv2ÈjÊ»ææB)¼ÐBlö(3uPCofó·D¶lÕV&½4w1²r'â°ÀßÍBÎ…U²f1¢íJ©À8:CÉCñ¢<úD.¡#Â=p¦
ì6!ÙoAB“ÄbªmÐ7C;É}7«æÞô1_ç­i;où;oÙ;W+#ù;/Jò
àcÿ†û4Ä>¥‚’ Z&´qJîøËzšõ¢©Î5– ƒvl	b‚Xë:Á2Š\ÂÊÞ?Å7ð{>ÆŸÖ‹ Gƒ$Í]rfÿdîâ^$·¦\,i *A*}ÿyUt®Tu’zÏ1†e ciâ«ª#ii#i©#iÝéH¬t*©³™I.m¥IAÊ/é@óÆæ!Jy„ïíˆm¤PÖ ããŸÔáI_ZFg:¼Ñôî8zCDLQ¾iš˜ØiÔëÓÝÓ'3ò)M.EŸû‘,¼%â5”FW€LÁ1Pê’ÇµšOó™¢ö•)Z¦˜«k@—üÚ™1úÙŠÐEÊƒ?ãaPÎc¦a8Sf‡ú`hL©ŒMv™‡û´ Ü§¥ÐB«0°)À¡8cå äš,¸‘7Ó=~5Vˆ	ÒõÚ‹ÎC?l…?k@IÂ²Åz@^õ€ÒcE´‡ìQÌ…M™>½U²=l™Ubv$ñ0 ³Ã¶c*§†«þãŠ‡,ZÃ³ÊÖ•¦ -ÂLÆžâ!!¼Xµôfó¨¬6¡ø~žjR™:Ëò˜ž›ÃŸJ¥éðø.ÐïodÏ[q¼¥kÝÉ, ™>-ðsÚÉµÿÝ~åg>PÓå˜®E*ýjÍ}ÌN
	’©pœÿîŽ|3srë…~bbi?c‰'/IÉYÞ¤
ùe­ÎBe0ú–¶ïß’ô&n+aièK)cé*™™÷á+“éëÃÑ½Z&ëÜ“„g£¼ƒKè;dÂ*W4)ÌcÈXHÉdªmÙ-eÅUh¸H ‚ÝüÅ®Û8õyï“Mqp*Ë¡!p,€mþÁß©X“AØ-=¯š+«}…¤áOÁ£€óíéŠ.Jqïû2·ö…u®˜!r”·Ò‹²‹¸§tDåmßÄí„ÅåMÌ
Œðºì×&8ìéLerj‰–y®`ö¨RÍ÷Ãã	ÎÃ´¸&üôôÆM[Y´òDYùo`î£qœ^»ÑØB­M‹º÷ù$QZ:°ªLÃ›Ê³Ãfƒý+¾Ø\CÛždf%HM™e1½"û¤Å²F.×Ù—ŽkJŠ<®ÐáÏ¸ñe%ó„»ÃÕEb³ø$Ù^]É-c¥jãOuj«MDPIN¸Â²!±Iw‘#9Ø<Oæ,"‘ÃÇP›´J½QÏ]“ áÛ3!†`hd5r°ès×!ÈÎ:)óå‹*e–]Þc›&ÉbÑåOI‡	Ÿ¡å#–lVì Ú9µÐÓª=±ÄüC©½W›¯ó·~!ËäÝáæÉÉÞ›ÃÝ<«ð„¼=ÚßÙ;|CŽŽöyòa	ù²fŽëá ¸bºÜ^Ê~/ô˜œarŽÜõHMFÖÝrF‚>Glˆl qï¢6ÏnèÕA+#-Kà/ôÈ¦êÕsÝ†r³Øæ~ù«YW”u«ò£¼ÝÔ«þµÎçÒ£ÝýÕ@B%­Íª©y¡“,öå5<	¬Í¹)7<ÉŽeêJÆÔ±MmÆÜÑYcÍj9cIhýySò%È	xrÑ=ÐÒíjÅOá6WqÖ²‡1ùÇnóy—Åi¦Ž,]ø_®óÒmQÕ ­tÃhl98·k0SYÌ‘ä§@žÃEÞÒÉ[òq’ð\lìN_Duú­kº&£ç¥žK	ƒvÛ‚µ³MXþ>Gý¤Õ;- î·w[¢ ncÂ>7$ºŽúˆ~‹Á9]´Õ¤	•/bHðl’ãAÄ‘Æ—óGÿ¿pDò‡£4ŽšŽ—² …ÍÄ¾MÎG…¦è¥ç
¸‰q¢¹”,•ö•}<†º¾Oì„™¢Ø°­³úŠ,BäTŸ÷3|i	y%¥%îåQLô–dÈCpÙzŸgA YÓ:vÈ32è®½ 8	ð.TÂ ËcÐ´"ØY–Ô®ÆÌ³~é')‘J²†/J#”àåU´ñL?›rÞ¨à®­I£žÂ»
«k%À6nò_y[É.Kö& hn¨Á¥<[QŠªWE.Œ*VŽŠ,C…}úÝ(I.³(h3ÁÕ†}iº®ñÉs*AÐÌ¯q•Á˜Ì3
Ÿ^æÓ­Â;·*,8ÂŽZž€]|+ÏÄ’]P8ÅÔ~ÒVVÐ4‰Ûz­
Îñf{÷°Cöwv÷:¿“mª‹Ú‘mF0‹=:å—ÃþØ ks¬Þð:I/•öó_Xõí—í‹[óÝ , Ý-wî'ÈÒÍükËQ÷Biš~VïíÂWqörÂÿP-Ž_NŠ¿Õ{DVÉË‰øS¾cÙ±Dï¶ö÷¶Éû½ÝŸý«suFE÷ýø¦Àdð -03ïŸ(É‡B‹e”Œoãýq×˜„GJe¡ƒ†ë–°¤TYsa³Ò4üß
º’Uôæ˜#~Š¥ßË‡šY{0hÙ¥	«™Ã–p?áäÖ Ã+gÐÿ  ÿÿì}ÛzÛF¶æý<EE‰¨Þ"E[m;CS”Íiš¢“îö—Ù†HˆD$Ø eYÑ§çØ2÷³_lÖªP ê’rG¸°E²P(T­ZµŽÿÒÑZv–¬¯™üœ¥aä’¢½Dâ$CnP˜’ž&ðèD0~´yOôëc©ùú¼õBj==›†·Î¹:Ú|„LÌïLQÌ›'Î{QÚE–”ÃàvËZz³ìˆÉ%‚˜]Â_JCÒ¾J8ÕR»3…srûÀqŸ¯½¦¹*Š¥¨ÝÍè1—å¬è
Ö8éðeD¢>Ì¤¬æ`S}HhPÈƒ˜„k“åa?¡²†>ªK?ŒnÔUj4ÊªN¾×0?
CB¿äpHÔT@$Èœ6I÷p“D˜·{}iƒ$agéB$çÅ[WI"èAÖ‘ÒTúì¼™…õ$WÌ­ŒQ"i„ŠÁ©3>+ Ð [ˆ¦¼ vüð]Î,¯Ðº>tUë-&Ã Tve(9;°ZIˆÿþ/æ°`ŠòËÂ·|æ¸‘ã<Ç°62S±ÔÕŠ¹„
²Î‡eÄ­äVšŽlí4Êñ>‰%ÒŠ]ã ‘ËvÝÂ¶¤°!…ÛTf«Sw‘?D­›)­UÅi*fÒE5³t„-OÄœã9z3-$áK#v5¢—êêh”SHaØN‹%¦ˆÙR@N<]{Ý=4ÃwÛ{hÍÇ •¹ ‘ÛûB8ñ­¾ïM–íè0ø$,¹tî@¤_¶ÃŸ(Zý®¤»zwJd(“*LêŽÀéŽ€é»M+B•†É¡%wf±ã
ðïYÑŒ›B˜äÂ!]m­`i1ÉŒnÙÖH`Ã”Öõ[„Þ¶ZYñy\Å³yÜÕfd0Ž"jÈE§ø¬[$$—¤Õ9b®u! -ñ‹iO<õ‰QdnŒ0°ô#Vü’º—>·£¡	éµüW,õ«ÍÙÃšJeSƒ­“ÿ÷‰C Ø]vËÇüÁFŒ_Ùà°z–ÜŒÊô&Q…ïE¨¶pH@OÞÈ§åì§>|88ãÕôM5¤y›-Ð¡ÃvÒ+È4TV…ª?Ð7ãG~½;ý¡ûÉu8_6ÞÊüú&¬z½Õ[‹<¯EœWKX¶À+­ýûåú©Ó¶¨Î¶ÏZíw¤ÕwÜéw$›øaëâ‹Ç:9;lKºî]2ŽnR[w
=t½0ÏéJ+|¦™X ‹Ô›ä×ú¾C<	j– t	Ô0ã2¼ŽQ´+ØiYñÚ–4š£ ÅJ¯aôP£~ï3ûk\ÿðbçÓøçR¢*7	¬œ”Àmd6}ÜŽl³Y¡%J'êÓdád†‡¯éáÌœÄ^ŽJj÷B2›Óg xmd’°ÛJ?RÄ§R›~X@:ÔÇUÅpWÏÃÑÅó†Ú¨bAd†fÌEûtÇ’tËšà‰Õ‘6Nö¹·þÔ1°ž“Pæ/É&{EÐK½°>@ ½oÅÁ¯·˜IÏ›ÔfÇòÜ	/ƒ1ŒØÍÀaaôî&¬vê/u¶“²ÕäBÏíjW^˜¨[ÎÆ–öP¡õú°¼ws¡ÌB¦Ã]*Z_“÷w·] 6Áè,óŒ­½AýÅ…©¥Üô–™(÷¡Ñ\_òRœa°xƒ1ßÉQgáÆK• ÖðtDM)¢Ï«WP³‚˜ìmX°9ô¨}7Øè‘b&3¼ghï(?ØÔ‡Ë3/8Dï-EI×=wBðñTé]ê…1iqRD`P:B1jç·P¥JÀC~Â®°`TÓ…gsaÊSÕYLËW•M¦­Ã%ªÞÏ¿ _¼ÌEÏ”tyQ[?Ê}ø†Î2
áïg!#[~¯ësÏ½ižúMá©ªyã!âyÊ€Þr3Y¾Qln8QªÔH´ zs¥À¼]K^×[î¤("4:y„ŸÉúX5è‰Ç¶éBÎ¤Ÿ5^åmˆiIÝÅâ¢wÒX…B€7·p8ˆ»ŒíÝÁ­–
}RG20<”¼h¯¹h˜»;µp¢û,ÌH22’ÑŽIÂþrÄ##0¹ÐO›‹Œ>HANUR©GJˆòÇå=Á0°¥©¨=ö¿´ƒxPôuH´$	t";9¹‹?t"›\¨âc š,¦Ò…dZ"ZŸÅò‘P>àã*I'PpdìžðrYÂi… /Y'‘Ù~Ò•ýÔåÈ’®/Æº$3ü}ýˆê|–l1³q3BÑ¿÷‹–ŽY}ß@¾iú³ÀwÁìŽE¢vÅcŽ¤¯jûØ_Úö‘
‹Òò&‚î|ž£êÒ¥©”•e§ÊJAIé]ã=spRv®Î„ðú²þ“Dƒl£ƒœ!N|ß—[ã=ãPìú4ô¶Ž¡?Ÿ}[ÂT´ Œ„‹®@#˜Ý"©ýz×06j;¡|ßÃ˜'&›l¢ž<jnŒ}æÝÿóŸy½¼çÏÆ"Ô‹®‡õ„ü4¡µ5›a(Pß}ØCI£ëYƒOEBn‚0„öp¬`¾)üÿh’I(Z-¦ŒtÊa&}‚~ã¹¦Ì–sÐêy41*•ö15êFžRTÆð¶0„i4‡'úB=gŠ ö6‰>›Š˜ò©,äiA—ÒšÄÅ:º"Ã÷qÊ/lž¹QŒ‚)ùÒ3XXjlø²þC>þ{¾«¡hÑÒÄtPÅ ÑwT±f?¢q‚ÿ¤Ogƒ»ñ(ñ÷q«¼"þtý÷½.>(šÂü×>Âš‹ÅØz{Œ9 º	KA3ÝqPz‹ÐVHAü#A#Œè(‰	 öÿ}(÷ÞwÒ‘€rZñÉ·êz‚×3˜Ü+YLËú=zÓé¿ÿh˜@(÷xÎr:.É ‡h´×á-Ò@QÙe”_ÞbÜ­­	ÌfÔvƒ2–O>‚Ë,|¤ø<EÈŠjrú¢ˆY4&õ„«CËÄe8­ðrÍ¥JP9SS¯ð¿|9Õ1É_SVø/Â\§`F-Ó›F;¼–®œa'dW–ÆQ[/Šmç¦›ª v1ìùô±ß fô‹‰‰KY1$•))î4Ž&5ŸˆHS‰BªÌ2)ˆXî™äË¦ñ²²€{’ÂÍTs =0™Æ)•ÎZ™k·5ó/]§öq<ŸÏ’ƒ­-o4nP.ñfhuŸlÁY0ü×çÕ·wÒYuÿˆë?A•šþb[e—…z„ºül¿Y¬JÃxi‘Š¯‚Œèî,GHBr\%-›m©e3Å\ÀRZU•×ÖA™EÄx³ðzQ³Œ WngbÑÏ^Ñª[M;Æ“=L¶-‰DÅÏT6ÈÚê§Ø”Íø›™Ùÿg,¿EeÑ–@˜#Ý8MLæfÞPvîvUŽ
“¹£"’7sQŠõ¦’‹`r¹TÇ¿Ì_´5t¬0zÿKb$•5tÖíw	´i¯Û‚iá³Ä]š×ÝÎt[U¦Å\ºa4¹>¼«lo«?Ì..ª«\‘¦©Qåñt}¸¥ò°K•‡ÄÍäò–¦$i³Øµ’” ^²x/JcO	ÒËdôZ*'õCsV}Æ6Xš(ál^ÕGÃáA¤(ÌžZvìRˆ€jœ³4·F¶v¦Ü'-â`¶,ªâ¿„-¶è§iâÑÉQÌBØO#æ«¦Ø@|gÄþ Â
ZW8Õêè&ã0è¿5Dù‚‡c$hçó†C2õoÄS’Ô&È,t Ì%sóÃÌøF|MKÊ%/ÀšÜSHê±æ>ˆŽMI>Y+§džš­ðo§©ãY´þ‚|Ð¥Pëvš´eNc1õ‘&Øl‘Î'ØD‹÷taÍ}1Ý/e¼¯½Îì€-šÀíÔ«);ma_yçL{pºžã¥Ù6v¨C…Æ³•X”©Áƒ™ìVa0v³§¦âÔRÌƒ8©ó M±ÿ~+’op
æÁ €—bþ“i¸_°§Óg´‹Ë©T »r¢Cl;gCÉ]WL®n-ªzªµ*ÙMú'Xb}¨…öu÷ð€ˆÜ-çgÙrP¤–+ž°‰?®'…$™äŠçj”;%Y8l²J8fHÙÄ¥*&“á¹ù“Ò¡
…¸¬q‹Î=	µW•Úo–c~L±RUžÆJHdñ5ûÀ\ŸãXO]wÖ¹Ä’>dV‡Ay_œœsÅ¢l@k³…—v@{Í_N³ë†UÏ‡ëh†—¯¢ƒ‰¦7ð2´éñË’‚k³¿ˆì„ÖJf‰ˆ6<9ò¥JÜSì´ôM2Gõä?R(B­ja«ç þšªNÕ«5¥+l†zùr§¼^vn}]ÁÉ‚Ÿë‹n>\MÒÎriª•  ý8zŠ²Ë½BÅ[`/,änÍ_fçk*v:9_ó—äŠý˜ÉÅW(Ëþ×œŒüÍGglþª¸‰‹Û8ç5¤TRÚ„_Í¶[¼k«ß£xnÂR/ê‚Ê±xß;Î9¾«õ[°•~àÅÀ‚žáB•w?½k[tòîãü¥>´¾ã¦ÖwüØiü%ÊXÒ€<Œ£MC˜ÄU>êå‰¼š×ºÐÃ4þ²Â8‰ðÔ?»©/ë)¢/:“>F‡v 5Q£dLÆçŠØÂªõQT$)F˜[¢hî”¯Ÿ"7Î‹FäbT¾ê’Cz¾ÖúRÎ×/Á}òRVçq4fä<¨˜žÒr<ñ‚›~k¸	æcj€ãbQnh@<¿X¢uQDe+‡ø¤Å¨“eÒªÛa|=}âô8&S¨:÷1ƒ÷@ºìžvì¾o“öÙÉ9¢zJ°íN¯ß=ê¶[ýEWîôÔøeS,µ²ø ¨/ì¨ô±óÇúÐƒ¨(—÷AP?
Æ£Îï–#™LP 4ßîw‚¢±?é|*ÊC±2ÎG)“Ù­™Që€#<Và˜¸`ðß	cæa~ÐŽ;ƒáŠ$1Y¾¦ÀÔ¶­'X¼
°urŽì‚úëåIæ%÷Üö™S­˜ó*DþÿBÐ`óÃØŽ£žšZë Î|òÊA…K³†;kÜ9…oY!:6Èf“aw›’Ý”N(è<ö¤Z¶¡…A¤“²öúL$çÞe"ø‰å\¹‚‡©x@AvJõáf3?¤DÎÅs‹®È–MaÌ¼ÔMÿ,IATƒ\_:8—çŠ/Í 'þÜs £>ÄÇ}“^ØBosÂªþ®ÉýT®6{Ê~S_^FíÊ[{Ý{“ÆnŒƒ-!‡0A˜èÕ3‡Àô¼Ù”Øê Ïÿå&š#"8?[zØ³ô”£áÂáÍ®}Ä(=„;uOsÜnÒ‚¥rŸ‚­„2`êÃ¯lÆl×^ÿˆÐû|‘#¸Ñ)6Îòku¶<•ÌR¸²Ã¾5­¥µR²€ÕÑh(,î€v·äøDÌÔJG'V1@7°ÒÑåãLc¬È4¶0ÌsÞŒ¢;½Š8fš§Om(œžsi%+ãšúXAKôëâûÔ;_dÉü¬‡£•ïN¿Û?ë‘Zû]÷øpëNµN@ï]82å©pËÿÿl(`k¤’}\ì#Ôtñ'‰Ræq„U.•7½Èñ
\¡£SÄz\‚ éPO{Ý69*Ô6¼`°²Á1ðdÒq+(/\á8ó`Òë§[­õ{bi-a5Û¦Î«šŽž?‹}²@ñCÀ…¡.Ž¥lqEV$Â¿öÃkÜm‘·ï[½Ãnë”´ÏNº½“V¿{vúÛóŸt¾aDÖý~¦
õé*¹Q:pdK7æîêXTf%qa”k.a=ÄØåG­lü ¶ÍAº&§×÷pS~>Ž¦.tâÚ_‡zOôå{
›¶XßÃÊ¬sÂún‡Àm“‡›ú‡)Y²ôð_nœ !óN€‹ëÉÄ‹Ë±ñ´™jS€áÉÌ/°ì%XõÚëÌûÒëwZrñþä¤Õû‡Ž+óqº›Ôç†#922³nÒÐû±û—·dèÃ¸(,ò4pëO~–s§ì$HhÚÆMn9VË\òY|}®^Pºù÷ÃNŒ,Œž$×áŒPãÛÔÀÄAò¢ÂLûFJ}À÷¯(3OÞ$þg2£xBrU¢‰7õF>ýóxåQÿãMoaIGo†™´ŸãEó*pôu™_2µ¿À[ æ> é×™Ò\ãç« Á{¥ä¿,¤/í¨ b4y{s´9	Än†M·°h6WxŽ«P¥° eÄ_¨¯"1W«ŒJ‘öû-!Ðé·ºÇ:e‡³î%8„Ž,Ì¢á§áµ´ÇCfƒq:‚ºç)+]åº3*¶·Cê¥úŸ‚ï*j;ð8$¸#L10‹´Ó£ë!éÑ|ÂÕÙ òÈ²)WM7êRØÊwÐš $ƒb*u¥;Ì€]oLhÍe)ñ}ÒC%tî
×wöìÆë‚gXã•s£Æ=ô¡à/ƒÉHŸ.žÄƒWžc tòÂù«5	
“¶7 KIóÍ¼æ’+þ]þÁ›èa(Ë-â¥‰¡2ÅW!5ðrÑœ46ÙÁÎ–xkŠSÆ-«|~Áè¢•ùÿ5‘œáÔ<{G¡žF½"ÃhpMeZgye£¸¶ÞÐûóÖ7~ ržúñ»þÉ±[%G"°sùaœfî#¸"µÜX741â<S¤¦W¹Õõu)ìTO‡Ï€[t=ì¯‘Ž™—×>j7áËñ|#î\R`1&TÊÂ•ý¢u¢·*q›»Ýüj:Žý«Wk"Šw0œ6þ•ý0ø]ùó­él²…#œÐA’ü¯ÆNcûl—dž~ß˜ÀìÀkd|8¯æ·¡ŸŒ}ßœôórË6/³,`?ÄüÎ³úsç
W¢¸üŽT\žïÌ‚wxW:‰0I*2=ÚÞÖ¤oïr4¼dU,d·ƒ8˜Ímû`FÞöÅÕõ”fs×ô¤^º™¼æÏøó~0ñ£ëyM~Žèg€!x5éØ$ èÚC[Íà°NÁË-sð+Ð a«êó”sì@¼—²­j¡Ëß™ƒ\JH{™ø_ÂÜ[,~RÈÞØwˆl¡q'~©ÁÀbèMª@]zu$ø#MzÔ°Ò„/€ä
+ŠÚ¶ú­7hvéüýüø¬§yåvÑÃË?F%»ý?n€ëWYÉîÐY™A4ÿbW—ªe—¾kçó,ŒbCÀ1¸:SùI­F…QÝÏà´Hê¬oE¾ƒsðº;£šqãÿ6©M<ŒˆP1¢v×=¹ð>ùÅÜ±ŒRÃÍæ&¹Œ£›ÄßDV7ƒQ2{+3Ó¦¦V`Åb9¢+’àXs˜ðR}y`lQ’>B'_ªŸJèäGqžï‹cXÝþðRFÅS®/7œSØÓœñÃ2kÇÌB ÈBn¡tZç2Ý—:·<«åïOUÕ¬*‡B®Ê¸“™Ïãþ)Œ#ím››*Æ_ÆýËCûírh?üŸ‹¦…¦äÌZPHÈ;G^ZàU°yÊvÀ{Tá<²­?Ü™Ã=n’n›L©÷v“`ðÆ–ÇÃeCÜ÷&ˆ©zŸ*@2 dˆg/œa„•"3¤¼[¸DEe£¥bñò³¯sÿjÙ_žBj\‰í¨ÕxÒ|Â”wŠp”%TP	Ð8ÎO?ev±úTûïÿRžGº¤ÚÒë(Y½e×*2B­'Lx›F7±7ËóXW-ê?Š½ÏuAÊ9°ÆX2ü(ÅŒ˜KŠ0³â¿Ñhy©--©Vþ9ˆ—,è.Ë¼ '|€ÎU:ŒòMž¨µ¥ '5þ +•ùoCI¸7,z'rÃ½jƒ¾¶2ªE\ÄY¤è³8‚Yô;ù® >.?Š¹2xXN†*ë¤­2neÚÊ×{…»WBa.Ôµ(e-FUP”ªº(Z÷Ådå€nÕFP#ô )ó™ó³¬r™^­#Â½cü'Ç9Q¼²ãÝ¾ïÁn*sÉx¸bG	ÜxWûh‡J\ÌÒ1¦o¢·Èrð\ŠŽKQ˜ /”˜ˆ.vcæq%3ŒÈIDu,åËQ*–„]]Ñã…i?BDÒ²ÒbòêC°šHµz·æˆ”md2r€J8*U°-×æfW
†Ê ÿev õêâh´‹EQ7qkõþŒ’EUóòy¿õ}3Ÿp)ì12è5–ÌëE;“$2²Þ˜iŠ:l˜á`xÓØH{@ë®‘TÑ(Fh^ÊàOÐ°XEBa¿Ú#uÆ˜¾/Î pö˜ô-‰ÚE›¡Õˆe*3‘“µÍ&\üÙ8‚hGÍ3‡Lˆ‹†Nˆ^­•®X€Ä?•š—U™q!.ÃÎ‘<ÀÐóŽ¬ý‘±åÇ±ŸG MÜ¾Z›Fuñ•ÃÝ™âsÏ…ßH@…8a<#ùØ¨³¢3QWžãÌ½Ãš˜EÅÏ85>k.øL\9Z‡9?ÿHÎÅãÎX†™?Í\eÂâ:Õˆs“`
G”PºPÓ€é4r=¥Îzªå=uIï+è¼Èß¢8Y{’·­(¦ãa<ÇÄ„n[§0e1‰La¢~e¾¤©gFl|ç±Ð2¨4GE3žÃ½0&Zâr£Rö kˆM”…¬ÏÞ(^°ââp‡Qy´˜±úÖÇHb·>F´m©ó[jX
Å¯(L†sLÅQA¥ !Îµ—¶¶Í»Ñè?PP²sÕ{
‘Í¤ûß.vÄ“C…R®su‡T¿ }XOFw§—ö,ùZ t“)×³!µ¾‚“¨ÑhäUM[È»†tªDOè,ýìr#š5OrìGÌQã½9¡nÂiØV®wì;t!iÞ0®3Á?‰ÐþJÃåS#lr=øIB#Þ¬Hã%¦Y0ˆÔm_|ßÌ¡"¢)±ì±ÈÐÙæ\ „CmÕuñø2Ø¨ºZIÄÊÔo¡‡ª+à¾š÷*9-ÈÊ'ß›üp%so•ºì¢ãâ9/e+Öµ3ÉcÌ?ä3¶wò«ŠmP¡M—“~Áâ°4+*•£LwX•¥µJ$Œ½ž3ndY6ûâ¦Ð¥Š·²Ë*1ÜR)‰´Z÷æi„©5çÌF…2ÙyÁU˜*†îxÌ‘£ÆªðWÔvã_ò€x=®{o:¼Œ>‹Œ1‰'F-}ò·d†Jgà*µ/ÍÕ×9é‹>M`VGpõÇþÄÑ[°µ'l5«lÉ…HmÁ[Ç£>9ovŽÈEç¸ÓF =sA—¹ÙXVta¤¾~è$EÑjJŸbÍÆ°ºòSø0—N-	ðq»eÈi¥hmhÓ¹Œs®
Ü’bÍ®ÃÄ×š*TQZH‹#Ò=E¾#Çðƒ9A˜?Šš¥‰-Òæ´Usx_äv³þ/çàšrTŒ!Ü&‹­1€öUÃæÃK½jª6›ºcR§k£÷l"…|iµâ9M½0øÕg'„”¾;‹â¹6@ÀƒËmPÃ[ø)o0`'‹›l’ÆáÍÇð7ú~€‡ÁDÞ²3L÷ÀþU™íˆ.<lêg å*ï‰)ž¬ô=ÍÙ‡'Êö?bZívç´¡,˜©ã/;:\5…Ì­°´õz¹æ©ðÜ>Nc]á )”TËH¨ýmþ]¼Äi¨tÓ9%9ëØâÝ€§·Ã²Î	×7µÍZ¡a‡5$‡Ñ¿¼éÈÐ~è'hßÇpdÜç ^üŽy`Š@Ï,Æ84›&cGWÞu83‚ÞþtD/Ckf†= ²¶pÛávgçðýóEû{Ð¯×Öôp¯ëÚ2“`8Å !ûžð–¤ûSÏaýÁ%&œº ¤Ÿ/3cÎó£&ý³Õ|¶÷ 36ˆƒ	0Eû„µYCrtßÚ§ëÕÐø-ßtäý‚þ°pëš¾£Îá÷‡ß?$Áýê;LÝ?An<÷€YVÛ¨7^<Óf†ô“I€y=	hQs×‰k=?Úwœ8ÞoÛëuž±‰ë|Ølé'NùýÏÌ[>7ûÉ-uU¨§|nt”W0Éb¢	5ì‘x	uã›l‰h&¡‡ø›Q'	nL§Öp£Áø˜'wY„"žÕwbš$šå¼ïfí¤à„5V#œÓmîtFŒFV_°{È¤{$µ‰þ7’LŸ“áº¹SVFµÒ%‰¥¹˜†‚L\£Ö—¼ÿ¨[ˆ…BÔj•>¾ZêTãs)tsˆ6‚Ý à	-.å›Ù«©•½ÄbŒíãÁ&p»ÏÆÍœ[ºuá–û¼·ƒ±¦4êõÚo®šýêîN é&< ØaVo÷2înÛÏ
gè‹rùXt„Êè»©Š2g•ï›$ˆ”¦u5š-•‚.JÄÎyÓjÿõmïìýé!iŸŸõHûýEÿì¤ûÏNÙB»Õ"Îæ—È™—ªqq=]VÏh#L}“)zýÈ”Ä¥S8_áêœSµSî¾=f‰r94Ûžž4~|1Eˆ1çøôA0 a³’hf Òû©(Ó§¢L®&w8ôðJDíØ÷&¹ûŸítÞ¸ÜßÁýÄÏÜÝ{pÿ—»/"8­Oàd•oï}´çt;=ÉÆÕÉ=lïl?Ûn¹ôÐöâKÞ„@¹:;;;8&Yl d³¼8†½°ig¡¬$Ge}Ø´,+åýBj«ä-*KPÖÄ}‰U˜…¦ü&ùk*Jeï–ÿÑAºÊ§ØJè£œ?Ù\@ù@-¨å©JcÎ†¸b±ª(ÝÐõÓ—”Òù¶ˆŒY3úu¡–8{5Œ¡z59‡ÝoÉRåè»‰ø€´zaÎ®¤á½|DÐ¾*r8—r¦µ ÒoêÏaýž+¶ü”¢—§°³	{ì­ÞÜËxÓøÓ÷Ñ¦'²‹%)RÑ×gÊss¼ÀG«JYÌsD‡”Ev©²ä„/PÄÚJpô?7?¹>MBéâ‘òAYš9ë½N«$49Q/7éle é¨ìû“î°F´´+†j©×±ØÊ<­QXøìÇNa	U)…1€6§%#€¾HäÂ¢ÿî9nýãì}Ÿ\ô{ïÛý÷½N%y¯¢¼O½µüç­v÷ô­ëé¼…Ë«“K-WQo@Í!ÄÎ’Åµq$]pÒ!ó ™—^—R´”·Â.ú•%:æRåc®­_ÂÌE¦úÄqŽg©–WÍhS‰qJ\Ïâé‘!È…»P~)*Îñ{’Þdâ’v–þUà£”®£ë„¼Á)´Y¬4lüEÊÅ0IzÈ}[S¶•S‚gë·Œ`·‚­€aEÞ`þ5nñjOÛ¡úvèc‘­­äF'ñ!6Ä»`4®óHÒ†¾6ƒó›>È¸!lÒ†ùpÿ©{Ø÷»;Úy¸Ðò'{ð+ìß‘îAJ£}÷ŽöŸ0À¥¶ŽÑ*C/V`g;˜Ñ·bÌ,}³'nfâf/”g;Ÿ»™ØsÛÞy”¼
ÿmNrNù´è öýé×GûÒ»=Qeêÿ)½¡ÿý&Òÿ›Èº¿x\…×ÁWÈ÷Ùk=‘}e²?Â‰{Šo6ÿ'éGFäËeU§¯ÕBmQ›ÌëÏÔÕm²eÕÖÑoÊ%"É•`s£ëZÌö‹¦
[ìX­XHtèûœ¯7•A½ë‚•l¦gÕzµf˜•“…jÓÞË§&†
ðU½îÛwi¾H÷ä¤Ó»èþØ!ç½ÎÝÎOä°Óþ«5{„£Š¸&‘pÖ¥PI°J|!µÄš b!4“a\³ÔI	Co”Ï5Hæ¶m~»µ×ÝÉó¶>ùäÿ9ýO£­Yî†|°ÃŠà·‰ntÏbôa'Qô"]7È4Ñz_hÀˆ¦´œÆéc#)@?ög¬§1ú˜Iû^XŸÿ›JÕ´NÎ€zÎAîôÈ›ÖáÛÙ"ÝCÒnõ*j•²¬
'Gßg/Ÿkõ
Ð?‹íŽ´X=2pNOºww•%µè¦ñ‡ Ð¾Ak\b4Â¥«£QŠ/•:¬Ì±É@F›ã‘bNóRMN©J<k”o·5÷‚TpãÀåNS–JÉ«Æg`èE¬Ì•jd¶£’úTû±Àžbáy¬gõÎ<< ý“^X]½ùâ…!VI•ŠQpý™ ºÝfO-îMæþÔP«‹FHQ,¥£:tôg°q
&VØj|r+ƒE9 B)Ð}˜S=b¢63i	^Õ¶‚A-³ Ñù—)míõ»Ö?»'äøýßNZ§ÚÄ]|¤˜fd¹˜à:ñ²ªŒšhI§5ç>ñÛ+.ïä–Ö,­2™.®6¼¬u;Æ[¤Qâfÿ÷ëÃàSH¼uskcŽ=.Ä«þïëiÅ°¡_àOób1ëÚøfm¼çá^ëNùúÞó_FÕ_JoW( 4Qî\€¡S‡ÍpÚ±Bÿ8Ñ‚fð¿Å´».³ÿ1™Àu”œ® ©¬I~¯‰¦ nÑnÒû÷K;Wd×^ÿÔe¡Þ=uáÂÒ»i~jýÁ/í „…)/y"ça5Õä©äzŒšÐÅ?.úÒ>;9?;Õ¤•jØlA™¦†êñ´²,Zfa„r¥“XiF$˜åbº€1¥#µì<TÎüÅÀ³.²)ìÜ b lå¦aÝnwH¯Ó:ìž¾]8ÚI‰¾÷}ãÙ>ù«±×ª¦Å(¨¹#’KŸDEÑ—þ¾Û”OäìTÈÆ®ª—2Ñ&”Ã ”ãÖè¸†P¬.L¼Šâ	‹E]õå‡Ørq\µ‡Þ¥Z9¥Ý!›cÔ”þ[Ú‹àór‹>Æy»9$vã<-¥(ðµx6á@ó;]»AŽL·wvµ=•a3í… 
 VÔÞB	3“hÌe ÔQž:†Âñ-ŠûI]=O¹¤}é%´§ûq4Òp½‰wÓMñÕÿÐ62À÷õ±òZ§ßÂzlÒ–|yÅ€’ä©3ã!á=s€DÂü±]!µ¼À[.×I-µ&LŒïÑìö/d§¹óŒœü£Þÿë!°ÿ·¤Ÿb\Ü&xª5HÕ˜ìûd_°øp²I†ÁËãyŸnÄñ=ñæq0î=õÅÀ‚y»i–B;a{äD‘šà#¾HÓ;˜
	s0¼0˜Kà’Øþr‹-ÆkyéÚg­ö;Ò9ìöÉyïì¨çœ~©yƒqgÌ9Ø×Â´³(Sa;—<rÂ.•+åÅ¹JyX$/õœ•­á6¸ •öW¬Òî\ÇMa«) )å5¤(BiKƒ-§#r­Æ=DEÒÕú‰ÜÑ†2wÎLN·P\Ç0—¹£Fš&]’bšÿ®˜cÅÌ‹xÉ_Y	·ˆç%d£²da-2LŠv •|Rìš×Q^Ôg’—¥0–@3ä•!ŸéÚê==“K4#]#g'µ¶7FpljBÓU†&¹Œ	X²$Å³b®Ž¶¼~çC‚5Ð‡j%²Buv=0E9K	ÕGê}Ê¿w1ÂÈÑ…ÝøFƒ´j-¾ôŒ3vpJÍÕÍð@lxìã^^$7)¥i—cñµà"¨E*}ì+ƒèè«XìÈ²0Øäiaæ|ŒÃ>¥eøÜW&,/íÈ²2´ÍÓÒ8.Mgâ!i‡ $®kããMåÕ¡}YV‡¶ùÝ®Îã9÷¹ù-X7ð>äÏ¤F…UÆ¥³¿ØéŸí4Þ±m³ñf¿Ãu52hKÌäœêäƒÒd¹:ÚP`ŸÑÙ,ØÑóz–\¢”ÙúÊ«¤W3*ùªp×µA`KVÆºwßä$¬Æ<&5¬¶G¾ÉðÊAóÕÕòòµð!›{d“tO¢$öÿ}`ù1cóã8ŠuX}4eEHÅw¥ÊÊ>}3?Qƒ“|È¤ýŸ´ðkY/r{Ü	;Q-îŽ­„£ZÝ3<ã¥[è™/­'’ùÐìP×=Á¤è±T¥ƒ_dyyÒQÞ¨ZJe¬ûÑf“îVðÃÌ"TwÈ4Ì”Î.ÈÊ±~‡¹ìx>”>Ýú¨èÕ÷šR4«;—*ÖGÖìÆ
¬l¯ˆR!´-;Ë%WŒîöê^ç¨ÓëtÌž=,ªæûÃ'¦*~òùo_£%ta8zý;ß:ÕMx²˜š,¦f+-ÓûRÖRVÝÄb.ÍWã®l¥ÿªš@K„Ù†EF­eêL¢åBUë®"­¨
xþŠë²ƒ%Œ=1#%ìFo‡ëåýµœßfqN{Ý6·÷¬Ì0Íì4O–iµ™ ËL¯Yïïå=í‡ UøUXZ½´'µxZÇ…Áš2>Ù"Ëºøò`7ÖÓD4zZ$ÇEêù‰!ÇÑ€æ8-·NRÆ¥’Ú=­–ãj˜~G•ò£?½öIímD¾#=jßÂœ¼¿žl¸/ß”2ÍâŠ‡WO4zZ:Ç¥{ãÁ,Ï±+ž§Êâ´xÓù¢„z™xÖ•âížËq±þzÅ×£€#Ê×‰y½?ÄXÉü"ñŽØýÆeÊµ,,”¨—ò›­—ì,ÒD1G3z®óÈì~B~:‰µ~TGÖÎ©“‹žðÒ..*vq
]œz¥0íå´b/]è¥‹æ¶i©«®¹«—[Œ,5µŸGÑ$ñüå©wä@í¹–OÔþDí…ï6ô"šL¢!ÓCzÜÁûÃäžëÉHî¹–¿{r?€Ì"R']rÀ(½8Æ÷&“[ÝL+ÑÚ?üdí5üÅ#oüŠ)‘èòwOlm/&çXr¤røœÂ:áÅ´+³u‚7z4¢ž„³þÈ…¾‹™?@EkÆ“†¤…Æì8%WàÝà½Æ•’Ú}“Éñ_8´8:¥85ª>ýC8JýÁxJÑzi]Ž9ž¦‡Õúi_¼½†ÿ$Q|ËýH¾¯ÖQ¯ÛF; »Ó:¬'¬©Á÷Õ:zÛ:éüçIë¢ßóõ-jé'^‚.ÜÚÛ“à?ñüÞYBÛ¨2oö»Ón»uüŸgç^«Ö“çñæÁ›Gð¬þÙòÏú±Ûë¿‡'ñ@‡µ×¢»TNø±Wù)Ùy¤±#–$X!*à‹G.æ×DÝÈ{½cI&*Ttùâ^r;Kx`ÁõK eÿŠü…0ÖËßÉöhøº`’lÌ£‹9VÓ¬mˆ€2
\¹.w!¬_rbÙ,S!ñ<ôi"<ŠSÁ”¢¥‰ÐCøÒ‡Éª#_± Ä!LÄ05¯ÈÌ‹ÿ(Œ¼y­0IxB%t–”cÁe
€HOk¼3:C¢ã—¤YaJX˜‹‡¼'fNÆD}R2T±âñu°i»Ó«H½yÅ	ô€(V”˜…$|¹< RÞê†¾Ò¶bƒ¨›ÇÙVž›ôNi©oò:+¯nvÉ÷RÚ±Ø\úæ|åîàß©oòdý+½-§•©oüE¶Ê¥7æluš‘ÙÊÈßjVˆðÙ
ñ/ÔÍ“LŠLï$KÕM÷Q¡&1ÒÀ¦›v@Ó¹(ÄÆ4ØŸ…pfÔ¶>ü¯þk«þÏfýÅÏ[#Øuëùz{Ê'ÌA
Sï”­-òžî)2
£K/”ÖT=Ot¼þg -`CÐÆœ¿-iÀŽÖ<<L¼ªoÀÊ	²ÙÐpärÒóu<¨ïóî1$¸—`MœÜh4¤®õõÃ¡]žiZÞkÞA^lY$<yÈÈ±?‚3K,‹X²	âÂ{e`I¶t¸f!0üZŒ«?ÀªáÑQc#AMŒDWªUXÌ~tÇ4O0/(>îQ¬dî”],f/›ìª<g¿!lÎiÝãâ ëjÐ£œ6T?_~#/Àp2Ø‹ˆXx‹HPž´§`øÕÃŸõÞ¶NiëÖáa¯Œ†O€­áð)úý)úýËG¿á¥6`%ÙyPÚ%K‡Â+ˆýß÷.ËˆÕJ 1%•æªëî”²uÿÌ®Î~,ãs•)[
ÿ£®­‘LU–C.ÇÁ‘Æ¸ŸAÑ%’§°ènÎT-ÞQÆ²ETÖÖðJ#cŠttÊÓ«j(KiˆZûêûÒûd¤-Ò\¦»­íf¹ûrñÅYÅLì=*\úháï^Íæô ä0õo'%àÀ¾&"hÇ>u¡ù7){Öå(­"+çÎºÃ`"kÅGWIåQ×©˜S
TØÿÚÊ¿N ©¢ Õ÷bÉUÅh™ 
Œ
BÒöÖa€öD°„/rˆô‚ôè©ÔÉ©Qm$×§¦ÕÇ@¨~üj;ÎXƒP"Éå-ÍcÞ$˜É²I¢˜¾@ÅÒuÌ]x	í2c6»öã[]…•oïBÕkñxû2¬o7Aÿ‘×ÄÍë'ÍîAn9·ž5+@Zº#sÄf”~‹‚1—Ûw›Å}Ã¤é„ëtDåžC.×ù¸,Ïq©–¹#Úª]šNÆ1¼Žr¿ó1S[ê¾øŽR²80CQúŽüíÚƒ«€Ùl-µ/aã‹ü~†7¯ßŠ?R5ÝéšQÞÕôîv1ãŒ÷	TzLË6SOlo•¥Z<4šúÎÙ9ánLG£ÆÎAu§íAÒ
Èö¶;Åª³²‘+‰&þÒ&.>|ãH˜'&7Žî!TÝ0ÝléWÉ,->¯üýæDÓ‹ëT§Né<.^¸ÄÂ#“ï¾LátúIíßè§rè‡.Ù} 6„+†¥ügŸõ«1)Äeœ&}ÁtçñµîÕ6}v!5ök#ô§#^ PëúËÅ¼˜e^þ\)WçEC×i¤%®hq*a"&·ÑuÌi¶a¤ž­²Ë°^÷ú©æÌ1[b¾™†DQdÖà5iR‚3´ô?¡ÌÂYiÂ{ïpÑ·—¥ñ&mŠM±a¢‡µ}i^¤òÂï°¢™Š±Û4·Œ…x™•Nlu=ÅeÖ0‹—6Rñ¢»NA6Þ+.*®êW·öágçe×=ñáYÑ3Mt9ñf²3oÃmtÖ6
‹ñ*à$ J«1£°REG½ÒZ—1Ùè±´-î>
¬P…Ì¡j“HÍ5]Å¥dBCÉ~]2%ÌyæJ®xÝ¼·OªïªÓcU^
¥?°ðG¶v¨¸ÚéÁÊÛM:ôyäh+qF>^¤IíÛ;;¿ßÐÖÍÆh.OœÒÈáó§†MÆ"š
(™RDË•øÃàÚ~»î^œÕµd#=®–Ð\£ˆ]†òË¬+9žN,_(Òy_ñp¶ñKGIÚý$äÿöÕ€}cU=5:7…VTõ¼´Ÿ^X4Gÿ•tŠ_LÉ7¯2-Óíäªx²ºîC£ÑÀ¿7Ó¹ôxQ™î’ÂŽ641íÅfŽïìr¦»4ÊŸ‡Y5@ZmFmšŽ2aÞS_¨˜îtRyÛ:Ît¾
zjLg_ì§²mVYwíNa…}~¯©èW²øÛhSEôìraýöJ_êÈk§Þ$˜CøaE$¼¤¥¯(¹L·³T„×4<”–B«(áå(Ñ¦Î-¤ à;uíõlè¹¯0¢òs„¯’a¢iÄŸEO¶*oîÚÔ½aõêžè³©ø‹¤ØúõÓ­Öz¥YPmoZ»H«/ÉIŽ¯¡?KU×%Ê›ð5EœÍé•¬LÙÅƒˆÌ\ ±Ûnsb“Ã¥ùää‚©brV½']•/‹PtoÔ?^j«¿:¾ß¨i:­ZR[NÑE¡DSð6U)õr;Sxè!ô¹ŸÆÔõ‡æÏª—æS§øp:¬ìÚÜ–o¨ÎÆÕ¥)œ5ª†Fmª¢'tVß/>¥Á{Å Åì,Ô9
Ç{Znï\\Kz)Š]+™EŒñ¡?]XNƒêö´#®Xü)|ºKÏ•[þ„c4õÚÄ‹Cë#fÙÊ“Kd¡WÐÎ§ÔU_µçòL$Á‰CÙRÙÌÒ¾ÌL¨0âV>1Šl¦ßÙ4•rÞV>G"i‹,Ò¬3Ð\>~›ûýžüõä#ê+¿ŸÉ£\˜YOVN_ LœHsË¦ò2ÅY«“ìF	3BÄ°ùú}6ÓFyàw°) Æêf_B˜àŠ	Ï˜ûmî<0Í9V`«­|ç²!9¡-9Gú˜/19¿í£¯¹öhfÁƒh+Y³«•$ÁhJÔ !4£¬?}¾€<OZ4Þ€{†£1ÀîZ‰ÄÐs9l¤1–ë‹òÅK´#5î •á™(û[ÕDÙÛâØ&ÊîG8Qv·bœõ|>$Ú‰ò‰‚yÂŸ¤E>¿ë4u?©ÊüPÍ1uýµ«²Îû‚£Ì¥Y!°Èà0{Ä
¶Ê¸iŠ6zË+ëç¤çRiÀÍŸæ
ï‚]–Ðëú.îeW/±"÷Îñd°­®b
LäòcZ‘vèƒðœšU“k6>š9éÒî›Ø›ezr¿Ý¤Æãb\øÌÿ-qä,ª‹Å#©ˆ›'P-ˆÙ¢Å3ao§Û?ÉÂ†r§ØäC›^öJÙMÓn1UÂ%*nç`›AÞ%}uMGO«!g³±ÿ÷™çÙÁTo[/ýüÑõ¢ÔÝ,Žˆ'ÍèI3zÒŒž4£Ç§Yïß «ÉúuÏó]´¢ŸÉdùÛWõ#¨º~&Ïúo²Hru¿%—‰Uó3,6xZžJËã\l®´>_g¹¹G·@ÕŠÎ9ì¢¯¨ìÜ£[¬ÊÅçÖë«+?÷èVmù"täV†îÑ-¡[1:‡Ýö•£{œ‹T¡(ãr}UeéÝ¢-PœŽüÑËÓ•í$•ì*u³HÑ®²Mm±²]¥~/Üe6µ<2ú_ \Žþÿ0ëžèÿë¡ÿE
Øé6À¦„Â‘±x»RgK”±û]‘^…rv.v¯± Ý£[³Êeít¼âQØnµÏÕ9;Wèè\¡“ó¡œ_Ö¹ùe›°{×
x/fîƒT	¯EãÇì ìÚŠxê"x% 6-Àéo•¯ŽÓÖÏ°Ü—¹rŽ¾dÅ5óÂ¢6Ì°4ÇÀ¿‡¡/On!LÔ43¾rNómªº‘¡8V_/EÎáu¥a"‹¹þKžt ¾Ë^vóÖ~SÜ?æu{÷‡ª>T8+J–r‚rìXÆ=\ùV?XBãÛjQÃ•}ÁüHå8‰oº£
ÓXhC`™œSÿÆ°~ûÊ@ÖHÉ„´î‹P8Y/ ô¦Õo¿#ç½îiŸ|G:??ëõ	þÓ:V—:‡CgÞ
CP†	å™að)óo\SˆÌp€Óü!
íK†vVY`ˆMæ²e†
E„.sE„@p€‡¯å:K@©ÛQ¤XtÖg%’TñîDÖã?Òî•Pºò«D¿Ýu Ÿ4ƒCÉE	ZYÎh%Õ…™B9ÛŽwÏƒd0½Ûµ×t¼¸W?Ï¢xNº‡„nEj§¥i×åâIt 3k‚:¬°zÝAX,›ê'ä&€sipcÆÉO°æƒÏ0FãzìÓŠÈQƒ)…«G‘ýüômÒx¹5[\ä®,Ì–ÙÓRuŸèüç$Óôb»M)öîò$…à›Ï-ZBÊ£d¹ò,ŒÝ¼‰†·Nå¢êÛŠ<”g1‰øàùŠáè€þÃÉŠçè³ÒÎ+Šá0žcD<÷¦~x@KÇÄQXÖ¡TLƒòfxäMýÃ.­Q‘¡È‰ØPUœ½¶è‹TCµ¼ð/²x5Oïš“ÊôF%‰YÑ¤Ò™"™ÌØØ»ª‡©¤L˜N^¾åÒ+Ÿ%æ÷×g%”Íht´¦yöÂÇÔšCn±‘U+²CÊì˜Šìd¸|ù!ë
í¤æWÍ¯¹j;úFÜH.¿>ÛGe<Ïnt­‚S¨òsJëøtiŸ6¯â£pÃ¢lPë/°fÎ.3-–Nb	ÐŒGWÉµ¥Ù14àoºG³eè zþX”f†N†eÍtÉÔÆÞ{¯Ré<ëCT^’©æój	ÆÑ0é…ÀÕ+_1!µ»V{·”£kSÿ8ë¼†¢ˆA4½rFÓø(^ã†Èä{EXCfcc#…·™G—|HóÚm‰MÌ	ŸâiÂ'6¿ÄA?¼fÿÙF¬ËËs0Áj¶à!HŽ	l‹¼ÁƒÑŸ?ºÙùŠa®v[òNÜ™üî¯|sò·tßŸÞÈãŸ}=jz”´O/9‰»oU~Gº[Åç×é__~Ïv>³ »¡Ñ†@1H$©Ù³wþgŠ>1<§×&$øÕ7A°4õf˜c Øýf³lB?ìä,¬ì”oØkÚJÊiÞ‹³£¢>ñ¦ ‡·D4³ÔÓ›VÙUV„;Åç§ÄjJ'—¦7CVta|ùÝfSB®Öt¥{ÂèB÷žÆLq}Â¡Êt­NjeÖ´•¨”K“‘8åd/Õ8lQ‹Ñë‚g¢;Î(åœ ÙÆ¦ªâ± ¡KÁqïNp;ÎØfæªˆæZ7)ºÁº‡•Y`·3y†~WhçZG¯ð!6ž"8rñI¼yå‡1‹Wãc[7ºÈJòå:p-ÄÇÇ7k š±8´	†æ5>íéŠâ™Ê¨Yk*ywŸººãHCÀÆðŸ¥v‘àš+Ø=ºà^Kj±ß$³90¢VŠaR8‰yÄeµ©HmWÒ±BFRžÓ±—ÔÚ7dOüè‰‰›WÌ,2ÈÄ‹oµBô~f«®Èb”k8å!æú“”^‘§ú´QÕFÕýÂŠ&çÈ×¹4.¬ÇhäÇ'É¨†°ÐÝC®«‰þ(Úÿ`:j¬o’u?Ž£xÝð–ì]´¯¡ùþ&˜£›}”na5º”†)j&Ìoë/¤™Lz™Ý2·ågÉ¿:f˜äœ•Ãë˜úšë;Íf±b—ÕÏk„v¤­€ xE¢tà›"n„¸sì]Ocrq›Àp™ÀcâóB=}â¿Oü÷‰ÿ–/àÓ0ò†­0ŠÂ(2åj\-‹ˆ’CþàhÆ)«°9V²5|c|Ám±ð¦XjK<º¡ÛÖÍêú@ìjî•Ìƒ’2ÊŸÒ¥3úaNf±ñR¹a¿™}W¢®p`‹m\ýÄfñi<ò£Ë<¯Ë¼ÄÙó ¹K>8´×Ä
¨¹ ÆÒZ/n-û,íöeyßúSLã·N÷VJ†VZkûZ{}'¸ÿy Óäžl‘ôË~4÷B.o%ÜäüV3M¿Ó¥)åZjQ9¢Œ¦ò4/x›î;ÜÙÞÛÞoBhIæ·¡ÿêî„ýá||€kjÅéƒÙËMÞù3Ùn6ïÿçGS}^}´Ò"PŽÕ<+m/.Ù~0sv¯Ð8Þ}Upïö~É½Â		?ôéî­chF•çƒ8SGŒÚ`23Øp™	SU­³Ÿ^„‹UW{Õ²5¡»'ï@ÉÑ´ðõu.œ!,<À «ÌµŸž­:'æË0xÝ™"—‡ý>£éèõÚ*Ft)È(öfã`¬Áff¿¢±˜E_fÍQÅ˜:$@<Ç0`èXûÄ>ž´âygGGYï—qt“À¥ƒaò¬ï+šqWŒ÷)
†dâÅ#`ÉÓ(H|ËÃÛã(J¤×ÅÌÌ¥=?<Ê÷<ˆ&3¬´‡»FÃ{ÃyUCò	ä\81 ßg“B'¬mÆ>™4ºžŒ­ÅZê$ÂM“tp;8µ×“i’l€¡Ð’Æh'ƒ IpêñÑÏúË­kE°Š)*»ð-îøÖÀ!»ƒ8
Cúºað	ÿI0Jý<ö?þC /2ægèŽ2øVNÊ@v;6ÙH+×ŒPûo)Ä½š£èCú*Ç8SbŠÚÞô“g’hLf8#‚ÁÚëwxð(Ç„e M®ñ@š	›D(ÝC´üÝUÏzPõè©F©E«DJRIF5¨ )“eµ[=¿{­)<i:ØöŽî¬—$ð<÷zÉ8-C_ŠÜÐ…ï“Ò‘.2”ò§én“L>Ó¤½SÎ¿IÐ™oö4¢i7Ãê:p"Ä$a¡íló©j4À*¬­!Î&ë	3çP®ÄhoÞëÌ‹¡ýœ©—À=týkäDu>¨s	Ï¤ÛßÇLºYº‚9ÁÏY{Zß;¥µ‚¢­FþÆë)
æÉ˜*®e½ÎZ›=bÚ‚D„¨Àü,™úÁ²~.ýø_åô£H8#¬Xirl±N®?b²‘?ïRCïý¦–¥ú°t}g¼~õÏ?Ã3j=s@Ö?'ëF—Lè—°NôpDÿûÒÿvøÿ $®o’¡å]‡ó=QAbákCüažs1X ÒóÀ}^²û6ùý¯ad¦û	0ûÅìóú¦¹!¼4DÅÖÖ’¾5¶Ýµ·…‰Á–ûö–0WØò¹½åkº³coºË›>ƒ¦†–÷[VáÁÏHžÙšöå_te,¥íØe³
ýqÆ„÷:ŠÛ´†WýÛ;Ü„*üù’:DnÑý§3+¡I÷Û;‰	ü@Ö…mžôE¿þbŸ$ÞoñëûÍuÄy`¶döó‡íFsûçuóèô¶2¼˜­”‹,ð›²‹1r MØwajUiz, ¦^Žê—!K[Ïš9µO¼q“ÍV=ïÛÞnº$„gÌï³”sÂWæìõ-<=»üF2fç šy#†ÿg<ÅÅØÓõlèÍé‰ b¼K'ƒSox¨g´e>Å³‹?½1ô1£Óvüd×=ñAÄ¨øo8¬ð‡6ÊPyþ4‡‡±âÊ›:Q5y¡4l”S„›*t•ô2×‘ú‘Æ{8gœ/Û¡>‰3½lýÁ/í „¾ÂÏ#­….õ²ƒŠ¶£mŠì°©}ÊyFžOv§Ü
2%Ô‡D#oÀì"Ôk/ÓÍŸáPÕÎ”7#ÍpS`Ÿˆ–À‘È13Ve£˜þÎêE‚>µÇá‹` 1Cùð§íííöÏòáOÍÖöîvóç]²éï›ÍÖã¤'Y^µw‹Â–&%“!a»ã¤¼½NºÜ¼ØIÕé¢GÐ€šÓðVH6óÝdÆîîDçòñ:kßj†~¿~½f‘±±ãNþIð>øÓa}RQ0oyëÒs¬m¬µ'mÛD“Äo@í(Ô‹¦4-³ÕÉJ8@:L/šùžÁWL×„bÚmáz6ã±Ho€ÕdÈpcê°è¹Ùå kÊ2-×ØsÖr’â¸þ¼¸§ù–¦>?û¾°šŸ8«¸6ÕÅ^•úØÛ"tbà­‹Iæ^<g¡ÀDï8FçA®gt¸\¿l£æ:–Ãªô½^ B“#_÷ùƒ™fÊf$Œ[&Ž*õñÞ…'°KícàÈ@y\I(ó?Pà¬lóøz: ./±µ+®v*j5èr'?óqmý¢ß::ª¯sóJj/ ÓNƒŸ~@oöÌ‹¿;×rz<ßGâ	›dµÍM²ÝÜ ÿAvïgŸ?Â±ìvu0ðå§¨ÝâOWôZfûZfÅS×ºÀòåºeMùke’k™-¡5çá™>EfIk,ÚB”_8aªc²ÍVŒŸ\Â±Ù8šG?eô1y6NÅzZ%;eÄ¨WÏ¢b œ)»òÏJ<±"‡jÃöó¢'”&…âe5¤+¤{ƒé=¹Îãån%Ü\Á§´×t’âÒ^Ý¹ÐcaYÈ”~ÿáS¬Ûo%;ûÑO+Ùu,ëž}¬°é$géÃì¸<º™FÑYs$’“H$„Â„@g“4ò”!f)ä‹\@ÍáŽ‚A*¨Õ”/ý(vz©~ÇàSžvŒùª¶crŽyø_†=W}X„c¯éùƒ¦ØãIL x‹G±<Ø:ïê®^D—áh
¢­Ëû,±ãÒ—zÚvæ«Ú¶+ªËÁ”ž7¬ø‹þ™d“h¡ú¾Íð\›ž«„p°úmz¸×:Úý^lÓ`XQq}ûtâÏ½¡7÷~›ºîˆŠ»SÞŸâerª¯N‹3iJ Ž]
Ô}]jbKµ¤^áRÕxDŒ9$¼›q€£JMwH¥»ˆ´¡*•Ðó‘Y•¶›hVÚ¬úd›Y©;?avUYŒDkøŸ€´ª<¡ª¬’féÄQOYø¼TíGåqYˆ ÜI½¤,vúu’é÷¤¶Ô‰êz:o+Ð	m_<Ÿ¥ªlž•rÛÐ©—¥\´¶7÷GQ|ë@èÿ  ÿÿì]ÝrÛHv¾ÏS´•©µ#R”d{ÆZISIöj×ú‰¤™ÝÉd2†HˆÄ$¸ hK£Õ¤*{™Tn67©ÊUr›çÉd!çôÐ º¤iY¬š±MF÷9§ÏÏwÎ)›SÜ®7È¶êút¶jvzèUv_WâÛÅÙ½W.¬yïæ·]=:ýOe³~ï¢zŒöž¾Ë>ÎéSÙ¾ƒÓo>ZFëW³Ý¦Å°£þv‚®½›œáÿ16Ÿ)5“[}Õ s¤øŒ0xßAëuÜX‚×^71ñí“„¨j'§
ÙO`¹´žð²^[ap¢{øÊx`}û”èšdà›ï›íz¶AÎÀª<°¤°&7àÙògbñ…?-Ë+÷s ˜:&ŒƒiÂ”W=fIc:›¢Ì¸¨Òâ[Ú\ÆgþÝù>¬ÁÅw¯ªÙ«¼¸ø›˜í~k+Á¶W´ÿA¼ïÜ=mW¼Í!ãï,Wô6ð¼cš ¾sG“™ªØÇ³
ºˆà®(*PÿO&s˜}þ¹ªþAÑ¤mM†®SŠ}ñ¬M™Aé"ÍzU)µ¯‰ÌIFûb§í´'U¸NÀ|!Ó°ßðé–‚©`_‚
6ÉÜ¿´v_ ¤Zåû–œÁ”+oŠo:ˆén‰8í0oRöÃ³Ö³bi™	ÞŽ#½a‚Zy[¤Ýúê¾áE´Ê8 ]¯‡Éìþ-N`r7‘ã‘;Ã¡ë·(Ú›ÇXZËUb^ÊX)Ju_
éµx…ÒKJ.ÐWâÒ6§07t*< PkBÄ/~gß5•öKmžž¼þžìî‘—§ç¾¿w~p!7Lµm‹Ê!E¬uižbB’òÅzSÝ©ßŒ:!…Dƒö2€ÿön‰xÝ¥¤äÍG]Vè6ÆF¨J')öÒÅ?o›_i2¤	ÒÊ´è'†DU\”ÜN¥w’fÊìñ]!QúóÏC‰„èÜhÑ¡JˆÖšM|¦ƒÒ”hÎTÖæ@¯hÓ§4‡*Œdú¬ve%3ª1‘yŠ´ãÉ“•}ÈÄâIÓ‰K’ˆËR‡Ë†ËÒ„Ë’ƒKS‚Í‰ÀŠôßjI¿ÅT_­Õ¨KëÉ¼@í,•×”Å›KºÚ|.’®¾š8é*i.“37a [ÚäÜ”€e—uE®B×yÛô†(®MV$kÜ×,~o×ç¼r––63kÑ²±f™¥ÎºR*>*…g>UudQM”9e›™?ß©Z³¢êÌ„ª;û©JÆS­YN³ÊlÊ`V“œøg¦›µ(MTª$æ’TÃ[—'Uzíú’ŠjJ$ª'y¨BÂP)2E‘ôNÈöB%Õ—4;¯Œ5‘—&ôT¢ñ:wjÀdÕ‚Ã²Å^•SõL“oôeYöÍÓÚ³ofO®¥Ù4•ÈµŽ¬™‡G®mæËìÉÏ.“e¶Ù+•(¼¶,•‡GæóÈ4I‹Ó/FÎÉì9Ä*‡d&y#V°“…Ì±Ì	™[H•Üùæ{LãQš×aQ®È2ÃÆª/5 J«ØV:¦ËÁØÈô°1¥`€(üäŽüå¼’'*â¸'¶/^Ì,cÂïð·£J6D90{>ë_!bÁW¿JzÃB²BÕœ†ßë|…EaÛ$…pÞY$TO.˜cBÁI"˜*q d«&Ô—Pk"@Eð%t@þóöWó×àç ý§—V êOÎŸ6ðQðþlÿ¶/åQk€}1gs’7zþ1‚ëç®ê”:ÂÕ°sÍ4”_çæ”ÐV~z}-ÐÝ®ï"ýaG€õì#"ÛH4tFQ?ˆ£Ipæ	uæÍð¡”Œ¤ñ– MÊàî7³ÜâÍt‰"ŽŠþcg	eŽ¯»Z­Ç‚¯ø;×õõm˜ù#)fMŒž!¬äÃ¡ƒ'Ã‘Áf\p*ØŒ	6#‚KðÀ&4p\	œÇkTI5˜!€)§Ñ>> à `¯»cœ_“7”ä³Pb“|ü„ñðÅ•›:XvrÈÍ½(.+‚„5áÅÏ¬«ÚpÏ<=xp©õ7wôoØßú¿õâ~íQ¿5b~¿óCüê¹É¤jkmµš]ç[Óç€ñò]ËÐ½^¶.do-¸Þ:P½Ö˜Þ’°èÇ€ç­Í[bÏ’mK0¼(yzüîÔýÂúvAý2ÚýDP»³$Ì´nÂœ©ûpó#ÅçÎ’Ðlp¹³DåV äš¹‡œ?=î,9Á;ôíÔ(Ä‚¼µÂÝÎ	uk¹'âvJ¼m	Ú¶4~k…´5ê½‚l_|íÃ9Êa€©]HaDmyx÷ƒmƒ=–vQàƒÖHÚ^u{íB’~5íïƒ%vvQHß9ûe¥xÙªhÙ¹ae? Rv
œ¬qu«adëBÈÖˆ­„Ž­ =~pdì|p±ö¨Ø0±ÖˆXk<lu4ì4aƒp°(ØGl•ŠXÕÍKi)q6«p¯Ê‡+¾ÌÌCÈT5yïûãÃ“Kr~¸xtvIŽOö^Ë0ÖÈõÝNìv± ï¹Ûq½QlÆ³^{7Àõ)ìê™…£o‡ ‹¯] T€"I®üqˆ8gèPÎ\;].2N6;”exÇ*œ8ááÔÓÄ˜7nü`kÔ|N@	î¸ÍÛB½åÂjày„W°sÕÜs¼’'[8fÕvJ.ŽIùÖ,çÇÿiÅ×Ò®j›iÈ½)sKeÿEpÌJÙÕ•(†Y|;òÏ'V^kÌ/Ø‹Uü¬æ“«q
/p0Ü÷½ÎÛ»­äzQ|bùTÁ’ùM^®T´•.9#ÕÏ6Úü'ñÅÓ6a]IRb„F^ìÁ„;cda“¿ËQÛÈ‚ž’>PgQ9Ù^c+’£ÛâÚ•Ò5(œiŸ¦ÀUd—QR:7££ÚHVNý‡Í6%äMø×3ö¯„Ao›Î8ŠüázÅ}ŽÂÎŽ’˜Bö'BK‹w9~¼³”#{…ê(«TŽ$"%ÅW?Ã³EÝwIÏ.–ôÝk7Ýð, ÒD¸FÐ_å/^SîŸ½,¨ÆMj7×Ò)¾læ2ÁR‚"Û‚¢Ï¯o~f”70è]·±öÑk=P(àØ¿o†=30Q¦‰ÀCôã8®t4_´%¡(ì®d?n¸tÉ\X$XÑ­´2ðu°cSîõÙMîzéù®Úù²½æÌ]êq|WVø)Ü¼<´]÷ª«»ï‘;™¤³Ï:<8º$—§ßžŸìQ¥©¨,õƒ÷‡]/FCö8è:þlU¥ö¢«J%Ê*R*Í‡”kMjD¹xø†ÿU%Úú…ó3o*©LÁ ŠHo#Ehˆ³ `z—dï¸p|øQÆûÓ0ž`Ôß1¡ÆÃ›£¤\ŒŠ@¢ö$;"±~uµ†.ÝÌÔšŒjŸW8Ä¹þeû]ÿG[íÜw®\_:¸‰ÍEîÀËÒIQÆ¤4t’ìî÷Á–9ê{#réÅ¾K~µ½F¨˜ˆ7c•ó+¾ñMUúÆ¸“ÎåTÂÅu@\}gØƒK® ¯Cé¦†Ûk¾çÆ-:¢2¿3³ÓTäðsF!Ÿ„¡##ô\¡	)_q´Œcêc¢y“ì+ÑÍò_a.
úRsßóïÜáxÛLŸSyŸé]u£KÛ3å}âFeVÙiä‚&?`âžPL¤"ˆ¥ëhM9rÁ‡i\ð&zÁÛlÈe‘Féï×%¦€Ý?Ãn®{œpûù—äÐ8w{^?QŒZJeRvŒh©#Gò“éƒµ”b¢å(õ˜™³8>Y#—®3 {ã¸O#J§žƒ’!U™ ÄlüxÔ @ÙÈJ¼­‡_Ñr™±½¨÷ùhÝæ9Sˆ<oF*·/±<-FÎ°ãúVF¤Í
9Ñí°CÊV‹øA¬ÒÙ†*ÿô'ò$£t«~@y§úž ªŸ‹ðßt(øµ×sÃã¨×X>ó]êñ€G¼!qàÐýãØ1Ó‚X^%Ëna±+$û°ð¦2²©âM
ð8é’ø÷`äÆt#ZÍ ƒë©Vèï9ê’¯‰Zßjµ:Z,<zW¶ˆbgTMñó7)½CÞ3Ý-øzé¸cº+]¶¡éÅ|‡u×‡ª“1½[yp"™ ^ËtuÓZ)ãIËQ”òÆ{²E:Š_”Ôâ¼w¼˜DþD—ÁE„NÏmp‚PÞdBªËeú–œi‚ä¢q§ãF·”¸ƒ·*ÊVä9”É7ŒHäÖ­ë£+	G&Š¢˜«"Â.`å;$‹nÁš]ßç‡/ÏÉÞþþé1ú½/NOÈÁáåÞÑë‹¢#it½NçãW®ûè—7Wô7´VŠ´hê¹}">òcgtæ«{ÉÂ‚Á „ µm.ÜÉ®f'ùaž˜§A,¬¼@ û°Õ(+m(T‡)^-®\WQAA"Ì›¢if-—ISÂ»ã	dLÑ\ZÚ-J­rû	Ë±·_‰xIÒX•Ï†^Ç g±]OeÉ¨˜ŽáÒîë ÛÃ¢y±#°Ï(JÁZo3ÚxPÕ	œUÎ*vAO5?Ãú³Ù7–¿w£åRŸÓÝ›ÔTD®SåˆB Bíú@Wž?@â;h®&‹¤•ÏÆ.¬m„"‰…Å^ƒþÕ“¤€“~È-:djEKæ³Î¦S¦îæ­FZþõ/þO"hï\X&|Ut£±æèo³¥©“à£')x…ŠrW°óHRë	I¥ß=ådÅ¾YpºúwrPÒrAš]¸þus/Q±FúÂÍ¬D^&_pµÀÒ:‰[y)YôàT;fgu,ü&ˆaÐ³0xç!ˆ³qàÜF+¥AÇH;jxÃ¥¶ú7ÉÍDM§…sQ3¤ÎÏ(ßi¡  µ>¬˜îÜ±Ñ}éºQ‹Gý©ãýÔ…‰Uz¼–XãXÓî€]¼Ìj9-cºä¶z-²±TSðˆ '¨]ìD­I½(æ"ìžPŠ Á5Á t1ˆ±-µž¦Î}hžÙï»·ÍÓ1×®Á·Ó°Õd-˜‚>6Æcªò…|s­¬Ñáÿ„ÞkfÈÜ%1Ãú3rÚ‰Ic}cNŸ³ã•Î@:k±7p	_*2tÝn„é5t…L§,®ù‘µù9.Ž4NA-€“ÒÕ9Û8¸ºŽb‘Ãà}´s·©¢,çðç©.4°¿Ë†[d^a„ÌÖW t©¿¯ƒ®Äp•œÁ€<mo´#Þ¦@Ö7â>%ü ù–ŠÊ¦%øÊ¤‰‰šô×â„TÑt;ËLQ W¾ƒ`ä€Œ±-¤çWŽO|n0tÙ¨8`qIýUô|—;£ˆ¼†*	ÉªàôX‡7~²”OÁ‡T$mq[eÚîÇñ(ÚZ[À -g4jõ‚ Õó×Z­	B"~îÑ5hÏÓ+ñçY5­º]Ÿ† Ïœýƒ}—È{ïã‹Dý^HwLtÈóoÆY™å¾ËT"‘+¾*xþ^AlåšžSÚl×ã°}ÀAjËå+acº±ÚÀÂ¸´TY7±™ÈÉ`"N6Ï2¦ë2u¾‘¿nT¸Ä&RÇ™åG
u4}¢¬ JÁqiLÃ <6ÈI›0~Suû`H·®.°êÈÊËVÖñbu×$’[ù¿KBÐ™!„ÄNÆ_”Ò$lü­ü¦ï”we+·wê­GøË$c¾Ø—ÁKTŒ8“à1ÿESP~¹¶Fö|²l„@p‚K\Ô;ÇØÿÇ»FQ{KÜ/Rc¼ÎŒï:Ã£§Ë¢×?Mtûáæ/{Í¿o7_üH3Þ–WZqð:xï†û 44¯ÁC§ÁF‡Gå&Û‚ï6dj§êC¾‚½„fˆk‘ž¯¯¼SØ3>Á†¾Î²U:´Ž´&c©Z˜ª&¶š†±&f-¬P¥nÚç ¡+²V×¶•@‹'z ~ô¸Vzvâj€ñ§£>d“ THŠ\j,½„™Á”â„ÓÕÔ·–V	Ž©ž¤üæéxHÞ`lSDFVª¸Ìf”‰ D©Å˜P&Ü)¯Ïsµˆ>SJFýÞlaþ¯ŒÙÓë3äb¥áL^Ù?ÝÛÿ9üÃþákr~øêèâòœX”œ{xšW’ÃiÛÌmö@–L×7cJ|M(—§7IBûL|³¯“!fußmŽG‚Ñ×·R&ÒÛáZŠ{€LŒ³Q/–ÙzÑ†ºÒÖ6+“Q+S5I¥¦Vå.²Ïáž`ìŸ®ãÑ`„*•Já¡ß«ìêu…]ýíòÆð’Ø$y4kçX(±˜,¥\¯Q×ç§²W5÷¥%Iuºq<dNf‘x¼âugTI8c-!?üh¼ø;Ç÷˜¨>ÄMs½ù { ¨‹Nø¾så»•ÐQù<báI|^àŽÜ?é3cwDÖ·È¥;aµ5’T„È?Ú$ò•YèÑ#nÉÊïh°%ê[jd,k³×„¡.²B¼­ÿÔV€ˆÀæŽŠÓ(SµŽ1‹Ÿõù6b¹ƒ[^‡‹<±‹j÷t
—tÃÎƒ …h^,y¯`’.›-¼Ös‡nHuu6ÓkPjAÙ ÅÃóQ½}ïÅ}x!JG½¡f4éö¥]%{=xc;‚Î½J0bÁŠZÊÔbò
~Æ~l(Ä ¹ÜˆôÆH€Ø…¿R­¹yNàþD¹hâ½ZÌO"gAuïú®X#ºbÇìr‹€Þ3&—ŽúD–ñc=% Õ±Ï*)>i#4¨L•¾Œ‡vY-º•TYµœÉ´IZ£uãG7+ºÊÂZ§2j“ˆÌ-Z2‡pmé›àÆB`
‘¤Ôåfá‘åÐFKÌõ,[(X‘•þ±VrRò^U,öyB’Ù=Ë×ðz.S}NHIkSìç—×êù¤Êp
(]Ô80ÆÝQ¼³D‰b•àZI1®MU ¶Œ¥ÁþBXÎÃ¼Y«¨Õ.)F„5½ëˆKÕÍ[w;ìa7ÙuÑaOîœ´˜5WX»aò‰n^“Ñ³ÐÖ±,kºåE}A[øw)ôâÊF	½]_]ÓT›Ý.nÂß ÜÇhc7tzòÉ×wC—¹ˆ–ÕCmAàƒ˜Öf€©€…a‚Õ°ë„]Jà78ü¨†!ãÀ±.\ÃKÆái2ûÈ‡ÃP_ïU»ŽºÑ÷‘ˆÕÍ-!”°nlÌ£#Ãb—Ž†pT;4}O!lïÜ‚ÝÑòÝaô
t4·Õ¨:-Ò}‚bÎH6ZU1«Ó
®Û4¦%O›ZëÙRÛÅ»ÁÁ¦ÙË¼Aú"É
!îþŽnñv£1X~K»¦:ýÂúöÇƒ!wÁD¤±çãIƒižÄÚ¿ˆC¯ƒb(Öjl­:k©Z~	zÕØƒ…~é€\Þ/.¹E]Ô
™{V‰;Û‡éà×^ÛB¿L±ô¡"ƒõù2 Æ÷°± ÿ-‰à7¶V ±R6a:q‹{^Óñ†ïÐHf˜ŠÔeXÎŽ3æV ÚP¨¢ËÊé!®½õ€ˆº-[ÅÖ/<èðÂO‰´–çŒì¢Údú£ôÛQ>½‚ÙšjS½D”mdTqÔæS™|ô»{4¼LÂyœQØP|bYïù°,ÉKæEÚ`Ë¶ïínƒÃ>å*×†<Õ—È ø;VR`÷ì‚NŠß¢õ„ V¤ŒÔÕÏ«çÙ¬­NæÁKÇpÆ/!¥.½tôïøÇòëåµå³eŒvÂÎíJ³89?ÚÇbæ0žz™ùÐ‡Ï+]ƒÞ8TP@˜ÕLËƒ…ŠgJ3£`[Ø€o¼NyZ{¬b8X¶Wô7 j|Ÿæñqóà Îõ9G´üpº«d¿<¹«@Ý]Ï®âú¼™ÕôáÆço¯•¸áRëcà}Ñ²yß_-2ïSwHfk¥äó`„Ô¼Jc,Ã‚~é-ÿ9–6ÁÌi!LÍÌz¥™EÑúŒ W„‹ºF²E+¾¯yA¼ Ë@5>Wv$ix–u†Â0¥”~ÑéBžóïkP	<ê>ãŽ2—ˆæµObŸ—çI&q
Oïx(»ìZ¿§ØáUòÍ7{íöúFrk/}YÊˆk4ÔM&¤¡f<gy­qJYÁñ…óg‹?ƒQ¿J°4|QL¡XŸ¨Á¡½©ß¶/D
mDÀæW@DV1ŸÒÀ³øÐ6`ô žø{'DssfY Eã—b¦R>ê"¬¥Ý
¶šØŸ¥`/q»º5&zÅÎYOVqÒÄýnÑR'‰ ‡Rwýžï†ñ¾vüÁä.ÉsPÎÓµ;Ó0nÂ½Ö_i"$³¯ ßv¶äË6VçÚßú2c¬`²‚0dÈ hƒäËö¸=rÙm}
˜ÇŽ°>/üÓ	ÂÐíÄ(»¨R³J2©¨ÉÂü!Äé1UÄÊHað8÷ó0<$€œnÅ_M®·óç³ÑxÑlBXÐ*ñhøT×£+éÐuçÝgBwÉÓùÆ˜”u‹¾ì©ZëÈŽêvIƒVìŠ¼ƒ©·`ËNÆqˆë{WÙŠn:¨]‹ãƒ~Iƒ.º~IíqE	ôŸ^drDÀYè¾óÜ÷ÕÜIÖ²¢s¨js´ªÃÉT&‰XATÙÐ¯Û½PY"!TyÒ9}\ ‹¸ôUô­µ¥ ™1FÆØg#Ç<ú• v‹JBÏ4ïT"Ì-È!‘nÜÃn@YÁ)«£˜ÂŠ‘EºLÉavŠ0]È‡E—A~Å¡"ˆ”[¥Í^²N¼¬õW	”L/šØ\ÚýÛíµ¸_õ¦Äé2ÉÍ¢qõ;©3cÐ~®Õï¦Öâ$7&–Ø$7Ëæ”ù~ø5Ô«ÓFÊÚŽ¯`=éÙù3Ÿûä¡XôlÁÉÞ½1žíl!?Þ»7™¾ˆ1m¸¬»eÜÍ­¤d «AcðXòY‡76p iðÜ¡ Ÿç	­úØ%oZç´]©Bg‘¥|:ßÏ’fÙ¬ ó:.óâ!×ãN?ò¡îÑ!Äw¨ñg…§|õF{™×	IJÚ¬çKØdï–Jß,—4¤gŸ´ÍwÙ
ÙtoždÛUÖtÖ'Cáa…Í;˜ðT8±É"ü”ºT¡ê$ Gûü½îK»—Šgê}¹ôm ]eZt2il›ÙL¾Ø)ÛòÆÚY.=E§ÙËÜ¢‡e=£Šó7ûŒl«tócLb^§çóûPÈëœ*T¡©Û­òARW…ŠÏú¦éáâœÙd(3UŽªfÐ”³ð³gù#åÆœÖ·ä’è,7eÅŽª±bæ,æšyåÆ	PL×ýLË_¦²Ý´Õ”t€ìòâ`í	@ÛaÛUÛJè¶5éÍ,AÚšäÔEeö´ž`¦Úö®¡˜ëî”‚\àü£—°T04ådQ±¯½pÒ»Ù¼gwolSÆž)vvª¤1	÷òYõAQ€ïž&è»a7œ¾Û¥ú_–6–UßTDqWx–ÚtØÖZ4çîuèFýý÷*hx’ó4ò†Z¯³nÉ,Z­–I“ÜVŽƒYòUçNsB«8ÈÅT9ò£Éà×¾ŠªéµõküªzYk©©ãoONÈþéÉË£óãb~ VaÃ.pFõ­ÿ)ñoÒ"Ù5$þUî(®ä~!Eä¶–"a;š„ûœ?U-¹A"5ö]Ÿvïz×¶³Ò9°êb'¬Ÿ6§l>¿M¥ÉcMñ<ßkûp–²)—¡›*ˆ°\¥{Ÿ)Î¡ËüÈ¤²ÑnšJ²´+1m,bKè 96en­¢6ˆÑ“§‹EìƒüF”z»nµtL2ÿ$hòw´‰Ê½Q¬ËR‡aîzC‹•GqX¡‘”FGnøu…›”–íÄç¸Âûçª‹ùÏµÏ”+1+ŠýAçnäQ`®ã“×\ š]£fòå¸ôœad*ž©ðul…é„Ä|ÐÎX:	â¤V¬¦¨Ù©«uAªÒ¡W¾¸¥ï$ÎfŒœ²Æ³Wù¶›R!¨"¿;^!¿RðêdU
õõž‹51×Ÿ)‹?óŠ†\Öˆ°­høÛìmÜ^N…
U­ž—/ñæÂo“)´Ê4˜"ÇïŒi–'‚‡8ë1dÏæÈ•]º(Í8ôF*[IQ…Æ¤ÐRN–X¢‹%OåR‰kä÷Î/ˆpb6}—§wx˜håvY.e3³Ö^ÅdŒ©+†n’QÿS9œ×ž©tý¹q8KÛ†ÅæRê¡Õûªpu…$Z¦þî6Ç=OêQ§·›Å&§9a#©™ÂFÁº¢+®ñNníñûMuñÃ„­Å|ÜhšëâÇëî,¡k¾eë¤ÎÅ½Ž¯s4Œ\òñfÕwI[È4ÈAiTòG¢“n:âÚºVt‚EY&jÌeJ·IU
cÈ š<Œµu³ñ£÷`1nêÇÿeæ–Öˆ•sEG®ïvbSæ.~þú—ÿø§„Ø°Iø’jT•ÁØZí®tóÕX8>®5fW{®¡³J>Ò80K]Öƒ?UïiŸò.,ì£µªeê=vâ~kàÜ4ÖW‰qµšd•vL~öú˜'~~ÉÓ–ØßÙ&	ù—z‹Ô˜Óµ³2Åw›úí0tÊáW”››©F‚(ò¸IÕ€¥Ý»âzßwË ó&”†‘:¾xÀÔñÅÄÔa°ÁÝà,‘ã>êêO¢ŒØ:M ðžN7ypºXÚ™êÿû¯ÿýÿóç„ÜXO!š¹jßûOS5‰×¤dVëQ5Ð\QŸj ­÷b¨2¡Tƒu<ªêßëT¾óBê2ºtÜ·ïƒa7xTÔŸDIxÇVl%¯õtJ‚4ÈƒSÄÒÎØðÏÿ¥ ûÆwç3×òðij
2›4…Ìj=j
š+êÓ¤õ^MA&”‚¦¡ŽGMAýûDš‚í×õG¶˜ G0þ;&¦¤(
MaU¾h¨é–Öf˜ÞcŠK’nœAüiãO‹Ê6aÕ@¦	=)»Ê«Ýêî Îå@æì›Ë«áõ¢ówQ­˜a/ðŸ/bÙe^ŠO«2¹Í}¿‹™Æ›R¦q*ìð—gíµ“WJšùµ‘W‘e7ù‚†ÊÚÊd$ôoÿ’vŽo8ØŒñ2tÞatç¶†®ñõ]wÆ}QëG_“7G×ô ÂÚR ÖON/i¯£Ø¹EPöœ¡÷§e¼´J/¦õ/¯\P”A";pÚáÒÄlihEpÀ9x~œkîüvðSû§gíûÖå|¶È2«ÅQúìfÒO¶ÃZãSi‰ÍÐ‘ôÉb~X~qŒ•¬0‰NáN'x¤«âgUÃ§Ü…³¸ùôß,©ë]d …jÇ)wÀ$;ì//ýÀIŒbÓ¢N=Xú“¯ô‚ðH>Ø6ië:©ImÏ–¸Ì‡ðÊS)ŠK0Mki•,ÑêBKšdE†jU7IÓ¾ù[´¦NÆñîº˜-¼W[54_?ý(÷®y”wúQ2¦Ÿy”8ˆ_bñ.ªÉ‹~‘Îö‹ä‘ÊV¦¸»ÊÑ¶w*í­ÊÆIí¶ó²Íƒ6ÍŒ¶û£Bq—/ð~0¹5@ŠÁôJ‘5š¯
g–¢¯}AËùÝ÷çîµeã[>Y]“I!DSJË¶¸*=EwëÛ”Û·fÑ]<J™z+a'ÝÅïRÞÝJNwqeµ-%;ënöº[äÍg™	¯{ÿÓg	 ½”°ïßèÆFç¨›¬)\{uèbaÏ½xé€`¡ä2ÀÑÅ©ðX©Õæ	Zõ2BÓg°ïÓ™7²×_¾GËà&CK/¨'¥>ß\HMLérºXå¦ëòä0lðVÍ­Sõ+ÅGI€eë¥ú!Ê„ËGÒ¥´²*§Ê„6ç5‰ÜÅÏ	RŽ”Âh¥N‘£|xòzïüÕá9ûÍéåi1%ÙúXëžé|úŠ¼dé¹†e0+Û?VÊR~Qž¥,oEj#°@áq[ 	Fgp¿ÓcÎŽ•_ÓÚ¹wâZø	_Dü&f!:³Ò$­ŒÐfÀ4¬•[–$mÈƒf‰ÓiËÔ¯žaæt&=:Kœù5Q¬ˆÌp9ªÊÙ‚IG#¥Xûþü¥¹®­RcJSñ.)ö#mj”Q1õ+.@X²k†ìTáÄgÙDkVB1(¸Xã·²Ø¨#+VþÊ¸”bÖSz£U%Kù3CÊ#EuÛôŠÛ…‚,¹/^çøqî:Z³ëÄ¦“~½¤¸9WX*7 ¼ò%å•àêgŒ‹êÆrÅÌÂpTcÝð, Š½ÝYMñUþâµj[¡xCEü[•å/ÕˆyÍd7ð;¤AÐ…ÑˆÅÍ¯°ÂS<3N’pòU t4 ùŒ¥?áÆÓmËbÅJkCšTÆÂ9ºZƒ|%)–8­õÐ‹0&å‚ÑïU
×^åZS×‚*ìjFzÚº‡¯/ÉùÑÉ+QDÓ1uâËàÀÅº¹º$È,ª€ 1ØþX2ŸN#Œ^Ïº˜GQÚM_ÍB£w*ë~\†N”}b¦k,/h¯Ô0ÏÝ¬t–¢ŠùÃÅš
NœKC×\qµpcÍ‰©[]¥"ûÆ2¥e%Þ7×±ÛúF Ø“ËÖk{,X÷eÌ‰%=‡i=W®Œª>‰ª\'Ÿ„±ÿi³Pà>e Ú>¡—¥Ý½¦ùÚƒ„œ!º8I—IÊ,•t½Y|¤ˆ¡“Ï‡ù5B¤ã°Õã+Þ‹"¯7¤‰»èÆËËáâUO0ÎõíÐ¡ß¸Ýå¹\¼º˜ºÅ$ýÓA +6ÛãÿPÒ@úÓfáÖÜ´lÙ,2¤ç³÷D|%’HJÂq³¤Em/àÒøžP¸Ë´ÿÍ;ÇcÍÒ…gs¾u³;]}3ÃžT
†r‰‰à¸RÉ[…Twéñ‚ÁB9;œvjr£U‚µ¾t!Aq}ÞëÚG[•;=Ÿ#ß¹2pÂndÿÖšŠŠ¯JDÛ‚†+AqAåBº7nÌ¦2à’6dŽ7/)?±ž·sVö—íŒ‰½^:ÕagvÓ¨Ž—Ù¹è’/W~ý7÷óÿ   ÿÿ .køa