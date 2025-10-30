import { Injectable, InternalServerErrorException } from '@nestjs/common';

@Injectable()
export class URLService {
  readonly get = 'get';
  readonly post = 'post';
  readonly put = 'put';
  readonly head = 'head';
  readonly delete = 'delete';
  readonly patch = 'patch';

  //Return URLS
  generateURL(resource: string): string {
    return process.env.BASE_URL + '/' + resource;
  }

  //Generate Query Strings
  createQueryFilter(obj: {
    [key: string]: string | number | boolean | number[] | string[];
  }): string {
    let returnVal = '';
    for (const key of Object.keys(obj)) {
      for (const val of this.iterable(obj[key].toString())) {
        returnVal +=
          returnVal === ''
            ? `?filter[${encodeURIComponent(key)}]=${encodeURIComponent(val)}`
            : `&filter[${encodeURIComponent(key)}]=${encodeURIComponent(val)}`;
      }
    }
    return returnVal;
  }

  createQuery(obj: {
    [key: string]: string | number | boolean | string[];
  }): string {
    let returnVal = '';
    for (const key of Object.keys(obj)) {
      if (obj[key] !== undefined) {
        for (const val of this.iterable(obj[key].toString())) {
          returnVal +=
            returnVal === ''
              ? `?${encodeURIComponent(key)}=${encodeURIComponent(val)}`
              : `&${encodeURIComponent(key)}=${encodeURIComponent(val)}`;
        }
      }
    }
    return returnVal;
  }

  createCompleteQuery(obj: {
    [key: string]: string | number | boolean | string[] | object;
  }): string {
    const { filter, ...rest } = obj;
    const filterQuery = this.createQueryFilter((filter as any) || {});
    const generalQuery = this.createQuery(rest as any).slice(1);
    const updatedGeneralQuery = filterQuery.length
      ? `&${generalQuery}`
      : `?${generalQuery}`;
    const finalQuery = filterQuery + updatedGeneralQuery;
    return finalQuery;
  }

  //Response Errors
  errorInResponse(): void {
    throw new InternalServerErrorException(`Error in Internal Communication`);
  }

  //Timeouts
  apiTimeout(): number {
    return 1000 * 2000;
  }

  private iterable(val: string | string[]): string[] {
    if (Array.isArray(val)) return val;
    return [val];
  }

  createOrderByFilter(params: string[]): string {
    if (!params || params.length < 2) {
      return '';
    }
    return `&orderBy[${params[0]}]=${params[1]}`;
  }

  arrToNumString(numArr: (number | string)[]): string {
    let returnArr = '';
    for (const num of numArr) {
      if (returnArr === '') returnArr += num + '';
      else returnArr += ',' + num;
    }
    return returnArr;
  }

  createParamFilter(params: string) {
    return `&filter[params]=${params?.split(' ').join('')}`;
  }

  stringify(obj: { [key: string]: string | number }): string {
    let returnVal = '';
    for (const key of Object.keys(obj)) {
      for (const val of this.iterable(obj[key].toString())) {
        returnVal +=
          returnVal === ''
            ? `${encodeURIComponent(key)}=${encodeURIComponent(val)}`
            : `&${encodeURIComponent(key)}=${encodeURIComponent(val)}`;
      }
    }
    return returnVal;
  }
}
