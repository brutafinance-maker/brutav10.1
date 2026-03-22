import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Download, FileText, ArrowUpRight, ArrowDownLeft, X, AlertCircle } from 'lucide-react';
import { collection, addDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Transaction } from '../types';
import { logAction } from '../utils/audit';

const Transactions = () => {
  const { profile } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Form state
  const [tipo, setTipo] = useState<'entrada' | 'saida'>('entrada');
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('Patrocínio');
  const [metodo, setMetodo] = useState('Pix');

  useEffect(() => {
    const q = query(collection(db, 'movimentacoes'), orderBy('data', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      setTransactions(docs);
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    setLoading(true);
    try {
      const newTransaction = {
        descricao,
        valor: Number(valor),
        tipo,
        categoria,
        metodo,
        data: new Date().toISOString(),
        usuarioId: profile.uid,
        usuarioNome: profile.nome
      };

      await addDoc(collection(db, 'movimentacoes'), newTransaction);
      await logAction(profile.nome, `Registrou ${tipo}: ${descricao}`, 'Financeiro', '/movimentacoes');
      
      setShowModal(false);
      // Reset form
      setDescricao('');
      setValor('');
      setTipo('entrada');
    } catch (error) {
      console.error('Erro ao salvar:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter(t => 
    t.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.usuarioNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.categoria.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold text-text-main">Movimentações</h2>
          <p className="text-gray-500 text-sm lg:text-base">Registre e controle todas as entradas e saídas.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="btn-primary w-full sm:w-auto justify-center py-3 lg:py-2"
        >
          <Plus size={20} />
          Nova Movimentação
        </button>
      </header>

      {/* Filters & Search */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 flex-1 max-w-3xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por descrição, responsável..." 
              className="w-full pl-10 pr-4 py-3 lg:py-2 rounded-lg border border-highlight/30 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white text-sm"
            />
          </div>
          <button className="flex items-center justify-center gap-2 px-4 py-3 lg:py-2 rounded-lg border border-highlight/30 bg-white text-sm font-medium hover:bg-gray-50">
            <Filter size={18} />
            Filtros
          </button>
        </div>
        <div className="flex gap-2">
          <button className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-3 lg:py-2 rounded-lg border border-highlight/30 bg-white text-sm font-medium hover:bg-gray-50">
            <Download size={18} />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-background/50 text-[10px] lg:text-xs uppercase text-gray-500 font-bold">
              <tr>
                <th className="px-4 lg:px-6 py-4">Data</th>
                <th className="px-4 lg:px-6 py-4">Tipo</th>
                <th className="px-4 lg:px-6 py-4">Descrição</th>
                <th className="px-4 lg:px-6 py-4">Categoria</th>
                <th className="px-4 lg:px-6 py-4">Responsável</th>
                <th className="px-4 lg:px-6 py-4 text-right">Valor</th>
                <th className="px-4 lg:px-6 py-4">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-highlight/10">
              {filteredTransactions.length > 0 ? filteredTransactions.map((t, i) => (
                <tr key={i} className="hover:bg-background/30 transition-colors">
                  <td className="px-4 lg:px-6 py-4 text-xs lg:text-sm text-gray-500">
                    {new Date(t.data).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 lg:px-6 py-4">
                    {t.tipo === 'entrada' ? (
                      <div className="flex items-center gap-1 text-primary font-bold text-[10px] lg:text-xs uppercase">
                        <ArrowUpRight size={14} />
                        Entrada
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-danger font-bold text-[10px] lg:text-xs uppercase">
                        <ArrowDownLeft size={14} />
                        Saída
                      </div>
                    )}
                  </td>
                  <td className="px-4 lg:px-6 py-4 font-medium text-sm lg:text-base">{t.descricao}</td>
                  <td className="px-4 lg:px-6 py-4 text-xs lg:text-sm text-gray-500">{t.categoria}</td>
                  <td className="px-4 lg:px-6 py-4 text-xs lg:text-sm text-gray-500">{t.usuarioNome}</td>
                  <td className={`px-4 lg:px-6 py-4 font-bold text-right text-sm lg:text-base ${t.tipo === 'entrada' ? 'text-primary' : 'text-danger'}`}>
                    {t.tipo === 'entrada' ? '+' : '-'} {formatCurrency(t.valor)}
                  </td>
                  <td className="px-4 lg:px-6 py-4">
                    <button className="p-2 rounded-lg hover:bg-highlight/20 text-primary transition-colors">
                      <FileText size={18} />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    Nenhuma movimentação encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Responsive */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSave} className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-primary text-white shrink-0">
              <h3 className="text-xl font-bold">Nova Movimentação</h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-white/80 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Tipo</label>
                  <select 
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as 'entrada' | 'saida')}
                    className="w-full p-3 lg:p-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary/20 outline-none"
                  >
                    <option value="entrada">Entrada</option>
                    <option value="saida">Saída</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Valor (R$)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    required
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    placeholder="0,00" 
                    className="w-full p-3 lg:p-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary/20 outline-none" 
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Descrição</label>
                <input 
                  type="text" 
                  required
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex: Patrocínio Subway" 
                  className="w-full p-3 lg:p-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary/20 outline-none" 
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Categoria</label>
                  <select 
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className="w-full p-3 lg:p-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary/20 outline-none"
                  >
                    <option>Patrocínio</option>
                    <option>Eventos</option>
                    <option>Produtos</option>
                    <option>Marketing</option>
                    <option>Doações</option>
                    <option>Outros</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Método</label>
                  <select 
                    value={metodo}
                    onChange={(e) => setMetodo(e.target.value)}
                    className="w-full p-3 lg:p-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary/20 outline-none"
                  >
                    <option>Pix</option>
                    <option>Dinheiro</option>
                    <option>Cartão</option>
                    <option>Transferência</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="p-6 bg-gray-50 flex flex-col sm:flex-row gap-3 shrink-0">
              <button 
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 lg:py-2 rounded-lg border border-gray-200 font-medium hover:bg-white order-2 sm:order-1"
              >
                Cancelar
              </button>
              <button 
                disabled={loading}
                className="flex-1 py-3 lg:py-2 rounded-lg bg-primary text-white font-bold hover:bg-secondary order-1 sm:order-2"
              >
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Transactions;
