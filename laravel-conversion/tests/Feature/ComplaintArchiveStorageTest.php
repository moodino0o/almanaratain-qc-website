<?php

namespace Tests\Feature;

use App\Models\Complaint;
use App\Models\EmployeeAccess;
use App\Models\EmployeeDirectoryEntry;
use App\Models\User;
use App\Services\ObjectStorageService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ComplaintArchiveStorageTest extends TestCase
{
    use RefreshDatabase;

    private ?string $previousPrivateDirectory = null;

    protected function tearDown(): void
    {
        if ($this->previousPrivateDirectory !== null) {
            putenv('PRIVATE_OBJECT_DIR='.$this->previousPrivateDirectory);
            $_ENV['PRIVATE_OBJECT_DIR'] = $this->previousPrivateDirectory;
            $_SERVER['PRIVATE_OBJECT_DIR'] = $this->previousPrivateDirectory;
        } else {
            putenv('PRIVATE_OBJECT_DIR');
            unset($_ENV['PRIVATE_OBJECT_DIR'], $_SERVER['PRIVATE_OBJECT_DIR']);
        }

        parent::tearDown();
    }

    public function test_complaint_crud_preserves_review_signoff_and_explicit_completion(): void
    {
        $this->signInEmployee('manager-1', 'managerial');

        $created = $this->postJson('/api/complaints', [
            'customerName' => '  Gulf Client  ',
            'deliveryDate' => '2026-10-01',
            'complaintType' => 'Crack',
            'materialType' => 'Block',
            'details' => 'A block arrived cracked.',
            'solution' => 'Replaced the block.',
            'qcReviewerName' => 'QC Reviewer',
            'reviewDate' => '2026-10-03',
            'picturePaths' => [[
                'objectPath' => '/objects/uploads/123e4567-e89b-12d3-a456-426614174000',
                'originalName' => 'evidence.jpg',
                'mimeType' => 'image/jpeg',
                'size' => 100,
            ]],
        ])->assertCreated()
            ->assertJsonPath('customerName', 'Gulf Client')
            ->assertJsonPath('status', 'open')
            ->assertJsonPath('qcReviewerName', 'QC Reviewer')
            ->assertJsonPath('reviewDate', '2026-10-03');

        $id = $created->json('id');
        $this->patchJson('/api/complaints/'.$id, ['status' => 'complete'])
            ->assertOk()
            ->assertJsonPath('status', 'complete')
            ->assertJsonPath('qcReviewerName', 'QC Reviewer')
            ->assertJsonPath('picturePaths.0.originalName', 'evidence.jpg');

        $this->getJson('/api/complaints?search=Gulf%20Client&complaintType=Crack')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.complaintNo', $created->json('complaintNo'));
        $this->getJson('/api/complaints/'.$id)
            ->assertOk()
            ->assertJsonPath('reviewDate', '2026-10-03');
        $this->deleteJson('/api/complaints/'.$id)->assertNoContent();
        $this->assertDatabaseMissing('complaints', ['id' => $id]);
    }

    public function test_technicians_can_read_complaints_but_cannot_change_them(): void
    {
        $this->signInEmployee('tech-1', 'technician');
        Complaint::query()->create([
            'complaint_no' => 'CMP-2026-TEST0001',
            'customer_name' => 'Read only',
            'delivery_date' => '2026-10-01',
            'complaint_type' => 'Crack',
            'material_type' => 'Block',
            'details' => 'Read access',
            'status' => 'open',
            'picture_paths' => [],
        ]);

        $this->getJson('/api/complaints')->assertOk()->assertJsonCount(1);
        $this->postJson('/api/complaints', [])->assertForbidden();
        $this->patchJson('/api/complaints/1', ['status' => 'complete'])->assertForbidden();
        $this->deleteJson('/api/complaints/1')->assertForbidden();
    }

    public function test_archive_is_authenticated_and_admin_only_for_metadata_writes(): void
    {
        $this->signInEmployee('visitor-1', 'visitor');
        $this->getJson('/api/archive')
            ->assertOk()
            ->assertJsonPath('categories', [])
            ->assertJsonPath('documents', [])
            ->assertJsonPath('canRetire', false);
        $this->postJson('/api/archive/documents', [])->assertForbidden();
        $this->patchJson('/api/archive/documents/1', [])->assertForbidden();
        $this->deleteJson('/api/archive/documents/1')->assertForbidden();
        $this->postJson('/api/storage/uploads/request-url', [
            'name' => 'controlled.pdf',
            'size' => 100,
            'contentType' => 'application/pdf',
            'purpose' => 'archive',
        ])->assertForbidden();
    }

    public function test_archive_document_metadata_and_content_use_remote_object_bytes(): void
    {
        $this->signInEmployee('admin-1', 'administrator');
        $currentDirectory = getenv('PRIVATE_OBJECT_DIR');
        $this->previousPrivateDirectory = is_string($currentDirectory) ? $currentDirectory : null;
        putenv('PRIVATE_OBJECT_DIR=/test-bucket/private');
        $_ENV['PRIVATE_OBJECT_DIR'] = '/test-bucket/private';
        $_SERVER['PRIVATE_OBJECT_DIR'] = '/test-bucket/private';

        Http::fakeSequence()
            ->push(['signed_url' => 'https://signed-storage.test/put'], 200)
            ->push('uploaded bytes', 200, [
                'Content-Type' => 'application/pdf',
                'Content-Length' => '16',
            ])
            ->push(['signed_url' => 'https://signed-storage.test/read'], 200)
            ->push('inline PDF bytes', 200, [
                'Content-Type' => 'application/pdf',
                'Content-Length' => '16',
            ])
            ->push(['signed_url' => 'https://signed-storage.test/download'], 200)
            ->push('remote PDF bytes', 200, [
                'Content-Type' => 'application/pdf',
                'Content-Length' => '16',
            ]);

        $created = $this->postJson('/api/archive/documents', [
            'originalName' => 'certificate.pdf',
            'objectPath' => '/objects/uploads/123e4567-e89b-12d3-a456-426614174000',
            'mimeType' => 'application/pdf',
            'size' => 16,
            'category' => 'Certificates',
            'subcategory' => 'Plant',
            'documentDate' => '2026-10-01',
            'expiryDate' => null,
            'description' => 'Current certificate',
        ])->assertCreated()
            ->assertJsonPath('originalName', 'certificate.pdf')
            ->assertJsonPath('documentDate', '2026-10-01');

        $id = $created->json('id');
        $this->getJson('/api/archive')
            ->assertOk()
            ->assertJsonPath('categories.0.name', 'Certificates')
            ->assertJsonPath('categories.0.subcategories.0.documents.0.id', $id);
        $this->patchJson('/api/archive/documents/'.$id, [
            'description' => 'Renewal scheduled',
            'expiryDate' => '2027-10-01',
        ])->assertOk()->assertJsonPath('description', 'Renewal scheduled');
        $this->getJson('/api/archive/documents/'.$id)
            ->assertOk()
            ->assertJsonPath('expiryDate', '2027-10-01');
        $this->get('/api/archive/documents/'.$id.'/content')
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf')
            ->assertHeader('Content-Disposition', "inline; filename*=UTF-8''certificate.pdf")
            ->assertSee('inline PDF bytes', false);
        $this->get('/api/archive/documents/'.$id.'/download')
            ->assertOk()
            ->assertHeader('Content-Disposition', "attachment; filename*=UTF-8''certificate.pdf")
            ->assertSee('remote PDF bytes', false);
        $this->assertDatabaseHas('archive_documents', [
            'id' => $id,
            'object_path' => '/objects/uploads/123e4567-e89b-12d3-a456-426614174000',
        ]);
    }

    public function test_upload_request_uses_role_specific_purpose_gates(): void
    {
        $storage = $this->mock(ObjectStorageService::class);
        $storage->shouldReceive('newPrivateUpload')->once()->andReturn([
            'uploadURL' => 'https://signed-storage.test/upload',
            'objectPath' => '/objects/uploads/123e4567-e89b-12d3-a456-426614174000',
        ]);
        $this->signInEmployee('manager-2', 'managerial');

        $this->postJson('/api/storage/uploads/request-url', [
            'name' => 'picture.jpg',
            'size' => 100,
            'contentType' => 'image/jpeg',
            'purpose' => 'complaint',
        ])->assertOk()
            ->assertJsonPath('objectPath', '/objects/uploads/123e4567-e89b-12d3-a456-426614174000')
            ->assertJsonPath('metadata.purpose', 'complaint');
        $this->postJson('/api/storage/uploads/request-url', [
            'name' => 'picture.jpg',
            'size' => 100,
            'contentType' => 'image/jpeg',
            'purpose' => 'archive',
        ])->assertForbidden();
    }

    public function test_original_spa_paths_fall_back_to_the_copied_frontend_build(): void
    {
        if (! is_file(public_path('frontend/index.html'))) {
            $this->markTestSkipped('Run the standalone frontend build before checking SPA routes.');
        }

        $this->get('/')->assertOk()->assertSee('<div id="root">', false);
        $this->get('/complaints/4/print')->assertOk()->assertSee('<div id="root">', false);
        $this->get('/reports/4')->assertOk()->assertSee('<div id="root">', false);
        $this->get('/archive')->assertOk()->assertSee('<div id="root">', false);
    }

    private function signInEmployee(string $employeeId, string $role): void
    {
        EmployeeDirectoryEntry::query()->create([
            'employee_id' => $employeeId,
            'name' => 'Test '.$employeeId,
            'active' => true,
        ]);
        EmployeeAccess::query()->create([
            'employee_id' => $employeeId,
            'active' => true,
            'administrator' => $role === 'administrator',
            'role' => $role,
        ]);
        $user = User::query()->create([
            'id' => 'employee:'.$employeeId,
            'first_name' => 'Test '.$employeeId,
        ]);
        $this->actingAs($user, 'api');
    }
}
