// Checks HTTP startup and Vite's transformed entry; this is not a browser test.
const origin = process.env.CHECK_URL || 'http://127.0.0.1:5173'
try {
  const html = await fetch(origin, { signal: AbortSignal.timeout(4000) })
  if (!html.ok || !(await html.text()).includes('id="app"')) throw new Error('Brak strony Vue')
  const entry = await fetch(`${origin}/src/main.js`, { signal: AbortSignal.timeout(4000) })
  if (!entry.ok || !(await entry.text()).includes('createApp')) throw new Error('Nie działa transformacja modułu Vue')
} catch (error) { console.error(error.message); process.exit(1) }
