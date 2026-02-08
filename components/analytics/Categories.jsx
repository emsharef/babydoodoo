'use client';

import { useMemo, useState } from 'react';
import ChartCard from './ChartCard';
import KpiCard from './KpiCard';
import EmptyState from './EmptyState';
import EChart from './charts/EChart';
import { useLanguage } from '@/components/LanguageContext';
import { EVENT_DEFS } from '@/lib/events';
import {
  diaperStackedOption,
  lineOption,
  multiLineOption,
  pieOption,
  horizontalBarOption,
  heatmapOption,
  scatterOption,
  eventCalendarOption,
} from './chartOptions';

export const CATEGORY_COMPONENTS = {
  calendar: CalendarCategory,
  diapering: DiaperingCategory,
  feeding: FeedingCategory,
  sleep: SleepCategory,
  mood: MoodCategory,
  health: HealthCategory,
  pregnancy: PregnancyCategory,
  play: PlayCategory,
  milestones: MilestonesCategory,
  notes: NotesCategory,
};

const kpiRowStyle = {
  display: 'grid',
  gap: 12,
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
};

const eventDefMap = new Map(EVENT_DEFS.map(d => [d.type, d]));

function CalendarCategory({ data }) {
  const { t } = useLanguage();
  const { points, days, types } = data;
  const typesArray = types instanceof Set ? Array.from(types) : [];
  const [hidden, setHidden] = useState(new Set());

  const toggle = type => {
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const filteredPoints = useMemo(
    () => hidden.size === 0 ? points : points.filter(pt => !hidden.has(pt.eventType)),
    [points, hidden],
  );
  const visibleTypes = useMemo(
    () => new Set(filteredPoints.map(pt => pt.eventType)),
    [filteredPoints],
  );

  if (!points.length) {
    return <EmptyState message={t('ana.cal_empty')} />;
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={kpiRowStyle}>
        <KpiCard title={t('ana.cal_total')} value={filteredPoints.length} subtitle={`${days.length} ${t('analytics.day_window')}`} />
        <KpiCard title={t('ana.cal_types')} value={visibleTypes.size} subtitle={t('ana.cal_unique')} />
      </div>
      <ChartCard title={t('ana.cal_title')} description={t('ana.cal_desc')} height={420}>
        <EChart option={eventCalendarOption({ points: filteredPoints, days })} style={{ height: 420 }} />
      </ChartCard>
      {typesArray.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 8, padding: '8px 4px',
        }}>
          {typesArray.map(type => {
            const def = eventDefMap.get(type);
            if (!def) return null;
            const isHidden = hidden.has(type);
            return (
              <button key={type} type="button" onClick={() => toggle(type)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 8,
                background: isHidden ? '#f0f0f3' : def.bg,
                border: `1px solid ${isHidden ? '#d0d0d6' : def.bd}`,
                fontSize: 13, fontWeight: 500,
                cursor: 'pointer',
                opacity: isHidden ? 0.45 : 1,
                textDecoration: isHidden ? 'line-through' : 'none',
                transition: 'all 0.15s ease',
              }}>
                {def.emoji} {def.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DiaperingCategory({ data, totals }) {
  const { t } = useLanguage();
  const avgPerDay = totals.dayCount ? (data.total / totals.dayCount).toFixed(1) : '0';
  const lastDirty = data.lastDirty ? new Date(data.lastDirty) : null;
  const now = typeof window !== 'undefined' ? new Date() : null;
  let sinceLabel = '—';
  if (lastDirty && now) {
    const diffMs = Math.max(0, now.getTime() - lastDirty.getTime());
    const diffMinutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    sinceLabel = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${t('ana.ago')}`;
  }
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={kpiRowStyle}>
        <KpiCard title={t('ana.diaper_total')} value={data.total} subtitle={`${avgPerDay} ${t('ana.per_day')}`} />
        <KpiCard title={t('ana.last_dirty')} value={sinceLabel} subtitle={lastDirty ? lastDirty.toLocaleString() : t('ana.based_kind')} />
      </div>
      {data.stackedBar.length ? (
        <ChartCard title={t('ana.diaper_day')} description={t('ana.diaper_stack')}>
          <EChart option={diaperStackedOption(data.stackedBar.map(r => r.day), data.stackedBar)} />
        </ChartCard>
      ) : <EmptyState message={t('ana.no_diaper')} />}
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
        {data.consistencyPie.length ? (
          <ChartCard title={t('ana.consistency')} description={t('ana.consist_desc')} height={280}>
            <EChart option={pieOption(data.consistencyPie)} style={{ height: 260 }} />
          </ChartCard>
        ) : <EmptyState message={t('ana.no_consist')} />}
        {data.diaperKindPie.length ? (
          <ChartCard title={t('ana.diaper_type')} description={t('ana.type_desc')} height={280}>
            <EChart option={pieOption(data.diaperKindPie)} style={{ height: 260 }} />
          </ChartCard>
        ) : <EmptyState message={t('ana.no_type')} />}
      </div>
    </div>
  );
}

function FeedingCategory({ data, totals }) {
  const { t } = useLanguage();
  const avgInterval = data.avgIntervalMinutes ? `${data.avgIntervalMinutes.toFixed(0)} min` : '—';
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={kpiRowStyle}>
        <KpiCard title={t('ana.feed_total')} value={data.totalFeeds} subtitle={`${t('ana.longest')}: ${data.longestFeedQuantity || 0} ml`} />
        <KpiCard title={t('ana.volume')} value={`${data.totalVolume} ml`} subtitle={t('ana.vol_desc')} />
        <KpiCard title={t('ana.avg_int')} value={avgInterval} subtitle={t('ana.bet_feeds')} />
      </div>
      {data.volumeLine[0]?.data?.some(point => point.y) ? (
        <ChartCard title={t('ana.intake')} description={t('ana.vol_day')}>
          <EChart
            option={lineOption({
              days: data.volumeLine[0].data.map(p => p.x),
              values: data.volumeLine[0].data.map(p => p.y),
              unit: 'ml',
            })}
          />
        </ChartCard>
      ) : <EmptyState message={t('ana.no_vol')} />}
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
        {data.typePie.length ? (
          <ChartCard title={t('ana.feed_types')} description={t('ana.src_dist')} height={280}>
            <EChart option={pieOption(data.typePie)} style={{ height: 260 }} />
          </ChartCard>
        ) : <EmptyState message={t('ana.no_feed_meta')} />}
        {data.feedAmounts.length ? (
          <ChartCard title={t('ana.feed_log')} description={t('ana.recent_feeds')} height={280}>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8, maxHeight: 240, overflowY: 'auto' }}>
              {data.feedAmounts.slice(-8).reverse().map(feed => (
                <li key={feed.id} style={{ padding: '10px 12px', border: '1px solid #ececf2', borderRadius: 10, background: '#f8f9ff' }}>
                  <strong>{feed.quantity} ml</strong> · {t(`val.${feed.kind}`) || feed.kind}<br />
                  <span style={{ fontSize: 12, color: '#666' }}>{new Date(feed.occurred_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </ChartCard>
        ) : <EmptyState message={t('ana.no_feeds')} />}
      </div>
    </div>
  );
}

function SleepCategory({ data }) {
  const { t } = useLanguage();
  const totalHours = data.totalMinutes ? (data.totalMinutes / 60).toFixed(1) : '0';
  const avg = data.avgSessionMinutes ? `${data.avgSessionMinutes.toFixed(0)} min` : '—';
  const hasLine = data.perDayLine[0]?.data?.some(point => point.y);
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={kpiRowStyle}>
        <KpiCard title={t('ana.sleep_total')} value={`${totalHours} h`} subtitle={t('ana.sleep_win')} />
        <KpiCard title={t('ana.sessions')} value={data.sessions.length} subtitle={`${t('ana.avg')} ${avg}`} />
      </div>
      {hasLine ? (
        <ChartCard title={t('ana.sleep_day')} description={t('ana.sleep_end')}>
          <EChart
            option={lineOption({
              days: data.perDayLine[0].data.map(p => p.x),
              values: data.perDayLine[0].data.map(p => p.y),
              unit: 'min',
            })}
          />
        </ChartCard>
      ) : <EmptyState message={t('ana.no_sleep')} />}
      {data.sessions.length ? (
        <ChartCard title={t('ana.recent_sleep')} description={t('ana.dur_min')} height={260}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
            {data.sessions.slice(-10).reverse().map(session => (
              <li key={session.id} style={{ padding: '10px 12px', border: '1px solid #ececf2', borderRadius: 10, background: '#fdfdfd' }}>
                <strong>{session.duration.toFixed(0)} min</strong><br />
                <span style={{ fontSize: 12, color: '#666' }}>
                  {session.start ? `${new Date(session.start).toLocaleString()} → ` : ''}
                  {new Date(session.end).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </ChartCard>
      ) : <EmptyState message={t('ana.no_sessions')} />}
    </div>
  );
}

function MoodCategory({ data }) {
  const { t } = useLanguage();
  const hasBar = data.emojiBar.length > 0;
  const hasHeatmap = data.heatmap.some(row => ['Night', 'Morning', 'Afternoon', 'Evening'].some(period => Math.abs(row[period]) > 0.001));
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={kpiRowStyle}>
        <KpiCard title={t('ana.mood_entries')} value={data.total} subtitle={t('ana.mood_desc')} />
        <KpiCard title={t('ana.distinct')} value={data.emojiBar.length} subtitle={t('ana.unique')} />
      </div>
      {hasBar ? (
        <ChartCard title={t('ana.mood_freq')} description={t('ana.emoji_count')}>
          <EChart option={horizontalBarOption(data.emojiBar, 'label', 'count')} />
        </ChartCard>
      ) : <EmptyState message={t('ana.no_mood')} />}
      {hasHeatmap ? (
        <ChartCard title={t('ana.heatmap')} description={t('ana.heat_desc')} height={360}>
          <EChart option={heatmapOption(data.heatmap.map(row => row.day), data.heatmap)} style={{ height: 360 }} />
        </ChartCard>
      ) : <EmptyState message={t('ana.no_heat')} />}
    </div>
  );
}

function HealthCategory({ data }) {
  const { t } = useLanguage();
  const hasTemp = data.temperatureLine[0]?.data?.length;
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={kpiRowStyle}>
        <KpiCard title={t('ana.temp_read')} value={data.temperatureReadings.length} subtitle={t('ana.vis_care')} />
        <KpiCard title={t('ana.meds')} value={data.medicines.length} subtitle={t('ana.doses')} />
        <KpiCard title={t('ana.doc_visit')} value={data.doctorVisits.length} subtitle={t('ana.during_win')} />
      </div>
      {hasTemp ? (
        <ChartCard title={t('ana.temp_trend')} description={t('ana.val_time')}>
          <EChart
            option={lineOption({
              days: data.temperatureLine[0].data.map(p => p.x),
              values: data.temperatureLine[0].data.map(p => p.y),
              unit: data.temperatureReadings[0]?.unit || undefined,
            })}
          />
        </ChartCard>
      ) : <EmptyState message={t('ana.no_temp')} />}
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
        {data.pukePie.length ? (
          <ChartCard title={t('ana.puke_sev')} description={t('ana.cnt_amt')} height={260}>
            <EChart option={pieOption(data.pukePie)} style={{ height: 240 }} />
          </ChartCard>
        ) : <EmptyState message={t('ana.no_puke')} />}
        <ChartCard title={t('ana.med_log')} description={t('ana.recent_ent')} height={260}>
          {data.medicines.length ? (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
              {data.medicines.slice(-8).reverse().map(item => (
                <li key={item.id} style={{ padding: '10px 12px', border: '1px solid #ececf2', borderRadius: 10, background: '#fef9f5' }}>
                  <strong>{item.name}</strong> {item.dose ? `· ${item.dose}${item.unit}` : ''}<br />
                  <span style={{ fontSize: 12, color: '#666' }}>{t(`val.${item.route?.toLowerCase()}`) || item.route || 'route ?'}</span><br />
                  <span style={{ fontSize: 12, color: '#666' }}>{new Date(item.occurred_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          ) : <EmptyState message={t('ana.no_meds')} />}
        </ChartCard>
      </div>
      {data.doctorVisits.length ? (
        <ChartCard title={t('ana.doc_visit')} description={t('ana.chrono')} height={220}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
            {data.doctorVisits.slice(-6).reverse().map(item => (
              <li key={item.id} style={{ padding: '10px 12px', border: '1px solid #ececf2', borderRadius: 10, background: '#f4f9ff' }}>
                <strong>{t(`val.${item.kind}`) || item.kind}</strong>{item.provider ? ` · ${item.provider}` : ''}<br />
                <span style={{ fontSize: 12, color: '#666' }}>{new Date(item.occurred_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </ChartCard>
      ) : <EmptyState message={t('ana.no_doc')} />}
    </div>
  );
}

function PregnancyCategory({ data }) {
  const { t } = useLanguage();
  const avgIntensity = data.avgContractionIntensity?.value ? data.avgContractionIntensity.value.toFixed(1) : '—';
  const kicksLineHasData = data.kicksLine[0]?.data?.some(point => point.y);
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={kpiRowStyle}>
        <KpiCard title={t('ana.kick_total')} value={data.totalKicks} subtitle={t('ana.kick_ev')} />
        <KpiCard title={t('ana.avg_cont')} value={avgIntensity} subtitle={t('ana.scale_10')} />
        <KpiCard title={t('ana.hb_read')} value={data.heartbeatReadings.length} subtitle={data.lastHeartbeat ? `${t('ana.latest')} ${new Date(data.lastHeartbeat).toLocaleString()}` : t('ana.no_read')} />
      </div>
      {kicksLineHasData ? (
        <ChartCard title={t('ana.kick_day')} description={t('ana.cnt_kick')}>
          <EChart
            option={lineOption({
              days: data.kicksLine[0].data.map(p => p.x),
              values: data.kicksLine[0].data.map(p => p.y),
            })}
          />
        </ChartCard>
      ) : <EmptyState message={t('ana.no_kick')} />}
      {data.contractions.length ? (
        <ChartCard title={t('ana.contract')} description={t('ana.dur_int')} height={360}>
          <EChart
            option={scatterOption({
              points: data.contractions.map(item => [item.duration || 0, item.intensity || 0]),
              xLabel: 'Duration (sec)',
              yLabel: 'Intensity',
            })}
            style={{ height: 320 }}
          />
        </ChartCard>
      ) : <EmptyState message={t('ana.no_cont')} />}
      {data.heartbeatReadings.length ? (
        <ChartCard title={t('ana.heartbeat')} description={t('ana.bpm_read')} height={320}>
          <EChart
            option={lineOption({
              days: data.heartbeatReadings.map(item => item.occurred_at),
              values: data.heartbeatReadings.map(item => item.bpm),
              unit: 'bpm',
            })}
          />
        </ChartCard>
      ) : <EmptyState message={t('ana.no_hb')} />}
    </div>
  );
}

function PlayCategory({ data, totals }) {
  const { t } = useLanguage();
  const avgPerDay = totals.dayCount ? (data.totalMinutes / totals.dayCount).toFixed(1) : '0';
  const hasLine = data.minutesLine[0]?.data?.some(point => point.y);
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={kpiRowStyle}>
        <KpiCard title={t('ana.play_total')} value={data.totalMinutes} subtitle={`${avgPerDay} ${t('ana.per_day')}`} />
        <KpiCard title={t('ana.sessions')} value={data.totalSessions} subtitle={t('ana.play_log')} />
      </div>
      {hasLine ? (
        <ChartCard title={t('ana.play_day')} description={t('ana.play_agg')}>
          <EChart
            option={lineOption({
              days: data.minutesLine[0].data.map(p => p.x),
              values: data.minutesLine[0].data.map(p => p.y),
              unit: 'min',
            })}
          />
        </ChartCard>
      ) : <EmptyState message={t('ana.no_play')} />}
      {data.minutesByTypeBar.length ? (
        <ChartCard title={t('ana.play_act')} description={t('ana.play_cat')} height={300}>
          <EChart option={horizontalBarOption(data.minutesByTypeBar, 'label', 'minutes', { unit: 'min' })} style={{ height: 260 }} />
        </ChartCard>
      ) : <EmptyState message={t('ana.no_play_meta')} />}
    </div>
  );
}

function MilestonesCategory({ data }) {
  const { t } = useLanguage();
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={kpiRowStyle}>
        <KpiCard title={t('ana.milestones')} value={data.length} subtitle={t('ana.during_win')} />
      </div>
      {data.length ? (
        <ChartCard title={t('ana.mile_time')} description={t('ana.recent_1st')} height={320}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12, maxHeight: 280, overflowY: 'auto' }}>
            {data.slice(0, 12).map(item => (
              <li key={item.id} style={{ borderLeft: '3px solid #7c3aed', paddingLeft: 12 }}>
                <strong>{item.title}</strong> · <span style={{ textTransform: 'capitalize' }}>{t(`val.${item.category}`) || item.category}</span><br />
                <span style={{ fontSize: 12, color: '#666' }}>{new Date(item.occurred_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </ChartCard>
      ) : <EmptyState message={t('ana.no_mile')} />}
    </div>
  );
}

function NotesCategory({ data }) {
  const { t } = useLanguage();
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <KpiCard title={t('ana.notes')} value={data.entries.length} subtitle={t('ana.inline')} />
        <KpiCard title={t('ana.keywords')} value={data.keywords.length} subtitle={t('ana.meaningful')} />
      </div>
      {data.keywords.length ? (
        <ChartCard title={t('ana.key_freq')} description={t('ana.top_12')} height={300}>
          <EChart option={horizontalBarOption(data.keywords, 'word', 'count')} style={{ height: 260 }} />
        </ChartCard>
      ) : <EmptyState message={t('ana.no_key')} />}
      {data.entries.length ? (
        <ChartCard title={t('ana.recent_notes')} description={t('ana.chrono_notes')} height={320}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10, maxHeight: 280, overflowY: 'auto' }}>
            {data.entries.slice(0, 12).map(item => (
              <li key={item.id} style={{ border: '1px solid #ececf2', borderRadius: 10, padding: '10px 12px', background: '#fffef7' }}>
                <span style={{ fontSize: 12, color: '#666' }}>{new Date(item.occurred_at).toLocaleString()}</span>
                <p style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.4 }}>{item.text}</p>
              </li>
            ))}
          </ul>
        </ChartCard>
      ) : <EmptyState message={t('ana.no_notes')} />}
    </div>
  );
}
