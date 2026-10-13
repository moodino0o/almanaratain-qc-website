<?php

namespace Tests\Feature;

use App\Models\EmployeeAccess;
use App\Models\EmployeeActivityEvent;
use App\Models\EmployeeDirectoryEntry;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class EmployeeAuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_employee_id_login_creates_a_hashed_session_and_current_user_response(): void
    {
        $this->employee('100', 'technician');

        $login = $this->postJson('/api/employee-login', [
            'employeeId' => ' 100 ',
            'password' => 'correct horse battery',
        ])->assertOk()->assertJsonPath('user.id', 'employee:100');

        $token = $login->getCookie('sid', false)?->getValue();
        self::assertNotEmpty($token);
        self::assertTrue($login->getCookie('sid', false)->isSecure());
        self::assertTrue($login->getCookie('sid', false)->isHttpOnly());
        self::assertSame('lax', $login->getCookie('sid', false)->getSameSite());
        $fingerprint = hash('sha256', $token);
        $this->assertDatabaseHas('employee_sessions', [
            'token_hash' => $fingerprint,
            'user_id' => 'employee:100',
        ]);
        $this->assertDatabaseMissing('employee_sessions', ['token_hash' => $token]);
        $this->assertDatabaseHas('employee_activity_sessions', [
            'session_fingerprint' => $fingerprint,
            'employee_id' => '100',
        ]);
        $this->assertDatabaseHas('employee_activity_events', [
            'employee_id' => '100',
            'entity_type' => 'Login attempt',
            'summary' => 'Employee sign-in succeeded.',
        ]);

        $this->withToken($token)
            ->getJson('/api/auth/user')
            ->assertOk()
            ->assertJsonPath('accessAllowed', true)
            ->assertJsonPath('isAdmin', false)
            ->assertJsonPath('role', 'technician');
    }

    public function test_invalid_passwords_are_rejected_and_audited_without_credentials(): void
    {
        $this->employee('101', 'technician');

        $this->postJson('/api/employee-login', [
            'employeeId' => '101',
            'password' => 'wrong password',
        ])->assertUnauthorized();

        $event = EmployeeActivityEvent::query()->firstOrFail();
        self::assertSame('failure', $event->details['outcome']);
        self::assertArrayNotHasKey('password', $event->details);
    }

    public function test_existing_source_app_scrypt_password_hashes_remain_usable(): void
    {
        EmployeeDirectoryEntry::query()->create([
            'employee_id' => 'legacy',
            'name' => 'Legacy Employee',
            'password_hash' => 'scrypt$00112233445566778899aabbccddeeff$29fdfb3d991961e926a19c1136a07e252afa5fdb8d3a0fb74cdcfa5016956f340bd0ec31e1f7c2c4e41b3d62a9ca47988553db4ea59e4fa3b02db2148ddc3d2b',
            'active' => true,
        ]);
        EmployeeAccess::query()->create([
            'employee_id' => 'legacy',
            'active' => true,
            'role' => 'technician',
        ]);

        $this->postJson('/api/employee-login', [
            'employeeId' => 'legacy',
            'password' => 'legacy password',
        ])->assertOk()->assertJsonPath('user.id', 'employee:legacy');
    }

    public function test_directory_only_employee_does_not_gain_approved_access_by_signing_in(): void
    {
        EmployeeDirectoryEntry::query()->create([
            'employee_id' => 'unapproved',
            'name' => 'Unapproved Employee',
            'password_hash' => Hash::make('correct horse battery'),
            'active' => true,
        ]);

        $login = $this->postJson('/api/employee-login', [
            'employeeId' => 'unapproved',
            'password' => 'correct horse battery',
        ])->assertOk();
        $token = $login->getCookie('sid', false)->getValue();

        $this->assertDatabaseMissing('employee_access', ['employee_id' => 'unapproved']);
        $this->withToken($token)
            ->getJson('/api/auth/user')
            ->assertOk()
            ->assertJsonPath('accessAllowed', false)
            ->assertJsonPath('role', null);
        $this->withToken($token)->getJson('/api/qc/lookups')->assertForbidden();
    }

    public function test_revoked_access_closes_the_session_before_the_next_protected_request(): void
    {
        $this->employee('102', 'technician');
        $token = $this->login('102');
        EmployeeAccess::query()->where('employee_id', '102')->update(['active' => false]);

        $this->withToken($token)
            ->getJson('/api/qc/lookups')
            ->assertForbidden();

        $this->assertDatabaseHas('employee_sessions', [
            'token_hash' => hash('sha256', $token),
        ]);
    }

    public function test_inactive_directory_employees_cannot_sign_in_or_reuse_a_session(): void
    {
        $this->employee('103', 'technician');
        $token = $this->login('103');
        EmployeeDirectoryEntry::query()->where('employee_id', '103')->update(['active' => false]);

        $this->withToken($token)
            ->getJson('/api/qc/lookups')
            ->assertUnauthorized();

        $this->postJson('/api/employee-login', [
            'employeeId' => '103',
            'password' => 'correct horse battery',
        ])->assertUnauthorized();
        $this->assertDatabaseMissing('employee_sessions', [
            'token_hash' => hash('sha256', $token),
        ]);
    }

    public function test_visitors_can_read_but_cannot_edit_or_manage_employees(): void
    {
        $this->employee('104', 'visitor');
        $token = $this->login('104');

        $this->withToken($token)->getJson('/api/qc/lookups')->assertOk();
        $this->withToken($token)->postJson('/api/qc/records', [])->assertForbidden();
        $this->withToken($token)->getJson('/api/employees')->assertForbidden();
    }

    public function test_employee_access_administration_provisions_directory_and_password(): void
    {
        $this->administrator('105');

        $created = $this->postJson('/api/auth/employee-access', [
            'employeeId' => '106',
            'name' => 'New Employee',
            'role' => 'managerial',
        ])->assertCreated()->assertJsonPath('role', 'managerial');

        $entryId = $created->json('id');
        $this->assertDatabaseHas('employee_directory', [
            'employee_id' => '106',
            'name' => 'New Employee',
            'active' => true,
        ]);
        $this->assertDatabaseHas('employee_access', [
            'employee_id' => '106',
            'active' => true,
            'role' => 'managerial',
        ]);

        $this->patchJson('/api/auth/employee-access/'.$entryId, [
            'password' => 'new secure password',
        ])->assertOk()->assertJsonPath('passwordSet', true);
        self::assertTrue(Hash::check(
            'new secure password',
            EmployeeDirectoryEntry::query()->where('employee_id', '106')->value('password_hash'),
        ));
    }

    public function test_employee_directory_administration_supports_create_edit_disable_and_delete(): void
    {
        $this->administrator('111');

        $created = $this->postJson('/api/employees', [
            'employeeId' => '112',
            'name' => 'Directory Employee',
        ])->assertCreated()->assertJsonPath('employee.employeeId', '112');
        $directoryId = $created->json('employee.id');

        $this->patchJson('/api/employees/'.$directoryId, [
            'employeeId' => '113',
            'name' => 'Updated Employee',
        ])->assertOk()->assertJsonPath('employee.employeeId', '113');
        $this->assertDatabaseHas('employee_access', [
            'employee_id' => '113',
            'active' => true,
        ]);

        $this->patchJson('/api/employees/'.$directoryId, ['active' => false])
            ->assertOk()->assertJsonPath('employee.active', false);
        $this->assertDatabaseHas('employee_access', [
            'employee_id' => '113',
            'active' => false,
        ]);
        $this->patchJson('/api/employees/'.$directoryId, ['active' => true])
            ->assertOk()->assertJsonPath('employee.active', true);
        $this->deleteJson('/api/employees/'.$directoryId)->assertNoContent();
        $this->assertDatabaseMissing('employee_directory', ['employee_id' => '113']);
        $this->assertDatabaseMissing('employee_access', ['employee_id' => '113']);
    }

    public function test_last_active_administrator_cannot_be_disabled_demoted_or_deleted(): void
    {
        $this->administrator('107');
        $entryId = EmployeeAccess::query()->where('employee_id', '107')->value('id');

        $this->patchJson('/api/auth/employee-access/'.$entryId, ['active' => false])
            ->assertBadRequest()
            ->assertJsonPath('error', 'At least one active administrator must remain.');
        $this->patchJson('/api/auth/employee-access/'.$entryId, ['role' => 'technician'])
            ->assertBadRequest();
        $this->deleteJson('/api/auth/employee-access/'.$entryId)->assertBadRequest();
        $this->patchJson('/api/employees/'.EmployeeDirectoryEntry::query()->where('employee_id', '107')->value('id'), ['active' => false])
            ->assertBadRequest();
        $this->deleteJson('/api/employees/'.EmployeeDirectoryEntry::query()->where('employee_id', '107')->value('id'))
            ->assertBadRequest();

        $this->assertDatabaseHas('employee_access', [
            'employee_id' => '107',
            'active' => true,
            'role' => 'administrator',
        ]);
    }

    public function test_manager_cannot_change_employee_access(): void
    {
        $this->employee('108', 'managerial');
        User::query()->create(['id' => 'employee:108', 'first_name' => 'Test Manager']);
        $this->actingAs(User::query()->findOrFail('employee:108'), 'api');

        $this->getJson('/api/auth/employee-access')->assertForbidden();
        $this->postJson('/api/employees', ['employeeId' => '109', 'name' => 'Blocked'])->assertForbidden();
    }

    public function test_logout_closes_activity_session_and_deletes_the_auth_session(): void
    {
        $this->employee('110', 'technician');
        $token = $this->login('110');
        $fingerprint = hash('sha256', $token);

        $this->withToken($token)
            ->postJson('/api/mobile-auth/logout')
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseMissing('employee_sessions', ['token_hash' => $fingerprint]);
        $this->assertDatabaseHas('employee_activity_sessions', [
            'session_fingerprint' => $fingerprint,
            'end_reason' => 'logout',
        ]);
    }

    private function employee(string $employeeId, string $role): void
    {
        EmployeeDirectoryEntry::query()->create([
            'employee_id' => $employeeId,
            'name' => 'Employee '.$employeeId,
            'password_hash' => Hash::make('correct horse battery'),
            'active' => true,
        ]);
        EmployeeAccess::query()->create([
            'employee_id' => $employeeId,
            'active' => true,
            'administrator' => $role === 'administrator',
            'role' => $role,
        ]);
    }

    private function administrator(string $employeeId): void
    {
        $this->employee($employeeId, 'administrator');
        $user = User::query()->create([
            'id' => 'employee:'.$employeeId,
            'first_name' => 'Administrator',
        ]);
        $this->actingAs($user, 'api');
    }

    private function login(string $employeeId): string
    {
        return $this->postJson('/api/employee-login', [
            'employeeId' => $employeeId,
            'password' => 'correct horse battery',
        ])->assertOk()->getCookie('sid', false)->getValue();
    }
}
