import React from 'react';
import { AlertTriangle } from 'lucide-react';


import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const FirebaseStatus = () => {
  const [isNotConfigured, setIsNotConfigured] = React.useState(false);

  React.useEffect(() => {
    const checkConnection = async () => {
      try {
        // A simple read operation to a non-existent document to check connection
        const docRef = doc(db, 'test-connection', 'test');
        await getDoc(docRef);
      } catch (error: any) {
        if (error.code === 'permission-denied' || error.message.includes('Missing or insufficient permissions')) {
          // This is expected if rules are set up correctly and the doc doesn't exist.
          // It still confirms a connection.
          setIsNotConfigured(false);
        } else {
          console.error("Firebase connection failed:", error);
          setIsNotConfigured(true);
        }
      }
    };

    checkConnection();
  }, []);

  if (!isNotConfigured) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md animate-bounce">
      <div className="bg-danger text-white p-4 rounded-xl shadow-2xl border-2 border-white flex items-start gap-3">
        <div className="p-2 bg-white/20 rounded-lg">
          <AlertTriangle size={24} />
        </div>
        <div>
          <h3 className="font-bold text-lg">Firebase não configurado</h3>
          <p className="text-sm opacity-90">
            Adicione sua API Key em: <br/>
            <code className="bg-black/20 px-1 rounded">src/config/firebaseConfig.ts</code>
          </p>
        </div>
      </div>
    </div>
  );
};

export default FirebaseStatus;
