export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1').replace(/\/$/, '')

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (init.method && !['GET', 'HEAD', 'OPTIONS'].includes(init.method)) {
    const csrf = await request<{ headerName: string; token: string }>('/usuarios-sistema/csrf')
    headers.set(csrf.headerName, csrf.token)
  }
  const response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include', cache: 'no-store' })
  if (!response.ok) {
    let message = `Error HTTP ${response.status}`
    try {
      const body = await response.json()
      message = body?.message || body?.error || message
    } catch { /* respuesta sin JSON */ }
    throw new ApiError(response.status, message)
  }
  if (response.status === 204) return undefined as T
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) return undefined as T
  return response.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) }),
  delete: (path: string) => request<void>(path, { method: 'DELETE' }),
}

export type BackendUser = { idUsuario: number; correo: string; estado: string; idRol: number; nombreRol: string }

export async function loginBackend(correo: string, clave: string) {
  return api.post<BackendUser>('/usuarios-sistema/login', { correo, clave })
}

export const sesionBackend = () => api.get<BackendUser>('/usuarios-sistema/me')
export const logoutBackend = () => api.post<void>('/usuarios-sistema/logout')

export function esAdministrador(user: BackendUser) {
  return ['ADMIN', 'ADMINISTRADOR'].includes(user.nombreRol.trim().toUpperCase())
}

const str = (v: unknown) => v == null ? '' : String(v)
const num = (v: unknown) => Number(v ?? 0)

