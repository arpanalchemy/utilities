import { Test } from '@nestjs/testing';
import { DateCalculationUtil } from './dateCalculation.util.service';

describe('DateCalculationUtil', () => {
  let dateCalculationUtil: DateCalculationUtil;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [DateCalculationUtil],
    }).compile();

    dateCalculationUtil = module.get<DateCalculationUtil>(DateCalculationUtil);
  });

  describe('isWeekend', () => {
    it('should return true for Saturday', () => {
      expect(dateCalculationUtil.isWeekend('2024-01-27')).toBe(true);
    });

    it('should return true for Sunday', () => {
      expect(dateCalculationUtil.isWeekend('2024-01-28')).toBe(true);
    });

    it('should return false for Monday', () => {
      expect(dateCalculationUtil.isWeekend('2024-01-29')).toBe(false);
    });
  });

  describe('checkInvestmentDateExistsInHolidays', () => {
    it('should return undefined for non-holiday date', () => {
      const holidays = [
        {
          date: '2024-01-27',
          description: 'Holiday',
          id: 1,
          depository: 'CDSL',
          day: 'testing',
          createdAt: '2024-01-27',
          updateAt: '2024-01-27',
        },
      ];
      expect(
        dateCalculationUtil.checkInvestmentDateExistsInHolidays(
          '2024-01-28',
          holidays,
        ),
      ).toBeUndefined();
    });

    it('should return holiday details for holiday date', () => {
      const holidays = [
        {
          date: '2024-01-27',
          description: 'Holiday',
          id: 1,
          depository: 'CDSL',
          day: 'testing',
          createdAt: '2024-01-27',
          updateAt: '2024-01-27',
        },
      ];
      expect(
        dateCalculationUtil.checkInvestmentDateExistsInHolidays(
          '2024-01-27',
          holidays,
        ),
      ).toEqual(holidays[0]);
    });
  });

  describe('convertDate function', () => {
    test('should return the start of the day in UTC time for a valid date string', () => {
      const result = dateCalculationUtil.convertDate('2024-02-22');
      expect(result.isValid()).toBe(true);
      expect(result.format('YYYY-MM-DD HH:mm:ss')).toBe('2024-02-21 18:30:00');
      expect(result.utcOffset()).toBe(0); // Check if UTC offset is 0
    });

    test('should return the start of the day in UTC time for a valid Date object', () => {
      const result = dateCalculationUtil.convertDate(
        new Date('2024-02-22T12:34:56Z'),
      );
      expect(result.isValid()).toBe(true);
      expect(result.format('YYYY-MM-DD HH:mm:ss')).toBe('2024-02-21 18:30:00');
      expect(result.utcOffset()).toBe(0); // Check if UTC offset is 0
    });

    test('should return an invalid date for an invalid date string', () => {
      const result = dateCalculationUtil.convertDate('invalid-date');
      expect(result.isValid()).toBe(false);
    });

    test('should return an invalid date for an invalid Date object', () => {
      const result = dateCalculationUtil.convertDate(new Date('invalid-date'));
      expect(result.isValid()).toBe(false);
    });
  });

  describe('checkInvestmentDateExistsInHolidays', () => {
    it('should return the correct holiday calendar if investment date exists in holidays', () => {
      const holidays = [
        {
          date: '2024-01-27',
          description: 'Holiday',
          id: 1,
          depository: 'CDSL',
          day: 'testing',
          createdAt: '2024-01-27',
          updateAt: '2024-01-27',
        },
      ];
      const investmentDate = '2024-01-27';
      expect(
        dateCalculationUtil.checkInvestmentDateExistsInHolidays(
          investmentDate,
          holidays,
        ),
      ).toEqual({
        date: '2024-01-27',
        description: 'Holiday',
        id: 1,
        depository: 'CDSL',
        day: 'testing',
        createdAt: '2024-01-27',
        updateAt: '2024-01-27',
      });
    });

    it('should return undefined if investment date does not exist in holidays', () => {
      const holidays = [
        {
          date: '2024-01-27',
          description: 'Holiday',
          id: 1,
          depository: 'CDSL',
          day: 'testing',
          createdAt: '2024-01-27',
          updateAt: '2024-01-27',
        },
      ];
      const investmentDate = '2024-01-28';
      expect(
        dateCalculationUtil.checkInvestmentDateExistsInHolidays(
          investmentDate,
          holidays,
        ),
      ).toBeUndefined();
    });
  });

  describe('checkHoliday', () => {
    it('should return a non-holiday date', () => {
      const holidays = [
        {
          date: '2024-01-27',
          description: 'Holiday',
          id: 1,
          depository: 'CDSL',
          day: 'testing',
          createdAt: '2024-01-27',
          updateAt: '2024-01-27',
        },
      ];
      const date = '2024-01-26';
      expect(dateCalculationUtil.checkHoliday(date, holidays)).toBe(
        '2024-01-26',
      );
    });
  });

  describe('calculateTplus2days', () => {
    it('should return the correct date two business days ahead', () => {
      const holidays = [];
      const date = '2024-03-18';
      expect(dateCalculationUtil.calculateTplus2days(date, holidays)).toBe(
        '2024-03-20T00:00:00+05:30',
      );
    });
  });

  describe('getRfqInvestmentDate', () => {
    it('should return the correct investment date for RFQ', () => {
      const holidays = [];
      const date = '2024-03-18';
      expect(dateCalculationUtil.getRfqInvestmentDate(date, holidays)).toBe(
        '2024-03-19',
      );
    });
  });

  describe('getNonRfqInvestmentDate', () => {
    it('should return the correct investment date for non-RFQ', () => {
      const holidays = [];
      const date = '2024-03-18';
      expect(dateCalculationUtil.getNonRfqInvestmentDate(date, holidays)).toBe(
        '2024-03-20',
      );
    });
  });
});
