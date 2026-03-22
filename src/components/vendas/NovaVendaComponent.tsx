import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Search, Trash2, Calendar, User, Package, DollarSign } from 'lucide-react';
import { Product, Category, Sale } from '../../types';
import { subscribeToProducts, subscribeToCategories, subscribeToSales } from '../../services/dataService';
import { addSale, deleteSale } from '../../services/vendasService';
import { useAuth } from '../../contexts/AuthContext';
import { logAction } from '../../utils/audit';

const NovaVendaComponent = () => {
  const { profile, isAdmin } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    produtoId: '',
    quantidade: 1,
    precoUnitario: 0,
    categoriaId: '',
    descricao: '',
    data: new Date().toISOString().split('T')[0],
    responsavel: profile?.nome || ''
  });

  useEffect(() => {
    const unsubProducts = subscribeToProducts(setProducts);
    const unsubCategories = subscribeToCategories(setCategories);
    const unsubSales = subscribeToSales(setSales);

    return () => {
      unsubProducts();
      unsubCategories();
      unsubSales();
    };
  }, []);

  const handleProductChange = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setFormData({
        ...formData,
        produtoId: productId,
        precoUnitario: product.precoVenda,
        descricao: `Venda de ${product.nome}`
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setLoading(true);
    try {
      const valorTotal = formData.quantidade * formData.precoUnitario;
      const saleData: Sale = {
        ...formData,
        valorTotal
      };

      await addSale(saleData, profile.uid, profile.nome, isAdmin);
      logAction(profile.nome, 'Registrou nova venda', 'Loja', formData.descricao);
      setIsModalOpen(false);
      setFormData({
        produtoId: '',
        quantidade: 1,
        precoUnitario: 0,
        categoriaId: '',
        descricao: '',
        data: new Date().toISOString().split('T')[0],
        responsavel: profile?.nome || ''
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, descricao: string) => {
    if (!profile || !window.confirm('Tem certeza que deseja excluir esta venda?')) return;
    
    try {
      await deleteSale(id);
      logAction(profile.nome, 'Excluiu venda', 'Loja', descricao);
    } catch (error) {
      console.error(error);
    }
  };

  const filteredSales = sales.filter(sale => 
    sale.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.responsavel.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getProductName = (id: string) => products.find(p => p.id === id)?.nome || 'Produto não encontrado';

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold text-text-main">Nova Venda</h2>
          <p className="text-gray-500 text-sm lg:text-base">Registre e gerencie as vendas de produtos da atlética.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="btn-primary flex items-center justify-center gap-2"
        >
          <Plus size={20} />
          Registrar Venda
        </button>
      </header>

      <div className="glass-card p-4 lg:p-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar vendas..."
              className="input-field pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-background/50 text-[10px] lg:text-xs uppercase text-gray-500 font-bold">
              <tr>
                <th className="px-4 lg:px-6 py-4">Produto</th>
                <th className="px-4 lg:px-6 py-4 text-center">Qtd</th>
                <th className="px-4 lg:px-6 py-4">Valor Total</th>
                <th className="px-4 lg:px-6 py-4">Responsável</th>
                <th className="px-4 lg:px-6 py-4">Data</th>
                <th className="px-4 lg:px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-highlight/10">
              {filteredSales.length > 0 ? filteredSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-background/30 transition-colors">
                  <td className="px-4 lg:px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <Package size={16} />
                      </div>
                      <div>
                        <p className="font-medium text-xs lg:text-sm">{getProductName(sale.produtoId)}</p>
                        <p className="text-[10px] text-gray-400">{sale.descricao}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 lg:px-6 py-4 text-center text-xs lg:text-sm font-medium">
                    {sale.quantidade}
                  </td>
                  <td className="px-4 lg:px-6 py-4 text-xs lg:text-sm font-bold text-primary">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sale.valorTotal)}
                  </td>
                  <td className="px-4 lg:px-6 py-4 text-xs lg:text-sm text-gray-500">
                    {sale.responsavel}
                  </td>
                  <td className="px-4 lg:px-6 py-4 text-xs lg:text-sm text-gray-500">
                    {new Date(sale.data).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 lg:px-6 py-4 text-right">
                    <button 
                      onClick={() => sale.id && handleDelete(sale.id, sale.descricao)}
                      className="p-2 text-danger hover:bg-danger/10 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    Nenhuma venda encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg p-6 lg:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <ShoppingCart className="text-primary" />
                Registrar Venda
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white">
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Produto</label>
                  <select
                    required
                    className="input-field"
                    value={formData.produtoId}
                    onChange={(e) => handleProductChange(e.target.value)}
                  >
                    <option value="">Selecionar Produto</option>
                    {products.map(product => (
                      <option key={product.id} value={product.id}>
                        {product.nome} (Estoque: {product.estoque})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Quantidade</label>
                  <input
                    type="number"
                    required
                    min="1"
                    className="input-field"
                    value={formData.quantidade}
                    onChange={(e) => setFormData({...formData, quantidade: parseInt(e.target.value)})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Preço Unitário</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="number"
                      step="0.01"
                      required
                      className="input-field pl-10"
                      value={formData.precoUnitario}
                      onChange={(e) => setFormData({...formData, precoUnitario: parseFloat(e.target.value)})}
                    />
                  </div>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Categoria Financeira</label>
                  <select
                    required
                    className="input-field"
                    value={formData.categoriaId}
                    onChange={(e) => setFormData({...formData, categoriaId: e.target.value})}
                  >
                    <option value="">Selecionar Categoria</option>
                    {categories.filter(c => c.tipo === 'entrada').map(category => (
                      <option key={category.id} value={category.id}>{category.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Descrição</label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    value={formData.descricao}
                    onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Data</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="date"
                      required
                      className="input-field pl-10"
                      value={formData.data}
                      onChange={(e) => setFormData({...formData, data: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Responsável</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      required
                      className="input-field pl-10"
                      value={formData.responsavel}
                      onChange={(e) => setFormData({...formData, responsavel: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-highlight/10 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Valor Total</p>
                  <p className="text-xl font-bold text-primary">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(formData.quantidade * formData.precoUnitario)}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary"
                  >
                    {loading ? 'Salvando...' : 'Confirmar Venda'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default NovaVendaComponent;
