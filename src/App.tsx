import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { ErrorBoundary } from './components/Common/ErrorBoundary';
import { LoginForm } from './components/Auth/LoginForm';
import { DashboardLayout } from './components/Layout/DashboardLayout';
import { DirectorDashboard } from './components/Dashboard/DirectorDashboard';
import { ContractorDashboard } from './components/Contractor/ContractorDashboard';
import { DrillingForm } from './components/Contractor/DrillingForm';
import { BlastingForm } from './components/Contractor/BlastingForm';
import { LoadingForm } from './components/Contractor/LoadingForm';
import { TransportForm } from './components/Contractor/TransportForm';
import { MediaForm } from './components/Contractor/MediaForm';
import { InventoryForm } from './components/Inventory/InventoryForm';
import { AssetReturns } from './components/Inventory/AssetReturns';
import { ItemManagement } from './components/Inventory/ItemManagement';
import { VendorManagement } from './components/Inventory/VendorManagement';
import { SafetyForm } from './components/Safety/SafetyForm';
import { MobileOperations } from './components/Contractor/MobileOperations';
import { SalesModule } from './components/Sales/SalesModule';
import { ApprovalsModule } from './components/Manager/ApprovalsModule';
import { PermitForm } from './components/Permit/PermitForm';
import { PermitReport } from './components/Permit/PermitReport';
import { SecurityPapersForm } from './components/Permit/SecurityPapersForm';
import { AccountsModule } from './components/Accounts/AccountsModule';
import { GstSalesModule } from './components/Sales/GstSalesModule';
import { DispatchForm } from './components/Resources/DispatchForm';
import { InventoryDispatchReport } from './components/Resources/InventoryDispatchReport';
import { StorageForm } from './components/Resources/StorageForm';
import { ReportsModule } from './components/Reports/ReportsModule';
import { MaterialBalanceReportModule } from './components/Reports/MaterialBalanceReportModule';
import { QuarryProductionCostReportModule } from './components/Reports/QuarryProductionCostReportModule';
import { QuarryProductionReportModule } from './components/Reports/QuarryProductionReportModule';
import { SalesReportModule } from './components/Reports/SalesReportModule';
import { AccountingReportModule } from './components/Reports/AccountingReportModule';
import { OperationsHistoryModule } from './components/Reports/OperationsHistoryModule';
import { UserManagement } from './components/Users/UserManagement';
import { CrusherProductionForm } from './components/Crusher/CrusherProductionForm';
import { CrusherProductionCostReport } from './components/Crusher/CrusherProductionCostReport';
import { EBReportForm } from './components/Crusher/EBReportForm';
import { EBCalculator } from './components/Crusher/EBCalculator';
import { EBRecords } from './components/Crusher/EBRecords';
import { CrusherMaintenanceForm } from './components/Crusher/CrusherMaintenanceForm';
import { JCBOperationsForm } from './components/Operations/JCBOperationsForm';
import { JCBOperationsDetails } from './components/Operations/JCBOperationsDetails';
import { QuarryStorage } from './components/Operations/QuarryStorage';
import { CustomerDetails } from './components/Customers/CustomerDetails';
import { SelfServiceAttendance } from './components/Attendance/SelfServiceAttendance';
import { AttendanceReportModule } from './components/Reports/AttendanceReportModule';
import { BouldersSaleReport } from './components/Quarry/BouldersSaleReport';
import { ContractorCalculator } from './components/Contractor/ContractorCalculator';
import { ContractorManagement } from './components/Contractor/ContractorManagement';
import { OverheadManagement } from './components/Overhead/OverheadManagement';
import { QuarryProductionReport } from './components/Contractor/QuarryProductionReport';
import { QuarryDeductionReport } from './components/Contractor/QuarryDeductionReport';
import { ContractorMasterReport } from './components/Reports/ContractorMasterReport';
import { CrusherContractorReport } from './components/Reports/CrusherContractorReport';
import { QuarryCrusherCostingReport } from './components/Reports/QuarryCrusherCostingReport';
import { QuarryDetailCostReport } from './components/Reports/QuarryDetailCostReport';
import { BalanceSheetReport } from './components/Reports/BalanceSheetReport';
import { GstrSalesReport } from './components/Reports/GstrSalesReport';
import { ProfitAndLossReport } from './components/Reports/ProfitAndLossReport';
import { StaffSalesSummaryReport } from './components/Reports/StaffSalesSummaryReport';
import { DmsDashboard } from './components/DMS/DmsDashboard';

