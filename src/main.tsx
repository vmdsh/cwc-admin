import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'

// Apply saved theme before first render to avoid flash
const saved = localStorage.getItem('cwc_theme') || 'dark'
document.body.setAttribute('data-theme', saved)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
