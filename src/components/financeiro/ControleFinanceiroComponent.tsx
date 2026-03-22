import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search, 
  Filter, 
  Calendar as CalendarIcon,
  User,
  Ticket,
  DollarSign,
  AlertCircle,
  ShoppingBag
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, where, doc, updateDoc, addDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { PendingSale, Transaction, Event } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { logAction } from '../../utils/audit';
import { motion, AnimatePresence } from 'motion/react';

const ControleFinanceiroComponent = () => {
  const { profile, isAdmin } = useAuth();
  const [pendingSales, setPendingSales] = useState<PendingSale[]>([]);
  const [events, setEvents] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Subscribe to pending sales only (status = "pendente")
    const q = query(
      collection(db, 'vendasPendentes'),
      where('status', '==', 'pendente'),
      orderBy('dataRegistro', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sales = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as PendingSale));
      setPendingSales(sales);
      setLoading(false);
    });

    // Subscribe to events to get names
    const unsubscribeEvents = onSnapshot(collection(db, 'eventos'), (snapshot) => {
      const eventMap: Record<string, string> = {};
      snapshot.docs.forEach(doc => {
        eventMap[doc.id] = doc.data().nome;
      });
      setEvents(eventMap);
    });

    return () => {
      unsubscribe();
      unsubscribeEvents();
    };
  }, []);

  const handleApprove = async (sale: PendingSale) => {
    if (!profile?.diretorFinanceiro) {
      alert("Apenas diretores financeiros podem aprovar movimentações");
      return;
    }

    try {
      // 1. Criar a movimentação financeira real na coleção 'movimentacoes'
      const descricao = sale.tipoVenda === 'produto' 
        ? `Venda produto - ${sale.nomeProduto}` 
        : `Venda ingresso - ${sale.nomeEvento}`;

      await addDoc(collection(db, "movimentacoes"), {
        tipo: "entrada",
        valor: sale.valorTotal,
        descricao: descricao,
        categoria: sale.tipoVenda === 'produto' ? "Produtos" : "Eventos",
        responsavel: sale.nomeVendedor || sale.registradoPorNome,
        data: new Date().toISOString(),
        origem: sale.tipoVenda === 'produto' ? "loja" : "evento",
        aprovadoPor: profile.nome,
        eventoId: sale.eventoId || null,
        produtoId: sale.produtoId || null
      });

      // 2. Atualizar estoque ou lotes (essencial para integridade do sistema)
      if (sale.tipoVenda === 'produto' && sale.produtoId && sale.quantidade) {
        const productRef = doc(db, 'produtos', sale.produtoId);
        const productSnap = await getDoc(productRef);
        if (productSnap.exists()) {
          const currentStock = productSnap.data().estoque || 0;
          await updateDoc(productRef, {
            estoque: currentStock - sale.quantidade,
            vendido: (productSnap.data().vendido || 0) + sale.quantidade
          });
        }
      } else if (sale.tipoVenda === 'ingresso' && sale.eventoId && sale.loteId) {
        const eventRef = doc(db, 'eventos', sale.eventoId);
        const eventSnap = await getDoc(eventRef);
        if (eventSnap.exists()) {
          const eventData = eventSnap.data() as Event;
          const updatedLotes = (eventData.lotes || []).map(l => {
            if (l.id === sale.loteId) {
              return { ...l, quantidadeVendida: (l.quantidadeVendida || 0) + (sale.quantidadeIngressos || 1) };
            }
            return l;
          });
          await updateDoc(eventRef, { lotes: updatedLotes });
        }
      }

      // 3. Remover da coleção de pendentes
      await deleteDoc(doc(db, "vendasPendentes", sale.id!));

      alert("Venda aprovada com sucesso!");
      logAction(profile.nome, `Aprovou venda de ${sale.tipoVenda === 'produto' ? sale.nomeProduto : sale.nomeEvento}`, 'Financeiro');
    } catch (error) {
      console.error('Erro ao aprovar venda:', error);
      alert("Erro ao aprovar venda");
    }
  };

  const handleReject = async (id: string) => {
    if (!profile?.diretorFinanceiro) {
      alert("Apenas diretores financeiros podem recusar movimentações");
      return;
    }

    if (!window.confirm("Tem certeza que deseja recusar esta venda?")) return;

    try {
      await deleteDoc(doc(db, "vendasPendentes", id));
      alert("Venda recusada e removida.");
      logAction(profile.nome, `Recusou venda pendente`, 'Financeiro');
    } catch (error) {
      console.error('Erro ao recusar venda:', error);
      alert("Erro ao recusar venda");
    }
  };

  const filteredSales = pendingSales.filter(sale => {
    const matchesSearch = 
      (sale.participanteNome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sale.registradoPorNome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sale.nomeEvento || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sale.nomeProduto || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  // Grouping logic
  const groupedSales = filteredSales.reduce((acc: any, sale) => {
    const eventName = sale.nomeEvento || events[sale.eventoId] || 'Evento Desconhecido';
    const sellerName = sale.registradoPorNome || sale.nomeVendedor || 'Vendedor Desconhecido';

    if (!acc[eventName]) acc[eventName] = {};
    if (!acc[eventName][sellerName]) acc[eventName][sellerName] = [];
    
    acc[eventName][sellerName].push(sale);
    return acc;
  }, {});

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <AlertCircle size={48} className="text-danger" />
        <h2 className="text-xl font-bold">Acesso Negado</h2>
        <p className="text-gray-500 text-center max-w-md">
          Apenas diretores financeiros podem acessar esta área de validação.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold text-text-main">Controle Financeiro</h2>
          <p className="text-gray-500 text-sm lg:text-base">Validação de vendas e integração com o caixa.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4">
        <div className="glass-card p-4 flex items-center gap-3">
          <Search className="text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Buscar por participante, vendedor ou evento..."
            className="bg-transparent border-none outline-none w-full text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-8">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Carregando vendas...</div>
        ) : Object.keys(groupedSales).length > 0 ? (
          Object.entries(groupedSales).map(([eventName, sellers]: [string, any]) => (
            <div key={eventName} className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-highlight/10"></div>
                <h3 className="text-sm font-bold text-primary uppercase tracking-wider px-2">{eventName}</h3>
                <div className="h-px flex-1 bg-highlight/10"></div>
              </div>

              {Object.entries(sellers).map(([sellerName, sales]: [string, any]) => (
                <div key={sellerName} className="space-y-3">
                  <div className="flex items-center gap-2 px-4">
                    <User size={14} className="text-gray-400" />
                    <h4 className="text-xs font-bold text-gray-500 uppercase">Registrado por: {sellerName}</h4>
                    <span className="text-[10px] bg-highlight/5 px-2 py-0.5 rounded-full text-gray-400">
                      {sales.length} {sales.length === 1 ? 'venda' : 'vendas'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <AnimatePresence mode="popLayout">
                      {sales.map((sale: PendingSale) => (
                        <motion.div
                          key={sale.id}
                          layout
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="glass-card p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-l-4 border-l-primary/20"
                        >
                          <div className="flex items-start gap-4">
                            <div className="p-2 rounded-xl bg-yellow-100 text-yellow-600">
                              <Clock size={18} />
                            </div>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-sm">
                                  {sale.tipoVenda === 'produto' ? (sale.nomeProduto || sale.descricao) : (sale.participanteNome || 'Participante')}
                                </h3>
                                {sale.nomeLote && (
                                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                                    Lote: {sale.nomeLote || sale.lote}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-500">
                                <span className="flex items-center gap-1">
                                  {sale.tipoVenda === 'produto' ? (
                                    <>
                                      <ShoppingBag size={12} className="text-primary/60" />
                                      {sale.quantidade}x unidades
                                    </>
                                  ) : (
                                    <>
                                      <Ticket size={12} className="text-primary/60" />
                                      {sale.quantidadeIngressos}x ingressos
                                    </>
                                  )}
                                </span>
                                <span className="flex items-center gap-1">
                                  <CalendarIcon size={12} className="text-primary/60" />
                                  {new Date(sale.dataRegistro).toLocaleString('pt-BR')}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between lg:justify-end gap-4 border-t lg:border-t-0 pt-3 lg:pt-0">
                            <div className="text-right">
                              <p className="text-[10px] text-gray-400 uppercase font-bold">Valor</p>
                              <p className="text-base font-bold text-primary">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sale.valorTotal)}
                              </p>
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={() => handleReject(sale.id!)}
                                className="flex items-center gap-2 px-3 py-2 text-danger hover:bg-danger/10 rounded-lg transition-all font-bold text-xs border border-danger/20"
                              >
                                <XCircle size={16} />
                                Recusar
                              </button>
                              <button
                                onClick={() => handleApprove(sale)}
                                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all shadow-md shadow-primary/10 font-bold text-xs"
                              >
                                <CheckCircle size={16} />
                                Aceitar
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              ))}
            </div>
          ))
        ) : (
          <div className="glass-card p-12 text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-4 bg-gray-100 rounded-full text-gray-400">
                <Filter size={48} />
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-400">Nenhuma venda encontrada</h3>
            <p className="text-gray-500">Tente ajustar os filtros ou buscar por outros termos.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ControleFinanceiroComponent;
