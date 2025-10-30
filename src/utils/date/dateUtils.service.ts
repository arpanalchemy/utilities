import dayjs, { ConfigType, Dayjs } from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import isBetween from 'dayjs/plugin/isBetween';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isBetween);
dayjs.extend(customParseFormat);
dayjs.extend(relativeTime);

export class DateUtils {
  // returns complete object including both date and time
  static getDateInIst(date?: ConfigType): Dayjs {
    if (!date) return dayjs().tz('Asia/Kolkata');
    else return dayjs(date).tz('Asia/Kolkata');
  }

  static getDateStringInIst(date: string = '', format = 'YYYY-MM-DD'): string {
    if (date) return DateUtils.getDateWithFormatInIst(date).format(format);
    return dayjs().tz('Asia/Kolkata').format(format);
  }

  static getDateWithFormatInIst(
    date: ConfigType | string = '',
    format = 'DD/MM/YYYY',
  ): Dayjs {
    if (date) return dayjs(date, format).tz('Asia/Kolkata');
    else return dayjs(format).tz('Asia/Kolkata');
  }

  static calculateDiff(
    day1: Date,
    day2: Date | undefined,
    key: dayjs.OpUnitType,
  ): number {
    return dayjs(day1).diff(dayjs(day2), key);
  }

  /**
   * @description check if given date lies on a weekend or not (Saturday and Sunday)
   * @param date
   * @returns
   */
  static isWeekend(date: Dayjs): boolean {
    const day = date.day();
    return day === 0 || day === 6;
  }

  /**
   * @description check if given date lies on a MF weekend or not (Sunday)
   * @param date
   * @returns
   */
  static isMFWeekend(date: Dayjs): boolean {
    const day = date.day();
    return day === 0;
  }

  /**
   * @description checks if given date lies in holidays or not
   * @param investmentDate
   * @param holidays
   * @returns
   */

  static checkInvestmentDateExistsInHolidays<T>(
    investmentDate: Dayjs,
    holidays: T[],
  ) {
    return holidays.find((a) =>
      DateUtils.getDateInIst(a['date']).isSame(investmentDate, 'date'),
    );
  }

  /**
   * @summary returns a non holiday date after given date
   * @param date
   * @param holidays
   * @returns date
   */
  static getNonHolidayDate<T>(
    date: Dayjs,
    holidays: T[],
    limit: boolean = false,
  ): Dayjs {
    //creating new date so as to not modify the param we're getting
    let newDate = date;

    if (!limit) {
      while (
        DateUtils.isWeekend(newDate) ||
        DateUtils.checkInvestmentDateExistsInHolidays(newDate, holidays)
      ) {
        newDate = newDate.add(1, 'day');
      }
    } else {
      const fromDate = dayjs(newDate).subtract(1, 'day').startOf('day'); // Get the start of yesterday
      const toDate = fromDate.add(10, 'day'); // Get the date 10 days from now
      const upcomingHolidays: any = DateUtils.upcomingHoliday(
        holidays as unknown as T[],
        fromDate,
        toDate,
      );
      while (
        DateUtils.isWeekend(newDate) ||
        DateUtils.checkInvestmentDateExistsInHolidays(newDate, upcomingHolidays)
      ) {
        newDate = newDate.add(1, 'day');
      }
    }
    return newDate;
  }

  /**
   * @summary returns a non holiday date after given date
   * @param date
   * @param holidays
   * @returns date
   */
  static getNonMFWeekendDate<T>(
    date: Dayjs,
    holidays: T[],
    limit: boolean = false,
  ): Dayjs {
    //creating new date so as to not modify the param we're getting
    let newDate = date;

    if (!limit) {
      while (
        DateUtils.isMFWeekend(newDate) ||
        DateUtils.checkInvestmentDateExistsInHolidays(newDate, holidays)
      ) {
        newDate = newDate.add(1, 'day');
      }
    } else {
      const fromDate = dayjs(newDate).subtract(1, 'day').startOf('day'); // Get the start of yesterday
      const toDate = fromDate.add(10, 'day'); // Get the date 10 days from now
      const upcomingHolidays: any = DateUtils.upcomingHoliday(
        holidays as unknown as T[],
        fromDate,
        toDate,
      );
      while (
        DateUtils.isMFWeekend(newDate) ||
        DateUtils.checkInvestmentDateExistsInHolidays(newDate, upcomingHolidays)
      ) {
        newDate = newDate.add(1, 'day');
      }
    }
    return newDate;
  }

  static isDataSecondOrFourthSaturday(date) {
    const day = dayjs(date);
    if (day.date() > 7 && day.date() < 15 && day.day() === 6) {
      return true; //its a second saturday
    }
    if (day.date() > 21 && day.date() < 29 && day.day() === 6) {
      return true; //its a fourth saturday
    }
  }

