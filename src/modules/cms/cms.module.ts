import { Module } from '@nestjs/common';
import { BlogModule } from './blog/blog.module';
import { NewsletterModule } from './newsletter/newsletter.module';

@Module({
  imports: [BlogModule, NewsletterModule],
  controllers: [],
  providers: [],
})
export class CmsModule {}
