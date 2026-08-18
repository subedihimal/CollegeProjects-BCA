<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/config/bootstrap.php';

app_logout_user();

// Keep a manual logout meaningful: do not immediately auto-login the demo
// account again when the browser follows the redirect to the login page.
setcookie('puzzle_skip_demo_login', '1', [
    'expires' => time() + 31536000,
    'path' => '/',
    'secure' => app_is_https(),
    'httponly' => true,
    'samesite' => 'Lax',
]);

// Remove the legacy database-session cookie too. No database connection is
// needed; any old server-side row will expire through normal session cleanup.
setcookie((string) app_env('SESSION_COOKIE_NAME', 'puzzle_session'), '', [
    'expires' => time() - 42000,
    'path' => '/',
    'secure' => app_is_https(),
    'httponly' => true,
    'samesite' => 'Lax',
]);

header('Location: /', true, 303);
exit();
