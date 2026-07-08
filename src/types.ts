export interface WeighIn {
  weight: number;
  time: string;
  result: 'PASS' | 'FAIL' | 'OVERRIDE PASS' | 'OVERRIDE FAIL' | 'MANUAL';
  signature?: string;
  stationId?: string;
}

export interface Player {
  id: string;
  compId: string;
  name: string;
  ic: string;
  dob: string;
  gender: string;
  club: string;
  coachUsername: string;
  event: string;
  ageGroup: string;
  weightClass: string;
  photo?: string;
  createdAt: string;
  weighIn: WeighIn | null;
  importSource?: string;
}

export interface IdCardField {
  id: string; // 'header' | 'photo' | 'name' | 'club' | 'athleteId' | 'metadata' | 'qrcode' | 'belt'
  name: string;
  visible: boolean;
  order: number;
  fontSize: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl';
  color?: string;
  align?: 'left' | 'center' | 'right';
}

export interface ClubReceipt {
  receiptUrl: string;
  uploadedAt: string;
}

export interface Competition {
  id: string;
  name: string;
  venue: string;
  date: string;
  staffCode: string;
  events: string[];
  genders: string[];
  ageGroups: string[];
  weightClasses: string[];
  isActive?: boolean;
  idCardBgUrl?: string;
  idCardFields?: IdCardField[];
  bankName?: string;
  bankAccount?: string;
  bankQrCode?: string;
  kyorugiFee?: string;
  poomsaeFee?: string;
  paraFee?: string;
  virtualFee?: string;
  receipts?: Record<string, ClubReceipt>;
  publicViewPassword?: string;
  hideScaleReadout?: boolean;
}

export interface Coach {
  username?: string;
  password?: string;
  name: string;
  club: string;
  phone?: string;
  email?: string;
}

export interface Organizer {
  id: string;
  username: string;
  password?: string; // Stored securely in a real app, here plain text for demo
  name: string;
  compId: string;
}

export interface Referee {
  id: string;
  compId: string;
  fullName: string;
  nric: string;
  phone: string;
  clubName: string;
  residentialLocation: string;
  distance: number; // in km
  bankName: string;
  bankAccount: string;
  accommodation: 'Yes' | 'No';
  kyorugiStatus: 'IR' | 'NR' | 'SR' | 'TR';
  poomsaeStatus: 'IR' | 'NR' | 'SR' | 'TR';
  carPlate: string;
  officiatingDays?: number;
  kyorugiDays?: number;
  poomsaeDays?: number;
  photo?: string;
  includeOvertime?: boolean;
  includeOthers?: boolean;
  specialRole?: 'None' | 'TD' | 'CSB' | 'RIC';
  createdAt: string;
}

