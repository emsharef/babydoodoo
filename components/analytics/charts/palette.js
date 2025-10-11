export const categorical = ['#4f7cff', '#40c4a2', '#ff9f6e', '#d06bff', '#72d1ff', '#ffd166', '#ef476f', '#06d6a0'];
export const soft = ['#bed3ff', '#c7f0d8', '#ffe3c3', '#e7d1ff', '#c6f0ff', '#fff2b3'];

export function colorAt(index, palette = categorical) {
  return palette[index % palette.length];
}
