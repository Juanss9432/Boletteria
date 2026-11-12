# Informe de integración frontend + backend — Sistema de Boletería

## A. Resumen de integración

Se conectó el frontend Next.js con el backend Spring Boot usando `NEXT_PUBLIC_API_URL`, cuyo valor local esperado es `http://localhost:8080/api/v1`.

Cambios principales:

- Se eliminó `localStorage` como fuente de datos de negocio.
- Se implementó una capa HTTP reutilizable en `lib/boleteria-api.ts`.
- El login ahora consulta `POST /usuarios-sistema/login` y conserva únicamente la identidad de la sesión en `sessionStorage`.
- Se cargan desde Oracle, a través del backend, los catálogos y entidades que usa el panel.
- Los formularios existentes se conectaron con los DTO reales del backend.
- Las reservas se crean como `PENDIENTE` y se confirman con el endpoint real del backend.
- Las boletas se emiten a través del flujo de reserva del backend; usar/anular una boleta llama sus endpoints PATCH reales.
- La cancelación de funciones llama `PATCH /funciones/{id}/cancelar` y deja las reglas/cascadas al backend.
- Los diez botones de PDF descargan los documentos generados por Spring Boot; se retiró la generación local con jsPDF de los componentes.
- Se agregó CORS mínimo en Spring Boot para `http://localhost:3000`.

## B. Matriz de las 16 entidades

| Entidad | Pantalla / componente | Listado | Crear | Actualizar | Eliminar / acción restringida | Endpoint principal |
|---|---|---:|---:|---:|---:|---|
| Municipio | Catálogos > Municipios | Sí | Sí | Sí | Sí | `/municipios` |
| TipoPrestador | Catálogos > Tipos de prestador | Sí | Sí | Sí | Sí | `/tipos-prestador` |
| Prestador | Oferta > Prestadores | Sí | Sí | Sí | Sí, sujeto a dependencias | `/prestadores` |
| Plan | Oferta > Planes | Sí | Sí | Sí | Sí, sujeto a reglas | `/planes` |
| Rol | Catálogos > Roles | Sí | Sí | Sí | Sí | `/roles` |
| UsuarioSistema | Usuarios > Usuarios del sistema | Sí | Sí | Sí | Sí, sujeto a perfiles relacionados | `/usuarios-sistema` |
| PerfilCliente | Usuarios > Clientes | Sí | Sí | Sí | Sí, sujeto a reservas | `/perfiles-cliente` |
| Reserva | Ventas > Reservas | Sí | Sí | Confirmación real; actualización de plan soportada por backend | No se simula cancelación; se respetan restricciones | `/reservas` |
| Notificacion | Sistema > Notificaciones | Sí | Sí | Sí / marcar leída | Sí | `/notificaciones` |
| Atraccion | Oferta > Atracciones | Sí | Sí | Sí | Sí, sujeto a funciones/combos | `/atracciones` |
| Funcion | Oferta > Funciones | Sí | Sí | Sí | Cancelación por endpoint de negocio | `/funciones` |
| Zona | Dentro del formulario de Función | Sí | Sí | Sí | Sí, sujeto a boletas | `/zonas` |
| TipoEntrada | Catálogos > Tipos de entrada | Sí | Sí | Sí | Sí | `/tipos-entrada` |
| Combo | Oferta > Combos | Sí | Sí | Sí | Sí cuando las reglas lo permiten | `/combos` |
| ComboAtraccion | Dentro del formulario de Combo | Sí | Sí | Sí | Sí cuando no hay compras que bloqueen composición | `/combos-atracciones` |
| Boleta | Ventas > Boletas | Sí | Se emite mediante Reserva | Estados por reglas del backend | Usar/anular mediante PATCH; no se fuerza borrado histórico | `/boletas` |

## C. Login

El formulario ya no acepta acceso por una validación local de correo/longitud. Envía:

```http
POST /api/v1/usuarios-sistema/login
Content-Type: application/json
```

```json
{
  "correo": "...",
  "clave": "..."
}
```

Si el backend responde 401, se muestra el error y no se entra al panel. La respuesta de usuario se conserva en `sessionStorage` únicamente como estado académico de sesión. No se implementó JWT porque el backend no lo usa.

## D. Reportes

