import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import DigitalTwin from './DigitalTwin';
import AnimatedBackground from './AnimatedBackground';
import './App.css';

const socket = io('http://localhost:5000');
const BACKEND_URL = 'http://localhost:5000';
const MAX_POINTS = 30;
const MAX_ALERTS = 10;

function App() {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [connected, setConnected] = useState(false);
  const [relayOn, setRelayOn] = useState(true);
  const [relayLoading, setRelayLoading] = useState(false);
  const [relayError, setRelayError] = useState(null);

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

  const isAnomaly = data?.anomaly === true;
  const isShed = data?.relayAutoOff === true;

  // ---------- Relay control: actually talks to the backend now ----------
  const handleRelayToggle = async () => {
    const newState = relayOn ? 'off' : 'on';
    setRelayLoading(true);
    setRelayError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/relay/${newState}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`Backend responded ${res.status}`);
      setRelayOn(!relayOn);
    } catch (err) {
      console.error('Failed to send relay command:', err);
      setRelayError('Relay command failed — check backend connection');
    } finally {
      setRelayLoading(false);
    }
  };

  return (
    <div className="twin-root">
      <AnimatedBackground />
      <div className="page-content">
        {/* Status bar */}
        <header className="status-bar">
          <div className="brand">
            <div className="brand-logo-icon" />
            <div>
              <span className="brand-mark">GridTwin AI</span>
              <span className="brand-sub">CAMPUS ENERGY · NODE 01 + 02</span>
            </div>
          </div>
          <div className="status-right">
            <div className={`connection-badge ${connected ? 'online' : 'offline'}`}>
              <span className="live-dot" />
              <span>{connected ? 'LIVE TELEMETRY' : 'DISCONNECTED'}</span>
            </div>
            <div className="time-badge">{new Date().toLocaleTimeString()}</div>
          </div>
        </header>

        {!data ? (
          <div className="waiting-container">
            <div className="pulse-loader" />
            <p className="waiting">Awaiting first telemetry packet...</p>
          </div>
        ) : (
          <>
            {isAnomaly && (
              <div className="anomaly-banner fault">
                <div className="banner-left">
                  <span className="tag">FAULT</span>
                  <span className="msg">Anomaly detected in Load — automatic classification by onboard model</span>
                </div>
                <span className="score">CONFIDENCE SCORE: <strong>{data.score}</strong></span>
              </div>
            )}

            {isShed && !isAnomaly && (
              <div className="anomaly-banner shed">
                <div className="banner-left">
                  <span className="tag">SHED</span>
                  <span className="msg">Battery critically low with no solar backup — load automatically cut to protect battery</span>
                </div>
              </div>
            )}

            {/* Energy KPI strip */}
            <div className="kpi-strip">
              <Kpi label="SOLAR GENERATION" value={(data.solarVoltage * 0.5).toFixed(1)} unit="W" type="solar" />
              <Kpi label="BATTERY SOC" value={data.batterySOC} unit="%" type="battery" />
              <Kpi label="GRID DRAW" value={data.decision?.grid?.toFixed(1) ?? '0.0'} unit="W" type="grid" />
              <Kpi label="CAMPUS LOAD" value={data.power} unit="W" type="load" />
              <div className={`kpi status-kpi ${isAnomaly ? 'status-fault' : 'status-normal'}`}>
                <p className="kpi-label">SYSTEM HEALTH</p>
                <div className="status-indicator">
                  <span className="status-dot" />
                  <p className="kpi-value">{isAnomaly ? 'FAULT' : 'OPTIMAL'}</p>
                </div>
              </div>
            </div>

            {/* AI Recommendation + Forecast */}
            <div className="top-insights-grid">
              <div className="panel insight-panel glow-amber">
                <div className="panel-header">
                  <span className="panel-title">AI RECOMMENDATION</span>
                  <span className="panel-badge">RULE ENGINE v2.4</span>
                </div>
                <div className="recommendation-box">
                  <div className="spark-icon">⚡</div>
                  <p className="recommendation-text">
                    {data.decision?.action ?? 'Calculating grid optimization strategy...'}
                  </p>
                </div>
              </div>

              <div className="panel insight-panel">
                <div className="panel-header">
                  <span className="panel-title">SOLAR FORECAST</span>
                  <span className="panel-badge">MOVING AVG</span>
                </div>
                {data.forecast?.predicted_30min != null ? (
                  <div className="forecast-row">
                    <div className="forecast-item">
                      <p className="kpi-label">NEXT 30 MIN</p>
                      <p className="forecast-value">{data.forecast.predicted_30min}<span className="unit">V</span></p>
                    </div>
                    <div className="forecast-divider" />
                    <div className="forecast-item">
                      <p className="kpi-label">NEXT 2 HOURS</p>
                      <p className="forecast-value">{data.forecast.predicted_2hr}<span className="unit">V</span></p>
                    </div>
                  </div>
                ) : (
                  <p className="empty-state">Gathering forecast telemetry...</p>
                )}
              </div>
            </div>

            {/* Relay Control Panel */}
            <div className="panel relay-panel">
              <div className="relay-row">
                <div className="relay-info">
                  <div className="relay-header">
                    <span className="panel-title">MAIN CIRCUIT RELAY</span>
                    <span className={`relay-pill ${relayOn ? 'on' : 'off'}`}>
                      {relayOn ? 'ACTIVE' : 'ISOLATED'}
                    </span>
                  </div>
                  <span className="relay-state">
                    Circuit Status: <b className={relayOn ? 'on' : 'off'}>{relayOn ? 'ENERGIZED' : 'DE-ENERGIZED'}</b>
                  </span>
                  {relayError && <span className="relay-error">{relayError}</span>}
                </div>
                <button
                  className={`relay-btn ${relayOn ? 'cut' : 'restore'}`}
                  onClick={handleRelayToggle}
                  disabled={relayLoading}
                >
                  <span className="btn-icon">{relayOn ? '⏻' : '⚡'}</span>
                  {relayLoading ? 'SENDING...' : relayOn ? 'CUT POWER' : 'RESTORE POWER'}
                </button>
              </div>
            </div>

            {/* Main grid: Chart + Twin | Alerts */}
            <div className="main-grid">
              <div className="left-column">
                <div className="panel chart-panel">
                  <div className="panel-header">
                    <span className="panel-title">REAL-TIME ENERGY FLOW</span>
                    <span className="panel-sub-label">SOLAR/BATTERY (RIGHT) · GRID/LOAD (LEFT)</span>
                  </div>
                  <div className="chart-wrapper">
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid stroke="#1A2332" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={{ stroke: '#1E293B' }} tickLine={false} />
                        <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={{ stroke: '#1E293B' }} tickLine={false} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={{ stroke: '#1E293B' }} tickLine={false} />
                        <Tooltip
                          contentStyle={{ background: '#0F172A', border: '1px solid #334155', borderRadius: '8px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)', fontFamily: 'IBM Plex Mono', fontSize: '12px' }}
                          labelStyle={{ color: '#94A3B8', fontWeight: '600', marginBottom: '4px' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'IBM Plex Mono', paddingTop: '10px' }} />
                        <Line yAxisId="right" type="monotone" dataKey="solar" name="Solar" stroke="#F59E0B" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                        <Line yAxisId="right" type="monotone" dataKey="battery" name="Battery" stroke="#10B981" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                        <Line yAxisId="left" type="monotone" dataKey="grid" name="Grid" stroke="#EF4444" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                        <Line yAxisId="left" type="monotone" dataKey="load" name="Load" stroke="#3B82F6" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="panel twin-panel">
                  <div className="panel-header">
                    <span className="panel-title">3D DIGITAL TWIN</span>
                    <span className="panel-badge">LIVE SPATIAL MODEL</span>
                  </div>
                  <div className="digital-twin-container">
                    <DigitalTwin data={data} />
                  </div>
                </div>
              </div>

              <div className="right-column">
                <div className="panel alerts-panel">
                  <div className="panel-header">
                    <span className="panel-title">SYSTEM ALERTS</span>
                    <span className="alert-count-tag">{alerts.length} LOGGED</span>
                  </div>
                  <div className="alerts-feed">
                    {alerts.length === 0 ? (
                      <div className="empty-alerts">
                        <span className="check-icon">✓</span>
                        <p className="empty-state">No anomalies detected in current session</p>
                      </div>
                    ) : (
                      alerts.map((alert, i) => (
                        <div key={i} className="alert-item">
                          <div className="alert-head">
                            <span className="alert-badge">ANOMALY</span>
                            <span className="alert-score">SCORE {alert.score}</span>
                          </div>
                          <div className="alert-metrics">
                            <span><b>Power:</b> {alert.power}W</span>
                            <span><b>Voltage:</b> {alert.voltage}V</span>
                          </div>
                          <div className="alert-time">{alert.time}</div>
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

function Kpi({ label, value, unit, type }) {
  return (
    <div className={`kpi kpi-type-${type}`}>
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">
        {value}
        <span className="unit">{unit}</span>
      </p>
    </div>
  );
}

export default App;