export async function loadBoleteriaData() {
  const [municipios, tiposPrestador, tiposEntrada, roles, prestadores, planes, atracciones, funciones, zonas, combos, comboAtracciones, usuarios, perfiles, reservas, boletas, notificaciones] = await Promise.all([
    api.get<any[]>('/municipios'),
    api.get<any[]>('/tipos-prestador'),
    api.get<any[]>('/tipos-entrada'),
    api.get<any[]>('/roles'),
    api.get<any[]>('/prestadores'),
    api.get<any[]>('/planes'),
    api.get<any[]>('/atracciones'),
    api.get<any[]>('/funciones'),
    api.get<any[]>('/zonas'),
    api.get<any[]>('/combos'),
    api.get<any[]>('/combos-atracciones'),
    api.get<any[]>('/usuarios-sistema'),
    api.get<any[]>('/perfiles-cliente'),
    api.get<any[]>('/reservas'),
    api.get<any[]>('/boletas'),
    api.get<any[]>('/notificaciones'),
  ])

  const catalogos = {
    municipios: municipios.map(x => ({ id: str(x.idMunicipio), name: x.nombre, department: x.departamento })),
    prestadorTypes: tiposPrestador.map(x => ({ id: str(x.idTipoPrestador), name: x.nombre })),
    ticketTypes: tiposEntrada.map(x => ({ id: str(x.idTipoEntrada), name: x.nombre, discount: num(x.porcentajeDescuento), requiresAdult: Boolean(x.requiereAdulto), isAdult: Boolean(x.esAdulto) })),
    roles: roles.map(x => ({ id: str(x.idRol), name: x.nombre })),
  }

  const providers = prestadores.map(x => ({ id: str(x.idPrestador), nit: x.nit, name: x.nombre, email: x.correo, municipalityId: str(x.idMunicipio), typeId: str(x.idTipoPrestador) }))
  const plans = planes.map(x => ({ id: str(x.idPlan), name: x.nombre, description: x.descripcion || '', status: x.estado, providerId: str(x.idPrestador) }))
  const attractions = atracciones.map(x => ({ id: str(x.idAtraccion), name: x.nombre, description: x.descripcion || '', providerId: str(x.idPrestador) }))

  const zonesByFunction = new Map<string, any[]>()
  zonas.forEach(z => {
    const key = str(z.idFuncion)
    const list = zonesByFunction.get(key) || []
    list.push({ id: str(z.idZona), name: z.nombre, capacity: num(z.aforo), price: num(z.precio) })
    zonesByFunction.set(key, list)
  })
  const functions = funciones.map(x => ({ id: str(x.idFuncion), attractionId: str(x.idAtraccion), date: x.fecha, status: x.estado, opening: String(x.horaApertura || '').slice(0, 5), closing: String(x.horaCierre || '').slice(0, 5), zones: zonesByFunction.get(str(x.idFuncion)) || [] }))

  const repartos = new Map<string, any[]>()
  comboAtracciones.forEach(x => {
    const key = str(x.idCombo)
    const list = repartos.get(key) || []
    list.push({ attractionId: str(x.idAtraccion), percentage: num(x.porcentajePrecio) })
    repartos.set(key, list)
  })
  const comboItems = combos.map(x => ({ id: str(x.idCombo), name: x.nombre, price: num(x.precio), validDays: num(x.diasVigencia), status: x.estado, attractions: repartos.get(str(x.idCombo)) || (x.idsAtracciones || []).map((id: unknown) => ({ attractionId: str(id), percentage: 0 })) }))

  const users = usuarios.map(x => ({ id: str(x.idUsuario), email: x.correo, status: x.estado, roleId: str(x.idRol) }))
  const clients = perfiles.map(x => ({ id: str(x.idPerfil), document: x.documento, name: x.nombre, phone: x.telefono || '', userId: str(x.idUsuario) }))

  const functionByZone = new Map<string, string>()
  const zoneName = new Map<string, string>()
  functions.forEach(fn => fn.zones.forEach((z: any) => { functionByZone.set(z.id, fn.id); zoneName.set(z.id, z.name) }))

  const tickets = boletas.map(x => ({
    id: str(x.idBoleta), code: x.codigo, reservationId: str(x.idReserva), lineId: str(x.idBoleta), zoneId: str(x.idZona), functionId: functionByZone.get(str(x.idZona)), zoneName: x.nombreZona || zoneName.get(str(x.idZona)), ticketTypeId: str(x.idTipoEntrada), comboId: x.idCombo == null ? undefined : str(x.idCombo), price: num(x.precioPagado), status: x.estado === 'ACTIVA' ? 'VENDIDA' : x.estado,
  })).sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0) || b.code.localeCompare(a.code, undefined, { numeric: true }))

  const reservations = reservas.map(x => {
    const related = tickets.filter(t => t.reservationId === str(x.idReserva))
    return {
      id: str(x.idReserva), number: `RES-${x.idReserva}`, clientId: str(x.idPerfil), planId: x.idPlan == null ? undefined : str(x.idPlan), createdAt: x.fechaHora, status: x.estado,
      lines: related.map(t => ({ id: t.lineId, functionId: t.functionId || '', zoneId: t.zoneId, zoneName: t.zoneName, ticketTypeId: t.ticketTypeId, comboId: t.comboId, price: t.price, discount: 0 }))
    }
  }).sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const notifications = notificaciones.map(x => ({ id: str(x.idNotificacion), userId: str(x.idUsuario), reservationId: x.idReserva == null ? undefined : str(x.idReserva), subject: x.asunto, message: x.mensaje, createdAt: x.fechaHora, status: x.leida ? 'LEÍDA' : 'NO LEÍDA' }))

  return { catalogs: catalogos, providers, plans, attractions, combos: comboItems, functions, users, clients, reservations, tickets, notifications }
}

export async function downloadReportPdf(numero: number, idReserva?: string) {
  const query = numero === 3 && idReserva ? `?idReserva=${encodeURIComponent(idReserva)}` : ''
  const response = await fetch(`${API_URL}/reportes/${numero}/pdf${query}`, { credentials: 'include', cache: 'no-store' })
  if (!response.ok) {
    let message = `No se pudo descargar el reporte ${numero}`
    try { const body = await response.json(); message = body?.message || message } catch { /* noop */ }
    throw new ApiError(response.status, message)
  }
  const blob = await response.blob()
  const disposition = response.headers.get('content-disposition') || ''
  const match = disposition.match(/filename\*?=(?:UTF-8''|\")?([^\";]+)/i)
  const filename = match ? decodeURIComponent(match[1].replace(/\"/g, '')) : `reporte-${numero}.pdf`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
