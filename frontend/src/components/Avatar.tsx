import React, { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";
import { Live2DModel } from "pixi-live2d-display/cubism4";

interface AvatarProps {
  isSpeaking?: boolean;
  isListening?: boolean;
}

const Avatar: React.FC<AvatarProps> = ({ isSpeaking, isListening }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const modelRef = useRef<Live2DModel | null>(null);

  useEffect(() => {
    if (!containerRef.current || appRef.current) return;

    const app = new PIXI.Application({
      resizeTo: containerRef.current,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      height: 50,
      resolution: window.devicePixelRatio || 1,
      eventMode: "none" as any,
    });
    appRef.current = app;
    containerRef.current.appendChild(app.view as HTMLCanvasElement);

    // ✅ Pass the Ticker class itself, not the shared instance
    Live2DModel.registerTicker(PIXI.Ticker);

    Live2DModel.from("/Resources/Hiyori/Hiyori.model3.json")
      .then((model) => {
        modelRef.current = model;
        model.scale.set(0.35);
        model.anchor.set(0.5, 1);
        model.x = app.screen.width / 2;
        model.y = app.screen.height;

        app.stage.addChild(model);
      })
      .catch((err) => console.error("Failed to load Live2D model:", err));

    return () => {
      app.destroy(true, { children: true });
      appRef.current = null;
      modelRef.current = null;
    };
  }, []);

  // Optional: expressions
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
      className="w-full h-full flex justify-center items-end"
      style={{ width: "420px", height: "480px" }}
    />
  );
};

export default Avatar;