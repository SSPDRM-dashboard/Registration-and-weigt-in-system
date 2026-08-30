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
                                            onClick={() => {
                                              setEnlargedPhotoUrl(p.photo);
                                              setEnlargedPhotoName(p.name);
                                            }}
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
                        triggerMsg('Field axœì}ÛRãÈ¶àû|E6»¦0ÝØØª«8PÕœæ¶êÞ{*z@¶„­]²ä#É€›Í'Lœ˜˜‰y=óxžçy¾f¾à|Â¬•™’RRf*eL]z£ˆîÂv*•Ê\÷«çü‘ãÇd2¶­Ø±[‹Ëd1ø´¸ôOÿ‰H¯ûúOŠ_úÅdhù¶çìÀ?çëxöNà!Ù$+ü´oo(]°7À/?9·É7Kds‹Ü)fOæ§³D.ü¹IN¼oïX¡MŸ5¬~ì^;;Áh¬\2ïÜ°›`šlÎÖÈ7®pW-×&››üÇ}›¼!w¤Õj]ñuo¤Ë'÷dƒ\iÈ¶äÝàÜrÓ5hn†œð04ßpPô±s8®Ð‰'¡OÊ'¿¶Ýk¢ü•OÎtóŽîlÕ½n¤ZƒÕóÍ˜Àß…Qg±Æ›w§ðrZ°ÖyhùÑ•¶"'Þ…ÏÅØ¹WÆžåú°9Éú4;,™Ë¹ºrúñ¶ç7@Y×ÎbÕýI*[!Àe«ïYƒ)Ë¶‹ÁØê»ñ´¹ÖV^÷÷•›´çÛÆ[¤ZSèà+ÍuYÇ×Nh¼®qè\Ãºv+kâÅÊãÑî-fQþe[ÑÐ±ÓƒÀ³WàýàsZ§?ßvì¦7ÀOc˜à¡;pàX×ÎÜŽæëx«`üÙÏô³n@Â(rÐo©Á@BY*æt¯H#›ñùsaúïž‚T©bOÞqvc9ÏH'2¦mºÖ?=‘#käl.Œãæ*</Œâø³M" NsÚì´ÖI/m'äÿ4cÜµ±…K`óÉŽ2Ü€ºº±³²N²ó!  Q6¡Õ#Œuo_õà”	ÎÝÀoZžGìIhÑõö‚ré[š—¢\Mx³+8øß&Qì^M›='¾qŸÀJGQ³ïà„ºÙó‰÷ó½º¥{5rýæM³]1'Ìú>tÇ¿8aìö-OœþÎaÿ!(6éÿlwhÛËhò	CV*«óÅÐ9?v:ãÛßÈÈÍ`Vö8<ÆNØ·"¦ÿ	1ñÆµñÓÄïƒHBFÖ-¼âG8 ˜ba‹K>L~ÿzŸV±Ÿ+°¡C
k¾»d‹~‰kÎÖ'¬^\)àú3¾¨k7rA*ÑŽ¢6‘À^aŽ}êYöâýå}Õ–çú…ýIgÚu<ä´EžáKWmß–º€Ä"”,@Ðƒ7@iÞ„Ö¸¸+çÌ“Ïõ„l$'W —5‡®mÃK eX¯|&<µ7‰ãÀ¯"÷t«bÃÕD&»l7Bá„2×¾¥:C[Üì
üÏíöJ¹+£ô‡ð~”Ò7`.à_“ñâ’Éd"­RC8<ð'«ÛHD½ÕvöÝ8pqÃ›”qGM?€fÈô
±·òÁÕÛNÈÿû_ÿ§úpVØv]Çh…aËsüA<$MÒ™Û™ÚÁÿ8Õÿ;·S­&nxÝ­|O¶½Ä^q„µƒ&üýJÕNÞ}\:P*ƒ8À?#á¿}oÒÃ­xˆ¤zŸJ˜#'¶PÄ¿ÿ%ì¶³ø[Ëõa,0F&¾d§V Ó×‹èZ6õÚò&N¢T[ø®äï'éó(P&ëANã9W1e3ŒnšÀ(µÎ¤r}ÉdCw9}ê2ÈÃ1“ÑéúˆËŸÖ`F¨u¤=Q2ž6ÛÀS2 §²ÇUÐŸDÁ$ÆÛX³¯ølˆ&˜»±+¢¯Iö<j>Xñ:£xÊrÏgaë€íëöãó$’èÎƒg
ÝÁ–tZw"P(W¨¨ƒŸ	MQ¢J…Ò3÷wÇyLPõŸo.ØúµâkŠ±Ô Š¯kr—É9–ðã6ZØúËY+M¶Î4Eô—…­ÃÝMâ€ô¼Ð·ìÆÁƒ¦èâÝ¿<hŽUœcµÖ½2\ ¡ãYh Í¤+ÆLÓç‘•S—ˆµ¹þxbFh‘—zÌðª@˜o¡,rp‚¿ä ô»üuJ¹QHùÓ½PNÉ¢DŸŽ°Ú–ÓoSIæO»kÛïV4eðª¦‘t»•ÒøAy+œíþ?±g]M<O‚m†‹å%vÜl“Ï76š7Nï“7é)4£+î©F=vÂß6t£~K(*¥±©ùÇèÅ*MDìRŠ^¦v¢Qày³”`‹ñ €Ð ƒëKmB_´™Ø¦øNT[¨Œ‡U Ÿ‰bd¦×Q†¥Jìy0xŸ¨}Ëõ@ëÌ„°*$­u@!»	}”È™Ý.gkäfàÅžUYÎ	ÉæNöMfùCBÿ¬$æmú¡ÛÎÌÙø¹@d0í†`^$ÔWÓOâÌô˜ºbæûKýž×·[î:EŠm»Ú^Y­ØWÀ¿ög…Gã^
fŠ™ä¸#,ˆ¶†ST•WOFþ9	‘;‘ŸàÛæ;×vþÉ2r€²¸v›’=¢(\xƒ |M¤6Í¢IxeõS¢	“L¾7_2y„Za
¹q7çt˜6_ 7°là5ÑˆÀ€þ§)‰ƒqóEIú(.óFdhÍ^Ž¥­·É¸‡¡|'r>r©Ð>3Ü‡yîÂ-nû®¡Ÿì~ãÌœ·™"IÞZöÀYRwS{%q~P«[âhìPU§ËÄ¼ŽN ÃWÛ[è&Ï	:TÉžOítòUÉár—ìlŸî’÷§Û'?íï“Ó½_ö÷~%;ÇGçÛûG{§[˜R´åçË½5«kè­]q2sócg¥ÓZû­"W^¶K¢6¼!«¸s!È  Í8höBr£æÇ?uºÝNgç7€JøÐÞî¬vÚ°ßY±Ó¼A äm	Ýe¡>À~0¦æíàCè©l¯å”¦¸;V/t°qýÈA?çïð,½ïIÿ``¨4iþîŽô @tŸöGÖÀÙ —“Ðk<S,ï~é’Üß«D.ÓÕô<x(Ê•#÷>8¾ÝM¼Ø{S…Çïµä[	--ïr£¡ôüs·¹3
ƒþ§ÉøÄ³¦zÉ³k#g9ÿ©ùòå«W‹ËÒ1(ßÁ¨Ã?mnï’íÃýÓŠÁ(ÏÁàŸ?ll“ƒ‡'NÉîéöûã£3ÅÔŽ·Lƒp2pVŒ­ž)n€}g;†{þyâ» ¬6:ëÍÎªñ8
àáðÛ{Š17²•<eøo ëëŸŠáv€/ÙmwÚÍöZ³ÓU£Vm(îeÌ”ÞŽ«x‚êÑ=ÇÃ »Å?µéµøOde…¼E`d?Ù,ðƒŒèlÊiÁ§œæILa'·mÁ_°!·(d1ÑÐ®BÿðôŸ[þÓåÿ®Â¿ËÉkübyi`bò‡:
†­bd¬œ:} ’¯“(Göï–1]$,T)Åéú0¤ÓÖ¡o‡£ººQðê8fM7öÇü¨ÓeƒºÝ U>hÉE:¹¤Çƒa??âAþ†J_v.²{äŽÚ G%oü½Ùyœ1HÊÁ:nV”yÄ 	V•¶;!ÔôÊõ€—$Ñ¦\_b¨8Jr…FRµYSTõ™n†w.°9rêÛ°ù£~òóóa HríZìø¾Oÿ »W©±‰n/úFÌ½šI²ß†‡&65ÐUêNH½¹b?`>îv'Ì;ªç\,À’^í»Ïý „¢	*1ø²>ïª£WJ0{m73P…Ð„‚ˆnƒ@ÛÌž›„	"RâòØ †Zô£_ÝxØX<;ß~÷®	0ø=n%ü–m.ý~zC.ŸÝ§Žœ}?nä}#ïTYfDti™tÚKä²z?¾½ÖìÖ]°Me¥ûû-Q¬3Žh’r-áªìDšð>µ–^&È¢çKpF‘4,©å›kYšDXÞa{MÅØ×‡íò'ON©HF¨á•éƒ´ÁÐ¾&C 	pæLŸWÎd°3é¾1ñùøµD_L·F8:é[¼ÊgÍ‚ª£K\xA‘˜QuvÒöjz©˜NJÙMg+ï*Ë^ì*ÛU:k [t^$®$!VbõQGñ%†ž„ö+Tq×÷+cX…Õ~ˆ`ÎÜrÑÏ±^Ž7Ý6­I„˜ò™Í¬æÆ+‚žõaÏx•±†ºiˆ,ôxÔÏC…ÎÅ?â	½¥’‚ÆpÕ@I\H15ËæƒGFÀd£q³+•A*dª;
©0\ýº›º¾ž [}=`E¸V˜µÑ"‚@9#}¨­`‡'Z„ Úñ×³Y$˜	àâý3)â}X«Þá	=æEÝÓõ)ùîyš3Ï˜L.JCòñ6‰?9å€N<f€£Èùsx|Jƒ$Là¼‰ÚfòE­*¯SUKÌI¢ZÎ—µÚ&ãçêÜ`,-S 6LêZY¢\²b M¡[0`
ùÆwIjX]ºmÑìÒi£Ýe¹ÎS«Ä-ã©´	âezÆ †[Ôsd:³95¨¡UR„„&<D¡„@-ðhäŽš]jÅìŠ±9Üé>Üðq¹:&€z$EÃ¦ÌÁ<‚¼&þ¢­
—HäJÊ·v¬Øá´pª¬Ã#ÇÆHAÕêÌÂe_ÕÑ´vSƒ×ÖÀ®¯ãŒÞS[åüNèÑ…ù»ÿ¸GÂ3Ë¶~¥~ûo}„¨ƒ?îq-lí¿ý†ÐÇzs_NËàiZ&Š ‹˜€ÿÇ`BHa“lšHz®Ÿ¹éÃà¦‰õH@€ÕfÁ›I:Ï¯yPf’*/
F_¬Læ¯(N„—á‰àâÒ4ÛùœJ*×%õ/¾éÂÖ›TÓ•5²²ë!bõ³»<”ß—ÄhVÚF&TÏêfJ
®`r‰`ÉYX˜‡ÈÔ)<ëÏ§;€åg¿¼7×ËxšÑe!2ò~cã³¡\j+ˆå/	Ú¼[íÖ¸ÅRàm.ÖÐžy¦é¡\óîÊò"Ã´Mó¤šzìU„ª2šB
(´ßÍfÜyþ¼`ÑVX1”ñÛhÒó0®÷Õz›¸Ôt—·ö±²A¶`ÉCñ¨7›üD|œ3ýmâ¦\4î×ÜŠYü£±Uò< ZeÑ2	{~NÉ	¬ÓÐâ_~µQL'Ká
G–'Èj³¼Ë#‡Å2áÕ-6H»õr_í¬òZÛ¸±åyS,ø ¹›¤‘‘ÀùDï;^‹æ¾p·CkÑÔCòŠeÆ>û¥†6q«bÁê¢“ŠY•óIf’­M‘ÒS`}9Ñ€¦7ŒllyVêÔÝæ­ìR¼©ª’ÕV%Š¨I`F³¶~q£	`Ï`y?¡AH¾)³UÆª%äÓ.LÅxÖ[Ç–òuš‘×óÆq4£¾å9ˆY€B¾!Rãá4¢åÇvN_¶)ÏHcµµúãú¹%ÝV§»¾°oøäd÷àòhìz´:HSÉd‹Ó"p3†è¡¿vxˆ8±zÁ5}è˜§ï ùìÓrä9JLbø)!NµÊ[RFRu†—ò±hÅ],^6<·zŒXÀŽ\]!	u¢Åb‚Iø
&ÔñÂGfR}ÉEyÎÊãåô9/˜ÿs€t’öÈp­\³µZ¹f/dd•Icºl1Zå?( G£Z™`w5ZKžF7x“(á„ñXkò*Bš¶m›ì€ÒŒÈeª€,ƒHÉ^që’í^“í“b¬ªZÉkÏê9^5½2M´{‡ð‰½^¡3KŸ©®SÀrq:yæ1×R4Ã'ÉH)×?râ3ñ¶†Qn?¥2CØ'Ü\pZ@œ@’&o]Ÿl÷&ò5J2#«*APvrÛ\Eù¶›hý·‘ »õ+£H S•þú…aæ4 v²BÎ±ì…l4…tŠpSÎ x›\|%‡¬ÈÌ×DÙ	¬þpa‹þ£/ŒR¸ñÜ±FäÐòA ¶ÄOµ¦9u®œÐqà ÙµnþeÿÄŸý“Z7Ñ]Ø¢ÿÔºñÐ±QŽYØâÔ¾Ùb·ZºÕ²¾R=frØVÈŽ7é}òŽOšñ¶YÉû¹å|º	|; P±2‚ýš	@*¯,þQ(â¡HÊ½"ïr|Wm¹œ€Š Æä-‹æíÒNN¡º66SLµÔDÍbß^ÒÞž6u ð²A*²‘Y>ò%3<»ÛÁ»å7¥VœÑ„Mø3‚tÍK÷—ªG¶4Õ¯,Ÿ9·¿0ÿDÐØ¿Æ’rZšÛœÃ³Ý>&«~eÉÄG+ÛÊi³nPyŠÒ<_[9'\ç¸Ù{™×ÌT£˜O§Ö®:t°cÆ6,À„à‘ÓãÞ?;NN\û}PºÐ¤"‡^9TFÖµs–iç [AïÖàpC>¶Z-A½\N!ø7•ÞEº•h§r¤ˆÙLµ£×`Á	+›ŒH®¤t”FX•›¤hí+nÖE›q0Ì É«Pü'­ÿÞm—Êj%”Wis--TÆèÞó·V©wòÂ73—•yö‚:jüËºj|šš‰Þ®aóãZ›f€*ö«³UùÿLê~6a¨9»¦_øx'à{R]šÖ'o$îEiÙR#g3Ê#í‚e0‘1W{èjÑZöDŠ@VÇªò¶ùe)oLU ¤lÚÁbaë( t§Æ—1Ý¹Œ:)ìô’±¶gb…¼Bój‘D»ZË¶¯âÏhI§–žñÙ08¼’qpdoˆá–9[á*ër¡¦aÁ ¶ló4•hn*XÌM-d"*©ÉZE„ŒÖ¤¥0ÝWÝ ªv‘Ë.cI‘]•œYÜa^©!¢*	Æº`—d'—t¹ÉjïŠ¬ÎOKsu	‹N€?à\X…Ìõy„wÿåJNU†¼'ü¶ÍÎ£™çÂà¥åalu4;"·UÕÔ|;¶t%ÍL49¤U…æôAgRÏÐ,^æ¯áÈ“8‹õ®™Äû§L-kŸBÝÙ¬Z, Í2Ü? ïY«ùÚ¢JJyAV©!÷0š¶%| Ùæ¢þ…õ?Ö3¢‰ø?i8ùz;/Z€J¢	M©.YƒˆÐ’N¼R$gÔE®`¯9,Zõ˜‰ :<VL ¥))Ï\¤µ40{$e´øMZ€³3˜xêÄË8ÝÈ‘Ü˜¡¬5“e¼ gyÜÉæÜ¢‡Œ-‹ž[ÕzÎàÎçŽ\¬—‡O\Ä¢NŒ_bÍpÂìYNÂÑ§ŒÊ[dØ–·œ.ûYxE—j»!ÜäM‘ÃK )ñ<#=‚ª\ß>®….ŒúË3dïšÈX¹Î½Bó<¼çxÁþ)Ì`àxX+èOð9Øè‹wx;Ý·—ôô|šÏ2ÎyiÐûËñªC Eµ‹K›Xbêäè=(…U}“k¼ó€Öž]ö´XNFRjc‘WÚƒ‰Çî­ã¢µAVÑKîA:~ó«°ŠžAÑ‰d=”„=dj6ßÆÆ¢Uý
„ÎÑJ¡h“\îÿóöÑûªú_<ËÑÝô#5:…5ö5V>þW«ùûvó¿´›¯.š¿­`û.—î[cpi¸€aè\á›°=0¼©¤¥ªÕF3´úˆª'ÍwÍ%Ô¤ÖX|g¹–ÉRÁW 8Sf°Ñ¹f¢åô¬xÙ;=~ß¹L×q(­KÅQ‰„*°S)§Oì´V®º§• ™‰?½çv—×¯(¦‘Þç¤æ‡U“šS«Ãs$†v¹T°c<,î"dž¥ê ‹,T¡:ˆ‚»«ÈRò¦'g -Œ+0ú|äqs=§?	UwùâÊ^úÛdFep…qcB…éd@½ Óµ`4¦µP>óOêpOð9¡½z-²øqª‹rH£¨:å(*öˆVÿÊLBÍ`Ÿ%Vú¬eà.Èö¤Bñk–"xÆAP®@6q‡[S•ÑB[Êºôµ.*--UÜë—kwÛB)ãR=Í°Ì0’5Ÿ’òÔ}"E¹Ã³¶ÈqþK	zÈ,ˆkóRé î;-jé5ˆ‡üpßâ0‚3€’+[¶.‰F‚1g-oêyI9Œ¼L¤{J`1mJØƒ¤”ˆ²ƒT½m“&ÝëÓHã.¿wbéQÛxŠPšš;Ðî†éÅ#¦|‰¸™B#àÿ¡>iŠ¹ªÕ:óWû“QOÇÇ¹×šó ¤2­O£‹öÅº¦·cÉÍº´Ÿfs4hyaÒeÂgÝ 4Ùþ0ø¸èæF¼­ŒªÅkÇ5H>´rÂØkþjnvI1ö<òÏ©¯“ªöµJöPÿð¥ðdmfO˜B/9¦¬·/`æ+lÞ'lùV°Ðå‰±$—]`›.:Á[øÄOóÍ å/Ý'þ’\
„FÐ}Ã'~B˜oaº”ÃtŸ8LrÉ¶é¢û†Oü„0ßÂP³úÄa’K0ÀVƒÃð‰Ÿæ[A˜UÊaVŸ8LrÉ¶ébõ18Ÿø	a¾„¡¨Bž³ï'”!J”V@÷è&™ú	m¾4Ú˜žïbÞÙ[êE#øáçÃ¥'Ô!XÆØo.´[íõºè…Q-42ÌòæaâìŸÉ¨ÃHëÏäUŒ*¼HÃF×xïª {ô¼ªŠ,H—?W‡s·EviÈÀ.†¤NfŠõ
O³:ÞEöºW‘ÍÅÞçU9þAù"Ù[#åÂ‰³¤dLš_Ä“_¨ÆJª<è4ËG‘]ýÞô÷Ç•zöOIc#k|‹Å
ëÉ·|*‰8¿­‚”#%ÒâÝ%R.ˆj2ÎYAÌÙeFÒÙ%!Ú”¦ºaU‰«™H6Ÿûa¤š]Š0ÒÆk¾DzÝýÔš]Ú¸ÂªT†ŠŸ¿,ÒÒ=áÛƒðÍD|óŸð­x}Óøvø†ìÝY9s°%úÎéÇªp.zDœ‹žp®x}Ó8w8wbâ“ó„nú±*t‹Ýâ't+^A·ê#k˜ÔHÐ¥Fyàµl’¹hÇÌBD¶Ç,yÈ&Ç,À{~¼úõ+ÄçNèÓ²»Žç Wž¨—öRR/û©—ýD½
×7-,œMàçk7
Â)yX¡ý„sÚK…sýHQ¥0»fG:˜ü	ë
×7u‰å{ßoLÀQ>aöRa]èöëB,ø„u¹ëIRÏ$õ_Ü0ÆŽY¹ØIý=LI­(Æ*ÐO„Ks©× ÞèbDwðñ˜ð'BV¸¾iñ!Ó”Ç¬Ôj/¥¦œläEÀ7ò5çÒ³ž²p}ÓH™ˆi‡ƒ'ŒÔ\*Œ¼f»xÁx<t,<è	×ãJúÆ?¨4ƒÏ·Ú"gb]žc¡.Ï‰5ÅJB´Ð£q,žTÖW©-ÚÀ¼Ç%fÇ×N» å¿«¤d3P±ÏLÁª©—)å’P­€ï”Ž8ÌD¥’‰J™¾%ª¤©ì[Ÿ¢|YŠ‡XJþ	}ÄK†>tŸæ<tÚ'Ô!AE=@]…å9–h—³VšI+c­­«:³¤“²@?VM+¢tÚƒ“jÕêÁi&|ç…Áà$¸óªzpšÙíÎ2¿º/Û•Ãói,V»â–Œu«Frœ­–ÆeÃfŒÄˆÒNÕ6¤qpª×ICxª@'õ–w–I]|]£§S¿DÇèù9 Ù~ÉÌfûWÒ¨*7Óv®¬‰_Xý~0Â2á(K_ØNl¹ ÂÂÂ,·¬qtÕ–«&ÐW$Î?Æª¡­û:Xô\l|œôˆóG _YT]—Û¬çCžû<¼²ñ˜’À°”…‹Ùý¼?b¡jÁá”îÕ.ß%{ÒU ž—ºˆµ|Ïª«‘µdM ½	SªéK'¬‘L&/Ð9W…t­•®ý=«éØTGŸç_F©vÑ2ÁgëC'g€¼Øñh¹Ú÷A€ÙÈÍô™-r>t#bÂìÂ` Ú¤.3üñ/'¢ºsc—ÉÄ÷œ(¢¬"d¥ûY¯7Lõccï+×sä]v*mã¼¾d®/¤6är—QÂ*'·BÇR"¢DîÖ’^ÚÄcqÎ)°Ä>/žkórÇÎŸ(\¾2qi}Çó‚p™œÁˆ¬µ»-øÖéê‰ÕéÆCrÜI—œ¶Ô"õìâ—Oäþz2>ò÷wþë°ÙmÏ+µV*¯éÜ¡QÙÏ,™ØøJ›º¦ï,»˜¦:	½šjj…¨Q…0sEAÀ©4´Æñ8ÚXYÁÉZ@±[ƒ h¼X‚nk¨ÏŽóU|Ò‰Õ]³	¾ ·‰Q¼“0¸v±üzcdP£l*©ãÆ¹þæ‚’<±KƒLTš¸°aåãäE°W‚Í€‚MÞÓû6*ðï(yd	ûpé‹‹°æ#ºu%ƒÓ†ðbUÎ¤2‹ëê·ù+DL­ƒéëöå2iáxÓÆ¿dþ™Î¹pD›>.Žæ¸šÿÌþsÏ¬É}d0ÝY§bX£ƒ‚ØÒ?€?ºƒ´N‡a‹ŒªÇÄ§oõ3ž“ó`bã,øv;ŠÜOÿ|j}S¸_ÞÑö«ê~ƒ½Ô#’4§I,sêyÃ`ƒp£0œ®Ç´ÿTó‡ocø·€²¿íq
]óéo#;FÞ¸;Q‹íj2”aK×¡qj0zÎÈ)…¡Ë#râãp°g»h áÇvºýv‘WÙ]0ßYÝ³]ˆsš<94©ï/<ÅÖ†ó(1¿ë¢•µo¶Š·–ÿÉxp0'xFãsv™ÆâQ`pÏÏÓ œÜÆâù©ÉvÁ(²ÃÑ;P`ÂF‹ç)¥Hpé¾£ºGaŒÎêîRaP–´ÊÙ»ò3|È „êEÞ¢ŠÑ @êE”ùó‰ÆÓïå/y){K9%ä”-ÉÉ¥TTJ¨Ô6ì;ùzÔ	séÚtUîxq“*ZÜe_b*4äë¾_R-ªÓ^€r1†ší'½&Lîx‘Ä@_iöÍ5Iït•]ÒñI'øÒÙ gŽö‡hRgç¿wëFâîÈVR^<žÚÄA ­Â–pœ<ëYmc¨@×ÿÊû¸«¬w•[âzH¢$*µírX î)mèa@çÝåLÈ´ãöÓ3O +”æ]uÎá5¯ù¢r’\Úq“ämVY˜¤¦²5§>–¦Z9ÌéP|­|×HoJp±ÑòÑéþŽÆ’Ç•KÀpàl"•öVRco-Ú:TS©”8ô iô8P²˜šWˆ(óUæä’¹2'M¢ðà;¬V¾C³KFÖmô‚.uv]y ùL›ÖýÉ	2+¿îz	’uXþ—‰Nw<˜È&)œp+‚'Ü”o,µâÐ©›³é®\øµƒ}–ìl±ï–>‚‡ÝyHÛŽo«…GŽ{VXˆë÷½‰íDlñ—9Ÿ¸Q61~’¶wfÍ—ªŸ¨½]³œÐ‰€	/ú÷¿g‹SÝ†±ŠŸ°!x²ë-Ïññ6¸mëz„óEÈÓeº›àØGÜZ[Ø:
 8aÉÈçRB|…ÐÛb¨ |Õ›ðE¥/3²ÆU@Ão‘‹Fì¢ï¨5}r¦›w&îõ#kÙÆù ‰ÌÌê¥T›L"5„z¼@$©˜1‰©"1C! ®;rýæM“Ê:G†|"e—ëÊ™$"¬,Ú1'~$Ó…­»Œ.Ü›$£HÁ ý%:ˆÆ„¯¼ÔÑäJA±°¤OL{cµi×UaÔ–ï´2Y~]qfû´• ƒéîÂø(ÓQWÉA=T‘Të1’u(ÎKÚ{˜brN™œªo.,y“« ª&jÀ¹W©Ìé¡‹7Ü¶ÊÉàÃdˆªvI4šr›VnÂŠ Ýäª¶u‰WÁî"¤í9ÜÄÅ5ÊÄcC•N!*ÿ’îÕïss4jëC5¦¨e¤ª	—RíªW¯ÜªFUÂ‹.6.Uå,ÓPÊ6ª Éû¥†ôÀfˆÉc*wwCfi©­dÿ˜)ÙFús%Ë×Ä‡ÕÑÃç¤‰+PabzC.ù®ânng8Ž›Šï/Ñz&Ùt¥Q­ð×Pùë¾‚¨ßÅ3Çsú1±RÏƒ•ÖÌCcloÈ<\œm-ê&Ü&LTê«0Ñ HÏhÔ¯ÅvÌÊ9;ZšM“Z+´(Y×`XM¿ÍèvÔŒÙ|ÙþŠüà
ŸEnp¥ß"7ºÊw‘lè¿ÈÝcâÃÈÝ`âÇ(Ý`àËÈÝSÃŸ‘»ÏÈ§‘»ÃÈ¯‘»ÃÄ·‘»ÁØ¿—YÀ}‰†P¸ü€‚BHå	•°P?T~‡Æ¬*©ˆNÐ±bsÄ•;h g“ÞÈ7ïR1îÌºvòbÜ½ÖOS«¹ÉL¤=·ÐÔšÑA]Y‰V½êàÔˆ²DgvÙ<T×
,•¢E!TÇBûtn¹’fá¹§*g''93­öè%ë×Á˜šTØ. @›ÌÞ(6œYz½Â×˜ï|WV –4Îwg™mçì­¤ô&iÀ÷³Lwº¿#©)Hðý,Ó½ß>Ü»8Ü>;ß;ÍÕú"÷‡K¤IJ…ÏfÙÏ½ŸŽöw¶.ŽOöN·ÏOee`çõÄ_öOÏ?ÀóN÷Þíîí•
¶Æ/§3>ëõ
CíŠp/Ñmë+µu&ïE”b×æ¦è›*ÊÔ0óªù“ËªGmã•nÿÙ0ûSÌi)š“ÐkÌÚÀ;duR6è
î(Ó(ñÈõäªefsïÐ,‘µ„vUFdþÑ¶¢¡“£¬br^ÕLtš	†OÇv'#êŸºi~ì¶‘Aj ê
dZ2NXjÖæÖX>×‘p©±@o*:ssêÓÜ”§šÁ’¯rßÑèƒØŠAnJÖ•;Î£ù¡10^îDÙ¡‚ÿŒ9uŠ"jz_Úæm{Äïl«ÇŠrüŽjxácæÈÂ=«?l„r…9Ú¬´ëÜ&	"‘ù’oá²¤/‘¼¥/õÃf6q‹Ž8±¦å{Ñ¶rù/Ô¶øW'Z”;ÄûòÃåÙ‹àR6x•vNážª—~¸ªI?œS4­¡éjV˜Ê¢_Ã¨•Y…ÎñÄ€ÜˆùšÌ©hŠq·3Ýêù€$î·V( ‹µU¶îÊè~_3ºV–£AñÏ Š¸W.lJ—(Lw*5q™Ó>Aœq<ò=¥po'6¸
°;	Õù¢`ÇìÁ§‡äNF[œ¾so»Ñ]šžh\š`ObLïþ„»(`ð~Ôn90¦Òšð'LZÑLVÃdŽeEäÈqàu*@ñ§`ôe!Q$€ež;7ðKh«XC –ïþ0&z¬ÂÒ	
‚ óx•„ÃCËõ	M}`RŒ<!&Ò¢•i1ˆÒÄ—ìáÍ.jy5%mÐ¿QÈ-Æ¼0¤ˆb+Œq\ÉË\¯5òƒZT1ÊhÎ2©^Y3@„9ˆ%Ÿ¬âÀVJÁLó&šX’Q³cyý	ÚÀ‰ëÃnº6$lì=¶¦Á$Ž–ó%4¨,ÍŠpàO¾”ÚÇ„û¯)>(°¡R²UEp Éh¬I#;þq‚èÛ¶ÍOEî&„ËÕÊI@2‘ôK_mçƒì×òÅr­)¼b#ÔI‘ã].ÑâFÑÏ4ø3o™I ^N;£ð­„jØÂ²¥ «¶žÔ8:•ë*sy%¸*²Q¬Ât”f”Á¿}83b][®gõ<jbpnÇAcÅ%'ƒPíbJœ"´AúíÊ
Ù»í•8¾Ã²çÈ$Bôºõ¢[9$RÝyèX6ê(›ä£b1xnËð/qá_ê¾Ä?Ð3‰ÿpÄÆ¿SgâÏ‡KðY5'÷ÒÑé˜ûÿhø9Ç¯ñt$’d=ô÷ìhµc…„zëèò¬i„ÿòç“ä3_Dú™v³ß»{–/<è>ýáÄš6Néû-œ‡Ö5–9È¾IÓŠß±Z›â}T¾Ïl§ªìâßä`ÀNb$Úm0~Ua*o{°Á„]ZèUÂH£)ÕÅÏB¨û}Œ`¨Ðð¬zH˜ùË(Ö·9tëÆäÂ2µ/À`®z ØˆiôÔ¬»!_¼J3°Ç=ùlÚ•mí¬½Ì‹o4¾Ï½äƒ3C°0Çwy×p8ßkÓáÑØscýMîAÍ© ¹Éð˜ÃÁAl<	é¸QS1TAyT1w2E‰Ô_ÎþÒÅÜ‹ZV`]ÄÁE4tœ¸ñ‘³ eZÚÚoŠð¹zù¹zAðéÂwnTi"Å¡ˆð¾ÍŸ}Ó[†Å9Ndi&3/èæº	A¤zçz½û’;ë.¶ŽÝ>ÚÙ»8ØÛ}¿wzñìÎêc×N0·Ðð%Mß¸h²Ž‹Å¥ûòêË:Û+
™àïÑ—àâ‘\8ˆ&ý¾EH}§ßé*?JCPò¢«à…ÆVß§MÑ÷Š¨R™q7¸ñ½À²ÍEÔ=º­RÒ½•h/*IµNv©T•†Â”UíN7—C#×çôõÕdê)L;LçN4’Ñ-S©‰j9ÅRQõ†æ÷¤f”ÌÖ®²•äædNÁ‘.dëH¨î@;èmÒdêÄ-²ç{ÑT˜Ù²1ó#*'c¸@x0¤ñ–	Å@`°¼eÌi´l¬á ‹ÒuØ›r‡3` ´Œ±<ETnå‘:v‹gšan5ŠmLÕ²G f‹&Zf?ð<k9iîB³‹‘p+q(7.rK-@‰zÒÅ"Ä¹TY C«”"eÑ(+õ˜×+ñp–YP)‚)Nà7üeÒÙ¦ÊûÊ™PH?ã¤Kó˜±P{uö	åYE4Þ+§N<—EŠ¦,”Õf=ª>'©ê7‡÷=¡f-Bõ¶ùœoË¢ž
~U¶qò½Ž{=—@t@å	ÿCWJ¯;s…rÎ*e2ÝÅi’	Ë„‰Â$tI"Æ.Ûr½é)œ7þ	’>q£3”ä—II '¢ADõ€áÀcà=Â Ô«V«Aé¢@*iBhØrí\ˆjÙ4˜ÏÎDR„*-<ÀVà‰þ>ÓjZxÊ(ï²4áMó%Jí4»	_1¶ùj½]t/H¤ÅBÌ’ÄqaœcF¯;jW –¯Š6.¿‘;TµK¯(ìo&¨Hü.Ë‹ñ®4ÕøÆ2³²‚Þßœ>Ð"Üà¢€—é_¶kä•¥WLÂ9ñžïap¨}‚»ô!ô|Ã´¡öÓÐt…lÍ§Òãç.m§²ôRÇé•.;¢t™Tò(>ÛàMŒÒƒIU`{a`UžõC¹é%â†ñ…ôáðéÃìm‹¾öR±#!•ó‡±^È4Wöm$&xœŒ©økº1ôUËùÅaíüböv†IÆô2›ÖÞT9é2¼Ò€ÛO•w™!øÞ¼Æ™ŒAM©"%CÜYèÅ¤,’aT4·€'×ÏüÏöQpI
	î'¿nPŽ	ƒoÐÛ•zþ$µÁ­ü&óUï´r£M¢”ÓIŠ(îú4K„¥î¨
th.Ò:~Þ¸+8îÉßÉ	~›ó&T§ùtTýLj ^§¾GU"Sr%UŒ¼ÌÍRQ¯˜]Yz“Mý>áINf2¯äÜ€zšF9	Š†¶3¡…MÉJ'c4ÂFjªÚ$¬|r!4c#yþ½Ù¬ËI”e×ïÜÐ‰â tÙse¬ïÔÇ"Hû¸OaÝrJu¶ÎáµôØ‘„¹B,-åÛ¬FPíšNÔzË_ÂpE ¬GW`)•)É¿5—ÅT„Gë]å-.Ã»õ¯„qF£÷È%ËÑI#ð°;ê÷h
~–S®@ù{v—`dÈÉüÇ»ï÷Þ“Ó½?Ø?ÝÛ¥å=ÚßÈY¼¿¬ì¤%,ßdýbQÓRÚKj2å:°Úƒ"©B§,vš¿”y¦)+’ÚÚÖ\o·S6I¿Xk§‰Dé€Õv•~Ùm?oƒ>/U–’ç¥²¢˜Ç´.<+½£Û6+Ùš¿ä\ó—‰Ô[È„^PDlæ·Q)þãßþõß‰ ¹&i‰ŠÇÚ§ç“µÒ§ÿo’ ˆù£«²³«r@‰³g0kZªž€’Š°’‚Y¦%¡@C£íÐy"ï;ÊLK–ê(´2}¶¥H5xQ•íæe½dYú^Õ•‚îl+Þw]¹G7B#Zbý·L_»†¢k¨>§GºÃTìòÀÃö;¶"<&9³³žËÿüïäxo¤‡3ãK™Zæ~†v€b@½ìºk³ÿv³uÆíì–˜	J™Eø°v2+‰$£¶ÓeãxÙCBUÚ»±WÖfyË{³#üûÿ­D·gzž(Ì©rž	/*Á
ö;àÝÙj4s›¸XfrÔ–V€—nè¼`jðæÂEÏ³| B3ñÔñ6ü c4ñº¬Ð	o¯ ˜åÚ:R»5òÿ\„‹‰ÓÄ1^ÃžŸ¸~Þ)Ð¥¥¿Ñýfè ¿¸Îv,4Âëó †iÇº%gtE¡ûˆU -0ÉèuS~3ÜÉŒq¥ôp4.QD­;'‚ŽSQJ6i‚È:Ú4Ã´?%R›0û†œªîdC©ËlÖÞ|É´f·/Ñ}ºJÚòWÅŸÊy56»¦AGÓèç)v¤½Éë²ü£®¬h4Ö—æ¶ïõBm–N[îêÒY(äÁjt7ÒjiEÑPV³8í}lXÚ¨Tª‘púPÓ<i*ú—˜Ë¥bqw#‹Iô§û6?0€Å(rÂD§v|›»q‡˜Ê'È¼	i	<ÏP	2h¢˜]æ½J³ƒ8ß¡•Îp<wbÎæüÖTÇ’iÛ“ÌgÚG£<ÿÏÎƒ­gr“àEMá­OÎ”Iº{xˆŠ+ª‹Ù÷ÇVÑvôw^`ÅÙÖÕ‰7¡«sÖŽlú%¤äüI¯õd—Øâ9òÊ ÖÂÃ,K2‘²	å—.ÇP~

Qâ…JÞa#Ù(Së?»ÊšR£ê2¯ÅKÜð4´•;³ryº´	ùuOÎ¯¿Qß;5xŽ¯lzš¦P…$B$_»-²IŒžßHy™Aˆ2éOŸ	0Y+£×0T¡Ì-[?šÛ¯Œãa¤ì­ª!xnc…¯ºJ^Å«tg€3Y…¦®i©?ñ25‹jËãæ/SAþ|ÅsM¾ühLu®,õ±j]vjÎLŸ•Î‘«<…©ÉƒÔž÷˜äkQÏ8r£af‘Éå"‚ÁdL*:ê§PÇô§
 )KS6u¢‘„	ŠÜ“:ùpJs²¦C\ÔÅD˜º—íÛ›Vp{¥Ä‹íÏ€½©¿ªØ;'ÉOh
ƒÍ|ÖB‡±¨ (|#$Îð¯yÏí‚ù)AËé7¦'Ê|f¬öl²Ÿó%(+Ö*¶ 5ö<¡©¥MqÓÇÐtÏ½i1Á$L¬ hæ€—ºËŽ‚ZþFŽuæ7-ø€¶»˜›Fx¹|Ñ"üitÑ¾Xoß/})W·Ð?ð3ßñ¤¾™BÓÔí½¶ŽçÇÇµ}°2]®õƒi’JírŽÜò)àÏƒ˜`9Ûžë¦,”|£?4³¬ÖL¼#)£5În›‰×>XÝIžOè¤}GÈ#­£/°I®ù$aëšÕô§Ÿ¹–
dë.#AXç9´âaà¿Ñ^æ/Ò$¥å¤ê4ÉbÆ,|bïQGç0–
†%–§nô‘Šr­ô² ´ªÒ‚¦@‰»)p™ÇP5Mq¢–­@'îÚ¹2Û¨‘¹àä¾¢¸kéáOü¹øG¼ŽgÓßžÐT~™£é‚¦æâ´éÀoXá•ŸD™œøHþUS0ayÉb¬Aº$L~ÛmK®?‚"ÀÉ[ù¦x¬Ar8;’'4¥×·&‚|Ãï–÷$`Ô§OŸ‘´ÈË×æ²A^Ù‘OòDzþB ÿØ‚Â—BÄks/14 ÇB·oŒÓÙj¸ÄëãÍƒp¦Æƒ!ƒñðœq®]ãÆœH]çÆž¶Í«s¨Müe-N7ÊÄgiÉt½Æu=ÌH€¢Š±XéZðÊJƒÇ¬>˜ÁãÌðìÐÁ†ÖI#o#|3EãGàIý¡svcæ¤dîh}Õü¬õÂTMÁì„?b”"f‘‘×›(^Ö4âÉ%œµ¹8[ƒ½ÎÇÍšõ}>ÖzÍ7LÆL„­ÉQÅ×nQ|ÅRêwxt÷3ÄŸ}Å(ð ®'"þcÂ°™\ø(ñ\dY°ž(8›$¨ïfT¼ò²à—¬ÌŠ äLo,ô-	¥š·ˆÅÂ¾p{¾€xUµ}?×/sI{ØšÔºô¬žã™åº–{é`pL¢2“ÿhâ«aŠë4¹½Üša;íØ›wß}¶\¿ïMl'i§g¾*ÆiÈÉ
ÛÈªvòõ?"NZ}<Q†Š¹Z²ÈÛ
§›D<Ã<ëÝ0é-Ùóäx
ÅOÐNÛZ|}°N—õé2H§[3g8ÔÕÖBcÈY‚¬ó‘þBr¯Úz÷¨ Yg¢Qm$‹çån«ÁnžÆ)ØPë/JŸób´6±ëÔ©”C*S0
	Ò¼êºÐ[€vL¢Yêàù9
±‹“ÈR÷è_QuÑBš3ÂÛÕH‘ïa¹ž§˜ÅB<Ç²±WfÃÝ&ÄŠ7ªZI²ÂœTðfë|©Xgdùh€(¶B26F˜6/aÕqpëÓ~L÷ä{Â,Æn:ƒìí.HN+i	að?¨Óx3*MFÑrÙ€ÛŸIS|X“ª¥KZkÊ„<™m×]I`ÆÄ&C8‘Öý¡”¥$¢89>çëª~»‚lóËb2Éqâê_KG‰»~à_¹áhÄÓx®•*-ó@÷gª­TÃä3Ž-nÌ»0ebj­$×È‰w¤[]/É]LqO:+°Þ¢!£l½v½÷úrYÝ|Ñê–ã?&åVn†  ¤T9^Q6¾~ö»™Ñæ¯Î|­53‚_Z„D³œAR]kXÖÂcmýQðÕº!Ðø ))˜¥$¢àÐ&œ8F(|8`_¼¢•»¬JQGV×p>¨frÚ§Î(0(1azÚLõUw.¥“«Hâ½â±0¶4•Í?a_ãòOòvÊùùKc
_ä€k~¼[ùžðFðdwûì§·ÇÛ§»äû•ìqwQ?Ä˜W*$rée×Š†½À
mš„ÎºÅ'¥•^ê•E]êk·^jlO<ù/*X:.õ'PU ¸ÅõÉ’·QG£úwÜ”"y™¤ÅVã¸œà!ÐÈ1¬.ÉŸîÂÚ¥í:-;¸ÝŽJ(e[…¼ó ªñ^¹WYÕmTjõšæ}‹½´ÕÒ¹Ž\ß’µ…—Ëó¯‡Ýe‚ª^Àe@¿A‘Nn5oðÎü¥é¶)*Jüêx ü8ËøÊ-r—ƒ^M;Æ×+Ã®äíÇ¥—FDbød&PeÙCw‚ÑøMÛ¸S;ÅyÖÓý§IM¥fëRÚP«¤ššs‰ÒÉïøN5ä¨­œÍrºýÂØ›ÊðîÞ¿¯0C®­ŸÁ,Ø©¯8~gxÿïÒX˜"iÞh8Ë©Vø1 ca¢0ûå èg•¸«çL*¸&TÆ©žñ-7[fL­®æ³$m½Êñ_çÊµ‡/Ì–7sšÒ%­ò*Ÿð³Ø¶°ð„\KC|‚åO2Ÿ žØù°€âou'ÞáæÏ"DŠVÑêYÄÎ«ù‰ÄŽ³ÂÒhßYõ´gÃà†Ï€5€NÂàÊ…©ãPQ\OªYÊu˜rÁ£JµfÙiW¬ŠÂc`Äœr†¤. ^‰¥¼KÑ!YÁ°hÁ$¾[¶¤’‹(½‚‰ÔÕßæŸ2M#)Kõª¨«Éý<Ç“Ø|Gè{ëdù¦JØ¯,Í%U™ŸQ÷m’çÈ×+…×œØ¹n.v&r´\ôœ¿xŒG·*“0ÊöëáªRV2ëHˆðÄ1ªYÙ\#&’—Ç¤*ÜpUú¦e¡Ð@nÒgÀA,gO¥è[Lá+ÚgþÑ2 ú`W¹ ‘ˆÜ¸ñî`¿¨@˜M&ø‰Ýoqn:f$qÚ}'‘.Uò¥ìË
„®Mðb†RÛÙÇ®xî€a˜ÒlYêÁ7ú(ö[n´Í^›e\Á~8K­‘5n4ð¥ÌÊòÜèŸÚZ#í‹µ"Ð!ÞW»++Õ†'@ÅßÔ¹‰ö>ÂÅr#9þ©²'ËfðAÎ‡§·îÛ²%_±Ðn…u‹žœÂ¬ñÉ™nÞñÇ*ûåº}6W…–ðÅ
ZžÇÐXNk8Zkúz
{¢1ä°†¼¯‡Xa;%˜Ú^œ¬ÿ&ÖS[oçèm®ƒH‚Í+kmUwMUGM•‘©d/qýæM³è«©{=\“Ñœ‚šEt'mÒÏ9;dŸÅ#×4Ï1Ê/îR^ë’)>î.ï§¼íŠŒSTôMÑ¾ÂjÈ Å9¡åÙ¹¯ÉwY“×ÄÑ]DYØM#÷ öMyúldW	\x€ém¢wé&À[²¿hàíkàh‚Ô:s«Ý¸5z÷%  w…±´ÉÐ)†‚QÞÂjËËŒÎßÆ—°M<ƒÎkÇŸ8•>­­_û£!B&™óÄ¨r½¸ù:ï‚!^Ux9Í¼µ«ö2^ÇÕæ9(m)þµrÐü…ÙNüÌê¯S‡>¨aþz×¶¨*§Ï4¹×ˆ[bZ Þú–wš…5 Ü‰÷^— D|åÏîpºŒ½Àë¼®‰ÛJìe~Â*"Ú«<c:¢”kÞŽ¼êé•®éB£òUja˜ÌÆÞÑ9ÂDýÕ !¹™ “\™ “F‘ugüÆÈÉ[¶žTõ
¯ênR
7ÙxÁäoÊ—Ø‡Š#3w`MzX/Òã’*ÆáÔ8U†ÀðçšÂˆ„„u-ñ`ãs, UäèŠ9-Á‹õíH€Ñ¼MGÆ*jÄã˜N ‹¸I¤á„ÆLÁ2ðœmBo¬½»‹ï@2dDºO÷9·É5ûŒT¿çÉøB¯ò0*žÅWH§ÌîLÃ*:íª^^ŸA/AÉPG5hÞcB)+dªBcLÈlM¡“×Äv•Wîâ4ÖÂ™¬ÏBc+AiÇw|½&¨* ÛÂN0hôƒ˜àk1³á¢ù®µ°L(ö-`ŸYNzyCHuýR9fm«š3»GðAÒ7©ï}”ÍZôú±©ËÝŠÕþ½ìÊWUNæ+Š˜Ô+ÊFLf+‘˜Ïr]˜¥ní$6ÍÀ:Ñ…j†×&å³­þ9Ûˆ›r‹´Aj£ÓŠg²[§Îžd{“›x,™Ø eK6ñ/Ùvå&¾žeâ
îSÝQ8Ê0ûkN:Æ]†+ädtHžx“¨Ð—…v^5è.Œ¯å/U<H¶§aMÊŸ$'*Ð«ëkð)ûh«š¯˜¸~ú×D#VRgƒŸá˜ºîŽ‚Ä¹“9„"„…þð¦ÄJ¬v-©§ôš¦.Ë¼ƒßµ[ÔéýêÆÃÆâùÞáÉÅâ’Ä†¥u^¾4w^ŠÁB%‚kAÿ²¸°NÀ¸Ó±øÌÉ|=Xgß‘‚¹ÌmÙCÓsÇåÂ–àL<Î
ŠÌî!÷&š T!Kj$BÎ”¦È×[&Ä
â œØ(OÀÄ‘$<`Ë¡£QraŒ¡jCR3Å¡ÙkP@>ÃÞ_ÿ…L¸E¨„HzŽÜà$É”°”ú¿&æÿÚ¢Ý(‘¾{-%Vj!Öüµ[Dæ®½µ–ÄCÐ&=bõŠ»r. œ-”I¼±-Åšeaˆ2·mÇª"(ÛGéÅùšÖ’oH7áYx¯ÛÕ	ÛmßÁ8«z7µ/Ójµø:u_\{ƒ\>1Øµï/ð†•gw©›žY¯6Hn~í¡ƒ­9·ã|]‚¾¢õþÙq"Þ©÷O½µÚÚl_5GW²þWÞ‘3Ž]FEzÊŒZEÚùÝ% SðIIJÁµ®ÈJ±Ý¼_¿ì`æ¼|”LÆ>‹b«ëÓÎ×¦e/äâ¬Òµ'auQ`x¡àJJ{KŽ‚…È©d¥ÄÚ,œyÓwZýmÊYØŒ.)›øˆ²UÊ”3!ëq…)Þ‡9z$aÀ„é+ ¨
nÒdYìÕÊ÷äÈºvÌ|r6é5Ï­^T
X”Í[?¤˜\(*$zÇÕX3E€O¡[ž(b±‚Dë
$Ïf‚ý0ð¼žêêîŠJi
`ÂT¬^c³•zoÁ5i]«F•*ÓA·hlÐx1ÃôXJ}£–ø/ù‰éîÊy/Å‚”Åžºåò‡s‹Äª¥Mo¡±)‡S‚‰)ä9Ùö  ÐÖ©‹ZÉxÊÜAD³0>PŽø@šø6H€;°¦A0vz¬ÜšTÞG“{èÜÀ9èã¥
fºÃÛQä|ÊÌŠÉ¥h[üà[ôÇ®èI,KvÄÓ)”ÇIc »…@V0[¨ ä5;©¨2žx‘¾<šþeÕJ•~•™¿jIQÝšF‡ìeT?£™¹94‡£lªÂvy¢i
Íô‹®˜yšg¿‰LW¦rÂ¡£Š²ÅÒwYzCÒ±Fòb
Âº7uê C¥ã1)h€å{IÞb¦³48Šs¾“òP…Y„²C””÷QÿýŠ„£½_¥[]–ÿ
Q•”£íÞdäKB•˜)+Ù&úM¸K+Øýêâ"å’¿TØM“Ÿwà€	§¾JiW²ó®<“f±ù¬dH—s"† s`ÑÀ8höBªC a´ÝAÐ|µÞíÁjF˜¸š9 _þ–§ùn¹²ƒT:Æ"ŽE‰«)©þœ“Ù‹rú°ùq5GMˆ¥›$"òÐµA‰1KÎÂU"¦©'ý dSæÄ<²í.Ã¨! z1êRãf›ÐâdðïMsUNø_ëŸã=oâ.,l)EÊG0Zš@ ›žsã¹ÂäÐ–=TûLÅ6Q0T”8È« ^25G“Î¥ä”¯ÏÃ`<œæ	çxé)SÊhðWyß¦X¯$c;rf#Ô$B# $Ø®t4êDtõ¾—M
»4ô=1$Ä´, ¬‚¡FŒæ)ôÝG1¦JIœ'O€N¸ µ>¸ˆx„ðLÌ+ ìšaa¦#õf«ÔãÂ7M,EÓìÒ¢öœ¢}+ç@ RzHƒò$*¡|®ï;aJÈ”@rW* {£ÜíŽº`Ü(ìoÊ&U&Sáeyqñ¦´,…î¾ro™!û'èýë÷qst3PV:áI ’ætsÁšÉWêà%)Ð‡IKU&®ðŠL‰jþ^ö¥@WªLÂdrŠ•UócóäªLwb5ä©Ÿ"Õƒ2U”Z…Š‹aý¾eŠëz¼®¶Û
^Iæèh›KÙ9š—’»0ñNº*|Ó_p $¸À‹-žeÅKK^;–¦¥òÁRHIs˜=«/ê²‚‚¥dl/J5}¸“„×•Löëc»ÕuF¿‰){J¸âo>O6§‡®?Ÿ’ò.b­Øb(œ8~¢t6ãä†€°ã˜Æ$ÁÎRÕrlaPŒ!ï¡ƒr\ÒÕéÇöV×u–Ò-Ò„5‘&°_”IJÙn/g9oÂiæ›>•M¶ÀrÆgÓ<á‘Ij]ýP+©gŠ×„ÈveÇÙ×>Ý	lçì—÷äÚÑT+ÊRµŠDîï0jmíd­kÇÛ\8Tëö ­øºüýÃÊ'1ÿ¼ƒQ™vÐŸ 
Ô8ñÓ†ÞN÷íFµ>©ðøbø‚ã©Ä ÿ÷ÈCLgN%BTðOŽÞ·Z­ª Ãxäû#L;‹ƒ Ï]&wdìÞ:Þ)z6È*¹_jÅCÇo €[BÏ$LÄCk °5ÌÉÏw§±héb5ñÞÈz¾X˜Ž“ ÏÅÉöÙÙEq~"Y¸h² …‹Å¥ûÖØ\V<uG†Ëf/Z1˜hhh*	¶hÎfnToY–è!älØáâ‘ºxLp¢úLyö‡s;=MÑ2ÈûP5Uñ„ªê>\„}@‘Á:‰†Ij¢”¹5LL“¯Q³›€æµHÒ{OÒ•P,mÍ‰y/©-7uT‘]æƒ6°ñì!’UçX–ßÎ@%ÍÜÈðv'ñT-¥j‚ $€ 0‚i+åÐ§ÌÁ>Y·PÂÕh`qwï”ei±DÃ•r*UÙšYLËÑ¨TÖe-ë¨êIØ©ŽwéêñÒ91¹‚õ÷×k\¦í9²E‡/è§­AP!)ÍåÅN÷wÈÑD<ò+cTßÝX4,‹Ð:üÂ´îãc¡$IJ>>ò‹KŠL~ñmxç@Ôhñ¢$ì‘·!IN»'?>àõs¾°‘È'‹º-²*´-¡j«¯šcrUª*jÚU¥DtXó3^ËØ#Çãj˜6=Ðu
§-iƒB„¾!‹ÛaˆšºMzSr,tÍ0©OpE’ŸT;§"íÖp±ÚyÐEê¹JŠÑ/Ê5ˆÒq]±`|)"CêâQZý"Ø¿¬¤ ýdÐWûàx÷ýþÑ{rº÷çû§{»ØöYrÍ”åæqH¹+­ƒÒŠ¼¿„\Ã†›ðO"×ª-˜tÅ |ÿìLÉOAìx4pCÕv'aö9Y Cª,¦ò%›†]fºKµ·•ÒDËh.ÜÜT•=šKñ$]ëQsëüÛ¿þ»YK£*ê©{¯š%5**iåpŠ»’#FX/ö~2îZ¥¦é’.ÑÕÓ˜jqm¸´de4xOøŠ×Çª¿‘DÒæIpŸ5ñâ:î[t]ŒùÈ¥üÔ‹Å¨ÁË¢¨¼‚7oL—p§Ðˆ–@=9Bÿ/üy©_Çÿ  ÿÿì}[s9–æûþ
Xã-QÝ"%Q¶Û¥µåÐÍ¶ºtkŠvM…ÇQJ‘i‘S“IYÖpÑ/»¯;û¶1?­Áþ„ÅH ‰ËI’’Ënet—E2@8÷ïˆkÃÅzOÏ«(ªÄTø–{Ù•ÿþ?÷»rJŽÖ x—+¬”4fÛ–FA¥mi¡q6ÀäŠù' _ÀMãqç¯]Y\1¡làÀ?õÒx¡{£@·Ó*¿Ì#JcÞ¹!Ì1Ú½¿ŠÌ¥0†£Ã; BÇ©j±%u©VÙ½`·*%<-±.ƒàeî¤UÕ,*É|B\@¥qý:F%åkæùwÅÄ(¯¢oý iié0eàÛ@½Ì%½ûWðÌ‹œ¢0^¸0Ì “y¼‚7`…_¼0óË…_ÏÑð7o|
¿Rpõ“d~2LdˆJøQ…|ƒÙˆzn$ýtƒ•œ©I2±@‹€vb{@’Yá>™‘F¤3Óý/€àtNúCÝ–ŒÇñ`M°£@$‚Å|JÞ$	`‹ ×ÞúVÃhÀˆF+yÊ‹•èî6ó\£oæhó‚Ò(ªýþŽí]ZáV(™ÔMÁ¬É"ê)e£p”^Ìd…œD)ð;r:JÆó/#ÛSLeú)© yÎö²1Ë}QýwÛiýnð0š%yše"gó MjáxHvú’\…òouÉbYe¿;ovB@I—êIt³LdMèe’ŒÅ?Pw˜ÿ(j/Yúþ¼É–‰(ð½LÌúÛËDÁH[&
ÔÙ2QËäm¬yqû[ÜÄþîQ-9N…Kú°Ïò×·¿¢õKo¡w–ŠÏ^V!tMiNî£óÂÜ®Y¸ž¹ƒ ò.ŒyŒ-l¾…iÍXj ùkª¦aÜI¢Kl»Ö}aS@Äm˜œC«ŽHîò­t£Ví*$Å‡5?¯§¤ˆ3ä¨i§ºJFyâQî¡ømõµ0&L­ÀUÊÒT|Äk»ã £À÷¶H)£’ýa¥Øq¡¸Ké„B¨RdÁ"º˜yö6 ¼ÀÏè3&?—š(ËÎDÐÁrë7øv¨LîLÂ`GÖ“UÉó×r¯ž”Ì¨Læw9°Þ­g–Í|a5v¨Vþº»ý¬Ó1AØÌN3™¨¸ž›n ?ÿÔÙ¸ ®=£8/5É£¦ŽìV'ø‘ÖÀ+I?1$|KEõ(óŸ¸KXm-lÿÏ™ËÂfëPŽrîÆ8yÝÿwkÍ¥`mÙªwh7OTlÕ¯µ’‚¡+©ŒìV'~%u–xg+YÈc_q%U|Û¯µ’4ÖXIed·ú8}+‰òô¸y6s¿Ù:Üûõpë´½×b	o@K?ŒúÙ˜Gí½·Gû;[¿Ÿìµ¶ÚÇ¼£vÜé‘ã„'óêêý~«ýŽv$b²Y?ù„Ó‡Øü‰Ï(G×m‡B%ùzÛÁž{¢ÞL"ëS…­ß¸!Ê'¦næOAŽ6„ûŽÔŽe#'lnÏgÑÀ…F^›tù6ìzö’2ªQ…¢GW%‹Ù©´ãÎÅ;[ é‡ã`ŽÌÖ~EÎvÁAÚìÍÕå_­?]%?–Ûð…<äðØ ‡® ‡.§ŒÛ}ƒœ‰îûƒ8ºˆÕnÍ° 5Dlƒn½ÌC9©J·’zî™j™}é+Sìñç8÷)Ï<¥JÏ ¢Ìæëz¯6Ñì…ï}’…õîkO4ŒãžfY¼ñýÎôÜgŽÏ›Ëå|ÔË çíú2 kyœÓ;?XþW<¤Œ¸v|=\ò;8P=/IØËÂ©m±ÖfÔD dØã6p~™Ž)Ôëú´•4óTµ‹âXÆú*Û`ê©ÇÙ€KñB<Õ²õT3ÓÀZZéÒ\ž_GÉ8Þ í^?#çÒÓÕ‡$6‹Yg^.G;åÓ]ÀÔQðYU¼U$²y5àÉˆ/Õy4 æž‘Kz°~†@Øþ'¤„ ‹¿uÙŸß0¼Wµ<h¯ŒäZ,‡ÓÄíY)«»çv©æ†þOÖoÝ¹d€)r‚’÷€s‹)“ù‚¬a¸ÀñyBOÿÖJA Ü?ÑÕ˜c'!Q NõSf²Q¦Ú‰M9gÔD'•(KL€ƒå@ÓK
'è„€ÅZ-0ÀÜÝÙJFz.=•‡çŽ+éáñº{.»a,bÈE ÷•¼Ív÷¶«_i ÿZáê%gãuôCOœÞžtŽ<7¿¿k‘Ýwí_ÈÖééþ›£Ã½£6iïnýrÇÚOá9È.“a¢:à‚c?d¥’2úì#O²Ì>x©õ#„€èw°Ú–T€‚ØQHè4¦$Ã`ˆì\äYGÆ „TÃÄFÇ‚ç, ¨Jþþ·÷PåÜ»«ñ3Â¬í$)D÷ýùª{c$OwP†rGþ=øÎ:Üä0l¼zL~Z	Ø(yƒ{EQ‡òQÇãæËgÜ‚ŸŒ?Ý§kó…—…MBe£Ãþ°?e¢p:ZSL?¤<PåÎ¾ìº§ùÎ°ªž{»‘±Æ}ÖPŽ'«ç:ñÃ[…ÏnQ˜–.à;*.)çZ¦W1fõÐDc“Aƒöè}¥`¹¾@¬Žòº.6«ÕÍùRgµ™É_–Ò#þzá1Èqüß¼œ¤ Ã£É“a…ô1{Ê2o}VÛÐJ2™®N‹‰«4ZF#´SË‘³x‹t–ki[)kXZkë|CÒþ
¨Bÿ×è±É¸ã]Žãck)èhÁ:l"­úº r%Å9
¾ ¸kŠ…~Z?±lMW§’Èl}CÁ$/vØìB¨åƒƒ0}	ªƒÄ‡BÏQIsâ|J‘×ÔñÇcÍ ÀrÚÞ:ÚÝþþm¿;Eì ¤k´÷Äœ¨Ç^+1×§`Á9¿!ý!yKobºi‘Z¡.Q¹ïÉòÉPâ¡¡¡¸r‘°¨Û™›£èË°cð*02È‚Aâx¤«ZßéAN©µöw–yµ¡4¾xú?¸;/1×ÓÁ´$)azìŽ2†½_JÊ‰øœ;ÏÕK…OUè ¿,›M³àÁz àÁ“ù<°–?ñU5È¯ÀšT¬r ŸQ/ñ5§º¯†Q¨Ö|8XÐw†ü§ýï4ŽRª¢`Yhþ5Q	à¥‰³L´‹FNñŠp¸ÚTOTÃ"ÌEbìØ;:¨ëúŸ¼ -b6\)òÈ’€öÄ~Aè7¹`/úÃÑÕØC ã›‘8#}”Ë á„ŠÓ—¯¡<f~l¥|™0 +8´WçFÃ×”€MÙæç¯þ—«8½ñmzô “žž$±,d6P‹<±Áºðž'VxBàÂžäÈÔ$£”çÊ ^©°s•m¨’«1KOdµÇœ#r£ð{Uzœìq¾fQ4•:ñUÒàš|X¤ÜnqÊ
®{8ûÈÔ°(eK!]Ã<¸‚F[óóKÝ,APÒ/îÂØø °ü…Ï*e€†ËgÙA%Õ|éaÙÒ¾JYüJKoÀ”/x‹ Àb)šŽÖ©V3«¼Gü=¸Êgñ+`þHó·gTQE[”nÅADJ¢®ûíÒ Œ(QÉ~†RöNÎÇSó´‰r@8†WBç\”ÐylÀb êl9ß[Œè],£ìFvŠäk‰änŠ…&Ü|¹íFéÉ·7f±qÉ¡øl ¼fógðÞ„?§yò†>þŸ¡ue…œr0£ÏÈ{åv‹KË+ª-ÞJÚØÌïðó]è|œ·ÚNkÉ‡¹,ÁÌJkøQpËwîB^³C1Ó[ÐÃhN;ŒfxMÌ0Æq§GÉ=¸ö;Â¯ÍJÝ[Gb¹ÔÚ[¨Jc(A‹R‹Ý.íÑÖá¼ïwã„NÓ/ñw®³ñ¥Ð–àf)lÞ´ß~FØ^¥Ftß±ú:P€í@°ÐzÏÆæ'òo…)F¼ß…JŠŸÆãÚ¹½^A=r…ÐÕÏMù¹XzþYN;|ü˜Ÿ7Û	í(újÑçCc!où±U¬[ql=2ßèEY¯KþiåÍÀíÀÚþ?K%ƒèÜ]ÆÂ‰e6á?Å7ð{k‘%)o‡ÌÔ Isƒ¶½>F®/’[_åwm(ú¡âÏkrrÕŒq°‡:&¢	8ý˜šÆ˜šú˜š÷4&çÑ¡Ž®½•® ccpñeœFƒn>¾ü£>DõÛJ£œêXßK“[Ìêè*äLŠOú@•/ƒãôóm”3Kq 	aàÖ°OUÇb¸ì*UÛ…úf7f›†›3<¡ëx³·Ñç5Ô×ëÁÔLÔP x¿µ4DW%Q/¹n²jÄ"“Y¡2B+d‰dïŒó]ùJc1SÕ±¥´Û'€—SB¼1b‹2&OG‘$Ã“©ÈË¨|?6F‡¯dMúJô°ŸbØ+?®¨©i-5;L«Ét9æ 4H×©UT¼p˜RØË¢½¢s$={²5¦ÊÐ÷EdÇÓÕ
Ë¨‹Y>Õªo?& 	äpvsòR…aØ0ÔÊ±Oë<(UpPÞˆaÍ”ð/†QÈnÜ„&ø¨ä’Œ?
¦HnQÑ pqÁ°Ÿ±’LW.…kÂô{—w?ù¡öÂ¶‡°d¿$%ënƒ
ð—5Žçº¸(úÅ0HYégœ$×qºCÏ«ÚR£?ì®º1••Ë}ª7.Q…ÝW^!â>ú‚ÒÓöƒ9R¼òN1d\@õÈS“IIŒœqG¥aˆµÂYÁÝ3Âç‡Í±ÅÅ7úvÕkhGŠØ‡!xáá¦ÄäWæ×†¾ù*.(úó‘­ñ”ï«’Rzå¡z²ª…é=•>_‘$˜VåIÓÞf/ëèÆü¶íâBhá¢Q *žEPâ®hÛ	&g¥ •BL¬ŽR„çˆúxÂ˜U…(7¸&‚ßaOŠ*‚•¸q&ïFžJ¡)X>R¢H‹ã°êØa~(ËaÙ^APBæç(Çô­ÔºJ	z”.„8òJ±éá‘UB#‹k¢
xú#¯¼ì©p´—®·<×ôº¿Öò´zRyÒÅ›ë`A÷òúùJ¢E8­KûÜ1à1{îWü­“æ¡Ô£«O.Ëƒ©þvSM(BõÓ;©x–…1@J]à’tx‚èÂfÉW}*¼|¥Ç)‚ù5©¤“°ömž”ù1*iÄ²=<ÃáFÅrÃÿT}ò«›
DÖ=J‚”b‚õzµpp6’*k‹¤|˜yXÝ½¥}†õù•?=£rÇJV$Õë¶/äèŠ±«U&ÏÑØU¸l}•x+¦íVà}	ÉU× ¹°¹Õí2Í.ˆìd€£HÒq¥<‡©j¡÷©²"OäØ¬É'Jµ¨‘jÍ¯—s€íl'X»(@®æŠÔè§©±ƒðd|Áù´PÊds×GÐ¼Ï ä€Ô9€†¹ÏÃÛiã~EJÂ
ywÄóŠ÷v‰€’;%ov¡2ÜÉññólåÃq{ä•”E|‘BÊ¡B,èÁ?¤%±Ó»égFJ(w;ç‘•(îæ/Ák#v›ª hü#—Ùu)·ïÑMë€á.ôW»ýVµ;º›ý¤Akí_—Ä\,­ù}>+é_½uÌ?-žs‡ØëÎ³uY5¾]cÔØ€5ßõé*ÞË;Ÿd/›§øGÒ£ÿ×ýÄJ¶ÚS_¶Òc,¹–Ì&Ãø´A·Í¦ÉÆÀ¦(áœxaO.çÅ±QäÂ±¦OjËóKòãIÊ´y×I’ ‘´Æ\œ][üæª™è£©©Ø<¿ÌiYA®‰qKWåç¨?ˆÎ1ŠcáF1®v+‚ÓšÅ12¹ŒÖt6&y³Èë¨à‚Áü6ÄkÒÒæ#¸ `¦›«VÀºW+Ã¯nò„U£p„®ÿ@Z¬ÝÔ¾>§ì$Êß"¸P™n‹4¾ègl.¤Œd$<vóhuŽÅÅÄœ:@æá¡‡Y•ep”Hj“½1³mû†RÉ¸™¯O#€±r¸·!Uñ²«|\×ÃïŸ Ù`‰úxâÒ±Ÿ;ÜwD,?‹.{õ§÷éWp£Á…Â‹º}:ð<}½êü¢uGîµ´dÛ+ß=[Õ¾*Ã;07°îÑêÍãšÓÙaªº,Ñém39AKåW¥iƒù«”}–{­¤H2›ëJµ›Ü™ËSƒŠÞ‡´öh°VöÑTôÂTó¿T´Û¡šÓ•)œ®N#ÿtm«/ÌÌdF)§ C³jSE“»ýïû©´¡Ñ°æ–Šã©°TUnõx,‹ÄÔ^‘
Ló©5ÜBFUÌ—4“‚ÖåÆÊÈá²&¢û™º:¨}d. Àªy¯å>íãwÕ§ÄRD¹=´¾Tßy»Õz³ÇÕ+²»uúvûx«µ«ÙF'ƒÔàVÇ´ßÙ²Þ9`?”Ê„•¸1C|ú•©.ER8ÊFù6Ž€–·£!äÈ˜ÖZ‹íÌ~š›Ó üTI>N0v¶ufg{–ÛÙ¾ðIæà$® *€xvÑ£ç2¹®?‡<%lÃ°(œ®R>žê]?Ó÷ËD½•Z#Ñí}T¹@Ùûè}%îò¬˜Ž«¯ÙD.—rÔ-§|€ulMƒÌ˜CÎ‡<Å*÷Ø*}ë,ê.éêNóFFU…Ã©^ôšnxO/˜¡‰O¢…M‡m†ÈcáÅJ¯éÎ­k-%8?Z€9Œ†Ñ+Bàê”U‹gE†â^¡ÂxAOMf-ËV@Ë–É%¹4Î$Ëì\ÊâXd·v¯Æý˜~ 8ôJõ Úô;€mNØ‰gc»UÍaI›¢q»@;çéûIJ~ Ç:¤Y%ä„Îªþ°Ã%ãŒÐ#JàŒÈ!÷z<´›d±{¬Ð„G:ˆ“Å¨æ,Øú¢&£Þ·îpÒãr¼ÈØ:hG ßt’ËÑ~—y©ö­àÛnÁíAÃøš¶ù’è8!W_n=ÜáC2¬E¯|¨îVÀéh´)&ú7,åãÍÁñöÖ“IøPá[ýÆ%öƒú.Œ/33H‚ïÀdu¤ñKïÀ'ˆŽ)Û¿ˆÓÃì¢v¶ÕéÄ”îwãaJ—æp°©„5æq<Ì\™ç-©Ûh¤ VmHéýU~eøÒÚ˜n—gËd1NÓ$õ§ÿs³œÇ'ïü%‹Ç¼³Ÿz:ˆ!Ý”n§©«)] c&¸Q¦4Ž‰‰¤â ™9£´Þ´c#¹‘Lô•gò|í3Ô$ö)d<-ñ‘•¶Ëˆßâû—*ÕÒ›:vƒ*¿{i‰Ùp;þP Éˆ!¾0ch‡EÿäG‚%(—åDR¥¸Ã¨ˆ*Ä¼%§^ãÏàç“‡uØ~ñ€5Iô¥(»vˆ?4ƒ…(ˆ	³ ;®'8˜sŠ|Š!ÄP0ß×I
t]ëøw7t+[ò2™¬Øž)¸wœzdœÒ×ï¥	é’Çù¸tJ‰¹Ñ:ƒäªKºÑ8‚üÛGp$¿¹÷¿}9ûT'##½G&ªßç®V@cž:€Eq‹€ÕpÁ
VBR‘ö#nú}µVê¬,Ø ö:#?¾5„Ñ$œÑT»Šæl‚±Ó9Xy‹?²s­Ëð–=ø¯G`þr‡"ƒ˜¸<ü(‡¨rË¯0Õ´{q´M{yte³@ÙtÑÇ(›U©Ã± 5ù2,M±€0Mï’MJ¾9;‡ðcâ¹WVa÷qZÃ¬ü…®ˆ\^f`±Ø\Œ@“¯°°nI€EêxÅvOÈ_éCÕÂô¿jéFs×n²~i|kêb¢&ÃvT6®IšbR°• J¶¾qý ë?±G?]%†ã»©;¾Ÿ0q_D±£@Ä:¦*½3Ø!ƒÂCÇU3E8oa“Uq£k.#r¶ï]zëHÎžì±ÉÆéï;I<¦¨ocr÷a7óÚÅt’WÈQþgm¿µrÔòFƒãçXU”©v©Öðß‹û >´xÔZü¨¤Üë2~êºSó›Q%@¬¯Køþ~f ¦‹ÝN#ÚyLj§­•ö¼ÖZiM»Ð+MRç­K-–Zš<´ês::_é´k]ŽÞgÑP¡ºtrA™CÜ8¯ç³ÈÖ¯¡Á&0É`k›œîìí´[Ag¹¬¸^&
´úìˆ	v	¦äå~§}£˜ìÌ&’xËLu\A,kîBÆÌßU8\lFâ2
³!~Z#ÃRöBÜTz)+U@˜‚òQI,ü#àç±7²!)ÙØ\ Ìå†Ê\’<àµR‘Ê—RÚJ¾ý™‚dßNµ¨:E‰	¨Lß1©ïó=ÐQ¥t	AF²ìlÊ¼N7äŽ”Œ7—Ì‘À˜Oîâ¯qú]Ð˜ñJß™1Ã~lsÓy('ÆïB¬ºœJdl~”ýþˆ-þÂrS¿"¯ò=×IÊß¹m±‡èÉµÇæA+*Šcú·néomƒ´ 9–2Þãw­6iŸ¶÷Ê²àÄ+²0c‘ÝI³²BÞÆƒP"Ò/H”§:)Þ‹r4À‰Ô/‘<wÚ\Äc™"õ:IOÉ˜¼$µŒþKüýî«æíðå¤6áÞFàÞ‘k©òÛ`úkžS!u›—Óêü.™¬2o¶EŒôQ1˜ò]·%GÑm)ÍÕÌƒ¦âd2ÕDhqÂšƒ7]ûžÞÇªÃ4ÆéLŒq¡€†â(ù;|´±íh;±+¦ÒÞW¨ŠÕS-$¯ÈJv§ûR‰mY5®Úê¾W[b««x 5î-ƒJ9­/NÐ‚MPE¹òC_³|ÀXµ¦‹?„Ú—ì‰ŒOc¸Å"MñÏ–‰^CD˜1¥MÔWÀPz‹#¨:VR@`ck85}¡us‰œÐ³¯¹ÅlÐ¾lL|¦…°§ýÉŠÊBÇÖ+›?I?TR[TM/«69‹¾PÖºFäd-”•Ç“Ðmš\ÂÃû0Ö`­Rqµ½*¥Õ ÁŸâ›Ýäzˆˆ^ãðð¸ñ[|ÃyÆ,Ý¢?Œ_tàÝAL©…•ù2^èdyÕE–|n_!Ò3
':¢‘Ì·Í:Ñ(F½îtÝNûšþUvF‰ñËÌäˆóû.”ã5[DY¹ðÞu}ý™ºÁ6´S”îyÿÖûèkhÔs—
bŠ©!˜Ú§#‚iH®iè¡äÖ ¹ð
=p/¡’V|SÿqÕ]oúŠ¬ôµ}¬ w'D0Ý0Íâã—Ñ«ŽË5-Ð;×æ¶Dÿ?ÿ{¦%šwÑöÊÙÉSPˆ~T®›lÙ:ÞÝ7u\W6*,uÜ79£/7“$@9\MîÃÅ9¸Úä,8HúÝ$æAÆJÄâŠsîvKD`ñ€ãP¯HVSPÓ¬ƒ+¹îÓeál“Õ-ž¥Vw·o¸ÍÂ¡òa®D²qÜG…n—® ©J±Ýp\kxn8MH´U©!ÆIó	ˆ„Y~êXFÊ5qéá
¿À›¦„\/È<Q6<¢hc^˜Ï,Û¹l)¡YþjÍY‹K.—<~ôÆ'Ë®S°`ç3¾AX¸ùÔO3Ÿ²Ë_nÉ±ÄZüÐh4òf>6à§Z-Z&çñF˜[eF/aW:@+2¢vÈ+Ò¤,}ÍO'|çÞ1œ£Çp>Õ„©‘¢Î'ÄK¹˜‘W£nÄW	üÎ9y}ø¯é¥ØwµA<&}zëê¡ÿ¼P–<·—’þÿÚêÊ6âÅ–úÐ'ÿYü)šóHÝX¢¶Ç>Fã^ãÓ IÒZŸ¬è-.Ñ.Ø]Uz“F;	æ”ê‹9ùÐÿè/–Hˆa´Þ(f%ôdnºÞïï—ãýïÉ3k²HÆ¨·“×}ÈuKÒ¸&^?p´ê”Õ]e=Ô“¾WÍÆ¥ñg8<àßtÙè•åÿ]±r+ŸÊ¼þ­Z&Ï%¾…-¾&Ü?¸!Q'M²Œ è”½ú85²`JW½ª(‡¡e®ûå=’Š#©¦º	&õÜaR³/û¿ýÒ•;\Ó™-Ç¼9Òo
à˜X~Öœ=úó‰i­9ÌêòAxèü|92ÖÀãÓA€F`ppîŸ7ÇtTŠÓSÀµ°i,i­ð.¡éK=Ìš~çÁ[p–lÀÀOOñ­<ø<j‡cùÜþÀdŽÛÂ–ì\ƒKÍœN{ý˜ÎÖlSvu4MˆJšŠ€°©xwA+÷F)>$×9B° ½ˆ˜êXáÊ¶jc,°hÛÌÁáÂGþ“œÀ¨XÁ^Á+ðÉâ×h{’(½ë2ëhbŽ-Áë<¸ðù“f0î°9å¯‡AC³Zÿ6Émc×ƒËjnÅ—T dÆ=PF3ÄØìÓ˜³ Ç&œÆ­Â¯Ü˜»SÕÀ4ÙŒñEÃˆr~£?\“j þ1´òîÚ~üéù[æIŒ©TÉŽŒ5üÁÅÀ®©
–\7 Ç¨Ÿ^Ö_÷‡ý¬GU9:LÐ/’”lp‰…¥;GÄ€¨H%@/‚”e¾Z\
aFä—Næ«ÿ1m®PhÌ\"€å¤Žãæ÷jä04¤Ëeó:ÄeÅF /êum@ær¡y…öjXIŸïxýj<\ª-™“´}ã”˜="[*ÉqÂâ¸>:Ý1ó²_góTÅ¯rw%)CpWØæÔùùüjz¾ºÓ‹;¿íôÓŽ‰ÓWÕw"ÎXÃ¨ø9ˆ©ä4OŠH4xp–Ýo¯ûãvò3;k>¼|GMÈÁÎï~mó°Ð @ºò}XT¾.ÜËŠj#7
4[1*+˜¯I¿Ô!ü„t¹Š“¢¥ÝPø’ÑÏ”b9ss“¿—ôx¢Ý Y˜Šò…LªÌ?Ì0ñ•3ùŒÞY|_C["¬›9pØÆ¸>³Ãf—MÊ"69ãøÌ¸ôxr3ažßIYÍ"€/mÃ¹ÙË
¥¡SD™1¸µš€Á¬Ò¢ƒ¥áJa›WÈ‡ÃMábz8¾á5ÎükÈ¦MG¦-@Üôç«îÜ‚ê¿9UÿÍpÿÍPÿã˜gˆ1o+n67­m í­Pç)óìB®¬é¶uú¾ß:C UáÎb6>kY5i?àE#çZeM·†Vî`ùµ€øaSÞ¼58­yøPy­rµ´ékx•LR”ï ×1à¬/D]_tÕªpGôà¶pt€)ƒ…®®6¯Â!Õ@‘A ÷šd›«V¬ÿ0Ü…zMäy }]!l1¸Å5»¨TviÔ‚k*cC~ÙŒgB9à(ËªéáqAi¯˜îð¸<9ÛÍùy*ì×}ØÉº¬Y7S0€WÐIÆÐa©	iŒuÞ¤ˆ]¢·Á¾`ƒkœ¡mùerdU¢8ÔK5QPÙ!ù$YÆ@a„Hú3mû.s	aP/e~ñ±ê…-+6ŸT^¨«ŸÉpòAcð¯ŸÁÖ¯˜¬€ž†°¹&¿Ôi¶Q6l¾‘K†cKêÖFæê†Csäð«+³8v­ÆõJÆ'Ò¸³Z2 4Ky•ChCÀ‹¥•V}qÌZÖHXvÙÊKU^!y`Î³äXØÆT-<@k\1>U)“ƒñEÀ…pàÌâkbƒ™†5{|NLQ®¼OFšÑ*÷ãùœQrÁZm=‰h©ÀCh5ðò'Ö§Ì*.«C‹‘þ<)¸F™^¤ŠT42?šÃWdõ;I…í‡ÄŸãá˜,G‰³Î»l»Œdºžgó>³ÆG=7â£lð'Öêa§
ò¿3‡]¶qœÑ½ä-%•È)Þ.0æ$Cd=Ã…Í|†KÍ~^`ÉÏ‡k«k„²ìµ§á§Eª3lAö¦GW€˜}È÷äG…âªPk£¸¸´EÇP¡æFqeÜ~©Ž[Ê8‰/¯úñeœ‹Ýðü2)^ƒ)Dƒ"ÕATáP¯AÒ‰§TÄŽ.â$Q*®E£Ñ†¹&EÑ“[*€ýùôø¨Á`è¬Á+`ÅDŸ¢*4Œi6ìEI‚óÈwf#å¹RÂsóù	ÏtfÜ)ïBBYÔ
PHq“8I‡^Û0°-Hm§µd>ˆ”zÓSûÔäó,ÆŽ4Uµ¢=/¨¤L¹eåøÁR8 õÔœ†ÄÉŒˆŒ×˜µFèR¡äö‚(›Wáé@W±õUí´ÆP)ÊVãœZJ5‡gÂ+9YRÓ_gJ½r@|î^þdŒ*kÖ9<ƒ,¼Ÿ*¦R/Æ•ÔU—à-ÀQ–rx/,Ë
ÖÈî)À†_8Æ&ò+«¼°pc±™>ÂÂOYx’r›kk²áÈ–g¶Ê–,ŸË4Ú¤žÌ¯h.[ñä‹Æáã+9•Ë»5rEæIE;MÑTÅ¥ÕGËä'rÙŠRæ$ÊL~`Xß«™á°ÛCA×‘‡'Ë
‹xçË2Ñ´h³4ùPpjêÙÇÌ=ÊPªI¹Ã±ˆ
r'¯eñeŸ	9ªhÌØt!K—¥aUX+“(YL”oã,uaa³^ÏË3NêõPu6õšXÐ2k³^RB)q2Ze.U«Ì±8qüÊŽ®•êÆ¯”ªÆ/‘:Q«¶ã[a®Ü×j{î
wú}a]ÆPGšD^yÐDªk"ÒÄ;£6R.úÄ´z!\3ÑÖlÞ*‰ˆš—BÂF®†ÿÊÒ'ß­bÂgðÛSKŠ•ÞJÂÛPH0Ãùš
I)þñÛVI

