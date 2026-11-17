# Sistema de Boletería y Eventos

Aplicación web desarrollada para administrar eventos, funciones, zonas, reservas y boletas. El sistema permite gestionar la información mediante operaciones CRUD, controlar el acceso de administradores y clientes, realizar reservas y generar diez reportes en formato PDF.

## 1. Tecnologías utilizadas

| Herramienta | Versión utilizada |
|---|---|
| Java JDK | 21 |
| Spring Boot | 4.1.2 |
| Gradle | Wrapper incluido |
| Oracle Database | 21c XE |
| Oracle SQL Developer | Compatible con Oracle 21c |
| Node.js | Versión LTS compatible con Next.js 16 |
| Next.js | 16 |
| React | 19 |
| IntelliJ IDEA | Compatible con Java 21 |

## 2. Estructura del proyecto

```text
Boletteria/
├── backend/
│   ├── database/
│   ├── src/
│   ├── gradle/
│   ├── build.gradle
│   ├── settings.gradle
│   ├── gradlew
│   └── gradlew.bat
├── frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── public/
│   └── package.json
└── README.md
```

## 3. Configuración de la base de datos

Para ejecutar el sistema se requiere tener Oracle Database instalado y en funcionamiento.

Durante el desarrollo se utilizó la siguiente configuración:

| Parámetro | Valor |
|---|---|
| Motor | Oracle Database 21c XE |
| Host | localhost |
| Puerto | 1521 |
| Servicio | XEPDB1 |
| Usuario de desarrollo | bd2 |

Se debe disponer de un usuario con los permisos necesarios para crear las tablas, índices y demás objetos del modelo.

Desde Oracle SQL Developer o la consola de base de datos de IntelliJ IDEA, ejecutar los siguientes scripts ubicados en `backend/database/`:

1. `01_creacion_tablas.sql`
2. `04_datos_iniciales.sql`
3. `05_reportes.sql`

Los dos primeros permiten crear el esquema y cargar los datos iniciales. El tercero contiene las consultas SQL utilizadas para verificar los resultados de los diez reportes.

## 4. Configuración y ejecución del backend

El backend está desarrollado en Java 21 y Spring Boot 4.1.2.

Abrir el proyecto en IntelliJ IDEA y configurar JDK 21 como SDK del proyecto y como JVM de Gradle.

Localizar el archivo:

```text
backend/src/main/resources/application.properties
```

Verificar las propiedades de conexión:

```properties
spring.datasource.url=jdbc:oracle:thin:@//localhost:1521/XEPDB1
spring.datasource.username=bd2
spring.datasource.password=TU_CONTRASEÑA
```

Reemplazar `TU_CONTRASEÑA` por la contraseña configurada para el usuario de Oracle. Los datos deben corresponder a la instancia utilizada.

Para ejecutar el backend desde PowerShell:

```powershell
cd backend
.\gradlew.bat bootRun
```

También puede iniciarse desde IntelliJ IDEA ejecutando la clase principal:

```text
BoleteriaEventosBackendApplication
```

Cuando la ejecución es correcta, el backend queda disponible en:

```text
http://localhost:8080
```

La aplicación utiliza las rutas de la API bajo `/api/v1`.

## 5. Configuración y ejecución del frontend

El frontend está desarrollado con Next.js 16 y React 19.

Abrir una segunda terminal desde la carpeta principal del proyecto y ejecutar:

```powershell
cd frontend
npm install
npm run dev
```

Una vez iniciado el servidor, acceder a:

http://localhost:3000

Es necesario mantener el backend en ejecución para utilizar las funcionalidades que requieren información de Oracle.

## 6. Funcionalidades principales

El sistema incluye:

- Inicio de sesión y registro de clientes.
- Acceso diferenciado para administradores y clientes.
- Gestión de eventos, funciones, zonas y tipos de entrada.
- Administración de prestadores, planes, usuarios y perfiles de clientes.
- Creación y consulta de reservas y boletas.
- Gestión de combos y notificaciones.
- Aplicación de reglas de negocio relacionadas con aforo, horarios, reservas y venta de boletas.
- Generación y descarga de diez reportes PDF.

## 7. Verificación de funcionamiento

Una vez iniciado el backend y el frontend, se recomienda comprobar:

1. Que Oracle esté disponible y el backend se conecte correctamente.
2. Que la aplicación cargue en `http://localhost:3000`.
3. Que el inicio de sesión funcione.
4. Que las funcionalidades disponibles correspondan al rol autenticado.
5. Que las operaciones de consulta y registro se reflejen en la base de datos.
6. Que los diez reportes PDF puedan consultarse y descargarse.

## 8. Consideraciones

- El backend debe estar conectado a Oracle para acceder a los datos del sistema.
- Los servidores del frontend y backend deben permanecer activos durante el uso de la aplicación.
- Las credenciales de la base de datos deben configurarse de acuerdo con el entorno de ejecución.
