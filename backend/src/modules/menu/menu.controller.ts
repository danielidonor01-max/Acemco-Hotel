import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Storefront } from '@prisma/client';
import { z } from 'zod';
import { MenuService } from './menu.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

const VIEW = 'pos.restaurant:VIEW';
const EDIT = 'pos.restaurant:UPDATE';

const categorySchema = z.object({ storefront: z.nativeEnum(Storefront), name: z.string().min(1), sortOrder: z.number().int().optional() });
const categoryUpdateSchema = z.object({ name: z.string().min(1).optional(), sortOrder: z.number().int().optional(), isActive: z.boolean().optional() });
const itemSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().min(0),
  tags: z.array(z.string()).optional(),
  imageKey: z.string().optional(),
  isAvailable: z.boolean().optional(),
  isHidden: z.boolean().optional(),
});
const itemUpdateSchema = itemSchema.partial().omit({ categoryId: true });

@ApiTags('menu')
@Controller('v1/menu')
export class MenuController {
  constructor(private readonly menu: MenuService) {}

  @Get()
  @RequirePermissions(VIEW)
  list() {
    return this.menu.listAll();
  }

  @Post('categories')
  @RequirePermissions(EDIT)
  createCategory(@Body(new ZodValidationPipe(categorySchema)) dto: z.infer<typeof categorySchema>) {
    return this.menu.createCategory(dto);
  }

  @Patch('categories/:id')
  @RequirePermissions(EDIT)
  updateCategory(@Param('id') id: string, @Body(new ZodValidationPipe(categoryUpdateSchema)) dto: z.infer<typeof categoryUpdateSchema>) {
    return this.menu.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @RequirePermissions(EDIT)
  deleteCategory(@Param('id') id: string) {
    return this.menu.deleteCategory(id);
  }

  @Post('items')
  @RequirePermissions(EDIT)
  createItem(@Body(new ZodValidationPipe(itemSchema)) dto: z.infer<typeof itemSchema>) {
    return this.menu.createItem(dto);
  }

  @Patch('items/:id')
  @RequirePermissions(EDIT)
  updateItem(@Param('id') id: string, @Body(new ZodValidationPipe(itemUpdateSchema)) dto: z.infer<typeof itemUpdateSchema>) {
    return this.menu.updateItem(id, dto);
  }

  @Delete('items/:id')
  @RequirePermissions(EDIT)
  deleteItem(@Param('id') id: string) {
    return this.menu.deleteItem(id);
  }
}
