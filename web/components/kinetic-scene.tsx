"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Group, Points } from "three";
import * as THREE from "three";

function Barbell() {
  const group = useRef<Group>(null);
  const metal = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#c4a574",
        metalness: 0.92,
        roughness: 0.28,
      }),
    [],
  );
  const iron = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#1c1d20",
        metalness: 0.7,
        roughness: 0.35,
      }),
    [],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (group.current) {
      group.current.rotation.y = t * 0.12;
      group.current.rotation.z = Math.sin(t * 0.35) * 0.07;
      group.current.position.y = Math.sin(t * 0.8) * 0.12;
    }
  });

  return (
    <group ref={group} rotation={[0.35, 0.55, 0.08]} position={[1.4, 0.15, 0]} scale={1.15}>
      <mesh material={metal} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.08, 0.08, 5.1, 32]} />
      </mesh>
      {[-1.85, 1.85].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh material={iron}>
            <cylinderGeometry args={[0.72, 0.72, 0.14, 48]} />
          </mesh>
          <mesh material={iron} position={[x > 0 ? 0.18 : -0.18, 0, 0]}>
            <cylinderGeometry args={[0.58, 0.58, 0.16, 48]} />
          </mesh>
          <mesh material={iron} position={[x > 0 ? 0.34 : -0.34, 0, 0]}>
            <cylinderGeometry args={[0.46, 0.46, 0.12, 48]} />
          </mesh>
          <mesh material={metal} position={[x > 0 ? 0.48 : -0.48, 0, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.3, 24]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function PlateRack() {
  const iron = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#1a1b1e", metalness: 0.65, roughness: 0.4 }),
    [],
  );
  return (
    <group position={[-3.4, -1.35, -0.4]}>
      <mesh material={iron} position={[0, 0.7, 0]}>
        <boxGeometry args={[0.08, 1.4, 0.08]} />
      </mesh>
      {[0.35, 0.55, 0.7].map((r, i) => (
        <mesh key={r} material={iron} position={[0.02, 0.28 + i * 0.08, 0.12 * i]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[r, r, 0.09, 40]} />
        </mesh>
      ))}
    </group>
  );
}

function Dust() {
  const ref = useRef<Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(1800);
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] = (Math.random() - 0.5) * 14;
      arr[i + 1] = Math.random() * 8 - 2;
      arr[i + 2] = (Math.random() - 0.5) * 14;
    }
    return arr;
  }, []);
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.02;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.02} color="#c4a574" transparent opacity={0.35} />
    </points>
  );
}

function Rig() {
  useFrame((state) => {
    const scroll = typeof window === "undefined" ? 0 : Math.min(window.scrollY / 600, 1);
    state.camera.position.z = THREE.MathUtils.lerp(8, 5.2, scroll);
    state.camera.position.y = THREE.MathUtils.lerp(0.4, 0.9, scroll);
    state.camera.lookAt(0, 0, 0);
  });
  return null;
}

export function KineticScene() {
  const [reduced, setReduced] = useState(false);
  const [webgl, setWebgl] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    try {
      const canvas = document.createElement("canvas");
      const ok = Boolean(canvas.getContext("webgl") || canvas.getContext("webgl2"));
      setWebgl(ok);
    } catch {
      setWebgl(false);
    }
    return () => mq.removeEventListener("change", onChange);
  }, []);

  if (reduced || !webgl) {
    return <div className="hero-fallback" aria-hidden />;
  }

  return (
    <Canvas
      camera={{ position: [0.6, 0.35, 6.4], fov: 40 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#0b0c0e"]} />
      <fog attach="fog" args={["#0b0c0e", 8, 18]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 6, 3]} intensity={1.4} color="#f3e6c8" />
      <pointLight position={[-4, 2, -2]} intensity={0.6} color="#c4a574" />
      <Barbell />
      <PlateRack />
      <Dust />
      <Rig />
    </Canvas>
  );
}
