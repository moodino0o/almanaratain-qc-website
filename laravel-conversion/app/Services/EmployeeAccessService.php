<?php

namespace App\Services;

use App\Models\EmployeeAccess;
use App\Models\User;

class EmployeeAccessService
{
    public const ROLES = ['technician', 'managerial', 'administrator', 'visitor'];

    public static function employeeId(?User $user): ?string
    {
        $id = $user?->getAuthIdentifier();
        if (! is_string($id) || ! str_starts_with($id, 'employee:')) {
            return null;
        }

        $employeeId = trim(substr($id, strlen('employee:')));

        return $employeeId !== '' ? $employeeId : null;
    }

    /** @return array<string, true> */
    public static function configuredAdministrators(): array
    {
        return array_fill_keys(config('qc.admin_employee_ids', []), true);
    }

    public static function role(?User $user, ?EmployeeAccess $access): ?string
    {
        $employeeId = self::employeeId($user);
        if (! $employeeId || ! $access?->active) {
            return null;
        }
        if (isset(self::configuredAdministrators()[$employeeId])) {
            return 'administrator';
        }
        if ($access->administrator || $access->role === 'administrator') {
            return 'administrator';
        }

        return in_array($access->role, self::ROLES, true) ? $access->role : 'technician';
    }

    public static function isAdministrator(?User $user, ?EmployeeAccess $access): bool
    {
        return self::role($user, $access) === 'administrator';
    }

    public static function userResponse(?User $user): ?array
    {
        if (! $user) {
            return null;
        }

        return [
            'id' => $user->id,
            'email' => $user->email,
            'firstName' => $user->first_name,
            'lastName' => $user->last_name,
            'profileImageUrl' => $user->profile_image_url,
        ];
    }
}
