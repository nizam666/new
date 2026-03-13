interface InvoiceItem {
  material: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface ThermalInvoiceData {
  invoice_number: string;
  customer_name: string;
  invoice_date: string;
  due_date: string;
  items: string | InvoiceItem[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  notes?: string;
  terms_conditions?: string;
  status: string;
}

export function printThermalInvoice(invoice: ThermalInvoiceData, showCompanyName: boolean = true) {
  const items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items;
  const printWindow = window.open('', '_blank', 'width=300,height=600');
  
  if (!printWindow) {
    alert('Please allow pop-ups to print invoice');
    return;
  }

  const balance = invoice.total_amount - invoice.amount_paid;

  // Helper function to format text with padding
  const formatLine = (left: string, right: string, width: number = 32) => {
    const spaces = width - left.length - right.length;
    return left + ' '.repeat(Math.max(1, spaces)) + right;
  };

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Invoice ${invoice.invoice_number}</title>
        <meta charset="UTF-8">
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
          }
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            width: 80mm;
            font-family: 'Courier New', monospace;
            font-size: 10pt;
            line-height: 1.4;
            padding: 5mm;
            background: white;
          }
          
          .center {
            text-align: center;
          }
          
          .bold {
            font-weight: bold;
          }
          
          .header {
            text-align: center;
            margin-bottom: 10px;
          }
          
          .company-name {
            font-size: 16pt;
            font-weight: bold;
            margin-bottom: 2px;
          }
          
          .invoice-title {
            font-size: 12pt;
            margin-bottom: 5px;
          }
          
          .separator {
            margin: 8px 0;
            border: none;
            border-top: 2px solid #000;
          }
          
          .dotted-line {
            margin: 5px 0;
            border: none;
            border-top: 1px dashed #666;
          }
          
          .section {
            margin: 8px 0;
          }
          
          .line {
            display: flex;
            justify-content: space-between;
            margin: 2px 0;
          }
          
          .item-row {
            margin: 3px 0;
          }
          
          .total-section {
            margin-top: 8px;
            border-top: 2px solid #000;
            padding-top: 5px;
          }
          
          .grand-total {
            font-size: 12pt;
            font-weight: bold;
            margin: 5px 0;
          }
          
          .status-badge {
            display: inline-block;
            padding: 2px 8px;
            margin: 5px 0;
            border: 1px solid #000;
            font-weight: bold;
          }
          
          .notes {
            margin-top: 10px;
            font-size: 9pt;
            padding: 5px;
            border: 1px solid #666;
          }
          
          .terms {
            margin-top: 8px;
            font-size: 8pt;
            text-align: center;
          }
          
          .footer {
            margin-top: 15px;
            text-align: center;
            font-size: 9pt;
          }
          
          pre {
            font-family: 'Courier New', monospace;
            font-size: 10pt;
            white-space: pre;
            margin: 0;
          }
          
          @media print {
            body {
              width: 80mm;
              padding: 2mm;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          ${showCompanyName ? '<div class="company-name">SRI BABA BLUE MATELS PVT LTD</div>' : ''}
          <div class="invoice-title">BILL</div>
        </div>
        
        <hr class="separator">
        
        <div class="section">
          <pre>Bill#: ${invoice.invoice_number}</pre>
          <pre>Date    : ${new Date(invoice.invoice_date).toLocaleDateString('en-GB')}</pre>
          <pre>Due Date: ${new Date(invoice.due_date).toLocaleDateString('en-GB')}</pre>
        </div>
        
        <hr class="dotted-line">
        
        <div class="section">
          <div class="bold">BILL TO:</div>
          <pre>${invoice.customer_name}</pre>
        </div>
        
        <hr class="separator">
        
        <div class="section">
          <pre class="bold">${formatLine('Item', 'Amount', 32)}</pre>
          <pre class="bold">${formatLine('Qty x Rate', '', 32)}</pre>
          <hr class="dotted-line">
          ${items.map((item: InvoiceItem) => `
          <div class="item-row">
            <pre>${item.material}</pre>
            <pre>${item.amount.toFixed(2)}</pre>
          </div>
          <pre>${item.quantity} x ${item.rate.toFixed(2)}</pre>
          `).join('')}
        </div>
        
        <hr class="dotted-line">
        
        <div class="total-section">
          <div class="line">
            <span>Total Amount:</span>
            <span class="bold">${invoice.total_amount.toFixed(2)}</span>
          </div>
          ${invoice.amount_paid > 0 ? `
          <hr class="dotted-line">
          <div class="line">
            <span>Paid:</span>
            <span>${invoice.amount_paid.toFixed(2)}</span>
          </div>
          <div class="line">
            <span>Balance:</span>
            <span class="bold">${balance.toFixed(2)}</span>
          </div>
          ` : ''}
        </div>
        
        <div class="center">
          <span class="status-badge">${invoice.status.toUpperCase()}</span>
        </div>
        
        ${invoice.notes ? `
        <div class="notes">
          <div class="bold">Notes:</div>
          <pre style="white-space: pre-wrap; font-size: 9pt;">${invoice.notes}</pre>
        </div>
        ` : ''}
        
        ${invoice.terms_conditions ? `
        <div class="terms">
          <hr class="dotted-line">
          <div class="bold">Terms & Conditions</div>
          <pre style="white-space: pre-wrap; font-size: 8pt;">${invoice.terms_conditions}</pre>
        </div>
        ` : ''}
        
        <div class="footer">
          <hr class="dotted-line">
          <div>Thank you for your business!</div>
          <div style="margin-top: 3px; font-size: 8pt;">Printed: ${new Date().toLocaleString('en-GB')}</div>
        </div>
      </body>
    </html>
  `);

  printWindow.document.close();
  
  // Wait a bit for content to load before printing
  setTimeout(() => {
    printWindow.print();
  }, 250);
}

// Alternative function for 58mm thermal printers (smaller)
export function printThermalInvoice58mm(invoice: ThermalInvoiceData, showCompanyName: boolean = true) {
  const items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items;
  const printWindow = window.open('', '_blank', 'width=220,height=600');
  
  if (!printWindow) {
    alert('Please allow pop-ups to print invoice');
    return;
  }

  const balance = invoice.total_amount - invoice.amount_paid;

  const formatLine = (left: string, right: string, width: number = 24) => {
    const spaces = width - left.length - right.length;
    return left + ' '.repeat(Math.max(1, spaces)) + right;
  };

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Invoice ${invoice.invoice_number}</title>
        <meta charset="UTF-8">
        <style>
          @page {
            size: 58mm auto;
            margin: 0;
          }
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            width: 58mm;
            font-family: 'Courier New', monospace;
            font-size: 9pt;
            line-height: 1.3;
            padding: 3mm;
            background: white;
          }
          
          .center { text-align: center; }
          .bold { font-weight: bold; }
          
          .company-name {
            font-size: 14pt;
            font-weight: bold;
            text-align: center;
            margin-bottom: 2px;
          }
          
          .separator {
            margin: 5px 0;
            border: none;
            border-top: 1px solid #000;
          }
          
          .section { margin: 5px 0; }
          
          pre {
            font-family: 'Courier New', monospace;
            font-size: 9pt;
            white-space: pre;
            margin: 1px 0;
          }
          
          .grand-total {
            font-size: 11pt;
            font-weight: bold;
          }
          
          @media print {
            body {
              width: 58mm;
              padding: 2mm;
            }
          }
        </style>
      </head>
      <body>
        ${showCompanyName ? '<div class="company-name">SRI BABA BLUE MATELS PVT LTD</div>' : ''}
        <div class="center bold">BILL</div>
        <hr class="separator">
        
        <div class="section">
          <pre>INV: ${invoice.invoice_number}</pre>
          <pre>Date: ${new Date(invoice.invoice_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}</pre>
          <pre>Customer:</pre>
          <pre>${invoice.customer_name.substring(0, 22)}</pre>
        </div>
        
        <hr class="separator">
        
        <div class="section">
          ${items.map((item: InvoiceItem) => `
          <pre>${item.material.substring(0, 24)}</pre>
          <pre>${formatLine(`${item.quantity}x${item.rate}`, `₹${item.amount.toFixed(2)}`, 24)}</pre>
          `).join('')}
        </div>
        
        <hr class="separator">
        
        <div class="section">
          <pre class="bold grand-total">${formatLine('TOTAL:', `₹${invoice.total_amount.toFixed(2)}`, 24)}</pre>
          ${invoice.amount_paid > 0 ? `
          <pre>${formatLine('Paid:', `₹${invoice.amount_paid.toFixed(2)}`, 24)}</pre>
          <pre class="bold">${formatLine('Balance:', `₹${balance.toFixed(2)}`, 24)}</pre>
          ` : ''}
        </div>
        
        <div class="center bold">[${invoice.status.toUpperCase()}]</div>
        
        <div class="center" style="margin-top: 10px; font-size: 8pt;">
          <pre>Thank You!</pre>
        </div>
      </body>
    </html>
  `);

  printWindow.document.close();
  
  setTimeout(() => {
    printWindow.print();
  }, 250);
}
