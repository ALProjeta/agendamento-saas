'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { agendar } from '@/app/actions/agendar'
import { getConfigPublica } from '@/app/actions/configuracoes'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type Servico    = { id: string; nome: string; duracao_minutos: number; preco: number }
type Disp       = { id: string; hora_inicio: string; hora_fim: string }
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
const fmtDateShort = (s: string) => { const [,m,d] = s.split('-').map(Number); return `${d} de ${MONTHS[m-1]}` }

const INPUT_CLS = 'h-12 rounded-xl bg-[#181818] border-[#2C2C2C] text-white placeholder:text-zinc-600 focus-visible:ring-[#D3AF37] focus-visible:border-[#D3AF37]'

function computeSlots(
  disps: Disp[],
  ags: AgExistente[],
  duracaoMin: number,
): VirtualSlot[] {
  const slots: VirtualSlot[] = []
  for (const disp of disps) {
    const winIni = toMin(disp.hora_inicio)
    const winFim = toMin(disp.hora_fim)
    let t = winIni
    while (t + duracaoMin <= winFim) {
      const tFim = t + duracaoMin
      const tStr    = minToTime(t)
      const tFimStr = minToTime(tFim)
      const conflito = ags.some(ag => {
        const agIni = toMin(ag.hora_inicio)
        const agFim = toMin(ag.hora_fim)
        return tStr < ag.hora_fim.slice(0,5) && tFimStr > ag.hora_inicio.slice(0,5)
          || t < agFim && tFim > agIni
      })
      if (!conflito) {
        slots.push({ disponibilidade_id: disp.id, hora_inicio: tStr, hora_fim: tFimStr })
      }
      t += STEP_MIN
    }
  }
  return slots
}

