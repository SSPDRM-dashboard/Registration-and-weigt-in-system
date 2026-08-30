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

                      const handleChangeFieldCoxœì}ÝVãHšàý<E›˜.llY™LBÈ,¦øk «º7O-È–°Õ)KI\40gÎœ³·³—s½×û4ûóû}!)$E„BÆäO5:§*±
…"¾ÿ_/É&i\¹ŽgïÛ$ŠC×,“~àáÎmòÍÙÜ"wÿ@W?ð£˜ÐY¢þÜ$'Þ·w¬Ð~G¿mXýØ½vv‚Ñxé+æñvL“ÍÙYãÆ®ãªåÚds“ÿ¸o“7äŽ´Z­+¾îtùäžl+Í‡–o{Î‡±mÅNn¹é47ÃÎNx‹ï?f%:›ÝZ\&‹Á§Eå÷ÿøŠ_B'ž„>i(ŸüÚv¯‰òWB>9ÓÍ;º;°U÷º‘vhVÏs4cFÅVoÞ5œ
XÀËiÁXç¡åGWNØŠœx>7cç6^{–ëÃæ$ëÓì°d.çêÊéÇÛžÜ8 dq\;‹USô'aèøñ¹\¶úž1˜²l»±Œ­¾O›kmõaáu_¹I{¾m¼Eª5…¾Ò\—u|í„Æë‡Î5¬k×¹²&^Ü¨<íÞ"ñhvè_¶;ý8<{Þ>÷ø§uúc0ñmÇnzü4†	ºŽuíÌíh¾Ž·
ÆŸýL?ë$ü€Ò(	ýf‘$”¥bN÷Š4²Ÿ?¦ÿ.á)H•*ö4ág7Ö˜óŒt"cÚ¦;aíñÓ9²FÎæÂ8n®ÂóÂ(Þ€?Û$²á4§ÍNkô‚ÐvBþO3Æ][x°6Ÿá(Ã8¡›¡;+ë$; asZ=ÂX÷†ðUN™ÐéÜØü¦åyÄž„ýÐYo/(—¾¥y)ÊÕ„7»ò€ƒÿuÅîÕ´ÙsâÇñ	¬t5ûðN¸ ›M1Ÿx?ß«[ºW#×oÞ4ÛsÂ¬ïCwü³ÆnßòÄéoà†ð‚b“þÏvG€¹½Œ†€!Ÿà1d¥òA°:_| óc§3¾ý•\¼ÑìfeÁcì„}+rðhúŸo\?Mü>ˆ$ddÝÂ+~„‚)¶¸„àÃä÷¯Wðiû¹Z1¤°æ»K¶è—¸æl}ÂêÅ•®?ã‹ºv#¤í(j	ìEæØ§že/Þ_ÞWí`y®ŸÙŸt¦]Çs@N[Ôá¾tÕÆðm©Ø9@,BùÀ}0xÓY ´ñ—æMh«»rÎ<Iñ\ßIÈArrrYsèÚ6¼P€õÊgÂS{“8üÊq rOÇ°*6\Md²Ëv#nA(sí[ª3´õÇÍ®ÀßñÜþ'`¯”»2JïG)}æþ5/.™L&Òj 5„Ã3 ²ºDÔ[mgß7¼IwÔôØi†L¯{+\½í„ü¿ÿõªg…m÷×uŒV¶<ÇÄCÒ$¹©Üø¿ƒSý¿s;Õjâ†×ÝÊÉ¶çüÊg@Xû1hÂ\©ÚÉ»‹CÇJBÂaør$ü·ïMzø¯‘TïS	säÄÊ€ø÷?‡ýÀvm¹>ŒÒÈÄ7ìÔ
túz]«Á¦^[ÞÄI”jß•üío$}Êd=Èi<ç*¦l†ÑM3 ¸dŠ
ƒRö%…SºËéS—AŽ™ŒN×G¬ˆXþ´. 3B­#íˆ’ñ´Ùž’=•=®‚þ$Ú&1ÞÆÀš}ÅgCÌ0ÁôØ=X}M²ç9PóÁŠ×ÁÅS~x>[l_¯°g˜'‘Dw<Sè†°¤Óº„B¸j$@ElüŒHh*ÈˆuPº€Ô(”ž¹¿9&Èc‚ªïø|sÁÖ¯_SŒ¥P|]“»LÎ±„·ÑÂÖŸÏê XiŠh´°uvø )z ¿,lî>ho ¤çýƒ¦¸õ`74EçèþùAs¬â«µæÈè•ÉàmÏBk‘h&•X1fš>Çˆ„¨ä xMøFtÖæúã‰¡ID^ê!0Ã«ub¾…²ÈÁ	6þ’ÿÒïò×)åF!åWôB9%?Š}:Âj[N¿M%™?ì®m¿[ýÁL”Á«šFÒíVHãå­0p¶CúÿÄžu5ñ<	\¶.–—TØq³M>>ßØhÞ8½OnÜ¤§ÐŒn¬¸?¤õØ	ÝÐú5¡¨”Æ¦æ£«4±Ka(z™Ú‰FäÍR‚-Æ B®/µ	}UÐfb›â;Qm¡2V|&Š‘™B\G–*±çÁ`à1|¢ö-×­3ÂªH´Ö…ì&ôQ"Kdv»œ­‘›{Ve9'$o˜38Ù7™å	=ü³’˜·é‡n;3gãç ‘Á´‚y‘P_E LL?‰3Ó/`êŠ™ï/õ{^ßn¹ëx)¶íj{eµb_ÿÚŸ{)˜)f’ãŽd°l ÚNQUB^=ùä$tFîdD~„o›ï\ÛAø'ÈHÈÊ
0àÚunJöˆ¢pá6€ð5‘Ú4@pˆ&á•ÕOˆ&HL2ùbÜ|Éäjh…)äÆÝœÓaÚ|ÜÀ²×D#úŸ¦$ÆÍ%é£¸Ì‘¡5{9–¶Þ&ã:„fðÈùÈm¤BûÌpæ¹·¸í»N„Z|²û3k4pÞfŠ$ykÙgIEÜLí•ÄùA­n‰£±CU.ó::€_m/l¡˜<'èP%{>µÓÉW%‡[Èý]²³}ºKÞŸnŸü¸¿CNN÷~Þßû…ìoïíJlaJÑ–Ÿ/÷Ö¬®¡·tÅ1ÈÌÍ•Nkí×
ˆ\yÙ.‰2Øð†<¬âÎ…  X4ã ÙÉUŒšÿÐév;_*áC{»³ÚiÃ:|wdÅNó
·%`t—…ú ûÁ˜š·ƒ¡§²¼–SšâîX½ÐÀÆõ#ýœ¿Á°ô>¾'ýƒ5 Ò¤ù»;Ò Ð}ÚYgƒ\NB¯ñL±¼û¥Kr¯¹LWÓóà¡(WŽÜ[øàøvs4ñbwìM¿×’o%´´¼Ë†ÒóÏÝæÎ(8úŸ&ãÏš:è%gÌ®œåüÇæË—¯^-.KÇ |£?ü¸}x¸½K¶÷O?(£<ƒú°}°M>ž|8%»§ÛïÎwPs8Þ2ÂÉÀZ1¶Bx¦¸ô=œíîù§‰ï‚°Úè¬7;?¨Æà(€‡Ãlì)ÆÜ8ÈVvð”aà¼¬¯(†Û¾d·Ýi7ÛkÍNW1ŒZµa Lh¸—1Svzc8®â	ªG÷ƒîÿÐ¦×â?’•ò‘ýd³À2¢³)§yHŸrR˜'1…Üb´aÁ†ÜF 0ÅhDÿA»
ýÃÐn=úO—ÿ»
ÿ.'¯ñ³å¥‰Éê(¶Š‘°rêôH¾N¢Ù¿[JÄ t‘°TP¥§KèÀN[7†¾ŽêêFÁ«ã˜5ÝØóƒnL—êvtƒVù u$éä’N„ýüˆù+*}Ù¹Èî‘:jƒ•¼ñ·fäqÆ )ë¸YQæƒ&@"XUÚvî„PÓ+×^’D›r9|‰E â(}ÈFIÕf}LQeÔgº1Þ¹Àæ\È©oÃæKŒúÉ3tÎÏ‡ Éµk±?àû>ýƒî^¥Æ&º½è1÷h&É~GšØÔ@W©;!õ~äfŠý€ù¸ÛMœ0ïL¨žs± Kzµï>/ôƒŠ&¨Äà#ÈúL¼«Ž^)IÀTìµÝhÌ@B
"ºm3{n$ˆH‰Ëcƒ4PjÑCŒ~qãacñì|ûÝ»&À,à÷¸•ð[¶¹ô7øé¹|vœ:röý¸‘#ô¼Se™Ñ¥eÒi/‘ïÉêýøö4Z³{xXwÁ6•”îï·D±Î8¢IÊµ„¨²iÂûÔZz™< ‹ž/qÀEÒ°0¤–o®YdAhay‡í5`_¶ÊŸ@<9¥"¡†Wvx¤ÒC#øš$À™3}^9“ÁÎ¤û"ÄÄçã7Ö}1Ý=àè¤oñ*Ÿ5r¨Ž.5<ráEF`FÕÙeHÛ«é¥b:)e7­@¼«,ox²«lWé¬lÑy‘¸’„xX‰ÕGÅ—zÚ¯PÅ]ß¯ŒaVû!‚9sËE?Çz9ÞttÛ´&q`bÊg6³š¬zÖ‡=ãUÆê^xd¤y ²ÐàQ?E:ÿhˆ'ô–HbÃU	$q!ÅÔ,›>Mi “ÆÍ®T©¨îd(¤2ÀpõëlêúzlõõX€=áZaÖF‹yäŒ\ôY ¶B‚Mžh hÇ_7Ìf‘`&€‹÷Ï¤\pˆ÷Ab­z‡'ô˜7zuO×§ä»çhRÌ<c2¹(9ÈÇÛ$þä”o<:ñ˜ŽN çÏ=vàð)’xTt2óX$j›É,µª¼NU-1'‰j9_Öj›Œcœ«rƒ±´LØp0©ke‰rÉVˆ4…nÁü)äßA$©aué¶E³K§v—å:O­·Œ§Ò&4Š—éƒ>nQÏ‘éÌæÔ †VTIšð…~µÀÿ¡‘;jv©³+Ææhp§ûpSÀ7Æåê˜ ê‘1›2Cv/ðòšø‹¶*\"‘+)ÜÚ±bg„Ó:À©²#aU«3—}UGÓJØM^[»¾Ž3zOm•ó;¡G?æïþý	WÌ,?ZØú…úí¿Uô¢~¿Çµ°µ{üöB;è=Îa|9-ƒ§i™(,bþ[€	!…M²i"éi¸~æ¦ƒ›&Ö#V›o&è<¿æA™Iª¼(h=~±2™¿¢8^†'‚‹KÓlçs*©\—Ô¿xø¦[XoRA0LoTÖÈÊ®‡ˆÕÏîòP~_£Yi™P=«›))¸‚É%‚Y$gaa"So¤ð¬?î –ŸýüÞ\/ãiF—…ÈÈûgÌ†r©­ –¿0$hónµ[ãH·¹pXC{æ™¦‡V8pýÍ»+Ë‹Ó6Í“jê±WªÊhj) Ð~7›qçùó‚E[aÅPÆo£IÏÃ¸ÞWëm
àRÓ]ÞÚÇÊuÚ‚$Å£Þlò5òqNÌô{´‰›pÑ¸_s+fYðÆVÉó h•EË$ìùq8%'°NC‹ùÕF1=ž,…+Yž «Íò./ŒË„W·Ø íÖËu|µ³>Èkq@lwàÆ–çM	°xàƒänFFç¾ïx-šûÂÝ­ESÉW(–û4î—ÚÄ­Š«‹N*fUÎ'™I¶6EJOõåDšÞ0²y°æY©Sw›·°KYð¦ªJV[•(¢&ÍÚúÙ&€I<ƒåý„!ùN¤ÌV«–O»L0ãYo[Ê×i^LDn\Ï#ÇÑŒú–ç f
ù6†H‡Óˆ–Û9}Ù¦<7"ÕÖêëä–t[îúÂ¼ià““Ýw€Ë£±ëÑêlf =LL%c-bXL‹|ÀÍ¢‡þÚá!âÄê×ô¡cž¾ä³OËqç(i0‰á§`„8mÔ*oIIÕ^Ê/Ä¢wA8°|xÙðÜê1b;ru…$Ô‰‹	&Eà+˜P;Äl™Iõ%åY8+—Óç¼`þÏJÐI>Ú; ÃµrÍÖjåš½eU&é²Ådh•ü  je‚IÜ=Ôh-zÝtâM¢|„Æc­eÈ«iÚ¶m²JW0"g”©J ²"%{Å­K¶{M¶OŠ±ªj%¯=«çxÕôÊ4ÑîÂ'Nôz…Î,}¦ºNË=Æéä™Ç\7HÑŸ$g ¥\ÿÈ‰ÏÄÛF¹ý”ÊaœpsÁiqIš¼u}²Ý›È×(ÉŒ¬ªAÙÉmsåÛn¢õßFìÖ¯Œ"LUúë†™Ó ØÉ
9Ç²:°ÑÒ)ÂN9\àmfpñ•²";0_e'°úÃ…-ú¾0JáÆsÇ‘CË8\Ø?ÕšæÔ¹rBÇƒfÔºùçýöOjÝDta‹þSëÆCÇF9fa‹ÿQûf‹ÝjénTÈúJô˜É9L`[!;Þ¤÷yÈ;>i4ÆÛf%ïç–óé&ðí @ÄÊNôk& 5¨¼²øG¡ˆ‡")÷Š4¾Ëñ]µå^lDp* “·,š·K;8a„êÚØL1UÔvP/5‹}{I{{ÚÔÂË©ÈFfùÈ—ÌDðìnï–Ü4–ZqpF6áÏ6Ði4_,Ý_ªÙÒT¿²|æÜþÂüAw`ÿKÊiinscÌntû˜¬ú•%­l+G¤ÌºA}ä9(Jó|må@žpcàfï!d^3Sj`>Z»êÐÁŽÛ°  ‚GN{ÿì89qíCöAéB“ŠzåPY×ÎY¦=žl!¼[ƒÃùØjµõr9…à_HTxUèV¢Ê‘"f3ÕfŒ^€'¬l2"¸’ÒQjaUn’¢µ¯¸YIlÆÁ0ƒV$¯BñŸ´þ{·]*«•P^¥Íµ´P£{ÏßZ¥ÞÉßÌ\Væ=Úê¨ñ/ëªñij&z»†ÍkmV˜ýª<Ú¯^ÌVýåKhü3©û	Ø„¡æìš~áã€ïIuiZ3œ¼‘¸¥eKœÍ(´–ÁDÆ\Mì¡«E{hÙ)Y«ÊKØæ—¥¼1U’²iS‹…­£ Ð_Ætç2ê¤°ÓKfÄÚž‰ò
Íg@P¨Eíjq@,Ûf¼Š?£%ZzÆKdÃàðJÆÁ‘½!†[æl…«¬Ë…šJ0„Ø²AÎÓT: ¹©t`17µ‰¨¤&ke2Z“–RÀt_uG€ªÚuFB,»Œ%EvUrfq‡y¥†ˆª$ë‚=\’\Òå&«½+²:?M,ÍÕ%,:þ€sau2×çÞ!ü—+9UòžðÛ6;fžw€—
<–‡°1Ô-ÐìtŠÜVUCPSðí<ÚÒ•43ÑäVšÓI=C³xm˜¿†#Oâ,Ö?z¸fïŸ2µ¬}
ug³j±ü4ËpKü ¼g­æk‹*)åY¥†ÜÃhvØ–ðzd›‹úÖÿXXÏˆ&Zàÿ¤áäëí¼h*‰&4¥ºüe"BK8ñ"H‘œQP¹‚½Bä°hÕ?`$èðX1–>¦¦<s}ÖnÐÀüÅ˜ø€ÚÌ¦hÒzœÁÄS'^Æ¡èèFŽäÆ$`d­™,kà=ËãN6ç=dlYôÜªÖs 7pÆ8wäb½<|â"mpbük†fÏržˆ>½`TÞ"£À¶¼åtYØÏÂ,ºTÛá&oŠô^H	ŒçéiTåúöq-taÔXž!{×DÀÊuîš÷àá=ÇnôOaÇÃ
XA‚ÏÁF_¼ÀÛé¾Ý¸¤ çÓ|–qÎKƒÞ_ŽW)ª]\ÚÄS'GïA)¬êë˜\Ãxä´öè²' Å:p2’R‹¼ÒL<voïõ¨²Šn\rŠðÐñ˜_…UôŠN$;è¡ä ì!S³ù66­êW tŽV
E›är÷øŸ¶Þ_PÕÿâYŽî¦©Ñ)t¨±¯±òñXÍß¶›ÿ½Ý|uÑüue Ûw±¸tßûƒKÃCç
ß„íáM}$-U­î0š¡ÕGTm8ah¾»h.¡&µÆâ;Ëõ°Ln
¾øÃ™Â0ƒÎ5-Ï g`ÅËÞéñûÎeº.ˆCi…\*ŽJ$TJ9}b§í´rmèÔ=­©ÈLü©è=·›À¸¼–xE1ôn8'5?¬’˜ÔœZž#1´ËÕ ‚ãaq!ó,U]d¡
ÕAÜ]Eöšw0=9ma\i„Ñç#›ë9ýI¨ºËWöêÔïØ&3Ê(ƒ+Œ*L'; ê^¨£1¨…ò9˜R‡£x‚Ï	íÕk”ÅS]”CEÕ)GQ±°Gô°úWî`‚hø,±Òg-·pAÞ°' Š_£°ÁË06‚Zp²‰Ë8üØšªŒÚRÖ¥¯uQii©â¶X¿¸\›¸ÛJ—2èi†½`†‘¬ùô¬w î)ÊžµEŽó_JÐCfA\›—JpßiPK¯A<ä‡û‡œ”\Ùª°ítI4Œ9kySÏKÊaäe"5ØSò ‹iSÂ$¥D”í¤êm›4	è^ŸF7pù½KÚÆS„ÒÔÜv7L/„¬1åKÄÍÿõISÌU­ÖÉ˜¿ÚŸŒz:>Î½Öœ!•i}]´/Ö5½KþkÖ¥ý4›£A{È“.>ë¡Éöï€ÁÇE77ªàmeT-^³8®Aò¡•Æ^óPs³3HŠ±ç‘N}Tµ¯U²‡ú‡/…'ëˆ(h3{ÂzÉ1e½}{4\aó>aË·‚-ˆ(€.OŒ%¹äèÛtÑyÞÂ'~B˜oa(é>ñ—äR 0‚îc0>ñÂ|+Ó¥¦ûÄa’KŽ0°MÝÇà0|â'„ùf†r˜Õ'“\
„F°ú†Oü„0ß
Â¬R³úÄa’KŽ0°M«ÁaøÄOóÍ Eòœ%x?¡Q¢°ºG€4ÉÔOhó¥ÑÆ$¸ð|“ðÎÞR/iœÀ?.=¡Á2ÆÎxs¡Ýj¯×E/Œj¹ ‘a–7gÿ,HF¶@Zx&¯Š`TáE6ºÆ+xWÙ£çUUdAºü¹:œ»-²KCv1d u2S¬WxšÕñ.²×Ð½Šl.ö>¯ÊñÊÉÞ)†Hœ%%c’Ðø"žDøB5VRåA§Y>Šäèê÷¦¿?®Ô³JûYã[,VXO¾å»PIÄùm¤)Aï.‘r‘@T“qþÈ
bÎ.3’Î.	Ñ¦4Õ«J\ÍD²ùÜ#Õìz€T„‘6^ó%Òëîg ÖìÒÆV¥2Tüüe‘îîè	ß„oþ#â›ÿ„oÅë›Æ·3À7dïÎÊ™ƒ-ÑŸpN?V…sÑ#â\ô„sÅë›Æ¹sÀ¹óŸœ'tÓU¡[üˆè?¡[ñzºUg¨YÃ¤F‚.5È¯e“ÌE;f"²=fÉC69fÉ ÞƒôãÕ¯_!>wúCŸ–Ýu<g ¸òD½´—’zÙH½ì'êU¸¾iaál?_»QNÉÛÀ
í'œÓ^*œëGŠ*…Ù5;ÒÁäOXW¸¾i¬K,ßû~`Žò	ë´—
ëB·ÿxXbyÄ'¬Ë]O’z&©ÿì†1vdÈÊÅþ½HêïaJrhE1V~"\šKE¸ðF#ºƒGÀ„‡<²ÂõM‹™¦|<fu žÐP{)5åd#/¾‘¨9—žõ„”…ë›FÊDH;<a¤æRaä5ÛÅþÃã¡cáAO¸X¸WÒ7þA¥|žø»Õ9ëòuyN¬)V¢…cñ¤²¾JmÑæ=.1;¾vÂØ)ÿ]%%›Š}f
VM½L)—„j|§tÄa&*•LüPÊô-Q%MeßúåË"P<ÄRòOè#^2ô¡û4ä¡Ó>¡yê(êê*,Ï±D»ä˜µÒLZkm]Õ™%˜”ú¡zhZ¥Ó6œTƒè¬VN3á;/'YÀWÕƒÓÈn×`p–ùÕ}Ù®žOcé´Ú·dl¬[5’ãlÅ°4.6Û`$F”vª¶!ƒëT½NÂS:©·¼k´Lêâë=ú%:FÏÏY ÍöKf¦0Û¿’FU¹™¶seM¼øÂê÷ƒ–	GYúÂvbËõ f¹}d£¬¶\5¾"q®ø1VhÝ×ÐÁ¢çbãã¤Gœ/8øÊ¢êºÜf=òÜçá•§À”†¥,\ÌîçýyU§t¯vù^(Ù“®ñ¼ÔE¬å{æP]¬m$kíM€œRM_:ad2yÎ¹*¤k­tíïYMÿƒÀ :ú<ÿ2J…Ô°+øˆ–	>CX:	<äÅŽGËÕ¾lhpÈF@n¦Ïl‘ó¡f{ä Ð&u™áž8Õs»L&¾çDe!+ÝÏzí¸aZ¨{_¹ž#ï²S©hçõ%s}!µ!»ŒVi8¹:–%r·–ôÒ&‹sN­ öyñ\+˜—;vþHáò}ˆ‰Kë;ž„Ëä4Fd­ÝmÁ·NÿPO„¬N7’ã~Lºää°¥©gÿ»¬x|"÷×“ñ‘Ç¸¿ñ_‡Ín{^©µêÔPyMïäjøÈ~fÈÀÆWÚÔ5}gÙÅ4ÕIèÕTS+D*„™+ÊN¤) Í0ŽÇÑÆÊ
NÖŠÝAkà­Àt[ó@xv¤˜¯âkN¬î˜Mð½MŒâ„Áµ‹å×» ƒe{TaH7ÎÈõ7”ä‰]d¢ÒÄ…+¿'/‚½Òl® lò†˜Þ·QÄ@É#KØ‡K_\„5Ñ­+œ6„«r&•Y\W¿Í_!bjL_·/—IÇ“˜6þ%+ðÏtžÈ…ëx Úôq‰p4ÄÕüg.ðŸ{fMî#ƒéÎ:ÃÄ–þŽ üÑ¤u:óXdT=&>…x«‡˜ñœœ“gÁ·ÛQä|úçSë›ÂýòŽ¶_U÷ì¥‘¤9Mb!˜SÏ„…át=¦ý§š<´xÃ¿”ýÅh'ˆSèšOÙ1òÆÅØ‰ZlWƒ”¡›ØpXºSƒÑs6@N)]‘‡ƒ=ÛE	?¶£Ðí7°‹¼Ò€Èî‚áøÎêžíâ@œÓdàÉÈ¡ÑH}¿xaà)(¶6œ7@‰Ñø]­¬}³U¼µüOÆ»€ƒ9Á3Ÿ³Ë4ƒ{~šádà6ÏOM¶;F‘åŽÞ±€â 6Z<O)E€K÷Õ=
ct†Tw—
ƒ²¤UÞÈÖØ•Ÿ©Ðà»@† T/òUŒR/¢ÌŸ'HÌ0ž~·(ÉKÙ[Ê)!§lIN.¥¢RB¥¶aßÉ_¨Ð£N˜K×¦«rÇ‹›TÑâ.»øS) !_÷ý’BhQ…˜ö”‹1Ôl?é5arÇ‹$úJ³o®Iz§«ì’ŽO:Á§Î9s¬°?D“:;ÿ½[7wG¶’òZàÑðÔ&îi¶„ãäYÏjCÚ¸^øWÞÇ]e½ë¨ìØ×C…` AP©Ehh—ÃuOiC:è.gb@&0 ·Ÿ>˜y¨X¡4ÿëªsÖ¯yÍ•“äÒŽ›$h³ÊÂl$0•­9õ±4ÕÊaN‡âkå»FzS‚ûˆ–N÷w4–<®\†3 g©´·’âÈ‹xkÑÖ¡šJ¥Ä¡M£ÇšÅÔ¼BD™¯2'—Ì•9i…ßaµòš]2²n› t©³ëÊÍgÚ´&èONY™øu×ÐK¬Ãò?Oœpºã9ÀD6Iá„[qpÜ8á |c©‡îHÝŒ˜MwåzÀ¯ì³œ`g‹}×°ô<ì~„ÈCÚv|“X-<rÜ³ÂB\¿ïMl'jd‹×¸ÌùÄÀ²‰ñ“´½3kî¼¸TýDííšå„NLxÑ¿ý-[œê6Œ=Pü„Á“]oyŽ?ˆ‡´Ám[×#œ/Bžæ(ÓÝÇ>âÖÚÂÖQ À	KF>—â+„ÞCå»¨Þ„/*}™‘5®~‹\4b}G­©è“3Ý¼c0q¯YË¦0ÎMdfT/¥Úd©!Ôã"!HÅœˆéLL‰
‘ uÝ‘ë7ošT®Ð92ä)»\WÎ$aeÑŽq8ñû ™.lÝetáÞ$Eúé/ÐA4î$|å¥Ž&PBŠ…%}bÚ«Mk¸®
£¶|§•©Èò#èŠë4Û§­LwÆG™ÎˆºJþêé Š¤Z‘¬Cq^ÒÞÃô“sÊäT}saÉ›\!P5QÎ½JeN]¼á¶UNf &CŒPµK¢a(Ð”Û´rVí&Wµ­K¼
v/!mÏá&.®Q&Ëàªt
Qù—t¯¦xŸœ£Q[·ª1@-#UÅH¸”jW½z5 àP5ª^t±qÙ¨*g™~€R¶QHÞ/5¤6CLS¹»2KKm%û‡LÉ6ÒŸ+Y¾&>¬Ž>'M\y€
ÓrÉwwsƒ<ÃqÜT|‰Ö3É¦+ˆj…¿†Ê_÷4@ý†,ž9žÓ‰•z¬´f`{CæiàâlkQ7á†0a¢R_…Áˆ@znD£~-¶cVÎÙÑÒlšÔZ¡EÉºÃjúmF·k¤fÌæ«Èî4ðWäWø,rƒ+ý¹ÑU¾‹Ü`CÿEîFî?Fé_FîžþŒÜ}F>ÜF~Ü&¾ÜÆþ¼ÌîK4€jÀåB*O¨„…ú¡ò;4fUIEtb€Ž›û#Þ¨Ü(@m8›ôFn¼y—ŠqgÖµ“ãîµ†xšèœZíÌMfª í¹…¦ÖŒêÊJ´"èU§F”½h :³Ëæ¡ºV`©-
¡:šØ§sË}”„0GÈ=U9;9É™iÍ°G/Y¿ÆÔ¤ÂöpÉ Ú´`öF±áÌÒë6¸Æ|ç»²µ¤q¾;Ël;go%¥7I¾ŸeºÓýIMAÒ€ïg™îýöáÞÅáöÙùÞi®Öi¼?\"MR*|6Ë~îíüx´¿³}pq|²wº}~|*+kû{<¯'þ¼zþžwº÷nïto¯T°…4~>ñY¯WjW„{iè˜ˆnãXx\©­3y/¢»v07EßTQ¦†™WíÌŸ\V]8j¯tûÏ†ÙhœbNKÑœ„^cÖÞ!«“ú°A7PpG™F‰ÿC®'W-3›{‡f‰¬%¼°«2"ó¶e“ój¨f¢ÓL0|:¶;QÿÔMóc·R…TW Ô’qÂR³0·Æò¹Ž„KåˆzSÑ™›SŸæ¦<Õ6|•ûŽFÄV
dpS²F¨ÜqÍñr'Ê¨ügÌ©SQÓûÒ6oÛ#~g[=V”ãwTÃ3G^îYýa#”+|ÌÑf¥]ç6	H‰Ì—|Û—Å }‰ä-}©ï7³‰[tÄ‰5-ß‹Î°°•Ë¡Î°Å¿8Ñ¢Ü!¦Ø—ï¿/Ï^—²Á«´s
÷T½ôÃUMúáœ¢iMW³šÀTýF­Ì*tŽ'lxàFÌ×œ`NE»PŒ»)èVÏ$q·¸µBØX¬­²°uWF÷ûšÑµ²ÜŠQÄ½raS‚¤¸,@aºS©‰Ë4˜ö	âDˆã‘ï)…{;±ÄU€ÝH¨Î;f>=$w2Ú
äô{ëØîÒÜÀðDƒàŠÐ¼ {cz÷÷ ÜEq #€÷[ nôpË1}ŸÖü€?ašÐŠž`²&s,+"GŽ¯SŠ?£/‰",óÜ¹_B[ÅA8°|÷7€4	ÐcµæNP˜Ç«$Z®Ohlê“bä	1iˆØE¨L‹A4&¾dovQ£È«)ÑhƒþBn1æ…!E[aŒãJ^æz­‘œÐ¢Š‰PFs–Iõ Èš‚$ÌA,ùø\`°ŠP
fr˜7ÑÄ’ŒšËëOÐN\vÓµÑ acè±5&q´œ/¡AeiV„òm Ô>n ÜHñA•’­*Ú€[ Hnh@cíLy¼ÀØñDß¶m~*rÿ3) \®VNŠ B‰¤_új;d¿–/–“hÝHá¡Nzˆï
p	”ˆþ7Š~¦ÁŸyã€ÌL¢ ðrÚ…o%TÃ&-]µõ¤ÆÑ©\‡T™Ë+ÁU‘b¦£4£þíÃ™ëÚr=«çQƒs;Â+.9a„jSâ¡ÒoWVÈÞm¨üÀñ–=G&¢×­ÝÊ!‘êÎCÇ²QGÙ$‹YÀs[X†ÑˆÿR÷%þžIü÷€#6þ::\‚Ïª9¹—ŽNÇÜoø§h@ÃÏ9~_ #‘$ë¡¸gGó¨+$Ô[G—gM#ü—?Ÿ$Ÿù"ÒÏ´›ýÞíØ³|áá@÷é'Ö´qJßoá<´®±ÌAöMZ˜VüŽÕÚï£ò}f£8Ueÿ*vzÀ#Ñnƒñ«
S‰xÛƒ&ìÒB¯ž`@M©.~Òx@ÝïcCÝ€>€gÕCÂÌ_ž@±n¸Í¡[7&–©}sÕÅÀFL£§dÝùâUš=îÉgÓ®lkgíe^|£ñ}î%7œÚ°€…É8¾Ë»†Ãù^›ÆžèorjžH ÉM†Ç”pbãHhL—ÀšŠ¡
Ê£Š¹Ó)J¤þ|pöç(æ^Ô²ë".¢¡ãÄœ-ÓÒ@Ð~U<€ÏÕËÏÕ‚O¾s£J)µ@„÷mþì›Þ2,Èq"K3™yA7×M"Õ;×sèÝ—ÜYw±}ppüËöÑÎÞÅÁÞîû½Ó‹gwVó¸v‚Ñ¸…†/iúÆE“%p\,.Ý·W_ÖÙ^QøÈ¾70ˆ<àÂA4é÷(Bê;ýNWùQ‚’]/\0¶ún<mŠ^¸¯PD•ÊŒ»Áï–m.¢îÑmå’î­D{QIªu²K¥Â¨4¦¬jwº¹¹>§¯¯&SOaÚa:w¢‘Œn™J¥HTË)–Šª74¿'5£d¶v•­$7's
Žìt![GBuZØAo“&S'n‘=Ø[ˆ¦ÂÌ–™oQ9Ã= Âƒ!·L(ƒå-cN£ecÝ]”>¨ÃÞ”‹à8œ¡eŒå)¢r+Ô±[<ëÔs«Qlcª†”=êô 0[4Ñ2ûçYãÈIsš]Œ„[iø‹C¹q	[jzHÔ“.!Î¥ÊZ¥)‹FY!¨Ç¼^‰‡³Ì‚JLq¿á?(“Î6UÞWÎ„BÒø	']šÇŒ…Ú«³O,gÈš(z¤ñ>X9uâ¹,R4e¡¬6ë©PÕð9IU¿9¼ï	5kª·Íç<x[õTð[¨²kïuÜì©¸j *OøºR2xÝ™+”sV)“éîˆ(N“LX&L&™ K1v™Ø–ëMOá¼ñOô‰¡$¿LJ="ªdî„ï‰ ^µZ2HRIBÃ–kçBTË¦Á|v&’ê Thá¶Oô÷™˜VÓÂSFy—¥	oš/Qšh§ÙMø²ˆ±ÍWëí¢{A"-b–$Žã3zÝQ»°|U´qùÜÑ€Da3¹õà%ÆOiÊ¨„éÙ?Aï¯Nh¾¨Ò"Z¸Ô±^åµaüÒ¹`R¢ølƒdD£SR]X•«ûd`z‰çe|G!5|`
*{Û¢¿¶T0GHÇÅT¬91Í•‰I‚GU*B™n}ÕrŽjX;G•½a¢*½Ì¦5…7U^³Ì§ëGqû©³ë.3&Þƒ·Ñ8“QÀì•bv2DAá…~>ÊBF‰÷¸<A{†r¶‚[KH’>ùeƒR]|ƒ“ÄXøð'qÏ?·›ÌW½ÓÊ6‰tM')¢¸ëÓL–þ¡J6ïÐ\¤u’ÎÚ¸+©ïÉßÈ	~›³HW§ŠtåüLjä\§FDU2Lr%•pQ ÌT_Qó–]YŠŒMý>á‰2úvRÉÅ«Í87 â´ZN¤¡¡¨„­F—®Vœ’•ßEöFjîØ$¬oÁ½¿‘<ÿÞìÖåÆ$Ê2´ÎƒwnèDq:ì¹ÚìºìªñN},¤³ûÖ-ÉSgë^I˜ËBÃòD¾ÍêÌÔ®D-€ü%W„Nma=º"=ù«tHI§éAEx´¾YRîÑ2à2¼[ß5Ig4J0±_²<4Š;,¡ŽˆæÄg9ˆgw	F&Áà˜~p¼û~ÿè=9ÝûÓ‡ýÓ½]Z"ò( =rœÅûËÊnLÂòMÖ/Æ,•’ •¤f7®G©­ð’JfÊ‚™ùK+o†Å„Úìmk®·Û)›¤_¬µÓd”tÀj;±I¿ì¶Ÿ·AŸ—*KÉóRYQÌ…Yž•ÞÑm›•ýÌ_ò" ùËDê-ä˜ÁN/(¢þòÛ(ˆÿõÿúŸD€\“Ô6ÅãíÓó	?éÓÿ7IPÄüÑUoÙU9 ÄÙ3˜5-.TO@IEXIÑ%Ó²B ¡Ñ’øhÓ:‘÷® e¦¦KuZ™>[ˆt£¼¨ÊvóÅn²~¤,¬†êJA÷N¶oŒ;wÜ£)º-±N¦¯]CÑ5TŸÓ#ÝáMvyp…a†‡[“¼ËYÏåßÿOâôpf|)SËÃÜÏÃÐPÊ–]wbÙnÖåÌ¸%Ú3A)3ÑVMf%‘devºl/G¨J»@b7öÊÒ,oyov„ÿõÿó_Jt{¦çÂœª¯™ð¢¬`ï±Þá«FC°y‹e&Gai% ˜qé%3“‹©Á›=ÏòÍÄSÇÛ\ðƒ`Œq´Äè²B´Î›iz‚Y®Ï"µ[#ÿÏEIT×²3á¼`ÏO\?ïèÒòÑèÂ1ôŸ]ç»Þa‡õyPÃ´H`Ý2µ
OeWäÄ¼ŠhIV@h¨›ò›áNfŒ+¥£q‰"jÝù8ÔpœŠ¢F²IDÖÑ¦¦ý1‘Ú„Ù7äTu J]f³öwK¦5»}‰öyÓUc–¿ª(þ<PÎ«±Ù5m:šF?O±«éM^”å°te…‡±F1·}¯ê{tÚrW—ÎB!÷V£»‘VK«J<ˆ†²º·iÿ\Ã¢ÂFå6„Ó‡šæiXLÑ¿Ä\.‹»sYL"ˆ8mÜ·©øAFÞwÚñmvìÆ]F*Ÿ ó&¤að<C%È _v™÷»Ì.|‡V:ÃñÜ‰Q8›Ÿñ[SKVèkO2Ÿi/†òü?9SØÉM‚5…·>9S&éîá!*Št¨.fß[aD[Ð?Þy7d[gÈ²Õ¹ kG6ýRrþ¤×úêú²K?ñ›dPkáa–%Ù,iòK—§&¿ŒH…(ñB%ï°‘l”©õŸ]eM©Qu©Ðâ%nxÉY¹Ø{]è½üº'ŽçW„ß¨oš <ÇW6=M#1¯| ù!¬ÝÙŽ$ÎKŒoH¤ƒ¼Ì D™ô8Ï˜¬œ½ÑkªPæ†–…­ŸÍíWÆñ0RöVÕT:7±Â…W]¥¯‚âU	º3À™,ŠBSPÕ´\œx™šEµ%Vó—© ÈG¾ƒâŒ¹&_~4¦:W–úØµ.;5g¦ÏJçÈUÎÂ†ÔäAjÏ{Lò€õŒçN¹…Ñ0³Èär!º`2&]ïôS¨ãÂSÐ”¥)ÑHÂEîIŽü8¥9YÓ!.êâ¢LÝËöíM+¸=RâÅögÀÞÔ_Uì¿’ä­¶	…Áf>›µCXTP¾’/ø×¼osÁü”ˆ åÓe>3V¿4ÙÏù‰kÛH{ÐÔ‰Ò¦¸échºgˆÞ´ ]’K$V¡3sÀKÝeGA­ #Ç:ó›|@[]Ìo"¼ä¾‹hþ4ºh_¬·ï—¾”«ÛŒGèø™†ïxbØL†F¡fêö^[ÇóãÉÇÚÞXÝ,×>À4I¥vI@nùðçAL°œ±ÍuSJ¾Q‹šYVk&o‘”ÑšÆöÍÆk¬î$
Ï'tR¾#ä"ÖÑØ$×|’°uÍêÂÓÏÀ\KE–u—‘† ¬sƒZñ°ðßh/ói’ÎÒr’9OÅ Í@ò½˜u	ŸØ{ÔÑ9Œ%‚‚a‰åÀ©›Ed†¢\;¶,(­*± )Pân
\æ1TMSœ¨e+ÐÉÀ‚»‡v?Ì6*Gdî8¹¯(Zzø.þÄ¯#ÁÙô·'4•_æhúý£ ©¹8m:ðAxõ¾'dG&'>’ÕLXg^²ëDî	“ßöDÛ’ë÷ ‚pòûA¾iëDÎŽä	Méõ­‰ ß°€Á;®=	õéÓg$-Âò²Áµ¹lWvä“<‘žßƒ„PÈß· ð¥ñÚœÇKÈñŸÐíãôF¶„.ñúxó œ©€qãÃ`È`<<gœk×¸1'R×¹1‡§móêjgY‹Ó2ñYZ2]¯q]3 ¨„+VK¼²Ò`À1«fð83<;t°)rÒÚßLÑøxRèœÝ˜9)™;Z_µ?k½0US0ûá¥ˆYdäõ&Š—uã xr	gm.ÎÖ`¯³Åq³†oŸµÞFó“1akrTCñµ[_±÷Ýýñg_1
< †ë‰ˆŸ0l&>J<×ïY¬'
Î&	ê;â¯¼,øÅ%+³"9Ó}KB©æ-b±°/Üž/ ^Um_ÅÏõË\Ò>¨&µ.=«çxf¹®å~,XÂ“¨Ìä?šøjXÁƒâ:Mnï·fØNG;öæÝwß…-×ï{ÛIZ²™ïƒŠqr²ÂÂ6²ª|ýˆ“VO”¡b®–,ò¶Âé&ÁÏ0Ïz7LzK6Ç<9žBñ´ÓÖ_¬Óe=AºÒéÖÌÎµDu„µÐ\p– ë|¤¿Ük†v†Þ=êHÖ™hTÉây¹Ûj°›§qE
6ÔúÄ‹Òç¼Gí£Lì:uD*åÊŒB‚4¯º.ô ]wèF–º@~ŽBìÅâ$²Ô=úWT]´æŒð35RFä{X®ç)f±Ï±lìÕ€Ùp·	±âˆ*A§VRƒ¬0'¼Ù:_*ÖY> ŠítŒ¦ÍKXuÜú´§Ï=ù#a–c7Av‹v$§•´„0x‡ïÕéF¼¡‘&£è¹lÀíÏ¤)>¬ÑÑÒ%­5eBžÌ¶ë®$0cb“!œHë~_ÊR
QœŸóuU¿À]A¶y„e1™‰ä8qu„¯¥£Ä]?ð¯Üp´âi<×‚J•–y û3ÕVªaò™ƒÇ7æ]Œ21µV’käÄ;Ò­®—ä.¦¸'XJÞ»­×®—á^_@î!«±›/ÚBÝrüâ‡¤ÜÊÍ €”*Ç+ÊÆ×Ï~73ÚüÅ™¯µfFðK‹è@`–3Hj kËúCx¬­?
¾Z7¤ñ %³”D¼ÃÚäÇ…ì‹W´²a—U)êÈêÎÕLNûÔ%&LOû©¾êî—trI¼W<¦Ã¶˜²á'ì[þIÞ’7?iLá‹|pÍw+$¼™8ÙÝ>ûñíñöé.ùãJö¸»¨bÌ+¹ô²kEÃ^`…6MBgÇŽRÈJ/õÊ¢.õµ[/5¶'žü,—ú#íÚž[Ÿì!yu4Ú ‡ÁM)’—IQl…1ŽË	Ãê’üé.¬]ÚòÑ²ƒÐí¨„R¶UÈ;ªï•qUÝF¥V¿bÞûÖK[-;áÈõ-Ykq¹<ÿzØ-Q&Ø¡êõ\ôé}Ù›„3iºmŠŠ¿8(?Î2¾r‹Üå WÓŽñõÊ°+yûqéå£‘~™ÉTYöÐ`4~ÓÂVàÔNqžõÿqÒC“E©a·¼‹{’jjfTÌ%J»ì¾ã;Õo ¶p6ËQèö3`o*Ã»Oxÿ¾Â¹¶~³`§¾âøáý;¼KcaŠ¤y£á,§NXáÇ€Œ…‰Âì—ƒ ŸUâ®ž3©àR˜PY§zÆ·ÜlY˜1µºšÏ’´õ*OÄ1œ+×b¼0[ÞÌQhJ—´Ê«|ÂObÛÂÂr-ñ	–?eÈ|j xbçÃ" Š¿Õx‡›?‹)ZE«g;¯æ';Î
K£}gÕÓžƒ>Ö :	ƒ+¦ŽCEq=©f)×aÊ*Õš5d§]±*
kpÊ’º xY$–ò.E‡dÃ¢“ønIØ’J.6 ô^0&RWC~›Ì4¤,Õ«¢®þ%÷ó Obó= ï­“uä›*a¿²43”Tf~FÝ·AHž#_¯^sbçº¹Ø™ÈÑrÑsþâ1ÝªLÂP(Û¯‡«JYÉTP¬#!Âw@DÄ¨fe7r˜HH^“ªpÃUé›–…B@¹IŸ±Hœ=”¢klu2…¯h_œùGË€è¯€\åDv"rãÆC¸?‚ý¢1`6™à'v¿Å¹é˜Äi÷DºTÉ—²/+@lº6Áÿ!ˆEJmod»Jà¹†=vbJ°e©gÜè£<Úo¹Ñ6{ml–qûá,µFÖ¸ÑÀ{”2+ËCr£
hk´/jÔŠ@h„x_í®¬Tž Sç&ÚûËäø§Êœ,›Á]8žÞºoËn”|ÅB»Ö-zr
³Æ'gºyÇ«ì”ëöÙ\ZÂgK(`hyCc9­áh­éë)ì‰ÆÃvò¾b…í”`j{q²þ›XOm½£·¹"	6¯¬µUÝ5U5UF¦’½Äõ›7Í6 ¯6¦îõpMFs
.hÑ´I<çì}0\Ó<Ç(¿¸K5z­K¦hø¸»¼Ÿò¶+2NQÑÿ5Eû
«!ƒgä„–gç:¼&ßeM^pGtveea7ÜØ7åé³‘]%pá ¦·‰Þ¥› oÉþ¢€·¯ 	RëÌ­vãÖèÝ—€ ÜÆÐ&C§
Fix«-/3:|\Â6ñ:¯âTúüµ¶~í†™dÎ£Êõâæë¼†xUáå4óNÔ®ÚËxW˜ç ´¥ø×ÊAóf;ñ70«¿N6ø †ùCè]Û¢ªœ>Óäf±ë÷ˆut»iWïŒ<‹ò yãî*÷R¥·ÐÒ{•Ú¢VŸY£;:—‘¨é´î6cõÉ•±ü4ÞÒ¨ß6£ÌFîÐ²¡ª«vUGm“¢±ÉÀ&S
Î>TÄâ˜9ÎjRŽz1—ô#§†á"•Á"ü¹æ!#"!aý=<Øø\¬ðß]1§%x±	0š7´ÈˆjÈß8ÐEÜ$ÒpÂÐt9–ç´hÓzcíÝ]|2#Ò}ºÏ¹M®Ù‘£ú=çHÆÒÈŽ‡Qñ,AB8eZ€ÐiWðBôz	ÊPú;ªè¨A›JYJRDbBfkŠgŒ¸&Vž”¸r'
§±Îd}[	êH;¾ãë5AUÝv‚	@£Ä_‹¸ø]­…e²@±oÁ ûÌ²ß«ÐÈBªëÊ1»TÕœÙ=‚·Ž¾I}?lÖ¢ŒM]îë«ö„eW¾þp2—X{Ã¤²O¾„`2‹X³Ã|–ëÂ,u«±Yh¤=VT.Ôý»6)l˜mõOÙF4Ø”[¤RV<CÝ:uÎð$Û›ÜÄcÉÄÍM²‰Î¶+7ñõ,WpŸr‹Â¥„yRsÒ1fèÇ[!'£ëîÄ›D…&´ïªA^Üx-©âAÊ 7kRþ$9QY([]«¼çøƒxHÙG[Õ¦ÄÄIÒ¼&š{’ŠüÇÔÉu$nÌu!,„ð‡7%VbßjI]¥×4uîå]á®Ý¢î±è76Ï÷O.—$Ö­›ï¥¹›OÜL'‰¥[3—EPuº Æ®²ÄgNæëÁ:ûŽÌe¾ië¸ø¶·ÛqVzƒìdv¹ßÍ 
©NRsšœ¥4Ú½ÞúK0!Vè/ áÄ&@y&Ž$t\ [&€Ðø’Ó`U’ê"ÕÈ^ƒê ò± –Xåù/dêÄ-B%DÒs¼à'I¦„e Ä€Ð/x 1SÖíF‰ˆôÝk)±R±æ¯Ý"2Çæ¨µ$‚60é«PÜ•û:àl±ôJâ·l)Ö,Ø“98X8V•*¡@ÙhI/Î×´–|C‚¼¹ÿÈÂ{•Ø®–HØnûF$m¤Ð»©}™V«Å×©+âÚäò™ˆÁ®}_0Ì¨<»ûKÝôÌzµArókolb¹oàëôª4ð¨÷ÏŽñN½ê­Õfá³}Õ]ÉN^yGÎ8.ôãé)3jiçw— LÁ'5$)×º"+uYvóð²+–óòQ2û,Š­®O{D›ˆ‹³J'˜\„ÕÅKá…‚+)í-9
n"§Z•k³ÀäMßiô·)gaÛ¶¤Àà#ÊV)SÎ„¬Ç¦xÇâè‘„¦¯€¢*¸IÓRdQJ+$GÖµ;`æ“³I¯ynõ¢RhŸlÞúÁwÀäúCyøÑ;®ÆB@&|
Ýò”
ÃØ$ZW y6dè‡çõ¬PW¡ÆPTJ“å¦bõ‹Ï¿¨Ô{®I“8T5ªT™ºEcƒÆ‹¦¯À’§èkhµÄÉOLwWÎ{)–n,vŸ-
œ[ÌR½xfzâ8œLá ÏÉ¶ …¶N]|GÆSæb š…ñi€rÄï ÒÄ·ù]Ü5ê|Ó›(`íàÖ¤ò>šÜCàÎAYT0ûÐÞŽ"wàSfVLƒ,@ëØâß¢ß8vE÷^YZ žN¡L-×-ÄÊ±ÒÒB­¯ÙIE•ñÄ‹ô…Äô/«Vªô[¨Ì‘UKŠê&.:d/£úÍaÍ¡9=¨`S¶ËS2Sh¦_tÅÍ<ûMdº2E5PÀ(‰Ë’Þ.’SÖ½©S™*AH9@,ßKòs‚Õ@ ÉUQœó”‡*Ìr ”Z ¤¼ÇØó?®H8ú(õUºÕeù¯ð…AÑPI9ÚNàMF¾D T‰™²âf2¡ß„»Dq±ÖÛ_P ..R.ùK…Ý4Mx˜pê«”v%;ïÚÀ3ùa6ñ›ÏJ†t9( b:–×‹ƒf/¤:FÛÍWëmÐ¬f„)n ™òéoixmš–+ÐG¥cÌ¶áX”¸š’:É9™½(§›×X+nÔ„XbF""]”³4&ÜhP%bš¤ÑB6hNÌ³!Ûî2< £.5n¶	-ãÿÞ4WQå„ÿeQñ9^Ñó&!îÂÂ–ÒY¤| # õ¨	²é9W1þ‘{ LîÐPfÙCµÏTlCE1€l±
â%Ss4‰OJNùú<ÆÃižp¾€—~a\¤Œ›~•÷mŠ•=2¶#g6A@M"4@‚íJG£NDWï{Ù¤ð±KƒÄCBLèÉjýiÄhžÌ@ß}cR‘Äy"ñè„Zƒ‹ˆ'AÏÄÌa Ê®æ`*1"Qo¶J=.LpÓÄ¢-Í.-ÿÎ)Ð·rfM*¥‡4|½@¢Êçú¾¦„L	$w¥tyØ]ˆûkw4ÐãFaS6©2í/Ë‹‹7¥t÷•»°Ù?Aï¯Xi·›³ ›²²Ð	O4§›~ÐL¾R(I>lLZÔ1q…WäHTó—ð²/ºRez&“S¬¬î› W-˜`b«¶N=ø©”Ó¡Ô*T\Ìë÷ý+S\×ãuµÝV ðJ2GGÛ\ÊÎÑ¼”Ü•€‰wÒUá›þ„%Á^þgô,{à(^ZòÚ±4“–BJšíëY}Q—,%c{Qª~Ã$¼c²_Û­®3úULnSÂóy²9=týé”¬wAkÅCáÄñ¥³'0„}Ç4&	v–ª–cƒby=”ã’þG?´ÿ›º²¼äl‘&¬‰4A€ý¢LRÊx9Ë¾HsÄôI_²–s#Ë˜æª	L’Ðê‡ZI=S¼zB°+{³¾þÓéN`;g?¿'×ˆÖ ZqPÞØªU$rƒQkk÷ k];ÞæÂ¡Z·¯ mÅ×åïVhˆùçŒÊ´ƒþU ÖÀ‰÷˜6ôvºo7ªõI…ÇÃO¸ ø¿w@b:s*¢‚rô¾ÕjU•ÊÆ#ï<ØY§'þ ž»LîÈØ½u¼SômUr¿ÔŠ‡Žß  ·>„žI˜ˆ‡Ö@ak˜“ŸïNcÑÒÅjâ½-õ|/°0'ž‹“í³³‹â>&üD²pÑdA‹K÷­±?¸¬xêŽ—Í^´b0-eÐÐÔÜkÑœÌÜ¨Þ²,ÑCÈÙ°ÃÄ#uñ˜àDõ™ òìçvz›¢e÷¡j? ã	Uup¸û€r8‚u“ÔD)sk˜˜&^Íe7Íªv¤÷ž¤'*¡XÚê.ó^R…	8nê¨"»Ìm`ãÙB$«Î±,5¾J›¹‘3àíNâ©ZJÕAH AaÓÖ”¡O™ƒ}²nI…«ÑÀâ"îÞ)ËÒb;ˆ‡+åTª/³˜–£Q© ÊZÖ]O)0Ô“°S7ïgÕãEfb$r++Õ®×¸LYdÝŠ#^úN›­_!)ÍåÅN÷wÈÑK)<ò+cTßÝX4,‹ÐŠ†üÂ´Bâc¡j"IŠ#>ò‹KÊ1~ñmxç@Ôh™Ÿ$ì‘·!IN»'?>àõs¾°‘È'‹º-²*´-¡j«¯/crUª*jÚUE7tXó3^ËØ#Çãj˜6=Ð-h
§-iBKi¾!‹ÛaˆšºMzSr,tÍ0©OpE’ŸTe¦"íÖp±ÚyÐEê¹JÊõÐ/ÊÕzÒq]±´z)"CêâQZý"Ø¿¬øýdÐúàx÷ýþÑ{rº÷§û§{»ØöYrÍ”…tæqH¹kt­ƒÒŠ¼¿„•&ÃÖ”ðO"×ª-˜tÅ |ÿäLÉAìx4pCÕv'aö9Y Cª,¦ò%›†]fºKµ·•ÒDËh.ÜÜTšK™!]ëQsëýÇ¿þ§YóŸ*ê©{¯/%5*jNåpŠ»’#FXYõ~2îï¤¦é’~ÊÕÓ˜ªëqm¸´de4xOøŠW’ª¿‘DÒ6CpŸ5ñâ:î›Y]ŒùÈ¥üÔ‹Å¨ÁË¢¨¼‚7oL—p§Ðˆ–@=9Bÿ/üyi´Žë1¸{^í«Œš1Uù,XùïÿöÕcå6çlb)ß]¦°h<-qµÐRãtÁ„ú'°¾€Æû|ä…¶!€cáì+·Bâ/”ñÿ  ÿÿì}[s9–æûþ
Xã-QÝ"%Q¶»J#Ë¡›muéÖ]5G)E¦%N‘Lv&eYÃQD¿ì¾îÃî¾mÄFÌOë_°?aqH ‰[’”\v+£»,’™ 8À¹Çz×ìhwZå—~D)Ì;7„YæC¹÷Wž¹±äÆÂèð¨ÄqªZló@]ªUv/ÑàV¥Ø¥!Ö¥`¬ œ°ªêåÑ'Ä”Q×oÒhTR¾fž[LŒô
>ªqVÚ™––Ž¢Qv¾ —Ð»_Á¼È)òãÅC:™Ç+8VØÅJ¿\øõ¢sÆ§°+Wß0IFàç ÃD„¨ø•È×›¨æFÒO·1XÉQM‰J´Û’Ì
÷ÏŒÔ"Q÷÷¼@ ¿ ëtÚª¶äplžCð)y“$€Â4Ì¸ö?Ó·F}$u8XÚ?”Í•èþ6ó\£oæhó‚""²ýþží]J‰,)LêºŒ W/á•‡¿°Q8J	+û±BN£ø9%ãùÎ—‚&í(;2ý”TŒ?P<gûÙs_dÿÝNG¿üÌƒfHGžÆ…f˜ÈÙ<h“š?$¾$—E	 ü[U²X–Ù¯ÅßÎšP’À¥zÝ.Q=y™$cþTèe?òªÜËD‰†?o³eÂKa/½Rõ2‘0Ò–‰u¶L$Ä2q6ÏïÂ¿ùMø÷Õ’ã”»¤ï û,}ó+¿t–°g©¸ìeB×8™æä>º(ÌýŠ…ë…=*ïÒÃø±…­·0­¦’¿Ð¹¦jZˆ;‰wcˆm7  /lqˆ¸s(u¤ óœC¾•nTêBù¤x¿æçô”q†5­âTW)e(N<Ê=d¿«¾Ú„ÉµªJYšòOXôaìu¸ÞVÁ)ecT²ÿX)¶GL(îR:a‚PPÑ.o¹Ùyv6â¡<ÏÏÁgL~.5ƒ,;~@{“[ÜàÛ¡2¹5	¬g«‚ç¯å^=!™Q™ÌírÀÞg–É|a4vÈVöº{½¬Ó¡ lf#L3™È¸ž[v ?÷Ô™¸@X­v#?/É£&ìN'ø‘ÖÀ+I?¡¾¥¢z”¹OÜ¥PmÍoÿÏ™ËÂVëHŽrîÆ8yÝûwkÍ%oÑWPåjßnžÈØª_j%9CÓVRÙ:Îð•TYâ½­d!}Á•”ñm¿ÔJrÐXm%¥‘Ý©ãt­d§ÇÎ³Ñmüfûhÿ×£í³ö~Þ€–~!úÙ˜GíýÝ·Ç»Û‡¿žœî·¶Û'¬£vÜ¹"'#!NæÕÕO­ö;ÚÉÆ~ò	§áüñÏAŽ®{Û…Jòå¶ƒ9÷D¼Q"ëQ…­×¸!Ê'ºnæN	­÷=P;Ò”…9akx>FymÒeÛ°ëØ”Q*$=º*YÌæp˜¥=ì\¼·õð’¾?æ8	ÙÚ¯ÈùX Hß\^þÕúóUòãÁÜ†Ïä)'‡§=t9=t=„¸Ý7È9ïî¨×£ËXîVCÉè6ñ8 —y('UéVPÏS-Ú—¾0Åž|ŠÓqòÌ3ªD°"ÊlNC]ïÕ&_øÁ'™[ï¾ôDÃ8h–ù?ìLÏ}æØ¼©±LÎz™à9v}€µ<Îi	ÏÏcÌÿŠ‡”×Nn†KnGÐDÏË@â7Âb8µ)ÖZšð„;âoì®Â/sÊ0…Ú`]Ÿ¶ædžªvYëÜX_eL=õa6àR¼O•l=ÙÌÔ7–VØ€Ëóë8Ç¤}ÕËÈ…ðtõ ‰Ä|ÖÑëÑ%àh§|º˜:>«Œ·
‚DÖ ¯¡Z:±¥ºˆúÀÜ32 ë'„í}TAZAØ °øëQ×øâñ^å>ò ½2’k±V·c¥Œîž»¥šzø¿¿èÎ&ûL‘lü8·A e"_0 k.p|žÒÓ?µ’wÁOt=fØI(PÑÙX‚^+èlÅ¦œ3j¢•J8”¥„ÆÁÁr ƒ©Åwt‚Ãb­`öîL%#—Ž½sÇ•t‚ð8Ý=ƒ®‹rè}%o³Ù½mëWÈ¿T¸zÉYƒ¼Ž~H£‚áñÓÛ‘Î1ƒçæ—“w-²÷®ýÙ>;;xs|´Ü&í“½í_îYû)<y Á &²Î;ö#,µxœl	ÔÀ,É2{ï¤Ö¢Þµ-© ±!¼ÐYLH†ÞÙ¹È³–Œ~	©ÅFË‚{çÌ¨Jþþ·ÿå Ê¹w×ã[4Â¬í&)D÷ýùº{‡Hžö é?ü»÷U¸ÉaÜß yõ˜ü´°Vò&ìy-ÊG-ë3,ž±lfBüé.]˜/¼,l*õ†½)…¸ÓÑ˜ú£û!Å*vö 7èžæ38ÃªzîÍvÔ€Œ5æ{4†r<[…8ß‰ïß*lvsˆÂÌ³œáÎ°£âb‘BpÞÑ¡ejc¬‡Æëë´Gç+yËõybu¤×µ±Y¥nÞÈ•:«ÌLþ²ô±×óAŒã·øöå$Ežô+¤Oñ)Ã¼õ°¶¦•e¢®N‹‰«4Z¤Ú©áÈY¼t–+)[)kãXZkëlCÒþ
¨B÷×è±ÉaÇ»Kˆ®%¯£%Ôaã)iÔ¿‚ûp"W‚Pœ£àŠ»¢X¨§uñfkÊ¸:•Df³èë&ÙÜÅÙ†PËaúT‰÷…ž%UÌIˆ÷ð)I^“WÄ5ƒ OÈY{ûxoçø·ýî,`ºF¯žÙ‘ÕØk)æú,8·¤7$oéM¡›Æ©ºá•ûžÍ!Ÿ,H<t#4W.u;ss}¬1¯Ò#ƒ(ÄGºªõÝ+È‰!µÖÁîR#¯6”ÆÀ§ÿƒ»ósW|Z"˜–$%˜¡‡w”1ìÝR¢WNÏ¹sÜP½TøT…òË¸ÙÔ¬{
<›OÁcùWUƒüò¬IÅ*â9õß0J¡ûjùjˆ‡½}gÈ¯±ÚÿÎâ(¥*: –µ€æ_£ˆJ (MŒ˜e¼Ý`ä§V›ê™lXsûöŽê¦þ''HŸ[Êƒ8² =‚Ø¯#„~Ó“¶ÙŽ®ÇßŽøé¢\„V„*N_.¼†ò˜ù±–òe‚@Vphõ¯/†«)	šâæg¯þ—ë8½umz\A&==IbQIo 7Xb»pž'FxBàÂŽäÈé× £”åŠ ^©°smÈ’ë1¦'bí1ëˆì(üN•>Lv8_½(šLáUÒàš¼_¤ÜnqÊr®{8û€jX”²%Ÿ.Â<˜‚F[sóCÝ,NPÒ/îÂØØ BùÏ*e€úËg™A%å|éaÙÒ®JYìJKo€Ê¼…W`1ÍòGëT«™UÞ#îlå³Øå1¤ùÛ#ÕATÑ6¥[¤8ˆè‘)×u¿[:„åT²Ÿ¡”½•óáb*ž6^(Œá•Ðyú—%tp'€<[Ö÷#zf”‚ÝÈL‘lM ‘ÜN±Ð„½‚/³ÝH=¹öÆ,6.1—€u€6„÷&ì9Åƒ7ôáŸ]†Ö•rÆÀ4:Œ6.C ë•Ø- –-,ªÍßJØpæwÙùÎu¶Ö[Hm·µäÂ\ƒ@³ÒZø(˜å;w!¯™Ç!™Çé-ÁÃhN;Œ¦ÍaŒãÎ%£àa@Àõ°×á~m,uo‰á>Rko­PC	Úà!µðva6ç§^7Nèä¡~~ç
Ñ_òm	a–ÂæM@ûíe÷*ý3¢ûëë@vÜ$þ`¡)ôž=ÌçßrSŒø '”?‹Çµ÷b{½‚zä¡ËŸ›âs±ôì³˜vøø!?ovÚQ4tÕ¢Ï‡†!où±U¬[ql=Ñß¸Š²^—ÜÓÊšÛÚþ{7K%ýèÜ]ÚÂ‰eœðã[ø½µˆIÊÅá3ÕOÒÜ m®‘kã‹äÎUù]ŠzF(£øóš†X5mì¡Š‰¨ÃN?¦¦6¦¦:¦æÉztÈ£koçƒ+ÈX\<ˆÓ¨ßÍÇ—T‡([i”žsBëO‚ÆÄÓ†:ºNG}1“ü“:PéKï8Ý|;È™%9¸0p§Ù§ªc1ºRÕvk¡¾ÙÙºaÄäOèz¸Ù[ëóêë]ÁäLT_/x¿±4@óW%‘/±n¢jÄ"Ê¬P¡å³Dâ;‡ù®\¥±ÐTµFL)íæ	`å”ÞN‹1Åi“'ƒ£’ö‡aðÉ”äå |?£ÅW²&|%jØO1ì•V=ÔÔ4–„¦ÔdŒ M ëTŠ**^ØO)ø²Á^Ñ9’ž9ÙS¥éû<²ãùj…¥ÕÅ,ŸjÕ·
@\c'9œÝœ¼Tþ@†\9öy¥ò ŽCÊ[=1ØÑL	ÿ|…ìÆLhœ
.‰ü‘3Er{–¤@]¹®	_ÐïmÞ}_ä‡ÜnnÉ~IJÖÝà5†çº¸Èû?.`¢ÒÏ89Lnât—žWµ¥FoØé_wc*+—û”o\¢
Mp_y…ˆ‡èJ3LÛOÈ‘â”wŠñÀTxj¢”„ävTj†X#œ…Ü=#|¾ß[\l3ß.[c5íHûà0ï#üÃÝ”!ù•ùµ¡n¾ÊƒóŠþldkìéûjƒ¤”^yhÀ…ž­*azÏ…Ï—§q¦UyÒƒ·ÞËzpcnÛvqh…E£ T<FP†1\Þ¶&LÎK*…˜X%¥Ïá;ôé™U…(7¸&œß…žU+~`Ä™¸ßy*„&oùH"ÍÃªc‡ù¡,Ó‡dzå ‚âÒ0;G¦o¥nLÔUJÐ£tÁÅ‘W’ýH¬Y\Y@§>òÊ+Où£½T½å{Eo¡ûk-OÛ¡'•'¿¹
ô ¯Ÿ¯d°§tiž;3ç¾0Åß8iJ5Z°úäbLõ·›jBT?µ“Šg™¤ÔEX’K]Ø*"ùªO@…—¯ôâaŠ`~M*é$Ø¾ÉÀ“¢£’F,Úg8Ìˆ!Yn˜âŸªO~uSÏú£GJ’ì@¢^¯Ž#©²¶4fîWwïhŸ~}~ådä¨Ü±’	EãDözùí9:„d,	ÇÕ*“çhl+\¶¾JœÓµv+ð>ƒ„d«kÐ\ØÚîvQ³‹ú<;à(’t\)ÏaªšFÁûTZ‘Š‰'blÆä©ZÔHŠF5æ×‹y€íl'X»(@.çŠÔè§©±­ƒpd|Áù´PÊádsßGÐ¼Ï À Rç f?ï¦ûå)	+äÝ1Ë+Þß#JîŒ¼=9ÜƒÊp§''‡Ö³Ñ—Çì‘×BqE
=)‡
aÐƒ)~HIb§w=Q	N”î¶Î#*PÜÍ3$^jƒWFl7UAÑø'6³ëRnß£›ÖÃ]è¯fû­lw´7ÁûI½ÖÚ¿.ñ¹öXZóû\VÒ¿:ë˜[~òZ<ç±Öœgê²j|»(Æ¨°c¾ëóÕp/ï|’½LžâÈý¿ê'–²Õž»²Õ=Æ‚k‰l²Ÿ6è¶Ù4Ù¡)JaN<¿'—ñâX+r¡‹XÓ'µåù%ùñ$dÚ<ë4I‘”Ælœ]Yüæªžè¢¡©˜<¿è´¬‚ ×D;†…«òSÔëGý8ˆ‡Â†¸ÚNkÿ€‘‰e4¦³¡ä‘×QÁ½ùm¯éIK›à ƒ 1Ý\µÖ½Z~}t›'¬j…#Tý§ Òâ`ín öuÿ9e&QöÞÅ€ÒÈt[¤ñe/Ã¹2’–ðØÍ£Õs3ê ™‡…f ,ƒãDP›èÍ´í[Ju$cd¶>ÆÊ=àÞúTÅAWú¸®†ß?dƒ%êc‰3ŽýÜá¾Ëcù1¸ìÕŸÞ§_Áì.Þ Û§óÏÓ×+Ïo°îÈ¼–†l{é»«ŠÃWæbáÌP÷hõæÃšÓÙaªº,ƒÓÛfr‚–Ê¯
Óú«¤}–{­„H2›ëJ¶›Ü›ËS}ƒŠÞ‹´ö}( ÁZÙGSÑSÍÿRur‚ÝÕœÁY™Üéj5òÏ@×¦úÂh&ÓJ9­ êU›*šÌðö¿ÿí?§zÐ„FƒÍ-ÇSa©ªÜêðXˆ®½*0ÍçÆpU1\\Ðœ”`].ÐXé9lÖÄà~¦®j™È°ªßk¸O¹Gû]ö)aŠ(³‡ÖŽë»o·[oö™zEö¶ÏÞîœl·öÛè$CHfuL{½(»º ì‡R™°7FÄ§?Q™jÀ“ÂC¡\a”oãhy'BŽŒn­5ØÎà§¹9ÀO¥äã$ÄÎ¶Žv¶¹ís?<iBœÀU @Ï.¯è¹LnêßCƒ¶¡Y.ú×)Kõ®ÇŸèûe<ÞH-ž‘¨ö>ª\Ùûè}%îò¢˜Ž¯¯™D®0.e©ZNù ëØš™1‡œqòUî±U(ú=¬Ÿ·p¨½¤«=Í;0ªÊNµyÕ´Ã{:Áu´xª-lYl3D›+WMëXÂÜºÆR‚óƒ (‘£h]bÛP§¬Z<+2ó
Æzj¢µ,[u.[&¹4Î$Ëx.eqÌ³[»×ã^L¿ú¥zPí?ö{À6'x¢ÄÙØlU³XÒ¦¨AÜ.ÐÎYú~’’ïè±iV	9¥sTØâÈqFèÅqFÄŽ{=šM²¡{¬Ð„G*ˆ“Á¨f-ØºÙN“ÑÕ­³îpÒcslf8…ÚáÈ7d0:è¢—Újß*ÞØíÌ4Œoh›/‰ŠãsõåÖÃ]6$ÍZôªÁ†joœŽZb¢~ƒ)oOv¶Q&aC…oÕ—°ä'èpa|ñÍ@<	¾“ÕÆ/µ— :¦lÿ2N²ËÚùv§Sºß‹‡=(]šcÀÁv¤Ö˜Åñ ¹2Ï[’·Ñ>HXmHêýU~E|ieLwKóe²§i’ºÓÿ™YÎá“·þ’ÅcÖYM=ÄnJ»ÓÔÖ”*Ð¡	niÁ £c"É8H:DÎ(­7ÍØHv$uåÑCž¯}ÆºÄ>FýŒ¥%>1Òvñ›ÿR¦ZzSÇlPew/-¡·ãÚLFˆø‚ÆÐFÿäG‚!(—ÅDR¥¸ƒTDbÖ’U¯±†g°óÉÁ:L¿8ÀšúR”Ý;Äš!
|Â<äÌC#èŽ»âèœ"c1äÌ÷u’]×:îÝÝŠ–\‡L&*¶gÒö'gôõ¯ÒŠ…tÉÓ‰x\¸…Ä€n´N?¹î’n4Ž ÿö	Éoöýo^NË>UÉHKï€‰ò÷¹«UP˜§Š`FQ\g"`5E°‚•yä„ùH ›¾O_­Gý:–ëÃ^Gòc[³A&áŒ¦ÂØuÔï£³	VÄLgaå-öÈî*À[^ÁB úËa@Šbâòð£¢Ê.¿ÀTÓîÅÐ6ÍåÑU”Í¦eÓFS lV¥Ë‚TÖdˆXš|=`šÎ%›”|sfáÆÄ³/.'­Âîcµ†ù]±¼h`1Ø\´@“/°°vI #uœb»#d‡­ô‘ˆjA}Ç­ZÚQãìµ›Œ_jßêº¯É°•k‚¦P
6TÉÖ7®¿ dýgæèïç«Ds|7UÇ÷3&îŠ(¶ˆX©Jovðä °ÐqÙLáÏÃ[ØÂ*ntÍEäCÎöKoÉ…Ö“96Y;ý]'‰ÃõuLîìfV»˜Nò
9Îÿ¬´VŽ[Îhðð9–Eiªmê‚1ü÷ýâ€-·?H)÷ª‡ÃOmw*~3ªðõµ	ßßî¢ÃÄt±ÛiD;Ií¬µÒž×Z ­iúIàJÓ£ÔzëãRó¥&¥zàœŽÎÂW:íZ—£÷1ÊW—N,(:Äµóz>‹lüZL²JÛ;älÿp·}Òò:ÛPä2âzé(Ð*è³%&Ø&˜—{vtÁõb²3“Hªá-£ê¸îƒXVÜ…Œ™¿+w¸˜ŒÄefMü4F†¥øBÌTz)#U@˜„òQI,ü#àç17²!)ÙØl Ìå†Ê\’<dµR•#&.#RÚJ¾ýQA2ï«ZT¢øŽT¦o‚˜ä÷ùè¨Rº'#Qv6E¯Ó-ùŽ!%‡›KæH`è“;ƒ8äë~œ~4¦½Ò·@fhØïMn:¥±Äø=ˆUÓA‰çG:ÐŽØâÏ˜›ú-•o¸NSöÎ•h¢'×>ÎƒRT4Œ5ªßÚ¥¿µÒ‚äXÊxOÞµÚ¤urÖÞ/Ë‚§È‚Æ"³“fe…¼û# ¡„§_(Ou’¼	äh€©W"yæ´¹ŒÇ"Eêu’žõ“1yIjý—ùÝWÍÛâ+Ê3HMÂ½‰Á½#WRÄ·Þô×<§Bè6/§Õ#Ø]"Xý¤ßl
é“b0å»îJŽ¢»Rš«žMÅ5Èdþ¢‰Ðü„Õ¯»ö}ˆU)†©ÓšcCõÅQ²vø6hc;Q?vb[L¥¹/_«çJH^‘•lO-v¥›²jlµÕ])®¦ÄV[ñ@cÜ[þ•rZ7ÏúÐ‚IPrä‡¾bùà€±rMwµ+Ù30>q‹y(š
âŸ-µ0C¥×WëÃPz‹#¨:VR@`†±5¬‰š®Ðº¹…DNèÙ×…Üb´+3<Ó‚ÛÓþdEÅÐ±5ÉÊæNÒ÷•T-ª¦–U›œÇË[(c]#òG²æËÎÊãIè6MððŒÕ[A«T\mWm Ji5hðÇøv/¹D¯±xxÜø-¾e<c–nÑÆ.:ðn?¦Ô‚e¾´× t2¼ê¢;K<w iÃŒü‰$†h$ým³N4Šƒ^wºn§}M÷*[£ÄØåf²Ä‰9‚ýû—RŒñš)¢¬\xï¦¾þBÞ`Ê)J÷¼{k‚}ô54ê¸Ë	1ETÌFíÓÁ4$W‰4ÔPrc€Xx‰˜Î—PI«7¾­ÿ°j¯À7}EVúÚ®öV»"˜î˜fñÃ—Ñ©Ž‹5-Ð;×æ¶Dÿ?ÿ{¦%šwÑöÊÙÉSPˆzT®›lØ:ÎÝ7u\S6*,uÜ79§/7“$äA9í_OîÃÄ1¸ÚäÜ;È ô»{:HôƒŒ•ˆÅ!fÝí†ˆÀâË¡^‘¬¦ ¦X/„+¹éÑealëÏR«»ÛÓÜfþÀPñ0S"qQ¡Û¦kzHªRl7\ ×jž†Eãm¥@j@ˆ1AÒ|"Aë#â§ŽE¤\c1,}ÂŸ@áxóÂ”ë™'Ò†(Ú˜æÓËv.Jh–¿ƒZsÆâ’Ëå\£qÉ²+ä,ØùŒo×"{iæRvÙÒ-9X‹ïFÞÌ‡üT«EËä"@¼á¦ÀVD™ÑKKØU iQ;äiR–¾æ¦6†ç.‚Çp1Õ¸©‘¢Î&ÄI¹!5"¯GÝˆ­ø7ròzÿ^ÓI7°ïjýxLzôÖÕ¦ÿlJKžÛKIïômui±Š¿|K½ï‘ÿÊÿäÍ9$o,Þî±÷GÑøªñ±Ÿ$i­GVÔ—hxW•ø¤Ñ|‚9¥úbNÞ÷>¸‹%¢­7ŠYñ=™›®7Äû»åx÷{²Ìš,1êíäurÝ’4®ñ×÷­*e5F×ÙUÐ“®WÎÆ¥ñ'8<àßtYëóÿ®ñ‡Ü„åSÑ+á.ÑªdòÀðÍmñEh0äþþ-‰:i’e@§ÌÕÇQÔÈ¼)=Nõª¢,s=Œ(ïT,I5ÕMðà0©ç“šy!ð“GþvKWöpMk¶zs„ßÀ1=±üØœ9úó™n­æ9ÌòòAxèü|9"ÖÀáÓ	 Á=s¸¼9¶ £R„¸Ÿž<Î¨…-mIk…¿pÉM_êaÖô;Þ‚µdƒ~¢yŠïÄÁçP;ÜËåþs&3Ü$X,Ø¹à—š9]õb:[³L^BÚSÑ4!*i*
MÅ»Zy0Jq!¹Î‚%Ø‹RË_Ù¶BmŒŒ¶Í,Îô¨¡ä†OÅ
|§À'Š_Û“xé]›YGsLXçþ¥ËŸ4ƒqç”½^šÑú·EÖBÐCìzpMÀ­x@B4îa@•Í0ÄfŸÆŒ6á4nvåÆÜ½˜ªŽ ¦‰3êÅõ#Ê¹þp…˜T=ð¾•·×þpãOÏïÜÒOâÊ@•ìÈ¡†?¸Üá†ª`ÉMpŒzé ¶øº7ìeWT•£Ãý"IÉöá!Ó0,…Û9"¢. • e¼>ìS–ùjqÉ‡‘_j8™«þÇ´¹B¾ ¹„( ËIKˆ›ß©‘OÀÐ.—Íò—%ú=¯×µU˜Ëq„úåÛ«~%}¾ãu«ñpÉ¶dF~TÐBúÆÇ)1{B¶e’c„Åp}TºCó²[ÇyªâW¹?HŽ’”!
¸Klsêü|~5=_Ý½Š;¿íöÒŽŽÓWÕwÂÏXÃï¨øÙ©ä4OŠHÔ{p–Ýo¯{ãvò3ž‰µ'‹N¾#§ ä`ç÷¿¶yX¨ ]z	Ï>,*_îeI5ñ‘kššÌÕ¤[êà~Bº\ÅIÑ‰Òn(|	ÉègJ±Œ¹ÙÉßIz,Ñî€,LEù\&•æf˜ŽxƒÊ™ì#‡w CæßxÅWß–ðëfÖ,¶1¦ÏìâìâtYÄ&çŸKO'—1
ÛðünÒÏj|™(Î†Ì^VP”†NÊŒÁ­Õ´Jóf”6¸+76«‘‡™ÂùÔp|ÍÿèkýkMëŽLS: ¿éÏ×ÝK¸%¨ÿæTý7ýý7}ýc–!†ÞÖ°Q˜Ü´¦´·}§èÙ=ù¸²º#ØÔéO½nœÐ¨
w®½ñYËª	û+9×*kª5\³r{Ë¯yÄ“òæ¬ÁiÌÃ‡Êk•«¥M_Ã«d’¢|¸Žg}ÉëúW­ò'q@vWA!e°‚««Í«pH5Pdè&Ùæªëßw!_q_—Ï[Ì_Øâê]T*;hÔ‚k*cC~™Œç\9`(Ë²éáiAi¯PwxZžÇœíæü¼Fö›ìH‚DEƒ.+GGVÍð
:#É–ŠÆXgMòØ%zì\ã<Ø¦‘_z GV%ŠC¾d•’‚Å„(ŒÃ	ÂBæ£í‡¾Ë\BäKšßðXù
-+ã7ŸT^¨+å8ù 1øW	ŸÎÖ¯QVž¿¹&¿äa¶‘6l¾‘K†mKªÖ$syÃsÄð«+38vÆõJÆgÂ¸³Z2 4Ky•Ch}À‹¥•âV}~ÌÖˆ[vqeŠ¥*¯80çYrÌocª 4.Ÿª”É	ñEÀàÀ™Å×„ƒ™†5;|N¨(WÞ'#Åh•ûñ\Î(±à¥¶ž@´”à!”xùëSæ—Ñ¡…¤?O
n§Q¦©b åÌæÂ+²º¤ÜöCãOqŸ0L–ãÄZç]´]F2]Ï³y_ã£¾×â£Lð'Æê~,L(äk»(lc9£Cô’·”LT"¦xÃ»À!'Y@Ö3\¡™ÏpÉÙÏ˜ü|´¶ºF(Ë^{îš§:ÃÄ7=¾ìÀì}¾'?¸+lW…ZÅÅ¤-:†
57Š+cöKyÜBþ“øòªŸÇ¹ØÏ/“âõ7ptB4(R€*òÕO:QÿŒŠØÑeÜ€d#JÅµóh4ÚÐ×dã)/zrG°?Ÿ7Ý5x…P11ŒÏpQiÖï’ç‘ï8ÌZÊs¥„çæ÷3$<{Ò™ÃNyÊ: VØ€BŠ˜ÄiÂ9ôÚ††mAj»­%/ÃpA¤Ô›–˜Úç:Ï€˜g>ö@3QUË`¡g“JÊ”[zYŽ,…ROÍip ¦èH4""¯ÑjÐ¥
’Sðƒl^…§#¸Š­«j§1†²HQ6çäRª9<S¸" '–Ôt×™’¯$Ÿ»W ÿ2F™5rë\8ƒ,¼+¦’/äJòª‹ðà(K¼W(ËòÖˆ(À†]aŒçWVyaîÆÂ™ç>ÂÂOYx’r›6j²áˆ–g¶Š–ŸË4Ê¤kžÌ/h.ô[ñÄóÆáã+1•‹»rEæIE;M¢©ŠK©–ÉŸNÄ²¥ÌI”éü@³¾W3Ã…n	]GL\8YVXÄ{_–iŒ¦E›¥É‡‚SSÏ~ÈÜJÉ!w8QAöäµ,ôPÈ‘EcdÓ…,]–†eaÙ¯LÉb¼|c©[õz^´˜qR¯ûª³É×Ä€–YS˜õ’J&óÈUæR¹Ê~÷Àÿ'íèZ©nüJ©jü©¹j{Ø`+Ì•=àZnÏ^áN½Ï¯ËhêHsƒ¨Á+šHuMD˜xgÔFÊEŸX@ƒR/„i&ÊšÍ[%áñQóRHpärø¯(}òÍ*&l¿>µ¤Xyþçý©$¬ýG…$d8_R!)Å?~Ý*IAá…ä[ú×¥Ž¨ŒûÁÕ6m÷£ŒÜï’ÌªŠhÿ¨ŠÜ»*¢Îø<Ô‘‚EÿN•‘o]õX×Tæ£êñÕ©Í{Q=šªGñ~S©Í¯TõhªGóžUæ£ê2œßêÑü&T¦Aõh~ÝªGó©Í{T=îmIæ©z4UV=šóS=šª‡¯½{S=žmCFë£þQ]ÿP*ÖÏ¦‚ìŽ®mX¦Åªµ·ç‹¥&FÏKñ |«šˆ2›_>R¢å‹{ÓM”^5”á|AÅ‹ðU+)%²O”èÿ«RXLä¡µeïEwy5šQƒ1®Ä£sßjŒiÚç Ë”˜ü£FãjïÞ4šçÄnó¨ÜTWnF×é¨ÏC·akcÑnÜ7g§À_š—~ÃgIVo¤‰ûVµ1_f£P€øpoèáQ›	ÎÔfJXk_µ&£’y± ½UŒÎÏZ{3w/šË½¯ËŒZKiö5–ûÖXô)Ÿƒ¶¢0íGMÅÕ^%Me¦[üÚŽ@YùËuÔïoÉÁ°KUYÊ[<Z®\Œf…#ë(ŠŒGeˆ­šA'aK8ø0n ¢£Þgoñ¬’[úTE	iµÀñ5—vÔèqiI žÅÃòksgØ\;´9ú…»Ä_ø¹“¸Ü5dÍgõq{XZ2~­5|·TÓËÕA··w ûªµÿz¿µ¿OöZû»í“Ö/%’¦³ÝiGÁ–›PpÑ¤ÁÙ *^hØ£l1®Œº1ešQÅQÚ¹"ß‘×¸²Öênv[±ÎMý™r[ ÜúŠ¼9ÌÀúÀÒ¸O7Ü§˜pþH»¸©ÿÉ†Š´ÉßßV.K	ÑE–ô¯Ç1éÇáP'#¦Í››uÁùÁ…H!>BN7Gå$Ê-–cè¸u°KE'[K^¨ÃšùËuœÞÚNÐ„üÈOÖTÔÊXæ'¦€•	J=Žúõ¨,™G¨JòŠOÆ<1Æe³ó¥0 Þu…ä¢ë±×m{(–ŒmI`#W¬xpŠ\)ó*}®¼@AvV`UšŒúý…-@ÖTXoæ–´VZ[-*•À€†ØFÔ¯ØÈ1mä9žîù3úü<\³âÃmúpn§yÏã…ì7jm9ª©9©±ÿ1©•“X!»XæÙ·ÖÓÃS5X"xîNT‰s÷ì¨¦¾Y¡G/lI:õÉ°JŠ¦ß\™Q¸U÷z)m5IoI1[g—pÌÒ v~ìÓ¿YíÏ E<óÙÉ3Æ8ð2cEú¡Ä[ôrs|G]«ÃçÅj`5GEq2p••§Nñ~¬ˆbXƒ·ðäá¬êŠ>›+ã«éÄ³6•¦fkIg8³´%Lƒ°Ãgk
ê²0˜ÍÖLŽÁ9ãlb´ëÌ:Fiïò
*wfœþj%;x’nû¦¹Hº·òXèö¥» ~Kø¹9¹¸ânïzàªu˜{/¯hÙnÛ+s ù“ë	€‰ž››ãä0¹‰Ó]º‰kK’Ž®õê]Ph>Ø¢Í®´1¤->Xg¹¥lªÝöZi:aGcÉIšf*9åÛ¼ØŒbéàE‘äÛñ&_¦|Sð€Ð &=Ì>ËòÌdÍð¨dE'¯HíI¹¾ƒ©þ“RÝ	lî–*QRŸžÙç§25÷´ùhÊÕÒ+N¸AÅ·q­-“”A£b· l¼› »v!~Xr¶Çªm-ùÍÊ”÷É¦déH°à Ý”¾ý`Îã®vPNƒ¡è³ÌŒô9 ¾©½›ú÷äŠþ_/Ìc‘ÔíÀÖùhÎô¶PvÐÓU2N€ÊOœÍÞà’diçeþì‰úã—Š9¿,]±’‹£g½+«ÌÃ³ä¤qzšô{Û—Ã¤žŒá.ô=$~Ð¹ŠÒíqm5$>(Ú"8Þ‚”¥w” gQ‘û‚îÚß üR±*áñ$0tÍ+P7š0–wGþþ·ÿä¤5¬ÒohJP•¨•q×;V>&4{[Qp|KvFMÙø\Î ðâV†eœ±•1z,ð¨ùñ6Ù %7_UÓáuEêûšžú®¾¶œ"?ïW?MØ««˜zs|õûÜAUÔªF™ä)Yrz 2½¸•!ÒBµ½…ÆÍ1È=¡W[À;åÒOJý-4ìC	úàà„äQ63©èQ5„cãeå¸Ê5b¦ã0ü*…oLaÕ4h6§|Í7lâwt"‰©¿—£¨ˆêúG?ƒ`&èNïÇçÐ:‡´Uê…-õó,k0‹´ií›ù5Þ,5Þœ¡qCbÑÂ–áËºÐ"Áò¯|1KÓÀU†ÙýA´eåsxÃ¿ƒ“?¬”UµbVærVõ5oÕ¸‡áá¸š%Qf+"(ø‡«<üÁÏŠò¸þ›zó™Ÿ~¼–¯ß••1g–£Žé‹~9R—FS"÷(#Ñðö[¦z³,Åçä«§BvÕˆS@Ô[ð_R;£<½¥Ý¥Y˜ïÁ.å¸»¤–"Ã:Ý”Zgi¶½G=R+„(mzI©`–VwÏv¨Üt¶C_ýz§ŸzÄì$3ÎÁ›í£ý_¶ÏÚû­…­7ÉpetgyÿýÝ·Ç»Û‡¿žœî·¶Û'-Y ;¡ƒ*É6¥~:hµßÑæyìòÂÖO½t¹Êrð=‹MJh@À±jûG£8={]*ÿÓCå0a‘,Ÿ£‹o'¾#?-Ö!Å÷óÜá•qc­`Ì‚-Â
‰ªXy¿´Å¼¯o£íöî[²÷®ý9Û}»¿÷îp¿å{g>àÎUÜ½îÇéÜ#ß«F³?Ÿ2šÒE:†ïgn·¬ãÕºÏCæŽßÊlÂöÂ›ló	òqláòèµKr,/†Eq]nú×i4ŒûD,·km®\­[~•¶2å´ªo0WGb%bêGÐeÝQh cÊ²Ê¯X
þSœÒEìc¿××“uä¼T6"(×ž56WFËuÌµºå61/¡{ƒÓºÁê%ËAÑ²×Ý ç¸9}:Ù£[¦1LnjKT8²>Â*ànðQô}sx²³}¸hF(bçGO'u|¢úûÉÚêš»çëBQc_stqY=œé½?2*òt¦×½áMÂÑøÈNûÑmœ5Ñ†¶û=²Ó’í«AÔõ<Ñ„ô`Å?’ö{ŽÛÓ¸«t³{•Ð—û9î¹Ÿá=œín¿9iy:ÉÐ÷óÖ]´ÜkÕt½ã=U;ô…\DøÁÖ¨}f^¥B’í·»à¡¤ýðý™õæ²Éwr$n,:%|‹L_ö œ“PîBO¾úÜ¹
~Yš}¦'!Æ–K±æE4U@T§õ–Ãï´Že{†±»i°ìD†ŒYûÑ»¹ÂÎªjØ¬å]*3grØ‚"¯sNnæ‰Ö‡Uk|ƒå¤P%àï6ÅM‰ºuÄFYåÚ*]9 ae}•xØ·ƒk–[60Öâ”¶|Uù¦Ï[ì.ù%[•¥7Rµ8Y(‘Ï‰.èvNz_Òó2c½Ã‘Ív¬ÊrmÓáè·G>•è#óðÛ ZÔ.u#|`{E]¸ÏøÁÛfµG‚·Wh½Y­õfhëð+´õq®w
?€·–¤ÚHéGO 6ni}2j˜°FvA@Û`ÿ ºXÄD^JN“q?LJ½ã«˜r«AŒ‰–`BÛSZ”.˜È)Ë~â|©¼q‘‚B™¦R•9_âeiý–¥Ù^.æåC¾“$ý8.1xlø½•ÙæÄÁf  I‰3·Šl5rÉ†¡«øb°Õg´lgÔw-_ænÕÞø#zg–žìtÃÃÙTÀJ0Ð€u¬Eó†'bY(“n¶§t®ÇÍUP3€Y%EÅÏ˜Ì©£o p`Š¬?žÙû©"‡ñð6Ôl‹Ø¾"àóú¨¶&[W±F"¾Æ\‡ñBê…Y!Ê*„ÁJ¬Ÿ8Wƒ‚ÃR#2…bG¬`aÃìÇ ˆŒ¼íP§pÛä½¨æ*‡½_ý€Ê,×.ÃPXJ	­Õ@Å
}Ê(º ÅÊý
°¤Ár®ëîM* ‚á¦RÉôKv¿Qù¯Ë…½§ÚæÎút¢Ž·*’RØÊyc¤Ó¡¬Ê'‹$;‡ì`õ
Ì^(GÇ…‡ÆéÁqEd„ÅUŠ‰‹Š7óô†¢=š¡*W=·Š§2×yXÐ%Y*Ì(ÁÜð¹ËßµÎB¹îæššw3’éæv?NÇ»½´£ç4ÓP.°%dñŸ£tHéxCžG ét§ÈºjüÝF50ã,…ó° ûÂ²gÂK®ø°f¨ø .š|÷½-j:sZ8Ð9¸¾vœ¥*ÐÕ¼(w^ŸÃZ._–sùò2d®*<ù‰Ä“ƒx×ÌœVæ²àà[ùl8K`§ú@53Š*'ˆ†Uùß¸7îÓvÙÛ0;’ï¡ rk§QvÕ¬b•¶š9Õ»æ‚qÇ­£É`Ó™HÒ¬"¼ÝeJ	þº_FçŸªuÅÇ&s,òÄK<jèî—Ó|ïõU/Œ„y(U}‰¢ýÍ‘ê¹£yÚ’H]Ø
T¶<j”(vºµsøn?P1ó-åÕ	mLõ(ò3{/zBbm¢Z\î‚ç¹ê¡×™‹4s_f~L-lµö÷îk‘wÞ½­1·sÍi‰Ñ8¹‰”{êQ¸Ÿÿy5èJ×IÿRúøœc¬…OÞ™¬Ph‚Öˆ
LB&ƒ‹ é¬È! µÝ–/;ë?Ô¢ZBT/Fh¼öTf9™<ÔÏ`ü˜Q«&8yAÕ¢ÄrÐT	[ev‰Ê Ú,Qq fSÍŠáƒb.a,‹ö
±š~ÛF˜]#Ô1×ÊÛUí’« ®}É3Js†~‡”6äÇSêËRŒŒ×Ï¨Ò]ßØÕüâgTóë;£šgÔïæŒªVjüñŒâ÷ÌûŒ’íöó9¦ §Zëû<«LZ_Áyeöã™õÅÎ,¦O.ý®/prIEçspëT~Á£Kýü
Ž-}ÈGÖ;²f)/ötfM}Ãtµ—_ÞgÖÔgä´upÜ&ß‘ý9=iµÝÙ§ñçQ’Î¿ÞÒcÖéTY§§);fJ:Û<swÇÇgù÷÷tºTEFð:XÌ!‘R`y¢Cª'×)Ôy¢’Õ=bz%(íRú½H“¨Kçw<E¶éL¾\wôMpÌÍMoHÉ¸³P³ò-+·²T¯ B÷Ž-ƒ«™žSÚžÆÀÄ­Xf.$ŽQsârŸëÌä'˜zÌ}qð•óÿ÷ÿÇ'x:‰ kñ×_5€üQ¾koïÿøóÉñÞ	Ù}»}tzpr|ööàtñŽÔ‹Rz ,Ð:H?8ˆ±§ÿùß$:oµ;¢¸8Iþƒü¯K·|‚/ù=î^ê—³*?Z!1CjBä%Õ¤ª"ßÇ×ïEéçÍƒ@MØ(•³Tù÷ðÅ*Ÿ“÷ø}œmðº¹åÛî>œ¨ÙTàü_‡`5ÆÉ;à2,Ãç¾…ÑPêiQ©2¯:™';-müëðœüÑ#*Õ´ç!²×+½“]ˆ‡ç€þTGÛd¦¾Å»Œ®—…}*©ÓIþIú>Ÿ?ØOeññ<žý×á¢ë6£EœŸ¢¤Ã”¬ùh„£O½K€¢¡í¡5nRz®¶éWÃ£B¶c rJøn2êQíç«hœmFd'çü$„œƒÝ¼»'î¤ð`¾ó€‰áFS‘½Ð92avx9
>g˜YX¯0cú­r¯S!1¡¼v%¼FT€/gâ½*à%ç†›2è }Î–Ó·©Æ©2ÂéK„ã§%›’’U„®ÆYm"p³²ÌaÌ<ïnÆ`2Ëè‡Êe[Îxy$ÆBf4J1[éâ6ïn_HFj­ƒÝ¥™eìRÈ›ãÆBtÍdfÃÄ†výéìÓ³Ì½°rcó¶ÔÜX%éY®@D=œêù°®ÚÝ®,W_kÍ6 €·1mSLXXà¨Y¦‚>˜-íÌ’ý~•˜rpyÝ•¼4Ü†k<oä1d…D+OYÍE·rt`Ar×³WnÌÒë7²·û¡ürÅI+-˜‰ìR =%ÅØ(¾[8ÏC
ý9çòî-È#gi&þ6Ãã!Õ%ñaâñÕ*ÌÇT±0`åõ}áAØQ@4„!8&ý3ºÉ^Nžßis×$öí+]½qÔïuó&çu¸Ç- ÝøÀq,ÞéM,kƒAÎ¥<\X6®Ž€y‹*ƒ•á°™D0K£Z6QžŽ‘O;–Ë	i(áõ9un©g%•›­J“ªjð÷Û—V¢+ “ úoÒ¬LÚ>*n±Aæ7LãI2kvHSëï²«	”Ô³ööñÞöáÉñ>Ù=y×jÖÉƒ³vë`ç]›*Xdçd»µGj‡?í“öOàT/î:=ÜþeIÑk'Y'ñR(¯3h¯—O¾ä ÒdáÉ9—4ÑçúÏê§›9ây:ùØ·“ŸÑ OOõÅBôFÈƒl°!Ì‹`$Ê›y±Š»¹p}øÝõg‹wºì\;ÊÐ%—Œ ‹xœ&}²¥%]¾ô•kqÓ¿Ò¸Ö«åÖÜgTBÌ¡÷•ì3ÏÊs)J|*`Ê¨r·x§OA¨'Æ„DPššÒ
œ¹B³Â±ÐÀìCÿ#M]0	9Ç ’•ƒësòÙï);)¿5Žÿj¬úÞà9çs>h,%J‡)XÊùÉneÛê–£$ÐÆèä&F6Ž$ u~ÓP
S¡¡Û³vcI¾ÁF×ýÌ^k~ª°cÇb×q˜ñÂ ŒLJZ7Öt¾mj}=@‘^Ü^6N{×`I­ø’VV³yµæ&R¦½]ÂfçV;¤Wü›í+iõ«Xñ¸yÊ¼}æ`ËÛ\¹Z3¾±Éz¶fPœ-;…;lÃlqÛ&]8€0¥¿R)Çì~;Š ˆ7‡¬g’0ëòïûOÿMíd\ÀÚgö^r!67­qÃÁ¼‡“Û!ì‘Â•åñ¸M}TOûò‰^ÓûÞ^
W¼þVL á2Úm]bŸö-H)0Î„îÇïÈ1s\£¦ìv¨ÌI÷Œ‡]’KhÝ†[6J—¬ºIX2AÈ>¼yzHÝÔŸ}Ïºynqkð>Ôý°âõ’6]dIÿz°_AVv2‹GÉQªÊWœJ)GÅGÈ©¼Ñh˜ŸÉcìPVfÏüå:NoÍšK):êÖèÖÔ°M‹4m eŸ
9£”ƒæs-Çyâ(MÓ`\ˆòœØMÅ<Dø0ÎÎââ’b¼ä¥8À“(Q¢HC†Œ—cûmÚA®~H{”¡q¾î	gþíäò’Š°;lzŒÛÑBSžÌ×…XQ{"ÉFSt"FSF_³ ¤yÅ3QEÇ8ÃÒ€-«FE¥Üa.„^‰ŽmPôø˜;¾Kì25Eu/Ã·vH“èÎnz`p†*¼Ö¹ÂBt4@ ÝÑ`ÜËzý“‹h[(wd<
£[ºuß€[°53Þ©K¡tTdS&
 0N:6þÕóâCr§‡7>ÌFçcÜ,ÐÜ6ç¦êùÆôÍi˜NW\Å‚b¶Ê÷á^VÌ]ÆÍ£Õézÿ7Ü7¤Ë¼y}®ð„QÐµ;n¸á!L/•¾´q.î¦Ô_1R¯=Ÿ’jÈèCRÐ\bvÂhb–P9þ”Ýçj˜Aï#©Õ°Ô^”PÇ‡—KÌn™ö:‹ ·]gqúªÆ´ìçÞøª¶Huø_—–¬‘”;2Ò«A#{Qv…A\Ö’$îSF‚a½3YGÀÔI®Ü…uËîí: Å~rÙZ›1q0?½Oö|žñÎƒn &—'×ãðP4FØxêÒµþ}Iã3	yˆp1G¯Qm±IÔ<S‚F±8“<k¬Ãz2}ð¾ÙŒW;v¦o,lq§×ÛÍ+aÖ°ÃpÅ]9·Ôse.I¿¥LË1¨Æï©L¶¸¬GK`µ?ø)dö¿ºâÜE “Ue´¨Dfwa¬sŸž899…Ã¿j’Ji•”µÉ÷ª¶#o®èÌ2ÏÌ0AkƒEr'$-YÄ€Y]s&i^6Y¾,Í»Áò>1·lî-fÓ4?¤ˆ¨>»¢2ôvŸ…fƒm26-Aˆµì
