export const INTERNAL_API_VERSION = { 'x-api-version': 'internal' };

export const errorsConfig = {
  panUploadError: {
    type: 'PAN_UPLOAD_ERROR',
    heading: 'Unable to fetch PAN details',
    message:
      'Uh oh, it seems we were unable to fetch the details. Please re-check the PAN copy and re-upload.',
  },
  bankUploadError: {
    type: 'BANK_UPLOAD_ERROR',
    heading: `We tried twice, but couldn't verify your bank details`,
    message: `Try other methods to verify your bank instead`,
  },
  digilockerError: {
    type: 'DIGILOCKER_ERROR',
    heading: 'There is some technical issue',
    message: `Please retry again`,
  },
  finprimError: {
    type: 'FINPRIM_ERROR',
    heading: 'There is some technical issue',
    message: `Please retry again`,
  },
};

export const pendingStatus = 0;
export const pendingVerificationStatus = 2;

export const SEQUELIZE = 'SEQUELIZE';

export const EXTERNAL_API_VALUES = {
  digilocker: {
    timeToExpire: 15 * 60, // time to expire in minutes
    count: 3, // maximum count of failure
  },
  okyc: {
    timeToExpire: 15 * 60, // time to expire in minutes
    count: 3, // maximum count of failure
  },
  panZoop: {
    timeToExpire: 15 * 60, // time to expire in minutes
    count: 3, // maximum count of failure
  },
  finprim: {
    timeToExpire: 15 * 60, // time to expire in minutes
    count: 3, // maximum count of failure
  },
  razorpay: {
    timeToExpire: 15 * 60, // time to expire in minutes
    count: 3, // maximum count of failure
    retryConfig: {
      maxRetries: 3,
      retryDelay: 1000,
      backoffMultiplier: 2,
    },
  },
};

export enum EXTERNAL_API_FOR_STATUS {
  digilocker = 'digilocker',
  okyc = 'okyc',
  panZoop = 'panZoop',
  finprim = 'finprim',
  razorpay = 'razorpay',
}