export default function Page() {
  const supabase = useMemo(() => createClient(), [])

  const [step, setStep]                   = useState(1)
  const [servicos, setServicos]           = useState<Servico[]>([])
  const [servico, setServico]             = useState<Servico | null>(null)
  const [mes, setMes]                     = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [datasDisponiveis, setDatasDisp]  = useState<Set<string>>(new Set())
  const [data, setData]                   = useState<string | null>(null)
  const [slots, setSlots]                 = useState<VirtualSlot[]>([])
  const [slot, setSlot]                   = useState<VirtualSlot | null>(null)
  const [nome, setNome]                   = useState('')
  const [telefone, setTelefone]           = useState('')
  const [observacao, setObservacao]       = useState('')
  const [loading, setLoading]             = useState(false)
  const [submitting, setSubmitting]       = useState(false)
  const [erro, setErro]                   = useState<string | null>(null)
  const [shareCopiado, setShareCopiado]   = useState(false)
  const [config, setConfig]               = useState<Record<string, string>>({})

  // Step 1: load services
  useEffect(() => {
    setLoading(true)
    supabase.from('servicos').select('*').eq('ativo', true).order('preco')
      .then(({ data }) => { if (data) setServicos(data); setLoading(false) })
    getConfigPublica().then(setConfig).catch(() => {})
  }, [supabase])

  // Step 2: load available dates (days that have at least one window fitting the service)
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
      // Group by date
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

  // Step 3: load slots for selected date
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
      observacao,
    })
    if (r.ok) setStep(5)
    else setErro(r.erro)
    setSubmitting(false)
  }

  function voltar() {
    if (step === 2) setStep(1)
    else if (step === 3) setStep(2)
    else if (step === 4) { setStep(3); setErro(null) }
  }

  function reiniciar() {
    setStep(1); setServico(null); setData(null); setSlot(null)
    setNome(''); setTelefone(''); setObservacao(''); setErro(null)
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
          >
            {d}
          </button>
          {avail && !sel && <div className="w-1 h-1 rounded-full" style={{ backgroundColor: GOLD }} />}
        </div>
      )
    }
    return cells
  }

  const progress = step < 5 ? ((step - 1) / 4) * 100 : 100

  const waNumber  = config.whatsapp?.replace(/\D/g, '') ?? ''
  const waLink    = waNumber ? `https://wa.me/55${waNumber}` : ''
  const igHandle  = config.instagram ?? ''
  const igLink    = igHandle ? `https://instagram.com/${igHandle}` : ''
  const endereco  = config.endereco ?? ''

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col">

      <header className="sticky top-0 z-20 bg-black">
        <div className="max-w-lg mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-0.5 h-6 rounded-full" style={{ backgroundColor: GOLD }} />
            <span className="text-white text-lg font-semibold tracking-tight" style={{ fontFamily: 'var(--font-playfair)' }}>
              {config.studio_nome || process.env.NEXT_PUBLIC_STUDIO_NAME || 'Studio'}
            </span>
          </div>
          {step > 1 && step < 5 && (
            <button
              onClick={voltar}
              className="flex items-center gap-1 text-zinc-500 hover:text-white text-sm transition-colors py-2 px-3 -mr-3 rounded-xl active:bg-white/5"
            >
              ← Voltar
            </button>
          )}
        </div>
        {step < 5 && (
          <div className="h-[2px] bg-white/[0.04]">
            <div className="h-full transition-all duration-500 ease-out" style={{ width: `${progress}%`, backgroundColor: GOLD }} />
          </div>
        )}
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-5">

        {/* STEP 1 — Serviço */}
        {step === 1 && (
          <div className="py-10">
            <div className="flex justify-center mb-6">
              <img src="/logo.png" alt="Logo" style={{ width: '200px', height: 'auto' }} />
            </div>
            <div className="mb-8">
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] mb-3" style={{ color: GOLD }}>
                Agendamento Online
              </p>
              <h1 className="text-[2rem] font-bold leading-tight text-white" style={{ fontFamily: 'var(--font-playfair)' }}>
                O que você<br />
                <span className="italic" style={{ color: GOLD }}>gostaria de fazer?</span>
              </h1>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl bg-[#111111] animate-pulse" />)}
              </div>
            ) : servicos.length === 0 ? (
              <p className="text-zinc-600 text-sm py-10 text-center">Nenhum serviço disponível no momento.</p>
            ) : (
              <div className="space-y-2.5">
                {servicos.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setServico(s); setStep(2) }}
                    className="w-full text-left group"
                  >
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
              <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-playfair)' }}>
                Escolha a data
              </h2>
              <p className="text-sm text-zinc-600 mt-1">Dias marcados com • têm horários disponíveis</p>
            </div>

            {loading ? (
              <div className="h-80 rounded-2xl bg-[#111111] animate-pulse" />
            ) : (
              <div className="bg-[#111111] border border-[#1E1E1E] rounded-2xl p-5">
                <div className="flex items-center justify-between mb-5">
                  <button
                    onClick={() => setMes(m => new Date(m.getFullYear(), m.getMonth()-1, 1))}
                    disabled={!podePrevMes()}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:bg-[#1E1E1E] hover:text-white disabled:opacity-20 transition-all text-xl"
                  >‹</button>
                  <span className="text-sm font-semibold text-white">
                    {MONTHS[mes.getMonth()]} {mes.getFullYear()}
                  </span>
                  <button
                    onClick={() => setMes(m => new Date(m.getFullYear(), m.getMonth()+1, 1))}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:bg-[#1E1E1E] hover:text-white transition-all text-xl"
                  >›</button>
                </div>
                <div className="grid grid-cols-7 mb-1">
                  {WEEKDAYS.map(d => (
                    <div key={d} className="text-center text-[10px] font-semibold text-zinc-600 uppercase tracking-wider py-1">{d}</div>
                  ))}
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
              <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-playfair)' }}>
                Qual horário?
              </h2>
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
                  <button
                    key={s.hora_inicio}
                    onClick={() => { setSlot(s); setStep(4) }}
                    className="h-12 rounded-xl border border-[#2C2C2C] bg-[#111111] text-[13px] font-semibold text-zinc-300 hover:border-[#D3AF37]/60 hover:text-[#D3AF37] hover:bg-[#D3AF37]/[0.06] transition-all duration-150"
                  >
                    {fmtTime(s.hora_inicio)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 4 — Dados */}
        {step === 4 && (
          <div className="py-8">
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-playfair)' }}>
                Quase lá!
              </h2>
              <p className="text-sm text-zinc-500 mt-1">Só precisamos de algumas informações</p>
            </div>

            <div className="flex flex-wrap gap-2 mb-7">
              {[servico?.nome, data ? fmtDateShort(data) : '', slot ? fmtTime(slot.hora_inicio) : ''].filter(Boolean).map(v => (
                <span key={v} className="text-[12px] font-medium text-zinc-400 bg-[#1A1A1A] border border-[#2C2C2C] px-3 py-1.5 rounded-full">
                  {v}
                </span>
              ))}
            </div>

            <div className="space-y-5 mb-7">
              <div className="space-y-2">
                <Label htmlFor="nome" className="text-[13px] font-semibold text-zinc-300">Nome completo</Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Seu nome"
                  autoComplete="name"
                  inputMode="text"
                  className={INPUT_CLS}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tel" className="text-[13px] font-semibold text-zinc-300">WhatsApp</Label>
                <Input
                  id="tel"
                  type="tel"
                  value={telefone}
                  onChange={e => setTelefone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  autoComplete="tel"
                  inputMode="tel"
                  className={INPUT_CLS}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="obs" className="text-[13px] font-semibold text-zinc-300">
                  Observação <span className="font-normal text-zinc-500">(opcional)</span>
                </Label>
                <textarea
                  id="obs"
                  value={observacao}
                  onChange={e => setObservacao(e.target.value)}
                  placeholder="Alergias, preferências, pedidos especiais..."
                  rows={3}
                  className="w-full rounded-xl bg-[#181818] border border-[#2C2C2C] px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#D3AF37] resize-none transition-all"
                  style={{ fontSize: 'max(16px, 1em)' }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between py-4 border-t border-[#1E1E1E] mb-5">
              <span className="text-sm text-zinc-500">Total</span>
              <span className="text-2xl font-bold" style={{ color: GOLD, fontFamily: 'var(--font-playfair)' }}>
                {servico && fmtBRL(servico.preco)}
              </span>
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

        {/* STEP 5 — Confirmação */}
        {step === 5 && (
          <div className="py-10">
            <div className="mb-10 text-center">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 border-2"
                style={{ borderColor: GOLD, backgroundColor: `${GOLD}15` }}
              >
                <svg className="w-9 h-9" fill="none" viewBox="0 0 24 24" stroke={GOLD} strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-playfair)' }}>
                Confirmado!
              </h2>
              <p className="text-zinc-500 text-sm">
                Te esperamos, <span className="text-zinc-300 font-semibold">{nome}</span>
              </p>
            </div>

            <div className="rounded-2xl border border-[#1E1E1E] overflow-hidden mb-3">
              <div className="px-5 py-3.5 bg-[#111111] border-b border-[#1A1A1A]">
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-500">Resumo do agendamento</p>
              </div>
              <div className="bg-[#111111] divide-y divide-[#1A1A1A]">
                {[
                  ['Serviço', servico?.nome],
                  ['Data', data ? fmtDate(data) : ''],
                  ['Horário', slot ? fmtTime(slot.hora_inicio) : ''],
                ].map(([l, v]) => (
                  <div key={l} className="flex justify-between items-center px-5 py-3.5 text-sm">
                    <span className="text-zinc-500">{l}</span>
                    <span className="font-medium text-white text-right max-w-[55%]">{v}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center px-5 py-4">
                  <span className="text-sm text-zinc-500">Valor</span>
                  <span className="text-xl font-bold" style={{ color: GOLD, fontFamily: 'var(--font-playfair)' }}>
                    {servico && fmtBRL(servico.preco)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 bg-[#D3AF37]/[0.06] border border-[#D3AF37]/20 rounded-2xl p-4 mb-3">
              <span className="text-[#D3AF37] text-base shrink-0">⏰</span>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Para remarcar ou cancelar, avise com pelo menos{' '}
                <strong className="text-zinc-200">48 horas de antecedência</strong>.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <button
                onClick={() => {
                  if (!servico || !data || !slot) return
                  const [y, mo, d] = data.split('-')
                  const [h, min] = slot.hora_inicio.split(':').map(Number)
                  const p2 = (n: number) => String(n).padStart(2, '0')
                  const dt = `${y}${mo}${d}`
                  const endMin = h * 60 + min + servico.duracao_minutos
                  const ics = [
                    'BEGIN:VCALENDAR', 'VERSION:2.0', 'CALSCALE:GREGORIAN',
                    'BEGIN:VEVENT',
                    `DTSTART:${dt}T${p2(h)}${p2(min)}00`,
                    `DTEND:${dt}T${p2(Math.floor(endMin/60))}${p2(endMin%60)}00`,
                    `SUMMARY:${servico.nome} — ${config.studio_nome || process.env.NEXT_PUBLIC_STUDIO_NAME || 'Studio'}`,
                    `DESCRIPTION:Agendamento confirmado para ${nome}`,
                    'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY',
                    'DESCRIPTION:Seu horário é em 1 hora!', 'END:VALARM',
                    'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY',
                    'DESCRIPTION:Seu horário é amanhã!', 'END:VALARM',
                    'END:VEVENT', 'END:VCALENDAR',
                  ].join('\r\n')
                  const a = document.createElement('a')
                  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
                  a.download = 'agendamento.ics'
                  a.click()
                }}
                className="h-12 rounded-xl border border-[#2C2C2C] text-zinc-300 hover:border-[#D3AF37]/40 hover:text-[#D3AF37] text-[13px] font-semibold transition-all flex items-center justify-center gap-2"
              >
                📅 Salvar no calendário
              </button>
              <button
                onClick={async () => {
                  if (!servico || !data || !slot) return
                  const texto = `✅ Agendamento confirmado!\n\n💅 ${servico.nome}\n📅 ${fmtDate(data)}\n⏰ ${fmtTime(slot.hora_inicio)}\n\nTe esperamos, ${nome}!`
                  if (navigator.share) {
                    try { await navigator.share({ title: 'Meu Agendamento', text: texto }) } catch { /* cancelado */ }
                  } else {
                    await navigator.clipboard.writeText(texto)
                    setShareCopiado(true)
                    setTimeout(() => setShareCopiado(false), 2500)
                  }
                }}
                className="h-12 rounded-xl text-[13px] font-semibold transition-all flex items-center justify-center gap-2 border"
                style={{ borderColor: GOLD + '50', color: GOLD, backgroundColor: GOLD + '12' }}
              >
                {shareCopiado ? '✓ Copiado!' : '↗ Compartilhar'}
              </button>
            </div>

            {(() => {
              const cfgLoaded = Object.keys(config).length > 0
              const metodos: [string, string, string | null][] = cfgLoaded
                ? [
                    config.pix_habilitado      !== 'false' ? ['💸', 'PIX',     config.pix_chave      || null] as [string, string, string | null] : null,
                    config.cartao_habilitado   !== 'false' ? ['💳', 'Cartão',  config.cartao_descricao || null] as [string, string, string | null] : null,
                    config.dinheiro_habilitado !== 'false' ? ['💵', 'Dinheiro', null] as [string, string, string | null] : null,
                  ].filter((x): x is [string, string, string | null] => x !== null)
                : [['💸', 'PIX', null], ['💳', 'Cartão', null], ['💵', 'Dinheiro', null]]
              if (metodos.length === 0) return null
              return (
                <div className="rounded-2xl border border-[#1E1E1E] overflow-hidden mb-8">
                  <div className="px-5 py-3.5 bg-[#111111] border-b border-[#1A1A1A]">
                    <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-500">Formas de pagamento</p>
                  </div>
                  <div className="bg-[#111111] divide-y divide-[#1A1A1A]">
                    {metodos.map(([icon, title, sub]) => (
                      <div key={title} className="flex items-start gap-3 px-5 py-3.5">
                        <span className="text-base">{icon}</span>
                        <div>
                          <p className="text-sm font-medium text-zinc-200">{title}</p>
                          {sub && <p className="text-xs text-zinc-600 mt-0.5">{sub}</p>}
                        </div>
                      </div>
                    ))}
                    <div className="px-5 py-3">
                      <p className="text-xs text-zinc-600">Pagamento presencialmente no dia do atendimento.</p>
                    </div>
                  </div>
                </div>
              )
            })()}

            <button
              onClick={reiniciar}
              className="w-full h-12 rounded-xl border font-semibold text-[14px] transition-all duration-200 hover:text-black"
              style={{ borderColor: GOLD, color: GOLD }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = GOLD }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent' }}
            >
              Fazer novo agendamento
            </button>
          </div>
        )}
      </main>

      {/* Rodapé */}
      {(endereco || igLink) && (
        <footer className="max-w-lg mx-auto w-full px-5 pb-8 pt-4 border-t border-[#1A1A1A] mt-4">
          <div className="flex flex-col gap-3">
            {endereco && (
              <div className="flex items-start gap-2.5 text-zinc-500 text-[13px]">
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <span>{endereco}</span>
              </div>
            )}
            {igLink && (
              <a
                href={igLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 text-zinc-500 hover:text-zinc-300 text-[13px] transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                </svg>
                @{igHandle}
              </a>
            )}
          </div>
        </footer>
      )}

      {/* Botão flutuante WhatsApp */}
      {waLink && (
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Fale conosco pelo WhatsApp"
          className="fixed bottom-6 right-5 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110 active:scale-95"
          style={{ backgroundColor: '#25D366' }}
        >
          <svg className="w-7 h-7" fill="white" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </a>
      )}
    </div>
  )
}
