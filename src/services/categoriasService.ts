import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { Category } from '../types';

const COLLECTION_NAME = 'categorias';

export const addCategory = async (category: Omit<Category, 'id' | 'dataCriacao'>) => {
  return await addDoc(collection(db, COLLECTION_NAME), {
    ...category,
    dataCriacao: new Date().toISOString()
  });
};

export const updateCategory = async (id: string, category: Partial<Category>) => {
  const categoryRef = doc(db, COLLECTION_NAME, id);
  return await updateDoc(categoryRef, category);
};

export const deleteCategory = async (id: string) => {
  const categoryRef = doc(db, COLLECTION_NAME, id);
  return await deleteDoc(categoryRef);
};
