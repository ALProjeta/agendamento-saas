'use client'

import { useState, useTransition } from 'react'
import { atualizarStatus } from '@/app/actions/agenda'
import { cn } from '@/lib/utils'

export type Pendencia = {
  id: string
  cliente_nome: string
  cliente_telefone: string | null
  data: string
  hora_inicio: string
  hora_fim: string
  observacao: string | null
  servico_nome: string
}

const GOLD = '#D3AF37'
const MONTHS = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

function fmtData(ds: string) {
  const [y, m, d] = ds.split('-').map(Number)
  return `${d} de ${MONTHS[m - 1]} de ${y}`
}

function fmtTime(t: string) { return t.slice(0, 5) }

type Status = 'concluido' | 'cancelado'

export default function PendenciasClient({
  pendencias,
  studioNome,
}: {
  pendencias: Pendencia[]
  studioNome: string
}) {
  const [, startTransition] = useTransition()
  const [resolvidos, setResolvidos] = useState<Set<string>>(new Set())
  const [pendingMap, setPendingMap] = useState<Record<string, Status>>({})

  function handleAtualizarStatus(id: string, status: Status) {
    setPendingMap(prev => ({ ...prev, [id]: status }))
    startTransition(async () => {
      const r = await atualizarStatus(id, status)
      if (r.ok) {
        setResolvidos(prev => new Set([...prev, id]))
      }
      setPendingMap(prev => { const next = { ...prev }; delete next[id]; return next })
    })
  }

  const visiveis = pendencias.filter(p => !resolvidos.has(p.id))

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <header className="bg-black sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo" style={{ height: '32px', width: 'auto' }} />
            <div className="w-0.5 h-6 rounded-full" style={{ backgroundColor: GOLD }} />
            <span className="text-white text-lg font-semibold" style={{ fontFamily: 'var(--font-playfair)' }}>{studioNome}</span>
          </div>
          <span className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: GOLD }}>Pendentes</span>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 pb-safe-nav space-y-5">

        {/* Contador */}
        <div className="bg-[#111111] rounded-2xl border border-[#1E1E1E] p-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Aguardando atualização</p>
          <p className="text-4xl font-bold text-white leading-none" style={{ fontFamily: 'var(--font-playfair)' }}>
            {visiveis.length}
          </p>
          <p className="text-[12px] text-zinc-600 mt-2">
            {visiveis.length === 0
              ? 'Tudo em dia! Nenhum atendimento aguardando status.'
              : `Atendimento${visiveis.length > 1 ? 's' : ''} passado${visiveis.length > 1 ? 's' : ''} sem status final registrado.`}
          </p>
        </div>

        {visiveis.length === 0 && (
          <div className="bg-[#111111] rounded-2xl border border-[#1E1E1E] py-16 flex flex-col items-center gap-3 text-center px-6">
            <span className="text-4xl">✓</span>
            <p className="font-semibold text-zinc-400">Nenhuma pendência encontrada</p>
            <p className="text-sm text-zinc-600">Todos os atendimentos passados já têm status registrado.</p>
          </div>
        )}

        {visiveis.length > 0 && (
          <div className="bg-[#111111] rounded-2xl border border-[#1E1E1E] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#1A1A1A]">
              <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Atendimentos sem status final</p>
            </div>
            <div className="divide-y divide-[#1A1A1A]">
              {visiveis.map(p => {
                const isPending = p.id in pendingMap
                return (
                  <div key={p.id} className={cn('px-5 py-4 transition-opacity', isPending && 'opacity-40')}>
                    {/* Data e hora */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="text-[13px] font-bold text-white leading-snug" style={{ fontFamily: 'var(--font-playfair)' }}>
                          {p.cliente_nome}
                        </p>
                        <p className="text-[11px] text-zinc-500 mt-0.5">{p.servico_nome}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[12px] font-semibold" style={{ color: GOLD }}>
                          {fmtTime(p.hora_inicio)} – {fmtTime(p.hora_fim)}
                        </p>
                        <p className="text-[11px] text-zinc-600 mt-0.5">{fmtData(p.data)}</p>
                      </div>
                    </div>

                    {p.observacao && (
                      <p className="text-[11px] text-zinc-600 italic mb-3 border-l-2 border-[#2C2C2C] pl-2">
                        {p.observacao}
                      </p>
                    )}

                    {/* Ações */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAtualizarStatus(p.id, 'concluido')}
                        disabled={isPending}
                        className="flex-1 h-9 rounded-xl text-[12px] font-bold transition-all disabled:opacity-30 border border-emerald-500/40 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
                      >
                        {isPending && pendingMap[p.id] === 'concluido' ? '...' : '✓ Concluído'}
                      </button>
                      <button
                        onClick={() => handleAtualizarStatus(p.id, 'cancelado')}
                        disabled={isPending}
                        className="flex-1 h-9 rounded-xl text-[12px] font-bold transition-all disabled:opacity-30 border border-red-500/30 text-red-400 bg-red-500/5 hover:bg-red-500/15"
                      >
                        {isPending && pendingMap[p.id] === 'cancelado' ? '...' : '✗ Cancelado'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
