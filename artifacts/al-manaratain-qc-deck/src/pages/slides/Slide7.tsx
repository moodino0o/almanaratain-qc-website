import { FormulaCard, ManagementSlide, Note } from '../../components/ManagementSlide';

export default function Slide7() {
  return (
    <ManagementSlide section="Calculations" page="07" title="Calculations use the selected test workflow">
      <div className="grid h-[43vh] grid-cols-3 gap-[1.35vw]">
        <FormulaCard label="CUBE / BLOCK BASIS" expression="Load (kN) × 1,000 ÷ [Length × Width]" note="Result: N/mm². Block air-dry factor is applied separately." />
        <FormulaCard label="PAVING BLOCK" expression="0.637 × Load × 1,000 ÷ [Length × Height]" note="The configured size correction factor is applied when available." />
        <FormulaCard label="WATER ABSORPTION" expression="(Wet − Dry) ÷ Dry × 100" note="Displayed as a percentage; invalid or incomplete inputs remain blank." />
      </div>
      <div className="mt-[2.3vh] grid grid-cols-[1fr_1fr] gap-[1.35vw]">
        <div className="border border-line bg-soft p-[1.4vw]">
          <div className="mb-[0.8vh] font-mono text-[1.5vw] uppercase tracking-[0.12em] text-[#718096]">BLOCK ADJUSTMENTS</div>
          <div className="text-[1.8vw] leading-[1.2] text-primary">Air-dry strength = water strength × 1.2 for non-Dammam Blocks; × 1.0 for Dammam. Optional normalized strength uses the configured shape factor.</div>
        </div>
        <div className="flex items-center border-l-[0.35vw] border-accent pl-[1.4vw] text-[1.8vw] leading-[1.2] text-muted">
          Result precision is field-specific. The app does not use one universal display-rounding rule.
        </div>
      </div>
      <Note>Appendix A lists additional equations directly from the application logic.</Note>
    </ManagementSlide>
  );
}
