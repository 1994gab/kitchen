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
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    price: '',
    original_price: '',
    is_on_sale: false,
    category: 'Pizza',
    image: '/img/menu/1.jpg',
    ingredients: [],
    allergens: []
  })

  useEffect(() => {
    fetchProducts()
  }, [])

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
      allergens: product.allergens || []
    })
  }

  const handleSave = async () => {
    try {
      // Convertesc prețurile în numere
      const price = parseFloat(editForm.price) || 0;
      const originalPrice = parseFloat(editForm.original_price) || 0;
      
      const { error } = await supabase
        .from('products')
        .update({
          ...editForm,
          price: price,
          original_price: originalPrice,
          is_on_sale: originalPrice > price,
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
    } catch (error) {
      console.error('Error updating product:', error)
      setModal({ show: true, message: 'Eroare la actualizare!', type: 'error' })
    }
  }

  const handleCancel = () => {
    setEditingId(null)
    setEditForm({})
  }

  const handleDelete = async (id) => {
    if (!confirm('Sigur vrei să ștergi acest produs?')) return
    
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)

      if (error) throw error
      
      setProducts(products.filter(p => p.id !== id))
      setModal({ show: true, message: 'Produs șters cu succes!', type: 'success' })
    } catch (error) {
      console.error('Error deleting product:', error)
      setModal({ show: true, message: 'Eroare la ștergere!', type: 'error' })
    }
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

      // Setez is_on_sale automat
      const productToAdd = {
        ...newProduct,
        price: price,
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
        allergens: []
      })
      setShowAddForm(false)
      
      setModal({ show: true, message: 'Produs adăugat cu succes!', type: 'success' })
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
      {/* Modal pentru notificări */}
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
                  <option value="Pizza">Pizza</option>
                  <option value="Pui">Pui</option>
                  <option value="Burger">Burger</option>
                  <option value="Salate">Salate</option>
                  <option value="Desert">Desert</option>
                  <option value="Băuturi">Băuturi</option>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Preț Vechi</label>
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
                  placeholder="0.00"
                />
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
                          <option value="Pizza">Pizza</option>
                          <option value="Pui">Pui</option>
                          <option value="Burger">Burger</option>
                          <option value="Salate">Salate</option>
                          <option value="Desert">Desert</option>
                          <option value="Băuturi">Băuturi</option>
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
                          placeholder="Preț vechi"
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
                        {product.is_on_sale ? (
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
                          onClick={() => handleDelete(product.id)}
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