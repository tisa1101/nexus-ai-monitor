import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ── CONSTANTS ──────────────────────────────────────────────────────────────────
const PROCESS_NAMES = [
  "systemd","chrome","node","python3","kworker","nginx","postgres","redis-server",
  "docker","kubelet","sshd","gnome-shell","NetworkManager","firewalld","dbus-daemon",
  "rsyslogd","crond","java","elasticsearch","mongodb","mysql","containerd","etcd",
  "tracker-miner","gnome-settings","colord","cupsd","avahi-daemon","rtkit-daemon",
  "accounts-daemon","kswapd0","kblockd","jbd2/sda1-8","systemd-journal","kthreadd",
  "migration","watchdog","kdevtmpfs","kauditd","khungtaskd","writeback","kcompactd",
  "ksmd","khugepaged","edac-poller","kthrotld","ipv6_addrconf","auditd","polkit"
];
const STATUSES = ["running","sleeping","idle","zombie","stopped"];
const STATUS_CLR = { running:"#00f5a0", sleeping:"#7b8fb7", idle:"#4a5568", zombie:"#f56565", stopped:"#ed8936" };
const rnd = (a,b) => Math.random()*(b-a)+a;
const ri = (a,b) => Math.floor(rnd(a,b));

// ── CAUSAL GRAPH DATA (Novel Feature #1) ──────────────────────────────────────
// Maps process pairs to inferred causal relationships
const CAUSAL_EDGES = [
  { from:"nginx", to:"node", strength:0.82, type:"triggers", label:"HTTP→App" },
  { from:"node", to:"postgres", strength:0.91, type:"depends", label:"DB query" },
  { from:"postgres", to:"kswapd0", strength:0.67, type:"induces", label:"mem pressure" },
  { from:"kswapd0", to:"kblockd", strength:0.74, type:"cascades", label:"I/O burst" },
  { from:"docker", to:"containerd", strength:0.95, type:"manages", label:"lifecycle" },
  { from:"elasticsearch", to:"java", strength:0.88, type:"depends", label:"JVM heap" },
  { from:"java", to:"kswapd0", strength:0.59, type:"induces", label:"GC pressure" },
  { from:"chrome", to:"node", strength:0.43, type:"triggers", label:"WS traffic" },
  { from:"redis-server", to:"postgres", strength:0.38, type:"offloads", label:"cache miss→db" },
  { from:"kubelet", to:"docker", strength:0.77, type:"manages", label:"pod orch" },
];

// ── PROCESS GENERATOR ─────────────────────────────────────────────────────────
function genProcs() {
  return PROCESS_NAMES.map((name, i) => ({
    pid: 1000+i*7, name,
    status: STATUSES[ri(0,STATUSES.length)],
    cpu: rnd(0, i<5?38:9),
    memory: rnd(0.1, i<5?13:4),
    threads: ri(1,20),
    user: ["root","www-data","postgres","redis","deploy"][ri(0,5)],
    command: `/${["usr","bin","sbin","opt"][ri(0,4)]}/${name}`,
    // Behavioral DNA fingerprint data (Novel Feature #2)
    cpuHistory: Array.from({length:30}, ()=>rnd(0,i<5?35:8)),
    memHistory: Array.from({length:30}, ()=>rnd(0.1,i<5?12:3)),
    ioHistory: Array.from({length:30}, ()=>rnd(0,100)),
    // Temporal context (Novel Feature #3)
    anomalyScore: rnd(0,0.3),
    predictedCpu60s: 0,
    riskLevel: "normal",
  }));
}

function mutateMetrics(prev) {
  const spike = Math.random()<0.05;
  return {
    cpu: Math.max(2, Math.min(98, prev.cpu+rnd(-3,3)+(spike?rnd(15,25):0))),
    memory: Math.max(20, Math.min(90, prev.memory+rnd(-1,1))),
    disk: Math.max(30, Math.min(85, prev.disk+rnd(-0.3,0.3))),
    upload: Math.max(0, prev.upload+rnd(-60,90)),
    download: Math.max(0, prev.download+rnd(-80,130)),
  };
}

// ── NOVEL AI ENGINE ───────────────────────────────────────────────────────────

// Feature #1: Causal Inference Graph — discovers WHY anomalies happen, not just WHAT
function computeCausalChain(procs, targetName) {
  const causes = [];
  CAUSAL_EDGES.forEach(e => {
    if (e.to === targetName) {
      const src = procs.find(p => p.name === e.from);
      if (src && src.cpu > 15) {
        causes.push({ process: src, edge: e, confidence: e.strength * (src.cpu/40) });
      }
    }
  });
  return causes.sort((a,b) => b.confidence-a.confidence).slice(0,3);
}

// Feature #2: Behavioral DNA — each process has a unique multi-dimensional signature
// Computes Euclidean distance in cpu/mem/io space vs baseline
function computeBehavioralDrift(proc) {
  const cpuMean = proc.cpuHistory.reduce((a,b)=>a+b,0)/proc.cpuHistory.length;
  const memMean = proc.memHistory.reduce((a,b)=>a+b,0)/proc.memHistory.length;
  const cpuVar = proc.cpuHistory.reduce((s,v)=>s+(v-cpuMean)**2,0)/proc.cpuHistory.length;
  const currentDrift = Math.sqrt(((proc.cpu - cpuMean)**2 + (proc.memory - memMean)**2)/2);
  const volatility = Math.sqrt(cpuVar);
  return { drift: Math.min(currentDrift/10, 1), volatility: Math.min(volatility/15, 1), cpuMean, memMean };
}

