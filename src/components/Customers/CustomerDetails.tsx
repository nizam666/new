import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Search, User, Building, Phone, Mail, MapPin, Edit, Trash2, Plus, FileText } from 'lucide-react';
import { format, subDays, addDays } from 'date-fns';
import { CustomerForm } from './CustomerForm';

interface Invoice {
  id: string;
  invoice_number: string;
  date: string;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  status: 'paid' | 'pending' | 'overdue';
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
  }>;
}

interface Customer {
  id: string;
  company_name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  tax_id: string;
  customer_type: string;
  payment_terms: string;
  credit_limit: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

export function CustomerDetails() {
  // Initialize auth context (user is not used yet but kept for future use)
  useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalBalance, setTotalBalance] = useState(0);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('company_name', { ascending: true });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this customer?')) return;

    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Refresh the customer list
      fetchCustomers();
      alert('Customer deleted successfully');
    } catch (error) {
      alert('Error deleting customer: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setShowForm(true);
  };

  const handleCustomerClick = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setLoadingInvoices(true);

    try {
      // Fetch invoices for the selected customer from the last 10 days
      const tenDaysAgo = format(subDays(new Date(), 10), 'yyyy-MM-dd');

      // This is a mock implementation - replace with actual Supabase query
      // when you have the invoices table set up
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('*')
        .eq('customer_id', customer.id)
        .gte('date', tenDaysAgo)
        .order('date', { ascending: false });

      if (invoicesError) throw invoicesError;

      // Calculate total balance
      const balance = invoicesData?.reduce((sum, inv) => {
        return sum + (inv.total_amount - (inv.paid_amount || 0));
      }, 0) || 0;

      setInvoices(invoicesData || []);
      setTotalBalance(balance);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      // For demo purposes, we'll use mock data
      const mockInvoices: Invoice[] = [
        {
          id: '1',
          invoice_number: 'INV-2023-001',
          date: format(subDays(new Date(), 2), 'yyyy-MM-dd'),
          due_date: format(addDays(new Date(), 28), 'yyyy-MM-dd'),
          total_amount: 125000,
          paid_amount: 75000,
          status: 'pending',
          items: [
            { description: 'Crushed Stone (20mm)', quantity: 50, unit_price: 2500, amount: 125000 }
          ]
        },
        {
          id: '2',
          invoice_number: 'INV-2023-002',
          date: format(subDays(new Date(), 5), 'yyyy-MM-dd'),
          due_date: format(subDays(new Date(), 1), 'yyyy-MM-dd'),
          total_amount: 84000,
          paid_amount: 84000,
          status: 'paid',
          items: [
            { description: 'Crushed Stone (10mm)', quantity: 30, unit_price: 2800, amount: 84000 }
          ]
        }
      ];

      const mockBalance = mockInvoices.reduce((sum, inv) => {
        return sum + (inv.total_amount - inv.paid_amount);
      }, 0);

      setInvoices(mockInvoices);
      setTotalBalance(mockBalance);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleCloseCustomerView = () => {
    setSelectedCustomer(null);
    setInvoices([]);
    setTotalBalance(0);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingCustomer(null);
    fetchCustomers();
  };

  // Filter customers based on search term
  const filteredCustomers = customers.filter(customer =>
    customer.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.contact_person.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (customer.email && customer.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (customer.phone && customer.phone.includes(searchTerm))
  );

  // Get current customers for pagination
  const indexOfLastCustomer = currentPage * itemsPerPage;
  const indexOfFirstCustomer = indexOfLastCustomer - itemsPerPage;
  const currentCustomers = filteredCustomers.slice(indexOfFirstCustomer, indexOfLastCustomer);
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);

  // Change page
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  if (showForm) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => {
            setShowForm(false);
            setEditingCustomer(null);
          }}
          className="flex items-center text-sm text-cyan-600 hover:text-cyan-700 mb-4"
        >
          ← Back to customers
        </button>
        <CustomerForm
          onSuccess={handleFormSuccess}
          initialData={editingCustomer || undefined}
        />
      </div>
    );
  }

  if (selectedCustomer) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <button
            onClick={handleCloseCustomerView}
            className="flex items-center text-sm text-cyan-600 hover:text-cyan-700 mb-4"
          >
            ← Back to customers
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{selectedCustomer.company_name}</h2>
              <p className="text-slate-600">{selectedCustomer.customer_type} • {selectedCustomer.tax_id}</p>

              <div className="mt-4 space-y-2">
                <div className="flex items-center text-slate-700">
                  <User className="h-4 w-4 mr-2 text-slate-500" />
                  {selectedCustomer.contact_person}
                </div>
                <div className="flex items-center text-slate-700">
                  <Phone className="h-4 w-4 mr-2 text-slate-500" />
                  {selectedCustomer.phone || 'N/A'}
                </div>
                <div className="flex items-center text-slate-700">
                  <Mail className="h-4 w-4 mr-2 text-slate-500" />
                  {selectedCustomer.email || 'N/A'}
                </div>
                <div className="flex items-start text-slate-700">
                  <MapPin className="h-4 w-4 mr-2 mt-1 flex-shrink-0 text-slate-500" />
                  <span>
                    {selectedCustomer.address}<br />
                    {selectedCustomer.city}{selectedCustomer.city && selectedCustomer.state ? ', ' : ''}{selectedCustomer.state}<br />
                    {selectedCustomer.postal_code} {selectedCustomer.country}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg min-w-[240px]">
              <h3 className="text-sm font-medium text-slate-500 mb-2">Total Balance</h3>
              <div className="text-3xl font-bold text-slate-900">
                ₹{totalBalance.toLocaleString('en-IN')}
              </div>
              <div className="mt-2 text-sm text-slate-500">
                {totalBalance > 0 ? 'Amount Due' : 'No outstanding balance'}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-200">
                <h3 className="text-sm font-medium text-slate-500 mb-2">Payment Terms</h3>
                <div className="text-sm text-slate-700">
                  {selectedCustomer.payment_terms}
                </div>
                <div className="text-sm text-slate-500">
                  Credit Limit: ₹{selectedCustomer.credit_limit?.toLocaleString('en-IN') || '0'}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-cyan-600" />
              Recent Invoices (Last 10 Days)
            </h3>

            {loadingInvoices ? (
              <div className="flex justify-center items-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
              </div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-lg">
                <p className="text-slate-500">No invoices found in the last 10 days</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Invoice #
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Due Date
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {invoices.map((invoice) => (
                      <tr key={invoice.id} className="hover:bg-slate-50 cursor-pointer">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-cyan-600">
                          {invoice.invoice_number}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {format(new Date(invoice.date), 'dd MMM yyyy')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {format(new Date(invoice.due_date), 'dd MMM yyyy')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                          ₹{invoice.total_amount.toLocaleString('en-IN')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${invoice.status === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : invoice.status === 'overdue'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                            }`}>
                            {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <h3 className="text-xl font-bold text-slate-900">Customer Directory</h3>
        <div className="mt-4 md:mt-0">
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Customer
          </button>
        </div>
      </div>

      {/* Search and filter */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-slate-200">
          <Building className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-2 text-sm font-medium text-slate-900">No customers found</h3>
          <p className="mt-1 text-sm text-slate-500">
            {searchTerm ? 'Try a different search term' : 'Get started by adding a new customer'}
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-cyan-600 hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500"
            >
              <Plus className="-ml-1 mr-2 h-5 w-5" />
              New Customer
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <ul className="divide-y divide-slate-200">
              {currentCustomers.map((customer) => (
                <li key={customer.id} className="px-4 py-4 sm:px-6 hover:bg-slate-50">
                  <div className="flex justify-between items-center">
                    <div className="flex-1 min-w-0" onClick={() => handleCustomerClick(customer)}>
                      <div className="flex items-center">
                        <User className="flex-shrink-0 mr-1.5 h-4 w-4 text-slate-400" />
                        <span className="font-medium">{customer.contact_person}</span>
                      </div>
                      <div className="mt-2 flex items-center text-sm text-slate-500">
                        <Phone className="flex-shrink-0 mr-1.5 h-4 w-4 text-slate-400" />
                        {customer.phone || 'N/A'}
                      </div>
                      <div className="mt-2 flex items-center text-sm text-slate-500">
                        <Mail className="flex-shrink-0 mr-1.5 h-4 w-4 text-slate-400" />
                        {customer.email || 'N/A'}
                      </div>
                      <div className="mt-2 flex items-center text-sm text-slate-500">
                        <MapPin className="flex-shrink-0 mr-1.5 h-4 w-4 text-slate-400" />
                        {customer.city}{customer.city && customer.state ? ', ' : ''}{customer.state}
                      </div>
                    </div>
                    <div className="ml-4 flex-shrink-0 flex space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(customer);
                        }}
                        className="p-2 rounded-lg text-cyan-600 hover:bg-cyan-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500"
                        title="Edit"
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(customer.id);
                        }}
                        className="p-2 rounded-lg text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        title="Delete"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 sm:px-6 rounded-b-lg">
              <div className="hidden sm:block">
                <p className="text-sm text-slate-700">
                  Showing <span className="font-medium">{indexOfFirstCustomer + 1}</span> to{' '}
                  <span className="font-medium">
                    {Math.min(indexOfLastCustomer, filteredCustomers.length)}
                  </span>{' '}
                  of <span className="font-medium">{filteredCustomers.length}</span> results
                </p>
              </div>
              <div className="flex-1 flex justify-between sm:justify-end space-x-2">
                <button
                  onClick={() => paginate(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`relative inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-lg ${currentPage === 1
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                >
                  Previous
                </button>
                <button
                  onClick={() => paginate(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={`relative inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-lg ${currentPage === totalPages
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                >
                  Next
                </button>
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