  static isNationalHoliday(toCheck) {
    const day = dayjs(toCheck);
    return (
      (!day.month() && day.date() === 26) ||
      (day.month() === 7 && day.date() === 17) ||
      (day.month() === 9 && day.date() === 2) ||
      (day.month() === 11 && day.date() === 25)
    );
  }

  static isDateWithinRange(date, range) {
    if (range === '7days') {
      return date.diff(dayjs(), 'day') < 7;
    }
    if (range === '14days') {
      return date.diff(dayjs(), 'day') < 14;
    }
    if (range === 'thismonth') {
      return dayjs().isSame(date, 'month');
    }
    if (range === 'nextmonth') {
      const nextMonth = dayjs().add(1, 'month');
      return (
        dayjs(date).month() === nextMonth.month() &&
        dayjs(date).year() === nextMonth.year()
      );
    }
    if (range === 'next6month') {
      return dayjs(date).isBetween(
        dayjs().startOf('month'),
        dayjs().add(7, 'month').endOf('month'),
        null,
        '[]',
      );
    }
  }

  static isAssetActive(startDate: string, endDate: string) {
    const currentTime = dayjs().unix();
    return (
      dayjs(startDate).unix() <= currentTime ||
      dayjs(endDate).unix() > currentTime
    );
  }

  // give list of upcoming holiday where from is included and to is not
  static upcomingHoliday<T>(holidayList: T[], from: Dayjs, to: Dayjs): T[] {
    return holidayList.filter((holiday) => {
      const holidayDate = dayjs((holiday as any)?.date);
      return holidayDate.isSameOrAfter(from) && holidayDate.isBefore(to);
    });
  }

  static calculateTplus1day<T>(
    holidays: T[],
    date?: string,
    limitNonHolidayDate: boolean = false,
  ): string {
    const investmentDate = dayjs(date).add(1, 'day');
    if (limitNonHolidayDate) {
      return DateUtils.getNonHolidayDate(
        investmentDate,
        holidays,
        true,
      ).format(); // added limitNonHolidayDate for logic written in common service as it is different from other repos date utils helper
    }
    return DateUtils.getNonHolidayDate(investmentDate, holidays).format();
  }

  static calculateTplus1MFDay<T>(
    holidays: T[],
    date?: string,
    limitNonHolidayDate: boolean = false,
  ): string {
    const investmentDate = dayjs(date).add(1, 'day');
    if (limitNonHolidayDate) {
      return DateUtils.getNonMFWeekendDate(
        investmentDate,
        holidays,
        true,
      ).format(); // added limitNonHolidayDate for logic written in common service as it is different from other repos date utils helper
    }
    return DateUtils.getNonMFWeekendDate(investmentDate, holidays).format();
  }

  static calculateTplus2days<T>(
    holidays: T[],
    date: string,
    limitNonHolidayDate: boolean = false,
  ): string {
    let investmentDate = dayjs(date);
    for (let i = 0; i < 2; i++) {
      investmentDate = dayjs(investmentDate).add(1, 'day');
      if (limitNonHolidayDate) {
        investmentDate = DateUtils.getNonHolidayDate(
          investmentDate,
          holidays,
          true,
        ); // added limitNonHolidayDate for logic written in common service as it is different from other repos date utils helper
      } else {
        investmentDate = DateUtils.getNonHolidayDate(investmentDate, holidays);
      }
    }
    return dayjs(investmentDate).format();
  }

  static calculateTplusNdays<T>(
    holidays: T[],
    date: string,
    nDays: number,
    limitNonHolidayDate: boolean = false,
  ): string {
    let investmentDate = dayjs(date);
    investmentDate = DateUtils.getNonHolidayDate(
      // this becomes new T after removing all holidays and weekends
      investmentDate,
      holidays,
      limitNonHolidayDate,
    );
    for (let i = 0; i < nDays; i++) {
      // now we add nDays to the new T also checking if it is a holiday or weekend
      investmentDate = dayjs(investmentDate).add(1, 'day');
      if (limitNonHolidayDate) {
        investmentDate = DateUtils.getNonHolidayDate(
          investmentDate,
          holidays,
          true,
        ); // added limitNonHolidayDate for logic written in common service as it is different from other repos date utils helper
      } else {
        investmentDate = DateUtils.getNonHolidayDate(investmentDate, holidays);
      }
    }
    return dayjs(investmentDate).format();
  }

