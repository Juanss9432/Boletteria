package com.bd.boleteriaEventos_backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegistroClienteRequestDTO(
        @NotBlank(message = "El nombre es obligatorio")
        @Size(max = 150, message = "El nombre no puede exceder 150 caracteres")
        String nombre,

        @NotBlank(message = "El documento es obligatorio")
        @Size(max = 30, message = "El documento no puede exceder 30 caracteres")
        String documento,

        @NotBlank(message = "El teléfono es obligatorio")
        @Size(max = 30, message = "El teléfono no puede exceder 30 caracteres")
        String telefono,

        @NotBlank(message = "El correo es obligatorio")
        @Email(message = "El formato de correo no es válido")
        @Size(max = 150, message = "El correo no puede exceder 150 caracteres")
        String correo,

        @NotBlank(message = "La clave es obligatoria")
        @Size(min = 6, max = 100, message = "La clave debe tener entre 6 y 100 caracteres")
        String clave,

        @NotBlank(message = "La confirmación de clave es obligatoria")
        @Size(max = 100, message = "La confirmación de clave no puede exceder 100 caracteres")
        String confirmacionClave
) {}
