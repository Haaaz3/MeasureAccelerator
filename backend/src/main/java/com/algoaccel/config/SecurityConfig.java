package com.algoaccel.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

/**
 * Spring Security configuration.
 * Supports a 'dev' profile with security disabled.
 * CORS origins are configurable via cors.allowed-origins property.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Value("${security.auth.enabled:true}")
    private boolean authEnabled;

    @Value("${cors.allowed-origins:http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000}")
    private String allowedOriginsConfig;

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();

        // Parse comma-separated origins from config (supports environment variable override)
        List<String> origins = Arrays.stream(allowedOriginsConfig.split(","))
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .toList();
        configuration.setAllowedOrigins(origins);

        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", configuration);
        return source;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        // Enable CORS
        http.cors(cors -> cors.configurationSource(corsConfigurationSource()));

        if (!authEnabled) {
            // Dev profile: disable all security
            http
                .csrf(csrf -> csrf.disable())
                .authorizeHttpRequests(auth -> auth
                    .anyRequest().permitAll()
                );
        } else {
            // Production: basic auth (placeholder for future OAuth2/JWT)
            // API endpoints are permitted for frontend access
            http
                .csrf(csrf -> csrf.disable())
                .authorizeHttpRequests(auth -> auth
                    .requestMatchers("/h2-console/**").permitAll()
                    .requestMatchers("/actuator/**").permitAll()
                    .requestMatchers("/api/**").permitAll()
                    .anyRequest().authenticated()
                )
                .httpBasic(Customizer.withDefaults());
        }

        // Allow H2 console frames
        http.headers(headers -> headers.frameOptions(frame -> frame.disable()));

        return http.build();
    }
}
