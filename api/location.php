<?php
/**
 * NIS Alumni — Location Endpoint (Mutual-Only Geolocation)
 * 
 * GET  /api/location.php  — locations of mutual subscribers only
 * POST /api/location.php  — upsert own location (auth required)
 *   Body: { latitude, longitude }
 */

require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');

$db = getDB();

// ── GET: Fetch locations (mutual subscribers only) ────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $currentUser = $_SESSION['user_id'] ?? 0;

    if (!$currentUser) {
        jsonResponse(['success' => true, 'locations' => []]);
    }

    // Only show locations of users who are MUTUAL subscribers
    // (I follow them AND they follow me)
    $stmt = $db->prepare('
        SELECT
            ul.user_id,
            ul.latitude,
            ul.longitude,
            ul.updated_at,
            u.full_name,
            u.nis_branch,
            u.graduation_year,
            u.avatar_url
        FROM user_locations ul
        JOIN users u ON u.id = ul.user_id
        WHERE ul.user_id = ?
           OR (
               EXISTS (SELECT 1 FROM subscriptions WHERE follower_id = ? AND following_id = ul.user_id)
               AND
               EXISTS (SELECT 1 FROM subscriptions WHERE follower_id = ul.user_id AND following_id = ?)
           )
        ORDER BY ul.updated_at DESC
    ');
    $stmt->execute([$currentUser, $currentUser, $currentUser]);

    jsonResponse(['success' => true, 'locations' => $stmt->fetchAll()]);
}

// ── POST: Upsert current user's location ──────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $userId = requireAuth();

    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

    $lat = filter_var($input['latitude']  ?? null, FILTER_VALIDATE_FLOAT);
    $lng = filter_var($input['longitude'] ?? null, FILTER_VALIDATE_FLOAT);

    if ($lat === false || $lng === false) {
        jsonResponse(['success' => false, 'message' => 'Valid latitude and longitude are required.'], 422);
    }

    $stmt = $db->prepare('
        INSERT INTO user_locations (user_id, latitude, longitude)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE latitude = VALUES(latitude), longitude = VALUES(longitude)
    ');
    $stmt->execute([$userId, $lat, $lng]);

    jsonResponse(['success' => true, 'message' => 'Location updated.']);
}

jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
