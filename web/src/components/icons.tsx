// Minimal hand-drawn outline icons (stroke=currentColor) -- avoids pulling
// in an icon library for four glyphs.
type IconProps = { className?: string };

const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function CalendarIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} {...base}>
      <rect x="3" y="4.5" width="14" height="12" rx="1.5" />
      <path d="M3 8.5h14M6.5 2.5v3M13.5 2.5v3" />
    </svg>
  );
}

export function RepeatIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} {...base}>
      <path d="M4 9V7a3 3 0 0 1 3-3h8M15 2.5 17.5 4 15 5.5" />
      <path d="M16 11v2a3 3 0 0 1-3 3H5M5 17.5 2.5 16 5 14.5" />
    </svg>
  );
}

export function UsersIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} {...base}>
      <circle cx="7.5" cy="7" r="2.5" />
      <path d="M2.5 16c.6-2.6 2.5-4 5-4s4.4 1.4 5 4" />
      <path d="M13 4.2c1.3.3 2.3 1.5 2.3 2.9 0 1.4-1 2.6-2.3 2.9M15.8 12.3c1.8.5 3 1.9 3.4 3.7" />
    </svg>
  );
}

export function ImageIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} {...base}>
      <rect x="2.5" y="3.5" width="15" height="13" rx="1.5" />
      <circle cx="7" cy="8" r="1.5" />
      <path d="M3.5 15 8 10.5l2.5 2.5L14 9.5l2.5 2.5" />
    </svg>
  );
}

export function ChevronRightIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} {...base}>
      <path d="M7.5 4.5 13 10l-5.5 5.5" />
    </svg>
  );
}

export function BellIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} {...base}>
      <path d="M5 8a5 5 0 0 1 10 0c0 3.5 1 4.5 1.5 5.5H3.5C4 12.5 5 11.5 5 8Z" />
      <path d="M8.2 16a1.8 1.8 0 0 0 3.6 0" />
    </svg>
  );
}

export function SettingsIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} {...base}>
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4M15.3 15.3l-1.4-1.4M6.1 6.1 4.7 4.7" />
    </svg>
  );
}

export function LogoutIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} {...base}>
      <path d="M8 17H4.5A1.5 1.5 0 0 1 3 15.5v-11A1.5 1.5 0 0 1 4.5 3H8" />
      <path d="M13 13.5 17 10l-4-3.5M17 10H7.5" />
    </svg>
  );
}
