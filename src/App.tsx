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
                                          <img src={p.photo} alt={p.name} className="w-full h-full object-cover" />
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
                      xœì}ÝVãHšàý>E›˜.llY™LBÈ,¦øk «º7O-È–°Õ)KnI\4°gÎœ³·³—s½×û4ûóû}!)$E„BÆäO5:§*±
…"¾ÿ_B	üÝÐœÅVoÞ5œ%²¹EîþÑ\NË¶bë<´üèÊ	[‘ïÂçÆbìÜÆ+cÏrýÅerå:žÝrí¥ª3—suåôãmÏn›l’ÅQpí,VMÑŸ„¡ãÇçV8pâVß³¢èÀâ–eÛÅ`lõÝxÚ\k/j×r¯ù‘mÒžoo‘jM¡ƒ¯4×e_;¡ñºÆ¡sëÚu®¬‰7*G»·¡ëš8mö—mECÇN?Ï^÷ƒÏ=þiþL|Û±›Þ ?a‚‡îÀc];s;š¯ã­‚ñg?ÓÏº„ô?Š‰ç7pì}D÷5H(KÅœîid3>.LÿÝæfF•*ö”¡åÛžsvcßá=Q6«1mÓ°öøé‰Y#gsa7WáyaoÀŸmÙpšÓf§µNzAh;!ÿ§ã®-<X›O†p”áœÐÍÐ•u’ ˆ‚°9­±ú±{íl_õà”	ÎÝÀoZžGìIhÑõö‚ré[š—zm»×â›]yÎ-ùë$ŠÝ«i³çÄ7ŽãXé(jöáœpA7›b>ñ~¾W·t¯F®ß¼i¶+æ„Yß‡îøg'ŒÝ¾å‰ÓßÀ9á?Å&ýŸíŽ r{C>ÁcÈJåƒ`u¾ø :çÇNg|û+¹
ü¸ÙÌÊG&ã±ö­ÈÁ£éBL¼qmü4ñûVì‘u¯ø¦XØºcPêÃä÷¯Wðiû¹Z1¤°æ»K¶è—¸æl}ÂêÅ•®?ã‹ºv#·ç9ä¡¨D$°ÉÿÔ³ìÅûËûª,Ïõ3û“Î´ëxNTK‡gøÒUÃ·¥.`ç ±åôÁàMgÐÆ_š7¡5®îÊ9ó$Ås}'!ÉÉÈeÍ¡kÛð@Y Ö+Ÿ	OíMâ8ð+ÇOÇ°*6\Md²Ëv#Î„2×¾%›@ßÛúãfWàïxnÿ°WÊ]¥?„÷£”¾sÿšŒ—L&i5Âá€?YÝF"ê­¶³ïÆ‹Þ¤Œ;júì4C¦Wˆ½•®ÞvBþßÿú?Õ‡³Â¶ûë:F+[žãâ!i’ÎÜÎÔnüßÁ©þß¹j5qÃënådÛsþe‹3 ¬ý8ÉWªvòîãâÐ±€’PpÄþ	ÿí{“þkÅC$ÕûTÂ9±…2 þý·°ØÎâ¯-×‡±À@™ø’]£z"ºVƒM½¶¼	ð36¿…ïJþþw’>e²ä4žsS6Ãè¦PŒ\2E…A)û’Â)Ýåô©Ë ÇLF§ë#VD,Z€¡Ö‘öDÉxÚlOÉ€žÊWAm“oc`Í¾â³!f˜`zìÆ¬ˆ¾&Ùó¨ù`Åë`Œâ)?È<Ÿ…­¶¯WØ3Ì“H¢;ž)tCXÒiÝ‰@B¡@\5 ¢6~F$4dD‰:(]@jJÏÜßä1AÕw|¾¹`ë×Š¯)ÆâÛ|]“»LÎ±„·ÑÂÖŸÏê XiŠh´°uvø )z ¿,lî>ho ¤çýƒ¦¸õ`74EçèþùAs¬â«µæÈè•ÉàmÏBk‘h&•X1fš>Çˆ„¨ä x'ð‚*»Bº6×OÌM"òöéô†·ä¨½S"rp‚¿ä ô»üuJ¹QHùÃ½PNÉ¢DŸŽ°Ú–ÓoSIæ»kÛïV0eðª¦‘t»•ÒøAy+œíþ?±g]M<O‚m†‹å%vÜl“Ï76š7Nï“7é)4£+î©F=vÂ_7t£~M(*¥±©ùÇèÅ*MDìRŠ^¦v¢Qày³”`‹ñ €Ð ƒëKmB_´™Ø¦øNT[¨Œ‡U Ÿ‰bd¦×Q†¥Jìy0xŸ¨}Ëõ@ëÌ„°*$­u@!»	}”È™Ý.gkäfàÅžUYÎ	ÉæNöMfùCBÿ¬$æmú¡ÛÎÌÙø¹@d0í†`^$ÔWÓOâÌô˜ºbæûKýž×·[î:EŠm»Ú^Y­ØWÀ¿ög…Gã^
fŠ™ä¸#,ˆ¶†ST•WOFþ9	‘;‘áÛæ;×vþÉ2r€²¸v›’=¢(\xƒ |M¤6Í¢IxeõS¢	“L¾7_2y„Za
¹q7çt˜6_ 7°là5ÑˆÀ€þ§)‰ƒqóEIú(.óFdhÍ^Ž¥­·É¸‡¡|'r>r©Ð>3Ü‡yîÂ-nû®¡Ÿì~ãÌœ·™"IÞZöÀYRwS{%q~P«[âhìPU§ËÄ¼ŽN ÃWÛ[è&Ï	:TÉžOítòUÉár—ìlŸî’÷§Û'?îï“Ó½Ÿ÷÷~!;ÇGçÛûG{§[˜R´åçË½5«kè­]q2sócg¥ÓZûµ"W^¶K¢6¼!«¸s!È  Í8höBr£æÇ?tºÝNgçW€JøÐÞî¬vÚ°ßY±Ó¼A äm	Ý1áN0ûÙ±BûíàCè©l¯å”¦¸;V/t°qýÈA?çoð,½ïIÿ``¨4iþîŽô @tŸöGÖÀÙ —“Ðk<S,ï~é’Üß«D.ÓÕô<x(Ê•#÷>8¾ÝM¼Ø{S…Çïµä[	--ïr£¡ôüs·¹3
ƒþ§ÉøÄ³¦°I›
—¶k#g9ÿ±ùòå«W‹ËÒ1(ßÁ¨Ã?nnï’íÃýÓŠÁ(ÏÁàŸ>ll“ƒ‡'NÉîéöûã£3ÅÔŽ·Lƒp2pVŒ­c	–7À¾‡³Ã=ÿ<ñ]VõfçÕøðpxƒíƒ=Å˜ÙÊž2ü€7õõOÅp;À—ì¶;íf{­Ùé*†Q«6”	÷2fÊNoÇU<AõèžãÅõ‡6½ÿ‰¬¬·Œì'›~M9•;h¤LjØ>ÅÞáTPN
ó$¦°“[˜·Á_°!·(d1ÑÐ®BÿðôŸ[þÓåÿ®Â¿ËÉküly€ç>’?ÔQ0l#`åÔé‘|ÍîXæwn)ƒÐEÂRA•Rœ.¡/ C:mÝúv8ª«¯ŽcÖtc`pÌº1]6¨ÛÑZåƒÖa\¤“Kz¡OB÷ó#ä¯¨ôeç"»&’|Ëç‘›‡•¼ñ·fäqÆ )ë¸YQæƒ&@"XUÚvî2ào]¹ð’ÆÕU"‡/µà™Z¥¹Â#©Ú¬)ÒnHnc>9ÓÍ6çBN}6_bÔOž¡s~> I®]‹ýß÷ét÷*56ÑíEßˆ¹·@3Iö;ÂðÐÄ¦ºJÝ	©÷#7#PìÌÇÝnâ„ygBõœ‹XÒ«}÷y¡„P4A%AÖgâ]uôJI¦b¯íFc`ªšPÑmh›Ùs“0 ADJ\¤ÂP‹bô‹‹gçÛïÞ5f¿Ç­„ß²Í¥¿ÁOoÈå³;àÔ‘³ïÇ¡oä*ËŒˆ.-“N{‰|OVïÇ·— ÑšÝCÍQ‰Õ(µMe¥ûû-Q¬3Žh’r-áªìDšð>µ–^&È¢çKpF‘4,©å›kYšDXÞa{MÅØ×‡íò'ON©HF¨á•éƒ´ÁÐ¾&C 	pæLŸWÎd°3é¾Ü%û~_ˆßXKôÅtkô€£“¾Å«|Ö,È¡:ºÔðÈ…Ug—!m¯¦—Šé¤”Ýt¶ñ®²¼áeÈ®²]¥³²EçEâJâa%Vu_bèIh¿Bw}¿2†UXí‡æÌ-ýëåxÓÑmÓšÄAˆ)ŸÙÌjn<°"èYöŒWk¨{á‘‘æÈBO€Gý<Qè\ü£!žÐ[j ‰!hW$Ä…S³l>øXp4a¤L67»R¤B º“¡0Ê ÃÕ¯°©ëë	°Õ×cöX„k…Y-"ä‘3rÐgÚ
	6qx2 Eh  Ý0›E‚™ .Þ?“rÁ!Þ‰µêžÐcÞèQÔ=]Ÿ’ïž I1óŒÉä¢4ä o“ø“S¾ñèÄc8:œ?÷ØGÀ§4HâQÑÉÎk`‘¨m&/°PÔªò:UµÄœ$ªå|Y«m2Žq®ÈÆÒ2`ÃÁ¤®•%Ê%[!Òºó¦o|¤†Õ¥ÛÍ.6Ú]–ë<µJÜ2žJ›Ð(^¦gjø¸E=G¦3›SƒZQ%EHhÂCúAÔÿ‡Fî¨Ù¥VÌ®›£ÁîÃMß—«c¨GRÄ0lÊÙ¼À#Èkâ/Úªp‰D®¤LpkÇŠANë §Ê:<rlŒ„T­Î,\öUM+a75xmìú:Îè=µUÎï„ýP˜¿û÷{$\1³ühaëê·ÿVÑGˆ:øý×ÂÖîñÛo}ì ÷8‡ñå´ž¦e¢°ˆ	øl&„6É¦‰¤§áú™›>nšXXm¼™t óüše&©ò¢ aôøÅÊdþŠâDxž..M³Ï©¤r]Rÿâá›.la½IÁ0½Q:’¿"V?»ËCù}IŒf¥mdBõ¬n¦¤à
&—f‘œ……yˆL½‘Â³þtºX~öó{s½Œ§]"#ï76ž1Êå}½ˆíæÝj·Æ-osá°†öÌ3M­pàú›wW–¦mš'ÕÔc¯"T•ÑÔR@¡ýn6ãÎóç‹¶ÂŠ¡ŒßF“ž‡q½¯ÖÛÀ¥¦»¼µ•ê´HŠG½Ùä'jäãœ˜é÷h7=à¢q¿æVÌ²àŒ­’çÐ*‹–IØóãpJN`†ÿò«bz<Y
W8²<AV›å]^9,–	¯n±AÚ­—ëøjg}×â€ØîÀ-Ï›`ñÀÉÝ ŒÎ'
|ßñZ4÷…»Z‹¦’¯P,3öiÜ/5´‰[V.Tž§£™O2“lmŠ”žëË‰4½adó`Ì³R§î6o=`—²àMU•¬¶*QDM3šµõ³M “xËû	BòH™­2V-!Ÿv™`*Æ³Þ:¶”¯Ó¼˜ˆÜ¸žG0Ž£õ-ÏAÌòm‘§-?¶sú²MynD«­ÕÖÈ-é¶:Ýõ…%xÓÀ''»ï —Gc×£ÕÙÌ@z˜˜JÆ [Ä°˜ù€›1DýµÃCÄ‰Õ®éCÇ<}ÈgŸ–ã Ï	PÒ`ÃOÁ8qÚ¨UÞ’2’ª3¼”_ˆE+î‚p`ùð²á¹ÕcÄväê
I¨-LŠÀW0¡vˆ7Ø>2“êK.Ê³pV/§ÏyÁüŸ” “|´w@†kåš­ÕÊ5{!Ë «LÓe‹ÉÐ*øA8ÕÊ“¸{¨ÑZ
ô4ºéÄ›Dù'ŒÇZËWÒ´mÛd”®`DÎ (S• d9DJöŠ[—l÷šlŸcUÕJ^{VÏñªé•i¢Ý;„Oœèõ
YúLu–{ŒÓÉ3¹n¢>IÎ@J¹þ‘Ÿ‰·5Œrû)•Â8áæ‚Óâ’4yëúd»7‘¯Q’YU	‚²“Ûæ*Ê·ÝDë¿Ø­_E™ªô×/3§°“rŽe/t`£)¤S„œr¸ÀÛÌàâ+9dEv`¾&ÊN`õ‡[ô}a”ÂçŽ5"‡–q¸°%~ª5Í©så„ŽÍþ¨uóÏû' þìŸÔº‰èÂý§Ö‡ŽrÌÂÿ£öÍ»ÕÒÝ¨.õ•"è1“s˜À¶Bv¼Iïów|ÒhŒ·ÍJÞÏ-çÓMàÛ€:ˆ•œè×L jPyeñBERîi|—ã»jË}º ‡Ñ ±x* “·,š·ÛÂ*mN¡º66SLµÔDÍbß^ÒÞÎl×¾sCáeƒTd#³|äKf"xv·‚wËnK­88£	›ðgè4š/–î/U	Žliª_Y>snaþˆ ;°%å´4·9‡1f7º}LVýÊ’‰V¶•#ÒfÝ >ò¥y¾¶r O¸Î1p³÷2¯™©F50ŸN­]uèÀ)ÛÛ°  ‚GN{ÿì89qíCöAéB“ŠzåPY×ÎY¦=žl!¼[ƒÃùØjµõr9…à_HTxUèV¢Ê‘"f3ÕfŒ^€'Ä-£¨|’ß.¸’ÒQjaUn’¢µ¯¸YIlÆÁ0ƒV$¯BñŸ´þ{·]*«•P^¥Íµ´P£{ÏßZ¥ÞÉßÌ\Væ=Úê¨ñ/ëªñij&z»†ÍkmV˜ýª<Ú¯^ÌVýåKhü3©û	Ø„¡æìš~áã€ïIuiZ3œ¼‘¸¥eKœÍ(´–ÁDÆ\Mì¡«E{hÙ)Y«ÊKØæ—¥¼1U’²iS‹…­£ Ð_Ætç2ê¤°ÓKfÄÚž‰ò
Íg@P¨Eíjq@,Ûf¼Š?£%ZzÆKdÃàðJÆÁ‘½!†[æl…«¬Ë…šJ0„Ø²AÎÓT: ¹©t`17µ‰¨¤&ke2Z“–RÀt_uG€ªÚuFB,»Œ%EvUrfq‡y¥†ˆª$ë‚=\’\Òå&«½+²:?M,ÍÕ%,:þ€sau2×çÞ!ü—+9UòžðÛ6;fžw€—
<–‡°1Ô-ÐìtŠÜVUCPSðí<ÚÒ•43ÑäVšÓI=C³xm˜¿†#Oâ,Ö?z¸fïŸ2µ¬}
ug³j±ü4ËpKü ¼g­æk‹*)åY¥†ÜÃhvØ–ðzd›‹úÖÿXXÏˆ&Zàÿ¤áäëí¼h*‰&4¥ºüe"BK8ñ"H‘œQP¹‚½Bä°hÕ?`$èðX1–>¦¦<s}ÖnÐÀüÅ˜ø€ÚÌ¦hÒzœÁÄS'^Æ¡èèFŽäÆ$`d­™,kà=ËãN6ç=dlYôÜªÖs 7pÆ8wäb½<|â"mpbük†fÏržˆ>½`TÞ"£À¶¼åtYØÏÂ,ºTÛá&oŠô^H	ŒçéiTåúöq-taÔXž!{×DÀÊuîš÷àá=ÇnôOaÇÃ
XA‚ÏÁF_¼ÀÛé¾Ý¸¤ çÓ|–qÎKƒÞ_ŽW)ª]\ÚÄS'GïA)Ô©\â5ŒGÞy@kÏ.{Z¬'#)µ±È+íÁÄc÷ÖñNQÚ «èÆ%÷ ¿ùUXEÏ èD²ƒJÂ25›occÑª~Bçh¥P´I.wÿyûèýUý/žåènú‘B‡û+ÿ»Õüm»ùßÚÍWÍ_W°}‹K÷­±?¸4\À0t®ðMØÞÔGÒRÕê£Z}DÕ††æ»‹æjRk,¾³\Ëä©à+€?œ)3Øhä$3èXñ²wzü¾s™®âPZ!—Š£	U`§RNŸØi;­\:uO+A*2*zÏí&0.¯%^QL#½ÎIÍ«$&5§V‡çHír5¨`ÇxXÜEÈ<KÕAY¨BuwW‘=¤&äLOÎ@[WaôùÈãæzNªîòÅ•½:õ;¶ÉŒ2Êà
ãÆ„
ÓÉ€zA§jÁhL'j¡|æŸÔá(žàsB{õZ eñãTåFQuÊQT,ì=¬þ•;˜„ šÁ>K¬ôYËÀ-\7ì	H…â×(,Eð2Œ‚ \lâ2?¶¦*£…¶”uék]TZZª¸-Ö/.×&î¶…RÆ¥zša/˜a$k>=$+ä¨ûD
G²vM‘ãü—ôY×æ¥ÒÜwZÔÒkùá¾Åa g %W¶*l;]cÎZÞÔó’ry™Hö”<ÀbÚ”°I)e;©zÛ&Mº×§‘Æ\~ïÄÒ£¶ñ¡45w ÝÓ‹!+FLùq3…FÀÿC}ÒsU«u2æ¯ö'£žŽs¯5çAHeZŸFí‹uMoÇ’ÿz2iÒ9ÍæhÜî…I—	ŸuƒÐdûwÀàã¢›Uð¶2ª¯Y× ùÐÊ	c¯ù¨¹Ù$ÅØóÈ?§¾NªÚ×*ÙCýÃ—Â“uD´™=a
½ä˜²Þ¾€=š?®°yŸ°å[ÁD@—'Æ’\rtmºè<oá?!Ì7ƒ0”¿tŸøKr)A÷1Ÿø	a¾„éRÓ}â0É%GØ¦‹îcp>ñÂ|3C9Ìê‡I.Â #X}Ã'~B˜oaV)‡Y}â0É%GØ¦‹ÕÇà0|â'„ùf†¢
yÎ¼ŸP†(QXÝ£G@šdê'´ùÒhc\x¾‹Ixgo©4Nà‡Ÿ—žP‡`cg¼¹Ðnµ×ë¢Fµ\ÐÈ0Ë›?†‰³$£[ ­¿<“WE0ªð"]ã¼«‚ìÑóª*² ]þ\ÎÝÙ¥!»2:™)Ö+<ÍêxÙkè^E6{ŸWåøå‹do”C$Î’’1Ih|O"|¡+©ò Ó,Ertõ{ÓßWêÙ?%}Œ¬ñ-+¬'ßò]¨$âü¶
RŽ” H‹w—H¹H ªÉ8d1g—Ig—„hSšê†U%®f"Ù|î‡‘jv=@*ÂH¯ùéu÷3Pkviã
«R*~þ²HwHwô„oÂ7ÿñÍÂ·âõMãÛà²wgåÌÁ–èO8§«Â¹èq.zÂ¹âõMãÜ9àÜyˆ‰OÎºéÇªÐ-~Dt‹ŸÐ­x=Ýª3TŒ¬aR#A—	ä×²Iæ¢3Ù³ä!›³d ïAúñê×¯Ÿ;ý¡OKÈî:ž3 \y¢^ÚKI½ìG¤^öõ*\ß´°p6Ÿ¯Ý(§äm`…öÎi/Îõ#E•Âìšé`ò'¬+\ß4Ö%–ï}¿	0Gù„uÚK…u¡Û<¬±<âÖå®'I=“ÔvÃ;2dåbÿQ$õ÷0%9´¢«@?.Í¥"\x£‹ÝÁÇ#`ÂCžYáú¦Å‡LS>³:POh¨½”šr²‘ßÈGÔœKÏzBÊÂõM#e"¤ž0Rs©0òšíâÿáñÐ±ð '\,\+éÿ Ò>OüÝj‹œ‰uyŽ…º<'Ö+	ÑBÆ±xRY_¥¶hó—˜_;aì‚”ÿ®’’Í@Å>3«¦^¦”KBµ¾S:â0•J&~(eú–¨’¦²o}Šòe(b)ù'ô/úÐ}š?òÐiŸP‡<uõ u–çX¢]rÌZi&­Œµ¶®êÌ’LÊýP=4­ˆÒiNªAtV«§™ðƒ“,àÎ«êÁid·k08Ëüê¾lWÏ§±tZíŠ[26Ö­Éq¶bX—›m0#J;UÛÆÁuª^'á©Ô[Þ5Z&uñužNý£çç,€fû%3S˜í_I£ªÜLÛ¹²&^|aõûÁË„£,}a;±åz ³Ü>²ÆÑV[®š@_‘8Wü«†F´îkè`Ñs±ñqÒ#Î|eQu]n³žyîóðÊÆS`JÃR.f÷óþ<Š…ª‡SºW»|/”ìIWx^ê"Öò=s¨®FÖ6’5ö&@N©¦/°F2™¼@ç\ÒµVºö÷¬¦ÿA`P}ž¥BjØ|DËŸ!¬žòbÇ£åjß648d# 7Óg¶ÈùÐˆ
³ƒ=r h“ºÌðÇß&NDuçÆ.“‰ï9QDYEÈJ÷³^;n˜êÇÆÞW®çÈ»ìT*ÚÆy}É\_HmÈä.£„UNn…Ž¥DD‰Ü­%½´‰ÇâœS`+ˆ}^<×
æåŽ?R¸|"dâÒúŽçá29‚Ykw[ð­ÓÿÔ!«Ó‡ä¸“.99l©EêÙÅÿ.+ŸÈýõd|ä1îoü×a³ÛžWj­:5T^Ó;¹C£>²ŸY 2°ñ•6uMßYv1Muz5ÕÔ
Q£
aæŠ2‚€Si
h3Œãq´±²‚“µ€b·AÐx+°ÝÖ<P#ž)æ«ø¤«»f|Ao£x'apíbùõÆ.È FÙURÇ3rýÍ%yb—™¨4qaÃÊ/ÆÉ‹`¯4›+ ›¼!¦÷mTàß1PòÈöáÒaÍGtëJ§áÅªœIe×ÕoóWˆ˜ZÓ×íËeÒÂñ$¦É
ü3'rá:ˆ6}\"Íq5ÿ™üçžY“ûÈ`º³NÅ°F±¥  tiÃ<U‰O!Þê!f<'çÁ$ÄÆYðív¹ŸþùÔú¦p¿¼£íWÕý{©G$iN“XæÔó†ÁáFa8]iÿ©æ-ÞÆð¯e1Ú	âºæÓßFvŒ¼q1v¢ÛÕ e(Ã&6–®CãÔ`ôœS
C—GäÄÇá`ÏvÑ@Âí(tûì"¯4 ²»`8¾³ºg»8ç4x2rh4Rß/^x
Š­çPb4~×E+kßlo-ÿ“ñ.à`NðŒÆçì2Å£ÀàžŸ¦A8¸ÅóS“í‚Qd9†£w, 8À„ÏSJ‘àÒ}GuÂ!ÕÝ¥Â ,i•7²5våg*4ø.!Õ‹¼E£A€Ô‹(óç	3Œ§ß-Ê_òRö–rJÈ)[’“K©¨”P©mØwò*ô¨æÒµéªÜñâ&U´¸Ë.¾ÄT
hÈ×}¿¤ZT!¦½ åb5ÛOzM˜Üñ"‰¾Òì›k’Þé*»¤ã“Nð)¤³AÎ+ìÑ¤ÎÎïÖÄÝ‘­¤¼x4<µ‰;‚@Z…-á8yÖ³ÚÆP6®þ•÷qWYï:*;¶ÄõD!HTjÚå°@ÝSÚÐÃ€ÎºË™	hÇí§fž *V(Íÿºêœ5Âk^óEå$¹´ã&ÉÚ¬²0ILekN},Mµr˜Ó¡øZù®‘Þ”à>b£å£Óý%+—€áÀÙD*í­¤82Æ"ÞZ´u¨¦R)qèAÓèq &d15¯Qæ«ÌÉ%seNšDáÁwX­|‡f—Œ¬Û&è]êìºò@ó™6­	ú“dV&~Ý5ô$ë°ü·‰Nw<˜È&)œp+‚'Ü”o,µâÐ©›³é®\øµƒ}–ìl±ï–>‚‡ÝyHÛŽo«…GŽ{VXˆë÷½‰íDlñ—9Ÿ¸Q61~’¶wfÍ—ªŸ¨½]³œÐ‰€	/ú÷¿g‹SÝ†±ŠŸ°!x²ë-Ïññ6¸mëz„óEÈÓeº›àØGÜZ[Ø:
 8aÉÈçRB|…ÐÛb¨ |Õ›ðE¥/3²ÆU@Ão‘‹Fì¢ï¨5}r¦›w&îõ#kÙÆù ‰ÌÌê¥T›L"5„z¼@$©˜1‰©"1C! ®;rýæM“Ê:G†|"e—ëÊ™$"¬,Ú1'~$Ó…­»Œ.Ü›$£HÁ ý%:ˆÆ„¯¼ÔÑäJA±°¤OL{cµi×UaÔ–ï´2Y~]qfû´• ƒéîÂø(ÓQWÉA=T‘Të1’u(ÎKÚ{˜brN™œªo.,y“« ª&jÀ¹W©Ìé¡‹7Ü¶ÊÉàÃdˆªvI4šr›VnÂŠ Ýäª¶u‰WÁî"¤í9ÜÄÅ5ÊÄcC•N!*ÿ’îÕïss4jëC5¦¨e¤ª	—RíªW¯ÜªFUÂ‹.6.Uå,ÓPÊ6ª Éû¥†ôÀfˆÉc*wwCfi©­dÿ)ÙFús%Ë×Ä‡ÕÑÃç¤‰+PabzC.ù®ânng8Ž›Šï/Ñz&Ùt¥Q­ð×Pùë¾‚¨ßÅ3Çsú1±RÏƒ•ÖÌCcloÈ<\œm-ê&Ü&LTê«0Ñ HÏhÔ¯ÅvÌÊ9;ZšM“Z+´(Y×`XM¿ÍèvÔŒÙ|ÙþŠüà
ŸEnp¥ß"7ºÊw‘lè¿ÈÝcâÃÈÝ`âÇ(Ý`àËÈÝSÃŸ‘»ÏÈ§‘»ÃÈ¯‘»ÃÄ·‘»ÁØ¿—YÀ}‰†P¸ü€‚BHå	•°P?T~‡Æ¬*©ˆNÐ±bsÄ•;h g“ÞÈ7ïR1îÌºvòbÜ½ÖOS«¹ÉL¤=·ÐÔšÑA]Y‰V½êàÔˆ²DgvÙ<T×
,•¢E!TÇBûtn¹’fá¹§*g''93­öè%ë×Á˜šTØ. @›ÌÞ(6œYz½Â×˜ï|WV –4Îwg™mçì­¤ô&iÀ÷³Lwº¿#©)Hðý,Ó½ß>Ü»8Ü>;ß;ÍÕú"÷‡K¤IJ…ÏfÙÏ½öw¶.ŽOöN·ÏOee`çõÄŸ÷OÏ?ÀóN÷Þíîí•
¶ÆÏ§3>ëõ
CíŠp/Ñmë+µu&ïE”b×æ¦è›*ÊÔ0óªù“ËªGmã•nÿÙ0ûSÌi)š“ÐkÌÚÀ;duR6è
î(Ó(ñÈõäªefsïÐ,‘µ„vUFdþÑ¶¢¡“£¬br^ÕLtš	†OÇv'#êŸºi~ì¶‘Aj ê
dZ2NXjÖæÖX>×‘p©±@o*:ssêÓÜ”§šÁ’¯rßÑèƒØŠAnJÖ•;Î£ù¡10^îDÙ¡‚ÿŒ9uŠ"jz_Úæm{Äïl«ÇŠrüŽjxácæÈÂ=«?l„r…9Ú¬´ëÜ&	"‘ù’oá²¤/‘¼¥/õýf6q‹Ž8±¦å{Ñ¶rù/Ô¶ø'Z”;Äûòý÷åÙ‹àR6x•vNážª—~¸ªI?œS4­¡éjV˜Ê¢_Ã¨•Y…ÎñÄ€ÜˆùšÌ©hŠq·3Ýêù€$î·V( ‹µU¶îÊè~_3ºV–£AñO Š¸W.lJ—(Lw*5q™Ó>Aœq<ò=¥po'6¸
°;	Õù¢`ÇìÁ§‡äNF[œ¾so»Ñ]šžh\š`ObLïþ„»(`ð~Ôn90¦ïÓšð'LZÑLVÃdŽeEäÈqàu*@ñÇ`ôe!Q$€ež;7ðKh«XC –ïþ0&z¬ÂÒ	
‚ óx•„ÃCËõ	M}`RŒ<!&Ò¢•i1ˆÒÄ—ìáÍ.jy5%mÐ¿QÈ-Æ¼0¤ˆb+Œq\ÉË\¯5òƒZT1ÊhÎ2©^Y3@„9ˆ%Ÿ¬âÀVJÁLó&šX’Q³cyý	ÚÀ‰ëÃnº6$lì=¶¦Á$Ž–ó%4¨,ÍŠpàO¾”ÚÇ„û¯)>(°¡R²UEp Éh¬I#;þq‚èÛ¶ÍOEî&„ËÕÊI@2‘ôK_mçƒì×òÅr­)¼b#ÔI‘ã].ÑâFÑÏ4ø3o™I ^N;£ð­„jØÂ²¥ «¶žÔ8:•ë*sy%¸*²Q¬Ât”f”Á¿}83b][®gõ<jbpnÇAcÅ%'ƒPíbJœ"´AúíÊ
Ù»í•8¾Ã²çÈ$Bôºõ¢[9$RÝyèX6ê(›ä£b1xnËð/qá_ê¾Ä?Ð3‰ÿpÄÆ¿SgâO‡KðY5'÷ÒÑé˜ûÿhø9Ç¯ñt$’d=ô÷ìhµc…„zëèò¬i„ÿòç“ä3_Dú™v³ß»{–/<è>ýáÄš6Néû-œ‡Ö5–9È¾IÓŠß±Z›â}T¾Ïl§ªìâ_å`ÀNb$Úm0~Ua*o{°Á„]ZèUÂH£)ÕÅÏB¨û}Œ`¨Ðð¬zH˜ùË(Ö·9tëÆäÂ2µ/À`®z ØˆiôÔ¬»!_¼J3°Ç=ùlÚ•mí¬½Ì‹o4¾Ï½äƒ3C°0Çwy×p8ßkÓáÑØscýMîAÍ© ¹Éð˜ÃÁAl<	é¸QS1TAyT1w2E‰ÔŸÎþÜÅÜ‹ZV`]ÄÁE4tœ¸ñ‘³ eZÚÚ¯Šð¹zù¹zAðéÂwnTi"Å¡ˆð¾ÍŸ}Ó[†Å9Ndi&3/èæº	A¤zçz½û’;ë.¶ŽÙ>ÚÙ»8ØÛ}¿wzñìÎêc×N0·Ðð%Mß¸h²Ž‹Å¥ûòêË:Û+
™àïÑ—àâ‘\8ˆ&ý¾EH}§ßé*?JCPò¢«à…ÆVß§MÑ÷Š¨R™q7¸ñ½À²ÍEÔ=º­RÒ½•h/*IµNv©T•†Â”UíN7—C#×çôõÕdê)L;LçN4’Ñ-S©‰j9ÅRQõ†æ÷¤f”ÌÖ®²•äædNÁ‘.dëH¨î@;èmÒdêÄ-²ç{ÑT˜Ù²1ó#*'c¸@x0¤ñ–	Å@`°¼eÌi´l¬á ‹ÒuØ›r‡3` ´Œ±<ETnå‘:v‹gšan5ŠmLÕ²G f‹&Zf?ð<k9iîB³‹‘p+q(7.rK-@‰zÒÅ"Ä¹TY C«”"eÑ(+õ˜×+ñp–YP)‚)Nà7üeÒÙ¦ÊûÊ™PH?á¤Kó˜±P{uö	åYE4Þ+§N<—EŠ¦,”Õf=ª>'©ê7‡÷=¡f-Bõ¶ùœoË¢ž
~U¶qò½Ž{=—@t@å	ÿCWJ¯;s…rÎ*e2ÝÅi’	Ë„‰Â$tI"Æ.Ûr½é)œ7þ	’>q£3”ä—II '¢ADõ€áÀcà=Â Ô«V«Aé¢@*iBhØrí\ˆjÙ4˜ÏÎDR„*-<ÀVà‰þ>ÓjZxÊ(ï²4áMó%Jí4»	_1¶ùj½]t/H¤ÅBÌ’ÄqaœcF¯;jW –¯Š6.¿‘;(ìo&·Þ¼Äø)M•0Ý!û'èýÕéMÀUZD—:Ö«¼6Œ?P:LªAŸmŒh”bJª‚£«ru’L/ñ¼Œï(¤ †LAeo[ô×–
æé¸˜ƒŠ5'¦¹Òa#1I°à¨JE(Ó¡¯ZÎQkç¨²·3LT¥—Ù´¦ð¦Êk–ùt]à(n?uvÝeÆÄ{cð6g2
˜½RÌN†((¼ÐÏGYhÁ(ñ·€'hÏ@ÎöQpk	IÒ'¿lPªƒoÐc’þ$îùç–b“ùªwZ¹Ñ&‘®é$Ew}šiÀÒ?TÉæÝš‹t NÒùOw#õ=ù;9ÁoséêTqƒ®œŸiCÍƒœëÔˆ¨J†I®¤n!
”™ê+jÞ²+K‘±¢©ß'<QFßN*¹xµçT<VË‰44•°ÕèÒÕŠS²ò»èÑÞHÍ›„•à-¸÷7’çß›=Àº±Ü˜DY†ÖyðÎ(B§‘=W›]—]5Þ©…töqŸÂº%yêlÃë±±#	sYhXžÈ·Y™Úu¨¿„áŠÐ©-¬GW¤'•)Éá4€ ¨Ö7KÊ=Z\†wë»&	ãŒF	&öK–ç‘Fqa‡%ÔÑœø,'ðƒñì.ÁÈ$ÂŽwßï½'§{ú°º·KKD´GŽ³xYÙIX¾ÉúÅÂ˜¥R´±’ÔìÆõ(µ^RÉLY03)cåÍ°˜ðB›= mÍõv;e“ô‹µvšŒ’Xmg!6é—Ý¶ñó6èóRe)y^*+Š¹0ëÂ³Ò;ºm³²ŸùK^4™H½…3ØéEÔ_~‘â?ÿý_þƒk’Ú¦xüQ }z>á'}úÿ&	Š˜?º*ã-»*”8{³¦Å…ê	(©+)ºdZV44ZmZ'òÞ  ÌÔôb©ŽB+Óg‘nTƒUÙn¾ØMÖ”¥€ÕP])èÞÉ¶âqçŽ{4E7¢%ÖÃÉôµk(º†êsz¤;¼ÉÁ.®0lÁð°c+Âc’w9ë¹üÛ¿’ãI¼‘ÎŒ/ejy˜ûyÚŠAÙ²ë®QÌ ÛÍºœ·D[b&(e&ÚÃê É¬$’¬ÌN—ã¥óUiHìÆ^YCšå-ïÍŽð?ÿýþÝžéyF 0§êk&¼¨+Ø{ì€wøªÑl^àb™ÉQCXZ	 f\zEÉÌäbjðæÂEÏ³| B3ñÔñ6ü c-ñº¬­ófÚŸž`–ë³HíÖÈÿsQÕµìÌ„A8/Øó×Ï;º´|4ºpý äg×¹Á®wFØa}Ô0-X·L`­ÂSÙ91¯bZ`’ê¦üf¸“ãJ)Æh\¢ˆZw>N5§¢¨‘lÒ‘u´i†iL¤6aö9UÝÈ†R—Ù¬ýÝ’iÍn_¢}ÞtÕ˜å¯*Š?”ójlvM‚Ž¦ÑÏSìjz“×e9,]Yáa¬QÌmßë…ú¶ÜÕ¥³PÈ=‚Õèn¤ÕÒª¢¡¬îmÚ?×°¨°Q¹M#áô¡¦ySô/1—KÅâîF“"N÷m*~`„‘÷ÝD§v|›»q—‘Ê'È¼	i<ÏP	2hÄ—]æý.³ß¡•Îp<wbÎægüÖTÇ’úÚ“ÌgÚ‹¡<ÿOÎvgr“àEMá­OÎ”Iº{xˆŠ"ª‹Ù÷ÇVÑ–ôw^`ÅÙÖòlu.ÀÚQƒM¿„”œ?éµ¾º¾ìƒÃO<Ã&ÔZxØ€eI6‹AFšüÒå©É/ã@Rá#J¼PÉ;l$ejýgWBSjT]*´x‰ž†GrgV.ö^z/¿î‰ãÁùá7ê[c§& Ïñ•MOÓHÌÀ+hþBˆk·E¶#‰óãé /3ÑB&=Î3&+goô†*”¹¡eaë§Csû•q<Œ”½U5•ÎM`¬páUWéÂ« xU‚îp&‹¢ÐT5-'^¦fQm‰Õüe*òÑŸï 8c®É—©Î•¥>6C­ËNÍ™éã³Ò9r•Gc£³°!5yÚó“<`=ã¹Cna4Ì,2¹\ˆ.˜ŒIE×;ýê¸ðT4eiÊÆ@4’0A‘{R‡#NiNÖtˆ‹ºøƒh S÷²}{ÓŠnO£”x±ý°7õWû¯$y«mBa°™ÏfíP#…o„äþ5ïÛ\0?%"h9…ÃôD™ÏŒÕ/Mös¾EbÅZÅ6’Æ^€G 4u¢´)núšî¢7-H—ä‰UèÌðRwÙQP+ÀßÈ±Îü¦ÐVcó›/9‚ï"Z„?.Úëíû¥/åê6ãú~¦€á;ž6“¡Qèƒ™º½×Öñüxò±¶w V7Ëµ0MR©][>üy,glsÝ”…’oÔâ‡f–ÕšÉ[$e´¦±}³ñÚ«;‰Âó	T ï¹ˆuô6É5Ÿ$l]³ºðô30×R‘eÝe¤!ëÜ ‡V<lü7ÚËüEš¤³´œdÎS1@3|/f]Â'öutc‰ `Xb9pêf™¡(×Ž-J«JC,h
”¸›—yUÓ'jÙ
t2°àî¡Ý³Ê™;Nî+
„–þ„ÀŸ?qÄëHp6ýí	Må—9š~ÿ(hj.N›ü†E^½ïI™Á‘É‰€ä_5Ö™—,Æ:D {@Âä·=Ñ¶äú=ˆ œü¾EoÇ:$‡³cA yBSz}k"È7,`ðŽkOF}úôI‹ð€¼lpm.ä•ù$O¤ç÷ !”ò÷-(|)D¼6çñCrü'tûÆ8½‘-¡†K¼>Þ<g*`Üø02ÏçÚ5nÌ‰ÔunÌáiÛ¼:‡ÚÄßYÖât£L|––L×k\×ÃŒ(*áŠÕ’¯¬4pÌêƒ<ÎÏlŠœ4ƒ6Â7S4~Ä žÔ:g7fNJæŽÖWmÁÏZ/LÕÌ¾@ø#F)by½‰âeÝ8@#ž\ÂY›‹³5ØëlqÜ¬áÛçc­·Ñ|ÃdÌDØšÕP|íÅW,Ç}‡Gw?CüÙWŒ€áz"â?&›É…Ïõ{–ë‰‚³I‚úŽ8Å+/~qÉÊ¬BÎôÆBß’Pªy‹X,ì·çˆWUÛWñsý2—´ªI­KÏê9žY®k¹–°Æ$*3ù&¾Vð ¸N“Û{Á­¶ÓÑŽ½y÷ÝwaËõûÞÄv’–lfàû bœ†œ¬°°¬j'_ÿ#â¤ÕÇe¨˜«%‹¼­pºID°Á3Ì³Þ“Þ’Í1OŽ§Püí´5Â×ëtYO.ƒtº5s†óG­Qa-4œ%È:é/$÷š¡¡wº’u&ÕF²x^î¶ìæi\‘‚µ>ñ¢ô9/ÆQ@û(»N‘J9¤2£ Í«®½h×º‘¥.Ÿ£{±8‰,uþU-¤9#¼ÅL”ù–ëyŠY,Äs,{5`6ÜmB¬x¢JÐ©•Ô +ÌIo¶Î—ŠuF–ˆb;cc„ióV·>íésOþH˜åÃØMgÝ¢ÝÉi%-!Þá{uºoh¤É(zC.pû3iŠkt´tIkM™'³íº+	Ì˜Ød'Òz ß—²”‚D'Çç|]Õ/pWmaYLf"9N\Ýáké(q×ü+7í‚xÏµ R¥eèþLµ•j˜|æ`À±Åy£LL­•ä9ñŽt«ë%¹‹)îIgÖŸ’÷ngëµëe¸×{Èjìæ‹¶P·¿ø!)·r3  ¥ÊñŠ²ñõ³ßÍŒ6qæk­™üÒ"$:˜å’èZÃ²þkë‚¯Öi|„ÆHIÁ,%ï°€6ùãÄ1BáÃûâ­lØeUŠ:²º†óA5“Ó>uFA‰	ÓÓ~`ª¯ºû%\Eï…é°-¦lFø	{ã–’·äÍÏ_Sø"_ \óãÝÊ	o&Nv·Ï~|{¼}ºKþ¸’=î.ê‡óJ…D.½ìZÑ°X¡M“ÐYÇñ„£²ÒK½²¨K}íÖKí‰'ÿEKÇ¥þH»¶çÖ'{HÞF6èßapSŠäe’F[aŒãr‚‡@#Ç°º$ºk—¶|´ìàt;*¡”mòÎƒªÆ{åF\dU·Q©Õ¯˜÷¾õÒVKçN8r}KÖZ\.Ï¿vK”	v¨z=—ýE:E_vã&áÌ_šn›¢¢Ä/ŽÊ³Œ¯Ü"w9èÕ´c|½2ìJÞ~\zùhD$†ŸAf² U–=t'ß´°8µSœg}ÁœôÐdQjØ-ïâ^§¤ššs‰Ò.»ïøN5ä¨­œÍrºýÂØ›ÊðîÞ¿¯0C®­ŸÁ,Ø©¯8~gxÿïÒX˜"iÞh8Ë©Vø1 ca¢0ûå èg•¸«çL*¸&TÆ©žñ-7[fL­®æ³$m½Êñ_çÊµ/Ì–7sšÒ%­ò*Ÿð“Ø¶°ð„\KC|‚åO2Ÿ žØù°€âou'ÞáæÏ"DŠVÑêYÄÎ«ù‰ÄŽ³ÂÒhßYõ´gÃà†Ï€5€NÂàÊ…©ãPQ\OªYÊu˜rÁ£JµfÙiW¬ŠÂc`Äœr†¤. ^‰¥¼KÑ!YÁ°hÁ$¾[¶¤’‹(½‚‰ÔÕßæ3M#)Kõª¨«Éý<Ç“Ø|Gè{ëdù¦JØ¯,Í%U™ŸQ÷m’çÈ×+…×œØ¹n.v&r´\ôœ¿xŒG·*“0ÊöëáªRV2ëHˆðÄ1ªYÙ\#&’—Ç¤*ÜpUú¦e¡Ð@nÒgÀA,gO¥è[Lá+ÚgþÑ2 ú+`W¹ ‘ˆÜ¸ñî`¿¨@˜M&ø‰Ýoqn:f$qÚ}'‘.Uò¥ìË
„®Mðb†RÛÙÇ®xî€a˜ÒlYêÁ7ú(ö[n´Í^›e\Á~8K­‘5n4ð¥ÌÊòÜèŸÚZ#í‹µ"Ð!ÞW»++Õ†'@ÅßÔ¹‰ö>ÂÅr#9þ©²'ËfðAÎ‡§·îÛ²%_±Ðn…u‹žœÂ¬ñÉ™nÞñÇ*ûåº}6W…–ðÅ
ZžÇÐXNk8Zkúz
{¢1ä°†¼¯‡Xa;%˜Ú^œ¬ÿ&ÖS[oçèm®ƒH‚Í+kmUwMUGM•‘©d/qýæM³è«©{=\“Ñœ‚šEt'mÒÏ9;dŸÅ#×4Ï1Ê/îR^ë’)>î.ï§¼íŠŒSTôMÑ¾ÂjÈ Å9¡åÙ¹¯ÉwY“×ÄÑ]DYØM#÷ öMyúldW	\x€ém¢wé&À[²¿hàíkàh‚Ô:s«Ý¸5z÷%  w…±´ÉÐ)†‚QÞÂjËËŒÎßÆ—°M<ƒÎkÇŸ8•>­­_û£!B&™óÄ¨r½¸ù:ï‚!^Ux9Í¼µ«ö2^ÇÕæ9(m)þµrÐü…ÙNüÌê¯S‡>¨aþz×¶¨*§Ï4¹×ˆ[bZ Þú–wš…5 Ü‰÷^— D|åÏîpºŒ½Àë¼®‰ÛJìe~Â*"Ú«<c:¢”kÞŽ¼êé•®éB£òUja˜ÌÆÞÑ9ÂDýÕ !¹™ “\™ “F‘ugüÆÈÉ[¶žTõ
¯ênR
7ÙxÁäoÊ—Ø‡Š#3w`MzX/Òã’*ÆáÔ8U†ÀðçšÂˆ„„u-ñ`ãs, UäèŠ9-Á‹õíH€Ñ¼MGÆ*jÄã˜N ‹¸I¤á„ÆLÁ2ðœmBo¬½»‹ï@2dDºO÷9·É5ûŒT¿çÉøB¯ò0*žÅWH§ÌîLÃ*:íª^^ŸA/AÉPG5hÞcB)+dªBcLÈlM¡“×Äv•Wîâ4ÖÂ™¬ÏBc+AiÇw|½&¨* ÛÂN0hôƒ˜àk1³á¢ù®µ°L(ö-`ŸYNzyCHuýR9fm«š3»GðAÒ7©ï}”ÍZôú±©ËÝŠÕþ½ìÊWUNæ+Š˜Ô+ÊFLf+‘˜Ïr]˜¥ní$6ÍÀ:Ñ…j†×&å³­þ)Ûˆ›r‹´Aj£ÓŠg²[§Îžd{“›x,™Ø eK6ñÏÙvå&¾žeâ
îSÝQ8Ê0ûkN:Æ]†+ädtHžx“¨Ð—…v^5è.Œ¯å/U<H¶§aMÊŸ$'*Ð«ëkð)ûh«š¯˜¸~ú×D#VRgƒŸá˜ºîŽ‚Ä¹“9„"„…þð¦ÄJ¬v-©§ôš¦.Ë¼ƒßµ[ÔéýâÆÃÆâùÞáÉÅâ’Ä†¥u^¾4w^ŠÁB%‚kAÿ²¸°NÀ¸Ó±øÌÉ|=Xgß‘‚¹ÌmÙCÓsÇåÂ–àL<Î
ŠÌî!÷&š T!Kj$BÎ”¦È×[	&Ä
â œØ(OÀÄ‘$<`Ë¡£QraŒ¡jCR3Å¡ÙkP@>ÃÞ_ÿ…L¸E¨„HzŽÜà$É”°”ú¿&æÿÚ¢Ý(‘¾{-%Vj!Öüµ[Dæ®½µ–ÄCÐ&=bõŠ»r. œ-”I¼±-Åšeaˆ2·mÇª"(ÛGéÅùšÖ’oH7áYx¯ÛÕ	ÛmßÁ8«z7µ/Ójµø:u_\{ƒ\>1Øµï/ð†•gw©›žY¯6Hn~í¡ƒ­9·ã|]‚¾¢õþÙq"Þ©÷O½µÚÚl_5GW²þWÞ‘3Ž]FEzÊŒZEÚùÝ% SðIIJÁµ®ÈJ±Ý¼_¿ì`æ¼|”LÆ>‹b«ëÓÎ×¦e/äâ¬Òµ'auQ`x¡àJJ{KŽ‚…È©d¥ÄÚ,œyÓwZýmÊYØŒ.)›øˆ²UÊ”3!ëq…)Þ‡9z$aÀ„é+ ¨
nÒdYìÕÊÉ‘uí˜ùälÒkž[½¨°(›·~H!0¹þPTHôŽ«±fŠ ŸB·<QÄ0b‰ÖHžÍúaày=+ÔÕÝ1•ÒÀ„©X½Æ"f),*õÞ‚kÒ$ºV*U¦ƒnÑØ ñb†é+°”0úF-ñ_òÓÝ•ó^Š)‹=uËåç‰U/J›ÞBcS§SÈs²í@¡­Sµ’ñ”¹ƒˆfa| ñ;€4ñm~— w`Mƒ:aìô&
X;¸5©¼&÷Ð¸sÐÇKÌ>t‡·£Èø”™“;KÐ:¶øÁ·è7Ž]Ñ“X–ìˆ§S(“Æ v€¬`¶PÈkvRQe<ñ"}y4ýËª•*ý*3Õ’¢º5ÙË¨~F3sshG*ØT…íòDÓšé]1ó4Ï~™®Lä„CGe=Š¥ï²ô†¤cäÅ„uoêÔA&†JÇcRÐ Ë÷’¼ÅLg5h2pç|'å¡
³e‡()ï1¢þ+Ž>ö~•nuYþ+|DaP4TRŽ¶x“‘/Ub¦¬d›Lè7á.Q\¬`÷¨‹‹”KþRa7M~Þ&œú*¥]ÉÎ»6ðL~˜M<Äæ³’!]Î
ˆ‚ÎEã Ù©„ÑvAóÕz´«aâhæ€|Aú[4œæ»åÊRésˆ8%®¦¤úsNf/ÊéÃæÇ5Ö`5!–n’ˆÈC×%Æ,97T‰˜¦žôƒMšólÈ¶»O † èÅ¨K›mB‹“Á¿7ÍUT9áY¬ŽWô¼Iˆ»°°¥t)Àh=jlzÎUŒä“;4@[öPí3ÛDÁPQâ [¬‚xÉÔM:—’S¾>ƒñpš'œ/à¥_¤L)£Á_å}›b½’ŒíÈ™DP“ `»ÒÑ¨ÑÕû^6)|ìÒÐ÷ÄÓ²€²
†1š§hÐwÅ˜*%qžH<:á‚Öúà"âIÂ31¯t€²k†…9˜JŒHÔ›­RÜ4±M³K‹ÚsŠô­œ/T Jé!Ê/¨„ò¹¾ï„)!SÉ]© ì.pÿµ;è‚q£°¿)›T™L…—åÅÅ›Ò²ºûÊ½e†ìŸ ÷W¬ÜÇÍYÐÍ@YYè„'HšÓÍ?h&_©ƒ”¤@6&-U™¸Â+2$ªùKxÙ—]©2=
“É)VVÍÍ«L0Ý‰Õ§|ŠTÊTQj*.f„õûþ•)®ëñºÚn+Px%™££m.eçh^JîJÀÄ;éªðMÂ’à/j´@z–=p/-yíXš–ÊK!%Íaö¬¾¨Ë

–’±½(ÕôáN^W2Ù¯íV×ý*¦ì)áŠ¿ù<ÙœºþtJVÈ» ˆµb‹¡pâø‰ÒÙŒ“?Â>Žc“;KUË±…A1†¼‡ÊqIW§ÚÿU]×Y^H·HÖDš À~Q&)e»	¼œå¼	_¤™oúT6ÙËŸeL3ð„G&©uõC­¤ž)^"Ø•g_ÿét'°³Ÿß“kDkP­8(olHÕ*¹¿Á¨µµ{µ®osáP­ÛW€¶âëò÷+ŸÄüóFeÚA‚*PkàÄ{Lz;Ý·Õú¤Âã‹áŽ§\üß; 19•QÁ?9zßjµª
€ã‘wì0í,Nü<w™Ü‘±{ëx§è=Ú «ä~©¿ n}=“0­ÂÖ0'?ßÆ¢¥‹ÕÄ{[ ëù^`a:N<'ÛggÅ}Lø‰4dá¢É‚.—î[cpYñÔ!.›½hÅ`Z ¡¡©$Ø¢9˜¹Q½eY¢‡³1`‡ˆGêâ1Á‰ê3AäÙÎíô6EË ïCÕTAÆªªûpöE~ë$&©‰RæÖ01M>¼FÍnš3Ô"Iï=IOTB±´5k$æ½¤¶pÜÔQEv™ÚÀÆ7²7„HVcYj|;•6s#gÀÛÄSµ”ª	‚ ‚Â¦­”CŸ2ûdÝB5
W£ÅEÜ½S–¥ÅvWÊ©Tekf1-G£RY—µ¬g R`¨'a§n8Þ¥«ÇKçÄHäVÖß#8\¯q™¶çÈz4F¼ Ÿ¶A…¤4—?:Ýß!G,ñÈ¯ŒQ}_üuw`Ñ°,Bë4>òÓº_ü…Z$)ùøÈ/.)2ùÅ·á}@žQ£Å‹’4²GÞ†$9ížütø€×ÏùÂF"Ÿ,ê¶ÈªÐ¶„ª­¾jŽyÈU1¨ª¨iW•Ñ`ÍCÌxA.c«aÚô@k4Ö)œ¶¤
-ú†,n‡!jê6éMÉq8°|Ð5Ã¤>ÁI~~PíœŠ´[ÃÅjC.äA©ç*)BD¿(× JÇuÅ‚ñ¥ˆ©‹Giõ‹`ÿ²’‚ô“A_íƒãÝ÷ûGïÉéÞŸ>ìŸîí>`ÛgÉ5S–šÇ!IäZ¬<¶Z<J+òþVpnÂ?‰\«¶`Òƒðý“3%?±ãÑÀyUÛ„IØçhd©²˜Ê—l"v™é.ÕÞV^H_-£¹psoPUöh.Å“Tt­GÍ­ÿùïÿòf-ª¨§îY¼j–Ô¨X¨¤•Ã)îzHŽta½ØkøÉ¸k•š¦KºDWO`V¨<ÄµáÒ’•Ñà1<á+^«jüFH›'Á}ÖÄ‹/è¸lÑu1æ#—òS,£/‹6¢ò
Þ¼1]Â=žB#Zõäý¿ðç¥Ñ:6T¬Çàîy5å2j1U=ä³`å¿ýëW•;Ør´‰Šw™Â
 ñ0´,ÄÔBK	ŒÓêŸÀújïó‘vÚ\1 6ŽåÀ¯Ü
iˆ¿Ðgƒ@µÓ*¹Š$*Ç¼C˜b?rc/xæÆR•0f‡³Aáÿ  ÿÿì}[s9–æûþ
Xã-QÝ"%Q¶»J#Ë¡›muéÖ]5G)E¦%N‘Lv&eYÃQD¿ì¾îÃî¾mÄFÌOë_°?aqH ‰[’”\v+£»,’™ 8À¹ÇI… ŽSÕb›êR­²{‰·*%<±.ƒ`eî„UU/*‰>!& ŒÒ¸~“F£’ò5óüÛbb¤WðQ³~Ð´´t²Cðm½Ì€Þý+ø
æEN‘/\zÐÉ<^Á°Â.V˜ùåÂ¯ýhø›3>…])¸ú†I2?&"DÅÿ¨D¾ÞlD57’~ºÁJŽj’H,P" ­ØdV¸xf¤éŒº¿çø]§ÓÞPµ%‡ãx`xðD°‚OÉ›$lq `Æµÿ™¾Õ0ê#Ñ¨ÃÁ’×þ¡l®D÷·™ç}3G›”F‘í÷÷lïR
·`¡dR×e½&¯§ü…ÂQJX1“r¥ÀïÈÙ(Ïw¾ŒlG1•é§¤büâ9ÛÏÆ˜û"ûïvÒ8úÜàÿ`4C:ò4.4ÃDÎæA›Ôüñ ‘èô%¹,
åßª’Å²Ì~-þvÖì„€’.ÕÓèv™ˆšÐË$ó î0û‘×_&¢ô5üy›-^à{™èõ·—‰„‘¶L$¨³e"!–‰Û°y~þÍoÂ¿¯¨–§Ü%}Øgùë›_Ñø¥³Ð=KÅe/«ºÆÉ4'÷ÑEaî¿P,\/ìAPy—ÆxŒ-l½…iÍ05ü…Î5UÓBÜI¼Cl»Ö}a‹CÄmèœC©ŽHîò­t£RíÊ'Åû5?§§¤ˆ3d¨i§ºJFqâQî!ø]õµÐ&L®ÀUÊÒ”|Âj»c¯£Àõ¶
H)£’ý?ÀJ±=bBq—Ò	„‚J‘y‹è†Ì³³åy~>còs©dÙ™ðÚ[nÝâf ß•É­Ixd=[<-÷ê	ÉŒÊdn—ön<³Læ£±C¶b°×ÝëeÞ`3ašÉDÆõÜ²ù¹§ÎÄÂ*Ðãùy©H5ydwê8Á´^Iú	}ð-Õ£Ì}â.…jk~ûÎ\¶ZGbp”s7ÆÉëÞç¸[k.yksˆ¾‚êqûvóDÆVýR+Éš¶’ÒÈîÔq†¯¤Êïm%yì®¤Œoû¥V’ƒÆj+)ìN§k%ƒ<=vžnã7ÛGû¿mŸµ÷[ð´ô£Ñ/ÈÆ<zhïï¾=>ØÝ>üõät¿µÝ>aµãÎ9Aq2¯®~:hµßÑŽxL6ö“O8}çrtÝÛv(T’/·Ì¹'’àY*l½ÄQŽ8Ñu3wòHàh}¸ïÚ‘¦,„È	[;Àó1¸ÐÈk“.Û†]Çþ¤ŒjT!éÑUÉb6‡ÃD(íaçâ½­‡—ôýq0ÇIÈÖ~EÎ÷ÀAÚøæòò¯ÖŸ¯’æ6|&O99<Õè¡Ëé¡Ëè!Äí¾AÎywG½~]Ær·zX€"Hv@·‰Ç½ÌC9©J·‚z˜jÑ¾ô…)öäSœŽ{”gžQ%‚eQfsêz¯6ÑøÂ>ÉÜz÷¥'Æñ@³Ìßøagzî3ÇæMˆer~ÐËÏYx´ëkÈ ¬åqNKx~cþW<¤Œ¸vr3\r;8‚&z^¿Ã©M±ÖzÔ„'dØc7p~™S†)Ôëú´•4óTµËâXçÆú*Û`ê©³—â=¸xªdëÉf¦¾±´ÒÀ\ž_ÇÉ8Þ í«^F.„§«Il$æ³Ž^.G;åÓ]ÀÔ‘ðYe¼U$²y5àÉˆ-ÕEÔæž‘=X?A lï£
Ò
Â€Å_º¸Æ·ˆ÷*÷‘í•‘\‹å°š¸+et÷Ü-ÕìÐÃÿÅøm@w6Ù`Š¬`ƒä'À¹)ù‚XÃpãó”žþ	¬•„@¸~¢ë1ÃN
Dy€:ÕÏM˜ÉZ™j+6åœQ­TÂ¡,%t0–{  L-)œh kµÀ ³wg*é@¸tTž;®¤„ÇéîtýXÄ‹@ï+y›Íîm[¿Â@þ¥ÂÕKÎäuôCŸÞŽtŽ<7¿œ¼k‘½wí_ÈöÙÙÁ›ã£ýã6iŸìmÿrÏÚOá9ÈÉ0‘pÞ±a©ÅãdƒL ~ ~dI–Ù{'µ~€õ¬mI(ˆá…„Îbú@2ô†ÈÎEžµÄ`ôKH5(6ZÜ;g@Uò÷¿ý/‡ UÎ½»ß¢Éfm7I!ºïÏ×ÝË8Dò´eHwøáß½ï¬ÂMãþÉ«Çä§˜€µ’7a¯ÈkáP>jy\ŸañŒ]Ð`3âOwéšÀ|áea“PÙè¨7ìM™(ÄŽÆÔÝ)T±³½!@÷4ŸÁVÕso¶£d¬1ß£1”ãÙ*ÄyøN|ÿVa³›Cfžåp†‹‚óŽ-S«c=4^ÇXgÐ =:_É[®Ï«#½®Í*uóF®ÔYefò—¥‡ôˆ½žb¿Å·/')Àð(ò¤_!}ŠOæ­‡°5­(•påpZtH\¥Ñ"ÐNGÎâ] ³\iLÙJ9XÇÒZ[g’öW@ºß¸FMfh;ÞÅXB|,p-y-¡OH£þÜ‡;¹„â_PÜÅB=­‹Ÿ0[SÆÕ©$2›E__0Éæ.È6„Z68Ó° *H¼/ô<(©bNB¼‡OIòš¼"îx¬xBÎÚÛÇ{;¿À¿íwg;(Ð5zõÌŽœ¨Æ^K1×g`Á¹¸%½!yKoÂÝ4ŽH­Ð—¨Ü÷lùdAâ¡¡¡¸r‘°¨Û™›£èË`1x•DÁ ~<ÒU­ï^AN©µv—yµ¡4 <ýÜ—˜»âÓÁ´$)Á=¼£Œaï–½rbxÎã†ê¥Â§*t_†ÀÍ¦^ð`ÝSðàÙ|
ËŸ¸ªä—gM*V9Ïñ¨—ø†Q
ÝWÃÈWë@<ì-è;C~ÕþwG)UÑ°¬4ÿETø@ibÄ,ãí#§8E¸°ÚTÏdÃb0˜‹ÀØç°wtP7õ?9AZølØRÄ‘% íÄ~!ô›ž\°ÍÞpt=vÀøvÄÏHå"´"œPqúrá5”ÇÌ-°”/²‚C«}Ñh4\MqHÐ7?{õ¿\Çé­kûÓƒä
2ééI‹òHzµ¸Á2Ø…ó<1Âv$Ï@îL¿þ¥,?Põ*H…ëlC®à\1=kYGdGáwªôa²ÄùêEÑdê¯’×äý"åv‹ËPn”sEØÃÙTÃj ”-ùt±æÁ4Úš›/êfqÂ€’~qÆÆÊ_°xV)Ô_>Ë*)çKÈ–vUÊbWZzT¾à-¼‹¡h–?Z§ZÍ¬òq÷`+ŸÅ.ù#Íß©¢Š¶)Ý"ÅADL¼®ûÝÒ9 Œx(' ’ý¥ì­œSñ´ñr@a¯„ÎÓ¿,¡ó˜€;ù äÙ²¾·0Ñ»0£ìFfŠdk‰ävŠ…&ì|™íFêÉµ7f±q‰¡¸l ¬´ù#¼7aÏ)„¼¡ÿì2´®¬3¦Ñ!`´qY¯ìÀn! ±°laQmþVÂþƒ3¿ËÎw®k°E°ÞBj»­%æ²š•ÖÂGÁ,ß¹yÍ<É<No	FsÚa4ýÃh†cw®(®‡½÷kc©{ãH÷‘Z{;h…ÒJÐ©…·{´q8?õºqB'õËð;WˆÞø’oK°³6oÚo/#¸WéŸÝwX_
°ã$ñg M¡÷lìa~<ÿ–›`Ä]8! ¤øY<®½ÛëÔ#—]þÜŸ‹¥gŸÅ´ÃÇùy³“ÐŽ¢¡«}>4yË­bÝŠcë‰6øÆU”ÕÀðºäžVÖüÜxÐÐöß»Y*éGàîÒÎvH,ã„ÿßÂï­ELRÞ('˜©~’æms}Œ\_$w®ÊïÊPÔ3BÅŸ×Ä0Äªiã(`ULDþpú15µ15Õ15hLÖ£C]{;\AÆÚàâAœFýn>¾ü£:DùÛJ£ôœòX4&¶˜6ÔÑu:ê‹™äŸÔJ_zÇéæÛAÎ,ÉÄ…;Í>U‹aÐ•ª¶[õÍnÌÖ#&g(xB×ÃÍÞZŸ7P_ï
þ#g¢újèxÁû¥y‚œ¿*‰|‰uU#Qf…Ê-Ÿ%ß9Ìwå*…¦ª5bJi7O +§ðvZÄˆ)vH›<E´?ƒO¦$/åûá-¾’5á+QÃ~Ša¯ü°ê¡¦¦±Ô ì0¥&Ó`Ì h]§RTQñÂ~JÁ—öŠÎ‘ôÌ!ÈÆ˜*Mßç‘ÏW(,­.fùT«¾ýP â;Éáìæä¥òÂà0äÊ±Ïë,(•pRÞê	ˆÁŽfJøçÃ(d7fBã|TpIäœ)’» h¸˜`ØË°$êÊ¥pMø‚~oóîû"?ä^p{pKöKR²î6¨ ?¨1<×ÅEÞoøqƒ•~ÆÉar§»ô¼ª-5zÃNÿºSY¹Ü§|ãUh‚ûÊ+D<D_PšaÚ~BŽ§¼S$0ˆ. úÀS¥$$ç°£R3Äá,´àîáóýæØâb›)øvÙ«iG’Ø‡!xáî¦É¯Ì¯uóUœWôg#[cÿHßW$¥ôÊC.ôlU	Ó{.|¾<%ˆ3­Ê“¦¼õ^ÖƒsÛ¶‹+8@+, â1‚2Œáò¶5‘`r^
P)ÄÄ*á(Exß¡O'È¬*D¹Á5áü.ô¤¨"Xñû#ÎÄýÞÈS!4yËG
i~V;Ìe™>l Ó+—†Ù9Ê0}+uc¢®R‚¥.Ž¼’ìGjxd•ÐÈâšÈB8ýð‘W^	|Êí¥ê-ß+zÝ_kyÚ†=©<éüÍU° yý|%ƒE8¥KóÜ!ð˜9÷…)þÆIs€PªÑ‚Õ'ó`ª¿ÝT ú©T<Ëü ¥.Â’tX‚èÂVÉW}*¼|¥SókRI'ÁöMžý•4bÑ^8ÃaFÉrÃÿT}ò«›
xÖ=R‚”d‚õzµppI•µ¤™ð0s¿º{Gûôëó+ û GåŽ•¬H('²×Ëo_ÈÑ!$cI8®V™<Gc[á²õUâ¬˜®µ[÷$$[]ƒæÂÖv·‹š]ÔçÙÉ G‘¤ãJySÕ4
Þ§ÒŠTL<c3&ŸHÕ¢FR4ª1¿^XÌC lg;¬ÀÚEr9W¤F?M]h„#ãÎ§…R~'›û>‚æ}Þ :Ð0ûyx7mÜ/OIX!ïŽY^ñþáPrgäíÉáT†;=99´ž¾|8f¼²ˆ+RèI9TƒLñCJ;½ë‰Jpz¤„t·uÙPÙ€ânž!ñR¼2b»©
ŠÆ?±™]—rûÝ´îb@5Ûoe»£½	ÞOêµÖþu‰ÏµÇÒšßç²’þÕYÇÜò“×â9wˆ}à°öà<S—UãÛE1F…ó]Ÿ¯†{yç“ìeòÿ@®èÿU?±”­öÜ•­è1\Kd“…ø´A·Í¦ÉÆMQ
sâù=¹ŒÇZ‘]Äš>©-Ï/É'!Óæi\§I€ˆ¤4fãìÊâ7Wõ$@-MÅäùE§e	¸&Ú1,\•Ÿ¢^?ºèÇAì<n4ÄÕnDpZ3 øŒL,£1%oŒ¼Ž
.èÍoxMOZÚ|— éæª°îÕÊðë£Û<aU+¡ê?kwµ¯ûÏ)3‰²·ð.”F¦Û"/{Î…‘´„Çn­Î°¸˜“˜QÈ<,ô0ke'‚ÚDoh6 mßRª#ó ³õix0Vî÷Ö§*ºÒÇu5üþY ,QKœ	tìç÷]Ë‘Àe¯þô>ý
®à`Gp¡ðÝ>xž¾^y~ƒuGæµ4dÛKß½XU¾2w`n„ºG«7æÐœÎSÕeœÞ6“´T~U˜6Ð_%í³Ük%D’Ù\W²ÝäÞ\žêTôÖX¤µïCÖÊ>šŠ^˜jþ—ª“ìv¨ætÎÊäNW«‘º6ÕF3™VÊiÈP¯ÚTÑd†·ÿýoÿ9Õƒ&4hn¨8ž
KUåV‡Ç²8@tí5Pi>7†[ˆ¨Š™`@àâ‚Fà¤ërÆJŸÈa³&÷3uuPóÈl8@6€Uý^Ã}Ê=Úï²O	SD™=´~p\ß}»Ýz³ÏÔ+²·}övçd»µ§ØF'Bj0«cÚëìEÙÕ`?”Ê„•¸1">ý‰ÊTž
å
£|G@Ë;Ñrdtk­Ávf ?ÍÍi ~*%'!v¶u´³½ÈílŸûáIúà® *€xvyEÏerSÿò¤°Í¢pÑ¿NÙ8Xªw=þDß/ã	ôFjñŒDµ÷Qå"ÈÞGï+q—Åtü{}Í$r…q)K]ÐrÊXÇÖÈŒ9ä|ˆ¯rˆ­BáÐïaý¼…Cí%]íiÞQUþpªÍ«¦ÞÓ	f¨£ÅS…haËb›!âXØ\¹jZÇæÖ5–œ-@‰EÃè‹Ø†:eÕâY‘¡˜W¨0^ÐS­eÙ
¨sÙ2àÈ qf YÆs)‹cžÝÚ½÷bú-€àÐ(Õƒjÿ±ßë ¶9Á%ÎÆf«šÅ’6EâvvÎÒ÷“”|GuH³JÈ)« úÃ—@Ž3B(Ž3"v„ØëñÐl’Ýc…&<RAœF5kÁÖÍvšŒ®nu‡‹›`3Ã)´ÐG¾é$ƒÑA½ÔVûV	ðÆn·`ö a|CÛ|ITŸ«/·î²!iÖ¢W6T{+àtÔÚ€õLùxsx²³}ˆ2	*|«Þ¸€ý ?A‡ã‹ÇhâIð˜¬Ž0~©¸Ñ1eû—qz”]ÖÎ·;˜Òý^<ìAéÒ¶#•°Æ,ŽÍ•yÞ’¼öA
ÀjCRï¯ð+âK+cº[jœ/“Å8M“ÔþÏÌrŸ¼õ—,³Îjlêé †tSÚ¦¶¦TMp£LhIÆAÒ!rFi½iÆF²#™¨+ò|í3Ô$ö1êg,-ñ‰‘¶Ëˆßüû—2ÕÒ›:fƒ*»{i	m¸w(Ðf2BÄ4†v0ú'?¡@¹,&’*Å¤"ª³–¬z5<ƒOÖaúÅÖ$Ð—¢ìvØ!îÐQàæ!gAwÜà@çùCˆ!g¾¯“èºÖqïnèV´ä:d2Q±=“°ï8ùÈ8£¯•&P,¤KžNÄãÂm($t£uúÉu—t£qù·OàH~³ïórZö©JFZz L”¿Ï]­
(€Â<U$ 3Šâ:«á(‚¬„¤È#'ÌGÝô}új­8ê×±,Xö:’Ûš‚4	g4Æ®£~M°"F`:+o±GvoT™ Þò
þëÐ_bPd—‡åUvùµ ¦šv/Î€¶i.®¢l6=(›6ú˜e³*uX¤"°&[@ÄÒäèÓt.Ù¤ä›3s7&ž}q9iv«5ÌÈ_èŠˆåE‹Áæ¢š|…µK©ãÛ!;l¥DTê;nÕÒŽg¯ÝdüRûV×ÅxM†¨l\4…R°‘ J¶¾qý ë?3G?_%šã»©:¾Ÿq0qWD±¥@ÄzHUzk°ƒ'……ŽËf
ÞÂVq£k."r¶ï\zãH.´žÌ±ÉÚéï:I¦¨¯cr`7³ÚÅt’WÈqþgí µrÜrFƒ‡Ï±,ªHSmSŒá¿ï |hñ¸µøAJ¹W=d~j»Sñ›Q%€¯¯Møþvf ¦‹ÝN#ÚyLjg­•ö¼ÖZ iM»ÐOWš¥Ö[—š/µ0y(Õçtt¾Òi×º½ÑP¾ºtbAÑ!®×óYdã×šÐ`’P2ØÞ!gû‡û»í“–×Ù†"—×KGVAŸ-1Á6ÁÔ€¼Üë´£®o“™DRoUÇuÄ²âþ(dÌü]¹ÃÅd$.£0kâ§12,Åb¶ ÒK©BÀ$”2Hbá?¹‘ÑHÉÆfe.7Tä2ä!«•¨1q‘ÒVòí
’y/XÕ¢êÅw$ 2}Ä$¿Ï·@G•Ò%8‰²³)znÉw)9Ü\2GCŸÜÄ!_÷ãô› 1í•¾2CÃ~olrÓ9(%ÆïA¬º˜Jd8?ÒþpÄÆÜÔoÈø«|Äuš²w®D[ø=¹öq”¢¢a¬QýÖ.ý­m$ÇRÆ{ò®Õ&­“³ö~Yœ8E4™4++ämÜ	%<ý‚Dyª“ä½H GœH½É3§Íe<)R¯“ô¬ŸŒÉKRËè¿ôÈ?è¾ÚàhÞ_QžAjîMÔîÑ¸’ú ¾õ¦¿æ9B·y9­Áî¹Àê'ýfÓPøHŸƒ)ßuWrÝ•Ò\õ<h*®A&óM„æ'¬>xÝµïèC¬J1LmœÖÄ
¨/Ž’]°Ã·AÛ‰úÑ°Ûb*Í}ùªX=WBòŠ¬d{j±+•Ø”Uc«­îJq5%¶ÚŠãÞò7¨”ÓºyÖ‡L‚j» ?ôËŒ•kº¸C¨]Éžñiˆ[ÌCÑTÿl™¨Å0x„*m¼¾Z¦€Ò[AÕ±"Ó0Œ­aMÔt…ÖÍ-$rBÏ¾.äã ]Ù˜á™Üžö'c(*†Ž­IV6w’¾¯¤ZhQ5µ¬Úä<n\6ØBë‘?’5_vVOB·i2€‡`¬Þ
Z¥âj»jUJ«Aƒ?Æ·{ÉÍ0 z]ÀÃãÆoñ-ãû°t‹îx0vÑwû1¥,ó¥½v  “áUÝaXâ¹‰HkfäOt 1D#éo›u¢QôºÓu;íkºWÙ%Æ.G0“%NÌìß¿”bŒ×LeåÂ{7õõòÛPNQºçÝ[ì£¯¡QÇ]N(ˆ)
¤ú`6jŸŽ¦!¹J¤¡†’ÄÂKôÀt¾„JZ½ñmý‡U{¾é+²Ò×v-°·‚Ü½ÁtgÀ4‹¾ŒNu\¬iÞ¹6·%úûÿùß3-Ñ¼‹¶WÎNž‚BÔc rÝdÃÖqî¾©ãú˜²Qa©óà¾É9}¹™$!‚Èiÿz*p&þ‹ÁÕ&çÞA ßÝÓA¢`ü¨D,¶1ën7DXõŠd55-Àz!\ÉM.c›X·x–ZÝÝžæ6ó†Š‡™‰ãxˆ
Ý6]ÓCR•b»á¹VóÜ0,Ÿh+RBŒ	’æ#	Z?u,"å‹aéþ
·À›¦„\/È<‘6|@ÑÆ¼0Ÿ^¶sÙPB³üÔš3—\.xüàK–]!g`ÁÎg|ƒ`¸ùØK3—²Ë^nÉ±ÀZ|ßh4òf>4à§Z-Z&â7¶"ÊŒ^ZÂ®¢à ­H‹Ú!¯H“²ô57°1\8Çp<†‹©ÆÀMlu6!NÊ©y=êFl•Àï¼‘“×ûðšNº}WëÇcÒ£·®þ3ýgSZòÜ^Jzü£o«KÛˆUüå[ê}üWþ'oÎ9 ycñvp½?ŠÆWý$Ik=²¢¶¸D»À»ªôÀ'vàÌ)Õsò¾÷Á],‘Íh½QÌŠïÉÜt½!Þß-Ç»ß“eÖd‘ˆQo'¯{ë–¤q¿¾çhU)«1ºÎ®‚žt¸r6Î(?Ááÿ ËZ¯˜ÿw?ä ,ŸŠ^	w‰V%“g †on‹/Bƒ	$÷÷oIÔI“,# :e®>Ž¢FæMéqªWå°`™ëaDy‡¤bIª©n‚‡I=w˜ÔÌŸ<ò·[º²‡kZ³åÐ›#ü¦ Žé‰åÇæÌÑŸÏtk5Ïa–—ÂCççË±ŸN hDîA˜»ÀåÍ±•"ÄýôäqF-liKZ+ü…K^húR³¦ß9ð¬%<0ðÍS|'>‡ÚáÞX.÷Ÿ;0™á¶ ÁbÁÎ?¸ÔÈéìªÓÙší`òÒžŠ¦	QISPh*Þ}ÐÊƒQŠÉuŽ,Á^ÄêXþÊ¶jc,`´mfápþ£G}%'0„x*Và+8>Qü:ØžÄKïÚÌ:Š˜c
d0À:÷/]þ¤Œ;8§ìõBÐÐŒÖ¿-²‚¶b×ƒËhnÅ*¢qªüh†!6û4f,hÄ°	§q«°+7æîÅTu0MœQ/¾¨QÎmô‡+Ä¤êô­¼½ö‡z~ç–~‡TªdG5üÁ…à7TKn€cÔKµÅ×½a/»¢ª&èIJ¶™†„a)ÜÎ!u©(ãEðaŸ²ÌW‹K>ÌˆüRÃÉ\õ?¦Íò Í%Ü@XNòXBÜüN|††t¹l>‡¸,ÙÔïy½®¨Â\Ž#Ô/ß^õ+éó¯[‡K¶%3ò£‚Ò0>N‰Ù²-“#,†ë£Òš—Ýz<ÎS¿ÊýAr”¤QÀ]b›Sççsð«éùêîUÜùm·—vtœ¾ª¾~®À~GÅÏ~L%§yxR\@¢Þƒ³ì~{Ý·“ŸñL¬=ùX|pò9 ;¿ÿµÍÃB= éÒKxöaQùºp/Kª‰Œ\+ÐlÄ¨Ð¬`®&ÝR÷Òå*NŠN”v3@áKHF?SŠeÌÍNþNÒc‰vo da*Êç2©4ÿ0ÃtÄTÎd_ 9¼2ÿÆ+¾ú¶„_7³þ`±1}fg§#È"69gøh\z:¹ŒQØ†çw“~V3àËDÙp6dö²‚„¢4tPfn­&` Ušw0£´Á])¸±Yˆ|8ÌÎG †ãkþG_ãè‡\lZwdšÒøM¾î^Â-Aý7§ê¿éï¿éë³1ô¶†Âä¦5¤½íë<EÏîÉÇÀ•ÕÁ¦Nêuã„Î@@U¸s…èÏZVMØXÑÈ¹VYS­áš•Û[~Í#~˜”7gNc>T^«\-mú^%“å;Àu48ëK^×7¸j•?‰£ z°[¸
:)ƒ\]m^…Cª"ƒ@ï4É6WXÿ~¸ùšˆó@øº|6ØbþÂWï¢RÙá@£\SòËdt8çÊCY–MOJ{…ºÃÓò<æl7çç5ª°ßô`w@$*tY9:²j¦@€WÐI†è°T„„4Æ:k’Ç.ÑÛ`_ààçÁ6üÒ9²*Qò%›(¨ì|,&Ä@a„Hú3m?ô]æÂ _Òü†Ç2ÈWhY¿ù¤òZ@ýXiø(/ÀÉÁ¿JhDø”p¶~²Bð4øÍ5ù%G`³´aó\2Üh[RµÞ ™Ë.È˜#†_µX™Á±k4î¬W2î<ÆÕ’ YÊ‹¨Bë^,­·êócÖ°FÜ²‹+S,Uy…Ä9Ï’c~Sµð ¥qÉøT¥LNˆ/® Î,¾&Ì4¬ÙásBE¹ò>)F«ÜçrF‰}_(µõ¢¥¡ÔÀËŸXŸ2G¨¸Œ-$ýyRp;2µ(H)od~4^‘Õí$å¶rŠû„a²'Ö:ï¢í2’ézžÍûÂõ½e‚?1V‡ôkdaª@!ÿ[sØEaË¢—¼¥dâ 1ÅÞ9É²žá
Í|†KÎ~^Àäç£µÕ5BYöÚsÿÓ<Õ¶ ¾éñ5`fïó=ùÁ]a£¸*ÔÚ(.&mÑ1T¨¹Q\³_Êãò_˜Ä—Wýø<ÎÅnx~™¯¿£¢A‘êTá¯~Ò‰úgTÄŽ.ã$Q*®G£Ñ†¾&OyÑ“;*€ýùìä¸Á`è¬Á+„Š‰a|†‹ªÐpH³~'h$8|gÀaÖRž+%<7¿Ÿ!áÙ“ÎvÊÛPÖµÂR\À$NÎ¡×64lRÛm-y†"¥Þ´ÄÔ>×yÄ<ó±š‰ªZƒ=›TR¦ÜÒËrÜ`)zjNƒ1EG¢y¾Pk„.Uœ‚/dó*<ÁUl]U;1”EŠ²Ñ8'—RÍá™Â 99°¤¦»Î”|å€ ùÜ½ý?1Ê¬‘[çÂdáÅøX©0•|!W’W]|€· GYÊà½BY–?°Fôð@6ì
cl<¿²Ês7Î<÷~ÊÂ“”Û„°ñP“G´<³ÕP´d˜ø\¦Q&]ód~As¡ßŠ'f˜7_‰ØÐ¨\Ü­û+2ÏH*ÚiMU\J}´ÜHþt"–­(eN¢Lçšõ½š.t{Hè:bâÂÉ²Â"Þû²Lc4-Ú,M>œšzöCæ>ÈPªH¹Ã±ˆ
²'¯eñ ‡BŽ,#›.dé²4,Ë~e2HãåÛK]XØª×ór ÅŒ“zÝWM¾&´ÌšÂ¬—¤PÊ0™G®2—ÊUæðC˜¸þ?iG×JuãWJUã—HÈUÛÃ[a®ì×r{ö
wê}~]FSGšD^yÔDªk"ÂÄ;£6R.úÄ”z!L3QÖlÞ*	š—B‚#—ÃEé“oV1a3øõ©%ÅÊó?ïO%aí?*$!Ãù’
I)þñëVI