f9+¯êY$[µy%Ô¼Î2rqOTî§ºŒñ½ ‰Ý¤ŸÕ”wÍÍ…Rx¡…:ØìQfê †ÞÌæo™(:mÙª­LziïcdåNÄa¿›…œ{
«dÍb(DË•Rqt†’%†âEyô‰\BG„{àLØmB6²ß‚ …&‰ÅTÛ( o†v’ûnÖÌ½+èc¾Î›ÓvÞôwÞ´w®VFòw^”äÀ	Æþ÷!hˆ}$J%ÿ@´Lhã ”Üÿð;Wô4ëES6j,íØÄ&±6t‚e¹Œ•½Œoá÷|Œ?n; ŽúIš»äÌþÉÜÅ½HîL¹XÒ T‚Túþóšè\©ê$õžcË@ÆÒ(ÄWUGÒÔFÒTGÒ¼×‘XéTS{;’\ÚJ’‚”_Ó7€æŒÍC”ò´#¶‘6@	XƒŽR‡'}iéðvDÓ»ãè1Eù¦ibb`g¤Q·GwO}œÔ/ÈÇ4ˆ>õ"YxKÄj(® ™‚c Ô%j6žç12Eí+S´L1#V×€.ùµ3c8ô‹U¡‹”ÁÃ  Ç>LÃp¦Í	ôÁÐ˜R›l‡û4!Ü§©ÐB«0°)À¡8cå äš,¸‘7Ò=~5Vˆ	ÒõZ‹ÎC?l…?k@IÂ²Åz@^õ€ÒcE´‡ìQÌ…M™>¿S²=l™Ubv$ñ0 ³Ã¶c*§†«þÃª‡,šÃ³ÆÖÕ† -ÂLÆužâ!!¼Xµôfó¨¬6¡ø~žjR™:Ëò˜¾7‡?•JÓáñ] ß;ÞÈž·âxK×,º“Y@3}^àç´’þ»ÿüÊÏ| ¦Á˜®E*ýjÝ}ÌN
	’©pœÿîŽ|3srç…~bbi/c‰'/IÉYÞ 
ù ¶ÄBe0ú–¶ïß’ô&n+aièK)cé*™™÷á+“éëÃÑ½Z&ëÜ“„g£¼ƒKè;dÂ*W4)ÌcõÈXHÉdªmÚ-eÅUh¸H ‚ÝüÅ®»8õyï“Mqp*Ë¡!p,€mþÁß©X“AØ-=¯«k|…¤áÁ£€óíùª.Jqïû2·ö…u®˜!r”·Ò²«¸«tDåmßÄí„ÅåMÌ
Œðô†õ›:œ‚ öt¦29·DË<W°{T©ˆÇæûáé@çaZ\~zúã¦­,Zy¢¬ü70÷Ñˆ‚8N¯‡hl¡Ö¦EÝû|’(­XU¦‹áÍåÙa³Áþ_l®¡mO2³¤¦Ì²˜^‘}ÒdY#ƒö…Å¥ãš’"+tøÁ3n|Y‰Æ<áî°Au‘Ø,>Iv†WWrËX©Úøc`ÚjT’®°lHlÒ]äH6Ï“9‹Häð±Ô&­RoÔs×$HøÃöLˆ!Y,ú½ëdg”y‰òE•2Ë.ï±M“d±èrŠ§¤ÃŠ„ÏÐò‘K6+v€mÈœZèiÕžXbþ¡Ô¿Þ«ÍWˆy‡;¿òîxûììàÍñþ^žUxFÞžî¿!§''‡<ù°„|Y3Çõp \±]n¯'e¿z
LÎ09Ç îz¢&#ëî9#AŸ#6D6¸{Q›·tŒê •‘–%pˆzbSõ–rÝ†r³Øæ~ù«YW”u«ò£¼ÝÔ«þu‰Ï¥G»û«„JZ›USóB'YìËë*xX›sSnx’ËÔ•Œ©c›ÚŒ¹£‹úºÔrÆ’Ðúó¦äK"ðä¢{ ©ÛÕŠŸÂm®â¬ecòÝæó.‹ÓL%&Xºð¿\ç¥Û¢ªAZé†Ñ"Ø²i×`¦²˜#;ÉO<‡‹¼¥“¶äÓ$éà¹ØØ¾ˆêô[×t]FÏ)J=— %í¶kg›°ü}Šz}H«wZ@Ýoï¶D@Ý:Ç.„|ôoItõýƒs:h«I*^ÅàÙ §ýˆ#óGÿ¿pDò‡£4ŽŽ—² …ÍÄ¾MÎG…¦è¥ïpãDs)Y*í+ûxu}ŸÙ3E±a[gõY„È©4¾ìeøÒòJKKÜÍ£˜è-É‡à²õ>Ï‚ ²†3tì˜gdÐ]-zAqà]¨„A2–Æ aE°³,©]™gýÒgNR"”d_”F(ÁË«hã…~6å¼QÁ][6’*F=…wV×J€mÜä¿ò"
¶’Jö& hn¨Á¥<[QŠªWE.Œ*VŽŠ,C…}úÝ(IY´™àjÃ¾4]×øä9• hæWˆ¸Ê`Læ…O¯óéfá[aG­OÀ.¾•gbÉ.(‹bj?é++hšÄÝR­
Îévkÿ¸MŽ÷öŽÚ¿³]ª‹Û‘mF0‹:åƒaol€µ9Uox¤e€½üV}ûåDûâÎ|7 H÷ÂGË‡I2¤t3ÿÆÚrÔ¹Rš¦ŸÕ{;ðUœ½œð?Ô_„ã—“âoõ‘Uòr"þ”ïXq,Ñ»Ãƒ]òÓÁþÏþÕ¹¾ ¢ÆO½ø¦Àdð -03ïŸ(É‡B‹e”ŒoãýqÇ˜„OJe¡ƒ†ë–°¤TYsa³Ò4üß
º’Uôæ˜"½^Š¥ßË‡šY{0hÙÀ„Õ†Lá K¸ˆprgáƒ2MÌ²³d}-äç"CIŠ2,ô‰7r¹aJê-ÇÀ‰Ð0~¬yOøõ!ˆÔ|}vòz!µ€…žû·KÁ¹:Ö|„BÌß‚˜7Î‚÷¢´‹<;HÁàËšy³ìˆÁ€˜]Ð¿Œ†¤ç&áÔVÈìÎÔ
ç(û pŸ/la®Ša)j“²¹"gÅV°&H‡ç(Tt!TÔ§3)«yº))}Ñ Ã;¨BÞKI±F Yžî'PÖÀGu÷“s•‹„2/¤“?Y?„!!†_Éÿ  ÿÿì}ë~ÛF²ç÷}ŠŽ&QsDŠº9±Æv–¦(›Ý†¢“™ñ/{‘‰	H0 eYÑOÏqe¿ïy±­êÐ ú’rGø`‹d£Ñè®ª®®Ë¿pžÕT@$(œ6I÷p“D˜·{}iƒ$a{éB$çÅ[WI"èA>¢<¤©ôÙ~3ëÏ9 I®˜[£D:*§Îø¬€Bƒ§Øj@4å°ãŸh”ïr`y…Öõ¡«Z_h1® ¥²+C©ÈÙÕJBü÷iN‹ ¦(¿,|Ëgþˆ9ÎsË`#3[À³Z1—PAÖùÐ¡Œ¸•2¢ JÓ‘­F9Ù'‰DZ±k$rÙ®[`K
R¸Me¶ú•º‹ø!ê³™ÒZUœ¦b&­Q¥QKGØòDÌ9îÃ¡7ÓB¾0bW#úq©N@¡ŽF9…À¾qZ,1EÌnÐrêéÚ«î¡¾ÛÞCk>­ÌˆÜÞÂ‰oõ}o²lG‡ÁÇ aÉ¥s*ý²þDÑrˆèw%ÝÕ»SÂ C™VaêTplNwLßmZª4B-¹3‹W€ÏŠfÜÂ$éjk- K‹I.`tË¶F: ¦´®ß"ô¶ÕÊŠÏãG<kÇ]mÖHã(¢†\tŠÏÀò !¹$E¨ös­h‰_L£xâ©wŒÂ sc„}¸ ±â—üÓ½ô¹}LH¯å¿b©çXmÎÖTz,›ükü¿ÿKÅî²[>ôà6büÊ> ‡Õ³äfT¦7‰Ê`˜¨|/Bµ…MzòFþØ-g÷8mðyäÃÆ¯¦ozBš·±Ù:°“þ€LC@å£°Cõúæ¯½áÈ¯ñ±w§ß7b?¹çËÆ[™_ß„U¯·zk‘çµˆójËx¥µ¿ØB?uÚ³í³Vû-iõßwúÉ&~ØºxËâ±NÎ[ÇÒY÷.G7©­;…:‰†^˜—t¥>ÑL,8‹Ô›ä·ú¾C<	j– t	Ô0†Æex£jW°Ó²âµ,i4GA‹•^Ãè¡FýÞ'ö×¸þþùÎÇñÏ¥DUn X9)Û,Èlú¸Ùf³BK”NÕ§ÉÂÎ3_ÓÍ™95ˆ½•6Ôî…d6§O.@ñÚÈ$3`·•~¤ˆOåi~øaéP{TÃ]a<GÏrh£Š‘š1WíSŽ%)Ëšà‰Õ‘6Nö¹7þÔ1°ž“Pæ/É&{E8—za}€ ç¾q¿1Üb¦=oR›Ës'¼@Æ0b7?†…Ð»›T°Ú©¿ÔÙNÊV“½´«]ya¢2l9OXÚCY…ÖŸ‡eÞÍ…:0™w©h}QLÞ?Ü¸@m‚ÑYæ™X{ç¡–JÓ[f Òs„Fs}ÉK]|p†ÁâÆœ’£(Îá%ÆKA ¬áèˆšRDŸ—/)6 g1ÙÛ°`sèQû4n°Ñ#ÅLfxÏÐÞQ~°©—g^pˆÞ[Š’®{î”(;â©Ò»ÔcÒâ¤ˆÀ t„bÔÎo¡J;”€‡ü„]aÁèiLbœÍ…)OUg1-_5<l²ÓJ0\â¡ÊàýüòÅË\ôì./j‹ãG¹ßÐYF!üý,ddËïu}î9£7ÍS¿*<U5o<D<OÐ[n&Ë7*‚ÍÍ 'êM•º€à‰ÖDo®˜·«qÉëzËíE„F'pAá3Y«=ñØ6]È™ƒö³Æ«\ 1-©»X\ôN«Pðæ¶q—‰½{"¤ÕR¡OêH†‡’÷í5sw§Nô|Ÿ’IFF2Ú1iØŸxd&úis•ñÂ-È©Jª3õÈC)Q~»¼'¶4µÇþà—vŠ¾‰–¤1Á™ÈNNî„ÃâÈ&ªøˆ&‹©t!™–ˆÖg±|äðq•¤“¨@8²vOø¹,á´B8/Y'‘Ù~Òn•ýÔåÈ’®/Æº$3ü}ýˆê¼—l1³q3BÑ¿÷‹–ŽY}ß@¾iú³ÀwÁìŽŒ"Q;‹â1GÒWµ}ì/mûÈ…EiyAw>ÍñèÒ¥©”•e§ÊJAIé]ã=spR¶¯ö„ðú²þ“DƒŒÑAÏ»¾ï‹­ñžq(v	}z[ÇÐŸO¾-aª§ Œ„‹®àD0»EZ1úõ®alÔvB=ø¾‡1OL7ÙDÿ<xÔÜûÌ»ÿ×¿òzxÏ_ÿŠE6¨]ë	ùiJkk6ÃP ¾úÀCPI£ëYƒOEBn‚0„öH¬`¾)üÿh’I(Z-¦ŒtÊa&}‚~ã¹¦Ì–sÐêy41*Õö15ê#FžRTÆð¶0„i4‡'úâxÎAìm}61åSYÈÓ‚.¥53ˆ‹èèŠßÅ!æxaóÔÈÕˆâ`LÉ”~˜ÁÂRcÃõïóñßëð]U‹î&¦ÃQ}CÖìG4NðŸôIâlp7%þ>²ÊKâOÑÐ×ëâƒ¢)ÌíÃ!¬¹XŒ­7× ˜¡›°4Ó¥·H m…Ä?4ÂˆŽ’H‘ bÿ×ë@É{ßH[êM<hÅ'_«ë	^Ï`JW²˜–õ{ô¦ÓÿÁ0€Pîñœåt\’AÑh¯Â[¤¢³Ë(¿¼7Ä¸[[;˜Í¨íe,Ÿ¼—!Yø4HñyŠ=
ÕäôE³h*Lê	W‡–‰Ë°[áåšK•n¡r §¦"^á	 ùrªc’¿¦¬ð_„¹NÁŒZ¦71Œ9¼–®œ²+Kã¨­Õ¶LrSf‡* .žOûBaF¿˜D¸”CòW™’ÒéNCÐ)áhRó¹€ˆ4•È ¤úÈ,s¡‘‚Šå^‘I¾ìa/Ú ¸×!)ÜLO´¦Ó8¥ÒB+sí£f¾ãEpÖ©}Ïç³ä`kË›ÔK¼ZÝ'[°¿Çõyùõ´WÝ âúO8JM1ƒ­²ËB=â¸ül¿Y¬JÃxi‘Š/‚Œèî,GHBs\%-›m©3Å\ÀRÚ£*¯­ƒ:‹ˆñf%àõ(¢fA®ÜÎÔ£Ÿ½¢U·ÚéTWLöP1Ù¶$w<SØt"kï©ŸbS6ãoffÿŸ±üÕE7X9üaŽ<t“8461™›eCÙ¹ÛU9*pLæŽŠHÞÌE)Ö›j.BdÈåRÿ²|ÑÖÐ±Âtêý/‰U‘TÖÐY·ß%Ð¦u¾n3¦9„Ïwi^w»@ÒElU5˜s}(Ãhr}xVÝÞV˜]\UW¹"MS£Êãé*úpKåa—*‰›-Èå-MIÒf!±k%)A¼dñ^.”Æž¤—ÉèµTNžÍYAôKØ`i¢„³yU‡‘¢0CºkÙ±CJ!n 4ªqÎÒÜÙÚ™JŸ´ˆƒÙ²¨Šÿ¶Ø¢ŸN¤‰[T'CF1a?˜¯šbqÎˆýA„´®pªÕÑMÆ'`ÐkˆúÇHÐÎç‡dêßˆ§$©MYèà0—ÌÍ3ã;ñ5-)?–¼ krO!©Çšû :6%ùd­œ’}xj¶Â¿¦ŽgÑúBtðA—B­ÛiÒ–9ÅÔGš`³E:‰ïéÂšûbº_Êx_{•Ù[4Û©WS<vÚÂ¾òÎ™6öàt½ÄK³mìQ‡
g+±(Sƒ13Ù­4Â`ìf+NMÅ©¥˜qRçA0š.bÿýZ$ßàÌƒA /Åü#&Óp¿`N§Ïh—S© v9äD¡„ØvÎ†’»®˜\!ÝZ<þéq¨Öªd7éŸ`‰õ¡ÚWÝÃ"r·œŸeËA‘Z®xÂ&þ0¸ž’x|’+ž«Qn—Pdá<²É*Uà˜!e—ª˜L¶‡çjäwJ‡*â²Æ-:÷$Ž½r¨Ô~³ócŠ•ªò4VB"‹¯Ù¯€æúÇz
ìº³Î%Îôé ³ê<ÊûâäœS(Z›-¼´Úkþrš]7¬z>\G3¼|L4½—¡M·_–\›müMd? ´Vú3K|@´ihààÉ‘/}Pâž‚ÓÒM4mÈ`ÕÈ¤P …ZÕÂVÏü5U7œªWkJWØõòåN3x½èÜú»‚“?×e>\MÒÎriª•  ý8zŠ²Ë½BÅ[€r·æ/³ó5U;œ¯ùKrÅ~Èôâ+Ô‹eÿkNGþêƒ³6Udâ"ç<°†”ÊBJ›ð«Ù¸ÕÁ»¶zÅÎÖ!¼!õ¢)¨[€w½ãœã»Z¿Õ[é^\ ,è.tQ™ûé]«`ÑE|È¸ó—zÓRøŽ›Zßñc§ñÔh¨`Iò0Ž6|`Wù¨—'òj^ëBÐø‹
ãt&Â8þÙMexYw}Ñ™ô1:´©‰õ k`2>WÄV­¢"I1zÀœØzEs§|ý¹q^4"£òU—ÒóµÖ—r¾~	î“—²:£y0; ÿäAÅt—Æã‰„Üü˜ðMDÃM0SWChŒrCâùÙ­+¨"*“X9Ä'-F,“VÝ#ëéë§Ç1™º@Õ¹¼Òe÷ô°ûc÷ð]ë˜´ÏNÎÕãP‚õhwzýîQ·Ýêw(ºr§§Æ÷(Ÿù0Å2Qõã¹õã!€>vþ¼@zåò>êGÁ8`<ó»åÁH¦Í·ûƒàhìO:ŸŠrS¬ŒóQÊÅdvkfÔ: ‡Á·Ø&.|Ç7ÂØ€y˜Ÿ´ãÎ`¸bÉßL–¯)µmë	Ö¯¬Gœ£¸ þzAy’yÉAÄ}çûB­˜ó*Dùÿ\Ð`óÃÄŽ£žšZë Î|ôÊA…K³F:kÜ9…oY!:6Èf“aw›’Ý”N(è<ö¤Z¶¡E@¤“²öêL$çÞe¢ø‰å\¥‚A†©d@AwJÏÃÍf~H‰œ‹çÿ\Q,›Â˜y©5šþ-D’‚:)¨¹¾tp.Ï^›ANü¹ç@G|ˆŽû.&½¨°…Þæ„Uü]“û©\mö”ý¦¾¼ŒÚ•·öª=ö&3ŒÝ3ZBa"‚0ÑÏ€è»fSr`«C <ÿ—›h:ŒˆàüléaÏÒ]Ž:„„7»ö£üõîÔ=Í‘Ý¤Kõ>…X	eÀÔ‡_ÙLØ®½ú¡÷9‘#¸Ñ© 6Îò+u¶<ÕÌR¸²ÃÎšÖÒZ)YÀêhN(,î€v·äøDÌÔJG'V1@7°ÒÑåãLc¬(4¶ÌsÞ‚¢;½Š$fš§Om(œžsi%+“šúXAKôëâÛÔ;_É|¯‡­ß~·Ö#µöÛîñáÖjÀy¼wá(”»Â-ÿÿ“¡€­‘Jöq±ð¤‹?I”2#¬r©¼éyNVà
Åð˜"ÖãM‡zÚë¶ÉiTa ¶áƒ•Ž'“¨[a@eá
Ç™“^?Ýj­ßKk	«ÙÞ0Ep^ÕtôüYì£’?\xêâXÊæWE"|ñK?¼ÆÝyó®Õ;ì¶NIûìô¨Û;iõ»g§¿¿üIç{Adåïô3=PŸ®R¥G±ôpcî®NDõhVWÆápÍ5¬‡»ü¨•ŽmsÐ®Éé5†À=Ü”Ÿ£©¸ö×¡Þ}ùž³‹ÕñÍ0¬Ì:'¬ïÖpÒ6y¸)¡q˜’%Kï€üåÆ	P2¯a¸¸žL¼¸ëO›m
0<™ùe‘½„¨^{•y_zãNë¢C.Þœ´zÿÔ‰ae>Nw“úÜp¤1GFföÂ­Qz?öcÿò–}…ò@ŸiýÑÏrÎ`—	MûÀø¡É-Çj™‹B@>‹¯ÏÕj@7á~àÄ8ÀÂèIrÎÅ1¾Mà’8H~AT’¾ÑŸRpþe†àÉ›ÄÿäOfOH®J4ñ¦ÞÈ§bÞ ¯<Êà¼é-,éˆâÍ0“Vàs¼h^Ž¾.óK¦öx<¹¨E:Áuf 4×øù*@ð^)¹À/éK;*¨MÞÞmN±›aÓ-l šÍžã*T),Hñê«HBÅÕ*£ÒG$ÃÀE§ý®GKtú­î±î°ÃÅ?÷BGf9á§áµ´ÇCfƒqÚ‚ºç©(]åº3ª¶·Cê¥úƒïªj;È8$¸#L10‹´Ó£ë!éÑ|ÂÕÙ òÈ²)WM7êRØÊwÐš $ƒbªu¥fÀ®7&´fŠ²Œ…ø>é¦€:wë;{vãuÁ3¬ñÊ¹Q“úPðÁd¤OOâÁË
Ï1 :yáüåš…IÛ¥¤ùf^sÉ•NÿŒ.ÿàMt3”åñÒÄP™â‡«šx9hN›ì`{K¼5ÅŠ)ã–=|~Æè¢•ùÿ5‘œáÔ<{G¥žF½$ÃhpMuZgye£¸¶ÞÐûóÖ7¾ržúñÛþÉ±[%G"°sùaœfî#¸"µÜX741â<S´¦—¹Õõu)ìTO‡Ï€[t=ì¯‘Ž™—×>h™ðÅx>	w.)°*eáÊ~Ñ:Ñ[•¸ÍÝn~5ÇþÕË5Å;NÿN†~|„®üùÖt6ÙBNè Iþ×Nc§±ýØ%™§ß7&0;ðãö«ùmè'cß7'ý¼Ø²ÍÂ‹,˜Æ1¿ó¬þs…+Q\~G*.Ï9³àÞ•v"B’ŠLO†v§·5éë»/YÅí fsÛcLÃÈ_\]Oi6wMOê¥›éÀkù‰?ï?ºž×äçˆ~‚WÃŽMŠ®=´ÕÜ 6	ë¼Ø2¿XUŸ§œâ½”mU]þÎäRBÚËÔÿæÞbñ“º@öÆ¾Cd;ñsH¦¨ @oRªèŠÐ«#ÁqhÒ£„•&|Á $÷PXQÔî°Õo½F³KççÇg=]È+·‹^þ9*Ùíÿy\¿ÈJv‡èÊ¢ù»ºT-»ô];ŸfaÓŽÁÕ™‚ÊoLj5%ÐýžA‹d .!ÀjñÖYä›18¯»3z2nüâß&µ‰‡*FÔîº'ÞG¿˜; –ñAjø±ÙÜ$—qt“ø›(êf0JfoefÚÔÔÊ ¬X,GtEk^ª/‚!jB’ÀGèäsòS)|+ÎË}±«Û^Ê¨xJÀõeâ†sötgò°,Ú1³(²[(íÖ¹L÷¥öí÷jyCàü©ªšUeSÈU×c²3óùbÒ?…q¤½mómS%øË¸yh¿]í‡ÿsÕ´ÀhJÉ¬…´€¼sÈá¥þQû˜§l¼GÎ#cý¡Îîq“tÛdJ½·›ƒ7¶<.ƒâ¾7A<HÕûT‚” CÜ{)øã#4x°¨´™1 enáJ5•–ŠÅËÏ¾Îý«[|y
©q%±£>Æ«èæ¦„¸S„£,‰ Â‘ ã|÷Sf«wµÿþ/å~¤Kª-½ŽRÔ[¸V¹‘j=aÊÛ4º‰½Y^Æj¤jñü£à}†¬ZÎ5Æ’áG)fÄ\R„™E£å¥¶´¤úðÏAÌ¸fAy¸¬[ðœðý:WéH4:ÊWy¢Ö–‚œxÔø½®Tæ¯†2’po0XôN”*†{Õ}meTŠ¸ˆ³HÑ;gq³è'vò]A}\¾sep³œTÖI[eÜÊ´•¯÷
w¯„Â\¨kQÊZŒª (UuQ´î‹ÉÊÝª FèASæ
çgYå2=2¼úŒ÷ŽñŸœäDõÊŽwûb¼k»uªÌ%ãá
Žþ¸ñ®öÑ•¸˜¥c2LßDo‘åà¹—:¢0^bJ ºØŒ™Ç•Ì0"'Õ±”/G©LXRtuE·vú*’®•“W‚¥8‰T«wkŽHÙF!#¨„£RÛrmnv¥`¨ò_Z¯.ŽF»XuY{¨÷g”,¢x4/ï÷[ß6ó	—Â#ƒ^céÀüY£hg’TFÖ3MQ‡3¯cIchÝ5’4Šš—2øô,V‘PØ¯öÈD1¦ï‹œ=¦}KªvÑfh5b™ÊLätm³ƒ	6Ž€í¨y4d‚FFˆ›îixÃßSîçŒq!h^ŒW~ûñyêùíËµiT_YQj\ÐhÅàü`pâ‹‚ÙX0˜?Í\ÁâäÓ(“`
ÂÔ}\¨Õh@Ÿž¹žR·²ÿˆrI]:¡NgÈ‰Qœ¬½J—ÒV¾ÑqÛ˜c}·­Sí³è9¦ÚSQ4Èr4Ò$)#Š»óXhÁNšM¡OŠ6^-Æ¸ŠQ©àeÐ‰Á&ÊBÖ‡g¯/Øq¸Ã¨<ZÌ­|ãcÌ«[#Ú¶Ôù…-hû–’¦Æ!
ãÖ“Fá:)”…s• ­m37-Ý
Jv®ÏNÁœÙþkŸà;85\ñäÐGõ‰ŸºCª	Ó>¬2ÜÝ=c§F£åE¾€‡dÇ£ëÙZ¶^’;Òh4ò‡"[p»†tªDOïé,ýìr#àNrìGÌÒ^ã½9áC&>FŒ(V» ºË	
¿×îa'Dh)¤Ý©¹0¹ü$¡±ÙVNð^Aj`Ç/¾mæðûÐèU¶­g¸}…¼h®ºÀ¦¶ê
n|lT]­x_eê·ÐCÕp‚	Íû?œdå“ïM~¸’¹·j]vÑqñœ—ŽŠëÚ™t1FÊKúãüªb<z¥ËI¿`Cš•
'¦Vei­	¯çLY–Í¾¸†)t©7­ì²J´ñ#D1”CJ*­ÖwaÈ9³¦`HG¶_0“
&5¡ã³¹¨Y%¼E35ÚÜø—Ü[¯'ÂÉìM‡—Ñ'‘Û$°qÇÁøšÞà–Ìð4ø…šâËÄõßvN:ä¢OSmÕ±Fý±?ñEœÑC„íI¡EÍ*¡ErÉL[˜Ñqç¨OÎ[§ãrÑ9î´jÁÅ³ÌŒåÂ¹k6ëí©W:IñžšÒ§XÃV§s
tå’j¨%>n·\.­­Â9÷@pÎU!FR´Œ °Ùu˜øZS…*žÉaq,<ÊSärì<˜¤£øNš(möU5×ìEŽ›µ@¥x9‡”ã7!Yˆ^®Š^êUSƒ°ÙÔm“ºã±6ÎÌÁ&RÈìÕP+î#ÑÔƒß|¶CH‰¦³(ž{a¼0¸ŒÑ5¼…Ÿ‚ñ¶óø°¸É&™a¤Þ|AÐK2&ò–ECabê øŽ2(lGtàaS?ƒÓVÙùM‘O¥ïiv)È8ÜQ¶øÓj·;§ýeiG|ÙÑ!€)<9n%k%~ÔŸË5O…çöasë î¥ G­ ¡öÆü-ºx‰1&NéPrJÇÕ‰Å»÷Oo3†dcç­oj›!µBÃkH£{Ó‘¡ýÐOÐ¾³Èç ^ü¶yŠ@Ï,hÅ$4›&cGWÞu8=‚ÞþrD/Ckf†= ï³¶pÛávgçð9ýóyû[8_¯ÿ¬éá^×µe'ÁpŠá-ö<á-I+ö§žÃúƒ1jL8uh?ŸgÆ:;ïŽšôÏVóÙÞÌØ & íÖfÉÑu|kŸ®×ô„Æoù† Ëéô€"€%F?Óôu¿=üö!	î7ßaêþzã¹Â²£Þxñv›JT8ŸLœÈëI@Ëo»N\ëè»£}Ç‰ãmñ¶½ÎQç›¸Î·‡Í–~â”ßÿÌüºæJî¶
 Ô§;7ºt+˜d1%·„öˆ5çÑál²%¢™„nâ¯Gmœ$¸1ZÃãc¶Ü}`±tX¶vVßU¨i’j–ó›O'UÊÂÏé‰6w:#F£«„WŒ’cÚ=†¼Á±‰þ7’LŸ“¡¥F<+x‡§ÒÏ›©¥9ï{A'.üêßéëÇ/ä4W«ô‘ÀR§ŸK±ô˜C\pƒ Ò³¸X”o"t¯¦V÷<ˆ	ÆÇƒMvŸŒÌœ[ÊºpKÁ“¾ƒQ¦„	êõÚo®š¹ûòîNR )p˜ÕÛ½Œ»Ûö³Âú¼\è¡2NlzD™³„w(MÄôÒºÍ–ÆJA—CÄÎyÝjÿð¦wöîô´ÏŽÏz¤ýî¢vÒýW§lH¡Ýj1ðfóLJäLƒë¨qq=]öœÑG˜Æø:;èõ#Sº‘îÀ¡ø
Wçœ;åîÛã`–(—CÃöt· ‘Î‹Y„sŽQk?¡Aà)©f*½Ÿª2}ªÊäz`z‡C?¡FÔŽ}o’»ÿÙÑNçµËý]PÜO@ýÌÝ½÷?w¹û"‚ÝúvVùöÎÑÑ·G{N·Óm‘\`˜ÜÃöÎö³í–Km/¾}àuÄë¡³³³ƒ`ÒÅ@6Ë«cØîuVÊJzTÖ‡ALËºRÞ/¤ö·JÞ¢²eM1—D…YiÈo’¦ªTönù´«|2¨”g?Êù“Í¥~ÔŠZÞ‘ª41ælˆ+V«ŠÐ]Ï1ýwIm o‹ZÀ„5£_j‰½W#ÈT†ÐQ“sàxK–ÔEßmH|D²£uö*Hv%ïå#‚öU1®¹ä(­ÐwSÿÖï;ÛÉO)zy
|˜ÅHØ£Dõæî\n–Æ˜¾6‘Ž],Žª¾h+žU—“ä,Ur]^":$×±K•Ï%|¢ì¤„UFÿsó“ëú•.)s‘%D³Þë·>¡itz½I¯`+MGeßŸt‡5¢­pºbø‹ú3[‚»5*ŸüØ"),¡ªÃAapÈÓ’1Y]_ÎpaÕ÷€·þyö®O.ú½wíþ»^§’¾¿WQß§ÞZþÀóV»{úÆ õtÞÂå“K‚VñÜ€'‡;K?=ˆ-é‚{™É¼ôºä—¥¼vÕ¯¬Ñ1—*smýf.2UÒ-¨s<Ÿ²¼jFC˜JS"PwëÔ¨Ü…òKQuŽ¿Ø“ö&—ÄYrøWAŽRºŽ®ò§Ðf±Òˆñç©gé&÷-°¦l+§ÏÖoÅn¬€aEÞ`þ%2ƒxµ'v¨Î},5 5Çè$>C¼Fã:D`!mèk38¿éƒŒaÓ6Ì›ûOÝÃþÛ?ÜÖÎÃ…–ßÙƒßpcÿ†œ€rZúƒlí»´µÿ„.µuŒVzñ°‚8ÛyÄâŒ¾fé›=I3“4{®ÜÛùÜ-(Ä¾3	±íï@€’7@á¿ÏNÎ)Ÿ–¬Ä¾?ýòh_z·'ê¯Lý?¥³÷ ô¿ßDúYùëà*¼¾@¹Ï^ë‰ì+“ýNÜƒP|³ù?Ig82b4.«¨:}­Vj‹Ød^¦®Ã’-«¶†ž)—ˆ$WÂ¢2Tf1ÛÏ›*äfÁ±Zµ1ÓÐÿö)_)%×+ÙLÏªõjÍ0+'Õ¦½)–OM€–zÝ7oÓ|‘îÉI§wÑý±CÎ{»ŸÈa§ýƒ5{„ã_¸&‘pÑ¥8’`=óBj‰5AÄBh&Ã¸f©“ÚÛ(Ÿkb¡mÛüvk¯º“	æm}ôÉ1þsûÿF[]Ûù`‡'Áo)‚etÏbô“(Î®›Gä¡„he*4`DSZøãô±‘ û3¡ÀÓ}Ì$‹}/¬Ïƒ‰ÿU¥ºO'g@=çpîôÈëÖá›Ù"ÝCÒnõj?•²¬
;G‰f/Ÿkõž*Ð?öGZT8§'åÝ]eñ'Ê4þ´¯Ñß—péÅêh”âK¥+„l28Ì&G#¤èÈ¼¨SªÏåì¶æ^:	n¸ÜiÊR)ùaÕøg‡dRÌ¶UR’ŠâY!¾G%VsæáéŸôê êêÍçÏ±JªTŒ‚ëÏ%í6{juo2@†ªR4BŠ¢þÅÐ¡£ï<8S±«ñÉ­kä ]¤@÷aNõ<Š‰ÚÌ¤%xUÛ
µÌ‚Fç_¦´µWo[ÿêžãw?ijgtñ‘
`š‘Täb‚tâeõ5Ñ’NkÎ}âï·9ª7]ÞÉ-­®Ye2]\m"XëvŒ·H£ÄÍþïRz]ãÜÚ˜cñªÿûzD1,FèW‡¢Ó¼XÌº6¾Yïy¸×:‚]¾¾÷Ý/£ê/¥·€+ 4Qé\ LS‡ÍpÚ±Bÿ8Ñ‚fð¿Ç´r¸.³ÿ1™Àu”œ® ©|’üVMÒ¢Ý:¥9öï.–v®È"*®½ú©‡…z÷Ž–ÞML`ø©=ö¿´ƒx¦¼äyˆtž‡ÕÔ=§šë1ž„.þyÑïœöÙÉùÙ©&­T#fš¨È45Ô9§%}t`Ñ‚ #Ô+ÔJ3"Á,c(ÐŒ)©eç¡ræ/žu‘Maç& a+™†-t»uÜ!½Në°{úfáh'%ÆõÞ·gûäc¯UM7ŠQPsG$éˆŠª/ý}·)ïÈÙ®]UÙc¢M(‡(Ç­9ãB±º40ñ*Š',"Ï²x^~Ë¸Z¨=ô.ýÐ*)íÙœ ¦ôß¢Ð^÷˜[ô1ÎìæØaŒó´MÀŽýÃ³)(šßYèÚJ¬`º½³«í©›i/YP ±¢öJ˜™Fc.X ŽòÔ	ŽoQä'u7%ÿHúÒKhw÷ãh¤‘zï»›â«ÿ¡md€ï9:;ëc°N¿…•Ã$–|qÅ€’ä©3ã!á=s€DÂü±]É¯¼Â[.,I-µ&LŒoÑìöod§¹óŒœü³ÞÿáÄÿ›ÒÏ 1.nÜÕ¤…Ç˜ìûd_°Ln²I†Áèâ~ŸnÄö=ñæq0µØ=õÅ ‚y»i–B;a5väD‘šà#¾HÓK+ÅO¯@ Lçs	<CRÛ_l±Åx%/]û¬Õ~K:‡Ý>9ïuaŸSÂ/µ±°|gÌ9Ø—Â´³(S‹ó8a—Ê5Ýâ\M7,ç–zÎÊÖp\êôW¬'î\qLa«) )õ5¤(BiKƒ-§#r­`Å=DEÒÕú‰ÜÑ†2wÎLN·P\q/—¹£Fš&]’bšÿ¡˜cÅÌËMÉ_Y	·ˆç%t£²fa…ÃO&E;J?)öÍë¨/ê3ÉËZK ÈòÊÏtmõžžÉ%š¿‘®Q²“ZÛ›N#Ø¶àhBÓU†&½Œ)X²&Å³b®Ž¶¼~ûC‚Õº‡j%ŠBuv=E9K	Ôû”?îb„‘£#ºñiÕZ|îgâà”š«šá`xìã^^$7)¥i—cñµà*¨E+}ì+ƒèè«XìÈ²0Øäiaæ|ŒÃ>¥ãÜW&,/íÈ²2´ÍÓÒ8.Mgâ!i‡p H\×ÆÇ›Ê«Cû²¬mó‡]Ç³ïsóZ°nà}È_I*«ŒKg±Ý?ã4Þ±Ùx³?àŠ:†NKÌäÜÑÉ‡S4j“å:^Ÿá¨ søŒÎfÁŽž?gÉÅ4™­¯¼Júc†CÍYîº6l‰ÀX¡í«œ†Õ˜ÇÁ¤†uáÈW¹^ùƒ hþ£º®[¾>d“`Ì`’ò$Hbÿ×ë e!›ÇQ¬«€À*y)k*¾+U¦PöÙh4è›ù‰œä}¦íÿ| …_Ëz‘ÛëàNØ‰j	twh%ÕÚèî˜á/ÝB÷|i=‘Ì¯€f‡ºè&u@·¥*Ìø"ËƒÈ“ŽòFÕR*ˆ`Ý6›t·‚f¡ºC¦av¨èì‚¬ëw˜dçCYáÓ­½ú^SŠfu—RÅJ¾Z#ÝX5Ø±QÊ-„¶ea¹8¨“1ÃÝ^ÝëuzŽƒÙ³‡ÕÊ|¿`øÄTÅ>ÿíK´„.Goƒ ë{C§º	OS“ÅôÁl¥ez_ÊZÊª›XÌ¥ùºÑ•M ´à_Uh‰0Û°Èh u¡LI´\ˆ j…P¤U©Éßãàz„â`	cOÌH	»ÑÛázùFÀSÎï³8§½n›Û{Vf˜ævƒ'Ë´ÚÌÆÐe¦×|îïå=ñÃÐ*ò*,-Þ Ú“Z<-ŒãÂ`MŸl‘e]|y°ën"=-’ã"õüDãh@sœ–['©GãRIížVËqµL¿£‡ò£?½öIíMD¾!=V©>˜’N6Ü—oJ…fqÅCŒ«'=-ãÒ½ö`
–—‚ØU
ŠFO‹SeqZƒ¼é|UB½L¼?ëJñvO‹å¸X?ÜFñõ( Â‡zÆub^¯Ä1V2¿H¼#v¿q™r-%ê¥ünë%;‹4QÌÑŒîë<2»ß£ Ð£ŸNb­ßƒ£#kçÔÉEOhxi»8….N=ŽR˜örZ±—.ôÒEsÛ´ÔU×ÜÕ‹-FšÚÏ£h’xþòÔÎ;r ö\Ë'j¢öÂ÷zM&ÑCzÜÁûýäžëÉHî¹–xr?€Ì"R']rÀ(½8Æ÷&“[ÝL+ÑÚ?ýdíüÅ#oü†)‘èòOlm/&çXr¤røœÂ:áÅ´+³u‚7z4ªž„³þÈ•¾‹™?@EkÆ“†¤…Æì8¥TàÝà½Æ•’Ú}“Éñ_Ø´8:¥Ø5ªm>ýCØJýÁxJÑzi]Ž9î¦‡Õúi_¼†½†ÿ$Q|ËýH¾¯ÖQ¯ÛFÛ »Ó:¬'¬©Á÷Õ:zÓ:éüçIë¢ßýõžÒO¼]¸µ7' ÿ~âù5¼³„¶QeÞ:í·§Ývëø?ÏÎ;½Vÿ¬'ÏãÌƒ7àYý³åŸõc·×Oâk¯Dw©žðc¯òS*Šó
HcG,I°BTÀg\Ì1®‰º‘y½cI&*Ttùì^r;Kx`ÁõK eÿŠü…0ÖËßÉöhøº`’lÌ£‹9VÓ¬mˆ€2
\¹.w!¬_rbÙ,S!ñ<ôi"<ªSÁ”¢¥‰ÐCøÒ‡Éª#_± Ä!LÄ05/ÉÌ‹ÿ(Œ¼y­0I¸C%t–”cÁe
€HOk¼3:C¢ã¤YaJX˜‹‡²'fNÆD}R2T¶âñuÀ´ÝéU¤Þ¼âz@
«JÌB¾\‡€FP)sºá€óCÚV0ˆºyœ±ŠðÜ¤wJl¤¾yÈè@¬¼ºÙ%ç¥´cÁ\úæœ¿rwðïÔ7yòù+½-w*Sßø‹l•KoÌÙê4+"8²•‘¿Õ¬Wà³â_¨›'™™Þ!i–ª›îÿ¦BMb¤= ¦›v@Ó¹(ÄÆ4ØŸ…°gÔ¶Þÿ¯þ[«þ¯fýùÏ[#àºõ|½=åæ …©9ek‹¼£<EFaté…òÁšªç‰Ž×ÿ¤bZÂ˜ó·%à˜aÍÃÍÄ«ú¬œ ›4A)'=_'Ó€ún0ïC‚{¹ÖôÈÉFCêZ_?Úå¥‘¦å½æÔèÅ–EÂÝ‰‘‡ŒLû#0ƒ°TÁ²ˆ%› (¼WvdK‡k‚À¯Å¸jñ¬n56<‰‘èJ5¢
‹ÙŽ`›¦à	æÅÇ=Š•Ìí²‹ÅŒãeÓ]•û,È7„ƒ­Á>­›c\]º•Ó†êçË¯qäNª {oQ	Ê“ö¿Ú`ø³Þ›Ö)­`Ý:<LCã•Ñð©°5>E¿?E¿þèw ¼Ô†¢$ÛJ\²t(¼‚Øÿ$±ð}ï²ŒX­SRi®ºîN([‡ðÏìêìÇ2>Wy‘²u¡ðÿ0êÚºPÉTe9äriû]"p
‹îæLÕâ]e,[Dem¯42f¡HG§Ü-±ª†²”†¨µ±¯¾ï ½OFšÑÒ!åà2Ýmm7ËÝ—‹g(ö*fbïQåÒGs÷j6§!‡©ó8)ö%A;ö©Í¿IÅ³.GiY9wVƒ‰¬]%•G]§bLA+Paÿk+ÿ:¤ŠZDTß‹A'W e(0*(IÛ[;„ Ú#Á¾È!ÒbÐ£§R'§æh#¹>5-è9p„êÇ/×ø°ãL4ˆC$¹¼¥yÌ›3Y6ISÃ±ts^B»Ì„Íß¯ýøVWáGåÛ»PuàZ`|Þ>DëÛM8ÿÈkâæõ“f÷ ·œ[Ïš -Ý‘¹j3j¿EÅ˜ëí»Í"ß0mzgá:Q¹g Ëu>.Ës\ªeîˆ¶j×¦“q¯£äw>fŠcKÝßPJv f(Jß¿_{ap0›­¥ö¥3l|QžÁÏðæõ[ñGzŒ@wºf”w5½{‡]Ì8ã}„#=&‰eÌÔì­²ôQ«‘‡f@Sß9;'ÜéhÔØ9¨nâ´=#HZ!ÙÞv§XuV6r%ÑÄ_ÚÄÅ‡o	óÄäÆ±ÁÝ „7L7[úU
K‹Ï+?C¿ÂœhzqjáÔ)íÇÅ—XxdòÝ7‚)ìC?©ýŠ~*‡~è’-ÑÒiC¸bXÊöYß±“B\ÆiÒ—L'p_¨á^mÓgRƒ_¡?ñ€Z×_n,æÅ,Ëòï”zu^%Ñ	$qFJUâŠ§&br]ÇœfæAêÅ*»ëu¯Ÿj.Ã°%æ›(ŠŒÃ¼"MJp†–þGÔY¸(Mxï®úö²4Þ$£MÁ&*qXÛæE*/ü+ê‘1v›ã–±ð !³Ò‰­®§¸Ì'Ìâå€T¼(×)Á&{ÅEÕUýêÖÞÿl‘¼ìº'>ì#+z¦‰.'ÞLvæm¸ÎÚFañ/^Eœä@m5fVªè¨±WZë2æ/=–Øâîƒ8“ª9TÍb©¹¦«¸”B¨`a("Ù¯K¦„‚9Ï\É¯û÷öÉÀã»j` ôX•—Bé,ü‘­\íô`•í¦Àú<r´†8#.Ò¤öõ]ŒßohëÎfc4—'Ni”ðù]Ã¦cM”ìPDË•øÃàÚ¾»î^ìÕµd#Ý®–Ð\£ˆ]†òË¬+%îN"_*¤ý¾âæl“—Žš´ûHÈ/þíË;1 ;cUÝ5Ú7Å©¨ê~iß½°hŽÿGÒ)~1%_½ÌN™n;WÅÕ}tïþ½™Èm£Ç‹êp—v´¡‰i/6s|g—=Ý¥Q~?ÌªÒ"h3jÓtÔ	óžúBÅt§’Èlë8Óù*è©1}±Ÿê¶YlüeÝµwØ…öù½¦¢_Éâoß¢MÑ³ËEôÛ+}©#¯zC’`á‡U‘ð’–¾¢rä2ÝÎZ^wÒXtúPZ
­¢N„—£^D›:·T‚"h€sêÚ«;ÙÐs_aDåç=^¥ÃDÓˆ?‹îlUÞÜµ©{ÃêÕ=:ÐgSñH±õë§[­õJ³ boZ»H«/ÉIŽ¯¡S?KU×%Ê›ð5EœÍé•¬LÙÅƒˆÌ\ ±·¹*±ÄÉáÒ|rrÁÔ19«æI×Ã—E)º7ž?^h«¿:¾ß¨i:­ZR[NÑå@‰¦àmz¤ÔëíìÀ“@¡Ïý4¦®ß7V½47˜:Å‡ÓaeÔæ¶|EÏlü¸4…½FÕÐxšªè	Õ÷‹Oi0Á^1h1ÛuŽÂñžVÚ;W×’^Š"A×
Ufc|èÏá,¬Ž§Au{ÚW,þ”>Ý¥ûÊ-ÿ?Â1šzmê‰ÅÎ¡õ³låÉ%ŠPŽ+h—Sêª¯Ú}y&’àÄ¦l©ÆliŸg&Tq+ŸE6ÓlšJ9o+Ÿ#‘´EiÖœ\>|ûýžüpòÏ+œÉ£\˜YOVN_ LœHsË¦ò2ÅY«“ìF	3BÄ°ùú}6ÓF}à°) Æêf_B˜àž1÷cî<0Í9SV€ÕVÎã¹lHNhKÎ‘>æKÌ_Îo;Çè+E®=šFð`àÚJÖìj%I0š5@Í(ëƒDŸ/ Ï“M„7àž!Ãhp#†»–D"1ô\[mŒåºÀ¢|vÀíH´2<e£š({[ÛDÙÝâ'ÊîVŒs¢žÏ‡D;Q>ñA0Oø“´È'âw}€¦î'U™zò_ì¸þÊõ°Îû‚­Ì¥Y!°Èà0{Äl•qÓlÚô–?¬WHœ“žKµ7|˜+¼v]BÖwq/»z‰¹w–ˆ'“‚muS`²à ×ÓŠ´C”çÔ¬b˜\³ñÑ¬È©H—†tßÄÞ,³Ð³ûí&5ãÂg†øoIâ ”`Q],ÖÐHUÜ|8jAÌæhP-v˜	{;eÿp$+JN±é‡6¼ì•²›¦Ýb,ª„KTdç`›AÞ%}uMG’L«!g³±ÿ÷™çÙÁTo[/ýüÙÏE©»YlO'£§“ÑÓÉèédôøNFÖû7ÈÁj²~Ýó|­èg2YþþUýÈŸª®ŸÉ³þ»,’\ÝoÉebÕüK„ž–§Òò8›+­Ï—YnîÑ-Pµ¢s\ô•{t‹U¹øœÃz}qåçÝª-_„ŽüÉÊÐ=º%t+FçÀm_P9ºÇ¹HŠÒ9.×U–îÑ-ÚÅéÈŸ½<]ÙN²PÉ®R7‹í*ÛÔ+ÛUêgñÂ]fSË#£ÿÊÕéèÿOS°î‰þ¿ú_¤€Žþ4%ìŽŒÅ‹Ø•:[¢ŒÝŠô*”³s±{|‰íÝšU.k§“ŠÂv«ux®ÎÙ¹BGç
œíàü¼ÎÍÏãØ\@Ü»VÀ+x1s¤Jx-?fa×VÄSÁ+±iN¬|u4˜¶~ž€å¾Ì•ûÈpôµˆ +®™·µa†¥9ù=}yrq`ª ¦a ˜Ñð¥sšoSÕÅ±úz):pG¨+xÈYÌõ_òô ñ8Èð]ö²›·ö›âþi4¯{Ø»?Tõ¡ÂYQŠ”óÇŽ•aÜÃÁ•oõ=ù€%4¾®5üAÙÌTŽC‘ø¦ãU˜ÆBerNý3üþ•¬‘’+ 	iÜ¡°³,^@èu«ß~KÎ{ÝÓ>ù†tþq~Öëü§u¬.#t›Î¼†pp&Tf2„]DÀ§8Ì¿sM!2Ã0Ló‡(0´/ÚYe!6™Ë–*ºÌÅf¾–ëL,¥nG‘bÑYŸ”HRÅ»oYŒÿHÜ+¡tåW‰~»ë@?i‡:’‹´²œÑJ*ª+
3…r,¶ïž5Í`z·k¯èx‘W?Í¢xNº‡„²"µÓÒ´ërñ$:™5ÁVX=ŽrV†…ƒ–MõrÀ¾4¸Æ1ãä'XóÁg£q=öiE”¨Á”ÂÕ£Ê~~ú&i¼Øš-®rWVfËâi©ºOtþsšiº1nSª½»<	B¡øæs‹–ÐrÃ(Y®<7¯£á­S¹¨ú¶"åFL">x¾bD8: Ç°³â>ú¬ÄyE5ÆsŒÈçÞÔhé˜8
Ëg(•Ð ²yS¿KkTd(r"6Tg¯-ú"ÂP-oü‹"^-SÆ»æ¤2½QIVG4)„t¦H&ó{Wõ0•–	ÓÉË·\zå½Äüþú¬„²ŽÖTÂ#/^ø˜ZóqèÏ-6²jEvˆC™S‘—/?d]¡Ôüªù5WmGßˆ[ ©Àeã×gû¨L‚çÙ®Up
U~NiŸî!­âÓæU|ô®bX”Šaý9ÖÌÙe¦ÅÒîC,šñèª Y ¶4C9Ó=–¡ƒêù3Ø`Q›:–5Ó%S{Oì½Jý¥óü­QyI¦šO«%GÃ¤‚TG¬p|Å„ÔîZqìÝ6P®Mý¬óªb ÑôÊMã£x"“ïua™RÜf]ò1 =Ìk´%61'|Š7¦	ŸØü^ýðŠýg±./ÏÁ«aÁCÐØy£?tÙùŠa®–-y§r&¿ûgNþ–îüéü70þÙgàQÓ£$>½ä$îÎªüŽ”[ÅçWé_ŸŸg;Ÿ@XPnhc´!PIjxöÎÿDÑ'†çtâºÃ¤‘¿ùæ"vCƒ¦Þs»ßl–Mâ‡œÅ•½Q‚Rà{M[I9Íbqv<¨O¼)ŽÃ["šYêÎéM«ì*„;Åç§ÄjJ'—¦7CVÎÂøò»Í¦„\­éJ÷&„Ñ…î=™âú„C•éZ
ÔÊ¬'h+Q.MFBtV”“½ôÄ©‹ZŒ^<ÝvF)çÍ6þ0=**±÷î„´ã‚mf®
h®u“¢¬{X™¸é3ô»B;×:z…Gµ¡ð!‘‹OâÍ+?Œ¹x5>ö°us¡‹¬$_®×B|||³" ‹ãA›`hnQãÓž.€¡(ž©Œše°¦’w÷é¦«ÛŽ4lÿYŠ‹„Ô\÷èv€z-5¨Å~“Ìæ ˆ
X)†Há$æ”Õ¦"µ]I[Ä
IyNÇ^RCjßXPX<É£'y$n^±<²è /¾Õ
Ñû5'[uE£ŽèXÃ)1×˜¦ô’<1ê£>*FÕýÂŠ&çÈ×¹4.¬ÇhäÇ'É¨†°ÐÝC~VýQ´%:ÿÁtÔXß$ë~Gñºá-Ù»h_CóýM0F7ú(ÝÂj
t)9RÔL"$˜ßÖŸK!3™ö2»enËO’Î4<˜a’sV¯cêk®ï4›ÅŠ]Vw<¬§#mÅ+jÔ¥ßq#Ôcïz:“‹Û†Ë“œÇÓ'ùû$Ÿäoù91#oØ
Cq QE¡\Mªe±ArÈŸ RMÀ8e˜c%¬ñàŒñÙba¦XŠ%CèØÁÊé™Aˆ]Í½’yPòQFù]º´G?ÌÎ,/Õö›Ùwå ê
¶`ãê;6‹Oã‘o]¶à~]–%ÎžÉÅXòðÀ¡½&V@Í1–Öz9pkÙgi·/Ë3øÆŸb¼u¸G°zTÒh4¬°ÒZÛ×Ú«;!ýÏãh&÷d‹¤_ö£¹Zpy+á&çYIÌ4ýnL—¦”k©Eåˆ2šêÓ¼àmÊwÈïmï7!4„$óÛÐywÊþp>>À‚5µâôÁìå&oƒü•l7›÷ÿóƒ©>¯>Zi(Çjž•¶—lH?˜9»Whï¾*¸w{¿ä^á„¿„ú”{ë†Qåù ÎÔ£6˜Ì6\fÂTCUëì§a@ãbÕÕ^µbMœ]Š“w ”hŠ@Zøú:Î	`ÐUæÚÎOÏÖsóE¼êLQÊ¿Ïãh:zµö”Š]
2Š½Ù8$kÀÌìW4³ˆáË¬Ù 
£³Q‡ˆçkŸØÇV<ïìè(ëý2Žn˜¡t0,@žõ}E3î
ƒñ>FÁL¼x"y‰oyx{E‰ôº˜™‚¹´ç‡GùžÑd†•öÛy`4¼7<‘W5$AÏ…mð}6)t"QÀÚ&`ìÐI£ë9ÁØZ,¡5 Nb ŒÑ4I·ƒS{=™&ÙÀZ -iŒv2’§7ý¬¿ØºV«˜¢²ß"Ç÷°®Ù½ÄQÒ×ƒøO‚Qêç±ÿ1ðoyy1ßCw”Á·rRŠƒ|Ø±ÉFZ¹f„ÚK!îÕEïÒWy<Æ™SÔö¦=“Fc*0ÀÖ^½Å`@9&,mò4 ™ À¤ Bé¢•ï®ç¬=}¦£ÑBÇ¢…Dê8¤Ò,ŒÇ ÂH™,«eõ<÷ZSxÒt°íÝ^/iàyé1ô’qZ†¾¹¡Û
ß%¥-]d(åwÓÝ&™|¢IúL9ÿF$Ag¾ÙÓˆ¦Ý`l`xÖ!&	mgÌ§N¨Ñ<«°¶†8›¬'ÌœC½£½y¯3/†ösº¥^‚ôÐõ¯ÑÕù Î9$<“n3éfé
æ?çÓÓBøÞ)­åÚjäo¼ž¢`žŒ©âZÖëŒ µ™Ñ3 ¦-HDˆ
ÌŸÁ’©,ëçÒÑ±€ÿµQO?Š€„3âÀŠ•&Çëä*ðÃ!V!ùó.5ôÑojY*°¡KçÐçHÆ‹à7ÿü<£†Ñ3dýS²N`tÉ„þw	ëDÿGô¿O!ýo‡ÿJâú&úWÞu8ÿÑ4fP¾6Äæ9c: = Òç»o“ßÿ
FfºŸÐÃ°ŸÏ>­ošÂ+AC<ØÚZÒ·Æ¶»ö¶01ØrßÞæ
[~go¹ÃšîìØ›îò¦Ï ©¡å½ËÃ*¼G"øÉ3[S_þMWÈRÚŽ]6«aÙfLy¯£ºMkxÕ¿¾C&TáGÈ—ŒÐ!rÛÈˆòŸÎ¬„&Ý¯ï$!ð=Y¶YPx8/úõçû$ñæx‹_ßo®#Î³%³Ÿßo7šÛ?¯›G§·•áÅl=p¸È¿Y ¹£Ð„}¦V•¦—Á`êå¨~Â¶´õ¬™;ö‰7n²Ùªç}ÛÛM—„ðl‚ù}–òcAØâÊœ½¾E¦g—ßHæÑìT3oÄðÿŒ› ¸˜xºž½9ÝDŒwigpê7õŒ¶Ì»xvñ§7†>ftÚ¶Ÿìº'>¨â‡žàÐF*ÏŸæðƒ!V\yS'Mž+åaÁ¦ŠÆ@ ]%½Ìu$…~¤ñÎçÅËÆ Ô§"I¦í±?ø¥ÄƒÐWøy„¡5¢ Ð ¥^ôc8¢íh›b;ljŸržƒ‘—“Ý)·‚L	õ!QÁÈ0»µÄÚËtóg8Tµ3åÍH³ÒÄ'¢%p$rÌÌ€UÅ(¦¿³z‘pžÚc‰ðE0˜¡¼ÿËöÎÎövûg„yÿ—fk{w»ùs.Y‚ô·ÍfIëñNÒ,´w‹Â–&%Ó!ÝqR^ÞÅ']n^ì¤ê´Ñ-h@Íiø+$›ùn2cwwªóùp‡µ¯5C¿ß@¿Þ?³ÈØØö;ÿ$øüé°>­(˜…·†¼ué9Ö6ÖÚ“66Ñ$ñÃP;
õ¢)AEË,Cu²;—ˆ“ùîÁWL×„b§-ÚÂuoÆm‘Þ «ÉáÆÔÿ`9çf—ƒ®)_tÊPµ\cÏYËiŠãúwEžæ,M+|~<ö|?`5?qV5pmª‹½*õ9°·EèÄÀ[+’Ì½xÎB@ˆ.ÞqŒÎƒ\Ïép¹~£æ:–Ãªô½^ BÓF¾îó3Í”Í I˜´L&UêÃ½‹L`—ÚÇÀ‘ò¸22’Pæ ÀYÙæñõt R^kWüØ}@¨ªÕ ËüÌÇµõ‹~ëè¨¾ÎÍ+©½€N;ý~ú½Ù3/Nüît^Ëã9‰'l’u<mnl’íæù²{?ûô¶e·{¨ƒñ€/?ý@í¹¢×:ÛW²(žºÖ–/W–5.ä¯•i®e±„Öœ‡JøY$­±hQ~Uà„©¶É6[1j|rÝ
tÆfãh=ü”ÑÇäÅ8Uëi•ìT,< ^½ˆ^H€r¡ì*?+ÉÄ2ˆ¶¿+zàÐ¤8xYé
iÔÞ`:EO®óx¹[I7Wð)í5´¸´Ww)ôXD
å‡ç?|Š•ýVÂyÜ~Z	×±¬{ö±ÓIÎÒ‡á¸<º™FÑYs$’ÓH$…„Â„@g“4ò”!f)ô‹^@ÍáŽŠAª¨Õ”/ý(8½TÏ1ø”'Ž1_Õ8&ç˜·€ÿeØsÕ™À¢{MÏ4pŒ'M0â-x<°;tæê®^ä,Ãh
ª­Ëû,ÁqéK=±ùªÆvÅãr0¥û+þb†¦Ù$šFx|ßfx®ÍÏUB8X=›îµŽv¿l+\ŸNü¹7ôæÞÃ³©+GTäN™?ÅËäŽ¾ºSœé4¡êØ¥@Ð×¥&¶T;@Jàn UGÔÁ˜CÂ»h0ªôÐ”C*ÝE$†ª`TBÏGfUÚn¢Yi³ê“mZd¥îü„ÙUeý1­áÒªò„ªf°J'K'‰"dÊÂû¥Š•Ûe!p'õ’²ØéçÔI¦çIm©Õõ´ßV Ú¾¸?KUÙÞ?+å¶¡R¯;K¹hmoî¢ø¶*¡ëì\Oä³êörgÕ
6ìlÓ«l¾®Ä·gõÞø>¸âµû|Ë5¢Ãÿ³,ÖO>J¡/ƒÑnè»´qL–å;<{ý¸íÿ  ÿÿì]ÝrÜFv¾ÏS´—9Zs†’¼f‘rÑ$åå®H*$í]Çq,p¦93˜0i.Ÿ UÙË¤r³¹IU®’Û<O^ û9§€ÐÝhÌ`F#™SeKšîsNŸŸïœcÙ®^x5ßmZ;êQ7ì¹»É9(þŸ`óéˆQ3ÙsÕW-:G†ÏˆÂwí´NPÇ­%xÝu[ß=Iˆ©vjªûV+ë	¯ºéµ5ö'º¯<„6·O©®I†þ¨ý®½ÑÌ6¨XµVÖôf<[ýLm"p¾qð§åyå¾d”SÇ¤q0K˜òªÏ-iLgSC”9UV|ËØËúÌ¿;?€5¸øöëzöª(.þº f»ßÙI±í5íï{wO6jÞ€	öVNjzDÞÎ	K ß»cÉLuìãy]KDpW5(
ŒÿGÓ9Ì>ýTWÿ ì	2¶&C×)C‡~ñtƒ1ƒÖEš÷ª2j_—™“œösÄÎÚiO«4€ûB0¦á¾á³-WÁ>lš¹îì¾AzH'¬Ê÷-yS®¼)¿é0a»%ã´£0z¢IÙ÷O;OË¥e¦x?6Žò†ijMæqìÎ¯Ÿâ^tA«LBÒóû˜ÌÜP1à&wS9Y°cq8Ñ ÃÐÞ"ÆÒY­óú TÆZQªûJH¯Ã+T^Rq¹—±9…½¡Sé¥Z$~ù;÷®©¬_jûìôåwdÿühŸ¼8;gðýýóÃµaªk[T)â­KÓð’ŒÿÖ›éNƒvÜ$´—!üÇ±w+Äïí­¤%GX>è²R·±6BÕ:I±—.þyÛþµ!Cº” ­M‹~dITÅE)ìT)Qz/MafÌÞ•ß•¥?ýÔ2”Lˆ.Œ–º„hÃ ùÄg6(±D‰öLecôcÃ`æ”fëP¥‘œSŸÍÃ>~œÕšÈ<CÚñôÉÆÚÞgbñ´éÄIÄU©ÃÕ	ÃUiÂUÉÁ•)ÁöD`Múo½¤ßrª¯Ñj4¥õÊd^ vžÊkËâ-$]m?“IW¿ž:é*m.S07a [ÖäÜ–€å–uE®"ê½iû£×6/’5îk—¿wës^;KË˜™µlÙXóÌÀÒg]iÂ³˜Œª&²¨¦ÊœrÍÌ_l†T£YQMfB5ýT'ã©Ñ,§ye6å0+INâ3ÓÍY
T&*Õ’IHjà­«“j½vsIE%5“<T#a¨™¢Iz'äÖÆR%5—4?¯Œ3‘W&ôÔ¢ñ&wÀd5‚ÃrÅ^USõ\“oÌeUöÍ“Æ³oæO®•Ù4µÈµ‰¬™\?ØÌ—ù“Ÿ[&Ë|³WjQxcY*™/"Ó$+N¿9'óç§’¹ä8ÁN–2?Ä1'day ur?›ï1sŽGe^‡C¹"Çü«¾Ò ¨¬b[ë4˜-c+×ÃÆ–‚¢ðwœ8 ¬àÏ•<QÇ=µ}ñÅÜ2&\ðïq;êdCT³³þ5R –|õë¤7,%+ÔÍiXòýpÎWXVpMRXçC¢Aýä‚&¼—$‚™*Ö¹n‚@sI&Ôÿ×ÒA— ä¿(`0# ~Úâpi þ4àüY ïÀö`ûJuØ—s6§y£g"¸~áªN¥#\;7LCûuaNùÝaåg××ÝMŠô‡"Þ³øˆl#ñÈÇƒ0‰§Á™§@6ÔÚß·¿€£Äp¬üK´h3pG¢™åŽh¦K¼qTì{+Øà(w|Ý}ßét|Àß¼®¯_±†™?0ð˜¦aÖÔáiÂšAÞ:x:l°lÇW¡‚í˜`;"¸lC—°ÀuÀE°A•Ôc€9˜qëãÎö{{Éù%yÍH>%9)Æ¯@Ï_\»©ƒc'‡ÂÜËâ²&HØ ^.€ðüàÁ:p°®÷"PÀ³c€§@ WZGÿ6ˆýmùÛ,î×õÛ æ÷ñ»8Ä¯™›lª¶AÑÖ«Ùµq¾58}ßßµ
Ý[ãe›Bö6‚ëmÕëŒé­‹~xÞ¦Ð¼&ð<Ù¶Ã[ƒ’gÇïÎØo ¬ïÔ¯¢Ý_jwž„YÖ­A˜³#u?Âü@ñ¹ó$4\î<Q¹5(¹!DîÇCÎ¿<î<9Á;ôíÌ(Ä÷‚¼uÂÝ.uëŽ¹]$âvF¼mÚ¶2~ë„´7ê½†l_|íÇs8TÃ– S»”0ÂˆÚêðî{Ûw,í²À‘´K¼êîÚ¥$ýzÚ%ÞGìì²¾rö=:Ê*ñ²uÑ²ÃÊ¾¤ì8YëêÖÃÈ6…m[[C{|ïÈØÅàbÝQ±`b±ÎxØúhØYÂà`P°(Ø:0°º%Z”ÒRálÖá^µ×|™›‡:­jòþw'G§—äüèàèøÕ%99;Ü©ÂXcÐnB{XÐ÷œv©?NìxÖkÿ¸>ƒ]=upôáäãu „
0$ÉU0‰Gâü!Ê™k¯Gá"kád»CY…×	¬ÂÐ»N=CŒyë&( ¶Æíg”à.mß–ê-—Vï,"¼ò€«ö¶œã•:ÙÒ1«·S
qLÆ·°f×8þÏ(¾Vžë¶™…|pÐ{2·Læˆ_ôÇ¼”Q]]9b™Å7ã ôðÌð-áu&â‚ýDÇÏz>¹š$I¨ñ‡£ƒÀï¾Ù»k±úÈ@®å'¶O5,Y|ÑôåHE;Ù’92ýlkCü$¿x²Ax×CI’ŒaEF±Ÿø0áî$YÔÀïjTçîò ‡'d ÔYVNv×ùŠè¶¼v•tJ£`Ú'pÙeœ–ÎÍé¨.’€—Sÿ~{ƒò&üë)ÿWÊ ·mo’„eþð‡ýò>ÇQwOKLÿ¡¥å»¼ Ù[)½FuTU&GR‘’aƒÃ«ŸàÙ²î»¢g—KúFôšF^…@š×Ûò«âÅëÚýs—EÕ¸Íì†òZzå—À\¦XJ¢#d[PôÅõíO¬ò†½«K[ëÿ¶Þ…ŽýûÎxÔ·³eš
<DqŽJGû‹E(J»k+Ý¡ÝÄ*–	Vv+­ÍŸ‡bÜØTx}ž§w½ðªw¾ì®{—zß•~š·(]×½îêaL§“tî¹@G‡Ç—äòì›óÓ}¦4••¥Aøî¨ç'hÈž„=/˜¯ª´±ìªR…r„Š”Nó!ÕZ“Q._¾Õ‰¶ÁVéüÆÌ›Z*“A0è"Ò»HF "Ç,hØŸÝ¥Ø{‡Ž .Ñø`kæ/l‹ù;¦ÔxDs”Œ‹QHÕžtGÖ¯¯Ö°¥››Z“Sí‹
‡<×?ßx;øÁU;¼+B71§¹˜ý<ÝÙeLJC'Éóƒ7Ã2ÇL.ý$ äW»ëìš‰ø£ñ$Ñ9¿’Û±ØT­oL8é¨ nh®âx£>\Ú¢’¼Ž”›Z´Ö|Ÿ&6¢6¿3·ÓLäˆsF#Ÿ¤¡£œ#ì\a	_‡ÝI¼Næcby“ü+ÙÍñ_i.úÒßóoéh²ˆmfÏ©½Ïì®u£+Û3}òFmVÙiä‚%?bâ™Pl¤"‰¥çMrÁ‡\ð6zÁÛ\Èe™Fëï7%¦¿‡Ý?Ãn¡{œrûÅ/,É¡qNû~?1ŒYJURuŒ©£@ê“Ùƒ”b£í(ë1³`2ôº²N.©7$û“dÀ"J§^€’!U› ä¸øñ˜@ƒ%ª‘•z[K¿²å2g{Ñìó1ºÍ¦8yÑŒÔn_jy:8Œ¼Q—NF¤Ë
yñí¨KZÚV‹øA¬Ò#Õ†’*ÿô'ò(§të~@y§û^ ºŸ$‹ˆßL(øµß§ÑIÜo­¾
(sƒøÀ#þˆxðGDÿ8ñ#Ì´à…V×È*¢0*w…äÞÔF6u¼É C“1'=²ÿŽiÂv0fÕº¸žzu@‚¾ðžãù’¡õN§kÄÂ£we‡hvF×4?oq“²;Ô=3Ý‚¯—Ý;fº’òÍ.;lº>ÒŒÙÝÚƒÉÙðX¦g˜ÕJAO6X¢´7Þ“ÒÕü¢¥ïç'$ö8ð'¾/’0òú´%B{“Eé.Wé[q¦I’‹'Ý.c<nq‡ot”­És¨’o2‘Ê­[ +	G¦Š²˜«#Â.`å?$ËnÁ†]ßçG/ŽÎŽÈþÁÁÙ	ú½/ÏNÉáÑåþñË‹²#itýn÷ãW”>8ÂÕÀý«•¢,š~n¿ù‰7~åê{ÉÂÂá„ ³m.h‚d×°“ü¨HÌ³ –ÖG^"ÐØj”•.j‚Ã”¯–Wnê¨ Œ ‘æMÙ´³VÈ$ŒÆiá]šñ$2¦l.­</K­rû)Ï±w_‹xIÓXµÏE~×gq]OmÉ¨9˜ŽÑÊó—a¯Eó./™Ä`=¾b(
µÙftñ ê:«ZœUü‚2ž?z~†õç³o­~GãÕJŸÓÝëÌÔD®3ˆB Cí—æ@ªÎŸ ñW„E²Êg
ëB‘ä"¾â¯Áþ…êIZÀÉ<ä2³¢óÙdÓéÓwóÖ#-ÿú—?ÿ'‘´w.-±:º1Xsì·ùÒÔiøÁ“¼BEyÃ+Øy$©Í”¤²ïž²âß,9]ý;9iQf4¸nïG*ÖH_¸™µÈËæ®XÚ$ñp§(%ËœzÇì¼Ž…ß„	ú*
ßúâlz·ñãÊ „…G¤=ýÑÞÊ†þ7ÅÍDÍ¦…sÑ3¤ÉÏ¨Þé¡` µ¬öîø‰H_PwDqÔ8Þ=ðÇ±\¥GÀk©5Ž5íùÅ;À¬Žc°2¦+´Óï­•†‚'@M8AÝb'zMê‹r.ÂóSF$¼&¸„-ñc"—¢£×ÓÌÑ¹÷Í3Ú}Ó>›ˆxí:üq;Ë0MÖ)ØsaóX<¦._¨77Ê]1ðèqf†Ü]
3l>%gÝ„´6·vàôyuòø#g õÄR"–ŠŒ(íÅ˜^ÃVˆÀtjðÇòšy›_àâHëÔ8)©ùÈÙÅÁ½ˆzšEŽÂwñÞÝ¶ŽBòœ#ž§»ÐÂ2â.nQy…2?X¿…¤Çü}]t%Fkä<‡äÉÆV‡p1â`
ds+0Âßšïè¨lV‚¯Mê@‘˜¨É~-OHMw³¬Á¥è½
<#‡d‚Eh¹p ý ¼òƒ¡Çw@ÇËKê_‡a? äÄÇä%ìPEHVç gÇÂ$*¹‘ð“§l|
>¤&iËÛjÓö IÆñÎúúèxãq§†~°ÞétHùsŸ­Axž]‰?Ïƒ¨YÕífäø,ýÊ‹Ñ?8 DÝû _$Ù÷Rºcê$õb?¸çe–”«D"×|Uòü½ÃÄÉ5½ 8´Ý oÆaû©—¯*„éÆzÿã²Re½Ôf"{¤h€É85Ú<«˜®ËÕùVñºÇ Â¥6‘>Î¬>Rª£ÙUU	Ž+cZ±AA:Øüƒó›®Ûÿ€D*¹uMUOU^vòŽ§{„&‘Þ*þ]‚Î!%v:†ü¢bÜ iãï7Ýz§º+;…½ÓßXj="^&‹Å¾_ø b$a”Å/˜‚öËõu²€å# B¨Bâ¢Þ9Áþ?þ5ŠÚ[BoüXoŒ‰:3õFÇ]A—e¯–èöý?zíŸ÷Û¿Ñþâ–ñ¶ú¸“„/Ãw4: ½ exþ6>:<ª0Ù|¯å!S{uÊñü%3@\‹ò|såÒž‰	¶Ìuî­²¡M¤5K5ÂT±Õ,Œ55ka…€:uô>]‘·Ê„¶­Z<2-ðc>Àµ°"Ðƒ°WŒ?õ!›„ B2äRkåÌ¦”¤œîé¦¾³²FpLý$Õ7ÏÆCòc›!2ª°Råe¶£Lœ %Z-Æ†2Nysž«Cô™áPrê÷vCÐðmÌž]Ÿ#'gôÊÁÙþÁoÈÑŽ^’ó£¯/.Ï9€E›ÁÉ0±G7 y¥9œ®ÍÜædÉu}³¦Ä7„ryr“&´‰oîu2äÌã®Ðöd¼ä s}+m"½®¥¼ÈÄ0ðb¹-amé+míò2õ±2u“TšÀ j…1î"î	Æþyã:Ça¤S©tö½Î®ÞÔØÕ_±.o/‰ý@ÒGóvŽ¥‹éRªõM}~j{U_:b‘t§›ÀCd–‰Ç+^÷Š)	¯xKÈÖ÷?X/þÖ|.ªðD3\o?À>HÔE7
ƒÀ»
h-tT1XzŸ•¸£ðOöÌ„ŽÉæ¹¤Ã1V[#iEˆâ£m"_[‘…=já–¼üŽ‡;²¾¥AÆò6kp]Išr!kÄÛOÑ`uˆŒàîX 8ƒ€²Uë¨³øÙìobî;¼Iáw…È“»¨qOfqiA7ì<ZˆáÅÒ÷
'éñ¹±Âk}:¢ÓÕùL¯A©e?@õöŸà…|(IõjŒšÑt¤#Ö—vì÷á}ìH:÷Áˆ/6LX)CP‹É×ð3öûãC$ÉEcÒŸx 
eZsû.*Àý‘vÑjÄ{˜ŸTÎ‚êÞ¨\#¶rÇÜr‹€Þq&WŽúT–‰c=# Ý±Ï+)>‘i+4¨L“¾œG!vY-»µTY·œ)´IZ«sÄ7M•…þNmÔ&™[;¬dÚÒWáƒÀ”"I«ËÍ!Â£Ê¡­Žœ+êX¶P²"/ýã¬¤$å½®Xì³”$²{Z¬áõL¥.ö&‚ÒÖ¦ØÏ¯¨Õ‹IUáPºèq
`ŒÓq²·ÂˆbàFžIq®ÍT ¾Œ•ÁþRXÁÃ¢Y«¬µQQŒ?zz7—®›·é*wØÃn²›²ÃžÚ38m1k¯°vÃåÛ¼6§n¡mbYÖlËËú‚±ðï.Rè%Åµv»¹º¦­6»3\Ü†¿A¹ÑÆ^äõÕ“o@#Ê]DHK–ê¡® ðaÂj3ÀTÀÂ‰1ÁjÔó¢#ðœþTÃŽqàX
×ˆ’qxZFÜ>
à04×{5®£é@tÇ}¤bu{G
%¬›ˆèÈ¨‹Ø¥ãÕ“.KßÓÛ;Z²;:õA¯@Gó†¾µF§EºOQÌ9ÉÆª*æuZÉuÛÖ” ôi3k²3[f;¢x·8Ø{Y4Hß¡Q¤XA2ÄÁßÃ-ßn<Ëoå¹­N¿´¾ƒÉp$\01iíxÒ`š'ñ€ö/’Èï& J¤µÛ¨ÎZ©–_‚^5ñaa_º ×Â¡ÿ3%·¨Ë‚Z¡rÏ¡#°}¸~íG°-ì{ÉT1ÿ!D*2Ø@,j¬É úß’~iÐåk+ó`®wÈ‰ã8ôdŽ©ˆA]†åìza …J!º¬¼>âŠñAñˆ¨×qUlðÂÃ^	/ü„(àxÎØÁ.ºM6¨?Z¿ãÓ+˜­½ 6ÓKdÙFNÇ=`8•É§@¿°»Ç£ëÐ&œ'9…Å'–õî’q Ë’¾dÑYd¶ìþó]rØ§\çÚP§úÇJ
üžç “â·h=!ˆ)#óDu@Çó›y6o«“{ðÊ	œñ+H©+/èý½ÿX}¹º¾új£pwû¸ÁYœžà1sO½Ü|Ø#çU®Ao*( ÌÀjfåÀÁBÅ3¥Á™1°-lÀW~§:­}^1,Û+öµ¾ƒOûä¤}xØäúœ£Z}8Û5r0 ‰éPwÏ÷Fk¸>/AfµøŸõù»ë-n¸RÇúx_¶ìBÞ&WËÌûÌ’ÛZ%ù<#5¯‘áË° _zÇàÎ†eM0ZW3ó^inQt~£…ÈÇÒEÝ Ù¢‡ß7¼ ^ÐN Ÿ«:’<Ë;CaH˜QJƒ¿èÂP#ÏÅ÷Þ5¨>sŸ	G%²ù@ã“8åyÒIœÁÓ»¾Ê.¿€Õïi!vx|õÕþÆÆæV“rk?{YÆˆë,”¦2P3žó¼Ö:c¬àÒù³CÃŸÀ¨_#Xš	¾8aÐF¬OÔÐÞÌo[Ž"…5
b@`û«N!"ë˜OYàY~X›0zPOü½¡9‡9³<bðKqS©u‘ÖÒó¶šØŸ¥d/	»¹&zåÎ9ONqÒÔýîÐR'‰ ‡Jwý~@£äÀºAŠ`sHJ—ä9(çÙZËiY7áÞè¯´’ÝW€o»[òùVçÚRßú2g¬`²‚4dÈ°lƒËö¸=¦ü¶ÌcGZDþé†QD»	Ê®!êƒÌ¬RL*f²pñú\q2R8| Îýb 	 §[ùI“›ÅóÙj¼6
!,hø,|jêÑ•vèºóïs¡»ôébclÊ¾E_þÔÎ¬udG}»¤aÄ*öEÞÁÔ;°e§“¡<ÄÍ½«\E7T†®åñÁ¾dAS¿$‹öøXôŸ]d
DÀ«ˆ¾õé»zî$gYÓ9T·¹‹IZ5ádª‰D® *È…l™×í^ª,±€ê‹<™œ>.PE\ö*æÖÚJÐÌ#ãì³U`óJ€»E¥¡g†wªæäJ7áa· ¬à”5ÑFÂàåÈ"[®äð»EË.äV‰Ã¢ƒË"¿’HDÊƒ­²f/y'^Þú«‰J§—Ml¯<ÿÛÝõdP÷¦Ôé2ÍÍ²qý;™3c°~®õïfÖâ47¦–Ø47«æ”ý~ø52«ÓVÊÚM®B`=åÙÅ3_ø,ä¡XìlÃÉÞ»±ží|‘8Þ{7¹¾Œ1m¸ª»eÒ+¬¤b ëAcðXòÙ„7±p mðÂ¡ žç)­þØoZç¬]©FgQ¥|6ßOÒfÙ¼ ÷:®Šâ!×“î ö=©î±!äw¨ñç…§zõÖÆª¨’–´Ù,–°Éß­”¾Y­hHÏ?Y›ïªréÞ<Í¶ë$¬í¬O‡ÂÃ
›'v1á©tc“Eø)7:
t¥BÕiHŽÄ{ÝWv/•Ï4újé+Ö@ºÎ´Ød²Ù.³™~±3¶µó\&{ŠÎ²—…!eËfF•çoþùVéöÇØÄ¼IÏ÷¡79U˜BÓ´[å½¤®JŸ÷M3ÃÅ8³éPfºU,Ì¢)çágO‹GÊ%8mnÉ¥ÐYaÊšÕcÅìY"Ü5ó5MR ˜©û™V¼Lg»«)™ ÙÕÅÁ ÛS€¶kÂ¶ë·µÐmgÒ›[‚´3Éé!ŠÚìi3ÁÌ´í=?F1×Û«¹ÀùÇ.á©`Ê-¨¢â ]ûÑ0£~³}Ïî^»¦Œ=ÕììLIc
îå“ú‚¢ß=IÑw£0i{8}Úcú_ž6VußtDqWz–ÞtØ5Z4çô:¢ñààžæ<ý‘Ñë,…[:‹N§cÓ$wµã`–|Ý¹³œÐ:r9UA"AÇêD²8Æ¯¢kzmEýZ¿ª_ÖZiêøÛ³ãSrpvúâøü¤œˆUØ°¥ËœS}ë‡Ä¿eJü›¶Hv‰µ;Šk¹_Jµ­¥HØ®!!Æ=çOWKGmÈA°îâ=ÿšÁV^:‡V)vÂÁúiÊæÉðÛLš<Ô/ò½±g%›
º­ƒ›ñÁuº÷Ùâ¦ÌH*íf©$+ÏÆ`E,a	Ä¢À¦Ü­aTÔ†	zòL±ˆßˆR¯c·±­VŽIîŸAýŽ5Q¹×#ŠMY@ú0Ì]Ëlhñò(/42‡Ò(“˜F_Ö¸Iky±Î@bŽEÿ‚Â@w±øÙ öÙr%æE±ß!HàœÆ>æzy)ªÝ5j'_áËÎN¦ò™æHXÇN”MHÎíŒ•Ó0IkÅªÚºF¤.úq«$Ð—·Ô æäÙŒ‘SÞx¶õuH>…ífTªÈïN“_ixuº*…æzÏåš˜›OµÅŸEEC!kä¸V4ümþ¶%n/§C…êÖÏËxsé·é‹:eKL‘t',ËÁC‚õ8²HdäÊs¶(í$òÇ9*{œ¡
‡>ŒÉ ¥‚,±EKžª¥×Éï½ŸáÄmö(!ºT¤wø˜hE»ˆ,W²™yk¯r2ÆÌC·É8ÿéÎëOuºþÂ8œ§mÃb)s‰°ê}u¸ºF-WwF“¾¯õèÆ3ÛÍr“³œ°±ÒLa«d]±7†x§·öÄý–¦ºøáBŽÕb¾
oÍuñã÷öVP‚µßðuÒç¿â‡†^G†×9%-!ùÄ
ójŠÏÉ†9i‘ƒÊ ™(D'Ý&sÄm˜Z]°	–]d¹¨±e(Ý"$U%Œ¡‚NXVð(1ÖÍÆÙƒÅ¹iƒaTXZW VÁÓ€v[æ.~þú—ÿø§”Ø[°Iø’zT•…ÁøFí®róõX81®3f×x®¡³J=Ò0K_ÖC<Õìi—Ÿê.,üc´ªUê=ñ’AgèÝ´6×ˆuµÚd•vL~õ[æ˜'~4~ÅÓ–Úßù&)ùWzËÔ˜Ó³²ÅwÛæí°tÊWT››™F‚(òÐ´jÀÊó»òzß÷ª ‹&”–•:>ûˆ©ã³©©Ã¶`ƒºÁ«0Æ}ÐôŸT7óušB7+<›n òÑériçªüï¿þ÷ÿýÏŸSroa=…xîªAqï™ªJ¼6Õ ·ZªáŠæTe½—C5P	¥¤ä¨ãA5ÐÿÞ¤jð­1—Ñ¥Gß¼G½ðAIÐR%á-_±)”±Ö³)	Ê ’ —vÎ„þ/Ù·¾=Ÿ»¦P$€_¦¦ R°MSÈ­Öƒ¦`¸¢9MAYïåÐTB)i
9êxÐô¿O¥)¸~Ý|d‹pá¿‚aºP‰¢°„^å‹…šnYMQ¾ém8a¸$åÆ9ÄŸ¶0þ´µŒñ§|Ó^d–Ð“¶«¼>Ñ­éàBäÞÈ½¹¼^/;—ÕŠ9öÿIó"Ž]æ•ø´.“ÛÞ÷»œi¼­dgÂyº1§vòZI³¸6òz"rì&ÿAÐPU[ùŒ„þí_²Îñ­C›1^FÞ[ìƒîÝ6Ð5¾Ù£ëÎº/zýèKòúøšTX[
ÄúéÙ%ëu”x·
£¾7òÆâ´œ—ÖØÅ¬þåE$²§.MÂ—†¥q0œƒç'…æÎo†?nüøtã¾óZ;Ÿ²‚ÌJã$ÎžÝNû©³vXëb*¹:’=YÎË/N°’U
&QÁ)bÂâ4°auü¬Ëaø%wá¬n~ý7+êz—h©Úqª0ÉÿË‹ ôR£C¢ØŒ¨S–þ´%*½ <R¶K6LÔ”¶g+Bæ„GDå©Å%™¦³²FVXu¡C²"Gµê›¤ßüZS§“¡|wSÌÞkC7´X?ó(9÷®}”·æQr¦Ÿ}”$L¼@b‰.ªé‹~–Íö³ô‘ÚV¦¸»ÚÑv÷jí­ÎÆÉì¾óªÍƒ6Íœ¶ûƒBqW/ðA8¹5
AŠÁô%J‘7š•¯
g–¢o|A«ùŽè»szíØøVLÖÔdR
Ù”Ò±-®NO1Ýú&ãö”YL3¦ÞIÙÉtñÛŒwwR†3]æYmGËÎ¦›ýÞyýI.EÂïÝÿøI
h¯$ìû×¦±QÃ9î¥k*7^Q,ì¹Ÿì ,”ÜB8¾8“+½Ú<E«^Nhæö6óV~âæË÷YÜ´chÅà%õ¤²Ñçë¥‰)[NŠUnJ¹.^Ã†oôÜ:S¿R|”XvnQj¢J¸| ]Jk«rºLh{^“Ì]ü” å()ŒNúà9Ê‡G/.Èùñé×2/ÙÐ¼Ùó2<¤XÂï}g'Ï#!yØsÎA.˜5e£ééüóŠË¦Õì‰µÐ¦ ƒíçŸ˜k`'jëj‰ýœa¥óUNe*§çÖÈ}=W†n8ù‚5ýµ¾¸øƒfgÊ†µf¼Vf¸¾kob7˜Í­<V¡¯VÐ5–{vn•#G{Óz¦]]ª´®r˜˜„µÛ`»Tk7c Ö¤6¥—•çûË8"¬óMy#´¶HKÊ<•	t½]~¤tQ¡½ÀüZÒqÔõ,JöãØïXZE9\¾êºÜ¾yìÚC©\«/I¢ïvÅþô0¦ÄëÞõÅ?´4ý´¶··»GÊd­Å¬Æ=‘_IÛ¨+ù`Ò…—va},á(såá	…»ÌJñ¿ˆV•FsßS©ËžÔòËr‰9i¸Ré[EL÷Øñ‚~K5Q5 ñÁ²£^¶coDÑv3À}^DGa`8ÜxQ/vkCòªæ«ÓCYózpQj’ÞÐî$¡\eÀ%m©o_Rqb=ÛPªÔáŸKsŸîË`0è;»Åp¨;^æg-¤_‚!wÿ7ÿ  ÿÿ ’“Ÿ¬