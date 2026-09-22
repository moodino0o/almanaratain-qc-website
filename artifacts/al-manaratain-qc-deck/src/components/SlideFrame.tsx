import type { ReactNode } from 'react';

export function SlideFrame({
  children,
  dark = false,
}: {
  children: ReactNode;
  dark?: boolean;
}) {
  return (
    <div
      className={`relative h-screen w-screen overflow-hidden font-body ${
        dark ? 'bg-primary text-white' : 'bg-bg text-text'
      }`}
    >
      {children}
    </div>
  );
}

export function SlideHeader({
  section,
  number,
  dark = false,
}: {
  section: string;
  number: string;
  dark?: boolean;
}) {
  return (
    <div className="absolute left-[5vw] right-[5vw] top-[5vh] flex items-start justify-between">
      <div className={`font-display text-[1.5vw] font-extrabold tracking-[-0.02em] ${dark ? 'text-white' : 'text-primary'}`}>
        AL MANARATAIN
      </div>
      <div className={`font-mono text-[1.5vw] ${dark ? 'text-white/60' : 'text-muted'}`}>
        <span className={dark ? 'text-white/35' : 'text-[#A0AEC0]'}>{section}</span>
        <span className="mx-[0.8vw]">/</span>
        {number}
      </div>
    </div>
  );
}

export function SlideFooter({
  label,
  number,
  dark = false,
}: {
  label: string;
  number: string;
  dark?: boolean;
}) {
  return (
    <div className={`absolute bottom-[5vh] left-[5vw] right-[5vw] flex items-center justify-between border-t pt-[1.8vh] font-mono text-[1.5vw] ${dark ? 'border-white/50 text-white/60' : 'border-line text-[#718096]'}`}>
      <span>{label}</span>
      <span className={dark ? 'text-white' : 'text-primary'}>{number}</span>
    </div>
  );
}

export function SlideTitle({
  children,
  dark = false,
}: {
  children: ReactNode;
  dark?: boolean;
}) {
  return (
    <div className="relative inline-block">
      <div className={`absolute -left-[1vw] top-[1.4vh] h-[2.8vh] w-[14vw] ${dark ? 'bg-white/10' : 'bg-primary/10'}`} />
      <h2 className={`relative font-display text-[3.6vw] font-black leading-[0.98] tracking-[-0.04em] ${dark ? 'text-white' : 'text-primary'}`}>
        {children}
      </h2>
    </div>
  );
}

export function Rule({ dark = false }: { dark?: boolean }) {
  return <div className={`h-px w-full ${dark ? 'bg-white/20' : 'bg-line'}`} />;
}

export function Bullet({
  number,
  children,
  dark = false,
}: {
  number: string;
  children: ReactNode;
  dark?: boolean;
}) {
  return (
    <div className="flex gap-[1.4vw]">
      <span className={`shrink-0 pt-[0.25vh] font-mono text-[1.5vw] ${dark ? 'text-white/55' : 'text-[#718096]'}`}>{number}</span>
      <span className={`text-[1.7vw] leading-[1.3] ${dark ? 'text-white/85' : 'text-muted'}`}>{children}</span>
    </div>
  );
}

export function SectionTag({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return <div className={`mb-[2vh] font-mono text-[1.5vw] uppercase tracking-[0.16em] ${dark ? 'text-white/60' : 'text-[#718096]'}`}>{children}</div>;
}