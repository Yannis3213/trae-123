import React, { useState } from 'react'
import Layout from '../components/Layout.jsx'
import OrderList from '../components/OrderList.jsx'
import { useAuth } from '../context/AuthContext.jsx'

export default function Orders() {
  const { user } = useAuth()
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <Layout>
      <div className="page-container">
        <div className="page-title">订单管理</div>
        <OrderList key={`${user?.id || 'guest'}-${refreshKey}`} onRefresh={refreshKey} />
      </div>
    </Layout>
  )
}
