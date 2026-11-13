'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Menu, X } from 'lucide-react'
import { ApiError, type BackendUser } from '../lib/boleteria-api'
import {
  cargarCatalogoCliente, clienteApi, fechaFuncion, fechaHora, fechaOracle, horaFuncion, moneda,
  type Boleta, type CatalogoCliente, type Combo, type Funcion, type Notificacion, type Perfil, type Reserva, type Seleccion,
} from '../lib/cliente-api'
import { CampoCliente, mensajeError } from './acceso-boleteria'
import { CompraCliente, ZonasFuncion } from './compra-cliente'

const secciones = {
  inicio: 'Inicio', funciones: 'Explorar funciones', compra: 'Comprar entradas', combos: 'Combos',
  reservas: 'Mis reservas', boletas: 'Mis boletas', notificaciones: 'Notificaciones', perfil: 'Mi perfil',
}
type Seccion = keyof typeof secciones
type Compra = { funcion: number; combo?: Combo }
type DetalleReserva = { id: number; boletas?: Boleta[]; error?: string }

async function cargarActividad() {
  const [reservas, boletas, notificaciones] = await Promise.all([
    clienteApi.reservas(), clienteApi.boletas(), clienteApi.notificaciones(),
  ])
  return {
    reservas: reservas.sort((a, b) => b.fechaHora.localeCompare(a.fechaHora)),
    boletas,
    notificaciones: notificaciones.sort((a, b) => b.fechaHora.localeCompare(a.fechaHora)),
  }
}

