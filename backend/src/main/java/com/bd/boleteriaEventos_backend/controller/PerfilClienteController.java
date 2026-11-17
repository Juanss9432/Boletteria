package com.bd.boleteriaEventos_backend.controller;

import com.bd.boleteriaEventos_backend.dto.PerfilClienteCreateDTO;
import com.bd.boleteriaEventos_backend.dto.PerfilClienteResponseDTO;
import com.bd.boleteriaEventos_backend.dto.PerfilClienteUpdateDTO;
import com.bd.boleteriaEventos_backend.service.PerfilClienteService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/perfiles-cliente")
@RequiredArgsConstructor
public class PerfilClienteController {

    private final PerfilClienteService perfilClienteService;

    @PostMapping
    public ResponseEntity<PerfilClienteResponseDTO> crear(@Valid @RequestBody PerfilClienteCreateDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(perfilClienteService.crear(dto));
    }

    @GetMapping
    public ResponseEntity<List<PerfilClienteResponseDTO>> listarTodos() {
        return ResponseEntity.ok(perfilClienteService.listarTodos());
    }

    @PreAuthorize("hasRole('ADMIN') or (hasRole('CLIENTE') and @accesoCliente.perfilPropio(principal, #p0))")
    @PutMapping("/{id}")
    public ResponseEntity<PerfilClienteResponseDTO> actualizar(@PathVariable Long id,
            @Valid @RequestBody PerfilClienteUpdateDTO dto) {
        return ResponseEntity.ok(perfilClienteService.actualizar(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        perfilClienteService.eliminar(id);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasRole('ADMIN') or (hasRole('CLIENTE') and @accesoCliente.perfilPropio(principal, #p0))")
    @GetMapping("/{id}")
    public ResponseEntity<PerfilClienteResponseDTO> obtenerPorId(@PathVariable Long id) {
        return ResponseEntity.ok(perfilClienteService.obtenerPorId(id));
    }

    @PreAuthorize("hasRole('ADMIN') or (hasRole('CLIENTE') and #p0.equals(principal.idUsuario()))")
    @GetMapping("/usuario/{idUsuario}")
    public ResponseEntity<PerfilClienteResponseDTO> obtenerPorUsuario(@PathVariable Long idUsuario) {
        return ResponseEntity.ok(perfilClienteService.obtenerPorUsuario(idUsuario));
    }
}
