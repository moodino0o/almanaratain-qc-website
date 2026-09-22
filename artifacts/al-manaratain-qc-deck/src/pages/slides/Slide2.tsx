import { Bullet, Rule, SectionTag, SlideFooter, SlideFrame, SlideHeader, SlideTitle } from '../../components/SlideFrame';

export default function Slide2() {
  return (
    <SlideFrame>
      <SlideHeader section="Project Overview" number="02 / 16" />
      <div className="absolute left-[5vw] right-[5vw] top-[16vh]">
        <SlideTitle>Project Brief</SlideTitle>
        <div className="mt-[7vh] grid grid-cols-[1.05fr_0.95fr] gap-[6vw]">
          <div>
            <p className="max-w-[43vw] text-[2.2vw] font-medium leading-[1.3] text-muted">
              One web workspace for day-to-day QC operations.
            </p>
            <Rule />
            <div className="mt-[4vh] space-y-[2.5vh]">
              <Bullet number="01">One web workspace for day-to-day QC operations</Bullet>
              <Bullet number="02">Structured records instead of disconnected paperwork</Bullet>
              <Bullet number="03">Shared standards and reference data across workflows</Bullet>
              <Bullet number="04">Controlled access for registered employees</Bullet>
            </div>
          </div>
          <div className="border border-line bg-soft px-[3vw] py-[4vh]">
            <SectionTag>Project focus</SectionTag>
            <p className="font-display text-[2.6vw] font-extrabold leading-[1.08] tracking-[-0.03em] text-primary">
              Make quality work easier to enter, review, protect, and reuse.
            </p>
            <div className="mt-[6vh] h-[1.2vh] w-[12vw] bg-accent" />
          </div>
        </div>
      </div>
      <SlideFooter label="Project Overview / Project Brief" number="02" />
    </SlideFrame>
  );
}