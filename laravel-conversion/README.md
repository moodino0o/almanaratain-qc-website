# Al Manaratain QC — Laravel conversion

This is a separate, incomplete Laravel conversion. It does not replace or modify the original React/Express application.

## Requirements

- PHP 8.2+
- Composer 2
- PostgreSQL

PHP and Composer are not installed in the current Replit environment, so this project has not been booted or tested here. `/api/healthz` is the only API endpoint implemented so far. Initial migrations and models cover QC records, reference data, complaints, and the employee directory; other source features are listed in `FEATURE_MAP.md` and remain to be ported.

## Safe setup

1. Copy `.env.example` to `.env`.
2. Configure an isolated PostgreSQL database for this conversion. Do not point it at the original application's database.
3. In this directory, run `composer install`, then `php artisan key:generate`.
4. Do not run migrations until the conversion migrations have been reviewed and the configured database is confirmed to be separate.
5. Run `php artisan serve` and `composer test` in a compatible PHP environment.

No real credentials belong in this directory or in `.env.example`.
