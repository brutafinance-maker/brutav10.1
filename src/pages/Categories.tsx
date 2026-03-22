import React, { useState, useEffect } from 'react';
import { Tag, Plus, Trash2, Search } from 'lucide-react';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Category } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { logAction } from '../utils/audit';

const Categories = () => {
  const { profile, isAdmin } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [newCategory, setNewCategory] = useState({
    nome: '',
    tipo: 'entrada' as 'entrada' | 'saida'
  });

  useEffect(() => {
    const q = query(collection(db, 'categorias'), orderBy('nome', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];
      setCategories(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    try {
      await addDoc(collection(db, 'categorias'), newCategory);
      logAction(profile?.nome || 'Usuário', 'Criou categoria: ' + newCategory.nome, 'Categorias');
      setIsModalOpen(false);
      setNewCategory({ nome: '', tipo: 'entrada' });
    } catch (error) {
      console.error('Erro ao adicionar categoria:', error);
    }
  };

  const handleDeleteCategory = async (id: string, nome: string) => {
    if (!isAdmin || !window.confirm(`Deseja realmente excluir a categoria "${nome}"?`)) return;

    try {
      await deleteDoc(doc(db, 'categorias', id));
      logAction(profile?.nome || 'Usuário', 'Excluiu categoria: ' + nome, 'Categorias');
    } catch (error) {
      console.error('Erro ao excluir categoria:', error);
    }
  };

  const filteredCategories = categories.filter(c =>
    c.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 lg:space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold text-text-main">Categorias Financeiras</h2>
          <p className="text-gray-500 text-sm lg:text-base">Organize suas entradas e saídas por tipo.</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-primary text-white px-4 py-2 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg"
          >
            <Plus size={20} />
            Nova Categoria
          </button>
        )}
      </header>

      <div className="glass-card p-4 flex items-center gap-3">
        <Search className="text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Buscar categorias..."
          className="bg-transparent border-none outline-none w-full text-sm lg:text-base"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-gray-400">Carregando...</div>
        ) : filteredCategories.length > 0 ? (
          filteredCategories.map((category) => (
            <div key={category.id} className="glass-card p-4 flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${category.tipo === 'entrada' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                  <Tag size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-sm lg:text-base">{category.nome}</h4>
                  <p className="text-[10px] uppercase font-bold text-gray-400">{category.tipo}</p>
                </div>
              </div>
              {isAdmin && (
                <button
                  onClick={() => handleDeleteCategory(category.id!, category.nome)}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          ))
        ) : (
          <div className="col-span-full py-12 text-center text-gray-400">Nenhuma categoria encontrada.</div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md p-6 lg:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">Nova Categoria</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-text-main">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>

            <form onSubmit={handleAddCategory} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase">Nome da Categoria</label>
                <input
                  required
                  type="text"
                  className="w-full bg-background/50 border border-highlight/20 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                  placeholder="Ex: Patrocínio, Material Esportivo..."
                  value={newCategory.nome}
                  onChange={(e) => setNewCategory({ ...newCategory, nome: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase">Tipo</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewCategory({ ...newCategory, tipo: 'entrada' })}
                    className={`py-2 rounded-xl font-bold text-xs transition-all ${
                      newCategory.tipo === 'entrada' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    ENTRADA
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCategory({ ...newCategory, tipo: 'saida' })}
                    className={`py-2 rounded-xl font-bold text-xs transition-all ${
                      newCategory.tipo === 'saida' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    SAÍDA
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-primary text-white py-4 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
              >
                Salvar Categoria
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Categories;
