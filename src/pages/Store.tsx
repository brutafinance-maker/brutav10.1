import React, { useState, useEffect } from 'react';
import { ShoppingBag, Plus, Search, Package, DollarSign, Trash2, Edit, Tag, ArrowUpCircle, Calculator } from 'lucide-react';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { Product, Category } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { logAction } from '../utils/audit';
import ProductSimulator from '../components/loja/ProductSimulator';

const Store = () => {
  const { profile, isAdmin } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  const [newProduct, setNewProduct] = useState({
    nome: '',
    precoVenda: 0,
    custoProducao: 0,
    quantidadeProduzida: 0,
    estoque: 0,
    categoria: '',
    descricao: ''
  });

  const [newSale, setNewSale] = useState({
    quantidade: 1,
    categoriaId: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'produtos'), orderBy('nome', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      setProducts(productsData);
      setLoading(false);
    });

    const unsubscribeCategories = onSnapshot(collection(db, 'categorias'), (snapshot) => {
      const categoriesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];
      setCategories(categoriesData);
    });

    return () => {
      unsubscribe();
      unsubscribeCategories();
    };
  }, []);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await addDoc(collection(db, 'produtos'), {
        ...newProduct,
        estoque: newProduct.quantidadeProduzida,
        dataCriacao: new Date().toISOString()
      });
      
      logAction(profile?.nome || 'Usuário', 'Adicionou produto: ' + newProduct.nome, 'Loja');
      
      setNewProduct({
        nome: '',
        precoVenda: 0,
        custoProducao: 0,
        quantidadeProduzida: 0,
        estoque: 0,
        categoria: '',
        descricao: ''
      });
    } catch (error) {
      console.error('Erro ao adicionar produto:', error);
    }
  };

  const handleRegisterSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !selectedProduct) return;

    if (selectedProduct.estoque < newSale.quantidade) {
      alert('Estoque insuficiente!');
      return;
    }

    try {
      const valorTotal = selectedProduct.precoVenda * newSale.quantidade;

      // 1. Create Transaction
      await addDoc(collection(db, 'movimentacoes'), {
        descricao: `Venda de produto da loja: ${newSale.quantidade}x ${selectedProduct.nome}`,
        valor: valorTotal,
        tipo: 'entrada',
        categoriaId: newSale.categoriaId || 'loja',
        categoriaNome: 'Loja',
        produtoId: selectedProduct.id,
        data: new Date().toISOString(),
        usuarioId: profile?.uid,
        usuarioNome: profile?.nome || 'Usuário',
        responsavel: profile?.nome || 'Usuário'
      });

      // 2. Update Stock and Sold quantity
      await updateDoc(doc(db, 'produtos', selectedProduct.id!), {
        estoque: increment(-newSale.quantidade),
        vendido: increment(newSale.quantidade)
      });

      logAction(profile?.nome || 'Usuário', `Registrou venda: ${newSale.quantidade}x ${selectedProduct.nome}`, 'Loja');
      
      setIsSaleModalOpen(false);
      setNewSale({
        quantidade: 1,
        categoriaId: ''
      });
    } catch (error) {
      console.error('Erro ao registrar venda:', error);
    }
  };

  const handleDeleteProduct = async (id: string, nome: string) => {
    if (!isAdmin || !window.confirm(`Deseja realmente excluir o produto "${nome}"?`)) return;

    try {
      await deleteDoc(doc(db, 'produtos', id));
      logAction(profile?.nome || 'Usuário', 'Excluiu produto: ' + nome, 'Loja');
    } catch (error) {
      console.error('Erro ao excluir produto:', error);
    }
  };

  const filteredProducts = products.filter(product =>
    product.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.categoria.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold text-text-main">Loja Brutamed</h2>
          <p className="text-gray-500 text-sm lg:text-base">Gestão de produtos, simulação de viabilidade e vendas da atlética.</p>
        </div>
      </header>

      <section className="space-y-4">
        <ProductSimulator 
          products={products} 
          onProductCreated={() => {}} 
        />
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <Package size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-text-main">Cadastrar Novo Produto</h3>
              <p className="text-sm text-gray-500">Adicione um novo produto ao catálogo da loja.</p>
            </div>
          </div>
          <div className="glass-card p-6">
            <form onSubmit={handleAddProduct} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Nome do Produto</label>
                  <input
                    required
                    type="text"
                    className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                    placeholder="Ex: Samba-canção Brutamed"
                    value={newProduct.nome}
                    onChange={(e) => setNewProduct({ ...newProduct, nome: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Categoria</label>
                  <input
                    required
                    type="text"
                    className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                    placeholder="Ex: Vestuário, Acessórios..."
                    value={newProduct.categoria}
                    onChange={(e) => setNewProduct({ ...newProduct, categoria: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Preço de Venda (R$)</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                    value={newProduct.precoVenda}
                    onChange={(e) => setNewProduct({ ...newProduct, precoVenda: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Custo de Produção (R$)</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                    value={newProduct.custoProducao}
                    onChange={(e) => setNewProduct({ ...newProduct, custoProducao: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Quantidade Produzida</label>
                  <input
                    required
                    type="number"
                    className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                    value={newProduct.quantidadeProduzida}
                    onChange={(e) => setNewProduct({ ...newProduct, quantidadeProduzida: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase">Descrição</label>
                <textarea
                  className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all min-h-[80px]"
                  placeholder="Detalhes do produto..."
                  value={newProduct.descricao}
                  onChange={(e) => setNewProduct({ ...newProduct, descricao: e.target.value })}
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="bg-primary text-white px-8 py-3 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                >
                  Salvar Produto
                </button>
              </div>
            </form>
          </div>
        </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
          <div className="p-2 bg-primary/10 text-primary rounded-lg">
            <ShoppingBag size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-text-main">Produtos Cadastrados</h3>
            <p className="text-sm text-gray-500">Catálogo de produtos disponíveis na loja.</p>
          </div>
        </div>

        <div className="glass-card p-4 flex items-center gap-3">
          <Search className="text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Buscar produtos por nome ou categoria..."
            className="bg-transparent border-none outline-none w-full text-sm lg:text-base"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {loading ? (
            <div className="col-span-full py-12 text-center text-gray-400">Carregando produtos...</div>
          ) : filteredProducts.length > 0 ? (
            filteredProducts.map((product) => {
              const custoUnitario = product.custoUnitario || product.custoProducao || 0;
              const lucroEstimado = product.precoVenda - custoUnitario;
              const margemLucro = custoUnitario > 0 ? (lucroEstimado / custoUnitario) * 100 : 0;
              
              return (
                <div key={product.id} className="glass-card overflow-hidden group flex flex-col">
                    <div className="h-32 bg-gradient-to-br from-primary/10 to-highlight/10 flex items-center justify-center relative shrink-0">
                      <ShoppingBag size={40} className="text-primary/30 group-hover:scale-110 transition-transform" />
                      <div className="absolute top-3 right-3 flex flex-col gap-1 items-end">
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                          product.estoque > 10 ? 'bg-green-100 text-green-600' :
                          product.estoque > 0 ? 'bg-yellow-100 text-yellow-600' :
                          'bg-red-100 text-red-600'
                        }`}>
                          {product.estoque > 0 ? `${product.estoque} em estoque` : 'Esgotado'}
                        </span>
                      </div>
                    </div>
                    <div className="p-5 flex flex-col flex-1">
                      <div className="mb-4">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-primary uppercase mb-1">
                          <Tag size={10} />
                          {product.categoria}
                        </div>
                        <h3 className="text-base font-bold text-text-main line-clamp-1" title={product.nome}>{product.nome}</h3>
                      </div>

                      <div className="space-y-2 mb-4 flex-1">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-500">Preço de venda:</span>
                          <span className="font-bold text-gray-800">{formatCurrency(product.precoVenda)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-500">Custo unitário:</span>
                          <span className="font-medium text-gray-600">{formatCurrency(custoUnitario)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-500">Lucro estimado:</span>
                          <span className={`font-bold ${lucroEstimado >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(lucroEstimado)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-sm pt-2 border-t border-gray-100">
                          <span className="text-gray-500">Qtd. vendida:</span>
                          <span className="font-bold text-primary">{product.vendido || 0} un.</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-auto">
                        <div className="text-xs font-bold uppercase">
                          {margemLucro > 20 ? (
                            <span className="text-green-600">Lucro Saudável</span>
                          ) : margemLucro >= 0 ? (
                            <span className="text-yellow-600">Lucro Baixo</span>
                          ) : (
                            <span className="text-red-600">Prejuízo</span>
                          )}
                        </div>
                        {isAdmin && (
                          <div className="flex gap-1">
                            <button 
                              onClick={() => {
                                setSelectedProduct(product);
                                setIsSaleModalOpen(true);
                              }}
                              className="p-1.5 text-gray-400 hover:text-primary transition-colors bg-gray-50 rounded-lg hover:bg-primary/10"
                              title="Registrar Venda"
                            >
                              <ArrowUpCircle size={18} />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(product.id!, product.nome)}
                              className="p-1.5 text-gray-400 hover:text-red-500 transition-colors bg-gray-50 rounded-lg hover:bg-red-50"
                              title="Excluir"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full py-12 text-center text-gray-400">
                Nenhum produto encontrado.
              </div>
            )}
          </div>
      </section>

      {/* Modal Registrar Venda */}
      {isSaleModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg p-6 lg:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">Registrar Venda</h3>
                <p className="text-xs text-gray-500">Produto: {selectedProduct.nome}</p>
              </div>
              <button onClick={() => setIsSaleModalOpen(false)} className="text-gray-400 hover:text-text-main">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>

            <form onSubmit={handleRegisterSale} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Quantidade</label>
                  <input
                    required
                    type="number"
                    min="1"
                    max={selectedProduct.estoque}
                    className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                    value={newSale.quantidade}
                    onChange={(e) => setNewSale({ ...newSale, quantidade: Number(e.target.value) })}
                  />
                  <p className="text-[10px] text-gray-400">Disponível: {selectedProduct.estoque}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Categoria de Entrada</label>
                  <select
                    required
                    className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                    value={newSale.categoriaId}
                    onChange={(e) => setNewSale({ ...newSale, categoriaId: e.target.value })}
                  >
                    <option value="">Selecionar...</option>
                    {categories
                      .filter(c => c.tipo === 'entrada')
                      .map(c => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))
                    }
                  </select>
                </div>
              </div>

              <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total da Venda:</span>
                  <span className="text-lg font-bold text-primary">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedProduct.precoVenda * newSale.quantidade)}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-primary text-white py-4 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
              >
                Confirmar Venda
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Store;
