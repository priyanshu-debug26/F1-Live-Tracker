export const FALLBACK_GPS = [
  {
    meeting_key: 1219,
    gpLabel: "Monaco Grand Prix (Demo Mode)",
    location: "Monte Carlo",
    circuit_name: "Monte Carlo",
    country: "Monaco",
    country_code: "MC",
    sessions: [
      { session_key: 9520, session_name: "Race", session_type: "Race", date_start: "2024-05-26T13:00:00Z", date_end: "2024-05-26T15:00:00Z", location: "Monte Carlo", circuit_short_name: "Monte Carlo" },
      { session_key: 9519, session_name: "Qualifying", session_type: "Qualifying", date_start: "2024-05-25T14:00:00Z", date_end: "2024-05-25T15:00:00Z", location: "Monte Carlo", circuit_short_name: "Monte Carlo" }
    ]
  },
  {
    meeting_key: 1205,
    gpLabel: "Bahrain Grand Prix (Demo Mode)",
    location: "Sakhir",
    circuit_name: "Sakhir",
    country: "Bahrain",
    country_code: "BH",
    sessions: [
      { session_key: 9480, session_name: "Race", session_type: "Race", date_start: "2024-03-02T15:00:00Z", date_end: "2024-03-02T17:00:00Z", location: "Sakhir", circuit_short_name: "Sakhir" }
    ]
  },
  {
    meeting_key: 1206,
    gpLabel: "Saudi Arabian Grand Prix (Demo Mode)",
    location: "Jeddah",
    circuit_name: "Jeddah",
    country: "Saudi Arabia",
    country_code: "SA",
    sessions: [
      { session_key: 9485, session_name: "Race", session_type: "Race", date_start: "2024-03-09T17:00:00Z", date_end: "2024-03-09T19:00:00Z", location: "Jeddah", circuit_short_name: "Jeddah" }
    ]
  },
  {
    meeting_key: 1222,
    gpLabel: "British Grand Prix (Demo Mode)",
    location: "Silverstone",
    circuit_name: "Silverstone",
    country: "United Kingdom",
    country_code: "GB",
    sessions: [
      { session_key: 9540, session_name: "Race", session_type: "Race", date_start: "2024-07-07T14:00:00Z", date_end: "2024-07-07T16:00:00Z", location: "Silverstone", circuit_short_name: "Silverstone" }
    ]
  },
  {
    meeting_key: 1228,
    gpLabel: "Italian Grand Prix (Demo Mode)",
    location: "Monza",
    circuit_name: "Monza",
    country: "Italy",
    country_code: "IT",
    sessions: [
      { session_key: 9580, session_name: "Race", session_type: "Race", date_start: "2024-09-01T13:00:00Z", date_end: "2024-09-01T15:00:00Z", location: "Monza", circuit_short_name: "Monza" }
    ]
  },
  {
    meeting_key: 1231,
    gpLabel: "Singapore Grand Prix (Demo Mode)",
    location: "Singapore",
    circuit_name: "Singapore",
    country: "Singapore",
    country_code: "SG",
    sessions: [
      { session_key: 9610, session_name: "Race", session_type: "Race", date_start: "2024-09-22T12:00:00Z", date_end: "2024-09-22T14:00:00Z", location: "Singapore", circuit_short_name: "Singapore" }
    ]
  },
  {
    meeting_key: 1235,
    gpLabel: "Abu Dhabi Grand Prix (Demo Mode)",
    location: "Yas Marina Circuit",
    circuit_name: "Yas Marina Circuit",
    country: "United Arab Emirates",
    country_code: "AE",
    sessions: [
      { session_key: 9650, session_name: "Race", session_type: "Race", date_start: "2024-12-08T13:00:00Z", date_end: "2024-12-08T15:00:00Z", location: "Yas Marina Circuit", circuit_short_name: "Yas Marina Circuit" }
    ]
  }
];

