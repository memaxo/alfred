import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

export type AgentState = null | "thinking" | "listening" | "talking";

interface OrbProps {
  colors?: [string, string];
  colorsRef?: React.RefObject<[string, string]>;
  resizeDebounce?: number;
  seed?: number;
  agentState?: AgentState;
  volumeMode?: "auto" | "manual";
  manualInput?: number;
  manualOutput?: number;
  inputVolumeRef?: React.RefObject<number>;
  outputVolumeRef?: React.RefObject<number>;
  getInputVolume?: () => number;
  getOutputVolume?: () => number;
  className?: string;
}

export function Orb({
  colors = ["#CADCFC", "#A0B9D1"],
  colorsRef,
  resizeDebounce = 100,
  seed,
  agentState = null,
  volumeMode = "auto",
  manualInput,
  manualOutput,
  inputVolumeRef,
  outputVolumeRef,
  getInputVolume,
  getOutputVolume,
  className,
}: OrbProps) {
  return (
    <div className={className ?? "relative h-full w-full"}>
      <Canvas
        gl={{
          alpha: true,
          antialias: true,
          premultipliedAlpha: true,
        }}
        resize={{ debounce: resizeDebounce }}
      >
        <Scene
          agentState={agentState}
          colors={colors}
          colorsRef={colorsRef}
          getInputVolume={getInputVolume}
          getOutputVolume={getOutputVolume}
          inputVolumeRef={inputVolumeRef}
          manualInput={manualInput}
          manualOutput={manualOutput}
          outputVolumeRef={outputVolumeRef}
          seed={seed}
          volumeMode={volumeMode}
        />
      </Canvas>
    </div>
  );
}

