<?php

declare(strict_types=1);

if (defined('APP_BOOTSTRAPPED')) {
    return;
}

define('APP_BOOTSTRAPPED', true);
define('APP_ROOT', dirname(__DIR__));

/**
 * Load a local .env file without overriding variables supplied by Vercel.
 */
function app_load_env(string $path): void
{
    if (!is_readable($path)) {
        return;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        return;
    }

    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }

        if (str_starts_with($line, 'export ')) {
            $line = trim(substr($line, 7));
        }

        $separator = strpos($line, '=');
        if ($separator === false) {
            continue;
        }

        $key = trim(substr($line, 0, $separator));
        $value = trim(substr($line, $separator + 1));

        if (!preg_match('/^[A-Z_][A-Z0-9_]*$/i', $key) || getenv($key) !== false) {
            continue;
        }

        if (strlen($value) >= 2) {
            $first = $value[0];
            $last = $value[strlen($value) - 1];
            if (($first === '"' && $last === '"') || ($first === "'" && $last === "'")) {
                $value = substr($value, 1, -1);
                if ($first === '"') {
                    $value = str_replace(['\\n', '\\r', '\\t'], ["\n", "\r", "\t"], $value);
                }
            }
        }

        putenv($key . '=' . $value);
        $_ENV[$key] = $value;
        $_SERVER[$key] = $value;
    }
}

app_load_env(APP_ROOT . '/.env');

function app_env(string $key, ?string $default = null): ?string
{
    $value = getenv($key);
    return $value === false ? $default : $value;
}

function app_env_bool(string $key, bool $default = false): bool
{
    $value = app_env($key);
    if ($value === null || $value === '') {
        return $default;
    }

    return filter_var($value, FILTER_VALIDATE_BOOLEAN);
}

function app_required_env(string $key): string
{
    $value = app_env($key);
    if ($value === null || $value === '') {
        throw new RuntimeException("Missing required environment variable: {$key}");
    }

    return $value;
}

function app_is_https(): bool
{
    if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
        return true;
    }

    return strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
}

function app_database(): mysqli
{
    static $connection = null;

    if ($connection instanceof mysqli) {
        return $connection;
    }

    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

    $host = app_required_env('DB_HOST');
    $port = (int) app_env('DB_PORT', '3306');
    $database = app_required_env('DB_NAME');
    $username = app_required_env('DB_USER');
    $password = (string) app_env('DB_PASSWORD', '');

    $connection = mysqli_init();
    if ($connection === false) {
        throw new RuntimeException('Could not initialize the database client.');
    }

    $flags = 0;
    if (app_env_bool('DB_SSL')) {
        $caPath = app_env('DB_SSL_CA');
        $connection->ssl_set(null, null, $caPath ?: null, null, null);
        $flags |= MYSQLI_CLIENT_SSL;
    }

    $connection->real_connect($host, $username, $password, $database, $port, null, $flags);
    $connection->set_charset('utf8mb4');

    return $connection;
}

final class DatabaseSessionHandler implements SessionHandlerInterface
{
    public function __construct(private mysqli $connection)
    {
    }

    public function open(string $path, string $name): bool
    {
        return true;
    }

    public function close(): bool
    {
        return true;
    }

    public function read(string $id): string|false
    {
        $statement = $this->connection->prepare(
            'SELECT data FROM app_sessions WHERE id = ? AND last_activity >= ?'
        );
        $expiresAfter = time() - (int) ini_get('session.gc_maxlifetime');
        $statement->bind_param('si', $id, $expiresAfter);
        $statement->execute();
        $result = $statement->get_result();
        $row = $result->fetch_assoc();
        $statement->close();

        return $row === null ? '' : (string) $row['data'];
    }

    public function write(string $id, string $data): bool
    {
        $statement = $this->connection->prepare(
            'INSERT INTO app_sessions (id, data, last_activity) VALUES (?, ?, ?) '
            . 'ON DUPLICATE KEY UPDATE data = VALUES(data), last_activity = VALUES(last_activity)'
        );
        $now = time();
        $statement->bind_param('ssi', $id, $data, $now);
        $success = $statement->execute();
        $statement->close();

        return $success;
    }

    public function destroy(string $id): bool
    {
        $statement = $this->connection->prepare('DELETE FROM app_sessions WHERE id = ?');
        $statement->bind_param('s', $id);
        $success = $statement->execute();
        $statement->close();

        return $success;
    }

    public function gc(int $max_lifetime): int|false
    {
        $expiresAfter = time() - $max_lifetime;
        $statement = $this->connection->prepare('DELETE FROM app_sessions WHERE last_activity < ?');
        $statement->bind_param('i', $expiresAfter);
        $statement->execute();
        $deletedRows = $statement->affected_rows;
        $statement->close();

        return $deletedRows;
    }
}

function app_start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    session_name((string) app_env('SESSION_COOKIE_NAME', 'puzzle_session'));
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => app_is_https(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_set_save_handler(new DatabaseSessionHandler(app_database()), true);
    session_start();
}

function app_mailer(): \PHPMailer\PHPMailer\PHPMailer
{
    $autoloadPath = APP_ROOT . '/vendor/autoload.php';
    if (!is_readable($autoloadPath)) {
        throw new RuntimeException('Composer dependencies are missing. Run composer install.');
    }

    require_once $autoloadPath;

    $mailer = new \PHPMailer\PHPMailer\PHPMailer(true);
    $mailer->isSMTP();
    $mailer->Host = app_required_env('SMTP_HOST');
    $mailer->Port = (int) app_env('SMTP_PORT', '587');
    $mailer->SMTPAuth = app_env_bool('SMTP_AUTH', true);
    $mailer->SMTPSecure = (string) app_env('SMTP_ENCRYPTION', 'tls');
    if ($mailer->SMTPAuth) {
        $mailer->Username = app_required_env('SMTP_USERNAME');
        $mailer->Password = app_required_env('SMTP_PASSWORD');
    }
    $mailer->setFrom(
        app_required_env('MAIL_FROM_ADDRESS'),
        (string) app_env('MAIL_FROM_NAME', '8-Puzzle Verification')
    );
    $mailer->isHTML(true);

    return $mailer;
}

function app_password_matches(string $plainPassword, string $storedHash): bool
{
    if (password_get_info($storedHash)['algo'] !== null) {
        return password_verify($plainPassword, $storedHash);
    }

    // Allow existing MD5 accounts to sign in once so they can be upgraded in place.
    return preg_match('/^[a-f0-9]{32}$/i', $storedHash) === 1
        && hash_equals(strtolower($storedHash), md5($plainPassword));
}

function app_password_needs_upgrade(string $storedHash): bool
{
    return password_get_info($storedHash)['algo'] === null
        || password_needs_rehash($storedHash, PASSWORD_DEFAULT);
}

set_exception_handler(static function (Throwable $exception): void {
    error_log((string) $exception);

    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: text/plain; charset=UTF-8');
    }

    if (app_env_bool('APP_DEBUG')) {
        echo 'Application error: ' . $exception->getMessage();
        return;
    }

    echo 'The application is temporarily unavailable. Check the server logs for details.';
});
