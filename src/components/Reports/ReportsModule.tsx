import { useState } from 'react';
import { MaterialBalanceReportModule } from './MaterialBalanceReportModule';
import { QuarryProductionReportModule } from './QuarryProductionReportModule';
import { SalesReportModule } from './SalesReportModule';
import { AccountingReportModule } from './AccountingReportModule';
import { OperationsHistoryModule } from './OperationsHistoryModule';
import { AttendanceReportModule } from './AttendanceReportModule';
import { QuarryProductionCostReportModule } from './QuarryProductionCostReportModule';
import { ContractorMasterReport } from './ContractorMasterReport';
import { Factory, Drill, ShoppingCart, Wallet, ClipboardList, Clock, Calculator, ClipboardCheck } from 'lucide-react';

export function ReportsModule() {
  const [activeReport, setActiveReport] = useState<string>('production');

  const reportTypes = [
    {
      id: 'production',
      name: 'Material Balance Report',
      description: 'Production and sales balance',
      icon: Factory,
      color: 'blue'
    },
    {
      id: 'quarry',
      name: 'Quarry Production',
      description: 'Contractor operations summary',
      icon: Drill,
      color: 'orange'
    },
    {
      id: 'quarry_cost',
      name: 'Quarry Production Cost',
      description: 'Yield and expense analysis',
      icon: Calculator,
      color: 'indigo'
    },
    {
      id: 'history',
      name: 'Operations History',
      description: 'Detailed records and logs',
      icon: ClipboardList,
      color: 'purple'
    },
    {
      id: 'sales',
      name: 'Sales Report',
      description: 'Material dispatch and customer sales',
      icon: ShoppingCart,
      color: 'green'
    },
    {
      id: 'accounting',
      name: 'Accounting Report',
      description: 'Financial transactions and balance',
      icon: Wallet,
      color: 'emerald'
    },
    {
      id: 'attendance',
      name: 'Attendance Report',
      description: 'Quarry & Crusher attendance records',
      icon: Clock,
      color: 'indigo'
    },
    {
      id: 'contractor_report',
      name: 'Master Contractor Report',
      description: 'Production, Billing & Deductions',
      icon: ClipboardCheck,
      color: 'red'
    }
  ];

  const getColorClasses = (color: string, isActive: boolean) => {
    interface ColorStyles {
      bg: string;
      border: string;
      iconBg: string;
      iconText: string;
      text: string;
    }
    const colorMap: { [key: string]: ColorStyles } = {
      blue: {
        bg: isActive ? 'bg-blue-50' : 'bg-white',
        border: isActive ? 'border-blue-500' : 'border-slate-200',
        iconBg: 'bg-blue-100',
        iconText: 'text-blue-600',
        text: isActive ? 'text-blue-900' : 'text-slate-700'
      },
      red: {
        bg: isActive ? 'bg-red-50' : 'bg-white',
        border: isActive ? 'border-red-500' : 'border-slate-200',
        iconBg: 'bg-red-100',
        iconText: 'text-red-600',
        text: isActive ? 'text-red-900' : 'text-slate-700'
      },
      orange: {
        bg: isActive ? 'bg-orange-50' : 'bg-white',
        border: isActive ? 'border-orange-500' : 'border-slate-200',
        iconBg: 'bg-orange-100',
        iconText: 'text-orange-600',
        text: isActive ? 'text-orange-900' : 'text-slate-700'
      },
      purple: {
        bg: isActive ? 'bg-purple-50' : 'bg-white',
        border: isActive ? 'border-purple-500' : 'border-slate-200',
        iconBg: 'bg-purple-100',
        iconText: 'text-purple-600',
        text: isActive ? 'text-purple-900' : 'text-slate-700'
      },
      green: {
        bg: isActive ? 'bg-green-50' : 'bg-white',
        border: isActive ? 'border-green-500' : 'border-slate-200',
        iconBg: 'bg-green-100',
        iconText: 'text-green-600',
        text: isActive ? 'text-green-900' : 'text-slate-700'
      },
      emerald: {
        bg: isActive ? 'bg-emerald-50' : 'bg-white',
        border: isActive ? 'border-emerald-500' : 'border-slate-200',
        iconBg: 'bg-emerald-100',
        iconText: 'text-emerald-600',
        text: isActive ? 'text-emerald-900' : 'text-slate-700'
      },
      indigo: {
        bg: isActive ? 'bg-indigo-50' : 'bg-white',
        border: isActive ? 'border-indigo-500' : 'border-slate-200',
        iconBg: 'bg-indigo-100',
        iconText: 'text-indigo-600',
        text: isActive ? 'text-indigo-900' : 'text-slate-700'
      }
    };
    return colorMap[color];
  };

  const renderReport = () => {
    switch (activeReport) {
      case 'production':
        return <MaterialBalanceReportModule />;
      case 'quarry':
        return <QuarryProductionReportModule />;
      case 'quarry_cost':
        return <QuarryProductionCostReportModule />;
      case 'history':
        return <OperationsHistoryModule />;
      case 'sales':
        return <SalesReportModule />;
      case 'accounting':
        return <AccountingReportModule />;
      case 'attendance':
        return <AttendanceReportModule />;
      case 'contractor_report':
        return <ContractorMasterReport />;
      default:
        return <MaterialBalanceReportModule />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {reportTypes.map((report) => {
          const isActive = activeReport === report.id;
          const colors = getColorClasses(report.color, isActive);
          const Icon = report.icon;

          return (
            <button
              key={report.id}
              onClick={() => setActiveReport(report.id)}
              className={`${colors.bg} rounded-xl p-4 border-2 ${colors.border} hover:shadow-md transition-all text-left`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 ${colors.iconBg} rounded-lg flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${colors.iconText}`} />
                </div>
                <h3 className={`text-base font-semibold ${colors.text}`}>
                  {report.name}
                </h3>
              </div>
              <p className="text-xs text-slate-600">{report.description}</p>
            </button>
          );
        })}
      </div>

      <div>
        {renderReport()}
      </div>
    </div>
  );
}