Los 10 reportes descargan el PDF oficial del backend:

1. `/reportes/1/pdf`
2. `/reportes/2/pdf`
3. `/reportes/3/pdf?idReserva={id}`
4. `/reportes/4/pdf`
5. `/reportes/5/pdf`
6. `/reportes/6/pdf`
7. `/reportes/7/pdf`
8. `/reportes/8/pdf`
9. `/reportes/9/pdf`
10. `/reportes/10/pdf`

Las vistas previas existentes siguen usando los datos reales ya cargados del backend, pero el archivo descargado lo genera Spring Boot.

## E. Archivos modificados

### Frontend

- `lib/boleteria-api.ts`: nueva capa HTTP, login, carga de datos, adaptación de DTO y descarga de PDF.
- `components/boleteria-app.tsx`: carga desde backend, CRUD reales, login real, sesión, funciones/zonas/combos y manejo de errores.
- `components/reservations-module.tsx`: reserva pendiente + confirmación real y eliminación de operaciones simuladas no soportadas.
- `components/reports-dashboard.tsx`: descarga de PDF desde Spring Boot en lugar de jsPDF.
- `components/occupancy-report.tsx`: descarga del reporte 4 desde backend.
- `.env.local.example`: URL configurable del backend.

### Backend

- `config/CorsConfig.java`: único cambio técnico; permite el origen local `http://localhost:3000` con GET/POST/PUT/PATCH/DELETE/OPTIONS.

No se modificaron entidades JPA, relaciones, reglas de negocio, SQL, login BCrypt, reportes ni configuración de Oracle.

## F. Instrucciones de ejecución

### 1. Oracle

Debe estar disponible en:

```text
localhost:1521/XEPDB1
```

El backend actual utiliza:

```properties
spring.datasource.username=bd2
spring.datasource.password=bd2
```

### 2. Backend

Desde la carpeta del backend:

```powershell
.\gradlew bootRun
```

Backend:

```text
http://localhost:8080/api/v1
```

Swagger, si está habilitado por springdoc con el context-path:

```text
http://localhost:8080/api/v1/swagger-ui/index.html
```

### 3. Frontend

Crear `.env.local` a partir de `.env.local.example`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
```

Después:

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Frontend:

```text
http://localhost:3000
```

## G. Pruebas realizadas en este entorno

### Verificación estática realizada

- Se comprobó que ya no hay referencias a `localStorage` en el código de negocio del frontend.
- Se comprobó que los componentes ya no importan ni ejecutan `jsPDF`/`jspdf-autotable`.
- Se verificó que la única URL base está centralizada en `lib/boleteria-api.ts`.
- Se ejecutó el transpilado estático de TypeScript/TSX sobre los archivos modificados usando TypeScript 5.8.3: **0 errores de sintaxis/transpilación**.

### Pruebas no ejecutables aquí

No fue posible ejecutar `pnpm install`/`next build`, porque el entorno no tiene acceso de red y Corepack intentó descargar pnpm 12.3.4 desde npm.

No fue posible ejecutar `./gradlew test`, porque el wrapper intentó descargar Gradle 9.8.2 desde `services.gradle.org` y el entorno no tiene acceso de red.

Tampoco se dispone en este entorno de la instancia Oracle local del usuario, por lo que la integración HTTP no pudo probarse en ejecución real contra `localhost:1521/XEPDB1`.

## H. Limitaciones / decisiones de compatibilidad

- El backend no expone JWT ni sesión segura de servidor; se mantuvo el flujo académico basado en el DTO devuelto por login y `sessionStorage`.
- El backend no ofrece un endpoint para cambiar la contraseña en `PUT /usuarios-sistema/{id}`; por eso el formulario de edición no promete modificarla.
- La reserva no se cancela simulando un estado en el frontend. El frontend evita esa operación porque el backend no expone un endpoint de cancelación arbitraria.
- El backend actual permite actualizar principalmente el plan de una reserva pendiente; no se reescribió el backend para permitir reemplazar sus boletas.
- Las reglas de aforo, vigencia, menores, estados y restricciones de borrado siguen siendo responsabilidad de Spring Boot.
- ComboAtraccion y Zona se administran dentro de las pantallas de Combo y Función, respectivamente; no se crearon pantallas nuevas para no rediseñar la aplicación.
