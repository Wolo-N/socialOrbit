import { useEffect, useRef, useState } from 'react';

// Tracks the rendered size of a container DOM node via ResizeObserver.
// Mirrors the pattern used in Graph.jsx so charts behave consistently.
export default function useChartSize(initial = { width: 600, height: 240 }) {
  const ref = useRef(null);
  const [size, setSize] = useState(initial);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, size];
}
