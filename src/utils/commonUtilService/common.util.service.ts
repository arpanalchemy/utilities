import { Injectable } from '@nestjs/common';

@Injectable()
export class CommonUtil {
  arrToNumString(numArr: number[] | number): string {
    if (Array.isArray(numArr)) {
      let returnArr = '';
      for (const num of numArr) {
        if (returnArr === '') returnArr += num + '';
        else returnArr += ',' + num;
      }
      return returnArr;
    }
    return String(numArr);
  }
}
