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
  icCopy?: string;
  createdAt: string;
  weighIn: WeighIn | null;
  importSource?: string;
  schoolName?: string;
  schoolCode?: string;
  race?: string;
  indemnityStatus?: 'Pending' | 'Completed';
  indemnityParentName?: string;
  indemnityParentIc?: string;
  indemnityParentPhone?: string;
  indemnityParentEmail?: string;
  indemnityRelationship?: string;
  indemnitySignedDate?: string;
  indemnitySignedIp?: string;
  indemnitySignature?: string; // Base64 dataURL or drawing representation
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
  endDate?: string;
  registrationCloseDate?: string;
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
  affiliatedClubs?: string[];
  rings?: string[];
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
  password?: string;
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
  virtualDays?: number;
  photo?: string;
  includeOvertime?: boolean;
  includeOthers?: boolean;
  specialRole?: 'None' | 'TD' | 'CSB' | 'RIC' | 'GAME_MASTER' | 'TECHNICAL_OPERATOR' | 'VIRTUAL_REFEREE';
  courtAssignment?: string; // e.g. "Ring 1", "Ring 2", "Ring 3", "Ring 4"
  dutyRole?: string; // e.g. "Center Referee", "Corner Referee 1", "Corner Referee 2", "Technical Assistant", "Review Official", "Ring Inspector"
  matchNo?: string; // Manual Match No or Match Range entered by RIC
  accommodationDetails?: string;
  accommodationMapsLink?: string;
  hotelDaysProvided?: number;
  hotelCheckoutDate?: string;
  createdAt: string;
}

export interface MatchAssignment {
  id: string;
  compId: string;
  matchNo: string;
  court: string;
  division: string;
  bluePlayerName?: string;
  blueClub?: string;
  redPlayerName?: string;
  redClub?: string;
  centerRefereeId?: string;
  corner1RefereeId?: string;
  corner2RefereeId?: string;
  technicalAssistantId?: string;
  reviewOfficialId?: string;
  status?: 'Scheduled' | 'In Progress' | 'Completed';
}

