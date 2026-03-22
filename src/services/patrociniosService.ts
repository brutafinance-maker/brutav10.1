import { collection, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { Sponsorship } from '../types';

const COLLECTION_NAME = 'patrocinios';

export const addSponsorship = async (sponsorship: Omit<Sponsorship, 'id'>) => {
  return await addDoc(collection(db, COLLECTION_NAME), {
    ...sponsorship,
    dataCriacao: new Date().toISOString()
  });
};

export const updateSponsorship = async (id: string, sponsorship: Partial<Sponsorship>) => {
  const docRef = doc(db, COLLECTION_NAME, id);
  return await updateDoc(docRef, sponsorship);
};

export const deleteSponsorship = async (id: string) => {
  const docRef = doc(db, COLLECTION_NAME, id);
  return await deleteDoc(docRef);
};
