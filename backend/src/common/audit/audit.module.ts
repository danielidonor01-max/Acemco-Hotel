import { Global, Module } from '@nestjs/common';
import { AuditWriter } from './audit-writer.service';

/** Global so the interceptor and the exception filter can both write the trail. */
@Global()
@Module({
  providers: [AuditWriter],
  exports: [AuditWriter],
})
export class AuditModule {}