export function PanelCliente({ usuario, onSalir }: { usuario: BackendUser; onSalir: () => Promise<void> }) {
  const [seccion, setSeccion] = useState<Seccion>('inicio')
  const [menu, setMenu] = useState(false)
  const [catalogo, setCatalogo] = useState<CatalogoCliente>()
  const [perfil, setPerfil] = useState<Perfil>()
  const [actividad, setActividad] = useState<Awaited<ReturnType<typeof cargarActividad>>>()
  const [carga, setCarga] = useState(0)
  const [errorCarga, setErrorCarga] = useState('')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [compra, setCompra] = useState<Compra>({ funcion: 0 })
  const [detalle, setDetalle] = useState<DetalleReserva>()
  const [ocupado, setOcupado] = useState(false)
  const [resultadoDesconocido, setResultadoDesconocido] = useState(false)
  const [reservasVerificadas, setReservasVerificadas] = useState(false)
  const operacion = useRef(false)
  const consultaDetalle = useRef(0)
  const titulo = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    let vigente = true
    void Promise.all([cargarCatalogoCliente(), clienteApi.perfil(usuario.idUsuario), cargarActividad()])
      .then(([catalogoActual, perfilActual, actividadActual]) => {
        if (!vigente) return
        setCatalogo(catalogoActual)
        setPerfil(perfilActual)
        setActividad(actividadActual)
        setErrorCarga('')
      }).catch(err => {
        if (vigente) setErrorCarga(mensajeError(err, 'No se pudo cargar tu cuenta.'))
      })
    return () => { vigente = false }
  }, [usuario.idUsuario, carga])

  function navegar(destino: Seccion) {
    setSeccion(destino)
    setMenu(false)
    setError('')
    setAviso('')
    titulo.current?.focus()
  }

  function abrirCompra(seleccion: Compra) {
    setCompra(seleccion)
    navegar('compra')
  }

  async function verBoletas(id: number) {
    const consulta = ++consultaDetalle.current
    setDetalle({ id })
    try {
      const boletas = await clienteApi.boletasReserva(id)
      if (consulta === consultaDetalle.current) setDetalle({ id, boletas })
    } catch (err) {
      if (consulta === consultaDetalle.current) setDetalle({ id, error: mensajeError(err, 'No se pudieron consultar las boletas.') })
    }
  }

  async function actualizarActividad() {
    try {
      setActividad(await cargarActividad())
      return true
    } catch (err) {
      setError(mensajeError(err, 'No se pudo actualizar tu actividad. Usa Actualizar para volver a consultarla.'))
      return false
    }
  }

  async function verificarReservas() {
    setError('')
    setReservasVerificadas(await actualizarActividad())
  }

  async function reservar(boletas: Seleccion[], idCombo?: number) {
    if (!perfil || operacion.current || resultadoDesconocido) return
    operacion.current = true
    setOcupado(true)
    setError('')
    try {
      const reserva = await clienteApi.reservar(perfil.idPerfil, boletas, idCombo)
      setActividad(actual => actual && { ...actual, reservas: [reserva, ...actual.reservas.filter(item => item.idReserva !== reserva.idReserva)] })
      navegar('reservas')
      setAviso(`Reserva #${reserva.idReserva} creada. Revisa las boletas y confirma cuando estés listo.`)
      await Promise.all([verBoletas(reserva.idReserva), actualizarActividad()])
    } catch (err) {
      const incierto = !(err instanceof ApiError) || err.status >= 500 || err.status === 408
      setResultadoDesconocido(incierto)
      setReservasVerificadas(false)
      setError(incierto
        ? 'No se pudo verificar si se creó la reserva. Revisa Mis reservas antes de iniciar otra compra.'
        : mensajeError(err, 'No se pudo crear la reserva.'))
    } finally {
      operacion.current = false
      setOcupado(false)
    }
  }

  async function confirmar(reserva: Reserva) {
    if (operacion.current) return
    operacion.current = true
    setOcupado(true)
    setError('')
    setAviso('')
    try {
      const confirmada = await clienteApi.confirmar(reserva.idReserva)
      setActividad(actual => actual && { ...actual, reservas: actual.reservas.map(item => item.idReserva === confirmada.idReserva ? confirmada : item) })
      setAviso(`Reserva #${confirmada.idReserva} confirmada.`)
      await Promise.all([verBoletas(confirmada.idReserva), actualizarActividad()])
    } catch (err) {
      setError(mensajeError(err, 'No se pudo confirmar la reserva.'))
      try {
        setActividad(await cargarActividad())
      } catch { /* Se conserva el error de confirmación. */ }
    } finally {
      operacion.current = false
      setOcupado(false)
    }
  }

  async function guardarPerfil(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!perfil || operacion.current) return
    operacion.current = true
    setOcupado(true)
    setError('')
    setAviso('')
    const datos = new FormData(event.currentTarget)
    try {
      setPerfil(await clienteApi.guardarPerfil(perfil.idPerfil, {
        nombre: String(datos.get('nombre')).trim(), documento: String(datos.get('documento')).trim(),
        telefono: String(datos.get('telefono')).trim() || null,
      }))
      setAviso('Tu perfil se actualizó correctamente.')
    } catch (err) {
      setError(mensajeError(err, 'No se pudo actualizar el perfil.'))
    } finally {
      operacion.current = false
      setOcupado(false)
    }
  }

  async function salir() {
    if (operacion.current) return
    operacion.current = true
    setOcupado(true)
    setError('')
    try {
      await onSalir()
    } catch (err) {
      setError(mensajeError(err, 'No se pudo cerrar la sesión.'))
      operacion.current = false
      setOcupado(false)
    }
  }

  return <div className="app-shell cliente-shell">
    <button type="button" className="mobile-menu" onClick={() => setMenu(!menu)}
      aria-expanded={menu} aria-controls="menu-cliente" aria-label={menu ? 'Cerrar menú' : 'Abrir menú'}>
      {menu ? <X /> : <Menu />}
    </button>
    <div className={menu ? 'sidebar-wrap open' : 'sidebar-wrap'}>
      <aside className="sidebar" id="menu-cliente">
        <header className="sidebar-header"><div className="brand">Boletería</div></header>
        <nav className="sidebar-nav" aria-label="Navegación de cliente">
          {(Object.keys(secciones) as Seccion[]).map(item => (
            <button type="button" key={item} className={seccion === item ? 'active' : undefined}
              aria-current={seccion === item ? 'page' : undefined} disabled={ocupado}
              onClick={() => {
                if (item === 'compra') setCompra({ funcion: 0 })
                navegar(item)
              }}>{secciones[item]}</button>
          ))}
        </nav>
        <footer className="sidebar-footer">
          <div className="role">{usuario.correo}</div>
          <button type="button" className="logout-button" disabled={ocupado} onClick={() => void salir()}>Cerrar sesión</button>
        </footer>
      </aside>
    </div>
    <main className="content cliente-contenido">
      <div className="page-heading">
        <h1 ref={titulo} tabIndex={-1}>{seccion === 'inicio' && perfil ? `Hola, ${perfil.nombre}` : secciones[seccion]}</h1>
        {catalogo && <button type="button" className="secondary" disabled={ocupado} onClick={() => {
          setErrorCarga('')
          setCarga(valor => valor + 1)
          if (seccion === 'reservas' && detalle) void verBoletas(detalle.id)
        }}>Actualizar</button>}
      </div>
      {errorCarga && <div className="form-error cliente-aviso" role="alert">{errorCarga}{!catalogo &&
        <button type="button" className="cliente-link" onClick={() => {
          setErrorCarga('')
          setCarga(valor => valor + 1)
        }}>Reintentar</button>}</div>}
      {error && <div className="form-error cliente-aviso" role="alert">{error}</div>}
      {aviso && <div className="cliente-aviso" role="status">{aviso}</div>}
      {(!catalogo || !perfil || !actividad) && !errorCarga && <p role="status">Cargando tu cuenta…</p>}
      {catalogo && perfil && actividad && <>
        {seccion === 'inicio' && <div className="cliente-inicio">
          <section className="form-card cliente-destacado">
            <div><h2>Próximas funciones</h2><p>Encuentra un horario y consulta las zonas antes de reservar.</p></div>
            <button type="button" className="primary" onClick={() => abrirCompra({ funcion: 0 })}>Comprar entradas</button>
          </section>
          <Funciones catalogo={catalogo} funciones={catalogo.funciones.slice(0, 3)} onComprar={id => abrirCompra({ funcion: id })} />
          <div className="cliente-rejilla">
            <section className="form-card cliente-tarjeta"><h2>Reservas recientes</h2>
              {actividad.reservas.length ? <ul className="cliente-lista">{actividad.reservas.slice(0, 3).map(reserva => (
                <li key={reserva.idReserva}><strong>Reserva #{reserva.idReserva}</strong><span>{reserva.estado}</span></li>
              ))}</ul> : <p>Aún no tienes reservas.</p>}
              <button type="button" className="cliente-link" onClick={() => navegar('reservas')}>Ver mis reservas</button>
            </section>
            <section className="form-card cliente-tarjeta"><h2>Notificaciones recientes</h2>
              <ListaNotificaciones items={actividad.notificaciones.slice(0, 2)} />
              <button type="button" className="cliente-link" onClick={() => navegar('notificaciones')}>Ver notificaciones</button>
            </section>
          </div>
        </div>}
        {seccion === 'funciones' && <Explorar catalogo={catalogo} onComprar={id => abrirCompra({ funcion: id })} />}
        {seccion === 'compra' && (resultadoDesconocido ? <section className="form-card cliente-tarjeta">
          <h2>Verifica el resultado de la compra</h2>
          <p>Consulta tus reservas antes de volver a enviar una solicitud.</p>
          <button type="button" className="primary" onClick={() => { navegar('reservas'); void verificarReservas() }}>Consultar mis reservas</button>
        </section> : <CompraCliente key={compra.combo?.idCombo ? `combo-${compra.combo.idCombo}` : `funcion-${compra.funcion}`}
          catalogo={catalogo} combo={compra.combo} funcionInicial={compra.funcion} bloqueado={ocupado} onReservar={reservar} />)}
        {seccion === 'combos' && <Combos catalogo={catalogo} onComprar={combo => abrirCompra({ funcion: 0, combo })} />}
        {seccion === 'reservas' && <>
          {resultadoDesconocido && <div className="cliente-aviso" role="status">
            Revisa la lista antes de continuar.
            {reservasVerificadas
              ? <button type="button" className="cliente-link" onClick={() => setResultadoDesconocido(false)}>Ya revisé mis reservas</button>
              : <button type="button" className="cliente-link" onClick={() => void verificarReservas()}>Volver a consultar</button>}
          </div>}
          <Reservas reservas={actividad.reservas} boletas={actividad.boletas} catalogo={catalogo} detalle={detalle}
            ocupado={ocupado} onVer={id => void verBoletas(id)} onConfirmar={reserva => void confirmar(reserva)} />
        </>}
        {seccion === 'boletas' && <ListaBoletas boletas={actividad.boletas} catalogo={catalogo} />}
        {seccion === 'notificaciones' && <section className="form-card cliente-tarjeta"><ListaNotificaciones items={actividad.notificaciones} /></section>}
        {seccion === 'perfil' && <form className="form-card" onSubmit={guardarPerfil}>
          <fieldset className="cliente-perfil" disabled={ocupado} key={JSON.stringify([perfil.nombre, perfil.documento, perfil.telefono])}>
            <div className="form-grid two">
              <CampoCliente label="Nombre completo"><input name="nombre" defaultValue={perfil.nombre} required maxLength={150} autoComplete="name" /></CampoCliente>
              <CampoCliente label="Documento de identidad"><input name="documento" defaultValue={perfil.documento} required maxLength={30} /></CampoCliente>
              <CampoCliente label="Teléfono"><input name="telefono" type="tel" defaultValue={perfil.telefono ?? ''} maxLength={30} autoComplete="tel" /></CampoCliente>
              <CampoCliente label="Correo electrónico"><input type="email" value={perfil.correo} readOnly /></CampoCliente>
            </div>
            <button className="primary">{ocupado ? 'Guardando…' : 'Guardar cambios'}</button>
          </fieldset>
        </form>}
      </>}
    </main>
  </div>
}

