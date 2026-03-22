import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Wallet, ArrowRight, AlertCircle } from 'lucide-react';

const InitialBalance = () => {
  const { profile } = useAuth();
  const [balance, setBalance] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    setLoading(true);
    setError('');
    
    try {
      await setDoc(doc(db, 'configuracoes', 'geral'), {
        saldoInicial: Number(balance),
        configuradoPor: profile.nome,
        dataConfiguracao: new Date().toISOString()
      });
      // The AuthContext will pick up the change and redirect via App.tsx logic
    } catch (err) {
      setError('Erro ao salvar configuração inicial.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-black text-primary tracking-tighter uppercase">BrutaFin</h1>
          <p className="text-gray-500 mt-2">Configuração Inicial do Sistema</p>
        </div>

        <div className="glass-card p-8 space-y-6">
          <div className="flex justify-center">
            <div className="p-4 bg-primary/10 rounded-full text-primary">
              <Wallet size={48} />
            </div>
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold">Bem-vindo, Diretor!</h2>
            <p className="text-gray-500 text-sm">
              Para começar, precisamos registrar o <strong>saldo atual</strong> encontrado na conta da atlética.
            </p>
          </div>

          {error && (
            <div className="bg-danger/10 text-danger p-4 rounded-xl flex items-center gap-3 text-sm">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          <form onSubmit={handleSetup} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase">Saldo Inicial (R$)</label>
              <input
                type="number"
                step="0.01"
                required
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                className="w-full p-4 rounded-xl border-2 border-primary/20 outline-none focus:border-primary text-2xl font-bold text-center"
                placeholder="0,00"
              />
            </div>

            <button
              disabled={loading}
              className="w-full btn-primary justify-center py-4 text-lg"
            >
              {loading ? 'Salvando...' : (
                <>
                  Confirmar Saldo Inicial
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>

          <p className="text-[10px] text-gray-400 text-center uppercase font-bold">
            Este valor será a base para todos os cálculos futuros.
          </p>
        </div>
      </div>
    </div>
  );
};

export default InitialBalance;
