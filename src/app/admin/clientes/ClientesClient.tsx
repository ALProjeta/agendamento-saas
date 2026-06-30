'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

export type ClienteData = {
  nome: string
  telefone: string
  total: number
  ultimo_data: string | null
}

const GOLD = '#D3AF37'

function fmtDate(s: string) {
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

function fmtPhone(tel: string) {
  const digits = tel.replace(/\D/g, '')
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return tel
}

function waLink(tel: string) {
  return `https://wa.me/55${tel.replace(/\D/g, '')}`
}

function initials(nome: string) {
  return nome
    .split(' ')
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('')
}

// Gera uma cor de avatar consistente baseada no nome
const AVATAR_COLORS = [
  ['#F3E8FF', '#7C3AED'],
  ['#FEF3C7', '#D97706'],
  ['#DCFCE7', '#16A34A'],
  ['#DBEAFE', '#2563EB'],
  ['#FCE7F3', '#BE185D'],
  ['#FFE4E6', '#E11D48'],
  ['#F0FDF4', '#15803D'],
  ['#EFF6FF', '#1D4ED8'],
]
function avatarColor(nome: string): [string, string] {
  let hash = 0
  for (const c of nome) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

export default function ClientesClient({ clientes, studioNome }: { clientes: ClienteData[]; studioNome: string }) {
  const [busca, setBusca] = useState('')

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase().trim()
    if (!q) return clientes
    return clientes.filter(
      c =>
        c.nome.toLowerCase().includes(q) ||
        c.telefone.replace(/\D/g, '').includes(q.replace(/\D/g, '')),
    )
  }, [clientes, busca])

  const totalAgendamentos = clientes.reduce((acc, c) => acc + c.total, 0)

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Header */}
      <header className="bg-black sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-0.5 h-6 rounded-full" style={{ backgroundColor: GOLD }} />
            <span className="text-white text-lg font-semibold" style={{ fontFamily: 'var(--font-playfair)' }}>
              {studioNome}
            </span>
          </div>
          <span className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: GOLD }}>
            Clientes
          </span>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 pb-safe-nav space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#111111] rounded-2xl p-4 border border-[#1E1E1E]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Clientes</p>
            <p className="text-4xl font-bold text-white leading-none" style={{ fontFamily: 'var(--font-playfair)' }}>
              {clientes.length}
            </p>
          </div>
          <div className="bg-[#111111] rounded-2xl p-4 border border-[#1E1E1E]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Agendamentos</p>
            <p className="text-4xl font-bold text-white leading-none" style={{ fontFamily: 'var(--font-playfair)' }}>
              {totalAgendamentos}
            </p>
          </div>
        </div>

        {/* Busca */}
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome ou telefone..."
            className="w-full h-11 pl-11 pr-4 rounded-2xl border border-[#2C2C2C] bg-[#111111] text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#D3AF37] transition-colors"
          />
          {busca && (
            <button
              onClick={() => setBusca('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-zinc-500 hover:bg-[#1E1E1E] transition-all"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Lista */}
        <div className="bg-[#111111] rounded-2xl border border-[#1E1E1E] overflow-hidden">
          {busca && (
            <div className="px-5 py-3 border-b border-[#1A1A1A]">
              <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                {filtrados.length} resultado{filtrados.length !== 1 ? 's' : ''} para "{busca}"
              </p>
            </div>
          )}

          {clientes.length === 0 && (
            <div className="py-16 flex flex-col items-center gap-3 text-center">
              <span className="text-4xl">👤</span>
              <p className="font-semibold text-zinc-500">Nenhum cliente ainda</p>
              <p className="text-sm text-zinc-500 max-w-[220px]">
                Os clientes aparecerão aqui assim que realizarem o primeiro agendamento.
              </p>
            </div>
          )}

          {clientes.length > 0 && filtrados.length === 0 && (
            <div className="py-14 flex flex-col items-center gap-2 text-center">
              <span className="text-3xl">🔍</span>
              <p className="text-sm font-medium text-zinc-500">Nenhum cliente encontrado para "{busca}"</p>
            </div>
          )}

          {filtrados.length > 0 && (
            <div className="divide-y divide-[#1A1A1A]">
              {filtrados.map(c => (
                <ClienteCard key={c.telefone} cliente={c} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ClienteCard({ cliente }: { cliente: ClienteData }) {
  const [bg, fg] = avatarColor(cliente.nome)

  return (
    <div className="flex items-center gap-4 px-5 py-4">
      {/* Avatar */}
      <div
        className="w-11 h-11 rounded-2xl flex items-center justify-center text-[14px] font-bold shrink-0"
        style={{ backgroundColor: bg, color: fg }}
      >
        {initials(cliente.nome)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[15px] font-semibold text-white leading-snug truncate" style={{ fontFamily: 'var(--font-playfair)' }}>
            {cliente.nome}
          </p>
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
            style={{
              backgroundColor: cliente.total >= 3 ? `${GOLD}20` : '#f3f4f6',
              color: cliente.total >= 3 ? '#9a7c1a' : '#6b7280',
            }}
          >
            {cliente.total}×
          </span>
        </div>
        <p className="text-[12px] text-zinc-500 mt-0.5">{fmtPhone(cliente.telefone)}</p>
        {cliente.ultimo_data && (
          <p className="text-[11px] text-zinc-700 mt-0.5">
            Último agendamento: {fmtDate(cliente.ultimo_data!)}
          </p>
        )}
      </div>

      {/* WhatsApp */}
      <a
        href={waLink(cliente.telefone)}
        target="_blank"
        rel="noopener noreferrer"
        className="w-10 h-10 rounded-full flex items-center justify-center text-white transition-opacity hover:opacity-80 shrink-0"
        style={{ backgroundColor: '#25D366' }}
        title={`Chamar ${cliente.nome} no WhatsApp`}
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </a>
    </div>
  )
}
