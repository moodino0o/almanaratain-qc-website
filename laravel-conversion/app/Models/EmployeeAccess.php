<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EmployeeAccess extends Model
{
    protected $table = 'employee_access';

    protected $fillable = ['employee_id', 'active', 'administrator', 'role'];

    protected function casts(): array
    {
        return [
            'active' => 'boolean',
            'administrator' => 'boolean',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
        ];
    }
}
