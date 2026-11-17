'use client'

import { useEffect, useState } from 'react'
import { CampoCliente, mensajeError } from './acceso-boleteria'
import { clienteApi, fechaFuncion, horaFuncion, moneda, type CatalogoCliente, type Combo, type Disponibilidad, type Funcion, type Seleccion } from '../lib/cliente-api'

type Linea = { funcion: number; zona: number; tipo: number; cantidad: number }
const lineaVacia = (): Linea => ({ funcion: 0, zona: 0, tipo: 0, cantidad: 1 })

export function ZonasFuncion({ funcion, catalogo, onComprar }: {
  funcion: Funcion; catalogo: CatalogoCliente; onComprar: () => void
}) {
  const { disponibilidad, error, reintentar } = useDisponibilidad(funcion.idFuncion)
  const zonas = catalogo.zonas.filter(zona => zona.idFuncion === funcion.idFuncion)

  return <div className="cliente-zonas">
    {error && <div className="form-error" role="alert">{error} <button type="button" className="cliente-link" onClick={reintentar}>Reintentar</button></div>}
    {!disponibilidad && !error && <p role="status">Consultando disponibilidad…</p>}
    {zonas.length === 0 && <p>Esta función aún no tiene zonas publicadas.</p>}
    {zonas.length > 0 && <ul className="cliente-lista">
      {zonas.map(zona => <li key={zona.idZona}>
        <strong>{zona.nombre}</strong>
        <span>{moneda(zona.precio)} · {disponibilidad?.zonas.find(item => item.idZona === zona.idZona)?.disponibles ?? '—'} disponibles</span>
      </li>)}
    </ul>}
    <button type="button" className="primary" onClick={onComprar}
      disabled={!disponibilidad?.zonas.some(zona => zona.disponibles > 0)}>Comprar entradas</button>
  </div>
}

function useDisponibilidad(idFuncion: number) {
  const [consulta, setConsulta] = useState(0)
  const [resultado, setResultado] = useState<{ id: number; consulta: number; datos?: Disponibilidad; error?: string }>()
  useEffect(() => {
    if (!idFuncion) return
    let vigente = true
    void clienteApi.disponibilidad(idFuncion).then(datos => {
      if (vigente) setResultado({ id: idFuncion, consulta, datos })
    }).catch(error => {
      if (vigente) setResultado({ id: idFuncion, consulta, error: mensajeError(error, 'No se pudo consultar el aforo.') })
    })
    return () => { vigente = false }
  }, [idFuncion, consulta])

  const actual = resultado?.id === idFuncion && resultado.consulta === consulta ? resultado : undefined
  return { disponibilidad: actual?.datos, error: actual?.error, reintentar: () => setConsulta(valor => valor + 1) }
}

function SeleccionarEntrada({ linea, catalogo, onChange, esCombo }: {
  linea: Linea; catalogo: CatalogoCliente; onChange: (linea: Linea) => void; esCombo: boolean
}) {
  const { disponibilidad, error, reintentar } = useDisponibilidad(linea.funcion)
  const zonas = catalogo.zonas.filter(zona => zona.idFuncion === linea.funcion)
  const cupo = disponibilidad?.zonas.find(zona => zona.idZona === linea.zona)?.disponibles
  return <>
    <div className="form-grid two">
      <CampoCliente label="Zona">
        <select value={linea.zona || ''} required onChange={e => onChange({ ...linea, zona: Number(e.target.value) })}>
          <option value="">Selecciona una zona</option>
          {zonas.map(zona => {
            const disponibles = disponibilidad?.zonas.find(item => item.idZona === zona.idZona)?.disponibles
            return <option key={zona.idZona} value={zona.idZona} disabled={disponibles === 0}>
              {zona.nombre}{!esCombo && ` · ${moneda(zona.precio)}`}{disponibles !== undefined && ` · ${disponibles} disponibles`}
            </option>
          })}
        </select>
      </CampoCliente>
      <CampoCliente label="Tipo de entrada">
        <select value={linea.tipo || ''} required onChange={e => onChange({ ...linea, tipo: Number(e.target.value) })}>
          <option value="">Selecciona un tipo</option>
          {catalogo.tipos.map(tipo => <option key={tipo.idTipoEntrada} value={tipo.idTipoEntrada}>
            {tipo.nombre} · {tipo.porcentajeDescuento} % de descuento{tipo.requiereAdulto ? ' · Requiere adulto' : ''}
          </option>)}
        </select>
      </CampoCliente>
      {!esCombo && <CampoCliente label="Cantidad">
        <input type="number" required min="1" max="100" step="1" value={linea.cantidad || ''}
          onChange={e => onChange({ ...linea, cantidad: Number(e.target.value) })} />
      </CampoCliente>}
      {cupo !== undefined && <p className="cliente-detalle">{cupo} entradas disponibles en esta zona.</p>}
    </div>
    {linea.funcion > 0 && !disponibilidad && !error && <p role="status">Consultando disponibilidad…</p>}
    {error && <p className="form-error" role="alert">{error} <button className="cliente-link" type="button" onClick={reintentar}>Reintentar</button></p>}
  </>
}

