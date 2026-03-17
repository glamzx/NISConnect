package com.nisconnect.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * Security configuration — cookie-based sessions with hardened cookie flags.
 *
 * Cookie settings (set in application.yml):
 *   HttpOnly  : true   — prevents XSS from reading the cookie via document.cookie
 *   Secure    : true   — cookie only sent over HTTPS (false for local dev)
 *   SameSite  : Strict — blocks CSRF via cross-origin requests entirely
 *   MaxAge    : 86400  — 24-hour session lifetime
 *
 * Session policy: IF_REQUIRED
 *   Sessions are only created when the user explicitly logs in.
 *   Every subsequent request (including the WebSocket handshake) must carry
 *   the session cookie to be authenticated.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Value("${app.cors.allowed-origins:http://localhost:3000}")
    private List<String> allowedOrigins;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // ── CORS ─────────────────────────────────────────────
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))

            // ── CSRF disabled ────────────────────────────────────
            // SameSite=Strict cookie + STOMP headers provide CSRF protection.
            // Traditional CSRF tokens don't play well with WebSocket upgrades.
            .csrf(csrf -> csrf.disable())

            // ── Session management ───────────────────────────────
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
                .maximumSessions(3)               // max 3 devices per user
            )

            // ── Authorization rules ──────────────────────────────
            .authorizeHttpRequests(auth -> auth
                // Public endpoints — no session required
                .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/auth/register").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/auth/session").permitAll()

                // WebSocket endpoint — handshake is further validated by
                // HttpHandshakeInterceptor, but let it through Security first
                .requestMatchers("/ws/**").permitAll()

                // Everything else requires authentication
                .anyRequest().authenticated()
            )

            // ── Logout ───────────────────────────────────────────
            .logout(logout -> logout
                .logoutUrl("/api/auth/logout")
                .invalidateHttpSession(true)
                .deleteCookies("NISCONNECT_SESSION")
                .logoutSuccessHandler((req, res, auth) -> {
                    res.setContentType("application/json");
                    res.getWriter().write("{\"success\":true,\"message\":\"Logged out.\"}");
                })
            );

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(allowedOrigins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);  // Required for cookies
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        // Compatible with PHP's password_hash(PASSWORD_BCRYPT)
        return new BCryptPasswordEncoder();
    }
}
