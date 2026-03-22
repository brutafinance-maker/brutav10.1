import React, { useState, useEffect } from 'react';
import { Eye, User, Clock, Shield, AlertTriangle } from 'lucide-react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { AuditLog } from '../../types';

interface ResetLog {
  id: string;
  tipo: string;
  realizadoPorId: string;
  realizadoPorNome: string;
  data: string;
  descricao: string;
}

const AuditoriaComponent = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [resetLogs, setResetLogs] = useState<ResetLog[]>([]);
  const [stats, setStats] = useState({
    acessosHoje: 0,
    usuariosAtivos: 0
  });

  useEffect(() => {
    const auditoriaQuery = query(collection(db, 'auditoria'), orderBy('data', 'desc'));
    const unsubscribeFirestore = onSnapshot(auditoriaQuery, (snapshot) => {
      const resets = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ResetLog[];
      setResetLogs(resets);
    });

    return () => {
      unsubscribeFirestore();
    };
  }, []);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('pt-BR');
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <header>
        <h2 className="text-2xl lg:text-3xl font-bold text-text-main">Sistema de Auditoria</h2>
        <p className="text-gray-500 text-sm lg:text-base">Rastreabilidade completa de todas as ações no sistema.</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="glass-card p-4 lg:p-6 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <Eye size={24} />
          </div>
          <div>
            <p className="text-[10px] lg:text-xs font-bold text-gray-400 uppercase">Acessos Hoje</p>
            <h3 className="text-xl lg:text-2xl font-bold">{stats.acessosHoje}</h3>
          </div>
        </div>
        <div className="glass-card p-4 lg:p-6 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-100 text-blue-600">
            <User size={24} />
          </div>
          <div>
            <p className="text-[10px] lg:text-xs font-bold text-gray-400 uppercase">Usuários Ativos (Hoje)</p>
            <h3 className="text-xl lg:text-2xl font-bold">{stats.usuariosAtivos}</h3>
          </div>
        </div>
        <div className="glass-card p-4 lg:p-6 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-danger/10 text-danger">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-[10px] lg:text-xs font-bold text-gray-400 uppercase">Resets do Sistema</p>
            <h3 className="text-xl lg:text-2xl font-bold">{resetLogs.length}</h3>
          </div>
        </div>
      </div>

      {resetLogs.length > 0 && (
        <div className="glass-card overflow-hidden border-danger/20">
          <div className="p-4 lg:p-6 border-b border-danger/20 bg-danger/5">
            <h4 className="font-bold text-base lg:text-lg text-danger flex items-center gap-2">
              <AlertTriangle size={20} />
              Histórico de Resets (Permanente)
            </h4>
          </div>
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full text-left min-w-[600px]">
              <thead className="bg-background/50 text-[10px] lg:text-xs uppercase text-gray-500 font-bold">
                <tr>
                  <th className="px-4 lg:px-6 py-4">Data/Hora</th>
                  <th className="px-4 lg:px-6 py-4">Diretor</th>
                  <th className="px-4 lg:px-6 py-4">Descrição</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-highlight/10">
                {resetLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-background/30 transition-colors bg-danger/5">
                    <td className="px-4 lg:px-6 py-4 text-xs lg:text-sm text-gray-600 font-medium whitespace-nowrap">
                      {new Date(log.data).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 lg:px-6 py-4">
                      <div className="flex items-center gap-2 lg:gap-3">
                        <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-danger/20 flex items-center justify-center text-[10px] lg:text-xs font-bold text-danger">
                          {log.realizadoPorNome.charAt(0)}
                        </div>
                        <span className="font-bold text-xs lg:text-sm text-danger">{log.realizadoPorNome}</span>
                      </div>
                    </td>
                    <td className="px-4 lg:px-6 py-4 text-xs lg:text-sm text-gray-600">
                      {log.descricao}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <div className="p-4 lg:p-6 border-b border-highlight/20">
          <h4 className="font-bold text-base lg:text-lg">Logs de Atividade Recentes</h4>
        </div>
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-background/50 text-[10px] lg:text-xs uppercase text-gray-500 font-bold">
              <tr>
                <th className="px-4 lg:px-6 py-4">Usuário</th>
                <th className="px-4 lg:px-6 py-4">Ação</th>
                <th className="px-4 lg:px-6 py-4">Módulo</th>
                <th className="px-4 lg:px-6 py-4">Horário</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-highlight/10">
              {logs.length > 0 ? logs.map((log, i) => (
                <tr key={i} className="hover:bg-background/30 transition-colors">
                  <td className="px-4 lg:px-6 py-4">
                    <div className="flex items-center gap-2 lg:gap-3">
                      <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-gray-100 flex items-center justify-center text-[10px] lg:text-xs font-bold text-gray-500">
                        {log.usuario.charAt(0)}
                      </div>
                      <span className="font-medium text-xs lg:text-sm">{log.usuario}</span>
                    </div>
                  </td>
                  <td className="px-4 lg:px-6 py-4">
                    <span className={`px-2 py-1 rounded-lg text-[9px] lg:text-[10px] font-bold uppercase ${
                      log.acao.includes('Visualizou') ? 'bg-gray-100 text-gray-500' : 'bg-primary/10 text-primary'
                    }`}>
                      {log.acao}
                    </span>
                  </td>
                  <td className="px-4 lg:px-6 py-4 text-xs lg:text-sm text-gray-500">{log.modulo}</td>
                  <td className="px-4 lg:px-6 py-4 text-xs lg:text-sm text-gray-500 flex items-center gap-2">
                    <Clock size={14} />
                    {formatTime(log.horario as any)}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                    Nenhum log registrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuditoriaComponent;
