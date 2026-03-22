import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

export const logAction = async (usuario: string, acao: string, modulo: string, pagina: string = 'N/A') => {
  try {
    const logsCollectionRef = collection(db, 'logs_acesso');
    await addDoc(logsCollectionRef, {
      usuario,
      acao,
      modulo,
      pagina,
      horario: serverTimestamp(),
    });

    const viewsCollectionRef = collection(db, 'ultimas_visualizacoes');
    await addDoc(viewsCollectionRef, {
      usuario,
      pagina,
      horario: serverTimestamp(),
    });
  } catch (error) {
    console.error('Erro ao registrar log:', error);
  }
};
