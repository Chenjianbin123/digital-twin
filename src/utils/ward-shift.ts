export interface NursingShift {
  id: 'day' | 'evening' | 'night';
  label: string;
  range: string;
}

const WEEK_DAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

export function getNursingShift(date = new Date()): NursingShift {
  const h = date.getHours();
  if (h >= 8 && h < 16)
    return { id: 'day', label: '白班', range: '08:00 – 16:00' };
  if (h >= 16 && h < 24)
    return { id: 'evening', label: '小夜班', range: '16:00 – 24:00' };
  return { id: 'night', label: '大夜班', range: '00:00 – 08:00' };
}

export function formatWardClock(date = new Date()) {
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return {
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    weekDay: WEEK_DAYS[date.getDay()],
  };
}
