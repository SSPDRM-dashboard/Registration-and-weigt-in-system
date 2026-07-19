import React, { useState, useEffect, useRef } from 'react';
import { 
  Trophy, Users, CheckCircle, ShieldCheck, Scale, QrCode, Camera, 
  UserPlus, Download, LogOut, Settings, Plus, Trash2, Edit, Search, 
  AlertCircle, Calendar, MapPin, User, Lock, Upload, Activity, FileText,
  ChevronRight, RefreshCw, Eye, Palette, Sliders, Layout, Sun, GripVertical,
  Printer, Database, X, Coins, PenTool, Home, Shield, Save, Check, Copy, ExternalLink, Share2
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import * as htmlToImage from 'html-to-image';
import jsQR from 'jsqr';
import ExcelJS from 'exceljs';
import { Competition, Player, Coach, WeighIn, Organizer, Referee } from './types';
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
  fetchGlobalClubs,
  saveGlobalClubs,
  fetchAdminPassword,
  saveAdminPasswordToFirestore
} from './firebase';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import SignatureCanvas from 'react-signature-canvas';

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
  const [loginTab, setLoginTab] = useState<'coach' | 'official' | 'admin' | 'organizer' | 'public' | 'referee'>('coach');
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
  const [masterAthletes, setMasterAthletes] = useState<Record<string, Partial<Player>>>({});

  // Referee login / registration state
  const [refereeLoginNric, setRefereeLoginNric] = useState('');
  const [refereeLoginPassword, setRefereeLoginPassword] = useState('');
  const [refereeLoginComp, setRefereeLoginComp] = useState('');
  const [activeReferee, setActiveReferee] = useState<Referee | null>(null);

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
        });
      }
    }
  }, [compId]);

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
  const [editAccDetails, setEditAccDetails] = useState<string>('');
  const [editAccMapsLink, setEditAccMapsLink] = useState<string>('');
  const [addRefereeModalTab, setAddRefereeModalTab] = useState<'existing' | 'new'>('existing');
  const [selectedExistingRefereeNric, setSelectedExistingRefereeNric] = useState<string>('');
  const [searchRegisteredQuery, setSearchRegisteredQuery] = useState('');

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

  // Synchronize cComp, oComp, and refereeLoginComp with the list of active competitions
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
    } else {
      setCComp('');
      setOComp('');
      setRefereeLoginComp('');
    }
  }, [competitions, cComp, oComp, refereeLoginComp]);

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
  const [adminTab, setAdminTab] = useState<'tournaments' | 'coaches' | 'organizers' | 'security' | 'referees' | 'clubs'>('tournaments');
  const [globalClubs, setGlobalClubs] = useState<string[]>([]);
  const [newGlobalClubOption, setNewGlobalClubOption] = useState('');

  const [adminPassword, setAdminPassword] = useState<string>(() => {
    return localStorage.getItem('app:adminPassword') || 'admin123';
  });
  const [newAdminPass, setNewAdminPass] = useState('');
  const [confirmAdminPass, setConfirmAdminPass] = useState('');

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
    if (role === 'referee' && user) {
      const cleanUser = user.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      unsubscribe = subscribeToMyReferees(cleanUser, (myReferees) => {
        setReferees(myReferees);
        if (compId) {
          const matched = myReferees.find(r => r.compId === compId);
          if (matched) setActiveReferee(matched);
        }
      }, (err) => console.error("Failed to sync my referees", err));
    } else if (compId) {
      unsubscribe = subscribeToRefereesForComp(compId, (cloudReferees) => {
        setReferees(cloudReferees);
      }, (err) => console.error("Failed to sync referees", err));
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
    setSelectedExistingRefereeNric('');
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
    if (!selectedExistingRefereeNric) {
      triggerMsg('Please select a referee from the list.', 'error');
      return;
    }

    const selectedAcc = refereeAccounts.find(
      a => a.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === selectedExistingRefereeNric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
    );

    if (!selectedAcc) {
      triggerMsg('Selected referee account not found.', 'error');
      return;
    }

    const cleanIc = selectedAcc.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const alreadyExists = referees.some(r => r.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanIc && r.compId === compId);
    if (alreadyExists) {
      triggerMsg('This referee is already registered for this tournament.', 'error');
      return;
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
      setShowOrganizerAddReferee(false);
      triggerMsg(`Added existing referee ${selectedAcc.fullName} to the tournament`, 'ok');
    } catch (e: any) {
      console.error(e);
      triggerMsg(`Failed to add referee: ${e.message || String(e)}`, 'error');
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

  const handleAdminDeleteCoach = (username: string) => {
    const updated = { ...coaches };
    delete updated[username];
    saveCoachesToStorage(updated);
    setConfirmDeleteCoachUsername(null);
    triggerMsg('Coach account deleted.', 'ok');
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
          id: existingReg?.id || `REF_${compId}_${cleanIc}`,
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
        { header: 'Affiliated Club / State *', key: 'club', width: 26 },
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

        // Affiliated Club / State (Column J)
        ws.getCell(r, 10).dataValidation = {
          type: 'list',
          allowBlank: false,
          formulae: [`Dropdown_Data!$F$2:$F$${clubsList.length + 1}`],
          showErrorMessage: true,
          errorTitle: 'Required Field',
          error: 'Please select an Affiliated Club / State option from the dropdown (required).'
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
          if (!rawAgeGroup) {
            errors.push({ rowNum, name: rawName, error: 'Missing Age Group (Required).' });
            rowHasError = true;
          } else {
            const found = activeComp.ageGroups.find(ag => ag.toLowerCase() === rawAgeGroup.toLowerCase());
            if (found) {
              matchedAgeGroup = found;
            } else {
              const partialFound = activeComp.ageGroups.find(ag => ag.toLowerCase().includes(rawAgeGroup.toLowerCase()));
              if (partialFound) {
                matchedAgeGroup = partialFound;
              } else {
                errors.push({ rowNum, name: rawName, error: `Age Group "${rawAgeGroup}" doesn't match competition divisions.` });
                rowHasError = true;
              }
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
            errors.push({ rowNum, name: rawName, error: 'Missing Affiliated Club / State (Required).' });
            rowHasError = true;
          } else {
            const compClubs = globalClubs.length > 0
              ? globalClubs
              : Object.keys(DEMO_IMPORT.clubs);
            const found = compClubs.find(c => c.toLowerCase() === clubRaw.toLowerCase());
            if (found) {
              club = found;
            } else {
              errors.push({ rowNum, name: rawName, error: `Affiliated Club / State "${clubRaw}" does not match configured tournament options.` });
              rowHasError = true;
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
          'School Name': p.schoolName || '—',
          'School Code': p.schoolCode || '—',
          'Race': p.race || '—',
          'Event': p.event,
          'Division Bracket': p.ageGroup,
          'Target Weight Class': p.weightClass,
          'Scale Weight (kg)': p.weighIn ? p.weighIn.weight : '—',
          'Weigh-In Decision': p.weighIn ? p.weighIn.result : 'NOT WEIGHED',
          'Timestamp': p.weighIn ? new Date(p.weighIn.time).toLocaleString() : '—',
          'Station ID': p.weighIn?.stationId || '—'
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

      // 1. Pass and Fail Result (Anyone who has undergone weigh-in)
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

  const activeComp = competitions.find(c => c.id === compId);

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
          <div className="max-w-md mx-auto my-12 bg-surface rounded-2xl shadow-xl border border-line overflow-hidden transition-all duration-300">
            <div className="p-6 bg-gradient-to-b from-surface-2/50 to-transparent border-b border-line text-center">
              <Trophy className="w-10 h-10 text-gold mx-auto mb-2 animate-bounce" />
              <h2 className="text-xl font-bold uppercase tracking-wider text-text">Championship Portal</h2>
              <p className="text-xs text-text-dim mt-1">Unlock your certified team access terminal</p>
            </div>

            {/* TAB SELECTOR */}
            <div className="flex border-b border-line overflow-x-auto scrollbar-none">
              <button 
                onClick={() => setLoginTab('coach')}
                className={`flex-1 min-w-[70px] py-3 text-[10px] font-bold uppercase tracking-wider transition shrink-0 ${
                  loginTab === 'coach' ? 'border-b-2 border-gold text-gold bg-surface-2/20' : 'text-text-dim hover:text-text'
                }`}
              >
                Coach
              </button>
              <button 
                onClick={() => setLoginTab('organizer')}
                className={`flex-1 min-w-[80px] py-3 text-[10px] font-bold uppercase tracking-wider transition shrink-0 ${
                  loginTab === 'organizer' ? 'border-b-2 border-gold text-gold bg-surface-2/20' : 'text-text-dim hover:text-text'
                }`}
              >
                Organizer
              </button>
              <button 
                onClick={() => setLoginTab('official')}
                className={`flex-1 min-w-[70px] py-3 text-[10px] font-bold uppercase tracking-wider transition shrink-0 ${
                  loginTab === 'official' ? 'border-b-2 border-gold text-gold bg-surface-2/20' : 'text-text-dim hover:text-text'
                }`}
              >
                Official
              </button>
              <button 
                onClick={() => setLoginTab('referee')}
                className={`flex-1 min-w-[70px] py-3 text-[10px] font-bold uppercase tracking-wider transition shrink-0 ${
                  loginTab === 'referee' ? 'border-b-2 border-gold text-gold bg-surface-2/20' : 'text-text-dim hover:text-text'
                }`}
              >
                Referee
              </button>
              <button 
                onClick={() => setLoginTab('admin')}
                className={`flex-1 min-w-[60px] py-3 text-[10px] font-bold uppercase tracking-wider transition shrink-0 ${
                  loginTab === 'admin' ? 'border-b-2 border-gold text-gold bg-surface-2/20' : 'text-text-dim hover:text-text'
                }`}
              >
                Admin
              </button>
              <button 
                onClick={() => setLoginTab('public')}
                className={`flex-1 min-w-[95px] py-3 text-[10px] font-bold uppercase tracking-wider transition shrink-0 ${
                  loginTab === 'public' ? 'border-b-2 border-gold text-gold bg-surface-2/20' : 'text-text-dim hover:text-text'
                }`}
              >
                Public View
              </button>
            </div>

            <div className="p-6 space-y-4">
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
                  ← Back to tournaments
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
                        {coachKyorugiCount} × {activeComp.kyorugiFee} = {formatCurrency(kyorugiTotal, sampleFee)}
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
                        {coachPoomsaeCount} × {activeComp.poomsaeFee} = {formatCurrency(poomsaeTotal, sampleFee)}
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
                        {coachParaCount} × {activeComp.paraFee} = {formatCurrency(paraTotal, sampleFee)}
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
                        {coachVirtualCount} × {activeComp.virtualFee} = {formatCurrency(virtualTotal, sampleFee)}
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
                                      {p.schoolName && p.race && ' · '}
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
                ← Back
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
                          <div className="text-xs text-text-dim">IC: {masterAthletes[selectedMasterId].ic} · {masterAthletes[selectedMasterId].club}</div>
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
                            ×
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
                                      <div className="text-xs text-text-dim">IC: {ma.ic} · {ma.club}</div>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">IC Number *</label>
                  <input 
                    type="text" 
                    value={pIc}
                    onChange={(e) => setPIc(e.target.value)}
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
                    onChange={(e) => setPDob(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSavePlayer(); }}
                    className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
                  />
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
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Age Group Category *</label>
                  <select 
                    value={pAgeGroup}
                    onChange={(e) => setPAgeGroup(e.target.value)}
                    className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
                  >
                    {activeComp.ageGroups.length === 0 ? (
                      <option value="">No age groups defined by admin</option>
                    ) : (
                      activeComp.ageGroups.map(ag => (
                        <option key={ag} value={ag}>{ag}</option>
                      ))
                    )}
                  </select>
                </div>
              </div>

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
              ← Back
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
                                        <span className="font-medium line-clamp-1" style={{ fontSize: getFontSizePx(field.fontSize, '12px'), color: field.color || '#ffffff' }}>{p.ageGroup || '—'}</span>
                                      </div>
                                      <div>
                                        <span className="block text-[8px] text-text-dim/60 uppercase tracking-widest font-bold">Gender</span>
                                        <span className="font-medium" style={{ fontSize: getFontSizePx(field.fontSize, '12px'), color: field.color || '#ffffff' }}>{p.gender || '—'}</span>
                                      </div>
                                      <div>
                                        <span className="block text-[8px] text-text-dim/60 uppercase tracking-widest font-bold font-sans">Weight Class</span>
                                        <span className="font-medium line-clamp-1" style={{ fontSize: getFontSizePx(field.fontSize, '12px'), color: field.color || '#ffffff' }}>{p.weightClass || '—'}</span>
                                      </div>
                                      <div>
                                        <span className="block text-[8px] text-text-dim/60 uppercase tracking-widest font-bold">DOB</span>
                                        <span className="font-medium" style={{ fontSize: getFontSizePx(field.fontSize, '12px'), color: field.color || '#ffffff' }}>{p.dob || '—'}</span>
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
                <p className="text-xs text-text-dim">Tournament Active: <strong className="text-text">{activeComp.name}</strong> • Station: <strong className="text-text">{oStation}</strong></p>
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
                        Connect any standard handheld USB or Bluetooth scanner gun. The scanner gun acts as a keyboard emulator—just point and scan any ID card.
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
                            <p className="text-xs text-text-dim font-mono mt-0.5">{p.id} · {p.club}</p>
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
                          <div className="flex justify-between"><span className="text-text-dim/60">Division category</span><strong className="text-text font-semibold">{p.ageGroup} · {p.gender}</strong></div>
                          <div className="flex justify-between"><span className="text-text-dim/60">Target Division weight</span><strong className="text-gold font-bold">{p.weightClass}</strong></div>
                          {range && (
                            <div className="flex justify-between border-t border-line/40 pt-2 text-[11px]"><span className="text-text-dim/60">Division Limit</span><strong className="text-text font-mono">{range.min === 0 ? '≤ ' : `${range.min}kg - `}{range.max}kg</strong></div>
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
                  ← Back to live scanner
                </button>
                <div>
                  <h2 className="text-lg font-bold uppercase tracking-wider text-text font-display">Live Weigh-In Ledger</h2>
                  <p className="text-xs text-text-dim">{activeComp.name} · Official records history</p>
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
                                  {p.schoolName && p.race && ' · '}
                                  {p.race && `Race: ${p.race}`}
                                </div>
                              )}
                            </td>
                            <td className="p-4 text-text">{p.club}</td>
                            <td className="p-4 text-text-dim">
                              <div className="font-semibold text-text">{p.weightClass}</div>
                              {range && <span className="text-[10px] font-mono">{range.min === 0 ? '≤ ' : `${range.min}kg - `}{range.max}kg</span>}
                            </td>
                            <td className="p-4 font-mono font-bold text-sm text-text">{p.weighIn.weight} kg</td>
                            <td className="p-4">{renderBadge(p.weighIn.result)}</td>
                            <td className="p-4 text-text-dim">{new Date(p.weighIn.time).toLocaleTimeString()}</td>
                            <td className="p-4 text-text-dim/80 text-sm">{p.weighIn.stationId || '—'}</td>
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
              {adminTab === 'coaches' && (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-text-dim uppercase tracking-widest">Registered Coach Accounts ({Object.keys(coaches).length})</h3>
                  
                  {Object.keys(coaches).length === 0 ? (
                    <div className="bg-surface p-12 text-center text-text-dim rounded-2xl border border-line">
                      <Users className="w-12 h-12 text-text-dim/30 mx-auto mb-3" />
                      <p className="text-sm font-semibold">No coaches registered yet.</p>
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
                          {Object.entries(coaches).map(([username, coach]: [string, any]) => (
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
                                      className="text-good hover:bg-good/10 px-2 py-1 rounded transition mr-2"
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
                                      <div className="flex items-center justify-end space-x-1">
                                        <button 
                                          onClick={() => handleAdminDeleteCoach(username)}
                                          className="bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-sm"
                                        >
                                          Confirm
                                        </button>
                                        <button 
                                          onClick={() => setConfirmDeleteCoachUsername(null)}
                                          className="bg-surface border border-line text-text hover:bg-line px-2.5 py-1 rounded-lg text-[10px]"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    ) : (
                                      <>
                                        <button
                                          onClick={() => handleAdminEditCoach(username, coach)}
                                          className="text-chong hover:bg-chong/10 p-1.5 rounded transition mr-2"
                                          title="Edit"
                                        >
                                          <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() => setConfirmDeleteCoachUsername(username)}
                                          className="text-hong hover:bg-hong/10 p-1.5 rounded transition"
                                          title="Delete"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </>
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
              )}

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
                          •••••••• (Stored securely in local storage)
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
                              ×
                            </button>
                          </span>
                        ))
                      )}
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
                ← Back to admin panel
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
                <p className="text-xs text-text-dim">Venue: {activeComp.venue} · Date: {formatDateRange(activeComp.date, activeComp.endDate)}</p>
                {activeComp.registrationCloseDate && (
                  <p className="text-xs text-text-dim mt-0.5">Registration Closes: {activeComp.registrationCloseDate}</p>
                )}
              </div>
              <button 
                onClick={() => setScreen('adminHome')}
                className="text-xs text-gold border border-gold/30 px-3 py-1.5 rounded-lg hover:bg-gold/10 transition shrink-0"
              >
                ← All Tournaments
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
                                  {field.visible ? '● Active / Visible' : '○ Deleted / Hidden'}
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
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === arr.length - 1}
                                  onClick={() => handleMoveField(idx, 'down')}
                                  className="p-1.5 hover:bg-surface-2 transition text-gold disabled:opacity-30 disabled:pointer-events-none text-xs"
                                  title="Move Down"
                                >
                                  ▼
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
                            ×
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
                            ×
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
                                {p.schoolName && p.race && ' · '}
                                {p.race && `Race: ${p.race}`}
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-text">{p.club}</td>
                          <td className="p-4 text-text-dim">{p.ageGroup} · {p.gender}</td>
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
                        ×
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
                                {p.schoolName && p.race && ' · '}
                                {p.race && `Race: ${p.race}`}
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-text">{p.club}</td>
                          <td className="p-4 text-text-dim">{p.ageGroup} · {p.gender}</td>
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
                            e.currentTarget.classList.add('ring-1', 'ring-dashed', 'ring-gold/40', 'bg-gold/5', 'rounded-lg', 'p-1');
                          }}
                          onDragLeave={(e) => {
                            e.currentTarget.classList.remove('ring-1', 'ring-dashed', 'ring-gold/40', 'bg-gold/5', 'rounded-lg', 'p-1');
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.currentTarget.classList.remove('ring-1', 'ring-dashed', 'ring-gold/40', 'bg-gold/5', 'rounded-lg', 'p-1');
                            const draggedId = e.dataTransfer.getData('text/plain');
                            if (draggedId && draggedId !== field.id) {
                              handleSwapFields(draggedId, field.id);
                            }
                          }}
                          className="pt-3 first:pt-0 space-y-1.5 border border-transparent p-1 hover:bg-white/5 rounded-lg cursor-grab active:cursor-grabbing transition-all duration-150"
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center space-x-1.5 min-w-0">
                              <GripVertical className="w-3 h-3 text-text-dim/40 cursor-grab shrink-0" />
                              <span className="text-[11px] font-bold text-text uppercase tracking-wide truncate max-w-[150px]">{field.name}</span>
                            </div>
                            <span className={`text-[8px] uppercase font-bold tracking-widest ${field.visible ? 'text-good' : 'text-bad'}`}>
                              {field.visible ? 'Visible' : 'Deleted'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <div className="flex items-center border border-line rounded overflow-hidden bg-ink">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => handleMoveField(idx, 'up')}
                                  className="px-1 text-gold disabled:opacity-30 disabled:pointer-events-none text-[9px]"
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === arr.length - 1}
                                  onClick={() => handleMoveField(idx, 'down')}
                                  className="px-1 text-gold disabled:opacity-30 disabled:pointer-events-none text-[9px]"
                                >
                                  ▼
                                </button>
                              </div>

                              {/* Alignment Selector */}
                              {['header', 'photo', 'name', 'club', 'athleteId', 'metadata', 'qrcode'].includes(field.id) && (
                                <select
                                  value={field.align || (field.id === 'qrcode' ? 'left' : 'center')}
                                  onChange={(e) => handleChangeFieldAlign(field.id, e.target.value as any)}
                                  className="bg-ink border border-line rounded text-[9px] py-0.5 px-1 text-text focus:outline-none focus:border-gold"
                                  title="Align Element"
                                >
                                  <option value="left">L Align</option>
                                  <option value="center">C Align</option>
                                  <option value="right">R Align</option>
                                </select>
                              )}

                              {['header', 'name', 'club', 'athleteId', 'metadata', 'qrcode'].includes(field.id) && (
                                <div className="flex items-center gap-1.5">
                                  <select
                                    value={field.fontSize}
                                    onChange={(e) => handleChangeFieldFontSize(field.id, e.target.value as any)}
                                    className="bg-ink border border-line rounded text-[9px] py-0.5 px-1 text-text focus:outline-none focus:border-gold"
                                    title="Font Size"
                                  >
                                    <option value="xs">XS</option>
                                    <option value="sm">SM</option>
                                    <option value="base">MD</option>
                                    <option value="lg">LG</option>
                                    <option value="xl">XL</option>
                                    <option value="2xl">2X</option>
                                    <option value="3xl">3X</option>
                                  </select>

                                  <div className="relative flex items-center bg-ink border border-line rounded px-1.5 py-0.5 gap-1.5" title="Font Color">
                                    <input
                                      type="color"
                                      value={field.color || (field.id === 'header' || field.id === 'name' || field.id === 'metadata' ? '#ffffff' : field.id === 'club' ? '#a0aec0' : '#D4AF37')}
                                      onChange={(e) => handleChangeFieldColor(field.id, e.target.value)}
                                      className="w-3.5 h-3.5 rounded-full border border-line/40 cursor-pointer overflow-hidden p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none shrink-0"
                                    />
                                    <span className="text-[8px] font-mono text-text-dim uppercase leading-none">{field.color || (field.id === 'header' || field.id === 'name' || field.id === 'metadata' ? '#ffffff' : field.id === 'club' ? '#a0aec0' : '#D4AF37')}</span>
                                  </div>
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleToggleFieldVisibility(field.id)}
                              className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase transition border ${
                                field.visible 
                                  ? 'text-bad bg-bad/5 border-bad/20 hover:bg-bad/10' 
                                  : 'text-good bg-good/5 border-good/20 hover:bg-good/10'
                              }`}
                            >
                              {field.visible ? 'Del' : 'Add'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>

            {/* Right Column: Premium High-Fidelity Large Live Preview */}
            <div className="lg:col-span-7 bg-surface rounded-2xl border border-line p-8 flex flex-col items-center justify-center space-y-6 shadow-sm sticky top-6">
              <div className="w-full border-b border-line/50 pb-3 flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-text-dim">Live Design Preview (Sample Athlete Badge)</span>
                <span className="text-[9px] font-bold text-gold bg-gold/15 px-2.5 py-1 rounded-full border border-gold/30">Drag & Drop Enabled</span>
              </div>

              {/* ID CARD GRAPHIC PREVIEW CONTAINER */}
              <div className="relative w-full max-w-[340px] aspect-[1/1.4] rounded-2xl border border-line/80 overflow-hidden shadow-2xl flex flex-col bg-gradient-to-br from-[#12211C] to-[#0A1310] animate-fade-in">
                {activeComp.idCardBgUrl && (
                  <>
                    <div className="absolute inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: `url(${activeComp.idCardBgUrl})` }} />
                    <div className="absolute inset-0 z-0 bg-black/40 mix-blend-multiply" />
                  </>
                )}
                
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
                      'xs': '8px',
                      'sm': '10px',
                      'base': '12px',
                      'lg': '14px',
                      'xl': '17px',
                      '2xl': '21px',
                      '3xl': '25px'
                    };
                    return map[size] || defaultVal;
                  };

                  return (
                    <div className="relative z-10 h-full flex-1 flex flex-col justify-between text-[11px] py-3">
                      {fieldsList.filter(f => f.visible).map(field => {
                        if (field.id === 'header') {
                          return (
                            <div key="header" className={`h-8.5 bg-gradient-to-r from-hong via-hong to-chong flex ${
                              field.align === 'left' ? 'justify-start gap-1.5' :
                              field.align === 'right' ? 'justify-end gap-1.5' :
                              field.align === 'center' ? 'justify-center gap-1.5' :
                              'justify-between'
                            } items-center px-3.5 shrink-0 shadow-sm w-full`}>
                              <span className="font-display font-bold tracking-wider uppercase drop-shadow-sm truncate" style={{ fontSize: (p.id.startsWith('STAFF-') || p.ageGroup === 'STAFF') ? `${parseInt(getFontSizePx(field.fontSize, '8px'), 10) + 3}px` : getFontSizePx(field.fontSize, '8px'), color: field.color || '#ffffff' }}>{activeComp.name}</span>
                              
                            </div>
                          );
                        }
                        if (field.id === 'belt') {
                          return (
                            <div key="belt" className="h-1.5 w-full shrink-0" style={{ backgroundColor: belt }}></div>
                          );
                        }

                        // Render interactive card items in high fidelity
                        return (
                          <div key={field.id} className="px-4.5 py-1 shrink-0">
                            {(() => {
                              if (field.id === 'photo') {
                                return (
                                  <div className={`flex ${
                                    field.align === 'left' ? 'justify-start' :
                                    field.align === 'right' ? 'justify-end' :
                                    'justify-center'
                                  }`}>
                                    <div className="w-14 h-16 bg-ink rounded-lg border border-line flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
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
                                    <h3 className="font-display font-bold leading-tight tracking-wide uppercase line-clamp-2" style={{ fontSize: getFontSizePx(field.fontSize, '12px'), color: field.color || '#ffffff' }}>{p.name}</h3>
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
                                    <p className="uppercase tracking-widest font-semibold" style={{ fontSize: getFontSizePx(field.fontSize, '8px'), color: field.color || '#a0aec0' }}>{p.club}</p>
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
                                  <div className={`grid grid-cols-2 gap-2 text-[9px] border-t border-line/30 pt-2 ${
                                    field.align === 'left' ? 'text-left' :
                                    field.align === 'right' ? 'text-right' :
                                    'text-center'
                                  }`}>
                                    <div>
                                      <span className="block text-[6px] text-text-dim/60 uppercase tracking-widest font-bold">Category</span>
                                      <span className="font-medium line-clamp-1" style={{ fontSize: getFontSizePx(field.fontSize, '9px'), color: field.color || '#ffffff' }}>{p.ageGroup}</span>
                                    </div>
                                    <div>
                                      <span className="block text-[6px] text-text-dim/60 uppercase tracking-widest font-bold">Gender</span>
                                      <span className="font-medium" style={{ fontSize: getFontSizePx(field.fontSize, '9px'), color: field.color || '#ffffff' }}>{p.gender}</span>
                                    </div>
                                    <div>
                                      <span className="block text-[6px] text-text-dim/60 uppercase tracking-widest font-bold font-sans">Weight</span>
                                      <span className="font-medium line-clamp-1" style={{ fontSize: getFontSizePx(field.fontSize, '9px'), color: field.color || '#ffffff' }}>{p.weightClass}</span>
                                    </div>
                                    <div>
                                      <span className="block text-[6px] text-text-dim/60 uppercase tracking-widest font-bold">DOB</span>
                                      <span className="font-medium" style={{ fontSize: getFontSizePx(field.fontSize, '9px'), color: field.color || '#ffffff' }}>{p.dob}</span>
                                    </div>
                                  </div>
                                );
                              }
                              if (field.id === 'qrcode') {
                                const containerClass = 
                                  field.align === 'right' ? 'flex flex-row-reverse items-center justify-between' :
                                  field.align === 'center' ? 'flex flex-col items-center justify-center gap-1.5 text-center' :
                                  'flex items-center justify-between';
                                
                                const textAlignmentClass = 
                                  field.align === 'right' ? 'text-left min-w-0' :
                                  field.align === 'center' ? 'text-center min-w-0' :
                                  'text-right min-w-0';

                                return (
                                  <div className={`${containerClass} border-t border-dashed border-line/30 pt-2`}>
                                    <div className="bg-white p-0.5 rounded inline-block shadow shrink-0">
                                      <QRCodeSVG 
                                        value={`${activeComp.id}::${p.id}`} 
                                        size={32} 
                                        level="M" 
                                        includeMargin={false}
                                      />
                                    </div>
                                    <div className={textAlignmentClass}>
                                      {!(p.id.startsWith('STAFF-') || p.ageGroup === 'STAFF') && <p className="font-display font-bold uppercase tracking-wider bg-slate-950/30 px-1.5 py-0.5 rounded border border-white/10 text-white inline-block mb-1" style={{ fontSize: getFontSizePx(field.fontSize, '8px') }}>{p.event}</p>}
                                        <p className="font-display font-bold uppercase tracking-wider" style={{ fontSize: getFontSizePx(field.fontSize, '7px'), color: field.color || '#D4AF37' }}>Tournament Entry Pass</p>
                                      <p className="mt-0.5 leading-normal text-[6px]" style={{ fontSize: getFontSizePx(field.fontSize, '6px'), color: field.color || '#a0aec0', opacity: 0.85 }}>Scan to digitally verify {p.id.startsWith('STAFF-') || p.ageGroup === 'STAFF' ? 'personnel.' : 'athlete.'}</p>
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
                  );
                })()}
              </div>

              <div className="text-center max-w-md bg-ink/20 border border-line rounded-xl p-3">
                <span className="text-[10px] font-bold text-gold uppercase tracking-wider block mb-1">Visual Design Guidelines</span>
                <p className="text-[10px] text-text-dim leading-relaxed">
                  Badges will auto-scale to standard physical CR80 sizes (3.375" x 2.125") upon PDF compilation and batch printing. Use the live mockup above to preview placement & layout proportions.
                </p>
              </div>
            </div>
          </div>
        )}

        {organizerTab === 'staffPasses' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start w-full animate-fade-in">
            {/* Left Column: Form */}
            <div className="lg:col-span-4 bg-surface rounded-2xl border border-line p-6 space-y-6 shadow-sm">
              <div className="border-b border-line/50 pb-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-text flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-gold" />
                  Add Custom Staff Pass
                </h3>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-text-dim">Full Name</label>
                  <input
                    type="text"
                    value={staffPassName}
                    onChange={(e) => setStaffPassName(e.target.value)}
                    placeholder="e.g. Ali Bin Abu"
                    className="w-full bg-ink border border-line rounded-xl px-3 py-2.5 text-xs text-text outline-none focus:border-gold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-text-dim">Role / Title</label>
                  <select
                    value={staffPassRole}
                    onChange={(e) => setStaffPassRole(e.target.value)}
                    className="w-full bg-ink border border-line rounded-xl px-3 py-2.5 text-xs text-text outline-none focus:border-gold"
                  >
                    <option value="Coach">Coach</option>
                    <option value="Team Manager">Team Manager</option>
                    <option value="Referee">Referee</option>
                    <option value="VIP">VIP</option>
                    <option value="Staff">Staff</option>
                    <option value="Medical">Medical</option>
                    <option value="Media">Media</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-text-dim">Organization / Club</label>
                  <input
                    type="text"
                    value={staffPassClub}
                    onChange={(e) => setStaffPassClub(e.target.value)}
                    placeholder="e.g. Taekwondo Malaysia"
                    className="w-full bg-ink border border-line rounded-xl px-3 py-2.5 text-xs text-text outline-none focus:border-gold"
                  />
                </div>
                <button
                  onClick={() => {
                    if (!staffPassName) {
                      triggerMsg('Please enter a name.', 'error');
                      return;
                    }
                    if (!compId) return;
                    const newStaff: Player = {
                      id: `STAFF-${Date.now().toString().slice(-6)}`,
                      compId,
                      name: staffPassName.toUpperCase(),
                      club: staffPassClub.toUpperCase(),
                      ic: '',
                      dob: 'N/A',
                      gender: 'N/A',
                      coachUsername: '',
                      event: staffPassRole.toUpperCase(),
                      ageGroup: 'STAFF',
                      weightClass: 'N/A',
                      createdAt: new Date().toISOString(),
                      weighIn: null
                    };
                    saveStaffPassesToStorage(compId, [...staffPasses, newStaff]);
                    setStaffPassName('');
                    setStaffPassClub('');
                    triggerMsg('Staff pass generated.', 'ok');
                  }}
                  className="w-full bg-gold hover:opacity-90 text-ink font-bold py-3 rounded-xl transition duration-200 cursor-pointer text-xs uppercase tracking-wider"
                >
                  Generate Pass
                </button>
              </div>
            </div>

            {/* Right Column: Grid */}
            <div className="lg:col-span-8 bg-surface rounded-2xl border border-line p-6 shadow-sm min-h-[400px]">
              <div className="border-b border-line/50 pb-3 mb-6 flex justify-between items-center">
                <h3 className="text-sm font-bold uppercase tracking-wider text-text flex items-center gap-2">
                  <Users className="w-4 h-4 text-gold" />
                  Generated Passes
                </h3>
              </div>
              
              {staffPasses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-text-dim space-y-3 bg-ink/30 border border-dashed border-line rounded-2xl">
                  <UserPlus className="w-8 h-8 text-text-dim/40" />
                  <p className="text-sm font-bold">No custom passes generated</p>
                  <p className="text-xs">Use the form on the left to add staff passes.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {staffPasses.map(staff => (
                    <div key={staff.id} className="bg-ink rounded-2xl border border-line p-4 flex flex-col justify-between shadow-sm relative group">
                      <button
                        onClick={() => {
                          if (!compId) return;
                          saveStaffPassesToStorage(compId, staffPasses.filter(s => s.id !== staff.id));
                        }}
                        className="absolute -top-2 -right-2 bg-hong text-white w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow hover:scale-110 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                      <div>
                        <div className="text-[10px] font-bold text-gold uppercase tracking-wider mb-1">{staff.event}</div>
                        <h4 className="font-display font-bold text-text truncate mb-1" title={staff.name}>{staff.name}</h4>
                        <div className="text-xs text-text-dim truncate" title={staff.club}>{staff.club || '-'}</div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-line/50 flex justify-end">
                        <button
                          onClick={() => {
                            // Let's use the print functionality for single card. 
                            // Since we don't have a single-card generator yet, we can add it or just re-use the global batch export for staff.
                            // To keep it simple, we'll set it as a selected staff and open a modal, or just download it directly if we had a hidden container.
                            // I'll implement a hidden container for staff passes specifically below.
                            const el = document.getElementById(`staff-card-${staff.id}`);
                            if (el) {
                              triggerMsg('Generating PNG...', 'ok');
                              htmlToImage.toPng(el, { backgroundColor: '#12211C', pixelRatio: 3.125 }).then(dataUrl => {
                                const link = document.createElement('a');
                                link.download = `DOJANG_STAFF_${staff.event}_${staff.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
                                link.href = dataUrl;
                                link.click();
                              }).catch(err => {
                                console.error('Failed to generate staff pass', err);
                                triggerMsg('Failed to generate PNG', 'error');
                              });
                            }
                          }}
                          className="bg-surface-2 hover:bg-line border border-line text-text text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download PNG
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {organizerTab === 'referees' && (
          <div className="space-y-6 animate-fade-in">
            {/* Referee Event Fees Setup */}
            <div className="bg-surface border border-line p-5 rounded-2xl shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center space-x-2">
                  <Coins className="w-5 h-5 text-gold" />
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-text">Referee Event Fees & Allowances Setup</h3>
                    <p className="text-[11px] text-text-dim mt-0.5">Configure mileage allowances, daily duty allowances, and supplemental officiating pay</p>
                  </div>
                </div>
                <span className="text-[10px] bg-gold/10 text-gold border border-gold/20 px-2.5 py-0.5 rounded font-mono font-bold">
                  RM / Flat Rate
                </span>
              </div>
              
              <div>
                <h4 className="text-[10px] font-bold text-gold uppercase tracking-wider mb-2">1. Travel Mileage Bracket Allowances</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-1">0 - 50 km</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1.5 text-text-dim/60 text-[11px] font-mono">RM</span>
                      <input 
                        type="number"
                        value={refereeFees.km_0_50}
                        onChange={(e) => updateRefereeFees({ ...refereeFees, km_0_50: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-ink border border-line rounded-lg py-1 pl-7 pr-1.5 text-xs font-mono font-bold text-text focus:outline-none focus:border-gold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-1">50 - 100 km</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1.5 text-text-dim/60 text-[11px] font-mono">RM</span>
                      <input 
                        type="number"
                        value={refereeFees.km_50_100}
                        onChange={(e) => updateRefereeFees({ ...refereeFees, km_50_100: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-ink border border-line rounded-lg py-1 pl-7 pr-1.5 text-xs font-mono font-bold text-text focus:outline-none focus:border-gold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-1">100 - 150 km</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1.5 text-text-dim/60 text-[11px] font-mono">RM</span>
                      <input 
                        type="number"
                        value={refereeFees.km_100_150}
                        onChange={(e) => updateRefereeFees({ ...refereeFees, km_100_150: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-ink border border-line rounded-lg py-1 pl-7 pr-1.5 text-xs font-mono font-bold text-text focus:outline-none focus:border-gold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-1">150 - 200 km</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1.5 text-text-dim/60 text-[11px] font-mono">RM</span>
                      <input 
                        type="number"
                        value={refereeFees.km_150_200}
                        onChange={(e) => updateRefereeFees({ ...refereeFees, km_150_200: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-ink border border-line rounded-lg py-1 pl-7 pr-1.5 text-xs font-mono font-bold text-text focus:outline-none focus:border-gold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-1">200 - 250 km</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1.5 text-text-dim/60 text-[11px] font-mono">RM</span>
                      <input 
                        type="number"
                        value={refereeFees.km_200_250}
                        onChange={(e) => updateRefereeFees({ ...refereeFees, km_200_250: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-ink border border-line rounded-lg py-1 pl-7 pr-1.5 text-xs font-mono font-bold text-text focus:outline-none focus:border-gold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-1">250 - 300 km</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1.5 text-text-dim/60 text-[11px] font-mono">RM</span>
                      <input 
                        type="number"
                        value={refereeFees.km_250_300}
                        onChange={(e) => updateRefereeFees({ ...refereeFees, km_250_300: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-ink border border-line rounded-lg py-1 pl-7 pr-1.5 text-xs font-mono font-bold text-text focus:outline-none focus:border-gold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-1">300 - 350 km</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1.5 text-text-dim/60 text-[11px] font-mono">RM</span>
                      <input 
                        type="number"
                        value={refereeFees.km_300_350}
                        onChange={(e) => updateRefereeFees({ ...refereeFees, km_300_350: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-ink border border-line rounded-lg py-1 pl-7 pr-1.5 text-xs font-mono font-bold text-text focus:outline-none focus:border-gold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-1">350 km & above</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1.5 text-text-dim/60 text-[11px] font-mono">RM</span>
                      <input 
                        type="number"
                        value={refereeFees.km_350_above}
                        onChange={(e) => updateRefereeFees({ ...refereeFees, km_350_above: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-ink border border-line rounded-lg py-1 pl-7 pr-1.5 text-xs font-mono font-bold text-text focus:outline-none focus:border-gold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gold uppercase tracking-wider mb-1">TD / CSB Rate (Per KM)</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1.5 text-text-dim/60 text-[11px] font-mono">RM</span>
                      <input 
                        type="number"
                        step="0.05"
                        value={refereeFees.km_rate_special}
                        onChange={(e) => updateRefereeFees({ ...refereeFees, km_rate_special: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-ink border border-gold/50 rounded-lg py-1 pl-7 pr-1.5 text-xs font-mono font-bold text-text focus:outline-none focus:border-gold"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-line/40 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-[10px] font-bold text-gold uppercase tracking-wider mb-2">2. Daily Duty Allowance Rates</h4>
                  <div className="space-y-4">
                    <div>
                      <div className="text-[9px] text-text-dim uppercase tracking-wider font-bold mb-1.5">Standard Referee Statuses</div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-1">IR (International)</label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-2 text-text-dim/60 text-xs font-mono">RM</span>
                            <input 
                              type="number"
                              value={refereeFees.rate_ir}
                              onChange={(e) => updateRefereeFees({ ...refereeFees, rate_ir: parseFloat(e.target.value) || 0 })}
                              className="w-full bg-ink border border-line rounded-lg py-1.5 pl-8 pr-2 text-xs font-mono font-bold text-text focus:outline-none focus:border-gold"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-1">NR (National)</label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-2 text-text-dim/60 text-xs font-mono">RM</span>
                            <input 
                              type="number"
                              value={refereeFees.rate_nr}
                              onChange={(e) => updateRefereeFees({ ...refereeFees, rate_nr: parseFloat(e.target.value) || 0 })}
                              className="w-full bg-ink border border-line rounded-lg py-1.5 pl-8 pr-2 text-xs font-mono font-bold text-text focus:outline-none focus:border-gold"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-1">SR (State/Senior)</label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-2 text-text-dim/60 text-xs font-mono">RM</span>
                            <input 
                              type="number"
                              value={refereeFees.rate_sr}
                              onChange={(e) => updateRefereeFees({ ...refereeFees, rate_sr: parseFloat(e.target.value) || 0 })}
                              className="w-full bg-ink border border-line rounded-lg py-1.5 pl-8 pr-2 text-xs font-mono font-bold text-text focus:outline-none focus:border-gold"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-1">TR (Trainee)</label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-2 text-text-dim/60 text-xs font-mono">RM</span>
                            <input 
                              type="number"
                              value={refereeFees.rate_tr}
                              onChange={(e) => updateRefereeFees({ ...refereeFees, rate_tr: parseFloat(e.target.value) || 0 })}
                              className="w-full bg-ink border border-line rounded-lg py-1.5 pl-8 pr-2 text-xs font-mono font-bold text-text focus:outline-none focus:border-gold"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-line/20 pt-3">
                      <div className="text-[9px] text-text-dim uppercase tracking-wider font-bold mb-1.5">Special Appointed Officials</div>
                      <div className="grid grid-cols-3 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-1">Technical Delegate</label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-2 text-text-dim/60 text-xs font-mono">RM</span>
                            <input 
                              type="number"
                              value={refereeFees.rate_td}
                              onChange={(e) => updateRefereeFees({ ...refereeFees, rate_td: parseFloat(e.target.value) || 0 })}
                              className="w-full bg-ink border border-line rounded-lg py-1.5 pl-8 pr-2 text-xs font-mono font-bold text-text focus:outline-none focus:border-gold"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-1">Supervisory Board</label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-2 text-text-dim/60 text-xs font-mono">RM</span>
                            <input 
                              type="number"
                              value={refereeFees.rate_csb}
                              onChange={(e) => updateRefereeFees({ ...refereeFees, rate_csb: parseFloat(e.target.value) || 0 })}
                              className="w-full bg-ink border border-line rounded-lg py-1.5 pl-8 pr-2 text-xs font-mono font-bold text-text focus:outline-none focus:border-gold"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-1">Referee In-Charge</label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-2 text-text-dim/60 text-xs font-mono">RM</span>
                            <input 
                              type="number"
                              value={refereeFees.rate_ric}
                              onChange={(e) => updateRefereeFees({ ...refereeFees, rate_ric: parseFloat(e.target.value) || 0 })}
                              className="w-full bg-ink border border-line rounded-lg py-1.5 pl-8 pr-2 text-xs font-mono font-bold text-text focus:outline-none focus:border-gold"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-line/20 pt-3">
                      <div className="text-[9px] text-text-dim uppercase tracking-wider font-bold mb-1.5">Virtual Taekwondo Officials</div>
                      <div className="grid grid-cols-3 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-1">Game Master</label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-2 text-text-dim/60 text-xs font-mono">RM</span>
                            <input 
                              type="number"
                              value={refereeFees.rate_game_master}
                              onChange={(e) => updateRefereeFees({ ...refereeFees, rate_game_master: parseFloat(e.target.value) || 0 })}
                              className="w-full bg-ink border border-line rounded-lg py-1.5 pl-8 pr-2 text-xs font-mono font-bold text-text focus:outline-none focus:border-gold"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-1">Technical Operator</label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-2 text-text-dim/60 text-xs font-mono">RM</span>
                            <input 
                              type="number"
                              value={refereeFees.rate_technical_operator}
                              onChange={(e) => updateRefereeFees({ ...refereeFees, rate_technical_operator: parseFloat(e.target.value) || 0 })}
                              className="w-full bg-ink border border-line rounded-lg py-1.5 pl-8 pr-2 text-xs font-mono font-bold text-text focus:outline-none focus:border-gold"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-1">Virtual Referee</label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-2 text-text-dim/60 text-xs font-mono">RM</span>
                            <input 
                              type="number"
                              value={refereeFees.rate_virtual_referee}
                              onChange={(e) => updateRefereeFees({ ...refereeFees, rate_virtual_referee: parseFloat(e.target.value) || 0 })}
                              className="w-full bg-ink border border-line rounded-lg py-1.5 pl-8 pr-2 text-xs font-mono font-bold text-text focus:outline-none focus:border-gold"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-bold text-gold uppercase tracking-wider mb-2">3. Supplemental Officiating Pay & Actions</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-1">Overtime Fee</label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-2 text-text-dim/60 text-xs font-mono">RM</span>
                        <input 
                          type="number"
                          value={refereeFees.overtime}
                          onChange={(e) => updateRefereeFees({ ...refereeFees, overtime: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-ink border border-line rounded-lg py-1.5 pl-8 pr-2 text-xs font-mono font-bold text-text focus:outline-none focus:border-gold"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-1">Others Fee</label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-2 text-text-dim/60 text-xs font-mono">RM</span>
                        <input 
                          type="number"
                          value={refereeFees.others}
                          onChange={(e) => updateRefereeFees({ ...refereeFees, others: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-ink border border-line rounded-lg py-1.5 pl-8 pr-2 text-xs font-mono font-bold text-text focus:outline-none focus:border-gold"
                        />
                      </div>
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={() => {
                          updateRefereeFees({
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
                            rate_game_master: 150,
                            rate_technical_operator: 125,
                            rate_virtual_referee: 100,
                            default_accommodation_details: "",
                            default_accommodation_maps_link: "",
                          });
                          triggerMsg('Fees setup reset to standard Malaysian Taekwondo defaults', 'ok');
                        }}
                        className="w-full bg-ink hover:bg-line border border-line text-text text-[10px] font-bold py-2 rounded-lg transition cursor-pointer text-center"
                      >
                        Reset Defaults
                      </button>
                    </div>
                  </div>
                </div>

                {/* Section 4: Default Accommodation */}
                <div className="border-t border-line/40 pt-4">
                  <h4 className="text-[10px] font-bold text-gold uppercase tracking-wider mb-2">4. Default Global Lodging & Accommodation</h4>
                  <p className="text-[10px] text-text-dim mb-3">Set the default hotel and Google Maps location. This applies to all referees requesting accommodation, unless overridden on their specific profile.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-1">Accommodation Details</label>
                      <textarea
                        value={refereeFees.default_accommodation_details || ''}
                        onChange={(e) => updateRefereeFees({ ...refereeFees, default_accommodation_details: e.target.value })}
                        placeholder="e.g. Hotel Grand Chancellor, Room 402. Check-in on 12th Oct 2 PM."
                        className="w-full bg-ink border border-line rounded-lg py-2 px-3 text-xs text-text focus:outline-none focus:border-gold resize-none h-20"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-1">Google Maps Link</label>
                      <input
                        type="url"
                        value={refereeFees.default_accommodation_maps_link || ''}
                        onChange={(e) => updateRefereeFees({ ...refereeFees, default_accommodation_maps_link: e.target.value })}
                        placeholder="https://maps.app.goo.gl/..."
                        className="w-full bg-ink border border-line rounded-lg py-2 px-3 text-xs text-text focus:outline-none focus:border-gold mb-2"
                      />
                      <div className="text-[9px] text-text-dim/80">
                        Paste a valid Google Maps URL so referees can find the lodging easily.
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Referee Account Database & Tournament Assignment */}
            <div className="bg-surface border border-line p-5 rounded-2xl shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center space-x-2">
                  <UserPlus className="w-5 h-5 text-gold" />
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-text">Referee Roles Configuration</h3>
                    <p className="text-[11px] text-text-dim mt-0.5">Assign special roles to referees that have joined this tournament</p>
                  </div>
                </div>
                <div className="flex bg-ink/50 p-0.5 rounded-lg border border-line/40">
                  <button
                    type="button"
                    onClick={() => {
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
                    }}
                    className={`text-[10px] font-bold px-3 py-1.5 rounded-md transition cursor-pointer ${
                      !orgEditingRefereeNric ? 'bg-gold text-ink' : 'text-text-dim hover:text-text'
                    }`}
                  >
                    Assign Special Roles
                  </button>
                  {orgEditingRefereeNric && (
                    <span className="text-[10px] font-bold px-3 py-1.5 rounded-md bg-gold text-ink animate-fade-in">
                      Editing Account ({orgEditingRefereeNric})
                    </span>
                  )}
                </div>
              </div>

              {/* Sub-panels */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Panel 1: Search & Assign Existing Accounts */}
                <div className="lg:col-span-5 space-y-4 border-r border-line/30 pr-0 lg:pr-6">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gold">Configure Special Roles</h4>
                    <p className="text-[10px] text-text-dim">Search tournament referees and configure their roles.</p>
                  </div>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-text-dim/60" />
                    <input 
                      type="text"
                      placeholder="Search referee by name or NRIC..."
                      value={orgAssignSearch}
                      onChange={(e) => setOrgAssignSearch(e.target.value)}
                      className="w-full bg-ink/40 border border-line rounded-xl py-1.5 pl-9 pr-3 text-xs text-text focus:outline-none focus:border-gold"
                    />
                  </div>

                  <div className="bg-ink/30 border border-line rounded-xl p-2 max-h-52 overflow-y-auto space-y-1.5">
                    {(() => {
                      const queryClean = orgAssignSearch.toLowerCase().trim();
                      const filtered = referees.filter(a => {
                        const nameMatch = a.fullName.toLowerCase().includes(queryClean);
                        const nricMatch = a.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().includes(queryClean.replace(/[^a-zA-Z0-9]/g, ''));
                        return nameMatch || nricMatch;
                      });

                      if (filtered.length === 0) {
                        return <div className="text-[11px] text-text-dim text-center py-4">No matching referees found.</div>;
                      }

                      return filtered.map(a => {
                        return (
                          <div 
                            key={a.nric} 
                            className="flex items-center justify-between p-2 rounded-lg bg-surface/50 border border-line/40 hover:border-gold/30 transition text-xs"
                          >
                            <div className="space-y-0.5 min-w-0 pr-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-text truncate">{a.fullName}</span>
                                <span className="text-[8px] px-1 bg-ink/80 border border-line rounded text-text-dim font-mono">{a.kyorugiStatus}</span>
                              </div>
                              <div className="text-[9px] text-text-dim flex items-center gap-2 font-mono">
                                <span>{a.nric}</span>
                                {a.specialRole && a.specialRole !== 'None' && (
                                  <span className="text-[8px] bg-gold/10 text-gold px-1 rounded uppercase font-bold">
                                    {formatSpecialRole(a.specialRole)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleOrgEditRefereeAccount(a)}
                                className="text-[10px] text-text hover:text-gold border border-line hover:bg-line/40 px-2 py-1 rounded font-bold cursor-pointer transition"
                              >
                                Edit Role
                              </button>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Panel 2: Assign Special Role */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gold">
                        {orgEditingRefereeNric ? `Assign Role: ${orgRefName}` : 'Assign Special Role'}
                      </h4>
                      <p className="text-[10px] text-text-dim">
                        {orgEditingRefereeNric 
                          ? 'Select a special appointed role for this referee.' 
                          : 'Select a referee from the list to assign a special role.'}
                      </p>
                    </div>
                    {orgEditingRefereeNric && (
                      <button
                        type="button"
                        onClick={() => {
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
                        }}
                        className="text-[10px] text-hong hover:underline font-bold cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>

                  {orgEditingRefereeNric ? (
                    <form onSubmit={handleOrgSaveRefereeAccount} className="grid grid-cols-1 gap-3 text-xs bg-ink/30 border border-line rounded-xl p-4">
                      <div>
                        <label className="block text-[10px] font-bold text-text-dim uppercase tracking-wider mb-2">Special Appointed Role</label>
                        <select
                          value={orgRefSpecialRole}
                          onChange={(e) => setOrgRefSpecialRole(e.target.value as any)}
                          className="w-full bg-ink border border-line focus:border-gold rounded-xl px-3 py-2.5 text-text outline-none cursor-pointer"
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

                      <div className="pt-2">
                        <button
                          type="submit"
                          className="w-full bg-gold hover:bg-gold/90 text-ink text-xs font-bold py-2.5 rounded-xl transition cursor-pointer"
                        >
                          Update Special Role
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 px-4 bg-ink/20 border border-line/40 border-dashed rounded-xl text-center">
                      <p className="text-xs text-text-dim font-medium max-w-[200px]">
                        Click "Edit Profile" on an assigned referee to configure their special role.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Stats row */}
            {(() => {
              let totalRefereesCount = referees.length;
              let totalAllowanceAmount = 0;
              let totalAccommodationCount = 0;
              
              referees.forEach(r => {
                const allowance = getRefereeAllowance(r, refereeFees);
                totalAllowanceAmount += allowance.totalPay;
                if (r.accommodation === 'Yes') {
                  totalAccommodationCount++;
                }
              });
              
              return (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-surface border border-line p-5 rounded-2xl shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-text-dim">Total Registered Referees</span>
                      <Users className="w-5 h-5 text-gold" />
                    </div>
                    <h3 className="text-2xl font-bold mt-2 text-text">{totalRefereesCount}</h3>
                    <p className="text-[10px] text-text-dim mt-1">Qualified officials registered for this tournament</p>
                  </div>

                  <div className="bg-surface border border-line p-5 rounded-2xl shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-text-dim">Total Referee Allowance Budget</span>
                      <Scale className="w-5 h-5 text-gold" />
                    </div>
                    <h3 className="text-2xl font-bold mt-2 text-gold">RM {totalAllowanceAmount.toFixed(2)}</h3>
                    <p className="text-[10px] text-text-dim mt-1">Sum of base duties + custom mileage bracket + overtime + extras</p>
                  </div>

                  <div className="bg-surface border border-line p-5 rounded-2xl shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-text-dim">Accommodations Needed</span>
                      <Home className="w-5 h-5 text-gold" />
                    </div>
                    <h3 className="text-2xl font-bold mt-2 text-text">{totalAccommodationCount}</h3>
                    <p className="text-[10px] text-text-dim mt-1">Referees requesting organizer-provided lodging</p>
                  </div>
                </div>
              );
            })()}

            {/* Main panel */}
            <div className="bg-surface border border-line rounded-2xl shadow-sm overflow-hidden">
              <div className="p-5 border-b border-line bg-surface-2/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-text flex items-center gap-2">
                    <Scale className="w-4 h-4 text-gold" />
                    Referee Officiating & Allowance Ledger
                  </h3>
                  <p className="text-xs text-text-dim mt-0.5">Calculate individual duty payouts, accommodation allocations, and banking info</p>
                </div>
                
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => handleOpenOrganizerAddReferee()}
                    className="bg-ink hover:bg-surface-2 text-gold border border-gold/30 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition cursor-pointer self-stretch sm:self-auto justify-center"
                  >
                    <Plus className="w-4 h-4" />
                    Add Referee
                  </button>
                  <button
                    onClick={() => {
                      if (referees.length === 0) {
                      triggerMsg('No referee record available to export', 'error');
                      return;
                    }
                    // Excel generation using xlsx
                    const headers = [
                      "Name", "NRIC", "Phone", "Club", "Location", "Distance(KM)", 
                      "Kyorugi", "Poomsae", "Special Role", "Accommodation", "Bank Name", "Bank Account", 
                      "Car Plate", "Days", "Kyorugi Days", "Poomsae Days", "Duty Explanation", "Base Duty Pay(RM)", "Travel Pay(RM)", "Overtime Pay(RM)", "Others Pay(RM)", "Total Allowance(RM)"
                    ];
                    const rows = referees.map(r => {
                      const allowance = getRefereeAllowance(r, refereeFees);
                      
                      return [
                        r.fullName,
                        r.nric,
                        r.phone,
                        r.clubName,
                        r.residentialLocation,
                        r.distance,
                        r.kyorugiStatus,
                        r.poomsaeStatus,
                        r.specialRole || 'None',
                        r.accommodation,
                        r.bankName || 'N/A',
                        r.bankAccount || 'N/A',
                        r.carPlate || 'N/A',
                        allowance.days,
                        allowance.kyorugiDays,
                        allowance.poomsaeDays,
                        allowance.splitExplanation,
                        allowance.baseDutyPay,
                        allowance.travelPay,
                        allowance.otPay,
                        allowance.othersPay,
                        allowance.totalPay
                      ];
                    });
                    
                    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, "Referee Ledger");
                    XLSX.writeFile(wb, `REFEREE_ALLOWANCE_LEDGER_${activeComp.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`);
                    
                    triggerMsg('Allowance ledger exported to Excel successfully!', 'ok');
                  }}
                  className="bg-gold hover:opacity-90 text-ink font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition cursor-pointer self-stretch sm:self-auto justify-center"
                >
                  <Download className="w-4 h-4" />
                  Export Ledger to Excel
                </button>
                </div>
              </div>

              {referees.length === 0 ? (
                <div className="p-12 text-center text-xs text-text-dim space-y-2">
                  <Scale className="w-12 h-12 text-gold/30 mx-auto" />
                  <p className="font-semibold text-text">No Referees Registered</p>
                  <p className="max-w-md mx-auto">No referees have registered for this tournament yet. Encourage officials to sign up through the Referee portal, or add them manually using the button above.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-surface-2 border-b border-line text-[10px] font-bold text-text-dim uppercase tracking-wider">
                        <th className="py-3 px-4">Referee / Club</th>
                        <th className="py-3 px-4">NRIC / Pass / Phone</th>
                        <th className="py-3 px-4 text-center">Status (K / P)</th>
                        <th className="py-3 px-4 text-center">Accommodation</th>
                        <th className="py-3 px-4 text-right">Distance (Go/Ret)</th>
                        <th className="py-3 px-4 text-center">Officiating Days</th>
                        <th className="py-3 px-4">Bank & Car Plate</th>
                        <th className="py-3 px-4 text-right">Payout Total</th>
                        <th className="py-3 px-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/40">
                      {referees.map(r => {
                        const allowance = getRefereeAllowance(r, refereeFees);
                        const { baseDutyPay, travelPay, otPay, othersPay, totalPay, dailyRate, days, isSplit, splitExplanation, kyorugiDays, poomsaeDays, higherStatus } = allowance;
                        
                        return (
                          <tr key={r.id} className="hover:bg-surface-2/30 transition-colors">
                             <td className="py-3 px-4">
                               <div className="flex items-center space-x-2.5">
                                 <div className="w-8 h-10 rounded bg-slate-950 overflow-hidden flex items-center justify-center border border-line shrink-0">
                                   {r.photo ? (
                                     <img src={r.photo} alt={r.fullName} className="w-full h-full object-cover" />
                                   ) : (
                                     <User className="w-4 h-4 text-text-dim/60" />
                                   )}
                                 </div>
                                 <div>
                                   <div className="font-bold text-text flex items-center gap-1.5">
                                     {r.fullName}
                                     {r.specialRole && r.specialRole !== 'None' && (
                                       <span className="bg-gold text-ink text-[9px] px-1.5 py-0.5 rounded-md font-bold tracking-wider uppercase">
                                         {formatSpecialRole(r.specialRole)}
                                       </span>
                                     )}
                                   </div>
                                   <div className="text-[10px] text-text-dim italic mt-0.5">{r.clubName}</div>
                                 </div>
                               </div>
                             </td>
                            <td className="py-3 px-4 font-mono text-[11px] text-text-dim">
                              <div>{r.nric}</div>
                              <div className="mt-0.5 text-gold font-bold">PW: {r.password || 'N/A'}</div>
                              <div className="mt-0.5 text-text">{r.phone}</div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="inline-block bg-gold/10 text-gold px-2 py-0.5 rounded text-[9px] font-bold">
                                K:{r.kyorugiStatus} | P:{r.poomsaeStatus}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex flex-col items-center gap-1.5">
                                <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold ${
                                  r.accommodation === 'Yes' 
                                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                                    : 'bg-text-dim/10 text-text-dim'
                                }`}>
                                  {r.accommodation === 'Yes' ? 'LODGING REQ' : 'No Lodge'}
                                </span>
                                
                                {((r.accommodationDetails || refereeFees.default_accommodation_details) && r.accommodation === 'Yes') && (
                                  <span className="text-[10px] text-text-dim font-medium max-w-[120px] truncate block" title={r.accommodationDetails || refereeFees.default_accommodation_details}>
                                    🏨 {r.accommodationDetails || refereeFees.default_accommodation_details}
                                  </span>
                                )}
                                
                                {((r.accommodationMapsLink || refereeFees.default_accommodation_maps_link) && r.accommodation === 'Yes') && (
                                  <a 
                                    href={r.accommodationMapsLink || refereeFees.default_accommodation_maps_link} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="text-[9px] text-gold hover:underline flex items-center gap-0.5 font-semibold"
                                  >
                                    <MapPin className="w-2.5 h-2.5" />
                                    View Map
                                  </a>
                                )}
                                
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingAccReferee(r);
                                    setEditAccDetails(r.accommodationDetails || '');
                                    setEditAccMapsLink(r.accommodationMapsLink || '');
                                  }}
                                  className="text-[9px] text-gold hover:text-yellow-400 font-bold border border-gold/20 hover:border-gold/50 bg-gold/5 hover:bg-gold/10 px-1.5 py-0.5 rounded transition cursor-pointer flex items-center gap-1"
                                >
                                  <Edit className="w-2.5 h-2.5" />
                                  <span>Details</span>
                                </button>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-text">
                              {editingDistanceRefereeId === r.id ? (
                                <div className="flex flex-col items-end gap-1 animate-fade-in">
                                  <div className="flex items-center gap-1.5 justify-end">
                                    <input
                                      type="number"
                                      autoFocus
                                      value={editingDistanceValue}
                                      onChange={(e) => setEditingDistanceValue(e.target.value)}
                                      onKeyDown={async (e) => {
                                        if (e.key === 'Enter') {
                                          const parsed = parseFloat(editingDistanceValue);
                                          if (isNaN(parsed) || parsed < 0) {
                                            triggerMsg('Please enter a valid distance', 'error');
                                            return;
                                          }
                                          await saveRefereeToFirestore({ ...r, distance: parsed });
                                          setEditingDistanceRefereeId(null);
                                          triggerMsg('Distance updated successfully', 'ok');
                                        } else if (e.key === 'Escape') {
                                          setEditingDistanceRefereeId(null);
                                        }
                                      }}
                                      className="w-16 bg-slate-900 text-right border border-line text-[11px] rounded px-1.5 py-0.5 text-text focus:outline-none focus:border-gold font-bold font-mono"
                                    />
                                    <span className="text-[10px] text-text-dim">KM</span>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setEditingDistanceRefereeId(null)}
                                      className="text-[9px] font-bold text-hong hover:underline cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        const parsed = parseFloat(editingDistanceValue);
                                        if (isNaN(parsed) || parsed < 0) {
                                          triggerMsg('Please enter a valid distance', 'error');
                                          return;
                                        }
                                        await saveRefereeToFirestore({ ...r, distance: parsed });
                                        setEditingDistanceRefereeId(null);
                                        triggerMsg('Distance updated successfully', 'ok');
                                      }}
                                      className="text-[9px] font-bold text-gold hover:underline cursor-pointer"
                                    >
                                      Save
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="group relative">
                                  <div className="flex items-center justify-end gap-1">
                                    <span className="font-bold">{r.distance} KM</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingDistanceRefereeId(r.id);
                                        setEditingDistanceValue(r.distance?.toString() || '0');
                                      }}
                                      className="text-text-dim hover:text-gold opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-0.5 cursor-pointer rounded hover:bg-surface-2"
                                      title="Edit Distance"
                                    >
                                      <Edit className="w-3 h-3" />
                                    </button>
                                  </div>
                                  <div className="text-[10px] text-text-dim font-normal">
                                    RM {travelPay.toFixed(2)}
                                    {r.accommodation === 'No' && (
                                      <span className="text-[9px] text-gold block font-semibold">(Daily Travel RM {refereeFees.km_0_50})</span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {isSplit ? (
                                <div className="space-y-1.5 max-w-[145px] mx-auto bg-ink/30 border border-line/40 rounded-xl p-1.5">
                                  <div className="flex items-center justify-between gap-1 text-[10px]">
                                    <span className="font-semibold text-text-dim">Kyorugi:</span>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button 
                                        type="button"
                                        onClick={async () => {
                                          const kDays = kyorugiDays;
                                          const vDays = r.virtualDays || 0;
                                          await saveRefereeToFirestore({ ...r, kyorugiDays: Math.max(0, kDays - 1), officiatingDays: Math.max(0, kDays - 1) + poomsaeDays + vDays });
                                        }}
                                        className="w-4 h-4 bg-ink border border-line text-text hover:bg-line rounded flex items-center justify-center font-bold text-[9px]"
                                      >
                                        -
                                      </button>
                                      <span className="font-bold font-mono px-1 text-text text-[10px]">{kyorugiDays}d</span>
                                      <button 
                                        type="button"
                                        onClick={async () => {
                                          const kDays = kyorugiDays;
                                          const vDays = r.virtualDays || 0;
                                          await saveRefereeToFirestore({ ...r, kyorugiDays: kDays + 1, officiatingDays: kDays + 1 + poomsaeDays + vDays });
                                        }}
                                        className="w-4 h-4 bg-ink border border-line text-text hover:bg-line rounded flex items-center justify-center font-bold text-[9px]"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center justify-between gap-1 text-[10px]">
                                    <span className="font-semibold text-text-dim">Poomsae:</span>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button 
                                        type="button"
                                        onClick={async () => {
                                          const pDays = poomsaeDays;
                                          const vDays = r.virtualDays || 0;
                                          await saveRefereeToFirestore({ ...r, poomsaeDays: Math.max(0, pDays - 1), officiatingDays: kyorugiDays + Math.max(0, pDays - 1) + vDays });
                                        }}
                                        className="w-4 h-4 bg-ink border border-line text-text hover:bg-line rounded flex items-center justify-center font-bold text-[9px]"
                                      >
                                        -
                                      </button>
                                      <span className="font-bold font-mono px-1 text-text text-[10px]">{poomsaeDays}d</span>
                                      <button 
                                        type="button"
                                        onClick={async () => {
                                          const pDays = poomsaeDays;
                                          const vDays = r.virtualDays || 0;
                                          await saveRefereeToFirestore({ ...r, poomsaeDays: pDays + 1, officiatingDays: kyorugiDays + pDays + 1 + vDays });
                                        }}
                                        className="w-4 h-4 bg-ink border border-line text-text hover:bg-line rounded flex items-center justify-center font-bold text-[9px]"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between gap-1 text-[10px]">
                                    <span className="font-semibold text-text-dim">Virtual:</span>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button 
                                        type="button"
                                        onClick={async () => {
                                          const vDays = r.virtualDays || 0;
                                          await saveRefereeToFirestore({ ...r, virtualDays: Math.max(0, vDays - 1), officiatingDays: kyorugiDays + poomsaeDays + Math.max(0, vDays - 1) });
                                        }}
                                        className="w-4 h-4 bg-ink border border-line text-text hover:bg-line rounded flex items-center justify-center font-bold text-[9px]"
                                      >
                                        -
                                      </button>
                                      <span className="font-bold font-mono px-1 text-text text-[10px]">{r.virtualDays || 0}d</span>
                                      <button 
                                        type="button"
                                        onClick={async () => {
                                          const vDays = r.virtualDays || 0;
                                          await saveRefereeToFirestore({ ...r, virtualDays: vDays + 1, officiatingDays: kyorugiDays + poomsaeDays + vDays + 1 });
                                        }}
                                        className="w-4 h-4 bg-ink border border-line text-text hover:bg-line rounded flex items-center justify-center font-bold text-[9px]"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>
 
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await saveRefereeToFirestore({ 
                                        ...r, 
                                        kyorugiDays: 0, 
                                        poomsaeDays: 0, 
                                        virtualDays: 0,
                                        officiatingDays: Math.max(1, kyorugiDays + poomsaeDays + (r.virtualDays || 0)) 
                                      });
                                    }}
                                    className="w-full text-center text-[9px] text-hong hover:underline pt-0.5"
                                  >
                                    Merge Standard
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <div className="flex items-center justify-center gap-1 max-w-[90px] mx-auto">
                                    <button 
                                      type="button"
                                      onClick={async () => {
                                        if (days <= 1) return;
                                        await saveRefereeToFirestore({ ...r, officiatingDays: days - 1 });
                                      }}
                                      className="w-5 h-5 bg-ink border border-line text-text hover:bg-line rounded flex items-center justify-center font-bold text-xs"
                                    >
                                      -
                                    </button>
                                    <span className="font-bold font-mono px-2 text-text text-xs">{days}</span>
                                    <button 
                                      type="button"
                                      onClick={async () => {
                                        await saveRefereeToFirestore({ ...r, officiatingDays: days + 1 });
                                      }}
                                      className="w-5 h-5 bg-ink border border-line text-text hover:bg-line rounded flex items-center justify-center font-bold text-xs"
                                    >
                                      +
                                    </button>
                                  </div>
                                  
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await saveRefereeToFirestore({
                                        ...r,
                                        kyorugiDays: days,
                                        poomsaeDays: 0
                                      });
                                    }}
                                    className="text-[9px] text-gold hover:underline font-semibold block mx-auto pt-0.5"
                                  >
                                    Split Days
                                  </button>
                                </div>
                              )}
                              
                              <div className="flex flex-col items-center gap-1.5 mt-2">
                                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                  <input 
                                    type="checkbox"
                                    checked={!!r.includeOvertime}
                                    onChange={async (e) => {
                                      await saveRefereeToFirestore({ ...r, includeOvertime: e.target.checked });
                                    }}
                                    className="accent-gold rounded text-ink cursor-pointer w-3 h-3"
                                  />
                                  <span className="text-[10px] text-text-dim">Overtime</span>
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                  <input 
                                    type="checkbox"
                                    checked={!!r.includeOthers}
                                    onChange={async (e) => {
                                      await saveRefereeToFirestore({ ...r, includeOthers: e.target.checked });
                                    }}
                                    className="accent-gold rounded text-ink cursor-pointer w-3 h-3"
                                  />
                                  <span className="text-[10px] text-text-dim">Others</span>
                                </label>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              {r.bankName ? (
                                <div className="text-text-dim text-[11px]">
                                  <span className="font-semibold text-text">{r.bankName}</span>: {r.bankAccount}
                                </div>
                              ) : (
                                <span className="text-hong italic text-[10px]">No bank details</span>
                              )}
                              <div className="text-[10px] text-gold font-bold mt-0.5 uppercase">Plate: {r.carPlate || 'N/A'}</div>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-gold text-sm">
                              RM {totalPay.toFixed(2)}
                              <div className="text-[9px] text-text-dim font-normal leading-relaxed text-right">
                                {isSplit ? (
                                  <span className="block text-[8px] text-text-dim font-sans">{splitExplanation}</span>
                                ) : (
                                  <span>RM {dailyRate} * {days}d</span>
                                )}
                                <span className="block text-[9px] text-text-dim mt-0.5">
                                  + RM {travelPay.toFixed(2)} travel {r.accommodation === 'No' ? `(RM ${refereeFees.km_0_50} daily)` : ''}
                                </span>
                                {r.includeOvertime && <span className="block text-[8px] text-gold/90 font-medium">+ RM {refereeFees.overtime} OT</span>}
                                {r.includeOthers && <span className="block text-[8px] text-gold/90 font-medium">+ RM {refereeFees.others} Others</span>}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              {confirmDeleteRefereeId === r.id ? (
                                <div className="flex items-center justify-center gap-1.5 animate-fade-in">
                                  <button
                                    onClick={async () => {
                                      await deleteRefereeFromFirestore(r.id);
                                      setConfirmDeleteRefereeId(null);
                                      triggerMsg('Referee registration deleted', 'ok');
                                    }}
                                    className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-[10px] font-bold cursor-pointer"
                                  >
                                    Yes
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteRefereeId(null)}
                                    className="bg-surface border border-line text-text px-2 py-1 rounded text-[10px] cursor-pointer"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmDeleteRefereeId(r.id)}
                                  className="text-hong hover:text-white border border-hong/20 hover:bg-hong/90 px-2.5 py-1 rounded transition text-[10px] font-bold cursor-pointer"
                                >
                                  Remove
                                </button>
                              )}
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

          </div>
        )}

        {/* REFEREE DASHBOARD */}
        {screen === 'refereeDashboard' && activeReferee && (
          <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-surface p-6 rounded-2xl border border-line shadow-sm gap-4">
              <div>
                <span className="bg-gold/10 text-gold px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                  Official Referee Terminal
                </span>
                <h2 className="text-xl font-bold uppercase tracking-wider text-text mt-1.5 flex items-center gap-2">
                  <Scale className="w-5 h-5 text-gold" />
                  Welcome, Ref. {activeReferee.fullName}
                </h2>
                <p className="text-sm font-semibold text-gold mt-0.5">{activeComp?.name || 'Tournament Hub'}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setRefereeFullName(activeReferee.fullName || '');
                    setRefereeNric(activeReferee.nric || '');
                    setRefereePassword(activeReferee.password || '');
                    setRefereePhone(activeReferee.phone || '');
                    setRefereeClubName(activeReferee.clubName || '');
                    setRefereeResidential(activeReferee.residentialLocation || '');
                    setRefereeDistance(activeReferee.distance?.toString() || '');
                    setRefereeBankName(activeReferee.bankName || '');
                    setRefereeBankAccount(activeReferee.bankAccount || '');
                    setRefereeAccommodation(activeReferee.accommodation as 'Yes' | 'No' || 'No');
                    setRefereeKyorugiStatus(activeReferee.kyorugiStatus as any || 'TR');
                    setRefereePoomsaeStatus(activeReferee.poomsaeStatus as any || 'TR');
                    setRefereeCarPlate(activeReferee.carPlate || '');
                    setRefereeSpecialRole(activeReferee.specialRole as any || 'None');
                    setShowRefereeEditProfile(true);
                  }}
                  className="bg-surface hover:bg-surface-2 border border-line text-text px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer"
                >
                  <User className="w-4 h-4" />
                  Edit Profile
                </button>
                <button
                  onClick={logout}
                  className="bg-Hong hover:opacity-90 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  Logout Terminal
                </button>
              </div>
            </div>

            {/* Tournament Selector & Hub */}
            <div className="bg-surface p-5 rounded-2xl border border-line shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-text flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gold" />
                    Tournament Hub
                  </h3>
                  <p className="text-xs text-text-dim mt-0.5">Select a tournament to view your credentials, or join active ones with a single click using your account profile details!</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {competitions.filter(c => c.isActive !== false).map((comp) => {
                  const isJoined = referees.some(r => r.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === user?.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() && r.compId === comp.id);
                  const isSelected = comp.id === compId;
                  
                  return (
                    <div 
                      key={comp.id} 
                      className={`p-3.5 rounded-xl border transition-all flex justify-between items-center ${
                        isSelected 
                          ? 'bg-gold/5 border-gold shadow-sm' 
                          : 'bg-ink/50 border-line hover:border-text-dim/40'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <h4 className="text-xs font-bold text-text truncate uppercase">{comp.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                            isJoined 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            {isJoined ? 'Joined' : 'Available'}
                          </span>
                          <span className="text-[10px] text-text-dim truncate">{formatDateRange(comp.date, comp.endDate)} | {comp.venue}</span>
                        </div>
                      </div>
                      
                      <div className="shrink-0 flex gap-2">
                        {isJoined ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                const matched = referees.find(r => r.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === user?.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() && r.compId === comp.id);
                                if (matched) {
                                  setCompId(comp.id);
                                  setActiveReferee(matched);
                                  triggerMsg(`Switched to ${comp.name} credentials`, 'ok');
                                }
                              }}
                              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition ${
                                isSelected 
                                  ? 'bg-gold text-ink' 
                                  : 'bg-surface border border-line text-text hover:bg-surface-2'
                              }`}
                            >
                              {isSelected ? 'Selected' : 'Select'}
                            </button>
                            <button
                              onClick={async () => {
                                const matched = referees.find(r => r.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === user?.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() && r.compId === comp.id);
                                if (matched) {
                                  try {
                                    await deleteRefereeFromFirestore(matched.id);
                                    triggerMsg(`Cancelled registration for ${comp.name}`, 'ok');
                                    if (isSelected) {
                                      setCompId(null);
                                    }
                                  } catch (err) {
                                    console.error(err);
                                    triggerMsg('Failed to cancel registration', 'error');
                                  }
                                }
                              }}
                              className="px-2 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition text-hong border border-line bg-surface hover:bg-hong/10"
                              title="Cancel Join"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              const account = refereeAccounts.find(a => a.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === user?.replace(/[^a-zA-Z0-9]/g, '').toLowerCase());
                              if (!account) {
                                triggerMsg("Could not find your referee account profile.", "error");
                                return;
                              }
                              setJoiningComp(comp);
                              setJoiningDistance(account.distance?.toString() || '');
                              setJoiningAccommodation(account.accommodation || 'No');
                              const kDays = account.kyorugiDays || 0;
                              const pDays = account.poomsaeDays || 0;
                              const vDays = account.virtualDays || 0;
                              const total = kDays + pDays + vDays;
                              setJoiningKyorugiDays(total > 0 ? kDays.toString() : '1');
                              setJoiningPoomsaeDays(total > 0 ? pDays.toString() : '0');
                              setJoiningVirtualDays(total > 0 ? vDays.toString() : '0');
                            }}
                            className="bg-gold hover:opacity-90 text-ink px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition flex items-center gap-1"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            Join
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {competitions.filter(c => c.isActive !== false).length === 0 && (
                  <p className="text-xs text-text-dim col-span-2 text-center py-4">No active tournaments currently available.</p>
                )}
              </div>
            </div>

            {activeReferee.id.startsWith('TEMP_') ? (
              <div className="bg-surface p-8 rounded-2xl border border-line shadow-sm text-center max-w-xl mx-auto space-y-4 animate-fade-in">
                <Scale className="w-12 h-12 text-gold mx-auto animate-bounce" />
                <h3 className="text-base font-bold uppercase tracking-wider text-text">Tournament Officiating Credentials</h3>
                <p className="text-xs text-text-dim leading-relaxed">
                  {activeComp ? (
                    <>You are logged into your Referee Account, but you are not registered to officiate for <strong>{activeComp.name}</strong> yet. Click below to register instantly using your saved credentials profile!</>
                  ) : (
                    <>You are logged into your Referee Account. Select a tournament from the hub above to view your credentials and officiating details.</>
                  )}
                </p>
                <div className="pt-2">
                  {activeComp && (
                    <button
                      onClick={async () => {
                        const account = refereeAccounts.find(a => a.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === user?.replace(/[^a-zA-Z0-9]/g, '').toLowerCase());
                        if (!account) {
                          triggerMsg("Could not find your referee account profile.", "error");
                          return;
                        }
                        const newRef: Referee = {
                          ...account,
                          id: `${activeComp.id}_${account.nric.replace(/[^a-zA-Z0-9]/g, '')}`,
                          compId: activeComp.id,
                          createdAt: new Date().toISOString()
                        };
                        await saveRefereeToFirestore(newRef);
                        setActiveReferee(newRef);
                        triggerMsg(`Successfully registered for ${activeComp.name}!`, "ok");
                      }}
                      className="bg-gold hover:opacity-90 text-ink px-5 py-2.5 rounded-xl text-xs font-bold shadow-md hover:shadow transition inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4" />
                      Join {activeComp.name} Now
                    </button>
                  )}
                </div>
              </div>
            ) : !activeComp ? (
              <div className="bg-surface p-8 rounded-2xl border border-line shadow-sm text-center max-w-xl mx-auto space-y-4 animate-fade-in">
                <Scale className="w-12 h-12 text-gold/30 mx-auto" />
                <h3 className="text-base font-bold uppercase tracking-wider text-text">Select a Tournament</h3>
                <p className="text-xs text-text-dim leading-relaxed">
                  Please select a tournament from the hub above to view your credentials and officiating details.
                </p>
              </div>
            ) : (
              /* Main Grid */
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Officiating Pass Column */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-text-dim">Your Officiating Pass</h3>
                
                {/* Official Card Layout */}
                <div 
                  id={`referee-pass-${activeReferee.id}`}
                  className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 border-2 border-gold rounded-2xl p-5 shadow-lg text-center flex flex-col justify-between h-[445px] relative overflow-hidden"
                >
                  {/* Subtle decorative elements */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 rounded-full blur-2xl"></div>
                  <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-blue-500/5 rounded-full blur-xl"></div>
                  
                  {/* Card Header */}
                  <div>
                    <div className="flex justify-between items-start">
                      <Trophy className="w-6 h-6 text-gold" />
                      <span className="text-[9px] font-bold text-white bg-gold/20 border border-gold/30 px-2 py-0.5 rounded uppercase tracking-widest">
                        Official
                      </span>
                    </div>
                    <p className="text-[20px] leading-tight text-gold font-bold uppercase tracking-wider truncate px-2 mt-3">{activeComp.name}</p>
                  </div>

                  {/* Referee Portrait Photo */}
                  <div className="flex justify-center my-1.5">
                    <div className="w-20 h-25 bg-slate-950 rounded-xl border border-gold/30 flex items-center justify-center shrink-0 overflow-hidden shadow-inner relative">
                      {activeReferee.photo ? (
                        <img 
                          src={activeReferee.photo} 
                          alt={activeReferee.fullName} 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="text-center p-2">
                          <User className="w-8 h-8 text-white/30 mx-auto" />
                          <span className="text-[8px] text-white/20 uppercase tracking-widest mt-1 block">No Photo</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Referee Info */}
                  <div className="my-1.5">
                    <h3 className="text-base font-bold text-white uppercase tracking-wider font-display truncate px-2">{activeReferee.fullName}</h3>

                    {/* Wording "REFEREE" badge */}
                    <div className="mt-3">
                      <span className="text-sm font-black text-gold bg-gold/10 border border-gold/30 px-6 py-1 rounded-lg inline-block tracking-[0.2em] uppercase">
                        REFEREE
                      </span>
                    </div>
                  </div>

                  {/* QR / Footer */}
                  <div className="flex justify-between items-end border-t border-white/10 pt-3.5 bg-transparent">
                    <div className="text-left max-w-[70%]">
                      <div className="text-[8px] text-white/40 uppercase font-bold tracking-widest">{formatDateRange(activeComp.date, activeComp.endDate)}</div>
                      <div className="text-xs font-bold text-white uppercase truncate">{activeComp.venue}</div>
                    </div>
                    <div className="bg-white p-1 rounded-lg shrink-0">
                      <QRCodeSVG value={`REFEREE::${activeReferee.id}`} size={44} level="M" />
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    const el = document.getElementById(`referee-pass-${activeReferee.id}`);
                    if (el) {
                      triggerMsg('Generating Referee Pass PNG...', 'ok');
                      htmlToImage.toPng(el, { pixelRatio: 3 }).then(dataUrl => {
                        const link = document.createElement('a');
                        link.download = `REFEREE_PASS_${activeReferee.fullName.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
                        link.href = dataUrl;
                        link.click();
                      }).catch(err => {
                        console.error('Failed to generate pass image', err);
                        triggerMsg('Failed to export image.', 'error');
                      });
                    }
                  }}
                  className="w-full bg-surface hover:bg-surface-2 border border-line text-text font-bold py-2 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Download className="w-4 h-4 text-gold" />
                  Download Pass image
                </button>
              </div>

              {/* Status and Allowance Details */}
              <div className="md:col-span-2 space-y-6">
                
                {/* Section: Officiating Duty Info */}
                <div className="bg-surface border border-line rounded-2xl p-5 shadow-sm space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-text flex items-center gap-2">
                    <User className="w-4 h-4 text-gold" />
                    Officiating Registry Information
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-text-dim block mb-0.5">State / Club Name</span>
                      <span className="font-semibold text-text text-sm">{activeReferee.clubName}</span>
                    </div>
                    <div>
                      <span className="text-text-dim block mb-0.5">NRIC Number</span>
                      <span className="font-semibold text-text text-sm">{activeReferee.nric}</span>
                    </div>
                    <div>
                      <span className="text-text-dim block mb-0.5">Contact Phone</span>
                      <span className="font-semibold text-text text-sm">{activeReferee.phone}</span>
                    </div>
                    <div>
                      <span className="text-text-dim block mb-0.5">Residential Location</span>
                      <span className="font-semibold text-text text-sm">{activeReferee.residentialLocation}</span>
                    </div>
                    <div>
                      <span className="text-text-dim block mb-0.5">Go & Return Distance</span>
                      <span className="font-semibold text-text text-sm">{activeReferee.distance} KM</span>
                    </div>
                    <div className="sm:col-span-2 border-t border-line/20 pt-3 mt-1">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <span className="text-text-dim block mb-0.5 text-xs">Accommodation Option</span>
                          <span className="font-semibold text-gold text-sm">
                            {activeReferee.accommodation === 'Yes' ? 'Arranged by Organizer' : 'Self Arranged'}
                          </span>
                        </div>
                        {activeReferee.accommodation === 'Yes' && (
                          <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider self-start sm:self-auto">
                            LODGING REQUIRED
                          </span>
                        )}
                      </div>
                      
                      {((activeReferee.accommodationDetails || refereeFees.default_accommodation_details) || (activeReferee.accommodationMapsLink || refereeFees.default_accommodation_maps_link)) && activeReferee.accommodation === 'Yes' && (
                        <div className="bg-ink/30 border border-line/50 rounded-xl p-3.5 mt-2.5 space-y-2.5">
                          {(activeReferee.accommodationDetails || refereeFees.default_accommodation_details) && (
                            <div>
                              <span className="text-[10px] uppercase font-bold text-text-dim tracking-wider block mb-1">Assigned Lodging Details</span>
                              <p className="text-text font-medium text-xs leading-relaxed whitespace-pre-wrap">{activeReferee.accommodationDetails || refereeFees.default_accommodation_details}</p>
                            </div>
                          )}
                          
                          {(activeReferee.accommodationMapsLink || refereeFees.default_accommodation_maps_link) && (
                            <div>
                              <a 
                                href={activeReferee.accommodationMapsLink || refereeFees.default_accommodation_maps_link} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="inline-flex items-center gap-1.5 bg-gold hover:bg-yellow-400 text-ink font-bold px-3 py-1.5 rounded-lg text-xs transition shadow cursor-pointer mt-1"
                              >
                                <MapPin className="w-3.5 h-3.5" />
                                <span>Navigate via Google Maps</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="text-text-dim block mb-0.5">Bank Information</span>
                      <span className="font-semibold text-text text-sm">{activeReferee.bankName || 'N/A'} - {activeReferee.bankAccount || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-text-dim block mb-0.5">Car Plate / Parking Spot</span>
                      <span className="font-semibold text-text text-sm uppercase">{activeReferee.carPlate || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Section: Estimated Allowance Breakdown */}
                <div className="bg-surface border border-line rounded-2xl p-5 shadow-sm space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-text flex items-center gap-2">
                    <Scale className="w-4 h-4 text-gold" />
                    Officiating Allowance Breakdown
                  </h3>
                  
                  {(() => {
                    const allowance = getRefereeAllowance(activeReferee, refereeFees);
                    const { baseDutyPay, travelPay, otPay, othersPay, totalPay, dailyRate, days, isSplit, splitExplanation, kyorugiDays, poomsaeDays, virtualDays, kyorugiPay, poomsaePay, virtualPay, higherStatus } = allowance;
                    
                    return (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-xs pb-2 border-b border-line/60">
                          <div>
                            <span className="font-semibold text-text">Highest Ref Qualification</span>
                            <p className="text-[10px] text-text-dim">Kyorugi: {activeReferee.kyorugiStatus} | Poomsae: {activeReferee.poomsaeStatus}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="bg-gold/10 text-gold px-2.5 py-1 rounded-lg font-bold">{higherStatus} Qualification</span>
                            {activeReferee.specialRole && activeReferee.specialRole !== 'None' && (
                              <span className="bg-gold text-ink px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">
                                Appointed: {formatSpecialRole(activeReferee.specialRole)}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="space-y-2 text-xs">
                          {isSplit ? (
                            <div className="bg-ink/20 p-3 rounded-xl border border-line/40 space-y-1.5 text-text-dim mb-3">
                              <span className="font-bold text-text-dim text-[10px] uppercase block mb-1">Split Discipline Days:</span>
                              {kyorugiDays > 0 && (
                                <div className="flex justify-between">
                                  <span>Kyorugi Officiating ({kyorugiDays} {kyorugiDays === 1 ? 'Day' : 'Days'} as {activeReferee.kyorugiStatus})</span>
                                  <span className="text-text font-semibold">RM {kyorugiPay.toFixed(2)}</span>
                                </div>
                              )}
                              {poomsaeDays > 0 && (
                                <div className="flex justify-between">
                                  <span>Poomsae Officiating ({poomsaeDays} {poomsaeDays === 1 ? 'Day' : 'Days'} as {activeReferee.poomsaeStatus})</span>
                                  <span className="text-text font-semibold">RM {poomsaePay.toFixed(2)}</span>
                                </div>
                              )}
                              {virtualDays > 0 && (
                                <div className="flex justify-between">
                                  <span>Virtual Officiating ({virtualDays} {virtualDays === 1 ? 'Day' : 'Days'} as {
                                    activeReferee.specialRole === 'GAME_MASTER' ? 'Game Master' :
                                    activeReferee.specialRole === 'TECHNICAL_OPERATOR' ? 'Tech Operator' :
                                    activeReferee.specialRole === 'VIRTUAL_REFEREE' ? 'Virtual Ref' : 'Virtual'
                                  })</span>
                                  <span className="text-text font-semibold">RM {virtualPay.toFixed(2)}</span>
                                </div>
                              )}
                              <div className="text-[10px] text-gold italic pt-1">{splitExplanation}</div>
                            </div>
                          ) : (
                            <div className="flex justify-between text-text-dim">
                              <span>Base Duty Allowance ({days} {days === 1 ? 'Day' : 'Days'})</span>
                              <span className="text-text font-semibold">RM {baseDutyPay.toFixed(2)}</span>
                            </div>
                          )}
                          {travelPay > 0 && (
                            <div className="flex justify-between text-text-dim">
                              <span>
                                {activeReferee.accommodation === 'No'
                                  ? `Daily Travel Allowance (0-50 KM rate x ${days} ${days === 1 ? 'day' : 'days'})`
                                  : `Travel Mileage Allowance (${activeReferee.distance} KM Bracket)`
                                }
                              </span>
                              <span className="text-text font-semibold">RM {travelPay.toFixed(2)}</span>
                            </div>
                          )}
                          {otPay > 0 && (
                            <div className="flex justify-between text-text-dim">
                              <span>Overtime Supplemental Pay</span>
                              <span className="text-text font-semibold">RM {otPay.toFixed(2)}</span>
                            </div>
                          )}
                          {othersPay > 0 && (
                            <div className="flex justify-between text-text-dim">
                              <span>Other Supplemental Pay</span>
                              <span className="text-text font-semibold">RM {othersPay.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-text-dim">
                            <span>Accommodation Status</span>
                            <span className="text-text font-semibold">{activeReferee.accommodation === 'Yes' ? 'Free (Provided)' : 'No expense (Own)'}</span>
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-center pt-3 border-t border-line font-bold text-sm">
                          <span className="text-gold uppercase tracking-wider">Estimated Payout Total</span>
                          <span className="text-xl text-gold">RM {totalPay.toFixed(2)}</span>
                        </div>
                        
                        <p className="text-[10px] text-text-dim leading-relaxed italic bg-surface-2 p-3 rounded-lg border border-line mt-2">
                          Note: This breakdown is an estimate based on standard tournament officiating rates. Final payout balances may vary if officiating days are updated by the tournament organizer.
                        </p>
                      </div>
                    );
                  })()}
                </div>

              </div>

            </div>
          )}
        </div>
      )}

        {/* PARENT INDEMNITY SCREEN */}
        {screen === 'parentIndemnity' && (
          <ParentIndemnityForm
            indemnityPlayer={indemnityPlayer}
            indemnityComp={indemnityComp}
            indemnityLoading={indemnityLoading}
            indemnityCoach={indemnityCoach}
            coaches={coaches}
            triggerMsg={triggerMsg}
            setScreen={setScreen}
          />
        )}

        {/* PUBLIC VIEW SCREEN */}
        {screen === 'publicView' && activeComp && (
          <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
            
            {/* Header section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-surface p-6 rounded-2xl border border-line shadow-sm gap-4">
              <div>
                <h2 className="text-xl font-bold uppercase tracking-wider text-text flex items-center gap-2">
                  <Users className="w-5 h-5 text-gold" />
                  Public Directory
                </h2>
                <p className="text-sm font-semibold text-gold mt-1">{activeComp.name}</p>
              </div>
              <div className="text-xs text-text-dim text-right bg-ink/30 px-3.5 py-2 rounded-xl border border-line flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-gold animate-pulse"></span>
                <span>Live Public Bulletin (Read Only)</span>
              </div>
            </div>

            {/* Registered Entrants section */}
            <div className="bg-surface rounded-2xl border border-line p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-line/50">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-text">All Registered Entrants ({players.length})</h3>
                  <p className="text-xs text-text-dim">Search and verify registered competitors and their live weigh-in status below.</p>
                </div>
                {/* Search Bar */}
                <div className="relative w-full sm:w-72">
                  <input 
                    type="text" 
                    placeholder="Search name, ID, or club..."
                    value={publicSearchQuery}
                    onChange={(e) => setPublicSearchQuery(e.target.value)}
                    className="w-full bg-ink border border-line text-xs rounded-xl py-2 px-3 text-text pl-9 focus:outline-none focus:border-gold transition"
                  />
                  <Search className="w-3.5 h-3.5 text-text-dim/60 absolute left-3 top-2.5" />
                  {publicSearchQuery && (
                    <button 
                      onClick={() => setPublicSearchQuery('')}
                      className="text-text-dim hover:text-text absolute right-3 top-2 text-xs font-bold"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {publicFilteredPlayers.length === 0 ? (
                <div className="text-center py-12 text-text-dim border border-line border-dashed rounded-xl">
                  {players.length === 0 ? "No competitors registered for this tournament yet." : "No competitors matched your search query."}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-line">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-line bg-surface-2 text-xs uppercase tracking-wider text-text-dim">
                        <th className="p-4 font-semibold">ID</th>
                        <th className="p-4 font-semibold">Athlete Name</th>
                        <th className="p-4 font-semibold">Club/Team</th>
                        <th className="p-4 font-semibold">Division Category</th>
                        <th className="p-4 font-semibold">Weight Division</th>
                        <th className="p-4 font-semibold">Weigh-In Scale status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/30 text-xs">
                      {publicFilteredPlayers.map(p => (
                        <tr key={p.id} className="hover:bg-surface-2/30 transition">
                          <td className="p-4 font-mono text-gold font-bold">{p.id}</td>
                          <td className="p-4 font-bold text-text">
                            <div>{p.name}</div>
                            {(p.schoolName || p.race) && (
                              <div className="text-[10px] text-gold/80 font-mono mt-0.5 font-normal">
                                {p.schoolName && `School: ${p.schoolName} ${p.schoolCode ? `(${p.schoolCode})` : ''}`}
                                {p.schoolName && p.race && ' · '}
                                {p.race && `Race: ${p.race}`}
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-text">{p.club}</td>
                          <td className="p-4 text-text-dim">{p.ageGroup} · {p.gender}</td>
                          <td className="p-4 text-text-dim">{p.weightClass}</td>
                          <td className="p-4">
                            <div className="flex flex-col gap-1 items-start">
                              {renderBadge(p.weighIn?.result)}
                            </div>
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

      </main>

      {/* COACH ATHLETE INDEMNITY DASHBOARD MODAL */}
      {showIndemnityDashboardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm animate-fade-in print:hidden">
          <div className="bg-surface border border-line rounded-3xl w-full max-w-4xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-line bg-gradient-to-b from-surface-2/50 to-transparent flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center text-gold">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold uppercase tracking-wider text-text font-display flex items-center gap-2">
                    <span>Athlete Indemnity Dashboard</span>
                  </h2>
                  <p className="text-xs text-text-dim">Generate parent links, track real-time authorization status, and review signed consent certificates.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowIndemnityDashboardModal(false)}
                className="text-text-dim hover:text-text p-1.5 hover:bg-surface-2 rounded-xl border border-transparent hover:border-line transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-grow space-y-6">
              {(() => {
                const coachAthletesForIndemnity = players.filter(p => p.coachUsername === user);
                const totalCount = coachAthletesForIndemnity.length;
                const completedCount = coachAthletesForIndemnity.filter(p => p.indemnityStatus === 'Completed').length;
                const pendingCount = totalCount - completedCount;

                const filteredIndemnityAthletes = coachAthletesForIndemnity.filter(p => {
                  const matchesSearch = p.name.toLowerCase().includes(indemnitySearchQuery.toLowerCase()) || 
                                        (p.id && p.id.toLowerCase().includes(indemnitySearchQuery.toLowerCase()));
                  const matchesStatus = indemnityFilterStatus === 'All' || 
                                        (indemnityFilterStatus === 'Completed' && p.indemnityStatus === 'Completed') ||
                                        (indemnityFilterStatus === 'Pending' && p.indemnityStatus !== 'Completed');
                  return matchesSearch && matchesStatus;
                });

                return (
                  <>
                    {/* Stats Bar */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-surface-2 p-4 rounded-2xl border border-line flex items-center justify-between">
                        <div>
                          <span className="block text-[10px] text-text-dim font-bold uppercase tracking-wider">Total Team Roster</span>
                          <span className="text-2xl font-black text-text mt-0.5 block">{totalCount} Athletes</span>
                        </div>
                        <Users className="w-8 h-8 text-text-dim/40" />
                      </div>
                      
                      <div className="bg-emerald-950/20 p-4 rounded-2xl border border-emerald-500/20 flex items-center justify-between">
                        <div>
                          <span className="block text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Consent Secured</span>
                          <span className="text-2xl font-black text-emerald-400 mt-0.5 block">{completedCount} Forms</span>
                        </div>
                        <CheckCircle className="w-8 h-8 text-emerald-400/30" />
                      </div>

                      <div className="bg-amber-950/20 p-4 rounded-2xl border border-amber-500/20 flex items-center justify-between">
                        <div>
                          <span className="block text-[10px] text-amber-400 font-bold uppercase tracking-wider">Awaiting Parent Signing</span>
                          <span className="text-2xl font-black text-amber-400 mt-0.5 block">{pendingCount} Pending</span>
                        </div>
                        <AlertCircle className="w-8 h-8 text-amber-400/30" />
                      </div>
                    </div>

                    {/* Tournament-wide Shared Indemnity Link Card */}
                    <div className="bg-gradient-to-r from-gold/10 via-gold/5 to-transparent p-5 rounded-2xl border border-gold/20 space-y-3.5">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center text-gold shrink-0 mt-0.5">
                          <ExternalLink className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-text uppercase tracking-wider">Club-Wide Shared Parental Consent Link</h4>
                          <p className="text-xs text-text-dim leading-relaxed">
                            Instead of copying individual links for each athlete, you can share this **single link** to your club's WhatsApp or Telegram group. Parents will click it, search and select their child from your registered club roster, and fill up the indemnity waiver instantly. Parents will not see players from other clubs.
                          </p>
                        </div>
                      </div>

                      {(() => {
                        const sharedUrl = window.location.origin + window.location.pathname + '?indemnityComp=' + (compId || '') + '&coach=' + (user || '');
                        const waShareText = encodeURIComponent(`Dear Parents/Guardians, please click this official link to select your child and fill up the required Parental Consent & Indemnity Form for the ${activeComp?.name || 'upcoming tournament'}: ${sharedUrl}`);
                        return (
                          <div className="flex flex-col sm:flex-row items-center gap-3 bg-ink/50 p-2.5 rounded-xl border border-line">
                            <input 
                              type="text" 
                              readOnly 
                              value={sharedUrl} 
                              className="w-full bg-transparent text-xs text-text border-none focus:outline-none focus:ring-0 select-all px-2 font-mono"
                            />
                            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(sharedUrl);
                                  triggerMsg('Tournament-wide indemnity link copied to clipboard!', 'ok');
                                }}
                                className="w-full sm:w-auto bg-gold text-ink hover:bg-gold/90 font-bold px-4 py-2 rounded-lg text-xs uppercase tracking-wide transition flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Copy className="w-4 h-4" />
                                <span>Copy Link</span>
                              </button>
                              <button
                                onClick={() => window.open(`https://api.whatsapp.com/send?text=${waShareText}`, '_blank')}
                                className="w-full sm:w-auto bg-emerald-650 hover:opacity-95 text-white font-bold px-4 py-2 rounded-lg text-xs uppercase tracking-wide transition flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Share2 className="w-4 h-4" />
                                <span>WhatsApp</span>
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Filter and Search controls */}
                    <div className="flex flex-col md:flex-row gap-3 justify-between items-center bg-surface-2 p-4 rounded-2xl border border-line">
                      <div className="flex gap-1.5 bg-ink/40 p-1 rounded-xl border border-line shrink-0 w-full md:w-auto">
                        {(['All', 'Completed', 'Pending'] as const).map((st) => (
                          <button
                            key={st}
                            onClick={() => setIndemnityFilterStatus(st)}
                            className={`flex-grow md:flex-none px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition cursor-pointer ${
                              indemnityFilterStatus === st 
                                ? 'bg-gold text-ink' 
                                : 'text-text-dim hover:text-text'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>

                      <div className="relative w-full md:w-72">
                        <input 
                          type="text"
                          value={indemnitySearchQuery}
                          onChange={(e) => setIndemnitySearchQuery(e.target.value)}
                          placeholder="Search athlete by name..."
                          className="w-full bg-ink border border-line text-xs rounded-xl py-2 pl-8 pr-4 text-text focus:outline-none focus:border-gold"
                        />
                        <Search className="w-3.5 h-3.5 text-text-dim/60 absolute left-2.5 top-2.5" />
                      </div>
                    </div>

                    {/* Table */}
                    <div className="border border-line rounded-2xl overflow-hidden bg-surface-2">
                      {filteredIndemnityAthletes.length === 0 ? (
                        <div className="p-12 text-center text-text-dim space-y-2">
                          <Shield className="w-10 h-10 text-text-dim/40 mx-auto" />
                          <p className="text-sm font-bold">No matching athlete records found.</p>
                          <p className="text-xs">Adjust filters or add new athletes to your roster list.</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-line bg-ink/30 text-text-dim font-semibold font-mono uppercase tracking-wider">
                                <th className="p-4">Competitor</th>
                                <th className="p-4">Division / Event</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-right">Indemnity Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-line/30">
                              {filteredIndemnityAthletes.map(p => {
                                const parentUrl = window.location.origin + window.location.pathname + '?indemnity=' + p.id;
                                const waText = encodeURIComponent(`Dear Parent/Guardian, please review and sign the required Parental Consent & Indemnity Form for ${p.name} participating in the ${activeComp?.name || 'Tournament'}: ${parentUrl}`);
                                return (
                                  <tr key={p.id} className="hover:bg-ink/10 transition">
                                    <td className="p-4">
                                      <div className="font-bold text-text text-sm">{p.name}</div>
                                      <div className="text-[10px] text-text-dim font-mono">ID: {p.id}</div>
                                    </td>
                                    <td className="p-4">
                                      <div className="font-medium text-text">{p.event}</div>
                                      <div className="text-[10px] text-gold font-mono">{p.weightClass}</div>
                                    </td>
                                    <td className="p-4">
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                                        p.indemnityStatus === 'Completed'
                                          ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-500/20'
                                          : 'bg-amber-950/50 text-amber-400 border border-amber-500/20'
                                      }`}>
                                        {p.indemnityStatus === 'Completed' ? 'Completed' : 'Pending'}
                                      </span>
                                    </td>
                                    <td className="p-4 text-right">
                                      <div className="flex items-center justify-end gap-2">
                                        {p.indemnityStatus === 'Completed' ? (
                                          <button
                                            onClick={() => { setSelectedIndemnityPlayer(p); setShowViewIndemnityModal(true); }}
                                            className="bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900/40 border border-emerald-900/40 px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wide uppercase transition cursor-pointer flex items-center gap-1"
                                          >
                                            <Eye className="w-3.5 h-3.5" />
                                            <span>View Certificate</span>
                                          </button>
                                        ) : (
                                          <>
                                            <button
                                              onClick={() => {
                                                navigator.clipboard.writeText(parentUrl);
                                                triggerMsg(`Indemnity form link copied for ${p.name}!`, 'ok');
                                              }}
                                              className="bg-ink hover:bg-surface border border-line text-text font-bold px-3 py-1.5 rounded-lg text-[11px] uppercase tracking-wide transition cursor-pointer flex items-center gap-1"
                                              title="Copy direct form URL to clipboard"
                                            >
                                              <Copy className="w-3.5 h-3.5" />
                                              <span>Copy Link</span>
                                            </button>
                                            <button
                                              onClick={() => window.open(`https://api.whatsapp.com/send?text=${waText}`, '_blank')}
                                              className="bg-emerald-650 hover:opacity-90 text-white font-bold px-3 py-1.5 rounded-lg text-[11px] uppercase tracking-wide transition cursor-pointer flex items-center gap-1"
                                              title="Send link instantly via WhatsApp"
                                            >
                                              <Share2 className="w-3.5 h-3.5" />
                                              <span>WhatsApp</span>
                                            </button>
                                          </>
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
                  </>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-line bg-surface-2 text-right shrink-0 flex justify-between items-center text-[10px] text-text-dim">
              <span className="italic">Protip: You can text or email parents directly with the copied links.</span>
              <button 
                onClick={() => setShowIndemnityDashboardModal(false)}
                className="bg-ink hover:bg-surface border border-line font-bold text-text px-4 py-2 rounded-xl text-xs transition cursor-pointer"
              >
                Close Dashboard
              </button>
            </div>

          </div>
        </div>
      )}

      {/* INDIVIDUAL COMPLETED INDEMNITY CERTIFICATE VIEWER MODAL */}
      {showViewIndemnityModal && selectedIndemnityPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/90 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-line rounded-3xl w-full max-w-2xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-line bg-gradient-to-b from-surface-2/50 to-transparent flex justify-between items-center shrink-0 print:hidden">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-950/40 border border-emerald-900/40 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold uppercase tracking-wider text-text font-display">
                    Consent & Indemnity Form
                  </h2>
                  <p className="text-xs text-emerald-400 font-mono">Status: Digitally Signed & Certified</p>
                </div>
              </div>
              <button 
                onClick={() => { setShowViewIndemnityModal(false); setSelectedIndemnityPlayer(null); }}
                className="text-text-dim hover:text-text p-1.5 hover:bg-surface-2 rounded-xl border border-transparent hover:border-line transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body - Printable Consent Certificate */}
            <div className="p-8 overflow-y-auto flex-grow space-y-6 bg-white text-slate-900 font-sans printable-indemnity-canvas">
              
              {/* Certificate Header */}
              <div className="text-center border-b-2 border-slate-200 pb-4 space-y-1">
                <div className="font-extrabold text-xl uppercase tracking-wider text-slate-900">Official Liability Waiver & Indemnity Form</div>
                <div className="text-xs font-bold text-emerald-600 tracking-widest uppercase flex items-center justify-center gap-1">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Secure Digital Consent Certification</span>
                </div>
              </div>

              {/* Tournament & Competitor Meta */}
              <div className="grid grid-cols-2 gap-4 text-xs border-b border-slate-100 pb-4">
                <div className="space-y-1.5">
                  <div className="text-slate-500 uppercase tracking-wider text-[10px] font-bold">Championship Event Details</div>
                  <div className="font-extrabold text-slate-800 text-sm">{activeComp?.name || 'Taekwondo Tournament'}</div>
                  <div className="text-slate-600 font-medium">{activeComp?.venue} · {activeComp?.date}</div>
                </div>
                <div className="space-y-1.5 border-l border-slate-200 pl-4 font-mono">
                  <div className="text-slate-500 uppercase tracking-wider text-[10px] font-bold font-sans">Verification Fingerprint</div>
                  <div><span className="text-slate-400">Athlete ID:</span> <span className="font-bold text-slate-800">{selectedIndemnityPlayer.id}</span></div>
                  <div><span className="text-slate-400">Division:</span> <span className="font-bold text-slate-800">{selectedIndemnityPlayer.event}</span></div>
                  <div><span className="text-slate-400">Class:</span> <span className="font-bold text-slate-800">{selectedIndemnityPlayer.weightClass}</span></div>
                </div>
              </div>

              {/* Roster & Participant Info */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs">
                <div className="font-bold text-slate-700 border-b border-slate-200 pb-1">COMPETITOR (CHILD) PARAMETERS</div>
                <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                  <div><span className="text-slate-500">Full Name:</span> <strong className="text-slate-900 uppercase block">{selectedIndemnityPlayer.name}</strong></div>
                  <div><span className="text-slate-500">NRIC No:</span> <strong className="text-slate-900 block">{selectedIndemnityPlayer.ic}</strong></div>
                  <div><span className="text-slate-500">School Affiliation:</span> <strong className="text-slate-900 block">{selectedIndemnityPlayer.schoolName || 'N/A'} {selectedIndemnityPlayer.schoolCode ? `(${selectedIndemnityPlayer.schoolCode})` : ''}</strong></div>
                  <div><span className="text-slate-500">Represented Club:</span> <strong className="text-slate-900 uppercase block">{selectedIndemnityPlayer.club}</strong></div>
                </div>
              </div>

              {/* Guardian Info */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs">
                <div className="font-bold text-slate-700 border-b border-slate-200 pb-1">PARENT / GUARDIAN CONFIRMATION</div>
                <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                  <div><span className="text-slate-500">Guardian Full Name:</span> <strong className="text-slate-900 block">{selectedIndemnityPlayer.indemnityParentName}</strong></div>
                  <div><span className="text-slate-500">Guardian NRIC:</span> <strong className="text-slate-900 block">{selectedIndemnityPlayer.indemnityParentIc}</strong></div>
                  <div><span className="text-slate-500">Relationship to Athlete:</span> <strong className="text-slate-900 block">{selectedIndemnityPlayer.indemnityRelationship}</strong></div>
                  <div><span className="text-slate-500">Contact Number:</span> <strong className="text-slate-900 block">{selectedIndemnityPlayer.indemnityParentPhone}</strong></div>
                  {selectedIndemnityPlayer.indemnityParentEmail && (
                    <div className="col-span-2"><span className="text-slate-500">Email Address:</span> <strong className="text-slate-900 block">{selectedIndemnityPlayer.indemnityParentEmail}</strong></div>
                  )}
                </div>
              </div>

              {/* Waiver Clause Summary */}
              <div className="text-[10px] text-slate-500 leading-relaxed space-y-1 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="font-bold text-slate-700">INDEMNITY RELEASE SUMMARY</div>
                <p>
                  I, the undersigned parent/guardian, hereby declare that I gave absolute permission for my child to compete in this tournament. I voluntarily assume all physical risks of Taekwondo full-contact competition, exempt the tournament management and coaches from any legal liabilities, and verify that the competitor is medically sound and fully fit to participate.
                </p>
              </div>

              {/* Signature display block */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <div className="text-xs space-y-1 font-mono text-slate-500">
                  <div className="font-bold text-slate-700 font-sans">SECURITY DETAILS</div>
                  <div>Signed Date: <strong className="text-slate-800">{selectedIndemnityPlayer.indemnitySignedDate}</strong></div>
                  <div>IP Address: <strong className="text-slate-800">{selectedIndemnityPlayer.indemnitySignedIp || 'Client-device'}</strong></div>
                  <div className="text-[10px] text-slate-400 mt-2">Verified via Cloud Record</div>
                </div>
                <div className="space-y-1.5 flex flex-col items-center">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Guardian Signature</span>
                  <div className="border border-slate-200 rounded-lg p-2 bg-slate-100 w-full h-24 flex items-center justify-center overflow-hidden">
                    {selectedIndemnityPlayer.indemnitySignature ? (
                      <img 
                        src={selectedIndemnityPlayer.indemnitySignature} 
                        alt="Parent Signature" 
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">No signature image found</span>
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-line bg-surface-2 flex justify-between items-center shrink-0 print:hidden">
              <button
                onClick={() => {
                  const printContents = document.querySelector('.printable-indemnity-canvas')?.innerHTML;
                  const originalContents = document.body.innerHTML;
                  if (printContents) {
                    const win = window.open('', '_blank');
                    if (win) {
                      win.document.write(`
                        <html>
                          <head>
                            <title>Indemnity Certificate - ${selectedIndemnityPlayer.name}</title>
                            <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
                          </head>
                          <body class="bg-white p-8">
                            <div class="max-w-2xl mx-auto border-2 border-slate-300 rounded-3xl p-6 shadow-md bg-white text-slate-900 font-sans">
                              ${printContents}
                            </div>
                            <script>
                              window.onload = function() {
                                window.print();
                                setTimeout(function() { window.close(); }, 500);
                              };
                            </script>
                          </body>
                        </html>
                      `);
                      win.document.close();
                    }
                  }
                }}
                className="bg-gold text-ink font-bold hover:bg-gold/90 px-4 py-2 rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print Consent Certificate</span>
              </button>
              
              <button 
                onClick={() => { setShowViewIndemnityModal(false); setSelectedIndemnityPlayer(null); }}
                className="bg-ink hover:bg-surface border border-line font-bold text-text px-4 py-2 rounded-xl text-xs transition cursor-pointer"
              >
                Close Certificate
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ATHLETE DATABASE EXPLORER MODAL */}
      {showAthleteDbModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm animate-fade-in print:hidden">
          <div className="bg-surface border border-line rounded-3xl w-full max-w-5xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-line bg-gradient-to-b from-surface-2/50 to-transparent flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center text-gold">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold uppercase tracking-wider text-text font-display flex items-center gap-2">
                    <span>Athlete Database Explorer & Search Engine</span>
                    <span className="text-[10px] bg-gold/15 text-gold px-2 py-0.5 rounded-full border border-gold/20 normal-case font-mono">
                      {Object.keys(masterAthletes).length} Saved
                    </span>
                  </h2>
                  <p className="text-xs text-text-dim">Search, browse, inspect, and manage the complete roster of saved registered competitors in local storage.</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowAthleteDbModal(false);
                  setDbSearchQuery('');
                }}
                className="text-text-dim hover:text-text bg-surface-2 hover:bg-line border border-line px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Modal Search Bar */}
            <div className="p-6 border-b border-line bg-surface-2/30 flex flex-col sm:flex-row gap-4 items-center shrink-0">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-text-dim" />
                <input 
                  type="text" 
                  value={dbSearchQuery}
                  onChange={(e) => setDbSearchQuery(e.target.value)}
                  placeholder="Search saved database by name, IC number, club/affiliated team..." 
                  className="w-full bg-ink border border-line rounded-xl pl-10 pr-4 py-3 text-sm text-text outline-none focus:border-gold transition shadow-inner"
                />
                {dbSearchQuery && (
                  <button 
                    onClick={() => setDbSearchQuery('')}
                    className="absolute right-3.5 top-2.5 text-text-dim hover:text-text font-bold text-lg px-2 py-1"
                  >
                    ×
                  </button>
                )}
              </div>
              
              <div className="text-xs text-text-dim whitespace-nowrap bg-surface-2 border border-line px-3 py-2 rounded-xl">
                Filtering: <span className="font-bold text-text">
                  {(() => {
                    const q = dbSearchQuery.toLowerCase();
                    return Object.values(masterAthletes).filter((ma: any) => 
                      !dbSearchQuery ||
                      ma.name?.toLowerCase().includes(q) ||
                      ma.ic?.toLowerCase().includes(q) ||
                      ma.club?.toLowerCase().includes(q)
                    ).length;
                  })()}
                </span> matching profiles
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8">
              {(() => {
                const q = dbSearchQuery.toLowerCase();
                const filtered = Object.values(masterAthletes).filter((ma: any) => 
                  !dbSearchQuery ||
                  ma.name?.toLowerCase().includes(q) ||
                  ma.ic?.toLowerCase().includes(q) ||
                  ma.club?.toLowerCase().includes(q)
                );

                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-16 space-y-3">
                      <Database className="w-16 h-16 text-text-dim/30 mx-auto" />
                      <h3 className="text-sm font-bold text-text uppercase tracking-wider">No matching profiles found</h3>
                      <p className="text-xs text-text-dim max-w-md mx-auto">
                        Adjust your query or register new athletes to automatically persist their records in the secure offline local database.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filtered.map((ma: any) => (
                      <div 
                        key={ma.id}
                        className="bg-ink/20 border border-line/70 hover:border-gold/30 rounded-2xl p-5 flex flex-col justify-between transition hover:-translate-y-0.5 duration-200 group relative overflow-hidden"
                      >
                        <div className="flex items-start space-x-4 mb-4">
                          <div className="w-16 h-20 bg-ink rounded-xl overflow-hidden flex items-center justify-center border border-line shrink-0 shadow-inner">
                            {ma.photo ? (
                              <img src={ma.photo} alt={ma.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <User className="w-6 h-6 text-text-dim/40" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-text text-sm truncate uppercase tracking-wide group-hover:text-gold transition-colors">{ma.name}</h4>
                            <p className="text-xs text-text-dim mt-1">IC: <span className="font-mono text-text">{ma.ic || 'N/A'}</span></p>
                            <p className="text-xs text-text-dim mt-0.5">Club: <span className="font-semibold text-text">{ma.club || 'N/A'}</span></p>
                            <p className="text-[10px] text-text-dim/80 mt-1">
                              DOB: <span className="text-text-dim">{ma.dob || 'N/A'}</span> · Gender: <span className="text-text-dim">{ma.gender || 'N/A'}</span>
                            </p>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-line/40 flex justify-between items-center bg-surface-2/10">
                          <span className="text-[10px] font-mono text-text-dim font-bold uppercase tracking-wider">ID: {ma.id}</span>
                          {confirmDeleteAthleteId === ma.id ? (
                            <div className="flex items-center space-x-1">
                              <button 
                                onClick={() => {
                                  const updated = { ...masterAthletes };
                                  delete updated[ma.id];
                                  saveMasterAthletesToStorage(updated);
                                  setConfirmDeleteAthleteId(null);
                                  triggerMsg('Athlete profile removed from database successfully!', 'ok');
                                }}
                                className="bg-red-600 hover:bg-red-700 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold shadow-sm cursor-pointer"
                              >
                                Confirm
                              </button>
                              <button 
                                onClick={() => setConfirmDeleteAthleteId(null)}
                                className="bg-surface border border-line text-text hover:bg-line px-2.5 py-1.5 rounded-lg text-[10px] cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => setConfirmDeleteAthleteId(ma.id)}
                              className="text-[10px] text-hong hover:text-white border border-hong/20 hover:bg-hong/90 px-2.5 py-1.5 rounded-lg transition font-bold cursor-pointer"
                            >
                              Delete Profile
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-line bg-surface-2 text-center text-xs text-text-dim shrink-0">
              Note: Persistent profile records are stored securely in your web browser's local sandbox to comply with data privacy policies.
            </div>

          </div>
        </div>
      )}

      {/* THEME STATION MODAL */}
      {showThemeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-line rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col md:flex-row">
            
            {/* LEFT PANEL: SELECTOR */}
            <div className="p-6 md:p-8 flex-1 flex flex-col justify-between overflow-y-auto border-b md:border-b-0 md:border-r border-line bg-surface">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Palette className="w-5 h-5 text-gold animate-pulse" />
                    <h2 className="text-xl font-bold uppercase tracking-wider text-text font-display">Theme & Layout Station</h2>
                  </div>
                  <button 
                    onClick={() => setShowThemeModal(false)}
                    className="text-text-dim hover:text-text text-xs font-bold bg-surface-2 hover:bg-line px-3.5 py-2 rounded-xl border border-line transition cursor-pointer"
                  >
                    Close
                  </button>
                </div>

                <div>
                  <p className="text-xs text-text-dim leading-relaxed">
                    Personalize your tournament portal. Calibrate dynamic accent presets, page widths, spacing density, and any custom background tone instantly.
                  </p>
                </div>

                {/* SECTION 1: THEME ACCENTS */}
                <div className="space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text flex items-center space-x-1.5">
                    <Trophy className="w-3.5 h-3.5 text-gold" />
                    <span>Theme Accents</span>
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      {
                        id: 'emerald',
                        name: 'Emerald Dojang',
                        desc: 'Traditional jade & premium gold accents',
                        defaultBg: '#FFFFFF',
                        colors: ['#FFFFFF', '#D1E2D9', '#9C7700']
                      },
                      {
                        id: 'midnight',
                        name: 'Midnight Arena',
                        desc: 'Tech-blue & ice accents',
                        defaultBg: '#FFFFFF',
                        colors: ['#FFFFFF', '#E2E8F0', '#A06400']
                      },
                      {
                        id: 'crimson',
                        name: 'Crimson Fury',
                        desc: 'Bold crimson & stark minimalist accents',
                        defaultBg: '#FFFFFF',
                        colors: ['#FFFFFF', '#FED7D7', '#9C7700']
                      },
                      {
                        id: 'zen',
                        name: 'Zen Paper',
                        desc: 'Traditional warm paper tatami & sumi-ink',
                        defaultBg: '#FAF8F5',
                        colors: ['#FAF8F5', '#F4EFE6', '#9E7D0A']
                      }
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setTheme(t.id as any);
                          setCustomBgColor(t.defaultBg);
                        }}
                        className={`text-left p-3 rounded-xl border transition duration-200 flex flex-col justify-between cursor-pointer ${
                          theme === t.id 
                            ? 'bg-surface-2 border-gold ring-1 ring-gold shadow-md' 
                            : 'bg-ink/40 border-line hover:border-text-dim hover:bg-surface-2/30'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[11px] font-bold text-text uppercase tracking-wider">{t.name}</span>
                          <div className="flex space-x-0.5">
                            {t.colors.map((c, idx) => (
                              <span key={idx} className="w-2 h-2 rounded-full border border-line/50" style={{ backgroundColor: c }} />
                            ))}
                          </div>
                        </div>
                        <p className="text-[9px] text-text-dim mt-1 font-medium leading-tight">{t.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* SECTION 2: BACKGROUND COLOR CUSTOMIZER */}
                <div className="space-y-3 pt-2 border-t border-line">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text flex items-center space-x-1.5">
                    <Sun className="w-3.5 h-3.5 text-gold" />
                    <span>Choose Background Tone</span>
                  </h3>
                  
                  {/* Preset Background Chips */}
                  <div className="flex flex-wrap gap-2">
                    {[
                      { name: 'Pure White', value: '#FFFFFF' },
                      { name: 'Paper Tatami', value: '#FAF8F5' },
                      { name: 'Warm Cream', value: '#F6F2EB' },
                      { name: 'Ice Mist', value: '#F4F6F9' },
                      { name: 'Soft Mint', value: '#EFF7F4' },
                      { name: 'Shadow Slate', value: '#12161A' },
                      { name: 'Carbon Black', value: '#1E222B' }
                    ].map((chip) => (
                      <button
                        key={chip.value}
                        onClick={() => setCustomBgColor(chip.value)}
                        className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg border transition cursor-pointer flex items-center space-x-1.5 ${
                          customBgColor.toLowerCase() === chip.value.toLowerCase()
                            ? 'bg-gold/10 border-gold text-gold shadow-sm'
                            : 'bg-surface-2 border-line text-text-dim hover:text-text hover:bg-line'
                        }`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full border border-line/50" style={{ backgroundColor: chip.value }} />
                        <span>{chip.name}</span>
                      </button>
                    ))}
                  </div>

                  {/* HTML Color Picker input styled elegantly */}
                  <div className="flex items-center space-x-4 bg-surface-2/50 border border-line rounded-xl p-2.5">
                    <div className="relative w-8 h-8 rounded-lg border border-line overflow-hidden cursor-pointer shadow-sm flex items-center justify-center bg-surface-2 hover:bg-line transition shrink-0">
                      <input 
                        type="color" 
                        value={customBgColor} 
                        onChange={(e) => setCustomBgColor(e.target.value)}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                      />
                      <Palette className="w-4 h-4 text-gold pointer-events-none" />
                    </div>
                    <div className="flex-grow">
                      <span className="text-[10px] font-bold text-text block uppercase tracking-wider">Custom Shade Mixer</span>
                      <span className="font-mono text-[9px] text-text-dim block uppercase">{customBgColor}</span>
                    </div>
                  </div>
                </div>

                {/* SECTION 3: LAYOUT STRUCTURE */}
                <div className="space-y-4 pt-2 border-t border-line">
                  {/* LAYOUT SPACING */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text mb-2 flex items-center space-x-1.5">
                      <Sliders className="w-3.5 h-3.5 text-gold" />
                      <span>Spacing Density</span>
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setLayoutDensity('bento')}
                        className={`px-3 py-2 text-xs font-bold rounded-xl border transition cursor-pointer flex flex-col items-center justify-center space-y-1 ${
                          layoutDensity === 'bento'
                            ? 'bg-gold/10 border-gold text-gold shadow-sm'
                            : 'bg-surface-2 border-line text-text-dim hover:text-text hover:bg-line'
                        }`}
                      >
                        <span className="uppercase text-[10px] tracking-wider">Spacious Bento</span>
                        <span className="text-[9px] font-normal opacity-75">Traditional grid layout</span>
                      </button>
                      <button
                        onClick={() => setLayoutDensity('compact')}
                        className={`px-3 py-2 text-xs font-bold rounded-xl border transition cursor-pointer flex flex-col items-center justify-center space-y-1 ${
                          layoutDensity === 'compact'
                            ? 'bg-gold/10 border-gold text-gold shadow-sm'
                            : 'bg-surface-2 border-line text-text-dim hover:text-text hover:bg-line'
                        }`}
                      >
                        <span className="uppercase text-[10px] tracking-wider">Tactical Compact</span>
                        <span className="text-[9px] font-normal opacity-75">High-density data lists</span>
                      </button>
                    </div>
                  </div>

                  {/* LAYOUT WIDTH */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text mb-2 flex items-center space-x-1.5">
                      <Layout className="w-3.5 h-3.5 text-gold" />
                      <span>Sizing & Margins</span>
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setLayoutWidth('standard')}
                        className={`px-2 py-2 text-xs font-bold rounded-xl border transition cursor-pointer flex flex-col items-center justify-center space-y-1 ${
                          layoutWidth === 'standard'
                            ? 'bg-gold/10 border-gold text-gold shadow-sm'
                            : 'bg-surface-2 border-line text-text-dim hover:text-text hover:bg-line'
                        }`}
                      >
                        <span className="uppercase text-[9px] tracking-wider">Standard</span>
                        <span className="text-[8px] font-normal opacity-75">1280px Grid</span>
                      </button>
                      <button
                        onClick={() => setLayoutWidth('widescreen')}
                        className={`px-2 py-2 text-xs font-bold rounded-xl border transition cursor-pointer flex flex-col items-center justify-center space-y-1 ${
                          layoutWidth === 'widescreen'
                            ? 'bg-gold/10 border-gold text-gold shadow-sm'
                            : 'bg-surface-2 border-line text-text-dim hover:text-text hover:bg-line'
                        }`}
                      >
                        <span className="uppercase text-[9px] tracking-wider">Widescreen</span>
                        <span className="text-[8px] font-normal opacity-75">1500px Board</span>
                      </button>
                      <button
                        onClick={() => setLayoutWidth('fluid')}
                        className={`px-2 py-2 text-xs font-bold rounded-xl border transition cursor-pointer flex flex-col items-center justify-center space-y-1 ${
                          layoutWidth === 'fluid'
                            ? 'bg-gold/10 border-gold text-gold shadow-sm'
                            : 'bg-surface-2 border-line text-text-dim hover:text-text hover:bg-line'
                        }`}
                      >
                        <span className="uppercase text-[9px] tracking-wider">Fluid</span>
                        <span className="text-[8px] font-normal opacity-75">100% Edge</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-line text-center">
                <button
                  onClick={() => setShowThemeModal(false)}
                  className="w-full bg-gold hover:opacity-90 text-ink font-bold text-xs uppercase tracking-wider py-3.5 px-4 rounded-xl shadow-md transition duration-200 cursor-pointer"
                >
                  Apply Personalization
                </button>
              </div>
            </div>

            {/* RIGHT PANEL: IMMERSIVE PREVIEW DECK */}
            <div className="bg-ink p-6 md:p-8 flex-1 flex flex-col justify-center items-center space-y-6 overflow-y-auto">
              <div className="text-center">
                <span className="text-[10px] uppercase tracking-widest font-bold text-gold bg-surface px-3 py-1 rounded-full border border-line">Immersive Live Preview</span>
                <p className="text-xs text-text-dim mt-2 max-w-xs mx-auto">Click any preset on the left to watch all components and the background repaint instantly in real-time!</p>
              </div>

              {/* MOCK PLAYER BADGE / ID CARD */}
              <div className="bg-surface border-2 border-line rounded-2xl p-4 w-full max-w-[280px] shadow-lg relative overflow-hidden transition-all duration-300">
                {/* Red & Blue ribbon bars */}
                <div className="absolute top-0 left-0 right-0 h-1.5 flex">
                  <div className="bg-hong flex-1"></div>
                  <div className="bg-chong flex-1"></div>
                </div>

                <div className="flex justify-between items-start mt-2">
                  <span className="text-[8px] font-mono font-bold text-gold tracking-wider bg-ink px-1.5 py-0.5 rounded border border-line">ID: TMR-PRE-099</span>
                  <Trophy className="w-4 h-4 text-gold" />
                </div>

                <div className="flex flex-col items-center mt-3 text-center">
                  {/* Photo Frame */}
                  <div className="w-16 h-16 rounded-full border-2 border-line bg-ink overflow-hidden flex items-center justify-center shadow-inner">
                    <User className="w-8 h-8 text-text-dim" />
                  </div>
                  
                  <h3 className="text-xs font-bold uppercase text-text mt-3 tracking-wide">HAZIM LUQMAN</h3>
                  <p className="text-[9px] font-semibold text-gold uppercase tracking-wider">Smart Ma Taekwondo</p>
                  
                  <div className="w-full h-[1px] bg-line my-2"></div>
                  
                  <div className="grid grid-cols-2 gap-1 w-full text-[9px] text-text-dim">
                    <div className="text-left">
                      <span>Division:</span>
                      <p className="font-bold text-text uppercase leading-tight">Junior Male</p>
                    </div>
                    <div className="text-right">
                      <span>Class:</span>
                      <p className="font-bold text-text uppercase leading-tight">Fly -48kg</p>
                    </div>
                  </div>

                  <div className="mt-3 p-1.5 bg-ink rounded-lg border border-line w-full flex justify-between items-center">
                    <div className="flex items-center space-x-1.5">
                      <QrCode className="w-5 h-5 text-text" />
                      <div className="text-left leading-none">
                        <span className="text-[7px] text-text-dim block">SCAN STATUS</span>
                        <span className="text-[9px] font-bold text-good">WEIGH-IN PASS</span>
                      </div>
                    </div>
                    <CheckCircle className="w-3.5 h-3.5 text-good" />
                  </div>
                </div>
              </div>

              {/* MOCK LIVE SYSTEM COMPONENTS */}
              <div className="w-full max-w-[280px] space-y-2 text-xs">
                {/* Weigh-in log bar */}
                <div className="bg-surface border border-line p-2.5 rounded-xl flex items-center justify-between shadow-sm">
                  <div className="flex items-center space-x-2">
                    <Scale className="w-3.5 h-3.5 text-gold" />
                    <div>
                      <span className="text-[9px] text-text-dim block">LIVE SCALE READING</span>
                      <span className="font-mono font-bold text-text">47.65 KG</span>
                    </div>
                  </div>
                  <span className="bg-good/15 text-good border border-good/30 text-[9px] uppercase font-bold px-2 py-0.5 rounded-md">
                    Pass
                  </span>
                </div>

                {/* Input form style preview */}
                <div className="bg-surface border border-line p-2.5 rounded-xl space-y-1.5 shadow-sm">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-text-dim block">Scale Access Code</label>
                  <div className="flex space-x-1.5">
                    <input 
                      type="text" 
                      readOnly 
                      value="weighin123" 
                      className="flex-1 bg-ink border border-line rounded-lg text-[10px] py-1 px-2 text-text outline-none focus:border-gold"
                    />
                    <button className="bg-gold text-ink font-bold text-[9px] uppercase px-2.5 py-1 rounded-lg">
                      Log
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* FOOTER METADATA */}
      <footer className="border-t border-line bg-surface py-6 text-center text-xs text-text-dim mt-12 print:hidden">
        <p className="max-w-2xl mx-auto px-4 leading-relaxed">
          &copy; 2026 MY-TKD REGS Tournament Systems. All tournament structures, digital logs, weigh-in matrices, and athlete portrait records are persistently stored locally to protect confidentiality.
        </p>
      </footer>

      {/* COACH EDIT PROFILE MODAL */}
      {showCoachEditProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-line rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="p-6 border-b border-line flex justify-between items-center bg-gradient-to-r from-surface to-surface-2">
              <h2 className="text-xl font-bold text-text uppercase tracking-wider flex items-center gap-2">
                <User className="w-5 h-5 text-gold" />
                Edit Coach Profile
              </h2>
              <button 
                onClick={() => setShowCoachEditProfile(false)}
                className="text-text-dim hover:text-text transition p-2 hover:bg-surface border border-transparent hover:border-line rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="col-span-full">
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Username (Cannot be changed)</label>
                  <input type="text" value={user || ''} disabled className="w-full bg-ink/50 border border-line text-sm rounded-xl py-2 px-3 text-text-dim cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Coach Name *</label>
                  <input type="text" value={coachEditName} onChange={(e) => setCoachEditName(e.target.value)} className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Club Name *</label>
                  <input type="text" value={coachEditClub} onChange={(e) => setCoachEditClub(e.target.value)} className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Phone Number</label>
                  <input type="tel" value={coachEditPhone} onChange={(e) => setCoachEditPhone(e.target.value)} className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Email Address</label>
                  <input type="email" value={coachEditEmail} onChange={(e) => setCoachEditEmail(e.target.value)} className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold" />
                </div>
                <div className="col-span-full">
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Access Password * (Edit to change)</label>
                  <input type="text" value={coachEditPassword} onChange={(e) => setCoachEditPassword(e.target.value)} className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold" />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-line bg-surface-2 flex justify-end gap-3">
              <button 
                onClick={() => setShowCoachEditProfile(false)}
                className="px-6 py-2.5 rounded-xl font-bold text-sm text-text-dim border border-line hover:text-text transition"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (!coachEditName.trim() || !coachEditClub.trim() || !coachEditPassword.trim()) {
                    triggerMsg('Name, Club, and Password are required.', 'error');
                    return;
                  }
                  const updated = {
                    ...coaches,
                    [user || '']: {
                      ...coaches[user || ''],
                      name: coachEditName.trim(),
                      club: coachEditClub.trim(),
                      phone: coachEditPhone.trim() || undefined,
                      email: coachEditEmail.trim() || undefined,
                      password: coachEditPassword.trim()
                    }
                  };
                  saveCoachesToStorage(updated);
                  setShowCoachEditProfile(false);
                  triggerMsg('Coach profile updated successfully!', 'ok');
                }}
                className="bg-gold hover:bg-yellow-400 text-ink px-6 py-2.5 rounded-xl font-bold text-sm transition shadow flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REFEREE EDIT PROFILE MODAL */}
      {showRefereeEditProfile && activeReferee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-line rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            
            {/* Header */}
            <div className="p-6 border-b border-line flex justify-between items-center bg-gradient-to-r from-surface to-surface-2">
              <h2 className="text-xl font-bold text-text uppercase tracking-wider flex items-center gap-2">
                <User className="w-5 h-5 text-gold" />
                Edit Profile
              </h2>
              <button 
                onClick={() => setShowRefereeEditProfile(false)}
                className="text-text-dim hover:text-white transition p-2 hover:bg-surface-2 rounded-xl"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Full Name *</label>
                  <input type="text" value={refereeFullName} onChange={(e) => setRefereeFullName(e.target.value)} className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">NRIC Number (Cannot be changed)</label>
                  <input type="text" value={refereeNric} disabled className="w-full bg-ink/50 border border-line text-sm rounded-xl py-2 px-3 text-text-dim cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Password</label>
                  <input type="text" value={refereePassword} onChange={(e) => setRefereePassword(e.target.value)} className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Phone Number *</label>
                  <input type="tel" value={refereePhone} onChange={(e) => setRefereePhone(e.target.value)} className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">State / Club Name *</label>
                  <input type="text" value={refereeClubName} onChange={(e) => setRefereeClubName(e.target.value)} className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Residential Location *</label>
                  <input type="text" value={refereeResidential} onChange={(e) => setRefereeResidential(e.target.value)} className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Distance to Venue (Go & Return in KM) *</label>
                  <input type="number" value={refereeDistance} onChange={(e) => setRefereeDistance(e.target.value)} className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Bank Name *</label>
                  <input type="text" value={refereeBankName} onChange={(e) => setRefereeBankName(e.target.value)} className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Bank Account Number *</label>
                  <input type="text" value={refereeBankAccount} onChange={(e) => setRefereeBankAccount(e.target.value)} className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Kyorugi Referee Status *</label>
                  <select value={refereeKyorugiStatus} onChange={(e) => setRefereeKyorugiStatus(e.target.value as any)} className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition">
                    <option value="TR">Trainee Referee (TR)</option>
                    <option value="SR">State Referee (SR)</option>
                    <option value="NR">National Referee (NR)</option>
                    <option value="IR">International Referee (IR)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Poomsae Referee Status *</label>
                  <select value={refereePoomsaeStatus} onChange={(e) => setRefereePoomsaeStatus(e.target.value as any)} className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition">
                    <option value="TR">Trainee Referee (TR)</option>
                    <option value="SR">State Referee (SR)</option>
                    <option value="NR">National Referee (NR)</option>
                    <option value="IR">International Referee (IR)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Accommodation Required? *</label>
                  <select value={refereeAccommodation} onChange={(e) => setRefereeAccommodation(e.target.value as any)} className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition">
                    <option value="No">No - I will arrange my own</option>
                    <option value="Yes">Yes - Organizer to arrange</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Car Plate Number</label>
                  <input type="text" value={refereeCarPlate} onChange={(e) => setRefereeCarPlate(e.target.value)} className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold uppercase" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Special Appointed Role</label>
                  <select value={refereeSpecialRole} onChange={(e) => setRefereeSpecialRole(e.target.value as any)} className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition">
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
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-line bg-surface-2 flex justify-end gap-3">
              <button 
                onClick={() => setShowRefereeEditProfile(false)}
                className="px-6 py-2.5 rounded-xl text-text font-bold text-sm hover:bg-surface border border-line transition"
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  if (!refereeFullName || !refereePhone || !refereeClubName || !refereeResidential || refereeDistance.toString().trim() === '' || !refereeBankName.trim() || !refereeBankAccount.trim()) {
                    triggerMsg('Please fill in all required fields.', 'error');
                    return;
                  }
                  
                  const distVal = parseFloat(refereeDistance as string);
                  if (isNaN(distVal) || distVal < 0) {
                    triggerMsg('Please enter a valid number for Distance to Venue.', 'error');
                    return;
                  }
                  
                  const updatedRefInfo = {
                    fullName: refereeFullName,
                    password: refereePassword || undefined,
                    phone: refereePhone,
                    clubName: refereeClubName,
                    residentialLocation: refereeResidential,
                    distance: distVal,
                    bankName: refereeBankName,
                    bankAccount: refereeBankAccount,
                    accommodation: refereeAccommodation,
                    kyorugiStatus: refereeKyorugiStatus,
                    poomsaeStatus: refereePoomsaeStatus,
                    carPlate: refereeCarPlate,
                    specialRole: refereeSpecialRole,
                  };

                  const cleanIc = activeReferee.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

                  try {
                    // Update global refereeAccount
                    const existingAcc = refereeAccounts.find(a => a.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanIc);
                    if (existingAcc) {
                      await saveRefereeAccount({
                        ...existingAcc,
                        ...updatedRefInfo
                      });
                    }
                    
                    // Update all active tournament registrations
                    const matchingTournaments = referees.filter(r => r.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanIc);
                    for (const tRef of matchingTournaments) {
                      await saveRefereeToFirestore({
                        ...tRef,
                        ...updatedRefInfo
                      });
                    }
                    
                    triggerMsg('Profile updated successfully!', 'ok');
                    setShowRefereeEditProfile(false);
                  } catch (err) {
                    console.error(err);
                    triggerMsg('Failed to update profile', 'error');
                  }
                }}
                className="bg-gold hover:bg-yellow-400 text-ink px-6 py-2.5 rounded-xl font-bold text-sm transition shadow flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ORGANIZER ADD REFEREE MODAL */}
      {showOrganizerAddReferee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-line rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            
            {/* Header */}
            <div className="p-6 border-b border-line flex justify-between items-center bg-gradient-to-r from-surface to-surface-2">
              <h2 className="text-xl font-bold text-text uppercase tracking-wider flex items-center gap-2">
                <User className="w-5 h-5 text-gold" />
                Add Referee to Tournament
              </h2>
              <button 
                onClick={() => setShowOrganizerAddReferee(false)}
                className="text-text-dim hover:text-white transition p-2 hover:bg-surface-2 rounded-xl"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-line bg-surface-2/20">
              <button
                type="button"
                onClick={() => setAddRefereeModalTab('existing')}
                className={`flex-1 py-3 px-4 text-center text-sm font-semibold border-b-2 transition ${
                  addRefereeModalTab === 'existing'
                    ? 'border-gold text-gold bg-gold/5'
                    : 'border-transparent text-text-dim hover:text-text hover:bg-surface-2/10'
                }`}
              >
                Select Registered Referee
              </button>
              <button
                type="button"
                onClick={() => setAddRefereeModalTab('new')}
                className={`flex-1 py-3 px-4 text-center text-sm font-semibold border-b-2 transition ${
                  addRefereeModalTab === 'new'
                    ? 'border-gold text-gold bg-gold/5'
                    : 'border-transparent text-text-dim hover:text-text hover:bg-surface-2/10'
                }`}
              >
                Create New Referee Profile
              </button>
            </div>

            {/* Content */}
            {addRefereeModalTab === 'existing' ? (
              <div className="p-6 overflow-y-auto space-y-6 flex-1 flex flex-col min-h-0">
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
                    <input
                      type="text"
                      placeholder="Search registered referees by name, NRIC, or club..."
                      value={searchRegisteredQuery}
                      onChange={(e) => setSearchRegisteredQuery(e.target.value)}
                      className="w-full bg-ink border border-line text-sm rounded-xl py-2.5 pl-10 pr-4 text-text focus:outline-none focus:border-gold placeholder:text-text-dim/60"
                    />
                  </div>

                  <div className="border border-line rounded-2xl overflow-hidden bg-ink/30 flex flex-col max-h-[220px]">
                    <div className="p-3 bg-surface border-b border-line text-[10px] font-bold uppercase tracking-wider text-text-dim flex justify-between shrink-0">
                      <span>Name & NRIC</span>
                      <span>Club & Qualifications</span>
                    </div>
                    <div className="overflow-y-auto divide-y divide-line flex-1">
                      {(() => {
                        const availableRegisteredReferees = refereeAccounts.filter(acc => {
                          const cleanAccNric = acc.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                          const isAlreadyInComp = referees.some(r => r.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanAccNric);
                          if (isAlreadyInComp) return false;
                          
                          if (searchRegisteredQuery.trim()) {
                            const q = searchRegisteredQuery.toLowerCase();
                            return (
                              acc.fullName.toLowerCase().includes(q) ||
                              acc.nric.toLowerCase().includes(q) ||
                              (acc.clubName && acc.clubName.toLowerCase().includes(q))
                            );
                          }
                          return true;
                        });

                        if (availableRegisteredReferees.length === 0) {
                          return (
                            <div className="p-8 text-center text-sm text-text-dim">
                              No registered referees found matching your search.
                            </div>
                          );
                        }

                        return availableRegisteredReferees.map((acc) => {
                          const isSelected = selectedExistingRefereeNric === acc.nric;
                          return (
                            <button
                              key={acc.nric}
                              type="button"
                              onClick={() => {
                                setSelectedExistingRefereeNric(acc.nric);
                                setRefereeSpecialRole(acc.specialRole || 'None');
                              }}
                              className={`w-full text-left p-3.5 flex items-center justify-between text-sm transition cursor-pointer ${
                                isSelected 
                                  ? 'bg-gold/10 hover:bg-gold/15 border-l-4 border-gold' 
                                  : 'hover:bg-surface-2/40 border-l-4 border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                                  isSelected ? 'border-gold bg-gold text-ink' : 'border-line'
                                }`}>
                                  {isSelected && <Check className="w-3.5 h-3.5 font-bold" />}
                                </div>
                                <div>
                                  <div className="font-bold text-text text-sm">{acc.fullName}</div>
                                  <div className="text-xs text-text-dim font-mono">{acc.nric}</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs font-semibold text-text">{acc.clubName || 'N/A'}</div>
                                <div className="flex gap-1.5 mt-1 justify-end">
                                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-surface border border-line text-text-dim">
                                    Kyorugi: {acc.kyorugiStatus}
                                  </span>
                                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-surface border border-line text-text-dim">
                                    Poomsae: {acc.poomsaeStatus}
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>

                {selectedExistingRefereeNric && (() => {
                  const acc = refereeAccounts.find(a => a.nric === selectedExistingRefereeNric);
                  if (!acc) return null;
                  return (
                    <div className="border border-line rounded-2xl p-5 bg-surface-2/20 space-y-4 animate-fade-in text-sm">
                      <h4 className="text-xs font-bold text-gold uppercase tracking-wider">
                        Referee Selection Profile Details
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-4 text-xs">
                        <div>
                          <span className="text-text-dim uppercase tracking-wider block mb-0.5">Phone</span>
                          <span className="font-semibold text-text">{acc.phone || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-text-dim uppercase tracking-wider block mb-0.5">Residential Location</span>
                          <span className="font-semibold text-text">{acc.residentialLocation || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-text-dim uppercase tracking-wider block mb-0.5">Distance to Venue</span>
                          <span className="font-semibold text-text">{acc.distance !== undefined ? `${acc.distance} KM` : 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-text-dim uppercase tracking-wider block mb-0.5">Bank Information</span>
                          <span className="font-semibold text-text">
                            {acc.bankName ? `${acc.bankName} - ${acc.bankAccount || 'No Acct'}` : 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-text-dim uppercase tracking-wider block mb-0.5">Car Plate</span>
                          <span className="font-semibold text-text uppercase">{acc.carPlate || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-text-dim uppercase tracking-wider block mb-0.5">Accommodation Preference</span>
                          <span className="font-semibold text-text">{acc.accommodation || 'No'}</span>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-line/60">
                        <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">
                          Assign Special Appointed Role for This Tournament
                        </label>
                        <select 
                          value={refereeSpecialRole} 
                          onChange={(e) => setRefereeSpecialRole(e.target.value as any)} 
                          className="w-full sm:max-w-xs bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
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
                  );
                })()}
              </div>
            ) : (
              <div className="p-6 overflow-y-auto space-y-6 flex-1 min-h-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Full Name *</label>
                    <input type="text" value={refereeFullName} onChange={(e) => setRefereeFullName(e.target.value)} className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">NRIC Number *</label>
                    <input type="text" value={refereeNric} onChange={(e) => setRefereeNric(e.target.value)} className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Phone Number *</label>
                    <input type="tel" value={refereePhone} onChange={(e) => setRefereePhone(e.target.value)} className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">State / Club Name *</label>
                    <input type="text" value={refereeClubName} onChange={(e) => setRefereeClubName(e.target.value)} className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Residential Location *</label>
                    <input type="text" value={refereeResidential} onChange={(e) => setRefereeResidential(e.target.value)} className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Distance to Venue (Go & Return in KM) *</label>
                    <input type="number" value={refereeDistance} onChange={(e) => setRefereeDistance(e.target.value)} className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Bank Name *</label>
                    <input type="text" value={refereeBankName} onChange={(e) => setRefereeBankName(e.target.value)} className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Bank Account Number *</label>
                    <input type="text" value={refereeBankAccount} onChange={(e) => setRefereeBankAccount(e.target.value)} className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Kyorugi Referee Status *</label>
                    <select value={refereeKyorugiStatus} onChange={(e) => setRefereeKyorugiStatus(e.target.value as any)} className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition">
                      <option value="TR">Trainee Referee (TR)</option>
                      <option value="SR">State Referee (SR)</option>
                      <option value="NR">National Referee (NR)</option>
                      <option value="IR">International Referee (IR)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Poomsae Referee Status *</label>
                    <select value={refereePoomsaeStatus} onChange={(e) => setRefereePoomsaeStatus(e.target.value as any)} className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition">
                      <option value="TR">Trainee Referee (TR)</option>
                      <option value="SR">State Referee (SR)</option>
                      <option value="NR">National Referee (NR)</option>
                      <option value="IR">International Referee (IR)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Accommodation Required? *</label>
                    <select value={refereeAccommodation} onChange={(e) => setRefereeAccommodation(e.target.value as any)} className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition">
                      <option value="No">No - I will arrange my own</option>
                      <option value="Yes">Yes - Organizer to arrange</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Car Plate Number</label>
                    <input type="text" value={refereeCarPlate} onChange={(e) => setRefereeCarPlate(e.target.value)} className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold uppercase" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Special Appointed Role</label>
                    <select value={refereeSpecialRole} onChange={(e) => setRefereeSpecialRole(e.target.value as any)} className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition">
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
              </div>
            )}
            
            {/* Footer Actions */}
            <div className="p-6 border-t border-line flex justify-end gap-3 bg-surface-2/30 shrink-0">
              <button 
                onClick={() => setShowOrganizerAddReferee(false)}
                className="text-text-dim border border-line px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-surface-2 transition cursor-pointer"
              >
                Cancel
              </button>
              {addRefereeModalTab === 'existing' ? (
                <button 
                  onClick={handleOrganizerAddExistingReferee}
                  disabled={!selectedExistingRefereeNric}
                  className={`px-6 py-2.5 rounded-xl font-bold text-sm transition shadow flex items-center gap-2 ${
                    selectedExistingRefereeNric
                      ? 'bg-gold hover:bg-yellow-400 text-ink cursor-pointer'
                      : 'bg-gold/40 text-ink/50 cursor-not-allowed'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  Add Referee
                </button>
              ) : (
                <button 
                  onClick={handleOrganizerSaveNewReferee}
                  className="bg-gold hover:bg-yellow-400 text-ink px-6 py-2.5 rounded-xl font-bold text-sm transition shadow flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Add Referee
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* BATCH PRINT & EXPORT PORTAL MODAL */}
      {showPrintAllCardsModal && activeComp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm animate-fade-in print:hidden">
          <div className="bg-surface border border-line rounded-3xl w-full max-w-5xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-line bg-gradient-to-b from-surface-2/50 to-transparent flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center text-gold">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold uppercase tracking-wider text-text font-display">Print & Export ID Cards Station</h2>
                  <p className="text-xs text-text-dim">Batch print entry passes with cut-borders or export high-resolution individual PNGs.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowPrintAllCardsModal(false)}
                className="text-text-dim hover:text-text bg-surface-2 hover:bg-line border border-line px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col lg:flex-row gap-6">
              
              {/* Left Panel: Controls */}
              <div className="w-full lg:w-[320px] shrink-0 space-y-5">
                <div className="space-y-4 bg-ink/30 border border-line p-4 rounded-2xl">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gold">Filter Entrants</h3>
                  
                  {/* Search bar */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-text-dim">Search Athlete</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-dim" />
                      <input 
                        type="text" 
                        value={printSearch}
                        onChange={(e) => setPrintSearch(e.target.value)}
                        placeholder="Name, ID, or Club..." 
                        className="w-full bg-ink border border-line rounded-xl pl-9 pr-3 py-2 text-xs text-text outline-none focus:border-gold"
                      />
                    </div>
                  </div>

                  {/* Club Filter */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-text-dim">Club Represented</label>
                    <select 
                      value={printFilterClub}
                      onChange={(e) => setPrintFilterClub(e.target.value)}
                      className="w-full bg-ink border border-line rounded-xl px-3 py-2 text-xs text-text outline-none focus:border-gold"
                    >
                      <option value="all">All Clubs ({Array.from(new Set(players.map(p => p.club).filter(Boolean))).length})</option>
                      {Array.from(new Set(players.map(p => p.club).filter(Boolean))).sort().map(club => (
                        <option key={club} value={club}>{club}</option>
                      ))}
                    </select>
                  </div>

                  {/* Division / Bracket Filter */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-text-dim">Age Division / Bracket</label>
                    <select 
                      value={printFilterBracket}
                      onChange={(e) => setPrintFilterBracket(e.target.value)}
                      className="w-full bg-ink border border-line rounded-xl px-3 py-2 text-xs text-text outline-none focus:border-gold"
                    >
                      <option value="all">All Brackets ({Array.from(new Set(players.map(p => p.ageGroup).filter(Boolean))).length})</option>
                      {Array.from(new Set(players.map(p => p.ageGroup).filter(Boolean))).sort().map(bracket => (
                        <option key={bracket} value={bracket}>{bracket}</option>
                      ))}
                    </select>
                  </div>

                  {/* Exclusion Counter & Reset */}
                  {excludedPlayerIds.size > 0 && (
                    <div className="flex items-center justify-between text-xs bg-red-500/10 border border-red-500/20 rounded-xl p-2.5 animate-fade-in text-red-400">
                      <span>{excludedPlayerIds.size} cards manually excluded</span>
                      <button 
                        onClick={() => setExcludedPlayerIds(new Set())}
                        className="underline hover:text-red-300 font-bold"
                      >
                        Reset
                      </button>
                    </div>
                  )}
                </div>

                {/* Print Stats */}
                <div className="bg-surface-2 border border-line rounded-2xl p-4 space-y-2 text-xs text-text-dim">
                  <div className="flex justify-between">
                    <span>Matched Entrants:</span>
                    <span className="font-bold text-text">
                      {players.filter(p => {
                        if (printFilterClub !== 'all' && p.club !== printFilterClub) return false;
                        if (printFilterBracket !== 'all' && p.ageGroup !== printFilterBracket) return false;
                        if (printSearch.trim() !== '') {
                          const q = printSearch.toLowerCase();
                          return p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || (p.club && p.club.toLowerCase().includes(q));
                        }
                        return true;
                      }).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Excluded:</span>
                    <span className="font-bold text-text">{excludedPlayerIds.size}</span>
                  </div>
                  <div className="flex justify-between border-t border-line/50 pt-2 font-semibold">
                    <span>Selected to Print:</span>
                    <span className="text-gold font-bold">
                      {players.filter(p => {
                        if (excludedPlayerIds.has(p.id)) return false;
                        if (printFilterClub !== 'all' && p.club !== printFilterClub) return false;
                        if (printFilterBracket !== 'all' && p.ageGroup !== printFilterBracket) return false;
                        if (printSearch.trim() !== '') {
                          const q = printSearch.toLowerCase();
                          return p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || (p.club && p.club.toLowerCase().includes(q));
                        }
                        return true;
                      }).length}
                    </span>
                  </div>
                </div>

                {/* Primary Actions */}
                <div className="space-y-3">
                  <button 
                    onClick={() => {
                      const selectedToPrint = players.filter(p => {
                        if (excludedPlayerIds.has(p.id)) return false;
                        if (printFilterClub !== 'all' && p.club !== printFilterClub) return false;
                        if (printFilterBracket !== 'all' && p.ageGroup !== printFilterBracket) return false;
                        if (printSearch.trim() !== '') {
                          const q = printSearch.toLowerCase();
                          return p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || (p.club && p.club.toLowerCase().includes(q));
                        }
                        return true;
                      });
                      if (selectedToPrint.length === 0) {
                        triggerMsg('No ID cards selected for printing.', 'error');
                        return;
                      }
                      window.print();
                    }}
                    className="w-full bg-gold hover:opacity-90 text-ink font-bold py-3.5 px-4 rounded-xl shadow-md transition duration-200 cursor-pointer flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Launch System Print</span>
                  </button>

                  <button 
                    onClick={() => {
                      const selectedToPrint = players.filter(p => {
                        if (excludedPlayerIds.has(p.id)) return false;
                        if (printFilterClub !== 'all' && p.club !== printFilterClub) return false;
                        if (printFilterBracket !== 'all' && p.ageGroup !== printFilterBracket) return false;
                        if (printSearch.trim() !== '') {
                          const q = printSearch.toLowerCase();
                          return p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || (p.club && p.club.toLowerCase().includes(q));
                        }
                        return true;
                      });
                      downloadAllSelectedCards(selectedToPrint);
                    }}
                    disabled={isDownloadingAll || players.filter(p => {
                      if (excludedPlayerIds.has(p.id)) return false;
                      if (printFilterClub !== 'all' && p.club !== printFilterClub) return false;
                      if (printFilterBracket !== 'all' && p.ageGroup !== printFilterBracket) return false;
                      if (printSearch.trim() !== '') {
                        const q = printSearch.toLowerCase();
                        return p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || (p.club && p.club.toLowerCase().includes(q));
                      }
                      return true;
                    }).length === 0}
                    className="w-full bg-ink border border-line text-text hover:bg-line font-bold py-3 px-4 rounded-xl transition duration-200 cursor-pointer flex items-center justify-center gap-2 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download className="w-4 h-4" />
                    <span>Batch Export PNGs</span>
                  </button>

                  {isDownloadingAll && (
                    <div className="space-y-1.5 animate-fade-in bg-ink/40 p-3 rounded-xl border border-line">
                      <div className="flex justify-between text-[10px] text-text-dim">
                        <span>Generating high-res files...</span>
                        <span className="font-bold">{downloadProgress} / {downloadTotal}</span>
                      </div>
                      <div className="w-full bg-ink rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-gold h-full transition-all duration-150" 
                          style={{ width: `${(downloadProgress / downloadTotal) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Calibration Tips */}
                <div className="bg-gold/5 border border-gold/15 rounded-2xl p-4 text-[11px] leading-relaxed text-text-dim space-y-2">
                  <p className="font-bold text-gold flex items-center gap-1">
                    <Sliders className="w-3.5 h-3.5" />
                    Printer Calibration Tips:
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-text-dim/90">
                    <li>Enable <strong>"Background graphics"</strong> to print background colors and assets.</li>
                    <li>Turn <strong>OFF</strong> browser <strong>"Headers and footers"</strong> to avoid margin noise.</li>
                    <li>Choose <strong>"Save as PDF"</strong> to compile all passes into a single vector-grade printable file.</li>
                    <li>The layout automatically aligns <strong>2 columns</strong> cleanly with scissors lines.</li>
                  </ul>
                </div>
              </div>

              {/* Right Panel: Scrollable live list & Preview */}
              <div className="flex-1 bg-ink/20 border border-line rounded-3xl p-4 flex flex-col space-y-3">
                <div className="flex justify-between items-center text-xs text-text-dim px-2">
                  <span className="font-bold uppercase tracking-wider">Live Preview Canvas</span>
                  <span className="text-[10px] italic">Hover on card to exclude it from batch</span>
                </div>

                {players.filter(p => {
                  if (printFilterClub !== 'all' && p.club !== printFilterClub) return false;
                  if (printFilterBracket !== 'all' && p.ageGroup !== printFilterBracket) return false;
                  if (printSearch.trim() !== '') {
                    const q = printSearch.toLowerCase();
                    return p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || (p.club && p.club.toLowerCase().includes(q));
                  }
                  return true;
                }).length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-12 text-text-dim space-y-2 bg-ink/40 border border-dashed border-line rounded-2xl">
                    <Users className="w-10 h-10 text-text-dim/30 mx-auto" />
                    <p className="text-sm font-semibold">No entrants match your search filter.</p>
                    <p className="text-xs">Adjust your dropdown or search parameters above.</p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto max-h-[55vh] p-2 bg-ink rounded-2xl border border-line">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 justify-items-center py-4">
                      {players.filter(p => {
                        if (printFilterClub !== 'all' && p.club !== printFilterClub) return false;
                        if (printFilterBracket !== 'all' && p.ageGroup !== printFilterBracket) return false;
                        if (printSearch.trim() !== '') {
                          const q = printSearch.toLowerCase();
                          return p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || (p.club && p.club.toLowerCase().includes(q));
                        }
                        return true;
                      }).map((p) => {
                        const isExcluded = excludedPlayerIds.has(p.id);
                        const belt = beltColorFor(p.ageGroup || '');
                        const fields = getIdCardFields(activeComp);
                        
                        const getFontSizePx = (size: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl', defaultVal: string): string => {
                          const map: Record<string, string> = {
                            'xs': '9px',
                            'sm': '11px',
                            'base': '13px',
                            'lg': '15px',
                            'xl': '18px',
                            '2xl': '22px',
                            '3xl': '26px'
                          };
                          return map[size] || defaultVal;
                        };

                        return (
                          <div 
                            key={`preview-card-wrap-${p.id}`}
                            className={`relative group transition-all duration-200 ${isExcluded ? 'opacity-40 scale-95 saturate-50' : 'hover:scale-[1.01]'}`}
                          >
                            {/* Card Exclusion Action Shield */}
                            <div className="absolute inset-0 z-30 bg-black/60 rounded-3xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const updated = new Set(excludedPlayerIds);
                                  if (isExcluded) {
                                    updated.delete(p.id);
                                  } else {
                                    updated.add(p.id);
                                  }
                                  setExcludedPlayerIds(updated);
                                }}
                                className="bg-ink/90 border border-line text-xs font-bold py-2 px-4 rounded-xl shadow-lg flex items-center gap-1.5 hover:bg-gold hover:text-ink transition cursor-pointer"
                              >
                                {isExcluded ? <CheckCircle className="w-4 h-4 text-good" /> : <Trash2 className="w-4 h-4 text-hong" />}
                                <span>{isExcluded ? 'Include in Batch' : 'Exclude from Print'}</span>
                              </button>
                            </div>

                            {/* Actual ID Card Layout */}
                            <div className="w-[300px] h-[420px] bg-gradient-to-br from-[#12211C] to-[#0A1310] border border-slate-700/60 rounded-3xl overflow-hidden shadow-2xl relative flex flex-col justify-between">
                              {activeComp.idCardBgUrl && (
                                <>
                                  <div className="absolute inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: `url(${activeComp.idCardBgUrl})` }} />
                                  <div className="absolute inset-0 z-0 bg-black/40 mix-blend-multiply" />
                                </>
                              )}
                              
                              <div className="relative z-10 h-full flex-1 flex flex-col justify-between py-2.5">
                                {fields.filter(f => f.visible).map(field => {
                                  if (field.id === 'header') {
                                    return (
                                      <div key="header" className={`h-8 bg-gradient-to-r from-hong via-hong to-chong flex ${
                                        field.align === 'left' ? 'justify-start gap-2' :
                                        field.align === 'right' ? 'justify-end gap-2' :
                                        field.align === 'center' ? 'justify-center gap-2' :
                                        'justify-between'
                                      } items-center px-3 shrink-0 shadow-sm w-full`}>
                                        <span className="font-display font-bold tracking-wider uppercase drop-shadow-sm truncate" style={{ fontSize: (p.id.startsWith('STAFF-') || p.ageGroup === 'STAFF') ? `${parseInt(getFontSizePx(field.fontSize, '8px'), 10) + 3}px` : getFontSizePx(field.fontSize, '8px'), color: field.color || '#ffffff' }}>{activeComp.name}</span>
                                        
                                      </div>
                                    );
                                  }
                                  if (field.id === 'belt') {
                                    return (
                                      <div key="belt" className="h-1.5 w-full shrink-0" style={{ backgroundColor: belt }} />
                                    );
                                  }
                                  if (field.id === 'photo') {
                                    return (
                                      <div key="photo" className={`px-4 py-1 shrink-0 flex ${
                                        field.align === 'left' ? 'justify-start' :
                                        field.align === 'right' ? 'justify-end' :
                                        'justify-center'
                                      }`}>
                                        <div className="w-14 h-18 bg-ink rounded-lg border border-line flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                                          <User className="w-5 h-5 text-text-dim/40" />
                                        </div>
                                      </div>
                                    );
                                  }
                                  if (field.id === 'name') {
                                    return (
                                      <div key="name" className={`px-4 py-1 shrink-0 ${
                                        field.align === 'left' ? 'text-left' :
                                        field.align === 'right' ? 'text-right' :
                                        'text-center'
                                      }`}>
                                        <h3 className="font-display font-bold leading-tight tracking-wide uppercase line-clamp-2 text-text" style={{ fontSize: getFontSizePx(field.fontSize, '13px'), color: field.color || '#ffffff' }}>{p.name}</h3>
                                      </div>
                                    );
                                  }
                                  if (field.id === 'club') {
                                    return (
                                      <div key="club" className={`px-4 py-1 shrink-0 ${
                                        field.align === 'left' ? 'text-left' :
                                        field.align === 'right' ? 'text-right' :
                                        'text-center'
                                      }`}>
                                        <p className="uppercase tracking-widest text-text-dim" style={{ fontSize: getFontSizePx(field.fontSize, '8px'), color: field.color || '#a0aec0' }}>{p.club}</p>
                                      </div>
                                    );
                                  }
                                  if (field.id === 'athleteId') {
                                    if (p.id.startsWith('STAFF-') || p.ageGroup === 'STAFF') return null;
                                    return (
                                      <div key="athleteId" className={`px-4 py-1 shrink-0 ${
                                        field.align === 'left' ? 'text-left' :
                                        field.align === 'right' ? 'text-right' :
                                        'text-center'
                                      }`}>
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
                                      <div key="metadata" className={`px-4 py-1 shrink-0 grid grid-cols-2 gap-1.5 text-[9px] border-t border-line/30 pt-2 ${
                                        field.align === 'left' ? 'text-left' :
                                        field.align === 'right' ? 'text-right' :
                                        'text-center'
                                      }`}>
                                        <div>
                                          <span className="block text-[6px] text-text-dim/60 uppercase tracking-widest font-bold">Category</span>
                                          <span className="font-medium line-clamp-1 text-text" style={{ fontSize: getFontSizePx(field.fontSize, '8px'), color: field.color || '#ffffff' }}>{p.ageGroup}</span>
                                        </div>
                                        <div>
                                          <span className="block text-[6px] text-text-dim/60 uppercase tracking-widest font-bold">Gender</span>
                                          <span className="font-medium text-text" style={{ fontSize: getFontSizePx(field.fontSize, '8px'), color: field.color || '#ffffff' }}>{p.gender}</span>
                                        </div>
                                        <div>
                                          <span className="block text-[6px] text-text-dim/60 uppercase tracking-widest font-bold">Weight</span>
                                          <span className="font-medium line-clamp-1 text-text" style={{ fontSize: getFontSizePx(field.fontSize, '8px'), color: field.color || '#ffffff' }}>{p.weightClass}</span>
                                        </div>
                                        <div>
                                          <span className="block text-[6px] text-text-dim/60 uppercase tracking-widest font-bold">DOB</span>
                                          <span className="font-medium text-text" style={{ fontSize: getFontSizePx(field.fontSize, '8px'), color: field.color || '#ffffff' }}>{p.dob}</span>
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
                                      <div key="qrcode" className={`px-4 py-1 shrink-0 ${containerClass} border-t border-dashed border-line/30 pt-2`}>
                                        <div className="bg-white p-1 rounded-lg inline-block shadow-md shrink-0">
                                          <QRCodeSVG 
                                            value={`${activeComp.id}::${p.id}`} 
                                            size={40} 
                                            level="M" 
                                            includeMargin={false}
                                          />
                                        </div>
                                        <div className={textAlignmentClass}>
                                          {!(p.id.startsWith('STAFF-') || p.ageGroup === 'STAFF') && <p className="font-display font-bold uppercase tracking-wider bg-slate-950/30 px-1.5 py-0.5 rounded border border-white/10 text-white inline-block mb-1" style={{ fontSize: getFontSizePx(field.fontSize, '8px') }}>{p.event}</p>}
                                        <p className="font-display font-bold uppercase tracking-wider text-[7px]" style={{ fontSize: getFontSizePx(field.fontSize, '7px'), color: field.color || '#D4AF37' }}>Tournament Entry Pass</p>
                                          <p className="mt-0.5 leading-normal text-[5.5px] text-text-dim" style={{ fontSize: getFontSizePx(field.fontSize, '5.5px'), color: '#a0aec0', opacity: 0.85 }}>Scan to digitally verify {p.id.startsWith('STAFF-') || p.ageGroup === 'STAFF' ? 'personnel.' : 'athlete.'}</p>
                                        </div>
                                      </div>
                                    );
                                  }
                                  return null;
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>
      )}

      {/* PRINT-ONLY AREA FOR ID CARDS */}
      {activeComp && (
        <div className="hidden print:block bg-white text-black min-h-screen p-0 m-0 w-full" id="printable-cards-container">
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 justify-items-center p-4">
            {players.filter(p => !excludedPlayerIds.has(p.id) && 
              (printFilterClub === 'all' || p.club === printFilterClub) &&
              (printFilterBracket === 'all' || p.ageGroup === printFilterBracket) &&
              (printSearch.trim() === '' || 
                p.name.toLowerCase().includes(printSearch.toLowerCase()) || 
                p.id.toLowerCase().includes(printSearch.toLowerCase()) ||
                (p.club && p.club.toLowerCase().includes(printSearch.toLowerCase())))
            ).map((p) => {
              const belt = beltColorFor(p.ageGroup || '');
              const fields = getIdCardFields(activeComp);
              
              const getFontSizePx = (size: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl', defaultVal: string): string => {
                const map: Record<string, string> = {
                  'xs': '9px',
                  'sm': '11px',
                  'base': '13px',
                  'lg': '15px',
                  'xl': '18px',
                  '2xl': '22px',
                  '3xl': '26px'
                };
                return map[size] || defaultVal;
              };

              return (
                <div 
                  key={`print-card-${p.id}`}
                  className="w-[336px] h-[480px] bg-gradient-to-br from-[#12211C] to-[#0A1310] border-2 border-dashed border-gray-400 rounded-3xl overflow-hidden relative flex flex-col justify-between break-inside-avoid page-break-inside-avoid"
                >
                  {activeComp.idCardBgUrl && (
                    <>
                      <div className="absolute inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: `url(${activeComp.idCardBgUrl})` }} />
                      <div className="absolute inset-0 z-0 bg-black/40 mix-blend-multiply" />
                    </>
                  )}
                  
                  <div className="relative z-10 h-full flex-1 flex flex-col justify-between py-2.5">
                    {fields.filter(f => f.visible).map(field => {
                      if (field.id === 'header') {
                        return (
                          <div key="header" className={`h-8 bg-gradient-to-r from-hong via-hong to-chong flex ${
                            field.align === 'left' ? 'justify-start gap-2' :
                            field.align === 'right' ? 'justify-end gap-2' :
                            field.align === 'center' ? 'justify-center gap-2' :
                            'justify-between'
                          } items-center px-3 shrink-0 shadow-sm w-full`}>
                            <span className="font-display font-bold tracking-wider uppercase drop-shadow-sm truncate text-white" style={{ fontSize: (p.id.startsWith('STAFF-') || p.ageGroup === 'STAFF') ? `${parseInt(getFontSizePx(field.fontSize, '8px'), 10) + 3}px` : getFontSizePx(field.fontSize, '8px'), color: field.color || '#ffffff' }}>{activeComp.name}</span>
                            
                          </div>
                        );
                      }
                      if (field.id === 'belt') {
                        return (
                          <div key="belt" className="h-1.5 w-full shrink-0" style={{ backgroundColor: belt }} />
                        );
                      }
                      if (field.id === 'photo') {
                        return (
                          <div key="photo" className={`px-4 py-1 shrink-0 flex ${
                            field.align === 'left' ? 'justify-start' :
                            field.align === 'right' ? 'justify-end' :
                            'justify-center'
                          }`}>
                            <div className="w-16 h-20 bg-ink rounded-lg border border-line flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                              <User className="w-5 h-5 text-text-dim/40" />
                            </div>
                          </div>
                        );
                      }
                      if (field.id === 'name') {
                        return (
                          <div key="name" className={`px-4 py-1 shrink-0 ${
                            field.align === 'left' ? 'text-left' :
                            field.align === 'right' ? 'text-right' :
                            'text-center'
                          }`}>
                            <h3 className="font-display font-bold leading-tight tracking-wide uppercase line-clamp-2 text-white" style={{ fontSize: getFontSizePx(field.fontSize, '14px'), color: field.color || '#ffffff' }}>{p.name}</h3>
                          </div>
                        );
                      }
                      if (field.id === 'club') {
                        return (
                          <div key="club" className={`px-4 py-1 shrink-0 ${
                            field.align === 'left' ? 'text-left' :
                            field.align === 'right' ? 'text-right' :
                            'text-center'
                          }`}>
                            <p className="uppercase tracking-widest text-text-dim" style={{ fontSize: getFontSizePx(field.fontSize, '8px'), color: field.color || '#a0aec0' }}>{p.club}</p>
                          </div>
                        );
                      }
                      if (field.id === 'athleteId') {
                        if (p.id.startsWith('STAFF-') || p.ageGroup === 'STAFF') return null;
                        return (
                          <div key="athleteId" className={`px-4 py-1 shrink-0 ${
                            field.align === 'left' ? 'text-left' :
                            field.align === 'right' ? 'text-right' :
                            'text-center'
                          }`}>
                            <span className="inline-block bg-surface border border-line font-mono px-1.5 py-0.5 rounded font-bold text-gold" style={{ fontSize: getFontSizePx(field.fontSize, '8px'), color: field.color || '#D4AF37' }}>{p.id}</span>
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
                          <div key="metadata" className={`px-4 py-1 shrink-0 grid grid-cols-2 gap-2 text-[10px] border-t border-line/30 pt-2.5 ${
                            field.align === 'left' ? 'text-left' :
                            field.align === 'right' ? 'text-right' :
                            'text-center'
                          }`}>
                            <div>
                              <span className="block text-[7px] text-text-dim/60 uppercase tracking-widest font-bold">Category</span>
                              <span className="font-medium line-clamp-1 text-white" style={{ fontSize: getFontSizePx(field.fontSize, '9px'), color: field.color || '#ffffff' }}>{p.ageGroup}</span>
                            </div>
                            <div>
                              <span className="block text-[7px] text-text-dim/60 uppercase tracking-widest font-bold">Gender</span>
                              <span className="font-medium text-white" style={{ fontSize: getFontSizePx(field.fontSize, '9px'), color: field.color || '#ffffff' }}>{p.gender}</span>
                            </div>
                            <div>
                              <span className="block text-[7px] text-text-dim/60 uppercase tracking-widest font-bold">Weight</span>
                              <span className="font-medium line-clamp-1 text-white" style={{ fontSize: getFontSizePx(field.fontSize, '9px'), color: field.color || '#ffffff' }}>{p.weightClass}</span>
                            </div>
                            <div>
                              <span className="block text-[7px] text-text-dim/60 uppercase tracking-widest font-bold">DOB</span>
                              <span className="font-medium text-white" style={{ fontSize: getFontSizePx(field.fontSize, '9px'), color: field.color || '#ffffff' }}>{p.dob}</span>
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
                          <div key="qrcode" className={`px-4 py-1 shrink-0 ${containerClass} border-t border-dashed border-line/30 pt-2`}>
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
                                        <p className="font-display font-bold uppercase tracking-wider text-[7px]" style={{ fontSize: getFontSizePx(field.fontSize, '7px'), color: field.color || '#D4AF37' }}>Tournament Entry Pass</p>
                              <p className="mt-0.5 leading-normal text-[6px] text-text-dim" style={{ fontSize: getFontSizePx(field.fontSize, '6px'), color: '#a0aec0', opacity: 0.85 }}>Scan to digitally verify {p.id.startsWith('STAFF-') || p.ageGroup === 'STAFF' ? 'personnel.' : 'athlete.'}</p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Off-screen elements for batch image snapshots */}
      {activeComp && (
        <div className="absolute left-[-9999px] top-[-9999px] pointer-events-none print:hidden" aria-hidden="true">
          {[...players, ...staffPasses].map(p => {
            const belt = beltColorFor(p.ageGroup || '');
            const fields = getIdCardFields(activeComp);
            
            const getFontSizePx = (size: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl', defaultVal: string): string => {
              const map: Record<string, string> = {
                'xs': '9px',
                'sm': '11px',
                'base': '13px',
                'lg': '15px',
                'xl': '18px',
                '2xl': '22px',
                '3xl': '26px'
              };
              return map[size] || defaultVal;
            };

            return (
              <div 
                key={`batch-wrapper-${p.id}`}
                id={p.id.startsWith('STAFF-') ? `staff-card-${p.id}` : `batch-card-${p.id}`}
                className="w-[336px] h-[480px] bg-gradient-to-br from-[#12211C] to-[#0A1310] border border-slate-700/60 rounded-3xl overflow-hidden relative flex flex-col justify-between"
              >
                {activeComp.idCardBgUrl && (
                  <>
                    <div className="absolute inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: `url(${activeComp.idCardBgUrl})` }} />
                    <div className="absolute inset-0 z-0 bg-black/40 mix-blend-multiply" />
                  </>
                )}
                <div className="relative z-10 h-full flex-1 flex flex-col justify-between py-2.5">
                  {fields.filter(f => f.visible).map(field => {
                    if (field.id === 'header') {
                      return (
                        <div key="header" className={`h-8 bg-gradient-to-r from-hong via-hong to-chong flex ${
                          field.align === 'left' ? 'justify-start gap-2' :
                          field.align === 'right' ? 'justify-end gap-2' :
                          field.align === 'center' ? 'justify-center gap-2' :
                          'justify-between'
                        } items-center px-3 shrink-0 shadow-sm w-full`}>
                          <span className="font-display font-bold tracking-wider uppercase drop-shadow-sm truncate text-white" style={{ fontSize: (p.id.startsWith('STAFF-') || p.ageGroup === 'STAFF') ? `${parseInt(getFontSizePx(field.fontSize, '8px'), 10) + 3}px` : getFontSizePx(field.fontSize, '8px'), color: field.color || '#ffffff' }}>{activeComp.name}</span>
                          
                        </div>
                      );
                    }
                    if (field.id === 'belt') {
                      return (
                        <div key="belt" className="h-1.5 w-full shrink-0" style={{ backgroundColor: belt }} />
                      );
                    }
                    if (field.id === 'photo') {
                      return (
                        <div key="photo" className={`px-4 py-1 shrink-0 flex ${
                          field.align === 'left' ? 'justify-start' :
                          field.align === 'right' ? 'justify-end' :
                          'justify-center'
                        }`}>
                          <div className="w-16 h-20 bg-ink rounded-lg border border-line flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                            <User className="w-5 h-5 text-text-dim/40" />
                          </div>
                        </div>
                      );
                    }
                    if (field.id === 'name') {
                      return (
                        <div key="name" className={`px-4 py-1 shrink-0 ${
                          field.align === 'left' ? 'text-left' :
                          field.align === 'right' ? 'text-right' :
                          'text-center'
                        }`}>
                          <h3 className="font-display font-bold leading-tight tracking-wide uppercase line-clamp-2 text-white" style={{ fontSize: getFontSizePx(field.fontSize, '14px'), color: field.color || '#ffffff' }}>{p.name}</h3>
                        </div>
                      );
                    }
                    if (field.id === 'club') {
                      return (
                        <div key="club" className={`px-4 py-1 shrink-0 ${
                          field.align === 'left' ? 'text-left' :
                          field.align === 'right' ? 'text-right' :
                          'text-center'
                        }`}>
                          <p className="uppercase tracking-widest text-text-dim" style={{ fontSize: getFontSizePx(field.fontSize, '8px'), color: field.color || '#a0aec0' }}>{p.club}</p>
                        </div>
                      );
                    }
                    if (field.id === 'athleteId') {
                      if (p.id.startsWith('STAFF-') || p.ageGroup === 'STAFF') return null;
                      return (
                        <div key="athleteId" className={`px-4 py-1 shrink-0 ${
                          field.align === 'left' ? 'text-left' :
                          field.align === 'right' ? 'text-right' :
                          'text-center'
                        }`}>
                          <span className="inline-block bg-surface border border-line font-mono px-1.5 py-0.5 rounded font-bold text-gold" style={{ fontSize: getFontSizePx(field.fontSize, '8px'), color: field.color || '#D4AF37' }}>{p.id}</span>
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
                        <div key="metadata" className={`px-4 py-1 shrink-0 grid grid-cols-2 gap-2 text-[10px] border-t border-line/30 pt-2.5 ${
                          field.align === 'left' ? 'text-left' :
                          field.align === 'right' ? 'text-right' :
                          'text-center'
                        }`}>
                          <div>
                            <span className="block text-[7px] text-text-dim/60 uppercase tracking-widest font-bold">Category</span>
                            <span className="font-medium line-clamp-1 text-white" style={{ fontSize: getFontSizePx(field.fontSize, '9px'), color: field.color || '#ffffff' }}>{p.ageGroup}</span>
                          </div>
                          <div>
                            <span className="block text-[7px] text-text-dim/60 uppercase tracking-widest font-bold">Gender</span>
                            <span className="font-medium text-white" style={{ fontSize: getFontSizePx(field.fontSize, '9px'), color: field.color || '#ffffff' }}>{p.gender}</span>
                          </div>
                          <div>
                            <span className="block text-[7px] text-text-dim/60 uppercase tracking-widest font-bold">Weight</span>
                            <span className="font-medium line-clamp-1 text-white" style={{ fontSize: getFontSizePx(field.fontSize, '9px'), color: field.color || '#ffffff' }}>{p.weightClass}</span>
                          </div>
                          <div>
                            <span className="block text-[7px] text-text-dim/60 uppercase tracking-widest font-bold">DOB</span>
                            <span className="font-medium text-white" style={{ fontSize: getFontSizePx(field.fontSize, '9px'), color: field.color || '#ffffff' }}>{p.dob}</span>
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
                        <div key="qrcode" className={`px-4 py-1 shrink-0 ${containerClass} border-t border-dashed border-line/30 pt-2`}>
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
                                        <p className="font-display font-bold uppercase tracking-wider text-[7px]" style={{ fontSize: getFontSizePx(field.fontSize, '7px'), color: field.color || '#D4AF37' }}>Tournament Entry Pass</p>
                            <p className="mt-0.5 leading-normal text-[6px] text-text-dim" style={{ fontSize: getFontSizePx(field.fontSize, '6px'), color: '#a0aec0', opacity: 0.85 }}>Scan to digitally verify {p.id.startsWith('STAFF-') || p.ageGroup === 'STAFF' ? 'personnel.' : 'athlete.'}</p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PAYMENT RECEIPT MODAL */}
      {selectedClubReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/85 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-line rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-line">
              <div>
                <h3 className="text-sm font-bold text-text uppercase tracking-wider">{selectedClubReceipt.clubName} Payment Receipt</h3>
                <p className="text-[10px] text-text-dim uppercase tracking-wider">Uploaded at {selectedClubReceipt.uploadedAt}</p>
              </div>
              <button 
                onClick={() => setSelectedClubReceipt(null)}
                className="text-text-dim hover:text-text bg-line/20 hover:bg-line/40 p-1.5 rounded-full transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex-1 bg-ink/40 rounded-2xl p-2 border border-line/50 flex items-center justify-center min-h-[300px] max-h-[500px] overflow-y-auto">
              <img 
                src={selectedClubReceipt.receiptUrl} 
                alt="Payment Receipt" 
                className="max-w-full max-h-[480px] object-contain rounded-lg"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <a 
                href={selectedClubReceipt.receiptUrl} 
                download={`Receipt-${selectedClubReceipt.clubName.replace(/\s+/g, '-')}.png`}
                className="bg-gold text-ink hover:opacity-90 font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download File</span>
              </a>
              <button 
                onClick={() => setSelectedClubReceipt(null)}
                className="bg-ink text-text-dim border border-line hover:text-text px-4 py-2 rounded-xl text-xs transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT TOURNAMENT MODAL */}
      {showEditCompModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-line rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
            <div className="p-6 border-b border-line flex justify-between items-center bg-gradient-to-r from-surface to-surface-2">
              <h2 className="text-base font-bold text-text uppercase tracking-wider flex items-center gap-2">
                <Edit className="w-5 h-5 text-gold" />
                Edit Tournament Details
              </h2>
              <button 
                onClick={() => setShowEditCompModal(false)}
                className="text-text-dim hover:text-white transition p-2 hover:bg-surface-2 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
              <div>
                <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Championship Title *</label>
                <input 
                  type="text" 
                  value={editCompName} 
                  onChange={(e) => setEditCompName(e.target.value)}
                  className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold" 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Venue *</label>
                <input 
                  type="text" 
                  value={editCompVenue} 
                  onChange={(e) => setEditCompVenue(e.target.value)}
                  className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Start Date *</label>
                  <input 
                    type="date" 
                    value={editCompDate} 
                    onChange={(e) => setEditCompDate(e.target.value)}
                    className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">End Date *</label>
                  <input 
                    type="date" 
                    value={editCompEndDate} 
                    onChange={(e) => setEditCompEndDate(e.target.value)}
                    className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Registration Close Date *</label>
                <input 
                  type="date" 
                  value={editCompRegistrationCloseDate} 
                  onChange={(e) => setEditCompRegistrationCloseDate(e.target.value)}
                  className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold" 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1">Coach / Team Auth Passcode *</label>
                <input 
                  type="text" 
                  value={editCompPasscode} 
                  onChange={(e) => setEditCompPasscode(e.target.value)}
                  className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold" 
                />
              </div>
            </div>

            <div className="p-4 border-t border-line bg-surface-2/50 flex justify-end gap-3">
              <button 
                onClick={() => setShowEditCompModal(false)}
                className="px-4 py-2 rounded-xl text-text-dim hover:text-text font-bold text-xs hover:bg-surface border border-line transition"
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  if (!editCompName.trim() || !editCompVenue.trim() || !editCompDate.trim() || !editCompEndDate.trim() || !editCompPasscode.trim()) {
                    triggerMsg('Please fill in all required fields.', 'error');
                    return;
                  }
                  const updated = competitions.map(c => 
                    c.id === compId ? { 
                      ...c, 
                      name: editCompName.trim(),
                      venue: editCompVenue.trim(),
                      date: editCompDate,
                      endDate: editCompEndDate,
                      registrationCloseDate: editCompRegistrationCloseDate || undefined,
                      staffCode: editCompPasscode.trim()
                    } : c
                  );
                  await saveCompsToStorage(updated);
                  setShowEditCompModal(false);
                  triggerMsg('Tournament updated successfully.', 'ok');
                }}
                className="px-4 py-2 rounded-xl bg-gold hover:bg-yellow-400 text-ink font-bold text-xs transition"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REFEREE ACCOMMODATION DETAILS MODAL */}
      {editingAccReferee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-line rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-line flex justify-between items-center bg-gradient-to-r from-surface to-surface-2">
              <h2 className="text-base font-bold text-text uppercase tracking-wider flex items-center gap-2">
                <MapPin className="w-5 h-5 text-gold" />
                Accommodation Settings
              </h2>
              <button 
                onClick={() => setEditingAccReferee(null)}
                className="text-text-dim hover:text-white transition p-2 hover:bg-surface-2 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-bold text-text-dim">REFEREE NAME</p>
                <p className="text-sm font-semibold text-text">{editingAccReferee.fullName}</p>
                <p className="text-[10px] text-text-dim font-mono">{editingAccReferee.nric}</p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-text-dim uppercase tracking-wider">Accommodation Details (Override)</label>
                <textarea
                  rows={3}
                  value={editAccDetails}
                  onChange={(e) => setEditAccDetails(e.target.value)}
                  placeholder="e.g. Hotel Grand Chancellor, Room 402. Check-in on 12th Oct 2 PM."
                  className="w-full bg-ink border border-line text-xs rounded-xl p-3 text-text focus:outline-none focus:border-gold resize-none"
                />
                <p className="text-[10px] text-text-dim">Leave blank to use the default global lodging settings. Fill in to override for this specific referee.</p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-text-dim uppercase tracking-wider">Google Maps Link</label>
                <input
                  type="url"
                  value={editAccMapsLink}
                  onChange={(e) => setEditAccMapsLink(e.target.value)}
                  placeholder="https://maps.app.goo.gl/... or https://google.com/maps/..."
                  className="w-full bg-ink border border-line text-xs rounded-xl py-2.5 px-3 text-text focus:outline-none focus:border-gold"
                />
                <p className="text-[10px] text-text-dim">Paste the Google Maps link so the referee can easily locate the hotel.</p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-line bg-surface-2/50 flex justify-end gap-3">
              <button 
                type="button"
                onClick={() => setEditingAccReferee(null)}
                className="px-4 py-2 rounded-xl text-text-dim hover:text-text font-bold text-xs hover:bg-surface border border-line transition"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={async () => {
                  try {
                    const updatedReferee: Referee = {
                      ...editingAccReferee,
                      accommodationDetails: editAccDetails.trim(),
                      accommodationMapsLink: editAccMapsLink.trim(),
                    };
                    await saveRefereeToFirestore(updatedReferee);
                    
                    // Also update in global refereeAccounts if they exist
                    const cleanIc = editingAccReferee.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                    const existingAcc = refereeAccounts.find(a => a.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanIc);
                    if (existingAcc) {
                      await saveRefereeAccount({
                        ...existingAcc,
                        accommodationDetails: editAccDetails.trim(),
                        accommodationMapsLink: editAccMapsLink.trim(),
                      });
                    }
                    
                    triggerMsg('Accommodation details updated successfully!', 'ok');
                    setEditingAccReferee(null);
                  } catch (err) {
                    console.error("Failed to update accommodation details:", err);
                    triggerMsg('Failed to save changes.', 'error');
                  }
                }}
                className="bg-gold hover:bg-yellow-400 text-ink px-4 py-2 rounded-xl font-bold text-xs transition shadow flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                Save Accommodation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COACH EXCEL REGISTRATION MODAL */}
      {showCoachExcelModal && activeComp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm animate-fade-in print:hidden overflow-y-auto">
          <div className="bg-surface border border-line rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-scale-up">
            {/* Header */}
            <div className="p-6 border-b border-line flex justify-between items-center bg-gradient-to-r from-surface to-surface-2 shrink-0">
              <div className="flex items-center gap-2">
                <div className="bg-gold/10 p-2 rounded-xl border border-gold/20">
                  <Upload className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-text uppercase tracking-wider">
                    Excel Competitor Roster Import
                  </h2>
                  <p className="text-[11px] text-text-dim">Batch-register competitors for <span className="text-gold font-bold">{activeComp.name}</span></p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowCoachExcelModal(false);
                  setExcelParsedPlayers([]);
                  setExcelValidationErrors([]);
                }}
                className="text-text-dim hover:text-white transition p-2 hover:bg-surface-2 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-6">
              
              {/* Step 1: Template Download */}
              <div className="bg-surface-2 border border-line p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-text uppercase tracking-wider flex items-center gap-1.5 font-sans">
                    <Download className="w-4 h-4 text-gold" />
                    1. Use the Dynamic Excel Template
                  </h4>
                  <p className="text-[11px] text-text-dim leading-relaxed">
                    Download our dynamically generated Excel file pre-filled with this tournament's actual Events, Age Divisions, and Weight Classes. Giving this to coaches guarantees error-free registration!
                  </p>
                </div>
                <button
                  onClick={handleDownloadExcelTemplate}
                  className="w-full sm:w-auto bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Template (.xlsx)</span>
                </button>
              </div>

              {/* Step 2: File Upload Box */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-text-dim uppercase tracking-wider font-sans">2. Upload Completed Excel File</label>
                <div className="border-2 border-dashed border-line/60 hover:border-gold/50 rounded-2xl p-6 transition text-center relative group">
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleCoachExcelUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="space-y-2 pointer-events-none">
                    <div className="w-10 h-10 bg-ink/60 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition border border-line">
                      <FileText className="w-5 h-5 text-gold" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-text uppercase tracking-wider">Click or drag Excel file here to upload</p>
                      <p className="text-[10px] text-text-dim mt-1">Supports standard .xlsx or .xls spreadsheets containing roster lists</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3: Excel Format Reference / Instructions */}
              {excelParsedPlayers.length === 0 && (
                <div className="bg-ink/20 border border-line/40 p-4 rounded-2xl space-y-3 animate-fade-in">
                  <h4 className="text-xs font-bold text-text uppercase tracking-widest text-gold font-sans flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    Excel Column Headers (All Fields are Strictly Required)
                  </h4>
                  <p className="text-[11px] text-text-dim leading-relaxed font-sans">
                    To build or customize your own spreadsheet, ensure the first sheet contains the following headers and that every single column is fully filled. Missing or invalid values will cause the row to be flagged and skipped.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px]">
                    <div className="space-y-1.5">
                      <p className="font-semibold text-text border-b border-line/40 pb-1 uppercase tracking-wider text-gold/90 font-sans">Identity & Core Info</p>
                      <ul className="list-disc pl-4 space-y-1 text-text-dim">
                        <li><strong className="text-text font-sans">Full Name *</strong>: Full name of the competitor.</li>
                        <li><strong className="text-text font-sans">Gender *</strong>: "Male" or "Female" (or 'L'/'P' in Malay).</li>
                        <li><strong className="text-text font-sans">NRIC or Passport *</strong>: NRIC number or Passport for automatic verification.</li>
                        <li><strong className="text-text font-sans">Date of Birth *</strong>: Athlete's birth date (YYYY-MM-DD).</li>
                        <li><strong className="text-text font-sans">Race *</strong>: Malay, Chinese, Indian, or Lain-lain.</li>
                      </ul>
                    </div>
                    <div className="space-y-1.5">
                      <p className="font-semibold text-text border-b border-line/40 pb-1 uppercase tracking-wider text-gold/90 font-sans">Category & Club Info</p>
                      <ul className="list-disc pl-4 space-y-1 text-text-dim">
                        <li><strong className="text-text font-sans">Event *</strong>: Tournament option, must match: <span className="text-text font-mono font-bold text-[10px]">{activeComp.events.join(', ')}</span>.</li>
                        <li><strong className="text-text font-sans">Age Group *</strong>: Tournament Age division.</li>
                        <li><strong className="text-text font-sans">Weight Class *</strong>: Athlete's weight category.</li>
                        <li><strong className="text-text font-sans">School Name *</strong>: School affiliated with the athlete.</li>
                        <li><strong className="text-text font-sans">School Code *</strong>: Official school code (e.g., BBA0012).</li>
                        <li><strong className="text-text font-sans">Affiliated Club / State *</strong>: The dojang, club, or state team the athlete is registered with.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Parsing Warnings / Errors Box */}
              {excelValidationErrors.length > 0 && (
                <div className="bg-red-950/20 border border-red-500/30 p-4 rounded-2xl space-y-1.5 text-xs animate-fade-in">
                  <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-red-400 font-sans">
                    <AlertCircle className="w-4 h-4" />
                    <span>Row Validation Errors ({excelValidationErrors.length})</span>
                  </div>
                  <p className="text-[10px] text-red-200/70 mb-2 font-sans">The following rows contain missing or invalid required fields. These rows have been skipped. Please correct them in your spreadsheet and upload again.</p>
                  <div className="max-h-40 overflow-y-auto divide-y divide-red-500/10 space-y-1 text-[11px]">
                    {excelValidationErrors.map((err, i) => (
                      <div key={i} className="py-1 text-red-200">
                        <span className="font-mono font-bold bg-red-500/20 px-1.5 py-0.5 rounded mr-1">Row {err.rowNum}</span> 
                        <strong className="text-text font-sans">{err.name}</strong>: {err.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Roster Preview */}
              {excelParsedPlayers.length > 0 && (
                <div className="space-y-3 animate-fade-in">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-text uppercase tracking-widest font-sans">
                      Roster Upload Preview ({excelParsedPlayers.length} athletes parsed)
                    </h4>
                    <span className="text-[10px] uppercase font-bold tracking-widest bg-gold/10 text-gold border border-gold/20 px-2 py-0.5 rounded">
                      Ready to Save
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-line rounded-2xl">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="border-b border-line bg-ink/40 text-text-dim font-semibold uppercase tracking-wider">
                          <th className="p-3">#</th>
                          <th className="p-3">Full Name</th>
                          <th className="p-3">Gender</th>
                          <th className="p-3">NRIC / DOB</th>
                          <th className="p-3">Event</th>
                          <th className="p-3">Age Group</th>
                          <th className="p-3">Weight Class</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line/40">
                        {excelParsedPlayers.map((p, idx) => (
                          <tr key={idx} className="hover:bg-surface-2/30">
                            <td className="p-3 font-mono text-gold font-bold">{idx + 1}</td>
                            <td className="p-3 font-bold text-text font-sans">{p.name}</td>
                            <td className="p-3">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${p.gender === 'Female' ? 'bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                                {p.gender}
                              </span>
                            </td>
                            <td className="p-3 text-text-dim font-sans">
                              <div>{p.ic || <span className="italic text-text-dim/40 font-mono">No IC</span>}</div>
                              <div className="text-[10px] font-mono">{p.dob || <span className="italic text-text-dim/40">No DOB</span>}</div>
                            </td>
                            <td className="p-3 text-gold font-medium font-sans">{p.event}</td>
                            <td className="p-3 text-text font-sans">{p.ageGroup}</td>
                            <td className="p-3 text-text font-semibold font-sans">{p.weightClass}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="p-4 border-t border-line bg-surface-2/50 flex justify-between gap-3 shrink-0">
              <button
                onClick={handleDownloadExcelTemplate}
                className="px-4 py-2.5 rounded-xl text-gold border border-gold/20 hover:bg-gold/5 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer font-sans"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Get Template</span>
              </button>
              
              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => {
                    setShowCoachExcelModal(false);
                    setExcelParsedPlayers([]);
                    setExcelValidationErrors([]);
                  }}
                  className="px-4 py-2.5 rounded-xl text-text-dim hover:text-text font-bold text-xs hover:bg-surface border border-line transition cursor-pointer font-sans"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  disabled={excelParsedPlayers.length === 0 || excelImporting}
                  onClick={handleConfirmCoachExcelImport}
                  className={`bg-gold hover:bg-yellow-400 text-ink px-5 py-2.5 rounded-xl font-bold text-xs transition shadow flex items-center gap-1.5 font-sans ${excelParsedPlayers.length === 0 || excelImporting ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {excelImporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirm Import ({excelParsedPlayers.length})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REFEREE TOURNAMENT JOIN CONFIRM MODAL */}
      {joiningComp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm animate-fade-in print:hidden">
          <div className="bg-surface border border-line rounded-3xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-scale-up">
            {/* Header */}
            <div className="p-6 border-b border-line flex justify-between items-center bg-gradient-to-r from-surface to-surface-2 shrink-0">
              <div className="flex items-center gap-2">
                <div className="bg-gold/10 p-2 rounded-xl border border-gold/20">
                  <MapPin className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-text uppercase tracking-wider">
                    Confirm Tournament Distance
                  </h2>
                  <p className="text-[10px] text-text-dim">Championships are held at different locations each time</p>
                </div>
              </div>
              <button 
                onClick={() => setJoiningComp(null)}
                className="text-text-dim hover:text-white transition p-2 hover:bg-surface-2 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="bg-ink/30 border border-line p-4 rounded-2xl space-y-3">
                <div>
                  <span className="text-[10px] text-text-dim uppercase font-semibold tracking-wider block">Tournament Venue</span>
                  <span className="text-xs font-bold text-gold flex items-center gap-1.5 mt-0.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {joiningComp.name} ({joiningComp.venue})
                  </span>
                </div>

                {(() => {
                  const account = refereeAccounts.find(a => a.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === user?.replace(/[^a-zA-Z0-9]/g, '').toLowerCase());
                  if (!account) return null;
                  return (
                    <div>
                      <span className="text-[10px] text-text-dim uppercase font-semibold tracking-wider block">Your Residential Location</span>
                      <span className="text-xs font-medium text-text mt-0.5 block">
                        {account.residentialLocation || "Not provided"}
                      </span>
                    </div>
                  );
                })()}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-text-dim uppercase tracking-wider">
                  Distance to Venue (Go & Return in KM) *
                </label>
                <input
                  type="number"
                  placeholder="e.g. 150"
                  value={joiningDistance}
                  onChange={(e) => setJoiningDistance(e.target.value)}
                  className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold font-mono font-bold"
                  autoFocus
                />
                <p className="text-[10px] text-text-dim leading-relaxed">
                  Please calculate and provide your actual <strong>round-trip (Go & Return)</strong> mileage distance based on Google Maps / Waze between your residence and this specific tournament venue.
                </p>
              </div>

              <div className="space-y-3 pt-3 border-t border-line/50">
                <label className="block text-xs font-semibold text-text-dim uppercase tracking-wider">
                  Events & Officiating Days *
                </label>
                <div className="space-y-2">
                  {/* Kyorugi */}
                  <div className="flex items-center justify-between bg-ink/20 p-3 rounded-2xl border border-line/30">
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="join-kyorugi"
                        checked={parseInt(joiningKyorugiDays) > 0}
                        onChange={(e) => setJoiningKyorugiDays(e.target.checked ? '1' : '0')}
                        className="w-4 h-4 rounded text-gold focus:ring-gold border-line bg-ink accent-gold"
                      />
                      <label htmlFor="join-kyorugi" className="text-xs font-bold text-text cursor-pointer select-none">
                        🥋 Kyorugi (Sparring)
                      </label>
                    </div>
                    {parseInt(joiningKyorugiDays) > 0 && (
                      <div className="flex items-center gap-1.5 bg-ink border border-line/80 rounded-xl px-2 py-1">
                        <button 
                          type="button"
                          onClick={() => setJoiningKyorugiDays(Math.max(1, parseInt(joiningKyorugiDays) - 1).toString())}
                          className="w-5 h-5 bg-surface hover:bg-line text-text rounded flex items-center justify-center text-xs font-bold font-mono"
                        >
                          -
                        </button>
                        <span className="text-xs font-bold font-mono px-1 w-6 text-center">{joiningKyorugiDays}d</span>
                        <button 
                          type="button"
                          onClick={() => setJoiningKyorugiDays((parseInt(joiningKyorugiDays) + 1).toString())}
                          className="w-5 h-5 bg-surface hover:bg-line text-text rounded flex items-center justify-center text-xs font-bold font-mono"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Poomsae */}
                  <div className="flex items-center justify-between bg-ink/20 p-3 rounded-2xl border border-line/30">
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="join-poomsae"
                        checked={parseInt(joiningPoomsaeDays) > 0}
                        onChange={(e) => setJoiningPoomsaeDays(e.target.checked ? '1' : '0')}
                        className="w-4 h-4 rounded text-gold focus:ring-gold border-line bg-ink accent-gold"
                      />
                      <label htmlFor="join-poomsae" className="text-xs font-bold text-text cursor-pointer select-none">
                        ☯️ Poomsae (Forms)
                      </label>
                    </div>
                    {parseInt(joiningPoomsaeDays) > 0 && (
                      <div className="flex items-center gap-1.5 bg-ink border border-line/80 rounded-xl px-2 py-1">
                        <button 
                          type="button"
                          onClick={() => setJoiningPoomsaeDays(Math.max(1, parseInt(joiningPoomsaeDays) - 1).toString())}
                          className="w-5 h-5 bg-surface hover:bg-line text-text rounded flex items-center justify-center text-xs font-bold font-mono"
                        >
                          -
                        </button>
                        <span className="text-xs font-bold font-mono px-1 w-6 text-center">{joiningPoomsaeDays}d</span>
                        <button 
                          type="button"
                          onClick={() => setJoiningPoomsaeDays((parseInt(joiningPoomsaeDays) + 1).toString())}
                          className="w-5 h-5 bg-surface hover:bg-line text-text rounded flex items-center justify-center text-xs font-bold font-mono"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Virtual Taekwondo */}
                  <div className="flex items-center justify-between bg-ink/20 p-3 rounded-2xl border border-line/30">
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="join-virtual"
                        checked={parseInt(joiningVirtualDays) > 0}
                        onChange={(e) => setJoiningVirtualDays(e.target.checked ? '1' : '0')}
                        className="w-4 h-4 rounded text-gold focus:ring-gold border-line bg-ink accent-gold"
                      />
                      <label htmlFor="join-virtual" className="text-xs font-bold text-text cursor-pointer select-none">
                        🎮 Virtual Taekwondo (VR)
                      </label>
                    </div>
                    {parseInt(joiningVirtualDays) > 0 && (
                      <div className="flex items-center gap-1.5 bg-ink border border-line/80 rounded-xl px-2 py-1">
                        <button 
                          type="button"
                          onClick={() => setJoiningVirtualDays(Math.max(1, parseInt(joiningVirtualDays) - 1).toString())}
                          className="w-5 h-5 bg-surface hover:bg-line text-text rounded flex items-center justify-center text-xs font-bold font-mono"
                        >
                          -
                        </button>
                        <span className="text-xs font-bold font-mono px-1 w-6 text-center">{joiningVirtualDays}d</span>
                        <button 
                          type="button"
                          onClick={() => setJoiningVirtualDays((parseInt(joiningVirtualDays) + 1).toString())}
                          className="w-5 h-5 bg-surface hover:bg-line text-text rounded flex items-center justify-center text-xs font-bold font-mono"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-text-dim leading-relaxed">
                  Please select at least one officiating event and specify the number of days you are officiating.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-line/50">
                <label className="block text-xs font-semibold text-text-dim uppercase tracking-wider">
                  Accommodation Option *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setJoiningAccommodation('Yes')}
                    className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      joiningAccommodation === 'Yes'
                        ? 'border-gold bg-gold/10 text-gold'
                        : 'border-line bg-ink/30 text-text hover:bg-ink/50'
                    }`}
                  >
                    🏨 Lodging Required
                  </button>
                  <button
                    type="button"
                    onClick={() => setJoiningAccommodation('No')}
                    className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      joiningAccommodation === 'No'
                        ? 'border-gold bg-gold/10 text-gold'
                        : 'border-line bg-ink/30 text-text hover:bg-ink/50'
                    }`}
                  >
                    🚗 No Lodge (Daily Travel Pay)
                  </button>
                </div>
                <p className="text-[10px] text-text-dim leading-relaxed">
                  {joiningAccommodation === 'No' 
                    ? `If you choose NOT to stay in organizer lodging, you will be paid a daily travel allowance of RM ${refereeFees.km_0_50}.`
                    : "Requests organizer-provided hotel/lodging. Travel mileage allowance will be computed based on your actual travel distance bracket."
                  }
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-line bg-surface-2/50 flex justify-end gap-3">
              <button 
                type="button"
                onClick={() => setJoiningComp(null)}
                className="px-4 py-2 rounded-xl text-text-dim hover:text-text font-bold text-xs hover:bg-surface border border-line transition cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={async () => {
                  const parsed = parseFloat(joiningDistance);
                  if (isNaN(parsed) || parsed < 0) {
                    triggerMsg("Please enter a valid round-trip distance.", "error");
                    return;
                  }

                  const kDaysNum = parseInt(joiningKyorugiDays) || 0;
                  const pDaysNum = parseInt(joiningPoomsaeDays) || 0;
                  const vDaysNum = parseInt(joiningVirtualDays) || 0;
                  const totalOfficiatingDays = kDaysNum + pDaysNum + vDaysNum;

                  if (totalOfficiatingDays <= 0) {
                    triggerMsg("Please select at least one event and enter officiating days.", "error");
                    return;
                  }

                  const account = refereeAccounts.find(a => a.nric.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === user?.replace(/[^a-zA-Z0-9]/g, '').toLowerCase());
                  if (!account) {
                    triggerMsg("Could not find your referee account profile.", "error");
                    return;
                  }

                  try {
                    const newRef: Referee = {
                      ...account,
                      distance: parsed,
                      accommodation: joiningAccommodation,
                      kyorugiDays: kDaysNum,
                      poomsaeDays: pDaysNum,
                      virtualDays: vDaysNum,
                      officiatingDays: totalOfficiatingDays,
                      id: `${joiningComp.id}_${account.nric.replace(/[^a-zA-Z0-9]/g, '')}`,
                      compId: joiningComp.id,
                      createdAt: new Date().toISOString()
                    };
                    await saveRefereeToFirestore(newRef);
                    setCompId(joiningComp.id);
                    setActiveReferee(newRef);
                    setJoiningComp(null);
                    triggerMsg(`Successfully joined ${joiningComp.name}!`, "ok");
                  } catch (err) {
                    console.error("Failed to join tournament:", err);
                    triggerMsg("Failed to join tournament.", "error");
                  }
                }}
                className="bg-gold hover:bg-yellow-400 text-ink px-4 py-2 rounded-xl font-bold text-xs transition shadow flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                Confirm & Join Tournament
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
