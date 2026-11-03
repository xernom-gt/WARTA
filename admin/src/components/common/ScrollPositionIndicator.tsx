import { useEffect, useState } from 'react';

/**
 * Indikator posisi scroll tipis & semi-transparan di sisi kanan layar
 * (menggantikan scrollbar bawaan browser yang kaku).
 */
export default function ScrollPositionIndicator() {
  const [metrics, setMetrics] = useState({ thumbHeight: 0, thumbTop: 0, canScroll: false });
  const [scrolling, setScrolling] = useState(false);

  useEffect(() => {
    let hideTimer: number | undefined;

    const update = () => {
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop;
      const viewHeight = window.innerHeight;
      const fullHeight = doc.scrollHeight;
      const maxScroll = fullHeight - viewHeight;

      if (maxScroll <= 4) {
        setMetrics({ thumbHeight: 0, thumbTop: 0, canScroll: false });
        return;
      }

      const ratio = viewHeight / fullHeight;
      const thumbHeight = Math.max(40, Math.round(ratio * viewHeight * 0.7));
      const trackAvailable = viewHeight * 0.7 - thumbHeight;
      const thumbTop = (scrollTop / maxScroll) * trackAvailable;

      setMetrics({ thumbHeight, thumbTop, canScroll: true });
    };

    const onScroll = () => {
      update();
      setScrolling(true);
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setScrolling(false), 900);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(document.body);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', update);

    return () => {
      window.clearTimeout(hideTimer);
      ro.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', update);
    };
  }, []);

  if (!metrics.canScroll) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed right-1.5 top-[15vh] z-50 h-[70vh] w-1.5 rounded-full bg-slate-900/5 backdrop-blur-[1px] transition-opacity duration-300"
    >
      <div
        style={{
          height: `${metrics.thumbHeight}px`,
          transform: `translateY(${metrics.thumbTop}px)`,
        }}
        className={`w-full rounded-full transition-colors duration-200 ${
          scrolling ? 'bg-brand/70 shadow-sm' : 'bg-brand/30'
        }`}
      />
    </div>
  );
}
