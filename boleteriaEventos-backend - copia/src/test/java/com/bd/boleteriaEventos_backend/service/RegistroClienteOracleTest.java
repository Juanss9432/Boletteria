package com.bd.boleteriaEventos_backend.service;

import com.bd.boleteriaEventos_backend.controller.RegistroClienteController;
import com.bd.boleteriaEventos_backend.controller.UsuarioSistemaController;
import com.bd.boleteriaEventos_backend.dto.PerfilClienteCreateDTO;
import com.bd.boleteriaEventos_backend.dto.UsuarioSistemaCreateDTO;
import com.bd.boleteriaEventos_backend.exception.GlobalExceptionHandler;
import com.bd.boleteriaEventos_backend.repository.PerfilClienteRepository;
import com.bd.boleteriaEventos_backend.repository.RolRepository;
import com.bd.boleteriaEventos_backend.repository.UsuarioSistemaRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doReturn;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "spring.jpa.hibernate.ddl-auto=none")
@EnabledIfEnvironmentVariable(named = "BOLETERIA_PRUEBA_ORACLE", matches = "true")
class RegistroClienteOracleTest {

    private static final String CLAVE = "Clave de prueba 2026";
    private static final String REGISTRO = "/usuarios-sistema/registro";
    private static final String LOGIN = "/usuarios-sistema/login";

    @Autowired private RegistroClienteController registroController;
    @Autowired private UsuarioSistemaController usuarioController;
    @Autowired private UsuarioSistemaService usuarioService;
    @Autowired private UsuarioSistemaRepository usuarios;
    @Autowired private PerfilClienteRepository perfiles;
    @Autowired private EntityManager entityManager;
    @MockitoSpyBean private PerfilClienteService perfilService;
    @MockitoSpyBean private RolRepository roles;

    private MockMvc api;
    private String documento;
    private String correo;

    @BeforeEach
    void preparar() {
        api = MockMvcBuilders.standaloneSetup(registroController, usuarioController)
                .setControllerAdvice(new GlobalExceptionHandler()).build();
        documento = UUID.randomUUID().toString().substring(0, 24);
        correo = documento + "@ejemplo.com";
    }

    @Test
    @Transactional
    void registraConBCryptYPermiteLoginDeClienteYAdministrador() throws Exception {
        Long idCliente = roles.findByNombreIgnoreCase("CLIENTE").orElseThrow().getIdRol();

        registrar(correo.toUpperCase(Locale.ROOT), documento, CLAVE, CLAVE)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.idUsuario").isNumber())
                .andExpect(jsonPath("$.idUsuario").value(not(-999)))
                .andExpect(jsonPath("$.correo").value(correo))
                .andExpect(jsonPath("$.estado").value("ACTIVO"))
                .andExpect(jsonPath("$.idRol").value(idCliente))
                .andExpect(jsonPath("$.nombreRol").value("CLIENTE"))
                .andExpect(jsonPath("$.clave").doesNotExist())
                .andExpect(jsonPath("$.claveHash").doesNotExist());

        entityManager.clear();
        var usuario = usuarios.findByCorreoIgnoreCase(correo).orElseThrow();
        var perfil = perfiles.findByDocumento(documento).orElseThrow();
        assertEquals(usuario.getIdUsuario(), perfil.getUsuario().getIdUsuario());
        assertEquals("Ana Pérez", perfil.getNombre());
        assertEquals("3001234567", perfil.getTelefono());
        assertTrue(new BCryptPasswordEncoder().matches(CLAVE, usuario.getClaveHash()));

        login(correo).andExpect(status().isOk())
                .andExpect(jsonPath("$.idUsuario").value(usuario.getIdUsuario()))
                .andExpect(jsonPath("$.nombreRol").value("CLIENTE"));

        var rolAdmin = roles.findByNombreIgnoreCase("ADMIN")
                .or(() -> roles.findByNombreIgnoreCase("ADMINISTRADOR"))
                .orElseThrow(() -> new AssertionError("Oracle no tiene un rol ADMIN o ADMINISTRADOR"));
        var admin = usuarioService.crear(new UsuarioSistemaCreateDTO("admin-" + correo, CLAVE,
                "ACTIVO", rolAdmin.getIdRol()));
        login(admin.correo()).andExpect(status().isOk())
                .andExpect(jsonPath("$.idUsuario").value(admin.idUsuario()))
                .andExpect(jsonPath("$.nombreRol").value(rolAdmin.getNombre()));

        registrar(correo.toUpperCase(Locale.ROOT), "otro-" + documento, CLAVE, CLAVE)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("El correo ya está registrado"));
        registrar("otro-" + correo, documento, CLAVE, CLAVE)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("El documento ya está registrado"));
        assertTrue(usuarios.findByCorreoIgnoreCase("otro-" + correo).isEmpty());
        assertTrue(perfiles.findByDocumento("otro-" + documento).isEmpty());
    }

    @Test
    void rechazaDatosInvalidosClavesDistintasYRolAusente() throws Exception {
        registrar("correo-invalido", documento, CLAVE, CLAVE).andExpect(status().isBadRequest());
        registrar(correo, documento, CLAVE, "otra clave")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Las contraseñas no coinciden"));

        doReturn(Optional.empty()).when(roles).findByNombreIgnoreCase("CLIENTE");
        registrar(correo, documento, CLAVE, CLAVE)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("El rol CLIENTE no existe en Oracle"));
        assertTrue(usuarios.findByCorreoIgnoreCase(correo).isEmpty());
        assertTrue(perfiles.findByDocumento(documento).isEmpty());
    }

    @Test
    void revierteLasDosInsercionesSiFallaElPerfil() throws Exception {
        doAnswer(invocacion -> {
            invocacion.callRealMethod();
            perfiles.flush();
            throw new DataIntegrityViolationException("Fallo simulado tras insertar el perfil");
        }).when(perfilService).crear(any(PerfilClienteCreateDTO.class));

        registrar(correo, documento, CLAVE, CLAVE).andExpect(status().isConflict());

        assertTrue(usuarios.findByCorreoIgnoreCase(correo).isEmpty());
        assertTrue(perfiles.findByDocumento(documento).isEmpty());
    }

    private ResultActions registrar(
            String correo, String documento, String clave, String confirmacion) throws Exception {
        return api.perform(post(REGISTRO).contentType(MediaType.APPLICATION_JSON).content("""
                {
                  "nombre": "Ana Pérez",
                  "documento": "%s",
                  "telefono": "3001234567",
                  "correo": "%s",
                  "clave": "%s",
                  "confirmacionClave": "%s",
                  "idUsuario": -999,
                  "idRol": 1,
                  "estado": "INACTIVO"
                }
                """.formatted(documento, correo, clave, confirmacion)));
    }

    private ResultActions login(String correo) throws Exception {
        return api.perform(post(LOGIN).contentType(MediaType.APPLICATION_JSON).content("""
                {"correo": "%s", "clave": "%s"}
                """.formatted(correo, CLAVE)));
    }
}
