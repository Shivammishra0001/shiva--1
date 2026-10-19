import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ContactPage from './ContactPage.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ContactPage />
  </StrictMode>,
)
