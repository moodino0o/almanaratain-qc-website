<?php

namespace Tests\Feature;

use Tests\TestCase;

class QcAuthenticationTest extends TestCase
{
    public function test_qc_read_routes_require_an_authenticated_employee(): void
    {
        $this->getJson('/api/qc/lookups')->assertUnauthorized();
        $this->getJson('/api/qc/records')->assertUnauthorized();
    }
}
