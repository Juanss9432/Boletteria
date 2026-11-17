package com.bd.boleteriaEventos_backend.service;

import com.bd.boleteriaEventos_backend.dto.*;
import com.bd.boleteriaEventos_backend.entity.Rol;
import com.bd.boleteriaEventos_backend.entity.UsuarioSistema;
import com.bd.boleteriaEventos_backend.exception.ResourceNotFoundException;
import com.bd.boleteriaEventos_backend.repository.UsuarioSistemaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.net.CookieManager;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.jpa.hibernate.ddl-auto=none", "spring.jpa.properties.hibernate.boot.allow_jdbc_metadata_access=false"
})
class SeguridadSesionTest {

    private static final String ORIGEN = "http://localhost:3000";
    private static final String LOGIN = "/usuarios-sistema/login";
    private static final String CSRF = "/usuarios-sistema/csrf";
    private static final String ME = "/usuarios-sistema/me";
    private static final String LOGOUT = "/usuarios-sistema/logout";
    private static final String CLAVE = "Clave de prueba 2026";
    private static final String HASH = new BCryptPasswordEncoder().encode(CLAVE);

    @LocalServerPort private int puerto;
    @MockitoBean private UsuarioSistemaRepository usuarios;
    @MockitoBean private RegistroClienteService registro;
    @MockitoBean private PerfilClienteService perfiles;
    @MockitoBean private ReservaService reservas;
    @MockitoBean private BoletaService boletas;
    @MockitoBean private NotificacionService notificaciones;
    @MockitoBean private AtraccionService atracciones;
    @MockitoBean private FuncionService funciones;
    @MockitoBean private ZonaService zonas;
    @MockitoBean private ComboService combos;
    @MockitoBean private ReportePdfService reportes;

    private final JsonMapper json = JsonMapper.builder().build();
    private CookieManager cookies;
    private HttpClient cliente;

    @BeforeEach
    void prepararCliente() {
        cookies = new CookieManager();
        cliente = HttpClient.newBuilder().cookieHandler(cookies).build();
    }

    @Test
    void autenticaAmbosRolesAdministrativosConSesionYPermiteReportes() throws Exception {
        cuenta(1L, "ADMIN");
        cuenta(2L, "ADMINISTRADOR");
        when(reportes.generar(any(), nullable(Long.class))).thenReturn(new byte[] {1});

        var csrf = csrf();
        String sesionAnterior = idSesion();
        var login = enviar("POST", LOGIN, credenciales(1L, CLAVE), csrf);
        assertEquals(200, login.statusCode());
        assertTrue(login.headers().firstValue("Set-Cookie").orElseThrow().contains("HttpOnly"));
        assertNotEquals(sesionAnterior, idSesion());
        assertEquals("ADMIN", json.readTree(login.body()).get("nombreRol").asText());
        assertEquals(1L, json.readTree(get(ME).body()).get("idUsuario").asLong());
        assertEquals(200, get("/usuarios-sistema").statusCode());

        var pdf = get("/reportes/1/pdf");
        assertEquals(200, pdf.statusCode());
        assertTrue(pdf.headers().firstValue("Content-Type").orElseThrow().startsWith("application/pdf"));
        assertEquals("Content-Disposition", pdf.headers().firstValue("Access-Control-Expose-Headers").orElseThrow());

        assertEquals(403, enviar("POST", LOGOUT, null, csrf).statusCode());
        var logout = enviar("POST", LOGOUT, null, csrf());
        assertEquals(204, logout.statusCode());
        assertTrue(cookies.getCookieStore().getCookies().stream().noneMatch(cookie -> cookie.getName().equals("JSESSIONID")));
        assertEquals(401, get(ME).statusCode());

        var segundoLogin = iniciar(2L);
        assertEquals("ADMINISTRADOR", json.readTree(segundoLogin.body()).get("nombreRol").asText());
        assertEquals(200, get("/usuarios-sistema").statusCode());
    }