function Explorar({ catalogo, onComprar }: { catalogo: CatalogoCliente; onComprar: (id: number) => void }) {
  const [id, setId] = useState(0)
  const atraccion = catalogo.atracciones.find(item => item.idAtraccion === id)
  const funciones = id ? catalogo.funciones.filter(funcion => funcion.idAtraccion === id) : catalogo.funciones
  return <>
    <div className="catalog-search">
      <CampoCliente label="Atracción">
        <select value={id} onChange={e => setId(Number(e.target.value))}>
          <option value={0}>Todas las atracciones</option>
          {catalogo.atracciones.map(item => <option key={item.idAtraccion} value={item.idAtraccion}>{item.nombre}</option>)}
        </select>
      </CampoCliente>
      {atraccion?.descripcion && <p className="cliente-detalle">{atraccion.descripcion}</p>}
    </div>
    <Funciones catalogo={catalogo} funciones={funciones} onComprar={onComprar} />
  </>
}

function Funciones({ catalogo, funciones, onComprar }: {
  catalogo: CatalogoCliente; funciones: Funcion[]; onComprar: (id: number) => void
}) {
  const [abierta, setAbierta] = useState<number>()
  if (!funciones.length) return <p className="empty">No hay funciones disponibles.</p>
  return <div className="cliente-rejilla">{funciones.map(funcion => (
    <article key={funcion.idFuncion} className="form-card cliente-tarjeta">
      <h3>{funcion.nombreAtraccion}</h3>
      <p>{fechaFuncion(funcion)} · {horaFuncion(funcion)}</p>
      <button type="button" className="secondary" aria-expanded={abierta === funcion.idFuncion}
        onClick={() => setAbierta(abierta === funcion.idFuncion ? undefined : funcion.idFuncion)}>
        {abierta === funcion.idFuncion ? 'Ocultar zonas' : 'Ver zonas y disponibilidad'}
      </button>
      {abierta === funcion.idFuncion && <ZonasFuncion funcion={funcion} catalogo={catalogo} onComprar={() => onComprar(funcion.idFuncion)} />}
    </article>
  ))}</div>
}

