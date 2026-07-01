'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { criarServico, atualizarServico, toggleAtivo } from '@/app/actions/servicos'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export type Servico = {
  id: string; nome: string; duracao_minutos: number; preco: number; ativo: boolean; apenas_manutencao?: boolean
}

const GOLD = '#D3AF37'
const INPUT_CLS = 'h-11 rounded-xl bg-[#181818] border-[#2C2C2C] text-white placeholder:text-zinc-600 focus-visible:ring-[#D3AF37] focus-visible:border-[#D3AF37]'

function fmtBRL(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

type Feedback = { tipo: 'ok' | 'erro'; msg: string }

function ServicoModal({ servico, onClose, onFeedback }: {
  servico: Servico | null; onClose: () => void; onFeedback: (f: Feedback) => void
}) {
  const isEdit = servico !== null
  const [nome, setNome]               = useState(servico?.nome ?? '')
  const [duracao, setDuracao]         = useState(servico ? String(servico.duracao_minutos) : '')
  const [preco, setPreco]             = useState(servico ? String(servico.preco) : '')
  const [apenasManut, setApenasManut] = useState(servico?.apenas_manutencao === true)
  const [erroLocal, setErroLocal]     = useState<string | null>(null)
  const [pending, setPending]         = useState(false)
  const primeiroInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    primeiroInput.current?.focus()
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const dur = parseInt(duracao), prc = parseFloat(preco.replace(',', '.'))
    if (!nome.trim()) return setErroLocal('Informe o nome do servico.')
    if (!dur || dur <= 0) return setErroLocal('Duracao deve ser maior que zero.')
    if (isNaN(prc) || prc <= 0) return setErroLocal('Preco deve ser maior que zero.')
    setErroLocal(null); setPending(true)
    const result = isEdit ? await atualizarServico(servico.id, nome, dur, prc, apenasManut) : await criarServico(nome, dur, prc, apenasManut)
    setPending(false)
    if (result.ok) { onFeedback({ tipo: 'ok', msg: isEdit ? 'Servico atualizado!' : 'Servico criado!' }); onClose() }
    else setErroLocal(result.erro)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#111111] border border-[#1E1E1E] rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#1A1A1A]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">{isEdit ? 'Editar servico' : 'Novo servico'}</p>
            <h2 className="text-lg font-bold text-white mt-0.5" style={{ fontFamily: 'var(--font-playfair)' }}>
              {isEdit ? servico.nome : 'Adicionar servico'}
            </h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-600 hover:bg-[#1E1E1E] hover:text-white transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[13px] font-semibold text-zinc-400">Nome do servico</Label>
            <Input ref={primeiroInput} value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Hidratacao capilar" className={INPUT_CLS} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[13px] font-semibold text-zinc-400">Duracao (min)</Label>
              <Input type="number" min="1" value={duracao} onChange={e => setDuracao(e.target.value)} placeholder="130" className={INPUT_CLS} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] font-semibold text-zinc-400">Preco (R$)</Label>
              <Input type="number" min="0" step="0.01" value={preco} onChange={e => setPreco(e.target.value)} placeholder="150,00" className={INPUT_CLS} />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setApenasManut(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all"
            style={{
              borderColor: apenasManut ? GOLD + '60' : '#2C2C2C',
              backgroundColor: apenasManut ? GOLD + '10' : '#181818',
            }}
          >
            <div className="text-left">
              <p className="text-[13px] font-semibold" style={{ color: apenasManut ? GOLD : '#A1A1AA' }}>
                Serviço de manutenção
              </p>
              <p className="text-[11px] text-zinc-600 mt-0.5">Visível apenas na página exclusiva para clientes recorrentes</p>
            </div>
            <div
              className="relative w-10 h-5 rounded-full transition-all duration-200 flex-shrink-0 ml-3"
              style={{ backgroundColor: apenasManut ? GOLD : '#2C2C2C' }}
            >
              <span
                className="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all duration-200 shadow-sm"
                style={{ left: apenasManut ? '22px' : '2px' }}
              />
            </div>
          </button>
          {erroLocal && <p className="text-sm text-red-400 flex items-center gap-1.5"><span>warning</span> {erroLocal}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 h-11 rounded-xl border border-[#2C2C2C] text-zinc-400 hover:text-white hover:border-[#3A3A3A] transition-all font-semibold">
              Cancelar
            </button>
            <button type="submit" disabled={pending} className="flex-1 h-11 rounded-xl font-bold disabled:opacity-30 transition-all" style={{ backgroundColor: GOLD, color: '#000' }}>
              {pending ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar servico'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Toggle({ ativo, onChange, disabled }: { ativo: boolean; onChange: () => void; disabled: boolean }) {
  return (
    <button onClick={onChange} disabled={disabled}
      className={cn('relative w-11 h-6 rounded-full transition-all duration-200 disabled:opacity-40', ativo ? 'bg-emerald-500' : 'bg-[#2C2C2C]')}
    >
      <div className={cn('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200', ativo && 'translate-x-5')} />
    </button>
  )
}

function ServicoCard({ servico, onEdit, onToggle, togglePending }: {
  servico: Servico; onEdit: () => void; onToggle: () => void; togglePending: boolean
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: servico.ativo ? GOLD : '#2C2C2C' }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn('font-semibold text-[15px] leading-snug truncate', servico.ativo ? 'text-white' : 'text-zinc-600 line-through')}>
            {servico.nome}
          </p>
          {servico.apenas_manutencao && (
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{ backgroundColor: GOLD + '20', color: GOLD }}>
              Manutenção
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[12px] text-zinc-600">{servico.duracao_minutos} min</span>
          <span className="text-zinc-700">.</span>
          <span className="text-[13px] font-bold" style={{ color: servico.ativo ? GOLD : '#52525B' }}>{fmtBRL(servico.preco)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={onEdit} className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-600 hover:bg-[#1E1E1E] hover:text-white transition-all">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        <Toggle ativo={servico.ativo} onChange={onToggle} disabled={togglePending} />
      </div>
    </div>
  )
}

export default function ServicosClient({ servicos, studioNome }: { servicos: Servico[]; studioNome: string }) {
  const [modal, setModal] = useState<{ open: boolean; servico: Servico | null }>({ open: false, servico: null })
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [, startTransition] = useTransition()
  const [togglePendingId, setTogglePendingId] = useState<string | null>(null)

  function showFeedback(f: Feedback) { setFeedback(f); setTimeout(() => setFeedback(null), 4000) }

  function handleToggle(s: Servico) {
    setTogglePendingId(s.id)
    startTransition(async () => {
      const r = await toggleAtivo(s.id, !s.ativo)
      if (!r.ok) showFeedback({ tipo: 'erro', msg: r.erro })
      setTogglePendingId(null)
    })
  }

  const ativos   = servicos.filter(s => s.ativo)
  const inativos = servicos.filter(s => !s.ativo)

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <header className="bg-black sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo" style={{ height: '32px', width: 'auto' }} />
            <div className="w-0.5 h-6 rounded-full" style={{ backgroundColor: GOLD }} />
            <span className="text-white text-lg font-semibold" style={{ fontFamily: 'var(--font-playfair)' }}>{studioNome}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: GOLD }}>Servicos</span>
            <button onClick={() => setModal({ open: true, servico: null })} className="h-8 px-3 rounded-full text-[12px] font-bold flex items-center gap-1.5 hover:opacity-80 transition-opacity" style={{ backgroundColor: GOLD, color: '#000' }}>
              + Novo
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 pb-safe-nav space-y-5">
        {feedback && (
          <div className={cn('flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium',
            feedback.tipo === 'ok' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'
          )}>
            <span>{feedback.tipo === 'ok' ? 'ok' : 'err'}</span>{feedback.msg}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#111111] rounded-2xl p-4 border border-[#1E1E1E]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">Ativos</p>
            <p className="text-4xl font-bold text-white leading-none" style={{ fontFamily: 'var(--font-playfair)' }}>{ativos.length}</p>
          </div>
          <div className="bg-[#111111] rounded-2xl p-4 border border-[#1E1E1E]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">Total</p>
            <p className="text-4xl font-bold text-white leading-none" style={{ fontFamily: 'var(--font-playfair)' }}>{servicos.length}</p>
          </div>
        </div>

        {servicos.length === 0 && (
          <div className="bg-[#111111] rounded-2xl border border-[#1E1E1E] py-16 flex flex-col items-center gap-3 text-center">
            <p className="font-semibold text-zinc-500">Nenhum servico cadastrado</p>
            <button onClick={() => setModal({ open: true, servico: null })} className="mt-2 h-10 px-5 rounded-xl text-sm font-bold hover:opacity-80 transition-opacity" style={{ backgroundColor: GOLD, color: '#000' }}>
              + Adicionar servico
            </button>
          </div>
        )}

        {ativos.length > 0 && (
          <div className="bg-[#111111] rounded-2xl border border-[#1E1E1E] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#1A1A1A]">
              <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Ativos</p>
            </div>
            <div className="divide-y divide-[#1A1A1A]">
              {ativos.map(s => <ServicoCard key={s.id} servico={s} onEdit={() => setModal({ open: true, servico: s })} onToggle={() => handleToggle(s)} togglePending={togglePendingId === s.id} />)}
            </div>
          </div>
        )}

        {inativos.length > 0 && (
          <div className="bg-[#111111] rounded-2xl border border-[#1E1E1E] overflow-hidden opacity-50">
            <div className="px-5 py-3.5 border-b border-[#1A1A1A]">
              <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Inativos</p>
            </div>
            <div className="divide-y divide-[#1A1A1A]">
              {inativos.map(s => <ServicoCard key={s.id} servico={s} onEdit={() => setModal({ open: true, servico: s })} onToggle={() => handleToggle(s)} togglePending={togglePendingId === s.id} />)}
            </div>
          </div>
        )}
      </div>

      {modal.open && <ServicoModal servico={modal.servico} onClose={() => setModal({ open: false, servico: null })} onFeedback={showFeedback} />}
    </div>
  )
}