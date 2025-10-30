import dayjs from 'dayjs';
import { DateUtils } from './dateUtils.service';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import isBetween from 'dayjs/plugin/isBetween';

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isBetween);

const mockDayjs = (dateString) => {
  return dayjs(dateString || '2023-12-01T00:00:00.000Z'); // Replace the date with any desired testing date
};

const holidayMock = [
  {
    date: '2022-12-25',
  },
  {
    date: '2023-1-1',
  },
  {
    date: '2023-1-26',
  },
];

describe('DateUtils', () => {
  it('gets date in IST if date is provided', () => {
    const currentDateInIst = DateUtils.getDateInIst();
    expect(currentDateInIst.isValid()).toBeTruthy();
  });

  it('returns current date and time in IST if no date is provided', () => {
    const currentDateInIst = DateUtils.getDateInIst();
    const mockDate = dayjs();
    expect(currentDateInIst.isSameOrBefore(mockDate)).toBeTruthy();
  });

  it(`should return a different date if given date is a holiday`, () => {
    const givenDate = DateUtils.getDateInIst('2022-12-31');
    const newDate = DateUtils.getNonHolidayDate(givenDate, holidayMock);
    expect(newDate !== givenDate).toBeTruthy();
  });

  it(`should return the same date if given date is not a holiday`, () => {
    const givenDate = DateUtils.getDateInIst('2022-12-30');
    const newDate = DateUtils.getNonHolidayDate(givenDate, holidayMock);
    expect(newDate === givenDate).toBeTruthy();
  });

  it('handle if provided date is invalid', () => {
    const currentDateInIst = DateUtils.getDateInIst('invalid-date');
    const mockDate = dayjs();
    expect(currentDateInIst.isSameOrBefore(mockDate)).toBeFalsy();
  });

  it('converts given date to IST and into the given format for the default format i.e DD/MM/YYYY', () => {
    const date = '2024-02-01';
    const expectedFormat = 'YYYY/MM/DD';

    const result = DateUtils.getDateWithFormatInIst(date, expectedFormat);

    // Check if the result is a valid Dayjs object
    expect(result.isValid()).toBeTruthy();
  });

  it('converts given date to IST and into the given format provided', () => {
    const expectedValue = DateUtils.getDateWithFormatInIst(
      '2024-01-30',
      'YYYY/MM/DD',
    );
    expect(expectedValue.format('YYYY/MM/DD')).toEqual('2024/01/30');
  });

  it('calculates the difference between two dates in days', () => {
    const date1 = new Date('2024-01-30T12:00:00Z');
    const date2 = new Date('2024-01-20T12:00:00Z');
    const diffDays = DateUtils.calculateDiff(date1, date2, 'days');
    expect(diffDays).toEqual(10);
  });

  it('calculates the difference between two dates in months', () => {
    const date1 = new Date('2024-12-30T12:00:00Z');
    const date2 = new Date('2024-01-20T12:00:00Z');
    const diffMonths = DateUtils.calculateDiff(date1, date2, 'months');
    expect(diffMonths).toEqual(11);
  });

  it('checks if a given date is a weekend', () => {
    const weekendDate = DateUtils.getDateInIst('2024-01-28'); // Saturday
    expect(DateUtils.isWeekend(weekendDate)).toBeTruthy();
  });

  it('checks if a given date is not a weekend', () => {
    const weekdayDate = DateUtils.getDateInIst('2024-01-26'); // Friday
    expect(DateUtils.isWeekend(weekdayDate)).toBeFalsy();
  });

  it('checks if a given date exists in the list of holidays', () => {
    const investmentDate = DateUtils.getDateInIst('2024-01-25');
    const holidays = [
      { date: '2024-01-25' },
      { date: '2024-01-26' },
      { date: '2024-02-01' },
    ];
    const existsInHolidays = DateUtils.checkInvestmentDateExistsInHolidays(
      investmentDate,
      holidays,
    );
    expect(existsInHolidays).toBeTruthy();
  });

  it('checks if a given date does not exist in the list of holidays', () => {
    const investmentDate = DateUtils.getDateInIst('2024-01-30');
    const holidays = [{ date: '2024-01-31' }, { date: '2024-02-01' }];
    const existsInHolidays = DateUtils.checkInvestmentDateExistsInHolidays(
      investmentDate,
      holidays,
    );
    expect(existsInHolidays).toBeFalsy();
  });

  it('checks if a date is the second Saturday of the month', () => {
    const secondSaturday = DateUtils.getDateInIst('2024-02-10'); // Second Saturday
    expect(DateUtils.isDataSecondOrFourthSaturday(secondSaturday)).toBeTruthy();
  });

  it('checks if a date is not the second Saturday of the month', () => {
    const nonSecondSaturday = DateUtils.getDateInIst('2024-02-11'); // Not a second Saturday
    expect(
      DateUtils.isDataSecondOrFourthSaturday(nonSecondSaturday),
    ).toBeFalsy();
  });

  it('checks if a date is a national holiday', () => {
    const nationalHoliday = DateUtils.getDateInIst('2024-01-26'); // Republic Day
    expect(DateUtils.isNationalHoliday(nationalHoliday)).toBeTruthy();
  });

  it('checks if a date is not a national holiday', () => {
    const nonNationalHoliday = DateUtils.getDateInIst('2024-02-14'); // Non-National Holiday
    expect(DateUtils.isNationalHoliday(nonNationalHoliday)).toBeFalsy();
  });

  it('checks if a date is within 7 days from the current date', () => {
    const within7Days = DateUtils.getDateInIst().add(6, 'days');
    expect(DateUtils.isDateWithinRange(within7Days, '7days')).toBeTruthy();
  });

  it('checks if a date is not within 7 days from the current date', () => {
    const beyond7Days = DateUtils.getDateInIst().add(8, 'days');
    expect(DateUtils.isDateWithinRange(beyond7Days, '7days')).toBeFalsy();
  });

  it('checks if a date is within 14 days from the current date', () => {
    const within14Days = DateUtils.getDateInIst().add(13, 'days');
    expect(DateUtils.isDateWithinRange(within14Days, '14days')).toBeTruthy();
  });

  it('checks if a date is not within 14 days from the current date', () => {
    const beyond14Days = DateUtils.getDateInIst().add(15, 'days');
    expect(DateUtils.isDateWithinRange(beyond14Days, '14days')).toBeFalsy();
  });

  it('checks if a date is within the current month', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-02-01T00:00:00'));
    const thisMonth = DateUtils.getDateInIst('2024/02/28').add(1, 'days');
    expect(DateUtils.isDateWithinRange(thisMonth, 'thismonth')).toBeTruthy();
    jest.useRealTimers();
  });

  it('checks if a date is not within the current month', () => {
    const nextMonth = DateUtils.getDateInIst().add(1, 'month');
    expect(DateUtils.isDateWithinRange(nextMonth, 'thismonth')).toBeFalsy();
  });

  it('checks if a date is within the next month', () => {
    const nextMonth = DateUtils.getDateInIst().add(1, 'month');
    expect(DateUtils.isDateWithinRange(nextMonth, 'nextmonth')).toBeTruthy();
  });

  it('date is within the next month and next year, should return false', () => {
    const nextMonth = DateUtils.getDateInIst().add(1, 'month').add(1, 'year');
    expect(DateUtils.isDateWithinRange(nextMonth, 'nextmonth')).toBeFalsy();
  });

  it('checks if a date is not within the next month', () => {
    const beyondNextMonth = DateUtils.getDateInIst().add(2, 'months');
    expect(
      DateUtils.isDateWithinRange(beyondNextMonth, 'nextmonth'),
    ).toBeFalsy();
  });

  it('checks if a date is within the next 6 months', () => {
    const next6Months = DateUtils.getDateInIst().add(6, 'months');
    expect(DateUtils.isDateWithinRange(next6Months, 'next6month')).toBeTruthy();
  });

  it('checks if a date is not within the next 6 months', () => {
    const beyondNext6Months = DateUtils.getDateInIst().add(8, 'months');
    expect(
      DateUtils.isDateWithinRange(beyondNext6Months, 'next6month'),
    ).toBeFalsy();
  });

  it('checks if an asset is active based on start and end dates', () => {
    const activeAsset = DateUtils.isAssetActive('2024-01-30', '2024-02-28');
    expect(activeAsset).toBeTruthy();
  });

  it('checks if an asset is not active based on end date', () => {
    const inactiveAsset = DateUtils.isAssetActive('2027-01-30', '2024-01-30');
    expect(inactiveAsset).toBeFalsy();
  });

  it('returns a list of upcoming holidays within a specified date range', () => {
    const fromDate = mockDayjs('2023-01-31T00:00:00.000Z');
    const toDate = mockDayjs('2023-02-29T00:00:00.000Z');
    const holidays = [
      { date: '2023-02-05', festival: 'holiday1' },
      { date: '2023-02-10', festival: 'holiday2' },
      { date: '2023-04-15', festival: 'holiday3' },
    ];
    const upcomingHolidays = DateUtils.upcomingHoliday(
      holidays,
      fromDate,
      toDate,
    );
    expect(upcomingHolidays).toHaveLength(2);
  });

  it('should return an empty array if there are no upcoming holidays', () => {
    const from = mockDayjs('2023-01-01T00:00:00.000Z');
    const to = mockDayjs('2023-01-31T00:00:00.000Z');
    const holidayList: any = [
      { date: '2023-12-25', name: 'Christmas' },
      { date: '2023-12-31', name: 'New Year' },
      { date: '2024-01-01', name: 'New Year' },
    ];
    const result = DateUtils.upcomingHoliday(holidayList, from, to);

    expect(result).toEqual([]);
  });

  it('calculates T+1 day for an investment date with holidays', () => {
    const holidays = [
      { date: '2024-02-05' },
      { date: '2024-02-10' },
      { date: '2024-02-15' },
    ];
    const tPlus1Day = DateUtils.calculateTplus1day(holidays, '2024-02-04');
    expect(tPlus1Day).toEqual('2024-02-06T00:00:00+05:30');
  });

  it('calculates T+2 days for an investment date with holidays', () => {
    const holidays = [
      { date: '2024-02-05' },
      { date: '2024-02-10' },
      { date: '2024-02-15' },
    ];
    const investmentDate = '2024-02-04';
    const result = DateUtils.calculateTplus2days(holidays, investmentDate);
    expect(result).toEqual('2024-02-07T00:00:00+05:30');
  });

  it('calculates T+N days for an investment date with holidays', () => {
    const holidays = [
      { date: '2024-02-05' },
      { date: '2024-02-10' },
      { date: '2024-02-15' },
    ];
    const investmentDate = '2024-02-04';
    const result = DateUtils.calculateTplusNdays(
      holidays,
      investmentDate,
      3,
      false,
    );
    expect(result).toEqual('2024-02-09T00:00:00+05:30');
  });
  it('checks if date1 is before date2', () => {
    const date1 = '2024-01-30';
    const date2 = '2024-02-01';
    expect(DateUtils.isBefore(date1, date2)).toBeTruthy();
  });

  it('checks if date1 is not before date2', () => {
    const date1 = '2024-02-01';
    const date2 = '2024-01-30';
    expect(DateUtils.isBefore(date1, date2)).toBeFalsy();
  });

  it('checks if a date is a valid date in the given format', () => {
    const validDate = '2024/01/30';
    const invalidDate = '30/01/2024';
    expect(DateUtils.isValidDate(validDate, 'YYYY/MM/DD')).toBeTruthy();
    expect(DateUtils.isValidDate(invalidDate, 'YYYY/MM/DD')).toBeFalsy();
  });

  it('checks if date of birth is greater than 18 years', () => {
    const dob = '2002-05-04';
    expect(DateUtils.isDobGreaterThan18Years(dob)).toBeTruthy();
  });

  it('checks if date of birth is not greater than 18 years', () => {
    const dob = '2024/01/01';
    expect(DateUtils.isDobGreaterThan18Years(dob)).toBeFalsy();
  });

  it('should correctly extract date parts from a valid DD/MM/YYYY string', () => {
    const result = DateUtils.extractDateParts('27/04/2023');
    expect(result).toEqual({ year: 2023, month: 4, day: 27 });
  });

  it('should return response for iso formatted date strings', () => {
    const result = DateUtils.extractDateParts('2023-04-27'); // ISO format
    expect(result).toEqual({ day: 27, month: 4, year: 2023 });
  });

  it('should handle edge cases like leap years correctly', () => {
    const result = DateUtils.extractDateParts('29/02/2020'); // Valid leap year date
    expect(result).toEqual({ year: 2020, month: 2, day: 29 });
  });

  it('getTimeInCronFormat', async () => {
    expect(DateUtils.getTimeInCronFormat('2024-02-15')).toEqual({
      dd: 15,
      hh: 0,
      mm: '02',
      mn: 0,
      yy: '2024',
    });
  });

  it('getTimeInCronFormat for hr greated than 24', async () => {
    expect(DateUtils.getTimeInCronFormat('2024-02-15 26:00:01')).toEqual({
      dd: 16,
      hh: 2,
      mm: '02',
      mn: 0,
      yy: '2024',
    });
  });

  // Test cases for missing functions

  it('gets date string in IST with default format', () => {
    const result = DateUtils.getDateStringInIst();
    expect(typeof result).toBe('string');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD format
  });

  it('gets date string in IST with custom format', () => {
    const result = DateUtils.getDateStringInIst('15/01/2024', 'DD/MM/YYYY');
    expect(result).toBe('15/01/2024');
  });

  it('gets date string in IST with different output format', () => {
    const result = DateUtils.getDateStringInIst('15/01/2024', 'YYYY-MM-DD');
    expect(result).toBe('2024-01-15');
  });

  it('gets date string in IST with empty date parameter', () => {
    const result = DateUtils.getDateStringInIst('', 'YYYY/MM/DD');
    expect(typeof result).toBe('string');
    expect(result).toMatch(/^\d{4}\/\d{2}\/\d{2}$/); // YYYY/MM/DD format
  });

  it('checks if a given date is a MF weekend (Sunday)', () => {
    const sundayDate = DateUtils.getDateInIst('2024-01-28'); // Sunday
    expect(DateUtils.isMFWeekend(sundayDate)).toBeTruthy();
  });

  it('checks if a given date is not a MF weekend (Saturday)', () => {
    const saturdayDate = DateUtils.getDateInIst('2024-01-27'); // Saturday
    expect(DateUtils.isMFWeekend(saturdayDate)).toBeFalsy();
  });

  it('checks if a given date is not a MF weekend (Monday)', () => {
    const mondayDate = DateUtils.getDateInIst('2024-01-29'); // Monday
    expect(DateUtils.isMFWeekend(mondayDate)).toBeFalsy();
  });

  it('returns a non MF weekend date after given date', () => {
    const givenDate = DateUtils.getDateInIst('2024-01-28'); // Sunday
    const newDate = DateUtils.getNonMFWeekendDate(givenDate, holidayMock);
    expect(newDate !== givenDate).toBeTruthy();
    expect(DateUtils.isMFWeekend(newDate)).toBeFalsy();
  });

  it('returns the same date if given date is not a MF weekend', () => {
    const givenDate = DateUtils.getDateInIst('2024-01-29'); // Monday
    const newDate = DateUtils.getNonMFWeekendDate(givenDate, holidayMock);
    expect(newDate === givenDate).toBeTruthy();
  });

  it('returns a non MF weekend date with limit parameter', () => {
    const givenDate = DateUtils.getDateInIst('2024-01-28'); // Sunday
    const newDate = DateUtils.getNonMFWeekendDate(givenDate, holidayMock, true);
    expect(newDate !== givenDate).toBeTruthy();
    expect(DateUtils.isMFWeekend(newDate)).toBeFalsy();
  });

  it('calculates T+1 MF day for an investment date with holidays', () => {
    const holidays = [
      { date: '2024-02-05' },
      { date: '2024-02-10' },
      { date: '2024-02-15' },
    ];
    const tPlus1MFDay = DateUtils.calculateTplus1MFDay(holidays, '2024-02-04');
    expect(tPlus1MFDay).toEqual('2024-02-06T00:00:00+05:30');
  });

  it('calculates T+1 MF day with limitNonHolidayDate parameter', () => {
    const holidays = [
      { date: '2024-02-05' },
      { date: '2024-02-10' },
      { date: '2024-02-15' },
    ];
    const tPlus1MFDay = DateUtils.calculateTplus1MFDay(holidays, '2024-02-04', true);
    expect(tPlus1MFDay).toEqual('2024-02-06T00:00:00+05:30');
  });

  it('calculates T+N days for MF with holidays', () => {
    const holidays = [
      { date: '2024-02-05' },
      { date: '2024-02-10' },
      { date: '2024-02-15' },
    ];
    const investmentDate = '2024-02-04';
    const result = DateUtils.calculateTplusNDaysForMF(
      holidays,
      investmentDate,
      3,
      false,
    );
    expect(result).toEqual('2024-02-09T00:00:00+05:30');
  });

  it('calculates T+N days for MF with limitNonHolidayDate parameter', () => {
    const holidays = [
      { date: '2024-02-05' },
      { date: '2024-02-10' },
      { date: '2024-02-15' },
    ];
    const investmentDate = '2024-02-04';
    const result = DateUtils.calculateTplusNDaysForMF(
      holidays,
      investmentDate,
      3,
      true,
    );
    expect(result).toEqual('2024-02-09T00:00:00+05:30');
  });

  it('formats time from 24-hour to 12-hour format', () => {
    expect(DateUtils.formatTime('14:30')).toBe('2:30 PM');
    expect(DateUtils.formatTime('09:15')).toBe('9:15 AM');
    expect(DateUtils.formatTime('23:45')).toBe('11:45 PM');
    expect(DateUtils.formatTime('00:00')).toBe('12:00 AM');
    expect(DateUtils.formatTime('12:00')).toBe('12:00 PM');
  });

  it('formats time with single digit minutes', () => {
    expect(DateUtils.formatTime('14:05')).toBe('2:05 PM');
    expect(DateUtils.formatTime('09:09')).toBe('9:09 AM');
  });

  it('formats date for OBPP display', () => {
    expect(DateUtils.formatDateOBPP('2024-01-15T10:30:00Z')).toBe('15 Jan');
    expect(DateUtils.formatDateOBPP('2024-12-25T15:45:00Z')).toBe('25 Dec');
    expect(DateUtils.formatDateOBPP('2024-03-01T08:00:00Z')).toBe('1 Mar');
  });

  it('formats date with default format', () => {
    const date = new Date('2024-01-15');
    expect(DateUtils.formatDate(date)).toBe('2024-01-15');
  });

  it('formats date with custom format', () => {
    const date = new Date('2024-01-15');
    expect(DateUtils.formatDate(date, 'DD/MM/YYYY')).toBe('15/01/2024');
    expect(DateUtils.formatDate(date, 'YYYY/MM/DD')).toBe('2024/01/15');
  });

  it('formats date string with custom format', () => {
    const dateString = '2024-01-15';
    expect(DateUtils.formatDate(dateString, 'DD/MM/YYYY')).toBe('15/01/2024');
  });

  it('checks if two dates are the same', () => {
    const date1 = '2024-01-15';
    const date2 = '2024-01-15';
    expect(DateUtils.checkIfDatesAreSame(date1, date2)).toBeTruthy();
  });

  it('checks if two dates are not the same', () => {
    const date1 = '2024-01-15';
    const date2 = '2024-01-16';
    expect(DateUtils.checkIfDatesAreSame(date1, date2)).toBeFalsy();
  });

  it('checks if two dates are the same with Dayjs objects', () => {
    const date1 = DateUtils.getDateInIst('2024-01-15');
    const date2 = DateUtils.getDateInIst('2024-01-15');
    expect(DateUtils.checkIfDatesAreSame(date1, date2)).toBeTruthy();
  });

  it('checks if two dates are the same with mixed types', () => {
    const date1 = '2024-01-15';
    const date2 = DateUtils.getDateInIst('2024-01-15');
    expect(DateUtils.checkIfDatesAreSame(date1, date2)).toBeTruthy();
  });

  it('checks if T1 is less than T2', () => {
    const T1 = DateUtils.getDateInIst('2024-01-15T10:30:00');
    const T2 = DateUtils.getDateInIst('2024-01-15T14:30:00');
    expect(DateUtils.isT1LessThanT2(T1, T2)).toBeTruthy();
  });

  it('checks if T1 is not less than T2', () => {
    const T1 = DateUtils.getDateInIst('2024-01-15T16:30:00');
    const T2 = DateUtils.getDateInIst('2024-01-15T14:30:00');
    expect(DateUtils.isT1LessThanT2(T1, T2)).toBeFalsy();
  });

  it('checks if T1 equals T2', () => {
    const T1 = DateUtils.getDateInIst('2024-01-15T14:30:00');
    const T2 = DateUtils.getDateInIst('2024-01-15T14:30:00');
    expect(DateUtils.isT1LessThanT2(T1, T2)).toBeFalsy();
  });

  it('checks if date is not same or tomorrow - different date', () => {
    const futureDate = DateUtils.getDateInIst().add(5, 'days');
    expect(DateUtils.checkIfDateInNotSameOrTomorrow(futureDate)).toBeTruthy();
  });

  it('checks if date is not same or tomorrow - same date', () => {
    const today = DateUtils.getDateInIst();
    expect(DateUtils.checkIfDateInNotSameOrTomorrow(today)).toBeFalsy();
  });

  it('checks if date is not same or tomorrow - tomorrow', () => {
    const tomorrow = DateUtils.getDateInIst().add(1, 'day');
    expect(DateUtils.checkIfDateInNotSameOrTomorrow(tomorrow)).toBeFalsy();
  });

  it('checks if date is not same or tomorrow - past date', () => {
    const pastDate = DateUtils.getDateInIst().subtract(5, 'days');
    expect(DateUtils.checkIfDateInNotSameOrTomorrow(pastDate)).toBeTruthy();
  });

  it('checks if date is not same or tomorrow with string input', () => {
    const futureDateString = DateUtils.getDateInIst().add(5, 'days').format('YYYY-MM-DD');
    expect(DateUtils.checkIfDateInNotSameOrTomorrow(futureDateString)).toBeTruthy();
  });
});