function Combos({ catalogo, onComprar }: { catalogo: CatalogoCliente; onComprar: (combo: Combo) => void }) {
  if (!catalogo.combos.length) return <p className="empty">No hay combos disponibles.</p>
  return <div className="cliente-rejilla">{catalogo.combos.map(combo => (
    <article className="form-card cliente-tarjeta" key={combo.idCombo}>
      <h2>{combo.nombre}</h2>
      <p><strong>{moneda(combo.precio)}</strong> · Vigencia de {combo.diasVigencia} días</p>
      <ul className="cliente-lista">{combo.idsAtracciones.map(id => <li key={id}>
        {catalogo.atracciones.find(atraccion => atraccion.idAtraccion === id)?.nombre ?? `Atracción ${id}`}
      </li>)}</ul>
      <button type="button" className="primary" onClick={() => onComprar(combo)} disabled={!combo.idsAtracciones.length}>Comprar combo</button>
    </article>
  ))}</div>
}

function ListaNotificaciones({ items }: { items: Notificacion[] }) {
  if (!items.length) return <p>No tienes notificaciones.</p>
  return <ul className="cliente-lista cliente-notificaciones">{items.map(item => (
    <li key={item.idNotificacion}>
      <div><strong>{item.asunto}</strong><p>{item.mensaje}</p></div>
      <small>{fechaHora(item.fechaHora)} · {item.leida ? 'Leída' : 'Sin leer'}</small>
    </li>
  ))}</ul>
}

