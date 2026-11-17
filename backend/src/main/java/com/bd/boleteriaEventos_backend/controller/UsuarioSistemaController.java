package com.bd.boleteriaEventos_backend.controller;

import com.bd.boleteriaEventos_backend.config.IdentidadSesion;
import com.bd.boleteriaEventos_backend.dto.LoginRequestDTO;
import com.bd.boleteriaEventos_backend.dto.UsuarioSistemaCreateDTO;
import com.bd.boleteriaEventos_backend.dto.UsuarioSistemaResponseDTO;
import com.bd.boleteriaEventos_backend.dto.UsuarioSistemaUpdateDTO;
import com.bd.boleteriaEventos_backend.service.UsuarioSistemaService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.CookieClearingLogoutHandler;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/usuarios-sistema")
@RequiredArgsConstructor
public class UsuarioSistemaController {

    private final UsuarioSistemaService usuarioSistemaService;

    @PostMapping
    public ResponseEntity<UsuarioSistemaResponseDTO> crear(@Valid @RequestBody UsuarioSistemaCreateDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(usuarioSistemaService.crear(dto));
    }

    @PostMapping("/login")
    public ResponseEntity<UsuarioSistemaResponseDTO> login(@Valid @RequestBody LoginRequestDTO dto,
            HttpServletRequest request, HttpServletResponse response) {
        var usuario = usuarioSistemaService.autenticar(dto);
        if (usuario.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        if (request.getSession(false) != null) {
            request.changeSessionId();
        }
        new HttpSessionCsrfTokenRepository().saveToken(null, request, response);
        var identidad = IdentidadSesion.desde(usuario.get());
        var autenticacion = UsernamePasswordAuthenticationToken.authenticated(identidad, null, identidad.autoridades());
        var contexto = SecurityContextHolder.createEmptyContext();
        contexto.setAuthentication(autenticacion);
        new HttpSessionSecurityContextRepository().saveContext(contexto, request, response);
        return ResponseEntity.ok(usuario.get());
    }

    @GetMapping("/csrf")
    public CsrfToken csrf(CsrfToken token) {
        return token;
    }

    @GetMapping("/me")
    public UsuarioSistemaResponseDTO sesion(@AuthenticationPrincipal IdentidadSesion identidad) {
        return usuarioSistemaService.obtenerPorId(identidad.idUsuario());
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(HttpServletRequest request, HttpServletResponse response) {
        var autenticacion = SecurityContextHolder.getContext().getAuthentication();
        new SecurityContextLogoutHandler().logout(request, response, autenticacion);
        new CookieClearingLogoutHandler("JSESSIONID").logout(request, response, autenticacion);
    }

    @GetMapping
    public ResponseEntity<List<UsuarioSistemaResponseDTO>> listarTodos() {
        return ResponseEntity.ok(usuarioSistemaService.listarTodos());
    }

    @PutMapping("/{id}")
    public ResponseEntity<UsuarioSistemaResponseDTO> actualizar(@PathVariable Long id, @Valid @RequestBody UsuarioSistemaUpdateDTO dto) {
        return ResponseEntity.ok(usuarioSistemaService.actualizar(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        usuarioSistemaService.eliminar(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}")
    public ResponseEntity<UsuarioSistemaResponseDTO> obtenerPorId(@PathVariable Long id) {
        return ResponseEntity.ok(usuarioSistemaService.obtenerPorId(id));
    }
}
