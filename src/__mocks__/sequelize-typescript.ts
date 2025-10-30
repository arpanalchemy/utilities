export let stores: any = {};

export function PrimaryKey() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {};
}

export function Table(options: any) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {};
}

export function Column(options: any) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {};
}

export function Unique(options: any) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {};
}

export function Default(options: any) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {};
}

export function HasMany(callback, params) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    if (!stores.HasMany) {
      stores.HasMany = {};
    }
    stores.HasMany[propertyKey] = callback();
  };
}

export function HasOne(callback, params) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    if (!stores.HasOne) {
      stores.HasOne = {};
    }
    stores.HasOne[propertyKey] = callback();
  };
}

export function AllowNull(options: any) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {};
}

export function BelongsTo(callback, params) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    if (!stores.BelongsTo) {
      stores.BelongsTo = {};
    }
    stores.BelongsTo[propertyKey] = callback();
  };
}

export function ForeignKey(callback, params) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    if (!stores.ForeignKey) {
      stores.ForeignKey = {};
    }
    stores.ForeignKey[propertyKey] = callback();
  };
}

//Type
export const DataType = {
  BIGINT: { UNSIGNED: null },
  ENUM([args]: any[]) {},
};

export function clearStore() {
  stores = {};
}

//Methods
export const Sequelize = {
  literal(str: any) {
    return str;
  },
};

export class Model {}
