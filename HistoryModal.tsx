import React, { useState } from 'react';
import type { Session, Alert } from '../types';
import { generateReportContent } from './EventLog';
import { AggressionIcon, VerbalThreatIcon, ObjectAlertIcon, ReportIcon } from './icons/Icons';

const AlertItem: React.FC<{ alert: Alert }> = ({ alert }) => {
    const getIconAndColor = () => {
        switch (alert.type) {
            case 'Aggression': return { Icon: AggressionIcon, color: 'text-red-400' };
            case 'Verbal': return { Icon: VerbalThreatIcon, color: 'text-orange-400' };
            case 'Object': return { Icon: ObjectAlertIcon, color: 'text-sky-400' };
            default: return { Icon: () => null, color: 'text-slate-400'};
        }
    };
    const { Icon, color } = getIconAndColor();

    return (
        <div className="p-3 border-t border-[var(--c-border)] flex gap-3 items-start">
            <div className={`flex-shrink-0 w-7 h-7 flex items-center justify-center ${color}`}>
                <Icon className="w-5 h-5" />
            </div>
            <div className="flex-grow min-w-0">
                <div className="flex justify-between items-baseline">
                    <h4 className="font-semibold text-slate-200 truncate pr-2">{alert.title}</h4>
                    <span className="text-xs text-slate-500 flex-shrink-0">{alert.timestamp}</span>
                </div>
                <p className="text-sm text-slate-400 mt-1">{alert.details}</p>
            </div>
        </div>
    );
};

const SessionItem: React.FC<{ session: Session }> = ({ session }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleGenerateReport = () => {
        const report = generateReportContent(session.alerts, session.savedAt);
        navigator.clipboard.writeText(report);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    return (
        <div className="bg-[var(--c-surface-light)] rounded-lg">
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                className="w-full p-4 flex justify-between items-center text-left hover:bg-slate-700/30 rounded-lg transition-colors"
            >
                <div>
                    <p className="font-semibold text-white">Session from {session.savedAt}</p>
                    <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
                        <span><strong className="text-red-400">{session.summary.aggression}</strong> Aggression</span>
                        <span><strong className="text-orange-400">{session.summary.verbal}</strong> Verbal</span>
                        <span><strong className="text-sky-400">{session.summary.objects}</strong> Objects</span>
                    </div>
                </div>
                <svg className={`w-5 h-5 text-slate-400 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            
            {isOpen && (
                <div className="px-4 pb-4 animate-fade-in">
                    <div className="bg-[var(--c-surface)] rounded-md overflow-hidden mt-2">
                       {session.alerts.map(alert => <AlertItem key={alert.id} alert={alert} />)}
                    </div>
                    <div className="mt-4 flex justify-end">
                        <button
                          onClick={handleGenerateReport}
                          className="bg-indigo-600 text-white px-3 py-1.5 rounded-md text-sm font-bold hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
                        >
                          <ReportIcon className="w-4 h-4" />
                          {copied ? 'Report Copied!' : 'Generate Report'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

const HistoryModal: React.FC<{ sessions: Session[], onClose: () => void }> = ({ sessions, onClose }) => {
    return (
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-[var(--c-surface)] rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col m-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center p-6 border-b border-[var(--c-border)]">
                    <h2 className="text-xl font-bold text-white">Session History</h2>
                    <button 
                        onClick={onClose} 
                        className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-[var(--c-surface-light)]"
                    >
                         <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="p-6 flex-grow overflow-y-auto space-y-4">
                    {sessions.length > 0 ? (
                        sessions.map(session => <SessionItem key={session.id} session={session} />)
                    ) : (
                        <div className="text-center py-10 text-slate-500">
                            <h3 className="text-lg font-semibold">No Saved Sessions</h3>
                            <p>Reset a session from the main dashboard to archive it here.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HistoryModal;