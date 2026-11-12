package com.bd.boleteriaEventos_backend.controller;

import com.bd.boleteriaEventos_backend.config.IdentidadSesion;
import com.bd.boleteriaEventos_backend.dto.DisponibilidadFuncionDTO;
import com.bd.boleteriaEventos_backend.dto.ZonaCreateDTO;
import com.bd.boleteriaEventos_backend.dto.ZonaResponseDTO;
import com.bd.boleteriaEventos_backend.dto.FuncionResponseDTO;
import com.bd.boleteriaEventos_backend.service.AccesoCliente;
import com.bd.boleteriaEventos_backend.service.FuncionService;
import com.bd.boleteriaEventos_backend.service.ZonaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/zonas")
@RequiredArgsConstructor
public class ZonaController {

    private final ZonaService zonaService;
    private final FuncionService funcionService;

    @PostMapping
    public ResponseEntity<ZonaResponseDTO> crear(@Valid @RequestBody ZonaCreateDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(zonaService.crear(dto));
    }

    @GetMapping
    public ResponseEntity<List<ZonaResponseDTO>> listarTodos() {
        var zonas = zonaService.listarTodos();
        if (IdentidadSesion.clienteActual() != null) {
            var disponibles = funcionService.listarTodos().stream().filter(AccesoCliente::funcionDisponible)
                    .map(FuncionResponseDTO::idFuncion).collect(Collectors.toSet());
            zonas = zonas.stream().filter(zona -> disponibles.contains(zona.idFuncion())).toList();
        }
        return ResponseEntity.ok(zonas);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ZonaResponseDTO> actualizar(@PathVariable Long id, @Valid @RequestBody ZonaCreateDTO dto) {
        return ResponseEntity.ok(zonaService.actualizar(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        zonaService.eliminar(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}")
    public ResponseEntity<ZonaResponseDTO> obtenerPorId(@PathVariable Long id) {
        var zona = zonaService.obtenerPorId(id);
        verificarFuncionParaCliente(zona.idFuncion());
        return ResponseEntity.ok(zona);
    }

    @GetMapping("/funcion/{idFuncion}/disponibilidad")
    public ResponseEntity<DisponibilidadFuncionDTO> disponibilidad(@PathVariable Long idFuncion) {
        verificarFuncionParaCliente(idFuncion);
        return ResponseEntity.ok(zonaService.disponibilidadPorFuncion(idFuncion));
    }

    @GetMapping("/funcion/{idFuncion}")
    public ResponseEntity<List<ZonaResponseDTO>> listarPorFuncion(@PathVariable Long idFuncion) {
        verificarFuncionParaCliente(idFuncion);
        return ResponseEntity.ok(zonaService.listarPorFuncion(idFuncion));
    }

    private void verificarFuncionParaCliente(Long idFuncion) {
        if (IdentidadSesion.clienteActual() != null) {
            AccesoCliente.exigirFuncionDisponible(funcionService.obtenerPorId(idFuncion));
        }
    }
}
