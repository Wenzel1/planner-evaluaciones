'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, KanbanSquare, CalendarDays, History, Briefcase, 
  LineChart, Settings, BrainCircuit, Plus, Trash2, Bot, 
  Send, Sparkles, Menu, X, User, ChevronRight, 
  CheckCircle2, AlertCircle, Clock, FileText, TrendingUp,
  Moon, Sun, LogOut, HelpCircle, Bell, Search, Download,
  Mic, Paperclip, MoreHorizontal, Copy, Check, RefreshCw,
  Star, BookOpen, Target, Award
} from 'lucide-react';

// ============================================
// TEMA Y UTILS - Paleta Pastel Oscura
// ============================================
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

const theme = {
  primary: {
    light: '#5EEAD4',
    DEFAULT: '#14B8A6',
    dark: '#0F766E',
    glow: 'rgba(20, 184, 166, 0.15)'
  },
  accent: {
    purple: '#A78BFA',
    pink: '#F472B6',
    amber: '#FBBF24',
    blue: '#60A5FA'
  },
  surface: {
    dark: '#1A1A1A',
    darker: '#121212',
    card: '#242424',
    border: '#2D2D2D',
    hover: '#2A2A2A'
  },
  text: {
    primary: '#F5F5F5',
    secondary: '#A3A3A3',
    tertiary: '#737373'
  }
};

// ============================================
// SIDEBAR MEJORADO
// ============================================
interface SidebarItem {
  icon: React.ElementType;
  name: string;
  active?: boolean;
  onClick?: () => void;
}

function SidebarItem({ icon: Icon, name, active, onClick }: SidebarItem) {
  return (
    <motion.button
      whileHover={{ x: 4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 w-full p-3 rounded-xl transition-all duration-200 group',
        active 
          ? 'bg-gradient-to-r from-teal-500/15 to-teal-600/5 border border-teal-500/25 text-teal-400' 
          : 'hover:bg-white/5 text-neutral-500 hover:text-neutral-200'
      )}
    >
      <Icon size={18} className={cn('transition-colors', active ? 'text-teal-400' : 'group-hover:text-teal-400')} />
      <span className="hidden lg:block text-sm font-medium">{name}</span>
      {active && <ChevronRight size={14} className="ml-auto hidden lg:block text-teal-400" />}
    </motion.button>
  );
}

function SidebarSection({ label, items }: { label: string; items: SidebarItem[] }) {
  return (
    <div className="space-y-2">
      <div className="hidden lg:block px-4 text-[10px] font-bold text-neutral-600 uppercase tracking-widest">{label}</div>
      {items.map((item) => (
        <SidebarItem key={item.name} {...item} />
      ))}
    </div>
  );
}