function OpcionesFuncion({ funciones }: { funciones: Funcion[] }) {
  return <><option value="">Selecciona una función</option>{funciones.map(funcion => (
    <option key={funcion.idFuncion} value={funcion.idFuncion}>
      {funcion.nombreAtraccion} · {fechaFuncion(funcion)} · {horaFuncion(funcion)}
    </option>
  ))}</>
}

export function CompraCliente({ catalogo, combo, funcionInicial, bloqueado, onReservar }: {
  catalogo: CatalogoCliente; combo?: Combo; funcionInicial: number; bloqueado: boolean
  onReservar: (boletas: Seleccion[], idCombo?: number) => Promise<void>
}) {
  const [funcion, setFuncion] = useState(funcionInicial)
  const [lineas, setLineas] = useState(() => Array.from({ length: combo?.idsAtracciones.length ?? 1 }, lineaVacia))
  const nombreAtraccion = (id: number) => catalogo.atracciones.find(atraccion => atraccion.idAtraccion === id)?.nombre ?? `Atracción ${id}`
  const opcionesCombo = combo?.idsAtracciones.map(id => catalogo.funciones.filter(fn => fn.idAtraccion === id))
  const sinFunciones = opcionesCombo?.some(opciones => opciones.length === 0)
  const estimado = lineas.reduce((total, linea) => {
    const zona = catalogo.zonas.find(item => item.idZona === linea.zona)
    const tipo = catalogo.tipos.find(item => item.idTipoEntrada === linea.tipo)
    return total + (zona && tipo ? zona.precio * (1 - tipo.porcentajeDescuento / 100) * linea.cantidad : 0)
  }, 0)

  function editar(index: number, linea: Linea) {
    setLineas(actuales => actuales.map((actual, i) => i === index ? linea : actual))
  }

  if (!combo && catalogo.funciones.length === 0) return <p className="empty">No hay funciones disponibles para comprar.</p>
  if (combo && combo.idsAtracciones.length === 0) return <p className="empty">Este combo aún no tiene atracciones asociadas.</p>

  return <form onSubmit={event => {
    event.preventDefault()
    if (bloqueado) return
    const boletas = lineas.flatMap(linea => Array.from({ length: combo ? 1 : linea.cantidad }, () => ({
      idZona: linea.zona, idTipoEntrada: linea.tipo,
    })))
    void onReservar(boletas, combo?.idCombo)
  }}>
    <fieldset className="form-card cliente-compra" disabled={bloqueado}>
      <legend>{combo?.nombre ?? 'Selección de entradas'}</legend>
      {combo && <p>Precio base {moneda(combo.precio)} · Vigencia de {combo.diasVigencia} días. Selecciona una entrada por atracción.</p>}
      {!combo && <CampoCliente label="Función">
        <select required value={funcion || ''} onChange={e => {
          setFuncion(Number(e.target.value))
          setLineas([lineaVacia()])
        }}><OpcionesFuncion funciones={catalogo.funciones} /></select>
      </CampoCliente>}
      {lineas.map((linea, i) => (
        <div className="cliente-linea" key={i}>
          <h3>{combo ? nombreAtraccion(combo.idsAtracciones[i]) : `Entrada ${i + 1}`}</h3>
          {combo && <CampoCliente label="Función">
            <select required value={linea.funcion || ''} onChange={e => editar(i, { ...linea, funcion: Number(e.target.value), zona: 0 })}>
              <OpcionesFuncion funciones={opcionesCombo?.[i] ?? []} />
            </select>
          </CampoCliente>}
          <SeleccionarEntrada linea={combo ? linea : { ...linea, funcion }} catalogo={catalogo}
            onChange={valor => editar(i, valor)} esCombo={!!combo} />
          {!combo && lineas.length > 1 && <button type="button" className="cliente-link"
            onClick={() => setLineas(actuales => actuales.filter((_, index) => index !== i))}>Quitar selección</button>}
        </div>
      ))}
      {!combo && <button type="button" className="secondary" onClick={() => setLineas(actuales => [...actuales, lineaVacia()])}>
        Añadir otro tipo o zona
      </button>}
      {sinFunciones && <p className="form-error" role="status">Alguna atracción del combo todavía no tiene funciones disponibles.</p>}
      {!combo && <p><strong>Total estimado {moneda(estimado)}</strong></p>}
      <p className="cliente-detalle">El total definitivo y la disponibilidad se validan al crear la reserva.</p>
      <button className="primary" disabled={bloqueado || sinFunciones}>{bloqueado ? 'Creando reserva…' : 'Crear reserva'}</button>
    </fieldset>
  </form>
}

