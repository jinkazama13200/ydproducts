import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * Export dashboard data to PDF with charts and tables
 */
export function exportToPDF({ 
  merchants, 
  kpis, 
  timestamp, 
  includeCharts = false 
}) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // Title
  doc.setFontSize(18);
  doc.setTextColor(248, 253, 255);
  doc.text('⚡ YD Products Dashboard Report', 14, 20);

  // Timestamp
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  const dateStr = new Date(timestamp || Date.now()).toLocaleString('vi-VN');
  doc.text(`Generated: ${dateStr}`, 14, 28);

  // KPI Summary Section
  doc.setFontSize(12);
  doc.setTextColor(248, 253, 255);
  doc.text('📊 Key Metrics', 14, 40);

  // KPI Table
  const kpiData = [
    ['Total Orders (5m)', kpis.totalOrders?.toString() || '0'],
    ['Active Merchants', kpis.activeMerchants?.toString() || '0'],
    ['Active Products', kpis.activeProducts?.toString() || '0'],
    ['Hot Products', kpis.hotCount?.toString() || '0'],
    ['Warm Products', kpis.warmCount?.toString() || '0']
  ];

  doc.autoTable({
    startY: 45,
    head: [['Metric', 'Value']],
    body: kpiData,
    theme: 'striped',
    headStyles: {
      fillColor: [6, 182, 212],
      textColor: [255, 255, 255],
      fontSize: 10
    },
    bodyStyles: {
      textColor: [226, 232, 240],
      fontSize: 9
    },
    alternateRowStyles: {
      fillColor: [30, 41, 59]
    },
    margin: { left: 14, right: 14 }
  });

  // Merchant Table Section
  let finalY = doc.lastAutoTable.finalY + 10;
  
  // Check if we need a new page
  if (finalY > 100) {
    doc.addPage();
    finalY = 20;
  }

  doc.setFontSize(12);
  doc.setTextColor(248, 253, 255);
  doc.text('🏢 Merchant Activity', 14, finalY);

  // Prepare merchant data for table
  const merchantTableData = merchants.slice(0, 50).map(m => [
    m.merchant,
    m.products?.length || 0,
    m.totalOrders || 0,
    m.hotProducts || 0,
    m.warmProducts || 0
  ]);

  doc.autoTable({
    startY: finalY + 5,
    head: [['Merchant', 'Products', 'Orders', 'Hot', 'Warm']],
    body: merchantTableData,
    theme: 'striped',
    headStyles: {
      fillColor: [6, 182, 212],
      textColor: [255, 255, 255],
      fontSize: 9
    },
    bodyStyles: {
      textColor: [226, 232, 240],
      fontSize: 8
    },
    alternateRowStyles: {
      fillColor: [30, 41, 59]
    },
    margin: { left: 14, right: 14 },
    pageBreak: 'auto'
  });

  // Add summary footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${i} of ${pageCount} • YD Products Dashboard`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // Save PDF
  const filename = `yd-dashboard-${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`;
  doc.save(filename);

  return { success: true, filename, pages: pageCount };
}

/**
 * Export selected merchants to PDF
 */
export function exportSelectedToPDF({ merchants, selectedKeys, timestamp }) {
  const selectedMerchants = merchants.filter(m => 
    selectedKeys.has(`${m.merchant}|||${m.product}`)
  );

  if (selectedMerchants.length === 0) {
    return { success: false, error: 'No items selected' };
  }

  return exportToPDF({
    merchants: selectedMerchants,
    kpis: {
      totalOrders: selectedMerchants.reduce((s, m) => s + (m.totalOrders || 0), 0),
      activeMerchants: new Set(selectedMerchants.map(m => m.merchant)).size,
      activeProducts: selectedMerchants.length,
      hotCount: selectedMerchants.filter(m => m.level === 'hot').length,
      warmCount: selectedMerchants.filter(m => m.level === 'warm').length
    },
    timestamp,
    includeCharts: false
  });
}

/**
 * Export single merchant detailed report
 */
export function exportMerchantReport({ merchant, products, timestamp }) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Title
  doc.setFontSize(16);
  doc.setTextColor(248, 253, 255);
  doc.text(`📊 Merchant Report: ${merchant}`, 14, 20);

  // Timestamp
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  const dateStr = new Date(timestamp || Date.now()).toLocaleString('vi-VN');
  doc.text(`Generated: ${dateStr}`, 14, 28);

  // Summary Stats
  const totalOrders = products.reduce((s, p) => s + Number(p.ordersInWindow || 0), 0);
  const hotCount = products.filter(p => Number(p.ordersInWindow) >= 10).length;
  const warmCount = products.filter(p => Number(p.ordersInWindow) >= 3 && Number(p.ordersInWindow) < 10).length;

  // Stats boxes
  const stats = [
    { label: 'Total Orders', value: totalOrders },
    { label: 'Products', value: products.length },
    { label: 'Hot', value: hotCount },
    { label: 'Warm', value: warmCount }
  ];

  let currentX = 14;
  const currentY = 40;
  const boxWidth = 45;
  const boxHeight = 20;

  stats.forEach((stat, index) => {
    if (index > 0 && index % 4 === 0) {
      currentX = 14;
      currentY += 25;
    }

    // Box background
    doc.setFillColor(30, 41, 59);
    doc.rect(currentX + (index % 4) * (boxWidth + 5), currentY, boxWidth, boxHeight, 'F');

    // Label
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(stat.label, currentX + (index % 4) * (boxWidth + 5) + 3, currentY + 6);

    // Value
    doc.setFontSize(14);
    doc.setTextColor(248, 253, 255);
    doc.text(stat.value.toString(), currentX + (index % 4) * (boxWidth + 5) + 3, currentY + 14);
  });

  // Products Table
  const finalY = currentY + 35;
  doc.setFontSize(11);
  doc.setTextColor(248, 253, 255);
  doc.text('📦 Products', 14, finalY);

  const productTableData = products.map(p => [
    p.product,
    Number(p.ordersInWindow || 0).toString(),
    getLevelLabel(Number(p.ordersInWindow))
  ]);

  doc.autoTable({
    startY: finalY + 5,
    head: [['Product', 'Orders (5m)', 'Level']],
    body: productTableData,
    theme: 'striped',
    headStyles: {
      fillColor: [6, 182, 212],
      textColor: [255, 255, 255],
      fontSize: 9
    },
    bodyStyles: {
      textColor: [226, 232, 240],
      fontSize: 8
    },
    alternateRowStyles: {
      fillColor: [30, 41, 59]
    },
    margin: { left: 14, right: 14 }
  });

  // Save
  const filename = `merchant-${merchant.replace(/[^a-z0-9]/gi, '-')}-${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`;
  doc.save(filename);

  return { success: true, filename, pages: doc.internal.getNumberOfPages() };
}

function getLevelLabel(orders) {
  if (orders >= 10) return 'Hot';
  if (orders >= 3) return 'Warm';
  return 'Idle';
}

export default {
  exportToPDF,
  exportSelectedToPDF,
  exportMerchantReport
};
