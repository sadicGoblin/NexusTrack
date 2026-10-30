import { Module } from '@nestjs/common';
import { ParametrosController } from './parametros.controller.js';

@Module({ controllers: [ParametrosController] })
export class ParametrosModule {}
