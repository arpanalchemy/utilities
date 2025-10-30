import axios from 'axios';
import noop from 'lodash/noop';
import winston, { transports } from 'winston';
import Transport from 'winston-transport';
import dotenv from 'dotenv';
dotenv.config();

export class NewRelicTransport extends Transport {
  private url;
  private readonly logLevel = ['error', 'warning', 'info', 'debug'];

  // this will log data to console if on dev env.
  private defaultTransport = [];

  constructor() {
    super();
    this.url = `https://log-api.newrelic.com/log/v1?Api-Key=${process.env.NEW_RELIC_API_KEY}`;

    this.defaultTransport = this.logLevel.map((errorType) => {
      return new transports.Console({
        ...this.colorize(),
        level: errorType,
      });
    });
  }

  private colorize() {
    return {
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.splat(),
      ),
    };
  }

  log(info: any, callback: () => void) {
    setImmediate(() => {
      // Use the axios library to send the log data to your API
      axios
        .post(this.url, info)
        .then(() => {
          this.emit('logged', info);
        })
        .catch((_error) => {
          noop();
        });
    });
    // Perform the callback to let Winston know that the log message has been processed
    callback();
  }

  winstonTransport() {
    this.defaultTransport.push(new NewRelicTransport());
    return this.defaultTransport;
  }
}
