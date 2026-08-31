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
    const p = cPass.trim();
    if (!u) {
      triggerMsg('Please enter your username.', 'error');
      return;
    }
    // Case-insensitive lookup for organizer username and password
    const organizerKey = Object.keys(organizers).find(k => k.trim().toLowerCase() === u.toLowerCase());
    const acc = organizerKey ? organizers[organizerKey] : undefined;
    if (!acc || (acc.password && acc.password.trim().toLowerCase() !== p.toLowerCase())) {
      triggerMsg('Invalid username or password.', 'error');
      return;
    }
    if (!acc.compId) {
      triggerMsg('No tournament assigned to this organizer account.', 'error');
      return;
    }
    setRole('organizer');
    setUser(organizerKey || u);
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

    // Check coaches (case-insensitive username)
    if (fpUsername.trim()) {
      const uname = fpUsername.trim().toLowerCase();
      const matchedCoachEntry = Object.entries(coaches).find(([k, c]) => 
        (k.trim().toLowerCase() === uname || c.username?.trim().toLowerCase() === uname) &&
        c.name.trim().toLowerCase() === cname &&
        (c.phone || '').replace(/[^0-9]/g, '') === cphone
      );
      if (matchedCoachEntry) {
        foundPass = matchedCoachEntry[1].password;
      }
    }

    // Check referees (case-insensitive NRIC)
    if (!foundPass && fpNric.trim()) {
      const cnric = fpNric.trim().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const matchedRef = refereeAccounts.find(r =>
        r.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cnric &&
        r.fullName.trim().toLowerCase() === cname &&
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
    const p = cPass.trim();
    if (!u) {
      triggerMsg('Please enter your username.', 'error');
      return;
    }
    // Case-insensitive lookup for coach username and password
    const coachKey = Object.keys(coaches).find(k => k.trim().toLowerCase() === u.toLowerCase());
    const acc = coachKey ? coaches[coachKey] : undefined;
    if (!acc || (acc.password && acc.password.trim().toLowerCase() !== p.toLowerCase())) {
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
    setUser(coachKey || u);
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
      if (publicPassInput.trim().toLowerCase() !== targetComp.publicViewPassword.trim().toLowerCase()) {
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
      if (account.password && account.password.trim().toLowerCase() !== refereeLoginPassword.trim().toLowerCase()) {
        triggerMsg('Invalid NRIC or Password.', 'error');
        return;
      }
      
      setRole('referee');
      setUser(account.nric);
      
      const userRefs = referees.filter(r => r.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanIc);
      if (userRefs.length === 1) {
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
    if (userRefsLegacy.length === 1) {
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

    if (account.password && account.password.trim().toLowerCase() !== ricLoginPassword.trim().toLowerCase()) {
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
    const p = sPass.trim();
    const name = sName.trim();
    const club = sClub.trim();
    const phone = sPhone.trim();
    const email = sEmail.trim();
    if (!u || !p || !name || !club || !phone || !email) {
      triggerMsg('Please fill in every registration field.', 'error');
      return;
    }
    const existingCoach = Object.keys(coaches).find(k => k.trim().toLowerCase() === u.toLowerCase());
    if (existingCoach) {
      triggerMsg('Username already taken.', 'error');
      return;
    }
    const updated = { ...coaches, [u]: { password: p, name, club, phone, email } };
    saveCoachesToStorage(updated);
    setRole('coach');
    setUser(u);
    setScreen('coachHome');
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
    if ((targetComp.staffCode || '').trim().toLowerCase() !== oCode.trim().toLowerCase()) {
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
    if (aUser.trim().toLowerCase() !== 'admin' || aPass.trim().toLowerCase() !== (adminPassword || '').trim().toLowerCase()) {
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
    const existingCoach = Object.keys(coaches).find(k => k.trim().toLowerCase() === u.toLowerCase());
    if (existingCoach) {
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
    const existingOrg = Object.keys(organizers).find(k => k.trim().toLowerCase() === u.toLowerCase());
    if (existingOrg) {
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
                        const newFields = fieldsList.map(f => f.id === fieldId ? { ...f, color: colorHexœì}ÝVãHšàý<E›˜.llY™LBÈ,¦øk «º7O-È–°Õ)KI\40gÎœ³·³—s½×û4ûóû}!)$E„BÆäO5:§*±
…"¾ÿß[rO6ÈÕÒ?þQ\CË·=çÃØ¶bgßÞ±BûëxvÔðö—ææ8t'<ŒÅw“~à!™ÐÙìÖâ2Y>-*'¸ÿÇPü:ñ$ôICùä×¶{M”¿òÉ™nÞ]áú[®}¯i‡Ö``õ<G3&ðwaÔYl…ñæ]ÃY"›[äN3ž§[`‡–]9a+râ]øÜXŒÛxeìY®›“¬O³Ã’¹œ«+§o{^pãØd“,Ž‚kg±jŠþ$?>·Â·úžEn·,Ûn,c«ïÆÓæZ[}XxÝßWnÒžoo‘jM¡ƒ¯4×e_;¡ñºÆ¡sëÚu®¬‰7*G»·¡ëšDú—mECÇN?Ï^÷ƒÏ=þiþL|Û±›Þ ?a‚‡îÀc];s;š¯ã­‚ñg?ÓÏºªÅŒF9ö>¢{$”¥bN÷Š4²Ÿ?¦ÿns3£J{šðŽ³kÌyF:‘1mÓ°öøé‰Y#gsa7WáyaoÀŸmÙpšÓf§µNzAh;!ÿ§ã®-<X›O†p”áœÐÍÐ•u’ ˆ‚°9­±ú±{íl_õà”	ÎÝÀoZžGìIhÑõö‚ré[š—¢\Mx³+Ï¹%D±{5möœøÆq|+EÍ>¼ƒ.èfSÌ'ÞÏ÷ê–îÕÈõ›7ÍvÅœ0ëûÐÿì„±Û·<qú8‡!ü‡ Ø¤ÿ³Ý An/£!`È'xY©|¬Î@çüØéŒo%W o4{€YÙã@ð;aßŠ<šþ'ÄÄ×ÆO¿"	Y·ðŠá€`Š…-.!ø0ùýë|ZÅ~®À†V)¬ùî’-ú%®9[Ÿ°zq¥€ëÏø¢®ÝÈ©„¼!µˆö"sìSÏ²ï/ï«v°<×ÏìO:Ó®ã9 §-êð_ºjcø¶Ôì ¡|`‚>¼é, ÚøKó&´ÆÕÀ]9gž¤x®ï$dƒ 9¹¹¬9tm^(Àzå3á©½I~å8¹§cX®&2Ùe»
· ”¹ö-ÙúÞÖ7»ÇsûŸ€½RîÊ(ý!¼¥ô˜ø×d¼¸d2™H«ÔÏ üÉê6Qoµ}7\Üð&eÜQÓ`§2½Bì­|põ¶òÿþ×ÿ©>œ¶Ý_×1ZaØòI“tæv¦vpãÿNõÿÎíT«‰^w+$Ûž;ðG([œaíÇ 	ÿq¥j'ï>.(	‡AàÈ‘ðß¾7éá¿V<DR½O%Ì‘[(âßÿöÛYüµåú0H#ß@²S+ÐéëEt­›zmy'Qª-|Wò·¿‘ôy(“õ §ñœ«˜²F7Í€
`àr)*JÙ—Né.§O]y8f2:]±"bùÓº ÌµŽ´g JÆÓfxJôTö¸
ú“h#˜ÄxköŸ1ÃÓc7ö`Eô5Éžç @Í+^cOùA.àù,l0°}½Â~œažDÝyðL¡;Â’NëN
âª‘ u°ñ3"¡© c JÔAéR£Pzæþæ˜ 	ª¾ãóÍ[¿V|M1–@ñuMî29Ç~ÜF[>«ƒ`¥)¢ÑÂÖÙáƒ¦èþ²°u¸û I¼ž÷šâÖƒÝ8xÐ]œ£ûçÍ±Šs¬Öš#£W&ƒ´!t<­D¢™TbÅ˜iú#¢’ƒà4áÑX›ë'f„&y©‡À¯
Ô‰ùÊ"'ØøKþJ¿Ë_§”…”?\Ñå”ü(Jôé«m9ý6•dþ°»¶ýnõ3Q¯jI·[I ”·ÂÀÙéÿ{ÖÕÄó$p!Øf¸X^RaÇÍ6ùø|c£yãô>¹q“žB3º±âþjÔc'üuC7ê×„¢R›šŒ^¬ÒDÄ.…¡èej'~7K	¶ 0¸¾Ô&ôUA›‰mŠïDµ…ÊxXð™(Ff
qeXªÄžƒÇð‰Ú·\´ÎL«B"ÑZ²›ÐG‰,‘Ùír¶FnNPìY•åœ¼aÎàdßd–?$ôðÏJbÞ¦ºíÌœŸ; DÓnæEB}01ý$ÎL¿€©+f¾¿Ôïy}»å®ãQ¤Ø¶«í•ÕŠ}ükVx4î¥`¦˜IŽ;’Á²hk8EU	yõdäo“Ð¹“ù¾m¾smáŸ #!(+À€k×¹)Ù#ŠÂ…7Ø Â×DjÓüÁ!š„WV? š 1Éä‹qó%“G¨¡¦wsN‡iópË^èš’87_”¤â2oD†ÖìåXÚz›Œ{èšÁw"ç#·‘
í3Ã}˜ç. Üâ¶ï:jñÉî7Î¬ÑÀy›)’ä­eœ%qW0µWçµº%ŽÆUuºLÌëèD :|µ½°…þaòœ C•ìùÔN'_•n ÷wÉÎöé.yº}òãþ99Ýûyï²s|t¾½´w*±…)E[~¾Ü[³º†ÞÐÇ 37?vV:­µ_+ råe»$Êp`Ãò°Š;‚ `ÑŒƒf/$Wa0j~üC§Ûítv~¨„ííÎj§ëðÝ‘;Í+@Þ–€Ñóî£1°Œ©y;øz*[Àk9¥)îŽÕ‹ Ýl\?rÐÏùüKïã{Ò?X*MAš¿»#= ÐÝ§ý‘5p6Èå$ôÏË»_º$÷÷*‘Ët5=ŠråÈ½…Žo7G/vÇÞTáñ{-ùVBKË»Üh(=ÿÜmîŒ‚Ã ÿi2>ñ¬)lÒ¦Â¥íÚÈYÎl¾|ùêÕâ²tÊw0êðÃÛ‡‡Û»dûpÿôÃb0Ês0ø§ÛÛäàÃáÉ‡S²{ºýþøèLq5‡ã-Ó œ\ c+ÄX‚%Åp ïálÇpÏ?M|„ÕFg½ÙùA5~ G<Þ`û`O1æÆA¶²ƒ§?àd}ýÓ@1Üð%»íN»Ù^kvºŠaÔªeBÃ½Œ™²ÓÃqOP=ºçx1Cý¡M¯Å$++ä-#ûÉfdDgSNCåé“–‰ËðF*('…ySØÉ-ÌÛˆà/ØÛ²è?hW¡xúÏ­GÿéòWáßåä5~¶¼Às
Éê(¶Š‘°rêôH¾fw,ó;·”ˆAè"a© J)N—Ð€!¶n};ÕÕ‚WÇ1kº1°8æÝ˜.Ôíè­òAë0H.ÒÉ%=œûùòWTú²s‘Ý#tÔ9*yãoÍÈãŒARÖ)p³¢Ì#M€D°ª´íÜeÀßºr=à%+ª«D_jÁ;3µJr…FRµYSTõ™n†w.°9rêÛ°ù£~òóóa HríZìø¾Oÿ »W©±‰n/úFÌ½šI²ß†‡&65ÐUêNH½¹b?`>îv'Ì;ªç\,À’^í»Ïý „¢	*1ø²>ïª£WJ0{m73P…Ð„‚ˆnƒ@ÛÌž›„	"RâòØ †Zô£_ÜxØX<;ß~÷®	0ø=n%ü–m.ý~zC.ŸÝ§Žœ}?nä}#ïTYfDti™tÚKä{²z?¾½ÖìjŽJ¬F©m*3(Ýßo‰bqD“”k	'Pe'Ò„÷©µô2y@=_â€3Š¤aaH-ß\³È‚Ð$ÂòÛk*6À¾>l”?xrJE2B¯ìðH¤†Fð5I€3gú¼r&ƒI÷Eˆ‰ÏÇo¬%úbº5zÀÑIßâU>käP]jxäÂŠŒÀŒª³Ë¶WÓKÅtRÊn:[xWYÞð2dWÙ®ÒYÙ¢ó"q%	ñ°«:Š/1ô$´_¡Š»¾_Ã*¬öCsæ–‹~Žõr¼éè¶iMâÀ Ä”Ïlf57Xô¬{Æ«Œ5Ô½ðÈHó@d¡'À£~Š(t.þÑOè-5Ä4†«HâBŠ©Y6|,8š0Ò &›]©R!PÝÉPHe€áê×ØÔõõØêë± {,ÂµÂ¬òÈ¹è³@m…›8<Ð"4 ÐŽ¿n˜Í"ÁL ïŸI¹àïƒÄZõOè1oô(êž®OÉwÏÐ¤˜yÆdrQr·IüÉ)ßxtâ1@ÎŸ{ìÀ#àS$ñ¨èdç5°HÔ6“X(jUyªZbNÕr¾¬Õ6Ç8Wäci™°á`R×Êå’­i
Ý‚ùSÈ7¾ƒHRÃêÒm‹f—Ní.ËužZ%nO¥Mh/Ó35|Ü¢ž#Ó™Í©A­¨’"$4á!
ý jÿC#wÔìR+fWŒÍÑàN÷á¦€oŒËÕ1Ô#)b6e†ì^àä5ñmU¸D"WR&¸µcÅÎ §u€Se96FÂªVg.ûªŽ¦•°›¼¶v}gôžÚ*çwB~(Ìßýû=®˜Y~´°õõÛ«è#Dü~kak÷øí7„>vÐ{œÃørZOÓ2QXÄü?¶ B
›dÓDÒÓpýÌM7M¬G¬6ÞL:Ðy~Íƒ2“TyQÐ0zübe2Eq"¼O—¦ÙÎçTR¹.©ñðM¶°Þ¤‚`˜Þ¨¬‘•]«ŸÝå¡ü¾$F³Ò62¡zV7SRp“K³HÎÂÂ<D¦ÞHáY:Ý,?ûù½¹^ÆÓŒ.‘‘÷Ï˜åR[A,aHÐæÝj·Æ-osá°†öÌ3M­pàú›wW–¦mš'ÕÔc¯"T•ÑÔR@¡ýn6ãÎóç‹¶ÂŠ¡ŒßF“ž‡q½¯ÖÛÀ¥¦»¼µ•ê´HŠG½Ùä'jäãœ˜é÷h7=à¢q¿æVÌ²àŒ­’çÐ*‹–IØóãpJN`†ÿò«bz<Y
W8²<AV›å]^9,–	¯n±AÚ­—ëøjg}×â€ØîÀ-Ï›`ñÀÉÝ ŒÎ'
|ßñZ4÷…»Z‹¦’¯P,3öiÜ/5´‰[VTÌªœO2“lmŠ”žëË‰4½adó`Ì³R§î6o=`—²àMU•¬¶*QDM3šµõ³M “xËû	BòH™­2V-!Ÿv™`*Æ³Þ:¶”¯Ó¼˜ˆÜ¸žG0Ž£õ-ÏAÌòm‘§-?¶sú²MynD«­ÕÖÈ-é¶:Ýõ…%xÓÀ''»ï —Gc×£ÕÙÌ@z˜˜JÆ [Ä°˜ù€›1DýµÃCÄ‰Õ®éCÇ<}ÈgŸ–ã Ï	PÒ`ÃOÁ8qÚ¨UÞ’2’ª3¼”_ˆE+î‚p`ùð²á¹ÕcÄväê
I¨-LŠÀW0¡vˆ7Ø>2“êK.Ê³pV/§ÏyÁüŸ” “|´w@†kåš­ÕÊ5{!Ë «LÓe‹ÉÐ*øA8ÕÊ“¸{¨ÑZ
ô4ºéÄ›Dù'ŒÇZËWÒ´mÛd”®`DÎ (S• d9DJöŠ[—l÷šlŸcUÕJ^{VÏñªé•i¢Ý;„Oœèõ
YúLu–{ŒÓÉ3¹n¢>IÎ@J¹þ‘Ÿ‰·5Œrû)•Â8áæ‚Óâ’4yëúd»7‘¯Q’YU	‚²“Ûæ*Ê·ÝDë¿Ø­_E™ªô×/3§°“rŽe/t`£)¤S„œr¸ÀÛÌàâ+9dEv`¾&ÊN`õ‡[ô}a”ÂçŽ5"‡–q¸°%~ª5Í©så„ŽÍþ¨uóÏû' þìŸÔº‰èÂý§Ö‡ŽrÌÂÿ£öÍ»ÕÒÝ¨.õ•"è1“s˜À¶Bv¼Iïów|ÒhŒ·ÍJÞÏ-çÓMàÛ€:ˆ•œè×L jPyeñBERîi|—ã»jË½ØˆàT 0&oY4o—v"pÂ0Õµ±™bª¨í ^ jûö’övf»ö
/¤"™å#_2Á³»]¼[~pÓXjÅÁMØ„?#Ø@§Ñ|±t©JpdKSýÊò™sûó@Ýýk,)§¥¹Í9Œ1»Ñíc°êW–L|´²­‘f0ëõ‘ç (Íóµ•yÂuŽ›½‡yÍL5ªùtjíªC;flÃ‚ L9=îý³ãäÄµÙ¥M*rè•Ced];g™öx°„ðn7äc«ÕÔËå‚U QIà]T¡[‰v*GŠ˜ÍT›1z} œ°²Éˆ4àJJG©a„U¹IŠÖ¾âf]$±ÃZ‘¼
ÅÒúïÝv©¬VBy•6×ÒBeŒî=k•z'/|3sY™÷h/¨£Æ¿¬«Æ§©™èí6?®µYaö¨òh¿z1[õ—/¡ñÏ¤î'p`†š³kú…w¾'Õ¥iÍpòFâ^”–-5r6£<Ò.Xs5±‡®í¡eO¤du¬*/a›_–òÆTJÊ¦M,¶Ž@wj|ÓË¨“ÂN/™k{&VÈ+4ŸA¡I´«Å±l›ñ*þŒ–tjé/‘ƒÃ+Gö†n™³®R°.j*Á`Ë9OSé€æ¦ÒÅÜÔB&¢’š¬U”AÈhMZJÓ}Õªj×	±ì2–ÙUÉ™Åæ•"ª’`¬öpIvrI—›¬ö®Èêü4±4W—°èøÎ…ÕQÈ\Ÿ7@x‡ð_®äTeÈ{ÂoÛì<šy.Ü^*ðXÀÆP·@³Ó)r[UAMÁ·óhKWÒÌD“CZUhNt&õÍâµaþŽ<‰³XÿèášI¼ÊÔ²ö)ÔÍªÅòÒ,Ã-ñðžµš¯-ª¤”d•r£Ùa[Âê‘m.ê_Xÿca=#šhÿ“†“¯·ó¢¨$šÐ”êò—5ˆ-pàÄ‹ ErFAXä
ö
‘Ã¢Uÿ€y ÃcÅZú˜˜òÌõAZ»q@óc2âj3›¢IëpvOx‡¢£9’“€!4µf²¬ô,;Ùœ[ô±eÑs«ZÏy ÜÀãÜ‘‹õòð‰‹X´Á‰ñK¬N˜=ËIx"úô‚1Py‹ŒÛò–Óea?/°èRm7„›¼)Òcx	 %0žg¤§QP•ëÛÇµÐ…Q_`y†ì]y +×¹WhÞƒ‡÷/¸Ñ?…+`ý	>}ñn o§ûvã’>€žOóYÆ9/z9^u¤¨vqiKL½¥°ª¯crã‘wÐÚs Ëž€ëÀÉHJm,òJ{0ñØ½u¼SÔ£6È*ºqÉ=(ÂCÇo`~VÑ3(:‘ì ‡’ƒ°‡LÍæÛØX´ª_Ð9Z)m’ËÝãÚ>zAUÿ‹g9º›~¤F§Ð¡Æ¾ÆÊÇÿa5Ûnþ÷vóÕEó×•lßÅâÒ}kì.0+|¶†7õ‘´TµºÃh†VQµá„¡ùî¢¹„šÔ‹ï,×Ã2¹A*ø
àg
Ã6:×L´<#€ž/{§Çï;—éº ¥r©8*‘Pv*åô‰¶ÓÊµ¡S÷´¤"3ñ§¢÷ÜnãòZâÅ4Ò»áœÔü°JbRsjuxŽÄÐ.Wƒ
vŒ‡Å]„Ì³Tt‘…*TQpwÙCjBÞÁôä´…q¥FŸ<n®çô'¡ê._\Ù«S¿c›Ì(£®0nL¨0ì ¨tz¡ŒÆt¢Êç`þIŽâ	>'´W¯R?NuQiU§EÅÂÑÃê_¹ƒI¢9Là³ÄJŸµÜÂyÃž€T(~ÂR/ÃØ jÁÈ&.ãðckª2ZhKY—¾ÖE¥¥¥ŠÛbýârmân[(e\Ê §ö‚F²æÓC²BÞºO@¤(wxÖ9Î)A™qm^*À}§E@-½1ðî[RpPre«Â¶Ó%ÑH0æ¬åM=/)‡‘—‰Ô`OÉ,¦M	{”Q¶cª·mÒ$ {}iÜÀå÷N,=jOJSsÚÝ0½8²bÄ”/7Shü?Ô'M1WµZ'cþj2êéø8÷Zs„T¦õitÑ¾X×ôv,ù¯Y—öÓlŽÆá^˜t™ðY7M¶>.º¹Qo+£jñšÅq’­œ0öš?€š›ARŒ=üsêë¤ª}­’=Ô?|)<YGDA›Ù¦ÐKŽ)ëíØ£ùã
›÷	[¾lADtyb,É%GØ¦‹Îcð>ñÂ|3CùK÷‰¿$—a€tƒÁð‰Ÿæ[A˜.å0Ý'“\r„mºè>‡á?!Ì7ƒ0”Ã¬>q˜äR 0‚ÕÇà0|â'„ùVf•r˜Õ'“\r„mºX}Ã'~B˜oa(ªç,Áû	eˆe€Ð=z¤I¦~B›/6&Á…ç»˜„wö–zÑHã~øépé	u–1vÆ›íV{½.zaTË³¼ùc˜8ûgA2ê°Òú»À3yU£
/Ò°Ñ5^Á»*È=¯ª"ÒåÏÕáÜm‘]2°‹!©“™b½ÂÓ¬Žw‘½†îUds±÷yUŽP¾HöÖH¹0Dâ,)“„fÀñ$Âª±’*:ÍòQ$GW¿7ýýq¥žýSÒØÇÈßb±Âzò-ß…J"Îo« åH	‚´xw‰”‹¢šŒóGVsv™‘tvIˆ6¥©nXUâj&’Íç~©f×¤"Œ´ñš/‘^w?µf—6®°*•¡âç/‹tG€tGOøö |óßü'|+^ß4¾¾!{wVÎl‰þ„sú±*œ‹ç¢'œ+^ß4ÎÎ‡˜øä<¡›~¬
ÝâGD·ø	ÝŠ×CÐ­:CÅÈ&5t©‘@x-›d.Ú1³‘í1K²É1Kð¤¯~ý
ñ¹Óú´„ì®ã9À•'ê¥½”ÔË~Dêe?Q¯ÂõMgøùÚ‚pJÞVh?áœöRá\?RT)Ì®Ù‘&ÂºÂõMc]bùÞ÷› p”OX§½TXºýÇÃºË#>a]îz’Ô3Iýg7Œ±#CV.öïERS’C+Š±
ôáÒ\*Â5€7ºÑ|<&<ä‰®oZ|È4åã1«õ„†ÚK©)'yð|DÍ¹ô¬'¤,\ß4R&â@Úáà	#5—
#¯Ù.^ðzÂÅÂõ¸’¾ñ*ÍàóÄß­¶È™X—çX¨ËsbM±’-ôh‹'•õUj‹60ïq‰ÙñµÆ.Hùï*)ÙTì3S°jêeJ¹$T+à;¥#3Q©dâ‡R¦o‰*i*ûÖ§(_â!–’Bñ’¡Ý§ù#ö	uÈCPGQPWayŽ%Ú%Ç¬•fÒÊXkëªÎ,éÀ¤,ÐÕCÓŠ(¶Áà¤Dgµzpš	ßya08Éî¼ªœf@v»ƒ³Ì¯îËvåð|K§Õ®¸%ccÝª‘g+†¥qÙ°Ù#1¢´Sµi\§êuÒž*ÐI½å]£eR_×èéÔ/Ñ1z~Îh¶_23…Ùþ•4ªÊÍ´+kâÅV¿Œ°L8ÊÒ¶[®€°°0Ëí#k]`µåª	ô‰sÅ±jhDë¾†='=â|ÁÀWU×å6ëùç>¯l<¦$0,eábv?ïÏ£X¨Zp8¥{µË÷BÉžtˆç¥.b-ß3‡êjdm#Yhoä”júÒ	k$“ÉtÎU!]k¥kÏjúö ÕÑçù—Q*¤†]ÁG´LðÂúÐIà /v<Z®ö}`CƒC@6r3}f‹œÝˆX 0»€0Ø#€6©ËüóÄ‰¨îœÃØe2ñ='Š(«Yé~ÖkÇÓBýØØûÊõy—JEÛ8¯/™ë©y€Üe”°JƒÀÉ­Ð±”ˆ(‘»µ¤—6ñXœs
l±Ï‹çZÁ¼Ü±óG
—ïC„L\Zßñ¼ \&§A0"kín¾uúŸ€z"duºñ÷cÒ%'‡-µH=»øßeÅã¹¿žŒ<Æýÿ:lvÛóJ­U§†Êkz'whTÃGö3Dæ 6¾Ò¦®é;Ë.¦©NB¯¦šZ!jT!Ì\QFpj Mm†q<Ž6VVp²PìÖ Zo– ÛšjÄ³#Å|_ƒtbu—Àl‚/èmbï$®],¿ÞØÔ(Û£
Cê¸qF®¿¹ $OìÒ •&.lXùÅ8yì•†`s `“7Äô¾
ü{ JYÂ>\úâ"¬ùˆn]Éà´!¼X•3©Ìâºúmþ
Së`úº}¹LZ8žÄ´ñ/Y¦óD.\ÇÑ¦K„£¹@ ®æ?sÿÜ3krLwÖ©Öè  ¶ôwàî ­Óa˜Ç"£ê1ñ)Ä[=ÄŒçä<˜„Ø8¾ÝŽ"wàÓ?ŸZßî—w´ýªºß`/õˆ$ÍiÁœzÞ0Ø Ü(§ë1í?Õüã¡ÅÛþ5 ì/F;AœB×|úÛÈŽ‘7.ÆNÔb»¤eØÄ†ÃÒuhœŒž³rJaèòˆœø8ìÙ.Hø±…n¿]ä•DvÇwV÷lâœ&O†@FêûÅOA±µá¼JŒÆïºheí›­â­å2ÞÌ	žÑøœ]¦±xÜóÓ4'·±x~j²ÝA0Š,ÇpôŽ˜°ÑâyJ)Ò \ºï¨îQ£3¤º»T”%­òF¶Æ®üL…ß2$ ¡z‘·¨b4zeþ<Ab†ñô»EùK^ÊÞRN	9eKrr)•*µûNþB…uÂ\º6]•;^Ü¤ŠwÙÅ—˜Jùºï—B‹*„À´ \Œ¡fûI¯	“;^$1ÐWš}sMÒ;]e—t|Ò	>…t6È™c…ý!šÔÙùïÝº‘¸;²•”×†§6qg@H«°%'ÏzVÛ*ÐÆõÂ¿ò>î*ë]GeÇ–¸’(	‚J-BC»¨{JzÐ¹@w92í¸ýôÁÌ@Å
¥ù_W³FxÍk¾¨œ$—vÜ$ù@›Uf#©€©lÍ©¥©Vs:_+ß5Ò›ÜGl´|tº¿£±äqå0œ8›H¥½•GÆXÄ[‹¶ÕT*%=h=Ô„,¦æ"Ê|•9¹d®ÌI“(<ø«•ïÐì’‘uÛ½ K]Wh>Ó¦5Ar‚ÌÊÄ¯»†^‚d–ÿyâ„ÓÏ&²I
'ÜŠƒƒàÆ	w åK­8tGêfÄlº+×~í`Ÿå;[ì»†¥àa÷#DÒ¶ã›Äjá‘ãžâú}ob;Q#[¼ÆeÎ'n”MŒŸ¤íYsçÅ¥ê'jo×,'tb `Â‹þíoÙâT·aìâ'lžìzËsüA<¤nÛºá|ò4G™î&8ö·Ö¶Ž NX2ò¹”_!ô¶*(ßEõ&|QéËŒ¬qÐð[ä¢»è;jMEŸœéæƒ‰{ýÈZ6…q>h"3s z)Õ&“H¡/	A*æDLgbªHÌPˆ¨ëŽ\¿yÓ¤r…Î‘!ŸHÙåºr&‰+‹vŒÃ‰ßÉtaë.£÷&É(ÒG0H‰€¢q'á+/u4¹€BP,,éÓÞXmZÃuUµå;­LE–AW\§Ù>m%È`º»0>ÊtFÔUò_POU$ÕzŒdŠó’ö¦‡˜œS&§ê›KÞä*ª‰pîU*szèâ·­r2ø0b„ª]C@¦Ü¦•›°"h7¹ªm]âU°{i{7qq2±ÀXÇP¥SˆÊ¿¤{5Åû\àÚºÅP© j©*FÂ¥T»êÕ«·€ªQ•ð¢‹ËFU9Ëô”²*@ò~©!=°bò˜ÊÝÝYZj+Ù?dJ¶‘þ\Éò5ñauôð9iâÊT˜˜ÞK¾«¸›äŽã¦âûK´žI6]éDT+ü5Tþº¯ ê7dñÌñœ~L¬Ôó`¥5óÐX Û2Og[‹º	7„	•ú*F4 Òs#õk±³rÎŽ–fÓ¤Ö
-JÖ5VÓo3º]#5c6_Ev§¿"?¸Âg‘\é·È®ò]äú/r÷˜ø0r7˜ø1J7ø2r÷Ôðgäî3òiäî0òkäî0ñmän0öoàep_¢a T.?  RyB%,Ô•ß¡1«J*¢t¬ØÜñFåŽ@hÃÙ¤7rãÍ»TŒ;³®¼w¯5ÄÓDçÔjgn2SiÏ-4µftPWV¢A¯:85¢ìEÑ™]6ÕµK¥hQÕ±ÐÄ>[î£$„Y8Bî©ÊÙÉIÎLk†=zÉúu0¦&¶‡HÐ¦³7Šg–^¯°Á5æ;ß•¨%óÝYfÛ9{+)½Iðý,ÓîïHj
’|?Ëtï·÷.·ÏÎ÷Nsµ¾Hãýái’Rá³YösoçÇ£ýíƒ‹ã“½ÓíóãSYY#Øßãy=ñçýÓóð¼Ó½w{§{{¥‚-¤ñóéŒÏz½ÂP»"ÜKCÇDtÇúÀãJmÉ{¥Øµƒ¹)ú¦Š25Ì¼jgþä²êÂQ[Àx¥Û6Ìþ@ãsZŠæ$ô³6ðYÔ‡º‚;Ê4Jür=¹j™ÙÜ;4Kd-á…]•™´­hèä(«˜œWC5f‚áÓ±ÝÉˆú§nš»md(¤ºY –Œ–šµ€¹5–Ïu$\*G,Ð›ŠÎÜœú47å©f°ä«Üw4ú ¶bP ƒ›’5BåŽóh~hŒ—;Qvh@…à?cN¢ˆšÞ—¶yÛñ;Ûê±¢¿£^ø˜9ò‚pÏê¡\ácŽ6+í:·I@‚Hd¾äÛF¸,éK$oéK}¿™MÜ¢#N¬iù^t†…­\þu†-þÅ‰å1Å¾|ÿ}yö"¸”^¥S¸§ê¥®jÒçMkhºšÕ¦²è×0jeV¡s<1`Ã7b¾æs*Ú…bÜíLA·z> ‰»Å­
ÀÆbm•…­»2ºß×Œ®•eàÆhPüˆ"î•›$Åe
ÓJM\¦Á´O'B|O)ÜÛ‰$®ìÎ@Bu¾(Ø1{ðé!¹“ÑV §ïÜ[Çnt—æ†g W„æØ“Ó»¿á.Š¼ßu£‡[Œéû´æü	Ó„Vô“Õ0™cY9rx
Pü1}YH	`™çÎüÚ*ÖÂå»¿¤I€«…0‡t‚‚ À<^%áðÐr}BcS˜#OˆICÄ†´(BeZ¢4ñ%{x³‹E^M‰Fôor‹1/)¢Ø
cWò2×küà„UL„2š³Lª× AÖ$abÉÇç«8p€U„R0“Ã¼‰&–dÔìX^‚6pâú°›®	{@­i0‰£å|	*K³"ø“o¥öqáþ«@Š
l¨”lUÑÜ‚ @rCkgÒÈãÆŽœ ú¶móS‘ûŸIárµrR‚L$ýÒWÛù ûµ|±œDëF
¯ØuÒCäxW€K Dô‡¸Qô3þÌdf€—ÓÎ(|+¡¶0l)èª­'5ŽNå:¤Ê\^	®Šl«0¥eðoÎŒX×–ëY=šœÛqÆXqÉ	Ã Tû€˜§m~»²Bönû@åŽï°ì92‰½n½èV‰Tw:–:Ê&ù¨XÌžÛÂ2ü‹F\ø—º/ñôLâ¿±ñïÔ™øÓá|VÍÉ½tt:æ~Ã?E~Îñkü‰$YýÀ=;šGíX!¡Þ:º<ká¿üù$ùÌ‘~¦Ýì÷nÇžåºO8±¦Sú~ç¡ue²oÒÂ´âw¬Ö¦x•ï3Å©*»øW9°Ó†‰vŒ_U˜JÄÛl0a—z•ðÒhJuñ³Æê~#êô<«fþòŠuÃmÝº1¹°Lí0˜«(6b=u ënÈ¯ÒìqO>›ve[;k/óâïs/¹ÁàÌÐ†,LÆñ]Þ5Î÷Útx4öÜX@“{PóDê Hn2<¦„ÃppDBcºnÔTUPUÌ†LQ"õçƒ³?·@1÷¢–Xqp'n|ä,h™–v ‚ö«â|®^~®^|ºðUšHq¨"¼oógßô–aq@ŽYšÉÌº¹nB©Þ¹žCï¾äÎº‹íƒƒã_¶vö.övßï^<»³ú˜ÇµŒÆ-4|IÓ7.š,ãbqé¾…¼ú²ÎöŠÂG&ø{ô%¸¸Aä¢I¿ïDRßéwºÊÒ”¼è*xá‚±ÕwãiSôÂ}…"ªTfÜn|/°lsun+‡”to%Ú‹JR­“]*F¥¡0eU»ÓÍåÐÈõ9}}5™z
ÓÓ¹dtËT*E¢ZN±TT½¡ù=©%³µ«l%¹9™Spd§Ù:ª;ÐÂz›4™:q‹ìùÀÞB4f¶lÌ|ÃˆÊÉîi¼eB1,os-ëF8è¢ôAö¦\Çá-c,O•[y¤ŽÝâY§f˜[bS5¤ìQ§€Ù¢‰–Ù<ÏGNšû£Ðìb$ÜJÃ_ÊK€ÜRÐC¢žt±q.UèÐ*¥HY4Ê
A=æõJ<œeTŠ`ŠøÿA™t¶©ò¾r&’ÆO8éÒ<f,Ô^}B`9C@ÖDÑ#÷ÁÊ©Ïe‘¢)eµYO…ª†ÏIªúÍá}O¨Y‹P½m>çÁÛ²¨§‚ßB•m\ƒ|¯ã^`OÅ%PPyÂÿÐ•’ÁëÎ\¡œ³J™LwGDqšdÂ2a¢0É]’ˆ±ËÄ¶\oz
ç‚¤OÜè%ùeRè‰¨@Q= C8p'äxO„0 õªÕjAº(Jš¶\;¢Z6æ³3‘T¡Š@°x¢¿ÏÄ´šž2Ê»,MxÓ|‰ÒD;ÍnÂ—EŒm¾ZoÝi±³$q\ç˜ÑëŽÚ€å«¢ËoäŽ$
û›É­÷ /1~JSF%LwÈþ	zuú@ðE•ÑÂ¥Žõ*¯ã”Î“jÅg$#¥˜’ªàèÂÀª\Ý‡$ÓK</ã;
)¨áSPÙÛýµ¥‚9B:.æ bÍ‰i®tØHL,8ªRÊtcè«–sTÃÚ9ªìíUée6­)¼©òše>]8ŠÛO]w™1ñÞ¼Æ™Œf¯³“!

/ôóQZ0J¼Ç-à	Ú3$³}ÜZB’ôÉ/”êÂàô˜$ÆÂ‡?‰{þ¹¥Ød¾êVn´I¤k:IÅ]Ÿf°ôU²y·€æ"¨“tþÓÆ]ÁH}OþFNðÛœEº:UÜ +çgÚPó ç:5"ª’a’+©„[ˆe¦úŠš·ìÊRd¬hê÷	O”Ñ·“J.^mÆ¹¤Õr"E%l5ºtµâ”¬ü.z´7RsÇ&a%xîýäù÷f°n,7&Q–¡u¼sC'ŠƒÐidÏÕf×eWwêc!}Ü§°nIž:[çðzlìHÂ\–'òmVg¦v] jä/a¸"tjëÑéÉ_¥CJr8M' *Â£õÍ’r–—áÝú®IÂ8£Q‚‰ý’åy¤Q\Øa	uD4'>Ë	ü @<»K02	Ç„ðƒãÝ÷ûGïÉéÞŸ>ìŸîíÒ‘Gí‘ã,Þ_Vvc–o²~±0f©”m¬$5»q=Jm…—T2SÌÌ_ÊXy3,&¼Ðfh[s½ÝNÙ$ýb­&£¤VÛYˆMúe·mü¼ú¼TYJž—ÊŠb.Ìºð¬ôŽnÛ¬ìgþ’Í_&Ro!ÇvzAõ—ßFA¤ø¯ÿø×ÿ$äš¤¶)hŸžOøIŸþ¿I‚"æ®ÊxË®Ê%ÎžÁ¬iq¡zJ*ÂJŠ.™––ÄG›Ö‰¼w(35½Xª£ÐÊôÙB¤ÕàEU¶›/v“õ#e)`5TW
ºw²­xcÜ¹ãMÑh‰õp2}íŠ®¡úœéor°Ëƒ+[0<ìØŠð˜ä]Îz.ÿþoäxo¤‡3ãK™Zæ~†v€bP¶ìºk3Èv³.gÆ-Ñ–˜	J™‰ö°:h2+‰$+³Óeãxé<BUÚ»±WÖfyË{³#ü¯ÿøŸÿR¢Û3=ÏæT}Í„•`{ð_5‚Í\,39jK+ÀŒK¯(™™\LÞ\¸èy–@h&ž:Þæ‚cŒ£%~@—¢uÞLûÓÌr}©Ýù.J¢º–™0ç{~âúy§@—–FŽ¡€üì:7ØõÎ;¬Ïƒ¦Eë–	¬Ux*»"'æUl@L²BCÝ”ßw2c\)ÅKQëÎÇ‰ †ãT5’Mš ²Ž6Í0í‰Ôf Ì¾!g ªûÙPê2›µ¿[2­ÙíK´Ï›®³üUEñçr^Í®iCÐÑ4úyŠ]Moòú£,‡¥++<Œ5Š¹í{½Pß£Ó–»ºt
¹G°Ý´ZZUâA4”Õ½Mûç6*·i$œ>Ô4OÃbŠþ%ær©XÜÃÈbAÄiã¾MÅ‚0ò¾›èÔŽo³c7î2Rù™7!C€ç*Aø²Ë¼ßeva à;´ÒŽçNŒÂÙüŒßšêX²B_{’ùL{1”çÿÉ™bÀîLn¼¨)¼õÉ™2IwQQ¤Cu1ûþØ
#Úr€þñÎ¬¸!Û:C>­ÎX;j°é—’ó'½ÖW×—]bpø‰ç`Ø$ƒZ°,Éf1ÈH“_º<5ùe(@*|D‰*y‡d£L­ÿì*ChJªK…/qÃÓðHîÌÊÅÞëBïå×=q<8¿"üF}kìÔà9¾²éi‰xåÍ_Ñ`í¶Èv$q^b|C"äe!ZÈ¤Çy&Àdåì^ÃP…27´,lýthn¿2Ž‡‘²·ª¦Ò¹	Œ.¼ê*]x¯JÐÎdQš‚ª¦åâÄËÔ,ª-±š¿LA>úógÌ5ùò£1Õ¹²ÔÇf¨uÙ©93}|V:G®òhlt6¤&R{Þc’¬g<wâ`È-Œ†™E&—Ñ“1©èz§ŸBž*€¦,MÙˆF&(rOêpä/À)ÍÉšqQ`ê^¶ooZqÀíi”/¶?ö¦þªbÿ•$oµM(6óÙ¬jÄ¢‚¢ð|Á¿æ}›æ§D-§p˜ž(ó™±ú¥É~Î— H¬X«ØFÒØð„¦N”6ÅMCÓ=Cô¦é’\"±
™^ê.;
jø9Ö™ß´àÚjìb~á%Gð]D‹ð§ÑEûb½}¿ô¥\Ýf<BÿÀÏ0|ÇÃf24
}0S·÷Ú:žO>ÖöÀêf¹ö¦I*µKrË§€?b‚åŒm®›²PòZüÐÌ²Z3y‹¤ŒÖ4¶o6^û`u'Qx>¡“
ô!±Ž¾À&¹æ“„­kVž~æZ*²¬»Œ4aäÐŠ‡-€ÿF{™¿H“t––“Ìy*h’ïÅ¬KøÄÞ£ŽÎa,K,NÝ,"3åÚ±eAiUiˆMwSà2¡jšâD-[NÜ=´ûa¶Q9"s'ÀÉ}EÐÒÃŸøs!ð'Žx	Î¦¿=¡©ü2GÓïMÍÅiÓß°Â«÷=‰ 3829ñü«¦`Â:ó’ÅX'‚tH˜ü¶'Ú–\¿D€“ß·òM#ðX'‚äpv,$OhJ¯oMù†ÞqíIÀ¨OŸ>#i—®Íeƒ¼²#Ÿä‰ôü$„2@þ¾…/…ˆ×æ<^bh@Žÿ„nß§7²%Ôp‰×Ç›áLŒCãá9ã\»Æ9‘ºÎ9<m›WçP›ø;ËZœn”‰ÏÒ’ézëz˜‘ E%\±Z²à••ŽY}0ƒÇ™áÙ¡ƒM‘“fÐFøfŠÆÀ“úCçìÆÌIÉÜÑúª-øYë…©š‚ÙÄ(EÌ"#¯7Q¼¬hÄ“K8ksq¶{-Ž›5|û|¬õ6šo˜Œ™[“£Š¯Ý¢øŠå¸ïðèîgˆ?ûŠQà0\ODüû„a3¹ðQâ¹~Ï²`=Qp6IPß§xåeÁ/.Y™AÈ™ÞXè[J5o‹…}áö|ñªjû*~®_æ’öA5©uéY=Ç3Ëu-÷cÁÖ˜De&ÿÑÄWÃ
×ir{/¸5Ãv:Ú±7ï¾û.l¹~ß›ØNÒ’Í|TŒÓ“¶‘UíäëDœ´úx¢sµd‘·N7‰6x†yÖ»aÒ[²9æÉñŠŸ ¶Føú`.ë	ÒeN·fÎpþ¨5 ª#¬…æ‚³Yç#ý…ä^3´3ôîQ7@²ÎD£ÚHÏËÝVƒÝ<+R°¡Ö'^”>çÅ8
heb×©#R)‡T¦`¤yÕu¡· íºC7²Ôòsb/'‘¥îÑ¿¢ê¢…4g„·˜©‘2"ßÃr=O1‹…xŽec¯Ì†»Mˆo@T	:µ’d…9©àÍÖùR±ÎÈòÑ Ql§clŒ0m^ÂªãàÖ§=}îÉ	³|»é²[´» 9­¤%„Á;|¯N7â4EoÈen&MñaŽ–.i­)òd¶]w%›áDZôûR–Rˆâäøœ¯«úî
²Í#,‹ÉL$Ç‰«; |-%îúå†£]Oã¹Tª´ÌÝŸ©¶R“Ï8¶¸1ïÂ`”‰©µ’\#'Þ‘nu½$w1Å=é¬ÀúSòÞíl½v½÷úrYÝ|Ñê–ã?$åVn†  ¤T9^Q6¾~ö»™Ñæ/Î|­53‚_Z„D³œAR]kXÖÂcmýQðÕº!Ðø ))˜¥$¢àÐ&œ8F(|8`_¼¢•»¬JQGV×p>¨frÚ§Î(0(1azÚLõUw¿¤“«Hâ½â±0¶Å”Í?aoÜòOò–¼ùùKc
_ä€k~¼[ù#áÍÄÉîöÙo·OwÉW²ÇÝEýc^©È¥—]+ö+´i:ë8žp”BVz©Wu©¯Ýz©±=ñä¿¨`é¸Ôi×öÜúdÉÛ¨£Ñý;nJ‘¼LÒˆb+Œq\NðhäV—äOwaíÒ––Ü€nG%”²­BÞyPÕx¯Üˆ«€¬ê6*µúóÞ·^ÚjéÜ	G®oÉZ‹Ëåù×Ãn‰2ÁU¯Gà2 ß H§èËnÜ$œùKÓmST”øÅñ@ùq–ñ•[ä.½švŒ¯W†]ÉÛK/ˆÄð3ÈL Ê²‡î£ñ›¶§vŠó¬/ø“š,J»å]Üë”TS30£b.QÚe÷ß©†|µõ€³YŽB·_˜{SÞ}Âû÷fÈµõ3˜;õ§Àïïßá]S$Íg9u"À
?d,Lf¿ý¬wõœI—Â„ÊÂ8Õ3¾åfËÂŒ©ÕÕ|–¤­Wy"þ‹á\¹ã…ÙòfŽBSº¤U^å~ÛžkiˆO°ü)CæSÀ;Pü­îÄ;ÜüY„HÑ*Z=‹Øy5?‘ØqVXí;«žölÜð°ÐI\¹0u*ŠëI5K¹S.xT©Ö¬!;íŠUQxŒXƒSÎÔÀË"±”w):$+-˜ÄwKÂ–Tr±¥÷‚A0‘ºòÛüc¦i$e©^uõ/¹ŸÁàx›ïè}o¬#ßT	û•¥™¡¤*0ó3ê¾Bòùz¥ðš;×ÍÅÎDŽ–‹žóñèVe†BÙ~=\UÊJ¦‚b	ž¸""F5+»‘kÄDBòò˜T…®Jß´,ÈMú8ˆEâìi ]c«“)|E@ûâÌ?Z& DÌà* ²‘7Âýìˆ³É?±û-ÎMÇŒ€$N»ï$Ò¥J¾”}YbƒÐµ	þA,ÂPj{#ûØUÏ0ì±SZ€-K=8ãFåÑ~Ë¶Ùkc³Œ+Øg©5²ÆÞ£”YY’ýS@[k¤}Q£VZ@#Äûjwe¥Úð¨ø›:7ÑÞG¸Xn$Ç?UvàdÙ>èÂùðôÖ}[v£ä+Ú­°nÑ“S˜5>9ÓÍ;þXeÿ£\·ÏæªÐ>£XBCËóËiGkM_OaO4†Ö°“÷õ+l§SÛ‹“õßÄzjëí½ÍuI°ye­­ê®©ê¨©22•ì%®ß¼i¶}µ1u¯‡k2šSpA³ˆî¤Mšà9g‡ì³x„ášæ9FùÅ]ªÑk]2EÃÇÝ¥àý”·]‘qŠŠþ¯)ÚWX´8#'´<;×á5ù.kòš€ƒ8Ú ³+ƒ(»iäÀ¾)OŸì*/ 0½Mô.ÝxKöm ¼}| MZgnµ·Fï¾ô à®0ö€6:ÅP0JÃ[Xmy™Ñ9àÛøã¶‰gÐyíø§Òç¯µõk4DÈ$sžU®7_ç]0Ä«
/§™w¢vÕ^Æ‹à¸úÃ<¥-Å¿Vš¿0Û‰¿Yýuê°Á5ÌBïÚUåô™&7‹]¿Ï@¬£ÛM»zgäY”ÍwW¹—*¸…–Þ«Ô-°úÌÝÑ¹ŒDMÏ u·«O®Œå§ñ–Fý¶e6r‡–íU]µ«:j›Mö ^0ù›Rpö¡"ÇÌqV“rÔ‹‰ø»¤q85©áÏ5		ëïáÁÆçb=€ÿæèŠ9-Á‹u¸H€Ñ¼¡EFTkD®˜øÆ.â&‘††¦ËA°<§E›fÐkïîâ;¡‘îÓ}ÎmrÍŽÕï9G2¾Fv<ŒŠg‘Â)³ÐÒ „N»*x€¢gÐKP†ÒßQEGÚÜ˜PÊŠP’ª 2[S<cÄ5±ò¤Ä•;Q8µp&ë³ÐØJPGÚñ_¯	ª
è¶°L ý &øZÌÀÅ_¸hèj-,“Š}Øg–ý^…^@ÞR]€TŽÙ¥ªæÌî¼uôMêûéd³ýclêr__µ',»òõ‡“¹ÄÚ&•}ò%“YÄšæ³\f©[eˆÍB#í±¢r¡îßµIaÃl«Ê6¢Á¦Ü"mÚè´â‚ìÖ©s†'ÙÞä&K&6hn’Müs¶]¹‰¯g™¸‚û”ƒ\.%Ì“š“Ž1C?Þ
9]w'Þ$*t0¡}xWúðâÆkùKR¸iX“ò'É‰ÊBÙêZå=ÇÄCÊ>Úª6%&N’~à5ÑÜ“T¤àg8¦N®£ qƒd®“a!„?¼)±ûVKêê(½¦©s/ï
wíuE¿¸ñ°±x¾wxr±¸$±öhÝ|/ÍÝ|âF°`:I,ÝšAx¼,‚ªÓ0îtÅ%>s2_ÖÙw¤`.sðõÐH[ÇÅ·°%¸ÝŽ³Òd'³{Èýn& UHu’šÓ„à,¥ÑîõÖ_‚	±B‡x'6Ê0q$	¤ãØ2„Æ_èh”\˜† c¨ÚTq¨FöTÅ ±Ä*Ï!S'n*!’žã78I2%,%„~Áˆ™²¶h7JD¤ï^K‰•Zˆ5í‘96¯@­%ñ´IX½€â®Ü×	 g‹¥W¿eK±fYÀžÌÁYÀÂ±ªTÊFKzq¾¦µääÍEøGÞ«ÄvµDÂvÛw0"i#…ÞMíË´Z-¾N]i×Þ —ÏDvíûü‚aFåÙÝ_ê¦gÖ«’›_{Cè`Ëíx_— W¥G½vœˆwêýSo­6Ÿí«æèJvòÊ;rÆq¡§HO™Q«H;¿»`
>©!I)¸ÖY©Ë²›÷€—]±œ—’ÉØgQlu}Ú#Ú´@„\œU:Áä"¬.^
/\IioÉQp£9Õ‚¬”X›ž oúNË ¿M9Û¶%Q¶J™r&d=®0Å;G$˜0}UÁMš–"‹RZù#9²®Ý3ŸœMzÍs«•BûdóÖ¾&×ÊÃïˆÞq52àSè–§TÆv ÑºÉ³™ C?<¯g…º
5†¢Rš,—0«×XÄxþE¥Þ[pMšÄ¡ªQ¥ÊtÐ-4^Ì0}–<E_CÃ¨%þK~bº»rÞK±tc±ûl¹PàÜb–êÅ3Ó[hÇá”`
yN¶= (´uêâ;2ž2wÑ,ŒO”#~&¾Íïà¬iP'à›ÞDk·&•÷Ñäº 7púÈ¢‚Ù‡îðv¹Ÿ2³bdi ZÇ?øýÆ±+º÷ÊÒñt
…dÒh¹n!VŽ•–jåxÍN*ªŒ'^¤/$¦YµR¥ßBeŽ¬ZRT7qÑ!{ÕÏhkÍáèA›ª°]ž’™B3ý¢+æhæÙo"Ó•)‚œpè¨¢ F±H\–ôv‘¼˜‚°îM:ÈÄPéxBÊ`ù^’·˜¬M®Šâœï¤<Ta–¡ìÐ%å=ÆžÿqÅ@ÂÑG©¯Ò­.Ë…(Š†JÊÑvo2ò%¡JÌ”7“	ý&Ü%Š‹µÞþ‚uq‘rÉ_*ì¦iÂ;pÀ„S_¥´+Ùy×žÉ³‰‡Ø|V2¤Ë¹@CÐ9°¼^4{!Õ!€0Úî h¾Zoƒö`5#LqÍ/HKÃkÓÌ°\>*c¶Ç¢ÄÕ”ÔIÎÉìE9}Øü¸ÆZq£&Ä3yèÚ Ä˜¥1áFƒ*Ó$~²©@sbžÙv—á	Ô ½u©q³Mh/ø÷¦¹Š*'ü/‹ŠÏñŠž7	q¶”Î"å£ ­GM MÏ¹ŠñÜar‡†2Ëª}¦b›(*Šd‹U/™š£I|RrÊ×ça0Nó„ó¼ôƒä"eÜô«¼oS¬ì‘±9³‘j¡ lW:u"ºzßË&…]$žbZ@OVëO#Fódúî£“Š$Î‰'@'\Ðª\D<	Bx&f`PvÍ°0S‰‰z³Uêqa‚›&miviùwNÑ€¾•3k
 P)=¤áë•P>×÷0%dJ ¹+¥ËÃÞèBÜ_»£.7
û›²I•iGxY^\¼)-à »¯Ü…eÈþ	zÅJ»}ÜœÝ”•…Nx€¤9Ý\ðƒfò•:¸@I
ôacÒ¢Ž‰+¼"'@¢š¿„—})Ð•*Ó£0™œbeuïØ| ¹jÁƒXµuêÁ§Hõ œ¥V¡âbFX¿ï_™âº¯«í¶…W’9:ÚæRvŽæ¥ä®„ L¼“®
ßô (	.ðò?¤gÙGñÒ’×Ž¥	œ|°RÒl_Ïê‹º¬ `)Û‹Rõî$á“ýúØnuÑ¯br›®ø›Ï“Íé¡ëO§d…¼‚X+¶
'ŽŸ(Í8ùƒ! ìã8¦1I°³Tµ[cÈ{èÁ —ô?ú¡ýßÔå%g‹4aM¤	ìe’R^˜ÀËYv˜ðEš#¦Oú’-°œYÆÀ4WMxd’„V?ÔJê™âÕò€]Ù›õõŸNwÛ9ûù=¹¶@´ÕŠƒòÆ†T­"‘ûŒZ[»YëÚñ6Õº}h+¾.ÿ°BCÌ?ï`T¦ô'¨µN¼Ç´¡·Ó}»Q­O*<¾¾àxêÀ1Àÿ½òÓ™S‰ü“£÷­V«ªTæ0yçÁþÈ8­88ñðÜerGÆî­ã¢÷hƒ¬’û¥V<tü ¸õ!ôLÂD<´
[Ãœü|w‹–.Vïm¬ç{…é8	ð\œlŸ]÷1á'Ò…‹&Z¸X\ºoýÁeÅS‡pd¸lö¢ƒi)ƒ†¦æ^‹æ|`æFõ–e‰BÎÆ€.` ©‹Ç'ªÏ‘g8·cÐØ-ƒ¼UûO¨ªƒÃEØ”Ã¬“h˜¤&J™[ÃÄ4ùðj.»	hÎPµ#½÷$=Q	ÅÒVw‘˜÷’*LÀqSGÙe>hßÈÞ"YuŽe©ñíTØÌœowOÕRª&B
#˜¶¦}Êì“uKº(\q÷NY–ÛA8\)§Rx™Å´JPÖ²îzJ¡ž„ºáx?«/2#‘[!X©Žàp½ÆeÚÈ"ëfPtñÒwÚlý
Ii./~tº¿CŽ&XJá‘_£ú¾øëîÀ¢aY„V4|ä¦¿øUIRñ‘_\RŽñ‹oÃû€<¢FËü$id¼IrÚ=ùéð¯Ÿó…D>YÔm‘U¡m	U[}}ó«bPUQÓ®*º¡;Àš‡˜ñ‚\Æ9WÃ´éÖhAS8mIÃZJóYÜCÔÔmÒ›’ãp`ù k†I}‚+’üü *3i·†‹Õ†\Èƒ.RÏUR®‡~Q®Ö“ŽëŠ¥ÕKRÒêÁþeÅ÷è'ƒÔÇ»ï÷Þ“Ó½?}Ø?ÝÛ}À¶Ï’k¦,¤3C’ÈµX£kµx”Väý%¬4¶¦„¹VmÁ¤+áû'gJ~bÇ£óª¶;	“°ÏÑÈRe1•/ÙD0ì2Ó]ª½­¼¾ ZFsáæÞ ª@Ð\Ê©èZš[ÿë?þõ?ÍšÿTQOÝ³x})©Q±Ps*‡SÜõé4ÂÊª×ð“q'5M—ôS®žÀ¬P]wˆkÃ¥%+£ÁcxÂW¼’TÕø$"¶‚û¬‰_ÐqØÌêbÌG.å§6X,F^mDå¼ycº„{<…F´êÉúáÏK£ul¨XÁÝój_eÔŒ©zÈgÁÊÿ·¯+w°9gKùî2…@ãahYˆ#¨…–§&Ô?õÔ0Þç#/ì´a lg_¹Ò¡Ïj§UrITŽy'†0Å~äÆ^ðÌ¥Ÿÿÿ   ÿÿì}[s9–æûþ
Xã-QÝ"%Q¶»J#Ë¡›muéÖ]5G)E¦%N‘Lv&eYÃQD¿ì¾îÃî¾mÄFÌOë_°?aqH ‰[’”\v+£»,’™ 8À¹Ç4ª :¼*qœªÛ<P—j•ÝK4¸U)viˆu)+'¬ªzùEô	1e”Æõ›4•”¯™çß#½‚jœ•v¦¥¥£h”‚o#èeôî_ÁW0/rŠüxqàÂÐƒNæñ
Î€v±Æ/~½èGÃßœñ)ìJÁÕ7L’ø9È0!*þG%òõf#ª¹‘ôÓmVrT“DbmÅö€$³Â}À3#µHgÔý=/À/è:ö†ª-9Ç›À£€'‚Å|JÞ$	 p3®ýÏô­†Q‰F‡öes%º¿Í<×è›9Ú¼ ˆˆl¿¿g{—RâK
“º.#èÕKxåá/lŽRÂÊ~¬Ó(~GÎFÉx¾ó¥ I;ÊŽL?%ãÏÙ~6ÆÜÙ·“ÆÑoàÿó Ò‘§q¡&r6Ú¤æ‰D§/ÉeQ(ÿV•,–eökñ·³f'”$p©žF·ËDTO^&É˜ÿzÙ¼*÷2E¢áÏÛl™ðRØËD¯T½L$Œ´e"A-	±LÜ†Íó»ðo~þ}Eµä8å.é;À>Ë_ßüŠÆ/%ìY*.{Y…Ð5N¦9¹.
sÿ…báza‚Ê»ô0¾Àclaë-Lk†©ä/t®©šâNâÝbÛ è["nCçJ)À<ço¥•ºP>)Þ¯ù9=%Eœ!CM«8ÕUJŠr™Àïª¯…6ar­ªR–¦üãV}{®·Uð@JÙ•ìÿVŠíŠ»”N˜ T´Ë[n6džx(Ïósð“ŸKÍ ËÎ„ÐÞÂä7øv¨LnMÂÀ#ëÙªàùk¹WOHfT&s»°wã™e2_²ƒ½î^/ëôF(¨ ›ÙÓL&2®ç–ÈÏ=u&.V«ÇÈÏKEò¨É#»SÇ	~¤5ðJÒOèƒ„o©¨eîw)T[óÛÿsæ²°Õ:ƒ£œ»1N^÷>ÇÝZsÉ[ÅBôT¹Ú·›'2¶ê—ZIÎÐ´•”Fv§Ž3|%U–xo+YÈc_p%e|Û/µ’4V[Iidwê8]+äé±ólt¿Ù>Úÿõhû¬½ßÂ€„7 ¥Eˆ~A6æÑC{÷íñÁîöá¯'§û­íö	ë¨w®ÈÉBˆ“yuõÓA«ýŽvÄc²±Ÿ|ÂéC8üs£ëÞ¶C¡’|¹í`Î=‘o”ÈzTaëu nˆrÄ‰®›¹“GGëÃ}ÔŽ4e!DNØÚžÑÀ…F^›tÙ6ì:ö_ eT£
I®J³9&Bi;ïm=¼¤ïƒ9NB¶ö+r¾ÒÆ7——µþ|•üxD0·á3yÊÉá©F]N]F!n÷rÎ»;êõãè2–»ÕÃäA²ºM<èeÊIUºÔóÀT‹ö¥/L±'ŸâtÜ£<óŒ*,ƒˆ2›ÓP×{µ‰Æ~ðIæÖ»/=Ñ0ŽšeþÆ;ÓsŸ96oj@,“óƒ^&xÎÂ£]_C`-sZÂóóó¿â!eÄµ“›á’ÛÁ4Ñó2ø°NmŠµÖ£&<!ÃŽø»«ðËœ2L¡6X×§­9™§ª]Ç:7ÖWÙSO}˜¸ïÁÅS%[O63õ¥•6àòü:NÆñi_õ2r!<]=Hb#1Ÿuôzt	8Ú)Ÿî¦Ž„Ï*ã­‚ ‘5Èk¨–NFl©.¢>0÷ŒèÁú	a{UV6 ,þzÔÅ5¾¸E¼W¹<h¯ŒäZ,‡ÕÄíX)£»çn©f‡þ/Æoº³Éþ Sd$?ÎmH™ÈÀ†Ÿ§ôôO`­$Â]ð]vR ÊTt6– ×
:[±)çŒšh¥e)¡ƒqp°ÜÈ`jñÝDà°X«˜½;SÉHÂ¥£FïÜq% <NwÏ ëÇ"†\z_ÉÛlvoÛúò/®^rÖ ¯£Ò¨`xüôv¤sÌà¹ùåä]‹ì½kÿB¶ÏÎÞí·Iûdoû—{Ö~
ÏAh0H†‰ì€óŽýK-'dõð#K²ÌÞ;©õ„€¨w`mK*@Al/$tÓ’¡7Dv.ò¬%£_BªA±Ñ²àÞ9ó ª’¿ÿí9¨rîÝõøM†0k»I
Ñ}¾î^Æ!’§=(CºÃÿî}gnr÷7H^=&?­À¬•¼	{E^‡òQËãú‹gì‚›™ºK×æ/›„ÊFG½aoÊD!ît4¦þè~Hq Š=èº§ùÎ°ªž{³5 cù¡ÏV!ÎÃwâû·
›Ý¢0ó,g@¸€3ì¨¸X¤œwth™ZÅë¡ñ:Æ:ƒíÑùJÞr}žXéumlV©›7r¥Î*3“¿,=¤Gìõücãø-¾}9I†G‘'ý
éS|Ê0o=¬€­i¥@™¨„+‡Ó¢Câ*i„vj8rïåJcÊVÊÁÚ8–ÖÚ:Û´¿ªÐýÆ5zl2CCØñ.ÆâckÉëh	uØx
Dõ¯à>ÜÈ• ç(ø‚â®(êi]ü„Ùš2®N%‘Ù,úú‚I6wñ@¶!Ô²ÁA˜¾€UAâ}¡çAIsâ=|J’×äqÇcÍ ÀrÖÞ>ÞÛùþm¿;ØA®Ñ«gväD5öZŠ¹>ÎÅ-éÉ[zFè¦qDj…n¸Då¾gsÈ'ÝÅ•‹„EÝÎÜE_kŒÁ«tÀÈ 
ñã‘®j}÷
rbH­u°»ÔÈ«¥ñ pàéÿàî¼ÄÜŸ–¦%I	fèáe{·”è•Ãsî7T/>U¡ƒü2n6õ‚ëž‚ÏæSðÀXþÄUÕ ¿<kR±ÊxŽG½Ä7ŒRè¾F¾ZâaoAßòk¬ö¿³8J©Š€e- ù×(¢ÀJ#fo79Å)Â…Õ¦z&ƒÁ\Æ>‡½£ƒº©ÿÉ	ÒÂgÃ–ò Ž,h öë¡ßôä‚mö†£ë±ƒ Æ·#~Fº(¡á„ŠÓ—¯¡<f~l¥|™ Zýë‹F£ájŠC‚¦¸ùÙ«ÿå:No]ÛŸ$WIOO’X”GÒ¨Å–ØÀ.œç‰ž¸°#yrgúõÈ(eù"¨WA*ì\gr‡äzŒé‰X{Ì:";
¿S¥“] ÎW/Š&Sgx•4¸&ï)·[\†r£œ+ÂÎ> V¥lÉ§‹…0¦ ÑÖÜ|ÁP7‹”ô‹»066¨Pþ‚Å³J þòYfPI9_z˜@¶´«R»ÒÒ òoáXE³üÑ:Õjf•÷ˆ»[ù,vyÌiþöHuU´Mé)"zd
äuÝï–ÎaÄC9•ìg(eoå|¸˜Š§—
cx%tžþe	ÇÜÉ Ï–õ½…ÁˆÞ…¥`72S$[H$·S,4a¯àËl7RO®½1‹KÅe` Íá½	{Nñ ä}øg—¡ue…œ10£ËÈzevˆ…e‹jó·öœù]v¾s]ƒ-‚õRÛm-¹0—Å Ð¬´>
fùÎ]ÈkæqHæqzKð0šÓ£éF3dã¸sEÉ(xp=ìu¸_KÝGb¸ÔÚÛA+”ÆP‚6xH-¼]Ø£Ãù©×:y¨_†ß¹BôÆ—|[‚E˜¥°yÐ~{Á½JÿŒè¾Ãú:P€w ‰?Xh
½gcóãù·Ü” #>èÂ	%ÅÏâqí½Ø^¯ ¹Dèòç¦ø\,=û,¦>~ÈÏ›„v]µèó¡aÈ[~lëV[O´Á7®¢¬†×%÷´²æGàvÀƒ†¶ÿÞÍRI?º w—v†°Cb'üÇø~o-b’òFq8ÁLõ“47h›ëcäÚø"¹sU~W†¢žÊ(þ¼&†!VMG{¨b"êð‡Ó©©©©Ž©ù@c²òèÚÛùà
2Öâ4êwóñåÕ!ÊßV¥çœÇú“ 1±Å´¡Ž®ÓQ_Ì$ÿ¤TúÒ;N7ßrfI$.Üiö©êXƒ®TµÝZ¨ovc¶n19CÁºnöÖú¼úzWð9ÕWCÇÞo,Í#äüUIäK¬›¨±ˆ2+TFhù,‘øÎa¾+Wi,4U­SJ»yX9¥€·Ó"FL±CÚäÉà(‚¤ýa|2%y9(ßÇhñ•¬	_‰öS{å‡U55¥a‡)5™c@è:•¢ŠŠöS
¾l°WtŽ¤gA6ÆTiú>ìx¾Z@aiu1Ë§Zõí‡×ØIg7'/•?‡!WŽ}^gA©<€ãòVO@v4SÂ?F!»1ç£‚K"äL‘ÜEƒÀÅÃ^†%)PW.…kÂô{›wßù!÷‚Ûƒ[²_’’u·AøAá¹..ò~Ã¤¨ô3N“›8Ý¥çUm©Ñvú×Ý˜ÊÊå>å—¨BÜW^!â!ú‚ÒÓör¤8åb A<pÕžš(%!9‡•š!Ög¡wÏŸï7ÇÛLÁ·ËÖXM;’Ä>8Áûÿp7eH~e~m¨›¯òà¼¢?ÙûGú¾Ú )¥Wp¡g«J˜Þsáóå)AœiUž4Åà­÷²Ü˜Û¶]\ÁZaÑ( ”a—·­‰“óR€J!&V	G)Âsø}:AfU!Ê®	çw¡'EÁŠßq&î÷Fž
¡É[>R Hóã°êØa~(Ëôa™^9€ ¸4ÌÎQ†é[©u•ô(]pqä•d?RÃ#«„F×DÂé‡¼òJàSþh/Uoù^Ñ[èþZËÓ6DèIåIço®‚=Èëç+,Â)]šçÇÌ¹/Lñ7Nš„R¬>¹˜Sýí¦šÐ ÕOí¤âYæÇ )u–¤ÃD¶ŠH¾êPáå+½x˜"˜_“J:	¶o2ð¤èÇ¨¤‹öÂ3bH–f ø§ê“_ÝTÀ³~àè‘¤$;„¨×«…ƒãHª¬m Í„‡™ûÕÝ;Ú§_Ÿ_ùÙ9*w¬dEBÑ8‘½^~ûBŽ!KÂqµÊä9Û
—­¯gÅt­Ý
¼Ï !Ùê4¶¶»]Ôì¢>ÏN8Š$WÊs˜ª¦Qð>•V¤bâ‰›1ùDª5’¢QùõÂb`;Û	dÖ.
Ë¹"5úijìBë _p>-”òc8ÙÜ÷4ï3(ðÆ €Ô9€†ÙÏÃ»iã~yJÂ
ywÌòŠ÷÷‡’;#oO÷ 2ÜéÉÉ¡õlôåÃ1{äµE\‘BOÊ¡Bô`ŠR’Øé]OT‚Ó#%¤»­óÈ†Êwó‰—Úà•ÛMUP4þ‰Íìº”Û÷è¦µÀpú«Ù~+ÛíMð~R¯µö¯K|®=–Öü>—•ô¯Î:æ–Ÿ¼Ï¹Cì‡µç™º¬ß.Š1*lÀ˜ïú|5ÜË;Ÿd/“§ørEÿ¯ú‰¥lµç®lµ@±àZ"›,Ä§ºm6M6FhŠR˜ÏïÉe¼8ÖŠ\è"ÖôImy~I~<	™6Oã:M’ D$¥1gW¿¹ª'ºhAh*&Ï/:-« HÀ5ÑŽaáªüõúÑE?bç¡p£!®v#‚ÓšÅ?`dbél(ycäuTpAo~[ÀkzÒÒæ#¸À hL7W­€u¯V†_Ýæ	«ZáUÿ)€´8X»¨}ÝN™I”½…w1 42Ýi|ÙËp.„Œ¤%<vóhu†ÅÅœÄŒ:@æa¡‡Y#(Ëà8Ô&zC³mû–RÉ˜™­OÃƒ±r¸·>UqÐ•>®«á÷ÏÙ`‰úXâL c?w¸ïòX~Œ.{õ§÷éWp;‚…7èöé|ÀóôõÊó¬;2¯¥!Û^úîÅªâð•¹X¸s#Ô=Z½ù0‡ætv˜ª.Ëàô¶™œ ¥ò«Â´þ*iŸå^+!’Ìæº’í&÷æòTß ¢·Æ"­}
h°VöÑTôÂTó¿Tœ`·C5§CpV&wºZü3Ðµ©¾0šÉ´RN+@†zÕ¦Š&3¼ýïûÏ©4¡Ñà@sË@ÅñTXª*·:<–Å¢k¯
Ló¹1ÜBDUÌ4'%X—4VúD›51¸Ÿ©«ƒšGfÃ²¬ê÷îSîÑ~—}J˜"Êì¡õƒãúîÛíÖ›}¦^‘½í³·;'Û­=Å6:ÉRƒYÓ^g/Ê®. û¡T&¬ÄñéOT¦ð¤ðP(WåÛ8ZÞ‰†#£[k¶3øinNðS)ù8	±³­£íEngûÜOšÐ'p PÄ³Ë+z.“›ú÷Ç …mh…‹þuÊÆÁR½ëñ'ú~O 7R‹g$ª½*Aö>z_‰»¼(¦ãßëk&‘+ŒKYê‚–S>À:¶¦@fÌ!çCœ€|•{@l
‡~ëç-j/éjOóŒªò‡Sm^5íðžN0C-ž*D[ÛÇÂæÊUÓ:–0·®±”àü hJä(F—X„À6Ô)«ÏŠÅ¼B…ñ‚žšh-ËV@Ë–É G® 3É2žKYóìÖîõ¸Óo‡þ@©Tûý^°Í	ž(q66[Õ,–´)j·´s–¾Ÿ¤ä;z¬CšUBNé\Õ¶¸rœzDqœ±#Ä^‡f“lè+4á‘
âd0ªY¶n¶Ódtuë¬;\„ôØœ ›N¡…v8òM'Œºè¥¶Ú·J€7v»³ãÚæK¢bàø\}¹õp—I³½j°¡Ú[§£Ö¤˜¨ß`ÊÇ›Ã“íC”IØPá[õÆ¥ ìù	:\_<F3O‚ïÀdu„ñKíÀ%ˆŽ)Û¿ŒÓ£ì²v¾ÝéÄ”î÷âaJ—æp°©„5fq<h®Ìó–äm´R V’zÕ€__ZÓÝRã|™,Æiš¤îôf–søä­¿dñ˜uVcSO1¤›Òî4µ5¥
th‚E`Z0@ãè˜H2’‘3JëM36’ÉD]yôçkŸq n ±Q?ci‰OŒ´]Füæß¿”©–ÞÔ1TÙÝKKhÃí¸C6“"¾ 1´ƒÑ?ù‘`Êe`1‘T)î Q…˜µdÕk¬áì|r°Ó/°&¾e·Ãq‡f`ˆŸ09óÐºã®x :§ÈÇB9ó}¤@×µŽ{wC·¢%×!“‰Ší™ô€}ÇÉGÆ}ý«4b!]òt"nC!1 ­ÓO®»¤#È¿}G@ò›}ÿ›—Ó²OU2ÒÒ{`¢ü}îjU@æ©"˜Q×™XG¬`%$E9a>è¦ïÓWkÅQ¿ŽeÁú°×‘üØÖl¤I8£©0võûèl‚1ÓYXy‹=²{£Êð–Wð_‡€þrƒ"ƒ˜¸<ü(‡¨²Ë¯0Õ´{q´Msyte³éAÙ´ÑÇ(›U©Ã² 5Ù"–&_@˜¦sÉ&%ßœ™C¸1ñì‹ËI«°ûX­aFþBWD,/X6-Ðä,¬]ÀH§ØîÙa+}$¢ZPßq«–vÔ8{í&ã—Ú·º.Æk2ìDeãš )”‚U²õë/ Yÿ™9úûù*ÑßMÕñýŒƒ‰»"Š-"ÖCªÒ[ƒ<9(,t\6Søóð¶°Š]sù³}çÒGr¡õdŽMÖN×Iâ0E}“{ »™Õ.¦“¼BŽó?k­•ã–3<|ŽeQEšj›º`ÿ}¿x àC‹Ç­ÅRÊ½ê!ÃðSÛŠßŒ*|}mÂ÷·»è01]ìvÑÎcR;k­´çµÖHkÚ…~¸Òô(µÞú¸Ô|©…ÉC©8§£³ð•N»Öåè}Œ†òÕ¥Šqí¼žÏ"¿Ö„“l€’Áö9Û?ÜßmŸ´¼Î6¹Œ¸^:
´
úl‰	¶	¦äå^§]p}£˜ìÌ$’jxË¨:®û –÷G!cæïÊ.&#q…Y?‘a)¾³•^ÊH&¡|”AÿøyÌlˆFJ66(s¹¡r —$Y­Ô@åˆ‰Ëˆ”¶’oTÌ{ÁªU§(¾#•é› &ù}¾:ª”.ÁÉH”MÑëtK¾cHÉáæ’9úäÎ ùº§ßi¯ô-ö{c“›ÎAi,1~bÕÅtP"Ãù‘ô‡#¶ø3æ¦~DÆ_å[ ®Ó”½s%ÚÂ‡èÉµó cê·véomƒ´ 9–2Þ“w­6iœµ÷Ë²àÄ)² ±Èì¤YY!oãþH(áé$ÊS$ïE9àDê•Hž9m.ã±H‘z¤gýdL^’ZFÿ¥GþA÷ÕGó¶øŠòR“po¢FpïˆÆ•Ôñ­7ý5Ï©ºÍËiõv—ÈV?é7›†ÂGú¤Lù®»’£è®”æªçASq2™¿h"4?aõÁë®}Ç@bUŠajã´&ÆØP@}q”ì‚¾ÚØNÔ†ØSiîËWÅê¹’Wd%ÛS‹]©Ä¦¬[muWŠ«)±ÕV<Ð÷–¿A¥œÖÍ³>´`TƒÜù¡¯X>8`¬\ÓÅBíJöŒOCÜbŠ¦‚øgËD-†Á#ÌPiãõÕú0”ÞâªŽ˜†alk¢¦+´nn!‘zöu!·íÊÆÏ´àö´?CQ1tlM²²¹“ô}%ÕB‹ª©eÕ&çqã²ÁÊX×ˆü‘¬ù²³òxºM“<| cõVÐ*WÛU¨RZü1¾ÝKn†Ñkì7~‹oÏØ‡¥[tÇƒ±‹¼Û)µ`™/íµ ¯ºèÃÏHDZÃ0#¢‰!IÛ¬â ×®Ûi_Ó½ÊÖ(1v9‚™,qbŽ`ÿþ¥c¼fŠ(+Þ»©¯¿7Ø†rŠÒ=ïÞš`}:îrBALQ ÕG ³QûtD0ÉU"5”Ü` ^¢¦ó%TÒêoë?¬Ú+ðM_‘•¾¶k½äî…¦;¦YüðetªãbMôÎµ¹-ÑßÿÏÿži‰æ]´½rvò¢•ë&¶Žs÷M×Ç”
K÷MÎéËÍ$	yDNû×Sû0ñ_®69÷2 ýîžý  ãG%b±EˆYw»!"°xÀr¨W$«)¨iÖáJnztYÛÄºÅ³Ôêîö4·™?0T<Ì”HÇCTè¶éš’ªÛÈµšç†aÑøD[)bL4HÐúˆø©c)×XKŸð'P¸Þ¼0%äzAæ‰´áŠ6æ…ùô²Ë†šåï Öœ±¸är¹Àã×h\²ì
9v>ãÃµÈÇ^š¹”]ö‚tKŽÖâûF£‘7ó¡?ÕjÑ2¹o¸)°QfôÒvhEZÔyEš”¥¯¹é„áÂ9†‹à1\L5njdƒ¨³	qRnHÈëQ7b«~çœ¼Þ€×tÒì»Z?“½uõŸé?›Ò’çöRÒûã}[]ÚF¬â/ßRï{ä¿ò?ysÎÉ‹·ƒ{ìýQ4¾j|ì'IZë‘µÅ%ÚÞU¥>i´Ÿ`N©¾˜“÷½îb‰„hFëbV|Oæ¦ëñþn9Þýž,³&‹DŒz;yÝƒ\·$küõ=G«JYÑuvô¤ëÀ•³qFiü	ø· ]ÖzÅü¿kü!÷ aùTôJ¸K´*™<0|s[|L ¹¿K¢NšdÐ)sõq52oJS½ª(‡Ë\#Ê;$KRMu<8Lê¹Ã¤f^üä‘¿ÝÒ•=\Óš-‡Þá7pLO,?6gŽþ|¦[«y³¼|:?_Žˆ5pøt@#BpÂÜ.oŽ-è¨!î§'3jaK[ÒZá/\òBÓ—z˜5ýÎ·`-ÙàŸhžâ;qð9Ô÷Ær¹ÿÜÉ·	v.øÁ¥æ@NgW½˜ÎÖl“—öT4MˆJšŠ€BSñîƒVŒR\H®s„`	ö"†TÇòW¶­Pc£m3‡ó=êc(9!ÄS±_Á)ð‰â×Áö$^z×fÖQÄS ƒÖ¹éò'Í`ÜÁ9e¯‚†f´þm‘µ´Å»\Fp+P{PåG3±Ù§1cA#†M8[…]¹1w/¦ª#€iâŒzñEýˆrn£?\!&Uü£oåíµ?ÜøÓó;·ô“8¤2P%;r¨á.w¸¡*XrÓ £^:¨-¾î{ÙUåè0A¿HR²}xÈ4$KávŽ¨H%@/‚û”e¾Z\òaFä—Næªÿ1m®oh.á
Àr’Çâæwjä04¤Ëeó<ÄeÉF ~Ïëum@ær¡~ùöª_IŸïxÝj<\²-™‘´¾€ñqJÌžm™äa1\•îÐ¼ìÖãqžªøUî’£$eˆîÛœ:?Ÿƒ_MÏWw¯âÎo»½´£ãôUõðsÖð;*~öc*9ÍÃ“âõœe÷ÛëÞ¸üŒgbíÉÇâƒ“ïÈ) 9Øùý¯mêH—^Â³‹Ê×…{YRM|`äZf#F…fs5é–:¸Ÿ.WqRt¢´›
_B2ú™R,cnvòw’K´{ SQ>—I¥ù‡¦#Þ r&ûÁÈáèù7^ñÕ·%üº™õ‹mŒé3»8»8A±É9Ã§@ãÒÓÉeŒÂ6<¿›ô³šA _&Ê†³!³—$¥¡Ó€2cpk5­Ò¼ƒ¥îJÁÍª@äÃa¦p>5_ó?úG?äZ`Óº#Ó”Àoúóu÷n	ê¿9UÿMÿM_ÿã˜eˆ¡·5l&7­i ím_ç)zvO>®¬î6uúS¯'t† ªÂ+Do|Ö²jÂ~ÀŠFÎµÊšj×¬ÜÞòkñÃ¤¼9kpóð¡òZåjiÓ×ð*™¤(ß®£ÁY_òº¾ÁU«üIÐƒÝÂUÐAH¬àêjó*Rz§I¶¹jÄú÷Ã]È×DœÂ×å³Áó¶¸z•ÊµàšÊØ_&£Ã9WÊ²lzxZPÚ+Ôž–ç1g»9?¯Q…ý¦»’ QÑ ËÊÑ‘U3¼‚ÎH2D‡¥"$¤1ÖY“<v‰Þû×8¶iä—È‘U‰â/ÙDAe‡ä£`1!
ãp D‚°ÐŸùhû¡ï2—ù’æ7<–A¾BËÊøÍ'•×êÇJÃGyN>hþUB#Â§„³õk”‚§Áo®É/9C˜m¤›oä’áFÛ’ªõÉ\ÞpAÆ1üªÅÊŽ]£qg½’qç™0î¬– ÍR^DåZðbi¥¸UŸ³†5â–]\™b©Ê+$Ìy–óÛ˜ª…(KÆ§*erB|p8pfñ5á`¦aÍŸ*Ê•÷ÉH1Zå~<—3Jì#øB©­'-%x¥^þÄú”9BÅeth!éÏ“‚Ûi”©EAªHy#ó£¹ðŠ¬n')·ýÃøSÜ'“å8±Öym—‘L×ólÞÆø¨ïµø(ü‰±:¤_#S
ùßšÃ.
ÛXÎè½ä-%•ˆ)Þð.pÈIõWhæ3\röó&?­­®Ê²×žûŸæ©Î°ñM¯;0{ŸïÉî
ÅU¡ÖFq1i‹Ž¡BÍâÊ˜ýR·ÿÂ$¾¼êÇçq.vÃóË¤xý] ŠT' 
‡|õ“NÔ?£"vt7 ÙˆRqí<6ô5ÙxÊ‹žÜQìÏg'Ç† Cw`^!TLã3\T…†Cšõ;Aƒ$Áyä;³–ò\)á¹ùý	Ïžtæ°SÞ†„²¨6 â&qšp½¶¡a[ÚnkÉË0\)õ¦%¦ö¹Î3 æ™=ÐLTÕ2dèÙ¤’2å–^–ãKa€ÔSsˆ):ˆÈkô…Z#t©‚ä|Á ›Wáé®bëªÚiŒ¡,R”Æ9¹”jÏ®ÈÉ%5Ýu¦ä+ÉçîèÿŒQfÜ:Î /ÆÇJ…©ä¹’¼êâ¼8ÊRïÊ²ü5¢‡
°aWcãù•U^˜»±pæ¹°ðSž¤Ü&„‡šl`8¢å™­†¢%ÃÄç22éš'óšýV<1Ã¼qøøJÌÀ†Fåân…Ü_‘yFRÑNÓ€hªâRê£åFò§±lE)se:?Ð¬ïÕÌp¡ÛCB×N–ñÞ—e£iÑfiò¡àÔÔ³2÷A†RErÈŽET=y-‹=rdÑÙt!K—¥aYXö+“A²/ßÆXêÂÂV½ž—-fœÔë¾êlò51 eÖf½$…R†É<r•¹T®2‡ÂÄ=ðÿI;ºVª¿Rª¿DêD®Ú6Ø
se¸–Û³W¸Sïóë2š:ÒÜ jðÊ£&R]&Þµ‘rÑ'Ð Ôaš‰²fóVIx|Ô¼¹þ+JŸ|³Š	›Á¯O-)Vžÿy*	kÿQ!	Î—THJñ_·JRPx!ù¤þu©#*ã~pu„MÛý(#÷»$³ª"ÚÄ?ª"÷®Š¨3>u¤`Ñ¿Seä[W=Ö5Õ£ù¨z|uªGó^Tæ£êQ¼ßTªGó+U=š…êÑ¼gÕ£ù¨z„ç÷£z4¿	Õ£iP=š_·êÑüBªGóU{[’yªÍGÕãUæüTæ£êákïÞTgÄÑú¨T×?”Šõ³© »£k[ –i±jííyÇb©‰ÑóÒA| (ßª&¢ÌæW§”hAùâÞt¥—G%d8_PC1Â"|ÕJJ‰ìÅ%úÿªyh­E™Á{Ñ]dfÔ`Œ+ñ¨ÆÜ·cšö9è2%&ÿ¨Ñ¸Ú»7æùqƒÛ<*7Õ•›Ñu:êÇóÐmØÚX´÷ÂÍYÇ)ð—æ¥ßðY’Õiâ¾UíFÌãW§Ù( >Ü›F#zxÔfB†óµ™ÖÚW­É¨d^,ˆDï_•£óó‡Ö^ÄÌÝ‹ærïë2£ÖRšýGå¾5}Êç ­(LûQSqµWIS™é¿¶#PVþrõ{ã[r0ìRU–òV£+#„YáÈ:Š"£ÁQb«fÐIÂþ#Œˆè¨÷Ù[çD<ë ¤dà–>UQBZ-p|Í¥5z\Z(‚gñ°G§|ÅÚÜ6×mŽ~á.ñ~î$.wYóY}gÜ––Œ_kß-Õôrµ@ÐííÈ¾jí¿Þoíï“½ƒÖþnû¤õK‰¤élwÚÑC°åÂ&”\4ip6¨Š$ö([Œë£nLY„f`Tgq”v®Èwä5®¬µº›ÝV`¬sS¦€Ü ·¾"od#3ð†>°4îÓ÷)&œ?Ò.nê²¡"mò÷·•ËGBt‘%ýëqLúñG8TÆÉˆióæf]0C~p!RˆÂÍQ9‰r‹eÀ:nìRÑÉÖ’€ê°fþr§·¶´!„ ?ò“5Uµ2–ù‰)`e‚R£~ý*Kæª’¼âÆ“1OŒqÙì|)ˆw]!¹èzlCÁuÛŠ%c[ØHÅ+œbÁWÊ¼JŸ+/P„Ø_•&£~a5Ö›ù„%­•ƒÖÂÖA‹Je0 !¶õ+6rL9†FŽ§{þŒ>Ï#×¬øp›>Ü†‡ÛiDgÞóx!ûÍZ[ŽjjNjE,ÆLjeÅ$VÈ.–yö­õ4ÅðTM–Hž»UâÜ=;j…©oVèÑ[’N}2ìß†’¢é7—DfnDÕã½^J[MÒ[ÒFÌÖÙ%³t€ûôoVû3H`Ï|vòŒ1¼ÌX‘~A(ñ½Ü_ÅQ×êðy±XÍQQœL…\e%Ç©S¼+¢Öà-üy`8«:‚¢ÏæÊøjúñl…G¥©ÙZÒÎ,m	Ó ìðÙš‚º¬f³5“cpÎ8Û£í:³Ž‡Ñ_Ú»¼‚ŠÆ€§¿ZÉž¤ÛÂ¾i.’î­<º}é.¨ßþGnN`.®¸Û»¸jæÞÇË+Z¶ÛöÊhþäz`¢çæ¦Æ89Lnât—nâÚ’¤£+B½zš¶h³+mi‹ÖYn)›ªC·½VšNØÑX²F’¦™JNù6/6£X:xQ$ùv¼IÁ—)ß< 4ˆI³Ïò€<3Y3<*YÑÉ+R{R.ä„ï`ªÿ¤Tw›»¥J”Ô§gö9ä©LÍß}'­FþšrµtçŠnPñm\«EËäeÐ¨Ø-ï&Àß®]ˆ–œí±j[K~³2å}²)Y:R,8ÀA7e€o?˜ó¸«”ÓÆ`(ú,3#}¨ïcjï¦þ=¹¢ÿ×óX$u;°u>3=…-”] ôt•Œ òÀg³7¸$YÚy™?{G¢þø¥bÎ/ËcWìŸäâß¨ÄYïÀÊ*ó°À,9iœž&ý^çöåÂ0©ç_cøÃ†}‰t®¢t{\[	¤Š¶Ž· e©Ä%èÙ_Tä¾ »ö7(¿T¬Jx<‰]ó
Å&ŒåÝ‘¿ÿí?9i«ô¤T%jeÜõÆŽ•	ÍÞVß’QS6>—3(¼¸•ag,deŒ<j~¼M6HÉÍDÁôcx]‘ú¾¦§¾«¯-§ÈÏûÕOöê*¦Þ_ý>wDPµªQc&yJ–œ(†L/neˆ´Pmo¡±@sŒrG@èÕðN¹ô“DûP‚>x8!y”MÁLªzTá˜ÆxY9n£r˜)Â8Ì¿JáSX5MšÍÂ)_ó›øH¢Dêïå(*¢ºþÑÏ ˜	ºÓûñã9ô…Î!­A„zaKý<KÃÌ"mZûf~7K7ghÜX´°eør†.´H@°ü+_ÌÒ4p•ƒa6BmYùÞðïàä+eU­˜•¹œU}Í[u.Áax8îƒfI”ÙŠ
þÇá*ð³¢<îƒÿ¦Þ|æ§¯åëw%DeÌ™%ä¨cú¢_ŽÔ¥Ñ”È=ÊH4¼ý–©Þ,Kñ9ù*Å©]õ âõÂü—ÔÎ(OïFiwiæ{°K9îÁ.©å‚ÈÁ°N·¥ÖYšmïQdÔ
!J›^R*˜¥ÕÝ³*7íÐW¿Åé§^ñ#;ÉŒsðfûhÿ×£í³ö~kaëD2E]ÀYÞ÷íñÁîöá¯'§û­íöIKÈNèà£J²M©ƒŸZíw´y»¼°õS/ƒG®²|Ïb“pì‡ÚþÑ(NOÁ^—ÊÿôP9LX¤Ëçè¢ÀÛ‰ïÈGKuHñý<w8CeÁX+³`‹°Â@¢êVÞ/m1ïëäh»½û–ì½kÿBÎvßîï½;Üo¹ÃÞ™¸sw¯ûq:÷È÷ªÑìÏ§Œf§t‘Žáû‚Û-ëxµîó¹ã·2„°½€ð&Û|‚|[¸<:dí’Ë‹aÑD\—ƒþuã>ËíÚB›+Wë–_F¥­L9­êÂŒÁÕ‘‡X‰˜úôŸAYwèÀ˜ò@†¬ò+–‚ÿ§tÑ@ûØïuÆõäc9/•HÊµgÍ•QÅÀrGs­n¹M@ÌKèÞà´n°zÉr†C´ìu7È9nÎ_ŸNöè–i“›ÚŽ¬°
¸ü_}ßžìl.ÚŸŠØùÑÓÉ@Ÿ¨þþG²¶ºæîù:…„PÔØ×ÝA\VFgzïÌG'…Ê€<éuox‡p4>²Ó~t§@M´¡í~ìô†dûju=B4!}Xñ¤ýãžãö4î*Ýì^%ôå~Ž{îgxgû‡ÛÇoNZžN2ôÂÁý|ƒu-÷Zu]ïxOÕ}!—~°5j…FŸ™W©dûÅí.x(i?|fý„¹lò‰†‹N	ß"Ó—=È„ç$”»Ð“¯þw®‚€_–æGŸéIˆ±åR¬yÍcCä)B½åð;í_g†cÙž¡„GìnC,;‘!cÖ~ôn®°³ªZ6ky—ÊÌ¶ Èëœ“›y¢õÁaÕßã`ù#)T	ø»MqSb£n±QF¹¶J—DHXY_%öíàšeÆ–Œµ¸Ç¥-_U¾é3Â»K~‰ÇFeéMg£T-ÎDJä³@¢º]€“^Ä—ô¼ÌXïpd³«²\Çt8úí‘O%ºÀÈ<ü6€ƒµKÝØ^Q`îs ~ð¶Yí‘àÆÅíZoVk½Ú:ü
m}œëÂàí%é‡v RúÑ€[Z_Œ&¬‘]Ð6Ø?€n1‘—’ÓäEÜO ‡Rïø*¦Üjc¢%˜ÐvÀ”–€¥&rÊ²Ÿ8_*o\¤ P¦©TeÎ—xYZ¿ei¶—‹yù„ï$I?Ž†K~oe¶9q°€ècRâÌ­âÛA\²aè*¾lõ-Ûõ]Ë—¹[µ7þˆÞ™¥';Ýð0dG6°4`kÑ¼á‰C XÊ¤›í)ëqsFÔ``VIQñ3&ó@jÃèÂ˜"ëg6Æ~ªÈa<¼5Û"¶¯øÃ¼>*…­ÉÖUcì_€‘ˆ¯1×a¼zaÖŸ@ˆ²
a°ëç#ÎÕ à°ÔÀˆL¡D‡Ø+XØ0û1"#o;Ôi#Ü69„@/ª¹Ê!GïW? 2ËµË0–RBk5P±BŸ2Š.hq r¿,i°œkÄº{“
Hƒ`ø£©T2ý’Ý/GTþëraï©¶y€³>¨ã­Š¤¶2AÞét(«rÅÉ"ÉÎ!;X½³ÊÑqá¡qzp\aq•bâÂ¢âÂÍüÁ½¡¨CÂ£&B¨ÊUÏ-‡â©ŒÀu´GI–
3J07|.Çrçw­³Pn†»¹¦æÝÌ‚dº¹ÝÓñn/íè¹ÇÍ4”l	Yüç(R:ÞçHº$Ý)²®ÿF·QÌ8Ká<,è¾°ì™ðÅ’+>¬*>¨‹&ß}o‡šÎœtn£¯'B©
tu/Ê×ßç°–ËW å\¾¼™«JO~"ñä Þ53§•¹,8¸ÇV>ÎRØ©¾ÐDÍŒ¢ÊÉ¢aUþ7îû´]ö6ÌŽä{(€ÜÚi”]5«XC¥‡­fNõ®¹`Üqëh2Åt&’4«ow™RB„ÿ€î—Ñù§j]ñ±É‹<ñºû%Ã´ß{}Õ#aJU_¢hG?dóB¤zîhž¶$’A¶•-%Šní¾ÛT@Ì¼GAKyuBS=JüÌÞ‹žX›¨—» Ã9D®zèuæ"ÍÜ—™S[­ý½ûZdÅwokÌí\sZâ@4Nn"åžzîç^ºÒÇuÒ¿”>>çkáÇ“wækš 5¢“Éà"H:+rHm·åKÅÄúµ†¨–Õ‹¯=•ÙcN&uÄ3?fÇª	N^Dµ¨±4ÕBBÅV™]¢2€6KT\¨YàßT³bø ˜KË"ƒ½B¬¦ß¶f×µEÌõ€òÃvU;¤ä*¨k_òŒÒœ¡_Ã!¥ùñ”úr§#ãµÇ3ªt×7vF5¿øÕüúÎ¨æãõ»9£ª•<£ø=ó>£d»ý|Ž)HÅ©VÇú>Ï*S€ÖWp^™†ýxf}±3K£éÇ“K¿ëœ\RÆù\Æ:•_ðèÒC?¿‚cKòã‘õÅŽ¬YÊ‹ýYSß0]í%Ã×†÷™5õÙ9m·Éwdÿ_NOZmwöiüy”¤ó¯·ô˜u:UÖéiÊN‡™’NÅ¶Ç ÏÜÅññYþý}'î#U‘¼sH¤Xž(Ã*ÆÉu
už¨duAÏ‡˜ÞAI#J»”~/Ò$êÒùO‘m:“/×}ssÓR2nà,Ô¬|ËÊ­,Õ+ˆ€ÐÆ½cËà*B¦ç”¶§10±G+†™‰c#AÔœ‡¸Üç:3ù	¦s_|åüÿýßÿñßÉžN"ÈšCüõW ”ïÚÛû?þ|r¼wBvßnœŸ½=8]¼#õ¢” ´N RãŽbìéþ7‰ÎDí¤(.N’ÿ ?ÅÃëÒ-ŸàK~»—zàål…ÊVHÌšyÉF5©ªÈ÷±Áõ{Qúyó Pö J¥Ç,Uþ=|ñJÀçä=~g¼nnù¶»çjö•8ÿ×áXCqò¸Ëð¹ƒoa4T„zZTªÌ«NæÉNKÿ:<'ôˆJ5íyˆìõJ`¯Ädâá9 ƒ?ÕÑ6™©oñnC#ÂëeaŸJ@jÅt’’¾Ïç6ÃSY|<Ïƒgÿu¸èÇz§MÀhç§(é0e…k>!ÃèSï hè@{#dh›”ž«mzÆÕð¨†í€œ¾›ŒzTAûù*gÛ£ÙÉù#?	!ç`7ïî‰;)<˜ï<`b¸‘ÃTd/tŽL˜^Ž‚ÏfÖ+ŒÃ˜~«\ÆëTHL(¯ÝG	¯àË™x/‚
xÉ¹á¦:HŸ³åômªqªŒpúá¸ÅiIã¦¤d¡«qV›Ü¬,s3Ï»@›1¤Ì2ºÄ¡rÙÆ–3^‰±ƒ@RÌVº¸Í{£Û—’‘Zë`wif»ò¦Ä¸±]3™Ù0±¡]:ûôìs/lçc…ÜØ¼-57ÖcIzV +Q§z>¬«v·+ËÕÇd³(àmLÛ8j–© &ÃEÀ@K;³d¿_%¦\^w%/·áOàyY!ÑÊSVsÑ…ÆmXÜuÇì•ó†ôúìí~(¿\qÒJf"û€hOÉF16ŠïÎóBŽÇ¹¼;CrÁÈYš‰†¿ÍðxHuI|ØƒøG|µ
ó1U,Xy}_xvÔAaŽIÿŒn²—“çwÚÜ5‰}ûÊBWoõ{Ä¼Éy]îqh7>°E‹wúCËÚ`³@)–«#`Þ¢Ê`e8l&ÌÒ¨–†M”§cäÆŽårBJx}N[êYI¥ÁfëÄ@„Ò¤ªüýö¥•è
è$€¾Á›4+“v€Š[l¤ùÓx’LãšÒÔú»ìj%õ¬½}¼·}xr¼OvOÞµÚ…uòà¬Ý:Øy×¦
Ù9Ùní‘ÚáÁOû¤ý8Õ‹»N·YRôÚIÖIA|E§ÊëLÚëeà“/9¨4YxrÎ%Aô¹~Ä³úéæCŽ8FžN>öÆíäg4ÈÓS}±½ò l³Å"‰òf^¬ân.\_#~wýÙâî;×Ž2tÉ%#È"§IŸìDiI—/½GåZÜô¯4îG õêE¹5÷ÕÇ‚sè}%ûÌ³òBŠŸ
˜2ªÜ-ÞéSê‰1!”¦¦4‚g®Ð¬p,ô0ûÐÿHFLBÎ1€ä@eãàúœ|ö{CÊNÊoã?ƒ«¾7xNÇùœK‰Òa
–r~g²[Ù¶ºå(	ô…1:¹I£‘Í€ã	èGß4”€ÂTh¨ÀÇö¬ÝX’o°Ñu?³×ZÇ#†Ÿ*ìØ±Øuf¼0 #“’Öõo›Z_Pä…·—ÓÞÅ5XR+¾¤•Õl^­¹‰”io—°Ù¹ÕéÿfûJZý*V<nž2oŸ9Øò6W®ÖŒol²ž­gËNaÃÛ0[ÜÃ¶IàLé¯TÊ1»ßŽ" âMãaB#kÁ™$ÌºüûßþÓS;°ö™}€—\ˆÍMkÜp0ïáävû@¤pey<nSÕÓ¾|¢×ô¾·—ÂUE#¯†hø€Œv[—Ø§}R
Œ3¡ûñ;rÌWà¨)»*sÁ=ãa—äZwã†áÀ–‡Ò%+‡n–Lc²ožR7õgß³nž[Ü¼5G¿¬x½¤DYÒ¿ÇìW•Œ ÅÆâQr”ªò§RÊQñr*o4ægò;”•Ù3¹ŽÓ[³æRŠ…º5ú£55lÓ¢M@Ù§BÎ(å …ù\ËqDž8JÓ4¢<'vS1Ñ#>Œ³³¸¸¤oy`)0ä$J”(Ò„!#ÇåØÁþÅB›vk‡ÒehÜ€¯{cÂ™;¹¼¤"ì›ãv´†Ð”'óu!VÔžH2†‘ÄˆÑ”Ñ×,(i^ñLTÑ1Î°4`ËªQQ)w˜¡W¢cý>æŽïÒ»LMQÝËð-ƒÒ$º…³›œ¡
¯uD®°PÀÍ@Dw4÷2B§‡ÞFÿ¤„À"ÚÊÂÃè–nÝ7à¬DÍŒwêR(ÕYã”‰(Œ“Žcõ¼8‚ÀÜéáÅ³Ñù74w†Í¹©z¾1}sÚ¦Ó•Wñ£ ˜­ò½Æc¸—3B—qó¨GuºÞ¿ÇM'÷Í£ é2oEŸ+<aÔtíŽ›G nxÓK¥/mœ‹ûŸ)uÁWŒÔÄkOEgÁ§¤2ú4—˜0š˜%TŽÿÄe÷¹fFÐûHj5,µeÔñáå³[¦½Î"èm×Yœ¾j 1-û¹7¾ª-Rþ×Å¥%k$åŽŒôjÐÈ^”]a—µ¤‰ûTÃ†‘à@XïLVÄ0u’+waÝ²{C»h±Ÿ\ö†ÖfLÌOïÓD£=Ÿg¼ó Hã‡ÉåÉõ8<6ž:t­_ÒøLB"\AÌÑkT›ClÒ5Ï”`Q,Î$Åë°žL¼o6ã•ÁŽé[ÜéÀõvóJ˜5ì0\q@WÎ-õÜCA™KÒï_D)ÓrªñûE*“-.ëÑÒXí~
™ý¯®8wÀdU-*¤YÅ]ëÜ§'NÎANáð¯š¤RZ%emò½ªíÈ›+:³Ì33LÐÚ`‘Ü	IKc1`V×œIš‡€M–/KónE°¼OÌ-›…{‹Ù4Íß)"ªÏ®¨½Ýgá†Ä`›ŒMKbm#»‚YÎÊ«zÉVm^A	µ¯³Œ…FÜ•û©.c|/hb7ég5å]ss¡^h¡6{”™:¨‡¡7³ù[&ŠN[¶j+“^šÆûY¹qXàïf!çžÂ*Y³
Ñr¥T`¡d‰¡xQ}"—Ðá8Sv›ì· H¡Ib1Õ6
è›¡ä¾›5sï
ú˜¯óæ´7ý7í«•‘ü%yp‚±Ã}b‰RAÉ?-Ú8%÷?üÎ=ÍzÑTg‡K€A;¶±	A,`E.ceïã[ø½ãÅN ˆ£~’æ.9³2wq/’;S.–4 • •¾ÿ¼&:Wª:I½çÃ2±4
ñUÕ‘4µ‘4Õ‘4ïu$V:•ÇÔÞÎ‡$—¶R†¤ å—Àô ùcó¥<ÂŸíˆm¤PÖ ããŸÔáI_ZFg:¼Ñôî8zCDLQ¾iš˜ØiÔíÑÝS'õò1M¢‡O½HÞñƒJ£+@¦à(uÉã†šçyŒLQûÊ-SÌˆÕ5 Ë@~íÌýbUè"åÁ_ð0(Hç±Ó0œ©@³C}04¦TÆ&äá>M÷i*´Ç*Ì#ìG
p(ÎX9H¹&.Aä4F_b‚t½Ö¢3äÐ[áÏP’°l±Æc= ôXí¡{saS¦Ïï”l[f•˜I<Èìð‡í˜Ê©áªÿ°ê!‹&Æð¬1…uµ!h‹0“qg…xFH/V-½Ù<*«ÍB(¾Ÿ§šT¦Î²<¦ïÍáO¥Òtx|è÷Ž7²ç­8ÞÒ5‹îdÐLŸø9­äÆ…ÿî?¿ò3¨i0æ‡kƒJ¿Zw³“B‚d*çÿ‚»#_çÌœÜy¡Ÿ˜XÚËXâÉKRr–7¨B>¨-±PŒ¾¥íû·$½ID ÛJXúRÊXºJfæ}øÊdúúpt`¯–É:÷dÂáÙã(ïàúN™°ÊM
óX=2R2™j›vKYq•.€`c7±ë.¤N}ÞûdSœÊrh`Û‡ðw*ÖdvKÏ«ÆêÚß@áiøcð(à|{¾ª‹RÜûÆ¾Ì­}a+æBˆå­t£ì*î*QyÛ7ñF;aqy³#¼½aý¦Î§ €=©LÎ-ÑÃ2Ï¬ÃU*â±ù~x:Á#Ðy˜×„Ÿž~À¸i+‹Vž(+ÿÌ}4¢ ŽÓëa'ÛC¨µiQ÷>Ÿ$J«AV•ébxsAyvØl°Å›khÛ“Ì¬©)³,¦WdŸ4YÖÈ`ƒ}aqé¸¦¤Èã
~ðŒ_V¢1O¸;lP]$6‹ÏA’áÕ•Ü2Vª6þX§¶ÚD•ä„+,›t9’ƒÍódÎ"9|ìµI«ÔõÜ5	þ°=b†FV#~ï:ÙY'e^¢|Q¥Ì²Ë{lÓ$Y,ºœâ)é°"á3´|dÀ’ÍŠà@2§zZµ'–˜(õ¯÷jóbÞáÎ/d…¼;Þ>;;xs¼¿—gž‘·'‡{ÇoÈéÉÉ!O>,!_ÖÌq= WlC—ÛëIÙï…ž“3LÎ1€»ž¨ÉÈº{AÎHÐçˆ‘$îžAÔæÅ-£:he¤e	â…žØT½¥\·¡Ü,¶¹_þjÖeÝªü(o7õj†]âséÑîþj ¡’ÖfÕÔ¼ÐIûòº
žÖæÜ”ždÇ2u%cêØ¦6cîè¢¾îµœ±$´þ¼)ùä„<¹èhêvµâ§p›«8kÙÃ˜üc·ù¼Ëâ4SG‰	–.ü/×yé¶¨jVºa´¶ì_Ú5˜©,æÈNòS Ïá"oéd-ù4Iúx.6v§/¢:ýÖ5]—ÑsŠRÏ¥H‰A»mÁÚÙ&,Ÿ¢^ÒêP÷Û»-ÑP·Î±‹áý[ÝD=D¿ÅàœÚjÒ„ÊƒW1$x6Èi?âHãäüÑÿÁ/œ‘üá(£†ã¥,ha3±o“óQãCa )úBiã{ÜÄ8Ñ\J–JûÊ>C]ßgöÂLQlØÖY}E!r*/{¾´„¼’ÆÒwó(&zK2ä!¸l½Ï³ €¬á;ætW‹^Pœx*aŒå…±hXì,KjWcæY¿ô™‡“”È‡%YÃ¥Jðò*Úx¡ŸM9oTp×Öƒ¤ŠQOá]…Õµ`7ùÀ¯<†ˆ‚­dƒ’}GE€	(šjðc)ÏV”¢êU‘ã‚Š•£"ËPaŸ~7J’AÅm&¸Ú°/M×5>yN%šù"®2“yFáÓkÁ|ºYxçÖ„GØQ+Ã°‹oå™X²
Ç¢˜ÚOºÀÊ
š&q·T«‚„sºÝÚ?n“ƒã½ý£ãƒö/äl—ê¢Çvd›QÌâ€Nù`Ø`mNÕ^'é@`/ÿ…Uß~9Ñ¾¸3ßÀÒ½ðÑrça)ÝÌ¿±¶u®”¦égõÞ|g/'üõ×áøå¤ø[½Gd•¼œˆ?å;VKônçð`—üt°ÿ³u®/¨¨ñS/¾Á…)0<èCÌÌû'Ê_rÄ¡Ðb%#ÇÛ8B¿FÜ1&áß“RY¨À áº%,)UÖ\XÃ¬4Íÿ·‚®dÕ½9f§Hd¯—bé÷ò¡fÖZC60aµ!Óc8Àî"œÜdø L³ì,Y_ù¹HÃP’¢=Câ$Cn@˜’zËñp"4ŒkÞ~}"5_Ÿ¼^H­`¡'ÃþíRp®Ž5¡ó÷‡ æ³à½(í"ÏR0¸ÃòŸfÞã,;bp fô/£!é¹I8µ2»3µÂ9Ê>Üç[˜«bXŠÚd„l®ÈY±¬	Òá9Ê]õéLÊj^‡nJJ_ôÈðª÷RÒG¬H–§û	”5ðQ]ÄýäÆ\¥Æ"¡ÌéäO–ÃaHˆá‡Ä|ƒ	ˆ§er°·LÈÛ½¾ðA’0^:$É©þè$ÿ  ÿÿì}ë~ÛF²ç÷}ŠŽ&QsDŠº9±Æv–¦(›;ºE'3ã_ö"!à ”eE?=Çy”ý¾çÅ¶ª/@èHÊ‘áCbI@£Ñ]U]×Y I=È–!ÊCZJŸ7³°þœ’äš¹•1J$‹P19uÅg´b«Ñ”7ÀŽ¢Q¾Ë5€åZ×§®jc¡Åb¸”Ê®¥"WVk	ñßÿ¥±LQþ²ð[¾òGÜÉqžX™©ÙÚjÅZBYçS‡2âVÊˆ‚(Mg¶vådŸ$iÇ®qÈm»n-)lHá1•Ûêß4\¤ÀQÛfJoUq™Š•´F•F-,aË±æx‡ÞLIøÂˆ]èÇ¥>…>åR` ûÁiñÄ1»AÈ©§k¯º‡fønû­ù´2 rûX'¾Õ÷½É²ƒ„—Îý¨ôËø3EË!bÜ•WïN	ƒeZ…iP=Â±8Ý0}·iE¨Ò9ôäÎ,~\þ=+ºqS“\:¤«¯µ ,-¹€Ñ-ûél˜Òºq‹ÐÛV/+¾›xÖ$»Ú¬‘ÆQD¹Ÿ5€åACr)ŠP#æ^Ð1â‰§>1
“ÌÍ&öá‚þˆ¿ä?ÝK?·£¡éµü¯Xé9v›³§5•^Ë–ÿµNþßÿ%‰bwÙ#zð6cü•}»g©Í¨Lo•Á4Qù^„j‡Œäü7pZÎîqÙàç‘g¼š±©…4oãmèÀNz™¦€Ê¦°C÷úå¯½áÈ¯ñ¹w§?6b?¹çËæ[™?ß„U¯÷zk‘çµˆójË–x¥õ¿ØÂ8uz/š³í³Vû-iõßwúÉ'~ØºxËò±NÎ[Ç’­{—Œ£›Ô×BDC/ÌKºÒŽŸh%Ø"õ&ù­¾ïO‚„š(]‚5ŒÁÀ¸¯cTí
~ZÖ¼ö€æ(h±Ök˜=”Ã¨ßûÄþ5®¿¾óqüK©P•;ˆVNJà62[>îG¶ù¬Ð¥Ó@õe²p2ÃŠÃ¯éáÌ‚ÄÞŽJ›jB2ŸÓ' xmf’°ÛJ?RÆ§Òš~X@:ÔçUÅpW8ÏÃÑÍó†Ú¨bCd†fÌUû”cIÊ²&xbu¦“î?õcL¬ç$”ùk²É>ìR/¬ÏPÀîGqðÃ-fÚó&õÙ±:wÂä`#3ðcØØ £»I¯ú—:ßIÙkr¡—vµ+/LTŽ-gç	+{(«Ðz{XæÝ\ªóép—ŠÞÅâýÝÔ.gž‰µ×h¿¸µTšÞ2· •ž#tšë[^êòƒ3o0æ\EqÆ/‰p¦ð\j²†O` jJ}^¾¤Ø€zœÄdoÃ†ÍaDíÛ¸ÃF3™á3Cû@ùÉ¦1\^yÁ!bøh)Jºî½3P¢@îˆ·JßR/ÌI‹“"ƒÒŠY;…ªìPòît…£Ö˜.Å8[SªÎcZ¾jhl2k%.ñReò~þùæe!zf¤Ë›ÚâøQîÓ7–Qÿ>Ùê{]ß{ÎèMóÖo
oU­OÏSŒ–[ÉòƒŠds3À‰úP¥! xE¢ Ñ‡+%æíjBòºÑr'E¡Ñ)"\PøLÞÇªIO<·M—ræ ý¬ñ.èCL[ê.–½“æ*¼¹ï„ÃAÜebïžiµTê“:“á¡äcD{ÍEÓÜÝ©E€=ßg‰dF’‘‘ŒvLöç#É…~Ú\e¼ðArê’êL=òT
D”?.ï	¦-MEí±?øµÄƒb¬C¢%iN`ÙÉÉpXþ¡ÙäRÑd9•.$ÓÙú,—\€ñ?®’t²	GÖÁî	?!—%œVö’…pÒ9‘áOÚ£²Ÿ†YÑõÅØÃd¦ƒc¬ÑCÏÒ‚#f>á&@(0úïý¢§cVß7oZþ,ð]°»#£HÔÎ²xÌ™ôU}ûKû>²DaÑZÞDÐOs4}Bº5•ª²ìTY)))}j¼gNNÊÎuÃ™^_Ö–h1:èâ´Àï}±5Þ3NÅî !¡OSoë˜úóÉ·LuÁ
ÀL¸è
,‚Ù-Š ÐŠ1®ws£¾Á÷=ÌybºÉ&ÆçÉÀ£îÆØgÑý?ÿ™÷ûÀgþügl²A£øzXOÈÏcPZ[³¦õýÐš€J]Ï|)r„!Ü€Ä
æ›"þ.™„¢ÕòlªÁ8À VBÑ7ÈéWð2^kÊ|9WížG£RmK£>bcä)EeoS˜Fsx£/Ìsöª†`_“è«©ˆ©žÊBžt)­›A\Ì £;2|‡`ÌñÆ æ©“«ÅÁ(˜’ÿ(ýaKÿAÖÌç¯Ãïj¨Zt‡´0L1¸é;jX³?¢s‚ÿI_$Î&wãQâï#«¼$þtýw½.¾(šÂú×>Âž‹ÍØzs‚9 º	[A+ÝqPz‹ÐVHAü#A#Œè(‰	 öÿ}(yï;éH@½‰'­øä[u?Áë,	òJ–Ó²~Átùï?VÃÊ=Ÿ³\ŽK2È!šíµ@z‹4CV`vYóå÷†˜wk»çf+j{@™Ë'ÁeH¾R~ž"eE59}QÄ,Z
“FÂÕ©eâ2œVx¹ÖR¥G¨œÈ©éˆWxƒÈ_¾œú˜ä¯)küa­S0£žéÆM³G¯¥;gà„ìÊÊ8jëEµ-“Ü”Ùá 
€‹çÓ×~ƒP˜Ñ¯&$.eÇüU¦¤t¹ÓtJD8›Ô}. "M-r©>3ËÜh¤ b¹wd’/{šÆ‹6èî}H
SËŽÀt§R:Cjeî¾Å¨™ŸxØ:µãù|–lmy³ qƒz‰7C¯ûdÎ‚á¸?/¿½“Îªû@\ÿ	¦ÔôW3Ø*»,Ô#ÌågûÍbWžÀK›T|dD—pg9Bšã*éhÙjK­˜)Ö–FÔšª¼·ê,"Ç›µ€×£ˆšu¹s;SŒqöŠ^ÝjÖ© 0®˜ì¡b²m)$*žx¦°éBÖÞÓ8Å¦ìÆßÌÜþ¿`û-ª‹n°rø‡9óÐMâÐÜÄdn–åànW¨À9™*"y³¥Øoª¹‘!·KuüËòEÛCÇ
Ó©¿$VERÙCgÝþ”@›ÖÅºÍ ˜æ>KÞ¥yßíI—±UÕaZ¬õ¡£©õá#Xu{[ÿavqU]Š4-ªŽ§«Ã­”‡]ª:$î¶ —·´$I[…Ä®•”ñ–Å{¹T{I~^&§×R5Ahš«‚è;–ðÁÒB	g÷ª>"Ec†ôÔ²c‡”RÜ@hTóœ¥µ5²·3•>i³gQ•ÿ%|±Å8(·¨N†Šb–Â~±X5Åâœûƒ;h]áR«³›ŒoÀ¤ÿÖõžŽ‘ ŸÏÉÔ¿oIRŸ óÐ1—ÌÍ/3ã;ñ5-%?–º kqO¡¨ÇZû 6ùdw9ûðÒlE|;-Ï²õ„èà“.¥Z·Ó¢-s‹iŒ´Àf‹t>->Ò…µöÅô¼Tñ¾ö*ó¶h·Ó¨¦|ìôûÎ;WÚØ“Óõ/­¶±;xD*tž­Ä£LÆ˜Ìd÷Ò‡±›¯8u§žbžÄIƒÁhºˆÿ÷[Q|ƒK0|‹˜\Ãý‚G8]>£GX\N­ØåP…bÛ¹Jºbq…ôhÑüÓãP­U©nÒ¿Á’ëC=´¯º‡DÔn9¿ËVƒ"Ý¹â›øÃàzR(âñQH®x­F¹SBQ…óÈ«Ô€c†”]\ªf2Ùžë!?)ºPˆËš·è<’0{åT©ýf9çÇ”+Uåm¬…D–_³_	Ìõ=ŽýØug]K\!é§ƒÌ«ó0(ï‹“sN¡XTh}¶ðÑh¯ùËiuÝ°êùtÝðòU0ÑòÞ†6=~YQpm¶ñQý€ÐZéŸYá¢MÃ‘ùÒ'%î)8-=DÓŒ£šù)H¡WµðÕs M×§îÕšÖ6G½|¹Ó^/:·¾Æ¯àäÁÏE™w“´³Zšj-(è8Ž‘¢ìroÄÀßPñÃà……Â­ùË|MÕN§àkþ’B±2½ø
õb9þšÓ‘¿ùà€Í_™¸ÈÆ¹¬¡¤²PÒ&âj6nuˆ®­žGñÛ:„/¤QÔ!•cð®wœ|W·a+ãÀ‹€#Ã…!*s?}j,ºHyðqþRZŠØqS;~ì4~,iBæÑ¦)ƒLâªõòD^-j]aQažÎDø æŸÝU†—õÑ7I_£C;nQ£d7˜œÏ±…Uû£èHRÌ0¶EÑÜ©^?EnœÈÄ¨|×%‡ò|­÷¥\¯_‚ûä­¬ÎãhÌÈ?xR1=¥1åxâ!w?&üÑpÌÇÔÇÕš£ÜÐ€x~¶Bë
ªˆÊ%VNñI›Q'Ë”U·Ãäzú9Ååq,¦.PuîÇÞé²{zØý©{ø®uLÚg'çˆêq(Áz´;½~÷¨Ûnõ;]¹ÓSã{”m>,±LÔÆâƒ¢~<·£~<ÐÇÎèC¢¢ÜÞAý(8Œ6¿[ŒäZ0AÐz»/DãÒÅT”‡beœR-&ó[3§Ö9Fx¬À1qÁà;¾Î¬Ãü, wÇ;Hþbò|MA¨}[O°x`=êäÅ×Ê“ÜK"îØ
Ì´bÁ«åÿsAƒ	¬[8zêj­ƒ:óÑ+'~¤@XÒœ5ÒYÎ)ôxËÑ±Iî4›»ÛTì¦BÁà±'õ²-"]”µWg¢8ç8ð.ƒEÀÏ¬æª(2L%
ºSj7›ù)%r-ž[þsE±lJcæ­Öhù·I
ê¤  äú
ÐÁ¹:Wxin9ñçžð!v8î»Xô¢
À6z›VðwMí§r·Ù[ö›úö2êPÞÚ«öØ›Ì0wcÌXj	9„…ÂDož90 ›ÐÍ¦ÀV§ xþ¯7Ñt9ÀùÝÒËž¥§^_ví3 Fù×CxR÷6Gv“6,Õûb%”S~g3a»öê'„ÞçLDŽàA?¦Ø¸Ê¯ÔÕòl>T3KáÊ8kZ[k¥d»£±PXÞnÉù‰œ©•ÎN$¬b‚4o`¥³Ëç#˜æXQh2l˜ç"½Ewz9HÌ´NŸúP8=çÊ&J:V&5õ¹‚–ì6Ä÷it¾(’ùYGß~·Ö#µöÛîñáöj€=Þ»pÊSá–ÿÿ“¡­‘Jöq³ÐÒÅ?I”2#ìr©|èyNVà
Åðœ"6âM§zÚë¶ÉiTa¢¶éƒ•MŽ'“¨[a@eá
ç™“^?Ýj­ßËÝV³ýÆÁyUËÑóg±J~¸ð ÔÅ±”Í3®(ŠDúâ×"~x»-òæ]«wØm’öÙéQ·wÒêwÏNù“®÷"‚ÈÊßéÏÔ >]¥4J'ŽbéáæÜ]ˆêÑª$®ŒƒqÍ5¬‡˜»üª•ÍÌ¶9h×äôSànÉÏÇÑÔ…N\ÇëÐè‰¾}OÙ€Åêøe˜Vf]6vk8i›<Ü’Ð×8,É’­w@þrç(™×p\\O&^\†ŒuÈ§ÍL›Oæ~Y@d/!ª×^eÑ—^ç¸Óºè‹w''­Þ?tbXYÓÝ¤17œiÌ‘‘™¿pk”¦ÞýØ¿¼%CæEa<Ð§AZô³š38e'ABË>0hrË±Zæ¢Ïòësý‚0ÌGx81°1z’\#„3BqŒo0CÉ¯ˆ
C2ëã)õç_ÑfÞ¼IüOþdFñ„ä®Doê|úO¬àGü7½…-Q¼æÒ
|ŽÍ»ÀÑÏeqÉÔÿ_–û€z¤ÜgJs?_Þ+øe`!}kG£ËÛ›£ÏI v3lº…@³¹"r\…*…)#þBI¨¸zeTúˆä¸è´ßõhN¿Õ=Ö;\üó(Á!t``?M¯¥#2ŒÓÔ=OEé*§ÐQµ½Ò(ÝÐÿ|WUÛAÆq ÁáŠUÄ¤v]IÖ®Î•G6]¹jºQ·ÂV~ƒÖ%9S­+å0v½± 5S”¥d,Ä÷IÔÐy(x\ßÙ³;¯‘aMTÎj˜ôÐ§‚¿&#}¹x^VxÐÉç/×$(Lz¿YJZo5—BéôŸÑå¿¼‰²Ý"^š*SþpR	/§­Ic‹LàÌa…·¦\1e¾Ñ²ÆçgÌ.ZYü_“ÉéNÍËqtTêiVÑK2Œ×TÇ }YT6Škë}<o}ãG ç©¿íŸë±ÕYq$;—_†Éiæ1‚+RËÍuC“#Î+%Akz™KQ]_—ÒNÕùtøxD72Áñéœiryíƒ–	_Œç“Ð˜qçR‹9¡R®­½W‰ûüØãæWÐTÓqì_½\Y¼ƒá´ñ¯dè‡ÁGÊŸoMg“-Œá‚’äí4vÛÏ]’yúûÆVþ¸F@Ç‡ój~úÉØ÷ÍE?/¶l«ð"«¦ùC,î<«ÿàÜáJ4—ß‘šËsÎ,D‡w¥““¤&Ó“¡=èm-Aúö.GÃKvÅBq;ˆƒÙÜöZÁÓ0ò†ÀW×SZÍ]Ó“zéa:ñšC=CâÏûÁÄ®ç5ù=bœ¦àÕ0¥c“€¢kOm5ß ‡„u	^l™“_¬ª¯SÎ‰ñ]Ê{U]þ9É¥„´—©ÿ%Ì½Åò'u‰ì}‡ÌšwâçLY,'€>¤JTÑ5¡Wg‚?âÔ¤G+-ø‚	Hî©°¢©Ýa«ßzn—ÎßÏÏzº”Wî=¼üct²Ûÿã&¸~•ì=Ð•Dó—»ºT/»ô[;ŸfaÓŽÁÕ™‚Êo,j5Œè~Ï E2P·`½xë,óÍ˜œƒ×ÝµŒ¿ú·ImâaF„€Š½»îÉ…÷Ñ/Öˆm|~l57ÉeÝ$þ&ŠºÌ’ù[™›6uµ2 +–Ë]‘çšÃ„—úËƒ`Cˆš$ð#ò¹ù©”N~çå¾8†Õ÷^Ê¨xJÀõeò†s{z€3yXíXYY¨-”Në\¥ûRçö‚gµ| pþTuÍªr(äºŒë1Ù™û|1éŸÂ8ÒÑ¶ù±©üeÜ¿<´ß.‡öÃÿsÕ´ÀhJÉ¬…´€¼sÈá¥þQû˜§l¼GÎ#cý¡Îîq“tÛdJ£·›“7¶<ž.ƒâ¾7A<HÕ÷T‚” C<{)øã34x²¨t™1 enáJu•–ŠÍË¯¾.ü«[|{
¥q%±£6ãUtHë	SBÜ)ÂQ–DPÁ$@ç8?ý”ÕÅêSí¿ÿKyéŠjKŸ£õ®Ud„zO˜ò6nbo–—±©Z´¼ÏuAË9°æX2ü(ÅŠ˜[Š0·â¿Ñiy©m-©6þ9ˆ×,(—uÞ€~€ÁU:ŽòMž¨µ­ 'uþ¨k•ùoCIx6,ú$JÃ³j‡¾¶3ªE\äY¤è³8‚Uô;ù® ?.?Šµ2xXN†*ï¤­3neÚÊ÷{…§WBa.Ôµ(e-FUP”ª»(z÷Åbå€nÕNP#ô ©ò…ó³¬s™^m#Â³cüONr¢zeÇ»}1Þ5‚Ý:uæ’ñpG‰xÜxWûj‡N\ÌÓ1¦_¢÷Èrð\ŠŽKQX /Œ˜ˆ.sæy%3ÌÈIDw,åËQ*V„]]Ñã…Y?BEÒ5²ÒbòêS°–Hµ~·æŒ”m2r‚J8*u°-÷æfW
†Ê ÿeq êâl´›EQ7‘µ‡úxFÉ#Š¦yù¼ßú¾™/¸þô[æm¢ŸIRÙhÌ5E6Ìq0¼Žin$Í= }×Hjh34eˆ'èX¬#¡ð_í‘‰ºbL?¸zLû–Tí¢ÏÐêÄ2µ™ÈéÚæ nþl'ÚQóhÊÍŒÝÓô†;~¦Ü+ìŒq!i>ƒŒW~ûñyêùíËµiT¿²¢Ô¸  ÑŽÁùÉàÂ³±a0›¹‚%È§Q<&Á„©ú¸Ð«Ñ€><s=¥aeþå’ºd¡¬3äÄ(NÖ^¥[ikßèxlÌ1…¾ÛÖ©öYöSí©(d5i‘”ÅÝy.´a'­¦ÐÌ'E/Ì‰6c\Å¬Tð2Ä`e!ëÃ³×Š‰ü8ÝaTž-ÖV¾ñ1çÕmŒ½·4Œùƒ-hû––¦Æ!
çÖ‹Fé:)”…s— ­m37=Ý
JvîÏNÁœÙùk_à;°®‚xrè£úÄ­ƒîjÂt«wÏØ©Ñèy‘¯à!™yt=RÏÖKrGFÞ(²%°kH—JŒôž®Ò/.¢î$÷Â~tÁ<í5>š>dâcÆˆb×xÚa¹ ˆÛpíNÒI„žBšØº“ëÁÀOš›ý`í/± €á¤vüÅ÷Í~:½Ê¾õ·¯PÍU8ÔVÝÁoƒª«5ï«Lýz¨ºN0¡ùø‡Ó†¬|ñ½éÀW²öV­Ë®!:nžóÖQ±bÝ;“.0ÆLyI?c¼“ßU¼M¯t;é/XÆfG¥Æ‰)‡UÙZ«FÂÄë9“F–m³o®a	]úM+‡¬’müQå”…’J«ÄFXrÎ¼)˜Ò‘Ì¥‚EM8Æj.êV	oÑÍB67þ%VÇë‰2{ÓáeôIÔ6	ìB<q0¿æ£7¸%3´æ¿ÐS|™¼£þÛÎI‡\ôi©­:×¨?ö'þ£È3zˆÔ¢=)µ¨Y%µHn™iK3:îõÉyë´s|@.:Ç6B-¸D–™³\wÍn¢³=JÃ )ÞSSú)Ö0†5èœ]¹”jI€ÏÛ­–K«Ek“pÎ=œsUŠ‘”-#lv&¾ÖU¡Ê'BrXòùŽ{ æé(¾“&F[}U-4{‘ãf-P)^Îi åüCbH–b€—«†"‡—z×TÉ l5uÇ¤Î<Öæ™9øD
•½jÅs$šzað›ÏN©ÐtÅs/l€‚—1ú †·ð§`@¼Á€<>ln²If˜é„7ÃÈ ¥ yË²¡°0u ü¦
ÛÝxÙÔÏà´U~~SæSé÷´ºdž(ÛüˆiµÛÓþ…²µ£N¾ìèÀ‘·–µ?êírÍ[á½}8œÆ:ˆ{)éQ+H¨ÿ1‹n^bÌ‰S”œÊqubñî½FÁÓû‚áYçØyë›ÚÛZáÆ»‘Fÿò¦#ÃýC?Àý}LœE>õâ_pÌƒPzž`C+&¡Ù2ºò®ÃùëŒö§#zîfnØò>»;Üîì>§ÿ|Þþìëõ_4#Üë†¶,à$N1½Å¾‚'üNÒŠý©ç°‚þ`Œ.] ÚÏçY±ÎNç‡£&ýg«ùlïVlŠök³ÉÑu|k_®×ÔBã|G0äô+Æ@À£ŸiùŽ:‡ß~ÿ÷›ï°tÿ½ñÜaYQo¼x§Í%*Ø'“ òzÐöÛ®×:úáhßqáø½øØ^ç¨óŒ-\çûÃfK¿pÊßÿÂâºæNî¶ 4¦;7†t+¸d±$„Žˆ=ç1àlò%¢›„â¯Gm\$x0]ZÃƒçcvœÜ}`¹tØ¶vVßU¨i’j–‹›­“*máçô€DŸ;]£ÓƒuÂ+fÉ1íSÞÀl¢ÿI®ÏÉÐÒ#ž5¼C«4Åófji.ú^Ð‰	¿úÆwúþñÍÕf•>XTs)¶sÈ‹n@z–‹òK„îÕÔê^â‚1ÁÀøx°	Òî“‘™ó_KY)DÒw0kÀT0A£^ûÍ5B+w_ÞÝI
4eÂ2 ³F»—	wÛþ¬†>/7:Å@¨Œ›š(sÖƒð¥I‚˜^ÚP£ÙÓXÉ!èbDì×­ö_ßôÎÞ’öÙñY´ß]ôÏNºÿì”)tX-ÞlžI‰œkðq™×ÓeíŒö8Â2Æ×™¡×LåF:ƒCñ+ÜsjvÊÃ·ÇÁ,Qn‡†íéiA3³Y„sŽYk?£Cšà)©f*}žª2}ªÊäF`z‡Ã?£FÔŽ}o’{þÙÑNçµËó]PÜO@ýÌ=½Ï?wyú"‚ÓúNVùñÎÑÑ÷G{NÓc‘\`˜<ÂöÎö³í–Ëm/¾}àuÄ¡³³³ƒ`ÒÅ@6Ë«c8
KîuVÊJzT6†ALËºR>.¤Ž·JÑ¢²e-1—D…YiÈ_’O¦ªTömù?:hWùbP©Î~”‹'›[ý¨µ| UébÌùW¬V5 ºŸcúß%µt½-jÖŒ~t¨%Î^ GPBgMÎ;à+YQý¶!ñÉŽöÙ« Ù•4¼—ÏÚWå¸æŠ£´@C!ÜMýØ¿l'¿¥å)ða–#aÏÕ»»sµYš8bú=ÚB:v±r:ªú ­xU]N³TÅuy‰èP\Ç.U=—ˆŠ¶“VýŸ[œ\ŸÐ¯ñH•‹¬ š^§¸õ	-£ÓëMz[™h:*Çþ¤'¬mëŠá/êm,¶3OkT>ù±ERXBUÆAa`äiÉX¬®og¸°ê¿{@Ž[ÿ8{×'ýÞ»vÿ]¯SIßß«¨ïÓh-áy«Ý=}czºháò&ÃäR  U´Ðrq°dqëAI<‚tÈ"Hæ­×¿,­°«~eŽ…Tùœkë—°r‘©“nAãõ”å]3:ÂTjœ²xzdX§Få.”?ŠªsüÃž´7™¸$Î’Ó¿
r”Òut×¸„6•FŒ?O¥8ƒÐH¹ï5e_9%x¶Ë(v+`L+òó¯‘Ä§=±Cuvèc;¨í9Fñ!âm0×y&KiÃX›!øM_dd›¶a>Üîöß~qG;OZþd~Ãƒý;rÊ=hér´ï>ÐÑþ3&¸ÔÖ1[eèÅÃ
âlç‹3úUL˜¥_ö$ÍLÒì¹òlçk· ûÁ$Ä¶w~ JÞ …ÿ>'9§|Ú²rûþôë£}éÛž¨¿2õÿœ®ÞƒÐÿ~éÿudå¯f€«ð:ø
å>û¬'²¯LöG¸pBñÍæÿ$áÈˆÑ¸¬¢êôkµR[ÔÀ&óú3u–l[µ0ôL¹D&¹m”¡2‹Õ~ÞT!7ŽÕªÕˆ™†ñ·OùÎH(¹.YÉæzVíWk†U9Yª6M±}jb¨ ´Ôë¾y›Ö‹tON:½‹îOrÞëüÔíüL;í¿Z«G8þ…k	]
“û™JK¬"B39Æ5[”ÐÞFùZƒmÛ·[{ÕL°në£OŽñ?ç±ÿ1ðo´ÝµÝvxAü-Eð¡lC“îYŽ>pÅÙ¡ÙuóˆÜ ”íL…ŒhJ?`ž>Þ$%èÇþÌC(ð4G+Ébßëó`âS©ïÓÉPÏ9˜ÁyÝ:|Ó![¤{HÚ­Þ¡Cï§R•UáäÈ#Ñìåk­ÞSúÁžáH‹*#gàò¤¼»«lþD™Æ‚Aûã­qp‰Ù—^¬ÎF)~T°BØÁ&ƒÃlr4BŠŽÌ›
9•*ñªQÎnkî­“àÁË“¦*•RVÏÀpvXC&ÕÌlG%!©ø± ž…béyTb5gþI¯¢®Þ|þÜ«¤*Å(„þLPÒn«§V÷&sÔiè*E3¤(êÏQ:ÆÎ3€3…+°_ÜÊ°FÐE
tTÏ£˜¨ÝLZ‚WÝ[Á¡–yÐèúË”¶öêmëŸÝrüîo'­SmáŒ.?RL32ƒŠ\LN¼¬ &[ÒiÏyLüý6Gõ¦Û;¹¥Ý5«,¦K¨M@kCÀŽùi–¸9þ]êA¯»9·7æÜãB¾êÿ¾žQ›úÕ¡è4³¡_ÖÆgî³Žà”¯ïýðë¨úGé=à
ƒ”&*€iê´N;VèG"ZÐþ·˜v×UöâL.p%§;@sD*[’ßk²)@Z´[§´ÆþÝÅÒÁYDEÃµW?wÀX¨wOÁ\¸°ŒnbÃŸÚcðk;ˆaaÉK‘‡HyXMßsª¹£%tñ‹~ç„´ÏNÎÏN5e¥1[ÐDE¥©¡Ï9mùëc ‹6¡^é¤Vš	f¹C.`,éH=;U31ð¬›lJ;7ˆ[É4l£Û­ãéuZ‡ÝÓ7g;)1®÷¾o<Û'5ŽZÕu£˜uwDr“Ž¨¨úÒ¿ï6å9;²¹«:{L´å0å¼56®!«K¯¢xÂ2BÑ–E{ù!x@nãj¡öÐ»ôC«¤´ds‚šÒ‹B{<c^lÑ×8³›Ca‡1ÏÓÒ4/0û‡gSP4g) k7(±‚éöÎ®v¤2l¦½eAÄŠú[(af¹a:ËS'P8¾E‘ŸÔ}Þ”ü#eèK¡=Ý£‘Fè]¼œnŠ_ýíMøž£³³>öëô[Ø9LbÉW(I^:3®Ñ3H$¬ÛÑµüÊ+¼åÆ’ÔSkÂÄønÍnÿBvš;ÏÈÉ?êý¿‚øsAú ÆÅm‚§Zƒ´ÐŒÉ~ŸÌãë¶ÉM6É0a]<¯á§q|O¼yD/vO@ýE1H‡`žÃnš¥ÐNØ9Q¤&ø?$†å¥â§W P¦óÀƒ¹ž!©í/¶Øf¼’·®}Öj¿%ÃnŸœ÷ÎŽºpÎ)á—ÚØX¾3æìkaÚY„©ÀÇÎÍyœ°Kåžnq®§¶sK#geo¸.Heýû‰;wSøj
(GJ})ŠPÚÒ`Ë©Àˆ\;XñQ‘tµq"w´¡,œ3“Ë-ÔD'wÜËUnç¨‘–I¦¤Xæ¿+ÖX±²ÆvSò¯¬„[ÄóºQY³°Âá'“ƒ¢H¥ŸÇÛë¨/ê+ÉËZ+ È9òÊÏtoõ‘žÉ%º¿‘®Q²“ZÛ›N#8¶À4¡å*Ã“^Æ,Y“âU1×	G[^¿‡ó!ÁnÝCu€E¡º:‰Î„¢\¥„æ#>å¿‡aæÂˆn|£CZµŸ{Å™88¥îê…Vx Ç¸W—É·”Ê‹´Û±ø^pÔ¢•>öAtôUldÙ¼åic7æ|ŒÓ>¥ãÜw&,oÈ²3ôž§­qÜšÎÄBÒÁ H\÷ÆÇ‡Ê»CÇ²ì½ç‹ÝÇsîs÷z°nà{ÈŸI*«ŒKW±Ó?ã4>°Ùøm_àŽ:¦¬%frÎtòÁŠFm²ÜÇë3˜
°†Ïèjüèy;Kn¦É|}å]Ò›=gU¸ëÚ$°%Z c‡¶orVc“ö…#ßäNxåAó?ªûºå{!àK6	ŽÈ&)O¢ƒ$öÿ}`£,cóã8ŠuX'/eïBÅïJ)”c6úe~¢'yŸiû¿há×²Qäûup'ìDµº'´ŽjotOÌðŒ—¡g¾´ŸHæW@³CÝ ô“ ÇR•f|“åIäIGù j+•D°ïG›-º[Ã³ˆP=!Ó03j:» +ÇþæÙùTVøéÖGC¯¾×”²YÝ¥T±“¯Ö	dwV`vEn”ò¡÷²ƒ°ÜÔÉ™áî¯îuŽ:½NÇÁíÙÃne¾_p|b©âGŸÿíkô„.Goƒ ë{C§¾	OS“ÇôÁ|¥ez_Ê[Êº›XÜ¥ù¾Ñ•] ´á_Uh‰0Û°Éè u¡LK´Üˆ j‡P¤U«ÉßÃp=Bq°„³'f¤„Ãèýp½üM_ •óûlÎi¯Ûæþž•9¦ù†ÆÁàÉ3­v³qt™å5Ûý½üMOü°€´Š¼
KÛ£w€ö¤;ž6Æqc°§ŒO¶È²¡¾=8Œõ47=m’ã&õüD$ãh@kœ–Û'iDãVI÷=í–ãnX~Gò“?½öIíMD¾#=Ö©>˜’¿žl¸oß”
ÍâŠ—wOÜô´uŽ[÷Úƒ%X^
â0V)(nzÚœ*›ÓàKç¨êmâãYwŠß÷´YŽ›õ×Û(¾D8áPÏ¸NÌû•ø!æJæ7‰Äž7nSîÎÂF‰~)¿Û~ÉÁ"Ms4£ç:ÏÌî÷(@ Œè§‹Xë÷Àtd÷9rÑ^:ÄEÅ!NaˆS£¦£œV¥£tÑÝ6-Õ5õb‹‘Å£¦öó(š$ž¿<µó¨=wçµ?Q{á÷›zM&ÑÙ!=àýqrÏd$÷Ü_<¹ŸF@f©“.¹	`–^ãw“É-‰n¦•hí~²ö
þƒÅ#oü†%‘ò‹'¶¶“sl9R9}Náðb:”Ù;Áoz4ªž„³þÈ•¾‹™?@EkÆ“†¤…Æê8¥TàÃà³Æ’îû
$“ãáÐâè”âÔ¨vøôá(õã)Eë=¤}9æxšV§}ñvôvücDñ-Cô#5ø}µzÝ6º°ØØÖa?a§H~_m 7­“Îž´.ú8_ß •~â%Â­½9Ù ù÷SÏ¯á›%´*ëÖi¿=í¶[ÇÿyvÞéµúg=yÏ`¼yïêŸ-ÿ®Ÿº½þ;xOtX{%†Kõ„Ÿz•ßRQœW@;bE‚²>{fàbqMÖÌëÅüK1Q¡£ËgOô’Ûé€XÒ¡_š (ÇWä_g½ü;Ù¿.¸$óèbŽÝ4k"¡ŒW®ËCï—œƒXvËTHB<}ZêT0¥hi"õ~é‡ÃdÕˆŠ_±¤Ä!,ÄO°4/ÉÌ‹ÿ(Œ¼y­°HxB%t•”sÁm
€HOk|0ºBbà¤YaIXš‹‡²'æNÆB}RrT¶âùuÀ´ÝéU¤ÍÞ¼âz@
«NJÌR±\‡„FžP)súÆç‡ô^Á êÛãŒUDä&}Rb#õÃC¾AbçÕ·]r^JÌ¥¿óWî	þ;õCžl¥å¬2õƒ¿Ê^¹ôÁœ¯N³#²ƒ#Ûù·šâ
|¶CüêÛ“L‹LŸ4KÕC÷Q¡&1Ò ÓM» é\bcƒFìÏB83j[ïÿWÿ­Uÿg³þü—­pÝúF¾ßžòsÐÂÔœ²µEÞQž"£0ºôByƒ`OÕëDçëÒ1wÂœó%à˜aÍÃÃÄ«ú¬ [4A)'½_'Ó€ún°îS‚{¹	ÖôÈÉFCZß?îËK#Í÷šoP£[6	O'F22Aì`ÂÂRË"¶l‚x ð]ØA’mîY¿ã®Å°kxtÔØLÐ#Ñ•jF6³Á1MÁÌŠ¯{;™;eËÇË¦»*ÏYo[ƒsZ·Æ¸9 ºô(§7ªß/Æ‘`:¨ìCD.¼E%(/ÚS2üj“áÏzoZ§´ƒuëð0MWfÃ§ÀÖpø”ýþ”ýþù³ßðRˆ’ì<(qÉÒ©ð
bÿƒäÂ÷½Ë2bµhLI¥¹îº;e lÂ?ó«³?–ñ¹Ê›”í…ÿ‡Y×Ö…J¦jË!·ãàHcÜÏÀ èÉ€SØt7çªßŠ(cÙ&*{kx¥™1E:;åi‰]5”­4D¯}õsés2ÒŒ–)—énk»Y¾Ü<CqV1{*—>ºCø·Wó9=9Lý›ÇI	8±¯‰Ú±OChþM*žu5J«¨Ê¹³r,d­øê*¥<ê>“`
Z
û_Ûù×	$U4 Ð"¢ú^:¹ªY m@QAIÚÞÚ!Œ Ð–ð‹"½ =z*rjL)ô©¹ƒÚc T?~¹Æ§g¢A‘äò–Ö1o¬dÙ$QL_`béæ!¼„™	›¿]ûñ­®Ã*¶w¡ÀµÁø
¢}ˆÖ·›`ÿÈ{âõ“V÷ ·[Ïš -Ý‘¹j3j¿EÅ˜ëí»Í"ß0mzgá:Q¹g Ë}>.Ëk\êeîˆ¶j×¦“qŸ£äw>gŠcKÃßQJv f(Jß‘¿]{ap0Ÿ­¥÷¥3l|QžÁŸáËë·â©átÍ,ïjúð»˜sÆû&=‰eÌÔì­òôQ¯‘‡n@ÓØ9?'<åhÔÙ9¨îâ´½#HZ!ÙÞv§ØuVvr%ÑÄ_ÚÅÅ§oœ	‹Ääæ±ÁÃ „š¦‡-ã*…¥%æ•_¡ÃšhFq]jÔ)ÇÅ·XDdòÃ7‚)œC?©ýãTãÐ-[b¤Ó†Å°’ÿìgýÀjL
q—IßF0]Ày|m †{µOŸ]H~m„þtÄ jC¹¹˜7³,ËPêÕy•D'Äu)U‰+ÚœJ¸ˆÉmtsšm˜'©«ì2ì×½~©¹pÃ–Xof!Q‡=xEš”àwúQgá¢4á£w¸êÛËÊx“Œ6Sl˜¨Äao_˜7©¼ñ;¬©Gfbì6Î-cãžBf¥[_Oq™-Ìâå€T¼(×)Á&{ÅEÕUýîÖÞÿb‘¼ìº'>œ#+z§‰.'ÞLæm¸ÍÎzÂã_¼Š8)€ÚjÌ(¬ÔÑQã¯´öeÌ_6z,±ÅÝa“º9tÍb©¹§«¸”B¨àa("Ù¯K®„‚;ÏÜÉ¯û÷öÅ@ó]51z¬ËK¡õ6þÈöW;=Xe»i"°B‡>Ïm…!®È‡‹ôGRûöÎ.Æï7´}g³9šÛ§“4Jøü©aÓ±ˆ¦JfÑv%þ0¸¶ŸÇ®“»gu-ÙH+‡-4÷(b—¡ý2ÄJÆÍD‰†g§“ÈF…tÞW<œmòÒQ“v?	ùÕ¿}y'&`g¬ª§æBç¦°Šªž—öÓ›Æà,ðÿÂ$â/¦ä›—™•évrU<YÝg÷¾Ñhà¿7Ó	¹ôxQž’ÒŽ649íÅÛ¿ÙåLw¹)fÝ i´õi:ê„ùH}¡cºÓIId¶u\é|ôÔ™Î~±Ÿê¶YlüËºëèp
+üó{MÅ¸’Çß~D›:¢g—‹è·wúRg^;†$ÁÂ«"á%m}EåÈe¹µ"¼î¤¹èô¡´ZE/G½ˆÞê|§‚IœS×^ÝÉŽžû
3*¿Gèñ*&šFü]ôd«òå®·ºßX½»§Ã új*þá)·~ýt«µ^iTìM{·éa÷%¹ÈÂñ3têg©ëºD@y¾¦‰³¹\¢’—)»xñ¡‹™K4vã6W%öK\ž(Í'—Lý‹³jžt5¾,JÑ½Ñþx¡íþjø~£¦´jHm;Eƒ]ÁÛÔ¤ÔëíÌàI`„ÐçqÓÐï›¿¨>š;LòÃé´²jk[¾¡67—¦pÖ¨n4ZS#¡³ú~1ñ)M&Ø+&-fg¡.P8ÞÓJ{çîàZÒKQ$è^¡Ê,rŒý9ØÂêÜpšT·§qÅæO9àÓ]z®Üòÿ§I8FW¯M=±ø9´1bV­<¹DÊqírJÝõU{.ÏDœ8”-Ý˜Í"íó¬„
#nå£¨fúÂ–©Tó¶ò5E[Ôa‘VåòáÛÜßïÉ_O> ½òå,EàÂÊŠx²rú²ø aáD™[¶”—)ÎZd¿a”0#D›¯ßg+mÔ¾€MH1V·úÂ7LxÅÜÆÜy`šs¦¬ «­œÇsÕœÐ–\#}Î—X¿\ÜvŽÙWŠZ{L43ÌàÁÀ?´¬ÙÕJ’`4%j€ZQÖ‰¾^@^'-š¿G†³1ÀžZ‰Ä0r9m´1Vë›òÙK´35rÐÊðL”ã-Œj¢mqlåp‹#œ(‡[1Î‰z=íDùÆÁ<áoÒ"Ÿˆ¿ë4uRµù¡–ÿbæú+WcG™)K³Bb‘!`öˆl•sÓ”l:ô–7Ö+ÎIï¥Ú€[ >MÌÑ».¡·õ]ÂË®QbEí%ãÉ¤`[CÅ˜,9È5åÇ´#íÐå9u«×ì|4+r*Ò¥)Ý7±7Ë<ô,å~»IÇÅ¼ð™!ÿ[’8(%XVË54fR7ŸN Ú³;T‹æÂÞNÙ?ÉÊ†’Slú¡M/G¥ì®i·‹*é™Á9™Áæw)_GÓ‘$ÓªdÈÙ|ìÿý_æuvpÕÛöK¿t»(7‹#âÉ2z²Œž,£'ËèñYFÖç7ÈÁjª~Ýë|íègrYþþ]ýÈª¯Ÿ)²þ»l’ÜÝoÉmbÝü[„7<mO¥íqn6WÚŸ¯³ÝÜ£Û jMç¸è+j;÷è6«ró9‡ýúêÚÏ=º][¾	ùƒµ¡{t[èÖŒÎÛ¾¢vts“*4¥sÜ®¯ª-Ý£Û´šÓ‘?z{º²Ÿd¡–]¥aiÚUö©-Ö¶«4Îâ»Ì®–GFÿ´«ÓÑÿ¦aÝý=ô¿H;üaZØ)‹7±+¶D»/Šô*´³sñ{|íÝžUnk§“ˆÆv«x®.Ø¹Â@ç
ƒœàü¼ÁÍÏØ\@Ü»vÀ+D1s?HðZ4ÌÂ®íˆ§n‚WbÓœþXùêl0mÿ<Ë}™k÷‘áèkAVÜ3o!,jÃ
Kkò{úòâòÀTIMÃ A0£áKç2ß¦jŠcõýRtàŽPWñ!²˜û¿äéAâqá»ìeoí7ÅóÓh^÷pt¨C…³¢)ç!ÇŽaÜÓÁ•_õ#ù€-4¾­–5üA9¬ÔŽCQø¦ãUšÆBmrNý3üþ¬™’+ 	iÜ7¡p²,Þ@èu«ß~KÎ{ÝÓ>ùŽtþ~~ÖëüOëXÝFèy+Áp&Tf2„]DÀ§8Ì¿sO!2Ã	0Ló‡h0´/5ÚYeƒ!¶˜Ë¶*4ºÌ5ÅV~-÷™XJÝŽ"Å²³>)‘¤ŠOß ²þÿ#q¯„Ò•ß%úÛ]úI+8Ô™\” •íŒVÒQ]Ñ˜)”s±íx÷ìfÐf¡w»öŠÎyõÓ,Šç¤{H(+R?--».7O¢™Y,0`…Ýã(agX0|°mªŸ› Î¥Á5Î?Áž>›À8ë±O;Z D¦®UöóÓ7IãÅÖlq•»²2[OKõ}¢ëŸÓLÓˆq›RíÝåE
Å7_[´„–FÉríY˜¸yoÚEÕ·u(Ï0cñÁó#ÂÑýw'+ž£ÏJœWTÃa>ÇˆxîMýð€¶Ž‰£°lC©„•ÍðÊ›úû]Ú£"C‘¹¡ª<{mÓ©†j{3à_ñj™2Þ5•éJ’°:¢E!¤3E2™'ÀØ»ª—©´LXNÞ¾åÒ+Ÿ%æï×W%”Ýht¶¦yñÂçÔšCnñ‘Uk²CÚì˜šìd¸|ù)ëí¤îWÍ_sÝvô7q ¸lþúj•Kð<{ÐµN¡ËÏ)íãÓ=¤]|Ú¼‹~ÂU‹²C1¬?Çž9»ÌµX:}ˆ%q@3]$Ô–†chÂ!gºGÃ2tR=,j3C'Ç²f¹djcß‰£Wé¿tžô!:/ÉTóiµãè˜ôBêˆŽŸ˜Ú]+Ž½ÛêÑµ©’u^CUÔ Z^9£e|¯qCTò½Ž"ì!³±±‘BŠÛÜ£K¾´‡ymƒÞ‰·˜>ÅÓ‚O¼ý^ýáûŸmÆºº<¬†AsLpb[ä5ŒþüÑ1dkä+¦¹Z¶äƒ.È™üé¯œ9ùWºó§7òßÀügŸGM¯’øô’“¸;«ò'Rn?¿Jÿõùy¶ó	„å†6fÅ`"1¤†gïüO}bxN®;LIð›on‚`w4húÍ 1Ç@±ûÍfÙ… þ°“ó8°¶7JP
|`¯ik)§ùBlÎŽ†úÄ›‚qÞq›¥ïœÞµÊ®²!Ü)¾?%VS9¹´¼²‚dãÇï6›rµf(Ý—Fºï4VŠëU®kt*P+óž ¯De\šœ„ é¬('{©Å©‹ZŒ^<ÝqF)çÝ6þ05Œ	•X
Žˆ{wBÚqÁ63w…@4×‚ºIÑÖ=ìÌÜÎôú»Â}®}ô
¯jCá-B"ßÄo¯ü2fsñn|ìeëæFYK¾Ü ®øøüfD@36Çƒ{‚¡ùŽ_ötMñLmÔ,“5µ¼»O]Ýq¤!`cúÏR\$¤æ
¸Gw<Ðg©A-ö›d6ATÀJ1¬@
'1˜ ¬¶©ïJ:"V(HÊk:ö’RûÆ‚ÂâI=É#ñðŠå‘E™xñ­6Qˆ>¯±lÕYŒ:¢c§<Ä\?bšÒKòÄ¨OŒú¨U÷Ö49G¾Î­qa?F#?>IF5„…îr[MŒGÑ–èúÓQc}“¬ûqÅë†¯dß¢ýÍïo‚é0ºiÐWé6VÓ KéÈ‘²f"!Áü¶þ\J™É´—Ù-[~’â[`Óðd†I.X9¼Ži¬¹¾Ól;vYÃñ,±FXGÚŠOÔ¨!Ê ¾)ãF¨;ÇÞõt0&·	L—)<&9/ÌÓ'ùû$Ÿäoù91#oØ
CaHÐ,Œ¢P®&Õ²ŒØ 9äo ).`\²
Ì±ÖxpÆøŒl±0S,ÅŽ!tì`e†ÔfÐ'bW¯d”|–Qþ”.Ñs2ÆKõ†ýfö»ru…[°qõ›å§ñÌ7Ì.[ð¼.ËçÈƒb,ÅxâÐ^; æ’K{½¸µ³´û—å|ãO±Œ¾:MÜ#Ø=*i4VXi­ïkíÕþçq4‚A“{²EÒ_ö£¹Zpy+á&çYI¬4ýÝ˜nM!)×Ò‹Êe4Õ§yÃÛ”ï	2ÞÛÞoRhIæ·¡ÿòî”ýá||€kjÅåƒÕË-Þù3Ùn6ïÿçS^}¶Ò"PŽÕ"+m/.Ù
~0s¯Ð<Þ}Urïö~)¼Â		?ô)÷Ö15³ÊóIœi Fí0™|¸Ì…©†ªÖùO/Â€æÅª»½jÅš°]Š‹w ”hŠDZøõu.!š,<À¤«,µ_ž­çº æ‹0xÕ™¢”~ŸÇÑtôjí5(#ºd{³q0HÖ€™Ù_ÑYÌ2†/³ÛQÅX:$˜@<Ç4`XûÆ>ž´â}gGGÙè—qt“À
¥“a	òlì+ZqW˜Œ÷1
†dâÅ#ÉÓ(H|ËËÛã(J¤ÏÅÊ¬¥=?<Ê<ˆ&3ì´‡ÜÎ£á»á¼«!ùz.‹˜€ï³E¡‰Ö¶ cŸ€N]Ï	æÖb­aŒ¦I:¹\ÚëÉ4É&6ÀÔ¸“æh'ƒ IpéñÑ¯ú‹­kE²Š)+»ð[äøöÀ)»ƒ8
Cú¹aðÿ“`–úyìü‡D^ždÌÏÐeò­\”â Ÿvlò‘Vî¡ŽßRˆ{µDÑ†ô]q¥Äµ½éGÏ¤Ñ˜ÌpFƒµWoñà#˜PŽË@›Üâh%0)¨Pº—hå»«õ æÑg22‹6‰•9¤Ò,ŒfPÁRËjY=Ï½Öž´l{GwÖKx^z½dœ¶¡/enèŽÂwIéHJùÓt·I&ŸhQ„Þ€)×ßˆ"è,6{Ñ²Ìá€m8b’°ÔvÆ|ê‚Í+°kkˆ«ÉFÂÊ9Ô+1Û›:ób¸NÔKºñ5z¢ºÔ¹†„WÒíïc%Ý,ÝÁœâçl=-„ïÒZŽ ÁÐV#ãõ”óäL×²QgL­ÍŒ‘±lA"RT`ýžLýdÙ8—~ˆü_õô£H8#ìXi
l±A®?b²‘?ïRGïýM-+6ŒaÆ<ÉxüæŸ‚wÔ0{æ€¬JÖ	Ì.™Ðÿ]Â>Ñ„#ú¿O!ýßÿ?(‰ë›dè_y×áü'tTÐ˜AùÚÿ0¯¹˜lÐéù>/Øs›üùW03Óó„N¦ý|öi}Ó|#|Üˆ†­íNúÕxï®ý^X¼sß~'¬ÞùƒýÎvëÎŽýÖ]~ë3¸Õpç½ËÃ.¼G"øÉ3ÛS_þE×ÈÒÚŽ]6¯a	ÙfLy¯£ºM{xÕ¿½C&TáGÈ—ŒÐ!jÛÈˆòŸÎ­„.Ýoï$!ð#Y¾YPx°ýúó}’xs|Ä¯ï7×çù’ÙŸßo7šÛ¿¬›g§÷•áÅ|=`\d‰ß,‘…\ŒQhÒ¾K«*ÓË`°ôrT¿áXÚzÖÌ™}â‹›lµêùØövÓ¥ <[`þœ¥ý˜C¶¸²`¯o‘éÙå7’y4;ÕÌ1ü?ã!(.&ž®gCoNO‘ã]:œFÃC=£-ó)ž]üí¡¶ã'»î‰*FÅ—xÃa…78Ü£L•çosx‰Á+®¼«M“çJÇF¹DX`°©²1@@×I/I©i¾‡sÅyñ²1©H’éE{ì~mñ ôqáh((4H©ýL´í­ØÁoµ/9¯ÁÈËÉî”{A¦„Æ¨`ä70¿õÄÚÛtów8tµ3ÕÍH«ÒÄ'¢%p$rÌÜ€UÅ(–¿³~‘`Oí±Bø"HÌÐ@Þÿi{gg{»ýB¼ÿS³µ½»Ýü¥@—¬@úûf³$õx'éI–7íÝ²°¥EÉtH`w\”×£w±!H—[;©:AôPwþƒ5’Íb7™³»;Õù€|¸ŽÃÚ·š©ßo`ÜFŸYdnìx„“|‚üé°>­(˜…·†ºué=Ö{¬½'ml¢)â‡/ ~ES:ƒŠžY†êd% f—Ëü
Ïà«–kÂ
1k‹Þáz6ã±H€ÝdÈpc°Ø¹Ùå kÊ]2T-×Ø{Öršâ¸þC‘§9KÓŸý~?`=?qU5pmª‹}*9°¯EèÄÀ[;’Ì½xÎR@ˆ.>pŒÁƒÜÈép¹q£æ–ÓªŒ½^ B“#_÷ùƒ™VÊf$LZ&Ž*õáÞE&°KcàÈ@y\I(‹?Pà¬lóøz: )/‰µ+nvªj5èv'?óqmý¢ß::ª¯s÷Jê/ ËNÿú£Ù3/Nüît^ËÙñœÄ6É:Z››d»¹AþƒìÞÏ>}€cÙí`<àÛO ~‹?]Ñk„í+YO]ûË—+Ëšò×Ê4×²XBoÎÃ%|‹,’ÖX¶…h¿*pÂTÇd›íu>¹…ºb³q4~Éèkòbœªõ´Kv*HP¯^D/$@¹Pv•Ÿ•dbDÍ†íŠ‘0š†—ÕYîFí¦SŒä:Ï—‡•ps…˜Ò^ÓI‹KGu—BEd¡P~xþÃ·XÙo%œÇÀýèO+á:VuÏ~¬ÀtR°ôa8.n¦ÑADvÖœ&‰ä4I!¡0!0Ø$Í<eˆY
}Ä¢Pw¸£bêjD5åG?
ŽÁ(ÕÃs¾å‰cÌW5ŽÉæ-àö\u&°(Ç^ÓóMÁãI“L øŠGÁìù€†«±e8MAµuùž%8.ý¨'¶3_ÕØ®h.SzÞ°æ/føgzM¢i„æû6Ãsmfx®ÂÁêÙôp¯u´û½`Ó`XÑp}|:ñçÞÐ›{Ï¦®Q‘;eþ“3}uVœÉšPuìR ëR“[ª %ð
ªÎ#`Ì!áÝŒtUziÊ!•ž"CUp*aä#ó*m7Ñ­´YõÍ6-²ÒpqÂìª²ÿ˜‰Öð?iUyCU7X%ËÒI¢™²ðy©âGåqYÈ ÜI£¤,wú9’éyRÛêDu=·è„Þ_<Ÿ¥®lïŸ•jÛ0©×¥Z´¶7÷GQ|[•Ðuö‰?®'²­º½œ­ZÁ‡z•Ý×•øöñìÞÁW¼wŸo»Ftú”ÍúÙG)ôu0Úý–6Îé²}‡g¯¿XFF—»MoGý   ÿÿì]ÝrÜFv¾ÏS´—9Zs†’¼f‘rÑ$åå®H*$í]Çq,p¦93˜0i.Ÿ UÙË¤r³¹IU®’Û<O^ û9§€ÐÝhÌ`F#™SeKšîsNŸŸïœSþ”í¨?FÝ°çî&ç @ø‚Í§#FÍdÏU_µè>#
ßµ#Ð:A·–àu×MlA|÷$!¦Ú©©BîX­¬'¼ê¦×ÖØ#œè>¾òØÜ>¥º&ú£ö»öF3Û f`ÕXQXÓ›-ðlõ3µ‰ÀùÆÁŸ–ç•û’9PN“ÆÁ,aÊ«>·¤1MQæ\TYñ-c.ë3ÿîü ÖàâÛ¯ëÙ«¢¸øë˜í~g'Å¶×´ÿA¼ïÝ=Ù¨y[ B&Ø[9©émy;',|ïŽ%3Õ±çt-Á]YÔ (0þMç0ûôS]ýƒ²'ÈØš]§úÅÓÆZiÞ«Ê¨}]fNrÚÏ;k§=­Ò tîÁ˜†û†Ï¶\ûT°iæþ¹³#ø21è!°*ß·äL¹Fð¦ü¦Ã„í–ŒÓŽÂhè‰&eß?í<-—–™âýØ8Ê¦!¨5™Ç±C6:¿~ŠoxÑ­2	IÏïc2{pK@Å€˜ÜMAäxdÁŽÅáhDƒC{‹KgµNÌëPkE©î+!½¯PyIÅæJ\Ææö†N¥”jMhøåïÜ»¦²~©í³Ó—ß‘ýó£}òâìœÁ÷÷Ï/Ô†©®mQ¤ˆ·.MÃS\H2þcXo¦;Úq7bhÐ^†ðÇÞ­¿··’–aùh ËJÝÆÚUë$Å^ºøçmû×†éR‚´6-ú‘%Q¥°S¥Dé½4…™1{W~WJ”þôSËP2!º0ZNtè¢ƒæŸÙ lÄ%Ú3•9Ðƒ™Sš­C•FrN}6ûøqnTk"óiÇÓ'kzŸ‰ÅÓ¦W$W¥W'W¥	W%W¦Û5é¿õ’~Ë©¾F«Ñ”Ö+“yÚy*¯-‹·tµýL&]ýzê¤«´¹LÁÜ„nY“s[–[Ö¹Š¨÷¦íbP\Û¼HÖ¸¯]þÞ­Ïyí,-cfÖ²ecÍ3KŸu¥U|t
Ïb2ªšÈ¢š*sÊ53±RfE5™	ÕtöSŒ§F³œæ•Ù”Ã¬<$9‰Ï<L7g)P™¨TK,$!©·®N6ªõÚÍ%5”HÔLòP„¡JdŠ&1èœ[K•Ô\2Ðü¼2ÎD^™ÐS‹Æ›HÜi “ÕË{UMÕsM¾1”UÙ7OÏ¾™?¹VfÓÔ"×&²f>>rý`3_æO~n™,óÍ^©Eáe©||d¾ˆL“¬8ýräœÌŸCœrHæ’7â;YÊüÇœ…åÔÉýXl¾ÇÌ9•yåŠó7\¬úJ ²Šm­Ó`¶Œ­\[
ˆÂ_Üqâ€"°B‚?_TòDM÷ÔöÅsË˜pÁ;¼Çí¨“QÌ^Ìú×HXòÕ¯“Þ°”¬P7§aÉ÷Ã9_aYXÁ5Ia	œw‰õ“˜Pð^’fJ¨Xçº	Í%4šPü_K]ÿ¢€ýuÀü øhÿ‰Ã¥5€úÓ€óg|4¼ Û?€í+yÔ`_ÎÙœæž}ˆàú…«:•Žp=ìÜ0í×…9åt‡•Ÿ]_Kt7(ÒvˆxÏ>â#²Ä#oÂ$žgžÙPhßþ>ŒÃ±ò/Ñ Í<Â‰f–;¢™.ñ"ÄQ±ì­`ƒ£Üñu÷}§ÓXð5òº¾~ÅfþÀÀcš†YSc„§Ekyèàé°ÁVd°\…
¶c‚íˆà
<°\Â×AqÀURæ`Æi¬8ØïíY$ç—ä5#ù<”ä¤¿a<|qí¦Ž
s/‹Ëš aDx¹ ÂóƒëÀÁº6Ü‹@ÏŽž\iý-ýÛ ö·9äo³¸_wÔoƒ˜ßÄïâ¿fn²©ÚE[¯f×ÆùÖàô`|g|×*to—m
ÙÛ®·	T¯3¦·",ú!ày›BóV˜ÀódÛ
oJž¿;s`¿°¾[P¿Šv!¨ÝyfZ·aÎŽÔýxóÅçÎ“Ð\p¹óDåÖ ä†¹9ÿòp¸óäüíÐ·3£ßòÖ	w» Ô­;æv‘ˆÛñ¶hÛÊø­ÒvÞ¨÷²}YðµÏáPXLíRÂk j«Ã»ïmÜ±´ËtFÒ.ñª»ch—’ôë!h—x±³ËBúnÈÙ÷è(«ÄËÖEË.+û²3àd­«[#ÛB¶A|l-tlíñ½#cƒ‹uGÅ6€‰uFÄ:ãaë£ag	4€ƒ}@Á> `ëT|xÀÀê–hQJK…³Y‡{Õ>\óenê@¶ªÉûß^’ó£ƒ£ãW—ääìpÿ¥
ci@»	íaAßsÚ¥þ8±ãY¯ýàúvõÔÁÑ7†CGŒ×.*À$WÁ$B‰7ò‡(g®½…‹¬…“íe^'°
CïNx8õ1æ­›  Ø·ŸP‚»´}[ª·\Z¼³ˆðÊv®ÚÛrŽWêdKÇ¬ÞN)Ä1ßÂš\ãø?£øZy®ÛfòÁAïAÊÜ2™#~ÑóRFuuåŠeßŒƒÐÃ3ÃK´„×™ˆö?ëùäj’$¡ÆŽ¿ûfï®Åê#¹^”ŸØB>Õ°dñEÓ— ídKäÈô³­ñ“üâÉá]%I2b„Å~âÃ„»dQ[ ¿«Q»ÈƒžPgY9Ù]ç+R ÛòÚUÒ5(‚iŸdÀUd—qZ:7§£ºH^NýûíF8È›ð¯§ü_)ƒÞ¶½I–ùÃöËûGÝ=-1EüO„––ïò‚do¥@öÕQ=V™IEJ†¯~‚gËºïŠž].éÑkE4zi"\#lË¯Š¯k÷Ï]ITã6³Êké•_v s™b)AˆŽmAÑ×·?±Êô®.m­ÿCüÙz
8öï;ãQßÌF”i*ð}Ä9N(í/6¡(í®­t?n„t«\X&XÙ­´6ŠupcSáõyžÞõÂ¨Þù²»î-\ê	|W^øiÜ¢<t]÷º«{„1NÒ¹ç_’Ë³oÎO÷™ÒTV–á»£žŸ !{ö¼`¾ªÒÆ²«JÊ*R:Í‡TkMzD¹|øFüU'Ú[¥ó3oj©LÁ ‹Hï"Eˆ³ av—bïR8>‚¸Dãƒ­Y˜¿H°-æï˜RãÍQ2.FE U{ÒQX¿¾ZÃ–nnjMNµ/*ò\ÿ|ãíàWí<ð®h`ÜÄœæb:ôótgS”1)$ÏÞpËü1¹ô“€’_í®³j&âÆ“DçüJnÇbSµ¾1á¤£‚J¸A ¹ˆkàúpi‹Jò:RnjÑXó}štØˆÚüÎÜN3‘#Î|’†ŽrŽ°s…%@d|v'ñN8I˜‰åMò¯d7Æ¥¹hèKg\,|Ï¿¥£É"¶™=§ö>³»>Ö®lÏTôÈµYes¤‘–ütˆ‰7fB±‘Š$–žg6ÈfpÁÛèos!—e"­¿ß”˜þvÿ»…î=<pÊíw~¼°$‡Æ9íû1üÄt2f)UQHÕ1b¤Žm¨Of6RŠN´£|¬ÇÌ‚uÈÐëÈ:¹¤ÞìO’‹(aœzJ†|Tm‚7~|4àâÇc. z”¨FVêm-9üÊ–ËœíE³ÏÇè6/˜â@äE3R»}©åéà0òF]8‘.+äÅ·£.ii[-â±JTJ6ªüÓŸÈ£œÒ­ûåî{q€ê~’,"~3A¢à×~ŸF'q¿µú* Ìâø#âÁýãÄ0Ó‚X]#«4ŠÂ¨Ü’xxSÙÔñ&MÆxœôÈü{8¦	ÛÁ˜U3èâzêÕ	úÂ{Ž{äKb„Öw:®Þ•¢Ù]ÓDü¼ÅMÊîP÷Ìt¾^vî˜éJÊ74»Xì°éúHw2fwkN$dÃk`™ži`V+a<Ù`ŠÒÞxOvHWó‹–Z¼wžŸØãÀŸø2¼HÂÈëÓ– íM!¤»\¥oÅ™&I.žt»4ŽñX¸eÄ¾ÑQ¶&Ï¡J¾É`D*·ni€®$l™(Êb®Ž»€•#ü,»v}Ÿ½8:?:"ûg'è÷¾<>;%‡G—ûÇ//ÊŽp¤Ð5ö»ÝsŒ_QúàW7Wô7¬VŠ²hú¹ýB|ä'Þø•?ªï%
‡CÌ¶¹ 	’]ÃNò£"1Ï‚
XZy‰@`«QVºP¨	S¾Z^¹©£‚2‚Dš7eÓÌZ!“0§…wiÆ“È˜²¹´ò¼,µ:Èí§<ÇÞm|-â%McÕ>cù]œÅu=µ%£æ`:F+Ï_†½>Í»H¼dƒõøŠ¡(hÔf›ÑÅƒªOè¬jqVñÊx
üèùÖŸÏ¾µúW+}Nw¯3CP¹ÎhT Vµ_B˜3 ©:€Äw0\MÉ*ŸM(¬E’ŠøŠ¿ûª'i'ó;lÈÌŠVÌg“M§LßÍ[´üë_þüŸDÒÞ¹´LÄêèÆ`Í±ßæKS§áORð
å¯`ç‘¤6S’Ê¾{"ÈŠ³ätõïä4d¤EAš]Ðàº½E¨X#}áfÖ"/›/¸^`i“ÄÃ¢”,{pê³ó:~&0è«(|ë#ˆ³uèÝÆ+ƒMvô,8ôG{+úß7#5›ÎEÏ&?£z§[„‚Ö°b4Ú»ã'"}AiÜÅQàx?ö`ÀÇr•¯¥Ö8Ö´;äï ³:ŽÁÊ˜®ÐN¿C¶V
ž 4áu‹è5©/Ê¹ÏOEðšà
¶Ä‰\ŠŽ^O3GçÞ7Ïh÷Mûl"âµëðÇí,,Ã4Y¦`Ï…Ícñ˜º|¡ÞÜ(ktÅÀ?¢wÆ™rw)Ì°ù”œuÒÚÜÚÓçÕÉãœ9€tÖH‰X*2¢´cz[!Ó©ÁËk~äm~‹#­3Pà¤¤æ#g÷"êi9
ßÅ{wÛ:
ÉsŽxžîBËˆ»\¸EåNÈü`ý’ó÷uÑ•­‘ó0’'[ÂÅˆ?‚)Í­dÀh¾££²Y	¾6©Eb¢&ûµ<!]4ÝÍ²S”¢ô*ðŒ’	¡åÂôƒðÊH †ß,/©†ý€’o“—°C!Yœ“¨äFÂOž²ñ)øš¤-o«MÛƒ$Ç;ëëC ãÇ~vúÁz§Ó!aDäÏ}¶àyv%þ<¢fU·›‘ã³ô+/Fÿà€uï|‘8dßKéŽ©“Ô‹ýàhœ—YP®Yˆ\óUÉó÷"'×ô‚âÐvƒ¼‡íG¤v\¾ª6¦ëý<ŒËJ•õR›‰ì‘¢&ãÔhó¬bº.Wç[Åëƒ
—ÚDú8³úH©ŽfOTT%8®ŒiTÄé`óÎoºnü©äÖ5V=UyÙÉ;^œîšDz«øwE:7„”Øéò‹ŠArƒ¤¿SÜtëê®ìöNc©õˆx™4p,û2|áƒŠ‘„Q<¿`
Ú/××É~ B–€¡B‰‹zçûÿø×(jo	½ñc½1&êÌÔw]–½þY¢Û÷ÿèµÞoÿýFû‹XÆÛêãN¾ßÑè ô‚–á5øcØ4øèð¨Âd;@ð½–‡LíÕ}(ÇWð—0Ì q-ÊóÍ•wJ{&&Ø2×¹C¶Ê†6‘Öt,ÕS5ÄV³0ÖÔ¬…êÔ-ÐûtEÞ*Ú¶hñÈ´Àù ×ÂŠ@ÂN\-0þLÔ‡l‚
ÉK­•03˜R’rº§›úÎÊÁ1õ“Tß<ÉŒm†È¨ÂJ•—ÙŽ2q”hµÊD8åÍy®Ñg†CÉ©ßÛAÃÿµ1{v}Ž\œ4œÐ+gû¿!G88zIÎ¾>¾¸<ç m'ÃÄÝ€æ•æpº6s›?%×õÍšßÊåÉMšÐþ&¾¹×É3»^@Û“ñ’ƒ`Ìõ­´‰ôn¸–ò cÀl\À‹å¶„]´¥¯´µËËdÔÇÊÔMRid¨Æ¸‹¸'ûçaŒëx<‡‘N¥ÒAxØ÷:»zScWÅº¼q¼$öIÍÛ9–J,¦K©Ök4õù©íU-|éˆEÒnYYD$¯xÝ+¦$¼â-![ßÿ`½ø[/ð¹¨>ÂÍp½ý û QÝ(ï* µÐQÅ<béI|VâŽÂ?Ù3:&›;ä’ÇXm¤!Š¶‰|mEvô¨…[òò;îÈú–ËÛ¬Áu%ahÊ…¬o<qDƒÕ "0‚»câÊV­£BÌâg³C¾‰¹Cîð$…ß"Oî¢^Ä=™AÄ¥Ý°ó h!†Kß+œD¤ÇçÆ
¯õéˆFLWç3½¥”P<ü ÕÛw~2€ò1 $qÔ«1jFÐ‘ŽX_Ú5²ß‡7ö±#!èÜk#¼Ø0a¥A-&_ÃÏØï’$IâH(ü•iÍíktº¨ ÷GÚE«ï5b~R9ª{/ rØBÈsË-^xÇ™\9êSY&ŽõŒ€tÇ>¯¤øDz¤­Ð 0ALúrV…Øeµì"ÔReÝr6¤XÐ&h­ÎMß<6U6ú;µQ›Tdní°’9DhK_…7SŠ$­.7‡*‡¶:r®¨_`ÙBÉŠ¼ô#°R’”÷ºb±ÏR’TÈîi±†×3•ºØ›BJ[›b?¿¢V/&U…S@é¢Ç)€1NÇÉÞ
#Š5‚Ax"$Å¹6Sø2VûK=b‹f­²nÔFE1"üèéÝD\ºnÞ¦s¨Üa»ÉnÊ{jÏà´Å¬½ÂÚ—OlóÚœ¸…¶‰eY³-/ëÆÂ¿»H¡—x×6JØíæêš¶ÚìÎpqþå>F{‘×WO¾(w!-Yª‡º‚À‡	«Í S'Æ«QÏ‹zŒÀopøP#8Æc)\#JÆáiqû(€ÃÐ\ïÕ¸Ž¦Ñ÷‘ŠÕí)”°nl"¢#£.b—ŽGpTOº,}O#lïhÉîètÔ½ÍúÔé>E1ç$«ª˜×i%×m[S‚Ò§Í¬uÊÎl™íˆâÝâ`3ìeÑ }‡F‘bÉwG·|»ñ,¿•ç¶:ýÒú&Ã‘pÁÄ¤µàIƒižÄÚ¿H"¿›€b(‘Özl£:k¥Z~	zÕÄ‡…~é‚\‡þÏ”Ü¢.j…Ê=k„ŽÀöá:øµÁ¶°ï%SÅü‡}¨È`±¨±& l,èKbø¤A—¯h¬ÌƒM¸NÜ!'~ŒWàtüÑ[4’9¦"u–³ëM„€6*…è²òúˆ+ÆÅo| ¢^ÇU±uÀ{%¼ð¢l€ã9c»è6Ù þhývŒO¯`¶ö‚ÚL/‘e9U÷€yàT&ŸýÂî®C›pžä6ŸXÖ»KÆ,Kú’Eg‘1Ø²øÏwAÈaŸrkCêdPü+)ð{žƒNŠß¢õ„ V¤ŒÌÕÏoæÙ¼­NîÁ+'pÆ¯ ¥®¼ Cö÷ücõåêúê«UŒvÂÞíãgqz~|€ÄÌa<õróa?ŽžW¹½q¨ €0«™•Ï”gÆÀ¶°_ùœ>ê´öyÅp°l¯Øo,@Ôú>í““öáa“ësŽ.hõálÖÈÁ x$¦k@Ý=ß­áú¼™ÕàÖçï®O´¸áJëCà}Ù²y?˜\-3ï3wHnk•äópŒÔ¼F†,Ã‚~éƒÿ9–5Á,h!\ÍÌ{¥¹EÑù	Œ Kuƒd‹>^|ßð‚xAO8|®êH2ð,ï…!aF)>ü¢;C<ß{× øÌ}&e”ÈæOâ@”çI'qOïú(»üV¿§…Øá5òÕWû›[MÊ­ýìe#®³LPšNÈ@ÍxÎóZëŒ±‚HçÏ9£~`1h&øâ„A±>QK@{3¿!l9^ˆ0Ö(ˆí¯:…ˆ¬c>egùamÀèA=ñ÷^„ææÌò@ŠÁ/ÅM¥bÔEZKÏkØJh`–’½$ìæn4˜Lè-”;çd<9ÅIS÷»CKœ$*Ýõû’?ê(‚Í!)]’ç œgk-w¦eÝ„{£¿ÒFHv_¾ílÉçXkK}ëËœ±‚É
Ò!Ã²R,ÛCàö˜òÛ01i}Qø§Fí&(»†¨2³J1©˜ÉÂý!ÄësUÄÉHáð8÷‹0<$€œnå_$MnnÏg«ñbØ(, „° 5â³ð©©GWÚ¡ëÎ¿Ï…îÒ§‹±)ú}ùS;³Ö‘õí’†«ØySïÀ–N†ò7÷®rÝlPº–Çû’]Lý’,Úãc-Ðv‘)¯"úÖ§ïê¹“œdMçPÝæ.&iÕ„“©J$¹‚"¨ ²e^·{©²ÄB¨/òdrúh¸@qÙ«˜[k+A3kŒŒ³ÏVyÌ+"ì•„žÞ©B˜;C*Ý„‡Ý‚²‚SÖD	ƒ”#‹l=¸’Ãì"a,»[$‹.‹üJ"M)¶Êš½äxyë¯&(^4±½òüow×“AÝ›R§Ë47ËfÄõïdÎŒuÂú¹Ö¿›Y‹ÓÜ˜ZbÓÜ¬šSöûá×È¬N[)k7¹
õ”gÏ|á°‡N`±³}'{ïÆz¶ó9DâxïÝäø2Æ´áªî–I¯°’Š®ÁcÉgdNÜÄÂ¶Á‡‚zž§@´úcW¼iYœ³v¥E•òÙ|?I›eó‚"Üë¸*Š‡\OºƒØ÷¤ºÇ†ß¡ÆŸžêÕ[«¢NHZÒf³XÂ&·Rúfµ¢!=ÿdm¾«VÈ¥{ó4Û®“°¶³>
+lžØÅ„§ÒyŒMá§Üè(Ð•
U§!9>ïu_Ù½T>Ótè«¥¯Xé:Ób“Ézd»ÌfúÅÎØV4ÖÎs™ì):Ë^†”=,›Už¿ùgä[¥Ûcó&=_Ü‡BÞäTa
MÓn•÷’º*U|Þ7Í7àÌ¦C™érT5°0‹¦œ‡Ÿ=-)7–à´¹%—Bg…)kvT³g‰p×Ì×4Ib¦îgzxXñ2íf¬¦ddWs€lOÚ®	Û®ÜÖB·Ion	ÒÎ$§‡(j³§Í3Ó¶÷üÅ\o¯äç»„§:€yd(· ŠŠƒptíGÃŒ^øÍö=»{íš2öT³³3%)¸—Oê/jˆ|÷$EßÂ¤íáôiéyÚXÕ|ÓÅ]éYzÓa×hÑœÓëˆÆƒƒw:hxšó4öGF¯³né,:ŽM“ÜÕŽƒYòuçÎrBë8ÈåTŠ«Éâ7¾Š®éµõkýª~Yk¥©ãoÏŽOÉÁÙé‹ãó“r~ VaÃ–.pNõ­ÿ–)ñoÚ"Ù$þÕî(®å~)EÔ¶–>"a»†„÷œ?]-µA"5hÀº‹÷ük[MxéX¥Ø	ë§-(›$Ão3iòPS¼È÷Æ>œ•l*dè¶"lÆ×éÞg‹s˜2?
 ©|´›¥’¬<Wƒ5±„%L‹›r·†QQ&èÉ3Å"@~#J½ŽÝÆ¶Z9&¹4õ;ÖDå^(6eéÃ0w-³¡ÅË£x¼ÐÈJ£Lb}Yã&­åÅ:‰9>ýs
ÝÅâgƒÚgË•˜Å~‡ sû˜ëä¥¨v×¨|….;g8™Êgš#b;Q6!9´3VNÃ$­k¨jwê]ºtèÇ­’@_ÞRƒšw’g3FNyãÙÖ×!ù¶›Q!¨"¿;yL~¥áÕéªšë=—kbn>Õ…¬‘/àZÑð·ùÛ–¸½œª[</_àÍ¥ß¦/Rè”i,1E^Ð°,O	ÖãÈ"‘9,+ÏÙ¢´“Èç¨ìq†*ú0&ƒ–
²Äj=,yª–J\'¿÷~F„·	Ø£„8èR‘Þác¢í"²\Éfæ­½ÊÉ3WÝ&ãþ§s8¯?Õéúãpž¶‹-¤Ì%Âª÷ÕáêI´\üÝmMú¾Ô£Ïl7ËMÎrÂÆJ3…­’uÅVÜâÞÚ÷[šêâ‡9V‹ù*¼14×ÅßÛ[A	Ö~Ã×IŸÿŠ6z^çx”´„ä+Ì«)>'æ@¦E*ƒd¢P<t›Ì·ajuÁ&Xv‘å¢ÆB–¡t‹T•0†
:aYÁ£ÄX7?fç¦A2^„Qai]XWtLÚMl™»øùë_þãŸRbo]À&áKêQUã?µ»ÊÍ×cáÄ¸Î˜]ã¹†Î*õHÀ,}YñT³§]~ª»°ðÑªV©÷ÄK¡wÓÚ\#ÖÕj“MTÚ1ùqÔo™cžøÑøaO[jç[˜¤ä_é,ScL7ÎÊßm›·ÃÒ)G\Qmnf	¢DÈ;, @Óª+ÏïÊë}ß«P,šPZVêøì#¦ŽÏ¦¦8Ø‚6è¯Âp{ôA7ÐRÝ`Ì×i
Ý@¬ðlº2ÈG§È¥«nð¿ÿúßÿ÷?NÉ½…õâ¹«Å½ÿeª*ñÚTƒÜj=¨†+šS”õ^Õ@%”’j£ŽÕ@ÿ{“ªÁ·~Ä\F—}ó.õÂ%AÿI•„·|Å¦PÄZÏ¦$(ƒ|tJ‚\Ú9;þù¿4dßúö|îšB‘ ~™š‚JÁ6M!·Zš‚áŠæ4e½—CSP	¥¤)ä¨ãASÐÿ>•¦àúuó‘-.ÀL„ÿN†éB%ŠÂFx•/jºe5AFù¦·á„á’”çÚÂøÓÖ2ÆŸòMCx5YBOÚ®òúD·¦;€9{#÷æòzx½ìü]V+æØü'Í‹8v™WâÓºLn{ßïr¦ñ¶’iœ	;üåéÆœÚÉk%ÍâÚÈë‰È±›üACUmå?0ú·É:Ç·=lÆxyo±ºwÛ@×øf®;ë¾èõ£/ÉëãkvPam)ë§g—¬×QâÝ"(ŒúÞÈÿ‹Ór^Zc³ú—WeÈœv¸4	_–ÆÁpžŸš;¿þ¸ñãÓûÎkí|vÈ
2+“8{v;í§ÎÚa­‹©täfHèHöd9?,¿8ÁJV)˜D§ˆ	gˆ<ÒÀ†Õñ³.‡á—Ü…³¸ù=ôß¬¨ë]f ¥jÇ©vÀ${ü//‚ÐK‰b3¢N}XúÓ–¨ô‚ðH1Ø.Ù0uRSÚž­=˜•§2—dšÎÊYaÕ…VÉŠÕªo’f|ó7hMN†òÝM1[x¯ÝÐbýÌ£äÜ»öQÞšGÉ™~öQ’0ñˆ%º¨¦/úY6ÛÏÒGj[™âîjGÛÝ«µ·:'³køÎ«6Ú4sÚî
Å]½ÀáäÖ()Ó—(EÞhV¾*œiXŠ¾ñ­jä;¢ïÎéµcã[1YS“I)dSJÇ¶¸:=Åtë›ŒÛwRf1]<Î˜z'e'ÓÅo3ÞÝIÎtq˜gµ-;›nö{;äõ'¹	¿wÿã') ½’°ï_›ÆFç¸—®©ÜxuD±°ç~²ƒt@°PràøâLz¬ôjó­z9¡™3ØØÌ[ù‰›/ßgepÓŽ¡ƒ—Ô“ÊFŸ¯/”&¦l9)V¹)åº<z¾ÑsëLýJñQ
`Ù¹E©yˆ*áòt)­­Êé2¡íyM2wñS‚”£¤0:éƒ3ä(½<º<"çÇ§_Ë¼dCóRdÏËðb	¿÷<„äaÏ9¹`Ö”¦§óÏ+.›V³'ÖX@›‚¶oœb®¨­«%ös:„•ÎST9•©œž[#÷õ\ºáäWÖô×úââšeœ)ÖšñZ™áú®½‰Ý`6·òX…¾ZA×XîÙ¹ETŽL	ìLë™vet©ÒºÊabÖVlƒíR­ÝŒX“Ú”^VžïG,ãˆ°v0Ì7åÐÚ"=.)óTþ%Ðõvù‘ÒE…öF ókEHÇQÔ³(Ùc¿?b9DhQåpùªGèrûfä±ohL¥r­¾$‰¾ÛûÓÃ˜¯{×ÿÐÒ@öÓv>ØÞÞvì)“µ³÷D~%m£V¬äƒI^Ú-„õ±„ Ì•‡'î2+Åÿ VXUY`Î}wL¥V,{RË/KÈ%æ¤áJ¥o1ÜcÇú-ÕD5Ö4‚ÆkËŽzÙBŽ½DÛÍ ;ôyyh„ápdàE½Øý­É«š¯>LeÍ#èÁE©]HzC»“„r•—´¥r¼}IÅ‰õlC©R‡_|.Í~º/ƒÁ ;ììÃ¡îx™Ÿµ~	†Üýßü?   ÿÿ rI_'