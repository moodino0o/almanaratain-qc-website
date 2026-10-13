<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EmployeeDirectoryEntry extends Model
{
    protected $table = 'employee_directory';

    protected $fillable = [
        'employee_id',
        'name',
        'password_hash',
        'active',
    ];

    protected function casts(): array
    {
        return [
            'active' => 'boolean',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
        ];
    }
}
