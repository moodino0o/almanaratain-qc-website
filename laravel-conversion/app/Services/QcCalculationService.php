<?php

namespace App\Services;

use App\Models\QcShapeFactor;
use App\Models\QcStrengthStandard;
use App\Models\QcWaterStandard;

class QcCalculationService
{
    public static function number(mixed $value): ?float
    {
        if (is_int($value) || is_float($value)) {
            return is_finite((float) $value) ? (float) $value : null;
        }
        if (! is_string($value) || trim($value) === '') {
            return null;
        }
        $number = filter_var(str_replace(',', '', trim($value)), FILTER_VALIDATE_FLOAT);
        return $number === false || ! is_finite((float) $number) ? null : (float) $number;
    }

    public static function blockDimensions(mixed $value): ?array
    {
        if (! is_string($value) || trim($value) === '') {
            return null;
        }
        $text = trim($value);
        preg_match_all('/\d+(?:\.\d+)?/', $text, $matches);
        if (preg_match('/[*x×]/i', $text) && count($matches[0]) >= 3) {
            [$length, $width, $height] = array_map('floatval', array_slice($matches[0], 0, 3));
            return min($length, $width, $height) > 0 ? compact('length', 'width', 'height') : null;
        }
        if (preg_match('/^(4|6|8|12)\s*(?:"|\'\'|inches?|in)?$/i', $text, $match)) {
            return ['length' => 400.0, 'width' => ['4' => 100.0, '6' => 150.0, '8' => 200.0, '12' => 300.0][$match[1]], 'height' => 200.0];
        }
        return null;
    }

    public static function blockShapeFactor(mixed $size): ?float
    {
        $dimensions = self::blockDimensions($size);
        if (! $dimensions) return null;
        $table = [
            40 => [0.8, 0.7, null, null, null], 50 => [0.85, 0.75, 0.7, null, null],
            65 => [0.95, 0.85, 0.75, 0.7, 0.65], 100 => [1.15, 1, 0.9, 0.8, 0.75],
            150 => [1.3, 1.2, 1.1, 1, 0.95], 200 => [1.45, 1.35, 1.25, 1.15, 1.1],
            250 => [1.55, 1.45, 1.35, 1.25, 1.15],
        ];
        $height = (int) $dimensions['height'];
        $row = $table[$height] ?? ($height >= 250 ? $table[250] : null);
        if (! $row) return null;
        $width = $dimensions['width'];
        $column = $width >= 250 ? 4 : array_search((int) $width, [50, 100, 150, 200], true);
        return $column === false ? null : $row[$column];
    }

    public static function pavingCorrectionFactor(mixed $size): ?float
    {
        if (! is_string($size)) return null;
        if (preg_match('/(?:^|[^0-9])60\s*(?:mm)?$/i', trim($size))) return 0.87;
        if (preg_match('/(?:^|[^0-9])80\s*(?:mm)?$/i', trim($size))) return 1.0;
        return null;
    }

