import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AttendeeApiResponse,
  AttendeesListResponse,
  CreateWebinarParams,
  DeleteWebinarResponse,
  MyOwnConferenceResponse,
  UpdateWebinarParams,
  UpdateWebinarResponse,
  WebinarInfoResponse,
  WebinarResponse,
} from '../utils/types';

@Injectable()
export class MyOwnConferenceService {
  private readonly logger = new Logger(MyOwnConferenceService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('MY_OWN_CONF_API_KEY');
    this.baseUrl = 'https://api.mywebinar.com';
  }

  async createWebinar(params: CreateWebinarParams): Promise<WebinarResponse> {
    const requestData = {
      key: this.apiKey,
      action: 'webinarsCreate',
      params: {
        name: params.name,
        start: params.start,
        duration: params.duration,
      },
    };

    this.logger.log('Sending request to MyOwnConference:');
    this.logger.log(JSON.stringify(requestData, null, 2));

    try {
      const response = await this.sendRequest<MyOwnConferenceResponse>(requestData);

      if (response.response.error) {
        throw new Error(`MyOwnConference API Error: ${response.response.error}`);
      }

      if (!response.response.alias || !response.response.webinarLink) {
        throw new Error('Invalid response from MyOwnConference API: missing required fields');
      }

      return {
        success: 'true',
        alias: response.response.alias,
        webinarLink: response.response.webinarLink,
        mainModeratorLink: response.response.mainModeratorLink || '',
      };
    } catch (error) {
      this.logger.error('Failed to create webinar', error);
      throw error;
    }
  }

  async updateWebinar(alias: string, params: UpdateWebinarParams): Promise<{ success: string }> {
    const requestData = {
      key: this.apiKey,
      action: 'webinarsSet',
      params: {
        alias: alias,
        name: params.name,
        start: params.start,
        duration: params.duration,
      },
    };

    try {
      const response = await this.sendRequest<UpdateWebinarResponse>(requestData);

      if (response.response.error) {
        throw new Error(`MyOwnConference API Error: ${response.response.error}`);
      }

      return {
        success: response.response.success || 'Webinar updated',
      };
    } catch (error) {
      this.logger.error('Failed to update webinar', error);
      throw error;
    }
  }

  async deleteWebinar(alias: string): Promise<{ success: string }> {
    const requestData = {
      key: this.apiKey,
      action: 'webinarsDelete',
      params: {
        alias: alias,
      },
    };

    try {
      const response = await this.sendRequest<DeleteWebinarResponse>(requestData);

      if (response.response.error) {
        throw new Error(`MyOwnConference API Error: ${response.response.error}`);
      }

      return {
        success: response.response.success || 'Webinar deleted',
      };
    } catch (error) {
      this.logger.error('Failed to delete webinar', error);
      throw error;
    }
  }

  async getWebinarInfo(alias: string): Promise<{ success: string }> {
    const requestData = {
      key: this.apiKey,
      action: 'webinarsGetInfo',
      params: {
        alias: alias,
      },
    };

    try {
      const response = await this.sendRequest<WebinarInfoResponse>(requestData);

      if (response.response.error) {
        throw new Error(`MyOwnConference API Error: ${response.response.error}`);
      }

      return {
        success: response.response.success || 'Webinar info retrieved',
      };
    } catch (error) {
      this.logger.error('Failed to get webinar info', error);
      throw error;
    }
  }

  async addAttendeeToWebinar(
    alias: string,
    attendeeEmail: string,
    attendeeName: string
  ): Promise<{ success: string }> {
    await this.createAttendee(attendeeEmail, attendeeName);

    const requestData = {
      key: this.apiKey,
      action: 'attendeesAddToWebinar',
      params: {
        alias: alias,
        attendees: [attendeeEmail],
      },
    };

    try {
      const response = await this.sendRequest<AttendeeApiResponse>(requestData);

      if (response.response.error) {
        throw new Error(`MyOwnConference API Error: ${response.response.error}`);
      }

      return {
        success: response.response.success || 'Attendee added',
      };
    } catch (error) {
      this.logger.error('Failed to add attendee to webinar', error);
      throw error;
    }
  }

  private async createAttendee(email: string, name: string): Promise<void> {
    const requestData = {
      key: this.apiKey,
      action: 'attendeesCreate',
      params: {
        name: name,
        email: email,
      },
    };

    try {
      const response = await this.sendRequest<AttendeeApiResponse>(requestData);

      if (response.response.error && !response.response.error.includes('already exists')) {
        throw new Error(`MyOwnConference API Error: ${response.response.error}`);
      }
    } catch (error) {
      this.logger.warn('Attendee might already exist', error);
    }
  }

  async getAttendeeLink(alias: string, email: string): Promise<string> {
    const requestData = {
      key: this.apiKey,
      action: 'attendeesList',
      params: {
        alias,
        fields: ['email', 'link'],
      },
    };

    try {
      const response = await this.sendRequest<AttendeesListResponse>(requestData);

      if (response.response.error) {
        throw new Error(`MyOwnConference API Error: ${response.response.error}`);
      }

      const attendee = response.response.list?.find((a) => a.email === email);
      return attendee?.link || '';
    } catch (error) {
      this.logger.error('Failed to get attendee link', error);
      throw error;
    }
  }

  private async sendRequest<T = any>(data: any): Promise<T> {
    const formData = new URLSearchParams();
    formData.append('request', JSON.stringify(data));

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    return (await response.json()) as T;
  }

  formatDateForAPI(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
}
