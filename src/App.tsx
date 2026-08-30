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
    const realUsername = Object.keys(organizers).find(k => k.toLowerCase() === u.toLowerCase());
    const acc = realUsername ? organizers[realUsername] : undefined;
    if (!acc || acc.password !== p) {
      triggerMsg('Invalid username or password.', 'error');
      return;
    }
    if (!acc.compId) {
      triggerMsg('No tournament assigned to this organizer account.', 'error');
      return;
    }
    setRole('organizer');
    setUser(realUsername || u);
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
      const matchedUsername = Object.keys(coaches).find(k => 
        k.toLowerCase() === uname &&
        coaches[k].name.toLowerCase() === cname &&
        (coaches[k].phone || '').replace(/[^0-9]/g, '') === cphone
      );
      const matchedCoach = matchedUsername ? coaches[matchedUsername] : undefined;
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
    const realUsername = Object.keys(coaches).find(k => k.toLowerCase() === u.toLowerCase());
    const acc = realUsername ? coaches[realUsername] : undefined;
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
    setUser(realUsername || u);
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
    const isTaken = Object.keys(coaches).some(k => k.toLowerCase() === u.toLowerCase());
    if (isTaken) {
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
    if (targetComp.staffCode.toLowerCase() !== oCode.toLowerCase()) {
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
    if (aUser.trim().toLowerCase() !== 'admin' || aPass !== adminPassword) {
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
    const isTaken = Object.keys(coaches).some(k => k.toLowerCase() === u.toLowerCase());
    if (isTaken) {
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
    const isTaken = Object.keys(organizers).some(k => k.toLowerCase() === u.toLowerCase());
    if (isTaken) {
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
                        const newFields = fieldsList.map(f => f.id === fieldIxœì}ÝRãHºàýyŠl¦¶l¦±±TWq
:( ª9T÷ÌVô‚l	[S²ä#É€‡áNllìÆÞž½Üë½Þ§Ù'8°ß—™’RRf*eLýô ˆîÂv*•Êüþmò#¹#ívûj…\~|æþÍÙ$üŸÜ“MrµüÏÿD×ÈòmÏù0±­Ø9°w­Ð~ë:ž5}ç†ý¥¹9ÝáÐ	¢a³ñžË9¥“ÙíÆ
iŸÊûïÿùŸ¿?ŠùÒváŸ¡C—²ã¹CŸl‘æ~:°áaþp…XøË&ixÎUÜ 'ãÇNHÿ„5ŽâÆ2ÙÚ&wÊ7aO¤óF‡.ü¹E†NœÛk»×În0žhv„Í“îL“ÍÙ[“æ®ãªíÚdk‹ÿx`ÇGßä3žfÃ–=ÞÙí^JÏn€¿üäÜ&ß|+'E×½™.ÿ3c}ìŽ+tâiè“¦òÉ¯m÷š(%ä“3Ûº£»[u¯i‡Öphõ=G3&ð÷`ÔYl…ñÖ]Ó©€¼œ6luZ~tå„íÈ‰÷às³;·ñêÄ³\6'YŸf‡%s9WWÎ Þñ¼àÆ( qpí4ª¦LÃPéÜ
.ÛÏŠLY¶ÝlkàÆ³ÖzG}XxÝßWnÒ¾oo‘jM¡ƒ¯´Ðe½¿vBãuMBçÖµç\YS/nVvo‘x´ºˆ
ô/ÛŠFŽ~ž½
ïŸûüÓý1˜ú¶c·¼!~šÀÝCÇºvv4_Ç[“Ï~¦Ÿu~@i”ƒ„~«H†ÊR1§{EšÙŒÏŸÓ—ð¤J{šðŽ³kÂyF:‘1mÓ°öøé‰[cgki·ÖàyaoÂŸÙpZ³V·½AúAh;!ÿ§ã®M,<X›OFp”á&œÐÍÈÕ’ ˆ‚°5­>a¬{Søª§Lètnì~Ëò<bOC‹~ènt–”KßÖ¼åjÂ›]yÀÁÿ:b÷jÖê;ñãøV:ŽZL”\ÒÍ¦˜O¼ŸïÕ-Ý«±ë·nZŠ9aÖw¡;ùÅ	cw`yâô7p#øA±Eÿg»c@ƒÜ^F#ÀOð²Zù X/>€Îù±ÛÜþF5ŠV0+{'X‘ƒG3ø„˜xãÚøiê@$!cë^ñ#L±´Í%&¿½ŠO«ØÏUØÐŠ!…5ß]²E¿Ä5gëV/®pý_Ôµ¹ •€hGQˆH`7@˜cŸú–Ý¸¿¼¯ÚÁò\¿°?éL{Žç€œÖÐá¾tÕÆðm©Ø9@,BùÐ}0xÓY ´ñ—ÖMhMª»rÎ<Iñ\ßIÈArrrYkäÚ6¼P€õÊgÂSûÓ8üÊq rÏ&°*6\Md²Ëv#nA(sí[ª3tôÇÍ®ÀßõÜÁ'`¯”»2JïG)}æþ54–M&i5Âá€?YÝf"ê­u²ï&‹Þ¢Œ;jùì4C¦Wˆ½•®ÞvBþßÿü?Õ‡³Ê¶ûë:F+Ûžããi‘îÂÎÔnüßÁ©þß…j5qÃënõd'µWœaÄ 	ÿqµj'ï>6FŽ”„
„£ ðäHøïÀ›öñ_+!©> æØ‰-”ñïí4~k»>ŒÒÌÄ7ìÔ
túz]«Á¦^[ÞÔI”jfúûßIú<
”ÉzÓ0«×fjõ2*€QjIåz¹¹-}ê
ÈÃ1“ÑéúˆËŸÕ`F¨u¤=Q2™µ:ÀS2 §²ÇU0˜F›Á4ÆÛX³¯ølˆ&˜»±+bVÅ}ÏA€ZV¼&(žòƒ\ÂóYÚ>d`ûz•ý8Ç<‰$ºûà™¨Mtiû´îD ¡P ®	PQ?#š
2¢D”. ub¤7AT}Ëç[¶~­øšb,5€âëšÜerŽ%ü¸–¶ÿ|VÁJSDã¥í³£MÑýeiûhïA“xC =ï4Å­»qø )z8GïÏšcçX«5GF¯LhCèxZ#ˆD3©ÄŠ	Óô9F$D%ÁÔ%bDg`m®?™ššDä¥3¼*P'æ[(‹œ`ã/ù(ý.RnRþpE/”Sò£(Ñ§#¬Žå:T’ùÃÞúÎÛµÌD¼ªi$Ýn%4~PÞ
g;¢ÿOìYWSÏ“À…`›ábyI…´:äãóÍÍÖÓÿäÆ-z
­èÆŠ#ªQOœð·MÝ¨ßŠJiljþ1z±J»†¢—©høAÞ,%Øb<  4ÀàúR›ÐWm&¶)¾Õ*ãaÀg¢™)Äu”a©{‡Ã'jßr=Ð:3!¬
‰DkPÈ^B%²Df·ËÙ¹8A±gU–sBò†9ƒ“ý1³ü!¡‡Vó6ýÐëdælüÜ 2˜vS0/ê«„‰é'qfúL]1óý¥~ÏëÛ-÷"ÅŽ]m¯¬Vì+à_û³Â£q/3ÅLrÜ‘–D[Ã)ªJÈ«§c“œ„ÎØŽÉOðmë­k;ÿä	9DY\»ÎMÉQ.¼á&¾R›ÖÑ4¼²© Ñ‰I&_LZ/™<B­0…Ü¸›s:ÌZ/€X6ðšhL`ÀàÓŒÄÁ¤õ¢$}—y#2´V?ÇÒ6:dÒG‡Ð¾9¹ThŸîÃ<wá·}Ï‰P‹Ov¿yf' Î;L‘$o,{è,«ˆ»‚©½’8?¨Õ-q4v©ªÓcb^W'Ðák¥mô“çªdß§v:ùªäp‹ y°GvwN÷È»Ó“ŸvÉÉéþ/û¿’Ý÷Çç;Çû§[˜R´åçË½5këè­]q2sëcwµÛ^ÿ­"W_vJ¢6¼!«¸s!È  ­8hõCrãÖÇ?t{½nw÷7€JøÐÙé®u;°ß[±ÓºA äm	Ýe¡>À~0¦æÍðCè©l¯å”¦¸;V?t°qýÈA?çßà?Xú ß“þÁÀPiÒüÝé€é>Œ­¡³I.§¡×|¦XÞýò%¹¿W‰\¦«é{ðP”+Çî-|p|»5žz±;ñf
ßkÉ·ZZÞåfSéùçnsgƒOÓÉ‰gÍô’3f×FÎrþSëåËW¯+Ò1(ßÁ¨£?ííì‘£ƒÓ‡ŠÁ(ÏÁàŸ?ìîÃG'NÉÞéÎ»÷ÇgŠ;¨9o™átè­˜X!<SÜ úÎv÷üËÔwAXmv7ZÝTã‡pÀÃáv÷cnd+»xÊ0ðÞ@66>Ãí _²×évZõV·§F­Ú0P&4ÜË˜);½	WñÕ£ûŽ‡Aw?tèÕøg²ºJÞ 0²ŸløAÆt6å4‰àSN
ó$¦°“[Œ6Œh$lã6¢¡ Ñ˜þƒvú‡7¤ÿÜzôŸÿwþ]I^ãËK“?ÔQ0lc`åÔ ‘|D9²·•ˆAè"a© J)N—Ð€!ÝŽn};ÕÓ‚WÇ1ëº1°8æÝ˜Ôëê­ñA0H.ÒÉ%=œûùò7Tú²s‘Ý#tÔ9*yãßZ]Çƒ¤¬[àfE™Gš ‰`MiÛ¹BM¯\xImÊåðeJƒsµ!Wa$U›õ1E•QŸéÆ`xç›s)§¾Z/1ê'ÏÐ9?€$×®Åþ€ïôº{•›èö¢oÄÜ[ ™$ûaxhbS]¥î„,"\œ(öæK‚Í…	óÎ„ê9XÒ«}÷y¡„P4A%AÖgâ]uôJI¦b¯íF`ªšPÑmh[Ùs“0 ADÊòš(µé!F¿ºñ¨Ù8;ßyû¶0ø=i'ü–m.ý~ú‘\>»N9~ÜÌúfÞ©²Âˆèò
év–É÷dí~r{	­Ù=<¬»`›ÊJ÷÷Û¢XgÑ$åZÂ	TÙ‰4á}j-½LE/–8àŒ"iXQË7×,² 4‰°¼ËöšŠ°¯ÛåO žœR‘ŒPÃ+;<2 iƒ¡|MF@àÌ™>¯œÉ`gÒ}bâóñë‰¾˜nptÒ·x•Ïš9TG—¹ð‚"#0£êì2¤íÕôR1”²›ÎV ÞU–7¼ÙU¶«t×A¶è¾H\IB<¬Äê£ŽâK=	íW¨â®ïWÆ°
«ýÁœ¹å¢Ÿc£o:¾mYÓ801å3›YÍV=ëÃžñ*cu/<2Ò<Yè	ð¨Ÿ‡"
‹4ÄzK$1Ñš’¸bj–ÍŽ&Œ4€ÉÆ“VO*ƒTÈTw2R`´öu6u}=¶úz,Àžˆp­0k£E<rÆ.ú<P[!Á&O´ ´“¯f³H0ÀÅûçR.8Äû ±V½Ãz,=Šº§ëSòÝ÷4)fž1™\”†äãmrÊ7xÌ G'ó;ðø”I<*:™Ày,µÍä–ŠZU^§ª–˜“Dµœ/k­C&1ÎÕ¹ÁXZ¦ l8˜Ôµ²D¹d+Ä@šB·dþÀòï ’Ô°ºô:¢Ù¥ÛA»ËJ§V‰[ÆSiÅËôŒAŸ´©çÈtfsjPC+ª¤	MxˆB?ZàÿÐÈµzÔŠÙcs4¸Ó{¸)àãruL õHŠ†M™!;‚xyMüEG.‘È•”	nïZ±3ÂYàTY‡ÇŽ‘0‚ªÕ‡Ë¾ª£i%ì¦¯­]_Ç½£¶ÊÅÐ£
ówÿ~„+f–-mÿJýöß*úQ¿ßãZÚÞ{ÿæB;è?Îa|9-ƒ§i™(,bþ[€	!…M²e"éi¸~æ¦ƒ›Ö#V›o&è<¿æA™Iª¼(h=¾Q™Ì_Qœ/ÃÁÅ¥i¶‹9•T®Kê_<|Ó…-¬7© ¦7*kde×CÄêgwy(¿/‰Ñ¬´L¨ž×Í”\ÁäÁ,’³°0‘©7RxÖŸNwËÏ~yg®—ñ4£ËBdäýææ3fC¹ÔVË_´u·Ö«q‹¤ÀÛZ:ª¡=óLÓ#+ºþÖÝ•åE†i›æI5õØ«Ue45„Ph¿›Ï¸óüyÁ¢­°b(ã·Ñ¤ça\ï«p©é.oíceƒºÁ’‡âq>ù‰ù8'fú=ÚÄM¸hÜ¯¹ó,øc«äy ´Ê¢eöý8œ‘X§¡Å¿üjã˜O–ÂŽ-OÕæy—F‹Â«[l’Nûå¾ÚÙ äµ8 ¶;tcËófX<ðAr7H##ó‰ßw¼6Í}án‡vÃÔCòŠeÆ>ûå¦6q«bÁê¢“ŠY•óIf’­M‘ÒS`}9Ñ€¦7ŒmlyVêÔÝÖ­ìR¼©ª’ÕQ%Š¨I`F³¶q£)`Ï`y7¥AH¾)³U&ª%äÓ.LÅxÖ[Ç–òuš‘×óÆq´¢å9ˆY€B¾!R“Ñ,¢åÇvO_v(ÏHs­½öÃÆ¹%½v··±´oøädï-àòxâz´:HSÉd‹Ó&p3Fè¡¿vxˆ8±úÁ5}è„§ï ùÐrä9JLcø)˜!NµË[RFRu†—ò±hÅ]-^6<·úŒXÀŽ\]!	u¢F1Á¤|j—xÃMá#3©¾ä¢<gåñrúœÌÿ9D	:ÉG{d¸V®Ùz­\³²²Ê¤1]¶˜­ò€£q­L0‰»‡­¥@O£›N¼i”pÂx¬õy!M;¶MvAé
Æä‚2U	@–ƒA¤d¯¸uÉv¯ËöI1VU­äµgõ¯š^™&Ú½EøÄ‰^¯Ò™¥ÏT×)`¹Ç8<ó˜ë)šá“ä¤”ë9ñ™x[Ó(·ŸR™ì€n-9m N I“7®OvúSù%™‘U• (;¹m­¡|ÛK´þÛH€Ýú•Q$©JýÂ0s ;Y%çXöB6šB:E¸À)ç€¼Í.¾’CVdæk¢ìÖ`´´MÿÑF)ÜxîXcrdù ‡KÛâ§ZÓœ:WNè8pÐìZ7ÿrpâÏÁI­›è.mÓjÝxäØ(Ç,mó?jßl±[-ÝêY_)‚¾grØVÉ®7íòŽOšñ¶yÉû¹å|º	|; P±2‚ýš	@*¯,þQ(â¡HÊ½"Íïr|Wm¹œ€Š Æä-‹æíÒNN¡º66SLµÔDÍâÀ^ÖÞž6u ð²I*²‘Y>ò%3<»ÛÁ»í7ÍåvœÑ„Mø3‚tš­Ë÷—ªG¶4Õ¯,Ÿ9·¿0ÿDÐ]Ø¿æ²rZšÛœÃ³Ý&«~eÉÄÇ«;Êi³nÐ yŠÒ<_[9'\ç¸Ù{™×ÌT£˜O§Ö®:t°cÆ,À„à‘Óã>8{Ÿœ¸ö! t¡IE½r¨Œ¬kç,ÓÏ¶‚Þ­Éá†|l·Û‚z¹’Bðo
$*	¼º•h§r¤ˆÙLµ™ ×`Á	+›ŒH®¤t”FX•›¤hí+nÖE›q0Ì É«Pü'­ÿÞë”Êj%”Wis--TÆèÞñ·V©wòÂ7s—•y‡ö‚:jüËºj|šš‰Þ®Qëãz‡f€*ö«óUùÿ\ê~6a¨9¿¦_øx'à{R]šÖ'?JÜ‹Ò²¥FÎf”G:Ë`"c®%öÐµ¢=´ì‰¬ŽUå%lóËRÞ˜ª@IÙ´)‚ÅÒöq èN/ºsuRØé%3bmÏÄ
y…æ3 (Ô"‰vµ8 –m3^ÅŸÑ–N-=ãe²ipx%ãàØÞÃ-s¶Â5
ÖåBM%Â‚lÙ çi*ÐÜT:°˜›ZÈDTR“õŠ2­IK)`º¯º#@Uí:#!–]Æ’"»*9³¸Ã¼RCDUŒuÁ.ÉN.ër“ÕÞYŸ–æê À¹°:
™ëóïþË•œªyOøm‡G+Ï…»ÀKËÃØêhu»En«ª!¨)øvméIš™hrH«
ÍéƒÎ¤ž¡y¼6Ì_Ã‘'që=Z7‰÷O™ZÖ>…º³YµXþ@še¸-~ Þ³^óµE•”ò‚¬RCîa4;l[ø@=²­†þ…õ?Ö3¦‰ø?i8ùF'/Z€J¢	M©.YƒˆÐ’‡NÜ )’3
êÀ"W°Wˆ­úÌƒD +&ÐÖÇ”À”g®ÒÚ˜ßÀ‰@->E‹Ö#àì&ž9ñ
EG7r$7&Ch k­dYC/è[w²9·è!cË¢çVµžó ¸3Á¹#ëåáX´Á‰ñK¬N˜=ËIx"úô‚	Py‹ŒÛòVÒea?/°èRm7„›¼Òcx	 %0žg¤§QP•ë;ÀµÐ…Q_`y†ì]y +×¹WhÞƒ‡÷/¸Ñ?…+`ƒ)>}ñn ofvó’>€žOëYÆ9/z9^u¤¨vqiKL¿¥°ª¯crâ±wÐÚs Ëž€ëÀÉHJm4x¥=˜xâÞ:Þ)êQ›dÝ¸äá‘ã71¿
«èHvÐCÉAØC¦fóml6¬êW tŽv
E[ärïý¿ì¿» ªÿÅ³ÝM?R£SèPc_sõã±ZÛiýçNëÕEë·Õ!lßEcù¾=ñ‡—†…Î¾	ÛÃ›HZªZÝa4C{€¨ÚtÂÐ|wÑ\BMjÍÆ[Ëõ°Ln
¾øÃ™Â0ƒÎ5-Ï g`ÅËÞéñûÎeº.ˆCi…\*ŽJ$TJ9}b§í¶smèÔ=­©ÈLü©è=·—À¸¼–xE1ôn8'5?¬’˜ÔœZž#1´ËÕ ‚ãaq!ó,U]d¡
ÕAÜ]Eö‘š·0=9maRi„Ñç#OZ9ýI¨ºËWöêÔïØ&3Ê(ƒ+Œ*L'» ê^¨£1¨…ò˜R‡£x‚Ï	íÕk”ÅS]”CEÕ-GQ±°Gô°úWîp‚hø,±Òg­ ·pAÞ°§ Š_£°ÁË06‚Zp²‰Ë8üÄš©ŒÚRÖ¥¯uQii©âŽX¿¸\›¸×J—2èi†½`†‘¬ùôˆ¬’· î)ÊžµEŽó_JÐCfA\_”JpßmPK¯A<â‡û‡œ”\Ùª°íôH4Œ9ëySÏKÊaäe"5ØSò ‹iSÂ$¥D”í¤êm‡´è^ŸÆ7pù½KÚÆS„ÒÔÜv7L/„¬1åKÄÍÿôISÌU­ÖÉ˜¿ÚŸŽû:>Î½Öœ!•i_t.64½KþkÖ¥ý4›£I{È“®>ë&¡ÉöoÁÇE77ªàeT-^ó8®Aò¡•&^ëPs³3HŠ±ç‘A}Tµ¯U²‡ú‡/…'ˆ(h3{ÂzÉ1e£s{´x\aó>aË·‚-ˆ(€.OŒ%¹äèÛtÑ}ÞÂ'~B˜oa(é=ñ—äR 0‚Þc0>ñÂ|+Ó£¦÷Äa’KŽ0°M½Çà0|â'„ùf†r˜µ'“\
„F°ö†Oü„0ß
Â¬Q³öÄa’KŽ0°MkÁaøÄOóÍ Eòœ%x?¡Q¢°ºG€4ÉÔOhó¥ÑÆ$¸ð|“ðÎÞP/ižÀ?-?¡Á2ÆÎdk©ÓîlÔE/Œj¹ ‘a–·xgÿ,HF¶@Zx&¯Š`TáE6ºÎ+xWÙ£çUUdAºü…:œ{m²GCö0d u2S¬WxšÕñ.²×Ð½Šl.ö>¯ÊñÊÉÞ)†Hœ%%c’Ðø"žFøB5VRåA§Y>Šäèê÷¦¿?®ÔspJšYã[,VXO¾å»PIÄùm¤)Aï.‘r‘@T“qþÈ
bÎ.3’Î.	Ñ¦4Õ«J\ÍE²ùÜ#Õìz€T„‘6^ë%ÒëÞg ÖìÒÆV¥2Tüüe‘îîø	ß„oþ#â›ÿ„oÅë›Æ·3À7dïÎê™ƒ-ÑŸpN?V…sÑ#â\ô„sÅë›Æ¹sÀ¹óŸœ'tÓU¡[üˆè?¡[ñzºUg¨YÃ¤F‚5È¯e“,D;f"²3aÉC6yÏ’¼éÇk_¿B|îF>-!»çxÎpå‰zi/%õ²‘zÙOÔ«p}ÓÂÂÙ~¾v£ œ‘7ÚO8§½T87ˆU
³k~¤ƒÉŸ°®p}ÓX—X¾üÀåÖi/Ö…îàñ°.ÄòˆOX—»ž$õLRÿÅcìÈ•‹ýG‘ÔßÁ”äÈŠb¬ýD¸4—Špá.Æt€	y"d…ë›2Mùý„ÕzBCí¥Ô”“¼øF>¢æ\zÖR®o)q ípð„‘šK…‘×l/ø‡Ž…=ábáz\Ißø•fðyâïÖÚäL¬Ëó^¨ËsbÍ°’-ôh‹'•õUj‹60ïq‰Ùûk'Œ]òßVR²9¨Øg¦`ÕÔË”rI¨VÀwJGæ¢RÉÄ¥LßUÒTö­OQ¾,Å#,%ÿ„>â%CºO‹G:íê‡ Ž¢ ®ÂòK´KŽY+Í¤•±Ö7TYÒIY ª‡¦QºƒÁI5ˆîZõà4¾ûÂ`p’Ü}U=8Í€ìõg™_½—Êáù4–n»SqKÆÆzU#9ÎVKã²a³FbDi·jÒ8¸nÕë¤!<U “zË{FË¤.¾žÑÓ©_¢kôüœÐl¿df
³ý+iT•›i;WÖÔ‹/¬Á c™p”¥/l'¶\ aiižÛÇÖ$ºÀjËUè+çŠcÕÐˆÖ},z.6>NzÄù‚#€¯,ª®ËmÖó!Ï}^ÙxLI`XÊÂÅì~ÞŸG±PµàpJ÷jï…’=é*/J]ÄZ¾gÕÕÈúf²&ÐÞÈ)Õô¥ÖH&“è\¨BºÞN×þŽÕô?ì!ª£Ïó/£TH»‚i™à3„õ‘“À3@^ìx´\í» À†G€läfúÌ69¹±@ava°G mR—þø×©QÝ9‡±+dê{NQV²Òý¬×Ž¦…ú±±÷•ë9ò.;•Š¶q^_2×Rò ¹Ç(a•“[¡c)Q"wkI/mâÑXp
l±Ï‹çZÁ¼Ü±ó'
—ïB„L\ÚÀñ¼ \!§A0&ë^¾uŸ€z"du{ñˆ¼Ä¤GNŽÚj‘z~ñ¿ÇŠÇ'r=yŒû7þë¨Õë,*µV*¯éÜ¡QÙÏ,™CØøJ›º¦ï,»˜¦:½šjj…¨Q…0EAÀ©4´Åñ$Ú\]ÅÉÚ@±ÛÃ h½UX‚nk¨Ï‹U|Ò‰Õ]³	¾ ·‰Q¼“0¸v±üzsdP£l*©ãÆ»þÖ’’<±KƒLTš¸°aå“äE°W‚Í€‚M~$¦÷mVàß1PòÈöáÒXó1Ýº’ÁiSx±*gR™ÅõôÛü"¦ÖÁôuûr™´ð~ÓÆ¿dþ™-¹pD›.Žæ¸šÿ,þsÏ¬É}d0ÝÝ bX³‹‚Øò?€?ºƒ´N‡a‹ŒªÇÔ§oõ3ž“ó`bã,øv'ŠÜ¡Oÿ|j}S¸_ÞÑö«ê~ƒ½Ô#’4§I,êyÃ`ƒp£0œ®Ç´ÿTóGocø×€²¿íq
]‹éo#;FÞ¸;Q‹íj2”aK×¡qj0zÎÈ)…¡Ë#râ÷ápßvÑ@Âí8tMì"¯4 ²»`8¾³ºg»8ç4x2rh4Rß/^x
Š­çPb4~ÏE+ëÀlo,ÿ“ñ.à`NðŒÆçì2ÍÆq`pÏÏ³ œÝfãüÔd»ƒ`YŽáè](0a£Åó”R¤¸tßQÝ£0FgHuw©0(KZåm]ù™
¾dH Buƒ·¨b4º2ž 1Ãxú]Cþ’—²·”SBNÙ’œ\JE¥„JmÃ¾“¿P¡G0—®MWåŽ7©¢Å]vñ%¦R@S¾îûe…Ð¢
!0í(c¨Ù~ÚoÁäŽIô•fß\“ônOÙ%Ÿt‚O!ÝMræXá`„&uvþû·n$îŽl%åµÀ£á©-ÜÒ*l	ÇÉ³žµ†
tp½ð¯¼»Êz×UÙ±%®‡$
Á@‚ R‹ÐÐ.‡êžÒ†t.Ð]ÎÄ€L`@;î }0óP±Biþ×Uç¬^óš/*'É¥7I>Ðf…ÙH*`*[sêciª•ÃœÅ×Êwôg÷-Ÿìj,y\¹g Î&Rio%Å‘1ñÖ¢­C5•J‰CšF5!‹©y…ˆ²XeN.™+sÒ$
¾ÃZå;´zdlÝ¶@/èQg×•šÏ¬eMÑŸœ ³2ñë®©— Y‡å:ál×s€‰l‘Â	·ãà0¸qÂ]@ùær;Ý±º1›îÊõ€_;Øg9ÁÎ6û®ié#xØý‘G´íø±Úxä¸g……¸þÀ›ÚNÔÌ¯q™ó‰eã'i{gÖÜ¹±\ýDííšå„NLxÑ¿ÿ=[œê6Œ=Pü„Á“]o{Ž?ŒG´ÁmG×#œ/Bžæ(ÓÝÇ>âÖúÒöq À	KF>—â+„Þ6Cå»¨Þ„/*}™±5©~‹\4b}G­©è“3Ûºc0q¯YË¦0ÉMdfT/¥Úd©!Ôã"!HÅœˆéLL‰
‘ uÝ±ë·nZT®Ð92ä)»\WÎ$aeÑŽq8õ ™.mßetáÞ$Eúé/ÐA4î&|å¥Ž&PBŠ…%}bÚ«Mk¸®
£¶|§•©Èò#è‰ë4Û§íLwÆG™ÎˆºJþêé Š¤Z‘¬Cq^ÒÞÃô“sÊäT}saÉ›\!P5QÎ½JeN]¼á¶UNf &CŒPµG¢Q(Ð’Û´rVí&Wµ­K¼
v/!mÏá&.®Q&Ëàªt
Qù—t¯¦xŸœ£Q[·ª1@-#UÅH¸”jW½z5 àP5ª^t±qÙ¨*g™~€R¶QHÞ/7¥6GLS¹{›2KKm%û‡LÉ6ÒŸ+Y¾&>¬Ž¾ M\y€
Óä’ï*îæ&y†ã¸©øþ­g’MW:Õ
•¿î+h€úGÒ8s<g+õ<XiÍ<4Àö†ÌÓÀÅÙvC7á¦0a¢R_…Á˜@znD£~-¶cVÎÙÑÖlšÔZ¡EÉºÃjúmF·k¤fÌç«Èî4ðWäWø,rƒ+ý¹ÑU¾‹Ü`CÿEîFî?Fé_FîžþŒÜ}F>ÜF~Ü&¾ÜÆþ¼ÌîK4€jÈåB*O¨„…ú¡ò»4fUIEtb€Ž›û#~T¹#P€Úp6íÝxë.ãÎ¬k'/ÆÝkñ4Ñ9µÚ™›ÌTAÚM­Ô“•hEÐ«N({Ñ@tf—ÍCu­ÀR)ZBu,4±Ï–û(	aŽ{ªrvr’3Óša^²~L¨I…íá’´iÁìÍbÃ™å×«lpùÎ÷djIó|ožÙvÏÞHJo’&|?Ït§»’š‚¤	ßÏ3Ý»£ý‹£³óýÓ\­/Ò|w´LZ¤TølžýÜßýéø`wçðâýÉþéÎùûSYY#Øß÷‹zâ/§çày§ûo÷O÷÷K[Hó—Ó9Ÿõz•¡vE¸—†Ž‰è6‰õÇ•Ú:“÷"J±ksSôMej˜yÕÉüÉeÕ…£¶€ñJ·ÿ|˜ýÆ)æ´ÍIè5fmà²:©tw”i”ø?äzrÕ2³¹wi–ÈzÂ{*#2ÿh[ÑÈÉQV19¯†j&:ÍÃ§c»Ó1õOÝ´>ö:È 5PHu²D-',5k	sk,ŸëH¸TŽX 7¹9õiaÊSÍ`ÉW¹ïhôAlÅ @7%k„ÊçÑüÐ/w¢ìÒ€
ÁÆœ:E5½/mó¶3æwvÔcE9~W5¼ð1säá¾55C¹ÂÇmVÚun‹€‘È|É·ÍpEÒ—HÞÒ—ú~+›¸MGœX³ò½èÛ¹üêküÅ‰r‡˜b_¾ÿ¾<{\Ê¯ÒÎ)ÜSõÒ×4é‡Š¦54]ÍkSYôkµ2«Ð9ž°á¡1_s‚9íB1îv® [=ÄÝâÖ
`c±¶ÊÒö]ÝïkF×Ê2pc4(þ	D÷Ê…M	’â² …éN¥&.Ó`Ú'ˆ!ŽG¾§îÍÔWvg ¡:_ì˜=øôˆÜÉh+Ó·î­c7{ËÃ3‚+BóìiŒéÝßƒpÅŒ ÞoºÑÇ-Æô}Zóþ„iB+z‚Éj˜Ì±¬ˆ;¼N(þŒ¿,$Š°Ìs~	mkáÐòÝ¿¤I€«…°€t‚‚ À<^%áðÈr}BcS˜#OˆICÄF´(BeZ¢4ñ%{x«‡E^M‰Æ›ôor‹1/)¢Ø
cWò2×küà„UL„2š³Lª×AÖ$abÉÇç«8t€U„R0“Ã¼‰&–dÔìZÞ`Š6pâú°›®	{@O¬Y0£•|	*K³"ø“o¥öqáþ«@Š
l¨”lUÑÜ‚ @rCkgÒÈã&Žÿ>AôÛæ§"÷?“Âåjå¤ ™Hú¥¯uòAöëùb9‰Ö^±ê¤‡Èñ® —@‰Œp£ègü™7ÈÌ$
 /§QøVB5laÙRÐU[OjÊuH•¹¼\Ù(Va:N3Êàßœ±®-×³ú518·“ Œ±â’†A¨ö1%NÚ ývu•ìß€ÊßaÙsd!zÝzÑ­©î<r,u”-òQ±˜%<·¥ø¸ð/u_âè™Ä9bãß©3ñç£eø¬š“{éètÌý†Š4üœã×ø:I²ú{v4ÚµBB½utyÖ,ÂùóIò™/"ýL»ÙïßN<ËtŸþpbÍš§ôý–ÎCëËdß¤…iÅïX­Mñ>*ßg6ŠSUvñor0`§1í6¿ª0•ˆ·=Ø`Â.-ô*á	¤Ñ”êâg!Ôý>A0Ô xV=$Ìüå	ë†Ûºucra™Ú`0W=PlÄ4zê@ÖÝ/^¥Øçž|6íêŽvÖ~æÅ7?à^rƒÁ™¡X˜Œã»¼g8œïµéðhâ¹±€þ&÷ æ‰ÔÜdxL	‡áà 6ˆ„Æt	Ü¨©ª <ª˜;™¢DêÏ‡gnƒbîEm+°.âà"9NÜüÈYÐ
-í í7Åø\ýü\ý øtá;7ª4‘âPDxßæÏ¾é¯Àâ€'²4“™—tsÝ„ R½u=‡Þ}Éu;‡‡ïÝ9ÞÝ¿8Üß{·zñìÎ`×n0ž´Ñð%Mß¸h±Ž‹Æò}yõeí…Lð÷èKpqƒÈ.DÓÁÀ‰"¤¾³ït•¥!(yÑUðÂkàÆ³–è…û
ET©Ì¸Üø^`Ùæ"ê>ÝV)éÞJ´•¤Z'»T*ŒJCaÊªv·—Ë¡‘ësúúj2õ¦¥s'Éø–©TŠDµœb©¨zCó{R3JfkWÙJrs2§àØN²},Tw …ô6i2sâ6Ù÷½…h*ÌlÙ˜ù†•Ó	Ü <ÑxË„b 0XÞ
æ4Z6ÖpÐEéƒ:ìÍ¸ŽÃ0ZÆXž"*·òH»Å³NÍ0·Å6¦jHÙ£N ³E-sxž5‰œ4÷G¡ÙÅH¸•†¿8”— ¹¥ ‡D=ébâ\ª,Ð¡5J‘²h”U‚zÌëÕx4Ï,¨Á'ðþƒ2é|Så}åL($ÍŸqÒåEÌX¨½:ÿ„ÀrF€¬‰¢Gšï‚ÕS'^È"ESÊjóž
UŸ“Tõ[ÀûžP³¡zÛbÎƒ·eQO¿…*Û¸ù^ÇýÀž‰K : ò„ÿ¡+%ƒ×¹B¹`•2™îŽˆâ4É„eÂDa’	º$cWˆm¹ÞìÎÿIŸ¸ÑJò+¤$ÐQ ¢z@FpàNÈ1ðža êU«Õ ƒtQ •4!4l»v.DµlÌgg"©B`+ðDŸ‰i5-<e”wYšð¦õ¥‰NšÝ„/‹ÛzµÑ)º$Òb!fIâ¸0Î1£×µ+ ËWE—ßÈ«ÚŽ¥W¶’GT$þ
—åÅxWš‚j|c™ÙØ?Aÿ¯Î hnpQÀÎËô/;5òÊÒ+3·:•©…”ï8˜œ„°€!‹ý×†Ø®È‰÷}cKíÜä¡×äûýih¶CvæSibùs—¶ÑYz©ÃüJ=Qú•L
Ÿmð&FÙÅ¤*.¾0°*Mû!yàôQËøŽBöqøÀìcö¶EW}©V’‰éÇXnd–«7óC>ÊTz6Ýúªåôä°vz2{;Ãez™Mk
oª”v™;ßaÂ¤~Î»ÌŽ|oÞFãLFœ§Ô°’!
æ.´rRÖØ0ª¹€[Àsóç¨ÀöQðh
ùñ'¿nR†ƒoÐY–Ø‰þ$ôÁ&óUï´r£M‚œÓIŠ(îú4É„eþ¨êô
h.Ò:õ~Þ¼+ø'îÉßÉ	~›sFTW	0hÈú™6Ô<¾½Nyª<¨äJŠ €™—¦¢Ü1»²ì(+šùRKbâ…†œÐîAQ)çPÑ(dÂVc&´°)YåefØL-][„U_.Dvl&Ï¿7{€uc¹1‰²ä¼óà­: õ…N3{®¡ŒUãXCé ÷)¬[©ÎÖ9¼;’0—€ˆ•©|›•ª]ŠùK®ã„õèê3å¯Ò!%é»æ’<€Šðh}Ÿ¬Ü£eÀex·¾a–0Îh”à]¹d)>i 6×Bó Z’Ÿåt3ÐŸÝ%™ä`-€Ã÷{ïŽß‘Óý?}88Ýß£ÕAÚÉiÜ_V6â–o²~±&j©Ší©%µ¸rZí€‘±SÖJÍ_Ê4	S…–ÕXímkmt:)›¤_¬wÒ<¤tÀZ'‹®J¿ìuŒŸ·IŸ—*KÉóRYQLƒÚž•ÞÑë˜U|Í_òú¯ùËDê-¤ÂN/)>óÛ(ˆÿñïÿõrM²?´OÏçz¥Oÿ_$AóGW%;fWå€gÏ`Ö´®T=%a%õ¶L+J†F»! 9óDÞ¶”¹ú,×Qheúl!È‘jð¢*ÛË×9ÊZÑ²ì¿ª+Ý;ÙVühÜ´å½Íh™µï2}íŠ®¡úœé.ïo±Çãj»o<ìØŠð˜¤ÜÎ{.ÿã¿‘÷Óx3=œ9_ÊÔò°ðó0´ãñe×]³˜<¸—5¸3î†·ÌLPÊ$Ä‡•À“YI$	¹ÝÇ«&ªÒ.‘Ø½²†4Ï[Þ›áüûÿ·ÝžëyF ° Â{&¼¨+Øvî7w«ÑnQàb™ÉQ#XZ	 æ\º¡ïƒ©Á[K}ÏòÍÄSÇÛZòƒ`‚!ÔÄè²B'4¼½‚`–KóHíÖÈÿs2&>3Äx{~âúy§@VGï¡€üâ:7ØðÐ;¬Ïƒ¦õ!ëVˆ¬Us,»Ð}Ä
˜$„„†º)¿îdÆ¸Rv9—(¢ÖAÇ©¨g%›4AdmšcÚŸ©Í@˜ý‘œªîeC©ËlÞÖ~É´f·/ÓºBÜòWÅŸÊy56»¦AGÓèç6´½Éë²ô¥ž¬æ4–§æ¶ïBi—nGîêÒY(äÁjt7ÒjiA‘ÑPVò8mlXOÚ¨Òª‘púPÓ<ˆ*ú—˜Ë¥bqw#‹Ið§6?0þÅ(ðÂD§v|›»qƒ™Ê'È¼	i
<ÏP	2èÁ˜]æ­N³c@ß¢•Îp<wbÎæüÖTÇ’ÕxÛ—ÌgÚ†£<ÿÏÎcµçr“àEMáíOÎŒIºûxˆŠú,ª‹Ù÷'VÑnô·^`ÅMÙÖÕ‰7¡«sÖŽ›lúe¤äüI¯õd—˜pâ91Ë ÖÂÃ,K™’å—.EQ~

Qâ…JÞa3Ù(Së?»ÊšR£ê*±ÅKÜð42–;³riº¬ùuOÎ¯¿ÑÀš85x¯lzš¦P…ƒB `§#²IˆŸßHy™Aˆ2ioŸ	0Y'£×0T¡Ì-KÛ?™Û¯Œãa¤ì­ªŸxnc…¯ºJ^Å«tç€3Y…¦–®i¥@ñ25‹j«ëæ/SAþ|ÅsM¾ühLu¡,õ±j]vjÎLŸ•.«<‡©ÉƒÔž÷˜äKY/œ8r£af‘Éå„ÁtB*ê§P§¤
 )KSö„¢‘„	ŠÜ“:ùpJs²¦C\ÔÅD˜º—íÛí8àö4J‰Ï€½©¿ªØz'Ioè
ƒ­|ÒC—±¨ (|#äÝð¯yËî‚ù)AËÙ;¦'Ê|f¬tm²Ÿ‹%(+Öv5ö<¡©¥MqÓÇÐtÏ½i-Â$L,@hæ€—ºËŽƒZþFŽuæ7-ø€¶›{˜ÚFxµ|Ñ"üi|Ñ¹ØèÜ/)W·Ð?ð3ßñœÀ¹BÔÔí½¾çÇóÎµm#°°]®s„i’JíjÜò)àÏƒ˜`9YŸë¦,”|³?4³¬ÖÌÛ#)£5NŽ›‹×>XÝIžOè¤}GHC­£/°I®ù$aûšµ Ÿ¹–êkë.#AXç&9²âQà¿ÙYá/Ò"Ýå•¤h4É÷bÂ-|bïQGç0–
†%–§î’Šrø² ´ªÔ‚¦@‰»)p™ÇPµLq¢–­@'îÚø2Û¨‘¹àä¾¢6léáOü¹øG¼®gÓßžÐT~™£é÷‚¦æâ´éÀoXá…ŸD9™œøHþUS0ayÉb¢Aº$L~ÛmK®ßƒ"ÀÉï[ù¦x¢Ar8;’'4¥×·&‚|Ão¶÷$`Ô§OŸ‘´ÈË×æ²A^Ù‘OòDz~B ß‚Â—BÄks/14 ÇB·oŒÓÙj¸ÄëãÍƒp¦Æƒ!ƒñðœq®SãÆœH]çÆžvÌ«s¨MüÝ-N7ËÄgyÙt½Æu=ÌH€¢²X([ðÊJƒ'¬>˜ÁãÌðìÈÁ~ØIp#|3EãGàIý¡vcæ¤dîh}Õü¬õÂTMÁì„?b”"f‘‘×[(^Ö4âÉ%œµ¹8[ƒ½ÎÇÍzý}>Öz-6LÆL„­ÉQÅ×^Q|ÅJìwxt÷sÄŸ}Å(ð ®'"þcÂ°™\ø(ñ\¿gY°ž(8Ÿ$¨o†T¼ò²à—¬ÌŠ äLo,ô-	¥Z´ˆÅÂ¾p{¾€xUµ}?×/sI[àšÔºô¬¾ã™åº–[ñ`qL¢2“ÿhâ«aŠë4¹½Üša;íØ[wß}¶]àMm'éÆg¾*ÆiÈÉ
ÛÌªvòõ?"NZ<Q†Š¹Z²ÈÛ
§›D<Ã<ëÝ0é-Ùóäx
ÅOÐN»b|}°N—õé2H§[³`8ÔÕÖB_Éy‚¬ó‘þBr¯Úz÷¨ Yg¢Qm&‹çån«Án‘Æ)ØPë/JŸób´…6±ëÔ©”C*S0
	Ò¼êºÐ[€6\¢Yj ú9
±‹“ÈR÷è_QuÑBš3Â»ÕH‘ïa¹ž§˜ÅB<Ç²±WfÃÝ&ÄŠ÷žªZI²ÂœTðfë|©Xgdùh€(vR26F˜6/aÕqpëÓvN÷ä„Y>ŒÝtÙ-Ú]œVÒÂà¾W§ñ^VšŒ¢Éen&Mña=®–/i­)òd¶]w%›áDZôûR–Rˆâäý9_WõÜd›GX“™HŽWw@øZ:JÜÿÊÇ{ žÆ-¨Ti™º?Wm¥&ŸplqcÞ†Á8Sk%¹FN¼+ÝêzIîbŠ{ÒYµ&`ëµëe¸×ûÈjìÖ‹ŽP·¿ø!)·r3  ¥ÊñŠ²ñõ³ßÍŒ6qk­™üÒ"$:˜ç’èZÃ²þkëƒ¯Öi|„ÆHIÁ<%ï°€6ùãÄ1BáÃ!ûâ­lØcUŠº²º†‹A5“Ó>uÆA‰	ÓÓ~`ª¯ºñ)\Eï…é°#ªlFø	Û"—’wcÎÏ_Sø"_ \óãÝê	ï#OövÎ~zó~çtüq5{Ü]41æ•
‰\zÙ³¢Q?°B›&¡³fó	G)d¥—zeQ—úú­—ÛOþ‹
–ŽKý	T nq}²‡ämÔÑx“þ7¥H^&iD±Æ8.'x4r«Kò§{°vi·OËn@·£JÙV!ï<¨j¼WnÄU@Vu•Z­ªyÛc/mµtî„c×·d]ååòüëQ¯D™`‡ª×#pÐoP¤“DÍûÃ3iºmŠŠ¿:(?Î
¾r›Üå WÓŽñõê¨'yûIéå£1‘~†™ÉTYöÐÝ`<ù±]à©â<k	ÿÓ´&‹R¯v)m¨URMÍÀŒŠ¹Diƒå·|§šòÔÖÎf9ÝAaìMex÷	ïßW˜!×ÖÏ`ìÔWœ¿3¼—wi,L‘4o4œåÔ‰ +ü±0Q˜ýr²JÜÕs&\
*ãTÏø†›-3¦VWóY’¶^å‰ø/†såºËfË›9
Mé’Vy•OøYl[XxB®¥!>Áòg™O Oì|X@ñ·ºïróg"E«hõ,bçÕüDbÇYai´ï¬zÚ³QpÃgÀ@'apåÂÔq¨(®'Õ,å:L¹àQ¥Z³Žì´'VEá10bN9CR /‹ÄRÞ¥è¬`X´`ß-	[RÉÅ”Þ†ÁTêjÈoóO™¦‘”¥zUÔÕ¿ä~Ã÷ÓØ|Gé{ëdù¦JØ¯,Í%U™ŸQ÷m’çÈ×+…×œØ¹a.v&r´\ô\¼xŒG·&“0ÊöëÑšRV2ëHˆðÄ]1ªYÙ\#&’—Ç¤*ÜhMú¦e¡Ð@nÒgÀA,gO¥è[Ìà+ÚgþÑ
 ú+`W¹ ‘ˆÜ¸ñî`¿¨@˜M¦ø‰Ýoqn:a$qÚ}'‘.Uò¥ìË
