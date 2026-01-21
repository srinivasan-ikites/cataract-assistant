import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Calendar, X, ChevronDown } from 'lucide-react';

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minDate?: string;
  maxDate?: string;
  disabled?: boolean;
  yearRange?: { start: number; end: number };
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  placeholder = 'Select date',
  className = '',
  minDate,
  maxDate,
  disabled = false,
  yearRange = { start: 1920, end: new Date().getFullYear() + 10 },
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    if (value) return new Date(value);
    return new Date();
  });
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 320 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const yearScrollRef = useRef<HTMLDivElement>(null);

  // Calculate dropdown position
  const updateDropdownPosition = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const dropdownHeight = 380; // Approximate height of dropdown
      const viewportHeight = window.innerHeight;

      // Check if dropdown would go below viewport
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      let top = rect.bottom + 8; // 8px gap below input

      // If not enough space below but more space above, show above
      if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
        top = rect.top - dropdownHeight - 8;
      }

      setDropdownPosition({
        top: Math.max(8, top), // Ensure at least 8px from top
        left: rect.left,
        width: Math.max(320, rect.width),
      });
    }
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setShowYearPicker(false);
        setShowMonthPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update position on scroll/resize
  useEffect(() => {
    if (isOpen) {
      updateDropdownPosition();

      const handleScrollOrResize = () => {
        updateDropdownPosition();
      };

      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);

      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
      };
    }
  }, [isOpen]);

  // Update view when value changes
  useEffect(() => {
    if (value) {
      setViewDate(new Date(value));
    }
  }, [value]);

  // Scroll to current year when year picker opens
  useEffect(() => {
    if (showYearPicker && yearScrollRef.current) {
      const currentYear = viewDate.getFullYear();
      const yearElement = yearScrollRef.current.querySelector(`[data-year="${currentYear}"]`);
      if (yearElement) {
        yearElement.scrollIntoView({ block: 'center', behavior: 'instant' });
      }
    }
  }, [showYearPicker, viewDate]);

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const isDateDisabled = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    if (minDate && dateStr < minDate) return true;
    if (maxDate && dateStr > maxDate) return true;
    return false;
  };

  const handleSelectDate = (day: number) => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const selected = new Date(year, month, day);

    if (isDateDisabled(selected)) return;

    const formatted = selected.toISOString().split('T')[0];
    onChange(formatted);
    setIsOpen(false);
  };

  const handleSelectYear = (year: number) => {
    setViewDate(new Date(year, viewDate.getMonth(), 1));
    setShowYearPicker(false);
  };

  const handleSelectMonth = (month: number) => {
    setViewDate(new Date(viewDate.getFullYear(), month, 1));
    setShowMonthPicker(false);
  };

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
  };

  const handleOpen = () => {
    if (!disabled) {
      updateDropdownPosition();
      setIsOpen(!isOpen);
    }
  };

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const selectedDate = value ? new Date(value) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Generate calendar grid
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  // Generate year options
  const years: number[] = [];
  for (let y = yearRange.end; y >= yearRange.start; y--) {
    years.push(y);
  }

  // Calendar dropdown content
  const dropdownContent = isOpen ? (
    <div
      ref={dropdownRef}
      className="fixed bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
      style={{
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        width: dropdownPosition.width,
        zIndex: 99999,
      }}
    >
      {/* Header with Year/Month Selection */}
      <div className="px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          >
            <ChevronLeft size={18} className="text-white" />
          </button>

          {/* Month/Year Selectors */}
          <div className="flex items-center gap-2">
            {/* Month Selector */}
            <button
              type="button"
              onClick={() => {
                setShowMonthPicker(!showMonthPicker);
                setShowYearPicker(false);
              }}
              className="flex items-center gap-1 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
            >
              <span className="text-white font-bold text-sm">{MONTHS_SHORT[month]}</span>
              <ChevronDown size={14} className="text-white/80" />
            </button>

            {/* Year Selector */}
            <button
              type="button"
              onClick={() => {
                setShowYearPicker(!showYearPicker);
                setShowMonthPicker(false);
              }}
              className="flex items-center gap-1 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
            >
              <span className="text-white font-bold text-sm">{year}</span>
              <ChevronDown size={14} className="text-white/80" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          >
            <ChevronRight size={18} className="text-white" />
          </button>
        </div>
      </div>

      {/* Year Picker Overlay */}
      {showYearPicker && (
        <div className="bg-white">
          <div
            ref={yearScrollRef}
            className="h-[280px] overflow-y-auto p-3 grid grid-cols-4 gap-2 content-start"
          >
            {years.map((y) => (
              <button
                key={y}
                type="button"
                data-year={y}
                onClick={() => handleSelectYear(y)}
                className={`
                  py-2.5 rounded-xl text-sm font-semibold transition-all
                  ${y === year
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md'
                    : y === today.getFullYear()
                      ? 'bg-blue-50 text-blue-600 border-2 border-blue-200'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }
                `}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Month Picker Overlay */}
      {showMonthPicker && (
        <div className="bg-white">
          <div className="p-4 grid grid-cols-3 gap-2">
            {MONTHS.map((m, idx) => (
              <button
                key={m}
                type="button"
                onClick={() => handleSelectMonth(idx)}
                className={`
                  py-3 rounded-xl text-sm font-semibold transition-all
                  ${idx === month
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md'
                    : idx === today.getMonth() && year === today.getFullYear()
                      ? 'bg-blue-50 text-blue-600 border-2 border-blue-200'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }
                `}
              >
                {MONTHS_SHORT[idx]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Day Names */}
      {!showYearPicker && !showMonthPicker && (
        <>
          <div className="grid grid-cols-7 px-3 pt-3 pb-1">
            {DAYS.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-bold text-slate-400 py-1"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 px-3 pb-3">
            {calendarDays.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="h-9" />;
              }

              const currentDate = new Date(year, month, day);
              const isSelected =
                selectedDate &&
                selectedDate.getDate() === day &&
                selectedDate.getMonth() === month &&
                selectedDate.getFullYear() === year;
              const isToday =
                today.getDate() === day &&
                today.getMonth() === month &&
                today.getFullYear() === year;
              const isDisabled = isDateDisabled(currentDate);

              return (
                <button
                  key={`day-${day}`}
                  type="button"
                  onClick={() => handleSelectDate(day)}
                  disabled={isDisabled}
                  className={`
                    h-9 w-full rounded-lg text-sm font-semibold transition-all
                    ${isSelected
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md'
                      : isToday
                        ? 'bg-blue-50 text-blue-600 border-2 border-blue-200'
                        : isDisabled
                          ? 'text-slate-300 cursor-not-allowed'
                          : 'text-slate-700 hover:bg-slate-100'
                    }
                  `}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
            <button
              type="button"
              onClick={() => {
                const todayStr = new Date().toISOString().split('T')[0];
                if (!isDateDisabled(new Date())) {
                  onChange(todayStr);
                  setIsOpen(false);
                }
              }}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700"
            >
              Close
            </button>
          </div>
        </>
      )}
    </div>
  ) : null;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input Button */}
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between gap-2
          bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5
          text-sm font-medium text-slate-700
          outline-none transition-all
          ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'hover:border-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 cursor-pointer'}
          ${isOpen ? 'border-blue-400 ring-2 ring-blue-50' : ''}
        `}
      >
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-slate-400" />
          <span className={value ? 'text-slate-700' : 'text-slate-400'}>
            {value ? formatDisplayDate(value) : placeholder}
          </span>
        </div>
        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={14} className="text-slate-400" />
          </button>
        )}
      </button>

      {/* Render dropdown using portal to escape overflow constraints */}
      {createPortal(dropdownContent, document.body)}
    </div>
  );
};

export default DatePicker;
