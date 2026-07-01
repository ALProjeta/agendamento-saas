import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getStudioNome } from '@/lib/config'

const GOLD = '#D3AF37'

const MONTHS_PT = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]
const DAYS_PT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

function pad(n: number) { return String(n).padStart(2, '0') }
function toStr(d: Date)  { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` }
function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDateLabel(s: string) {
  const [, m, d] = s.split('-').map(Number)
  return `${d} ${MONTHS_PT[m-1].slice(0,3)}`
}
function getMondayOfWeek(dateStr: string): Date {
  const parts = dateStr.split('-').map(Number)
  const d = new Date(parts[0], parts[1] - 1, parts[2])
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d
}

type AgRow = {
  id: string; status: string; data: string; hora_inicio: string; cliente_nome: string
  servico: { nome: string; preco: number } | null
}

function calcStats(ags: AgRow[]) {
  const ativos      = ags.filter(a => a.status !== 'cancelado')
  const confirmados = ags.filter(a => a.status === 'confirmado').length
  const concluidos  = ags.filter(a => a.status === 'concluido').length
  const cancelados  = ags.filter(a => a.status === 'cancelado').length
  const receita     = ativos.reduce((s, a) => s + (a.servico?.preco ?? 0), 0)
  return { total: ags.length, confirmados, concluidos, cancelados, receita }
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-[#111111] rounded-2xl p-4 border border-[#1E1E1E]">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">{label}</p>
      <p className="text-2xl font-bold leading-tight" style={{ color: GOLD, fontFamily: 'var(--font-playfair)' }}>
        {value}
      </p>
      {sub && <p className="text-xs text-zinc-600 mt-1">{sub}</p>}
    </div>
  )
}

function StatusBar({ confirmados, concluidos, cancelados }: {
  confirmados: number; concluidos: number; cancelados: number
}) {
  const total = confirmados + concluidos + cancelados
  if (total === 0) return null
  const items = [
    { label: 'Confirmados', count: confirmados, color: GOLD },
    { label: 'Concluídos',  count: concluidos,  color: '#22C55E' },
    { label: 'Cancelados',  count: cancelados,  color: '#3F3F46' },
  ].filter(i => i.count > 0)

  return (
    <div className="space-y-2">
      <div className="flex rounded-full overflow-hidden h-2">
        {items.map(i => (
          <div
            key={i.label}
            style={{ flex: i.count, backgroundColor: i.color }}
          />
        ))}
      </div>
      <div className="flex gap-4">
        {items.map(i => (
          <div key={i.label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: i.color }} />
            <span className="text-[11px] text-zinc-500">{i.label}: {i.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default async function DashboardPage() {
  const [supabase, studioNome] = [createAdminSupabaseClient(), await getStudioNome()]

  const hoje   = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const [y, m] = hoje.split('-').map(Number)

  const mesInicio = `${y}-${pad(m)}-01`
  const mesFim    = `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`

  const monday   = getMondayOfWeek(hoje)
  const sunday   = new Date(monday); sunday.setDate(monday.getDate() + 6)
  const semanaIni = toStr(monday)
  const semanaFim = toStr(sunday)

  const em7Dias = new Date(hoje + 'T12:00:00')
  em7Dias.setDate(em7Dias.getDate() + 7)
  const proximosFim = toStr(em7Dias)

  function normalizeAg(row: unknown): AgRow {
    const r = row as Record<string, unknown>
    const servRaw = r.servico
    const serv = Array.isArray(servRaw) ? servRaw[0] : servRaw
    return {
      id:          r.id as string,
      status:      r.status as string,
      data:        r.data as string,
      hora_inicio: r.hora_inicio as string,
      cliente_nome: r.cliente_nome as string,
      servico:     serv as { nome: string; preco: number } | null,
    }
  }

  const [{ data: rawAgsMes }, { data: rawAgsProx }] = await Promise.all([
    supabase.from('agendamentos')
      .select('id, status, data, hora_inicio, cliente_nome, servico:servico_id(nome, preco)')
      .gte('data', mesInicio)
      .lte('data', mesFim),
    supabase.from('agendamentos')
      .select('id, status, data, hora_inicio, cliente_nome, servico:servico_id(nome, preco)')
      .gt('data', hoje)
      .lte('data', proximosFim)
      .eq('status', 'confirmado')
      .order('data')
      .order('hora_inicio'),
  ])

  const agsMes     = (rawAgsMes ?? []).map(normalizeAg)
  const agsHoje    = agsMes.filter(a => a.data === hoje)
  const agsSemana  = agsMes.filter(a => a.data >= semanaIni && a.data <= semanaFim)
  const agsProximos = (rawAgsProx ?? []).map(normalizeAg)

  const statsHoje   = calcStats(agsHoje)
  const statsSemana = calcStats(agsSemana)
  const statsMes    = calcStats(agsMes)

  const svcMap: Record<string, { nome: string; count: number; receita: number }> = {}
  for (const ag of agsMes) {
    if (ag.status === 'cancelado' || !ag.servico) continue
    const nome = ag.servico.nome
    if (!svcMap[nome]) svcMap[nome] = { nome, count: 0, receita: 0 }
    svcMap[nome].count++
    svcMap[nome].receita += ag.servico.preco
  }
  const topServicos = Object.values(svcMap).sort((a, b) => b.count - a.count).slice(0, 3)

  const hojeDate   = new Date(hoje + 'T12:00:00')
  const dayName    = DAYS_PT[hojeDate.getDay()]
  const monthLabel = MONTHS_PT[m - 1]

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <header className="bg-black sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.jpeg" alt="Logo" style={{ height: '32px', width: 'auto' }} />
            <div className="w-0.5 h-6 rounded-full" style={{ backgroundColor: GOLD }} />
            <span className="text-white text-lg font-semibold" style={{ fontFamily: 'var(--font-playfair)' }}>
              {studioNome}
            </span>
          </div>
          <span className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: GOLD }}>
            Resumo
          </span>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 pb-safe-nav space-y-5">

        <div>
          <p className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-playfair)' }}>
            {dayName}, {hojeDate.getDate()} de {monthLabel}
          </p>
          <p className="text-xs text-zinc-600 mt-0.5">Dados do mês de {monthLabel}</p>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">Hoje</p>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Agendamentos" value={String(statsHoje.total)} />
            <StatCard label="Receita prevista" value={fmtBRL(statsHoje.receita)} />
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">
            Esta semana ({fmtDateLabel(semanaIni)}–{fmtDateLabel(semanaFim)})
          </p>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Agendamentos" value={String(statsSemana.total)} />
            <StatCard label="Receita prevista" value={fmtBRL(statsSemana.receita)} />
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">
            {monthLabel} completo
          </p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <StatCard label="Total" value={String(statsMes.total)} />
            <StatCard label="Receita prevista" value={fmtBRL(statsMes.receita)} />
          </div>
          <StatusBar
            confirmados={statsMes.confirmados}
            concluidos={statsMes.concluidos}
            cancelados={statsMes.cancelados}
          />
        </div>

        {topServicos.length > 0 && (
          <div className="rounded-2xl border border-[#1E1E1E] overflow-hidden">
            <div className="px-5 py-3.5 bg-[#111111] border-b border-[#1A1A1A]">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                Serviços mais agendados — {monthLabel}
              </p>
            </div>
            <div className="bg-[#111111] divide-y divide-[#1A1A1A]">
              {topServicos.map((s, i) => (
                <div key={s.nome} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-zinc-600 w-4">{i + 1}°</span>
                    <span className="text-sm text-zinc-200">{s.nome}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold" style={{ color: GOLD }}>{s.count}x</span>
                    <span className="text-xs text-zinc-600 ml-2">{fmtBRL(s.receita)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-[#1E1E1E] overflow-hidden">
          <div className="px-5 py-3.5 bg-[#111111] border-b border-[#1A1A1A]">
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-500">
              Próximos 7 dias
            </p>
          </div>
          <div className="bg-[#111111]">
            {agsProximos.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-zinc-600">Nenhum agendamento nos próximos 7 dias.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#1A1A1A]">
                {agsProximos.map(ag => (
                  <div key={ag.id} className="flex items-center justify-between px-5 py-3.5 gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-200 truncate">{ag.cliente_nome}</p>
                      <p className="text-xs text-zinc-600 truncate">{ag.servico?.nome ?? '—'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-semibold" style={{ color: GOLD }}>
                        {fmtDateLabel(ag.data)}
                      </p>
                      <p className="text-xs text-zinc-600">{ag.hora_inicio.slice(0, 5)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