†®Mðb†RÛ›ÙÇžxî€aOœ˜ÒlYêÁ7(Ún´Ã^›e\Á~8Ëí±5i6ñ¥ÌÊòÜè_ÚZ#í‹µ#Ðš!ÞW»++Õ†§@Å¬sí}„‹åFrüSeN–Íàƒ.œOo=°e7J¾b¡Ý
ë=9…Yã“3ÛºãUö?Êuûl­	-á3Š%0´<¡±œÖp´ÖôõöDcÈa;y_±ÂvJ0µ½8YÿM¬§¶ÑÉÑÛ\‘›W×;ªîšªŽš*#SÉ^âú­›VÐWS÷z´.£94‹èNÚ¤	žsvÈ>‹G­kžc”_Ü£½Ö%S4|Ü]
ÞOyÛ§¨èÿš¢}…ÕA‹3vBË³s^“ï²&¯	8ˆ£:»2ˆ²°›Fîì›òôÙÈž¸ð ÓÛDïÒM€·dÑÀ;×ÀÐ©uæV»qkôîK@ î
ch“¡S£4¼Õ–W¾?.c›x×Ž?u*}þZ[¿öGC„L2ç‰QåzqóuÞC¼ªðršy'jWíe¼Žk0ÊsPÚRükå ù³ø˜Õ_§|PÓü!ô®QUNŸir3®·Ä´@¼,ï4k:¹ ¼4/ˆøÊ/žÝát56{×y]·•ØËü„U
D´WyÆtD)×¼yÕÓ+]Ó…FåkÔÂ.0™½«s„‰ú«ACr3&¹2A&"5ê"Îø‘“·l=©ê^Õ'Ü¤n²ð‚Éß”/±FfîÀšô°^¤Ç?$UŒÃ™!qªáÏ5„		ëZâÁÆç"X@ªÈÑsZ‚ëÛ‘ £y›ŽŒUÔˆÇ1!@q“HÓ	™‚eà9mÚ
„ÞX{woA2dDz@÷9·É5ûŒT¿çÉøR¯ò0*žÅWH§ÌîLÃ*ºª^^ŸA/AÉPG5hÞcB)+dªBcLÈlM¡“×Äv•Wîâ4ÖÂ™¬ÏBc+AiÇw|½&¨* ÛÒn0hôƒ˜àk1³á¢ù®½´B–(ö-`ŸYNzyCHuý!R9fm«š3»GðAÒ7©ï}”ÍZôú±©ËÝŠÕþ½ìÊWUNæ+Š˜Ô+ÊFLf+‘˜Ïr]˜¥ní$6ÍÀ:Ñ…j†×&å³­þ9Ûˆ&›r›t@j£ÓŠg²[·Îžd{“›x"™Ø eK6ñ/Ùvå&¾žgâ
îSÝQ8Ê0ûkA:Æ]†+ädtHžxÓ¨Ð—…v^3è.Œ¯å/U<H¶§aMÊŸ$'*Ð«ëkð(ûè¨š¯˜¸~×B#VRgƒŸá„ºîŽƒÄ¹“9„"„…þðfÄJ¬vm©§ôš¦.Ë¼ƒßµÛÔéýêÆ£fã|ÿèä¢±,±ai—/Í—âF°AI„àºAÐ¿,.¬Û0îöÄ@,>s2_Ö9p¤`.s[öÑô\Çq¹´-8ßgEÈnf÷{M ªÀ%5
!gJSäëí¿Sb…ñNl”'`âHÈ°¿ÐÑ(¹0ÆPµ!©™âPì5¨ ‹ao‰¯ÿBfNÜ&TB$}Çnp’dJXJý‚_ómÑn”ˆHß½–+µkþÚm"s×^ZKâhÓ>±úÅ]¹ ÎÊ$ÞØ¶bÍ²0D™Û¶€…U
”í£ôâ|MkÉ7$È›‹ð,¼W‰íj‰„í¶ï`œÕf
½[Ú—i·Û|º‚/®½I.Ÿ‰ìÚ÷øÃŒÊ³»¿ÔMÏ¬W›$7¿ö†ÐÁÖœ;ñ&¾.A_Qúàì}"Þ©÷O½µÚÚl_5GW²þWÞ‘3Ž]FEzÊŒZEÚùÝ% SðIIJÁµ®ÈJ±½¼_¿ì`æ¼|œLÆ>‹b«ëÓÎ×¦e/äâ¬Òµ'auQ`x¡àJJ{KŽƒ…È©d¥ÄÚ,œyÓwZýmÊYØŒ.)›øˆ²UÊ”3!ëq…)Þ‡9z$aÀ„é+ ¨
nÒdYìÕêÉ±uí™ùälÚo[ý¨°(›·~H!0¹ÁHTHôŽ«‰fŠ ŸB·<QÄ0b‰ÖHž­aày}+ÔÕÝ1•ÒÀ„©Xýf³J½·àš4‰®U£J•é W46h¼˜aú
,%Œ¾††QKü—üÄtwå¼—bAÊbOÝrùÃ…EbÕ‹Ò¦·ÐØ”£ÁÄòœìx PhëÔE­d<eá ¢YŸ(Gü M|›ß%ÀZ³ N;½‰Ö.nM*ï£É=tnàôñR³Ýá(r‡>efÅäÎÒ ´Ž5>øýÆ±+zË’ñt
åqÒÀ^!Ì* y­n*ªL¦^¤/¦YµR¥ßBeæ¯ZRT·¦Ñ!{ÕÏhfnÍáèA›©°]žhšB3ý¢'fžæÙo"Ó•)‚œpè¨¢¬G±ô]–Þt¬‘¼˜‚°îÏœ:ÈÄPéý„”C4Àò½$o0ÓYšÅ9ßIy¨Â,BÙ‘JÊ;Œ¨ÿãª„£½_£[]–ÿ
Q•”£íÞtìKB•˜)+Ù&úM¸K+Øýêâ"å’¿TØM“Ÿwá€	§¾JiW²ó®<“f±õ¬dH—s"† s`ÑÀ8hõCªC a´ÝaÐzµÑíÁjE˜¸š9 _þ–§ùn¹²ƒT:Æ"ŽE‰«)©þœ“Ù‹rú¨õq5GMˆ¥›$"òÈµA‰1KÎÂU"¦©'ƒ dSæÄ<²í.Ã¨! z1êR“V‡ÐâdðïMkUNø_ëŸã}oâ.,m+EÊG0Z[@ [žsã¹ÂäÐ–=TûLÅ6Q0T”8È« ^25G“Î¥ä”¯ÏÃ`2šå	çxé)SÊhðWyß¦X¯$c;rf#Ô$B# $Ø®t4êDtõ¾—M
{4ô=1$Ä´, ¬‚¡FŒæ)ôÝÇ1¦JIœ'O€N¸ µ>¸ˆx„ðLÌ+ ìšaa¦#õf«ÔãÂ7-,EÓêÑ¢öœ¢}+ç@ RzHƒò$*¡|®ï;aJÈ”@rW* {£ÜíŽ‡º`Ü(lÉ&U&Sáeyqñ¦´,…î¾ro™û'èÿëps–t3PV:áI ’ælkÉZÉWêà%)Ð‡IKU&®ðŠL‰jþ^ö¥@WªLÂdrŠ•UócóäªLwb5ä©Ÿ"Õƒ2U”Z…Š‹aýeŠëz¼®¶Û
^Iæèh›KÙ9š—’»0ñNº*|Ó_p $¸Ä‹-‘¾eÅKK^;–¦¥òÁRHIs˜=k ê²‚‚¥dl/J5}¸“„×•Löëc§ÝsÆ¿‰){J¸âo¾H6§‡®?’Uò6b­Øb(œ8~¢t¶âä†€°“˜Æ$ÁÎRÕrbaPŒ!ï¡ƒr\ÒÕé‡ÎR×u–Ò-Ò„u‘&°_”IJÙn/g9oÂiæ›>•M¶ÀrÆgÓ<á‘Ij]ýP+©gŠ×„ÈveÇÙ×:Ýlçì—wäÚÑT+Ê››RµŠDîß`Ôúú=ÈZ×Ž·µt¤Öí+@[ñuùû‡•Obþy£2í`0E¨=tâ}¦½™ØÍj}RáñÅðÇS.ˆþï‡˜ÎœJ„¨àŸ¿k·ÛU@GñØ;Æ˜v'þž»BîÈÄ½u¼Sôm’5r¿ÜŽGŽß ·>„žI˜ˆ‡Ö@ak˜“ŸïN³aéb5ñÞ6Èz¾X˜Ž“ ÏÅÉÎÙÙEq~"Y¸h± …‹Æò}{â/+ž:‚#Ãe³­L445•Û4ç37ª·,Kôr6†ìpñH]<&8Q}&ˆ<ûÃ¹€žÀ¦hä}¨š*ÈxBUu.Â> È`DÃ$5QÊÜ&¦É‡×¨ÙK@sŽZ$é½'é‰J(–¶fÄ¼—Ô–Ž›:ªÈóAØøÆö¦Éªs,Kog ’Àfnæx{Óx¦–R5A@PÁ´•rèS`Ÿ¬[¨Fáj4°¸ˆ»wÊ²´Ø¢ÀáJ9•ªlÍ<¦åh\*ë²žõT
õ$ìÔÇ»tõyéœ‰Ü*Áú{‡ë5.ÓöY†¢ÃˆôÓÖ ¨”òâÇ§»äxŠ"ù•1ªï‹¿î.,–EhÆG~aZ÷ñ‹¿±P’$%ùÅ%E&¿ø6¼Ès j´xQ’FöÈÛ$§Ý“Ÿðú9_ØXä“EÝYÚ–PµÕWÍ1¹*U5íªR"º¬yˆ/Èeì‘÷“j˜6=Ðu
§-iƒB„þH;aˆšºMú3ò>Z>èšaRŸàŠ$??¨vNEÚ­ábµ!ò ‹Ôs•!¢_”k¥ãzbÁøRD†ÔÅ£´úE°YIAúÉ ¯öáû½wÇïÈéþŸ>œîï=`ÛçÉ5S–ZÄ!IäZ¬<¶V<J+òþVpnÂ?‰\«¶`Òƒðý³3#?±ãÑÀyUÛ›†IØçxl©²˜Ê—l"ö˜é.ÕÞV_H_-£¹psoXUöhÅ“þ?   ÿÿì}[s9–æûþ
Xã-‘Ý"%Q¶Û¥±åÐÍ¶ºtkŠ®š
£”"Ó§(&;“²¬á(¢_v_'6vöm#&¢Ÿöwõ/˜Ÿ°8 	 q9IRrÙ­Œî²Hf'à\¿C\ûÚ3·þ×þûÿÃ•4
íž¾¾j–Õ¨h iikJ¸ò)½É /öý	]µÊ½§[ªD‡›£lf`_ m@ZNƒþ(ð±B÷¯ç¬x}.ºŒa÷ý%º~‰;ëzÓb!jðÔ´•)xõ
KÂ-ÌB-«Sõäü¿ôÏSë®£ñô¼Šr¡JL…o¹—Uùÿë7¿*·¡äh Šw¸ÂJYc¶eiÄTZ–g&WÌ?ønïŠ;éÉâŠ	=Æüc? ‰º7t;­òËÜ¢´Ã;7„9ÆC»÷‘¹Q	c8>¼.qœª›"P—j•½sfp«RÂÓëR¼Ì´ªšE%™Oˆ(£4n\§Ñ¨¤|Í<þ®˜åB\ã­4-/D£l|¨—¹¤wÿ¾‚y±SÆ‹†t2Wð¬ð‹f~¹ðËÙ þêOáW
®¾a’ŒÀÏA†‰Q	?ª°o0QÏ¤Ÿnb°’35I&hÐNlH2+Ü"3Òˆtfºàç§ãþP·%ãq<Xl+‰`1Ÿ’7IØâÀèƒk÷3}«a4`L£“ÃJ^‡Iy±ÝÝbžkôÍm^PEµßß±½K+ÜÂ
%“†)#˜5YD=å/lŽRÂ‹™,“ã(…óŽœŒ’ñ|ÇKÃÈöS™~H*Æhž³ÝlÌr_TÿÝVG¿‚üïÌƒfIGžÆ…fÈÙ<h“Z8$’¾$çEa£ü[]²XR_‡¿7;! $Kõ8ºY"²&ôIÆâ¨;ÌµÆ—ˆ,}ÞdKDø^"fýí%¢`¤-êl‰(ˆeò6Ö¼¸‹ý-nb_P-9N…Kú°Ïò×·¿¢õKo¡w–ŠÏ^V!tM°iÎî£³ÂÜ¦Y¸ž¹ƒ ò.r[ØxÃš±Ô@ò':ÖTMÃ¸“D7–Øv¬ûÂ†€ˆ[7O­: ¹È·ÒZµ«Öü¼ž’"Î£¦Uê*åŽGO•Áo«Ï…1`j®R–¦úã#^Û}¾·Õð@JÙ•ìÿ+ÅæˆÅ=Ê'\B•"ÑÅŒ³·‘ ç~Fï1ù¾ÔBYv&bƒ–[w¸À·CergÛ²ž¬È35÷êIÉŒÊd~—ëÝºgÙÌVc‡jÅà¯»ÓÏºýTà˜YÇi&×sÃäç:Û)€«@Ïhû¥&yÔTÊnu:Á´
^Iú‰ù á[*ªG™Ç­cµµ°ý??\6Ú’8zr7ÇÉëþç¸WkÕƒµ9d_¨zÜ¡Õ<Q±U¿ÔLŠÍ˜I…²[NüLêGâÍd!}Á™Tñm¿ÔL
ÐXc&Ênu:}3‰òô¸Ïlæ6~³y°ûËÁæIg·ÍÞ€–~1ô²>:»Ûo÷¶7÷9:ÞmovŽxG¸{AŽFBœÌ««÷Úw´#“ÍúÉœ>ÄÆO|F9ºîl9*É—[öÜEðfYŸ*lý.ÄÑqbêfþä$µ!Üw¤vd(9acÎ|\häµI/Ãžgý!9£W(ztU¶˜Íá0‘J;n_¼³ù²~8æ0Á,íWät,¤ÃÞ\þ•ÆÓòÃa¹ŸÉcÁ~è	~èq~À¸Ý×É©èî ?ˆ£óXíÖPCÉè6ñÑË<”“ª|+¹çž¹–Ù—¾0Ç}ŠÓqŸž™'T‰àDô°9ÆºÞ«4{á{da½ûÒtÜÓ(‹7¾ß‘žûÈñqÓb¹œzô˜á£]_C`-sª³ýóåÅCz×Ž®‡u¿ƒ5Ðó2„°,œÚkmFMB†=ñ7nWá—9æ˜B°®O[I3OU;/¶ua¬¯²¦zœ¸ï!ÄS-[O53¬¥•.]Àåùu˜ŒãuÒ¹ègäLzºúÄFb1êÌëÑ#àh§çt0u|Vo‰¬I^Cx2âSuàpÏÈ%ÝX?A lÿ£Ò
Â€Å_zlŽÏnÞ«ÚG´WFr-¦ÃiâöÌ”ÕÝs[¯¹¡‡ÿ›õ[Dw.Ù`Šœ`ƒäGÀ¹E”É|AÖ0\àø<¦»s¥ nƒŸèjÌ±“(P§ú©3Ù(SíÄ¦œ3j¢“K”¥‚&ÀÁr ƒé%…tBÀb­`îîl%#=—žÊÃsÇ•ô‚ðxÝ=—½01ä"ÐûJÞf»{ÛÕ¯4©põ’³†uôCžØ½=é3xn~>z×&;ï:?“Í““½7‡»‡Ò9ÚÙüùŽµŸÂs\&ÃDuÀi?`¥“u2úì#O²ÌÞ{¹õ„€èw°Ú–T€‚ØQHè$¦$Ã`ˆì\äYGÆ „TÃÄFÇ„Ç, ¨Jþö—ÿðPåÜ»«ñ3Â¨m')D÷ýñªwc$OwP†rGþ=øÎ:Üä0¬“¼zL¾[	Ø(yƒ{EQ‡ž£ŽÇÍ–Ï¸>2ºO×„Ã^	•úÃþ”‰BÂéhMý1ýrC•+û²?èžÖØÃªzîívTDÆ÷=ZC9ž¬@œGhÇ/>º9Da˜ND¸€7ì¨¸x¤ìw”´L¯bÌê¡‰:ÆæÚ£÷•‚åú±:ÊëºŽY­nÞÈ—:«Lþ²t“ñ×Ó éø5¾y9I†G“'Ã
écö”eÜú¬¶¡•g2%\Ûœ=W‰ZÆ#´SË–³x‹t–kiK)kXZ«k|AÒþ
¨Bÿ×è¶É¸í]Ò‚ñ±ÀU:Z°›@H«þ…îÃˆ\	BqŽ‚/(îšb¡ïÖÅO,[SÅÕ©$2ÛEßP0É‹m¶!»j9q¦/aAuøPè9*©bNB|àœRä5uFüñX3ð„œt6w¶~†;ïN+é½xâFNÔc¯•˜ë°àœÝþ¼¥7±Ý4ŽH­ÐëTî{2‡|2”xèGh(®\$,êvææ(ú2¬Æ¼JŒ²`Øé¬6¶/ '†ÔÚ{Ûõf^m(/žþîÎKÌ]ˆa‰`X’”°=vGÃÞ/%åD|Îç†ê¥Â§*t_–ÀÍ–Yð`-PðàÉ|
XËŸøªäW`N*V9Ï‰¨—øšs
]WÃ(Të@>,è;C~ÓþwG)UÑ°¬<ÿš‰¨ðÒÄŠY&ÚE#§xE8\mª'ªaæ"1öì%êºñ/H‹WÊƒÜ²$ =±_cú­@.Ø‹þpt5ö0Àøf$öHç2hEØ¡âôåÂk(™o[`)_"È
6­ÁÕY³Ùô5% AS¶øù«ÿé*No|ËŸn$IOw’X–G2¨ÅMžØd]x÷+<!œÂžäÈ4¾'£”çÊ ^©°{•­«’«1KOdµÇœ¹Qø½*=Nv8_³(šÊø*ipMÞ/ÒÓnq	ÊŠSÖpö©a5PÊê!]sxp¶æ?,u³c@I¿¸´q¢°ç+žUÊ —Ï²ƒJªùÒÃ²¥}•²ø•–Þ€)_ðAÅR4+­S­fVyø{p•ÏâWÀü‘æoÏ¸¢Š6)ß2Žƒˆ•E]÷Ûú) Œ8QÉ~†RöÎ“M¦æiå€p^	gp^Bç±w
ÔÑr¾·4Ñ»XF)ØìÉçÉÝM¸+ørÛÒ“omÌbã’¤øl ¼fógðÞ„?§yò†>ü£ÏÐº¼LN8˜F—€ÑÆgä½ò»Í ˆ¥e‹Õo%í?lä·ùþ.t>	Î[Hm»]÷a.K"˜YiO·|ç.äU;ŠyœÞ‚&£5-­0-ã¸{AÙM\û]á×f¥î­”Xî#µÎ&j†ÒJÐ¢Ij³Û¥=ÚJÎý^œÐÁcú%þÎeb6^-	a–ÂâM@ûíg„­UúgD×«¯ØÙ
$ñg M¡÷l8üDþ­0% Å{=Ø! ¤øI<®½—ËëÔ#W]ýÜ’Ÿ‹©çŸå°ÃÇù~³•ÐŽ¢¡¯}NyË·­bÞŠmë‘A|ó"Êj`x­û‡•7?·ÛhhûïýG*Dgàî2ö¾I,±ÿ!¾ßÛ‹,Iy½Øœ`¤Iš´íõ1rm|‘Üú*¿k¤è{„FÅW%rÖ:
ØCÑ„?œž¦–ASK§©uO49·•ºÎfN\ÁÆqñeœFƒ^N_þQ'Qý¶•}B¥õGÉcr‰¤Ž®ÒÑ@Ž¤ø¤ª|¤Ón£œYŠI·†}ª:ÃeO©Úî,Ô7»1Û4ŒØœ¡à	]Ã›½>¯¡¾ÞüGÍDÕÐ	‚÷[KóH¹pUõ’ó&«F,2™*#´C–HöÎ8ß•¯43U­[J»} x9%ÄÛ#¶Ø!cðTpÉÒá01˜Š¼ŒÊ÷c4:|%«ÒW¢‡ýd/¿à¦–µÔ ¬0­&Óå˜Ð ]§JTQñÂaNa/‹öŠÎ‘õì!ÈÖ˜*Cß‘OW
(,£.fyW«¾ü˜ $4v’ÃÙÍÉK„ad¨•cŸ6xPªàØ§gk  †u4SÂ¿ £Ý¸	Mœ£ò”dç£8É-*..ö3V’‚éÊ¥pMø‚~ïòî‡"?Ô^Øò–ì—¤dÝmRþ²Æñ\E¿øíˆ”•~ÆÉ~r§Ût¿ªÕ›ýawpÕ‹©¬\îS½±Nt_y…ˆûèJ3LÛfKñÊ;!È ¸€ë‘»&“’;ã¶JÃk…³0‚»g„Ï›c‹‹/&ôíª5ÖÐŽ±6Cð>Â?ÂM‰É¯Ì¯u}ñU&.(úsÊVù?Ê÷Õˆ¤œ^™48…ž¬hazO¥ÏW¤‰C«ò io³—5tc~Ûvq¡´pÑ( Ï"(q®hÛ	&§¥ •BL¬ŽR„çˆúxÂ«
QnpMÄy‡Ý)ªVâ~dÄ™¼?y*…¦`ùH‰"-¶Ãª´ÃøÐ#3„d{eC	i˜ï£Ó·R76î*%èQ¾âÈ+Å~¤‡GV	,®‰* àùGP^y&ØSáh/]oy®é-t}­æi2ô¤ò ‹7×Á‚îåõó™D‹pZ—ö±cÀcöÜ®ø[ÍB©GV\–Sýí¦P„ê§wRq/c€”ºÀ%éðÑ…"’¯ú TxùJ/ŽSókRI'aíÛ<)ócTÒˆe{ø‡1Ë7PüCõÁ¯n*Y?°õ(	RŠBÔÕÂÁ%UæÉ3ø0ó°º{KûëóË¿#» GåŽ•¬H('ª×+l_ÈÑ!c	W«Ìž£±«pÙÚ
ñVL7Ú­pöY$$W]ƒÖÂÆf¯Ç4»h ²“Ž"IÇ•ò¦ªi„^§ÊŒTL<‘´Y“O”jQ#%Õš_/-æ ÛÙv '°vQ€\Í©ÑOSc:‰ðd|Áþ´PÊls×[Ð¼÷ ä€Ô9€†¹÷ÃÛiã~EJÂ2ywÈóŠwwˆ€’;!oöw 2ÜñÑÑ¾soåÃq{ä•”E|‘BÊ¡B,èÁ?¤%±Ó»égFJ(w;Ç‘“Ê	Š{y†ÄKƒxb·©
ŠÆ?r™]ë¹}.ZwAÐŸíö[ÕîènBô“­µ®‹±XZóû|VÒ?{ë˜;~
Z<ç±'¬;8ÏÖeÕøvYŒQ;¬ù®OWð^Þù${Ù<Åß“úÝO¬d«=õe«!=ÆòÔ’ÙdŸ6è¶Ù4ÙØ%œ/ìÉågql¹0E¬é“Úòü’|{’2mžÆuœ$D$­1×É®M~kÅLôñ‚ÔTlž_æ´¬‚ ×ÄØ†¥«òSÔDgƒuœcáF1®v+‚ÓªÅA™œFk:“¼YäuTœ‚Áü6ÄkÒÒæ#¸ `ŒC7W­àè^©¿>ºÉVÂºþS i	°v?PûZxŸ²³(‹àd@idº,Òø¼Ÿ±±2’‘ðØË£Õ9wsî ™‡‡fMT–Áa"¹MöÆÌ´íÊu$ãd>?Í ÆÊàÞ†TÅËžòqM¿‚<KÜÇgŽýÜá¾-bùY$pÙ«?½O¿‚+í.^ÔíÓù€çéëUÇ­;r¯¥%Û^ùîÙŠæðUO1¼së­Þ<Î¡9¦ªËÞ6“´T~Uš6˜¿JYg¹×JŠ$³¹®T»É¹<õ7¨è­qHkÏ±€«eME/L5ÿKÕÁA»ª9ÐY™Âéê4òÏÀ×¶úÂÌLf”rZ64«6U4™±Ûÿö—¿Nõ †š[*ÒSaªªÜêñXˆ©½"˜ÖSk¸…Œª˜	.!h ­Ë!•!‘ÃeMD÷3uuP;e. Àªy¯å>íãwÕ§ÄRD¹=´±wØØ~»Ù~³ËÕ+²³yòvëh³½£ÙF'ƒÔàVÇ´ßÝ‰²‹3À~(•	+ÆñéT¦ºIáX(W òm/oECÈ‘1­µÛ™ü47§ø©’|œ`ìlkÌÎö,·³}à“&Lâ$® *€xv~A÷erÝxyJØ†aQ8\¥œžêÝˆ?Ñ÷ËD½•[”èö>ª\ ì}ô¾Òéò¬Žm¬ÚD.Ü)å¨ZNù ëØª™1‡œ¹ŠYî³U(úæ/X8Ô]ÒÕæŒª
‡S½¸h¹á=½`†&Z<Uˆ6¶"·…Ë-'-8·®µ”àü hJä Fç¬‹Ô)«ÏŠÅ½B…ñ‚îšÌZ–-ƒ:—-‘KF¹4Î$Kl_ÊâXd·ö®Æý˜~ 8ôÊõ Úô»€mNØŽgc»UÍaI›¢q§@;çéûIJ¾£Û:¤Y%ä˜Žªþ°Ã%ãŒÐ-JàŒÈ!×z<´›d±k¬Ð„G:ˆ“Å¨æ,Øú¢“&£‹oÝá"¤Çåx‘±!tðŽ@¾é&—£½óR;í[%À·Ý‚Ûƒ†ñ5mó%Ñ1pB®¾Üz¸ÍI2¬E¯šœTw+àt4Ú€ý–òñfÿhksŸÉ$œTøV¿±ŽÀ~PŸ ä}ñ˜™D|«+_z>AtLýó8=ÈÎk§›ÝnLù~'ö¡tiŽË‘JXcÇÃÌ•yÞ’ºŒvA
`Õ†”Þ_5áW†/­Ñt[ož.‘Å8M“ÔŸþÏÍrŸ¼ó—,óÎj|è)Cº(ÝNSWSº@ÇLp£LhIÅA2!rFi£eÇFr#™è3Ï<äùÜg¨Xìc4ÈxZâ#+o—¿Å÷/U®¥7uíU~w½Îl¸](Ð‹dÄ_˜1´Ë¢ò-Á
”ËÀr ©RÜe\DbÞ’S¯q†gðýÉstØ~ñ€5Iô¥(»v‰?4ƒ…(ˆ°³ +îBp0çùCˆ¡8|_')ðu­ë_ÝÐ­lÉ·Éd²b{¦<à^qê–qB_ÿ"M XH<žÈÇ¥ÛPJÌÖ$W=Ò‹Æäß>‚- ùÕ½þíÓéX§:é=0Qý>wµj  Úá©#ØQ×¸XG¬`%$E9aßè¢ÐWkÇÑ ÁÊ‚`­3öãK³IOÂM…±«h0`Î&˜+0ã(oóG¶¯u™ Þòþë˜¿âPd—‡åUnùµ ¦šv-Î€¶i/®£l¶(›.þ˜e³*w8&¤"°&Ÿ@†¥)&0 ¦é²IÉ7g?!ü˜xîÉ¬UØ}œÖ0ëùBgDN/3°Xl.F É˜X·$À"u¼b»'d‡ÏôŒjaúŽ_µt£Æ¹k7Y¿4¾5u1Q“a+*×$O1)ØÊP%[ß¸ñõŸØ£¿Ÿ®ÃñÝÒßO˜¸/¢ØQ bS•ÞìÈAá¡ãª™"œ‡·°Áª¸Ñ9—‘ù±ïz+%gFOöØdc÷÷í$SÔ×1¸{°šyíb:ÈËä0ÿ³¶×^>l{£Áñc¬Š*ÊP»ÔkøïûÅ= Z<l/~PRîu?uÝ©ùÍ¨ æ×%|»“#ÓÉî¤í<&µ“örg^s-´¦èGÈ™¦[©óÖ‡©S-MZõÀ9m…¯tÚ¹.Gï³h¨P]:9¡Ì!nì×ó™dë×†Ð`“˜d°¹ENv÷w·;Gí ³‰\V\/Z}vÄ»Sòr¿Û‰Î„¾QvfI¼e¦:®… –5÷G!cæï*.6#q…Ù?­‘a){!n*½”•+ LAù(ƒ$þðóØY—”ll.PærCå@.KîóZ©Håˆ‹Ë)m9_þLA²¯§ZT£ÄŠT¦o‚™Ô÷ùø¨Rº„`#Yv6e^§òGJÆ›KæÈ`Ì'wqÈWƒ8ý&xÌx¥oÍ˜a¿?¶¹é<œÆãw V]e26>Ê†~Ìf¹©ß“‰Wù˜ë8åï\‰·ØCtçÚeã Åú·néou´!9–¼GïÚÒ>:éì–eÁ‰WdaÆ"»“fy™¼#`¡D¤_(OuR¼	äh€©_byî´9Ç2Eêu’ž’1yIjý—nù{½WëÍÛá+Ê3HmÂ½Á½#×Rä·Áô×<§Bê6/§Õ#ø]2XÿdÞl#EPú¨ ¦|×mÉQt[Js5ó ©¸™Ì_4Zì°&ñ¦kßCè}ÌJA¦A§31Æ…Š£ä¬ðMÐÆ¶¢A4ìÆ®˜J{_¡*VOµ¼"+ÙZìK%¶eÕ¸j«ûR\m‰­®âÖ¸·ü*å´¾8@6Aå.È7}Íò! cÕš.þj_²'2>á‹P4Ä?["z1aÆ”6Q_m C@ù-Ž êXHi,Œ­éLÔô…ÖÍ-$rB÷¾ä3¢}Ù˜øLaOûƒ5•…Ž­*V6’~¨¤¶¨š^Vmr7Ï›|¢¬uÈïÉj(;+'¡Ë4¹„‡÷€Ö`­Rqµm½*¥Õ Áâ›äzˆˆ^ãœáqó×ø†Ÿ»0u‹þx0~QÂ{ƒ˜r+óe¼6ÐÉòª‹þ0,ùÜžÂ¤5fNt 1D#™o›u£QŒzÝéºö5ý³ìŒã—'˜É'æ	öœ+1Æ«¶ˆ²rá½ëÆÚ3u­k»(]óþ¥	öÑ×Ð¨ç./ÄRC0·OÇÓ°\%ÖÐCÉ­râ~à:_B%­þø¦ñýŠ»ßôYékû&8XAîN˜`º=`šÉÇO£W—sZ w®ÎmŠþöÿÏLS4ï¢í•³“§à}¨\7Ù²t¼«oê¸>®lT˜ê<¸orJ_n&I(€ r<¸š
Ü‡‹ÿ’¸Úä4H$ýîŽ6s£ ãG%fqEˆ9W»%"°xÀ±©Wd«)¸iæ‹Á•\÷é´ðc“Õ-ž¥Vw¯o¸ÍÂ¡òa®D2:î£B·K×°T¥Øn¸@®5<7‹&$Ú*Ô€cƒ¤ùLÂ¬?u,#åš‹¸ô‰p…_àÍSB®dž(Q´1/Ìg–í\²”Ð,µæ¬Å%—Ê?ø¨ñÉ²Ëä,Øùˆ¯®E>öÓÌ§ìò¤Kr,±ß7›Í¼™Mø©V‹–ÈB¼¦ÀvD£—Ž°« Q;äiÑ#}ÕÏ'œ†3/ghÎ¦¢A˜9> ^ÎÅÔˆ¼õ">Kàw^ÏÙëýxM/ßÀº«â1éÓ[Wþ‘þóB™òÜ^Jú¿ÿ}h©+ËˆWüKê}Ÿüwñ§hÎKº°D;l½?ˆÆÍƒ$Ik}²¬·X§]°»ªô vÌ)×cò¾ÿÁ_,‘Ãh½^ŒJèÉÜt½.ßß/Çûß“gÖd‘ŒQï$¯ûë–¤qM¼~`kÕ9«9ºÊ.POú6\5g”ÆŸ`ó€Ðe£W–ÿwÅ~È=@¬|*óJøK´j™<—`ø¶ø"4˜@rÿà†DÝ4É2 SöêãLÔÈ‚)=^õª¢†–¹îG”÷H*Ž¤šê&xp˜4r‡IÍ>ìS@þöKWîpMg¶óæH¿)€cbùYsöèÏ'¦µZä0«Óá¡óóåÈXOÁ=À¹|ÞWÐQ)B<ÌOgÔÂ†1¥µÂ_XBÓ—z˜5ýÎƒ·à,Ù€Ÿžâ[¹ñyÔÿÂò¹ÿüÉ·…1,+Ø¹—š;\ôc:Z³mLAFÚÑÑ4!*i*Â¦âÝ¯Ü§ø\çÁ‚ö"bªc…+ÛV¨±À¢m3Ç	ÞzôÇ˜ä†@Å
ö
^O¿FÛ“Dé]—YGslXçÁ¹ÏŸ4ƒq‡)=šÕú·AV1h‹»\Vp;¾¤!3î±€ª0š!ÆfŸÆüqlÂiÜ*üÊ¹;1UL“h_4Œ(ç7úÃ…1©àC3ï®ýáÇŸžß¾eîÄ˜Ê@•ìÈXÃ\Üášª`ÉupŒúéemñuØÏ.¨*GÉý"IÉæþ>×XXŠ°sDˆº€T”ñ"øp@ÌW‹õfD~éád¾úÓæ
…(`æa  ,'•Œ›ß«‘OÀÐ.•Í*‰KŠ@ÿ^ÔëZ‡*Ìå8Bó
­Õ°’>_zýj<\ª-™³´ÁÁ'81{D6U–ãŒÅq}t¾cæe¿ÏÆ©Š_åî 9JR†,à®›Sççð«éÏÕí‹¸ûëv?íš8}U}'b_9üŽŠŸƒ˜JNóð¤ø€DƒgÙýöº?î$?±=±öècñÁ{î¨) 9ØùÝÏm HW^"°‹Ê×…{YQMB`äFf+F…aó5é—:„ŸNW±St£´—
_B2ú™r,?ÜÜìïe=žh÷@¦â|!“*ã#L)^§r&ÿ‚‘Ã;P’Å7Añ5´$Âº™ó‡mŒë3ÛltÙp ,b“SŽOÁŒK'ç1¶áùídÕ,øÑœ™½¬ 1Q:E”ƒ[«	Ì*-:˜QÚ®¶°yˆœn
èáø†ÿ1Ô8óC®"›6™¶t qÓ¯zçpªÿÖTý·Âý·Býcž!Æ¼­8*lnZ!ÍPç)óì}DÎ¬é¶uúc¿'t„ ªÂËÄl|Ö²jÒ~À‹FÎµÊšn7¬ÜÁòkñÃ¦¼ykpZóð¡òZåjiÓ×ð*™¤è¹§Žg}.êú¢«V…“8
 ·…«àL,tuµy©Š½×$ÛZ±bý‡á.Ôk"÷éë
Ù`‹ñÃM®ÙE¥²ÃH£\SòËft8ÊGYVMN{Åt‡ÇåqÌÝü<¯Q…ýº«’ ™¢A§U #ëf
ð
:#É:,!!±Á›±Kô6XŒ¸æ)Ú¦‘_f GV%ŠC½T•’òˆÁ(¬ä@ˆá¡?óÑö±ï2—õRÆË ^Ø²2aóIå¹€ú±
ùL^€ƒµÐüˆcýŠÉ
èa›kòKÀfeÁæ¹d¸1–¤n½al®.8”1G’_µX™Å±k5î¬U2î<‘Æ•’ UÊ‹¨B^,Í”°ê‹mÖ2GÂ²Ëf¦˜ªòÉsž%ÇÂ6¦jáZãŠñ©J™Œ/.„g_#fš£ÙãsbŠråu2ÒŒV¹ÏçŒ’ë¾ÐjëIDKB«—?±6eŽPqYZŒõçÉÁ4Êô¢ U¤¢‘ùñ¾"«ßI*l?d?þÇd9LœuÞeÛe$Óµ<›÷™5>ê¹eƒ?±V‡kd8U ÿ9ì²°cÆè%o)›x¸Dñzp‚1;"ë.læ3\jöóK~>X]Y%ôÈ^}~Z¤:ÃdozxØÙû|M~ðWØ(®
µ6Š‹K[”†
57Š+ãöK•n)ÿá$¾¼êÇçq.vÃóK¤xýuFRˆEª‹¨Â¡^ƒ¤N¨ˆÇMH6¢\\;F£usNÖ‹¢'·T ûãÉÑa“#ÀÐXƒWÀŠ‰¸sFˆªÐ0¦Ù°%	Î#ßp˜”çJ	Ï­ç3$<Ò™q»¼	eP+\@!Å‡Äq"NèÕuÛ‚Ô¶ÛõàáƒHi´1µOÍ3bžíH3QUË ÊÐó‚JÊô´9~°H=õIÃ±EG2#";kÌ‰Z%tªPr
{A”Í«ðt «ØúªvZc(‹e«qN-¥šÃ3á„œŒ,©é¯3¥^9 H>v¯@ÿGŒêÑ(¬sø²ðb|¬T˜J½Ø©¤Îºü oŽ²”Ã{a¬p`ìážlø…;ØD~e•n,6òÂGXø)ORnbcM6@Žlyf«¡lÉ2ð¹L£ºáÉü‚æÂ°OŽ°h>¾’#°np¹¼[c÷Wdž‘T´ÓMU\Z}´ÜHþx"§­(eN¢Ì<ë{53vy(è:ràðlYaï|Z¦1šm–
NM=ú˜±GJ5É!w8QAîäµ,¾ì3!GÙ1]ÈÒeiX–ÃÊ$JåÛø‘º°°Ñhäå@‹'F¨:›zM,h™5í°®+¡”8™G­2—ªUæØœ¸þ?eE×Juã—KUãë¤AÔªí8b+Œ•;àZmÏ]áN¿/¬ËêHkèÁ+šHuMDšxgÔFÊEŸx@ƒV/„k&ÚœÍ[%ñQóRHåjø¯,}òÍ*&|¿>µ¤˜yñçÝ©$¼ý…CÎ—THJñ_·JRpx!ù¬þu©#úÁ}ïê¶»QFîvJfUEŒPEî\ÑG|êHqDÿF•‘o]õX3TÖƒêñÕ©­;Q=ZªGñ~S©­¯TõhªGëŽUÖƒê!ç·£z´¾	Õ£eQ=Z_·êÑúBªGëU;›’yª­ÕãžUÖüTÖƒêjïÎT'ëÄ’Ñú T×?´Šõ³© Û£+W –m²jÍyÇbé‰ÑóÒAB (ßª&¢æW§”xAûâÎt­—CÎÔP¬°_µ’Rb{ùD‰ÿ¿*…Åv‚Ü·Ö¢àè.÷2G3j0Ö™xPcîZ±ût™Ò!ÿ ÑøÚ»3æé:ñƒÛ<(7Õ•›ÑU:ÄóÐmøÜ8´ÿÄÍYÇ)ð—æ¥ßˆQRÕeà¾UíFŽãW§Ùh ?Ü™F#{xÐf0ä|Am¦„µöUk2:›¢ðûW¥Á˜çù}k/räîDs¹óy™Qk)þƒÆr×‹9äsÐV´CûASñµWIS™é–°¶#QVþtúã²7ìQU–ž-­ÆT.FfE ëhŠŒGe‰­šA'áKŒø@70ÑAÿs°Î‰|ÖHÉÁ-Cª¢‚´ZàøÚK;üX¯KÁ“xØ§C¾ìlî„5×Á6G¿ð—øÃ€Ÿ{™Ë_CÖ¾WßZ—‡£%ë×FÃ·õšY®º³¹ÙWíÝ×»íÝ]²³×ÞÝîµ.±4ín':ã¶BØ„Ò€‹6ÎUñŒDÃ>=ãÆÇ¨Ó#ÂÂ3@ÕI¥ÝòyÍfÖYÝÍm+°Ö¹i<Ñ@n€ÛP‘7²‘xÃ$,tÁ}Š‰8i×?¸P‘^ˆ÷w•Ë’[Bt–%ƒ«qLñGØTÆÉˆkóöf}0Cap!RHP(ÁÍQ9‰žK€1tØÞÛ¦¢“«%	/ÔåÍüé*No\;h	Bˆü¨OÖtÔy°ÌOL+”zßSY2PUä?žŒ}`¬Óæ>—p@¼kËEWc
®ßöPL_’pŒTœ±âÁ)&9SöYú\y‚PvN`]šŒƒ…@ÖÔŽÞ,$,­ìµ6öÚT*Û‚†¬hP±‘CÚÈ!4r8Ýó'ôùxžšîÐ‡;ðp'èÈ/d¿9pkÛSMÍË­‹ñï“[y1‰e²ÍÊ<‡æzšbxº&S¤ÏÝÊ*qþž=µÂô7+ôè…E§>n°¬hûÍ'‘Y…Yõx§ŸÒV“ô†tfëìŽ]ºÀÎú7¯ý‰Xä3Ÿ½gÆ˜^>Xÿ‚P,zùb|G=§ÃçÙ
²š£¦8Ù
øÊJŽS¯x?ÖD1Vƒ·ðäá¼ê}^,/¦oí­°ð¨45[Kæ3K[Ò4+|¶¦ .+ƒÙlÍäœ3Žö(fvYéáü—öÏ/ ¢q1âôW'ÛÁ“tY¸ÍYÒ»Qi¡Ë—®‚ÆäæîâŠ{ý«K_­ÃÜ{àyyMËöÛ^¹#€™?…ž ˜è¹¹©9Nö“ë8Ý¦‹¸VWttM¨×ï‚Bóh‹6¿Òæ¶xoå–²©:ôÛk•á„ÍJÖ(Ò4WÉé¹-ŠÍh–QI½Ý¤áË”oBÄbÊÃü³JP`$k–G+:yEjÊ…œØ;Øê?iÕÀæî¨¥ô}yªrówß)³‘€¦|-Ýúâ„›T|×jÑ9c2hT¬o'—€¿];“?Ô½íñj[õ°Y™ž}ª)YÙR$,8ÀA·T€ï0˜ó¸gl”ÓÆ`hú,7#}FÔ÷±µwÝxN.èÿÍÂ<IÝlS#q¦§°…ò€ž.’q\ŽÜq^ô/ÏCkª¸²´û2ïäÿX4¿ÔxpI¼àÿ$gÿB…ÝF˜JŸ£dg»„Nu|Óx®ñžv ¥qzœúÝ›—Ã¤‘…Ã£‡« éñ$nfãdtœRòÎ™TU«ÿ#(Œ»Ã¨ˆ½cèwé &ÆÜò+N­[z²FD8¿`ßÃ²“r,w/¢ts\[Áä3 ‚^Ða/QLÞðD¥±¨æsF7Ï_¡
VÁÊø°ž &½áœ)jLM¸äqKþö—¿Š>¬Ò/6VU¬kyÜ†ð•wkÃìYÔ}ßP}‚S6>—£ _cÌ23Ö³ñ!wün’uRò¶¢¸Í?–×•«&þÚ*RÁ¼_ý8á¯®CÎñÕïrE ŠÙUÞ³‰µª {O¡|f1KÀ‹nÅ†dÍ1ËÄppæ«¸´@,ú6úF‹½°ÉƒŠÃ¤J¼MÕHšilÈ•Ãg*—ê™"šÆnw­E3…qÙFÐl†fõšoôÊohG’•j+[Q\÷÷¾ÁHÐ•>ˆö¡/´êXàúçY6Ð.iÓÆ7ók¼Uj¼5Cã–ü®…Ë—3tad‚Fûb–¦áTÙf#æ–£-kŸñÿv~\E±j5ÅìUÅ«ÁâGpÉFDEßk²JùX‘±Ù?§Êýoü¼6’ã¿n´ž„ù'hùúM	Q÷)J9ê¾è—cu…š»G‰†7ß2×Ûe)1&_¥8…YU÷ NS/lÀIí„žé½(íÕg9|÷¶é‰»·Mj¹ ²7lÐå@¹u–f;;T Ù!µB
³ç”fiuûd‹ÊM'[ôÕ¯Fqú©ŸAÏV2ã¼Ù<Øýå`ó¤³Û^Øx%QF'p–÷ßÝ~{¸·½¹ÿËÑñn{³sÔV²#J|TI¶)uðã^»óŽ6/BÈ6~ì§cpŒV–ƒïXlÒ"4Û>ÖöÏŒâtì÷¨üO7•ý„Üð´šx»ñ-ùá Ž,ËÞ/p‡7bÉ·ÌBG\n,ž«zœ[ðKWêÁÚ:9Øìl¿%;ï:?““í·»;ïöwÛþìîŠï^Ä½«AœÎ=¡jRÁÓ)“
(_¤cø~†Ç<^¬…<dþ0ºÌ…äì®ãübž>AZ”+kùÅÝ’OOâA]B—ƒþuã‘Óí[B/–/Ö¿ŒJK™ž´ºïr®Ž<ÒM¦6Œ zoÂ…JWÈà¥Õ#Ÿâ”Nˆ`ýî¸‘|l°“—ÊF„RÞý5k¾XUŒï÷”“7ÊÇ»Ä¼’ñ5Öu^¶Z…ñˆ–ýÞ:9e‹ó—Ç“ºdšÃäºV§Â‘ó^ˆx]üËDß7ûG[›û‹îg¤"vzðxr©Ó—‰,-ò{²º²êïù*…¼\¦±¯zºƒð¸ŒnÎôÞ¸Ž
•EVÙëþð:†ÂÓøÈŽÑMœ7Ñ†6}²Õ’Í‹Ë¨x‚:é#pÿ@:?ìxnOãžÖÍöEB_î§¸ïFôp²»¿yøæ¨è$c^8¸_,°Þ¢ã^§Ž`êï©ÚaNä’dÂ®f@­0ø3*Šl¿¸Ù%íG¬Ïlp—M¾’#ÙpsÑ+á;dú²ÙVù^8WAÀ/Kó£Ït'd!þJÈÜâw,v¦ „zÇæw<¸Ê,Û²;QŒm±ÛiÈ|G†Äe÷Öûb™ïUÕáyËÛTfÎ¤¢àó“Ü~&:wVœaVž#¤DŒÁùîRÜ´µOˆšã \]¡S¢$,¯­K}ï95Ë[vi-‰.O|PÚòY‹>#|²{äçxì8¨½™Ç(U‹àd"%öY Ñ].p’žÅçt¿Ìxï°eó«¹®ÓãèwG>•ø‚H²o'hQBÖ´ÂÚ+êÃ}àÑ6/ƒn\Þ^¡õVµÖ[ØÖî¶õq®wJ?@°Ž•€í@"+0O kÜÑú2$6qalƒ€¶Îÿ°ˆÉô œ'ÏâA	Q”{Ç1=­.c–ï
&´-0¥%àAé‰œÙ¼/•7.3è¡©ÇÎ§xI™¿%e´—ŠqùÇåo%É Ž†uŽÒÂ~ï<lsæà# ˜4iáþNñ¯ f.Ùp›P(¼þŒ
ï¾¯åÓÜ«Ú›xÄìÌÑ“›oD4¸'©ŽhÀ;6‚ªñù[ XÊ¤ÿØÓ:7ãæ¬*¨GÂ®’2ÅÏšS&£³`<62S9VnýÔÜDxÓl‹Ø¾"à¥WR)lUµ®ZcÿF"1ÇB‡	"â¬?H¤¸
a°ÊÑ/(ÎÕ tX*2"S*Ñ;bKBE!•ämc6Òm“€èE5W5äèýÊ¦Ì
í®]Ê+®†íVèSVÑåZ¼ÔO¿³êr)×ˆM÷&.Ñ(TS©dæ¥º_¨ü×ÂÞccñÀÉúx¢Ó[Ð
73(oŒ²;”U¹bgQƒdç¤­_È$’rt>4ÎŽ+"ã ,®RL.*oæGôbÁŸîåŒšH¡*W=7<Š§Fo?,x²,f´`nø\ŽåÎïZã¡ÜþtUÏ½™PöÅæ NÇÛý´k¦€KPYì)°!eñŸ¢tHùx]G`é.°t·Èšiþ]F50ãÔñgê>\ö~²ÔÂ«–Âú¤©wßÙÄ1MgN:‡°Ñ×©T!]]èI¹úû<ÖrõBZÎÕ+x U©8“)g2êìšù¤UOYppç,þHE§æ`&jnÕv&«žãþx@ÛåoÃíH¡‡ìÖI£ì¢UÅª<ì4sêwÍjPXG“ËQLG"I³Š(ƒç)eDøè~ªÖ[Ü±(ò_ÙVCW¿b˜¶À¬¯­Ñ<ì¤Tõ%ÊvÌM6¯k¦ðæiK2'wa©lÔ(YsvckÿÝ.R±Ÿ"
ZÉ«“Ú˜îQBžgî^Ì„ÄÚD·¸Ü¢6gŒ\ußó,Dš¹O³Ø¦6Ú»;w5Éš;ïÎæXØ¹æ4ÅHPTa"žz&ÜÏ¿ºì)×Èà\ùøT@Ýá·§àÈ#K7š 3¢‚%!“Ë3”tVäÚv;”Š,¹€µ†è–Ý‹×žÊì1'“‡NñÆÅ±j‚S‹R¯mBMµP¹Tf—¨,ØÙ
WÁË–0DÕ¬!DìÔµÌ`¯«¶màìX[Ä\7¨0zZµMJ-F»ú%÷(Ãú5lRÉ»Ô—Û¥8¯>ìQ¥»¾±=ªõÅ÷¨Ö×·Gµö¨ßÌU­âûÃ%î™÷¥Úíç³MA*Nµrâw¹WÙ´¾‚ýÊFöÃžõÅö,ƒ§v.ó®/°s)µ0ç³qYË…~Á­Ëýü
¶-“ä‡-ë‹mY³Tyû;Ú³¦¾aºX–¯-ï3kê“urÜÞ;ìïÈî?µ;þìÓøó(Iç_öê!ëtª¬Óã”ï3%ÊeÏ<sw–(SÀóïï:ét—qÁë°š‰’+e8RÅ8¹J¡Ü•¬ÎèþÓ;(kDiòïYšD=:¾ã)²Mgòåú£oÐ17×ý!eã&…šóÜržVŽ""D"™³µãÊà*B¦ç”¶g`rV¬Ï3g ¸9q¹Ëyæò=Ë}ñœ+§ÿõŸÿþ?ÉïO"Èšc0ø¯šÀþL¾ëlîþðÓÑáÎÙ~»yp¼wtxòvïxñ–4ŠŠ† ,Ð>HßyˆYOÿûHt^'zw E	q’üù1^•nù_Š{ü½4—·*?:!11¥9òÊ™zRU‘ïãªš,– ššð˜TzÈSåßÃ¨|JÞ³ïãl]”/.ßvûá”@édTu†ÓþŽ7Ô'ïà”á>·ð-PCE¨ÇEÁÐ¼øgžìT_ÿçá)ù}@TªÏCdoP{%»Oü±‰¶ÉM}‹·ë:#Ü¬ÎûXR+†“üƒò}>~°«âãi<ûÏÃÅ0Ö;m¨e8?Ee)]8óÑFŸúç EC	íØÖ¼Né¾Ú¡{\m
ÙÔ”ðídÔ§
ÚOÑ8ÛÈV~>Šr¶óîù“ÂÑçÎ=&†[O˜ŠÇ#fGðDaÏYFæwÂØ~«\MíXJLL^»‹Jj#*À—3ñž¡ê¨©¹á¶:HŸsåô½ÐãT9ãÆñ‹ÓŠÆMYÉ)BW;Y]"p«²,`Ìïu†Æ`²ËèÊ	•Ë6®œñ2%ÖBf4JY¶ÒÙMÞ]¾ŒÔÚ{Ûõ™eìRÈ›ãÆCtílæÂÄ†vÃéìÓÿ¼b‰£ñ
¹±y[znlÀ’ô¤@W ²,Qõ|X_	u_–k(Že³EÔQ·¦mÊÃŽÚe*hàƒÍp ´´bX–ìóbËÁuWò
}ë>zo0da¢•§¬æb
›9YÞwÇì4ó†Ì2šüí¾/¿\±Ó*fc{D
t r¦¤Mƒâ»ýSoÑó¸wghA­Û9K3Ñð×ÇùdÿH¨ddNªp$bæÍu@ØÑ‰@0áŽÉà„.²—“§·ÆØµˆ{ùªBWú]†y“Ÿu¸Ç Ý„À-ÁáÇ&–µA”³@«Ò‡ËÆ50o˜Êà<pøH20K«ZŠ¨@Çìœ°v¬–2PÂsêÜQÏJ)6['&TU×àï¶/£D¢ƒ7iÖCÚ>*oqAæ7LãI²Ñ5;¤©ówÕÕJêIgópgsÿèp—l½kw
ëäÞI§½·õ®C,²u´ÙÞ!µý½wIçGpªwïoþ\×ôÚIÖMA|eN)&¯sh§ŸO¾ä 2dáÉ©4.£Ïk`ž•O×rÄ1òxò±?î$?1ƒ<ÝÕÑ›Ad—ëÒl±F¢¼™g+l5®¯‘¸»ñdñÖôƒ[sÉ%#È"§É€lEiI—/½Gå’èô¯4D õšµÑ÷ÕÇPˆ9ô¾’}æIy!EIUîoÍ!ÀzblH¥¡)QPàÌš£…þ fúeÀè„)È9(0.“*F¿?¤ÇIù­ý'Pê6ôO)OÑ¬¢+%S)§·6»•k©;¶¤/ŒóÉu\œ0HÀ êþj ¦BK>¾fÝÆ’|®™»ä=ÛbÄ®Â·‡]ÇcÆÃ X1˜,œ´f­7è}ÛÔùz€"/½¸ýlœöÏ®À’Zñ%GÍ‹‹U?“ríí»°Ú1~eóu¥Ì~+ž0OÙ—Ïly/–/V­ol³ž­ZgÇJádãÌ†ð°½ p¶ôW*åØÝo ñ¦ñ0¡‘·àMæ]þí/ßÔIÆ¬}æ&ð\±¹iMæMNn‡p¢„+«ôøM}TÏøò‘YZýÎ^ŠÍ*3ò†GX3â	²Úm}bŸñ-H)@gB×ãwä;®ÀQSv;T>Iäé{$—Ðzë×¶L6“.yUz›°d£AÊ>¢yºI]7ž<çÝ<u¸5DzŽ~Žâµ’6eÉàj°_AVv2‡GÉSª*TœJ+G%(\Þl6íÏä1vLVæÏüé*NoìšK):êÖ˜Öô°M‡4m å€
9£T€æc­Æâ(mÃ`ˆò˜¸MÅ"ÄŒø°ŽÎâb]3ÞHö`¥8À“hQ¢Œ‡5.ÇöOÞtƒ\{üî(Cë|Ýqøw’ós*Ânñá±.GgMy0_bEí‘"cXYLÓ‰8OY}Í’“æÏDë+;fŠJ¹Ã\
½
» è×Ùcþø.#°ËÖÕ½,ßrØ!C¢[8¹îƒÁª@ˆZGä‚
X Ô, DtEƒq/#txèmôOÊ<¢m¡Ü‘u+ÜnèÒ}nÁJÜÌÏNS
¥T­“UÁ™L :)mâ§çÅÆØn^Âø0ŸÙbæNXs~®žoLßœVmwÀUb+(F«|¯uîgÅˆÐi|qÐ§:]ÿ_ã–÷ôÍ£ é4¿8ˆ>WxÂª˜Ú0@Üð†—J_‹»Ÿ)wÁWœÕäkOÅgè]R½OšKÌŽ'f‰Uã?Y²»œûAÐÿHj5Vj/Ê¨ãÃó:·[¦ýî"èmWYœ¾j2cZöS|Q[¤:ü/‹õº3’žŽœõjÐÈN”]° .gI¨†”0Bxï\VdpuR(w¸nù½Ø®-’óþÐÙŒíóû4ÑhOçï|ÙCòø~r~t5Æ‡¢qÆf»’¯ÍïKŸMÈcWsôš©Í›´EÍ³%X°(o’‡fõXO¦Þ·›ñÊ`ÇÞô…átz»}&ì6WÐ•sK½ðPÐÃ%Î¢”k9Õøý"•É—Ìhé¼ö‡Ø…ìþW_œ»`rªŒ•Ò¬âÐÀ;é‰“SSü«!©”fI››|­+òú‚Ž,÷ÌfmpHî„¤%še˜Ó5g“æå&à’åËÒ¼_,¯{ËváÞa6Mó÷cÕ'T†ÞðpÃb°mÆ¦:„X»XÁ­`–³òªîEªU[TPbZCÐYÆC#á‰ÊýTç1{/hb;d5í]ss¡^èà>zô0õpGoæã·D4¶lÕÖ½4ŒwAY¹¹Y°ßíBÎ…UòfY(DÛ—RÁâè,%K,Å‹òèµ„Ž÷`#U`·IÙÈ})´I,¶ÚFˆ¾9ÚIî»Yµ÷®¡…:oMÛy+ÜyËÝ¹^)ÜyQ’W'Xû·ÜÇ@CÜ”h”Â„™ÐV"´ÜüËfšõ¢­Î§š• ƒv\	bÂ°ÖM†å¹Ä*{ÿßÀïmø\/V@’4wÉÙý“¹‹{‘ÜÚr±t†Ôúþãªì\«ê¤ôžc«@Æ
ò«ª”´JZ:%­;¥ÄÉ§*MÍœ$µ´•F’†”_Ó·€æ#h0¥Já’wä22T€5(}â“Nžò¥ƒ:Ûæí‰¦÷ÇÑ["bŠòMÓÄÄÀÊH£^Ÿ®žÆ8iœ‘ir){øÔTá-‘?è¡4¦dŽR—"n¨Õ|šÇÈµ¯lÑ2Åˆ8]¦ÖÎ¬áÐÏV¤.R&þL„AA:›L9Sfc}XhL©ŒMv™‡û´ Ü§¥ñB«0°%À¡ØcÕ ä,¸$“7Ó˜yüj¼¤ëµ½!‡aØŠpÖ€–„åŠõ€¼0ë¥ÇŠh3Ø£—2}z«e{¸2«äè(â!"³#¶c+§Æfýû• [´XÏ*WXWš’·77DVH€BBD±jåÍæQYmF	ý<Õ ru–ç1=·‡?•JÓ±í»@¿÷¼‘;oÅó–¾Qô'³€fú´ÀÏi'×>ü÷ðþ•ïùÀM—c±¹1¨ô«5ÿ6;)$H®Â‰ó_žîì\‡9¹B?q±´ŸñÄ“—¤ä,oR…ü²Vç¡2,ú–¶^’ô&î*aiéK+cé+™™÷*“êÃÓ»Z&ï<0D`3y‡Mah7P«\Ñ¤05"k!%›©¶å¶”WI "6nó¿n1îÞ§šâ`WVCC`[ Û>üÃ~§bMa·t¿j®¬~
HÃÑTÀþötÅ¥„÷™[ûpkæBˆ­ô¢ì"îiQy;4ðV;aq³^—ýaãºÁ'Àžy¨LNÑÃê™+wT©ŒÇëáñ„mÞÍ´¸&b÷ÆM[Y´ò@9Ï_dî£qœ^»ÑØBm‹¾öÅ Q^EmXU†‹ãÍ¡òìX³hÿJ(6×Òv ™YRÓFY¯Ì>iñ¬‘Ëuþ…Ã¥ã’"K>zÄ­/«ðX Ü¨)ÛÅg”dgyu-·Œ—ª?"ëÔVTIN¸pÙ¬I‘#5Ø<Oæ,"‘ñ´#j“V©7¸k‚þX{6ÄYúÜ·	ò½NÉ¼dòE•2Ë>ï±K“ä±èjŠ§¢ÃÊ„OlùHÄ”ÍŠàA²§Zu'–Ø(õoöêò²¼Ã­ŸÉ2yw¸yr²÷æpw'Ï*<!oöwößã££}‘|XB¾¬Ùãz ®\†>·×£²ß‹y
lÎ05Ç îz¤'#›î5#Á#N"'$î@ÔæÙ¥Q'Z£´,C¼Ð#—ªWÏuzšÅ.÷ËŸíº¢ª[•í¦AÍðÏu1–íîÏ*imNM-ä°/¯éàI`mÎM¹(ð$7–©/ÓÄ6usGg5?¨åŒ%¡ÍçmÉ— 'DàÉeî–iW+~ÂÛ\å^ËfÉ?n›Ï»,N3J–`éÃÿòí—~‹ªieF‹`ËÁ¹[ƒ™ÊbÎŽ“|Ès¸È[:X`K>N’ÏÅuÜ™“¨¿sN×Tôœ¢Ôs)R9 ý¶`co“–¿OQ iõ^¨ÿíý–hÔ­—v9!"àcpC¢ë¨ÏÐoYpN—ÙjÒ„Êƒ1$x6Éñ æHãKÈù£ÿƒ_Ä	Dò‡£4Žšž—r …Ít|ÛœÆ9„M17ÊÏ5pë@)Y)í«úx,u}Ÿ¸7;Gq²£úŠ,BäTŸ÷3öÒ
òJ+SÜË£˜è-ÉP„àòù†sždMoèØ¡ÈÈ «ZöÂÄI€w¡Éx^Ÿ€¦ÁÎ1¥n5fžõKŸN’ûð $gø¢B¡/¯ŸàÀÏÌ½)?5Üµ5´‘T3êigWau­Ø&ŒA!ð«€!¢8V²Ë’}GG€AÍÅüxÊ³¥¨zUäÂ¸ cåèÈ2TØ§ß’ä2‹b‰6ƒ®6JÓõÑ§Ž©A3¿BÄUˆ±™g´sz}N·
ïÜª´àH;jex~‰¥<Ó‘ìƒÂq(¦îYYÁÐ$nëµ*H8Ç›íÝÃÙ;ÜÙ=8ÜëüLN¶©.zèF¶EpXìÑ!¿öÇX›cý†×Iz©ØÏáÕ·_NŒ/níw°€r/|tÜ¹ŸD C*7‹oœ-GÝ­iúY¿·_ÅÙË‰øCÿµ@8~9)þÖï‘Y%/'òOõŽeÏ½ÛÚßÛ&?îíþTšÿ  ÿÿì}ÛzÛF¶æý<EE‰¨Þ"E|PÛÊÐes¢SSrÒÝþ2Û	‘è€P–}zŽý(s?ûÅf­:  N )Gq„[$…BÕªUëø¯Òê\_‚¨ñcàßÐ…É0,èC+ÌÌûÎ8äZ,£däxç{Ô¯á÷•Iø¤Tf*0j¸f	KJ•UÖP+MKÁÿ­ +iuAkŽÙ%rÄ´ô{™©©µ…ÖŒUXmôÐc8ÀîE8¹WÈðN™&jÙY²¾fòs–†‘KŠR,ô‰7r¹AaJzšÀ QÀøÑæ=Ñ¯P¤æëóFÔ©õ,ôtÞ®9çêhó21¿3A1o–8ïEiYvPƒÛ-ÿiá=Î²#Æ—bv	)I»*áTWHíÎ,ÎÉíÇ}¾²OsUKQ»›Òc.ËYÑ¬qÒá9Êˆ.D}˜IYÍëÃ¦úÐ 1	)Ö&ËÃ~Be}T—~Ý¨«Ôh$”e!<×0?
CB¿äpHÔT@$ÈœÖI÷`D˜·{}iƒ$agé\$gÅ[—I"èAÖ‘ÒTúì¼™†õ—$WÌ­ŒQ"i„ŠÁ©3>+ Ð [ˆ¦¼ vüð]Î,¯Ðª>tUë-&Ã T¶e(9;°ZIˆÿþ/æ0`ŠòËÂ·|æ¹‘ã,Ç°62S±ÔÕŠ¹„
²Î‡eÄ­äVšŽlå$Êñ>‰%ÒŠ]£ ‘ËvÝÂ¶¤°!…ÛTf«_©»H¢ÖÍ”Öªâ43i"šY:Â–'bÎñ½©’ð•»ÑKu
u4Ê)¤°ì§ÅSÄì) 'ž®ìwÌðÝöZ³He.@äö¾N|ãÂ÷Æ‹vt|
–\:ó‡ Ò/ÚáO-‡ˆ~—Ò]½;!2”I¦NõÇFàtGÀôí¦¡JÃäÐ’;µØqø÷´hÆM!Lrá®¶Ö°´˜äF·lk¤°aJëú-Bo[­¬ø<®âYƒ<îjÓFÒE5ä¢S|Ú€-’KR„ê1×º€–øÅ$ŠÇžúÄ(27FØÇsú+~É?ÝKŸÛÑÀÇ„ôZþ+–zŽÕæìaM¥Ç²©Á¿VÉÿû¿Ä!Pì.»åcþ`#Æ¯ìpX=KnFez“¨†‰Â÷<T[8$ 'oè¿…ÓrzÓŸ‡>œñrú¦Ò¬ÍæèÐa;éd*«ÂÕè›¿ñC¿ÆÇÞ|ßˆýä:œ-oe~}V½Þê­Ež×"Î«%,[à•ÖþýjýÔi[TgÛ§­ö;ÒºxwÔ¹èH6ñƒÖù;u|zÐ:’tÝ»dÝ¤¶îzè8xažÓ•V<øL3±@©7Éoõ]‡x$Ô,Aé$¨A
Æex£hW°Ó²âµ{,i4GAó•^Ãè¡FýÎgö×¨þáåÖ§ÑÏ¥DUn X9)Û,Èlú¸Ùf³BK”NÕ§ÉÂÉ3_ÓÃ™95ˆ½•6Ôî…d6§Ï.@ñÚÈ$3`·•~¤ˆO¥6?
ü°€t¨=ªŠá®0ž‡Ã9Šç8´QÅ‚ÈÍ˜‹öéŽ%é–5Á«#mœìsoý‰c`='1 Ì_’uöŠ —za}€ zß(Šƒßn1“ž×©ÍŽå¹^ c±›¾ÃÂèÝM*XíÔ_êl'e«É¹žÛÕ®¼0Q¶œ',í¡,BëõayïæB˜…L‡»T´¾(&ïn»@m‚ÑYæ[{ƒú‹SK¹é-3Pî9D£¹¾ä¥.>8Ã`ñú#¾’Ã(Î6Âk"Œ)<—*A ¬áèˆšPDŸ×¯)6 g1ÙÛ°`3èQû4n°Ñ#ÅŒ§xÏÀÞQ~°©—g^pˆÞ[Š’®{î„(à;â©Ò»ÔcÒâ¤ˆÀ t„bÔÎo¡J;”€‡ü„]aÁ¨6¦1ÎæÂ”§ª³˜–¯*›L[	<T¼ŸA¾x™‹ž)éò¢¶8~”ûðeÂßÏBF¶ü^×çž1zÓ<õ›ÂSUóÆCÄó”½åf²|£"ØÜp¢>T©‘h=@ôæJyÛ—¼®·ÜIQDhtò>“õ±jÐmÓ…œ9H?+¼ÊÚÓ’ºóÅEo¥±
… on;ápwÛ»'‚[-ú¤Žd`x(yÑNsÞ0wwjàD/wY ™‘dd$£-“„ýåˆGF`r¡Ÿ6Ï}‚œª¤:S<”åË{‚a`SQ{ä÷iq¿èëhIèDvrr'èD6¹PÅÇ@4YL¥É´D´>‹å#ç |ÀÇe’N6 áÈ2Ø=á'ä¢„Ó
A_²N:"'²1ü¤=*/R—#Kº>yè’Ìdð#ôõ#z¨óYZ°qÄÌÆ!ÌFÿÞ-Z:¦õ]ù¦éÏß°;n‰ÚY9’¾ªícwaÛG(,JË›ºóy†ªOH—¦RV–*+%¥wvÌÁIÙ¹n8ÂëËúO²r†8-ð}_mŒvŒC±@HèÓÐÛ:†þ|öm	S]Ð0.º`z‹,¤bôë]ÃØ¨í„zð}cž˜l²ŽþyÒ÷¨¹1ö™wÿ¯åõ>ðž¿þ‹lP/>ºVòÓ„ÖÖtŠ¡@~èÃƒH]O|*r„!´€c³uáÿG“LBÑjy4U S3¡èäð+xÏ5e¶œ«€VÏ£‰Q©´©QŸ°0ò„¢2†·…!L¢<Ñê9{T]°·IôÙTÄ”Oe!Oº”ÖÌ .¦ÐÑ¼CPæxa`óÔÈÕˆâ`LÈ”~˜ÂÂRcÃÕïóñß«ð]E‹î€&¦ƒ*¾£Š5ûü'}’8ÜG‰ÿ·ÊkâOúÑÀßëâƒ¢	Ìíã¬¹XŒ·×À˜`¡ë°4Ó¥·H m…Ä?4ÂˆŽ’H‘ bÿ×ë@¹÷¾“Ž”›xÐŠO¾U×¼žÂ”à^ÉbZVïÑ#˜NÿýGÃl8 B¹Çs–ÓqI9D£½æo‘bˆ
Ì.k| üòÞ ãnmíxL`6£¶”±|ò\†dáÓ Åç)Bö(PT“ÓEÌ¢©0©'\Z&.Ãi…—k.Uz„ÊœšŠx…'€üåË©ŽIþš°Âæ:Sj™nÜÄ0zÜáµtå;!»²4ŽÚjQlË87ÝìpP°‹aÏ§ý¡0£_L,H\ÊŠ!ù«LIét§!è”ˆp4©ù\@DšJäR}d–¹ÐHAÄr¯È$_ö0WmÜën¦šíÉ4N©t†ÐÊ\»ù¨™Ÿxè:µ£ÙlšìmlxÓ qƒr‰7E«ûxÎ‚Á÷¸>¯¿½“Îªû@\ÿ	ªÔä3Ø*»,Ô#Ôåg»ÍbUÀK‹T|dD§pk1B’ã2éhÑlK-›)æ–zÔªª¼¶Ê,"Æ›•€×£ˆše¹r;Œ~öŠVÝjÚ© 0.˜ì `²iI$*žx¦°éDÖ>P?ÅºlÆ_ÏÌþ?cù-*‹®±røÃyèÆqhlb23ó†²s·«rTà˜Ì‘¼™‹R¬7•\ËË¥:8þeþ¢­¡c…éÔû_« ©¬¡³j¿K Më|ÝfLsŸ%îÒ¼îv†¤‹Øªj0-æúÐ£Éõá=Xe{[ýavqQ]åŠ4M*§«èÃ-•‡]ª<$n¶ —·4%I›…Ä®¥¤ñ’Å;¹P{J~\&£×B9A¨š³‚è3°ÁÒD	góª>"Ea†ôÔ²c‡”BÜ@hTãœ¦¹5²µ3å>i³eQÿ%l±E?H·ˆN†ŒbÂ~1_5Åâ;#öûVÐºÂ©VG7Ÿ€Aÿ­Ê<#A;Ÿ7‰#ž’¤6Af¡e.™™fÆw0âkZR~,yÖäžBR5÷AtlJòÉZ9%ûðÔl…;MÏ¢õç„èàƒ.…Z·Ó¤-s‹©4Áfƒt>Á&š¿§skî‹é~)ã}e?³¶h·S¯¦xì´…}å3mìÁézŽ—fÛØ<¢Ï–bQ¦cf²[i„ÁØÍVœšŠSK1â¤Îƒ`8™Çþû­H¾Á)˜ý ^ŠùGL¦á‹‚E8>£EX\N¥Øå…bÓ9Jîºbr…tkQýÓãP­TÉnÒ?ÁëC-´ûÝƒ="r·œŸeËA‘Z.yÂÆþ ¸’x|d’Kž«aî”Pdá<²É*Uà˜!e—ª˜Lv†çjäOJ‡*â²Æ-:÷$Ô^9Tj·YŽù1ÅJUy+!‘Å×ìV@s}Žc=vÝYçgHú´—Yuå}~rÎ	ó²­Í^Úí59Í®V=®£^¾Š&šÞÀËÐ¦Ç/K
®M×þ&²Z+ý™%> Ú44pðäÈ—>(qG±ÓÒC4mÈ`Õ;ÿH¡@
µª…­žøkªn8U¯Ö”®°êåËfðzÕ¹õ5v'~®/ºùp5I;Ë¥©V‚‚öãè)Ê.÷Bü	_lŽ½0—»5™¯©Øéä|Í_’+öc&_¡\,û_s2ò7°ù«â&.nãœÖRYHi~5Ûnuð®-âºuoH½¨
*Çà}ï(çø®Öo5ÂVúçg sz†]TÞýô®elÑy|Ès¸ó—úÐRøŽ›Zßñc§ñs”h(cIò0Ž6|`Wù¨'òj^ëBsÐø«
ãt&ÂPÿì¦2¼¬§ˆ¾èLúÚÔDz50Ÿ+b«ÖGQ‘¤=`Nl=Œ¢™S¾~ŠÜ8+‘ˆQùªKéùZëK9_¿÷ÉKYÅÑ,˜î‘ò bzJcÈñØBn~Lø!¬á&˜¨Ž‹!4F¹¡ñüb‰ÖD•I¬â“£NI«n‡ðõôuŠÓã˜L] êÜÇÞé²{rÐý±{ð¾uDÚ§Çgˆêq Áz´;½‹îa·ÝºèPtåNOïQÖù0Å2Q+‹ŠúñÒŽúñ@[^ =ˆŠryõ£`0êüny0’iÁBóíþ x û“Î§¢<+ã|”r1™ÝšµöÈA0ÄcŽ‰sßñ06`æí¸3®ØAò7“åkL@mÛz‚õÀ« ëQ'gÈ.¨¿^Pžd^r`q/\`?)0ÕŠ9¯Bäÿ/&0?Œmá8ê©©µâÌ'¯PøH°¤1k¸³ÆS¨ñ–¢cƒÜj6v·)ÙMé„‚ÎcOªeZD:)+û§"9ç(ð.ƒYÀO,çªÈ<LÅ
²Sª7›ù!%r.ž[üsE¶l
cæ¥Öhú·`I
ê¤  äú
ÐÁ¹<Wdxil9ögžð!¶8î»˜ô¢Àz“VðwMî§rµÙSv›úò2jWÞÊ~{ä§»1
¦,´„ÀDa¢WÏ6 Ð‹fSr`«C <ÿ—›h2ˆˆàüléaÏÒSŽ:„„7»ö£üõ îÔ=Íq»I–Ê}
¶Ê€©¿²³]Ùÿ¡÷ù&"‡p£Slœå}u¶<•ÌR¸²ƒ=¾5­¥µR²€ÕÑh(,î€v·àøDÌÔRG'–1@7°ÔÑåãLc¬È4¶0Ì3ÞŒ¢;¹Š8fš§Om(œžsi%+ãšúXAKôëâyê/²d~ÖÃQ†Êwç¢{qÚ#µö»îÑÁÖjƒ>Þ;wdÊSá–ÿÿÙPÀÖH%»¸Ø‡¨éâO¥Ìâ«\*oz™ã¸BG1<¦ˆõ¸ AÓ¡žôºmrU¨mxAiƒcàÉ¤âVP^¸ÄqæÁ¤WO6Z«÷ÄÒZÂj¶7Lœ—5=û(dâ‡€B]KÙ<âŠ¬H„/~-ì‡×¸Û oß·zÝÖ	iŸžv{Ç­‹îéÉïÏÒùž‡Y÷wú™*Ô'ËäFéÀ‘-=Ü˜»ËcQ=š•Ä…qP®¹„õc—µ´ñƒÚ6éšœ\cÜÃMùÙ(š¸Ð‰kê=Ñ—ï)l6Øbu|3+³Î	ë»5 ·MnJèc¦dÁÒ;À¹q„Ìk8Î¯Çc/.CÆ:ÄÓfªM†'3¿ÌÁ²`Õ+û™÷¥×9ê´Î;äüýñq«÷OVæãt×©ÏGsddf/Ü¦¡÷#?ö/oÉÀ‡qQX äiàÖŸü,çNÙqÐ´Œßr¬–™(ä³øú\½ tó	î‡X=I®Â¡8F·	¨!‰ƒäD…!™öþ”zŸï_Qfž¼NüÏþxJñ„äªDcoâ}ú'æðÊ£þÇ›ÜÂ’)Þ3i>Ç‹æUàèë2¿dj·@Í½O-Ò	®3¥¹ÆÏW‚÷JÉ~XH_ÚQAÅhòöfhsˆÝ›nnÐt¦ðW¡JaAÊˆ¿P_Eb*®V•<"Î;í÷=ZB sÑêé”Îþ¹—à :Ú³00‹†Ÿ†×Ò˜Æéêž¥¬t™CèN©ØÞ©—nà
ú¾«¨íÀã8à–0ÅÀ,bÐN;Œ®¤Gó	—gƒÊ#È¦\5Ý¨Ka+ßAk‚’Š©Ô•î0v½1¡5”¥`,Ä÷I”Ð¹+xTßÚ±¯žaWÎj÷Ð‡‚¿
ÆC}ºx÷_WxŽÐÉg¯W$(LÚÞ€,%Í7óšK®túgtùoo¢‡A ,·ˆ—&†Ê?\…ÔDÀËIDsÒØdc8sXâ­)VLo´¨òù£‹–æÿ×Dr:„SótFì…zUôš¢þ5•1hAæ•âÚjCïÏ[]ûÈyâÇï.ŽôØê,9ËÃà4sÁ©åÆº¦‰ç™’ 5½Î…¨®®Ja§êx:|Ü¢ë™`tÌ4¸¼öQ»	_fãÐqç’‹1¡R®ì­½U‰ÛüØíæGÐPÓQì_½^Q¼ýÁ¤ñïdà‡Á'èÊŸmL¦ãôá„ö“äm5¶›/a»$³ôûÆf~\! ãÃy5»ýdäûæ¤ŸW¶Yx•eÓø!æwžÖ_8W¸Åå·¤âò|g¼ÃÛÒI„AHR‘éñÀîô¶¦ }{—£á«b!»íÇÁtf{¬Ø“0ò°/®®'4›»¦'õÒÍtà5‡|†ÄŸ]c?ºžÕäçˆ~ú‚WÃŽu‚®=´ÕÜ 	ë¼Ú0¿¶ª>O9ÇÄ{)Ûªºü9È¥„´—‰ÿ%Ì½ùâ'uì]‡ÈwâçLQ,&€Þ¤
TÑ¡WG‚?âÐ¤G+MøœHî¡°¢¨ÝAë¢õÍ.œöt!¯Ü.zpùç¨d·ûçpý*+Ùx +3ˆæ?BìêBµìÒwí|ž†QLc8Wg"¿1©Õ¨0J û<ƒÉ@]B€Õâ­³È7cp^w§T3nüâß&µ±‡*FÔîº'çÞ'¿˜; –ñAjø±Ù\'—qt“øëÈê¦0JfoefÚÔÔÊ ¬X,GtEk^ª/Œ!jB’ÀGèäKòS	ü(Îó}q«Û\Ê¨xJÀõEâ†s
{z€3~Xfí˜YYÈ-”Në\¦ûBçöœgµ| ðý©ªšUåPÈU×c²3óù|Ü?…q¤½mòcSÅøË¸yh¿mí‡ÿsÑ´°Ñ”œY
iyç(ƒKü£
ö1OÙx*œG¶õ‚;s¸ÇuÒm“	õÞ®ÞØðx¸bˆûÞñ UïSR€ñì¥àSŒÐàÁ¢ÒAdÆ€”w‚¨¡¨l´T,^~öuî_-ÛâËSH+±µ¯¢CšO˜âVŽ²Ä‚
*Çùé§Ì.VŸjÿý_ÊóH—T[z%«·ìZåAF¨õ„	o“è&ö¦y«áªEýG±÷².H9{ÖK†¥˜sIfVü–—ÚÒ’jåŸƒ˜qÉ‚îá²lÁpÂ÷{è\¥#ÑÈ(ßä‰Z[
rìQ3à÷ºR™¿ÊHÂ½AÞ;‘«îUôµ•Qu(â"Î"EïœÆÌ¢ŸØÉw	õqùiTÌ•ÁÃr<ØSY'm•q+ÓV¾Þ+Ü½
s¡®y)k>ªšƒ¢TÕEÑº/&+t«6‚¡M™GÈœŸe•ËôÈðjîá?9Î‰â•ïöÕhÛvëT™KÆÃ;JøãFÛÚG;Tâb–Žñ }½E–ƒçRt\êˆÂx¡Ä”@t±33+™bDN"ªc	(_ŽR™°$¤èêŠ/Lû"’®•“W‚¥ÐDªÕ»5G¤l"“‘TÂa©‚m¹67»R0Tù/³­WG£],Šº‰[{ ÷g”,¢¨š—ÏûçÍ|Â¥°ÇÈ ×X:0¯kíL’ÈÈzc¦)ê°a†ƒÁuLc#iì­»FRE£A y)ƒ?AoÀb	…ýj‡ŒÕcú¾8ƒÀÙcÒ·$jm†V#–©ÌDNÖ6;˜pñ§£v¢5Ï2!.:!zµVºbwüTrh^VeF…¸,8Gò C/r8²öGÆþ•Ç~|6qûzeÕÅWwgJˆÏ=~#â,†ñ=æc£ÎŠÎ$D]qp†3÷>kb?ãÔø¬¹àZ0u\påhæüü#9;cfþ4s•	‹ëT#Îƒ	Q6@éBL¦/ÐÈõ„:ëu¨R”÷Ô%½¯ ó"‹âde?%o[QLÇÃx†‰	Ý¶NaÊb™ÂD|?Ë|ISÏŒØøÎc¡ePiŽŠf<)†{aL´Äå2F¥íA×›(Yœ¾Q¼`ÅÅá¢òh1cõ­‘Än}iÛR7æ¶Ô0°Š5^Q˜g˜Š£‚JBœk/mlšw£Ñ  dçª÷"›I5ö	¾]ì*ˆÇ>
¥\çê¨~Aû°žŒîN/;5íYò5è&S:¯§j/|'Q£ÑÈ«š¶vèT‰ž>ÐYúÙåF4kçx3ÿE÷æ„º	§a[¹jÜ±ïÐ…\¤QxÃ¸Îþ8Bû+—O°Éu¿ï'	x°"—˜fÁP R·~ñ¼™CEDSbÙc‘¡!²Í¹@‡Ú²ëâñe°Quµ’ˆ•©ßBUWÀ	|5ïUrZ¥O¾7éûáRæÞ*uÙ%DÇÅs^:ÊV¬kg’F˜ ÉglïäWÛ B›.'ý‚ÅaiVT*G™î°*Kk•H{=cÜÈ²löÅ5L¡Koe—Ub¸!6¤RiµîÍ“SkÎ˜
e²ó‚ª0UÝñ˜#GUá-¯¨)ìÆ¿ä1 ñj"\÷Þdp}cOŒZúäõoÉ•ÎÀ/Tj_$šëâ]ç¸CÎ/h³:‚ëbäýG½õ[;RÀV³JÀ–\ˆÔ¼uÔ9¼ g­“ÎÑ9ïuÚ`áâ¯g.á27ËŠ.ŒÔ×¤(ZMéS¬ÙVW~
æ’À©%>n·9­­m:ó€qÎT[R’ °éu˜øZS…*JÉa~„Aº§ÈwäÈ~0#óGQ³4±EÚœ¶jïóÜnÖÂ¿âå\SŽŠ1„Ûd±5Ð¾jØ|x©WMbÃfSwLêÔcmôžƒM¤/­¡V<G¢‰¿ùì„Òw§Q<óÂxap£jp?}âõûìäñaq“u2Åø1 ¼Ù>àAßð0˜È[c†é¾}Ø Ê ³ÒE€‡Mü¤\å=1Å“•¾§9»ÀãðDÙÜãGL«Ýîœ\œ+fêøË–WMás+,íG½^®y*<÷§‘®p€Jªe$ÔþÀ6‹.^bŒ4Tºéœ’œulñîƒFÀÓÛ‚ÁYåˆ„«ëÚfH­Ð°Ã’ƒèßÞdhh?ð“>´¿ÀpdÜç ^üŽy`Š@Ïc,Æ84›&cGWÞu8{3„ÞþrH/Ckf†Ý#²¶pÛÁfgëà%ýóeû9è×«?kz¸×um™Àq0˜`Ð}yKÒŠý‰ç0ƒ~„N] ÒÏ—™±ÎVçÅa“þÙj>Ûy€ëÇÁ˜¢}ÂÚ¬!9¼ŽoíÓõ†jhü–ï:ò~AX¸õMßaçàùÁó‡$¸ß|‡©ûÈg0ËjõÆ‹ÇpÚL‘£‚~2p"¯Ç-jî:q­Ã‡»ŽÇÛâm;ÃÎ36qçÍ–~â”ßÿÌ¼å3³ŸÜRW…zÊgFGy“,&Úá‘PÃ‰—P7¾É–ˆfzˆ¿¶q’àÆtj7ŒÙqr÷‘E(b1ài}[!¦I¢YÎûnÖN
NXc5Â= ÑæNgÄhô`õ‹±‡LºÇ@BP›èCÉô9¬š;eeQ+MQÒ™Xš‹i(ÈÄ…0j}9Áûº…˜+A­Véã«¥N5>—bA7‡h#ØžÐâbQ¾‰½šZÙK\ð ÆØ>î¯·ûlÜÌù·¥[n¹ÏKq[‹aJC¡^¯Ýæ
¡ùÐ¯ïî$šnÂ=Ò‡fõv/âî¶ý¬p†¾,—EG¨Œ¾›ª(3VÙñ¹I‚HiZW£ÙÒXÉ è¢Dlí‘7­öo{§ïOHûôè´GÚïÏ/N»ÿê”)´[-²àt–q‰œiðq©ç×“EõŒö(ÂäÐ7™¢w™’¸t
‡â+\3ªvÊÝ·GÁ4Q.‡fÛÓÓ‚ÆÏ§³1æcBƒ>4lVÍTz?e.¨(“ëÉ=ü„Q;ö½qîþg‡[7.÷wAp?ñ3w÷ÜÿÒåîóNëc8YåÛ;‡‡Ïwœn§Ç"9Ç¸:¹‡Í­Íg›-—Ú^|	òÀ›ˆ!×Cgkk'À$‹õlÇ°2í,”•ä¨¬›–e¥¼_Hío•¼Ee	Êš¸/±
³ÐÔ—ß$bME©ìÝò?:HWù[	½`˜ó'›(ï©µ¼#UibÌÙ—,V% ºž#úï‚Ò@:ß±€1kF¿2Ôg¯†‘#T¡£&g°;à-Yª}·ñV/¬ÀÙ•4¼“ÚUEçRÎ´@CzáMý¬ßÅ¶“ŸRôòöa#a½Õ›»so?bú>ÚôDv±$E*úâLy®bŽâhU)‹yŽè²È.U–œðŠX[	Žþçæ'×§I(]<R>(K3g½×i5€„&'êå&½€­4–}ÒÖˆ¶‚vÅP-õ:[‚§5
ŸýØÂ),¡*å 0Ðò´d„ Ð‰œ[ôßÞ#G­ž¾¿ ç½÷í‹÷½N%y§¢¼O½µüg­v÷ä­ëé¼…‹«ãK-WQo@Í!ÄÎ’ùµq$sÒó ™—^—R´·Â.ú•%:æRåc®­^ÂÌE¦úÄqŽg©–WÍhS‰qJ\Ïâé‘!È…»P~)*Îñ{’Þdâ’v–þUà£”®£ë„¼Á)´Y¬4lüeÊÅ0IzÈ=‡­)ÛÊ)Á³õ[D°[ÂVÀ°"¯?û7ƒxµ§íP};\`‘­>­äF'ñ!6Ä»`8ªóHÒ†¾6ƒó›>È¸!lÒ†ùpÿ©{pñîw´óp¡ÅOöà7<Ø¿#Ç Üƒ”þ Gûöí?a€Km£U^<¨ÀÎ¶1;£oÅ˜YúfOÜÌÄÍ^*Ïv>ws2±&&¶¹õ(yþûœäœòi!Ð~ìû“¯ö¥w{¢þÊÔÿS:{Bÿ»M¤ÿ7‘u=ð¸
¯ƒ¯ï³×z"ûÊdˆ÷ ßlþOÒÈ—‹
ªN_«…Ú¢6žÕŸ©«ÛdËª­/¢ß”D’+Áæ†Öµ˜í—M¶Ø±Z±‘èÐÿö9_o*ƒz×+ÙLÏªõjM1+'Õ¦½)–OMà«zÝ·ïÒ|‘îñq§wÞý±CÎz»ŸÈA§ýƒ5{„£Š¸&‘pÖ¥PI°J|!µÄš b!4“a\³ÔI	Co˜Ï5Hæ6m~»•ýîxŒy[Ÿ|r„ÿœÅþ§À¿ÑÖ,wC>Øâ	Eð[Š‹D·ºg1ú°“(z®›Eäšh½/4`DZNãô±‘ ûSÖÓ}Ì$‹}/¬Ï‚±ÿM¥jZÇ§@=g wzäMëàm‡lîi·zµJYV…“#ï³“Ïµú@èŸÅö‡Z¬8§'Ý»ÛÊ’ZtÓøPhß ¿5.1áÒ‹ÕÑ(Å—JVæØd £MŽñH1§y©&§T%ž5Ê·ÛŠ{A*¸±ïr§)K¥ä‡Uã30ô"VæJ52ÛQI}HªýX`Ï‚	±ð…<Ö³zgì‘‹ã^X]½ùò¥!VI•ŠQpý™ ºÝfO-îgþÔP«‹FHQ,¥Ã:tôg°q
&VØj|r+ƒE9 B)Ð}˜S=b¢63i	^Õ¶‚A-³ Ñù—)meÿ]ë_ÝcrôþïÇ­mâŒ.>RL34ƒŠœq{YUFM´¤ÓšsŸø‡MŽ•N—w|Kk–V™LW› ^Öº€ã-Ò(q³ÿ{ÿ ø$Ro]ãÜÚ˜cñªÿûzD1,FèWøÓ¼XÌº6¾Yïy¸×:„S¾¾óâ—aõ—Ò[À
M”;`èÔa3œv¬Ð?ŽD4§üï1­Ç®ËìÅL&p%§+@cD*k’Ï5ÑÀ-Ú­šcÿþ|açŠÌ¢¢ÁÊþOPêÝPÎ-½›6á§öÈïÿÒâ~X˜ò’ç!Òy–SMžJ®G¨	ÿóü¢sLÚ§Çg§'š´R›-H¢"ÓÔP=žRöÑEË,Q®t+ÍˆÓ\Œ¡@0¦t¤–‡Ê™?ï{ÖE6…› D„­Ü4l¡Û­£éuZÝ“·sG;)‘Ãwž7ží’Œ½V5Ý(FAÍ‘\ú$*Š¾ô÷í¦|"g§B6vU½”±6¡ ·FÇ5„bui`âUYD(ê²¨/?Ä‹ãZ¨=ô.ýÐÊ)íÙ£¦ôß¢Ð^Ï˜Wô1ÎÛÍ!±Ãçi)E¨ýƒÓ	šßYèÊr¬`²¹µ­í©›i/Q ±¢öJ˜™Dc.¡ŽòÔ1ŽoQÜOêêyÊý#EèK/¡=Ý¢¡†èM¼sœnŠ¯þ‡¶‘¾çðôô+¯u.ZXMÚ’¯®P’<uf<$œ£gH˜?¶¥+¤–xËå:©¥Ö„‰ñ]?šÞþl5·ž‘ãÖ/~8 öÿöœ\d€ç·	žjÒB5&û>™Å×},>œ¬“A0Ä²Äx^Ã§q|½YôE…{O@ýE1p‡`–Ãnš¦ÐNXãž9Q¤&øˆ/Ãôög„FÂÌ/fx†$¶¿Ú`‹±//]û´Õ~G:ÝrÖ;=ìÂ9§„_jG^Ô3ö5‚0mÍÂTØÇÎ%œ°KåJyq®RÉK=gek¸.H¥ý«´;×qSØj
(GJy)ŠPÚÒ`Ë©Àˆ\ë‚qQ‘tµ~"w´¡Ì3•Ó-ÔD'×1Ìenç¨‘¦I†¤˜æ(æX1³Æ"^òWVÂ-ây	Ù¨,YX‹$ã½¢H%Ÿûæu”õ™äe)Œ%äyeÈgº¶zOÏøÍßH×ÈÙI­íM&[ šÐt•ÁšI.c–,Iñ¬˜ë„£-¯ÞÃù`ôÚA‰¬PDGLQÎRBõ‘zŸòïÇ]Œ0rtaD7¾Ñ ­Z‹/=ãŒœPsõ\3Üû¸W§ÉMJéEÚå˜-¸j‘JûÊ :ú2;²,6yZÇ…9á°Oh>÷•	ËC;²¬mó´4ŽKÓ{AHZƒ(‰ëÚøxSyuh_–Õ¡mþ°«óxÎ}n~AÖ¼ù+©QaqéìÏwúg;wlÛl¼ÙpECÚ’39§:ù E£4Y®ŽöT˜Ãgt6vô¼ž%—(e¶¾ò*éÕ‡J¾*ÜumØ…•±îÝ79	«1‹ƒq«í‘or'¼òAÐüGuµ¼|-|È:Á™Á$Ý“h ‰ý_¯,?†`l~G±®«¦¬©ø®T™BÙg£Ñ oæ'jp’™´ÿóž~-ëEn¯ƒ;a`'ª%ÐÝÑ§•pTk£»cŠg¼t=ó¥õD2¿šè: '˜Ô=–ªt0å‹,"O:ÊUK©, ‚u?ÚlÒÝ
~˜Y„ê™†™R#ÐÙY9Öï0—Ï‡²Â§[½úNSŠfuçRÅúÈZ#ÝX•í±QÊ#„¶ea¹äª“1ÃÝ^ÝëvzŽƒÙ³‡EÕ|¿`øÄTÅO>ÿík´„ÎGoƒ ç{§º	OS“ÅôÁl¥ez_ÈZÊª›XÌ¥ùjÜ•M ´à_Uh‰0Û°Èh u¡LI´\ˆ jÝU¤UÏßCq=Dv°€±'f¤„Ýèíp½|£? –óû,ÎI¯Ûæöž¥¦ù‚ÄAÿÉ2­6³qt‘é5ëý½|£§ý0‡´
¿
KË£7€ö¤Oã¸0XSÆ'dQ×_ìÆzšˆFO‹ä¸H=?Á#ä(êÓ§ÅÖIêÑ¸TR»§Õr\­ƒ Óï¨2C~ô'×>©½Èw¤Gí[˜“÷ÃñšûòM(Ó,. xˆqõD£§¥s\º7LÁâ\»±rAÑèiqª,N«ß‡7Í!J¨—‰÷g])Þîi±ë‡Û(¾DáPÎ¸NÌë•ø!ÆJæ‰wÄî7.S®ea¡D½”ßm½dg‘&Š9šÒsGf_ô(@ ôè§“X»èêÈÚ9urÞ^ÚÅyÅ.N ‹£¦½œTì¥½tÑÜ6)uÕ5wõjƒ‘Å£¦ö³('ž¿8µóŽ¨=×ò‰ÚŸ¨½ðýÃ†^Dãq4`zH;x¿ŸƒÜs=É=×òOî'YDê¤Kn¥ÇøÞd|K¢›I%Zû§Ÿ¬ìÃ?ÐÙi<ô&Áo˜’‰.ÿðÄÖöbr†%G*‡Ï)¬^L»2['x£G#êI8ë\è;Ÿú}´Q´¦1i@zQhÌŽSrÞÞk\)©ÝWÀ0™ÿ…C‹£SŠS£Úásq G©ßM(Zï­Ë1ÃÓô Z?íó7°¢×°âŸ‚$Šo¢©Á÷Õ:êuÛhÂb`wR‡õ„•"5ø¾ZGo[Çÿ<n_tà|}‹Zú±— ·ööxøßA<»†w–Ð6ªÌ[§ýî¤ÛnýçéY§×º8íÉóx
óàÍ"xÖÅéâÏú±Û»xOâ+û¢»TNø±Wù)Ùy¤±C–$X!*à‹GÎç×DÝÈ{½cI&*Ttùâ^r;éKx`ÁõK eÿŠü…0ÖËßÉöhøº`’lÌ¢óVÓ¬­‰€2
\¹*w!¬_rbÙ,S!ñ,ôi"<ŠSÁ„¢¥‰ÐCøÒÉ²#_± ÄLÄ05¯ÉÔ‹ÿ0Œ¼Y­0IxB%t–”cÁe
€HOj¼3:C¢ãW¤YaJX˜‹‡¼'fNÆD}R2T±âñu°i»“«H½yÅ	t(V”˜…$|¹< RÞê†}¾Ò¶bƒ¨›ÇÙVž›ôNi©oðÚ+¯nvÉ÷RÚ±Ø\úæ|åîàß©oòdý+½-§•©oüE¶Ê¥7æluš‘ÙÊÈßjVˆðÙ
ñ/ÔÍ“LŠLï$KÕM÷S¡&1ÒîÃ¦›tû@Ó¹(ÄÆ$úØŸ†pfÔ6>ü¯þ[«þ¯fýåÏCØu«kùz{Ê'Ì@
Sï”òžî)2£K/”ÖT=Ot¼þg -`CÐÆœ¿-iÀŽÔ<<L¼ªoÀÊ	²ÙÐpärÒóu<¨ïóî1$¸—`MœÜh4¤®õõÃ¡]žiZÞkÞA^lY$<yÈÈ±?„3K,‹X²1âÂ{e`I¶t¸f!0üZŒ«?ÀªáÑQc#AMŒDWªUXÌ‹èŽi
ž`^P|Ü£XÉÜ);_Ì8^6ÙUyÎC8ØœÓº9ÆÅÖÕ G9m¨~¾ü‡^€ád 
°±ð‘ <iOÁðË†?í½mÐ
Ö­ƒƒ44^Ÿ [ƒÁSôûSôû—~ÂKmÀJ²ó ´K…WûŸ$þÂ»,#V+Æ”Tš«®»UÊÖ!ü3»:û±ŒÏU^¤l](ü?Œº¶*D2UY¹GCà~E—HœÂ¢»9SµxWDËQY[Ã+ŒY(ÒÑ)OK¬ª¡,¥!jmìªïÛKï“‘f´tHwp™î66›åîËÅ3g3±÷¨pé£9„¿{5›ÓƒÃÄ¿yœ”€ûšˆ ûÔ…æß¤ìY—£´Œ¬œ;ëƒ‰¬]%•G]§bL@*Paÿk+ÿ:¤ŠZDTß‹A&W e(0*I›[„ Ú#Á¾È!ÒbÐ£§R'§Fµ‘\ŸšT¡úñë>ì8cB‰$—·4y`&Ë:‰bjøK×1wá%´ËŒÙüýÚou~T¾½sU®Æ—àíCÈ°¾ÙýG^7¯Ÿ4»{¹åÜxÖ¬ iéŽÌm›Qú-
Æ\nßn÷“¦·¶®Ó•{
¹\çã²<Ç¥ZæŽh«vi:Åð:ÊýÎÇLql©ûâ;JÉàÀEé;ò÷k/®f³µÔ¾t†/ò3øÞ¼~+þHÕt§kFyWÓ»wØÅŒ3Þ'Pé1I,ÛL=±½U–>j5òÐhê;gç„»1;ûÕMœ¶gI+D ÛÛî«ÎÊF®$û›¸øð#až˜Ü8Ö¸„PuÃt³¥_%³´ø¼ò3ô+Ì‰¦×©NÒy\¼p‰…G&ß}#˜Àé0ð“Ú¯è§rè‡.Ù} 6„+†¥ügŸõ«1)Äeœ&}ÁtgñµîÕ6}v!5ök#ô'C^ PëúËÅ¼˜e^þB)WçEC×I¤%®hq*a"&·ÑuÌi¶a¤ž­²Ë°^÷ú©æÌ1[b¾™†DQdÖ`Ÿ4)ÁZúŸPfá¬4á½w¸èÛËÒx“Œ6Å¦X3Q‰ÃÚ¾2/Ryá·XQLÅØnŒ[ÆÂ<„ÌJ'¶ºžâ2k˜ÅË©xÑ]§ ïWõ«[ûð³…ó²ëžøpŽ,é™&º{SÙ™·æ6:k…Å¿xp’ ¥Õ˜QX©¢£Æ^i­Ë˜¿lôXÚw…NV¨BæP5‹I¤æš®âR2¡‚…¡ˆd¿*™
æ<s%W¼î?ÞÛ'ÕwÕÀ€é±*/…ÒXø#[;T\íô`åí¦Àø<r´†8#ÏÓ¤öíß¯iëÎfc4—'NiäðùSÃ&cM”L)¢åJüApm?]w/ÎêZ²–WKh®QÄ.CùeÖ‰•Œ‹‰ÏN'–/”
é¼¯x8Ûø¥£$í~ò‹ûúNÀ¾±ªžšs›B+ªz^ÚO/,ƒ£Àÿ…J:Á/&ä›×™–évrU<YÝG÷¡Ñhàßëé€Üz¼¨ÌwIaGkš˜öb3Çwv9Ó]åÏÃ¬ -‚6¥6MG™0ï©/TLw:)‰¼mg:_=5¦³/vSÙ6+ƒ¿¬ºö§°Â>¿ÓTô+YüíG´©"zv¹°~{¥/uäµSoHÌ!ü°"^ÒÒWŽ\¦ÛY*ÂëN‹NJK¡U”‰ðr”‹hSç–
RPðº²'zî+Œ¨ü!Ç«d˜hñgÑ“­Ê›»6uoX½º§Cúl*þâ})¶~õd£µZiTÛ›ÖnÒÃêKr’…ãkèÄÏRÕu‰€ò&|MgsºD%+Svñ â=B'3hì¶Û\…Ø?âäð@i>9¹`ê‡˜œeïIWåË"ÝõWÚê¯†Žï×jšN«ÖÔ–StQ(Ñ¼IUJ½ÜÎžz}î§1uý¡ù³ê¥¹ÁÔ)>œ+{ 6·åª³quigª¡Q›ªè	Öw‹Oi0ÁN1h1;uŽÂÑŽ–Û;W×’^Š"A×
Efc|àÏ@VÇ†Ó ºíˆ+ÊŸnÓså–ÿŸáM½6ñÄbçÐúˆY¶òøY(Ç´ó)uÕWí¹<IpâP¶Tc6³´/3*Œ¸¥OŒ"›é6M¥œ·¥Ï‘HÚ¢‹4ë4—ßæ~¿'?D}å3y3+âñÒéËb„‰inÙT^¦8ku’}# Â(aFˆ6[½ÏfÚ(ü!ÄXÞìK\1ás°Í¦9cÂ
lµ¥ïñ\6$'´çHó%æ/ç·aô•"×Í#x0ðm%kvµ’$Nˆ „f”]Œ‚DŸ/ Ï“M„7àž!Ãhp#†»D"1ô\[iŒåºÀ¢|qÀíH;hix&ÊþæF5Qö6?¶‰²»ùN”Ý-çD=Ÿ‰v¢|âƒ`žð'i‘OÄïú MÝOª2?TóŸO]ßwUÖy_p”™¢4+fXÁV7M±À¦Coqe½Bâœô\*¸9àÓÀ\á]°Ëz]ßÅ½ìê%VäÞY"žL¶Õ5PLÉ‚ƒ\C~L+Ò}žS³ŠarÍÆG³ §"]Ò}{ÓÌBÏBî7›Ôx\ŒŸâ¿%Žƒ\‚Eu±XCcd qóáª1›£A´Øb&ìÍtû‡CYØPî›|h“ÀË^)»iÚ-Æ¢J¸DÅÍàÌ`3È»¤¯Ž¢ÉPâiU"äl6öÿþ/ó<;˜êmë¥Ÿƒ?»^”º›Åñ¤=iFOšÑ“fôø4#ëýkdo9Y¿îy¾óVô3™,ÿª~äOU×ÏäYÿ]I®î·à2±j~†%ÂOËSiyœ‹Í•Öçë,7÷è¨ZÑ9‡]ô•{t‹U¹øœÃz}uåçÝª-^„ŽüÉÊÐ=º%t+Fç°Û¾¢rts‘*¥s\®¯ª,Ý£[´9ŠÓ‘?{yº²d®’]¥næ)ÚU¶©ÍW¶«ÔÏü…»Ì¦–GFÿs”«ÓÑÿŸ¦`Ýý=ô?O;ÝøÓ”°S82æ/bWêl2v(Ò«PÎÎÅîñ5´{tkV¹¬ŽWü)
Û-×á¹<gçKtr>´ƒóË:7¿ŒcsvïZ¯àÅÌ}*áµhü˜„][O]¯Ä¦8ý=°òÕÑ`Úúy–û2Wî#ÃÑ×"‚,¹fÞ\XÔ†–æø÷ ôåÉ-Ä©‚šA‚`Fƒ×Îi¾MU72Çòë¥èÀ9¡®4ì!Cd1×ÉÓƒÄc/ÃwÙÉnÞØmŠû'Ñ¬îaïþ@Õ‡
gEÉRÎBPŽ+Ã¸‡ƒ+ßê{òKh|[-jø£²/˜©‡"ñM·cTasm,“sâß6Ãï_È)¹’–Á}
'Ëü„Þ´.ÚïÈY¯{rA¾#œö.þÓ:R—:ƒCgÖ
CP	å™að)óï\SˆLq€{Óü!
íJ†¶–Y`ˆMæ¢e†
E„.sE„@p€‡¯å:@©ÛQ¤XtÖg%’TñîDÖá?Òî•Pºò«D¿Ýv Ÿ4ƒCÉE	ZYÎh)Õ…™B9ÛŽwÏƒd0½Û•}:^Ü«Ÿ§Q<#ÝB·"µÓÒ´ërñ$:©5ÁVX=Žî ¬Š–MõrÀ¹Ô¿Æ1ãä'XóÁgÃQ=öiEä¨Á„ÂÕ£È~vò6i¼Ú˜Î/rWfËìi¡ºOtþs’iz±Ý¦{·y„BðÍç- å†Q²XyÆnÞDƒ[§rQõMEÊ3Œ˜D|ð|Åˆp¸GÿŽádÅsôYiçÅpÏ"žy?Ü£¥câ(,ëP*¦Ay3<ò¦þa›Ö¨ÈPäDl¨*Î^[ôE*„¡ZÞøY¼š§Œ¶ÍIez£’Ä¬iRéLLf	lìmÕÃTR&L'/ßré•Ïóûë³Êf4:ZS	<{ácjÍF¡?³ØÈªÙ!evLEv2\¾üu…vRó«æ×\µ}#n¤—_Ÿí£2	že7ºVÁ)Tù9¡u|º´ŠO›WñÑ¸ŠaQ6(†õ—X3g›™K§±hÆ£«‚dÚÒìpÈ7Ý£Ù2tP=
,J3'Ã²fºdjcï‰½W©¿t–¿õ!*/ÉTóy¹ãh˜ôBàêˆŽ¯˜Ú]+Ž½ÛÊÑµ‰œuVCQÄ š^9¥i|¯qMdò½‰"¬!³¶¶–BŠÛÌ£>¤‡Ym¶Ä&æ„OñÆ4á›ßâ öÙ¶ëòòL°š-x ’c‚Û oð`ôgnC¶†¾b˜ËÝ–¼Ó9w&¿û+ßœü-Ý÷§7ôßÂø§_`š%íÓKNâî[•ß‘îVñy?ýëËïÙÎg`t7´1Ú(‰$5{öÎÿLÑ'gtâºƒ¤‘¿ùæ"vCƒ¦Þs»Ûl–Mâ‡­œÅ•½Q‚Rà;M[I9ÍbqvTÔÇÞ”ãð–ˆf–ºszÓ*»ÊŠp§øü”XMéäÒôfÈ
’.Œ/¿ÝlJÈÕš®toB]èÞÓ˜)®O8T™®5Ð©@­Ìz‚¶•ri2§³¢œì¤§‚-j1z]ðLtÇ¥œc4ÛøƒTUÜ3$Tb)8"îÝ	nÇÛÔ\Ñ\â&E7Xõ°2ìv&ÏÐï
í\ëè!Ä†ÂSG.>‰7¯ü0¦sñj|ìa«æBYI¾\®…øøø¦D@3Çƒ6ÁÀÜ¢Æ§=] CQ<S5Ë`M%ïîÓCWwiØþ³Ð.\s	»Gw<Ðk©A-v›d:FTÀJ1Ì@
'1‹£¬6©íJ:"–ÈHÊs:ò’RûÚœÌâ‰=ñ#qó’ù‘E{ñ­6PˆÞ¯ÑlÕYŒ2¢c§<ÄÜEÄ$¥×äi£>mÔGµQu¿°¢É9òu.ë1úñq2¬!,t÷€ëj¢?Š¶Dç?˜«ëdÕã(^5¼%{íkh¾¿	&ƒè¦A¥[XM.¥!GŠš‰€…³ÛúK)d&“^¦·ÌmùYòoNÃƒÆ9gåà:¦¾æúV³Y¬ØeuÇ³À¡i+ (^Q#†(ø¦ˆ!îy×“þˆœß&0\&ð˜ø¼POŸøïÿ}â¿åøÄ$Œ¼A+…"A£0ŠL¹WË"bƒä€?¸š€qÊ*lŽ¥lß_p[Ì½)ÚnCè¶ƒu3¤:ƒ>»š{%ó ä£Œò§téŒ~˜“Yl¼TnØmfß•ƒ¨+ØbW?±Y||Ãè²9Ïë2/qö<H.Æ’€í4±j.ˆ±´Ö‹[Ë>K»}YžÁ·þÓxà­ÓÀ=‚Õ£’F£a…•ÖÚ¾Vöï÷?‹£!tšÜ“’~yÍ¼Ð‚Ë[	79¿•ÄLÓïFti
A¹–ZTŽ(£©<ÍÞ¦û7A¶÷6w›†B’Ùmè¿¾»a0íaÁšZqú`ör“·FþJ6›ÍûÿùÑTŸW­4”c5ÏJÛƒK6ä"˜:»Whï®*¸ws·ä^á„¿‰„út÷Ö14£ÊóAœ©#Fm0™l¸Ì„©†ªÖÙOÏÃ€ÆÅª«½jÙšÐ]Š“·§ähŠ@Zøú:Î	îcÐUæÚÌOÏÆKóUìw&Èåa¿Ïâh2Ü_yBÅ.ÆÞtô“ØÌìW4³ˆáË¬Y?
£³QˆgkŸx'­xÞéáaÖûeÝ$0Cé`X€<ëûŠfÜã}Š‚{ñXò$
ßòðö(Šéu13siÏó=÷£ñ+íánçÑðÞðD^Õ|9ŽEÀ÷Ù¤Ð‰Dk›€‘O@&®gck±„VŸ:‰0†“$ÜNíõx’dëch´¤1ÚI?Hœz<dô³þjãZ¬bŠÊ.|‹;¾‡5pEÈîy?ŽÂ¾n|ÂŒR?‹ýOãÈËƒŒùº¥¾•“2äÃŽM6ÒÊ5#Ôþ[
q¯æ(zÇ¾ÊãÎ”˜¢¶7ùä™$SÙ Îˆ ¿²ÿ>‚å˜°´É5h@3A`“‚¥{ˆ–¿»êYª}!Õh.µhn•èQ©C*ÉÂ¨T e²¬v«çw¯5…'MÛÜÒõ’žç/¥eèK‘º£ð}R:ÒE†Rþ4Ýn’ñgš¡W`Êù7"	:óÍžD4íc8à C]N„˜$,´m>uBæX…µ5ÀÙd=aæÊ•íÍ{z1´ŸÑ#õ¸‡®œ¨ÎuÎ!á™t»»˜I7MW0'ø9kOsá{§´–#@P´ÕÈßx=EÁ<SÅµ¨×AkS£g@L[ˆ˜?ƒ%S?XÖÏ¥¢cÿk£œ~	gÄ+MŽ-ÖÉUà‡¬B6ôg]jè=¤ßÔ²T`C–Î¡ÏCàŒçÁoþÙgxF£göÈêçd•Àè’1ýïÖ‰þéŸCúßÿ„ÄÕu2ð¯¼ëpö£2*HÌ |­‰?Ìs.Æ´Gz~¸Ï+vß:¿FfºŸÐÃ°_N?¯®›Â+ACTlm-é[cÛm{[˜l¹ko	s…-_Ø[n±¦[[ö¦Û¼é3hjhyï°åa> üŒä™­©a_þMWÈRÚŽ]6«aÙ§Lx¯£¸MkxÕ¿½ÃM¨Â/¡Cä¶‘!Ý:³št¿½“˜À÷dUØfAàI@_ôë/wIâÍð¿¾Û\EœfKf?Øl47^5No+Ã‹Ùz@¹È¿Y 9!Ð„}¦V•¦—Á`êå°~Â±´ñ¬™SûÄ7ÙlÕó¾íÍ¦KBx6Áü>Kù1‡ lqeÎ^ßÂÓ³Ëo$³hz¢™7døÆCP\Œ=]OÞŒž"Æ»t28õ†‡zF[æS<»øÓ3:mÇOvÝDŒŠñƒ
Oph£•çOsxˆÁ+®¼©U“—JÃF9EX`°©¢1@@WI/sI¡i¼‡sÆyñ²mêS‘8Ó«öÈïÿÒâ~è+ü<ÂÐQPhàR¯.bPÑ¶´M±‚6µO9ÏÁÈóÉî„[A&„ú(cä˜]„Zbíeºù3ªÚ™òf¤Yn
ìÑ8’9bfÀªlÓßY½HÐ§vX"|$fh þ²¹µµ¹Ùþ¡@>ü¥ÙÚÜÞlþ\ K– ý¼Ù,q`=ÞIz’åU{·(liR2¶;NÊ›áûØà¤ËÍ‹TÎ zõ©9ÿ`…d3ßMfìîŽAtÞ#¯ã°ö­fè÷kè·Ñûgæ;áäŸáƒ?ÔÇ ÓðÖ·.=ÇÚÆZ{Ò¶M4IüðÔŽB½hJcPÑ2ËP¬„¤Ãô¡™_á|ÕÀtM˜!¦mÑ®g3‹ôXM†7¢þ‹ž›]²¦|Ñ)CÑr…=g%')Žê/Š{šoiZáóSà±?àû>«ù‰³ªkS]ìU©Ï½-B' ÞªX‘dæÅ3* LtþŽctäzH‡‹õË6j®c9¼¡Jß«*4é0òuŸ?˜i¦lIÂ¸e2æ¨Rï]x»Ô>Ž”Ç•‘‘„2ÿÎÊF0‹¯'}àò[»âj÷¡¢Vƒ.wòS0ÕVÏ/Z‡‡õUn^IítÚéoðÓ÷èÍžzqâw'³ZNçûH<a¬¢¶¹¶N6›kä?ÈöýôóG8–Ýî¡Æ=¾üôµ[üåŠ^«Àl÷eV<q­,_®[Ö¸¿–&¹–ÙZsž)áSd–´Â¢-DùU¦:&ÛlÅ¨ñÉõ(|Ð›Ž¢YôðSF“gãT¬§U²S¶ð@Œzù,z.Ê™²+ÿ¬ÄË r¨6l¾(z@iR(^VcAºB±7˜LÐ“ë<^îVRÀÍ|J;M').íÕ=–…Lùá÷>Åºý–²ó¸ý´”]Ç²îÙÇ
›Nr–>ÌŽË£›id5£A"9‰DH(Lt6N#Ob–B±ÈÔî(¤ò€QMùÒbÇ —êáw>åiÇ˜¯j;&ç˜·€ÿeØsÕ7E8öšžßoŠ=À1ž4ÁŠ·x[ÀcàÝó> îêyt¾& Úº¼Ï;.}©§mg¾ªm»¢ºLèyÃŠ¿˜áŸéA6Ž&ªï›Ïµ™á¹JËß¦;­Ãíçb›ƒŠŠëãØ§cæ¼™÷ðÛÔuGTÜòþ/“S}uZœI›PulS èëR[ª %ð
7ªÆ#ê`Ì!áÝŒ4UzhºC*ÝE¤UÁ¨„žÌª´ÙD³ÒzÕ'Û¤ÈJÝ9ø	³«Êúc$ZÃÿ¤Uå	UÍ`Îüäÿ  ÿÿì]ÝrÛHv¾ÏS´•©µ#R”d{ÆZISIöj×ú‰¤™ÝÉd2†HˆÄ$¸ hK£Õ¤*{™Tn67©ÊUr›çÉd!çôÐ º¤iY¬š±MF÷9§ÏÏwÎÁ•D2eâóRÅÊã2‡ ÜH¢¤;ý‚Éô<©mu¢ú<ž·è„^Ÿ?Ÿ¥®l?</ä¶aR¯;K¹hûNìö‚ð¶*¡ëì·ë²­º>­ZÁ‡z•Ý×•øvqvï•‹ÅkÞ»ùmWNÿSÙ¬ß»(…£½§ï²súT¶ïàô›–ÑºÁÕl·i1ì¨?† kï&g @øŒÍ§CJÍdÇV_5è)>#Þ7CÐ:A7–àµ×MLA|û$!ªÚÉ©BöX.­'¼l§×VØ#œè¾ò Xß>%º&xÃæûf»žm3°*,)¬ÉÍx¶ü™ØD`|cáOËòÊ}Á(¦Ž	ã`š0åUYÒ˜Î&‡(3.ª´ø–¶—ñ™w¾kpñÝ«jö*/.þ&f»ßÚJ°ííï;wOÛoóAÈø;KÇ½<oç˜&€ïÜÑd¦*öñ¬‚®"¸+Š€
Æÿ“ÉfŸ®ªPôi[“¡ë”¢C_<kSfPºH³^UJík"s’Ñ~†Øi;íI•®0_Æ4ì7|º¥`*Ø— ‚M2÷/­Á—ˆAé„Vù¾%g0å
Á›â›bº["N;ÂÃ›”ýð¬õ¬XZf‚÷£ãHo˜„ VEÇi·¾z†oxÑ­2H×ëa2»K@Å€˜ÜM@äxdÁŽEÁpèú-Šöæ1–Ör•˜×G 2VŠRÝ—Bz-^¡ô’’ô•¸´Í)Ì
(ÔšP ñ‹ßÙwM¥ýR›§'¯¿'{ç‡{äåé9…ïï\ÈSmÛ¢rHk]š„§˜¤üG±ÞTwê7£NH!Ñ ½à?†½["^wg))9BóÑ@—º±ªÒIŠ½tñÏÛæWšéB‚´2-ú‰!Q%·S…Dé$…™2{G|WH”þüsÃP"!:7ZFt¨¢5ƒfŸé tÄ%š3•µ9Ð+šÁô)ÍÆ¡
#Y§>ë‡]YÉŒjLdž"íxòdcå@2±xÒtâ’$â²Ôáò„á²4á²äàÒ”`s"°"ý·ZÒo1ÕWk5êÒzE2/P;Kå5eñæ’®6Ÿ‹¤«¯&NºJšËäÌMè–697%`Ùe]‘«ÐuÞ6½aŠk“É÷5‹ßÛõ9¯œ¥¥ÍÌZ´l¬Yf`©³®”ŠJá™OFUYTeNÙfæÏ7CªÖ¬¨:3¡êÎ~ª’ñTk–Ó¬2›2˜•Ç$'þ™…éf-J•*É€¹$$ÕðÖåÉF•^»¾¤¢š‰êIª0TŠLQ$=‡r£½P‰Aõ%ÍÎ+cMä¥	=•h¼ŽÄ0Yµà°l±WåT=ÓäýAY–}ó´öì›Ù“ki6M%r­#kæá‘ëG›ù2{ò³Ëd™möJ%
¯-Kåá‘ù<2MÒâô‹‘s2{±Ê!™IÞˆìd!óC,sBæ–R%÷c¾ùSçx”æuX”+²Ìß°±êK€Ò*¶•Nƒér062=lL) 
?¹ãÄE`„9¯ä‰Š8î‰í‹3Ë˜°Á;|Àí¨’QÌžÏúWHXðÕ¯’Þ°¬P5§aÁ÷Ã:_aQXÁ6Iaœw‰Õ“æ˜PðA’¦J(Yçª	õ%ÔšPü_I] ÿ¼€ýUÀüµ ø9hÿ©Å¥€ú“€ó§|Ô¼Û?‚íKyÔ`_ÌÙœäžŒàú¹«:¥Žp5ì\3å×¹9e´‡•Ÿ^_t·ë»HØ d=ûˆ‡È6QÔâhœydC] ùCó|(%#é_¼%@“2x„;äÍ,·x3]â„ˆ£¢ÿØYÂG™ãëî‡V«Å±à«þäu}}FfþHÁcŠ†Yc„'E+ùpèàÉ°ÁFd°\†
6c‚Íˆà<°	\ÀWAçqÀURf`Êi´8Øëî$ç×ä%ù,”ä$¿a<|qå¦–rs/ŠËŠ aDx± Â³ƒ«ÀÁª6Üó@Ož \jýÍý[#ö·>äo½¸_{Ôo˜ßGÄïü¿zn2©ÚE[­fWÆùVàô9`|§|×2to…—­Ù[®·T¯5¦·$,ú1àyëBó–˜À³dÛoJž¿;u`¿†°¾]P¿Œv?Ôî,	³­[0§Gê>ÂüHñ¹³$4\î,Q¹(¹&DîÃ!çO‡;KN°ÀßÎ };5
ñƒ o­p·sBÝÚcnç‰¸o[‚¶-ßZ!mgz¯ Û_ûp‡r˜À`jFXQ[Þý`Û`¥]ø 5’vWÝC»¤_A»Àû`‰]Ò·CÎ~@GY)^¶*ZvnXÙ€”'k\ÝjÙº²5âc+¡c+h;\¬=*¶L¬5"Ö[;MØ ì#
ö[¥âÃ#VµDóRZJœÍ*Ü«òáŠ/3ó2UMÞûþøðä’œî]’ãÓƒ½×2Œ5r}·»],è{îv\o›ñ¬×Þp}
»zfáèÁ!È"Æk@ H’+"ŽÄz”3×N×…‹Œ…“Íe^Ç±
çNx8õ41æ?Ø5ŸP‚;nó¶Po¹°xgá•ì\57Å¯äÉŽYµ’‹cR¾…5Ë¹ÆñZñµ´«ÚfòÁAïAÊÜR™ÃQ³RFvueŠaßŽüÀÁ3Ã‰•„×óöb?«ùäjÇÂ÷}¯óvç®Aë#¹^ŸØ@>U°dþE“—ë#m¥KäHõ³6ÿI|ñ´MX×CA’”aE†‘{0áÎ$YØäÀïrTçö² ‡§¤ÔYTN¶×ØŠäè¶¸v¥tJ#gÚ§)pÙe””ÎÍè¨6’€•Sÿa³M	yþõŒý+aÐÛ¦3Žƒ"xƒ^qŸ£°³£$¦ý‰ÐÒâ]Žï,åÈ^¡:ÊÇ*•#‰HI±ÁÁÕÏðlQ÷]Ò³‹%}C÷ÚC7<€4®4ÅWù‹×”ûg/‹ªq“ÚÅµtŠ/Û‡¹L°” D‡È¶ èóë›ŸåzWÇm¬ýCôÅZ
8öï[£aÏÌF”i"ð}Ä8Ž+ÍmI(
»k#Ù®ÝD2	Vt+­ÌŸ|ìØ”{}v“»^z¾«v¾l¯9s—zß•~Š7/m×½êêîûAäN&éìsŽ.Éåé·ç'{Ti**Kýàýa×‹Ñ=ºŽ?[U©½èªR‰r„Š”Jó!åZ“Q.^¾áU‰¶þFáüÆÌ›J*“F0¨"ÒÛHZ "Ã,(ØŸÞ%Ù{.~T ñþÆ4ÌŸ'ØõwL¨ñðæ()£"¨=ÉŽH¬_]­¡K73µ&£Úçq®Ù~×ÿÑV;÷+××„n"Fs‘;ð²tgR”1)$»û}g0‚eŽúÞˆ\z±ï’_m¯Ñ*&âGãXåüŠoG|S•¾1î¤s9•0ƒ@qWßöàÒ†+ÈëPº©á¶Àšï¹q‹Ž¨ÌïÌì49üœQÈ'aèHç=WhDÊÀ×Agmã˜ú˜hÞ$ûJts üW˜‹‚¾TÆÅÜ÷ü;w8žÇ6ÓçTÞgz×CÝèÒöLy_€¸Q™U6C¹ ÉO˜x£'©bé:Z`SŽ\ða¼‰^ð6rY$‚Qúûu‰é`÷Á°›ëÞÃ'Ü~~çÃ¥€94ÎÝžÁOT'£–R…”#ZêÈÑ†üdú`-¥˜èD9ÊC=fæ¬CN§OÖÈ¥ëÈÞ8îÓˆÆ©ç dˆGU&qãÃ£?u(Ð£D6²okÁáW´\fl/ê}>Z·yÎ"Ï›‘ÊíK,O‡‘3ì¸¾•i³BNt;ì†²Õ"~«ôD¶¡D£Ê?ý‰<É(ÝªPÞ©¾ç¨ê'Á"ü7$
~íõÜð8ê5–Ï|—ºA<àoHø#tÿ8öBÌ´`…–WÉ²†AXì
É>,¼©Œlªx“†Æ#<Nºdþ=¹1ÝÁˆV3èàzªÕúÂ{Žºäk¢…Ö·Z­ŽÞ•-¢ØUÓDü¼ÃMJï÷Lw¾^zî˜îJ—mhz1ßaÝõ¡êdLïVœH&È†×À2]ÝÀ´V
ÂxÒÁr¥¼ñžl‘Žâ%µ8ï/&‘Ã€?Ñep¡Ósœ ”7„êr™¾%gš ¹hÜé¸Q„ÇÂ-%îà­Š²yeòM#¹uëúèJÂÆ‘I€¢(æªˆ°X9ÂÉ¢[°f×÷ùáËÃóÃC²·¿zŒ~ïË£Órpx¹wôú¢èGš]c¯Ó9Çø•ë>:ÂåÀý­•"-šznŸˆüØyÃê^r °`0 !@m›7F²«ÙI~˜'æiPë#/è>l5ÊJ
ÕÁaŠW‹+×UTPDó¦hÚ€YËeFã”ð.ÅxS4—–v‹R«…Ü~ÂrìíÆW"^’4Vå3†¡×1ÀYl×SY2j¦c¸´û:èö°hÞEìÄã¬Ç3ŠRpA£ÖÛŒ6TuB'gUƒ³Š]PÄSàGÍÏ°þlöåïÝh¹Ôçt÷&5‘ë”Fùb„¨PûD>Ð•çÏ øš«	Â"iå³±k¡Hâ@á_±× ÿBõ$)à¤r‹™ZÑ’ù¬³éÔƒ©»y«‘–ýËŸÿ“Ú;–	ß@Ýh¬9úÛliê$øèI
^¡„¢œÁì<’ÔzBRéwO9Y±oœ®þœ”´\f®ÝÜCT¬‘¾p3+‘—É\-°´N¢ÁV^J=8ÕŽÙY¿	bô,Þyâl8·ÑJiÂÀ‚Ã1ÒŽšÞpg©­þMr3QÓiá\Ô©ó3ÊwÚE((h­+æ†;wìDt_ºnÔâÅQêãx?uaÀŸFb•ž ¯%Ö8Ö´;`o³ZŽAË˜.¹­^‹l,Õ<"¨Ã	j;QkR/Š¹»'”"HpMp]âED,EK­§é£sšgöûnçmótÌãµkðÇí4,C5Y¦ Ï…Í£ñ˜ª|!ß\+ktøÀ?¡wÆš2wIÌ°þŒœvbÒXßØ‚Óçìxå3ÎZì\Â—Š]·az]!Ó©À‹k~dm~Ž‹#SPà¤tõGÎ6î„®£Xä0xíÜmª($Ë9üyª,Ãï²á™W!³ƒõ($]êïë +1\%çA0 OÛ-ÂÄˆ7„)õ¸O	h¾¥¢²i	¾2©Eb¢&ýµ8!U4ÝÎ²SÔE'è•ï 9 c,BË„éùÁ•ãŸ]¶*X\R=ß%ÇÎ("¯a‡JB²*8=ÆaÁ„Ÿ,eãSð!I[ÜV™¶ûq<Š¶ÖÖ0@ËZ½ hõüµV«E‚ˆŸ{tZÀóôJüyDM«n×#Ç§!è3'Bÿ`ß%òÞûø"Q@¿ÒS']'òü[ qVf¹ï2•È@äŠ¯
ž¿—A[¹¦ç‡6äõ8lpÚrùÊBØ˜n¬ö°0.-UÖMl&²Cò˜ˆS£Í³ŒéºLoä¯[.±‰Ôqfù‘BMŸ(+¨Rp\Ó0(rÒÁæŒßTÝ>Ø$RÁ­«¬:²ò²•u¼XÝÃ5‰äVþï’tf!±“1Ä%ƒôÅ	+¿éÆ;å]ÙÊíúÆBëþ2Ià˜/öeðÒ#Â$xÌÑÀ”_®­‘=„,!\…àõÎ1öÿñ®QÔÞ÷Æ‹ÔÆ¯3ã»Îð¨Ãé²èõOÝ~øG§ùË^óïÛÍ?ÒŒ·å•V¼Þ»á>èÍk°ÇÐi°ÑáQ¹É¶€à»™Ú©úP†¯`/¡™âZ¤çë+ïöŒO°¡¯s‡l•­#­ÉXª¦ª‰­¦a¬‰Y+T©[ ö9HèŠ¬UÆµm%Ðâ‰hý®„„¸`üé¨Ù$ ’"—K/af0¥8átG5õ­¥U‚cª')¿y:’7Û‘Q†•*.³eb(Qj1&”	wÊëó\-¢Ï‡’Q¿7[‚†ÿ+cöôú¹Xi8S WöO÷öCÿ°øšœ¾:º¸<g e'ÅÄÞ€æ•äpÚ6s›=%ÓõÍ˜_ÊåéM’Ðþßìëdˆ™GÇw›ãÑ‚ƒ`ôõ­”‰ôv¸–â cÀl”Ã‹e¶„^´¡®´µÍÊdTÇÊTMR©¤©F¹‹ìs¸'ûçA„ëx4¡J¥RAxè÷*»z]aWC»¼1¼$öIÍÚ9J,&K)×kÔõù©ìUÍ}i‰ERn™“YD$¯xÝUÎXKÈÆ?/þÎñ=&ªñDÓ\o>À $ê¢¾ï\ùn%tT>XxŸ¸#÷OúÌØ‘õ-réFXm$!ò6‰|eEzôÈ…[²ò;l‰ú–ËÚ¬Áua¨Ë…¬oë?µDƒU "0‚¹câ4ÊT­£DÌâg½E¾˜Cîà$…×á"Oì¢ZÄ=BÄ%Ý°ó h!šKÞ+‡¤ËæF¯õÜ¡R]Íô”ZP6@ñð|Toß{q^ÈÃ€’ÀQ/G¨AG:¤}iWÉ^ÞØÃŽ„ s¯ŒX°bÃ„–2µ˜¼‚Ÿ±ß
$1H.7"½± vá¯Tkn^£ÓE¸?Q.Z…x¯ó“ÈYPÝ»¾+Öˆ.„Ø1»Ü"à…÷ŒÉ¥£>‘eüXO	Huì³JŠO…GÚªD¥/cÅa€]V‹.B%UV-gCòmÖhÝøÑÍŠ®²°Öß©ŒÚ$"sc‹–Ì!\[ú&¸±˜B$)u¹Dxd9´ÑsEýË
Vd¥,•œ”„¼W‹}ž¤DvÏò5¼žËÔEß„RÒÚûùåµz>©2œJ5NŒqwï,Q¢X%ø‡„ÇCRŒkSˆ-ci°¿Ð#–ó0oÖ*êFµKŠáGMï:âRuóÖCÅ{ØMv]tØ“{'-fÍÖn˜|¢›×dtÀ,´u,ËšnyQ_ÐþÝF
½Ä£¸²QBo×W×4Õf·†‹›ð7(÷1ÚØž|òõÝÐe."¤%CõP[ø ¦µ`*`áD˜`5ì:a—øÎ ÿªaÇ8p¬×ð’qxZ†Ì>òá0Ô×{Õ®£î@´Ç}$busK%¬óèÈ°ƒØ¥£!ÕãMßSÛ;·`w´|wØ½Ímuj…N‹tŸ ˜3’VUÌê´‚ë6)AÉÓ¦Ö:Eg¶ÔvDñnp°iö2o¾G£H²‚Dˆ;„¿#†[¼Ýh–ßÒ®©N¿°¾ýñ`È]0iìùxÒ`š'q€ö/âÐëÄ 
¤µ[«ÎZª–_‚^5ö`a_: ×‚÷‹KnQ—µBæžUâÁöa:øµÂ¶ÐïSEì‡ }¨È`}¾¨±Æ} l,èK"ø¤A‡­h¬ÔƒM˜NÜ"Ç^„Wàt¼á;4’¦"u–³ãŒ¹€6*…è²rzˆ+ÆEo= ¢nËV±µÀº¼ðS"m€å9c»¨6Y£þ(ýv”O¯`¶æ‚ÚT/eUuyàT&ŸýÂî¯“pg6ŸXÖ»CF>,Kò’yg‘6Ø²í{»Û ä°O¹Êµ!Oõ%2(þŽ•Ø=» “â·h=!ˆ)#õDµ@Çóêy6k«“yðÒ1œñKH©K/Ýý{þ±üzymùl£ps»Rã,NÎöñ˜9Œ§^f>ôÇ!ÇóJ× 7f`5Órà`¡â™RãÌ(Ø6à/„ÓGžÖ«–íýˆßÃ§y|Ü<8¨s}ÎÑ-?œîÀ*ÙïDî*Pw×s†«¸>¯Af5}øŸñùÛkc%n¸TÇúx_´ìBÞ÷ÇW‹ÌûÔ’ÙZ)ù<!5¯’ÁË° _zKãN‡¥M0sZS3³^ifQ´~£Èá¢®‘lÑÇÃŠïk^/èr'PÏ•Iže¡0$L)¥Æ‡_túA çü{çTºÏ¸£Ì%¢ù@í“Øçåy’IœÂÓ;žÊ.»€Öïi vx•|óÍ^»½¾Q§ÜÚK_–2âÍu“	i¨ÏY^kœRVp|áüÙ"ÁÏ`Ô¯,M_Sh#Ö'jphoê7„-Ç†BQ °ùU'‘UÌ§4ð,>´Í=¨'þÞ	ÑœÃœYHÑø¥˜©”ºki·‚­„æög)ØKÜn îFÉ„ÞB±sVÆ“Uœ4q¿[´TÁI"À¡Ô]¿ç»a¼ï…?E09$…Kò”ót­ÅÎ4Œ›p¯õWšÉì+À·Ý€-ù²Õ¹6ä·¾Ì+˜¬ 2(Ú ù²=n\v[Ÿæ1†#¬Âÿt‚0t;1Ê®êƒÔ¬’L*j²0qzL±2R| Îý| 	 §[ñA“ëíüùl4^4…„´J<>ÕõèJ:tÝy÷™Ð]òt¾1&å@Ý¢/{j§Ö:²£º]Ò ¤û€"ï`ê-Ø²“ñ@âúÞU¶¢›*B×âø _Ò ‹®_’A{\Qý§™pºï<÷}5w’µ€¬èªÚÜE'­êp2•‰D"VÄB6ôëv/T–ˆCÕEžtNÈ".}}km)hfŒ‘1öÙÈ1~%@„Ý¢Ò€Ð3Í;•srH¤÷°PVpÊêh#¦ð‚bd‘®SrØ€„"ŒDr£€ÄaÑÁe_q¨"eÁVi³—¬/kýUD%ÓË‚&6—vÿv{-îW½)qºLr³hF\ýNêÌX#´Ÿkõ»©µ8É‰%6ÉÍ²9e¾~õê´‘²¶ã« XOzvþÌç>y¨=ÛGp²woŒg;›CÈ÷îMæ€/bŒ@.ënws+)èjÐ<–|AÖáÄh<w(ÈçyD«>vÉ›Å9mWªÐYd)ŸÎ÷³¤Y6+(Â¼ŽË¼xÈõ¸Ó<G¨{tñjüYá)_½Ñ^æuB’’6ëù6Ù»¥Ò7Ë%éÙ'mó]¶B6Ý›'Ùv•„5õÉPxXaóÄ&<Îcl²?eFG.U¨:	ÈÑ>¯ûÒî¥â™ºC_.}EHW™LÚ#Ûf6“/vÊ¶¼±v–ËDOÑiö27¤èaYÏ¨âüÍ>#Û*Ýü“˜×éùü>ò:§
Uhêv«|ÔU¡â³¾iz¸¸g6ÊL•£ª€…4å,üìYþH¹1§õ-¹$:ËMY±£j¬˜9K„¹f^¹qÓu?SÃÃò—©l7m5% »¼8˜d{ÐvEØvUà¶ºmMz3K¶&95DQ™=­'˜©¶½ëE(æº;¥ 8ÿè%,ÕÌ#M¹YTìÃk/¤ôÂn6ïÙÝÛ”±gŠ*iLÂ½|V}APCà»§	únÄM§ïv©þ—¥eUÁ7QÜž¥6¶µÍ¹{ºQÿ½
žä<¼¡Öë,„[2‹V«eÒ$·•ã`–|Õ¹ÓœÐ*r1UN<AÇèD28Æµ¯¢jzmDý¿ª^ÖZjêøÛÓ£²zòòèü¸˜ˆUØ°…ËœQ}ëÇÄ¿EJü›´Hv‰•;Š+¹_H¹­¥‡HØŽ&!Æ>çOUKGnÈ@}×§ÝÅ»Þ5…­Æ¬t¬ºØ	ë§Í)›$ÃoSiòXS<Ï÷Ú>œ¥lÊeè¦
"¬ÇWéÞgŠsè2?r ©l´›¦’,íJŒA‹Â:ˆEŽM™[C«¨bôäébû ¿¥^Ån£[-“Ì?	ƒüm¢r¯Fë²€Ôa˜»†ÞÐbåQVhd¥QÆ‘~]á&¥åE;ñ9®ðþ9…êbþ³Fí3åJÌŠb¿GÀ¹y˜ëøä5¨f×¨™|¹.=g™Šgê#|[a:!1´3–N‚8©«©jvêj]ªtè•FA /n©AÅ;‰³#§¬ñlãU@>‡í¦TªÈïŽWÈ¯¼:Y•B}½çbMÌõgÊâÏ¼¢!—5âl+þ6{Û·—S¡BUëçåK¼¹ðÛäE
­2¦Èñ;cšå‰à!ÎzYÄ3‡9re—.J3½Q†ÊVRTáÀƒ1)´”“%V£èbÉS¹Tâù½ó"œ˜M@ÅÅAÇåé&Z¹D–KÙÌ¬µW1cêŠ¡›dÃÿTçµg*]nÎÒ¶a±9‚”ºDhõ¾*\]!‰–©¿»ÂqÏS€zTãéíf±ÉiNØHj¦°Q°®èŠkC¼“[{ü~CS]ü0!Gk1_7šæºøñº;K(ÁšoÙ:©ó_ñCC¯#Åëã—||…Y5Å]ÒÖ2rP$…ü‘è¤[§Ž¸¶®Õ`ÑE–‰sY†Ò-DR•Â2è„fcmÝlüè=XŒ›úñÀ„¹¥µbå\Ñ‘ë»Ø”¹‹Ÿ¿þå?þ)!öÆl¾¤Ue`0ö£V»+Ý|5ŽkÙÕžkè¬’4ÌR—õàOÕ{ÚÅ§¼ûh­j™z¸ß87õUb\­&YG¥“‡½†>æ‰…Fò´%öw¶…IBþ¥ÞÀ"5¦Átí¬LñÝ¦~;røåæfª‘ J„¼ÇnR5`i÷®¸Þ÷Ý2 Å¼	¥a¤Ž/0u|11u˜ÀÁl°F78‚Aä¸ºú“è#¶Nè|…§Ó¤Aœn –v¦ºÁÿþëÿßÿü9!÷ÖSˆf®ä÷þÓTdâ5©™ÕzT4WÔ§Hë½ªL(Õ Cªú÷:Uƒï¼ºŒ.÷íû`Ø•õ'QÞ±›@Iàk=’ òà”±´3v üó)È¾ñÝùÌ5…<|šš‚LÁ&M!³Zš‚æŠú4i½CS	¥ )d¨ãQSPÿ>‘¦`ûuý‘-&ÀL„ÿŽ	†é)ŠBFX•/jº¥5A†Ù¦·Á˜â’¤gÚÀøÓÆ"ÆŸ²MCX5iBOÊ®òêD·º;€s9y#ûæòjx½èü]T+fØügÅ‹Xv™—âÓªLnsßïb¦ñ¦”iœ
;üåY{Fíä•’f~mäÕDdÙMþ£ ¡²¶ò	ýÛ¿¤ã6c¼wØÝ¹­¡k|½G×q_ÔúÑ×äÍÑ5=¨°¶ˆõ“ÓKÚë(vn„=gèý‚Åi/­Ò‹iýË+eÈœv¸41[šÆApžçš;¿üÔþéYû¾õF9Ÿ-²„ÌêFq”>»™ôS§í°ÖøTZb3t$}²˜–_c%«L"ƒSø„SÄ	i`ÃªøY•Ãð)wá¬nþ ý7Kêzh¡ÚqÊ0ÉûËK?p£C Ø´¨S–þ¤Á+½ <’¶MÚºNjRÛ³%®³Â!¼òTŠâLÓZZ%K´ºÐ’&Y‘¡ZÕMÒ´oþ­©“ñ@¼».fïÕVÍ×O?JÆ½kå~”Œég%bÇ—€X¼‹jò¢_¤³ý"y¤²•)î®r´íJ{«²qR»†í¼ló M3£íþ¨PÜå¼ŒAnb0}RdfÅ«Â™†¥èk_Ð²F¾C÷ý¹{mÙø–OV×dRÑ”Ò²-®JOÑÝú6åö­„YtR¦ÞJØIwñ»”w·†Ó]dYmKÉÎº›½îyóY&EÂëÞÿôYh/%ìû7º±QÃ9ê&kÊ×^ºXØs/ÞB: X(¹ptq*<Vjµy‚V½ŒÐôìûtæìÄõ—ïÑ2¸IÇÐ’ÁêIi£Ï7RSºœ.V¹)äº<y¼UsëTýJñQ`ÙºE©~ˆ2áò‘t)­¬Ê©2¡ÍyM"wñs‚”#¥0ZéƒSä(ž¼Þ;ux@Î~szyZLIv‡>Öºg`úß†¾"/Yz®!EÌÊö•²”_”g)Ë[‘Ú,PxGÜH‚ÑÜïô˜³cå×´vEî8‡~Â¿I„YH†Îì…´I+#´0Mkå–%Iò YâôFÚ2õ«g˜9IÎg~M+"3\Žªr¶`ÒÑ†À@)Öþ?i®k«Ô˜ÒTg¼KŠýH›%DTLýŠ–ìš!;U8ñY6Ñš•PL
îÖø­,6êÈŠ•¿2n'¥˜õ”ÞhUÉRþÌòHAÝö½â¶Gag§ Kî‹×9~œ»ŽÖDÇì:±éd„_/)nÎ–Ê ¯|Iy%¸úã¢º±\1³0Õ˜C7<€bow–†AS|•¿x­ÚV(ÞPÿVeùK5b^s Ùüita4¢Fqó+ì…ðOÄL “$œ| @>céOøƒñtÛ²…X±ÒÚ&•±pŽ®ÖÄ _IŠ%Nk=4Åâ ŒI¹`ô{Õ‚BÅµW¹ÖÔµ 
»š‘žö‡îÁáëÃËCr~tòJÑtGø28p±nî‡.	2‹* @¶…?–Ì§Ó£×³.æQ”vÓW³ÐèÊº—¡eŸ˜éËÚ+5Ìsw +¥¨bþp±&F…‚çÒÐ5Wœ@-ÜXsbêÃVW©È¾…±ÌDiY‰÷ÍulÁ¶¾‘öä²õÚÖ}3dbI`ÏaZÏ•+£ªO¢*×É'aìÚß,¸Oˆv†Oèeiw/¤i¾„ö`£!gˆ.NÒe’2Kå_]o)âBèäóa~é8luÀøŠ÷¢Èëiâ.ºñòr¸xÕŒs};tè7nwyE.¯®¦n1IÿtÈÁŠÍöø?”4þ´™E¸57-[6‹éù¬Æ=_	‡d#’’°EÜ,iÑE›GÃ¸4~†'î2íóÎñX³táÙoÝìNWßÌ°'•‚¡„\b"8®TòV!Á]z¼`°PÎ§šÜh•`­o']HÐC\Ÿ÷ºöÑ–DåÎAÏçÈwnœ°Ù¿µ¦b„â«Ñ¶ aÁŠGÐc\P¹îÛó€©¸¤™ãÍKÊO¬çíœ•ýe;cb/‚—NuØ™Ýtªãev.ºäË•_ÿÍýßü?   ÿÿ ›®`