# GST-Inclusive Pricing Implementation

## Overview

The invoice system now uses **GST-inclusive pricing**, meaning the rate you enter already includes GST tax. The system automatically extracts and displays the base amount and GST separately.

## How It Works

### Pricing Model

**Rate = Base Price + GST (whole product price)**

When you enter a rate of ₹105 with 5% GST:
- **Rate entered**: ₹105 (GST inclusive)
- **Base amount calculated**: ₹100 (₹105 ÷ 1.05)
- **GST amount**: ₹5 (₹105 - ₹100)
- **Total**: ₹105

### Calculation Formula

```
Base Amount = Total / (1 + GST Rate / 100)
GST Amount = Total - Base Amount
Total = Rate × Quantity (already includes GST)
```

### Example with 5% GST

| Rate (Inc. GST) | Quantity | Amount | Base Amount | GST (5%) | Total (Inc. GST) |
|-----------------|----------|--------|-------------|----------|------------------|
| ₹105.00         | 10       | ₹1,050 | ₹1,000.00   | ₹50.00   | ₹1,050.00        |
| ₹525.00         | 5        | ₹2,625 | ₹2,500.00   | ₹125.00  | ₹2,625.00        |

## Changes Made

### 1. Invoice Form (`InvoiceForm.tsx`)

#### Default GST Rate
- Changed from **18%** to **5%**

#### Calculation Logic
- **Old**: Subtotal calculated first, then GST added on top
- **New**: Total calculated first (sum of amounts), then GST extracted from it

#### User Interface
- Added note: "Rate is GST inclusive (includes X% GST)"
- Column headers updated: "Rate (Inc. GST)"
- Totals section updated:
  - "Subtotal" → "Base Amount"
  - "Tax" → "GST"
  - "Total" → "Total (Inc. GST)"

### 2. Calculation Function

```typescript
const calculateTotals = () => {
  // Total is the sum of all item amounts (which include GST)
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  const taxRate = parseFloat(formData.tax_rate) || 0;
  
  // Extract GST from the total (reverse calculation)
  const subtotal = total / (1 + taxRate / 100);
  const taxAmount = total - subtotal;

  return { subtotal, taxAmount, total };
};
```

## Usage Instructions

### Creating an Invoice

1. **Add Invoice Items**
   - Enter material/description
   - Enter quantity
   - Enter **rate including GST** (the final selling price)
   - Amount is calculated automatically (quantity × rate)

2. **Review Totals**
   - **Base Amount**: The amount before GST
   - **GST**: The tax amount extracted from your rates
   - **Total (Inc. GST)**: The final amount (same as sum of all item amounts)

3. **GST Rate**
   - Default: **5%**
   - Can be changed as needed
   - System will recalculate base amount and GST automatically

### Invoice Display

When viewing or printing invoices:
- **Subtotal** = Base amount (before GST)
- **Tax/GST** = Extracted GST amount
- **Total Amount** = Final amount including GST

## Benefits

✅ **Simpler Data Entry**: Enter the actual selling price directly  
✅ **Accurate GST Calculation**: System extracts exact GST amount  
✅ **Compliant Invoicing**: Shows base amount and GST separately  
✅ **Transparent Pricing**: Customers see breakdown of base price and tax  

## Important Notes

- The **rate field** now represents the **final selling price including GST**
- The system automatically calculates the base amount by dividing by (1 + GST%)
- All existing invoice calculations in database remain unchanged
- Only new invoices created after this update will use GST-inclusive pricing
- GST rate can be adjusted per invoice as needed

## Database Schema

The database columns remain the same:
- `subtotal`: Base amount (calculated)
- `tax_rate`: GST percentage
- `tax_amount`: GST amount (calculated)
- `total_amount`: Final amount including GST
- `items`: JSON array with rate, quantity, amount per item

## Verification Example

To verify the calculation is correct:

1. Enter rate: **₹105** with **5% GST**
2. Quantity: **1**
3. Expected results:
   - Amount: ₹105.00
   - Base Amount: ₹100.00 (₹105 ÷ 1.05)
   - GST (5%): ₹5.00 (₹105 - ₹100)
   - Total: ₹105.00

Formula verification: ₹100 × 1.05 = ₹105 ✓
