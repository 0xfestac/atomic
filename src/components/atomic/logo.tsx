export function AtomicLogo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <circle cx="24" cy="24" r="5" fill="#22d3ee" />
      <ellipse cx="24" cy="24" rx="20" ry="8" stroke="#22d3ee" strokeOpacity="0.85" strokeWidth="2" />
      <ellipse cx="24" cy="24" rx="20" ry="8" stroke="#8b5cf6" strokeOpacity="0.75" strokeWidth="2" transform="rotate(60 24 24)" />
      <ellipse cx="24" cy="24" rx="20" ry="8" stroke="#3b82f6" strokeOpacity="0.75" strokeWidth="2" transform="rotate(-60 24 24)" />
    </svg>
  );
}

export function AtomicWordmark() {
  return (
    <span className="text-[15px] font-semibold tracking-[0.22em] text-white">
      ATOMIC
    </span>
  );
}
