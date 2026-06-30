'use client'

import { useState } from 'react'
import { salvarConfig } from '@/app/actions/configuracoes'

const GOLD = '#D3AF37'

type Props = {
  config: Record<string, string>
  tableNotFound: boolean
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative w-11 h-6 rounded-full transition-all duration-200 flex-shrink-0"
      style={{ backgroundColor: checked ? GOLD : '#2C2C2C' }}
    >
      <span
        className="absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-200 shadow-sm"
        style={{ left: checked ? '23px' : '4px' }}
      />
    </button>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#1E1E1E] overflow-hidden">
      <div className="px-5 py-3.5 bg-[#111111] border-b border-[#1A1A1A]">
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-500">{title}</p>
      </div>
      <div className="bg-[#111111] divide-y divide-[#1A1A1A]">
        {children}
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4 space-y-2">
      <p className="text-sm font-medium text-zinc-300">{label}</p>
      {children}
      {hint && <p className="text-xs text-zinc-600">{hint}</p>}
    </div>
  )
}

function TextInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-10 rounded-xl bg-[#181818] border border-[#2C2C2C] px-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#D3AF37]/50"
    />
  )
}

function PaymentRow({
  icon, label, enabled, onToggle, children,
}: {
  icon: string; label: string; enabled: boolean; onToggle: (v: boolean) => void; children?: React.ReactNode
}) {
  return (
    <div className="px-5 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">{icon}</span>
          <span className="text-sm font-medium text-zinc-200">{label}</span>
        </div>
        <Toggle checked={enabled} onChange={onToggle} />
      </div>
      {enabled && children && (
        <div className="space-y-2 pl-8">
          {children}
        </div>
      )}
    </div>
  )
}

