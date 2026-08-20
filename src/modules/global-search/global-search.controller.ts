import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { GlobalSearchService } from './global-search.service';

@Controller('search')
export class GlobalSearchController {
  constructor(private readonly globalSearchService: GlobalSearchService) {}

  @Get()
  async globalSearch(
    @Query('q') q: string,
    @Query('limit') limit = 10,
    @Query('modules') modules?: string,
  ) {
    if (!q || q.length < 2)
      throw new BadRequestException(
        'Search term (q) is required and must be at least 2 characters.'
      );
    const limitNumber = Math.max(1, Math.min(+limit, 50));
    const moduleList = modules
      ? modules.split(',').map((m) => m.trim().toLowerCase())
      : undefined;
    const result = await this.globalSearchService.search(
      q,
      limitNumber,
      moduleList
    );
    return { statusCode: 200, data: result };
  }
}
