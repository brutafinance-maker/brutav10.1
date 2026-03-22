import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Calendar, 
  Plus, 
  Search, 
  MapPin, 
  Users, 
  DollarSign, 
  Trash2, 
  Edit, 
  Ticket, 
  ChevronRight, 
  ArrowLeft,
  Download,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  FileText,
  Filter,
  UserCheck
} from 'lucide-react';
import { Event, EventBatch, PendingSale } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { logAction } from '../../utils/audit';
import { subscribeToEvents } from '../../services/dataService';
import { addEvent, deleteEvent, updateEvent, registerPendingSale, addEventCost, addEventSponsorship, updateSale, cancelSale, addEventRefund, deleteEventRefund, deleteEventCost, deleteEventSponsorship } from '../../services/eventosService';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, query, orderBy, where, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const EventosComponent = () => {
  const { profile, isAdmin, isOtherDirectorate } = useAuth();
  const location = useLocation();
  const [events, setEvents] = useState<Event[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [openVendaModal, setOpenVendaModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [pendingEventSales, setPendingEventSales] = useState<PendingSale[]>([]);
  const [confirmedEventSales, setConfirmedEventSales] = useState<PendingSale[]>([]);
  const [participantSearch, setParticipantSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'details'>('list');
  const [loading, setLoading] = useState(true);
  const [isCostModalOpen, setIsCostModalOpen] = useState(false);
  const [isSponsorModalOpen, setIsSponsorModalOpen] = useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [newCost, setNewCost] = useState({ descricao: '', valor: 0 });
  const [newSponsor, setNewSponsor] = useState({ nome: '', valor: 0 });
  const [newRefund, setNewRefund] = useState({ nomeComprador: '', valor: 0, motivo: '' });
  const [isSaleEditModalOpen, setIsSaleEditModalOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<any>(null);
  const [editingSaleData, setEditingSaleData] = useState({
    participanteNome: '',
    participanteTelefone: '',
    loteId: '',
    loteNome: '',
    quantidadeIngressos: 1,
    valorTotal: 0
  });

  useEffect(() => {
    if (selectedEvent && viewMode === 'details') {
      // Buscar participantes do evento
      const qPart = query(collection(db, 'eventos', selectedEvent.id!, 'participantes'), orderBy('dataRegistro', 'desc'));
      const unsubscribePart = onSnapshot(qPart, (snapshot) => {
        const parts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setParticipants(parts);
      });

      // Buscar vendas pendentes do evento (para indicadores)
      const qPending = query(collection(db, 'vendasPendentes'), where('eventoId', '==', selectedEvent.id!));
      const unsubscribePending = onSnapshot(qPending, (snapshot) => {
        const sales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PendingSale));
        setPendingEventSales(sales);
      });

      // Buscar vendas confirmadas do evento (movimentacoes)
      const qConfirmed = query(collection(db, 'movimentacoes'), where('eventoId', '==', selectedEvent.id!));
      const unsubscribeConfirmed = onSnapshot(qConfirmed, (snapshot) => {
        const sales = snapshot.docs.map(doc => {
          const data = doc.data();
          return { 
            id: doc.id, 
            ...data, 
            valorTotal: data.valor,
            status: 'confirmado',
            loteNome: data.descricao?.split(' - ')[1] || 'Ingresso'
          } as any;
        });
        setConfirmedEventSales(sales);
      });

      return () => {
        unsubscribePart();
        unsubscribePending();
        unsubscribeConfirmed();
      };
    }
  }, [selectedEvent?.id, viewMode]);

  const eventSales = useMemo(() => {
    // pendingEventSales contém todas as vendas da coleção vendasPendentes (pendentes, confirmadas e rejeitadas)
    // confirmedEventSales contém todas as entradas da coleção movimentacoes vinculadas ao evento
    // Filtramos as movimentações que já são provenientes de vendas de ingressos para evitar duplicidade nas estatísticas
    const manualTransactions = confirmedEventSales.filter(s => !s.descricao?.startsWith('Venda de ingressos'));
    return [...pendingEventSales, ...manualTransactions];
  }, [pendingEventSales, confirmedEventSales]);

  const financialStats = useMemo(() => {
    const confirmed = eventSales.filter(s => s.status === 'confirmado').reduce((acc, s) => acc + s.valorTotal, 0);
    const pending = eventSales.filter(s => s.status === 'pendente').reduce((acc, s) => acc + s.valorTotal, 0);
    const totalSold = eventSales.filter(s => s.status !== 'rejeitado').reduce((acc, s) => acc + (s.quantidadeIngressos || s.quantidade || 1), 0);
    
    const totalCustos = selectedEvent?.custos?.reduce((acc, c) => acc + c.valor, 0) || 0;
    const totalPatrocinios = selectedEvent?.patrocinios?.reduce((acc, p) => acc + p.valor, 0) || 0;
    const totalReembolsos = selectedEvent?.reembolsos?.reduce((acc, r) => acc + r.valor, 0) || 0;
    const lucro = confirmed + totalPatrocinios - totalCustos - totalReembolsos;

    // Stats for panel
    const sellers = new Set(eventSales.map(s => s.registradoPorId || s.usuarioId)).size;
    
    const batchStats = eventSales
      .filter(s => s.status !== 'rejeitado' && s.status !== 'cancelado')
      .reduce((acc: any, s) => {
        const lote = s.lote || s.nomeLote || s.loteNome;
        if (lote && lote !== 'Ingresso') {
          acc[lote] = (acc[lote] || 0) + (s.quantidadeIngressos || s.quantidade || 1);
        }
        return acc;
      }, {});
    
    const entries = Object.entries(batchStats);
    const mostSoldBatch = entries.length > 0 
      ? entries.sort((a: any, b: any) => b[1] - a[1])[0][0] 
      : "Nenhuma venda ainda";

    return { 
      confirmed, 
      pending, 
      total: confirmed + pending, 
      totalSold,
      sellers,
      mostSoldBatch,
      totalCustos,
      totalPatrocinios,
      totalReembolsos,
      lucro
    };
  }, [eventSales, selectedEvent?.custos, selectedEvent?.patrocinios, selectedEvent?.reembolsos]);

  const [newEvent, setNewEvent] = useState({
    nome: '',
    data: '',
    local: '',
    descricao: '',
    orcamento: 0,
    publicoEstimado: 0,
    status: 'planejado' as const,
    lotes: [] as EventBatch[],
    loteAtualId: ''
  });

  const [newBatch, setNewBatch] = useState<Omit<EventBatch, 'id'>>({
    nome: '',
    preco: 0,
    quantidadeTotal: 0,
    quantidadeVendida: 0,
    dataVirada: '',
    ativo: true
  });

  const [newSale, setNewSale] = useState({
    participanteNome: '',
    participanteEmail: '',
    participanteTelefone: '',
    loteId: '',
    loteNome: '',
    quantidadeIngressos: 1,
    valorTotal: 0,
    formaPagamento: 'pix' as const
  });

  useEffect(() => {
    const unsubscribe = subscribeToEvents((data) => {
      setEvents(data);
      setLoading(false);
      
      // Update selected event if it's currently being viewed
      if (selectedEvent) {
        const updated = data.find(e => e.id === selectedEvent.id);
        if (updated) setSelectedEvent(updated);
      }
    });

    return () => unsubscribe();
  }, [selectedEvent?.id]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const handleDeleteEvent = async (id: string) => {
    if (!isAdmin) return;
    if (!window.confirm('Tem certeza que deseja excluir este evento?')) return;

    try {
      await deleteEvent(id);
      logAction(profile?.nome || 'Usuário', 'Excluiu um evento', 'Eventos');
      setViewMode('list');
      setSelectedEvent(null);
    } catch (error) {
      console.error('Erro ao excluir evento:', error);
    }
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    try {
      if (editingEvent) {
        await updateEvent(editingEvent.id!, newEvent);
        logAction(profile?.nome || 'Usuário', 'Editou evento: ' + newEvent.nome, 'Eventos');
      } else {
        const eventData = {
          ...newEvent,
          usuarioId: profile?.uid || '',
          criadoPor: profile?.nome || 'Usuário'
        };
        await addEvent(eventData);
        logAction(profile?.nome || 'Usuário', 'Criou evento: ' + newEvent.nome, 'Eventos');
      }
      setIsModalOpen(false);
      setEditingEvent(null);
      setNewEvent({
        nome: '',
        data: '',
        local: '',
        descricao: '',
        orcamento: 0,
        publicoEstimado: 0,
        status: 'planejado',
        lotes: [],
        loteAtualId: ''
      });
    } catch (error) {
      console.error('Erro ao salvar evento:', error);
    }
  };

  const handleAddBatch = () => {
    const id = Math.random().toString(36).substr(2, 9);
    const batchWithId = { ...newBatch, id, quantidadeVendida: 0 };
    
    setNewEvent(prev => ({
      ...prev,
      lotes: [...prev.lotes, batchWithId],
      loteAtualId: prev.loteAtualId || id
    }));
    
    setNewBatch({
      nome: '',
      preco: 0,
      quantidadeTotal: 0,
      quantidadeVendida: 0,
      dataVirada: '',
      ativo: true
    });
  };

  const registrarVenda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !newSale.loteId) return;

    const loteSelecionado = (selectedEvent.lotes || []).find(l => l.id === newSale.loteId);
    if (!loteSelecionado) return;

    const nomeComprador = newSale.participanteNome;
    const telefone = newSale.participanteTelefone;
    const quantidade = newSale.quantidadeIngressos;

    if (!nomeComprador.trim()) {
      alert("O nome do comprador não pode estar vazio.");
      return;
    }
    if (quantidade <= 0) {
      alert("A quantidade deve ser maior que 0.");
      return;
    }

    try {
      const valorTotal = loteSelecionado.preco * quantidade;

      await registerPendingSale(selectedEvent.id!, {
        tipoVenda: 'ingresso',
        eventoId: selectedEvent.id!,
        nomeEvento: selectedEvent.nome,
        nomeVendedor: profile?.nome || 'Usuário',
        usuarioId: profile?.uid || '',
        lote: loteSelecionado.nome,
        loteId: loteSelecionado.id,
        quantidadeIngressos: quantidade,
        valorUnitario: loteSelecionado.preco,
        valorTotal,
        status: "pendente",
        nomeComprador,
        participanteNome: nomeComprador,
        participanteTelefone: telefone,
        registradoPorNome: profile?.nome || 'Usuário',
        registradoPorId: profile?.uid || '',
        dataRegistro: new Date().toISOString()
      });

      alert("Venda registrada com sucesso");

      setOpenVendaModal(false);
      setNewSale({
        participanteNome: '',
        participanteEmail: '',
        participanteTelefone: '',
        loteId: '',
        loteNome: '',
        quantidadeIngressos: 1,
        valorTotal: 0,
        formaPagamento: 'pix'
      });

    } catch (error) {
      console.error("Erro ao registrar venda:", error);
      alert("Erro ao registrar venda");
    }
  };

  const handleToggleLote = async (eventoId: string, loteId: string, action: 'ativar' | 'encerrar') => {
    if (!isAdmin && !isOtherDirectorate) return;
    try {
      const evento = events.find(e => e.id === eventoId);
      if (!evento) return;

      const lotesAtualizados = (evento.lotes || []).map(l => {
        if (l.id === loteId) {
          return { ...l, ativo: action === 'ativar' };
        }
        return l;
      });

      await updateEvent(eventoId, { lotes: lotesAtualizados });
      logAction(profile?.nome || 'Usuário', `${action === 'ativar' ? 'Ativou' : 'Encerrou'} lote no evento ${evento.nome}`, 'Eventos');
    } catch (error) {
      console.error('Erro ao alterar lote:', error);
    }
  };

  const handleVirarLote = async (eventoId: string, proximoLoteId: string) => {
    if (!isAdmin && !isOtherDirectorate) return;
    if (!window.confirm('Tem certeza que deseja virar para o próximo lote? Essa ação encerrará o lote atual.')) return;
    
    try {
      const evento = events.find(e => e.id === eventoId);
      if (!evento) return;

      const lotesAtualizados = (evento.lotes || []).map(l => ({
        ...l,
        ativo: l.id === proximoLoteId
      }));

      await updateEvent(eventoId, {
        lotes: lotesAtualizados,
        loteAtualId: proximoLoteId
      });

      logAction(profile?.nome || 'Usuário', `Virou lote do evento ${evento.nome}`, 'Eventos');
    } catch (error) {
      console.error('Erro ao virar lote:', error);
    }
  };

  const filteredEvents = events.filter(event =>
    event.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.local.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getLoteAtual = (event: Event) => {
    return (event.lotes || []).find(l => l.id === event.loteAtualId);
  };

  const handleExportPDF = async () => {
    if (!selectedEvent || participants.length === 0) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Filter only active sales and sort alphabetically
    const vendasValidas = participants.filter(v => v.status !== "cancelado");
    const participantesOrdenados = [...vendasValidas].sort((a, b) => 
      (a.nomeComprador || '').localeCompare(b.nomeComprador || '')
    );

    // Prepare table data
    const dadosTabela = participantesOrdenados.map(p => [
      p.nomeComprador || '---',
      p.registradoPor || '---',
      p.lote || '---',
      p.dataRegistro ? new Date(p.dataRegistro).toLocaleDateString('pt-BR') : '---'
    ]);

    // Add Logo
    try {
      const logoUrl = 'https://raw.githubusercontent.com/brutafinance-maker/brt1/main/Brutamed.png';
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = logoUrl;
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        doc.addImage(dataUrl, 'PNG', 14, 10, 25, 25);
      }
    } catch (error) {
      console.error('Erro ao carregar logo:', error);
    }

    // Header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Associação Atlética Acadêmica de Medicina do Oeste do Pará', 45, 18);
    doc.text('Atlética BrutaMed', 45, 25);
    
    doc.setFontSize(12);
    doc.text('Relatório Financeiro do Evento', 45, 32);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Evento: ${selectedEvent.nome}`, 14, 45);
    doc.text(`Data do evento: ${new Date(selectedEvent.data).toLocaleDateString('pt-BR')}`, 14, 50);
    doc.text(`Data de geração do documento: ${new Date().toLocaleDateString('pt-BR')}`, 14, 55);
    doc.text(`Gerado por: ${profile?.nome || 'Usuário'}`, 14, 60);

    // Financial Summary in PDF
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo Financeiro:', 14, 70);
    doc.setFont('helvetica', 'normal');
    doc.text(`Receita (Vendas): ${formatCurrency(financialStats.confirmed)}`, 14, 75);
    doc.text(`Patrocínios: ${formatCurrency(financialStats.totalPatrocinios)}`, 14, 80);
    doc.text(`Custos Totais: ${formatCurrency(financialStats.totalCustos)}`, 14, 85);
    doc.text(`Reembolsos: ${formatCurrency(financialStats.totalReembolsos)}`, 14, 90);
    doc.setFont('helvetica', 'bold');
    doc.text(`Lucro Líquido: ${formatCurrency(financialStats.lucro)}`, 14, 95);

    // Table
    autoTable(doc, {
      startY: 105,
      head: [['Nome do Comprador', 'Vendedor', 'Lote', 'Data da Venda']],
      body: dadosTabela,
      theme: 'striped',
      headStyles: { fillColor: [14, 143, 99] },
      margin: { top: 10, bottom: 20 },
    });

    // Add Refunds Table if exists
    if (selectedEvent.reembolsos && selectedEvent.reembolsos.length > 0) {
      const startY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFont('helvetica', 'bold');
      doc.text('Lista de Reembolsos:', 14, startY);
      
      const dadosReembolsos = selectedEvent.reembolsos.map(r => [
        r.nomeComprador,
        r.motivo || '---',
        formatCurrency(r.valor),
        new Date(r.criadoEm).toLocaleDateString('pt-BR')
      ]);

      autoTable(doc, {
        startY: startY + 5,
        head: [['Comprador', 'Motivo', 'Valor', 'Data']],
        body: dadosReembolsos,
        theme: 'striped',
        headStyles: { fillColor: [234, 88, 12] }, // Orange color for refunds
      });
    }

    doc.save(`relatorio_financeiro_${selectedEvent.nome.toLowerCase().replace(/\s+/g, '_')}.pdf`);
  };

  const participantsByBatch = useMemo(() => {
    const filtered = participants.filter(p => 
      p.nomeComprador.toLowerCase().includes(participantSearch.toLowerCase()) ||
      (p.telefone || '').includes(participantSearch) ||
      p.registradoPor.toLowerCase().includes(participantSearch.toLowerCase())
    );

    const grouped = filtered.reduce((acc: any, p) => {
      if (!acc[p.lote]) acc[p.lote] = [];
      acc[p.lote].push(p);
      return acc;
    }, {});

    // Sort alphabetically within each batch
    Object.keys(grouped).forEach(batch => {
      grouped[batch].sort((a: any, b: any) => a.nomeComprador.localeCompare(b.nomeComprador));
    });

    return grouped;
  }, [participants, participantSearch]);

  const handleAddCost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !isAdmin) return;
    try {
      const costData = {
        ...newCost,
        criadoPor: profile?.nome || 'Usuário',
        data: new Date().toISOString()
      };
      await addEventCost(selectedEvent.id!, costData);
      logAction(profile?.nome || 'Usuário', `Adicionou custo ao evento ${selectedEvent.nome}: ${newCost.descricao}`, 'Eventos');
      setIsCostModalOpen(false);
      setNewCost({ descricao: '', valor: 0 });
    } catch (error) {
      console.error('Erro ao adicionar custo:', error);
    }
  };

  const handleAddSponsorship = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !isAdmin) return;
    try {
      const sponsorData = {
        ...newSponsor,
        criadoPor: profile?.nome || 'Usuário',
        data: new Date().toISOString()
      };
      await addEventSponsorship(selectedEvent.id!, sponsorData);
      logAction(profile?.nome || 'Usuário', `Adicionou patrocínio ao evento ${selectedEvent.nome}: ${newSponsor.nome}`, 'Eventos');
      setIsSponsorModalOpen(false);
      setNewSponsor({ nome: '', valor: 0 });
    } catch (error) {
      console.error('Erro ao adicionar patrocínio:', error);
    }
  };

  const handleEditSale = (p: any) => {
    setEditingSale(p);
    setEditingSaleData({
      participanteNome: p.nomeComprador,
      participanteTelefone: p.telefone || '',
      loteId: (selectedEvent?.lotes || []).find(l => l.nome === p.lote)?.id || '',
      loteNome: p.lote,
      quantidadeIngressos: p.quantidade,
      valorTotal: p.valorTotal
    });
    setIsSaleEditModalOpen(true);
  };

  const handleUpdateSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !editingSale) return;

    try {
      const lote = selectedEvent.lotes?.find(l => l.id === editingSaleData.loteId);
      const dataToUpdate = {
        ...editingSaleData,
        nomeLote: lote?.nome || editingSaleData.loteNome,
        valorUnitario: lote?.preco || (editingSaleData.valorTotal / editingSaleData.quantidadeIngressos)
      };

      await updateSale(selectedEvent.id!, editingSale.id, editingSale.vendaId, dataToUpdate);
      alert("Venda atualizada com sucesso");
      setIsSaleEditModalOpen(false);
      setEditingSale(null);
    } catch (error) {
      console.error("Erro ao atualizar venda:", error);
      alert("Erro ao atualizar venda");
    }
  };

  const handleCancelSale = async (p: any) => {
    if (!profile?.diretorFinanceiro && !isAdmin) return;
    if (!window.confirm('Tem certeza que deseja cancelar (reembolsar) esta venda?')) return;

    try {
      await cancelSale(selectedEvent!.id!, p.id, p.vendaId, profile?.nome || 'Usuário');
      alert("Venda cancelada com sucesso");
      logAction(profile?.nome || 'Usuário', `Cancelou venda de ${p.nomeComprador} no evento ${selectedEvent?.nome}`, 'Eventos');
    } catch (error) {
      console.error("Erro ao cancelar venda:", error);
      alert("Erro ao cancelar venda");
    }
  };

  const handleAddRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !isAdmin) return;
    try {
      const refundData = {
        id: Math.random().toString(36).substr(2, 9),
        ...newRefund,
        criadoPor: profile?.nome || 'Usuário',
        criadoEm: new Date().toISOString()
      };
      await addEventRefund(selectedEvent.id!, refundData);
      logAction(profile?.nome || 'Usuário', `Adicionou reembolso ao evento ${selectedEvent.nome}: ${newRefund.nomeComprador}`, 'Eventos');
      setIsRefundModalOpen(false);
      setNewRefund({ nomeComprador: '', valor: 0, motivo: '' });
    } catch (error) {
      console.error('Erro ao adicionar reembolso:', error);
    }
  };

  const handleDeleteRefund = async (refund: any) => {
    if (!selectedEvent || !isAdmin) return;
    if (!window.confirm('Tem certeza que deseja excluir este reembolso?')) return;
    try {
      await deleteEventRefund(selectedEvent.id!, refund);
      logAction(profile?.nome || 'Usuário', `Excluiu reembolso do evento ${selectedEvent.nome}`, 'Eventos');
    } catch (error) {
      console.error('Erro ao excluir reembolso:', error);
    }
  };

  const handleDeleteCost = async (cost: any) => {
    if (!selectedEvent || !isAdmin) return;
    if (!window.confirm('Tem certeza que deseja excluir este custo?')) return;
    try {
      await deleteEventCost(selectedEvent.id!, cost);
      logAction(profile?.nome || 'Usuário', `Excluiu custo do evento ${selectedEvent.nome}`, 'Eventos');
    } catch (error) {
      console.error('Erro ao excluir custo:', error);
    }
  };

  const handleDeleteSponsorship = async (sponsorship: any) => {
    if (!selectedEvent || !isAdmin) return;
    if (!window.confirm('Tem certeza que deseja excluir este patrocínio?')) return;
    try {
      await deleteEventSponsorship(selectedEvent.id!, sponsorship);
      logAction(profile?.nome || 'Usuário', `Excluiu patrocínio do evento ${selectedEvent.nome}`, 'Eventos');
    } catch (error) {
      console.error('Erro ao excluir patrocínio:', error);
    }
  };

  const renderModals = () => (
    <>
      {/* Sale Edit Modal */}
      <AnimatePresence>
        {isSaleEditModalOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <div className="glass-card w-full max-w-md p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Editar Venda</h3>
                <button onClick={() => setIsSaleEditModalOpen(false)} className="text-gray-400 hover:text-text-main">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>
              <form onSubmit={handleUpdateSale} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Nome do Comprador</label>
                  <input
                    required
                    type="text"
                    className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                    value={editingSaleData.participanteNome}
                    onChange={(e) => setEditingSaleData({ ...editingSaleData, participanteNome: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Telefone</label>
                  <input
                    type="text"
                    className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                    value={editingSaleData.participanteTelefone}
                    onChange={(e) => setEditingSaleData({ ...editingSaleData, participanteTelefone: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Lote</label>
                    <select
                      required
                      className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                      value={editingSaleData.loteId}
                      onChange={(e) => {
                        const lote = selectedEvent?.lotes?.find(l => l.id === e.target.value);
                        setEditingSaleData({ 
                          ...editingSaleData, 
                          loteId: e.target.value,
                          loteNome: lote?.nome || '',
                          valorTotal: (lote?.preco || 0) * editingSaleData.quantidadeIngressos
                        });
                      }}
                    >
                      {selectedEvent?.lotes?.map(l => (
                        <option key={l.id} value={l.id}>{l.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Quantidade</label>
                    <input
                      required
                      type="number"
                      min="1"
                      className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                      value={editingSaleData.quantidadeIngressos}
                      onChange={(e) => {
                        const qty = Number(e.target.value);
                        const lote = selectedEvent?.lotes?.find(l => l.id === editingSaleData.loteId);
                        setEditingSaleData({ 
                          ...editingSaleData, 
                          quantidadeIngressos: qty,
                          valorTotal: (lote?.preco || 0) * qty
                        });
                      }}
                    />
                  </div>
                </div>
                <div className="p-4 bg-primary/5 rounded-xl border border-primary/20">
                  <p className="text-xs font-bold text-gray-400 uppercase">Total</p>
                  <p className="text-xl font-bold text-primary">{formatCurrency(editingSaleData.valorTotal)}</p>
                </div>
                <button type="submit" className="w-full btn-primary justify-center py-3">Salvar Alterações</button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Cost Modal */}
      <AnimatePresence>
        {isCostModalOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <div className="glass-card w-full max-w-md p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Adicionar Custo</h3>
                <button onClick={() => setIsCostModalOpen(false)} className="text-gray-400 hover:text-text-main">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>
              <form onSubmit={handleAddCost} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Descrição</label>
                  <input
                    required
                    type="text"
                    className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                    placeholder="Ex: Aluguel do som"
                    value={newCost.descricao}
                    onChange={(e) => setNewCost({ ...newCost, descricao: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Valor (R$)</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                    value={newCost.valor || ''}
                    onChange={(e) => setNewCost({ ...newCost, valor: Number(e.target.value) })}
                  />
                </div>
                <button type="submit" className="w-full btn-primary justify-center py-3">Confirmar</button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sponsorship Modal */}
      <AnimatePresence>
        {isSponsorModalOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <div className="glass-card w-full max-w-md p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Adicionar Patrocínio</h3>
                <button onClick={() => setIsSponsorModalOpen(false)} className="text-gray-400 hover:text-text-main">
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
                    placeholder="Ex: Empresa X"
                    value={newSponsor.nome}
                    onChange={(e) => setNewSponsor({ ...newSponsor, nome: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Valor (R$)</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                    value={newSponsor.valor || ''}
                    onChange={(e) => setNewSponsor({ ...newSponsor, valor: Number(e.target.value) })}
                  />
                </div>
                <button type="submit" className="w-full btn-primary justify-center py-3">Confirmar</button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Event Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <div className="glass-card w-full max-w-2xl p-6 lg:p-8 space-y-6 max-h-[90vh] overflow-y-auto scrollbar-hide">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">{editingEvent ? 'Editar Evento' : 'Novo Evento'}</h3>
                <button 
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingEvent(null);
                  }} 
                  className="text-gray-400 hover:text-text-main"
                >
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>

              <form onSubmit={handleAddEvent} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Orçamento Estimado (R$)</label>
                    <input
                      required
                      type="number"
                      className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                      value={newEvent.orcamento}
                      onChange={(e) => setNewEvent({ ...newEvent, orcamento: Number(e.target.value) })}
                    />
                  </div>
                </div>

                {/* Lotes Section */}
                <div className="space-y-4 pt-4 border-t border-highlight/10">
                  <h4 className="font-bold flex items-center gap-2">
                    <Ticket size={18} className="text-primary" />
                    Configurar Lotes
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 bg-background/50 rounded-xl border border-highlight/10">
                    <input
                      type="text"
                      placeholder="Nome (Ex: Lote 1)"
                      className="bg-transparent border-b border-highlight/20 outline-none px-2 py-1 text-sm"
                      value={newBatch.nome}
                      onChange={(e) => setNewBatch({ ...newBatch, nome: e.target.value })}
                    />
                    <input
                      type="number"
                      placeholder="Preço (R$)"
                      className="bg-transparent border-b border-highlight/20 outline-none px-2 py-1 text-sm"
                      value={newBatch.preco || ''}
                      onChange={(e) => setNewBatch({ ...newBatch, preco: Number(e.target.value) })}
                    />
                    <input
                      type="number"
                      placeholder="Qtd Total"
                      className="bg-transparent border-b border-highlight/20 outline-none px-2 py-1 text-sm"
                      value={newBatch.quantidadeTotal || ''}
                      onChange={(e) => setNewBatch({ ...newBatch, quantidadeTotal: Number(e.target.value) })}
                    />
                    <button 
                      type="button"
                      onClick={handleAddBatch}
                      className="bg-primary/10 text-primary py-2 rounded-lg font-bold text-xs hover:bg-primary/20 transition-all"
                    >
                      Adicionar Lote
                    </button>
                  </div>

                  <div className="space-y-2">
                    {newEvent.lotes.map((lote, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-highlight/5 rounded-lg text-sm">
                        <div className="flex items-center gap-4">
                          <span className="font-bold">{lote.nome}</span>
                          <span className="text-primary font-medium">R$ {lote.preco}</span>
                          <span className="text-gray-500">{lote.quantidadeTotal} ingressos</span>
                        </div>
                        <button 
                          type="button"
                          onClick={() => setNewEvent(prev => ({ ...prev, lotes: prev.lotes.filter((_, i) => i !== idx) }))}
                          className="text-danger hover:bg-danger/10 p-1 rounded"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-primary text-white py-4 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                >
                  {editingEvent ? 'Salvar Alterações' : 'Criar Evento'}
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Refund Modal */}
      <AnimatePresence>
        {isRefundModalOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <div className="glass-card w-full max-w-md p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Adicionar Reembolso</h3>
                <button onClick={() => setIsRefundModalOpen(false)} className="text-gray-400 hover:text-text-main">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>
              <form onSubmit={handleAddRefund} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Nome do Comprador</label>
                  <input
                    required
                    type="text"
                    className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                    placeholder="Ex: João Silva"
                    value={newRefund.nomeComprador}
                    onChange={(e) => setNewRefund({ ...newRefund, nomeComprador: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Valor (R$)</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                    value={newRefund.valor || ''}
                    onChange={(e) => setNewRefund({ ...newRefund, valor: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Motivo (opcional)</label>
                  <input
                    type="text"
                    className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                    placeholder="Ex: Desistência"
                    value={newRefund.motivo}
                    onChange={(e) => setNewRefund({ ...newRefund, motivo: e.target.value })}
                  />
                </div>
                <button type="submit" className="w-full btn-primary justify-center py-3">Confirmar</button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sale Registration Modal */}
      <AnimatePresence>
        {openVendaModal && selectedEvent && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <div className="glass-card w-full max-w-lg p-6 lg:p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">Registrar Venda</h3>
                  <p className="text-xs text-gray-500">Evento: {selectedEvent.nome}</p>
                </div>
                <button onClick={() => setOpenVendaModal(false)} className="text-gray-400 hover:text-text-main">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>

              <form onSubmit={registrarVenda} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Nome do Comprador</label>
                  <input
                    required
                    type="text"
                    className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                    placeholder="Nome completo"
                    value={newSale.participanteNome}
                    onChange={(e) => setNewSale({ ...newSale, participanteNome: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Telefone (opcional)</label>
                  <input
                    type="tel"
                    className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                    placeholder="(00) 00000-0000"
                    value={newSale.participanteTelefone}
                    onChange={(e) => setNewSale({ ...newSale, participanteTelefone: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Selecionar Lote</label>
                    <select
                      required
                      className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                      value={newSale.loteId}
                      onChange={(e) => setNewSale({ ...newSale, loteId: e.target.value })}
                    >
                      <option value="">Selecione o lote...</option>
                      {selectedEvent.lotes && selectedEvent.lotes.filter(l => l.ativo).map(l => (
                        <option key={l.id} value={l.id}>{l.nome} - R$ {l.preco}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Quantidade</label>
                    <input
                      required
                      type="number"
                      min="1"
                      className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                      value={newSale.quantidadeIngressos}
                      onChange={(e) => setNewSale({ ...newSale, quantidadeIngressos: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Forma de Pagamento</span>
                    <span className="text-xs font-bold uppercase text-primary">PIX / Dinheiro</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-primary/10">
                    <span className="font-bold">Total a Pagar</span>
                    <span className="text-xl font-bold text-primary">
                      {newSale.loteId ? formatCurrency(((selectedEvent.lotes || []).find(l => l.id === newSale.loteId)?.preco || 0) * newSale.quantidadeIngressos) : 'R$ 0,00'}
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-primary text-white py-4 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                >
                  Confirmar venda
                </button>
                <p className="text-[10px] text-center text-gray-400">
                  * A venda ficará pendente até a confirmação do diretor financeiro.
                </p>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );

  if (viewMode === 'details' && selectedEvent) {
    const loteAtual = getLoteAtual(selectedEvent);
    return (
      <div className="space-y-6">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setViewMode('list')}
              className="p-2 hover:bg-highlight/10 rounded-xl transition-all"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h2 className="text-2xl font-bold">{selectedEvent.nome}</h2>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <UserCheck size={14} className="text-primary" />
                Criado por: {selectedEvent.criadoPor}
              </div>
            </div>
          </div>
          
          {financialStats.pending > 0 && (
            <div className="flex items-center gap-2 bg-yellow-50 text-yellow-700 px-4 py-2 rounded-xl border border-yellow-200 animate-pulse">
              <Clock size={18} />
              <span className="text-sm font-bold">
                {eventSales.filter(s => s.status === 'pendente').length} vendas aguardando validação financeira
              </span>
            </div>
          )}
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Indicators */}
          <div className="lg:col-span-4 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card p-6 flex items-center gap-4">
              <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                <Ticket size={24} />
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase font-bold">Ingressos Vendidos</p>
                <p className="text-2xl font-bold">{financialStats.totalSold}</p>
              </div>
            </div>
            <div className="glass-card p-6 flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 text-blue-600 rounded-2xl">
                <Users size={24} />
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase font-bold">Ingressos Restantes</p>
                <p className="text-2xl font-bold">
                  {((selectedEvent.lotes || []).reduce((acc, l) => acc + l.quantidadeTotal, 0) - financialStats.totalSold)}
                </p>
              </div>
            </div>
            <div className="glass-card p-6 flex items-center gap-4">
              <div className="p-3 bg-green-500/10 text-green-600 rounded-2xl">
                <DollarSign size={24} />
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase font-bold">Receita Registrada</p>
                <p className="text-2xl font-bold">{formatCurrency(financialStats.total)}</p>
              </div>
            </div>
          </div>

          {/* 1. Informações do Evento (Top level for mobile ordering) */}
          <div className="lg:col-span-3 order-1">
            <div className="glass-card p-6 space-y-6">
              <h3 className="font-bold flex items-center gap-2 border-b border-highlight/10 pb-4">
                <FileText size={20} className="text-primary" />
                Informações do Evento
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="space-y-1">
                  <p className="text-xs text-gray-400 uppercase font-bold">Data</p>
                  <div className="flex items-center gap-2 font-medium">
                    <Calendar size={16} className="text-primary" />
                    {new Date(selectedEvent.data).toLocaleDateString('pt-BR')}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-400 uppercase font-bold">Local</p>
                  <div className="flex items-center gap-2 font-medium">
                    <MapPin size={16} className="text-primary" />
                    {selectedEvent.local}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-400 uppercase font-bold">Lote Ativo</p>
                  <div className="flex items-center gap-2 font-medium">
                    <Ticket size={16} className="text-primary" />
                    {loteAtual?.nome || 'Nenhum'}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-400 uppercase font-bold">Valor Atual</p>
                  <div className="flex items-center gap-2 font-medium text-primary">
                    <DollarSign size={16} />
                    {loteAtual ? formatCurrency(loteAtual.preco) : '---'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Ações do Evento (Sidebar top level for mobile ordering) */}
          <div className="lg:col-span-1 order-2 lg:order-2">
            <div className="glass-card p-6 space-y-4">
              <h3 className="font-bold">Ações do Evento</h3>
              <button 
                onClick={() => setOpenVendaModal(true)}
                className="w-full btn-primary flex items-center justify-center gap-2 py-4 shadow-xl shadow-primary/20"
              >
                <DollarSign size={20} />
                Registrar Venda
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={handleExportPDF}
                  className="flex items-center justify-center gap-2 bg-highlight/10 text-text-main py-3 rounded-xl font-bold text-xs hover:bg-highlight/20 transition-all"
                >
                  <FileText size={16} />
                  PDF
                </button>
                <button 
                  onClick={() => {
                    const headers = ['Nome', 'Telefone', 'Lote', 'Vendedor', 'Data'];
                    const rows = participants.map(p => [p.nomeComprador, p.telefone, p.lote, p.registradoPor, p.dataRegistro]);
                    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `participantes_${selectedEvent.nome}.csv`;
                    a.click();
                  }}
                  className="flex items-center justify-center gap-2 bg-highlight/10 text-text-main py-3 rounded-xl font-bold text-xs hover:bg-highlight/20 transition-all"
                >
                  <Download size={16} />
                  CSV
                </button>
              </div>
            </div>
          </div>

          {/* Main Content - Rest */}
          <div className="lg:col-span-3 order-3 lg:order-3 space-y-6">
            {/* 2. Sistema de Lotes */}
            <div className="glass-card p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-highlight/10 pb-4">
                <h3 className="font-bold flex items-center gap-2">
                  <TrendingUp size={20} className="text-primary" />
                  Gestão de Lotes
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 uppercase text-[10px] font-bold">
                      <th className="pb-4 px-2">Nome</th>
                      <th className="pb-4 px-2">Preço</th>
                      <th className="pb-4 px-2">Total</th>
                      <th className="pb-4 px-2">Vendido</th>
                      <th className="pb-4 px-2">Restante</th>
                      <th className="pb-4 px-2">Status</th>
                      <th className="pb-4 px-2 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-highlight/10">
                    {(!selectedEvent.lotes || selectedEvent.lotes.length === 0) ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-gray-400">
                          Nenhum lote cadastrado para este evento.
                        </td>
                      </tr>
                    ) : selectedEvent.lotes.map((lote) => (
                      <tr key={lote.id} className="group hover:bg-highlight/5 transition-colors">
                        <td className="py-4 px-2 font-bold">{lote.nome}</td>
                        <td className="py-4 px-2 text-primary font-bold">{formatCurrency(lote.preco)}</td>
                        <td className="py-4 px-2">{lote.quantidadeTotal}</td>
                        <td className="py-4 px-2">{lote.quantidadeVendida}</td>
                        <td className="py-4 px-2">{lote.quantidadeTotal - lote.quantidadeVendida}</td>
                        <td className="py-4 px-2">
                          <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                            lote.ativo ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {lote.ativo ? 'Ativo' : 'Encerrado'}
                          </span>
                        </td>
                        <td className="py-4 px-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {!lote.ativo ? (
                              <button 
                                onClick={() => handleToggleLote(selectedEvent.id!, lote.id, 'ativar')}
                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-all"
                                title="Ativar Lote"
                              >
                                <CheckCircle2 size={16} />
                              </button>
                            ) : (
                              <button 
                                onClick={() => handleToggleLote(selectedEvent.id!, lote.id, 'encerrar')}
                                className="p-2 text-gray-400 hover:bg-gray-50 rounded-lg transition-all"
                                title="Encerrar Lote"
                              >
                                <Clock size={16} />
                              </button>
                            )}
                            <button 
                              onClick={() => {
                                const nextBatch = (selectedEvent.lotes || []).find(l => !l.ativo && l.quantidadeVendida === 0);
                                if (nextBatch) handleVirarLote(selectedEvent.id!, nextBatch.id);
                                else alert('Não há um próximo lote configurado.');
                              }}
                              className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-all"
                              title="Virar Lote"
                            >
                              <TrendingUp size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. Lista de Participantes */}
            <div className="glass-card p-6 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-highlight/10 pb-4">
                <h3 className="font-bold flex items-center gap-2">
                  <Users size={20} className="text-primary" />
                  Lista de Participantes
                </h3>
                <div className="flex items-center gap-3 bg-background/50 border border-highlight/10 rounded-xl px-4 py-2 w-full md:w-64">
                  <Search size={16} className="text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Buscar participante..."
                    className="bg-transparent border-none outline-none text-xs w-full"
                    value={participantSearch}
                    onChange={(e) => setParticipantSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-8">
                {Object.entries(participantsByBatch).length > 0 ? (
                  Object.entries(participantsByBatch).map(([batchName, participants]: [string, any]) => (
                    <div key={batchName} className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="h-px flex-1 bg-highlight/10"></div>
                        <span className="text-[10px] font-bold uppercase text-gray-400 tracking-widest px-4">
                          {batchName} ({participants.length})
                        </span>
                        <div className="h-px flex-1 bg-highlight/10"></div>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        {participants.map((p: any) => (
                          <div key={p.id} className={`flex items-center justify-between p-4 bg-background/30 rounded-xl border transition-all ${
                            p.status === 'cancelado' ? 'border-danger/20 opacity-60' : 'border-highlight/5 hover:border-primary/20'
                          }`}>
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                                p.status === 'cancelado' ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary'
                              }`}>
                                {p.nomeComprador.charAt(0)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-sm">{p.nomeComprador}</p>
                                  {p.status === 'cancelado' && (
                                    <span className="px-1.5 py-0.5 bg-danger/10 text-danger text-[8px] font-bold uppercase rounded">Cancelado</span>
                                  )}
                                </div>
                                <p className="text-[10px] text-gray-500">{p.telefone || 'Sem telefone'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-6">
                              <div className="text-right">
                                <p className="text-[10px] text-gray-400 uppercase font-bold">Vendedor</p>
                                <p className="text-xs font-medium">{p.registradoPor}</p>
                                <p className="text-[10px] text-gray-500">{new Date(p.dataRegistro).toLocaleDateString('pt-BR')}</p>
                              </div>
                              
                              {(profile?.diretorFinanceiro || isAdmin) && p.status !== 'cancelado' && (
                                <div className="flex items-center gap-2 border-l border-highlight/10 pl-4">
                                  <button 
                                    onClick={() => handleEditSale(p)}
                                    className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                                    title="Editar Venda"
                                  >
                                    <Edit size={16} />
                                  </button>
                                  <button 
                                    onClick={() => handleCancelSale(p)}
                                    className="p-2 text-gray-400 hover:text-danger hover:bg-danger/5 rounded-lg transition-all"
                                    title="Cancelar Venda"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-gray-400 space-y-2">
                    <Filter size={48} className="mx-auto opacity-20" />
                    <p>Nenhum participante encontrado.</p>
                  </div>
                )}
              </div>
            </div>

            {/* 5. Custos do Evento */}
            <div className="glass-card p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-highlight/10 pb-4">
                <h3 className="font-bold flex items-center gap-2">
                  <AlertCircle size={20} className="text-danger" />
                  Custos do Evento
                </h3>
                {isAdmin && (
                  <button 
                    onClick={() => setIsCostModalOpen(true)}
                    className="text-xs font-bold text-primary hover:bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/20 transition-all flex items-center gap-1"
                  >
                    <Plus size={14} />
                    Adicionar Custo
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {(!selectedEvent.custos || selectedEvent.custos.length === 0) ? (
                  <p className="text-center py-4 text-gray-400 text-sm italic">Nenhum custo registrado.</p>
                ) : (
                  selectedEvent.custos.map((custo, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-danger/5 rounded-xl border border-danger/10">
                      <div>
                        <p className="font-bold text-sm">{custo.descricao}</p>
                        <p className="text-[10px] text-gray-500">Por: {custo.criadoPor} em {new Date(custo.data).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="font-bold text-danger">{formatCurrency(custo.valor)}</p>
                        {isAdmin && (
                          <button 
                            onClick={() => handleDeleteCost(custo)}
                            className="text-gray-400 hover:text-danger transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 6. Patrocínios */}
            <div className="glass-card p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-highlight/10 pb-4">
                <h3 className="font-bold flex items-center gap-2">
                  <TrendingUp size={20} className="text-blue-600" />
                  Patrocínios
                </h3>
                {isAdmin && (
                  <button 
                    onClick={() => setIsSponsorModalOpen(true)}
                    className="text-xs font-bold text-primary hover:bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/20 transition-all flex items-center gap-1"
                  >
                    <Plus size={14} />
                    Adicionar Patrocínio
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {(!selectedEvent.patrocinios || selectedEvent.patrocinios.length === 0) ? (
                  <p className="text-center py-4 text-gray-400 text-sm italic">Nenhum patrocínio registrado.</p>
                ) : (
                  selectedEvent.patrocinios.map((patrocínio, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-100">
                      <div>
                        <p className="font-bold text-sm">{patrocínio.nome}</p>
                        <p className="text-[10px] text-gray-500">Por: {patrocínio.criadoPor} em {new Date(patrocínio.data).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="font-bold text-blue-600">{formatCurrency(patrocínio.valor)}</p>
                        {isAdmin && (
                          <button 
                            onClick={() => handleDeleteSponsorship(patrocínio)}
                            className="text-gray-400 hover:text-danger transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 7. Reembolsos */}
            <div className="glass-card p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-highlight/10 pb-4">
                <h3 className="font-bold flex items-center gap-2">
                  <AlertCircle size={20} className="text-orange-600" />
                  Reembolsos
                </h3>
                {isAdmin && (
                  <button 
                    onClick={() => setIsRefundModalOpen(true)}
                    className="text-xs font-bold text-primary hover:bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/20 transition-all flex items-center gap-1"
                  >
                    <Plus size={14} />
                    Adicionar Reembolso
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {(!selectedEvent.reembolsos || selectedEvent.reembolsos.length === 0) ? (
                  <p className="text-center py-4 text-gray-400 text-sm italic">Nenhum reembolso registrado.</p>
                ) : (
                  selectedEvent.reembolsos.map((reembolso, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-orange-50 rounded-xl border border-orange-100">
                      <div>
                        <p className="font-bold text-sm">{reembolso.nomeComprador}</p>
                        {reembolso.motivo && <p className="text-xs text-gray-600">{reembolso.motivo}</p>}
                        <p className="text-[10px] text-gray-500">Por: {reembolso.criadoPor} em {new Date(reembolso.criadoEm).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="font-bold text-orange-600">{formatCurrency(reembolso.valor)}</p>
                        {isAdmin && (
                          <button 
                            onClick={() => handleDeleteRefund(reembolso)}
                            className="text-gray-400 hover:text-danger transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Sidebar - Rest */}
          <div className="lg:col-span-1 order-4 lg:order-4 space-y-6">
            {/* 7. Resumo Financeiro (Aberto para todos) */}
            <div className="glass-card p-6 space-y-6 bg-primary/5 border-primary/20">
              <h3 className="font-bold flex items-center gap-2 text-primary">
                <DollarSign size={20} />
                Resumo Financeiro
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500 font-bold uppercase">Receita (Vendas)</span>
                  <span className="font-bold text-green-600">{formatCurrency(financialStats.confirmed)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500 font-bold uppercase">Patrocínios</span>
                  <span className="font-bold text-blue-600">{formatCurrency(financialStats.totalPatrocinios)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500 font-bold uppercase">Custos Totais</span>
                  <span className="font-bold text-danger">{formatCurrency(financialStats.totalCustos)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500 font-bold uppercase">Reembolsos</span>
                  <span className="font-bold text-orange-600">{formatCurrency(financialStats.totalReembolsos)}</span>
                </div>
                <div className="pt-4 border-t border-primary/20 flex justify-between items-center">
                  <span className="text-sm font-bold uppercase">Lucro Líquido</span>
                  <span className={`text-xl font-bold ${financialStats.lucro >= 0 ? 'text-primary' : 'text-danger'}`}>
                    {formatCurrency(financialStats.lucro)}
                  </span>
                </div>
              </div>
            </div>

            {/* 6. Estatísticas do Evento (Restrito ao Diretor Financeiro) */}
            {isAdmin && (
              <div className="glass-card p-6 space-y-6">
                <h3 className="font-bold flex items-center gap-2">
                  <TrendingUp size={20} className="text-primary" />
                  Estatísticas
                </h3>
                <div className="space-y-4">
                  <div className="p-4 bg-background/50 rounded-xl border border-highlight/5">
                    <p className="text-[10px] text-gray-400 uppercase font-bold">Lote Mais Vendido</p>
                    <p className="text-lg font-bold text-primary">{financialStats.mostSoldBatch}</p>
                  </div>
                  <div className="p-4 bg-background/50 rounded-xl border border-highlight/5">
                    <p className="text-[10px] text-gray-400 uppercase font-bold">Vendedores Ativos</p>
                    <p className="text-lg font-bold">{financialStats.sellers}</p>
                  </div>
                  <div className="p-4 bg-background/50 rounded-xl border border-highlight/5">
                    <p className="text-[10px] text-gray-400 uppercase font-bold">Receita Estimada</p>
                    <p className="text-lg font-bold text-green-600">{formatCurrency(financialStats.total)}</p>
                  </div>
                </div>
              </div>
            )}

            {isAdmin && (
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    setEditingEvent(selectedEvent);
                    setNewEvent({
                      nome: selectedEvent.nome,
                      data: selectedEvent.data,
                      local: selectedEvent.local || '',
                      descricao: selectedEvent.descricao || '',
                      orcamento: selectedEvent.orcamento || 0,
                      publicoEstimado: selectedEvent.publicoEstimado || 0,
                      status: selectedEvent.status,
                      lotes: selectedEvent.lotes || [],
                      loteAtualId: selectedEvent.loteAtualId || ''
                    });
                    setIsModalOpen(true);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-highlight/10 text-text-main py-4 rounded-xl font-bold hover:bg-highlight/20 transition-all"
                >
                  <Edit size={20} />
                  Editar
                </button>
                <button 
                  onClick={() => handleDeleteEvent(selectedEvent.id!)}
                  className="p-4 bg-danger/10 text-danger rounded-xl hover:bg-danger/20 transition-all"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            )}
          </div>
        </div>
        {renderModals()}
      </div>
    );
  }

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
          filteredEvents.map((event) => {
            const loteAtual = getLoteAtual(event);
            return (
              <div 
                key={event.id} 
                className="glass-card overflow-hidden group cursor-pointer hover:border-primary/50 transition-all"
                onClick={() => {
                  setSelectedEvent(event);
                  setViewMode('details');
                }}
              >
                <div className="h-32 bg-gradient-to-br from-primary/20 to-highlight/20 flex items-center justify-center relative">
                  <Calendar size={48} className="text-primary/40" />
                  <div className="absolute top-4 right-4">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                      event.status === 'concluido' ? 'bg-green-100 text-green-600' :
                      event.status === 'em_andamento' ? 'bg-blue-100 text-blue-600' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {event.status}
                    </span>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-bold text-text-main group-hover:text-primary transition-colors">
                      {event.nome}
                    </h3>
                    <ChevronRight size={20} className="text-gray-300 group-hover:text-primary transition-all" />
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
                    <div className="flex items-center justify-between pt-2 border-t border-highlight/10">
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-gray-400 uppercase font-bold">Lote Atual</p>
                        <p className="text-sm font-bold">{loteAtual?.nome || 'Nenhum'}</p>
                      </div>
                      <div className="text-right space-y-0.5">
                        <p className="text-[10px] text-gray-400 uppercase font-bold">Preço</p>
                        <p className="text-sm font-bold text-primary">
                          {loteAtual ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(loteAtual.preco) : '---'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-12 text-center text-gray-400">
            Nenhum evento encontrado.
          </div>
        )}
      </div>

      {renderModals()}
    </div>
  );
};

export default EventosComponent;
