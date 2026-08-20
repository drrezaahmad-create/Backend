import { Module } from '@nestjs/common';
import { NewsletterService } from './newsletter.service';
import { NewsletterController } from './newsletter.controller';
import {
  Subscriber,
  SubscriberSchema,
} from 'src/modules/cms/newsletter/subscriber.schema';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Newsletter,
  NewsletterSchema,
} from 'src/modules/cms/newsletter/newsletter.schema';
import { MailModule } from 'src/modules/mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Subscriber.name, schema: SubscriberSchema },
      { name: Newsletter.name, schema: NewsletterSchema },
    ]),
    MailModule,
  ],
  controllers: [NewsletterController],
  providers: [NewsletterService],
})
export class NewsletterModule {}
