import { api, type BackendUser } from './boleteria-api'

export type Registro = {
  nombre: string; documento: string; telefono: string; correo: string; clave: string; confirmacionClave: string
}
export type Perfil = {
  idPerfil: number; documento: string; nombre: string; telefono: string | null; idUsuario: number; correo: string
}
export type Atraccion = { idAtraccion: number; nombre: string; descripcion: string | null }
export type Funcion = {
  idFuncion: number; fecha: string; horaApertura: string; horaCierre: string; estado: string
  idAtraccion: number; nombreAtraccion: string
}
export type Zona = { idZona: number; nombre: string; aforo: number; precio: number; idFuncion: number }
export type Disponibilidad = { idFuncion: number; zonas: { idZona: number; disponibles: number }[] }
export type TipoEntrada = { idTipoEntrada: number; nombre: string; porcentajeDescuento: number; requiereAdulto: boolean }
export type Combo = {
  idCombo: number; nombre: string; precio: number; diasVigencia: number; idsAtracciones: number[]
}
export type Reserva = { idReserva: number; fechaHora: string; estado: string; nombrePlan: string | null }
export type Boleta = {
  idBoleta: number; codigo: string; estado: string; precioPagado: number; idReserva: number
  idZona: number | null; nombreZona: string | null; nombreTipoEntrada: string | null; nombreCombo: string | null
}
export type Notificacion = {
  idNotificacion: number; asunto: string; mensaje: string; fechaHora: string; leida: boolean; idReserva: number | null
}
export type Seleccion = { idZona: number; idTipoEntrada: number }

export const clienteApi = {
  registrar: (registro: Registro) => api.post<BackendUser>('/usuarios-sistema/registro', registro),
  perfil: (idUsuario: number) => api.get<Perfil>(`/perfiles-cliente/usuario/${idUsuario}`),
  guardarPerfil: (idPerfil: number, datos: Pick<Perfil, 'nombre' | 'documento' | 'telefono'>) =>
    api.put<Perfil>(`/perfiles-cliente/${idPerfil}`, datos),
  atracciones: () => api.get<Atraccion[]>('/atracciones'),
  funciones: () => api.get<Funcion[]>('/funciones'),
  zonas: () => api.get<Zona[]>('/zonas'),
  disponibilidad: (idFuncion: number) => api.get<Disponibilidad>(`/zonas/funcion/${idFuncion}/disponibilidad`),
  tipos: () => api.get<TipoEntrada[]>('/tipos-entrada'),
  combos: () => api.get<Combo[]>('/combos'),
  reservas: () => api.get<Reserva[]>('/reservas'),
  reservar: (idPerfil: number, boletas: Seleccion[], idCombo?: number) =>
    api.post<Reserva>('/reservas', { idPerfil, boletas, idCombo }),
  confirmar: (idReserva: number) => api.patch<Reserva>(`/reservas/${idReserva}/confirmar`),
  boletas: () => api.get<Boleta[]>('/boletas'),
  boletasReserva: (idReserva: number) => api.get<Boleta[]>(`/boletas/reserva/${idReserva}`),
  notificaciones: () => api.get<Notificacion[]>('/notificaciones'),
}

export async function cargarCatalogoCliente() {
  const [atracciones, funciones, zonas, tipos, combos] = await Promise.all([
    clienteApi.atracciones(), clienteApi.funciones(), clienteApi.zonas(), clienteApi.tipos(), clienteApi.combos(),
  ])
  funciones.sort((a, b) => `${a.fecha}T${a.horaApertura}`.localeCompare(`${b.fecha}T${b.horaApertura}`))
  return { atracciones, funciones, zonas, tipos, combos }
}

export type CatalogoCliente = Awaited<ReturnType<typeof cargarCatalogoCliente>>

const pesos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })
const fechaColombia = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: 'America/Bogota' })
const fechaHoraColombia = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' })

export const moneda = (valor: number) => pesos.format(valor)
export const fechaFuncion = (funcion: Funcion) => fechaColombia.format(new Date(`${funcion.fecha}T12:00:00-05:00`))
export const horaFuncion = (funcion: Funcion) => `${funcion.horaApertura.slice(0, 5)}–${funcion.horaCierre.slice(0, 5)}`
export const fechaOracle = (valor: string) => new Date(`${valor.replace(/(\.\d{3})\d+$/, '$1')}-05:00`)
export const fechaHora = (valor: string) => fechaHoraColombia.format(fechaOracle(valor))

