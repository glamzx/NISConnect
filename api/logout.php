<?php
/**
 * NIS Alumni — Logout Endpoint
 * 
 * GET /api/logout.php
 * Destroys the session and redirects to home.
 */

require_once __DIR__ . '/../config/database.php';

$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $p = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
}
session_destroy();

// If called via AJAX, return JSON; otherwise redirect.
if (!empty($_SERVER['HTTP_X_REQUESTED_WITH']) && 
    strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest') {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => true, 'message' => 'Logged out.']);
    exit;
}

header('Location: /index.html');
exit;
