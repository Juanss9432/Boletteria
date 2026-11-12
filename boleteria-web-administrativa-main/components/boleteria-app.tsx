'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronDown, FileDown, Menu, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { ReservationsModule, expirePendingSales, migrateSalesData, type Reservation, type Ticket } from './reservations-module'
import { NotificationsModule, createNotification, type Notification } from './notifications-module'
import { OccupancyReport } from './occupancy-report'
import { ReportsDashboard } from './reports-dashboard'
import { api, ApiError, loadBoleteriaData, loginBackend, type BackendUser } from '../lib/boleteria-api'

type Status = 'PROGRAMADA' | 'CANCELADA' | 'REALIZADA'
type View = 'login' | 'functions' | 'form' | 'reports' | 'municipios' | 'prestadorTypes' | 'ticketTypes' | 'roles' | 'prestadores' | 'planes' | 'atracciones' | 'combos' | 'usuarios' | 'clientes' | 'reservas' | 'boletas' | 'notificaciones' | 'catalogForm'
type CatalogKind = 'municipios' | 'prestadorTypes' | 'ticketTypes' | 'roles'
type CatalogRecord = { id: string; name: string; department?: string; discount?: number; requiresAdult?: boolean; isAdult?: boolean }
type Provider = { id: string; nit: string; name: string; email: string; municipalityId: string; typeId: string }
type Plan = { id: string; name: string; description: string; status: 'ACTIVO' | 'INACTIVO'; providerId: string }
type Attraction = { id: string; name: string; description: string; providerId: string }
type ComboItem = { attractionId: string; percentage: number }
type Combo = { id: string; name: string; price: number; validDays: number; status: 'ACTIVO' | 'INACTIVO'; attractions: ComboItem[] }
type Zone = { id?: string; name: string; capacity: number; price: number }
type EventFunction = { id: string; attractionId: string; date: string; status: Status; opening: string; closing: string; zones: Zone[] }
type SystemUser = { id: string; email: string; passwordHash?: string; status: 'ACTIVO' | 'INACTIVO'; roleId: string }
type Client = { id: string; document: string; name: string; phone: string; userId: string }

