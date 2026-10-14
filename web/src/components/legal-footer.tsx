import Link from 'next/link';
import { CONTACT_EMAIL } from '@/lib/legal';

const LINKS = [
  { href: '/soporte', label: 'Soporte' },
  { href: '/terminos', label: 'Términos y condiciones' },
  { href: '/privacidad', label: 'Privacidad' },
  { href: '/eliminar-cuenta', label: 'Eliminar cuenta' },
];

export function LegalFooter({ className = '' }: { className?: string }) {
  return (
    <footer className={`flex flex-wrap gap-x-6 gap-y-2 text-xs text-ink-muted ${className}`}>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="hover:text-ink">{l.label}</Link>
      ))}
      <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-ink">{CONTACT_EMAIL}</a>
    </footer>
  );
}
