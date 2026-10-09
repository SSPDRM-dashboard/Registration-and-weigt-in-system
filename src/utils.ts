import { Competition, Referee, Player, Coach, ClubReceipt } from './types';

export interface RefereeFeesConfig {
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
  default_accommodation_details?: string;
  default_accommodation_maps_link?: string;
  default_hotel_days_provided?: number;
  default_hotel_checkout_date?: string;
  currency?: string;
}

export interface CurrencyOption {
  code: string;
  symbol: string;
  label: string;
}

export const SUPPORTED_CURRENCIES: CurrencyOption[] = [
  { code: 'MYR', symbol: 'RM', label: 'RM - Malaysian Ringgit (MYR)' },
  { code: 'USD', symbol: '$', label: '$ - US Dollar (USD)' },
  { code: 'SGD', symbol: 'S$', label: 'S$ - Singapore Dollar (SGD)' },
  { code: 'EUR', symbol: '€', label: '€ - Euro (EUR)' },
  { code: 'GBP', symbol: '£', label: '£ - British Pound (GBP)' },
  { code: 'IDR', symbol: 'Rp', label: 'Rp - Indonesian Rupiah (IDR)' },
  { code: 'THB', symbol: '฿', label: '฿ - Thai Baht (THB)' },
  { code: 'PHP', symbol: '₱', label: '₱ - Philippine Peso (PHP)' },
  { code: 'AUD', symbol: 'A$', label: 'A$ - Australian Dollar (AUD)' },
  { code: 'CAD', symbol: 'C$', label: 'C$ - Canadian Dollar (CAD)' },
  { code: 'JPY', symbol: '¥', label: '¥ - Japanese Yen (JPY)' },
  { code: 'KRW', symbol: '₩', label: '₩ - Korean Won (KRW)' },
  { code: 'BND', symbol: 'B$', label: 'B$ - Brunei Dollar (BND)' },
  { code: 'INR', symbol: '₹', label: '₹ - Indian Rupee (INR)' },
  { code: 'VND', symbol: '₫', label: '₫ - Vietnamese Dong (VND)' },
  { code: 'HKD', symbol: 'HK$', label: 'HK$ - Hong Kong Dollar (HKD)' },
  { code: 'TWD', symbol: 'NT$', label: 'NT$ - New Taiwan Dollar (TWD)' },
  { code: 'CNY', symbol: '¥', label: 'CNY (¥) - Chinese Yuan' },
];

export const getCompCurrency = (comp?: Competition | null, defaultCurr: string = 'RM'): string => {
  if (!comp?.currency) return defaultCurr;
  return comp.currency.trim() || defaultCurr;
};

export const DEFAULT_REFEREE_FEES: RefereeFeesConfig = {
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
  currency: 'RM',
};

