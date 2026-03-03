<?php
/**
 * NIS Alumni — Login Endpoint
 * 
 * POST /api/login.php
 * Body: { email, password }
 */

require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
}

$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

$email    = trim($input['email'] ?? '');
$password = $input['password'] ?? '';

if (empty($email) || empty($password)) {
    jsonResponse(['success' => false, 'message' => 'Email and password are required.'], 422);
}

// ── Look up user ──────────────────────────────────────────
$db   = getDB();
$stmt = $db->prepare('SELECT id, password_hash, full_name FROM users WHERE email = ?');
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    jsonResponse(['success' => false, 'message' => 'Invalid email or password.'], 401);
}

// ── Set session ───────────────────────────────────────────
$_SESSION['user_id']   = (int) $user['id'];
$_SESSION['user_name'] = $user['full_name'];

jsonResponse([
    'success'   => true,
    'user_id'   => (int) $user['id'],
    'full_name' => $user['full_name'],
    'message'   => 'Login successful.',
]);
