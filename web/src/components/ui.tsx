import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

// Small shared UI kit for the admin panel -- every page reuses these instead
// of repeating the same Tailwind className strings for buttons/inputs/badges.

const buttonVariants = {
  primary: "bg-accent text-on-accent hover:bg-ink/90",
  ghost: "border border-line text-ink-soft hover:border-ink-muted hover:text-ink",
  danger: "border border-coral/30 text-coral hover:bg-coral-soft",
  link: "text-ink-soft hover:text-ink",
  dangerLink: "text-ink-soft hover:text-coral",
} as const;

const buttonSizes = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-4 py-2 text-sm",
} as const;

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof buttonVariants; size?: keyof typeof buttonSizes }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint/50 disabled:cursor-not-allowed disabled:opacity-40 ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`}
      {...props}
    />
  );
}

export function Label({ className = "", ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={`mb-1 block text-xs font-medium text-ink-soft ${className}`} {...props} />;
}

const controlClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-ink-muted focus:outline-none focus:ring-2 focus:ring-mint/30";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${controlClass} ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${controlClass} ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${controlClass} ${className}`} {...props} />;
}

const badgeTones = {
  mint: "bg-mint-soft text-mint",
  coral: "bg-coral-soft text-coral",
  neutral: "bg-surface-alt text-ink-muted",
  accent: "bg-accent/10 text-ink",
} as const;

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof badgeTones; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${badgeTones[tone]}`}>{children}</span>
  );
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-2xl border border-line bg-surface ${className}`}>{children}</div>;
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <h2 className="text-xl font-semibold tracking-tight text-ink">{title}</h2>
        {description && <p className="mt-1 max-w-3xl text-sm text-ink-soft">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-coral-soft px-3 py-2 text-sm text-coral">{children}</p>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-muted">{children}</p>;
}

// Pill-shaped on/off switch -- reads as clickable, unlike a bare badge.
export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className="inline-flex items-center gap-2 rounded-full text-xs font-medium text-ink-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint/50 disabled:opacity-40"
    >
      <span className={`relative h-5 w-9 rounded-full transition-colors ${checked ? "bg-mint" : "bg-surface-alt ring-1 ring-line"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-ink transition-all ${checked ? "left-4.5" : "left-0.5"}`} />
      </span>
      {label}
    </button>
  );
}

// Shared shell for every data table: rounded card that scrolls sideways on phones.
export function TableCard({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-2xl border border-line bg-surface">{children}</div>;
}

// Loading indicator: the app's ECG pulse (mobile/components/PulseLine.tsx) on
// a loop -- a bright head sweeping over a faint trace. CSS only.
const PULSE_POINTS = [
  [0, 20], [30, 20], [34, 16], [38, 20], [44, 20], [47, 24], [52, 2],
  [57, 30], [61, 20], [68, 20], [73, 14], [78, 20], [100, 20],
];
const PULSE_D = `M${PULSE_POINTS.map(([x, y]) => `${x} ${y}`).join(" L")}`;

export function Loading({ label = "Cargando", className = "" }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-label={label} className={`flex justify-center py-8 ${className}`}>
      <svg viewBox="-2 0 104 32" className="h-6 w-16 overflow-visible" fill="none" aria-hidden>
        <path d={PULSE_D} stroke="var(--color-ink)" strokeOpacity="0.15" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d={PULSE_D} pathLength={100} className="pulse-loop" stroke="var(--color-gold)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
