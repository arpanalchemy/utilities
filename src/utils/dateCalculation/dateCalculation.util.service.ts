import { Injectable } from '@nestjs/common';
import dayjs, { Dayjs } from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import utc from 'dayjs/plugin/utc';
import isBetween from 'dayjs/plugin/isBetween';
import { DepositoryHolidayCalendar } from './dateCalculation.dto';

dayjs.extend(customParseFormat);
dayjs.extend(isBetween);
dayjs.extend(isSameOrAfter);
dayjs.extend(utc);

@Injectable()
export class DateCalculationUtil {
  isWeekend(date: string): boolean {
    const day = dayjs(date).day();
    return day === 0 || day === 6;
  }

  checkInvestmentDateExistsInHolidays(
    investmentDate: string,
    holidays: DepositoryHolidayCalendar[]
  ): DepositoryHolidayCalendar | undefined {
    return holidays.find((a) => dayjs(a.date).isSame(investmentDate, "date"));
  }

  checkHoliday(date: string, holidays: DepositoryHolidayCalendar[]): string {
    // check holidays and decide date
    while (
      this.checkInvestmentDateExistsInHolidays(date, holidays) ||
      this.isWeekend(date)
    ) {
      date = dayjs(date).add(1, "day").format();
    }
    return date;
  }

  calculateTplus2days(
    date: string,
    holidays: DepositoryHolidayCalendar[],
  ): string {
    let investmentDate = date;
    for (let i = 0; i < 2; i++) {
      investmentDate = dayjs(investmentDate).add(1, 'day').format();
      investmentDate = this.checkHoliday(investmentDate, holidays);
    }
    return investmentDate;
  }

  getRfqInvestmentDate(
    date: string,
    holidays: DepositoryHolidayCalendar[],
  ): string {
    let investmentDate = dayjs(date).add(1, 'day').format();
    investmentDate = this.checkHoliday(investmentDate, holidays);
    return dayjs(investmentDate).format('YYYY-MM-DD');
  }

  getNonRfqInvestmentDate(
    date: string,
    holiday: DepositoryHolidayCalendar[],
  ): string {
    let investmentDate = dayjs(date).format();
    investmentDate = this.calculateTplus2days(investmentDate, holiday);
    investmentDate = this.checkHoliday(investmentDate, holiday);
    return dayjs(investmentDate).format('YYYY-MM-DD');
  }

  convertDate(date: string | Date): Dayjs {
    return dayjs(dayjs(date).format('YYYY-MM-DD')).startOf('day').utc();
  }
}
