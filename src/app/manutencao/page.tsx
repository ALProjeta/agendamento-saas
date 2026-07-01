import { getConfigPublica } from '@/app/actions/configuracoes'
import ManutencaoClient from './ManutencaoClient'

export default async function ManutencaoPage() {
  const config = await getConfigPublica()
  return <ManutencaoClient config={config} />
}
