import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  DocumentData, 
  QuerySnapshot 
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { Category, Transaction, Event, Product, Sponsorship, Sale } from '../types';

export const subscribeToCategories = (callback: (categories: Category[]) => void) => {
  const q = query(collection(db, 'categorias'), orderBy('nome', 'asc'));
  return onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
    const categories = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Category[];
    callback(categories);
  });
};

export const subscribeToTransactions = (callback: (transactions: Transaction[]) => void) => {
  const q = query(collection(db, 'movimentacoes'), orderBy('data', 'desc'));
  return onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
    const transactions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Transaction[];
    callback(transactions);
  });
};

export const subscribeToEvents = (callback: (events: Event[]) => void) => {
  const q = query(collection(db, 'eventos'), orderBy('data', 'desc'));
  return onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
    const events = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        lotes: data.lotes || []
      } as Event;
    });
    callback(events);
  });
};

export const subscribeToProducts = (callback: (products: Product[]) => void) => {
  const q = query(collection(db, 'produtos'), orderBy('nome', 'asc'));
  return onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
    const products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Product[];
    callback(products);
  });
};

export const subscribeToSponsorships = (callback: (sponsorships: Sponsorship[]) => void) => {
  const q = query(collection(db, 'patrocinios'), orderBy('data', 'desc'));
  return onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
    const sponsorships = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Sponsorship[];
    callback(sponsorships);
  });
};

export const subscribeToSales = (callback: (sales: Sale[]) => void) => {
  const q = query(collection(db, 'vendas'), orderBy('data', 'desc'));
  return onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
    const sales = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Sale[];
    callback(sales);
  });
};
