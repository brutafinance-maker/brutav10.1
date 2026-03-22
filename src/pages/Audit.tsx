import React, { useState, useEffect } from 'react';
import { History, Eye, User, Clock, Shield } from 'lucide-react';

import { AuditLog } from '../types';

const Audit = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState({
    acessosHoje: 0,
    usuariosAtivos: 0
  });

  useEffect(() => {
    // This component now relies on data provided by other components.
    // The rtdb logic has been removed.
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
          <div className="p-3 rounded-xl bg-highlight/20 text-primary">
            <Shield size={24} />
          </div>
          <div>
            <p className="text-[10px] lg:text-xs font-bold text-gray-400 uppercase">Integridade</p>
            <h3 className="text-xl lg:text-2xl font-bold">100%</h3>
          </div>
        </div>
      </div>

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

export default Audit;
