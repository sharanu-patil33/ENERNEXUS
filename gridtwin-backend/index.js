require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mqtt = require('mqtt');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

const readingSchema = new mongoose.Schema({
  voltage: Number,
  current: Number,
  power: Number,
  temperature: Number,
  anomaly: Boolean,
  score: Number,
  timestamp: { type: Date, default: Date.now }
});
const Reading = mongoose.model('Reading', readingSchema);

// ---------- Combined live state from both nodes ----------
let energyState = {
  solarVoltage: 0,
  batteryVoltage: 0,
  isCharging: false,
  batterySOC: 0,
  voltage: 0,
  current: 0,
  power: 0,
  temperature: 0,
  anomaly: false,
  score: 0,
  decision: null,
  relays: { ch1: 'on', ch2: 'on' }, // ch1 = Old Load, ch2 = New Load
  lastAction: null,
  forecast: null,
  timestamp: null
};

// In-memory event log — last 20 events
let eventLog = [];

function logEvent(type, reason) {
  eventLog.unshift({ type, reason, timestamp: new Date() });
  if (eventLog.length > 20) eventLog = eventLog.slice(0, 20);
}

// ---------- Controlled fault-injection demo mode ----------
let demoFaultMode = null;

function applyDemoFault(data) {
  if (demoFaultMode === 'anomaly') {
    return {
      ...data,
      voltage: 230,
      current: 0.29,
      power: 67,
      temperature: data.temperature ?? 28
    };
  }

  if (demoFaultMode === 'overload') {
    return {
      ...data,
      voltage: 230,
      current: 2.0,
      power: 460,
      temperature: 35
    };
  }

  return data;
}

function voltageToSOC(voltage) {
  if (voltage >= 4.2) return 100;
  if (voltage <= 3.0) return 0;
  return Math.round(((voltage - 3.0) / (4.2 - 3.0)) * 100);
}

function decideEnergyStrategy(state) {
  const solarPower = state.solarVoltage * 0.5;
  const loadPower = state.power;
  const batterySOC = state.batterySOC;

  if (solarPower >= loadPower) {
    return {
      solar: loadPower,
      battery: 0,
      grid: 0,
      action: "Full solar coverage — battery charging with surplus"
    };
  } else if (batterySOC > 20) {
    const deficit = loadPower - solarPower;
    return {
      solar: solarPower,
      battery: deficit,
      grid: 0,
      action: "Solar + battery covering full load"
    };
  } else {
    return {
      solar: solarPower,
      battery: 0,
      grid: loadPower - solarPower,
      action: "Battery low — drawing from grid to protect battery"
    };
  }
}

// Matches the ESP32 firmware's expected control message shape exactly:
// {"channel": "ch1"/"ch2"/"all", "relay": "on"/"off"}
function publishChannelCommand(channel, state) {
  client.publish('lab/sensor1/control', JSON.stringify({
    channel: channel,
    relay: state
  }));
}

const connectUrl = `mqtts://${process.env.MQTT_URL}:${process.env.MQTT_PORT}`;
const client = mqtt.connect(connectUrl, {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
});

client.on('connect', () => {
  console.log('✅ Connected to HiveMQ broker!');
  client.subscribe('lab/sensor1/data', (err) => {
    if (!err) console.log('📡 Subscribed to lab/sensor1/data (Node 1)');
  });
  client.subscribe('gridtwin/backup/data', (err) => {
    if (!err) console.log('📡 Subscribed to gridtwin/backup/data (Node 2)');
  });
});

