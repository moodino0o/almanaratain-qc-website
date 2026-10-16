<?php

namespace App\Services;

use Illuminate\Http\Client\Response as ClientResponse;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

class ObjectStorageService
{
    private const SIDECAR = 'http://127.0.0.1:1106';

    public function newPrivateUpload(): array
    {
        $objectId = (string) Str::uuid();
        $path = '/objects/uploads/'.$objectId;

        return [
            'objectPath' => $path,
            'uploadURL' => $this->signedUrl($this->privateObjectName($path), 'PUT', 900),
        ];
    }

    public function getPrivateObject(string $path): ClientResponse
    {
        return $this->fetchObject($this->privateObjectName($path));
    }

    public function deletePrivateObject(string $path): void
    {
        $url = $this->signedUrl($this->privateObjectName($path), 'DELETE', 900);
        try {
            $response = Http::timeout(30)->delete($url);
        } catch (ConnectionException $error) {
            throw new RuntimeException('Unable to delete the stored object.', 0, $error);
        }
        if (! $response->successful() && $response->status() !== 404) {
            throw new RuntimeException('Unable to delete the stored object.');
        }
    }

    public function getPublicObject(string $relativePath): ?ClientResponse
    {
        foreach ($this->publicDirectories() as $directory) {
            $objectName = $this->objectName($directory, $relativePath);
            $response = $this->fetchObject($objectName);
            if ($response->successful()) {
                return $response;
            }
            if ($response->status() !== 404) {
                throw new RuntimeException('Unable to retrieve the public object.');
            }
        }

        return null;
    }

    private function fetchObject(string $objectName): ClientResponse
    {
        try {
            return Http::timeout(60)->get($this->signedUrl($objectName, 'GET', 900));
        } catch (ConnectionException $error) {
            throw new RuntimeException('Unable to retrieve the stored object.', 0, $error);
        }
    }

    private function signedUrl(string $objectName, string $method, int $ttlSeconds): string
    {
        [$bucket, $name] = $this->splitStoragePath($objectName);
        try {
            $response = Http::timeout(30)->post(self::SIDECAR.'/object-storage/signed-object-url', [
                'bucket_name' => $bucket,
                'object_name' => $name,
                'method' => $method,
                'expires_at' => now()->addSeconds($ttlSeconds)->toISOString(),
            ]);
        } catch (ConnectionException $error) {
            throw new RuntimeException('Object storage could not issue a signed URL.', 0, $error);
        }

        if (! $response->successful() || ! is_string($response->json('signed_url'))) {
            throw new RuntimeException('Object storage could not issue a signed URL.');
        }

        return $response->json('signed_url');
    }

    private function privateObjectName(string $objectPath): string
    {
        if (! preg_match('#^/objects/uploads/[A-Za-z0-9-]+$#', $objectPath)) {
            throw new RuntimeException('Invalid private object path.');
        }

        $directory = trim((string) env('PRIVATE_OBJECT_DIR', ''), '/');
        if ($directory === '') {
            throw new RuntimeException('PRIVATE_OBJECT_DIR is not configured.');
        }

        return '/'.$directory.'/'.substr($objectPath, strlen('/objects/'));
    }

    private function publicDirectories(): array
    {
        $directories = array_values(array_filter(array_map(
            static fn (string $path): string => trim($path),
            explode(',', (string) env('PUBLIC_OBJECT_SEARCH_PATHS', '')),
        )));
        if ($directories === []) {
            throw new RuntimeException('PUBLIC_OBJECT_SEARCH_PATHS is not configured.');
        }

        return $directories;
    }

    private function objectName(string $directory, string $relativePath): string
    {
        $relativePath = trim($relativePath, '/');
        if ($relativePath === '' || str_contains($relativePath, '..') || str_contains($relativePath, '\\')) {
            throw new RuntimeException('Invalid public object path.');
        }

        return '/'.trim($directory, '/').'/'.$relativePath;
    }

    private function splitStoragePath(string $path): array
    {
        $parts = explode('/', trim($path, '/'), 2);
        if (count($parts) !== 2 || $parts[0] === '' || $parts[1] === '') {
            throw new RuntimeException('Invalid object storage directory.');
        }

        return $parts;
    }
}
