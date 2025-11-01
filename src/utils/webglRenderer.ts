import { BlendMode } from "../components/LayerPanel";

export class WebGLRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private texture: WebGLTexture;
  private framebuffer: WebGLFramebuffer;
  private textureCache: Map<string, WebGLTexture> = new Map();

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    });

    if (!gl) {
      throw new Error("WebGL not supported");
    }

    this.gl = gl;
    this.program = this.createShaderProgram();
    this.texture = this.createTexture();
    this.framebuffer = this.createFramebuffer();

    // Setup viewport
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.BLEND);
  }

  private createShaderProgram(): WebGLProgram {
    const gl = this.gl;

    // Vertex shader
    const vertexShaderSource = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;

      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `;

    // Fragment shader with blend mode support
    const fragmentShaderSource = `
      precision mediump float;
      varying vec2 v_texCoord;
      uniform sampler2D u_texture;
      uniform float u_opacity;
      uniform int u_blendMode;
      uniform sampler2D u_background;

      vec3 blendMultiply(vec3 base, vec3 blend) {
        return base * blend;
      }

      vec3 blendScreen(vec3 base, vec3 blend) {
        return 1.0 - (1.0 - base) * (1.0 - blend);
      }

      vec3 blendOverlay(vec3 base, vec3 blend) {
        return mix(
          2.0 * base * blend,
          1.0 - 2.0 * (1.0 - base) * (1.0 - blend),
          step(0.5, base)
        );
      }

      vec3 blendDarken(vec3 base, vec3 blend) {
        return min(base, blend);
      }

      vec3 blendLighten(vec3 base, vec3 blend) {
        return max(base, blend);
      }

      void main() {
        vec4 texColor = texture2D(u_texture, v_texCoord);
        vec4 bgColor = texture2D(u_background, v_texCoord);

        vec3 blended = texColor.rgb;

        if (u_blendMode == 1) { // multiply
          blended = blendMultiply(bgColor.rgb, texColor.rgb);
        } else if (u_blendMode == 2) { // screen
          blended = blendScreen(bgColor.rgb, texColor.rgb);
        } else if (u_blendMode == 3) { // overlay
          blended = blendOverlay(bgColor.rgb, texColor.rgb);
        } else if (u_blendMode == 4) { // darken
          blended = blendDarken(bgColor.rgb, texColor.rgb);
        } else if (u_blendMode == 5) { // lighten
          blended = blendLighten(bgColor.rgb, texColor.rgb);
        }

        float alpha = texColor.a * u_opacity;
        gl_FragColor = vec4(blended, alpha);
      }
    `;

    const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

    const program = gl.createProgram();
    if (!program) throw new Error("Failed to create program");

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error("Program link failed: " + gl.getProgramInfoLog(program));
    }

    gl.useProgram(program);

    // Setup geometry
    const positions = new Float32Array([
      -1, -1,  // bottom-left
       1, -1,  // bottom-right
      -1,  1,  // top-left
       1,  1,  // top-right
    ]);

    const texCoords = new Float32Array([
      0, 1,  // bottom-left
      1, 1,  // bottom-right
      0, 0,  // top-left
      1, 0,  // top-right
    ]);

    // Position buffer
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // TexCoord buffer
    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

    const texCoordLocation = gl.getAttribLocation(program, "a_texCoord");
    gl.enableVertexAttribArray(texCoordLocation);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

    return program;
  }

  private compileShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Failed to create shader");

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error("Shader compile failed: " + gl.getShaderInfoLog(shader));
    }

    return shader;
  }

  private createTexture(): WebGLTexture {
    const gl = this.gl;
    const texture = gl.createTexture();
    if (!texture) throw new Error("Failed to create texture");

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    return texture;
  }

  private createFramebuffer(): WebGLFramebuffer {
    const gl = this.gl;
    const framebuffer = gl.createFramebuffer();
    if (!framebuffer) throw new Error("Failed to create framebuffer");
    return framebuffer;
  }

  private getBlendModeValue(blendMode: BlendMode): number {
    const modes: Record<BlendMode, number> = {
      normal: 0,
      multiply: 1,
      screen: 2,
      overlay: 3,
      darken: 4,
      lighten: 5,
    };
    return modes[blendMode] || 0;
  }

  public uploadTexture(imageData: Uint8ClampedArray, width: number, height: number, layerId?: string): WebGLTexture {
    const gl = this.gl;

    // Use cached texture if layerId provided
    let texture = layerId ? this.textureCache.get(layerId) : null;

    if (!texture) {
      texture = this.createTexture();
      if (layerId) {
        this.textureCache.set(layerId, texture);
      }
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      imageData
    );

    return texture;
  }

  public renderLayer(
    texture: WebGLTexture,
    opacity: number,
    blendMode: BlendMode,
    backgroundTexture?: WebGLTexture
  ) {
    const gl = this.gl;
    gl.useProgram(this.program);

    // Set blend mode based on layer settings
    if (blendMode === "normal") {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    } else {
      // For other blend modes, we'll handle them in the shader
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }

    // Bind textures
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(gl.getUniformLocation(this.program, "u_texture"), 0);

    if (backgroundTexture) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, backgroundTexture);
      gl.uniform1i(gl.getUniformLocation(this.program, "u_background"), 1);
    }

    // Set uniforms
    gl.uniform1f(gl.getUniformLocation(this.program, "u_opacity"), opacity / 100);
    gl.uniform1i(gl.getUniformLocation(this.program, "u_blendMode"), this.getBlendModeValue(blendMode));

    // Draw
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  public clear(r: number = 0, g: number = 0, b: number = 0, a: number = 0) {
    this.gl.clearColor(r, g, b, a);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  public readPixels(x: number, y: number, width: number, height: number): Uint8Array {
    const gl = this.gl;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    return pixels;
  }

  public getCanvas(): HTMLCanvasElement {
    return this.gl.canvas as HTMLCanvasElement;
  }

  public dispose() {
    const gl = this.gl;

    // Clean up textures
    this.textureCache.forEach((texture) => {
      gl.deleteTexture(texture);
    });
    this.textureCache.clear();

    gl.deleteTexture(this.texture);
    gl.deleteFramebuffer(this.framebuffer);
    gl.deleteProgram(this.program);
  }

  public clearTextureCache(layerId?: string) {
    if (layerId) {
      const texture = this.textureCache.get(layerId);
      if (texture) {
        this.gl.deleteTexture(texture);
        this.textureCache.delete(layerId);
      }
    } else {
      this.textureCache.forEach((texture) => {
        this.gl.deleteTexture(texture);
      });
      this.textureCache.clear();
    }
  }
}

/**
 * Request Animation Frame based batch processor
 * Optimizes drawing operations by batching them and processing on next frame
 */
export class RAFBatchProcessor {
  private rafId: number | null = null;
  private batch: Array<() => void> = [];
  private isProcessing = false;

  public addToBatch(operation: () => void) {
    this.batch.push(operation);
    this.scheduleProcess();
  }

  private scheduleProcess() {
    if (this.isProcessing || this.rafId !== null) return;

    this.rafId = requestAnimationFrame(() => {
      this.processBatch();
    });
  }

  private processBatch() {
    this.isProcessing = true;
    this.rafId = null;

    const operations = [...this.batch];
    this.batch = [];

    // Execute all batched operations
    operations.forEach((op) => op());

    this.isProcessing = false;

    // If new operations were added during processing, schedule next frame
    if (this.batch.length > 0) {
      this.scheduleProcess();
    }
  }

  public flush() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.processBatch();
  }

  public clear() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.batch = [];
    this.isProcessing = false;
  }
}
