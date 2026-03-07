import React, { useState, useEffect } from 'react'

export default function Clock() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div style={{ textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h2>Current Time</h2>
      <p style={{ fontSize: '2em', fontWeight: 'bold' }}>{time.toLocaleTimeString()}</p>
    </div>
  )
}
