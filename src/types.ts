export interface UserProfile {
  uid: string;
  nome: string;
  email: string;
  telefone: string;
  fraseSeguranca: string;
  cargo: string;
  diretorFinanceiro: boolean;
  outrasDiretorias: boolean;
  dataCriacao: string;
  setupCompleto: boolean;
}

export interface Transaction {
  id?: string;
  descricao: string;
  valor: number;
  tipo: 'entrada' | 'saida';
  categoriaId: string;
  categoriaNome?: string;
  eventoId?: string;
  produtoId?: string;
  patrocinioId?: string;
  data: string;
  usuarioId: string;
  usuarioNome: string;
  responsavel?: string;
  timestamp?: any;
  confirmadoPor?: string;
  dataConfirmacao?: string;
  origem?: string;
  procedencia?: string;
  ultimaEdicao?: string;
  editadoPor?: string;
}

export interface EventBatch {
  id: string;
  nome: string;
  preco: number;
  quantidadeTotal: number;
  quantidadeVendida: number;
  dataVirada?: string;
  ativo: boolean;
}

export interface EventCost {
  descricao: string;
  valor: number;
  criadoPor: string;
  data: string;
}

export interface EventSponsorship {
  nome: string;
  valor: number;
  criadoPor: string;
  data: string;
}

export interface EventRefund {
  id: string;
  nomeComprador: string;
  valor: number;
  motivo: string;
  vendaId?: string;
  criadoPor: string;
  criadoEm: string;
}

export interface Event {
  id?: string;
  nome: string;
  data: string;
  local: string;
  descricao?: string;
  orcamento?: number;
  publicoEstimado?: number;
  status: 'planejado' | 'em_venda' | 'finalizado' | 'cancelado';
  criadoPor: string;
  usuarioId: string;
  dataCriacao: string;
  lotes: EventBatch[];
  loteAtualId: string;
  custos?: EventCost[];
  patrocinios?: EventSponsorship[];
  reembolsos?: EventRefund[];
}

export interface PendingSale {
  id?: string;
  tipoVenda?: 'ingresso' | 'produto';
  eventoId?: string;
  nomeEvento?: string;
  produtoId?: string;
  nomeProduto?: string;
  nomeVendedor: string;
  usuarioId: string;
  quantidadeIngressos?: number;
  quantidade?: number;
  loteId?: string;
  nomeLote?: string;
  lote?: string;
  valorUnitario: number;
  valorTotal: number;
  dataRegistro: string;
  status: 'pendente' | 'confirmado' | 'rejeitado' | 'cancelado';
  nomeComprador?: string;
  participanteNome?: string;
  participanteEmail?: string;
  participanteTelefone?: string;
  telefoneComprador?: string;
  motivoRejeicao?: string;
  confirmadoPor?: string;
  dataConfirmacao?: string;
  registradoPorId?: string;
  registradoPorNome?: string;
  descricao?: string;
  categoriaId?: string;
  data?: string;
}

export interface Participant {
  id?: string;
  eventoId: string;
  nome: string;
  telefone?: string;
  loteId: string;
  nomeLote: string;
  dataCompra: string;
  vendaId: string;
}

export interface Product {
  id?: string;
  nome: string;
  custoProducao: number;
  precoVenda: number;
  quantidadeProduzida: number;
  estoque: number;
  vendido: number;
  categoria: string;
  descricao?: string;
  custoUnitario?: number;
  pedidoMinimo?: number;
  freteEstimado?: number;
  dataCriacao?: string;
  criadoPor?: string;
}

export interface Sponsorship {
  id?: string;
  nomePatrocinador: string;
  valor: number;
  tipoPatrocinio: string;
  descricao: string;
  data: string;
  criadoPorId: string;
  criadoPorNome: string;
}

export interface Category {
  id?: string;
  nome: string;
  tipo: 'entrada' | 'saida';
  descricao?: string;
  dataCriacao: string;
}

export interface AuditLog {
  usuario: string;
  acao: string;
  modulo: string;
  horario: string;
  pagina: string;
}

export interface Sale {
  id?: string;
  produtoId: string;
  quantidade: number;
  precoUnitario: number;
  valorTotal: number;
  data: string;
  responsavel: string;
  descricao: string;
  categoriaId: string;
}

export interface AppSettings {
  saldoInicial: number;
  configuradoPor: string;
  dataConfiguracao: string;
}

export interface InitialCash {
  valor: number;
  configuradoPorId: string;
  configuradoPorNome: string;
  motivo: string;
  dataConfiguracao: string;
}

export type SimulationType = 'festa' | 'esporte' | 'geral' | 'estrategico';
export type SimulationPeriod = 'mensal' | 'trimestral' | 'semestral' | 'anual';

export interface MonthlyValue {
  mes: number;
  receita: number;
  despesa: number;
  valorAnterior: number; // Resultado real anterior
  descricao?: string;
}

export interface Simulation {
  id?: string;
  nome: string;
  tipo: SimulationType;
  periodo: SimulationPeriod;
  ano: number;
  saldoAtual: number;
  valoresMensais: MonthlyValue[];
  resultado: {
    reservaMinima: number;
    valorDisponivel: number;
    capacidadeDeGasto: number;
    receitasTotais: number;
    despesasTotais: number;
    evolucaoSaldo: { mes: number; saldo: number; label: string }[];
    diferencaTotal: number;
    mediaDiferenca: number;
    viavel: boolean;
    analise: string[];
    sugestoes: string[];
  };
  criadoPor: string;
  data: string;
}
