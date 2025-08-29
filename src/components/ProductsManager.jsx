import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const ProductsManager = () => {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [activeCategory, setActiveCategory] = useState('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [modal, setModal] = useState({ show: false, message: '', type: 'success' })
  const [countdown, setCountdown] = useState(0)
  const [showRefreshNotice, setShowRefreshNotice] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, productId: null, productName: '' })
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    price: '',
    original_price: '',
    is_on_sale: false,
    category: 'pizza',
    image: '/img/menu/1.jpg',
    ingredients: [],
    allergens: [],
    extras: [],
    sizes: []
  })

  useEffect(() => {
    fetchProducts()
  }, [])

  // Timer countdown effect
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        const newCount = countdown - 1
        setCountdown(newCount)
        
        // Când ajunge la 0, arăt notificarea de refresh
        if (newCount === 0) {
          setShowRefreshNotice(true)
        }
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  // Funcție pentru pornirea countdown-ului
  const startCountdown = () => {
    setCountdown(60) // 60 secunde (1 minut)
  }

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true })

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (product) => {
    setEditingId(product.id)
    
    // Convertesc ingredients din format vechi (obiecte) în format nou (string-uri)
    let ingredients = product.ingredients || [];
    if (Array.isArray(ingredients) && ingredients.length > 0) {
      // Verific dacă e format vechi (obiecte cu label/value)
      if (typeof ingredients[0] === 'object' && ingredients[0].label) {
        ingredients = ingredients.map(ing => ing.label);
      }
    }
    
    setEditForm({
      name: product.name || '',
      description: product.description || '',
      price: product.price || 0,
      original_price: product.original_price || 0,
      is_on_sale: product.is_on_sale || false,
      category: product.category || '',
      ingredients: ingredients,
      allergens: product.allergens || [],
      extras: product.extras || [],
      sizes: product.sizes || []
    })
  }

  const handleSave = async () => {
    try {
      // Convertesc prețurile în numere
      const price = parseFloat(editForm.price) || 0;
      const originalPrice = parseFloat(editForm.original_price) || 0;
      
      // Procesez sizes pentru a converti prețurile în numere
      let processedSizes = null;
      if (editForm.category && editForm.category.toLowerCase() === 'pizza' && editForm.sizes && editForm.sizes.length > 0) {
        processedSizes = editForm.sizes.map(size => ({
          ...size,
          price: parseFloat(size.price) || 0
        }));
      }

      const { error } = await supabase
        .from('products')
        .update({
          ...editForm,
          category: editForm.category.toLowerCase(), // Convertesc categoria la lowercase
          price: price,
          original_price: originalPrice,
          is_on_sale: originalPrice > price,
          sizes: processedSizes,
          updated_at: new Date()
        })
        .eq('id', editingId)

      if (error) throw error
      
      // Actualizez lista locală
      setProducts(products.map(p => 
        p.id === editingId ? { ...p, ...editForm } : p
      ))
      
      setEditingId(null)
      setModal({ show: true, message: 'Produs actualizat cu succes!', type: 'success' })
      startCountdown()
    } catch (error) {
      console.error('Error updating product:', error)
      setModal({ show: true, message: 'Eroare la actualizare!', type: 'error' })
    }
  }

  const handleCancel = () => {
    setEditingId(null)
    setEditForm({})
  }

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', deleteConfirm.productId)

      if (error) throw error
      
      setProducts(products.filter(p => p.id !== deleteConfirm.productId))
      setModal({ show: true, message: 'Produs șters cu succes!', type: 'success' })
      startCountdown()
      setDeleteConfirm({ show: false, productId: null, productName: '' })
    } catch (error) {
      console.error('Error deleting product:', error)
      setModal({ show: true, message: 'Eroare la ștergere!', type: 'error' })
    }
  }

  const openDeleteConfirm = (product) => {
    setDeleteConfirm({
      show: true,
      productId: product.id,
      productName: product.name
    })
  }

  const handleAddProduct = async () => {
    try {
      // Validare
      const price = parseFloat(newProduct.price) || 0;
      const originalPrice = parseFloat(newProduct.original_price) || 0;
      
      if (!newProduct.name || price <= 0) {
        setModal({ show: true, message: 'Te rog completează numele și prețul!', type: 'error' })
        return
      }

      // Procesez sizes pentru a converti prețurile în numere
      let processedSizes = null;
      if (newProduct.category && newProduct.category.toLowerCase() === 'pizza' && newProduct.sizes && newProduct.sizes.length > 0) {
        processedSizes = newProduct.sizes.map(size => ({
          ...size,
          price: parseFloat(size.price) || 0
        }));
      }

      // Setez is_on_sale automat
      const productToAdd = {
        ...newProduct,
        category: newProduct.category.toLowerCase(), // Convertesc categoria la lowercase
        price: price,
        sizes: processedSizes,
        original_price: originalPrice,
        is_on_sale: originalPrice > price,
        created_at: new Date(),
        updated_at: new Date()
      }

      const { data, error } = await supabase
        .from('products')
        .insert([productToAdd])
        .select()

      if (error) throw error
      
      // Adaug la lista locală
      setProducts([...products, data[0]])
      
      // Resetez formularul
      setNewProduct({
        name: '',
        description: '',
        price: '',
        original_price: '',
        is_on_sale: false,
        category: 'Pizza',
        image: '/img/menu/1.jpg',
        ingredients: [],
        allergens: [],
        extras: []
      })
      setShowAddForm(false)
      
      setModal({ show: true, message: 'Produs adăugat cu succes!', type: 'success' })
      startCountdown()
    } catch (error) {
      console.error('Error adding product:', error)
      setModal({ show: true, message: 'Eroare la adăugare!', type: 'error' })
    }
  }

  // Obțin categoriile unice
  const categories = ['all', ...new Set(products.map(p => p.category).filter(Boolean))]
  
  // Filtrez produsele după categorie
  const filteredProducts = activeCategory === 'all' 
    ? products 
    : products.filter(p => p.category === activeCategory)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Se încarcă produsele...</div>
      </div>
    )
  }

  return (
    <>
      {/* Timer countdown notification */}
      {countdown > 0 && (
        <div className="fixed bottom-4 right-4 z-40 bg-blue-500 text-white rounded-lg shadow-lg p-4 max-w-sm">
          <div className="flex items-center">
            <div className="animate-spin mr-3">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold">Actualizare în curs...</p>
              <p className="text-sm">Site-ul se va actualiza în {countdown} secunde</p>
            </div>
          </div>
          <div className="mt-2 bg-blue-400 rounded-full h-1 overflow-hidden">
            <div 
              className="bg-white h-full transition-all duration-1000 ease-linear"
              style={{ width: `${(60 - countdown) / 60 * 100}%` }}
            ></div>
          </div>
        </div>
      )}
      
      {/* Refresh notification */}
      {showRefreshNotice && (
        <div className="fixed bottom-4 right-4 z-40 bg-green-500 text-white rounded-lg shadow-lg p-4 max-w-sm animate-pulse">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold">✨ Gata! Site-ul este actualizat!</p>
              <p className="text-sm mt-1">Deschide site-ul și apasă F5 sau Ctrl+R pentru a vedea modificările.</p>
              <button
                onClick={() => setShowRefreshNotice(false)}
                className="mt-2 bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm font-medium"
              >
                Am înțeles
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal pentru notificări */}
      {/* Modal confirmare ștergere */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setDeleteConfirm({ show: false, productId: null, productName: '' })}></div>
          <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-md mx-4">
            <div className="flex flex-col items-center">
              <div className="text-red-500 text-5xl mb-4">⚠️</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Confirmare ștergere</h3>
              <p className="text-gray-600 text-center mb-6">
                Ești sigur că vrei să ștergi produsul <strong>{deleteConfirm.productName}</strong>?
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setDeleteConfirm({ show: false, productId: null, productName: '' })}
                  className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg transition-colors"
                >
                  Anulează
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                >
                  Șterge produsul
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal notificare */}
      {modal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setModal({ ...modal, show: false })}></div>
          <div className={`relative bg-white rounded-lg shadow-xl p-6 max-w-md mx-4 ${
            modal.type === 'success' ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'
          }`}>
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {modal.type === 'success' ? (
                  <div className="text-green-500 text-2xl">✓</div>
                ) : (
                  <div className="text-red-500 text-2xl">✕</div>
                )}
              </div>
              <div className="ml-3 flex-1">
                <p className={`text-lg font-medium ${
                  modal.type === 'success' ? 'text-green-900' : 'text-red-900'
                }`}>
                  {modal.type === 'success' ? 'Succes!' : 'Eroare!'}
                </p>
                <p className="mt-1 text-gray-600">{modal.message}</p>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setModal({ ...modal, show: false })}
                className={`px-4 py-2 rounded-lg font-medium text-white ${
                  modal.type === 'success' 
                    ? 'bg-green-500 hover:bg-green-600' 
                    : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
      
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">🍕 Gestionare Produse</h2>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
          >
            {showAddForm ? '✕ Anulează' : '➕ Adaugă Produs Nou'}
          </button>
        </div>

        {/* Formular adăugare produs nou */}
        {showAddForm && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Adaugă Produs Nou</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nume*</label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Ex: Pizza Margherita"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categorie</label>
                <select
                  value={newProduct.category}
                  onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="pizza">Pizza</option>
                  <option value="pui">Pui</option>
                  <option value="burger">Burger</option>
                  <option value="salate">Salate</option>
                  <option value="desert">Desert</option>
                  <option value="bauturi">Băuturi</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preț*</label>
                <input
                  type="text"
                  value={newProduct.price || ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9.]/g, '');
                    setNewProduct({...newProduct, price: value});
                  }}
                  onBlur={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    setNewProduct({...newProduct, price: Math.max(0, value)});
                  }}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Preț Vechi 
                  <span className="text-xs font-normal text-gray-500 ml-1">(opțional)</span>
                </label>
                <input
                  type="text"
                  value={newProduct.original_price || ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9.]/g, '');
                    setNewProduct({...newProduct, original_price: value});
                  }}
                  onBlur={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    setNewProduct({...newProduct, original_price: Math.max(0, value)});
                  }}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Ex: 45.99"
                />
                <div className="text-xs text-gray-500 mt-1 space-y-1">
                  <p>💡 <strong>Cum funcționează:</strong></p>
                  <p className="ml-3">• Dacă Preț Vechi > Preț Nou → afișează reducere pe site</p>
                  <p className="ml-3">• Dacă Preț Vechi ≤ Preț Nou → afișează preț normal</p>
                  <p className="ml-3">• Fără Preț Vechi → afișează preț normal</p>
                  <p className="mt-1">
                    <strong>Exemplu:</strong> Preț 35 lei, Preț Vechi 45 lei → 
                    <span className="line-through ml-1">45 lei</span> 
                    <span className="text-red-600 font-semibold">35 lei (-22%)</span>
                  </p>
                </div>
              </div>
              <div className="col-span-2 md:col-span-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Descriere</label>
                <textarea
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({...newProduct, description: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows="2"
                  placeholder="Descrierea produsului..."
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Ingrediente (separate cu virgulă)</label>
                <textarea
                  value={Array.isArray(newProduct.ingredients) 
                    ? newProduct.ingredients.join(', ')
                    : ''
                  }
                  onChange={(e) => {
                    const ingredients = e.target.value
                      .split(',')
                      .map(item => item.trim())
                      .filter(Boolean);
                    
                    setNewProduct({...newProduct, ingredients});
                  }}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows="2"
                  placeholder="Ex: Chifla burger, Carne vită, Bacon, Sos BBQ, Salată, Roșii"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Alergeni (separate cu virgulă)</label>
                <textarea
                  value={Array.isArray(newProduct.allergens) 
                    ? newProduct.allergens.join(', ')
                    : ''
                  }
                  onChange={(e) => {
                    const allergens = e.target.value
                      .split(',')
                      .map(item => item.trim())
                      .filter(Boolean);
                    
                    setNewProduct({...newProduct, allergens});
                  }}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows="2"
                  placeholder="Ex: Gluten, Lactoză, Ouă, Muștar"
                />
              </div>
              
              {/* Dimensiuni pentru Pizza */}
              {newProduct.category && newProduct.category.toLowerCase() === 'pizza' && (
                <div className="col-span-2 md:col-span-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">📏 Dimensiuni Pizza</label>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    {newProduct.sizes && newProduct.sizes.length > 0 ? (
                      <div className="space-y-2 mb-3">
                        {newProduct.sizes.map((size, index) => (
                          <div key={index} className="flex items-center gap-2 bg-white p-2 rounded border">
                            <input
                              type="text"
                              value={size.size}
                              onChange={(e) => {
                                const newSizes = [...newProduct.sizes];
                                newSizes[index].size = e.target.value;
                                setNewProduct({...newProduct, sizes: newSizes});
                              }}
                              className="w-16 px-2 py-1 border rounded"
                              placeholder="cm"
                            />
                            <span>cm</span>
                            <input
                              type="text"
                              value={size.label}
                              onChange={(e) => {
                                const newSizes = [...newProduct.sizes];
                                newSizes[index].label = e.target.value;
                                setNewProduct({...newProduct, sizes: newSizes});
                              }}
                              className="flex-1 px-2 py-1 border rounded"
                              placeholder="Nume (ex: Mică)"
                            />
                            <input
                              type="text"
                              value={size.price}
                              onChange={(e) => {
                                const newSizes = [...newProduct.sizes];
                                newSizes[index].price = e.target.value;
                                setNewProduct({...newProduct, sizes: newSizes});
                              }}
                              className="w-20 px-2 py-1 border rounded"
                              placeholder="Preț"
                            />
                            <span>lei</span>
                            <button
                              type="button"
                              onClick={() => {
                                const newSizes = newProduct.sizes.filter((_, i) => i !== index);
                                setNewProduct({...newProduct, sizes: newSizes});
                              }}
                              className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm mb-2">Nu sunt dimensiuni adăugate</p>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const newSizes = [...(newProduct.sizes || []), { size: '', label: '', price: '' }];
                        setNewProduct({...newProduct, sizes: newSizes});
                      }}
                      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                    >
                      + Adaugă dimensiune
                    </button>
                  </div>
                </div>
              )}
              
              {/* Extras pentru produs nou */}
              <div className="col-span-2 md:col-span-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">➕ Extras disponibile</label>
                <div className="bg-gray-50 p-3 rounded-lg">
                  {newProduct.extras && newProduct.extras.length > 0 ? (
                    <div className="space-y-2 mb-3">
                      {newProduct.extras.map((extra, index) => (
                        <div key={index} className="flex items-center justify-between bg-white p-2 rounded border">
                          <span className="font-medium">{extra.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-green-600 font-bold">{extra.price} lei</span>
                            <button
                              type="button"
                              onClick={() => {
                                const newExtras = newProduct.extras.filter((_, i) => i !== index);
                                setNewProduct({...newProduct, extras: newExtras});
                              }}
                              className="text-red-500 hover:text-red-700"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm mb-3">Adaugă extras pentru acest produs</p>
                  )}
                  
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Nume extra (ex: Bacon)"
                      className="flex-1 px-3 py-2 border rounded-lg text-sm"
                      id="new-extra-name"
                    />
                    <input
                      type="number"
                      placeholder="Preț"
                      min="0"
                      step="0.5"
                      className="w-24 px-3 py-2 border rounded-lg text-sm"
                      id="new-extra-price"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const nameInput = document.getElementById('new-extra-name');
                        const priceInput = document.getElementById('new-extra-price');
                        
                        if (nameInput.value && priceInput.value) {
                          const newExtra = {
                            name: nameInput.value,
                            price: parseFloat(priceInput.value)
                          };
                          
                          const newExtras = [...(newProduct.extras || []), newExtra];
                          setNewProduct({...newProduct, extras: newExtras});
                          
                          nameInput.value = '';
                          priceInput.value = '';
                        } else {
                          setModal({ show: true, message: 'Completează numele și prețul pentru extra!', type: 'error' });
                        }
                      }}
                      className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      Adaugă
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="col-span-2 md:col-span-4 flex justify-end gap-3">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="bg-gray-400 hover:bg-gray-500 text-white px-6 py-2 rounded-lg font-medium"
                >
                  Anulează
                </button>
                <button
                  onClick={handleAddProduct}
                  className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg font-medium"
                >
                  💾 Salvează Produs
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Filtre categorii */}
        <div className="mb-6 flex flex-wrap gap-2">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeCategory === cat 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              {cat === 'all' ? '🍽️ Toate' : cat}
            </button>
          ))}
        </div>

        {/* Tabel produse */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Nume</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Categorie</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Preț</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Preț Vechi</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Reducere Estimată</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProducts.map(product => (
                <React.Fragment key={product.id}>
                  <tr className="hover:bg-gray-50">
                    {editingId === product.id ? (
                      <>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                          className="w-full px-2 py-1 border rounded"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={editForm.category}
                          onChange={(e) => setEditForm({...editForm, category: e.target.value})}
                          className="w-full px-2 py-1 border rounded"
                        >
                          <option value="pizza">Pizza</option>
                          <option value="pui">Pui</option>
                          <option value="burger">Burger</option>
                          <option value="salate">Salate</option>
                          <option value="desert">Desert</option>
                          <option value="bauturi">Băuturi</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={editForm.price || ''}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9.]/g, '');
                            setEditForm({...editForm, price: value});
                          }}
                          onBlur={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            setEditForm({...editForm, price: Math.max(0, value)});
                          }}
                          className="w-20 px-2 py-1 border rounded"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={editForm.original_price || ''}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9.]/g, '');
                            setEditForm({...editForm, original_price: value});
                          }}
                          onBlur={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            setEditForm({
                              ...editForm, 
                              original_price: Math.max(0, value),
                              is_on_sale: value > parseFloat(editForm.price || 0)
                            });
                          }}
                          placeholder="Ex: 45.99"
                          className="w-24 px-2 py-1 border rounded"
                        />
                      </td>
                      <td className="px-4 py-3">
                        {editForm.is_on_sale && editForm.original_price > editForm.price ? (
                          <div className="text-center">
                            <span className="text-green-600 font-bold">
                              -{Math.round(((editForm.original_price - editForm.price) / editForm.original_price) * 100)}%
                            </span>
                            <div className="text-xs text-gray-500">
                              (-{(editForm.original_price - editForm.price).toFixed(2)} lei)
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={handleSave}
                          className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm mr-2"
                        >
                          ✓
                        </button>
                        <button
                          onClick={handleCancel}
                          className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm"
                        >
                          ✕
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-medium">{product.name}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-gray-100 rounded text-sm">
                          {product.category}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={product.is_on_sale ? "text-red-500 font-bold" : "font-medium"}>
                          {product.price} lei
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {product.original_price && product.original_price > 0 ? (
                          <span className="text-gray-400 line-through">
                            {product.original_price} lei
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {product.is_on_sale && product.original_price > product.price ? (
                          <div className="flex items-center gap-2">
                            <span className="text-green-600 font-bold text-lg">
                              -{Math.round(((product.original_price - product.price) / product.original_price) * 100)}%
                            </span>
                            <span className="text-xs text-gray-500">
                              (-{(product.original_price - product.price).toFixed(2)} lei)
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleEdit(product)}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm mr-2"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => openDeleteConfirm(product)}
                          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
                        >
                          🗑️
                        </button>
                      </td>
                    </>
                  )}
                </tr>
                {/* Rând expandabil pentru ingredients și allergens când editez */}
                {editingId === product.id && (
                  <tr className="bg-blue-50">
                    <td colSpan="6" className="px-4 py-4">
                      <div className="grid grid-cols-1 gap-4">
                        {/* Info despre prețul vechi */}
                        <div className="bg-blue-100 p-3 rounded-lg">
                          <div className="text-xs text-gray-600 space-y-2">
                            <p>
                              💡 <strong>Ghid Preț Vechi & Reduceri:</strong>
                            </p>
                            <div className="ml-4 space-y-1">
                              <p>
                                ✅ <strong>Pentru reducere:</strong> Preț vechi > Preț nou
                                <br />
                                <span className="ml-4">Ex: Preț vechi 45 lei, Preț nou 35 lei → Pe site: </span>
                                <span className="line-through">45 lei</span> 
                                <span className="text-red-600 font-semibold ml-1">35 lei (-22%)</span>
                              </p>
                              <p>
                                ⚠️ <strong>Fără reducere:</strong> Preț vechi ≤ Preț nou SAU fără preț vechi
                                <br />
                                <span className="ml-4">Ex: Preț vechi 30 lei, Preț nou 35 lei → Pe site: </span>
                                <span className="font-semibold">35 lei</span> (preț normal)
                              </p>
                              <p>
                                📊 <strong>În tabel:</strong> Coloana "Reducere Estimată" va afișa:
                                <br />
                                <span className="ml-4">• Procentul reducerii când există (ex: -22%)</span>
                                <br />
                                <span className="ml-4">• "-" când nu există reducere sau preț vechi</span>
                              </p>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            📝 Descriere
                          </label>
                          <textarea
                            value={editForm.description || ''}
                            onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                            className="w-full px-3 py-2 border rounded-lg"
                            rows="2"
                            placeholder="Descrierea produsului..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            🥘 Ingrediente (separate cu virgulă)
                          </label>
                          <textarea
                            value={Array.isArray(editForm.ingredients) 
                              ? editForm.ingredients.join(', ')
                              : ''
                            }
                            onChange={(e) => {
                              const ingredients = e.target.value
                                .split(',')
                                .map(item => item.trim())
                                .filter(Boolean);
                              
                              setEditForm({...editForm, ingredients});
                            }}
                            className="w-full px-3 py-2 border rounded-lg"
                            rows="2"
                            placeholder="Ex: Chifla burger, Carne vită, Bacon, Sos BBQ, Salată, Roșii"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            ⚠️ Alergeni (separate cu virgulă)
                          </label>
                          <textarea
                            value={Array.isArray(editForm.allergens) 
                              ? editForm.allergens.join(', ')
                              : ''
                            }
                            onChange={(e) => {
                              const allergens = e.target.value
                                .split(',')
                                .map(item => item.trim())
                                .filter(Boolean);
                              
                              setEditForm({...editForm, allergens});
                            }}
                            className="w-full px-3 py-2 border rounded-lg"
                            rows="2"
                            placeholder="Ex: Gluten, Lactoză, Ouă, Muștar"
                          />
                        </div>
                        
                        {/* Dimensiuni pentru Pizza - EDITARE */}
                        {editForm.category && editForm.category.toLowerCase() === 'pizza' && (
                          <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              📏 Dimensiuni Pizza
                            </label>
                            <div className="bg-gray-50 p-3 rounded-lg">
                              {editForm.sizes && editForm.sizes.length > 0 ? (
                                <div className="space-y-2 mb-3">
                                  {editForm.sizes.map((size, index) => (
                                    <div key={index} className="flex items-center gap-2 bg-white p-2 rounded border">
                                      <input
                                        type="text"
                                        value={size.size}
                                        onChange={(e) => {
                                          const newSizes = [...editForm.sizes];
                                          newSizes[index].size = e.target.value;
                                          setEditForm({...editForm, sizes: newSizes});
                                        }}
                                        className="w-16 px-2 py-1 border rounded"
                                        placeholder="cm"
                                      />
                                      <span>cm</span>
                                      <input
                                        type="text"
                                        value={size.label}
                                        onChange={(e) => {
                                          const newSizes = [...editForm.sizes];
                                          newSizes[index].label = e.target.value;
                                          setEditForm({...editForm, sizes: newSizes});
                                        }}
                                        className="flex-1 px-2 py-1 border rounded"
                                        placeholder="Nume (ex: Mică)"
                                      />
                                      <input
                                        type="text"
                                        value={size.price}
                                        onChange={(e) => {
                                          const newSizes = [...editForm.sizes];
                                          newSizes[index].price = e.target.value;
                                          setEditForm({...editForm, sizes: newSizes});
                                        }}
                                        className="w-20 px-2 py-1 border rounded"
                                        placeholder="Preț"
                                      />
                                      <span>lei</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const newSizes = editForm.sizes.filter((_, i) => i !== index);
                                          setEditForm({...editForm, sizes: newSizes});
                                        }}
                                        className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-gray-500 text-sm mb-2">Nu sunt dimensiuni adăugate</p>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  const newSizes = [...(editForm.sizes || []), { size: '', label: '', price: '' }];
                                  setEditForm({...editForm, sizes: newSizes});
                                }}
                                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                              >
                                + Adaugă dimensiune
                              </button>
                            </div>
                          </div>
                        )}
                        
                        {/* Secțiune Extras */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            ➕ Extras disponibile
                          </label>
                          <div className="bg-gray-50 p-3 rounded-lg">
                            {/* Lista de extras existente */}
                            {editForm.extras && editForm.extras.length > 0 ? (
                              <div className="space-y-2 mb-3">
                                {editForm.extras.map((extra, index) => (
                                  <div key={index} className="flex items-center justify-between bg-white p-2 rounded border">
                                    <span className="font-medium">{extra.name}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-green-600 font-bold">{extra.price} lei</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const newExtras = editForm.extras.filter((_, i) => i !== index);
                                          setEditForm({...editForm, extras: newExtras});
                                        }}
                                        className="text-red-500 hover:text-red-700"
                                      >
                                        🗑️
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-gray-500 text-sm mb-3">Nu există extras pentru acest produs</p>
                            )}
                            
                            {/* Formular adăugare extra nou */}
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Nume extra (ex: Mozzarella)"
                                className="flex-1 px-3 py-2 border rounded-lg text-sm"
                                id={`extra-name-${product.id}`}
                              />
                              <input
                                type="number"
                                placeholder="Preț"
                                min="0"
                                step="0.5"
                                className="w-24 px-3 py-2 border rounded-lg text-sm"
                                id={`extra-price-${product.id}`}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const nameInput = document.getElementById(`extra-name-${product.id}`);
                                  const priceInput = document.getElementById(`extra-price-${product.id}`);
                                  
                                  if (nameInput.value && priceInput.value) {
                                    const newExtra = {
                                      name: nameInput.value,
                                      price: parseFloat(priceInput.value)
                                    };
                                    
                                    const newExtras = [...(editForm.extras || []), newExtra];
                                    setEditForm({...editForm, extras: newExtras});
                                    
                                    // Resetez câmpurile
                                    nameInput.value = '';
                                    priceInput.value = '';
                                  } else {
                                    setModal({ show: true, message: 'Completează numele și prețul pentru extra!', type: 'error' });
                                  }
                                }}
                                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                              >
                                Adaugă
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Nu sunt produse în această categorie
          </div>
        )}
      </div>
    </div>
    </>
  )
}

export default ProductsManager