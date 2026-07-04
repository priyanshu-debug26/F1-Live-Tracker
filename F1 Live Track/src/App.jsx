import logo from './assets/logo.png';
import { useEffect, useState, useRef } from 'react';
import { staticTracks } from './assets/staticTracks.js';

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

function App() {
  // Session lists and selections
  const [selectedYear, setSelectedYear] = useState("2024");
  const [sessions, setSessions] = useState([]);
  const [grandPrixList, setGrandPrixList] = useState([]);
  const [selectedMeetingKey, setSelectedMeetingKey] = useState("");
  const [selectedSessionKey, setSelectedSessionKey] = useState("");
  const [selectedSession, setSelectedSession] = useState(null);

  // F1 Data
  const [drivers, setDrivers] = useState({});
  const [driversList, setDriversList] = useState([]);
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

  // Active Positions & Telemetry HUD
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [currentTelemetry, setCurrentTelemetry] = useState(null);
  const [locationBuffer, setLocationBuffer] = useState([]);
  const [bufferRange, setBufferRange] = useState(null);

  // Telemetry buffer for selected driver
  const [telemetryBuffer, setTelemetryBuffer] = useState([]);
  const [telemetryRange, setTelemetryRange] = useState(null);

  // Refs for background control
  const isFetchingBuffer = useRef(false);
  const isFetchingTelemetry = useRef(false);

  // --- Fetch Sessions on Mount / Year Change ---
  useEffect(() => {
    setLoadingMessage(`Fetching ${selectedYear} F1 Calendar...`);
    fetch(`https://api.openf1.org/v1/sessions?year=${selectedYear}`)
      .then(res => res.json())
      .then(data => {
        if (!data || !Array.isArray(data) || data.length === 0) {
          setLoadingMessage(`Unable to load F1 sessions for ${selectedYear} from API.`);
          return;
        }

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

        // Auto-select latest Grand Prix and its Race session
        if (list.length > 0) {
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
        console.error("Error loading sessions:", err);
        setLoadingMessage("Failed to connect to F1 API. Please refresh the page.");
      });
  }, [selectedYear]);

  // --- Handle GP Select ---
  const handleGPChange = (meetingKey) => {
    setSelectedMeetingKey(meetingKey);
    const gp = grandPrixList.find(g => g.meeting_key.toString() === meetingKey);
    if (gp && gp.sessions.length > 0) {
      // Prioritize Race -> Sprint -> Qualifying -> Practice
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

    setIsPlaying(false);
    setLoadingMessage(`Loading data for GP weekend in ${selectedSession.location}...`);
    setIsLoadingTrack(true);
    setTrackPath("");
    setScaleInfo(null);
    setDrivers({});
    setDriversList([]);
    setLocationBuffer([]);
    setBufferRange(null);
    setTelemetryBuffer([]);
    setTelemetryRange(null);
    setCurrentTelemetry(null);

    const sessionKey = selectedSession.session_key;

    // 1. Fetch Drivers
    fetch(`https://api.openf1.org/v1/drivers?session_key=${sessionKey}`)
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
        setDriversList(driversData);

        // Default selected driver for Telemetry HUD
        if (driversData.length > 0) {
          setSelectedDriver(driversData[0].driver_number);
        }

        // 2. Fetch Position History for Leaderboard and pass driversData forward
        return Promise.all([
          fetch(`https://api.openf1.org/v1/position?session_key=${sessionKey}`).then(r => r.json()),
          driversData
        ]);
      })
      .then(([positionsData, driversData]) => {
        setPositionHistory(Array.isArray(positionsData) ? positionsData : []);

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
        return fetch(`https://api.openf1.org/v1/laps?session_key=${sessionKey}&driver_number=${trackDriver}`)
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
        return fetch(`https://api.openf1.org/v1/location?session_key=${sessionKey}&driver_number=${trackDriver}&date>=${startLapStr}&date<=${endLapStr}`)
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
        console.error("Error setting up session data:", err);
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
  }, [selectedSession]);

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

  // --- Playback Timer Effect ---
  useEffect(() => {
    if (!isPlaying || !playbackTime || !sessionEnd) return;

    const interval = setInterval(() => {
      setPlaybackTime(prev => {
        const next = new Date(prev.getTime() + (100 * playbackSpeed));
        if (next >= sessionEnd) {
          setIsPlaying(false);
          return sessionEnd;
        }
        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, sessionEnd]);

  // --- Streaming & Buffer Location Data ---
  useEffect(() => {
    if (!selectedSession || !playbackTime) return;

    const time = new Date(playbackTime);
    
    // Check if we need to fetch a new buffer chunk
    const needsFetch = !bufferRange || 
      time < new Date(bufferRange.start) || 
      time > new Date(new Date(bufferRange.end).getTime() - 15000);

    if (needsFetch && !isFetchingBuffer.current) {
      isFetchingBuffer.current = true;
      const fetchStart = time.toISOString();
      // Scale chunk size with playback speed to prevent rapid requests at high speeds
      const bufferDurationMs = Math.max(120000, playbackSpeed * 10000); 
      const fetchEnd = new Date(time.getTime() + bufferDurationMs).toISOString();

      fetch(`https://api.openf1.org/v1/location?session_key=${selectedSession.session_key}&date>=${fetchStart}&date<=${fetchEnd}`)
        .then(res => res.json())
        .then(data => {
          setLocationBuffer(data || []);
          setBufferRange({ start: fetchStart, end: fetchEnd });
          isFetchingBuffer.current = false;
        })
        .catch(err => {
          console.error("Error fetching location buffer:", err);
          isFetchingBuffer.current = false;
        });
    }
  }, [playbackTime, selectedSession, playbackSpeed, bufferRange]);

  // --- Telemetry Buffer for HUD ---
  useEffect(() => {
    if (!selectedSession || !selectedDriver || !playbackTime) return;

    const time = new Date(playbackTime);
    
    const needsFetch = !telemetryRange || 
      time < new Date(telemetryRange.start) || 
      time > new Date(new Date(telemetryRange.end).getTime() - 5000);

    if (needsFetch && !isFetchingTelemetry.current) {
      isFetchingTelemetry.current = true;
      const fetchStart = time.toISOString();
      const bufferDurationMs = Math.max(60000, playbackSpeed * 5000);
      const fetchEnd = new Date(time.getTime() + bufferDurationMs).toISOString();

      fetch(`https://api.openf1.org/v1/car_data?session_key=${selectedSession.session_key}&driver_number=${selectedDriver}&date>=${fetchStart}&date<=${fetchEnd}`)
        .then(res => res.json())
        .then(data => {
          setTelemetryBuffer(data || []);
          setTelemetryRange({ start: fetchStart, end: fetchEnd });
          isFetchingTelemetry.current = false;
        })
        .catch(err => {
          console.error("Error fetching telemetry buffer:", err);
          isFetchingTelemetry.current = false;
        });
    }
  }, [playbackTime, selectedSession, selectedDriver, playbackSpeed, telemetryRange]);

  // --- Extract Current Car Telemetry on Tick ---
  useEffect(() => {
    if (!playbackTime || telemetryBuffer.length === 0) {
      setCurrentTelemetry(null);
      return;
    }

    const playTimeMs = playbackTime.getTime();
    // Find closest telemetry record
    let closestRecord = null;
    let minDiff = Infinity;

    for (let i = 0; i < telemetryBuffer.length; i++) {
      const rec = telemetryBuffer[i];
      const recTime = new Date(rec.date).getTime();
      const diff = Math.abs(recTime - playTimeMs);
      if (diff < minDiff) {
        minDiff = diff;
        closestRecord = rec;
      }
    }

    // Only use if within reasonable window (e.g. 5 seconds)
    if (minDiff < 5000) {
      setCurrentTelemetry(closestRecord);
    } else {
      setCurrentTelemetry(null);
    }
  }, [playbackTime, telemetryBuffer]);

  // --- Compute Live Standings (Leaderboard) ---
  const getLiveLeaderboard = () => {
    try {
      if (!playbackTime || !Array.isArray(positionHistory) || positionHistory.length === 0) {
        // Fallback: alphabetical/numerical order
        return Object.values(drivers).sort((a, b) => a.number - b.number);
      }

      const playTimeMs = playbackTime.getTime();
      
      // Find the latest position record for each driver
      const latestPositions = {};
      positionHistory.forEach(h => {
        if (!h || !h.date) return;
        const hTime = new Date(h.date).getTime();
        if (hTime <= playTimeMs) {
          const existing = latestPositions[h.driver_number];
          if (!existing || hTime > new Date(existing.date).getTime()) {
            latestPositions[h.driver_number] = h;
          }
        }
      });

      // Merge standings with driver metadata
      const standings = Object.values(drivers).map(d => {
        const posRecord = latestPositions[d.number];
        const currentPos = posRecord ? posRecord.position : 99; // default to back if unknown
        return {
          ...d,
          position: currentPos
        };
      });

      // Sort by position ascending
      return standings.sort((a, b) => a.position - b.position);
    } catch (err) {
      console.error("Error computing leaderboard standings:", err);
      return Object.values(drivers).sort((a, b) => a.number - b.number);
    }
  };

  // --- Compute Active Driver Coordinates on Track ---
  const getActiveCoordinates = () => {
    try {
      if (!playbackTime || !Array.isArray(locationBuffer) || locationBuffer.length === 0 || !scaleInfo) return [];

      const playTimeMs = playbackTime.getTime();
      const activeLocs = {};

      // Group locations and find closest sample before/near playbackTime
      locationBuffer.forEach(loc => {
        if (!loc || !loc.date) return;
        const locTime = new Date(loc.date).getTime();
        // Allow slightly future points (up to 1s) for smoother movement
        if (locTime <= playTimeMs + 500) {
          const existing = activeLocs[loc.driver_number];
          if (!existing || locTime > new Date(existing.date).getTime()) {
            activeLocs[loc.driver_number] = loc;
          }
        }
      });

      return Object.values(drivers).map(d => {
        const loc = activeLocs[d.number];
        if (!loc) return null;

        // Project onto screen dimensions
        const sx = scaleInfo.dx + (loc.x - scaleInfo.minX) * scaleInfo.scale;
        const sy = scaleInfo.dy + (scaleInfo.maxY - loc.y) * scaleInfo.scale;

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
          <h1 className="nav-title">F1 LIVE TRACKER</h1>
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
                  <th>TEAM</th>
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
                    <td className="team-col">{drv.team}</td>
                    <td className="num-col" style={{ color: drv.color }}>#{drv.number}</td>
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
                          style={{ transition: 'cx 0.3s ease-out, cy 0.3s ease-out' }}
                        />
                        <text
                          x={dot.x}
                          y={dot.y - 12}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="10px"
                          fontWeight="800"
                          className="driver-dot-label"
                          style={{ transition: 'x 0.3s ease-out, y 0.3s ease-out' }}
                        >
                          {dot.acronym}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
                {!isLoadingTrack && activeDots.length === 0 && (
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