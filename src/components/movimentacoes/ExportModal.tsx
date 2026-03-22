import React, { useState, useMemo } from 'react';
import { X, FileText, Download } from 'lucide-react';
import { Transaction, Category, InitialCash } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  categories: Category[];
  type: 'pdf' | 'csv';
}

const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, transactions, categories, type }) => {
  const { profile } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');

  // Extract unique months and years from transactions
  const availablePeriods = useMemo(() => {
    const periods = new Set<string>();
    const years = new Set<string>();

    transactions.forEach(t => {
      const date = new Date(t.data);
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      
      const monthStr = month.toString().padStart(2, '0');
      periods.add(`${year}-${monthStr}`);
      years.add(year.toString());
    });

    const sortedPeriods = Array.from(periods).sort().reverse();
    const sortedYears = Array.from(years).sort().reverse();

    return { months: sortedPeriods, years: sortedYears };
  }, [transactions]);

  const getMonthName = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const handleExport = () => {
    if (!selectedPeriod) return;

    let filteredTransactions = transactions;
    let periodLabel = '';

    if (selectedPeriod === 'all') {
      periodLabel = 'Todo o Período';
    } else if (selectedPeriod.includes('-')) {
      // It's a month
      const [year, month] = selectedPeriod.split('-');
      filteredTransactions = transactions.filter(t => {
        const d = new Date(t.data);
        return d.getFullYear().toString() === year && (d.getMonth() + 1).toString().padStart(2, '0') === month;
      });
      periodLabel = getMonthName(selectedPeriod);
    } else {
      // It's a year
      filteredTransactions = transactions.filter(t => {
        const d = new Date(t.data);
        return d.getFullYear().toString() === selectedPeriod;
      });
      periodLabel = `Ano ${selectedPeriod}`;
    }

    if (type === 'csv') {
      exportCSV(filteredTransactions, periodLabel);
    } else {
      exportPDF(filteredTransactions, periodLabel);
    }
    
    onClose();
  };

  const getCategoryName = (id: string) => {
    const cat = categories.find(c => c.id === id);
    return cat ? cat.nome : 'Outros';
  };

  const exportCSV = (data: Transaction[], periodLabel: string) => {
    const headers = ['Data', 'Tipo', 'Categoria', 'Valor', 'Descricao', 'Responsavel', 'Evento', 'Produto'];
    
    const rows = data.map(t => [
      new Date(t.data).toLocaleDateString('pt-BR'),
      t.tipo,
      getCategoryName(t.categoriaId),
      t.valor.toString().replace('.', ','),
      `"${t.descricao.replace(/"/g, '""')}"`,
      `"${t.usuarioNome}"`,
      t.eventoId ? `"${t.eventoId}"` : '',
      t.produtoId ? `"${t.produtoId}"` : ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const safeLabel = periodLabel.toLowerCase().replace(/\s+/g, '_');
    link.setAttribute('href', url);
    link.setAttribute('download', `movimentacoes_brutamed_${safeLabel}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = async (data: Transaction[], periodLabel: string) => {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.width;
    const pageHeight = pdf.internal.pageSize.height;
    
    // Colors
    const primaryColor = '#0E8F63';
    const textColor = '#2B2B2B';

    let logoTopBase64 = '';
    try {
      // 2 — POSICIONAMENTO DA LOGO - Using the requested logo URL
      const resTop = await fetch('https://raw.githubusercontent.com/brutafinance-maker/brt1/main/04%20NOVA%20LOGO%20BRUTAMED%20COMPLETO_03%20LOGOTIPO.png');
      const blobTop = await resTop.blob();
      logoTopBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blobTop);
      });
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
    let reportTitle = 'EXTRATO FINANCEIRO';
    if (selectedPeriod === 'all') {
      reportTitle = 'EXTRATO FINANCEIRO COMPLETO';
    } else if (selectedPeriod.includes('-')) {
      const [year, month] = selectedPeriod.split('-');
      const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString('pt-BR', { month: 'long' });
      reportTitle = `EXTRATO DO MÊS DE ${monthName.toUpperCase()} — ${year}`;
    } else {
      reportTitle = `EXTRATO FINANCEIRO — ANO ${selectedPeriod}`;
    }

    pdf.setFontSize(16);
    pdf.setTextColor(primaryColor);
    pdf.setFont(undefined, 'bold');
    pdf.text(reportTitle, 50, currentY + 5);
    
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

    // 4 — SALDO INICIAL DA GESTÃO & 5 — CÁLCULO CORRETO DO SALDO INICIAL DO PERÍODO
    const saldoBaseGestao = 9402;
    const dataInicioGestao = new Date('2026-01-01T00:00:00');
    
    let dataInicioPeriodo: Date | null = null;
    if (selectedPeriod === 'all') {
      dataInicioPeriodo = null;
    } else if (selectedPeriod.includes('-')) {
      const [year, month] = selectedPeriod.split('-');
      dataInicioPeriodo = new Date(parseInt(year), parseInt(month) - 1, 1);
    } else {
      dataInicioPeriodo = new Date(parseInt(selectedPeriod), 0, 1);
    }

    // 6 — IMPLEMENTAÇÃO DA LÓGICA
    let saldoInicialPeriodo = saldoBaseGestao;
    if (dataInicioPeriodo) {
      const movimentacoesAntes = transactions.filter(t => {
        const tDate = new Date(t.data);
        return tDate >= dataInicioGestao && tDate < (dataInicioPeriodo as Date);
      });

      const totalAntes = movimentacoesAntes.reduce((acc, t) => {
        return t.tipo === 'entrada' ? acc + t.valor : acc - t.valor;
      }, 0);
      
      saldoInicialPeriodo = saldoBaseGestao + totalAntes;
    }

    const totalEntradas = data.filter(t => t.tipo === 'entrada').reduce((acc, curr) => acc + curr.valor, 0);
    const totalSaidas = data.filter(t => t.tipo === 'saida').reduce((acc, curr) => acc + curr.valor, 0);
    const saldoFinal = saldoInicialPeriodo + totalEntradas - totalSaidas;

    const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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
        ['Saldo inicial:', formatCurrency(saldoInicialPeriodo)],
        ['Total de entradas no período:', formatCurrency(totalEntradas)],
        ['Total de saídas no período:', formatCurrency(totalSaidas)],
        ['Saldo final do período:', formatCurrency(saldoFinal)],
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
    const sortedData = [...data].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

    const tableData = sortedData.map(t => [
      new Date(t.data).toLocaleDateString('pt-BR'),
      t.tipo.toUpperCase(),
      getCategoryName(t.categoriaId),
      t.descricao || 'Sem descrição',
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
          const tipo = sortedData[data.row.index].tipo;
          data.cell.styles.textColor = tipo === 'entrada' ? '#0E8F63' : '#DC2626';
        }
        if (data.section === 'body' && data.column.index === 4) { // Valor column
          const tipo = sortedData[data.row.index].tipo;
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

    const safeLabel = periodLabel.toLowerCase().replace(/\s+/g, '_');
    pdf.save(`extrato_financeiro_brutamed_${safeLabel}.pdf`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-primary text-white shrink-0">
          <h3 className="text-xl font-bold flex items-center gap-2">
            {type === 'pdf' ? <FileText size={20} /> : <Download size={20} />}
            Baixar {type.toUpperCase()}
          </h3>
          <button type="button" onClick={onClose} className="text-white/80 hover:text-white">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">Selecione o período que deseja exportar:</p>
          
          <div className="space-y-2">
            <select 
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary/20 outline-none"
            >
              <option value="">Selecione um período...</option>
              
              {availablePeriods.months.length > 0 && (
                <optgroup label="Meses Específicos">
                  {availablePeriods.months.map(month => (
                    <option key={month} value={month}>
                      {getMonthName(month).charAt(0).toUpperCase() + getMonthName(month).slice(1)}
                    </option>
                  ))}
                </optgroup>
              )}
              
              {availablePeriods.years.length > 0 && (
                <optgroup label="Anos Completos">
                  {availablePeriods.years.map(year => (
                    <option key={year} value={year}>
                      Ano Completo - {year}
                    </option>
                  ))}
                </optgroup>
              )}
              
              <optgroup label="Geral">
                <option value="all">Todo o Período</option>
              </optgroup>
            </select>
          </div>
        </div>
        
        <div className="p-6 bg-gray-50 flex gap-3 shrink-0">
          <button 
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-lg border border-gray-200 font-medium hover:bg-white"
          >
            Cancelar
          </button>
          <button 
            onClick={handleExport}
            disabled={!selectedPeriod}
            className="flex-1 py-3 rounded-lg bg-primary text-white font-bold hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Download size={18} />
            Baixar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
