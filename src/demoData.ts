import { Player } from './types';

export const DEMO_IMPORT = {
  players: [
    {"name":"Athlete 001 (Smart Ma Taekwondo Club)","gender":"Female","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Cadet (12 to 14 Years Old)","weightClass":"LIGHT HEAVY 55.01KG-59KG"},
    {"name":"Athlete 002 (Smart Ma Taekwondo Club)","gender":"Male","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Junior (15 to 17 Years Old)","weightClass":"FIN BELOW 45KG"},
    {"name":"Athlete 003 (Smart Ma Taekwondo Club)","gender":"Male","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Junior (15 to 17 Years Old)","weightClass":"FIN BELOW 45KG"},
    {"name":"Athlete 004 (Smart Ma Taekwondo Club)","gender":"Male","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Cadet (12 to 14 Years Old)","weightClass":"FEATHER 41.01KG-45KG"},
    {"name":"Athlete 005 (Smart Ma Taekwondo Club)","gender":"Male","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Cadet (12 to 14 Years Old)","weightClass":"FEATHER 41.01KG-45KG"},
    {"name":"Athlete 006 (Smart Ma Taekwondo Club)","gender":"Female","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Cadet (12 to 14 Years Old)","weightClass":"BANTAM 33.01KG-37KG"},
    {"name":"Athlete 007 (Smart Ma Taekwondo Club)","gender":"Female","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Cadet (12 to 14 Years Old)","weightClass":"BANTAM 33.01KG-37KG"},
    {"name":"Athlete 008 (Smart Ma Taekwondo Club)","gender":"Female","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Cadet (12 to 14 Years Old)","weightClass":"MIDDLE 51.01KG-55KG"},
    {"name":"Athlete 009 (Smart Ma Taekwondo Club)","gender":"Male","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Junior (15 to 17 Years Old)","weightClass":"BANTAM 48.01KG-51KG"},
    {"name":"Athlete 010 (Smart Ma Taekwondo Club)","gender":"Male","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Cadet (12 to 14 Years Old)","weightClass":"WELTER 49.01KG-53KG"},
    {"name":"Athlete 011 (Smart Ma Taekwondo Club)","gender":"Male","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Super Cadet (9 to 11 Years Old)","weightClass":"FEATHER 26.01KG-29KG"},
    {"name":"Athlete 012 (Smart Ma Taekwondo Club)","gender":"Male","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Super Cadet (9 to 11 Years Old)","weightClass":"FEATHER 26.01KG-29KG"},
    {"name":"Athlete 013 (Smart Ma Taekwondo Club)","gender":"Female","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Cadet (12 to 14 Years Old)","weightClass":"WELTER 44.01KG-47KG"},
    {"name":"Athlete 014 (Smart Ma Taekwondo Club)","gender":"Female","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Junior (15 to 17 Years Old)","weightClass":"FIN BELOW 42KG"},
    {"name":"Athlete 015 (Smart Ma Taekwondo Club)","gender":"Female","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Super Cadet (9 to 11 Years Old)","weightClass":"HEAVY 38KG & ABOVE"},
    {"name":"Athlete 016 (Smart Ma Taekwondo Club)","gender":"Female","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Super Cadet (9 to 11 Years Old)","weightClass":"HEAVY 38KG & ABOVE"},
    {"name":"Athlete 017 (Smart Ma Taekwondo Club)","gender":"Female","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Cadet (12 to 14 Years Old)","weightClass":"LIGHT MIDDLE 47.01KG-51KG"},
    {"name":"Athlete 018 (Smart Ma Taekwondo Club)","gender":"Male","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Cadet (12 to 14 Years Old)","weightClass":"FLY 33.01KG-37KG"},
    {"name":"Athlete 019 (Smart Ma Taekwondo Club)","gender":"Female","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Super Cadet (9 to 11 Years Old)","weightClass":"FEATHER 24.01KG-27KG"},
    {"name":"Athlete 020 (Smart Ma Taekwondo Club)","gender":"Female","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Super Cadet (9 to 11 Years Old)","weightClass":"FEATHER 24.01KG-27KG"},
    {"name":"Athlete 021 (Smart Ma Taekwondo Club)","gender":"Female","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Cadet (12 to 14 Years Old)","weightClass":"FIN BELOW 29KG"},
    {"name":"Athlete 022 (Smart Ma Taekwondo Club)","gender":"Male","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Super Cadet (9 to 11 Years Old)","weightClass":"HEAVY 40KG & ABOVE"},
    {"name":"Athlete 023 (Smart Ma Taekwondo Club)","gender":"Male","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Cadet (12 to 14 Years Old)","weightClass":"LIGHT HEAVY 61.01KG-65KG"},
    {"name":"Athlete 024 (Smart Ma Taekwondo Club)","gender":"Male","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Junior (15 to 17 Years Old)","weightClass":"MIDDLE 68.01KG-73KG"},
    {"name":"Athlete 025 (Smart Ma Taekwondo Club)","gender":"Female","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Super Cadet (9 to 11 Years Old)","weightClass":"WELTER 30.01KG-34KG"},
    {"name":"Athlete 026 (Smart Ma Taekwondo Club)","gender":"Female","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Junior (15 to 17 Years Old)","weightClass":"FEATHER 46.01KG-49KG"},
    {"name":"Athlete 027 (Smart Ma Taekwondo Club)","gender":"Female","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Junior (15 to 17 Years Old)","weightClass":"LIGHT MIDDLE 55.01KG-59KG"},
    {"name":"Athlete 028 (Smart Ma Taekwondo Club)","gender":"Male","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Junior (15 to 17 Years Old)","weightClass":"WELTER 59.01KG-63KG"},
    {"name":"Athlete 029 (Smart Ma Taekwondo Club)","gender":"Male","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Junior (15 to 17 Years Old)","weightClass":"LIGHT HEAVY 73.01KG-78KG"},
    {"name":"Athlete 030 (Smart Ma Taekwondo Club)","gender":"Male","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Junior (15 to 17 Years Old)","weightClass":"FEATHER 51.01KG-55KG"},
    {"name":"Athlete 031 (Smart Ma Taekwondo Club)","gender":"Male","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Super Cadet (9 to 11 Years Old)","weightClass":"LIGHT 29.01KG-32KG"},
    {"name":"Athlete 032 (Smart Ma Taekwondo Club)","gender":"Male","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Super Cadet (9 to 11 Years Old)","weightClass":"LIGHT 29.01KG-32KG"},
    {"name":"Athlete 033 (Smart Ma Taekwondo Club)","gender":"Male","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Junior (15 to 17 Years Old)","weightClass":"LIGHT 55.01KG-59KG"},
    {"name":"Athlete 034 (Smart Ma Taekwondo Club)","gender":"Male","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Junior (15 to 17 Years Old)","weightClass":"LIGHT 55.01KG-59KG"},
    {"name":"Athlete 035 (Smart Ma Taekwondo Club)","gender":"Male","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Junior (15 to 17 Years Old)","weightClass":"HEAVY 78KG & ABOVE"},
    {"name":"Athlete 036 (Smart Ma Taekwondo Club)","gender":"Male","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Junior (15 to 17 Years Old)","weightClass":"HEAVY 78KG & ABOVE"},
    {"name":"Athlete 037 (Smart Ma Taekwondo Club)","gender":"Female","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Junior (15 to 17 Years Old)","weightClass":"WELTER 52.01KG-55KG"},
    {"name":"Athlete 038 (Smart Ma Taekwondo Club)","gender":"Female","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Junior (15 to 17 Years Old)","weightClass":"WELTER 52.01KG-55KG"},
    {"name":"Athlete 039 (Smart Ma Taekwondo Club)","gender":"Male","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Cadet (12 to 14 Years Old)","weightClass":"BANTAM 37.01KG-41KG"},
    {"name":"Athlete 040 (Smart Ma Taekwondo Club)","gender":"Female","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Super Cadet (9 to 11 Years Old)","weightClass":"LIGHT 27.01KG-30KG"},
    {"name":"Athlete 041 (Smart Ma Taekwondo Club)","gender":"Female","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Super Cadet (9 to 11 Years Old)","weightClass":"LIGHT 27.01KG-30KG"},
    {"name":"Athlete 042 (Smart Ma Taekwondo Club)","gender":"Female","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Junior (15 to 17 Years Old)","weightClass":"LIGHT 49.01KG-52KG"},
    {"name":"Athlete 043 (Smart Ma Taekwondo Club)","gender":"Female","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Cadet (12 to 14 Years Old)","weightClass":"FLY 29.01KG-33KG"},
    {"name":"Athlete 044 (Smart Ma Taekwondo Club)","gender":"Female","club":"SMART MA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Junior (15 to 17 Years Old)","weightClass":"FLY 42.01KG-44KG"},
    {"name":"Athlete 045 (Smart Ma Taekwondo Club)","gender":"Male","club":"SMART MA TAEKWONDO CLUB","event":"Recognize Poomsae","ageGroup":"Junior (15 to 17 Years Old)","weightClass":"Taegeuk 5 to Pyongwon"},
    {"name":"Athlete 046 (Smart Ma Taekwondo Club)","gender":"Male","club":"SMART MA TAEKWONDO CLUB","event":"Recognize Poomsae","ageGroup":"Super Cadet (9 to 11 Years Old)","weightClass":"Taegeuk 4 to Koryo"},
    {"name":"Athlete 047 (Smart Ma Taekwondo Club)","gender":"Male","club":"SMART MA TAEKWONDO CLUB","event":"Recognize Poomsae","ageGroup":"Super Cadet (9 to 11 Years Old)","weightClass":"Taegeuk 4 to Koryo"},
    {"name":"Athlete 048 (Smart Ma Taekwondo Club)","gender":"Female","club":"SMART MA TAEKWONDO CLUB","event":"Recognize Poomsae","ageGroup":"Cadet (12 to 14 Years Old)","weightClass":"Taegeuk 4 to Taebaek"},
    {"name":"Athlete 049 (Smart Ma Taekwondo Club)","gender":"Female","club":"SMART MA TAEKWONDO CLUB","event":"Recognize Poomsae","ageGroup":"Cadet (12 to 14 Years Old)","weightClass":"Taegeuk 4 to Taebaek"},
    {"name":"Athlete 050 (Smart Ma Taekwondo Club)","gender":"Female","club":"SMART MA TAEKWONDO CLUB","event":"Recognize Poomsae","ageGroup":"Super Cadet (9 to 11 Years Old)","weightClass":"Taegeuk 4 to Koryo"},
    {"name":"Athlete 051 (Smart Ma Taekwondo Club)","gender":"Female","club":"SMART MA TAEKWONDO CLUB","event":"Recognize Poomsae","ageGroup":"Super Cadet (9 to 11 Years Old)","weightClass":"Taegeuk 4 to Koryo"},
    {"name":"Athlete 052 (Smart Ma Taekwondo Club)","gender":"Male","club":"SMART MA TAEKWONDO CLUB","event":"Recognize Poomsae","ageGroup":"Cadet (12 to 14 Years Old)","weightClass":"Taegeuk 4 to Taebaek"},
    {"name":"Athlete 053 (Smart Ma Taekwondo Club)","gender":"Male","club":"SMART MA TAEKWONDO CLUB","event":"Recognize Poomsae","ageGroup":"Cadet (12 to 14 Years Old)","weightClass":"Taegeuk 4 to Taebaek"},
    {"name":"Athlete 054 (Smart Ma Taekwondo Club)","gender":"Female","club":"SMART MA TAEKWONDO CLUB","event":"Virtual Taekwondo","ageGroup":"Cadet (11 to 12 Years Old)","weightClass":"Open Weight"},
    {"name":"Athlete 055 (Smart Ma Taekwondo Club)","gender":"Female","club":"SMART MA TAEKWONDO CLUB","event":"Virtual Taekwondo","ageGroup":"Super Cadet (9 To 10 Years Old)","weightClass":"Open Weight"},
    {"name":"Athlete 056 (Smart Ma Taekwondo Club)","gender":"Female","club":"SMART MA TAEKWONDO CLUB","event":"Virtual Taekwondo","ageGroup":"Super Cadet (9 To 10 Years Old)","weightClass":"Open Weight"},

    {"name":"Athlete 001 (Saujana Tkd Club)","gender":"Male","club":"SAUJANA TKD CLUB","event":"Kyorugi","ageGroup":"Cadet (12 to 14 Years Old)","weightClass":"LIGHT 45.01KG-49KG"},
    {"name":"Athlete 002 (Saujana Tkd Club)","gender":"Male","club":"SAUJANA TKD CLUB","event":"Kyorugi","ageGroup":"Junior (15 to 17 Years Old)","weightClass":"FLY 45.01KG-48KG"},
    {"name":"Athlete 003 (Saujana Tkd Club)","gender":"Male","club":"SAUJANA TKD CLUB","event":"Kyorugi","ageGroup":"Cadet (12 to 14 Years Old)","weightClass":"FLY 33.01KG-37KG"},
    {"name":"Athlete 004 (Saujana Tkd Club)","gender":"Female","club":"SAUJANA TKD CLUB","event":"Kyorugi","ageGroup":"Super Cadet (9 to 11 Years Old)","weightClass":"MIDDLE 34.01KG-38KG"},
    {"name":"Athlete 005 (Saujana Tkd Club)","gender":"Female","club":"SAUJANA TKD CLUB","event":"Kyorugi","ageGroup":"Super Cadet (9 to 11 Years Old)","weightClass":"FEATHER 24.01KG-27KG"},
    {"name":"Athlete 006 (Saujana Tkd Club)","gender":"Male","club":"SAUJANA TKD CLUB","event":"Kyorugi","ageGroup":"Super Cadet (9 to 11 Years Old)","weightClass":"HEAVY 40KG & ABOVE"},
    {"name":"Athlete 007 (Saujana Tkd Club)","gender":"Female","club":"SAUJANA TKD CLUB","event":"Kyorugi","ageGroup":"Cadet (12 to 14 Years Old)","weightClass":"LIGHT HEAVY 55.01KG-59KG"},
    {"name":"Athlete 008 (Saujana Tkd Club)","gender":"Male","club":"SAUJANA TKD CLUB","event":"Kyorugi","ageGroup":"Cadet (12 to 14 Years Old)","weightClass":"BANTAM 37.01KG-41KG"},
    {"name":"Athlete 009 (Saujana Tkd Club)","gender":"Female","club":"SAUJANA TKD CLUB","event":"Recognize Poomsae","ageGroup":"Super Cadet (9 to 11 Years Old)","weightClass":"Taegeuk 4 to Koryo"},
    {"name":"Athlete 010 (Saujana Tkd Club)","gender":"Female","club":"SAUJANA TKD CLUB","event":"Virtual Taekwondo","ageGroup":"Super Cadet (9 To 10 Years Old)","weightClass":"Open Weight"},

    {"name":"Athlete 001 (Tyc Taekwondo Club)","gender":"Female","club":"TYC TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Cadet (12 to 14 Years Old)","weightClass":"LIGHT MIDDLE 47.01KG-51KG"},
    {"name":"Athlete 002 (Tyc Taekwondo Club)","gender":"Female","club":"TYC TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Super Cadet (9 to 11 Years Old)","weightClass":"HEAVY 38KG & ABOVE"},
    {"name":"Athlete 003 (Tyc Taekwondo Club)","gender":"Female","club":"TYC TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Super Cadet (9 to 11 Years Old)","weightClass":"HEAVY 38KG & ABOVE"},
    {"name":"Athlete 004 (Tyc Taekwondo Club)","gender":"Female","club":"TYC TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Cadet (12 to 14 Years Old)","weightClass":"BANTAM 33.01KG-37KG"},
    {"name":"Athlete 005 (Tyc Taekwondo Club)","gender":"Male","club":"TYC TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Junior (15 to 17 Years Old)","weightClass":"FEATHER 51.01KG-55KG"},

    {"name":"Athlete 001 (Matsa Taekwondo Club)","gender":"Female","club":"MATSA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Junior (15 to 17 Years Old)","weightClass":"LIGHT HEAVY 63.01KG-68KG"},
    {"name":"Athlete 002 (Matsa Taekwondo Club)","gender":"Female","club":"MATSA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Junior (15 to 17 Years Old)","weightClass":"FIN BELOW 42KG"},
    {"name":"Athlete 003 (Matsa Taekwondo Club)","gender":"Female","club":"MATSA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Cadet (12 to 14 Years Old)","weightClass":"FLY 29.01KG-33KG"},
    {"name":"Athlete 004 (Matsa Taekwondo Club)","gender":"Female","club":"MATSA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Cadet (12 to 14 Years Old)","weightClass":"FLY 29.01KG-33KG"},
    {"name":"Athlete 005 (Matsa Taekwondo Club)","gender":"Female","club":"MATSA TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Cadet (12 to 14 Years Old)","weightClass":"FLY 29.01KG-33KG"},

    {"name":"Athlete 001 (Pusat Seni Mempertahankan Diri Taekwondo Action Wtf)","gender":"Female","club":"PUSAT SENI MEMPERTAHANKAN DIRI TAEKWONDO ACTION WTF","event":"Kyorugi","ageGroup":"Super Cadet (9 to 11 Years Old)","weightClass":"BANTAM 21.01KG-24KG"},
    {"name":"Athlete 002 (Pusat Seni Mempertahankan Diri Taekwondo Action Wtf)","gender":"Female","club":"PUSAT SENI MEMPERTAHANKAN DIRI TAEKWONDO ACTION WTF","event":"Kyorugi","ageGroup":"Junior (15 to 17 Years Old)","weightClass":"HEAVY 68KG & ABOVE"},
    {"name":"Athlete 003 (Pusat Seni Mempertahankan Diri Taekwondo Action Wtf)","gender":"Male","club":"PUSAT SENI MEMPERTAHANKAN DIRI TAEKWONDO ACTION WTF","event":"Kyorugi","ageGroup":"Junior (15 to 17 Years Old)","weightClass":"FEATHER 51.01KG-55KG"},

    {"name":"Athlete 001 (Koryo Taekwondo Club)","gender":"Female","club":"KORYO TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Cadet (12 to 14 Years Old)","weightClass":"HEAVY 59KG & ABOVE"},
    {"name":"Athlete 002 (Koryo Taekwondo Club)","gender":"Female","club":"KORYO TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Cadet (12 to 14 Years Old)","weightClass":"HEAVY 59KG & ABOVE"},
    {"name":"Athlete 003 (Koryo Taekwondo Club)","gender":"Male","club":"KORYO TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Cadet (12 to 14 Years Old)","weightClass":"LIGHT 45.01KG-49KG"},
    {"name":"Athlete 004 (Koryo Taekwondo Club)","gender":"Male","club":"KORYO TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Super Cadet (9 to 11 Years Old)","weightClass":"FLY 20.01KG-23KG"},
    {"name":"Athlete 005 (Koryo Taekwondo Club)","gender":"Male","club":"KORYO TAEKWONDO CLUB","event":"Kyorugi","ageGroup":"Super Cadet (9 to 11 Years Old)","weightClass":"FLY 20.01KG-23KG"}
  ] as Partial<Player>[],
  clubs: {
    "SMART MA TAEKWONDO CLUB": "smartmataekwondoclub",
    "SAUJANA TKD CLUB": "saujanatkdclub",
    "TYC TAEKWONDO CLUB": "tyctaekwondoclub",
    "MATSA TAEKWONDO CLUB": "matsataekwondoclub",
    "PUSAT SENI MEMPERTAHANKAN DIRI TAEKWONDO ACTION WTF": "pusatsenimempertahan",
    "KORYO TAEKWONDO CLUB": "koryotaekwondoclub"
  } as Record<string, string>
};

export const BELT_COLORS = ['#EDEDE8', '#D9C24A', '#3D8B4E', '#3572B0', '#8A4FBF', '#5A3A1E', '#1A1A1A'];

export function beltColorFor(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = str.charCodeAt(i) + ((h << 5) - h);
  }
  return BELT_COLORS[Math.abs(h) % BELT_COLORS.length];
}
