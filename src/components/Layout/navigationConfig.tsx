import {
    Home,
    Factory,
    Drill,
    ClipboardCheck,
    ClipboardList,
    Truck,
    Users,
    Clock,
    Camera,
    Package,
    Shield,
    Zap,
    ShoppingCart,
    FileText,
    Wallet,
    BarChart3,
    TrendingUp,
    Wrench,
    Receipt,
    Calculator,
    Database,
    RotateCcw,
    LucideIcon
} from 'lucide-react';

export interface MenuItem {
    name: string;
    icon: LucideIcon;
    href?: string;
    roles?: string[];
    children?: MenuItem[];
}

export const DIRECTOR_NAV: MenuItem[] = [
    { name: 'Dashboard', icon: Home, href: '#dashboard' },
    { name: 'Selfie Attendance', icon: Camera, href: '#quarry-attendance' },
    {
        name: 'Quarry Work',
        icon: Factory,
        children: [
            { name: 'Drilling', icon: Drill, href: '#drilling' },
            { name: 'Blasting', icon: Factory, href: '#blasting' },
            { name: 'Breaking/Loading', icon: ClipboardCheck, href: '#loading' },
            { name: 'Transport', icon: Truck, href: '#transport' },
            { name: 'Attendance', icon: Clock, href: '#quarry-attendance' },
            { name: 'Storage Management', icon: Database, href: '#quarry-storage-management' },
            { name: 'Boulders Sale Report', icon: TrendingUp, href: '#boulders-sale-report' },
            { name: 'Contractor Calculator', icon: Calculator, href: '#quarry-contractor-calculator' },
            { name: 'Quarry Production Report', icon: FileText, href: '#quarry-production-report' },
            { name: 'Quarry Deduction Report', icon: FileText, href: '#quarry-deduction-report' },
        ]
    },
    {
        name: 'Crusher Work',
        icon: Factory,
        children: [
            {
                name: 'Workforce',
                icon: Users,
                children: [
                    { name: 'Attendance', icon: Clock, href: '#crusher-attendance' },
                    { name: 'Photos/Videos', icon: Camera, href: '#media' },
                ]
            },
            { name: 'Crusher Production', icon: Factory, href: '#crusher-production' },
            { name: 'Average Production Cost', icon: TrendingUp, href: '#crusher-efficiency' },
            { name: 'EB Reports', icon: Zap, href: '#eb-reports' },
            { name: 'EB Records', icon: Receipt, href: '#eb-records' },
            { name: 'EB Calculator', icon: Calculator, href: '#eb-calculator' },
            { name: 'Maintenance', icon: Wrench, href: '#crusher-maintenance' },
            { name: 'JCB Operations', icon: Truck, href: '#crusher-jcb-operations' },
        ]
    },
    {
        name: 'Inventory',
        icon: Package,
        children: [
            { name: 'Vendor Management', icon: Users, href: '#vendor-management' },
            { name: 'New Bill Entry', icon: Receipt, href: '#vendor-bill-entry' },
            { name: 'Inventory', icon: Package, href: '#inventory' },
            { name: 'Returnable Assets', icon: RotateCcw, href: '#returnable-assets' },
            { name: 'Storage', icon: Database, href: '#storage' },
            { name: 'Dispatch', icon: Truck, href: '#dispatch-payment' },
            { name: 'Dispatch Reports', icon: FileText, href: '#inventory-dispatch-report' },
        ]
    },
    { name: 'Safety', icon: Shield, href: '#safety' },
    {
        name: 'Sales & Customers',
        icon: ShoppingCart,
        children: [
            { name: 'Sales', icon: ShoppingCart, href: '#sales' },
            { name: 'Customers', icon: Users, href: '#customers' },
            { name: 'Material Investors', icon: TrendingUp, href: '#material-investors' },
        ]
    },
    { name: 'Permits', icon: FileText, href: '#new-permit' },
    { name: 'Accounts', icon: Wallet, href: '#accounts' },

    { name: 'User Management', icon: Users, href: '#user-management' },
    { name: 'Contractor Management', icon: Users, href: '#contractor-management' },
    { name: 'Overhead Management', icon: Wallet, href: '#overhead-management' },
    {
        name: 'Reports',
        icon: BarChart3,
        children: [
            { name: 'Production Report', icon: Factory, href: '#production-report' },
            { name: 'Quarry Production', icon: Drill, href: '#quarry-report' },
            { name: 'Quarry Production Cost', icon: FileText, href: '#quarry-cost' },
            { name: 'Operations History', icon: ClipboardList, href: '#operations-history' },
            { name: 'Sales Report', icon: ShoppingCart, href: '#sales-report' },
            { name: 'Accounting Report', icon: Wallet, href: '#accounting-report' },
            { name: 'Attendance Report', icon: Clock, href: '#attendance-report' },
            { name: 'Permit Reports', icon: FileText, href: '#permit-report' },
            { name: 'Master Contractor Report', icon: ClipboardCheck, href: '#contractor_report' },
        ]
    },
];

