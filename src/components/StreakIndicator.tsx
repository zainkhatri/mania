import React, { useState, useEffect } from 'react';
import { addDays, isSameDay, parseISO } from 'date-fns';

const getStreakInfo = (calendarData: { date: string; count: number }[]) => {
  if (calendarData.length === 0) return { currentStreak: 0 };

  const sortedDates = calendarData
    .filter(d => d.count > 0)
    .map(d => parseISO(d.date))
    .sort((a, b) => a.getTime() - b.getTime());

  if (sortedDates.length === 0) return { currentStreak: 0 };

  let currentStreak = 0;
  const today = new Date();

  // Check if the most recent journal is from today or yesterday for current streak
  const mostRecentDate = sortedDates[sortedDates.length - 1];
  const isCurrentStreak = isSameDay(mostRecentDate, today) || 
                         isSameDay(mostRecentDate, addDays(today, -1));

  if (isCurrentStreak) {
    // Find current streak by walking backward from most recent
    currentStreak = 1;
    for (let i = sortedDates.length - 2; i >= 0; i--) {
      const diffInDays = Math.round(
        (sortedDates[i + 1].getTime() - sortedDates[i].getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diffInDays === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  return { currentStreak };
};

const StreakIndicator: React.FC = () => {
  const [calendarData, setCalendarData] = useState<{ date: string; count: number }[]>([]);
  const [streakInfo, setStreakInfo] = useState<{ currentStreak: number }>({ currentStreak: 0 });

  useEffect(() => {
    // Load journal data from localStorage
    const journals = JSON.parse(localStorage.getItem('journals') || '[]');
    const dateCounts = new Map<string, number>();
    journals.forEach((journal: any) => {
      try {
        const dateStr = journal.date.split('T')[0];
        const currentCount = dateCounts.get(dateStr) || 0;
        dateCounts.set(dateStr, currentCount + 1);
      } catch (error) {}
    });
    const data: { date: string; count: number }[] = [];
    dateCounts.forEach((count, date) => {
      data.push({ date, count });
    });
    setCalendarData(data);
    setStreakInfo(getStreakInfo(data));
  }, []);

  return (
    <span
      className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-black/80 backdrop-blur-sm border border-yellow-500/50 shadow-md text-yellow-400 text-base font-semibold select-none"
      title={streakInfo.currentStreak > 0 ? `${streakInfo.currentStreak}-day streak` : 'No streak yet'}
    >
      <span role="img" aria-label="fire" className="text-lg">🔥</span>
      {streakInfo.currentStreak > 0 ? `${streakInfo.currentStreak}-day streak` : 'No streak'}
    </span>
  );
};

export default StreakIndicator; 