    @Test
    void clienteSoloVeFuncionesEnVentaYZonasYCombosDisponibles() throws Exception {
        cuenta(3L, "CLIENTE");
        var fecha = BoletaService.ahora().toLocalDate().plusDays(1);
        var abierta = new FuncionResponseDTO(1L, fecha, LocalTime.NOON, LocalTime.MAX, "PROGRAMADA", 1L, "Atracción");
        var cancelada = new FuncionResponseDTO(2L, fecha, LocalTime.NOON, LocalTime.MAX, "CANCELADA", 1L, "Atracción");
        when(funciones.listarTodos()).thenReturn(List.of(abierta, cancelada));
        when(funciones.obtenerPorId(1L)).thenReturn(abierta);
        when(funciones.obtenerPorId(2L)).thenReturn(cancelada);
        when(zonas.listarTodos()).thenReturn(List.of(
                new ZonaResponseDTO(1L, "General", 10, BigDecimal.TEN, 1L),
                new ZonaResponseDTO(2L, "General", 10, BigDecimal.ONE, 2L)));
        when(zonas.disponibilidadPorFuncion(1L)).thenReturn(new DisponibilidadFuncionDTO(1L, List.of()));
        var activo = new ComboResponseDTO(1L, "Activo", BigDecimal.TEN, 1, "ACTIVO", List.of(1L));
        var inactivo = new ComboResponseDTO(2L, "Inactivo", BigDecimal.TEN, 1, "INACTIVO", List.of(1L));
        when(combos.listarTodos()).thenReturn(List.of(activo, inactivo));
        when(combos.obtenerPorId(2L)).thenReturn(inactivo);

        iniciar(3L);
        assertEquals(1, json.readTree(get("/funciones").body()).size());
        assertEquals(404, get("/funciones/2").statusCode());
        var zonasDisponibles = json.readTree(get("/zonas").body());
        assertEquals(1, zonasDisponibles.size());
        assertEquals(BigDecimal.TEN, zonasDisponibles.get(0).get("precio").decimalValue());
        assertEquals(200, get("/zonas/funcion/1/disponibilidad").statusCode());
        assertEquals(404, get("/zonas/funcion/2/disponibilidad").statusCode());
        assertEquals(1, json.readTree(get("/combos").body()).size());
        assertEquals(404, get("/combos/2").statusCode());
    }

    @Test
    void exigeSesionYCredencialesValidasYRevocaUnaCuentaInactiva() throws Exception {
        var usuario = cuenta(3L, "CLIENTE");
        assertEquals(401, get(ME).statusCode());
        assertEquals(401, enviar("POST", "/reservas", "{\"idPerfil\":30}", null).statusCode());
        assertEquals(403, enviar("POST", LOGIN, credenciales(3L, CLAVE), null).statusCode());
        assertEquals(401, enviar("POST", LOGIN, credenciales(3L, "incorrecta"), csrf()).statusCode());
        assertEquals(401, get(ME).statusCode());
        iniciar(3L);
        assertEquals(200, get(ME).statusCode());

        usuario.setEstado("INACTIVO");
        assertEquals(401, get(ME).statusCode());
        assertEquals(401, get("/atracciones").statusCode());
    }

