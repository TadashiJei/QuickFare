// pages/index.tsx
import { useState, useEffect } from 'react'
import Head from 'next/head'
import { motion } from 'framer-motion'
import { useWebSocket } from '../lib/websocket'

export default function Home() {
  const [user, setUser] = useState(null)
  const [balance, setBalance] = useState(0)
  const [amount, setAmount] = useState(0)
  const [history, setHistory] = useState([])
  const [token, setToken] = useState('')

  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    if (storedToken) {
      setToken(storedToken)
      fetchBalance(storedToken)
      fetchHistory(storedToken)
    }
  }, [])

  const login = async (username) => {
    const res = await fetch('/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    })
    const data = await res.json()
    setToken(data.access_token)
    localStorage.setItem('token', data.access_token)
    fetchBalance(data.access_token)
    fetchHistory(data.access_token)
  }

  const fetchBalance = async (currentToken) => {
    const res = await fetch('/api/balance', {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    })
    const data = await res.json()
    setBalance(data.balance)
  }

  const reloadBalance = async () => {
    const res = await fetch('/api/reload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ amount })
    })
    const data = await res.json()
    setBalance(data.new_balance)
    fetchHistory(token)
  }

  const makePayment = async () => {
    const res = await fetch('/api/pay', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ amount })
    })
    const data = await res.json()
    setBalance(data.new_balance)
    fetchHistory(token)
  }

  const fetchHistory = async (currentToken) => {
    const res = await fetch('/api/history', {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    })
    const data = await res.json()
    setHistory(data)
  }

  const balanceUpdate = useWebSocket('ws://localhost:8000/ws/balance')

  useEffect(() => {
    if (balanceUpdate) {
      setBalance(balanceUpdate.balance)
    }
  }, [balanceUpdate])


  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-red-500 flex items-center justify-center p-4">
      <Head>
        <title>E-Transpo-App</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="bg-white bg-opacity-20 backdrop-filter backdrop-blur-lg rounded-xl p-8 shadow-xl max-w-md w-full"
      >
        <h1 className="text-4xl font-bold text-white mb-6 text-center">E-Transpo-App</h1>

        {!token ? (
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Username"
              onChange={(e) => setUser(e.target.value)}
              className="w-full px-4 py-2 rounded-md bg-white bg-opacity-20 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-white"
            />
            <button
              onClick={() => login(user)}
              className="w-full bg-white bg-opacity-20 text-white px-4 py-2 rounded-md hover:bg-opacity-30 transition-all duration-200"
            >
              Login
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-white text-center">
              <h2 className="text-2xl font-semibold">Current Balance</h2>
              <p className="text-4xl font-bold">${balance.toFixed(2)}</p>
            </div>

            <input
              type="number"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full px-4 py-2 rounded-md bg-white bg-opacity-20 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-white"
            />

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={reloadBalance}
                className="bg-white bg-opacity-20 text-white px-4 py-2 rounded-md hover:bg-opacity-30 transition-all duration-200"
              >
                Reload
              </button>
              <button
                onClick={makePayment}
                className="bg-white bg-opacity-20 text-white px-4 py-2 rounded-md hover:bg-opacity-30 transition-all duration-200"
              >
                Pay
              </button>
            </div>

            <div className="mt-6">
              <h2 className="text-2xl font-semibold text-white mb-2">Transaction History</h2>
              <ul className="space-y-2">
                {history.map((transaction, index) => (
                  <li key={index} className="bg-white bg-opacity-10 rounded-md p-2 text-white">
                    <span>{new Date(transaction.timestamp).toLocaleString()}</span>
                    <span className="float-right">${transaction.amount.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}