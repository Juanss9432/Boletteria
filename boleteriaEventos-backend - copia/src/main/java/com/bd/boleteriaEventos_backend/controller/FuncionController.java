package com.bd.boleteriaEventos_backend.controller;

import com.bd.boleteriaEventos_backend.config.IdentidadSesion;
import com.bd.boleteriaEventos_backend.dto.FuncionCreateDTO;
import com.bd.boleteriaEventos_backend.dto.FuncionResponseDTO;
import com.bd.boleteriaEventos_backend.dto.FuncionUpdateDTO;
import com.bd.boleteriaEventos_backend.service.AccesoCliente;
import com.bd.boleteriaEventos_backend.service.FuncionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/funciones")
@RequiredArgsConstructor
public class FuncionController {

    private final FuncionService funcionService;

    @PostMapping
    public ResponseEntity<FuncionResponseDTO> crear(@Valid @RequestBody FuncionCreateDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(funcionService.crear(dto));
    }

    @GetMapping
    public ResponseEntity<List<FuncionResponseDTO>> listarTodos() {
        return ResponseEntity.ok(filtrarParaCliente(funcionService.listarTodos()));
    }

    @PatchMapping("/{id}/cancelar")
    public ResponseEntity<FuncionResponseDTO> cancelar(@PathVariable Long id) {
        return ResponseEntity.ok(funcionService.cancelar(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<FuncionResponseDTO> actualizar(@PathVariable Long id, @Valid @RequestBody FuncionUpdateDTO dto) {
        return ResponseEntity.ok(funcionService.actualizar(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        funcionService.eliminar(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}")
    public ResponseEntity<FuncionResponseDTO> obtenerPorId(@PathVariable Long id) {
        var funcion = funcionService.obtenerPorId(id);
        if (IdentidadSesion.clienteActual() != null) {
            AccesoCliente.exigirFuncionDisponible(funcion);
        }
        return ResponseEntity.ok(funcion);
    }

    @GetMapping("/atraccion/{idAtraccion}")
    public ResponseEntity<List<FuncionResponseDTO>> listarPorAtraccion(@PathVariable Long idAtraccion) {
        return ResponseEntity.ok(filtrarParaCliente(funcionService.listarPorAtraccion(idAtraccion)));
    }

    private List<FuncionResponseDTO> filtrarParaCliente(List<FuncionResponseDTO> funciones) {
        return IdentidadSesion.clienteActual() == null ? funciones
                : funciones.stream().filter(AccesoCliente::funcionDisponible).toList();
    }
}
