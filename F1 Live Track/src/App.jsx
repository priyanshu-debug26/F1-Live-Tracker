import logo from './assets/logo.png';
import { useEffect, useState, useRef, useMemo } from 'react';
import { staticTracks } from './assets/staticTracks.js';
import { FALLBACK_GPS, FALLBACK_DRIVERS } from './assets/fallbackData.js';

const CIRCUIT_GP_NAMES = {
  "Sakhir": "Bahrain Grand Prix",
  "Jeddah": "Saudi Arabian Grand Prix",
  "Melbourne": "Australian Grand Prix",
  "Suzuka": "Japanese Grand Prix",
  "Shanghai": "Chinese Grand Prix",
  "Miami": "Miami Grand Prix",
  "Imola": "Emilia Romagna Grand Prix",
  "Monte Carlo": "Monaco Grand Prix",
  "Montreal": "Canadian Grand Prix",
  "Catalunya": "Spanish Grand Prix",
  "Spielberg": "Austrian Grand Prix (Red Bull Ring)",
  "Silverstone": "British Grand Prix",
  "Hungaroring": "Hungarian Grand Prix",
  "Spa-Francorchamps": "Belgian Grand Prix",
  "Zandvoort": "Dutch Grand Prix",
  "Monza": "Italian Grand Prix",
  "Baku": "Azerbaijan Grand Prix",
  "Singapore": "Singapore Grand Prix",
  "Austin": "United States Grand Prix (COTA)",
  "Mexico City": "Mexico City Grand Prix",
  "Interlagos": "São Paulo Grand Prix",
  "Las Vegas": "Las Vegas Grand Prix",
  "Lusail": "Qatar Grand Prix",
  "Yas Marina Circuit": "Abu Dhabi Grand Prix"
};

const formatLapTime = (durationSec) => {
  if (!durationSec) return "-";
  const mins = Math.floor(durationSec / 60);
  const secs = Math.floor(durationSec % 60);
  const ms = Math.floor((durationSec % 1) * 1000);
  
  const padSecs = secs.toString().padStart(2, '0');
  const padMs = ms.toString().padStart(3, '0');
  
  if (mins > 0) {
    return `${mins}:${padSecs}.${padMs}`;
  }
  return `${secs}.${padMs}`;
};

// Coordinate conversion helper
const processCoordinates = (points, width = 600, height = 600, padding = 40) => {
  if (!points || points.length === 0) return { path: "", scaleInfo: null };

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  points.forEach(p => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });

  const wTrack = maxX - minX;
  const hTrack = maxY - minY;

  if (wTrack === 0 || hTrack === 0) return { path: "", scaleInfo: null };

  const wAvail = width - 2 * padding;
  const hAvail = height - 2 * padding;

  // Maintain aspect ratio
  const scale = Math.min(wAvail / wTrack, hAvail / hTrack);

  const dx = padding + (wAvail - wTrack * scale) / 2;
  const dy = padding + (hAvail - hTrack * scale) / 2;

  const scaleInfo = { minX, maxX, minY, maxY, scale, dx, dy };

  // Form SVG Path
  const pathPoints = points.map(p => {
    const sx = dx + (p.x - minX) * scale;
    const sy = dy + (scaleInfo.maxY - p.y) * scale; // Invert Y for screen coordinates
    return `${sx.toFixed(1)},${sy.toFixed(1)}`;
  });

  return {
    path: `M ${pathPoints.join(" L ")} Z`,
    scaleInfo
  };
};

// Robust fetch wrapper with automatic retry and linear/exponential backoff
const fetchWithRetry = async (url, options = {}, retries = 3, backoff = 1000) => {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      if ((res.status === 429 || res.status >= 500) && retries > 0) {
        const delay = backoff * (4 - retries);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithRetry(url, options, retries - 1, backoff);
      }
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    return res;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw err;
    }
    if (retries > 0) {
      const delay = backoff * (4 - retries);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, backoff);
    }
    throw err;
  }
};

