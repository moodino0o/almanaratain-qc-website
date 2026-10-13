<?php

namespace App\Services;

use App\Models\QcRecord;
use App\Models\QcShapeFactor;
use App\Models\QcStrengthStandard;
use App\Models\QcWaterStandard;

class QcDefaultDataService
{
    private const READY_MIX = [
        '20 N OPC', '20 N OPC Ice', '20 N SRC', '20 N SRC Ice',
        '25 N OPC', '25 N OPC Ice', '25 N SRC', '25 N SRC Ice',
        '30 N OPC', '30 N OPC Ice', '30 N SRC', '30 N SRC Ice',
        '35 N OPC', '35 N OPC Ice', '35 N SRC', '35 N SRC Ice',
        '45 N OPC', '45 N OPC Ice', '45 N OPC Fiber', '45 N OPC Fiber Ice',
        '45 N SRC', '45 N SRC Ice', '45 N SRC Fiber', '45 N SRC Fiber Ice',
        '50 N OPC', '50 N OPC Ice', '50 N SRC', '50 N SRC Ice',
    ];

    private const BLOCKS = [
        ['Plain Block', '4"', 7.5],
        ['Plain Block', '6"', 7.5],
        ['Plain Block', '8"', 7.5],
        ['Plain Block', '12"', 7.5],
        ['Lined Block', '8"', 7.5],
        ['Sandwich Insulation Block', '8"', 5.0],
        ['Sandwich Insulation Block', '12"', 5.0],
    ];

    public function ensureStrengthStandards(): void
    {
        $changedTypes = [];
        $existing = QcStrengthStandard::whereIn('test_type', ['Ready Mix', 'Blocks', 'Kerb Stone'])->get();
        $materials = $existing->where('test_type', 'Ready Mix')->pluck('material')->map(fn ($value) => mb_strtolower(trim($value)))->all();
        foreach (self::READY_MIX as $material) {
            if (in_array(mb_strtolower($material), $materials, true)) continue;
            QcStrengthStandard::create([
                'test_type' => 'Ready Mix', 'material' => $material, 'bs_standard' => 'BS EN 12390-3:2009',
                'required_strength' => (float) $material, 'strength_unit' => 'N/mm²',
            ]);
            $changedTypes[] = 'Ready Mix';
        }

        foreach ($existing->where('test_type', 'Blocks') as $standard) {
            $sandwich = stripos((string) $standard->block_type, 'sandwich') !== false;
            $nextAverage = $standard->dammam_average_strength ?? ($sandwich ? 4.14 : 13.8);
            $nextMinimum = $sandwich ? null : ($standard->dammam_minimum_strength ?? 12.4);
            if ($standard->dammam_average_strength !== $nextAverage || $standard->dammam_minimum_strength !== $nextMinimum) {
                $standard->dammam_average_strength = $nextAverage;
                $standard->dammam_minimum_strength = $nextMinimum;
                $standard->save();
                $changedTypes[] = 'Blocks';
            }
        }
        foreach (self::BLOCKS as [$blockType, $blockSize, $required]) {
            $standard = QcStrengthStandard::where('test_type', 'Blocks')
                ->whereRaw('lower(trim(material)) = ?', ['concrete block'])
                ->whereRaw('lower(trim(block_type)) = ?', [mb_strtolower($blockType)])
                ->whereRaw('lower(trim(block_size)) = ?', [mb_strtolower($blockSize)])
                ->first();
            if ($standard) continue;
            $sandwich = stripos($blockType, 'sandwich') !== false;
            QcStrengthStandard::create([
                'test_type' => 'Blocks', 'material' => 'Concrete Block', 'block_type' => $blockType,
                'block_size' => $blockSize, 'bs_standard' => 'BS EN 771-3', 'required_strength' => $required,
                'dammam_average_strength' => $sandwich ? 4.14 : 13.8,
                'dammam_minimum_strength' => $sandwich ? null : 12.4, 'strength_unit' => 'N/mm²',
            ]);
            $changedTypes[] = 'Blocks';
        }

        foreach ([
            ['Road kerb', '915 × 125 × 225 mm', 5.0, 2, 'T', 4.0],
            ['Edge kerb', '915 × 50 × 150 mm', 3.5, 1, 'S', 2.8],
        ] as [$type, $size, $required, $class, $marking, $minimum]) {
            if (QcStrengthStandard::where('test_type', 'Kerb Stone')->where('material', 'Kerbstone')->where('block_type', $type)->where('block_size', $size)->exists()) continue;
            QcStrengthStandard::create([
                'test_type' => 'Kerb Stone', 'material' => 'Kerbstone', 'block_type' => $type, 'block_size' => $size,
                'kerb_class' => $class, 'kerb_marking' => $marking, 'bs_standard' => 'BS EN 1340 : 2003',
                'required_strength' => $required, 'minimum_individual_strength' => $minimum,
                'water_absorption_limit' => 6.5, 'strength_unit' => 'MPa',
            ]);
            $changedTypes[] = 'Kerb Stone';
        }

        if ($changedTypes) $this->refreshRecords(array_values(array_unique($changedTypes)));
    }

    public function ensureWaterStandard(): ?QcWaterStandard
    {
        $standards = QcWaterStandard::orderBy('id')->get();
        $default = $standards->firstWhere('is_default', true);
        $changed = false;
        if (! $default && $standards->isNotEmpty()) {
            $default = $standards->first();
            $default->is_default = true;
            if ((float) $default->so3_min === 0.0 && (float) $default->so3_max === 1000.0) $default->so3_min = 400;
            $default->save();
            $changed = true;
        }
        if (! $default) {
            $default = QcWaterStandard::create([
                'name' => 'Water Quality Limits', 'ph_min' => 4.5, 'ph_max' => 8,
                'chloride_min' => 0, 'chloride_max' => 350, 'tds_min' => 0, 'tds_max' => 2000,
                'so3_min' => 400, 'so3_max' => 1000, 'is_default' => true,
            ]);
            $changed = true;
        } elseif ((float) $default->so3_min === 0.0 && (float) $default->so3_max === 1000.0) {
            $default->so3_min = 400;
            $default->save();
            $changed = true;
        }
        if ($changed) {
            $calculator = new QcCalculationService();
            foreach (QcRecord::where('test_type', 'Water')->get() as $record) {
                $details = $record->details ?? [];
                $selected = isset($details['waterStandardId']) ? QcWaterStandard::find((int) $details['waterStandardId']) : $default;
                $result = $calculator->evaluateWater($details, $selected);
                $record->details = $result['details'];
                $record->status = $result['status'];
                $record->save();
            }
        }
        return $default;
    }

    private function refreshRecords(array $types): void
    {
        $calculator = new QcCalculationService();
        $standards = QcStrengthStandard::orderBy('id')->get();
        foreach (QcRecord::whereIn('test_type', $types)->get() as $record) {
            $result = $calculator->evaluateStrength($record->test_type, $record->material, $record->location, $record->details ?? [], $standards, QcShapeFactor::all());
            if ($result['status'] !== null) {
                $record->details = $result['details'];
                $record->status = $result['status'];
                $record->save();
            }
        }
    }
}
