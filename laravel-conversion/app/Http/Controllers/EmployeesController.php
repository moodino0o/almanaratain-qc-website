<?php

namespace App\Http\Controllers;

use App\Models\EmployeeAccess;
use App\Models\EmployeeDirectoryEntry;
use App\Services\EmployeeAccessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EmployeesController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'employees' => EmployeeDirectoryEntry::query()
                ->orderBy('name')
                ->orderBy('employee_id')
                ->get()
                ->map(fn (EmployeeDirectoryEntry $employee) => $this->employeeResponse($employee))
                ->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'employeeId' => ['required', 'string', 'max:64'],
            'name' => ['required', 'string', 'max:255'],
        ]);
        $employeeId = trim($validated['employeeId']);
        $name = trim($validated['name']);
        if ($employeeId === '' || $name === '') {
            return response()->json(['error' => 'A valid employee name and ID are required.'], 400);
        }
        if (EmployeeDirectoryEntry::query()->where('employee_id', $employeeId)->exists()) {
            return response()->json(['error' => 'That employee ID is already registered.'], 409);
        }

        $employee = DB::transaction(function () use ($employeeId, $name): EmployeeDirectoryEntry {
            $employee = EmployeeDirectoryEntry::query()->create([
                'employee_id' => $employeeId,
                'name' => $name,
                'active' => true,
            ]);
            EmployeeAccess::query()->updateOrCreate(
                ['employee_id' => $employeeId],
                ['active' => true],
            );

            return $employee;
        });

        return response()->json(['employee' => $this->employeeResponse($employee)], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'employeeId' => ['sometimes', 'string', 'max:64'],
            'name' => ['sometimes', 'string', 'max:255'],
            'active' => ['sometimes', 'boolean'],
        ]);
        if ($validated === []) {
            return response()->json(['error' => 'A valid employee update is required.'], 400);
        }
        if (isset($validated['employeeId'])) {
            $validated['employeeId'] = trim($validated['employeeId']);
            if ($validated['employeeId'] === '') {
                return response()->json(['error' => 'A valid employee update is required.'], 400);
            }
            if (EmployeeDirectoryEntry::query()
                ->where('employee_id', $validated['employeeId'])
                ->where('id', '!=', $id)
                ->exists()) {
                return response()->json(['error' => 'That employee ID is already registered.'], 409);
            }
        }
        if (isset($validated['name'])) {
            $validated['name'] = trim($validated['name']);
            if ($validated['name'] === '') {
                return response()->json(['error' => 'A valid employee update is required.'], 400);
            }
        }

        $employee = DB::transaction(function () use ($id, $validated): ?EmployeeDirectoryEntry {
            $employee = EmployeeDirectoryEntry::query()->whereKey($id)->lockForUpdate()->first();
            if (! $employee) {
                return null;
            }
            $oldEmployeeId = $employee->employee_id;
            $access = EmployeeAccess::query()->where('employee_id', $oldEmployeeId)->lockForUpdate()->first();
            if (array_key_exists('active', $validated) && ! $validated['active'] &&
                $employee->active && $access &&
                ($access->administrator || $access->role === 'administrator')) {
                $activeAdmins = EmployeeAccess::query()
                    ->where('active', true)
                    ->where(fn ($query) => $query->where('administrator', true)->orWhere('role', 'administrator'))
                    ->lockForUpdate()
                    ->get(['id'])
                    ->count();
                if ($activeAdmins <= 1) {
                    abort(response()->json(['error' => 'At least one active administrator must remain.'], 400));
                }
            }

            if (array_key_exists('employeeId', $validated)) {
                $employee->employee_id = $validated['employeeId'];
            }
            if (array_key_exists('name', $validated)) {
                $employee->name = $validated['name'];
            }
            if (array_key_exists('active', $validated)) {
                $employee->active = $validated['active'];
            }
            $employee->save();

            if ($oldEmployeeId !== $employee->employee_id && $access) {
                $access->employee_id = $employee->employee_id;
                $access->save();
            }
            if ($access && array_key_exists('active', $validated)) {
                $access->active = $validated['active'];
                $access->save();
            } elseif (! $access && ($validated['active'] ?? false)) {
                EmployeeAccess::query()->create(['employee_id' => $employee->employee_id, 'active' => true]);
            }

            return $employee;
        });

        return $employee
            ? response()->json(['employee' => $this->employeeResponse($employee)])
            : response()->json(['error' => 'Employee not found.'], 404);
    }

    public function destroy(int $id): JsonResponse
    {
        $deleted = DB::transaction(function () use ($id): bool {
            $employee = EmployeeDirectoryEntry::query()->whereKey($id)->lockForUpdate()->first();
            if (! $employee) {
                return false;
            }
            $access = EmployeeAccess::query()->where('employee_id', $employee->employee_id)->lockForUpdate()->first();
            if ($employee->active && $access?->active &&
                ($access->administrator || $access->role === 'administrator')) {
                $activeAdmins = EmployeeAccess::query()
                    ->where('active', true)
                    ->where(fn ($query) => $query->where('administrator', true)->orWhere('role', 'administrator'))
                    ->lockForUpdate()
                    ->get(['id'])
                    ->count();
                if ($activeAdmins <= 1) {
                    abort(response()->json(['error' => 'At least one active administrator must remain.'], 400));
                }
            }
            $access?->delete();
            $employee->delete();

            return true;
        });

        return $deleted ? response()->json(null, 204) : response()->json(['error' => 'Employee not found.'], 404);
    }

    private function employeeResponse(EmployeeDirectoryEntry $employee): array
    {
        return [
            'id' => $employee->id,
            'employeeId' => $employee->employee_id,
            'name' => $employee->name,
            'active' => (bool) $employee->active,
            'createdAt' => $employee->created_at,
            'updatedAt' => $employee->updated_at,
        ];
    }
}
