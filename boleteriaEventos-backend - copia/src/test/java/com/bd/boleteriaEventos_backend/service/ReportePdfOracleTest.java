package com.bd.boleteriaEventos_backend.service;

import com.bd.boleteriaEventos_backend.controller.ReporteController;
import com.bd.boleteriaEventos_backend.dto.ReportePdf;
import com.bd.boleteriaEventos_backend.repository.ReportePdfRepository;
import com.lowagie.text.pdf.PdfReader;
import com.lowagie.text.pdf.parser.PdfTextExtractor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@EnabledIfEnvironmentVariable(named = "BOLETERIA_PRUEBA_ORACLE", matches = "true")
class ReportePdfOracleTest {

    @Autowired private ReporteController controlador;
    @Autowired private ReportePdfRepository repositorio;
    @Autowired private JdbcTemplate jdbc;

    @Test
    void losDiezEndpointsDescarganPdfLegiblesConLosResultadosDeOracle() throws Exception {
        var archivo = new ClassPathResource("reportes/05_reportes.sql").getContentAsString(StandardCharsets.UTF_8);
        var sqlOriginal = Arrays.stream(archivo.replaceAll("(?m)^\\h*--[^\\r\\n]*", "").split("(?m);\\h*$"))
                .map(String::strip).filter(sql -> !sql.isEmpty()).toList();
        assertEquals(10, sqlOriginal.size());
        var mvc = MockMvcBuilders.standaloneSetup(controlador).build();

        Long reserva = jdbc.queryForObject(
                "select min(ID_RESERVA) from (" + sqlOriginal.get(2) + ")", Long.class);

        for (ReportePdf reporte : ReportePdf.values()) {
            Long idReserva = null;
            String consulta = sqlOriginal.get(reporte.numero() - 1);
            var solicitud = get("/reportes/{numero}/pdf", reporte.numero());
            String archivoEsperado = reporte.nombreArchivo();
            Object[] parametros = {};
            if (reporte == ReportePdf.COMPROBANTE) {
                idReserva = reserva == null ? Long.MAX_VALUE : reserva;
                solicitud.param("idReserva", idReserva.toString());
                archivoEsperado += "-" + idReserva;
                consulta = "select * from (" + consulta + ") where ID_RESERVA = ?";
                parametros = new Object[]{idReserva};
            }
            var esperado = jdbc.queryForList(consulta, parametros);
            var obtenido = repositorio.consultar(reporte, idReserva);
            assertEquals(esperado.size(), obtenido.filas().size(), reporte.titulo());
            System.out.printf("Reporte %d: %d filas de Oracle%n", reporte.numero(), esperado.size());
            for (int fila = 0; fila < esperado.size(); fila++) {
                for (int columna = 0; columna < obtenido.columnas().size(); columna++) {
                    var original = esperado.get(fila).get(obtenido.columnas().get(columna));
                    var valor = obtenido.filas().get(fila).get(columna);
                    if (original == null || original instanceof Number || original instanceof String) {
                        assertEquals(original, valor, reporte.titulo() + " / " + obtenido.columnas().get(columna));
                    }
                }
            }

            byte[] pdf = mvc.perform(solicitud).andExpect(status().isOk())
                    .andExpect(content().contentType("application/pdf"))
                    .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION,
                            "attachment; filename=\"" + archivoEsperado + ".pdf\""))
                    .andReturn().getResponse().getContentAsByteArray();

            var lector = new PdfReader(pdf);
            try {
                var texto = new PdfTextExtractor(lector).getTextFromPage(1);
                assertTrue(texto.contains("Sistema de Boletería"), reporte.titulo());
                assertTrue(texto.contains("Generado el"), reporte.titulo());
                if (esperado.isEmpty()) {
                    String mensaje = reporte == ReportePdf.RANKING_ATRACCIONES
                            ? "No se encontraron ventas de atracciones para generar el ranking"
                            : "No se encontraron registros.";
                    assertTrue(texto.replaceAll("\\s+", " ").contains(mensaje), reporte.titulo());
                }
                if (reporte == ReportePdf.RANKING_ATRACCIONES) {
                    assertTrue(texto.contains(reporte.titulo()));
                    assertTrue(texto.replaceAll("\\s+", " ")
                            .contains("Posición Atracción Prestador Boletas vendidas Ingresos generados"));
                }
            } finally {
                lector.close();
            }

