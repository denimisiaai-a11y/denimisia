import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SearchService } from './search.service';

@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller('search')
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Get()
  search(
    @Query('q') q: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedPage = Math.max(Number(page) || 1, 1);
    const parsedLimit = Math.min(Number(limit) || 20, 50);
    return this.searchService.searchProducts(q, parsedPage, parsedLimit);
  }

  @Get('suggestions')
  suggestions(@Query('q') q: string) {
    return this.searchService.getSuggestions(q);
  }
}