function ImprovedSidebar({ activeView, setActiveView, isDark, onToggleTheme }: any) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const generalItems = [
    { icon: CalendarDays, name: 'Planner', onClick: () => setActiveView('planner') },
    { icon: KanbanSquare, name: 'Dashboard', onClick: () => setActiveView('dashboard') },
    { icon: History, name: 'Historial', onClick: () => setActiveView('history') },
  ];

  const gestionItems = [
    { icon: Briefcase, name: 'Proyectos', onClick: () => setActiveView('projects') },
    { icon: LineChart, name: 'Analítica', onClick: () => setActiveView('analytics') },
  ];

  const sidebarContent = (
    <div className={`flex flex-col h-full bg-gradient-to-b from-[#121212] to-[#0A0A0A] backdrop-blur-xl transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-72'} border-r border-white/5`}>
      <div className={`p-6 flex ${isCollapsed ? 'justify-center' : 'justify-between'} items-center border-b border-white/5`}>
        <div className={`flex items-center gap-3 ${isCollapsed ? 'flex-col' : ''}`}>
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="w-12 h-12 bg-gradient-to-br from-teal-400 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-500/20"
          >
            <Zap size={24} className="text-white" />
          </motion.div>
          {!isCollapsed && (
            <div className="text-left">
              <h2 className="font-bold text-white text-lg tracking-tight">NetMaster</h2>
              <span className="px-2 py-0.5 rounded-full bg-teal-500/10 text-[10px] text-teal-400 font-bold uppercase tracking-wider">v2.4 Pro</span>
            </div>
          )}
        </div>
        {!isCollapsed && (
          <button onClick={() => setIsCollapsed(true)} className="p-1 rounded-lg hover:bg-white/5 transition-colors hidden lg:block">
            <ChevronRight size={16} className="text-neutral-600" />
          </button>
        )}
        {isCollapsed && (
          <button onClick={() => setIsCollapsed(false)} className="p-1 rounded-lg hover:bg-white/5 transition-colors hidden lg:block">
            <Menu size={16} className="text-neutral-600" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-3 space-y-8">
        <SidebarSection label="General" items={generalItems} />
        <SidebarSection label="Gestión" items={gestionItems} />
      </div>

      <div className="p-4 space-y-4 border-t border-white/5">
        {!isCollapsed && (
          <div className="p-4 bg-gradient-to-r from-teal-500/10 to-teal-600/5 rounded-2xl border border-teal-500/15">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-neutral-400">Créditos IA</span>
              <span className="text-[10px] text-teal-400 font-mono">85%</span>
            </div>
            <div className="h-1.5 w-full bg-black/50 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: '85%' }}
                transition={{ duration: 1, delay: 0.5 }}
                className="h-full bg-gradient-to-r from-teal-400 to-teal-500 rounded-full shadow-[0_0_10px_rgba(20,184,166,0.3)]" 
              />
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onToggleTheme} 
            className="flex items-center justify-center gap-3 flex-1 p-2 rounded-xl hover:bg-white/5 transition-colors text-neutral-400 hover:text-white"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
            {!isCollapsed && <span className="text-sm">{isDark ? 'Claro' : 'Oscuro'}</span>}
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center justify-center gap-3 flex-1 p-2 rounded-xl hover:bg-white/5 transition-colors text-neutral-400 hover:text-white"
          >
            <Settings size={18} />
            {!isCollapsed && <span className="text-sm">Config</span>}
          </motion.button>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-teal-400 to-teal-600 flex items-center justify-center">
            <User size={14} className="text-white" />
          </div>
          {!isCollapsed && (
            <div className="flex-1">
              <p className="text-xs font-medium text-white">Docente Principal</p>
              <p className="text-[10px] text-neutral-500">admin@netmaster.com</p>
            </div>
          )}
          {!isCollapsed && <LogOut size={14} className="text-neutral-600 cursor-pointer hover:text-red-400 transition-colors" />}
        </div>
      </div>
    </div>
  );

  if (typeof window !== 'undefined' && window.innerWidth < 768) {
    return (
      <>
        <button onClick={() => setIsMobileOpen(true)} className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-[#1A1A1A] border border-white/10">
          <Menu size={20} className="text-white" />
        </button>
        <AnimatePresence>
          {isMobileOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 z-40" onClick={() => setIsMobileOpen(false)} />
              <motion.div initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} className="fixed left-0 top-0 h-full z-50 shadow-2xl">
                {sidebarContent}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </>
    );
  }

  return sidebarContent;
}

// ============================================
// CHAT MESSAGE CENTRADO CON PASTELES OSCUROS
// ============================================

type MessageAction = {
  label: string;
  onClick: () => void;
  icon?: React.ElementType;
  variant?: 'primary' | 'secondary' | 'accent';
};

type ChatMessageProps = {
  message: string;
  isUser: boolean;
  timestamp?: Date;
  actions?: MessageAction[];
  metadata?: {
    type?: 'exam' | 'plan' | 'analysis' | 'general';
    data?: any;
  };
};

function ChatMessage({ message, isUser, timestamp, actions, metadata }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getMessageStyle = () => {
    if (isUser) {
      return 'bg-gradient-to-r from-teal-500/20 to-teal-600/15 border border-teal-500/30 text-teal-100 rounded-2xl';
    }
    if (metadata?.type === 'exam') {
      return 'bg-gradient-to-r from-purple-500/15 to-purple-600/10 border border-purple-500/25 text-purple-100 rounded-2xl';
    }
    if (metadata?.type === 'plan') {
      return 'bg-gradient-to-r from-blue-500/15 to-blue-600/10 border border-blue-500/25 text-blue-100 rounded-2xl';
    }
    if (metadata?.type === 'analysis') {
      return 'bg-gradient-to-r from-amber-500/15 to-amber-600/10 border border-amber-500/25 text-amber-100 rounded-2xl';
    }
    return 'bg-[#1E1E1E] border border-white/10 text-neutral-200 rounded-2xl';
  };

  const getIconStyle = () => {
    if (isUser) return 'bg-gradient-to-r from-teal-400 to-teal-600';
    if (metadata?.type === 'exam') return 'bg-gradient-to-r from-purple-400 to-purple-600';
    if (metadata?.type === 'plan') return 'bg-gradient-to-r from-blue-400 to-blue-600';
    if (metadata?.type === 'analysis') return 'bg-gradient-to-r from-amber-400 to-amber-600';
    return 'bg-gradient-to-r from-teal-400 to-teal-600';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {!isUser && (
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={`w-8 h-8 rounded-full ${getIconStyle()} flex items-center justify-center shadow-lg flex-shrink-0`}
        >
          <Bot size={16} className="text-white" />
        </motion.div>
      )}
      
      <div className={`max-w-[70%] ${!isUser ? 'min-w-[200px]' : ''}`}>
        <motion.div 
          whileHover={{ scale: 1.01 }}
          className={`p-4 ${getMessageStyle()} shadow-lg backdrop-blur-sm`}
        >
          <div className="text-sm leading-relaxed whitespace-pre-wrap">{message}</div>
          
          {timestamp && (
            <div className={`text-[10px] mt-2 opacity-60 ${isUser ? 'text-teal-200' : 'text-neutral-400'}`}>
              {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </motion.div>
        
        {!isUser && actions && actions.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-2 mt-2 ml-2 flex-wrap"
          >
            {actions.map((action, idx) => (
              <motion.button
                key={idx}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={action.onClick}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-neutral-300 hover:text-white transition-all border border-white/5 hover:border-teal-500/30`}
              >
                {action.icon && <action.icon size={12} />}
                {action.label}
              </motion.button>
            ))}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleCopy}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-neutral-300 hover:text-white transition-all border border-white/5"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copiado' : 'Copiar'}
            </motion.button>
          </motion.div>
        )}
      </div>
      
      {isUser && (
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-8 h-8 rounded-full bg-gradient-to-r from-neutral-700 to-neutral-800 border border-white/10 flex items-center justify-center flex-shrink-0"
        >
          <User size={14} className="text-neutral-300" />
        </motion.div>
      )}
    </motion.div>
  );
}

// ============================================
// AGENTE IA MEJORADO
// ============================================

type ConversationContext = {
  lastExamRequest?: { subject?: string; topic?: string; difficulty?: string };
  pendingInfo?: string[];
  currentPlan?: any;
  conversationHistory?: { role: string; content: string }[];
};

class IntelligentAgent {
  private context: ConversationContext = {};

  processInput(input: string): { response: string; actions?: MessageAction[]; metadata?: any } {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('examen') || lowerInput.includes('evaluación') || lowerInput.includes('test')) {
      return this.handleExamRequest(input);
    }
    
    if (lowerInput.includes('plan') || lowerInput.includes('estudio') || lowerInput.includes('cronograma')) {
      return this.handleStudyPlanRequest(input);
    }
    
    if (lowerInput.includes('analizar') || lowerInput.includes('rendimiento') || lowerInput.includes('métrica')) {
      return this.handleAnalysisRequest(input);
    }
    
    return this.getDefaultResponse();
  }

  private handleExamRequest(input: string): any {
    const subjectMatch = input.match(/(matemáticas|física|programación|lengua|historia|química|biología|inglés)/i);
    const difficultyMatch = input.match(/(fácil|medio|difícil|bajo|alto)/i);
    const questionCountMatch = input.match(/(\d+)\s*(preguntas|pregunta)/i);
    
    const subject = subjectMatch?.[1] || null;
    const difficulty = difficultyMatch?.[1] || null;
    const questionCount = questionCountMatch?.[1] || null;
    
    let response = '';
    let actions: MessageAction[] = [];
    let metadata = { type: 'exam' as const, data: { subject, difficulty, questionCount } };
    
    if (subject && difficulty && questionCount) {
      response = `✨ **¡Examen generado exitosamente!** ✨\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📚 **Materia:** ${subject}\n` +
        `🎯 **Dificultad:** ${difficulty}\n` +
        `📝 **Cantidad de preguntas:** ${questionCount}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `El examen ha sido generado con éxito y está listo para revisar. ¿Necesitas ajustar algún parámetro o prefieres visualizarlo ahora?`;
      
      actions = [
        { label: '👁️ Ver examen', onClick: () => console.log('Ver examen'), variant: 'primary' },
        { label: '⚙️ Ajustar parámetros', onClick: () => console.log('Ajustar'), variant: 'secondary' },
        { label: '📥 Descargar PDF', onClick: () => console.log('Descargar'), variant: 'accent' }
      ];
    } else {
      response = `🎓 **Generador de Exámenes IA**\n\n` +
        `Para crear un examen personalizado y de calidad, necesito que me proporciones:\n\n` +
        `• **Materia** (ej: Matemáticas, Física, Programación)\n` +
        `• **Dificultad** (Fácil, Medio o Difícil)\n` +
        `• **Cantidad de preguntas** (número deseado)\n` +
        `• **Tipo de preguntas** (opcional: teóricas, prácticas o mixtas)\n\n` +
        `¿Me proporcionas estos detalles para comenzar?`;
      
      actions = [
        { label: '📐 Ejemplo: Matemáticas', onClick: () => console.log('Ejemplo Matemáticas') },
        { label: '🔬 Ejemplo: Física', onClick: () => console.log('Ejemplo Física') },
        { label: '💻 Ejemplo: Programación', onClick: () => console.log('Ejemplo Programación') }
      ];
      
      this.context.pendingInfo = ['Materia', 'Dificultad', 'Cantidad de preguntas'];
    }
    
    this.context.lastExamRequest = { subject: subject || undefined, topic: undefined, difficulty: difficulty || undefined };
    
    return { response, actions, metadata };
  }

  private handleStudyPlanRequest(input: string): any {
    const examMatch = input.match(/(\d+)\s*(exámenes|examen)/i);
    const daysMatch = input.match(/(\d+)\s*(días|dia)/i);
    
    let response = '';
    let actions: MessageAction[] = [];
    let metadata = { type: 'plan' as const };
    
    if (examMatch && daysMatch) {
      const examCount = parseInt(examMatch[1]);
      const daysAvailable = parseInt(daysMatch[1]);
      const hoursPerDay = Math.ceil(examCount * 1.5);
      
      response = `📚 **Plan de Estudio Optimizado** 📚\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📊 **Análisis realizado:**\n` +
        `• ${examCount} exámenes en ${daysAvailable} días\n` +
        `• **Horas diarias sugeridas:** ${hoursPerDay} horas\n` +
        `• **Días por materia:** ${Math.ceil(daysAvailable / examCount)} días\n` +
        `• **Recomendación de repaso:** 45 minutos diarios\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `**🎯 Estrategia recomendada:**\n` +
        `1. Priorizar las materias más difíciles\n` +
        `2. Distribuir bloques de 50 min con pausas de 10 min\n` +
        `3. Realizar repasos activos cada 3 días\n\n` +
        `¿Deseas que profundice en alguna materia específica o ajustar el plan según tus necesidades?`;
      
      actions = [
        { label: '📋 Ver plan detallado', onClick: () => console.log('Ver plan') },
        { label: '⚙️ Ajustar horario', onClick: () => console.log('Ajustar') },
        { label: '📅 Exportar calendario', onClick: () => console.log('Exportar') }
      ];
    } else {
      response = `🎯 **Planificador de Estudio Inteligente**\n\n` +
        `Para crear un plan de estudio efectivo y personalizado, necesito:\n\n` +
        `• **Cantidad de exámenes** a preparar\n` +
        `• **Días disponibles** hasta el primer examen\n` +
        `• **Materias específicas** (opcional pero recomendado)\n` +
        `• **Horas disponibles por día** (para ajuste fino)\n\n` +
        `💡 **Ejemplo:** "Plan de estudio para 3 exámenes en 15 días"`;
      
      actions = [
        { label: '📚 Ejemplo: 3 exámenes, 15 días', onClick: () => console.log('Ejemplo') },
        { label: '⚡ Plan intensivo', onClick: () => console.log('Intensivo') },
        { label: '🌿 Plan distribuido', onClick: () => console.log('Distribuido') }
      ];
    }
    
    return { response, actions, metadata };
  }

  private handleAnalysisRequest(input: string): any {
    let response = `📊 **Análisis de Rendimiento Académico** 📊\n\n`;
    let metadata = { type: 'analysis' as const };
    
    response += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📈 **Métricas Generales:**\n` +
      `• Rendimiento general del curso: **78%**\n` +
      `• Tendencia: ▲ +5% vs mes anterior\n` +
      `• Participación activa: 82%\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `**⭐ Puntos Destacados:**\n` +
      `• ✅ Mejor desempeño: Programación (89%)\n` +
      `• ⚠️ Área de mejora: Matemáticas (65%)\n` +
      `• 📈 Materia con mayor progreso: Física (+12%)\n\n` +
      `**💡 Recomendaciones Personalizadas:**\n` +
      `1. Reforzar ejercicios prácticos de álgebra\n` +
      `2. Programar tutorías de apoyo los martes\n` +
      `3. Generar exámenes de práctica semanales\n` +
      `4. Implementar kahoots interactivos\n\n` +
      `¿Necesitas un análisis más detallado de alguna materia en específico?`;
    
    return { response, metadata };
  }

  private getDefaultResponse(): any {
    return {
      response: `🤖 **Asistente Académico NetMaster**\n\n` +
        `¡Hola! Soy tu asistente personal con IA. Estoy aquí para ayudarte con:\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📝 **Generar exámenes** personalizados\n` +
        `📚 **Crear planes de estudio** optimizados\n` +
        `📊 **Analizar rendimiento** académico\n` +
        `📅 **Gestionar fechas** de evaluación\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `¿En qué puedo asistirte hoy? Describe tu necesidad y trabajaré en ello inmediatamente.`,
      metadata: { type: 'general' }
    };
  }
}

// ============================================
// SUGGESTIONS MEJORADAS
// ============================================
function Suggestions({ onSuggestionClick }: { onSuggestionClick: (text: string) => void }) {
  const suggestions = [
    { icon: <FileText size={18} />, title: 'Generar examen', description: 'Ej: "Genera un examen de Matemáticas nivel medio con 15 preguntas"', color: 'from-teal-400/20 to-teal-500/10', iconColor: 'text-teal-400' },
    { icon: <BookOpen size={18} />, title: 'Plan de estudio', description: 'Ej: "Crea un plan para 3 exámenes en 20 días"', color: 'from-blue-400/20 to-blue-500/10', iconColor: 'text-blue-400' },
    { icon: <TrendingUp size={18} />, title: 'Analizar rendimiento', description: 'Ej: "Analiza el rendimiento de la clase"', color: 'from-amber-400/20 to-amber-500/10', iconColor: 'text-amber-400' },
    { icon: <Target size={18} />, title: 'Optimizar horario', description: 'Ej: "Optimiza mi horario de estudio con 4 horas diarias"', color: 'from-purple-400/20 to-purple-500/10', iconColor: 'text-purple-400' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 max-w-2xl mx-auto">
      {suggestions.map((sug, idx) => (
        <motion.button
          key={idx}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.1, type: "spring", stiffness: 300 }}
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSuggestionClick(sug.description)}
          className={`p-4 rounded-xl bg-gradient-to-r ${sug.color} hover:shadow-lg transition-all duration-300 text-left group border border-white/10 backdrop-blur-sm`}
        >
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${sug.iconColor} bg-white/5`}>
            {sug.icon}
          </div>
          <h3 className="text-sm font-semibold text-white mb-1">{sug.title}</h3>
          <p className="text-xs text-neutral-400 line-clamp-2">{sug.description}</p>
        </motion.button>
      ))}
    </div>
  );
}

// ============================================
// PLANNER VIEW CENTRADO
// ============================================
function PlannerView() {
  const [messages, setMessages] = useState<{ 
    role: 'user' | 'ai'; 
    text: string; 
    timestamp: Date;
    actions?: MessageAction[];
    metadata?: any;
  }[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isChatStarted, setIsChatStarted] = useState(false);
  const agent = useRef(new IntelligentAgent()).current;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    setIsChatStarted(true);
    
    setMessages(prev => [...prev, { 
      role: 'user', 
      text: input, 
      timestamp: new Date() 
    }]);
    
    const userInput = input;
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const { response, actions, metadata } = agent.processInput(userInput);
      
      setMessages(prev => [...prev, { 
        role: 'ai', 
        text: response, 
        timestamp: new Date(),
        actions,
        metadata
      }]);
      setIsTyping(false);
    }, 1000);
  };

  const handleSuggestion = (text: string) => {
    setInput(text);
    setTimeout(() => handleSend(), 100);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto pb-32">
        {!isChatStarted ? (
          <div className="flex flex-col items-center justify-center min-h-[85vh]">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center max-w-3xl mx-auto px-4"
            >
              <motion.div
                animate={{ 
                  scale: [1, 1.05, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  repeatDelay: 3
                }}
                className="w-24 h-24 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-teal-500/20"
              >
                <Sparkles size={36} className="text-white" />
              </motion.div>
              <h1 className="text-3xl font-bold text-white mb-3">Planificador Inteligente</h1>
              <p className="text-neutral-400 max-w-md mx-auto mb-8">
                Tu asistente académico con IA. Genera exámenes, crea planes de estudio personalizados 
                y analiza el rendimiento de tu clase.
              </p>
              
              <div className="flex justify-center gap-8 mb-10">
                {[
                  { value: '24', label: 'Exámenes creados', icon: FileText, color: 'text-teal-400' },
                  { value: '156', label: 'Alumnos activos', icon: User, color: 'text-blue-400' },
                  { value: '94%', label: 'Tasa de éxito', icon: Award, color: 'text-amber-400' }
                ].map((stat, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.1 }}
                    className="text-center"
                  >
                    <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                    <div className="text-neutral-500 text-xs mt-1">{stat.label}</div>
                  </motion.div>
                ))}
              </div>
              
              <Suggestions onSuggestionClick={handleSuggestion} />
            </motion.div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4 py-6 px-4">
            <AnimatePresence>
              {messages.map((msg, idx) => (
                <ChatMessage 
                  key={idx} 
                  message={msg.text} 
                  isUser={msg.role === 'user'} 
                  timestamp={msg.timestamp}
                  actions={msg.actions}
                  metadata={msg.metadata}
                />
              ))}
              {isTyping && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3 justify-start"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-teal-400 to-teal-600 flex items-center justify-center">
                    <Bot size={16} className="text-white" />
                  </div>
                  <div className="bg-[#1E1E1E] border border-white/10 rounded-2xl px-4 py-3">
                    <div className="flex gap-1.5">
                      <motion.span 
                        animate={{ y: [0, -6, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                        className="w-2 h-2 bg-teal-400 rounded-full" 
                      />
                      <motion.span 
                        animate={{ y: [0, -6, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                        className="w-2 h-2 bg-teal-400 rounded-full" 
                      />
                      <motion.span 
                        animate={{ y: [0, -6, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
                        className="w-2 h-2 bg-teal-400 rounded-full" 
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input centrado mejorado */}
      <div className="fixed bottom-0 left-0 right-0 md:left-72 p-4 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A] to-transparent">
        <div className="max-w-3xl mx-auto">
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="relative bg-[#1A1A1A] border border-white/10 rounded-2xl p-2 shadow-2xl focus-within:ring-2 focus-within:ring-teal-500/30 transition-all"
          >
            <div className="flex items-center px-2 gap-1 border-b border-white/5 pb-1 mb-1">
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-neutral-500"
              >
                <Paperclip size={14} />
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-neutral-500"
              >
                <Mic size={14} />
              </motion.button>
              <div className="flex-1" />
              <span className="text-[10px] text-neutral-600 bg-white/5 px-2 py-0.5 rounded-full">IA Asistente</span>
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Describe lo que necesitas... (ej: Genera un examen de Matemáticas nivel medio con 15 preguntas)"
              className="w-full bg-transparent p-3 outline-none text-sm resize-none h-14 max-h-32 placeholder:text-neutral-600 text-white"
            />
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSend} 
              disabled={!input.trim()}
              className="absolute right-3 bottom-3 p-2 bg-gradient-to-r from-teal-400 to-teal-500 text-white rounded-xl hover:shadow-lg hover:shadow-teal-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={16} />
            </motion.button>
          </motion.div>
          <p className="text-center text-xs text-neutral-600 mt-2">
            NetMaster IA puede cometer errores. Verifica la información importante.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// DASHBOARD VIEW
// ============================================
function DashboardView() {
  const stats = [
    { label: 'Exámenes creados', value: '24', change: '+12%', icon: FileText, color: 'from-teal-400 to-emerald-500' },
    { label: 'Alumnos activos', value: '156', change: '+8%', icon: User, color: 'from-blue-400 to-cyan-500' },
    { label: 'Recordatorios', value: '187', change: '+23%', icon: Bell, color: 'from-purple-400 to-pink-500' },
    { label: 'Tasa de éxito', value: '94%', change: '+5%', icon: TrendingUp, color: 'from-amber-400 to-orange-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard</h1>
        <p className="text-sm text-neutral-400 mt-1">Bienvenido de vuelta, Docente</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <motion.div 
            key={idx} 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: idx * 0.1 }}
            whileHover={{ y: -2 }}
            className="p-4 rounded-xl bg-[#1A1A1A] border border-white/10 hover:border-teal-500/30 transition-all"
          >
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-r ${stat.color} flex items-center justify-center mb-3 shadow-lg`}>
              <stat.icon size={18} className="text-white" />
            </div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-xs text-neutral-400 mt-1">{stat.label}</p>
            <p className="text-xs text-teal-400 mt-1">{stat.change}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-5 rounded-xl bg-[#1A1A1A] border border-white/10">
          <h3 className="text-sm font-semibold text-white mb-4">Próximos exámenes</h3>
          <div className="space-y-3">
            {[
              { subject: 'Matemáticas', date: '20/06/2025', students: 32 },
              { subject: 'Física', date: '22/06/2025', students: 28 },
              { subject: 'Programación', date: '25/06/2025', students: 30 },
            ].map((exam, i) => (
              <motion.div 
                key={i} 
                whileHover={{ x: 4 }}
                className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
              >
                <div>
                  <p className="text-sm font-medium text-white">{exam.subject}</p>
                  <p className="text-xs text-neutral-500">{exam.date} • {exam.students} alumnos</p>
                </div>
                <button className="px-3 py-1.5 rounded-lg bg-teal-600/20 text-teal-400 text-xs font-medium border border-teal-500/30 hover:bg-teal-600/30 transition-colors">
                  Ver
                </button>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="p-5 rounded-xl bg-[#1A1A1A] border border-white/10">
          <h3 className="text-sm font-semibold text-white mb-4">Actividad reciente</h3>
          <div className="space-y-3">
            {[
              { action: 'Examen de Matemáticas generado', time: 'Hace 2 horas', icon: Sparkles, color: 'text-teal-400' },
              { action: 'Recordatorio enviado a 32 alumnos', time: 'Hace 5 horas', icon: Bell, color: 'text-blue-400' },
              { action: 'Plan de estudio optimizado', time: 'Ayer', icon: BrainCircuit, color: 'text-purple-400' },
            ].map((act, i) => (
              <motion.div 
                key={i} 
                whileHover={{ x: 4 }}
                className="flex items-center gap-3 p-3 bg-white/5 rounded-lg"
              >
                <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center">
                  <act.icon size={14} className={act.color} />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-white">{act.action}</p>
                  <p className="text-[10px] text-neutral-500">{act.time}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// HISTORY VIEW
// ============================================
function HistoryView() {
  const history = [
    { id: 1, title: 'Examen de Matemáticas - Álgebra', date: '15/06/2025', type: 'examen', status: 'completado' },
    { id: 2, title: 'Plan de estudio - Semana 1', date: '10/06/2025', type: 'plan', status: 'activo' },
    { id: 3, title: 'Evaluación de Programación', date: '05/06/2025', type: 'examen', status: 'completado' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Historial</h1>
        <p className="text-sm text-neutral-400 mt-1">Registro de actividades y exámenes generados</p>
      </div>

      <div className="space-y-3">
        {history.map((item, idx) => (
          <motion.div 
            key={item.id} 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: idx * 0.1 }}
            whileHover={{ x: 4 }}
            className="p-4 rounded-xl bg-[#1A1A1A] border border-white/10 hover:bg-[#242424] transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center">
                {item.type === 'examen' ? <FileText size={18} className="text-teal-400" /> : <BrainCircuit size={18} className="text-teal-400" />}
              </div>
              <div>
                <p className="text-sm font-medium text-white">{item.title}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-neutral-500">{item.date}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${item.status === 'completado' ? 'bg-teal-500/20 text-teal-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    {item.status}
                  </span>
                </div>
              </div>
            </div>
            <button className="p-2 rounded-lg hover:bg-white/10 transition-colors">
              <ChevronRight size={16} className="text-neutral-500" />
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// PROJECTS VIEW
// ============================================
function ProjectsView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Proyectos</h1>
        <p className="text-sm text-neutral-400 mt-1">Gestión de proyectos académicos</p>
      </div>
      <div className="text-center py-12 text-neutral-500 bg-[#1A1A1A] rounded-xl border border-white/10">
        <Briefcase size={32} className="mx-auto mb-3 text-neutral-600" />
        <p>Sección en desarrollo</p>
      </div>
    </div>
  );
}

// ============================================
// ANALYTICS VIEW
// ============================================
function AnalyticsView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Analítica</h1>
        <p className="text-sm text-neutral-400 mt-1">Métricas y estadísticas del sistema</p>
      </div>
      <div className="text-center py-12 text-neutral-500 bg-[#1A1A1A] rounded-xl border border-white/10">
        <LineChart size={32} className="mx-auto mb-3 text-neutral-600" />
        <p>Sección en desarrollo</p>
      </div>
    </div>
  );
}

// ============================================
// ARTIFACT PANEL
// ============================================
function ArtifactPanel({ activeTab, setActiveTab }: { activeTab: string; setActiveTab: (tab: string) => void }) {
  const [weights, setWeights] = useState([{ id: 1, name: 'Parcial 1', val: 30 }]);

  return (
    <div className="w-80 bg-gradient-to-b from-[#121212] to-[#0A0A0A] backdrop-blur-xl border-l border-white/5 flex flex-col h-full">
      <div className="p-4 border-b border-white/5">
        <h3 className="font-bold text-neutral-200 text-sm flex items-center gap-2">
          <BrainCircuit size={16} className="text-teal-400" />
          Centro de Control
        </h3>
      </div>

      <div className="flex border-b border-white/5">
        {[
          { id: 'grading', label: 'Ponderación', icon: <Plus size={12} /> },
          { id: 'docs', label: 'Documentos', icon: <FileText size={12} /> },
          { id: 'notify', label: 'Alertas', icon: <Bell size={12} /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1 ${activeTab === tab.id ? 'text-teal-400 bg-white/5 border-b-2 border-teal-400' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {activeTab === 'grading' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
              <span className="text-xs text-neutral-400 font-bold">Ponderación de evaluaciones</span>
              <button onClick={() => setWeights([...weights, { id: Date.now(), name: 'Nueva Eval', val: 0 }])} className="text-teal-400 hover:bg-teal-500/10 p-1 rounded transition-colors">
                <Plus size={14} />
              </button>
            </div>
            <AnimatePresence>
              {weights.map((w) => (
                <motion.div key={w.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex gap-2 items-center bg-white/5 p-2 rounded-lg border border-white/10 hover:border-white/20 transition-colors">
                  <input className="bg-transparent flex-1 text-xs text-neutral-300 outline-none placeholder:text-neutral-700" placeholder="Nombre" defaultValue={w.name} />
                  <input className="bg-[#0A0A0A] w-14 text-center text-xs rounded border border-white/10 py-1 text-neutral-300" defaultValue={`${w.val}%`} />
                  <button onClick={() => setWeights(weights.filter(x => x.id !== w.id))} className="text-neutral-600 hover:text-red-400 transition-colors">
                    <Trash2 size={12} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
            <button className="w-full mt-4 py-2 rounded-lg bg-teal-600/20 text-teal-400 text-xs font-medium border border-teal-500/30 hover:bg-teal-600/30 transition-colors">
              Aplicar ponderación
            </button>
          </div>
        )}

        {activeTab === 'docs' && (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-white/5 border border-white/10 flex items-center gap-3">
              <FileText size={20} className="text-teal-400" />
              <div className="flex-1">
                <p className="text-xs font-medium text-white">Plan_Examenes.pdf</p>
                <p className="text-[10px] text-neutral-500">Subido hace 2 días • 2.4 MB</p>
              </div>
              <button className="text-neutral-500 hover:text-white transition-colors">
                <Download size={14} />
              </button>
            </div>
          </div>
        )}

        {activeTab === 'notify' && (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-3">
              <AlertCircle size={18} className="text-amber-400" />
              <div className="flex-1">
                <p className="text-xs font-medium text-white">Próximo examen: Matemáticas</p>
                <p className="text-[10px] text-neutral-500">Faltan 3 días</p>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center gap-3">
              <CheckCircle2 size={18} className="text-teal-400" />
              <div className="flex-1">
                <p className="text-xs font-medium text-white">Examen generado con IA</p>
                <p className="text-[10px] text-neutral-500">Hace 2 horas</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// MAIN APP
// ============================================
export default function ProfessionalSuite() {
  const [activeView, setActiveView] = useState('planner');
  const [activeTab, setActiveTab] = useState('grading');
  const [isDark, setIsDark] = useState(true);

  const renderView = () => {
    switch (activeView) {
      case 'planner': return <PlannerView />;
      case 'dashboard': return <DashboardView />;
      case 'history': return <HistoryView />;
      case 'projects': return <ProjectsView />;
      case 'analytics': return <AnalyticsView />;
      default: return <PlannerView />;
    }
  };

  return (
    <div className={cn('flex h-screen overflow-hidden', isDark ? 'dark' : '')}>
      <div className="flex h-screen w-full bg-[#0A0A0A]">
        <ImprovedSidebar activeView={activeView} setActiveView={setActiveView} isDark={isDark} onToggleTheme={() => setIsDark(!isDark)} />
        <main className="flex-1 flex flex-col overflow-hidden relative">
          <div className="flex-1 overflow-y-auto p-6">
            {renderView()}
          </div>
        </main>
        <ArtifactPanel activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
    </div>
  );
}