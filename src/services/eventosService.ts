import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  getDoc,
  query,
  where,
  getDocs,
  Timestamp,
  arrayUnion
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { Event, PendingSale, EventCost, EventSponsorship, EventRefund } from '../types';

const COLLECTION_NAME = 'eventos';

export const addEvent = async (event: Omit<Event, 'id'>) => {
  return await addDoc(collection(db, COLLECTION_NAME), {
    ...event,
    lotes: event.lotes || [],
    custos: [],
    patrocinios: [],
    reembolsos: [],
    dataCriacao: new Date().toISOString()
  });
};

export const updateEvent = async (id: string, event: Partial<Event>) => {
  const eventRef = doc(db, COLLECTION_NAME, id);
  return await updateDoc(eventRef, event);
};

export const addEventCost = async (eventoId: string, cost: EventCost) => {
  const eventRef = doc(db, COLLECTION_NAME, eventoId);
  return await updateDoc(eventRef, {
    custos: arrayUnion(cost)
  });
};

export const addEventSponsorship = async (eventoId: string, sponsorship: EventSponsorship) => {
  const eventRef = doc(db, COLLECTION_NAME, eventoId);
  return await updateDoc(eventRef, {
    patrocinios: arrayUnion(sponsorship)
  });
};

export const addEventRefund = async (eventoId: string, refund: EventRefund) => {
  const eventRef = doc(db, COLLECTION_NAME, eventoId);
  return await updateDoc(eventRef, {
    reembolsos: arrayUnion(refund)
  });
};

export const deleteEventRefund = async (eventoId: string, refund: EventRefund) => {
  const eventRef = doc(db, COLLECTION_NAME, eventoId);
  const eventSnap = await getDoc(eventRef);
  if (!eventSnap.exists()) return;
  
  const eventData = eventSnap.data() as Event;
  const updatedRefunds = (eventData.reembolsos || []).filter(r => r.id !== refund.id);
  
  return await updateDoc(eventRef, {
    reembolsos: updatedRefunds
  });
};

export const deleteEventCost = async (eventoId: string, cost: EventCost) => {
  const eventRef = doc(db, COLLECTION_NAME, eventoId);
  const eventSnap = await getDoc(eventRef);
  if (!eventSnap.exists()) return;
  
  const eventData = eventSnap.data() as Event;
  const updatedCosts = (eventData.custos || []).filter(c => 
    !(c.descricao === cost.descricao && c.valor === cost.valor && c.data === cost.data)
  );
  
  return await updateDoc(eventRef, {
    custos: updatedCosts
  });
};

export const deleteEventSponsorship = async (eventoId: string, sponsorship: EventSponsorship) => {
  const eventRef = doc(db, COLLECTION_NAME, eventoId);
  const eventSnap = await getDoc(eventRef);
  if (!eventSnap.exists()) return;
  
  const eventData = eventSnap.data() as Event;
  const updatedSponsorships = (eventData.patrocinios || []).filter(s => 
    !(s.nome === sponsorship.nome && s.valor === sponsorship.valor && s.data === sponsorship.data)
  );
  
  return await updateDoc(eventRef, {
    patrocinios: updatedSponsorships
  });
};

export const deleteEvent = async (id: string) => {
  const eventRef = doc(db, COLLECTION_NAME, id);
  return await deleteDoc(eventRef);
};

export const registerPendingSale = async (eventoId: string, sale: Omit<PendingSale, 'id'>) => {
  // 1. Salvar participante no evento para organização da lista
  const participantsRef = collection(db, `${COLLECTION_NAME}/${eventoId}/participantes`);
  const participantDoc = await addDoc(participantsRef, {
    nomeComprador: sale.participanteNome,
    telefone: sale.participanteTelefone,
    lote: sale.nomeLote,
    valorUnitario: sale.valorUnitario,
    quantidade: sale.quantidadeIngressos,
    valorTotal: sale.valorTotal,
    registradoPor: sale.registradoPorNome,
    usuarioId: sale.registradoPorId,
    dataRegistro: new Date().toISOString(),
    status: 'ativo'
  });

  // 2. Gerar registro financeiro pendente na coleção global
  const salesRef = collection(db, 'vendasPendentes');
  const saleDoc = await addDoc(salesRef, {
    ...sale,
    participanteId: participantDoc.id, // Link to participant
    dataRegistro: new Date().toISOString(),
    status: 'pendente'
  });

  // 3. Atualizar o participante com o ID da venda para facilitar edições/cancelamentos
  await updateDoc(participantDoc, { vendaId: saleDoc.id });

  return saleDoc.id;
};

export const getPendingSales = async () => {
  const salesRef = collection(db, 'vendasPendentes');
  const q = query(salesRef, where('status', '==', 'pendente'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PendingSale));
};

