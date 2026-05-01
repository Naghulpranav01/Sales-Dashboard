import { Canvas, useFrame } from "@react-three/fiber";
import { Line, Text } from "@react-three/drei";
import { Suspense, useMemo, useRef, useState } from "react";

function useDeviceProfile() {
  const width = typeof window === "undefined" ? 1200 : window.innerWidth;
  if (width < 640) return { nodes: 7, camera: [0, 2.2, 8], speed: 0.16, labelScale: 0.55 };
  if (width < 1024) return { nodes: 11, camera: [0, 2, 7], speed: 0.22, labelScale: 0.7 };
  return { nodes: 18, camera: [0, 1.8, 6.2], speed: 0.32, labelScale: 0.9 };
}

function MetricPanel({ position, title, value, active }) {
  const ref = useRef();
  const [hovered, setHovered] = useState(false);

  useFrame(({ clock, mouse }) => {
    if (!ref.current) return;
    ref.current.rotation.y = mouse.x * 0.12 + (hovered ? 0.08 : 0);
    ref.current.rotation.x = -mouse.y * 0.06;
    ref.current.position.y = position[1] + Math.sin(clock.elapsedTime * 1.2 + position[0]) * 0.05;
  });

  return (
    <group
      ref={ref}
      position={position}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      scale={hovered ? 1.06 : 1}
    >
      <mesh>
        <boxGeometry args={[2.1, 1.05, 0.08]} />
        <meshStandardMaterial color={active ? "#18322b" : "#1b211f"} emissive={hovered ? "#14b88a" : "#000000"} />
      </mesh>
      <Text position={[0, 0.18, 0.08]} fontSize={0.13} color="#dfe8e3" anchorX="center">
        {title}
      </Text>
      <Text position={[0, -0.12, 0.08]} fontSize={0.22} color="#14b88a" anchorX="center">
        {value}
      </Text>
    </group>
  );
}

function DataNetwork({ analytics }) {
  const profile = useDeviceProfile();
  const group = useRef();
  const nodes = useMemo(() => {
    const regions = analytics?.byRegion?.slice(0, profile.nodes) || [];
    return regions.map((item, index) => {
      const angle = (index / Math.max(regions.length, 1)) * Math.PI * 2;
      const radius = 1.3 + Math.min(2.2, item.contribution / 22);
      return {
        label: item.region,
        value: item.contribution,
        position: [Math.cos(angle) * radius, Math.sin(angle * 1.4) * 0.6, Math.sin(angle) * radius]
      };
    });
  }, [analytics, profile.nodes]);

  useFrame(({ clock }) => {
    if (group.current) group.current.rotation.y = clock.elapsedTime * profile.speed * 0.08;
  });

  return (
    <group ref={group} position={[0, -0.55, -0.4]}>
      {nodes.map((node, index) => (
        <group key={node.label} position={node.position}>
          <mesh>
            <sphereGeometry args={[0.08 + node.value / 600, 18, 18]} />
            <meshStandardMaterial color="#14b88a" emissive="#0b5f49" />
          </mesh>
          {index < 6 && (
            <Text position={[0, -0.22, 0]} fontSize={0.08 * profile.labelScale} color="#dfe8e3" anchorX="center">
              {node.label}
            </Text>
          )}
        </group>
      ))}
      {nodes.map((node, index) => (
        <Line
          key={`${node.label}-line`}
          points={[[0, 0, 0], node.position]}
          color="#14b88a"
          transparent
          opacity={0.5}
          lineWidth={1}
        />
      ))}
    </group>
  );
}

function Scene({ analytics }) {
  const group = useRef();
  const kpis = analytics?.kpis || {};

  useFrame(({ clock, mouse, camera }) => {
    camera.position.x += (mouse.x * 0.7 - camera.position.x) * 0.02;
    camera.position.y += (1.8 + mouse.y * 0.25 - camera.position.y) * 0.02;
    camera.lookAt(0, 0, 0);
    if (group.current) group.current.rotation.y = Math.sin(clock.elapsedTime * 0.4) * 0.08;
  });

  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight position={[4, 6, 4]} intensity={1.8} />
      <group ref={group}>
        <MetricPanel
          position={[-2.45, 1.2, 0]}
          title="Revenue"
          value={`$${Math.round((kpis.totalRevenue || 0) / 1000)}k`}
          active
        />
        <MetricPanel
          position={[0, 1.45, -0.35]}
          title="Profit Margin"
          value={`${kpis.profitMargin || 0}%`}
        />
        <MetricPanel
          position={[2.45, 1.2, 0]}
          title="MoM Growth"
          value={`${kpis.momGrowth || 0}%`}
        />
        <DataNetwork analytics={analytics} />
      </group>
    </>
  );
}

export default function ThreeControlRoom({ analytics }) {
  const profile = useDeviceProfile();

  return (
    <div className="control-room" aria-label="3D sales control room">
      <Canvas camera={{ position: profile.camera, fov: 45 }} dpr={[1, 1.6]} performance={{ min: 0.5 }}>
        <Suspense fallback={null}>
          <Scene analytics={analytics} />
        </Suspense>
      </Canvas>
    </div>
  );
}
