
import React from 'react';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Zap, Info, PartyPopper } from 'lucide-react';

const WorldEvents: React.FC = () => {
  const activeEvents = useStore((state) => state.activeEvents);

  return (
    <div className="fixed top-32 right-8 z-40 flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {activeEvents.map((event) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.9 }}
            className={`w-72 p-4 rounded-2xl border backdrop-blur-xl shadow-2xl pointer-events-auto ${
              event.type === 'POSITIVE' ? 'bg-emerald-50/90 border-emerald-200' :
              event.type === 'NEGATIVE' ? 'bg-rose-50/90 border-rose-200' :
              'bg-amber-50/90 border-amber-200'
            }`}
          >
            <div className="flex gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                event.type === 'POSITIVE' ? 'bg-emerald-500 text-white' :
                event.type === 'NEGATIVE' ? 'bg-rose-500 text-white' :
                'bg-amber-500 text-white'
              }`}>
                {event.type === 'POSITIVE' ? <PartyPopper size={20} /> :
                 event.type === 'NEGATIVE' ? <AlertTriangle size={20} /> :
                 <Info size={20} />}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className={`text-sm font-black uppercase tracking-tight truncate ${
                  event.type === 'POSITIVE' ? 'text-emerald-900' :
                  event.type === 'NEGATIVE' ? 'text-rose-900' :
                  'text-amber-900'
                }`}>
                  {event.name}
                </h4>
                <p className={`text-[11px] font-medium leading-tight mt-0.5 ${
                  event.type === 'POSITIVE' ? 'text-emerald-700' :
                  event.type === 'NEGATIVE' ? 'text-rose-700' :
                  'text-amber-700'
                }`}>
                  {event.description}
                </p>
                <div className="mt-2 h-1 w-full bg-black/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: '100%' }}
                    animate={{ width: '0%' }}
                    transition={{ duration: event.duration, ease: 'linear' }}
                    className={`h-full ${
                      event.type === 'POSITIVE' ? 'bg-emerald-500' :
                      event.type === 'NEGATIVE' ? 'bg-rose-500' :
                      'bg-amber-500'
                    }`}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default WorldEvents;
