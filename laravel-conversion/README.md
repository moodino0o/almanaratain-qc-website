# Al Manaratain QC — Laravel conversion

This is a separate, incomplete Laravel conversion. It does not replace or modify the original React/Express application.

## Requirements

- PHP 8.2+
- Composer 2
- Node.js 20+ when verifying employee passwords created by the original API (new passwords use Laravel's password hasher)
- PostgreSQL

The conversion now includes the QC API foundation: records, reference data, strength/water/sieve standards, shape factors, report layouts and templates, dashboard summaries, historical age backfills, report payloads, and PHP calculation coverage. Employee sign-in/access controls, complaint/archive/file workflows, and the copied React pages remain separate conversion phases in `CONVERSION_PLAN.md`.

## Safe setup

1. Copy `.env.example` to `.env`.
2. Configure an isolated PostgreSQL database for this conversion. Do not point it at the original application's database.
3. In this directory, run `composer install`, then `php artisan key:generate`.
4. Review the additive QC migration and confirm the configured database is separate before running it.
5. Run `php artisan migrate`, `php artisan serve`, and `composer test` in a compatible PHP environment.

No real credentials belong in this directory or in `.env.example`.
