"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Zap, BrainCircuit, Plus, Trash2, Send, Upload, 
  KanbanSquare, CalendarDays, History, Briefcase, LineChart, Settings
} from 'lucide-react';

// --- COMPONENTE: SIDEBAR RENOVADO ---
const ImprovedSidebar = () => (
  <aside className="w-20 lg:w-72 bg-[#050505] border-r border-white/5 flex flex-col justify-between p-6 transition-all duration-500">
    <div className="space-y-8">
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="w-14 h-14 bg-gradient-to-tr from-teal-600 to-teal-400 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-900/20">
          <Zap size={28} className="text-white"/>
        </div>
        <div className="text-center hidden lg:block space-y-1">
          <h2 className="font-bold text-white text-lg tracking-tight">EduAgent</h2>
          <span className="text-[10px] text-teal-500 font-bold uppercase tracking-widest bg-teal-500/10 px-2 py-0.5 rounded-full">v2.4 Pro</span>
        </div>
      </div>

      <nav className="space-y-1">
        <div className="px-4 py-2 text-[10px] font-bold text-neutral-700 uppercase tracking-widest text-center lg:text-left">General</div>
        {[
            { icon: KanbanSquare, name: 'Dashboard' },
            { icon: CalendarDays, name: 'Planner' },
            { icon: History, name: 'Historial' }
        ].map((item) => (
            <button key={item.name} className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-neutral-900/50 hover:text-white transition-all group">
                <item.icon size={18} className="text-neutral-600 group-hover:text-teal-500"/>
                <span className="hidden lg:block text-sm font-medium">{item.name}</span>
            </button>
        ))}
      </nav>

      <nav className="space-y-1">
        <div className="px-4 py-2 text-[10px] font-bold text-neutral-700 uppercase tracking-widest text-center lg:text-left">Gestión</div>
        {[
            { icon: Briefcase, name: 'Proyectos' },
            { icon: LineChart, name: 'Analítica' }
        ].map((item) => (
            <button key={item.name} className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-neutral-900/50 hover:text-white transition-all group">
                <item.icon size={18} className="text-neutral-600 group-hover:text-teal-500"/>
                <span className="hidden lg:block text-sm font-medium">{item.name}</span>
            </button>
        ))}
      </nav>
    </div>

    <div className="space-y-4">
      <div className="p-4 bg-neutral-900/20 rounded-2xl border border-white/5 hidden lg:block">
        <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-neutral-500">Créditos IA</span>
            <span className="text-[10px] text-teal-500 font-mono">85%</span>
        </div>
        <div className="h-1.5 w-full bg-black rounded-full overflow-hidden">
            <div className="h-full bg-teal-600 w-[85%] rounded-full shadow-[0_0_10px_rgba(13,148,136,0.5)]" />
        </div>
      </div>
      <button className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-neutral-900 text-neutral-500 hover:text-white transition-all">
        <Settings size={18} />
        <span className="hidden lg:block text-sm">Configuración</span>
      </button>
    </div>
  </aside>
);

// --- COMPONENTE: PANEL DE ARTEFACTOS (DERECHA) ---
const ArtifactPanel = ({ activeTab, setActiveTab }: any) => {
  const [weights, setWeights] = useState([{ id: 1, name: 'Parcial 1', val: 30 }]);
  
  return (
    <div className="w-[320px] bg-[#050505] border-l border-white/5 flex flex-col h-full">
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <h3 className="font-bold text-neutral-200 text-sm flex items-center gap-2">
          <BrainCircuit size={16} className="text-teal-500"/> Centro de Control
        </h3>
      </div>

      <div className="flex p-2 bg-neutral-950 m-2 rounded-xl">
        {['grading', 'docs', 'notify'].map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition-all ${activeTab === tab ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-600 hover:text-neutral-400'}`}>
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        {activeTab === 'grading' && (
           <div className="space-y-3">
             <div className="flex justify-between items-center px-1">
               <span className="text-xs text-neutral-500 font-bold">Ponderación</span>
               <button onClick={() => setWeights([...weights, { id: Date.now(), name: 'Nueva', val: 0 }])} className="text-teal-500 hover:text-teal-400"><Plus size={16}/></button>
             </div>
             {weights.map(w => (
               <div key={w.id} className="flex gap-2 items-center bg-neutral-900/50 p-2 rounded-lg border border-white/5 hover:border-white/10 transition-all">
                 <input className="bg-transparent w-full text-xs text-neutral-300 outline-none" defaultValue={w.name} />
                 <input className="bg-neutral-950 w-12 text-center text-xs rounded border border-white/10 py-1" defaultValue={`${w.val}%`} />
                 <button onClick={() => setWeights(weights.filter(x => x.id !== w.id))} className="text-neutral-700 hover:text-red-500 transition-colors"><Trash2 size={12}/></button>
               </div>
             ))}
           </div>
        )}
      </div>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---
export default function ProfessionalSuite() {
  const [isChatStarted, setIsChatStarted] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [input, setInput] = useState('');
  const [activeTab, setActiveTab] = useState('grading');

  const handleSend = () => {
    if (!input.trim()) return;
    setIsChatStarted(true);
    setMessages([...messages, { role: 'user', text: input }]);
    setInput('');
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'ai', text: "He procesado los datos. ¿Deseas aplicar estos cambios al dashboard central?" }]);
    }, 800);
  };

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-neutral-400 font-sans overflow-hidden">
      <ImprovedSidebar />

      <main className="flex-1 flex flex-col relative bg-gradient-to-b from-neutral-900/20 to-black/20">
         <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
            {!isChatStarted ? (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="h-full flex flex-col items-center justify-center">
                    <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-teal-900/20 to-indigo-900/20 flex items-center justify-center border border-white/5 mb-8 shadow-2xl">
                        <Zap size={40} className="text-teal-500 animate-pulse" />
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">¿Qué configuramos hoy?</h1>
                </motion.div>
            ) : (
                <div className="max-w-3xl mx-auto space-y-8 py-10">
                    {messages.map((m, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : ''}`}>
                            {m.role === 'ai' && <div className="w-8 h-8 rounded-full bg-neutral-900 flex items-center justify-center border border-white/5"><BrainCircuit size={16} className="text-teal-500" /></div>}
                            <div className={`p-4 px-5 rounded-2xl max-w-[80%] shadow-sm ${m.role === 'ai' ? 'bg-neutral-900/80 border border-white/5 text-neutral-200' : 'bg-teal-600 text-white'}`}>
                                <p className="text-sm leading-relaxed">{m.text}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
         </div>

         {/* INPUT FLOAT: ESTILO COMMAND BAR */}
         <div className="w-full max-w-3xl mx-auto p-6">
            <div className="relative bg-neutral-900/80 backdrop-blur-md border border-white/10 rounded-2xl p-2 shadow-2xl focus-within:border-teal-500/50 transition-all">
                <textarea 
                    value={input} onChange={(e) => setInput(e.target.value)}
                    placeholder="Escribe tus instrucciones para EduAgent..."
                    className="w-full bg-transparent p-4 pr-32 outline-none text-sm resize-none h-14 placeholder:text-neutral-600"
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                />
                <div className="absolute right-3 bottom-3 flex items-center gap-1">
                    <button className="p-2 text-neutral-600 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                        <Upload size={16}/>
                    </button>
                    <button onClick={handleSend} className="p-2 bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-teal-600/20">
                        <Send size={16}/>
                    </button>
                </div>
            </div>
            <p className="text-center text-[10px] text-neutral-700 mt-4">Presiona Enter para enviar</p>
         </div>
      </main>

      <ArtifactPanel activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}
