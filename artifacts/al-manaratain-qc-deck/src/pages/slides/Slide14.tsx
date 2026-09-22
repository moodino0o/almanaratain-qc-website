import reportImage from '@assets/image_1788071780139.png';
import { Bullet, SectionTag, SlideFooter, SlideFrame, SlideHeader, SlideTitle } from '../../components/SlideFrame';

export default function Slide14() {
  return (
    <SlideFrame>
      <SlideHeader section="Administration" number="14 / 16" />
      <div className="absolute left-[5vw] right-[5vw] top-[16vh]">
        <SlideTitle>Evidence and Storage</SlideTitle>
        <div className="mt-[6vh] grid grid-cols-[0.9fr_1.1fr] gap-[6vw]">
          <div className="relative h-[48vh] overflow-hidden border border-line bg-soft">
            <img src={reportImage} crossOrigin="anonymous" className="h-full w-full object-cover object-top" alt="QC report example" />
            <div className="absolute inset-0 bg-primary/5" />
          </div>
          <div className="space-y-[3.3vh] pt-[2vh]">
            <SectionTag>Record evidence</SectionTag>
            <Bullet number="01">QC workflows support image and file evidence where needed</Bullet>
            <Bullet number="02">Uploaded files are stored separately from record data</Bullet>
            <Bullet number="03">Records retain the returned object path and searchable metadata</Bullet>
            <Bullet number="04">Storage responses are validated before they reach the UI</Bullet>
          </div>
        </div>
      </div>
      <SlideFooter label="Administration / Evidence and Storage" number="14" />
    </SlideFrame>
  );
}