    @Test
    void clienteCompraYConsultaSoloSusDatos() throws Exception {
        cuenta(3L, "CLIENTE");
        var propio = new PerfilClienteResponseDTO(30L, "30", "Cliente", "123", 3L, "u3@ejemplo.com");
        var ajeno = new PerfilClienteResponseDTO(40L, "40", "Otra persona", "456", 4L, "u4@ejemplo.com");
        var reserva = new ReservaResponseDTO(50L, LocalDateTime.now(), "PENDIENTE", 30L, "Cliente", null, null);
        var reservaAjena = new ReservaResponseDTO(60L, LocalDateTime.now(), "PENDIENTE", 40L, "Otra persona", null, null);
        var boleta = new BoletaResponseDTO(70L, "CODIGO", "ACTIVA", null, 50L, 2L, "Zona", 3L, "General", null, null);
        var notificacion = new NotificacionResponseDTO(80L, "Asunto", "Mensaje", LocalDateTime.now(), false, 3L, 50L);

        when(perfiles.obtenerPorUsuario(3L)).thenReturn(propio);
        when(perfiles.obtenerPorId(30L)).thenReturn(propio);
        when(perfiles.obtenerPorId(40L)).thenReturn(ajeno);
        when(perfiles.actualizar(eq(30L), any())).thenReturn(propio);
        when(reservas.listarPorPerfil(30L)).thenReturn(List.of(reserva));
        when(reservas.obtenerPorId(50L)).thenReturn(reserva);
        when(reservas.obtenerPorId(60L)).thenReturn(reservaAjena);
        when(reservas.obtenerPorId(999L)).thenThrow(new ResourceNotFoundException("Reserva no encontrada"));
        when(reservas.crear(any())).thenReturn(reserva);
        when(reservas.confirmar(50L)).thenReturn(reserva);
        when(boletas.crear(any())).thenReturn(boleta);
        when(boletas.listarPorUsuario(3L)).thenReturn(List.of(boleta));
        when(notificaciones.listarPorUsuario(3L)).thenReturn(List.of(notificacion));

        iniciar(3L);
        String csrf = csrf();
        assertEquals(200, get("/atracciones").statusCode());
        assertEquals(403, get("/usuarios-sistema").statusCode());
        assertEquals(403, get("/reportes/1/pdf").statusCode());
        assertEquals(403, get("/reportes/10").statusCode());
        assertEquals(403, enviar("PATCH", "/funciones/1/cancelar", null, csrf).statusCode());
        assertEquals(201, enviar("POST", "/reservas", "{\"idPerfil\":30}", csrf).statusCode());
        assertEquals(403, enviar("POST", "/reservas", "{\"idPerfil\":40}", csrf).statusCode());
        assertEquals(50L, json.readTree(get("/reservas").body()).get(0).get("idReserva").asLong());
        assertEquals(403, get("/reservas/perfil/40").statusCode());
        assertEquals(403, get("/reservas/60").statusCode());
        assertEquals(404, get("/reservas/999").statusCode());
        assertEquals(200, enviar("PATCH", "/reservas/50/confirmar", null, csrf).statusCode());
        assertEquals(403, enviar("PATCH", "/reservas/60/confirmar", null, csrf).statusCode());
        assertEquals(201, enviar("POST", "/boletas", "{\"idReserva\":50,\"idZona\":2,\"idTipoEntrada\":3}", csrf).statusCode());
        assertEquals(403, enviar("POST", "/boletas", "{\"idReserva\":60,\"idZona\":2,\"idTipoEntrada\":3}", csrf).statusCode());
        assertEquals(70L, json.readTree(get("/boletas").body()).get(0).get("idBoleta").asLong());
        assertEquals(403, get("/boletas/reserva/60").statusCode());
        assertEquals(200, get("/perfiles-cliente/usuario/3").statusCode());
        assertEquals(403, get("/perfiles-cliente/usuario/4").statusCode());
        assertEquals(403, get("/perfiles-cliente/40").statusCode());
        String perfil = "{\"documento\":\"30\",\"nombre\":\"Cliente\",\"telefono\":\"123\"}";
        assertEquals(200, enviar("PUT", "/perfiles-cliente/30", perfil, csrf).statusCode());
        assertEquals(403, enviar("PUT", "/perfiles-cliente/40", perfil, csrf).statusCode());
        assertEquals(80L, json.readTree(get("/notificaciones").body()).get(0).get("idNotificacion").asLong());
        assertEquals(403, get("/notificaciones/usuario/4").statusCode());

        verify(reservas, never()).listarTodos();
        verify(reservas, never()).confirmar(60L);
        verify(boletas, never()).listarTodos();
        verify(notificaciones, never()).listarTodos();
        verifyNoInteractions(reportes);
    }

