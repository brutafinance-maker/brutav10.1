import React, { useState, useEffect } from 'react';
import { Handshake, Plus, Search, Calendar, DollarSign, Trash2, Edit, ExternalLink, ArrowUpCircle } from 'lucide-react';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Sponsorship, Category } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { logAction } from '../utils/audit';

const Sponsorships = () => {
  const { profile, isAdmin } = useAuth();
  const [sponsorships, setSponsorships] = useState<Sponsorship[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedSponsorship, setSelectedSponsorship] = useState<Sponsorship | null>(null);
  const [loading, setLoading] = useState(true);

  const [newSponsorship, setNewSponsorship] = useState({
    empresa: '',
    valor: 0,
    dataInicio: '',
    dataFim: '',
    status: 'ativo' as 'ativo' | 'encerrado',
    descricao: ''
  });

  const [newPayment, setNewPayment] = useState({
    valor: 0,
    categoriaId: '',
    descricao: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'patrocinios'), orderBy('dataInicio', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Sponsorship[];
      setSponsorships(data);
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

  const handleAddSponsorship = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    try {
      await addDoc(collection(db, 'patrocinios'), {
        ...newSponsorship,
        dataCriacao: new Date().toISOString()
      });
      
      logAction(profile?.nome || 'Usuário', 'Adicionou patrocínio: ' + newSponsorship.empresa, 'Patrocínios');
      
      setIsModalOpen(false);
      setNewSponsorship({
        empresa: '',
        valor: 0,
        dataInicio: '',
        dataFim: '',
        status: 'ativo',
        descricao: ''
      });
    } catch (error) {
      console.error('Erro ao adicionar patrocínio:', error);
    }
  };

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !selectedSponsorship) return;

    try {
      await addDoc(collection(db, 'movimentacoes'), {
        descricao: newPayment.descricao || `Pagamento Patrocínio: ${selectedSponsorship.empresa}`,
        valor: newPayment.valor,
        tipo: 'entrada',
        categoriaId: newPayment.categoriaId,
        patrocinioId: selectedSponsorship.id,
        data: new Date().toISOString(),
        usuarioId: profile?.uid,
        usuarioNome: profile?.nome || 'Usuário'
      });

      logAction(profile?.nome || 'Usuário', `Registrou pagamento de patrocínio: ${selectedSponsorship.empresa}`, 'Patrocínios');
      
      setIsPaymentModalOpen(false);
      setNewPayment({
        valor: 0,
        categoriaId: '',
        descricao: ''
      });
    } catch (error) {
      console.error('Erro ao registrar pagamento de patrocínio:', error);
    }
  };

  const handleDeleteSponsorship = async (id: string, empresa: string) => {
    if (!isAdmin || !window.confirm(`Deseja realmente excluir o patrocínio da "${empresa}"?`)) return;

    try {
      await deleteDoc(doc(db, 'patrocinios', id));
      logAction(profile?.nome || 'Usuário', 'Excluiu patrocínio: ' + empresa, 'Patrocínios');
    } catch (error) {
      console.error('Erro ao excluir patrocínio:', error);
    }
  };

  const filteredSponsorships = sponsorships.filter(s =>
    s.empresa.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 lg:space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold text-text-main">Patrocínios</h2>
          <p className="text-gray-500 text-sm lg:text-base">Gestão de parceiros e contratos da atlética.</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-primary text-white px-4 py-2 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
          >
            <Plus size={20} />
            Novo Patrocínio
          </button>
        )}
      </header>

      <div className="glass-card p-4 flex items-center gap-3">
        <Search className="text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Buscar patrocinadores..."
          className="bg-transparent border-none outline-none w-full text-sm lg:text-base"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-gray-400">Carregando...</div>
        ) : filteredSponsorships.length > 0 ? (
          filteredSponsorships.map((s) => (
            <div key={s.id} className="glass-card p-6 flex flex-col sm:flex-row gap-6 group">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Handshake size={32} />
              </div>
              <div className="flex-grow space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-text-main">{s.empresa}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2">{s.descricao}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                    s.status === 'ativo' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {s.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Valor do Contrato</p>
                    <p className="text-base font-bold text-primary">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(s.valor)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Vigência</p>
                    <p className="text-xs text-gray-600">
                      {new Date(s.dataInicio).toLocaleDateString('pt-BR')} - {new Date(s.dataFim).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>

                {isAdmin && (
                  <div className="pt-4 border-t border-highlight/10 flex justify-end gap-2">
                    <button 
                      onClick={() => {
                        setSelectedSponsorship(s);
                        setNewPayment({ ...newPayment, valor: s.valor });
                        setIsPaymentModalOpen(true);
                      }}
                      className="p-2 text-gray-400 hover:text-primary transition-colors"
                      title="Registrar Recebimento"
                    >
                      <ArrowUpCircle size={18} />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-primary transition-colors">
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteSponsorship(s.id!, s.empresa)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-12 text-center text-gray-400">Nenhum patrocínio encontrado.</div>
        )}
      </div>

      {/* Modal Novo Patrocínio */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg p-6 lg:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">Novo Patrocínio</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-text-main">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>

            <form onSubmit={handleAddSponsorship} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase">Empresa Parceira</label>
                <input
                  required
                  type="text"
                  className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                  placeholder="Ex: Banco X, Energético Y..."
                  value={newSponsorship.empresa}
                  onChange={(e) => setNewSponsorship({ ...newSponsorship, empresa: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase">Valor (R$)</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                  value={newSponsorship.valor}
                  onChange={(e) => setNewSponsorship({ ...newSponsorship, valor: Number(e.target.value) })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Data Início</label>
                  <input
                    required
                    type="date"
                    className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                    value={newSponsorship.dataInicio}
                    onChange={(e) => setNewSponsorship({ ...newSponsorship, dataInicio: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Data Fim</label>
                  <input
                    required
                    type="date"
                    className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                    value={newSponsorship.dataFim}
                    onChange={(e) => setNewSponsorship({ ...newSponsorship, dataFim: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase">Descrição/Contrapartida</label>
                <textarea
                  className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all min-h-[80px]"
                  placeholder="O que a empresa ganha em troca? (Ex: Logo no uniforme)"
                  value={newSponsorship.descricao}
                  onChange={(e) => setNewSponsorship({ ...newSponsorship, descricao: e.target.value })}
                />
              </div>

              <button
                type="submit"
                className="w-full bg-primary text-white py-4 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
              >
                Salvar Patrocínio
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Registrar Recebimento */}
      {isPaymentModalOpen && selectedSponsorship && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg p-6 lg:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">Registrar Recebimento</h3>
                <p className="text-xs text-gray-500">Patrocinador: {selectedSponsorship.empresa}</p>
              </div>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-gray-400 hover:text-text-main">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>

            <form onSubmit={handleRegisterPayment} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase">Descrição</label>
                <input
                  type="text"
                  className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                  placeholder={`Ex: Parcela 1 - ${selectedSponsorship.empresa}`}
                  value={newPayment.descricao}
                  onChange={(e) => setNewPayment({ ...newPayment, descricao: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Valor Recebido (R$)</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                    value={newPayment.valor}
                    onChange={(e) => setNewPayment({ ...newPayment, valor: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Categoria de Entrada</label>
                  <select
                    required
                    className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                    value={newPayment.categoriaId}
                    onChange={(e) => setNewPayment({ ...newPayment, categoriaId: e.target.value })}
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

              <button
                type="submit"
                className="w-full bg-primary text-white py-4 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
              >
                Confirmar Recebimento
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sponsorships;