export const updatePendingSaleStatus = async (
  saleId: string, 
  status: 'confirmado' | 'rejeitado', 
  confirmadoPor?: string,
  motivoRejeicao?: string
) => {
  const saleRef = doc(db, 'vendasPendentes', saleId);
  const saleSnap = await getDoc(saleRef);
  
  if (!saleSnap.exists()) throw new Error('Venda não encontrada');
  const saleData = saleSnap.data() as PendingSale;

  // 1. Atualizar status da venda
  await updateDoc(saleRef, {
    status,
    confirmadoPor,
    motivoRejeicao,
    dataConfirmacao: new Date().toISOString()
  });

  // 2. Se confirmado, criar movimentação financeira
  if (status === 'confirmado') {
    const movimentacoesRef = collection(db, 'movimentacoes');
    await addDoc(movimentacoesRef, {
      tipo: 'entrada',
      categoriaId: 'eventos', // Categoria padrão para eventos
      categoriaNome: 'Eventos',
      eventoId: saleData.eventoId,
      eventoNome: saleData.nomeEvento,
      descricao: `Venda de ingressos - ${saleData.lote || saleData.nomeLote} - ${saleData.nomeEvento}`,
      valor: saleData.valorTotal,
      responsavel: saleData.registradoPorNome || saleData.nomeVendedor,
      usuarioId: saleData.registradoPorId || saleData.usuarioId,
      usuarioNome: saleData.registradoPorNome || saleData.nomeVendedor,
      confirmadoPor,
      data: new Date().toISOString(),
      dataConfirmacao: new Date().toISOString()
    });

    // 3. Atualizar quantidade vendida no lote do evento
    const eventRef = doc(db, COLLECTION_NAME, saleData.eventoId);
    const eventSnap = await getDoc(eventRef);
    if (eventSnap.exists()) {
      const eventData = eventSnap.data() as Event;
      const updatedLotes = (eventData.lotes || []).map(l => {
        if (l.id === saleData.loteId) {
          return { ...l, quantidadeVendida: (l.quantidadeVendida || 0) + saleData.quantidadeIngressos };
        }
        return l;
      });
      await updateDoc(eventRef, { lotes: updatedLotes });
    }
  }

  return true;
};

export const updateSale = async (eventoId: string, participanteId: string, vendaId: string, data: any) => {
  // 1. Atualizar no subcoleção de participantes do evento
  const participantRef = doc(db, COLLECTION_NAME, eventoId, 'participantes', participanteId);
  await updateDoc(participantRef, {
    nomeComprador: data.participanteNome,
    telefone: data.participanteTelefone,
    lote: data.nomeLote,
    valorUnitario: data.valorUnitario,
    quantidade: data.quantidadeIngressos,
    valorTotal: data.valorTotal
  });

  // 2. Atualizar na coleção global de vendasPendentes
  const saleRef = doc(db, 'vendasPendentes', vendaId);
  await updateDoc(saleRef, {
    ...data,
    participanteNome: data.participanteNome,
    nomeComprador: data.participanteNome,
    participanteTelefone: data.participanteTelefone,
    lote: data.nomeLote,
    valorUnitario: data.valorUnitario,
    quantidadeIngressos: data.quantidadeIngressos,
    valorTotal: data.valorTotal
  });

  return true;
};

export const cancelSale = async (eventoId: string, participanteId: string, vendaId: string, usuarioNome: string) => {
  // 1. Marcar como cancelado na subcoleção de participantes
  const participantRef = doc(db, COLLECTION_NAME, eventoId, 'participantes', participanteId);
  const participantSnap = await getDoc(participantRef);
  await updateDoc(participantRef, { status: 'cancelado' });

  // 2. Marcar como cancelado na coleção global de vendasPendentes
  const saleRef = doc(db, 'vendasPendentes', vendaId);
  const saleSnap = await getDoc(saleRef);
  await updateDoc(saleRef, { status: 'cancelado' });

  // 3. Criar reembolso automático se a venda existia
  if (saleSnap.exists()) {
    const saleData = saleSnap.data() as PendingSale;
    const eventRef = doc(db, COLLECTION_NAME, eventoId);
    const eventSnap = await getDoc(eventRef);
    
    if (eventSnap.exists()) {
      const eventData = eventSnap.data() as Event;
      
      // Verificar se já existe reembolso para esta venda
      const jaExiste = (eventData.reembolsos || []).some(r => r.vendaId === vendaId);
      
      if (!jaExiste) {
        const refund: EventRefund = {
          id: Math.random().toString(36).substr(2, 9),
          nomeComprador: saleData.nomeComprador || saleData.participanteNome || '---',
          valor: saleData.valorTotal,
          motivo: "Reembolso automático",
          vendaId: vendaId,
          criadoPor: usuarioNome,
          criadoEm: new Date().toISOString()
        };
        
        await updateDoc(eventRef, {
          reembolsos: arrayUnion(refund)
        });
      }
    }
  }

  return true;
};
