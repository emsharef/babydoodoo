'use client';

import ChartCard from './ChartCard';
import KpiCard from './KpiCard';
import EmptyState from './EmptyState';
import EChart from './charts/EChart';
import {
  diaperStackedOption,
  lineOption,
  multiLineOption,
  pieOption,
  horizontalBarOption,
  heatmapOption,
  scatterOption,
} from './chartOptions';

export const CATEGORY_COMPONENTS = {
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

function DiaperingCategory({ data, totals }) {
  const avgPerDay = totals.dayCount ? (data.total / totals.dayCount).toFixed(1) : '0';
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <KpiCard title="Total diaper actions" value={data.total} subtitle={`${avgPerDay} per day`} />
        <KpiCard title="Last dirty diaper" value={data.lastDirty ? new Date(data.lastDirty).toLocaleString() : '—'} subtitle="Based on diaper.kind" />
      </div>
      {data.stackedBar.length ? (
        <ChartCard title="Diaper events per day" description="Stacked across pee, poo, and changes">
          <EChart option={diaperStackedOption(data.stackedBar.map(r => r.day), data.stackedBar)} />
        </ChartCard>
      ) : <EmptyState message="No diaper events in this range." />}
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
        {data.consistencyPie.length ? (
          <ChartCard title="Consistency" description="Counts by recorded consistency" height={280}>
            <EChart option={pieOption(data.consistencyPie)} style={{ height: 260 }} />
          </ChartCard>
        ) : <EmptyState message="No consistency details captured." />}
        {data.diaperKindPie.length ? (
          <ChartCard title="Diaper change type" description="Wet, dirty, both, etc." height={280}>
            <EChart option={pieOption(data.diaperKindPie)} style={{ height: 260 }} />
          </ChartCard>
        ) : <EmptyState message="No diaper type records yet." />}
      </div>
    </div>
  );
}

function FeedingCategory({ data, totals }) {
  const avgInterval = data.avgIntervalMinutes ? `${data.avgIntervalMinutes.toFixed(0)} min` : '—';
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <KpiCard title="Total feeds" value={data.totalFeeds} subtitle={`Longest feed: ${data.longestFeedQuantity || 0} ml`} />
        <KpiCard title="Volume" value={`${data.totalVolume} ml`} subtitle="Sum of recorded quantities" />
        <KpiCard title="Average interval" value={avgInterval} subtitle="Between feeds" />
      </div>
      {data.volumeLine[0]?.data?.some(point => point.y) ? (
        <ChartCard title="Intake volume over time" description="Total ml per day">
          <EChart
            option={lineOption({
              days: data.volumeLine[0].data.map(p => p.x),
              values: data.volumeLine[0].data.map(p => p.y),
              unit: 'ml',
            })}
          />
        </ChartCard>
      ) : <EmptyState message="No feeding quantity data." />}
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
        {data.typePie.length ? (
          <ChartCard title="Feed types" description="Distribution by source" height={280}>
            <EChart option={pieOption(data.typePie)} style={{ height: 260 }} />
          </ChartCard>
        ) : <EmptyState message="No feed type metadata." />}
        {data.feedAmounts.length ? (
          <ChartCard title="Feed log" description="Most recent feeds" height={280}>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8, maxHeight: 240, overflowY: 'auto' }}>
              {data.feedAmounts.slice(-8).reverse().map(feed => (
                <li key={feed.id} style={{ padding: '10px 12px', border: '1px solid #ececf2', borderRadius: 10, background: '#f8f9ff' }}>
                  <strong>{feed.quantity} ml</strong> · {feed.kind}<br />
                  <span style={{ fontSize: 12, color: '#666' }}>{new Date(feed.occurred_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </ChartCard>
        ) : <EmptyState message="No feed entries to list." />}
      </div>
    </div>
  );
}

function SleepCategory({ data }) {
  const totalHours = data.totalMinutes ? (data.totalMinutes / 60).toFixed(1) : '0';
  const avg = data.avgSessionMinutes ? `${data.avgSessionMinutes.toFixed(0)} min` : '—';
  const hasLine = data.perDayLine[0]?.data?.some(point => point.y);
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <KpiCard title="Total sleep" value={`${totalHours} h`} subtitle="Across the selected window" />
        <KpiCard title="Sessions" value={data.sessions.length} subtitle={`Avg ${avg}`} />
      </div>
      {hasLine ? (
        <ChartCard title="Sleep minutes per day" description="Based on SleepEnd events">
          <EChart
            option={lineOption({
              days: data.perDayLine[0].data.map(p => p.x),
              values: data.perDayLine[0].data.map(p => p.y),
              unit: 'min',
            })}
          />
        </ChartCard>
      ) : <EmptyState message="No sleep duration recorded." />}
      {data.sessions.length ? (
        <ChartCard title="Recent sleep sessions" description="Duration in minutes" height={260}>
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
      ) : <EmptyState message="No sleep sessions to show." />}
    </div>
  );
}

function MoodCategory({ data }) {
  const hasBar = data.emojiBar.length > 0;
  const hasHeatmap = data.heatmap.some(row => ['Night', 'Morning', 'Afternoon', 'Evening'].some(period => Math.abs(row[period]) > 0.001));
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <KpiCard title="Mood entries" value={data.total} subtitle="Both baby and caregiver" />
        <KpiCard title="Distinct moods" value={data.emojiBar.length} subtitle="Unique emoji captured" />
      </div>
      {hasBar ? (
        <ChartCard title="Mood frequency" description="Counts per emoji">
          <EChart option={horizontalBarOption(data.emojiBar, 'label', 'count')} />
        </ChartCard>
      ) : <EmptyState message="No mood entries yet." />}
      {hasHeatmap ? (
        <ChartCard title="Mood heatmap" description="Average sentiment by day & time of day" height={360}>
          <EChart option={heatmapOption(data.heatmap.map(row => row.day), data.heatmap)} style={{ height: 360 }} />
        </ChartCard>
      ) : <EmptyState message="Not enough mood data for heatmap." />}
    </div>
  );
}

