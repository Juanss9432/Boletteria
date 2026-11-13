package com.bd.boleteriaEventos_backend.dto;

import com.bd.boleteriaEventos_backend.exception.ResourceNotFoundException;

import java.util.List;

public enum ReportePdf {
    FUNCIONES(1, "Próximos eventos y funciones", "proximas-funciones",
            "ID función", "Evento", "Organizador", "Municipio", "Fecha", "Apertura", "Cierre", "Estado"),
    RESERVAS_CLIENTE(2, "Reservas por cliente", "reservas-por-cliente",
            "ID perfil", "Documento", "Cliente", "ID reserva", "Fecha y hora", "Estado", "Plan / Paquete"),
    COMPROBANTE(3, "Comprobante de reserva", "comprobante-reserva",
            "Código de boleta", "Evento", "Fecha de función", "Zona / Localidad", "Tipo de entrada", "Combo", "Precio pagado"),
    OCUPACION(4, "Ocupación por zona y localidad", "ocupacion-por-zona",
            "Evento", "ID función", "Fecha", "ID zona", "Zona", "Aforo", "Cupos ocupados",
            "Cupos disponibles", "Ocupación"),
    INGRESOS_ATRACCION(5, "Ingresos por evento y tipo de entrada", "ingresos-por-evento-y-tipo",
            "Evento", "Tipo de entrada", "Boletas vendidas", "Total ingresos", "Precio promedio"),
    RESERVAS_MES(6, "Reservas por mes y estado", "reservas-por-mes-y-estado",
            "Mes", "Estado", "Total reservas"),
    INGRESOS_MUNICIPIO(7, "Ingresos por municipio y tipo de organizador", "ingresos-por-municipio-y-tipo",
            "Municipio", "Tipo de organizador", "Boletas vendidas", "Total ingresos"),
    COMBOS(8, "Combos más vendidos", "combos-mas-vendidos",
            "ID combo", "Combo", "Precio actual", "Estado", "Reservas con combo", "Boletas de combo", "Total ingresos"),
    RECURRENTES(9, "Clientes recurrentes", "clientes-recurrentes",
            "ID perfil", "Documento", "Cliente", "Correo", "Reservas confirmadas", "Primera reserva", "Última reserva"),
    RANKING_ATRACCIONES(10, "Ranking de eventos más vendidos", "reporte_10_ranking_eventos",
            "Posición", "Evento", "Organizador", "Boletas vendidas", "Ingresos generados");

    private final int numero;
    private final String titulo;
    private final String nombreArchivo;
    private final List<String> encabezados;

    ReportePdf(int numero, String titulo, String nombreArchivo, String... encabezados) {
        this.numero = numero;
        this.titulo = titulo;
        this.nombreArchivo = nombreArchivo;
        this.encabezados = List.of(encabezados);
    }

    public static ReportePdf buscar(int numero) {
        for (ReportePdf reporte : values()) {
            if (reporte.numero == numero) {
                return reporte;
            }
        }
        throw new ResourceNotFoundException("Reporte no encontrado con número: " + numero);
    }

    public int numero() { return numero; }
    public String titulo() { return titulo; }
    public String nombreArchivo() { return nombreArchivo; }
    public List<String> encabezados() { return encabezados; }
}
