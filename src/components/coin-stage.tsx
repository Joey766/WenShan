"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { coinFace, type Coins } from "@/lib/yijing";

const radius = 0.36;
const thickness = 0.075;
const restY = thickness / 2 + 0.022;
const slots = [-1.03, 0, 1.03];
const startingCoins = [3, 3, 3] as const;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => { const t = clamp(v); return t * t * (3 - 2 * t); };
export const tossMs = 1680;

function paintedTexture(draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function ring(ctx: CanvasRenderingContext2D, r: number, color: string, width: number) {
  ctx.beginPath();
  ctx.arc(256, 256, r, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function faceTexture(front: boolean, onReady: () => void) {
  let painter: CanvasRenderingContext2D | undefined;
  function mark(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(202, 202, 108, 108);
    ctx.font = 'bold 81px "Noto Serif SC", SimSun, serif';
    ctx.fillStyle = "#543824";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(front ? "正" : "反", 256, 149);
    ctx.font = "bold 55px Georgia, serif";
    ctx.fillText(front ? "3" : "2", 256, 366);
  }
  const texture = paintedTexture(ctx => {
    painter = ctx;
    const bronze = ctx.createRadialGradient(178, 146, 15, 256, 256, 266);
    bronze.addColorStop(0, front ? "#e5bd72" : "#d0aa62");
    bronze.addColorStop(0.66, front ? "#bd8b41" : "#a67d45");
    bronze.addColorStop(1, "#805b31");
    ctx.beginPath();
    ctx.arc(256, 256, 251, 0, Math.PI * 2);
    ctx.fillStyle = bronze;
    ctx.fill();
    ring(ctx, 236, "#f0cc82", 9);
    ring(ctx, 219, "#745235", 4);
    ring(ctx, 204, front ? "#e0b96d" : "#d0ae68", 4);
    for (let i = 0; i < 48; i++) {
      const a = i / 48 * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(256 + Math.cos(a) * 225, 256 + Math.sin(a) * 225);
      ctx.lineTo(256 + Math.cos(a) * 231, 256 + Math.sin(a) * 231);
      ctx.strokeStyle = "#805832";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.strokeStyle = "#e9c485";
    ctx.lineWidth = 8;
    ctx.strokeRect(198, 198, 116, 116);
    mark(ctx);
  });
  const image = new Image();
  image.onload = () => {
    if (!painter) return;
    painter.save();
    painter.beginPath();
    painter.arc(256, 256, 249, 0, Math.PI * 2);
    painter.clip();
    painter.drawImage(image, -19, -19, 550, 550);
    painter.restore();
    mark(painter);
    texture.needsUpdate = true;
    onReady();
  };
  image.src = `/art/world/coin-${front ? "yang" : "yin"}.webp`;
  return { texture, stop: () => { image.onload = null; } };
}

function setup(host: HTMLDivElement, onTextureReady: () => void) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setClearColor(0x000000, 0);
  const limited = host.closest('[data-quality="lite"]') !== null || matchMedia("(max-width: 720px)").matches;
  renderer.setPixelRatio(Math.min(limited ? 1.18 : 1.55, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(39, 1, 0.1, 40);
  scene.add(new THREE.HemisphereLight(0xffeccb, 0x5b4c64, 2.15));
  const sun = new THREE.DirectionalLight(0xffd5a0, 2.2);
  sun.position.set(-2, 6, 3);
  scene.add(sun);

  const shape = new THREE.Shape();
  shape.absarc(0, 0, radius, 0, 2 * Math.PI, false);
  const opening = new THREE.Path();
  const half = radius * 0.212;
  opening.moveTo(-half, -half);
  opening.lineTo(-half, half);
  opening.lineTo(half, half);
  opening.lineTo(half, -half);
  opening.closePath();
  shape.holes.push(opening);
  const bodyGeometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.009,
    bevelSegments: 2, curveSegments: 32, steps: 1,
  }).translate(0, 0, -thickness / 2);
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x96622d, metalness: 0.46, roughness: 0.53 });
  const faceGeometry = new THREE.PlaneGeometry(radius * 2, radius * 2);
  const front = faceTexture(true, onTextureReady);
  const back = faceTexture(false, onTextureReady);
  const frontTexture = front.texture;
  const backTexture = back.texture;
  const frontMat = new THREE.MeshStandardMaterial({ map: frontTexture, alphaTest: 0.5, roughness: 0.58, metalness: 0.13 });
  const backMat = new THREE.MeshStandardMaterial({ map: backTexture, alphaTest: 0.5, roughness: 0.62, metalness: 0.16 });
  const shadowGeometry = new THREE.CircleGeometry(radius * 1.08, 24);
  const shadows = slots.map(() => {
    const shadow = new THREE.Mesh(shadowGeometry, new THREE.MeshBasicMaterial({ color: 0x231914, transparent: true, opacity: 0.2, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    scene.add(shadow);
    return shadow;
  });
  const coins = slots.map(x => {
    const pivot = new THREE.Group();
    const coin = new THREE.Group();
    coin.rotation.x = -Math.PI / 2;
    coin.add(new THREE.Mesh(bodyGeometry, bodyMaterial));
    const front = new THREE.Mesh(faceGeometry, frontMat);
    front.position.z = thickness / 2 + 0.011;
    const back = new THREE.Mesh(faceGeometry, backMat);
    back.position.z = -front.position.z;
    back.rotation.x = Math.PI;
    coin.add(front, back);
    pivot.position.set(x, restY, 0);
    pivot.add(coin);
    scene.add(pivot);
    return pivot;
  });

  function draw(progress: number, faces: Coins, hasResult: boolean) {
    const follow = ease(progress / 0.52);
    const overhead = hasResult ? ease((progress - 0.34) / 0.51) : 0;
    const targetY = hasResult ? 1.07 * Math.sin(Math.PI * clamp(progress / 0.81)) : 0;
    const vertical = camera.aspect < 1.16 ? 1.12 / camera.aspect : 1;
    camera.position.set(0, (2.05 + overhead * 6.6 + targetY * follow) * vertical, (5.9 - overhead * 5.62) * vertical);
    camera.lookAt(0, 0.4 + targetY * 0.82 - overhead * 0.41, 0);

    coins.forEach((coin, i) => {
      const t = hasResult ? clamp((progress - i * 0.027) / (0.95 - i * 0.027)) : 0;
      const height = t < 0.74
        ? (2.09 - i * 0.12) * Math.sin(Math.PI * t / 0.74)
        : 0.25 * Math.abs(Math.sin((t - 0.74) / 0.26 * Math.PI * 2)) * (1 - (t - 0.74) / 0.26);
      const aim = faces[i] === 3 ? 0 : Math.PI;
      const roll = ease(t / 0.77);
      const wobble = Math.sin(t * Math.PI * 4) * (1 - roll);
      coin.rotation.set((Math.PI * (4 + i * 2) + aim) * roll, wobble * 0.42, wobble * 0.5);
      coin.position.set(slots[i] * (1 + Math.sin(t * Math.PI) * 0.17), restY + height, -0.12 - Math.sin(t * Math.PI) * 0.16);
      shadows[i].position.set(coin.position.x, 0.005, coin.position.z);
      shadows[i].material.opacity = 0.22 / (1 + height * 2.6);
      shadows[i].scale.setScalar(1 + height * 0.18);
    });
    renderer.render(scene, camera);
  }
  function resize() {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  function dispose() {
    front.stop();
    back.stop();
    scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => material.dispose());
    });
    [frontTexture, backTexture].forEach(texture => texture.dispose());
    renderer.dispose();
    renderer.domElement.remove();
  }

  return { draw, resize, dispose, canvas: renderer.domElement };
}

export default function CoinStage({ coins, started, reduced }: { coins?: Coins; started?: number; reduced: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef({ coins, started, reduced });
  const refresh = useRef<() => void>(undefined);
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    latest.current = { coins, started, reduced };
    refresh.current?.();
  }, [coins, started, reduced]);

  useEffect(() => {
    if (!host.current) return;
    let engine: ReturnType<typeof setup>;
    try { engine = setup(host.current, () => refresh.current?.()); }
    catch { setFallback(true); return; }
    let frame = 0;
    const animate = (now: number) => {
      const { coins: faces, started: from, reduced: staticView } = latest.current;
      const progress = faces && !staticView && from !== undefined ? clamp((now - from) / tossMs) : faces ? 1 : 0;
      engine.draw(progress, faces ?? startingCoins, !!faces);
      if (faces && progress < 1) frame = requestAnimationFrame(animate);
    };
    const redraw = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(animate); };
    const lost = (event: Event) => { event.preventDefault(); cancelAnimationFrame(frame); setFallback(true); };
    const restored = () => { setFallback(false); redraw(); };
    engine.canvas.addEventListener("webglcontextlost", lost);
    engine.canvas.addEventListener("webglcontextrestored", restored);
    const resize = new ResizeObserver(() => { engine.resize(); redraw(); });
    resize.observe(host.current);
    refresh.current = redraw;
    engine.resize();
    redraw();
    return () => {
      refresh.current = undefined;
      cancelAnimationFrame(frame);
      resize.disconnect();
      engine.canvas.removeEventListener("webglcontextlost", lost);
      engine.canvas.removeEventListener("webglcontextrestored", restored);
      engine.dispose();
    };
  }, []);

  return <div className="coin-stage" aria-hidden="true">
    <div className={`webgl-host ${fallback ? "webgl-unavailable" : ""}`} ref={host} />
    {fallback && <div className={`fallback-coins ${started !== undefined && !reduced ? "fallback-toss" : ""}`} key={started}>
      {(coins ?? startingCoins).map((coin, i) => <span key={i}><b>{coinFace[coin][0]}</b><i /><b>{coin}</b></span>)}
    </div>}
  </div>;
}
