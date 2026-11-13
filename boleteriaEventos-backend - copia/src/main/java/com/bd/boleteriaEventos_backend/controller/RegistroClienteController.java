package com.bd.boleteriaEventos_backend.controller;

import com.bd.boleteriaEventos_backend.dto.RegistroClienteRequestDTO;
import com.bd.boleteriaEventos_backend.dto.UsuarioSistemaResponseDTO;
import com.bd.boleteriaEventos_backend.service.RegistroClienteService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class RegistroClienteController {

    private final RegistroClienteService registroClienteService;

    @PostMapping("/usuarios-sistema/registro")
    @ResponseStatus(HttpStatus.CREATED)
    public UsuarioSistemaResponseDTO registrar(@Valid @RequestBody RegistroClienteRequestDTO dto) {
        return registroClienteService.registrar(dto);
    }
}