  static calculateTplusNDaysForMF<T>(
    holidays: T[],
    date: string,
    nDays: number,
    limitNonHolidayDate: boolean = false,
  ): string {
    let investmentDate = dayjs(date);
    investmentDate = DateUtils.getNonMFWeekendDate(
      // this becomes new T after removing all holidays and weekends
      investmentDate,
      holidays,
      limitNonHolidayDate,
    );
    for (let i = 0; i < nDays; i++) {
      // now we add nDays to the new T also checking if it is a holiday or weekend
      investmentDate = dayjs(investmentDate).add(1, 'day');
      if (limitNonHolidayDate) {
        investmentDate = DateUtils.getNonMFWeekendDate(
          investmentDate,
          holidays,
          true,
        ); // added limitNonHolidayDate for logic written in common service as it is different from other repos date utils helper
      } else {
        investmentDate = DateUtils.getNonMFWeekendDate(
          investmentDate,
          holidays,
        );
      }
    }
    return dayjs(investmentDate).format();
  }

  static isBefore(date1: string | Date, date2: string | Date): boolean {
    return dayjs(date1).isBefore(dayjs(date2));
  }

  static isValidDate(date: string, format: string): boolean {
    return dayjs(date, format, true).format(format) === date;
  }

  static isDobGreaterThan18Years(
    dob: string,
    format: string = 'YYYY/MM/DD',
  ): boolean {
    const currentDateInIst = this.getDateInIst();
    const dobDayjs = this.getDateWithFormatInIst(dob, format);
    return currentDateInIst.diff(dobDayjs, 'year') >= 18;
  }

  static formatTime(time: string): string {
    const [hours, minutes] = time.split(':');
    const numericHours = parseInt(hours);
    const numericMinutes = parseInt(minutes);

    const ampm = numericHours >= 12 ? 'PM' : 'AM';
    const formattedHours = (numericHours % 12 || 12).toString();
    const formattedMinutes =
      numericMinutes < 10 ? `0${numericMinutes}` : numericMinutes.toString();

    const formattedTime = `${formattedHours}:${formattedMinutes} ${ampm}`;

    return formattedTime;
  }

  static formatDateOBPP(dateTime: string): string {
    const date = new Date(dateTime);
    const day = date.getDate();
    const month = date.toLocaleString('default', { month: 'short' });

    return `${day} ${month}`;
  }

  static formatDate(
    date: Date | string,
    format: string = 'YYYY-MM-DD',
  ): string {
    return dayjs(date).format(format);
  }

  static checkIfDatesAreSame(
    date1: string | Dayjs,
    date2?: string | Dayjs,
  ): boolean {
    return (
      dayjs(date1).format('YYYY-MM-DD') === dayjs(date2).format('YYYY-MM-DD')
    );
  }

  static isT1LessThanT2(T1: Dayjs, T2: Dayjs): boolean {
    const t1Seconds = T1.hour() * 3600 + T1.minute() * 60 + T1.second(); // change time to seconds
    const t2Seconds = T2.hour() * 3600 + T2.minute() * 60 + T2.second(); // change time to seconds
    return t1Seconds < t2Seconds;
  }

  static extractDateParts(dateString: string): {
    year: number;
    month: number;
    day: number;
  } {
    //  parsing the date using both DD/MM/YYYY and ISO formats
    const date = dayjs(dateString, ['DD/MM/YYYY', 'YYYY-MM-DD']);

    if (date.isValid()) {
      const year = date.year();
      const month = date.month() + 1; // dayjs month is 0-indexed, January is 0 and December is 11
      const day = date.date();

      return { year, month, day };
    }
  }

  static getTimeInCronFormat(date: string | Date): {
    [key: string]: string | number;
  } {
    let cron = dayjs(date).format('DD/MM/YYYY,HH:mm:ss').split(',');
    let dateVal = cron[0].split('/'),
      timeVal = cron[1].trim().split(':');
    let hh = Number(timeVal[0]);
    let mn: number | string = Number(timeVal[1]);
    let dd = Number(dateVal[0]);
    if (mn > 59) {
      mn = mn - 59;
      mn = mn < 10 ? `0${mn}` : mn;
      hh = hh + 1;
    }
    if (hh > 24) {
      hh = 1;
      dd = dd + 1;
    }
    return {
      mn: mn,
      hh: hh,
      dd: dd,
      mm: dateVal[1],
      yy: dateVal[2],
    };
  }

  static checkIfDateInNotSameOrTomorrow(date1: string | Dayjs): boolean {
    const date1Obj = dayjs(date1);

    // Check if dates are the same or if date1 is tomorrow relative to date2
    const isSameDate = date1Obj.isSame(dayjs(), 'day');
    const isTomorrow = date1Obj.isSame(dayjs().add(1, 'day'), 'day');

    return !(isSameDate || isTomorrow);
  }
}