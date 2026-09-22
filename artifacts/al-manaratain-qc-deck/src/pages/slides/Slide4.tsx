import { Bullet, SectionTag, SlideFooter, SlideFrame, SlideHeader, SlideTitle } from '../../components/SlideFrame';

export default function Slide4() {
  return (
    <SlideFrame>
      <SlideHeader section="Product Surface" number="04 / 16" />
      <div className="absolute left-[5vw] right-[5vw] top-[16vh]">
        <SlideTitle>Product Map</SlideTitle>
        <div className="mt-[6vh] grid grid-cols-[0.9fr_1.1fr] gap-[6vw]">
          <div className="bg-primary px-[3vw] py-[4vh] text-white">
            <SectionTag dark>One connected workspace</SectionTag>
            <p className="font-display text-[3.1vw] font-black leading-[1.02] tracking-[-0.04em]">
              From first entry to final review.
            </p>
            <div className="mt-[8vh] border-t border-white/25 pt-[2vh] font-mono text-[1.5vw] text-white/65">
              DASHBOARD / RECORDS / STANDARDS / ARCHIVE
            </div>
          </div>
          <div className="space-y-[2.2vh] pt-[1vh]">
            <Bullet number="01"><strong className="font-display text-primary">Dashboard:</strong> current activity and recent QC records</Bullet>
            <Bullet number="02"><strong className="font-display text-primary">QC records:</strong> create, review, and inspect test submissions</Bullet>
            <Bullet number="03"><strong className="font-display text-primary">Standards:</strong> strength and sieve reference values</Bullet>
            <Bullet number="04"><strong className="font-display text-primary">Complaints:</strong> track issues through completion</Bullet>
            <Bullet number="05"><strong className="font-display text-primary">Reports and archive:</strong> find, review, and print historical work</Bullet>
            <Bullet number="06"><strong className="font-display text-primary">Settings:</strong> maintain reference data and employee access</Bullet>
          </div>
        </div>
      </div>
      <SlideFooter label="Product Surface / Product Map" number="04" />
    </SlideFrame>
  );
}