const initialCatalogs: Record<CatalogKind, CatalogRecord[]> = { municipios: ['Armenia', 'Montenegro', 'Calarcá', 'Salento', 'Filandia', 'Quimbaya'].map((name, i) => ({ id: `municipio-${i + 1}`, name, department: 'Quindío' })), prestadorTypes: ['Parque temático', 'Operador turístico', 'Parque natural', 'Organizador de eventos'].map((name, i) => ({ id: `prestador-${i + 1}`, name })), ticketTypes: ['General', 'Niño', 'Adulto mayor', 'Estudiante'].map((name, i) => ({ id: `ticket-${i + 1}`, name, discount: name === 'Niño' ? 20 : name === 'Adulto mayor' ? 15 : name === 'Estudiante' ? 10 : 0, requiresAdult: name === 'Niño' })), roles: ['Administrador', 'Operador'].map((name, i) => ({ id: `role-${i + 1}`, name })) }
const initialFunctions: EventFunction[] = [{ id: '1', attractionId: 'legacy-parque', date: '2026-11-07', status: 'PROGRAMADA', opening: '09:00', closing: '18:00', zones: [{ name: 'General', capacity: 300, price: 25000 }, { name: 'Preferencial', capacity: 100, price: 45000 }, { name: 'VIP', capacity: 40, price: 90000 }] }, { id: '2', attractionId: 'legacy-parque', date: '2026-11-08', status: 'PROGRAMADA', opening: '09:00', closing: '18:00', zones: [{ name: 'General', capacity: 300, price: 25000 }] }, { id: '3', attractionId: 'legacy-jardin', date: '2026-11-14', status: 'PROGRAMADA', opening: '08:00', closing: '16:00', zones: [{ name: 'General', capacity: 150, price: 20000 }] }]
const initialProviders: Provider[] = [{ id: 'provider-1', nit: '890001234-1', name: 'Parque del Café', email: 'contacto@parquedelcafe.co', municipalityId: 'municipio-1', typeId: 'prestador-1' }, { id: 'provider-2', nit: '890009876-2', name: 'Jardín Botánico del Quindío', email: 'info@jardinbotanicoquindio.org', municipalityId: 'municipio-2', typeId: 'prestador-3' }]
const initialAttractions: Attraction[] = [{ id: 'legacy-parque', name: 'Parque del Café', description: 'Parque temático y cultural del Quindío.', providerId: 'provider-1' }, { id: 'legacy-jardin', name: 'Jardín Botánico del Quindío', description: 'Naturaleza, senderos y conservación.', providerId: 'provider-2' }, { id: 'legacy-festival', name: 'Festival de la Cosecha', description: 'Evento cultural regional.', providerId: 'provider-1' }]
const initialPlans: Plan[] = [{ id: 'plan-1', name: 'Plan familiar', description: 'Entrada para grupos familiares.', status: 'ACTIVO', providerId: 'provider-1' }]
const initialCombos: Combo[] = [{ id: 'combo-1', name: 'Aventura Quindiana', price: 95000, validDays: 30, status: 'ACTIVO', attractions: [{ attractionId: 'legacy-parque', percentage: 60 }, { attractionId: 'legacy-jardin', percentage: 40 }] }]
const initialUsers: SystemUser[] = [{ id: 'user-1', email: 'admin@boleteria.co', status: 'ACTIVO', roleId: 'role-1' }, { id: 'user-2', email: 'operador@boleteria.co', status: 'ACTIVO', roleId: 'role-2' }]
const initialClients: Client[] = [{ id: 'client-1', document: '1094912345', name: 'María Fernanda López', phone: '3105551234', userId: 'user-2' }]
const labels: Record<CatalogKind, string> = { municipios: 'Municipios', prestadorTypes: 'Tipos de prestador', ticketTypes: 'Tipos de entrada', roles: 'Roles' }
const dateLabel = (v: string) => new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${v}T12:00:00`)).replace('.', '')
const money = (v: number) => new Intl.NumberFormat('es-CO').format(v)
const normalizeFunctions = (items: EventFunction[]) => items.map(fn => ({ ...fn, zones: fn.zones.map(zone => ({ ...zone, id: zone.id || `zone-${fn.id}-${zone.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` })) }))

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="field"><span>{label}</span>{children}</label> }
function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) { return <div className="select-wrap"><select value={value} onChange={e => onChange(e.target.value)}>{children}</select><ChevronDown size={17} /></div> }

function Sidebar({ view, onNavigate, currentUser }: { view: View; onNavigate: (view: View) => void; currentUser?: BackendUser | null }) { const groups: [string, [View, string][]][] = [['CATÁLOGOS', [['municipios', 'Municipios'], ['prestadorTypes', 'Tipos de prestador'], ['ticketTypes', 'Tipos de entrada'], ['roles', 'Roles']]], ['OFERTA', [['prestadores', 'Prestadores'], ['planes', 'Planes'], ['atracciones', 'Atracciones'], ['functions', 'Funciones'], ['combos', 'Combos']]], ['VENTAS', [['reservas', 'Reservas'], ['boletas', 'Boletas'], ['reports', 'Reportes']]], ['USUARIOS', [['usuarios', 'Usuarios del sistema'], ['clientes', 'Clientes']]], ['SISTEMA', [['notificaciones', 'Notificaciones']]]]; return <aside className="sidebar"><div className="sidebar-header"><div className="brand">Boletería</div></div><nav className="sidebar-nav" aria-label="Navegación principal">{groups.map(([title, links]) => <div className="nav-group" key={title}><div className="nav-label">{title}</div>{links.map(([key, text]) => <button key={key} className={view === key || (view === 'form' && key === 'functions') || view === 'catalogForm' && ['municipios', 'prestadorTypes', 'ticketTypes', 'roles'].includes(key) ? 'active' : ''} onClick={() => onNavigate(key)}>{text}</button>)}</div>)}</nav><footer className="sidebar-footer"><div className="role">{currentUser ? `${currentUser.correo} · ${currentUser.nombreRol}` : 'Sesión administrativa'}</div><button className="logout-button" onClick={() => onNavigate('login')}>Cerrar sesión</button></footer></aside> }
function Login({ onLogin }: { onLogin: (email: string, password: string) => Promise<void> }) { const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false); return <main className="login-page"><div className="login-brand">Boletería</div><form className="login-card" onSubmit={async e => { e.preventDefault(); if (!email.includes('@') || !password) return setError('Ingrese un correo y una contraseña válidos.'); setLoading(true); setError(''); try { await onLogin(email, password) } catch (err) { setError(err instanceof Error ? err.message : 'No fue posible iniciar sesión.') } finally { setLoading(false) } }}><h1>Iniciar sesión</h1><p>Ingrese con su correo y contraseña.</p><Field label="Correo"><input type="email" placeholder="correo@ejemplo.com" value={email} onChange={e => setEmail(e.target.value)} /></Field><Field label="Contraseña"><input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} /></Field>{error && <div className="form-error">{error}</div>}<button className="primary full" disabled={loading}>{loading ? 'Validando...' : 'Ingresar'}</button><button type="button" className="link-button">¿Olvidó su contraseña?</button></form></main> }
function ConfirmDelete({ title, detail, blocked, onCancel, onConfirm }: { title: string; detail: string; blocked?: boolean; onCancel: () => void; onConfirm: () => void }) { return <section className="delete-confirm"><div><p>CONFIRMAR ELIMINACIÓN</p><h2>{title}</h2><span>{blocked ? 'No se puede eliminar porque tiene registros relacionados.' : detail}</span></div><div className="confirm-actions"><button className="secondary" onClick={onCancel}>Cancelar</button><button className="destructive" disabled={blocked} onClick={onConfirm}>Eliminar</button></div></section> }

function CatalogList({ kind, items, onNew, onEdit, onDelete }: { kind: CatalogKind; items: CatalogRecord[]; onNew: () => void; onEdit: (x: CatalogRecord) => void; onDelete: (x: CatalogRecord) => void }) { const [search, setSearch] = useState(''); const rows = items.filter(x => `${x.name} ${x.department || ''}`.toLowerCase().includes(search.toLowerCase())); return <><Header title={labels[kind]} action={`Nuevo ${kind === 'municipios' ? 'municipio' : 'registro'}`} onAction={onNew} /><div className="catalog-search"><Field label="Buscar"><div className="input-icon"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." /><Search size={18} /></div></Field></div><div className="table-card"><table><thead><tr><th>Nombre</th>{kind === 'municipios' && <th>Departamento</th>}{kind === 'ticketTypes' && <><th>Descuento</th><th>Requiere adulto</th></>}<th>Acciones</th></tr></thead><tbody>{rows.map(x => <tr key={x.id}><td>{x.name}</td>{kind === 'municipios' && <td>{x.department}</td>}{kind === 'ticketTypes' && <><td>{x.discount}%</td><td>{x.requiresAdult ? 'Sí' : 'No'}</td></>}<td><div className="actions"><button onClick={() => onEdit(x)}><Pencil size={15} /> Editar</button><button className="danger-text" onClick={() => onDelete(x)}><Trash2 size={15} /> Eliminar</button></div></td></tr>)}</tbody></table></div></> }
function Header({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) { return <div className="page-heading"><div><p className="eyebrow">OFERTA TURÍSTICA</p><h1>{title}</h1></div>{action && <button className="primary" onClick={onAction}><Plus size={18} /> {action}</button>}</div> }

function CatalogForm({ kind, editing, items, onSave, onCancel }: { kind: CatalogKind; editing: CatalogRecord | null; items: CatalogRecord[]; onSave: (x: CatalogRecord) => void; onCancel: () => void }) { const [name, setName] = useState(editing?.name || ''); const [department, setDepartment] = useState(editing?.department || ''); const [discount, setDiscount] = useState(String(editing?.discount ?? 0)); const [requiresAdult, setRequiresAdult] = useState(editing?.requiresAdult ?? false); const [isAdult, setIsAdult] = useState(editing?.isAdult ?? false); const [error, setError] = useState(''); function save(e: React.FormEvent) { e.preventDefault(); if (!name.trim() || kind === 'municipios' && !department.trim()) return setError('Completa los campos obligatorios.'); if (kind === 'ticketTypes' && (Number(discount) < 0 || Number(discount) > 100)) return setError('El descuento debe estar entre 0 y 100.'); if (items.some(x => x.name.toLowerCase() === name.trim().toLowerCase() && x.id !== editing?.id)) return setError('Ya existe un registro con ese nombre.'); onSave({ id: editing?.id || `${kind}-${Date.now()}`, name: name.trim(), ...(kind === 'municipios' ? { department } : {}), ...(kind === 'ticketTypes' ? { discount: Number(discount), requiresAdult, isAdult } : {}) }) } return <form onSubmit={save}><Header title={`${editing ? 'Editar' : 'Nuevo'} ${labels[kind].slice(0, -1).toLowerCase()}`} /><section className="form-card"><Field label="Nombre"><input autoFocus value={name} onChange={e => setName(e.target.value)} /></Field>{kind === 'municipios' && <Field label="Departamento"><input value={department} onChange={e => setDepartment(e.target.value)} /></Field>}{kind === 'ticketTypes' && <div className="form-grid two"><Field label="Descuento (%)"><input type="number" min="0" max="100" value={discount} onChange={e => setDiscount(e.target.value)} /></Field><Field label="Requiere adulto"><Select value={requiresAdult ? 'Sí' : 'No'} onChange={v => setRequiresAdult(v === 'Sí')}><option>Sí</option><option>No</option></Select></Field><Field label="Es entrada de adulto"><Select value={isAdult ? 'Sí' : 'No'} onChange={v => setIsAdult(v === 'Sí')}><option>Sí</option><option>No</option></Select></Field></div>}</section>{error && <div className="form-error form-error-wide">{error}</div>}<div className="form-actions"><button className="primary">Guardar</button><button type="button" className="secondary" onClick={onCancel}>Cancelar</button></div></form> }

function ProviderPage({ items, municipalities, types, blocked, onSave, onDelete }: { items: Provider[]; municipalities: CatalogRecord[]; types: CatalogRecord[]; blocked?: (x: Provider) => boolean; onSave: (x: Provider) => void; onDelete: (x: Provider) => void }) { const [editing, setEditing] = useState<Provider | null>(null); const [search, setSearch] = useState(''); const [error, setError] = useState(''); const [deleting, setDeleting] = useState<Provider | null>(null); const rows = items.filter(x => `${x.nit} ${x.name} ${x.email}`.toLowerCase().includes(search.toLowerCase())); if (editing) return <ProviderForm editing={editing.id ? editing : null} municipalities={municipalities} types={types} items={items} onCancel={() => setEditing(null)} onSave={x => { onSave(x); setEditing(null) }} />; return <><Header title="Prestadores" action="Nuevo prestador" onAction={() => setEditing({ id: '', nit: '', name: '', email: '', municipalityId: municipalities[0]?.id || '', typeId: types[0]?.id || '' })} /><div className="catalog-search"><Field label="Buscar"><div className="input-icon"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por NIT, nombre o correo..." /><Search size={18} /></div></Field></div><div className="table-card"><table><thead><tr><th>NIT</th><th>Nombre</th><th>Correo</th><th>Municipio</th><th>Tipo</th><th>Acciones</th></tr></thead><tbody>{rows.map(x => <tr key={x.id}><td>{x.nit}</td><td>{x.name}</td><td>{x.email}</td><td>{municipalities.find(m => m.id === x.municipalityId)?.name}</td><td>{types.find(t => t.id === x.typeId)?.name}</td><td><div className="actions"><button onClick={() => setEditing(x)}><Pencil size={15} /> Editar</button><button className="danger-text" onClick={() => setDeleting(x)}><Trash2 size={15} /> Eliminar</button></div></td></tr>)}</tbody></table></div>{deleting && <ConfirmDelete title={`¿Eliminar ${deleting.name}?`} detail="Esta acción no se puede deshacer." blocked={blocked?.(deleting)} onCancel={() => setDeleting(null)} onConfirm={() => { onDelete(deleting); setDeleting(null) }} />}{error && <div className="form-error">{error}</div>}</> }
function ProviderForm({ editing, items, municipalities, types, onSave, onCancel }: { editing: Provider | null; items: Provider[]; municipalities: CatalogRecord[]; types: CatalogRecord[]; onSave: (x: Provider) => void; onCancel: () => void }) { const [form, setForm] = useState<Provider>(editing || { id: '', nit: '', name: '', email: '', municipalityId: '', typeId: '' }); const [error, setError] = useState(''); function save(e: React.FormEvent) { e.preventDefault(); if (!form.nit || !form.name || !form.email || !form.municipalityId || !form.typeId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError('NIT, nombre, correo, municipio y tipo son obligatorios; usa un correo válido.'); if (items.some(x => x.nit === form.nit && x.id !== form.id)) return setError('El NIT debe ser único.'); onSave({ ...form, id: form.id || `provider-${Date.now()}` }) } return <form onSubmit={save}><Header title={`${editing?.id ? 'Editar' : 'Nuevo'} prestador`} /><section className="form-card"><div className="form-grid two"><Field label="NIT"><input value={form.nit} onChange={e => setForm({ ...form, nit: e.target.value })} /></Field><Field label="Nombre"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field><Field label="Correo electrónico"><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field><Field label="Municipio"><Select value={form.municipalityId} onChange={v => setForm({ ...form, municipalityId: v })}>{municipalities.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field><Field label="Tipo de prestador"><Select value={form.typeId} onChange={v => setForm({ ...form, typeId: v })}>{types.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field></div></section>{error && <div className="form-error form-error-wide">{error}</div>}<div className="form-actions"><button className="primary">Guardar prestador</button><button type="button" className="secondary" onClick={onCancel}>Cancelar</button></div></form> }

function SimpleEntityPage({ kind, items, providers, blocked, onSave, onDelete }: { kind: 'planes' | 'atracciones'; items: Plan[] | Attraction[]; providers: Provider[]; blocked?: (x: Plan | Attraction) => boolean; onSave: (x: Plan | Attraction) => void; onDelete: (x: Plan | Attraction) => void }) { const [editing, setEditing] = useState<Plan | Attraction | null>(null); const [deleting, setDeleting] = useState<Plan | Attraction | null>(null); const [search, setSearch] = useState(''); const isPlan = kind === 'planes'; const rows = items.filter(x => x.name.toLowerCase().includes(search.toLowerCase())); if (editing) return <SimpleForm kind={kind} editing={editing} providers={providers} items={items} onSave={x => { onSave(x); setEditing(null) }} onCancel={() => setEditing(null)} />; return <><Header title={isPlan ? 'Planes' : 'Atracciones'} action={`Nueva ${isPlan ? 'plan' : 'atracción'}`} onAction={() => setEditing(isPlan ? { id: '', name: '', description: '', status: 'ACTIVO', providerId: providers[0]?.id || '' } : { id: '', name: '', description: '', providerId: providers[0]?.id || '' })} /><div className="catalog-search"><Field label="Buscar"><div className="input-icon"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." /><Search size={18} /></div></Field></div><div className="table-card"><table><thead><tr><th>Nombre</th><th>Descripción</th><th>Prestador</th>{isPlan && <th>Estado</th>}<th>Acciones</th></tr></thead><tbody>{rows.map(x => <tr key={x.id}><td>{x.name}</td><td>{x.description}</td><td>{providers.find(p => p.id === x.providerId)?.name}</td>{isPlan && <td><span className={`status ${(x as Plan).status.toLowerCase()}`}>{(x as Plan).status}</span></td>}<td><div className="actions"><button onClick={() => setEditing(x)}><Pencil size={15} /> Editar</button><button className="danger-text" onClick={() => setDeleting(x)}><Trash2 size={15} /> Eliminar</button></div></td></tr>)}</tbody></table></div>{deleting && <ConfirmDelete title={`¿Eliminar ${deleting.name}?`} detail="Esta acción no se puede deshacer." blocked={blocked?.(deleting)} onCancel={() => setDeleting(null)} onConfirm={() => { onDelete(deleting); setDeleting(null) }} />}</> }
function SimpleForm({ kind, editing, providers, items, onSave, onCancel }: { kind: 'planes' | 'atracciones'; editing: Plan | Attraction; providers: Provider[]; items: (Plan | Attraction)[]; onSave: (x: Plan | Attraction) => void; onCancel: () => void }) { const isPlan = kind === 'planes'; const [form, setForm] = useState<Plan | Attraction>(editing); const [error, setError] = useState(''); function save(e: React.FormEvent) { e.preventDefault(); if (!form.name.trim() || !form.description.trim() || !form.providerId || isPlan && !(form as Plan).status) return setError('Completa los campos obligatorios.'); if (items.some(x => x.name.toLowerCase() === form.name.trim().toLowerCase() && x.id !== form.id)) return setError('Ya existe un registro con ese nombre.'); onSave({ ...form, name: form.name.trim() }) } return <form onSubmit={save}><Header title={`${editing.id ? 'Editar' : 'Nuevo'} ${isPlan ? 'plan' : 'atracción'}`} /><section className="form-card"><Field label="Nombre"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field><Field label="Descripción"><textarea className="textarea" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></Field><Field label="Prestador"><Select value={form.providerId} onChange={v => setForm({ ...form, providerId: v })}>{providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>{isPlan && <Field label="Estado"><Select value={(form as Plan).status} onChange={v => setForm({ ...form as Plan, status: v as Plan['status'] })}><option>ACTIVO</option><option>INACTIVO</option></Select></Field>}</section>{error && <div className="form-error form-error-wide">{error}</div>}<div className="form-actions"><button className="primary">Guardar</button><button type="button" className="secondary" onClick={onCancel}>Cancelar</button></div></form> }

function ComboPage({ items, attractions, blocked, onSave, onDelete }: { items: Combo[]; attractions: Attraction[]; blocked?: (x: Combo) => boolean; onSave: (x: Combo) => void; onDelete: (x: Combo) => void }) { const [editing, setEditing] = useState<Combo | null>(null); const [deleting, setDeleting] = useState<Combo | null>(null); if (editing) return <ComboForm editing={editing} attractions={attractions} items={items} onSave={x => { onSave(x); setEditing(null) }} onCancel={() => setEditing(null)} />; return <><Header title="Combos" action="Nuevo combo" onAction={() => setEditing({ id: '', name: '', price: 0, validDays: 1, status: 'ACTIVO', attractions: [] })} /><div className="table-card"><table><thead><tr><th>Nombre</th><th>Precio (COP)</th><th>Vigencia</th><th>Estado</th><th>Atracciones</th><th>Acciones</th></tr></thead><tbody>{items.map(x => <tr key={x.id}><td>{x.name}</td><td>${money(x.price)}</td><td>{x.validDays} días</td><td><span className={`status ${x.status.toLowerCase()}`}>{x.status}</span></td><td>{x.attractions.length}</td><td><div className="actions"><button onClick={() => setEditing(x)}><Pencil size={15} /> Editar</button><button className="danger-text" onClick={() => setDeleting(x)}><Trash2 size={15} /> Eliminar</button></div></td></tr>)}</tbody></table></div>{deleting && <ConfirmDelete title={`¿Eliminar ${deleting.name}?`} detail="Esta acción no se puede deshacer." blocked={blocked?.(deleting)} onCancel={() => setDeleting(null)} onConfirm={() => { onDelete(deleting); setDeleting(null) }} />}</> }
function ComboForm({ editing, attractions, items, onSave, onCancel }: { editing: Combo; attractions: Attraction[]; items: Combo[]; onSave: (x: Combo) => void; onCancel: () => void }) { const [form, setForm] = useState(editing); const [error, setError] = useState(''); const total = form.attractions.reduce((sum, x) => sum + Number(x.percentage || 0), 0); function save(e: React.FormEvent) { e.preventDefault(); if (!form.name.trim() || form.price <= 0 || form.validDays <= 0 || form.attractions.length === 0 || form.attractions.some(x => Number(x.percentage) < 1 || Number(x.percentage) > 100) || total !== 100) return setError('Completa los campos y verifica que los porcentajes sumen exactamente 100 %.'); if (new Set(form.attractions.map(x => x.attractionId)).size !== form.attractions.length) return setError('No puedes repetir atracciones en el combo.'); if (items.some(x => x.name.toLowerCase() === form.name.trim().toLowerCase() && x.id !== form.id)) return setError('Ya existe un combo con ese nombre.'); onSave({ ...form, id: form.id || `combo-${Date.now()}`, name: form.name.trim() }) } return <form onSubmit={save}><Header title={`${editing.id ? 'Editar' : 'Nuevo'} combo`} /><section className="form-card"><div className="form-grid two"><Field label="Nombre"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field><Field label="Precio (COP)"><input type="number" value={form.price} onChange={e => setForm({ ...form, price: Number(e.target.value) })} /></Field><Field label="Días de vigencia"><input type="number" min="1" value={form.validDays} onChange={e => setForm({ ...form, validDays: Number(e.target.value) })} /></Field><Field label="Estado"><Select value={form.status} onChange={v => setForm({ ...form, status: v as Combo['status'] })}><option>ACTIVO</option><option>INACTIVO</option></Select></Field></div></section><section className="form-card"><div className="section-title"><h2>Atracciones del combo</h2><p>La suma de los porcentajes debe ser exactamente 100 %.</p></div><div className="zone-head"><span>Atracción</span><span>Porcentaje del precio</span><span /><span /></div>{form.attractions.map((item, index) => <div className="zone-row combo-row" key={index}><Select value={item.attractionId} onChange={v => setForm({ ...form, attractions: form.attractions.map((x, i) => i === index ? { ...x, attractionId: v } : x) })}>{attractions.filter(a => !form.attractions.some((x, i) => i !== index && x.attractionId === a.id)).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</Select><input type="number" min="1" max="100" value={item.percentage} onChange={e => setForm({ ...form, attractions: form.attractions.map((x, i) => i === index ? { ...x, percentage: Number(e.target.value) } : x) })} /><span>%</span><button type="button" className="danger-text" onClick={() => setForm({ ...form, attractions: form.attractions.filter((_, i) => i !== index) })}>Quitar</button></div>)}<button type="button" className="secondary add-zone" onClick={() => { const available = attractions.find(a => !form.attractions.some(x => x.attractionId === a.id)); if (available) setForm({ ...form, attractions: [...form.attractions, { attractionId: available.id, percentage: 0 }] }) }}> <Plus size={16} /> Agregar atracción</button><div className={total === 100 ? 'combo-total valid' : 'combo-total'}>Total: {total} %</div></section>{error && <div className="form-error form-error-wide">{error}</div>}<div className="form-actions"><button className="primary">Guardar combo</button><button type="button" className="secondary" onClick={onCancel}>Cancelar</button></div></form> }

function Functions({ items, attractions, tickets, onSave, onCancelFunction }: { items: EventFunction[]; attractions: Attraction[]; tickets: Ticket[]; onSave: (x: EventFunction) => void; onCancelFunction: (x: EventFunction) => void }) { const [editing, setEditing] = useState<EventFunction | null>(null); const names = new Map([...attractions.map(a => [a.id, a.name] as const), ['legacy-parque', 'Parque del Café'] as const, ['legacy-jardin', 'Jardín Botánico del Quindío'] as const]); if (editing) return <FunctionForm items={items} tickets={tickets} editing={editing} attractions={[...attractions, { id: 'legacy-parque', name: 'Parque del Café', description: '', providerId: '' }, { id: 'legacy-jardin', name: 'Jardín Botánico del Quindío', description: '', providerId: '' }]} onCancel={() => setEditing(null)} onSave={x => { onSave(x); setEditing(null) }} />; return <><Header title="Funciones" action="Nueva función" onAction={() => setEditing({ id: '', attractionId: attractions[0]?.id || 'legacy-parque', date: '', status: 'PROGRAMADA', opening: '09:00', closing: '18:00', zones: [{ name: 'General', capacity: 100, price: 25000 }] })} /><div className="table-card"><table><thead><tr><th>Atracción</th><th>Fecha</th><th>Apertura</th><th>Cierre</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{items.map(x => <tr key={x.id}><td>{names.get(x.attractionId)}</td><td>{dateLabel(x.date)}</td><td>{x.opening}</td><td>{x.closing}</td><td><span className={`status ${x.status.toLowerCase()}`}>{x.status}</span></td><td><button onClick={() => setEditing(x)}><Pencil size={15} /> Editar</button>{x.status === 'PROGRAMADA' && <button className="danger-text" onClick={() => onCancelFunction(x)}><X size={15} /> Cancelar función</button>}</td></tr>)}</tbody></table></div></> }
function FunctionForm({ items, tickets, editing, attractions, onSave, onCancel }: { items: EventFunction[]; tickets: Ticket[]; editing: EventFunction; attractions: Attraction[]; onSave: (x: EventFunction) => void; onCancel: () => void }) { const [form, setForm] = useState(editing); const [error, setError] = useState(''); const stableZoneId = (zone: Zone) => zone.id || `zone-${form.id}-${zone.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`; const activeFor = (zone: Zone) => { const id = stableZoneId(zone); return tickets.filter(t => (t.status === 'VENDIDA' || t.status === 'USADA') && t.zoneId === id).length }; const hasAnyTicket = (zone: Zone) => { const id = stableZoneId(zone); return tickets.some(t => t.zoneId === id) }; const updateZone = (index: number, patch: Partial<Zone>) => setForm({ ...form, zones: form.zones.map((zone, i) => i === index ? { ...zone, ...patch } : zone) }); const removeZone = (index: number) => { const zone = form.zones[index]; if (hasAnyTicket(zone)) return setError('No se puede eliminar: la zona tiene boletas asociadas, incluso anuladas.'); setForm({ ...form, zones: form.zones.filter((_, i) => i !== index) }) }; return <form onSubmit={e => { e.preventDefault(); if (!form.attractionId || !form.date || form.closing <= form.opening) return setError('Completa los campos y verifica las horas.'); if (!form.zones.length || form.zones.some(z => !z.name.trim() || !Number.isInteger(Number(z.capacity)) || Number(z.capacity) <= 0 || Number(z.price) <= 0)) return setError('Cada zona debe tener nombre, aforo entero mayor que cero y precio mayor que cero.'); if (new Set(form.zones.map(z => z.name.trim().toLowerCase())).size !== form.zones.length) return setError('El nombre de zona debe ser único dentro de la función.'); if (form.zones.some(z => Number(z.capacity) < activeFor(z))) return setError('No se puede reducir el aforo por debajo de las boletas activas.'); const overlap = items.some(item => item.id !== form.id && item.attractionId === form.attractionId && item.date === form.date && item.status !== 'CANCELADA' && form.opening < item.closing && form.closing > item.opening); if (overlap) return setError('Las funciones de esta atracción se cruzan en horario.'); onSave({ ...form, id: form.id || `function-${Date.now()}`, zones: form.zones.map(z => ({ ...z, name: z.name.trim(), id: z.id || `zone-${form.id || `function-${Date.now()}`}-${z.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` })) }) }}><Header title={`${editing.id ? 'Editar' : 'Nueva'} función`} /><section className="form-card"><Field label="Atracción"><Select value={form.attractionId} onChange={v => setForm({ ...form, attractionId: v })}>{attractions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field><div className="form-grid two"><Field label="Fecha"><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></Field><Field label="Estado"><Select value={form.status} onChange={v => setForm({ ...form, status: v as Status })}><option>PROGRAMADA</option><option>CANCELADA</option><option>REALIZADA</option></Select></Field><Field label="Hora de apertura"><input type="time" value={form.opening} onChange={e => setForm({ ...form, opening: e.target.value })} /></Field><Field label="Hora de cierre"><input type="time" value={form.closing} onChange={e => setForm({ ...form, closing: e.target.value })} /></Field></div></section><section className="form-card"><div className="section-title"><h2>Zonas de la función</h2><p>Cada zona tiene su propio aforo y precio.</p></div><div className="zone-head"><span>Nombre</span><span>Aforo</span><span>Precio (COP)</span><span>Acción</span></div>{form.zones.map((zone, index) => <div className="zone-row" key={zone.id || `${zone.name}-${index}`}><input value={zone.name} onChange={e => updateZone(index, { name: e.target.value })} /><input type="number" min="1" step="1" value={zone.capacity} onChange={e => updateZone(index, { capacity: Number(e.target.value) })} /><input type="number" min="1" value={zone.price} onChange={e => updateZone(index, { price: Number(e.target.value) })} /><button type="button" className="danger-text" onClick={() => removeZone(index)}>Quitar</button></div>)}<button type="button" className="secondary add-zone" onClick={() => setForm({ ...form, zones: [...form.zones, { name: '', capacity: 1, price: 1 }] })}><Plus size={16} /> Agregar zona</button></section>{error && <div className="form-error form-error-wide">{error}</div>}<div className="form-actions"><button className="primary">Guardar función</button><button type="button" className="secondary" onClick={onCancel}>Cancelar</button></div></form> }

function UsersPage({ users, roles, clients, onSave, onDelete }: { users: SystemUser[]; roles: CatalogRecord[]; clients: Client[]; onSave: (x: SystemUser) => void; onDelete: (x: SystemUser) => void }) { const [editing, setEditing] = useState<SystemUser | null>(null); const [deleting, setDeleting] = useState<SystemUser | null>(null); const [search, setSearch] = useState(''); const [role, setRole] = useState('TODOS'); const [status, setStatus] = useState('TODOS'); const rows = users.filter(u => u.email.toLowerCase().includes(search.toLowerCase()) && (role === 'TODOS' || u.roleId === role) && (status === 'TODOS' || u.status === status)); if (editing) return <UserForm editing={editing.id ? editing : null} users={users} roles={roles} onCancel={() => setEditing(null)} onSave={x => { onSave(x); setEditing(null) }} />; return <><Header title="Usuarios del sistema" action="Nuevo usuario" onAction={() => setEditing({ id: '', email: '', status: 'ACTIVO', roleId: roles[0]?.id || '' })} /><div className="filters three"><Field label="Buscar por correo"><div className="input-icon"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="correo@ejemplo.com" /><Search size={18} /></div></Field><Field label="Rol"><Select value={role} onChange={setRole}><option value="TODOS">Todos</option>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</Select></Field><Field label="Estado"><Select value={status} onChange={setStatus}><option>TODOS</option><option>ACTIVO</option><option>INACTIVO</option></Select></Field></div><div className="table-card"><table><thead><tr><th>Correo</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{rows.map(u => <tr key={u.id}><td>{u.email}</td><td>{roles.find(r => r.id === u.roleId)?.name || 'Sin rol'}</td><td><span className={`status ${u.status.toLowerCase()}`}>{u.status}</span></td><td><div className="actions"><button onClick={() => setEditing(u)}><Pencil size={15} /> Editar</button><button className="danger-text" onClick={() => setDeleting(u)}><Trash2 size={15} /> Eliminar</button></div></td></tr>)}</tbody></table></div>{deleting && <ConfirmDelete title={`¿Eliminar ${deleting.email}?`} detail="Esta acción no se puede deshacer." blocked={clients.some(c => c.userId === deleting.id)} onCancel={() => setDeleting(null)} onConfirm={() => { onDelete(deleting); setDeleting(null) }} />}</> }
function UserForm({ editing, users, roles, onSave, onCancel }: { editing: SystemUser | null; users: SystemUser[]; roles: CatalogRecord[]; onSave: (x: SystemUser) => void; onCancel: () => void }) { const [form, setForm] = useState<SystemUser>(editing || { id: '', email: '', status: 'ACTIVO', roleId: roles[0]?.id || '' }); const [password, setPassword] = useState(''); const [error, setError] = useState(''); function save(e: React.FormEvent) { e.preventDefault(); if (!form.email || !form.roleId || (!editing && password.length < 6) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError(editing ? 'Completa un correo válido y selecciona un rol.' : 'La contraseña es obligatoria y debe tener al menos 6 caracteres.'); if (users.some(u => u.email.toLowerCase() === form.email.toLowerCase() && u.id !== form.id)) return setError('El correo electrónico debe ser único.'); onSave({ ...form, id: form.id || `user-${Date.now()}`, ...(password ? { passwordHash: password } : {}) }) } return <form onSubmit={save}><Header title={`${editing ? 'Editar' : 'Nuevo'} usuario`} /><section className="form-card"><div className="form-grid two"><Field label="Correo electrónico"><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field><Field label="Contraseña"><input type="password" value={password} onChange={e => setPassword(e.target.value)} disabled={Boolean(editing)} placeholder={editing ? 'No editable desde este endpoint' : 'Contraseña'} /><small>{editing ? 'El backend actual no expone cambio de contraseña en la actualización.' : 'La contraseña se envía al backend y se almacena con BCrypt.'}</small></Field><Field label="Estado"><Select value={form.status} onChange={v => setForm({ ...form, status: v as SystemUser['status'] })}><option>ACTIVO</option><option>INACTIVO</option></Select></Field><Field label="Rol"><Select value={form.roleId} onChange={v => setForm({ ...form, roleId: v })}>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</Select></Field></div></section>{error && <div className="form-error form-error-wide">{error}</div>}<div className="form-actions"><button className="primary">Guardar usuario</button><button type="button" className="secondary" onClick={onCancel}>Cancelar</button></div></form> }
function ClientsPage({ clients, users, onSave, onDelete }: { clients: Client[]; users: SystemUser[]; onSave: (x: Client) => void; onDelete: (x: Client) => void }) { const [editing, setEditing] = useState<Client | null>(null); const [deleting, setDeleting] = useState<Client | null>(null); const [search, setSearch] = useState(''); const rows = clients.filter(c => `${c.name} ${c.document}`.toLowerCase().includes(search.toLowerCase())); if (editing) return <ClientForm editing={editing.id ? editing : null} clients={clients} users={users} onCancel={() => setEditing(null)} onSave={x => { onSave(x); setEditing(null) }} />; return <><Header title="Clientes" action="Nuevo cliente" onAction={() => setEditing({ id: '', document: '', name: '', phone: '', userId: users[0]?.id || '' })} /><div className="catalog-search"><Field label="Buscar por nombre o documento"><div className="input-icon"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente..." /><Search size={18} /></div></Field></div><div className="table-card"><table><thead><tr><th>Documento</th><th>Nombre</th><th>Teléfono</th><th>Usuario</th><th>Acciones</th></tr></thead><tbody>{rows.map(c => <tr key={c.id}><td>{c.document}</td><td>{c.name}</td><td>{c.phone || '—'}</td><td>{users.find(u => u.id === c.userId)?.email || 'Sin usuario'}</td><td><div className="actions"><button onClick={() => setEditing(c)}><Pencil size={15} /> Editar</button><button className="danger-text" onClick={() => setDeleting(c)}><Trash2 size={15} /> Eliminar</button></div></td></tr>)}</tbody></table></div>{deleting && <ConfirmDelete title={`¿Eliminar a ${deleting.name}?`} detail="Esta acción no se puede deshacer." onCancel={() => setDeleting(null)} onConfirm={() => { onDelete(deleting); setDeleting(null) }} />}</> }
function ClientForm({ editing, clients, users, onSave, onCancel }: { editing: Client | null; clients: Client[]; users: SystemUser[]; onSave: (x: Client) => void; onCancel: () => void }) { const [form, setForm] = useState<Client>(editing || { id: '', document: '', name: '', phone: '', userId: users[0]?.id || '' }); const [error, setError] = useState(''); function save(e: React.FormEvent) { e.preventDefault(); if (!form.document || !form.name || !form.userId) return setError('Documento, nombre y usuario asociado son obligatorios.'); if (clients.some(c => c.document === form.document && c.id !== form.id)) return setError('El documento debe ser único.'); if (clients.some(c => c.userId === form.userId && c.id !== form.id)) return setError('Cada usuario solo puede tener un perfil de cliente.'); if (!users.some(u => u.id === form.userId)) return setError('Selecciona un usuario existente.'); onSave({ ...form, id: form.id || `client-${Date.now()}` }) } return <form onSubmit={save}><Header title={`${editing ? 'Editar' : 'Nuevo'} cliente`} /><section className="form-card"><div className="form-grid two"><Field label="Documento"><input value={form.document} onChange={e => setForm({ ...form, document: e.target.value })} /></Field><Field label="Nombre"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field><Field label="Teléfono"><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></Field><Field label="Usuario asociado"><Select value={form.userId} onChange={v => setForm({ ...form, userId: v })}>{users.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}</Select></Field></div></section>{error && <div className="form-error form-error-wide">{error}</div>}<div className="form-actions"><button className="primary">Guardar cliente</button><button type="button" className="secondary" onClick={onCancel}>Cancelar</button></div></form> }

export function BoleteriaApp() {
  const [view, setView] = useState<View>('login')
  const [mobile, setMobile] = useState(false)
  const [currentUser, setCurrentUser] = useState<BackendUser | null>(null)
  const [catalogs, setCatalogs] = useState(initialCatalogs)
  const [providers, setProviders] = useState(initialProviders)
  const [plans, setPlans] = useState(initialPlans)
  const [attractions, setAttractions] = useState(initialAttractions)
  const [combos, setCombos] = useState(initialCombos)
  const [functions, setFunctions] = useState(initialFunctions)
  const [users, setUsers] = useState<SystemUser[]>(initialUsers)
  const [clients, setClients] = useState<Client[]>(initialClients)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [catalogEditing, setCatalogEditing] = useState<CatalogRecord | null>(null)
  const [catalogKind, setCatalogKind] = useState<CatalogKind>('municipios')

  const applyData = (data: Awaited<ReturnType<typeof loadBoleteriaData>>) => {
    setCatalogs(data.catalogs as Record<CatalogKind, CatalogRecord[]>)
    setProviders(data.providers as Provider[])
    setPlans(data.plans as Plan[])
    setAttractions(data.attractions as Attraction[])
    setCombos(data.combos as Combo[])
    setFunctions(normalizeFunctions(data.functions as EventFunction[]))
    setUsers(data.users as SystemUser[])
    setClients(data.clients as Client[])
    setReservations(data.reservations as Reservation[])
    setTickets(data.tickets as Ticket[])
    setNotifications(data.notifications as Notification[])
  }

  const refresh = async () => applyData(await loadBoleteriaData())
  const showError = (error: unknown) => {
    const message = error instanceof ApiError ? `${error.message} (HTTP ${error.status})` : error instanceof Error ? error.message : 'Ocurrió un error inesperado.'
    window.alert(message)
  }
  const execute = (action: () => Promise<unknown>) => {
    void action().then(refresh).catch(async error => { showError(error); try { await refresh() } catch { /* backend no disponible */ } })
  }

  useEffect(() => {
    void refresh().catch(() => { /* el login mostrará el error si el backend sigue apagado */ })
    const saved = sessionStorage.getItem('boleteria-auth-user')
    if (saved) {
      try { setCurrentUser(JSON.parse(saved)); setView('functions') } catch { sessionStorage.removeItem('boleteria-auth-user') }
    }
  }, [])

  const login = async (email: string, password: string) => {
    const user = await loginBackend(email, password)
    if (String(user.estado).toUpperCase() !== 'ACTIVO') throw new Error('El usuario está inactivo.')
    setCurrentUser(user)
    sessionStorage.setItem('boleteria-auth-user', JSON.stringify(user))
    await refresh()
    setView('functions')
  }

  const nav = (v: View) => {
    if (v === 'login') {
      sessionStorage.removeItem('boleteria-auth-user')
      setCurrentUser(null)
    }
    if (['municipios', 'prestadorTypes', 'ticketTypes', 'roles'].includes(v)) {
      setCatalogKind(v as CatalogKind)
      setCatalogEditing(null)
    }
    setView(v)
    setMobile(false)
  }

  const catalogEndpoint: Record<CatalogKind, string> = { municipios: '/municipios', prestadorTypes: '/tipos-prestador', ticketTypes: '/tipos-entrada', roles: '/roles' }
  const catalogPayload = (kind: CatalogKind, x: CatalogRecord) => kind === 'municipios'
    ? { nombre: x.name, departamento: x.department }
    : kind === 'ticketTypes'
      ? { nombre: x.name, porcentajeDescuento: x.discount ?? 0, requiereAdulto: Boolean(x.requiresAdult), esAdulto: Boolean(x.isAdult) }
      : { nombre: x.name }
  const saveCatalog = (kind: CatalogKind, x: CatalogRecord) => {
    const exists = catalogs[kind].some(y => y.id === x.id)
    execute(() => exists ? api.put(`${catalogEndpoint[kind]}/${x.id}`, catalogPayload(kind, x)) : api.post(catalogEndpoint[kind], catalogPayload(kind, x)))
    setView(kind)
  }
  const deleteCatalog = (kind: CatalogKind, x: CatalogRecord) => execute(() => api.delete(`${catalogEndpoint[kind]}/${x.id}`))

  const saveProvider = (x: Provider) => {
    const body = { nit: x.nit, nombre: x.name, correo: x.email, idMunicipio: Number(x.municipalityId), idTipoPrestador: Number(x.typeId) }
    execute(() => providers.some(y => y.id === x.id) ? api.put(`/prestadores/${x.id}`, body) : api.post('/prestadores', body))
  }
  const savePlan = (x: Plan) => {
    const body = { nombre: x.name, descripcion: x.description, estado: x.status, idPrestador: Number(x.providerId) }
    execute(() => plans.some(y => y.id === x.id) ? api.put(`/planes/${x.id}`, body) : api.post('/planes', body))
  }
  const saveAttraction = (x: Attraction) => {
    const body = { nombre: x.name, descripcion: x.description, idPrestador: Number(x.providerId) }
    execute(() => attractions.some(y => y.id === x.id) ? api.put(`/atracciones/${x.id}`, body) : api.post('/atracciones', body))
  }
  const saveCombo = (x: Combo) => execute(async () => {
    const reparto = x.attractions.map(a => ({ idAtraccion: Number(a.attractionId), porcentajePrecio: a.percentage }))
    if (combos.some(y => y.id === x.id)) {
      await api.put(`/combos/${x.id}`, { nombre: x.name, precio: x.price, diasVigencia: x.validDays, estado: x.status, atracciones: reparto })
    } else {
      const created = await api.post<any>('/combos', { nombre: x.name, precio: x.price, diasVigencia: x.validDays, estado: x.status, idsAtracciones: x.attractions.map(a => Number(a.attractionId)) })
      if (reparto.length && Math.abs(reparto.reduce((sum, a) => sum + Number(a.porcentajePrecio), 0) - 100) < 0.001) {
        await api.put(`/combos/${created.idCombo}`, { nombre: x.name, precio: x.price, diasVigencia: x.validDays, estado: x.status, atracciones: reparto })
      }
    }
  })
  const deleteCombo = (x: Combo) => execute(async () => {
    for (const item of x.attractions) await api.delete(`/combos-atracciones/${x.id}/${item.attractionId}`)
    await api.delete(`/combos/${x.id}`)
  })

  const syncZones = async (functionId: string, nextZones: Zone[], previousZones: Zone[] = []) => {
    const nextIds = new Set(nextZones.filter(z => z.id && /^\d+$/.test(z.id)).map(z => z.id!))
    for (const old of previousZones) if (old.id && /^\d+$/.test(old.id) && !nextIds.has(old.id)) await api.delete(`/zonas/${old.id}`)
    for (const zone of nextZones) {
      const body = { nombre: zone.name, aforo: zone.capacity, precio: zone.price, idFuncion: Number(functionId) }
      if (zone.id && /^\d+$/.test(zone.id)) await api.put(`/zonas/${zone.id}`, body)
      else await api.post('/zonas', body)
    }
  }
  const saveFunction = (x: EventFunction) => execute(async () => {
    const previous = functions.find(y => y.id === x.id)
    if (previous) {
      await api.put(`/funciones/${x.id}`, { fecha: x.date, horaApertura: x.opening, horaCierre: x.closing, idAtraccion: Number(x.attractionId) })
      if (x.status === 'CANCELADA' && previous.status !== 'CANCELADA') await api.patch(`/funciones/${x.id}/cancelar`)
      await syncZones(x.id, x.zones, previous.zones)
    } else {
      const created = await api.post<any>('/funciones', { fecha: x.date, horaApertura: x.opening, horaCierre: x.closing, estado: x.status, idAtraccion: Number(x.attractionId) })
      await syncZones(String(created.idFuncion), x.zones)
    }
  })

  const saveUser = (x: SystemUser) => {
    const existing = users.some(y => y.id === x.id)
    if (existing) execute(() => api.put(`/usuarios-sistema/${x.id}`, { correo: x.email, estado: x.status, idRol: Number(x.roleId) }))
    else execute(() => api.post('/usuarios-sistema', { correo: x.email, clave: x.passwordHash, estado: x.status, idRol: Number(x.roleId) }))
  }
  const saveClient = (x: Client) => {
    const existing = clients.some(y => y.id === x.id)
    const body = existing
      ? { documento: x.document, nombre: x.name, telefono: x.phone }
      : { documento: x.document, nombre: x.name, telefono: x.phone, idUsuario: Number(x.userId) }
    execute(() => existing ? api.put(`/perfiles-cliente/${x.id}`, body) : api.post('/perfiles-cliente', body))
  }

  const syncReservations = (next: Reservation[]) => {
    setReservations(next)
    execute(async () => {
      const created = next.find(x => !reservations.some(r => r.id === x.id))
      if (created) {
        const comboIds = [...new Set(created.lines.map(l => l.comboId).filter(Boolean))]
        if (comboIds.length > 1) throw new Error('El backend permite un solo combo por reserva. Cree reservas separadas para combos distintos.')
        await api.post('/reservas', {
          idPerfil: Number(created.clientId),
          idPlan: created.planId ? Number(created.planId) : null,
          estado: 'PENDIENTE',
          boletas: created.lines.map(l => ({ idZona: Number(l.zoneId), idTipoEntrada: Number(l.ticketTypeId) })),
          idCombo: comboIds.length ? Number(comboIds[0]) : null,
        })
        return
      }
      for (const old of reservations) {
        const updated = next.find(x => x.id === old.id)
        if (!updated) { await api.delete(`/reservas/${old.id}`); continue }
        if (old.planId !== updated.planId) await api.put(`/reservas/${old.id}`, { idPlan: updated.planId ? Number(updated.planId) : null })
        if (old.status !== updated.status && updated.status === 'CONFIRMADA') await api.patch(`/reservas/${old.id}/confirmar`)
      }
    })
  }

  const syncTickets = (next: Ticket[]) => {
    setTickets(next)
    execute(async () => {
      for (const old of tickets) {
        const updated = next.find(x => x.id === old.id)
        if (!updated || old.status === updated.status) continue
        if (updated.status === 'USADA') await api.patch(`/boletas/codigo/${encodeURIComponent(old.code)}/usar`)
        if (updated.status === 'ANULADA') await api.patch(`/boletas/${old.id}/anular`)
      }
    })
  }

  const syncNotifications = (next: Notification[]) => {
    setNotifications(next)
    execute(async () => {
      const created = next.find(x => !notifications.some(n => n.id === x.id))
      if (created) {
        if (created.sourceKey) return
        await api.post('/notificaciones', { asunto: created.subject, mensaje: created.message, idUsuario: Number(created.userId), idReserva: created.reservationId ? Number(created.reservationId) : null })
        return
      }
      for (const old of notifications) {
        const updated = next.find(x => x.id === old.id)
        if (!updated) { await api.delete(`/notificaciones/${old.id}`); continue }
        if (old.status !== updated.status && updated.status === 'LEÍDA') await api.patch(`/notificaciones/${old.id}/leer`)
        else if (old.subject !== updated.subject || old.message !== updated.message) await api.put(`/notificaciones/${old.id}`, { asunto: updated.subject, mensaje: updated.message })
      }
    })
  }

  if (view === 'login') return <Login onLogin={login} />

  return <div className="app-shell">
    <button className="mobile-menu" onClick={() => setMobile(!mobile)} aria-label="Abrir menú"><Menu /></button>
    <div className={mobile ? 'sidebar-wrap open' : 'sidebar-wrap'}><Sidebar view={view} onNavigate={nav} currentUser={currentUser} /></div>
    <main className="content">
      {['municipios', 'prestadorTypes', 'ticketTypes', 'roles'].includes(view) && <CatalogList kind={view as CatalogKind} items={catalogs[view as CatalogKind]} onNew={() => { setCatalogEditing(null); setView('catalogForm') }} onEdit={x => { setCatalogEditing(x); setView('catalogForm') }} onDelete={x => deleteCatalog(view as CatalogKind, x)} />}
      {view === 'catalogForm' && <CatalogForm kind={catalogKind} editing={catalogEditing} items={catalogs[catalogKind]} onCancel={() => setView(catalogKind)} onSave={x => saveCatalog(catalogKind, x)} />}
      {view === 'prestadores' && <ProviderPage items={providers} municipalities={catalogs.municipios} types={catalogs.prestadorTypes} blocked={p => plans.some(x => x.providerId === p.id) || attractions.some(x => x.providerId === p.id)} onSave={saveProvider} onDelete={x => execute(() => api.delete(`/prestadores/${x.id}`))} />}
      {(view === 'planes' || view === 'atracciones') && <SimpleEntityPage kind={view} items={view === 'planes' ? plans : attractions} providers={providers} blocked={x => view === 'planes' ? false : functions.some(f => f.attractionId === x.id) || combos.some(c => c.attractions.some(a => a.attractionId === x.id))} onSave={x => view === 'planes' ? savePlan(x as Plan) : saveAttraction(x as Attraction)} onDelete={x => execute(() => api.delete(`${view === 'planes' ? '/planes' : '/atracciones'}/${x.id}`))} />}
      {view === 'combos' && <ComboPage items={combos} attractions={attractions} blocked={c => tickets.some(t => t.comboId === c.id) || reservations.some(r => r.lines.some(l => l.comboId === c.id))} onSave={saveCombo} onDelete={deleteCombo} />}
      {view === 'usuarios' && <UsersPage users={users} roles={catalogs.roles} clients={clients} onSave={saveUser} onDelete={x => execute(() => api.delete(`/usuarios-sistema/${x.id}`))} />}
      {view === 'clientes' && <ClientsPage clients={clients} users={users} onSave={saveClient} onDelete={x => execute(() => api.delete(`/perfiles-cliente/${x.id}`))} />}
      {view === 'notificaciones' && <NotificationsModule users={users} clients={clients} reservations={reservations} tickets={tickets} notifications={notifications} onNotifications={syncNotifications} onBack={() => setView('functions')} />}
      {(view === 'reservas' || view === 'boletas') && <ReservationsModule key={view} initialSection={view === 'boletas' ? 'tickets' : 'reservations'} clients={clients} users={users} plans={plans} functions={functions} attractions={attractions} ticketTypes={catalogs.ticketTypes} combos={combos} reservations={reservations} tickets={tickets} notifications={notifications} onNotifications={syncNotifications} onReservations={syncReservations} onTickets={syncTickets} onBack={() => setView('functions')} />}
      {(view === 'functions' || view === 'form') && <Functions items={functions} attractions={attractions} tickets={tickets} onSave={saveFunction} onCancelFunction={fn => execute(() => api.patch(`/funciones/${fn.id}/cancelar`))} />}
      {view === 'reports' && <ReportsDashboard attractions={attractions} functions={functions} reservations={reservations} tickets={tickets} clients={clients} providers={providers} municipalities={catalogs.municipios} providerTypes={catalogs.prestadorTypes} ticketTypes={catalogs.ticketTypes} combos={combos} onBack={() => setView('functions')} />}
    </main>
  </div>
}