function TiempoRestante({ fecha }: { fecha: string }) {
  const [ahora, setAhora] = useState(Date.now)
  useEffect(() => {
    const intervalo = window.setInterval(() => setAhora(Date.now()), 1000)
    return () => window.clearInterval(intervalo)
  }, [])
  const segundos = Math.ceil((fechaOracle(fecha).getTime() + 15 * 60_000 - ahora) / 1000)
  if (!Number.isFinite(segundos)) return null
  if (segundos <= 0) return <small>Plazo estimado agotado. Actualiza el estado para comprobarlo.</small>
  return <small>Tiempo restante aproximado {Math.floor(segundos / 60)}:{String(segundos % 60).padStart(2, '0')}</small>
}

function Reservas({ reservas, boletas, catalogo, detalle, ocupado, onVer, onConfirmar }: {
  reservas: Reserva[]; boletas: Boleta[]; catalogo: CatalogoCliente; detalle?: DetalleReserva; ocupado: boolean
  onVer: (id: number) => void; onConfirmar: (reserva: Reserva) => void
}) {
  if (!reservas.length) return <p className="empty">Aún no tienes reservas.</p>
  return <div className="cliente-reservas">{reservas.map(reserva => {
    const abiertas = detalle?.id === reserva.idReserva ? detalle : undefined
    const entradas = abiertas?.boletas ?? boletas.filter(boleta => boleta.idReserva === reserva.idReserva)
    const total = entradas.reduce((suma, boleta) => suma + boleta.precioPagado, 0)
    return <article className="form-card cliente-tarjeta" key={reserva.idReserva}>
      <header className="cliente-fila">
        <div><h2>Reserva #{reserva.idReserva}</h2><p>{fechaHora(reserva.fechaHora)}{reserva.nombrePlan && ` · ${reserva.nombrePlan}`}</p></div>
        <span className={`status ${reserva.estado === 'EXPIRADA' ? 'cancelada' : 'programada'}`}>{reserva.estado}</span>
      </header>
      {reserva.estado === 'PENDIENTE' && <TiempoRestante fecha={reserva.fechaHora} />}
      {entradas.length > 0 && <p><strong>Total registrado {moneda(total)}</strong></p>}
      <div className="cliente-acciones">
        <button type="button" className="secondary" disabled={ocupado} onClick={() => onVer(reserva.idReserva)}>Consultar boletas</button>
        {reserva.estado === 'PENDIENTE' && <button type="button" className="primary" disabled={ocupado}
          onClick={() => onConfirmar(reserva)}>Confirmar reserva</button>}
      </div>
      {abiertas?.error && <p className="form-error" role="alert">{abiertas.error}</p>}
      {abiertas && !abiertas.error && !abiertas.boletas && <p role="status">Cargando boletas…</p>}
      {abiertas?.boletas && <ListaBoletas boletas={abiertas.boletas} catalogo={catalogo} />}
    </article>
  })}</div>
}

function ListaBoletas({ boletas, catalogo }: { boletas: Boleta[]; catalogo: CatalogoCliente }) {
  if (!boletas.length) return <p className="empty">No hay boletas para mostrar.</p>
  return <div className="cliente-rejilla cliente-boletas">{boletas.map(boleta => {
    const zona = catalogo.zonas.find(item => item.idZona === boleta.idZona)
    const funcion = catalogo.funciones.find(item => item.idFuncion === zona?.idFuncion)
    return <article className="cliente-boleto" key={boleta.idBoleta}>
      <div className="cliente-fila"><h3>{funcion?.nombreAtraccion ?? `Boleta #${boleta.idBoleta}`}</h3>
        <span className={`status ${boleta.estado === 'ANULADA' ? 'cancelada' : boleta.estado === 'USADA' ? 'realizada' : 'programada'}`}>{boleta.estado}</span>
      </div>
      <p className="cliente-codigo">{boleta.codigo}</p>
      <dl>
        <dt>Función</dt><dd>{funcion ? `${fechaFuncion(funcion)} · ${horaFuncion(funcion)}` : 'Información no disponible'}</dd>
        <dt>Zona</dt><dd>{boleta.nombreZona ?? '—'}</dd>
        <dt>Tipo</dt><dd>{boleta.nombreTipoEntrada ?? '—'}</dd>
        {boleta.nombreCombo && <><dt>Combo</dt><dd>{boleta.nombreCombo}</dd></>}
        <dt>Precio pagado</dt><dd>{moneda(boleta.precioPagado)}</dd>
        <dt>Reserva</dt><dd>#{boleta.idReserva}</dd>
      </dl>
    </article>
  })}</div>
}

