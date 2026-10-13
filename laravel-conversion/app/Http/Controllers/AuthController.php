<?php

namespace App\Http\Controllers;

use App\Http\Middleware\EmployeeSessionMiddleware;
use App\Models\EmployeeAccess;
use App\Models\EmployeeActivityEvent;
use App\Models\EmployeeActivitySession;
use App\Models\EmployeeDirectoryEntry;
use App\Models\EmployeeSession;
use App\Models\User;
use App\Services\EmployeeAccessService;
use App\Services\EmployeePasswordService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AuthController extends Controller
{
    private const SESSION_TTL_SECONDS = 604800;

    public function user(Request $request): JsonResponse
    {
        $user = $request->user();
        $employeeId = EmployeeAccessService::employeeId($user);
        $access = $employeeId
            ? EmployeeAccess::query()->where('employee_id', $employeeId)->where('active', true)->first()
            : null;
        $role = EmployeeAccessService::role($user, $access);

        return response()->json([
            'user' => EmployeeAccessService::userResponse($user),
            'accessAllowed' => $role !== null,
            'isAdmin' => $role === 'administrator',
            'role' => $role,
        ]);
    }

    public function login(Request $request): JsonResponse
    {
        $employeeId = is_string($request->input('employeeId'))
            ? trim($request->input('employeeId'))
            : '';
        $password = is_string($request->input('password')) ? $request->input('password') : '';
        $employee = $employeeId !== ''
            ? EmployeeDirectoryEntry::query()->where('employee_id', $employeeId)->where('active', true)->first()
            : null;
        $passwordValid = EmployeePasswordService::isValid($password);

        if (! $employee || ! $passwordValid ||
            ! EmployeePasswordService::verify($password, $employee->password_hash)) {
            $this->recordLoginAttempt(
                $request,
                substr($employeeId !== '' ? $employeeId : 'Unknown', 0, 120),
                substr($employee?->name ?: ($employeeId ?: 'Unknown'), 0, 200),
                'failure',
            );

            return response()->json(['error' => 'Invalid employee ID or password.'], 401);
        }

        $configuredAdmin = isset(EmployeeAccessService::configuredAdministrators()[$employeeId]);
        if ($configuredAdmin) {
            EmployeeAccess::query()->updateOrCreate(
                ['employee_id' => $employeeId],
                ['active' => true, 'administrator' => true, 'role' => 'administrator'],
            );
        }

        $user = User::query()->updateOrCreate(
            ['id' => 'employee:'.$employeeId],
            [
                'email' => null,
                'first_name' => $employee->name,
                'last_name' => null,
                'profile_image_url' => null,
            ],
        );

        $token = bin2hex(random_bytes(32));
        $fingerprint = hash('sha256', $token);
        $expiresAt = now()->addSeconds(self::SESSION_TTL_SECONDS);

        DB::transaction(function () use ($fingerprint, $user, $expiresAt, $employee): void {
            EmployeeSession::query()->create([
                'token_hash' => $fingerprint,
                'user_id' => $user->id,
                'expires_at' => $expiresAt,
            ]);
            EmployeeActivitySession::query()->create([
                'session_fingerprint' => $fingerprint,
                'employee_id' => $employee->employee_id,
                'employee_name' => $employee->name,
                'started_at' => now(),
                'last_seen_at' => now(),
                'expires_at' => $expiresAt,
            ]);
        });

        $this->recordLoginAttempt($request, $employeeId, $employee->name, 'success');

        return response()
            ->json(['user' => EmployeeAccessService::userResponse($user)])
            ->withCookie(cookie('sid', $token, 10080, '/', null, true, true, false, 'lax'));
    }

    public function logout(Request $request): JsonResponse|\Illuminate\Http\RedirectResponse
    {
        $token = EmployeeSessionMiddleware::sessionToken($request);
        if ($token) {
            $this->endSession($token, 'logout');
        }
        $cookie = cookie()->forget('sid', '/');

        if ($request->isMethod('GET')) {
            $returnTo = $request->query('returnTo');
            $safeReturnTo = is_string($returnTo) && str_starts_with($returnTo, '/') &&
                ! str_starts_with($returnTo, '//') ? $returnTo : '/';

            return redirect($safeReturnTo)->withCookie($cookie);
        }

        return response()->json(['success' => true])->withCookie($cookie);
    }

    public function employeeAccessIndex(): JsonResponse
    {
        $entries = EmployeeAccess::query()->orderByDesc('active')->orderBy('employee_id')->get();
        $employeeIds = $entries->pluck('employee_id');
        $directory = EmployeeDirectoryEntry::query()->whereIn('employee_id', $employeeIds)->get()->keyBy('employee_id');
        $users = User::query()->whereIn('id', $employeeIds->map(fn ($id) => 'employee:'.$id))->get()->keyBy('id');

        return response()->json(['employees' => $entries->map(
            fn (EmployeeAccess $entry) => $this->accessResponse($entry, $directory->get($entry->employee_id), $users->get('employee:'.$entry->employee_id)),
        )->values()]);
    }

    public function createEmployeeAccess(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'employeeId' => ['required', 'string', 'max:64'],
            'name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'role' => ['sometimes', 'string', 'in:technician,managerial,administrator,visitor'],
        ]);
        $employeeId = trim($validated['employeeId']);
        $name = trim((string) ($validated['name'] ?? ''));
        $role = $validated['role'] ?? 'technician';
        if ($employeeId === '') {
            return response()->json(['error' => 'A valid employee ID is required.'], 400);
        }

        [$entry, $employee] = DB::transaction(function () use ($employeeId, $name, $role): array {
            $employee = EmployeeDirectoryEntry::query()->where('employee_id', $employeeId)->first();
            if (! $employee && $name === '') {
                return [null, null];
            }
            if (! $employee) {
                $employee = EmployeeDirectoryEntry::query()->create([
                    'employee_id' => $employeeId,
                    'name' => $name,
                    'active' => true,
                ]);
            } elseif (! $employee->active) {
                $employee->active = true;
                $employee->save();
            }

            $entry = EmployeeAccess::query()->updateOrCreate(
                ['employee_id' => $employeeId],
                [
                    'active' => true,
                    'administrator' => $role === 'administrator',
                    'role' => $role,
                ],
            );

            return [$entry, $employee];
        });

        if (! $entry || ! $employee) {
            return response()->json(['error' => 'Enter an employee name when adding a new employee.'], 400);
        }

        return response()->json(['id' => $entry->id] + $this->accessResponse($entry, $employee), 201);
    }

    public function updateEmployeeAccess(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'active' => ['sometimes', 'boolean'],
            'administrator' => ['sometimes', 'boolean'],
            'role' => ['sometimes', 'string', 'in:technician,managerial,administrator,visitor'],
            'name' => ['sometimes', 'string', 'min:1', 'max:255'],
            'password' => ['sometimes', 'string', 'min:8', 'max:128'],
        ]);
        if ($validated === []) {
            return response()->json(['error' => 'Invalid employee access update.'], 400);
        }
        if (array_key_exists('name', $validated) && trim($validated['name']) === '') {
            return response()->json(['error' => 'Employee name cannot be blank.'], 400);
        }

        $entry = DB::transaction(function () use ($id, $validated): ?EmployeeAccess {
            $entry = EmployeeAccess::query()->whereKey($id)->lockForUpdate()->first();
            if (! $entry) {
                return null;
            }

            $wasAdministrator = $entry->administrator || $entry->role === 'administrator';
            $newAdministrator = array_key_exists('role', $validated)
                ? $validated['role'] === 'administrator'
                : ($validated['administrator'] ?? $wasAdministrator);
            $newActive = $validated['active'] ?? $entry->active;
            if ($entry->active && $wasAdministrator && (! $newActive || ! $newAdministrator)) {
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

            $entry->active = $newActive;
            if (array_key_exists('role', $validated) || array_key_exists('administrator', $validated)) {
                $entry->administrator = $newAdministrator;
                $entry->role = $validated['role'] ?? ($newAdministrator ? 'administrator' : 'technician');
            }
            $entry->save();

            $employee = EmployeeDirectoryEntry::query()->where('employee_id', $entry->employee_id)->first();
            if ($employee) {
                if (array_key_exists('name', $validated)) {
                    $employee->name = trim($validated['name']);
                    $employee->save();
                    User::query()->whereKey('employee:'.$entry->employee_id)->update([
                        'first_name' => $employee->name,
                        'last_name' => null,
                    ]);
                }
                if (array_key_exists('password', $validated)) {
                    $employee->password_hash = EmployeePasswordService::hash($validated['password']);
                    $employee->save();
                }
            }

            return $entry;
        });

        if (! $entry) {
            return response()->json(['error' => 'Employee access entry not found.'], 404);
        }

        $employee = EmployeeDirectoryEntry::query()->where('employee_id', $entry->employee_id)->first();
        $user = User::query()->whereKey('employee:'.$entry->employee_id)->first();

        return response()->json($this->accessResponse($entry, $employee, $user));
    }

    public function deleteEmployeeAccess(int $id): JsonResponse
    {
        $deleted = DB::transaction(function () use ($id): bool {
            $entry = EmployeeAccess::query()->whereKey($id)->lockForUpdate()->first();
            if (! $entry) {
                return false;
            }
            if ($entry->active && ($entry->administrator || $entry->role === 'administrator')) {
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
            $entry->delete();

            return true;
        });

        return $deleted ? response()->json(null, 204) : response()->json(['error' => 'Employee access entry not found.'], 404);
    }

    private function accessResponse(EmployeeAccess $entry, ?EmployeeDirectoryEntry $employee, ?User $user = null): array
    {
        $name = trim(implode(' ', array_filter([$user?->first_name, $user?->last_name])));
        $role = $entry->administrator || $entry->role === 'administrator'
            ? 'administrator'
            : (in_array($entry->role, EmployeeAccessService::ROLES, true) ? $entry->role : 'technician');

        return [
            'id' => $entry->id,
            'employeeId' => $entry->employee_id,
            'displayName' => $name !== '' ? $name : ($employee?->name ?: 'Employee '.$entry->employee_id),
            'active' => (bool) $entry->active,
            'administrator' => (bool) $entry->administrator,
            'role' => $role,
            'passwordSet' => (bool) $employee?->password_hash,
            'createdAt' => $entry->created_at,
            'updatedAt' => $entry->updated_at,
        ];
    }

    private function recordLoginAttempt(Request $request, string $employeeId, string $employeeName, string $outcome): void
    {
        $ipAddress = trim((string) $request->ip());
        if (str_starts_with(strtolower($ipAddress), '::ffff:')) {
            $ipAddress = substr($ipAddress, 7);
        }
        if (! filter_var($ipAddress, FILTER_VALIDATE_IP)) {
            $ipAddress = 'Unknown';
        }

        try {
            EmployeeActivityEvent::query()->create([
                'employee_id' => substr($employeeId ?: 'Unknown', 0, 120),
                'employee_name' => substr($employeeName ?: 'Unknown', 0, 200),
                'action' => 'created',
                'entity_type' => 'Login attempt',
                'summary' => $outcome === 'success'
                    ? 'Employee sign-in succeeded.'
                    : 'Employee sign-in failed.',
                'details' => [
                    'loginAttempt' => true,
                    'outcome' => $outcome,
                    'ipAddress' => $ipAddress,
                    'location' => 'Unavailable',
                ],
            ]);
        } catch (\Throwable $error) {
            Log::warning('Could not record employee login attempt.', ['outcome' => $outcome]);
        }
    }

    private function endSession(string $token, string $reason): void
    {
        $fingerprint = hash('sha256', $token);
        $session = EmployeeSession::query()->find($fingerprint);
        if ($session) {
            EmployeeSessionMiddleware::closeSession($session, $reason);
        }
    }
}
