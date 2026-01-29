'use client';

export default function CategoryTabs({ categories, active, onSelect, disabledKeys = new Set() }) {
  const enabled = [];
  const disabled = [];
  categories.forEach(cat => {
    if (disabledKeys.has(cat.key)) disabled.push(cat);
    else enabled.push(cat);
  });
  const ordered = [...enabled, ...disabled];

  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
      {ordered.map(cat => {
        const isActive = cat.key === active;
        const isDisabled = disabledKeys.has(cat.key);
        return (
          <button
            key={cat.key}
            type="button"
            onClick={() => { if (!isDisabled) onSelect(cat.key); }}
            style={{
              flexShrink: 0,
              padding: '10px 16px',
              borderRadius: 999,
              border: isActive ? '2px solid #8b5cf6' : '1px solid rgba(0, 0, 0, 0.08)',
              background: isActive
                ? 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)'
                : isDisabled
                  ? 'rgba(248, 250, 252, 0.8)'
                  : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
              color: isActive ? '#7c3aed' : isDisabled ? '#94a3b8' : '#475569',
              fontWeight: 600,
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              opacity: isDisabled ? 0.5 : 1,
              boxShadow: isActive
                ? '0 2px 8px rgba(139, 92, 246, 0.2)'
                : '0 1px 4px rgba(0, 0, 0, 0.04)',
              transition: 'all .15s ease',
            }}
            disabled={isDisabled}
            aria-disabled={isDisabled}
          >
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}
