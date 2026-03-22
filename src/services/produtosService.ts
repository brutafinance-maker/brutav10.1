import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  getDoc
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { Product } from '../types';

const COLLECTION_NAME = 'produtos';

export const addProduct = async (product: Omit<Product, 'id'>) => {
  return await addDoc(collection(db, COLLECTION_NAME), product);
};

export const updateProduct = async (id: string, product: Partial<Product>) => {
  const productRef = doc(db, COLLECTION_NAME, id);
  return await updateDoc(productRef, product);
};

export const deleteProduct = async (id: string) => {
  const productRef = doc(db, COLLECTION_NAME, id);
  return await deleteDoc(productRef);
};

export const updateProductStock = async (id: string, quantidadeVendida: number) => {
  const productRef = doc(db, COLLECTION_NAME, id);
  const productSnap = await getDoc(productRef);
  
  if (productSnap.exists()) {
    const productData = productSnap.data() as Product;
    const novoEstoque = (productData.estoque || 0) - quantidadeVendida;
    const novoVendido = (productData.vendido || 0) + quantidadeVendida;
    
    await updateDoc(productRef, {
      estoque: novoEstoque,
      vendido: novoVendido
    });
  }
};
