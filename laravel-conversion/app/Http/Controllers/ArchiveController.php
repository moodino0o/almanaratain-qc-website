<?php

namespace App\Http\Controllers;

use App\Models\ArchiveDocument;
use App\Services\EmployeeAccessService;
use App\Services\ObjectStorageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class ArchiveController extends Controller
{
    private const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx'];
    private const ALLOWED_MIME_TYPES = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    public function __construct(private readonly ObjectStorageService $storage)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $documents = ArchiveDocument::query()->orderByDesc('created_at')->get();
        $presented = $documents->map(fn (ArchiveDocument $document): array => $this->present($document))->values();
        $categories = $presented->groupBy('category')->map(function ($categoryDocuments, string $category): array {
            $subcategories = $categoryDocuments->groupBy('subcategory')->map(
                fn ($items, string $name): array => [
                    'name' => $name,
                    'count' => $items->count(),
                    'documents' => $items->values(),
                ],
            )->values();

            return [
                'name' => $category,
                'count' => $categoryDocuments->count(),
                'subcategories' => $subcategories,
            ];
        })->values();

        return response()->json([
            'categories' => $categories,
            'documents' => $presented,
            'canRetire' => $this->canRetire($request),
        ]);
    }

    public function show(int $id): JsonResponse
    {
        $document = ArchiveDocument::query()->find($id);
        abort_unless($document, 404, 'Document not found.');

        return response()->json($this->present($document));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'originalName' => ['required', 'string', 'min:1', 'max:512'],
            'objectPath' => ['required', 'string', 'regex:#^/objects/uploads/[A-Za-z0-9-]+$#'],
            'mimeType' => ['required', 'string', 'min:1', 'max:255'],
            'size' => ['required', 'integer', 'min:1', 'max:26214400'],
            'category' => ['required', 'string', 'min:1', 'max:255'],
            'subcategory' => ['required', 'string', 'min:1', 'max:255'],
            'documentDate' => ['required', 'date'],
            'expiryDate' => ['sometimes', 'nullable', 'date'],
            'description' => ['sometimes', 'string'],
        ]);
        $extension = strtolower(pathinfo($data['originalName'], PATHINFO_EXTENSION));
        if (! in_array($extension, self::ALLOWED_EXTENSIONS, true) &&
            ! in_array(strtolower($data['mimeType']), self::ALLOWED_MIME_TYPES, true)) {
            return response()->json(['error' => 'Unsupported document or invalid storage path'], 400);
        }
        try {
            $stored = $this->storage->getPrivateObject($data['objectPath']);
            if (! $stored->successful()) {
                return response()->json(['error' => 'Uploaded file was not found in object storage.'], 400);
            }
        } catch (RuntimeException $error) {
            report($error);

            return response()->json(['error' => 'Unable to verify the uploaded file.'], 503);
        }
        $document = ArchiveDocument::query()->create([
            'original_name' => trim($data['originalName']),
            'object_path' => $data['objectPath'],
            'mime_type' => $data['mimeType'],
            'size' => $data['size'],
            'category' => trim($data['category']),
            'subcategory' => trim($data['subcategory']),
            'document_date' => $data['documentDate'],
            'expiry_date' => $data['expiryDate'] ?? null,
            'description' => $data['description'] ?? '',
            'uploaded_by' => $request->user()->getAuthIdentifier(),
        ]);

        return response()->json($this->present($document), 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $document = ArchiveDocument::query()->find($id);
        abort_unless($document, 404, 'Document not found.');
        $data = $request->validate([
            'originalName' => ['sometimes', 'string', 'min:1', 'max:512'],
            'category' => ['sometimes', 'string', 'min:1', 'max:255'],
            'subcategory' => ['sometimes', 'string', 'min:1', 'max:255'],
            'documentDate' => ['sometimes', 'date'],
            'expiryDate' => ['sometimes', 'nullable', 'date'],
            'description' => ['sometimes', 'string'],
        ]);
        $map = [
            'originalName' => 'original_name',
            'category' => 'category',
            'subcategory' => 'subcategory',
            'documentDate' => 'document_date',
            'expiryDate' => 'expiry_date',
            'description' => 'description',
        ];
        foreach ($map as $input => $column) {
            if (array_key_exists($input, $data)) {
                $document->{$column} = $data[$input];
            }
        }
        $document->save();

        return response()->json($this->present($document->refresh()));
    }

    public function content(int $id)
    {
        return $this->serveDocument($id, false);
    }

    public function download(int $id)
    {
        return $this->serveDocument($id, true);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if (! $this->canRetire($request)) {
            return response()->json(['error' => 'Archive manager access required'], 403);
        }
        $document = ArchiveDocument::query()->find($id);
        abort_unless($document, 404, 'Document not found.');
        try {
            $this->storage->deletePrivateObject($document->object_path);
            $document->delete();
        } catch (RuntimeException $error) {
            report($error);

            return response()->json(['error' => 'Unable to clean up the stored file or metadata'], 500);
        }

        return response()->json(null, 204);
    }

    private function serveDocument(int $id, bool $download)
    {
        $document = ArchiveDocument::query()->find($id);
        abort_unless($document, 404, 'Document not found.');
        try {
            $stored = $this->storage->getPrivateObject($document->object_path);
            if ($stored->status() === 404) {
                return response()->json(['error' => 'Stored file not found'], 404);
            }
            if (! $stored->successful()) {
                return response()->json(['error' => 'Unable to retrieve the stored file'], 502);
            }

            $filename = $document->original_name;
            if (! preg_match('/\.[a-z0-9]{2,5}$/i', $filename)) {
                $extension = match (true) {
                    $document->mime_type === 'application/pdf' => 'pdf',
                    str_contains($document->mime_type, 'word') => 'docx',
                    str_contains($document->mime_type, 'excel'), str_contains($document->mime_type, 'spreadsheet') => 'xlsx',
                    default => '',
                };
                if ($extension !== '') {
                    $filename .= '.'.$extension;
                }
            }
            $disposition = $download || $document->mime_type !== 'application/pdf' ? 'attachment' : 'inline';

            return response($stored->body(), 200, [
                'Content-Type' => $document->mime_type,
                'Content-Length' => $stored->header('Content-Length') ?? (string) strlen($stored->body()),
                'Cache-Control' => 'private, no-store',
                'Content-Disposition' => $disposition.'; filename*=UTF-8\'\''.rawurlencode($filename),
                'X-Content-Type-Options' => 'nosniff',
            ]);
        } catch (RuntimeException $error) {
            report($error);

            return response()->json(['error' => 'Unable to retrieve the stored file'], 502);
        }
    }

    private function present(ArchiveDocument $document): array
    {
        return [
            'id' => $document->id,
            'originalName' => $document->original_name,
            'mimeType' => $document->mime_type,
            'size' => $document->size,
            'category' => $document->category,
            'subcategory' => $document->subcategory,
            'documentDate' => $document->document_date?->format('Y-m-d'),
            'expiryDate' => $document->expiry_date?->format('Y-m-d'),
            'description' => $document->description,
            'uploadedAt' => $document->created_at?->toISOString(),
        ];
    }

    private function canRetire(Request $request): bool
    {
        $user = $request->user();
        if (! $user || (string) ($user->role ?? '') !== 'administrator') {
            return false;
        }
        $employeeId = EmployeeAccessService::employeeId($user) ?? '';
        $allowedEmails = array_filter(array_map('strtolower', array_map('trim', explode(',', (string) env('ARCHIVE_MANAGER_EMAILS', '')))));
        $allowedIds = array_filter(array_map('trim', explode(',', (string) env('ARCHIVE_MANAGER_EMPLOYEE_IDS', ''))));
        $email = strtolower(trim((string) $user->email));

        return ($email !== '' && in_array($email, $allowedEmails, true)) ||
            ($employeeId !== '' && in_array($employeeId, $allowedIds, true));
    }
}
