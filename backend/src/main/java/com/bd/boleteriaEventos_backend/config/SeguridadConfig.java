package com.bd.boleteriaEventos_backend.config;

import com.bd.boleteriaEventos_backend.exception.ResourceNotFoundException;
import com.bd.boleteriaEventos_backend.service.UsuarioSistemaService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Configuration
@EnableMethodSecurity
public class SeguridadConfig {

    @Bean
    SecurityFilterChain seguridad(HttpSecurity http, UsuarioSistemaService usuarios) throws Exception {
        return http
                .cors(Customizer.withDefaults())
                .requestCache(AbstractHttpConfigurer::disable)
                .addFilterBefore(new OncePerRequestFilter() {
                    @Override
                    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                                    FilterChain chain) throws ServletException, IOException {
                        var autenticacion = SecurityContextHolder.getContext().getAuthentication();
                        if (autenticacion != null && autenticacion.getPrincipal() instanceof IdentidadSesion identidad) {
                            try {
                                var usuario = usuarios.obtenerPorId(identidad.idUsuario());
                                if (!"ACTIVO".equals(usuario.estado())
                                        || !identidad.equals(IdentidadSesion.desde(usuario))) {
                                    invalidar(request);
                                }
                            } catch (ResourceNotFoundException ex) {
                                invalidar(request);
                            }
                        }
                        chain.doFilter(request, response);
                    }

                    private void invalidar(HttpServletRequest request) {
                        var sesion = request.getSession(false);
                        if (sesion != null) {
                            sesion.invalidate();
                        }
                        SecurityContextHolder.clearContext();
                    }
                }, CsrfFilter.class)
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, error) ->
                                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED))
                        .accessDeniedHandler((request, response, error) -> {
                            String ruta = request.getRequestURI().substring(request.getContextPath().length());
                            boolean publica = ruta.equals("/usuarios-sistema/login")
                                    || ruta.equals("/usuarios-sistema/registro");
                            var autenticacion = SecurityContextHolder.getContext().getAuthentication();
                            boolean autenticado = autenticacion != null && autenticacion.isAuthenticated()
                                    && !(autenticacion instanceof AnonymousAuthenticationToken);
                            response.setStatus(publica || autenticado ? HttpServletResponse.SC_FORBIDDEN
                                    : HttpServletResponse.SC_UNAUTHORIZED);
                        }))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.POST, "/usuarios-sistema/login", "/usuarios-sistema/registro").permitAll()
                        .requestMatchers(HttpMethod.GET, "/usuarios-sistema/csrf").permitAll()
                        .requestMatchers(HttpMethod.GET, "/usuarios-sistema/me").authenticated()
                        .requestMatchers(HttpMethod.POST, "/usuarios-sistema/logout").authenticated()
                        .requestMatchers(HttpMethod.GET,
                                "/atracciones", "/atracciones/{id}", "/atracciones/prestador/{id}",
                                "/funciones", "/funciones/{id}", "/funciones/atraccion/{id}",
                                "/zonas", "/zonas/{id}", "/zonas/funcion/{id}", "/zonas/funcion/{id}/disponibilidad",
                                "/combos", "/combos/{id}", "/tipos-entrada", "/tipos-entrada/{id}",
                                "/reservas", "/reservas/{id}", "/reservas/perfil/{id}",
                                "/boletas", "/boletas/{id}", "/boletas/reserva/{id}",
                                "/perfiles-cliente/{id}", "/perfiles-cliente/usuario/{id}",
                                "/notificaciones", "/notificaciones/{id}", "/notificaciones/usuario/{id}")
                            .hasAnyRole("ADMIN", "CLIENTE")
                        .requestMatchers(HttpMethod.POST, "/reservas", "/boletas").hasAnyRole("ADMIN", "CLIENTE")
                        .requestMatchers(HttpMethod.PATCH, "/reservas/{id}/confirmar").hasAnyRole("ADMIN", "CLIENTE")
                        .requestMatchers(HttpMethod.PUT, "/perfiles-cliente/{id}").hasAnyRole("ADMIN", "CLIENTE")
                        .anyRequest().hasRole("ADMIN"))
                .logout(AbstractHttpConfigurer::disable)
                .build();
    }
}
