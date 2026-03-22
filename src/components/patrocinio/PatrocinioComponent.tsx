import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Handshake, Plus, Search, Trash2, Edit, ArrowUpCircle } from 'lucide-react';
import { Sponsorship, Category } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { logAction } from '../../utils/audit';
import { subscribeToSponsorships, subscribeToCategories } from '../../services/dataService';
import { addSponsorship, deleteSponsorship } from '../../services/patrociniosService';
import { addTransaction } from '../../services/movimentacoesService';

const PatrocinioComponent = () => {
  const { profile, isAdmin } = useAuth();
  const location = useLocation();
  const [sponsorships, setSponsorships] = useState<Sponsorship[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedSponsorship, setSelectedSponsorship] = useState<Sponsorship | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (location.state?.openModal) {
      setIsModalOpen(true);
      // Clear state to prevent reopening on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const [newSponsorship, setNewSponsorship] = useState({
    nomePatrocinador: '',
    valor: 0,
    tipoPatrocinio: 'dinheiro',
    descricao: '',
    data: new Date().toISOString().split('T')[0]
  });

  const [newPayment, setNewPayment] = useState({
    valor: 0,
    categoriaId: '',
    descricao: ''
  });

  useEffect(() => {
    const unsubscribeSponsorships = subscribeToSponsorships((data) => {
      setSponsorships(data);
      setLoading(false);
    });

    const unsubscribeCategories = subscribeToCategories((data) => {
      setCategories(data);
    });

    return () => {
      unsubscribeSponsorships();
      unsubscribeCategories();
    };
  }, []);

  const handleAddSponsorship = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    try {
      const sponsorshipData = {
        ...newSponsorship,
        criadoPorId: profile?.uid || 'diretoria',
        criadoPorNome: profile?.nome || 'Diretoria'
      };
      
      const docRef = await addSponsorship(sponsorshipData);
      
      // Criar movimentação automática
      await addTransaction({
        descricao: `Patrocínio recebido de ${newSponsorship.nomePatrocinador}`,
        valor: Number(newSponsorship.valor),
        tipo: 'entrada',
        categoriaId: 'patrocinio', // We will use a generic ID or name for category
        categoriaNome: 'Patrocínio',
        patrocinioId: docRef.id,
        data: newSponsorship.data,
        usuarioId: profile?.uid || 'diretoria',
        usuarioNome: profile?.nome || 'Diretoria',
        origem: 'patrocinio'
      });

      logAction(profile?.nome || 'Usuário', 'Adicionou patrocínio: ' + newSponsorship.nomePatrocinador, 'Patrocínios');
      setIsModalOpen(false);
      setNewSponsorship({
        nomePatrocinador: '',
        valor: 0,
        tipoPatrocinio: 'dinheiro',
        descricao: '',
        data: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      console.error('Erro ao adicionar patrocínio:', error);
    }
  };

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !selectedSponsorship) return;

    try {
      await addTransaction({
        descricao: newPayment.descricao || `Pagamento Patrocínio: ${selectedSponsorship.nomePatrocinador}`,
        valor: newPayment.valor,
        tipo: 'entrada',
        categoriaId: newPayment.categoriaId,
        patrocinioId: selectedSponsorship.id,
        data: new Date().toISOString(),
        usuarioId: profile?.uid || '',
        usuarioNome: profile?.nome || 'Usuário'
      });

      logAction(profile?.nome || 'Usuário', `Registrou pagamento de patrocínio: ${selectedSponsorship.nomePatrocinador}`, 'Patrocínios');
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

  const handleDeleteSponsorship = async (id: string, nomePatrocinador: string) => {
    if (!isAdmin || !window.confirm(`Deseja realmente excluir o patrocínio de "${nomePatrocinador}"?`)) return;

    try {
      await deleteSponsorship(id);
      logAction(profile?.nome || 'Usuário', 'Excluiu patrocínio: ' + nomePatrocinador, 'Patrocínios');
    } catch (error) {
      console.error('Erro ao excluir patrocínio:', error);
    }
  };

  const filteredSponsorships = sponsorships.filter(s =>
    s.nomePatrocinador?.toLowerCase().includes(searchTerm.toLowerCase())
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
                    <h3 className="text-lg font-bold text-text-main">{s.nomePatrocinador}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2">{s.descricao}</p>
                  </div>
                  <span className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase bg-green-100 text-green-600">
                    {s.tipoPatrocinio}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Valor do Patrocínio</p>
                    <p className="text-base font-bold text-primary">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(s.valor)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Data</p>
                    <p className="text-xs text-gray-600">
                      {new Date(s.data).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>

                {isAdmin && (
                  <div className="pt-4 border-t border-highlight/10 flex justify-end gap-2">
                    <button
                      onClick={() => handleDeleteSponsorship(s.id!, s.nomePatrocinador)}
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
                <label className="text-xs font-bold text-gray-400 uppercase">Nome do Patrocinador</label>
                <input
                  required
                  type="text"
                  className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                  placeholder="Ex: Banco X, Energético Y..."
                  value={newSponsorship.nomePatrocinador}
                  onChange={(e) => setNewSponsorship({ ...newSponsorship, nomePatrocinador: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Tipo de Patrocínio</label>
                  <select
                    required
                    className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                    value={newSponsorship.tipoPatrocinio}
                    onChange={(e) => setNewSponsorship({ ...newSponsorship, tipoPatrocinio: e.target.value })}
                  >
                    <option value="dinheiro">Dinheiro</option>
                    <option value="material">Material</option>
                    <option value="serviço">Serviço</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase">Data</label>
                <input
                  required
                  type="date"
                  className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                  value={newSponsorship.data}
                  onChange={(e) => setNewSponsorship({ ...newSponsorship, data: e.target.value })}
                />
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

      {isPaymentModalOpen && selectedSponsorship && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg p-6 lg:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">Registrar Recebimento</h3>
                <p className="text-xs text-gray-500">Patrocinador: {selectedSponsorship.nomePatrocinador}</p>
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
                  placeholder={`Ex: Parcela 1 - ${selectedSponsorship.nomePatrocinador}`}
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

export default PatrocinioComponent;
