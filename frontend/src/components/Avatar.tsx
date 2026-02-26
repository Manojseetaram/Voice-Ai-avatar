import React, { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";
import { Live2DModel } from "pixi-live2d-display/cubism4";

const Avatar: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (appRef.current) return;

    // ✅ Create PIXI app with fixed size
    const app = new PIXI.Application({
      width: 400,
      height: 600,
      backgroundAlpha: 0,
      antialias: true,
    });

    appRef.current = app;

    // Append canvas
    containerRef.current.appendChild(app.view as HTMLCanvasElement);

    // ✅ Register shared ticker (IMPORTANT)
    Live2DModel.registerTicker(PIXI.Ticker.shared);

    // ✅ Load model
    Live2DModel.from("/Resources/Hiyori/Hiyori.model3.json").then((model) => {
      model.scale.set(0.35); // Adjust size here
      model.anchor.set(0.5, 1); // bottom center
      model.x = app.screen.width / 2;
      model.y = app.screen.height;

      app.stage.addChild(model);
    });

    return () => {
      app.destroy(true);
      appRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: "400px",
        height: "600px",
        margin: "0 auto",
      }}
    />
  );
};

export default Avatar;