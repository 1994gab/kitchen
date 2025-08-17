import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const Dashboard = ({ user, onLogout }) => {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('today')
  const [showModal, setShowModal] = useState(null)

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setOrders(data || [])
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateOrderStatus = async (orderId, newStatus, rejectedReason = null) => {
    try {
      const updateData = { status: newStatus }
      if (rejectedReason) {
        updateData.rejected_reason = rejectedReason
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId)

      if (error) throw error
      
      // Refresh orders
      fetchOrders()
      setShowModal(null)
    } catch (error) {
      console.error('Error updating order status:', error)
    }
  }

  // Filtrare comenzi
  const todayOrders = orders.filter(order => 
    order.status === 'pending' && 
    new Date(order.order_date).toDateString() === new Date().toDateString()
  )
  
  const paidOrders = orders.filter(order => order.status === 'paid')
  const rejectedOrders = orders.filter(order => order.status === 'rejected')

  // Grupare comenzi încasate pe zile
  const groupedPaidOrders = paidOrders.reduce((groups, order) => {
    const date = new Date(order.order_date).toLocaleDateString('ro-RO')
    if (!groups[date]) groups[date] = []
    groups[date].push(order)
    return groups
  }, {})

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading orders...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">
              🍗 Chicken and Pizza - Bucătărie
            </h1>
            <div className="flex items-center space-x-4">
              <span className="text-gray-600">
                Bună, {user.username}!
              </span>
              <button
                onClick={onLogout}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="mb-8 flex justify-center">
          <div className="bg-gray-100 rounded-lg p-1 flex space-x-1">
            <button
              onClick={() => setActiveTab('today')}
              className={`px-6 py-3 rounded-md font-medium text-sm transition-all ${
                activeTab === 'today'
                  ? 'bg-white text-red-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              COMENZI ASTĂZI ({todayOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('paid')}
              className={`px-6 py-3 rounded-md font-medium text-sm transition-all ${
                activeTab === 'paid'
                  ? 'bg-white text-green-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              ISTORIC ÎNCASATE ({paidOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('rejected')}
              className={`px-6 py-3 rounded-md font-medium text-sm transition-all ${
                activeTab === 'rejected'
                  ? 'bg-white text-gray-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              RESPINSE ({rejectedOrders.length})
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'today' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-6">
                🔴 Comenzi de astăzi - {new Date().toLocaleDateString('ro-RO')}
              </h2>
              {todayOrders.length === 0 ? (
                <div className="bg-gradient-to-br from-red-50 to-orange-100 rounded-xl shadow-lg p-8 text-center border border-red-200">
                  <div className="text-gray-600 text-lg font-medium">
                    🍽️ Nu sunt comenzi noi astăzi
                  </div>
                  <p className="text-gray-500 mt-2">Comenzile noi vor apărea aici automat</p>
                </div>
              ) : (
                <OrderGrid orders={todayOrders} showActions={true} onUpdateStatus={updateOrderStatus} setShowModal={setShowModal} />
              )}
            </div>
          )}

          {activeTab === 'paid' && <PaidOrdersTab groupedPaidOrders={groupedPaidOrders} />}

          {activeTab === 'rejected' && <RejectedOrdersTab rejectedOrders={rejectedOrders} />}
        </div>

        {/* Modal pentru confirmare */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-bold mb-4">
                {showModal.type === 'paid' ? '💰 Confirmă încasarea' : '❌ Confirmă respingerea'}
              </h3>
              <p className="text-gray-600 mb-6">
                Ești sigur că vrei să marchezi comanda <strong>{showModal.order.order_number}</strong> ca {showModal.type === 'paid' ? 'încasată' : 'respinsă'}?
              </p>
              
              {showModal.type === 'rejected' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Motiv respingere (opțional):
                  </label>
                  <textarea
                    value={showModal.reason || ''}
                    onChange={(e) => setShowModal({...showModal, reason: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    rows="3"
                    placeholder="Ex: Client nu a răspuns, adresa greșită..."
                  />
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowModal(null)}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Anulează
                </button>
                <button
                  onClick={() => updateOrderStatus(showModal.order.id, showModal.type, showModal.reason)}
                  className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors ${
                    showModal.type === 'paid' 
                      ? 'bg-green-500 hover:bg-green-600' 
                      : 'bg-red-500 hover:bg-red-600'
                  }`}
                >
                  {showModal.type === 'paid' ? 'Confirmă încasarea' : 'Confirmă respingerea'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

// Componenta pentru grid-ul de comenzi
const OrderGrid = ({ orders, showActions, setShowModal }) => {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 items-start">
      {orders.map((order, index) => (
        <SingleOrderCard 
          key={`card-${order.id}-${index}`} 
          order={order} 
          showActions={showActions} 
          setShowModal={setShowModal} 
        />
      ))}
    </div>
  )
}

// Componenta complet separată pentru un singur card
const SingleOrderCard = ({ order, showActions, setShowModal }) => {
  const [expanded, setExpanded] = useState(false)
  
  const handleToggle = (e) => {
    e.stopPropagation()
    e.preventDefault()
    console.log(`Toggle pentru comanda ${order.order_number}: ${expanded} -> ${!expanded}`)
    setExpanded(!expanded)
  }

  return (
    <div className={`bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 overflow-hidden ${!expanded ? 'h-auto' : ''}`}>
            {/* Header cu numărul comenzii și status */}
            <div className="bg-slate-800 text-white p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold">
                    {order.order_number}
                  </h3>
                  <p className="text-slate-300 text-sm mt-1">
                    📅 {new Date(order.order_date).toLocaleDateString('ro-RO')}
                  </p>
                </div>
                <div className={`px-4 py-3 rounded-xl text-center font-bold text-sm shadow-lg ${
                  order.status === 'pending' 
                    ? 'bg-red-500 text-white animate-pulse' 
                    : order.status === 'paid'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-500 text-white'
                }`}>
                  <div className="text-xs uppercase tracking-wide">
                    {order.status === 'pending' ? 'NOUĂ' : order.status === 'paid' ? 'ÎNCASATĂ' : 'RESPINSĂ'}
                  </div>
                  <div className="text-lg">
                    {order.status === 'pending' ? '🔴' : order.status === 'paid' ? '💰' : '❌'}
                  </div>
                </div>
              </div>
            </div>

            {/* Info de bază și buton expand */}
            <div className="p-4">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {order.total} LEI
                  </div>
                  <div className="text-sm text-gray-600">
                    {order.customer_name} • {order.items?.reduce((total, item) => total + item.quantity, 0) || 0} produse
                  </div>
                </div>
                <button
                  onClick={handleToggle}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition-colors font-medium"
                >
                  {expanded ? '▲ Ascunde' : '▼ Detalii'}
                </button>
              </div>

              {/* Conținut expandabil */}
              {expanded && (
                  <div className="border-t pt-4 space-y-4">
                    {/* Total și timpul */}
                    <div className="text-center">
                      <p className="text-lg text-gray-700 mb-1">
                        Prețul de încasat este <span className="text-2xl font-bold text-green-600">{order.total} LEI</span>
                      </p>
                      <p className="text-xs text-gray-500">
                        Comanda s-a efectuat la {new Date(order.created_at).toLocaleDateString('ro-RO')} la ora {new Date(order.created_at).toLocaleTimeString('ro-RO', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </p>
                    </div>

                    {/* Informații client */}
                    <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-400">
                      <h4 className="font-bold text-blue-800 mb-2 flex items-center">
                        👤 Client
                      </h4>
                      <div className="space-y-1 text-sm">
                        <p className="text-gray-700 font-medium">{order.customer_name}</p>
                        <p className="text-gray-600 flex items-center">
                          📞 {order.customer_phone}
                        </p>
                        <p className="text-gray-600 flex items-start">
                          📍 {order.customer_address}
                        </p>
                      </div>
                    </div>

                    {/* Notițe dacă există */}
                    {order.customer_notes && (
                      <div className="bg-yellow-50 rounded-lg p-3 border-l-4 border-yellow-400">
                        <h4 className="font-bold text-yellow-800 mb-1 text-sm flex items-center">
                          📝 Notițe speciale
                        </h4>
                        <p className="text-yellow-700 text-sm italic">
                          "{order.customer_notes}"
                        </p>
                      </div>
                    )}

                    {/* Motiv respingere dacă există */}
                    {order.rejected_reason && (
                      <div className="bg-red-50 rounded-lg p-3 border-l-4 border-red-400">
                        <h4 className="font-bold text-red-800 mb-1 text-sm flex items-center">
                          ❌ Motiv respingere
                        </h4>
                        <p className="text-red-700 text-sm italic">
                          "{order.rejected_reason}"
                        </p>
                      </div>
                    )}

                    {/* Produse */}
                    {order.items && (
                      <div className="bg-green-50 rounded-lg p-4 border-l-4 border-green-400">
                        <h4 className="font-bold text-green-800 mb-3 flex items-center">
                          🍽️ DE GĂTIT ({order.items.reduce((total, item) => total + item.quantity, 0)} produse)
                        </h4>
                        <div className="space-y-2">
                          {order.items.map((item, index) => (
                            <div key={index} className="bg-white rounded-lg p-3 border border-green-200">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <span className="bg-red-500 text-white font-bold px-3 py-1 rounded-full text-lg">
                                    {item.quantity}
                                  </span>
                                  <div>
                                    <span className="font-bold text-gray-800 text-lg">
                                      {item.name}
                                    </span>
                                    {item.selectedSize && (
                                      <span className="bg-yellow-200 text-yellow-800 font-bold text-sm px-2 py-1 rounded ml-2">
                                        {item.selectedSize}
                                      </span>
                                    )}
                                    <div className="text-sm text-gray-600 mt-1">
                                      {item.quantity} bucăți × {item.price} LEI = {item.subtotal} LEI
                                    </div>
                                  </div>
                                </div>
                                <span className="text-green-700 font-bold text-xl">
                                  {item.subtotal} LEI
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Butoane pentru acțiuni */}
                    {showActions && order.status === 'pending' && (
                      <div className="flex space-x-3 pt-4 border-t">
                        <button
                          onClick={() => setShowModal({ type: 'paid', order })}
                          className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
                        >
                          💰 ÎNCASATĂ
                        </button>
                        <button
                          onClick={() => setShowModal({ type: 'rejected', order })}
                          className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
                        >
                          ❌ RESPINSĂ
                        </button>
                      </div>
                    )}
                  </div>
              )}
            </div>
    </div>
  )
}

// Componenta pentru tab-ul de comenzi încasate cu expand pe zile
const PaidOrdersTab = ({ groupedPaidOrders }) => {
  const [expandedDates, setExpandedDates] = useState(new Set())

  const toggleDate = (date) => {
    const newExpanded = new Set(expandedDates)
    if (newExpanded.has(date)) {
      newExpanded.delete(date)
    } else {
      newExpanded.add(date)
    }
    setExpandedDates(newExpanded)
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-6">
        💰 Istoric comenzi încasate
      </h2>
      {Object.keys(groupedPaidOrders).length === 0 ? (
        <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl shadow-lg p-8 text-center border border-green-200">
          <div className="text-gray-600 text-lg font-medium">
            💰 Nu sunt comenzi încasate încă
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedPaidOrders)
            .sort(([a], [b]) => new Date(b.split('.').reverse().join('-')) - new Date(a.split('.').reverse().join('-')))
            .map(([date, dayOrders]) => {
              const isExpanded = expandedDates.has(date)
              const totalAmount = dayOrders.reduce((sum, order) => sum + order.total, 0)
              
              return (
                <div key={date} className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                  {/* Header clickabil pentru fiecare zi */}
                  <button
                    onClick={() => toggleDate(date)}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <span className="text-2xl">
                        {isExpanded ? '📂' : '📁'}
                      </span>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800 text-left">
                          📅 {date}
                        </h3>
                        <p className="text-sm text-gray-600 text-left">
                          {dayOrders.length} comenzi încasate
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg font-bold text-lg">
                        {totalAmount.toFixed(2)} LEI
                      </div>
                      <span className="text-gray-400 text-xl">
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    </div>
                  </button>

                  {/* Comenzile pentru ziua respectivă */}
                  {isExpanded && (
                    <div className="border-t bg-gray-50 p-4">
                      <OrderGrid orders={dayOrders} showActions={false} />
                    </div>
                  )}
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}

// Componenta pentru tab-ul de comenzi respinse cu expand pe zile
const RejectedOrdersTab = ({ rejectedOrders }) => {
  const [expandedDates, setExpandedDates] = useState(new Set())

  // Grupare comenzi respinse pe zile
  const groupedRejectedOrders = rejectedOrders.reduce((groups, order) => {
    const date = new Date(order.order_date).toLocaleDateString('ro-RO')
    if (!groups[date]) groups[date] = []
    groups[date].push(order)
    return groups
  }, {})

  const toggleDate = (date) => {
    const newExpanded = new Set(expandedDates)
    if (newExpanded.has(date)) {
      newExpanded.delete(date)
    } else {
      newExpanded.add(date)
    }
    setExpandedDates(newExpanded)
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-6">
        ❌ Comenzi respinse
      </h2>
      {Object.keys(groupedRejectedOrders).length === 0 ? (
        <div className="bg-gradient-to-br from-gray-50 to-slate-100 rounded-xl shadow-lg p-8 text-center border border-gray-200">
          <div className="text-gray-600 text-lg font-medium">
            ❌ Nu sunt comenzi respinse
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedRejectedOrders)
            .sort(([a], [b]) => new Date(b.split('.').reverse().join('-')) - new Date(a.split('.').reverse().join('-')))
            .map(([date, dayOrders]) => {
              const isExpanded = expandedDates.has(date)
              const totalAmount = dayOrders.reduce((sum, order) => sum + order.total, 0)
              
              return (
                <div key={date} className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                  {/* Header clickabil pentru fiecare zi */}
                  <button
                    onClick={() => toggleDate(date)}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <span className="text-2xl">
                        {isExpanded ? '📂' : '📁'}
                      </span>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800 text-left">
                          📅 {date}
                        </h3>
                        <p className="text-sm text-gray-600 text-left">
                          {dayOrders.length} comenzi respinse
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="bg-red-100 text-red-800 px-4 py-2 rounded-lg font-bold text-lg">
                        -{totalAmount.toFixed(2)} LEI
                      </div>
                      <span className="text-gray-400 text-xl">
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    </div>
                  </button>

                  {/* Comenzile pentru ziua respectivă */}
                  {isExpanded && (
                    <div className="border-t bg-gray-50 p-4">
                      <OrderGrid orders={dayOrders} showActions={false} />
                    </div>
                  )}
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}

export default Dashboard