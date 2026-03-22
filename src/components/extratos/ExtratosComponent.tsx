import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Download, TrendingUp, TrendingDown, Filter, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { Transaction, Category, Event, Product, InitialCash } from '../../types';
import { subscribeToTransactions, subscribeToCategories, subscribeToEvents, subscribeToProducts } from '../../services/dataService';
import { useAuth } from '../../contexts/AuthContext';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const getBase64ImageFromUrl = async (imageUrl: string): Promise<string> => {
  try {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error fetching image:', error);
    return '';
  }
};

const ExtratosComponent = () => {
  const { profile } = useAuth();
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [initialCash, setInitialCash] = useState<InitialCash | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    allTransactions.forEach(t => {
      years.add(new Date(t.data).getFullYear().toString());
    });
    const sortedYears = Array.from(years).sort().reverse();
    // Ensure current year is always included even if no transactions
    const currentYear = new Date().getFullYear().toString();
    if (!sortedYears.includes(currentYear)) {
      sortedYears.push(currentYear);
      sortedYears.sort().reverse();
    }
    return sortedYears;
  }, [allTransactions]);

  const [filter, setFilter] = useState({
    mes: (new Date().getMonth() + 1).toString(),
    ano: new Date().getFullYear().toString(),
    categoriaId: 'all',
    tipo: 'all',
    eventoId: 'all',
    produtoId: 'all'
  });

  useEffect(() => {
    const unsubscribeTransactions = subscribeToTransactions((data) => {
      setAllTransactions(data);
      setLoading(false);
    });

    const unsubscribeCategories = subscribeToCategories((data) => setCategories(data));
    const unsubscribeEvents = subscribeToEvents((data) => setEvents(data));
    const unsubscribeProducts = subscribeToProducts((data) => setProducts(data));

    const unsubscribeInitialCash = onSnapshot(doc(db, "configuracoesFinanceiras", "caixaInicial"), (docSnap) => {
      if (docSnap.exists()) {
        setInitialCash(docSnap.data() as InitialCash);
      }
    });

    return () => {
      unsubscribeTransactions();
      unsubscribeCategories();
      unsubscribeEvents();
      unsubscribeProducts();
      unsubscribeInitialCash();
    };
  }, []);

  useEffect(() => {
    let result = [...allTransactions];

    if (filter.mes !== 'all') {
      result = result.filter(t => (new Date(t.data).getMonth() + 1).toString() === filter.mes);
    }
    if (filter.ano !== 'all') {
      result = result.filter(t => new Date(t.data).getFullYear().toString() === filter.ano);
    }
    if (filter.categoriaId !== 'all') {
      result = result.filter(t => t.categoriaId === filter.categoriaId);
    }
    if (filter.tipo !== 'all') {
      result = result.filter(t => t.tipo === filter.tipo);
    }
    if (filter.eventoId !== 'all') {
      result = result.filter(t => t.eventoId === filter.eventoId);
    }
    if (filter.produtoId !== 'all') {
      result = result.filter(t => t.produtoId === filter.produtoId);
    }

    // Sort by date descending
    result.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    setFilteredTransactions(result);
  }, [allTransactions, filter]);

  const totalEntradas = filteredTransactions
    .filter(t => t.tipo === 'entrada')
    .reduce((acc, curr) => acc + curr.valor, 0);

  const totalSaidas = filteredTransactions
    .filter(t => t.tipo === 'saida')
    .reduce((acc, curr) => acc + curr.valor, 0);

  const saldoPeriodo = (initialCash?.valor || 9402) + totalEntradas - totalSaidas;

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const getCategoryName = (id?: string) => {
    if (!id) return 'Sem Categoria';
    const category = categories.find(c => c.id === id);
    return category ? category.nome : 'Outros';
  };

  const saldoResumo = useMemo(() => {
    const saldoBaseGestao = 9402;
    const dataInicioGestao = new Date('2026-01-01T00:00:00');
    
    let dataInicioPeriodo: Date | null = null;
    if (filter.mes === 'all' && filter.ano === 'all') {
      dataInicioPeriodo = null;
    } else if (filter.mes !== 'all' && filter.ano !== 'all') {
      dataInicioPeriodo = new Date(parseInt(filter.ano), parseInt(filter.mes) - 1, 1);
    } else if (filter.ano !== 'all') {
      dataInicioPeriodo = new Date(parseInt(filter.ano), 0, 1);
    }

    let saldoInicialPeriodo = saldoBaseGestao;
    if (dataInicioPeriodo) {
      const movimentacoesAntes = allTransactions.filter(t => {
        const tDate = new Date(t.data);
        return tDate >= dataInicioGestao && tDate < (dataInicioPeriodo as Date);
      });

      const totalAntes = movimentacoesAntes.reduce((acc, t) => {
        return t.tipo === 'entrada' ? acc + t.valor : acc - t.valor;
      }, 0);
      
      saldoInicialPeriodo = saldoBaseGestao + totalAntes;
    }

    const entradasNoPeriodo = filteredTransactions
      .filter(t => t.tipo === 'entrada')
      .reduce((acc, curr) => acc + curr.valor, 0);

    const saidasNoPeriodo = filteredTransactions
      .filter(t => t.tipo === 'saida')
      .reduce((acc, curr) => acc + curr.valor, 0);

    const saldoFinalPeriodo = saldoInicialPeriodo + entradasNoPeriodo - saidasNoPeriodo;

    return {
      saldoInicialPeriodo,
      entradasNoPeriodo,
      saidasNoPeriodo,
      saldoFinalPeriodo
    };
  }, [allTransactions, filteredTransactions, filter.mes, filter.ano]);

  const handleExportPDF = async () => {
    setIsGeneratingPDF(true);
    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.width;
      const pageHeight = pdf.internal.pageSize.height;
      
      const primaryColor = '#0E8F63';
      const textColor = '#2B2B2B';

      let logoTopBase64 = '';
      try {
        // 2 — POSICIONAMENTO DA LOGO - Using the requested logo URL
        logoTopBase64 = await getBase64ImageFromUrl('https://raw.githubusercontent.com/brutafinance-maker/brt1/main/04%20NOVA%20LOGO%20BRUTAMED%20COMPLETO_03%20LOGOTIPO.png');
      } catch (e) {
        console.error('Failed to load logo', e);
      }

      let currentY = 15;

      // 1 — REMOVER LOGO DO FINAL DO PDF (Logo only in header)
      // 2 — POSICIONAMENTO DA LOGO (Top left, proportional)
      if (logoTopBase64) {
        pdf.addImage(logoTopBase64, 'PNG', 10, currentY, 35, 12);
      }

      // 3 — TÍTULO DINÂMICO DO RELATÓRIO
      let reportTitle = 'Extrato Financeiro';
      let periodSubTitle = '';

      if (filter.mes !== 'all' && filter.ano !== 'all') {
        const monthName = new Date(0, parseInt(filter.mes) - 1).toLocaleString('pt-BR', { month: 'long' });
        reportTitle = `Extrato do mês de ${monthName.charAt(0).toUpperCase() + monthName.slice(1)} — ${filter.ano}`;
      } else if (filter.mes === 'all' && filter.ano !== 'all') {
        reportTitle = `Extrato Financeiro — Ano ${filter.ano}`;
      } else if (filter.mes === 'all' && filter.ano === 'all') {
        reportTitle = 'Extrato Financeiro Completo';
      }

      pdf.setFontSize(16);
      pdf.setTextColor(primaryColor);
      pdf.setFont(undefined, 'bold');
      pdf.text(reportTitle.toUpperCase(), 50, currentY + 5);
      
      pdf.setFontSize(10);
      pdf.setTextColor(textColor);
      pdf.setFont(undefined, 'normal');
      pdf.text('Atlética BrutaMed — AAAMOP', 50, currentY + 11);
      
      currentY += 25;

      // Metadata
      const now = new Date();
      const generatedDate = now.toLocaleDateString('pt-BR');
      const generatedTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const userName = profile?.nome || 'Diretor Financeiro';

      pdf.setFontSize(9);
      pdf.setTextColor(100);
      pdf.text(`Documento gerado em: ${generatedDate} às ${generatedTime}`, 10, currentY);
      currentY += 5;
      pdf.text(`Gerado por: ${userName}`, 10, currentY);
      currentY += 15;

      // 7 — RESUMO FINANCEIRO NO PDF (Using autoTable to avoid overlap)
      pdf.setFontSize(12);
      pdf.setTextColor(primaryColor);
      pdf.setFont(undefined, 'bold');
      pdf.text('Resumo Financeiro', 10, currentY);
      currentY += 5;

      autoTable(pdf, {
        startY: currentY,
        margin: { left: 10 },
        body: [
          ['Saldo inicial:', formatCurrency(saldoResumo.saldoInicialPeriodo)],
          ['Total de entradas no período:', formatCurrency(saldoResumo.entradasNoPeriodo)],
          ['Total de saídas no período:', formatCurrency(saldoResumo.saidasNoPeriodo)],
          ['Saldo final do período:', formatCurrency(saldoResumo.saldoFinalPeriodo)]
        ],
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 1, textColor: textColor },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { halign: 'right', fontStyle: 'bold', cellWidth: 40 }
        },
        didParseCell: function(data) {
          if (data.row.index === 1 && data.column.index === 1) data.cell.styles.textColor = '#0E8F63';
          if (data.row.index === 2 && data.column.index === 1) data.cell.styles.textColor = '#DC2626';
          if (data.row.index === 3) {
            data.cell.styles.fontStyle = 'bold';
          }
        }
      });

      currentY = (pdf as any).lastAutoTable.finalY + 10;

      // 5 — Linha divisória
      pdf.setDrawColor(230);
      pdf.line(10, currentY, pageWidth - 10, currentY);
      currentY += 10;

      // 6 — Tabela de movimentações
      const sortedForReport = [...filteredTransactions].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

      const tableData = sortedForReport.map(t => [
        new Date(t.data).toLocaleDateString('pt-BR'),
        t.tipo.toUpperCase(),
        getCategoryName(t.categoriaId),
        t.descricao || t.procedencia || 'Sem descrição',
        formatCurrency(t.valor),
        t.usuarioNome
      ]);

      autoTable(pdf, {
        startY: currentY,
        margin: { left: 10, right: 10 },
        head: [['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor', 'Responsável']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: primaryColor, textColor: '#FFFFFF', fontSize: 9, fontStyle: 'bold' },
        styles: { fontSize: 8, textColor: textColor, cellPadding: 3 },
        columnStyles: {
          4: { halign: 'right' } // Valor column
        },
        didParseCell: function(data) {
          if (data.section === 'body' && data.column.index === 1) { // Tipo column
            const tipo = sortedForReport[data.row.index].tipo;
            data.cell.styles.textColor = tipo === 'entrada' ? '#0E8F63' : '#DC2626';
          }
          if (data.section === 'body' && data.column.index === 4) { // Valor column
            const tipo = sortedForReport[data.row.index].tipo;
            data.cell.styles.textColor = tipo === 'entrada' ? '#0E8F63' : '#DC2626';
            data.cell.styles.fontStyle = 'bold';
          }
        }
      });

      // 9 — RODAPÉ
      const pageCount = pdf.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150);
        pdf.setFont(undefined, 'normal');
        
        pdf.text(
          'Sistema Financeiro — Atlética BrutaMed\nAssociação Atlética Acadêmica de Medicina do Oeste do Pará (AAAMOP)',
          10,
          pageHeight - 15,
          { align: 'left' }
        );
        
        pdf.text(`Página ${i} de ${pageCount}`, pageWidth - 10, pageHeight - 10, { align: 'right' });
      }

      let filename = 'extrato_financeiro_brutamed';
      if (filter.mes !== 'all') {
        const monthName = new Date(0, parseInt(filter.mes) - 1).toLocaleString('pt-BR', { month: 'long' }).toLowerCase();
        filename += `_${monthName}`;
      }
      if (filter.ano !== 'all') {
        filename += `_${filter.ano}`;
      }
      filename += '.pdf';

      pdf.save(filename);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Ocorreu um erro ao gerar o PDF.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold text-text-main">Extratos Financeiros</h2>
          <p className="text-gray-500 text-sm lg:text-base">Gere relatórios detalhados para prestação de contas.</p>
        </div>
        <button
          onClick={handleExportPDF}
          disabled={isGeneratingPDF || filteredTransactions.length === 0}
          className="flex items-center justify-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGeneratingPDF ? (
            <span className="animate-pulse">Gerando...</span>
          ) : (
            <>
              <Download size={20} />
              Gerar PDF do Extrato
            </>
          )}
        </button>
      </header>

      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-2 text-text-main font-bold mb-2">
          <Filter size={20} />
          <h3>Filtros</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase">Mês</label>
            <select
              className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-2 outline-none focus:border-primary transition-all text-sm"
              value={filter.mes}
              onChange={(e) => setFilter({ ...filter, mes: e.target.value })}
            >
              <option value="all">Todos os meses</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={(i + 1).toString()}>
                  {new Date(0, i).toLocaleString('pt-BR', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase">Ano</label>
            <select
              className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-2 outline-none focus:border-primary transition-all text-sm"
              value={filter.ano}
              onChange={(e) => setFilter({ ...filter, ano: e.target.value })}
            >
              <option value="all">Todos os anos</option>
              {availableYears.map(ano => (
                <option key={ano} value={ano}>{ano}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase">Tipo</label>
            <select
              className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-2 outline-none focus:border-primary transition-all text-sm"
              value={filter.tipo}
              onChange={(e) => setFilter({ ...filter, tipo: e.target.value })}
            >
              <option value="all">Todos os tipos</option>
              <option value="entrada">Entradas</option>
              <option value="saida">Saídas</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase">Categoria</label>
            <select
              className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-2 outline-none focus:border-primary transition-all text-sm"
              value={filter.categoriaId}
              onChange={(e) => setFilter({ ...filter, categoriaId: e.target.value })}
            >
              <option value="all">Todas as categorias</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase">Evento</label>
            <select
              className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-2 outline-none focus:border-primary transition-all text-sm"
              value={filter.eventoId}
              onChange={(e) => setFilter({ ...filter, eventoId: e.target.value })}
            >
              <option value="all">Todos os eventos</option>
              {events.map(e => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase">Produto</label>
            <select
              className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-2 outline-none focus:border-primary transition-all text-sm"
              value={filter.produtoId}
              onChange={(e) => setFilter({ ...filter, produtoId: e.target.value })}
            >
              <option value="all">Todos os produtos</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="glass-card p-6">
        <h3 className="text-lg font-bold text-primary mb-4">Resumo Financeiro</h3>
        <div className="grid grid-cols-[1fr_auto] gap-y-3 gap-x-10 text-sm max-w-md">
          <div className="text-gray-600 font-medium">Saldo inicial:</div>
          <div className="text-right font-semibold text-text-main">{formatCurrency(saldoResumo.saldoInicialPeriodo)}</div>

          <div className="text-gray-600 font-medium">Total de entradas no período:</div>
          <div className="text-right font-semibold text-green-600">{formatCurrency(saldoResumo.entradasNoPeriodo)}</div>

          <div className="text-gray-600 font-medium">Total de saídas no período:</div>
          <div className="text-right font-semibold text-red-600">{formatCurrency(saldoResumo.saidasNoPeriodo)}</div>

          <div className="text-text-main font-bold text-base pt-3 border-t border-gray-100">Saldo final do período:</div>
          <div className="text-right font-bold text-base pt-3 border-t border-gray-100 text-primary">{formatCurrency(saldoResumo.saldoFinalPeriodo)}</div>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-4 lg:p-6 border-b border-highlight/20 flex justify-between items-center">
          <h4 className="font-bold text-base lg:text-lg">Detalhamento do Período</h4>
          <span className="text-xs text-gray-500">{filteredTransactions.length} registros encontrados</span>
        </div>
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-background/50 text-[10px] lg:text-xs uppercase text-gray-500 font-bold">
              <tr>
                <th className="px-4 lg:px-6 py-4">Data</th>
                <th className="px-4 lg:px-6 py-4">Tipo</th>
                <th className="px-4 lg:px-6 py-4">Categoria</th>
                <th className="px-4 lg:px-6 py-4">Descrição</th>
                <th className="px-4 lg:px-6 py-4">Responsável</th>
                <th className="px-4 lg:px-6 py-4 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-highlight/10">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400">Carregando...</td></tr>
              ) : filteredTransactions.length > 0 ? (
                filteredTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-background/30 transition-colors">
                    <td className="px-4 lg:px-6 py-4 text-xs lg:text-sm text-gray-500">
                      {new Date(t.data).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 lg:px-6 py-4">
                      {t.tipo === 'entrada' ? (
                        <div className="flex items-center gap-1 text-primary font-bold text-[10px] lg:text-xs uppercase">
                          <ArrowUpRight size={14} />
                          Entrada
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-danger font-bold text-[10px] lg:text-xs uppercase">
                          <ArrowDownLeft size={14} />
                          Saída
                        </div>
                      )}
                    </td>
                    <td className="px-4 lg:px-6 py-4">
                      <span className="px-2 py-1 rounded-lg bg-gray-100 text-gray-500 text-[10px] font-bold uppercase">
                        {getCategoryName(t.categoriaId)}
                      </span>
                    </td>
                    <td className="px-4 lg:px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-xs lg:text-sm">{t.descricao || t.procedencia || 'Sem descrição'}</span>
                        {t.origem === 'registro_anterior' && (
                          <span className="text-[10px] bg-highlight/10 text-highlight px-2 py-0.5 rounded-full w-fit font-bold uppercase">
                            Registro anterior ao sistema
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 lg:px-6 py-4 text-xs lg:text-sm text-gray-500">
                      {t.usuarioNome}
                    </td>
                    <td className={`px-4 lg:px-6 py-4 text-right font-bold text-xs lg:text-sm ${
                      t.tipo === 'entrada' ? 'text-green-600' : 'text-red-500'
                    }`}>
                      {t.tipo === 'entrada' ? '+' : '-'} {formatCurrency(t.valor)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
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

export default ExtratosComponent;

