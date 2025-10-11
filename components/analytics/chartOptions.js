const labelRotate = length => (length > 18 ? 45 : 0);

function makeGrid(extra = {}) {
  return { left: 56, right: 24, top: 36, bottom: 52, containLabel: false, ...extra };
}

export function diaperStackedOption(days, rows) {
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { top: 0 },
    grid: makeGrid(),
    xAxis: { type: 'category', data: days, axisLabel: { rotate: labelRotate(days.length) } },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      { name: 'DooDoo', type: 'bar', stack: 'total', emphasis: { focus: 'series' }, data: rows.map(r => r.DooDoo || 0) },
      { name: 'PeePee', type: 'bar', stack: 'total', emphasis: { focus: 'series' }, data: rows.map(r => r.PeePee || 0) },
      { name: 'Diaper', type: 'bar', stack: 'total', emphasis: { focus: 'series' }, data: rows.map(r => r.Diaper || 0) },
    ],
  };
}

export function lineOption({ days, values, unit }) {
  return {
    tooltip: { trigger: 'axis' },
    grid: makeGrid(),
    xAxis: { type: 'category', data: days, axisLabel: { rotate: labelRotate(days.length) } },
    yAxis: { type: 'value', minInterval: 1, name: unit || undefined },
    series: [{
      type: 'line',
      smooth: true,
      symbolSize: days.length > 40 ? 2 : 6,
      areaStyle: { opacity: 0.08 },
      data: values,
    }],
  };
}

export function multiLineOption(seriesList, days, opts = {}) {
  return {
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    grid: makeGrid(),
    xAxis: { type: 'category', data: days, axisLabel: { rotate: labelRotate(days.length) } },
    yAxis: { type: 'value', minInterval: 1, name: opts.unit || undefined },
    series: seriesList.map(item => ({
      type: 'line',
      name: item.name,
      smooth: true,
      symbolSize: days.length > 40 ? 2 : 6,
      areaStyle: item.area ? { opacity: 0.08 } : undefined,
      data: item.data,
    })),
  };
}

export function pieOption(data) {
  return {
    tooltip: { trigger: 'item' },
    legend: { orient: 'horizontal', bottom: 0 },
    series: [{
      type: 'pie',
      radius: ['45%', '70%'],
      avoidLabelOverlap: true,
      itemStyle: { borderColor: '#fff', borderWidth: 2 },
      data: data.map(item => ({ value: item.value, name: item.label || item.id })),
    }],
  };
}

export function horizontalBarOption(entries, labelKey, valueKey, opts = {}) {
  const data = entries.slice().sort((a, b) => (b[valueKey] || 0) - (a[valueKey] || 0));
  return {
    tooltip: { trigger: 'axis' },
    grid: makeGrid({ left: 120 }),
    xAxis: { type: 'value', minInterval: 1, name: opts.unit || undefined },
    yAxis: { type: 'category', data: data.map(item => item[labelKey]), inverse: true },
    series: [{
      type: 'bar',
      data: data.map(item => item[valueKey] || 0),
      label: { show: true, position: 'right' },
      barMaxWidth: 36,
    }],
  };
}

export function heatmapOption(days, matrix) {
  const keys = ['Night', 'Morning', 'Afternoon', 'Evening'];
  const data = matrix.map(row => keys.map(k => row[k])).flatMap((row, y) =>
    row.map((val, x) => [x, y, Number.isFinite(val) ? Number(val.toFixed(2)) : 0])
  );
  return {
    tooltip: { position: 'top' },
    grid: { left: 72, right: 24, top: 16, bottom: 36 },
    xAxis: { type: 'category', data: keys },
    yAxis: { type: 'category', data: days },
    visualMap: {
      min: -2,
      max: 3,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
    },
    series: [{
      type: 'heatmap',
      data,
      label: { show: true, formatter: params => (params.value[2] ? params.value[2].toFixed(1) : '') },
      emphasis: { focus: 'series' },
    }],
  };
}

export function scatterOption({ points, xLabel, yLabel }) {
  return {
    tooltip: { trigger: 'item', formatter: ({ value }) => `${xLabel}: ${value[0]}<br/>${yLabel}: ${value[1]}` },
    grid: makeGrid(),
    xAxis: { type: 'value', name: xLabel },
    yAxis: { type: 'value', name: yLabel },
    series: [{ type: 'scatter', symbolSize: 10, data: points }],
  };
}
