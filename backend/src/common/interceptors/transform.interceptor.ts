import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiSuccess, PaginationMeta } from '../types/api-response.types';

interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

function isPaginated<T>(v: unknown): v is Paginated<T> {
  return typeof v === 'object' && v !== null && 'items' in v && 'meta' in v;
}

/** Wraps every successful response in the standard envelope (Blueprint §11). */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiSuccess<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiSuccess<T>> {
    return next.handle().pipe(
      map((data): ApiSuccess<T> => {
        if (isPaginated<T>(data)) {
          return { success: true, data: data.items as unknown as T, meta: data.meta };
        }
        return { success: true, data };
      }),
    );
  }
}
