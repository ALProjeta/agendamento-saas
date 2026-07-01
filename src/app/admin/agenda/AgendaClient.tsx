'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { atualizarStatus } from '@/app/actions/agenda'
import { getHorariosDisponiveis, reagendar } from '@/app/actions/reagendar'
import { verificarEncaixe, agendarManual, type EncaixeCheck } from '@/app/actions/encaixe'
import { cn } from '@/lib/utils'

export type Agendamento = {
  id: string
  cliente_nome: string
  cliente_telefone: string
  status: 'confirmado' | 'concluido' | 'cancelado' | 'no_show'
  data: string
  hora_inicio: string
  hora_fim: string
  observacao?: string | null
  servico: { nome: string; duracao_minutos: number; preco: number }
}

export type DayData = {
  dateStr: string
  agendamentos: Agendamento[]
}

export type ServicoEncaixe = {
  id: string
  nome: string
  duracao_minutos: number
}

const GOLD = '#D3AF37'
const MESES       = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const MESES_CURTO = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const SEMANA_LONGO = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado']
const SEMANA_CURTO = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const WEEKDAYS    = ['D','S','T','Q','Q','S','S']

function pad(n: number) { return String(n).padStart(2, '0') }
function toStr(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` }
function fmtTime(t: string) { return t.slice(0, 5) }
function fmtBRL(v: number)  { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function parseDate(s: string) { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d) }
function getMondayOfWeek(dateStr: string): Date {
  const d = parseDate(dateStr)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d
}

function labelData(dateStr: string) {
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const hojeDate = parseDate(hoje)
  const amanha = toStr(new Date(hojeDate.getFullYear(), hojeDate.getMonth(), hojeDate.getDate() + 1))
  const ontem  = toStr(new Date(hojeDate.getFullYear(), hojeDate.getMonth(), hojeDate.getDate() - 1))
  const d = parseDate(dateStr)
  const dia = d.getDate(), mes = MESES[d.getMonth()], semana = SEMANA_LONGO[d.getDay()]
  if (dateStr === hoje)   return { titulo: 'Hoje',   subtitulo: `${semana}, ${dia} de ${mes}` }
  if (dateStr === amanha) return { titulo: 'Amanhã', subtitulo: `${semana}, ${dia} de ${mes}` }
  if (dateStr === ontem)  return { titulo: 'Ontem',  subtitulo: `${semana}, ${dia} de ${mes}` }
  return { titulo: semana, subtitulo: `${dia} de ${mes} de ${d.getFullYear()}` }
}

const STATUS_CFG = {
  confirmado: { label: 'Confirmado',     dot: GOLD,      badge: 'bg-[#D3AF37]/10 border-[#D3AF37]/30 text-[#D3AF37]' },
  concluido:  { label: 'Concluído',      dot: '#10b981', badge: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' },
  cancelado:  { label: 'Cancelado',      dot: '#ef4444', badge: 'bg-red-500/10 border-red-500/30 text-red-400' },
  no_show:    { label: 'Não compareceu', dot: '#71717a', badge: 'bg-zinc-500/10 border-zinc-500/30 text-zinc-400' },
}

type Horario = { hora_inicio: string; hora_fim: string }

const WA_ICON = (
  <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

export default function AgendaClient({
  diasData,
  dateStr,
  modo,
  studioNome,
  servicos,
}: {
  diasData: DayData[]
  dateStr: string
  modo: 'dia' | 'semana'
  studioNome: string
  servicos: ServicoEncaixe[]
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [pendingId, setPendingId] = useState<string | null>(null)

  const [encaixeAberto, setEncaixeAberto]             = useState(false)
  const [encNome, setEncNome]                         = useState('')
  const [encTelefone, setEncTelefone]                 = useState('')
  const [encServicoId, setEncServicoId]               = useState('')
  const [encData, setEncData]                         = useState(dateStr)
  const [encHora, setEncHora]                         = useState('')
  const [encObs, setEncObs]                           = useState('')
  const [encCheck, setEncCheck]                       = useState<EncaixeCheck | null>(null)
  const [encChecking, setEncChecking]                 = useState(false)
  const [encSaving, setEncSaving]                     = useState(false)
  const [encErro, setEncErro]                         = useState<string | null>(null)
  const checkTimerRef                                 = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [reagendarTarget, setReagendarTarget]       = useState<Agendamento | null>(null)
  const [reagendarMes, setReagendarMes]             = useState<Date>(() => { const d = new Date(); d.setDate(1); return d })
  const [reagendarDate, setReagendarDate]           = useState<string | null>(null)
  const [reagendarHorarios, setReagendarHorarios]   = useState<Horario[]>([])
  const [reagendarHorario, setReagendarHorario]     = useState<Horario | null>(null)
  const [reagendarLoading, setReagendarLoading]     = useState(false)
  const [reagendarFeedback, setReagendarFeedback]   = useState<string | null>(null)

  const touchRef = useRef({ x: 0, y: 0 })

  const encServico = servicos.find(s => s.id === encServicoId) ?? null
  const encHoraFim = (() => {
    if (!encHora || !encServico) return ''
    const [h, m] = encHora.split(':').map(Number)
    const total = h * 60 + m + encServico.duracao_minutos
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  })()

  useEffect(() => {
    if (!encData || !encHora || !encHoraFim) { setEncCheck(null); return }
    if (checkTimerRef.current) clearTimeout(checkTimerRef.current)
    setEncChecking(true)
    checkTimerRef.current = setTimeout(async () => {
      const result = await verificarEncaixe(encData, encHora, encHoraFim)
      setEncCheck(result)
      setEncChecking(false)
    }, 500)
    return () => { if (checkTimerRef.current) clearTimeout(checkTimerRef.current) }
  }, [encData, encHora, encHoraFim])

  function resetEncaixe() {
    setEncaixeAberto(false)
    setEncNome(''); setEncTelefone(''); setEncServicoId('')
    setEncData(dateStr); setEncHora(''); setEncObs('')
    setEncCheck(null); setEncErro(null)
  }

  async function handleEncaixe() {
    if (!encNome.trim() || !encTelefone.trim() || !encServicoId || !encData || !encHora || !encHoraFim) {
      return setEncErro('Preencha todos os campos obrigatórios.')
    }
    setEncSaving(true)
    const r = await agendarManual(encNome, encTelefone, encServicoId, encData, encHora, encHoraFim, encObs)
    setEncSaving(false)
    if (r.ok) { resetEncaixe() }
    else setEncErro(r.erro ?? 'Erro ao salvar.')
  }
  const hoje        = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const agendamentos = diasData.flatMap(d => d.agendamentos)
  const ativos       = agendamentos.filter(a => a.status !== 'cancelado')
  const receita      = ativos.reduce((sum, a) => sum + a.servico.preco, 0)
  const { titulo, subtitulo } = labelData(dateStr)

  const weekStart  = getMondayOfWeek(dateStr)
  const weekEnd    = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6)
  const weekLabel  = `${weekStart.getDate()} - ${weekEnd.getDate()} ${MESES_CURTO[weekEnd.getMonth()]}`
  const isThisWeek = hoje >= toStr(weekStart) && hoje <= toStr(weekEnd)

  function navegar(dias: number) {
    const d = parseDate(dateStr); d.setDate(d.getDate() + dias)
    const params = modo === 'semana' ? `?data=${toStr(d)}&modo=semana` : `?data=${toStr(d)}`
    router.push(`/admin/agenda${params}`)
  }

  function toggleModo() {
    if (modo === 'dia') router.push(`/admin/agenda?data=${dateStr}&modo=semana`)
    else router.push(`/admin/agenda?data=${dateStr}`)
  }

  function handleStatus(id: string, status: 'concluido' | 'cancelado' | 'no_show') {
    setPendingId(id)
    startTransition(async () => { await atualizarStatus(id, status); setPendingId(null) })
  }

  function abrirReagendar(ag: Agendamento) {
    setReagendarTarget(ag)
    setReagendarDate(null)
    setReagendarHorarios([])
    setReagendarHorario(null)
    setReagendarFeedback(null)
    const d = new Date(); d.setDate(1); setReagendarMes(d)
  }

  async function selecionarDataReagendar(date: string) {
    if (!reagendarTarget) return
    setReagendarDate(date)
    setReagendarHorario(null)
    setReagendarHorarios([])
    setReagendarLoading(true)
    const horarios = await getHorariosDisponiveis(date, reagendarTarget.servico.duracao_minutos)
    setReagendarHorarios(horarios)
    setReagendarLoading(false)
  }

  async function confirmarReagendar() {
    if (!reagendarTarget || !reagendarDate || !reagendarHorario) return
    setReagendarLoading(true)
    const r = await reagendar(reagendarTarget.id, reagendarDate, reagendarHorario.hora_inicio, reagendarHorario.hora_fim)
    setReagendarLoading(false)
    if (r.ok) { setReagendarTarget(null) }
    else { setReagendarFeedback(r.erro ?? 'Erro ao reagendar.') }
  }

  function renderCalendarioReagendar() {
    const y = reagendarMes.getFullYear(), m = reagendarMes.getMonth()
    const total    = new Date(y, m+1, 0).getDate()
    const primeiro = new Date(y, m, 1).getDay()
    const cells: React.ReactNode[] = []
    for (let i = 0; i < primeiro; i++) cells.push(<div key={`e${i}`} />)
    for (let d = 1; d <= total; d++) {
      const ds = `${y}-${pad(m+1)}-${pad(d)}`
      const passado     = ds < hoje
      const selecionado = ds === reagendarDate
      cells.push(
        <button
          key={d}
          disabled={passado}
          onClick={() => selecionarDataReagendar(ds)}
          className={cn(
            'w-10 h-10 rounded-full text-[13px] font-medium transition-all',
            passado    && 'text-zinc-800 cursor-not-allowed',
            !passado && !selecionado && 'text-zinc-300 hover:bg-[#1E1E1E]',
          )}
          style={selecionado ? { backgroundColor: GOLD, color: '#000', fontWeight: 700 } : {}}
        >{d}</button>
      )
    }
    return cells
  }

  const NAV_BTN = 'w-10 h-10 rounded-full bg-[#111111] border border-[#2C2C2C] flex items-center justify-center text-zinc-400 hover:border-[#D3AF37] hover:text-[#D3AF37] transition-all text-xl'

  function handleTouchStart(e: React.TouchEvent) {
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  function handleTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchRef.current.x
    const dy = e.changedTouches[0].clientY - touchRef.current.y
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      navegar(dx < 0 ? (modo === 'semana' ? 7 : 1) : (modo === 'semana' ? -7 : -1))
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A]" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <header className="bg-black sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo" style={{ height: '32px', width: 'auto' }} />
            <div className="w-0.5 h-6 rounded-full" style={{ backgroundColor: GOLD }} />
            <span className="text-white text-lg font-semibold" style={{ fontFamily: 'var(--font-playfair)' }}>{studioNome}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setEncaixeAberto(true); setEncData(dateStr) }}
              className="h-8 px-3 rounded-full text-[12px] font-bold hover:opacity-80 transition-opacity"
              style={{ backgroundColor: GOLD, color: '#000' }}
            >
              + Encaixe
            </button>
            <button
              onClick={toggleModo}
              className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] px-3 py-1.5 rounded-full border transition-all"
              style={modo === 'semana'
                ? { backgroundColor: GOLD, color: '#000', borderColor: GOLD }
                : { color: '#71717A', borderColor: '#2C2C2C' }}
            >
              {modo === 'semana' ? 'Dia' : 'Semana'}
            </button>
            <span className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: GOLD }}>Agenda</span>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 pb-safe-nav space-y-5">

        <div className="flex items-center justify-between">
          <button onClick={() => navegar(modo === 'semana' ? -7 : -1)} className={NAV_BTN}>&#8249;</button>
          <div className="text-center">
            {modo === 'semana' ? (
              <>
                <p className="text-xl font-bold text-white leading-tight" style={{ fontFamily: 'var(--font-playfair)' }}>{weekLabel}</p>
                <p className="text-xs text-zinc-600 mt-0.5">Semana completa</p>
              </>
            ) : (
              <>
                <p className="text-xl font-bold text-white leading-tight" style={{ fontFamily: 'var(--font-playfair)' }}>{titulo}</p>
                <p className="text-xs text-zinc-600 mt-0.5">{subtitulo}</p>
              </>
            )}
            {(modo === 'dia' ? dateStr !== hoje : !isThisWeek) && (
              <button
                onClick={() => router.push(modo === 'semana' ? '/admin/agenda?modo=semana' : '/admin/agenda')}
                className="mt-1.5 text-[10px] font-bold px-3 py-0.5 rounded-full border transition-all inline-block"
                style={{ borderColor: '#D3AF3760', color: '#D3AF37' }}
              >
                ↩ Hoje
              </button>
            )}
          </div>
          <button onClick={() => navegar(modo === 'semana' ? 7 : 1)} className={NAV_BTN}>&#8250;</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#111111] rounded-2xl p-4 border border-[#1E1E1E]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">
              {modo === 'semana' ? 'Esta semana' : 'Agendamentos'}
            </p>
            <p className="text-4xl font-bold text-white leading-none" style={{ fontFamily: 'var(--font-playfair)' }}>{ativos.length}</p>
          </div>
          <div className="bg-[#111111] rounded-2xl p-4 border border-[#1E1E1E]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">Receita prevista</p>
            <p className="text-xl font-bold leading-tight" style={{ color: GOLD, fontFamily: 'var(--font-playfair)' }}>{fmtBRL(receita)}</p>
          </div>
        </div>

        {modo === 'dia' ? (
          <>
            {diasData[0].agendamentos.length === 0 ? (
              <div className="bg-[#111111] rounded-2xl border border-[#1E1E1E] py-16 flex flex-col items-center gap-3 text-center">
                <span className="text-4xl opacity-40">&#128197;</span>
                <p className="font-semibold text-zinc-500">Nenhum agendamento</p>
                <p className="text-sm text-zinc-700 max-w-[200px]">Não há agendamentos para este dia.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {diasData[0].agendamentos.map(ag => {
                  const cfg     = STATUS_CFG[ag.status]
                  const pending = pendingId === ag.id
                  return (
                    <div
                      key={ag.id}
                      className={cn(
                        'bg-[#111111] rounded-2xl border border-[#1E1E1E] overflow-hidden transition-all duration-200',
                        pending && 'opacity-40 pointer-events-none',
                        ag.status === 'cancelado' && 'opacity-50',
                      )}
                    >
                      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1A1A1A]">
                        <div className="flex items-center gap-3">
                          <div className="w-1 h-9 rounded-full" style={{ backgroundColor: cfg.dot }} />
                          <div>
                            <p className="text-xl font-bold text-white leading-none" style={{ fontFamily: 'var(--font-playfair)' }}>
                              {fmtTime(ag.hora_inicio)}
                            </p>
                            <p className="text-[11px] text-zinc-600 mt-0.5">até {fmtTime(ag.hora_fim)}</p>
                          </div>
                        </div>
                        <span className={cn('text-[11px] font-semibold px-2.5 py-1 rounded-full border', cfg.badge)}>
                          {cfg.label}
                        </span>
                      </div>
                      <div className="px-5 py-4 space-y-3">
                        <div>
                          <p className={cn('font-semibold text-[15px] leading-snug', ag.status === 'cancelado' ? 'line-through text-zinc-600' : 'text-white')}>
                            {ag.cliente_nome}
                          </p>
                          <a
                            href={`https://wa.me/55${ag.cliente_telefone.replace(/\D/g, '')}`}
                            target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-[13px] text-emerald-500 font-medium hover:text-emerald-400 transition-colors mt-0.5"
                          >
                            {WA_ICON}
                            {ag.cliente_telefone}
                          </a>
                        </div>
                        <div className="flex items-end justify-between pt-2.5 border-t border-[#1A1A1A]">
                          <div>
                            <p className="text-[13px] font-semibold text-zinc-300">{ag.servico.nome}</p>
                            <p className="text-xs text-zinc-600 mt-0.5">{ag.servico.duracao_minutos} min</p>
                          </div>
                          <p className="text-base font-bold" style={{ color: GOLD, fontFamily: 'var(--font-playfair)' }}>
                            {fmtBRL(ag.servico.preco)}
                          </p>
                        </div>
                        {ag.observacao && (
                          <div className="flex gap-2 items-start rounded-xl bg-[#1A1A1A] px-3 py-2.5">
                            <span className="text-zinc-500 text-xs mt-0.5 shrink-0">💬</span>
                            <p className="text-[12px] text-zinc-400 leading-relaxed">{ag.observacao}</p>
                          </div>
                        )}
                        {ag.status === 'confirmado' && (
                          <div className="space-y-2 pt-1">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleStatus(ag.id, 'concluido')}
                                disabled={!!pendingId}
                                className="flex-1 h-9 rounded-xl text-xs font-bold border border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all disabled:opacity-40"
                              >
                                Concluído
                              </button>
                              <button
                                onClick={() => abrirReagendar(ag)}
                                disabled={!!pendingId}
                                className="flex-1 h-9 rounded-xl text-xs font-bold border transition-all disabled:opacity-40"
                                style={{ borderColor: GOLD + '50', color: GOLD, backgroundColor: GOLD + '18' }}
                              >
                                Reagendar
                              </button>
                              <button
                                onClick={() => handleStatus(ag.id, 'cancelado')}
                                disabled={!!pendingId}
                                className="flex-1 h-9 rounded-xl text-xs font-bold border border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all disabled:opacity-40"
                              >
                                Cancelar
                              </button>
                            </div>
                            <button
                              onClick={() => handleStatus(ag.id, 'no_show')}
                              disabled={!!pendingId}
                              className="w-full h-9 rounded-xl text-xs font-bold border border-zinc-700/50 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 transition-all disabled:opacity-40"
                            >
                              Não compareceu
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {dateStr !== hoje && (
              <button
                onClick={() => router.push('/admin/agenda')}
                className="w-full py-3 text-sm font-semibold text-zinc-600 hover:text-zinc-300 transition-colors"
              >
                Voltar para hoje
              </button>
            )}
          </>
        ) : (
          <div className="space-y-3">
            {diasData.map(dia => {
              const d      = parseDate(dia.dateStr)
              const ehHoje = dia.dateStr === hoje
              const count  = dia.agendamentos.filter(a => a.status !== 'cancelado').length
              return (
                <div key={dia.dateStr} className="bg-[#111111] rounded-2xl border border-[#1E1E1E] overflow-hidden">
                  <div
                    className="flex items-center justify-between px-5 py-3 border-b border-[#1A1A1A] cursor-pointer hover:bg-[#161616] transition-colors"
                    onClick={() => router.push(`/admin/agenda?data=${dia.dateStr}`)}
                  >
                    <div className="flex items-center gap-2.5">
                      {ehHoje && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: GOLD }} />}
                      <div>
                        <p className="text-[13px] font-bold" style={{ color: ehHoje ? GOLD : '#fff' }}>
                          {SEMANA_LONGO[d.getDay()]}
                          <span className="text-zinc-600 font-normal ml-1.5">{d.getDate()} {MESES_CURTO[d.getMonth()]}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {count > 0 && (
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full" style={{ backgroundColor: GOLD + '20', color: GOLD }}>
                          {count} ag.
                        </span>
                      )}
                      <span className="text-zinc-700 text-sm">&#8250;</span>
                    </div>
                  </div>
                  {dia.agendamentos.length === 0 ? (
                    <div className="px-5 py-2.5">
                      <p className="text-xs text-zinc-800">Nenhum agendamento</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#161616]">
                      {dia.agendamentos.map(ag => {
                        const cfg = STATUS_CFG[ag.status]
                        return (
                          <div key={ag.id} className={cn('flex items-center gap-3 px-5 py-2.5', ag.status === 'cancelado' && 'opacity-40')}>
                            <div className="w-1 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.dot }} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[13px] font-bold text-white">{fmtTime(ag.hora_inicio)}</span>
                                <span className="text-[12px] text-zinc-400 truncate">{ag.cliente_nome}</span>
                              </div>
                              <p className="text-[11px] text-zinc-600 truncate">{ag.servico.nome}</p>
                            </div>
                            <span className="text-[12px] font-semibold shrink-0" style={{ color: GOLD }}>
                              {fmtBRL(ag.servico.preco)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {encaixeAberto && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm"
          onClick={resetEncaixe}
        >
          <div
            className="w-full max-w-lg bg-[#0E0E0E] rounded-t-3xl border-t border-[#1E1E1E] overflow-y-auto"
            style={{ maxHeight: '90vh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1A1A1A] sticky top-0 bg-[#0E0E0E] z-10">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Agendamento manual</p>
                <p className="text-white font-semibold mt-0.5">Encaixe</p>
              </div>
              <button
                onClick={resetEncaixe}
                className="w-8 h-8 rounded-full border border-[#2C2C2C] flex items-center justify-center text-zinc-500 hover:text-white hover:border-[#444] transition-all"
              >
                &#x2715;
              </button>
            </div>

            <div className="px-5 py-5 space-y-4">

              {/* Serviço */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 block mb-2">Serviço *</label>
                <div className="relative">
                  <select
                    value={encServicoId}
                    onChange={e => { setEncServicoId(e.target.value); setEncCheck(null) }}
                    className="w-full h-11 rounded-xl border bg-[#181818] border-[#2C2C2C] px-3 text-sm font-semibold text-white focus:outline-none focus:border-[#D3AF37] transition-all appearance-none"
                  >
                    <option value="">Selecione o serviço</option>
                    {servicos.map(s => (
                      <option key={s.id} value={s.id}>{s.nome} ({s.duracao_minutos} min)</option>
                    ))}
                  </select>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">▾</span>
                </div>
              </div>

              {/* Data e Hora */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 block mb-2">Data *</label>
                  <input
                    type="date"
                    value={encData}
                    onChange={e => { setEncData(e.target.value); setEncCheck(null) }}
                    className="w-full h-11 rounded-xl border bg-[#181818] border-[#2C2C2C] px-3 text-sm font-semibold text-white focus:outline-none focus:border-[#D3AF37] transition-all"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 block mb-2">Início *</label>
                  <input
                    type="time"
                    value={encHora}
                    onChange={e => { setEncHora(e.target.value); setEncCheck(null) }}
                    className="w-full h-11 rounded-xl border bg-[#181818] border-[#2C2C2C] px-3 text-sm font-semibold text-white focus:outline-none focus:border-[#D3AF37] transition-all"
                  />
                </div>
              </div>

              {/* Aviso de disponibilidade */}
              {encServicoId && encData && encHora && (
                <div className={cn(
                  'rounded-xl px-4 py-3 text-sm font-medium flex items-start gap-2.5',
                  encChecking && 'bg-[#1A1A1A] border border-[#2C2C2C] text-zinc-500',
                  !encChecking && encCheck?.status === 'livre' && 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400',
                  !encChecking && encCheck?.status === 'sem-disponibilidade' && 'bg-amber-500/10 border border-amber-500/30 text-amber-400',
                  !encChecking && encCheck?.status === 'conflito' && 'bg-red-500/10 border border-red-500/30 text-red-400',
                )}>
                  {encChecking ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin shrink-0 mt-0.5" />
                      <span>Verificando disponibilidade...</span>
                    </>
                  ) : encCheck?.status === 'livre' ? (
                    <><span className="shrink-0">✓</span><span>Horário livre — dentro de uma janela de disponibilidade.</span></>
                  ) : encCheck?.status === 'sem-disponibilidade' ? (
                    <><span className="shrink-0">⚠</span><span>Sem disponibilidade aberta para este horário. Clientes não conseguiriam agendar aqui, mas você pode prosseguir.</span></>
                  ) : encCheck?.status === 'conflito' ? (
                    <><span className="shrink-0">✗</span><span>Conflito: <strong>{(encCheck as { conflitoCom: string }).conflitoCom}</strong> já tem agendamento neste horário. Você pode prosseguir mesmo assim.</span></>
                  ) : null}
                </div>
              )}
              {encHoraFim && encServico && (
                <p className="text-[11px] text-zinc-600 -mt-2">
                  Término previsto às {encHoraFim} ({encServico.duracao_minutos} min)
                </p>
              )}

              {/* Cliente */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 block mb-2">Nome do cliente *</label>
                <input
                  type="text"
                  value={encNome}
                  onChange={e => setEncNome(e.target.value)}
                  placeholder="Nome completo"
                  className="w-full h-11 rounded-xl border bg-[#181818] border-[#2C2C2C] px-3 text-sm font-semibold text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#D3AF37] transition-all"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 block mb-2">Telefone *</label>
                <input
                  type="tel"
                  value={encTelefone}
                  onChange={e => setEncTelefone(e.target.value)}
                  placeholder="11999998888"
                  className="w-full h-11 rounded-xl border bg-[#181818] border-[#2C2C2C] px-3 text-sm font-semibold text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#D3AF37] transition-all"
                />
              </div>

              {/* Observação opcional */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 block mb-2">Observação <span className="normal-case font-normal text-zinc-700">(opcional)</span></label>
                <textarea
                  value={encObs}
                  onChange={e => setEncObs(e.target.value)}
                  placeholder="Ex: cliente preferiu horário fora da agenda online"
                  rows={2}
                  className="w-full rounded-xl border bg-[#181818] border-[#2C2C2C] px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#D3AF37] transition-all resize-none"
                />
              </div>

              {encErro && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">
                  {encErro}
                </div>
              )}

              <div className="flex gap-3 pb-2">
                <button
                  onClick={resetEncaixe}
                  className="flex-1 h-12 rounded-xl border border-[#2C2C2C] text-zinc-400 font-semibold hover:border-zinc-500 hover:text-white transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleEncaixe}
                  disabled={encSaving || !encNome.trim() || !encTelefone.trim() || !encServicoId || !encData || !encHora}
                  className="flex-1 h-12 rounded-xl font-bold transition-all disabled:opacity-30"
                  style={{ backgroundColor: GOLD, color: '#000' }}
                >
                  {encSaving ? 'Salvando...' : 'Confirmar encaixe'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {reagendarTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setReagendarTarget(null)}
        >
          <div
            className="w-full max-w-lg bg-[#0E0E0E] rounded-t-3xl border-t border-[#1E1E1E] overflow-y-auto"
            style={{ maxHeight: '85vh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1A1A1A] sticky top-0 bg-[#0E0E0E] z-10">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Reagendar</p>
                <p className="text-white font-semibold mt-0.5">{reagendarTarget.cliente_nome}</p>
              </div>
              <button
                onClick={() => setReagendarTarget(null)}
                className="w-8 h-8 rounded-full border border-[#2C2C2C] flex items-center justify-center text-zinc-500 hover:text-white hover:border-[#444] transition-all"
              >
                &#x2715;
              </button>
            </div>

            <div className="px-5 py-5 space-y-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-3">Nova data</p>
                <div className="bg-[#111111] rounded-2xl border border-[#1E1E1E] p-4">
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={() => setReagendarMes(m => new Date(m.getFullYear(), m.getMonth()-1, 1))}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 hover:bg-[#1E1E1E] hover:text-white transition-all text-xl"
                    >&#8249;</button>
                    <span className="text-sm font-semibold text-white">
                      {MESES[reagendarMes.getMonth()]} {reagendarMes.getFullYear()}
                    </span>
                    <button
                      onClick={() => setReagendarMes(m => new Date(m.getFullYear(), m.getMonth()+1, 1))}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 hover:bg-[#1E1E1E] hover:text-white transition-all text-xl"
                    >&#8250;</button>
                  </div>
                  <div className="grid grid-cols-7 mb-1">
                    {WEEKDAYS.map((wd, i) => (
                      <div key={i} className="text-center text-[10px] font-semibold text-zinc-600 uppercase tracking-wider py-1">{wd}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-y-1 place-items-center">
                    {renderCalendarioReagendar()}
                  </div>
                </div>
              </div>

              {reagendarDate && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-3">
                    Horários — {SEMANA_CURTO[parseDate(reagendarDate).getDay()]}, {parseDate(reagendarDate).getDate()} {MESES_CURTO[parseDate(reagendarDate).getMonth()]}
                  </p>
                  {reagendarLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: GOLD, borderTopColor: 'transparent' }} />
                    </div>
                  ) : reagendarHorarios.length === 0 ? (
                    <div className="bg-[#111111] rounded-2xl border border-[#1E1E1E] py-8 flex flex-col items-center gap-2 text-center">
                      <span className="text-2xl opacity-30">&#128336;</span>
                      <p className="text-sm text-zinc-600">Nenhum horário disponível nesta data.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {reagendarHorarios.map(h => {
                        const selected = reagendarHorario?.hora_inicio === h.hora_inicio
                        return (
                          <button
                            key={h.hora_inicio}
                            onClick={() => setReagendarHorario(h)}
                            className="h-12 rounded-xl border font-bold text-sm transition-all"
                            style={selected
                              ? { backgroundColor: GOLD, color: '#000', borderColor: GOLD }
                              : { backgroundColor: '#111111', color: '#A1A1AA', borderColor: '#2C2C2C' }}
                          >
                            {fmtTime(h.hora_inicio)}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {reagendarFeedback && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">
                  {reagendarFeedback}
                </div>
              )}

              <button
                onClick={confirmarReagendar}
                disabled={!reagendarHorario || reagendarLoading}
                className="w-full h-12 rounded-xl font-bold text-sm transition-all disabled:opacity-30"
                style={{ backgroundColor: GOLD, color: '#000' }}
              >
                {reagendarLoading ? 'Reagendando...' : 'Confirmar Reagendamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
