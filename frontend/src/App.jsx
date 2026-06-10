import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import BookingList from './pages/BookingList.jsx'
import BookingDetail from './pages/BookingDetail.jsx'
import WarningQueue from './pages/WarningQueue.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="bookings" element={<BookingList />} />
        <Route path="bookings/:id" element={<BookingDetail />} />
        <Route path="warnings" element={<WarningQueue />} />
      </Route>
    </Routes>
  )
}
