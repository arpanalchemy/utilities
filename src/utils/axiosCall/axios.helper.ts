import { Inject, Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { URLService } from '../urlService/url.service';
import { HeaderDTO } from './axios.dto';

@Injectable()
export class AxiosHelper {
  @Inject()
  private readonly urlService: URLService;

  @Inject(WINSTON_MODULE_PROVIDER)
  private readonly logger: Logger;

  private readonly config = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  createHeadPayload<T>(url: string, config: T) {
    return {
      ...this.createPayloadGeneric<T>(url, config),
      method: this.urlService.head,
    };
  }

  createGetPayload<T>(url: string, config: T) {
    return {
      ...this.createPayloadGeneric<T>(url, config),
      method: this.urlService.get,
    };
  }

  createPostPayload<S, T>(url: string, body: S, config: T) {
    return {
      method: this.urlService.post,
      ...this.createPayloadGeneric<T>(url, config),
      data: body,
    };
  }

  createPutPayload<S, T>(url: string, body: S, config: T) {
    return {
      method: this.urlService.put,
      ...this.createPayloadGeneric<T>(url, config),
      data: body,
    };
  }

  createDeletePayload<S, T>(url: string, body: S, config: T) {
    return {
      method: this.urlService.delete,
      ...this.createPayloadGeneric<T>(url, config),
      data: body,
    };
  }

  createPatchPayload<S, T>(url: string, body: S, config: T) {
    return {
      method: this.urlService.patch,
      ...this.createPayloadGeneric<T>(url, config),
      data: body,
    };
  }

  private createPayloadGeneric<T>(url: string, config: T) {
    const newConfig = config || this.config;
    return {
      url,
      timeout: this.urlService.apiTimeout(),
      ...newConfig,
    };
  }

  async headData<T, S = null>(url: string, config?: S): Promise<T> {
    try {
      this.logger.debug('Attempting HEAD Request\nURL : ' + url);
      const response = await axios(this.createHeadPayload(url, config));
      this.logger.debug(response);
      return response.status as unknown as T;
    } catch (e) {
      this.handleError(e);
    }
  }

  async getData<T, S = null>(
    url: string,
    config?: S,
    UnauthorizedReturn?: boolean,
  ): Promise<T> {
    try {
      this.logger.debug('Attempting GET Request\nURL : ' + url);
      const response = await axios(this.createGetPayload(url, config));
      return response.data as T;
    } catch (e) {
      if (UnauthorizedReturn && e?.response?.status === 401) {
        return e?.response?.status;
      }
      this.handleError(e);
    }
  }

  async postData<U, S = null, T = null>(
    url: string,
    body?: S,
    config?: T,
    UnauthorizedReturn?: boolean,
    responseStatus = false,
  ): Promise<U | any> {
    try {
      this.logPostLogin<S>(url, body);
      const response = await axios(this.createPostPayload(url, body, config));
      if (responseStatus) return response;
      return response.data as U;
    } catch (e) {
      if (UnauthorizedReturn && e?.response?.status === 401) {
        return e?.response?.status;
      }
      this.handleError(e);
    }
  }

  async deleteData<S, U>(
    url: string,
    body?: S,
    config?: HeaderDTO,
  ): Promise<U> {
    try {
      this.logPostData<S>(url, body);
      const response = await axios(this.createDeletePayload(url, body, config));
      return response.data as U;
    } catch (e) {
      this.handleError(e);
    }
  }

  async putData<U, S = null, T = null>(
    url: string,
    body?: S,
    config?: T,
  ): Promise<U> {
    try {
      this.logPutLogin<S>(url, body);
      const response = await axios(this.createPutPayload(url, body, config));
      return response.data as U;
    } catch (e) {
      this.handleError(e);
    }
  }

  async patchData<U, S = null, T = null>(
    url: string,
    body?: S,
    config?: T,
  ): Promise<U> {
    try {
      this.logPatchLogin<S>(url, body);
      const response = await axios(this.createPatchPayload(url, body, config));
      this.logger.debug(response.data);
      return response.data as U;
    } catch (e) {
      this.handleError(e);
    }
  }

  private logPostLogin<T>(url: string, body?: T): void {
    const bodyString =
      typeof body === 'object' ? JSON.stringify(body) : String(body);
    const truncatedBody =
      bodyString.length > 51200
        ? bodyString.substring(0, 51200) + '... (truncated)'
        : bodyString;
    this.logger.debug(
      `Attempting POST Request\nURL : ${url}
       Body: ${truncatedBody}`,
    );
  }

  private logPutLogin<T>(url: string, body?: T): void {
    const bodyString =
      typeof body === 'object' ? JSON.stringify(body) : String(body);
    const truncatedBody =
      bodyString.length > 51200
        ? bodyString.substring(0, 51200) + '... (truncated)'
        : bodyString;
    this.logger.debug(
      `Attempting PUT Request\nURL : ${url}
       Body: ${truncatedBody}`,
    );
  }

  private logPatchLogin<T>(url: string, body?: T): void {
    const bodyString =
      typeof body === 'object' ? JSON.stringify(body) : String(body);
    const truncatedBody =
      bodyString.length > 51200
        ? bodyString.substring(0, 51200) + '... (truncated)'
        : bodyString;
    this.logger.debug(
      `Attempting PATCH Request\nURL : ${url}
       Body: ${truncatedBody}`,
    );
  }

  private logPostData<T>(url: string, body?: T): void {
    const bodyString =
      typeof body === 'object' ? JSON.stringify(body) : String(body);
    const truncatedBody =
      bodyString.length > 51200
        ? bodyString.substring(0, 51200) + '... (truncated)'
        : bodyString;
    this.logger.debug(
      `Attempting POST Request\nURL : ${url}
       Body: ${truncatedBody}`,
    );
  }

  private handleError(e: AxiosError): void {
    const errorBodyString =
      typeof e?.response?.data === 'object'
        ? JSON.stringify(e?.response?.data)
        : String(e?.response?.data);
    const truncatedErrorBody =
      errorBodyString.length > 51200
        ? errorBodyString.substring(0, 51200) + '... (truncated)'
        : errorBodyString;
    this.logger.error(
      `Error in axios service:
       Status : ${e?.response?.status}
       Message : ${e?.response?.statusText}
       Body : ${truncatedErrorBody}`,
    );
    throw e;
  }
}
