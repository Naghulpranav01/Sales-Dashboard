import { toDate, toNumber } from "../utils.js";

const columnGroups = {
  revenue: [/revenue/i, /sales/i, /amount/i, /total/i, /net_sales/i],
  profit: [/profit/i, /gross_margin/i],
  cost: [/cost/i, /expense/i, /cogs/i],
  quantity: [/quantity/i, /\bqty\b/i, /units/i],
  stock: [/stock/i, /inventory/i, /on_hand/i, /available_qty/i],
  price: [/price/i, /unit_price/i],
  region: [/region/i, /country/i, /state/i, /market/i, /territory/i],
  category: [/category/i, /segment/i, /product_type/i, /availability/i],
  customer: [/customer/i, /client/i, /account/i, /product/i, /^name$/i, /brand/i],
  date: [/date/i, /order_date/i, /month/i, /created/i]
};

function findColumn(columns, group) {
  return columns.find((column) => columnGroups[group].some((pattern) => pattern.test(column)));
}

function sum(rows, accessor) {
  return rows.reduce((total, row) => total + (toNumber(accessor(row)) || 0), 0);
}

function groupBy(rows, accessor) {
  return rows.reduce((groups, row) => {
    const key = accessor(row) || "Unknown";
    groups.set(key, [...(groups.get(key) || []), row]);
    return groups;
  }, new Map());
}

function round(value, digits = 2) {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(digits));
}

function getRevenueAccessor(columns) {
  const revenueCol = findColumn(columns, "revenue");
  const quantityCol = findColumn(columns, "quantity");
  const stockCol = findColumn(columns, "stock");
  const priceCol = findColumn(columns, "price");
  return (row) => {
    if (revenueCol) return toNumber(row[revenueCol]) || 0;
    if (quantityCol && priceCol) return (toNumber(row[quantityCol]) || 0) * (toNumber(row[priceCol]) || 0);
    if (stockCol && priceCol) return (toNumber(row[stockCol]) || 0) * (toNumber(row[priceCol]) || 0);
    if (priceCol) return toNumber(row[priceCol]) || 0;
    return 0;
  };
}

function getProfitAccessor(columns, revenueAccessor) {
  const profitCol = findColumn(columns, "profit");
  const costCol = findColumn(columns, "cost");
  return (row) => {
    if (profitCol) return toNumber(row[profitCol]) || 0;
    if (costCol) return revenueAccessor(row) - (toNumber(row[costCol]) || 0);
    return revenueAccessor(row) * 0.18;
  };
}

