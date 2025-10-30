import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';

/**
 *
 * @summary This decorator will provide user data decoded from
 * JWT token. Pass-in any specific key in order to get value of
 * same.
 */
export const TerminalUserID = createParamDecorator(
  (key: string, ctx: ExecutionContext) => {
    const userData = ctx.switchToHttp().getRequest().userData;
    if (!userData)
      throw new InternalServerErrorException(
        'No TerminalData found for this Controller',
      );
    if (key) return userData[key];
    return userData;
  },
);

/**
 *
 * @summary This decorator will verify if the user is authorize
 * to perform read/write action of terminal module.
 * Pass-in any specific key in order to get value of same.
 */
export const IsAuthorized = createParamDecorator(
  (key: string[], ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const userID = request.userData.userID;
    if (!userID)
      throw new InternalServerErrorException(
        'No TerminalData found for this Controller',
      );

    const permissionData = request.permissionData;
    if (!permissionData)
      throw new InternalServerErrorException(
        'No Permission Data found for this Controller',
      );

    // fetch module i.e., kyc/spv/user
    // and action i.e., read/write
    const [module, action] = key;
    if (key && !permissionData[module]?.[action]) {
      throw new InternalServerErrorException('Access Denied');
    }
    return userID;
  },
);

/**
 *
 * @summary This decorator will return null as user data when there
 *  in no JWT token passed in request. Otherwise Pass-in any specifc
 *  key in order to get value of same.
 */
export const UserDataIfExists = createParamDecorator(
  (key: string, ctx: ExecutionContext) => {
    const userData = ctx.switchToHttp().getRequest().userData;
    if (!userData) return null;
    if (key) return userData[key];
    return userData;
  },
);

/**
 *
 * @summary This decorator will provide subscription data decoded from
 * JWT token. Pass-in any specifc key in order to get value of
 * same.
 */
export const SubscriptionData = createParamDecorator(
  (key: string, ctx: ExecutionContext) => {
    const subscriptionData = ctx.switchToHttp().getRequest().subscriptionData;
    if (!subscriptionData)
      throw new InternalServerErrorException(
        'No SubscriptionData found for this Controller',
      );
    if (key) return subscriptionData[key];
    return subscriptionData;
  },
);

/**
 *
 * @summary This decorator will provide config table data.
 * Pass-in any specifc key in order to get value of
 * same.
 */
export const ConfigData = createParamDecorator(
  (key: string, ctx: ExecutionContext) => {
    const configData = ctx.switchToHttp().getRequest().configData;
    if (!configData)
      throw new InternalServerErrorException(
        'No ConfigData found for this Controller',
      );
    if (key) return configData[key];
    return configData;
  },
);

/**
 *
 * @summary This decorator will provide actual config data.
 * Pass-in any specifc key in order to get value of
 * same.
 */
export const Config = createParamDecorator(
  (key: string, ctx: ExecutionContext) => {
    const configData = ctx.switchToHttp().getRequest().configData;
    if (!configData || !configData.configJson)
      throw new InternalServerErrorException(
        'No Config Json found for this Controller',
      );
    if (key) return configData.configJson[key];
    return configData.configJson;
  },
);

export const Cookies = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return data ? request.cookies?.[data] : request.cookies;
  },
);
