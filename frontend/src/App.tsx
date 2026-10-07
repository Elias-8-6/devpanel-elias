import { useEffect, useState } from 'react'

type ApiState = 'checking' | 'up' | 'down'

// Temporary landing screen: confirms the front → gateway → DB chain works.
// Replaced by the router (login / dashboard) in the next phase.
function App() {
  const [api, setApi] = useState<ApiState>('checking')

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/v1/health', { signal: controller.signal })
      .then((res) => setApi(res.ok ? 'up' : 'down'))
      .catch((err: unknown) => {
        if (!(err instanceof DOMException && err.name === 'AbortError')) setApi('down')
      })
    return () => controller.abort()
  }, [])

  const label: Record<ApiState, string> = {
    checking: 'Verificando API…',
    up: 'API y base de datos operativas',
    down: 'API no disponible',
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-3 bg-slate-50 p-6">
      <h1 className="text-3xl font-semibold text-slate-900">DevPanel</h1>
      <p className={api === 'down' ? 'text-red-600' : 'text-slate-600'}>{label[api]}</p>
    </main>
  )
}

export default App