export function parseBirthInfo(dob?: string, ic?: string): { birthYear: number | null; dob: string } {
  const cleanDob = dob ? dob.trim() : '';
  const cleanIc = ic ? ic.replace(/[^0-9]/g, '') : '';

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
    const rangeMatch = ag.match(/(\d{1,2})\s*(?:to|-|until|–)\s*(\d{1,2})/i);
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

export const parseFeeToNumber = (feeStr: string | undefined | null): number => {
  if (!feeStr) return 0;
  const match = feeStr.replace(/,/g, '').match(/\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : 0;
};

export const formatCurrency = (amount: number, feeSample: string | undefined | null, fallbackCurrency: string = 'RM') => {
  if (!feeSample) return `${fallbackCurrency} ${amount.toLocaleString()}`;
  const prefixMatch = feeSample.match(/^[^\d]+/);
  const prefix = prefixMatch ? prefixMatch[0].trim() + ' ' : `${fallbackCurrency} `;
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

export const getRefereeAllowance = (r: Referee, fees: RefereeFeesConfig, overrideCurrency?: string) => {
  const currency = overrideCurrency || fees.currency || 'RM';
  const tiers: Record<string, number> = { 'IR': 4, 'NR': 3, 'SR': 2, 'TR': 1 };
  const baseDailyRates: Record<string, number> = { 
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
      explanations.push(`${kDays}d Kyorugi (${roleLabel}) @ ${currency} ${kRate}`);
    }
    if (pDays > 0) {
      const roleLabel = (r.specialRole && !['GAME_MASTER', 'TECHNICAL_OPERATOR', 'VIRTUAL_REFEREE', 'None'].includes(r.specialRole)) 
        ? formatSpecialRole(r.specialRole) 
        : r.poomsaeStatus;
      explanations.push(`${pDays}d Poomsae (${roleLabel}) @ ${currency} ${pRate}`);
    }
    if (vDays > 0) {
      const roleLabel = r.specialRole === 'GAME_MASTER' 
        ? 'Game Master' 
        : r.specialRole === 'TECHNICAL_OPERATOR' 
        ? 'Tech Operator' 
        : r.specialRole === 'VIRTUAL_REFEREE' 
        ? 'Virtual Ref' 
        : 'Virtual';
      explanations.push(`${vDays}d ${roleLabel} @ ${currency} ${vRate}`);
    }
    splitExplanation = explanations.join(" + ");
  } else if (r.specialRole && r.specialRole !== 'None') {
    baseDutyPay = stdDailyRate * totalDays;
    splitExplanation = `${totalDays} days as ${formatSpecialRole(r.specialRole)} @ ${currency} ${stdDailyRate}/day`;
  } else {
    baseDutyPay = stdDailyRate * totalDays;
    splitExplanation = `${totalDays} days (${higherStatus}) @ ${currency} ${stdDailyRate}/day`;
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

/**
 * Compresses an uploaded receipt image down to a crystal-clear, lightweight JPEG (~30KB-50KB).
 * This ensures swift upload and eliminates any risk of exceeding storage quotas.
 */
export function compressReceiptImage(
  file: File,
  maxWidth = 1000,
  maxHeight = 1400,
  quality = 0.65
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Normalizes club names for robust comparison by stripping legal suffixes, common abbreviations,
 * punctuation, and generic location tags.
 */
export function normalizeClubName(str?: string): string {
  if (!str) return '';
  const cleaned = str
    .toLowerCase()
    .replace(/\b(pte|ltd|llp|sdn|bhd|club|tkd|taekwondo|team|hq|academy|international|sports)\b/gi, '')
    .replace(/[^a-z0-9]/gi, '')
    .trim();
  const withoutCountry = cleaned.replace(/singapore|malaysia/gi, '').trim();
  return withoutCountry.length >= 2 ? withoutCountry : cleaned;
}

/**
 * Intelligently finds a payment receipt for a club, handling name variations, coach profile differences,
 * and coach usernames, with zero false positives on generic country names.
 */
export function findReceiptForClub(
  comp?: Competition | null,
  clubName?: string,
  coachUsername?: string,
  coachesMap?: Record<string, Coach>,
  playersList?: Player[],
  externalReceipts?: Record<string, ClubReceipt>
): ClubReceipt | null {
  const receipts = externalReceipts || comp?.receipts;
  if (!receipts) return null;
  const entries = Object.entries(receipts);
  if (entries.length === 0) return null;

  // 1. Direct coachUsername match (if viewing as coach, coach ALWAYS sees their uploaded receipt)
  if (coachUsername) {
    const cleanUser = coachUsername.trim().toLowerCase();
    for (const [, r] of entries) {
      if (r.coachUsername && r.coachUsername.trim().toLowerCase() === cleanUser) {
        return r;
      }
    }
  }

  // 2. Direct exact key match (case-insensitive & trimmed)
  if (clubName) {
    const upper = clubName.trim().toUpperCase();
    if (receipts[upper]) return receipts[upper];
    for (const [k, r] of entries) {
      if (k.trim().toUpperCase() === upper) return r;
    }
  }

  // 3. Exact normalized key match
  const targetNorm = clubName ? normalizeClubName(clubName) : '';
  if (targetNorm && targetNorm !== 'singapore' && targetNorm !== 'malaysia') {
    for (const [k, r] of entries) {
      const kNorm = normalizeClubName(k);
      if (kNorm && kNorm === targetNorm) {
        return r;
      }
    }
  }

  // 4. Match via athletes registered under this club and their coaches
  if (clubName && playersList) {
    const clubAthletes = playersList.filter(p => {
      if (!p.club) return false;
      if (p.club.trim().toUpperCase() === clubName.trim().toUpperCase()) return true;
      if (targetNorm && normalizeClubName(p.club) === targetNorm) return true;
      return false;
    });
    const coachUsernames = Array.from(new Set(clubAthletes.map(p => p.coachUsername).filter(Boolean))) as string[];

    for (const cUser of coachUsernames) {
      // Check if receipt has this coachUsername
      for (const [, r] of entries) {
        if (r.coachUsername && r.coachUsername.trim().toLowerCase() === cUser.trim().toLowerCase()) {
          return r;
        }
      }

      // Check if coach profile club matches any receipt
      if (coachesMap) {
        const coachProfile = coachesMap[cUser];
        if (coachProfile?.club) {
          const cUpper = coachProfile.club.trim().toUpperCase();
          if (receipts[cUpper]) return receipts[cUpper];
          const cNorm = normalizeClubName(coachProfile.club);
          if (cNorm && cNorm.length >= 3 && cNorm !== 'singapore' && cNorm !== 'malaysia') {
            for (const [k, r] of entries) {
              if (normalizeClubName(k) === cNorm) return r;
            }
          }
        }
      }
    }
  }

  // 5. Normalized substring match (requires core distinctive token >= 4 chars, excludes generic words)
  if (targetNorm && targetNorm.length >= 4 && targetNorm !== 'singapore' && targetNorm !== 'malaysia') {
    for (const [k, r] of entries) {
      const kNorm = normalizeClubName(k);
      if (kNorm && kNorm.length >= 4 && kNorm !== 'singapore' && kNorm !== 'malaysia') {
        if (targetNorm.includes(kNorm) || kNorm.includes(targetNorm)) {
          return r;
        }
      }
    }
  }

  // 6. If coachUsername provided, check if coach's profile club matches
  if (coachUsername && coachesMap) {
    const coachProfile = coachesMap[coachUsername];
    if (coachProfile?.club) {
      const cUpper = coachProfile.club.trim().toUpperCase();
      if (receipts[cUpper]) return receipts[cUpper];
      const cNorm = normalizeClubName(coachProfile.club);
      if (cNorm && cNorm.length >= 3 && cNorm !== 'singapore' && cNorm !== 'malaysia') {
        for (const [k, r] of entries) {
          if (normalizeClubName(k) === cNorm) return r;
        }
      }
    }
  }

  return null;
}

/**
 * Checks whether two athlete records represent the exact same human competitor.
 * Guards against false-positive duplicate matches when athletes share placeholder, dummy,
 * or truncated IC numbers (e.g. 'T123', 'G123', '123', 'N/A', 'NONE', '0', '-', etc.).
 */
export function isSameAthleteIdentity(
  p1: { name?: string; ic?: string; dob?: string } | null | undefined,
  p2: { name?: string; ic?: string; dob?: string } | null | undefined
): boolean {
  if (!p1 || !p2) return false;

  const name1 = (p1.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const name2 = (p2.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const dob1 = (p1.dob || '').trim();
  const dob2 = (p2.dob || '').trim();
  const ic1 = (p1.ic || '').trim().toLowerCase().replace(/[^a-z0-9]/gi, '');
  const ic2 = (p2.ic || '').trim().toLowerCase().replace(/[^a-z0-9]/gi, '');

  if (!name1 || !name2) return false;

  // Helper to identify dummy/placeholder ICs
  const isPlaceholderIc = (ic: string) => {
    if (!ic || ic.length < 5) return true;
    if (['na', 'none', 'null', 'temp', 't123', 'g123', 's123', '123', '0000', 'xxxx'].some(p => ic.startsWith(p) && ic.length <= 6)) return true;
    return false;
  };

  // Case 1: Identical full name match (case-insensitive)
  if (name1 === name2) {
    if (dob1 && dob2) return dob1 === dob2;
    if (ic1 && ic2 && !isPlaceholderIc(ic1) && !isPlaceholderIc(ic2)) return ic1 === ic2;
    return true;
  }

  // Case 2: Permutation / full token match of all name words with exact same DOB
  // (e.g. "Cheong Hongji Alexander" vs "Alexander Cheong Hongji")
  const words1 = name1.split(' ').sort().join(' ');
  const words2 = name2.split(' ').sort().join(' ');
  if (words1 === words2 && words1.length > 3) {
    if (dob1 && dob2) return dob1 === dob2;
    return true;
  }

  // Case 3: Genuine official unique IC match (>= 8 alphanumeric characters, e.g. T1317329F or Malaysian IC)
  // Two different name representations can ONLY match if the IC is genuine (not placeholder) AND DOB matches
  if (ic1 && ic2 && ic1.length >= 8 && !isPlaceholderIc(ic1) && !isPlaceholderIc(ic2) && ic1 === ic2) {
    if (dob1 && dob2 && dob1 === dob2) return true;
    if (name1.includes(name2) || name2.includes(name1)) return true;
  }

  return false;
}

