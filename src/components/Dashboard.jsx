import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import ProductsManager from './ProductsManager'
import PromoManager from './PromoManager'

const Dashboard = ({ user, onLogout }) => {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('today')
  const [showModal, setShowModal] = useState(null)
  const [newOrderNotification, setNewOrderNotification] = useState(null)

  useEffect(() => {
    fetchOrders()
    
    // Cer permisiune pentru notificări browser
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Separate useEffect pentru real-time cu delay pentru a permite autentificarea
  useEffect(() => {
    const timer = setTimeout(() => {
      // Setup real-time subscription pentru comenzi noi
      const subscription = supabase
        .channel('orders_realtime', {
          config: {
            presence: {
              key: user?.id || 'anonymous'
            }
          }
        })
        .on('postgres_changes', 
          { event: 'INSERT', schema: 'public', table: 'orders' },
          (payload) => {
            // Adaug comanda nouă la lista existentă
            setOrders(prevOrders => [payload.new, ...prevOrders])
            
            // Arăt notificare pentru comandă nouă (10 secunde - cât durează sunetul)
            setNewOrderNotification(payload.new)
            setTimeout(() => setNewOrderNotification(null), 10000)
            
            // Sunet telefon clasic cu furcă - RRRRING RRRRING (mai tare și mai lung)
            try {
              const audioContext = new (window.AudioContext || window.webkitAudioContext)()

              const playClassicRing = (startTime) => {
                // Două frecvențe pentru sunetul clasic de telefon
                const osc1 = audioContext.createOscillator()
                const osc2 = audioContext.createOscillator()
                const gainNode = audioContext.createGain()

                osc1.connect(gainNode)
                osc2.connect(gainNode)
                gainNode.connect(audioContext.destination)

                // Frecvențele clasice de telefon: 440Hz și 480Hz cu modulare
                osc1.frequency.setValueAtTime(440, startTime)
                osc2.frequency.setValueAtTime(480, startTime)
                osc1.type = 'sine'
                osc2.type = 'sine'

                // Trillul clasic - vibrația care face RRRRR
                const tremolo = audioContext.createOscillator()
                const tremoloGain = audioContext.createGain()
                tremolo.frequency.setValueAtTime(25, startTime) // 25Hz tremolo
                tremolo.connect(tremoloGain.gain)
                tremoloGain.gain.setValueAtTime(0.3, startTime)

                gainNode.connect(tremoloGain)
                tremoloGain.connect(audioContext.destination)

                // Envelope pentru ring-ul complet - MAI TARE și MAI LUNG
                gainNode.gain.setValueAtTime(0, startTime)
                gainNode.gain.linearRampToValueAtTime(0.7, startTime + 0.1) // Crescut de la 0.4 la 0.7
                gainNode.gain.setValueAtTime(0.7, startTime + 2.0) // Durata crescută de la 1.0 la 2.0
                gainNode.gain.linearRampToValueAtTime(0, startTime + 2.3) // Durata totală: 2.3 secunde

                osc1.start(startTime)
                osc1.stop(startTime + 2.3)
                osc2.start(startTime)
                osc2.stop(startTime + 2.3)
                tremolo.start(startTime)
                tremolo.stop(startTime + 2.3)
              }

              // Patru ring-uri clasice cu pauză (dublat de la 2 la 4)
              playClassicRing(audioContext.currentTime)
              playClassicRing(audioContext.currentTime + 2.5)
              playClassicRing(audioContext.currentTime + 5.0)
              playClassicRing(audioContext.currentTime + 7.5)

            } catch (e) {
              console.log('Nu s-a putut reda sunetul:', e)
            }
            
            // Notificare browser (opțional)
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('Comandă nouă!', {
                body: `${payload.new.order_number} - ${payload.new.customer_name}`,
                icon: '/favicon.ico'
              })
            }
          }
        )
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'orders' },
          (payload) => {
            // Actualizez comanda în listă
            setOrders(prevOrders => 
              prevOrders.map(order => 
                order.id === payload.new.id ? payload.new : order
              )
            )
          }
        )
        .subscribe()

      // Cleanup subscription
      return () => {
        subscription.unsubscribe()
      }
    }, 1000) // 1 second delay

    return () => clearTimeout(timer)
  }, [user])

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
      // Găsesc comanda pentru a avea datele complete
      const order = orders.find(o => o.id === orderId)
      
      const updateData = { status: newStatus }
      if (rejectedReason) {
        updateData.rejected_reason = rejectedReason
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId)

      if (error) throw error
      
      // Trimite SMS dacă comanda a fost acceptată
      if (newStatus === 'paid' && order) {
        try {
          const { data: smsData, error: smsError } = await supabase.functions.invoke('send-sms', {
            body: {
              phone: order.customer_phone,
              orderNumber: order.order_number,
              items: order.items,
              total: order.total,
              type: 'accepted'
            }
          })
          
          if (smsError) {
            console.error('Eroare trimitere SMS:', smsError)
          } else {
            console.log('SMS trimis cu succes:', smsData)
          }
        } catch (smsErr) {
          console.error('Eroare la trimitere SMS:', smsErr)
          // Nu oprim procesul dacă SMS-ul eșuează
        }
      }
      
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
      {/* Notificare comandă nouă */}
      {newOrderNotification && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-green-500 text-white p-8 rounded-2xl shadow-2xl animate-bounce border-4 border-yellow-400 max-w-md mx-4">
            <div className="text-center space-y-4">
              <div className="text-6xl">🔔</div>
              <div className="text-2xl font-bold">COMANDĂ NOUĂ!</div>
              <div className="text-xl font-semibold">{newOrderNotification.order_number}</div>
              <div className="text-lg">{newOrderNotification.customer_name}</div>
              <div className="text-lg font-bold">{newOrderNotification.total} LEI</div>
            </div>
          </div>
        </div>
      )}

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
                onClick={() => setActiveTab('promo')}
                className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 rounded-lg transition-all transform hover:scale-105 flex items-center space-x-2 shadow-md"
              >
                <span>🎯</span>
                <span className="font-medium">Promoție</span>
              </button>
              <button
                onClick={() => setActiveTab('products')}
                className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2 rounded-lg transition-all transform hover:scale-105 flex items-center space-x-2 shadow-md"
              >
                <span>🍕</span>
                <span className="font-medium">Produse</span>
              </button>
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
          
          {activeTab === 'products' && <ProductsManager />}
          
          {activeTab === 'promo' && <PromoManager />}
        </div>

        {/* Modal pentru confirmare */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-bold mb-4">
                {showModal.type === 'paid' ? '✅ Confirmă acceptarea comenzii' : '❌ Confirmă respingerea'}
              </h3>
              <p className="text-gray-600 mb-2">
                Ești sigur că vrei să {showModal.type === 'paid' ? 'ACCEPȚI' : 'RESPINGI'} comanda <strong>{showModal.order.order_number}</strong>?
              </p>
              
              {showModal.type === 'paid' && (
                <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mb-4 mt-4">
                  <p className="text-sm text-blue-700">
                    📱 <strong>Clientul va primi SMS</strong> cu ora acceptării și timpul estimat de pregătire (30-50 minute)
                  </p>
                  <p className="text-xs text-blue-600 mt-2">
                    ⏱️ SMS-ul va ajunge la client în aproximativ 1-2 minute după ce apeși butonul de confirmare
                  </p>
                </div>
              )}
              
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
                  {showModal.type === 'paid' ? 'Confirmă acceptarea' : 'Confirmă respingerea'}
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
    <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 items-start">
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
                    {order.status === 'pending' ? 'NOUĂ' : order.status === 'paid' ? 'ACCEPTATĂ' : 'RESPINSĂ'}
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

                    {/* Metodă de plată */}
                    {order.payment_method && (
                      <div className={`rounded-lg p-4 border-l-4 ${
                        order.payment_method === 'card'
                          ? 'bg-purple-50 border-purple-400'
                          : 'bg-green-50 border-green-400'
                      }`}>
                        <h4 className={`font-bold mb-2 flex items-center ${
                          order.payment_method === 'card' ? 'text-purple-800' : 'text-green-800'
                        }`}>
                          💳 Metodă de plată
                        </h4>
                        <div className="flex items-center space-x-2">
                          <span className={`text-2xl font-bold px-4 py-2 rounded-lg ${
                            order.payment_method === 'card'
                              ? 'bg-purple-200 text-purple-900'
                              : 'bg-green-200 text-green-900'
                          }`}>
                            {order.payment_method === 'card' ? '💳 CARD (POS)' : '💵 NUMERAR'}
                          </span>
                        </div>
                        <p className={`text-xs mt-2 ${
                          order.payment_method === 'card' ? 'text-purple-700' : 'text-green-700'
                        }`}>
                          {order.payment_method === 'card'
                            ? 'Pregătește POS-ul pentru plată cu cardul la livrare'
                            : 'Plata se va face în numerar la livrare'}
                        </p>
                      </div>
                    )}

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
                                  <div className="flex-1">
                                    <div>
                                      <span className="font-bold text-gray-800 text-lg">
                                        {item.name}
                                      </span>
                                      {item.selectedSize && (
                                        <span className="bg-blue-200 text-blue-800 font-bold text-sm px-2 py-1 rounded ml-2">
                                          {item.sizeLabel ? `${item.sizeLabel} (${item.selectedSize} cm)` : `${item.selectedSize} cm`}
                                        </span>
                                      )}
                                    </div>

                                    {/* Afișez dacă e picant */}
                                    {item.isSpicy && (
                                      <div className="mt-2 inline-block">
                                        <span className="bg-red-100 text-red-700 font-bold text-sm px-3 py-1 rounded-full">
                                          🌶️ PICANT
                                        </span>
                                      </div>
                                    )}

                                    {/* Afișez sosuri gratuite */}
                                    {item.freeSaucesText && (
                                      <div className="mt-2 bg-green-50 p-2 rounded border border-green-200">
                                        <span className="text-xs font-semibold text-green-700">SOSURI GRATUITE:</span>
                                        <p className="text-sm text-gray-700 mt-1">
                                          🎁 {item.freeSaucesText}
                                        </p>
                                      </div>
                                    )}

                                    {/* Afișez extra dacă există */}
                                    {item.selectedExtras && item.selectedExtras.length > 0 && (
                                      <div className="mt-2 bg-orange-50 p-2 rounded">
                                        <span className="text-xs font-semibold text-orange-700">EXTRA:</span>
                                        <div className="mt-1 space-y-1">
                                          {item.selectedExtras.map((extra, idx) => (
                                            <div key={idx} className="flex items-center justify-between text-sm">
                                              <span className="text-gray-700">
                                                • {extra.name} 
                                                <span className="text-orange-600 font-semibold ml-1">
                                                  ×{extra.quantity}
                                                </span>
                                              </span>
                                              <span className="text-gray-600">
                                                {(extra.price * extra.quantity).toFixed(2)} lei
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Detalii preț */}
                                    <div className="text-sm text-gray-600 mt-2">
                                      {item.quantity} × {item.price} lei = {item.productSubtotal || (item.quantity * item.price).toFixed(2)} lei
                                      {item.extrasSubtotal > 0 && (
                                        <span className="text-orange-600 ml-2">
                                          + extra {item.extrasSubtotal} lei
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="text-green-700 font-bold text-xl">
                                    {item.totalSubtotal || item.subtotal || (item.quantity * item.price).toFixed(2)} LEI
                                  </span>
                                </div>
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
                          ✅ ACCEPTĂ COMANDĂ
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