function monthKey(value) {
  const date = toDate(value);
  if (!date) return "Unknown";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function growth(current, previous) {
  if (!previous) return 0;
  return round(((current - previous) / Math.abs(previous)) * 100, 1);
}

function forecastFromTrend(monthlyTrend) {
  const known = monthlyTrend.filter((point) => point.month !== "Unknown");
  const tail = known.slice(-6);
  if (!tail.length) return [];

  const average = tail.reduce((total, point) => total + point.revenue, 0) / tail.length;
  const slope =
    tail.length > 1
      ? (tail[tail.length - 1].revenue - tail[0].revenue) / Math.max(1, tail.length - 1)
      : average * 0.03;
  const lastDate = new Date(`${tail[tail.length - 1].month}-01T00:00:00Z`);

  return Array.from({ length: 3 }, (_, index) => {
    const date = new Date(lastDate);
    date.setUTCMonth(date.getUTCMonth() + index + 1);
    return {
      month: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
      forecastRevenue: round(Math.max(0, average + slope * (index + 1)))
    };
  });
}

export function buildAnalytics(dataset) {
  const rows = dataset.rows || [];
  const columns = dataset.currentColumns?.map((column) => column.name) || Object.keys(rows[0] || {});
  const revenueAccessor = getRevenueAccessor(columns);
  const profitAccessor = getProfitAccessor(columns, revenueAccessor);
  const regionCol = findColumn(columns, "region") || findColumn(columns, "category");
  const categoryCol = findColumn(columns, "category") || findColumn(columns, "customer");
  const customerCol = findColumn(columns, "customer");
  const dateCol = findColumn(columns, "date");
  const hasSalesRevenue = Boolean(findColumn(columns, "revenue"));
  const hasInventoryValue = Boolean(findColumn(columns, "stock") && findColumn(columns, "price") && !hasSalesRevenue);

  const totalRevenue = sum(rows, revenueAccessor);
  const totalProfit = sum(rows, profitAccessor);
  const orderCount = rows.length;
  const averageOrderValue = orderCount ? totalRevenue / orderCount : 0;

  const monthlyGroups = groupBy(rows, (row) => (dateCol ? monthKey(row[dateCol]) : "Unknown"));
  const monthlyTrend = [...monthlyGroups.entries()]
    .map(([month, monthRows]) => ({
      month,
      revenue: round(sum(monthRows, revenueAccessor)),
      profit: round(sum(monthRows, profitAccessor))
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const lastMonth = monthlyTrend[monthlyTrend.length - 1]?.revenue || 0;
  const prevMonth = monthlyTrend[monthlyTrend.length - 2]?.revenue || 0;
  const lastYearMonth = monthlyTrend[monthlyTrend.length - 13]?.revenue || 0;

  const byRegion = [...groupBy(rows, (row) => (regionCol ? row[regionCol] : "Unknown")).entries()]
    .map(([region, groupRows]) => ({
      region,
      revenue: round(sum(groupRows, revenueAccessor)),
      contribution: round((sum(groupRows, revenueAccessor) / Math.max(totalRevenue, 1)) * 100, 1)
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 12);

  const byCategory = [...groupBy(rows, (row) => (categoryCol ? row[categoryCol] : "Unknown")).entries()]
    .map(([category, groupRows]) => ({
      category,
      revenue: round(sum(groupRows, revenueAccessor)),
      profit: round(sum(groupRows, profitAccessor))
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 12);

  const customerSegments = [...groupBy(rows, (row) => (customerCol ? row[customerCol] : "Unknown")).entries()]
    .map(([customer, groupRows]) => ({
      customer,
      orders: groupRows.length,
      revenue: round(sum(groupRows, revenueAccessor))
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const losses = rows
    .map((row, index) => ({ index: index + 1, revenue: revenueAccessor(row), profit: profitAccessor(row), row }))
    .filter((item) => item.profit < 0)
    .slice(0, 10);

  const insights = [
    hasInventoryValue
      ? "This looks like a product catalog, so value is calculated from price multiplied by stock."
      : null,
    byRegion[0]
      ? `${byRegion[0].region} has the largest contribution at ${byRegion[0].contribution}%.`
      : null,
    byCategory[0] ? `${byCategory[0].category} is the top group by value.` : null,
    losses.length ? `${losses.length} loss-making rows need review.` : "No loss-making rows were found in the sample.",
    growth(lastMonth, prevMonth) ? `Month-over-month revenue changed by ${growth(lastMonth, prevMonth)}%.` : null
  ].filter(Boolean);

  return {
    dataset: {
      id: dataset.id,
      displayName: dataset.displayName,
      rowCount: dataset.rowCount || rows.length,
      currentColumns: dataset.currentColumns || [],
      removedColumns: dataset.removedColumns || []
    },
    dimensions: {
      valueLabel: hasInventoryValue ? "Inventory value" : hasSalesRevenue ? "Revenue" : "Estimated value",
      regionLabel: findColumn(columns, "region") ? "Region" : regionCol === findColumn(columns, "category") ? "Category" : "Group",
      categoryLabel: findColumn(columns, "category") ? "Category" : "Group",
      customerLabel: findColumn(columns, "customer") ? "Customer" : customerCol === "brand" ? "Brand" : "Product"
    },
    kpis: {
      totalRevenue: round(totalRevenue),
      totalProfit: round(totalProfit),
      profitMargin: round((totalProfit / Math.max(totalRevenue, 1)) * 100, 1),
      averageOrderValue: round(averageOrderValue),
      orderCount,
      momGrowth: growth(lastMonth, prevMonth),
      yoyGrowth: growth(lastMonth, lastYearMonth)
    },
    byRegion,
    byCategory,
    customerSegments,
    monthlyTrend,
    losses,
    forecast: forecastFromTrend(monthlyTrend),
    insights
  };
}