export default function ConfiguracoesClient({ config, tableNotFound }: Props) {
  const [studioNome,       setStudioNome]       = useState(config.studio_nome ?? '')
  const [whatsapp,         setWhatsapp]         = useState(config.whatsapp ?? '')
  const [endereco,         setEndereco]         = useState(config.endereco ?? '')
  const [instagram,        setInstagram]        = useState(config.instagram ?? '')
  const [pixHabilitado,    setPixHabilitado]    = useState(config.pix_habilitado !== 'false')
  const [pixChave,         setPixChave]         = useState(config.pix_chave ?? '')
  const [pixDescricao,     setPixDescricao]     = useState(config.pix_descricao ?? '')
  const [cartaoHabilitado, setCartaoHabilitado] = useState(config.cartao_habilitado !== 'false')
  const [cartaoDescricao,  setCartaoDescricao]  = useState(config.cartao_descricao ?? '')
  const [dinheiroHab,      setDinheiroHab]      = useState(config.dinheiro_habilitado !== 'false')

  const [pending,  setPending]  = useState(false)
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)

  async function salvar() {
    setPending(true)
    setFeedback(null)
    const r = await salvarConfig({
      studio_nome:         studioNome.trim(),
      whatsapp:            whatsapp.replace(/\D/g, ''),
      endereco:            endereco.trim(),
      instagram:           instagram.trim().replace(/^@/, ''),
      pix_habilitado:      pixHabilitado    ? 'true' : 'false',
      pix_chave:           pixChave.trim(),
      pix_descricao:       pixDescricao.trim(),
      cartao_habilitado:   cartaoHabilitado ? 'true' : 'false',
      cartao_descricao:    cartaoDescricao.trim(),
      dinheiro_habilitado: dinheiroHab      ? 'true' : 'false',
    })
    setPending(false)
    setFeedback(r.ok
      ? { ok: true,  msg: 'Configurações salvas com sucesso!' }
      : { ok: false, msg: r.erro ?? 'Erro ao salvar.' }
    )
    if (r.ok) setTimeout(() => setFeedback(null), 3000)
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <header className="bg-black sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-0.5 h-6 rounded-full" style={{ backgroundColor: GOLD }} />
            <span className="text-white text-lg font-semibold" style={{ fontFamily: 'var(--font-playfair)' }}>
              {studioNome || process.env.NEXT_PUBLIC_STUDIO_NAME || 'Studio'}
            </span>
          </div>
          <span className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: GOLD }}>
            Configurações
          </span>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 pb-safe-nav space-y-5">

        {tableNotFound ? (
          <div className="rounded-2xl border border-[#D3AF37]/30 bg-[#D3AF37]/5 p-5 space-y-3">
            <p className="text-sm font-semibold text-[#D3AF37]">Tabela não encontrada</p>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Execute o arquivo <code className="text-zinc-200">supabase/configuracoes.sql</code> no
              SQL Editor do Supabase para criar a tabela de configurações.
            </p>
          </div>
        ) : (
          <>
            {/* Estúdio */}
            <Section title="Estúdio">
              <Field
                label="Nome do estúdio"
                hint="Aparece na página de agendamento dos clientes e no cabeçalho do admin."
              >
                <TextInput
                  value={studioNome}
                  onChange={setStudioNome}
                  placeholder="Ex: Studio Ana Menezes"
                />
              </Field>
            </Section>

            {/* Contato */}
            <Section title="Contato">
              <div className="px-5 pt-3 pb-1">
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Aparece na página dos clientes como botão flutuante e rodapé.
                </p>
              </div>
              <Field label="WhatsApp" hint="Somente números com DDD. Ex: 11999998888">
                <TextInput
                  value={whatsapp}
                  onChange={setWhatsapp}
                  placeholder="11999998888"
                />
              </Field>
              <Field label="Endereço" hint="Rua, número, bairro, cidade.">
                <TextInput
                  value={endereco}
                  onChange={setEndereco}
                  placeholder="Rua das Flores, 123 — Centro, São Paulo"
                />
              </Field>
              <Field label="Instagram" hint="Apenas o @, sem o link completo.">
                <TextInput
                  value={instagram}
                  onChange={v => setInstagram(v.replace(/^@/, ''))}
                  placeholder="studioana"
                />
              </Field>
            </Section>

            {/* Formas de pagamento */}
            <Section title="Formas de pagamento">
              <div className="px-5 pt-3 pb-1">
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Se nenhuma forma estiver habilitada, a seção não aparece na confirmação do cliente.
                </p>
              </div>

              <PaymentRow
                icon="💸" label="PIX"
                enabled={pixHabilitado} onToggle={setPixHabilitado}
              >
                <TextInput
                  value={pixChave}
                  onChange={setPixChave}
                  placeholder="Chave PIX (CPF, e-mail ou telefone)"
                />
                <TextInput
                  value={pixDescricao}
                  onChange={setPixDescricao}
                  placeholder="Descrição (ex: Transferência instantânea)"
                />
              </PaymentRow>

              <PaymentRow
                icon="💳" label="Cartão"
                enabled={cartaoHabilitado} onToggle={setCartaoHabilitado}
              >
                <TextInput
                  value={cartaoDescricao}
                  onChange={setCartaoDescricao}
                  placeholder="Descrição (ex: Crédito ou débito)"
                />
              </PaymentRow>

              <PaymentRow
                icon="💵" label="Dinheiro"
                enabled={dinheiroHab} onToggle={setDinheiroHab}
              />

              <div className="px-5 py-3">
                <p className="text-xs text-zinc-600">Pagamento presencialmente no dia do atendimento.</p>
              </div>
            </Section>

            {/* Feedback */}
            {feedback && (
              <div
                className="rounded-2xl px-5 py-3.5 text-sm font-medium"
                style={{
                  backgroundColor: feedback.ok ? '#D3AF3715' : '#EF444415',
                  color:           feedback.ok ? GOLD        : '#EF4444',
                  border:          `1px solid ${feedback.ok ? GOLD + '40' : '#EF444440'}`,
                }}
              >
                {feedback.ok ? '✓ ' : '✕ '}{feedback.msg}
              </div>
            )}

            {/* Salvar */}
            <button
              onClick={salvar}
              disabled={pending}
              className="w-full h-12 rounded-xl text-[14px] font-bold transition-all disabled:opacity-40"
              style={{ backgroundColor: GOLD, color: '#000' }}
            >
              {pending ? 'Salvando…' : 'Salvar configurações'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
