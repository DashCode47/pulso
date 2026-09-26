// Brand mark: pulse-line glyph + wordmark, redrawn as crisp SVG/text so it
// scales cleanly (the source logo asset is a low-res 150x150 JPEG, no good
// as a real UI asset).
export function PulseMark({ className = "h-5 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 20" fill="none" className={className} aria-hidden>
      <path
        d="M0 10H8L11 3L16 17L19 10H32"
        stroke="var(--color-mint)"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-lg font-extrabold tracking-tight text-ink">PULSO</span>
      <PulseMark />
    </div>
  );
}
