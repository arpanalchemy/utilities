import dayjs from 'dayjs';
import { TimeUtils } from './timeUtils.service';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

describe("TimeUtils", () => {
  it("formats time without timezone", () => {
    const result = TimeUtils.setTimeFormat(
      "2024-01-30",
      "12:30:00",
      "YYYY/MM/DD HH:mm:ss"
    );
    expect(result).toBe("2024/01/30 12:30:00");
  });

  it("formats time with timezone", () => {
    const result = TimeUtils.setTimeFormat(
      "2024-01-30",
      "12:30:00",
      "YYYY/MM/DD HH:mm:ss",
      true
    );
    expect(result).toEqual("2024/01/30 12:30:00");
  });

  it('defaults to "YYYY-MM-DD" format if no format is provided', () => {
    const result = TimeUtils.setTimeFormat("2024-01-30", "12:30:00");
    expect(result).toBe("2024-01-30");
  });

  it("gets time based on parameter value", () => {
    const parameterValue = "1234567890";
    const result = TimeUtils.getTime(parameterValue);
    expect(result).toBe("06:56:07");
  });
});
