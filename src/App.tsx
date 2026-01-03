import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ErrorBoundary } from './components/Common/ErrorBoundary';
import { LoginForm } from './components/Auth/LoginForm';
import { DashboardLayout } from './components/Layout/DashboardLayout';
import { DirectorDashboard } from './components/Dashboard/DirectorDashboard';
import { ContractorDashboard } from './components/Contractor/ContractorDashboard';
import { DrillingForm } from './components/Contractor/DrillingForm';
import { DrillingDetails } from './components/Contractor/DrillingDetails';
import { BlastingForm } from './components/Contractor/BlastingForm';
import { BlastingDetails } from './components/Contractor/BlastingDetails';
import { LoadingForm } from './components/Contractor/LoadingForm';
import { LoadingDetails } from './components/Contractor/LoadingDetails';
import { TransportForm } from './components/Contractor/TransportForm';
import { TransportDetails } from './components/Contractor/TransportDetails';
import { AttendanceForm } from './components/Contractor/AttendanceForm';
import { AttendanceDetails } from './components/Contractor/AttendanceDetails';
import { MediaForm } from './components/Contractor/MediaForm';
import { MediaDetails } from './components/Contractor/MediaDetails';
import { InventoryForm } from './components/Inventory/InventoryForm';
import { InventoryDetails } from './components/Inventory/InventoryDetails';
import { FuelForm } from './components/Fuel/FuelForm';
import { FuelDetails } from './components/Fuel/FuelDetails';
import { SafetyForm } from './components/Safety/SafetyForm';
import { SafetyDetails } from './components/Safety/SafetyDetails';
import { MobileOperations } from './components/Contractor/MobileOperations';
import { SalesModule } from './components/Sales/SalesModule';
import { ApprovalsModule } from './components/Manager/ApprovalsModule';
import { PermitForm } from './components/Permit/PermitForm';
import { PermitDetails } from './components/Permit/PermitDetails';
import { AccountsForm } from './components/Accounts/AccountsForm';
import { AccountsDetails } from './components/Accounts/AccountsDetails';
import { DispatchForm } from './components/Dispatch/DispatchForm';
import { DispatchDetails } from './components/Dispatch/DispatchDetails';
import { ProductionStockForm } from './components/Stock/ProductionStockForm';
import { ProductionStockDetails } from './components/Stock/ProductionStockDetails';
import { PurchaseRequestForm } from './components/Stock/PurchaseRequestForm';
import { PurchaseRequestDetails } from './components/Stock/PurchaseRequestDetails';
import { ReportsModule } from './components/Reports/ReportsModule';
import { UserManagement } from './components/Users/UserManagement';
import { CrusherProductionForm } from './components/Crusher/CrusherProductionForm';
import { CrusherProductionDetails } from './components/Crusher/CrusherProductionDetails';
import { EBReportForm } from './components/Crusher/EBReportForm';
import { EBReportDetails } from './components/Crusher/EBReportDetails';
import { JCBOperationsForm } from './components/Operations/JCBOperationsForm';
import { JCBOperationsDetails } from './components/Operations/JCBOperationsDetails';
import { CustomerForm } from './components/Customers/CustomerForm';
import { CustomerDetails } from './components/Customers/CustomerDetails';

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
        <div className="text-white text-xl">Loading...</div>
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
      case 'dashboard':
        if (user.role === 'director') {
          return <DirectorDashboard />;
        }
        if (user.role === 'contractor') {
          return <ContractorDashboard />;
        }
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Welcome, {user.full_name}!</h2>
              <p className="text-slate-600 mt-1 capitalize">Role: {user.role.replace('_', ' ')}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
              <p className="text-slate-600">Select a module from the sidebar to get started</p>
            </div>
          </div>
        );

      case 'drilling':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Drilling Operations</h2>
              <p className="text-slate-600 mt-1">Record and manage drilling activities</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold mb-4">New Drilling Record</h3>
              <ErrorBoundary fallback={<div className="text-red-600">Failed to load Drilling Form. Please try again later.</div>}>
                <DrillingForm onSuccess={() => window.location.reload()} />
              </ErrorBoundary>
            </div>
            <div className="mt-8 bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h3 className="text-xl font-bold text-slate-900 mb-4">Drilling Details & History</h3>
              <ErrorBoundary fallback={<div className="text-red-600">Failed to load Drilling History. Please try again later.</div>}>
                <DrillingDetails />
              </ErrorBoundary>
            </div>
          </div>
        );

      case 'mobile':
        return <MobileOperations />;

      case 'sales':
        return <SalesModule />;

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
              <h2 className="text-2xl font-bold text-slate-900">Blasting Operations</h2>
              <p className="text-slate-600 mt-1">Record and manage blasting activities</p>
            </div>
            <BlastingForm onSuccess={() => window.location.reload()} />
            <div className="mt-8">
              <h3 className="text-xl font-bold text-slate-900 mb-4">Blasting Details & History</h3>
              <BlastingDetails />
            </div>
          </div>
        );

      case 'loading':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Breaking/Loading Operations</h2>
              <p className="text-slate-600 mt-1">Track material breaking and loading</p>
            </div>
            <LoadingForm onSuccess={() => window.location.reload()} />
            <div className="mt-8">
              <h3 className="text-xl font-bold text-slate-900 mb-4">Breaking/Loading Details & History</h3>
              <LoadingDetails />
            </div>
          </div>
        );

      case 'transport':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Transport Operations</h2>
              <p className="text-slate-600 mt-1">Track vehicle and material transport</p>
            </div>
            <TransportForm onSuccess={() => window.location.reload()} />
            <div className="mt-8">
              <h3 className="text-xl font-bold text-slate-900 mb-4">Transport Details & History</h3>
              <TransportDetails />
            </div>
          </div>
        );

      case 'attendance':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Attendance Management</h2>
              <p className="text-slate-600 mt-1">Record daily attendance and work hours</p>
            </div>
            <AttendanceForm onSuccess={() => window.location.reload()} />
            <div className="mt-8">
              <h3 className="text-xl font-bold text-slate-900 mb-4">Attendance Details & History</h3>
              <AttendanceDetails />
            </div>
          </div>
        );

      case 'media':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Photos & Videos</h2>
              <p className="text-slate-600 mt-1">Upload and manage site documentation</p>
            </div>
            <MediaForm onSuccess={() => window.location.reload()} />
            <div className="mt-8">
              <h3 className="text-xl font-bold text-slate-900 mb-4">Media Gallery</h3>
              <MediaDetails />
            </div>
          </div>
        );

      case 'crusher-production':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Crusher Production</h2>
              <p className="text-slate-600 mt-1">Track crusher operations and output</p>
            </div>
            <CrusherProductionForm onSuccess={() => window.location.reload()} />
            <div className="mt-8">
              <h3 className="text-xl font-bold text-slate-900 mb-4">Production Records</h3>
              <CrusherProductionDetails />
            </div>
          </div>
        );

      case 'eb-reports':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">EB Reports</h2>
              <p className="text-slate-600 mt-1">Manage Electricity Board reports and records</p>
            </div>
            <EBReportForm onSuccess={() => window.location.reload()} />
            <div className="mt-8">
              <h3 className="text-xl font-bold text-slate-900 mb-4">EB Report History</h3>
              <EBReportDetails />
            </div>
          </div>
        );


      case 'customers':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Customer Management</h2>
              <p className="text-slate-600 mt-1">Manage customer relationships and information</p>
            </div>
            <CustomerForm onSuccess={() => window.location.reload()} />
            <div className="mt-8">
              <h3 className="text-xl font-bold text-slate-900 mb-4">Customer Directory</h3>
              <CustomerDetails />
            </div>
          </div>
        );
        
      case 'customer-details':
        return (
          <div className="space-y-6">
            <CustomerDetails />
          </div>
        );

      case 'inventory':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Inventory Management</h2>
              <p className="text-slate-600 mt-1">Track equipment, tools, and supplies</p>
            </div>
            <InventoryForm onSuccess={() => window.location.reload()} />
            <div className="mt-8">
              <h3 className="text-xl font-bold text-slate-900 mb-4">Current Inventory</h3>
              <InventoryDetails />
            </div>
          </div>
        );
        
      case 'fuel':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Fuel Management</h2>
              <p className="text-slate-600 mt-1">Track fuel consumption and costs</p>
            </div>
            <FuelForm onSuccess={() => window.location.reload()} />
            <div className="mt-8">
              <h3 className="text-xl font-bold text-slate-900 mb-4">Fuel Records</h3>
              <FuelDetails />
            </div>
          </div>
        );

      case 'safety':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Safety & Incidents</h2>
              <p className="text-slate-600 mt-1">Report and track safety incidents</p>
            </div>
            <SafetyForm onSuccess={() => window.location.reload()} />
            <div className="mt-8">
              <h3 className="text-xl font-bold text-slate-900 mb-4">Incident Reports</h3>
              <SafetyDetails />
            </div>
          </div>
        );

      case 'reports':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Reports & Analytics</h2>
              <p className="text-slate-600 mt-1">Comprehensive reports for all operations</p>
            </div>
            <ReportsModule />
          </div>
        );

      case 'new-permit':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">New Permit</h2>
              <p className="text-slate-600 mt-1">Create and submit new permit applications</p>
            </div>
            <PermitForm onSuccess={() => window.location.reload()} />
            <div className="mt-8">
              <h3 className="text-xl font-bold text-slate-900 mb-4">Active Permits</h3>
              <PermitDetails />
            </div>
          </div>
        );


      case 'accounts':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Accounts</h2>
              <p className="text-slate-600 mt-1">Manage invoices, payments, and financial transactions</p>
            </div>
            <AccountsForm onSuccess={() => window.location.reload()} />
            <div className="mt-8">
              <h3 className="text-xl font-bold text-slate-900 mb-4">Transaction History</h3>
              <AccountsDetails />
            </div>
          </div>
        );

      case 'dispatch-payment':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Dispatch List</h2>
              <p className="text-slate-600 mt-1">Track material dispatch, transportation, and balance materials</p>
            </div>
            <DispatchForm onSuccess={() => window.location.reload()} />
            <div className="mt-8">
              <h3 className="text-xl font-bold text-slate-900 mb-4">Dispatch Records</h3>
              <DispatchDetails />
            </div>
          </div>
        );

      case 'stock-management':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Stock Management</h2>
              <p className="text-slate-600 mt-1">Production stock and purchase requests</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-4">Production Stock</h3>
                  <ProductionStockForm onSuccess={() => window.location.reload()} />
                </div>
                <ProductionStockDetails />
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-4">Purchase Requests</h3>
                  <PurchaseRequestForm onSuccess={() => window.location.reload()} />
                </div>
                <PurchaseRequestDetails />
              </div>
            </div>
          </div>
        );

      case 'user-management':
        return <UserManagement />;
        
      case 'jcb-operations':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">JCB Operations</h2>
              <p className="text-slate-600 mt-1">Manage JCB operations and maintenance</p>
            </div>
            <JCBOperationsForm onSuccess={() => window.location.hash = 'jcb-operations-list'} />
          </div>
        );
        
      case 'jcb-operations-list':
        return <JCBOperationsDetails />;

      default:
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
            <p className="text-slate-600">Page not found</p>
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
    </AuthProvider>
  );
}

export default App;