    public static function calculateRow(array $row, array $options = []): array
    {
        $paving = (bool) ($options['paving'] ?? false);
        $precast = (bool) ($options['precast'] ?? false);
        $dammam = (bool) ($options['dammam'] ?? false);
        $load = self::number($row['load'] ?? null);
        $length = self::number($row['length'] ?? null);
        $width = self::number($row['width'] ?? null);
        $height = self::number($row['height'] ?? null);
        $grossArea = $length !== null && $length > 0 && $width !== null && $width > 0 ? $length * $width : null;
        $netArea = null;
        $sandwich = (bool) ($options['dammamSandwich'] ?? false);
        if (($options['dammam'] ?? false) && ! $sandwich && $grossArea !== null) {
            $dimensions = self::blockDimensions($options['blockSize'] ?? null);
            $face = self::number($row['faceThickness'] ?? $options['faceThickness'] ?? 30);
            $web = self::number($row['webThickness'] ?? $options['webThickness'] ?? (($dimensions['width'] ?? 0) <= 150 ? 25 : 30));
            $holes = in_array((int) ($dimensions['width'] ?? 0), [100, 150], true) ? 2 : (((int) ($dimensions['width'] ?? 0) === 200) ? 3 : null);
            if ($face !== null && $face > 0 && $web !== null && $web > 0 && $holes !== null) {
                $holeWidth = $width - 2 * $face;
                $holeLength = ($length - 2 * $face - (($holes - 1) * $web)) / $holes;
                if ($holeWidth > 0 && $holeLength > 0) {
                    $netArea = $grossArea - ($holes * $holeWidth * $holeLength);
                    if ($netArea <= 0 || $netArea >= $grossArea) $netArea = null;
                }
            }
        }
        $area = $length !== null && $length > 0 && ($paving ? $height !== null && $height > 0 : $width !== null && $width > 0)
            ? $length * ($paving ? $height : $width) : null;
        $raw = $load !== null && $load >= 0 && $area !== null && $area > 0
            ? round($load * 1000 * ($paving ? 0.637 : 1) / $area, 2) : null;
        $netStrength = $load !== null && $load >= 0 && $netArea !== null && $netArea > 0
            ? round($load * 1000 / $netArea, 2) : null;
        $shape = self::number($options['shapeFactor'] ?? null);
        $correction = self::number($options['correctionFactor'] ?? null);
        $strength = $paving ? ($raw !== null && $correction !== null ? round($raw * $correction, 2) : null) : $raw;
        $airDry = $strength !== null && ! $paving ? round($strength * ($dammam ? 1 : 1.2), 1) : null;
        $normalized = $airDry !== null && $shape !== null && $shape > 0 ? round($airDry * $shape, 1) : null;
        $dry = self::number($row['dryWeight'] ?? null);
        $wet = self::number($row['wetWeight'] ?? null);
        $weight = self::number($row['weight'] ?? null);
        $densityWeight = $precast ? ($weight !== null ? $weight * (($options['weightUnit'] ?? 'kg') === 'g' ? 1 : 1000) : ($wet !== null ? $wet * 1000 : null)) : $wet;
        $density = $densityWeight !== null && $length !== null && $width !== null && $height !== null && min($length, $width, $height) > 0
            ? round($densityWeight * ($precast ? 1_000_000 : 1_000_000_000) / ($length * $width * $height), 2) : null;
        $absorption = $dry !== null && $wet !== null && $dry > 0 ? round(($wet - $dry) / $dry * 100, 2) : null;
        $row['loadedFaceArea'] = $area;
        if ($grossArea !== null) $row['grossArea'] = $grossArea;
        if ($netArea !== null) {
            $row['netArea'] = $netArea;
            $row['netStrength'] = $netStrength;
            $row['failureLoadN'] = $load === null ? null : $load * 1000;
            $row['numberOfHoles'] = in_array((int) (self::blockDimensions($options['blockSize'] ?? null)['width'] ?? 0), [100, 150], true) ? 2 : 3;
        }
        if ($strength !== null) {
            $row['calculatedStrength'] = $raw;
            $row['strength'] = number_format($strength, 2, '.', '');
        }
        if ($airDry !== null) {
            $row['airDryStrength'] = $airDry;
            $row['waterStrength'] = number_format($dammam && stripos((string) ($options['blockType'] ?? ''), 'sandwich') !== false ? $strength / 1.2 : $strength, 2, '.', '');
        }
        if ($normalized !== null) $row['normalizedStrength'] = $normalized;
        if ($paving) {
            $row['tensileStrength'] = $strength === null ? '' : number_format($strength, 2, '.', '');
            $row['correctedStrength'] = $strength ?? '';
        }
        $row['waterAbsorption'] = $absorption === null ? '' : number_format($absorption, 2, '.', '');
        if ($precast) $row['density'] = $density === null ? '' : number_format($density, 2, '.', '');
        return ['row' => $row, 'strength' => $strength, 'netStrength' => $netStrength, 'density' => $density, 'absorption' => $absorption, 'complete' => $strength !== null];
    }

