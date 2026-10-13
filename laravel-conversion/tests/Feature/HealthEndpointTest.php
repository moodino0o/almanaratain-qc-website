<?php

namespace Tests\Feature;

use Tests\TestCase;

class HealthEndpointTest extends TestCase
{
    public function test_health_endpoint_reports_the_conversion_app_as_available(): void
    {
        $this->getJson('/api/healthz')
            ->assertOk()
            ->assertJson([
                'status' => 'ok',
                'application' => 'al-manaratain-qc-laravel-conversion',
            ]);
    }
}
