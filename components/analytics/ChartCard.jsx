'use client';

export default function ChartCard({ title, description, children, height = 320 }) {
  return (
    <>
      <style jsx>{`
        .chart-card {
          background: #fff;
          border: 1px solid #ececf2;
          border-radius: 14px;
          padding: 16px 18px;
          display: grid;
          gap: 12px;
          box-shadow: 0 3px 12px rgba(14, 30, 84, 0.06);
        }
        .chart-card__header {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .chart-card__title {
          font-size: 16px;
        }
        .chart-card__desc {
          font-size: 13px;
          color: #777;
        }
        @media (max-width: 480px) {
          .chart-card {
            padding: 12px 14px;
            gap: 8px;
          }
          .chart-card__header {
            gap: 2px;
          }
          .chart-card__title {
            font-size: 15px;
          }
          .chart-card__desc {
            font-size: 12px;
          }
        }
      `}</style>
      <section className="chart-card">
        <header className="chart-card__header">
          <strong className="chart-card__title">{title}</strong>
          {description ? <span className="chart-card__desc">{description}</span> : null}
        </header>
        <div style={{ height, position: 'relative' }}>
          {children}
        </div>
      </section>
    </>
  );
}
