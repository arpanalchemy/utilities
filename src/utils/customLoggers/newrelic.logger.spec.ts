import axios from 'axios';
import { NewRelicTransport } from './newrelic.logger';

jest.mock('axios', () => ({
  post: jest.fn(() => Promise.resolve({})),
}));

describe('NewRelicTransport', () => {
  let newRelicTransport: NewRelicTransport;

  beforeEach(() => {
    process.env.NEW_RELIC_API_KEY = 'temp-api-key';
    (axios.post as jest.Mock).mockClear();
    newRelicTransport = new NewRelicTransport();
  });

  it('should be defined', () => {
    expect(newRelicTransport).toBeDefined();
  });
});
