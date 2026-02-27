
import React from 'react';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'motion/react';
import { X, GraduationCap, CheckCircle2, Play, BookOpen, Trophy, Star } from 'lucide-react';
import { TrainingExercise } from '../types';

const EXERCISES: TrainingExercise[] = [
  {
    id: 'ex-1',
    name: 'Corporate Protocol 101',
    description: 'Learn the fundamental communication guidelines for Corporate Claw agents.',
    difficulty: 'Junior',
    completed: false
  },
  {
    id: 'ex-2',
    name: 'Efficient Resource Allocation',
    description: 'Optimize mission outcomes by balancing department resources and agent focus.',
    difficulty: 'Senior',
    completed: false
  },
  {
    id: 'ex-3',
    name: 'Strategic Vision Alignment',
    description: 'Align individual agent missions with the long-term goals of Corporate Claw.',
    difficulty: 'Executive',
    completed: false
  },
  {
    id: 'ex-4',
    name: 'Conflict Resolution & Synergy',
    description: 'Manage inter-departmental friction to maintain high company efficiency.',
    difficulty: 'Senior',
    completed: false
  }
];

const TrainingModule: React.FC = () => {
  const { trainingState, setTrainingMode, startExercise, completeExercise } = useStore();

  if (!trainingState.isTrainingMode) return null;

  const handleClose = () => {
    setTrainingMode(false);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-8 pointer-events-none"
      >
        <div className="bg-white/95 backdrop-blur-2xl w-full max-w-4xl h-full max-h-[80vh] rounded-[40px] border border-black/5 shadow-2xl flex flex-col pointer-events-auto overflow-hidden">
          {/* Header */}
          <div className="p-8 border-b border-zinc-100 flex justify-between items-center bg-white/50">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                <GraduationCap size={24} />
              </div>
              <div>
                <h2 className="text-3xl font-black text-zinc-900 tracking-tight uppercase">Training Simulation</h2>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Skill-based Exercises & Tutorials</p>
              </div>
            </div>
            <button 
              onClick={handleClose}
              className="p-3 hover:bg-zinc-100 rounded-2xl transition-all text-zinc-400 hover:text-zinc-900 active:scale-90"
            >
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-8 [scrollbar-width:none]">
            {trainingState.activeExercise ? (
              <div className="max-w-2xl mx-auto space-y-8 py-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      trainingState.activeExercise.difficulty === 'Junior' ? 'bg-emerald-50 text-emerald-600' :
                      trainingState.activeExercise.difficulty === 'Senior' ? 'bg-amber-50 text-amber-600' :
                      'bg-rose-50 text-rose-600'
                    }`}>
                      {trainingState.activeExercise.difficulty} Level
                    </span>
                  </div>
                  <h3 className="text-4xl font-black text-zinc-900 tracking-tight">{trainingState.activeExercise.name}</h3>
                  <p className="text-lg text-zinc-500 leading-relaxed font-medium">
                    {trainingState.activeExercise.description}
                  </p>
                </div>

                <div className="bg-zinc-50 rounded-3xl p-8 border border-zinc-100 space-y-6">
                  <h4 className="text-sm font-black text-zinc-900 uppercase tracking-widest flex items-center gap-2">
                    <BookOpen size={16} />
                    Simulation Steps
                  </h4>
                  <ul className="space-y-4">
                    {[
                      'Review the current mission parameters and agent profiles.',
                      'Identify potential bottlenecks in the communication flow.',
                      'Apply Corporate Claw standard protocols to resolve conflicts.',
                      'Verify the outcome and measure efficiency gains.'
                    ].map((step, i) => (
                      <li key={i} className="flex gap-4 items-start">
                        <div className="w-6 h-6 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-[10px] font-black text-zinc-400 shrink-0 mt-0.5">
                          {i + 1}
                        </div>
                        <p className="text-sm text-zinc-600 font-medium">{step}</p>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => completeExercise(trainingState.activeExercise!.id)}
                    className="flex-1 py-4 bg-zinc-900 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2"
                  >
                    Complete Simulation
                    <CheckCircle2 size={18} />
                  </button>
                  <button 
                    onClick={() => startExercise(null as any)}
                    className="px-8 py-4 bg-white text-zinc-400 border border-zinc-200 rounded-2xl text-sm font-black uppercase tracking-widest hover:text-zinc-900 hover:border-zinc-900 transition-all active:scale-95"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {EXERCISES.map((ex) => {
                  const isCompleted = trainingState.completedExercises.includes(ex.id);
                  return (
                    <div 
                      key={ex.id}
                      className={`group relative bg-white p-8 rounded-[32px] border transition-all duration-300 ${
                        isCompleted ? 'border-emerald-100 bg-emerald-50/10' : 'border-zinc-100 hover:border-zinc-900 hover:shadow-xl'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-6">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                          isCompleted ? 'bg-emerald-500 text-white' : 'bg-zinc-50 text-zinc-400 group-hover:bg-zinc-900 group-hover:text-white'
                        } transition-colors`}>
                          {isCompleted ? <Trophy size={24} /> : <Play size={24} />}
                        </div>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          ex.difficulty === 'Junior' ? 'bg-emerald-50 text-emerald-600' :
                          ex.difficulty === 'Senior' ? 'bg-amber-50 text-amber-600' :
                          'bg-rose-50 text-rose-600'
                        }`}>
                          {ex.difficulty}
                        </span>
                      </div>
                      <h3 className="text-xl font-black text-zinc-900 mb-2 tracking-tight">{ex.name}</h3>
                      <p className="text-xs text-zinc-400 font-medium leading-relaxed mb-8">
                        {ex.description}
                      </p>
                      <button 
                        onClick={() => startExercise(ex)}
                        className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          isCompleted 
                          ? 'bg-emerald-50 text-emerald-600 cursor-default' 
                          : 'bg-zinc-900 text-white hover:bg-black shadow-lg active:scale-95'
                        }`}
                      >
                        {isCompleted ? 'Simulation Completed' : 'Start Simulation'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Stats */}
          <div className="p-8 bg-zinc-50/50 border-t border-zinc-100 flex justify-between items-center">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Star className="text-amber-400" size={16} />
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                  Progress: {trainingState.completedExercises.length} / {EXERCISES.length}
                </span>
              </div>
              <div className="h-1.5 w-32 bg-zinc-200 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(trainingState.completedExercises.length / EXERCISES.length) * 100}%` }}
                  className="h-full bg-indigo-600"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Rank:</span>
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                {trainingState.completedExercises.length === EXERCISES.length ? 'Executive Master' : 
                 trainingState.completedExercises.length >= 2 ? 'Senior Associate' : 'Junior Intern'}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default TrainingModule;