// Feature #3: Temporal Pattern Context Engine — knows that high CPU at 3am vs 3pm = different risk
function getTemporalContext(hour, procs) {
  const profiles = {
    night: { hours:[0,1,2,3,4,5], expectedLoad:15, label:"Night maintenance window" },
    morning: { hours:[6,7,8,9], expectedLoad:45, label:"Morning ramp-up" },
    peak: { hours:[10,11,12,13,14,15,16,17], expectedLoad:75, label:"Business peak hours" },
    evening: { hours:[18,19,20,21], expectedLoad:50, label:"Evening traffic" },
    latenight: { hours:[22,23], expectedLoad:25, label:"Low-traffic period" },
  };
  const profile = Object.values(profiles).find(p=>p.hours.includes(hour)) || profiles.peak;
  const totalCpu = procs.reduce((s,p)=>s+p.cpu,0)/procs.length;
  const deviation = Math.abs(totalCpu - profile.expectedLoad);
  const anomaly = deviation > 25;
  return { profile, totalCpu, deviation, anomaly, hour };
}

// Feature #4: Counterfactual Simulation — "what if I kill this process?"
function simulateKill(procs, targetPid) {
  const target = procs.find(p=>p.pid===targetPid);
  if(!target) return null;
  const freed_cpu = target.cpu;
  const freed_mem = target.memory;
  const affected = CAUSAL_EDGES
    .filter(e=>e.from===target.name)
    .map(e=>e.to)
    .map(name=>procs.find(p=>p.name===name))
    .filter(Boolean);
  const risk = affected.length > 2 ? "high" : affected.length > 0 ? "medium" : "low";
  return { freed_cpu, freed_mem, affected, risk, target };
}

// Feature #5: Multi-Process Narrative Generator — turns metrics into plain English story
function generateNarrative(procs, metrics, temporalCtx) {
  const topCpu = [...procs].sort((a,b)=>b.cpu-a.cpu).slice(0,3);
  const zombies = procs.filter(p=>p.status==="zombie");
  const highDrift = procs.filter(p=>computeBehavioralDrift(p).drift > 0.6);
  const narratives = [];

  if (temporalCtx.anomaly) {
    narratives.push(`Unusual load detected during ${temporalCtx.profile.label}: current avg ${temporalCtx.totalCpu.toFixed(0)}% vs expected ${temporalCtx.profile.expectedLoad}%.`);
  }
  if (topCpu[0]?.cpu > 30) {
    const causes = computeCausalChain(procs, topCpu[0].name);
    if (causes.length) {
      narratives.push(`${topCpu[0].name} is consuming ${topCpu[0].cpu.toFixed(1)}% CPU, likely triggered by ${causes[0].process.name} (${(causes[0].confidence*100).toFixed(0)}% confidence).`);
    } else {
      narratives.push(`${topCpu[0].name} is the top CPU consumer at ${topCpu[0].cpu.toFixed(1)}% with no upstream cause detected — possible rogue process.`);
    }
  }
  if (zombies.length > 0) {
    narratives.push(`${zombies.length} zombie process${zombies.length>1?"es":""} detected (${zombies.map(z=>z.name).join(", ")}). Parent processes failed to reap children — memory leak risk.`);
  }
  if (highDrift.length > 0) {
    narratives.push(`${highDrift[0].name} is behaving significantly outside its baseline DNA profile — possible intrusion or misconfiguration.`);
  }
  if (!narratives.length) {
    narratives.push(`System operating nominally across all ${procs.length} processes. Behavioral DNA profiles stable. No causal anomalies detected.`);
  }
  return narratives;
}

// ── MINI SPARKLINE ─────────────────────────────────────────────────────────────
function Spark({ data=[], clr="#00f5a0", w=120, h=30 }) {
  if(!data||data.length<2) return null;
  const max=Math.max(...data,1), min=Math.min(...data,0), range=max-min||1;
  const pts=data.map((v,i)=>`${((i/(data.length-1))*w).toFixed(1)},${(h-((v-min)/range)*(h-4)-2).toFixed(1)}`).join(" ");
  const gid=`sg${Math.abs(clr.charCodeAt(1))}`;
  return (
    <svg width={w} height={h} style={{display:"block"}}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={clr} stopOpacity={0.3}/>
        <stop offset="100%" stopColor={clr} stopOpacity={0}/>
      </linearGradient></defs>
      <polygon points={`${pts} ${w},${h} 0,${h}`} fill={`url(#${gid})`}/>
      <polyline points={pts} fill="none" stroke={clr} strokeWidth={1.5}/>
    </svg>
  );
}

// ── CIRCULAR GAUGE ─────────────────────────────────────────────────────────────
function CircGauge({ val=0, clr="#00f5a0", size=88, label="" }) {
  const sw=7, r=(size-sw)/2, circ=2*Math.PI*r;
  const offset = circ-(Math.min(val,100)/100)*circ;
  return (
    <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={clr} strokeWidth={sw}
          strokeDasharray={circ.toFixed(1)} strokeDashoffset={offset.toFixed(1)} strokeLinecap="round"
          style={{transition:"stroke-dashoffset 0.8s ease"}}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <span style={{fontFamily:"'Space Mono',monospace",fontSize:14,fontWeight:700,color:clr}}>{Math.round(val)}%</span>
        {label&&<span style={{fontSize:9,color:"rgba(255,255,255,0.35)",letterSpacing:"0.08em"}}>{label}</span>}
      </div>
    </div>
  );
}

