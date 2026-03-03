import React, { useState, useMemo } from 'react';
import { ShoppingCart, Package, Truck, X, FileSpreadsheet, Send, ChevronRight, Plus, Trash2, Layers, ArrowRight, ArrowLeft, DollarSign, ArrowUpDown, List } from 'lucide-react';

import {
  BRAND_NAME,
  ACCESS_LEVELS,
  EXCHANGE_RATES,
  TRANSLATIONS,
  DEFAULT_CONTAINERS,
  CATEGORIES,
  PRODUCTS
} from './data';

const App = () => {
  const t = TRANSLATIONS.en; // Force English translation

  // Bypass Login & Pricing State
  // Defaulting to "MSRP" pricing tier with no login wall
  const [userTier, setUserTier] = useState(ACCESS_LEVELS['0000']);
  const [currency, setCurrency] = useState('USD');

  const [currentCategory, setCurrentCategory] = useState('all');
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Sorting State
  const [sortOrder, setSortOrder] = useState('default'); // 'default', 'asc', 'desc', 'inStock'

  // Container State
  const [containers, setContainers] = useState(DEFAULT_CONTAINERS);
  const [selectedContainerId, setSelectedContainerId] = useState('40HQ');
  const [containerQty, setContainerQty] = useState(1);
  const [showAddContainerModal, setShowAddContainerModal] = useState(false);
  const [newContainer, setNewContainer] = useState({ name: '', cbm: '' });

  // Modular Builder State
  const [builderModules, setBuilderModules] = useState([]);
  const [activeSelector, setActiveSelector] = useState(null);

  const [customerInfo, setCustomerInfo] = useState({
    company: '',
    contact: '',
    email: '',
    phone: '',
    address: ''
  });

  // Helper: Get Price based on Currency and Tier
  const getPrice = (basePrice) => {
    const rate = EXCHANGE_RATES[currency].rate;
    const multiplier = userTier ? userTier.multiplier : 1.0;
    return (basePrice * multiplier * rate);
  };

  // Helper: Get Original Price (MSRP) based on Currency only
  const getOriginalPrice = (basePrice) => {
    const rate = EXCHANGE_RATES[currency].rate;
    return basePrice * rate;
  };

  // Helper: Format Price String
  const formatPriceStr = (price) => {
    const symbol = EXCHANGE_RATES[currency].symbol;
    const digits = currency === 'TWD' ? 0 : 2;
    return `${symbol}${price.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
  };

  const selectedContainer = useMemo(() =>
    containers.find(c => c.id === selectedContainerId) || containers[0],
    [containers, selectedContainerId]
  );

  const filteredProducts = useMemo(() => {
    let products = currentCategory === 'all'
      ? PRODUCTS
      : PRODUCTS.filter(p => p.category === currentCategory);

    if (sortOrder === 'asc') {
      return [...products].sort((a, b) => a.price - b.price);
    } else if (sortOrder === 'desc') {
      return [...products].sort((a, b) => b.price - a.price);
    } else if (sortOrder === 'inStock') {
      return [...products].sort((a, b) => {
        if (a.caStock === b.caStock) return 0;
        return a.caStock ? -1 : 1; // true comes first
      });
    }

    return products;
  }, [currentCategory, sortOrder]);

  const addToCart = (product, qty = null) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      const addQty = qty || product.moq;
      if (existing) {
        return prev.map(item =>
          item.id === product.id ? { ...item, qty: item.qty + (qty ? qty : 1) } : item
        );
      }
      return [...prev, { ...product, qty: addQty }];
    });
    setIsCartOpen(true);
  };

  const updateQty = (id, newQty) => {
    if (newQty < 1) return;
    setCart(prev => prev.map(item => item.id === id ? { ...item, qty: newQty } : item));
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const cartSummary = useMemo(() => {
    const totalQty = cart.reduce((acc, item) => acc + item.qty, 0);
    const totalPrice = cart.reduce((acc, item) => acc + (getPrice(item.price) * item.qty), 0);
    const totalCBM = cart.reduce((acc, item) => acc + (item.cbm * item.qty), 0);

    const totalCapacity = selectedContainer.cbm * Math.max(1, containerQty);
    const containerLoad = (totalCBM / totalCapacity) * 100;

    return { totalQty, totalPrice, totalCBM, containerLoad, totalCapacity };
  }, [cart, selectedContainer, containerQty, currency, userTier]);

  // === Builder Functions ===
  const addBuilderModule = (width) => {
    setBuilderModules(prev => [...prev, { id: Date.now(), width, top: null, bottom: null, topQty: 0, bottomQty: 0 }]);
  };
  const removeBuilderModule = (moduleId) => {
    setBuilderModules(prev => prev.filter(m => m.id !== moduleId));
  };
  const moveModule = (moduleId, direction) => {
    setBuilderModules(prev => {
      const index = prev.findIndex(m => m.id === moduleId);
      if (index === -1) return prev;
      const newModules = [...prev];
      if (direction === 'left' && index > 0) {
        [newModules[index - 1], newModules[index]] = [newModules[index], newModules[index - 1]];
      } else if (direction === 'right' && index < newModules.length - 1) {
        [newModules[index + 1], newModules[index]] = [newModules[index], newModules[index + 1]];
      }
      return newModules;
    });
  };
  const selectModuleComponent = (product) => {
    if (!activeSelector) return;
    setBuilderModules(prev => prev.map(m => {
      if (m.id === activeSelector.moduleId) {
        return {
          ...m,
          [activeSelector.type]: product,
          [`${activeSelector.type}Qty`]: product.moq || 1
        };
      }
      return m;
    }));
    setActiveSelector(null);
  };

  const handleBuilderQtyChange = (moduleId, type, newQty) => {
    let val = newQty === '' ? '' : Math.max(0, parseInt(newQty) || 0);
    setBuilderModules(prev => prev.map(m => {
      if (m.id === moduleId) {
        return { ...m, [`${type}Qty`]: val };
      }
      return m;
    }));
  };

  const addAssemblyToCart = () => {
    builderModules.forEach(mod => {
      const tQty = Number(mod.topQty) || 0;
      const bQty = Number(mod.bottomQty) || 0;
      if (mod.top && tQty > 0) addToCart(mod.top, tQty);
      if (mod.bottom && bQty > 0) addToCart(mod.bottom, bQty);
    });
    setIsCartOpen(true);
  };

  const builderTotal = useMemo(() => {
    return builderModules.reduce((acc, mod) => {
      const topPrice = mod.top ? getPrice(mod.top.price) * (Number(mod.topQty) || 0) : 0;
      const botPrice = mod.bottom ? getPrice(mod.bottom.price) * (Number(mod.bottomQty) || 0) : 0;
      return acc + topPrice + botPrice;
    }, 0);
  }, [builderModules, currency, userTier]);
  // === End Builder Functions ===

  const handleAddContainer = (e) => {
    e.preventDefault();
    if (!newContainer.name || !newContainer.cbm) return;
    const newId = `CUSTOM-${Date.now()}`;
    const newType = { id: newId, name: newContainer.name, cbm: parseFloat(newContainer.cbm), isDefault: false };
    setContainers([...containers, newType]);
    setSelectedContainerId(newId);
    setNewContainer({ name: '', cbm: '' });
    setShowAddContainerModal(false);
  };

  const handleDeleteContainer = (id) => {
    setContainers(prev => prev.filter(c => c.id !== id));
    if (selectedContainerId === id) setSelectedContainerId(DEFAULT_CONTAINERS[0].id);
  };

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    const orderData = {
      orderId: `ORD-${Date.now()}`,
      date: new Date().toLocaleString(),
      language: 'en',
      currency: currency,
      pricingTier: userTier.name,
      containerType: `${selectedContainer.name} (x${containerQty})`,
      ...customerInfo,
      items: cart.map(item => ({
        id: item.id,
        name: item.name,
        qty: item.qty,
        basePriceUSD: item.price,
        salesPrice: getPrice(item.price).toFixed(2),
        total: (getPrice(item.price) * item.qty).toFixed(2),
        cbm: (item.cbm * item.qty).toFixed(2)
      })),
      summary: { ...cartSummary }
    };

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += `"Order ID","Date","Company","Contact","Phone","Email","Address","Container","Currency","Pricing Tier"\n`;

    // Safely wrap text in quotes and escape internal quotes to prevent misaligned columns
    const safeStr = (str) => `"${(str || '').toString().replace(/"/g, '""')}"`;

    csvContent += `${safeStr(orderData.orderId)},${safeStr(orderData.date)},${safeStr(orderData.company)},${safeStr(orderData.contact)},${safeStr(orderData.phone)},${safeStr(orderData.email)},${safeStr(orderData.address)},${safeStr(selectedContainer.name)},${safeStr(currency)},${safeStr(userTier.name)}\n\n`;

    csvContent += `"Product ID","Product Name","Unit Price (${currency})","Qty","Total (${currency})","Volume(CBM)"\n`;
    orderData.items.forEach(row => {
      csvContent += `${safeStr(row.id)},${safeStr(row.name)},${safeStr(row.salesPrice)},${safeStr(row.qty)},${safeStr(row.total)},${safeStr(row.cbm)}\n`;
    });

    // Align Summaries in correct columns (Empty fields for 1-3, Values in 4-6)
    csvContent += `\n"","","","Total",${safeStr(formatPriceStr(cartSummary.totalPrice))},${safeStr(cartSummary.totalCBM.toFixed(2))}\n`;
    csvContent += `"","","","Container Load",${safeStr(cartSummary.containerLoad.toFixed(2) + '%')},${safeStr('(' + containerQty + ' x ' + selectedContainer.name + ')')}\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${orderData.company}_Order_${orderData.orderId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowSuccessModal(true);
    setCart([]);
  };

  // === RENDER MAIN APP ===
  return (
    <div className="min-h-screen bg-gray-50 text-slate-800 font-sans">
      {/* Header */}
      <header className="bg-slate-900 text-white sticky top-0 z-40 shadow-lg">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="bg-[#4a9d8f] p-2 rounded-lg">
              <span className="font-bold text-xl tracking-tighter">BC</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold leading-none">{BRAND_NAME}</h1>
              <p className="text-xs text-gray-400">{t.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">

            {/* Currency Selector */}
            <div className="hidden md:flex items-center gap-2 bg-slate-800 px-2 py-1 rounded-lg border border-slate-700">
              <DollarSign size={14} className="text-[#4a9d8f]" />
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="bg-transparent text-xs text-white font-medium focus:outline-none cursor-pointer"
              >
                {Object.keys(EXCHANGE_RATES).map(curr => (
                  <option key={curr} value={curr} className="bg-slate-800">{curr}</option>
                ))}
              </select>
            </div>

            {/* Added Pricing Tier Selector */}
            <div className="hidden md:flex items-center gap-2 bg-slate-800 px-2 py-1 rounded-lg border border-slate-700">
              <select
                value={userTier.id}
                onChange={(e) => {
                  const selectedLevel = Object.values(ACCESS_LEVELS).find(lvl => lvl.id === e.target.value);
                  if (selectedLevel) setUserTier(selectedLevel);
                }}
                className="bg-transparent text-xs text-white font-medium focus:outline-none cursor-pointer"
              >
                {Object.values(ACCESS_LEVELS).map(tier => (
                  <option key={tier.id} value={tier.id} className="bg-slate-800">{tier.name}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 hover:bg-slate-800 rounded-full transition-colors"
            >
              <ShoppingCart size={24} />
              {cart.length > 0 && (
                <span className="absolute top-0 right-0 bg-[#4a9d8f] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {cart.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-col md:flex-row min-h-[calc(100vh-80px)]">

        {/* Sidebar Navigation */}
        <aside className="w-full md:w-64 bg-white border-r border-gray-200 overflow-y-auto hidden md:block">
          <div className="p-4">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Categories</h2>
            <nav className="space-y-1">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCurrentCategory(cat.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-between ${currentCategory === cat.id
                      ? 'bg-[#9ed9cf]/20 text-[#1f4740] border border-[#9ed9cf]/50'
                      : 'text-gray-600 hover:bg-gray-50'
                    }`}
                >
                  {cat.name}
                  {currentCategory === cat.id && <ChevronRight size={16} />}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Mobile Category Select */}
        <div className="md:hidden bg-white p-4 border-b border-gray-200 sticky top-[72px] z-30 flex flex-wrap gap-2">
          <select
            value={currentCategory}
            onChange={(e) => setCurrentCategory(e.target.value)}
            className="flex-1 p-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            {CATEGORIES.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-24 p-2 border border-gray-300 rounded-lg text-sm bg-white font-mono"
          >
            {Object.keys(EXCHANGE_RATES).map(curr => (
              <option key={curr} value={curr}>{curr}</option>
            ))}
          </select>
          <select
            value={userTier.id}
            onChange={(e) => {
              const selectedLevel = Object.values(ACCESS_LEVELS).find(lvl => lvl.id === e.target.value);
              if (selectedLevel) setUserTier(selectedLevel);
            }}
            className="w-24 p-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            {Object.values(ACCESS_LEVELS).map(tier => (
              <option key={tier.id} value={tier.id}>{tier.name}</option>
            ))}
          </select>
        </div>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-8 overflow-x-hidden">

          {/* === MODULAR BUILDER SECTION === */}
          {currentCategory === 'modular' && (
            <>
              {/* 1:1 Visual Builder */}
              <div className="mb-10 bg-white rounded-xl shadow-sm border border-[#9ed9cf]/50 overflow-hidden">
                <div className="p-4 bg-[#9ed9cf]/10 border-b border-[#9ed9cf]/30 flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-bold text-[#1f4740] flex items-center gap-2">
                      <Layers size={20} />
                      {t.builderTitle}
                    </h2>
                    <p className="text-xs text-[#4a9d8f] mt-1">{t.builderHint}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setBuilderModules([])}
                      className="text-xs text-[#4a9d8f] hover:text-[#1f4740] underline px-2"
                    >
                      {t.clearBuilder}
                    </button>
                  </div>
                </div>

                {/* Builder Canvas */}
                <div className="p-6 overflow-x-auto bg-slate-50 min-h-[400px] flex items-end gap-1">
                  {builderModules.length === 0 && (
                    <div className="w-full flex flex-col items-center justify-center text-gray-400 py-10 border-2 border-dashed border-gray-200 rounded-lg">
                      <Layers size={48} className="mb-2 opacity-20" />
                      <p>{t.builderHint}</p>
                    </div>
                  )}
                  {builderModules.map((mod, index) => (
                    <div key={mod.id} className="flex-shrink-0 flex flex-col group relative" style={{ width: mod.width * 8 + 'px' }}>
                      <div className="flex justify-between mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => moveModule(mod.id, 'left')} disabled={index === 0} className="bg-slate-200 hover:bg-slate-300 text-slate-600 rounded p-1 disabled:opacity-30"><ArrowLeft size={10} /></button>
                        <button onClick={() => moveModule(mod.id, 'right')} disabled={index === builderModules.length - 1} className="bg-slate-200 hover:bg-slate-300 text-slate-600 rounded p-1 disabled:opacity-30"><ArrowRight size={10} /></button>
                      </div>
                      {/* Top Component */}
                      <div className={`mb-1 rounded-t-lg border-2 flex flex-col transition-all relative overflow-hidden ${mod.top ? 'border-[#9ed9cf] bg-white' : 'border-dashed border-gray-300 bg-gray-100 hover:border-[#9ed9cf]/70'}`}>
                        <div onClick={() => setActiveSelector({ moduleId: mod.id, type: 'top', width: mod.width })} className="h-24 flex items-center justify-center cursor-pointer p-1">
                          {mod.top ? (
                            <img src={mod.top.builderImage || mod.top.image} className="w-full h-full object-contain" alt="" />
                          ) : (
                            <span className="text-[10px] text-gray-400 font-bold">{t.topComponent} ({mod.width}")</span>
                          )}
                        </div>
                        {mod.top && (
                          <div className="flex items-center justify-center bg-[#9ed9cf]/10 border-t border-[#9ed9cf]/30 py-1" onClick={e => e.stopPropagation()}>
                            <button onClick={() => handleBuilderQtyChange(mod.id, 'top', (Number(mod.topQty) || 0) - 1)} className="px-2 py-0.5 text-[#4a9d8f] hover:bg-[#9ed9cf]/30 rounded leading-none">-</button>
                            <input type="number" value={mod.topQty} onChange={e => handleBuilderQtyChange(mod.id, 'top', e.target.value)} className="w-8 text-center text-xs font-bold bg-transparent focus:outline-none text-[#1f4740]" />
                            <button onClick={() => handleBuilderQtyChange(mod.id, 'top', (Number(mod.topQty) || 0) + 1)} className="px-2 py-0.5 text-[#4a9d8f] hover:bg-[#9ed9cf]/30 rounded leading-none">+</button>
                          </div>
                        )}
                      </div>
                      {/* Bottom Component */}
                      <div className={`rounded-b-lg border-2 flex flex-col transition-all relative overflow-hidden ${mod.bottom ? 'border-slate-200 bg-white' : 'border-dashed border-gray-300 bg-gray-100 hover:border-slate-300'}`}>
                        <div onClick={() => setActiveSelector({ moduleId: mod.id, type: 'bottom', width: mod.width })} className="h-40 flex items-center justify-center cursor-pointer p-1">
                          {mod.bottom ? (
                            <img src={mod.bottom.builderImage || mod.bottom.image} className="w-full h-full object-contain" alt="" />
                          ) : (
                            <span className="text-[10px] text-gray-400 font-bold">{t.bottomComponent} ({mod.width}")</span>
                          )}
                        </div>
                        {mod.bottom && (
                          <div className="flex items-center justify-center bg-slate-50 border-t border-slate-200 py-1 mt-auto" onClick={e => e.stopPropagation()}>
                            <button onClick={() => handleBuilderQtyChange(mod.id, 'bottom', (Number(mod.bottomQty) || 0) - 1)} className="px-2 py-0.5 text-slate-600 hover:bg-slate-200 rounded leading-none">-</button>
                            <input type="number" value={mod.bottomQty} onChange={e => handleBuilderQtyChange(mod.id, 'bottom', e.target.value)} className="w-8 text-center text-xs font-bold bg-transparent focus:outline-none text-slate-800" />
                            <button onClick={() => handleBuilderQtyChange(mod.id, 'bottom', (Number(mod.bottomQty) || 0) + 1)} className="px-2 py-0.5 text-slate-600 hover:bg-slate-200 rounded leading-none">+</button>
                          </div>
                        )}
                      </div>
                      <button onClick={() => removeBuilderModule(mod.id)} className="absolute top-6 -right-3 bg-red-100 text-red-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10"><X size={12} /></button>
                      <div className="text-center mt-2"><span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded-full text-slate-600 font-mono">{mod.width}"</span></div>
                    </div>
                  ))}
                  <div className="flex-shrink-0 ml-4 flex flex-col gap-2 self-center">
                    <span className="text-xs font-bold text-gray-400 uppercase mb-1">{t.addModule}</span>
                    <div className="flex flex-col gap-2">
                      {[16, 24, 32].map(w => (
                        <button key={w} onClick={() => addBuilderModule(w)} className="flex items-center gap-2 bg-white border border-gray-200 hover:border-[#9ed9cf] hover:text-[#4a9d8f] px-3 py-2 rounded-lg text-xs font-bold shadow-sm transition-all"><Plus size={14} />{w}" {t.moduleType}</button>
                      ))}
                    </div>
                  </div>
                </div>

                {builderModules.length > 0 && (
                  <div className="p-4 bg-[#9ed9cf]/10 border-t border-[#9ed9cf]/30 flex justify-between items-center">
                    <div className="text-sm text-[#1f4740]">
                      {t.assemblyTotal}: <span className="font-bold text-lg text-[#002b2b]">{formatPriceStr(builderTotal)}</span>
                    </div>
                    <button onClick={addAssemblyToCart} className="bg-[#4a9d8f] text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-[#3d8377] shadow-md flex items-center gap-2"><ShoppingCart size={16} />{t.addAllToCart}</button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Component Selector Modal (for Visual Builder) */}
          {activeSelector && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setActiveSelector(null)}>
              <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 animate-scale-in" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
                  <h3 className="font-bold text-lg text-gray-800">{activeSelector.type === 'top' ? t.topComponent : t.bottomComponent} ({activeSelector.width}")</h3>
                  <button onClick={() => setActiveSelector(null)} className="p-1 hover:bg-gray-100 rounded-full"><X size={20} /></button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto">
                  {PRODUCTS
                    .filter(p => p.category === 'modular' && p.modularAttrs && p.modularAttrs.type === activeSelector.type && p.modularAttrs.width === activeSelector.width)
                    .map(part => {
                      const finalPrice = getPrice(part.price);
                      return (
                        <div key={part.id} onClick={() => selectModuleComponent(part)} className="border border-gray-200 rounded-lg p-3 cursor-pointer hover:border-[#9ed9cf] hover:shadow-md transition-all text-center group flex flex-col justify-between items-center">
                          {/* Image Placeholder */}
                          <div className="aspect-square bg-gray-50 rounded mb-2 flex items-center justify-center p-2 w-full"><img src={part.image} className="w-full h-full object-contain" alt="" /></div>
                          <h4 className="text-sm font-medium text-gray-900 line-clamp-2 mb-1">{part.name}</h4>

                          <div className="mt-auto pt-2 w-full">
                            <span className="text-[10px] text-gray-400 block uppercase font-bold leading-none mb-1">{t.dealerPrice}</span>
                            <span className="text-sm font-bold text-[#002b2b]">{formatPriceStr(finalPrice)}</span>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>
            </div>
          )}
          {/* === END MODULAR BUILDER SECTION === */}

          <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">
                {CATEGORIES.find(c => c.id === currentCategory)?.name}
              </h2>
              <p className="text-gray-500 text-sm mt-1">
                {filteredProducts.length} models
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 flex items-center gap-1"><ArrowUpDown size={14} /> {t.sortBy}:</span>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:border-[#4a9d8f] bg-white cursor-pointer"
              >
                <option value="default">{t.default}</option>
                <option value="asc">{t.priceLowHigh}</option>
                <option value="desc">{t.priceHighLow}</option>
                <option value="inStock">{t.inStockSort}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map(product => {
              const finalPrice = getPrice(product.price);
              const originalPrice = getOriginalPrice(product.price);

              return (
                <div key={product.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow group flex flex-col hover:border-[#4a9d8f]">
                  <div className="relative w-full aspect-square bg-white border-b border-gray-100 overflow-hidden p-6 flex items-center justify-center">
                    <img src={product.image} alt={product.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" />

                    {/* MSRP Top Left */}
                    <div className="absolute top-2 left-2 flex items-center gap-1.5">
                      <span className="bg-white/90 text-[#002b2b] text-[10px] font-bold px-2 py-1 rounded shadow-sm backdrop-blur-sm border border-[#9ed9cf]/30">
                        {t.msrp}: {formatPriceStr(originalPrice)}
                      </span>
                    </div>

                    {/* Product ID Top Right */}
                    <div className="absolute top-2 right-2 flex items-center gap-1.5">
                      <span className="bg-black/60 text-white text-[10px] px-2 py-1 rounded backdrop-blur-sm">
                        {product.id}
                      </span>
                    </div>
                  </div>

                  <div className="p-5 flex-1 flex flex-col">
                    <div className="mb-2 flex-1">
                      <h3 className="font-bold text-gray-900 leading-tight line-clamp-2" title={product.name}>{product.name}</h3>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-4">
                      {product.specs.slice(0, 2).map((spec, i) => (<span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded-full border border-gray-200">{spec}</span>))}
                    </div>

                    <div className="space-y-1.5 text-xs text-gray-500 mb-4 border-t border-b border-gray-100 py-3">
                      <div className="flex justify-between items-center">
                        <span>{t.caStock}:</span>
                        <span className={`font-medium px-2 py-0.5 rounded text-[10px] ${product.caStock ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {product.caStock ? t.inStock : t.outOfStock}
                        </span>
                      </div>
                      <div className="flex justify-between"><span>{t.cbmUnit}:</span><span className="font-mono text-gray-700">{product.cbm} m³</span></div>
                      <div className="flex justify-between"><span>{t.moq}:</span><span className="font-mono text-[#4a9d8f] font-bold">{product.moq} pcs</span></div>
                    </div>

                    <div className="flex items-center justify-between mt-auto">
                      {/* Dealer Price on Bottom Left */}
                      <div>
                        <span className="text-[10px] text-gray-400 block uppercase font-bold mb-1">{userTier.name} {t.unitPrice}</span>
                        <span className="text-xl font-bold text-[#002b2b]">{formatPriceStr(finalPrice)}</span>
                      </div>
                      <button onClick={() => addToCart(product)} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 active:scale-95 transition-all flex items-center gap-2"><ShoppingCart size={16} />{t.addToCart}</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </main>
      </div>

      {/* Cart Sidebar */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity" onClick={() => setIsCartOpen(false)}></div>
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-[101]">

            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-slate-50">
              <h2 className="font-bold text-lg flex items-center gap-2 text-slate-800"><List size={20} /> {t.cartTitle}</h2>
              <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-gray-200 rounded-full text-slate-500"><X size={20} /></button>
            </div>

            <div className="px-4 py-3 bg-white border-b border-gray-100 space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">{t.selectContainer}</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <select value={selectedContainerId} onChange={(e) => setSelectedContainerId(e.target.value)} className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-700 py-2 px-3 pr-8 rounded leading-tight focus:outline-none focus:bg-white focus:border-[#4a9d8f] text-sm">
                      {containers.map(c => (<option key={c.id} value={c.id}>{c.name} ({c.cbm} CBM)</option>))}
                    </select>
                  </div>
                  <button onClick={() => setShowAddContainerModal(true)} className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 rounded flex items-center justify-center border border-gray-200"><Plus size={16} /></button>
                  {!selectedContainer.isDefault && <button onClick={() => handleDeleteContainer(selectedContainer.id)} className="bg-red-50 hover:bg-red-100 text-red-500 px-3 rounded flex items-center justify-center border border-red-100"><Trash2 size={16} /></button>}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">{t.containerQty}</label>
                <div className="flex items-center border border-gray-200 rounded-md w-full bg-white">
                  <button onClick={() => setContainerQty(q => Math.max(1, q - 1))} className="px-4 py-2 hover:bg-gray-50 text-gray-600 border-r border-gray-200">-</button>
                  <input type="number" min="1" value={containerQty} onChange={(e) => setContainerQty(Math.max(1, parseInt(e.target.value) || 1))} className="flex-1 text-center text-sm focus:outline-none py-2" />
                  <button onClick={() => setContainerQty(q => q + 1)} className="px-4 py-2 hover:bg-gray-50 text-gray-600 border-l border-gray-200">+</button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
              {cart.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <Package size={48} className="mx-auto mb-3 opacity-20" />
                  <p>{t.emptyCart}</p>
                  <p className="text-xs mt-1 text-gray-300">{t.emptyCartHint}</p>
                  <button onClick={() => setIsCartOpen(false)} className="mt-4 text-[#4a9d8f] text-sm font-medium hover:underline">{t.continue}</button>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex gap-3 bg-white border border-gray-200 p-3 rounded-lg shadow-sm">
                    <img src={item.image} alt="" className="w-16 h-16 object-contain p-1 rounded bg-gray-50 border border-gray-100" />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h4 className="font-medium text-sm text-gray-900 line-clamp-1 pr-2">{item.name}</h4>
                        <button onClick={() => removeFromCart(item.id)} className="text-gray-400 hover:text-red-500 flex-shrink-0"><X size={14} /></button>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5 truncate">{item.id}</p>
                      <div className="flex justify-between items-end mt-2">
                        <div className="text-sm font-bold text-[#002b2b]">{formatPriceStr(getPrice(item.price))}</div>
                        <div className="flex items-center border border-gray-200 rounded-md bg-white">
                          <button onClick={() => updateQty(item.id, item.qty - 1)} className="px-2 py-0.5 hover:bg-gray-50 text-gray-600 border-r border-gray-200">-</button>
                          <input type="number" value={item.qty} onChange={(e) => updateQty(item.id, parseInt(e.target.value) || 0)} className="w-10 text-center text-sm focus:outline-none" />
                          <button onClick={() => updateQty(item.id, item.qty + 1)} className="px-2 py-0.5 hover:bg-gray-50 text-gray-600 border-l border-gray-200">+</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="px-4 py-3 bg-white border-t border-gray-100 shadow-[0_-2px_10px_rgba(0,0,0,0.02)]">
                <div className="flex justify-between text-xs text-slate-700 mb-1 font-medium">
                  <span className="flex items-center gap-1"><Truck size={12} /> {t.loadingAnalysis} ({containerQty} x {selectedContainer.name})</span>
                  <span className={`${cartSummary.containerLoad > 100 ? 'text-red-600' : 'text-[#4a9d8f]'}`}>{cartSummary.containerLoad.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${cartSummary.containerLoad > 100 ? 'bg-red-500' : 'bg-[#4a9d8f]'}`} style={{ width: `${Math.min(cartSummary.containerLoad, 100)}%` }}></div>
                </div>
                <div className="flex justify-between text-[10px] text-gray-400 mt-1.5">
                  <span>{t.totalVolume}: <span className="text-gray-600 font-mono">{cartSummary.totalCBM.toFixed(2)} / {cartSummary.totalCapacity} m³</span></span>
                  <span className={cartSummary.containerLoad > 100 ? 'text-red-500 font-bold' : 'text-green-600'}>{cartSummary.containerLoad > 100 ? t.overloaded : t.available}</span>
                </div>
              </div>
            )}

            {cart.length > 0 && (
              <div className="p-4 bg-white border-t border-gray-100">
                <div className="mb-4 flex justify-between items-end text-sm text-gray-600">
                  <span>{t.totalAmount} ({currency})</span>
                  <span className="text-xl font-bold text-[#002b2b]">{formatPriceStr(cartSummary.totalPrice)}</span>
                </div>
                <form onSubmit={handleSubmitOrder} className="space-y-3">
                  <h3 className="text-xs font-bold text-gray-400 uppercase">{t.clientInfo}</h3>
                  <input required placeholder={t.company} className="w-full text-sm border border-gray-300 rounded p-2 focus:ring-1 focus:ring-[#4a9d8f] outline-none" value={customerInfo.company} onChange={e => setCustomerInfo({ ...customerInfo, company: e.target.value })} />
                  <div className="grid grid-cols-2 gap-2">
                    <input required placeholder={t.contact} className="w-full text-sm border border-gray-300 rounded p-2 outline-none focus:border-[#4a9d8f]" value={customerInfo.contact} onChange={e => setCustomerInfo({ ...customerInfo, contact: e.target.value })} />
                    <input required placeholder={t.phone} className="w-full text-sm border border-gray-300 rounded p-2 outline-none focus:border-[#4a9d8f]" value={customerInfo.phone} onChange={e => setCustomerInfo({ ...customerInfo, phone: e.target.value })} />
                  </div>
                  <input required type="email" placeholder={t.email} className="w-full text-sm border border-gray-300 rounded p-2 outline-none focus:border-[#4a9d8f]" value={customerInfo.email} onChange={e => setCustomerInfo({ ...customerInfo, email: e.target.value })} />
                  <input required placeholder={t.address} className="w-full text-sm border border-gray-300 rounded p-2 outline-none focus:border-[#4a9d8f]" value={customerInfo.address} onChange={e => setCustomerInfo({ ...customerInfo, address: e.target.value })} />

                  <button type="submit" className="w-full bg-[#4a9d8f] text-white py-3 rounded-lg font-bold hover:bg-[#3d8377] transition-colors flex items-center justify-center gap-2 mt-2 shadow-lg shadow-[#9ed9cf]"><FileSpreadsheet size={18} />{t.exportBtn}</button>
                  <p className="text-[10px] text-center text-gray-400 mt-2">{t.exportHint}</p>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Container Modal */}
      {showAddContainerModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 animate-scale-in">
            <h3 className="text-lg font-bold text-gray-800 mb-4">{t.containerSettings}</h3>
            <div className="space-y-4">
              <div><label className="block text-xs font-bold text-gray-500 mb-1">{t.containerName}</label><input type="text" value={newContainer.name} onChange={e => setNewContainer({ ...newContainer, name: e.target.value })} className="w-full border border-gray-300 rounded p-2 text-sm focus:border-[#4a9d8f] outline-none" placeholder="e.g. 15ft Truck" autoFocus /></div>
              <div><label className="block text-xs font-bold text-gray-500 mb-1">{t.containerCbm}</label><input type="number" value={newContainer.cbm} onChange={e => setNewContainer({ ...newContainer, cbm: e.target.value })} className="w-full border border-gray-300 rounded p-2 text-sm focus:border-[#4a9d8f] outline-none" placeholder="e.g. 15" /></div>
              <div className="flex gap-2 mt-6">
                <button onClick={() => setShowAddContainerModal(false)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium">{t.cancel}</button>
                <button onClick={handleAddContainer} disabled={!newContainer.name || !newContainer.cbm} className="flex-1 py-2 bg-[#4a9d8f] text-white rounded-lg hover:bg-[#3d8377] text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">{t.save}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center animate-scale-in">
            <div className="w-16 h-16 bg-[#9ed9cf]/20 text-[#4a9d8f] rounded-full flex items-center justify-center mx-auto mb-4"><Send size={32} /></div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">{t.successTitle}</h3>
            <p className="text-sm text-gray-500 mb-6">{t.successMsg}</p>
            <button onClick={() => setShowSuccessModal(false)} className="w-full bg-gray-900 text-white py-2 rounded-lg font-medium hover:bg-gray-800">{t.close}</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
