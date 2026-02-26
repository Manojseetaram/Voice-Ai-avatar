import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// ── Remove StrictMode — it double-invokes useEffect in dev which
// fights with PIXI's canvas lifecycle and causes the refresh-then-gone bug
createRoot(document.getElementById('root')!).render(
  <App />
)