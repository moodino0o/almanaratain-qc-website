<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class QcReferenceItem extends Model
{
    protected $table = 'qc_reference_items';
    protected $fillable = ['category_id', 'value'];

    public function category(): BelongsTo
    {
        return $this->belongsTo(QcReferenceCategory::class, 'category_id');
    }

    public function sieveMaterialStandards(): HasMany
    {
        return $this->hasMany(QcSieveStandard::class, 'material_reference_item_id');
    }

    public function sieveSizeStandards(): HasMany
    {
        return $this->hasMany(QcSieveStandard::class, 'sieve_size_reference_item_id');
    }
}
