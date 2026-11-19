import type { PetId } from "@/lib/pets";

export type CompanionFrame = {
  bend: number;
  breath: number;
  fullness: number;
  headX: number;
  headY: number;
  headRoll: number;
  faceTurn: number;
  gazeX: number;
  gazeY: number;
  blink: number;
  alertness: number;
  mouth: number;
  pout: number;
  smile: number;
  accent: number;
  charm: number;
  orbit: number;
  paw: { lift: number; rub: number };
};

type Point = readonly [number, number];

const anchors = {
  xiaogua: { foot: .977, eyes: [.476, .556, .43], mouth: [.436, .577], smileSlope: -.022, accent: [.434, .186], cap: [.433, .318], charm: [.126, .231],
    pawRest: [.70, .765], pawRaised: [.700, .543] },
  yunyao: { foot: .98, eyes: [.532, .523, .50], mouth: [.508, .603], smileSlope: -.015, accent: [.488, .397] },
  qingpu: { foot: .978, eyes: [.473, .430, .59], mouth: [.602, .516], smileSlope: .006, accent: [.073, .513], cap: [.452, .269],
    pawRest: [.875, .758], pawRaised: [.845, .516] },
  xuanji: { foot: .979, eyes: [.303, .374, .48], mouth: [.466, .411], smileSlope: -.026, accent: [.5, .613] },
} satisfies Record<PetId, {
  foot: number; eyes: readonly [number, number, number]; mouth: Point; smileSlope: number; accent: Point;
  cap?: Point; charm?: Point; pawRest?: Point; pawRaised?: Point;
}>;

const vertex = `
attribute vec2 a_point;
uniform vec3 u_body;
uniform vec3 u_head;
uniform vec4 u_tile;
uniform vec4 u_local;
uniform vec2 u_pivot;
uniform vec2 u_shift;
uniform vec4 u_lids;
uniform vec2 u_lips;
uniform float u_foot;
uniform float u_aspect;
uniform float u_orbit;
varying vec2 v_uv;

vec2 rotate(vec2 delta, float angle) {
  delta.x *= u_aspect;
  vec2 spun = mat2(cos(angle), sin(angle), -sin(angle), cos(angle)) * delta;
  return vec2(spun.x / u_aspect, spun.y);
}

void main() {
  v_uv = u_tile.xy + a_point * u_tile.zw;
  float eyeCenter = mix(u_lids.x, u_lids.y, step(u_lids.z, a_point.x));
  vec2 feature = vec2(a_point.x, eyeCenter + (a_point.y - eyeCenter) * u_lids.w);
  float lipX = clamp((feature.x - u_pivot.x) / .045, -1.2, 1.2);
  feature.y += u_lips.x * (.58 - lipX * lipX) + u_lips.y * lipX;
  vec2 local = rotate((feature - u_pivot) * u_local.xy, u_local.z) + u_pivot + u_shift;
  vec2 headPivot = vec2(.50, .51);
  vec2 rigidHead = headPivot + rotate(local - headPivot, u_head.z) + u_head.xy;

  // Caps and trim ride on the same rigid head as the face. Blend into the soft body below the cheeks.
  float height = clamp(1.0 - local.y / u_foot, 0.0, 1.0);
  float belly = sin(3.141593 * height);
  vec2 softBody = local;
  softBody.x += u_body.x * height * height + (local.x - .5) * u_body.z * belly;
  softBody.y = u_foot + (local.y - u_foot) * (1.0 + u_body.y * (.30 + .70 * height));
  float headWeight = max(u_local.w, 1.0 - smoothstep(.65, .94, local.y));
  vec2 p = mix(softBody, rigidHead, headWeight);
  float ribbon = (a_point.y - (.635 + .10 * (a_point.x - .5))) * 22.0;
  p.y += u_orbit * (a_point.x - .5) * exp(-ribbon * ribbon);
  gl_Position = vec4((p.x - .5) / .56, (.5 - p.y) / .56, 0.0, 1.0);
}`;

const fragment = `
precision mediump float;
uniform sampler2D u_atlas;
uniform float u_opacity;
varying vec2 v_uv;

void main() {
  gl_FragColor = texture2D(u_atlas, v_uv) * u_opacity;
}`;

const columns = 24;
const rows = 20;
const points = new Float32Array((columns + 1) * (rows + 1) * 2);
const indices = new Uint16Array(columns * rows * 6);
for (let y = 0, p = 0, i = 0; y <= rows; y++) {
  for (let x = 0; x <= columns; x++) {
    points[p++] = x / columns;
    points[p++] = y / rows;
    if (x === columns || y === rows) continue;
    const top = y * (columns + 1) + x;
    indices.set([top, top + 1, top + columns + 1, top + 1, top + columns + 2, top + columns + 1], i);
    i += 6;
  }
}

function compile(gl: WebGLRenderingContext, type: number, code: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, code);
  gl.compileShader(shader);
  return shader;
}

