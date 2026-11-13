package com.bd.boleteriaEventos_backend.config;

import com.bd.boleteriaEventos_backend.dto.UsuarioSistemaResponseDTO;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.io.Serializable;
import java.util.List;
import java.util.Locale;

public record IdentidadSesion(Long idUsuario, String rol) implements Serializable {

    public static IdentidadSesion desde(UsuarioSistemaResponseDTO usuario) {
        String rol = usuario.nombreRol() == null ? "" : usuario.nombreRol().trim().toUpperCase(Locale.ROOT);
        return new IdentidadSesion(usuario.idUsuario(), "ADMINISTRADOR".equals(rol) ? "ADMIN" : rol);
    }

    public List<SimpleGrantedAuthority> autoridades() {
        return switch (rol) {
            case "ADMIN", "CLIENTE" -> List.of(new SimpleGrantedAuthority("ROLE_" + rol));
            default -> List.of();
        };
    }

    public static IdentidadSesion clienteActual() {
        var autenticacion = SecurityContextHolder.getContext().getAuthentication();
        if (autenticacion != null && autenticacion.getPrincipal() instanceof IdentidadSesion identidad
                && "CLIENTE".equals(identidad.rol())) {
            return identidad;
        }
        return null;
    }
}
