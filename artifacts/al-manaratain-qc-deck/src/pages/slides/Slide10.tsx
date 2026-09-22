import { Bullet, SectionTag, SlideFooter, SlideFrame, SlideHeader, SlideTitle } from '../../components/SlideFrame';

export default function Slide10() {
  return (
    <SlideFrame>
      <SlideHeader section="Product Surface" number="10 / 16" />
      <div className="absolute left-[5vw] right-[5vw] top-[16vh]">
        <SlideTitle>Complaint Workflow</SlideTitle>
        <div className="mt-[7vh] grid grid-cols-[0.8fr_1.2fr] gap-[7vw]">
          <div className="border border-line bg-soft px-[3vw] py-[4vh]">
            <SectionTag>Workflow states</SectionTag>
            <div className="flex items-center gap-[1vw]">
              <div className="border border-primary px-[1.5vw] py-[1.5vh] font-display text-[1.7vw] font-bold text-primary">Open</div>
              <div className="h-px w-[3vw] bg-primary" />
              <div className="border border-primary bg-primary px-[1.5vw] py-[1.5vh] font-display text-[1.7vw] font-bold text-white">Complete</div>
            </div>
            <p className="mt-[5vh] text-[1.8vw] leading-[1.35] text-muted">Open and Complete are separate workflow states.</p>
          </div>
          <div className="space-y-[3.5vh]">
            <Bullet number="01">Complaints are tracked as explicit records</Bullet>
            <Bullet number="02">Open and Complete are separate workflow states</Bullet>
            <Bullet number="03">Solution notes support the closeout record</Bullet>
            <Bullet number="04">Completion does not depend only on whether notes are filled</Bullet>
          </div>
        </div>
      </div>
      <SlideFooter label="Product Surface / Complaint Workflow" number="10" />
    </SlideFrame>
  );
}