export function openCompanionMesh(canvas: HTMLCanvasElement, id: PetId, atlas: HTMLImageElement) {
  const gl = canvas.getContext("webgl", { alpha: true, antialias: false, depth: false, powerPreference: "low-power" });
  if (!gl) return null;
  const program = gl.createProgram()!;
  const vs = compile(gl, gl.VERTEX_SHADER, vertex);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragment);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  gl.useProgram(program);
  const mesh = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh);
  gl.bufferData(gl.ARRAY_BUFFER, points, gl.STATIC_DRAW);
  const point = gl.getAttribLocation(program, "a_point");
  gl.enableVertexAttribArray(point);
  gl.vertexAttribPointer(point, 2, gl.FLOAT, false, 0, 0);
  const triangles = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangles);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  const location = (name: string) => gl.getUniformLocation(program, name);
  const body = location("u_body");
  const head = location("u_head");
  const tile = location("u_tile");
  const local = location("u_local");
  const pivot = location("u_pivot");
  const shift = location("u_shift");
  const opacity = location("u_opacity");
  const orbit = location("u_orbit");
  const lids = location("u_lids");
  const lipCurve = location("u_lips");
  const a: (typeof anchors)[PetId] & { cap?: Point; charm?: Point; pawRest?: Point; pawRaised?: Point } = anchors[id];
  gl.uniform1f(location("u_foot"), a.foot);
  gl.uniform1i(location("u_atlas"), 0);
  const width = atlas.naturalWidth;
  const height = atlas.naturalHeight;
  const columns = 3;
  const rows = 4;
  gl.uniform1f(location("u_aspect"), (width / columns - 4) / (height / rows - 4));
  gl.uniform4f(lids, ...a.eyes, 1);
  const center: Point = [.5, .5];

  function layer(index: number, anchor = center, x = 0, y = 0, sx = 1, sy = 1, angle = 0, alpha = 1, rigid = false) {
    if (alpha < .005) return;
    gl!.uniform4f(tile, (index % columns) / columns + 2.5 / width, Math.floor(index / columns) / rows + 2.5 / height,
      1 / columns - 5 / width, 1 / rows - 5 / height);
    gl!.uniform2f(pivot, ...anchor);
    gl!.uniform2f(shift, x, y);
    gl!.uniform4f(local, sx, sy, angle, rigid ? 1 : 0);
    gl!.uniform1f(opacity, alpha);
    gl!.drawElements(gl!.TRIANGLES, indices.length, gl!.UNSIGNED_SHORT, 0);
  }

  return {
    resize(width: number, height: number) {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.ceil(width * ratio));
      const h = Math.max(1, Math.ceil(height * ratio));
      if (canvas.width === w && canvas.height === h) return;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    },
    draw(frame: CompanionFrame) {
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform3f(body, frame.bend, frame.breath, frame.fullness);
      gl.uniform3f(head, frame.headX, frame.headY, frame.headRoll);
      gl.uniform1f(orbit, frame.orbit);
      layer(0);
      gl.uniform1f(orbit, 0);
      if (a.cap) layer(5, a.cap, 0, 0, 1, 1, 0, 1, true);
      if (a.charm) layer(6, a.charm, 0, 0, 1, 1, frame.charm, 1, true);
      layer(4, a.accent, 0, 0, 1, 1, frame.accent, 1, true);
      const lidsClosed = Math.max(0, Math.min(1, (frame.blink - .71) / .25));
      const eyeX = frame.faceTurn + frame.gazeX;
      gl.uniform4f(lids, ...a.eyes, Math.max(.13, 1 + frame.alertness - frame.blink * .89));
      layer(1, center, eyeX, frame.gazeY, 1, 1, 0, 1 - lidsClosed);
      gl.uniform4f(lids, ...a.eyes, 1);
      layer(2, center, eyeX, frame.gazeY, 1, 1, 0, lidsClosed);
      const mouthX = frame.faceTurn * .86 + frame.gazeX * .11;
      const expression = Math.max(frame.pout, frame.smile);
      gl.uniform2f(lipCurve, frame.smile * .040, frame.smile * a.smileSlope);
      layer(3, a.mouth, mouthX, 0, 1 + frame.mouth * .26 - frame.pout * .27, 1 + frame.mouth * .19, 0, 1 - expression);
      gl.uniform2f(lipCurve, 0, 0);
      layer(8, a.mouth, mouthX, 0, .77 + frame.pout * .34, .79 + frame.pout * .23, 0, frame.pout);
      layer(9, a.mouth, mouthX, 0, .77 + frame.smile * .28, .75 + frame.smile * .26, 0, frame.smile);
      if (a.pawRest && a.pawRaised && frame.paw.lift > 0) {
        const { lift, rub } = frame.paw;
        const x = a.pawRest[0] + (a.pawRaised[0] - a.pawRest[0]) * lift - .009 * rub;
        const y = a.pawRest[1] + (a.pawRaised[1] - a.pawRest[1]) * lift - .016 * rub;
        layer(7, center, x - .5, y - .5, 1, 1, rub * .12, Math.min(1, lift * 3));
      }
    },
    dispose() {
      gl.deleteTexture(texture);
      gl.deleteBuffer(mesh);
      gl.deleteBuffer(triangles);
      gl.deleteProgram(program);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
