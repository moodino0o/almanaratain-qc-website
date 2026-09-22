import { Bullet, Rule, SlideFooter, SlideFrame, SlideHeader, SlideTitle } from '../../components/SlideFrame';

export default function Slide6() {
  return (
    <SlideFrame>
      <SlideHeader section="QC Workflows" number="06 / 16" />
      <div className="absolute left-[5vw] right-[5vw] top-[16vh]">
        <SlideTitle>Structured Data Entry</SlideTitle>
        <div className="mt-[7vh] grid grid-cols-2 gap-[6vw]">
          <div>
            <p className="max-w-[40vw] text-[2.2vw] font-medium leading-[1.25] text-muted">
              Capture the same operational context every time.
            </p>
            <Rule />
            <div className="mt-[4vh] space-y-[2.6vh]">
              <Bullet number="01">Material, plant, supplier, location, and reference fields</Bullet>
              <Bullet number="02">Test-specific detail sections</Bullet>
              <Bullet number="03">Specimen and sieve rows where required</Bullet>
            </div>
          </div>
          <div className="space-y-[2.6vh] border-l-2 border-accent pl-[3vw]">
            <Bullet number="04">Copy-from-existing-record support for repeat work</Bullet>
            <Bullet number="05">Controlled reference values to reduce inconsistent entry</Bullet>
            <div className="pt-[3vh] font-mono text-[1.5vw] uppercase tracking-[0.14em] text-[#718096]">
              CONSISTENT INPUT / REPEATABLE REVIEW
            </div>
          </div>
        </div>
      </div>
      <SlideFooter label="QC Workflows / Structured Data Entry" number="06" />
    </SlideFrame>
  );
}