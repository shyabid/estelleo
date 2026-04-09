"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DoodleGallery from "./DoodleGallery";

const SMOOTH_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

type Point = { x: number; y: number };
type StrokePoint = { x: number; y: number; w?: number };
type Tool =
  | "pen"
  | "brush"
  | "fineliner"
  | "signature"
  | "calligraphy"
  | "eraser";
type Stroke = {
  tool: Tool;
  color: string;
  size: number;
  points: StrokePoint[];
};
type View = { panX: number; panY: number; scale: number };

// Tools whose width varies per sample — rendered segment-by-segment.
const VARIABLE_WIDTH_TOOLS: Tool[] = [
  "brush",
  "signature",
  "calligraphy",
  "eraser",
];

type ToolIconProps = { size?: number; className?: string };

const IconPen = ({ size = 14, className }: ToolIconProps) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M17 3l4 4-12 12-5 1 1-5 12-12z" />
    <path d="M14 6l4 4" />
  </svg>
);

const IconBrush = ({ size = 14, className }: ToolIconProps) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M18 3l3 3-8 8-3-3 8-8z" />
    <path d="M10 11c-3 0-6 3-6 7 0 1 1 2 3 2 3 0 5-2 5-5" />
  </svg>
);

const IconFineliner = ({ size = 14, className }: ToolIconProps) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M12 2v17" />
    <path d="M10 19l2 3 2-3" />
    <path d="M10 5h4" />
  </svg>
);

const IconSignature = ({ size = 14, className }: ToolIconProps) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M3 16c2-4 3-4 5 0s3 3 5-1 3-4 5 0" />
    <path d="M3 20h18" />
  </svg>
);

const IconCalligraphy = ({ size = 14, className }: ToolIconProps) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M20 3l-2 3-11 11-3 1 1-3L16 4l2-2 2 1z" />
    <path d="M15 5l3 3" />
    <path d="M6 17l2 2" />
  </svg>
);

// Drawing tools (eraser is a separate control in the UI).
const DRAW_TOOLS: Array<{
  id: Exclude<Tool, "eraser">;
  Icon: React.FC<ToolIconProps>;
  label: string;
}> = [
  { id: "pen", Icon: IconPen, label: "pen" },
  { id: "brush", Icon: IconBrush, label: "brush" },
  { id: "fineliner", Icon: IconFineliner, label: "fineliner" },
  { id: "signature", Icon: IconSignature, label: "signature" },
  { id: "calligraphy", Icon: IconCalligraphy, label: "calligraphy" },
];

// Absolute cap on eraser width (world units).
const ERASER_MAX_WIDTH = 80;
// Size slider bounds.
const SIZE_MIN = 1;
const SIZE_MAX = 40;
// Stability slider bounds (EMA alpha factor — clamped below 1 for stability).
const STAB_MIN = 0;
const STAB_MAX = 0.85;

const PALETTE = [
  "#2d2d2d", // ink
  "#ff87a0", // rose
  "#ffb3c6", // pink
  "#ffd4b3", // peach
  "#ffe8a3", // butter
  "#b8e8cf", // mint
  "#b3e0ff", // sky
  "#d4bbff", // lavender
  "#ffffff", // white
];

const LOCAL_KEY = "estelleo:drawings";
const MIN_SCALE = 0.15;
const MAX_SCALE = 8;

type LocalDrawing = { id: string; dataUrl: string; createdAt: number };

/**
 * Return the effective stroke width (world units) for a tool given its base
 * size, current pointer speed (screen px / ms, EMA-smoothed), and optional
 * segment direction in radians (only calligraphy uses it).
 */
function computeDynamicWidth(
  tool: Tool,
  baseSize: number,
  speedPxPerMs: number,
  angle?: number,
): number {
  switch (tool) {
    case "brush": {
      // Slow = thick (up to 1.4x), fast = thin (down to 0.35x).
      const factor = Math.max(
        0.35,
        Math.min(1.4, 1.35 - speedPxPerMs * 0.3),
      );
      return baseSize * factor;
    }
    case "signature": {
      // Fast = thick, slow = thin — opposite of brush. Dramatic, showy.
      const factor = Math.max(
        0.4,
        Math.min(2.2, 0.55 + speedPxPerMs * 0.45),
      );
      return baseSize * factor;
    }
    case "calligraphy": {
      // Oblique pen at ~45°: wide along that axis, thin perpendicular.
      const a = angle ?? 0;
      const factor = 0.22 + 0.78 * Math.abs(Math.cos(a - Math.PI / 4));
      return baseSize * factor;
    }
    case "fineliner":
      // Always thin, regardless of size slider.
      return Math.max(1.5, baseSize * 0.35);
    case "eraser": {
      // 0 speed → base size, grows with speed, hard-capped at ERASER_MAX_WIDTH.
      const raw = baseSize * (1 + speedPxPerMs * 0.6);
      return Math.min(ERASER_MAX_WIDTH, raw);
    }
    case "pen":
    default:
      return baseSize;
  }
}

