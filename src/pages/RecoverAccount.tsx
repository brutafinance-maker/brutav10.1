import React, { useState } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Mail, Key, AlertCircle, CheckCircle } from 'lucide-react';

const RecoverAccount = () => {
  const [email, setEmail] = useState('');
  const [frase, setFrase] = useState('');
  const [step, setStep] = useState(1); // 1: Email, 2: Phrase
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleCheckEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const q = query(collection(db, 'usuarios'), where('email', '==', email));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setError('E-mail não encontrado no sistema.');
      } else {
        setStep(2);
      }
    } catch (err) {
      setError('Erro ao verificar e-mail.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPhrase = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const q = query(
        collection(db, 'usuarios'), 
        where('email', '==', email),
        where('fraseSeguranca', '==', frase.toLowerCase().trim())
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('Frase de segurança incorreta.');
      } else {
        await sendPasswordResetEmail(auth, email);
        setSuccess(true);
      }
    } catch (err) {
      setError('Erro ao processar recuperação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-black text-primary tracking-tighter uppercase">BrutaFin</h1>
          <p className="text-gray-500 mt-2">Recuperação de Conta</p>
        </div>

        <div className="glass-card p-8 space-y-6">
          {success ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle size={64} className="text-secondary" />
              </div>
              <h2 className="text-2xl font-bold">E-mail Enviado!</h2>
              <p className="text-gray-500">
                Um link de redefinição de senha foi enviado para <strong>{email}</strong>. 
                Verifique sua caixa de entrada e spam.
              </p>
              <Link to="/login" className="btn-primary w-full justify-center py-3">
                Voltar para Login
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-center">Recuperar Acesso</h2>
              
              {error && (
                <div className="bg-danger/10 text-danger p-4 rounded-xl flex items-center gap-3 text-sm">
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}

              {step === 1 ? (
                <form onSubmit={handleCheckEmail} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Digite seu E-mail</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-highlight/30 outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="seu@email.com"
                      />
                    </div>
                  </div>
                  <button disabled={loading} className="w-full btn-primary justify-center py-3">
                    {loading ? 'Verificando...' : 'Continuar'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyPhrase} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Frase de Segurança</label>
                    <div className="relative">
                      <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="text"
                        required
                        value={frase}
                        onChange={(e) => setFrase(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-highlight/30 outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="Sua frase cadastrada"
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 italic">
                      Dica: Digite exatamente como cadastrou.
                    </p>
                  </div>
                  <button disabled={loading} className="w-full btn-primary justify-center py-3">
                    {loading ? 'Processando...' : 'Redefinir Senha'}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setStep(1)} 
                    className="w-full text-sm text-gray-400 hover:text-primary transition-colors"
                  >
                    Voltar
                  </button>
                </form>
              )}
            </>
          )}

          {!success && (
            <div className="text-center">
              <Link to="/login" className="text-sm text-primary font-bold hover:underline">
                Voltar para o Login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecoverAccount;
