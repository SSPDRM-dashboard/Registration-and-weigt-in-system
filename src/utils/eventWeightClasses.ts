import { Competition } from '../types';

/**
 * Standard default divisions / weight classes per Taekwondo tournament event discipline.
 */
export const DEFAULT_EVENT_WEIGHT_CLASSES: Record<string, string[]> = {
  Kyorugi: [
    'FIN BELOW 45KG',
    'FLY 45.01KG - 48KG',
    'BANTAM 48.01KG - 51KG',
    'FEATHER 51.01KG - 55KG',
    'LIGHT 55.01KG - 59KG',
    'WELTER 59.01KG - 63KG',
    'LIGHT MIDDLE 63.01KG - 68KG',
    'MIDDLE 68.01KG - 73KG',
    'LIGHT HEAVY 73.01KG - 78KG',
    'HEAVY OVER 78KG',
    'OPEN WEIGHT',
  ],
  'Para Kyorugi': [
    'K41 OPEN',
    'K42 OPEN',
    'K43 OPEN',
    'K44 UNDER 58KG',
    'K44 58.01KG - 63KG',
    'K44 63.01KG - 70KG',
    'K44 70.01KG - 80KG',
    'K44 OVER 80KG',
  ],
  'Recognize Poomsae': [
    'INDIVIDUAL RECOGNIZED',
    'MIXED PAIR (2 PERSONS)',
    'TEAM (3 PERSONS)',
    'ALL BELTS (OPEN WEIGHT)',
    'TAEGEUK 1-4',
    'TAEGEUK 4-8',
    'KORYO & ABOVE (BLACK BELT)',
  ],
  'Free Style Poomsae': [
    'FREESTYLE INDIVIDUAL MALE',
    'FREESTYLE INDIVIDUAL FEMALE',
    'FREESTYLE MIXED PAIR',
    'FREESTYLE MIXED TEAM (5 PERSONS)',
    'OPEN DIVISION',
  ],
  'Para Poomsae': [
    'P20 INTELLECTUAL IMPAIRMENT',
    'P30 NEUROLOGICAL IMPAIRMENT',
    'P50 WHEELCHAIR DIVISION',
    'OPEN DIVISION / N/A',
  ],
  'Speed Kicking': [
    'OPEN WEIGHT',
    'BELOW 40KG',
    '40.01KG - 50KG',
    '50.01KG - 60KG',
    'ABOVE 60KG',
  ],
  Kyukpa: [
    'OPEN WEIGHT',
    'POWER BREAK (FIST)',
    'POWER BREAK (KNIFE-HAND)',
    'POWER BREAK (SIDE KICK)',
    'HIGH KICK BREAK',
    'SPINNING HOOK KICK BREAK',
    'MULTI-DIRECTIONAL TECHNICAL BREAK',
  ],
  'Skipping Rope': [
    'OPEN WEIGHT',
    'SPEED SPRINT (30 SECONDS)',
    'SPEED ENDURANCE (3 MINUTES)',
    'DOUBLE UNDERS (30 SECONDS)',
    'FREESTYLE SKIPPING',
  ],
  'Virtual Taekwondo': [
    'OPEN WEIGHT / DIVISION',
    'CADET DIVISION (10-12)',
    'JUNIOR DIVISION (13-15)',
    'SENIOR DIVISION (16+)',
  ],
};

/**
 * Returns a human-friendly label for the target weight class / division field based on the event.
 */
export function getEventWeightClassLabel(eventName: string): string {
  const norm = (eventName || '').trim().toLowerCase();
  if (norm.includes('kyorugi')) {
    return 'Target Weight Class';
  }
  if (norm.includes('poomsae')) {
    return 'Poomsae Category / Format';
  }
  if (norm.includes('speed')) {
    return 'Speed Kicking Division / Weight';
  }
  if (norm.includes('kyukpa') || norm.includes('breaking')) {
    return 'Breaking (Kyukpa) Division';
  }
  if (norm.includes('skipping') || norm.includes('rope')) {
    return 'Skipping Rope Division';
  }
  if (norm.includes('virtual')) {
    return 'Virtual Taekwondo Division';
  }
  return 'Target Weight Class / Division';
}

/**
 * Checks whether an event or division is exempt from strict numeric scale weighing
 * (e.g. Poomsae, Breaking, Skipping Rope, or designated Open Weight divisions).
 */
export function isExemptFromStrictWeightScale(eventName: string, weightClass?: string): boolean {
  const normEv = (eventName || '').trim().toLowerCase();
  const normWc = (weightClass || '').trim().toLowerCase();

  if (
    normEv.includes('poomsae') ||
    normEv.includes('kyukpa') ||
    normEv.includes('breaking') ||
    normEv.includes('skipping') ||
    normEv.includes('virtual')
  ) {
    return true;
  }

  if (normWc.includes('open') || normWc.includes('n/a') || normWc.includes('all belt') || normWc.includes('exempt')) {
    return true;
  }

  return false;
}

/**
 * Retrieves the configured or default weight classes / divisions for a given tournament event.
 */
export function getWeightClassesForEvent(
  comp: Partial<Competition> | null | undefined,
  eventName: string
): string[] {
  if (!eventName) {
    return comp?.weightClasses && comp.weightClasses.length > 0
      ? comp.weightClasses
      : DEFAULT_EVENT_WEIGHT_CLASSES.Kyorugi;
  }

  const cleanEv = eventName.trim();

  // 1. Direct match in comp.eventWeightClasses
  if (comp?.eventWeightClasses && comp.eventWeightClasses[cleanEv] && comp.eventWeightClasses[cleanEv].length > 0) {
    return comp.eventWeightClasses[cleanEv];
  }

  // 2. Case-insensitive lookup in comp.eventWeightClasses
  if (comp?.eventWeightClasses) {
    const foundKey = Object.keys(comp.eventWeightClasses).find(
      (k) => k.trim().toLowerCase() === cleanEv.toLowerCase()
    );
    if (foundKey && comp.eventWeightClasses[foundKey]?.length > 0) {
      return comp.eventWeightClasses[foundKey];
    }
  }

  // 3. Known default presets
  const presetKey = Object.keys(DEFAULT_EVENT_WEIGHT_CLASSES).find(
    (k) => k.toLowerCase() === cleanEv.toLowerCase() || cleanEv.toLowerCase().includes(k.toLowerCase())
  );
  if (presetKey && DEFAULT_EVENT_WEIGHT_CLASSES[presetKey]) {
    // If it's Kyorugi and the competition has custom global weight classes, prioritize competition's weight classes
    if (cleanEv.toLowerCase().includes('kyorugi') && !cleanEv.toLowerCase().includes('para')) {
      if (comp?.weightClasses && comp.weightClasses.length > 0) {
        return comp.weightClasses;
      }
    }
    return DEFAULT_EVENT_WEIGHT_CLASSES[presetKey];
  }

  // 4. Global comp.weightClasses fallback if present
  if (comp?.weightClasses && comp.weightClasses.length > 0) {
    return comp.weightClasses;
  }

  // 5. Ultimate fallback
  return ['OPEN WEIGHT'];
}