    @Test
    void registroPublicoExigeCsrfYCorsAdmiteSoloElOrigenConfigurado() throws Exception {
        String ruta = "/usuarios-sistema/registro";
        String alta = """
                {"nombre":"Cliente","documento":"30","telefono":"123","correo":"u3@ejemplo.com",
                 "clave":"clave123","confirmacionClave":"clave123"}
                """;
        when(registro.registrar(any())).thenReturn(new UsuarioSistemaResponseDTO(3L, "u3@ejemplo.com", "ACTIVO", 3L, "CLIENTE"));
        assertEquals(403, enviar("POST", ruta, alta, null).statusCode());
        assertEquals(201, enviar("POST", ruta, alta, csrf()).statusCode());
        assertEquals(401, get(ME).statusCode());

        var preflight = preflight(ORIGEN, ruta);
        assertEquals(200, preflight.statusCode());
        assertEquals(ORIGEN, preflight.headers().firstValue("Access-Control-Allow-Origin").orElseThrow());
        assertEquals("true", preflight.headers().firstValue("Access-Control-Allow-Credentials").orElseThrow());
        assertTrue(preflight.headers().firstValue("Access-Control-Allow-Headers").orElseThrow().contains("X-CSRF-TOKEN"));
        assertEquals(403, preflight("http://localhost:3001", ruta).statusCode());
    }

    private UsuarioSistema cuenta(Long id, String rol) {
        String correo = "u" + id + "@ejemplo.com";
        var usuario = UsuarioSistema.builder().idUsuario(id).correo(correo).estado("ACTIVO").claveHash(HASH)
                .rol(Rol.builder().idRol(id).nombre(rol).build()).build();
        when(usuarios.findByCorreoIgnoreCase(correo)).thenReturn(Optional.of(usuario));
        when(usuarios.findById(id)).thenReturn(Optional.of(usuario));
        return usuario;
    }

    private String credenciales(Long id, String clave) {
        return "{\"correo\":\"u" + id + "@ejemplo.com\",\"clave\":\"" + clave + "\"}";
    }

    private HttpResponse<String> iniciar(Long id) throws Exception {
        var respuesta = enviar("POST", LOGIN, credenciales(id, CLAVE), csrf());
        assertEquals(200, respuesta.statusCode(), respuesta.body());
        assertFalse(respuesta.body().contains("clave"));
        return respuesta;
    }

    private String csrf() throws Exception {
        var respuesta = get(CSRF);
        assertEquals(200, respuesta.statusCode(), respuesta.body());
        return json.readTree(respuesta.body()).get("token").asText();
    }

    private String idSesion() {
        return cookies.getCookieStore().getCookies().stream().filter(cookie -> cookie.getName().equals("JSESSIONID"))
                .findFirst().orElseThrow().getValue();
    }

    private HttpResponse<String> get(String ruta) throws Exception {
        return enviar("GET", ruta, null, null);
    }

    private HttpResponse<String> enviar(String metodo, String ruta, String cuerpo, String csrf) throws Exception {
        var solicitud = HttpRequest.newBuilder(uri(ruta)).header("Origin", ORIGEN)
                .method(metodo, cuerpo == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(cuerpo));
        if (cuerpo != null) solicitud.header("Content-Type", "application/json");
        if (csrf != null) solicitud.header("X-CSRF-TOKEN", csrf);
        return cliente.send(solicitud.build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> preflight(String origen, String ruta) throws Exception {
        var solicitud = HttpRequest.newBuilder(uri(ruta)).header("Origin", origen)
                .header("Access-Control-Request-Method", "POST").header("Access-Control-Request-Headers", "X-CSRF-TOKEN, Content-Type")
                .method("OPTIONS", HttpRequest.BodyPublishers.noBody()).build();
        return cliente.send(solicitud, HttpResponse.BodyHandlers.ofString());
    }

    private URI uri(String ruta) {
        return URI.create("http://localhost:" + puerto + "/api/v1" + ruta);
    }
}