    public function evaluateStrength(string $testType, string $material, string $location, array $details, iterable $standards, iterable $shapeFactors = []): array
    {
        $rows = is_array($details['testRows'] ?? null) ? $details['testRows'] : [];
        $factor = self::number($details['shapeFactor'] ?? null);
        $correction = self::number($details['correctionFactor'] ?? null);
        if ($testType === 'Blocks' && $factor === null) {
            foreach ($shapeFactors as $shape) if (strcasecmp((string) $shape->block_size, (string) ($details['blockSize'] ?? '')) === 0) $factor = $shape->shape_factor;
        }
        if ($testType === 'Paving Blocks' && $correction === null) {
            foreach ($shapeFactors as $shape) if (strcasecmp((string) $shape->block_size, (string) ($details['pavingBlockSize'] ?? $details['blockSize'] ?? '')) === 0) $correction = $shape->correction_factor;
            $correction ??= self::pavingCorrectionFactor($details['pavingBlockSize'] ?? $details['blockSize'] ?? null);
        }
        $isDammam = strcasecmp(trim($location), 'dammam') === 0 || strcasecmp(trim($location), 'dammam plant') === 0;
        $sandwich = $isDammam && stripos((string) ($details['blockType'] ?? ''), 'sandwich') !== false;
        $details['testRows'] = array_map(function ($row) use ($details, $testType): mixed {
            if (! is_array($row)) return $row;
            $dimensions = self::blockDimensions($details['blockSize'] ?? null);
            if ($dimensions) {
                foreach (['length', 'width', 'height'] as $dimension) {
                    if (self::number($row[$dimension] ?? null) === null) $row[$dimension] = $dimensions[$dimension];
                }
            }
            return $row;
        }, $rows);
        $rows = $details['testRows'];
        $evaluatedRows = array_map(fn ($row) => is_array($row) ? self::calculateRow($row, [
            'paving' => $testType === 'Paving Blocks', 'precast' => $testType === 'Precast',
            'dammam' => $isDammam, 'shapeFactor' => $factor, 'correctionFactor' => $correction,
            'weightUnit' => $details['cubeWeightUnit'] ?? 'kg', 'blockType' => $details['blockType'] ?? null,
            'blockSize' => $details['blockSize'] ?? null, 'faceThickness' => $details['faceThickness'] ?? null,
            'webThickness' => $details['webThickness'] ?? null, 'dammamSandwich' => $sandwich,
        ]) : ['row' => $row, 'strength' => null, 'complete' => false], $rows);
        $ageFilteredRows = $testType === 'Ready Mix'
            ? array_values(array_filter($evaluatedRows, fn ($item) => is_array($item['row']) && (float) ($item['row']['testAge'] ?? $item['row']['cubeAge'] ?? $item['row']['age'] ?? 0) === 28.0))
            : $evaluatedRows;
        $strengthValues = array_map(function ($item) use ($testType, $isDammam, $sandwich) {
            if ($testType === 'Blocks' && $isDammam && ! $sandwich) return self::number($item['row']['netStrength'] ?? null);
            if ($testType === 'Blocks' && ! $isDammam) return self::number($item['row']['airDryStrength'] ?? null);
            if ($testType === 'Blocks' && $isDammam && $sandwich) return self::number($item['row']['airDryStrength'] ?? null);
            if ($testType === 'Paving Blocks') return self::number($item['row']['tensileStrength'] ?? $item['row']['correctedStrength'] ?? null);
            return $item['strength'] ?? null;
        }, $ageFilteredRows);
        $strengths = array_values(array_filter($strengthValues, fn ($value) => $value !== null));
        $average = count($strengths) ? round(array_sum($strengths) / count($strengths), 2) : null;
        $details['testRows'] = array_column($evaluatedRows, 'row');
        $standard = $this->matchingStrengthStandard($testType, $material, $details, $standards);
        if ($testType === 'Precast') {
            $ageRules = [1 => [30, 'Approved for demolding', 'Not approved for demolding'], 7 => [52, 'Pass', 'Fail'], 28 => [65, 'Pass', 'Fail']];
            $ageEvals = [];
            foreach ($ageRules as $age => [$fallback]) {
                $ageRows = array_values(array_filter($evaluatedRows, fn ($item) => is_array($item['row']) && (int) ($item['row']['testAge'] ?? $item['row']['sampleAge'] ?? $item['row']['cubeAge'] ?? $item['row']['age'] ?? 0) === $age));
                $vals = array_values(array_filter(array_column($ageRows, 'strength'), fn ($v) => $v !== null));
                $ageStd = null;
                foreach ($standards as $candidate) if ($candidate->test_type === 'Precast' && strcasecmp($candidate->material, $material) === 0 && (int) $candidate->cube_age === $age) { $ageStd = $candidate; break; }
                $minimum = $ageStd?->required_strength ?? $fallback;
                $ageAverage = $vals ? round(array_sum($vals) / count($vals), 2) : null;
                $complete = count($ageRows) > 0 && count($vals) === count($ageRows);
                $outcome = ! $complete ? 'Pending' : ($ageAverage >= $minimum ? $ageRules[$age][1] : $ageRules[$age][2]);
                $ageEvals[] = ['age' => $age, 'minimumStrength' => $minimum, 'standardId' => $ageStd?->id, 'bsStandard' => $ageStd?->bs_standard, 'averageStrength' => $ageAverage, 'outcome' => $outcome];
            }
            $details['precastAgeEvaluations'] = $ageEvals;
            $final = collect($ageEvals)->firstWhere('age', 28);
            $status = $final['outcome'] === 'Pass' ? 'Passed' : ($final['outcome'] === 'Fail' ? 'Failed' : 'Review');
            $details['strengthEvaluation'] = ['status' => $status, 'bsStandard' => $final['bsStandard'] ?? 'BS 1881 : PART 116 : 1983', 'requiredStrength' => $final['minimumStrength'] ?? 65, 'averageStrength' => $final['averageStrength'], 'minimumStrength' => $strengths ? min($strengths) : null, 'maximumStrength' => $strengths ? max($strengths) : null, 'strengthUnit' => 'N/mm²', 'reason' => $status === 'Review' ? 'Complete 28-day Precast cube results are required for final approval.' : null];
            return ['details' => $details, 'status' => $status];
        }
        if ($testType === 'Kerb Stone') return $this->evaluateKerb($details, $material, $standards);
        if (! in_array($testType, ['Ready Mix', 'Blocks', 'Paving Blocks'], true)) return ['details' => $details, 'status' => null];
        $required = $isDammam && $testType === 'Blocks' ? $standard?->dammam_average_strength : $standard?->required_strength;
        $minimumRequired = $isDammam && ! $sandwich && $testType === 'Blocks' ? $standard?->dammam_minimum_strength : null;
        $measurementComplete = count($ageFilteredRows) > 0 && count($strengths) === count($ageFilteredRows);
        $blockAge = self::number($details['blockAge'] ?? null);
        if ($testType === 'Ready Mix') {
            $missingAge = count(array_filter($evaluatedRows, fn ($item) => ! is_array($item['row']) || self::number($item['row']['testAge'] ?? $item['row']['cubeAge'] ?? $item['row']['age'] ?? null) === null)) > 0;
            $hasAnyInput = count(array_filter($ageFilteredRows, fn ($item) => is_array($item['row']) && count(array_filter(array_intersect_key($item['row'], array_flip(['length','width','height','load','strength','calculatedStrength'])), fn ($value) => $value !== null && trim((string) $value) !== '')) > 0)) > 0;
            if (! $missingAge && ! $hasAnyInput) $status = 'Waiting for results';
            else $status = ! $standard || $missingAge || ! $measurementComplete ? 'Review' : (($average ?? 0) >= $required ? 'Passed' : 'Failed');
        } else {
            $status = ! $standard || ! $measurementComplete || ($testType === 'Blocks' && ($blockAge === null || $blockAge <= 0)) || ($testType === 'Blocks' && $isDammam && ! $sandwich && $minimumRequired === null)
                ? 'Review'
                : ((($average ?? 0) < ($required ?? INF)) || ($minimumRequired !== null && min($strengths) < $minimumRequired - 1e-9) ? 'Failed' : 'Passed');
        }
        if ($testType === 'Paving Blocks') {
            $allPavingComplete = count($evaluatedRows) > 0 && count(array_filter($evaluatedRows, fn ($item) => ($item['strength'] ?? null) !== null && ($item['density'] ?? null) !== null && ($item['absorption'] ?? null) !== null)) === count($evaluatedRows);
            if (! $allPavingComplete) $status = 'Review';
        }
        $details['strengthEvaluation'] = ['status' => $status, 'bsStandard' => $standard?->bs_standard, 'requiredStrength' => $required, 'minimumRequiredStrength' => $minimumRequired, 'averageStrength' => $average, 'minimumStrength' => $strengths ? min($strengths) : null, 'maximumStrength' => $strengths ? max($strengths) : null, 'strengthUnit' => $standard?->strength_unit ?? 'N/mm²', 'reason' => $status === 'Review' ? 'Complete specimen results and a matching standard are required.' : null];
        return ['details' => $details, 'status' => $status];
    }