export const FALLBACK_DRIVERS = {
  1: { number: 1, name: "VER", fullName: "Max Verstappen", team: "Red Bull Racing", color: "#3671C6", headshot: "https://media.formula1.com/d_driver_fallback_image.png" },
  11: { number: 11, name: "PER", fullName: "Sergio Perez", team: "Red Bull Racing", color: "#3671C6", headshot: "https://media.formula1.com/d_driver_fallback_image.png" },
  44: { number: 44, name: "HAM", fullName: "Lewis Hamilton", team: "Mercedes", color: "#27F4D2", headshot: "https://media.formula1.com/d_driver_fallback_image.png" },
  63: { number: 63, name: "RUS", fullName: "George Russell", team: "Mercedes", color: "#27F4D2", headshot: "https://media.formula1.com/d_driver_fallback_image.png" },
  16: { number: 16, name: "LEC", fullName: "Charles Leclerc", team: "Ferrari", color: "#E80020", headshot: "https://media.formula1.com/d_driver_fallback_image.png" },
  55: { number: 55, name: "SAI", fullName: "Carlos Sainz", team: "Ferrari", color: "#E80020", headshot: "https://media.formula1.com/d_driver_fallback_image.png" },
  4: { number: 4, name: "NOR", fullName: "Lando Norris", team: "McLaren", color: "#FF8000", headshot: "https://media.formula1.com/d_driver_fallback_image.png" },
  81: { number: 81, name: "PIA", fullName: "Oscar Piastri", team: "McLaren", color: "#FF8000", headshot: "https://media.formula1.com/d_driver_fallback_image.png" },
  14: { number: 14, name: "ALO", fullName: "Fernando Alonso", team: "Aston Martin", color: "#229971", headshot: "https://media.formula1.com/d_driver_fallback_image.png" },
  18: { number: 18, name: "STR", fullName: "Lance Stroll", team: "Aston Martin", color: "#229971", headshot: "https://media.formula1.com/d_driver_fallback_image.png" },
  10: { number: 10, name: "GAS", fullName: "Pierre Gasly", team: "Alpine", color: "#0093CC", headshot: "https://media.formula1.com/d_driver_fallback_image.png" },
  31: { number: 31, name: "OCO", fullName: "Esteban Ocon", team: "Alpine", color: "#0093CC", headshot: "https://media.formula1.com/d_driver_fallback_image.png" },
  23: { number: 23, name: "ALB", fullName: "Alexander Albon", team: "Williams", color: "#37BEDD", headshot: "https://media.formula1.com/d_driver_fallback_image.png" },
  43: { number: 43, name: "COL", fullName: "Franco Colapinto", team: "Williams", color: "#37BEDD", headshot: "https://media.formula1.com/d_driver_fallback_image.png" },
  22: { number: 22, name: "TSU", fullName: "Yuki Tsunoda", team: "RB", color: "#6692FF", headshot: "https://media.formula1.com/d_driver_fallback_image.png" },
  30: { number: 30, name: "LAW", fullName: "Liam Lawson", team: "RB", color: "#6692FF", headshot: "https://media.formula1.com/d_driver_fallback_image.png" },
  77: { number: 77, name: "BOT", fullName: "Valtteri Bottas", team: "Kick Sauber", color: "#52E252", headshot: "https://media.formula1.com/d_driver_fallback_image.png" },
  24: { number: 24, name: "ZHO", fullName: "Zhou Guanyu", team: "Kick Sauber", color: "#52E252", headshot: "https://media.formula1.com/d_driver_fallback_image.png" },
  27: { number: 27, name: "HUL", fullName: "Nico Hulkenberg", team: "Haas", color: "#B6BABD", headshot: "https://media.formula1.com/d_driver_fallback_image.png" },
  20: { number: 20, name: "MAG", fullName: "Kevin Magnussen", team: "Haas", color: "#B6BABD", headshot: "https://media.formula1.com/d_driver_fallback_image.png" }
};
