import { useState } from 'react';
import { ProductionReportModule } from './ProductionReportModule';
import { QuarryProductionReportModule } from './QuarryProductionReportModule';
import { SalesReportModule } from './SalesReportModule';
import { AccountingReportModule } from './AccountingReportModule';
import { Factory, Drill, ShoppingCart, Wallet } from 'lucide-react';

export function ReportsModule() {
  const [activeReport, setActiveReport] = useState<string>('production');

  const reportTypes = [
    {
      id: 'production',
      name: 'Production Report',
      description: 'Crusher production summary',
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
      orange: {
        bg: isActive ? 'bg-orange-50' : 'bg-white',
        border: isActive ? 'border-orange-500' : 'border-slate-200',
        iconBg: 'bg-orange-100',
        iconText: 'text-orange-600',
        text: isActive ? 'text-orange-900' : 'text-slate-700'
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
      }
    };
    return colorMap[color];
  };

  const renderReport = () => {
    switch (activeReport) {
      case 'production':
        return <ProductionReportModule />;
      case 'quarry':
        return <QuarryProductionReportModule />;
      case 'sales':
        return <SalesReportModule />;
      case 'accounting':
        return <AccountingReportModule />;
      default:
        return <ProductionReportModule />;
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
