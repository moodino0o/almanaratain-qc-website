<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class QcReferenceCategory extends Model
{
    protected $table = 'qc_reference_categories';
    protected $fillable = ['key', 'label'];

    public function items(): HasMany
    {
        return $this->hasMany(QcReferenceItem::class, 'category_id');
    }
}
