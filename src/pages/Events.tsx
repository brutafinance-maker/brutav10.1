import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Search, MapPin, Users, DollarSign, Trash2, Edit, ExternalLink, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Event, Category } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { logAction } from '../utils/audit';

const Events = () => {
  const { profile, isAdmin } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  const [newEvent, setNewEvent] = useState({
    nome: '',
    data: '',
    local: '',
    descricao: '',
    orcamento: 0,
    publicoEstimado: 0,
    status: 'planejado' as const
  });

  const [newEventTransaction, setNewEventTransaction] = useState({
    descricao: '',
    valor: 0,
    tipo: 'entrada' as 'entrada' | 'saida',
    categoriaId: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'eventos'), orderBy('data', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Event[];
      setEvents(eventsData);
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

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    try {
      await addDoc(collection(db, 'eventos'), {
        ...newEvent,
        dataCriacao: new Date().toISOString()
      });
      
      logAction(profile?.nome || 'Usuário', 'Criou evento: ' + newEvent.nome, 'Eventos');
      
      setIsModalOpen(false);
      setNewEvent({
        nome: '',
        data: '',
        local: '',
        descricao: '',
        orcamento: 0,
        publicoEstimado: 0,
        status: 'planejado'
      });
    } catch (error) {
      console.error('Erro ao adicionar evento:', error);
    }
  };

  const handleAddEventTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !selectedEvent) return;

    try {
      await addDoc(collection(db, 'movimentacoes'), {
        ...newEventTransaction,
        eventoId: selectedEvent.id,
        data: new Date().toISOString(),
        usuarioId: profile?.uid,
        usuarioNome: profile?.nome || 'Usuário'
      });

      logAction(profile?.nome || 'Usuário', `Adicionou movimentação ao evento: ${selectedEvent.nome}`, 'Eventos');
      
      setIsTransactionModalOpen(false);
      setNewEventTransaction({
        descricao: '',
        valor: 0,
        tipo: 'entrada',
        categoriaId: ''
      });
    } catch (error) {
      console.error('Erro ao adicionar movimentação ao evento:', error);
    }
  };

  const handleDeleteEvent = async (id: string, nome: string) => {
    if (!isAdmin || !window.confirm(`Deseja realmente excluir o evento "${nome}"?`)) return;

    try {
      await deleteDoc(doc(db, 'eventos', id));
      logAction(profile?.nome || 'Usuário', 'Excluiu evento: ' + nome, 'Eventos');
    } catch (error) {
      console.error('Erro ao excluir evento:', error);
    }
  };

  const filteredEvents = events.filter(event =>
    event.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.local.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 lg:space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold text-text-main">Eventos</h2>
          <p className="text-gray-500 text-sm lg:text-base">Gestão de festas, jogos e eventos da atlética.</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-primary text-white px-4 py-2 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
          >
            <Plus size={20} />
            Novo Evento
          </button>
        )}
      </header>

      <div className="glass-card p-4 flex items-center gap-3">
        <Search className="text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Buscar eventos por nome ou local..."
          className="bg-transparent border-none outline-none w-full text-sm lg:text-base"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-gray-400">Carregando eventos...</div>
        ) : filteredEvents.length > 0 ? (
          filteredEvents.map((event) => (
            <div key={event.id} className="glass-card overflow-hidden group">
              <div className="h-32 bg-gradient-to-br from-primary/20 to-highlight/20 flex items-center justify-center relative">
                <Calendar size={48} className="text-primary/40" />
                <div className="absolute top-4 right-4">
                  <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                    event.status === 'realizado' ? 'bg-green-100 text-green-600' :
                    event.status === 'cancelado' ? 'bg-red-100 text-red-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    {event.status}
                  </span>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-text-main group-hover:text-primary transition-colors">
                    {event.nome}
                  </h3>
                  <p className="text-sm text-gray-500 line-clamp-2 mt-1">{event.descricao}</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar size={16} className="text-primary" />
                    {new Date(event.data).toLocaleDateString('pt-BR')}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin size={16} className="text-primary" />
                    {event.local}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Users size={16} className="text-primary" />
                    {event.publicoEstimado} pessoas estimadas
                  </div>
                  <div className="flex items-center gap-2 text-sm font-bold text-text-main">
                    <DollarSign size={16} className="text-primary" />
                    Orçamento: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(event.orcamento)}
                  </div>
                </div>

                {isAdmin && (
                  <div className="pt-4 border-t border-highlight/10 flex justify-end gap-2">
                    <button 
                      onClick={() => {
                        setSelectedEvent(event);
                        setIsTransactionModalOpen(true);
                      }}
                      className="p-2 text-gray-400 hover:text-primary transition-colors"
                      title="Adicionar Movimentação"
                    >
                      <DollarSign size={18} />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-primary transition-colors">
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteEvent(event.id!, event.nome)}
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
          <div className="col-span-full py-12 text-center text-gray-400">
            Nenhum evento encontrado.
          </div>
        )}
      </div>

      {/* Modal Novo Evento */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg p-6 lg:p-8 space-y-6 max-h-[90vh] overflow-y-auto scrollbar-hide">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">Novo Evento</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-text-main">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>

            <form onSubmit={handleAddEvent} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase">Nome do Evento</label>
                <input
                  required
                  type="text"
                  className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                  placeholder="Ex: Cervejada da Brutamed"
                  value={newEvent.nome}
                  onChange={(e) => setNewEvent({ ...newEvent, nome: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Data</label>
                  <input
                    required
                    type="date"
                    className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                    value={newEvent.data}
                    onChange={(e) => setNewEvent({ ...newEvent, data: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Local</label>
                  <input
                    required
                    type="text"
                    className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                    placeholder="Ex: Chácara X"
                    value={newEvent.local}
                    onChange={(e) => setNewEvent({ ...newEvent, local: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase">Descrição</label>
                <textarea
                  className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all min-h-[100px]"
                  placeholder="Detalhes do evento..."
                  value={newEvent.descricao}
                  onChange={(e) => setNewEvent({ ...newEvent, descricao: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Orçamento (R$)</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                    value={newEvent.orcamento}
                    onChange={(e) => setNewEvent({ ...newEvent, orcamento: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Público Estimado</label>
                  <input
                    required
                    type="number"
                    className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                    value={newEvent.publicoEstimado}
                    onChange={(e) => setNewEvent({ ...newEvent, publicoEstimado: Number(e.target.value) })}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-primary text-white py-4 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
              >
                Salvar Evento
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nova Movimentação de Evento */}
      {isTransactionModalOpen && selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg p-6 lg:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">Nova Movimentação</h3>
                <p className="text-xs text-gray-500">Evento: {selectedEvent.nome}</p>
              </div>
              <button onClick={() => setIsTransactionModalOpen(false)} className="text-gray-400 hover:text-text-main">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>

            <form onSubmit={handleAddEventTransaction} className="space-y-4">
              <div className="flex gap-2 p-1 bg-background/50 rounded-xl border border-highlight/20">
                <button
                  type="button"
                  onClick={() => setNewEventTransaction({ ...newEventTransaction, tipo: 'entrada' })}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-bold transition-all ${
                    newEventTransaction.tipo === 'entrada' ? 'bg-primary text-white shadow-md' : 'text-gray-400 hover:text-text-main'
                  }`}
                >
                  <ArrowUpCircle size={18} />
                  Entrada
                </button>
                <button
                  type="button"
                  onClick={() => setNewEventTransaction({ ...newEventTransaction, tipo: 'saida' })}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-bold transition-all ${
                    newEventTransaction.tipo === 'saida' ? 'bg-danger text-white shadow-md' : 'text-gray-400 hover:text-text-main'
                  }`}
                >
                  <ArrowDownCircle size={18} />
                  Saída
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase">Descrição</label>
                <input
                  required
                  type="text"
                  className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                  placeholder="Ex: Venda de ingressos lote 1"
                  value={newEventTransaction.descricao}
                  onChange={(e) => setNewEventTransaction({ ...newEventTransaction, descricao: e.target.value })}
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
                    value={newEventTransaction.valor}
                    onChange={(e) => setNewEventTransaction({ ...newEventTransaction, valor: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Categoria</label>
                  <select
                    required
                    className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                    value={newEventTransaction.categoriaId}
                    onChange={(e) => setNewEventTransaction({ ...newEventTransaction, categoriaId: e.target.value })}
                  >
                    <option value="">Selecionar...</option>
                    {categories
                      .filter(c => c.tipo === newEventTransaction.tipo)
                      .map(c => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))
                    }
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className={`w-full py-4 rounded-xl font-bold text-white transition-all shadow-lg ${
                  newEventTransaction.tipo === 'entrada' ? 'bg-primary shadow-primary/20' : 'bg-danger shadow-danger/20'
                }`}
              >
                Registrar Movimentação
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Events;
