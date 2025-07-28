import React, { useState } from 'react';
import type { Alert } from '../types';
import { AggressionIcon, VerbalThreatIcon, ObjectAlertIcon, ReportIcon } from './icons/Icons';

export const generateReportContent = (alerts: Alert[], sessionDate?: string): string => {
    if (alerts.length === 0) return "No events to report.";
    const reportDate = sessionDate ? new Date(sessionDate).toLocaleString() : new Date().toLocaleString();

    const aggressionAlerts = alerts.filter(a => a.type === 'Aggression');
    const verbalAlerts = alerts.filter(a => a.type === 'Verbal');
    const objectAlerts = alerts.filter(a => a.type === 'Object');

    const formatAlerts = (title: string, arr: Alert[]) => {
      if (arr.length === 0) return '';
      let section = `\n--- ${title.toUpperCase()} ---\n`;
      arr.forEach(a => {
        section += `\nTime: ${a.timestamp}\nType: ${a.title}\nDetails: ${a.details}\n`;
      });
      return section;
    };

    const report = `
VIGIL - INCIDENT REPORT
Generated on: ${reportDate}
----------------------------------
SUMMARY
- Total Alerts: ${alerts.length}
- Aggression Incidents: ${aggressionAlerts.length}
- Verbal Threats: ${verbalAlerts.length}
- High-Risk Objects: ${objectAlerts.length}
----------------------------------
${formatAlerts('Aggression Details', aggressionAlerts)}
${formatAlerts('Verbal Threat Details', verbalAlerts)}
${formatAlerts('High-Risk Object Details', objectAlerts)}
    `.trim().replace(/^\s+/gm, '');
    
    return report;
}

interface EventLogProps {
  alerts: Alert[];
}

const AlertCard: React.FC<{ alert: Alert }> = ({ alert }) => {
    const getIconAndColor = () => {
        switch (alert.type) {
            case 'Aggression':
                return { Icon: AggressionIcon, color: 'border-[var(--c-danger)]', iconBg: 'bg-red-500/10', iconColor: 'text-red-400' };
            case 'Verbal':
                return { Icon: VerbalThreatIcon, color: 'border-[var(--c-warning)]', iconBg: 'bg-orange-500/10', iconColor: 'text-orange-400' };
            case 'Object':
                return { Icon: ObjectAlertIcon, color: 'border-[var(--c-info)]', iconBg: 'bg-sky-500/10', iconColor: 'text-sky-400' };
            default:
                 return { Icon: () => null, color: 'border-slate-700', iconBg: 'bg-slate-700/20', iconColor: 'text-slate-400'};
        }
    };
    const { Icon, color, iconBg, iconColor } = getIconAndColor();

    return (
        <div className={`p-3 rounded-lg flex gap-3 items-start animate-fade-in bg-[var(--c-surface-light)] border-l-4 ${color}`}>
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${iconBg} ${iconColor}`}>
                <Icon className="w-5 h-5" />
            </div>
            <div className="flex-grow min-w-0">
                <div className="flex justify-between items-baseline">
                    <h4 className="font-bold text-white truncate pr-2">{alert.title}</h4>
                    <span className="text-xs text-slate-400 flex-shrink-0">{alert.timestamp}</span>
                </div>
                <p className="text-sm text-slate-300 mt-1">{alert.details}</p>
            </div>
        </div>
    );
};


const EventLog: React.FC<EventLogProps> = ({ alerts }) => {
  const [copied, setCopied] = useState(false);

  const handleGenerateReport = () => {
    if (alerts.length === 0) return;
    const reportText = generateReportContent(alerts);
    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="bg-[var(--c-surface)] rounded-xl p-4 sm:p-6 shadow-lg flex flex-col min-h-0 h-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-white">Event Log</h2>
        <button
          onClick={handleGenerateReport}
          disabled={alerts.length === 0}
          className="bg-indigo-600 text-white px-3 py-1.5 rounded-md text-sm font-bold hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
        >
          <ReportIcon className="w-4 h-4" />
          {copied ? 'Report Copied!' : 'Generate Report'}
        </button>
      </div>
      <div className="space-y-3 flex-grow overflow-y-auto pr-2 -mr-2">
        {alerts.length > 0 ? (
          alerts.map(alert => <AlertCard key={alert.id} alert={alert} />)
        ) : (
          <div className="text-center h-full flex flex-col justify-center items-center text-slate-500">
            <p className="text-lg">System is ready.</p>
            <p>Awaiting events...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventLog;