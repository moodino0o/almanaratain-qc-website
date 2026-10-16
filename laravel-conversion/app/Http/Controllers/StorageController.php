<?php

namespace App\Http\Controllers;

use App\Services\ObjectStorageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class StorageController extends Controller
{
    public function __construct(private readonly ObjectStorageService $storage)
    {
    }

    public function requestUploadUrl(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:1', 'max:255'],
            'size' => ['required', 'integer', 'min:1'],
            'contentType' => ['required', 'string', 'min:1', 'max:255'],
            'purpose' => ['required', 'in:complaint,archive,report-template'],
        ]);
        $role = (string) $request->user()->role;
        $allowed = in_array($data['purpose'], ['archive', 'report-template'], true)
            ? $role === 'administrator'
            : in_array($role, ['managerial', 'administrator'], true);
        if (! $allowed) {
            return response()->json(['error' => 'Your role does not allow this upload.'], 403);
        }
        $contentType = strtolower($data['contentType']);
        if ($data['purpose'] === 'complaint' &&
            (! str_starts_with($contentType, 'image/') || $data['size'] > 10 * 1024 * 1024)) {
            return response()->json(['error' => 'Complaint pictures must be images smaller than 10 MB.'], 400);
        }
        if ($data['purpose'] === 'archive' && $data['size'] > 25 * 1024 * 1024) {
            return response()->json(['error' => 'Archive documents must be 25 MB or smaller.'], 400);
        }
        if ($data['purpose'] === 'report-template' &&
            (! in_array($contentType, ['image/jpeg', 'image/png', 'image/webp'], true) || $data['size'] > 10 * 1024 * 1024)) {
            return response()->json(['error' => 'Report template images must be JPEG, PNG, or WebP files under 10 MB.'], 400);
        }

        try {
            $upload = $this->storage->newPrivateUpload();
        } catch (RuntimeException $error) {
            report($error);

            return response()->json(['error' => 'Object storage is not configured for uploads.'], 503);
        }

        return response()->json([
            'uploadURL' => $upload['uploadURL'],
            'objectPath' => $upload['objectPath'],
            'metadata' => [
                'name' => $data['name'],
                'size' => (int) $data['size'],
                'contentType' => $data['contentType'],
                'purpose' => $data['purpose'],
            ],
        ]);
    }

    public function privateObject(string $objectPath)
    {
        try {
            $stored = $this->storage->getPrivateObject('/objects/'.$objectPath);
            if ($stored->status() === 404) {
                return response()->json(['error' => 'Object not found'], 404);
            }
            if (! $stored->successful()) {
                return response()->json(['error' => 'Unable to serve object'], 502);
            }

            return response($stored->body(), 200, $this->objectHeaders($stored, 'private'));
        } catch (RuntimeException $error) {
            report($error);

            return response()->json(['error' => 'Unable to serve object'], 502);
        }
    }

    public function publicObject(string $filePath)
    {
        try {
            $stored = $this->storage->getPublicObject($filePath);
            if (! $stored) {
                return response()->json(['error' => 'File not found'], 404);
            }

            return response($stored->body(), 200, $this->objectHeaders($stored, 'public'));
        } catch (RuntimeException $error) {
            report($error);

            return response()->json(['error' => 'Unable to serve public object'], 502);
        }
    }

    private function objectHeaders(\Illuminate\Http\Client\Response $stored, string $visibility): array
    {
        $headers = [
            'Content-Type' => $stored->header('Content-Type', 'application/octet-stream'),
            'Cache-Control' => $visibility.', max-age=3600',
            'X-Content-Type-Options' => 'nosniff',
        ];
        if ($stored->header('Content-Length')) {
            $headers['Content-Length'] = $stored->header('Content-Length');
        }

        return $headers;
    }
}
