'use client';

export default function KpiCard({ title, value, subtitle, delta }) {
  const deltaText = delta !== undefined && delta !== null
    ? (delta > 0 ? `▲ ${delta}` : `▼ ${Math.abs(delta)}`)
    : null;
  const deltaClass = delta > 0 ? 'kpi-card__delta--up' : 'kpi-card__delta--down';

  return (
    <>
      <style jsx>{`
        .kpi-card {
          flex: 1 1 180px;
          min-width: 160px;
          background: linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.8);
          border-radius: 16px;
          padding: 18px 20px;
          display: grid;
          gap: 8px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04), 0 1px 4px rgba(0, 0, 0, 0.02);
          transition: all 0.2s ease;
        }
        .kpi-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(139, 92, 246, 0.1), 0 2px 8px rgba(0, 0, 0, 0.04);
          border-color: rgba(139, 92, 246, 0.2);
        }
        .kpi-card__title {
          font-size: 13px;
          color: #64748b;
          font-weight: 600;
          letter-spacing: 0.2px;
        }
        .kpi-card__value {
          font-size: 28px;
          font-weight: 800;
          color: #1e293b;
          letter-spacing: -0.5px;
        }
        .kpi-card__subtitle {
          font-size: 12px;
          color: #94a3b8;
          font-weight: 500;
        }
        .kpi-card__delta {
          font-size: 12px;
          font-weight: 600;
        }
        .kpi-card__delta--up {
          color: #059669;
        }
        .kpi-card__delta--down {
          color: #dc2626;
        }
        @media (max-width: 540px) {
          .kpi-card {
            flex: 1 1 calc(50% - 8px);
            min-width: 110px;
            padding: 14px 16px;
            gap: 6px;
            border-radius: 14px;
          }
          .kpi-card__title {
            font-size: 12px;
          }
          .kpi-card__value {
            font-size: 24px;
          }
          .kpi-card__subtitle,
          .kpi-card__delta {
            font-size: 11px;
          }
        }
      `}</style>
      <div className="kpi-card">
        <span className="kpi-card__title">{title}</span>
        <span className="kpi-card__value">{value}</span>
        {subtitle ? <span className="kpi-card__subtitle">{subtitle}</span> : null}
        {deltaText ? <span className={`kpi-card__delta ${deltaClass}`}>{deltaText}</span> : null}
      </div>
    </>
  );
}
