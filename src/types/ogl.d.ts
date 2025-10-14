declare module 'ogl' {
  export class Renderer {
    constructor(options?: { depth?: boolean; alpha?: boolean });
    gl: WebGLRenderingContext;
    setSize(width: number, height: number): void;
    render(options: { scene: any; camera: Camera }): void;
  }

  export class Camera {
    constructor(gl: WebGLRenderingContext, options?: { fov?: number });
    position: { x: number; y: number; z: number; set: (x: number, y: number, z: number) => void };
    perspective(options: { aspect: number }): void;
  }

  export class Geometry {
    constructor(gl: WebGLRenderingContext, attributes: Record<string, { size: number; data: Float32Array }>);
  }

  export class Program {
    constructor(gl: WebGLRenderingContext, options: {
      vertex: string;
      fragment: string;
      uniforms?: Record<string, { value: any }>;
      transparent?: boolean;
      depthTest?: boolean;
    });
    uniforms: Record<string, { value: any }>;
  }

  export class Mesh {
    constructor(gl: WebGLRenderingContext, options: { mode: number; geometry: Geometry; program: Program });
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
  }
}
