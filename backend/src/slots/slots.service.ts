import { Injectable } from '@nestjs/common';

@Injectable()
export class SlotsService {
  findAll() {
    return `This action returns all slots`;
  }

  findOne(id: number) {
    return `This action returns a #${id} slot`;
  }

  remove(id: number) {
    return `This action removes a #${id} slot`;
  }
}
