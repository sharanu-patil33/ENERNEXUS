import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import DigitalTwin from './DigitalTwin';
import AnimatedBackground from './AnimatedBackground';
import './App.css';

const BACKEND_URL = 'http://localhost:5000';
const socket = io(BACKEND_URL);
const MAX_POINTS = 30;
const MAX_ALERTS = 10;

function App() {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState([]);
  const [systemMode, setSystemMode] = useState('LIVE'); // manual — you declare which mode you're running

  // ---------- Demo fault-injection controls ----------
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoMode, setDemoMode] = useState('normal');

  const setDemoFault = async (mode) => {
    setDemoLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/demo/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Demo request failed');
      setDemoMode(mode === 'clear' ? 'normal' : mode);
    } catch (err) {
      console.error('Demo fault error:', err);
    } finally {
      setDemoLoading(false);
    }
  };

  // ---------- Channel-specific relay control ----------
  const toggleChannel = async (channel) => {
    const currentState = data?.relays?.[channel] ?? 'on';
    const newState = currentState === 'on' ? 'off' : 'on';
    try {
      const res = await fetch(`${BACKEND_URL}/api/relay/${channel}/${newState}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Relay request failed');
    } catch (err) {
      console.error('Relay toggle error:', err);
    }
  };

  useEffect(() => {
    socket.on('connect', () => setConnected(true));

    socket.on('sensorData', (newData) => {
      setData(newData);
      const timeLabel = new Date().toLocaleTimeString();

      setHistory((prev) => {
        const point = {
          time: timeLabel,
          solar: +(newData.solarVoltage * 0.5).toFixed(1),
          battery: newData.decision?.battery ?? 0,
          grid: newData.decision?.grid ?? 0,
          load: newData.power ?? 0,
        };
        const updated = [...prev, point];
        return updated.length > MAX_POINTS ? updated.slice(-MAX_POINTS) : updated;
      });

      if (newData.anomaly) {
        setAlerts((prev) => {
          const newAlert = {
            time: timeLabel,
            score: newData.score,
            power: newData.power,
            voltage: newData.voltage,
          };
          const updated = [newAlert, ...prev];
          return updated.length > MAX_ALERTS ? updated.slice(0, MAX_ALERTS) : updated;
        });
      }
    });

    socket.on('disconnect', () => setConnected(false));

    return () => {
      socket.off('connect');
      socket.off('sensorData');
      socket.off('disconnect');
    };
  }, []);

  // ---------- Poll event log every 4 seconds ----------
  useEffect(() => {
    const fetchEvents = () => {
      fetch(`${BACKEND_URL}/api/events`)
        .then((res) => res.json())
        .then((list) => setEvents(list))
        .catch(() => {});
    };
    fetchEvents();
    const interval = setInterval(fetchEvents, 4000);
    return () => clearInterval(interval);
  }, []);

  const isAnomaly = data?.anomaly === true;
  const ch1On = data?.relays?.ch1 !== 'off';
  const ch2On = data?.relays?.ch2 !== 'off';

  return (
    <div className="twin-root">
      <AnimatedBackground />
      <div className="page-content">
        {/* Status bar */}
        <div className="status-bar">
          <div className="brand">
            <span className="brand-mark">GridTwin AI</span>
            <span className="brand-sub">CAMPUS ENERGY · NODE 01 + 02</span>
          </div>
          <div className="status-right">
            <button
              className={`mode-toggle ${systemMode === 'LIVE' ? 'mode-live' : 'mode-sim'}`}
              onClick={() => setSystemMode(systemMode === 'LIVE' ? 'SIMULATION' : 'LIVE')}
              title="Click to switch — reminder only, does not stop simulator.js if it's running"
            >
              {systemMode === 'LIVE' ? '● REAL HARDWARE' : '◐ SIMULATION MODE'}
            </button>
            <span>
              <span className={`live-dot ${connected ? 'on' : 'off'}`} />
              {connected ? 'LIVE' : 'OFFLINE'}
            </span>
            <span>{new Date().toLocaleTimeString()}</span>
          </div>
        </div>

        {!data ? (
          <div className="waiting">awaiting first telemetry packet...</div>
        ) : (
          <>
            {isAnomaly && (
              <div className="anomaly-banner">
                <span className="tag">FAULT</span>
                <span className="msg">Anomalous load detected — automatic classification by Isolation Forest</span>
                <span className="score">risk {data.score}</span>
              </div>
            )}

            {!ch2On && !isAnomaly && (
              <div className="anomaly-banner">
                <span className="tag">SHED</span>
                <span className="msg">New Load (CH2) disconnected for protection — Old Load (CH1) remains powered</span>
              </div>
            )}

            {/* Energy KPI strip */}
            <div className="kpi-strip">
              <Kpi label="SOLAR" value={(data.solarVoltage * 0.5).toFixed(1)} unit="W" />
              <Kpi label="BATTERY SOC" value={data.batterySOC} unit="%" />
              <Kpi label="GRID DRAW" value={data.decision?.grid?.toFixed(1) ?? '0.0'} unit="W" />
              <Kpi label="CAMPUS LOAD" value={data.power} unit="W" />
              <div className={`kpi ${isAnomaly ? 'status-fault' : 'status-normal'}`}>
                <p className="kpi-label">STATUS</p>
                <p className="kpi-value">{isAnomaly ? 'FAULT' : 'NORMAL'}</p>
              </div>
            </div>

            {/* Dedicated Solar/Battery + Grid/Load detail panels */}
            <div className="main-grid" style={{ marginBottom: '1.25rem' }}>
              <div className="panel source-panel source-solar">
                <p className="panel-title">
                  <span>☀ SOLAR &amp; BATTERY</span>
                  <span className={`source-badge ${data.isCharging ? 'charging' : ''}`}>
                    {data.isCharging ? 'CHARGING' : 'IDLE'}
                  </span>
                </p>
                <div className="source-grid">
                  <div className="source-stat">
                    <p className="kpi-label">SOLAR VOLTAGE</p>
                    <p className="kpi-value">{data.solarVoltage?.toFixed(2)}<span className="unit">V</span></p>
                  </div>
                  <div className="source-stat">
                    <p className="kpi-label">SOLAR SOURCE</p>
                    <p className="kpi-value" style={{ fontSize: '1.1rem' }}>
                      {data.solarVoltage > 2 ? 'AVAILABLE' : 'LOW'}
                    </p>
                  </div>
                  <div className="source-stat">
                    <p className="kpi-label">BATTERY VOLTAGE</p>
                    <p className="kpi-value">{data.batteryVoltage?.toFixed(2)}<span className="unit">V</span></p>
                  </div>
                  <div className="source-stat">
                    <p className="kpi-label">BATTERY SOC</p>
                    <p className="kpi-value">{data.batterySOC}<span className="unit">%</span></p>
                  </div>
                </div>
                <div className="soc-bar-track">
                  <div className="soc-bar-fill" style={{ width: `${data.batterySOC}%` }} />
                </div>
              </div>

              <div className="panel source-panel source-grid">
                <p className="panel-title">
                  <span>⚡ GRID &amp; LOAD</span>
                  <span className={`source-badge ${(data.decision?.grid ?? 0) > 0 ? 'drawing' : ''}`}>
                    {(data.decision?.grid ?? 0) > 0 ? 'DRAWING' : 'STANDBY'}
                  </span>
                </p>
                <div className="source-grid">
                  <div className="source-stat">
                    <p className="kpi-label">GRID VOLTAGE</p>
                    <p className="kpi-value">{data.voltage?.toFixed(1)}<span className="unit">V</span></p>
                  </div>
                  <div className="source-stat">
                    <p className="kpi-label">GRID CURRENT</p>
                    <p className="kpi-value">{data.current?.toFixed(2)}<span className="unit">A</span></p>
                  </div>
                  <div className="source-stat">
                    <p className="kpi-label">CAMPUS LOAD</p>
                    <p className="kpi-value">{data.power}<span className="unit">W</span></p>
                  </div>
                  <div className="source-stat">
                    <p className="kpi-label">GRID DRAW</p>
                    <p className="kpi-value">{data.decision?.grid?.toFixed(1) ?? '0.0'}<span className="unit">W</span></p>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Recommendation + Forecast */}
            <div className="main-grid" style={{ marginBottom: '1.25rem' }}>
              <div className="panel">
                <p className="panel-title">
                  <span>AI RECOMMENDATION</span>
                  <span>RULE-BASED ENGINE</span>
                </p>
                <p className="recommendation-text">
                  {data.decision?.action ?? 'Calculating...'}
                </p>
              </div>
              <div className="panel">
                <p className="panel-title">
                  <span>SOLAR TREND FORECAST</span>
                  <span>MOVING AVG</span>
                </p>
                {data.forecast?.predicted_30min != null ? (
                  <div className="forecast-row">
                    <div>
                      <p className="kpi-label">NEXT 30 MIN</p>
                      <p className="kpi-value">{data.forecast.predicted_30min}<span className="unit">V</span></p>
                    </div>
                    <div>
                      <p className="kpi-label">NEXT 2 HR</p>
                      <p className="kpi-value">{data.forecast.predicted_2hr}<span className="unit">V</span></p>
                    </div>
                  </div>
                ) : (
                  <p className="empty-state">gathering data...</p>
                )}
              </div>
            </div>

            {/* Load Control panel — two independent channels */}
            <div className="panel" style={{ marginBottom: '1.25rem' }}>
              <p className="panel-title">
                <span>LOAD CONTROL</span>
                <span>SELECTIVE PROTECTION</span>
              </p>
              <div className="load-control-grid">
                <div className="load-channel">
                  <div>
                    <p className="panel-title" style={{ marginBottom: '0.2rem' }}>CH1 · OLD LOAD</p>
                    <span className="relay-state">
                      state: <b className={ch1On ? 'on' : 'off'}>{ch1On ? 'ENERGIZED' : 'DE-ENERGIZED'}</b>
                    </span>
                  </div>
                  <button
                    className={`relay-btn ${ch1On ? 'cut' : 'restore'}`}
                    onClick={() => toggleChannel('ch1')}
                  >
                    {ch1On ? 'CUT' : 'RESTORE'}
                  </button>
                </div>

                <div className="load-channel">
                  <div>
                    <p className="panel-title" style={{ marginBottom: '0.2rem' }}>CH2 · NEW LOAD</p>
                    <span className="relay-state">
                      state: <b className={ch2On ? 'on' : 'off'}>{ch2On ? 'ENERGIZED' : 'DE-ENERGIZED'}</b>
                    </span>
                  </div>
                  <button
                    className={`relay-btn ${ch2On ? 'cut' : 'restore'}`}
                    onClick={() => toggleChannel('ch2')}
                  >
                    {ch2On ? 'CUT' : 'RESTORE'}
                  </button>
                </div>
              </div>
            </div>

            {/* Protection Event card */}
            <div className="panel" style={{ marginBottom: '1.25rem' }}>
              <p className="panel-title">
                <span>PROTECTION EVENT</span>
                <span>{events.length} LOGGED</span>
              </p>
              {data.lastAction ? (
                <p className="recommendation-text" style={{ color: data.lastAction.reason === 'auto-protection' ? '#FF4D4F' : '#E4E9F0' }}>
                  {data.lastAction.type} — reason: {data.lastAction.reason} · {new Date(data.lastAction.timestamp).toLocaleTimeString()}
                </p>
              ) : (
                <p className="empty-state">no actions taken this session</p>
              )}

              {events.length > 0 && (
                <div className="alerts-feed" style={{ marginTop: '0.75rem', maxHeight: '160px' }}>
                  {events.map((ev, i) => (
                    <div key={i} className="alert-item">
                      <div className="alert-meta">
                        {new Date(ev.timestamp).toLocaleTimeString()} · {ev.type} · {ev.reason}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Controlled Fault Injection Demo */}
            <div className="panel demo-panel" style={{ marginBottom: '1.25rem' }}>
              <p className="panel-title">
                <span>CONTROLLED DEMO FAULT</span>
                <span>{demoMode === 'normal' ? 'REAL TELEMETRY' : 'SIMULATION ACTIVE'}</span>
              </p>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', padding: '0.5rem 0 0.75rem' }}>
                <button onClick={() => setDemoFault('normal')} disabled={demoLoading} className="demo-btn demo-btn-normal">
                  🟢 NORMAL
                </button>
                <button onClick={() => setDemoFault('anomaly')} disabled={demoLoading} className="demo-btn demo-btn-anomaly">
                  🟠 SIMULATE ABNORMAL LOAD
                </button>
                <button onClick={() => setDemoFault('overload')} disabled={demoLoading} className="demo-btn demo-btn-overload">
                  🔴 SIMULATE OVERLOAD
                </button>
                <button onClick={() => setDemoFault('clear')} disabled={demoLoading} className="demo-btn demo-btn-clear">
                  ↻ CLEAR FAULT
                </button>
              </div>

              <div className="empty-state" style={{ fontSize: '0.72rem' }}>
                Controlled digital fault injection for safe system validation.
                Physical ESP32/PZEM telemetry remains unchanged in NORMAL mode.
              </div>
            </div>

            {/* Main grid: chart + twin | alerts */}
            <div className="main-grid">
              <div>
                <div className="panel">
                  <p className="panel-title">
                    <span>ENERGY FLOW</span>
                    <span>SOLAR/BATTERY (RIGHT) · GRID/LOAD (LEFT)</span>
                  </p>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={history}>
                      <CartesianGrid stroke="#1B222C" strokeDasharray="3 3" />
                      <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#6B7684' }} axisLine={{ stroke: '#232B36' }} tickLine={false} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#6B7684' }} axisLine={{ stroke: '#232B36' }} tickLine={false} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#6B7684' }} axisLine={{ stroke: '#232B36' }} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: '#161C26', border: '1px solid #232B36', borderRadius: 6, fontFamily: 'IBM Plex Mono', fontSize: 12 }}
                        labelStyle={{ color: '#97A2B0' }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
                      <Line yAxisId="right" type="monotone" dataKey="solar" name="Solar" stroke="#FFB020" strokeWidth={2} dot={false} isAnimationActive={false} />
                      <Line yAxisId="right" type="monotone" dataKey="battery" name="Battery" stroke="#3DD68C" strokeWidth={2} dot={false} isAnimationActive={false} />
                      <Line yAxisId="left" type="monotone" dataKey="grid" name="Grid" stroke="#FF4D4F" strokeWidth={2} dot={false} isAnimationActive={false} />
                      <Line yAxisId="left" type="monotone" dataKey="load" name="Load" stroke="#4C9AFF" strokeWidth={2} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="panel">
                  <p className="panel-title">
                    <span>DIGITAL TWIN</span>
                    <span>3D · ENERGY FLOW</span>
                  </p>
                  <DigitalTwin data={data} />
                </div>
              </div>

              <div>
                <div className="panel">
                  <p className="panel-title">
                    <span>ALERTS</span>
                    <span>{alerts.length} LOGGED</span>
                  </p>
                  <div className="alerts-feed">
                    {alerts.length === 0 ? (
                      <p className="empty-state">no anomalies logged this session</p>
                    ) : (
                      alerts.map((alert, i) => (
                        <div key={i} className="alert-item">
                          <div className="alert-head">⚠ anomaly · risk {alert.score}</div>
                          <div className="alert-meta">{alert.time} · {alert.power}W · {alert.voltage}V</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, unit }) {
  return (
    <div className="kpi">
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">{value}<span className="unit">{unit}</span></p>
    </div>
  );
}

export default App;