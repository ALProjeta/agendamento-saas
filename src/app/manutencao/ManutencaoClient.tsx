'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { agendar } from '@/app/actions/agendar'
import { verificarElegibilidade } from '@/app/actions/verificar-manutencao'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type Servico     = { id: string; nome: string; duracao_minutos: number; preco: number }
type Disp        = { id: string; hora_inicio: string; hora_fim: string }
type AgExistente = { hora_inicio: string; hora_fim: string }
type VirtualSlot = { disponibilidade_id: string; hora_inicio: string; hora_fim: string }

const GOLD     = '#D3AF37'
const MONTHS   = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const WEEKDAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const STEP_MIN = 15

const pad          = (n: number) => String(n).padStart(2, '0')
const toStr        = (d: Date)   => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
const toMin        = (t: string) => { const [h,m] = t.split(':').map(Number); return h*60+m }
const minToTime    = (n: number) => `${pad(Math.floor(n/60))}:${pad(n%60)}`
const fmtTime      = (t: string) => t.slice(0,5)
const fmtBRL       = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate      = (s: string) => { const [y,m,d] = s.split('-').map(Number); return `${d} de ${MONTHS[m-1]} de ${y}` }
const fmtDateShort = (s: string) => { const [,m,d]  = s.split('-').map(Number); return `${d} de ${MONTHS[m-1]}` }

const INPUT_CLS = 'h-12 rounded-xl bg-[#181818] border-[#2C2C2C] text-white placeholder:text-zinc-600 focus-visible:ring-[#D3AF37] focus-visible:border-[#D3AF37]'

function computeSlots(disps: Disp[], ags: AgExistente[], duracaoMin: number): VirtualSlot[] {
  const slots: VirtualSlot[] = []
  for (const disp of disps) {
    const winIni = toMin(disp.hora_inicio)
    const winFim = toMin(disp.hora_fim)
    let t = winIni
    while (t + duracaoMin <= winFim) {
      const tFim    = t + duracaoMin
      const tStr    = minToTime(t)
      const tFimStr = minToTime(tFim)
      const conflito = ags.some(ag => {
        const agIni = toMin(ag.hora_inicio)
        const agFim = toMin(ag.hora_fim)
        return tStr < ag.hora_fim.slice(0,5) && tFimStr > ag.hora_inicio.slice(0,5)
          || t < agFim && tFim > agIni
      })
      if (!conflito) slots.push({ disponibilidade_id: disp.id, hora_inicio: tStr, hora_fim: tFimStr })
      t += STEP_MIN
    }
  }
  return slots
}

