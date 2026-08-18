<?php
require_once dirname(__DIR__) . '/config/bootstrap.php';

header('Content-Type: application/json; charset=UTF-8');

$user = app_auth_user();
if ($user === null) {
    http_response_code(401);
    echo json_encode(['error' => 'Authentication required.']);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    echo json_encode(['error' => 'Method not allowed.']);
    exit();
}

$elapsedTime = trim((string) ($_POST['elapsedTime'] ?? ''));
$username = $user['username'];

if ($username === '' || preg_match('/^\d{2}:[0-5]\d$/', $elapsedTime) !== 1) {
    http_response_code(422);
    echo json_encode(['error' => 'Invalid score data.']);
    exit();
}

$conn = app_database();
$statement = $conn->prepare('INSERT INTO timescore (name, times) VALUES (?, ?)');
$statement->bind_param('ss', $username, $elapsedTime);
$statement->execute();
$statement->close();

echo json_encode(['saved' => true]);