            if ("true".equals(System.getenv("BOLETERIA_GUARDAR_PDF_PRUEBA"))) {
                Path carpeta = Files.createDirectories(Path.of("build", "pdf-reportes-prueba"));
                Files.write(carpeta.resolve(reporte.numero() + "-" + archivoEsperado + ".pdf"), pdf);
            }
        }
    }

    @Test
    void elRankingCoincideConLasVentasIndividualesDeOracle() throws Exception {
        record Grupo(long atraccion, long prestador, String nombre, String proveedor) {}
        record Venta(Grupo grupo, BigDecimal precio) {}
        var ventas = jdbc.query("""
                SELECT A.ID_ATRACCION, P.ID_PRESTADOR, A.NOMBRE, P.NOMBRE, B.PRECIO_PAGADO
                FROM BOLETAS B
                JOIN RESERVAS R ON R.ID_RESERVA = B.ID_RESERVA
                JOIN ZONAS Z ON Z.ID_ZONA = B.ID_ZONA
                JOIN FUNCIONES F ON F.ID_FUNCION = Z.ID_FUNCION
                JOIN ATRACCIONES A ON A.ID_ATRACCION = F.ID_ATRACCION
                JOIN PRESTADORES P ON P.ID_PRESTADOR = A.ID_PRESTADOR
                WHERE R.ESTADO = 'CONFIRMADA' AND B.ESTADO IN ('ACTIVA', 'USADA')
                """, (rs, n) -> new Venta(new Grupo(rs.getLong(1), rs.getLong(2), rs.getString(3), rs.getString(4)),
                rs.getBigDecimal(5)));
        var grupos = ventas.stream().collect(java.util.stream.Collectors.groupingBy(Venta::grupo));
        record Fila(Grupo grupo, int cantidad, BigDecimal ingresos) {}
        var esperado = grupos.entrySet().stream().map(e -> new Fila(e.getKey(), e.getValue().size(),
                        e.getValue().stream().map(Venta::precio).reduce(BigDecimal.ZERO, BigDecimal::add)))
                .sorted(java.util.Comparator.comparingInt(Fila::cantidad).reversed()
                        .thenComparing(Fila::ingresos, java.util.Comparator.reverseOrder())
                        .thenComparingLong(f -> f.grupo().atraccion()).thenComparingLong(f -> f.grupo().prestador()))
                .toList();
        var ranking = repositorio.consultar(ReportePdf.RANKING_ATRACCIONES, null);
        assertEquals(List.of("POSICION", "ATRACCION", "PRESTADOR", "BOLETAS_VENDIDAS", "TOTAL_INGRESOS"), ranking.columnas());
        assertEquals(esperado.size(), ranking.filas().size());
        var respuesta = MockMvcBuilders.standaloneSetup(controlador).build().perform(get("/reportes/10"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(esperado.size()));
        for (int i = 0; i < esperado.size(); i++) {
            var fila = ranking.filas().get(i);
            var ventasAtraccion = esperado.get(i);
            assertEquals(i + 1, ((Number) fila.get(0)).intValue());
            assertEquals(ventasAtraccion.grupo().nombre(), fila.get(1));
            assertEquals(ventasAtraccion.grupo().proveedor(), fila.get(2));
            assertEquals(ventasAtraccion.cantidad(), ((Number) fila.get(3)).intValue());
            assertEquals(0, ventasAtraccion.ingresos().compareTo(new BigDecimal(fila.get(4).toString())));
            String ruta = "$[" + i + "].";
            respuesta.andExpect(jsonPath(ruta + "posicion").value(i + 1))
                    .andExpect(jsonPath(ruta + "atraccion").value(fila.get(1)))
                    .andExpect(jsonPath(ruta + "prestador").value(fila.get(2)))
                    .andExpect(jsonPath(ruta + "boletasVendidas").value(ventasAtraccion.cantidad()))
                    .andExpect(jsonPath(ruta + "ingresos").value(
                            org.hamcrest.Matchers.is(ventasAtraccion.ingresos().doubleValue()), Double.class));
            System.out.println("Ranking Oracle: " + fila);
        }
    }
}