    private function matchingStrengthStandard(string $testType, string $material, array $details, iterable $standards): ?QcStrengthStandard
    {
        foreach ($standards as $standard) {
            if ($standard->test_type !== $testType) continue;
            if ($testType === 'Blocks' && (strcasecmp((string) $standard->block_type, (string) ($details['blockType'] ?? '')) !== 0 || strcasecmp((string) $standard->block_size, (string) ($details['blockSize'] ?? '')) !== 0)) continue;
            if ($testType === 'Paving Blocks' && $standard->block_size && strcasecmp((string) $standard->block_size, (string) ($details['pavingBlockSize'] ?? $details['blockSize'] ?? '')) !== 0) continue;
            if (! in_array($testType, ['Blocks'], true) && strcasecmp($standard->material, $material) !== 0) continue;
            if ($testType === 'Precast' && (int) $standard->cube_age !== 28) continue;
            return $standard;
        }
        return null;
    }

    private function evaluateKerb(array $details, string $material, iterable $standards): array
    {
        $kerbType = strtolower(trim((string) ($details['kerbType'] ?? '')));
        $standard = null;
        foreach ($standards as $candidate) {
            if ($candidate->test_type === 'Kerb Stone' && strcasecmp($candidate->material, $material) === 0 && strcasecmp((string) $candidate->block_type, $kerbType) === 0) { $standard = $candidate; break; }
        }
        $factors = ['road kerb' => [60.3, 37300000], 'edge kerb' => [25, 2600000]];
        $factor = $factors[$kerbType] ?? null;
        $rows = is_array($details['testRows'] ?? null) ? $details['testRows'] : [];
        $strengths = []; $hasIncomplete = count($rows) === 0; $absorptionFailed = false; $absorptionIncomplete = false;
        $limit = self::number($standard?->water_absorption_limit);
        foreach ($rows as &$row) {
            if (! is_array($row)) { $hasIncomplete = true; continue; }
            $load = self::number($row['failureLoad'] ?? $row['load'] ?? null); $span = self::number($row['spanLength'] ?? null);
            $strength = $load !== null && $load > 0 && $span !== null && $span > 0 && $factor ? round(($load * 1000 * $span * $factor[0]) / (4 * $factor[1]), 2) : null;
            if ($strength === null) $hasIncomplete = true; else $strengths[] = $strength;
            $dry = self::number($row['weight'] ?? null); $wet = self::number($row['wetWeight'] ?? null);
            $absorption = $dry !== null && $dry > 0 && $wet !== null ? round(($wet - $dry) / $dry * 100, 2) : null;
            $absorptionStatus = '';
            if (trim((string) ($row['wetWeight'] ?? '')) !== '') {
                if ($absorption === null || $limit === null) { $absorptionIncomplete = true; $absorptionStatus = 'Review'; }
                else { $absorptionStatus = $absorption < $limit ? 'Pass' : 'Fail'; if ($absorptionStatus === 'Fail') $absorptionFailed = true; }
            }
            $row['bendingStrength'] = $strength === null ? '' : number_format($strength, 2, '.', '');
            $row['bendingStrengthOutcome'] = $strength === null || $standard?->minimum_individual_strength === null ? 'Review' : ($strength >= $standard->minimum_individual_strength ? 'Pass' : 'Fail');
            $row['waterAbsorption'] = $absorption === null ? '' : number_format($absorption, 2, '.', '');
            $row['waterAbsorptionStatus'] = $absorptionStatus;
        }
        unset($row);
        $average = $strengths ? round(array_sum($strengths) / count($strengths), 2) : null;
        $minimum = $strengths ? min($strengths) : null; $maximum = $strengths ? max($strengths) : null;
        $failed = ($standard?->required_strength !== null && $average !== null && $average < $standard->required_strength) || ($standard?->minimum_individual_strength !== null && $minimum !== null && $minimum < $standard->minimum_individual_strength) || $absorptionFailed;
        $status = $failed ? 'Failed' : ((!$standard || $hasIncomplete || $absorptionIncomplete || $standard->minimum_individual_strength === null) ? 'Review' : 'Passed');
        $details['testRows'] = $rows;
        $details['strengthEvaluation'] = ['status'=>$status,'bsStandard'=>$standard?->bs_standard,'requiredStrength'=>$standard?->required_strength,'minimumRequiredStrength'=>$standard?->minimum_individual_strength,'averageStrength'=>$average,'minimumStrength'=>$minimum,'maximumStrength'=>$maximum,'strengthUnit'=>$standard?->strength_unit ?? 'MPa','reason'=>$status==='Review'?'Complete Kerb Stone strength and absorption results with a matching standard are required.':null];
        return ['details'=>$details,'status'=>$status];
    }

