package com.bd.boleteriaEventos_backend.controller;

import com.bd.boleteriaEventos_backend.config.IdentidadSesion;
import com.bd.boleteriaEventos_backend.dto.ReservaCreateDTO;
import com.bd.boleteriaEventos_backend.dto.ReservaResponseDTO;
import com.bd.boleteriaEventos_backend.dto.ReservaUpdateDTO;
import com.bd.boleteriaEventos_backend.service.ReservaService;
import com.bd.boleteriaEventos_backend.service.AccesoCliente;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/reservas")
@RequiredArgsConstructor
public class ReservaController {

    private final ReservaService reservaService;
    private final AccesoCliente accesoCliente;

    @PreAuthorize("hasRole('ADMIN') or (hasRole('CLIENTE') and @accesoCliente.perfilPropio(principal, #p0.idPerfil()))")
    @PostMapping
    public ResponseEntity<ReservaResponseDTO> crear(@Valid @RequestBody ReservaCreateDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(reservaService.crear(dto));
    }

    @GetMapping
    public ResponseEntity<List<ReservaResponseDTO>> listarTodos() {
        var cliente = IdentidadSesion.clienteActual();
        return ResponseEntity.ok(cliente == null ? reservaService.listarTodos()
                : reservaService.listarPorPerfil(accesoCliente.perfil(cliente)));
    }

    @PreAuthorize("hasRole('ADMIN') or (hasRole('CLIENTE') and @accesoCliente.reservaPropia(principal, #p0))")
    @PatchMapping("/{id}/confirmar")
    public ResponseEntity<ReservaResponseDTO> confirmar(@PathVariable Long id) {
        return ResponseEntity.ok(reservaService.confirmar(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ReservaResponseDTO> actualizar(@PathVariable Long id, @Valid @RequestBody ReservaUpdateDTO dto) {
        return ResponseEntity.ok(reservaService.actualizar(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        reservaService.eliminar(id);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasRole('ADMIN') or (hasRole('CLIENTE') and @accesoCliente.reservaPropia(principal, #p0))")
    @GetMapping("/{id}")
    public ResponseEntity<ReservaResponseDTO> obtenerPorId(@PathVariable Long id) {
        return ResponseEntity.ok(reservaService.obtenerPorId(id));
    }

    @PreAuthorize("hasRole('ADMIN') or (hasRole('CLIENTE') and @accesoCliente.perfilPropio(principal, #p0))")
    @GetMapping("/perfil/{idPerfil}")
    public ResponseEntity<List<ReservaResponseDTO>> listarPorPerfil(@PathVariable Long idPerfil) {
        return ResponseEntity.ok(reservaService.listarPorPerfil(idPerfil));
    }
}