function Scene({
  colors,
  colorsRef,
  seed,
  agentState,
  volumeMode,
  manualInput,
  manualOutput,
  inputVolumeRef,
  outputVolumeRef,
  getInputVolume,
  getOutputVolume,
}: {
  colors: [string, string];
  colorsRef?: React.RefObject<[string, string]>;
  seed?: number;
  agentState: AgentState;
  volumeMode: "auto" | "manual";
  manualInput?: number;
  manualOutput?: number;
  inputVolumeRef?: React.RefObject<number>;
  outputVolumeRef?: React.RefObject<number>;
  getInputVolume?: () => number;
  getOutputVolume?: () => number;
}) {
  const { gl } = useThree();
  const circleRef =
    useRef<THREE.Mesh<THREE.CircleGeometry, THREE.ShaderMaterial>>(null);
  const initialColorsRef = useRef<[string, string]>(colors);
  // Kept for backward compat with props, though shader is now Eclipse-style (Biolum White)
  const targetColor1Ref = useRef(new THREE.Color(colors[0]));
  const targetColor2Ref = useRef(new THREE.Color(colors[1]));
  const animSpeedRef = useRef(0.1);
  const perlinNoiseTexture = useMemo(() => {
    // Avoid any external network fetches (E2E runs offline; build verification forbids CDN URLs).
    // Deterministic noise based on seed so visuals are stable in tests.
    const size = 128;
    const data = new Uint8Array(size * size * 4);
    const rand = splitmix32(seed ?? 0x6F_72_62); // "orb" seed
    for (let i = 0; i < data.length; i += 4) {
      const v = Math.floor(rand() * 256);
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }, [seed]);

  const agentRef = useRef<AgentState>(agentState);
  const modeRef = useRef<"auto" | "manual">(volumeMode);
  const manualInRef = useRef<number>(manualInput ?? 0);
  const manualOutRef = useRef<number>(manualOutput ?? 0);
  const curInRef = useRef(0);
  const curOutRef = useRef(0);

  useEffect(() => {
    agentRef.current = agentState;
  }, [agentState]);

  useEffect(() => {
    modeRef.current = volumeMode;
  }, [volumeMode]);

  useEffect(() => {
    manualInRef.current = clamp01(
      manualInput ?? inputVolumeRef?.current ?? getInputVolume?.() ?? 0
    );
  }, [manualInput, inputVolumeRef, getInputVolume]);

  useEffect(() => {
    manualOutRef.current = clamp01(
      manualOutput ?? outputVolumeRef?.current ?? getOutputVolume?.() ?? 0
    );
  }, [manualOutput, outputVolumeRef, getOutputVolume]);

  const random = useMemo(
    () => splitmix32(seed ?? Math.floor(Math.random() * 2 ** 32)),
    [seed]
  );
  // Offsets still used for potential variation
  const offsets = useMemo(
    () =>
      new Float32Array(Array.from({ length: 7 }, () => random() * Math.PI * 2)),
    [random]
  );

  useEffect(() => {
    targetColor1Ref.current = new THREE.Color(colors[0]);
    targetColor2Ref.current = new THREE.Color(colors[1]);
  }, [colors]);

  useEffect(() => {
    const apply = () => {
      if (!circleRef.current) {
        return;
      }
      const isDark = document.documentElement.classList.contains("dark");
      const { uInverted } = circleRef.current.material.uniforms;
      if (uInverted) {
        uInverted.value = isDark ? 1 : 0;
      }
    };

    apply();

    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  useFrame((_, delta: number) => {
    const mat = circleRef.current?.material;
    if (!mat) {
      return;
    }
    const live = colorsRef?.current;
    if (live) {
      if (live[0]) {
        targetColor1Ref.current.set(live[0]);
      }
      if (live[1]) {
        targetColor2Ref.current.set(live[1]);
      }
    }
    const u = mat.uniforms;
    if (
      !(
        u.uTime &&
        u.uOpacity &&
        u.uAnimation &&
        u.uInputVolume &&
        u.uOutputVolume &&
        u.uColor1 &&
        u.uColor2
      )
    ) {
      return;
    }
    u.uTime.value += delta * 0.5;

    if (u.uOpacity.value < 1) {
      u.uOpacity.value = Math.min(1, u.uOpacity.value + delta * 2);
    }

    let targetIn = 0;
    let targetOut = 0.3;
    if (modeRef.current === "manual") {
      targetIn = clamp01(
        manualInput ?? inputVolumeRef?.current ?? getInputVolume?.() ?? 0
      );
      targetOut = clamp01(
        manualOutput ?? outputVolumeRef?.current ?? getOutputVolume?.() ?? 0
      );
    } else {
      const t = u.uTime.value * 2;
      if (agentRef.current === null) {
        targetIn = 0;
        targetOut = 0.3;
      } else if (agentRef.current === "listening") {
        targetIn = clamp01(0.55 + Math.sin(t * 3.2) * 0.35);
        targetOut = 0.45;
      } else if (agentRef.current === "talking") {
        targetIn = clamp01(0.65 + Math.sin(t * 4.8) * 0.22);
        targetOut = clamp01(0.75 + Math.sin(t * 3.6) * 0.22);
      } else {
        const base = 0.38 + 0.07 * Math.sin(t * 0.7);
        const wander = 0.05 * Math.sin(t * 2.1) * Math.sin(t * 0.37 + 1.2);
        targetIn = clamp01(base + wander);
        targetOut = clamp01(0.48 + 0.12 * Math.sin(t * 1.05 + 0.6));
      }
    }

    curInRef.current += (targetIn - curInRef.current) * 0.2;
    curOutRef.current += (targetOut - curOutRef.current) * 0.2;

    const targetSpeed = 0.1 + (1 - (curOutRef.current - 1) ** 2) * 0.9;
    animSpeedRef.current += (targetSpeed - animSpeedRef.current) * 0.12;

    u.uAnimation.value += delta * animSpeedRef.current;
    u.uInputVolume.value = curInRef.current;
    u.uOutputVolume.value = curOutRef.current;
    u.uColor1.value.lerp(targetColor1Ref.current, 0.08);
    u.uColor2.value.lerp(targetColor2Ref.current, 0.08);
  });

  useEffect(() => {
    const canvas = gl.domElement;
    const onContextLost = (event: Event) => {
      event.preventDefault();
      setTimeout(() => {
        gl.forceContextRestore();
      }, 1);
    };
    canvas.addEventListener("webglcontextlost", onContextLost, false);
    return () =>
      canvas.removeEventListener("webglcontextlost", onContextLost, false);
  }, [gl]);

  const uniforms = useMemo(() => {
    const isDark =
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark");
    return {
      uColor1: new THREE.Uniform(new THREE.Color(initialColorsRef.current[0])),
      uColor2: new THREE.Uniform(new THREE.Color(initialColorsRef.current[1])),
      uOffsets: { value: offsets },
      uPerlinTexture: new THREE.Uniform(perlinNoiseTexture),
      uTime: new THREE.Uniform(0),
      uAnimation: new THREE.Uniform(0.1),
      uInverted: new THREE.Uniform(isDark ? 1 : 0),
      uInputVolume: new THREE.Uniform(0),
      uOutputVolume: new THREE.Uniform(0),
      uOpacity: new THREE.Uniform(0),
    };
  }, [perlinNoiseTexture, offsets]);

  return (
    <mesh ref={circleRef}>
      <circleGeometry args={[3.5, 64]} />
      <shaderMaterial
        fragmentShader={fragmentShader}
        transparent={true}
        uniforms={uniforms}
        vertexShader={vertexShader}
      />
    </mesh>
  );
}

function splitmix32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x9E_37_79_B9) | 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21_F0_AA_AD);
    t ^= t >>> 15;
    t = Math.imul(t, 0x73_5A_2D_97);
    return ((t ^= t >>> 15) >>> 0) / 4_294_967_296;
  };
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.min(1, Math.max(0, n));
}
const vertexShader = /* glsl */ `
uniform float uTime;
uniform sampler2D uPerlinTexture;
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform float uAnimation;
uniform float uInverted;
uniform float uOffsets[7];
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform float uInputVolume;
uniform float uOutputVolume;
uniform float uOpacity;
uniform sampler2D uPerlinTexture;
varying vec2 vUv;

const float PI = 3.14159265358979323846;

void main() {
    // 1. Coordinate System
    vec2 uv = vUv * 2.0 - 1.0;
    float r = length(uv);
    float theta = atan(uv.y, uv.x);
    if (theta < 0.0) theta += 2.0 * PI;

    // 2. Dynamic Parameters
    // Volume pumps the radius and the intensity of the wisps
    float vol = smoothstep(0.0, 1.0, uInputVolume); 
    
    // Base radius of the "Moon" (Black Void Center)
    // Breathing: 0.38 base + sine wave + volume punch
    float breath = sin(uTime * 0.5) * 0.01;
    float moonRadius = 0.38 + breath + vol * 0.05;

    // 3. Noise / Wisps Generation
    // We want radial streaks that flow outwards.
    // Coordinate for noise: (theta, radius - flow)
    float speed = 0.1 + vol * 0.2;
    // Stretch noise along theta for "ray" look
    vec2 noiseUv = vec2(theta / (2.0 * PI) * 6.0, r - uTime * speed);
    
    // Add some swirl based on radius
    noiseUv.x += r * 0.2 * sin(uTime * 0.2);
    
    // Sample texture with offsets for layering
    float n1 = texture2D(uPerlinTexture, noiseUv).r;
    float n2 = texture2D(uPerlinTexture, noiseUv * 2.0 + vec2(0.0, uTime * 0.05)).r;
    
    // Composite noise (FBM-like)
    float noise = n1 * 0.6 + n2 * 0.4;
    
    // 4. Corona Intensity
    // It exists strictly outside the moonRadius.
    float dist = max(0.0, r - moonRadius);
    
    // Decay: Exp decay
    float decay = exp(-dist * (5.0 - vol * 2.0)); 
    
    // Rim light (bright edge right at the moon)
    float rim = smoothstep(0.0, 0.015, dist) * smoothstep(0.04, 0.0, dist);
    
    // Wisp strands
    // Contrast the noise
    float strands = smoothstep(0.4, 0.7, noise); 
    
    float corona = decay * strands;
    
    // Add rim brightness
    corona += rim * 0.8;
    
    // Boost corona with volume
    corona *= (1.0 + vol * 4.0);
    
    // 5. Composition
    vec3 col = vec3(1.0); // Biolum White
    
    // Mix Mask
    float t = smoothstep(moonRadius - 0.005, moonRadius + 0.005, r);
    
    // Output
    vec3 finalRGB = vec3(1.0); // Always white
    
    // Alpha Logic
    // Inside Moon: Opaque Black (or just opaque alpha with black color)
    // Outside: White with corona alpha
    
    // If we use standard blending (SRC_ALPHA, ONE_MINUS_SRC_ALPHA), 
    // black with alpha 1 blocks background.
    
    vec3 cMoon = vec3(0.0);
    float aMoon = 1.0;
    
    vec3 cCorona = vec3(1.0);
    float aCorona = corona;
    
    vec3 rgb = mix(cMoon, cCorona, t);
    float a = mix(aMoon, aCorona, t);
    
    // Global opacity
    a *= uOpacity;
    
    // Pre-multiply alpha for proper blending if enabled in Canvas
    // Canvas has premultipliedAlpha: true
    gl_FragColor = vec4(rgb * a, a);
}
`;
