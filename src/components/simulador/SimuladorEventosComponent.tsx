import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  DollarSign, 
  Info, 
  Save, 
  Trash2, 
  FileText, 
  Plus, 
  ChevronRight, 
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Download,
  History,
  ArrowRight,
  Target,
  BarChart3,
  LayoutDashboard,
  Loader2,
  Calendar,
  Wallet,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Lightbulb,
  PartyPopper,
  Dumbbell,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';
import { simulacoesService } from '../../services/simulacoesService';
import { Simulation, SimulationType, SimulationPeriod, MonthlyValue, Transaction } from '../../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  ReferenceLine
} from 'recharts';

const SimuladorEventosComponent = () => {
  const { user } = useAuth();
  const [view, setView] = useState<'list' | 'form'>('list');
  const [loading, setLoading] = useState(false);
  const [savedSimulations, setSavedSimulations] = useState<Simulation[]>([]);
  const [step, setStep] = useState(1);
  const chartRef = useRef<HTMLDivElement>(null);
  
  // Simulation State
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<SimulationType>('estrategico');
  const [periodo, setPeriodo] = useState<SimulationPeriod>('trimestral');
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [saldoAtual, setSaldoAtual] = useState<number>(0);
  const [valoresMensais, setValoresMensais] = useState<MonthlyValue[]>([]);

  useEffect(() => {
    if (user) {
      loadSimulations();
    }
  }, [user]);

  const loadSimulations = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await simulacoesService.getSimulationsByUser(user.uid);
      setSavedSimulations(data);
    } catch (error) {
      console.error('Erro ao carregar simulações:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMesesCount = (p: SimulationPeriod) => {
    switch (p) {
      case 'mensal': return 1;
      case 'trimestral': return 3;
      case 'semestral': return 6;
      case 'anual': return 12;
      default: return 1;
    }
  };

  const handleNewSimulation = () => {
    setNome('');
    setTipo('estrategico');
    setPeriodo('trimestral');
    setAno(new Date().getFullYear());
    setSaldoAtual(0);
    setValoresMensais(Array.from({ length: 3 }, (_, i) => ({
      mes: i + 1,
      receita: 0,
      despesa: 0,
      valorAnterior: 0,
      descricao: `Mês ${i + 1}`
    })));
    setStep(1);
    setView('form');
  };

  const updatePeriod = (p: SimulationPeriod) => {
    setPeriodo(p);
    const count = getMesesCount(p);
    setValoresMensais(Array.from({ length: count }, (_, i) => ({
      mes: i + 1,
      receita: 0,
      despesa: 0,
      valorAnterior: 0,
      descricao: `Mês ${i + 1}`
    })));
  };

  const handleSave = async () => {
    if (!user || !nome) return;
    setLoading(true);
    try {
      const results = calculateResults();
      const simulationToSave: Omit<Simulation, 'id'> = {
        nome,
        tipo,
        periodo,
        ano,
        saldoAtual,
        valoresMensais,
        resultado: results,
        criadoPor: user.uid,
        data: new Date().toISOString()
      };

      await simulacoesService.saveSimulation(simulationToSave);
      await loadSimulations();
      setView('list');
    } catch (error) {
      console.error('Erro ao salvar:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta simulação?')) return;
    try {
      await simulacoesService.deleteSimulation(id);
      await loadSimulations();
    } catch (error) {
      console.error('Erro ao excluir:', error);
    }
  };

  const calculateResults = () => {
    const reservaMinima = saldoAtual * 0.2;
    const valorDisponivel = saldoAtual - reservaMinima;
    
    let receitasTotais = 0;
    let despesasTotais = 0;
    let totalAnterior = 0;
    const evolucaoSaldo: { mes: number; saldo: number; label: string }[] = [];
    let saldoAcumulado = saldoAtual;

    valoresMensais.forEach((v) => {
      receitasTotais += v.receita;
      despesasTotais += v.despesa;
      totalAnterior += v.valorAnterior;
      
      const resultadoMes = v.receita - v.despesa;
      saldoAcumulado += resultadoMes;
      
      evolucaoSaldo.push({ 
        mes: v.mes, 
        saldo: saldoAcumulado,
        label: `Mês ${v.mes}`
      });
    });

    const diferencaTotal = (receitasTotais - despesasTotais) - totalAnterior;
    const mediaDiferenca = diferencaTotal / (valoresMensais.length || 1);
    const capacidadeDeGasto = saldoAtual + receitasTotais - despesasTotais;
    
    const viavel = capacidadeDeGasto >= reservaMinima;

    // Análise Automática
    const analise: string[] = [];
    if (saldoAcumulado > saldoAtual) {
      analise.push('✔ Projeção de caixa crescente (superávit)');
    } else if (saldoAcumulado < saldoAtual) {
      analise.push('⚠️ Projeção de caixa decrescente (prejuízo)');
    }

    if (saldoAcumulado < 0) {
      analise.push('❌ Saldo negativo projetado para o final do período');
    } else if (saldoAcumulado < reservaMinima) {
      analise.push('⚠️ Saldo final abaixo da reserva mínima recomendada');
    } else {
      analise.push('✔ Caixa se mantém positivo e acima da reserva');
    }

    // Check for specific drops
    valoresMensais.forEach((v, i) => {
      if (v.receita < v.despesa) {
        analise.push(`⚠️ Queda no mês ${v.mes}: despesas superam receitas`);
      }
    });

    // Sugestões Inteligentes
    const sugestoes: string[] = [];
    if (despesasTotais > receitasTotais) {
      sugestoes.push('• Reduzir custos operacionais ou gastos fixos da associação');
      sugestoes.push('• Criar novos eventos temáticos para gerar receita extra');
    }
    if (receitasTotais < totalAnterior) {
      sugestoes.push('• Avaliar por que a receita projetada é menor que o histórico real');
      sugestoes.push('• Ajustar investimento esportivo para o próximo período');
    }
    if (!viavel) {
      sugestoes.push('• Aumentar preço de ingressos ou produtos da atlética');
      sugestoes.push('• Buscar novos patrocínios estratégicos para cobrir o déficit');
    }

    return {
      reservaMinima,
      valorDisponivel,
      capacidadeDeGasto,
      receitasTotais,
      despesasTotais,
      evolucaoSaldo,
      diferencaTotal,
      mediaDiferenca,
      viavel,
      analise,
      sugestoes
    };
  };

  const results = calculateResults();

  const generatePDF = async () => {
    const doc = new jsPDF();
    const res = calculateResults();

    // Header
    doc.setFontSize(22);
    doc.setTextColor(14, 143, 99);
    doc.text(`Simulação Financeira - ${nome}`, 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Período: ${periodo.toUpperCase()} | Ano: ${ano} | Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 30);

    let yPos = 45;

    // Resumo Financeiro
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Resumo de Capacidade Financeira', 14, yPos);
    yPos += 10;

    autoTable(doc, {
      startY: yPos,
      head: [['Descrição', 'Valor']],
      body: [
        ['Saldo Inicial Informado', `R$ ${saldoAtual.toFixed(2)}`],
        ['Receitas Previstas', `R$ ${res.receitasTotais.toFixed(2)}`],
        ['Despesas Previstas', `R$ ${res.despesasTotais.toFixed(2)}`],
        ['Reserva Mínima (20%)', `R$ ${res.reservaMinima.toFixed(2)}`],
        ['Valor Disponível p/ Gasto', `R$ ${res.valorDisponivel.toFixed(2)}`],
        ['Capacidade de Gasto Total', `R$ ${res.capacidadeDeGasto.toFixed(2)}`],
        ['Resultado do Período', `R$ ${(res.receitasTotais - res.despesasTotais).toFixed(2)}`]
      ],
      theme: 'striped',
      headStyles: { fillColor: [14, 143, 99] }
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    // Detalhamento Mensal
    doc.text('Detalhamento Mês a Mês', 14, yPos);
    yPos += 5;

    const monthlyData = valoresMensais.map(v => [
      `Mês ${v.mes}`,
      `R$ ${v.receita.toFixed(2)}`,
      `R$ ${v.despesa.toFixed(2)}`,
      `R$ ${v.valorAnterior.toFixed(2)}`,
      `R$ ${(v.receita - v.despesa - v.valorAnterior).toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Mês', 'Receita', 'Despesa', 'Histórico', 'Diferença']],
      body: monthlyData,
      theme: 'grid',
      headStyles: { fillColor: [14, 143, 99] }
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    // Análise e Sugestões
    doc.text('Análise Estratégica', 14, yPos);
    yPos += 10;
    doc.setFontSize(11);
    res.analise.forEach(a => {
      if (yPos > 270) { doc.addPage(); yPos = 20; }
      doc.text(a, 14, yPos);
      yPos += 7;
    });

    yPos += 5;
    doc.setFontSize(14);
    doc.text('Sugestões de Melhoria', 14, yPos);
    yPos += 10;
    doc.setFontSize(11);
    res.sugestoes.forEach(s => {
      if (yPos > 270) { doc.addPage(); yPos = 20; }
      doc.text(s, 14, yPos);
      yPos += 7;
    });

    // Chart Capture (Optional, if chartRef is available)
    if (chartRef.current) {
      try {
        const canvas = await html2canvas(chartRef.current);
        const imgData = canvas.toDataURL('image/png');
        doc.addPage();
        doc.setFontSize(14);
        doc.text('Gráfico de Evolução de Saldo', 14, 20);
        doc.addImage(imgData, 'PNG', 14, 30, 180, 100);
      } catch (e) {
        console.error('Erro ao capturar gráfico:', e);
      }
    }

    doc.save(`Simulacao_${nome.replace(/\s+/g, '_')}.pdf`);
  };

  const renderList = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-text-main flex items-center gap-2">
            <Calculator className="text-primary" />
            Simulador Estratégico
          </h2>
          <p className="text-gray-500 text-sm">Planeje o futuro financeiro da sua atlética com dados reais.</p>
        </div>
        <button onClick={handleNewSimulation} className="btn-primary px-6 py-2 rounded-xl flex items-center gap-2 font-bold">
          <Plus size={20} /> Nova Simulação
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary" size={40} />
        </div>
      ) : savedSimulations.length === 0 ? (
        <div className="glass-card p-20 text-center space-y-4">
          <div className="bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
            <Target size={40} className="text-primary" />
          </div>
          <h3 className="text-xl font-bold">Nenhuma simulação salva</h3>
          <p className="text-gray-500 max-w-md mx-auto">Comece agora a planejar seus próximos meses e garanta a saúde financeira da associação.</p>
          <button onClick={handleNewSimulation} className="btn-primary px-8 py-3 rounded-xl font-bold">
            Criar Primeira Simulação
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {savedSimulations.map((sim) => (
            <motion.div 
              key={sim.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-6 hover:shadow-xl transition-all border-l-4 border-primary group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-primary/10 rounded-xl text-primary">
                  <TrendingUp size={24} />
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleDelete(sim.id!)} className="p-2 text-danger hover:bg-danger/10 rounded-lg">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              <h3 className="font-bold text-lg mb-1">{sim.nome}</h3>
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
                <Calendar size={14} />
                <span>{new Date(sim.data).toLocaleDateString()}</span>
                <span className="px-2 py-0.5 bg-highlight/10 rounded-full uppercase font-bold">{sim.periodo}</span>
              </div>
              <div className="pt-4 border-t border-highlight/10 flex justify-between items-center">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Saldo Projetado</p>
                  <p className={`font-bold ${sim.resultado.viavel ? 'text-primary' : 'text-danger'}`}>
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sim.resultado.evolucaoSaldo[sim.resultado.evolucaoSaldo.length - 1].saldo)}
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setNome(sim.nome);
                    setPeriodo(sim.periodo);
                    setAno(sim.ano || new Date().getFullYear());
                    setSaldoAtual(sim.saldoAtual);
                    setValoresMensais(sim.valoresMensais);
                    setStep(3);
                    setView('form');
                  }}
                  className="p-2 bg-primary text-white rounded-lg"
                >
                  <ArrowRight size={18} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );

  const renderStep1 = () => (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h3 className="text-2xl font-black">Configuração Inicial</h3>
        <p className="text-gray-500">Defina os parâmetros básicos para sua projeção financeira.</p>
      </div>

      <div className="glass-card p-8 space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-400 uppercase flex items-center gap-2">
            <FileText size={16} className="text-primary" />
            Nome da Simulação
          </label>
          <input
            type="text"
            placeholder="Ex: Planejamento 1º Semestre 2026"
            className="w-full bg-background/50 border border-highlight/20 rounded-2xl px-6 py-4 outline-none focus:border-primary transition-all text-lg font-medium"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-400 uppercase flex items-center gap-2">
              <Wallet size={16} className="text-primary" />
              Saldo Atual em Caixa (R$)
            </label>
            <input
              type="number"
              placeholder="0,00"
              className="w-full bg-background/50 border border-highlight/20 rounded-2xl px-6 py-4 outline-none focus:border-primary transition-all text-lg font-medium"
              value={saldoAtual || ''}
              onChange={(e) => setSaldoAtual(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-400 uppercase flex items-center gap-2">
              <Calendar size={16} className="text-primary" />
              Período de Análise
            </label>
            <select
              className="w-full bg-background/50 border border-highlight/20 rounded-2xl px-6 py-4 outline-none focus:border-primary transition-all text-lg font-medium appearance-none"
              value={periodo}
              onChange={(e) => updatePeriod(e.target.value as SimulationPeriod)}
            >
              <option value="mensal">Mensal (1 mês)</option>
              <option value="trimestral">Trimestral (3 meses)</option>
              <option value="semestral">Semestral (6 meses)</option>
              <option value="anual">Anual (12 meses)</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-400 uppercase flex items-center gap-2">
            <Calendar size={16} className="text-primary" />
            Ano de Referência
          </label>
          <input
            type="number"
            className="w-full bg-background/50 border border-highlight/20 rounded-2xl px-6 py-4 outline-none focus:border-primary transition-all text-lg font-medium"
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="flex justify-between items-center pt-4">
        <button onClick={() => setView('list')} className="text-gray-400 font-bold hover:text-text-main transition-colors">
          Cancelar
        </button>
        <button 
          onClick={() => setStep(2)} 
          disabled={!nome || saldoAtual === undefined}
          className="btn-primary px-10 py-4 rounded-2xl font-bold flex items-center gap-2 disabled:opacity-50"
        >
          Próximo Passo <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h3 className="text-2xl font-black">Valores Mensais</h3>
        <p className="text-gray-500">Insira as projeções e o histórico para cada mês do período.</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {valoresMensais.map((v, index) => (
          <motion.div 
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="glass-card p-6 grid grid-cols-1 md:grid-cols-4 gap-6 items-center"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                {v.mes}
              </div>
              <div>
                <p className="font-bold text-lg">Mês {v.mes}</p>
                <p className="text-[10px] text-gray-400 uppercase font-bold">Projeção Mensal</p>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-primary uppercase">Receita Prevista (R$)</label>
              <input
                type="number"
                className="w-full bg-primary/5 border border-primary/10 rounded-xl px-4 py-2 outline-none focus:border-primary transition-all font-medium"
                value={v.receita || ''}
                onChange={(e) => {
                  const newValues = [...valoresMensais];
                  newValues[index].receita = Number(e.target.value);
                  setValoresMensais(newValues);
                }}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-danger uppercase">Despesa Prevista (R$)</label>
              <input
                type="number"
                className="w-full bg-danger/5 border border-danger/10 rounded-xl px-4 py-2 outline-none focus:border-danger transition-all font-medium"
                value={v.despesa || ''}
                onChange={(e) => {
                  const newValues = [...valoresMensais];
                  newValues[index].despesa = Number(e.target.value);
                  setValoresMensais(newValues);
                }}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Resultado Histórico (R$)</label>
              <input
                type="number"
                className="w-full bg-background/30 border border-highlight/10 rounded-xl px-4 py-2 outline-none focus:border-primary transition-all font-medium"
                value={v.valorAnterior || ''}
                onChange={(e) => {
                  const newValues = [...valoresMensais];
                  newValues[index].valorAnterior = Number(e.target.value);
                  setValoresMensais(newValues);
                }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex justify-between items-center pt-4">
        <button onClick={() => setStep(1)} className="text-gray-400 font-bold hover:text-text-main transition-colors flex items-center gap-2">
          <ChevronLeft size={20} /> Voltar
        </button>
        <button 
          onClick={() => setStep(3)} 
          className="btn-primary px-10 py-4 rounded-2xl font-bold flex items-center gap-2"
        >
          Ver Análise Completa <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );

  const renderStep3 = () => {
    const res = calculateResults();
    
    return (
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="text-3xl font-black text-text-main">
              {periodo === 'trimestral' ? `Simulação Financeira - ${Math.ceil(valoresMensais[0].mes / 3)}º Trimestre ${ano}` : 
               periodo === 'anual' ? `Simulação Anual ${ano} - Atlética` : 
               `Simulação Financeira - ${nome}`}
            </h3>
            <p className="text-gray-500 font-medium">{nome} • {periodo.toUpperCase()}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={generatePDF} className="btn-secondary px-6 py-2 rounded-xl flex items-center gap-2 font-bold border border-highlight/20">
              <Download size={20} /> Exportar PDF
            </button>
            <button onClick={handleSave} className="btn-primary px-6 py-2 rounded-xl flex items-center gap-2 font-bold">
              <Save size={20} /> Salvar Simulação
            </button>
          </div>
        </div>

        {/* Dashboard de Métricas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="glass-card p-6 space-y-2">
            <div className="flex justify-between items-start">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Saldo Inicial</p>
              <Wallet size={18} className="text-primary" />
            </div>
            <h4 className="text-2xl font-black">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(saldoAtual)}
            </h4>
          </div>

          <div className="glass-card p-6 space-y-2">
            <div className="flex justify-between items-start">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Reserva Mínima (20%)</p>
              <Target size={18} className="text-blue-500" />
            </div>
            <h4 className="text-2xl font-black">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(res.reservaMinima)}
            </h4>
          </div>

          <div className="glass-card p-6 space-y-2">
            <div className="flex justify-between items-start">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Valor Disponível</p>
              <DollarSign size={18} className="text-emerald-500" />
            </div>
            <h4 className="text-2xl font-black">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(res.valorDisponivel)}
            </h4>
          </div>

          <div className="glass-card p-6 space-y-2">
            <div className="flex justify-between items-start">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Capacidade de Gasto</p>
              <TrendingUp size={18} className="text-purple-500" />
            </div>
            <h4 className="text-2xl font-black">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(res.capacidadeDeGasto)}
            </h4>
          </div>
        </div>

        {/* Status e Gráfico */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass-card p-8 space-y-6" ref={chartRef}>
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-lg flex items-center gap-2">
                <BarChart3 size={20} className="text-primary" />
                Evolução do Saldo Projetado
              </h4>
              <div className={`px-4 py-1.5 rounded-full text-xs font-black uppercase ${res.viavel ? 'bg-primary/10 text-primary' : 'bg-danger/10 text-danger'}`}>
                {res.viavel ? '✅ Planejamento Viável' : '⚠️ Planejamento Arriscado'}
              </div>
            </div>

            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={res.evolucaoSaldo}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis 
                    dataKey="label" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fontWeight: 600, fill: '#9CA3AF' }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fontWeight: 600, fill: '#9CA3AF' }}
                    tickFormatter={(value) => `R$ ${value}`}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                    formatter={(value: number) => [new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value), 'Saldo']}
                  />
                  <ReferenceLine y={res.reservaMinima} stroke="#3B82F6" strokeDasharray="3 3" label={{ position: 'right', value: 'Reserva', fill: '#3B82F6', fontSize: 10 }} />
                  <ReferenceLine y={0} stroke="#EF4444" strokeWidth={2} />
                  <Line 
                    type="monotone" 
                    dataKey="saldo" 
                    stroke="#0E8F63" 
                    strokeWidth={4} 
                    dot={{ r: 6, fill: '#0E8F63', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-card p-8 space-y-6">
            <h4 className="font-bold text-lg flex items-center gap-2">
              <Lightbulb size={20} className="text-primary" />
              Análise & Sugestões
            </h4>

            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Análise do Fluxo</p>
                <div className="space-y-2">
                  {res.analise.map((a, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm font-medium text-gray-700">
                      <div className="mt-1">
                        {a.startsWith('✔') ? <CheckCircle2 size={14} className="text-primary" /> : 
                         a.startsWith('⚠️') ? <AlertCircle size={14} className="text-warning" /> : 
                         <AlertCircle size={14} className="text-danger" />}
                      </div>
                      <span>{a.replace(/^[✔⚠️❌]\s*/, '')}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-highlight/10">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ações Recomendadas</p>
                <div className="space-y-2">
                  {res.sugestoes.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm font-medium text-gray-600 italic">
                      <ArrowRight size={14} className="text-primary mt-1" />
                      <span>{s.replace(/^•\s*/, '')}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Integração Total (Impacto por Módulo) */}
        <div className="glass-card p-8 space-y-6">
          <h4 className="font-bold text-lg flex items-center gap-2">
            <PieChart size={20} className="text-primary" />
            Impacto por Módulo (Integração Total)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-primary/5 rounded-2xl border border-primary/10 space-y-2">
              <div className="flex items-center gap-2 text-primary">
                <PartyPopper size={20} />
                <span className="font-bold">Eventos</span>
              </div>
              <p className="text-xs text-gray-500">Impacto direto no lucro projetado através de vendas de ingressos e produtos.</p>
              <p className="text-lg font-black text-primary">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(res.receitasTotais * 0.7)}
                <span className="text-[10px] font-normal ml-1">(Estimado)</span>
              </p>
            </div>
            <div className="p-6 bg-blue-500/5 rounded-2xl border border-blue-500/10 space-y-2">
              <div className="flex items-center gap-2 text-blue-500">
                <Dumbbell size={20} />
                <span className="font-bold">Esportes</span>
              </div>
              <p className="text-xs text-gray-500">Custos fixos com treinadores, quadras e materiais esportivos.</p>
              <p className="text-lg font-black text-blue-500">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(res.despesasTotais * 0.4)}
                <span className="text-[10px] font-normal ml-1">(Estimado)</span>
              </p>
            </div>
            <div className="p-6 bg-purple-500/5 rounded-2xl border border-purple-500/10 space-y-2">
              <div className="flex items-center gap-2 text-purple-500">
                <Users size={20} />
                <span className="font-bold">Associação</span>
              </div>
              <p className="text-xs text-gray-500">Manutenção administrativa e investimentos em novos projetos.</p>
              <p className="text-lg font-black text-purple-500">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(res.despesasTotais * 0.6)}
                <span className="text-[10px] font-normal ml-1">(Estimado)</span>
              </p>
            </div>
          </div>
        </div>

        {/* Tabela Comparativa */}
        <div className="glass-card p-8 space-y-6">
          <h4 className="font-bold text-lg flex items-center gap-2">
            <History size={20} className="text-primary" />
            Comparação com Histórico
          </h4>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-highlight/10">
                  <th className="pb-4 text-xs font-bold text-gray-400 uppercase">Mês</th>
                  <th className="pb-4 text-xs font-bold text-gray-400 uppercase">Receita</th>
                  <th className="pb-4 text-xs font-bold text-gray-400 uppercase">Despesa</th>
                  <th className="pb-4 text-xs font-bold text-gray-400 uppercase">Resultado</th>
                  <th className="pb-4 text-xs font-bold text-gray-400 uppercase">Histórico</th>
                  <th className="pb-4 text-xs font-bold text-gray-400 uppercase">Diferença</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-highlight/5">
                {valoresMensais.map((v, i) => {
                  const resultado = v.receita - v.despesa;
                  const diff = resultado - v.valorAnterior;
                  return (
                    <tr key={i} className="hover:bg-background/30 transition-colors">
                      <td className="py-4 font-bold">Mês {v.mes}</td>
                      <td className="py-4 font-medium text-primary">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v.receita)}</td>
                      <td className="py-4 font-medium text-danger">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v.despesa)}</td>
                      <td className={`py-4 font-bold ${resultado >= 0 ? 'text-primary' : 'text-danger'}`}>
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(resultado)}
                      </td>
                      <td className="py-4 font-medium text-gray-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v.valorAnterior)}</td>
                      <td className={`py-4 font-bold ${diff >= 0 ? 'text-primary' : 'text-danger'}`}>
                        {diff >= 0 ? '+' : ''}{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(diff)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-highlight/10 bg-background/50">
                  <td className="py-4 px-2 font-black uppercase text-xs">Total do Período</td>
                  <td className="py-4 font-black text-primary">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(res.receitasTotais)}
                  </td>
                  <td className="py-4 font-black text-danger">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(res.despesasTotais)}
                  </td>
                  <td className={`py-4 font-black ${res.receitasTotais - res.despesasTotais >= 0 ? 'text-primary' : 'text-danger'}`}>
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(res.receitasTotais - res.despesasTotais)}
                  </td>
                  <td className="py-4 font-black text-gray-400">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valoresMensais.reduce((acc, v) => acc + v.valorAnterior, 0))}
                  </td>
                  <td className={`py-4 font-black ${res.diferencaTotal >= 0 ? 'text-primary' : 'text-danger'}`}>
                    {res.diferencaTotal >= 0 ? '+' : ''}{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(res.diferencaTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="flex justify-between pt-4">
          <button onClick={() => setStep(2)} className="text-gray-400 font-bold hover:text-text-main transition-colors flex items-center gap-2">
            <ChevronLeft size={20} /> Editar Valores
          </button>
          <button onClick={() => setView('list')} className="btn-secondary px-8 py-3 rounded-xl font-bold border border-highlight/20">
            Voltar para Lista
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      {view === 'list' ? renderList() : (
        <div className="space-y-8">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('list')} className="p-2 hover:bg-highlight/10 rounded-full transition-colors">
              <ChevronLeft size={24} />
            </button>
            <h2 className="text-2xl font-black text-text-main">Nova Simulação Estratégica</h2>
          </div>

          {/* Stepper */}
          <div className="flex items-center justify-center gap-4 max-w-md mx-auto">
            {[1, 2, 3].map((s) => (
              <React.Fragment key={s}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                  step === s ? 'bg-primary text-white scale-110 shadow-lg' : 
                  step > s ? 'bg-primary/20 text-primary' : 'bg-highlight/10 text-gray-400'
                }`}>
                  {step > s ? <CheckCircle2 size={20} /> : s}
                </div>
                {s < 3 && <div className={`h-1 w-12 rounded-full ${step > s ? 'bg-primary/20' : 'bg-highlight/10'}`} />}
              </React.Fragment>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default SimuladorEventosComponent;
