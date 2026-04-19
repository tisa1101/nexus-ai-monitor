# NEXUS.AI — Process Monitor

A cutting-edge AI-powered real-time process monitoring dashboard featuring 5 novel, patent-worthy AI capabilities.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed ([nodejs.org](https://nodejs.org))

### Run locally

```bash
# 1. Install dependencies
npm install

# 2. Start dev server
npm run dev

# 3. Open browser at http://localhost:3000
```

### Build for production

```bash
npm run build
# Output will be in the /dist folder
npm run preview  # preview the production build
```

---

## 🧠 AI Features (Patent Claims)

### Patent Claim #1 — AI Causal Inference Graph
Discovers *why* anomalies happen by learning inter-process causal relationships from correlated activity. Maps upstream triggers for any process spike.
→ **Tab: ⬡ Causal Graph**

### Patent Claim #2 — Behavioral DNA Fingerprinting
Each process builds its own statistical baseline (mean CPU, memory, I/O variance). Drift is measured against *that specific process's own history* — enabling intrusion detection, container escapes, and slow memory leaks invisible to threshold-based systems.
→ **Tab: ◎ DNA Analysis** | **Column: DNA Drift**

### Patent Claim #3 — Temporal Context Engine
Knows that high CPU at 3am during a maintenance window is fundamentally different from the same load at 2pm. Learns time-of-day load profiles and flags anomalies relative to temporal baselines.
→ **Dashboard: Temporal Context Engine panel**

### Patent Claim #4 — Counterfactual Kill Simulation
Before killing a process, simulates downstream cascade effects — which processes will be affected, what resources freed, and overall risk level.
→ **Button: ⚗ What-If Simulator**

### Patent Claim #5 — Multi-Source Narrative Generator
Synthesizes causal chains, behavioral drift, temporal context, and live metrics into plain-English incident stories — like an on-call SRE wrote them.
→ **Tab: ◈ AI Narrator**

---

## 📁 Project Structure

```
nexus-ai-monitor/
├── public/
│   └── index.html
├── src/
│   ├── main.jsx       # React entry point
│   └── App.jsx        # Full dashboard with AI engine
├── package.json
├── vite.config.js
└── README.md
```

## 🛠 Tech Stack
- React 18 + Hooks
- Vite 5 (bundler)
- Vanilla CSS-in-JS (no external UI library)
- Google Fonts (Space Mono + Rajdhani)

---

*Built with NEXUS.AI — © 2026. All AI features described are novel and may be subject to patent protection.*
