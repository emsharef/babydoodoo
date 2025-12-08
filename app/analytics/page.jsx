'use client';

import { useEffect, useMemo, useState } from 'react';
import { useBaby } from '@/components/BabyContext';
import { useLanguage } from '@/components/LanguageContext';
import CategoryTabs from '@/components/analytics/CategoryTabs';
import KpiCard from '@/components/analytics/KpiCard';
import EmptyState from '@/components/analytics/EmptyState';
import { CATEGORY_COMPONENTS } from '@/components/analytics/Categories';
import { useAnalyticsData } from '@/lib/hooks/useAnalyticsData';

const CATEGORY_KEYS = [
  'diapering', 'feeding', 'sleep', 'mood', 'health', 'pregnancy', 'play', 'milestones', 'notes'
];

export default function AnalyticsPage() {
  const { user, babies, selectedBabyId } = useBaby();
  const { t } = useLanguage();
  const [rangeKey, setRangeKey] = useState('7d');
  const [customRange, setCustomRange] = useState({ from: '', to: '' });
  const [activeCategory, setActiveCategory] = useState(CATEGORY_KEYS[0]);

  const RANGE_PRESETS = useMemo(() => [
    { key: '7d', label: t('analytics.last_7d'), labelShort: '7', days: 7 },
    { key: '14d', label: t('analytics.last_14d'), labelShort: '14', days: 14 },
    { key: '30d', label: t('analytics.last_30d'), labelShort: '30', days: 30 },
    { key: 'custom', label: t('analytics.custom'), labelShort: t('analytics.custom_short'), days: null },
  ], [t]);

  const CATEGORIES = useMemo(() => CATEGORY_KEYS.map(key => ({
    key,
    label: t(`analytics.cat_${key}`)
  })), [t]);

  const selectedBaby = useMemo(() => babies.find(b => b.id === selectedBabyId) || null, [babies, selectedBabyId]);
  const range = useMemo(() => computeRange(rangeKey, customRange, RANGE_PRESETS), [rangeKey, customRange, RANGE_PRESETS]);

  const { analytics, loading, error } = useAnalyticsData({
    babyId: selectedBaby?.id || null,
    from: range?.from || null,
    to: range?.to || null,
  });

  const [isNarrow, setIsNarrow] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 480 : false));
  const [customExpanded, setCustomExpanded] = useState(() => (typeof window !== 'undefined' ? window.innerWidth > 480 : true));
  useEffect(() => {
    function handleResize() {
      if (typeof window === 'undefined') return;
      setIsNarrow(window.innerWidth <= 480);
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  useEffect(() => {
    if (rangeKey === 'custom') {
      setCustomExpanded(!isNarrow);
    }
  }, [rangeKey, isNarrow]);

  const categoryAvailability = useMemo(() => computeCategoryAvailability(analytics), [analytics]);
  const disabledKeys = useMemo(() => new Set(CATEGORIES.filter(cat => !categoryAvailability[cat.key]).map(cat => cat.key)), [categoryAvailability, CATEGORIES]);
  const availableCount = useMemo(() => CATEGORIES.filter(cat => categoryAvailability[cat.key]).length, [categoryAvailability, CATEGORIES]);

  useEffect(() => {
    if (loading) return;
    if (categoryAvailability[activeCategory]) return;
    const next = CATEGORIES.find(cat => categoryAvailability[cat.key]);
    if (next) {
      setActiveCategory(next.key);
    }
  }, [loading, categoryAvailability, activeCategory, CATEGORIES]);

  const ActiveCategoryComponent = CATEGORY_COMPONENTS[activeCategory] || null;

  if (!user) {
    return (
      <div style={{ padding: 24 }}>
        <h2>{t('analytics.title')}</h2>
        <p>{t('analytics.signin_msg')}</p>
      </div>
    );
  }

  if (!selectedBaby) {
    return (
      <div style={{ padding: 24, display: 'grid', gap: 12 }}>
        <h2>{t('analytics.title')}</h2>
        <EmptyState message={t('analytics.select_baby_msg')} />
      </div>
    );
  }

  const rangeSummary = range ? `${formatDate(range.fromDisplay)} → ${formatDate(range.toDisplay)}` : t('analytics.select_custom');

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <header className="analytics-header" style={{ display: 'grid', gap: 12, background: '#fff', border: '1px solid #ececf2', borderRadius: 16, padding: '18px 20px' }}>
        <div className="analytics-header__top" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 28, fontFamily: 'Nunito, Inter, sans-serif' }}>{t('analytics.title')}</h2>
          <div className="range-presets" style={{ marginLeft: 'auto', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <span className="range-presets__label">{t('analytics.range')}</span>
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
          <details className="custom-range" open={customExpanded} onToggle={event => setCustomExpanded(event.target.open)}>
            <summary>{t('analytics.select_custom')}</summary>
            <div className="custom-range__inputs">
              <label>
                <span>{t('analytics.from')}</span>
                <input
                  type="date"
                  value={customRange.from}
                  onChange={e => setCustomRange(prev => ({ ...prev, from: e.target.value }))}
                />
              </label>
              <label>
                <span>{t('analytics.to')}</span>
                <input
                  type="date"
                  value={customRange.to}
                  onChange={e => setCustomRange(prev => ({ ...prev, to: e.target.value }))}
                />
              </label>
            </div>
          </details>
        ) : null}
        <div className="range-summary" style={{ fontSize: 12, color: '#777' }}>{rangeSummary}</div>
      </header>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <div style={{ border: '1px solid #ffb4b4', background: '#ffecec', padding: '16px 18px', borderRadius: 12, color: '#9b1b1b' }}>
          {t('analytics.failed_load')}
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
            <KpiCard title={t('analytics.total_events')} value={analytics.totals.totalEvents} subtitle={`${analytics.totals.dayCount} ${t('analytics.day_window')}`} />
            <KpiCard title={t('analytics.active_categories')} value={availableCount} subtitle={t('analytics.with_data')} />
          </section>

          <CategoryTabs categories={CATEGORIES} active={activeCategory} onSelect={setActiveCategory} disabledKeys={disabledKeys} />

          {ActiveCategoryComponent && categoryAvailability[activeCategory] ? (
            <ActiveCategoryComponent data={analytics[activeCategory]} totals={analytics.totals} />
          ) : (
            <EmptyState message={t('analytics.no_data')} />)
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
        .custom-range {
          background: #f7f7fb;
          border: 1px solid #e2e2f0;
          border-radius: 12px;
          padding: 12px 14px;
        }
        .custom-range summary {
          font-weight: 600;
          font-size: 13px;
          color: #333;
          cursor: pointer;
          list-style: none;
          display: flex;
          align-items: center;
        }
        .custom-range summary::-webkit-details-marker {
          display: none;
        }
        .custom-range summary::after {
          content: '▾';
          margin-left: 6px;
          font-size: 12px;
        }
        .custom-range[open] summary::after {
          content: '▴';
        }
        .custom-range__inputs {
          display: grid;
          gap: 10px;
          margin-top: 12px;
        }
        .custom-range__inputs label {
          display: grid;
          gap: 4px;
          font-size: 12px;
          color: #555;
        }
        .custom-range__inputs input {
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid #d0d0d9;
        }
        @media (min-width: 481px) {
          .custom-range {
            padding: 0;
            background: transparent;
            border: none;
          }
          .custom-range summary {
            display: none;
          }
          .custom-range__inputs {
            margin-top: 0;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }
          .custom-range__inputs input {
            background: #fff;
            border: 1px solid #d0d0d9;
          }
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
          .custom-range {
            padding: 10px 12px;
            border-radius: 10px;
          }
          .custom-range__inputs {
            gap: 8px;
          }
          .custom-range__inputs input {
            background: #fff;
          }
        }
      `}</style>
    </div>
  );
}

function computeRange(rangeKey, customRange, presets) {
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
  const preset = presets.find(opt => opt.key === rangeKey);
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

function computeCategoryAvailability(analytics = {}) {
  const keys = ['diapering', 'feeding', 'sleep', 'mood', 'health', 'pregnancy', 'play', 'milestones', 'notes'];
  if (!analytics) return Object.fromEntries(keys.map(k => [k, false]));
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
