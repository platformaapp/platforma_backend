import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface WebinarRuSession {
  id: number;
  name: string;
  startsAt: string;
  endsAt: string;
  url: string;
  moderatorUrl?: string;
  status: string;
}

interface WebinarRuRegistration {
  id: number;
  participantLink: string;
}

@Injectable()
export class WebinarRuService {
  private readonly logger = new Logger(WebinarRuService.name);
  private readonly apiKey: string;
  private readonly orgId: string;
  private readonly baseUrl = 'https://api.webinar.ru/v3';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('WEBINAR_RU_API_KEY', '');
    this.orgId = this.configService.get<string>('WEBINAR_RU_ORG_ID', '');

    if (!this.apiKey || !this.orgId) {
      this.logger.warn(
        'WEBINAR_RU_API_KEY or WEBINAR_RU_ORG_ID not set — Webinar.ru integration disabled'
      );
    }
  }

  get isConfigured(): boolean {
    return !!(this.apiKey && this.orgId);
  }

  async createEvent(params: {
    name: string;
    description?: string;
    startsAt: Date;
    endsAt: Date;
  }): Promise<{ sessionId: string; participantUrl: string; moderatorUrl: string }> {
    const body = {
      name: params.name,
      description: params.description || '',
      startsAt: this.toIso(params.startsAt),
      endsAt: this.toIso(params.endsAt),
      access: 'private',
      autoStart: false,
      autoStop: true,
    };

    const data = await this.request<WebinarRuSession>(
      'POST',
      `/organization/${this.orgId}/eventsessions`,
      body
    );

    this.logger.log(`Webinar.ru event created: id=${data.id}, url=${data.url}`);

    return {
      sessionId: String(data.id),
      participantUrl: data.url,
      moderatorUrl: data.moderatorUrl || data.url,
    };
  }

  async updateEvent(
    sessionId: string,
    params: { name?: string; startsAt?: Date; endsAt?: Date; description?: string }
  ): Promise<void> {
    const body: Record<string, unknown> = {};
    if (params.name !== undefined) body.name = params.name;
    if (params.description !== undefined) body.description = params.description;
    if (params.startsAt !== undefined) body.startsAt = this.toIso(params.startsAt);
    if (params.endsAt !== undefined) body.endsAt = this.toIso(params.endsAt);

    await this.request('PUT', `/eventsessions/${sessionId}`, body);
    this.logger.log(`Webinar.ru event updated: ${sessionId}`);
  }

  async deleteEvent(sessionId: string): Promise<void> {
    try {
      await this.request('DELETE', `/eventsessions/${sessionId}`, null);
      this.logger.log(`Webinar.ru event deleted: ${sessionId}`);
    } catch (error) {
      this.logger.warn(`Failed to delete Webinar.ru event ${sessionId}: ${(error as Error).message}`);
    }
  }

  /**
   * Registers a participant and returns their personal join link.
   * If already registered, the API returns the existing link.
   */
  async registerParticipant(
    sessionId: string,
    email: string,
    name: string
  ): Promise<string> {
    try {
      const data = await this.request<WebinarRuRegistration>(
        'POST',
        `/eventsessions/${sessionId}/registrations`,
        { email, name }
      );
      return data.participantLink;
    } catch (error) {
      this.logger.warn(
        `Failed to register participant ${email} for session ${sessionId}: ${(error as Error).message}`
      );
      return '';
    }
  }

  async getRecordingUrl(sessionId: string): Promise<string | null> {
    try {
      const data = await this.request<any>('GET', `/eventsessions/${sessionId}/records`, null);
      const records: any[] = Array.isArray(data) ? data : data?.records || [];
      if (records.length === 0) return null;
      const latest = records[records.length - 1];
      return latest?.url || latest?.link || null;
    } catch (error) {
      this.logger.warn(`Failed to get recording for session ${sessionId}`);
      return null;
    }
  }

  private toIso(date: Date): string {
    // Webinar.ru expects ISO 8601 with timezone
    return date.toISOString();
  }

  private async request<T>(method: string, path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const options: RequestInit = {
      method,
      headers: {
        'x-auth-token': this.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    };

    if (body !== null && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Webinar.ru API ${method} ${path} → ${response.status}: ${text}`);
    }

    // DELETE may return empty body
    if (method === 'DELETE') return undefined as unknown as T;

    const json = await response.json();
    return json as T;
  }
}
