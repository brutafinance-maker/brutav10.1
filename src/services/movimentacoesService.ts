import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { Transaction } from '../types';

const COLLECTION_NAME = 'movimentacoes';

export const addTransaction = async (transaction: Omit<Transaction, 'id'>) => {
  return await addDoc(collection(db, COLLECTION_NAME), {
    ...transaction,
    timestamp: serverTimestamp()
  });
};

export const updateTransaction = async (id: string, transaction: Partial<Transaction>) => {
  const transactionRef = doc(db, COLLECTION_NAME, id);
  return await updateDoc(transactionRef, transaction);
};

export const deleteTransaction = async (id: string) => {
  const transactionRef = doc(db, COLLECTION_NAME, id);
  return await deleteDoc(transactionRef);
};
