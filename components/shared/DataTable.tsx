'use client';

import { useEffect, useState, type ReactNode } from 'react';

interface Column {
  key: string;
  label: string;
  render?: (value: any, row: any) => ReactNode;
}

interface DataTableProps {
  columns: Column[];
  data: any[];
  pageSize?: number;
}

export default function DataTable({ columns, data, pageSize = 10 }: DataTableProps) {
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [data.length]);

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const current = Math.min(page, totalPages - 1);
  const rows = data.slice(current * pageSize, current * pageSize + pageSize);

  return (
    <div className="overflow-x-auto">
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  textAlign: 'left',
                  padding: '12px 16px',
                  fontSize: 11.5,
                  textTransform: 'uppercase',
                  color: 'var(--text-light)',
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  borderBottom: '1.5px solid var(--secondary)',
                  backgroundColor: 'var(--secondary-lighter)',
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="hover:[&>td]:bg-[var(--divider-soft)]">
              {columns.map((col) => (
                <td
                  key={col.key}
                  style={{
                    padding: '14px 16px',
                    fontSize: 14,
                    color: 'var(--text)',
                    borderBottom: '1px solid var(--divider)',
                  }}
                >
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {totalPages > 1 && (
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderTop: '1px solid var(--divider)', fontSize: 12.5, color: 'var(--text-light)' }}
        >
          <span>
            {data.length} {data.length === 1 ? 'row' : 'rows'} • Page {current + 1} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={current === 0}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1.5px solid var(--surface-border)',
                background: 'transparent',
                color: current === 0 ? 'var(--text-lighter)' : 'var(--primary)',
                cursor: current === 0 ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: 12,
              }}
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={current === totalPages - 1}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1.5px solid var(--surface-border)',
                background: 'transparent',
                color: current === totalPages - 1 ? 'var(--text-lighter)' : 'var(--primary)',
                cursor: current === totalPages - 1 ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: 12,
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
