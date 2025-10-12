'use client';

import { useEffect, useMemo, useState } from 'react';
import { useBaby } from '@/components/BabyContext';
import CategoryTabs from '@/components/analytics/CategoryTabs';
import KpiCard from '@/components/analytics/KpiCard';
import EmptyState from '@/components/analytics/EmptyState';
import { CATEGORY_COMPONENTS } from '@/components/analytics/Categories';
import { useAnalyticsData } from '@/lib/hooks/useAnalyticsData';

const RANGE_PRESETS = [
  { key: '7d', label: 'Last 7 days', labelShort: '7', days: 7 },
  { key: '14d', label: 'Last 14 days', labelShort: '14', days: 14 },
  { key: '30d', label: 'Last 30 days', labelShort: '30', days: 30 },
  { key: 'custom', label: 'Custom range', labelShort: 'Custom', days: null },
];

const CATEGORIES = [
  { key: 'diapering', label: 'Diapering' },
  { key: 'feeding', label: 'Feeding' },
  { key: 'sleep', label: 'Sleep' },
  { key: 'mood', label: 'Mood' },
  { key: 'health', label: 'Health' },
  { key: 'pregnancy', label: 'Pregnancy' },
  { key: 'play', label: 'Play' },
  { key: 'milestones', label: 'Milestones' },
  { key: 'notes', label: 'Notes' },
];

export default function AnalyticsPage() {
  const { user, babies, selectedBabyId } = useBaby();
  const [rangeKey, setRangeKey] = useState('7d');
  const [customRange, setCustomRange] = useState({ from: '', to: '' });
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].key);

  const selectedBaby = useMemo(() => babies.find(b => b.id === selectedBabyId) || null, [babies, selectedBabyId]);
  const range = useMemo(() => computeRange(rangeKey, customRange), [rangeKey, customRange]);

  const { analytics, loading, error } = useAnalyticsData({
    babyId: selectedBaby?.id || null,
    from: range?.from || null,
    to: range?.to || null,
  });

  const categoryAvailability = useMemo(() => computeCategoryAvailability(analytics), [analytics]);
  const disabledKeys = useMemo(() => new Set(CATEGORIES.filter(cat => !categoryAvailability[cat.key]).map(cat => cat.key)), [categoryAvailability]);
  const availableCount = useMemo(() => CATEGORIES.filter(cat => categoryAvailability[cat.key]).length, [categoryAvailability]);

  useEffect(() => {
    if (loading) return;
    if (categoryAvailability[activeCategory]) return;
    const next = CATEGORIES.find(cat => categoryAvailability[cat.key]);
    if (next) {
      setActiveCategory(next.key);
    }
  }, [loading, categoryAvailability, activeCategory]);

  const ActiveCategoryComponent = CATEGORY_COMPONENTS[activeCategory] || null;

  if (!user) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Analytics</h2>
        <p>Sign in to explore baby trends.</p>
      </div>
    );
  }

  if (!selectedBaby) {
    return (
      <div style={{ padding: 24, display: 'grid', gap: 12 }}>
        <h2>Analytics</h2>
        <EmptyState message="Select or create a baby first to unlock analytics." />
      </div>
    );
  }

  const rangeSummary = range ? `${formatDate(range.fromDisplay)} → ${formatDate(range.toDisplay)}` : 'Select dates';

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <header className="analytics-header" style={{ display: 'grid', gap: 12, background: '#fff', border: '1px solid #ececf2', borderRadius: 16, padding: '18px 20px' }}>
        <div className="analytics-header__top" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 28, fontFamily: 'Nunito, Inter, sans-serif' }}>Analytics</h2>
          <div className="range-presets" style={{ marginLeft: 'auto', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <span className="range-presets__label">Range:</span>
            {RANGE_PRESETS.map(option => (
              <button
                key={option.key}
                type="button"
                onClick={() => setRangeKey(option.key)}
                title={option.label}
                style={{
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: `1px solid ${rangeKey === option.key ? '#4f7cff' : '#dcdce3'}`,
                  background: rangeKey === option.key ? '#e6edff' : '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {option.labelShort}
              </button>
            ))}
          </div>
        </div>
        {rangeKey === 'custom' ? (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
              From
              <input
                type="date"
                value={customRange.from}
                onChange={e => setCustomRange(prev => ({ ...prev, from: e.target.value }))}
                style={dateInputStyle}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
              To
              <input
                type="date"
                value={customRange.to}
                onChange={e => setCustomRange(prev => ({ ...prev, to: e.target.value }))}
                style={dateInputStyle}
              />
            </label>
          </div>
        ) : null}
        <div className="range-summary" style={{ fontSize: 12, color: '#777' }}>{rangeSummary}</div>
      </header>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <div style={{ border: '1px solid #ffb4b4', background: '#ffecec', padding: '16px 18px', borderRadius: 12, color: '#9b1b1b' }}>
          Failed to load analytics. Please refresh and try again.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 20 }}>
          <section
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            }}
          >
            <KpiCard title="Events" value={analytics.totals.totalEvents} subtitle={`${analytics.totals.dayCount} day window`} />
            <KpiCard title="Active categories" value={availableCount} subtitle="With data in range" />
          </section>

          <CategoryTabs categories={CATEGORIES} active={activeCategory} onSelect={setActiveCategory} disabledKeys={disabledKeys} />

          {ActiveCategoryComponent && categoryAvailability[activeCategory] ? (
            <ActiveCategoryComponent data={analytics[activeCategory]} totals={analytics.totals} />
          ) : (
            <EmptyState message="No data available for this category." />)
          }
        </div>
      )}
      <style jsx>{`
        .range-presets {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .range-presets__label {
          font-size: 13px;
          color: #555;
          font-weight: 600;
        }
        .range-presets button {
          flex: 0 0 auto;
        }
        .range-summary {
          line-height: 1.3;
        }
        @media (max-width: 480px) {
          .analytics-header__top {
            gap: 8px;
            align-items: flex-start;
          }
          .range-presets__label {
            font-size: 12px;
            color: #777;
            flex: 0 0 auto;
          }
          .range-presets {
            margin-left: 0 !important;
            gap: 8px !important;
            flex-wrap: nowrap !important;
            overflow-x: auto;
            padding-bottom: 4px;
            margin-right: -12px;
            padding-right: 12px;
            scrollbar-width: none;
          }
          .range-presets::-webkit-scrollbar {
            display: none;
          }
          .range-summary {
            font-size: 11px !important;
            color: #8b8b9a !important;
          }
        }
      `}</style>
    </div>
  );
}

