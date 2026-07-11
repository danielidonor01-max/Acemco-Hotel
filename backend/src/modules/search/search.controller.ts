import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { AuthenticatedOnly } from '../../common/decorators/authenticated-only.decorator';

@ApiTags('search')
@Controller('v1/search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  // Authenticated-only (no specific permission) — internal global search.
  @AuthenticatedOnly()
  @Get()
  run(@Query('q') q = '') {
    return this.search.search(q);
  }
}
