<?php

$adminIds = array_filter(array_map(
    'trim',
    explode(',', (string) env('QC_ADMIN_EMPLOYEE_IDS', '')),
));

return [
    'admin_employee_ids' => array_values($adminIds),
];