const t = (text: string): string => text;

function AppContent() {
  const { session, user, loading } = useAuth();
  const [currentHash, setCurrentHash] = useState(window.location.hash.replace('#', '') || 'dashboard');

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') || 'dashboard';
      console.log('Hash changed to:', hash);
      setCurrentHash(hash);
    };

    // Initial log
    console.log('Initial hash:', window.location.hash.replace('#', '') || 'dashboard');

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Debug log when currentHash changes
  useEffect(() => {
    console.log('Current hash in state:', currentHash);
  }, [currentHash]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">{t('Loading...')}</div>
      </div>
    );
  }

  if (!session || !user) {
    return <LoginForm />;
  }

  const renderContent = () => {
    const hash = currentHash;
    console.log('Rendering content for hash:', hash);

    switch (hash) {
      case 'dms-dashboard':
        return <DmsDashboard />;

      case 'selfie':
        return <SelfServiceAttendance />;

      case 'dashboard':
        if (user.role === 'director') {
          return <DirectorDashboard />;
        }
        if (user.role === 'contractor') {
          return <ContractorDashboard />;
        }
        return (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight transition-all">{t('Welcome, ')}{user.full_name}{t('!')}</h2>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1">{t('Role: ')}{user.role.replace('_', ' ')}</p>
              </div>
              <div className="px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-xs font-black text-indigo-600 uppercase tracking-widest shadow-sm">
                {t('Attendance Terminal')}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
              <SelfServiceAttendance workArea="general" />
            </div>
          </div>
        );

      case 'drilling':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t('Drilling Operations')}</h2>
              <p className="text-slate-600 mt-1">{t('Record and manage drilling activities')}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold mb-4">{t('New Drilling Record')}</h3>
              <ErrorBoundary fallback={<div className="text-red-600">{t('Failed to load Drilling Form. Please try again later.')}</div>}>
                <DrillingForm onSuccess={() => window.location.reload()} />
              </ErrorBoundary>
            </div>
          </div>
        );

      case 'mobile':
        return <MobileOperations />;

      case 'sales':
      case 'material-investors':
        return <SalesModule />;

      case 'gst-sales':
        return <GstSalesModule />;

      case 'approvals':
        // For directors, approvals are now integrated in the dashboard
        if (user.role === 'director') {
          window.location.hash = '#dashboard';
          return <DirectorDashboard />;
        }
        return <ApprovalsModule />;

      case 'blasting':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t('Blasting Operations')}</h2>
              <p className="text-slate-600 mt-1">{t('Record and manage blasting activities')}</p>
            </div>
            <BlastingForm onSuccess={() => window.location.reload()} />
          </div>
        );

      case 'loading':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t('Breaking/Loading Operations')}</h2>
              <p className="text-slate-600 mt-1">{t('Track material breaking and loading')}</p>
            </div>
            <LoadingForm onSuccess={() => window.location.reload()} />
          </div>
        );

      case 'quarry-attendance':
        return (
          <div className="space-y-6">
            <SelfServiceAttendance workArea="quarry" />
          </div>
        );

      case 'transport':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t('Transport Operations')}</h2>
              <p className="text-slate-600 mt-1">{t('Track vehicle and material transport')}</p>
            </div>
            <TransportForm onSuccess={() => window.location.reload()} />
          </div>
        );

      case 'boulders-sale-report':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t('Boulders Sale Report')}</h2>
              <p className="text-slate-600 mt-1">{t('Detailed sales analysis for Q-Boulders material')}</p>
            </div>
            <BouldersSaleReport />
          </div>
        );

      case 'quarry-contractor-calculator':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t('Contractor Calculator')}</h2>
              <p className="text-slate-600 mt-1">{t('Quarry production and cost calculation hub')}</p>
            </div>
            <ContractorCalculator />
          </div>
        );

      case 'quarry-production-report':
        return (
          <div className="space-y-6">
            <QuarryProductionReport />
          </div>
        );

      case 'quarry-deduction-report':
        return (
          <div className="space-y-6">
            <QuarryDeductionReport />
          </div>
        );

      case 'crusher-attendance':
        return (
          <div className="space-y-6">
            <SelfServiceAttendance workArea="crusher" />
          </div>
        );

      case 'attendance':
        return (
          <div className="space-y-6">
            <SelfServiceAttendance workArea="general" />
          </div>
        );

      case 'media':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t('Photos & Videos')}</h2>
              <p className="text-slate-600 mt-1">{t('Upload and manage site documentation')}</p>
            </div>
            <MediaForm onSuccess={() => window.location.reload()} />
          </div>
        );

      case 'crusher-production':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t('Crusher Production')}</h2>
              <p className="text-slate-600 mt-1">{t('Track crusher operations and output')}</p>
            </div>
            <CrusherProductionForm onSuccess={() => window.location.reload()} />
          </div>
        );
      
      case 'crusher-efficiency':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t('Average Production Cost')}</h2>
              <p className="text-slate-600 mt-1">{t('Daily production efficiency and EB consumption analysis')}</p>
            </div>
            <CrusherProductionCostReport />
          </div>
        );

      case 'eb-reports':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t('EB Reports')}</h2>
              <p className="text-slate-600 mt-1">{t('Manage Electricity Board reports and records')}</p>
            </div>
            <EBReportForm onSuccess={() => window.location.reload()} />
          </div>
        );

      case 'eb-records':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t('EB Records')}</h2>
              <p className="text-slate-600 mt-1">{t('Record received EB bill and perform KW UC meter reset')}</p>
            </div>
            <EBRecords onSuccess={() => window.location.reload()} />
          </div>
        );

      case 'eb-calculator':
        return (
          <div className="space-y-6">
            <EBCalculator />
          </div>
        );

      case 'crusher-maintenance':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t('Crusher Maintenance')}</h2>
              <p className="text-slate-600 mt-1">{t('Record and document crusher maintenance activities')}</p>
            </div>
            <CrusherMaintenanceForm onSuccess={() => window.location.reload()} />
          </div>
        );


      case 'customers':
        return (
          <div className="space-y-6">
            <CustomerDetails />
          </div>
        );



      case 'inventory':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t('Inventory Hub')}</h2>
              <p className="text-slate-600 mt-1">{t('Track equipment, tools, and supplies')}</p>
            </div>
            <InventoryForm onSuccess={() => window.location.reload()} />
          </div>
        );

      case 'returnable-assets':
        return <AssetReturns />;

      case 'item-management':
        return (
          <div className="space-y-6">
            <ItemManagement />
          </div>
        );

      case 'vendor-management':
      case 'vendor-bill-entry':
        return (
          <div className="space-y-6">
            <VendorManagement initialShowBillForm={hash === 'vendor-bill-entry'} />
          </div>
        );


      case 'storage':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t('Storage Management')}</h2>
              <p className="text-slate-600 mt-1">{t('Manage storage items, quantities, and pricing')}</p>
            </div>
            <StorageForm />
          </div>
        );

      case 'safety':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t('Safety & Incidents')}</h2>
              <p className="text-slate-600 mt-1">{t('Report and track safety incidents')}</p>
            </div>
            <SafetyForm onSuccess={() => window.location.reload()} />
          </div>
        );

      case 'reports':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t('Reports & Analytics')}</h2>
              <p className="text-slate-600 mt-1">{t('Comprehensive reports for all operations')}</p>
            </div>
            <ReportsModule />
          </div>
        );

      case 'production-report':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t('Material Balance Report')}</h2>
              <p className="text-slate-600 mt-1">{t('Production and sales balance')}</p>
            </div>
            <MaterialBalanceReportModule />
          </div>
        );

      case 'quarry-report':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t('Quarry Production Report')}</h2>
              <p className="text-slate-600 mt-1">{t('Contractor operations summary')}</p>
            </div>
            <QuarryProductionReportModule />
          </div>
        );

      case 'quarry-cost':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t('Quarry Production Cost Report')}</h2>
              <p className="text-slate-600 mt-1">{t('Yield and expense analysis')}</p>
            </div>
            <QuarryProductionCostReportModule />
          </div>
        );

      case 'quarry-crusher-costing':
        return <QuarryCrusherCostingReport />;

      case 'quarry-detail-cost':
        return <QuarryDetailCostReport />;

      case 'gstr1-sales':
        return <GstrSalesReport />;

      case 'profit-and-loss':
        return <ProfitAndLossReport />;

      case 'balance-sheet':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t('Balance Sheet Report')}</h2>
              <p className="text-slate-600 mt-1">{t('Complete financial statement — income, expenses & net position')}</p>
            </div>
            <BalanceSheetReport />
          </div>
        );

      case 'operations-history':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t('Operations History')}</h2>
              <p className="text-slate-600 mt-1">{t('Detailed records and logs')}</p>
            </div>
            <OperationsHistoryModule />
          </div>
        );

      case 'sales-report':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t('Sales Report')}</h2>
              <p className="text-slate-600 mt-1">{t('Material dispatch and customer sales')}</p>
            </div>
            <SalesReportModule />
          </div>
        );

      case 'staff-sales-summary':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t('Sales Summary – Staff Wise')}</h2>
              <p className="text-slate-600 mt-1">{t('Invoice totals grouped by sales staff member')}</p>
            </div>
            <StaffSalesSummaryReport />
          </div>
        );

      case 'accounting-report':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t('Accounting Report')}</h2>
              <p className="text-slate-600 mt-1">{t('Financial transactions and balance')}</p>
            </div>
            <AccountingReportModule />
          </div>
        );

      case 'attendance-report':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t('Attendance Report')}</h2>
              <p className="text-slate-600 mt-1">{t('View Quarry & Crusher attendance records')}</p>
            </div>
            <AttendanceReportModule />
          </div>
        );

      case 'new-permit':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t('New Permit')}</h2>
              <p className="text-slate-600 mt-1">{t('Create and submit new permit applications')}</p>
            </div>
            <PermitForm onSuccess={() => window.location.reload()} />
          </div>
        );

      case 'security-papers':
        return <SecurityPapersForm />;

      case 'permit-report':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t('Permit Reports')}</h2>
              <p className="text-slate-600 mt-1">{t('View and export permit data')}</p>
            </div>
            <PermitReport />
          </div>
        );

      case 'contractor_report':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t('Master Contractor Report')}</h2>
              <p className="text-slate-600 mt-1">{t('Production, Billing & Deductions Hub')}</p>
            </div>
            <ContractorMasterReport />
          </div>
        );

      case 'crusher-contractor-report':
        return <CrusherContractorReport />;

      case 'accounts':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t('Accounts')}</h2>
              <p className="text-slate-600 mt-1">{t('Manage invoices, payments, and financial transactions')}</p>
            </div>
            <AccountsModule />
          </div>
        );

      case 'dispatch-payment':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t('Issue Items from Stock')}</h2>
              <p className="text-slate-600 mt-1">{t('Track items given to departments and employees')}</p>
            </div>
            <DispatchForm onSuccess={() => window.location.hash = '#inventory-dispatch-report'} />
          </div>
        );

      case 'inventory-dispatch-report':
        return <InventoryDispatchReport />;

      case 'user-management':
        return <UserManagement />;

      case 'contractor-management':
        return <ContractorManagement />;

      case 'overhead-management':
        return <OverheadManagement />;

      case 'quarry-jcb-operations':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t('Quarry JCB Operations')}</h2>
              <p className="text-slate-600 mt-1">{t('Manage Quarry JCB operations and maintenance')}</p>
            </div>
            <JCBOperationsForm 
              workArea="quarry" 
              onSuccess={() => window.location.reload()} 
            />
          </div>
        );

      case 'quarry-storage-management':
        return <QuarryStorage />;

      case 'quarry-jcb-operations-list':
        return <JCBOperationsDetails workArea="quarry" />;

      case 'crusher-jcb-operations':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t('Crusher JCB Operations')}</h2>
              <p className="text-slate-600 mt-1">{t('Manage Crusher JCB operations and maintenance')}</p>
            </div>
            <JCBOperationsForm 
              workArea="crusher" 
              onSuccess={() => window.location.reload()} 
            />
          </div>
        );

      case 'crusher-jcb-operations-list':
        return <JCBOperationsDetails workArea="crusher" />;

      default:
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
            <p className="text-slate-600">{t('Page not found')}</p>
          </div>
        );
    }
  };

  return (
    <DashboardLayout>
      {renderContent()}
    </DashboardLayout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
      <ToastContainer position="bottom-right" autoClose={3000} hideProgressBar theme="dark" />
    </AuthProvider>
  );
}

export default App;
