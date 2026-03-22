import React, { useState, useEffect } from 'react';
import { FileText, Download, Filter, Calendar, TrendingUp, TrendingDown } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Transaction, Category } from '../types';

const Statements = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    mes: new Date().getMonth() + 1,
    ano: new Date().getFullYear()
  });

  useEffect(() => {
    const q = query(collection(db, 'movimentacoes'), orderBy('data', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Transaction[];
      
      // Client-side filtering for simplicity in this demo
      const filtered = data.filter(t => {
        const d = new Date(t.data);
        return (d.getMonth() + 1) === filter.mes && d.getFullYear() === filter.ano;
      });
      
      setTransactions(filtered);
      setLoading(false);
    });

    const unsubscribeCategories = onSnapshot(collection(db, 'categorias'), (snapshot) => {
      const categoriesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];
      setCategories(categoriesData);
    });

    return () => {
      unsubscribe();
      unsubscribeCategories();
    };
  }, [filter]);

  const totalEntradas = transactions
    .filter(t => t.tipo === 'entrada')
    .reduce((acc, curr) => acc + curr.valor, 0);

  const totalSaidas = transactions
    .filter(t => t.tipo === 'saida')
    .reduce((acc, curr) => acc + curr.valor, 0);

  const saldoPeriodo = totalEntradas - totalSaidas;

  const handleExport = () => {
    // In a real app, this would generate a PDF or CSV
    alert('Funcionalidade de exportação será implementada em breve.');
  };

  const getCategoryName = (id?: string, fallback?: string) => {
    if (!id) return fallback || 'Sem Categoria';
    const category = categories.find(c => c.id === id);
    return category ? category.nome : (fallback || 'Outros');
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold text-text-main">Extratos Financeiros</h2>
          <p className="text-gray-500 text-sm lg:text-base">Gere relatórios detalhados para prestação de contas.</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center justify-center gap-2 bg-text-main text-white px-4 py-2 rounded-xl font-bold hover:bg-text-main/90 transition-all shadow-lg"
        >
          <Download size={20} />
          Exportar PDF
        </button>
      </header>

      <div className="glass-card p-6 flex flex-wrap gap-6 items-end">
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-400 uppercase">Mês</label>
          <select
            className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-2 outline-none focus:border-primary transition-all"
            value={filter.mes}
            onChange={(e) => setFilter({ ...filter, mes: Number(e.target.value) })}
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(0, i).toLocaleString('pt-BR', { month: 'long' })}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-400 uppercase">Ano</label>
          <select
            className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-2 outline-none focus:border-primary transition-all"
            value={filter.ano}
            onChange={(e) => setFilter({ ...filter, ano: Number(e.target.value) })}
          >
            {[2024, 2025, 2026].map(ano => (
              <option key={ano} value={ano}>{ano}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 border-l-4 border-green-500">
          <div className="flex items-center gap-3 text-green-600 mb-2">
            <TrendingUp size={20} />
            <span className="text-xs font-bold uppercase">Total Entradas</span>
          </div>
          <h3 className="text-2xl font-bold">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalEntradas)}
          </h3>
        </div>
        <div className="glass-card p-6 border-l-4 border-red-500">
          <div className="flex items-center gap-3 text-red-600 mb-2">
            <TrendingDown size={20} />
            <span className="text-xs font-bold uppercase">Total Saídas</span>
          </div>
          <h3 className="text-2xl font-bold">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalSaidas)}
          </h3>
        </div>
        <div className="glass-card p-6 border-l-4 border-primary">
          <div className="flex items-center gap-3 text-primary mb-2">
            <FileText size={20} />
            <span className="text-xs font-bold uppercase">Saldo do Período</span>
          </div>
          <h3 className={`text-2xl font-bold ${saldoPeriodo >= 0 ? 'text-text-main' : 'text-red-500'}`}>
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(saldoPeriodo)}
          </h3>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-4 lg:p-6 border-b border-highlight/20">
          <h4 className="font-bold text-base lg:text-lg">Detalhamento do Período</h4>
        </div>
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-background/50 text-[10px] lg:text-xs uppercase text-gray-500 font-bold">
              <tr>
                <th className="px-4 lg:px-6 py-4">Data</th>
                <th className="px-4 lg:px-6 py-4">Descrição</th>
                <th className="px-4 lg:px-6 py-4">Categoria</th>
                <th className="px-4 lg:px-6 py-4 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-highlight/10">
              {loading ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-400">Carregando...</td></tr>
              ) : transactions.length > 0 ? (
                transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-background/30 transition-colors">
                    <td className="px-4 lg:px-6 py-4 text-xs lg:text-sm text-gray-500">
                      {new Date(t.data).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 lg:px-6 py-4">
                      <span className="font-medium text-xs lg:text-sm">{t.descricao}</span>
                    </td>
                    <td className="px-4 lg:px-6 py-4">
                      <span className="px-2 py-1 rounded-lg bg-gray-100 text-gray-500 text-[10px] font-bold uppercase">
                        {getCategoryName(t.categoriaId, t.categoria)}
                      </span>
                    </td>
                    <td className={`px-4 lg:px-6 py-4 text-right font-bold text-xs lg:text-sm ${
                      t.tipo === 'entrada' ? 'text-green-600' : 'text-red-500'
                    }`}>
                      {t.tipo === 'entrada' ? '+' : '-'} {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.valor)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                    Nenhuma movimentação no período selecionado.
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

export default Statements;
