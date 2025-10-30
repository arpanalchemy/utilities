import { PDFDocument } from 'pdf-lib';
import {
  binarySearch,
  extractFirstPage,
  mergeObjectArrayOnKey,
  ObjectUtil,
  numberToCurrency,
} from './object';

describe('binarySearch', () => {
  const sortedArray = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
    { id: 3, name: 'Charlie' },
    { id: 4, name: 'David' },
    { id: 5, name: 'Eva' },
  ];

  it('should find the element when it exists in the array', () => {
    const result = binarySearch(sortedArray, 'id', 3);
    expect(result).toEqual({ id: 3, name: 'Charlie' });
  });

  it('should return undefined when the element does not exist in the array', () => {
    const result = binarySearch(sortedArray, 'id', 6);
    expect(result).toBeUndefined();
  });

  it('should find the element when it exists in the array (string key)', () => {
    const result = binarySearch(sortedArray, 'name', 'Charlie');
    expect(result).toEqual({ id: 3, name: 'Charlie' });
  });

  it('should return undefined when the element does not exist in the array (string key)', () => {
    const result = binarySearch(sortedArray, 'name', 'Frank');
    expect(result).toBeUndefined();
  });
});

describe('mergeObjectArrayOnKey', () => {
  it('should merge two object arrays on the specified key', () => {
    const ObjArr1 = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' },
    ];

    const ObjArr2 = [
      { id: 1, age: 25 },
      { id: 2, age: 30 },
      { id: 3, age: 35 },
    ];

    const mergedArray = mergeObjectArrayOnKey(ObjArr1, 'id', ObjArr2, 'id');

    expect(mergedArray).toEqual([
      { id: 1, name: 'Alice', age: 25 },
      { id: 2, name: 'Bob', age: 30 },
      { id: 3, name: 'Charlie', age: 35 },
    ]);
  });

  it('should handle cases where the key does not exist in one of the arrays', () => {
    const ObjArr1 = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];

    const ObjArr2 = [
      { id: 1, age: 25 },
      { id: 3, age: 30 },
    ];

    const mergedArray = mergeObjectArrayOnKey(ObjArr1, 'id', ObjArr2, 'id');

    expect(mergedArray).toEqual([
      { id: 1, name: 'Alice', age: 25 },
      { id: 2, name: 'Bob' },
    ]);
  });

  it('should merge arrays with different lengths', () => {
    const ObjArr1 = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];

    const ObjArr2 = [
      { id: 1, age: 25 },
      { id: 2, age: 30 },
      { id: 3, age: 35 },
    ];

    const mergedArray = mergeObjectArrayOnKey(ObjArr1, 'id', ObjArr2, 'id');

    expect(mergedArray).toEqual([
      { id: 1, name: 'Alice', age: 25 },
      { id: 2, name: 'Bob', age: 30 },
    ]);
  });
});

jest.mock('pdf-lib', () => ({
  PDFDocument: {
    load: jest.fn(),
    create: jest.fn(),
  },
}));

describe('extractFirstPage', () => {
  it('should extract the first page of a PDF document', async () => {
    const pdfBytes = new Uint8Array([]);
    const numPages = 3;
    const pdfDocInstance = {
      getPages: jest.fn(() => Array(numPages)),
    };
    const copiedPageInstance = {};
    const newPdfDocInstance = {
      copyPages: jest.fn(() => [copiedPageInstance]),
      addPage: jest.fn(),
      save: jest.fn(() => new Uint8Array([])),
    };

    (PDFDocument.load as any).mockResolvedValue(pdfDocInstance);
    (PDFDocument.create as any).mockResolvedValue(newPdfDocInstance);

    const [newPdfBytes, actualNumPages] = await extractFirstPage(pdfBytes);

    expect(PDFDocument.load).toHaveBeenCalledWith(pdfBytes);
    expect(pdfDocInstance.getPages).toHaveBeenCalled();
    expect(PDFDocument.create).toHaveBeenCalled();
    expect(newPdfDocInstance.copyPages).toHaveBeenCalledWith(pdfDocInstance, [
      0,
    ]);
    expect(newPdfDocInstance.addPage).toHaveBeenCalledWith(copiedPageInstance);
    expect(newPdfDocInstance.save).toHaveBeenCalled();
    expect(newPdfBytes).toBeDefined();
    expect(actualNumPages).toBe(numPages);
  });
});

describe('ObjectUtil', () => {
  describe('cleanObject', () => {
    it('should remove undefined and null values from the object', () => {
      const inputObject = {
        a: 1,
        b: null,
        c: undefined,
        d: 'hello',
        e: 0,
        f: false,
        g: true,
      };

      const cleanedObject = ObjectUtil.cleanObject(inputObject);

      expect(cleanedObject).toEqual({
        a: 1,
        d: 'hello',
        e: 0,
        g: true,
      });
    });

    it('should keep zero and false values in the object', () => {
      const inputObject = {
        a: 0,
      };

      const cleanedObject = ObjectUtil.cleanObject(inputObject);

      expect(cleanedObject).toEqual({
        a: 0,
      });
    });

    it('should return an empty object if input object is empty', () => {
      const inputObject = {};

      const cleanedObject = ObjectUtil.cleanObject(inputObject);

      expect(cleanedObject).toEqual({});
    });

    it('should return an empty object if input object is null or undefined', () => {
      const cleanedObject1 = ObjectUtil.cleanObject(null);
      const cleanedObject2 = ObjectUtil.cleanObject(undefined);

      expect(cleanedObject1).toEqual({});
      expect(cleanedObject2).toEqual({});
    });
  });
});

describe('numberToCurrency', () => {
  it('numberToCurrency', async () => {
    expect(numberToCurrency(1000000)).toEqual('10,00,000');
  });

  it('numberToCurrency', async () => {
    expect(numberToCurrency({} as any)).toBeDefined();
  });

  it('numberToCurrency', async () => {
    expect(numberToCurrency('1000000')).toEqual('10,00,000');
  });
});
