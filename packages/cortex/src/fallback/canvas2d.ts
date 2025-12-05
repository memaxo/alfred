/**
 * Canvas2D Fallback Renderer
 *
 * Simplified rendering for devices without WebGPU.
 * Provides basic visualization using standard Canvas 2D API.
 */

import type { EdgeData, GlobalUniforms, NodeData, OrbConfig } from "../types";

/**
 * Canvas2D renderer configuration
 */
export interface Canvas2DConfig {
  /** Canvas element to render to */
  canvas: HTMLCanvasElement;
  /** Enable glow effects (using shadows) */
  enableGlow: boolean;
  /** Particle count (reduced for performance) */
  particleCount: number;
}

/**
 * Simple particle for Canvas2D
 */
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
}

/**
 * Canvas2D Fallback Renderer
 */
export class Canvas2DRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: Canvas2DConfig;

  private particles: Particle[] = [];
  private nodes: NodeData[] = [];
  private edges: EdgeData[] = [];
  private orbConfig: OrbConfig | null = null;
  private uniforms: GlobalUniforms;

  private running = false;
  private lastTime = 0;

  constructor(config: Canvas2DConfig) {
    this.config = config;
    this.canvas = config.canvas;

    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D context");
    }
    this.ctx = ctx;

    this.uniforms = {
      time: 0,
      deltaTime: 0,
      resolution: { x: this.canvas.width, y: this.canvas.height },
      mouse: { x: 0, y: 0 },
      orbCenter: { x: this.canvas.width / 2, y: this.canvas.height / 2 },
      orbState: 0,
      audioLow: 0,
      audioMid: 0,
      zoom: 1,
    };

    // Initialize particles
    this.initParticles();
  }

  private initParticles(): void {
    this.particles = [];
    const { orbCenter } = this.uniforms;
    const spawnRadius = 600;

    for (let i = 0; i < this.config.particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = spawnRadius + Math.random() * 200;

      const x = orbCenter.x + Math.cos(angle) * radius;
      const y = orbCenter.y + Math.sin(angle) * radius;

      // Orbital velocity
      const speed = 30 + Math.random() * 50;
      const vx = -Math.sin(angle) * speed;
      const vy = Math.cos(angle) * speed;

      this.particles.push({
        x,
        y,
        vx,
        vy,
        life: 0.5 + Math.random() * 0.5,
        size: 1 + Math.random() * 2,
      });
    }
  }

  /**
   * Set nodes to render
   */
  setNodes(nodes: NodeData[]): void {
    this.nodes = nodes;
  }

  /**
   * Set edges to render
   */
  setEdges(edges: EdgeData[]): void {
    this.edges = edges;
  }

  /**
   * Set orb configuration
   */
  setOrbConfig(config: OrbConfig): void {
    this.orbConfig = config;
    this.uniforms.orbCenter = config.center;
  }

  /**
   * Update uniforms
   */
  setUniforms(updates: Partial<GlobalUniforms>): void {
    Object.assign(this.uniforms, updates);
  }

  /**
   * Resize the canvas
   */
  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.uniforms.resolution = { x: width, y: height };
  }

  /**
   * Update particle positions
   */
  private updateParticles(dt: number): void {
    const { orbCenter } = this.uniforms;
    const G = 3000;
    const orbMass = 100;
    const damping = 0.998;
    const minDist = 50;

    for (const p of this.particles) {
      // Vector to orb
      const dx = orbCenter.x - p.x;
      const dy = orbCenter.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Respawn if too close or dead
      if (dist < minDist || p.life <= 0) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 600 + Math.random() * 200;
        p.x = orbCenter.x + Math.cos(angle) * radius;
        p.y = orbCenter.y + Math.sin(angle) * radius;
        const speed = 30 + Math.random() * 50;
        p.vx = -Math.sin(angle) * speed;
        p.vy = Math.cos(angle) * speed;
        p.life = 0.5 + Math.random() * 0.5;
        continue;
      }

      // Gravitational force
      const effectiveDist = Math.max(dist, minDist);
      const force = (G * orbMass) / (effectiveDist * effectiveDist);
      const ax = (dx / dist) * force;
      const ay = (dy / dist) * force;

      p.vx = (p.vx + ax * dt) * damping;
      p.vy = (p.vy + ay * dt) * damping;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt * 0.1;
    }
  }

  /**
   * Render a single frame
   */
  private render(): void {
    const { ctx, canvas } = this;
    const { orbCenter, audioLow, audioMid } = this.uniforms;

    // Clear to void
    ctx.fillStyle = "rgb(13, 13, 13)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw atmosphere gradient
    const gradient = ctx.createRadialGradient(
      orbCenter.x,
      orbCenter.y,
      100,
      orbCenter.x,
      orbCenter.y,
      600
    );
    gradient.addColorStop(0, "rgba(0, 230, 204, 0.1)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw edges
    ctx.lineCap = "round";
    for (const edge of this.edges) {
      ctx.beginPath();
      ctx.moveTo(edge.p0.x, edge.p0.y);
      ctx.bezierCurveTo(
        edge.p1.x,
        edge.p1.y,
        edge.p2.x,
        edge.p2.y,
        edge.p3.x,
        edge.p3.y
      );

      const alpha = edge.active > 0.5 ? 0.6 : 0.2;
      ctx.strokeStyle = `rgba(${edge.color.r * 255}, ${edge.color.g * 255}, ${edge.color.b * 255}, ${alpha})`;
      ctx.lineWidth = edge.active > 0.5 ? 2 : 1;
      ctx.stroke();
    }

    // Draw particles
    ctx.globalCompositeOperation = "lighter";
    for (const p of this.particles) {
      const alpha = p.life * 0.5;
      ctx.fillStyle = `rgba(0, 230, 204, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 + audioMid), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";

    // Draw orb
    if (this.orbConfig) {
      const { innerRadius } = this.orbConfig;
      const pulseScale = 1 + audioLow * 0.1;

      // Outer glow
      if (this.config.enableGlow) {
        (ctx as CanvasRenderingContext2D).shadowBlur = 60;
        (ctx as CanvasRenderingContext2D).shadowColor =
          "rgba(0, 230, 204, 0.5)";
      }

      // Orb gradient
      const orbGradient = ctx.createRadialGradient(
        orbCenter.x,
        orbCenter.y,
        innerRadius * 0.3 * pulseScale,
        orbCenter.x,
        orbCenter.y,
        innerRadius * pulseScale
      );
      orbGradient.addColorStop(0, "rgba(0, 230, 204, 0.4)");
      orbGradient.addColorStop(0.7, "rgba(0, 180, 160, 0.2)");
      orbGradient.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = orbGradient;
      ctx.beginPath();
      ctx.arc(
        orbCenter.x,
        orbCenter.y,
        innerRadius * pulseScale,
        0,
        Math.PI * 2
      );
      ctx.fill();

      (ctx as CanvasRenderingContext2D).shadowBlur = 0;
    }

    // Draw nodes
    for (const node of this.nodes) {
      const { position, radius, activity, color } = node;

      // Glow
      if (this.config.enableGlow && activity > 0.5) {
        (ctx as CanvasRenderingContext2D).shadowBlur = 20;
        (ctx as CanvasRenderingContext2D).shadowColor =
          `rgba(${color.r * 255}, ${color.g * 255}, ${color.b * 255}, 0.5)`;
      }

      // Ring
      ctx.strokeStyle = `rgba(${color.r * 255}, ${color.g * 255}, ${color.b * 255}, ${0.4 + activity * 0.4})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(position.x, position.y, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Inner fill
      ctx.fillStyle = `rgba(${color.r * 255}, ${color.g * 255}, ${color.b * 255}, ${0.1 + activity * 0.2})`;
      ctx.fill();

      (ctx as CanvasRenderingContext2D).shadowBlur = 0;
    }
  }

  /**
   * Animation loop
   */
  private loop = (time: number): void => {
    if (!this.running) return;

    const dt = this.lastTime > 0 ? (time - this.lastTime) / 1000 : 0;
    this.lastTime = time;

    this.uniforms.time = time / 1000;
    this.uniforms.deltaTime = dt;

    this.updateParticles(dt);
    this.render();

    requestAnimationFrame(this.loop);
  };

  /**
   * Start rendering
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = 0;
    requestAnimationFrame(this.loop);
  }

  /**
   * Stop rendering
   */
  stop(): void {
    this.running = false;
  }

  /**
   * Destroy renderer
   */
  destroy(): void {
    this.stop();
  }
}

/**
 * Create Canvas2D fallback renderer
 */
export function createCanvas2DFallback(
  canvas: HTMLCanvasElement,
  options: Partial<Omit<Canvas2DConfig, "canvas">> = {}
): Canvas2DRenderer {
  return new Canvas2DRenderer({
    canvas,
    enableGlow: options.enableGlow ?? true,
    particleCount: options.particleCount ?? 500,
  });
}
