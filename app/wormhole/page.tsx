"use client";

import { useEffect, useRef } from "react";

// Easing functions
const easingUtils = {
  linear: (t: number) => t,
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  easeOutExpo: (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  easeInExpo: (t: number) => t === 0 ? 0 : Math.pow(2, 10 * t - 10),
};

interface Disc {
  p: number;
  sx: number;
  sy: number;
  w: number;
  h: number;
  x: number;
  y: number;
  a: number;
}

interface Dot {
  d: Disc;
  a: number;
  c: string;
  p: number;
  o: number;
}

interface RenderInfo {
  width: number;
  hWidth: number;
  height: number;
  hHeight: number;
  dpi: number;
}

export default function WormholePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);
  const discsRef = useRef<Disc[]>([]);
  const dotsRef = useRef<Dot[]>([]);
  const renderRef = useRef<RenderInfo>({
    width: 0,
    hWidth: 0,
    height: 0,
    hHeight: 0,
    dpi: 1.9,
  });
  const startDiscRef = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const tweenValue = (start: number, end: number, p: number, ease: keyof typeof easingUtils = "linear") => {
    const delta = end - start;
    const easeFn = easingUtils[ease];
    return start + delta * easeFn(p);
  };

  const tweenDisc = (disc: Disc) => {
    const startDisc = startDiscRef.current;

    const scaleX = tweenValue(1, 0, disc.p, "easeOutCubic");
    const scaleY = tweenValue(1, 0, disc.p, "easeOutExpo");

    disc.sx = scaleX;
    disc.sy = scaleY;

    disc.w = startDisc.w * scaleX;
    disc.h = startDisc.h * scaleY;

    disc.x = startDisc.x;
    disc.y = startDisc.y + disc.p * startDisc.h * 1;

    return disc;
  };

  const setDiscs = () => {
    const render = renderRef.current;
    const discs: Disc[] = [];

    startDiscRef.current = {
      x: render.width * 0.5,
      y: render.height * 0,
      w: render.width * 1,
      h: render.height * 1,
    };

    const totalDiscs = 150;

    for (let i = 0; i < totalDiscs; i++) {
      const p = i / totalDiscs;

      const disc: Disc = {
        p,
        sx: 0,
        sy: 0,
        w: 0,
        h: 0,
        x: 0,
        y: 0,
        a: 0,
      };

      tweenDisc(disc);
      discs.push(disc);
    }

    discsRef.current = discs;
  };

  const setDots = () => {
    const dots: Dot[] = [];
    const discs = discsRef.current;
    const totalDots = 15000;

    // Pink color palette
    const pinkColors = [
      // Light pinks
      (r: number) => `rgb(${255}, ${180 + r * 50}, ${200 + r * 55})`,
      // Rose pinks
      (r: number) => `rgb(${255}, ${150 + r * 80}, ${180 + r * 75})`,
      // Hot pinks
      (r: number) => `rgb(${255}, ${100 + r * 100}, ${150 + r * 105})`,
      // Soft pinks
      (r: number) => `rgb(${250 + r * 5}, ${200 + r * 30}, ${220 + r * 35})`,
      // White-ish stars
      (r: number) => `rgb(${255}, ${240 + r * 15}, ${245 + r * 10})`,
    ];

    for (let i = 0; i < totalDots; i++) {
      const disc = discs[Math.floor(discs.length * Math.random())];
      const colorFn = pinkColors[Math.floor(Math.random() * pinkColors.length)];
      
      const dot: Dot = {
        d: disc,
        a: 0,
        c: colorFn(Math.random()),
        p: Math.random(),
        o: Math.random(),
      };

      dots.push(dot);
    }

    dotsRef.current = dots;
  };

  const setSizes = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();

    renderRef.current = {
      width: rect.width,
      hWidth: rect.width * 0.5,
      height: rect.height,
      hHeight: rect.height * 0.5,
      dpi: window.devicePixelRatio,
    };

    canvas.width = renderRef.current.width * renderRef.current.dpi;
    canvas.height = renderRef.current.height * renderRef.current.dpi;

    setDiscs();
    setDots();
  };

  const drawDiscs = (ctx: CanvasRenderingContext2D) => {
    // Pink stroke for ellipses
    ctx.strokeStyle = "rgba(255, 182, 193, 0.15)";
    ctx.lineWidth = 1;

    discsRef.current.forEach((disc) => {
      ctx.beginPath();
      ctx.globalAlpha = disc.a * 0.3;

      ctx.ellipse(
        disc.x,
        disc.y + disc.h,
        disc.w,
        disc.h,
        0,
        0,
        Math.PI * 2
      );
      ctx.stroke();
      ctx.closePath();
    });
  };

  const drawDots = (ctx: CanvasRenderingContext2D) => {
    dotsRef.current.forEach((dot) => {
      const { d, p, c, o } = dot;

      const _p = d.sx * d.sy;
      ctx.fillStyle = c;

      const newA = (Math.PI * 2 * p);
      const x = d.x + Math.cos(newA) * d.w;
      const y = d.y + Math.sin(newA) * d.h;

      ctx.globalAlpha = d.a * o;

      ctx.beginPath();
      ctx.arc(x, y + d.h, 1 + _p * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.closePath();
    });
  };

  const moveDiscs = () => {
    discsRef.current.forEach((disc) => {
      disc.p = (disc.p + 0.0003) % 1;

      tweenDisc(disc);

      const p = disc.sx * disc.sy;

      let a = 1;
      if (p < 0.01) {
        a = Math.pow(Math.min(p / 0.01, 1), 3);
      } else if (p > 0.2) {
        a = 1 - Math.min((p - 0.2) / 0.8, 1);
      }

      disc.a = a;
    });
  };

  const moveDots = () => {
    dotsRef.current.forEach((dot) => {
      const v = tweenValue(0, 0.001, 1 - dot.d.sx * dot.d.sy, "easeInExpo");
      dot.p = (dot.p + v) % 1;
    });
  };

  const tick = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = renderRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(render.dpi, render.dpi);

    // Move
    moveDiscs();
    moveDots();

    // Draw
    drawDiscs(ctx);
    drawDots(ctx);

    ctx.restore();

    animationRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    setSizes();

    const handleResize = () => setSizes();
    window.addEventListener("resize", handleResize);

    animationRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div className="w-screen h-screen bg-black overflow-hidden relative">
      <div 
        ref={containerRef}
        className="absolute inset-0 w-full h-full overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          className="block w-full h-full"
        />
      </div>
      
      {/* Optional: Add a subtle pink gradient overlay */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-radial from-transparent via-transparent to-pink-950/20" />
      
      {/* Center text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-light text-pink-200/80 tracking-widest">
            ESTELLEO
          </h1>
          <div className="min-h-15"></div>
        </div>
      </div>

      {/* Back link */}
      <a 
        href="/"
        className="absolute top-8 left-8 text-pink-300/60 hover:text-pink-200 transition-colors text-sm tracking-widest"
      >
        ← BACK
      </a>
    </div>
  );
}
