<?php
/**
 * NIS Alumni — Database Connection
 * 
 * PDO connection configured for MAMP defaults.
 * Sessions are started here so every API endpoint can use them.
 */

// Start session (used for authentication)
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// ── MAMP MySQL defaults ──────────────────────────────────
define('DB_HOST', '127.0.0.1');
define('DB_PORT', '8889');
define('DB_NAME', 'nis_alumni');
define('DB_USER', 'root');
define('DB_PASS', 'root');

/**
 * Returns a PDO instance connected to the nis_alumni database.
 * Uses a static variable so the connection is reused within a request.
 */
function getDB(): PDO
{
    static $pdo = null;

    if ($pdo === null) {
        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
            DB_HOST, DB_PORT, DB_NAME
        );

        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Database connection failed.']);
            exit;
        }
    }

    return $pdo;
}

/**
 * Helper: send a JSON response and terminate.
 */
function jsonResponse(array $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data);
    exit;
}

/**
 * Helper: require the user to be logged in.
 * Returns the authenticated user's ID or sends 401.
 */
function requireAuth(): int
{
    if (empty($_SESSION['user_id'])) {
        jsonResponse(['success' => false, 'message' => 'Not authenticated.'], 401);
    }
    return (int) $_SESSION['user_id'];
}
