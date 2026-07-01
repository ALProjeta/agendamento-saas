'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { adicionarDisponibilidades, removerDisponibilidade } from '@/app/actions/horarios'
import { cn } from '@/lib/utils'

export type Disponibilidade = {
  id: string
  hora_inicio: string
  hora_fim: string
}

type AgendamentoDia = {
  hora_inicio: string
  hora_fim: string
  cliente_nome: string
  servico_nome: string
}

type Servico = { id: string; nome: string; duracao_minutos: number }

const GOLD   = '#D3AF37'
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

const REPLICAR_OPCOES = [
  { label: 'Só esta semana', value: 0 },
  { label: '+ 1 semana',     value: 1 },
  { label: '+ 2 semanas',    value: 2 },
  { label: '+ 4 semanas',    value: 4 },
  { label: '+ 8 semanas',    value: 8 },
  { label: '+ 12 semanas',   value: 12 },
]

function pad(n: number)       { return String(n).padStart(2, '0') }
function toStr(d: Date)       { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` }
function fmtTime(t: string)   { return t.slice(0, 5) }
function timeToMin(t: string) { const [h,m] = t.split(':').map(Number); return h*60+m }
function parseDate(s: string) { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d) }

function fmtDuracao(min: number) {
  const h = Math.floor(min / 60), m = min % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

function hojeNoBrasil() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

function getSemanaDoDate(ds: string): string[] {
  const date = parseDate(ds)
  const dow  = date.getDay()
  const seg  = new Date(date)
  seg.setDate(date.getDate() - (dow === 0 ? 6 : dow - 1))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(seg)
    d.setDate(seg.getDate() + i)
    return toStr(d)
  })
}

function buildAllDatas(diasSelecionados: Set<string>, replicarSemanas: number): string[] {
  const all: string[] = []
  for (let s = 0; s <= replicarSemanas; s++) {
    for (const ds of diasSelecionados) {
      const d = parseDate(ds)
      d.setDate(d.getDate() + s * 7)
      all.push(toStr(d))
    }
  }
  return all
}

type Feedback = { tipo: 'ok' | 'erro'; msg: string }

const INPUT_CLS = 'w-full h-11 rounded-xl border bg-[#181818] border-[#2C2C2C] px-3 text-sm font-semibold text-white focus:outline-none focus:border-[#D3AF37] transition-all'
const SEL_CLS   = 'w-full h-11 rounded-xl border bg-[#181818] border-[#2C2C2C] px-3 text-sm font-semibold text-white focus:outline-none focus:border-[#D3AF37] transition-all appearance-none'

export default function HorariosClient({
  dateStr,
  disponibilidades,
  agendamentos,
  datasComDisp,
  studioNome,
  servicos,
}: {
  dateStr: string
  disponibilidades: Disponibilidade[]
  agendamentos: AgendamentoDia[]
  datasComDisp: string[]
  studioNome: string
  servicos: Servico[]
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const hoje = hojeNoBrasil()

  const [mes, setMes]         = useState(() => { const d = parseDate(dateStr); d.setDate(1); return d })
  const [horaIni, setHoraIni] = useState('08:00')
  const [horaFim, setHoraFim] = useState('20:00')
  const [replicarSemanas, setReplicarSemanas]       = useState(0)
  const [diasSelecionados, setDiasSelecionados]     = useState<Set<string>>(() => new Set([dateStr]))
  const [feedback, setFeedback]                     = useState<Feedback | null>(null)
  const [addPending, setAddPending]                 = useState(false)
  const [removePendingId, setRemovePendingId]       = useState<string | null>(null)

  useEffect(() => {
    setDiasSelecionados(new Set([dateStr]))
    setReplicarSemanas(0)
  }, [dateStr])

  const datasSet     = useMemo(() => new Set(datasComDisp), [datasComDisp])
  const semana       = useMemo(() => getSemanaDoDate(dateStr), [dateStr])
  const allDatas     = useMemo(() => buildAllDatas(diasSelecionados, replicarSemanas), [diasSelecionados, replicarSemanas])
  const duracaoJanela = useMemo(() => {
    const ini = timeToMin(horaIni), fim = timeToMin(horaFim)
    return fim > ini ? fim - ini : 0
  }, [horaIni, horaFim])

  function showFeedback(f: Feedback) { setFeedback(f); setTimeout(() => setFeedback(null), 5000) }

  function toggleDia(ds: string) {
    setDiasSelecionados(prev => {
      const next = new Set(prev)
      if (next.has(ds)) { if (next.size === 1) return next; next.delete(ds) }
      else next.add(ds)
      return next
    })
  }

  async function handleAdicionar() {
    if (duracaoJanela <= 0) return showFeedback({ tipo: 'erro', msg: 'Horário de fim deve ser após o início.' })
    setAddPending(true)
    const r = await adicionarDisponibilidades(allDatas, horaIni, horaFim)
    if (r.ok) {
      showFeedback({ tipo: 'ok', msg: r.datas > 1 ? `Disponibilidade aberta em ${r.datas} dias!` : 'Disponibilidade adicionada!' })
    } else {
      showFeedback({ tipo: 'erro', msg: r.erro })
    }
    setAddPending(false)
  }

  function handleRemover(id: string) {
    setRemovePendingId(id)
    startTransition(async () => {
      const r = await removerDisponibilidade(id)
      if (!r.ok) showFeedback({ tipo: 'erro', msg: r.erro })
      setRemovePendingId(null)
    })
  }

  function renderDias() {
    const y = mes.getFullYear(), m = mes.getMonth()
    const total    = new Date(y, m+1, 0).getDate()
    const primeiro = new Date(y, m, 1).getDay()
    const cells: React.ReactNode[] = []
    for (let i = 0; i < primeiro; i++) cells.push(<div key={`e${i}`} />)
    for (let d = 1; d <= total; d++) {
      const ds          = `${y}-${pad(m+1)}-${pad(d)}`
      const temDisp     = datasSet.has(ds)
      const selecionado = ds === dateStr
      cells.push(
        <div key={d} className="flex flex-col items-center gap-[3px] py-0.5">
          <button
            onClick={() => router.push(`/admin/horarios?data=${ds}`)}
            className={cn(
              'w-10 h-10 rounded-full text-[13px] font-medium transition-all duration-150',
              selecionado ? 'font-bold' : 'text-zinc-300 hover:bg-[#1E1E1E]',
            )}
            style={selecionado ? { backgroundColor: GOLD, color: '#000' } : {}}
          >
            {d}
          </button>
          {temDisp && !selecionado && <div className="w-1 h-1 rounded-full" style={{ backgroundColor: GOLD }} />}
        </div>
      )
    }
    return cells
  }

  const dataFormatada = (() => {
    const d = parseDate(dateStr)
    return `${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`
  })()

  const NAV_BTN = 'w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 hover:bg-[#1E1E1E] hover:text-white transition-all text-xl'

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <header className="bg-black sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo" style={{ height: '32px', width: 'auto' }} />
            <div className="w-0.5 h-6 rounded-full" style={{ backgroundColor: GOLD }} />
            <span className="text-white text-lg font-semibold" style={{ fontFamily: 'var(--font-playfair)' }}>{studioNome}</span>
          </div>
          <span className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: GOLD }}>Horários</span>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 pb-safe-nav space-y-5">

        {feedback && (
          <div className={cn(
            'flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium',
            feedback.tipo === 'ok'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border border-red-500/30 text-red-400',
          )}>
            <span>{feedback.tipo === 'ok' ? '✓' : '⚠'}</span>
            {feedback.msg}
          </div>
        )}

        {/* Calendário */}
        <div className="bg-[#111111] rounded-2xl border border-[#1E1E1E] p-5">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setMes(m => new Date(m.getFullYear(), m.getMonth()-1, 1))} className={NAV_BTN}>‹</button>
            <span className="text-sm font-semibold text-white">{MONTHS[mes.getMonth()]} {mes.getFullYear()}</span>
            <button onClick={() => setMes(m => new Date(m.getFullYear(), m.getMonth()+1, 1))} className={NAV_BTN}>›</button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {['D','S','T','Q','Q','S','S'].map((d, i) => (
              <div key={i} className="text-center text-[10px] font-semibold text-zinc-600 uppercase tracking-wider py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">{renderDias()}</div>
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#1A1A1A]">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: GOLD }} />
            <span className="text-[11px] text-zinc-600">Dias com disponibilidade cadastrada</span>
          </div>
        </div>

        {/* Formulário */}
        <div className="bg-[#111111] rounded-2xl border border-[#1E1E1E] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1A1A1A] flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Semana de</p>
              <p className="font-semibold text-white mt-0.5" style={{ fontFamily: 'var(--font-playfair)' }}>{dataFormatada}</p>
            </div>
            <button
              onClick={() => { setHoraIni('08:00'); setHoraFim('20:00') }}
              className="text-[12px] font-bold px-3 py-1.5 rounded-full border transition-all"
              style={{ borderColor: GOLD, color: GOLD }}
            >
              ⚡ Dia inteiro
            </button>
          </div>

          <div className="px-5 py-4 space-y-5">

            {/* Dias da semana */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-3">Dias da semana</p>
              <div className="grid grid-cols-7 gap-1">
                {semana.map((ds, i) => {
                  const passado  = ds < hoje
                  const selected = diasSelecionados.has(ds)
                  const d        = parseDate(ds)
                  return (
                    <button
                      key={ds}
                      disabled={passado}
                      onClick={() => toggleDia(ds)}
                      className={cn(
                        'flex flex-col items-center gap-1 py-2 rounded-xl border text-center transition-all',
                        passado   && 'opacity-30 cursor-not-allowed border-transparent',
                        selected  && !passado && 'border-[#D3AF37]',
                        !selected && !passado && 'border-[#2C2C2C] hover:border-[#D3AF37]/40',
                      )}
                      style={selected && !passado ? { backgroundColor: GOLD + '18' } : {}}
                    >
                      <span className={cn('text-[10px] font-bold uppercase', selected && !passado ? 'text-[#D3AF37]' : 'text-zinc-500')}>
                        {SEMANA[i === 6 ? 0 : i + 1]}
                      </span>
                      <span className={cn('text-[13px] font-bold leading-none', selected && !passado ? 'text-white' : passado ? 'text-zinc-700' : 'text-zinc-400')}>
                        {d.getDate()}
                      </span>
                    </button>
                  )
                })}
              </div>
              <p className="text-[11px] text-zinc-600 mt-2">
                {diasSelecionados.size} dia{diasSelecionados.size > 1 ? 's' : ''} selecionado{diasSelecionados.size > 1 ? 's' : ''}
              </p>
            </div>

            {/* Janela de disponibilidade */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-3">Janela de disponibilidade</p>
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div>
                  <label className="text-[12px] font-semibold text-zinc-500 block mb-1.5">Início</label>
                  <input type="time" value={horaIni} onChange={e => setHoraIni(e.target.value)} className={INPUT_CLS} />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-zinc-500 block mb-1.5">Fim</label>
                  <input type="time" value={horaFim} onChange={e => setHoraFim(e.target.value)} className={INPUT_CLS} />
                </div>
              </div>
              {duracaoJanela > 0 && (
                <p className="text-[11px] text-zinc-600 mb-2">
                  Janela de {fmtDuracao(duracaoJanela)} — clientes poderão agendar horários dentro desse intervalo.
                </p>
              )}
              {servicos.length > 0 && duracaoJanela > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {servicos.map(s => {
                    const cabe = duracaoJanela >= s.duracao_minutos
                    return (
                      <span
                        key={s.id}
                        className={cn(
                          'text-[11px] font-semibold px-2 py-0.5 rounded-full border',
                          cabe
                            ? 'border-[#D3AF37]/30 text-[#D3AF37] bg-[#D3AF37]/10'
                            : 'border-zinc-700 text-zinc-600'
                        )}
                      >
                        {cabe ? '✓' : '✗'} {s.nome} ({fmtDuracao(s.duracao_minutos)})
                      </span>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Repetir */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-3">Repetir</p>
              <div className="relative">
                <select
                  value={replicarSemanas}
                  onChange={e => setReplicarSemanas(Number(e.target.value))}
                  className={SEL_CLS}
                >
                  {REPLICAR_OPCOES.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">▾</span>
              </div>
              {replicarSemanas > 0 && (
                <p className="text-[11px] text-zinc-500 mt-1.5">
                  Abre disponibilidade para {diasSelecionados.size} dia{diasSelecionados.size > 1 ? 's' : ''} × {replicarSemanas + 1} semanas = {allDatas.length} datas
                </p>
              )}
            </div>

            <button
              onClick={handleAdicionar}
              disabled={addPending || duracaoJanela <= 0 || diasSelecionados.size === 0}
              className="w-full h-11 rounded-xl text-[14px] font-bold transition-all disabled:opacity-30"
              style={{ backgroundColor: GOLD, color: '#000' }}
            >
              {addPending
                ? 'Salvando...'
                : `Abrir disponibilidade${allDatas.length > 1 ? ` em ${allDatas.length} datas` : ''}`}
            </button>
          </div>
        </div>

        {/* Janelas do dia selecionado */}
        <div className="bg-[#111111] rounded-2xl border border-[#1E1E1E] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1A1A1A]">
            <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
              {parseDate(dateStr).getDate()} de {MONTHS[parseDate(dateStr).getMonth()]}
              {' '}— {disponibilidades.length} janela{disponibilidades.length !== 1 ? 's' : ''} aberta{disponibilidades.length !== 1 ? 's' : ''}
            </p>
          </div>

          {disponibilidades.length === 0 ? (
            <div className="py-10 flex flex-col items-center gap-2 text-center">
              <span className="text-3xl opacity-30">🗓</span>
              <p className="text-sm font-medium text-zinc-600">Nenhuma disponibilidade para esta data.</p>
              <p className="text-xs text-zinc-700">Use o formulário acima para abrir horários.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#1A1A1A]">
              {disponibilidades.map(disp => {
                const isPending = removePendingId === disp.id
                const agsNaJanela = agendamentos.filter(ag => {
                  const agIni = timeToMin(ag.hora_inicio), agFim = timeToMin(ag.hora_fim)
                  const dIni  = timeToMin(disp.hora_inicio), dFim = timeToMin(disp.hora_fim)
                  return agIni < dFim && agFim > dIni
                })
                return (
                  <div key={disp.id} className={cn('transition-opacity', isPending && 'opacity-40')}>
                    <div className="flex items-center justify-between px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-1 h-8 rounded-full" style={{ backgroundColor: GOLD }} />
                        <div>
                          <p className="text-[15px] font-bold text-white leading-none" style={{ fontFamily: 'var(--font-playfair)' }}>
                            {fmtTime(disp.hora_inicio)}
                            <span className="text-zinc-600 font-normal text-sm"> → {fmtTime(disp.hora_fim)}</span>
                          </p>
                          <p className="text-[11px] text-zinc-600 mt-0.5">
                            {fmtDuracao(timeToMin(disp.hora_fim) - timeToMin(disp.hora_inicio))}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemover(disp.id)}
                        disabled={!!removePendingId}
                        className="w-8 h-8 rounded-full border border-[#2C2C2C] flex items-center justify-center text-zinc-600 hover:border-red-500/50 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    {agsNaJanela.length > 0 && (
                      <div className="px-5 pb-3 space-y-1.5">
                        {agsNaJanela.map((ag, i) => (
                          <div key={i} className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-3 py-2">
                            <div className="w-1 h-4 rounded-full bg-emerald-500 shrink-0" />
                            <span className="text-[11px] font-semibold text-emerald-400">
                              {fmtTime(ag.hora_inicio)}–{fmtTime(ag.hora_fim)}
                            </span>
                            <span className="text-[11px] text-zinc-500 truncate">{ag.cliente_nome} · {ag.servico_nome}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
