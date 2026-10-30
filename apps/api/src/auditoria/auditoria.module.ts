import { Module } from '@nestjs/common';
import { AuditoriaController } from './auditoria.controller.js';

@Module({ controllers: [AuditoriaController] })
export class AuditoriaModule {}
