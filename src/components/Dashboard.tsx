
import React from 'react';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'motion/react';
import { X, TrendingUp, Users, Target, Zap, BarChart2, PieChart as PieChartIcon } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';

const Dashboard: React.FC = () => {
  const { isDashboardOpen, toggleDashboard, companyStats } = useStore();

  if (!isDashboardOpen) return null;

  const deptData = Object.entries(companyStats.departmentPerformance).map(([name, value]) => ({
    name,
    performance: Math.round(value * 100)
  }));

  const efficiencyData = [
    { time: '08:00', value: 82 },
    { time: '10:00', value: 88 },
    { time: '12:00', value: 94 },
    { time: '14:00', value: 91 },
    { time: '16:00', value: 95 },
    { time: '18:00', value: 89 },
  ];

  const COLORS = ['#7EACEA', '#A1C4FD', '#C2E9FB', '#E0F2F1'];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-8 pointer-events-none"
      >
        <div className="bg-white/95 backdrop-blur-2xl w-full max-w-6xl h-full max-h-[85vh] rounded-[40px] border border-black/5 shadow-2xl flex flex-col pointer-events-auto overflow-hidden">
          {/* Header */}
          <div className="p-8 border-b border-zinc-100 flex justify-between items-center bg-white/50">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center text-white shadow-lg">
                <BarChart2 size={24} />
              </div>
              <div>
                <h2 className="text-3xl font-black text-zinc-900 tracking-tight uppercase">Performance Dashboard</h2>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Corporate Claw Real-time Analytics</p>
              </div>
            </div>
            <button 
              onClick={toggleDashboard}
              className="p-3 hover:bg-zinc-100 rounded-2xl transition-all text-zinc-400 hover:text-zinc-900 active:scale-90"
            >
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                { label: 'Total Missions', value: companyStats.totalMissions, icon: Target, color: 'text-blue-500', bg: 'bg-blue-50' },
                { label: 'Success Rate', value: `${(companyStats.successRate * 100).toFixed(1)}%`, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                { label: 'Avg Efficiency', value: `${(companyStats.avgEfficiency * 100).toFixed(1)}%`, icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50' },
                { label: 'Utilization', value: `${(companyStats.resourceUtilization * 100).toFixed(1)}%`, icon: Users, color: 'text-indigo-500', bg: 'bg-indigo-50' },
              ].map((stat, i) => (
                <div key={i} className="bg-zinc-50/50 p-6 rounded-3xl border border-zinc-100 flex items-center gap-4">
                  <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center shadow-sm`}>
                    <stat.icon size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-0.5">{stat.label}</p>
                    <p className="text-2xl font-black text-zinc-900 tracking-tight">{stat.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Department Performance */}
              <div className="bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-lg font-black text-zinc-900 tracking-tight uppercase">Department Performance</h3>
                  <BarChart2 size={20} className="text-zinc-300" />
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={deptData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#A1A1AA' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#A1A1AA' }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                      />
                      <Bar dataKey="performance" fill="#7EACEA" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Efficiency Over Time */}
              <div className="bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-lg font-black text-zinc-900 tracking-tight uppercase">Efficiency Trend</h3>
                  <TrendingUp size={20} className="text-zinc-300" />
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={efficiencyData}>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#7EACEA" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#7EACEA" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#A1A1AA' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#A1A1AA' }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                      />
                      <Area type="monotone" dataKey="value" stroke="#7EACEA" strokeWidth={4} fillOpacity={1} fill="url(#colorValue)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default Dashboard;
