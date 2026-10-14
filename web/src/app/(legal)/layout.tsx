import { LegalFooter } from '@/components/legal-footer';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-canvas px-4 py-12">
      <article className="mx-auto max-w-2xl space-y-6 text-sm leading-relaxed text-ink-soft [&_a]:text-ink [&_a]:underline [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:text-ink [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </article>
      <LegalFooter className="mx-auto mt-16 max-w-2xl border-t border-white/10 pt-6" />
    </main>
  );
}
