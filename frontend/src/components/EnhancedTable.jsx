import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Virtuoso } from 'react-virtuoso';

export function EnhancedTable({ 
  rows, 
  data, 
  tableState, 
  levelFilter, 
  query, 
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

  // Keyboard navigation state
  const [focusedRowIndex, setFocusedRowIndex] = useState(-1);
  const tableRef = useRef(null);
  const rowRefs = useRef({});

  const getSortIcon = (column) => {
    if (sortColumn !== column) return '↕';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const handleHeaderClick = (column) => {
    handleSort(column);
  };

  // Keyboard navigation handlers
  const handleKeyDown = useCallback((e) => {
    if (rows.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedRowIndex(prev => {
          const next = Math.min(prev + 1, rows.length - 1);
          // Scroll focused row into view
          const nextKey = `${rows[next].merchant}|||${rows[next].product}`;
          setTimeout(() => rowRefs.current[nextKey]?.scrollIntoView({ block: 'nearest' }), 0);
          return next;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedRowIndex(prev => {
          const next = Math.max(prev - 1, 0);
          const nextKey = `${rows[next].merchant}|||${rows[next].product}`;
          setTimeout(() => rowRefs.current[nextKey]?.scrollIntoView({ block: 'nearest' }), 0);
          return next;
        });
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedRowIndex >= 0 && focusedRowIndex < rows.length) {
          const row = rows[focusedRowIndex];
          const rowKey = `${row.merchant}|||${row.product}`;
          toggleRowSelection(rowKey);
        }
        break;
      default:
        break;
    }
  }, [rows, focusedRowIndex, toggleRowSelection]);

  // Reset focus when page or data changes
  useEffect(() => {
    setFocusedRowIndex(-1);
  }, [page, rows.length]);

  const headerStyle = (column) => ({
    padding: '10px 8px',
    cursor: 'pointer',
    userSelect: 'none',
    borderBottom: '1px solid rgba(148,163,184,0.2)',
    position: 'sticky',
    top: 0,
    background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
    zIndex: 10,
    whiteSpace: 'nowrap'
  });

  const renderRow = (index) => {
    const row = rows[index];
    const rowKey = `${row.merchant}|||${row.product}`;
    const isChanged = changedKeys.has(rowKey);
    const isSelected = selectedRows.has(rowKey);
    const isFocused = focusedRowIndex === index;

    return (
      <div 
        key={rowKey}
        ref={el => rowRefs.current[rowKey] = el}
        className={`table-row ${isChanged ? 'changed' : ''} ${isSelected ? 'selected' : ''}`}
<<<<<<< HEAD
        tabIndex={0}
        role="row"
        aria-selected={isSelected}
        onClick={() => setFocusedRowIndex(index)}
=======
        tabIndex="0"
        role="row"
        aria-selected={isSelected}
        data-row-index={index}
>>>>>>> clawteam/yd-critical-fix/sanji
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
<<<<<<< HEAD
          background: isFocused 
            ? 'rgba(59, 130, 246, 0.2)' 
            : isChanged 
              ? 'rgba(59, 130, 246, 0.1)' 
              : 'transparent',
          transition: 'background 0.15s ease',
          outline: isFocused ? '2px solid #3b82f6' : 'none',
          outlineOffset: '-2px',
          cursor: 'pointer'
=======
          background: isChanged ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
          transition: 'background 0.3s ease',
          cursor: 'pointer'
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleRowSelection(rowKey);
          }
>>>>>>> clawteam/yd-critical-fix/sanji
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
              <span className={`lvl ${levelClass(row.ordersInWindow)}`}>
                <LevelIcon n={row.ordersInWindow} />
              </span>
              <span className={`level-chip ${levelClass(row.ordersInWindow)}`}>
                {levelLabel(row.ordersInWindow)}
              </span>
            </div>
          </div>
        )}
        
        {visibleColumns.merchant && (
          <div style={{ padding: '0 8px', fontWeight: 700 }}>
            {row.merchant}
          </div>
        )}
        
        {visibleColumns.product && (
          <div style={{ padding: '0 8px' }}>
            {row.product}
          </div>
        )}
        
        {visibleColumns.ordersInWindow && (
          <div style={{ padding: '0 8px' }}>
            <span className={`rate ${levelClass(row.ordersInWindow)}`}>
              {row.ordersInWindow}
            </span>
          </div>
        )}
        
        {visibleColumns.merchantOrders && (
          <div style={{ padding: '0 8px', color: '#94a3b8' }}>
            {row.merchantOrders}
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
        
        <div style={{ display: 'flex', gap: 8, alignItems: center, flexWrap: 'wrap' }}>
          {/* Bulk Actions */}
          {selectedRows.size > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#94a3b8', fontSize: 13 }}>
                {selectedRows.size} selected
              </span>
              <select 
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(148,163,184,0.2)', background: '#1e293b', color: '#fff' }}
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value === 'export') {
                    // Export selected
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
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(148,163,184,0.2)', background: '#1e293b', color: '#fff' }}
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
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(148,163,184,0.2)', background: '#1e293b', color: '#fff' }}
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
        background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
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
              aria-label="Select all rows"
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
      <div 
        ref={tableRef}
        style={{ 
          border: '1px solid rgba(148,163,184,0.08)',
          borderRadius: '0 0 8px 8px',
          overflow: 'hidden',
          outline: 'none'
        }}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {rows.length > 0 ? (
          <Virtuoso
            style={{ height: Math.min(rows.length * 50, 600) }}
            totalCount={rows.length}
            itemContent={(index) => renderRow(index)}
          />
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
            No products match your filters
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
          <span style={{ color: '#94a3b8', fontSize: 13 }}>
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
                background: page === 0 ? '#334155' : '#1e293b',
                color: page === 0 ? '#64748b' : '#fff',
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
                background: page === 0 ? '#334155' : '#1e293b',
                color: page === 0 ? '#64748b' : '#fff',
                cursor: page === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              Prev
            </button>
            <span style={{ 
              padding: '6px 12px', 
              color: '#94a3b8',
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
                background: page >= totalPages - 1 ? '#334155' : '#1e293b',
                color: page >= totalPages - 1 ? '#64748b' : '#fff',
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
                background: page >= totalPages - 1 ? '#334155' : '#1e293b',
                color: page >= totalPages - 1 ? '#64748b' : '#fff',
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
