import { Bullet, Rule, SectionTag, SlideFooter, SlideFrame, SlideHeader, SlideTitle } from '../../components/SlideFrame';

export default function Slide13() {
  return (
    <SlideFrame>
      <SlideHeader section="Administration" number="13 / 16" />
      <div className="absolute left-[5vw] right-[5vw] top-[16vh]">
        <SlideTitle>Reference Data Administration</SlideTitle>
        <div className="mt-[6vh] grid grid-cols-[1.05fr_0.95fr] gap-[6vw]">
          <div>
            <p className="text-[2.1vw] font-medium leading-[1.3] text-muted">
              Keep form values governed without making everyday entry heavy.
            </p>
            <Rule />
            <div className="mt-[4vh] space-y-[2.6vh]">
              <Bullet number="01">Administrators manage categories and values used by QC forms</Bullet>
              <Bullet number="02">Search and expand controls keep large value sets usable</Bullet>
            </div>
          </div>
          <div className="space-y-[2.6vh] border-l-2 border-primary pl-[3vw]">
            <SectionTag>Data continuity</SectionTag>
            <Bullet number="03">Seed reconciliation adds missing defaults without replacing existing data</Bullet>
            <Bullet number="04">Shared reference values keep records consistent</Bullet>
          </div>
        </div>
      </div>
      <SlideFooter label="Administration / Reference Data Administration" number="13" />
    </SlideFrame>
  );
}