export default function DoodlePad({
  active,
  onBack,
}: {
  active: boolean;
  onBack?: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const eraserCursorRef = useRef<HTMLDivElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const redoStackRef = useRef<Stroke[]>([]);
  const sizeRef = useRef({ w: 0, h: 0 });
  const rafRef = useRef<number | null>(null);

  // View transform (world -> screen): screenX = worldX * scale + panX
  const viewRef = useRef<View>({ panX: 0, panY: 0, scale: 1 });

  // Multi-pointer tracking for pinch/pan
  const pointersRef = useRef<Map<number, Point>>(new Map());
  const pinchStartRef = useRef<{
    dist: number;
    mid: Point;
    view: View;
  } | null>(null);

  // Space-to-pan (desktop)
  const spaceDownRef = useRef(false);
  const panStartRef = useRef<{ pointer: Point; view: View } | null>(null);

  // Velocity tracking for variable-width strokes
  const lastSampleRef = useRef<{ x: number; y: number; t: number } | null>(
    null,
  );
  const smoothedSpeedRef = useRef(0);
  // Current live eraser width in world units (for the cursor overlay)
  const liveEraserWidthRef = useRef(0);
  // Running smoothed position (for stroke stabilization) in local/screen coords.
  const smoothPosRef = useRef<Point | null>(null);
  // Last raw (unsmoothed) pointer position in local coords — used by
  // onPointerUp to flush the lagging smoothed position up to the cursor.
  const lastRawLocalRef = useRef<Point | null>(null);
  // rAF-driven stroke loop state. The smoothing is time-based so the drawn
  // line actively catches up to the cursor even when the pointer isn't moving.
  const strokeRafRef = useRef<number | null>(null);
  const lastFrameTRef = useRef<number>(0);
  // Stability value mirrored into a ref so the pointer effect reads the
  // latest slider value without needing to restart its listeners.
  const stabilityRef = useRef(0.45);

  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState<string>(PALETTE[0]);
  const [size, setSize] = useState<number>(8);
  const [stability, setStability] = useState<number>(0.45);

  // Keep the ref in sync so the pointer effect sees latest stability.
  useEffect(() => {
    stabilityRef.current = stability;
  }, [stability]);
  const [toast, setToast] = useState<string | null>(null);
  const [savedLocalCount, setSavedLocalCount] = useState<number>(0);
  const [galleryOpen, setGalleryOpen] = useState(false);
  // Mobile popovers
  const [mobilePopover, setMobilePopover] = useState<
    "color" | "size" | "stab" | "tool" | null
  >(null);
  // Desktop "pen type" dropup.
  const [desktopToolPop, setDesktopToolPop] = useState(false);
  // Percentage display. Mirrors viewRef.current.scale — updated whenever
  // the view changes (wheel, pinch, pan reset).
  const [zoomPct, setZoomPct] = useState(100);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((t) => (t === msg ? null : t));
    }, 1800);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      const arr = raw ? (JSON.parse(raw) as LocalDrawing[]) : [];
      setSavedLocalCount(Array.isArray(arr) ? arr.length : 0);
    } catch {
      setSavedLocalCount(0);
    }
  }, []);

  useEffect(() => {
    if (galleryOpen) return;
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      const arr = raw ? (JSON.parse(raw) as LocalDrawing[]) : [];
      setSavedLocalCount(Array.isArray(arr) ? arr.length : 0);
    } catch {}
  }, [galleryOpen]);

  // -------------------- Rendering --------------------

  const drawStroke = (ctx: CanvasRenderingContext2D, s: Stroke) => {
    if (s.points.length === 0) return;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Per-tool visual style. Width is handled below.
    let baseWidth = s.size;
    switch (s.tool) {
      case "pen":
      case "brush":
      case "signature":
        ctx.strokeStyle = s.color;
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
        break;
      case "fineliner":
        ctx.strokeStyle = s.color;
        baseWidth = Math.max(1.5, s.size * 0.35);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
        break;
      case "calligraphy":
        ctx.strokeStyle = s.color;
        ctx.globalAlpha = 1;
        ctx.lineCap = "square";
        ctx.lineJoin = "miter";
        ctx.globalCompositeOperation = "source-over";
        break;
      case "eraser":
        ctx.strokeStyle = "rgba(0,0,0,1)";
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "destination-out";
        break;
    }

    const pts = s.points;
    const variable = VARIABLE_WIDTH_TOOLS.includes(s.tool);

    if (pts.length === 1) {
      const p = pts[0];
      const r = (p.w ?? baseWidth) / 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = s.tool === "eraser" ? "rgba(0,0,0,1)" : s.color;
      ctx.fill();
      ctx.restore();
      return;
    }

    if (variable) {
      // Draw segment-by-segment so per-point widths can vary.
      for (let i = 1; i < pts.length; i++) {
        const p0 = pts[i - 1];
        const p1 = pts[i];
        const w =
          ((p0.w ?? baseWidth) + (p1.w ?? baseWidth)) / 2;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
    } else {
      ctx.lineWidth = baseWidth;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const midX = (pts[i].x + pts[i + 1].x) / 2;
        const midY = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.stroke();
    }

    ctx.restore();
  };

  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const { panX, panY, scale } = viewRef.current;

    // Clear in raw pixel space.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // World transform.
    ctx.setTransform(
      dpr * scale,
      0,
      0,
      dpr * scale,
      dpr * panX,
      dpr * panY,
    );

    for (const s of strokesRef.current) drawStroke(ctx, s);
    if (currentStrokeRef.current) drawStroke(ctx, currentStrokeRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scheduleRedraw = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      redrawAll();
    });
  }, [redrawAll]);

  // Set up the canvas sized to its container with DPR scaling.
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    sizeRef.current = { w: rect.width, h: rect.height };
    scheduleRedraw();
  }, [scheduleRedraw]);

  useEffect(() => {
    resizeCanvas();
    const ro = new ResizeObserver(() => resizeCanvas());
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [resizeCanvas]);

  useEffect(() => {
    if (active) resizeCanvas();
  }, [active, resizeCanvas]);

  // -------------------- Pointer handling --------------------

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const toLocal = (e: PointerEvent): Point => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const screenToWorld = (p: Point): Point => {
      const v = viewRef.current;
      return { x: (p.x - v.panX) / v.scale, y: (p.y - v.panY) / v.scale };
    };

    const applyZoomAt = (factor: number, anchor: Point) => {
      const v = viewRef.current;
      const newScale = Math.max(
        MIN_SCALE,
        Math.min(MAX_SCALE, v.scale * factor),
      );
      // Keep the anchor point stationary in world space.
      const wx = (anchor.x - v.panX) / v.scale;
      const wy = (anchor.y - v.panY) / v.scale;
      viewRef.current = {
        scale: newScale,
        panX: anchor.x - wx * newScale,
        panY: anchor.y - wy * newScale,
      };
      setZoomPct(Math.round(newScale * 100));
    };

    const updateCursor = () => {
      if (panStartRef.current) {
        canvas.style.cursor = "grabbing";
      } else if (spaceDownRef.current) {
        canvas.style.cursor = "grab";
      } else {
        canvas.style.cursor = "";
      }
    };

    const pairFromPointers = (): [Point, Point] | null => {
      const values = [...pointersRef.current.values()];
      if (values.length < 2) return null;
      return [values[0], values[1]];
    };

    const stopStrokeLoop = () => {
      if (strokeRafRef.current !== null) {
        cancelAnimationFrame(strokeRafRef.current);
        strokeRafRef.current = null;
      }
      lastFrameTRef.current = 0;
    };

    // Time-based stroke smoothing. Runs every animation frame while a stroke
    // is in progress: pulls the smoothed position toward the latest raw
    // pointer position with a time-constant derived from the stability
    // slider. At max stability, tau = 160ms so the line reaches ~99% of the
    // cursor in ~800ms, even if the pointer is standing still.
    const MAX_TAU_MS = 160;
    const strokeFrame = (t: number) => {
      strokeRafRef.current = null;
      const stroke = currentStrokeRef.current;
      const raw = lastRawLocalRef.current;
      const sp = smoothPosRef.current;
      if (!stroke || !raw || !sp) return;

      const prevT = lastFrameTRef.current || t;
      const dt = Math.max(1, t - prevT);
      lastFrameTRef.current = t;

      const tau = (stabilityRef.current / STAB_MAX) * MAX_TAU_MS;
      const frac = tau <= 0 ? 1 : 1 - Math.exp(-dt / tau);
      const nsp: Point = {
        x: sp.x + (raw.x - sp.x) * frac,
        y: sp.y + (raw.y - sp.y) * frac,
      };
      smoothPosRef.current = nsp;

      // Velocity in screen px/ms, EMA-smoothed for stable width.
      const frameDist = Math.hypot(nsp.x - sp.x, nsp.y - sp.y);
      const instSpeed = frameDist / dt;
      smoothedSpeedRef.current =
        smoothedSpeedRef.current * 0.6 + instSpeed * 0.4;

      const v = viewRef.current;
      const world = screenToWorld(nsp);
      const pts = stroke.points;
      const lastPt = pts[pts.length - 1];
      const dxScreen = (world.x - lastPt.x) * v.scale;
      const dyScreen = (world.y - lastPt.y) * v.scale;
      if (Math.hypot(dxScreen, dyScreen) >= 0.5) {
        const angle = Math.atan2(world.y - lastPt.y, world.x - lastPt.x);
        const dynW = computeDynamicWidth(
          stroke.tool,
          stroke.size,
          smoothedSpeedRef.current,
          angle,
        );
        if (stroke.tool === "eraser") {
          liveEraserWidthRef.current = dynW;
          updateEraserCursor(nsp);
        }
        pts.push({ ...world, w: dynW });
        scheduleRedraw();
      } else if (stroke.tool === "eraser") {
        updateEraserCursor(nsp);
      }

      strokeRafRef.current = requestAnimationFrame(strokeFrame);
    };

    const cancelInProgressStroke = () => {
      if (currentStrokeRef.current) {
        currentStrokeRef.current = null;
        stopStrokeLoop();
        scheduleRedraw();
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse") {
        return;
      }
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      const local = toLocal(e);
      pointersRef.current.set(e.pointerId, local);

      // Space-held panning (mouse only).
      if (spaceDownRef.current && e.pointerType === "mouse") {
        panStartRef.current = {
          pointer: local,
          view: { ...viewRef.current },
        };
        updateCursor();
        return;
      }

      if (pointersRef.current.size === 1) {
        // Reset stabilization and velocity tracking for a fresh stroke.
        smoothPosRef.current = { x: local.x, y: local.y };
        lastRawLocalRef.current = { x: local.x, y: local.y };
        lastSampleRef.current = { x: local.x, y: local.y, t: performance.now() };
        smoothedSpeedRef.current = 0;
        const world = screenToWorld(local);
        const startW = computeDynamicWidth(tool, size, 0);
        if (tool === "eraser") liveEraserWidthRef.current = startW;
        currentStrokeRef.current = {
          tool,
          color,
          size,
          points: [{ ...world, w: startW }],
        };
        redoStackRef.current = [];
        scheduleRedraw();
        // Kick off the time-based smoothing loop for this stroke.
        stopStrokeLoop();
        strokeRafRef.current = requestAnimationFrame(strokeFrame);
      } else if (pointersRef.current.size === 2) {
        // Second finger landed — abandon any in-progress stroke and begin pinch/pan.
        cancelInProgressStroke();
        const pair = pairFromPointers();
        if (pair) {
          const [a, b] = pair;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          pinchStartRef.current = {
            dist: Math.hypot(dx, dy) || 1,
            mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
            view: { ...viewRef.current },
          };
        }
      }
    };

    const updateEraserCursor = (local: Point | null) => {
      const el = eraserCursorRef.current;
      if (!el) return;
      if (tool !== "eraser" || !local) {
        el.style.display = "none";
        return;
      }
      // Size follows live eraser width if drawing, else base size at view scale.
      const drawing = currentStrokeRef.current?.tool === "eraser";
      const worldW = drawing
        ? liveEraserWidthRef.current || size
        : size;
      const screenW = Math.max(10, worldW * viewRef.current.scale);
      el.style.display = "block";
      el.style.width = `${screenW}px`;
      el.style.height = `${screenW}px`;
      el.style.transform = `translate(${local.x - screenW / 2}px, ${local.y - screenW / 2}px)`;
    };

    const onPointerMove = (e: PointerEvent) => {
      const local = toLocal(e);
      // Update eraser cursor on every move, even without a pointer down.
      if (tool === "eraser" && !pointersRef.current.has(e.pointerId)) {
        updateEraserCursor(local);
      }
      if (!pointersRef.current.has(e.pointerId)) return;
      pointersRef.current.set(e.pointerId, local);

      if (panStartRef.current) {
        const start = panStartRef.current;
        viewRef.current = {
          scale: start.view.scale,
          panX: start.view.panX + (local.x - start.pointer.x),
          panY: start.view.panY + (local.y - start.pointer.y),
        };
        scheduleRedraw();
        return;
      }

      if (pointersRef.current.size >= 2 && pinchStartRef.current) {
        const pair = pairFromPointers();
        if (!pair) return;
        const [a, b] = pair;
        const newDist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const newMid: Point = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const start = pinchStartRef.current;
        const rawScale =
          start.view.scale * (newDist / start.dist);
        const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, rawScale));
        // Anchor the initial midpoint in world space.
        const wx = (start.mid.x - start.view.panX) / start.view.scale;
        const wy = (start.mid.y - start.view.panY) / start.view.scale;
        viewRef.current = {
          scale,
          panX: newMid.x - wx * scale,
          panY: newMid.y - wy * scale,
        };
        setZoomPct(Math.round(scale * 100));
        scheduleRedraw();
      } else if (pointersRef.current.size === 1 && currentStrokeRef.current) {
        // Just record the latest raw pointer position. The rAF loop
        // (strokeFrame) owns all smoothing, speed tracking, and point
        // emission, so the drawn line actively catches up to the cursor.
        lastRawLocalRef.current = { x: local.x, y: local.y };
        if (currentStrokeRef.current.tool === "eraser") {
          // Keep the eraser halo glued to the real cursor so it doesn't
          // appear to lag behind the hand.
          updateEraserCursor(local);
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!pointersRef.current.has(e.pointerId)) {
        // Hide cursor on touch-up even when we never got a draw-start.
        if (e.pointerType !== "mouse") updateEraserCursor(null);
        return;
      }
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {}
      pointersRef.current.delete(e.pointerId);

      if (panStartRef.current && pointersRef.current.size === 0) {
        panStartRef.current = null;
        updateCursor();
      }

      if (pointersRef.current.size < 2) {
        pinchStartRef.current = null;
      }
      if (pointersRef.current.size === 0 && currentStrokeRef.current) {
        // Stop the time-based stroke loop; any residual gap is closed below.
        stopStrokeLoop();
        // Close any remaining lag: linearly interpolate from the smoothed
        // position up to the last raw pointer position so the stroke
        // visibly reaches the cursor no matter how high the slider is.
        const stroke = currentStrokeRef.current;
        const sp = smoothPosRef.current;
        const raw = lastRawLocalRef.current;
        if (sp && raw) {
          const dx = raw.x - sp.x;
          const dy = raw.y - sp.y;
          const distScreen = Math.hypot(dx, dy);
          if (distScreen > 0.5) {
            const pts = stroke.points;
            const lastPt = pts[pts.length - 1];
            // Keep width consistent with the final sample so the tail
            // doesn't swell.
            const tailWidth =
              lastPt?.w ?? stroke.size;
            const steps = Math.min(20, Math.max(4, Math.round(distScreen / 3)));
            for (let i = 1; i <= steps; i++) {
              const t = i / steps;
              const lx = sp.x + dx * t;
              const ly = sp.y + dy * t;
              const world = screenToWorld({ x: lx, y: ly });
              pts.push({ ...world, w: tailWidth });
            }
          }
        }
        strokesRef.current.push(stroke);
        currentStrokeRef.current = null;
        smoothPosRef.current = null;
        lastRawLocalRef.current = null;
        scheduleRedraw();
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const anchor: Point = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      // Zoom factor from wheel delta; dampen for smoother feel.
      const factor = Math.exp(-e.deltaY * 0.0015);
      applyZoomAt(factor, anchor);
      scheduleRedraw();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !spaceDownRef.current) {
        // Don't hijack space in form fields.
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        spaceDownRef.current = true;
        updateCursor();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceDownRef.current = false;
        // Don't cancel an in-progress pan mid-drag — let it finish on pointer up.
        if (!panStartRef.current) updateCursor();
      }
    };

    const onPointerLeave = (e: PointerEvent) => {
      updateEraserCursor(null);
      onPointerUp(e);
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.style.touchAction = "none";

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      // Stop any in-flight stroke loop when the effect tears down.
      if (strokeRafRef.current !== null) {
        cancelAnimationFrame(strokeRafRef.current);
        strokeRafRef.current = null;
      }
      lastFrameTRef.current = 0;
      // Hide the eraser cursor when switching tools or unmounting.
      if (eraserCursorRef.current) {
        eraserCursorRef.current.style.display = "none";
      }
    };
  }, [tool, color, size, scheduleRedraw]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (!mod && e.key.toLowerCase() === "e") {
        setTool("eraser");
      } else if (!mod && e.key.toLowerCase() === "b") {
        setTool("pen");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const undo = () => {
    const s = strokesRef.current.pop();
    if (s) {
      redoStackRef.current.push(s);
      scheduleRedraw();
    }
  };

  const redo = () => {
    const s = redoStackRef.current.pop();
    if (s) {
      strokesRef.current.push(s);
      scheduleRedraw();
    }
  };

  const clear = () => {
    if (strokesRef.current.length === 0 && !currentStrokeRef.current) return;
    strokesRef.current = [];
    currentStrokeRef.current = null;
    redoStackRef.current = [];
    scheduleRedraw();
    showToast("cleared 𔓐𑇓");
  };

  const resetView = () => {
    viewRef.current = { panX: 0, panY: 0, scale: 1 };
    setZoomPct(100);
    scheduleRedraw();
  };

  // Export only the currently-visible viewport as a PNG (white bg).
  const exportPng = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const out = document.createElement("canvas");
    out.width = canvas.width;
    out.height = canvas.height;
    const ctx = out.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, 0, 0);
    return out.toDataURL("image/png");
  };

  const saveLocal = () => {
    const dataUrl = exportPng();
    if (!dataUrl) return;
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      const arr: LocalDrawing[] = raw ? JSON.parse(raw) : [];
      const entry: LocalDrawing = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        dataUrl,
        createdAt: Date.now(),
      };
      arr.push(entry);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(arr));
      setSavedLocalCount(arr.length);
      showToast("saved 𔓐𑇓");
    } catch {
      showToast("couldn't save");
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center px-4 md:px-10 py-6 md:py-10 relative">
      {/* Header row: back button on the left, title centered */}
      <div className="w-full flex items-center justify-center mb-3 md:mb-5 relative -mt-2.5">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="back to intro"
            className="absolute left-2.5 flex items-center gap-1 text-black/50 hover:text-black transition-colors"
          >
            <span className="text-lg md:text-xl leading-none">←</span>
            <span className="text-[9px] md:text-[10px] font-mono tracking-[0.3em] uppercase">
              back
            </span>
          </button>
        )}
        <span className="text-[10px] md:text-xs uppercase tracking-[0.3em] opacity-50 font-mono">
          𔓐𑇓 doodle pad 𔓐𑇓
        </span>
      </div>

      {/* Canvas area */}
      <div
        ref={wrapRef}
        data-lenis-prevent
        className="relative w-full flex-1 min-h-0 rounded-[2.5vh] md:rounded-[3.5vh] bg-pink-50 border border-pink-200/60 overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          data-lenis-prevent
          className="block w-full h-full"
        />
        {/* Eraser cursor overlay — shown only while eraser is active. */}
        <div
          ref={eraserCursorRef}
          className="pointer-events-none absolute top-0 left-0 rounded-md border-2 border-dashed border-black/55 bg-white/10 will-change-transform"
          style={{ display: "none" }}
        />
        {/* Zoom % pill → click to reset to 100% */}
        <button
          onClick={resetView}
          title="reset to 100%"
          className="absolute bottom-5 md:bottom-7 right-5 md:right-7 flex items-center gap-1.5 text-[10px] md:text-[11px] font-mono tabular-nums tracking-wider px-3 py-1.5 rounded-full bg-white/95 border border-pink-200/60 text-black/70 hover:text-black hover:bg-white transition-colors shadow-sm"
        >
          <span>{zoomPct}%</span>
          <span className="text-sm leading-none">⟲</span>
        </button>
      </div>

      {/* ============================== Desktop toolbar ============================== */}
      <div className="hidden md:flex mt-5 w-full max-w-3xl flex-col gap-3 items-center">
        {/* Row 1 — tools + sizes */}
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <div className="flex bg-pink-50 rounded-full p-1 gap-1 border border-pink-200/60 relative">
            {/* Pen-type dropup — shows current drawing tool, click to switch. */}
            <button
              onClick={() => setDesktopToolPop((v) => !v)}
              className={`px-4 py-1.5 rounded-full text-xs uppercase tracking-widest flex items-center gap-1.5 transition-colors ${
                tool !== "eraser"
                  ? "bg-white text-black"
                  : "text-black/50 hover:text-black/80"
              }`}
            >
              {(() => {
                const entry =
                  DRAW_TOOLS.find((t) => t.id === tool) ?? DRAW_TOOLS[0];
                const Icon = entry.Icon;
                return (
                  <>
                    <Icon size={14} />
                    <span>{entry.label}</span>
                  </>
                );
              })()}
              <span className="text-[9px] opacity-50 ml-0.5">▾</span>
            </button>

            <ToolPill
              label="eraser"
              icon="◌"
              active={tool === "eraser"}
              onClick={() => {
                setTool("eraser");
                setDesktopToolPop(false);
              }}
            />

            <AnimatePresence>
              {desktopToolPop && (
                <motion.div
                  key="desktop-tool-pop"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="absolute bottom-full left-0 mb-2 bg-white rounded-2xl p-1.5 flex flex-col gap-1 border border-pink-200/60 shadow-md min-w-[130px] z-10"
                >
                  {DRAW_TOOLS.map((t) => {
                    const Icon = t.Icon;
                    return (
                      <button
                        key={t.id}
                        onClick={() => {
                          setTool(t.id);
                          setDesktopToolPop(false);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs uppercase tracking-widest flex items-center gap-2 transition-colors ${
                          tool === t.id
                            ? "bg-pink-100 text-black"
                            : "text-black/60 hover:text-black hover:bg-pink-50"
                        }`}
                      >
                        <Icon size={14} />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <SliderPill
            label="size"
            min={SIZE_MIN}
            max={SIZE_MAX}
            step={1}
            value={size}
            onChange={setSize}
            display={Math.round(size).toString()}
          />

          <SliderPill
            label="stab"
            min={STAB_MIN}
            max={STAB_MAX}
            step={0.01}
            value={stability}
            onChange={setStability}
            display={`${Math.round((stability / STAB_MAX) * 100)}`}
          />
        </div>

        {/* Row 2 — palette */}
        <div className="flex bg-pink-50 rounded-full p-1 gap-1 border border-pink-200/60">
          {PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => {
                setColor(c);
                setTool("pen");
              }}
              className={`rounded-full transition-transform ${
                color === c && tool === "pen"
                  ? "scale-110 ring-2 ring-pink-300 ring-offset-1 ring-offset-pink-50"
                  : "hover:scale-105"
              }`}
              style={{
                width: 26,
                height: 26,
                backgroundColor: c,
                border: c === "#ffffff" ? "1px solid #e5c5d0" : "none",
              }}
              aria-label={`color ${c}`}
            />
          ))}
        </div>

        {/* Row 3 — actions */}
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <ActionButton onClick={undo} label="undo" />
          <ActionButton onClick={redo} label="redo" />
          <ActionButton onClick={clear} label="clear" tone="muted" />
          <div className="w-px h-5 bg-pink-200 mx-1" />
          <ActionButton
            onClick={saveLocal}
            label={savedLocalCount > 0 ? `save 𔓐𑇓 (${savedLocalCount})` : "save 𔓐𑇓"}
            tone="primary"
          />
          <ActionButton onClick={() => setGalleryOpen(true)} label="my doodles" />
        </div>
      </div>

      {/* ============================== Mobile toolbar ============================== */}
      <div className="flex md:hidden mt-3 w-full flex-col items-center gap-2 relative">
        {/* Row 1 — settings: tool, eraser, color, size, stability */}
        <div className="flex items-center gap-1 bg-pink-50 rounded-full p-1 border border-pink-200/60">
          <IconBtn
            active={mobilePopover === "tool" || tool !== "eraser"}
            onClick={() =>
              setMobilePopover((p) => (p === "tool" ? null : "tool"))
            }
            label="pen type"
          >
            {(() => {
              const entry =
                DRAW_TOOLS.find((t) => t.id === tool) ?? DRAW_TOOLS[0];
              const Icon = entry.Icon;
              return <Icon size={16} />;
            })()}
          </IconBtn>
          <IconBtn
            active={tool === "eraser"}
            onClick={() => {
              setTool("eraser");
              setMobilePopover(null);
            }}
            label="eraser"
          >
            <span className="text-base leading-none">◌</span>
          </IconBtn>
          <IconBtn
            onClick={() =>
              setMobilePopover((p) => (p === "color" ? null : "color"))
            }
            active={mobilePopover === "color"}
            label="color"
          >
            <span
              className="block rounded-full"
              style={{
                width: 14,
                height: 14,
                backgroundColor: color,
                border: color === "#ffffff" ? "1px solid #e5c5d0" : "none",
              }}
            />
          </IconBtn>
          <IconBtn
            onClick={() =>
              setMobilePopover((p) => (p === "size" ? null : "size"))
            }
            active={mobilePopover === "size"}
            label="size"
          >
            <span
              className="block rounded-full bg-black/80"
              style={{
                width: Math.max(4, Math.min(16, size * 0.55)),
                height: Math.max(4, Math.min(16, size * 0.55)),
              }}
            />
          </IconBtn>
          <IconBtn
            onClick={() =>
              setMobilePopover((p) => (p === "stab" ? null : "stab"))
            }
            active={mobilePopover === "stab"}
            label="stability"
          >
            <span className="text-[9px] leading-none font-mono tabular-nums">
              {Math.round((stability / STAB_MAX) * 100)}
            </span>
          </IconBtn>
        </div>

        {/* Row 2 — actions: undo, redo, clear, save, gallery */}
        <div className="flex items-center gap-1 bg-pink-50 rounded-full p-1 border border-pink-200/60">
          <IconBtn onClick={undo} label="undo">
            <span className="text-base leading-none">↶</span>
          </IconBtn>
          <IconBtn onClick={redo} label="redo">
            <span className="text-base leading-none">↷</span>
          </IconBtn>
          <IconBtn onClick={clear} label="clear">
            <span className="text-sm leading-none">✕</span>
          </IconBtn>
          <div className="w-px h-5 bg-pink-200 mx-0.5" />
          <IconBtn onClick={saveLocal} label="save" tone="primary">
            <span className="text-sm leading-none">𔓐𑇓</span>
          </IconBtn>
          <IconBtn
            onClick={() => setGalleryOpen(true)}
            label="my doodles"
          >
            <span className="text-[11px] leading-none">▦</span>
          </IconBtn>
        </div>

        {/* Mobile popovers */}
        <AnimatePresence>
          {mobilePopover === "tool" && (
            <motion.div
              key="tool-pop"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="absolute bottom-full mb-2 bg-white rounded-full p-1.5 gap-1 flex border border-pink-200/60 shadow-sm items-center"
            >
              {DRAW_TOOLS.map((t) => {
                const Icon = t.Icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTool(t.id);
                      setMobilePopover(null);
                    }}
                    className={`flex items-center justify-center rounded-full transition-colors ${
                      tool === t.id
                        ? "bg-pink-100 text-black"
                        : "text-black/60 hover:text-black"
                    }`}
                    style={{ width: 32, height: 32 }}
                    aria-label={t.label}
                    title={t.label}
                  >
                    <Icon size={16} />
                  </button>
                );
              })}
            </motion.div>
          )}
          {mobilePopover === "color" && (
            <motion.div
              key="color-pop"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.22, ease: SMOOTH_EASE }}
              className="absolute bottom-full mb-2 bg-white rounded-full p-1.5 gap-1 flex border border-pink-200/60 shadow-sm"
            >
              {PALETTE.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setColor(c);
                    setTool("pen");
                    setMobilePopover(null);
                  }}
                  className={`rounded-full ${
                    color === c
                      ? "ring-2 ring-pink-300 ring-offset-1 ring-offset-white"
                      : ""
                  }`}
                  style={{
                    width: 22,
                    height: 22,
                    backgroundColor: c,
                    border: c === "#ffffff" ? "1px solid #e5c5d0" : "none",
                  }}
                  aria-label={`color ${c}`}
                />
              ))}
            </motion.div>
          )}
          {mobilePopover === "size" && (
            <motion.div
              key="size-pop"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white rounded-full px-3 py-2 flex items-center gap-2 border border-pink-200/60 shadow-sm"
            >
              <span className="text-[9px] uppercase tracking-widest opacity-60 font-mono">
                size
              </span>
              <BrushSlider
                min={SIZE_MIN}
                max={SIZE_MAX}
                step={1}
                value={size}
                onChange={setSize}
                width={120}
                ariaLabel="size"
              />
              <span className="text-[9px] tabular-nums opacity-60 font-mono min-w-[20px] text-right">
                {Math.round(size)}
              </span>
            </motion.div>
          )}
          {mobilePopover === "stab" && (
            <motion.div
              key="stab-pop"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white rounded-full px-3 py-2 flex items-center gap-2 border border-pink-200/60 shadow-sm"
            >
              <span className="text-[9px] uppercase tracking-widest opacity-60 font-mono">
                stab
              </span>
              <BrushSlider
                min={STAB_MIN}
                max={STAB_MAX}
                step={0.01}
                value={stability}
                onChange={setStability}
                width={120}
                ariaLabel="stab"
              />
              <span className="text-[9px] tabular-nums opacity-60 font-mono min-w-[24px] text-right">
                {Math.round((stability / STAB_MAX) * 100)}%
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: SMOOTH_EASE }}
            className="absolute top-4 md:top-6 left-1/2 -translate-x-1/2 bg-white/95 text-black/80 text-xs md:text-sm px-4 py-2 rounded-full border border-pink-200 shadow-sm pointer-events-none"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <DoodleGallery open={galleryOpen} onClose={() => setGalleryOpen(false)} />
    </div>
  );
}

function ToolPill({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 md:px-4 py-1.5 rounded-full text-[11px] md:text-xs uppercase tracking-widest flex items-center gap-1.5 transition-colors ${
        active ? "bg-white text-black" : "text-black/50 hover:text-black/80"
      }`}
    >
      <span className="text-sm">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function ActionButton({
  label,
  onClick,
  tone = "default",
}: {
  label: string;
  onClick: () => void;
  tone?: "default" | "primary" | "muted";
}) {
  const cls =
    tone === "primary"
      ? "bg-black text-white hover:bg-black/85"
      : tone === "muted"
        ? "bg-pink-50 text-black/60 hover:text-black border border-pink-200/60"
        : "bg-white text-black/80 hover:text-black border border-pink-200/60";
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      transition={{ type: "tween", duration: 0.12, ease: "easeOut" }}
      onClick={onClick}
      className={`px-3 md:px-4 py-1.5 md:py-2 rounded-full text-[11px] md:text-xs uppercase tracking-widest ${cls}`}
    >
      {label}
    </motion.button>
  );
}

/**
 * Organic brushstroke slider: renders a tapered horizontal stroke with a
 * bump at the thumb position, as if the value were drawn by hand. Dragging
 * anywhere along the stroke updates the value.
 */
function BrushSlider({
  min,
  max,
  step,
  value,
  onChange,
  width = 120,
  height = 26,
  ariaLabel,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  width?: number;
  height?: number;
  ariaLabel?: string;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const draggingRef = useRef(false);
  const range = max - min;
  const t = range > 0 ? Math.max(0, Math.min(1, (value - min) / range)) : 0;

  // Pixel-space dimensions so the bump shape stays consistent across widths.
  const bumpAmp = 7.5; // peak half-height of the bump
  const bumpHalfW = 18; // horizontal half-width of the bump (wider = rounder)
  const pad = bumpHalfW + 1; // keep the full hump inside the SVG at t=0 and t=1
  const innerW = Math.max(1, width - pad * 2);
  const bumpCenterX = pad + t * innerW;

  const pathD = useMemo(() => {
    const N = 160;
    const cy = height / 2;
    const topPts: string[] = [];
    const botPts: string[] = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const x = u * width;
      // Soft tapered baseline: thin at the ends, a hair thicker in the middle.
      const base = 0.8 + 1.7 * Math.sin(Math.PI * u);
      // Smoothstep-squared hump: flat-ish plateau at the peak, zero slope
      // at both the peak and the edges, so the top of the wave looks
      // softly rounded rather than spiky. Mirrored above and below.
      const d = x - bumpCenterX;
      let bump = 0;
      const ad = Math.abs(d);
      if (ad < bumpHalfW) {
        // s goes 1 at d=0 → 0 at |d|=bumpHalfW, with zero derivative at both ends.
        const q = 1 - ad / bumpHalfW;
        const s = q * q * (3 - 2 * q); // smoothstep
        bump = bumpAmp * s;
      }
      topPts.push(`${x.toFixed(2)},${(cy - base - bump).toFixed(2)}`);
      botPts.push(`${x.toFixed(2)},${(cy + base + bump).toFixed(2)}`);
    }
    const top = `M ${topPts[0]} L ${topPts.slice(1).join(" L ")}`;
    const bot = ` L ${botPts.slice().reverse().join(" L ")} Z`;
    return top + bot;
  }, [width, height, bumpCenterX]);

  const updateFromClientX = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scale = rect.width / width;
    const left = pad * scale;
    const right = (width - pad) * scale;
    const inner = Math.max(1, right - left);
    const u = Math.max(0, Math.min(1, (clientX - rect.left - left) / inner));
    let v = min + u * range;
    if (step > 0) v = Math.round(v / step) * step;
    v = Math.max(min, Math.min(max, v));
    if (v !== value) onChange(v);
  };

  const onPointerDown: React.PointerEventHandler<SVGSVGElement> = (e) => {
    e.preventDefault();
    draggingRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    updateFromClientX(e.clientX);
  };
  const onPointerMove: React.PointerEventHandler<SVGSVGElement> = (e) => {
    if (!draggingRef.current) return;
    updateFromClientX(e.clientX);
  };
  const endDrag: React.PointerEventHandler<SVGSVGElement> = (e) => {
    draggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{ touchAction: "none", cursor: "pointer", display: "block" }}
    >
      <path d={pathD} fill="#2d2d2d" />
    </svg>
  );
}

function SliderPill({
  label,
  min,
  max,
  step,
  value,
  onChange,
  display,
  width = 90,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  display: string;
  width?: number;
}) {
  return (
    <div className="flex items-center bg-pink-50 rounded-full p-1 border border-pink-200/60">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <span className="text-[11px] md:text-xs uppercase tracking-[0.2em] opacity-60 font-mono leading-none">
          {label}
        </span>
        <BrushSlider
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={onChange}
          width={width}
          ariaLabel={label}
        />
        <span className="text-[11px] md:text-xs tabular-nums opacity-60 font-mono min-w-[22px] text-right leading-none">
          {display}
        </span>
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  active = false,
  label,
  tone = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  label: string;
  tone?: "default" | "primary";
}) {
  const base =
    "flex items-center justify-center rounded-full transition-colors shrink-0";
  const cls = active
    ? "bg-white text-black"
    : tone === "primary"
      ? "bg-black text-white"
      : "text-black/60 hover:text-black hover:bg-white/60";
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`${base} ${cls}`}
      style={{ width: 32, height: 32 }}
    >
      {children}
    </button>
  );
}
