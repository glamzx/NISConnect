<?php
/**
 * NIS Alumni — Session Check
 * 
 * GET /api/session.php
 * Returns current auth state for navbar avatar/dropdown.
 */

require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');

if (empty($_SESSION['user_id'])) {
    jsonResponse(['logged_in' => false]);
}

$db   = getDB();
$stmt = $db->prepare('SELECT id, full_name, avatar_url FROM users WHERE id = ?');
$stmt->execute([$_SESSION['user_id']]);
$user = $stmt->fetch();

if (!$user) {
    $_SESSION = [];
    session_destroy();
    jsonResponse(['logged_in' => false]);
}

jsonResponse([
    'logged_in'  => true,
    'user_id'    => (int) $user['id'],
    'full_name'  => $user['full_name'],
    'avatar_url' => $user['avatar_url'],
]);
