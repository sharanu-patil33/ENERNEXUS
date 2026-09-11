import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';

function EquipmentBox({ position, label, status, valueLabel }) {
  const color = status === 'fault' ? '#FF4D4F' : status === 'off' ? '#4B5563' : status === 'high' ? '#FFB020' : '#3DD68C';

  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.15} />
      </mesh>
      <Text position={[0, 0.9, 0]} fontSize={0.2} color="#E4E9F0" anchorX="center" anchorY="middle">
        {label}
      </Text>
      {valueLabel && (
        <Text position={[0, -0.75, 0]} fontSize={0.18} color="#6B7684" anchorX="center" anchorY="middle">
          {valueLabel}
        </Text>
      )}
    </group>
  );
}

function Room() {
  return (
    <>
      <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[14, 10]} />
        <meshStandardMaterial color="#161C26" />
      </mesh>
      <gridHelper args={[14, 28, '#232B36', '#1B222C']} position={[0, -0.49, 0]} />
    </>
  );
}

function getGridStatus(data) {
  if (!data) return 'normal';
  const gridDraw = data.decision?.grid ?? 0;
  return gridDraw > 0 ? 'high' : 'normal';
}

function getBatteryStatus(data) {
  if (!data) return 'normal';
  if (data.batterySOC <= 20) return 'fault';
  if (data.batterySOC <= 50) return 'high';
  return 'normal';
}

// CH1 — Old Load: reflects its own on/off state, and turns red only if it's ever cut
function getCh1Status(data) {
  if (!data) return 'normal';
  if (data.relays?.ch1 === 'off') return 'off';
  return 'normal';
}

// CH2 — New Load: this is the channel the AI actually protects, so it reflects anomaly + auto-shed
function getCh2Status(data) {
  if (!data) return 'normal';
  if (data.relays?.ch2 === 'off') return data.anomaly ? 'fault' : 'off';
  if (data.anomaly) return 'fault';
  return 'normal';
}

function DigitalTwin({ data }) {
  const gridStatus = getGridStatus(data);
  const batteryStatus = getBatteryStatus(data);
  const ch1Status = getCh1Status(data);
  const ch2Status = getCh2Status(data);

  return (
    <div style={{ width: '100%', height: '340px', borderRadius: '6px', overflow: 'hidden', background: '#0D1219' }}>
      <Canvas camera={{ position: [7, 4.5, 7], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={0.7} />
        <pointLight position={[-3, 3, -3]} intensity={0.3} color="#4C9AFF" />

        <Room />

        <EquipmentBox
          position={[-4, 0, 0]}
          label="SOLAR PANEL"
          status="normal"
          valueLabel={data ? (data.solarVoltage > 2 ? 'AVAILABLE' : 'LOW') : ''}
        />
        <EquipmentBox
          position={[-2, 0, 0]}
          label="BATTERY"
          status={batteryStatus}
          valueLabel={data ? `${data.batterySOC}% SOC` : ''}
        />
        <EquipmentBox
          position={[0, 0, 0]}
          label="GRID CONNECTION"
          status={gridStatus}
          valueLabel={data ? `${(data.decision?.grid ?? 0).toFixed(1)} W` : ''}
        />
        <EquipmentBox
          position={[2, 0, 0]}
          label="CH1 · OLD LOAD"
          status={ch1Status}
          valueLabel={data?.relays?.ch1 === 'off' ? 'OFF' : `${data?.power ?? 0} W`}
        />
        <EquipmentBox
          position={[4, 0, 0]}
          label="CH2 · NEW LOAD"
          status={ch2Status}
          valueLabel={data?.relays?.ch2 === 'off' ? 'PROTECTED-OFF' : 'ON'}
        />

        <OrbitControls autoRotate autoRotateSpeed={0.4} />
      </Canvas>
    </div>
  );
}

export default DigitalTwin;