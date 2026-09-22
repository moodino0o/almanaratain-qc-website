import { Bullet, SlideFooter, SlideFrame, SlideHeader, SlideTitle } from '../../components/SlideFrame';

export default function Slide8() {
  return (
    <SlideFrame>
      <SlideHeader section="Product Surface" number="08 / 16" />
      <div className="absolute left-[5vw] right-[5vw] top-[16vh]">
        <SlideTitle>Dashboard Visibility</SlideTitle>
        <div className="mt-[7vh] grid grid-cols-[1fr_1fr] gap-[5vw]">
          <div className="bg-primary px-[3vw] py-[4vh] text-white">
            <div className="font-mono text-[1.5vw] uppercase tracking-[0.16em] text-white/60">Current view</div>
            <div className="mt-[3vh] font-display text-[3.3vw] font-black leading-[1.02] tracking-[-0.04em]">Recent QC records in one view</div>
            <div className="mt-[7vh] h-[1px] bg-white/25" />
            <div className="mt-[2vh] font-mono text-[1.5vw] text-white/65">RECORD / MATERIAL / DATE / STATUS</div>
          </div>
          <div className="space-y-[3vh] pt-[1vh]">
            <Bullet number="01">Recent QC records in one view</Bullet>
            <Bullet number="02">Record number, test type, material, sample date, and status</Bullet>
            <Bullet number="03">Quick access to complaints and current activity</Bullet>
            <Bullet number="04">Direct navigation into record details</Bullet>
          </div>
        </div>
      </div>
      <SlideFooter label="Product Surface / Dashboard Visibility" number="08" />
    </SlideFrame>
  );
}