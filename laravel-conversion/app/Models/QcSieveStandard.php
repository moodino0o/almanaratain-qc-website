<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QcSieveStandard extends Model
{
    protected $table = 'qc_sieve_standards';
    protected $fillable = ['test_type', 'material_reference_item_id', 'sieve_size_reference_item_id', 'standard_reference', 'measurement_type', 'minimum', 'maximum', 'unit'];
    protected function casts(): array
    {
        return ['minimum' => 'float', 'maximum' => 'float'];
    }
    public function material(): BelongsTo
    {
        return $this->belongsTo(QcReferenceItem::class, 'material_reference_item_id');
    }
    public function sieveSize(): BelongsTo
    {
        return $this->belongsTo(QcReferenceItem::class, 'sieve_size_reference_item_id');
    }
}
