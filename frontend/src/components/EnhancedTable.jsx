import React from 'react';
import { Virtuoso } from 'react-virtuoso';
import { levelLabel } from '../utils/levels';

export function EnhancedTable({
  rows,
  data,
  tableState,
  levelFilter,
  query,
  onClearFilters,
  hasData,
  videoIconsEnabled,
  sortBy,
  rateWindowMinutes,
  changedKeys,
  LevelIcon,
  levelClass,
  levelLabel 
}) {
  const {
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    startIndex,
    endIndex,
    totalRows,
    pageSizeOptions,
    sortColumn,
    sortDirection,
    handleSort,
    selectedRows,
    toggleRowSelection,
    selectAllRows,
    clearSelection,
    isAllSelected,
    isSomeSelected,
    visibleColumns,
    toggleColumn
  } = tableState;

  const getSortIcon = (column) => {
    if (sortColumn !== column) return '↕';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const handleHeaderClick = (column) => {
    handleSort(column);
  };

  const headerStyle = (column) => ({
    padding: '10px 8px',
    cursor: 'pointer',
    userSelect: 'none',
    borderBottom: '1px solid rgba(148,163,184,0.2)',
    position: 'sticky',
    top: 0,
    background: 'linear-gradient(180deg, #191a1b 0%, #0f1011 100%)',
    zIndex: 10,
    whiteSpace: 'nowrap'
  });

  const renderRow = (index) => {
    const row = rows[index];
    if (!row) return null;
    const rowKey = `${row.merchant || 'unknown'}|||${row.product || 'unknown'}`;
    const isChanged = changedKeys?.has(rowKey) || false;
    const isSelected = selectedRows?.has(rowKey) || false;

    return (
      <div 
        key={rowKey}
        className={`table-row ${isChanged ? 'changed' : ''} ${isSelected ? 'selected' : ''}`}
        style={{
          borderBottom: '1px solid rgba(148,163,184,0.08)',
          display: 'grid',
          gridTemplateColumns: visibleColumns.level ? '40px' : '0px' + ' ' +
                             visibleColumns.checkbox ? '40px' : '0px' + ' ' +
                             visibleColumns.merchant ? '1fr' : '0px' + ' ' +
                             visibleColumns.product ? '1.5fr' : '0px' + ' ' +
                             visibleColumns.ordersInWindow ? '120px' : '0px' + ' ' +
                             visibleColumns.merchantOrders ? '120px' : '0px',
          alignItems: 'center',
          padding: '10px 8px',
          background: isChanged ? 'rgba(113,112,255,0.08)' : 'transparent',
          transition: 'background 0.3s ease'
        }}
      >
        {visibleColumns.checkbox && (
          <div style={{ padding: '0 8px' }}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleRowSelection(rowKey)}
              style={{ cursor: 'pointer' }}
            />
          </div>
        )}
        
        {visibleColumns.level && (
          <div style={{ padding: '0 8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={`lvl ${levelClass(row.ordersInWindow || 0)}`}>
                <LevelIcon n={row.ordersInWindow || 0} videoEnabled={videoIconsEnabled} />
              </span>
              <span className={`level-chip ${levelClass(row.ordersInWindow || 0)}`}>
                {levelLabel(row.ordersInWindow || 0)}
              </span>
            </div>
          </div>
        )}
        
        {visibleColumns.merchant && (
          <div style={{ padding: '0 8px', fontWeight: 700 }}>
            {row.merchant || 'Unknown'}
          </div>
        )}
        
        {visibleColumns.product && (
          <div style={{ padding: '0 8px' }}>
            {row.product || 'Unknown'}
          </div>
        )}
        
        {visibleColumns.ordersInWindow && (
          <div style={{ padding: '0 8px' }}>
            <span className={`rate ${levelClass(row.ordersInWindow || 0)}`}>
              {row.ordersInWindow || 0}
            </span>
          </div>
        )}
        
        {visibleColumns.merchantOrders && (
          <div style={{ padding: '0 8px', color: '#8a8f98' }}>
            {row.merchantOrders || 0}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="card fade-in" style={{ marginBottom: 16 }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 12,
        flexWrap: 'wrap',
        gap: 10
      }}>
        <h3 style={{ margin: 0 }}>📋 Running products table</h3>
        
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Bulk Actions */}
          {selectedRows.size > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#8a8f98', fontSize: 13 }}>
                {selectedRows.size} selected
              </span>
              <select 
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(148,163,184,0.2)', background: '#191a1b', color: '#fff' }}
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value === 'export') {
                    // Export selected rows as CSV
                    if (data && data.length > 0) {
                      const csvRows = [['merchant', 'product', 'orders', 'level']];
                      data.filter(row => selectedRows?.has(`${row.merchant || 'unknown'}|||${row.product || 'unknown'}`)).forEach(row => {
                        csvRows.push([
                          row.merchant || 'Unknown',
                          row.product || 'Unknown',
                          String(row.ordersInWindow || 0),
                          levelLabel(row.ordersInWindow || 0)
                        ]);
                      });
                      const csv = csvRows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
                      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'yd-selected-products-' + new Date().toISOString().replace(/[:.]/g, '-') + '.csv';
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }
                  } else if (e.target.value === 'clear') {
                    clearSelection();
                  }
                }}
              >
                <option value="" disabled>Bulk Actions</option>
                <option value="export">Export Selected</option>
                <option value="clear">Clear Selection</option>
              </select>
            </div>
          )}
          
          {/* Column Visibility */}
          <select 
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(148,163,184,0.2)', background: '#191a1b', color: '#fff' }}
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                toggleColumn(e.target.value);
              }
            }}
          >
            <option value="" disabled>👁 Columns</option>
            <option value="level">Level {visibleColumns.level ? '✓' : ''}</option>
            <option value="merchant">Merchant {visibleColumns.merchant ? '✓' : ''}</option>
            <option value="product">Product {visibleColumns.product ? '✓' : ''}</option>
            <option value="ordersInWindow">Orders {visibleColumns.ordersInWindow ? '✓' : ''}</option>
            <option value="merchantOrders">Merchant Total {visibleColumns.merchantOrders ? '✓' : ''}</option>
          </select>
          
          {/* Page Size */}
          <select 
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(0);
            }}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(148,163,184,0.2)', background: '#191a1b', color: '#fff' }}
          >
            {pageSizeOptions.map(size => (
              <option key={size} value={size}>{size} rows</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Table Header */}
      <div style={{ 
        display: 'grid',
        gridTemplateColumns: visibleColumns.checkbox ? '40px' : '0px' + ' ' +
                           visibleColumns.level ? '40px' : '0px' + ' ' +
                           visibleColumns.merchant ? '1fr' : '0px' + ' ' +
                           visibleColumns.product ? '1.5fr' : '0px' + ' ' +
                           visibleColumns.ordersInWindow ? '120px' : '0px' + ' ' +
                           visibleColumns.merchantOrders ? '120px' : '0px',
        background: 'linear-gradient(180deg, #191a1b 0%, #0f1011 100%)',
        borderRadius: '8px 8px 0 0',
        marginBottom: 8
      }}>
        {visibleColumns.checkbox && (
          <div style={{ padding: '10px 8px' }}>
            <input
              type="checkbox"
              checked={isAllSelected}
              ref={(el) => {
                if (el) el.indeterminate = isSomeSelected;
              }}
              onChange={(e) => {
                if (e.target.checked) {
                  selectAllRows();
                } else {
                  clearSelection();
                }
              }}
              style={{ cursor: 'pointer' }}
            />
          </div>
        )}
        
        {visibleColumns.level && (
          <div style={headerStyle('level')} onClick={() => handleHeaderClick('level')}>
            Level {getSortIcon('level')}
          </div>
        )}
        
        {visibleColumns.merchant && (
          <div style={headerStyle('merchant')} onClick={() => handleHeaderClick('merchant')}>
            Merchant {getSortIcon('merchant')}
          </div>
        )}
        
        {visibleColumns.product && (
          <div style={headerStyle('product')} onClick={() => handleHeaderClick('product')}>
            Product {getSortIcon('product')}
          </div>
        )}
        
        {visibleColumns.ordersInWindow && (
          <div style={headerStyle('ordersInWindow')} onClick={() => handleHeaderClick('ordersInWindow')}>
            Orders / {rateWindowMinutes}m {getSortIcon('ordersInWindow')}
          </div>
        )}
        
        {visibleColumns.merchantOrders && (
          <div style={headerStyle('merchantOrders')} onClick={() => handleHeaderClick('merchantOrders')}>
            Merchant Total {getSortIcon('merchantOrders')}
          </div>
        )}
      </div>
      
      {/* Virtual Scrolling Table Body */}
      <div style={{ 
        border: '1px solid rgba(148,163,184,0.08)',
        borderRadius: '0 0 8px 8px',
        overflow: 'hidden'
      }}>
        {rows.length > 0 ? (
          <Virtuoso
            style={{ height: Math.min(rows.length * 50, 600) }}
            totalCount={rows.length}
            itemContent={(index) => renderRow(index)}
          />
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: '#62666d' }}>
            {!hasData ? (
              <>
                <div style={{ fontSize: 24, marginBottom: 12 }}>⏳</div>
                <div style={{ fontWeight: 600, color: '#8a8f98', marginBottom: 8 }}>Waiting for data...</div>
                <div style={{ fontSize: 13 }}>Connecting to WebSocket server</div>
              </>
            ) : (query || levelFilter !== 'all') ? (
              <>
                <div style={{ fontSize: 24, marginBottom: 12 }}>🔍</div>
                <div style={{ fontWeight: 600, color: '#8a8f98', marginBottom: 8 }}>No products match your filters</div>
                <button onClick={onClearFilters} style={{ marginTop: 8, padding: '8px 16px', minWidth: 'auto', fontSize: 13, background: 'linear-gradient(135deg, #5e6ad2, #5e6ad2)' }}>
                  Clear Filters
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 24, marginBottom: 12 }}>📭</div>
                <div style={{ fontWeight: 600, color: '#8a8f98', marginBottom: 8 }}>No running products</div>
                <div style={{ fontSize: 13 }}>All products are currently idle</div>
              </>
            )}
          </div>
        )}
      </div>
      
      {/* Pagination */}
      {totalRows > 0 && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginTop: 12,
          padding: '10px 0',
          borderTop: '1px solid rgba(148,163,184,0.08)'
        }}>
          <span style={{ color: '#8a8f98', fontSize: 13 }}>
            Showing {startIndex}-{endIndex} of {totalRows} rows
          </span>
          
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => setPage(0)}
              disabled={page === 0}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid rgba(148,163,184,0.2)',
                background: page === 0 ? '#28282c' : '#191a1b',
                color: page === 0 ? '#62666d' : '#fff',
                cursor: page === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              First
            </button>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid rgba(148,163,184,0.2)',
                background: page === 0 ? '#28282c' : '#191a1b',
                color: page === 0 ? '#62666d' : '#fff',
                cursor: page === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              Prev
            </button>
            <span style={{ 
              padding: '6px 12px', 
              color: '#8a8f98',
              fontSize: 13
            }}>
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid rgba(148,163,184,0.2)',
                background: page >= totalPages - 1 ? '#28282c' : '#191a1b',
                color: page >= totalPages - 1 ? '#62666d' : '#fff',
                cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer'
              }}
            >
              Next
            </button>
            <button
              onClick={() => setPage(totalPages - 1)}
              disabled={page >= totalPages - 1}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid rgba(148,163,184,0.2)',
                background: page >= totalPages - 1 ? '#28282c' : '#191a1b',
                color: page >= totalPages - 1 ? '#62666d' : '#fff',
                cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer'
              }}
            >
              Last
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default EnhancedTable;
