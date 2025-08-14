import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { Provider } from './components/ui/provider.jsx'
import { ColorModeButton } from './components/ui/color-mode.jsx'

createRoot(document.getElementById('root')).render(
  <Provider>
    <App />
    <ColorModeButton />
  </Provider>,
)
