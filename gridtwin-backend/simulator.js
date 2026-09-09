require('dotenv').config();
const mqtt = require('mqtt');

const connectUrl = `mqtts://${process.env.MQTT_URL}:${process.env.MQTT_PORT}`;

const client = mqtt.connect(connectUrl, {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
});

client.on('connect', () => {
  console.log('🤖 Simulator connected to HiveMQ (pretending to be ESP32)');

  let count = 0;

  // Publish a reading every 2 seconds
  setInterval(() => {
    count++;
    let fakeReading;

    if (count === 10) {
      // 🔴 Deliberate fault reading — proves the AI model catches real anomalies
      fakeReading = {
        voltage: 260,       // way higher than normal (~225-235V range)
        current: 8.5,       // way higher than normal (~1.5-3.5A range)
        power: +(260 * 8.5).toFixed(1),
        temperature: 45,    // way higher than normal (~25-31°C range)
      };
      console.log('⚡ INJECTING FAULT READING NOW');
    } else {
      fakeReading = {
        voltage: +(225 + Math.random() * 10).toFixed(1),
        current: +(1.5 + Math.random() * 2).toFixed(2),
        power: 0,
        temperature: +(25 + Math.random() * 6).toFixed(1),
      };
      fakeReading.power = +(fakeReading.voltage * fakeReading.current).toFixed(1);
    }

    client.publish('lab/sensor1/data', JSON.stringify(fakeReading));
    console.log('📤 Sent reading:', fakeReading);
  }, 2000);
});

client.on('error', (err) => console.error('❌ Simulator error:', err));