package com.bd.boleteriaEventos_backend.dto;

import java.math.BigDecimal;

public record RankingAtraccionDTO(long posicion, String atraccion, String prestador,
                                 long boletasVendidas, BigDecimal ingresos) {}
