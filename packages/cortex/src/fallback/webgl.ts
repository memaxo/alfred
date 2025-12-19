/**
 * WebGL Fallback Renderer
 *
 * Higher-fidelity fallback using WebGL 2 for devices without WebGPU.
 * Provides particle systems and basic shader effects.
 */

import type { EdgeData, GlobalUniforms, NodeData, OrbConfig } from "../types";

/**
 * WebGL renderer configuration
 */
export type WebGLConfig = {
  canvas: HTMLCanvasElement;
  particleCount: number;
  enableBloom: boolean;
};

/**
 * Vertex shader for particles
 */
const PARTICLE_VS = `#version 300 es
precision highp float;

layout(location = 0) in vec2 a_position;
layout(location = 1) in vec2 a_velocity;
layout(location = 2) in float a_life;
layout(location = 3) in float a_size;

uniform vec2 u_resolution;
uniform float u_time;

out float v_life;
out float v_size;

void main() {
  vec2 pos = a_position / u_resolution * 2.0 - 1.0;
  pos.y = -pos.y;
  
  gl_Position = vec4(pos, 0.0, 1.0);
  gl_PointSize = a_size * 3.0;
  
  v_life = a_life;
  v_size = a_size;
}
`;

/**
 * Fragment shader for particles
 */
const PARTICLE_FS = `#version 300 es
precision highp float;

in float v_life;
in float v_size;

out vec4 fragColor;

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = length(coord);
  
  if (dist > 0.5) discard;
  
  float alpha = (1.0 - dist * 2.0) * v_life * 0.6;
  vec3 color = vec3(0.0, 0.9, 0.8);
  
  fragColor = vec4(color, alpha);
}
`;

/**
 * Vertex shader for orb/background
 */
const QUAD_VS = `#version 300 es
precision highp float;

layout(location = 0) in vec2 a_position;

out vec2 v_uv;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_uv = a_position * 0.5 + 0.5;
}
`;

/**
 * Fragment shader for orb
 */
const ORB_FS = `#version 300 es
precision highp float;

in vec2 v_uv;

uniform vec2 u_resolution;
uniform vec2 u_orb_center;
uniform float u_inner_radius;
uniform float u_time;
uniform float u_audio_low;

out vec4 fragColor;

void main() {
  vec2 pixel = v_uv * u_resolution;
  vec2 to_orb = pixel - u_orb_center;
  float dist = length(to_orb);
  
  float pulse = 1.0 + u_audio_low * 0.1;
  float inner = u_inner_radius * pulse;
  
  // Orb glow
  float glow = exp(-dist / (inner * 2.0)) * 0.4;
  
  // Radial fog
  float fog = exp(-dist / 400.0) * 0.15;
  
  vec3 color = vec3(0.0, 0.9, 0.8) * (glow + fog);
  float alpha = glow + fog;
  
  fragColor = vec4(color, alpha);
}
`;

// Edge fragment shader reserved for future use

/**
 * WebGL Fallback Renderer
 */
