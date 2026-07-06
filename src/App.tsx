import React, { useState, useEffect, useRef } from 'react';
import { 
  Trophy, Users, CheckCircle, ShieldCheck, Scale, QrCode, Camera, 
  UserPlus, Download, LogOut, Settings, Plus, Trash2, Edit, Search, 
  AlertCircle, Calendar, MapPin, User, Lock, Upload, Activity, FileText,
  ChevronRight, RefreshCw, Eye, Palette, Sliders, Layout, Sun, GripVertical,
  Printer, Database
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import * as htmlToImage from 'html-to-image';
import jsQR from 'jsqr';
import { Competition, Player, Coach, WeighIn } from './types';
import { DEMO_IMPORT, beltColorFor } from './demoData';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

export default function App() {
  // --- STATE ---
  const [screen, setScreen] = useState<string>('login'); // login, coachHome, coachRoster, coachPlayerForm, idCard, adminHome, adminCompDetail, adminCompForm, officialScan, officialLog, organizerDashboard
  const [loginTab, setLoginTab] = useState<'coach' | 'official' | 'admin' | 'organizer'>('coach');
  const [role, setRole] = useState<'coach' | 'official' | 'admin' | 'organizer' | null>(null);
  const [user, setUser] = useState<string | null>(null); // username
  const [compId, setCompId] = useState<string | null>(null);
  
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [coaches, setCoaches] = useState<Record<string, Coach>>({});
  const [organizers, setOrganizers] = useState<Record<string, import('./types').Organizer>>({});
  const [players, setPlayers] = useState<Player[]>([]);
  const [masterAthletes, setMasterAthletes] = useState<Record<string, Partial<Player>>>({});


  
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: 'error' | 'ok' } | null>(null);
  const [scanning, setScanning] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  
  // Modals & confirmation
  const [confirmImport, setConfirmImport] = useState<boolean>(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  
  // Theme state
  const [theme, setTheme] = useState<'emerald' | 'midnight' | 'crimson' | 'zen'>(() => {
    const saved = localStorage.getItem('app:theme');
    if (saved && ['emerald', 'midnight', 'crimson', 'zen'].includes(saved)) {
      return saved as any;
    }
    return 'emerald';
  });
  const [showThemeModal, setShowThemeModal] = useState<boolean>(false);

  // Custom layout & background color states
  const [layoutDensity, setLayoutDensity] = useState<'bento' | 'compact'>(() => {
    return (localStorage.getItem('app:layoutDensity') as any) || 'bento';
  });
  const [layoutWidth, setLayoutWidth] = useState<'standard' | 'widescreen' | 'fluid'>(() => {
    return (localStorage.getItem('app:layoutWidth') as any) || 'standard';
  });
  const [customBgColor, setCustomBgColor] = useState<string>(() => {
    return localStorage.getItem('app:customBgColor') || '#FFFFFF'; // Default is white
  });

  const getLayoutWidthClass = () => {
    if (layoutWidth === 'widescreen') return 'max-w-[1500px]';
    if (layoutWidth === 'fluid') return 'max-w-full px-4 sm:px-8';
    return 'max-w-7xl'; // standard
  };
  
  // Manual text entry
  const [manualCode, setManualCode] = useState<string>('');
  const [actualWeightInput, setActualWeightInput] = useState<string>('');
  
  // Admin form inputs
  const [ncName, setNcName] = useState('');
  const [ncVenue, setNcVenue] = useState('');
  const [ncDate, setNcDate] = useState('');
  const [ncCode, setNcCode] = useState('weighin123');
  
  // Category additions
  const [newAgeGroup, setNewAgeGroup] = useState('');
  const [newWc, setNewWc] = useState('');

  // Player Form inputs
  const [pName, setPName] = useState('');
  const [pIc, setPIc] = useState('');
  const [pDob, setPDob] = useState('');
  const [pGender, setPGender] = useState('');
  const [pClub, setPClub] = useState('');
  const [pEvent, setPEvent] = useState('');
  const [pAgeGroup, setPAgeGroup] = useState('');
  const [pWeightClass, setPWeightClass] = useState('');
  const [selectedMasterId, setSelectedMasterId] = useState<string | null>(null);

  // Login inputs
  const [cUser, setCUser] = useState('');
  const [cPass, setCPass] = useState('');
  const [sUser, setSUser] = useState('');
  const [sPass, setSPass] = useState('');
  const [sName, setSName] = useState('');
  const [sClub, setSClub] = useState('');
  const [cComp, setCComp] = useState('');
  const [oComp, setOComp] = useState('');
  const [oCode, setOCode] = useState('');
  const [aUser, setAUser] = useState('admin');
  const [aPass, setAPass] = useState('');

  // Admin coach edit
  const [editingCoachUsername, setEditingCoachUsername] = useState<string | null>(null);
  const [editCoachName, setEditCoachName] = useState('');
  const [editCoachClub, setEditCoachClub] = useState('');
  const [editCoachPass, setEditCoachPass] = useState('');
  
  // Admin Navigation
  const [adminTab, setAdminTab] = useState<'tournaments' | 'coaches' | 'organizers' | 'security'>('tournaments');

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

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

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
    // Load from local storage
    const storedComps = localStorage.getItem('app:competitions');
    const storedCoaches = localStorage.getItem('app:coaches');
    
    let loadedComps: Competition[] = [];
    if (storedComps) {
      try {
        loadedComps = JSON.parse(storedComps);
        setCompetitions(loadedComps);
      } catch (e) {
        console.error("Failed to parse competitions", e);
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
        isActive: true
      }];
      setCompetitions(defaultComps);
      localStorage.setItem('app:competitions', JSON.stringify(defaultComps));
      if (defaultComps.length > 0) {
        setOComp(defaultComps[0].id);
        setCComp(defaultComps[0].id);
      }
    } else {
      setOComp(loadedComps[0]?.id || '');
      // Select the first active competition for coach if possible
      const activeComps = loadedComps.filter(c => c.isActive !== false);
      setCComp(activeComps[0]?.id || loadedComps[0]?.id || '');
    }

    if (storedCoaches) {
      try {
        setCoaches(JSON.parse(storedCoaches));
      } catch (e) {
        console.error("Failed to parse coaches", e);
      }
    } else {
      const defaultCoaches = { 
        demo: { password: 'demo123', name: 'Coach Demo', club: 'SMART MA TAEKWONDO CLUB' } 
      };
      setCoaches(defaultCoaches);
      localStorage.setItem('app:coaches', JSON.stringify(defaultCoaches));
    }

    const storedOrganizers = localStorage.getItem('app:organizers');
    if (storedOrganizers) {
      try {
        setOrganizers(JSON.parse(storedOrganizers));
      } catch (e) {
        console.error("Failed to parse organizers", e);
      }
    }

    const storedMaster = localStorage.getItem('app:masterAthletes');
    if (storedMaster) {
      try {
        setMasterAthletes(JSON.parse(storedMaster));
      } catch (e) {
        console.error("Failed to parse masterAthletes", e);
      }
    }
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
    if (compId) {
      const storedPlayers = localStorage.getItem(`app:players:${compId}`);
      if (storedPlayers) {
        try {
          setPlayers(JSON.parse(storedPlayers));
        } catch (e) {
          console.error("Failed to parse players for comp", compId, e);
          setPlayers([]);
        }
      } else {
        setPlayers([]);
      }
    } else {
      setPlayers([]);
    }
  }, [compId]);

  // --- NOTIFICATION HELPER ---
  const triggerMsg = (text: string, type: 'error' | 'ok') => {
    setMsg({ text, type });
    setTimeout(() => {
      setMsg(prev => prev?.text === text ? null : prev);
    }, 3500);
  };

  // --- SAVE HELPERS ---
  const saveCompsToStorage = (list: Competition[]) => {
    setCompetitions(list);
    localStorage.setItem('app:competitions', JSON.stringify(list));
  };

  const saveCoachesToStorage = (obj: Record<string, Coach>) => {
    setCoaches(obj);
    localStorage.setItem('app:coaches', JSON.stringify(obj));
  };

  const saveOrganizersToStorage = (obj: Record<string, import('./types').Organizer>) => {
    setOrganizers(obj);
    localStorage.setItem('app:organizers', JSON.stringify(obj));
  };

  const savePlayersToStorage = (id: string, list: Player[]) => {
    setPlayers(list);
    localStorage.setItem(`app:players:${id}`, JSON.stringify(list));
  };

  const saveMasterAthletesToStorage = (obj: Record<string, Partial<Player>>) => {
    setMasterAthletes(obj);
    localStorage.setItem('app:masterAthletes', JSON.stringify(obj));
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

  const lookupPlayer = (playerId: string) => {
    const p = players.find(pl => pl.id.toUpperCase() === playerId.toUpperCase());
    if (!p) {
      triggerMsg('Player not registered for this competition.', 'error');
      return;
    }
    setScanResult(p.id);
    setActualWeightInput(p.weighIn ? p.weighIn.weight.toString() : '');
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
    setRole('organizer');
    setUser(u);
    setCompId(acc.compId);
    setScreen('organizerDashboard');
    triggerMsg(`Welcome, Organizer ${acc.name}!`, 'ok');
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
    setRole('coach');
    setUser(u);
    setScreen('coachRoster');
    setCompId(cComp);
    triggerMsg(`Welcome back, Coach ${acc.name}!`, 'ok');
  };

  const handleCoachSignup = () => {
    const u = sUser.trim();
    const p = sPass;
    const name = sName.trim();
    const club = sClub.trim();
    if (!u || !p || !name || !club) {
      triggerMsg('Please fill in every registration field.', 'error');
      return;
    }
    if (coaches[u]) {
      triggerMsg('Username already taken.', 'error');
      return;
    }
    const updated = { ...coaches, [u]: { password: p, name, club } };
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
    if (!targetComp || targetComp.staffCode !== oCode) {
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
    setEditCoachPass(coach.password);
  };

  const handleAdminSaveCoach = () => {
    if (!editingCoachUsername) return;
    if (!editCoachName.trim() || !editCoachClub.trim() || !editCoachPass) {
      triggerMsg('Please fill in all coach details.', 'error');
      return;
    }
    const updated = {
      ...coaches,
      [editingCoachUsername]: {
        password: editCoachPass,
        name: editCoachName.trim(),
        club: editCoachClub.trim()
      }
    };
    saveCoachesToStorage(updated);
    setEditingCoachUsername(null);
    triggerMsg('Coach account updated successfully.', 'ok');
  };

  const handleAdminDeleteCoach = (username: string) => {
    if (confirm(`Are you sure you want to delete coach account ${username}?`)) {
      const updated = { ...coaches };
      delete updated[username];
      saveCoachesToStorage(updated);
      triggerMsg('Coach account deleted.', 'ok');
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
    if (confirm(`Are you sure you want to delete organizer account ${username}?`)) {
      const updated = { ...organizers };
      delete updated[username];
      saveOrganizersToStorage(updated);
      triggerMsg('Organizer account deleted.', 'ok');
    }
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
    setNcName(''); setNcVenue(''); setNcDate(''); setNcCode('weighin123');
  };

  const handleToggleCompActive = (id: string) => {
    const updated = competitions.map(c => c.id === id ? { ...c, isActive: c.isActive === false ? true : false } : c);
    saveCompsToStorage(updated);
    triggerMsg('Tournament active status updated.', 'ok');
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

  const handleUploadCategories = (e: React.ChangeEvent<HTMLInputElement>, field: 'ageGroups' | 'weightClasses') => {
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
              const combined = Array.from(new Set([...c[field], ...newItems]));
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

  const handleAddCat = (field: 'ageGroups' | 'weightClasses', val: string, setVal: React.Dispatch<React.SetStateAction<string>>) => {
    if (!compId || !val.trim()) return;
    const updated = competitions.map(c => {
      if (c.id === compId) {
        return { ...c, [field]: [...c[field], val.trim()] };
      }
      return c;
    });
    saveCompsToStorage(updated);
    setVal('');
  };

  const handleRemoveCat = (field: 'ageGroups' | 'weightClasses', index: number) => {
    if (!compId) return;
    const updated = competitions.map(c => {
      if (c.id === compId) {
        const arr = [...c[field]];
        arr.splice(index, 1);
        return { ...c, [field]: arr };
      }
      return c;
    });
    saveCompsToStorage(updated);
  };

  // --- COACH ACTIONS ---
  const handleOpenCoachPlayerForm = (playerId?: string) => {
    const comp = competitions.find(c => c.id === compId);
    if (!comp) return;

    if (playerId) {
      const p = players.find(pl => pl.id === playerId);
      if (p) {
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
      }
    } else {
      setSelectedPlayerId(null);
      setSelectedMasterId(null);
      setPName('');
      setPIc('');
      setPDob('');
      setPGender(comp.genders[0] || 'Male');
      setPClub(coaches[user || '']?.club || '');
      setPEvent(comp.events[0] || 'Kyorugi');
      setPAgeGroup(comp.ageGroups[0] || '');
      setPWeightClass(comp.weightClasses[0] || '');
      setPendingPhoto(null);
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
    if (!compId) return;

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
        weighIn: null
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
        }
      });
    }

    triggerMsg(selectedPlayerId ? 'Athlete record updated.' : 'Athlete registered successfully.', 'ok');
    setScreen(role === 'admin' ? 'adminCompDetail' : role === 'organizer' ? 'organizerDashboard' : 'coachRoster');
  };

  const handleDeletePlayer = (playerId: string) => {
    if (!compId) return;
    const updated = players.filter(p => p.id !== playerId);
    savePlayersToStorage(compId, updated);
    setConfirmDeleteId(null);
    triggerMsg('Athlete registration retracted.', 'ok');
  };

  // --- WEIGH IN ACTIONS ---
  const handleRecordWeighIn = () => {
    if (!compId || !scanResult) return;
    const val = parseFloat(actualWeightInput);
    if (isNaN(val) || val <= 0) {
      triggerMsg('Please specify a positive numeric weight measurement.', 'error');
      return;
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
            result: autoResult as any
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
    
    htmlToImage.toPng(cardRef.current, { backgroundColor: '#12211C', pixelRatio: 3 }).then(dataUrl => {
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
          const dataUrl = await htmlToImage.toPng(el, { backgroundColor: '#12211C', pixelRatio: 3 });
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
          'Identity Card / Passport': p.ic,
          'DOB': p.dob,
          'Gender': p.gender,
          'Club Represented': p.club,
          'Event': p.event,
          'Division Bracket': p.ageGroup,
          'Target Weight Class': p.weightClass,
          'Scale Weight (kg)': p.weighIn ? p.weighIn.weight : '—',
          'Weigh-In Decision': p.weighIn ? p.weighIn.result : 'NOT WEIGHED',
          'Timestamp': p.weighIn ? new Date(p.weighIn.time).toLocaleString() : '—'
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
          'Identity Card / Passport': '',
          'DOB': '',
          'Gender': '',
          'Club Represented': '',
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
          'Identity Card / Passport': '',
          'DOB': '',
          'Gender': '',
          'Club Represented': '',
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
          'Identity Card / Passport': '',
          'DOB': '',
          'Gender': '',
          'Club Represented': '',
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
                          p.club.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesUser && matchesSearch;
  });

  const activeComp = competitions.find(c => c.id === compId);

  return (
    <div className={`theme-${theme} bg-ink text-text min-h-screen flex flex-col antialiased selection:bg-gold selection:text-slate-950 transition-colors duration-300`}>
      
      {/* HEADER BANNER */}
      <header className="bg-surface/90 backdrop-blur-md border-b border-line shadow-lg sticky top-0 z-50 transition-all duration-300 print:hidden">
        <div className={`${getLayoutWidthClass()} mx-auto px-4 py-3 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4`}>
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => role ? setScreen(role === 'admin' ? 'adminHome' : role === 'organizer' ? 'organizerDashboard' : role === 'official' ? 'officialScan' : 'coachHome') : setScreen('login')}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-hong to-chong p-0.5 shadow-md flex items-center justify-center">
              <div className="w-full h-full rounded-full bg-ink flex items-center justify-center">
                <Trophy className="w-5 h-5 text-gold" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold uppercase tracking-wider font-sans text-text">MY-TKD REGS</h1>
                <span className="text-[10px] uppercase font-bold tracking-widest bg-gold/10 text-gold px-2 py-0.5 rounded border border-gold/20">Skill Matrix</span>
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
            {role && (
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
        <div className="max-w-4xl mx-auto mt-4 px-4 w-full">
          <div className={`flex items-center space-x-2 p-3.5 rounded-xl border text-sm transition-all ${
            msg.type === 'error' 
              ? 'bg-red-500/10 border-red-500/20 text-red-200' 
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200'
          }`}>
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{msg.text}</span>
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
            <div className="flex border-b border-line">
              <button 
                onClick={() => setLoginTab('coach')}
                className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition ${
                  loginTab === 'coach' ? 'border-b-2 border-gold text-gold bg-surface-2/20' : 'text-text-dim hover:text-text'
                }`}
              >
                Coach
              </button>
              <button 
                onClick={() => setLoginTab('organizer')}
                className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition ${
                  loginTab === 'organizer' ? 'border-b-2 border-gold text-gold bg-surface-2/20' : 'text-text-dim hover:text-text'
                }`}
              >
                Organizer
              </button>
              <button 
                onClick={() => setLoginTab('official')}
                className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition ${
                  loginTab === 'official' ? 'border-b-2 border-gold text-gold bg-surface-2/20' : 'text-text-dim hover:text-text'
                }`}
              >
                Official
              </button>
              <button 
                onClick={() => setLoginTab('admin')}
                className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition ${
                  loginTab === 'admin' ? 'border-b-2 border-gold text-gold bg-surface-2/20' : 'text-text-dim hover:text-text'
                }`}
              >
                Admin
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
                      {competitions.length === 0 ? (
                        <option value="">No configurations loaded...</option>
                      ) : (
                        competitions.map(c => (
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
              <div className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
                Verified Club Registrar Account
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-text-dim uppercase tracking-wider">Select active championship tournament</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {competitions.map(c => {
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
                      <p className="text-xs text-text-dim mt-1 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {c.date}</p>
                    </div>
                  );
                })}
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
                  <p className="text-xs text-text-dim">Club: <strong className="text-text">{coaches[user || '']?.club}</strong></p>
                </div>
              </div>
              <button
                onClick={() => handleOpenCoachPlayerForm()}
                className="w-full sm:w-auto bg-gold hover:opacity-90 text-ink font-bold text-xs px-4 py-2 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>Register New Athlete</span>
              </button>
            </div>

            {/* Quick KPI stats for this tournament */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-surface p-4 rounded-xl border border-line">
                <span className="block text-[10px] text-text-dim font-semibold uppercase tracking-wider">Registered Athletes</span>
                <span className="text-2xl font-black text-text">{coachFilteredPlayers.length}</span>
              </div>
              <div className="bg-surface p-4 rounded-xl border border-line">
                <span className="block text-[10px] text-text-dim font-semibold uppercase tracking-wider">Weighed In</span>
                <span className="text-2xl font-black text-text">
                  {coachFilteredPlayers.filter(p => p.weighIn !== null).length}
                </span>
              </div>
              <div className="bg-surface p-4 rounded-xl border border-line">
                <span className="block text-[10px] text-text-dim font-semibold uppercase tracking-wider">Passed Division</span>
                <span className="text-2xl font-black text-green-400">
                  {coachFilteredPlayers.filter(p => p.weighIn?.result === 'PASS' || p.weighIn?.result === 'OVERRIDE PASS').length}
                </span>
              </div>
              <div className="bg-surface p-4 rounded-xl border border-line">
                <span className="block text-[10px] text-text-dim font-semibold uppercase tracking-wider">Failed / Pending</span>
                <span className="text-2xl font-black text-red-400">
                  {coachFilteredPlayers.filter(p => p.weighIn?.result === 'FAIL' || p.weighIn?.result === 'OVERRIDE FAIL').length}
                </span>
              </div>
            </div>

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
                
                {/* Search Bar */}
                <div className="relative w-full md:w-72">
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name or code..."
                    className="w-full bg-ink border border-line text-xs rounded-xl py-2 pl-8 pr-4 text-text focus:outline-none focus:border-gold"
                  />
                  <Search className="w-3.5 h-3.5 text-text-dim/60 absolute left-2.5 top-2.5" />
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
                                {p.weighIn && (
                                  <span className="text-[10px] text-text-dim">
                                    Observed: <strong>{p.weighIn.weight}kg</strong>
                                  </span>
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
                                <button 
                                  onClick={() => handleOpenCoachPlayerForm(p.id)}
                                  className="bg-ink text-text-dim hover:text-text p-1.5 rounded border border-line transition"
                                  title="Edit Competitor Info"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                {confirmDeleteId === p.id ? (
                                  <div className="flex items-center space-x-1">
                                    <button 
                                      onClick={() => handleDeletePlayer(p.id)}
                                      className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-[10px] font-bold"
                                    >
                                      Confirm
                                    </button>
                                    <button 
                                      onClick={() => setConfirmDeleteId(null)}
                                      className="bg-surface-2 text-text px-2 py-1 rounded text-[10px]"
                                    >
                                      X
                                    </button>
                                  </div>
                                ) : (
                                  <button 
                                    onClick={() => setConfirmDeleteId(p.id)}
                                    className="bg-ink text-red-500 hover:bg-red-950/20 p-1.5 rounded border border-line transition"
                                    title="Deregister competitor"
                                  >
                                    <Trash2 className="w-4 h-4" />
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
                          placeholder="Type to search saved athletes by Name, IC/Passport, or Club..." 
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
                              const list = Object.values(masterAthletes).filter((ma: any) => {
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
                <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Full Legal Name</label>
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
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">IC / Passport Number</label>
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
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Date of Birth</label>
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
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Gender Division</label>
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
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Affiliated Club / Team</label>
                  <input 
                    type="text" 
                    value={pClub}
                    onChange={(e) => setPClub(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSavePlayer(); }}
                    placeholder="e.g. Smart Ma Taekwondo" 
                    className="w-full bg-ink border border-line text-sm rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Tournament Event</label>
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
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Age Group Category</label>
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
                <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Target Weight Class</label>
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
                <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Athlete Portrait Photograph (4:5 ratio)</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="w-full text-xs text-text-dim bg-ink border border-line file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-surface-2 file:text-gold hover:file:opacity-90 transition"
                />
                
                {pendingPhoto && (
                  <div className="mt-4 flex items-center space-x-3">
                    <img 
                      src={pendingPhoto} 
                      alt="Crop preview" 
                      className="w-20 h-24 object-cover rounded-lg border border-line" 
                    />
                    <span className="text-xs text-text-dim">Portrait automatically optimized and cropped (192 x 240 pixels) for printing.</span>
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
                      className="w-80 bg-gradient-to-br from-[#12211C] to-[#0A1310] border border-slate-700/60 rounded-3xl overflow-hidden shadow-2xl relative flex flex-col justify-between"
                      id="designed-id-card"
                      style={{ minHeight: '440px' }}
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
                                <span className="font-display font-bold tracking-wider uppercase drop-shadow-sm truncate" style={{ fontSize: getFontSizePx(field.fontSize, '10px'), color: field.color || '#ffffff' }}>{activeComp.name}</span>
                                <span className="font-display font-bold tracking-wider uppercase bg-slate-950/20 px-2 py-0.5 rounded border border-white/20 shrink-0" style={{ fontSize: getFontSizePx(field.fontSize, '10px'), color: field.color || '#ffffff' }}>{p.event}</span>
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
                    <button 
                      onClick={() => handleOpenCoachPlayerForm(p.id)}
                      className="w-full sm:w-auto bg-surface border border-line text-text-dim hover:text-text px-5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                    >
                      <Edit className="w-4 h-4" />
                      <span>Modify Athlete</span>
                    </button>
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
                <p className="text-xs text-text-dim">Tournament Active: <strong className="text-text">{activeComp.name}</strong></p>
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
              
              {/* VIDEO SCANNER BLOCK */}
              <div className="bg-surface rounded-2xl border border-line p-5 space-y-4">
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

                        <div>
                          <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Official Actual weight measurement (kg)</label>
                          <div className="flex space-x-2">
                            <input 
                               type="number" 
                               step="0.01"
                               value={actualWeightInput}
                               onChange={(e) => setActualWeightInput(e.target.value)}
                               onKeyDown={(e) => { if (e.key === 'Enter') handleRecordWeighIn(); }}
                               placeholder="e.g. 54.8" 
                               className="flex-1 bg-ink border border-line text-sm font-mono rounded-xl py-2 px-3 text-text focus:outline-none focus:border-gold transition"
                            />
                            <button 
                              onClick={handleRecordWeighIn}
                              className="bg-gold hover:opacity-90 text-ink font-bold px-5 py-2.5 rounded-xl text-xs shadow-md"
                            >
                              Record Entry
                            </button>
                          </div>
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
                            <td className="p-4 font-bold text-text">{p.name}</td>
                            <td className="p-4 text-text">{p.club}</td>
                            <td className="p-4 text-text-dim">
                              <div className="font-semibold text-text">{p.weightClass}</div>
                              {range && <span className="text-[10px] font-mono">{range.min === 0 ? '≤ ' : `${range.min}kg - `}{range.max}kg</span>}
                            </td>
                            <td className="p-4 font-mono font-bold text-sm text-text">{p.weighIn.weight} kg</td>
                            <td className="p-4">{renderBadge(p.weighIn.result)}</td>
                            <td className="p-4 text-text-dim">{new Date(p.weighIn.time).toLocaleTimeString()}</td>
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
                              <p className="text-xs text-text-dim flex items-center gap-1"><Calendar className="w-3.5 h-3.5 shrink-0" /> {c.date}</p>
                            </div>

                            <div className="border-t border-line/40 pt-4 mt-4 flex items-center justify-between gap-2">
                              <button 
                                onClick={() => { setCompId(c.id); setScreen('adminCompDetail'); }}
                                className="bg-ink text-gold hover:bg-surface-2 border border-line px-4 py-2 rounded-xl text-xs font-bold transition flex-1 text-center"
                              >
                                Configure Event
                              </button>
                              <button
                                onClick={() => handleToggleCompActive(c.id)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex-1 text-center border ${
                                  c.isActive !== false
                                    ? 'bg-good/10 text-good border-good/30 hover:bg-good/20'
                                    : 'bg-surface-2 text-text-dim border-line hover:text-text'
                                }`}
                              >
                                {c.isActive !== false ? 'Active' : 'Inactive'}
                              </button>
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
                                  <td className="p-4 text-right whitespace-nowrap">
                                    <button
                                      onClick={() => handleAdminEditCoach(username, coach)}
                                      className="text-chong hover:bg-chong/10 p-1.5 rounded transition mr-2"
                                      title="Edit"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleAdminDeleteCoach(username)}
                                      className="text-hong hover:bg-hong/10 p-1.5 rounded transition"
                                      title="Delete"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
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
                                <button
                                  onClick={() => handleAdminDeleteOrganizer(username)}
                                  className="text-hong hover:bg-hong/10 p-1.5 rounded transition"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <label className="block text-xs font-semibold text-text-dim uppercase tracking-widest mb-1.5">Tournament Date</label>
                  <input 
                    type="date" 
                    value={ncDate}
                    onChange={(e) => setNcDate(e.target.value)}
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
              <div className="flex items-center space-x-3">
                <button 
                  onClick={() => setScreen('adminHome')}
                  className="text-xs text-gold border border-gold/30 px-3 py-1.5 rounded-lg hover:bg-gold/10 transition"
                >
                  ← All Tournaments
                </button>
                <div>
                  <h2 className="text-lg font-bold uppercase tracking-wider text-text font-display">{activeComp.name}</h2>
                  <p className="text-xs text-text-dim">Venue: {activeComp.venue} · Date: {activeComp.date}</p>
                </div>
              </div>
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
                                    <span className="font-display font-bold tracking-wider uppercase drop-shadow-sm truncate" style={{ fontSize: getFontSizePx(field.fontSize, '8px'), color: field.color || '#ffffff' }}>{activeComp.name}</span>
                                    <span className="font-display font-bold tracking-wider uppercase bg-slate-950/20 px-1.5 py-0.5 rounded border border-white/20 shrink-0" style={{ fontSize: getFontSizePx(field.fontSize, '8px'), color: field.color || '#ffffff' }}>{p.event}</span>
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
                                              value="MOCK" 
                                              size={44} 
                                              level="M" 
                                              includeMargin={false}
                                            />
                                          </div>
                                          <div className={textAlignmentClass}>
                                            <p className="font-display font-bold uppercase tracking-wider" style={{ fontSize: getFontSizePx(field.fontSize, '7px'), color: field.color || '#D4AF37' }}>Tournament Entry Pass</p>
                                            <p className="mt-0.5 leading-normal" style={{ fontSize: getFontSizePx(field.fontSize, '6px'), color: field.color || '#a0aec0', opacity: 0.85 }}>Scan to digitally verify athlete.</p>
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
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                
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
                          <td className="p-4 font-bold text-text">{p.name}</td>
                          <td className="p-4 text-text">{p.club}</td>
                          <td className="p-4 text-text-dim">{p.ageGroup} · {p.gender}</td>
                          <td className="p-4 text-text-dim">{p.weightClass}</td>
                          <td className="p-4">
                            <div className="flex flex-col gap-1 items-start">
                              {renderBadge(p.weighIn?.result)}
                              {p.weighIn && <span className="text-[10px] text-text-dim">Scale Readout: {p.weighIn.weight}kg</span>}
                            </div>
                          </td>
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

            <div className="flex flex-col lg:flex-row gap-6 items-start">
              <div className="flex-1 space-y-6 w-full">

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
                            <td colSpan={6} className="p-4 text-center text-text-dim text-xs">No athletes yet.</td>
                          </tr>
                        );
                      }
                      
                      return entries.map(([club, counts]: [string, any]) => (
                        <tr key={club} className="hover:bg-surface-2/50 transition">
                          <td className="p-4 text-text-dim font-medium">{club}</td>
                          <td className="p-4 text-center font-mono text-text">{counts.kyorugi > 0 ? counts.kyorugi : '-'}</td>
                          <td className="p-4 text-center font-mono text-text">{counts.poomsae > 0 ? counts.poomsae : '-'}</td>
                          <td className="p-4 text-center font-mono text-text">{counts.para > 0 ? counts.para : '-'}</td>
                          <td className="p-4 text-center font-mono text-text">{counts.virtual > 0 ? counts.virtual : '-'}</td>
                          <td className="p-4 text-center font-mono font-bold text-text">{counts.total}</td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-surface rounded-2xl border border-line p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-line/50">
                <h3 className="text-sm font-bold uppercase tracking-wider text-text">All Registered Entrants ({players.length})</h3>
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
                <div className="text-center py-12 text-text-dim border border-line border-dashed rounded-xl">
                  No competitors registered for this tournament yet.
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
                          <td className="p-4 font-bold text-text">{p.name}</td>
                          <td className="p-4 text-text">{p.club}</td>
                          <td className="p-4 text-text-dim">{p.ageGroup} · {p.gender}</td>
                          <td className="p-4 text-text-dim">{p.weightClass}</td>
                          <td className="p-4">
                            <div className="flex flex-col gap-1 items-start">
                              {renderBadge(p.weighIn?.result)}
                              {p.weighIn && <span className="text-[10px] text-text-dim">Scale Readout: {p.weighIn.weight}kg</span>}
                            </div>
                          </td>
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

            {/* SIDEBAR FOR ORGANIZER */}
            <div className="w-full lg:w-[320px] shrink-0 space-y-6">
              <div className="bg-surface rounded-2xl border border-line p-5 space-y-5 shadow-sm sticky top-6">
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
                  <label className="cursor-pointer bg-gold/10 text-gold border border-gold/30 hover:bg-gold/15 rounded-xl p-2.5 text-center transition flex items-center justify-center gap-2 w-full font-bold shadow text-xs">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{activeComp.idCardBgUrl ? 'Replace Background' : 'Upload Background'}</span>
                    <input 
                      type="file" 
                      accept="image/png, image/jpeg"
                      className="hidden"
                      onChange={handleUploadIdCardBg}
                    />
                  </label>

                  {/* MINI LIVE PREVIEW */}
                  <div className="relative w-full aspect-[1/1.4] rounded-xl border border-line overflow-hidden shadow-inner flex flex-col bg-gradient-to-br from-[#12211C] to-[#0A1310]">
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
                          'xs': '7px',
                          'sm': '9px',
                          'base': '11px',
                          'lg': '13px',
                          'xl': '16px',
                          '2xl': '20px',
                          '3xl': '24px'
                        };
                        return map[size] || defaultVal;
                      };

                      return (
                        <div className="relative z-10 h-full flex-1 flex flex-col justify-between text-[10px] py-1.5">
                          {fieldsList.filter(f => f.visible).map(field => {
                            if (field.id === 'header') {
                              return (
                                <div key="header" className={`h-7 bg-gradient-to-r from-hong via-hong to-chong flex ${
                                  field.align === 'left' ? 'justify-start gap-1.5' :
                                  field.align === 'right' ? 'justify-end gap-1.5' :
                                  field.align === 'center' ? 'justify-center gap-1.5' :
                                  'justify-between'
                                } items-center px-2.5 shrink-0 shadow-sm w-full`}>
                                  <span className="font-display font-bold tracking-wider uppercase drop-shadow-sm truncate" style={{ fontSize: getFontSizePx(field.fontSize, '7px'), color: field.color || '#ffffff' }}>{activeComp.name}</span>
                                  <span className="font-display font-bold tracking-wider uppercase bg-slate-950/20 px-1 py-0.5 rounded border border-white/20 shrink-0" style={{ fontSize: getFontSizePx(field.fontSize, '7px'), color: field.color || '#ffffff' }}>{p.event}</span>
                                </div>
                              );
                            }
                            if (field.id === 'belt') {
                              return (
                                <div key="belt" className="h-1 w-full shrink-0" style={{ backgroundColor: belt }}></div>
                              );
                            }

                            // Render mini interactive card items
                            return (
                              <div key={field.id} className="px-3 py-0.5 shrink-0">
                                {(() => {
                                  if (field.id === 'photo') {
                                    return (
                                      <div className={`flex ${
                                        field.align === 'left' ? 'justify-start' :
                                        field.align === 'right' ? 'justify-end' :
                                        'justify-center'
                                      }`}>
                                        <div className="w-12 h-14 bg-ink rounded-lg border border-line flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                                          <User className="w-4 h-4 text-text-dim/40 mx-auto" />
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
                                        <h3 className="font-display font-bold leading-tight tracking-wide uppercase line-clamp-2" style={{ fontSize: getFontSizePx(field.fontSize, '11px'), color: field.color || '#ffffff' }}>{p.name}</h3>
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
                                        <p className="uppercase tracking-widest text-[7px]" style={{ fontSize: getFontSizePx(field.fontSize, '7px'), color: field.color || '#a0aec0' }}>{p.club}</p>
                                      </div>
                                    );
                                  }
                                  if (field.id === 'athleteId') {
                                    return (
                                      <div className={
                                        field.align === 'left' ? 'text-left' :
                                        field.align === 'right' ? 'text-right' :
                                        'text-center'
                                      }>
                                        <span className="inline-block bg-surface border border-line font-mono px-1 py-0.5 rounded font-bold text-[7px]" style={{ fontSize: getFontSizePx(field.fontSize, '7px'), color: field.color || '#D4AF37' }}>{p.id}</span>
                                      </div>
                                    );
                                  }
                                  if (field.id === 'metadata') {
                                    return (
                                      <div className={`grid grid-cols-2 gap-1 text-[8px] border-t border-line/30 pt-2 ${
                                        field.align === 'left' ? 'text-left' :
                                        field.align === 'right' ? 'text-right' :
                                        'text-center'
                                      }`}>
                                        <div>
                                          <span className="block text-[6px] text-text-dim/60 uppercase tracking-widest font-bold">Category</span>
                                          <span className="font-medium line-clamp-1" style={{ fontSize: getFontSizePx(field.fontSize, '8px'), color: field.color || '#ffffff' }}>{p.ageGroup}</span>
                                        </div>
                                        <div>
                                          <span className="block text-[6px] text-text-dim/60 uppercase tracking-widest font-bold">Gender</span>
                                          <span className="font-medium" style={{ fontSize: getFontSizePx(field.fontSize, '8px'), color: field.color || '#ffffff' }}>{p.gender}</span>
                                        </div>
                                        <div>
                                          <span className="block text-[6px] text-text-dim/60 uppercase tracking-widest font-bold font-sans">Weight</span>
                                          <span className="font-medium line-clamp-1" style={{ fontSize: getFontSizePx(field.fontSize, '8px'), color: field.color || '#ffffff' }}>{p.weightClass}</span>
                                        </div>
                                        <div>
                                          <span className="block text-[6px] text-text-dim/60 uppercase tracking-widest font-bold">DOB</span>
                                          <span className="font-medium" style={{ fontSize: getFontSizePx(field.fontSize, '8px'), color: field.color || '#ffffff' }}>{p.dob}</span>
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
                                      <div className={`${containerClass} border-t border-dashed border-line/30 pt-1.5`}>
                                        <div className="bg-white p-0.5 rounded inline-block shadow shrink-0">
                                          <QRCodeSVG 
                                            value="MOCK" 
                                            size={28} 
                                            level="M" 
                                            includeMargin={false}
                                          />
                                        </div>
                                        <div className={textAlignmentClass}>
                                          <p className="font-display font-bold uppercase tracking-wider text-[6px]" style={{ fontSize: getFontSizePx(field.fontSize, '6px'), color: field.color || '#D4AF37' }}>Tournament Entry Pass</p>
                                          <p className="mt-0.5 leading-normal text-[5px]" style={{ fontSize: getFontSizePx(field.fontSize, '5px'), color: field.color || '#a0aec0', opacity: 0.85 }}>Scan to digitally verify athlete.</p>
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

                  {/* FIELD DESIGNER STACKED LIST */}
                  <div className="border-t border-line/50 pt-4 space-y-3.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-dim block">Badge Field Configurations</span>
                    
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 divide-y divide-line/20">
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
                            className="pt-2.5 first:pt-0 space-y-1.5 border border-transparent p-1 hover:bg-white/5 rounded-lg cursor-grab active:cursor-grabbing transition-all duration-150"
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
            </div>

          </div>
        </div>
        )}

      </main>

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
                  placeholder="Search saved database by name, IC/passport number, club/affiliated team..." 
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
                          <button 
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete ${ma.name} from the local athlete database? This action is irreversible.`)) {
                                const updated = { ...masterAthletes };
                                delete updated[ma.id];
                                saveMasterAthletesToStorage(updated);
                                triggerMsg('Athlete profile removed from database successfully!', 'ok');
                              }
                            }}
                            className="text-[10px] text-hong hover:text-white border border-hong/20 hover:bg-hong/90 px-2.5 py-1.5 rounded-lg transition font-bold cursor-pointer"
                          >
                            Delete Profile
                          </button>
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
                                        <span className="font-display font-bold tracking-wider uppercase drop-shadow-sm truncate" style={{ fontSize: getFontSizePx(field.fontSize, '8px'), color: field.color || '#ffffff' }}>{activeComp.name}</span>
                                        <span className="font-display font-bold tracking-wider uppercase bg-slate-950/20 px-1.5 py-0.5 rounded border border-white/20 shrink-0" style={{ fontSize: getFontSizePx(field.fontSize, '8px'), color: field.color || '#ffffff' }}>{p.event || activeComp.name}</span>
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
                                          <p className="font-display font-bold uppercase tracking-wider text-[7px]" style={{ fontSize: getFontSizePx(field.fontSize, '7px'), color: field.color || '#D4AF37' }}>Tournament Entry Pass</p>
                                          <p className="mt-0.5 leading-normal text-[5.5px] text-text-dim" style={{ fontSize: getFontSizePx(field.fontSize, '5.5px'), color: '#a0aec0', opacity: 0.85 }}>Scan to digitally verify athlete.</p>
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
                  className="w-[320px] h-[448px] bg-gradient-to-br from-[#12211C] to-[#0A1310] border-2 border-dashed border-gray-400 rounded-3xl overflow-hidden relative flex flex-col justify-between break-inside-avoid page-break-inside-avoid"
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
                            <span className="font-display font-bold tracking-wider uppercase drop-shadow-sm truncate text-white" style={{ fontSize: getFontSizePx(field.fontSize, '8px'), color: field.color || '#ffffff' }}>{activeComp.name}</span>
                            <span className="font-display font-bold tracking-wider uppercase bg-slate-950/20 px-1.5 py-0.5 rounded border border-white/20 shrink-0 text-white" style={{ fontSize: getFontSizePx(field.fontSize, '8px'), color: field.color || '#ffffff' }}>{p.event || activeComp.name}</span>
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
                              <p className="font-display font-bold uppercase tracking-wider text-[7px]" style={{ fontSize: getFontSizePx(field.fontSize, '7px'), color: field.color || '#D4AF37' }}>Tournament Entry Pass</p>
                              <p className="mt-0.5 leading-normal text-[6px] text-text-dim" style={{ fontSize: getFontSizePx(field.fontSize, '6px'), color: '#a0aec0', opacity: 0.85 }}>Scan to digitally verify athlete.</p>
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
          {players.map(p => {
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
                id={`batch-card-${p.id}`}
                className="w-[320px] h-[448px] bg-gradient-to-br from-[#12211C] to-[#0A1310] border border-slate-700/60 rounded-3xl overflow-hidden relative flex flex-col justify-between"
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
                          <span className="font-display font-bold tracking-wider uppercase drop-shadow-sm truncate text-white" style={{ fontSize: getFontSizePx(field.fontSize, '8px'), color: field.color || '#ffffff' }}>{activeComp.name}</span>
                          <span className="font-display font-bold tracking-wider uppercase bg-slate-950/20 px-1.5 py-0.5 rounded border border-white/20 shrink-0 text-white" style={{ fontSize: getFontSizePx(field.fontSize, '8px'), color: field.color || '#ffffff' }}>{p.event || activeComp.name}</span>
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
                            <p className="font-display font-bold uppercase tracking-wider text-[7px]" style={{ fontSize: getFontSizePx(field.fontSize, '7px'), color: field.color || '#D4AF37' }}>Tournament Entry Pass</p>
                            <p className="mt-0.5 leading-normal text-[6px] text-text-dim" style={{ fontSize: getFontSizePx(field.fontSize, '6px'), color: '#a0aec0', opacity: 0.85 }}>Scan to digitally verify athlete.</p>
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

    </div>
  );
}
