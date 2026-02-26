import React, { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";
import { Live2DModel } from "pixi-live2d-display/cubism4";

interface AvatarProps {
  isSpeaking?: boolean;
  isListening?: boolean;
}

// Patch for pixi-live2d-display + PixiJS v7
const _proto = (PIXI.Renderer as any).prototype;
if (!_proto._live2dPatched) {
  const _orig = Object.getOwnPropertyDescriptor(_proto, "plugins");
  Object.defineProperty(_proto, "plugins", {
    get() {
      const p = _orig?.get?.call(this) ?? this._plugins ?? {};
      if (!p.interaction) p.interaction = { on: () => {}, off: () => {}, destroy: () => {} };
      return p;
    },
    configurable: true,
  });
  _proto._live2dPatched = true;
}

const Avatar: React.FC<AvatarProps> = ({ isSpeaking, isListening }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const modelRef = useRef<Live2DModel | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const initApp = () => {
    const container = containerRef.current;
    if (!container) return;

    if (appRef.current) {
      appRef.current.destroy(true, { children: true });
      appRef.current = null;
      modelRef.current = null;
    }
    if (canvasRef.current && container.contains(canvasRef.current)) {
      container.removeChild(canvasRef.current);
      canvasRef.current = null;
    }

    const W = container.clientWidth;
    const H = container.clientHeight;
    if (W === 0 || H === 0) return;

    const app = new PIXI.Application({
      width: W,
      height: H,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });
    appRef.current = app;

    const canvas = app.view as HTMLCanvasElement;
    canvasRef.current = canvas;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    canvas.style.display = "block";
    container.appendChild(canvas);

    Live2DModel.registerTicker(PIXI.Ticker);

    Live2DModel.from("/Resources/Hiyori/Hiyori.model3.json", { autoInteract: false })
      .then((model) => {
        if (!appRef.current) return;
        modelRef.current = model;

        const naturalH = model.height / model.scale.y;
        const isMobile = W < 768;

        // Mobile: smaller scale so character fits without overlapping the button
        // Desktop: your tuned values (3.06 scale, 0.65 offset)
        const scaleMultiplier = isMobile ? 1.8 : 3.06;
        const yOffsetRatio   = isMobile ? 0.5  : 0.65;

        const scale = (H * scaleMultiplier) / naturalH;
        model.scale.set(scale);

        model.anchor.set(0.5, 1);
        model.x = W / 2;
        model.y = H + (model.height * yOffsetRatio);

        model.eventMode = "none";
        model.interactiveChildren = false;

        app.stage.addChild(model);
      })
      .catch((err) => console.error("Live2D load failed:", err));
  };

  useEffect(() => {
    const timer = setTimeout(initApp, 50);
    const handleResize = () => initApp();
    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
      modelRef.current = null;
      const container = containerRef.current;
      if (canvasRef.current && container?.contains(canvasRef.current)) {
        container.removeChild(canvasRef.current);
        canvasRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const model = modelRef.current;
    if (!model) return;
    try {
      if (isSpeaking) model.expression?.("happy");
      else if (isListening) model.expression?.("surprised");
      else model.expression?.("normal");
    } catch {}
  }, [isSpeaking, isListening]);

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0, overflow: "hidden" }}
    />
  );
};

export default Avatar;