    public static function sieveSampleWeight(array $rows): float
    {
        $total=0.0;
        foreach($rows as $row){if(!is_array($row))continue;$value=self::number($row['amountReturned']??null);if($value!==null&&$value>=0)$total+=$value;}
        return round($total,2);
    }

    public static function sieveRows(array $sourceRows): array
    {
        $sampleWeight=self::sieveSampleWeight($sourceRows);$cumulative=0.0;$valid=$sampleWeight>0;$rows=[];
        foreach($sourceRows as $index=>$source){
            $values=is_array($source)?$source:[];$amount=self::number($values['amountReturned']??null);
            unset($values['passingAmount'],$values['passingPercentage']);
            if(!isset($source['amountReturned'])||trim((string)$source['amountReturned'])===''){$values['rowNo']=self::number($values['rowNo']??null)??$index+1;$rows[]=$values;continue;}
            $passing=null;
            if($valid&&$amount!==null&&$amount>=0){$cumulative+=$amount;if($cumulative<=$sampleWeight)$passing=round($sampleWeight-$cumulative,2);else $valid=false;}else{$valid=false;}
            $values['rowNo']=self::number($values['rowNo']??null)??$index+1;
            if($amount!==null)$values['amountReturned']=$amount;
            if($passing!==null){$values['passingAmount']=$passing;$values['passingPercentage']=round($passing/$sampleWeight*100,2);}
            $rows[]=$values;
        }
        return ['sampleWeight'=>$sampleWeight,'rows'=>$rows];
    }