/$ß‚Ô¿.uDeÜ®Ž°i»eä~—dVUD›øGUäÞUuÆç¡Ž,úwªŒ|ëªÇº¦z4U¯NõhÞ‹êÑ|T=Š÷›Jõh~¥ªG³P=š÷¬z4Uáü~Tæ7¡z4ªGóëV=š_HõhÞ£êqoK2OÕ£ù¨z<°êÑœŸêÑ|T=|íÝ›êñlƒ2Zõêú‡R±~6dwtmÄ2-V­½=ïX,51z^:ˆ å[ÕD”Ùüêô‘-(_Ü›n¢ôò¨¡„çj(FX„¯ZI)‘½x¢Dÿ_•Âbâ ­µ(3x/ºËƒ¬ÑŒŒq%Õ˜ûVcLÓ>]¦Ää5W{÷¦Ñ<ß np›Gå¦ºr3ºNGýxº[‹vã^¸9ë8þÒ¼ô>K²z#MÜ·ªÝˆyüê4…Ä‡{ÓhDÚLÈp¾ 6SÂZûª5•Ì‹‘èý«Ò`t~þÐÚ‹˜¹{Ñ\î}]fÔZJ³ÿ¨±Ü·Æ¢Où´…i?j*®ö*i*3Ýâ×vÊÊ_®£~o|K†]ªÊRÞâÑjtåb„0+YGQd48*ClÕ:	CXÂÁ„qõ>{ëœˆg€”ÜÒ§*JH«Ž¯¹´£FKKEð,öè”¯X›;ÃæÚ¡ÍÑ/Ü%þBÀÏÄå®!k>«ïŒÛÃÒ’ñk­á»¥š^®º½½ÙW­ý×û­ý}²wÐÚßmŸ´~)‘4íN;º`¶\Ø„Ò€‹&ÎUñ‚DÃe‹qýcÔ)‹0ÐŒê,ŽÒÎùŽ¼Æ•µVw³Û
ŒunêÏÛàÖWäÍldÞÐ–Æ}ºá>Å„óGÚÅMýO6T¤Mþþ¶rYâHˆ.²¤=ŽI?þ‡Ê81mÞÜ¬fÈ.¤@
ñrB@¸9*'Qn±CÇ­ƒ]*:ÙZðBÖÌ_®ãôÖv‚– „àG~²¦ê VÆ2?1¬LPêqÔ¯ÿ@eÉ<BU’WÜx2æ‰1.›/…ñ®+$]m(¸nÛC±dlK©¸bÅƒS,XàJ™Wéså
‚°³û«ÒdÔï/l²¦Âz3Ÿ°¤µrÐZØ:hQ©ì 4Ä6¢~ÅFŽi#ÇÐÈñtÏŸÑçÏàyäšnÓ‡Ûðp;èÌ{/d¿9PkËQMÍI­ˆÅøI­¬˜Ä
ÙÅ2Ï¾µž¦žªÉÀÉÀsw¢Jœ»gG­0õÍ
=zaKÒ©O†ýÛPR4ýæ’ÈŒÂ¨z¼×Ki«IzKÚˆÙ:»„c–n °ócŸþÍj	,â™ÏNž1Æ—+Ò/%Þ¢—›ã«8êZ>/V«9*Š“©0€«¬ä8uŠ÷cEÃ¼…¿ gUGPôÙ\_Mß ž­°ñ¨45[K:Ã™¥-a„>[SP—•€Ál¶frÎg{£]gÖñ0úK{—WPÑ¸0ãôW+ÙÁ“t[Ø7ÍEÒ½•ÇB·/Ýõ[ÂÿÈÍ	ÌÅw{×W­ÃÜ{àxyEËvÛ^™# ÍŸ\O LôÜÜÔ'‡ÉMœîÒM\[’ttE¨Wï‚BóÁmv¥!mñÁ:Ë-eSuè¶×JÓ	;KÖHÒ4SÉ)ßæÅfK/Š$ßŽ7)ø2å›‚„1éaöYg&k†G%+:yEjOÊ…œðLõŸ”êN`s·T‰’úôÌ>‡<•©ù»ï¤ÕÈ?@S®–î\qÂ*¾kµh™\ »¡`ãÝd øÛµñÃ’³=VmkÉoV¦¼O6%KGŠ€8è¦ðíswµƒrÚEŸef¤Ïõ}LíÝÔ¿'Wôÿza‹¤n¶ÎG#p¦§°…²€ž®’qTxâlö—$K;/ógïHÔ¿TÌùeyìŠý“\ü•8ëXYe˜%'ÓÓ¤ßëÜ¾\&õü«`Øp¡ï!ñƒÎU”nk«!ôAÑÁñ$ ,•¸3 =û‹ŠÜt×þå—ŠU	'ñ€¡k^¢¸Ñ„±¼;ò÷¿ý''­a•~CƒT‚ªD­Œ»ÞØ±ò1¡ÙÛŠ‚ã[²3jÊÆçr…·2,ãŒ…¬ŒÑcGÍ·É)¹ù‚¨"˜~¯+Rß×ôÔwõµåùy¿úiÂ^]ÅÔ›ã«ßçŽª¢V5jÌ$OÉ’ÓÅéÅ­‘ªí-4hŽq@îè½ÚÞ)—~R"€èo¡aJÐo '$²)˜I•@ª!Ó/+ÇmT®3E‡ÙàW)|c
«¦i@³Y8åk¾a¿£I”Hý½EET×?ú3Awz?~<‡¾Ð9¤5¨‚P/l©ŸgiXƒY¤MkßÌ¯ñf©ñæ‹¶_ÎÐ…	–å‹Yš®r0ÌFè¢-+ŸÃþœüa¥¬ª³2—³ª¯y«îÀ%8Ç}Ð,‰2[AÁÿ8\åá~V”Ç}ðßÔ›Ïüôãµ|ý®„¨Œ9³„uL_ôË‘º4š¹G‰†·ß2Õ›e)>'_¥8²«@œ¢^Ø‚ÿ’ÚåéÝ(í.ÍÂ|v)Ç=Ø%µ\9Öév Ô:K³í=*€ì‘Z!„@iÓKJ³´º{¶Cå¦³úê×£8ýÔË ~d'™qÞlíÿz´}ÖÞo-l½H†£(£8Ëûïï¾=>ØÝ>üõät¿µÝ>iÉÙ	|TI¶)uðÓA«ýŽ6Ïc—¶~ê¥cðÈU–ƒïYlRBŽýPÛ?Åé)ØëRùŸ*‡	‹ô`ù]x;ñùñh)°)¾Ÿçg¨Œ#kclVHT=ÀÊû¥-æ}}ƒm·wß’½wí_ÈÙîÛý½w‡û-wØ;ów®âîu?Nçù^5šýù”Ñì”.Ò1|?Cp»e¯Ö}2wüVfƒ¶Þ„`›Oc—G‡¬]’cy1,šˆërcÐ¿N£aÜ'b¹][hsåjÝòË¨´•)§U]xƒ1¸:ò+S?‚þ3(ëŽBSÈU~ÅRðŸâ”.ˆ`û½Î¸ž|¬#ç¥²é@¹ö¬±¹2ªXî¨c®Õ-·	ˆy	ÝœÖV/YÂpˆ–½î9ÇÍùëÓÉÝ2arS[¢Â‘õVwƒÿ‹¢ï›Ã“íÃEû3B;?z:¨ãÕßÿHÖV×Ü=_§Šûš£;ˆËÊèáLïý‘¹àè¤P§3½îobàŽ&ÀGvÚnã¨‰6´Ýï‘Þl_¢®çAˆ&¤ +þ‘´ÜsÜžÆ]¥›Ý«„¾ÜÏqÏýïálÿpûøÍIËÓI†^8¸Ÿo°î¢å^«Ž ëï©Ú¡/ä² Â¶f@­Ðè3ó*’l¿¸Ý%í‡ïÏ¬Ÿ0—M¾“#ÑpcÑ)á[dú²™°àœ„rzòÕàÎUðËÒüè3=	1¶\Š5/¢yl¨" ¢‚<%@¨·~§ýëÌp,Û3”ðˆÝMcˆ€e'2dÌÚÞÍvVU‹Àf-ïR™9#Ãysr3O´ž  8¬Zã{,$…*·)nJlÔ­#6ÊÂ(×Vé’È	+ë«dÀÃ¾\³ÌØ²±·àø ´å«Ê7}FØbwÉ/ñØÂ¨,½él”ªEÀ™ÈB‰|HtA·pÒ‹ø’ž—ëŽl¶cU–kã˜G¿=ò©D™‡ßpÐ¢v©áÛ+
ìÂ}ÄÞ6«=Ü¸¸½BëÍj­7C[ç€_¡­s½Sø¼=°$ýÐDJ?z°qKë+QÃ„5²ÚûÐ-À"&òRrš¼ˆû	dâPê_Å”[bL´Ú˜Òð tÁDNYöçKå‹Ê4•ªÌù/Kë·,Íör1/ò€ð$éÇÑp‰Áƒ`Ãï­Ì6'60 }LJœ¹U|`;¨‘K6]Åƒ­>£Å`;£¾kù2w«öÆÑ;³ôd§†ìÈ¦V‚¬c-š7<qËB™t³=¥s=nÎ¨‚šÌ*)*~ÆdHm]xSdýñÌÆØO9Œ‡·¡f[Äö˜×G¥°5ÙºjŒý0ñ5æ:ŒR/ÌúQV!Vbý|Ä¹–‘)”è;bf?Adäm‡:m„Û&g€èE5W9äèýêTf¹v†ÂRJh­*VèSFÑe -TîW€%–sXwoRi4•J¦_²ûåˆÊ].ì=Õ6pÖ§u¼U‘”ÂV&È#eU®8Yä Ù9d«W`öB9:.<4NŽ+"ã ,®RL\XT\¸™?8 7uèAxÔDU¹ê¹åP<•¸ÎÃ‚ö(ÉRaF	æ†ÏåXîü®uÊÍp7×Ô¼›YL7·ûq:Þí¥=÷X ™†r-!‹ÿ¥CJÇò<Iw€¤;EÖUãßè6ªg)œ‡Ý–=¾XrÅ‡5CÅuÑä»ïmáPÓ™ÓÂÎÁmôµãD(U®®àE¹óúûÖrù
´œË——!sU©àÉO$žÄ»fæ´2—÷ØÊgÃYj ;Õ7 š¨™QT9™@4¬ÊÿÆ½qŸ¶ËÞ†Ù‘|[;²«fk¨ô°ÕÌ©Þ5Œ;nM£˜ÎD’fáí.SJˆðÐý2:ÿT­+>6™c‘'^âQCw¿d˜6à{¯¯za$ÌC©êKíè‡l^ˆTÏÍÓ–D2èÂV ²åQ£D±Ó­Ãwû
ˆ™7ð(h)¯NhcªG)ŸÙ{ÑkÕârt8‡ÈU½Î\¤™û2ócja«µ¿w_‹¬¸óîm¹kNKˆÆÉM¤ÜSÂýüÏ«AWú¸Nú—ÒÇçc-üxòÎ|`Í€B´FT`2\IgE©í¶|©ØXÿ¡ÖÕ¢z1Bãµ§2{ÌÉä¡ŽxãÇŒâX5ÁÉ‚¨Õ –ƒ¦ZH¨Ø*³KTÐf‰Š« 5ü›jVs	cYd°WˆÕôÛ6Âì¡¶ˆ¹P~Ø®j‡”\uíKžQš3ôk8¤´!?žR_î”bd¼öxF•îúÆÎ¨æ?£š_ßÕ|<£~7gTµRãg¿gÞg”l·ŸÏ1©8ÕêXßçYe
Ðú
Î+Ó°Ï¬/vfi4ýxréw}“K*Â8ŸƒËX§ò]zèçWpléC~<²¾Ø‘5Ky± 3kê¦«½døÚð>³æ >Û §­ƒã6ùŽìÿËéI«íÎ>?’tþõ–³N§Ê:=MÙé0SÒ©Øöà™»³8>>Ë¿¿ï¤Ó}¤*2‚×Áb‰”ËeRÅ8¹N¡Î•¬.èùÓ;(iDi—ÒïEšD]:¿ã)²Mgòåº£o‚cnnzCJÆœ…š•oY¹•¥zÚ¸wl\EÈôœÒö4&öhÅÂ0s!ql$ˆšó—û\g&?ÁÔcî‹ƒ¯œÿ¿ÿû?þ;ùÃÓIYsˆ¿þªäò]{{ÿÇŸOŽ÷NÈîÛí£Óƒ“ã³·§‹w¤^”Ò`Ö	@jüÁ‘@Œ=ýÏÿF Ñyƒ¨ÝÅÅIòä§xx]ºå|Éïq÷R¼œ­PùÑ
‰R"/Ù¨&Uù>6¸~/J?ojÂ@©ô˜¥Ê¿‡/>P	øœ¼Çïãlƒ×Í-ßv÷áœ@ÍÞ ² çÿ:ük¨1NÞ—a>wð-Œ†ŠPO‹J•yÕÉ<Ùiiã_‡çäQ©¦=‘½^	ì•˜ìB<<dð§:Ú&3õ-Þm¨`D8p½,ìS	H­˜NòOÒ÷ùüÁfx*‹çyðì¿ýXï´	-âü%¦¬°`ÍG#d}ê]ho„­q“ÒsµMÏ¸Ò°SÂw“Q*h?_Eãl{4";9ä'!äìæÝ=q'…óL7r˜Šì…Î‘	³ÃËQð9ÃÌÂz…qÓo•Ëx
‰	åµû(á5¢|9ïEP/97Ü”Aés¶œ¾M5N•N_"·8-iÜ””¬"t5Îj›•E`cæy(p3ƒ”YF—8T.ÛØrÆË#1r(0£QŠÙJ·yotûr@2Rkì.Í,c—BÞ”7¢k&3&6´ëOgŸžýcî…í|¬›·¥æÆz,IÏ
t"êáTÏ‡uÕîve¹úâXƒl¶¼i›bÂÂGÍ24ðÁd¸hiÇ`–ì÷«Ä”ƒËë®ä¥á6\ã	|#!+$ZyÊj.ºÐ¸-£’»î˜½rcÞ^¿‘½Ýå—+NZiÁLdí)Ù(Æ¦@ñÝÂyRèÏñ8—wghA.9K3Ñð·©.‰{ÿˆ¯Va>† Š…+¯ïÂŽ:ˆ ¢!Á1éŸÑMöròüN›»&±o_Yèê£~¯ƒ˜79¯+À=níÆ¶ˆcñNhâ`Yr(åáÂ²quÌ[T¬‡Í$‚YÕÒ°‰òtŒ|ÂØ±\NHC	¯Ï©sK=+©4ØlˆPšTUƒ¿ß¾´]Ð7x“feÒðQq‹‚4¿aO’i\³CšZ—]M ¤žµ·÷¶OŽ÷ÉîÉ»V»°Nœµ[;ïÚTÁ";'Û­=R;<øiŸ´§zq×éáö/KŠ^;É:)ˆ¯è”Byi@{½|ò%•&OÎ¹¤1ˆ>×o€xV?Ý|ÈÇÈÓÉÇÞ¸üŒyzª/¢7Bdƒa¶X#QÞÌ‹UÜÍ…ëkÄï®?[¼Óý`çÚQ†.¹dYÄã4é“(-éò¥÷¨\‹›þ•Æý´^½(·æ>£úXb½¯dŸyVžCHQâSSF•»Å;}
B=1&$‚ÒÔ”FPàÌšŽ…þ fúiÂè‚IÈ9¨l\Ÿ“Ï~oHÙIù­qügPcÕ÷Ïé8ŸóAc)Q:LÁRÎïLv+ÛV·%¾0F'7i4²pü ý¨ó›†P˜
øØžµKò6ºîgöZëxÄðS…;»ŽÃŒ€`Ä`2PÒº±Þ ómSëëŠ¼ðâö²qÚ»¸KjÅ—´²šÍ«57‘2íí6;·Ú!½âßl_I«_ÅŠÇÍSæí3[ÞæÊÕšñMÖ³5ƒâlÙ)lØaf‹{Ø6éÂœ€)ý•J9f÷ÛQ@¼i<Œ@hd-8“„Y—ÿÛúoj'ãÖ>³ð’±¹iæ=œÜaˆ®,Çmêc zÚ—OôšÞ÷öR¸ªhäõÏ°bÑnëû´oAJq&t?~GŽ™ã
5e·CeN"¸g<ì’\BënÜ0Øò°QºdåÐMÂ’iBöáÍÓCê¦þì{ÖÍs‹[ƒ÷¡æè7€¯—´‘è"Kú×ã˜€ý
²²“ ØX<JŽRU¾âTJ9*>BNåFÃüLc‡²2{æ/×qzkÖ\JÑ¡P·F´¦†mZ” i(ûTÈ¥´0Ÿk9ŽÈGišãB”çÄn*æq zÄ‡qv—ã ,Å†œD‰E’0dä¸{ Ø¿XhÓríðCÚ£ðuoL8óo'——T„ÝaÓcÜŽÖšòd¾.ÄŠÚIÆ0’˜¢1š2úš%Í+ž‰*:Æ–lY5**ås!ôJtlƒ¢ßÀÇÜñ]Z`—©)ª{¾e°CšD·pvÓƒ3TàµŽÈ
X £Y ˆèŽã^FèôÐÛèŸ”XDÛB¹#ãQxÝÒ­ûÜ‚•¨™ñN]
¥£Ú kœ2Q …qÒ±ño¬žG’;=¼¸ña6:ãfæÎ°97UÏ7¦oN»Àtºrà*~³U¾×x÷²bFè2nõ¨N×û÷¸éä¾y ]æÍ£ès…'Œz€®ÝqóÄaz©ô¥sqÿ3¥.øŠ‘šxí©è,ø”TCF’‚æ³F³Ä€ÊñŸX ì>WÃÌzI­†¥ö¢Œ€:>¼\bvË´×Y½í:‹ÓW4¦e?÷ÆWµEªÃÿº¸´dd Ü‘‘^Ù‹²+â²–ô qŸjØ0ëÉŠ8¦Nrå.¬[voh×-ö“ËÞÐÚŒ‰ƒùé}šh´çóŒwtiü0¹<¹‡‡¢1ÂÆS'®õïKŸIÈC„+ˆ9zjsˆMÚ æ™,0ŠÅ™ä¡XcÖ“éƒ÷Íf¼2Ø±3}ca‹;¸Þn^	³††+èÊ¹¥ž{((sIúý‹(eZŽA5~¿He²Åe=Zú«ýÁO!³ÿÕç.˜¬*£E%‚4«¸c`ûôÄÉ9È)þU“TJ«¤¬M¾WµysEg–yf†	Z,’;!iiÌ"Ìêš3Ióâ°ÉòeiÞ­–÷‰¹e³po1›¦ùû!Å@DõÙ•¡·û,Ü0ƒl“±i	B¬m¤`W0ËYyUÏ"ÙªÍ+(¡Öàu–±Ãˆ{¢r?ÕeŒïMì&ý¬¦¼kn.”Â-ÔÁf2Sõ0ôf6ËDÑiËVmeÒKÓx#+w"üÝ,äÜSX%kC!Z®”
Œ£3”,1/Ê£Oä:"ÜgªÀn²‘ý)4I,¦ÚF}3´“Üw³fî]AóuÞœ¶ó¦¿ó¦½sµ2’¿ó¢$¯ N0öo¸ACì#Q*(ù¢eB¡äþ‡ß¹¢§Y/šêì°Qc	0hÇ– 6!ˆ%°¡,£Èe¬ìýc|¿·àcüq£Ø	 qÔOÒÜ%göOæ.îErgÊÅ’ ¤Ò÷Ÿ×DçJU'©÷cX2–F!¾ª:’¦6’¦:’æ½ŽÄJ§ò˜ÚÛùäÒVÊ¤ü˜¾4?`l¢”Gø“ ±´JÀt|ü“:<éKËèL‡·#šÞGoˆˆ)Ê7M;#º=º{êã¤~A>¦É@ôð©ÉÂ["~PCitÈ¥.yÜP³ñ<‘)j_™¢eŠ±ºtÈ¯Ã¡_¬
]¤<øé<öa†3hvH †Æ”ÊØdƒ<Ü§	á>M…òX…y„ýHÅ+‡ ‰À ×dÁ%ˆ¼‘Æèñ«±BL®×Zt†úa+üYJ–-ÖòÂx¬”+¢=ô`b.lÊôù’íaË¬³#‰‡™þ°S95\õV=dÑÄž5¦°®6mf2®ó¬Ï	áÅª¥7›GeµYÅ÷óT“ÊÔY–Çô½9ü©TšïýÞñFö¼Ç[ºfÑÌšéó?§•Ü¸ðßýçW~æ5Æüp-bPéWëîcvRHL…ãü_pwäëœ™“;/ôK{K<yIJÎòUÈµ%*ƒÑ·´}ÿ–¤7‰t[	KC_JKWÉÌ¼_™L_ŽìÕ2Yçž¬@¸€ <{å\Bßi V¹¢Ia«GÆBJ&SmÓn)+®’@ÃElìæ/vÝ…tÀ©Ï{ŸlŠƒSYclûðþNÅšÂnéyÕX]ûà(\ œoÏWuQŠ{ßØ—¹µ/¬sÅ\‘£¼•n”]Å]¥#*oû&Þh',.obV`„× 7¬ßÔ™à°§3•É¹%zXæ¹‚uØ£JE<6ßO'x:ÓâšðÓÓ7meÑÊeå¿¹FÄqz=ìDc{µ6-êÞç“Di5èÀª2]o.(Ï›ö¯øbsm{’™• 5e–ÅôŠì“&Ël°/,.×”y\¡ÃžqãËJ4æ	w‡ª‹Äfñ9H²3¼º’[ÆJÕÆëÔV›ˆ ’œp…eCb“î"Gr°yžÌYD"‡= 6i•z£ž»&AÂ¶gBÁÐÈjä`!Ðï]‡ ;ë¤ÌK”/ª”Yvymš$‹E—S<%V$|†–X²Y±hCæÔBO«öÄó¥þõ^m¾BÌ;Üù…¬wÇÛggoŽ÷÷ò¬Â3òöäpïàø9=99äÉ‡%äËš9®‡àŠmèr{=)û½ÐS`r†É9p×5Yw/È	ú±!²ÄÝ3ˆÚ¼¸¥cT­Œ´,C¼Ð›ª·”ë6”›Å6÷Ë_Íº¢¬[•åí¦^Íð¯K|.=ÚÝ_$TÒÚ¬šš:Éb_^WÁ“ÀÚœ›rƒÀ“ìX¦®dLÛÔfÌ]Ô×Ý –3–„ÖŸ7%_‚œ'ÝMÝ®Vünsg-{“ì6ŸwYœfê(1ÁÒ…ÿå:/ÝUÒJ7ŒÁ–ýK»3•ÅÙI~
ä9\ä-,°%Ÿ&I? ÏÅÆîôET§ßº¦ë2zNQê¹” )1h·-X;Û„åïSÔëCZ½Óê~{·%: êÖ9v± <à£K¢›¨‡è·œÓA[MšPyð*†Ï9íÇ@i<€œ?ú?ø…s ’?¥qÔp¼”-l&ömr>j|(4E?@(m|¯€›'šKÉRi_ÙÇc¨ëûÌ~@˜)ŠÛ:«¯È"DN¥ñe/Ã—–WÒXZânÅDoI†<—­7ðy5œ¡cÇ<#ƒîjÑŠ“ ïB%’±¼0¶ +‚eIíjÌ<ë—>óp’ù° $kø¢4B	^^åà@/ô³)ç
îÚz°‘T1ê)¼«°ºVlãÆ ø•ÇQ°•lP²ï¨0EsC~,åÙŠRT½*ra\P±rTd*ìÓïFI2È¢X ÍWö¥éºÆ'Ï©A3¿BÄUc2Ï(|z-˜O7ïÜš°à;jexvñ­<KvAáXSûIXYAÓ$î–jUpN·[ûÇmrp¼·t|Ðþ…œíR]ôØŽl3Š€YÐ){c¬Í©zÃë$(ìå¿°êÛ/'Úwæ»X@º>Zî<L"!¥›ù7Ö–£Î•Ò4ý¬ÞÛ¯âìå„ÿ¡þZ ¿œ«÷ˆ¬’—ñ§|ÇŠc‰Þíì’Ÿöö¯Îõ5~êÅ7¸0&ƒ}h™yÿDùKŽ8Z,£däxGè×ˆ;Æ$ü{R*4\·„%¥Êšk˜•¦¹àÿVÐ•¬º 7ÇìÉ€ìõR,ý^>ÔÌÚƒAkÈ&¬6dzXÂý@„“;ƒ”ib–%ëk!?iJR”a¡gH¼‘ƒdÈSRo9^ N„†ñcÍ{Â¯A¤æë³“×©µ ,ôdØ¿]
ÎÕ±æ#bþþÄ¼q¼¥]äÙA
wXþÓÌ{œeG. Äì‚þe4$=7	§¶B@fw¦V8GÙû|asUKQ›ŒÍ9+¶‚5A:<GÙ ¢¡¢>IYÍëÐMIé‹ž ÞAò^Júˆ5Éòt?²>ª‹¸ŸÜ˜«ÔX$”y!üÉrø!	1ü¢à˜o0‘Àá´Lö–Iy»×>HÆK§‚$9Õ?$IN²fç!¦ÒüfÔ¯ÿÀI”bnFÉÿ  ÿÿì}ë~ÛF²ç÷}ŠŽ&QsLŠº9¶Æv–¦(›Ý†¢“™ñ/{‘‰	H0 eYÑOÏqe¿ïy±­êÐ ú’rdGø`‹d£Ñè®ª®®Ë¿˜Û]œƒSg|V@¡ÁSl5 šòØñO4Êw9°¼BëúÐU­/´˜W€RÙ‘¡TäìÀj%!þû¿4'‡E S”_¾å3Èg9e°‘™Š-àY­˜K¨ ë|èPFÜJQ¥éÈÖN¢œì“D"­Ø5¹l×°%…)Ü¦2[ýFÝE
üõÙLi­*NS1“Ö¨Ò¨…¥#ly"æ÷áÐ›i!	_±«ý¸T' PG£œB
`ß8-–˜"f7h9õtíU÷Àßmï¡5ƒVæDnïáÄ7û¾7Y¶£ƒàc°äÒ¹?•~Ù¦h9Dô»’îêÝ)a¡L«0uªG86§;¦ï4­U!‡–Ü™ÅŽ+À¿gE3n
a’‡tµµ€¥Å$0ºe[#€SZ×ozÛjeÅçñ#ž5Èã¶6k$ƒqQC.:Åg`yÐ\’"Tûˆ¹Ö… ´Ä/¦Q<ñÔ;Fa¹1ÂÀ>œÓXñKþéNúÜŽ†>&¤×ò_±Ôs¬6gk*=–MþµNþßÿ%b·Ù-zð1~e€ÃêYr3*Ó›De0LT¾¡ÚÂ&=y#ÿì–³;œ6ø<òaãŒWÓ7=!ÍÛØlØI@¦! òQØ¡ú}ó×Þpä×øØ»Ó±Ÿ\…óeã­Ì¯oÂª×[½µÈóZÄyµ†e¼ÒÚ¿_l¢Ÿ:m‹ÇÙöi«ý–´úo:ýŽd?h¿eñXÇ§­#é¬{›Œ£ëÔÖBGC/ÌKºÒŠŸh&œEêMò{}Ï!ž	5KPº jÃã"¼ŠQµ+ØiYñÚ}–4š£ ÅJ¯aôP£~÷ûk\ÿ|ûãø—R¢*7	¬œ”Àmd6}ÜŽl³Y¡%J§êÓdag†‡¯éæÌœÄ^ŽJj÷B2›Ó' xmd’°ÛJ?RÄ§ò4?ü°€t¨=ªŠá®0ž‡£Šç9´QÅ‚ÈÍ˜«ö)Ç’”eMðÄêH'ûÜêÇXÏI(ó×ä	{E8—za}€ ç¾q¿3Üb¦=?¡6;–çNxŒaÄn~ w7©`µS©³”­&çziW»ôÂDeØr6ž°´‡²
­?Ë¼›u`2îRÑú¢˜¼¸qÚ£³Ì3±öÏ/.B-•¦7Ì,@¥çæú’—ºøàƒÅŒ9$‡Qœ1ÂK"Œ)<—‚@YÃ;Ð5¥ˆ>/_Rl@=Î
b²·aÁæÐ£öiÜ`£GŠ™Ìðž¡½£ü`S.Ï¼à1¼·%]÷Ü(Q wÄS¥w©Æ¤ÅIAéÅ¨ßB•v(ù	7ºÂ‚ÑÓ˜.Ä8›SžªÎbZ¾jxØd§•`¸ÄC•Áûùä‹—¹èÙ!]^ÔÇr¾¡³ŒBøûYÈÈ–ßëúÜ3Foš§~SxªjÞxˆxž2 ·ÜL–oT››NÔ›*uÁ#­ˆÞ\)0oGã’×õ–Û)ŠNá‚Âg²>Vzâ±mº3ígW¹@bZRw±¸èí4V¡àÍm'â6{wDH«¥BŸÔ‘%ï#Úm.æîN-œèù$3’ŒŒd´mÒ°?ñÈL.ôÓæ*ã¹ZS•Tgê‘‡R ¢üvyG0li*jýÁ¯í }-Ic‚3‘œÜ	‡Å:‘M.Tñ!MSéB2-­ÏbùÈ9>àã*I'PpdìŽðrYÂi…p^²N:"'²1ü¤Ý*û©Ë‘%]Ÿ=tIf:øúú=Ôy/-Ø8bfãf„£ï-³úž|Óôgï‚ØE¢vÅcŽ¤¯jûØ[Úö‘
‹Òò&‚î|šãÑ'¤KS)+ËN••‚’Ò»Æ»æà¤l_7ì	áÕEýg‰£ƒž!v|ß›ã]ãPìú4ô¶Ž¡?Ÿ|[ÂTN	]Â‰`vƒ"´bôë]ÁØ¨í„zð}cž˜nòýódàQscì3ïþ_ÿÊë}à=ý+Ù ^|t=¬'äç1(­­ÙCú~èM@%®f>	¹ÂÚ ±‚ùáÿG“LBÑjy4Õ` S3¡èäð+xÏ5e¶œË€VÏ£‰Q©¶©Q±0ò”¢2†7…!L£9<ÑÇsö¨º`o“è³©ˆ)ŸÊBžt)­™A\ì@GWdø.á0ÇC€˜§F®F£`Jþ£ôÃ–þƒ¬ÿÿ^‡ïj¨Zt‡41ŽbÐè;z°f?¢q‚ÿ¤Ogƒ»ö(ñ÷‘U^:ˆ†þ»^Maþk`ÍÅbl¾¹Á€}KA3ÝqPz‹ÐVHAü#A#Œè(‰	 ö»
”¼÷´% ÞÄƒV|ò­ºžàÕ¦y%‹iY¿C`:ýw³á åÏYNÇ%äöZ ¼Eˆ!*0»¬ñòË{CŒ»µµã1ÙŒÚnPÆòÉ[p’…OƒŸ§Ù£@QMN_1‹¦Â¤žpuh™¸»^®¹Té*rj*âž` ò—/§:&ùkÊ
ÿE˜ëÌ¨eºqÃè‘ÃkéÊ8!»²4ŽÚzQmË$7evØ¨àbàùô±ß fô«I‰KY1$•))î4Ž&5ŸˆHS‰BªÌ2)¨Xî™äË¦ñ¢º€{’ÂÍôä@{`:S*!´2×n1jæ;^gÚ‡ñ|>Kö77½YÐ¸F½Ä›¡Õ}²	{Áð\Ÿ—ßÞJ{ÕÝ ®ÿ„£ÔôW3Ø*»,Ô#ŽËO÷šÅª4<€—©ø*ÈˆNáör„$4ÇUÒÑ²Ù–Z1SÌ,õ¨=ªòÚ:¨³ˆoV^"jÖäÊíL-0úÙ+Zu«NqÅd“-K"QqÇ3Õ€M'²öžú)žÈfü'™Ùÿ,¿EuÑ–@˜#Ý$MLæfÙPvîvUŽ
“¹£"’7sQŠõ¦š‹r¹TÇ¿,_´5t¬0zÿKbU$•5tÖíw	´i¯Û‚iá³Ä]š×Ý.t[U¦Å\Ê0š\ÞƒU··ÕfWÕU®HÓÔ¨òxºŠ>ÜRyØ¥ÊCâfrqCS’´YHìZIJ/Y¼›¥±§éÇe2z-•„çCsV}Æ6Xš(ál^ÕGÃáF¤(ÌîZvìRˆ€jœ³4·F¶v¦Ò'-â`¶,ªâ¿„-¶è§iâÕÉQÌBØO"æ«¦Ø@œ3ba­Kœjut“ñ	ôß¢~ÁÃ1´óyÃ!™ú×â)Ijd:8Ì%sóÃÌøF|MKÊ%/ÀšÜSHê±æ>ˆŽMI>Y+§džš­ðo§©ãY´þ‚|Ð¥Pëvš´eNc1õ‘&Øl’ÎG`¢Å{:·æ¾˜î—2Þ×^evÀMàvêÕ¶°¯¼s¦=8]/ñÒl»GÔ¡BãÙJ,ÊÔ`ŒÁLv+0»ÙŠSSqj)æAœÔyŒ¦‹Ø¿É78ó`ÀK1ÿˆÉ4Ü/X„Óé3Z„ÅåT*€]9Q(!¶œ³¡ä®+&WH·zªµ*ÙMú'Xb}¨…öU÷`ŸˆÜ-çgÙrP¤–+ž°‰?®&…$…äŠçj”Û%Y8l²J8fHÙÄ¥*&“íá¹ùÒ¡
…¸¬q‹Î=‰c¯*µ×,Çü˜b¥ª<•Èâkö* ¹>Ç±ž»n­s‰3$}ÚÏ¬:÷ƒò¾89çŠEÅ€Öf/í€öš¿œf×«ž×Ñ/_EMoàehÓí—%×fÙ­•þÌm8xräK”¸«à´tM2G5ò)H¡Vµ°Õs MÕ§êÕšÒ6C½|¹Ó^/:7¾Æ®àdÁÏõE™W“´³\šj%(h?Žž¢ìr/ÄÀŸPñÅà……Ü­ùËì|MÕN'çkþ’\±2½øõbÙÿšÓ‘¿ùàì€Í_™¸ÈÆ9¬!¥²Ò&üj6nuð®­žGñ‚³uoH½¨C
*Çà]ï(çø®Öo5ÂVú z†]Tæ~z×*Xtòîãü¥Þ´¾ã¦ÖwüÐiü5*XÒ€<Œ£MCï™ÄU>êå‰¼š×ºÐÃ4þ¢Â8‰ðŽvS^Ö]D_t&}Œí@j¢F=È˜ŒÏ±…Uë£¨HRŒ0'¶FÑÜ)_?EnœÈÄ¨|Õ%‡ô|­õ¥œ¯_‚ûä¥¬ÎâhÌöÉ?yP1Ý¥1äxâ!7?&|ÑpÌÇÔ ÇÕ£ÜÐ€x~¶Dë
ªˆÊ$VñI‹Q'Ë¤U·Ãäzú:ÅéqL¦.PuîcïtÙ=9èþÔ=x×:"íÓã3Dõ8`=Ú^¿{Øm·úŠ®Üé©ñ=Êg>L±LÔ‡Å{EýxnGý¸ í?/Ð‡DE¹¼÷‚úQ0Ïüny0’iÁBóí¾<ýIçSQnŠ•q>J¹˜ÌnÍŒZûä á¶ÛÄ9ƒïøN0ó³€vÜWl#ù›Éò5! ¶m=ÂzàU€õ¨“3Ô_/(O2/9ˆ¸g.°(ØÑŠ9¯B”ÿÏ&0?Llá8ê©©µêÌG¯PøH°¤1k¤³ÆS¨ñ–¢cƒÜn6v·)ÙMé„‚ÎcOªeZD:)k¯NErÎQà]!Š€ŸYÎUQ*d˜Jt§ô<Ülæ‡”È¹xnñÏÅ²)Œ™—Z£éßB$)¨“‚€jë+@çò\Qà¥±äØŸ{tTÀ‡Øæ¸ïbÒ‹* [è-NXUÀß5¹ŸÊÕfOÙkêËË¨]yk¯Úco2ÃØq0c¡%ä &"ýñÌØ€ž5›’[àù¿^GÓaDä` çgK{šîrÔ!\x ¼Ù•Ï€å¯‡p§îiŽì&-Xª÷)ÄJ(¦ÞÿÊfÂvíÕO½Ï™ˆÂ~L°q–_©³åÙx¨f–Â•ìsÖ´–ÖJÉVGsBaq´»%Ç'b¦V::X°ŠÒ¸•Ž.`cE¡É°]@`ž‰ðÝéeä 1Ó<}jCáôœK›(éX™ÔÔÇ
Z¢gXß§Þù¢Hæ{=lexøîô»ýÓ©µßv6°îTëÎã½sG! ÜnøÿŸlT²‡‹}ˆ']üI¢”ya•KåMÏs²B Wè(†Ç±— h:Ô“^·MN¢
µ/¬lp<™´@Ý
*W8Î<˜ôúÉfkýŽXZKXÍö†)‚óª¦£çÏb•,8ø!àÂ½PÇR6¸¢(á‹_‹øá5î6É›w­ÞA·uBÚ§'‡ÝÞq«ß==ùãåO:ß‹"+§Ÿéúd•Ò(8Š¥ûswu"ªG³’¸2‡k®aÝÇØåG­lüpl›ƒvMN®0îþ¦ülM]èÄµ¿õžèË÷˜X¬Žo†aeÖ9a}·†C¶ÉýM	}ŒÃ”,Yzä/7N€’y;ÀùÕdâÅeÈX‡xÚìhS€áÉÌ/ˆì%DõÚ«ÌûÒëuZçrþîø¸Õû§N+óqºO¨ÏGsddf/Ü¥¡÷c?ö/nÈÐ‡qQX ôiÖý,çvÙIÐ´ŒšÜp¬–¹(ä³øú\½ tóîNŒ,Œž$WáŒPã›Ž!‰ƒäWD…!Ùéý)õç_Qfžü„øŸüÉŒâ	ÉU‰&ÞÔùôOÌà•Gü7½%Q¼fÒ
|ŽÍ«ÀÑ×e~ÉÔþo'÷µH'¸Î”æ
?_Þ+%øe`!}iG£ÉÛ›£ÍI v3lº…@³¹Âs\…*…)#þB}I¨¸ZeTúˆd8ï´ßõh	N¿Õ=Òv¸øç^‚èhß"À,'ü4¼–öxÀl0N[P÷,¥«BwFÕövH½tCÿc0ð]UmÇ·…)fƒvÚat5$=šO¸:TÙ@6åªéF]
[ùZ”dPLµ®”ÃØõÆ„ÖLQ–‚±ß'ÝPCç®àq}{×n¼.x†5^97ªaÒC
þ"˜ŒôéâI<xYá9@'/œ¿\“ 0i{²”4ßÌk.¹ÒéŸÑÅ¿¼‰n²Ü"^š*SüpR/'ÍIc“L`Ïa‰·¦X1e¼Ñ²‡ÏÏ]´2ÿ¿&’Ó!œš§3bï¨ÔÓ¨¢—d®¨ŽAë2¯l×ÖzÞúÆ@ÎS?~Û?>Òc«³äHv.?ƒÓÌ}—¤–ë†&FœgJ‚Öô2¢º¾.…ªãéðp‹®g‚ý5Ò1ÓàòÚ-¾Ï'¡1âÎ%cB¥,\Ù/Z'z«·ù±ÛÍ ¡¦ãØ¿|¹&¢xÃiãßÉÐƒÐ•?ßœÎ&›è1Â	$ÉÿÚnl7¶ž»$óôûÆf~\# ãÃ~5¿	ýdìûæ¤Ÿ›¶Yx‘eÓø!æwžÕŸ9W¸Åå·¥âòœ3Þái'Â $©Èôdhwz[S¾½ÍÑð’U±PÜâ`6·=VðÁ4Œ¼!ðÅåÕ”fs×ô¤^º™¼æÏøó~0ñ£«yM~Žèg€!x5éxB@Ñµ‡¶šÀ&a‚›æàW A«êó”sâ@¼—²­j¡Ëß™ƒ\JH{™ú_ÂÜ[,~RÈÞØsˆl¡q'~©ÁÀbèMª@]zu$øMzÐ°Ò„/€ä
+ŠÚ´ú­×hvéüãìè´§yåvÑƒ‹?G%»½?o€ëWYÉîÀ]™A4	±«KÕ²KßµóiF1!à\)¨üÆ¤VãQÝÏà´Hê¬oE¾ƒsðº=¥'ãÆ¯þMR›x! bDí®;rî}ô‹¹bï¥†›Í'ä"Ž®ÿ	ŠºŒ’Ù[™™65µ2 +Ë]’ÇšÃ„—êËƒ`Cˆš$ð:ù\…üTJ'ßŠór_lÃêö2*žp}™¸áÜ=ÝÀ™<,‹vÌ,Š,äJ»u.Ó}©}{Á½ZÞ8ªªfUÙrUÆõ˜ìÌ|¾˜ôOaio[|ÛT	þ2î_Úo‡Cûáÿ\5-0šR2kA!- ïrxaTÁ>æ)ÛïQ…óÈX(¤3‡{|Bºm2¥ÞÛ'ƒ76=.ƒâ¾7A<HÕûT‚” CÜ{)øã#4x°¨´™1 enáJ5•–ŠÅËÏ¾Îý«[|y
©q%±£>Æ«èæ¦„¸]„£,‰ Â‘ ã|÷Sf«wµÿþ/å~¤Kª-½ŽRÔ[¸V¹‘j=aÊÛ4ºŽ½Y^Æj¤jñü£à}†¬ZÎ¾5Æ’áG)fÄ\R„™C£å…¶´¤úðÏAÌ¸fAy¸¬[ðœðý>:WéH4:Ê7y¢Ö–‚œxÔøƒ®Tæo†2’po0XôN”*†{Õ}meTŠ¸ˆ³HÑ;gq³è'vò]A}\¾sep³œ÷UÖI[eÜÊ´•¯÷
w¯„Â\¨kQÊZŒª (UuQ´î‹ÉÊÝª FèASæ
ç§Yå2=2¼úŒ÷ŽñŸœäDõÊŽwûb¼c»uªÌ%ãá
Žþ¸ñŽöÑ•¸˜¥c2LßDo‘åà¹—:¢0^bJ ºØŒ™Ç•Ì0"'Õ±”/G©LXRtyI·vú*’®•“W‚¥8‰T«wkŽHÙB!#¨„£RÛrmnv¥`¨ò_Z¯.ŽF»XuY{¨÷g”,¢x4/ï÷›ß7ó	—Â#ƒ^céÀüY£hg’TFÖ3MQ‡3¯bIchÝ5’4Šš—2øô,V‘PØ¯vÉD1¦ï‹œ=¦}KªvÑfh5b™ÊLätm³ƒ	6Ž€í¨y4d‚FFˆ›îhxÃ-ßSîçŒq!h^Œ—~ûñYêùÍËµiT_YQj\ÐhÅàü`pâ‹‚ÙX0˜?Í\ÁâäÓ(“`
ÂÔ}\¨Õh@Ÿž¹šR·²ÿˆrI]:¡NgÈ‰Qœ¬½J—ÒV¾ÑqÛ˜c}·­Sí³è9¦ÚSQ4Èr4Ò$)#Š»óXhÁNšM¡OŠ6^-Æ¸ŠQ©àeÐ‰Á&ÊBÖ§¯/Øq¸Ã¨<ZÌ­|ãcÌ«[#Ú¶Ôù…-hû–’¦Æ!
ãÖ“Fá:)”…s• Í-37-Ý
Jv®ÏNÁœÙþkŸà[85\ñäÀGõ‰ŸºCª	Ó>¬2ÜÝ=c§F£åE¾€‡dÇ£«ÙZ¶^’[Òh4ò‡"[p»†tªDOïé,ýâr#àŽsìGçÌÒ^ã½9áC&>FŒ(V» ºË	
¿×îa'Dh)¤Ý©¹0¹ü$¡±Ù÷VNð^Aj`Ç/¾oæðûÐèU¶­g¸}…¼h®ºÀ¦¶ê
n|lT]­x_eê·ÐCÕp‚	Íû?œdå“ïM~¸’¹·j]vÑqñœ—ŽŠëÚ™t1FÊKúãüªb<z¥ËI¿`Cš•
'¦Vei­	¯gLY–Í¾¸†)t©7­ì²J´ñD1”CJ*­ÖwaÈ³¦`HG¶_0“
&5¡ã³¹¨Y%¼A35Ú\ûÜ[¯'ÂÉìM‡Ñ'‘Û$°qÇÁøšÞà†Ìð4ø…šâËÄõßvŽ;ä¼OSmÕ±Fý±?ñDœÑ}„íJ¡EÍ*¡ErÉL[˜ÑQç°OÎZ'£}rÞ9ê´jÁÅ³ÌŒåÂ¹k6ëí©W:IñžšÒ§XÃV§s
tå’j¨%>n·\.­­Â9ó@pÎU!FR´Œ °ÙU˜øZS…*žÉaq,<ÊSä;rä<˜¤£øNš(möU5×ìyŽ›µ@¥x9‡”ã7!Yˆ^®Š^êUSƒ°ÙÔm“ºã±6ÎÌÁ&RÈìÕP+î#ÑÔƒß}¶CH‰¦³(ž{a¼0¸ˆÑ5¼Ÿ‚ñ¶óø°¸É2ÃH' ¼ù> ƒ —dLä‹†ÂÄÔðePØŽè"ÀÃ¦~§­²ó›"ŸJßÓìRq¸£líó-¦ÕnwNúçÊÒŽ:ù²­C SxrÜJÖJü¨?—kž
ÏíÃæ4ÖAÜKAZABíŒù[tñcLœÒ¡ä”Ž«‹·ï5
žÞf÷É:ÇÎ[¢m†Ô
;¬!9ˆþíMG†öC?@û>Î"ŸƒzñoØæA(=O° “ÐlšŒ]zWáüõzûË!½­™vŸ¼ÏÚÂm[íƒçôÏçíïá|½þ‹¦‡;]×–	œÃ)†·Øgð˜·$­ØŸz3èÆ¨1áÔ ý|žëlwž6éŸ­æÓÝ{˜±AL@(Ú'¬Í’Ã«øÆ>]¯é	ßòA—Ó¯è/ E KŒ~¦é;ì|ðý}Üï¾ÃÔýôÆ3„e5F½öâ	ì63”¨p>™8‘W“€–ßv¸Öá³Ã=Ç‰ãmñ¶ÝÎaç)›¸Î÷Í–~â”ßÿÂüºæJî¶
 Ô§;7ºt+˜d1%·„öˆ5çÑál²%¢™„nâ¯Gmœ$¸1ZÃãc¶Ü~`±tX¶vVßQ¨i’j–ó›O'UÊÂÏé‰6w:#F£«„WŒ’cÚ=†¼Á±‰þ7’LŸ“¡¥F<+x‡§ÒÏ›©¥9ï{A'.üêßéëÇ/ä4W«ô‘ÀR§ŸK±ô˜C\pƒ Ò³¸X”o"t¯¦V÷<ˆ	ÆÇƒ' í>™9ÿ¶”uá–‚'}£L	Ôëµ×\#4s÷åí­¤@S&Ü'à0«·{w·íg…3ôy¹Ð):BeœØôˆ2g5oQš$ˆé¥u5š-•‚.‡ˆí}òºÕþñMïôÝÉiŸöHûÝyÿô¸û¯NÙB»ÕbàÍæ™”È™ÖQãüjºì9£=Ž0ñuvÐëG¦t#ÝCñ®Î=vÊÝ·ÇÁ,Q.‡†íénA#;³5æ£Ö~Fƒ>(4ÀSRÍTz?UeúT•ÉõÀô‡~F¨ûÞ$wÿÓÃíÎk—û» ¸ƒú™»{îîr÷y»õ1ì¬òíÃÃïwn§Û"9Ç0¹‡­í­§[-—Ú^|úÀëˆ!×Cg{{'À¤‹€l–WÇ°Üë¬”•ô¨¬ƒ˜–u¥¼_Hío•¼EeÊšb.‰
³Ò4ß$LU©ìÝò?:hWùdP)Ï~”ó'›Kýî«µ¼#UibÌÙW¬V5 kºžcúï’Ú@:ßµ€	kF¿:Ô{¯F#¨¡£&gÀð–,©‹¾ÛøˆdGëìUìJÞÍGí©b\sÉQZ !îºþÖï™‚íä§½<>Ìb$ìQ¢zsw.7KãGLßG›HÇ.–NGU_´ÏªËÉr–*¹./’ëØ¥Êç¾@QvRÂ*£ÿ¹ùÉõýJ”¹È¢YïuŠ[ŸÐ4:½Þ¤W°•¦£²ïOºÃÑV8]1üEý‹­ÁÝ•…O~l‘–€PÕá 08äiÉ˜¬®/g¸°ê¿³OŽZÿ<}×'çýÞ»vÿ]¯SIßß­¨ïSo-àY«Ý=ycz:oáòG†É…@A«xnÀ“Cˆ%‹ŸÄ–tÎ=HÌƒd^z]òËRÞ
»êWÖè˜K•¹¶~3™*éÔ9žOY^5£!L¥Æ)(‹»G†ujTîBù¥¨:Ç_ìQ{“‰Kâ,9ü« G)]GW	ySh³XiÄøóTŠ3t“ûXS¶•S‚gë·Œb·VÀ°"o0ÿ™A¼Ú#;Tg‡>–ƒÐšctïƒ!Þ£qG"°6ôµœßôAF†°iæÍýçîAÿí·µóp¡åwöàwÜØ¿#Ç Üƒ–~/[ûÎ=mí?c€Km£U†^<¬ Î¶°8£oÅ„YúfÒÌ$Íž+÷v>w
±g&!¶µý(yþÇìäœòiÉÊAìûÓ¯ö¥w{¤þÊÔÿs:{÷Bÿ{M¤ÿ×‘•¿î™.Ã«à+”ûìµÉ¾2ÙâÄÝÅ7›ÿ“t†##Fã²ŠªÓ×j¥¶¨Mæõ§ê:,Ù²j+aè™r‰Hr%,Ú(Ce³ý¼©Bn«U«3ýoŸò•‘2Pr]°’Íô¬Z¯Ö³r²PmÚ›bùÔÄPh©×}ó6ÍéwzçÝŸ:ä¬×ù©Ûù™tÚ?Z³G8þ…k	]Š#	Ö3/¤–XD,„f2Œk–:)¡½ò¹)Ú–Ío·öª;™`ÞÖGŸá?g±ÿ1ð¯µÕµÝ¶yBü–"øP¶¡A÷,F8‰âìÐèºyD®JˆV¦BF4¥…0NIú±?ó
<ÑÇL²Ø÷Âú<˜øßTªût|
ÔsÇàN¼n¼éMÒ= íVïÀ¡öS)Ëª°sä‘hvó¹Vï©ý‹`Ïp¤E•‘3pzRÞÝQ¢Lãá@ûý­qpÑ^¬ŽF)¾Tê°BØÁ&ƒÃlr4BŠŽÌ‹
9¥*ñ¬QÎnkî¥“àÆË¦,•’VÏÀpvXA&ÕÈl[%õ!©ø± ž…báyTb5gì“þq¯¢®Þ|þÜ«¤JÅ(¸þLPÒn³§V÷&sÔi¨*E#¤(êÏa:úÎ3€3…+°ŸÜÊ°FÐE
tæTÏ£˜¨ÍLZ‚Wµ­`PË,htþeJ[{õ¶õ¯î19z÷÷ãÖ‰6qF© ¦™AEÎ'È@Ç^V?P-é´æÜ'þ~‹£zÓåÜÐêšU&ÓÅÕ& ‚µ.`Çx‹4JÜìÿ.Õ ×5Î­9ö¸¯ú¿¯¦AÃb„~u(:Í‹Å¬kã›µñžû{­CØåë»Ï~U)½\q` ¥‰Jç`š:l†ÓŽúÇ‘ˆ4ƒÿ=¦•Ãu™½øÉ®£äthŒHå“ä÷šh
íÖ	Í±w¾´sEQÑpíÕÏ8,Ô»'p\8·ônbÃOí±?øµÄƒ°0å%ÏC¤ó<¬¦î9Õ\ð$tþÏó~ç˜´OÏNO4i¥1[ÐDE¦©¡Î9-ùë£‹¡^é¤Vš	f¹C.`LéH-;÷•3>ð¬‹l
;7ˆ[É4l¡Û­£éuZÝ“7G;)1®w¿o<Ý#?{­jºQŒ‚š;"¹HGTT}éï;MyGÎv…lìªÊmB9@9nÍ×ŠÕ¥‰—Q<a¡x–Åóò}ð€\ÆÕBí¡wá‡VIiwÈæ5¥ÿ…ö"¸Ç¼Ø¤qf7‡Äcœ§¥h^pìžNA9ÐüÎB@×®QbÓ­ímOeØL{É‚ˆµ·PÂÌ4sÁu”§N p|‹"?©ë¼)ùGŠÐ—^B»»E#$Ð›xØÝ_ým#|Ïáéik„uú-¬&±ä‹K”$O	çè©$æmëJ~åÞraIj©5ab|7ˆf7#ÛÍí§äøŸõþ þßœ“~ˆq~“à®Ö -<Ædß'óøj€er“'dŒ°€.î×ðéZlßoQ‹ÝPQÒ!˜ç°›f)´Vcg@N©	>â‹Ä0½´RüôÊtxa0—À3$µýÅ&[ŒWòÒµO[í·¤sÐí“³Þéaö9%üRËw†ÁœC€} LÛ‹‚0øØ¹8v©\Ó-ÎÕtÃrn©ç¬l·Á©NÅzâÎÇ¶šÊ‘R_CŠ"”¶4Ør*0"×
VÜCT$]­ŸÈm(sçÌät5ÑÉ÷r™Û9j¤iÒ…!)¦ùŠ9VÌ¬±Ü”ü••p‹x^B7*kV8üd²_´©ô“b?Ð¼Žú¢>“¼¬…±‚œ!¯ùL×Vïé™\ ùé%;©µ½é4‚mŽ&4]e¸aÒË˜‚%kR<+æ*áhËëw°?$X­{¨vP¢(Tg'ÑÑƒP”³”ðøH½Où÷ã.F9º0¢kßhV­Åçžq&N¨¹z¡†Ç>îÔéEr“Rz‘v9_®‚Z´Ò‡¾2ˆŽ¾Š…ÁŽ,ƒMÆqaÎÆ8ìZ0Î}eÂòÂÐŽ,+CÛ<.ãÒt&^’Öp‚Äum|¼©¼:´/ËêÐ6_ìê<œ}Ÿ›_Ð‚uïCþJjTYE`\:û‹íþ§ñŽmÌÆ›}+êjd8-0“sG'NÑ¨M–ëx}†£ÌáS:›;zþœ%Ód¶¾ò*é5gU¸ëÚ °%J c…¶orVc“Ö…#ßävxå‚ ùêºnùZø'{d“”'Ñ@û¿]X(ÁØü8Žb]VÉKY»Pñ]©2…²ÏF£AßÌOÔà$ï3mÿ—}-üZÖ‹Ü^wÂÀNTK »c@+á¨ÖFwÇ÷xéºçKë‰d~	4;Ôu@w0©º-Ué`ÆYDžt”7ª–RY@ë~´Ù¤»ü0‹Õ2³C@gdåX¿Ã\ ;Ê
Ÿn|<èÕw›R4«»”*VòÕìÆ
¬Á®ˆRn!´-ÛËÅAŒîöê^ç°ÓëtÌž=¬VæûÃ'¦*~ôùo_£%ta8zý[ß:ÕMx´˜š,¦÷f+-ÓûRÖRVÝÄb.Í×®l¥ÿªš@K„Ù†EF­eêL¢åBU+„"­¨JMþ×CK{bFJØÞ×Ë7úO9ÌâœôºmnïY™aš/ØI-Ój3W@—™^ó¹¿—oôÈ@«È«°´<zhOjñ¸0Žƒ5e|²I–uðåÁn¬»‰hô¸HŽ‹Ôó<BŽ¢ÍqZn¤K%µ{\-ÇÕ:0ýŽfÈOþôÊ'µ7ùŽôX¥ú`J~<Þp_¾)šÅ1®žhô¸tŽK÷Úƒ)X^
b7V)(=.N•Åið¦óT	õ2ñþ¬+ÅÛ=.–ãbýxÅW£€#êW‰y½?ÄXÉü"ñŽØýÆeÊµ,,”¨—ò‡­—ì,ÒD1G3º¯óÈì~B~:‰µ~ŽŽ¬S'ç=¡á¥]œWìâº8ñ8JaÚËIÅ^ºÐKÍmÓRW]sW/6Y<hj?‹¢IâùËS;ïÈÚs-©ý‘ÚßßoèE4™DCvéqï{®'#¹çZ~ñä~™E¤Nºä:€QzqŒïM&7$ºžV¢µúÉÚ+ø:;GÞ4øS2"ÑåOlm/&gXr¤røœÂ:áÅ´+³u‚7z0ªž„³þÀ•¾ó™?@EkÆ“†¤…Æì8¥TàÝà½Æ•’Ú}“Éñ_Ø´8:¥Ø5ªm>ýØJýÁxJÑzh]Ž9î¦ÕúiŸ¿†½‚ÿ$Q|ÃýH¾¯ÖQ¯ÛFÛ »Ó:¬'¬©Á÷Õ:zÓ:îüçqë¼ßýõžÒ½]¸µ7Ç ÿ~
âù¼³„¶QeÞ:í·'Ývëè?OÏ:½Vÿ´'Ïã)Ìƒ7àYýÓåŸõS·×Oâk¯Dw©žðS¯òS*Šó
Hc‡,I°BTÀg\Ì1®‰º‘y½cI&*Ttùì^r3Kx`ÁõK eÿŠü…0ÖËßÉöhøº`’lÌ£ó9VÓ¬mˆ€2
\¹.w!¬_rbÙ,S!ñ,ôi"<ªSÁ”¢¥‰ÐCøÒ‡Éª#_± Ä!LÄO05/ÉÌ‹ÿ0Œ¼y­0I¸C%t–”cÁe
€HOj¼3:C¢ã¤YaJX˜‹‡²'fNÆD}R2T¶âñuÀ´Ýée¤Þ¼äºO
«JÌB¾\‡€FP)sºá€óCÚV0ˆºyœ±ŠðÜ¤wJl¤¾yÈh_¬¼ºÙç¥´cÁ\úæœ¿rwðïÔ7yòù+½-w*Sßø«l•KoÌÙê4+"8²•‘¿Õ¬Wà³â_¨›'™™Þ!i–ª›îþ¦BMb¤= ¦›v@Ó¹(ÄÆ4ØŸ…°gÔ6ßÿ¯þ{«þ¯fýù/›#àºõ|½=åæ …©9es“¼£<EFatá…òÁšªç‰Ž×ÿ¤bZÂ˜ó·%à˜aÍÃÍÄ«ú¬œ ›4A)'=_'Ó€ú®1ïC‚{¹ÖôÈÉFCêZ_?Úå¥‘¦åæÔèÅ–EÂÝ‰‘‡ŒLû#0ƒ°TÁ²ˆ%› (¼WvdK‡k‚À¯Å¸jñ=¬n56<‰‘èR5¢
‹Ùa›¦à	æÅÇ=ˆ•Ìí²‹ÅŒãeÓ]•û,È7„ƒ­Á>­›c\]º•Ó†êçË¯qèNª {oQ	Ê“ö¿Ú`øÓÞ›Ö	­`Ý:8HCã•Ñð©°5>F¿?F¿þèw ¼Ô†¢$ÛJ\²t(¼‚Øÿ$±ð}ï¢ŒX­SRi®ºîv([‡ðÏìêìÇ2>Wy‘²u¡ðÿ0êÚºPÉTe9äriû]"p
‹îæLÕâ]e,[Dem¯42f¡HG§Ü-±ª†²”†¨µ±§¾o?½OFšÑÒ!åà2Ýmn5ËÝ—‹g(ö*fbïQåÒGs÷j6§{!‡©ý0)ö5A;ö©Í¿NÅ³.GiY9·Vƒ‰¬]%•G]§bLA+Paÿk+ÿ:¤ŠZDTß‹A'W e(0*(I[›Û„ Ú#Á¾È!ÒbÐ£§R'§æh#¹>5-è9p„êÇ/×ø°ãL4ˆC$¹¸¡yÌOf²<!QL_pÄÒuÌ]x	í26¿òã]…•oï\Õkñxû2¬o5áü#¯‰›×OšÝýÜrn>mV€´tGæ6¨Í¨ýc®·ï4‹|Ã´éím„ëtDåž@.×ù¸(Ïq©–¹#Úª]›NÆ1¼Ž’ßù˜)Ž-u_|G)Ù˜¡(}Gþ~å…ÁeÀl¶–Ú—Î°ñEy?Ã›×oÄé1ÝéšQÞÖôîv1ãŒ÷Žô˜$–1SO°·ÊÒG­FšM}çìœp7¦£Qcç º‰ÓöŒ i…d{ÓbÕYÙÈ•Di¾q$Ì“ÇwƒzÜ0ÝléW),->¯üýs¢éÅuª…S§´/\bá‘Éwß¦°;ý¤öú©ú¡K¶DH§áŠa)ÿÙg}ÇjL
q§I_F0Ày|e †;µMŸ]H~m„þtÄ j]¹±˜³,ËŸ)õê¼J¢Hâ:‰”ªÄ%-N%LÄä&ºŠ9Í6ÌƒÔ‹UvÖëN?Õ\8†aKÌ7;!Q‡5xEš”à-ý¨³pQšðÞ;\õíei¼IF›‚)6LTâ°¶/Ì‹T^ømVÔ#;bì4Æ-cáBf¥[]Oq™O˜ÅË©xQ®S‚MöŠ‹ª«úÕ­½ÿÅ"yÙuG|ØGVôL]N¼™ìÌÛpµÂâ_¼Š8É€ÚjÌ(¬TÑQc¯´ÖeÌ_6z,±Åíq&+T!s¨šÅ4RsMWq)…PÁÂPD²_—L	sž¹’+^wîì“ÇwÕÀ@è±*/…ÒXø#[;<¸ÚéÁ*ÛM:ðyäh+qF>œ§IíÛ[»¿ÛÐÖÍÆh.OœÒ(áó»†MÇ"š
(Ù¡ˆ–+ñ‡Á•}?vÜØ«kÉFº]9,¡¹F»å—Y'V:0.&J4Ü;D¾8THû}ÅÍÙ&/5i÷-_ý›—·b vÆªºk.´oŠSQÕýÒ¾{aÑþ/Ž¤SübJ¾y™2Ýv®Š;«ûèÞ7üûI: ·/ªsÀ]RØÑ†&¦½ØÌñ]öt—Fùý0«H‹ Í¨MÓQ'Ì{êÓvJ"³­ãLç« §ÆtöÅ^ªÛfe°ñ—u×ÞaVØçw›Š~%‹¿}‹6UDÏ.Ño¯ô¥Ž¼vêI‚9„ïWEÂKZúŠÊ‘Ët;kExÝJcÑéCi)´Š:^ŽzmêÜRA
Š Î©k¯neCÏ]…•Ÿ#ôx•M#þ,º³Uys×¦î«W÷tè@ŸMÅ_| ÅÖ¯Ÿl¶Ö+Í‚Š½iíV =¬¾$'Y8¾†Ný,U]—(oÂ×q6§KT²2e"Þ't2sÆnÜæªÄ~‰“Ã¥ùää‚©ïcrVÍ“®‡/‹Rtg<¼ÐV5t|·QÓtZµ¤¶œ¢ËMÁ[ôH©×ÛÙ'BŸûiL]¿oþ¢zin0uŠ§ÃÊ¨Ímù†žÙøqi
{ª¡ñ4UÑ:«ïŸÒ`‚ÝbÐb¶ê…ã]­´w®®%½E‚®ªÌ"ÆøÀŸÃYXNƒêvµ#®Xü)|ºC÷•þ„c4õÚÔ‹Cë#fÙÊ“¡WÐ.§ÔU_µûòL$Á‰MÙRÙ,Ò>ÏL¨0âV>1Šl¦/lšJ9o+Ÿ#‘´EiÖœ\>|›ûýŽüxüÏ+_ÎäQ.Ì¬ˆ'+§/‹&N¤¹eSy‘â¬ÕIö€£„!bØ|ý.›i£>ð,B
ˆ±ºÙ—&øÁ„gÌ}aÌ¦9cÊ
°ÚÊy<—É	mÉ9ÒÇ|‰ùËùmç}¥ÈµÇ@3ÃîüC[Éš]­$	FS¢¡eýqèóäyÒ¢‰ðÜ3dnÄp×’H$†žËa‹ ±\X”ÏX¢©‘ƒV†g¢ìoaTeo‹c›(»[áDÙÝŠqNÔóyŸh'Ê'Þæ	’ùDü®ÐÔý¤*óCOþ‹×_¹Öy_°•™¢4+fø€­2nšbM›Þò‡õ
‰sÒs©6àæ€Os…wÁ®KèÏú.îeW/±"÷ÎñdR°­®b
LäòcZ‘vèƒòœšU“k6>š9éÒîëØ›ezr¿Õ¤Æãb\øÌÿ-I”,ª‹Å#©Š›'P-ˆÙªÅ63ao¥ìŽdeCÉ)6ýÐ¦—½RvÓ´[ŒE•p‰ŠÌàÌ`3È»¤¯Ž£éH’iU"äl6öÿþ/ó<;˜êmë¥Ÿƒ?û¹(u7‹-âñdôx2z<=žŒÞÉÈzÿÙ_MÖ¯{žï¢ýL&Ë?¾ªùSÕõ3yÖÿE’«û-¹L¬šŸa‰°ÁãòTZçbs¥õù:ËÍ=¸ªVtÎ‹¾¢²sn±*ŸsX¯¯®üÜƒ[µå‹Ð‘?Yº·„nÅè¸í+*G÷0©BQ:ÇåúªÊÒ=¸E[ 8ù³—§+ÛI*ÙUêf‘¢]e›Úbe»Jý,^¸Ëljy`ô¿@¹:ýÿi
Ö=Òÿ×Cÿ‹°Ó1ÀŸ¦„Â‘±x»RgK”±û¢H¯B9;»Ç×XÐîÁ­Yå²v:Yñ§(l·Z‡çêœ+tt®ÐÉyßÎÏëÜü<ŽÍÄ½k¼‚3÷Aª„×¢ñcvvmE<u¼›àôÀÊWGƒiëç	Xî‹\¹G_‹²âšyaQfXšcßÃÐ—'·¦
j	‚_:§ù6UÝÈP«¯—¢çp„ºÒˆ‡‘Å\ÿ%O:ýße7»ys¯)îŸFóº‡½ûCU*œ¥H9ápìXÆ=\ùV?XBãÛjQÃ”}ÁüHå8‰o:ŽQ…i,ÄX&çÄ¿60Ã_È)¹’–Á}
;Ëâ„^·úí·ä¬×=é“ïHçg§½>ÁZGê2Bg°éÌ[a‡aBe&CØE|ŠÃü×"3à>Ã4¿C{R¡íUb“¹l™¡B¡‹\!P`Æák¹ÎÄPêv)õI‰$U¼û‘õÇøÄ½JW~•è·;ô“fp¨#¹(A+Ë­¤¢º¢0S(ÇbÛñîYcÐf¡w³öŠŽyõÓ,Šç¤{@(+R;-M».O¢™Y,Ða…Õã(aeX8ø`ÙT?!×ìKƒ+3N~‚5|6€q0×cŸV´@‰L)\=ªìg'o’Æ‹ÍÙâ*wee¶,ž–ªûDç?§™¦;ã6¥Ú»Ã“ Šo>·h	-7Œ’åÊ³0qó:Þ8•‹ªo)òPžbÄ$âƒç+F„£}úw;+î£OKœWTÃa<GˆxæMýpŸ–Ž‰£°|†R	*›á‘×õ÷;´FE†"'bCUqöÚ¢/R!ÕòfÀ¿(âÕ2e¼cN*Ó•$auH“BHgŠd2O€±wTSi™0¼|Ë…WÞKÌï¯ÏJ(›ÑèhM%<òâ…©5‡þÜb#«Vd‡8”Ù1ÙÉpùòCÖÚIÍ¯š_sÕvô¸
\6~}¶Ê$x–ÝèZ§Påç„ÖñéÐ*>m^ÅG?à*†EÙ ÖŸcÍœfZ,í>Ä8 ®
’jKÃ14à3Ýƒa:¨ž?ƒµ™¡“aY3]2µ±÷ÄÞ«Ô_:Ëßz•—dªù´Z‚q4Lz!HuÄ
ÇWLHí¶ÇÞMõèÚÔ¿É:¯¡*jM¯œÑ4>Š×¸!2ù^GÖÙØØH!ÅmæÑ%ÚÃ¼¶A[bsÂ§xcšð‰ÍïqÐ¯Ø¶ëòòL°< Í1Ám’×¸1úóÇ­‘¯æjÙ’wº gò»¿ræäoéÎŸÞÈãŸ}5=JâÓNâî¬ÊïH¹U|~•þõùy¶ó	„å†6FÅ` 1¤†goýO}bxF'®;LIð»o.‚`74hêÍ 1Ç@±{ÍfÙ„ ~ØÎYXÙ%(Þ°Û´•”Ó¼!gÇƒúÄ›Âá8¼!¢™¥îœÞ´Ê®òA¸S|~J¬¦triz3dé,Œ/¿ÓlJÈÕš®toB]èÞÓ˜)®O8T™®5Ð©@­Ìz‚¶ÕáÒd$IgE9ÙMOœ
±¨ÅèuÁ3Ñmg”rŽÑlãÓ£â¾± ¡KÁqïVH;.ØfæªˆæZP7)ºÁº‡•Y€Û™>C¿+´s­£Wx„P
O¹ø$Þ¼òÃØ™‹Wãc[7ºÈJòå:p-ÄÇÇ7k š±8´	†æ5>íéŠâ™Ê¨Yk*yw—nººíHCÀÆðŸ¥¸HHÍpn¸§×RƒZì5Él‚¨€•b˜Nb1AYm*RÛ•´E¬P”çtì%5¤ö…Å£<z”GâæË#‹2ñâm ½_s²UWd1êˆŽ5œòsýˆiJ/É#£>2êƒbTÝ/¬hrŽ|KãÂzŒF~|œŒjÝ=àg5ÑE[¢óLGõ'dÝã(^7¼%{íkh¾¿¦ÃèºA¥[XM.¥!GŠš‰@„ó›ús)d&Ó^f7ÌmùIòoÁ™†3LrÎÊáUL}Íõíf³X±ËêŽg5ât¤­€ xE¢tà›"n„ºsä]Mcr~“Àp™Âc’óâxú(åï£ü-_ '¦aä[a(4
£(”«Iµ,"6Hø@J 	§¬s¬„5î1>#[,ÌK±Äƒc;X™!=3è±«¹W2J>Ê(¿K—öèûÙ™ã¥zÃ^3û®D]aÃl\}Çfñi<ò£ËÜ¯Ë²ÄÙó ¹K>8´ÛÄ
¨¹ ÆÒZ/n-û,íöeyßøSLã·N÷VJ†VZkûZ{u+¤ÿY ÓäŽl’ôË~4÷B.o%Üä<+‰™¦ßéÒ‚r-µ¨QFS}š¼Mù™ ã½­½¦!„†d~ú/ooAÙÎÇûX°¦Vœ>˜½Üäm¿’­fóî~0ÕçÕG+-åXÍ³ÒöÂà‚Í é3g÷
ãÝS÷ní•Ü+œð·ðCŸroCÃ0ª<Ä™:bÔ“™Á†ËL˜j¨jýô<h\¬ºÚ«V¬‰³Kqòö•MH__åÂÂ ¡ÁÂºÊüQ[ùéÙ|®sb¾ƒW)Jyà÷yMG¯Ö^ƒR1¢KAF±7ƒd˜™ýŠÆb1|‘5Dac6ê` ñÃ€¡cíû¸ÓŠçf½_ÄÑu3”†È³¾/iÆ]a0ÞÇ(’‰@$O£ ñ-o£(‘^3S0—öìà0ßó šÌ°Òr;Œ†÷†'òª†ä#è¹°-b ¾Ï&…N$
XÛŒ}:it5'[‹%´ÔI„1š&éà¶qj¯&Ó$Ø C %ÑNA’àÔã&£Ÿõ›WŠ`STvá[äøÖÀ!»çƒ8
CúºaðÿI0Jý,ö?þµC /2æ{è¶2øVNÊ@q;6ÙH+×ŒPûo)Ä½Z¢èCú*G8SbŠÚÞô£gÒhLfØ#‚ÁÚ«·¸ñ(Ç„e M~â4˜T(ÝC´òÝõœu¯Ç£Ït4ZèX´ð‘èA‡Tš…ñT8)“eµ¬žç^k
Oš¶µ­Ûë%</=†^2NËÐ—"7t[á»¤´¥‹¥ünºÓ$“O4)B€)çßˆ$èÌ7{Ñ´Œá€Ï:°#Ä$a¡íŒùÔ	5šG`ÖÖg“õ„™s¨Wb´7ïuæÅÐ~N·Ôºþ5z¢:Ô9‡„gÒíía&Ý,]Áœâç|zZß;¥µÂA[ü×cÌ£1U\Ëz1´63zÄ´‰Qù3X2õƒeý\ø!:ð¿6êé‡pFX±ÒäØb\~8Ä*d#Þ¥†ÞCúM-K6ôaéú<ÉxüîŸ}‚gÔ0zfŸ¬JÖ	Œ.™Ðÿ.`èáˆþ÷)¤ÿmóÿAI\B†þ¥wÎò@G”¯ñ‡yÎÅX`öIÏ€ôyÁî{Âï#3ÝOè€aØÏgŸÖŸ˜Â+AC<ØÚZÒ·Æ¶;ö¶01ØrÏÞæ
[>³·ÜfM··íMwxÓ§ÐÔÐòÎåaÞ#ü‚ä™­©/ÿ¦+d)mÇ.›Uˆ°€ì3¦¼×QÝ¦5¼êßÞ"ªð#äKFè¹mdDùOgVB“î··’ø¬Û,(<	œýúó=’xs¼Å¯ï5×çÙ’ÙÏï·Í­_ÖÍ£ÓÛÊðb¶8\dß,…œQhÂ¾S«JÓË`0õrT¿a[Ú|ÚÌûÄ7ÙlÕó¾í­¦KBx6Áü>Kù1‡ lqeÎ^ß"Ó³Ëo$óhvª™7bøÆMP\L<]Í†Þœî"Æ»´38õ†›zF[æ]<»øÓC3:mÛOvÝTŒŠñ†Ã
Oph£•çOsxˆÁ+®¼©&Ï•†rŠ°À`SEc €€®’^æ:’B?ÒxçŒóâecêS‘$Ó‹öØüÚâAè+ü<ÂÐQPhR/ú1Ñ¶µM±‚6µO9ÏÁÈËÉî”[A¦„ú¨`ä˜]„Zbíeºù3ªÚ™òf¤Yi
âÑ8’9bfÀªbÓßY½H8Oí²Dø"HÌÐ@Þÿek{{k«ýB¼ÿK³µµ³Õü¥@—,Aúûf³$õx'éN–?Ú»EaK“’éÀî8)¯Gïbƒ“.7/vRuÚƒè4 æ4üƒ’Í|7™±»;ÕyŸ|¸ŠÃÚ·š¡ßm ßFïŸYdll{„|‚þtXŸ€VÌÂCÞºôkkíI›h’øá¨…zÑ”Æ ¢e–¡:Y	H‡KÄÉü÷àË¦kÂ±Ómáº7ã¶Ho€ÕdÈpcê°œs³ËA×”/:e¨Z®±ç¬å4ÅqýY‘§9KÓ
ŸýßXÍOœU\›êb¯J}ìm:1ðÖÅŠ$s/ž³P¢‹w£ó ×³@:\®_Æ¨¹Žåð†*}¯¨Ðt†‘¯»üÆL3e3H&-“	G•úpç"Ø¥ö1pd <®ŒŒ$”ù(pV6‚y|5€”—ÄÚ%?vïªj5èr'?óqmý¼ß:<¬¯sóJj/ ÓNƒŸ~@oöÌ‹¿;×rçxÎGâ	OÈ:ž67ž­æù²s7ûô¶e·{¨ƒqŸ/?ý@í¹¤×:ÛW²(žºÖ–/W–5.ä¯•i®e±„ÖœûJøY$­±hQ~Uà„©¶É6[1j|rÝ
ïuÆfãhÝÿ”ÑÇäÅ8Uëi•ìT,Ü“ ^½ˆ^H€r¡ì*?+ÉÄ2ˆ¶ž=	phR¼¬Æ‚t…4jo0¢'×y¼Ü­¤€›+ø”v›NZ\Ú«»z("…òýó>ÅÊ~+á<îG?­„ëXÖ=ûXé$géýp\ÝL£ƒˆè¬9Éi$’BBaB ³IyÊ³úˆE/ æpGÅ ÕÔˆjÊ—~ƒ^ªûç|Ê#Ç˜¯j“sÌ[Àÿ2ì¹êL`QŽ½¦çš‚8Æ“&˜@ñ‚<Ø:óuW/r–á4ÕÖå}–à¸ô¥ÙÎ|Uc»âq9˜Òý†1Ã?ÓlM#<¾o1<×f†ç*!¬žMv[‡;ß6†®ƒO'þÜzsïþÙÔ•#*r§ÌŸâerG_Ý)ÎtšPuìP èëB[ª %ð
7ªÆ#ê`Ì!á]4UzhÊ!•î"CU0*¡ç#³*m5Ñ¬ô¤ê“mZd¥îü„ÙUeý1­áÒªò„ªf°J'K'‰"dÊÂû¥Š•Ûe!p;õ’²ØéçÔI¦çIm©Õõ¸ßV Ú¾¸?KUÙÞ?-å¶¡R¯;K¹hmoî¢ø¦*¡ëì\Mä³êÖrgÕ
6ìlÓ«l¾®Ä·gõÞø>¸âµû|Ë5¢Ãÿ³,ÖÏ>J¡¯ƒÑ®é»´qL–å;8}ýÅ2Ú0º¸ßezç¨ßâA4t7“³ @øwŽÅ§cJÍä%ê«ÿ  ÿÿì]ÝrÛHv¾ÏS´•©½#R¶gG%yJ#É^íZ’#i&;™lÆÙ"1	 mi´z‚Te/“ÊÍæ&U¹Jnó<yì#äœþ@w£A‚4í«fl“@£Ñ}Îéóós\>#ÃgDáûvZ'¨ãÖ¼îº‰-ˆïž$ÄT;5UÈ}«•õ„WÝôÚ{„ÝÇWÂ›Û§T×$CÔ~ßÞhfÔ¬Ú+
kz³ž­~¦68ß8øÓò¼r_2Ê©cÒ8˜%LyÕç–4¦³©!Êœ‹*+¾eìÀe}æßœÀ\|÷²ž½*Š‹¿)€ÙîwvRl{MûÄûÞÝ“š· d‚½•“šÞ‘·sÂÀ÷îX2Sûx^A×Ü•E@ŠãÿÑt³Ï?×Õ?({‚Œ­ÉÐuÊÐ¡_=Ý`Ì u‘æ½ªŒÚ×eæ$§ý±³vÚÓ*B'à¾Œi¸oølKÁU°/A›fî_:;‚/CƒÒ	«ò}K^Ã”koÊo:LØnÉ8í(Œ†žhRöÃÓÎÓri™)Þ£¼a‚Z“y;d£óë§ø†]Ð*“ôü>&³·T8ÉÝDŽGìXŽF4è0´·ˆ±tVëÄ¼>•±V”ê¾Òëð
•—T\`®ÄelNaoèTz@©Ö„‰_þÎ½k*ë—Ú>;}õ=Ù??Ú'/ÎÎ|ÿüðBm˜êÚU@ŠxëÒ4<Å…$ã?†õfºÓ w#‰íeÿqìÝ
ñ{{+iÉ–º¬Ôm¬PµNRì¥‹Þ¶mÈ.%HkÓ¢YUqQ
;UJ”ÞKS˜³wåw¥DéÏ?·%¢£åD‡.!Ú0h>ñ™ÊF,Q¢=SÙ˜ýØ0˜9¥Ù:Ti$çÔgó°çFµ&2Ïv<}²±v ™X<m:qEqUêpuÂpUšpUrpeJ°=X“þ[/é·œêk´Mi½2™¨§òÚ²xIWÛÏdÒÕ¯§NºJ›ËÌMè–59·%`¹e]‘«ˆzoÛþ(ÅµÍ‹dûÚåïÝúœ×ÎÒ2ff-[6Ö<3°ôYWZÅG§ð,&£ª‰,ª©2§\3ó›!ÕhVT“™PMg?ÕÉxj4Ëi^™M9ÌÊC’“øÌÃts–•‰JµdÀB’xëêd£Z¯Ý\RQC‰DÍ$ÕHªD¦hƒžÁ	¹µ±T‰AÍ%ÍÏ+ãLä•	=µh¼‰Ä0Yà°\±WÕT=×äóAY•}ó¤ñì›ù“ke6M-rm"kæÓ#×6óeþäç–É2ßì•ZÞX–Ê§Gæ‹È4ÉŠÓ/GÎÉü9Ä)‡d.y#N°“¥ÌqÌ	YXHÜÅæ{ÌœãQ™×áP®È1ÃÅª¯4 *«ØÖ:fËÁØÊõ°±¥`€(üÅ'(+$øËE%OÔÄqOm_|5·Œ	¼ÃÜŽ:ÙÕÀìÅ¬ˆ%_ý:éKÉ
us–|?œó–…\“–ÀyçhP?¹`	$‰`¦ÄŠu®› Ð\R@£‰ 5ÁÿµtÐ% ù/
Ø_Ìß€_€öŸ8\Z¨?8ÖÀG#Àû°ýØ¾’GöåœÍiÞèÙÇ®_¸ªSé×ÃÎÓÐ~]˜S~@wXùÙõµDwÓ€"ýaG€ˆ÷ì#>"ÛH<òÆñ Lâipæ)uöí¯àÃ(1+ÿ-ÚŒÁc Ü‘hf¹#šé/BûÇÞ
68Ê_w?t:_#ðw ¯ëë×¬aæxLÓ0kjŒð´aÍ <6ØŠ¶ã‚«PÁvL°\¶¡KXà:Hà"Ø Jê1ÀÌ8õñgû½=‹äüš¼a$Ÿ‡ƒœãW Œç€/®ÝÔÁ±“CaîeqY$l€/@x~ð`8X×†{(àÙ1ÀS €+­¿…£Äþ6‡üm÷ëŽúmóû€ø]â×ÌM6UÛ hëÕìÚ8ßœ¾ ŒïŒïZ…î­ñ²M!{Áõ6êuÆôV„E?<oShÞ
xžl[á­AÉ³ãwgì7ÖwêWÑî/µ;OÂ¬@ëÖ ÌÙ‘ºŸa~¤øÜyš.wž¨Ü”Ü"÷Ó!ç_wžœà€¿úvfâAÞ:án„ºuÇÜ.q;#Þ¶m[¿uBÚÎõ^C¶/¾öÓ9ªaK€©]JaDmux÷ƒmƒ;–vYàƒÎHÚ%^uwíR’~=íïƒ#vvYHß9ûe•xÙºhÙ…ae? Rvœ¬uuëad›BÈ6ˆ­…Ž­¡=~pdìbp±î¨Ø0±ÎˆXg<l}4ì,aƒp°(ØlŠXÝ-Ji©p6ëp¯Ú‡k¾ÌÍCÈV5yÿû“£ÓKr~tptüú’œœî¿Ra¬1h7¡=,è{N»Ô'v<ëµ\ŸÁ®ž:8úÆpòˆñ:ÐB’ä*˜Dˆ#ñFþåÌµ×£p‘µp²Ý¡¬ÂëVaèÝÀ	§ž!Æ¼u [ãö3Jp—¶oKõ–K«w^yÀÎU{[ÎñJlé˜ÕÛ)…8&ã[X³‚kÿg_+ÏuÛÌB>8è=H™[&sÄ/ú€c^Ê¨®®œ@±ÌâÛqzxfx‰–ð:qÁ~¢ãg=Ÿ\M’$ÔxÃÑAàwßîÝµX}d ×‹ò[È§–,¾húr¤¢lÉ™~¶µ!~’_<Ù ¼ë¡$IFŒ°"£ØO|˜pw’,jàw5ªs÷÷yÃ2 ê,+'»ë|E
t[^»Jº¥Q0í“¸Šì2NKçætTIÀË©ÿ°½Áyþõ”ÿ+eÐÛ¶7IÂ2øÃ~yŸã¨»§%¦ˆÿ‰ÐÒò]^ì­È^£:ªÇ*“#©HÉ°ÁáÕOðlY÷]Ñ³Ë%}#zM£ˆF¯C M„k„mùUñâuíþ¹Ë"‰jÜfvCy-½òË`.S,%Ñ²-(úâúögVyÃÞÕ¥­õ¿¿XïƒBÇþ}g<êÛÙˆ2M¢8Ç	¥£ýÕ†"¥Ýµ•îÇÐnb•Ë+»•ÖæÏC±nl*¼>ÏÓ»^øÕ;_v×½…K=ïÊ?Í[”‡®ë^wu‚0¦ÓI:÷\ £ÃãKryöíùé>SšÊÊÒ |Ôó4dOÂžÌWUÚXvU©B9BEJ§ùj­I(—¯ßˆ¿êDÛ`«t~cæM-•É té]¤# ‘c4ìÏîRì½C
ÇG—h|°5ó	¶ÅüSj<¢9JÆÅ¨¤jOº#
ë×WkØÒÍM­É©öE…Cžë_n¼üÁU;¼+B71§¹˜ý<ÝÙeLJC'Éóƒ7Ã2ÇL.ý$ äW»ëìš‰ø£ñ$Ñ9¿’Û±ØT­oL8é¨ nh®âx£>\Ú¢’¼Ž”›Z´Ö|Ÿ&6¢6¿3·ÓLäˆsF#Ÿ¤¡£œ#ì\a	_‡ÝI¼Næcby“ü+ÙÍñ_i.úÒßóïèh²ˆmfÏ©½Ïì®Ou£+Û3}òFmVÙiä‚%?bâ™Pl¤"‰¥çMrÁ‡\ð6zÁÛ\Èe™Fëï7%¦€Ý?Ãn¡{œrûÅŸ.,É¡qNû~?1ŒYJURuŒ©£@ê“Ùƒ”b£í(Ÿê1³`2ôº²N.©7$û“dÀ"J§^€’!U› äŸ¸øñ˜@ƒ%ª‘•z[K¿²å2g{Ñìó1ºÍ¦8yÑŒÔn_jy:8Œ¼Q—NF¤Ë
yñí¨KZÚV‹øA¬Ò#Õ†’*ÿøGò(§të~@y§û^ ºŸ$‹ˆßL(øµß§ÑIÜo­¾(sƒøÀ#þˆxðGDÿqâG˜iÁ¬®‘UEaTî
É?<¼©lêx“†&c<Nzdþ=Ó„í`Ìªtq=õê€}á=Ç=ò51Bë;N×ˆ…GïÊÑìŒ®i"~Þá&ew¨{fº_/»wÌt%åš],vØt}¤;³»µ'’	²á5°LÏ40«•‚0žl°Eio¼';¤«ùEK-Þ{ÏOHìqàO|^$aäõiK„ö&‹Ò]®Ò·âL“$Oº]Çx,Ü2âßê([“çP%ßd0"•[·4@W6ŽLe1WG„]ÀÊ~H–Ý‚»¾Ï^‘ýƒƒ³ô{_Ÿ’Ã£ËýãWeG8ÒèûÝî9Æ¯(}p„«+úV+EY4ýÜ~!>òoüÚÕ÷’……Ã!fÛ\ÐÉ®a'ùQ‘˜gA,­¼D °Õ(+](Ô‡)_-¯ÜÔQAA"Í›²if­IÓÂ»4ãIdLÙ\Zy^–ZäöSžcï6¾ñ’¦±jŸ1Šü®ÎâºžÚ’Qs0£•ç¯Â^‹æ]$^2‰Áz|ÍP
4j³ÍèâAÕ't
Vµ8«øe<~ôüëÏgßZýžÆ«•>§»7™!¨‰\g4*+„@‡Ú/!
Ì€T?@â;®&‹d•Ï&Ö„"ÉE|Å_ƒýÕ“´€“yÈ6dfE+æ³É¦Ó¦ïæ­GZþåÏúO"iï\Z&butc°æØoó¥©Óð£')x…
Šò†W°óHR›)Ieß=dÅ¿Yrºúwr2Ò¢ Í.hpÝÞ"T¬‘¾p3k‘—Í\/°´IâáNQJ–=8õŽÙy¿	ôu¾óÄÙ:ônãÇ•AŽ&H;zú£½•ýoŠ›ˆšMç¢gH“ŸQ½Ó-BÁ@kX1íÝñ‘¾ 4îˆâ¨?p¼{0àc¹J€×RkkÚò‹w€YÇ`eLWh§ß![+O€šp‚ºÅNôšÔWå\„ç§Œ"HxMp[âÇD.EG¯§™£sšg´û¶}6ñÚuøãv–aš¬S°çÂæ±xL]¾Pon”5ºbàÑ;ãÌ¹»fØ|JÎº	imníÀéóúäñ'Î@:ë‰?¤D,QÚ‹1½†­éÔàå5?ò6¿ÀÅ‘Ö¨pRRó‘³‹ƒ{õ4‹…ïã½»m…ä9G<Ow¡…eÄ].Ü¢ò
'd~°¾…¤Çü}]t%Fkä<‡äÉÆV‡p1â`
ds+0Âßšïè¨lV‚¯Mê@‘˜¨É~-OHMw³¬Á¥è½
<#‡d‚Eh¹p ý ¼òƒ¡Çw@ÇËKê/Ã°Prâcò
v¨"$«s€³ca•ÜHøÉS6>R“´åmµi{$ãxg}}t¼ñ¸ÓÃN?Xït:$Œˆü¹ÏÖ <Ï®ÄŸçAÔ¬êv3r|‚~íÅèP¢î}€/‡ì{)Ý1u’z±Üó2ËÊU"‘k¾*yþ^„aâäš^PÚn7ã°ý„ƒÔŽËWÂÆtc½ÿ€‡qY©²^j3‘=R4ÀdœmžUL×åê|«xÝcPáR›HgV)ÕÑì‰ª‚ªÇ•1-ƒŠØ  lþÁùM×íƒ@"•Üº¦Àª§*/;yÇ‹Ó=B“Hoÿ®Aç†;C~Q1È@n´ñwŠ›n½SÝ•ÂÞéo,µ/“ŽÅb_†/|P1’0JƒÇâLAûåú:Ù@Èò!T!qQïœ`ÿÿEí-¡7~¬7ÆD™€z£ã® Ë²×?Ktûá¼öÏûí¿Ûhõ–ñ¶ú¸“„¯Â÷4: ½ exþ6>:<ª0Ù|¯å!S{uÊñü%3@\‹ò|såÒž‰	¶Ìuî­²¡M¤5K5ÂT±Õ,Œ55ka…€:uô>]‘·Ê„¶­Z<2-ðc>Àµ°"Ðƒ°WŒ?õ!›„ B2äRkåÌ¦”¤œîé¦¾³²FpLý$Õ7ÏÆCòc›!2ª°Råe¶£Lœ %Z-Æ†2Nysž«Cô™áPrê÷vCÐðmÌž]Ÿ#'gôÊÁÙþÁoÈÑïŽ^‘ó£—Ç—çÀ¢Íàd˜Ø£Ð¼ÒN×fnó²äº¾YSâB¹<¹IÚ¿ÂÄ7÷:ræq×h{2^rŒ¹¾•6‘Þ×RÞdb˜x±Ü–°‹¶ô•¶vy™ŒúX™ºI*M`€µÂw‘÷cÿ<Œq‡ã0Ò©T:û^gWojìêoX—7Ž—Ä~ é£y;ÇR‰Åt)Õz¦>?µ½ª…/±HºÓMà!2Ë‚ˆÄã¯{Í”„×¼%dë‡?X/þÎ|.ªðD3\o?À>HÔE7
ƒÀ»
h-tT1XzŸ•¸£ðOöÌ„ŽÉæ¹¤Ã1V[#iEˆâ£m"_[‘…=já–¼üŽ‡;²¾¥AÆò6kp]Išr!kÄÛOÑ`uˆŒàîX 8ƒ€²Uë¨³øÙìocî;¼Iáw…È“»¨qOfqiA7ì<ZˆáÅÒ÷
'éñ¹±Âk}:¢ÓÕùL¯A©e?@õö½Ÿà…|(IõjŒšÑt¤#Ö—vì÷á}ìH:÷Áˆ/6LX)CP‹ÉKøûýñ¡@ƒä¢1éO< 	…¿2­¹}NàþH»h5â½FÌO*gAuïT®[¹cn¹EÀï9“+G}*ËÄ±žîØç•ŸH´Ô &ˆI_ÎŠ£»¬–]„Zª¬[Î†Ú¤­Õ¹	â›Ç¦ÊÂF§6j“ŠÌ­V2‡mé›ðÆA`J‘¤ÕåæáQåÐVGÎõ,[(Y‘—þqV
R’ò^W,öYJ’
Ù=-Öðz¦R{AHikSìçWÔêÅ¤ªp
(]ô80Æé8Ù[aD±Fð#O„¤8×f*_ÆÊ`©G¬àaÑ¬UÖÚ¨(F„=½›ˆK×ÍÛt•;ìa7ÙMÙaOíœ¶˜µWX»áò‰m^›Ó·Ð6±,k¶åe}ÁXøw)ôâÚF	»Ý\]ÓV›Ý.nÃß ÜÇhc/òúêÉ7 å."¤%KõPWø0aµ`*`áÄ˜`5êyQøÎ ÿªaÇ8p,…kDÉ8<-#npšë½×Ñt ºã>R±º½#…ÖMDtdÔEìÒñŽêI—¥ïi„í-Ù€Žú W £yCß€Z£Ó"Ý§(æœdcUó:­äºmkJPú´™µNÙ™-³Q¼[l†½,¤ïÑ(R¬ âŽàïˆá–o7ž€å·òÜV§_ZßÁd8.˜˜´ö<i0Í“x@ûIäwP%ÒZmTg­TË/A¯šø°°À/]káÐÿ™’[ÔeA­P¹gÐØ>\¿ö#Øö½dª˜ÿ¢l –5Öd „ýoI¿4èòµ•y°	×‰;äÄñ
œŽ?z‡F2ÇTÄ .Ãrv½‰°Ð†B¥]V^qÅø ø­DÔë¸*¶xáa¯„~B”p<gì`Ý&Ô­ßŽñéÌÖ^P›é%²l#§Šã0œÊäs _ØÝãÑuhÎ“œÂ†âËzwÉ8€eI_²è,2[vÿù.9ìS®sm¨S}Š¿c%~ÏsÐIñ[´žÄŠ”‘y¢: ãùÍ<›·ÕÉ=xåÎø¤Ô•tÈþÞ‚¬¾Z]_}½ŠÑN¸À»}Üà,NÏð˜9Œ§^n>ìÇ‘Àó*× 7f`5³rà`¡â™ÒàÌØ6à?‚ÓGÖ>¯–íûˆZßÃ§}rÒ><lr}ÎÑ­>œíÀ9 Ät¨»ç{£5\ŸW ³ÚüÏúüÝõ‰7\©c}¼/[v!ï“«eæ}æÉm­’|Ž‘š×Èp‚eXÐ/½cð?gÃ²&˜-„«™y¯4·(:?ÑÂ äcé¢nlÑÇÃ‹ï^/è	'PƒÏUIžå¡0$Ì(¥Á‡_ta¨‘çâ{ïTŸ¹Ï„£ŒÙ| ñIˆò<é$Îàé]ße—_Àê÷´;¼F¾ùfccs«I¹µŸ½,cÄu–	JÓ	¨Ïy^k1VðéüÙ!‡áO`Ô¯,Í_œ0h#Ö'j	hoæ7„-Ç†Â1 °ýU§‘uÌ§,ð,?¬Í=¨'þ­¡9‡9³<bðKqS©u‘ÖÒó¶šØŸ¥d/	»¹&zåÎ9ONqÒÔýîÐR'‰ ‡Jwý~@£äÀºAŠ`sHJ—ä9(çÙZËiY7áÞè¯´’ÝW€o»[òåVçÚRßú2g¬`²‚4dÈ°lƒËö¸=¦ü¶ÌcGZDþé†QD»	Ê®!êƒÌ¬RL*f²pñú\q2R8| Îýb 	 §[ùI“›ÅóÙj¼6
!,hø,|jêÑ•vèºóïs¡»ôébclÊ¾E_þÔÎ¬udG}»¤aÄ*öEÞÁÔ;°e§“¡<ÄÍ½«\E7T†®åñÁ¾dAS¿$‹öøXôŸ]d
DÀëˆ¾óéûzî$gYÓ9T·¹‹IZ5ádª‰D® *È…l™×í^ª,±€ê‹<™œ>.PE\ö*æÖÚJÐÌ#ãì³U`óJ€»E¥¡g†wªæäJ7áa· ¬à”5ÑFÂàåÈ"[®äð»EË.äV‰Ã¢ƒË"¿’HDÊƒ­²f/y'^Þú«‰J§—Ml¯<ÿëÝõdP÷¦Ôé2ÍÍ²qý;™3c°~®õïfÖâ47¦–Ø47«æ”ý~ø52«ÓVÊÚM®B`=åÙÅ3_ø,ä¡XìlÃÉÞ»±ží|‘8Þ{7¹¾Œ1m¸ª»eÒ+¬¤b ëAcðXòÙ„7±p mðÂ¡ žç)­þØoZç¬]©FgQ¥|6ßÏÒfÙ¼ ÷:®Šâ!×“î ö=©î±!äw¨ñç…§zõÖÆª¨’–´Ù,–°Éß­”¾Y­hHÏ?Y›ïªréÞ<Í¶ë$¬í¬O‡ÂÃ
›'v1á©tc“Eø)7:
t¥BÕiHŽÄ{ÝWv/•Ï4újé+Ö@ºÎ´Ød²Ù.³™~±3¶µó\&{ŠÎ²—…!eËfF•çoþùVéöÇØÄ¼IÏ÷¡79U˜BÓ´[åƒ¤®JŸ÷M3ÃÅ8³éPfºU,Ì¢)çágO‹GÊ%8mnÉ¥ÐYaÊšÕcÅìY"Ü5ó’&)PÌÔýL+^¦³ÝŒÕ”L€ìêâ`í)@Û5aÛuÛZè¶3éÍ-AÚ™äôEmö´™`fÚöž£˜ëíU‚\àüc—ðT0åTQqŽ®ýh˜Ñ¿Ù¾gwo\SÆžjvv¦¤1÷òYýAQ‚ïž¤è»Q˜´=œ>í1ý/O«º‚o:¢¸+=Ko:ì-šszÑxpð^OsžÆþÈèu–Â-E§Ó±i’»Úq0K¾îÜYNh¹œª @‘ cu"YãÆWÑ5½¶¢~­_Õ/k­4uüíÙñ)98;}q|~RÎÄÀ*lØÒeÎ©¾õCâß2%þM[$»Ä¿ÚÅµÜ/¥ˆÚÖÒG$l×ãžó§«¥£6Hä ÆXwñžÍ`«	/Ã «;á`ý´eódøm&MjŠùÞØ‡³’M…ÝÖA„Íøà:ÝûlqSæG$•v³T’•ç
c°Æ"–°„	bQ`SîÖ0*jÃ=y¦XÄÈoD©×±ÛØV+Ç$÷O‚Æ ~Çš¨ÜëÅ¦, }æ®e6´xy™Ci”IL£¯kÜ¤µ¼Xg 1ÇÇ¢Aa »XülPûl¹ó¢Øï$pNcŸs½€¼Õîµ“¯ðÀeç'SùLs¤@¬c'Ê&$çƒvÆÊi˜¤µbÕ@íN]£R—ý¸UèË[jPóNòlÆÈ)o<Ûz’Ïa»‚*ò»“ÇäW^®J¡¹Þs¹&ææSmñgQÑPÈù®›¿m‰ÛËéP¡ºõÀóòÞ\úmú"…N™ÆSäÝ	ËòDð`=Ž,™Ã¹òœ-J;‰üqŽÊg¨Â¡c2h© K¬FÑÃ’§j©Äuò·ÞÏˆpâ6{”]*Ò;|L´¢]D–+ÙÌ¼µW9cæŠ¡ÛdœÀÿtçõ§:]aÎÓ¶a±‚”¹DXõ¾:\]#‰–«¿»£Iß×€ztã™íf¹ÉYNØXi¦°U²®ØŠC¼Ó[{â~KS]üp!Çj1_…7†æºøñ{{+(ÁÚoù:éó_ñÃC¯#Ãë’–|b…y5ÅçdÃÈ´ÈAeLŠG¢“n“9â6L­.ØË.²\ÔXÈ2”n’ªÆPA',+x”ëfãÇìÁâÜ4H†Á‹0*,­+«àŠŽi@»‰-s?ùóüSJì­Ø$|I=ªÊÂ`üG£vW¹ùz,œ×³k<×ÐY¥i˜¥/ë!žjö´ËOuþ1ZÕ*õžxÉ 3ônZ›kÄºZm²‰J;&?Žú-sÌ??ŒâiKíï|“”ü+½ejÌ‚éÆYÙâ»móvX:åˆ+ªÍÍL#A”yhZ5`åù]y½ï{U ŠEJËJ_|ÂÔñÅÔÔa[°ÁÝàuc>èúOªŒù:M¡ˆžM7Pùät¹´sÕþ÷_ÿûÿþçO)¹·°žB<wÕ ¸÷¿LÕ@%^›j[­ÕÀpEsª²ÞË¡¨„RRrÔñ èoR5øÎ˜ËèÒ£oß‡£^ø $è?©’ðŽ¯ØJ‚XëÙ”eONIK;gÂ?ÿ—†ì[ßÏ]S(À/SSP)Ø¦)äVëAS0\Ñœ¦ ¬÷rh
*¡”4…u<h
úß§Ò\¿n>²Å8‚‰ðß	Á0]¨DQXÂ¯òÅBM·¬&È(ßÀô6œ0\’rãâO[ÚZÆøS¾i¯2KèIÛU^ŸèÖtp!roäÞ\^¯—¿ËjÅ{ÿ¤yÇ.óJ|Z—Émïû]Î4ÞV23a‡¿<Ý˜S;y­¤Y\y=9v“ÿ(h¨ª­üGFBÿö/YçøÖ¡‡Í/#ïöA÷nèßìÑugÝ½~ô5ys|Í*¬-býôì’õ:J¼[„ …Qßù?cqZÎKkìbVÿòŠ‚¢ÙƒÓ—&áKÃÒ8‚ÎÁó“Bsç·Ã7~|ºqßy£ÏYAf¥qgÏn§ýÔY;¬u1•ŽÜ	Éž,ç‡å'XÉ*“¨à1áq‚GØ°:~Öå0ü’»pÖ7€þ›u½Ë´Tí8Õ˜dÿåEz©Ñ!QlFÔ©KÚ•^)Û%¦NjJÛ³¡óÂ#¢òT†â’LÓYY#+¬ºÐŠ!Y‘£ZõMÒŒoþ­©ÓÉP¾»)fïµ¡Z¬Ÿy”œ{×>Ê;ó(9ÓÏ>J&^  ±DÕôE¿ÈfûEúHm+SÜ]íh»{µöVgãdvßyÕæA›fNÛýQ¡¸«ø œ€Ü… Å`ú¥ÈÍÊW…3KÑ7¾ U|Gôý9½vl|+&kj2)…€lJéØW§§˜n}›qûNÊ,¦‹ÇSï¤ìdºø]Æ»;)Ã™.ó¬¶£egÓÍ~o‡¼ù,—"á÷îü,´WöýÓØ¨á÷Ò5ƒ¯Ž(öÜOvJn!_œI•^mž¢U/'4sû›y+?qóåû¬nÚ1´bð’zRÙèóÍ…ÒÄ”-'Å*7¥\—Go€aÃ·zn©_)>J,;·(5Q%\>’.¥µU9]&´=¯Iæ.~Nr”F'}p†åÃ£WG—Gäüøô¥ÌK64/Eö¼)–ðûÐÙÉóHHöœsfMÙhz:ÿ¼â²i5{b­´)È`ûÆù'æØ‰ÚºZb?§CXé<E•S™Êé¹5r_Ï•¡N~E`M­/.~¯YÆ™²a­¯•®ïÛ›Øfs+Uè«tåž[DåÈÄ‘ÀžÁ´žiWF—*­«&&amÅ6Ø.ÕÚÍˆ5©Méeåù~Ä2ŽkÃ|SÞ­-Òã’2Oå_]o—)]Tho0¿V„tu@=‹’ý8öû#–C„EQ—¯z„.·oGû†öÀÄP*×êK’è»]±?=Œ)ñºw}ñ-d?mçƒíímÇî‘2Yk1«qOäWÒ6jÅJ>˜tá¥ÝBXKxÊ\yxBá.³Rüï@b…U¥‘†@àÜwÇTjÅ²'µü²„\bN®TúVÁ=v¼ ßRMTcM#h¼F°ì¨—-äØÑ@´Ý°CŸÑ‘‡F·@^Ô‹ÝßÚ¼ªùêãôPÖ<‚\”Ú…¤7´;I(WpI[*ÇÛ—TœXÏ6”*uøÅ—Ò\à§û2ºÃÎn1êŽ—ùYé—`ÈÝÿÕÿ  ÿÿ l+Lø