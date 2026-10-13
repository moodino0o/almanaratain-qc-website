<?php

namespace Tests\Unit;

use App\Models\QcStrengthStandard;
use App\Models\QcWaterStandard;
use App\Services\QcCalculationService;
use PHPUnit\Framework\TestCase;

class QcCalculationServiceTest extends TestCase
{
    public function test_dammam_block_net_area_and_minimum_strength_are_used(): void
    {
        $standard = new QcStrengthStandard([
            'test_type' => 'Blocks', 'material' => 'Concrete Block', 'block_type' => 'Plain Block',
            'block_size' => '8"', 'bs_standard' => 'BS EN 771-3', 'required_strength' => 7.5,
            'dammam_average_strength' => 12, 'dammam_minimum_strength' => 11, 'strength_unit' => 'N/mm²',
        ]);
        $result = (new QcCalculationService())->evaluateStrength('Blocks', 'Concrete Block', 'Dammam', [
            'blockType' => 'Plain Block', 'blockSize' => '8"', 'blockAge' => '7',
            'testRows' => [['load' => '408', 'length' => '400', 'width' => '200', 'height' => '200']],
        ], [$standard]);

        self::assertSame(40800.0, $result['details']['testRows'][0]['netArea']);
        self::assertSame(10.0, $result['details']['testRows'][0]['netStrength']);
        self::assertSame('Failed', $result['status']);
        self::assertSame(11.0, $result['details']['strengthEvaluation']['minimumRequiredStrength']);
    }

    public function test_precast_configured_age_limit_overrides_only_its_fallback_and_legacy_weight_remains_kg(): void
    {
        $standard = new QcStrengthStandard([
            'test_type' => 'Precast', 'material' => '200', 'cube_age' => 28,
            'bs_standard' => 'Project standard', 'required_strength' => 60, 'strength_unit' => 'N/mm²',
        ]);
        $rows = [
            ['testAge' => 1, 'load' => 300, 'length' => 100, 'width' => 100, 'height' => 100, 'weight' => 2.4],
            ['testAge' => 1, 'length' => 100, 'width' => 100, 'height' => 100, 'weight' => 2.4],
            ['testAge' => 7, 'load' => 520, 'length' => 100, 'width' => 100, 'height' => 100, 'weight' => 2.4],
            ['testAge' => 28, 'load' => 610, 'length' => 100, 'width' => 100, 'height' => 100, 'weight' => 2.4],
        ];
        $result = (new QcCalculationService())->evaluateStrength('Precast', '200', 'Hidd', ['cubeSize' => '100*100*100', 'testRows' => $rows], [$standard]);

        self::assertSame('Pending', $result['details']['precastAgeEvaluations'][0]['outcome']);
        self::assertSame(60.0, $result['details']['precastAgeEvaluations'][2]['minimumStrength']);
        self::assertSame('Pass', $result['details']['precastAgeEvaluations'][2]['outcome']);
        self::assertSame('Passed', $result['status']);
        self::assertSame('2400.00', $result['details']['testRows'][0]['density']);
    }

    public function test_paving_tensile_strength_applies_the_60_mm_correction_factor(): void
    {
        $standard = new QcStrengthStandard([
            'test_type' => 'Paving Blocks', 'material' => 'Paving Block', 'block_size' => '200*100*60',
            'bs_standard' => 'BS EN 1338', 'required_strength' => 3, 'strength_unit' => 'N/mm²',
        ]);
        $result = (new QcCalculationService())->evaluateStrength('Paving Blocks', 'Paving Block', 'Hidd', [
            'pavingBlockSize' => '200*100*60', 'correctionFactor' => 0.87,
            'testRows' => [['load' => 100, 'length' => 200, 'width' => 100, 'height' => 60, 'dryWeight' => 2500, 'wetWeight' => 2600]],
        ], [$standard]);
        self::assertSame(5.31, $result['details']['testRows'][0]['calculatedStrength']);
        self::assertSame('4.62', $result['details']['testRows'][0]['tensileStrength']);
        self::assertSame('4.00', $result['details']['testRows'][0]['waterAbsorption']);
        self::assertSame('Passed', $result['status']);
    }

    public function test_sieve_passing_uses_cumulative_retained_mass_and_ignores_blank_rows(): void
    {
        $result = QcCalculationService::sieveRows([
            ['sieveSize' => '5 mm', 'amountReturned' => '20'],
            ['sieveSize' => '2 mm', 'amountReturned' => ''],
            ['sieveSize' => '1 mm', 'amountReturned' => '30'],
        ]);
        self::assertSame(50.0, $result['sampleWeight']);
        self::assertSame(30.0, $result['rows'][0]['passingAmount']);
        self::assertArrayNotHasKey('passingAmount', $result['rows'][1]);
        self::assertSame(0.0, $result['rows'][2]['passingAmount']);
        self::assertSame(0.0, $result['rows'][2]['passingPercentage']);
    }

    public function test_water_chloride_uses_titration_when_both_points_are_present(): void
    {
        $standard = new QcWaterStandard([
            'id' => 3, 'name' => 'Default', 'ph_min' => 6, 'ph_max' => 9,
            'chloride_min' => 0, 'chloride_max' => 400, 'tds_min' => 0, 'tds_max' => 1000,
            'so3_min' => 0, 'so3_max' => 1000, 'is_default' => true,
        ]);
        $result = (new QcCalculationService())->evaluateWater([
            'ph' => '7', 'firstChlorideTitrationPoint' => '1', 'secondChlorideTitrationPoint' => '2',
            'tds' => '500', 'so3' => '>400',
        ], $standard);
        self::assertSame(14.1812, $result['details']['chloride']);
        self::assertSame('Passed', $result['status']);
        self::assertSame(400.0, $result['details']['waterEvaluation']['criteria'][3]['measuredValue']);
    }

    public function test_ready_mix_uses_the_28_day_result_for_its_design_strength(): void
    {
        $standard = new QcStrengthStandard([
            'test_type' => 'Ready Mix', 'material' => '25 N OPC', 'bs_standard' => 'BS EN 12390-3',
            'required_strength' => 25, 'strength_unit' => 'N/mm²',
        ]);
        $result = (new QcCalculationService())->evaluateStrength('Ready Mix', '25 N OPC', 'Hidd', [
            'testRows' => [
                ['testAge' => 7, 'load' => 180, 'length' => 100, 'width' => 100, 'height' => 100],
                ['testAge' => 28, 'load' => 300, 'length' => 100, 'width' => 100, 'height' => 100],
            ],
        ], [$standard]);

        self::assertSame('Passed', $result['status']);
        self::assertSame(30.0, $result['details']['strengthEvaluation']['averageStrength']);
    }

    public function test_kerb_individual_bending_strength_can_fail_even_with_a_valid_profile(): void
    {
        $standard = new QcStrengthStandard([
            'test_type' => 'Kerb Stone', 'material' => 'Kerbstone', 'block_type' => 'Road kerb',
            'block_size' => '915 × 125 × 225 mm', 'bs_standard' => 'BS EN 1340',
            'required_strength' => 5, 'minimum_individual_strength' => 4,
            'water_absorption_limit' => 6.5, 'strength_unit' => 'MPa',
        ]);
        $result = (new QcCalculationService())->evaluateStrength('Kerb Stone', 'Kerbstone', 'Hidd', [
            'kerbType' => 'Road kerb',
            'testRows' => [['failureLoad' => 10, 'spanLength' => 900]],
        ], [$standard]);

        self::assertSame('Failed', $result['status']);
        self::assertSame('Fail', $result['details']['testRows'][0]['bendingStrengthOutcome']);
    }
}
