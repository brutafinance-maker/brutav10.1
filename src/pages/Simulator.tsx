import React, { useState } from 'react';
import { Calculator, TrendingUp, Users, DollarSign, PieChart, Info } from 'lucide-react';

const Simulator = () => {
  const [inputs, setInputs] = useState({
    publico: 500,
    precoIngresso: 50,
    custoFixo: 5000,
    custoVariavelPorPessoa: 20,
    patrocinio: 2000
  });

  const receitaIngressos = inputs.publico * inputs.precoIngresso;
  const receitaTotal = receitaIngressos + inputs.patrocinio;
  const custoVariavelTotal = inputs.publico * inputs.custoVariavelPorPessoa;
  const custoTotal = inputs.custoFixo + custoVariavelTotal;
  const lucroEstimado = receitaTotal - custoTotal;
  const margemLucro = (lucroEstimado / receitaTotal) * 100;
  const pontoEquilibrio = Math.ceil(inputs.custoFixo / (inputs.precoIngresso - inputs.custoVariavelPorPessoa));

  return (
    <div className="space-y-6 lg:space-y-8">
      <header>
        <h2 className="text-2xl lg:text-3xl font-bold text-text-main">Simulador de Lucros</h2>
        <p className="text-gray-500 text-sm lg:text-base">Planeje seus eventos e preveja os resultados financeiros.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Painel de Inputs */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card p-6 space-y-6">
            <h3 className="font-bold flex items-center gap-2">
              <Calculator size={20} className="text-primary" />
              Parâmetros do Evento
            </h3>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
                  <Users size={12} /> Público Estimado
                </label>
                <input
                  type="number"
                  className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-2 outline-none focus:border-primary transition-all"
                  value={inputs.publico}
                  onChange={(e) => setInputs({ ...inputs, publico: Number(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
                  <DollarSign size={12} /> Preço do Ingresso (R$)
                </label>
                <input
                  type="number"
                  className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-2 outline-none focus:border-primary transition-all"
                  value={inputs.precoIngresso}
                  onChange={(e) => setInputs({ ...inputs, precoIngresso: Number(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
                  <TrendingUp size={12} /> Custo Fixo (R$)
                </label>
                <input
                  type="number"
                  className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-2 outline-none focus:border-primary transition-all"
                  value={inputs.custoFixo}
                  onChange={(e) => setInputs({ ...inputs, custoFixo: Number(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
                  <PieChart size={12} /> Custo Variável / Pessoa (R$)
                </label>
                <input
                  type="number"
                  className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-2 outline-none focus:border-primary transition-all"
                  value={inputs.custoVariavelPorPessoa}
                  onChange={(e) => setInputs({ ...inputs, custoVariavelPorPessoa: Number(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
                  <TrendingUp size={12} /> Patrocínios (R$)
                </label>
                <input
                  type="number"
                  className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-2 outline-none focus:border-primary transition-all"
                  value={inputs.patrocinio}
                  onChange={(e) => setInputs({ ...inputs, patrocinio: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>

          <div className="glass-card p-4 bg-primary/5 border-primary/20 flex gap-3">
            <Info className="text-primary shrink-0" size={20} />
            <p className="text-xs text-text-main/70 leading-relaxed">
              O <strong>Ponto de Equilíbrio</strong> indica quantos ingressos você precisa vender para cobrir todos os custos.
            </p>
          </div>
        </div>

        {/* Resultados */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="glass-card p-6 border-l-4 border-primary">
              <p className="text-xs font-bold text-gray-400 uppercase">Lucro Estimado</p>
              <h3 className={`text-3xl font-bold mt-1 ${lucroEstimado >= 0 ? 'text-text-main' : 'text-red-500'}`}>
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lucroEstimado)}
              </h3>
              <p className="text-xs text-gray-500 mt-2">
                Margem de {margemLucro.toFixed(1)}%
              </p>
            </div>

            <div className="glass-card p-6 border-l-4 border-blue-500">
              <p className="text-xs font-bold text-gray-400 uppercase">Ponto de Equilíbrio</p>
              <h3 className="text-3xl font-bold mt-1 text-text-main">
                {pontoEquilibrio} <span className="text-sm font-normal text-gray-500">ingressos</span>
              </h3>
              <p className="text-xs text-gray-500 mt-2">
                {((pontoEquilibrio / inputs.publico) * 100).toFixed(1)}% do público estimado
              </p>
            </div>
          </div>

          <div className="glass-card p-6 space-y-6">
            <h4 className="font-bold text-lg">Detalhamento Financeiro</h4>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-highlight/10">
                <span className="text-gray-500">Receita de Ingressos</span>
                <span className="font-bold text-green-600">
                  + {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(receitaIngressos)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-highlight/10">
                <span className="text-gray-500">Receita de Patrocínios</span>
                <span className="font-bold text-green-600">
                  + {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(inputs.patrocinio)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-highlight/10">
                <span className="text-gray-500">Custos Fixos</span>
                <span className="font-bold text-red-500">
                  - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(inputs.custoFixo)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-highlight/10">
                <span className="text-gray-500">Custos Variáveis ({inputs.publico} pessoas)</span>
                <span className="font-bold text-red-500">
                  - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(custoVariavelTotal)}
                </span>
              </div>
              <div className="flex justify-between items-center pt-4 text-lg font-bold">
                <span>Resultado Final</span>
                <span className={lucroEstimado >= 0 ? 'text-primary' : 'text-red-500'}>
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lucroEstimado)}
                </span>
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <h4 className="font-bold mb-4">Análise de Viabilidade</h4>
            <div className="w-full bg-gray-100 h-4 rounded-full overflow-hidden flex">
              <div 
                className="bg-red-400 h-full" 
                style={{ width: `${(inputs.custoFixo / receitaTotal) * 100}%` }}
                title="Custos Fixos"
              />
              <div 
                className="bg-orange-400 h-full" 
                style={{ width: `${(custoVariavelTotal / receitaTotal) * 100}%` }}
                title="Custos Variáveis"
              />
              <div 
                className="bg-primary h-full" 
                style={{ width: `${Math.max(0, (lucroEstimado / receitaTotal) * 100)}%` }}
                title="Lucro"
              />
            </div>
            <div className="flex gap-4 mt-4 text-[10px] font-bold uppercase text-gray-400">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-red-400 rounded-sm" /> Custos Fixos
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-orange-400 rounded-sm" /> Custos Variáveis
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-primary rounded-sm" /> Lucro Estimado
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Simulator;
