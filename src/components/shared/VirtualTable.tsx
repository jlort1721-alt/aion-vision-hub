import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

interface VirtualTableProps<T> {
  data: T[];
  rowHeight: number;
  renderRow: (item: T, index: number) => React.ReactNode;
  className?: string;
  maxHeight?: number;
}

export function VirtualTable<T>({ data, rowHeight, renderRow, className = '', maxHeight = 600 }: VirtualTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  if (data.length < 100) {
    // Don't virtualize small lists — render normally
    return <div className={className}>{data.map((item, i) => renderRow(item, i))}</div>;
  }

  return (
    <div ref={parentRef} className={`overflow-auto ${className}`} style={{ maxHeight }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {renderRow(data[virtualRow.index], virtualRow.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
