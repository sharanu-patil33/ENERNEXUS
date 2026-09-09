import { Canvas, useFrame } from '@react-three/fiber';
import { useRef, useMemo } from 'react';

function ParticleField({ count, color, radius, speed, size }) {
  const pointsRef = useRef();

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * radius * 2;
      arr[i * 3 + 1] = (Math.random() - 0.5) * radius * 1.2;
      arr[i * 3 + 2] = (Math.random() - 0.5) * radius * 2;
    }
    return arr;
  }, [count, radius]);

  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.elapsedTime * speed;
      pointsRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.04) * 0.08;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={size} color={color} transparent opacity={0.5} sizeAttenuation />
    </points>
  );
}

function AnimatedBackground() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    >
      <Canvas camera={{ position: [0, 0, 9], fov: 55 }}>
        <ParticleField count={220} color="#FFB020" radius={11} speed={0.025} size={0.045} />
        <ParticleField count={160} color="#4C9AFF" radius={14} speed={-0.015} size={0.035} />
      </Canvas>
    </div>
  );
}

export default AnimatedBackground;