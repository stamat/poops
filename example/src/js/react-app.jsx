import React from 'react'
import { createRoot } from 'react-dom/client'
import Clock from './components/Clock'

const root = createRoot(document.getElementById('clock-root'))
root.render(<Clock />)