    public function evaluateWater(array $details, ?QcWaterStandard $standard): array
    {
        $first = self::number($details['firstChlorideTitrationPoint'] ?? null);
        $second = self::number($details['secondChlorideTitrationPoint'] ?? null);
        $chloride = $first !== null && $second !== null ? ($second - $first) * (0.02 * 10000 * 3.5453) / 50 : self::number($details['chloride'] ?? null);
        if ($chloride !== null) $details['chloride'] = $chloride;
        $so3Raw = $details['so3'] ?? $details['sulphate'] ?? null;
        $so3 = self::number($so3Raw);
        if ($so3 === null && is_string($so3Raw) && preg_match('/^[<>]\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))$/', trim($so3Raw), $match)) $so3 = self::number($match[1]);
        $limits = $standard ? [
            ['pH', self::number($details['ph'] ?? null), $standard->ph_min, $standard->ph_max],
            ['Chloride (Cl)', $chloride, $standard->chloride_min, $standard->chloride_max],
            ['TDS', self::number($details['tds'] ?? null), $standard->tds_min, $standard->tds_max],
            ['SO3', $so3, $standard->so3_min, $standard->so3_max],
        ] : [];
        $criteria = array_map(fn ($item) => ['parameter' => $item[0], 'measuredValue' => $item[1], 'minimum' => (float) $item[2], 'maximum' => (float) $item[3], 'withinLimits' => $item[1] === null ? null : $item[1] >= $item[2] && $item[1] <= $item[3]], $limits);
        $complete = count($criteria) === 4 && count(array_filter($criteria, fn ($item) => $item['measuredValue'] !== null)) === 4;
        $failed = count(array_filter($criteria, fn ($item) => $item['withinLimits'] === false)) > 0;
        $status = ! $standard || ! $complete ? 'Review' : ($failed ? 'Failed' : 'Passed');
        $details['waterEvaluation'] = ['type' => 'water', 'status' => $status, 'standardId' => $standard?->id, 'standardName' => $standard?->name, 'reason' => ! $standard ? 'Configure a Water limit profile before evaluating this record.' : (! $complete ? 'Enter pH, chloride titration points or a ppm result, TDS, and SO3 results to evaluate this record.' : ($failed ? 'One or more Water results are outside the selected profile limits.' : null)), 'criteria' => $criteria];
        return ['details' => $details, 'status' => $status];
    }

}
