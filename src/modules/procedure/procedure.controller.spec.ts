import { Test, TestingModule } from '@nestjs/testing';
import { ProceduresController } from './procedure.controller';
import { ProceduresService } from './procedure.service';

describe('ProcedureController', () => {
  let controller: ProceduresController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProceduresController],
      providers: [ProceduresService],
    }).compile();

    controller = module.get<ProceduresController>(ProceduresController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
