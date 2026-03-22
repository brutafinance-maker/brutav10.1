import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Search, Filter, Download, FileText, ArrowUpRight, ArrowDownLeft, X, Edit, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Transaction, Category } from '../../types';
import { logAction } from '../../utils/audit';
import { subscribeToTransactions, subscribeToCategories } from '../../services/dataService';
import { collection, addDoc } from 'firebase/firestore';
import { addTransaction, updateTransaction, deleteTransaction } from '../../services/movimentacoesService';
import ExportModal from './ExportModal';
import { auth, db } from '../../firebase';

const MovimentacoesComponent = () => {
  const { profile } = useAuth();
  const isAdmin = profile?.diretorFinanceiro;
  const location = useLocation();
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState<'pdf' | 'csv'>('pdf');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (location.state?.openModal) {
      setShowModal(true);
      // Clear state to prevent reopening on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // Form state
  const [tipo, setTipo] = useState<'entrada' | 'saida'>('entrada');
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);

  // Edit form state
  const [editForm, setEditForm] = useState({
    tipo: 'entrada' as 'entrada' | 'saida',
    valor: '',
    descricao: '',
    categoriaId: '',
    data: ''
  });

  useEffect(() => {
    const unsubscribeTransactions = subscribeToTransactions((data) => {
      setTransactions(data);
    });

    const unsubscribeCategories = subscribeToCategories((data) => {
      setCategories(data);
    });

    return () => {
      unsubscribeTransactions();
      unsubscribeCategories();
    };
  }, []);

  useEffect(() => {
    const filteredCategories = categories.filter(c => c.tipo === tipo);
    if (filteredCategories.length > 0) {
      // Only change if current category is not in the filtered list
      const currentCategoryValid = filteredCategories.some(c => c.id === categoriaId);
      if (!currentCategoryValid) {
        setCategoriaId(filteredCategories[0].id!);
      }
    } else {
      setCategoriaId('');
    }
  }, [tipo, categories]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      alert("Apenas diretores financeiros podem registrar movimentações diretamente.");
      return;
    }
    
    const user = auth.currentUser;

    if (!user) {
      alert("Usuário não autenticado.");
      return;
    }

    if (!valor || !tipo || !descricao || !data) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }

    if (Number(valor) <= 0) {
      alert("O valor deve ser maior que zero.");
      return;
    }
    
    setLoading(true);
    try {
      const selectedCategory = categories.find(c => c.id === categoriaId);
      const categoriaNome = selectedCategory ? selectedCategory.nome : 'Sem categoria';
      
      // Ensure the date is saved correctly with time
      const [year, month, day] = data.split('-');
      const now = new Date();
      const dateObj = new Date(Number(year), Number(month) - 1, Number(day), now.getHours(), now.getMinutes(), now.getSeconds());

      const userName = profile?.nome || user.displayName || 'Usuário';

      const newTransaction: Omit<Transaction, 'id'> = {
        descricao: descricao || "",
        valor: Number(valor),
        tipo,
        categoriaId: categoriaId || "",
        categoriaNome,
        data: dateObj.toISOString(),
        usuarioId: user.uid,
        usuarioNome: userName,
        responsavel: userName
      };

      await addTransaction(newTransaction);
      await logAction(userName, `Registrou ${tipo}: ${descricao}`, 'Financeiro', '/movimentacoes');
      
      alert("Movimentação salva com sucesso!");
      setShowModal(false);
      setDescricao('');
      setValor('');
      setTipo('entrada');
      setData(new Date().toISOString().split('T')[0]);
    } catch (error) {
      console.error('Erro ao salvar movimentação:', error);
      alert("Erro ao salvar movimentação.");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (transaction: Transaction) => {
    if (!isAdmin) return;
    setSelectedTransaction(transaction);
    setEditForm({
      tipo: transaction.tipo,
      valor: transaction.valor.toString(),
      descricao: transaction.descricao,
      categoriaId: transaction.categoriaId,
      data: new Date(transaction.data).toISOString().split('T')[0]
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !selectedTransaction?.id) return;

    if (!editForm.valor || !editForm.tipo || !editForm.descricao || !editForm.data) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }

    setLoading(true);
    try {
      const selectedCategory = categories.find(c => c.id === editForm.categoriaId);
      const categoriaNome = selectedCategory ? selectedCategory.nome : 'Sem categoria';
      
      const [year, month, day] = editForm.data.split('-');
      const now = new Date();
      const dateObj = new Date(Number(year), Number(month) - 1, Number(day), now.getHours(), now.getMinutes(), now.getSeconds());

      const updatedTransaction: Partial<Transaction> = {
        tipo: editForm.tipo,
        valor: Number(editForm.valor),
        categoriaId: editForm.categoriaId,
        categoriaNome,
        descricao: editForm.descricao,
        data: dateObj.toISOString(),
        ultimaEdicao: new Date().toISOString(),
        editadoPor: profile?.nome || 'Admin'
      };

      await updateTransaction(selectedTransaction.id, updatedTransaction);
      await logAction(profile?.nome || 'Admin', `Editou ${editForm.tipo}: ${editForm.descricao}`, 'Financeiro', '/movimentacoes');
      
      alert("Movimentação atualizada com sucesso!");
      setShowEditModal(false);
    } catch (error) {
      console.error('Erro ao atualizar movimentação:', error);
      alert("Erro ao atualizar movimentação.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (transaction: Transaction) => {
    if (!isAdmin || !transaction.id) return;

    const confirm = window.confirm(
      `Tem certeza que deseja excluir esta movimentação?\n"${transaction.descricao}" - ${formatCurrency(transaction.valor)}\nEssa ação não pode ser desfeita.`
    );

    if (!confirm) return;

    try {
      await deleteTransaction(transaction.id);
      await addDoc(collection(db, "auditoria"), {
        tipo: "exclusao_movimentacao",
        diretorNome: profile?.nome || 'Admin',
        movimentacaoId: transaction.id,
        descricao: `Excluiu movimentação: ${transaction.descricao}`,
        data: new Date().toISOString()
      });
      alert("Movimentação excluída com sucesso!");
    } catch (error) {
      console.error('Erro ao excluir movimentação:', error);
      alert("Erro ao excluir movimentação.");
    }
  };

  const getCategoryName = (id: string) => {
    const cat = categories.find(c => c.id === id);
    return cat ? cat.nome : 'Outros';
  };

  const filteredTransactions = transactions.filter(t => 
    (t.descricao || t.procedencia || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.usuarioNome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    getCategoryName(t.categoriaId).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const openExportModal = (type: 'pdf' | 'csv') => {
    setExportType(type);
    setShowExportModal(true);
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold text-text-main">Movimentações</h2>
          <p className="text-gray-500 text-sm lg:text-base">Registre e controle todas as entradas e saídas.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button 
            onClick={() => openExportModal('pdf')}
            className="flex items-center justify-center gap-2 px-4 py-3 lg:py-2 rounded-lg border border-primary text-primary font-bold hover:bg-primary/10 transition-colors"
          >
            <FileText size={20} />
            Baixar PDF
          </button>
          <button 
            onClick={() => openExportModal('csv')}
            className="flex items-center justify-center gap-2 px-4 py-3 lg:py-2 rounded-lg border border-primary text-primary font-bold hover:bg-primary/10 transition-colors"
          >
            <Download size={20} />
            Baixar CSV
          </button>
          {isAdmin && (
            <button 
              onClick={() => setShowModal(true)}
              className="btn-primary w-full sm:w-auto justify-center py-3 lg:py-2"
            >
              <Plus size={20} />
              Nova Movimentação
            </button>
          )}
        </div>
      </header>

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
      </div>

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
              {filteredTransactions.length > 0 ? filteredTransactions.map((t) => (
                <tr key={t.id} className="hover:bg-background/30 transition-colors">
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
                  <td className="px-4 lg:px-6 py-4 font-medium text-sm lg:text-base">
                    <div className="flex flex-col gap-1">
                      <span>{t.descricao || t.procedencia || 'Sem descrição'}</span>
                      {t.origem === 'registro_anterior' && (
                        <span className="text-[10px] bg-highlight/10 text-highlight px-2 py-0.5 rounded-full w-fit font-bold uppercase">
                          Registro anterior ao sistema
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 lg:px-6 py-4 text-xs lg:text-sm text-gray-500">{getCategoryName(t.categoriaId)}</td>
                  <td className="px-4 lg:px-6 py-4 text-xs lg:text-sm text-gray-500">{t.usuarioNome}</td>
                  <td className={`px-4 lg:px-6 py-4 font-bold text-right text-sm lg:text-base ${t.tipo === 'entrada' ? 'text-primary' : 'text-danger'}`}>
                    {t.tipo === 'entrada' ? '+' : '-'} {formatCurrency(t.valor)}
                  </td>
                  <td className="px-4 lg:px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button className="p-2 rounded-lg hover:bg-highlight/20 text-primary transition-colors">
                        <FileText size={18} />
                      </button>
                      {isAdmin && (
                        <>
                          <button 
                            onClick={() => handleEdit(t)}
                            className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                            title="Editar"
                          >
                            <Edit size={18} />
                          </button>
                          <button 
                            onClick={() => handleDelete(t)}
                            className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}
                    </div>
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

      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleUpdate} className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-blue-600 text-white shrink-0">
              <h3 className="text-xl font-bold">Editar Movimentação</h3>
              <button type="button" onClick={() => setShowEditModal(false)} className="text-white/80 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Tipo</label>
                  <select 
                    value={editForm.tipo}
                    onChange={(e) => setEditForm({ ...editForm, tipo: e.target.value as 'entrada' | 'saida' })}
                    className="w-full p-3 lg:p-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500/20 outline-none"
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
                    value={editForm.valor}
                    onChange={(e) => setEditForm({ ...editForm, valor: e.target.value })}
                    placeholder="0,00" 
                    className="w-full p-3 lg:p-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500/20 outline-none" 
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Descrição</label>
                <input 
                  type="text" 
                  required
                  value={editForm.descricao}
                  onChange={(e) => setEditForm({ ...editForm, descricao: e.target.value })}
                  placeholder="Ex: Patrocínio Subway" 
                  className="w-full p-3 lg:p-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500/20 outline-none" 
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Data</label>
                  <input 
                    type="date" 
                    required
                    value={editForm.data}
                    onChange={(e) => setEditForm({ ...editForm, data: e.target.value })}
                    className="w-full p-3 lg:p-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500/20 outline-none" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Categoria</label>
                  <select 
                    value={editForm.categoriaId}
                    onChange={(e) => setEditForm({ ...editForm, categoriaId: e.target.value })}
                    className="w-full p-3 lg:p-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500/20 outline-none"
                  >
                    {categories.filter(c => c.tipo === editForm.tipo).map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.nome}</option>
                    ))}
                    {categories.filter(c => c.tipo === editForm.tipo).length === 0 && (
                      <option value="">Nenhuma categoria de {editForm.tipo} cadastrada</option>
                    )}
                  </select>
                </div>
              </div>
            </div>
            <div className="p-6 bg-gray-50 flex flex-col sm:flex-row gap-3 shrink-0">
              <button 
                type="button"
                onClick={() => setShowEditModal(false)}
                className="flex-1 py-3 lg:py-2 rounded-lg border border-gray-200 font-medium hover:bg-white order-2 sm:order-1"
              >
                Cancelar
              </button>
              <button 
                disabled={loading || !editForm.categoriaId}
                className="flex-1 py-3 lg:py-2 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 order-1 sm:order-2"
              >
                {loading ? 'Salvando...' : 'Salvar alteração'}
              </button>
            </div>
          </form>
        </div>
      )}

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
                  <label className="text-xs font-bold text-gray-500 uppercase">Data</label>
                  <input 
                    type="date" 
                    required
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    className="w-full p-3 lg:p-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary/20 outline-none" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Categoria</label>
                  <select 
                    value={categoriaId}
                    onChange={(e) => setCategoriaId(e.target.value)}
                    className="w-full p-3 lg:p-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary/20 outline-none"
                  >
                    {categories.filter(c => c.tipo === tipo).map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.nome}</option>
                    ))}
                    {categories.filter(c => c.tipo === tipo).length === 0 && (
                      <option value="">Nenhuma categoria de {tipo} cadastrada</option>
                    )}
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
                disabled={loading || !categoriaId}
                className="flex-1 py-3 lg:py-2 rounded-lg bg-primary text-white font-bold hover:bg-secondary order-1 sm:order-2"
              >
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ExportModal 
        isOpen={showExportModal} 
        onClose={() => setShowExportModal(false)} 
        transactions={transactions} 
        categories={categories} 
        type={exportType} 
      />
    </div>
  );
};

export default MovimentacoesComponent;
