import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { Sale, Transaction } from '../types';
import { addTransaction } from './movimentacoesService';
import { updateProductStock } from './produtosService';

export const addSale = async (sale: Sale, usuarioId: string, usuarioNome: string, isFinanceDirector: boolean = true) => {
  try {
    // Se não for diretor financeiro, a venda vai para a fila de aprovação
    if (!isFinanceDirector) {
      const pendingSale = {
        ...sale,
        tipoVenda: 'produto',
        status: 'pendente',
        dataCriacao: serverTimestamp(),
        dataRegistro: new Date().toISOString(),
        usuarioId,
        usuarioNome,
        nomeVendedor: usuarioNome,
        valorUnitario: sale.precoUnitario,
        valorTotal: sale.valorTotal
      };
      const pendingRef = await addDoc(collection(db, 'vendasPendentes'), pendingSale);
      return pendingRef.id;
    }

    // 1. Save Sale
    const saleRef = await addDoc(collection(db, 'vendas'), {
      ...sale,
      dataCriacao: serverTimestamp()
    });

    // 2. Create automatic financial transaction (entrada)
    const transaction: Transaction = {
      tipo: 'entrada',
      valor: sale.valorTotal,
      categoriaId: sale.categoriaId,
      produtoId: sale.produtoId,
      descricao: `Venda: ${sale.descricao}`,
      data: sale.data,
      usuarioId,
      usuarioNome,
    };

    await addTransaction(transaction);

    // 3. Update product stock
    await updateProductStock(sale.produtoId, sale.quantidade);

    return saleRef.id;
  } catch (error) {
    console.error("Erro ao registrar venda:", error);
    throw error;
  }
};

export const deleteSale = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'vendas', id));
  } catch (error) {
    console.error("Erro ao excluir venda:", error);
    throw error;
  }
};
