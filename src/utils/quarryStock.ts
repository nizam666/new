import { supabase } from '../lib/supabase';

export interface QuarryBalance {
  item_name: string;
  total_dispatched: number;
  total_consumed: number;
  remaining: number;
  unit: string;
}

export const ITEM_KEYWORDS = {
  diesel: (name: string) => name.toLowerCase().includes('diesel'),
  pg: (name: string) => {
    const n = name.toLowerCase();
    return n === 'pg' || n.includes('powergel') || n.includes('power gel');
  },
  ed: (name: string) => {
    const n = name.toLowerCase();
    return n === 'ed' || n.includes('electric detonator');
  },
  edet: (name: string) => {
    const n = name.toLowerCase();
    return n === 'edet' || n.includes('electronic detonator');
  },
  nonel_3m: (name: string) => {
    const n = name.toLowerCase();
    return n.includes('nonel') && n.includes('3m');
  },
  nonel_4m: (name: string) => {
    const n = name.toLowerCase();
    return n.includes('nonel') && n.includes('4m');
  }
};

export async function fetchQuarryBalances(): Promise<Record<string, QuarryBalance>> {
  try {
    // 1. Fetch all dispatches to Quarry Operations
    const { data: dispatches, error: dispError } = await supabase
      .from('inventory_dispatch')
      .select('*')
      .eq('department', 'Quarry Operations');

    if (dispError) throw dispError;

    // 2. Fetch consumption data from all 3 operation tables
    const [drillingRes, loadingRes, blastingRes] = await Promise.all([
      supabase.from('drilling_records').select('diesel_consumed'),
      supabase.from('loading_records').select('quantity_loaded'),
      supabase.from('blasting_records').select('pg_nos, ed_nos, edet_nos, nonel_3m_nos, nonel_4m_nos')
    ]);

    const globalConsumed = {
      diesel: (drillingRes.data || []).reduce((sum, r) => sum + (Number(r.diesel_consumed) || 0), 0) +
              (loadingRes.data || []).reduce((sum, r) => sum + (Number(r.quantity_loaded) || 0), 0),
      pg: (blastingRes.data || []).reduce((sum, r) => sum + (Number(r.pg_nos) || 0), 0),
      ed: (blastingRes.data || []).reduce((sum, r) => sum + (Number(r.ed_nos) || 0), 0),
      edet: (blastingRes.data || []).reduce((sum, r) => sum + (Number(r.edet_nos) || 0), 0),
      nonel_3m: (blastingRes.data || []).reduce((sum, r) => sum + (Number(r.nonel_3m_nos) || 0), 0),
      nonel_4m: (blastingRes.data || []).reduce((sum, r) => sum + (Number(r.nonel_4m_nos) || 0), 0),
    };

    // 3. Aggregate dispatches by item
    const balances: Record<string, QuarryBalance> = {};

    (dispatches || []).forEach(curr => {
      const name = curr.item_name;
      const unit = curr.unit;
      
      // We look for a keyword match to group correctly
      let matchKey = name.toLowerCase();
      if (ITEM_KEYWORDS.diesel(name)) matchKey = 'diesel';
      else if (ITEM_KEYWORDS.pg(name)) matchKey = 'pg';
      else if (ITEM_KEYWORDS.ed(name)) matchKey = 'ed';
      else if (ITEM_KEYWORDS.edet(name)) matchKey = 'edet';
      else if (ITEM_KEYWORDS.nonel_3m(name)) matchKey = 'nonel_3m';
      else if (ITEM_KEYWORDS.nonel_4m(name)) matchKey = 'nonel_4m';

      if (!balances[matchKey]) {
        balances[matchKey] = {
          item_name: matchKey === name.toLowerCase() ? name : matchKey.toUpperCase(),
          total_dispatched: 0,
          total_consumed: 0,
          remaining: 0,
          unit: unit
        };
      }

      balances[matchKey].total_dispatched += (parseFloat(curr.quantity_dispatched) || 0);
    });

    // 4. Apply consumption
    Object.keys(balances).forEach(key => {
      const consumption = (globalConsumed as any)[key] || 0;
      balances[key].total_consumed = consumption;
      balances[key].remaining = balances[key].total_dispatched - consumption;
    });

    return balances;
  } catch (error) {
    console.error('Error fetching quarry balances:', error);
    return {};
  }
}

/**
 * Validates if requested quantity is available in stock.
 * returns { allowed: boolean, remaining: number, message?: string }
 */
export async function validateQuarryStock(itemKey: keyof typeof ITEM_KEYWORDS | string, requestedQty: number) {
  const balances = await fetchQuarryBalances();
  
  // Find match
  let balance = balances[itemKey.toLowerCase()];
  
  // If no direct key match, try to find by keyword (for cases where we pass 'Diesel' but the key is 'diesel')
  if (!balance) {
      if (ITEM_KEYWORDS.diesel(itemKey)) balance = balances['diesel'];
      else if (ITEM_KEYWORDS.pg(itemKey)) balance = balances['pg'];
      else if (ITEM_KEYWORDS.ed(itemKey)) balance = balances['ed'];
      else if (ITEM_KEYWORDS.edet(itemKey)) balance = balances['edet'];
      else if (ITEM_KEYWORDS.nonel_3m(itemKey)) balance = balances['nonel_3m'];
      else if (ITEM_KEYWORDS.nonel_4m(itemKey)) balance = balances['nonel_4m'];
  }

  if (!balance) {
    return { allowed: false, remaining: 0, message: `Product '${itemKey}' not found in Quarry Store dispatch records.` };
  }

  if (balance.remaining < requestedQty) {
    return { 
      allowed: false, 
      remaining: balance.remaining, 
      message: `Insufficient stock for ${balance.item_name}. Available: ${balance.remaining.toFixed(1)} ${balance.unit}, Requested: ${requestedQty} ${balance.unit}` 
    };
  }

  return { allowed: true, remaining: balance.remaining };
}
