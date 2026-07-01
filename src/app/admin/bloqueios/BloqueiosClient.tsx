'use client'

import { useState, useTransition } from 'react'
import { verificarConflitos, criarBloqueio, removerBloqueio } from '@/app/actions/bloqueios'
import type { Conflito } from '@/app/actions/bloqueios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export type Bloqueio = {
  id: string
  data_inicio: string
  data_fim: string
  motivo: string | null
  criado_em: string
}

const GOLD = '#D3AF37'

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function fmtDate(s: string) {
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

function fmtTime(t: string) { return t.slice(0, 5) }

function hoje() { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) }

function amanha() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

function getBloqueioStatus(dataInicio: string, dataFim: string) {
  const h = hoje()
  if (dataFim < h) return 'encerrado'
  if (dataInicio > h) return 'futuro'
  return 'ativo'
}

type Feedback = { tipo: 'ok' | 'erro'; msg: string }

// ── Modal de confirmação de conflitos ───────────────────────
function ConflitosModal({
  conflitos,
  onCancelar,
  onConfirmar,
  pending,
}: {
  conflitos: Conflito[]
  onCancelar: () => void
  onConfirmar: () => void
  pending: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancelar} />
      <div className="relative w-full max-w-md bg-[#111111] border border-[#1E1E1E] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-amber-500 mb-1">Atenção</p>
          <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'var(--font-playfair)' }}>
            {conflitos.length} agendamento{conflitos.length > 1 ? 's' : ''} encontrado{conflitos.length > 1 ? 's' : ''}
          </h2>
          <p className="text-sm text-zinc-500 mt-1.5">
            Há clientes agendados neste período. Ao confirmar, os agendamentos abaixo serão <strong className="text-amber-400">cancelados automaticamente</strong>. Recomendamos avisá-los pelo WhatsApp.
          </p>
        </div>

        {/* Lista de conflitos */}
        <div className="mx-6 mb-4 rounded-xl border border-[#1E1E1E] overflow-hidden divide-y divide-[#1A1A1A] max-h-48 overflow-y-auto">
          {conflitos.map(c => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3">
              <div className="w-1 h-8 rounded-full bg-amber-300 shrink-0" />
              <div>
                <p className="text-[14px] font-semibold text-white leading-none">{c.cliente_nome}</p>
                <p className="text-[12px] text-zinc-500 mt-0.5">
                  {fmtDate(c.data)} às {fmtTime(c.hora_inicio)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Ações */}
        <div className="flex gap-3 px-6 pb-6">
          <Button
            type="button"
            variant="outline"
            onClick={onCancelar}
            disabled={pending}
            className="flex-1 h-11 rounded-xl border-[#2C2C2C] text-zinc-400"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={onConfirmar}
            disabled={pending}
            className="flex-1 h-11 rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-white border-0 disabled:opacity-40"
          >
            {pending ? 'Salvando...' : 'Bloquear mesmo assim'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Card de bloqueio ────────────────────────────────────────
function BloqueioCard({
  bloqueio,
  onRemover,
  removePending,
}: {
  bloqueio: Bloqueio
  onRemover: () => void
  removePending: boolean
}) {
  const status = getBloqueioStatus(bloqueio.data_inicio, bloqueio.data_fim)
  const isSameDay = bloqueio.data_inicio === bloqueio.data_fim

  const statusStyle = {
    ativo: { label: 'Ativo', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-100' },
    futuro: { label: 'Futuro', cls: 'bg-blue-50 text-blue-600 border border-blue-100' },
    encerrado: { label: 'Encerrado', cls: 'bg-[#1E1E1E] text-zinc-600 border border-[#2C2C2C]' },
  }[status]

  const barColor = status === 'ativo' ? '#10b981' : status === 'futuro' ? GOLD : '#e5e7eb'

  return (
    <div className={cn('flex items-center gap-3 px-5 py-4 transition-opacity', removePending && 'opacity-40')}>
      <div className="w-1 h-12 rounded-full shrink-0" style={{ backgroundColor: barColor }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={cn(
            'text-[15px] font-bold leading-snug',
            status === 'encerrado' ? 'text-zinc-500' : 'text-white',
          )} style={{ fontFamily: 'var(--font-playfair)' }}>
            {isSameDay ? fmtDate(bloqueio.data_inicio) : `${fmtDate(bloqueio.data_inicio)} → ${fmtDate(bloqueio.data_fim)}`}
          </p>
          <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full', statusStyle.cls)}>
            {statusStyle.label}
          </span>
        </div>
        {bloqueio.motivo ? (
          <p className="text-[12px] text-zinc-500 mt-0.5 truncate">{bloqueio.motivo}</p>
        ) : (
          <p className="text-[12px] text-zinc-700 mt-0.5">Sem motivo registrado</p>
        )}
      </div>
      <button
        onClick={onRemover}
        disabled={removePending}
        className="w-8 h-8 rounded-full border border-[#2C2C2C] flex items-center justify-center text-zinc-500 hover:border-red-200 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-40 shrink-0"
        title="Remover bloqueio"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ── Componente principal ────────────────────────────────────
export default function BloqueiosClient({ bloqueios, studioNome }: { bloqueios: Bloqueio[]; studioNome: string }) {
  const [dataInicio, setDataInicio] = useState(hoje())
  const [dataFim, setDataFim] = useState(hoje())
  const [motivo, setMotivo] = useState('')
  const [erroForm, setErroForm] = useState<string | null>(null)
  const [verificando, setVerificando] = useState(false)

  const [conflitos, setConflitos] = useState<Conflito[] | null>(null)
  const [confirmPending, setConfirmPending] = useState(false)

  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [, startTransition] = useTransition()
  const [removePendingId, setRemovePendingId] = useState<string | null>(null)

  function showFeedback(f: Feedback) {
    setFeedback(f)
    setTimeout(() => setFeedback(null), 4000)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!dataInicio || !dataFim) return setErroForm('Informe as datas do bloqueio.')
    if (dataFim < dataInicio) return setErroForm('A data de fim deve ser igual ou posterior ao início.')
    setErroForm(null)
    setVerificando(true)

    const { conflitos: lista } = await verificarConflitos(dataInicio, dataFim)

    setVerificando(false)

    if (lista.length > 0) {
      setConflitos(lista)
    } else {
      await salvar()
    }
  }

  async function salvar(cancelarConflitos = false) {
    setConfirmPending(true)
    const ids = cancelarConflitos && conflitos ? conflitos.map(c => c.id) : undefined
    const r = await criarBloqueio(dataInicio, dataFim, motivo, ids)
    setConfirmPending(false)
    setConflitos(null)

    if (r.ok) {
      const msg = cancelarConflitos && ids?.length
        ? `Bloqueio criado e ${ids.length} agendamento${ids.length > 1 ? 's cancelados' : ' cancelado'}.`
        : 'Bloqueio adicionado com sucesso!'
      showFeedback({ tipo: 'ok', msg })
      setDataInicio(hoje())
      setDataFim(hoje())
      setMotivo('')
    } else {
      showFeedback({ tipo: 'erro', msg: r.erro })
    }
  }

  function handleRemover(id: string) {
    setRemovePendingId(id)
    startTransition(async () => {
      const r = await removerBloqueio(id)
      if (!r.ok) showFeedback({ tipo: 'erro', msg: r.erro })
      setRemovePendingId(null)
    })
  }

  const ativos = bloqueios.filter(b => getBloqueioStatus(b.data_inicio, b.data_fim) !== 'encerrado')
  const encerrados = bloqueios.filter(b => getBloqueioStatus(b.data_inicio, b.data_fim) === 'encerrado')

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Header */}
      <header className="bg-black sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo" style={{ height: '32px', width: 'auto' }} />
            <div className="w-0.5 h-6 rounded-full" style={{ backgroundColor: GOLD }} />
            <span className="text-white text-lg font-semibold" style={{ fontFamily: 'var(--font-playfair)' }}>{studioNome}</span>
          </div>
          <span className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: GOLD }}>
            Bloqueios
          </span>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 pb-safe-nav space-y-5">

        {/* Feedback */}
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

        {/* Formulário */}
        <div className="bg-[#111111] rounded-2xl border border-[#1E1E1E] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1A1A1A]">
            <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Novo bloqueio</p>
            <p className="text-[13px] text-zinc-500 mt-0.5">Defina o período em que não haverá atendimento.</p>
          </div>

          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[13px] font-semibold text-zinc-300">Data de início</Label>
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={e => {
                    setDataInicio(e.target.value)
                    if (e.target.value > dataFim) setDataFim(e.target.value)
                  }}
                  className="h-11 rounded-xl border-[#2C2C2C] focus-visible:ring-gray-900 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px] font-semibold text-zinc-300">Data de fim</Label>
                <Input
                  type="date"
                  value={dataFim}
                  min={dataInicio}
                  onChange={e => setDataFim(e.target.value)}
                  className="h-11 rounded-xl border-[#2C2C2C] focus-visible:ring-gray-900 text-sm"
                />
              </div>
            </div>

            {/* Preview do período */}
            {dataInicio && dataFim && (
              <div
                className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[12px] font-medium"
                style={{ backgroundColor: `${GOLD}15`, color: '#9a7c1a' }}
              >
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                {dataInicio === dataFim
                  ? `Bloqueio em ${fmtDate(dataInicio)}`
                  : `De ${fmtDate(dataInicio)} até ${fmtDate(dataFim)}`}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-[13px] font-semibold text-zinc-300">
                Motivo <span className="font-normal text-zinc-500">(opcional)</span>
              </Label>
              <Input
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                placeholder="Ex: Férias, curso, evento..."
                className="h-11 rounded-xl border-[#2C2C2C] focus-visible:ring-gray-900"
              />
            </div>

            {erroForm && (
              <p className="text-sm text-red-600 flex items-center gap-1.5">
                <span>⚠</span> {erroForm}
              </p>
            )}

            <Button
              type="submit"
              disabled={verificando}
              className="w-full h-11 rounded-xl font-bold disabled:opacity-40"
              style={{ backgroundColor: '#D3AF37', color: '#000' }}
            >
              {verificando ? 'Verificando agendamentos...' : 'Adicionar bloqueio'}
            </Button>
          </form>
        </div>

        {/* Lista — ativos e futuros */}
        <div className="bg-[#111111] rounded-2xl border border-[#1E1E1E] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#1A1A1A]">
            <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
              Bloqueios — {ativos.length} ativo{ativos.length !== 1 ? 's' : ''}
            </p>
          </div>

          {ativos.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-2 text-center">
              <span className="text-3xl">🗓</span>
              <p className="text-sm font-medium text-zinc-500">Nenhum bloqueio ativo ou futuro.</p>
              <p className="text-xs text-zinc-700">Use o formulário acima para adicionar.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#1A1A1A]">
              {ativos.map(b => (
                <BloqueioCard
                  key={b.id}
                  bloqueio={b}
                  onRemover={() => handleRemover(b.id)}
                  removePending={removePendingId === b.id}
                />
              ))}
            </div>
          )}
        </div>

        {/* Lista — encerrados */}
        {encerrados.length > 0 && (
          <div className="bg-[#111111] rounded-2xl border border-[#1E1E1E] overflow-hidden opacity-60">
            <div className="px-5 py-3.5 border-b border-[#1A1A1A]">
              <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                Encerrados — {encerrados.length}
              </p>
            </div>
            <div className="divide-y divide-[#1A1A1A]">
              {encerrados.map(b => (
                <BloqueioCard
                  key={b.id}
                  bloqueio={b}
                  onRemover={() => handleRemover(b.id)}
                  removePending={removePendingId === b.id}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal de conflitos */}
      {conflitos !== null && (
        <ConflitosModal
          conflitos={conflitos}
          onCancelar={() => setConflitos(null)}
          onConfirmar={() => salvar(true)}
          pending={confirmPending}
        />
      )}
    </div>
  )
}
