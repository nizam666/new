import {
    Home,
    Factory,
    Drill,
    ClipboardCheck,
    Truck,
    Users,
    Clock,
    Camera,
    Package,
    Fuel,
    Shield,
    Zap,
    ShoppingCart,
    FileText,
    Wallet,
    List,
    BarChart3,
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
    {
        name: 'Quarry Work',
        icon: Factory,
        children: [
            { name: 'Drilling', icon: Drill, href: '#drilling' },
            { name: 'Blasting', icon: Factory, href: '#blasting' },
            { name: 'Breaking/Loading', icon: ClipboardCheck, href: '#loading' },
            { name: 'Transport', icon: Truck, href: '#transport' },
            { name: 'Attendance', icon: Clock, href: '#quarry-attendance' },

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
                    { name: 'Attendance', icon: Clock, href: '#attendance' },
                    { name: 'Photos/Videos', icon: Camera, href: '#media' },
                ]
            },
            {
                name: 'Resources',
                icon: Package,
                children: [
                    { name: 'Inventory', icon: Package, href: '#inventory' },
                    { name: 'Fuel', icon: Fuel, href: '#fuel' },
                    { name: 'Safety', icon: Shield, href: '#safety' },
                ]
            },
            {
                name: 'Crusher Production',
                icon: Factory,
                href: '#crusher-production'
            },
            {
                name: 'EB Reports',
                icon: Zap,
                href: '#eb-reports'
            },
            { name: 'JCB Operations', icon: Truck, href: '#jcb-operations' },
        ]
    },
    {
        name: 'Sales & Customers',
        icon: ShoppingCart,
        children: [
            { name: 'Sales', icon: ShoppingCart, href: '#sales' },
            { name: 'Customers', icon: Users, href: '#customers' },
        ]
    },
    {
        name: 'Permits',
        icon: FileText,
        href: '#new-permit'
    },
    { name: 'Accounts', icon: Wallet, href: '#accounts' },
    { name: 'Dispatch List', icon: List, href: '#dispatch-payment' },
    {
        name: 'Stock Management',
        icon: Package,
        children: [
            { name: 'Production Stock', icon: Package, href: '#production-stock' },
            { name: 'Purchase Requests', icon: ShoppingCart, href: '#purchase-requests' },
        ]
    },
    { name: 'User Management', icon: Users, href: '#user-management' },
    {
        name: 'Reports',
        icon: BarChart3,
        children: [
            { name: 'Dashboard', icon: BarChart3, href: '#reports' },
            { name: 'Permit Reports', icon: FileText, href: '#permit-report' }
        ]
    },
];

export const MANAGER_NAV: MenuItem[] = [
    { name: 'Dashboard', icon: BarChart3, href: '#dashboard', roles: ['contractor', 'crusher_manager', 'manager', 'sales'] },
    { name: 'Drilling', icon: Drill, href: '#drilling', roles: ['contractor', 'manager'] },
    { name: 'Blasting', icon: Factory, href: '#blasting', roles: ['contractor', 'manager'] },
    { name: 'Breaking/Loading', icon: ClipboardCheck, href: '#loading', roles: ['contractor', 'manager'] },
    { name: 'Transport', icon: Truck, href: '#transport', roles: ['contractor', 'manager'] },
    { name: 'Attendance', icon: Clock, href: '#attendance', roles: ['contractor', 'manager'] },
    { name: 'Photos/Videos', icon: Camera, href: '#media', roles: ['contractor', 'manager'] },
    { name: 'Inventory', icon: Package, href: '#inventory', roles: ['contractor', 'manager'] },
    { name: 'Fuel', icon: Fuel, href: '#fuel', roles: ['contractor', 'manager'] },
    { name: 'Safety', icon: Shield, href: '#safety', roles: ['contractor', 'manager'] },
    {
        name: 'Crusher Production',
        icon: Factory,
        href: '#crusher-production',
        roles: ['crusher_manager', 'manager']
    },
    {
        name: 'EB Reports',
        icon: Zap,
        href: '#eb-reports',
        roles: ['crusher_manager', 'manager']
    },
    { name: 'Sales', icon: ShoppingCart, href: '#sales', roles: ['sales', 'manager'] },
    { name: 'Customers', icon: Users, href: '#customers', roles: ['sales', 'manager'] },
    { name: 'Approvals', icon: ClipboardCheck, href: '#approvals', roles: ['manager'] },
    { name: 'Reports', icon: BarChart3, href: '#reports', roles: ['manager'] },
];

export const getNavigationByRole = (role?: string): MenuItem[] => {
    if (role === 'director') {
        return DIRECTOR_NAV;
    }

    return MANAGER_NAV.filter(item => {
        // If explicit roles are defined, check if user has access
        if (item.roles) {
            return item.roles.includes(role || '');
        }
        // If no roles defined, assume it's publicly available (though in this specific list everything has roles now)
        return true;
    });
};
