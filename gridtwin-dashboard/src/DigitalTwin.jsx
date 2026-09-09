import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';

function EquipmentBox({ position, label, status, valueLabel }) {
  const color = status === 'fault' ? '#FF4D4F' : status === 'high' ? '#FFB020' : '#3DD68C';

  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.15} />
      </mesh>
      <Text position={[0, 0.9, 0]} fontSize={0.22} color="#E4E9F0" anchorX="center" anchorY="middle">
        {label}
      </Text>
      {valueLabel && (
        <Text position={[0, -0.75, 0]} fontSize={0.2} color="#6B7684" anchorX="center" anchorY="middle">
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
        <planeGeometry args={[12, 10]} />
        <meshStandardMaterial color="#161C26" />
      </mesh>
      <gridHelper args={[12, 24, '#232B36', '#1B222C']} position={[0, -0.49, 0]} />
    </>
  );
}

// Status for the Campus Load box — reflects anomaly / high-load state
function getLoadStatus(data) {
  if (!data) return 'normal';
  if (data.anomaly) return 'fault';
  if (data.power > 600) return 'high';
  return 'normal';
}

// Status for the Grid Connection box — active (amber) only when grid is actually supplying power
function getGridStatus(data) {
  if (!data) return 'normal';
  const gridDraw = data.decision?.grid ?? 0;
  return gridDraw > 0 ? 'high' : 'normal';
}

// Status for the Battery box — red if critically low, amber if mid, green if healthy
function getBatteryStatus(data) {
  if (!data) return 'normal';
  if (data.batterySOC <= 20) return 'fault';
  if (data.batterySOC <= 50) return 'high';
  return 'normal';
}

function DigitalTwin({ data }) {
  const loadStatus = getLoadStatus(data);
  const gridStatus = getGridStatus(data);
  const batteryStatus = getBatteryStatus(data);

  return (
    <div style={{ width: '100%', height: '340px', borderRadius: '6px', overflow: 'hidden', background: '#0D1219' }}>
      <Canvas camera={{ position: [6, 4, 6], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={0.7} />
        <pointLight position={[-3, 3, -3]} intensity={0.3} color="#4C9AFF" />

        <Room />

        <EquipmentBox
          position={[-3, 0, 0]}
          label="SOLAR PANEL"
          status="normal"
          valueLabel={data ? `${(data.solarVoltage * 0.5).toFixed(1)} W` : ''}
        />
        <EquipmentBox
          position={[-1, 0, 0]}
          label="BATTERY"
          status={batteryStatus}
          valueLabel={data ? `${data.batterySOC}% SOC` : ''}
        />
        <EquipmentBox
          position={[1, 0, 0]}
          label="GRID CONNECTION"
          status={gridStatus}
          valueLabel={data ? `${(data.decision?.grid ?? 0).toFixed(1)} W` : ''}
        />
        <EquipmentBox
          position={[3, 0, 0]}
          label="CAMPUS LOAD"
          status={loadStatus}
          valueLabel={data ? `${data.power} W` : ''}
        />

        <OrbitControls autoRotate autoRotateSpeed={0.5} />
      </Canvas>
    </div>
  );
}

export default DigitalTwin;