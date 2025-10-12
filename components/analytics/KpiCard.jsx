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
          background: #fff;
          border: 1px solid #ececf2;
          border-radius: 12px;
          padding: 14px 16px;
          display: grid;
          gap: 6px;
          box-shadow: 0 2px 8px rgba(14, 30, 84, 0.05);
        }
        .kpi-card__title {
          font-size: 13px;
          color: #666;
          font-weight: 600;
        }
        .kpi-card__value {
          font-size: 26px;
          font-weight: 700;
        }
        .kpi-card__subtitle {
          font-size: 12px;
          color: #888;
        }
        .kpi-card__delta {
          font-size: 12px;
        }
        .kpi-card__delta--up {
          color: #177245;
        }
        .kpi-card__delta--down {
          color: #b00020;
        }
        @media (max-width: 540px) {
          .kpi-card {
            flex: 1 1 calc(50% - 8px);
            min-width: 110px;
            padding: 10px 12px;
            gap: 4px;
          }
          .kpi-card__title {
            font-size: 12px;
          }
          .kpi-card__value {
            font-size: 22px;
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
