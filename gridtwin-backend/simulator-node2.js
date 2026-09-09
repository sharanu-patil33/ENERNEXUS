require('dotenv').config();
const mqtt = require('mqtt');

const connectUrl = `mqtts://${process.env.MQTT_URL}:${process.env.MQTT_PORT}`;

const client = mqtt.connect(connectUrl, {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
});

client.on('connect', () => {
  console.log('🔋 Node 2 (Solar/Battery) simulator connected to HiveMQ');

  let batteryVoltage = 3.1; // start low to test grid draw

  setInterval(() => {
    // Simulate solar output swinging with "time of day" randomness
    const solarVoltage = +(Math.max(0, 4 + Math.random() * 2 - 1)).toFixed(2);
    const isCharging = solarVoltage > 3;

    // Battery slowly charges or drains depending on solar
    batteryVoltage += isCharging ? 0.01 : -0.005;
    batteryVoltage = Math.min(4.2, Math.max(3.0, batteryVoltage));

    const reading = {
      solarVoltage,
      batteryVoltage: +batteryVoltage.toFixed(2),
      isCharging,
    };

    client.publish('gridtwin/backup/data', JSON.stringify(reading));
    console.log('📤 Node 2 sent:', reading);
  }, 2000);
});

client.on('error', (err) => console.error('❌ Node 2 simulator error:', err));