import type { ButtonHTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

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
      className={`inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`}
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

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h2 className="text-xl font-semibold tracking-tight text-ink">{title}</h2>
      {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
    </div>
  );
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-coral-soft px-3 py-2 text-sm text-coral">{children}</p>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-muted">{children}</p>;
}
