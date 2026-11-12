package com.bd.boleteriaEventos_backend.controller;

import com.bd.boleteriaEventos_backend.config.IdentidadSesion;
import com.bd.boleteriaEventos_backend.dto.NotificacionCreateDTO;
import com.bd.boleteriaEventos_backend.dto.NotificacionResponseDTO;
import com.bd.boleteriaEventos_backend.dto.NotificacionUpdateDTO;
import com.bd.boleteriaEventos_backend.service.NotificacionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/notificaciones")
@RequiredArgsConstructor
public class NotificacionController {

    private final NotificacionService notificacionService;

    @PostMapping
    public ResponseEntity<NotificacionResponseDTO> crear(@Valid @RequestBody NotificacionCreateDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(notificacionService.crear(dto));
    }

    @GetMapping
    public ResponseEntity<List<NotificacionResponseDTO>> listarTodos() {
        var cliente = IdentidadSesion.clienteActual();
        return ResponseEntity.ok(cliente == null ? notificacionService.listarTodos()
                : notificacionService.listarPorUsuario(cliente.idUsuario()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<NotificacionResponseDTO> actualizar(@PathVariable Long id, @Valid @RequestBody NotificacionUpdateDTO dto) {
        return ResponseEntity.ok(notificacionService.actualizar(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        notificacionService.eliminar(id);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasRole('ADMIN') or (hasRole('CLIENTE') and @accesoCliente.notificacionPropia(principal, #p0))")
    @GetMapping("/{id}")
    public ResponseEntity<NotificacionResponseDTO> obtenerPorId(@PathVariable Long id) {
        return ResponseEntity.ok(notificacionService.obtenerPorId(id));
    }

    @PreAuthorize("hasRole('ADMIN') or (hasRole('CLIENTE') and #p0.equals(principal.idUsuario()))")
    @GetMapping("/usuario/{idUsuario}")
    public ResponseEntity<List<NotificacionResponseDTO>> listarPorUsuario(@PathVariable Long idUsuario) {
        return ResponseEntity.ok(notificacionService.listarPorUsuario(idUsuario));
    }

    @PatchMapping("/{id}/leer")
    public ResponseEntity<NotificacionResponseDTO> marcarComoLeida(@PathVariable Long id) {
        return ResponseEntity.ok(notificacionService.marcarComoLeida(id));
    }
}
