import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  ArrowUpCircle, 
  ArrowDownCircle,
  AlertCircle,
  ShoppingBag,
  Calendar,
  Handshake,
  BarChart3,
  PieChart as PieChartIcon,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Transaction, Event, Product, Sponsorship, Category } from '../types';

const COLORS = ['#0E8F63', '#39B98A', '#8EDBC0', '#2B2B2B'];

const StatCard = ({ title, value, icon: Icon, color, subtitle }: any) => (
  <div className="glass-card p-6 flex flex-col gap-2">
    <div className="flex justify-between items-start">
      <div className="p-2 rounded-lg bg-background">
        <Icon className={color} size={24} />
      </div>
      {subtitle && <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{subtitle}</span>}
    </div>
    <div>
      <p className="text-sm text-gray-500 font-medium">{title}</p>
      <h3 className="text-2xl font-bold text-text-main">{value}</h3>
    </div>
  </div>
);

const Dashboard = () => {
  const { settings } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sponsorships, setSponsorships] = useState<Sponsorship[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    saldoAtual: 0,
    totalEntradas: 0,
    totalSaidas: 0,
    eventosAtivos: 0
  });

  useEffect(() => {
    const q = query(collection(db, 'movimentacoes'), orderBy('data', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      setTransactions(docs);
      setRecentTransactions(docs.slice(0, 5));

      const entradas = docs.filter(t => t.tipo === 'entrada').reduce((acc, t) => acc + t.valor, 0);
      const saidas = docs.filter(t => t.tipo === 'saida').reduce((acc, t) => acc + t.valor, 0);
      const saldoInicial = settings?.saldoInicial || 0;

      setStats(prev => ({
        ...prev,
        totalEntradas: entradas,
        totalSaidas: saidas,
        saldoAtual: saldoInicial + entradas - saidas
      }));
    });

    const unsubscribeEvents = onSnapshot(collection(db, 'eventos'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Event[];
      setEvents(data);
      setStats(prev => ({
        ...prev,
        eventosAtivos: data.filter(e => e.status === 'planejado' || e.status === 'em_venda').length
      }));
    });

    const unsubscribeCategories = onSnapshot(collection(db, 'categorias'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Category[];
      setCategories(data);
    });

    const unsubscribeProducts = onSnapshot(collection(db, 'produtos'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
      setProducts(data);
    });

    const unsubscribeSponsorships = onSnapshot(collection(db, 'patrocinios'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Sponsorship[];
      setSponsorships(data);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      unsubscribeEvents();
      unsubscribeCategories();
      unsubscribeProducts();
      unsubscribeSponsorships();
    };
  }, [settings]);

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Prepare chart data
  const chartData = transactions.reduce((acc: any[], t) => {
    const month = new Date(t.data).toLocaleString('pt-BR', { month: 'short' });
    const existing = acc.find(d => d.name === month);
    if (existing) {
      if (t.tipo === 'entrada') existing.entradas += t.valor;
      else existing.saidas += t.valor;
    } else {
      acc.push({ 
        name: month, 
        entradas: t.tipo === 'entrada' ? t.valor : 0, 
        saidas: t.tipo === 'saida' ? t.valor : 0 
      });
    }
    return acc;
  }, []).reverse().slice(-6);

  const pieData = transactions
    .filter(t => t.tipo === 'entrada')
    .reduce((acc: any[], t) => {
      const category = categories.find(c => c.id === t.categoriaId);
      const categoryName = category ? category.nome : (t.categoria || 'Outros');
      
      const existing = acc.find(d => d.name === categoryName);
      if (existing) existing.value += t.valor;
      else acc.push({ name: categoryName, value: t.valor });
      return acc;
    }, [])
    .sort((a, b) => b.value - a.value)
    .slice(0, 4);

  return (
    <div className="space-y-6 lg:space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold text-text-main">Visão Geral</h2>
          <p className="text-gray-500 text-sm lg:text-base">Bem-vindo ao painel financeiro da Brutamed.</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <div className="bg-white px-4 py-2 rounded-lg border border-highlight/30 text-sm font-medium flex-1 sm:flex-none text-center">
            Gestão 2024/25
          </div>
        </div>
      </header>

      {/* Financial Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <StatCard 
          title="Saldo Atual" 
          value={formatCurrency(stats.saldoAtual)} 
          icon={Wallet} 
          color="text-primary"
          subtitle="Disponível"
        />
        <StatCard 
          title="Eventos Ativos" 
          value={stats.eventosAtivos} 
          icon={Calendar} 
          color="text-highlight"
          subtitle="Planejados"
        />
        <StatCard 
          title="Total Entradas" 
          value={formatCurrency(stats.totalEntradas)} 
          icon={ArrowUpCircle} 
          color="text-secondary"
          subtitle="Acumulado"
        />
        <StatCard 
          title="Total Saídas" 
          value={formatCurrency(stats.totalSaidas)} 
          icon={ArrowDownCircle} 
          color="text-danger"
          subtitle="Acumulado"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 glass-card p-4 lg:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-2">
            <h4 className="font-bold text-lg">Fluxo de Caixa Mensal</h4>
            <div className="flex gap-4 text-[10px] lg:text-xs font-medium">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-primary"></div>
                <span>Entradas</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-danger"></div>
                <span>Saídas</span>
              </div>
            </div>
          </div>
          <div className="h-[250px] lg:h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData.length > 0 ? chartData : [{name: 'Sem dados', entradas: 0, saidas: 0}]}>
                <defs>
                  <linearGradient id="colorEntradas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0E8F63" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#0E8F63" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fontSize: 10}} 
                  interval={0}
                />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                <Tooltip />
                <Area type="monotone" dataKey="entradas" stroke="#0E8F63" fillOpacity={1} fill="url(#colorEntradas)" strokeWidth={3} />
                <Area type="monotone" dataKey="saidas" stroke="#E45858" fill="transparent" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Categories Chart */}
        <div className="glass-card p-4 lg:p-6">
          <h4 className="font-bold text-lg mb-6">Entradas por Categoria</h4>
          <div className="h-[200px] lg:h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData.length > 0 ? pieData : [{name: 'Sem dados', value: 1}]}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                  {pieData.length === 0 && <Cell fill="#f0f0f0" />}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {pieData.map((item, index) => (
              <div key={item.name} className="flex justify-between items-center text-xs lg:text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index] }}></div>
                  <span className="text-gray-600">{item.name}</span>
                </div>
                <span className="font-bold">{((item.value / stats.totalEntradas) * 100).toFixed(1)}%</span>
              </div>
            ))}
            {pieData.length === 0 && <p className="text-center text-xs text-gray-400">Nenhuma entrada registrada</p>}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 lg:p-6 border-b border-highlight/20 flex justify-between items-center">
          <h4 className="font-bold text-lg">Últimas Movimentações</h4>
          <button className="text-primary text-sm font-semibold hover:underline">Ver todas</button>
        </div>
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-background/50 text-[10px] lg:text-xs uppercase text-gray-500 font-bold">
              <tr>
                <th className="px-4 lg:px-6 py-4">Descrição</th>
                <th className="px-4 lg:px-6 py-4">Categoria</th>
                <th className="px-4 lg:px-6 py-4">Data</th>
                <th className="px-4 lg:px-6 py-4">Valor</th>
                <th className="px-4 lg:px-6 py-4">Usuário</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-highlight/10">
              {recentTransactions.length > 0 ? recentTransactions.map((row, i) => (
                <tr key={i} className="hover:bg-background/30 transition-colors">
                  <td className="px-4 lg:px-6 py-4 font-medium text-sm lg:text-base">{row.descricao}</td>
                  <td className="px-4 lg:px-6 py-4 text-xs lg:text-sm text-gray-500">{row.categoria}</td>
                  <td className="px-4 lg:px-6 py-4 text-xs lg:text-sm text-gray-500">
                    {new Date(row.data).toLocaleDateString('pt-BR')}
                  </td>
                  <td className={`px-4 lg:px-6 py-4 font-bold text-sm lg:text-base ${row.tipo === 'entrada' ? 'text-primary' : 'text-danger'}`}>
                    {row.tipo === 'entrada' ? '+' : '-'} {formatCurrency(row.valor)}
                  </td>
                  <td className="px-4 lg:px-6 py-4">
                    <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-[9px] lg:text-[10px] font-bold uppercase">
                      {row.usuarioNome}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    Nenhuma movimentação registrada ainda.
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

export default Dashboard;
