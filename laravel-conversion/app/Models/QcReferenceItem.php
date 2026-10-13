<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QcReferenceItem extends Model
{
    protected $table = 'qc_reference_items';

    protected $fillable = ['category_id', 'value'];

    public function category(): BelongsTo
    {
        return $this->belongsTo(QcReferenceCategory::class, 'category_id');
    }
}
