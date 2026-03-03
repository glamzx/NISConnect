<?php
/**
 * NIS Alumni — Users / Alumni Directory
 * 
 * GET /api/users.php?sort=name|branch|year&q=search&page=1
 * Returns paginated list of all users for the alumni directory.
 */

require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405);
}

$db = getDB();

$sort   = $_GET['sort'] ?? 'name';
$search = trim($_GET['q'] ?? '');
$page   = max(1, (int) ($_GET['page'] ?? 1));
$limit  = 20;
$offset = ($page - 1) * $limit;

// Build ORDER BY
$orderBy = match ($sort) {
    'branch' => 'u.nis_branch ASC, u.full_name ASC',
    'year'   => 'u.graduation_year DESC, u.full_name ASC',
    default  => 'u.full_name ASC',
};

// Build WHERE (search by name, branch, or university)
$where  = '';
$params = [];

if ($search !== '') {
    $where = 'WHERE (u.full_name LIKE ? OR u.nis_branch LIKE ? OR u.university LIKE ?)';
    $like  = "%{$search}%";
    $params = [$like, $like, $like];
}

// Count total
$countSql = "SELECT COUNT(*) FROM users u $where";
$stmt = $db->prepare($countSql);
$stmt->execute($params);
$total = (int) $stmt->fetchColumn();

// Fetch page
$currentUserId = $_SESSION['user_id'] ?? 0;

$sql = "
    SELECT 
        u.id, u.full_name, u.nis_branch, u.graduation_year,
        u.university, u.degree_major, u.avatar_url, u.bio,
        (SELECT COUNT(*) FROM subscriptions s WHERE s.follower_id = ? AND s.following_id = u.id) as is_following
    FROM users u
    $where
    ORDER BY $orderBy
    LIMIT $limit OFFSET $offset
";

$stmt = $db->prepare($sql);
$stmt->execute(array_merge([$currentUserId], $params));
$users = $stmt->fetchAll();

jsonResponse([
    'success' => true,
    'users'   => $users,
    'total'   => $total,
    'page'    => $page,
    'pages'   => (int) ceil($total / $limit),
]);