/$ß‚Ô¿-uDgÜ÷®Žði»eän—dVUÄ˜øUäÎU}Æç¡Ž,úwªŒ|ïªÇº¡z4ToNõhÞ‰êÑ|P=Š÷›Jõh~£ªG³P=šw¬z4TÌp~?ªGó»P=šÕ£ùm«Í¯¤z4ïPõ¸³%™§êÑ|P=îYõhÎOõh>¨¡öîLõx²A,­úGuýC«X?›
²3ºrbÙ«ÖÞšw,–ž=/$€ò½j"Úl~súH‰´/îL7ÑzyÐP0ÃùŠŠá›VRJd/Ÿ(Ñÿ7¥°Ø8È}k-ÚÞ‰îr/k4£c]‰5æ®ÕÛ´ÏA—)1ùÆ×Þi4O7ˆÜæA¹©®ÜŒ®ÒÑ ž‡nÃ×Æ¡ÝønÎ:N¿4/ýFÌ’ªÞ(÷½j7r¿9ÍF£ ùáÎ4ÙÃƒ6ƒÎWÔfJXkß´&£“y± 
½SŒÉÏï[{‘3w'šË¯ËŒZKiö4–»ÖXÌ)Ÿƒ¶¢1íMÅ×^%Me¦[ÂÚŽDYùËU4èoÈþ°KUYÊ[Z©\ŒÌŠ@ÖÑŽÊ[5ƒNÂ–Øà?Á¸ˆû_‚uNä³@JnR¤ÕÇ×^ÚÑ Ç¥%‰"xûtÊWœÍ²æÚØæèþðs/qùkÈÚÏê[ëöp´dýÚhøv©f–«‚nomCöUkïõ^koìî·övÚÇ­_J$Mg»ÓŽÎ9‚­6¡4à¢MƒsAU<#Ñ°OÙb\ÿucÊ",4£:£´Ó#?×leÕÝÜ¶k›úä¶ ¸yó Ù7Ì¥ñ€n¸Ï1ü‘vq]ÿ“é…xW¹,y$DçY2¸Çd‚CeœŒ¸6ooÖ3Ò …Ä!0¸9*'Qn±CG­ý*:¹Z’ðBÞÌ_®âôÆu‚– „ÀúdM×AŒe~b
X™ ÔãhPÿ‘Ê’y„ª"¯øñdìc]67_Âñ®k$]](¸~ÛC±d|K©¸bÅƒS,r¥ì«ô¥ò¡ ìœÀþº4›€¬©±Þ,$,­ì·6÷[T*Û‡YÑ b#G´‘#hähºçOéó§ð<ãšnÓ‡Ûðp;èÌ/d¿9PkËSMÍK­‹ñ“Zy1‰²ÃÊ<‡Özšbxº&K¤ÏÝÊ*qþž=µÂô7+ôè…ME§>n°¤hûÍ'‘Y…Yõx·ŸÒV“ô†´fëìŽ]ºÀÎOú7¯ý‰Xä3_¼<cÌ^f¬Œ~A(	½|1îÅQ×éðy¶Š¬æ¨)N¶Â ¾²’ãÔ+Þ5QŒÕà-üy`8¯:ÂDŸ+ãÞô²³6•¦fkÉd8³´%Mƒ°Ãgk
ê²0˜ÍÖLŽÁ9ãlbf×™u<œþÒþE*w3Nu’<I·…{Óœ'Ýu,tûÒ]P¿!âÜœÀ]\q·ué«u˜{</¯iÙ~Û+w0ó§Ð =775ÆÉAr§;t×–]êõ» Ð<Ú¢Í¯´1¤-Þ[g¹¥lªýöZe:aG³’5Š4ÍUrÊ·E±ÍÒ!Š"©·³›4|™òMè1ƒ˜ò0ÿ¬(0“5Ë£Š¼"µGåBNìlõŸ´êN`swT‰RúÌ¾€<U©ù‡”ÕÈ?@S¾–n}qÂ*¾kµh™œ34*vƒ‚w’KÀß®Ë–¼íñj[Ka³2å}ª)Y9R$,8ÀA7U€ï0˜ó¸k”ÓÆ`hú,7#}AÔ÷±µw]Nzôÿfa‡¤î¶ÎG#q¦§°…ò€žzÉ8*Gž8/ú—¡=U\YÚy™wr‹,Œ_j¼¸$
öø?Éù¿Ra·Þ¢Ò—À(™ÀÉ.¡KÝßÔŸkt‡chiœž$ƒ~çæåÂ0©ç_áðèá2@úñžpætÜ@mìžÀä¿K5±|³åv`jkÅÊàÛBÜ"ç®XšUx§¥[ãÚ*&iYƒŽ­!ˆdòÎ€»£¨¿EÕ«szBÿ¥¶Šý‚
 ß ¢Õ„‹7·äïûqŒ«ô‹HBU[wƒq‚e–`ØV‹âò›ªãqÊÆçÂoð…Ì,Ë8cÑ2k¤ ’­üt“l’KEhú±¼®„9X3aô×Váæýê'	u?qŽ¯~—;U1¯j„ MvV¥ä{Š4™Y¢jt;+6îkŽ1_þH!³ÛÁB-ó¥E{Ñß°!>Z€h€MHQU0“*A=UÃu¦1TWŽÑ©\hŠ»q·R¨ÎlÛ€f³f«×|Cd~G'’,‡û{9ŠŠ¾ô3f‚îôAüp}¥sÈhP_ØÔ?ÏÒ°©I›6¾™_ãÍRãÍ·$‘-lZ¾œ¡#ê¼<Ú³4\e˜˜ï¶¬}Æ7ü;8ùqeËª.³—.«¯+,Á%9Œ½¾×Œ˜2[‘àÿ8\åþ~^€Éð_×›OÂô´|ý®„¨Œ;.¥uD_ôë‘º2š¹G‰†7ß3ÕÛe)1'ß¤8…ÙU÷ NQ/lÂIí”òôn”v—fa¾û;”ãîïZ.ˆìët;Pj¥Ùö.@vI­B Œí¥‚YZÝ9Ý¦rÓé6}õ«Qœ~îg+´Ì8o¶÷~=Ü:mïµ6ß@ÔÊa”Ñœåý÷vÞíïlüz|²×Új·Tì˜>ª$Û”:x¿ßj¿£Í‹8õ…Í÷ýtÞ×Êrð‹MZâØÇÚþ™Qœž‚ý.•ÿé¡rð¨ž»Óeo'¾%?.!kÎ²÷Üá‹òÞ­°øW4«LüÒ•ß°¾A·Ú;oÉî»ö/ätçíÞî»ƒ½–?Åûû;½¸{5ˆÓ¹g9TÍ\x:eæ¥‹tßÏÈàXÇÞzÈCæÕË\pÑîbÑ/ °ê3ä^¹R#˜óÝ-Éñ(9&t¹1è_'Ñ0¹Ü¾-ôb¥·îøeTÚÊ”Óê.¼Ë1¸:òp:™?1‚þé½	èÀ¸ò@†¼Ê/¥¨.ù§tÑ@û4èwÆõäSq^*:òÎoYãÅÊ¨b§f=Òý—K¾fÓºÁkc«7Ñ²ßÝ glsþúx²K·Lc˜\×–¨pä|„W;Þÿ2Ñ÷ÍÁñöÖÁ¢û©ˆ>ž\êãËD*ù#Y[]ó÷|•Bò/ÓØ×<ÝA^FgzïOÜG'…Ê€"uíux‡ð4>²“At§@M´¡­AŸl÷‡d«wuBä(}XñO¤ýÓ®çö4îjÝìôúr?Ç}ÿ3¢‡Ó½ƒ­£7Ç­@'óÂÁýbƒu÷:uSïø@Õs!—%~t5j…AŸYP©PdûÅ­.x(i?bfƒ„»lòÉ†‹^	ß!Ó—=ÈFDÌÂ¹
~Yš}¡'!Ë#Pò
Š‚ æ0ž‚ê‡ßÉà*³Ëîl4vÄî¤1D;ó²£ÝGï‹~VU‹¶ç-ïP™9#¯ˆŠ²Ï9¹':OV±\–?RÂÒ€¿»7-îÆç`”k«tIÔ€„•õUr)Bü=\³ÌØ²KkÝuÉñAiËWUlúŒðÅî’_â±ƒQ9z3Ù(U‹€3‘…ù,èœnà¤çñ=/3Þ;Ù|Çê,×Å1=Ž~wäS‰.X&ûÁA‹:µ~4Ö^QLîó »ˆ¶ytãòö
­7«µÞÄ¶.ÀÝ°­s½Sú‚=p@l¾yXãŽÖW {Škd´þ ™€ELæ å4yÈº¢Ô;îÅ”[]Æ,©LhÛ`JKÀƒÒ9eÙ¼/•7.Ó(ÓÔ*pçK¼¬¬ß²2ÛËÅ¼|Ìƒÿ·“dGÃ%Ãþàd¶9qð€˜cÒr
œâßA\²áH:¡x{ý#ÞÞá_Ë—¹[µ7ñˆÙ™£'7ÝˆsOæ°hÀ;6"·ñIb XÊ¤Ÿíi›qsVÔVaWI™âgMÜ‚4–Ñy0è™Ž]·Æ~ê(q"¼i¶El_ðÇr8©¶¦ZW­±#‘Xc¡ÃáqÖ$]…0X…õ‹çj:,‘)•hŒ±‚…eº¢àPò¶±Né¶É zQÍU9ú°ú‘)³B»Ä…k—’—«Èú”Ut¹„/uîW c].ç±éÞ¤Ò%:2}*•Ì¼T÷Ë!•ÿºBØ{llà¬'úx«¢fáVåQN‡²*Wœ,jì2Áõ™©RŽŽÃ‡Æ™ÁqEd„ÅUŠ‰ÃEÅáÍüè€^,ÂÔ½ð¨‰ªrÕsÓ£xj#ð‡íQ’¥ÂŒÌŸË±Üù]ë<”›c¬®é	>³ Ö¾ØÄéx§ŸvÌ<s‰\‹å›Rÿ9J‡”Ž7Ôy’î IwŠäšÆ¿ÒmT3Îž‡¡îÃeÏàK­î±f©î¡/šz÷-Ótæ´p s}í(‘JÒÕ…^”Û ¿Ïc-W¯)Ç‚Y¨JO~¤ðdïš™Óª\Üc'ŸÅ³T;57 3Qs£¨v2hX•ÿûãm—¿·#…B[;²^³Š5TyØiæÔïšž¡°Ž&—£˜ÎD’f¡/RJˆðÐý2:ÿT­+>6¹cQ$Ù²£†î~Å0mÁr__B†Ø‡RÕ—(Û1Ù¼è¬™'œ§-ÉÄß…M¤²P£daÛÍíƒw{HÄÎD´’W'µ1Ý£„ägî^Ì„ÄÚD·¸Ü¢gŒ\ußë,Dš¹/³8¦6[{»wµÈš;ïÎÖXØ¹æ´ÄHäUa"žz&ÜÏÿ¼ºì*×ÉàBùøTàéá§àÌ#ëCš 3¢‚%!“Ës”tVäÚN+”Š¬ë€µ†è–Ý‹×žÊì1'“‡>âŒ3ŠcÕ§ à¥^@…8šj!¡r«Ì.QY º*®Ê-±ŽªY1B°Û%<m™Á^!V3lÛÀÙ5°¶ˆ¹Paˆ¶j‡”ZñvíkžQ†3ô[8¤Œ!?œR_ï”âd¼öpF•îúÎÎ¨æW?£šßÞÕ|8£~7gTµ²òg”¸gÞg”j·ŸÏ1©8Õj–ßåYeÐúÎ+Û°Î¬¯vf4ýpr™w}…“K)¸9ŸƒËZ“ô+]fèç7pl™C~8²¾Ú‘5K)¹ 3kê¦«³eùÚò>³æ >Ù '­ý£6ùìýóÉq«íÏ>¿Œ’tþµµ²N§Ê:=Iùé0SÒ©Üö,À3wg‰Z<ÿþ®“N÷U‘¼+Ü‘()°"Q†#UŒ“«jzQÉêœž1½ƒ’F”v)ýž§IÔ¥ó;ž"Ût&_®?ússÝR2n°Y¨9ù–“[9*•	—ÎöŽ+ƒ«™žSÚžÁÀä­Xh.$ÎAQsâr—ëÌå'˜z–ûâá+gÿïÿþÿNþðxAÖÃÚÕ ògò]{kï§ŸvÉÎÛ­Ã“ýã£Ó·û'‹·¤^”M`Ö1@jüÁ“@Ìzú_ÿ@¢óÑ»)Jˆ“ä¿’÷ñðªtËgøRÜãï¥Ž¼¼­PùÑ	‰‰©ÿ‘—çÔ“ªŠ|Wi†`EÑ<Ô„?À¤Ò#ž*ÿ¾øH%à3ò}g¢Frù¶Ûgê3£J@œýËð¼¡Æ8y\†gøÜÂ·0*B=.ª’æFód§¥ž‘?D¥šñ<Dö%°Wr²ñðÁ›h›ÜÔ·x»¡ƒ±›%€+@jÅt’R¾Ïç6ÃcU|<Ëƒgÿe¸Æz§MÀhÎOQ¾cÊjÎ|4B†Ñçþ@ÑÐöGŒ¡5®Sz®¶éWcG…2lÏ Ô”ðdÔ§
ÚÏ½hœmFd;çâ$„œƒ¼»Gþ¤p4ß¹ÇÄp+‡©È^èÙ0;‚…=g™YX/‡±ýV¹dÛ‰”˜˜¼våÚFT€/gâ=CkSsÃmt>çÊé{¡Ç©rÂ(„ã§›’’S„®ÆY]"p³²,`ÌïÅŒÆ`²Ëè
‡ÊeWÎxy$ÖBf4JY¶ÒùMÞÝ¾ŒÔZû;K3ËØ¥7-Æ‡èÚÉÌ…‰í†ÓÙ§gÿÞÂ&rcó¶ôÜØ€%éI®@dí£êù°¾:í¾,×P+Êf‹(ÖnMÛ”†µËTÐÀG›á1ÐÒŽaY²ÏW‰-WÔ]ÉË nøÆƒ|£€!­<e5ShÜ’ÈÑÈâó¾;f¯Ò™7dÖêäo÷cùåŠ“VY0Ù#R å9åØ4(¾8Ï1E=yw†Ôâ ³4›áqL%Qöp ñ„êRæc@U§D¬¼¹/;ú DC8‚c28¥›ìåäé­1wMâÞ¾ªÐÕGƒ~‡aÞä¼® ÷¸´›Ø"Kpú±‰ƒemå,ÐJâ²qMÌ¦28ŸIfiUKqè˜ñ	kÇj9!%¼>§Îõ¬”Ò`³ub!BeRuþnû2Jt!:AÐ7x“feÒðQy‹‚4¿aO’m\³Cš:W]M ¤ž¶·Žv·ŽöÈÎñ»V»°NîŸ¶[ûÛïÚTÁ"ÛÇ[­]R;Ø¿GÚïÁ©^Üur°õË’¦×N²N
â+sJ1yk@»ý|ò%•!OÎ„¤q}©_ñ¬~¾þ˜#Ž‘Ç“Oýq;ù™äé©¾XˆÞò »Üf‹E0åÍ<[e»¹p}ÄÝõ'‹·¦ìÌ8Ê˜K.Añ8Md;JKº|é=*×]§¥ñ ­×,Àn¸Ï¨>†BÌ¡÷•ì3OÊs)Jb*`Ê¨r·xkNÖcC"(MMiÎ\¡Y±±ÐÀìCÿ£L]09Ç’U¬ÑµXÅì÷‡””ßšÿêé†Þà)çS1hV6–S²”³[›ÝÊµÕG	ÒÆéä:F.N$`u~3P
S¡¥ß³ncI¾ÁFWÐç$;bÄ©Â‡]ÇcÆÃ X1˜,”´n­7è}ÛÔùz€"/½¸ýlœöÏ¯À’Zñ%¬æEoÍO¤\{»€Í.¬vŒ^Ùß|_)«_ÅŠ'ÌSöí3[Þ‹•ÞšõmÖ³5‹âìØ)|Ø¸³)<l/èÂœ€-ý•J9v÷Ûa@¼i<Œ@hä-x“„y—ÿÛ„oj'ãÖ>sðB±¹iMæ=œÜáˆ®¬ŽÇoêã zÆ—ÌúíwöRlU™‘7<Ãš	? «ÝÖ'öß‚”ãLè~üqÇ8jÊn‡ÊœDrÏxØ%¹„ÖÝ¸æ8°åa3é2ŽÒNÏ*,ÙÆ eÑ<=¤®ëOžónž:Ü¢=G¿¬x½¤DçY2¸ÇìW•Œ ÅÆáQò”ª
§ÒÊQ‰
*o4ögò;&+ógþr§7vÍ¥
ukÌGkzØ¦C	š6€r@…œQ*@ó¹Vãˆq”¶i°.DyNÜ¦bbF|XggqqI3ÞHò`¥8À“hQ¢Œ†5.ÇöÏÚtƒ\{üî(Cë|ÝÁüÛÉÅa·ùôX·£3„¦<™¯±¢öH‘1¬$¦éDœ¦¬¾fIIóŠg¢ŠŽu†•;VŠJ¹Ã\
½
» è7Øcþø.#°ËÖÕ½,ßrØ!C¢[8½îƒÁª@ˆZG¤Ç
,ÐÑ, DtGƒq/#tzèmôOJ<¢m¡Ü‘õ(<ˆnèÖ}nÁJÔÌy§)…ÒQm5A™L …qÒ±‰oœžO#wzx	ãÃlt>f›š;eÍù©z¾1}sÚ¶ÓU W‰£ ˜­ò½Öc¸Ÿ3B—ñÅaŸêtý‹›^î›GÒe~q}©ð„U0µ;a¸á!L/•¾Œq.î}¡Ô_qR“¯=¡OI=dô>)h.1;8š˜%TÿdÊîr5ìŒ ÿ‰Ôj¬Ô^”PÇ‡KÜn™ö;‹ ·]eqúªÁŒiÙÏýq¯¶Huø_—–œ‘”;rÒ«A#»QÖcA\Î’$PFÂÂ{ç²"W'…r‡ë–ß‹íÑâ ¹èÍØ8X˜Þ§‰F{:ÏxçË.’Æ’‹ã«1>6;utm~_ÒølBC¸‚˜£×LmÆØ¤-jž-Á‚E±x“<4k¬Çz2}ð¾ÝŒW;ö¦o,l
§ƒÐÛí+a×°q¸â€®œ[ê…‡‚2—d08R®åXTã‹T&[\6£¥?òÚâ²û_}qî2€É©2:T"H³Š»0ÞyHOœœœ"à_I¥´JÚÚä{ÕØ‘×=:³Ü33L˜µÁ!¹’–Æ,cÀœ®9›4/—,_–æýŠ`yŸØ[¶÷³iš¿£ˆ¨>íQzkÀÃ3ˆÁ¶›– ÄÚE
n³œ•Wõ,R­Ú¢‚Ó‚Î2r	OTî§ºˆÙ{A;É «iïš›•ðBuðÙ£ÌÔC=½™Ïß2ÑtÚ²U[›ôÒ4ÞÅÈÊÈÃ‚ýnrî(¬’7ËB!Z¾”
Gg)Yb)^”GŸ¨%td¸›©»MÊFî[H¡Mb±Õ6BôÍÑNrßÍš½w},ÔysÚÎ›áÎ›îÎõÊHáÎ‹’¼8ÁÚ¿å>â‰VA)<#Ú:-÷çŠ™f½h«³ÃGÍJ€A;®±	aX&ÁrŠ\f•½Šoà÷|Œ?m; ŽIš»äìþÉÜÅ½Hnm¹XÊ t‚Ôúþóšì\«ê¤ôžc«@ÆÊ(äWUGÒ4FÒÔGÒ¼Ó‘8éTS{+’ZÚJ’†”_Ó·€æ#Æ Ju„ï%íÈmdPÖ ãŸôá)_:Fg;¼=Ñôþ8zKDLQ¾iš˜ØiÔíÓÝS'õsò)M.eŸû‘*¼%ò=”ÆT€lÁ1PêRÄ5Oó™¢ö•-Z¦˜§kÀ”ÂÚ™5úÙªÔEÊƒ?aPÎã¦e8Sfc}XhL©ŒMv™‡û4!Ü§©ÑB«0°%À¡8cÕ ä›,¸$‘7Ò˜yüj¼¤ëµ½!‡aØŠpÖ€–„åŠõ€¼0ë¥ÇŠh3Ø£˜—2}v«e{¸2«äì(â!"³#¶c+§ÆVýÇÕ Y4YÏWXW’¶7×EVH`„„ˆbÕÊ›Í£²Ú,„úyªIåê,Ïczn*•¦cÇw~ïy#wÞŠç-}³èOfÍôiŸÓJ®}øïáó+?óš.Çâp-bPéWëþcvRH\…ü_rwÆ×3'·Aè'.–ö3žxò’”œåª_Ö–x¨‹¾¥í‡·$½IF »JXZúÒÊXúJfæ}„Êd†úðtà®–É;dÂØãLÞaK:TÂ*W4)ÌcõÈZHÉfªmº-eÅUh„H ‚ÛüÅ¯[L‚ú‚÷©¦88•ÕÐ8À¶ÿ°ß©X“AØ-=¯«kC…¤áOèQÀùötÕ¥„÷™[ûpkæBˆ­t£¬wµŽ¨¼šx«°¸‚‰YÈ¯Ëþ°~]ç‚
`Ïd*“3Gô°Ês%ëpG•Êxl±OØè=L‹k"NÏ0`Ü´•E+O”“ÿ"s­(ˆãôjØ‰ÆîjcZô½/&‰Ò*êÀª2]o•gÇšEûWB±¹–¶ÉÌZš6ËrzeöI“g\nð/.ß”y\Øá£gÜú²
ÂÝaƒš"±]|FIv–W×rËx©Úø²Nmµ‰@•ä„—Éšô9RƒÍódÎ"?vDmÒ*õFwMPÂkÏ†ÂB#«‘ƒƒ@ŸûA~Ö)™—L¾¨RfÙç=vi’<]MñTtX™ð‰-‰X²Y±<hCöÔÂ@«îÄû¥þÍ^]¾B–w¸ýY!ïŽ¶NO÷ßííæY…§äíñÁîþÑrr|| ’KÈ—5{\ À•ÛÐçözTö{1OÍ¦æÀ]ôddÓ½ f$˜sÄ‡ÈwO!jóü†ŽQ´6Ò²ñB\ªÞR®ÛPn»Ü/µëŠªnU~T´›5Ã¿.‰¹hwµPIksjjAè$‡}y]OksnÊE'¹±L}É˜&¶©Ë˜;:¯¯ûA-g,	m>oK¾9!O.s4M»ZñÞæ*ÏZþ0KþqÛ|Þeqšé£d	–>ü/ßyé·¨V¦a´¶\¸5˜©,æŒä§@žÃEÞÒÉ[òI’x..vg.¢>ýÎ5]WÑsŠRÏ¥H…AûmÁÆÙ&-Ÿ£þ Òê½PÿÛû-Ñ¨[ïØå‚ˆ€Á‰®£>C¿eÁ9f«I*öbHðl“AÄ‘Æ—óGÿ¿Dò‡£4Žž—r …ÍÄ¾mÎGƒá@SÌ„ÒÆsÜÄ:ÑBJVJûª>K]ß'îÂNQ|ØÎY}E!r*/ú{iy%•%îæQLô–d(BpùzŸçA YÃ:v$22è®–½0qà]¨„A2žÆ áD°s,©[™gýÒ'NR"”ä_TF¨ÀËëhã™y6å¼QÃ][GI5£žÆ»
«k%À6a
_[É.KöQ4kðã)ÏN”¢êU‘ã‚Ž•£#ËPaŸ~7J’Ë,Š%ÚºÚp(M×7>uNšù"®2›yFãÓkh>Ý,¼skÒ‚#í¨•á	ø%¶òL,Ù…ãPLÝ'²²‚¡IÜ.Õª áœlµöŽÚdÿhwïðh¿ý9Ý¡ºè‘Ùf³Ø§S~9ì-°6'ú¯“ôR`?ÿ…Wß~91¾¸µßÀÊ½ðÑqçA©Ü,¾q¶uzZÓô³~o¾Š³—ñ‡þkpürRü­ß#³J^NäŸê+ž%z·}°¿CÞïïý^«s*j¼ïÇ×la
L† úÐ7óþ‰ò—q[,£däxGÌ¯w¬Iøw¤T*0h¸~	KI•µÖ°+MsÁÿ­ +9uÁ`ŽÙ	%ƒÿ  ÿÿì}ë~ÛF²ç÷}ŠŽ&QsD‰ºù¢±•¥)ÊæF·¡èdfüËC$Db@YVôÓsœGÙï{^l«ú4€¾¤Å>$–4ÝUÕuýhœ‡AL[¿—…šÚzPXÉX…ÕF=†,á~P„“{…ïTi¢Ö%ïk¦?ge¹¢(ÅF/Px#'ÉT¦¤·	¼ ºŒmÝýõ1ªÔ|Þˆ~!µ.‚…žMÂÛ5çZm=B¦æ·'¨æÍg^”¸ÈÂA9n·ú§…yœUGŒ/Äìþ¥t$í©”S]# u8³Ð8'ÇŽ|¾r@kU[Q»›Òc.«YÑ5¬q²á9Ê¨.T}XIÙÌëS}Hè`1	)ÖË?¡±†1ªK?ŒnÔ]j4Ê²Nžk„…!!Š¿äpHÔ7¨€HP8­“Îá:‰°n÷úÒIÂÎÒ¹ IÎ‹.’DÐƒl¢<¤¥ôÙy3ë/9 I®™[£D²“SW|V@¡A+¶Myìø'å»\XÞ¡U}êª6Z,†+@©ìÈP*ru`µ–ÿý_ËaÀå/¿å+Äç9eð‘™š- ­V¬%Tu>u(#n¥Œ(ˆÒtf+§QNöI"‘vì‰Ü¶ëØ’Â†S¹­~¥á"~ˆÚ6Sz«ŠËT¬¤5ª4jaé[žˆ5Çs8ô¦ZHÂWFìjD?.õ	(ôÑ(—ØN‹'¦ˆÙZ@N=]9èšá»í#4g#ÐÊ\€Èíc!œøfÏ÷Æ‹t|
V\:ó‡ Ò/:àO-‡ˆq—2\½3!2”i¦AõÇFàtGÀô†¡J#äÐ“;µøqø÷´èÆM!Lré®¾Ö°´XäF·ìk¤°aJëÆ-Bo[½¬ø>nâY“<îjÓ¤?Š"êÈÅ øtX4$—¢Õ9bîu! -ñ“({ê£0ÉÜab/èØñKþÓ½ôs+øX^ËÿŠ•žc·9{ZSéµlið_«äÿý_â(v—=ò±ÿ`3Æ_Ù'à°{–ÚŒÊô&QL•ïy¨¶pHÀHÞÐ§åô—~úppÆË›ZH³Þ6Ç€ì¤7i
¨l
;t _þÆýŸ{gòýFì'×álÑ|+óç›°êõ^o-ò¼q^­aÙ¯´þïW›§NïEs¶uÖl½#ÍÞ»ãv¯-ùÄ›ïX>ÖÉÙaóX²uï’Qt“úºSè¡“hà…yIWÚñà3­Ä[¤Þ ¿Õ÷òIP³¥KÐ 1—áuŒª]ÁOËš×î³¢ÑÍ×z³‡rõ»ŸÙ¿Fõ/·?~.ªr‘ÀÊI	ÜæAfËÇýÈ6Ÿz¢t¨¾LNfXqø5=œYPƒØÛQi3@íQHæsúì¯ÍL2v[éGÊøTZó£ÀH‡úÜ£ªî
çy8œ£yÞ€CUlˆÌÐŒ¹jŸr,IYÖO¬Î´qòÏ½õ'~Œ‰õœÄ€2IÖÙ'‚]ê…õY J Ø}£(~c¸ÅL{^§>;VçNxƒÌaÄaú~`t7©àµSÿRç;){M.ôÒ®vå…‰Ê±åì<aeeZoË¼›Ku`2îRÑû¢X¼¸qÚ£óÌ3±öí¡–JÓ[æ ÒsˆNs}ËK]~p†ÁâõGœ’£(Îá5ÎžK PÖð	DM(¢Ïë×P³‚˜ì-Ø°Œ¨}wØè‘bÆS|f`(?Ù4†Ë+/8D-EI×½w
JÈñVé[ê…9iqRDbP:C1kç¯P•JÀC~Â®°aÔÓ¥gkaªSÕyLËWMf­ƒ^ªLÞÏ ß¼,DÏŒtyS›?Ê}ú†Á2
áßg!#[}¯ë{Ï½iÞúMá­ªuã)âyÊ€Ñr+Y~P‘ln8Qª4¯H´ úp¥Ä¼MH^7Zî¤("4:E„
ŸÉûX5é‰ç¶éRÎ´ŸÞå}ˆiKÝùò¢·Ó\…B‚7÷p8ˆ»LìÝ!­J}Rg20<”|Œh·1oš»;µp¢—{,‘ÌH22’Ñ¶IÃþrÄ##0¹ÐO‹«Œ>hAN]R©GžJˆòÇå=Á4°…©¨5òû¿´‚¸_ŒuH´$Í	l";9¹Ë?t"›\ªâc š,§Ò…dš"[Ÿåò‘0>àÇe’N6¡áÈ:Ø=á'ä¢„ÓÁ^²N:#'²1üI{TöÒ#+º¾y’ÌtðcŒõ#z¨óYZðqÄÌÇ!ÜFÿ½WôtLë{òMËŸ¾6`wd‰ÚY9“¾ªïcoaßG–(,ZË›ºýy†¦OH·¦RU–*+%%¥OvÍÉIÙ¹n8ÂëËúO2F=Cœø½¯6G»Æ©Ø $ôiêmS>û¶‚©X˜	]E0½EZ1Æõ®anÔwB#ø¾‡9OL7YÇø<é{ÔÝû,ºÿ×¿ò~øÌ_ÿŠM6hC«	ùiJks:ÅT žúÀCcPI£ëé_Š„Üa÷ ±‚Ùºˆÿ£K&¡hµ<›ª?
0(‡•Pôrú¼Œ×š2_ÎU@»çÑÂ¨TÛÇÒ¨OØyBQÃÛÂ&ÑÞèóœ½*‚!Ø×$új*bª§²§]Jëf3èèŽÞÇ!s¼1ˆyêäÚˆâ`LÈ”þ0…¥Î†ÿ «ßçó¿Wáw5T-:Z˜¦Üô5¬ÙÑ9Áÿ¤/g“»ñ(ñ÷U^Òþûn_M`ýkaÏÅfl¾½Á€]‡­ •nŒ8(½Eh+¤ þ‘ Ft”DŠû¿^JÞûN:PoâI+>ùVÝOðz
K‚¼’å´¬ÞcD0]þû†Õp „rÏç,—ã’rˆf{Í‘Þ"MÄ˜]Öü@ùã½æÝÚîã9ÙŠÚPæòÉGp’…/ƒ”Ÿ§HÙ£@QN_1‹–Â¤‘puj™¸§^®µTé*'rj:âÞ` ò—/§>&ùkÂÿEXëL©gzã&†Ù#‡×Ò3pBveeµÕ¢Ú–InÊìpPÀÅÀóék¿A(Ìè“—²cHþ*SRºÜi
:%"œMê>‘¦9„TŸ™en4RP±Ü;2É—=MãUt÷>$…‡©å@G`:S)!µ2wß|ÔÌO¼lÚÇÑl6Mö77½i°qƒz‰7E¯ûxÎ‚Á÷¸?¯¿½“Îªû@\ÿ	¦Ôä3Ø*»,Ô#Ìåg{bWžÀK›T|dD—p{1Bšã2éhÑjK­˜)Ö–FÔšª¼·ê,"Ç›µ€×£ˆšu¹s;SŒqöŠ^ÝjÖ© 0®˜ì¢b²e)$*žx¦°éBÖ>Ð8ÅºìÆ_ÏÜþ?cû-ª‹®±rø‡9óÐMâÐÜÄdf–åànG¨À9™*"y³¥Øoª¹‘!·KuüËòEÛCÇ
Ó©¿$VERÙCgÕþ”@›ÖÅºÍ ˜æ>KÞ¥yßíI—±UÕaZ¬õ¡£©õá#Xu{[ÿavqU]Š4-ªŽ§£Ã­”‡]ª:$î¶ —·´$I[…Ä®¥”ñ–Å»¹T{I~^&§×B5Ahš«‚è;ðÁÒB	g÷ª>"Ec†ôÔ²c‡”RÜ@hTóœ¦µ5²·3•>i³gQ•ÿ%|±Å8(·¨N†Šb–Â~±X5Åâœûý;h]áR«³›ŒoÀ¤ÿæ õžŽ‘ ŸÏÈÄ¿oIRŸ óÐ1—ÌÌ/3ã;ñ5-%?–º kqO¡¨ÇZû 6ùdw9ûðÒlE|;-Ï²õç„èà“.¥Z·Ò¢-s‹iŒ´Àf“´?Í?Ò…µöÅô¼Tñ¾rù›´€ÛiTS>vz‡}ç+mìÉéz‰—VÛØ<¢:Ï–âQ¦cLf²{i„ÃØÍWœºŠSO1Oâ¤Áƒ`8™Çÿû­(¾Á%˜ý >ŠÅGL®á^Á#œ.ŸÑ#,.§Vìr¨‰B	±å\%]±¸Bz´hþéq¨VªT7éß`Éõ¡ÚƒÎá>µ[Îï²Õ Hw.yÁÆþ ¸Šx|’K^«aî”PTá<²Å*uà˜!e—ª™Lv†çzäOJ‡.â²æ-:$Ì^9Uj¯QÎù1åJUyk!‘å×ìU@s}c?vÝY×WHúi?óê<ÊûüäœS(æZŸ-|´ÚkþrZ]7¬z>]G7¼|L´¼·¡M_V\›®ýMT? ´VúgVø€hÓpƒC$G¾ôI‰»
NKÑôFã¨æ@þG
RèU-|õÀ_ÓuÃ©{µ¦u…ÍQ/_î4ƒ×«ö­¯ñ+8yðscQæÃÝ$­¬–¦Z
:Žc¤(»Ü1ð7Tü°9xa®pkþ2_SµÓ)øš¿¤PìÇL/¾B½XŽ¿ætäo>:`óWE&.²q.k(©,”´‰¸š[¢kËçQ¼À¶áiu@AåØ¼ïçßÕÆ­FØÊ8ðü`ÎÈpaˆÊÜOŸZ‹ÎCž#|œ¿Ô‡–"vÜÐÆŽ;_ FCKš‡y´iÊà“¸*F½8‘W‹ZF˜ƒÆ_U˜§3>€ùgw•áe=EôMgÒ×èÐ¤[Ô¨Ù&çsElaÕþ(:’³Ì…­GQ4sª×O‘gE'r1*ßuÉ¡<_ë})×ë—à>y+«ó8šÓ}òOžTLOiL9{AÈÝ	?A4Ü³uÀq5„æ(oh@<¿X¡uUDå+§ø¤Í¨“EÊª[ar=ýœâò8S¨:÷cïtÙ9=ìüØ9|ß<&­³“sDõ8”`=Zín¯sÔi5{mŠ®Üîªñ=Ê6–X&jcñAQ?^ÚQ?ècûÏô¡QQnïƒ ~œF›ß­Fr-˜ @h½ÝDãÒÅT”‡beœR-&ó[3§Ö>9†x¬À1qÁà;¾Î¬Ãü" wÇ;Hþfò|M@¨}[O°x`=êäÅ×Ê“ÜK"î…ì
fZ±àUˆòÿ¥ ÁÖ‡‰-œG=uµÖAùä•“
?R ,iÎé¬	çz¼eèØ$·†Ým*vS¡`ðØ“zÙ†‘.ÊÊÁ™(Î9¼Ë Dð«¹*JƒSÉ€‚î”ÚÃF~J‰\‹ç–ÿ\Q,›Ò˜y«5Zþ-D’‚:)¨¹¾tp®Î^š›ANü™ç@G|ˆmŽû.½¨°Þâ„Uü]Sû©Ümö–½†¾½Œ:”·rÐyã)ænŒ‚)K-!‡°A˜èÍ3`zÑhHlu
€çÿrM‘“œß-½ìYzÊÑ€pá…ðe×>b”=€'uosd7iÃR½O!VB0õáw6¶+?"ô>g"rú1ÀÆU>PWË³ùPÍ,…+;Üç¬im­•’ìŽÆBayt¸ç'r¦–:;‘X°Œ	Ò¼¥Î.Ÿ`šcE¡É°]@`ž‹ôÉUä 1Ó:}êCáôœ+›(éX™ÔÔç
Z²gØÏÓè|Q$ó³Ž24¾Û½Nï¬Kj­wãÃ5ì;Õ<{¼{á(”§Â-ÿÿgC[#•ìáf¡¥‹’(eGØåRùÐËœ¬À:Šá9ElÄšNõ´Ûi‘Ó¨ÂDmÓúK›O&MP·Â€ÊÂ%Î3&½zºÙ\½'–»%¬fû)‚ó²–£ëOc•,0üpáA¨‹c)›g\Q‰ôÅ¯Eüðw›äíûf÷°Ó<%­³Ó£N÷¤Ùëœþþò']ïy‘•¿ÓŸ©A}ºLi”NÅÒÃÍ¹³<Õ¥UI\ãškX1wùUK›?˜m3Ð®Éé5¦À=Ü’Ÿ¢‰¸Ž×¦Ñ}ûž³‹ÕñË0­Ìº&lìæ` Ò6y¸%¡¯qX’[ï€üåÎ	P2¯á¸¸½¸ëO›™6žÌý2‡È^@T¯dÑ—nû¸Ý¼h“‹÷''Íî?ubXYÓY§17œiÌ‘‘™¿ps˜¦ÞüØ¿¼%æEa<Ð§AZò³š38eÇABË>0h|Ë±Zf¢Ïòësý‚6`˜Oð<pb`cô$¹Fg„âÝ&`†$’_†dÖ7ÆSê}Î¿¢Í¼yøŸýñ”â	É]‰ÆÞÄúôŸX7À;2øor[:¤x3Ì¥ø/šw£ŸËâ’©ÿ¾-÷>õH'¸Ï”æ¾
¼W*.ðËÀBúÖŽ
*F—·7CŸ“@ìfØts;€¦3Eä¸
U
RFü…þ*’PqõÊ¨ôÉ1pÑn½ïÒí^³s¬3v¸øçQ‚Chß"À,~š^KG<d>§#¨sžŠÒeN¡3¥j{+¤Qºÿ)èû®ª¶ƒŒã@‚ÛÂ«ˆI;­0º.­'\ž*l »rÕt£n…­ü­Jr(¦ZWÊaìzcAk¦(KÉXˆï“
¨¡óPð¨¾½kw^"Ãš¨œÕ0é¡OŒ‡úrñ$î¿®ð “Î^¯HP˜ô~²”´Þ,j.…Òé?£Ë#x=e»E¼49T¦üá*¤&^N#Z“Æ;Ã™Ã
oM¹bÊ|£EÏ/˜]´´ø¿&“Ó!š—3âè¨ÔÓ¬¢×dõ¯©ŽAû²¨l×V7ôñ¼Õµïœ'~ü®wr¬ÇVgÅ‘ì\~&§™Ç®H-7×5MŽ8¯”­éu.EuuUJ;UçÓá;àÝÈÇÛHçL“ËkµLøj4‡ÆŒ;—XÌ	•ªpå¸hè½JÜçÇ7¿‚¦šŽbÿêõŠÈâí&ÿN~|‚¡üÙæd:ÞÄˆ.h?Iþ×öÆöÆÖK`—d–þ~c«\! ãÃy5»ýdäûæ¢ŸW›¶Ux•UÓü!wžÖ_8w¸Íå·¥æòœ3Ñáé$Â$$©Éôx`z[K¾½ËÑð‚]±PÜöã`:³½VðÁ$Œ¼ðÅÕõ„Vs×ô¤^z˜N¼æPÏø³^0ö£ëYM~§)x5LéX' èÚS[Í7À!a]‚W›æäW A«êë”sâ@|—ò^ÕF—gNr)!íeê	so¾üI]"ûÆžCfÍ;ñsH¦¬ –@R%ªèšÐ«3ÁqjÒ£N„•|Î$÷TXÑÔî°Ùk¾A·KûçÇg]]Ê+÷‹^þ9:Ùíýy\¿ÊNv‡èÊ¢ù»ºP/»ô[ÛŸ§aÓŽÁÕž€Êo,j5Œè~Ï E2P·`½xë,óÍ˜œƒ×ÝµŒ7~ño“ÚØÃŒ#zwÝ“ï“_¬Ûø =üØj®“Ë8ºIüuuS˜%ó·27mêje V,—#º"	Î5‡	/õ—Á†5!IàGäK5òS)ü(ÎË}q«ï?¼”Qñ”€ë‹äçöô gò°,Ú±²(²P[(Ö¹J÷…Îí9Ïjù@àü©êšUåPÈu×c²3÷ù|Ò?…q¤£mñcS%øË¸yh¿í‡ÿçªiÑ”’Y
iyç(ƒKü£
ö1OÙx*œGÆú!9Üã:é´È„Fo×	&olz<]1Ä}oŒxªï©)@†xöRðÇ)fhðdQé 2c@ÊÜÂ• ê(*;-›—_}]øW+¶øöJãJbGmÆ«èÖ¦„¸]„£,‰ ‚I€Îq~ú)«‹Õ§Úÿ—ò<ÒÕ–>G)ê-\«<Èõž0åmÝÄÞ4/c5Rµhÿ(xŸ!ë‚–³oÍ±døQŠ1·anÅ_Ñiy©m-©6þ9ˆ×,(—uÞ€~¿ÁU:ŽòMž¨µ­ Çu~¯k•ù«¡$<ôç}¥ŠáYµC_ÛU‡".ò,RôÎiÁ*ú‰|—Ð—ŸFÅZ<,Çƒ}•wÒÖ·2måû½ÂÓK¡0êš—²æ£ª9(JÕ]½ûb±r@·j'¨zÐTy„ÂùYÖ¹L¯¶áÙþ''9Q½²ãÝ¾íÁn:sÉx¸‚£D<n´£}µC'.æéÒ/Ñ{d9x.EÇ¥(,€FL	Dƒ9ó¼’)fä$¢;–€òå(•	+BŠ®®èñÂ¬¡"éYi1yõ)X
K¤Z¿[sFÊ
9A%–:Ø–{s³+Ceÿ²8ÐFuq6ÚÍ¢¨›ÈÚ}<£äEÓ¼|Þo>oä.…?F½ÆÖy[£èg’TF6sMÑ€s®cšIshß5’ÅÍGâ	zëH(üW»d¬®ÓÅ®Ó¾%U»è3´:±Lm&rº¶9À„›?EÀ‰vÔ<sÊ„¸hê„ÕÚéŠ%HÜñSÉáö²)3*äE`úc!8’z‘Ã‘µ¿2ö¯ü8öãó¬‰Û×+“¨.~åðôèh`¨´'!Úƒs\Å÷qX+ê„JV ×«Æ×x}¥,=.(u´«s~7‘9Š‡§±©3›¹g…%«QÇÁ<<u¡Ÿ¦!(îzBCÿ:Œ**Éê’Y° QZFq²r2‹­Å¦ãÑ>Ã2‡NKg~eŽÌü¢ÇE?«£IÙŒHûÎs¡MUiÅ‹f>)"|aN´aæ2f¥‚ Â@[(Yž½QL¼àÆé¢òl±þõ­yÉncé½¥aÌléˆ`i;klã¢p@Î°°G‘R•Â8wrÚÜ2s£1¡ äWÛÒÐšn3É¾Àw`Ù]ñøÐG—[pµVèÖsÖ=„f§F£wL¾æ8¤˜	{=PïãkrG666ò†«-„]ºTb¤t•~v:å¼OþIî…½è‚ECj|4×Ó²¥Ü5ž&à0„ÜòQÄÖ¸êÃ8Bo.M¾O]ºÉu¿ï'	ÍŸ°–—X´Á0%Ò þây#‡±ˆŽÉrü#ÃV,Ô®sõµewÙãÛ`£êj+S¿…ªî€”k>Få´!K_|oÒ÷Ã¥¬½Uë²kˆŽ›ç¼uT¬X÷Î¤Œ°šAÒÏïäwïAó8ÝNú–Õ¥ÙQ©¹eÊaU¶Öª‘0ñzÎ¤‘eÛì›kXB—žàÊ!«d„?B¤I9­¤¤Òjƒ¥§êœ3¦Ýdçs{aá÷±âŽº¾Â[t…QÇÚÉ3
âÕD$x“ÁeôYÔŸ	|I<q0ê“×¿%S4a¿Ð÷}‘Ü°Þ»öI›\ôh9´:¬7òÇþ£È{ˆô¯])ý«Q%ýKnkjK;nõÈyó´}¼O.ÚÇíÂa¸DÿY@CàÍ®·b@$Í€ARL®†ôS¬akb@
FæRª%>o·z;­­M”:÷@pÎTi`RF“ °éu˜øZW…*çÉa~¼BÊSä;rì<˜¤\šL%m…\µðùEŽ›µ`²x9§ê”slÉ;Y¦Ž°Ò^ê]S%ì°ÕÔ“:óX›èà)T_k¨Ï‘hâ…Áo>;!¤bàiÏ¼p¼0¸ŒÑ5¸…?}âõûìäñas“u2Ål4 ¼Ù~@ÁHÈ0XÈ[–±†ÅÃ}à?0ePØé&ÀË&~y®ŠÅ˜²ÓJ¿§À ãðDÙÚçGL³ÕjŸö.”í7uòe[‡Ò¦ˆ¶¹µ–øQo—kÞ
ïíÁá4Òµ!Sµ‚„úó7éæ%Æ¼EeÐÏ©dZ'ï>h<½Ï ì“UŽo¸º®½©nl³Éaôoo24Ü?ð“>ÜßÃäfäsP/þÇ<E ç16cš-“q +ï:œ½Âh9¢—ánæ†Ý'²{á±Ã­ööáKúÏ—­ç`_¯þ¬á^7´eÇÁ`‚)Hö<áw’fìO<‡ôû#Ô˜péÐ~¾ÌŠµ·Û/ŽôŸÍÆ³ÝX±~ŒA(Ú¬Ån$G×ñ­}¹ÞP?òÁ°à// E ÛÀ~¡å;j>?|þ÷›ï°tÿ½ñÜaYQo¼x§Í%*Ø'ã òzÐé®×<zq´ç¸pü^|l·}Ô~Æ®ýü°ÑÔ/œò÷?³ØûÌu·ti¡q÷™1ì^Á%‹e{x$ÔpDâ%4)ÀäKD7	=Äß[¸Hð`º´†ÎÇì8¹ûÈò±µð´¾£PÓ$Õ,Ë7['…®±·áŒès§+btz°n…ÅLF¦ÝcZ"˜MôCÉõ9¬šeM	Ñ*M1×™ZšË(èÄ…¤l}sÂûº˜+±AmVé³µ¥A51—b{8‡Ü%àvh	±(¿Dè^­î%.xŒûë í>™9ÿµ”uá‘û¼·™¦¢õÚk¬Z]ýúîNR )î“>p˜5Ú½H¸ÛögE0ôe¹-Be,ßÔD™±>‘w(MÄ]Ó†ÍžÆJA#b{Ÿ¼i¶~xÛ={zHZgÇg]ÒzÑ;;éü«]v¤Ðaµ8…ÓY&%r®ÁÇej\\Oµ3Z£KMßd†^/2•„éÅ¯pwÎ©Ù)ßÓD¹¶§§ÍFŸÏfjÌ9fþ„}Ph®¤š4¨ôyªÊô¨*“é#ü„Q+ö½qîùgGÛí7.Ïw@q?õ3÷ô.<ÿÒåé‹Në8YåÇÛGGÏv§Ç"¹À,=y„­í­g[M—Z^|	úÀ›ˆ!7B{{{À¤‹õlWÇp–€í¬”•ô¨lƒ˜–u¥|\Ho•¢EeÊ
 ‰
³ÒÔ—¿$Ÿ°MU©ìÛòtÐ®ò»Â0O6·cÞW+jù@ªÒÅ˜ó!.Y­*j@7t?Gô¿jéz[Ô&¬ý:èPœ½AŽÀ?„ÎšœwÀW²Â;úmâ#Ú í…XA²+ix7Ÿ´§ÊCÎ°i=€†bÅ›úØ¿
¶“ßRŒòø0Ë‘°gòêÝÝ¹ú9M1ým±#»XÉ#U}Y«¼ò1'Y¹ªÈ¼Dt(€d—ªæNÄEæ®„'Gÿç'×](C<Ru)+Zg£×io„–:êõ&½‚­L4–cÒÖŒ¶‚uÅ02õ6Û‚§5*ŸýØ"),	¡*ã 0°ò´dÐ·œœ[õßÙ'ÇÍž½ï‘‹^÷}«÷¾Û®¤ïïVÔ÷i´–¿ð¼Ùêœ¾5H=]´pq“a|)ê*Úh9„8X2¿õ Ž¤A:d$óÖë
”ŠVØU¿²FÇBª|ÎµÕKX¹ÈÔí¸ Îñš×ò®a*5N‰Z<=2<Z£rÊEÕ9þaOÚ›L\gÉé_9Jé:ºNÈ\B›ÇJ#Æ_¦RœÁœ¤‡Üs`MÙWN	žíß"ŠÝXÓŠ¼þìkdñiOìPzØ²«OûÂÑE|†xGuž‰ÀRÚ0Öf~ÓÂ¦m˜÷Ÿ:‡½w¸£§-~²¿áÁþ9å´ô9Úwèhÿ	\j«˜­2ðâAq¶ýˆÅý*&ÌÒ/{’f&iöRy¶óµ›Sˆ½0	±­í @É[ ðßç$ç”OÛŠöcßŸ|}´/}ÛõW¦þŸÒÕ{úßk ý¿‰¬üõÀp^_¡ÜgŸõDö•ÉþîA(¾ÑøŸ¤=q4UT~­Vj‹ØxV¦î•“m«¶[‰ž)È$WB×3äl±Ú/*tmÁ±Zµqí0þö9ß½*Ž×%+Ù\ÏªýjN±*'KÕ¦£)¶OMÀ°º·ïÒz‘ÎÉI»{Ñù±MÎ»í;íŸÈa»õƒµz„c”¸‘pÑ¥0I°ç|¡´ÄZ b!4“c\³ÕI	‘o˜¯5Hñê¶lq»•ƒÎxŒu[Ÿ|rŒÿ9ýO£í€î†|°ÍŠào)ÊeštÏrô“(Í®›Eäážh÷0t`DÚœóôñ&)A?ö§Âµ§9úXIû^XŸcÿ›J½¹NÎ€zÎÁnwÉ›æáÛ6Ù$CÒjvús•ª¬
'G-h7_kõ*Ð?ö‡Zä8—'åÝeƒ.Ê4þ Ú7oƒKÌF¸ôbu6Jñ£Ò€BC6diƒ#FRkÞøÉ©T‰Wrv[qooö]ž4U©”â°j|†…Äšf©ff;*iIÅñ,„K_È#G«9ópŸôNºuuõÆË—†\%U)F!ôg‚ûv[=µº7ž	0UCç/š!E‘™ŽbÐ1vžÐ)„XÕøâV†žr€—R û° zÅDífÒ¼êÞ
µÌƒF×_¦´•ƒwÍuNÈñû¿Ÿ4Oµ…3ºüH0ÍÐ*r1F:ñ²šlI§=ç1ñ[ynïø–v@­²˜.¡6ã¬;æ[¤Yâæø÷Áað)H¤vàº›s{cÎ=.ä«þïëIÅ°¡_.Póa1Úøe-|æá>ëNùúî‹_†Õ?JïW 4Qé\ µS§ÍpÚ±Bÿ8Ñœnð¿Ç´»»®²ÿcrë(9Ýš#RÙ’|®É¦ iÑjžÒû÷WdV~jƒ±Pïœ‚¹paÝÄ†?µF~ÿ—V÷ÃÂ’—"‘.ò°œÞôTs=FKèâŸ½ö	iœŸjÊJ5b¶ ‰ŠJSC/zÚ–ÙÇ mÚ0D½ÒI­4#Ls9†]ÀXÒ‘zvªfþ¢ïY7Ù”vn1¶’iØF·šÇmÒm7;§oçÎvRâï>ßx¶G~0ŽZÕu£˜uwDr#•¨¨úÒ¿ï4ä9;²¹«º¯Œµå0å¼56®!«C¯¢xÌ2BÑ–E{ù!x@nµk¡öÐ»ôC«¤´ds‚šÒ“B{<c^mÒ×8³›Ca‡1ÏÓÒØ/0ûgP4g) +7(±‚ÉÖöŽv¤2l¦½­DÄŠú[(af¹©„:ËS'P8¾E‘ŸÔ½ø”ü#eèK¡=Ý£¡Fè]¼sœnŠ_ýíMøž£³³öqk÷šØÝMbÉWW(I^:3®Ñ3H$¬ÛÖµeË+¼åæŸÔSkÂÄø®MoÿF¶ÛÏÈÉ?ë½Aü¿½ ½ãâ6ÁSmƒ4ÑŒÉ~ŸÌâë>¶2NÖÉ b“c<¯á§q|½YôñŠ†! þ¢¤C0Ëa7MSh'à5äD‘šàGü–·?#0Ö`xa0“À3$µýÕ&ÛŒyëZgÍÖ;Ò>ìôÈy÷ì¨çœ~©yýQ{Ì8Ø×Â´=/S(9a—Ê}÷â\ß=l¹—FÎÊÞp\Êú+ö|wî
§ðÕPŽ”úR¡´¥Á–S¹vã¢"éjãDîhCY8g*—[¨‰NîŠ˜«ÜÎQ#-“.LI±ÌÿP¬±be-Áä_Y	·ˆç%t£²famYŒ÷‹~ •~Rn¯£¾¨¯$/ka¬€ çÈ+C>Ó½ÕGzÆ—èþFºFÉNj-o2‰àØÓ„–«ÖLzS°dMŠWÅ\'myõÎ‡;ªÔJ…êê$:{Šr•š4ú”ÿ>b„™c#ºñiÕ^|égâà”º«çZá¾`xã^]^$ßR*/ÒnÇü{ÁUP‹VúØwÑÑ—±18ecð–§qÜ˜óNû”6õsß™°¼1t ËÎÐ{ž¶ÆqkÚc/Is0 ƒ qÝ*ïË²;ôž?ìî<žsŸ»_ÐƒußCþJjTYE`\ºúóþ§ñmÌÆoûî¨cª‘ÁZ2`&çL'¬hÔ&Ë½Ö¾€© køŒ®fÁž·³ä†§Ì×WÞ%½™áÐX…»®M[ M3vÑû&§amÌâ`\ÃÞ}ä›Ü	¯üƒ hþGuï½|/|É:Á™Ã$åItÄþ¯×63C06?Ž£X×u[Sö—Tü®Ô™B9æÆÆý2?Qƒ“|È´ýŸ÷µðkÙ(òý:¸v¢ÚÝ}Ú	Gµ7º'¦xÆKÐ3_ÚO$ó+ Ùn z‚IÐc©Ê S¾Éò$ò¤£|Pµ•Ê"Ø÷£ÅÝ­á‡YD¨ži˜5]•cÿsó|*+ütë£¡WßmHÙ¬îRªØmYë²;+.`¹QÊ#„ÞËÂrW'g†»¿ºÛ>jwÛm·g[´ù~Áñ‰¥ŠŸ|þ·¯Ñ:7½‚þïœú&<yLMÓó•–é}!o)ënbq—æ{{WvÒ†U] %ÂlÁ&£ƒÖ…2u.Ñr#‚ª]\‘VTí@ÃõÅÁÎž˜‘£÷Ãuó7ý­œßgsN»÷÷,Í1Í7ì4úOžiµ›+ ‹,¯Ùîïæozâ‡9 UäUXÚ½´+Ýñ´1Žƒ=e|²IðíÁa¬§‰¸éi“7©ë'"y„G}Zã´Ø>I#·Jºïi·wë0Àò;jÌýÉµOjo#òéRÿÖäýp²æ¾}*4‹(^bÜ=qÓÓÖ9nÝ–`q)ˆÃX¥ ¸éisªlN³ß‡/Í¡J¨·‰gÝ)~ßÓf9nÖ·Q|=ˆpÂ¡žq˜÷+ñCÌ•Ìoˆ=oÜ¦Ü…ýR~·ý’ƒEš,æhJÏuž™ÝëR€@ÑO±Öë‚éÈîsä¢+4¼tˆ‹ŠCœÂ§G)LG9­8JFé »mRªcêÕ&#‹GMíçQ4N<qjç9P{îÎ'j¢öÂï6õ"£³Cº<ÀûýäžÉHî¹;ÿðä~™E¤N:ä&€YzqŒßMÆ·$º™T¢µúÉÊü;‹‡Þ$øK2"1äžØZ^LÎ±åHåô9…wÂ‹éPfï¿éÑ¨zÎú#Wú.¦~}Í)CLn«ã”RƒÏwJºï+XLŽÿ…C‹£SŠS£ÚáÓ;„£Ôï&­÷öå˜áizXmœÖÅØÑkØñOAÅ·ÑÔà÷ÕêvZèÂb`gR‡ý„"5ø}µÞ6OÚÿyÒ¼èµá|}‹Vú‰—`·öödäßA<»†o–Ð6ª¬[»õî´ÓjÿçÙy»Ûìuåu<ƒuðf¼«w¶ø»~ìt{ïáM<Ñaå@—ê	?v+¿¥¢8¯€4vÄŠ+d|ñÌÀùãš¬™×‹ù7–b¢BG—/žè%·“>±¤B¿4PŽ¯È¿Îzùw²?~]pInÌ¢‹vÓ¬­‰„2
\¹*!¼_rbÙ-S!	ñ<ôi!<ªSÁ„¢¥‰ÔCø¥’eg *~Å’°?ÂÒ¼&S/Nü£0òfµÂ"á	•ÐURÎ·) "=­ñÁè
‰_‘F…%ai.Êž`@˜;õIÉQýÅVˆç×Óv&W‘6{óŠè>)P¬:)1KI,ÄryB¥ÌêûœÒ{ƒ¨o3V‘›ôI‰Ôøí‹WßvÉy)X0—þvÎ_¹'øïÔy²ý•>–³ÊÔþ"{åÒs¾:ÍŽÈŽlgäßjvˆ+ðÙñ_¨oO2-2}BÒ,UÝÿM…šÄH»L7éô¦sYˆ“8èoÄþ4„3£¶ùáÿxõßšõ5ê/Þ×­®åûí)ß0-LÍ)››ä=å)2£K/”7öT½Nt¾þg -Cp'Ì9ÿX²3¨yx˜xU¿€µd«¡‘&(å¤÷ëdPßÖÝcJp77Áš9yccCZß?îËK#Í÷šoP£[6	O'F22AìaÂÂRË"¶lŒx ð]ØA’mîY¿ã®Å°kxtÔØLÐ#Ñ•jF6³Á1MÁÌŠ¯{;™;eçËÇË¦»*ÏYo[ƒsZ·Æ¸9 º6èQNoT¿_þŒ#/Àt2PØ‡ˆ\x‹JP^´§døå&ÃŸuß6Oiëæáaš¯Ì†O€ÍÁà)ûý)ûýËg¿á¥>%ÙyPâ’…SáÄþ'É…ïy—eÄj%Ð˜’JsÝu·Ë@Ù:„æWg,ãs•7)Û
ÿ³®­
•LÕ–CnÇÁ‘Æ¸ŸAÑ-’§°énÎU-¾QÆ²MTöÖðJ3cŠtvÊÓ»j([iˆ^{êçöÓçd¤-R.ÓÝæV£<|¹y†â¬b.ö.U.}t‡ðo¯æszr˜ø7“pb_´bŸ†Ðü›T<ëj”–Q•sgå0XÈZñÕUJyÔ}*ÆÁ´ö¿¶ó¯Hªh@ EDõ½trU³ Ú&€£‚’´µ¹M ?,á9DzAzôTäÔ˜6RèSsµG@¨~üz…O;ÎDƒ0"Éå-­c^'XÉ²N¢˜:¾ÀÄÒÌCx	26¿öã[]‡UlïB5€kƒñ%Dû2¬o5Àþ‘÷Ä-ê'­î~n;7Ÿ5*@Zº#sÔfÔ~‹Š1×ÛwE¾aÚôö6Âu:¢rOA —û|\–×¸ÔËÜmÕ®M'£>GÉï|ÎÇ–†/¾£”ì ÌP”¾#¿öÂà*`>[KïKgØø¢<ƒ?Ã—×oÅ?R3ÃéšYÞÕôáv1çŒ÷	Lz,Ë˜©+Ø[åé£^#Ý€¦±s~NxËÑ¨³³_ÝÅi{G4C²½íL°ë¬ìäJ¢±¿°‹‹Oß8‰ÉÍc‡A57L[ÆU
KKÌ+¿B¿ÂšhFq]jÔ)ÇÅ·XDdòÃo8~RûãTãÐ-[`¤ÓŠa%ÿÙÏúÕ˜â2.“¾`º€³øÚ@÷jŸ>»üºú“!o ¨ýåæbÞÌ²,¡Ô«ó*‰N ‰ë4RªW´9•p“Ûè:æ4»až¤^¬²Ë°_÷ú¥æÂ1›b½™…DQdöà€4(Áîô?¡ÎÂEiÂGosÕ·›•ñ&m
¦X3Q‰ÃÞ¾2oRyã·YSÌÄØiœ[ÆÆ<…ÌJ'¶¾žâ2[˜ÅË©xQ®S‚MöŠ‹ª«úÝ­}øÙ"yÙuO|8G–ôN]Ž½©Ì[s›õ…Ç¿xpR µÕ˜QX©££Æ_iíË˜¿lôXb‹»Â&+t!sèšÅ4RsOWq)…PÁÃPD²_•\	wž¹“+^÷ïí‹æ»jb ôX——Bëlü‘í®vz°ÊvÓD`…}ž9ÚC\‘é¤öí]Œß¯iûÎfs4·'N'i”ðùSÃ¦cM”Ì(¢íJüApm?]'w/ÎêZ²–W[hîQÄ.Cûe6ˆ•Œ›‰ÏN'‘/Œ
é¼¯x8Ûä¥£&í~ò‹ûúNLÀÎXUOÍ¹ÎMaU=/í§6ÁYàÿ…I:Á_LÈ7¯3+Óíäªx²ºÏîÃÆÆþ{=ÛAÕ9à))íhM“Ó^¼Íñ›]Ît—›òçaÖ6A›RŸ¦£N˜Ô:¦;”Df[Ç•ÎwAOéì{©n›µÁÆ¿¬ºŽ§°Â?¿ÛPŒ+yüíG´©#zv¹ˆ~{§/uæµÓhH, ü°*^ÒÖWTŽ\–ÛY+ÂëNš‹NJ[¡UÔ‰ðrÔ‹è­Îw*HA‘4À9uåàNvôÜW˜Qù=BWé0Ñ$âï¢'[•/w½ÕýÆêÝ=ÐWSñïK¹õ«§›ÍÕJ« boÚ»H»/ÉEŽŸ¡S?K]×%Ê»ð5MœÍå•¼LÙÅ“ˆ÷	]Ì\¢±·¹*±ÄÅá‰Ò|qrÉÔ±8ËæIWãË¢ÝíWÚî¯†ï×jšA«öÔ¶St1(Ñ¼EMJ½ÞÎžF}§1ý¡ñ³ê£¹ÃÔ)?œN+{¡¶¶åj³qsigêF£5U1:­ïŸÒd‚ÝbÒbvê…£]­´wî®%½E‚îªÌ"ÇøÐŸ-¬Î§Iu»ÚWlþ”>Ý¡çÊ-ÿš„ctõÚÔ‹ŸC#fÕÊãK¡WÐ.§Ô]_µçòTÁ‰CÙÒÙ,Ò¾ÌJ¨0â–¾0Šj¦?Ø2•jÞ–¾F¢h‹:,Òª3°\>~›ûû=ùáä#Ú+œÅ£\XY—N_ ,œ(sË–ò2ÅY«“ì7"Œf„ˆa³Õûl¥úÀ`R@Œå­¾„0Á^1÷cî<0Í9SV€Õ–Îã¹jHNh®‘>çK¬_.n;Ãì+E­=&šfð`àÚNÖìj&I0œ5@­(ë‚D_/ ¯“M„ßÀ#C†ÙàFO-ˆDb¹œ¶Ú«uMùâ€%Ú™9hix&ÊñæF5QŽ6?¶‰r¸ùN”Ã-çD½ž‰v¢|ãƒ`žð7i‘OÄßõ	šº?©ÚüPË>sýÀÕXçcÁQfÊÒ¬Xd˜=b[åÜ4å›½Åõ
…sÒ{©6à€OsEtÁ®Kèm}—ð²k”XQ{gÉx2)ØÖÐ@±&KrMù1íH+ôAyNÝ*†Å5;ÍŠœŠtiJ÷MìM3=K¹ßjPçq1/|jÈÿ–$J	–ÕÅr™TÅÍ§¨6ÄìŽÕb›¹°·Rö‡²²¡ä›~hÓÀËQ)»kÚ-Ç¢JºDEfpNf°9ä]ÊWGÑd(É´*r6ûÿ—y\õ¶ýÒ¯ÁŸÝ.JÃÍâˆx²Œž,£'ËèÉ2z|–‘õù5²¿œª_÷:ßy;ú™\–¿W?ò§êëgŠ¬ÿ.›$w÷[p›X7?ÃáOÛSi{œ›Í•öçël7÷è6¨ZÓ9.úŠÚÎ=ºÍªÜ|Îa¿¾ºösn×oBGþdmèÝº5£sà¶¯¨ÝãÜ¤
Mé·ë«jK÷è6mŽætäÏÞž®ì'™«eWi˜yšv•}jóµí*3ã.³«å‘Ñÿíêtôÿ§iX÷Dÿ_ýÏÓÀNÇ švŠ@ÆüMìJƒ-ÐÆîEzÚÙ¹ø=¾Æ†vnÏ*·µÓÉŠ?Ec»å<—ì\b s‰AÎ‡p~Ùàæ—	lÎ!î];à¢˜¹¤NxMš?fa×vÄS7Á+±iN¬|u6˜¶ž€å¾ÌµûÈpôµˆ Kî™7µa…¥5ù=}yqy`ª¤¦A ˜Ñàµs™oC5ŒÅ±ü~):pG¨+xÈYÌý_òô ñØÏð]v³‡7÷âùI4«{8º?P¡ÂYQŠ”óŒcÇÎ0îéàÊ¯úž|ÄßVËþ¨ÖGjÇ¡(|ÓqŒ*Mc.†À69§þ~ÿÎ@ÖLÉ%„´î›P8Yæo ô¦Ùk½#çÝÎi|GÚÿ8?ëöþ§y¬n#t‡Î¬†`8*3Â."àSæß¹§™â÷¦ùC4Ú“m/³Á[ÌEÛš]æšâ +¿–ûL, ¥nG‘bÙYŸ•HRÅ§oY„ÿ‘¸WBéÊïýíŽý¤êL.JÐÊvFKé¨®hÌÊ¹Øv¼{v3hÓÐ»]9 óE^ý<âéÊŠÔOKË®ËÍ“èD¦ÖXa÷8ÊAØl›ê'ä&€s©sÆÅO°çƒÏ&0
†£zìÓŽ(Qƒ	…«G•ýüôm²ñjs:¿Ê]Y™-‹§…ú>ÑõÏi¦é	Ä¸M©öîð"…â›¯-Z@Ë£d±ö,LÜ¼‰·Ní¢ê[Š:”g˜1‰øàùŽápŸþ;†“ÏÑg%Î+ªá0ŸcD<÷&~¸O[ÇÄQX¶¡TBƒÊfxåMýÃíQ‘¡È‰ÜPUž½¶é‹ÔCµ½ð/ŠxµLí˜‹ÊôN%IXÑ¢Òž ™Ì`ìÕËTZ&,'oßré•Ïó÷ë«Ên4:[S¼xásjÎF¡?³øÈª5Ù!mvLMv2\¾ü”uvR÷«æ¯¹n;ú›¸
\6}µÊ%xž=èÚ§Ðåç”öñéÒ.>-ÞÅG?á*ŽEÙ¡Ö_bÏœæZ,>Ä’8 ™®’jKÃ14á3Ý£a:©®?…µ™“cY³\2µ±ïÄÑ«ô_:Ï?ú—dªù¼\‚qtLz!HuÄ
ÇOLHí®ÇÞíêÑµ‰’uVCUÔ Z^9¥e|¯qMTò½‰"ì!³¶¶–BŠÛÜ£¾´‡YmÞ‰·˜>ÅÓ‚O¼ý^ýá€ýÏ6c]]žƒVÃ‚‡ 9&8±MòFöè²9ôÓ\.[òAçäLþôWÎœü+ÝùÓúoaþÓ/À£¦WI|zÉIÜUù)·ŠŸÒ}yžmaA¹¡…Ù†@1˜H$©áÙ;ÿ3EŸœÓ…ë’$øÍ77A°;4ýf˜c Ø½F£ìBØÎyXÛ%(>°Û°µ”Ó|!6gGC}ìMÀ8o‰¸ÍÒwNïZeWÙnßŸ«©œ\ZÞYA²…ñãw	¹Z3”îK£Ýw+Åõ‡*×µ:¨•yOÐW¢2.MNBtV”“ÝÔâTˆE-F¯ž‰î8£”s‚nšŠûÆ†„J,GÄ½;!í¸`›š»B škAÝ¤è«vfngúý]á>×>z…Wµ¡ð!‘‹oâ·W~³¹x7>ö²Us£‹¬%_n ×F||~ÓD@36Çƒ{‚ùŽ_ötMñLmÔ,“5µ¼»O]Ýq¤!`cúÏB\$¤æ¸Gw<Ðg©A-öd:ATÀJ1¬@
'1‹˜ ¬¶©ïJ:"–(HÊk:ò’RûÚœÂâI=É#ñð’å‘E{ñ­6Qˆ>¯±lÕYŒ:¢c§<Ä\/bšÒkòÄ¨OŒú¨U÷Ö49G¾Î­qa?†C?>I†5„…îr[MŒGÑ–èú“áÆê:Yõã8ŠW_É¾Eûšßß“At³A_¥ÛXMƒ.¥#GÊš‰@„³ÛúK)e&Ó^¦·,lùYŠoMÃ“Æ¹`åà:¦±æúv£QìØeÇ³Äai; (>Q£†(ø¦Œ¡î{×“þˆ\Ü&0]¦ð˜ä¼0OŸäï“ü}’¿åäÄ$Œ¼A3…!A³0ŠB¹šTË2bƒä¿¤º€qÉ*0ÇRXãÁã²ÅÜL±K<:†Ð±ƒ•R›AŸˆ]-¼’EPòYFùSºtF?ÌÉ,/ÕöÙïÊIÔlÁÆÕOl–ŸÆ3ß0»lÎóº,Kœ#Rˆ±#à‰C»ì€šKb,íõbàÖrÌÒî_–Wð­?Á2øê4q`÷¨dccÃ
+­õ}­Ü	éGC4¹'›$ýe/šy¡—·nrž•ÄJÓßèÖ’r-½¨QFS}š7¼Mù™ ã½­½†!…†dvú¯ïî@ÙÌFûØ°¦V\>X½Üâ­‘¿’­Fãþ~4õçÕg+ÍåX-²ÒòÂà’­ éSçð
ÍãÝS%÷ní•Â+œð·ðCŸroSÃ0«<ŸÄ™bÔ“©Á‡Ë\˜j¨jÿô"h^¬ºÛ«V¬	Û¥¸xûJ‰¦H¤…__çÒÂ ¡ÉÂ}LºÊâQ[ùåÙ|©b¾
ƒƒö¥<ðû,Ž&Ãƒ•7 TéVaìMGA?YffEg1Ë¾ÌnëGac5ê€`ñÓ€a`í{xÒŠ÷e£_ÆÑM+”N†%È³±¯hÅ]a2Þ§(±A$O¢ ñ-/o¢(‘>+S°–öüð(?r?O±Ór;OŒ†ï†7ò®†äè¹p,b¾Ï….$
XÛŒ|:it=#˜[‹-´ú4H„1œ$éä¶qi¯Ç“$›XSàNš£ôƒ$Á¥ÇCF¿ê¯6¯É*¦¬ìÂo‘ã»ØW¤ì^ôã(éç†Á'üO‚Yêç±ÿ)ðoyy’1?C·•É·rQŠƒ|Ú±ÉGZ¹g„:~K!îÕEÒwy<Æ•KÔò&Ÿ<“Fcj0ÀôWÞáÁG0¡–6¹Å7ÐJ`RP¡t/ÑÊwW;ëAÍ£/dÍeÍm=*sH¥YÍ ‚	¤,–Õ²zž{­%<i9ØÖ¶î¬—4ð¼ôxÉ(mC_ÊÜÐ…ï“Ò‘.*”ò§éNƒŒ?Ó¢½S®¿EÐYlö4¢e7˜ÃÚ:p"Ä$a©íŒùÔ5šW`Öæ W“„•s¨Wb¶7uêÅpÿŒ©— =tãkôDu=¨s	¯¤ÛÛÃJºiºƒ9ÅÏÙzšß;¥µ‚¡­FþÆë)æÉ™*®E£Î˜Z›#bÙ‚D¤¨Àú<™úÉ²q.ýø¿êéGpFØ±ÒØbƒ\~8À.dCÖ¡ŽÞ#ú›ZV
lÃ28Œy’ñ"øÍ?ÿï¨aöÌ>Yýœ¬˜]2¦ÿ»„}¢ÿ‡ôŸCú¿mþPW×ÉÀ¿ò®ÃÙè¨ 1ƒòµ&þa^s1Ø }Òõû }^±çÖùó03Óó„N¦ýrúyuÝ|#|Üˆ†­íNúÕxïŽý^X¼sÏ~'¬ÞùÂ~ç6»u{Û~ë¿õÜj¸óÞåa> üŒä™í©/ÿ¦kdimÇ.›Wˆ°„ìS¦¼×QÝ¦=¼êßÞ!ªð#äKFèµmdHùOçVB—î·w’øž¬
ß,(<	Ø‹~ýåI¼>â×÷«ˆóÀ|ÉìÏ¶6[?¯šg§÷•áÅ|=`\d‰ß,‘…\ŒPhÒ¾K«*ÓË`°ôrX¿áXÚ|ÖÈ™}â‹lµêùØöVÃ¥ <[`þœ¥ý˜C¶¸²`¯o‘éÙåo$³hzª™7døÆCP\L<]OÞŒž"Ç»t28†‡zF[æS<»øÛ7>VtÚŽŸìº'>¨_âÞàp2Už¿Íá%G¬¸ò®N4M^*åaÁ¦ÊÆ@ ]'½,t$¥~¤ùÎçÅËÆ 4¦"I¦W­‘ßÿ¥ÄýÐWÄy„£5¢ Ð ¥^õb0Ñ¶µ·b;¼Õ¾ä¼#/';î™C¢‚‘ßÀü"ÔkoÓÍßáÐÕÎT7#­HSŸˆ–À‘È1sV£XþÎúE‚=µË
á‹` 1Cùð—­íí­­ÖÏòá/æÖÎVãç]²éçFIëñNÒ“,oÚ»eaK‹’éÀî¸(o†ïcC.·.vRu:ƒèÔ§î4ük$›Ån2gwgªó>ùx‡µo5S¿_Ã¸>>3ÏÜØñ'ÿ8ø?ø“A}ZQ0ouëÒ{¬÷X{OÚØDSÄ_@ý(4Š¦t=³ÕÉJ8@:Ì.–ùžÁWX®	+Ä¬-z‡ëÙŒÇ"} v“!ÃhüÁbçf—ƒ®)_tÉPµ\aïYÉiŠ£ú‹"Os–¦>?ûü¾Ïz~âªjàÚTûTs`_‹Ð	ˆ·*v$™yñŒ¥
€àƒ¹‘Òábã2FÍ,§7T{µ@…&F¾îó3­”Í I˜´LÆUêã½‹L`—:ÆÀ‘ò¸22’P ÀYÙfñõ¤R^kWÜìÞ'TÕÚ ÛüÌFµÕ‹^óè¨¾ÊÝ+©¿€.;ýüé{ŒfO½8ñ;“Y-gÇs>oX'«hm®­“­Æù²s?ýüŽe·gh€qŸo?ýú-þrE¯U¶²(ž¸ö–/W–5%.ä¯¥i®e±„Þœ‡JøY$­°lÑ~Uà„©ŽÉÛ1ê|r=
tÅ¦£h=ü’Ñ×äÅ8Uëi—ìT,< ^¾ˆžK€r¡ì*?+ÉÄ2ˆš[/Š‘0š†—ÕYîFí&Œä:Ï—‡•ps…˜ÒnÃI‹KGu—BEd¡P~xþÃ·XÙo)œÇÀýèOKá:VuÏ~¬ÀtR°ôa8.n¦ÑADvÖŒ&‰ä4I!¡0!0Ø8Í<eˆY
}Ä¢Pw¸£bêjD5åG?
ŽÁ(ÕÃs¾å‰cÌW5ŽÉæ-àö\u&°(Ç^ÃóûÁãI“L øŠGÁìœù€†«ç±e8M@µuùž8.ý¨'¶3_ÕØ®h.zÞ°æ/føgz£I„æûÃsmdx®ÂÁòÙôp·y´ó\°i0¨h¸>>û3oàÍ¼‡gSWŽ¨È2ŠÉ™¾:+ÎdM(:v(PŒu©É-ÕNx…HUç0æðnF:Œ*½4åJO‰¡*8•0ò‘y•¶èVZ¯úf›Yi8‡8avUÙÌDÛð?iUyCU7X%ËÒI¢™2÷y©âGåqYÈ ÜN£¤,wú%’éyRÛêDu}]çíÿ  ÿÿì]ÝrÛHv¾ß§h+S#jG¤(ÉöŒISIöj×ú‰¤™ÝÉd2†HˆÄ$¸ hK£Õ¤*{™Tn67©ÊUr›çÉd!çôÐ º¤iY¬š±MF÷9§ÏÏwÎaŸÊ®˜êâKÝ•í‡ç…Ü6ŒCêug)mß‰Ý^ÞV%tƒ}àv½ñ@¶U×§³U+ø°ÓC¯²ûºß.Îî½r±ø`Í{7¿íêÑé*›õ{¥ÐÃ`´÷ô]öqNŸÊöœ~óÑ2Z7¸ší6-†õÇ°tíÝäÿ±ùtH©™ìØê«#Åg„ÁûfZ'¨ãÆ¼öº‰)ˆoŸ$DU;9UÈ~Ë¥õ„—íôÚ
{„ÝÃWÀëÛ§D×$oØ|ßl×³rVå%…5¹Ù Ï–?›Œo,üiY^¹/˜ÅÔ1aL¦¼ê1KÓÙäeÆE•ßÒvà2>óïÎ÷a.¾{UÍ^åÅÅßäÀl÷[[	¶½¢ýâ}çîi»âm>gé¸¢·çíÓð;šÌTÅ>žUÐµ@wEP¢Àø2™ÃìóÏUõŠž mk2tRtè‹gmÊJiÖ«J©}MdN2ÚÏ;m§=©ÒÀuæÁ˜†ý†O·LûT°Iæþ¥µ#ø2 1è Ð*ß·ä¦\!xS|ÓALwKÄi‡A8px“²žµžKËLð~té“ÔªÈãØ"íÖWÏð/: UÆéz=Lf÷o	¨p“»	ˆ,Ø±(]¿EÑÞ<ÆÒZ®óúTÆJQªûRH¯Å+”^Rr¾—¶9…¹¡Sá…Z
$~ñ;û®©´_jóôäõ÷dïüp¼<=§ðý½óƒ¹aªm[T)b­K“ð’”ÿ(Ö›êNýfÔ	)$´—üÇ°wKÄëî,%%Gh>è²B·16BU:I±—.þyÛüJ“!]HV¦E?1$ªâ¢ävª(½“¤0Sfïˆï
‰ÒŸnJ$DçFËˆUB´fÐlâ3”ŽX Ds¦²6zE3˜>¥Ù8Ta$ëÔgý°++™Q‰ÌS¤Ožl¬èC&OšN\’D\–:\ž0\–&\–\šlNV¤ÿVKú-¦új­F]Z¯Hæjg©¼¦,Þ\ÒÕæs‘tõÕÄIWIs™œ¹	ÝÒ&ç¦,»¬+rºÎÛ¦7Œ@qm²"Y#à¾fñ{»>ç•³´´™Y‹–5Ë,uÖ•RñQ)<óÉ¨ª#‹j¢Ì)ÛÌüùfHÕšUg&TÝÙOU2žjÍršUfS³ò˜äÄ?³0Ý¬¥@i¢R%0—„¤Þº<Ù¨Òk×—TTS"Q=ÉC†J‘)ŠÄ çpBn´*1¨¾d Ùye¬‰¼4¡§×‘¸S&«–-öªœªgš|£?(Ë²ožÖž}3{r-Í¦©D®udÍ<<rýh3_fO~v™,³Í^©Dáµe©<<2ŸG¦IZœ~1rNfÏ!V9$3É±‚,d~ˆeNÈÜò@ªä~Ì7ßcêÒ¼‹rE–ù6V}©PZÅ¶Òi0]ÆF¦‡)Dá'wœX Œà/ç•<QÇ=±}ñbf6x‡¸U²!ÊÙóYÿ
)¾úUÒ’ªæ4,ø~Xç+,
+Ø&),€óÎ"Ñ zrÁ
>HÁT‰%ë\5A ¾¤€Z*‚ÿ+é  òŸ°¿
˜¿ ?í?µ¸´Ppþ´Z€÷`ûG°})Zì‹9›“¼Ñó\?wU§Ô®†k¦¡ü:7§ì€ö°òÓëkîv}é;„¬gñÙF¢¡3ŠúAM‚3O€l¨4h¾€¥Ä`$ý‹·hR€p‡¼™åo¦KœqTô;KØà(s|ÝýÐjµ8|•Àß¼®¯ÏhÃÌ)xLÑ0kbŒð¤aÅ <6Øˆ6ã‚ËPÁfL°\‚6¡Xà*Hà<X£Jª1ÀL9öñg {Ýƒäüš¼¡$Ÿ…ƒœäã— Œg€/®ÜÔÁ²“CnîEqY$¬/@xvð`8XÕ†{(àé1À €K­¿¹£kÄþÖ‡ü­÷kú­óûˆøâWÏM&U[£h«ÕìÊ8ß
œ>Œï”ïZ†î­ð²u!{kÁõÖêµÆô–„E?<o]hÞx–l[‚á­@ÉÓãw§ì×Ö·ê—Ñî'‚Ú%a– u+æôHÝ‡C˜)>w–„fƒË%*·%×„È}8äüéápgÉ	øÛ o§F!~ä­îvN¨[{Ìí<·SâmKÐ¶¥ñ[+¤í¬Qïdû¢àkÎáPX LíBÂ+ jËÃ»lì±´‹´FÒ.ðªÛch’ô«!hx,±³‹BúvÈÙè(+ÅËVEËÎ+û²Sàd«[#[B¶F|l%tlíñƒ#cçƒ‹µGÅÖ€‰µFÄZãa«£a§	Ô€ƒ}DÁ>¢`«T|xÄÀª–h^JK‰³Y…{U>\ñefò@¦ªÉ{ßž\’óÃýÃ£³Kr|z°÷Z†±F®ïvb·‹}ÏÝŽëb3žõÚ»®OaWÏ,}#8YÄxè¡IråCÄ‘8Co€ræÚéºp‘±p²Ù¡,Ãë8VaàÜÀ	§ž&Æ¼qãç [£æsJpÇmÞê-VïÌ#¼²€«æ¦˜ã•<ÙÂ1«¶SrqLÊ·°f9×8þO+¾–vUÛLC>8è=H™[*sø/ê€cVÊÈ®®Œ@1ÌâÛ‘8xf8±’ðZc~Á^¬âg5Ÿ\ã8Pxƒá¾ïuÞîÜ5h}d ×‹âÈ§
–Ì¿hòr}¤¢­tÉ©~¶Ñæ?‰/ž¶	ëz(H’#¬È0òb&Üƒ$›ø]ŽêÜþCäð”ô:‹ÊÉö[‘Ý×®”®AiäLû4®"»Œ’Ò¹ÕF°rê?l¶)á oÂ¿ž±%zÛtÆqPäoÐ+îsvv”Ä²?ZZ¼Ëñã¥Ù+TGùX¥r$))68¸úž-ê¾Kzv±¤oè^»aè†g&Â5‚¦ø*ñšrÿìe‘@5nR»¡¸–Nñeû0—	–„èÙ}~}ó3£¼á@ïê¸µˆ¾XëBÇþ}k4ì™Ùˆ2M¢Çq¥£ù¢-	Eawm$ûqÃu ›HæÂ"ÁŠn¥•ùó€¯ƒ›r¯Ïnr×KÏwÕÎ—í5gîRã»²ÂOqàæå¡íºW]Ý}?ˆÜÉ$}.ÐáÁÑ%¹<ýöüd*MEe©¼?ìz1²ÇA×ñg«*µ]U*QŽP‘Ri>¤\kR#ÊÅëÀ7ü¯*ÑÖß(œß˜ySIeÒUDz)B@d˜ûÓ»${ïÀ…ãÃ
4Þß˜†ùóÛ þŽ	5Þ%åbTµ'Ù‰õ««5téf¦ÖdTû¼Â!Îõ/Ûïú?Újç¾såúšÐÁMÄh.r^–îLŠ2&¥¡“dw¿ïF°ÌQß‘K/ö]òëí5ú@ÅD¼áh«œ_ñíˆoªÒ7Æt.§f(®âê;Ã\ÚpyJ75ÜXó=7nÑ•ù™¦"‡Ÿ3
ù$é¡ç
M€Hø:èŒ£­`SÍ›d_‰n”ÿ
sQÐ—Ê¸˜ûžçÇóØfúœÊûLïz¨]Úž)ï7*³ÊfH#4ùé oô„b"A,]GlÊ‘>Lã‚7ÑÞfC.‹D0J¿.1ýìþ!vsÝ{xà„ÛÏï|¸° ‡Æ¹Ûó"ø‰êdÔR*£²cDK9ÚŸL¬¥(Gy¨ÇÌœuÈÀéôÉ¹tÙÇ}QÂ8õ”ñ¨Ê!n|x4`ãÇ£. z”ÈFVâm-8üŠ–ËŒíE½ÏGë6Ï™â@äy3R¹}‰åiá0r†×·2"mVÈ‰n‡ÒP¶ZÄb•žÈ6”hTù§?‘'¥[õÊ;Õ÷ü Uý$X„ÿ¦ƒDÁ¯½žG½Æò™ïR7ˆ<â‰„îÇ^ˆ™¬ðÀò*YvÃ0‹]!Ù‡…7•‘MoRÀÐx„ÇI—ìÀ¿#7¦;Ñj\Oµ: @_xÏQ—|M´ÐúV«ÕÑbáÑ»²E;£jšˆŸw¸IéòžénÁ×KïÀÓ]é²M/æ;¬»>TŒéÝÊƒÉÙðX¦«˜ÖJAO:XŽ¢”7Þ“-ÒQü¢¤ç½ãÅ$rð'º.â tznƒ„ò&ƒR].Ó·äL$;7ŠðX¸¥Ä¼UQ¶"Ï¡L¾‰`D"·n]]IØ82	PÅ\v+GØ!YtÖìú>?|yx~xHöö÷OÑï}ytzB/÷Ž^_áH3 kìu:ç¿rÝGG¸¼¸¢¿¡µR¤ESÏíñ‘;£3oXÝK ¨msáÆHv5;ÉóÄ<*`a}äÝ‡­FYiC¡:8LñjqåºŠ
ŠaÞM0k¹LÂhœÞ¥O cŠæÒÒnQjµÛOXŽ½ÝøJÄK’Æª|Æ0ô:8‹íz*KFÍÀt—v_ÝÍ»ˆxõxFQ
.hÔz›ÑÆƒªNèä¬jpV±Šx
ü¨ùÖŸÍ¾±ü½-—úœîÞ¤† "rÒ(?@Œj¿€(Ðg ºòü ßAs5AX$­|6vá`m#I(ü+öô_¨ž$œôCnÑ!S+Z2Ÿu6z0u7o5Òò¯ùóA{çÂ2á¨¢5G›-M=IÁ+”P”3¸‚G’ZOH*ýî)'+öÍ‚ÓÕ¿““€’–ÒìÂõ¯›{aˆŠ5Ònf%ò2ù‚«–ÖI4ØÊKÉ¢§Ú1;«cá7Aƒž…Á;Aœç6Z)BXp8FÚQ³àÀî,µÕ¿InF j:-œ‹š!u~FùN»­õaÅÜpçŽˆîK×Z¼8êO}ï§.øÓH¬ÒàµÄÇšvìâ-`VË1hÓ%·Õk‘¥š‚'@u8Aíb'jMêE1a÷„R	®	® ¡‹A¼ˆˆ¥h©õ4}tîCóÌ~ßí¼mžŽy¼vþ¸†e¨&kÁô¹°y4S•/ä›keø'ôÎX3Cæ.‰ÖŸ‘ÓNLë[púœ¯<pæ ÒY‹½KøR‘¡ëv#L¯¡+D`:øcqÍ¬ÍÏqq¤q
jœ”®þÈÙÆÁÐu‹ï£»M…d9‡?Ou¡eø]6Ü"ó
#dv°¾…¤Ký}t%†«ä<äi{£E˜ñ†0²¾÷)áo Í·TT6-ÁW&u HLÔ¤¿'¤Š¦ÛYÖ`Šºè½ò#dŒEh™p =?¸r|âsƒ¡Ëv@Å‹Kê¯‚ ç»äØEä5ìPIHVå §ÇÂ8,¸‘ð“¥l|
>¤"i‹Û*Óv?ŽGÑÖÚÚ h9£Q«­ž¿ÖjµHñs®Axž^‰?Ï‚¨iÕízäø4}æDèì»DÞ{_$
è÷Bºcê¤ëDž4ÎÊ,÷]¦ˆ\ñUÁó÷2b+×ôœâÐfƒ¼‡íR[._YÓÕþÆ¥¥Êº‰ÍDvHÞ qj´y–1]—©óüu+ Â%6‘:Î,?R¨£éeU
ŽKcå±AN:Øüƒñ›ªÛû€D*¸uuUGV^¶²Ž«{¸&‘ÜÊÿ]‚Î!$v2†ø¢d¾Ø aãoå7Ýx§¼+[¹½SßXh=Â_&	óÅ¾^z bÄA˜ù/˜‚òËµ5²çƒe# ‚«\â¢Þ9Æþ?Þ5ŠÚ[âÞx‘Úãuf|×u8]½þi¢Ûÿè4Ùkþ}»ùâGšñ¶¼ÒŠƒ×Á{7Ü½ ¡yö:6:<*7Ù|·á S;UÊðì%43@\‹ô|}åÂžñ	6ôuî­Ò¡u¤5KÕÂT5±Õ4Œ51ka…€*uÔ>	]‘µÊ¸¶­Z<Ñ-ð£?À•°"Ðƒ°WŒ?õ!› BRäRcé%Ì¦'œî¨¦¾µ´JpLõ$å7OÇCòc›"2Ê°RÅe6£L¬ %J-Æ„2áNy}ž«Eô™âP2ê÷fCÐðeÌž^Ÿ!+g
ôÊþéÞþoÈáö_“óÃWG—çÀ¢Ìà¤˜ØÃÐ¼’NÛfn³²dº¾SâkB¹<½IÚ_`â›}1ó¨ãøns<ZpŒ¾¾•2‘Þ×RÜdb˜rx±Ì–Ð‹6Ô•¶¶Y™ŒêX™ªI*u`€4µÂ(w‘}÷cÿ<ˆp£ T©T*ý^eW¯+ìêoh—7†—Ä~ É£Y;ÇB‰Åd)åzº>?•½ª¹/-±HªÓã!s2Ë€ˆÄã¯;£JÂk	ÙøáGãÅß9¾ÇDõ!žhšëÍØ€D]tÂÀ÷+ß­„ŽÊçOâówäþIŸ»#²¾E.ÝÁ«­‘¤"DþÑ&‘¯¬ÈB¹pKV~Gƒ-QßR#cY›5¸® u¹âmý§–h°ª DF0w,PœF@™ªu”ˆYü¬·È·sÈÜ‚¤ð:\ä‰]T‹¸§Sˆ¸¤ v-DóbÉ{ãtÙÜháµž;tCª«³™^ƒRÊ(žêí{/îÃyP8êå5£1èH‡´/í*ÙëÁ{Ø‘tîU‚Vl˜ÐR† “Wð3öûcC$ÉåF¤7v@Ä.ü•jÍÍktºÈ ÷'ÊE«ïÕb~9ª{×wÅÑ…;f—[¼ðž1¹tÔ'²Œë)©Ž}VIñ©ðH¡A5`‚¨ôe¬8°ËjÑE¨¤ÊªålH¾ M"Ð­?ºYÑUÖú;•Q›DdnlÑ’9„kKß7Sˆ$¥.7ƒ,‡6Zb®¨_`ÙBÁŠ¬ô%°’“’÷ªb±Ï’”ÈîY¾†×s™ºè›pBJZ›b?¿¼VÏ'U†S@é¢Æ)€1îŽâ%J«ÿÐ‚ðxHŠqmª±e,özÄræÍZEÝ¨vI1"ü¨é]G\ªnÞºs¨Øa»É®‹{rÏà¤Å¬¹ÂÚ“OtóšŒ˜…¶ŽeYÓ-/êÚÂ¿ÛH¡—xW6Jèíúêš¦ÚìÖpqþå>F»¡Ó“O¾¾ºÌE„´d¨jÄ´6L,œ¬†]'ìR¿Áà_@5áŽuá^2OËÙG>†úz¯ÚuÔˆö¸D¬nn	¡„uccv»t4„£zÜ¡é{
a{çìŽ–ï{ W £¹­n@­Ði‘îsF²ÑªŠYVpÝ¦1%(yÚÔZ§èÌ–ÚŽ(Þ6Í^æÒ÷hIVq‡ðwÄp‹·Áò[Ú5ÕéÖ·?¹&"=OLó$ÐþEzC´Vc`kÕYKÕòKÐ«Æ,,ðKäZ0ð~qÉ-ê² VÈÜ³JÜ!Ø>L¿öBØú½`ªˆý ¬Ï—5Ö¸„ýoI¿4è°µ•z°	Ó‰[äØ‹ð
œŽ7|‡F2ÃTD .Ãrvœ1·Ð†B¥]VNqÅø è­DÔmÙ*¶xáA·€~J¤°<gÌ`Õ&kÔ¥ßŽòéÌÖ\P›ê%¢l#£Š£.0œÊäs _ØÝ£áu`ÎãŒÂ†âËzwÈÈ‡eI^2ï,Ò[¶}ow„ö)W¹6ä©¾DÅß±’»gtRü­'±"e¤ž¨èx^=Ïfmu2^:†3~	)ué¥; oÀ?–_/¯-Ÿ-c´.pnWjœÅÉùÑ>>3‡ñÔËÌ‡þ8äx^éôÆ¡‚Â¬fZ,T<SjœÛÂ|ã…púÈÓÚcÃÁ²½¢¿Ñ Qã{ø4›u®Ï9º å‡ÓX%û}à‘È]êîzÎp×ç5È¬¦ÿ3>{m¬Ä—êXï‹–]Èûþøj‘yŸºC2[+%Ÿ#¤æU2côKoiüÏé°´	fNajfÖ+Í,ŠÖÏ``40 ¹"\Ô5’-úxXñ}Íâ]îªñ¹²#IÃ³¬3†„)¥Ôøð‹N?òœï\ƒJàQ÷w”¹D4¨}û¼<O2‰SxzÇs@ÙeÐú=Ä¯’o¾Ùk·×7ê”[{éËRF\£™ n2!5cà9ËkSÊ
Ž/œ?[ä øŒúU‚Å ©à‹b
mÄúDíMý†°åx!ÂPh£ 
6¿ê"²Šù”žÅ‡¶Y £õÄß;!šs˜3Ë)¿3•òQa-íV°•Ð<Àþ,{‰ÛÔÝ¨1™Ð[(vÎÊx²Š“&îw‹–*8I8”ºë÷|7Œ÷½°ãç &‡¤pIžƒrž®µØ™†qîµþJ!™}ø¶°%_¶±:×†üÖ—c“„!CE$_¶‡Àí‘ËnëSÀ<Æp„õAxáŸN†n'FÙ5@}šU’IEMæ!N©"VF
ƒÀ¹Ÿ„á!ät+þ"hr½?ŸÆ‹f£°€Â‚V‰GÃ§º]I‡®;ï>ºKžÎ7Æ¤¨[ôeOíÔZGvT·K„´bPäL½[v2ˆC\ß»ÊVtÓAEèZôKtÑõK2h+J ÿô"“#ÎB÷ç¾¯æN²CU›»è¤UN¦2‘HÄ
ò ‚XÈ†~Ýî…Êq¡ºÈ“Îé£àYÄ¥¯¢o­-ÍŒ12Æ>9æÑ¯ˆ°[Tz¦y§anA‰tãvÊ
NYmÄ^PŒ,Òõ`J°ƒP„‘èBn8,:¸ò+A¤,Ø*mö’uâe­¿ŠH dzYÐÄæÒîßl¯Åýª7%N—InÍˆ«ßIk„ös­~7µ'¹1±Ä&¹Y6§Ì÷Ã¯¡^6RÖv| ëIÏÎŸùÜ'` •À¢gûNöîñlgsùñÞ½ÉðEŒhÃeÝ-ãnn%%]ƒÇ’/È:œ¸±Mƒçù<O€hÕÇ.yÓ¢8§íJ:‹,åÓù~–4ËfE˜×q™¹wú‘çu!¾C?+<å«7ÚË¼NHRÒf=_Â&{·Túf¹¤!=û¤m¾ËVÈ¦{ó$Û®’°¦³>
+lžØÁ„§ÂyŒMá§Ìè(Ð¥
U'9Úçïu_Ú½T<SwèË¥¯hé*Ó¢“I{dÛÌfòÅNÙ–7ÖÎr™è):Í^æ†=,ëUœ¿Ùgd[¥›có:=Ÿß‡B^çT¡
MÝn•’º*T|Ö7M×àÌ&C™©rT°0ƒ¦œ…Ÿ=Ë)7†à´¾%—Dg¹)+vT3g‰0×Ì+7N€bºîgjxXþ2•í¦­¦¤d—³€lO Ú®Û®
ÜVB·­Iof	ÒÖ$§†(*³§õ3Õ¶w½Å\w§äç½„¥:€y¤)· ‹Šý`xí…ƒ”^ØÍæ=»{c›2öL±³S%I¸—Ïª/jˆ|÷4Aßƒ¸éàôÝ.Õÿ²´±¬*ø¦"Š»Â³Ô¦Ã¶Ö¢9w¯C7êï¿WAÃ“œ§‘7Ôz…pKfÑjµLšä¶rÌ’¯:wšZÅA.¦Ê)'èHÇ¸öUTM¯¨_ãWÕËZKM{ztBöOO^ó1°
¶p™€3ªoý˜ø·H‰“É®!ñ¯rGq%÷)"·µô	ÛÑ$ÄØçü©jéÈ¨±ïú´»x×»¦°Õ˜•Î¡€U;á`ý´9eódøm*MkŠçù^Û‡³”M¹ÝTA„õøà*ÝûLq]æG$•vÓT’¥]‰1hcCXB±È±)skhµAŒž<],bä7¢Ô«Ømt«¥c’ù'Ac¿£MTîÕˆb]:s×ÐZ¬<ŠÃ
Ì 4Ê8rÃ¯+Ü¤´¼hg >ÇÞ?‡ 0P]ÌÖ¨}¦\‰YQì÷8w#sŸ¼æÕì5“/÷À¥ç#SñL}¤€¯c+L'$æƒvÆÒI'µb5Õ@ÍN]­R•½Ò(ôÅ-5¨x'q6cä”5žm¼
Èç°Ý”
AùÝñ
ùµ‚W'«R¨¯÷\¬‰¹þLYü™W4ä²F¼€mEÃßfo[àör*T¨j=ð¼|‰7~›¼H¡U¦±À9~gL³<<ÄY!‹xæ0G®ìÒEiÆ¡7ÊPÙJŠ*x0&…–r²Äj],y*—J\#¿w~A„³	è£¸8è¸<½ÃÃD+·ƒÈr)›™µö*&cL]1t“ŒbøŸÊá¼öL¥ëÏÃYÚ6,6GR—­ÞW…«+$Ñ25ðw·A8îy
Pj<½Ý,69Í	IÍ6
Ö]qmˆwrkßohª‹&äh-æ«àFÓ\?^wg	%Xó-['uþ+~è`èu¤x£aÜà’¯0«¦¸KÚú@¦AJƒ¤¢?tëÔ×Öµº ,ºÈ2Qc.ËPº…HªRCÐ¬àa¬­›½‹qS?ø/ƒ0·´¶@¬œ+:r}·›2wñó×¿üÇ?%ÄÞ¸€MÂ—T£ªÆ~Ôjw¥›¯ÆÂñq­1»ÚsUò‘ÆYê²ü©zO»ø”waa­U-Sï±÷[ç¦±¾JŒ«Õ$ë¨´còã°×ÐÇ<ñ£ðÃHž¶ÄþÎ¶0IÈ¿ÔX¤Æ4˜®•)¾ÛÔo‡¡S¿¢ÜÜL5D‰÷X@ÀMª,íÞ×û¾[ ˜7¡4ŒÔñÅ¦Ž/&¦8Ø€ÖègA0ˆ÷Q7PÝ`ÄÖiÝ€¯ðtº4ÈƒÓÄÒÎT7øßýïÿûŸ?'äÞÀz
ÑÌUƒüÞšªL¼&Õ ³ZªæŠúTi½C5	¥ d¨ãQ5Pÿ^§jðR—Ñ¥ã¾}»Á£’ þ$JÂ;¶b(	|­§S¤Aœ’ –vÆ„þ/Ù7¾;Ÿ¹¦'€OSS)Ø¤)dVëQSÐ\QŸ¦ ­÷bh
2¡4…u<j
êß'Òl¿®?²Å8‚‰ðß1Á0] EQhÂ«òECM·´&È0ÛÀô6S\’tãâOÚXÄøS¶i«2MèIÙU^èVwp.2odß\^¯¿‹jÅ{ÿ¬xË.óR|Z•Émîû]Ì4Þ”2Sa‡¿<kÏ¨¼RÒÌ¯¼šˆ,»É4TÖVþ##¡û—´s|ãÀÁfŒ—¡óû ;·5t¯÷èº3î‹Z?úš¼9º¦Ö–±~rzI{ÅÎ-B€‚°ç½_°8-ã¥Uz1­yå‚¢ÙÓ—&fKCÓ8(‚ÎÁóã\sç·ƒŸÚ?=kß·Þ(ç³E–YÝ(ŽÒg7“~ê´ÖŸJKl†€Ž¤OóÃò‹c¬d•€Idp
ŸpŠ8Á#lX?«r>å.œÕÀÍ ÿfI]ï"-T;N¹&ÙayéNbt›uêÁÒŸ4x¥„GòÁ¶I[×IMj{¶Äõ`v@8„WžJQ\‚iZK«d‰VZÒ$+2T«ºIšöÍß¢5u2ˆw×Ålá½Úª¡ùúéGÉ¸wÍ£¼Ó’1ýÌ£ÄAìø‹wQM^ô‹t¶_$T¶2ÅÝUŽ¶½SioU6Nj×°—m´if´ÝŠ»|÷ƒ1È­a R¦/PŠ¬Ñ¬xU8Ó°}íZÖÈwè¾?w¯-ßòÉêšL
! šRZ¶ÅUé)º[ß¦Ü¾•0‹îâQÊÔ[	;é.~—òîVÂpº‹ƒ,«m)ÙYw³×Ý"o>Ë¤HxÝûŸ>K í¥„}ÿF76j8GÝdMùàÚ«C{îÅ[H%7Ž.N…ÇJ­6OÐª—š>ƒ}ŸÎ¼‘¸þò=Z7éZ2xA=)môùæBjbJ—ÓÅ*7…\—'o€aƒ·jnª_)>J,[·(ÕQ&\>’.¥•U9U&´9¯Iä.~Nr¤F+}pŠåÃ“×{ç¯ÈÙoN/O‹)ÉîÐÇÀZ÷LŸàÛÐWä%KÏ5¤(ƒYÙþ±R–ò‹ò,ey+Œµ1°bEîMT|™¿_¥xD¤…ÄèÌpÒr$mÐ~À”¬›[–0mÈ‰fIÔiûÔ¯žau&U:K¨éú°@ªÛ99:ƒÕuzÌ”±¡r–³“îF0M±üùKs][±fÒ”6ûVe÷
{¨Ø­´ýQ"jDmÕ¯¸¨ai±UŸeS²Y±ÅDôà.a5àÊ¦ŽüYù+ãfSzZO©‘ÖŸ,åä¡±ÖmoÐ+Evv
Rç¾xãÇ¹ëhõtÌÃD@Føõ’âæ\ù`©0pÒ—”“‚«Ÿ1„.ê Ëµ5ÃQÝ:tÃ³ èùvgi4ÅWù‹×ªm…â‘rU= ©:AÌ«$»ß!‚ÖŒæÖ(n~…]žâÙ™	‰’„Ï¯ £Hr,
0Žo[6+ÖdÒô3øÑU¥äkN±k­/§XF€1)›~¯Zø¨¸ö*'œºjTaW3²Õþx>8|}xyHÎN^‰²!šÞâ¨=_.VØýÐÅCfQ/ˆÁ¶DÈ’ùìaœ{Öe?ŠÒnúºUY!ä2t¢ì3ýeyé{¥.zî`¥³UÌ4.VÏ¨Pšâ\ºæÚ¨¯«SL}ØêjÙ«0¤(-@ñ¾¹ŽÍÚÖ7²PÂž\à^ÛÁºƒc†L,	ì9Lë¹reT•LT…=ù$ŒRû›…Rø)Ñò	½,íî…4!˜Ðnm4täÑJºLRf©ük ëÍâ#E	Ý>Ì¯"‡­˜iñ^y½!MñE‡_^¯z‚±o‡ýÆí.¯È…åÕÃÔÍ(éŸB>XYÚÿ‡’ÒŸ6³X¸æ¦esg‘K=ŸÕ¸'â+áºlDRº¶ˆ°%Í¼h›ix—FÚð„Â]¦rÞ9k«.| £ ð­Ûâé*¡ö¤RØ”KLÇ•JÞ*¤"¸K+Êyä´§“­¬
î¤	zˆëó®Ø>Zš¨Ü9è#ùÎ-v#û·ÖÔ–P|U"Ú4€XñzŒ *Ò½q;`0•—´!s¼yIù‰õ¼³²¿lgLìEðç©;³Cï@u¼ÌÎ™—|¹ò·¿ºÿÕÿ  ÿÿ jÔr