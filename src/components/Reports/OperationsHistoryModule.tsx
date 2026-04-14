import { useState } from 'react';
import { Truck, Drill, Factory, ClipboardCheck, Clock, Camera, Package, Fuel, Shield, Wallet, List, Zap, ShoppingCart } from 'lucide-react';

import { DrillingDetails } from '../Contractor/DrillingDetails';
import { BlastingDetails } from '../Contractor/BlastingDetails';
import { LoadingDetails } from '../Contractor/LoadingDetails';
import { TransportDetails } from '../Contractor/TransportDetails';
import { AttendanceDetails } from '../Contractor/AttendanceDetails';
import { MediaDetails } from '../Contractor/MediaDetails';
import { InventoryDetails } from '../Inventory/InventoryDetails';
import { FuelDetails } from '../Fuel/FuelDetails';
import { SafetyDetails } from '../Safety/SafetyDetails';
import { AccountsDetails } from '../Accounts/AccountsDetails';
import { DispatchDetails } from '../Resources/DispatchDetails';
import { ProductionStockDetails } from '../Stock/ProductionStockDetails';
import { PurchaseRequestDetails } from '../Stock/PurchaseRequestDetails';
import { CrusherProductionDetails } from '../Crusher/CrusherProductionDetails';
import { EBReportDetails } from '../Crusher/EBReportDetails';
import { JCBOperationsDetails } from '../Operations/JCBOperationsDetails';
import { PermitDetails } from '../Permit/PermitDetails';

export function OperationsHistoryModule() {
    const [activeTab, setActiveTab] = useState('transport');

    const tabs = [
        { id: 'transport', name: 'Transport', icon: Truck },
        { id: 'drilling', name: 'Drilling', icon: Drill },
        { id: 'blasting', name: 'Blasting', icon: Factory },
        { id: 'loading', name: 'Loading', icon: ClipboardCheck },
        { id: 'crusher', name: 'Crusher Production', icon: Factory },
        { id: 'quarry-attendance', name: 'Quarry Attendance', icon: Clock },
        { id: 'crusher-attendance', name: 'Crusher Attendance', icon: Clock },
        { id: 'media', name: 'Media', icon: Camera },
        { id: 'inventory', name: 'Inventory', icon: Package },
        { id: 'stock', name: 'Production Stock', icon: Package },
        { id: 'requests', name: 'Purchase Requests', icon: ShoppingCart },
        { id: 'fuel', name: 'Fuel', icon: Fuel },
        { id: 'safety', name: 'Safety', icon: Shield },
        { id: 'accounts', name: 'Accounts', icon: Wallet },
        { id: 'dispatch', name: 'Dispatch', icon: List },
        { id: 'eb', name: 'EB Reports', icon: Zap },
        { id: 'jcb', name: 'JCB Operations', icon: Truck },
        { id: 'permits', name: 'Permits', icon: ClipboardCheck },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'transport': return <TransportDetails />;
            case 'drilling': return <DrillingDetails />;
            case 'blasting': return <BlastingDetails />;
            case 'loading': return <LoadingDetails />;
            case 'crusher': return <CrusherProductionDetails />;
            case 'quarry-attendance': return <AttendanceDetails allowedLocations={['Quarry']} />;
            case 'crusher-attendance': return <AttendanceDetails allowedLocations={['Crusher', 'Production']} />;
            case 'media': return <MediaDetails />;
            case 'inventory': return <InventoryDetails />;
            case 'stock': return <ProductionStockDetails />;
            case 'requests': return <PurchaseRequestDetails />;
            case 'fuel': return <FuelDetails />;
            case 'safety': return <SafetyDetails />;
            case 'accounts': return <AccountsDetails />;
            case 'dispatch': return <DispatchDetails />;
            case 'eb': return <EBReportDetails />;
            case 'jcb': return <JCBOperationsDetails />;
            case 'permits': return <PermitDetails />;
            default: return <TransportDetails />;
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">Select Operation History</label>
                <div className="flex flex-wrap gap-2">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                    }`}
                            >
                                <Icon className="w-4 h-4" />
                                {tab.name}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div>
                {renderContent()}
            </div>
        </div>
    );
}
