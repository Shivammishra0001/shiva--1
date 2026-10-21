// Entry for the admin panel (admin.html, served at /admin). Kept separate from the public site and its stylesheet.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './admin/admin.css'
import AdminApp from './admin/AdminApp'

createRoot(document.getElementById('root')).render(<StrictMode><AdminApp /></StrictMode>)
