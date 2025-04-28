import React, { useEffect, useState } from 'react';
import { format, parseISO, subYears, addDays, startOfWeek, getWeek, getDay, isSameDay } from 'date-fns';

interface CalendarData {
  date: string;
  count: number;
}

interface JournalCalendarProps {
  className?: string;
}

const JournalCalendar: React.FC<JournalCalendarProps> = ({ className = '' }) => {
  const [calendarData, setCalendarData] = useState<CalendarData[]>([]);
  const [maxCount, setMaxCount] = useState(0);
  const [totalContributions, setTotalContributions] = useState(0);
  
  // Load journal data when component mounts
  useEffect(() => {
    const loadJournalData = () => {
      try {
        // Get journal entries from localStorage
        const journals = JSON.parse(localStorage.getItem('journals') || '[]');
        
        // Create a map of dates to counts
        const dateCounts = new Map<string, number>();
        
        journals.forEach((journal: any) => {
          try {
            // Get the date in YYYY-MM-DD format
            const dateStr = journal.date.split('T')[0];
            
            // Increment the count for this date
            const currentCount = dateCounts.get(dateStr) || 0;
            dateCounts.set(dateStr, currentCount + 1);
          } catch (error) {
            console.error("Error processing journal date", error);
          }
        });
        
        // Convert the map to the format needed for the calendar
        const data: CalendarData[] = [];
        let maxValue = 0;
        let totalCount = 0;
        
        dateCounts.forEach((count, date) => {
          data.push({ date, count });
          maxValue = Math.max(maxValue, count);
          totalCount += count;
        });
        
        setCalendarData(data);
        setMaxCount(maxValue || 4); // Default to 4 if no data
        setTotalContributions(totalCount);
      } catch (error) {
        console.error("Error loading journal data for calendar", error);
        setCalendarData([]);
      }
    };
    
    loadJournalData();
  }, []);
  
  // Generate the calendar grid for the last 12 months
  const generateCalendarCells = () => {
    const today = new Date();
    const oneYearAgo = subYears(today, 1);
    
    // Adjust to start at the beginning of the week
    const startDate = startOfWeek(oneYearAgo);
    
    // Calculate number of weeks
    const totalWeeks = Math.ceil((today.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
    
    const weeks = [];
    let currentDate = startDate;
    
    // For each week
    for (let weekIndex = 0; weekIndex < totalWeeks; weekIndex++) {
      const days = [];
      
      // For each day of the week (0-6, Sunday to Saturday)
      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        // Skip days before startDate
        if (weekIndex === 0 && dayIndex < getDay(startDate)) {
          days.push(<div key={`empty-${dayIndex}`} className="w-3 h-3 opacity-0"></div>);
          continue;
        }
        
        // Skip days after today
        if (currentDate > today) {
          days.push(<div key={`future-${weekIndex}-${dayIndex}`} className="w-3 h-3 opacity-0"></div>);
          continue;
        }
        
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        const dateData = calendarData.find(d => d.date === dateStr);
        const count = dateData ? dateData.count : 0;
        
        // Calculate intensity based on count relative to max
        let intensity = 0;
        if (count > 0) {
          // 5 levels of intensity (0-4)
          intensity = Math.min(4, Math.ceil((count / maxCount) * 4));
        }
        
        const intensityClass = [
          'bg-gray-800', // Level 0 (empty)
          'bg-[#e6dfd6]', // Level 1 (light)
          'bg-[#d7cec1]', // Level 2
          'bg-[#c8bfa9]', // Level 3
          'bg-[#b5a890]', // Level 4 (most intense)
        ][intensity];
        
        days.push(
          <div 
            key={`day-${dateStr}`} 
            className={`w-3 h-3 rounded-sm ${intensityClass} transition-colors`}
            title={`${format(parseISO(dateStr), 'MMM d, yyyy')}: ${count} journal${count !== 1 ? 's' : ''}`}
          />
        );
        
        currentDate = addDays(currentDate, 1);
      }
      
      weeks.push(
        <div key={`week-${weekIndex}`} className="flex flex-col gap-1">
          {days}
        </div>
      );
    }
    
    return weeks;
  };
  
  // Generate month labels
  const generateMonthLabels = () => {
    const today = new Date();
    const oneYearAgo = subYears(today, 1);
    
    const monthLabels = [];
    let currentDate = oneYearAgo;
    
    while (currentDate <= today) {
      // Only add label at the first day of the month
      if (currentDate.getDate() === 1 || currentDate.getTime() === oneYearAgo.getTime()) {
        const month = format(currentDate, 'MMM');
        monthLabels.push(
          <div 
            key={`month-${month}-${currentDate.getFullYear()}`} 
            className="text-xs text-gray-400"
            style={{ 
              position: 'absolute', 
              left: `${(getWeek(currentDate) - getWeek(oneYearAgo) + 1) * 16}px` 
            }}
          >
            {month}
          </div>
        );
      }
      
      currentDate = addDays(currentDate, 7); // Check every week
    }
    
    return monthLabels;
  };
  
  // Generate day of week labels
  const generateDayLabels = () => {
    const dayLabels = ['Mon', 'Wed', 'Fri'];
    return dayLabels.map((day, index) => (
      <div key={day} className="text-xs text-gray-400 h-3 flex items-center" style={{ gridRow: index * 2 + 1 }}>
        {day}
      </div>
    ));
  };
  
  const getStreakInfo = () => {
    if (calendarData.length === 0) return { currentStreak: 0, longestStreak: 0 };
    
    const sortedDates = calendarData
      .filter(d => d.count > 0)
      .map(d => parseISO(d.date))
      .sort((a, b) => a.getTime() - b.getTime());
    
    if (sortedDates.length === 0) return { currentStreak: 0, longestStreak: 0 };
    
    let currentStreak = 0;
    let longestStreak = 0;
    let consecutiveDays = 1;
    const today = new Date();
    
    // Check if the most recent journal is from today or yesterday for current streak
    const mostRecentDate = sortedDates[sortedDates.length - 1];
    const isCurrentStreak = isSameDay(mostRecentDate, today) || 
                           isSameDay(mostRecentDate, addDays(today, -1));
    
    // Calculate longest streak
    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = sortedDates[i - 1];
      const currDate = sortedDates[i];
      
      // Check if dates are consecutive
      const diffInDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffInDays === 1) {
        consecutiveDays++;
      } else {
        longestStreak = Math.max(longestStreak, consecutiveDays);
        consecutiveDays = 1;
      }
    }
    
    longestStreak = Math.max(longestStreak, consecutiveDays);
    
    // Set current streak
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
    
    return { currentStreak, longestStreak };
  };
  
  const { currentStreak, longestStreak } = getStreakInfo();
  
  return (
    <div className={`rounded-lg bg-[#f8f5f0] p-4 text-[#333333] ${className}`}>
      <h3 className="text-lg font-medium mb-3">{totalContributions} contributions in the last year</h3>
      
      <div className="flex mb-6">
        <div className="flex flex-col mr-4">
          {generateDayLabels()}
        </div>
        
        <div className="relative flex-1">
          <div className="flex gap-1 overflow-x-auto pb-6">
            {generateCalendarCells()}
          </div>
          
          <div className="absolute bottom-0 left-0 right-0">
            {generateMonthLabels()}
          </div>
        </div>
      </div>
      
      <div className="flex justify-between items-center text-xs border-t border-[#e6e0d8] pt-3">
        <div className="flex items-center">
          <span className="text-[#8a8a8a] mr-2">Less</span>
          <div className="flex items-center gap-1">
            {[0, 1, 2, 3, 4].map((level) => (
              <div 
                key={`level-${level}`} 
                className={`w-3 h-3 rounded-sm ${
                  level === 0 ? 'bg-[#eeeeee]' : 
                  level === 1 ? 'bg-[#e6dfd6]' : 
                  level === 2 ? 'bg-[#d7cec1]' : 
                  level === 3 ? 'bg-[#c8bfa9]' : 'bg-[#b5a890]'
                }`}
              />
            ))}
          </div>
          <span className="text-[#8a8a8a] ml-2">More</span>
        </div>
        
        <div className="flex gap-4">
          <div>
            <span className="text-[#8a8a8a]">Current streak:</span> <span className="text-[#333333] font-medium">{currentStreak} day{currentStreak !== 1 ? 's' : ''}</span>
          </div>
          <div>
            <span className="text-[#8a8a8a]">Longest streak:</span> <span className="text-[#333333] font-medium">{longestStreak} day{longestStreak !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JournalCalendar; 