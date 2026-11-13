'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import { ApiError } from '../lib/boleteria-api'
import { clienteApi, type Registro } from '../lib/cliente-api'

export function CampoCliente({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>
}

export function mensajeError(error: unknown, alternativo: string) {
  if (error instanceof ApiError && error.status === 401) return 'La sesión ya no está disponible. Vuelve a iniciar sesión.'
  return error instanceof Error ? error.message : alternativo
}

const campos: { nombre: keyof Registro; etiqueta: string; tipo: string; auto: string; max: number }[] = [
  { nombre: 'nombre', etiqueta: 'Nombre completo', tipo: 'text', auto: 'name', max: 150 },
  { nombre: 'documento', etiqueta: 'Documento de identidad', tipo: 'text', auto: 'off', max: 30 },
  { nombre: 'telefono', etiqueta: 'Teléfono', tipo: 'tel', auto: 'tel', max: 30 },
  { nombre: 'correo', etiqueta: 'Correo electrónico', tipo: 'email', auto: 'email', max: 150 },
  { nombre: 'clave', etiqueta: 'Contraseña', tipo: 'password', auto: 'new-password', max: 100 },
  { nombre: 'confirmacionClave', etiqueta: 'Confirmar contraseña', tipo: 'password', auto: 'new-password', max: 100 },
]

export function AccesoBoleteria({ onLogin }: { onLogin: (correo: string, clave: string) => Promise<void> }) {
  const [registro, setRegistro] = useState(false)
  const [correo, setCorreo] = useState('')
  const [error, setError] = useState('')
  const [confirmacion, setConfirmacion] = useState(false)
  const [cargando, setCargando] = useState(false)

  function cambiarFormulario(esRegistro: boolean) {
    setRegistro(esRegistro)
    setConfirmacion(false)
    setError('')
  }

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (cargando) return
    const datos = new FormData(event.currentTarget)
    const email = String(datos.get('correo')).trim()
    const clave = String(datos.get('clave'))
    setCargando(true)
    setError('')
    try {
      if (registro) {
        const alta: Registro = {
          nombre: String(datos.get('nombre')).trim(), documento: String(datos.get('documento')).trim(),
          telefono: String(datos.get('telefono')).trim(), correo: email, clave,
          confirmacionClave: String(datos.get('confirmacionClave')),
        }
        if (alta.clave !== alta.confirmacionClave) {
          setError('Las contraseñas no coinciden.')
          return
        }
        await clienteApi.registrar(alta)
        setCorreo(email)
        setRegistro(false)
        setConfirmacion(true)
      } else {
        await onLogin(email, clave)
      }
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 && !registro
        ? 'El correo o la contraseña son incorrectos.'
        : mensajeError(err, 'No se pudo completar la solicitud.'))
    } finally {
      setCargando(false)
    }
  }

  return (
    <main className={registro ? 'login-page registro-page' : 'login-page'}>
      <div className="login-brand">Boletería</div>
      <form key={registro ? 'registro' : 'login'} className="login-card" onSubmit={enviar}>
        <h1>{registro ? 'Crear cuenta' : 'Iniciar sesión'}</h1>
        <p>{registro ? 'Completa tus datos para comprar y consultar tus entradas.' : 'Ingrese con su correo y contraseña.'}</p>
        {confirmacion && <div className="cliente-aviso" role="status">Tu cuenta fue creada. Ya puedes iniciar sesión.</div>}
        {registro ? campos.map(campo => (
          <CampoCliente key={campo.nombre} label={campo.etiqueta}>
            <input name={campo.nombre} type={campo.tipo} autoComplete={campo.auto} maxLength={campo.max}
              minLength={campo.tipo === 'password' ? 6 : undefined}
              defaultValue={campo.nombre === 'correo' ? correo : undefined} required />
          </CampoCliente>
        )) : <>
          <CampoCliente label="Correo">
            <input name="correo" type="email" autoComplete="username" placeholder="correo@ejemplo.com" defaultValue={correo} required />
          </CampoCliente>
          <CampoCliente label="Contraseña">
            <input name="clave" type="password" autoComplete="current-password" placeholder="Contraseña" required />
          </CampoCliente>
        </>}
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="primary full" disabled={cargando}>
          {cargando ? 'Enviando…' : registro ? 'Crear cuenta' : 'Ingresar'}
        </button>
        <button type="button" className="link-button" disabled={cargando} onClick={() => cambiarFormulario(!registro)}>
          {registro ? 'Volver a iniciar sesión' : '¿No tienes una cuenta? Regístrate.'}
        </button>
      </form>
    </main>
  )
}