export const MANAGER_NAV: MenuItem[] = [
    { name: 'Dashboard', icon: BarChart3, href: '#dashboard', roles: ['contractor', 'crusher_manager', 'manager', 'sales'] },
    { name: 'Drilling', icon: Drill, href: '#drilling', roles: ['contractor', 'manager'] },
    { name: 'Blasting', icon: Factory, href: '#blasting', roles: ['contractor', 'manager'] },
    { name: 'Breaking/Loading', icon: ClipboardCheck, href: '#loading', roles: ['contractor', 'manager'] },
    { name: 'Transport', icon: Truck, href: '#transport', roles: ['contractor', 'manager'] },
    { name: 'Boulders Sale Report', icon: TrendingUp, href: '#boulders-sale-report', roles: ['contractor', 'manager'] },
    { name: 'Contractor Calculator', icon: Calculator, href: '#quarry-contractor-calculator', roles: ['contractor', 'manager'] },
    { name: 'Quarry Production Report', icon: FileText, href: '#quarry-production-report', roles: ['contractor', 'manager'] },
    { name: 'Quarry Deduction Report', icon: FileText, href: '#quarry-deduction-report', roles: ['contractor', 'manager'] },
    { name: 'Selfie Attendance', icon: Camera, href: '#attendance' },
    { name: 'Attendance', icon: Clock, href: '#attendance', roles: ['contractor', 'crusher_manager', 'manager', 'sales', 'worker', 'security', 'driver'] },
    { name: 'Photos/Videos', icon: Camera, href: '#media', roles: ['contractor', 'manager'] },
    { name: 'Inventory', icon: Package, href: '#inventory', roles: ['contractor', 'crusher_manager', 'manager'] },
    { name: 'Returnable Assets', icon: RotateCcw, href: '#returnable-assets', roles: ['crusher_manager', 'manager'] },
    { name: 'Dispatch Reports', icon: FileText, href: '#inventory-dispatch-report', roles: ['crusher_manager', 'manager'] },
    { name: 'Safety', icon: Shield, href: '#safety', roles: ['contractor', 'manager'] },
    { name: 'Crusher Production', icon: Factory, href: '#crusher-production', roles: ['crusher_manager', 'manager'] },
    { name: 'Average Production Cost', icon: TrendingUp, href: '#crusher-efficiency', roles: ['crusher_manager', 'manager'] },
    { name: 'EB Reports', icon: Zap, href: '#eb-reports', roles: ['crusher_manager', 'manager'] },
    { name: 'EB Records', icon: Receipt, href: '#eb-records', roles: ['crusher_manager', 'manager'] },
    { name: 'EB Calculator', icon: Calculator, href: '#eb-calculator', roles: ['crusher_manager', 'manager'] },
    { name: 'Crusher Maintenance', icon: Wrench, href: '#crusher-maintenance', roles: ['crusher_manager', 'manager'] },
    { name: 'Sales', icon: ShoppingCart, href: '#sales', roles: ['sales', 'manager'] },
    { name: 'Customers', icon: Users, href: '#customers', roles: ['sales', 'manager'] },
    { name: 'Approvals', icon: ClipboardCheck, href: '#approvals', roles: ['manager'] },
    {
        name: 'Reports',
        icon: BarChart3,
        roles: ['manager'],
        children: [
            { name: 'Production Report', icon: Factory, href: '#production-report' },
            { name: 'Quarry Production', icon: Drill, href: '#quarry-report' },
            { name: 'Quarry Production Cost', icon: FileText, href: '#quarry-cost' },
            { name: 'Operations History', icon: ClipboardList, href: '#operations-history' },
            { name: 'Sales Report', icon: ShoppingCart, href: '#sales-report' },
            { name: 'Accounting Report', icon: Wallet, href: '#accounting-report' },
            { name: 'Attendance Report', icon: Clock, href: '#attendance-report' },
            { name: 'Permit Reports', icon: FileText, href: '#permit-report' },
            { name: 'Master Contractor Report', icon: ClipboardCheck, href: '#contractor_report' },
        ]
    },
];

export const CHAIRMEN_NAV: MenuItem[] = [
    { name: 'Dashboard', icon: Home, href: '#dashboard' },
    { name: 'Selfie Attendance', icon: Camera, href: '#attendance' },
    { name: 'Accounts', icon: Wallet, href: '#accounts' },
    {
        name: 'Reports',
        icon: BarChart3,
        children: [
            { name: 'Production Report', icon: Factory, href: '#production-report' },
            { name: 'Quarry Production', icon: Drill, href: '#quarry-report' },
            { name: 'Quarry Production Cost', icon: FileText, href: '#quarry-cost' },
            { name: 'Operations History', icon: ClipboardList, href: '#operations-history' },
            { name: 'Sales Report', icon: ShoppingCart, href: '#sales-report' },
            { name: 'Accounting Report', icon: Wallet, href: '#accounting-report' },
            { name: 'Attendance Report', icon: Clock, href: '#attendance-report' },
            { name: 'Permit Reports', icon: FileText, href: '#permit-report' },
            { name: 'Master Contractor Report', icon: ClipboardCheck, href: '#contractor_report' },
        ]
    },
];

export const getNavigationByRole = (role?: string): MenuItem[] => {
    if (role === 'director') {
        return DIRECTOR_NAV;
    }

    if (role === 'chairmen') {
        return CHAIRMEN_NAV;
    }

    return MANAGER_NAV.filter(item => {
        if (item.roles) {
            return item.roles.includes(role || '');
        }
        return true;
    });
};