function App() {
  // Session lists and selections
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [grandPrixList, setGrandPrixList] = useState([]);
  const [selectedMeetingKey, setSelectedMeetingKey] = useState("");
  const [selectedSessionKey, setSelectedSessionKey] = useState("");
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionLaps, setSessionLaps] = useState([]);

  // F1 Data
  const [drivers, setDrivers] = useState({});
  const [trackPath, setTrackPath] = useState("");
  const [scaleInfo, setScaleInfo] = useState(null);
  const [positionHistory, setPositionHistory] = useState([]);

  // Playback Control States
  const [playbackTime, setPlaybackTime] = useState(null);
  const [sessionStart, setSessionStart] = useState(null);
  const [sessionEnd, setSessionEnd] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(10); // 10x default speed
  const [loadingMessage, setLoadingMessage] = useState("Loading F1 Live Data...");
  const [isLoadingTrack, setIsLoadingTrack] = useState(false);
  const [isLoadingBuffer, setIsLoadingBuffer] = useState(false);

  // Active Positions & Telemetry HUD
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [currentTelemetry, setCurrentTelemetry] = useState(null);
  const [locationBuffer, setLocationBuffer] = useState([]);
  const [bufferRange, setBufferRange] = useState(null);

  // Telemetry buffer for selected driver
  const [telemetryBuffer, setTelemetryBuffer] = useState([]);
  const [telemetryRange, setTelemetryRange] = useState(null);

  // Refs for background control & stale fetch cancellations
  const locationAbortControllerRef = useRef(null);
  const telemetryAbortControllerRef = useRef(null);
  const lastLocationFetchTimeRef = useRef(0);
  const lastTelemetryFetchTimeRef = useRef(0);

  // --- Fetch Sessions on Mount / Year Change ---
  useEffect(() => {
    Promise.resolve().then(() => {
      setLoadingMessage(`Fetching ${selectedYear} F1 Calendar...`);
    });
    fetchWithRetry(`https://api.openf1.org/v1/sessions?year=${selectedYear}`)
      .then(res => res.json())
      .then(data => {
        if (!data || !Array.isArray(data) || data.length === 0) {
          setLoadingMessage(`Unable to load F1 sessions for ${selectedYear} from API.`);
          return;
        }

        setIsOfflineMode(false);

        // Group by GP (meeting_key)
        const gpMap = {};
        data.forEach(s => {
          if (!s.meeting_key || s.is_cancelled) return;
          const key = s.meeting_key;
          if (!gpMap[key]) {
            // Determine if this session is a pre-season test
            const isTesting = s.session_name?.toLowerCase().includes("day") || 
                              s.session_name?.toLowerCase().includes("test") ||
                              s.session_type?.toLowerCase().includes("test");
            
            const officialGPName = CIRCUIT_GP_NAMES[s.circuit_short_name] || s.circuit_short_name || "Grand Prix";
            const gpLabel = isTesting ? `Pre-Season Testing (${s.location || s.circuit_short_name})` : officialGPName;

            gpMap[key] = {
              meeting_key: key,
              gpLabel: gpLabel,
              location: s.location || s.circuit_short_name,
              circuit_name: s.circuit_short_name,
              country: s.country_name,
              country_code: s.country_code,
              sessions: []
            };
          }
          gpMap[key].sessions.push(s);
        });

        // Convert to sorted array (chronological by first session date)
        const list = Object.values(gpMap).sort((a, b) => {
          const aDate = new Date(a.sessions[0]?.date_start || 0);
          const bDate = new Date(b.sessions[0]?.date_start || 0);
          return bDate - aDate; // Show latest Grand Prix first
        });

        setGrandPrixList(list);

        // Auto-select GP and session closest to "now"
        let bestSession = null;
        let bestGP = null;
        let minTimeDiff = Infinity;
        const nowMs = new Date().getTime();

        list.forEach(gp => {
          gp.sessions.forEach(s => {
            const startMs = new Date(s.date_start).getTime();
            const endMs = s.date_end ? new Date(s.date_end).getTime() : startMs + 2 * 60 * 60 * 1000;
            
            const diff = (nowMs >= startMs && nowMs <= endMs) ? 0 : Math.min(Math.abs(nowMs - startMs), Math.abs(nowMs - endMs));

            if (diff < minTimeDiff) {
              minTimeDiff = diff;
              bestSession = s;
              bestGP = gp;
            }
          });
        });

        if (bestGP && bestSession) {
          setSelectedMeetingKey(bestGP.meeting_key.toString());
          setSelectedSessionKey(bestSession.session_key.toString());
          setSelectedSession(bestSession);
        } else if (list.length > 0) {
          const latestGP = list[0];
          setSelectedMeetingKey(latestGP.meeting_key.toString());

          // Find Race session or default to the last session
          const raceSession = latestGP.sessions.find(s => s.session_name === "Race" || s.session_type === "Race") || latestGP.sessions[latestGP.sessions.length - 1];
          if (raceSession) {
            setSelectedSessionKey(raceSession.session_key.toString());
            setSelectedSession(raceSession);
          }
        }
      })
      .catch(err => {
        console.error("Error loading sessions, switching to offline/demo mode:", err);
        setIsOfflineMode(true);
        setGrandPrixList(FALLBACK_GPS);
        const latestGP = FALLBACK_GPS[0];
        setSelectedMeetingKey(latestGP.meeting_key.toString());
        const raceSession = latestGP.sessions.find(s => s.session_name === "Race" || s.session_type === "Race") || latestGP.sessions[latestGP.sessions.length - 1];
        if (raceSession) {
          setSelectedSessionKey(raceSession.session_key.toString());
          setSelectedSession(raceSession);
        }
        setLoadingMessage("");
      });
  }, [selectedYear]);

  // --- Handle GP Select ---
  const handleGPChange = (meetingKey) => {
    setSelectedMeetingKey(meetingKey);
    const gp = grandPrixList.find(g => g.meeting_key.toString() === meetingKey);
    if (gp && gp.sessions.length > 0) {
      let bestSession = null;
      let minTimeDiff = Infinity;
      const nowMs = Date.now();

      gp.sessions.forEach(s => {
        const startMs = new Date(s.date_start).getTime();
        const endMs = s.date_end ? new Date(s.date_end).getTime() : startMs + 2 * 60 * 60 * 1000;
        const diff = (nowMs >= startMs && nowMs <= endMs) ? 0 : Math.min(Math.abs(nowMs - startMs), Math.abs(nowMs - endMs));
        if (diff < minTimeDiff) {
          minTimeDiff = diff;
          bestSession = s;
        }
      });

      // If the closest session is within 3 days (meaning it's the active GP weekend), auto-select it.
      // Otherwise, default to the priority list (Race -> Sprint -> Qualifying -> Practice)
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
      if (bestSession && minTimeDiff < threeDaysMs) {
        setSelectedSessionKey(bestSession.session_key.toString());
        setSelectedSession(bestSession);
      } else {
        const sorted = [...gp.sessions].sort((a, b) => {
          const order = { "Race": 1, "Sprint": 2, "Qualifying": 3, "Practice": 4 };
          const aVal = order[a.session_name] || order[a.session_type] || 5;
          const bVal = order[b.session_name] || order[b.session_type] || 5;
          return aVal - bVal;
        });
        const primarySession = sorted[0];
        setSelectedSessionKey(primarySession.session_key.toString());
        setSelectedSession(primarySession);
      }
    }
  };

  // --- Handle Session Select ---
  const handleSessionChange = (sessionKey) => {
    setSelectedSessionKey(sessionKey);
    const gp = grandPrixList.find(g => g.meeting_key.toString() === selectedMeetingKey);
    if (gp) {
      const s = gp.sessions.find(x => x.session_key.toString() === sessionKey);
      if (s) setSelectedSession(s);
    }
  };

  // --- Fetch Session Data (Drivers, Track, Position) ---
  useEffect(() => {
    if (!selectedSession) return;

    if (isOfflineMode) {
      Promise.resolve().then(() => {
        setIsPlaying(false);
        setLoadingMessage("");
        setIsLoadingTrack(true);
        setDrivers(FALLBACK_DRIVERS);
        setSelectedDriver(1);
        
        const fallbackTrack = staticTracks[selectedSession.circuit_short_name];
        if (fallbackTrack) {
          setTrackPath(fallbackTrack.path);
          setScaleInfo(fallbackTrack.scaleInfo);
        } else {
          setTrackPath("M150,150 C250,50 450,50 450,200 C450,350 550,450 450,550 C350,550 150,550 150,400 C150,250 50,250 150,150 Z");
          setScaleInfo({ minX: -5000, maxX: 5000, minY: -5000, maxY: 5000, scale: 0.05, dx: 150, dy: 150 });
        }

        const start = new Date(selectedSession.date_start);
        const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
        setSessionStart(start);
        setSessionEnd(end);
        setPlaybackTime(start);
        setIsLoadingTrack(false);
      });
      return;
    }

    Promise.resolve().then(() => {
      setIsPlaying(false);
      setLoadingMessage(`Loading data for GP weekend in ${selectedSession.location}...`);
      setIsLoadingTrack(true);
      setTrackPath("");
      setScaleInfo(null);
      setDrivers({});
      setLocationBuffer([]);
      setBufferRange(null);
      setTelemetryBuffer([]);
      setTelemetryRange(null);
      setCurrentTelemetry(null);
      setSessionLaps([]);
      setIsLoadingBuffer(false);
      // Reset fetch cooldowns for the new session
      lastLocationFetchTimeRef.current = 0;
      lastTelemetryFetchTimeRef.current = 0;
    });

    const sessionKey = selectedSession.session_key;

    // 1. Fetch Drivers
    fetchWithRetry(`https://api.openf1.org/v1/drivers?session_key=${sessionKey}`)
      .then(res => res.json())
      .then(driversData => {
        if (!Array.isArray(driversData)) {
          throw new Error("Drivers data is not an array");
        }

        const driverMap = {};
        driversData.forEach(d => {
          driverMap[d.driver_number] = {
            number: d.driver_number,
            name: d.name_acronym || d.broadcast_name || "DRV",
            fullName: d.full_name,
            team: d.team_name || "Independent",
            color: d.team_colour ? `#${d.team_colour}` : "#FFFFFF",
            headshot: d.headshot_url || "https://media.formula1.com/d_driver_fallback_image.png"
          };
        });

        setDrivers(driverMap);

        // Default selected driver for Telemetry HUD
        if (driversData.length > 0) {
          setSelectedDriver(driversData[0].driver_number);
        }

        // 2. Fetch Position History & Laps for Leaderboard and pass driversData forward
        return Promise.all([
          fetchWithRetry(`https://api.openf1.org/v1/position?session_key=${sessionKey}`).then(r => r.json()).catch(() => []),
          fetchWithRetry(`https://api.openf1.org/v1/laps?session_key=${sessionKey}`).then(r => r.json()).catch(() => []),
          driversData
        ]);
      })
      .then(([positionsData, lapsDataAll, driversData]) => {
        // Pre-parse dates to improve 60 FPS render performance
        const processedPositions = (positionsData || []).map(h => ({
          ...h,
          timeMs: h.date ? new Date(h.date).getTime() : 0
        }));
        const processedLaps = (lapsDataAll || []).map(l => ({
          ...l,
          endTimeMs: l.date_start && l.lap_duration ? new Date(l.date_start).getTime() + l.lap_duration * 1000 : 0
        }));

        setPositionHistory(processedPositions);
        setSessionLaps(processedLaps);

        // Set session time bounds
        const start = new Date(selectedSession.date_start);
        const end = selectedSession.date_end ? new Date(selectedSession.date_end) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
        
        setSessionStart(start);
        setSessionEnd(end);
        setPlaybackTime(start);

        // 3. Generate Track Path using first driver's completed lap
        const driverNumbers = Array.isArray(driversData) && driversData.length > 0 
          ? driversData.map(d => d.driver_number) 
          : [1, 3, 16, 44, 63, 81];
        
        const trackDriver = driverNumbers[0] || 1;
        return fetchWithRetry(`https://api.openf1.org/v1/laps?session_key=${sessionKey}&driver_number=${trackDriver}`)
          .then(r => r.json());
      })
      .then(lapsData => {
        if (!Array.isArray(lapsData) || lapsData.length === 0) {
          throw new Error("Laps data is empty or invalid");
        }

        // Find a representative completed lap (e.g. Lap 2 or 3 is usually good)
        const validLap = lapsData.find(l => l.lap_duration && l.date_start && !l.is_pit_out_lap && l.lap_number > 1) 
          || lapsData.find(l => l.lap_duration && l.date_start)
          || { date_start: selectedSession.date_start, lap_duration: 80 }; // fallback

        const startLapStr = validLap.date_start;
        const durationSec = validLap.lap_duration;
        const endLapStr = new Date(new Date(startLapStr).getTime() + durationSec * 1000).toISOString();

        // Fetch location details for this lap
        const trackDriver = lapsData[0]?.driver_number || 1;
        return fetchWithRetry(`https://api.openf1.org/v1/location?session_key=${sessionKey}&driver_number=${trackDriver}&date>=${startLapStr}&date<=${endLapStr}`)
          .then(r => r.json());
      })
      .then(locationData => {
        if (!Array.isArray(locationData) || locationData.length === 0) {
          throw new Error("No telemetry locations found for track reconstruction");
        }

        // Process coordinates to scale to our SVG viewport
        const { path, scaleInfo } = processCoordinates(locationData, 600, 600, 40);
        setTrackPath(path);
        setScaleInfo(scaleInfo);
        setIsLoadingTrack(false);
        setLoadingMessage("");
      })
      .catch(err => {
        console.error("Error setting up session data, switching to offline/demo mode:", err);
        setIsOfflineMode(true);
        // Fallback layout from database if coordinate loading fails
        const fallbackTrack = staticTracks[selectedSession?.circuit_short_name];
        if (fallbackTrack) {
          setTrackPath(fallbackTrack.path);
          setScaleInfo(fallbackTrack.scaleInfo);
        } else {
          // Spielberg-like mock fallback if not in database
          setTrackPath("M150,150 C250,50 450,50 450,200 C450,350 550,450 450,550 C350,550 150,550 150,400 C150,250 50,250 150,150 Z");
          setScaleInfo({ minX: -5000, maxX: 5000, minY: -5000, maxY: 5000, scale: 0.05, dx: 150, dy: 150 });
        }
        setIsLoadingTrack(false);
        setLoadingMessage("");
      });
  }, [selectedSession, isOfflineMode]);



  // --- Playback Timer Effect (60 FPS requestAnimationFrame) ---
  useEffect(() => {
    if (!isPlaying || !playbackTime || !sessionEnd) return;

    let lastTime = performance.now();
    let animationFrameId;

    const tick = (now) => {
      const deltaMs = now - lastTime;
      lastTime = now;

      setPlaybackTime(prev => {
        if (!prev) return prev;
        const next = new Date(prev.getTime() + (deltaMs * playbackSpeed));
        
        // If session is live, cap playbackTime to current time (minus 15s API latency buffer)
        const isLive = !selectedSession?.date_end || new Date(selectedSession.date_end) > new Date();
        const maxTime = isLive ? new Date(Date.now() - 15000) : sessionEnd;

        if (next >= maxTime) {
          if (!isLive) {
            setIsPlaying(false);
            return maxTime;
          }
          return maxTime;
        }
        return next;
      });

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, playbackSpeed, sessionEnd, selectedSession]);

  // --- Streaming & Buffer Location Data ---
  useEffect(() => {
    if (isOfflineMode) return;
    if (!selectedSession || !playbackTime || !sessionStart || !sessionEnd) return;

    const time = new Date(playbackTime);
    
    // Check if we need to fetch a new buffer chunk.
    // If the buffer already covers up to the end of the session, we don't need to fetch.
    const isBufferAtSessionEnd = bufferRange && new Date(bufferRange.end).getTime() >= sessionEnd.getTime() - 1000;
    const needsFetch = !bufferRange || 
      time < new Date(bufferRange.start) || 
      (time > new Date(new Date(bufferRange.end).getTime() - 15000) && !isBufferAtSessionEnd);

    if (needsFetch) {
      const now = Date.now();
      if (now - lastLocationFetchTimeRef.current < 5000) {
        // Cooldown active to prevent API rate-limiting spam on repeated/failed requests
        return;
      }
      lastLocationFetchTimeRef.current = now;

      if (locationAbortControllerRef.current) {
        locationAbortControllerRef.current.abort();
      }

      const controller = new AbortController();
      locationAbortControllerRef.current = controller;

      Promise.resolve().then(() => {
        setIsLoadingBuffer(true);
      });

      // Scale chunk size with playback speed to prevent rapid requests at high speeds
      const bufferDurationMs = Math.max(120000, playbackSpeed * 10000); 
      
      const isLive = !selectedSession?.date_end || new Date(selectedSession.date_end) > new Date();
      const effectiveEndMs = isLive ? Date.now() : sessionEnd.getTime();

      let fetchStartMs = time.getTime();
      let fetchEndMs = fetchStartMs + bufferDurationMs;

      // If fetchEndMs is beyond effectiveEndMs, shift the window backwards to cover the available data
      if (fetchEndMs > effectiveEndMs) {
        fetchEndMs = effectiveEndMs;
        fetchStartMs = Math.max(sessionStart.getTime(), fetchEndMs - bufferDurationMs);
      }

      const fetchStart = new Date(fetchStartMs).toISOString();
      const fetchEnd = new Date(fetchEndMs).toISOString();

      fetchWithRetry(`https://api.openf1.org/v1/location?session_key=${selectedSession.session_key}&date>=${fetchStart}&date<=${fetchEnd}`, { signal: controller.signal })
        .then(res => res.json())
        .then(data => {
          setLocationBuffer(data || []);
          setBufferRange({ start: fetchStart, end: fetchEnd });
          if (locationAbortControllerRef.current === controller) {
            locationAbortControllerRef.current = null;
            setIsLoadingBuffer(false);
          }
        })
        .catch(err => {
          if (err.name !== 'AbortError') {
            console.error("Error fetching location buffer, switching to offline/demo mode:", err);
            setIsOfflineMode(true);
            if (locationAbortControllerRef.current === controller) {
              locationAbortControllerRef.current = null;
              setIsLoadingBuffer(false);
            }
          }
        });
    }
  }, [playbackTime, selectedSession, playbackSpeed, bufferRange, isOfflineMode, sessionStart, sessionEnd]);

  // --- Telemetry Buffer for HUD ---
  useEffect(() => {
    if (isOfflineMode) return;
    if (!selectedSession || !selectedDriver || !playbackTime || !sessionStart || !sessionEnd) return;

    const time = new Date(playbackTime);
    
    // Check if the telemetry buffer already covers up to the end of the session
    const isTelemetryAtSessionEnd = telemetryRange && new Date(telemetryRange.end).getTime() >= sessionEnd.getTime() - 1000;
    const needsFetch = !telemetryRange || 
      telemetryRange.driver !== selectedDriver ||
      time < new Date(telemetryRange.start) || 
      (time > new Date(new Date(telemetryRange.end).getTime() - 5000) && !isTelemetryAtSessionEnd);

    if (needsFetch) {
      const now = Date.now();
      if (now - lastTelemetryFetchTimeRef.current < 5000) {
        // Cooldown active to prevent API rate-limiting spam on repeated/failed requests
        return;
      }
      lastTelemetryFetchTimeRef.current = now;

      if (telemetryAbortControllerRef.current) {
        telemetryAbortControllerRef.current.abort();
      }

      const controller = new AbortController();
      telemetryAbortControllerRef.current = controller;

      const bufferDurationMs = Math.max(60000, playbackSpeed * 5000);
      
      const isLive = !selectedSession?.date_end || new Date(selectedSession.date_end) > new Date();
      const effectiveEndMs = isLive ? Date.now() : sessionEnd.getTime();

      let fetchStartMs = time.getTime();
      let fetchEndMs = fetchStartMs + bufferDurationMs;

      // If fetchEndMs is beyond effectiveEndMs, shift the window backwards to cover the available data
      if (fetchEndMs > effectiveEndMs) {
        fetchEndMs = effectiveEndMs;
        fetchStartMs = Math.max(sessionStart.getTime(), fetchEndMs - bufferDurationMs);
      }

      const fetchStart = new Date(fetchStartMs).toISOString();
      const fetchEnd = new Date(fetchEndMs).toISOString();

      fetchWithRetry(`https://api.openf1.org/v1/car_data?session_key=${selectedSession.session_key}&driver_number=${selectedDriver}&date>=${fetchStart}&date<=${fetchEnd}`, { signal: controller.signal })
        .then(res => res.json())
        .then(data => {
          const processedData = (data || []).map(rec => ({
            ...rec,
            timeMs: rec.date ? new Date(rec.date).getTime() : 0
          }));
          setTelemetryBuffer(processedData);
          setTelemetryRange({ start: fetchStart, end: fetchEnd, driver: selectedDriver });
          if (telemetryAbortControllerRef.current === controller) {
            telemetryAbortControllerRef.current = null;
          }
        })
        .catch(err => {
          if (err.name !== 'AbortError') {
            console.error("Error fetching telemetry buffer, switching to offline/demo mode:", err);
            setIsOfflineMode(true);
            if (telemetryAbortControllerRef.current === controller) {
              telemetryAbortControllerRef.current = null;
            }
          }
        });
    }
  }, [playbackTime, selectedSession, selectedDriver, playbackSpeed, telemetryRange, isOfflineMode, sessionStart, sessionEnd]);

  // --- Extract Current Car Telemetry on Tick ---
  useEffect(() => {
    let active = true;
    if (isOfflineMode) {
      if (!playbackTime || !sessionStart || !selectedDriver) return;
      const elapsedSec = (playbackTime.getTime() - sessionStart.getTime()) / 1000;
      
      const drvs = Object.values(drivers);
      const idx = drvs.findIndex(d => d.number === selectedDriver);
      const lapTime = 85 + (idx >= 0 ? idx : 0) * 1.5;
      const progress = (elapsedSec / lapTime) % 1.0;

      const speedPhase = Math.sin(progress * Math.PI * 8);
      const speed = Math.floor(180 + 130 * speedPhase + Math.random() * 5);
      const rpm = Math.floor(6000 + 6000 * ((speed % 60) / 60));
      const gear = Math.max(2, Math.min(8, Math.floor(speed / 45)));
      const throttle = speedPhase > -0.2 ? Math.floor(60 + 40 * speedPhase) : 0;
      const brake = speedPhase < -0.4 ? Math.floor(-100 * speedPhase) : 0;
      const drs = speed > 290 ? 9 : 0;

      Promise.resolve().then(() => {
        if (active) {
          setCurrentTelemetry({
            speed,
            rpm,
            n_gear: gear,
            throttle,
            brake,
            drs
          });
        }
      });
      return () => {
        active = false;
      };
    }

    if (!playbackTime || telemetryBuffer.length === 0) {
      Promise.resolve().then(() => {
        if (active) setCurrentTelemetry(null);
      });
      return;
    }

    const playTimeMs = playbackTime.getTime();
    let closestRecord = null;
    let minDiff = Infinity;
    let idx = -1;

    // Binary search for the closest telemetry record in O(log N)
    let low = 0;
    let high = telemetryBuffer.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const diff = Math.abs(telemetryBuffer[mid].timeMs - playTimeMs);
      if (diff < minDiff) {
        minDiff = diff;
        closestRecord = telemetryBuffer[mid];
        idx = mid;
      }
      if (telemetryBuffer[mid].timeMs < playTimeMs) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    // Check adjacent elements just in case to find absolute closest
    if (idx !== -1) {
      for (let i = Math.max(0, idx - 2); i <= Math.min(telemetryBuffer.length - 1, idx + 2); i++) {
        const diff = Math.abs(telemetryBuffer[i].timeMs - playTimeMs);
        if (diff < minDiff) {
          minDiff = diff;
          closestRecord = telemetryBuffer[i];
        }
      }
    }

    Promise.resolve().then(() => {
      if (active) {
        // Only use if within reasonable window (e.g. 30 seconds)
        if (minDiff < 30000) {
          setCurrentTelemetry(closestRecord);
        } else {
          setCurrentTelemetry(null);
        }
      }
    });

    return () => {
      active = false;
    };
  }, [playbackTime, telemetryBuffer, isOfflineMode, sessionStart, selectedDriver, drivers]);

  // --- Compute Live Standings (Leaderboard) ---
  const getLiveLeaderboard = () => {
    try {
      if (!playbackTime || !drivers || Object.keys(drivers).length === 0) return [];

      if (isOfflineMode) {
        if (!sessionStart) return [];
        const elapsedSec = (playbackTime.getTime() - sessionStart.getTime()) / 1000;
        
        const standings = Object.values(drivers).map((d, idx) => {
          const lapTime = 85 + idx * 1.5;
          const totalLaps = Math.floor(elapsedSec / lapTime);
          const progress = (elapsedSec / lapTime) % 1.0;
          const score = totalLaps + progress;
          
          return {
            ...d,
            positionScore: score,
            bestLap: lapTime,
            bestLapStr: formatLapTime(lapTime - Math.sin(idx) * 0.5),
            lapNumber: totalLaps + 1
          };
        });

        const sorted = standings.sort((a, b) => b.positionScore - a.positionScore);
        return sorted.map((d, index) => ({
          ...d,
          position: index + 1
        }));
      }

      const isQualifying = selectedSession?.session_name?.toLowerCase().includes("qualifying") || 
                           selectedSession?.session_type?.toLowerCase().includes("qualifying");

      const playTimeMs = playbackTime.getTime();

      if (isQualifying) {
        // --- Qualifying Standing Calculation (by Best Lap Time) ---
        const bestLaps = {};
        sessionLaps.forEach(l => {
          if (!l || !l.lap_duration || !l.endTimeMs) return;
          
          if (l.endTimeMs <= playTimeMs) {
            const existing = bestLaps[l.driver_number];
            if (!existing || l.lap_duration < existing.lap_duration) {
              bestLaps[l.driver_number] = l;
            }
          }
        });

        // Merge with driver metadata
        const standings = Object.values(drivers).map(d => {
          const lapRecord = bestLaps[d.number];
          return {
            ...d,
            bestLap: lapRecord ? lapRecord.lap_duration : null,
            bestLapStr: lapRecord ? formatLapTime(lapRecord.lap_duration) : "-",
            lapNumber: lapRecord ? lapRecord.lap_number : null,
            position: lapRecord ? lapRecord.lap_duration : 999999
          };
        });

        // Sort by lap time ascending (drivers with no time sorted by driver number)
        return standings.sort((a, b) => {
          if (a.position === b.position) {
            return a.number - b.number;
          }
          return a.position - b.position;
        });
      } else {
        // --- Race Standing Calculation (by positionHistory) ---
        if (!Array.isArray(positionHistory) || positionHistory.length === 0) {
          return Object.values(drivers).sort((a, b) => a.number - b.number);
        }

        const latestPositions = {};
        positionHistory.forEach(h => {
          if (h.timeMs <= playTimeMs) {
            const existing = latestPositions[h.driver_number];
            if (!existing || h.timeMs > existing.timeMs) {
              latestPositions[h.driver_number] = h;
            }
          }
        });

        const standings = Object.values(drivers).map(d => {
          const posRecord = latestPositions[d.number];
          const currentPos = posRecord ? posRecord.position : 99;
          return {
            ...d,
            position: currentPos
          };
        });

        return standings.sort((a, b) => a.position - b.position);
      }
    } catch (err) {
      console.error("Error computing leaderboard standings:", err);
      return Object.values(drivers).sort((a, b) => a.number - b.number);
    }
  };

  // --- Group locations by driver and pre-parse dates ---
  const locationsByDriver = useMemo(() => {
    const map = {};
    if (!Array.isArray(locationBuffer)) return map;
    locationBuffer.forEach(loc => {
      if (!loc || !loc.driver_number) return;
      if (!map[loc.driver_number]) {
        map[loc.driver_number] = [];
      }
      map[loc.driver_number].push({
        time: loc.date ? new Date(loc.date).getTime() : 0,
        x: loc.x,
        y: loc.y
      });
    });
    // Sort each driver's locations by time ascending
    Object.keys(map).forEach(num => {
      map[num].sort((a, b) => a.time - b.time);
    });
    return map;
  }, [locationBuffer]);

  // --- Compute Active Driver Coordinates on Track (with Linear Interpolation) ---
  const getActiveCoordinates = () => {
    try {
      if (isOfflineMode) {
        const pathEl = document.getElementById("track-path-main");
        if (!pathEl || !playbackTime || !sessionStart) return [];

        const totalLength = pathEl.getTotalLength();
        const elapsedSec = (playbackTime.getTime() - sessionStart.getTime()) / 1000;

        return Object.values(drivers).map((d, idx) => {
          const lapTime = 85 + idx * 1.5;
          const progress = (elapsedSec / lapTime) % 1.0;
          const dist = progress * totalLength;
          
          try {
            const point = pathEl.getPointAtLength(dist);
            return {
              driverNumber: d.number,
              acronym: d.name,
              color: d.color,
              x: point.x,
              y: point.y
            };
          } catch {
            return null;
          }
        }).filter(Boolean);
      }

      if (!playbackTime || Object.keys(locationsByDriver).length === 0 || !scaleInfo) return [];

      const playTimeMs = playbackTime.getTime();

      return Object.values(drivers).map(d => {
        const locs = locationsByDriver[d.number];
        if (!locs || locs.length === 0) return null;

        // Binary search to find the bounding samples
        let p1 = null;
        let p2 = null;

        let low = 0;
        let high = locs.length - 1;
        let idx = -1;

        while (low <= high) {
          const mid = Math.floor((low + high) / 2);
          if (locs[mid].time <= playTimeMs) {
            idx = mid;
            low = mid + 1;
          } else {
            high = mid - 1;
          }
        }

        if (idx !== -1) {
          p1 = locs[idx];
          if (idx + 1 < locs.length) {
            p2 = locs[idx + 1];
          }
        } else {
          // Playback time is before the first sample in the buffer
          p2 = locs[0];
        }

        let x, y;
        if (p1 && p2) {
          const denom = p2.time - p1.time;
          if (denom === 0) {
            x = p1.x;
            y = p1.y;
          } else {
            const ratio = (playTimeMs - p1.time) / denom;
            x = p1.x + (p2.x - p1.x) * ratio;
            y = p1.y + (p2.y - p1.y) * ratio;
          }
        } else if (p1) {
          // Only have point before (playbackTime past the last sample)
          x = p1.x;
          y = p1.y;
        } else if (p2) {
          // Only have point after
          x = p2.x;
          y = p2.y;
        } else {
          return null;
        }

        // Project onto screen dimensions
        const sx = scaleInfo.dx + (x - scaleInfo.minX) * scaleInfo.scale;
        const sy = scaleInfo.dy + (scaleInfo.maxY - y) * scaleInfo.scale;

        return {
          driverNumber: d.number,
          acronym: d.name,
          color: d.color,
          x: sx,
          y: sy
        };
      }).filter(Boolean);
    } catch (err) {
      console.error("Error computing active coordinates:", err);
      return [];
    }
  };

  const activeDots = getActiveCoordinates();
  const leaderboard = getLiveLeaderboard();

  // Helper formatting session duration slider
  const getSessionProgress = () => {
    if (!playbackTime || !sessionStart || !sessionEnd) return 0;
    const total = sessionEnd.getTime() - sessionStart.getTime();
    const current = playbackTime.getTime() - sessionStart.getTime();
    return total > 0 ? (current / total) * 100 : 0;
  };

  const handleSliderChange = (e) => {
    if (!sessionStart || !sessionEnd) return;
    const percentage = parseFloat(e.target.value);
    const total = sessionEnd.getTime() - sessionStart.getTime();
    const targetMs = sessionStart.getTime() + (total * (percentage / 100));
    
    // Clear buffers to force reload at new spot
    setLocationBuffer([]);
    setBufferRange(null);
    setTelemetryBuffer([]);
    setTelemetryRange(null);
    setIsLoadingBuffer(true);

    // Bypass/reset cooldowns for manual timeline navigation
    lastLocationFetchTimeRef.current = 0;
    lastTelemetryFetchTimeRef.current = 0;

    setPlaybackTime(new Date(targetMs));
  };

  // Time formatter (HH:MM:SS relative to start)
  const formatSessionTime = () => {
    if (!playbackTime || !sessionStart) return "00:00:00";
    const diffMs = playbackTime.getTime() - sessionStart.getTime();
    if (diffMs < 0) return "00:00:00";

    const hrs = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    const secs = Math.floor((diffMs % 60000) / 1000);

    const pad = (n) => n.toString().padStart(2, '0');
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  };

  // Selected driver detail
  const currentDriverDetails = drivers[selectedDriver];

  return (
    <>
      <nav>
        <div className="nav-brand">
          <img src={logo} alt="F1 Logo" />
          <h1 className="nav-title">F1 TRACKER</h1>
          {isOfflineMode && (
            <span className="demo-mode-badge" style={{
              backgroundColor: '#FF9800',
              color: '#000000',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: '800',
              marginLeft: '12px',
              letterSpacing: '0.5px'
            }}>
              DEMO MODE
            </span>
          )}
        </div>

        {grandPrixList.length > 0 && (
          <div className="nav-controls">
            <div className="select-container">
              <label>SEASON</label>
              <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                <option value="2026">2026</option>
                <option value="2025">2025</option>
                <option value="2024">2024</option>
                <option value="2023">2023</option>
              </select>
            </div>

            <div className="select-container">
              <label>GRAND PRIX</label>
              <select value={selectedMeetingKey} onChange={(e) => handleGPChange(e.target.value)}>
                {grandPrixList.map(g => (
                  <option key={g.meeting_key} value={g.meeting_key}>
                    {g.gpLabel}
                  </option>
                ))}
              </select>
            </div>

            <div className="select-container">
              <label>SESSION</label>
              <select value={selectedSessionKey} onChange={(e) => handleSessionChange(e.target.value)}>
                {selectedMeetingKey && grandPrixList
                  .find(g => g.meeting_key.toString() === selectedMeetingKey)
                  ?.sessions.map(s => (
                    <option key={s.session_key} value={s.session_key}>
                      {s.session_name}
                    </option>
                  ))
                }
              </select>
            </div>
          </div>
        )}
      </nav>

      {loadingMessage && (
        <div className="loading-screen">
          <div className="loader"></div>
          <p>{loadingMessage}</p>
        </div>
      )}

      <main className="dashboard-grid">
        {/* Left Column: Leaderboard */}
        <section className="leaderboard-card">
          <div className="panel-header">
            <h2>STANDINGS</h2>
            <div className="live-pill">
              <span className="live-dot"></span>
              {isPlaying ? "PLAYING" : "PAUSED"}
            </div>
          </div>

          <div className="leaderboard-table-container">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>POS</th>
                  <th>DRIVER</th>
                  {selectedSession?.session_name?.toLowerCase().includes("qualifying") || 
                   selectedSession?.session_type?.toLowerCase().includes("qualifying") ? (
                    <>
                      <th>BEST LAP</th>
                      <th style={{ textAlign: 'center' }}>LAP NO</th>
                    </>
                  ) : (
                    <th>TEAM</th>
                  )}
                  <th style={{ textAlign: 'right' }}>NO.</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((drv, idx) => (
                  <tr
                    key={drv.number}
                    className={`leaderboard-row ${selectedDriver === drv.number ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedDriver(drv.number);
                      setTelemetryBuffer([]);
                      setTelemetryRange(null);
                    }}
                  >
                    <td className="pos-col">{idx + 1}</td>
                    <td className="driver-col">
                      <span className="team-indicator" style={{ backgroundColor: drv.color }}></span>
                      <span className="driver-name">{drv.name}</span>
                    </td>
                    {selectedSession?.session_name?.toLowerCase().includes("qualifying") || 
                     selectedSession?.session_type?.toLowerCase().includes("qualifying") ? (
                      <>
                        <td className="laptime-col" style={{ fontFamily: 'var(--font-mono)', fontWeight: drv.bestLap ? '700' : '400' }}>
                          {drv.bestLapStr}
                        </td>
                        <td className="lapnum-col" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                          {drv.lapNumber || "-"}
                        </td>
                      </>
                    ) : (
                      <td className="team-col">{drv.team}</td>
                    )}
                    <td className="num-col" style={{ color: drv.color, textAlign: 'right' }}>#{drv.number}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Center Column: Interactive Track & Playback */}
        <section className="track-card">
          <div className="track-container">
            {isLoadingTrack ? (
              <div className="track-loader">
                <div className="loader"></div>
                <p>Generating track map from telemetry...</p>
              </div>
            ) : (
              <>
                <div className="track-map-wrapper">
                  <svg
                    className="track-svg"
                    viewBox="0 0 600 600"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    {/* Track base shape */}
                    {trackPath && (
                      <>
                        <path
                          d={trackPath}
                          className="track-path-bg"
                        />
                        <path
                          id="track-path-main"
                          d={trackPath}
                          className="track-path-fg"
                        />
                      </>
                    )}

                    {/* Active driver dots */}
                    {activeDots.map(dot => (
                      <g 
                        key={dot.driverNumber}
                        onClick={() => {
                          setSelectedDriver(dot.driverNumber);
                          setTelemetryBuffer([]);
                          setTelemetryRange(null);
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <circle
                          cx={dot.x}
                          cy={dot.y}
                          r={selectedDriver === dot.driverNumber ? "10" : "7"}
                          fill={dot.color}
                          className={`driver-dot-node ${selectedDriver === dot.driverNumber ? 'active-glow' : ''}`}
                        />
                        <text
                          x={dot.x}
                          y={dot.y - 12}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="10px"
                          fontWeight="800"
                          className="driver-dot-label"
                        >
                          {dot.acronym}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
                 {!isLoadingTrack && !isLoadingBuffer && activeDots.length === 0 && (
                   <div className="telemetry-warning-overlay">
                     <p>No telemetry data available for this session</p>
                     <span>Try selecting a completed session from 2024 or 2025 to view live telemetry playback.</span>
                   </div>
                 )}
              </>
            )}
          </div>

          {/* Timeline & Playback Controller */}
          <div className="playback-panel">
            <div className="timeline-row">
              <span className="elapsed-time">{formatSessionTime()}</span>
              <input
                type="range"
                className="timeline-slider"
                min="0"
                max="100"
                step="0.1"
                value={getSessionProgress()}
                onChange={handleSliderChange}
              />
              <span className="total-time">Race Session</span>
            </div>

            <div className="controls-row">
              <button 
                className={`btn-play ${isPlaying ? 'playing' : ''}`}
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? (
                  <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
                )}
                {isPlaying ? "PAUSE" : "PLAY"}
              </button>

              <div className="speed-selector">
                <span className="speed-label">SPEED:</span>
                {[1, 5, 15, 60, 120, 300].map(speed => (
                  <button
                    key={speed}
                    className={`btn-speed ${playbackSpeed === speed ? 'active' : ''}`}
                    onClick={() => setPlaybackSpeed(speed)}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Telemetry HUD */}
        <section className="hud-card">
          <div className="panel-header">
            <h2>TELEMETRY HUD</h2>
          </div>

          {currentDriverDetails ? (
            <div className="hud-content">
              {/* Driver ID card */}
              <div className="driver-id-card">
                <div className="driver-photo-container" style={{ borderColor: currentDriverDetails.color }}>
                  <img src={currentDriverDetails.headshot} alt={currentDriverDetails.fullName} />
                </div>
                <div className="driver-meta">
                  <div className="num-badge" style={{ backgroundColor: currentDriverDetails.color }}>
                    #{currentDriverDetails.number}
                  </div>
                  <h3>{currentDriverDetails.fullName}</h3>
                  <p>{currentDriverDetails.team}</p>
                </div>
              </div>

              {/* Live Gauges */}
              <div className="hud-gauges">
                {/* Circular Speed & RPM Gauge */}
                <div className="speedometer-container">
                  <svg className="speed-gauge" viewBox="0 0 200 200">
                    <circle cx="100" cy="100" r="85" className="gauge-track" />
                    <circle 
                      cx="100" 
                      cy="100" 
                      r="85" 
                      className="gauge-fill" 
                      strokeDasharray="534"
                      strokeDashoffset={534 - (534 * (currentTelemetry?.speed || 0)) / 360}
                      stroke={currentDriverDetails.color}
                    />
                  </svg>
                  <div className="speed-value">
                    <span className="num">{currentTelemetry?.speed || 0}</span>
                    <span className="unit">KM/H</span>
                  </div>
                </div>

                {/* RPM & Gear grid */}
                <div className="telemetry-grid">
                  <div className="tel-metric gear-metric">
                    <span className="label">GEAR</span>
                    <span className="value-gear">
                      {currentTelemetry ? (currentTelemetry.n_gear === 0 ? "N" : currentTelemetry.n_gear) : "-"}
                    </span>
                  </div>

                  <div className="tel-metric rpm-metric">
                    <span className="label">RPM</span>
                    <span className="value">{currentTelemetry?.rpm || 0}</span>
                  </div>

                  <div className="tel-metric drs-metric">
                    <span className="label">DRS</span>
                    <span className={`drs-badge ${
                      currentTelemetry?.drs >= 9 ? 'active' : 
                      currentTelemetry?.drs === 8 ? 'eligible' : 'closed'
                    }`}>
                      {currentTelemetry ? (
                        currentTelemetry.drs >= 9 ? "ACTIVE" : 
                        currentTelemetry.drs === 8 ? "DETECTED" : "CLOSED"
                      ) : "CLOSED"}
                    </span>
                  </div>
                </div>

                {/* Pedal inputs */}
                <div className="pedals-container">
                  <div className="pedal-row">
                    <div className="pedal-label">THROTTLE (GAS)</div>
                    <div className="pedal-bar-bg">
                      <div 
                        className="pedal-bar-fill throttle" 
                        style={{ width: `${currentTelemetry?.throttle || 0}%` }}
                      ></div>
                    </div>
                    <div className="pedal-value">{currentTelemetry?.throttle || 0}%</div>
                  </div>

                  <div className="pedal-row">
                    <div className="pedal-label">BRAKE PRESSURE</div>
                    <div className="pedal-bar-bg">
                      <div 
                        className="pedal-bar-fill brake" 
                        style={{ width: `${currentTelemetry?.brake > 0 ? (typeof currentTelemetry.brake === 'boolean' ? 100 : currentTelemetry.brake) : 0}%` }}
                      ></div>
                    </div>
                    <div className="pedal-value">
                      {currentTelemetry ? (
                        currentTelemetry.brake > 0 ? (typeof currentTelemetry.brake === 'boolean' ? '100%' : `${currentTelemetry.brake}%`) : '0%'
                      ) : '0%'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="hud-placeholder">
              <p>Select a driver dot on the map or row in standings to see real-time cockpit telemetry.</p>
            </div>
          )}
        </section>
      </main>
    </>
  )
}

export default App;