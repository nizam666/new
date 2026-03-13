# Thermal Printer Invoice Generator

This guide explains how to use the thermal printer invoice generator in your Quarry ERP system.

## Features

The system now supports **3 print formats**:

1. **Standard Print (A4)** - Regular invoice printing for letter/A4 paper
2. **Thermal 80mm** - Standard thermal printer (80mm width)
3. **Thermal 58mm** - Compact thermal printer (58mm width)

## How to Use

1. Navigate to the **Invoice Details** page
2. Find the invoice you want to print
3. Click the **Print** button
4. Select your preferred print format from the dropdown menu:
   - **Standard Print** - For regular printers
   - **Thermal 80mm** - For standard thermal receipt printers
   - **Thermal 58mm** - For compact thermal receipt printers

## Thermal Print Features

### 80mm Thermal Format
- Optimized for 80mm thermal paper
- Clear, easy-to-read layout
- Includes:
  - Company name and invoice title
  - Invoice number, dates, and customer info
  - Itemized list with quantities and amounts
  - Subtotal, tax, and total calculations
  - Payment status and balance due
  - Notes and terms & conditions (if any)
  - Thank you message with print timestamp

### 58mm Thermal Format
- Compact layout for 58mm thermal paper
- Space-efficient design
- Contains all essential invoice information
- Perfect for small receipt printers

## Technical Details

### File Structure
- **Component**: `/src/components/Sales/InvoiceDetails.tsx`
- **Utility**: `/src/utils/thermalPrinter.ts`

### Functions
- `printThermalInvoice(invoice)` - Generates 80mm thermal print
- `printThermalInvoice58mm(invoice)` - Generates 58mm thermal print

### Print Format
Both thermal formats use:
- Monospace font (Courier New) for proper alignment
- Fixed-width layout optimized for thermal paper
- Clear section separators
- Proper spacing for readability
- Print-optimized CSS with @page directives

## Browser Compatibility

The thermal printer generator works with the browser's native print functionality:
- Opens a new window with the formatted invoice
- Uses browser's print dialog
- Compatible with all thermal printers that support standard web printing

## Printer Setup

For best results:
1. Ensure your thermal printer is properly connected
2. Select the correct paper size in your printer settings:
   - 80mm (3.15 inches) for standard thermal
   - 58mm (2.28 inches) for compact thermal
3. Set margins to minimal in print dialog
4. Print using the browser's print function

## Customization

You can customize the thermal print format by editing:
- **Company name**: Currently set to "SRI BABA BLUE MATELS PVT LTD" in the thermal printer utility
- **Layout**: Adjust CSS styles in the `<style>` section
- **Content**: Modify the HTML template in the utility functions

## Notes

- The thermal print opens in a new window/tab
- Pop-ups must be allowed for the print window to open
- The invoice automatically formats for thermal paper width
- All invoice data (items, amounts, notes, terms) are included
- Print timestamp is added at the bottom of each receipt
