<?php

declare(strict_types=1);

$path = parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
$path = is_string($path) ? rawurldecode($path) : '/';

// Let PHP's built-in development server serve existing static assets itself.
if (PHP_SAPI === 'cli-server' && $path !== '/') {
    $staticFile = dirname(__DIR__) . $path;
    if (is_file($staticFile)) {
        return false;
    }
}

$routes = [
    '/' => 'login/login/login.php',
    '/index.php' => 'login/login/login.php',
    '/login/login.php' => 'login/login/login.php',
    '/login/login/login.php' => 'login/login/login.php',
    '/login/register.php' => 'login/register.php',
    '/login/forgotPassword.php' => 'login/forgotPassword.php',
    '/login/forgotpassword.php' => 'login/forgotPassword.php',
    '/game/_8_Puzzle_game.php' => 'game/_8_Puzzle_game.php',
    '/game/_8_puzzle_game.php' => 'game/_8_Puzzle_game.php',
    '/game/savegame.php' => 'game/savegame.php',
    '/solver/_8_puzzle.php' => 'solver/_8_puzzle.php',
];

if (!isset($routes[$path])) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=UTF-8');
    echo 'Not found';
    exit;
}

require dirname(__DIR__) . '/' . $routes[$path];
