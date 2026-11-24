import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { useLiveRoomStore } from '@/features/rooms/live-room-store';

interface LiveCountdownTimerProps {
  endsAtMs: number | null;
  large?: boolean;
}

/**
 * Isolated countdown component subscribing strictly to server clockOffsetMs.
 * Prevents 100ms timer ticks from re-rendering the quiz choices or leaderboard tree.
 * Turns pulsing Coral (--accent-pulse) during the final 5 seconds.
 */
export function LiveCountdownTimer({ endsAtMs, large = false }: LiveCountdownTimerProps) {
  const clockOffsetMs = useLiveRoomStore((s) => s.clockOffsetMs);
  const [remainingSec, setRemainingSec] = useState<number>(0);

  useEffect(() => {
    if (!endsAtMs) {
      setRemainingSec(0);
      return;
    }

    const tick = () => {
      const serverNow = Date.now() + clockOffsetMs;
      const diffMs = Math.max(0, endsAtMs - serverNow);
      setRemainingSec(Math.ceil(diffMs / 1000));
    };

    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [endsAtMs, clockOffsetMs]);

  const isUrgent = remainingSec > 0 && remainingSec <= 5;
  const formatted = `00:${String(remainingSec).padStart(2, '0')}`;

  if (large) {
    return (
      <span
        className={`sp-mono-numeric inline-block text-7xl font-extrabold tracking-tight ${
          isUrgent ? 'animate-pulse text-accent-pulse' : 'text-brand-primary'
        }`}
      >
        {Math.max(1, remainingSec)}
      </span>
    );
  }

  return (
    <span
      className={`sp-mono-numeric inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-colors ${
        isUrgent
          ? 'animate-pulse bg-accent-pulse text-white'
          : 'bg-brand-soft text-brand-primary'
      }`}
    >
      <Clock className="h-3.5 w-3.5" />
      <span>{formatted}</span>
    </span>
  );
}