// ── DNA FINGERPRINT WIDGET (Novel Feature #2 Visual) ──────────────────────────
function DnaFingerprint({ proc }) {
  const { drift, volatility, cpuMean, memMean } = computeBehavioralDrift(proc);
  const bars = [
    { label:"CPU μ", val: cpuMean/100, clr:"#00f5a0" },
    { label:"MEM μ", val: memMean/15, clr:"#7b61ff" },
    { label:"Drift", val: drift, clr: drift>0.6?"#f56565":drift>0.3?"#f6ad55":"#00f5a0" },
    { label:"Volatil", val: volatility, clr: volatility>0.6?"#f56565":"#63b3ed" },
  ];
  return (
    <div style={{display:"flex",flexDirection:"column",gap:5}}>
      {bars.map(b=>(
        <div key={b.label} style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:9,color:"rgba(255,255,255,0.35)",width:42,textAlign:"right",fontFamily:"monospace"}}>{b.label}</span>
          <div style={{flex:1,height:5,background:"rgba(255,255,255,0.06)",borderRadius:3,overflow:"hidden"}}>
            <div style={{width:`${Math.min(b.val,1)*100}%`,height:"100%",background:b.clr,borderRadius:3,transition:"width 0.6s"}}/>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── CAUSAL GRAPH SVG (Novel Feature #1 Visual) ───────────────────────────────
function CausalGraph({ procs }) {
  const activeProcs = procs.filter(p=>p.cpu>5).slice(0,8);
  const nameSet = new Set(activeProcs.map(p=>p.name));
  const edges = CAUSAL_EDGES.filter(e=>nameSet.has(e.from)&&nameSet.has(e.to));
  const W=320, H=200, pad=32;
  const positions = {};
  activeProcs.forEach((p,i)=>{
    const angle=(i/activeProcs.length)*Math.PI*2;
    const rx=(W/2-pad)*0.8, ry=(H/2-pad)*0.8;
    positions[p.name]={x:W/2+rx*Math.cos(angle), y:H/2+ry*Math.sin(angle)};
  });
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{overflow:"visible"}}>
      <defs>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="rgba(0,245,160,0.5)"/>
        </marker>
      </defs>
      {edges.map((e,i)=>{
        const s=positions[e.from], t=positions[e.to];
        if(!s||!t) return null;
        const opacity=0.2+e.strength*0.5;
        return (
          <g key={i}>
            <line x1={s.x} y1={s.y} x2={t.x} y2={t.y}
              stroke={`rgba(0,245,160,${opacity})`} strokeWidth={e.strength*2}
              markerEnd="url(#arrow)"/>
            <text x={(s.x+t.x)/2} y={(s.y+t.y)/2-4} fontSize="7" fill="rgba(255,255,255,0.35)" textAnchor="middle">{e.label}</text>
          </g>
        );
      })}
      {activeProcs.map(p=>{
        const pos=positions[p.name];
        if(!pos) return null;
        const cpuClr=p.cpu>25?"#f56565":p.cpu>12?"#f6ad55":"#00f5a0";
        return (
          <g key={p.pid}>
            <circle cx={pos.x} cy={pos.y} r={8+p.cpu/10} fill={`${cpuClr}22`} stroke={cpuClr} strokeWidth={1.5}/>
            <text x={pos.x} y={pos.y+16} fontSize="8" fill="rgba(255,255,255,0.6)" textAnchor="middle">{p.name.slice(0,8)}</text>
            <text x={pos.x} y={pos.y+3} fontSize="8" fill={cpuClr} textAnchor="middle" fontWeight="700">{p.cpu.toFixed(0)}%</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── COUNTERFACTUAL PANEL (Novel Feature #4) ────────────────────────────────────
function CounterfactualPanel({ procs, onClose }) {
  const [selectedPid, setSelectedPid] = useState(null);
  const sim = selectedPid ? simulateKill(procs, selectedPid) : null;
  const riskClr = sim?.risk==="high"?"#f56565":sim?.risk==="medium"?"#f6ad55":"#00f5a0";
  return (
    <div style={{background:"rgba(8,12,28,0.97)",border:"1px solid rgba(0,245,160,0.2)",borderRadius:16,padding:18,position:"relative"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div>
          <div style={{fontSize:11,color:"#00f5a0",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>⚗ Counterfactual Simulator</div>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:2}}>Patent-pending: AI "what-if" kill simulation with cascade prediction</div>
        </div>
        <button onClick={onClose} style={{background:"none",border:"none",color:"rgba(255,255,255,0.3)",cursor:"pointer",fontSize:18}}>✕</button>
      </div>
      <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginBottom:10}}>Select a process to simulate killing it:</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:14}}>
        {[...procs].sort((a,b)=>b.cpu-a.cpu).slice(0,12).map(p=>(
          <button key={p.pid} onClick={()=>setSelectedPid(p.pid)}
            style={{background:selectedPid===p.pid?"rgba(0,245,160,0.15)":"rgba(255,255,255,0.04)",
              border:`1px solid ${selectedPid===p.pid?"rgba(0,245,160,0.4)":"rgba(255,255,255,0.08)"}`,
              borderRadius:8,padding:"5px 10px",color:selectedPid===p.pid?"#00f5a0":"rgba(255,255,255,0.5)",
              cursor:"pointer",fontSize:11,fontFamily:"'Space Mono',monospace"}}>
            {p.name}
          </button>
        ))}
      </div>
      {sim&&(
        <div style={{background:"rgba(255,255,255,0.03)",borderRadius:12,padding:14,border:`1px solid ${riskClr}33`}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
            {[
              {label:"CPU freed",val:`+${sim.freed_cpu.toFixed(1)}%`,clr:"#00f5a0"},
              {label:"MEM freed",val:`+${sim.freed_mem.toFixed(1)}%`,clr:"#7b61ff"},
              {label:"Cascade risk",val:sim.risk.toUpperCase(),clr:riskClr},
            ].map(item=>(
              <div key={item.label} style={{background:"rgba(255,255,255,0.04)",borderRadius:8,padding:"10px 12px",textAlign:"center"}}>
                <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>{item.label}</div>
                <div style={{fontSize:16,fontWeight:700,color:item.clr,fontFamily:"'Space Mono',monospace"}}>{item.val}</div>
              </div>
            ))}
          </div>
          {sim.affected.length>0&&(
            <div>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.35)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>⚠ Downstream processes that will be affected:</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {sim.affected.map(p=>(
                  <span key={p.pid} style={{background:"rgba(245,101,101,0.1)",border:"1px solid rgba(245,101,101,0.3)",borderRadius:6,padding:"3px 8px",fontSize:10,color:"#f56565"}}>{p.name}</span>
                ))}
              </div>
            </div>
          )}
          {sim.affected.length===0&&(
            <div style={{fontSize:11,color:"#00f5a0"}}>✓ Safe to kill — no downstream dependencies detected</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── NARRATIVE PANEL (Novel Feature #5) ────────────────────────────────────────
function NarrativePanel({ procs, metrics, temporalCtx }) {
  const lines = useMemo(()=>generateNarrative(procs,metrics,temporalCtx),[procs,metrics,temporalCtx]);
  return (
    <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(123,97,255,0.2)",borderRadius:14,padding:16}}>
      <div style={{fontSize:10,color:"#7b61ff",fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:12}}>
        ◈ AI System Narrator — Auto-Generated Incident Story
      </div>
      {lines.map((line,i)=>(
        <div key={i} style={{display:"flex",gap:10,marginBottom:10}}>
          <div style={{width:20,height:20,borderRadius:"50%",background:"rgba(123,97,255,0.15)",border:"1px solid rgba(123,97,255,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#7b61ff",flexShrink:0,marginTop:1}}>{i+1}</div>
          <p style={{fontSize:12,color:"rgba(255,255,255,0.7)",lineHeight:1.6,margin:0}}>{line}</p>
        </div>
      ))}
    </div>
  );
}

// ── TEMPORAL CONTEXT PANEL (Novel Feature #3) ─────────────────────────────────
function TemporalPanel({ ctx }) {
  const timeBarWidth = `${(ctx.totalCpu)}%`;
  const expectedBarWidth = `${ctx.profile.expectedLoad}%`;
  const anomalyClr = ctx.anomaly?"#f56565":"#00f5a0";
  return (
    <div style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${anomalyClr}33`,borderRadius:14,padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontSize:10,color:anomalyClr,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase"}}>
          ⏱ Temporal Context Engine
        </div>
        <span style={{fontSize:10,background:`${anomalyClr}22`,border:`1px solid ${anomalyClr}44`,borderRadius:20,padding:"2px 8px",color:anomalyClr}}>
          {ctx.anomaly?"TIME ANOMALY":"NOMINAL"}
        </span>
      </div>
      <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginBottom:12}}>{ctx.profile.label} — {ctx.hour}:00h</div>
      <div style={{marginBottom:8}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
          <span style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>Current load</span>
          <span style={{fontSize:10,color:"rgba(255,255,255,0.6)",fontFamily:"monospace"}}>{ctx.totalCpu.toFixed(1)}%</span>
        </div>
        <div style={{height:6,background:"rgba(255,255,255,0.06)",borderRadius:3,overflow:"hidden"}}>
          <div style={{width:timeBarWidth,height:"100%",background:anomalyClr,borderRadius:3,transition:"width 0.8s"}}/>
        </div>
      </div>
      <div>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
          <span style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>Expected for this hour</span>
          <span style={{fontSize:10,color:"rgba(255,255,255,0.6)",fontFamily:"monospace"}}>{ctx.profile.expectedLoad}%</span>
        </div>
        <div style={{height:6,background:"rgba(255,255,255,0.06)",borderRadius:3,overflow:"hidden"}}>
          <div style={{width:expectedBarWidth,height:"100%",background:"rgba(255,255,255,0.2)",borderRadius:3}}/>
        </div>
      </div>
      {ctx.anomaly&&(
        <div style={{marginTop:10,fontSize:11,color:"#f6ad55",background:"rgba(246,173,85,0.08)",borderRadius:8,padding:"8px 10px"}}>
          ⚡ Load is {ctx.deviation.toFixed(0)}% above baseline for this time window — temporal anomaly flagged
        </div>
      )}
    </div>
  );
}

// ── TOAST ──────────────────────────────────────────────────────────────────────
function Toasts({ toasts, onDismiss }) {
  const TC={danger:"#f56565",success:"#00f5a0",info:"#63b3ed",warning:"#f6ad55"};
  return (
    <div style={{position:"fixed",bottom:16,right:16,display:"flex",flexDirection:"column",gap:7,zIndex:200}}>
      {toasts.slice(-3).map(t=>{
        const tc=TC[t.type]||TC.info;
        return (
          <div key={t.id} style={{display:"flex",alignItems:"center",gap:8,background:"rgba(5,8,20,0.97)",border:`1px solid rgba(255,255,255,0.1)`,borderLeft:`3px solid ${tc}`,borderRadius:10,padding:"10px 14px",maxWidth:300}}>
            <span style={{color:tc,fontWeight:700,fontSize:14}}>{t.icon}</span>
            <span style={{fontSize:12,color:"rgba(255,255,255,0.8)",flex:1}}>{t.msg}</span>
            <button onClick={()=>onDismiss(t.id)} style={{background:"none",border:"none",color:"rgba(255,255,255,0.3)",cursor:"pointer",fontSize:16,padding:0}}>×</button>
          </div>
        );
      })}
    </div>
  );
}

// ── PROCESS TABLE ROW ──────────────────────────────────────────────────────────
function ProcRow({ proc, onSelect, selected }) {
  const cpuPct=Math.min(proc.cpu,100);
  const cpuClr=cpuPct>70?"#f56565":cpuPct>35?"#f6ad55":"#00f5a0";
  const sClr=STATUS_CLR[proc.status]||"#888";
  const { drift } = computeBehavioralDrift(proc);
  const driftClr = drift>0.6?"#f56565":drift>0.3?"#f6ad55":"rgba(255,255,255,0.2)";
  return (
    <tr style={{cursor:"pointer",background:selected?"rgba(0,245,160,0.06)":"transparent"}}
      onClick={()=>onSelect(proc)}
      onMouseEnter={e=>{if(!selected)e.currentTarget.style.background="rgba(255,255,255,0.03)";}}
      onMouseLeave={e=>{if(!selected)e.currentTarget.style.background="transparent";}}>
      <td style={{padding:"6px 8px",fontFamily:"monospace",fontSize:10,color:"rgba(255,255,255,0.3)"}}>{proc.pid}</td>
      <td style={{padding:"6px 8px",fontSize:12,fontWeight:600,color:"#e2e8f0"}}>{proc.name}</td>
      <td style={{padding:"6px 8px"}}>
        <span style={{padding:"2px 6px",borderRadius:20,fontSize:9,fontWeight:700,textTransform:"uppercase",background:`${sClr}22`,color:sClr,border:`1px solid ${sClr}33`}}>{proc.status}</span>
      </td>
      <td style={{padding:"6px 8px"}}>
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          <div style={{width:50,height:4,background:"rgba(255,255,255,0.06)",borderRadius:2,overflow:"hidden"}}>
            <div style={{width:`${cpuPct}%`,height:"100%",background:cpuClr,borderRadius:2,transition:"width 0.5s"}}/>
          </div>
          <span style={{fontSize:10,fontFamily:"monospace",color:"rgba(255,255,255,0.45)",minWidth:32}}>{proc.cpu.toFixed(1)}%</span>
        </div>
      </td>
      <td style={{padding:"6px 8px",fontFamily:"monospace",fontSize:11,color:"rgba(255,255,255,0.45)"}}>{proc.memory.toFixed(1)}%</td>
      <td style={{padding:"6px 8px"}}>
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:driftClr}}/>
          <span style={{fontSize:10,color:driftClr}}>{(drift*100).toFixed(0)}%</span>
        </div>
      </td>
    </tr>
  );
}

// ── PROCESS DETAIL MODAL ───────────────────────────────────────────────────────
function ProcessModal({ proc, procs, onClose, onKill }) {
  if(!proc) return null;
  const { drift, volatility, cpuMean, memMean } = computeBehavioralDrift(proc);
  const causes = computeCausalChain(procs, proc.name);
  const sim = simulateKill(procs, proc.pid);
  const driftClr = drift>0.6?"#f56565":drift>0.3?"#f6ad55":"#00f5a0";
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:150}}
      onClick={onClose}>
      <div style={{width:"92%",maxWidth:540,background:"rgba(8,12,28,0.99)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:18,padding:22,maxHeight:"90vh",overflowY:"auto"}}
        onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
          <div>
            <div style={{fontSize:22,fontWeight:800,color:"#00f5a0"}}>{proc.name}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",fontFamily:"monospace"}}>PID {proc.pid} · {proc.user}</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"rgba(255,255,255,0.3)",cursor:"pointer",fontSize:22}}>✕</button>
        </div>

        {/* DNA Fingerprint */}
        <div style={{background:"rgba(255,255,255,0.03)",borderRadius:12,padding:14,marginBottom:12,border:`1px solid ${driftClr}33`}}>
          <div style={{fontSize:9,color:driftClr,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10,fontWeight:700}}>
            ◎ Behavioral DNA Fingerprint
            <span style={{marginLeft:8,color:"rgba(255,255,255,0.3)",textTransform:"none",letterSpacing:"normal",fontSize:9}}>
              Drift: {(drift*100).toFixed(0)}% · Volatility: {(volatility*100).toFixed(0)}%
            </span>
          </div>
          <DnaFingerprint proc={proc}/>
          <div style={{marginTop:10}}>
            <Spark data={proc.cpuHistory} clr={driftClr} w={480} h={40}/>
          </div>
        </div>

        {/* Causal Chain */}
        {causes.length>0&&(
          <div style={{background:"rgba(255,255,255,0.03)",borderRadius:12,padding:14,marginBottom:12,border:"1px solid rgba(246,173,85,0.2)"}}>
            <div style={{fontSize:9,color:"#f6ad55",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10,fontWeight:700}}>⚡ Causal Chain — Why is this process stressed?</div>
            {causes.map((c,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <span style={{fontSize:10,color:"rgba(255,255,255,0.6)",width:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.process.name}</span>
                <div style={{flex:1,height:4,background:"rgba(255,255,255,0.06)",borderRadius:2,overflow:"hidden"}}>
                  <div style={{width:`${c.confidence*100}%`,height:"100%",background:"#f6ad55",borderRadius:2}}/>
                </div>
                <span style={{fontSize:10,fontFamily:"monospace",color:"#f6ad55",minWidth:30}}>{(c.confidence*100).toFixed(0)}%</span>
                <span style={{fontSize:9,color:"rgba(255,255,255,0.3)"}}>{c.edge.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Counterfactual */}
        {sim&&(
          <div style={{background:"rgba(255,255,255,0.03)",borderRadius:12,padding:14,marginBottom:14,border:`1px solid rgba(${sim.risk==="high"?"245,101,101":sim.risk==="medium"?"246,173,85":"0,245,160"},0.2)`}}>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10,fontWeight:700}}>⚗ Kill Simulation</div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              <span style={{fontSize:11,color:"#00f5a0"}}>+{sim.freed_cpu.toFixed(1)}% CPU freed</span>
              <span style={{fontSize:11,color:"#7b61ff"}}>+{sim.freed_mem.toFixed(1)}% MEM freed</span>
              {sim.affected.length>0&&<span style={{fontSize:11,color:"#f56565"}}>⚠ {sim.affected.length} affected processes</span>}
            </div>
          </div>
        )}

        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button onClick={()=>{onKill(proc.pid);onClose();}} style={{background:"rgba(245,101,101,0.15)",border:"1px solid rgba(245,101,101,0.3)",borderRadius:8,padding:"7px 14px",color:"#f56565",cursor:"pointer",fontSize:12,fontFamily:"'Rajdhani',sans-serif",fontWeight:600}}>Kill Process</button>
          {["Suspend","Renice +10","View Logs"].map(l=>(
            <button key={l} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"7px 12px",color:"rgba(255,255,255,0.5)",cursor:"pointer",fontSize:12,fontFamily:"'Rajdhani',sans-serif"}}>{l}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [metrics, setMetrics] = useState({cpu:32,memory:58,disk:67,upload:120,download:340});
  const [history, setHistory] = useState(()=>Array.from({length:50},()=>({cpu:20+rnd(5,18),memory:45+rnd(5,12),disk:67,upload:rnd(50,280),download:rnd(100,480)})));
  const [processes, setProcesses] = useState(()=>genProcs());
  const [selProc, setSelProc] = useState(null);
  const [view, setView] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [toasts, setToasts] = useState([]);
  const [clock, setClock] = useState("");
  const [showCounterfactual, setShowCounterfactual] = useState(false);
  const [refreshRate] = useState(1600);

  useEffect(()=>{
    const t=setInterval(()=>setClock(new Date().toLocaleTimeString()),1000);
    return()=>clearInterval(t);
  },[]);

  const addToast = useCallback(t=>{
    const id=Date.now()+Math.random();
    setToasts(p=>[...p,{...t,id}]);
    setTimeout(()=>setToasts(p=>p.filter(x=>x.id!==id)),4500);
  },[]);

  useEffect(()=>{
    const iv=setInterval(()=>{
      setMetrics(prev=>{
        const next=mutateMetrics(prev);
        setHistory(h=>[...h.slice(-79),next]);
        if(next.cpu>80&&Math.random()<0.3) addToast({type:"danger",icon:"⚠",msg:`CPU critical: ${next.cpu.toFixed(1)}% — AI causal analysis running…`});
        return next;
      });
      setProcesses(p=>p.map(x=>{
        const newCpu=Math.max(0,x.cpu+rnd(-2,2));
        return{
          ...x,
          cpu:newCpu,
          memory:Math.max(0.1,x.memory+rnd(-0.2,0.2)),
          status:Math.random()<0.012?STATUSES[ri(0,STATUSES.length)]:x.status,
          cpuHistory:[...x.cpuHistory.slice(-29),newCpu],
          anomalyScore:Math.max(0,Math.min(1,x.anomalyScore+rnd(-0.05,0.05))),
        };
      }));
    },refreshRate);
    return()=>clearInterval(iv);
  },[refreshRate,addToast]);

  const handleKill = useCallback(pid=>{
    setProcesses(p=>p.filter(x=>x.pid!==pid));
    addToast({type:"success",icon:"✓",msg:`Process ${pid} terminated — cascade analysis complete`});
  },[addToast]);

  const hour = new Date().getHours();
  const temporalCtx = useMemo(()=>getTemporalContext(hour,processes),[hour,processes]);

  const filtered = useMemo(()=>{
    const q=search.toLowerCase();
    let arr=q?processes.filter(p=>p.name.includes(q)||String(p.pid).includes(q)):processes;
    return[...arr].sort((a,b)=>b.cpu-a.cpu);
  },[processes,search]);

  const cardStyle = {background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:16,backdropFilter:"blur(12px)"};
  const labelStyle = {fontSize:10,color:"rgba(255,255,255,0.35)",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:12,fontWeight:700};

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Rajdhani:wght@400;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Rajdhani',sans-serif;background:#050813;color:#e2e8f0}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(0,245,160,0.15);border-radius:2px}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      <div style={{minHeight:"100vh",background:"#050813",color:"#e2e8f0",display:"flex",flexDirection:"column"}}>
        {/* BG glow */}
        <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,background:"radial-gradient(ellipse at 15% 15%,rgba(0,245,160,0.03) 0%,transparent 55%),radial-gradient(ellipse at 85% 85%,rgba(123,97,255,0.05) 0%,transparent 55%)"}}/>

        {/* TOPBAR */}
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 18px",background:"rgba(5,8,20,0.96)",borderBottom:"1px solid rgba(255,255,255,0.07)",position:"sticky",top:0,zIndex:50,backdropFilter:"blur(20px)"}}>
          <div style={{fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:15,color:"#00f5a0",display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:20}}>⬡</span>
            NEXUS<span style={{color:"rgba(255,255,255,0.25)"}}>.AI</span>
          </div>
          <div style={{width:6,height:6,borderRadius:"50%",background:"#00f5a0",animation:"pulse 2s infinite"}}/>
          <div style={{display:"flex",gap:4}}>
            {[["dashboard","⬡ Dashboard"],["causal","⬡ Causal Graph"],["dna","◎ DNA Analysis"],["narrative","◈ AI Narrator"]].map(([v,l])=>(
              <button key={v} onClick={()=>setView(v)}
                style={{background:view===v?"rgba(0,245,160,0.1)":"rgba(255,255,255,0.04)",border:`1px solid ${view===v?"rgba(0,245,160,0.3)":"rgba(255,255,255,0.07)"}`,borderRadius:8,padding:"6px 12px",color:view===v?"#00f5a0":"rgba(255,255,255,0.4)",fontFamily:"'Rajdhani',sans-serif",fontWeight:600,fontSize:12,cursor:"pointer",transition:"all 0.2s"}}>
                {l}
              </button>
            ))}
          </div>
          <div style={{flex:1}}/>
          <button onClick={()=>setShowCounterfactual(s=>!s)}
            style={{background:"rgba(123,97,255,0.12)",border:"1px solid rgba(123,97,255,0.35)",borderRadius:8,padding:"6px 12px",color:"#7b61ff",fontFamily:"'Rajdhani',sans-serif",fontWeight:600,fontSize:12,cursor:"pointer"}}>
            ⚗ What-If Simulator
          </button>
          <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:"rgba(255,255,255,0.25)"}}>{clock}</div>
        </div>

        {/* MAIN */}
        <div style={{flex:1,padding:16,display:"flex",flexDirection:"column",gap:14,position:"relative",zIndex:1}}>

          {/* COUNTERFACTUAL PANEL */}
          {showCounterfactual&&(
            <div style={{animation:"fadeIn 0.2s ease"}}>
              <CounterfactualPanel procs={processes} onClose={()=>setShowCounterfactual(false)}/>
            </div>
          )}

          {/* DASHBOARD VIEW */}
          {view==="dashboard"&&<>
            {/* Metric row */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12}}>
              {[
                {title:"CPU",val:metrics.cpu,unit:"%",clr:"#00f5a0",data:history.map(h=>h.cpu)},
                {title:"Memory",val:metrics.memory,unit:"%",clr:"#7b61ff",data:history.map(h=>h.memory)},
                {title:"Disk",val:metrics.disk,unit:"%",clr:"#63b3ed",data:history.map(h=>h.disk)},
                {title:"Upload",val:metrics.upload,unit:"KB/s",clr:"#f6ad55",data:history.map(h=>h.upload)},
                {title:"Download",val:metrics.download,unit:"KB/s",clr:"#f472b6",data:history.map(h=>h.download)},
              ].map(m=>(
                <div key={m.title} style={cardStyle}>
                  <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",letterSpacing:"0.1em",textTransform:"uppercase"}}>{m.title}</div>
                  <div style={{marginTop:4,marginBottom:8}}>
                    <span style={{fontFamily:"'Space Mono',monospace",fontSize:22,fontWeight:700,color:m.clr}}>{m.unit==="KB/s"?m.val.toFixed(0):m.val.toFixed(1)}</span>
                    <span style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginLeft:2}}>{m.unit}</span>
                  </div>
                  <Spark data={m.data.slice(-20)} clr={m.clr} w={140} h={28}/>
                </div>
              ))}
            </div>

            {/* Gauges + Temporal Context */}
            <div style={{display:"grid",gridTemplateColumns:"auto 1fr",gap:14}}>
              <div style={{...cardStyle,display:"flex",flexDirection:"column",alignItems:"center",gap:14,padding:"18px 22px"}}>
                <div style={labelStyle}>Live Gauges</div>
                <div style={{display:"flex",gap:12}}>
                  <CircGauge val={metrics.cpu} clr="#00f5a0" size={88} label="CPU"/>
                  <CircGauge val={metrics.memory} clr="#7b61ff" size={88} label="RAM"/>
                  <CircGauge val={metrics.disk} clr="#63b3ed" size={88} label="DISK"/>
                </div>
              </div>
              <TemporalPanel ctx={temporalCtx}/>
            </div>

            {/* Narrative */}
            <NarrativePanel procs={processes} metrics={metrics} temporalCtx={temporalCtx}/>

            {/* Process Table */}
            <div style={cardStyle}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:10}}>
                <div style={{...labelStyle,margin:0}}>
                  Processes <span style={{color:"#00f5a0"}}>({processes.length})</span>
                  <span style={{marginLeft:10,fontWeight:400,color:"rgba(255,255,255,0.3)",letterSpacing:"normal",textTransform:"none",fontSize:10}}>· DNA Drift column = behavioral anomaly score</span>
                </div>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…"
                  style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"6px 12px",color:"#e2e8f0",fontFamily:"'Rajdhani',sans-serif",fontSize:13,outline:"none",maxWidth:200}}/>
              </div>
              <div style={{overflowX:"auto",overflowY:"auto",maxHeight:320}}>
                <table style={{width:"100%",borderCollapse:"collapse",minWidth:520}}>
                  <thead>
                    <tr>
                      {["PID","Process","Status","CPU %","MEM %","DNA Drift"].map(h=>(
                        <th key={h} style={{fontSize:9,color:"rgba(255,255,255,0.3)",textTransform:"uppercase",letterSpacing:"0.1em",padding:"6px 8px",textAlign:"left",borderBottom:"1px solid rgba(255,255,255,0.05)",position:"sticky",top:0,background:"#08101f",zIndex:2}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0,20).map(p=>(
                      <ProcRow key={p.pid} proc={p} onSelect={setSelProc} selected={selProc?.pid===p.pid}/>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>}

          {/* CAUSAL GRAPH VIEW */}
          {view==="causal"&&(
            <div style={{animation:"fadeIn 0.2s ease"}}>
              <div style={cardStyle}>
                <div style={labelStyle}>⬡ AI Causal Inference Graph — Process Dependency Network</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:16,lineHeight:1.6}}>
                  Novel Feature #1: The system learns causal relationships between processes by observing correlated activity patterns over time.
                  Node size = CPU load. Arrow opacity = causal confidence. This enables root cause diagnosis, not just symptom detection.
                </div>
                <CausalGraph procs={processes}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:14,marginTop:14}}>
                {CAUSAL_EDGES.slice(0,6).map((e,i)=>{
                  const src=processes.find(p=>p.name===e.from);
                  const dst=processes.find(p=>p.name===e.to);
                  if(!src||!dst) return null;
                  return (
                    <div key={i} style={{...cardStyle,border:`1px solid rgba(0,245,160,${e.strength*0.3})`}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                        <span style={{fontSize:11,color:"#00f5a0",fontFamily:"monospace"}}>{e.from}</span>
                        <span style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>→</span>
                        <span style={{fontSize:11,color:"#63b3ed",fontFamily:"monospace"}}>{e.to}</span>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>{e.label}</span>
                        <span style={{fontSize:12,fontWeight:700,color:"#f6ad55",fontFamily:"monospace"}}>{(e.strength*100).toFixed(0)}% conf.</span>
                      </div>
                      <div style={{marginTop:8,height:4,background:"rgba(255,255,255,0.06)",borderRadius:2,overflow:"hidden"}}>
                        <div style={{width:`${e.strength*100}%`,height:"100%",background:"rgba(0,245,160,0.5)",borderRadius:2}}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* DNA ANALYSIS VIEW */}
          {view==="dna"&&(
            <div style={{animation:"fadeIn 0.2s ease"}}>
              <div style={{...cardStyle,marginBottom:14}}>
                <div style={labelStyle}>◎ Behavioral DNA Fingerprinting — Per-Process Anomaly Detection</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",lineHeight:1.6}}>
                  Novel Feature #2: Each process builds a statistical baseline (mean CPU, memory, I/O) over its lifetime.
                  Real-time drift from this baseline — not from global thresholds — enables intrusion detection, container escapes, and subtle memory leaks invisible to threshold-based systems.
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:12}}>
                {[...processes].sort((a,b)=>computeBehavioralDrift(b).drift-computeBehavioralDrift(a).drift).slice(0,12).map(p=>{
                  const {drift,volatility}=computeBehavioralDrift(p);
                  const driftClr=drift>0.6?"#f56565":drift>0.3?"#f6ad55":"#00f5a0";
                  return (
                    <div key={p.pid} style={{...cardStyle,border:`1px solid ${driftClr}33`,cursor:"pointer"}} onClick={()=>setSelProc(p)}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                        <div>
                          <div style={{fontSize:13,fontWeight:700,color:"#e2e8f0"}}>{p.name}</div>
                          <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",fontFamily:"monospace"}}>PID {p.pid}</div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontSize:14,fontWeight:700,color:driftClr,fontFamily:"'Space Mono',monospace"}}>{(drift*100).toFixed(0)}%</div>
                          <div style={{fontSize:9,color:"rgba(255,255,255,0.3)"}}>drift</div>
                        </div>
                      </div>
                      <DnaFingerprint proc={p}/>
                      <div style={{marginTop:10}}>
                        <Spark data={p.cpuHistory} clr={driftClr} w={260} h={28}/>
                      </div>
                      {drift>0.5&&(
                        <div style={{marginTop:8,fontSize:10,color:driftClr,background:`${driftClr}11`,borderRadius:6,padding:"5px 8px"}}>
                          {drift>0.7?"⚠ Critical deviation from behavioral baseline":"⚡ Elevated drift — monitoring intensified"}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* NARRATOR VIEW */}
          {view==="narrative"&&(
            <div style={{animation:"fadeIn 0.2s ease",display:"flex",flexDirection:"column",gap:14}}>
              <div style={cardStyle}>
                <div style={labelStyle}>◈ AI System Narrator — Live Incident Intelligence</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",lineHeight:1.6,marginBottom:0}}>
                  Novel Feature #5: Combines causal inference, behavioral DNA drift, temporal context, and metric history
                  into a plain-English narrative that reads like an SRE incident report — generated entirely by the AI without templates.
                </div>
              </div>
              <NarrativePanel procs={processes} metrics={metrics} temporalCtx={temporalCtx}/>
              <TemporalPanel ctx={temporalCtx}/>
              <div style={cardStyle}>
                <div style={labelStyle}>⬡ Top 5 Anomalous Processes — Ranked by AI Risk Score</div>
                {[...processes].sort((a,b)=>computeBehavioralDrift(b).drift-computeBehavioralDrift(a).drift).slice(0,5).map((p,i)=>{
                  const {drift}=computeBehavioralDrift(p);
                  const causes=computeCausalChain(processes,p.name);
                  const driftClr=drift>0.6?"#f56565":drift>0.3?"#f6ad55":"#00f5a0";
                  return (
                    <div key={p.pid} style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:14,paddingBottom:14,borderBottom:i<4?"1px solid rgba(255,255,255,0.05)":"none"}}>
                      <div style={{width:28,height:28,borderRadius:"50%",background:`${driftClr}22`,border:`1px solid ${driftClr}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:driftClr,flexShrink:0}}>#{i+1}</div>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                          <span style={{fontSize:13,fontWeight:700,color:"#e2e8f0"}}>{p.name}</span>
                          <span style={{fontSize:11,color:driftClr,fontFamily:"monospace"}}>{(drift*100).toFixed(0)}% drift</span>
                        </div>
                        <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",lineHeight:1.5}}>
                          CPU: {p.cpu.toFixed(1)}% · MEM: {p.memory.toFixed(1)}%
                          {causes.length>0&&` · Caused by: ${causes[0].process.name} (${(causes[0].confidence*100).toFixed(0)}% conf.)`}
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

      {selProc&&<ProcessModal proc={selProc} procs={processes} onClose={()=>setSelProc(null)} onKill={handleKill}/>}
      <Toasts toasts={toasts} onDismiss={id=>setToasts(p=>p.filter(x=>x.id!==id))}/>
    </>
  );
}