export default function ManutencaoClient({ config }: { config: Record<string, string> }) {
  const supabase = useMemo(() => createClient(), [])

  // step 0 = verificação de telefone, 1 = serviço, 2 = data, 3 = horário, 4 = dados, 5 = confirmado
  const [step, setStep]                  = useState(0)
  const [telefoneBusca, setTelefoneBusca] = useState('')
  const [verificando, setVerificando]    = useState(false)
  const [erroVerif, setErroVerif]        = useState<string | null>(null)
  const [ultimoServico, setUltimoServico] = useState<string | null>(null)

  const [servicos, setServicos]          = useState<Servico[]>([])
  const [servico, setServico]            = useState<Servico | null>(null)
  const [mes, setMes]                    = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [datasDisponiveis, setDatasDisp] = useState<Set<string>>(new Set())
  const [data, setData]                  = useState<string | null>(null)
  const [slots, setSlots]                = useState<VirtualSlot[]>([])
  const [slot, setSlot]                  = useState<VirtualSlot | null>(null)
  const [nome, setNome]                  = useState('')
  const [telefone, setTelefone]          = useState('')
  const [loading, setLoading]            = useState(false)
  const [submitting, setSubmitting]      = useState(false)
  const [erro, setErro]                  = useState<string | null>(null)

  async function verificar() {
    setVerificando(true)
    setErroVerif(null)
    const r = await verificarElegibilidade(telefoneBusca)
    setVerificando(false)
    if (!r.elegivel) { setErroVerif(r.erro); return }
    setNome(r.nome)
    setTelefone(r.telefone)
    setUltimoServico(r.ultimoServico)
    setStep(1)
  }

  // Carrega serviços de manutenção
  useEffect(() => {
    if (step !== 1) return
    setLoading(true)
    supabase.from('servicos').select('id, nome, duracao_minutos, preco')
      .eq('ativo', true).eq('apenas_manutencao', true).order('preco')
      .then(({ data }) => { if (data) setServicos(data); setLoading(false) })
  }, [step, supabase])

  // Carrega datas disponíveis
  useEffect(() => {
    if (step !== 2 || !servico) return
    setLoading(true)
    const hoje = toStr(new Date())
    const em4Meses = new Date(); em4Meses.setMonth(em4Meses.getMonth() + 4)
    const limFim = toStr(em4Meses)
    const agora = new Date()
    const limiteHoje = agora.getTime() + 4 * 60 * 60 * 1000

    Promise.all([
      supabase.from('disponibilidades').select('id, data, hora_inicio, hora_fim')
        .gte('data', hoje).lte('data', limFim).order('data').order('hora_inicio'),
      supabase.from('agendamentos').select('data, hora_inicio, hora_fim')
        .gte('data', hoje).lte('data', limFim).neq('status', 'cancelado'),
    ]).then(([{ data: disps }, { data: ags }]) => {
      const dispByDate = new Map<string, Disp[]>()
      for (const d of (disps ?? [])) {
        if (!dispByDate.has(d.data)) dispByDate.set(d.data, [])
        dispByDate.get(d.data)!.push({ id: d.id, hora_inicio: d.hora_inicio, hora_fim: d.hora_fim })
      }
      const agByDate = new Map<string, AgExistente[]>()
      for (const a of (ags ?? [])) {
        if (!agByDate.has(a.data)) agByDate.set(a.data, [])
        agByDate.get(a.data)!.push({ hora_inicio: a.hora_inicio, hora_fim: a.hora_fim })
      }
      const available = new Set<string>()
      for (const [dateStr, dateDisps] of dispByDate) {
        const dateAgs = agByDate.get(dateStr) ?? []
        const computed = computeSlots(dateDisps, dateAgs, servico.duracao_minutos)
        const filtered = computed.filter(s => {
          if (dateStr > hoje) return true
          const slotTime = new Date(`${dateStr}T${s.hora_inicio}:00`)
          return slotTime.getTime() >= limiteHoje
        })
        if (filtered.length > 0) available.add(dateStr)
      }
      setDatasDisp(available)
      setLoading(false)
    })
  }, [step, servico, supabase])

  // Carrega horários do dia
  useEffect(() => {
    if (step !== 3 || !data || !servico) return
    setLoading(true)
    const hoje = toStr(new Date())
    const agora = new Date()
    const limiteHoje = agora.getTime() + 4 * 60 * 60 * 1000

    Promise.all([
      supabase.from('disponibilidades').select('id, hora_inicio, hora_fim').eq('data', data).order('hora_inicio'),
      supabase.from('agendamentos').select('hora_inicio, hora_fim').eq('data', data).neq('status', 'cancelado'),
    ]).then(([{ data: disps }, { data: ags }]) => {
      const computed = computeSlots(
        (disps ?? []).map(d => ({ id: d.id, hora_inicio: d.hora_inicio, hora_fim: d.hora_fim })),
        (ags ?? []).map(a => ({ hora_inicio: a.hora_inicio, hora_fim: a.hora_fim })),
        servico.duracao_minutos,
      )
      const filtered = computed.filter(s => {
        if (data > hoje) return true
        const slotTime = new Date(`${data}T${s.hora_inicio}:00`)
        return slotTime.getTime() >= limiteHoje
      })
      setSlots(filtered)
      setLoading(false)
    })
  }, [step, data, servico, supabase])

  async function confirmar() {
    if (!slot || !servico || !data) return
    setSubmitting(true); setErro(null)
    const r = await agendar({
      disponibilidade_id: slot.disponibilidade_id,
      data,
      hora_inicio: slot.hora_inicio,
      servico_id: servico.id,
      cliente_nome: nome,
      cliente_telefone: telefone,
    })
    if (r.ok) setStep(5)
    else setErro(r.erro)
    setSubmitting(false)
  }

  function voltar() {
    if (step === 1) setStep(0)
    else if (step === 2) setStep(1)
    else if (step === 3) setStep(2)
    else if (step === 4) { setStep(3); setErro(null) }
  }

  function podePrevMes() {
    const now = new Date()
    return mes.getFullYear() > now.getFullYear() ||
      (mes.getFullYear() === now.getFullYear() && mes.getMonth() > now.getMonth())
  }

  function renderDias() {
    const y = mes.getFullYear(), m = mes.getMonth()
    const total    = new Date(y, m+1, 0).getDate()
    const primeiro = new Date(y, m, 1).getDay()
    const hoje     = toStr(new Date())
    const cells: React.ReactNode[] = []
    for (let i = 0; i < primeiro; i++) cells.push(<div key={`e${i}`} />)
    for (let d = 1; d <= total; d++) {
      const ds    = `${y}-${pad(m+1)}-${pad(d)}`
      const past  = ds < hoje
      const avail = datasDisponiveis.has(ds)
      const sel   = data === ds
      const off   = past || !avail
      cells.push(
        <div key={d} className="flex flex-col items-center gap-[3px] py-0.5">
          <button
            disabled={off}
            onClick={() => { setData(ds); setStep(3) }}
            className={cn(
              'w-10 h-10 rounded-full text-[13px] font-medium transition-all duration-150',
              sel && 'font-bold',
              !sel && avail && 'text-white hover:bg-[#1E1E1E]',
              off && 'text-zinc-700 cursor-not-allowed',
            )}
            style={sel ? { backgroundColor: GOLD, color: '#000' } : {}}
          >{d}</button>
          {avail && !sel && <div className="w-1 h-1 rounded-full" style={{ backgroundColor: GOLD }} />}
        </div>
      )
    }
    return cells
  }

  const progress = step === 0 ? 0 : step < 5 ? ((step) / 4) * 100 : 100
  const studioNome = config.studio_nome || 'Studio'

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col">

      <header className="sticky top-0 z-20 bg-black">
        <div className="max-w-lg mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo" style={{ height: '32px', width: 'auto' }} />
            <div className="w-0.5 h-6 rounded-full" style={{ backgroundColor: GOLD }} />
            <span className="text-white text-base font-semibold tracking-tight" style={{ fontFamily: 'var(--font-playfair)' }}>
              {studioNome}
            </span>
          </div>
          {step > 0 && step < 5 && (
            <button
              onClick={voltar}
              className="flex items-center gap-1 text-zinc-500 hover:text-white text-sm transition-colors py-2 px-3 -mr-3 rounded-xl active:bg-white/5"
            >
              ← Voltar
            </button>
          )}
        </div>
        {step > 0 && step < 5 && (
          <div className="h-[2px] bg-white/[0.04]">
            <div className="h-full transition-all duration-500 ease-out" style={{ width: `${progress}%`, backgroundColor: GOLD }} />
          </div>
        )}
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-5">

        {/* STEP 0 — Verificação */}
        {step === 0 && (
          <div className="py-10">
            <div className="flex justify-center mb-8">
              <img src="/logo.png" alt="Logo" style={{ width: '180px', height: 'auto' }} />
            </div>
            <div className="mb-8">
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] mb-3" style={{ color: GOLD }}>
                Área exclusiva
              </p>
              <h1 className="text-[2rem] font-bold leading-tight text-white" style={{ fontFamily: 'var(--font-playfair)' }}>
                Manutenção<br />
                <span className="italic" style={{ color: GOLD }}>de cílios</span>
              </h1>
              <p className="text-sm text-zinc-500 mt-3 leading-relaxed">
                Esta área é exclusiva para clientes que já realizaram um serviço no estúdio. Informe seu número de WhatsApp para continuar.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[13px] font-semibold text-zinc-300">WhatsApp</Label>
                <Input
                  type="tel"
                  value={telefoneBusca}
                  onChange={e => { setTelefoneBusca(e.target.value); setErroVerif(null) }}
                  onKeyDown={e => { if (e.key === 'Enter') verificar() }}
                  placeholder="(00) 00000-0000"
                  inputMode="tel"
                  autoComplete="tel"
                  className={INPUT_CLS}
                />
              </div>

              {erroVerif && (
                <div className="flex gap-2 items-start bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
                  <span className="shrink-0 mt-0.5">⚠</span>
                  <span>{erroVerif}</span>
                </div>
              )}

              <button
                onClick={verificar}
                disabled={verificando || !telefoneBusca.trim()}
                className="w-full h-14 rounded-xl text-[15px] font-bold tracking-wide transition-all duration-200 disabled:opacity-30"
                style={{ backgroundColor: GOLD, color: '#000' }}
              >
                {verificando ? 'Verificando...' : 'Continuar'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 1 — Serviço */}
        {step === 1 && (
          <div className="py-8">
            {ultimoServico && (
              <div className="mb-6 flex items-center gap-3 bg-[#D3AF37]/[0.08] border border-[#D3AF37]/20 rounded-2xl px-4 py-3.5">
                <span style={{ color: GOLD }}>✓</span>
                <div>
                  <p className="text-sm font-semibold text-white">Olá, {nome.split(' ')[0]}!</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Último serviço em {fmtDate(ultimoServico)}</p>
                </div>
              </div>
            )}
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-playfair)' }}>
                Qual manutenção<br />
                <span className="italic" style={{ color: GOLD }}>você precisa?</span>
              </h2>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1,2].map(i => <div key={i} className="h-20 rounded-2xl bg-[#111111] animate-pulse" />)}
              </div>
            ) : servicos.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <p className="text-zinc-500 text-sm">Nenhum serviço de manutenção disponível no momento.</p>
                <p className="text-zinc-600 text-xs">Entre em contato com o estúdio para mais informações.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {servicos.map(s => (
                  <button key={s.id} onClick={() => { setServico(s); setStep(2) }} className="w-full text-left group">
                    <div className="flex items-center justify-between px-5 py-4 rounded-2xl border border-[#1E1E1E] bg-[#111111] hover:border-[#D3AF37]/50 hover:bg-[#D3AF37]/[0.04] transition-all duration-200">
                      <div>
                        <p className="font-semibold text-white text-[15px]">{s.nome}</p>
                        <p className="text-[13px] text-zinc-500 mt-0.5">{s.duracao_minutos} min</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-base font-bold" style={{ color: GOLD }}>{fmtBRL(s.preco)}</span>
                        <div className="w-7 h-7 rounded-full border border-[#2C2C2C] flex items-center justify-center group-hover:border-[#D3AF37] group-hover:bg-[#D3AF37] transition-all duration-200">
                          <svg className="w-3.5 h-3.5 text-zinc-500 group-hover:text-black transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 2 — Data */}
        {step === 2 && (
          <div className="py-8">
            <div className="mb-6">
              <div className="inline-flex items-center gap-2 border border-[#2C2C2C] bg-[#111111] rounded-full px-3.5 py-1.5 mb-5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: GOLD }} />
                <span className="text-[13px] font-medium text-zinc-400">{servico?.nome}</span>
              </div>
              <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-playfair)' }}>Escolha a data</h2>
              <p className="text-sm text-zinc-600 mt-1">Dias marcados com • têm horários disponíveis</p>
            </div>

            {loading ? (
              <div className="h-80 rounded-2xl bg-[#111111] animate-pulse" />
            ) : (
              <div className="bg-[#111111] border border-[#1E1E1E] rounded-2xl p-5">
                <div className="flex items-center justify-between mb-5">
                  <button onClick={() => setMes(m => new Date(m.getFullYear(), m.getMonth()-1, 1))} disabled={!podePrevMes()}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:bg-[#1E1E1E] hover:text-white disabled:opacity-20 transition-all text-xl">‹</button>
                  <span className="text-sm font-semibold text-white">{MONTHS[mes.getMonth()]} {mes.getFullYear()}</span>
                  <button onClick={() => setMes(m => new Date(m.getFullYear(), m.getMonth()+1, 1))}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:bg-[#1E1E1E] hover:text-white transition-all text-xl">›</button>
                </div>
                <div className="grid grid-cols-7 mb-1">
                  {WEEKDAYS.map(d => <div key={d} className="text-center text-[10px] font-semibold text-zinc-600 uppercase tracking-wider py-1">{d}</div>)}
                </div>
                <div className="grid grid-cols-7">{renderDias()}</div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3 — Horário */}
        {step === 3 && (
          <div className="py-8">
            <div className="mb-6">
              <div className="inline-flex items-center gap-2 border border-[#2C2C2C] bg-[#111111] rounded-full px-3.5 py-1.5 mb-5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: GOLD }} />
                <span className="text-[13px] font-medium text-zinc-400">{data && fmtDateShort(data)}</span>
              </div>
              <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-playfair)' }}>Qual horário?</h2>
            </div>

            {loading ? (
              <div className="grid grid-cols-3 gap-2.5">
                {[1,2,3,4,5,6].map(i => <div key={i} className="h-12 rounded-xl bg-[#111111] animate-pulse" />)}
              </div>
            ) : slots.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-zinc-500 text-sm mb-4">Nenhum horário disponível.</p>
                <button onClick={() => setStep(2)} className="text-sm font-semibold underline underline-offset-4" style={{ color: GOLD }}>
                  Escolher outra data
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2.5">
                {slots.map(s => (
                  <button key={s.hora_inicio} onClick={() => { setSlot(s); setStep(4) }}
                    className="h-12 rounded-xl border border-[#2C2C2C] bg-[#111111] text-[13px] font-semibold text-zinc-300 hover:border-[#D3AF37]/60 hover:text-[#D3AF37] hover:bg-[#D3AF37]/[0.06] transition-all duration-150">
                    {fmtTime(s.hora_inicio)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 4 — Confirmação */}
        {step === 4 && (
          <div className="py-8">
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-playfair)' }}>Quase lá!</h2>
              <p className="text-sm text-zinc-500 mt-1">Confirme seus dados</p>
            </div>

            <div className="flex flex-wrap gap-2 mb-7">
              {[servico?.nome, data ? fmtDateShort(data) : '', slot ? fmtTime(slot.hora_inicio) : ''].filter(Boolean).map(v => (
                <span key={v} className="text-[12px] font-medium text-zinc-400 bg-[#1A1A1A] border border-[#2C2C2C] px-3 py-1.5 rounded-full">{v}</span>
              ))}
            </div>

            <div className="space-y-5 mb-7">
              <div className="space-y-2">
                <Label className="text-[13px] font-semibold text-zinc-300">Nome</Label>
                <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome" className={INPUT_CLS} />
              </div>
              <div className="space-y-2">
                <Label className="text-[13px] font-semibold text-zinc-300">WhatsApp</Label>
                <Input type="tel" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000" inputMode="tel" className={INPUT_CLS} />
              </div>
            </div>

            <div className="flex items-center justify-between py-4 border-t border-[#1E1E1E] mb-5">
              <span className="text-sm text-zinc-500">Total</span>
              <span className="text-2xl font-bold" style={{ color: GOLD, fontFamily: 'var(--font-playfair)' }}>{servico && fmtBRL(servico.preco)}</span>
            </div>

            {erro && (
              <div className="flex gap-2 items-start bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-4 text-sm text-red-400">
                <span className="mt-0.5 shrink-0">⚠</span>{erro}
              </div>
            )}

            <button
              onClick={confirmar}
              disabled={!nome.trim() || !telefone.trim() || submitting}
              className="w-full h-14 rounded-xl text-[15px] font-bold tracking-wide transition-all duration-200 disabled:opacity-30 active:scale-[0.98]"
              style={{ backgroundColor: GOLD, color: '#000' }}
            >
              {submitting ? 'Confirmando...' : 'Confirmar agendamento'}
            </button>
          </div>
        )}

        {/* STEP 5 — Sucesso */}
        {step === 5 && (
          <div className="py-10">
            <div className="mb-10 text-center">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 border-2" style={{ borderColor: GOLD, backgroundColor: `${GOLD}15` }}>
                <svg className="w-9 h-9" fill="none" viewBox="0 0 24 24" stroke={GOLD} strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-playfair)' }}>Confirmado!</h2>
              <p className="text-zinc-500 text-sm">Te esperamos, <span className="text-zinc-300 font-semibold">{nome}</span></p>
            </div>

            <div className="rounded-2xl border border-[#1E1E1E] overflow-hidden mb-6">
              <div className="px-5 py-3.5 bg-[#111111] border-b border-[#1A1A1A]">
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-500">Resumo</p>
              </div>
              <div className="bg-[#111111] divide-y divide-[#1A1A1A]">
                {[['Serviço', servico?.nome], ['Data', data ? fmtDate(data) : ''], ['Horário', slot ? fmtTime(slot.hora_inicio) : '']].map(([l, v]) => (
                  <div key={l} className="flex justify-between items-center px-5 py-3.5 text-sm">
                    <span className="text-zinc-500">{l}</span>
                    <span className="font-medium text-white text-right max-w-[55%]">{v}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center px-5 py-4">
                  <span className="text-sm text-zinc-500">Valor</span>
                  <span className="text-xl font-bold" style={{ color: GOLD, fontFamily: 'var(--font-playfair)' }}>{servico && fmtBRL(servico.preco)}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 bg-[#D3AF37]/[0.06] border border-[#D3AF37]/20 rounded-2xl p-4 mb-6">
              <span className="text-[#D3AF37] text-base shrink-0">⏰</span>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Para remarcar ou cancelar, avise com pelo menos <strong className="text-zinc-200">48 horas de antecedência</strong>.
              </p>
            </div>

            <button
              onClick={() => { setStep(0); setTelefoneBusca(''); setServico(null); setData(null); setSlot(null); setNome(''); setTelefone(''); setUltimoServico(null) }}
              className="w-full h-12 rounded-xl border font-semibold text-[14px] transition-all duration-200"
              style={{ borderColor: GOLD, color: GOLD }}
            >
              Fazer novo agendamento
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
