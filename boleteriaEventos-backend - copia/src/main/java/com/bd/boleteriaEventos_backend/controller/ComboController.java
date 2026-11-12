package com.bd.boleteriaEventos_backend.controller;

import com.bd.boleteriaEventos_backend.config.IdentidadSesion;
import com.bd.boleteriaEventos_backend.dto.ComboCreateDTO;
import com.bd.boleteriaEventos_backend.dto.ComboResponseDTO;
import com.bd.boleteriaEventos_backend.dto.ComboUpdateDTO;
import com.bd.boleteriaEventos_backend.exception.ResourceNotFoundException;
import com.bd.boleteriaEventos_backend.service.ComboService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/combos")
@RequiredArgsConstructor
public class ComboController {

    private final ComboService comboService;

    @PostMapping
    public ResponseEntity<ComboResponseDTO> crear(@Valid @RequestBody ComboCreateDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(comboService.crear(dto));
    }

    @GetMapping
    public ResponseEntity<List<ComboResponseDTO>> listarTodos() {
        var combos = comboService.listarTodos();
        return ResponseEntity.ok(IdentidadSesion.clienteActual() == null ? combos
                : combos.stream().filter(combo -> "ACTIVO".equals(combo.estado())).toList());
    }

    @PutMapping("/{id}")
    public ResponseEntity<ComboResponseDTO> actualizar(@PathVariable Long id,
            @Valid @RequestBody ComboUpdateDTO dto) {
        return ResponseEntity.ok(comboService.actualizar(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        comboService.eliminar(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}")
    public ResponseEntity<ComboResponseDTO> obtenerPorId(@PathVariable Long id) {
        var combo = comboService.obtenerPorId(id);
        if (IdentidadSesion.clienteActual() != null && !"ACTIVO".equals(combo.estado())) {
            throw new ResourceNotFoundException("Combo no disponible");
        }
        return ResponseEntity.ok(combo);
    }
}
