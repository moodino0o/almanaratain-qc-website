import type { ReactNode } from 'react';
import { Bullet, SectionTag, SlideFooter, SlideFrame, SlideHeader, SlideTitle } from './SlideFrame';

export function ManagementSlide({
  section,
  page,
  title,
  children,
  dark = false,
}: {
  section: string;
  page: string;
  title: string;
  children: ReactNode;
  dark?: boolean;
}) {
  return (
    <SlideFrame dark={dark}>
      <SlideHeader section={section} number={`${page} / 25`} dark={dark} />
      <div className="absolute bottom-[12vh] left-[5vw] right-[5vw] top-[13vh]">
        <SlideTitle dark={dark}>{title}</SlideTitle>
        <div className="mt-[3vh] h-[69vh]">{children}</div>
      </div>
      <SlideFooter label="AL MANARATAIN / QUALITY & CONTROL" number={page} dark={dark} />
    </SlideFrame>
  );
}

export function Card({
  label,
  title,
  children,
  soft = false,
  dark = false,
}: {
  label?: string;
  title?: string;
  children: ReactNode;
  soft?: boolean;
  dark?: boolean;
}) {
  return (
    <section className={`h-full border p-[1.5vw] ${dark ? 'border-white/20 bg-white/5' : soft ? 'border-line bg-soft' : 'border-line bg-white shadow-sm'}`}>
      {label && <div className={`mb-[1.1vh] font-mono text-[1.5vw] uppercase tracking-[0.12em] ${dark ? 'text-white/55' : 'text-[#718096]'}`}>{label}</div>}
      {title && <h3 className={`mb-[1.3vh] font-display text-[2.25vw] font-bold leading-[1.05] ${dark ? 'text-white' : 'text-primary'}`}>{title}</h3>}
      <div className={`space-y-[1vh] text-[2vw] leading-[1.22] ${dark ? 'text-white/80' : 'text-muted'}`}>{children}</div>
    </section>
  );
}

export function FormulaCard({
  label,
  expression,
  note,
}: {
  label: string;
  expression: string;
  note?: string;
}) {
  return (
    <div className="h-full border border-line bg-white p-[1.45vw] shadow-sm">
      <div className="mb-[1.2vh] font-mono text-[1.5vw] uppercase tracking-[0.12em] text-[#718096]">{label}</div>
      <div className="font-display text-[2.2vw] font-bold leading-[1.12] tracking-[-0.025em] text-primary">{expression}</div>
      {note && <div className="mt-[1.4vh] text-[1.7vw] leading-[1.2] text-muted">{note}</div>}
    </div>
  );
}

export function StepCard({
  number,
  title,
  detail,
}: {
  number: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="h-full border border-line bg-white p-[1.4vw] shadow-sm">
      <div className="mb-[1.1vh] font-mono text-[1.7vw] font-bold text-accent">{number}</div>
      <div className="font-display text-[2.05vw] font-bold leading-[1.05] text-primary">{title}</div>
      <div className="mt-[1.2vh] text-[1.8vw] leading-[1.2] text-muted">{detail}</div>
    </div>
  );
}

export function Note({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <div className={`border-l-[0.35vw] border-accent py-[0.4vh] pl-[1.2vw] text-[1.7vw] leading-[1.2] ${dark ? 'text-white/70' : 'text-muted'}`}>
      {children}
    </div>
  );
}

export function BulletList({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return <div className="space-y-[1.25vh]">{children}</div>;
}

export { Bullet, SectionTag };
