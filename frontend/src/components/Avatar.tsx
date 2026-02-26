import React, { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";
import { Live2DModel } from "pixi-live2d-display/cubism4";

interface AvatarProps {
  isSpeaking?: boolean;
  isListening?: boolean;
}

// ── PixiJS v7 patch ───────────────────────────────────────────────────────
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

// ── Module-level vars — NO React state, written by App, read by PIXI ticker
let _analyser: AnalyserNode | null = null;
let _analyserBuf: Uint8Array | null = null;
let _speaking = false;
let _fakeStart = 0;

export function setLipSyncAnalyser(a: AnalyserNode | null) {
  _analyser = a;
  _analyserBuf = a ? new Uint8Array(a.frequencyBinCount) : null;
}

export function setLipSyncSpeaking(s: boolean) {
  _speaking = s;
  if (s && !_analyser) _fakeStart = performance.now();
}

// ── Safe param setter — tries every known Hiyori / Cubism4 variant ────────
function setMouth(model: Live2DModel, open: number, form: number) {
  const core = (model.internalModel?.coreModel as any);
  if (!core) return;

  // Dump all param IDs once (first frame) so we know what exists
  if (!(model as any)._paramsDumped) {
    (model as any)._paramsDumped = true;
    try {
      const n = core.getParameterCount();
      const ids: string[] = [];
      for (let i = 0; i < n; i++) ids.push(core.getParameterId(i));
      console.log('[Live2D] all params:', ids);
    } catch {}
  }

  // Try every name variant — one of these WILL match Hiyori
  const openNames = [
    'ParamMouthOpenY',       // standard Cubism4
    'PARAM_MOUTH_OPEN_Y',    // older Cubism3 style
    'ParamMouthOpen',
    'MouthOpen',
  ];
  const formNames = [
    'ParamMouthForm',
    'PARAM_MOUTH_FORM',
    'MouthForm',
  ];
  const browLNames = ['ParamBrowLY', 'PARAM_BROW_L_Y', 'BrowLY'];
  const browRNames = ['ParamBrowRY', 'PARAM_BROW_R_Y', 'BrowRY'];

  for (const id of openNames) {
    try { core.setParameterValueById(id, open); } catch {}
  }
  for (const id of formNames) {
    try { core.setParameterValueById(id, form); } catch {}
  }
  const brow = open * 0.3;
  for (const id of browLNames) { try { core.setParameterValueById(id, brow); } catch {} }
  for (const id of browRNames) { try { core.setParameterValueById(id, brow); } catch {} }
}

const Avatar: React.FC<AvatarProps> = ({ isSpeaking, isListening }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const modelRef = useRef<Live2DModel | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouthRef = useRef(0);

  // Keep module var in sync every render — this is the key fix
  _speaking = !!isSpeaking;
  if (isSpeaking && !_analyser && _fakeStart === 0) _fakeStart = performance.now();

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
    if (!W || !H) return;

    const app = new PIXI.Application({
      width: W, height: H, backgroundAlpha: 0,
      antialias: true, autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });
    appRef.current = app;

    const canvas = app.view as HTMLCanvasElement;
    canvasRef.current = canvas;
    canvas.style.cssText = `width:${W}px;height:${H}px;display:block;`;
    container.appendChild(canvas);

    Live2DModel.registerTicker(PIXI.Ticker);

    Live2DModel.from("/Resources/Hiyori/Hiyori.model3.json", { autoInteract: false })
      .then((model) => {
        if (!appRef.current) return;
        modelRef.current = model;

        const naturalH = model.height / model.scale.y;
        const mobile = W < 768;
        model.scale.set((H * (mobile ? 1.8 : 3.06)) / naturalH);
        model.anchor.set(0.5, 1);
        model.x = W / 2;
        model.y = H + model.height * (mobile ? 0.5 : 0.65);
        model.eventMode = "none";
        model.interactiveChildren = false;
        app.stage.addChild(model);

        // ── Lip sync runs inside PIXI ticker — same thread as render ──────
        app.ticker.add(() => {
          const m = modelRef.current;
          if (!m) return;

          let level = 0;

          if (_speaking) {
            if (_analyser && _analyserBuf) {
              // ── Path A: REAL audio via Web Audio analyser ───────────────
              _analyser.getByteFrequencyData(_analyserBuf);

              // RMS of entire spectrum is most reliable (no guessing FFT bins)
              let sumSq = 0;
              const len = _analyserBuf.length;
              for (let i = 0; i < len; i++) {
                const v = _analyserBuf[i];
                sumSq += v * v;
              }
              const rms = Math.sqrt(sumSq / len); // 0 – ~128
              level = Math.min(1, rms / 35);       // 35 = typical speech RMS
              level = level * level * 1.5;          // square to punish silence, boost peaks

            } else {
              // ── Path B: Phoneme rhythm (browser TTS / no analyser) ──────
              const t = (performance.now() - _fakeStart) / 1000;
              // 4 Hz syllable pulse + harmonics = believable talking rhythm
              const a = Math.abs(Math.sin(t * Math.PI * 4.2));
              const b = Math.abs(Math.sin(t * Math.PI * 9.1 + 0.9)) * 0.45;
              const c = Math.abs(Math.sin(t * Math.PI * 16.3 + 1.8)) * 0.2;
              level = Math.min(1, (a + b + c) * 0.68);
            }
          }

          // Asymmetric lerp — fast open (natural plosive attack), slow close
          const target = _speaking ? Math.max(0.06, level) : 0;
          const spd = target > mouthRef.current ? 0.55 : 0.10;
          mouthRef.current += (target - mouthRef.current) * spd;

          const m2 = mouthRef.current;
          // form: 0 = surprised/open, 1 = smile — blend based on openness
          const form = m2 > 0.5 ? 0.0 : 1.0 - m2 * 1.5;
          setMouth(model, m2, Math.max(0, form));
        });
      })
      .catch(console.error);
  };

  useEffect(() => {
    const t = setTimeout(initApp, 50);
    window.addEventListener("resize", initApp);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", initApp);
      appRef.current?.destroy(true, { children: true });
      appRef.current = null;
      modelRef.current = null;
      const c = containerRef.current;
      if (canvasRef.current && c?.contains(canvasRef.current)) c.removeChild(canvasRef.current);
      canvasRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isSpeaking) _fakeStart = 0;
    const model = modelRef.current;
    if (isSpeaking)       { try { model?.expression?.("happy");     } catch {} }
    else if (isListening) { try { model?.expression?.("surprised"); } catch {} }
    else                  { try { model?.expression?.("normal");    } catch {} }
  }, [isSpeaking, isListening]);

  return <div ref={containerRef} style={{ position: "absolute", inset: 0, overflow: "hidden" }} />;
};

export default Avatar;