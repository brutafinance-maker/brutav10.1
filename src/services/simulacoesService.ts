import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { Simulation } from '../types';

const COLLECTION_NAME = 'simulacoes';

export const simulacoesService = {
  async saveSimulation(simulation: Omit<Simulation, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...simulation,
        data: Timestamp.now()
      });
      return docRef.id;
    } catch (error) {
      console.error('Erro ao salvar simulação:', error);
      throw error;
    }
  },

  async updateSimulation(id: string, simulation: Partial<Simulation>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        ...simulation,
        data: Timestamp.now()
      });
    } catch (error) {
      console.error('Erro ao atualizar simulação:', error);
      throw error;
    }
  },

  async deleteSimulation(id: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Erro ao excluir simulação:', error);
      throw error;
    }
  },

  async getSimulationsByUser(userId: string): Promise<Simulation[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('criadoPor', '==', userId),
        orderBy('data', 'desc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        data: doc.data().data?.toDate?.()?.toISOString() || new Date().toISOString()
      } as Simulation));
    } catch (error) {
      console.error('Erro ao buscar simulações:', error);
      throw error;
    }
  }
};
