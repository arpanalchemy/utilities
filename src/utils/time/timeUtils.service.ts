import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(utc);
dayjs.extend(timezone);

export class TimeUtils {
  static setTimeFormat(
    orderDate: Date | string,
    timeFormat: string,
    format = "YYYY-MM-DD",
    timezone = false
  ): string {
    const time = timeFormat.split(":");
    let dateTime = dayjs(orderDate)
      .set("hour", Number(time[0]))
      .set("minute", Number(time[1]))
      .set("second", Number(time[2]));

    if (timezone) {
      dateTime = dateTime.tz("Asia/Kolkata");
    }

    return dateTime.format(format);
  }

  static getTime(parameterValue: string): string {
    const startOfDay = dayjs().tz("Asia/Kolkata", true).startOf("day").unix();
    return dayjs(dayjs.unix(startOfDay + Number(parameterValue) / 1000)).format(
      "HH:mm:ss"
    );
  }
}
