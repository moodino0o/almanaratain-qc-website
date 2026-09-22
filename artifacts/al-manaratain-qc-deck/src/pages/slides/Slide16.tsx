import { Bullet, SlideFooter, SlideFrame, SlideHeader, SlideTitle } from '../../components/SlideFrame';

export default function Slide16() {
  return (
    <SlideFrame dark>
      <SlideHeader section="Delivery" number="16 / 16" dark />
      <div className="absolute bottom-[16vh] left-[5vw] right-[5vw]">
        <SlideTitle dark>Next Steps</SlideTitle>
        <div className="mt-[7vh] grid grid-cols-2 gap-x-[7vw] gap-y-[4vh]">
          <Bullet number="01" dark>Publish the verified web application</Bullet>
          <Bullet number="02" dark>Confirm production data and reference standards</Bullet>
          <Bullet number="03" dark>Train administrators on access and reference-data controls</Bullet>
          <Bullet number="04" dark>Add regression coverage for employee access workflows</Bullet>
          <Bullet number="05" dark>Expand reporting needs as usage grows</Bullet>
        </div>
      </div>
      <SlideFooter label="Delivery / Next Steps" number="16" dark />
    </SlideFrame>
  );
}