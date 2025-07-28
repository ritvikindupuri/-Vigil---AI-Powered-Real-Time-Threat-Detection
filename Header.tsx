import React, { useMemo } from 'react';
import type { Alert } from '../types';
import { VigilLogo, AggressionIcon, VerbalThreatIcon, ObjectAlertIcon, ResetIcon, HistoryIcon } from './icons/Icons';

interface HeaderProps {
    isMonitoring: boolean;
    onToggleMonitoring: () => void;
    alerts: Alert[];
    onResetSession: () => void;
    onToggleHistory: () => void;
}

const MetricDisplay: React.FC<{ title: string; value: number; icon: React.ReactNode;}> = ({ title, value, icon }) => (
    <div className="flex items-center gap-3">
        {icon}
        <div>
            <p className="text-white text-lg font-semibold">{value}</p>
            <p className="text-slate-400 text-xs uppercase tracking-wider">{title}</p>
        </div>
    </div>
);

const Header: React.FC<HeaderProps> = ({ isMonitoring, onToggleMonitoring, alerts, onResetSession, onToggleHistory }) => {
    const metrics = useMemo(() => {
        const aggressionCount = alerts.filter(a => a.type === 'Aggression').length;
        const verbalCount = alerts.filter(a => a.type === 'Verbal').length;
        const objectCount = alerts.filter(a => a.type === 'Object').length;
        return { aggressionCount, verbalCount, objectCount };
    }, [alerts]);

    return (
        <header className="bg-[var(--c-surface)] border-b border-[var(--c-border)] px-4 lg:px-6 py-3 flex items-center justify-between z-20">
            <div className="flex items-center gap-4">
                <VigilLogo className="h-9 w-9" />
                <h1 className="text-xl font-bold text-white tracking-tight hidden sm:block">
                    Vigil
                </h1>
            </div>

            <div className="flex-1 flex justify-center items-center gap-6 lg:gap-10">
                 <MetricDisplay 
                    title="Aggression"
                    value={metrics.aggressionCount}
                    icon={<AggressionIcon className={`w-7 h-7 ${metrics.aggressionCount > 0 ? 'text-[var(--c-danger)]' : 'text-slate-500'}`} />}
                />
                 <MetricDisplay 
                    title="Verbal"
                    value={metrics.verbalCount}
                    icon={<VerbalThreatIcon className={`w-7 h-7 ${metrics.verbalCount > 0 ? 'text-[var(--c-warning)]' : 'text-slate-500'}`} />}
                />
                 <MetricDisplay 
                    title="Objects"
                    value={metrics.objectCount}
                    icon={<ObjectAlertIcon className={`w-7 h-7 ${metrics.objectCount > 0 ? 'text-[var(--c-info)]' : 'text-slate-500'}`} />}
                />
            </div>

            <div className="flex items-center gap-2 md:gap-4">
                 <button 
                    onClick={onResetSession}
                    title="Reset Current Session"
                    className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-[var(--c-surface-light)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={alerts.length === 0}
                 >
                    <ResetIcon className="w-5 h-5" />
                </button>
                 <button 
                    onClick={onToggleHistory}
                    title="View Session History"
                    className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-[var(--c-surface-light)] transition-colors"
                 >
                    <HistoryIcon className="w-5 h-5" />
                </button>
                <div className="w-px h-6 bg-[var(--c-border)] mx-1"></div>
                <div className="flex items-center justify-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full transition-colors ${isMonitoring ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`}></div>
                    <span className={`text-sm font-semibold ${isMonitoring ? 'text-green-300' : 'text-slate-400'} hidden md:block`}>
                        {isMonitoring ? "ACTIVE" : "OFFLINE"}
                    </span>
                </div>
                <button
                    onClick={onToggleMonitoring}
                    className={`w-32 text-center font-bold py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 text-base transform hover:scale-105
                    ${isMonitoring 
                        ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20' 
                        : 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-500/20'}`}
                >
                    {isMonitoring ? 'Stop' : 'Start'}
                </button>
            </div>
        </header>
    );
};

export default Header;