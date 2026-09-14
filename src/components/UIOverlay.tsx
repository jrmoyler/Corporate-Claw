import { lazy, Suspense, useState } from 'react';
import { useStore } from '../store/useStore';
import { AGENTS } from '../data/agents';
import { Search, ChevronRight, X, Users, RotateCcw, Play, Pause, Armchair, SlidersHorizontal, UserRound, Settings, ChartNoAxesColumnIncreasing, Megaphone, Database, ArrowLeft } from 'lucide-react';
import ChatPanel from './ChatPanel';
import HelpModal from './HelpModal';
import Dashboard from './Dashboard';
import TrainingModule from './TrainingModule';
import DebugPanel from './DebugPanel';
import WorldEvents from './WorldEvents';
const FurnishingViewer = lazy(() => import('./FurnishingViewer'));

type Props = { unavailable: boolean; ready: boolean; paused: boolean; onPause: () => void; onReset: () => void };
export default function UIOverlay({ unavailable, ready, paused, onPause, onReset }: Props) {
  const state = useStore();
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('All departments');
  const [help, setHelp] = useState(false);
  const [team, setTeam] = useState(false);
  const [furnishing, setFurnishing] = useState(false);
  const departments = [{ name: 'CEO', filter: 'Executive', icon: UserRound }, { name: 'Production', filter: 'Production', icon: Settings }, { name: 'Sales', filter: 'Sales', icon: ChartNoAxesColumnIncreasing }, { name: 'Marketing', filter: 'Marketing', icon: Megaphone }, { name: 'Finance', filter: 'Finance', icon: Database }];
  const browsing = search.trim() !== '' || department !== 'All departments';
  const selected = state.selectedNpcIndex !== null ? AGENTS[state.selectedNpcIndex] : null;
  const agents = AGENTS.slice(0, state.instanceCount).filter(a => (department === 'All departments' || a.department === department) && `${a.role} ${a.department} ${a.expertise.join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  const closePanels = () => { useStore.setState({ isDashboardOpen: false, isDebugOpen: false }); state.setTrainingMode(false); setHelp(false); setFurnishing(false); };
  return <>
    <header className="workspace-header"><h1>Corporate Claw</h1><nav aria-label="Main navigation">
      <button className={!state.isDashboardOpen && !state.trainingState.isTrainingMode ? 'active' : ''} onClick={closePanels}>Office</button>
      <button className={state.isDashboardOpen ? 'active' : ''} onClick={() => { closePanels(); state.toggleDashboard(); }}>Dashboard</button>
      <button className={state.trainingState.isTrainingMode ? 'active' : ''} onClick={() => { closePanels(); state.setTrainingMode(true); }}>Training</button>
      <button onClick={() => setHelp(true)}>Help</button>
    </nav></header>
    <button className="team-toggle" onClick={() => setTeam(!team)} aria-expanded={team}><Users size={17} /> Your team</button>
    <aside className={`team-sidebar ${team ? 'mobile-open' : ''}`} aria-label="Agent directory">
      <div className="sidebar-heading"><h2>Your team</h2></div>
      <label className="agent-search"><Search size={17}/><input aria-label="Search agents" placeholder="Search agents…" value={search} onChange={e => setSearch(e.target.value)} /></label>
      {browsing && <button className="directory-back" onClick={() => { setSearch(''); setDepartment('All departments'); }}><ArrowLeft size={16}/> {department === 'All departments' ? 'All teams' : department}</button>}
      {!browsing && <div className="department-list">{departments.map(({name,filter,icon:Icon},i) => <button key={name} className="department-row" onClick={() => setDepartment(filter)}><span className={`department-icon ${i%2 ? 'green' : ''}`}><Icon size={27}/></span><span>{name}</span><ChevronRight size={19}/></button>)}</div>}
      {browsing && <div className="agent-list">{agents.map(a => <button key={a.index} className={`agent-row ${state.selectedNpcIndex === a.index ? 'selected' : ''}`} onClick={() => { state.endChat(); state.setSelectedNpc(a.isPlayer ? null : a.index); setTeam(false); }}>
        <span className="agent-avatar" style={{ background: a.color }}>{a.role.split(' ').map(w => w[0]).slice(0,2).join('')}</span><span><strong>{a.isPlayer ? 'CEO · You' : a.role}</strong><small>{a.department}</small></span><ChevronRight size={15}/>
      </button>)}{!agents.length && <p className="empty-state">No agents match your search.</p>}</div>}

    </aside>
    {selected && !state.isChatting && <section className="agent-detail" aria-label="Selected agent"><button className="close-detail" aria-label="Close agent details" onClick={() => state.setSelectedNpc(null)}><X size={18}/></button><small>{selected.department}</small><h2>{selected.role}</h2><p>{selected.mission}</p><div className="expertise">{selected.expertise.map(e => <span key={e}>{e}</span>)}</div><p className="personality">{selected.personality}</p><button className="primary-button" disabled={!ready} onClick={() => state.startChat(selected.index)}>Start conversation <ChevronRight size={16}/></button></section>}
    <footer className="simulation-toolbar"><button onClick={onPause} disabled={!ready} aria-label={paused ? 'Resume simulation' : 'Pause simulation'}>{paused ? <Play size={17}/> : <Pause size={17}/>}<span>{unavailable ? '3D view unavailable' : paused ? 'Simulation paused' : 'Live simulation'}</span></button><div><span className="agent-count"><Users size={16}/>{state.instanceCount} agents</span><button aria-label="Reset view" onClick={onReset}><RotateCcw size={16}/><span>Reset view</span></button><button aria-label="Explore furnishings" onClick={() => setFurnishing(true)}><Armchair size={17}/></button><button aria-label="Simulation settings" onClick={state.toggleDebug}><SlidersHorizontal size={17}/></button></div></footer>
    <ChatPanel/><Dashboard/><TrainingModule/><DebugPanel/><WorldEvents/><HelpModal isOpen={help} onClose={() => setHelp(false)}/>
    {furnishing && <Suspense fallback={<div className="viewer-loading" role="status">Opening furnishing studio…</div>}><FurnishingViewer onClose={() => setFurnishing(false)}/></Suspense>}
  </>;
}
