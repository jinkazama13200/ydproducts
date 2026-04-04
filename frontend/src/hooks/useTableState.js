import { useState, useMemo, useCallback } from 'react';

export function useTableState(data, options = {}) {
  const {
    initialPageSize = 25,
    initialSortColumn = 'ordersInWindow',
    initialSortDirection = 'desc',
    pageSizeOptions = [25, 50, 100]
  } = options;

  // Pagination state
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // Sorting state
  const [sortColumn, setSortColumn] = useState(initialSortColumn);
  const [sortDirection, setSortDirection] = useState(initialSortDirection);

  // Selection state
  const [selectedRows, setSelectedRows] = useState(new Set());

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState({
    level: true,
    merchant: true,
    product: true,
    ordersInWindow: true,
    merchantOrders: true
  });

  // Reset page when data changes
  useMemo(() => {
    setPage(0);
  }, [data]);

  // Handle column sort
  const handleSort = useCallback((column) => {
    setSortColumn((prev) => {
      if (prev === column) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDirection('desc');
      return column;
    });
  }, []);

  // Handle row selection
  const toggleRowSelection = useCallback((rowKey) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) {
        next.delete(rowKey);
      } else {
        next.add(rowKey);
      }
      return next;
    });
  }, []);

  const selectAllRows = useCallback(() => {
    setSelectedRows(new Set(data.map((row) => row.key)));
  }, [data]);

  const clearSelection = useCallback(() => {
    setSelectedRows(new Set());
  }, []);

  // Toggle column visibility
  const toggleColumn = useCallback((column) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [column]: !prev[column]
    }));
  }, []);

  // Sort data
  const sortedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    const sorted = [...data].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      
      return sortDirection === 'asc' 
        ? Number(aVal) - Number(bVal)
        : Number(bVal) - Number(aVal);
    });
    
    return sorted;
  }, [data, sortColumn, sortDirection]);

  // Paginate data
  const paginatedData = useMemo(() => {
    const start = page * pageSize;
    const end = start + pageSize;
    return sortedData.slice(start, end);
  }, [sortedData, page, pageSize]);

  // Pagination info
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const startIndex = page * pageSize + 1;
  const endIndex = Math.min((page + 1) * pageSize, sortedData.length);

  return {
    // Data
    data: paginatedData,
    allData: sortedData,
    
    // Pagination
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    startIndex,
    endIndex,
    totalRows: sortedData.length,
    pageSizeOptions,
    
    // Sorting
    sortColumn,
    sortDirection,
    handleSort,
    
    // Selection
    selectedRows,
    toggleRowSelection,
    selectAllRows,
    clearSelection,
    isAllSelected: data.length > 0 && selectedRows.size === data.length,
    isSomeSelected: selectedRows.size > 0 && selectedRows.size < data.length,
    
    // Column visibility
    visibleColumns,
    toggleColumn
  };
}

export default useTableState;
