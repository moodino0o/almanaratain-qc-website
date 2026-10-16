<?php

namespace App\Services;

use Illuminate\Support\Facades\Hash;
use RuntimeException;

class EmployeePasswordService
{
    public static function isValid(mixed $password): bool
    {
        return is_string($password) && strlen($password) >= 8 && strlen($password) <= 128;
    }

    public static function hash(string $password): string
    {
        return Hash::make($password);
    }

    public static function verify(string $password, ?string $storedHash): bool
    {
        if (! $storedHash) {
            return false;
        }

        if (str_starts_with($storedHash, 'scrypt$')) {
            return self::verifyLegacyScrypt($password, $storedHash);
        }

        return Hash::check($password, $storedHash);
    }

    private static function verifyLegacyScrypt(string $password, string $storedHash): bool
    {
        $parts = explode('$', $storedHash);
        if (count($parts) !== 3 || ! preg_match('/^[a-f0-9]{32}$/i', $parts[1]) ||
            ! preg_match('/^[a-f0-9]{128}$/i', $parts[2])) {
            return false;
        }

        // The original API stores Node/OpenSSL scrypt hashes. Pipe input to a
        // fixed Node program so passwords never appear in process arguments.
        $pipes = [];
        $process = @proc_open(
            ['node', '-e', 'const c=require("node:crypto");let s="";process.stdin.setEncoding("utf8");process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>{const v=JSON.parse(s);process.stdout.write(c.scryptSync(v.password,Buffer.from(v.salt,"hex"),64,{N:16384,r:8,p:1}).toString("hex"));});'],
            [
                0 => ['pipe', 'r'],
                1 => ['pipe', 'w'],
                2 => ['pipe', 'w'],
            ],
            $pipes,
        );
        if (! is_resource($process)) {
            throw new RuntimeException('Node.js is required to verify legacy employee passwords.');
        }

        fwrite($pipes[0], json_encode(['password' => $password, 'salt' => $parts[1]], JSON_THROW_ON_ERROR));
        fclose($pipes[0]);
        $derived = stream_get_contents($pipes[1]);
        fclose($pipes[1]);
        $error = stream_get_contents($pipes[2]);
        fclose($pipes[2]);
        $status = proc_close($process);
        if ($status !== 0) {
            throw new RuntimeException('Legacy employee password verification failed: '.trim($error));
        }

        return hash_equals(strtolower($parts[2]), strtolower(trim($derived)));
    }
}
