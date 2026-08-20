import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Newsletter } from './newsletter.schema';
import { Subscriber } from './subscriber.schema';
import { MailService } from 'src/modules/mail/mail.service';

@Injectable()
export class NewsletterService {
  private readonly logger = new Logger(NewsletterService.name);

  constructor(
    @InjectModel(Subscriber.name) private subscriberModel: Model<Subscriber>,
    @InjectModel(Newsletter.name) private newsletterModel: Model<Newsletter>,
    private readonly mailService: MailService,
  ) {}

  async subscribe(email: string) {
    const existing = await this.subscriberModel.findOne({ email });
    if (existing) throw new BadRequestException('Already subscribed');
    const subscriber = new this.subscriberModel({ email });
    return subscriber.save();
  }

  async sendNewsletter(content: string) {
    const subscribers = await this.subscriberModel
      .find()
      .select('email')
      .lean();

    this.logger.log(
      `Starting newsletter send to ${subscribers.length} subscribers`,
    );

    // Save newsletter in background
    const newsletterPromise = new this.newsletterModel({ content })
      .save()
      .catch((err) => {
        this.logger.error('Failed to save newsletter:', err);
      });

    const emailResults = await this.sendEmailsWithRetry(
      subscribers,
      'RNA Supplies Newsletter',
      content,
    );

    await newsletterPromise;

    if (emailResults.successCount === 0) {
      throw new InternalServerErrorException('No emails sent');
    }

    this.logger.log(
      `Newsletter sent: ${emailResults.successCount} successful, ${emailResults.failedCount} failed`,
    );

    return {
      success: true,
      sentTo: emailResults.successCount,
      failed: emailResults.failedCount,
      total: subscribers.length,
      failedEmails: emailResults.failedEmails,
    };
  }

  private async sendEmailsWithRetry(
    subscribers: any[],
    subject: string,
    content: string,
  ) {
    const CONCURRENCY_LIMIT = 5; // Reduced for better reliability
    let successCount = 0;
    let failedCount = 0;
    const failedEmails: string[] = [];

    // Process in smaller, more manageable batches
    for (let i = 0; i < subscribers.length; i += CONCURRENCY_LIMIT) {
      const batch = subscribers.slice(i, i + CONCURRENCY_LIMIT);

      const batchResults = await Promise.allSettled(
        batch.map((subscriber) =>
          this.sendEmailWithRetryLogic(
            subscriber.email,
            subject,
            content,
            failedEmails,
          ),
        ),
      );

      // Count results
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.success) {
          successCount++;
        }
      });

      // Small delay between batches to avoid rate limiting
      if (i + CONCURRENCY_LIMIT < subscribers.length) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      this.logger.log(
        `Batch ${Math.floor(i / CONCURRENCY_LIMIT) + 1} completed: ${successCount} successful so far`,
      );
    }

    return { successCount, failedCount: failedEmails.length, failedEmails };
  }

  private async sendEmailWithRetryLogic(
    email: string,
    subject: string,
    content: string,
    failedEmails: string[],
    maxRetries: number = 2,
    initialDelay: number = 1000,
  ): Promise<{ success: boolean }> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          this.logger.log(`Retry ${attempt} for ${email}`);
          // Exponential backoff
          await new Promise((resolve) =>
            setTimeout(resolve, initialDelay * Math.pow(2, attempt - 1)),
          );
        }

        await this.mailService.sendEmail(email, subject, content);
        return { success: true };
      } catch (error) {
        this.logger.warn(
          `Attempt ${attempt + 1} failed for ${email}: ${error.message}`,
        );

        // If it's the last attempt, mark as failed
        if (attempt === maxRetries) {
          failedEmails.push(email);
          return { success: false };
        }

        // Check if error is retryable (not a permanent failure)
        if (this.isRetryableError(error)) {
          continue; // Retry
        } else {
          // Permanent failure (like invalid email)
          failedEmails.push(email);
          return { success: false };
        }
      }
    }

    failedEmails.push(email);
    return { success: false };
  }

  private isRetryableError(error: any): boolean {
    const retryableMessages = [
      'timeout',
      'rate limit',
      'quota',
      'busy',
      'temporary',
      'queue',
      'connection',
      'network',
    ];

    const errorMessage = error.message?.toLowerCase() || '';
    return retryableMessages.some((msg) => errorMessage.includes(msg));
  }
}
