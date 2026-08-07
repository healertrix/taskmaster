'use client';

import { useEffect, useState } from 'react';
import { MeshGradient } from '@paper-design/shaders-react';

interface MeshBackgroundProps {
  className?: string;
}

const BUCKET_MS = 20 * 60 * 1000; // 20 minutes
const CHECK_INTERVAL_MS = 30 * 1000; // cheap to check often, only updates on a real bucket change

const currentBucket = () => Math.floor(Date.now() / BUCKET_MS);

// hsl() -> hex. The shader's `colors` prop is typed as plain string[] with
// no documented format guarantee — the other three colors are all hex, and
// feeding it an `hsl(...)` CSS function string here (instead of matching
// that format) risked the library's color parser not recognizing it and
// silently falling back to a default (white) color instead of erroring
// loudly. Converting to hex removes that ambiguity entirely.
const hslToHex = (h: number, s: number, l: number) => {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (n: number) =>
    Math.round(f(n) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(0)}${toHex(8)}${toHex(4)}`;
};

// One of the four mesh colors cycles through a dark, desaturated hue that
// changes every 20 minutes. Deterministic (a function of time, not truly
// random) — the same 20-minute window always produces the same hue, so it
// doesn't glitchily change on every reload within a window, only across
// them. Uses the golden-angle increment (137.508°) so consecutive buckets
// land on well-spread hues instead of clustering or cycling predictably.
// Saturation/lightness stay low so it's always a dark, muted tone, never a
// bright flash — same "dark enough to sit behind content" rule as the rest
// of the shader palette.
const colorForBucket = (bucket: number) => {
  const hue = (bucket * 137.508) % 360;
  return hslToHex(hue, 35, 11);
};

export function MeshBackground({ className }: MeshBackgroundProps) {
  const [bucket, setBucket] = useState(currentBucket);

  useEffect(() => {
    const id = setInterval(() => {
      setBucket((prev) => {
        const next = currentBucket();
        return next !== prev ? next : prev;
      });
    }, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const colors = ['#07070a', '#161217', colorForBucket(bucket), '#0e0e11'];

  return (
    <MeshGradient
      className={className}
      colors={colors}
      distortion={0.55}
      swirl={0.2}
      speed={0.25}
      scale={1.2}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
