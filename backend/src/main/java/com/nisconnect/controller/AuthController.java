package com.nisconnect.controller;

import com.nisconnect.model.UserEntity;
import com.nisconnect.service.ChatService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * REST endpoints for authentication (login, logout, session check).
 *
 * These mirror the existing PHP endpoints (login.php, session.php, logout.php)
 * but use Spring Security's session management with secure cookie flags.
 *
 * Cookie flags (configured in application.yml):
 *   HttpOnly    = true    → XSS cannot read the cookie
 *   Secure      = true    → only sent over HTTPS (false for dev)
 *   SameSite    = Strict  → blocks all cross-origin cookie sending
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final ChatService chatService;
    private final PasswordEncoder passwordEncoder;

    public AuthController(ChatService chatService,
                          PasswordEncoder passwordEncoder) {
        this.chatService = chatService;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * POST /api/auth/login
     * Body: { "email": "...", "password": "..." }
     *
     * Creates a session and sets the secure cookie.
     * Compatible with existing PHP password_hash(PASSWORD_BCRYPT) hashes.
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body,
                                   HttpServletRequest request) {
        String email = body.get("email");
        String password = body.get("password");

        if (email == null || email.isBlank() || password == null || password.isBlank()) {
            return ResponseEntity.status(422).body(Map.of(
                    "success", false,
                    "message", "Email and password are required."
            ));
        }

        UserEntity user = chatService.getUserByEmail(email.trim());

        if (user == null || !passwordEncoder.matches(password, user.getPasswordHash())) {
            return ResponseEntity.status(401).body(Map.of(
                    "success", false,
                    "message", "Invalid email or password."
            ));
        }

        // Create session — Spring will set the session cookie automatically
        // with the flags from application.yml (HttpOnly, Secure, SameSite)
        HttpSession session = request.getSession(true);
        session.setAttribute("userId", user.getId());
        session.setAttribute("userName", user.getFullName());

        return ResponseEntity.ok(Map.of(
                "success", true,
                "user_id", user.getId(),
                "full_name", user.getFullName(),
                "avatar_url", user.getAvatarUrl() != null ? user.getAvatarUrl() : "",
                "message", "Login successful."
        ));
    }

    /**
     * GET /api/auth/session
     * Returns the current user's session state.
     * Used by the frontend to check if the user is logged in.
     */
    @GetMapping("/session")
    public ResponseEntity<?> checkSession(HttpServletRequest request) {
        HttpSession session = request.getSession(false);

        if (session == null || session.getAttribute("userId") == null) {
            return ResponseEntity.ok(Map.of("logged_in", false));
        }

        Long userId = (Long) session.getAttribute("userId");
        UserEntity user = chatService.getUserById(userId);

        if (user == null) {
            session.invalidate();
            return ResponseEntity.ok(Map.of("logged_in", false));
        }

        return ResponseEntity.ok(Map.of(
                "logged_in", true,
                "user_id", user.getId(),
                "full_name", user.getFullName(),
                "avatar_url", user.getAvatarUrl() != null ? user.getAvatarUrl() : ""
        ));
    }

    /**
     * POST /api/auth/logout
     * Handled by Spring Security's logout configuration in SecurityConfig.
     * This method exists only for documentation — the actual logic is in SecurityConfig.
     */
}
