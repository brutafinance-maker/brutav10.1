import React, { useState, useMemo } from 'react';
import { Calculator, TrendingUp, TrendingDown, AlertCircle, CheckCircle, Info, Plus } from 'lucide-react';
import { Product } from '../../types';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { logAction } from '../../utils/audit';

interface ProductSimulationProps {
  products: Product[];
  onProductCreated: () => void;
}

const ProductSimulator: React.FC<ProductSimulationProps> = ({ products, onProductCreated }) => {
  const { profile } = useAuth();
  const [nome, setNome] = useState('');
  const [valorProducao, setValorProducao] = useState<number | ''>('');
  const [pedidoMinimo, setPedidoMinimo] = useState<number | ''>('');
  const [freteEstimado, setFreteEstimado] = useState<number | ''>('');
  const [vendasEstimadas, setVendasEstimadas] = useState<number | ''>('');
  const [precoVenda, setPrecoVenda] = useState<number | ''>('');
  const [isSaving, setIsSaving] = useState(false);

  // Calculations
  const custoTotalProducao = (Number(valorProducao) || 0) * (Number(pedidoMinimo) || 0);
  const custoTotalGeral = custoTotalProducao + (Number(freteEstimado) || 0);
  const custoPorUnidadeReal = (Number(pedidoMinimo) || 0) > 0 ? custoTotalGeral / Number(pedidoMinimo) : 0;
  
  const receitaEstimada = (Number(precoVenda) || 0) * (Number(vendasEstimadas) || 0);
  const lucroEstimado = receitaEstimada - custoTotalGeral;
  
  const margemLucro = custoTotalGeral > 0 ? (lucroEstimado / custoTotalGeral) * 100 : 0;

  const precoMinimoSemPrejuizo = (Number(vendasEstimadas) || 0) > 0 ? custoTotalGeral / Number(vendasEstimadas) : 0;
  const precoCom20Lucro = (Number(vendasEstimadas) || 0) > 0 ? (custoTotalGeral * 1.2) / Number(vendasEstimadas) : 0;
  const precoCom30Lucro = (Number(vendasEstimadas) || 0) > 0 ? (custoTotalGeral * 1.3) / Number(vendasEstimadas) : 0;

  // Indicator
  let indicatorColor = 'text-gray-500';
  let indicatorBg = 'bg-gray-100';
  let indicatorText = 'Aguardando dados';
  let IndicatorIcon = Info;

  if (lucroEstimado < 0) {
    indicatorColor = 'text-red-600';
    indicatorBg = 'bg-red-100';
    indicatorText = 'Prejuízo';
    IndicatorIcon = TrendingDown;
  } else if (margemLucro >= 0 && margemLucro <= 20) {
    indicatorColor = 'text-yellow-600';
    indicatorBg = 'bg-yellow-100';
    indicatorText = 'Lucro baixo';
    IndicatorIcon = AlertCircle;
  } else if (margemLucro > 20) {
    indicatorColor = 'text-green-600';
    indicatorBg = 'bg-green-100';
    indicatorText = 'Lucro saudável';
    IndicatorIcon = TrendingUp;
  }

  // History
  const similarProducts = useMemo(() => {
    if (!nome.trim()) return [];
    const searchTerms = nome.toLowerCase().split(' ').filter(t => t.length > 2);
    if (searchTerms.length === 0) return [];

    return products.filter(p => {
      const pName = p.nome.toLowerCase();
      return searchTerms.some(term => pName.includes(term));
    }).sort((a, b) => {
      // Sort by creation date or just return
      const dateA = a.dataCriacao ? new Date(a.dataCriacao).getTime() : 0;
      const dateB = b.dataCriacao ? new Date(b.dataCriacao).getTime() : 0;
      return dateB - dateA;
    }).slice(0, 3);
  }, [nome, products]);

  const handleCreateProduct = async () => {
    if (!nome || !precoVenda || !valorProducao || !pedidoMinimo) {
      alert('Preencha os campos obrigatórios (Nome, Valor de produção, Pedido mínimo e Preço de venda).');
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      alert('Usuário não autenticado.');
      return;
    }

    setIsSaving(true);
    try {
      const newProduct: Omit<Product, 'id'> = {
        nome,
        precoVenda: Number(precoVenda),
        custoProducao: Number(valorProducao),
        quantidadeProduzida: Number(pedidoMinimo),
        estoque: Number(pedidoMinimo),
        vendido: 0,
        categoria: 'Loja',
        custoUnitario: custoPorUnidadeReal,
        pedidoMinimo: Number(pedidoMinimo),
        freteEstimado: Number(freteEstimado) || 0,
        dataCriacao: new Date().toISOString(),
        criadoPor: profile?.nome || user.displayName || 'Usuário'
      };

      await addDoc(collection(db, 'produtos'), newProduct);
      await logAction(profile?.nome || user.displayName || 'Usuário', `Criou produto via simulação: ${nome}`, 'Loja');
      
      alert('Produto criado com sucesso!');
      
      // Reset form
      setNome('');
      setValorProducao('');
      setPedidoMinimo('');
      setFreteEstimado('');
      setVendasEstimadas('');
      setPrecoVenda('');
      
      onProductCreated();
    } catch (error) {
      console.error('Erro ao criar produto:', error);
      alert('Erro ao criar produto.');
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="glass-card p-6 space-y-6">
      <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
        <div className="p-2 bg-primary/10 text-primary rounded-lg">
          <Calculator size={24} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-text-main">Simulação de Produto</h3>
          <p className="text-sm text-gray-500">Analise a viabilidade financeira antes de produzir.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Inputs */}
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Nome do produto</label>
            <input 
              type="text" 
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Camisa BrutaMed 2026" 
              className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary/20 outline-none" 
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Valor produção (unid.)</label>
              <input 
                type="number" 
                value={valorProducao}
                onChange={(e) => setValorProducao(e.target.value ? Number(e.target.value) : '')}
                placeholder="R$ 0,00" 
                className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary/20 outline-none" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Pedido mínimo</label>
              <input 
                type="number" 
                value={pedidoMinimo}
                onChange={(e) => setPedidoMinimo(e.target.value ? Number(e.target.value) : '')}
                placeholder="Ex: 50" 
                className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary/20 outline-none" 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Frete estimado total</label>
              <input 
                type="number" 
                value={freteEstimado}
                onChange={(e) => setFreteEstimado(e.target.value ? Number(e.target.value) : '')}
                placeholder="R$ 0,00" 
                className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary/20 outline-none" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Vendas estimadas</label>
              <input 
                type="number" 
                value={vendasEstimadas}
                onChange={(e) => setVendasEstimadas(e.target.value ? Number(e.target.value) : '')}
                placeholder="Ex: 40" 
                className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary/20 outline-none" 
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Preço sugerido de venda</label>
            <input 
              type="number" 
              value={precoVenda}
              onChange={(e) => setPrecoVenda(e.target.value ? Number(e.target.value) : '')}
              placeholder="R$ 0,00" 
              className="w-full p-3 rounded-lg border border-primary focus:ring-2 focus:ring-primary/20 outline-none bg-primary/5" 
            />
          </div>

          {similarProducts.length > 0 && (
            <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
              <h4 className="text-sm font-bold text-gray-700 mb-3">Histórico de produtos semelhantes</h4>
              <div className="space-y-3">
                {similarProducts.map(p => (
                  <div key={p.id} className="flex justify-between items-center text-sm">
                    <span className="font-medium text-gray-800">{p.nome}</span>
                    <div className="text-right">
                      <div className="text-gray-500">{p.vendido || 0} vendidos</div>
                      <div className="font-bold text-primary">{formatCurrency(p.precoVenda)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Results */}
        <div className="space-y-6">
          <div className={`p-4 rounded-xl flex items-center gap-3 ${indicatorBg} ${indicatorColor}`}>
            <IndicatorIcon size={24} />
            <div>
              <div className="text-sm font-bold uppercase tracking-wider opacity-80">Viabilidade</div>
              <div className="text-xl font-bold">{indicatorText}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="text-xs text-gray-500 uppercase font-bold mb-1">Custo Total Geral</div>
              <div className="text-lg font-bold text-gray-800">{formatCurrency(custoTotalGeral)}</div>
              <div className="text-xs text-gray-400 mt-1">Prod: {formatCurrency(custoTotalProducao)} + Frete: {formatCurrency(Number(freteEstimado) || 0)}</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="text-xs text-gray-500 uppercase font-bold mb-1">Custo Unidade Real</div>
              <div className="text-lg font-bold text-gray-800">{formatCurrency(custoPorUnidadeReal)}</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="text-xs text-gray-500 uppercase font-bold mb-1">Receita Estimada</div>
              <div className="text-lg font-bold text-gray-800">{formatCurrency(receitaEstimada)}</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="text-xs text-gray-500 uppercase font-bold mb-1">Lucro Estimado</div>
              <div className={`text-lg font-bold ${lucroEstimado >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(lucroEstimado)}
              </div>
            </div>
          </div>

          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-3">
            <h4 className="text-sm font-bold text-blue-800 uppercase tracking-wider">Análise de Preço</h4>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-blue-700">Mínimo sem prejuízo:</span>
              <span className="font-bold text-blue-900">{formatCurrency(precoMinimoSemPrejuizo)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-blue-700">Sugestão (20% lucro):</span>
              <span className="font-bold text-blue-900">{formatCurrency(precoCom20Lucro)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-blue-700">Sugestão (30% lucro):</span>
              <span className="font-bold text-blue-900">{formatCurrency(precoCom30Lucro)}</span>
            </div>
          </div>

          <button 
            onClick={handleCreateProduct}
            disabled={isSaving || !nome || !precoVenda || !valorProducao || !pedidoMinimo}
            className="w-full btn-primary py-4 justify-center text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={24} />
            {isSaving ? 'Criando...' : 'Criar Produto'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductSimulator;
