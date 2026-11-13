package com.bd.boleteriaEventos_backend.service;

import com.bd.boleteriaEventos_backend.dto.PerfilClienteCreateDTO;
import com.bd.boleteriaEventos_backend.dto.RegistroClienteRequestDTO;
import com.bd.boleteriaEventos_backend.dto.UsuarioSistemaCreateDTO;
import com.bd.boleteriaEventos_backend.dto.UsuarioSistemaResponseDTO;
import com.bd.boleteriaEventos_backend.exception.BusinessRuleException;
import com.bd.boleteriaEventos_backend.exception.ResourceNotFoundException;
import com.bd.boleteriaEventos_backend.repository.PerfilClienteRepository;
import com.bd.boleteriaEventos_backend.repository.RolRepository;
import com.bd.boleteriaEventos_backend.repository.UsuarioSistemaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

@Service
@RequiredArgsConstructor
public class RegistroClienteService {

    private final UsuarioSistemaRepository usuarios;
    private final PerfilClienteRepository perfiles;
    private final RolRepository roles;
    private final UsuarioSistemaService usuarioService;
    private final PerfilClienteService perfilService;

    @Transactional
    public UsuarioSistemaResponseDTO registrar(RegistroClienteRequestDTO dto) {
        String correo = dto.correo().trim().toLowerCase(Locale.ROOT);
        String documento = dto.documento().trim();
        if (usuarios.findByCorreoIgnoreCase(correo).isPresent()) {
            throw new BusinessRuleException("El correo ya está registrado");
        }
        if (perfiles.findByDocumento(documento).isPresent()) {
            throw new BusinessRuleException("El documento ya está registrado");
        }
        if (!dto.clave().equals(dto.confirmacionClave())) {
            throw new BusinessRuleException("Las contraseñas no coinciden");
        }

        var rol = roles.findByNombreIgnoreCase("CLIENTE")
                .orElseThrow(() -> new ResourceNotFoundException("El rol CLIENTE no existe en Oracle"));

        try {
            var usuario = usuarioService.crear(new UsuarioSistemaCreateDTO(correo, dto.clave(),
                    "ACTIVO", rol.getIdRol()));
            perfilService.crear(new PerfilClienteCreateDTO(documento, dto.nombre(), dto.telefono(),
                    usuario.idUsuario()));
            perfiles.flush();
            return usuario;
        } catch (DataIntegrityViolationException ex) {
            throw new BusinessRuleException("No se pudo completar el registro por un conflicto de integridad");
        }
    }
}
