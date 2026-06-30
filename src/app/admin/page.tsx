'use client'

import { useActionState } from 'react'
import { login } from '@/app/actions/login'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

const GOLD = '#D3AF37'

export default function AdminLoginPage() {
  const [state, action, pending] = useActionState(login, { erro: null })

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#000000' }}>
      <div className="w-full max-w-[360px]">

        {/* Marca */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="h-px w-12 opacity-30" style={{ backgroundColor: GOLD }} />
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: GOLD }} />
            <div className="h-px w-12 opacity-30" style={{ backgroundColor: GOLD }} />
          </div>
          <h1
            className="text-4xl font-bold text-white mb-1"
            style={{ fontFamily: 'var(--font-playfair)', fontStyle: 'italic' }}
          >
            {process.env.NEXT_PUBLIC_STUDIO_NAME ?? 'Studio'}
          </h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Área restrita
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6 border" style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-5" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Acesso administrativo
          </p>

          <form action={action} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="senha" className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Senha
              </Label>
              <Input
                id="senha"
                name="senha"
                type="password"
                required
                autoFocus
                autoComplete="current-password"
                placeholder="••••••••"
                className="h-12 rounded-xl text-white placeholder:text-white/20 focus-visible:ring-1 focus-visible:ring-offset-0"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderColor: 'rgba(255,255,255,0.1)',
                }}
              />
            </div>

            {state.erro && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/40 border border-red-900/40 rounded-xl px-4 py-3">
                <span>⚠</span>
                <span>{state.erro}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={pending}
              className="w-full h-12 rounded-xl text-[14px] font-bold tracking-wide disabled:opacity-50 mt-1"
              style={{ backgroundColor: GOLD, color: '#000000' }}
            >
              {pending ? 'Verificando...' : 'Entrar'}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs mt-8" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Acesso restrito
        </p>
      </div>
    </div>
  )
}
