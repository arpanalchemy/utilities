import { PDFDocument } from 'pdf-lib';
export class ObjectUtil {
  static cleanObject(object) {
    const _object = {};
    for (const key in object) {
      if (object[key] || object[key] === 0) {
        _object[key] = object[key];
      }
    }
    return _object;
  }
}

export async function extractFirstPage(
  pdfBytes: Uint8Array,
): Promise<[Uint8Array | null, number]> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const numPages = pdfDoc.getPages().length;
  const newPdfDoc = await PDFDocument.create();
  const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [0]);
  newPdfDoc.addPage(copiedPage);
  const newPdfBytes = await newPdfDoc.save();
  return [newPdfBytes, numPages];
}

export function binarySearch(
  arr: any[],
  key: string,
  target: string | number,
): any {
  let low = 0;
  let high = arr.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (arr[mid][key] === target) {
      return arr[mid];
    } else if (arr[mid][key] === undefined) {
      // what if mid is undefined, will not work
      return undefined;
    } else if (arr[mid][key] < target) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return undefined;
}

/**
 * doesn't merge if object key missing
 * @param ObjArr1 any[]
 * @param key1 string | number | boolean
 * @param ObjArr2 any[]
 * @param key2 string | number | boolean
 * @returns any[]
 */
export function mergeObjectArrayOnKey(
  ObjArr1: any[],
  key1: string,
  ObjArr2: any[],
  key2: string,
): any[] {
  return ObjArr1.map((obj1: any) => {
    return { ...obj1, ...ObjArr2.find((o) => o[key2] === obj1[key1]) };
  });
}

/**
 *
 * @param value the number to be converted
 * @returns the number in indian currency format i.e 1000000 to 10,00,000
 */
export function numberToCurrency(value: number | string): string {
  try {
    if (typeof value == 'string') {
      return parseFloat(value).toLocaleString('en-IN');
    }
    return value.toLocaleString('en-IN');
  } catch (e) {
    return `${value}`;
  }
}
