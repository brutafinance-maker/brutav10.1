import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Calendar, 
  ShoppingBag, 
  Users, 
  FileText, 
  Settings,
  History,
  Calculator,
  X,
  LogOut,
  PlusCircle,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const { profile, isAdmin, isOtherDirectorate } = useAuth();
  
  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/', show: true },
    { icon: ArrowUpRight, label: 'Movimentações', path: '/movimentacoes', show: true },
    { icon: FileText, label: 'Extratos', path: '/extratos', show: true },
    { icon: Users, label: 'Patrocínios', path: '/patrocinios', show: isAdmin },
    { icon: ShoppingBag, label: 'Loja', path: '/loja', show: true },
    { icon: Calendar, label: 'Eventos', path: '/eventos', show: true },
    { icon: ShieldCheck, label: 'Controle Financeiro', path: '/controle-financeiro', show: isAdmin },
    { icon: PlusCircle, label: 'Nova Venda', path: '/nova-venda', show: true },
    { icon: Calculator, label: 'Simulador', path: '/simulador', show: true },
    { icon: History, label: 'Auditoria', path: '/auditoria', show: isAdmin },
    { icon: Settings, label: 'Categorias', path: '/categorias', show: isAdmin },
  ].filter(item => item.show);

  const handleLogout = () => {
    signOut(auth);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-primary text-white shadow-xl">
      <div className="border-b border-white/10 flex justify-between items-center px-2">
        <div className="sidebar-logo flex-1">
          <img 
            src="https://raw.githubusercontent.com/brutafinance-maker/brt1/main/04%20NOVA%20LOGO%20BRUTAMED%20COMPLETO_03%20LOGOTIPO.png" 
            alt="Atlética BrutaMed"
            referrerPolicy="no-referrer"
          />
        </div>
        <button onClick={onClose} className="lg:hidden text-white/80 hover:text-white pr-4">
          <X size={24} />
        </button>
      </div>
      
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto scrollbar-hide">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => {
              if (window.innerWidth < 1024) onClose();
            }}
            className={({ isActive }) => 
              `sidebar-item py-4 lg:py-3 ${isActive ? 'active' : ''}`
            }
          >
            <item.icon size={22} className="lg:size-5" />
            <span className="text-lg lg:text-base">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-6 border-t border-white/10 bg-black/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 lg:w-8 lg:h-8 rounded-full bg-highlight flex items-center justify-center text-primary font-bold">
              {profile?.nome.charAt(0) || 'U'}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold truncate max-w-[120px]">{profile?.nome || 'Usuário'}</span>
              <span className="text-[10px] text-white/50 uppercase tracking-widest truncate max-w-[120px]">
                {profile?.cargo || 'Diretoria'}
              </span>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white"
            title="Sair"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 h-screen sticky top-0 flex-col">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-[80%] max-w-sm z-50 lg:hidden"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;