function computeRange(rangeKey, customRange) {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  if (rangeKey === 'custom') {
    if (!customRange.from || !customRange.to) return null;
    const fromDate = dateFromInput(customRange.from);
    const toDate = dateFromInput(customRange.to);
    if (!fromDate || !toDate || fromDate > toDate) return null;
    return {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      fromDisplay: fromDate,
      toDisplay: toDate,
    };
  }
  const preset = RANGE_PRESETS.find(opt => opt.key === rangeKey);
  const days = preset?.days ?? 7;
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);
  return {
    from: start.toISOString(),
    to: end.toISOString(),
    fromDisplay: start,
    toDisplay: end,
  };
}

function dateFromInput(input) {
  if (!input) return null;
  const [year, month, day] = input.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString();
}

function LoadingBlock() {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {Array.from({ length: 4 }).map((_, idx) => (
        <div key={idx} style={{ height: 140, borderRadius: 14, background: 'linear-gradient(90deg, #f4f4f7 0%, #fafafc 50%, #f4f4f7 100%)', animation: 'pulse 1.4s ease-in-out infinite' }} />
      ))}
      <style jsx>{`
        @keyframes pulse {
          0% { opacity: .6; }
          50% { opacity: 1; }
          100% { opacity: .6; }
        }
      `}</style>
    </div>
  );
}

const dateInputStyle = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #d0d0d9',
};

function computeCategoryAvailability(analytics = {}) {
  if (!analytics) return Object.fromEntries(CATEGORIES.map(cat => [cat.key, false]));
  return {
    diapering: Boolean(analytics.diapering?.total),
    feeding: Boolean((analytics.feeding?.totalFeeds || 0) > 0 || (analytics.feeding?.totalVolume || 0) > 0),
    sleep: Boolean((analytics.sleep?.sessions?.length || 0) > 0 || (analytics.sleep?.totalMinutes || 0) > 0),
    mood: Boolean((analytics.mood?.total || 0) > 0),
    health: Boolean(
      (analytics.health?.temperatureReadings?.length || 0) > 0 ||
      (analytics.health?.medicines?.length || 0) > 0 ||
      (analytics.health?.doctorVisits?.length || 0) > 0 ||
      (analytics.health?.pukePie?.length || 0) > 0 ||
      (analytics.health?.sickCount || 0) > 0
    ),
    pregnancy: Boolean(
      (analytics.pregnancy?.totalKicks || 0) > 0 ||
      (analytics.pregnancy?.contractions?.length || 0) > 0 ||
      (analytics.pregnancy?.heartbeatReadings?.length || 0) > 0
    ),
    play: Boolean((analytics.play?.totalSessions || 0) > 0 || (analytics.play?.totalMinutes || 0) > 0),
    milestones: Boolean((analytics.milestones?.length || 0) > 0),
    notes: Boolean((analytics.notes?.entries?.length || 0) > 0),
  };
}
