import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const PromoManager = () => {
  const [promo, setPromo] = useState({
    discount_value: '',
    main_text: '',
    description: '',
    is_active: true
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ text: '', type: '' })

  useEffect(() => {
    fetchPromo()
  }, [])

  const fetchPromo = async () => {
    try {
      const { data, error } = await supabase
        .from('promo_text')
        .select('*')
        .single()

      if (error && error.code !== 'PGRST116') throw error
      
      if (data) {
        setPromo(data)
      }
    } catch (error) {
      console.error('Error fetching promo:', error)
      setMessage({ text: 'Eroare la încărcarea promoției', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage({ text: '', type: '' })

    try {
      // Verificăm dacă există deja o înregistrare
      const { data: existing } = await supabase
        .from('promo_text')
        .select('id')
        .single()

      let result
      if (existing) {
        // Update
        result = await supabase
          .from('promo_text')
          .update({
            discount_value: promo.discount_value,
            main_text: promo.main_text,
            description: promo.description,
            is_active: promo.is_active
          })
          .eq('id', existing.id)
      } else {
        // Insert
        result = await supabase
          .from('promo_text')
          .insert([promo])
      }

      if (result.error) throw result.error

      setMessage({ text: '✅ Promoția a fost salvată cu succes!', type: 'success' })
      
      // Ascundem mesajul după 3 secunde
      setTimeout(() => setMessage({ text: '', type: '' }), 3000)
    } catch (error) {
      console.error('Error saving promo:', error)
      setMessage({ text: '❌ Eroare la salvarea promoției', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-xl">Se încarcă...</div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
          <span className="text-3xl mr-3">🎯</span>
          Gestionare Promoție
        </h2>

        {message.text && (
          <div className={`mb-4 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        <div className="space-y-4">
          {/* Valoare Discount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Valoare Discount (%)
            </label>
            <input
              type="text"
              value={promo.discount_value}
              onChange={(e) => setPromo({ ...promo, discount_value: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ex: 30"
            />
          </div>

          {/* Text Principal */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Text principal (continuarea după "Reducere")
            </label>
            <input
              type="text"
              value={promo.main_text}
              onChange={(e) => setPromo({ ...promo, main_text: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ex: la toate* pizza!"
            />
            <p className="text-xs text-gray-500 mt-1">Textul complet va fi: "-{promo.discount_value || 'X'}% Reducere {promo.main_text}"</p>
          </div>

          {/* Descriere */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descriere
            </label>
            <textarea
              value={promo.description}
              onChange={(e) => setPromo({ ...promo, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows="3"
              placeholder="Ex: Oferta este valabilă până la sfârșitul lunii pentru toate pizza-urile din meniu."
            />
          </div>

          {/* Status Activ */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_active"
              checked={promo.is_active}
              onChange={(e) => setPromo({ ...promo, is_active: e.target.checked })}
              className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="is_active" className="ml-3 text-sm font-medium text-gray-700">
              Promoție activă (afișată pe site)
            </label>
          </div>

          {/* Preview */}
          <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-lg p-4 border border-orange-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Previzualizare:</h3>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-800 mb-2">
                {promo.discount_value && (
                  <>
                    <span className="text-4xl text-red-600">-{promo.discount_value}%</span>{' '}
                  </>
                )}
                Reducere
                <br />
                {promo.main_text || '___'}
              </div>
              <div className="text-sm text-gray-600 italic">
                *{promo.description || 'Descriere...'}
              </div>
            </div>
          </div>

          {/* Buton Salvare */}
          <div className="flex justify-end pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-6 py-3 rounded-lg font-medium text-white transition-all ${
                saving 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-blue-500 hover:bg-blue-600 transform hover:scale-105'
              }`}
            >
              {saving ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Se salvează...
                </span>
              ) : (
                '💾 Salvează Promoția'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PromoManager