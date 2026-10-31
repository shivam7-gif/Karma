import React, { useEffect, useState } from 'react';

/**
 * FitWord: draws text as SVG and stretches the glyphs to fill the width of
 * its container (the giant wordmark look). `height` sets how tall the word
 * is; the letters stretch horizontally to match the container width.
 *
 * Needs the Anton font to be loaded on the page, for example with
 * @import url('https://fonts.googleapis.com/css2?family=Anton&display=swap');
 */
interface FitWordProps {
  text: string;
  height: string; // any CSS length, e.g. "min(46vh, 30vw)"
}

const FitWord: React.FC<FitWordProps> = ({ text, height }) => {
  const [m, setM] = useState({ x: 0, y: 88, w: 100 * text.length * 0.5, h: 88 });

  useEffect(() => {
    let cancelled = false;

    const measure = async () => {
      try {
        await document.fonts.load('100px Anton');
      } catch {
        /* ignore */
      }
      if (cancelled) return;
      const ctx = document.createElement('canvas').getContext('2d');
      if (!ctx) return;
      ctx.font = '100px Anton';
      const t = ctx.measureText(text);
      const w = t.actualBoundingBoxLeft + t.actualBoundingBoxRight;
      const h = t.actualBoundingBoxAscent + t.actualBoundingBoxDescent;
      if (w > 0 && h > 0) {
        setM({ x: t.actualBoundingBoxLeft, y: t.actualBoundingBoxAscent, w, h });
      }
    };

    measure();
    document.fonts?.addEventListener?.('loadingdone', measure);
    return () => {
      cancelled = true;
      document.fonts?.removeEventListener?.('loadingdone', measure);
    };
  }, [text]);

  return (
    <svg
      viewBox={`0 0 ${m.w} ${m.h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ display: 'block', width: '100%', height }}
    >
      <text x={m.x} y={m.y} fontFamily="Anton, Impact, sans-serif" fontSize="100" fill="currentColor">
        {text}
      </text>
    </svg>
  );
};

export default FitWord;