export class WebGLRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGL2RenderingContext;
  private readonly config: WebGLConfig;

  private particleProgram: WebGLProgram | null = null;
  private orbProgram: WebGLProgram | null = null;
  private particleVAO: WebGLVertexArrayObject | null = null;
  private particleBuffer: WebGLBuffer | null = null;
  private quadVAO: WebGLVertexArrayObject | null = null;

  private readonly particleData: Float32Array;
  private orbConfig: OrbConfig | null = null;
  private readonly uniforms: GlobalUniforms;
  private nodes: NodeData[] = [];
  private edges: EdgeData[] = [];

  private running = false;
  private lastTime = 0;

  constructor(config: WebGLConfig) {
    this.config = config;
    this.canvas = config.canvas;

    const gl = this.canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
    });

    if (!gl) {
      throw new Error("WebGL 2 not supported");
    }
    this.gl = gl;

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

    // Initialize particle data (x, y, vx, vy, life, size)
    this.particleData = new Float32Array(config.particleCount * 6);
    this.initParticles();

    // Create shaders and buffers
    this.initGL();
  }

  private initGL(): void {
    const { gl } = this;

    // Enable blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    // Create particle program
    this.particleProgram = this.createProgram(PARTICLE_VS, PARTICLE_FS);

    // Create orb program
    this.orbProgram = this.createProgram(QUAD_VS, ORB_FS);

    // Create particle VAO and buffer
    this.particleVAO = gl.createVertexArray();
    gl.bindVertexArray(this.particleVAO);

    this.particleBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.particleBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.particleData, gl.DYNAMIC_DRAW);

    // Position (x, y)
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 24, 0);
    // Velocity (vx, vy)
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 24, 8);
    // Life
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 24, 16);
    // Size
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 24, 20);

    // Create quad VAO
    this.quadVAO = gl.createVertexArray();
    gl.bindVertexArray(this.quadVAO);

    const quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
  }

  private createProgram(
    vsSource: string,
    fsSource: string
  ): WebGLProgram | null {
    const { gl } = this;

    const vs = this.compileShader(vsSource, gl.VERTEX_SHADER);
    const fs = this.compileShader(fsSource, gl.FRAGMENT_SHADER);

    if (!(vs && fs)) {
      return null;
    }

    const program = gl.createProgram();
    if (!program) {
      return null;
    }

    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      return null;
    }

    return program;
  }

  private compileShader(source: string, type: number): WebGLShader | null {
    const { gl } = this;

    const shader = gl.createShader(type);
    if (!shader) {
      return null;
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      return null;
    }

    return shader;
  }

  private initParticles(): void {
    const { orbCenter } = this.uniforms;
    const data = this.particleData;

    for (let i = 0; i < this.config.particleCount; i++) {
      const offset = i * 6;
      const angle = Math.random() * Math.PI * 2;
      const radius = 600 + Math.random() * 200;

      data[offset] = orbCenter.x + Math.cos(angle) * radius; // x
      data[offset + 1] = orbCenter.y + Math.sin(angle) * radius; // y

      const speed = 30 + Math.random() * 50;
      data[offset + 2] = -Math.sin(angle) * speed; // vx
      data[offset + 3] = Math.cos(angle) * speed; // vy

      data[offset + 4] = 0.5 + Math.random() * 0.5; // life
      data[offset + 5] = 1 + Math.random() * 2; // size
    }
  }

  /**
   * Set nodes
   */
  setNodes(nodes: NodeData[]): void {
    this.nodes = nodes;
  }

  /**
   * Set edges
   */
  setEdges(edges: EdgeData[]): void {
    this.edges = edges;
  }

  /**
   * Set orb config
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
   * Resize
   */
  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
    this.uniforms.resolution = { x: width, y: height };
  }

  private updateParticles(dt: number): void {
    const { orbCenter } = this.uniforms;
    const data = this.particleData;
    const G = 3000;
    const orbMass = 100;
    const damping = 0.998;
    const minDist = 50;

    for (let i = 0; i < this.config.particleCount; i++) {
      const offset = i * 6;

      const x = data[offset];
      const y = data[offset + 1];
      let vx = data[offset + 2];
      let vy = data[offset + 3];
      let life = data[offset + 4];

      const dx = orbCenter.x - x;
      const dy = orbCenter.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < minDist || life <= 0) {
        // Respawn
        const angle = Math.random() * Math.PI * 2;
        const radius = 600 + Math.random() * 200;
        data[offset] = orbCenter.x + Math.cos(angle) * radius;
        data[offset + 1] = orbCenter.y + Math.sin(angle) * radius;
        const speed = 30 + Math.random() * 50;
        data[offset + 2] = -Math.sin(angle) * speed;
        data[offset + 3] = Math.cos(angle) * speed;
        data[offset + 4] = 0.5 + Math.random() * 0.5;
        continue;
      }

      const effectiveDist = Math.max(dist, minDist);
      const force = (G * orbMass) / (effectiveDist * effectiveDist);
      const ax = (dx / dist) * force;
      const ay = (dy / dist) * force;

      vx = (vx + ax * dt) * damping;
      vy = (vy + ay * dt) * damping;
      life -= dt * 0.1;

      data[offset] += vx * dt;
      data[offset + 1] += vy * dt;
      data[offset + 2] = vx;
      data[offset + 3] = vy;
      data[offset + 4] = life;
    }
  }

  private render(): void {
    const { gl, canvas } = this;

    gl.clearColor(0.05, 0.05, 0.05, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Draw orb/atmosphere
    if (this.orbProgram && this.orbConfig) {
      gl.useProgram(this.orbProgram);

      gl.uniform2f(
        gl.getUniformLocation(this.orbProgram, "u_resolution"),
        canvas.width,
        canvas.height
      );
      gl.uniform2f(
        gl.getUniformLocation(this.orbProgram, "u_orb_center"),
        this.uniforms.orbCenter.x,
        this.uniforms.orbCenter.y
      );
      gl.uniform1f(
        gl.getUniformLocation(this.orbProgram, "u_inner_radius"),
        this.orbConfig.innerRadius
      );
      gl.uniform1f(
        gl.getUniformLocation(this.orbProgram, "u_time"),
        this.uniforms.time
      );
      gl.uniform1f(
        gl.getUniformLocation(this.orbProgram, "u_audio_low"),
        this.uniforms.audioLow
      );

      gl.bindVertexArray(this.quadVAO);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    // Draw particles
    if (this.particleProgram) {
      gl.useProgram(this.particleProgram);

      // Upload updated particle data
      gl.bindBuffer(gl.ARRAY_BUFFER, this.particleBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.particleData);

      gl.uniform2f(
        gl.getUniformLocation(this.particleProgram, "u_resolution"),
        canvas.width,
        canvas.height
      );
      gl.uniform1f(
        gl.getUniformLocation(this.particleProgram, "u_time"),
        this.uniforms.time
      );

      gl.bindVertexArray(this.particleVAO);
      gl.drawArrays(gl.POINTS, 0, this.config.particleCount);
    }

    gl.bindVertexArray(null);
  }

  private readonly loop = (time: number): void => {
    if (!this.running) {
      return;
    }

    const dt = this.lastTime > 0 ? (time - this.lastTime) / 1000 : 0;
    this.lastTime = time;

    this.uniforms.time = time / 1000;
    this.uniforms.deltaTime = dt;

    this.updateParticles(dt);
    this.render();

    requestAnimationFrame(this.loop);
  };

  /**
   * Start
   */
  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.lastTime = 0;
    requestAnimationFrame(this.loop);
  }

  /**
   * Stop
   */
  stop(): void {
    this.running = false;
  }

  /**
   * Destroy
   */
  destroy(): void {
    this.stop();
    // Clean up WebGL resources
    const { gl } = this;
    if (this.particleProgram) {
      gl.deleteProgram(this.particleProgram);
    }
    if (this.orbProgram) {
      gl.deleteProgram(this.orbProgram);
    }
    if (this.particleVAO) {
      gl.deleteVertexArray(this.particleVAO);
    }
    if (this.particleBuffer) {
      gl.deleteBuffer(this.particleBuffer);
    }
    if (this.quadVAO) {
      gl.deleteVertexArray(this.quadVAO);
    }
  }
}

/**
 * Create WebGL fallback renderer
 */
export function createWebGLFallback(
  canvas: HTMLCanvasElement,
  options: Partial<Omit<WebGLConfig, "canvas">> = {}
): WebGLRenderer {
  return new WebGLRenderer({
    canvas,
    particleCount: options.particleCount ?? 1500,
    enableBloom: options.enableBloom ?? false,
  });
}
