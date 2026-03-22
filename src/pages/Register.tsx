import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { UserPlus, User, Phone, Shield, Mail, Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Register = () => {
  const { user, profile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [fraseSeguranca, setFraseSeguranca] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // If user is already logged in with Google but has no profile, we show only the extra fields
  const isCompletingGoogle = !!user && !profile;

  useEffect(() => {
    if (user && profile) {
      navigate('/');
    }
  }, [user, profile, navigate]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let currentUser = user;

      if (!isCompletingGoogle) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        currentUser = userCredential.user;
        await updateProfile(currentUser, { displayName: nome });
      }

      if (currentUser) {
        await setDoc(doc(db, 'usuarios', currentUser.uid), {
          uid: currentUser.uid,
          nome: isCompletingGoogle ? currentUser.displayName : nome,
          email: currentUser.email,
          telefone,
          fraseSeguranca: fraseSeguranca.toLowerCase().trim(),
          cargo: 'Membro',
          diretorFinanceiro: false, // Default to false, must be manually updated in DB or first user logic
          dataCriacao: new Date().toISOString(),
          setupCompleto: true
        });
        navigate('/');
      }
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está em uso.');
      } else {
        setError('Erro ao criar conta. Tente novamente.');
      }
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
          <p className="text-gray-500 mt-2">Cadastro de Novo Usuário</p>
        </div>

        <div className="glass-card p-8 space-y-6">
          <h2 className="text-2xl font-bold text-center">
            {isCompletingGoogle ? 'Complete seu Cadastro' : 'Criar Conta'}
          </h2>

          <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
            <p className="text-xs text-primary font-bold flex items-center gap-2">
              <Shield size={16} />
              AVISO IMPORTANTE
            </p>
            <p className="text-xs text-gray-600 mt-1">
              A frase de segurança será usada para recuperação da conta. Ela não pode ser esquecida.
            </p>
          </div>

          {error && (
            <div className="bg-danger/10 text-danger p-4 rounded-xl flex items-center gap-3 text-sm">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            {!isCompletingGoogle && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Nome Completo</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      required
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-highlight/30 outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="Seu nome completo"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">E-mail</label>
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

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-highlight/30 outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase">Telefone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="tel"
                  required
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-highlight/30 outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase">Frase de Segurança</label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  required
                  value={fraseSeguranca}
                  onChange={(e) => setFraseSeguranca(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-highlight/30 outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Ex: O céu é azul em Cascavel"
                />
              </div>
            </div>

            <button
              disabled={loading}
              className="w-full btn-primary justify-center py-3 text-lg"
            >
              {loading ? 'Processando...' : (
                <>
                  <UserPlus size={20} />
                  {isCompletingGoogle ? 'Finalizar Cadastro' : 'Criar Minha Conta'}
                </>
              )}
            </button>
          </form>

          {!isCompletingGoogle && (
            <p className="text-center text-sm text-gray-500">
              Já tem uma conta?{' '}
              <button onClick={() => navigate('/login')} className="text-primary font-bold hover:underline">
                Faça Login
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Register;
