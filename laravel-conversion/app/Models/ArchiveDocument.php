<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ArchiveDocument extends Model
{
    protected $fillable = [
        'original_name',
        'object_path',
        'mime_type',
        'size',
        'category',
        'subcategory',
        'document_date',
        'expiry_date',
        'description',
        'uploaded_by',
    ];

    protected function casts(): array
    {
        return [
            'size' => 'integer',
            'document_date' => 'date:Y-m-d',
            'expiry_date' => 'date:Y-m-d',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
        ];
    }
}
