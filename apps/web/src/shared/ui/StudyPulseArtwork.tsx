import type { ReactNode } from 'react';

type SquircleTone = 'violet' | 'amber' | 'indigo' | 'emerald' | 'cyan' | 'rose' | 'soft';

const SQUIRCLE_STYLES: Record<SquircleTone, string> = {
  violet:
    'bg-gradient-to-br from-[#8B5CF6] to-[#5B21B6] text-white shadow-[0_8px_18px_-6px_rgba(109,40,217,0.65)]',
  amber:
    'bg-gradient-to-br from-[#FBBF24] to-[#EA580C] text-white shadow-[0_8px_18px_-6px_rgba(234,88,12,0.55)]',
  indigo:
    'bg-gradient-to-br from-[#6366F1] to-[#3730A3] text-white shadow-[0_8px_18px_-6px_rgba(67,56,202,0.55)]',
  emerald:
    'bg-gradient-to-br from-[#34D399] to-[#059669] text-white shadow-[0_8px_18px_-6px_rgba(5,150,105,0.55)]',
  cyan:
    'bg-gradient-to-br from-[#38BDF8] to-[#0284C7] text-white shadow-[0_8px_18px_-6px_rgba(2,132,199,0.55)]',
  rose:
    'bg-gradient-to-br from-[#FB7185] to-[#E11D48] text-white shadow-[0_8px_18px_-6px_rgba(225,29,72,0.5)]',
  soft: 'bg-brand-soft text-brand-primary border border-brand-primary/15',
};

export function GlossySquircle({
  tone,
  size = 'md',
  children,
}: {
  tone: SquircleTone;
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}) {
  const sizeClass =
    size === 'sm' ? 'h-9 w-9 rounded-xl' : size === 'lg' ? 'h-12 w-12 rounded-2xl' : 'h-11 w-11 rounded-[14px]';
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ring-1 ring-white/25 ${sizeClass} ${SQUIRCLE_STYLES[tone]}`}
    >
      {children}
    </span>
  );
}

export function StudyPulseLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#4C1D95] text-white shadow-[0_6px_16px_-4px_rgba(109,40,217,0.55)]">
        <svg viewBox="0 0 28 28" className="h-5 w-5" fill="none">
          <path
            d="M3 15h4.5l3-7 4.2 12 3.3-5H25"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="22.5" cy="7" r="2.2" fill="#FBBF24" />
        </svg>
      </span>
      {!compact && (
        <span className="font-heading text-lg font-extrabold tracking-tight text-text-primary">
          Study<span className="text-brand-primary">Pulse</span>
        </span>
      )}
    </div>
  );
}

export function CircularProgressRing({
  percentage,
  size = 48,
  color = 'var(--brand-primary)',
  trackColor = 'var(--border-default)',
  labelClassName = 'text-text-primary',
}: {
  percentage: number;
  size?: number;
  color?: string;
  trackColor?: string;
  labelClassName?: string;
}) {
  const stroke = 4.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percentage));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className={`sp-mono-numeric absolute text-[11px] font-bold ${labelClassName}`}>
        {clamped}%
      </span>
    </div>
  );
}

export function DeckTopicIllustration({ topic }: { topic: string }) {
  const lower = topic.toLowerCase();
  const isSystem = lower.includes('system') || lower.includes('backend') || lower.includes('pwa');

  if (isSystem) {
    return (
      <svg viewBox="0 0 120 96" className="h-24 w-28 shrink-0" fill="none">
        <rect x="12" y="10" width="96" height="76" rx="16" fill="url(#sysBg)" opacity="0.22" />
        <ellipse cx="60" cy="30" rx="22" ry="8" fill="url(#sysTop)" />
        <path d="M38 30v14c0 4.4 9.8 8 22 8s22-3.6 22-8V30" fill="url(#sysBody)" />
        <path d="M38 44v14c0 4.4 9.8 8 22 8s22-3.6 22-8V44" fill="url(#sysBody2)" />
        <circle cx="84" cy="24" r="9" fill="#8B5CF6" />
        <path d="M80 24h8M84 20v8" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        <circle cx="32" cy="64" r="7" fill="#38BDF8" />
        <defs>
          <linearGradient id="sysBg" x1="12" y1="10" x2="108" y2="86" gradientUnits="userSpaceOnUse">
            <stop stopColor="#60A5FA" />
            <stop offset="1" stopColor="#8B5CF6" />
          </linearGradient>
          <linearGradient id="sysTop" x1="38" y1="22" x2="82" y2="38" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6366F1" />
            <stop offset="1" stopColor="#3B82F6" />
          </linearGradient>
          <linearGradient id="sysBody" x1="38" y1="30" x2="82" y2="52" gradientUnits="userSpaceOnUse">
            <stop stopColor="#312E81" />
            <stop offset="1" stopColor="#4338CA" />
          </linearGradient>
          <linearGradient id="sysBody2" x1="38" y1="44" x2="82" y2="66" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1E1B4B" />
            <stop offset="1" stopColor="#3730A3" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 120 96" className="h-24 w-28 shrink-0" fill="none">
      <rect x="12" y="10" width="96" height="76" rx="16" fill="url(#feBg)" opacity="0.22" />
      <rect x="24" y="20" width="72" height="52" rx="10" fill="url(#feWin)" />
      <circle cx="33" cy="28" r="2.5" fill="#FB7185" />
      <circle cx="41" cy="28" r="2.5" fill="#FBBF24" />
      <circle cx="49" cy="28" r="2.5" fill="#34D399" />
      <circle cx="60" cy="48" r="10" stroke="#38BDF8" strokeWidth="2.4" />
      <circle cx="60" cy="48" r="3" fill="#38BDF8" />
      <rect x="18" y="48" width="24" height="18" rx="6" fill="#7C3AED" />
      <path d="M26 57l-3-3 3-3M34 51l3 3-3 3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="feBg" x1="12" y1="10" x2="108" y2="86" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A78BFA" />
          <stop offset="1" stopColor="#38BDF8" />
        </linearGradient>
        <linearGradient id="feWin" x1="24" y1="20" x2="96" y2="72" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4F46E5" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
    </svg>
  );
}
