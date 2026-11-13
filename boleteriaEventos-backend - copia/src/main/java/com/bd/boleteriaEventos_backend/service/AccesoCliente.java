package com.bd.boleteriaEventos_backend.service;

import com.bd.boleteriaEventos_backend.config.IdentidadSesion;
import com.bd.boleteriaEventos_backend.dto.FuncionResponseDTO;
import com.bd.boleteriaEventos_backend.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class AccesoCliente {

    private final PerfilClienteService perfiles;
    private final ReservaService reservas;
    private final BoletaService boletas;
    private final NotificacionService notificaciones;

    public Long perfil(IdentidadSesion cliente) {
        return perfiles.obtenerPorUsuario(cliente.idUsuario()).idPerfil();
    }

    public boolean perfilPropio(IdentidadSesion cliente, Long idPerfil) {
        return cliente.idUsuario().equals(perfiles.obtenerPorId(idPerfil).idUsuario());
    }

    public boolean reservaPropia(IdentidadSesion cliente, Long idReserva) {
        return perfilPropio(cliente, reservas.obtenerPorId(idReserva).idPerfil());
    }

    public boolean boletaPropia(IdentidadSesion cliente, Long idBoleta) {
        return reservaPropia(cliente, boletas.obtenerPorId(idBoleta).idReserva());
    }

    public boolean notificacionPropia(IdentidadSesion cliente, Long idNotificacion) {
        return cliente.idUsuario().equals(notificaciones.obtenerPorId(idNotificacion).idUsuario());
    }

    public static boolean funcionDisponible(FuncionResponseDTO funcion) {
        return BoletaService.funcionEnVenta(funcion.estado(), funcion.fecha().atTime(funcion.horaCierre()),
                BoletaService.ahora());
    }

    public static void exigirFuncionDisponible(FuncionResponseDTO funcion) {
        if (!funcionDisponible(funcion)) {
            throw new ResourceNotFoundException("Función no disponible");
        }
    }
}
