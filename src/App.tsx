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
    const orgKey = Object.keys(organizers).find(k => k.trim().toLowerCase() === u.toLowerCase());
    const acc = orgKey ? organizers[orgKey] : undefined;
    if (!acc || (acc.password || '').trim().toLowerCase() !== p.toLowerCase()) {
      triggerMsg('Invalid username or password.', 'error');
      return;
    }
    if (!acc.compId) {
      triggerMsg('No tournament assigned to this organizer account.', 'error');
      return;
    }
    setRole('organizer');
    setUser(orgKey || u);
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
    const p = cPass.trim();
    const coachKey = Object.keys(coaches).find(k => k.trim().toLowerCase() === u.toLowerCase());
    const acc = coachKey ? coaches[coachKey] : undefined;
    if (!acc || (acc.password || '').trim().toLowerCase() !== p.toLowerCase()) {
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
      if (publicPassInput.trim().toLowerCase() !== (targetComp.publicViewPassword || '').trim().toLowerCase()) {
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
    const enteredPass = refereeLoginPassword.trim().toLowerCase();

    // Check global referee accounts first
    const account = refereeAccounts.find(a => a.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanIc);
    if (account) {
      if (account.password && (account.password || '').trim().toLowerCase() !== enteredPass) {
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

    if (legacyMatched.password && (legacyMatched.password || '').trim().toLowerCase() !== enteredPass) {
      triggerMsg('Invalid NRIC or Password.', 'error');
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

    const enteredRicPass = ricLoginPassword.trim().toLowerCase();
    if (account.password && (account.password || '').trim().toLowerCase() !== enteredRicPass) {
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
    if (Object.keys(coaches).some(k => k.trim().toLowerCase() === u.toLowerCase())) {
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
    if ((targetComp.staffCode || '').trim().toLowerCase() !== (oCode || '').trim().toLowerCase()) {
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
    if (Object.keys(coaches).some(k => k.trim().toLowerCase() === u.toLowerCase())) {
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
    if (Object.keys(organizers).some(k => k.trim().toLowerCase() === u.toLowerCase())) {
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
                        triggerMsg(targetField.visible ? `Removed "${targetField.name}" from ID card.` : `Added "${targetField.name}" to ID card.`, "ok");
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
                  
                  {(() => {
                    const fieldsList = getIdCardFields(activeComp);
                    const handleMoveField = (index: number, direction: 'up' | 'down') => {
                      const newFields = [...fieldsList];
                      const targetIndex = direction === 'up' ? index - 1 : index + 1;
                      if (targetIndex < 0 || targetIndex >= newFields.length) return;
                      const tempOrder = newFields[index].order;
                      newFields[index].order = newFields[targetIndex].order;
                      newFields[targetIndex].order = tempOrder;
                      newFields.sort((a, b) => a.order - b.order);
                      newFields.forEach((f, i) => { f.order = i; });
                      handleUpdateIdCardFields(newFields);
                      triggerMsg('Field layout order re-arranged.', 'ok');
                    };

                    const handleToggleFieldVisibility = (fieldId: string) => {
                      const newFields = fieldsList.map(f => f.id === fieldId ? { ...f, visible: !f.visible } : f);
                      handleUpdateIdCardFields(newFields);
                      const targetField = fieldsList.find(f => f.id === fieldId);
                      if (targetField) {
                        triggerMsg(targetField.visible ? `Removed "${targetField.name}" from ID card.` : `Added "${targetField.name}" to ID card.`, "ok");
                      }
                    };

                    const handleChangeFieldFontSize = (fieldId: string, size: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl') => {
                      const newFields = fieldsList.map(f => f.id === fieldId ? { ...f, fontSize: size } : f);
                      handleUpdateIdCardFields(newFields);
                      triggerMsg('Font size updated.', 'ok');
                    };

                    const handleChangeFieldAlign = (fieldId: string, align: 'left' | 'center' | 'right') => {
                      const newFields = fieldsList.map(f => f.id === fieldId ? { ...f, align } : f);
                      handleUpdateIdCardFields(newFields);
                      triggerMsg('Field alignment updated.', 'ok');
                    };

                    const handleChangeFieldColor = (fieldId: string, colorHex: string) => {
                      const newFields = fieldsList.map(f => f.id === fieldId ? { ...f, color: colorHex } : f);
                      handleUpdateIdCardFields(newFields);
                      triggerMsg('Font color updated.', 'ok');
                    };

                    return (
                      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 divide-y divide-line/20">
                        {fieldsList.map((field, idx, arr) => (
                          <div 
                            key={field.id} 
                     xœì}ÝVãHšàý>E›˜.llY™LBÈ,¦øk «º7O-È–°Õ)KnI\4°gÎœ³·³—s½×û4ûóû}!)$E„BÆäO5:§*±
…"¾ÿ_Bèe‡Ö``õ<ç¿Íø»0î,¶Âxó®á,‘Í-r§½ƒ§e[±uZ~tå„­È‰wásc1vnã•±g¹þâ2¹rÏn¹öÒ?Õ›Í¹ºrúñ¶ç7ŽM6Éâ(¸v«'éOÂÐñãs+8q«ïYQtàFqË²íÆb0¶ún<m®µ+Öso°]{¾]c³T+|µ¹/îøÚ	k¬n:×°º]çÊšxqÃà¸´;ºþ ÙógÙV4tìôã ðìxOøÜãŸÖéÁÄ·»éðÓ&˜ÇN8Öµ3ÇƒúzÞ-‘þÌAH?ð£˜Q2ÇÞGrP 	í©œÕ½"lÎçÏ…|·¹™Q®Ê½%dhù¶çœÝXãwxW”Í[ƒêÏ»èéY#gsa7Wá©aoÀŸmaqšÓf§µNzAh;!ÿ§ãþ-<dA†p¬áœÖÍÐ•u’`ˆ‚°9­±ú±{íl_õàÄ	ÎÝÀoZžGìIhÑõö‚fñ[Ú{m»×âÛ]yÎ-ùë$ŠÝ«i³çÄ7ŽãXí(jöá=œpA?ŸbFq¾c·tÇF®ß¼i¶+g…yß‡îøg'ŒÝ¾å‰¸óÂœMú?Ûjäö4Ö|‚‘ƒGÁ
}ñtÖÎøöWrøq³ø–=LÆc'ì[‘ƒ‡Ôÿ„øyãÚøiâ÷­Ø!#ë^ó#L±°uÇ Ö‡Éï_¯àÓ*wu¶µrPaÝw—lá/qÝÙ…7W4à_Øµ¹ Ó7„½ú ì²Á?õ,{áþò¾zK³-þÌþ\„¹wÏ‰¢é1_½zƒøöÔõ`á~`ÚÎàé< ìøKó&´Æ&à^9kžØx®ï$… ¡¹Ù®9tm^h@¿ÁSá¹½I¾ÁHBâéVÆnÐ‘ ì²Ý…eì\û–lhW?»ÇsûŸ€!S~Ì8Â!¼'å˜¸Ýd¼¸d6HÏå€É
7qµ}7\Üú&eõQÓ`ÏŠ½B¼6x´Éòÿþ×ÿ19ª¶õ_ã±ZaØòI“tæxÆvpãÿnNùÿÎõ”Mˆ ^w+$Ûž;ðG(™œîÇAHþ¸R½«w‡Žô†
—Ã ðäcøoß›ôð_+"iß§ÒêÈ‰-”&ñï¿…ýÀvm¹>Œ–ÓÈÄ@&ÛÑõmðµåM€²gXøÆäï'é3) &kBîä9W1eMŒÂš‚À-Àê S‚ä²/)ìÒÝNŸ»òuÌ¤~ºBbEÄò§õš‘u#ÈÀ–Œ§Í6ð ¨ärô'ÑF0‰ñ6êì+>b‹ˆÝØƒ5ÑW%{žƒÀ5?\yŒQØåGº€'µ°uÀÀøõ
ûq¦™©vgs…î`Ë:­?È8¬«Ç”ÔÃÒÏŠœ¦¢‘(RÙèŽBî™û›c†T&HüŽÏ8'<þz19Åe|c‚¯lvŸÙ™–°æ6ZØúóY=Ä+M¶Î8I´£…­ÃÝNã€4½à$·ìÊÁ'éâ,Ý??p–Uœeµæ,E3^ ¡ãYh!½§WÆÌ¶Àñ$!99¨Þ	¼ Ú–‘®ÎõÇS2”Ð}úã›rÔ‹Þ+V8YÇ_ò?P*_þ:¥ï(ÞüáŠ^(áäGQÖ@GXmËé·©ô‡Ýµíw«?˜
AxUÓPºíJZãQyûœòþ?±¨]M<O!‚Uˆù%UyÜl“Ï76š7Nï“7éI4£+î©î>vÂ_7t£~M(.¥Á©áÉðÕÌSìR©^¦6ªQày£˜`ò ÐðƒkLíQ_Ô™ÙÅø^˜XÇj¬D3UËTé®§pKÕäó`0ðŽQ›ëV›	pÕˆ%Z~vê)‘?2ûaÎîÉÓ	Ú©l‰=ËFÿ¬$sú¡ÛÎäø¹ÓÎ,Žh$ÔÍwÑOâmô¸ïþ²ê}g±]î:ÑmÛÄfi¢´WBcÅ€%å¹jn”:Jî—’¹äP.™[6­§¨!¯Œür:#w2"?Â·Íw®í Œ’d ä y=¸v›’%¢(xƒ UM¤Í.¢IxeõS 	rL>7_2y‚ba
¹ù7ç¦˜6_ ·làÑˆÀ€þ§)‰ƒqóEIz(.óFdCÍ^Ž­·É¸‡Ž¤ü-rÊ©33ñ‡y~ b*nû®¡Îžì~ãÌä·™¢HÞZöÀYR‘cz%q•PË[â¬ìP¦ËÄ´ŽŽqÓá«í…-ô6“ç³dÏ§¶:ùªäp‹ ¹¿Kv¶OwÉûÓí“÷wÈÉéÞÏû{¿ã£óíý£½S‰L)šòóå¾Õ5ôí€8©·ù±³Òi­ýZ‘+/Û%„Þ‡UÜ¹¸6€E3š½\…Á¨ùñn·ÓÙù >´·;«6¬ÃwGVì4¯€uƒ¼,£;ægÜ	Fc`;Vh¿|=•®ÿZNNŠ»cõ"@w ×ôþÿÁÒûøžôÖ€JSÆïîH t@÷idœr9	½Æ3Åòî—.Éý½JL2]MÏƒ‡¢48roáƒãÛÍÑÄ‹Ý±7Ux_K¾•Ìò.7ÊîxwFÁaÐÿ4ŸxÖ6iSáwmä>ç?6_¾|õjqY:%2uøáÇíÃÃí]²}¸úá@1%0üÓ‡íƒmrðáðäÃ)Ù=Ý~|t¦¸ƒšÄñ–iN.ÐŠ±b<Â’â8Ð÷p¶c¸çŸ'¾âe£³Þìü ?€£ fo°}°§sã [ÙÁS†ð²¾þi nø’Ýv§Ýl¯5;]Å0jÍ†‹2ö(ã™ìôÆp\ÅTî9^ŒáVhÓkñŸÈÊ
y‹ÀÈ~²YøÑÙ”ÓPÙ„F‹Àd >íSüàÁÞHY½rR˜'1qÜÂ¼þ‚¹@Ä'‹Ñˆþƒ6ú‡7 ÿÜzôŸ.ÿwþ]N^ãgËÛ <§ð‘ü¡Ž¦a«Y +§NˆäkvÇ2¿sK‰„.–
Êât	}ÒiëÆÐ·ÃQ]Ý(xu³¦û€c~Ðé²AÝŽnÐ*´ƒ¤c¤ÀIHèÄ“ÐÇýüˆù+ªiÙ¹H…À’)4|¹ùWÉkv@0g’r°N›e1Ä$‚U¥mæ.þÖ•ë/i\!P]%²úRÞ™©>úÐ-ŒP’*ºú˜$í†ä6æ“3Ý\`s.ä¬aó%Få:ççÃ äÚµØð}ŸþAwïYU¬”èê¢oÄ\Z ½$ûajb}¦î„ÔÇ‘›(öæã®6qÂ¼« zÎÅ,ÉÑ$¹îóB?¡h8JÌ4‚¬ÏÄ»ê8—’LÅ^ÛÆÀTÁ6¡ ¢Û Ð6³ç&AC‚ˆ”836H…¡=Äè76ÏÎ·ß½kÌ~[	¿e›KƒŸÞËgwÀ©#gß9BßÈ»K–]Z&öùž¬Þo/Aë5»‡;OjMÊL@÷÷[¢XW#þéaz´&8P­É—É²èùœQ$Cj¹æšE´&–wØ^S±öõa{ ü	Ä“S*’j.e‡Gú m04‚¯ÉHœ9Óç•3ìLº/wÉ¾ßb8Ö}1Ý=àè¤oñ*Ÿ5n0‰N5:ráEF`FÕÙeHÛ«é¥b:)e7­@¼õ$˜]F!„x•í*5-:/WG+±ú¨ãüCOBûª¸ëûq¯éj?D0gn¹èX/Ç§Žn›Ö$ŒBRéÌó¶r?,dZ†5Ô!ðÈHó@d¡'À#}Š(t.þÑOè-5Ä4†«Hâô‰©Y6ª,¸†0~ &›]©R!PÝÉPHe€áê×ØÔYõØêë± {,ÂµÂ¬òÈ¹è³@m…›¸(Ð"4 ÐŽ¿n˜Í"½L ïŸI¹àïƒÄZõOè1oô(êž®OÉwÏÐ¤˜yÆdrQ$—I<¾)ßxtâ^~ŽN ç›{û¿>¥aŠN&p^‹Dm3y…¢V•×©ª%æ$Á-çËZm“qŒsõ@n¨Åb8˜Ôµ²D¹Ô,Ä@šz·`þÀòï ’Ô°ºtÛ¢Ù¥ÓF»Ër§V‰[ÆSU¤Bf—éƒ>nQÏ‘éÌûSIšð…~µÀÿ¡‘;jv©³+FÏhp§ûpSÀ7Æåê˜ fŒcÌÁ<‚¼&þ¢­
—HäJÊ·v¬Øá´pª¬Ã#ÇÆHAÕêÌÂe_ÕÑ´vó8‘u_Ç½§¶ÊùÐ£
ówÿ~„+f–-lýBýöß*úQ¿ßãZØÚ=~û¡ô¾l ðüµž†e¢°ˆ	øl&„6É¦‰¤§áú™›>nšXÕXmž¼™t óüše&©ô¢ aôøÅÊtÿÊòG^H¼Ø‰àâÒÛùœJ*×%3¾éÂÖ›TÓ¥¡#ùë!bõ³»<”ß—ÄhVG&TÏêfJ
µ`Jˆ`ÉYX˜‡ÈÔ)<ëO§;€åg?¿7×Ëx‚Ðe!2ò~cã³¡\Þ×ÐkØnÞ­vkÜâ)ð6khÏ<“ôÐ
®¿ywey‘qBæ¼be¨*£©!¤€BûÝlÆçÏm…C¿&=ãz_­·)€KMwyk+7Ôi<z³ÉOÔÈÇ91ÓïÑ&nžÄõ ­˜eÁ?[%Ï U-°çÇá”œÀ:-þåWÅôx²¤«pdy‚¬6Ë»¼0rX,^ábƒ´[/×ñÕÎú ¯Å±Ý[ž7%Àâ’»@	œOø¾ãµh~w;´M=$_¡XfìÓ'ÎdWUjö{Å¬Êù$3ÉÖ¦Hé)°¾œh@ÓF6¶À„+uêmóÖv)ÞTÕÔj«EÔ$0£Y[?»Ñ0‰g°¼ŸÐ $ß‰”Ù*cÕò‰’	¦b<ë­cKù:Í‹‰Èëyã8šQßòÄ,@!ßÆ©ñpÑre;§/Û”çF¤±ÚZýa}Ü’n«Ó]_X‚7|r²ûpy4v=ZÕÀ¤‡é¤d²E‹i‘¸CôÐ_;<DœX½àš>tÌÓw€|öiñòœ %&1üŒƒ§Zå-)#©:ÃKù…X–â.–/ž[=F,`G®®„:Ñb1Á¤|j‡xƒá#3©¾ä¢<gåñrúœÌÿ9@	:ÉG{d¸V®ÙZ­\³²²Ê¤1]¶˜­ò€£Q­L0‰»‡­¥@O£›N¼I”pÂx¬µy!MÛ¶Mv@é
Fä‚2U	@–ƒA¤d¯¸uÉv¯ÉöI1VU‹äµgõ¯š^™&Ú½CøÄ‰^¯Ð™¥ÏTW`Â8<?˜ë)šá“ä¤”£9ñ™x[Ã('ŸR™!ì€n.8- N I“·®O¶{ù%™‘U•(;¹m®¢|ÛM´þÛH€ÝúõN$©`ª_fN`'+äËVèÀFS$§8åp·™ÁÅWrÈŠìÀ|]“Àê¶è?úâ&…ÏkD-âpaKüTkšSçÊ	šýQëæŸ÷O@üÙ?©u=Ð…-úO­å˜…-þGí›-v«¥»Q]ë+EÐc&ç0m…ìx“Þç!ïø¤Ðo›•¼Ÿ[Î§›À· u+#8Ñ¯™ Ô òÊ"…BŠ¤Ü+Òø.ÇwÕ–û8t@$£AcñT 0&oY4o·…UØœ0Buum¦˜Ê•%] jûö’övf»ö
/¤"™å#_2Á³»]¼[~pÓXjÅÁMØ„?#Ø@§Ñ|±t©JpdKSýÊò™sûó@Ýýk,)§¥¹Í9Œ1»Ñíc°êW–L|´²­‘f0ëõ‘ç (Íóµ•yÂuŽ›½‡yÍL5ªùtjíªCNÙÞ†˜<rzÜûgÇÉ‰k²JšTäÐ+‡ÊÈºvÎ2íñ`+áÝnÈÇV«%¨—Ë)ÿª@¢’À»¨B·íTŽ1›©6côú ,8!nEíà“üviÀ•”ŽRÃ+w“®}ÅÍºHb3†´"yÊó¤uã»íR1¬„ò*m®¥…ÊÝ{þÖ*õN^gæ²2ïÑ^PGYWOS3ÑÛ5l~\k³2îPåÑ~õb¶ê/_BãŸIÝOàÀ&5g×ôï|OªLÓZâäÄ½(-JjälFy¤]°&2æjb]-ÚCËžHÈêXU^Â6¿,å©
””M›"X,l€îÔø2¦;—Q'…^2#ÖêL¬Wh>‚B-’hW‹bÙ6ãUü-éÔÒ3^"‡W2Žì1Ü2g+\¥`].ÔT‚!,À–rž¦ÒÍM¥‹¹©…LD%5Y«(ƒÑš´”¦ûª;TÕ˜3bÙe,)²«’3‹;Ì+5DT%ÁXì“ìä’.7Yí]‘Õùibi®.aÑ	ðœ«£¹>o€ðá¿\É©Ê÷„ß¶Ùy4ó\¸¼Tà±<,€¡nf§Sä¶ªJjoÑëóhKWÒüD“CZUŠNt&õÍâµaþŽ<‰³XÿèášI¼ÊÔ²f+ÔÍª½òÒ,Ã-ñðžµš¯-ª¤”d•r£Ùa[Âê‘m.ê_Xÿca=#šhÿ“†“¯·ó¢¨$šÐ”ê2•5ˆ-pàÄ‹ ErFAXä
ö
‘Ã¢Uÿ€y ÃcÅZú˜˜òÌõAZ»q@óc2âj3›¢IëpvOx‡¢£9’“€!4µf²¬ô,;Ùœ[ô±eÑs«ZÏy ÜÀãÜ‘‹õòð‰‹X´Á‰ñK¬N˜=ËIx"úô‚1Py‹ŒÛò–ÓeaW/°èRm7„›¼)Òcx	 %0žg¤§QP•ëÛÇµÐ…Q_`y†ì]y +×¹WhÞƒ‡÷/¸Ñ?…+`ý	>[…ñÚÿo§ûvã’>€žOóYÆ9/+ôÈ‰¯:RT»¸´‰%¦NŽÞƒR¨S¹Äk¼ó€Öž]ö´XNFRjc‘WÚƒ‰Çî­ã¢µAVÑKîA:~ó«°ŠžAÑ‰d=”„=dj6ßÆÆ¢Uý
„ÎÑJ¡h“\îÿóöÑûªú_<ËÑÝô#5:…5ö5V>þw«ùÛvó¿µ›¯.š¿®`û.—î[cpi¸€aè\á›°=0¼©¤¥ºalpQµá„¡ùî¢¹„šÔ‹ï,×ÃB¶A*ø
àg
Ã6Z9ÉŒ zV¼ì*¢K4¿jÓ´ò’)×uAJKåRqT"¡
ìTÊé;m§•k_§îy%HEfâ>¯ìõnãò
àÅ4Ò»áœÔü°JbRsjuxŽº¼na`ÁŽñ°¸‹y–ªƒ.²P…ê 
î®"{HMÈ;˜žœ¶0®4Âèó‘ÇÍõœþ$TÝå‹+{uê÷t“e”ÁÆ­¦“ õ‚N/Ô‚Ñ˜NÔBùÌ?©ÃQ<Áç„v¶@ÊâÇ©.Ê!¢ê”£¨XØ#zXý+w0	A4‚	|–Xé³–[¸ oØ
Å¯QXŠàeA-¸ÙÄe~lMUF…—Gñµ.*--UÜë—kwÛB)ãR=Í°Ì0’5Ÿ’òÔ}"E¹“´¶ÈqþK	zÈ,ˆkóRé î;-jé5ˆ‡üpßâ0‚3€’+[¶.‰F‚1g-oêyI9Œ¼L¤{J`1mJØƒ¤”ˆ²‚T½m“&ÝëÓHã.¿wbéQÛxŠPšš;Ðî†éÅ#¦|‰¸™B#àÿ¡>iŠ¹ªÕ:óWû“QOÇÇ¹×šó ¤2­O£‹öÅº¦çcÉ=ƒ4éœfs4î÷Â¤Ë„ÏºAh²ý;`ðqÑÍ*x[U‹×,Žk|hå„±×üÔÜì’bìyäŸS·&Uík•ì¡þáKáÉ:"
ÚÌž0…^rLYo_ÀÍWØ¼OØò­`"
 ËcI.9ºÀ6]tƒ·ð‰Ÿæ›AÊ_ºOü%¹Œ û†Oü„0ß
Ât)‡é>q˜ä’#lÓE÷18Ÿø	a¾„¡fõ‰Ã$—a€¬>‡á?!Ì·‚0«”Ã¬>q˜ä’#lÓÅêcp>ñÂ|3CQ…<g	ÞO(C”(¬€îÑ# M2õÚ|i´1	.<ßÅ$¼³·Ô‹F'ðÃO‡KO¨C°Œ±3Þ\h·ÚëuÑ£Z.hd˜åÍÃÄÙ?’Q‡-ÖßžÉ«"Ux‘†®ñ
ÞUAöèyUY.®çn‹ìÒ]HÌëžfu¼‹ì5t¯"›‹½Ï«rüƒòE²·FÊ…!gIÉ˜$4¾ˆ'¾P•TyÐi–"9ºú½éï+õìŸ’Æ>FÖø‹Ö“où.Tq~[)GJ¤Å»K¤\$Õdœ?²‚˜³ËŒ¤³KB´)MuÃªW3‘l>÷ÃH5» a¤×|‰ôºû¨5»´q…U©?Y¤;¤;zÂ·á›ÿˆøæ?á[ñú¦ñíðÙ»³ræ`Kô'œÓUá\ôˆ8=á\ñú¦qîpî<ÄÄ'ç	ÝôcUè?"ºÅOèV¼‚nÕ*FÖ0©‘ KòÀkÙ$sÑŽ™…ˆlYòMŽY2€÷ ýxõëWˆÏþÐ§%dwÏ ®<Q/í¥¤^ö#R/û‰z®oZX8›ÀÏ×n„Sò6°Bû	ç´—
çú‘¢JavÍŽt0ùÖ®oëË÷¾ß˜€£|Â:í¥ÂºÐí?Ö…Xñ	ër×“¤žIê?»aŒ²r±ÿ(’ú{˜’ZQŒU Ÿ—æR®¼ÑÅˆîàã0á!O„¬p}ÓâC¦)Y¨'4Ô^JM9ÙÈ‹€oä#jÎ¥g=!eáú¦‘2ÒO©¹TyÍvñ‚ÿðxèXxÐ.®Ç•ôPiŸ'þnµEÎÄº<ÇB]žkŠ•„h¡GãX<©¬¯R[´yKÌŽ¯0vAÊWIÉf bŸ™‚US/SÊ%¡Zß)q˜‰J%?”2}KTISÙ·>Eù²±”üúˆ—}è>Íyè´O¨C‚:Šz€º
Ës,Ñ.9f­4“VÆZ[WufI&e~¨šVDé´'Õ :«ÕƒÓLøÎƒÁIpçUõà4²Û5œe~u_¶+‡çÓX:­vÅ-ëVä8[1,Ë†Í6‰¥ªmHãà:U¯“†ðTNê-ï-“ºøºFO§~‰ŽÑós@³ý’™)Ìö¯¤QUn¦í\Y/¾°úý`„eÂQ–¾°Ør= „……YnYãè«-WM ¯Hœ+~ŒUC#Z÷5t°è¹Øø8éçŽ ¾²¨º.·YÏ‡<÷yxeã)0%a)³ûyÅBÕ‚Ã)Ý«]¾Jö¤«@</ukùž9TW#kÉš@{ §TÓ—NX#™L^ s®
éZ+]û{VÓÿ °¨Ž>Ï¿ŒR!5ì
>¢e‚ÏÖ‡NÏ y±ãÑrµïƒ ²›é3[ä|èFÄ…Ù„Á9 ´I]føão'¢ºsc—ÉÄ÷œ(¢¬"d¥ûY¯7Lõccï+×sä]v*mã¼¾d®/¤6är—QÂ*'·BÇR"¢DîÖ’^ÚÄcqÎ)°Ä>/žkórÇÎ)\¾2qi}Çó‚p™œÁˆ¬µ»-øÖéê‰ÕéÆCrÜI—œ¶Ô"õìâ—Oäþz2>ò÷7þë°ÙmÏ+µV*¯éÜ¡QÙÏ,™ØøJ›º¦ï,»˜¦:	½šjj…¨Q…0sEAÀ©4´Æñ8ÚXYÁÉZ@±[ƒ h¼X‚nk¨ÏŽóU|Ò‰Õ]³	¾ ·‰Q¼“0¸v±üzcdP£l*©ãÆ¹þæ‚’<±KƒLTš¸°aåãäE°W‚Í€‚MÞÓû6*ðï(yd	ûpé‹‹°æ#ºu%ƒÓ†ðbUÎ¤2‹ëê·ù+DL­ƒéëöå2iáxÓÆ¿dþ™Î¹pD›>.Žæ¸šÿÌþsÏ¬É}d0ÝY§bX£ƒ‚ØÒ?€?ºƒ´N‡a‹ŒªÇÄ§oõ3ž“ó`bã,øv;ŠÜOÿ|j}S¸_ÞÑö«ê~ƒ½Ô#’4§I,sêyÃ`ƒp£0œ®Ç´ÿTó‡ocø×€²¿íq
]óéo#;FÞ¸;Q‹íj2”aK×¡qj0zÎÈ)…¡Ë#râãp°g»h áÇvºýv‘WÙ]0ßYÝ³]ˆsš<94©ï/<ÅÖ†ó(1¿ë¢•µo¶Š·–ÿÉxp0'xFãsv™ÆâQ`pÏOÓ œÜÆâù©ÉvÁ(²ÃÑ;P`ÂF‹ç)¥Hpé¾£ºGaŒÎêîRaP–´ÊÙ»ò3|È „êEÞ¢ŠÑ @êE”ùó‰ÆÓïå/y){K9%ä”-ÉÉ¥TTJ¨Ô6ì;ùzÔ	séÚtUîxq“*ZÜe_b*4äë¾_R-ªÓ^€r1†ší'½&Lîx‘Ä@_iöÍ5Iït•]ÒñI'øÒÙ gŽö‡hRgç¿wëFâîÈVR^<žÚÄA ­Â–pœ<ëYmc¨@×ÿÊû¸«¬w•[âzH¢$*µírX î)mèa@çÝåLÈ´ãöÓ3O +”æ]uÎá5¯ù¢r’\Úq“ämVY˜¤¦²5§>–¦Z9ÌéP|­|×HoJp±ÑòÑéþŽÆ’Ç•KÀpàl"•öVRco-Ú:TS©”8ô iô8P²˜šWˆ(óUæä’¹2'M¢ðà;¬V¾C³KFÖmô‚.uv]y ùL›ÖýÉ	2+¿îz	’uXþÛÄ	§;žLd“N¸Áî Ê7–ZqèŽÔÍˆÙtW®üÚÁ>Ë	v¶ØwKÁÃîGˆ<¤mÇ7‰ÕÂ#Ç=+,ÄõûÞÄv¢F¶xËœOÜ(›?IÛ;³æÎ‹KÕOÔÞ®YNèÄ@À„ýûß³Å©nÃØÅOØ<Ùõ–çøƒxHÜ¶u=Âù"äiŽ2ÝMpì#n­-l œ°däs)!¾Bèm1TP¾‹êMø¢Ò—Yã* á·ÈE#vÑwÔšŠ>9ÓÍ;÷ú‘µl
ã|ÐDfæ@õRªM&‘B=^ ‚TÌ‰˜ÎÄT‘˜¡	P×¹~ó¦Iå
#C>‘²ËuåLVí‡¿’éÂÖ]FîM’Q¤`þDãNÂW^êhr%„ XXÒ'¦½±Ú´†ëª0jËwZ™Š,?‚®¸N³}ÚJÁtwa|”éŒ¨«ä¿ žªHªõÉ:ç%í=L19§LNÕ7–¼ÉUU5àÜ«TæôÐÅn[ådða2ÄU»$†€M¹M+7aEÐnrUÛºÄ«`÷Òönââeb±Ž¡J§•I÷jŠ÷¹À9µu‹¡SÔ2RUŒ„K©vÕ«W
nU£*áE—ªr–é(eU€äýRCz`3Ää1•»»!³´ÔV²È”l#ý¹’åkâÃêèásÒÄ•¨01½!—|Wq77È3ÇMÅ÷—h=“lºÒ‰¨Vøk¨üu_AÔoÈâ™ã9ý˜X©çÁJkæ¡± ¶7dž.Î¶un&*õUŒh ¤çF4ê×b;fåœ-Í¦I­Z”¬k0¬¦ßft»FjÆl¾ŠìNE~p…Ï"7¸Òo‘]å»È6ô_äî1ñaän0ñc”n0ðeäî©áÏÈÝgäÓÈÝaä×ÈÝaâÛÈÝ`ìßÀË,à¾DÃ ¨\~@A!¤ò„JX¨*¿CcV•TD'èX±¹?âÊ4Ð†³IoäÆ›w©wf];y1î^kˆ§‰Î©ÕÎÜd¦
Òž[hjÍè ®¬D+‚^upjDÙ‹¢3»lªk–JÑ¢ªc¡‰}:·ÜGI³p„ÜS•³““œ™Ö{ô’õë`LM*l MfoÎ,½^aƒkÌw¾++PKç»³Ì¶söVRz“4àûY¦;Ýß‘Ô$ø~–éÞoî]nŸïæj}‘ÆûÃ%Ò$¥Âg³ìçÞÎGû;ÛÇ'{§ÛçÇ§²²F°¿ÇózâÏû§çày§{ïöN÷öJ[HãçÓŸõz…¡vE¸—†Ž‰è6ŽõÇ•Ú:“÷"J±ksSôMej˜yÕÎüÉeÕ…£¶€ñJ·ÿl˜ýÆ)æ´ÍIè5fmà²:©tw”i”ø?äzrÕ2³¹wh–ÈZÂ»*#2ÿh[ÑÐÉQV19¯†j&:ÍÃ§c»“õOÝ4?vÛÈ 5PHu²@-',5ksk,ŸëH¸TŽX 7¹9õinÊSÍ`ÉW¹ïhôAlÅ @7%k„ÊçÑüÐ/w¢ìÐ€
ÁÆœ:E5½/mó¶=âw¶ÕcE9~G5¼ð1säážÕ6B¹ÂÇmVÚun“€‘È|É·pYÒ—HÞÒ—ú~3›¸EGœXÓò½è[¹üê[ü‹-ÊbŠ}ùþûòìEp)¼J;§pOÕK?\Õ¤Î)šÖÐt5«	LeÑ¯aÔÊ¬BçxbÀ†nÄ|Í	æT´Å¸Û™‚nõ|@w‹[+€ÅÚ*[wet¿¯]+ËÀÑ ø'EÜ+6%HŠË¦;•š¸LƒiŸ N„8ùžR¸·H\Ø„ê|Q°cöàÓCr'£­@Nß¹·ŽÝè.ÍÏ@4®Í°'1¦wÂ]0x¿êF·Ó÷iÍø¦	­è	&«a2Ç²"rä8ð: øc0ú²(À2Ïø%´U¬!„ËwH“ =VaéA€y¼JÂá¡åú„Æ¦>0)Fž“†ˆiQ„Ê´DiâKöðf5Š¼š6èß(äc^RD±Æ8®äe®×ùÁ	-ª˜e4g™T¯‚¬ HÂÄ’ÏVqà «¥`&‡yM,É¨Ù±¼þmàÄõa7]6ö€[Ó`GËùT–fE8ð'ßJíãÂýWØP)Ùª¢¸€ä†4ÖÎ¤‘ÇŒÿ8AômÛæ§"÷?“Âåjå¤ ™Hú¥¯¶óAökùb9‰Ö^±ê¤‡Èñ® —@‰èq£ègü™7ÈÌ$
 /§QøVB5laÙRÐU[OjÊuH•¹¼\Ù(Va:J3Êàß>œ±®-×³z518·ã Œ±â’†A¨ö1%NÚ ýve…ìÝöÊßaÙsd!zÝzÑ­©î<t,u”MòQ±˜<·…eø¸ð/u_âè™Ä8bãß©3ñ§Ã%ø¬š“{éètÌý†Š4üœã×ø:I²ú{v4Ú±BB½utyÖ4ÂùóIò™/"ýL»ÙïÝŽ=ËtŸþpbM§ôýÎCëËdß¤…iÅïX­Mñ>*ßg6ŠSUvñ¯r0`§1í6¿ª0•ˆ·=Ø`Â.-ô*á	¤Ñ”êâg!Ôý>F0ÔèxV=$Ìüå	ë†Ûºucra™Ú`0W=PlÄ4zê@ÖÝ/^¥Øãž|6íÊ¶vÖ^æÅ7ßç^rƒÁ™¡X˜Œã»¼k8œïµéðhì¹±€þ&÷ æ‰ÔÜdxL	‡áà 6ˆ„Æt	Ü¨©ª <ª˜;™¢DêÏgnbîE-+°.âà":NÜøÈYÐ2-í íWÅø\½ü\½ øtá;7ª4‘âPDxßæÏ¾é-Ãâ€'²4“™tsÝ„ R½s=‡Þ}ÉuÛÇ¿líì]ìí¾ß;½xvgõ1k'[hø’¦o\4YÇÅâÒ}yõeí…Lð÷èKpqƒÈ.D“~ß‰"¤¾Óït•¥!(yÑUðÂc«ïÆÓ¦è…û
ET©Ì¸Üø^`Ùæ"êÝV)éÞJ´•¤Z'»T*ŒJCaÊªv§›Ë¡‘ësúúj2õ¦¦s'Éè–©TŠDµœb©¨zCó{R3JfkWÙJrs2§àÈN²u$Tw …ô6i2uâÙó½…h*ÌlÙ˜ù†•“1Ü <ÒxË„b 0XÞ2æ4Z6ÖpÐEéƒ:ìM¹ŽÃ0ZÆXž"*·òH»Å³NÍ0·Å6¦jHÙ£N ³E-³xž5Žœ4÷G¡ÙÅH¸•†¿8”— ¹¥ ‡D=ébâ\ª,Ð¡UJ‘²h”‚zÌë•x8Ë,¨Á'ðþƒ2élSå}åL($ŸpÒ¥yÌX¨½:û„Àr†€¬‰¢Gïƒ•S'žË"ESÊj³ž
UŸ“Tõ›ÃûžP³¡zÛ|Îƒ·eQO¿…*Û¸ù^Ç½ÀžŠK : ò„ÿ¡+%ƒ×¹B9g•2™îŽˆâ4É„eÂDa’	º$c—‰m¹ÞôÎÿIŸ¸ÑJòË¤$ÐQ ¢z@†pàNÈ1ðža êU«Õ ƒtQ •4!4l¹v.DµlÌgg"©B`+ðDŸ‰i5-<e”wYšð¦ù¥‰všÝ„/‹Û|µÞ.º$Òb!fIâ¸0Î1£×µ+ ËWE—ßÈHö7“[ï^bü”¦ŒJ˜îýôþêô&à‹*-¢…KëU^Æ(&Õ ŠÏ6HF4J1%UÁÑ…U¹ºI¦—x^ÆwRPÃ¦ ²·-úkKs„t\ÌAÅšÓ\é°‘˜$XpT¥"”éÆÐW-ç¨†µsTÙÛ&ªÒËlZSxSå5Ë|º.p·Ÿ:»î2câ½1x3Ì^)f'C^èç£,´`”x[À´gH gû(¸µ„$é“_6(Õ…Á7è1IŒ…÷üsK±É|Õ;­Üh“H×t’"Š»>Í4`éªdónÍE:P'éü§»‚‘úžüœà·9‹tuª¸AWÎÏ´¡æAÎujDT%Ã$WR	·ÊLõ5oÙ•¥ÈXÑÔïž(£o'•\¼ÚŒs*H«åDŠJØjtéjÅ)Yù]ôho¤æŽMÂJðÜûÉóïÍ`ÝXnL¢,Cë<xç†N¡ÓÈž«Í®Ë®ïÔÇB:û¸OaÝ’<u¶ÎáõØØ‘„¹,4,OäÛ¬ÎLíº@ÔÈ_ÂpEèÔÖ£+Ò“¿J‡”äpšN@T„Gë›%å-.Ã»õ]“„qF£û%ËóH£¸°ÃêˆhN|–øAxv—`dŽ	áÇ»ï÷Þ“Ó½?}Ø?ÝÛ¥%"Ú#ÇY¼¿¬ìÆ$,ßdýbaÌR)	ÚXIjvãz”Ú
/©d¦,˜™¿”±òfXLx¡ÍÐ¶æz»²IúÅZ;MFI¬¶³›ôËnÛøyôy©²”</•Å\˜uáYéÝ¶YÙÏü%/š¿L¤ÞBŽìô‚"ê/¿‚HñŸÿþ/ÿAÈ5ImS<þ(Ð>=Ÿð“>ý“EÌ]•ñ–]•Jœ=ƒYÓâBõ”T„•]2-+-‰6­yï
Pfjz±TG¡•é³…H7ªÁ‹ªl7_ì&ëGÊRÀj¨®tïd[ñÆ¸sÇ=š¢ÑëádúÚ5]Cõ9=ÒÞä`—W¶`xØ±á1É»œõ\þí_Éñ$ÞHgÆ—2µ<Ìý<í Å lÙu×(fíf]ÎŒ[¢-1”2íauÐdVIVf§ËÆñÒy„ª´$vc¯¬!Íò–÷fGøŸÿþ?ÿG‰nÏô<#P˜Sõ5^T‚ì=vÀ;|Õh6/p±Ìä¨!,­ 3.½¢dfr15xsá¢çY> ¡™xêx›~Œ1Ž–ø]VˆÖy3íOO0ËõY¤vkäÿ¹(‰êZvfÂ œìù‰ëç]Z>]8†~ ò³ëÜ`×;#ì°>j˜	¬[&°Vá©ìŠœ˜W±-0É
uS~3ÜÉŒq¥c4.QD­;'‚ŽSQÔH6i‚È:Ú4Ã´?&R›0û†œªîdC©ËlÖþnÉ´f·/Ñ>oºjÌòWÅŸÊy56»¦AGÓèç)v5½Éë²–®¬ð0Ö(æ¶ïõB}N[îêÒY(äÁjt7ÒjiU‰ÑPV÷6íŸkXTØ¨Ü¦‘púPÓ<‹)ú—˜Ë¥bqw#‹I§û6?0ÂÈûn¢S;¾ÍŽÝ¸ËHådÞ„4žg¨4âË.ó~—Ù…€ïÐJg8ž;1
gó3~kªcÉ
}íIæ3íÅPžÿ'gŠ»3¹Ið¢¦ðÖ'gÊ$Ý=<DE‘ÕÅìûc+ŒhËúÇ;/°â†lëù@¶:`í¨Á¦_BJÎŸôZ_]_v‰Áá'žƒa“j-<lÀ²$›Å #M~éòÔä—q  ©ð%^¨ä6’2µþ³«¡)5ª.Z¼ÄOÃ#¹3+{¯½—_÷ÄñàüŠðõ­±S€çøÊ¦§i$fà•4!DƒµÛ"Û‘Äy‰ñ‰t—„h!“ç™ “•³7zCÊÜÐ²°õÓ¡¹ýÊ8FÊÞªšJç&0V¸ðª«táUP¼*Aw8“EQh
ªš–‹/S³¨¶Äjþ2ùèÏwPœ1×äËÆTçÊR›¡Öe§æÌôñYé¹Ê£±ÑYØš<HíyI°žñÜ‰ƒ!·0f™\.DLÆ¤¢ë~
u\xª š²4ec I˜ È=©Ã‘¿ §4'k:ÄE]üA4€©{Ù¾½iÅ·§QJ¼ØþØ›ú«ŠýW’¼Õ6¡0ØÌg³v¨‹
ŠÂ7Bòÿš÷m.˜Ÿ´œÂaz¢ÌgÆê—&û9_‚"±b­bIc/À#š:QÚ7}M÷Ñ›¤Kr‰Ä*tfx©»ì(¨àoäXg~Ó‚h«±‹ùM„—Áw-ÂŸFí‹õöýÒ—ru›ñý?SÀðO›ÉÐ(ôÁLÝÞkëx~<ùXÛ; «›åÚ˜&©Ô.	È-Ÿþ<ˆ	–3¶¹nÊBÉ7jñC3ËjÍä-’2ZÓØ¾ÙxíƒÕDáù„N*Ðw„\Ä:ú›äšO¶®Y]xú˜k©È²î2Ò„unC+¶ þíeþ"MÒYZN2ç© H¾³.á{::‡±DP0,±8u³ˆÌP”kÇ–¥U¥!4JÜMË<†ªiŠµl:Xp÷Ðî‡ÙFåˆÌ '÷BKBàÏ…ÀŸ8âu$8›þö„¦òËM¿45§M~Ã"¯Þ÷$‚ÌàÈäÄG@ò¯š‚	ëÌKc"Ð= aòÛžh[rýDN~ß"È7Àc’ÃÙ± <¡)½¾5ä0xÇµ'£>}úŒ¤Ex@^6¸6—òÊŽ|’'Òó{Ê ùû¾"^›óx‰¡9þº}cœÞÈ–PÃ%^o„30n|Œ‡çŒsí7æDê:7æð´m^Cmâï,kqºQ&>KK¦ë5®ëaF•pÅjÉ‚WV8fõÁg†g‡6ENšAá›)?b Oê³3'%sGë«¶àg­¦j
f_ ü£1‹Œ¼ÞDñ²n O.á¬ÍÅÙìu¶8nÖðíó±ÖÛh¾a2f"lMŽj(¾v‹â+–ã¾Ã£»Ÿ!þì+FÀp=ñ†ÍäÂG‰çú=Ë‚õDÁÙ$A}Gœâ•—¿¸deV!gzc¡oI(Õ¼E,ö…ÛóÄ«ªí«ø¹~™KÚÕ¤Ö¥gõÏ,×µÜKXc•™üG_+xP\§Éí½àÖÛéhÇÞ¼ûî»°åú}ob;IK63ð}P1NCNVXØFVµ“¯ÿqÒêã‰2TÌÕ’EÞV8Ý$"ØàæYï†IoÉæ˜'ÇS(~‚vÚáëƒuº¬'H—A:Ýš9Ãù£Ö€¨Ž°šÎdô’{ÍÐÎÐ»GÝ É:j#Y</w[vó4®HÁ†ZŸxQúœã( }”‰]§ŽH¥R™‚QHæU×…Þ´ëÝÈRÈÏQˆ½XœD–ºGÿŠª‹ÒœÞb¦FÊˆ|Ëõ<Å,â9–½0î6!V¼Q%èÔJjæ¤‚7[çKÅ:#ËGD±Ž±1Â´y	«Žƒ[Ÿöô¹'$Ìòaì¦3ÈnÑî‚ä´’–ïð½:Ýˆ74Òd½!—¸ý™4Å‡5:Zº¤µ¦LÈ“ÙvÝ•fLl2„i=ÐïKYJA"Š“ãs¾®ê¸+È6°,&3‘'®î€ðµt”¸ëþ•ŽvA<çZP©Ò2t¦ÚJ5L>s0àØâÆ¼ƒQ&¦ÖJrœxGºÕõ’ÜÅ÷¤³ëOÉ{·³õÚõ2ÜëÈ=d5vóE[¨[Ž_ü”[¹ RåxEÙøúÙïfF›¿8óµÖÌ~iÌrIt­aYµõGÁWë†4>Bã¤¤`–’ˆ‚wX@›üqâ¡ðá€}ñŠV6ì²*EY]Ãù šÉiŸ:£À Ä„éi?0ÕWÝý’N®"‰÷ŠÇÂtØS6#ü„½qË?É[òæç/)|‘/ ®ùñnå„7'»Ûg?¾=Þ>Ý%\ÉwõCŒy¥B"—^v­hØ¬Ð¦Iè¬ãxÂQ
Yé¥^YÔ¥¾vë¥ÆöÄ“ÿ¢‚¥ãR¤]Ûsë“=$o£ŽFôï0¸)Eò2I#Š­0Æq9ÁC ‘cX]’?Ý…µK[>Zvpº•PÊ¶
yçAUã½r#®²ªÛ¨ÔêWÌ{ßzi«¥s'¹¾%k-.—ç_»%Ê;T½Ë€~ƒ"¢/»q“pæ/M·MQQâÇåÇYÆWn‘»ôjÚ1¾^v%o?.½|4"ÃÏ 3Y€*ËºŒÆoZØ
œÚ)Î³¾à?Nzh²(5ì–wq¯SRMÍÀŒŠ¹Di—Ýw|§òÔÖÎf9
Ý~aìMex÷	ïßW˜!×ÖÏ`ìÔWœ¿3¼‡wi,L‘4o4œåÔ‰ +ü±0Q˜ýrô³JÜÕs&\
*ãTÏø–›-3¦VWóY’¶^å‰ø/†såZŒfË›9
Mé’Vy•OøIl[XxB®¥!>Áò§™O Oì|X@ñ·ºïpóg"E«hõ,bçÕüDbÇYai´ï¬zÚ³apÃgÀ@'apåÂÔq¨(®'Õ,å:L¹àQ¥Z³†ì´+VEá10bN9CR /‹ÄRÞ¥è¬`X´`ß-	[RÉÅ”ÞÁDêjÈoó™¦‘”¥zUÔÕ¿ä~ƒãIl¾£ô½u²Ž|S%ìW–f†’ªÀÌÏ¨û6Ésäë•ÂkNì\7;9Z.zÎ_<Æ£[•I
eûõpU)+™
Šu$DxâˆˆÕ¬ìF®	ÉËcRn¸*}Ó²Ph 7é3à ‰³§Rt­N¦ðí‹3ÿh™ ý0ƒ«\€ÈNDnÜx÷G°_T Ì&üÄî·873’8í¾“H—*ùRöeˆB×&ø?±C©íìcW	<wÀ°ÇNLi¶,õàŒ}”Gû-7Úf¯Í2®`?œ¥ÖÈ7xRfeyHnôÏm­‘öEZhï«Ý••jÃ âoêÜD{áb¹‘ÿTÙ“e3ø çÃÓ[÷mÙ’¯Xh·ÂºEONaÖøäL7ïøc•ýrÝ>›«BKøŒb	-Ïch,§5­5}=…=ÑrXÃNÞ×C¬°Lm/NÖë©­·sô6×A$Áæ•µ¶ª»¦ª£¦ÊÈT²—¸~ó¦ÙôÕÆÔ½®ÉhNÁÍ"º“6i‚çœ²Ïâ†kšçåw©F¯uÉw—‚÷SÞvEÆ)*ú¿¦h_a5dÐâŒœÐòì\‡×ä»¬ÉkâhƒÎ®¢,ì¦‘{ û¦<}6²«.¼ Àô6Ñ»tà-Ù_´ðö5ð4Aj¹ÕnÜ½ûÐ€»ÂØÚdèCÁ(oaµåeFç€oãKØ&žAçµãOœJŸ¿ÖÖ¯ýÑ!“ÌybT¹^Ü|wÁ¯*¼œfÞ‰ÚU{/‚ãêó”¶ÿZ9hþÂl'þfõ×©ÃÔ0½k[T•ÓgšÜ,vý>±Žn7íê‘gQ4oÜ]å^ªtâZz¯R[´Àê3ktGç25=ƒÖÝf¬>¹2–ŸÆ[õÛf”ÙÈZ¶3TuÕ®ê¨mR46ÙxÁäoJÁÙ‡ŠX3ÇYMÊQ/&â’~ÄáÔ0\¤2X„?×<dD$$¬¿‡Ÿ‹õ þ›£+æ´/Öá"Fó†Q­¹bâºˆ›DNš.Á2ðœmšAo¬½»‹ï@†bDºO÷9·É5;rT¿çÉøBÙñ0*žE"H§ÌBK:íªà^ˆžA/AJG5hscB)+BIª‚HLÈlMñŒ×ÄÊ“WîDá4ÖÂ™¬ÏBc+AiÇw|½&¨* ÛÂN0hôƒ˜àk1á¢¡«µ°L(ö-`ŸYö{zyCHuýR9f—ªš3»GðÖÑ7©ï§“ÍZô±©Ë}}Õž°ìÊ×Næko˜TöÉ—Lfkv˜Ïr]˜¥n•!6´ÇŠÊ…º×&…³­þ)Ûˆ›r‹´Aj£ÓŠg²[§Îžd{“›x,™Ø ¹I6ñÏÙvå&¾žeâ
îSrQ¸”0OjN:Æýx+ädtÝx“¨ÐÁ„öá]5èÃ‹¯å/U<Hà¦aMÊŸ$'*e«k•÷)ûh«Ú”˜8Iú×DsOR‘‚Ÿá˜:¹Ž‚Ä’¹N"„…þð¦ÄJì[-©«£ôš¦Î½¼+Üµ[Ô=ýâÆÃÆâùÞáÉÅâ’ÄÚ£uó½4wó‰Á‚é$±tkáñ²ªNÀ¸ÓC–øÌÉ|=Xgß‘‚¹ÌÁ×C#mßÂ–àv;ÎJoÌî!÷»™ T!ÕIjN‚³”F»×[	&Ä
â œØ(OÀÄ‘$Ž`Ë¡£QraŒ¡jCR]Ä¡ÙkP@>Ä«<ÿ…L¸E¨„HzŽÜà$É”°”ú fÊÚ¢Ý(‘¾{-%Vj!Öüµ[DæØ¼µ–ÄCÐ&=bõŠ»r_' œ-–^Iü–-Åše{2gÇªR"(-éÅùšÖ’oH7áYx¯ÛÕ	ÛmßÁˆ¤z7µ/Ójµø:u¥Q\{ƒ\>1Øµï/ð†•gw©›žY¯6Hn~í¡ƒM,·ã|]‚^•õþÙq"Þ©÷O½µÚ,|¶¯š£+ÙÉ+ïÈÇ…~œ"=eF­"íüî€)ø¤†$¥àZWd¥.ËnÞ^vÅr^>J&cŸE±ÕõihÓrqVé“‹°ºx)¼Pp%¥½%GÁBäT²Rbmx‚¼é;-ƒþ6å,lÛ–|DÙ*eÊ™õ¸ÂïX=’0`ÂôPT7iZŠ,JiåäÈºvÌ|r6é5Ï­^T
í“Í[?ø˜\(¿#zÇÕXÈD€O¡[žRaÛDë
$Ïf‚ý0ð¼žê*ÔŠJi²\ÂT¬^cãù•zoÁ5i‡ªF•*ÓA·hlÐx1ÃôXò}£–ø/ù‰éîÊy/ÅÒÅî³åBs‹YªÏLo¡Q‡S‚)ä9Ùö  ÐÖ©‹ïÈxÊÜAD³0>PŽø@šø6¿K€;°¦A€oz¬ÜšTÞG“{èÜÀ9è#‹
fºÃÛQä|ÊÌŠi¥h[üà[ôÇ®èÞ+KÄÓ)’I£åº…X9VZZ¨•ã5;©¨2žx‘¾˜þeÕJ•~•9²jIQÝÄE‡ìeT?£9¬94‡£lªÂvyJf
Íô‹®˜£™g¿‰LW¦rÂ¡£ŠÅ"qY"@ÒÛEòb
Âº7uê C¥ã1)h€å{IÞbN°4¹*Šs¾“òP…Y„²C””÷{þÇ	G¥¾J·º,ÿ>¢0(*)GÛ	¼ÉÈ—„*1SVÜL&ô›p—(.Özû
ÔÅEÊ%©°›¦	ïÀN}•Ò®dç]x&?Ì&bóYÉ.çDAçÀòzqÐì…T‡ Âh»ƒ ùj½ÚƒÕŒ0Å4s@¾ ý-¯M3Ãrú¨tŒÙ6‹WSR'9'³åôaóãkÅšKÌHDä¡kƒc–Æ„ªDL“4úAÈ¦Í‰y6dÛ]†'PC ôbÔ¥ÆÍ6¡e¼àß›æ*ªœð¿,*>Ç+zÞ$Ä]XØR:‹”`´5@6=ç*Æ?r„ÉÊ,{¨ö™Šm¢`¨(-VA¼djŽ&ñIÉ)_Ÿ‡Áx8ÍÎðÒ/’‹”qÓ¯ò¾M±²GÆväÌF"¨I„F H°]éhÔ‰èê}/›>vixbHˆi=Y­?Í“è»bL*’8O$ž pA«bpñ$á™˜9@Ù5ÃÂL%F$êÍV©Ç…	nšX´¥Ù¥åß9EúVÎ¬)€@¥ô†¯HTBù\ßwÂ”)ä®”.{£qíŽº`Ü(ìoÊ&U¦áeyqñ¦´€ƒî¾r–!û'èý+íöqst3PV:áI ’ætsÁšÉWêà%)Ð‡I‹:&®ðŠœ ‰jþ^ö¥@WªLÂdrŠ•Õ½cóäªLbÕÖ©Ÿ"Õƒr:”Z…Š‹aý¾eŠëz¼®¶Û
^Iæèh›KÙ9š—’»0ñNº*|Ó_€p $¸ÀËÿ,žeÅKK^;–&pòÁRHI³}=«/ê²‚‚¥dl/JÕo¸“„W`Löëc»ÕuF¿ŠÉmJ¸âo>O6§‡®?’ò.b­Øb(œ8~¢t6ãä†€°ã˜Æ$ÁÎRÕrlaPŒ!ï¡ƒr\Òÿè‡öUW@–—œ-Ò„5‘&°_”IJya/gÙaÂiŽ˜>éK¶ÀrndÓ\5á‘IZýP+©gŠWOÈveoÖ×:Ý	lçìç÷äÚÑT+ÊRµŠDîo0jmíd­kÇÛ\8Tëö ­øºüýÃ
1ÿ¼ƒQ™vÐŸ 
Ô8ñÓ†ÞN÷íFµ>©ðøbø‚ã©Ä ÿ÷ÈCLgN%BTðOŽÞ·Z­ªR™Ãxäû#kà´âàÄÀs—É»·ŽwŠÞ£²Jî—ZñÐñ àÖ‡Ð3	ñÐ(lsòóÝi,ZºXM¼·²žï¦ã$Àsq²}vvQÜÇ„ŸHC.š,hábqé¾5ö—OÂ‘á²Ù‹V¦¥šš{-šó™Õ[–%z9v¸€x¤.œ¨>DžýáÜŽAO`S´ò>Tíd<¡ªaPG°N¢a’š(enÓäÃ«¹ì& 9CÕŽôÞ“ôD%K[ÝEbÞKª0ÇMUd—ù l|#{CˆdÕ9–¥Æ·3PI`37r¼ÝI<UK©š 	 (Œ`Úš2ô)s°OÖ-é¢p5X\ÄÝ;eYZlQàp¥œJUàeÓr4*@YËºë)†zvê†ãý¬z¼ÈLŒDn…`¥:‚Ãõ—i#‹¬›AÑaÄKßi³õ+$¥¹¼øÑéþ9š`)…G~eŒêûâ¯»‹†eZÑð‘_˜VHüâo,TM$IqÄG~qI9Æ/¾ïòˆ-ó“¤‘=ò6$Éi÷ä§Ã¼~Î6ùdQ·EV…¶%TmõõeÌC®ŠAUEM»ªè†î kbÆr{äx\Ó¦Z£Má´%Ch)Í7dq;QS·IoJŽÃåƒ®&õ	®HòóƒªÌT¤Ý.Vr!ºH=WI¹úE¹ZO:®+–V/EdH]<J«_û—ß£Ÿ:Pï¾ß?zON÷þôaÿto÷Û>K®™²Î<I"×b®ÕâqPZ‘÷—°ÒdØšþIäZµ“®„ïŸœ)ù1ˆÎc¨Úî$LÂ>G#dH•ÅT¾dÁ°ËLw©ö¶òBú‚hÍ…›{ƒªAs)3¤¢k=jnýÏÿ—ÿ0kþSE=uÏâõ¥¤FÅBÍ©Nq×Cr¤Ó+«^ÃOÆýÔ4]ÒO¹z: ³BuÝ!®—–¬Œá	_ñJRUã7’ˆ@Úfî³&^|AÇ]`3«‹1¹”ŸÚ`±5xY´•WðæéîñÑ¨'Gèÿ…?/Ö±¡b=wÏ«}•Q3¦ê!Ÿ+ÿí_¿z¬ÜÁæœM,å»ËV ‡¡e!Ž ZJ`œ.0˜PÿÖPÃxŸ¼°Ó6„°q,œ}åVHCü…>ªVÉU$Q9æÂû‘{Á37–ª„138|(DqT‹m¨Z¥= ·R³Ëÿ  ÿÿì}[s9–æûþ
Xã-QÝ"%Q¶»J#Ë¡›muéÖ]5G)E¦%N‘Lv&eYÃQD¿ì¾îÃî¾mÄFÌOë_°?aqH ‰[’”\v+£»,’™ 8À¹Ç5®r¬KÁ XA8aUÕË/¢Oˆ	(£4®ß¤Ñ¨¤|Í<ÿ¶˜é|Tã¬´3--E£ì|A/3 wÿ
¾‚y‘SäÇ‹†t2Wp¬°‹•0~¹ðëE?þæŒOaW
®¾a’ŒÀÏA†‰Qñ?*‘¯7QÍ¤Ÿnc°’£š$”h+¶$™îž©E:£îïy ~A×é´7TmÉá8Ø<,†àSò&I …h ˜qí¦o5ŒúH4êp°8´(›+Ñýmæ¹FßÌÑæEDdûý=Û»”'XR˜ÔuA¯^Â+a£p”Vöc…œF)ð;r6JÆó/MÚQvdú)© xÎö³1æ¾Èþ»4Ž~7ø?˜ÍŽ<Í0‘³yÐ&5<H$:}I.‹@ù·ªd±,³_‹¿5;! $Kõ4º]&¢zò2IÆü¨ÐË~äU¹—‰(ÞfË„—Â^&z¥êe"a¤-	êl™Hˆeâ6lžß…ó›ðï+ª%Ç)wIßöYþúæW4~é,	`ÏRqÙË*„®q2ÍÉ}tQ˜û/×{TÞ¥‡ñc[oaZ3L$¡sMÕ´wïÆÛn @_Øâq:çPêHæ9‡|+Ý¨Ô…òIñ~ÍÏé))âjZÅ©®RÊPœx”{È~W}-´	“kU•²4åŸ°*èÃØë(p½­‚RÊÆ¨dÿ°Rl˜PÜ¥tÂ¡ ¢]Þr³!óìlÄCyžŸƒÏ˜ü\jYv&ü€ö&·¸À·CerkYÏVÏ_Ë½zB2£2™Ûå€½Ï,“ùÂhì­ìu÷zY§7BAØÌF˜f2‘q=·ì@~î©3q°Zí8F~^*’GMÙ:Nð#­W’~B$|KEõ(sŸ¸K¡ÚšßþŸ3—…­Ö‘åÜqòº÷9îÖšKÞ*¢¯ ÊÕ¾Ý<‘±U¿ÔJr†¦­¤4²;uœá+©²Ä{[ÉBû‚+)ãÛ~©•ä ±ÚJJ#»SÇéZÉ Og£ÛøÍöÑþ¯GÛgíý$¼-ý(Bô²1Úû»ov·=9Ýom·OXGí¸sENFBœÌ««ŸZíw´#“ýäNÂùãŸƒ]÷¶
•äËmsî‰$x£DÖ£
[¯qC”#NtÝÌ<8Zî{ v¤)!rÂÖð|Œ.4òÚ¤Ë¶a×±ÿ)£UHztU²˜Íá0J{Ø¹xoëá%}Ìq²µ_‘ó=°@6¾¹¼ü«õç«äÇ#‚¹ŸÉSNO5zèrzè2zq»osÞÝQ¯G—±Ü­ ‡’Ðmâq@/óPNªÒ­ ž¦Z´/}aŠ=ù§ãå™gT‰`D”Ùœ†ºÞ«M4¾ðƒO2·Þ}é‰†q<Ð,ó7~Ø™žûÌ±ySb™œô2Ásíú2 kyœÓžŸÇ˜ÿ)#®Ü—ÜŽ ‰ž—Äo„ÅpjS¬µ5á	vÄßØ\…_æ”a
µÁº>mÍÉ<Uí²8Ö¹±¾Ê6˜zêÃlÀ¥x.ž*Ùz²™©o,­4°—ç×q2Ž7Hûª—‘áéêA‰ù¬£×£KÀÑNùt0u$|Vo‰¬A^Cµt2bKuõ¹gd@ÖOÛû¨‚´‚°`ñ×£.®ñÅ-â½Ê}äA{e$×b9¬&nÇJÝ=wK5;ôð1~ÐMö˜"+Ø ù	pnƒ@ÊD¾` Ö0\àø<¥§k%!î‚ŸèzÌ°“Q ¢³±½VÐÙŠM9gÔD+•p(K	Œƒƒå@S‹ï&è‡ÅZ-0ÀìÝ™JF:.5zçŽ+éáqº{]?1ä"ÐûJÞf³{ÛÖ¯0©põ’³yýFÃã§·#cÏÍ/'ïZdï]û²}vvðæøhÿ¸MÚ'{Û¿Ü³öSxò@ƒA2LdœwìGXjñ8Ù ¨€Y’eöÞI­ D½k[R
bCx!¡³˜>½!²s‘g-1ýRŠ–÷Î™P•üýoÿË!@•sï®Ç·h2„YÛMRˆîûóu÷2‘<íAÒ~øwï;«p“Ã¸¿Aòê1ùi&`­äMØ+òZ8”Z×gX<c4ØÌ„øÓ]º&0_xYØ$T6:ê{S&
q§£1õG÷CŠUììAoÐ=Ígp†UõÜ›í¨kÌ÷håx¶
q¾ß¿UØìæ…™g9ÂœaGÅÅ"…à¼£CËÔ*ÆX×1Ö4hÎWò–ëóÄêH¯kc³JÝ¼‘+uV™™üeé!=b¯çƒÇoñíËI
0<Š<éWHŸâS†yëalM+ÊD%\9œWi´H#´SÃ‘³xè,WS¶RÖÆ±´ÖÖÙ†¤ýP…î7®Ñc“ÂŽw1–\K^GK¨ÃÆS Ò¨÷áD®¡8GÁwE±POëâ'ÌÖ”qu*‰ÌfÑ×L²¹‹²¡–Âô,¨
ï=Jª˜“ïáS’¼&¯ˆ;kž³ööñÞÎ/ðoûÝYÀ
t^=³#'ª±×RÌõXp.nIoHÞÒ›0B7#R+tÃ%*÷=›C>YxèFh(®\$,êvææ(ú2Xc^¥FQ0ˆtUë»WCj­ƒÝ¥F^m(€Oÿwç%æ®ø´D0-IJ0Cï(cØ»¥D¯œžsç¸¡z©ð©
ä—!p³©<X÷<x6Ÿ‚Æò'®ªùåY“ŠUÄs<ê%¾a”B÷Õ0òÕ:{úÎ_cµÿÅQJUt ,kÍ¿F• >Pš1Ëx»ÁÈ)N.¬6Õ3Ù°æ"0ö9ìÔMýON>¶”qd	@{±_Gý¦'l³7]0¾ñ3ÒE¹­'Tœ¾\xå1óc,åË¬àÐê__4WS4ÅÍÏ^ý/×qzëÚþô ¹‚Lzz’Ä¢<’Þ@-n°Ävá<OŒð„À…É3;Ó¯ÿ@F)ËA½
Raç:Û+8$×cLOÄÚcÖÙQø*}˜ìq¾zQ4™:Ã«¤Á5y¿H¹Ýâ2”å\öpöÕ°(eK>],„y0¶ææ†ºYœ0 ¤_Ü…±±A…ò,žUÊ õ—Ï2ƒJÊùÒÃ²¥]•²Ø•–Þ •/x¯Àb(šåÖ©V3«¼GÜ=ØÊg±ËcþHó·Gªƒ¨¢mJ·HqÑ#S ¯ë~·t#Ê	¨d?C){+çÃÅT<m¼PÃ+¡óô/Kè<&àN> y¶¬ï-Fô.Ì(»‘™"Ùš@"¹b¡	{_f»‘zríYl\b(. ë mþïMØsŠ!oèÃ?»­++äŒitm\†@Ö+;°[@,,[XT›¿•°ÿàÌï²óël¬·ÚnkÉ…¹,f¥µðQ0ËwîB^3C2Ó[‚‡ÑœvMÿ0š!ÃÇ+JFÁÃ€€ëa¯ÃýÚXêÞ8Ã}¤ÖÞZ¡4†´ÁCjáíÂmÎO½nœÐÉCý2üÎ¢7¾äÛ,Â,…Í›€öÛËîUúgD÷Ö×ì¸IüÀBSè={˜Ï¿å¦ñAN()~kïÅözõÈ%B—?7ÅçbéÙg1íðñC~Þì$´£hèªEŸCÞòc«X·âØz¢¾qe50¼.¹§•5?·4´ý÷n–JúÑ¸»´3„Ë8á?Æ·ð{k“”7ŠÃ	fªŸ¤¹AÛ\#×ÆÉ«ò»2õŒPFñç51±jÚ8
ØCQ‡?œ~LMmLMuLÍ“õèG×ÞÎW±6¸x§Q¿›/ÿ¨Qþ¶Ò(=ç„<ÖŸ‰-¦utŽúb&ù'u Ò—Þqºùv3Kr qaàN³OUÇbt¥ªíÖB}³³uÃˆÉ
žÐõp³·ÖçÔ×»‚ÿÈ™¨¾:^ð~ci ç¯J"_bÝDÕˆE”Y¡2BËg‰Äwó]¹Jc¡©j˜RÚÍÀÊ)¼1bŠÒ&OG$íÃà“)ÉËAù~8F‹¯dMøJÔ°ŸbØ+?¬z¨©i,5;L©É43 š@×©UT¼°ŸRðeƒ½¢s$=s²1¦JÓ÷ydÇóÕ
K«‹Y>Õªo?€¸ÆNr8»9y©ü08¹rìó:Jå‡”·zb°£™þù0
Ù™Ð8\ù#gŠä.(.&ö2,Iºr)\¾ ßÛ¼û¾È¹ÜÜ’ý’”¬»*ÀjÏuq‘÷~\À E¥Ÿqr˜ÜÄé.=¯jKÞ°Ó¿îÆTV.÷)ß¸Dšà¾ò
Ñ”f˜¶Ÿ#Å)ï	â¨>ðÔD)	É9ì¨Ô±F8-¸{Fø|¿9¶¸Øf
¾]¶ÆjÚ‘$öÁaÞGø‡»)Cò+ókCÝ|•çýÙÈÖØ?Ò÷ÕI)½òÐ€=[UÂôžŸ/O	âL«ò¤)o½—õàÆÜ¶íâ
Ð
‹F¨xŒ c¸¼mM$˜œ—T
1±J8JžÃwèÓ	2«
QnpM8¿=)ªVüþÀˆ3q¿7òTMÞò‘Eš‡UÇóCY¦ÈôÊÅ¥avŽ2LßJÝ˜¨«” Gé‚‹#¯$û‘Y%4²¸&²€N?|ä•WŸòG{©zË÷ŠÞB÷×Zž¶!BO*O:s,èA^?_É`NéÒ<w<fÎ}aŠ¿qÒ ”j´`õÉÅ<˜êo7Õ„¨~j'Ï2?H©‹°$– º°UDòUŸ€
/_éÅÃÁüšTÒI°}“'E?F%X´Îp˜C²Ü0Å?UŸüê¦žõG” %Ù D½^-GRemi&<ÌÜ¯îÞÑ>ýúüÊÈ>ÈQ¹c%+ŠÆ‰ìõòÛrtÉXŽ«U&ÏÑØV¸l}•8+¦kíVà}	ÉV× ¹°µÝí¢fõyv2ÀQ$é¸RžÃT5‚÷©´"OÄØŒÉ'Rµ¨‘jÌ¯ó ÛÙN +°vQ€\Î©ÑOScZáÈø‚ói¡”ÃÉæ¾ yŸA7 ¤Î4Ì~ÞM÷ËSVÈ»c–W¼¿G8”Üy{r¸•áNON­g£/ŽÙ#¯…,âŠzRÂ Sü’ÄNïz¢œ)!ÝmG6T6 ¸›gH¼Ô¯ŒØnª‚¢ñOlf×¥Ü¾G7­†»Ð_Íö[Ùîho‚÷“z­µ]âsí±´æ÷¹¬¤uÖ1·üäµxÎb8¬=8ÏÔeÕøvQŒQaÆ|×ç«á^Þù${™<Å?+úÕO,e«=we«zŒ×Ùd!>mÐm³i²1BS”Âœx~O.ãÅ±VäB±¦OjËóKòãIÈ´y×i’ ")Ù8»²øÍU=	ÐEBS1y~ÑiYA®‰vWå§¨×.úq;…qµœÖ(þ#ËhLgCÉ#¯£‚zóÛ^Ó“–6Á% Acº¹j¬{µ2üúè6OXÕ
G¨úO¤ÅÁÚÝ@íëþsÊL¢ì-¼‹¥‘é¶HãË^†s!d$-á±›G«3,.æ$fÔ2=ÌAYÇ‰ 6ÑšhÛ·”êHÆ<Èl}Œ•{À½õ©Šƒ®ôq]¿ÈKÔÇgû¹Ã}—Çòc$pÙ«?½O¿‚+8Ø\(¼A·Oçž§¯Wžß`Ý‘y-ÙöÒw/V‡¯ÌÅÂ˜¡îÑêÍ‡94§³ÃTuY§·Íä-•_¦ôWIû,÷Z	‘d6×•l7¹7—§ú½5iíûP@ƒµ²¦¢¦šÿ¥êä»ª9‚³2¹ÓÕjäŸ®Mõ…ÑL¦•rZ2Ô«6U4™áíÿÛNõ 	š[*Ž§ÂRU¹Õá±,]{T`šÏá"ªb&¸¸ 8)Áº\ ±Ò'rØ¬‰ÁýL]Ô<2`U¿×pŸrö»ìSÂQf­×wßn·Þì3õŠìmŸ½Ý9Ùní)¶ÑI†Ìê˜ö:{QvuØ¥2a%nŒˆO¢2Õ€'…‡B¹Â(ßÆÐòN4„ÝZk°ÀOss€ŸJÉÇIˆmíl/r;Ûç~xÒ„>8« €
 ž]^Ñs™ÜÔ¿‡<)lC³(\ô¯S6–ê]?Ñ÷Ëx½‘Z<#Qí}T¹²÷ÑûJÜåE1ÿ^_3‰\a\ÊR´œòÖ±52c9âä«Üb«P8ô{X?oáP{IW{šw`T•?œjóªi‡÷t‚êhñT!ZØ²Øfˆ86W®šÖ±„¹u¥çAP"GÑ0ºÄ"¶¡NYµxVd(æ*ŒôÔDkY¶ê\¶L8rhœH–ñ\Êâ˜g·v¯Ç½˜~ 8ôJõ Úì÷:€mNðD‰³±Ùªf±¤MQƒ¸] ³ôý$%ßÑcÒ¬rJç*¨þ°Å%ãŒÐ#ŠãŒˆ!öz<4›dC÷X¡	T'ƒQÍZ°u³&£«[gÝá"¤ÇæØÌp
-´Ã‘o:É`tÐE/µÕ¾U¼±Û-˜=hßÐ6_ÇçêË­‡»lHšµèUƒÕÞ
8µ6 ÅDýS>Þžìl¢LÂ†
ßª7.`?ÈOÐáÂøâ1šx|&«#Œ_j.AtLÙþeœe—µóíN'¦t¿{Pº4Ç€ƒíH%¬1‹ãAsež·$o£}°ÚÔû«üŠøÒÊ˜î–çËd1NÓ$u§ÿ3³œÃ'oý%‹Ç¬³›z:ˆ!Ý”v§©­)U CÜ(Ó‚GÇD’qtˆœQZoš±‘ìH&êÊ£‡<_ûŒu‰}ŒúKK|b¤í2â7ÿþ¥Lµô¦ŽÙ Êî^ZBnÇ
´™Œñ¡ŒþÉC(P.‹‰¤Jq©ˆ*Ä¬%«^cÏ`ç“ƒu˜~q€5	ô¥(»vˆ;4Cø„yÈ™‡FÐwÅ8Ð9E>ÆbÈ™ïë$º®uÜ»º-¹™LTlÏ¤ì;N>2Îèë_¥	é’§ñ¸p
‰Ýh~rÝ%ÝhAþí8’ßìûß¼œ–}ª’‘–Þ# åïsW«
 0O	ÀŒ¢¸ÎDÀj8Š`+!)òÈ	ó‘@7}Ÿ¾Z+Žúu,Ö‡½ŽäÇ¶fƒ MÂM…±ë¨ßGg¬ˆ˜ÎÂÊ[ì‘ÝU&€·¼‚ÿ:„ ô—Ã€ÄÄåáG9D•]~-€©¦Ý‹3 mšË£«(›MÊ¦>¦@Ù¬J–©¬É±4ùzÀ4K6)ùæÌÂ‰g_\NZ…ÝÇj3òº"byÑÀb°¹h&_`aí’ Fê8ÅvGÈ[é#Õ‚úŽ[µ´£ÆÙk7¿Ô¾Õu1^“a'*×M¡l$¨’­o\ÈúÏÌÑßÏW‰æønªŽïgLÜQl)±R•ÞìàÉAa¡ã²™ÂŸ‡·°…UÜèš‹È‡œí;—Þ8’­'sl²vú»N‡)êë˜ÜØÍ¬v1ärœÿY;h­·œÑàás,‹*ÒTÛÔcøïûÅ Z<n-~RîU†ŸÚîTüfT	àëk¾¿ÝE‡ˆéb·Óˆv“ÚYk¥=¯µ@ZÓ.ô“À•¦G©õÖÇ¥æK-LJõÀ9…¯tÚµ.Gïc4”¯.XPtˆkçõ|Ùøµ&4˜d”¶wÈÙþáþnû¤åu¶¡ÈeÄõÒQ UÐgKL°M05 /÷:íè‚ëÅdg&‘TÃ[FÕqÝ±¬¸?
3Wîp1‰Ë(ÌšøiŒKñ…˜-¨ôRFª€0	å£’XøGÀÏcndC4R²±Ù@™Ë•¹$yÈj¥*GL\F¤´•|û£‚dÞVµ¨:Eñ	¨Lß1Éïó-ÐQ¥t	NF¢ìlŠ^§[òCJ7—Ì‘ÀÐ'wqÈ×ý8ý&hL{¥oÌÐ°ß›ÜtJc‰ñ{«.¦ƒÎt ?±ÅŸ17õ[ 2þ*ßq¦ì+Ñ>DO®}œ¥¨hkT¿µKk¤É±”ñž¼kµIëä¬½_–'N‘Ef'ÍÊ
y÷G@B	O¿ Qžê$y/ÈÑ 'R¯DòÌisEŠÔë$=ë'cò’Ô2ú/=òº¯68š·ÅW”gš„{5‚{G4®¤>ˆo½é¯yN…Ðm^N«G°»D.°úI¿Ù4>Ò'Å`ÊwÝ•Ew¥4W=šŠkÉüE¡ù	«^wí;ú«RS§51Æ†ê‹£dìðmÐÆv¢~4ìÄ¶˜Js_¾*VÏ•¼"+ÙžZìJ%6eÕØj«»R\M‰­¶âÆ¸·ü*å´nžõ¡“ ä.È}ÅòÁcåš.îjW²g`|âóP4Ä?[&j1a†J¯¯Ö‡) ôGPu¬¤€À4ckX5]¡us‰œÐ³¯¹Å8hW6fx¦·§ýÉŠŠ¡ck’•Í¤ï+©ZTM-«69—¶PÆºFädÍ—•Ç“Ðmšàá«·‚V©¸Ú®Ú@•ÒjÐàñí^r3ˆ^cðð¸ñ[|ËxÆ>,Ý¢;Œ]tàÝ~L©Ë|i¯ èdxÕEw–xî@"Ò†ùHÑHúÛfh½îtÝNûšîU¶F‰±ËÌd‰sû÷/¥ã5SDY¹ðÞM}ý…¼Á6”S”îy÷ÖûèkhÔq—
bŠ©>˜Ú§#‚iH®i¨¡äÆ ±ð=0/¡’Vo|[ÿaÕ^oúŠ¬ôµ]ì­ w/D0Ý0Íâ‡/£SkZ w®Ím‰þþþ÷LK4ï¢í•³“§ õ¨\7Ù°uœ»oê¸>¦lTXê<¸orN_n&IÈƒ rÚ¿ž
Ü‡‰ÿbpµÉ¹wèw÷tè?*‹-BÌºÛÅ–C½"YMAM°^WrÓ£ËÂØ&Ö-ž¥Vw·§¹Íü¡âa¦Dâ8¢B·M×ôT¥Øn¸@®Õ<7‹Æ'ÚJÔ€c‚¤ùD‚ÖGÄO‹H¹ÆbXú„?Â-ðæ…)!×2O¤P´1/Ì§—í\6”Ð,µæŒÅ%—Ë?¸Fã’eWÈX°óß ®E>öÒÌ¥ì²¤[r,°ß7¼™ø©V‹–ÉE€xÃM­ˆ2£—–°«(8@+Ò¢vÈ+Ò¤,}ÍM'lÎ1\ábª1pS#DMˆ“rCjD^º[%ð;oääõþ¼¦“n`ßÕúñ˜ôè­«ÿLÿÙ”–<·—’ÞÿèÛêÒ6bù–zß#ÿ•ÿÉ›sHÞX¼Ücï¢ñUãc?IÒZ¬¨-.Ñ.ð®*=ðI£øsJõÅœ¼ï}pK$D3Zo³â{27]oˆ÷wËñî÷d™5Y$bÔÛÉëäº%i\ã¯ï9ZUÊjŒ®³« ']®œ3JãOpxÀ¿è²Ö+æÿ]ã¹Ë§¢WÂ]¢UÉä€á›Ûâ‹Ð`Éýý[uÒ$Ë€N™«£¨‘ySzœêUE9,XæzQÞ!©X’jª›àÁaRÏ&5óBà'üí–®ìášÖl9ôæ¿)€czbù±9sôç3ÝZÍs˜ååƒðÐùùrD¬Ã§ ‚{æ.pyslAG¥q?=yœQ[Ú’Ö
á’š¾ÔÃ¬éw¼kÉüDóß‰ƒÏ¡v¸7–ËýçLf¸-H°X°sÁ.5r:»êÅt¶f;˜¼„´§¢iBTÒTšŠw´ò`”âBr#K°1¤:–¿²m…Úm›Y8œÿèQCÉ	!žŠø
NO¿¶'ñÒ»6³Ž"æ˜°ÎýK—?iãÎ){½44£õo‹¬… -†Øõà2š€[ñ€
„hÜÃ€*?šaˆÍ>1lÂiÜ*ìÊ¹{1ULgÔ‹/êG”sýá
1©zà}+o¯ýáÆŸžß¹¥ŸÄ!•*Ù‘Cp!¸ÃUÁ’›àõÒAmñuoØË®¨*G‡	úE’’íÃC¦!aX
·sDD]@*Êx|Ø§,óÕâ’3"¿Ôp2Wýis…|#@s	7P –“<–7¿S#Ÿ€¡!].›ä!.K6õ{^¯kª0—ãõË·WýJú|ÇëVãá’mÉŒü¨ …ôŒSbö„lË$Ç‹áú¨t‡æe·óTÅ¯r%)Cp—ØæÔùùüjz¾º{w~Ûí¥§¯ªï„Ÿ+°†ßQñ³SÉiž¨÷à,»ß^÷Æíäg<kO>œ|GNÈÁÎïmó°P@ºôž}XT¾.ÜË’jâ#×
41*4+˜«I·ÔÁý„t¹Š“¢¥ÝPø’ÑÏ”bs³“¿“ôX¢Ý Y˜Šò¹L*Í?Ì0ñ•3ÙFï@‡Ì¿ñŠ¯¾-á×Í¬?XlcLŸÙÅÙÅé²ˆMÎ>—žN.c¶áùÝ¤ŸÕø2Q6œ™½¬ ¡(”ƒ[«	h•æÌ(mpW
nlV"3…ó¨áøšÿÑ×8ú!×›Ö™¦t ~ÓŸ¯»—pKPÿÍ©úoúûoúúÇ,C½­a£0¹iMioû:OÑ³{ò1peuG°©ÓŸzÝ8¡3Pî\!zã³–UöV4r®UÖTk¸fåö–_óˆ&åÍYƒÓ˜‡•×*WK›¾†WÉ$EùpÎú’×õ®ZåOâ(€ì®‚BÊ`WW›Wáj È Ð;M²ÍU#Ö¿îB¾&â<¾.Ÿ¶˜¿°ÅÕ»¨Tv8Ð¨×TÆ†ü2Î¹rÀP–eÓÃÓ‚Ò^¡îð´<9ÛÍùy*ì7=Ø‰Š]VŽŽ¬š)àtF’!:,!!±Îšä±Kô6Ø8¸Æy°M#¿ô@Ž¬J‡|É&
*;$‹	1P‡!„…þÌGÛ}—¹„0È—4¿á±òZVÆo>©¼P?V>ÊpòAcð¯>%œ­_£¬<~sM~ÉÂl#mØ|#—7Ú–T­7Hæò†2æˆáW-Vfpì;ë•Œ;Ï„qgµd h–ò"*‡Ðú€K+Å­úü˜5¬·ìâÊKU^!q`Î³ä˜ßÆT-<@i\2>U)“â‹€+À3‹¯	3kvøœPQ®¼OFŠÑ*÷ã¹œQbÁJm=h)ÁC(5ðò'Ö§Ì*.£CIžÜN£L-
RÅ@Ê™Í…Wdu;I¹í‡ÆŸâ>a˜,Ç‰µÎ»h»Œdºžgó¾0ÆG}¯ÅG™àOŒÕ!ýY˜*PÈÿÖvQØÆrF‡è%o)™8¨DLñ†wCN²€¬g¸B3Ÿá’³Ÿ0ùùhmuP–½öÜÿ4Ou†-ˆoz|ØÙû|O~pWØ(®
µ6Š‹I[tjnWÆì—ò¸…ü&ñåU?>s±ž_&Åëoàè…hP¤:U8ä«Ÿt¢þ±£Ë¸ÉF”ŠkçÑh´¡¯ÉÆS^ôäŽ
`>;9n0ºkð
¡bbŸá¢*4Ò¬ß	$	Î#ßp˜µ”çJ	ÏÍïgHxö¤3‡ò6$”u@­°…0‰Ó„sèµÛ‚Ôv[K^†á‚H©7-1µÏuž1Ï|ìf¢ª–Á CÏ&•”)·ô²7X
¤žšÓà@LÑ‘hDD^£/Ô¡K$§àÙ¼
OGp[WÕNce‘¢l4ÎÉ¥Tsx¦pE @N,©é®3%_9 H>w¯@ÿdŒ2käÖ¹pYx1>V*L%_È•äUà-ÀQ–2x¯P–å¬=<P€»ÂÏ¯¬òÂÜ…3Ï}„…Ÿ²ð$å6!l<ÔdÃ-Ïl5-&>—i”I×<™_Ð\è·â‰æÃÇWb64*w+äþŠÌ3’ŠvšDS—R-7’?ˆe+J™“(Óùf}¯f†ÝºŽ˜¸p²¬°ˆ÷¾,ÓM‹6K“§¦žý¹2”*’Cîp,¢‚ìÉkY<è¡#‹ÆÈ¦Yº,ËÂ²_™’Åxù6ÆR¶êõ¼h1ã¤^÷Ug“¯‰-³¦0ë%)”2Læ‘«Ì¥r•9ü&îÿOÚÑµRÝø•RÕø%R'rÕö°ÁV˜+{ÀµÜž½ÂzŸ_—ÑÔ‘æQƒW5‘êšˆ0ñÎ¨”‹>±€¥^ÓL”5›·JÂã£æ¥àÈåð_Qúä›ULØ~}jI±òüÏûSIXû
IÈp¾¤BRŠüºU’‚ÂÉ· õ¯KQ÷ƒ«#lÚîG¹ß%™UÑ&þQ¹wUDñy¨#‹þ*#ßºê±®©ÍGÕã«S=š÷¢z4Uâý¦R=š_©êÑ,Tæ=«ÍGÕ#d8¿Õ£ùM¨MƒêÑüºUæR=š÷¨zÜÛ’ÌSõh>ª¬z4ç§z4U_{÷¦z<Û †ŒÖGý£ºþ¡T¬ŸMÙ]Û±L‹UkoÏ;KMŒž—â@ùV5e6¿:}¤DÊ÷¦›(½<j(!Ãù‚Šá«VRJd/ž(ÑÿW¥°˜8ÈCk-ÊÞ‹îò k4£c\‰G5æ¾ÕÓ´ÏA—)1ùGÆÕÞ½i4Ï7ˆÜæQ¹©®ÜŒ®ÓQ?ž‡nÃÖÆ¢Ý¸nÎ:N¿4/ý†Ï’¬ÞH÷­j7b¿:ÍF¡ ñáÞ4ÑÃ£62œ/¨Í”°Ö¾jMF%óbA$zÿª4Ÿ?´ö"fî^4—{_—µ–Òì?j,÷­±èS>mEaÚšŠ«½JšÊL·øµ²ò—ë¨ßß’ƒa—ª²”·x´]¹!Ì
GÖQŽÊ[5ƒNÂ–pðaÜ@DG½ÏÞ:'âY %·ô©ŠÒjãk.í¨ÑãÒ’@<‹‡=:å+ÖæÎ°¹vhsôw‰¿ðs'q¹kÈšÏê;ãö°´düZkøn©¦—«‚noï@öUkÿõ~kŸì´öwÛ'­_J$Mg»ÓŽ.‚-6¡4à¢Iƒ³AU¼ Ñ°GÙb\ÿucÊ"4£:‹£´sE¾#¯qe­ÕÝì¶c›ú3ä¶ ¸õys ™7ô¥qŸn¸O1áü‘vqSÿ“i“¿¿­\–8¢‹,é_cÒ?Â¡2NFL›77ë‚òƒ)B|„œnŽÊI”[,ÆÐqë`—ŠN¶–¼P‡5ó—ë8½µ %!ø‘Ÿ¬©:¨•±ÌOL+”zõë?PY2P•ä7žŒybŒËfçKa@¼ë
ÉE×c
®ÛöP,Û’ÀF*®Xñà¸RæUú\y‚ ì¬Àþª4õû[€¬©°ÞÌ',i­´¶ZT*;€±¨_±‘cÚÈ14r<Ýógôù3x¹fÅ‡Ûôá6<ÜN#:óžÇÙoÔÚrTSsR+b1þcR++&±Bv±Ì³o­§)†§j2°D2ðÜ¨çîÙQ+L}³B^Ø’tê“aÿ6”M¿¹$2£p#ªïõRÚj’Þ’6b¶Î.á˜¥ ìüØ§³ÚŸA‹xæ³“gŒqàeÆŠôB‰·èåæø*ŽºV‡Ï‹ÕÀjŽŠâd*à*+9NâýXÅ°oá/ÈÃYÕ}6WÆWÓ7ˆg+l<*MÍÖ’ÎpfiK˜a‡ÏÖÔe%`0›­™ƒsÆÙÅh×™u<ŒþÒÞåT4îÌ8ýÕJvð$ÝöMs‘toå±ÐíKwAý–ð?rssqÅÝÞõÀUë0÷8^^Ñ²Ý¶Wæ@ó'× =775ÆÉar§»t×–$]êÕ» Ð|°E›]icH[|°ÎrKÙTºíµÒtÂŽÆ’5’4ÍTrÊ·y±ÅÒÁ‹"É·ãM
¾Lù¦à¡ALz˜}–ä™ÉšáQÉŠN^‘Ú“r!'|Sý'¥ºØÜ-U¢¤>=³Ï!Oejþî;i5òÐ”«¥;WœpƒŠoãZ-Z&(ƒFÅnA(Øx7 þvíBü°älUÛZò›•)ï“MÉÒ‘"`Áº)|ûÁœÇ]í œ6CÑg™és@}S{7õïÉý¿^˜Ç"©Û­óÑœé)l¡ì §«dœ •ž8›½Á%ÉÒÎËüÙ;õÇ/s~Y»bÿ$ÿF%ÎzVV™‡fÉIãô4é÷:·/†I=ÿ*Ã6\è{Hü s¥ÛãÚjH }P´Ep¼	(K%î(AÏþ¢"÷Ýµ¿Aù¥bUÂãI<`èšW (n4a,ïŽüýoÿÉIkX¥ßÐ • *Q+ã®7v¬|Lhö¶¢àø–ìŒš²ñ¹œAáÅ­Ë8c!+côXàQóãm²AJn¾ ª¦ÃëŠÔ÷5=õ]}m9E~Þ¯~š°WW1õæøê÷¹#‚ª¨U3ÉS²äô@1dzq+C¤…j{šc;zB¯¶€wÊ¥Ÿ” ú[hØ‡ôÁÀ	É£l
fR%Ð£jÇ4ÆËÊq•kÄLÆa6øU
ß˜ÂªiÐlNùšoØÄïèD%R/GQÕõ~ÁLÐÞÏ¡/tiª Ô[êçYÖ`iÓÚ7ók¼Yj¼9Cã†Ä¢…-Ã—3t¡E‚å_ùb–¦«³úƒhËÊçð†'X)«jÅ¬Ìå¬êkÞª;p	ÃÃq4K¢ÌVDPð?WyøƒŸåqü7õæ3?ýx-_¿+!*cÎ,!GÓýr¤.¦DîQF¢áí·LõfYŠÏÉW)N…ìª§€¨¶à¿¤vFyz7J»K³0ßƒ]ÊqvI-D†uº(µÎÒl{
 {¤V!PÚô’RÁ,­îžíP¹él‡¾úõ(N?õ2ˆÙIfœƒ7ÛGû¿mŸµ÷[[o ’á(ÊèÎòþû»ov·=9Ýom·OZ²@vBU’mJütÐj¿£ÍóØå…­Ÿzé<r•åà{›”Ð€€c?ÔöFqz
öºTþ§‡ÊaÂ"=X>GÞN|G~<Z
¬CŠïç¹Ã*ãÆZÁ˜[„U°ò~i‹y_ß GÛíÝ·dï]ûr¶ûvïÝá~ËöÎ|À«¸{ÝÓ¹G¾Wf>e4;¥‹tßÏÜnYÇ«uŸ‡Ì¿•Ù „í„7!ØæäãØÂåÑ!k—äX^‹&âºÜô¯Óh÷‰Xn×Ú\¹Z·ü2*meÊiUÞ`®Ž<ÄJÄÔ ÿÊº£Ð@Æ”2d•_±ü§8¥‹"ØÇ~¯3®'ëÈy©lD:P®=kl®Œ*–;ê˜kuËmb^B÷§uƒÕK–ƒ0¢e¯»AÎqsþút²G·Lc˜ÜÔ–¨pd}„UÀÝàÿ¢èûæðdgûpÑþŒPÄÎžNêøDõ÷?’µÕ5wÏ×)$„¢Æ¾æèâ²2z8Ó{d.8:)TäéL¯{Ã›8„£	ð‘ö£Û8j¢m÷{d§7$ÛWƒ¨ëy¢	é#ÀŠ$í÷·§qWéf÷*¡/÷sÜs?Ã{8Û?Ü>~sÒòt’¡îç¬»h¹×ª#èzÇ{ªvè¹,ˆðƒ­P+4úÌ¼J…$Û/nwÁCIûáû3ë'Ìe“ïäH4ÜXtJø™¾ìA&,8'¡Ü…ž|õ¸sü²4?úLOBŒ-—bÍ‹hª€¨ O	ê-‡ßiÿ:3Ëö%<bwÓ"`Ù‰³ö£ws…UÕ"°YË»TfÎä°E^çœÜÌ­'«ÖøËI¡JÀßmŠ›uëˆ²0ÊµUº$r@ÂÊú*ð°o×,3¶l`¬Å-8>(mùªòMŸ¶Ø]òK<¶0*Ko:¥jp&²P"Ÿ]Ðíœô"¾¤çeÆz‡#›íX•åÚ8¦ÃÑo|*ÑFæá·´¨]êFøÀöŠ»pŸñƒ·Íj7.n¯Ðz³ZëÍÐÖ9àWhëã\ï~ o,I?´‘Òž lÜÒú
dÔ0aì‚€¶Áþt°ˆ‰¼”œ&/â~™8”zÇW1åVƒ-Á„¶¦´<(]0‘S–ýÄùRyã"…2M¥*s¾ÄËÒú-K³½\ÌË‡< |'Iúq4\bð Øð{+³Í‰ƒÍ @“gnØjä’CWñÅ`«Ïh1ØÎ¨ïZ¾ÌÝª½ñGôÎ,=Ùé†‡!;²©€•` ëX‹æOÅ²P&ÝlOé\›3ª f ³JŠŠŸ1™RFÞ@àÀY<³1öSEãám¨Ù±}EÀæõQ)lM¶®cÿŒD|¹ã…Ô³þB”Uƒ•X?q®‡¥Fd
%:ÄŽXÁÂ†ÙAyÛ¡Ná¶É zQÍU9z¿ú•Y®]†¡°”Z«Šú”Qt@‹•û`Iƒå\#ÖÝ›T@ÃM¥’é—ì~9¢ò_—{OµÍœõéDoU$¥°•	òÆH§CY•+N9HvÙÁê˜½PŽŽÓƒãŠÈ8‹«næèEz5BU®zn9Oe®ó° =J²T˜Q‚¹ás9–;¿k…r3ÜÍ55ïf$ÓÍí~œŽw{iGÏ=h¦¡\`KÈâ?GéÒñ†<@Ò éN‘uÕø7ºj`ÆY
çaA÷…eÏ„/–\ñaÍPñA]4ùî{[8Ôtæ´p sp}í8JU «+xQî¼þ>‡µ\¾-çòåeÈ\U*xò‰'ñ®™9­ÌeÁÁ=¶òÙp–ÀNõ€&jfUN&«ò¿qoÜ§í²·av$ßCäÖN£ìªYÅ*=l5sªwÍãŽ[G“Á(¦3‘¤YEx»Ë”"üt¿ŒÎ?UëŠMæXä‰—xÔÐÝ/¦øÞë«^	óPªúE;ú!›"ÕsGó´%‘º°¨lyÔ(QìtkçðÝ~ bæ<
ZÊ«Ú˜êQ
ägö^ô„ÄÚDµ¸ÜÎ!rÕC¯3iæ¾Ìü˜ZØjíïÝ×"+î¼{[cnçšÓ¢qr)÷Ô£p?ÿójÐ•>®“þ¥ôñ9ÇX?ž¼3X3 Ð­˜„LAÒY‘C@j»-_*v Ö¨5Dµ„¨^ŒÐxí©Ìs2y¨#žÁø1£8VMpò‚ ªE5ˆå ©*¶Êì•´Y¢â*@Íÿ¦šÃÅ\ÂXìb5ý¶0»F¨-b®”¶«Ú!%WA]û’g”æý)mÈ§Ô—;¥¯=žQ¥»¾±3ªùÅÏ¨æ×wF5Ï¨ßÍU­ÔøãÅï™÷%ÛíçsLA*Nµ:Ö÷yV™´¾‚óÊ4ìÇ3ë‹YM?ž\ú]_àä’Š0Îçà2Ö©ü‚G—úù[ú¬/vdÍR^ìèÌšú†éj/¾6¼Ï¬9¨Ï6Èiëà¸M¾#ûÿrzÒj»³OãÏ£$½¥Ç¬Ó©²NOSv:Ì”t*¶=xæî,ŽÏòïï;ét©ŠŒàu°˜C"¥ÀòD†T1N®S¨óD%«z>ÄôJQÚ¥ô{‘&Q—ÎïxŠlÓ™|¹îè›à˜››Þ’qg¡få[Vne©^A„6î[W2=§´=‰=Z±0Ì\H	¢æ<Äå>×™ÉO0õ˜ûâà+çÿïÿþÿNþðtAÖâ¯¿j ù£|×ÞÞÿñç“ã½²ûvûèôàäøìíÁéâ©¥ô X up$cOÿó¿HtÞ jw Eqq’üù)^—nù_ò{Ü½Ô/g+T~´Bb†Ô„ÈK6ªIUE¾®ß‹ÒÏ›š°P*=f©òïá‹T>'ïñû8ÛàusË·Ý}8'P³7¨,Àù¿ÿÀjŒ“wÀeX†Ï|£¡"ÔÓ¢Re^u2OvZÚø×á9ù£GTªiÏCd¯W{%&»Ïü©Ž¶ÉL}‹w*\/ûTR+¦“ü“ô}>°žÊâãy<û¯ÃE?Ö;mF‹8?EI‡)+,XóÑFŸz— ECÚ!CkÜ¤ô\mÓ3®†G…4lÇ ä”ðÝdÔ£
ÚÏWÑ8ÛÈNÎùI9»ywOÜIáÁ|çÃ¦"{¡sdÂìðr|Î0³°^aÆô[å2^§BbByí>Jx¨ _ÎÄ{TÀKÎ7eÐAúœ-§oSSe„Ó—Ç-NK7%%«]³ÚDàfe˜Ã˜yÞ
ÜŒÁ e–Ñ%•Ë6¶œñòHŒ…
Ìh”b¶ÒÅmÞÝ¾ŒÔZ»K3ËØ¥7%Æ…èšÉÌ†‰íúÓÙ§gÿ˜{a;+äÆæm©¹±KÒ³]ˆz8Õóa]µ»]Y®¾8Ö ›m@ocÚ¦˜°°ÀQ³L|0.ZÚ1˜%ûý*1åàòº+yi¸×xßÈcÈ
‰Vž²š‹.4näèÀ‚ä®;f¯Ü˜7¤×odo÷CùåŠ“VZ0Ù¤@{J6Š±)P|·pž‡ús<ÎåÝZFÎÒL4üm†ÇCªKâÃÄ?â«U˜!¨baÀÊëûÂƒ°£"€hCpLúgt“½œ<¿Óæ®IìÛWºzã¨ßë æMÎë
p[@»ñ-âX¼Óš8XÖƒœJy¸°l\óU+Ãa3‰`–Fµ4l¢<#Ÿ0v,—ÒPÂësêÜRÏJ*6['"”&UÕàï·/­DW@'ôÞ¤Y™´|TÜbƒ Ío˜Æ“d×ì¦ÖßeW(©gííã½íÃ“ã}²{ò®Õ.¬“gíÖÁÎ»6U°ÈÎÉvkÔ~Ú'íŸÀ©^Üuz¸ýË’¢×N²N
â+:¥P^gÐ^/Ÿ|ÉA¥ÉÂ“s.i¢Ïõ žÕO7rÄ1òtò±7n'?£Ažžê‹…èÙ`C˜-ÁH”7óbwsáúñ»ëÏït?Ø¹v”¡K.Añ8Múd'JKº|é=*×â¦¥q?­W/Ê­¹Ï¨>„˜Cï+Ùgž•çR”øTÀ”QånñNŸ‚POŒ	‰ 45¥8s…f…c¡?€Ù‡þGš0º`rŽ$*×çä³ßRvR~kÿÔXõ½Ás:Îç|ÐXJ”S°”ó;“ÝÊ¶Õ-GI /ŒÑÉMl?H@?êü¦¡¦BC>¶gíÆ’|ƒ®û™½Ö:1üTaÇŽÅ®ã0ã… 1˜”´n¬7è|ÛÔúz€"/¼¸½lœö.®Á’Zñ%­¬fójÍM¤L{»„ÍÎ­vH¯ø7ÛWÒêW±âqó”yûÌÁ–·¹rµf|c“õlÍ 8[v
vØ†Ùâ¶Mºp '`J¥RŽÙývo#YÎ$aÖåßÿöŸþ›ÚÉ¸€µÏì¼äBlnZã†ƒy'·CØ"…+Ëãq›ú¨žöå½¦÷½½®*yý3¬˜@Ãd´ÛºÄ>í[R`œ	Ýß‘cæ¸GMÙíP™“î»$—Ðº7¶<l”.Y9t“°dƒ}xóôº©?ûžuóÜâÖà}¨9ú`Åë%m$ºÈ’þõ8&`¿‚¬ìd(6’£T•¯8•RŽŠSy£Ñ0?“ÇØ¡¬ÌžùËuœÞš5—Rt(Ô­Ñ­©a›%hÚ Ê>rF)-ÌçZŽ#òÄQš¦Á¸å9±›ŠyˆñaœÅÅ%Åx#ÈKq€!'Q¢D‘†$9.Çö/Ú´ƒ\;üö(Cã|ÝÎüÛÉå%awØô·£5„¦<™¯±¢öD’1Œ$¦èDŒ¦Œ¾fAIóŠg¢ŠŽq†¥[VŠJ¹Ã\½Û è7ð1w|—ØejŠê^†oì&Ñ-œÝôÀàU x­#r……èh€ "º£Á¸—:=ô6ú'%Ñ¶PîÈxF·të¾·`%jf¼S—Bé¨6È§L@aœtlü«çÅ†äN/n|˜ÎÇ¸Y ¹3lÎMÕóé›Ó.0®¸ŠÅl•ï5Ã½¬˜ºŒ›G=ªÓõþ=n:¹oH—yó(ú\á	£ kwÜ<qÃC˜^*}iã\ÜÿL©¾b¤&^{*:>%ÕÑ‡¤ ¹Äì„ÑÄ,1 rü'(»ÏÕ03‚ÞGR«a©½(# Ž/—˜Ý2íuAo»ÎâôUiÙÏ½ñUm‘êð¿..-Y#(wd¤WƒFö¢ì
ƒ¸¬%=HÜ§6ŒÂzg²"Ž€©“\¹ë–ÝÚu@‹ýä²7´6câ`~zŸ&íù<ãÝ@?L.O®Çá¡hŒ°ñÔ	¤kýû’Ægòá
bŽ^£Úb“6¨y¦Œbq&y(ÖX‡õdúà}³¯vìLßXØâN®·›WÂ¬a‡áŠºrn©ç
Ê\’~ÿ"J™–cPß/R™lqY–þÀjðSÈìuÅ¹‹ &«ÊhQ‰ Í*îÂXç>=qrr
‡Õ$•Ò*)k“ïUmGÞ\Ñ™ež™a‚Ö‹äNHZ³ˆ³ºæLÒ¼8l²|Yšw+‚å}bnÙ,Ü[Ì¦iþ~H1Q}vEeèí>7Ì ÛdlZ‚k)ØÌrV^Õ³H¶jó
J¨5xe,ä0âž¨ÜOuã{A»I?«)ïš›¥ðBu°Ù£ÌÔA=½™Íß2QtÚ²U[™ôÒ4ÞÇÈÊˆÃ79÷VÉšÅPˆ–+¥ãè%KÅ‹òè¹„Ž÷À™*°Û„ld¿A
M‹©¶Q@ßí$÷Ý¬™{WÐÇ|7§í¼éï¼iï\­Œäï¼(É+€ŒýîCÐûH”
Jþh™ÐÆA(¹ÿáw®èiÖ‹¦:;lÔXÚ±%ˆMb	lèË(r+{ÿßÂï-øÜ(v@õ“4wÉ™ý“¹‹{‘Ü™r±¤¨©ôýç5Ñ¹RÕIê=Ç–Œ¥Qˆ¯ªŽ¤©¤©Ž¤y¯#±Ò©<¦öv>$¹´•2$)¿¦o Í›‡(åþ$hGl#m€°ÿ¤OúÒ2:Óáíˆ¦wÇÑ"bŠòMÓÄÄÀÎH£nîžú8©_i2=|êE²ð–ˆÔP]2Ç@©K7Ôl<ÏcdŠÚW¦h™bF¬®]òkgÆpè«B)þ‚‡AA:}˜†áLšèƒ¡1¥26Ù ÷iB¸OS¡…<Vaa?R€CqÆÊ!@"0È5Yp	"o¤1züj¬¤ëµ!‡~Ø
Ö€’„e‹õ€¼0ë¥ÇŠh=Ø£˜›2}~§d{Ø2«ÄìHâa@f‡?lÇTNWý‡UY41†g)¬«A[„™Œë<+Ä3BBx±jéÍæQYmBñý<Õ¤2u–å1}o*•¦Ãã»@¿w¼‘=oÅñ–®Yt'³€fú¼ÀÏi%7.üwÿù•Ÿù@Mƒ1?\‹TúÕºû˜$Sá8ÿÜù:gæäÎýÄÄÒ^ÆO^’’³¼AòAm‰…Ê`ô-mß¿%éM"ÝVÂÒÐ—RÆÒU23ïÃW&Ó×‡£{µLÖ¹'+. ÏGy—ÐwÈ„U®hR˜Çê‘±’ÉTÛ´[ÊŠ«$Ðp‘ »ù‹]w!pêóÞ'›âàT–CCàX Û>üƒ¿S±&ƒ°[z^5V×>ø
HÃƒGçÛóU]”âÞ7öeníë\1Bä(o¥eWqWéˆÊÛ¾‰7Ú	‹Ë›˜á5èë7u&8ìéLern‰–y®`ö¨RÍ÷ÃÓ	ÎÃ´¸&üôôÆM[Y´òDYùo`î£qœ^;ÑØB­M‹º÷ù$QZ:°ªLÃ›Ê³Ãfƒý+¾Ø\CÛždf%HM™e1½"û¤É²Fì‹KÇ5%EWèðƒgÜø²yÂÝaƒê"±Y|’ì¯®ä–±RµñÇÀ:µÕ&"¨$'\aÙØ¤»È‘lž's‘Èác¨MZ¥Þ¨ç®Ið‡í™C04²9Xô{×!ÈÎ:)óå‹*e–]Þc›&ÉbÑåOI‡	Ÿ¡å#–lVì Ú9µÐÓª=±ÄüC©½W›¯ów~!+äÝñöÙÙÁ›ãý½<«ðŒ¼=9Ü;8~CNONyòa	ù²fŽëá ¸bºÜ^OÊ~/ô˜œarŽÜõDMFÖÝrF‚>Glˆl q÷¢6/néÕA+#-Kà/ôÄ¦ê-åºåf±ÍýòW³®(ëVåGy»©W3üëŸKv÷W	•´6«¦æ…N²Ø—×Uð$°6ç¦Ü ð$;–©+SÇ6µsGõu7¨åŒ%¡õçMÉ— 'DàÉE÷@S·«?…Û\ÅYËÆä»Íç]§™:JL°tá¹ÎK·EUƒ´Ò£E°eÿÒ®ÁLe1Gv’ŸyyK'lÉ§IÒÀs±±;}Õé·®éºŒžS”z.%@JÚmÖÎ6aùûõúVï´€ºßÞm‰€ºuŽ],øèß’è&ê!ú-çtÐV“&T¼Š!Á³ANû1G çþ~áˆäGi5/eA›‰}›œ
MÑJß+à&Æ‰æR²TÚWöñêú>³fŠbÃ¶Îê+²‘Si|ÙËð¥%ä•4––¸›G1Ñ[’!Áeë|ždgèØ1ÏÈ »Zô‚â$À»P	ƒd,/Œ-@ÃŠ`gYR»3Ïú¥Ï<œ¤D>,(É¾(P‚—W98ÐÆýlÊy£‚»¶l$UŒz
ï*¬®• Û¸1È~å1Dl%”ì;*L@ÑÜPƒKy¶¢U¯Š\T¬Y†
ûô»Q’²(h3ÁÕ†}iº®ñÉs*AÐÌ¯q•Á˜Ì3
Ÿ^æÓÍÂ;·&,8ÂŽZž€]|+ÏÄ’]P8ÅÔ~ÒVVÐ4‰»¥Z$œÓíÖþq›ïí´!g»T=¶#ÛŒ"`tÊÃÞØ ksªÞð:IÊ {ù/¬úöË‰öÅùn î…–;“dHéfþµå¨s¥4M?«÷và«8{9á¨¿Ç/'Åßê="«äåDü)ß±âX¢w;‡»ä§ƒýŸý«s}AEŸzñ.LÉàAZ`fÞ?Qþ’#…Ë(9ÞÆú5âŽ1	ÿž”ÊB×-aI©²æÂf¥i.ø¿t%«.èÍ1;E2 {½K¿—5³ö`Ð²	«™Ã–p?áäÎ Ãeš˜egÉúZÈÏE†’eXèoä rÂ”Ô[Ž€¡aüXóžðëC©ùúìäõBj- =öo—‚su¬ù…˜¿?1oœïEiyv‚Á–ÿ4ógÙƒ 1» IÏMÂ©­Ù©ÎQöAà>_ØÂ\ÃRÔ&#dsEÎŠ­`MÏQ6¨èB¨¨OgRVó:tSRú¢'@†wP…¼—’>b@²<ÝO ¬ê"î'7æ*5	e^H'²~CB¿(8$æL@$p8-“ƒ½e’@Þîõ…’„ñÒ© INõGçI’Óƒ¬Âyˆ©ô¿õë?p@¥˜[£DÒƒ3g|ê(4ÿ  ÿÿì}ë~ÛF²ç÷}ŠŽ&QsLŠº9¶Æv–¦(›Ý†¢“™ñ/{‘‰	H0 eYÑOÏqe¿ïy±­êÐ ú’rdGø`‹d£Ñè®ª®®Ë¿(4xŠ­DS^ ;þ‰Fù.ç –Wh]ºªõ…“á
P*;2”ŠœX­$Äÿ—æä°`ŠòËÂ·|æ¹‘ã,'°62S±<«s	dÊˆ[)#
¢4ÙÚI”“}’H¤»ÆA"—íº¶¤°!…ÛTf«ß¨»H¢>›)­UÅi*fÒUµ°t„-OÄœã>z3-$á#v5¢—êêh”SHì§ÅSÄì- §ž®½ê˜á»í=´æcÐÊ\€Èí}!œøfß÷&Ëvt|–\:÷G Ò/ÛáÏ-‡ˆ~WÒ]½;%2”i¦NõÇFàtGÀô¦¡J#äÐ’;³Øqø÷¬hÆM!Lrá®¶Ö°´˜äF·lk¤°aJëú-Bo[­¬ø<~Ä³yÜÖfd0Ž"jÈE§ø¬,’KR„j1×º€–øÅ4Š'žzÇ(27FØ‡sú+~É?ÝIŸÛÑÐÇ„ôZþ+–zŽÕæìaM¥Ç²©Á¿ÖÉÿû¿Ä!Pì6»åCþ`#Æ¯ìpX=KnFez“¨†‰Ê÷"T[Ø$ 'oä¿Ýrv‡ÓŸG>lœñjú¦'¤y›-Ð¡;éÈ4T>
;T oþÚŽü{wúC#ö“«p¾l¼•ùõMXõz«·y^‹8¯Ö°lWZû÷‹MôS§mñ8Û>mµß’VÿíQ§ß‘lâ­ó·,ëøô u$uo“qtÚºSè¡ãhè…yIWZñàÍÄ‚³H½I~¯ï9Ä“ ¡f	J Ac8`\„W1ªv;-+^»Ï’Fs´Xé5ŒÊaÔï~bëïŸoÿRJTå"•“¸Í‚Ì¦Û‘m6+´Dé4P}š,ìÌ0ãð5Ýœ™SƒØËQi#@í^Hfsúä¯L2v[éGŠøTžæÇõ±GU1ÜÆóp´@ñ¼!‡6ªX™¡sÕ>åX’²¬	žXiãdŸ{ãOýë9‰eþš<a¯çR/¬ÏPàÜ7Žâàw†[Ì´ç'ÔfÇòÜ	/ƒ1ŒØÍÀaaôî&¬vê/u¶“²Õä\/íj—^˜¨[ÎÆ–öPV¡õça™ws¡ÌB¦Ã]*Z_“÷7.P›`t–y&Ö^ãùÅE¨¥Òô†™¨ô¡Ñ\_òRœa°xƒ1ç‚ä0Š3FxI„1…GàÒC(kx:¢¦ÑçåKŠ¨ÇYALö6,ØzÔ>lôH1“Þ3´w”lêÃå™"†÷–¢¤ëž;%
äŽxªô.õÂ˜´8)"0(¡µó[¨Ò%à!?áFWX0zÓ…gsaÊSÕYLËW›ì´—x¨2x?ÿ‚|ñ2=;¤Ë‹ÚâøQîÃ7t–Q?Ùò{]Ÿ{ÆèMóÔo
OUÍÏSô–›ÉòŠ`s3À‰zS¥. xD¢õ Ñ›+æíh\òºÞr;E¡ÑÉ#\PøLÖÇªAO<¶Mræ ý¬ñ*hCLKê.½Æ*¼¹í„ÃAÜfbïŽiµTè“:’á¡ä}D»ÍEÃÜÝ©E€=ßcdF’‘‘Œ¶Möç#É…~Ú\e<÷Arª’êL=òP
D”ß.ï†-MEí±?øµÄƒ¢¯C¢%iLp&²““;á°øC'²É…*>¢Éb*]H¦%¢õY,9‡Ã|\%éd*Ž¬ƒÝ¾C.K8­ÎKÂIGäD6†Ÿ´[e?u9²¤ëó±‡.ÉL?B_?¢‡:ï¥GÌlÂL€P`ôï½¢¥cVß3ošþ,ð]° »#£HÔÎ¢xÌ‘ôUm{KÛ>²@aQZÞDÐOs<ú„ti*eeÙ©²RPRz×x×œ”íë†=!¼º¨ÿ,Ñ ctÐ3Änïûbs¼kŠÝ BBŸ†ÞÖ1ôç“oK˜êÂ) #á¢K8ÌnPVŒ~½+µP¾ïaÌÓMž ž<jnŒ}æÝÿë_y½¼ç¯Å"Ô‹®‡õ„ü<¥µ5›a(Pß}à¡	¨¤ÑÕ¬Á§"!×ABû $V0"üÿh’I(Z-¦ŒtÊa&}‚~ã¹¦Ì–sÐêy41*Õö15ê#FžRTÆð¦0„i4‡'úâxÎAìm}61åSYÈÓ‚.¥53ˆ‹èèŠßÅ!æxaóÔÈÕˆâ`LÉ”~˜ÁÂRcÃõòñßëð]U‹î&¦ÃQ}GÖìG4NðŸôIâlp×%þ>²ÊKâOÑÐ×ëâƒ¢)ÌíÃ¬¹XŒÍ7W ˜¡O`)h¦#Jo‘ Ú
)ˆ$h„%‘"ÄþoW’÷¾“¶Ô›xÐŠO¾U×¼šÁ” ¯d1-ëwèL§ÿîƒa6 ¡Üã9Ëé¸$ƒ¢Ñ^„·H1Df—5>P~yoˆq·¶v<&0›QÛÊX>y.C²ðiâó!{(ªÉé‹"fÑT˜Ô®-—a·ÂË5—*ÝBå@NME¼Â@þòåTÇ$MYá¿s‚µL7®c=rx-]9'dW–ÆQ[/ªm™ä¦ÌU \<Ÿ>ö„ÂŒ~5‰ q)+†ä¯2%¥Ó† S"ÂÑ¤æsi*‘#@Hõ‘YæB#Ë½"“|ÙÃ4^´Ap¯CR¸™žhL§qJ¥3„VæÚ-FÍ|Ç‹à¬Sû0žÏgÉþæ¦7×¨—x3´ºO6a/þ€ëóòÛ[i¯ºû ÄõŸp”šþj[e—…zÄqùé^³X•†ðÒ"_Ñ)Ü^Ž„æ¸J:Z6ÛR+fŠ¹€¥µGU^[uãÍJÀëQDÍ:‚\¹©F?{E«nµÓ© 0®˜ì¢b²eI$*îx¦°éDÖÞS?ÅÙŒÿ$3ûÿ‚å·¨.ºÁÈásä¡›Ä¡±‰ÉÜ,ÊÎÝ®ÊQc2wTDòf.J±ÞTs"C.—êàø—å‹¶†Ž¦SïI¬Š¤²†Îºý.6­óu›A0Í!|–¸KóºÛ’.b«ªÁ´˜ëCF“ëÃ{°êö¶úÃìâªºÊišUOWÑ‡[*»TyHÜlA.nhJ’6‰]+I	â%‹ws¡4ö” ý¸LF¯¥r‚ð|hÎ
¢ÏXÂK%œÍ«úh8Üˆ…Ò]ËŽR
p¡Qs–æÖÈÖÎTú¤EÌ–EUü—°Åýt"MÜ¢:2ŠYûIÄ|ÕˆsFì"¬ u‰S­Žn2>ƒþ[CÔ/x8F‚v>o8$SÿZ<%Im‚ÌB‡¹dn~˜ßÁˆ¯iIù±äX“{
I=ÖÜÑ±)É'kå”ìÃS³þí4u<‹Ö_¢ƒºjÝN“¶Ìi,¦>Ò›MÒùL´xOçÖÜÓýRÆûÚ«ÌØ¢	ÜN½šâ±Óö•wÎ´±§ë%^šmc7ðˆ:Th<[‰E™Œ1˜Én¥c7[qj*N-Å<ˆ“:‚Ñtûï·"ù§`x)æ1™†û‹p:}F‹°¸œJ°Ë!'
%Ä–s6”ÜuÅä
éÖâñOCµV%»IÿK¬µÐ¾êì‘»åü,[ŠÔrÅ6ñ‡ÁÕ¤Äã£\ñ\r»„"çMV©" Ç)›¸TÅd²=<WC ¿S:T¡—5nÑ¹'qì•C¥öšå˜S¬T•§±Y|Í^$0×ç8ÖS`×­u.q†¤Oû™Uç~PÞ'çœB±¨ÐÚlá¥Ð^ó—ÓìºaÕóá:šáå«è`¢é¼mºý²¤àÚlão"û¡µÒŸYâ¢MCOŽ|éƒwœ–n¢iCã¨æ@þ#…)Ôª¶zà¯©ºáT½ZSºÂf¨—/wšÁëEçÆ×Øœ,ø¹¾(óáj’v–KS­íÇÑS”]î…ø*¾Ø¼°»5™¯©Úéä|Í_’+öC¦_¢^,û_s:ò7œ°ù«"Ù8ç5¤TRÚ„_ÍÆ­ÞµÕó(^p¶á©uHAåØ¼ëåßÕú­FØJ?ðâ`AÏp¡‹ÊÜOïZ‹.âC^À}œ¿Ô›–ÂwÜÔúŽ:Ÿ£FCK‡q´iÈà=“¸ÊG½<‘WóZzX€Æ_T§3ÞÃñÏn*ÃËº‹è‹Î¤Ñ¡HMÔ¨Y“ñ¹"¶°j}IŠÑæÄÖÃ(š;åë§Èó¢¹€•¯ºäž¯µ¾”óõKpŸ¼”ÕYÍƒÙ>ù'*¦»4†O¼ äæÇ„o‚ ®ƒù˜à¸Bc”ÏÏ–h]AQ™ÄÊ!>i1êd™´êv\O_§8=ŽÉÔªÎ}Ìà=.»'ÝŸºïZG¤}z|†¨¬G»Óëw»íV¿CÑ•;=5¾GùÌ‡)–‰ú°x¯¨Ïí¨÷ô±ýçúÐƒ¨(—÷^P?
Æã™ß-F2-˜ @h¾Ý‚¢±?é|*ÊM±2ÎG)“Ù­™QkŸ#ÜV`›8gðß	cæa~ÐŽ[ƒáŠm$3Y¾¦ Ô¶­GX¼
°ur†â‚úëåIæ%÷Ìö…;Z1çUˆòÿ¹ Áæ‡‰-G=5µÖAùè•ƒ
)–4ftÖ¸s
5Þ²BtlÛÍ&Ãî6%»)PÐyìIµlC‹€H'eíÕ©HÎ9
¼‹ Dð3Ë¹*JƒSÉ€‚î”ž‡›Íü9Ï-þ¹¢X6…1óRk4ý[ˆ$uRPr}èà\ž+
¼46ƒûsÏŽ
øÛ÷]LzQ`½Å	«
ø»&÷S¹Úì){M}yµ+oíU{ìMf»1f,´„ÀDa¢?ž90 Ð³fSr`«C <ÿ×ëh:ŒˆàüléaOÓ]Ž:„„7»ò£üõîÔ=Í‘Ý¤Kõ>…X	eÀÔû_ÙLØ®½ú	¡÷9‘C¸Ñ© 6Îò+u¶<ÕÌR¸²ƒ}ÎšÖÒZ)YÀêhN(,î€v·äøDÌÔJG'V1@7°ÒÑåãLc¬(4¶Ì3Þ‚¢;½Œ$fš§Om(œžsi%+“šúXAKôëâûÔ;_É|¯‡­ß~·Ú#µöÛîÑÁÖjÃy¼wî(”»Âÿÿ“¡€­‘Jöp±ñ¤‹?I”2#¬r©¼éyNVà
Åð˜"ÖãM‡zÒë¶ÉITa ¶áƒ•Ž'“¨[a@eá
Ç™“^?Ùl­ßKk	«ÙÞ0Ep^ÕtôüYì£’?\¸êâXÊæWE"|ñk?¼ÆÝ&yó®Õ;è¶NHûôä°Û;nõ»§'¼üIç{Adåïô3=PŸ¬R¥G±tcî®NDõhVWÆápÍ5¬û»ü¨•ŽmsÐ®ÉÉ†ÀÝß”Ÿ£©¸ö×¡Þ}ùž³‹ÕñÍ0¬Ì:'¬ïÖpÒ6¹¿)¡q˜’%Kï€üåÆ	P2¯`8¿šL¼¸ëO›m
0<™ùe‘½„¨^{•y_z£Në¼CÎß·zÿÔ‰ae>N÷	õ¹áHcŽŒÌì…›£4ô~ìÇþÅú0.
ä>Òú£ŸåœÁ.;	šöñC“ŽÕ2…€|_Ÿ«Ô€n>ÂýÀ‰q€…Ñ“ä
!œŠc|“À10$qüŠ¨0$;}£?¥>àü+ÊÁ“Ÿÿ“?™Q<!¹*ÑÄ›z#Ÿþ‰y¼ò(ƒÿñ¦7°¤#Š7ÃLZÏñ¢y8úºÌ/™Ú_à-ðä> é×™Ò\áçË Á{¥ä¿,¤/í¨ b4y{s´9	Än†M·°h6WxŽ«P¥° eÄ_¨¯"	W«ŒJ‘çö»-!Ðé·ºGºÃÿÜKp í[˜å„Ÿ†×Ò˜Æiêž¥¢t•CèÎ¨ÚÞ©—nè¾«ªí ã8à¶0ÅÀ,bÐN;Œ®†¤Gó	WgƒÊ#È¦\5Ý¨Ka+ßAk‚’Š©Ö•r˜»Þ˜Ðš)ÊR0âû¤›jèÜ<®oïÚ×Ï°Æ+çF5LzèCÁ_“‘>]<‰/+<Ç èä…ó—k&mo@–’æ›yÍ%W:ý3ºø7‚7ÑÍ P–[ÄKCeŠ®Bj"àå$¢9il²ƒ	ì9,ñÖ+¦Œ7Zöðù£‹Væÿ×Dr:„SótFì•zUô’£ÁÕ1hAæ•âÚzCïÏ[ßøÈyêÇoûÇGzlu–‰ÀÎå‡apš¹à’ÔrcÝÐÄˆóLIÐš^æBT××¥°Su<>nÑõL°¿F:f\^û eÂãù$4FÜ¹¤ÀbL¨”…+ûEëDoUâ6?v»ù4Ôtû—/×Dï`8mü;úaðºòç›ÓÙd=F8¡ƒ$ù_ÛíÆÖs`—dž~ß˜ÀìÀkt|Ø¯æ7¡ŸŒ}ßœôóbÓ6/²,`?ÄüÎ³ú3ç
W¢¸ü¶T\žsfÁ;¼#íD„$™žíNok
Ò··9^²*ŠÛAÌæ¶Ç
>˜†‘7¾¸¼šÒlîšžÔK7Ó×òÞ&~t5¯ÉÏý0¯†!O(ºöÐVsØ$¬SðbÓü
4h`U}žrNˆ÷R¶U-tù;sK	i/SÿK˜{‹ÅOêÙ{‘-4îÄÏ!5˜¢XL ½I¨¢+B¯ŽÀ¡I:VšðÜCaEQ»ƒV¿õÍ.œöt!¯Ü.zpñç¨d·÷çpý*+Ùx +3ˆæ/!vu©Zvé»v>ÍÂ(¦1ƒ«3•ß˜Ôj<0J û<ƒÉ@]B€Õâ­³È7cp^·§ôdÜøÕ¿Ij#"TŒ¨ÝuGÎ½~1w@,ã½Ôðc³ù„\ÄÑuâ?AQ7ƒQ2{+3Ó¦¦V`Åb9¢K’àXs˜ðR}ylQ’>B'Ÿ«ŸJéä[q^î‹mXÝþàBFÅS®/7œ;°§8“‡eÑŽ™…@‘…ÜBi·Îeº/µo/¸WËçOUÕ¬*›B®Ê¸“™Ï“þ)Œ#ím‹o›*Á_ÆýËCûíph?üŸ«¦FSJf-(¤ä£@/,ð*ØÇ<e;à=ªpë…tæpOH·M¦Ô{û„`ðÆ¦ÇÃeCÜ÷&ˆ©zŸ*@2 dˆ{/œa„•6"3¤Ì-\	¢†¢²ÑR±xùÙ×¹µb‹/O!5®$vÔÇxÒ|Â”·‹p”%T8 qœï~Êìbõ®ößÿ¥ÜtIµ¥×QŠz×*72B­'Ly›F×±7ËËXT-ž¼ÏuAËÙ·ÆX2ü(ÅŒ˜KŠ0³âoh´¼Ð––Tþ9ˆ×,(—u^€¾ßGç*‰FGù&OÔÚRšÐ•ÊüÍPFî‹Þ‰RÅp¯Ú ¯­ŒªCq)zç,Ž`ýÄN¾+¨Ëw£b®n–“á¾Ê:i«Œ[™¶òõ^áî•P˜u-JY‹QÕ¥ª.ŠÖ}1Y9 [µÔ=hÊ<Báü4«\¦G†WŸáÞ1þ““œ¨^Ùñn_ŒwŒ`·N•¹d<\ÁQÂ7ÞÑ>Ú¡³tL†é›è-²<—¢ãRG&À‹CL	D;ƒ1ó¸’Fä$¢:–€òå(•	KBŠ./éöÂN?BEÒ²ÒbòêC°'‘jõnÍ)[(dä •pTª`[®ÍÍ®•AþËâ@ëÕÅÑh‹¢n"kõþŒ’Eæåý~óûf>áRØcdÐk,˜?kíL’ÊÈzc¦)ê°a†ƒáULc#iì­»FÒƒF1‚@óR‚Þ€Å*
ûÕ.™¨3Æô}q³Ç´oIÕ.Ú­F,S™‰œ®mv0áâÏÆp¢5†LÐÈqÓo¸å{Êâœ1.-Àk¢“ñÒc?>‹@=¿y¹6êâ++J­œN|Q0ó§™ë!Xœ|ÅcLA˜Ú µè³À3WSêVÖáQ.©K'”Âé91Š“µWéRÚÊ7:ns¡ï¶uª}=ÇT{*ŠYŽFš$eDqw-ØI³)4ãIÑÆc¢ÅW1*¼:1ØDYÈúàôµbà{#w•G‹¹•o|ŒyuëcDÛ–º1¿°mßRÒÔX"DaÜšcÒˆ"\'…²p®´¹eæF£¥[AÉÎõÙ)˜3Ûí|§†Ë žø¨>ñÓAwH5aÚ‡U†»»gìÔh´¼È×ðìxt5RËÖKrKFþPd.`×N•èé=¥_\nDÜqîýèœYÚk¼7'|ÈÄÇˆÅªq´Cr9Aá·áÚ=ì¤“-…4°;5&WƒŸ$46ûÞÊ	^`B Ã+HìøÅ÷Í~½Ê¶õ·¯ÍUØÔV]Á/ƒª«ï«Lýz¨ºN0¡yÿ‡Ó‚¬|ò½éÀW2÷V­Ë®!:.žóÒQ±b];“.0ÆHyI?c¼“_UlƒG¯t9é,bH³¢RáÄ”Ãª,­U#aâõŒI#Ë²Ù×0….õ¦•]V‰6~€(†rÈBI¥Õ:âN"L9cÖéÈöfRÁ¤&tc65«„7hf¡F›kÿ‚{«ãõD8™½éð"ú$r›v!î8_óÑÜžæ¿PS|™¸£þÛÎq‡œ÷iª­:Ö¨?ö'þƒˆ3ºÐ¢])´¨Y%´H.™i3:êöÉYë¤s´OÎ;G6B-¸x–™±\8wÍf¢±=õJC')ÞSSúkÃêtN®\Rµ$ÀÇí–Ë¥Õ¢µA8gÎ¹*ÄHŠ–6»
_kªPÅ!9,Ž…GyŠ|GŽ<s‚€tßI£Í¾ªæš=Ïq³¨/ç0rü†!0$‹1ÀËUC‘ÃK½jª`6›ºmRw<ÖÆ™9ØD
™½jÅ}$šzað»Ïv)ÑtÅs/l€‚1Ú †7ðS0 Þ`Àv7yBfé„7ÃdôR€ƒ‰¼aÑP˜˜: þƒ£
Û]xØÔÏà´Uv~SäSé{š]
2w”­}¾Å´ÚíÎIÿ\YÚQ'_¶u`
OŽ[ÉZ‰õçrÍSá¹}ØœÆ:ˆ{)èQ+H¨ý1‹.^bŒ‰S:”œÒqubñö½FÁÓÛ‚á>YçØyëO´ÍZ¡a‡5$Ñ¿½éÈÐ~è'hßÇÀYäsP/þÛ<E ç	´bšM“±£Kï*œ¿Ao9¤—¡53Ãî“÷Y[¸í`«³}ðœþù¼ý=œ¯×Ñôp§ëÚ2“`8Åðûó–¤ûSÏaýÁ5&œº ´ŸÏ3cíÎ³Ã&ý³Õ|º{36ˆƒ	Eû„µYCrxßØ§ë5=¡ñ[¾#èrúý `‰ÑÏ4}‡ƒï¾¿O‚ûÝw˜ºÞxæ°¬Æ¨×^<Ýf†Î'“ 'òjÐòÛ®×:|v¸ç8q¼-Þ¶Û9ì<e×ùþ ÙÒOœòû_˜_×\ÉÝV„útçF—n“,¦„á–PÃ±æ<:œM¶D4“ÐMüõ¨“7¦Sk¸Ñ`|Ì¶“Û,–ËÖÎê;
5MRÍr~bóé¤JYø9Ý ÑæNgÄhô`•ðŠQrL»Ç786ÑÿF’és2´ÔˆgïðTšây3µ4ç}/èÄ…€_}á;}ýø…œæêc•>XêTãs)–sˆ‹n@z‹òM„îÕÔê^â‚1ÁÀøxð¤Ý'#3çß–².ÜRð¤ocÔ€)a‚z½öšk„fî¾¼½•hÊ„ûd fõv/ãî¶ý¬p†>/:EG¨Œ›Qæ¬á-J“1½´®F³¥±’AÐå±½O^·Ú?¾é¾;9 íÓ£Ói¿;ïŸwÿÕ)Rh·Z¼Ù<“9ÓàÃ:jœ_M—=g´Ç¦1¾ÎzýÈ”n¤;p(¾ÂÕ9£ÇN¹ûö8˜%ÊåÐ°=Ý-h¤óbg¡ÆœaÔÚÏhÐÅ€xJª™AƒJï§ªLŸª2¹˜ÞáÐÃÏ¨µcß›äîz¸Ýyír÷cP?swïÂýÏ]î>`·>†U¾½sxøýá®Óít[$ç&÷°µ½õt«åÒCÛ‹/@x1äzèlooã˜t±ÍòêöÂ‚{•²’•õaÓ²®”÷©ý­’·¨¬AYSÌ%QaVšò›äƒ©*•½[þGí*Ÿ*åÙrþds©ß}µ¢–w¤*MŒ9âŠÕª¢tM×sLÿ]RHçÛ¢0aÍè×A‡ZbïÕr•!tÔä¸Þ’%uÑw‘ìh½
’]IÃ»ùˆ =UŒk.9Jk4$Â]×ŸÁú=S°ü”¢—§À‡YŒ„=JToîÎåfiüˆéûhéØÅÒé¨êk€¶âYu9Y`@ÎR%×å%¢Cr»Tù\Â(ÊNJXeô?7?¹> _éâ‘2YB4ë½NqëšF§×›ô
¶2ÐtTöýIwX#Ú
§+†¿¨?c±•!¸[£²ðÉ-’Âª:Æ §<-“ÕõåVýwöÉQëŸ§ïúä¼ß{×î¿ëu*éû»õ}ê­å<kµ»'oROç-\þÈ0¹(hÏxr±³dñÓƒØ’Î¹é€yÌK¯K~YÊ[aWýÊs©ò1×Ö/`æ"S%Ý‚:Çó)Ë«f4„©Ô8%eq÷È°NÊ](¿Uçø‹=jo2qIœ%‡ä(¥ëè*!¯q
m+žJq¡‘nrßkÊ¶rJðlý–QìVÀ
Väæ_#3ˆW{d‡êìÐÇrPZsŒNâ}0ÄÛ`4®óHÒ†¾6ƒó›>ÈÈ6mÃ¼¹ÿÜ=è¿ýâ¶v.´üÎüŽûwä”{ÐÒïekß¹§­ýgp©­c´ÊÐ‹‡ÄÙögô­˜0KßìQš™¤ÙsåÞÎçnA!öÌ$Ä¶¶Ÿ %o€Âÿ˜œS>-Y9ˆ}úõÑ¾ônÔ_™úNgï^è¯‰ôÿ:²ò×=3Àex|…rŸ½Ö#ÙW&ûCœ¸{¡øfó’ÎpdÄh\VQuúZ­Ô5°É¼þT]‡%[Vm%=S.I®„Ee¨Ìb¶Ÿ7UÈÍ‚cµj5b¦¡ÿíS¾2RJ®V²™žUëÕšaVNªM{S,Ÿš* -õºoÞ¦ù"ÝããNï¼ûS‡œõ:?u;?“ƒNûGköÇ¿pM"á¢Kq$Ázæ…Ôk‚ˆ…ÐL†qÍR'%´·Q>× ÅBÛ²ùíÖ^u'ÌÛúè“#üç,ö?þµ¶º¶òÁ6O(‚ßRÊ64èžÅè'Qœ]7È5B	ÑÊThÀˆ¦´ðÆéc#)@?ögB§1ú˜Iû^XŸÿ›JuŸŽOzÎàÜé‘×­ƒ7²Iº¤Ýê8Ô~*eYvŽ<Ín>×ê=U ìŽ´¨22pNOÊ»;ÊâO”iü!h_£¿5.0áÂ‹ÕÑ(Å—JV;Ødp˜MŽFHÑ‘yQ!§T%ž5ÊÙmÍ½tÜ8p¹Ó”¥RòÃªñÎ+È¤™m«¤>$?Ä³B,|!J¬æÌƒ}Ò?îÕAÔÕ›ÏŸb•T©×Ÿ	JÚmöÔêÞd.€:U¥h„Eý9Œ¡CGßyp¦bVã“[ÖÈºHîÃœêyµ™IKðª¶j™Î¿Lik¯Þ¶þÕ=&Gïþ~Ü:Ñ&Îèâ#À4#3¨ÈùèØËêj¢%ÖœûÄßoqToº¼“Z]³Êdº¸ÚD°Öìo‘F‰›ýß¥ôºÆ¹µ1ÇâUÿ÷Õ4ˆbXŒÐ¯E§y±˜um|³6Þs¯u»|}÷Ù¯£ê/¥·€+ 4Qé\ LS‡ÍpÚ±Bÿ8Ñ‚fð¿Ç´r¸.³ÿ1™Àu”œ® ©|’ü^MÒ¢Ý:¡9öïÎ—v®È"*®½ú¹‡…z÷Žç–ÞML`ø©=ö¿¶ƒx¦¼äyˆtž‡ÕÔ=§šëž„ÎÿyÞï“öéñÙé‰&­T#fš¨È45Ô9§%}t`Ñ‚ #Ô+ÔJ3"Á,c(ÐŒ)©eç¾ræÏžu‘Maç& a+™†-t»uÔ!½Në {òfáh'%Æõî÷§{äGc¯UM7ŠQPsG$éˆŠª/ý}§)ïÈÙ®]UÙc¢M(‡(Ç­9ãB±º40ñ2Š',"Ï²x^¾Ë¸Z¨=ô.üÐ*)íÙœ ¦ôß¢Ð^÷˜›ô1ÎìæØaŒó´MÀŽýÃÓ)(šßYèÚ5J¬`ºµ½£í©›i/YP ±¢öJ˜™Fc.X ŽòÔ	ŽoQä'u7%ÿHúÒKhw÷£h¤‘zï»›â«ÿ¡md€ï9<=íc°N¿…•Ã$–|qÉ€’ä©3ã!á=u€DÂü±m]É¯¼Â[.,I-µ&LŒïÑìæod»¹ý”ÿ³Þÿñ Äÿ›sÒÏ 1ÎoÜÕ¤…Ç˜ìûd_°Lnò„ƒÐÅý>]‹í{âÍã` j±{ê/ŠA:óvÓ,…vÂjìÈ‰"5ÁG|‘¦—VŠŸ^‚@™Î/æx†¤¶¿Ød‹ñJ^ºöi«ý–tº}rÖ;=ìÂ>§„_jcaùÎ0˜s°¯„i{Q¦;çqÂ.•kºÅ¹šnXÎ-õœ•­á6¸ Õé¯XOÜ¹â˜ÂVS@9RêkHQ„Ò–[NFäZÁŠ{ˆŠ¤«õ¹£eîœ™œn¡&:¹â^.s;G4Mº0$Å4ÿC1ÇŠ™5–›’¿²nÏKèFeÍÂ
‡ŸLö‹v •~Rìš×Q_Ôg’—µ0–@3ä•!ŸéÚê==“4#]£d'µ¶7F°mÁÑ„¦«7LzS°dMŠgÅ\%myýö‡«uÕJ…êì$:zŠr–©÷)ÿ~ÜÅ#GFtíÒªµøÜ3ÎÄÁ	5W/4ÃÁðØÇ:½HnRJ/Ò.ÇâkÁUP‹VúÐWÑÑW±0Ø‘ea°ÉãÂ8.ÌÙ‡}BÆ¹¯LX^Ú‘eeh›Ç¥q\šÎÄBÒá@¸®7•W‡öeYÚæ‹]‡³ïsóZ°®á}È_I*«ŒKg±Ý?ã4Þ±Ùx³/pEC§%frîèäÃ)µÉr¯ÏpT€9|Jg³`GÏŸ³äbšÌÖW^%ý1Ã¡æ¬
w]¶D	`¬ÐöMNÃjÌã`RÃºpä›Ü¯üA4ÿQ]×-_ò„`Ì`’ò$Hbÿ·« e!›ÇQ¬«€À*y)k*¾+U¦PöÙh4è›ù‰œä}¦íÿ²¯…_Ëz‘ÛëàNØ‰j	twh%ÕÚèî˜á/ÝB÷|i=‘Ì/f‡ºè&u@·¥*Ìø"ËƒÈ“ŽòFÕR*ˆ`Ý6›t·‚f¡ºC¦av¨èì‚¬ëw˜dçCYáÓ½únSŠfu—RÅJ¾Z#ÝX5Ø±QÊ-„¶ea¹8¨“1ÃÝ^ÝëvzŽƒÙ³‡ÕÊ|¿`øÄTÅ>ÿík´„.Goƒ ë{C§º	S“ÅôÞl¥ez_ÊZÊª›XÌ¥ùºÑ•M ´à_Uh‰0Û°Èh u¡LI´\ˆ j…P¤U©É?âàzˆâ`	cOÌH	»ÑÛázùF_à)çYœ“^·Íí=+3Ló;‰ƒÁ£eZmfã
è2Ók>÷÷òùahy––Go íI-Æqa°¦ŒO6É²®¾<Øu7Éq‘z~"‚GÈQ4 9NË­“Ô£q©¤v«å¸Z¦ßÑÃùÉŸ^ù¤ö&"ß‘«TLÉÇîË7¥B³¸€â!ÆÕ—Îqé^{0ËKAìÆ*E£ÇÅ©²8­Á Þt¾€*¡^&ÞŸu¥x»ÇÅr\¬o¢øja„C=ã*1¯Wâ‡+™_$Þ»ß¸L¹–……õRþ°õ’Eš(æhF÷u™ÝïQ€@èÑO'±ÖïÁÑ‘µsêä¼'4¼´‹óŠ]œ@'G)L{9©ØKzé¢¹mZêªkîêÅ&#‹MígQ4I<yjç9P{®å#µ?R{áûû½ˆ&“hÈÎ!=îàýarÏõd$÷\Ë/žÜO" ³ˆÔI—\0J/Žñ½Éä†D×ÓJ´öO?Y{ÿ@g§ñÈ›¿cJF$ºüâ‰­íÅäKŽTŸSX'¼˜ve¶NðFFÕ“pÖ¸Òw>óh£hÍbÒô¢Ð˜§”
¼¼×¸RR»¯@"`29þ›G§»FµÍ§ [©?O)Zï­Ë1ÇÝô Z?íó×°¢W°âƒ$Šo¢©Á÷Õ:êuÛhÂb`wZ‡õ„•"5ø¾ZGoZÇÿ<n÷;°¿¾ÁSú±— ·öæxäßOA<¿‚w–Ð6ªÌ[§ýö¤ÛnýçéY§×êŸöäy<…yðæ<«ºü³~êöúïàI<Ðaí•è.Õ~êU~JEq^iì%	Vˆ
øì‘‹9Æ5Q72¯ão,ÉD…Š.Ÿ=0ÐKn¦b	,¸~i  ì_‘¿Æzù;Ù_L’yt>ÇjšµPF+×å.„õKŽA,›e*!ž…>M„Gu*˜R´4z_úá0Yu¢â+”8„‰ø	¦æ%™yqâ†‘7¯&	w¨„Î’r,¸LéIwFgHtü‚4+L	sñPöCÂÌÉ˜¨OJ†êÏ6C<¾˜¶;½Œ´Ñ›—œ@÷IbÕA‰YHbÁ—ëÐÈ*e.P7p~HÛ
Q73Vž›ôN‰Ô7ùí‹•W7»à¼”v,˜KßœóWîþú&O>¥·åNeê•­ré9[fEdG¶2ò·šâ
|¶Büuó$Ó"Ó;$ÍRuÓÝßT¨IŒ´ÀtÓî h:…Ø˜ÆÁ û³öŒÚæûÿãÕoÕÿÕ¬?ÿes\·¾‘¯·§|Â´05§ln’w”§È(Œ.¼P^ XSõ<ÑñúŸ€´@AKsþ¶¤3¬y¸™xUß€•d³¡‘&(å¤çëdPß5æÝcHp/7Àš9¹ÑhH]ëë‡C»¼4Ò´¼Ó¼ƒ½Ø²H¸;1ò‘	bf–*X±dÄ…÷ÊÀ’lépÍBøµW-¾‡UÃ­£ÆF‚'1]ªFTa1ûÑ!lÓ<Á¼ ø¸±’¹]v±˜q¼lº«rŸù†p°5Ø§usŒ‹¢«A·rÚPý|ù5½ ÃÉ@`/"bá-*AyÒƒáWÚ{Ó:¡¬[ih¼2>5 ¶†ÃÇè÷Çè÷Ïý„—Ú0@”dûA‰K–…WûŸ$¾ï]”«•@cJ*ÍU×Ý.eëþ™]ýXÆç*/R¶.þF][*™ª,‡\Žƒ#!p?ƒ¢K$NaÑÝœ©Z¼+¢Œe‹¨¬­á•FÆ,éè”»%VÕP–Òµ6öÔ÷í§÷ÉH3Z:¤\¦»Í­f¹ûrñÅ^ÅLì=ª\úháï^Íæt/ä0õ¯&%àÀ¾&"hÇ>u¡ù×©xÖå(­"+çÖÊa0‘µâ£«¤ò¨ëTL‚)h*ìmå_'TQ€@‹ˆê{1èäªb´L F%iks›0@{"XÂ9DzAzôTêäÔm$×§¦=ŽPýøåvœ‰qˆ$74ù	ÁL–'$Š©áŽXºŽ¹/¡]fÂæïW~|£«ð£òí«:p-0¾o¢@†õ­&œä5qóúI³»Ÿ[ÎÍ§Í
–îÈÜµµß¢bÌõöf‘o˜6½½pŽ¨Ü3Èå:å9.Õ2wD[µkÓÉ8†×Qò;3Å±¥î‹ï(%;€3¥ïÈß¯¼0¸˜ÍÖRûÒ6¾(Ïàgxóúø#=F ;]3ÊÛšÞ½Ã.fœñ>Â‘“Ä2fê	öVYú¨ÕÈC3 ©ïœîÆt4jìT7qÚž$­loºS¬:+¹’hâ/mââÃ7Ž„ybrãØànB¦›-ý*…¥Åç•Ÿ¡ß`N4½¸Nµpê”öãâ…K,<2ùîÁv‡¡ŸÔ~C?•C?tÉ–èé´!\1,å?û¬ïXI!.ã4éË¦8¯Ôp§¶é³©ÁÀ¯ÐŸŽx@­ë/7ób–eù3¥^WItI\'‘R•¸¤Å©„‰˜ÜDW1§Ù†yz±Ê.ÃzÝé§šÇ0l‰ùf'$Š"ã°¯H“œ¡¥ÿu.JÞ{‡«¾½,7ÉhS0Å†‰JÖö…y‘Ê¿ÍŠzdGŒ¦Á¸e,<ÀCÈ¬tb«ë).ó	³x9`#/Êu
B°É^qQuU¿ºµ÷¿X$/»îˆûÈŠži¢Ë‰7“yn£³¶QXü‹WÑ 'ù P[…•*:jì•ÖºŒùËF%¶¸ý Îd…*dU³˜Fj®é*.¥*XŠHöë’)¡`Î3WrÅëîÃ}2ðø®=Vå¥Púdk‡W;=Xe»i 0C>m…!ÎÈ‡óô#©}{kãwÚº³ÙÍå‰ÓA%|~×°éXDS%;Ñr%þ0¸²ïÇ®ƒ»{u-ÙH·+‡%4×(b—¡ü2ëÄJÆÅD‰†{§“È‡
i¿¯¸9Ûä¥£&í¾ò«óòVÀÎXUwÍ…öMq*ªº_Úw/,ƒ£ÀÿÅ‘tŠ_LÉ7/³S¦ÛÎUqguÝûF£?Iä¶ÑãEu¸K
;ÚÐÄ´›9¾³ËžîÒ(¿fÕ i´µi:ê„yO}¡bºÓNId¶uœé|ôÔ˜Î¾ØKuÛ¬6þ²îÚ;ìÂ
ûünSÑ¯dñ·oÑ¦ŠèÙå"úí•¾Ô‘×N½!I0‡ðýªHxIK_Q9r™ng­¯[i,:}(-…VQ'ÂËQ/¢M[*HA4À9uíÕ­lè¹«0¢òs„¯Òa¢iÄŸEw¶*oîÚÔ½aõêžè³©ø‹¤Øúõ“ÍÖz¥YP±7­Ý
¤‡Õ—ä$Ç×Ð©Ÿ¥ªëåMøš"Îæt‰JV¦ìâAÄû„Nf.ÐØÛ\•Ø/qrx 4Ÿœ\0õ}LÎªyÒõðeQŠîŒçÚê¯†Žï6jšN«ÖÔ–St9P¢)x‹)õz;;ð$ÐCès?©ë÷Í_T/Í¦NñátXÙµ¹-ßÐ3?.Ma¯Q54ž¦*zBgõ½bàSL°[ZÌöB£p¼«•öÎÕÁµ¤—¢HÐµB•YÄøs8«cÃiPÝ®vÄ‹?å€Owè¾rÃÿOƒpŒ¦^›zb±sh}Ä,[yr"”ã
Úå”ºê«v_ž‰$8±)[ª1›EÚç™	FÜÊ'F‘Íô…MS)çmås$’¶¨Á"Í:ƒ“Ë‡os¿ß‘?àyåË™<ŠÀ…™ñdåôe±ÂÄ‰4·l*/Rœµ:É¾a”0#D›¯ße3mÔ¾€EH1V7ûÂ?˜ðŒ¹/Œ¹óÀ4gLYV[9ç²!9¡-9Gú˜/19¿í£¯¹öhfÁ½h+Y³«•$ÁhJÔ !4£¬?}¾€<OZ4Þ€{†£1ÀîZ‰ÄÐs9l´1–ë‹òÙK´#5rÐÊðL”ý-Œj¢ìmqlew‹#œ(»[1Î‰z>ïíDùÄ{Á<áOÒ"ŸˆßõšºŸTe~èÉ±ãú+×Ã:ï¶2S”f…À"ƒÃì°UÆMS,°iÓ[þ°^!qNz.ÕÜði`®ð.Øu	ýYßÅ½ìê%VäÞY"žL
¶Õ5PLÉ‚ƒ\C~L+Ò}PžS³ŠarÍÆG³"§"]Ò}{³ÌBÏBî·šÔx\ŒŸâ¿%‰ƒR‚Eu±XCcd Uqóáª1›£AµØf&ì­”ýÃ‘¬l(9Å¦Ú4ð²WÊnšv‹±¨.Q‘œƒly—ôÕq4I2­J„œÍÆþßÿežgS½m½ôsðg?¥îf±E<žŒOF'£Ç“ÑÃ;Yïß û«ÉúuÏó]´¢ŸÉdùÇWõ#ªº~&Ïú²Hru¿%—‰Uó3,6x\žJËã\l®´>_g¹¹·@ÕŠÎ9pÑWTvîÁ-VåâsëõÕ•Ÿ{p«¶|:ò'+C÷à–Ð­·}Eåèæ"U(Jç¸\_UYº·h§#öòte;ÉB%»JÝ,R´«lS[¬lW©ŸÅw™M-Œþ(W§£ÿ?MÁºGúÿzè‘v:øÓ”°S82/bWêl‰2v_éU(gçb÷øÚ=¸5«\ÖN'+þ…íVëð\³s…ŽÎ:9ïÛÁùy›ŸÇ±¹€¸w­€Wðbæ>H•ðZ4~ÌÂ®­ˆ§.‚WbÓœþXùêh0mý<Ë}‘+÷‘áèkAV\3o!,jÃKsò{úòäâÀTAMÃ A0£áKç4ß¦ªŠcõõRtàŽPWñ!²˜ë¿äéAâ±Ÿá»ìf7oî5ÅýÓh^÷°w¨êC…³¢)g!Ž+Ã¸‡ƒ+ßêòKh|[-jøƒ²/˜©‡"ñMÇ1ª0…Ëäœø×føã+Y#%W@Ò2¸/BagY¼€ÐëV¿ý–œõº'}òéüãì´×'øOëH]Fè6y+áà0L¨Ìd»ˆ€Oq˜ÿàšBd†Üg˜æ÷Q`hO*0´½ÊCl2—-3T("t‘+"ŠÌ8|-×™XJÝŽ"Å¢³>)‘¤Šw_#²þÿ‘¸WBéÊ¯ývÇ~Òu$%he9£•TTWf
åXl;Þ=kšÁ,ônÖ^Ññ"¯~šEñœteEj§¥i×åâIt 3k‚:¬°zå ¬,›ê'ä:€}ip…cÆÉO°æƒÏ0FãzìÓŠ(Qƒ)…«G•ýìäMÒx±9[\å®¬Ì–ÅÓRuŸèüç4ÓtbÜ¦T{wx„BñÍç-¡å†Q²\y&n^GÃ§rQõ-EÊSŒ˜D|ð|Åˆp´OÿŽagÅ}ôi‰óŠj8Œç‘Ï¼©îÓÒ1q–ÏP*¡Ae3<òºþ~‡Ö¨ÈPäDl¨*Î^[ôE*„¡ZÞøE¼Z¦ŒwÌIez£’$¬iRéL‘Læ	0öŽêa*-¦“—o¹ðÊ{‰ùýõY	e3­©„G^¼ð1µæãÐŸ[ldÕŠì‡2;¦";._~ÈºB;©ùUók®ÚŽ¾· RËÆ¯ÏöQ™Ï²]«àªüœÐ:>ÝZÅ§Í«øè\Å°(Ãús¬™³ÃL‹¥Ý‡X4ãÑUA²@mi8†r¦{0,CÕóg°Á¢63t2,k¦K¦6öžØ{•úKgù[ï£ò’L5ŸVK0Ž†I/©ŽXáøŠ	©Ý¶âØ»i ]›ú× Yç5TÅ@¢é•3šÆGñ7D&ßë(Â2)¤¸Í<ºäc@{˜×6hKlbNøoL>±ù úáûÏ6b]^žƒ	VÃ‚ 9&8°Mò7Fþà²5òÃ\-[òNäL~÷WÎœü-ÝùÓùo`ü³ÏÀ£¦GI|zÁIÜUù)·ŠÏ¯Ò¿>?Ïv>° ÜÐÆhC $’Ôðì­ÿ‰¢OÏèÄu‡I#	~÷ÍEì†M½$æ(v¯Ù,›ÄÛ9‹+{£¥Àv›¶’rš7ÄâìxPŸxS8‡7D4³ÔÓ›VÙU>wŠÏO‰Õ”N.Mo†¬ …ñåwšM	¹ZÓ•îM£Ý{3Åõ	‡*Óµ:¨•YOÐV¢:\šŒ„ é¬('»é‰S!µ½.x&ºíŒRÎ1šmüazTÜ7$Tb)8"îÝ
iÇÛÌ\Ñ\ê&E7X÷°2p;Ógèw…v®uô
jCá)B"ŸÄ›W~;sñj|ìaëæBYI¾\®…øøøfD@3Çƒ6ÁÐÜ¢Æ§=] CQ<S5Ë`M%ïîÒMW·iØþ³	©¹îÑí ÷ôZjP‹½&™ÍA°R3ÂIÌ#&(«MEj»’¶ˆ
’òœŽ½¤†Ô¾± °x”GòHÜ¼bydÑA&^|£¢÷kN¶êŠ,FÑ±†Sb®1Mé%ydÔGF}PŒªû…MÎ‘¯si\XÑÈ“Qa¡»ü¬&ú£hKtþƒé¨±þ„¬ûqÅë†·dï¢}Í÷×Át]7è£t«)Ð¥4äHQ3ˆ`~S.…ÌdÚËì†¹-?Iþ-8Óð`†IÎY9¼Š©¯¹¾Ýl+vYÝñ,°FœŽ´¯¨QC”|SÄPwŽ¼«é`LÎo.SxLr^Oåï£ü}”¿åäÄ4Œ¼a+ÅA‚Fa…r5©–EÄÉH	4ã”U`Ž•°Æ½3Ægd‹…™b)–xp¡c+3¤g} v5÷JæAÉGåwéÒ}?;³`¼ToØkfß•ƒ¨+lØ‚«ïØ,>G¾atÙ‚ûuY–8{$cÉGÀ‡v›X5ÄXZëåÀ­eŸ¥Ý¾,ÏàŠi<ðÖiàÁêQI£Ñ°ÂJkm_k¯n…ô?‹£tšÜ‘M’~Ùæ^hÁå­„›œg%1Óô»1]šBP®¥•#ÊhªOó‚·)ß!d¼·µ×4„Ð’ÌoBÿåí-(ûÃùxÖÔŠÓ³—›¼òW²ÕlÞýÏ¦ú¼úh¥E «yVÚ^\° ý`æì^¡q¼{ªàÞ­½’{…þ~èSî­chF•çƒ8SGŒÚ`23Øp™	SU­³Ÿž‡‹UW{ÕŠ5qv)NÞ¾R¢)iáë«\8C$4Xx€AW™?j+?=›ÏuNÌaðª3E)ü>£éèÕÚkP*Ft)È(öfã`¬3³_ÑXÌ"†/²fƒ(ŒbÌF žc0t¬}bwZñ¼ÓÃÃ¬÷‹8ºN`†ÒÁ° yÖ÷%Í¸+ÆûC2ñâˆäi$¾åáíq%Òëbf
æÒžæ{D“VÚCnçÑðÞðD^Õ|=¶EÀ÷Ù¤Ð‰Dk›€±O@'®æck±„Ö€:‰0FÓ$Ü6NíÕdšd`h´¤1ÚÉ HœzÜdô³þbóJ¬bŠÊ.|‹ßÃ¸"d÷|GaH_7>â?	F©ŸÅþÇÀ¿väåAÆ|ÝVßÊI(òaÇ&iåšjÿ-…¸WK½cH_åñgJLQÛ›~ôL©Àl {D0X{õ7>‚å˜°´ÉO<Ð€f‚ “‚
¥{ˆV¾»ž³îõxô™ŽF‹>=¨ãJ³0ƒ
G e²¬–ÕóÜkMáIÓÁ¶¶u{½¤ç¥ÇÐKÆiúRä†n+|—”¶t‘¡”ßMwšdò‰&Eè0åü‘ùfO"švƒ1°áYv„˜$,´1Ÿ:¡Fó¬ÂÚâl²ž0sõJŒöæ½Î¼ÚÏé–zÒC×¿FOTçƒ:çðLº½=Ì¤›¥+˜SüœOOá{§´–#@8h«‘¿ñzŒ‚y4¦ŠkY¯3‚ÖfFÏ€˜¶ !*0K¦~°¬Ÿ?DÇþ×F=ý0Îˆ+Vš[¬“ËÀ‡X…läÏ»ÔÐ{H¿©e©À†>,CŸ‡ Ïƒßý³OðŒFÏì“õOÉ:Ñ%úß¬ý#Ñÿ>…ô¿mþ?(‰ëOÈÐ¿ô®ÂùOè¨ 1ƒòµ!þ0Ï¹,Ð>éù>/Ø}Oøý¯`d¦û	0ûùìÓúsCx%hˆ[[KúÖØvÇÞ&[îÙ[Â\aËgö–Û¬éö¶½éoúšZÞ9°<¬Â{$‚_<³55ðåßte,¥íØe³
ýaÆ”÷:ªÛ´†WýÛ[dB~„|É"·Œ(ÿéÌJhÒýöV?ua›…'ó¢_¾GoŽ·øõ½æ:â<0[2ûùýV£¹õËºytz[^ÌÖ‡‹,ð›²ó1J MØwajUiz, ¦^Žê!lK›O›¹cŸxã&›­zÞ·½ÕtIÏ&˜ßg)?æ„-®ÌÙë[dzvùdÍÎ@5óFÿÏ¸	Š‹‰§«ÙÐ›ÓAÄx—v§ÞpSÏhË¼‹gzcècF§mûÉ®;âƒŠQñ!ÞpXá	m”¡òüi1bÅ•7uâÑä¹Ò°QNlªhÐUÒË\GRèGïáœq^¼lB}*’dzÑûƒ_ÛA<}…ŸGZ#

RêE?†#Ú¶¶)V°Ã¦ö)ç9y9Ùr+È”PŒ¼³‹PK¬½L7†CU;SÞŒ4k MA|"ZGr GÌXUŒbú;«	ç©]–_‰Èû¿lmoomµA(÷i¶¶v¶š¿è’%Hßl–$°ï$ÝÉòG{·(liR2Ø'åõè]lpÒåæÅNªN{Ý‚Ôœ†°B²™ï&3vw' :ï“WqXûV3ô»ôÛèý3‹Œm°óO‚OðÁŸëÐŠ‚YxcÈ[—žcmc­=icM?¼µ£P/šÒT´Ì2T'+á é°s‰8™_â|ÙÀtM˜!vÚ¢-\÷fÜé°šnLý–snv9èšòE§UË5öœµœ¦8®?+ò4giZáócà±?àû«ù‰³ªkS]ìU©Ï½-B' ÞºX‘dîÅs* BtñŽctäzH‡ËõË5×±ÞP¥ïõšÎ0òu—ß˜i¦lIÂ¤e2á¨Rî\d»Ô>Ž”Ç•‘‘„2ÿÎÊF0¯¦ò’X»äÇî}BU­]îäç`>®­Ÿ÷[‡‡õun^IítÚéoðÓèÍžyqâw§óZîÏùH<á	YÇÓæÆ²ÕÜ ÿAvîfŸ>À¶ìvu0îóå§¨Ýâ/—ôZaûJÅS×ºÀòåÊ²¦À…üµ2Íµ,–ÐšsÿB	Ÿ"‹¤5m!Ê¯
œ0Õ6Ùf+FO®[á½ÎØlÍ£ûŸ2ú˜¼§j=­’Š…{Ô«Ñ	P.”]åg%™X‘ÃcÃÖ³¢'MŠƒ—ÕX®Fí¦Sôä:—»•psŸÒnÓI‹K{u—BEd¡P¾þÃ§XÙo%œÇÀýè§•pËºg+0ä,½ŽË£›it5§A"9DRH(Lt6I#Ob–B±èÔî¨¤ú€QMùÒ‚cÐKuÿƒOyäóUcrŽyø_†=W	,Ê±×ôüASð ÇxÒ(ÞâA°€ÇÀ»Cg> îêEÎ2œ¦ Úº¼Ï—¾Ô#Û™¯jlW<.Sºß°â/føgº‘M¢i„Ç÷-†çÚÌð\%„ƒÕ³éÁnëpç{Á¦Á°âÁõaðéÄŸ{CoîÝ?›ºrDEî”ùS¼Lîè«;Å™NJ Ž
Ô}]hbKµ¤^áRÕxDŒ9$¼ëq€£JM9¤Ò]Db¨
F%ô|dV¥­&š•žT}²M‹¬ÔƒŸ0»ª¬?F¢5ü@ZUžPÕVédé$Q„LYx¿Tñ£r»,D n§^R;ýœ:Éô<©-u¢º÷Û
tBÛ÷g©*Ûû§¥Ü6ôCêug)­íÍýQßT%t}âƒ«‰|VÝZî¬ZÁ†mz•Í×•øöá¬ÞÁW¼vŸo¹Ftø–ÅúÙG)ôu0Ú5}—6ŽéÏ²|§¯¿XFF÷»Lãõ[<ˆ†îfrÿÎ±øtL©™¼tÕW:‡ˆÏøÿ   ÿÿì]ÝrãFv¾ÏSô(.‹Z‹Ôßh¼VIrÉ’fV»#i"ÉÎ:ÎÆ‘-` pF²VOªìeR¹ÙÜ¤*WÉmž'/}„œÓ?`èn4HÃ‘Å*{fH Ñè>çôùùÎ9¬«G3­Ôqk	^wÝÄÄwObªš*ä>åÒzÂËnzm…=Â‰à+÷áõíSªk’¾?h~h®×³jVå…5½ÙÏV?›œoüiY^y(˜ÅÔ1iL¦¼îrKÓÙÔeÆE5.¾eìÀe}æß\Â\~÷ªš½*Š‹¿ÍÙvvRl{EûÄûÞýóõŠ· d‚½¥ÓŠÞ‘·sÊÀ÷îY2SûxVA×ÜE@ŠãÿÙd³Ï?×Õ?(z‚Œ­ÉÐuÊÐ¡_m¯3fÐºH³^UFík2s’Ó~†ØY;íI•¡p_Æ4Ü7|º¥à*Ø— ‚M2÷/ÁW!ˆAé„Uù¾#o`Ê‚7Å7í'l·dœvF}O4)ûa»µ],-3Áû±q”7LCP«2c‡¬·~½oxÙ­2	IÇïb2{pG@Å€˜ÜO@äxdÁŽÅá`@ƒC{‹Kk¹JÌëP+E©J!½¯PzIÉæJ\Ææö†N…jMhøÅïÜ»¦²~©Íó³×ß“ƒ‹ãòòü‚Á÷.Ž.Õ†©®mQ¤ˆ·.MÃS\H2þcXo¦;õšq;bhÐ^úðÇÞ-¿³·”–aùh ËJÝÆÚUë$Å^ºøç]ó×†éB‚´6-ú™%Q%·S…Dé½4…™1{[~WH”þüsËP2!:7ZFtè¢ƒfŸÙ lÄ%Ú3•9Ð+†ÁÌ)ÍÖ¡
#9§>›‡]YÉŒjMdž"íxòdcí@3±xÒtâ’$â²Ôáò„á²4á²äàÒ”`{"°&ý·ZÒo1Õ×h5šÒze2/P;Oåµeñæ’®¶^È¤«_Oœt•6—É™›0ÐkrnKÀrËº"×õÞ5ýAŠk“É÷5‹ß»õ9¯œ¥eÌÌZ´l¬Yf`é³®´ŠNá™OFUYTeN¹fæÏ7CªÖ¬¨:3¡êÎ~ª’ñTk–Ó¬2›2˜•§$'ñ™…éæ,J•*É€¹$$ÕðÖåÉF•^»¾¤¢š‰êIª0TŠLÑ$½€rs}¡ƒêKšWÆ™ÈKz*Ñx‰;5`²jÁa¹b¯Ê©z¦É7æƒ²,ûæyíÙ7³'×ÒlšJäZGÖÌã#×O6óeöäç–É2Ûì•J^[–Êã#óydšŒ‹Ó/FÎÉì9Ä)‡d&y#N°“…ÌqÌ	™[H•Üùæ{LãQš×áP®È1ÃÅª/5 J«ØV:¦ËÁØÌô°±¥`€(üÅ'(+$øËy%OTÄqOl_|5³Œ	¼ÃGÜŽ*ÙåÀìù¬…ˆ_ý*éÉ
Us|?œó…\“ÀyçhP=¹`Ž	%‰`ªÄ’u®š P_R@­‰ Áÿ•tÐ ùÏØ_Ì_€_€öŸ;\Z¨?	8ÚÀG-Àû'°ýØ¾”GöÅœÍIÞèÅ§®Ÿ»ªSê×ÃÎÓÐ~›Sv@wXùùÍDwÓ€"ýaG€ˆ÷ì#>"ÛH<ð†q/LâIpæ)uæÍ¯àÃ(1*ÿ-šŒÁc Ühf¹#šé/BûÇÞ68Ê_÷?´Z-_%ðw ¯››7¬aæxLÓ0kbŒð¤aÍ <6ØŠ¶ã‚ËPÁvL°\‚¶¡Xà*Hà<Ø Jê1ÀÌ8õñgû=‹äüš¼e$Ÿ…ƒœã— Œg€/®ÜÔÁ±“CnîEqY$l€/@xvð`8X×†{(àé1À €K­¿¹£kÄþÖ‡ü­÷ëŽú­óû„øâ×ÌM6UÛ hëÕìÊ8ß
œ>Œï”ïZ†î­ð²u!{kÁõÖêuÆô–„E?<o]hÞx–l[‚á­@ÉÓãw§ì×Öwê—Ñî/µ;KÂ,AëV Ìé‘º‡0?Q|î,	Í—;KTnJ®	‘ûxÈù—‡Ã%'8àog€¾…øQ·N¸Û9¡nÝ1·óDÜN‰·-AÛ–Æo¶³F½Wí‹‚¯}<‡C9L`0µ	#¬€¨-ï~´mpÇÒ.
|ÐI»À«îŽ¡]HÒ¯† ]à}pÄÎ.
é»!g?¢£¬/[-;7¬ìG@ÊN“µ®n5Œl]Ùñ±•Ð±´ÇŽŒ.Ö[&ÖëŒ‡­Ž†&lPö	û„‚­Rñá	«[¢y)-%ÎfîUûpÍ—™y¨Ùª&|z|vE.ŽOÞ\‘Óó£ƒ×*Œ5¦m'´ƒ}/h›úÃÄŽg½ñoëÇ°«mGßA1^º@¨ C’\£q$ÞÀï£œ¹ñ:.²N¶;”UxÀ*ô½[8ááÔ3Ä˜7oƒ`kØ|A@	nÓæ]¡Þra5ðÎ<Â+Ø¹nnÉ9^«“-³z;%Çd|k–sãÿŒâki_·Í,äƒƒ>€”¹c2Gü¢8f¥ŒêêÊË,¾¡‡g†—h	¯5$:~ÖóÉõ(IB8~ûÝÞ}ƒÕGr½,>±|ªaÉü‹¦/×C*Ú/9#ÓÏ6×ÅOò‹çë„w=”$ÉˆVdû‰n@’EMü.Guîþ>rxNz@Eådw¯HŽn‹kWJ× 4
¦}>®"»ÓÒ¹ÕEðrê?l­3ÂAÞ„mó¥z×ôFIXä¿ß-îsµ÷´Äñ?ZZ¼Ë’½¥ÙkTGõXer$)clpxý<[Ö}WôìbIßˆÞÐ(¢Ñ›HáaS~•¿xM»î²H¢·˜ÝP\K¯ø²=˜ËK	Bt€lŠ¾¸¾ù™UÞÀp wµicíïã/Öº PÀ±ÿÐºv`6¢LS‡è#ÎqBéh~µ®Eiwm¦ûq+t ÛXåÂ"ÁÊn¥•ùóH¬ƒ›
¯Ï~z×K? zçËîš7w©'ð]Yá§9póòÐuÝ«®îaÆt2Içžt|trE®Î¿½8;`JSQYê…Ž;~‚†ìiØñ‚ÙªJë‹®*•(G¨Hé4R®5éåòuàñWhëmÎoÌ¼©¤2ƒ."½‹a rÌ‚†ýÙ]Š½wDáøâ÷6§aþ<Á6˜¿cBG4Gs1*©Ú“îˆÂúÕÕ¶t3Sk2ª}^áçú—ëï{pÕÎïš†ÐÁmÌi.¦}?Kw6E“ÒÐI²ØóúCXæ¸çÉ•Ÿ”üjw=P30%:çWr7›ªõ	'TÂÍu@\=oÐ…KT’×±rSƒ¶ÀšïÒ¤ÅFÔæwfvš‰qÎhä“4t”s„+,bÌÀ7a{ï„£„ù˜XÞ$ÿJvs`üW˜‹†¾tÆÅÜ÷ü;:Íc›Ùs*ï3»ë±nti{¦¼/@Þ¨Í*›!\²ä§#L¼1ŠT$±t<#°)G.ø0ƒÞF/x›¹,Áhýý¦Äô°ûÇ`ØÍuïán¿¸óñRÀ‚´ëÇðÓÉ˜¥TF!eÇˆ‘:r´¡>™=ØH)6:ÑŽòX™9ë¡×î‘5rE½>9%=QÂ8õ”ù¨Ê!o||4àâÇc. z”¨FVêm-8üŠ–ËŒíE³ÏÇè6Ï™â@äy3R»}©åéà0òm8‘.+äÅwƒ6ih[-â±JÏTJ6ªüãÉ³ŒÒ­ûåî{q€ê~’,"~3A¢à×n—F§q·±ü& ÌâøâÁýÇ‘a¦/<°¼J–i…Q±+$ÿðð¦6²©ãMñ8é=øwH¶ƒ1«fÐÆõÔ«ô…÷œtÈ×Ä­oµZm#½+;D³3º¦‰øy›4¾CÝ3Ó-øzã;pÇLWR¾¡ã‹Å›®t'ãøníÁ‰d‚lx,Ó1Ìj¥ Œg<XŽ¢´7>ÒÖü¢¥ïƒç'$ö8ð'¾
/“0òº´!B{“Eé.Wé[q¦I’‹Gí6c<îq‡ït”­És(“o2‘Ê­; +	G¦Š¢˜«"Â.aå?$‹nÁš]ßÇ//ŽÉÁááù)ú½¯NÎÏÈÑñÕÁÉëË¢#itƒvûãW”>9ÂÕÀý«•¢,š~n¿ù©7|ãª{ÉÂÂ~„ ³m.i‚dW³“ü8OÌÓ ÖG^ ÐCØj”•.j‚Ã¯–Wnè¨ ˆ ‘æMÑ´³VÈ$ŒÆiá]šñ$2¦h.-í¥V¹ýŒçØ»¯E¼¤i¬Úg"¿m³¸®§¶dÔLÇhiÿuØébÑ¼ËÄKF1XoJ‚Fm¶]<¨ú„NÁªg¿ ˆ§ÀžŸaýùìËßÓx¹Ôçtÿvlj"×cˆB Cíæ@ªÎŸ ñW„E²Êg#
ë:B‘ä"¾â¯Áþ…êIZÀÉ<ärlE+æ³É¦Ó¦ïæ­GZþåÏúO"iïBZ&butc°æØo³¥©³ð“')x…Šòú×°óHR)I¿{.ÈŠ³àtõïä,d¤EAš]Òà¦yE¨X#}áfV"/›/¸Z`iƒÄý¼”,zpª³³:~&0è›(|ï#ˆ³qäÝÅ+¥AFH;zìûƒ½¥uýoŠ›ˆšMç¢gH“ŸQ½Ó-BÁ@k=X1íÝó‘¾¤4n‰â¨?öp¼;0àC¹JÏ€×RkkÚñ‹w€YÇ`eL—h«Û"›K5O€êp‚ºÅNôšÔWÅ\„ý3F$¼!¸„-ñc"—¢¥×ÓÌÑ¹Í3‡=Ú~×<‰xíüq7Ë0MÖ)ØsaóX<¦*_¨7×Êm1ðèqf†Ì]
3ll“óvB›;pú¼9]yäÌ¤³–ø}JÄR‘¥ÓkØ
˜NþX\ó#kó\iœƒZ '%59»8¸QO³ÈQø!Þ»ßÒQH–sÄótZXFÜåÂ-*¯pBæë+PH:Ìß×FWb´J.Â°Ož¯o¶#þ ¦@66“#üM ù–ŽÊ¦%øÊ¤‰‰šì×â„tÑt7ËLQŠNÐëÀC0rHFX„–ÒÂk/ 0:|t°¸¤þ*»%§Þ0&¯a‡JB²:8;FQÁ„Ÿ,eãSð!I[ÞV™¶{I2ŒwÖÖú0@Ë[Ý0luƒµV«EÂˆÈŸ»lZÀóìJüyDÍªn×#Ç§!è7^ŒþÁ%êÞø"qÈ¾—ÒS'©ûÁÐ8/³Ü£\%²¹æ«‚çïe&N®é9Å¡íy=ÛG¤v\¾²6¦ëý<ŒËJ•uR›‰ì‘¼&ãÔhó,cº.WçùëV@…Km"}œY}¤TGÇOTT%8®ŒiTÄé`óÎoºnü©àÖ5V=UyÙÉ:^œîšDz«øwI:3„”Øéò‹’Azrƒ¤¿“ßtëê®ìäöNc¡õˆx™4p,û*|éƒŠ‘„Q<¿`
Ú/×ÖÈA B–€¡B‰‹zçûÿø7(jï½õc½1&êÌÔœ´]½þãD·þÁkþ|Ðü»õæW`oË+­$|~ Ñ!èÃkðÇ°iðÑáQ¹É¶€à;™Ú«úPŽ¯à/a˜âZ”ç›+ïöLL°a®s‡l5ÚDZ“±T-LU[MÃX³V¨R·@ïsPÐY«LhÛZ Å33Ð?æ\+=;q5Àø3Q²I*$C.5–^ÂÌ`JIÊéžnê;K«ÇÔOR}óñxHÞ`l3DFVª¸Ìv”‰ D«ÅØP&Â)oÎsuˆ>3JFýÞjaþ¯Ù³ë3äâ¤áL^9<?8ü9þýáñkrqüêäòê‚X´œ{|šWšÃéÚÌmö@–L×7kJ|M(—ç·iBûW˜øæ^'CÎ<n{mŽ†‚1×·Ò&Ò»áZŠ{€LŒ³a/–ÙvÑ¦¾ÒÖ./“Q+S5I¥¡Vã.r(àž`ì_„1®ãIF:•Jáaßëìê]ýëòÆñ’Ø$}4oçX(±˜.¥Z¯ÑÔç§²W5÷¥#Iwº	<dNfY‘x¼âuo˜’ð†·„lüðëÅßyÏEõ1žh†ëíØ#€D]¶£0¼ë€VBGåóˆ¥'ñE;rÿdÏLèlì+Úbµ5’V„È?Ú&òµYØÑ£nÉÊï¸¿#ë[d,o³×„¡)²B¼­÷ÜV€ˆÀîŽŠ3([µŽ1‹Ÿù6æ¹£;~[ˆ<¹‹z÷|
—tÃÎƒ …^,}¯p‘Ÿ+¼Ö¥1]Ïô”ZP6@ñðTo?øI^ÈÇ€’ÄQ/Ç¨@G:f}iWÉAÞØÇŽ„ s¯ŒXðbÃ„•2µ˜¼‚Ÿ±ß
$1H.“îÈ	Pø+Óš›7ètQîÏ´‹V!ÞkÄü¤rT÷N@å±…;æ–[¼ð3¹rÔ§²LëcÒû¼’âsé‘¶BƒjÀ1éËYqb—Õ¢‹PK•UËÙ|A›T 5Z·A|»bª,lôwj£6©ÈÜÜa%sˆÐ–¾	o¦IZ]nUm¶ä\Q¿À²…’yéG`¥ %)ïuÅb_¤$©Ýv¾†×•ºØ›BJ[›b?¿¼V/&U†S@é¢Ç)€1N‡ÉÞ#ŠU‚Ax"$Å¹v¬ñe,özÄ
ÍZeÝ¨õ’bDøÑÓ»‰¸tÝ¼MçP±Ãv“ÝöÔžÁi‹Y{…µ[.ŸØæ59pmË²Ž·¼¨/ÿî"…^áQ\Ù(a·›«kÚj³;ÃÅmø”ûmìD^W=ùz4¢ÜE„´d©ê
ï'¬6L,œ¬/ê0¿Åà_@5ŒàŽ¥p(‡§eÄí£ Cs½Wã:šDwÜG*V·v¤PÂº±‰ˆŽÚˆ]:ÀQ=j³ô=°½§»£ÐAô
t4¯ëPktZ¤ûÅœ‘l¬ªbV§•\·eM	JŸ6µÖ);³mGï›a/óé4Š+H†¸#ø;b¸åÛG`ù-íÛêôKë;õÂ“ÆA€'¦yhÿ2‰üvŠ¡DZë1°µê¬¥jùèU#ø¥r-ìû?Sr‡º,¨*÷¬: Û‡ëà7~ÛÂ¾—LóBô¡"ƒõÄ2 Æšô€°± ÿ‰á7m¾V ±26á:q‹œú1^ÓñïÑHæ˜ŠÔeXÎ¶7V ÚP¨¢ËÊë"®¿óˆ:-WÅÖ/ÜïðÂÏ‰²ŽçŒì¢Ûdƒú£õÛ1>½†ÙÚj3½D–mäTqÒæS™|ô»{2¸	mÂy”QØP|bYï6°,éKæEÆ`Ënàïï‚Ã>å:×†:Õ—È ø;VRà÷ìƒNŠß¢õ„ V¤Œ±'ª:ž_Ï³y[Ìƒ—NáŒ_BJ]zIûìïøÇòëåµå7Ëí„¼»•gqvqrˆÄÌa<õ2óa?žW¹½q¨ €0«™•Ï”gÆÀ¶°ßøœ>ê´xÅp°l¯Ùo,@Ôø>ÍÓÓæÑQës.hõálVÉax$¦«@Ýß¬âú¼™ÕàÖçï®´¸áRëSà}Ù²y?]/2ï3wHfk•äópˆÔ¼Jú#,Ã‚~éƒÿy<,k‚™ÓB¸š™õJs‹¢õ@®Hud‹>^|ßð‚xAG8j|®êH2ð,ï…!aF)5>ü²ÝC<ß{7 øÌ}&e”ÈæµOâP”çI'qOoû(»üV¿§ØáUòÍ7ëë›uÊ­ƒñË2F\c™ 4š1ðœåµÆ9c/ÎŸrþFý*ÁbÐLðÅ	ƒ6b}¢†€öŽý†°åx!ÂPX£ ¶¿ê"²Šù4<Ëk³ Fê‰ëEhÎaÎ,¤üRÜTÊG]¤µ´_ÁVBó û³ì%a70w£ÁdBo¡Ü9'ãÉ)NšºßZªà$àPê®?h”úQ;ÈAlIé’¼ å|¼ÖrgÖMx0ú+m„d÷àÛnÂ–|¹ŽÕ¹6Õ·¾Ê+˜¬ Ò/Ú ù²=n)¿­Ç óÃ‘Ö…ÚaÑv‚²«ú 3«“Š™,ÜB¼.WEœŒ€s?ÃCÈéNþEÒäÆzþ|¶/†ÂBZ%>Ÿšzt¥ºîý‡Lè.}ºØ›r oÑ—=µÇÖ:²£¾]R?bû€"ïaê-Ø²³Q_âæÞU®¢›*C×òø`_² ‹©_’E{\Ñý§™ð&¢ï}ú¡š;ÉY@VtUmîb’Vu8™ÊD"‘+(‚
r!æu{*K, „ú"O&§†T7~skm%hf‘qöÙÌ1y%@„Ý¡Ò€Ð3Ã;•srH¥›ð°[PVpÊšh#að‚bd‘­Wrø€m„"er«€ÄaÑÁe‘_I¤	"eÁVãf/Y'^Öú«ˆJ§—Ml-íÿõîZÒ«zSêt™äfÙŒ¸úÌ™±FX?×êw3kq’SKl’›UsÊ~?ü™Õi+eí&×!°žòìü™/|òÐ	,v¶ádïÜZÏv>‡HïÛÌ_Ä6\ÖÝ2éäVR1Ðõ 1x,ù‚lÀ‰›X8Ð6xîPPÏóˆV}ì’7-ŠsÖ®T£³¨R~<ßÏÒfÙ¼ ÷:.‹â!7£v/ö=©î±!äw¨ñg…§zõæú²¨’–´ÙÈ—°ÉÞ­”¾Y.iHÏ?ã6ße+äÒ½y’m×IXÛYŸ…‡6OlcÂSá<Æ&‹ðSftèJ…ª³œŠ÷z(í^*Ÿi:ôÕÒW¬t•i±ÉŒ{d»ÌfòÅ³­h¬å2ÙStš½Ì){XÖ3ª<³ÏÈ¶J·?Æ&æMz¾¸…¼É©ÂšºÝ*%uUªø¼oš.nÀ™M†2Óå¨j`aM9?ÛÎ)·–à´¹%—Bg¹)kvT³g‰p×Ì+š¤@1S÷3=<,™Îv3VS2²Ë‹ƒ9@¶' mW„mWnk¡ÛÎ¤7³ig’ÓCµÙÓf‚™jÛ;~Œb®³W
ró]ÂSÀ<2”[PEÅa8¸ñ£þ˜^øÍö=»ëš2¶­ÙÙ©’ÆÜËgÕ5D	¾{ž¢ïaÒôpú´Ãô¿,m,ë
¾éˆâ¾ð,½é°k´h.èMDãÞá4<Íyú£×Y
·t­VË¦IîjÇÁ,ùªsg9¡Uärª‚E‚ŽÕ‰dqŒ_E×ôÚŠúµ~U½¬µÒÔñ·ç'gäðüìåÉÅi1?«°a—	8£úÖO‰‹”ø7i‘ìÿ*w×r¿”"j[K‘°mCBŒ{ÎŸ®–ŽÚ ‘ƒ{4`ÝÅ;þƒ­&¼t¬Rì„ƒõÓæ”Í’á·ciòTS<Ï÷Æ>œ¥l*dè–"lÆWéÞg‹s˜2?r ©l´›¥’,í+ŒÁ‹XÂ&ˆEŽM¹[Ã¨¨õôä™b‡ ¿¥^Ånc[­“Ü?	ƒúk¢ò G›²€ôa˜û†ÙÐâåQ<^hd¥QF1¾®p“ÖòbÄWDÿ‚Â@w±øÙ öÙr%fE±ß#Hà‚Æ>æzy-ªÝ5j'_áŸ3œLå3Í‘±Ž­h<!9´3–ÎÂ$­k¨jwê]ºtè•FA /n©AÍ;É³#§¼ñlãUH>‡ífTªÈïNWÈ¯4¼:Y•Bs½çbMÌmmñgQÑPÈù®›½mÛËéP¡ºõÀóò%Þ\ømò"…N™ÆSäíËòDð`=Ž,™Ã¹²Ï¥™Dþ0Ce+cTaß‡1´T%V£è`ÉSµTâù[ïgD8q›€=Jˆƒ6é>&ZÑ6"Ë•lfÞÚ«˜Œ1uÅÐ-2Là:‡óÚ¶N×Ÿ‡ó´mXl e.V½¯
WWH¢åjàïîÂhÔõ5 Ýxf»Ynò8'l¨4SØ,XWlÅ!ÞÉ­=q¿¥©.~¸cµ˜¯Ã[Cs]üø½%”`Íw|ôù¯øaƒ¡×‘áuNICH>±Â¼šâ>Y72-rPd,
Å#ÑI·Áqë¦Vl‚EY&j,dJ·IU	c¨ –<HŒu³ñcö`qnê%ýàeå–Öˆ•sEÇ4 íÄ–¹‹Ÿ¿üù?þ)%öÆ%l¾¤Uea0þ£Q»+Ý|=NŒëŒÙ5žkè¬R4ÌÒ—õO5{Úå§¼ÿ­j•zO½¤×ê{·Ub]­&Ù@¥“Ý†9æ‰Fñ´¥öw¶…IJþ¥ÞÀ"5ŽƒéÆYÙâ»MóvX:åˆ+ÊÍÍ±F‚(òÐ´jÀÒþ}q½:e ŠyJÃJ_<bêøbbê°ƒ-Ø`ƒnð&û±GŸtý'Õ†|&ÐÄ
O§(ƒ<:Ý@.íLuƒÿý×ÿþ¿ÿùSJî¬§Ï\5Èïý/S5P‰×¦dVëI50\QŸj ¬÷b¨*¡Tƒu<©úßëT¾ó#æ2ºòè»á >)	úOª$¼ç+6’ Öz:%AäÑ)	rigì@øçÿÒ}ã»‹™k
yøej
*Û4…Ìj=i
†+êÓ”õ^MA%”‚¦¡Ž'MAÿûDš‚ë×õG¶¸ G0þ;!¦•(
KáU¾X¨éŽÕd˜Þ…#†KRnœAüiãO›‹Ê6áÕ@¦	=i»ÊëÝêî .ä@æÜ›Ëëáõ²ówQ­˜a/ðŸ4/âØe^‰Oë2¹í}¿‹™Æ[J¦ñXØá/Ûë3j'¯•4ók#¯'"ÇnòŸ•µ•ÿÄHèßþeÜ9¾qäa3Æ«È{}Ð½»ºÆ×{tÝ[÷E¯}MÞžÜ°ƒ
kKX?;¿b½Žï!@aÔõþÏXœ–óÒ*»˜Õ¿¼¦ (ƒDöà´Ã¥IøÒ°4†à€sðâ4×Üù]ÿÇõ·×ZoµóÙ!KÈ¬4Nâñ³›i?uÖkML¥%7CBGÆO–óÃò‹#¬d•‚ITpŠ˜ðq‚GØ°:~Öå0ü’»pV7„þ›%u½‹´Pí8Õ˜dÿåez©Ñ!QlFÔ©KÖ•^)Û%ë¦NjJÛ³%¡óÂ#¢òÔÅ%™¦µ´J–Xu¡%C²"Gµê›¤ßüZSg£¾|wSÌÞk]7´X?ó(÷®}”÷æQ2¦Ÿ}”$L¼@b‰.ªé‹~1žíé#µ­Lqwµ£íîUÚ[3¶køÎ«6Ú43ÚîO
Å]¾À‡áäÖ )Ó—(EÞhV¾*œiXŠ¾ö-kä; .ècã[1YS“I)dSJÇ¶¸:=Åtë»1·ï¤Ìbºx8fê”L¿óîNÊp¦‹Ã,«íhÙÙt³ßÙ!o?Ë¤Hø‡?Kí¥„ýðÖ46j8'tMÅàÆ«#Š…=’¤‚…’È '—çÒc¥W›'hÕË	ÍœÁ~ÈfÞÈNÜ|ù+ƒ›v-¼ ž”6ú|{©41eËI±ÊM!×åÙ[`Øðž[§êWŠR ËÎ-JÍC”	—O¤KieUN—	mÏk’¹‹Ÿ¤%…ÑIœ"GùèøõñÕ1¹89{%ó’ÍK‘=¯Â#Š%ü>vvò,’ûçäœYS4š¶gŸW\4­¦O¬5°€6lß8ûÄL;Q[WKì´+¥¨b*S1=·Bîë…2tÍÉ¯(¬é¯ÕÅÅï5Ë8U6¬5ãµ4ÃõCs»Állf±
]µ‚®±Ü³s‹¨™8Ø˜ÖíÊèR¥u•ÃÄ$¬­Øz[…Z»cbMjSzYÚ?ˆXÆaí`˜oÊ µE:\Rf©ük ë­â#¥‹
í æ×ˆŽ£¨gQrÇ~wÀrˆÐ¢ÈËáâUÏÐåöíÀcßÐ˜JåZ}I}·+ö§‡1%^÷®+þ¡¥ñO[Ù`{sË±{¤LÖšÏj<ù•´±’&]xi·ÖÇ^€2WžP¸Ë¬ÿ{P€XaUid!8÷Ý1•Z±ìI%¿,!W˜“†+•¾UÄDp‡/è·TÕXÓ¯,;êrèh ÚnØ¡Ï‹èÀC#‡; /êÄîomH^Õ|õiz(+AO.JíBÒ[Ú%”«¸¤•ãíK*N¬ëJ•:üâKi.ðÓ}Ýag·ŽtÇËì¬…ôK0äþêÿ  ÿÿ J0.