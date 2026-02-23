import React from 'react'
import { createRoot } from 'react-dom/client'
import Counter from './components/Counter'

function App() {
  return (
    <div>
      <p>This React app was bundled by Poops.</p>
      <Counter />
    </div>
  )
}

const root = createRoot(document.getElementById('root'))
root.render(<App />)