function HealthCategory({ data }) {
  const hasTemp = data.temperatureLine[0]?.data?.length;
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <KpiCard title="Temperature readings" value={data.temperatureReadings.length} subtitle="Visible to caregivers" />
        <KpiCard title="Medicines" value={data.medicines.length} subtitle="Recorded doses" />
        <KpiCard title="Doctor visits" value={data.doctorVisits.length} subtitle="During this window" />
      </div>
      {hasTemp ? (
        <ChartCard title="Temperature trend" description="Values over time">
          <EChart
            option={lineOption({
              days: data.temperatureLine[0].data.map(p => p.x),
              values: data.temperatureLine[0].data.map(p => p.y),
              unit: data.temperatureReadings[0]?.unit || undefined,
            })}
          />
        </ChartCard>
      ) : <EmptyState message="No temperature data." />}
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
        {data.pukePie.length ? (
          <ChartCard title="Puke severity" description="Counts by amount" height={260}>
            <EChart option={pieOption(data.pukePie)} style={{ height: 240 }} />
          </ChartCard>
        ) : <EmptyState message="No puke events recorded." />}
        <ChartCard title="Medication log" description="Recent entries" height={260}>
          {data.medicines.length ? (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
              {data.medicines.slice(-8).reverse().map(item => (
                <li key={item.id} style={{ padding: '10px 12px', border: '1px solid #ececf2', borderRadius: 10, background: '#fef9f5' }}>
                  <strong>{item.name}</strong> {item.dose ? `· ${item.dose}${item.unit}` : ''}<br />
                  <span style={{ fontSize: 12, color: '#666' }}>{item.route || 'route ?'}</span><br />
                  <span style={{ fontSize: 12, color: '#666' }}>{new Date(item.occurred_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          ) : <EmptyState message="No medicines recorded." />}
        </ChartCard>
      </div>
      {data.doctorVisits.length ? (
        <ChartCard title="Doctor visits" description="Chronological order" height={220}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
            {data.doctorVisits.slice(-6).reverse().map(item => (
              <li key={item.id} style={{ padding: '10px 12px', border: '1px solid #ececf2', borderRadius: 10, background: '#f4f9ff' }}>
                <strong>{item.kind}</strong>{item.provider ? ` · ${item.provider}` : ''}<br />
                <span style={{ fontSize: 12, color: '#666' }}>{new Date(item.occurred_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </ChartCard>
      ) : <EmptyState message="No doctor visits recorded." />}
    </div>
  );
}

function PregnancyCategory({ data }) {
  const avgIntensity = data.avgContractionIntensity?.value ? data.avgContractionIntensity.value.toFixed(1) : '—';
  const kicksLineHasData = data.kicksLine[0]?.data?.some(point => point.y);
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <KpiCard title="Total kicks" value={data.totalKicks} subtitle="KickMe events" />
        <KpiCard title="Avg contraction intensity" value={avgIntensity} subtitle="On 1-10 scale" />
        <KpiCard title="Heartbeat readings" value={data.heartbeatReadings.length} subtitle={data.lastHeartbeat ? `Latest ${new Date(data.lastHeartbeat).toLocaleString()}` : 'No readings yet'} />
      </div>
      {kicksLineHasData ? (
        <ChartCard title="Kicks per day" description="Counts from KickMe events">
          <EChart
            option={lineOption({
              days: data.kicksLine[0].data.map(p => p.x),
              values: data.kicksLine[0].data.map(p => p.y),
            })}
          />
        </ChartCard>
      ) : <EmptyState message="No kicks logged." />}
      {data.contractions.length ? (
        <ChartCard title="Contractions" description="Duration vs intensity" height={360}>
          <EChart
            option={scatterOption({
              points: data.contractions.map(item => [item.duration || 0, item.intensity || 0]),
              xLabel: 'Duration (sec)',
              yLabel: 'Intensity',
            })}
            style={{ height: 320 }}
          />
        </ChartCard>
      ) : <EmptyState message="No contraction events recorded." />}
      {data.heartbeatReadings.length ? (
        <ChartCard title="Heartbeat" description="BPM readings" height={320}>
          <EChart
            option={lineOption({
              days: data.heartbeatReadings.map(item => item.occurred_at),
              values: data.heartbeatReadings.map(item => item.bpm),
              unit: 'bpm',
            })}
          />
        </ChartCard>
      ) : <EmptyState message="No heartbeat data." />}
    </div>
  );
}

function PlayCategory({ data, totals }) {
  const avgPerDay = totals.dayCount ? (data.totalMinutes / totals.dayCount).toFixed(1) : '0';
  const hasLine = data.minutesLine[0]?.data?.some(point => point.y);
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <KpiCard title="Total play minutes" value={data.totalMinutes} subtitle={`${avgPerDay} per day`} />
        <KpiCard title="Sessions" value={data.totalSessions} subtitle="Logged play events" />
      </div>
      {hasLine ? (
        <ChartCard title="Play minutes per day" description="Aggregated from play meta">
          <EChart
            option={lineOption({
              days: data.minutesLine[0].data.map(p => p.x),
              values: data.minutesLine[0].data.map(p => p.y),
              unit: 'min',
            })}
          />
        </ChartCard>
      ) : <EmptyState message="No recorded play minutes." />}
      {data.minutesByTypeBar.length ? (
        <ChartCard title="Play by activity" description="Total minutes by category" height={300}>
          <EChart option={horizontalBarOption(data.minutesByTypeBar, 'label', 'minutes', { unit: 'min' })} style={{ height: 260 }} />
        </ChartCard>
      ) : <EmptyState message="No play type metadata." />}
    </div>
  );
}

function MilestonesCategory({ data }) {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <KpiCard title="Milestones" value={data.length} subtitle="During this window" />
      </div>
      {data.length ? (
        <ChartCard title="Milestone timeline" description="Most recent first" height={320}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12, maxHeight: 280, overflowY: 'auto' }}>
            {data.slice(0, 12).map(item => (
              <li key={item.id} style={{ borderLeft: '3px solid #7c3aed', paddingLeft: 12 }}>
                <strong>{item.title}</strong> · <span style={{ textTransform: 'capitalize' }}>{item.category}</span><br />
                <span style={{ fontSize: 12, color: '#666' }}>{new Date(item.occurred_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </ChartCard>
      ) : <EmptyState message="No milestones captured within this range." />}
    </div>
  );
}

function NotesCategory({ data }) {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <KpiCard title="Notes" value={data.entries.length} subtitle="Includes inline notes" />
        <KpiCard title="Top keywords" value={data.keywords.length} subtitle="Filtered for meaningful words" />
      </div>
      {data.keywords.length ? (
        <ChartCard title="Keyword frequency" description="Top twelve words" height={300}>
          <EChart option={horizontalBarOption(data.keywords, 'word', 'count')} style={{ height: 260 }} />
        </ChartCard>
      ) : <EmptyState message="Not enough notes for keyword analysis." />}
      {data.entries.length ? (
        <ChartCard title="Recent notes" description="Chronological" height={320}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10, maxHeight: 280, overflowY: 'auto' }}>
            {data.entries.slice(0, 12).map(item => (
              <li key={item.id} style={{ border: '1px solid #ececf2', borderRadius: 10, padding: '10px 12px', background: '#fffef7' }}>
                <span style={{ fontSize: 12, color: '#666' }}>{new Date(item.occurred_at).toLocaleString()}</span>
                <p style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.4 }}>{item.text}</p>
              </li>
            ))}
          </ul>
        </ChartCard>
      ) : <EmptyState message="No notes to list." />}
    </div>
  );
}
