import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import ProductsManager from './ProductsManager'
import PromoManager from './PromoManager'

const Dashboard = ({ user, onLogout }) => {
  // Locația bucătăriei vine din contul logat.
  // Fallback Kristal pentru sesiuni vechi (localStorage fără location).
  const location = user?.location || 'kristal'
  const locationLabel = location === 'popesti' ? 'Popești' : 'Kristal'
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('today')
  const [showModal, setShowModal] = useState(null)
  const [newOrderNotification, setNewOrderNotification] = useState(null)
  const [wakeLock, setWakeLock] = useState(null)
  const [audioContextReady, setAudioContextReady] = useState(false)
  const [showAudioButton, setShowAudioButton] = useState(() => {
    // Verifică în localStorage dacă sunetele au fost activate ASTĂZI
    const audioActivatedDate = localStorage.getItem('audioActivatedDate')
    const today = new Date().toDateString() // Ex: "Mon Jan 06 2025"

    // Arată butonul dacă nu a fost activat astăzi
    return audioActivatedDate !== today
  })
  const [isProcessingOrder, setIsProcessingOrder] = useState(false)
  const [showReactivateAudio, setShowReactivateAudio] = useState(false)

  useEffect(() => {
    fetchOrders()

    // Verifică dacă sunetele au fost activate astăzi
    const audioActivated = localStorage.getItem('audioActivatedDate')
    const today = new Date().toDateString()
    if (audioActivated === today) {
      setAudioContextReady(true) // Marchează că sunetele au fost activate astăzi
    }

    // Cer permisiune pentru notificări browser
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    // Activez Wake Lock pentru a ține ecranul activ
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          const lock = await navigator.wakeLock.request('screen')
          setWakeLock(lock)
          console.log('Wake Lock activat - ecranul va rămâne activ')

          // Re-activez Wake Lock dacă se eliberează (ex: utilizatorul schimbă tab-ul)
          lock.addEventListener('release', () => {
            console.log('Wake Lock eliberat')
          })
        }
      } catch (err) {
        console.error('Wake Lock nu a putut fi activat:', err)
      }
    }

    requestWakeLock()

    // Re-activez Wake Lock când pagina devine vizibilă din nou
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock()

        // Dacă sunetele au fost activate și tab-ul devine vizibil, arată banner de reactivare
        const audioActivated = localStorage.getItem('audioActivatedDate')
        const today = new Date().toDateString()
        if (audioActivated === today && audioContextReady) {
          setShowReactivateAudio(true)
        }
      } else {
        // Tab-ul a devenit inactiv
        setShowReactivateAudio(false)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Nu mai folosim click listener automat

    // Cleanup
    return () => {
      if (wakeLock) {
        wakeLock.release()
        console.log('Wake Lock dezactivat')
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
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
          { event: 'INSERT', schema: 'public', table: 'orders', filter: `location=eq.${location}` },
          async (payload) => {
            // Adaug comanda nouă la lista existentă
            setOrders(prevOrders => [payload.new, ...prevOrders])

            // Arăt notificare pentru comandă nouă (10 secunde)
            setNewOrderNotification(payload.new)
            setTimeout(() => setNewOrderNotification(null), 10000)

            // Trimite notificare pe Telegram (actualizat cu bot nou)
            try {
              const telegramToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN
              const chatId = import.meta.env.VITE_TELEGRAM_CHAT_ID
              const message = `🔔 COMANDĂ NOUĂ! [📍 ${locationLabel}]\n\n` +
                `📝 ${payload.new.order_number}\n` +
                `👤 ${payload.new.customer_name}\n` +
                `💰 ${payload.new.total} LEI\n` +
                `📍 ${payload.new.customer_address}\n` +
                `📞 ${payload.new.customer_phone}`

              fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: message
                })
              }).catch(err => console.error('Telegram error:', err))
            } catch (e) {
              console.error('Eroare Telegram:', e)
            }

            // VARIANTA 1: Web Audio API (comentat temporar - uneori probleme cu autoplay)
            /*
            try {
              const audioContext = new (window.AudioContext || window.webkitAudioContext)()

              // IMPORTANT: Resume AudioContext dacă e suspendat (pentru autoplay policy)
              if (audioContext.state === 'suspended') {
                await audioContext.resume()
              }

              const playClassicRing = (startTime) => {
                const osc1 = audioContext.createOscillator()
                const osc2 = audioContext.createOscillator()
                const gainNode = audioContext.createGain()

                osc1.connect(gainNode)
                osc2.connect(gainNode)
                gainNode.connect(audioContext.destination)

                osc1.frequency.setValueAtTime(440, startTime)
                osc2.frequency.setValueAtTime(480, startTime)
                osc1.type = 'sine'
                osc2.type = 'sine'

                const tremolo = audioContext.createOscillator()
                const tremoloGain = audioContext.createGain()
                tremolo.frequency.setValueAtTime(25, startTime)
                tremolo.connect(tremoloGain.gain)
                tremoloGain.gain.setValueAtTime(0.3, startTime)

                gainNode.connect(tremoloGain)
                tremoloGain.connect(audioContext.destination)

                gainNode.gain.setValueAtTime(0, startTime)
                gainNode.gain.linearRampToValueAtTime(0.7, startTime + 0.1)
                gainNode.gain.setValueAtTime(0.7, startTime + 2.0)
                gainNode.gain.linearRampToValueAtTime(0, startTime + 2.3)

                osc1.start(startTime)
                osc1.stop(startTime + 2.3)
                osc2.start(startTime)
                osc2.stop(startTime + 2.3)
                tremolo.start(startTime)
                tremolo.stop(startTime + 2.3)
              }

              playClassicRing(audioContext.currentTime)
              playClassicRing(audioContext.currentTime + 2.5)
              playClassicRing(audioContext.currentTime + 5.0)
              playClassicRing(audioContext.currentTime + 7.5)

            } catch (e) {
              console.log('Nu s-a putut reda sunetul (Web Audio API):', e)
            }
            */

            // VARIANTA 2: HTML5 Audio cu fișier local (mai fiabil pentru autoplay)
            try {
              const audio = new Audio('/sounds/phone-ring.mp3')
              audio.volume = 1.0

              // Oprește sunetul după 15 secunde
              audio.addEventListener('playing', () => {
                setTimeout(() => {
                  audio.pause()
                  audio.currentTime = 0
                }, 15000)
              })

              audio.play().catch(err => {
                console.error('Nu s-a putut reda sunetul:', err)
              })
            } catch (e) {
              console.error('Eroare la redarea sunetului:', e)
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
          { event: 'UPDATE', schema: 'public', table: 'orders', filter: `location=eq.${location}` },
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

  // Funcție pentru activarea manuală a sunetelor
  const activateAudio = async () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }
      setAudioContextReady(true)
      setShowAudioButton(false) // Ascunde butonul după activare
      setShowReactivateAudio(false) // Ascunde banner-ul de reactivare

      // Salvează data de ASTĂZI în localStorage
      const today = new Date().toDateString()
      localStorage.setItem('audioActivatedDate', today)

      console.log('✅ AudioContext activat - sunetele vor funcționa!')
    } catch (err) {
      console.error('❌ Nu s-a putut activa AudioContext:', err)
      alert('Nu s-au putut activa sunetele. Încearcă din nou.')
    }
  }

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('location', location)
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
    // Previne click-uri multiple
    if (isProcessingOrder) {
      console.log('⚠️ Comanda se procesează deja, te rog așteaptă...')
      return
    }

    try {
      setIsProcessingOrder(true) // Blochează butoanele

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

      // Trimite notificare Telegram când comanda este respinsă
      if (newStatus === 'rejected' && order) {
        try {
          const telegramToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN
          const chatId = import.meta.env.VITE_TELEGRAM_CHAT_ID
          const message = `❌ COMANDĂ RESPINSĂ! [📍 ${locationLabel}]\n\n` +
            `📝 ${order.order_number}\n` +
            `👤 ${order.customer_name}\n` +
            `💰 ${order.total} LEI\n` +
            `📍 ${order.customer_address}\n` +
            `📞 ${order.customer_phone}` +
            (rejectedReason ? `\n\n📋 Motiv: ${rejectedReason}` : '')

          await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: message
            })
          })

          console.log('✅ Notificare Telegram trimisă pentru comanda respinsă')
        } catch (telegramErr) {
          console.error('Eroare trimitere Telegram:', telegramErr)
          // Nu oprim procesul dacă notificarea eșuează
        }
      }

      // Refresh orders
      fetchOrders()
      setShowModal(null)
    } catch (error) {
      console.error('Error updating order status:', error)
    } finally {
      setIsProcessingOrder(false) // Deblochează butoanele
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
      {/* Banner reactivare audio când tab-ul devine activ */}
      {showReactivateAudio && (
        <div className="fixed top-0 left-0 right-0 z-[10000] bg-orange-500 text-white p-4 shadow-lg">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">⚠️</span>
              <span className="font-bold text-lg">Tab-ul a fost inactiv - Apasă pentru reactivare sunete</span>
            </div>
            <button
              onClick={activateAudio}
              className="bg-white text-orange-500 px-6 py-3 rounded-lg font-bold hover:bg-gray-100 transition-colors animate-pulse"
            >
              🔔 REACTIVEAZĂ SUNETE
            </button>
          </div>
        </div>
      )}

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
              🍗 Chicken and Pizza - Bucătărie {locationLabel}
            </h1>
            <div className="flex items-center space-x-4">
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${location === 'popesti' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                📍 {locationLabel}
              </span>
              <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-bold">
                v2.4.0
              </span>
              <span className="text-gray-600">
                Bună, {user.username}!
              </span>
              {showAudioButton && (
                <button
                  onClick={activateAudio}
                  className="bg-green-500 hover:bg-green-600 text-white px-5 py-2 rounded-lg transition-all transform hover:scale-105 flex items-center space-x-2 shadow-md animate-pulse"
                >
                  <span>🔔</span>
                  <span className="font-medium">Activează sunete</span>
                </button>
              )}
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
          
          {activeTab === 'products' && <ProductsManager location={location} />}
          
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
                  disabled={isProcessingOrder}
                  className={`flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg transition-colors ${
                    isProcessingOrder ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-400'
                  }`}
                >
                  Anulează
                </button>
                <button
                  onClick={() => updateOrderStatus(showModal.order.id, showModal.type, showModal.reason)}
                  disabled={isProcessingOrder}
                  className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors ${
                    isProcessingOrder
                      ? 'opacity-50 cursor-not-allowed bg-gray-400'
                      : showModal.type === 'paid'
                        ? 'bg-green-500 hover:bg-green-600'
                        : 'bg-red-500 hover:bg-red-600'
                  }`}
                >
                  {isProcessingOrder
                    ? '⏳ Se procesează...'
                    : showModal.type === 'paid'
                      ? 'Confirmă acceptarea'
                      : 'Confirmă respingerea'
                  }
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
                      {/* Reducere aplicată (voucher / promoție) — ca staff-ul să vadă DE CE totalul e mai mic */}
                      {Number(order.discount) > 0 && (
                        <div className="mb-3 inline-block rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-left">
                          <div className="flex justify-between gap-8 text-sm text-gray-700">
                            <span>Subtotal</span>
                            <span>{(Number(order.total) + Number(order.discount)).toFixed(2)} lei</span>
                          </div>
                          <div className="flex justify-between gap-8 text-sm font-semibold text-amber-700">
                            <span>🎟️ Reducere{order.applied_promotions?.[0]?.name ? ` (${order.applied_promotions[0].name})` : ''}</span>
                            <span>−{Number(order.discount).toFixed(2)} lei</span>
                          </div>
                        </div>
                      )}
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
                                        {item.sizeWeight
                                          ? item.name.replace(/\(.*?\)/, `(${item.sizeWeight})`)
                                          : item.name
                                        }
                                      </span>
                                      {item.sizeLabel && (
                                        <span className="bg-blue-200 text-blue-800 font-bold text-sm px-2 py-1 rounded ml-2">
                                          {item.sizeLabel}
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

                                    {/* Produs CADOU (0 lei) → arată din ce promoție, ca staff-ul să știe de ce e gratis */}
                                    {Number(item.price) === 0 && (
                                      <div className="mt-1 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                                        🎁 CADOU{order.applied_promotions?.[0]?.name ? ` · promoție: ${order.applied_promotions[0].name}` : ''}
                                      </div>
                                    )}
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