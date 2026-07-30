# 🏎️ F1 Tracker

A modern, high-fidelity web application built with **React**, **Vite**, and **Vanilla CSS** that visualizes Formula 1 sessions using telemetry and positioning data sourced from the community-driven **OpenF1 API**. 

The app features an interactive SVG track map, live leaderboard standings, and a detailed Cockpit Telemetry HUD mimicking the steering wheel dials and inputs of a real F1 car.

---

## 🌟 Key Features

*   **Interactive Track Map**: Dynamically reconstructs any F1 circuit's layout using actual GPS coordinates and traces the live positions of all 20 drivers. Clicking any driver dot selects them for telemetry tracking.
*   **Standings & Leaderboard**: Chronologically sorts and displays live race standings (or best qualifying times) on a sleek sidebar panel. 
*   **Cockpit Telemetry HUD**: Shows live telemetry data for the selected driver:
    *   **Circular speedometer** gauge (KM/H)
    *   **Gear indicator** (1-8, N) and **RPM dial**
    *   **DRS activation status** (Closed, Eligible, Active)
    *   **Pedal input telemetry** (Linear graphs for throttle and brake pressure)
*   **Seamless Offline/Demo Mode**: Automatically falls back to a simulated demo mode if the OpenF1 API is offline or rate-limited. This generates fluid mock movements and inputs for all drivers.
*   **Fully Responsive**: Optimizes grids, columns, navbars, and SVG rendering dynamically across mobile devices, tablets, and wide-screen monitors.

---

## 🛠️ Technology Stack

*   **Vite**: Next-generation frontend tooling for extremely fast development and bundling.
*   **React 19**: Modern component architecture, hooks (`useMemo`, `useEffect`, `useRef`), and state management.
*   **Vanilla CSS**: Premium dark-mode styling utilizing CSS variables, responsive grids, custom animations, and glassmorphic card overlays.
*   **OpenF1 API**: Integrates with the free, community-built API which archives telemetry from the official F1 live timing feeds.

---

## 📈 OpenF1 API Access & Limitations

This application fetches live timing data from the [OpenF1 API](https://openf1.org). Please keep the following access constraints in mind:

1.  **Supported Seasons**: OpenF1 archives telemetry data starting from the **2023 season onwards**. The app limits season selection (`2023` to `2026`) accordingly.
2.  **Live/Real-Time Races**:
    *   **Paid Sponsor Tier**: Full-throughput real-time streaming and high rate-limit endpoints require a GitHub sponsorship/account with OpenF1.
    *   **Free Tier Rate Limits**: The free public API is heavily rate-limited (3 req/s, 30 req/min). During active GP weekends, high traffic may cause the public API to block requests (`HTTP 429` errors).
    *   **App Integration**: The app features a robust fetch wrapper with automatic retries and exponential backoff to handle rate limits. If the API block persists, the app seamlessly falls back to **Demo Mode** so the dashboard remains fully functional.

---

## 🚀 Local Development Setup

To run the project locally, follow these steps:

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (v18+ recommended).

### 1. Install Dependencies
Navigate to the project folder and run:
```bash
npm install
```

### 2. Start the Development Server
Launch the local dev server using:
```bash
npm run dev
```
Open your browser and navigate to the address shown in your terminal (typically `http://localhost:5173`).

### 3. Build for Production
To bundle the project for production, run:
```bash
npm run build
```
The compiled files will be output to the `dist/` directory, ready to be deployed to any static web hosting provider.

---

## 📝 License
This project is an independent developer concept and is not affiliated with, sponsored by, or endorsed by Formula 1, the FIA, or Formula One Management. All F1 logos and driver assets are properties of their respective owners.