client.on('message', async (topic, message) => {
  try {
    const data = JSON.parse(message.toString());

    // ---------- Node 2: Solar / Battery ----------
    if (topic === 'gridtwin/backup/data') {
      energyState.solarVoltage = data.solarVoltage;
      energyState.batteryVoltage = data.batteryVoltage;
      energyState.isCharging = data.isCharging;
      energyState.timestamp = new Date();

      energyState.batterySOC = voltageToSOC(energyState.batteryVoltage);
      energyState.decision = decideEnergyStrategy(energyState);

      axios.post('http://127.0.0.1:6000/log_solar', { solarVoltage: data.solarVoltage })
        .catch(() => {});

      try {
        const forecastRes = await axios.get('http://127.0.0.1:6000/forecast_solar');
        energyState.forecast = forecastRes.data;
      } catch (e) {}

      console.log('🔋 Node 2 update:', data);

      io.emit('sensorData', energyState);
      return;
    }

    // ---------- Node 1: Grid / Load ----------
    console.log('📩 Received:', data);

    // Firmware also reports its own relay states — sync them into energyState
    if (data.relay1) energyState.relays.ch1 = data.relay1;
    if (data.relay2) energyState.relays.ch2 = data.relay2;

    const processedData = applyDemoFault(data);

    if (demoFaultMode) {
      console.log(`🧪 DEMO MODE ACTIVE: ${demoFaultMode}`);
      console.log('🧪 AI input:', processedData);
    }

    let aiResult = { anomaly: false, score: 0 };
    try {
      const response = await axios.post('http://127.0.0.1:6000/predict', processedData);
      aiResult = response.data;
      console.log('🧠 AI result:', aiResult);
    } catch (aiErr) {
      console.error('⚠️ AI service unreachable, using default:', aiErr.message);
    }

    energyState.voltage = processedData.voltage;
    energyState.current = processedData.current;
    energyState.power = processedData.power;
    energyState.temperature = processedData.temperature;
    energyState.anomaly = aiResult.anomaly;
    energyState.score = aiResult.score;
    energyState.timestamp = new Date();

    energyState.batterySOC = voltageToSOC(energyState.batteryVoltage);
    energyState.decision = decideEnergyStrategy(energyState);

    const shouldShed = aiResult.anomaly || (energyState.batterySOC <= 20 && energyState.solarVoltage < 1);

    if (shouldShed && energyState.relays.ch2 !== 'off') {
      energyState.relays.ch2 = 'off';
      publishChannelCommand('ch2', 'off');
      energyState.lastAction = { type: 'ch2 off', reason: 'auto-protection', timestamp: new Date() };
      logEvent('ch2 off', 'auto-protection');
      console.log('🔌⚠️ AUTO LOAD-SHED triggered — ch2 OFF, ch1 remains ON');
    }

    const newReading = new Reading({ ...processedData, ...aiResult });
    await newReading.save();
    console.log('💾 Saved to MongoDB!');

    io.emit('sensorData', energyState);
    console.log('📡 Broadcasted merged energyState to dashboard');

    if (aiResult.anomaly) {
      resend.emails.send({
        from: 'GridTwin Alerts <onboarding@resend.dev>',
        to: process.env.ALERT_EMAIL,
        subject: '🚨 GridTwin AI — Anomaly Detected!',
        html: `
          <h2>⚠️ Anomaly Detected</h2>
          <p><b>Score:</b> ${aiResult.score}</p>
          <p><b>Voltage:</b> ${processedData.voltage} V</p>
          <p><b>Current:</b> ${processedData.current} A</p>
          <p><b>Power:</b> ${processedData.power} W</p>
          <p><b>Temperature:</b> ${processedData.temperature} °C</p>
          <p><b>Time:</b> ${new Date().toLocaleString()}</p>
        `
      }).then(() => {
        console.log('📧 Alert email sent!');
      }).catch((err) => {
        console.error('❌ Email failed:', err.message);
      });
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
});

client.on('error', (err) => console.error('❌ MQTT error:', err));

io.on('connection', (socket) => {
  console.log('🖥️  A dashboard connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('🖥️  Dashboard disconnected:', socket.id);
  });
});

// REST endpoint: channel-specific relay control from dashboard
app.post('/api/relay/:channel/:state', (req, res) => {
  const { channel, state } = req.params; // channel: "ch1" or "ch2"
  if (!['ch1', 'ch2'].includes(channel) || !['on', 'off'].includes(state)) {
    return res.status(400).json({ success: false, error: 'Invalid channel or state' });
  }

  energyState.relays[channel] = state;
  publishChannelCommand(channel, state);
  energyState.lastAction = { type: `${channel} ${state}`, reason: 'manual', timestamp: new Date() };
  logEvent(`${channel} ${state}`, 'manual');

  console.log(`🔌 Manual relay command: ${channel} → ${state}`);
  res.json({ success: true, channel, state });
});

// REST endpoint: event log
app.get('/api/events', (req, res) => {
  res.json(eventLog);
});

// ---------- DEMO FAULT INJECTION ----------

app.post('/api/demo/normal', (req, res) => {
  demoFaultMode = null;
  console.log('🟢 DEMO MODE: NORMAL / REAL TELEMETRY');
  res.json({ success: true, mode: 'normal' });
});

app.post('/api/demo/anomaly', (req, res) => {
  demoFaultMode = 'anomaly';
  console.log('🟠 DEMO MODE: ABNORMAL LOAD');
  res.json({ success: true, mode: 'anomaly' });
});

app.post('/api/demo/overload', (req, res) => {
  demoFaultMode = 'overload';
  console.log('🔴 DEMO MODE: OVERLOAD');
  res.json({ success: true, mode: 'overload' });
});

app.post('/api/demo/clear', (req, res) => {
  demoFaultMode = null;
  energyState.relays.ch1 = 'on';
  energyState.relays.ch2 = 'on';
  publishChannelCommand('all', 'on');
  energyState.lastAction = { type: 'both channels restored', reason: 'demo-clear', timestamp: new Date() };
  logEvent('both channels restored', 'demo-clear');
  console.log('🟢 DEMO FAULT CLEARED — both relays ON');
  res.json({ success: true, mode: 'normal' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});