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
  relayAutoOff: false,
  forecast: null,
  timestamp: null
};

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

      // Log solar reading to AI service for forecasting
      axios.post('http://127.0.0.1:6000/log_solar', { solarVoltage: data.solarVoltage })
        .catch(() => {}); // don't crash if AI service is briefly down

      // Fetch latest forecast alongside
      try {
        const forecastRes = await axios.get('http://127.0.0.1:6000/forecast_solar');
        energyState.forecast = forecastRes.data;
      } catch (e) {
        // leave previous forecast value if service unreachable
      }

      console.log('🔋 Node 2 update:', data);

      io.emit('sensorData', energyState);
      return;
    }

    // ---------- Node 1: Grid / Load ----------
    console.log('📩 Received:', data);

    let aiResult = { anomaly: false, score: 0 };
    try {
      const response = await axios.post('http://127.0.0.1:6000/predict', data);
      aiResult = response.data;
      console.log('🧠 AI result:', aiResult);
    } catch (aiErr) {
      console.error('⚠️ AI service unreachable, using default:', aiErr.message);
    }

    energyState.voltage = data.voltage;
    energyState.current = data.current;
    energyState.power = data.power;
    energyState.temperature = data.temperature;
    energyState.anomaly = aiResult.anomaly;
    energyState.score = aiResult.score;
    energyState.timestamp = new Date();

    energyState.batterySOC = voltageToSOC(energyState.batteryVoltage);
    energyState.decision = decideEnergyStrategy(energyState);

    const shouldShed = aiResult.anomaly || (energyState.batterySOC <= 20 && energyState.solarVoltage < 1);

    if (shouldShed) {
      client.publish('lab/sensor1/control', JSON.stringify({ relay: 'off' }));
      console.log('🔌⚠️ AUTO LOAD-SHED triggered — relay OFF command sent');
      energyState.relayAutoOff = true;
    } else {
      energyState.relayAutoOff = false;
    }

    const newReading = new Reading({ ...data, ...aiResult });
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
          <p><b>Voltage:</b> ${data.voltage} V</p>
          <p><b>Current:</b> ${data.current} A</p>
          <p><b>Power:</b> ${data.power} W</p>
          <p><b>Temperature:</b> ${data.temperature} °C</p>
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

// REST endpoint: relay control from dashboard
app.post('/api/relay/:state', (req, res) => {
  const state = req.params.state;
  client.publish('lab/sensor1/control', JSON.stringify({ relay: state }));
  console.log(`🔌 Relay command sent: ${state}`);
  res.json({ success: true, state });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});